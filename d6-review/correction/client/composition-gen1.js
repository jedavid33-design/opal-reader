// GEN1 successor of composition-ui3.js (CORRECTION, Rowan source-review
// block 6501450683): byte-identical to composition-ui3.js EXCEPT the
// constants import, which reads constants-gen1.js — so the candidate's
// Diagnostics build-marker row reports the gen-pkg-1 marker
// (d5b-v2-generation-client-1), consistent with the shell, instead of
// the stale ui3 marker. composition-ui3.js itself is NOT edited.
// UI3 candidate composition (ui-pkg-3). Delta from
// composition-ui1.js, and ONLY this: the W-4 byte-confirmation hook
// (UI3 proposal + Amendment A-1, Julie local-build Go Oct 29 2026).
// When the player reports a segment has actually started playing
// (onPlayingChange(tok, true) — which the player fires only after
// the media play() promise for that selection resolved and the
// selection is still current; failed/refused starts never reach
// it), the composition asks the store to confirm that segment's
// audio bytes via store.verifyBindingBytes(bookId, occurrenceId) —
// the store function that already existed, exported and uncalled.
// The call is fire-and-forget (never awaited in any playback path;
// failures are swallowed and record nothing; one attempt per
// initiation, no retries) and single-flighted per binding identity
// (Amendment A-1 condition 3): concurrent initiations for the same
// segment collapse to one verify call. The store module itself is
// reused byte-identical; resolvePlayback stays pure; player.js is
// untouched. Everything else in this file is the accepted UI1
// composition, byte-identical.
//
// Design 3.1/3.4/4.4 composition, repaired per Rowan findings 1+4
// (B2 ownership boundary, B5 runnable completion).
//
// ONE ENFORCED OWNERSHIP BOUNDARY. Every mutating path in the returned
// composition runs over a single boundary object built here:
//   boundary.assertOwnerTier()  — the single-writer owner currently
//                                 holds ownership (epoch-checked).
//   boundary.assertMutation()   — owner tier AND the Table C
//                                 write-enable gate is open.
//   boundary.captureEpoch() / assertEpoch(e) — the ownership epoch,
//                                 re-checked AT COMMIT TIME inside the
//                                 storage adapter (see storage-adapter).
// The boundary is enforced at the STORAGE layer, not by proxying
// selected methods: the assembled client (store + funnel + surfaces
// closures + Shelf bridge) is constructed over an ownership-gated
// storage adapter, so a surface closure holding "the raw store" still
// writes through the gate — there is no raw store left to hold. The
// device-identity shell slot is written only through an owner-gated
// shell storage, identity resolution runs only after the owner object
// is known to exist, and recovery goes through the same gated shell.
// Composing WITHOUT an owner refuses (owner_required): there is no
// optional pass-through anywhere (no optional-chaining owner access in this candidate).
//
// Ownership is HELD until in-flight work settles: mutations capture
// the owner's epoch at start; the gated adapter re-asserts that epoch
// immediately before each backing write commits, so a write whose
// ownership was lost or released mid-flight never lands; release()
// itself drains tracked in-flight mutations before freeing the lock
// (ownership.mjs).
//
// TABLE C WRITE-ENABLE GATE (design 7.3): the composition starts with
// ALL write paths disabled (position reports, sync pushes, Shelf
// flushes/session queueing, settings/quota cache mutations, recovery).
// verifyAccess() is the specified SINGLE-REQUEST access check —
// exactly one GET /v2/settings, no family sync — and it NEVER opens
// the gate by itself (follow-up correction 1: it proves Table C row
// C2 only). The gate opens only when runPreflight() passes the FULL
// Table C orchestrator for a designated probe binding: C1
// authenticated wrong-instance refusal, C2 the settings read, C3
// byte-check, C4 the 1-byte Range probe, C5 HEAD (plain and with
// Range, identical metadata), C6 the conditional (If-None-Match)
// probe. A failed, incomplete, or invalidated preflight leaves or
// reverts the gate closed, and every step's outcome is diagnosable
// via writeGateState() / diagnostics. Reads the preflight itself
// needs are plain GETs and are always allowed.
//
// RUN IDENTITY + VALIDATOR CONSISTENCY (follow-up 2, Rowan
// 6389323854): every runPreflight() run carries an identity — a
// monotonically increasing run sequence bound to the ownership epoch
// captured at run start. invalidatePreflight(), a newer run,
// ownership loss, or lifecycle close advances the sequence (and
// ownership loss/release advances the epoch), so a stale run's
// completion is checked after every await and before publishing
// results or enabling writes: it returns preflight_superseded and
// touches NO gate state. One valid STRONG ETag — C4's — must be
// observed consistently across C4, both C5 HEADs, and the C6
// conditional; comparing the HEADs only to each other is not
// sufficient. A body the probe could not read (bodyBytes null) is an
// UNREADABLE body and fails its row; it is never "no body".
//
// LIFECYCLE ADMISSION vs DRAIN (follow-up 3, Rowan 6389516633):
// follow-up 2 made lifecycle close invalidate older preflight
// COMPLETIONS, but the drain refinement left the common write gate
// open while draining so in-flight bookkeeping could settle — and
// runPreflight() had no closing/closed check, so a FRESH preflight
// begun after closure succeeded and re-enabled writes on a closed
// instance (Rowan's reproduction: ok:true, writesEnabled:true,
// closed:true). Closure is now TERMINAL and admission is separated
// from draining:
//   - The boundary has two tiers. assertAdmission() (assertMutation
//     delegates to it) guards every NEW-work entry point — guarded
//     Shelf calls, position reports, syncs, settings/quota models,
//     createPlayback, and runPreflight itself: it requires the
//     lifecycle phase to be "open" AND the write gate open.
//     assertStorageMutation() guards STORAGE writes (the bookkeeping
//     tier): while open it is the same check; while "closing" it
//     admits a write ONLY under the drain permit below; once
//     terminal it always refuses.
//   - At close-start the phase becomes "closing", the write gate
//     closes IMMEDIATELY for new work, and every in-flight preflight
//     is superseded. The DRAIN PERMIT is not a gate state: it is the
//     boolean that, while closing, owner-tracked operations
//     (owner.inflightCount — the runTracked set), in-flight Shelf
//     dispatches, or storage writes that began before close-start
//     are still unsettled. A bookkeeping write is admitted only
//     while that permit is non-empty, i.e. only as part of an
//     operation admitted before close-start settling under the
//     retained ownership lease (the epoch is still re-checked at
//     commit time, so an ownership loss mid-drain still refuses).
//   - The drain waits for the permit to empty (plus a settle tick).
//     If it cannot complete inside the bound, the phase becomes
//     "drain_failed" and that state is SURFACED (close result +
//     shelfLifecycleState) — never reported as successful closure.
//     On success the phase becomes "closed". Both are terminal:
//     no preflight, playback, report, or session work is ever
//     admitted again on this instance; reopening requires a NEWLY
//     CONSTRUCTED instance and a fresh preflight. An ownership loss
//     also makes the instance terminal (its background work is
//     already stopped and its clock closed): reacquiring ownership
//     does not revive it.
//
// EXISTING-PLAYER LIFECYCLE BINDING (follow-up 4, Rowan
// 6390001977): follow-up 3 guarded player CONSTRUCTION and every
// bookkeeping write, but a player created while open kept a live
// media element — after closeShelfLifecycle(), its play() invoked
// media.play() first and met the lifecycle_closed refusal only at
// the guarded Shelf callback, leaving media playing on a closed
// lifecycle (Rowan's reproduction: plays:1, mediaPaused:false,
// playerState:"playing"). Playback surfaces are now bound to the
// lifecycle itself:
//   - createPlayback registers every player it constructs and wires
//     the player's admissionGuard to boundary.assertAdmission():
//     play() and select() consult it BEFORE the media element is
//     touched or a selection accepted, and again after their awaits.
//   - At close-start (and on ownership loss), every registered
//     player is invalidated: pending fetches abort, pending
//     metadata/play continuations are refused at their rechecks,
//     and active media is stopped and detached immediately.
//   - A player that was PLAYING at close-start leaves a settle
//     snapshot; during the drain the composition settles exactly
//     that already-admitted playback's final bookkeeping — the
//     Shelf pause plus a final pause position report — under the
//     drain permit (owner-tracked, reported through the bookkeeping
//     tier, never the admission tier). No new playback admission is
//     reopened to do it; outcomes are recorded on
//     shelfLifecycleState().playerSettlements.
//
// BOUNDED SHUTDOWN SETTLEMENT (follow-up 5, Rowan 6390233573):
// follow-up 4 awaited each settlement — with the reporter's default
// flush:true, i.e. through the remote position read/POST/ack —
// BEFORE the bounded drain loop started, so a response that never
// settled hung closeShelfLifecycle() (and the runnable's release
// path behind it) forever, even though the final pause was already
// durable locally and merely pending. The settlement is now a
// bounded local settlement with an optional fenced dispatch:
//   - Settlements START as owner-tracked operations at close-start;
//     the drain loop never awaits one inline. ONE deadline
//     (SETTLE_DEADLINE_MS) bounds each settlement end to end — the
//     tracked operation resolves by the deadline even if the
//     underlying work dangles, so close and ownership release stay
//     bounded inside the drain loop's existing envelope.
//   - Stage 1 is LOCAL ONLY: the Shelf pause plus report(flush:
//     false) — the local journal commit. A committed pause is
//     DURABLE without cloud acknowledgment; the settlement records
//     an explicit PENDING-SYNC readout (persisted per-event state:
//     the pause's stable eventId, pending ids/count, last
//     acknowledged id) for next-launch retry.
//   - Stage 2 is an OPTIONAL dispatch (reporter.flushPending),
//     attempted only if the deadline has not fired, and fenced: a
//     per-settlement fence is set the moment the deadline fires;
//     the body checks it after every await and never starts a
//     dispatch, a readout mutation, or a further stage past it.
//     A dispatch already in flight past the deadline applies its
//     receipts through the gated storage, whose call-start tier
//     check refuses once the lifecycle is terminal — and whose
//     at-commit guard additionally carries a CLOSE GENERATION
//     (below), so a write that started before the terminal flip
//     still refuses at commit time after it. A late completion
//     therefore mutates nothing and acknowledges nothing.
//   - If the body outlives its deadline, the outcome's durable /
//     pending accounting is read back from the PERSISTED journal
//     (bounded by SETTLE_READOUT_BUDGET_MS) — never fabricated; if
//     even that read cannot complete, the accounting is recorded
//     as unavailable rather than guessed.
//   - "drained" now additionally requires every settlement's LOCAL
//     commit accounted durable. A settlement whose local commit
//     could not be accounted makes the close drain_failed, with
//     the outstanding per-settlement stage/counts in drainError —
//     surfaced, never hung on, never reported as success. A
//     settlement that is locally durable with only its optional
//     dispatch outstanding closes CLEAN ("closed") with the
//     pending-sync readout standing: shutdown does not depend on
//     a successful upload.
//   - The close generation: boundary.captureEpoch() returns the
//     ownership epoch bound to a generation counter that advances
//     exactly when the lifecycle reaches a terminal phase (the
//     close flip, or an ownership loss). The gated adapter's
//     at-commit guard verifies both, fencing storage writes that
//     straddle the terminal boundary.
//
// SETTLEMENT IDENTITY (follow-up 7, Rowan 6390665781): follow-up
// 6's deadline fallback attributed the settlement by exclusion
// against a baseline taken from the reporter's persisted-state
// mirror — but the mirror is not necessarily the journal at
// close-start: a report commits locally BEFORE waiting on its
// position read/upload, and its mirror refresh comes later, so a
// committed earlier pause can be ABSENT from the baseline and
// "exactly one matching pause outside the baseline" still proves
// nothing about this settlement. Baseline/payload inference is
// REMOVED as proof of a settlement's commit. The only admissible
// identity evidence is operation-specific: the event the
// settlement body's own report() returns, or the exact event id
// the reporter's commit notification (onCommit) captures at the
// moment this settlement's local commit resolves — before any
// optional readout/network await can obscure it. If that identity
// is unavailable at the deadline, the accounting is unproven
// (unavailable_at_deadline) and the close surfaces drain_failed;
// the journal may still truthfully list other pending records,
// but none may be credited as this settlement. Acknowledgment
// stays tied to the exact event's persisted receipt. The capture
// is held OUTSIDE the outcome record and read only while the
// deadline path finishes it, so a commit callback/result that
// resolves late cannot retroactively upgrade a finished timeout
// outcome.
//
// SHELF LIFECYCLE CONTAINMENT (follow-up correction 3, R1): the
// frozen bridge's timers and its session dispatch run over seams the
// composition owns. (a) The bridge's injected clock is ALWAYS the
// candidate's lifecycle clock (lifecycle.mjs): close() cancels every
// bridge timer and makes later scheduling inert, so no new flush or
// session-end can start after a controlled release or an ownership
// loss (registered on owner.onLost). (b) The bridge's injected fetch
// is fenced: each dispatch asserts the mutation boundary (owner held
// AND gate open) at dispatch time; a refusal is a diagnosable
// shelf_dispatch_refused, recorded on shelfLifecycleState(), and the
// bridge treats it as a failed send (the session record stays
// queued — a refused write is never made to look successful).
// (c) closeShelfLifecycle() closes the clock, stops the reporter's
// checkpoints, and DRAINS bridge work the candidate can observe
// (in-flight dispatches and gated-storage writes) before the owner
// is released; since follow-up 3 that drain runs under the
// admission/drain separation above (the common write gate is NOT
// left open — only the scoped drain permit admits bookkeeping).
// (d) F12 EXCEPTION (follow-up 2, Julie's explicit
// decision Oct 24 2026 on Rowan's recommendation): a bridge
// operation already in flight at the moment of an UNCONTROLLED
// ownership loss rejects inside the bridge's fire-and-forget call
// sites; the bridge — amended ONLY to observe those rejections —
// records the refusal and reports it through the onAsyncRefusal
// observer this composition supplies, exposed as
// shelfLifecycleState().lastAsyncRefusal. The claim is therefore no
// longer "bridge byte-identical to the frozen v1 bridge": it is
// "frozen except the rejection-sink amendment, replay-proven" (see
// manifest.json for the bounded exception statement and both bridge
// identities). Nothing else about the bridge changed.
//
// Token lives in memory only and is never persisted. No mutation
// screens, no EPUB/import, no settings edits, no generation surface:
// funnel mutation methods and surfaces.updateSettings are deliberately
// NOT exposed on the returned object.
import { createAssembledClient } from "./vendor/client/assembled-client-ui1.js";
import { createHttpTransport } from "./vendor/client/http-transport.js";
import { PRODUCTION_BASE_URL, V2_SCOPE, V2_INSTANCE, CANDIDATE_BUILD_MARKER, PRODUCTION_BASE_HOST, SETTLE_DEADLINE_MS, SETTLE_READOUT_BUDGET_MS, STATE_KEY } from "./constants-gen1.js";
import { resolveDeviceIdentity, startNewEpochAfterHumanDecision, persistMintedIdentity } from "./device-identity.js";
import { PositionReporter } from "./position-reporter.js";
import { createPlayer } from "./player.js";
import { buildDiagnosticsModel } from "./diagnostics.js";
import { createAudioTransport } from "./audio-transport.js";
import { createOwnershipGatedStorage, createOwnershipGatedShellStorage } from "./storage-adapter.js";
import { createLifecycleClock } from "./lifecycle.js";

const realDelay = (ms) => new Promise(r => setTimeout(r, ms));
// Deadline race (follow-up 5): resolves { timedOut:true } if the
// promise has not settled within ms; the promise's own handlers stay
// attached either way, so a dangling promise can never surface as an
// unhandled rejection when it eventually settles or refuses.
const raceDeadline = (p, ms) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve({ timedOut: true }), ms);
  Promise.resolve(p).then(
    (value) => { clearTimeout(timer); resolve({ timedOut: false, value }); },
    (error) => { clearTimeout(timer); resolve({ timedOut: false, error }); });
});

export async function createCandidate({ token, storage, shellStorage, owner, fetchFn, shelf = {}, idGen, baseUrl, probeBinding = null } = {}) {
  if (!token) { const e=new Error("access_token_required"); e.code="access_token_required"; throw e; }
  // Owner is REQUIRED — composing without one refuses before anything
  // is read or written.
  if (!owner || typeof owner.assertOwner !== "function" || typeof owner.captureEpoch !== "function" || typeof owner.assertEpoch !== "function") {
    const e=new Error("owner_required"); e.code="owner_required"; throw e;
  }
  if (!storage || !shellStorage) { const e=new Error("storage_required"); e.code="storage_required"; throw e; }
  const BASE_URL = baseUrl ?? PRODUCTION_BASE_URL;
  const BASE_HOST = (() => { try { return new URL(BASE_URL).host; } catch { return PRODUCTION_BASE_HOST; } })();

  // ---- Table C write-enable gate state.
  // accessCheck: the single-request settings read (C2's instrument),
  // tracked separately — passing it is necessary but NOT sufficient.
  // preflight: the full Table C orchestrator's state, with per-step
  // outcomes. writesEnabled opens ONLY on a full preflight pass.
  let writesEnabled = false;
  let accessCheck = { status: "pending", code: null };
  let preflight = { status: "pending", step: null, code: null, steps: {} };
  // Preflight run identity (follow-up 2): advanced by every new run,
  // every invalidation, ownership loss, and lifecycle close. A run
  // publishes results or enables writes only while its captured
  // identity is still the current one.
  let preflightRunSeq = 0;
  // Lifecycle admission/drain state (follow-up 3; see header):
  // phase "open" admits new work; "closing" refuses new work at
  // close-start while the drain permit settles already-admitted
  // bookkeeping; "closed" / "drain_failed" are terminal.
  let lifecyclePhase = "open";
  let lifecycleDrainError = null;
  let closePromise = null;
  // Close generation (follow-up 5): bound into every epoch token the
  // boundary hands the gated storage adapter. It advances exactly
  // when the lifecycle reaches a terminal phase (the close flip to
  // "closed"/"drain_failed", or an ownership loss), so a storage
  // write whose call started before the flip but whose backing
  // commit lands after it refuses at the adapter's at-commit guard
  // instead of mutating a terminal instance.
  let closeGen = 0;
  const lifecycleRefusal = () => {
    const code = lifecyclePhase === "drain_failed" ? "lifecycle_drain_failed" : "lifecycle_closed";
    const e = new Error(code); e.code = code; return e;
  };
  const boundary = {
    assertOwnerTier() { owner.assertOwner(); },
    // ADMISSION tier — every NEW-work entry point. Requires the
    // lifecycle open and the Table C write gate open.
    assertAdmission() {
      owner.assertOwner();
      if (lifecyclePhase !== "open") throw lifecycleRefusal();
      if (!writesEnabled) { const e=new Error("writes_disabled_until_preflight"); e.code="writes_disabled_until_preflight"; throw e; }
    },
    assertMutation() { return boundary.assertAdmission(); },
    // Lifecycle-only admission: for CONSTRUCTION of new work
    // surfaces (createPlayback) — construction itself writes
    // nothing and legitimately precedes the preflight in the
    // runnable flow, but a closing/closed instance constructs
    // nothing new, ever. Every write the constructed surface later
    // attempts asserts full admission separately.
    assertLifecycleOpen() {
      owner.assertOwner();
      if (lifecyclePhase !== "open") throw lifecycleRefusal();
    },
    // BOOKKEEPING tier — storage writes (see storage-adapter).
    // While open, identical to admission. While closing, a write is
    // admitted ONLY under the drain permit: owner-tracked in-flight
    // operations, in-flight Shelf dispatches, or storage writes that
    // began before close-start are still unsettled (the permit is
    // evaluated at call time; the ownership epoch is separately
    // re-checked at commit time by the gated adapter's guard).
    // Once terminal, no write is admitted, ever.
    assertStorageMutation() {
      owner.assertOwner();
      if (lifecyclePhase === "open") {
        if (!writesEnabled) { const e=new Error("writes_disabled_until_preflight"); e.code="writes_disabled_until_preflight"; throw e; }
        return;
      }
      if (lifecyclePhase === "closing") {
        const tracked = typeof owner.inflightCount === "number" ? owner.inflightCount : 0;
        if (tracked > 0 || dispatch.inflight > 0 || writesInFlight > 0) return;
        const e = new Error("lifecycle_drain_bookkeeping_not_admitted");
        e.code = "lifecycle_drain_bookkeeping_not_admitted"; throw e;
      }
      throw lifecycleRefusal();
    },
    // The token is the ownership epoch bound to the close
    // generation (follow-up 5). It is opaque to the gated storage
    // adapter, which captures it at write start and re-asserts it
    // at commit time; both halves must still hold at commit.
    captureEpoch() { return owner.captureEpoch() + ":" + closeGen; },
    assertEpoch(epoch) {
      const parts = String(epoch).split(":");
      owner.assertEpoch(Number(parts[0]));
      if (parts.length !== 2 || Number(parts[1]) !== closeGen) {
        const e = new Error("lifecycle_closed"); e.code = "lifecycle_closed"; throw e;
      }
    },
  };
  const writeGateState = () => ({ writesEnabled,
    accessCheck: { ...accessCheck },
    preflight: { ...preflight, steps: { ...preflight.steps } } });

  // ---- Shelf lifecycle containment (correction 3): the bridge's
  // clock is always the candidate lifecycle clock, and its fetch is
  // always the epoch/gate-fenced dispatch. In-flight counters let
  // closeShelfLifecycle() drain observable bridge work.
  const lifecycleClock = createLifecycleClock(shelf.clock);
  const dispatch = { inflight: 0, lastRefusal: null };
  // F12-exception diagnostic (follow-up 2): refusals observed at the
  // bridge's fire-and-forget call sites, recorded via the
  // onAsyncRefusal observer the composition supplies to the bridge.
  let bridgeAsyncRefusal = null;
  const onAsyncRefusal = (rec) => { bridgeAsyncRefusal = { ...rec }; };
  let writesInFlight = 0;
  let lifecycleDrained = null;
  const rawShelfFetch = shelf.fetchFn ?? ((...args) => globalThis.fetch(...args));
  const fencedShelfFetch = async (...args) => {
    // Dispatch is bookkeeping of an already-admitted flush (follow-up
    // 3): it asserts the storage/bookkeeping tier, so a flush admitted
    // before close-start can still dispatch during the drain, while a
    // dispatch with no admitted operation behind it refuses.
    try { boundary.assertStorageMutation(); }
    catch (e) {
      dispatch.lastRefusal = { code: "shelf_dispatch_refused", cause: e?.code ?? "boundary_refused" };
      const err = new Error("shelf_dispatch_refused"); err.code = "shelf_dispatch_refused"; err.cause = e?.code ?? null;
      throw err;
    }
    dispatch.inflight++;
    try { return await rawShelfFetch(...args); }
    finally { dispatch.inflight--; }
  };
  const shelfForClient = { ...shelf, fetchFn: fencedShelfFetch, clock: lifecycleClock, onAsyncRefusal };
  // Existing-player lifecycle binding (follow-up 4): every player
  // createPlayback constructs is registered here; close-start and
  // ownership loss invalidate them all (player.mjs), and the final
  // bookkeeping of players that were playing settles during the
  // drain through the BOOKKEEPING tier under an owner-tracked
  // operation (the drain permit) — recorded here for diagnosis.
  const livePlayers = new Set();
  const playerSettlements = [];
  const bookkeepingGate = { assertMutation: () => boundary.assertStorageMutation() };
  function invalidateLivePlayers(code) {
    const snapshots = [];
    for (const p of livePlayers) {
      let snap = null;
      try { snap = p.invalidateTerminal(code); } catch {}
      if (snap?.started) snapshots.push(snap);
    }
    return snapshots;
  }
  const shelfLifecycleState = () => ({ closed: lifecycleClock.closed,
    phase: lifecyclePhase,
    drainError: lifecycleDrainError ? { ...lifecycleDrainError } : null,
    pendingTimers: lifecycleClock.pendingCount(),
    inflightDispatches: dispatch.inflight, inflightWrites: writesInFlight,
    lastRefusal: dispatch.lastRefusal ? { ...dispatch.lastRefusal } : null,
    lastAsyncRefusal: bridgeAsyncRefusal ? { ...bridgeAsyncRefusal } : null,
    playerSettlements: playerSettlements.map(s => ({ ...s })),
    // Aggregate pending-sync readout (follow-up 5): everything the
    // settlements left unacknowledged, under stable event ids, for
    // next-launch retry. Derived only from the settlements'
    // persisted per-event readouts — never from aggregate guesses.
    pendingSync: (() => { const ids = []; let count = 0;
      for (const s of playerSettlements) if (s.pendingSync) {
        count += s.pendingSync.pendingCount ?? 0;
        ids.push(...(s.pendingSync.pendingEventIds ?? []));
      }
      return { pendingCount: count, pendingEventIds: ids }; })(),
    drained: lifecycleDrained });

  // ---- Identity, under the boundary: the shell slot writes only
  // through the owner-gated shell storage; the store record is only
  // READ here (raw storage get). F-1 correction (Approach A): a
  // fresh identity resolves UNPERSISTED (persisted:false) — the
  // slot is written by the tracked storage wrapper below, at the
  // first durable store commit, through this same gated shell.
  const gatedShell = createOwnershipGatedShellStorage({ shellStorage, boundary, tier: "owner" });
  const identity = await resolveDeviceIdentity({ shellStorage: gatedShell, storeStorage: storage, idGen });
  if (identity.status === "stop_and_report") {
    return { stopped:true, code:identity.code, detail:identity.detail, evidence:identity.evidence, writeGateState,
      diagnostics: () => buildDiagnosticsModel({ buildMarker:CANDIDATE_BUILD_MARKER, baseHost:BASE_HOST, scope:V2_SCOPE, instance:V2_INSTANCE, lastErrorCode:identity.code }) };
  }
  const deviceId = identity.deviceId;
  // F-1 correction (Approach A): a fresh identity stays pending —
  // held in memory only — until the first durable store commit
  // persists its shell slot (trackedStorage.set below). A session
  // that never commits abandons it without any durable residue.
  let pendingIdentity = identity.status === "fresh" && identity.persisted === false ? identity.deviceId : null;
  const transport = createHttpTransport({ baseUrl: BASE_URL, token, deviceId, scope: V2_SCOPE, instance: V2_INSTANCE, fetchFn });
  const audioTransport = createAudioTransport({ baseUrl: BASE_URL, token, scope: V2_SCOPE, instance: V2_INSTANCE, fetchFn });
  // The ONE gated storage every vendored mutation funnels through:
  // store cache/journal/outbox, funnel, surfaces closures, Shelf
  // bridge outbox + its timers/flushes. The tracked wrapper counts
  // in-flight writes so lifecycle drain can observe bridge work the
  // bridge itself does not expose.
  const gatedStorage = createOwnershipGatedStorage({ storage, boundary });
  const trackedStorage = {
    kind: gatedStorage.kind, supportsCommitGuard: true,
    get backing() { return gatedStorage.backing; },
    setDelay: gatedStorage.setDelay, setFailureOnce: gatedStorage.setFailureOnce,
    get: (k) => gatedStorage.get(k),
    set: async (k, v, g) => { writesInFlight++; try {
      // F-1 correction (Approach A): the FIRST durable store commit
      // persists the pending identity's shell slot — through the
      // owner-gated shell storage, immediately BEFORE the store's
      // own set is delegated. If the slot write refuses (a
      // non-holding owner), the error propagates and the store set
      // never proceeds on an unpersisted identity: the commit fails
      // closed and the identity stays pending. Once the slot is
      // durable the identity is no longer pending, whether or not
      // the paired store set then succeeds — a failed/interrupted
      // pair leaves slot-present + record-absent, which the next
      // launch meets with the unchanged conservative stop (the
      // disclosed residual window; no silent rebinding).
      if (k === STATE_KEY && pendingIdentity !== null) {
        persistMintedIdentity({ shellStorage: gatedShell, deviceId: pendingIdentity });
        pendingIdentity = null;
      }
      return await gatedStorage.set(k, v, g);
    } finally { writesInFlight--; } },
    delete: async (k, g) => { writesInFlight++; try { return await gatedStorage.delete(k, g); } finally { writesInFlight--; } },
  };
  const client = createAssembledClient({ deviceId, storage: trackedStorage, transport, shelf: shelfForClient });
  // The reporter's checkpoint timer also runs on the lifecycle clock,
  // so closing the lifecycle stops position checkpoints too.
  const reporter = new PositionReporter({ store: client.store, surfaces: client.surfaces, gate: boundary, timers: lifecycleClock });

  // Ownership loss (harness-simulated or a real lock loss): stop all
  // candidate background work immediately — bridge timers cancelled
  // by the clock close, reporter checkpoints stopped. A bridge
  // operation already in flight is the documented residual.
  if (typeof owner.onLost === "function") {
    owner.onLost(() => {
      // Existing players are invalidated FIRST (follow-up 4): their
      // media stops and detaches synchronously, so nothing keeps
      // playing — or starts — on an instance that just lost its
      // lease. No settlement is attempted: ownership is gone and
      // the epoch check would refuse the writes; the instance is
      // terminal (below) and the records stay preserved.
      invalidateLivePlayers("lifecycle_closed");
      // Terminal fence (follow-up 5): the close generation advances
      // with the loss, so any storage write still in flight from
      // before the loss refuses at its at-commit guard as well as
      // on the advanced ownership epoch.
      closeGen++;
      lifecycleClock.close(); reporter.stopCheckpoints(); invalidatePreflight("preflight_invalidated_ownership_lost");
      // Follow-up 3: an ownership loss is terminal for THIS instance
      // (background work is stopped and the clock is closed), even if
      // closeShelfLifecycle() was never called. Reacquiring ownership
      // does not revive the instance; reopening takes a newly
      // constructed instance and a fresh preflight.
      if (lifecyclePhase === "open") lifecyclePhase = "closed";
    });
  }

  // Controlled lifecycle close (follow-up 3 admission/drain split):
  // at CLOSE-START, admission closes — the phase becomes "closing",
  // the write gate closes immediately for new work, in-flight
  // preflights are superseded, timers are cancelled (no new bridge
  // work can start), and checkpoints stop. The drain then waits for
  // the bookkeeping permit to empty: owner-tracked in-flight
  // operations, in-flight session dispatches, and gated-storage
  // writes settle under the retained ownership lease, admitted by
  // boundary.assertStorageMutation() ONLY while that permit is
  // non-empty. The ordinary write gate is never reopened (nor left
  // open) to preserve cleanup writes. Returns whether the drain
  // completed; a drain that cannot complete is surfaced as
  // phase "drain_failed" with drainError set, NOT as a successful
  // closure. The owner is released by the caller afterwards.
  // Closing is idempotent and terminal: once closing/closed, this
  // instance never admits work again.
  // Pending-sync readout from PERSISTED journal state (follow-up
  // 5, identity corrected follow-ups 6+7): the settlement's own
  // pause event is identified by its EXACT eventId — the identity
  // the settlement body received from its own commit, or the
  // identity its commit notification captured at the moment the
  // commit resolved (see startPlayerSettlement). Kind + occurrence
  // + offset are payload, NOT identity: an older pause at the same
  // occurrence and offset must never be read as this settlement's
  // event (Rowan 6390460048: the first-match lookup attributed an
  // old acknowledged pause to a settlement whose commit never
  // happened, producing a false successful close; Rowan
  // 6390665781: the follow-up-6 baseline exclusion still inferred
  // the commit from journal contents filtered against a possibly
  // stale reporter mirror — inference is now removed entirely).
  // With no proven identity (eventId null) the readout reports
  // this settlement's event as absent — eventId null,
  // eventAcknowledged false — while the aggregate pending state
  // (pending ids, last acknowledged) is still reported honestly
  // from per-event receipt state, never from aggregate arithmetic.
  function journalPendingSync(js, eventId) {
    const events = Array.isArray(js?.events) ? js.events : [];
    const isPending = (e) => (e.receiptSeq === null || e.receiptSeq === undefined) && !e.rejected;
    const pending = events.filter(isPending);
    const mine = eventId ? events.find(e => e.eventId === eventId) ?? null : null;
    const acked = events.filter(e => !isPending(e) && !e.rejected);
    return { eventId: mine?.eventId ?? null,
      eventAcknowledged: mine ? !isPending(mine) && !mine.rejected : false,
      pendingCount: pending.length,
      pendingEventIds: pending.map(e => e.eventId),
      lastAcknowledgedEventId: acked.length ? acked[acked.length - 1].eventId : null };
  }

  // Bounded settlement of one already-admitted playback (follow-up
  // 5; the follow-up-4 settlement, restructured). Returns a promise
  // for the outcome record; the promise ALWAYS resolves — by the
  // settlement deadline at the latest — because the tracked
  // operation races the settlement body against SETTLE_DEADLINE_MS.
  // The body may dangle past the deadline (a response that never
  // arrives), but it is fenced: the deadline sets fence.abandoned,
  // the body checks the fence after every await and starts nothing
  // new past it, and any storage write it still attempts meets the
  // terminal tier check and the close-generation at-commit guard.
  // FINALITY (follow-up 8, Rowan 6390957666): the fence check
  // after every await is also what makes the recorded outcome
  // final — the deadline branch's accounting writes happen
  // inside the tracked operation BEFORE it resolves (they are
  // the recording, not a post-recording mutation), and after
  // that resolution the dangling body can only observe the fence
  // and return, so the record the close consumed never changes
  // afterwards. (One post-dispatch await originally lacked its
  // check; the audit and fix are at the dispatch tail below.)
  function startPlayerSettlement(snap) {
    const outcome = { occurrenceId: snap.token.occurrenceId, bookId: snap.token.bookId,
      offsetSec: snap.offsetSec, stage: "local_commit", shelfPaused: false,
      durable: false, eventId: null, dispatch: "not_attempted", pendingSync: null,
      accounting: null, reportCode: null, timedOut: false };
    // Commit identity capture (follow-up 7): the ONLY admissible
    // proof that THIS settlement committed is operation-specific —
    // the exact event id captured at the moment this settlement's
    // own local commit resolves (the reporter's onCommit
    // notification, fired inside its stage-1 report before any
    // refresh/dispatch await), or the event the body's report()
    // itself returns. Journal contents are NEVER evidence for
    // this attempt: the follow-up-6 baseline exclusion trusted
    // the reporter's mirror, which can be stale at close-start,
    // and credited an older committed pause to a settlement whose
    // commit never happened (Rowan 6390665781). The capture lives
    // OUTSIDE the outcome record: only the deadline path reads it,
    // and only while finishing the outcome — a commit resolving
    // after the outcome is finished writes here and nowhere else,
    // so it cannot retroactively upgrade a timeout outcome.
    const commitCapture = { eventId: null };
    const fence = { abandoned: false };
    const body = (async () => {
      // Yield BEFORE any bookkeeping assert: runTracked registers
      // this operation as in-flight only after the callback's
      // synchronous prefix returns, and the drain permit is
      // evaluated at assert time — the settle's own tracked
      // operation is what admits its writes (follow-up 4's note).
      await realDelay(0);
      if (fence.abandoned) return outcome;
      try { rawShelf.playbackPaused(); outcome.shelfPaused = true; } catch {}
      // Stage 1 — LOCAL settlement only: the final pause commits to
      // the journal with NO dispatch (flush:false). Once the commit
      // resolves the pause is durable, whatever the network does.
      const rep = await reporter.report(snap.token.bookId,
        { kind: "pause", occurrenceId: snap.token.occurrenceId, offsetSec: snap.offsetSec, playing: false, final: true },
        { flush: false, gateOverride: bookkeepingGate,
          onCommit: (ev) => { if (ev?.eventId && !commitCapture.eventId) commitCapture.eventId = ev.eventId; } });
      if (fence.abandoned) return outcome;
      outcome.reportCode = rep?.code ?? null;
      if (rep?.durable !== true) return outcome; // stage stays "local_commit"; the close surfaces it
      outcome.durable = true;
      outcome.eventId = rep?.event?.eventId ?? null;
      outcome.accounting = "local_commit";
      const js = await client.store.journalState(snap.token.bookId).catch(() => null);
      if (fence.abandoned) return outcome;
      if (js) outcome.pendingSync = journalPendingSync(js, outcome.eventId);
      // Stage 2 — OPTIONAL dispatch: attempted only inside the
      // deadline; its outcome never re-litigates stage 1's
      // durability, and a failure leaves the readout at pending.
      outcome.stage = "dispatch";
      outcome.dispatch = "attempted";
      const dres = await reporter.flushPending(snap.token.bookId);
      if (fence.abandoned) return outcome;
      outcome.dispatch = dres?.flushed ? "acknowledged" : (dres?.refused ? "refused" : "pending");
      const js2 = await client.store.journalState(snap.token.bookId).catch(() => null);
      // Post-await fence (follow-up 8, Rowan 6390957666): this
      // check was MISSING — a post-dispatch journal read stalling
      // past the deadline let the dangling body write pendingSync
      // and stage "done" into the outcome the deadline branch had
      // already finished and the close had already recorded,
      // breaking the recorded outcome's finality. With the fence
      // rechecked here, EVERY await in this body is now followed
      // by a fence check before any outcome write, so once the
      // deadline branch finishes the outcome, no asynchronous
      // completion can mutate the recorded record.
      if (fence.abandoned) return outcome;
      if (js2) outcome.pendingSync = journalPendingSync(js2, outcome.eventId);
      outcome.stage = "done";
      return outcome;
    })();
    // The body's own late refusal (a fenced write inside a vendored
    // call chain) is contained here: its accounting lives on the
    // outcome record, never as an unhandled rejection.
    body.catch(() => {});
    const tracked = owner.runTracked(async () => {
      const r = await raceDeadline(body, SETTLE_DEADLINE_MS);
      if (r.timedOut) {
        // The deadline fired: fence the body FIRST, then account
        // for this settlement. The only admissible durability
        // evidence is THIS operation's own commit identity
        // (follow-up 7):
        // — if the body already returned its commit, outcome.eventId
        //   IS the exact identity (accounting "local_commit") and
        //   the readout below only reports that event's persisted
        //   receipt state;
        // — else, if the commit notification captured the identity
        //   before the deadline (the commit resolved; a subsequent
        //   refresh/readout await is what stalled), the captured id
        //   is the identity (accounting "commit_identity"):
        //   durability rests on the commit itself, and the readout
        //   reports the exact event's receipt state;
        // — otherwise the commit is UNPROVEN: no journal event —
        //   however well it matches the settlement payload, pending
        //   or acknowledged, present in or absent from any
        //   baseline — may be credited to this settlement. The
        //   accounting is unavailable and the close surfaces the
        //   settlement as not durable (drain_failed), retaining
        //   the stopped terminal state.
        // The persisted journal read below supplies RECEIPT STATE
        // for an already-proven identity, plus the honest
        // aggregate pending readout — never attribution.
        fence.abandoned = true;
        outcome.timedOut = true;
        if (outcome.dispatch === "attempted") outcome.dispatch = "pending";
        const capturedId = outcome.eventId ?? commitCapture.eventId;
        const jr = await raceDeadline(client.store.journalState(snap.token.bookId).catch(() => null),
          SETTLE_READOUT_BUDGET_MS);
        const jrOk = !jr.timedOut && !jr.error && !!jr.value;
        if (capturedId) {
          if (!outcome.eventId) {
            // Proven by this operation's own commit notification:
            // the commit resolved before the deadline; only a
            // later readout/dispatch await stalled. Durability is
            // the commit itself (accounting "commit_identity").
            outcome.eventId = capturedId;
            outcome.durable = true;
            outcome.accounting = "commit_identity";
            if (outcome.stage === "local_commit") outcome.stage = "dispatch";
          }
          if (jrOk) outcome.pendingSync = journalPendingSync(jr.value, outcome.eventId);
        } else {
          // Unproven at the deadline: report the accounting as
          // unavailable; the aggregate pending readout (when the
          // journal could be read) stays honest — it names other
          // records under their OWN ids, never as this settlement's.
          outcome.accounting = "unavailable_at_deadline";
          if (jrOk) outcome.pendingSync = journalPendingSync(jr.value, null);
        }
      }
      return outcome;
    }).catch(e => ({ ...outcome, reportCode: outcome.reportCode ?? e?.code ?? "player_settle_failed" }));
    return tracked;
  }

  async function closeShelfLifecycle() {
    if (closePromise) return closePromise;
    if (lifecyclePhase === "closed") {
      // Already terminal (e.g. an ownership loss closed the
      // instance): report the terminal state; there is nothing a
      // controlled close can still drain.
      return { closed: true, drained: lifecycleDrained ?? false, ...shelfLifecycleState() };
    }
    lifecyclePhase = "closing";
    // Supersede in-flight preflight runs (follow-up 2) and close the
    // gate NOW: a stale completion publishes nothing, and no new
    // work is admitted from this moment.
    preflightRunSeq++;
    writesEnabled = false;
    preflight = { status: "invalidated", step: null, code: "preflight_invalidated_lifecycle_closed", steps: preflight.steps };
    lifecycleClock.close();
    reporter.stopCheckpoints();
    // Existing players are invalidated at close-start (follow-up
    // 4): their media stops and detaches NOW, pending fetch /
    // metadata / play continuations are refused at the player's own
    // rechecks, and a player that was playing leaves a settle
    // snapshot whose final bookkeeping is settled below.
    const playerSettles = invalidateLivePlayers("lifecycle_closed");
    closePromise = (async () => {
      // Terminal settlement of already-admitted playback
      // (follow-ups 4+5): each settlement STARTS here as a bounded
      // owner-tracked operation — the drain below never awaits one
      // inline, so no settlement's storage or network wait can hold
      // the shutdown open. This settles work admitted BEFORE
      // close-start; it admits nothing new — the players are
      // terminal and the write gate is closed. Outcomes (including
      // any refusal) are recorded, never hidden.
      let outcomesRecorded = 0;
      for (const snap of playerSettles) {
        startPlayerSettlement(snap).then(
          (o) => { playerSettlements.push(o); outcomesRecorded++; },
          () => { outcomesRecorded++; });
      }
      const outcomesDone = () => outcomesRecorded >= playerSettles.length;
      const permitEmpty = () => dispatch.inflight === 0 && writesInFlight === 0
        && (typeof owner.inflightCount !== "number" || owner.inflightCount === 0);
      let permitDrained = false;
      for (let round = 0; round < 400 && !permitDrained; round++) {
        if (outcomesDone() && permitEmpty()) {
          await realDelay(0); // let a just-settled step schedule its next write
          permitDrained = outcomesDone() && permitEmpty();
        } else await realDelay(5);
      }
      // "Drained" additionally requires every settlement's LOCAL
      // commit accounted durable (follow-up 5): a settlement whose
      // local commit could not be accounted is a drain failure with
      // its stage/counts surfaced — never a silent success. A
      // settlement that is locally durable with only its optional
      // dispatch outstanding does NOT fail the drain: its
      // pending-sync readout stands and shutdown proceeds.
      const settlementsAccounted = playerSettlements.length === playerSettles.length
        && playerSettlements.every(s => s.durable === true);
      const drained = permitDrained && settlementsAccounted;
      lifecycleDrained = drained;
      if (drained) {
        lifecyclePhase = "closed";
      } else {
        lifecyclePhase = "drain_failed";
        lifecycleDrainError = { code: "lifecycle_drain_incomplete",
          inflightDispatches: dispatch.inflight, inflightWrites: writesInFlight,
          inflightTracked: typeof owner.inflightCount === "number" ? owner.inflightCount : null,
          settlements: playerSettlements.map(s => ({ occurrenceId: s.occurrenceId, stage: s.stage,
            durable: s.durable, dispatch: s.dispatch, timedOut: s.timedOut })) };
      }
      // Terminal fence (follow-up 5): advancing the close
      // generation at the flip makes any storage write still in
      // flight from before it refuse at its at-commit guard.
      closeGen++;
      return { closed: true, drained, ...shelfLifecycleState() };
    })();
    return closePromise;
  }

  // Guarded Shelf bridge: the returned/player-facing API asserts the
  // boundary at entry; the bridge's INTERNAL timers and flushes write
  // through the gated storage above, so they fail closed at commit
  // time even if a timer fires after ownership loss.
  const rawShelf = client.shelfBridge;
  const guardedShelf = {
    playbackStarted: (...a) => { boundary.assertMutation(); return rawShelf.playbackStarted(...a); },
    playbackResumed: (...a) => { boundary.assertMutation(); return rawShelf.playbackResumed(...a); },
    playbackPaused: (...a) => { boundary.assertMutation(); return rawShelf.playbackPaused(...a); },
    playbackStopped: (...a) => { boundary.assertMutation(); return rawShelf.playbackStopped(...a); },
    sessionEnded: async (...a) => { boundary.assertMutation(); return rawShelf.sessionEnded(...a); },
    flush: async (...a) => { boundary.assertMutation(); return owner.runTracked(() => rawShelf.flush(...a)); },
    outbox: () => rawShelf.outbox(),
    pendingCount: () => rawShelf.pendingCount(),
  };

  // The specified single-request access check: exactly one
  // GET /v2/settings, no family synced. It records the access result
  // and returns it — and NEVER opens the write gate (correction 1:
  // it is Table C row C2's instrument, not the preflight).
  async function verifyAccess() {
    try {
      const settings = await audioTransport.rawSettingsGet();
      accessCheck = { status: "passed", code: null };
      return { ok: true, settings };
    } catch (e) {
      accessCheck = { status: "failed", code: e?.code ?? "access_check_failed" };
      return { ok: false, code: accessCheck.code, status: e?.status ?? null };
    }
  }

  // The FULL Table C preflight orchestrator (design 7.3, correction
  // 1). Runs C1–C6 in order against a designated probe binding
  // { cacheKey, format, sizeBytes }; the write gate opens ONLY when
  // every row passes for this device/session/candidate. Any failure
  // leaves (or reverts) the gate closed with the failing step and
  // the observed values recorded. All six rows are reads.
  async function runPreflight(bindingArg) {
    // Admission (follow-up 3): a closing/closed instance admits NO
    // new preflight runs. Closure is terminal — this refusal is the
    // defeat of Rowan's follow-up-2 reproduction (a fresh preflight
    // begun after closeShelfLifecycle() previously succeeded and
    // re-enabled writes on the closed instance). The gate is not
    // touched; the recorded state stays the lifecycle invalidation.
    if (lifecyclePhase !== "open") {
      return { ok: false, code: lifecyclePhase === "drain_failed" ? "lifecycle_drain_failed" : "preflight_lifecycle_closed",
        step: null, lifecyclePhase, steps: {} };
    }
    // Run identity (follow-up 2): starting this run supersedes every
    // older run. The identity binds the run sequence to the
    // ownership epoch captured here; it is re-checked after every
    // await and before publishing any result or enabling writes.
    const runId = ++preflightRunSeq;
    let epoch = null;
    try { epoch = owner.captureEpoch(); } catch { epoch = null; }
    const isCurrent = () => {
      if (runId !== preflightRunSeq) return false;
      // Follow-up 3: a run whose lifecycle has begun closing can
      // never publish or enable writes, even if its identity were
      // otherwise current.
      if (lifecyclePhase !== "open") return false;
      if (epoch !== null) { try { owner.assertEpoch(epoch); } catch { return false; } }
      return true;
    };
    const binding = bindingArg ?? probeBinding;
    writesEnabled = false; // a (re)run reverts the gate until it passes in full
    if (!binding || !/^[a-f0-9]{64}$/.test(binding.cacheKey ?? "")
        || !(binding.format === "mp3" || binding.format === "wav")
        || !(Number(binding.sizeBytes) > 0)) {
      preflight = { status: "failed", step: null, code: "preflight_probe_binding_required", steps: {} };
      return { ok: false, code: preflight.code, step: null, steps: {} };
    }
    const size = Number(binding.sizeBytes);
    const steps = {};
    const superseded = () => ({ ok: false, code: "preflight_superseded", step: null, stale: true, steps });
    const fail = (step, code, detail = {}) => {
      steps[step] = { pass: false, code, ...detail };
      // A stale run publishes NOTHING: no status, no gate change.
      if (!isCurrent()) return superseded();
      preflight = { status: "failed", step, code, steps };
      writesEnabled = false;
      return { ok: false, step, code, steps };
    };
    const pass = (step, detail = {}) => { steps[step] = { pass: true, ...detail }; };
    const thrown = (e) => e?.code ?? e?.message ?? "probe_failed";
    preflight = { status: "running", step: null, code: null, steps };
    // C1 — authenticated wrong-instance refusal (valid token, wrong
    // instance): the instance fence, proven the way Table A cannot.
    try {
      const r = await audioTransport.probe("/v2/settings", { instance: "preflight-wrong-instance" });
      if (!isCurrent()) return superseded();
      if (r.status === 403 && r.json?.error === "production_instance_required") pass("C1", { status: r.status });
      else return fail("C1", "preflight_c1_instance_fence", { status: r.status, error: r.json?.error ?? null });
    } catch (e) { return fail("C1", "preflight_c1_failed", { cause: thrown(e) }); }
    // C2 — the settings read with the correct triple.
    const acc = await verifyAccess();
    if (!isCurrent()) return superseded();
    if (acc.ok) pass("C2", { status: 200 });
    else return fail("C2", acc.code ?? "preflight_c2_failed", { status: acc.status ?? null });
    // C3 — authenticated byte-check of the designated key.
    try {
      const r = await audioTransport.byteCheck(binding.cacheKey);
      if (!isCurrent()) return superseded();
      if (r.status === 200 && r.json?.exists === true) pass("C3", { status: r.status });
      else return fail("C3", "preflight_c3_byte_check", { status: r.status, exists: r.json?.exists ?? null });
    } catch (e) { return fail("C3", "preflight_c3_failed", { cause: thrown(e) }); }
    // C4 — the 1-byte Range probe. Its ETag is THE validator for the
    // whole preflight (follow-up 2, defect 2): present and STRONG,
    // or the run fails here.
    let etag = null;
    try {
      const r = await audioTransport.audioProbe(binding, { headers: { Range: "bytes=0-0" } });
      if (!isCurrent()) return superseded();
      const contentRange = r.header("content-range");
      const c4etag = r.header("etag");
      if (r.status !== 206 || contentRange !== `bytes 0-0/${size}`) {
        return fail("C4", "preflight_c4_range", { status: r.status, contentRange, bodyBytes: r.bodyBytes });
      }
      if (r.bodyBytes === null) return fail("C4", "preflight_c4_body_unreadable", { status: r.status, contentRange });
      if (r.bodyBytes !== 1) return fail("C4", "preflight_c4_range", { status: r.status, contentRange, bodyBytes: r.bodyBytes });
      if (!c4etag || /^W\//i.test(c4etag)) return fail("C4", "preflight_c4_validator", { status: r.status, etag: c4etag });
      etag = c4etag; pass("C4", { status: r.status, contentRange, etag });
    } catch (e) { return fail("C4", "preflight_c4_failed", { cause: thrown(e) }); }
    // C5 — HEAD, plain and with Range: identical metadata, no body,
    // and BOTH ETags equal to C4's strong validator (defect 2:
    // comparing the two HEADs only to each other let a swapped
    // object pass whenever they agreed with each other).
    try {
      const plain = await audioTransport.audioProbe(binding, { method: "HEAD" });
      const ranged = await audioTransport.audioProbe(binding, { method: "HEAD", headers: { Range: "bytes=0-0" } });
      if (!isCurrent()) return superseded();
      const contentLength = plain.header("content-length");
      const headEtag = plain.header("etag");
      const rangedEtag = ranged.header("etag");
      const strong = !!headEtag && !/^W\//i.test(headEtag);
      const identical = String(ranged.header("content-length")) === String(contentLength)
        && rangedEtag === headEtag && ranged.status === 200;
      const validatorMatch = headEtag === etag && rangedEtag === etag;
      // An unreadable body (bodyBytes null) is NOT "no body".
      if (plain.bodyBytes === null || ranged.bodyBytes === null) {
        return fail("C5", "preflight_c5_body_unreadable", { status: plain.status, etag: headEtag, rangedEtag });
      }
      const noBody = plain.bodyBytes === 0 && ranged.bodyBytes === 0;
      if (plain.status === 200 && Number(contentLength) === size && strong && identical && validatorMatch && noBody) {
        pass("C5", { status: plain.status, contentLength: Number(contentLength), etag });
      } else return fail("C5", "preflight_c5_head", { status: plain.status, contentLength, etag: headEtag, rangedEtag, identical, validatorMatch, noBody });
    } catch (e) { return fail("C5", "preflight_c5_failed", { cause: thrown(e) }); }
    // C6 — conditional GET against C4's validator (sent as
    // If-None-Match). A 304 carrying a DIFFERENT validator than
    // C4's is a mismatch, not a pass.
    if (!etag) return fail("C6", "preflight_c6_no_etag", {});
    try {
      const r = await audioTransport.audioProbe(binding, { headers: { "If-None-Match": etag } });
      if (!isCurrent()) return superseded();
      if (r.bodyBytes === null) return fail("C6", "preflight_c6_body_unreadable", { status: r.status });
      const c6etag = r.header("etag");
      if (r.status === 304 && r.bodyBytes === 0 && (c6etag === null || c6etag === etag)) {
        // Diagnostics honesty (follow-up 3, Rowan 6389516633): the
        // recorded step distinguishes the ANCHORED validator (C4's,
        // used for the conditional) from what C6 actually OBSERVED.
        // An absent 304 ETag is recorded as observed ABSENT — never
        // as the anchor, which would imply a missing header was
        // observed equal to it.
        pass("C6", { status: r.status, etag, observedEtag: c6etag, etagObserved: c6etag !== null });
      }
      else return fail("C6", "preflight_c6_conditional", { status: r.status, bodyBytes: r.bodyBytes, etag: c6etag });
    } catch (e) { return fail("C6", "preflight_c6_failed", { cause: thrown(e) }); }
    // Final publication is identity-checked like every other step:
    // a stale success enables NOTHING.
    if (!isCurrent()) return superseded();
    preflight = { status: "passed", step: null, code: null, steps };
    writesEnabled = true;
    return { ok: true, steps };
  }

  // Invalidation (session/candidate change, explicit operator
  // action, ownership loss, lifecycle close): the gate reverts
  // closed until a fresh full preflight passes, AND every in-flight
  // run becomes stale — its completion can no longer publish a
  // result or reopen the gate (follow-up 2, defect 1). The recorded
  // steps stay visible for diagnosis.
  function invalidatePreflight(code = "preflight_invalidated") {
    preflightRunSeq++;
    writesEnabled = false;
    preflight = { status: "invalidated", step: null, code, steps: preflight.steps };
    return writeGateState();
  }

  // ---- UI3 (W-4): byte-confirmation on successful playback start.
  // verifyBindingBytes is idempotent (its persisted per-revision
  // early return costs zero network once a segment is confirmed on
  // this device), but that guard alone cannot stop two initiations
  // that race before the first check settles from EACH issuing the
  // GET — so this map holds the in-flight verify promise per
  // binding identity and concurrent initiations for the same key
  // skip (Amendment A-1 condition 3). The key is
  // bookId:occurrenceId:cacheKey: the player token carries the
  // selection's cacheKey (bindingFor in the shell supplies
  // cacheKey/format/sizeBytes; no binding revision reaches the
  // token), and a re-bind to a different object changes the key,
  // so a stale in-flight entry can never suppress the check a new
  // binding needs. Bound: at most one CONCURRENT app-initiated
  // verification per key; a persisted successful confirmation
  // suppresses all later app requests for that binding on this
  // device. A FAILED check records nothing and may be attempted
  // again on a later successful start. Browser/network-layer
  // retransmissions (e.g. a connection-reset GET re-issued below
  // the app layer) are outside this bound — the app issues one
  // fetch per initiation and contains no retry logic.
  // Independent devices hold independent state, so each device may
  // check once.
  const byteConfirmFlights = new Map();
  function confirmBytesOnPlaying(tok) {
    if (!tok?.bookId || !tok?.occurrenceId) return;
    const flightKey = `${tok.bookId}:${tok.occurrenceId}:${tok.cacheKey ?? ""}`;
    if (byteConfirmFlights.has(flightKey)) return;
    let p;
    try { p = Promise.resolve(client.store.verifyBindingBytes(tok.bookId, tok.occurrenceId)); }
    catch { return; } // a synchronous refusal is swallowed like any failure: playback is unaffected
    byteConfirmFlights.set(flightKey, p);
    const settle = () => { if (byteConfirmFlights.get(flightKey) === p) byteConfirmFlights.delete(flightKey); };
    p.then(settle, settle); // rejection also only deletes: failures record nothing and are never retried here
  }

  return {
    buildMarker: CANDIDATE_BUILD_MARKER, deviceId, identity,
    verifyAccess, runPreflight, invalidatePreflight, writeGateState,
    closeShelfLifecycle, shelfLifecycleState,
    library: {
      // Syncs mutate the local cache: they are NEW work and assert
      // admission (follow-up 3), not merely ownership.
      syncContent: async () => { boundary.assertAdmission(); return owner.runTracked(() => client.store.syncFamilyDrain("content")); },
      syncBindings: async () => { boundary.assertAdmission(); return owner.runTracked(() => client.store.syncFamilyDrain("bindings")); },
      cachedEntity: (f,k) => client.store.cachedEntity(f,k),
      chapterModel: (b,c) => client.projection.chapterModel(b,c),
      surfaceModel: (s,b,c) => client.projection.surfaceModel(s,b,c),
    },
    playerSurfaces: {
      reportPosition: (b,e) => owner.runTracked(() => reporter.report(b,e)),
      positionModel: (b) => client.surfaces.positionModel(b),
      journalState: (b) => client.store.journalState(b),
    },
    // Candidate-owned playback wiring (F1 + B4 + B5): the player is
    // constructed here, bound to the candidate's own gated reporter and
    // guarded Shelf bridge. With no explicit fetchSegment, the binding
    // is resolved (resolveBinding or the selection's own
    // cacheKey/format/sizeBytes) and fetched through the authenticated
    // audio transport with size verification. Media events are wired,
    // the reporter's checkpoint timer runs during playback, and a
    // pagehide target (when supplied) gets the best-effort tail —
    // never treated as ended.
    createPlayback({ fetchSegment, media, urlFactory, readIdFor, resolveBinding, nextSelection, pagehideTarget } = {}) {
      // Constructing playback on a closing/closed instance is
      // refused (follow-up 3): the instance is terminal. While open,
      // construction may precede the preflight (it writes nothing);
      // every write the player attempts (Shelf calls, position
      // reports) asserts full admission at its own entry.
      boundary.assertLifecycleOpen();
      const fetchSeg = fetchSegment ?? (async (tok, { signal } = {}) => {
        const binding = resolveBinding ? await resolveBinding(tok) : { cacheKey: tok.cacheKey, format: tok.format, sizeBytes: tok.sizeBytes };
        return audioTransport.fetchSegment(binding, { signal });
      });
      let playerRef = null;
      const player = createPlayer({
        fetchSegment: fetchSeg, media, urlFactory, readIdFor,
        shelf: guardedShelf,
        // Existing-player lifecycle binding (follow-up 4): the
        // player consults the SAME admission boundary before
        // starting media or accepting a selection — not only when
        // its bookkeeping writes — and this composition invalidates
        // the player at close-start / ownership loss (registry
        // below), so a pre-close player can never play into a
        // closing/closed lifecycle.
        admissionGuard: () => boundary.assertAdmission(),
        reportPosition: (tok, evt) => reporter.report(tok.bookId, evt),
        onPlayingChange: (tok, playing) => {
          if (playing) {
            // UI3 (W-4): this callback fires ONLY on an actual
            // successful start (the player sets state "playing"
            // after the media play() promise resolved for the
            // still-current selection — see player.js), so the
            // byte-confirmation hook belongs exactly here.
            confirmBytesOnPlaying(tok);
            reporter.startCheckpoints(tok.bookId, () => {
              const cur = playerRef?.current;
              if (!cur || cur.selectionSeq !== tok.selectionSeq) return null;
              return { kind: "checkpoint", occurrenceId: cur.occurrenceId, offsetSec: media?.currentTime ?? 0, playing: true };
            });
          } else reporter.stopCheckpoints();
        },
      });
      playerRef = player;
      livePlayers.add(player);
      if (media?.addEventListener) player.attachMediaEvents({ nextSelection });
      if (pagehideTarget?.addEventListener) {
        pagehideTarget.addEventListener("pagehide", () => {
          player.handlePageHide({ actuallyPaused: media?.paused === true });
          const cur = player.current;
          if (cur) void reporter.bestEffortTail(cur.bookId, { kind: "checkpoint", occurrenceId: cur.occurrenceId, offsetSec: media?.currentTime ?? 0, playing: false });
        });
      }
      return player;
    },
    findText: (q,o) => client.findText(q,o),
    settingsRead: {
      settingsModel: async () => { boundary.assertMutation(); return owner.runTracked(() => client.surfaces.settingsModel()); },
      quotaModel: async () => { boundary.assertMutation(); return owner.runTracked(() => client.surfaces.quotaModel()); },
    },
    removals: client.removals,
    shelfBridge: guardedShelf,
    reporter,
    recovery: {
      // Human-decision new epoch, over the same boundary: owner tier
      // asserted in the recovery function AND by the gated shell slot.
      startNewEpoch: ({ humanDecision } = {}) =>
        startNewEpochAfterHumanDecision({ shellStorage: gatedShell, storeStorage: storage, idGen, humanDecision, gate: boundary }),
    },
    diagnostics: async (booksOpened=[]) => {
      const books={}; let jp=0, op=0;
      for (const b of booksOpened) { await reporter.refreshAcknowledged(b); const r=reporter._book(b); const js=await client.store.journalState(b); jp+=js.unacked; books[b]={lastDurable:r.lastDurable,lastAcknowledged:r.lastAcknowledged,canonical:r.canonical,superseded:r.superseded,rejected:r.rejected,pendingCount:js.unacked}; }
      try { op=(await client.store.outboxState()).pending.length; } catch {}
      let shelfPending=0; try { shelfPending=await rawShelf.pendingCount(); } catch {}
      return buildDiagnosticsModel({ buildMarker:CANDIDATE_BUILD_MARKER, baseHost:BASE_HOST, scope:V2_SCOPE, instance:V2_INSTANCE, books, journalStorageFailed:reporter.journalStorageFailed, journalPending:jp, outboxPending:op, shelfPending, lastErrorCode:reporter.lastErrorCode });
    },
  };
}
