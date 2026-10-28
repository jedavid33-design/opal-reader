// Design 3.6 media lifecycle contract (candidate-owned state machine).
// Selection token + AbortController; revision re-checked immediately
// before attaching a Blob and before emitting any position/Shelf event;
// old occurrence's final position recorded BEFORE switching at segment
// end; restore applied only after loadedmetadata; out-of-duration
// restore stops/reports and is never silently clamped; waiting/stalled
// feed the Shelf bridge as pause; Blob URLs single-live; pagehide is
// never treated as playback ended.
//
// Position events are constructed HERE, in the candidate, in the
// coordinator wire shape (v2/p8/sync-contracts.md, POST
// /v2/sync/position): every event carries a contract `kind` in
// play|pause|seek|checkpoint, assigned at the emit site that knows what
// actually happened — play start/resume -> play, pause/wait/error/end
// -> pause, seek completion -> seek. (Finding F1: events previously
// carried only {occurrenceId, offsetSec, playing} and the coordinator
// rejected them all with invalid_kind; periodic checkpoints are
// emitted by the reporter's checkpoint timer with kind "checkpoint".)
//
// Repair pass (Rowan finding 3, B4):
// - Autoplay is gated on metadata/restore: if restore validation set
//   restore_offset_out_of_duration, play() refuses for that selection;
//   with asynchronous metadata, an autoplay (or play) request waits
//   for the metadata handling of the CURRENT selection to settle
//   before the media element is asked to play.
// - Listening derives from the media element's ACTUAL play outcome:
//   play() awaits the media play() promise (real elements return one).
//   A rejected or not-yet-settled play feeds NO Shelf playbackStarted
//   and NO position event; state becomes "playing" only after the
//   media element accepted playback and the selection is still current.
// - Selecting B while A is attached pauses/detaches/accounts for A
//   FIRST (§3.6: A's final position report + Shelf pause semantics),
//   awaited BEFORE `current` is reassigned and BEFORE B's fetch starts;
//   A's media cannot keep "playing" through B's fetch.
// - onEnded re-checks the selection revision AFTER its awaited final
//   report before stopping Shelf / advancing: a selection made during
//   that await displaces the advance.
// - attachMediaEvents() wires a real media element's events
//   (loadedmetadata/play/pause/playing/waiting/stalled/ended/error)
//   into the state machine, with self-trigger suppression so the
//   player's own media.play()/pause() calls are not double-counted.
//
// Follow-up (Rowan review 6389020784):
// - USER RESUME EMITS THE RESUME EVENT. play() on an already-started
//   selection (pause -> play) resumes Shelf AND emits the position
//   event kind:"play": the coordinator's playing state stays paused
//   until an actual play event arrives — a checkpoint does not
//   substitute for that transition. (Previously the resume branch
//   resumed Shelf only and the wire showed [play, pause].)
// - EVENT ORDERING. The old selfEvent boolean was cleared
//   synchronously around media.play()/pause(), while real browser
//   media events are dispatched asynchronously and can arrive LATER —
//   including after a selection replacement, where a queued pause or
//   ended for the old selection could land on the new one. Media
//   events are now (a) attributed at FIRE time to the selectionSeq
//   attached when they fired, (b) processed through a serialized
//   queue, and (c) validated at PROCESS time against the live
//   element state (media.paused / media.ended) and the currently
//   attached selection. An event whose selection is no longer
//   attached, whose detach select() is already accounting, or whose
//   claimed state contradicts the element's live state is dropped.
//
// Follow-up 4 (Rowan review 6390001977): EXISTING PLAYERS ARE
// BOUND TO THE COMPOSITION LIFECYCLE. Follow-up 3 checked admission
// at createPlayback() construction and at every bookkeeping write,
// but a player constructed while open kept a live media element:
// after closeShelfLifecycle(), calling play() on it invoked
// media.play() FIRST and only met the lifecycle_closed refusal at
// its guarded Shelf callback — media playing, state "playing", on a
// closed lifecycle that cannot account for that listening (Rowan's
// deterministic reproduction: plays:1, mediaPaused:false,
// playerState:"playing"). The binding added here:
// - An optional admissionGuard (the composition passes its boundary
//   admission check) is consulted by play() BEFORE the media element
//   is touched, by select() BEFORE a new selection is accepted, and
//   AGAIN after every awaited step (metadata wait, media.play()
//   settle): a late completion that finds admission gone stops the
//   element instead of leaving it running.
// - invalidateTerminal(code), invoked by the composition at
//   lifecycle close-start and on ownership loss, makes the player
//   terminal: it aborts a pending fetch, settles a pending metadata
//   wait as refused, stops AND detaches the media element
//   immediately, and captures a settle snapshot (the admitted
//   playback's final offset) for the composition's drain-permit
//   settlement. A terminal player never starts media, never accepts
//   a selection, and emits no further position/Shelf events.
// Standalone use (no admissionGuard, invalidateTerminal never
// called) keeps the prior library behaviour exactly.
export function createFakeMedia(opts = {}) {
  const listeners = new Map();
  return { src:null, currentTime:0, duration:NaN, paused:true, ended:false,
    _playImpl: opts.playImpl ?? null,
    addEventListener(n,f){ (listeners.get(n)??listeners.set(n,[]).get(n)).push(f); },
    emit(n){ for (const f of listeners.get(n)??[]) f(); },
    play(){ if (this._playImpl) return this._playImpl(this); this.paused=false; return Promise.resolve(); },
    pause(){ this.paused=true; } };
}
export function createPlayer({ fetchSegment, reportPosition, shelf, media, urlFactory, readIdFor, timers, onPlayingChange, admissionGuard } = {}) {
  const url = urlFactory ?? { create:(b)=>`blob:fake-${++createPlayer._n}`, revoke:()=>{} };
  let seq=0, current=null, controller=null, liveUrl=null, state="idle", startedFor=null;
  // Lifecycle binding (follow-up 4, see header): terminal is set by
  // invalidateTerminal() when the owning composition closes or loses
  // ownership; settleSnapshot carries the admitted playback's final
  // accounting coordinates for the composition's drain settlement.
  let terminal=null, settleSnapshot=null;
  let pendingRestore=null, attachedSeq=null, restoreError=null, metadataWait=null, wired=false;
  // Event-ordering state (see header): playInFlight marks a
  // programmatic play() between the media.play() call and its
  // settle; detachingSeq marks the selection select() is currently
  // accounting during a replacement; media events are serialized
  // through eventChain and attributed at fire time.
  let playInFlight=false, detachingSeq=null, eventChain=Promise.resolve();
  function enqueueMediaEvent(fn){ const run=eventChain.then(fn); eventChain=run.catch(()=>{}); return run; }
  const records=[];
  const tokenEq=(a,b)=>!!a&&!!b&&a.selectionSeq===b.selectionSeq&&a.bookId===b.bookId&&a.occurrenceId===b.occurrenceId&&a.bindingRevision===b.bindingRevision&&a.cacheKey===b.cacheKey;
  function revokeLive(){ if(liveUrl){ try{url.revoke(liveUrl);}catch{} liveUrl=null; } }
  async function guardEvent(token, fn){ if(!tokenEq(token,current)) return false; return fn(); }
  function settleMetadata(token, result){
    if (metadataWait && metadataWait.token===token) { const w=metadataWait; w.status=result.status; w.resolve(result); }
  }
  // Admission, checked before starting media or accepting a new
  // selection, and re-checked after awaited steps: terminal state
  // first (this player can never play again), then the composition's
  // admission guard when one is wired. Returns {code} or null.
  function admissionRefusal(){
    if (terminal) return { code: terminal.code };
    if (admissionGuard) {
      try { admissionGuard(); }
      catch (e) { return { code: e?.code ?? "admission_refused" }; }
    }
    return null;
  }
  // Stop the media element where it stands (no detach, no events):
  // used when a play attempt is refused at a recheck and the element
  // must not be left running by a late completion.
  function stopElement(){ try { media?.pause?.(); } catch {} }
  // Stop AND detach the media element (the select() detach pattern:
  // never assign src = null on a real element — it fetches /null).
  function detachMedia(){
    stopElement();
    revokeLive();
    try {
      if (typeof media?.removeAttribute === "function") { media.removeAttribute("src"); media.load?.(); }
      else if (media) media.src=null;
    } catch {}
    attachedSeq=null;
  }
  const player = {
    get state(){return state;}, get current(){return current;}, records,
    async select(sel, { restoreOffset=null, autoplay=false } = {}) {
      // Lifecycle admission BEFORE a new selection is accepted
      // (follow-up 4): a terminal player — or one whose composition
      // no longer admits work — refuses here, before the previous
      // selection is accounted and before any fetch begins.
      { const refusal = admissionRefusal();
        if (refusal) { records.push({code:refusal.code, via:"select_refused"}); return {attached:false, code:refusal.code}; } }
      // ---- Account for the PREVIOUS attached selection first (B4):
      // pause + detach + final position/Shelf accounting for A, awaited
      // before `current` moves and before B's fetch begins.
      const old=current;
      if (old && attachedSeq===old.selectionSeq) {
        // Events the element fires for the old selection from here on
        // are select()'s own accounting, never external input: mark
        // the detach so a late-arriving pause/ended for it is dropped
        // by the media-event validation instead of landing on the
        // selection that replaces it.
        detachingSeq=old.selectionSeq;
        try {
          try { media.pause?.(); } catch {}
          if (startedFor===old.selectionSeq) {
            onPlayingChange?.(old, false);
            await guardEvent(old, ()=>shelf?.playbackPaused?.());
            await reportPosition?.(old, {kind:"pause", occurrenceId:old.occurrenceId, offsetSec:media.currentTime, playing:false});
          }
          revokeLive();
          // Detach the resource WITHOUT assigning src = null: a real
          // HTMLMediaElement reflects null as the literal string
          // "null" and fetches GET /null from the origin (observed
          // in the real-browser proof). removeAttribute + load() is
          // the correct detach where the element supports it; plain
          // property fakes keep the assignment.
          try {
            if (typeof media.removeAttribute === "function") { media.removeAttribute("src"); media.load?.(); }
            else media.src=null;
          } catch {}
          attachedSeq=null;
        } finally { detachingSeq=null; }
      }
      const token={ selectionSeq:++seq, bookId:sel.bookId, occurrenceId:sel.occurrenceId, bindingRevision:sel.bindingRevision??null, cacheKey:sel.cacheKey??null, format:sel.format??null, sizeBytes:sel.sizeBytes??sel.size??null };
      current=token; controller?.abort(); controller=new AbortController();
      state="loading"; pendingRestore=restoreOffset; restoreError=null; metadataWait=null;
      let blob;
      try { blob = await fetchSegment(token, { signal: controller.signal }); }
      catch(e){ if(!tokenEq(token,current)) return {attached:false,stale:true};
        // A fetch aborted by lifecycle invalidation is a refusal,
        // not a fetch error (follow-up 4): the guarded shelf call in
        // the error branch would itself refuse, and no new error
        // state may be published on a terminal player.
        if (terminal) return {attached:false, code:terminal.code};
        state="error"; shelf?.playbackStopped?.(readIdFor?.(token)); records.push({code:e?.code??"fetch_error",token}); return {attached:false,error:e}; }
      // Re-check revision immediately before attaching — and the
      // lifecycle binding (follow-up 4): a fetch that resolves after
      // close attaches NOTHING.
      if(!tokenEq(token,current)) { return {attached:false,stale:true}; }
      if (terminal) return {attached:false, code:terminal.code};
      revokeLive(); liveUrl=url.create(blob); media.src=liveUrl; attachedSeq=token.selectionSeq; records.push({attached:token.selectionSeq});
      state="paused";
      // Metadata wait for THIS selection: resolved by _onMetadata.
      let resolveWait; const promise=new Promise(r=>{resolveWait=r;});
      metadataWait={ token, status:"pending", promise, resolve:resolveWait };
      media.addEventListener?.("loadedmetadata", ()=>player._onMetadata(token));
      if (media._autoMetadata) player._onMetadata(token);
      if (pendingRestore===null && metadataWait.status==="pending") settleMetadata(token, {status:"none"});
      if (autoplay) {
        const pr = await player.play();
        return { attached:true, token, played: !!pr?.played, ...(pr?.played ? {} : { autoplayBlocked:true, code: pr?.code ?? "play_blocked" }) };
      }
      return {attached:true, token};
    },
    _onMetadata(token){
      if(!tokenEq(token,current)) return;
      // Terminal (follow-up 4): metadata arriving after invalidation
      // applies no restore to the detached element; a play() waiting
      // on it is settled as refused and re-checks admission itself.
      if (terminal) { settleMetadata(token, {status:"error", code:terminal.code}); return; }
      if (pendingRestore===null) { settleMetadata(token, {status:"none"}); return; }
      const off=pendingRestore; pendingRestore=null;
      const d=media.duration;
      if (!Number.isFinite(d) || d<=0 || off>d) {
        state="error"; restoreError={ selectionSeq:token.selectionSeq, code:"restore_offset_out_of_duration" };
        const rec={code:"restore_offset_out_of_duration", occurrenceId:token.occurrenceId, carriedOffset:off, measuredDuration:d};
        records.push(rec); settleMetadata(token, {status:"error", code:rec.code}); return rec;
      }
      media.currentTime=off; settleMetadata(token, {status:"ok", restored:off}); return {restored:off};
    },
    async play(){
      const t=current; if(!t) return {played:false, code:"no_selection"};
      // Lifecycle admission BEFORE the media element is touched
      // (follow-up 4): an existing player on a closing/closed
      // lifecycle — or one whose write gate is not open — refuses
      // here. The element is stopped where it stands, because this
      // call can also arrive from the element's own "play" event
      // (native controls): refusal must not leave it running.
      { const refusal = admissionRefusal();
        if (refusal) { stopElement(); records.push({code:refusal.code, via:"play_refused"});
          return {played:false, code:refusal.code}; } }
      // Gate 1: a restore error for THIS selection blocks playback.
      if (restoreError && restoreError.selectionSeq===t.selectionSeq) return {played:false, code:"restore_offset_out_of_duration"};
      // Gate 2: asynchronous metadata/restore must settle first.
      if (metadataWait && metadataWait.token===t && metadataWait.status==="pending" && pendingRestore!==null) {
        const r = await metadataWait.promise;
        if (!tokenEq(t,current)) return {played:false, code:"stale_selection"};
        // Recheck admission after the await (follow-up 4): a
        // lifecycle close during the metadata wait refuses before
        // the media element is ever asked to play.
        { const refusal = admissionRefusal();
          if (refusal) { stopElement(); return {played:false, code:refusal.code}; } }
        if (r.status==="error") return {played:false, code:"restore_offset_out_of_duration"};
      }
      if (restoreError && restoreError.selectionSeq===t.selectionSeq) return {played:false, code:"restore_offset_out_of_duration"};
      // Listening derives from the media element's actual play outcome.
      let playResult;
      playInFlight=true;
      try { playResult = media.play?.(); if (playResult && typeof playResult.then==="function") await playResult; }
      catch(e){ playInFlight=false; if(!tokenEq(t,current)) return {played:false, code:"stale_selection"};
        if (terminal) return {played:false, code:terminal.code};
        state="paused"; const rec={code:"play_rejected", occurrenceId:t.occurrenceId, cause:e?.name ?? e?.message ?? "rejected"};
        records.push(rec); return {played:false, code:"play_rejected", error:e}; }
      playInFlight=false;
      if (!tokenEq(t,current)) return {played:false, code:"stale_selection"};
      // Recheck admission after the media.play() settle (follow-up
      // 4): the lifecycle may have closed — or ownership been lost —
      // while the play request was in flight. A late completion
      // must not leave media running or revive a terminal player:
      // stop the element (and detach it if this player is terminal)
      // instead of entering "playing".
      { const refusal = admissionRefusal();
        if (refusal) {
          if (terminal) detachMedia(); else stopElement();
          records.push({code:refusal.code, via:"play_late_refused"});
          return {played:false, code:refusal.code};
        } }
      state="playing";
      if (startedFor!==t.selectionSeq) { startedFor=t.selectionSeq;
        await guardEvent(t, ()=>{ shelf?.playbackStarted?.(readIdFor?.(t)); });
        await guardEvent(t, ()=>reportPosition?.(t, {kind:"play", occurrenceId:t.occurrenceId, offsetSec:media.currentTime, playing:true}));
      } else {
        // USER RESUME (follow-up correction 2): Shelf resumes AND the
        // position wire gets the explicit resume event. Without the
        // kind:"play" event the coordinator's canonical playing state
        // remains paused — a checkpoint does not substitute.
        await guardEvent(t,()=>shelf?.playbackResumed?.(readIdFor?.(t)));
        await guardEvent(t, ()=>reportPosition?.(t, {kind:"play", occurrenceId:t.occurrenceId, offsetSec:media.currentTime, playing:true}));
      }
      if (tokenEq(t,current) && state==="playing") onPlayingChange?.(t, true);
      return {played:true};
    },
    async pause({ fromMedia=false }={}){ // Terminal (follow-up 4): a queued pause settles nothing and emits nothing.
      if (terminal) { stopElement(); return; }
      const t=current; state="paused"; if(!fromMedia){ try{ media.pause?.(); }catch{} }
      if(t){ onPlayingChange?.(t,false); await guardEvent(t,()=>shelf?.playbackPaused?.()); await guardEvent(t,()=>reportPosition?.(t,{kind:"pause", occurrenceId:t.occurrenceId, offsetSec:media.currentTime, playing:false})); } },
    async onWaiting(kind="waiting"){ if (terminal) return; state=kind; if(current){const t=current; onPlayingChange?.(t,false); await guardEvent(t,()=>shelf?.playbackPaused?.()); await guardEvent(t,()=>reportPosition?.(t,{kind:"pause", occurrenceId:t.occurrenceId, offsetSec:media.currentTime, playing:false}));} },
    async onResumeAfterWait(){ if (terminal) { stopElement(); return; } const t=current; state="playing"; if(t){ await guardEvent(t,()=>shelf?.playbackResumed?.(readIdFor?.(t))); await guardEvent(t,()=>reportPosition?.(t,{kind:"play", occurrenceId:t.occurrenceId, offsetSec:media.currentTime, playing:true})); onPlayingChange?.(t,true);} },
    async onEnded(nextSel){
      const old=current; if(!old) return;
      // Terminal (follow-up 4): an ended event queued before
      // invalidation advances nothing and reports nothing — the
      // composition's drain settlement already accounted for the
      // admitted playback's final position.
      if (terminal) return { terminal:true };
      // FIRST: old occurrence's final position, through the reporting path.
      await reportPosition?.(old, { kind:"pause", occurrenceId:old.occurrenceId, offsetSec: media.duration, playing:false, final:true });
      // Re-check the selection revision AFTER the await (B4): a newer
      // selection made during the report displaces this advance — do
      // not stop its Shelf session and do not select over it.
      if (!tokenEq(old,current)) return { displaced:true };
      onPlayingChange?.(old, false);
      shelf?.playbackStopped?.(readIdFor?.(old));
      attachedSeq=null;
      if (nextSel) return player.select(nextSel, { autoplay:true });
      state="paused";
    },
    async onError(code="media_error"){ if (terminal) return; state="error"; revokeLive(); attachedSeq=null; if(current){const t=current; onPlayingChange?.(t,false); shelf?.playbackStopped?.(readIdFor?.(t)); await guardEvent(t,()=>reportPosition?.(t,{kind:"pause", occurrenceId:t.occurrenceId, offsetSec:media.currentTime, playing:false})); } records.push({code}); },
    // Wire a real media element's events into the state machine (B5).
    // Returns false if already wired or the element has no listener API.
    attachMediaEvents({ nextSelection } = {}){
      if (wired || !media?.addEventListener) return false; wired=true;
      // Every listener captures the selectionSeq attached AT FIRE
      // TIME and enqueues the handling; the queued step re-validates
      // against the attachment and the element's live state at
      // PROCESS time (see the header's event-ordering contract). A
      // stale event — fired for a selection since replaced, or
      // contradicted by the element's live paused/ended state — is
      // dropped, never applied to the current selection.
      const attributed = (fn) => () => { const seqAtFire = attachedSeq; void enqueueMediaEvent(() => fn(seqAtFire)); };
      media.addEventListener("loadedmetadata", ()=>player._onMetadata(current));
      media.addEventListener("waiting", attributed((s)=>{ if (s!==null && s===attachedSeq) return player.onWaiting("waiting"); }));
      media.addEventListener("stalled", attributed((s)=>{ if (s!==null && s===attachedSeq) return player.onWaiting("stalled"); }));
      media.addEventListener("playing", attributed((s)=>{ if (s===attachedSeq && (state==="waiting"||state==="stalled")) return player.onResumeAfterWait(); }));
      media.addEventListener("ended", attributed((s)=>{
        if (s===null || s!==attachedSeq) return;                    // fired for a replaced selection
        if (typeof media.ended === "boolean" && !media.ended) return; // element disagrees: stale
        return player.onEnded(nextSelection ? nextSelection() : null);
      }));
      media.addEventListener("error", attributed((s)=>{ if (s!==null && s===attachedSeq) return player.onError("media_error"); }));
      media.addEventListener("pause", attributed((s)=>{
        if (s===null || s!==attachedSeq) return;                    // fired for a replaced selection
        if (s===detachingSeq) return;                               // select() is accounting this detach itself
        if (state!=="playing") return;                             // already reflected (incl. the player's own pause())
        if (typeof media.paused === "boolean" && !media.paused) return; // element is playing: stale
        return player.pause({ fromMedia:true });
      }));
      media.addEventListener("play", attributed((s)=>{
        if (s===null || s!==attachedSeq) return;
        if (playInFlight) return;                                  // the player's own play() owns this transition
        if (state!=="paused") return;
        if (typeof media.paused === "boolean" && media.paused) return; // element is paused: stale
        return player.play();
      }));
      return true;
    },
    // Test/diagnostic seam: resolves when every media event queued
    // so far has been processed.
    eventsDrained(){ return eventChain; },
    handlePageHide({ actuallyPaused=false }={}){ // pagehide is NOT ended: no final position, no completed session
      if (terminal) return { treatedAsEnded:false, state };
      if (actuallyPaused) shelf?.playbackPaused?.();
      return { treatedAsEnded:false, state };
    },
    unload(){ revokeLive(); },
    async seek(sec){ if (terminal) return; media.currentTime=sec; if(current){const t=current; await guardEvent(t,()=>reportPosition?.(t,{kind:"seek", occurrenceId:t.occurrenceId, offsetSec:sec, playing:state==="playing"}));} },
    // Lifecycle invalidation (follow-up 4): invoked by the owning
    // composition at lifecycle close-start and on ownership loss.
    // Synchronous and total: a pending fetch is aborted, a pending
    // metadata wait is settled as refused, and the media element is
    // stopped AND detached immediately — no continuation of this
    // player can start media, attach a blob, or emit an event
    // afterwards (every public path checks the terminal flag, and
    // play() re-checks admission after its awaits). Returns the
    // settle snapshot for the admitted playback ({ token, offsetSec,
    // wasPlaying, started }) or null when nothing was attached; the
    // composition settles that bookkeeping under its drain permit.
    // Idempotent: later calls return the same snapshot.
    invalidateTerminal(code = "lifecycle_closed"){
      if (terminal) return settleSnapshot;
      terminal = { code };
      const tok = current;
      settleSnapshot = (tok && attachedSeq !== null && attachedSeq === tok.selectionSeq)
        ? { token: tok, offsetSec: media?.currentTime ?? 0,
            wasPlaying: state === "playing", started: startedFor === tok.selectionSeq }
        : null;
      try { controller?.abort(); } catch {}
      if (metadataWait && metadataWait.status === "pending") settleMetadata(metadataWait.token, { status:"error", code });
      detachMedia();
      if (settleSnapshot?.wasPlaying && tok) { try { onPlayingChange?.(tok, false); } catch {} }
      state = "stopped";
      return settleSnapshot;
    },
    get terminal(){ return terminal ? { ...terminal } : null; },
    terminalSettleSnapshot(){ return settleSnapshot; },
  };
  return player;
}
createPlayer._n=0;
