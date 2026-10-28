// Design 3.3 position reporting, repaired per Rowan finding 2 (B3).
//
// COMMIT EVIDENCE IS SEPARATE FROM DISPATCH OUTCOME. report() performs
// the local journal commit itself (store.notePosition): only a failure
// of THAT step is a storage failure (journal_storage_failed, durable
// false). Once notePosition resolves the event IS durable —
// lastDurable is set from the committed event — regardless of what the
// subsequent network dispatch does. Dispatch (positionView tip read +
// store.flushJournal) is attempted separately; its failure is reported
// as a dispatch/flush failure ({ durable:true, flushFailed:true,
// code:"position_flush_failed" }) and NEVER as journal_storage_failed.
//
// ACKNOWLEDGMENT IS DERIVED ONLY FROM PERSISTED PER-EVENT RECEIPTS.
// refreshAcknowledged() reads the journal's stored per-event state
// (journalState().events: receiptSeq / superseded / rejected exactly as
// persisted by flushJournal's receipt application) and rebuilds every
// readout from it. There is NO count-based derivation anywhere: an
// event is acknowledged iff its own stored receiptSeq is non-null and
// it is not rejected. Because the derivation runs off persisted state,
// a new reporter over the same backing storage restores lastDurable,
// lastAcknowledged, superseded, rejected and pending exactly.
//
// An optional `gate` (the composition's ownership/write boundary) is
// asserted before any mutation; standalone harness use without a gate
// keeps the reporter's library behaviour. A call may carry a
// gateOverride (follow-up 4): the composition's TERMINAL SETTLEMENT
// of already-admitted playback reports through the bookkeeping tier
// (assertStorageMutation — the follow-up-3 drain permit) instead of
// the admission tier, because the event it records belongs to work
// admitted before close-start. Ordinary reports never override.
//
// A call may also carry an `onCommit` observer (follow-up 7): it is
// invoked with the committed event at the exact moment notePosition
// resolves — the point the event becomes durable — BEFORE the
// refresh/dispatch awaits below, which may stall arbitrarily. The
// identity it delivers is operation-specific evidence for THIS
// call's commit only; the composition's close-time settlement uses
// it to prove its own commit without inferring anything from
// journal contents after the fact.
import { CHECKPOINT_INTERVAL_MS, DURABILITY_STATEMENT } from "./constants.js";
const BOUNDARY_CODES = new Set(["not_single_writer_owner", "owner_required", "writes_disabled_until_preflight",
  "lifecycle_closed", "lifecycle_drain_failed", "lifecycle_drain_bookkeeping_not_admitted"]);
export class PositionReporter {
  constructor({ store, surfaces, timers, gate } = {}) {
    this.store=store; this.surfaces=surfaces; this.gate = gate ?? null;
    this.timers = timers ?? { setInterval:(f,ms)=>setInterval(f,ms), clearInterval:(id)=>clearInterval(id) };
    this.journalStorageFailed=false; this.lastErrorCode=null; this.lastFlushFailure=null;
    this.books=new Map(); this._timer=null; this._playingBook=null; this._lastEvt=null;
  }
  _book(bookId){ if(!this.books.has(bookId)) this.books.set(bookId,{lastDurable:null,lastAcknowledged:null,canonical:null,superseded:[],rejected:[],events:[],pendingCount:0}); return this.books.get(bookId); }
  async report(bookId, evt, { flush=true, gateOverride=null, onCommit=null } = {}) {
    const b=this._book(bookId);
    // Ownership/write boundary first (composition only): a refusal is
    // not a storage failure and the event is never noted.
    const gate = gateOverride ?? this.gate;
    if (gate) {
      try { gate.assertMutation(); }
      catch (e) { this.lastErrorCode = e?.code ?? "not_single_writer_owner"; return { durable:false, refused:true, code:this.lastErrorCode }; }
    }
    // ---- Step 1: local commit. This is the ONLY storage-failure step.
    let event;
    try {
      event = await this.store.notePosition(bookId, evt);
    } catch (e) {
      if (BOUNDARY_CODES.has(e?.code)) { this.lastErrorCode = e.code; return { durable:false, refused:true, code:e.code }; }
      this.journalStorageFailed=true; this.lastErrorCode = "journal_storage_failed";
      return { durable:false, storageFailed:true, code:"journal_storage_failed", cause: e?.code ?? e?.message ?? null };
    }
    // Commit notification (follow-up 7): the caller learns the exact
    // event identity at the moment THIS call's local commit resolves,
    // before the refresh/dispatch awaits below can stall or obscure
    // it. The observer is invoked synchronously and any throw is
    // contained — a broken observer never fails the commit.
    if (onCommit) { try { onCommit(event); } catch {} }
    // Commit resolved: this event is durable from this moment, whatever
    // dispatch does next.
    const durable = { at: new Date().toISOString(), occurrenceId: evt.occurrenceId ?? event.occurrenceId ?? null,
      offsetSec: evt.offsetSec ?? null, eventId: event.eventId };
    b.lastDurable=durable;
    if (this.journalStorageFailed) this.journalStorageFailed=false; // a later successful write restores durability claims
    if (!flush) {
      await this.refreshAcknowledged(bookId);
      return { durable:true, event, flushed:false };
    }
    // ---- Step 2: dispatch. Failure here is a flush/dispatch failure,
    // reported distinctly; durability and lastDurable stand.
    try {
      let tip = 0;
      try { tip = (await this.surfaces.positionModel(bookId)).asOfReceiptSeq ?? 0; } catch { tip = b.lastAcknowledged?.receiptSeq ?? 0; }
      // positionModel also refreshed the canonical view; keep it, but do
      // not let its journal read substitute for per-event receipts.
      const res = await this.store.flushJournal(bookId, tip);
      this.lastFlushFailure = null;
      await this.refreshAcknowledged(bookId);
      return { durable:true, event, flushed:true, pushed: res?.pushed ?? null, rejected: res?.rejected ?? null };
    } catch (e) {
      if (BOUNDARY_CODES.has(e?.code)) { this.lastErrorCode = e.code; return { durable:true, event, refused:true, code:e.code }; }
      this.lastFlushFailure = { code: "position_flush_failed", cause: e?.code ?? e?.message ?? "flush_failed" };
      this.lastErrorCode = "position_flush_failed";
      // Readouts still refresh from persisted receipts (the committed
      // event correctly reads as pending, not acknowledged).
      await this.refreshAcknowledged(bookId);
      return { durable:true, event, flushed:false, flushFailed:true, code:"position_flush_failed", cause: this.lastFlushFailure.cause };
    }
  }
  // Standalone dispatch of already-committed journal events
  // (follow-up 5): exactly report()'s step 2, exposed separately so
  // the composition's close-time settlement can commit LOCALLY
  // first (report with flush:false) and then attempt the upload as
  // an OPTIONAL, separately bounded stage. Outcomes mirror report():
  // a flush failure is position_flush_failed (durability of the
  // committed events is untouched and never re-litigated here); a
  // boundary refusal is classified as a refusal, not a failure.
  // Acknowledgment still derives only from persisted per-event
  // receipts (refreshAcknowledged), never from the push result.
  async flushPending(bookId) {
    const b = this._book(bookId);
    try {
      let tip = 0;
      try { tip = (await this.surfaces.positionModel(bookId)).asOfReceiptSeq ?? 0; } catch { tip = b.lastAcknowledged?.receiptSeq ?? 0; }
      const res = await this.store.flushJournal(bookId, tip);
      this.lastFlushFailure = null;
      await this.refreshAcknowledged(bookId);
      return { flushed: true, pushed: res?.pushed ?? null, rejected: res?.rejected ?? null };
    } catch (e) {
      if (BOUNDARY_CODES.has(e?.code)) { this.lastErrorCode = e.code; return { flushed: false, refused: true, code: e.code }; }
      this.lastFlushFailure = { code: "position_flush_failed", cause: e?.code ?? e?.message ?? "flush_failed" };
      this.lastErrorCode = "position_flush_failed";
      await this.refreshAcknowledged(bookId);
      return { flushed: false, flushFailed: true, code: "position_flush_failed", cause: this.lastFlushFailure.cause };
    }
  }
  async refreshAcknowledged(bookId) {
    const b=this._book(bookId);
    try {
      const st = await this.store.journalState(bookId);
      const entries = Array.isArray(st.events) ? [...st.events].sort((x,y)=>(x.localSeq??0)-(y.localSeq??0)) : null;
      if (entries) {
        // Rebuild EVERY readout from persisted per-event state. This is
        // what makes reload restoration exact: no in-memory history is
        // consulted, and no event is acknowledged by arithmetic.
        b.events = entries.map(e=>({ at:null, occurrenceId:e.occurrenceId, offsetSec:e.offsetSec,
          eventId:e.eventId, localSeq:e.localSeq, kind:e.kind,
          receiptSeq:e.receiptSeq, superseded:!!e.superseded, rejected:e.rejected ?? null }));
        const lastEntry = entries[entries.length-1] ?? null;
        if (lastEntry) b.lastDurable = { at: b.lastDurable?.eventId===lastEntry.eventId ? b.lastDurable.at : null,
          occurrenceId:lastEntry.occurrenceId, offsetSec:lastEntry.offsetSec, eventId:lastEntry.eventId };
        const acked = entries.filter(e=>e.receiptSeq !== null && e.receiptSeq !== undefined && !e.rejected);
        const lastAck = acked[acked.length-1] ?? null;
        b.lastAcknowledged = lastAck ? { at:null, occurrenceId:lastAck.occurrenceId, offsetSec:lastAck.offsetSec,
          eventId:lastAck.eventId, receiptSeq:lastAck.receiptSeq, tip:lastAck.receiptSeq } : null;
        b.superseded = entries.filter(e=>e.superseded).map(e=>e.eventId);
        b.rejected = entries.filter(e=>e.rejected).map(e=>({ eventId:e.eventId, reason:e.rejected }));
        b.pendingCount = entries.filter(e=> (e.receiptSeq===null || e.receiptSeq===undefined) && !e.rejected).length;
      } else {
        // A store without per-event readout: surface only its explicit
        // superseded/rejected lists and counts; NEVER fabricate an
        // acknowledgment from aggregates.
        b.superseded = st.superseded ?? []; b.rejected = st.rejected ?? []; b.pendingCount = st.unacked ?? 0;
      }
    } catch { /* readout failure never fabricates an acknowledgement */ }
    try { const m = await this.surfaces.positionModel(bookId); b.canonical=m.canonical ?? null; } catch {}
    return b;
  }
  startCheckpoints(bookId, getEvt) {
    this.stopCheckpoints(); this._playingBook=bookId;
    this._timer=this.timers.setInterval(()=>{ const e=getEvt?.(); if(e) void this.report(bookId,e).catch(()=>{}); }, CHECKPOINT_INTERVAL_MS);
  }
  stopCheckpoints(){ if(this._timer) this.timers.clearInterval(this._timer); this._timer=null; }
  durabilityStatement(){ return DURABILITY_STATEMENT; }
  async bestEffortTail(bookId, evt){ // pagehide/visibility tail: attempted, never the durability mechanism
    try { return await this.report(bookId, evt); } catch { return { durable:false, tail:true }; }
  }
}
