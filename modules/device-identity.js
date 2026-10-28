// SAFEGUARD 1 + design 4.3A: deviceId creation, binding, recovery.
// The shell (not the store) generates the id for its dedicated slot.
// Rowan's safeguard 1 OVERRIDES design table row 2: shell slot present
// + store record missing/reset is STOP AND REPORT, never a fresh bind
// of the old identity over a reset store (counters would restart at 0
// and reissue old event ids).
// F-1 CORRECTION (Approach A; proposal Oct 25 2026, build authorized
// by Julie Oct 25 2026): a fresh mint is NOT persisted to the shell
// slot at resolve time. The id stays pending in memory and is
// persisted by the composition (persistMintedIdentity) at the moment
// of the first durable store commit, immediately before the store's
// own set — slot persistence is a CONSEQUENCE of binding, not of
// minting. A session that never commits (failed preflight, gate never
// opens, close before any mutation) leaves nothing durable at all,
// so the ordinary F-1 strand (mint -> zero commits -> close ->
// slot-only state -> stop) is unreachable. The invariant is the
// narrow true one: on a successfully completed first store commit,
// slot and store ID agree; after an unsuccessful/interrupted pair,
// the conservative stop below remains, with no silent rebinding.
import { SHELL_DEVICE_ID_KEY, STATE_KEY, SHELF_KEY } from "./constants.js";
export async function inspectStoreRecord(storeStorage) {
  const rec = await storeStorage.get(STATE_KEY);
  if (!rec) return { present:false, deviceId:null, unackedJournal:0, pendingOutbox:0, journalCounters:{} };
  let unacked=0; for (const j of Object.values(rec.journals??{})) for (const e of j) if (e.receiptSeq===null && !e.rejected) unacked++;
  return { present:true, deviceId: rec.deviceId ?? null,
    unackedJournal: unacked,
    pendingOutbox: (rec.outbox??[]).filter(o=>o.status!=="acked").length,
    journalCounters: rec.journalCounters ?? {} };
}
export async function resolveDeviceIdentity({ shellStorage, storeStorage, idGen }) {
  const gen = idGen ?? (() => globalThis.crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const shellId = shellStorage.getItem(SHELL_DEVICE_ID_KEY);
  const rec = await inspectStoreRecord(storeStorage);
  const shelfRaw = await storeStorage.get(SHELF_KEY);
  const shelfPending = Array.isArray(shelfRaw?.outbox) ? shelfRaw.outbox.length : 0;
  const evidence = { shellSlotPresent: !!shellId, storeRecordPresent: rec.present,
    unackedJournal: rec.unackedJournal, pendingOutbox: rec.pendingOutbox, shelfPendingPreserved: shelfPending };
  if (shellId && rec.present && rec.deviceId === shellId)
    return { status:"normal", deviceId: shellId, persisted: true, evidence };
  if (shellId && rec.present && rec.deviceId !== shellId)
    return { status:"stop_and_report", code:"device_id_unrecoverable", deviceId:null, evidence,
      detail:"Shell slot and store record name different device ids; no new identity is minted over an existing record and the record is not cleared." };
  if (shellId && !rec.present)
    return { status:"stop_and_report", code:"device_id_store_reset_with_shell_identity", deviceId:null, evidence,
      detail:"Shell identity survives but the client-store record is missing/reset. Binding the old identity fresh would restart command/journal counters at 0 and reissue old event ids, so playback reporting stops. A genuinely new installation/epoch requires an explicit human decision that mints a NEW identity; recoverable pending evidence is preserved and counted above." };
  if (!shellId && rec.present)
    return { status:"stop_and_report", code:"device_id_unrecoverable", deviceId:null, evidence,
      detail:"Store record exists but the shell slot is lost. The orphaned record is not cleared silently; its unacked journal entries are enumerated in evidence for a human recovery decision." };
  // Fresh: mint in memory ONLY (F-1 correction, Approach A). The
  // shell slot is deliberately NOT written here; the composition
  // persists it via persistMintedIdentity at the first durable store
  // commit. `persisted:false` states that distinction truthfully.
  const deviceId = gen();
  return { status:"fresh", deviceId, persisted: false, evidence };
}
// Persist a previously minted, still-pending identity into the shell
// slot. Called by the composition's tracked storage wrapper at the
// first durable store commit, BEFORE the store's own set is
// delegated. `shellStorage` is the composition's owner-gated shell
// storage: a non-holding owner refuses inside the setItem, the error
// propagates, and the store set never proceeds on an unpersisted
// identity (the commit fails closed).
export function persistMintedIdentity({ shellStorage, deviceId }) {
  if (!deviceId) { const e = new Error("device_id_required"); e.code = "device_id_required"; throw e; }
  shellStorage.setItem(SHELL_DEVICE_ID_KEY, deviceId);
  return { persisted: true };
}
// Explicit human recovery only: mint a NEW identity for a new epoch.
// Preserves (does not delete) prior evidence counts in the returned record.
// Repair pass (B2): recovery is a mutating path, so when a `gate`
// (ownership boundary) is supplied it is asserted BEFORE any write;
// the composition always supplies one (its gated shell storage also
// refuses the setItem itself when ownership is not held).
export async function startNewEpochAfterHumanDecision({ shellStorage, storeStorage, idGen, humanDecision, gate }) {
  if (humanDecision !== true) { const e=new Error("human_decision_required"); e.code="human_decision_required"; throw e; }
  if (gate) gate.assertOwnerTier();
  const before = await inspectStoreRecord(storeStorage);
  const gen = idGen ?? (() => globalThis.crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const deviceId = gen();
  shellStorage.setItem(SHELL_DEVICE_ID_KEY, deviceId);
  return { status:"new_epoch", deviceId, preservedEvidence:{ unackedJournal: before.unackedJournal, pendingOutbox: before.pendingOutbox, orphanedStoreDeviceId: before.deviceId } };
}
