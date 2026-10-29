// Shared G7 fixtures: a synthetic client-state record in the
// measured watermark-12 posture and the measured seq 13-18 page
// payloads (design §2.2 / §4.1). All content is synthetic filler —
// no book text, no titles from production, no real IDs beyond the
// synthetic device id below.
export const DEVICE_ID = "00000000-1111-4222-8333-444444444444";
export const BOOK_IDS = ["book-fh", "book-b2", "book-b3", "book-b4", "book-b5", "book-b6", "book-b7"];
export const PAGE_SIZES = [667341, 1167017, 1201938, 1383057, 1404946, 1454026]; // seq 13..18 payload chars
export const SEED_TARGET_CHARS = 1871025;

function sizedJson(build, target) {
  let s = JSON.stringify(build(""));
  const diff = target - s.length;
  if (diff < 0) throw new Error(`fixture base ${s.length} exceeds target ${target}`);
  s = JSON.stringify(build("x".repeat(diff)));
  if (s.length !== target) throw new Error(`fixture sized ${s.length} != ${target}`);
  return s;
}

function bookPayload(bookId, enriched) {
  return {
    bookId, revision: 1, title: `Synthetic ${bookId}`, author: "Fixture",
    chapters: [{ chapterId: `${bookId}-ch1`, segments: [{ occurrenceId: `${bookId}-occ-1` }] }],
    pad: "",
    ...(enriched ? { speechTextPresent: true } : {}),
  };
}

// The record exactly as the store serializes it: caches with
// cursors, outbox, journals, bytes, money, drainStatus.
export function seedRecordRaw(targetChars = SEED_TARGET_CHARS) {
  const build = (pad) => {
    const entities = {};
    // FH enriched at production-measured size; the other six hold
    // the remainder of the seed size between them. Entity shape is
    // the store's own: {payload, revision} under floor/tip/cursor.
    entities["content:book-fh"] = { payload: { ...bookPayload("book-fh", true), pad }, revision: 1 };
    BOOK_IDS.slice(1).forEach((id, i) => {
      entities[`content:${id}`] = { payload: { ...bookPayload(id, false), pad: "y".repeat(120000 + i * 977) }, revision: 1 };
    });
    const bindings = {};
    for (let i = 0; i < 1799; i += 1) {
      bindings[`binding:occ-${i}`] = { payload: { occurrenceId: `occ-${i}`, voiceId: "voice-a", audioRef: `audio/k${i}` }, revision: 1 };
    }
    return {
      schemaVersion: 1,
      deviceId: DEVICE_ID,
      commandCounter: 41,
      outbox: [
        { commandId: "cmd-40", type: "confirm_bytes", status: "acked", enqueuedAt: 1, attempts: 1, payload: {} },
        { commandId: "cmd-41", type: "journal_append", status: "pending", enqueuedAt: 2, attempts: 0, payload: {} },
      ],
      journals: { "book-fh": [{ seq: 1, type: "position", at: 1 }, { seq: 2, type: "bookmark", at: 2 }] },
      journalCounters: { "book-fh": 2 },
      caches: {
        content: { floor: 0, tip: 12, cursor: 12, entities, tombstones: {} },
        bindings: { floor: 0, tip: 1799, cursor: 1799, entities: bindings, tombstones: {} },
      },
      bytes: { "audio/k1": { etag: "e1", bytes: 10944, confirmedAt: 3 } },
      money: {},
      drainStatus: {
        content: { family: "content", complete: false, reason: "network_error", cursor: 12, tip: 12, at: 4 },
      },
    };
  };
  // Pad lands inside the FH payload; the binding table is large, so
  // compute the base with an empty pad first, then size the record.
  const probe = JSON.stringify(build(""));
  const diff = targetChars - probe.length;
  if (diff < 0) throw new Error(`seed base ${probe.length} exceeds target ${targetChars}`);
  const raw = JSON.stringify(build("x".repeat(diff)));
  if (raw.length !== targetChars) throw new Error(`seed sized ${raw.length} != ${targetChars}`);
  return raw;
}

export function pageChanges() {
  return BOOK_IDS.slice(1).map((id, i) => {
    const payloadJson = sizedJson((pad) => ({ ...bookPayload(id, true), pad }), PAGE_SIZES[i]);
    return {
      seq: 13 + i,
      entityKey: `content:${id}`,
      family: "content",
      tombstone: false,
      revision: 2,
      payload: JSON.parse(payloadJson),
    };
  });
}

export function shelfRecordRaw(pending = 7) {
  const items = [];
  for (let i = 0; i < pending; i += 1) {
    items.push({ id: `shelf-item-${i}`, kind: "session", status: "pending", attempts: i + 1, createdAt: i });
  }
  // Shape mirrors the frozen bridge's outbox record closely enough
  // for counting; the suite only asserts preservation + counts.
  return JSON.stringify({ version: 1, outbox: items });
}

export const PREFS_RAW = JSON.stringify({ theme: "auto", rate: 1, voice: "voice-a" });
