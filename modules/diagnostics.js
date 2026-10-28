// Design 3.3/3.5 diagnostics model. Three positions, never conflated:
// last DURABLE (storage commit resolved), last ACKNOWLEDGED (coordinator
// receipt), and the current CANONICAL winner from the coordinator view.
export function buildDiagnosticsModel({ buildMarker, baseHost, scope, instance, books = {}, journalStorageFailed=false,
  journalPending=0, outboxPending=0, shelfPending=0, lastErrorCode=null, selection=null, byteCheckCounts=null }) {
  const perBook = {};
  for (const [bookId, b] of Object.entries(books)) {
    perBook[bookId] = {
      lastDurable: b.lastDurable ?? null,       // {at, occurrenceId, offsetSec, eventId}
      lastAcknowledged: b.lastAcknowledged ?? null, // {at, occurrenceId, offsetSec, eventId, receiptSeq, tip}
      canonical: b.canonical ?? null,           // coordinator winner, verbatim
      canonicalDiffersFromDurable: !!(b.canonical && b.lastDurable &&
        (b.canonical.occurrenceId !== b.lastDurable.occurrenceId || b.canonical.offsetSec !== b.lastDurable.offsetSec)),
      canonicalDiffersFromAcknowledged: !!(b.canonical && b.lastAcknowledged &&
        (b.canonical.occurrenceId !== b.lastAcknowledged.occurrenceId || b.canonical.offsetSec !== b.lastAcknowledged.offsetSec)),
      superseded: b.superseded ?? [], rejected: b.rejected ?? [],
      pendingCount: b.pendingCount ?? 0,
    };
  }
  return { buildMarker, baseHost, scope, instance, perBook,
    journalStorageFailed: journalStorageFailed ? "journal_storage_failed" : null,
    journalPending, outboxPending, shelfPending, lastErrorCode, selection, byteCheckCounts };
}
