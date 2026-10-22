// Shelf outbox import (P7 rehearsal form; the live import is a P8
// device-inspection step). Moves a v1 outbox (localStorage
// `opalreader.shelfOutbox.v1`) into the v2 bridge's durable record
// (`cs:shelf-bridge:v1`, P6) WITHOUT changing the wire contract:
// ids, attempts, order, and transient failure stamps are preserved
// byte-for-byte, because Shelf's idempotency keys on client_session_id
// — re-minting an id on import could double-report a session, and
// resetting attempts would rewrite the retry history.
//
// Validation is loud: a malformed item throws. An import that silently
// dropped a queued session would lose listening history; an import
// that refuses and names the item loses nothing.
export const V1_OUTBOX_KEY = "opalreader.shelfOutbox.v1";
export const MAX_OUTBOX = 300; // the shipped cap, applied on every save

export function validateV1OutboxItem(item, index) {
  const where = `outbox item ${index}`;
  if (!item || typeof item !== "object") throw new Error(`${where}: not an object`);
  if (typeof item.queueId !== "string" || !item.queueId) {
    throw new Error(`${where}: queueId missing`);
  }
  if (item.clientSessionId !== item.queueId) {
    throw new Error(`${where}: clientSessionId !== queueId (idempotency key would change)`);
  }
  if (typeof item.readId !== "string" || !item.readId) {
    throw new Error(`${where}: readId missing`);
  }
  if (!Number.isFinite(new Date(item.startedAt).getTime())) {
    throw new Error(`${where}: startedAt not a parseable timestamp`);
  }
  if (!Number.isFinite(Number(item.duration_seconds)) || Number(item.duration_seconds) < 0) {
    throw new Error(`${where}: duration_seconds invalid`);
  }
  if (!Number.isInteger(item.attempts) || item.attempts < 0) {
    throw new Error(`${where}: attempts not a non-negative integer`);
  }
}

export function importV1Outbox(items) {
  if (!Array.isArray(items)) throw new Error("v1 outbox is not an array");
  items.forEach(validateV1OutboxItem);
  const kept = items.slice(-MAX_OUTBOX).map((it) => JSON.parse(JSON.stringify(it)));
  return {
    record: { outbox: kept },
    report: {
      received: items.length,
      imported: kept.length,
      droppedByCap: items.length - kept.length,
      preservedAttempts: kept.reduce((n, it) => n + it.attempts, 0),
    },
  };
}
