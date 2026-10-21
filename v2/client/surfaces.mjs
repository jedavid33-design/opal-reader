// Opal Reader v2 — assembled client, Stage 3: position, settings, quota.
//
// Three surfaces, each with exactly ONE truth source, replacing three of
// v1's most divergent areas (inventory F/G/H):
//
// POSITION — v1 kept position in three layers (localStorage writer,
// cloud-resume release, device-local shadow) that could each be "current."
// Here the only truth is the coordinator's fold of the append-only event
// journal (P4). The surface reads positionView and reports new position by
// appending events through the store's journal — it never computes or
// stores a position of its own. Local honesty rides along: events not yet
// acknowledged and events the fold superseded are SHOWN, never hidden.
//
// SETTINGS — v1 uploaded the settings blob from two call sites under
// whole-record LWW, so devices silently overwrote each other. Here there
// is one writer path: a revisioned SetSettings command through the outbox.
// A stale writer gets a surfaced conflict with the current revision —
// never an auto-merge, never a silent win.
//
// QUOTA (F8) — the counter lives in Settings, rendered from the
// coordinator's revisioned money view with its as-of stamps. A failed
// refresh keeps the last view and marks it stale; the surface never
// fabricates zeros and never gates anything on the cached view.

export function createSurfaces({ store, transport }) {
  if (!store || !transport) throw new Error("store and transport required");

  async function positionModel(bookId) {
    const view = await transport.positionView(bookId);
    const journal = await store.journalState(bookId);
    const c = view.canonical;
    return {
      canonical: c,
      asOfReceiptSeq: view.asOfReceiptSeq,
      supersededCount: view.supersededCount,
      journalGaps: view.journalGaps,
      pendingLocal: journal.unacked,
      rejectedLocal: journal.rejected,
      text: c ? `Segment ${c.occurrenceId} at ${c.offsetSec}s${c.playing ? " (playing)" : ""}` : "No position yet",
    };
  }

  async function reportPosition(bookId, evt) {
    const event = await store.notePosition(bookId, evt);
    let tip = 0;
    try { tip = (await transport.positionView(bookId)).asOfReceiptSeq; } catch { /* offline: base 0; the fold reconciles causally */ }
    const res = await store.flushJournal(bookId, tip);
    return { event, ...res };
  }

  async function settingsModel() {
    await store.syncFamily("settings");
    const ent = await store.cachedEntity("settings", "settings");
    return { data: ent ? ent.payload : null, revision: ent ? ent.revision : 0 };
  }

  async function updateSettings(data) {
    const ent = await store.cachedEntity("settings", "settings");
    const commandId = await store.intent("SetSettings", { baseRevision: ent ? ent.revision : 0, data });
    await store.flushOutbox();
    const st = await store.outboxState();
    const o = st.outcomes.find((x) => x.command_id === commandId);
    if (!o) return { applied: false, conflict: false, reason: "no_receipt" };
    if (o.receipt?.reason === "settings_conflict" || o.outcome === "rejected") {
      const now = await settingsModel();
      return { applied: false, conflict: true, reason: o.receipt?.reason ?? o.outcome, currentRevision: now.revision, currentData: now.data };
    }
    const now = await settingsModel();
    return { applied: true, conflict: false, revision: now.revision, data: now.data };
  }

  async function quotaModel() {
    const m = await store.refreshMoney();
    const v = m.view;
    if (!v) return { view: null, stale: true, asOfLedgerSeq: null, asOfSettingsRevision: null, text: "Quota unavailable — no successful check yet" };
    const dollars = (v.spentMicroCents / 100_000_000).toFixed(2);
    return {
      view: v,
      stale: m.stale,
      asOfLedgerSeq: m.asOfLedgerSeq,
      asOfSettingsRevision: m.asOfSettingsRevision,
      text: `${v.attemptsToday}/${v.dailyLimit} generation attempts today · $${dollars} of $${v.monthlyCap} this month${m.stale ? " · STALE — showing the last successful check" : ""}`,
    };
  }

  return { positionModel, reportPosition, settingsModel, updateSettings, quotaModel };
}
