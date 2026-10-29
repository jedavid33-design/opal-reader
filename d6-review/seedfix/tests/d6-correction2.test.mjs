// D6 CORRECTION 2 suite — the arming sub-step 0 findings (Oct 29,
// 2026): the D6 build's proofs FAILED on live production data because
// its fixtures were shaped neater than the live coordinator. This
// suite's fixtures mirror the LIVE shapes:
//
//   A  Adapter POV resolution: segment/chapter `pov` values are cast
//      NAMES, cast entries are keyed by UUID ids. Unique name -> id;
//      id value -> id; duplicate name -> unresolved (null, the proof
//      names it); a named-but-unresolvable speaker is never silently
//      reassigned; the default-voice fallback fires only when no
//      speaker is named. Name-shaped and id-shaped planes over the
//      same book produce IDENTICAL eligible sets (digest equality).
//   B  Adapter char counts + dispositions on Goal-shaped data:
//      speechChars 0 + real textChars reads textChars; a removed-
//      provider POV named by name dispositions voice_prompt, never
//      eligible; positive speechChars still wins.
//   C  Proof 5 tightening: the POLICY_BLOCK anchor is the blockRootId
//      lineage ROOT (a later record-carrying segment does not steal
//      it); the parked accounting states both sides and names the
//      live-only row (idx 26 shape) with its dispositions while the
//      proof still passes.
//   D  The storage seed: schema evolution over the DEPLOYED 3-column
//      d6_storage_state (rows preserved, idempotent); store seed
//      semantics (first seed / same-values idempotence / different-
//      values provenance); the service halt fence (refused unless
//      GENERATION_HALT === "1"); the entry-level fence through the
//      REAL D6 entry (401 / 403 scope / 403 instance / class internal
//      gate / applied while halted / refused while unhalted with no
//      row written). NOTE (G2): the seed's invocation contract was
//      amended after this suite was written — figureless, operator-
//      fenced, worker-recount (ENRICHMENT-DESIGN §3.2). The two
//      service/entry seed tests below were amended in place to the
//      G2 contract; the full G2 matrix is tests/d6-seed-hardening.
//      NOTE (SEED-FIX): the seed route's admission was amended
//      again — operator credential ALONE (Rowan design pass
//      6509192325): the entry-fence test's no-client-token probe
//      now expects admission, not 401. The full SEED-FIX matrix is
//      tests/d6-seedfix.test.mjs.
//
// Synthetic fixtures only — invented books, cast, and IDs; structural
// shapes mirror the live coordinator's content plane. No book text.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  planeFromCoordinator,
} from "../worker/generation/content-plane-adapter.mjs";
import { buildEligibleSet, dispositionCounts } from "../worker/generation/eligible-set.mjs";
import { runProofs } from "../worker/generation/proofs.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { ensureGenSchema } from "../worker/generation/gen-schema.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import { makeHarness } from "./helpers/do-harness.mjs";
import { makeFakeR2Bucket } from "./helpers/d6-fakes.mjs";
import D6Entry, * as d6Module from "../worker/worker-entry-prod-d6.js";

const D6Prod = d6Module.OpalReaderCoordinatorProd;
const TOK = "prod-client-token-synthetic";
const ORIGIN = "https://jedavid33-design.github.io";

// ---------------------------------------------------------------------------
// Shim coordinator over synthetic LIVE-SHAPED content entities (the
// shape planeFromCoordinator reads in production: a content sync
// snapshot, the bindings table, the parked job's rows).
// ---------------------------------------------------------------------------

function shimCoord(books, boundIds, parked = null) {
  return {
    syncSnapshot({ family }) {
      if (family !== "content") return { error: "unknown_family", family };
      return {
        family, watermark: books.length,
        entities: books.map(b => ({
          entityKey: b.id, bookId: b.id, revision: 1, tombstone: false, data: b.data,
        })),
      };
    },
    _all(sql) {
      if (sql.includes("FROM bindings"))
        return [...boundIds].map(id => ({ occurrence_id: id }));
      if (sql.includes("FROM occurrences"))
        return parked ? parked.rows : [];
      return [];
    },
    _oneOrNull(sql) {
      if (sql.includes("FROM jobs"))
        return parked ? parked.job : null;
      return null;
    },
  };
}

// Live-shaped cast entries: UUID-style ids, names, provider voices.
function castEntry(id, name, provider, voiceId) {
  return { id, name, voice: { provider, voice_id: voiceId } };
}

// ---------------------------------------------------------------------------
// A + B — adapter over live shapes.
// ---------------------------------------------------------------------------

const GOAL_ID = "book-goal-shaped";
const goalData = {
  povs: [
    castEntry("cast-azure-1", "AzureHero", "azure", "azure-voice-1"),
    castEntry("cast-gem-1", "GemNarrator", "gemini", "Zephyr"),
  ],
  defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  chapters: [
    { chapterId: "g-ch-0", index: 0, segments: [
      // Goal shape exactly: speechChars 0, real textChars, pov = NAME
      // of a removed-provider cast member.
      { occurrenceId: "g-azure", pov: "AzureHero", speechChars: 0, textChars: 1200 },
      // Goal shape, live-provider narrator named by name.
      { occurrenceId: "g-gem", pov: "GemNarrator", speechChars: 0, textChars: 800 },
      // Positive speechChars still wins over textChars.
      { occurrenceId: "g-speech", pov: "GemNarrator", speechChars: 500, textChars: 999 },
      // Chapter-level name pov (segment names nobody).
      { occurrenceId: "g-chapterpov", pov: null, speechChars: 0, textChars: 300 },
      // No speaker named anywhere: default voice (provider, voice_id).
      { occurrenceId: "g-default", pov: null, speechChars: 0, textChars: 200 },
    ] },
    { chapterId: "g-ch-1", index: 1, pov: "GemNarrator", segments: [
      { occurrenceId: "g-chpov2", speechChars: 0, textChars: 250 },
    ] },
  ],
};
// The chapter-pov segment sits in ch-0; give ch-0 a chapter pov too so
// g-chapterpov resolves at chapter level, while g-default (in a
// pov-less stretch of the same chapter list) exercises the fallback:
// model it by moving g-default into its own pov-less chapter.
goalData.chapters[0].pov = "GemNarrator";
goalData.chapters.push({ chapterId: "g-ch-2", index: 2, segments: [
  { occurrenceId: "g-default2", pov: null, speechChars: 0, textChars: 150 },
] });
// g-default stays in ch-0 (chapter pov present) — it resolves at
// chapter level; g-default2 (pov-less chapter) hits the default voice.

test("A/B: adapter resolves live-shaped names to cast ids; Goal dispositions", () => {
  const coord = shimCoord([{ id: GOAL_ID, data: goalData }], new Set());
  const plane = planeFromCoordinator(coord, GOAL_ID);
  const seg = id => plane.books[0].chapters.flatMap(c => c.segments)
    .find(s => s.occurrenceId === id);

  assert.equal(seg("g-azure").povKey, "cast-azure-1", "name -> id (removed provider)");
  assert.equal(seg("g-azure").charCount, 1200, "speechChars 0 falls back to textChars");
  assert.equal(seg("g-gem").povKey, "cast-gem-1");
  assert.equal(seg("g-gem").charCount, 800);
  assert.equal(seg("g-speech").charCount, 500, "positive speechChars wins");
  assert.equal(seg("g-chapterpov").povKey, "cast-gem-1", "chapter-level name pov");
  assert.equal(seg("g-chpov2").povKey, "cast-gem-1", "chapter pov on its own chapter");
  assert.equal(seg("g-default").povKey, "cast-gem-1", "chapter pov before default voice");
  assert.equal(seg("g-default2").povKey, "cast-gem-1", "default-voice fallback");

  const counts = dispositionCounts(buildEligibleSet(plane, GOAL_ID));
  assert.equal(counts.voice_prompt, 1, "the removed-provider occurrence is voice_prompt");
  assert.equal(counts.eligible, 6, "everything else eligible — never the reverse");
  const azure = buildEligibleSet(plane, GOAL_ID).entries
    .find(e => e.occurrenceId === "g-azure");
  assert.equal(azure.disposition, "voice_prompt");
});

test("A: name-shaped and id-shaped planes yield IDENTICAL eligible sets", () => {
  // The same book twice: once with pov values as live NAMES, once
  // with pov values as cast IDs (the old fixture shape). Resolution
  // must make the two indistinguishable to the builder.
  const mk = povOf => ({
    povs: [
      castEntry("id-alpha", "Alpha", "gemini", "Zephyr"),
      castEntry("id-beta", "Beta", "gemini", "Puck"),
    ],
    chapters: [{ chapterId: "s-ch-0", index: 0, segments: [
      { occurrenceId: "s-1", pov: povOf("id-alpha", "Alpha"), speechChars: 100, textChars: 100 },
      { occurrenceId: "s-2", pov: povOf("id-beta", "Beta"), speechChars: 100, textChars: 100 },
      { occurrenceId: "s-3", pov: povOf("id-alpha", "Alpha"), speechChars: 100, textChars: 100 },
    ] }],
  });
  const byName = planeFromCoordinator(
    shimCoord([{ id: "book-s", data: mk((id, name) => name) }], new Set()), "book-s");
  const byId = planeFromCoordinator(
    shimCoord([{ id: "book-s", data: mk(id => id) }], new Set()), "book-s");
  const a = buildEligibleSet(byName, "book-s");
  const b = buildEligibleSet(byId, "book-s");
  assert.equal(a.digest, b.digest, "identical entries -> identical digest");
  assert.deepEqual(
    a.entries.map(e => [e.occurrenceId, e.povKey, e.disposition]),
    b.entries.map(e => [e.occurrenceId, e.povKey, e.disposition]));
});

test("A: defaultVoice fallback resolves by (provider, voice_id) when the entity carries it; no cast match -> unresolved", () => {
  // The live content plane carries NO defaultVoice today (the
  // migration transform dropped it — see CORRECTION-2-REPORT §5);
  // this pins the fallback's semantics for the shape the gated
  // backfill / text-plane enrichment will restore: matched back to
  // a cast entry by (provider, voice_id), exactly as the census
  // fixture's chain specifies.
  const data = {
    povs: [
      castEntry("miller-id", "Miller", "gemini", "Algenib"),
      castEntry("sunny-id", "Sunny", "gemini", "Aoede"),
    ],
    defaultVoice: { provider: "gemini", voice_id: "Algenib" },
    chapters: [{ chapterId: "pu-ch-0", index: 0, segments: [
      { occurrenceId: "pu-title", pov: null, speechChars: 25, textChars: 25 },
    ] }],
  };
  const plane = planeFromCoordinator(
    shimCoord([{ id: "book-pu-shaped", data }], new Set()), "book-pu-shaped");
  assert.equal(plane.books[0].chapters[0].segments[0].povKey, "miller-id",
    "the pov-less segment resolves to the default voice's cast entry");

  const noMatch = {
    ...data, defaultVoice: { provider: "gemini", voice_id: "NoSuchVoice" },
  };
  const plane2 = planeFromCoordinator(
    shimCoord([{ id: "book-pu-shaped", data: noMatch }], new Set()), "book-pu-shaped");
  assert.equal(plane2.books[0].chapters[0].segments[0].povKey, null,
    "a default voice matching no cast entry resolves nothing — never a guess");
});

test("A: duplicate cast name is unresolved and NAMED by the POV proof; named-but-unknown never falls through", () => {
  const data = {
    povs: [
      castEntry("dup-1", "Twin", "gemini", "Zephyr"),
      castEntry("dup-2", "Twin", "gemini", "Puck"),
      castEntry("solo-1", "Solo", "gemini", "Kore"),
    ],
    chapters: [{ chapterId: "d-ch-0", index: 0, pov: "Solo", segments: [
      { occurrenceId: "d-ambig", pov: "Twin", speechChars: 100, textChars: 100 },
      { occurrenceId: "d-ghost", pov: "Ghost", speechChars: 100, textChars: 100 },
      { occurrenceId: "d-solo", pov: "Solo", speechChars: 100, textChars: 100 },
    ] }],
  };
  const plane = planeFromCoordinator(
    shimCoord([{ id: "book-dup", data }], new Set()), "book-dup");
  const seg = id => plane.books[0].chapters[0].segments
    .find(s => s.occurrenceId === id);
  assert.equal(seg("d-ambig").povKey, null, "ambiguous name -> unresolved, never a guess");
  assert.equal(seg("d-ghost").povKey, null,
    "a segment naming an unknown speaker is NOT reassigned to the chapter voice");
  assert.equal(seg("d-solo").povKey, "solo-1");

  const census = {
    "book-dup": {
      title: "Dup", occurrenceIds: ["d-ambig", "d-ghost", "d-solo"],
      eligibleCount: 3, povKeys: ["dup-1", "dup-2", "solo-1"],
    },
    ch3: { structuralIds: [], parkedEntries: new Map() },
  };
  const r = runProofs(plane, census);
  assert.equal(r.povResolution.pass, false);
  assert.deepEqual([...r.povResolution.offenders].sort(), ["d-ambig", "d-ghost"],
    "the proof names exactly the unresolved occurrences");
});

// ---------------------------------------------------------------------------
// C — proof 5: lineage-root anchor + two-sided parked accounting.
// ---------------------------------------------------------------------------

function ch3Fixture() {
  const ids = Array.from({ length: 27 }, (_, i) => `ch3-${String(i).padStart(2, "0")}`);
  const root = ids[0], absent = ids[26];
  const segments = ids.map((id, i) => {
    const s = {
      occurrenceId: id, povKey: "fp-cast-1", charCount: 100,
      hasPayload: true, blockHistory: false, policyBlockRecord: false,
      revisionKey: `fp-${id}`,
    };
    if (i === 0) { s.blockRootId = id; s.blockHistory = true; }        // lineage root (self)
    if (i === 1 || i === 2) { s.blockRootId = root; s.blockHistory = true; } // split children
    if (i === 20) { s.policyBlockRecord = true; s.blockHistory = true; }     // the "last wins" trap
    return s;
  });
  const book = {
    bookId: "book-fp-shaped", title: "FP shaped",
    povs: [{ key: "fp-cast-1", id: "fp-cast-1", name: "Narrator",
             provider: "gemini", voiceId: "Zephyr" }],
    chapters: [{ chapterId: "fp-ch-3", chapterIndex: 2, segments }],
  };
  const censusEntries = new Map();
  ids.forEach((id, i) => {
    if (i <= 2) censusEntries.set(id, "parked-ready");
    else if (i <= 25) censusEntries.set(id, "parked-pending");
    // idx 26: absent from the census parked entries
  });
  const liveEntries = new Map(censusEntries);
  liveEntries.set(absent, "parked-pending"); // the live job's extra row
  const census = {
    "book-fp-shaped": {
      title: "FP shaped", occurrenceIds: ids, eligibleCount: 24,
      povKeys: ["fp-cast-1"],
    },
    ch3: { structuralIds: ids, parkedEntries: censusEntries, chapterId: "fp-ch-3" },
  };
  return { ids, root, absent, book, census, liveEntries };
}

test("C: anchor is the lineage ROOT; live-only parked row named, proof passes", () => {
  const { ids, root, absent, book, census, liveEntries } = ch3Fixture();
  const plane = {
    books: [book],
    boundOccurrenceIds: new Set(ids.slice(0, 3)),
    parkedJob: { jobId: "parked-shaped", bookId: "book-fp-shaped",
                 chapterIndex: 2, entries: liveEntries },
  };
  const r = runProofs(plane, census);
  assert.equal(r.ch3Reconciliation.pass, true,
    `offenders: ${JSON.stringify(r.ch3Reconciliation.offenders)}`);
  assert.equal(r.ch3Reconciliation.policyBlockOccurrenceId, root,
    "the root, not the last block-history segment in scan order");
  assert.notEqual(r.ch3Reconciliation.policyBlockOccurrenceId, ids[20]);
  assert.equal(r.ch3Reconciliation.absentOccurrenceId, absent);
  const row26 = r.ch3Reconciliation.rows.find(x => x.occurrenceId === absent);
  assert.equal(row26.censusDisposition, "unbound");
  assert.equal(row26.parkedDisposition, "absent");
  assert.equal(row26.liveParkedDisposition, "parked-pending");
  assert.match(row26.resolution, /live parked job carries this occurrence as parked-pending/);
  const acct = r.ch3Reconciliation.parkedAccounting;
  assert.equal(acct.censusParkedCount, 26);
  assert.equal(acct.liveParkedCount, 27);
  assert.deepEqual(acct.censusOnlyRows, []);
  assert.equal(acct.liveOnlyRows.length, 1);
  assert.equal(acct.liveOnlyRows[0].occurrenceId, absent);
  assert.equal(acct.liveOnlyRows[0].liveDisposition, "parked-pending");
  assert.equal(acct.liveOnlyRows[0].censusDisposition, "absent");
  assert.equal(acct.liveOnlyRows[0].inStructure, true);
  assert.equal(r.pass, true, "the whole battery of five passes on the reconciled shape");
});

test("C: record-carrying fallback names the anchor when a plane has no lineage ids", () => {
  const { ids, root, book, census } = ch3Fixture();
  for (const ch of book.chapters) for (const s of ch.segments) delete s.blockRootId;
  book.chapters[0].segments[0].policyBlockRecord = true; // idx 0 carries the record
  book.chapters[0].segments[20].policyBlockRecord = false;
  book.chapters[0].segments[20].blockHistory = false;
  const plane = {
    books: [book],
    boundOccurrenceIds: new Set(ids.slice(0, 3)),
    parkedJob: { jobId: "parked-shaped", bookId: "book-fp-shaped",
                 chapterIndex: 2, entries: census.ch3.parkedEntries },
  };
  const r = runProofs(plane, census);
  assert.equal(r.ch3Reconciliation.policyBlockOccurrenceId, root);
  assert.equal(r.ch3Reconciliation.pass, true);
});

// ---------------------------------------------------------------------------
// D — the storage seed: schema evolution, store semantics, fences.
// ---------------------------------------------------------------------------

class SqlCursor {
  constructor(rows) { this._rows = rows; }
  one() {
    if (this._rows.length === 0) throw new Error("Expected exactly one result from SQL query, but got no results.");
    if (this._rows.length > 1) throw new Error(`Expected exactly one result from SQL query, but got ${this._rows.length} results.`);
    return this._rows[0];
  }
  toArray() { return [...this._rows]; }
  [Symbol.iterator]() { return this._rows[Symbol.iterator](); }
}
class SqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) { this.db.exec(query); return new SqlCursor([]); }
    const stmt = this.db.prepare(query);
    const verb = query.trimStart().slice(0, 6).toUpperCase();
    if (verb.startsWith("SELECT") || verb.startsWith("WITH")) return new SqlCursor(stmt.all(...params));
    const info = stmt.run(...params);
    return new SqlCursor([{ changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) }]);
  }
}

test("D: schema evolution over the DEPLOYED 3-column table preserves rows; idempotent", () => {
  const db = new DatabaseSync(":memory:");
  const sql = new SqlFacade(db);
  // The deployed build's exact d6_storage_state shape (CORRECTION-1 DDL).
  db.exec(`CREATE TABLE d6_storage_state (
    id INTEGER PRIMARY KEY CHECK (id = 1), base_bytes INTEGER NOT NULL,
    updated_at INTEGER NOT NULL);
  INSERT INTO d6_storage_state (id, base_bytes, updated_at) VALUES (1, 4242, 111);`);
  ensureGenSchema(sql);
  ensureGenSchema(sql); // second run: the evolution is a no-op, not an error
  const cols = db.prepare(`PRAGMA table_info(d6_storage_state)`).all().map(r => r.name);
  for (const c of ["object_count", "seeded_at", "provenance_json"])
    assert.ok(cols.includes(c), `column ${c} added`);
  const row = db.prepare(`SELECT * FROM d6_storage_state WHERE id = 1`).get();
  assert.equal(row.base_bytes, 4242, "the pre-existing row's value is untouched");
  assert.equal(row.updated_at, 111);
  assert.equal(row.object_count, null);
  // Fresh stores are born with the full column set (column ORDER
  // differs — appended vs declared — and is semantically irrelevant).
  const db2 = new DatabaseSync(":memory:");
  ensureGenSchema(new SqlFacade(db2));
  const cols2 = db2.prepare(`PRAGMA table_info(d6_storage_state)`).all().map(r => r.name);
  assert.deepEqual([...cols2].sort(), [...cols].sort());
});

test("D: store seed semantics — first seed, idempotent re-seed, provenance on change", () => {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  assert.deepEqual(store.storageSeedState(),
    { seeded: false, baseBytes: 0, objectCount: null, seededAt: null, provenance: [] });

  const first = store.seedStorageBase({
    baseBytes: 5_736_481_302, objectCount: 5942,
    recountedAt: 1761850000000, source: "test-recount",
  });
  assert.equal(first.changed, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.seeded, true);
  assert.equal(first.provenance.length, 1);
  assert.equal(first.provenance[0].previous, null);
  assert.equal(store.storageAccounting().baseBytes, 5_736_481_302,
    "the storage guard reads the seeded base");
  const rowAfterFirst = h.rows("d6_storage_state")[0];

  const again = store.seedStorageBase({
    baseBytes: 5_736_481_302, objectCount: 5942,
    recountedAt: 1761859999999, source: "test-recount",
  });
  assert.equal(again.idempotent, true);
  assert.equal(again.changed, false);
  assert.equal(again.provenance.length, 1, "same values append no provenance");
  assert.deepEqual(h.rows("d6_storage_state")[0], rowAfterFirst,
    "same values write nothing at all (updated_at stands)");

  const changed = store.seedStorageBase({
    baseBytes: 5_800_000_000, objectCount: 6001, source: "test-recount-2",
  });
  assert.equal(changed.changed, true);
  assert.equal(changed.provenance.length, 2);
  assert.deepEqual(changed.provenance[1].previous,
    { baseBytes: 5_736_481_302, objectCount: 5942 },
    "a changed re-seed records the values it replaced");
  assert.equal(changed.provenance[1].baseBytes, 5_800_000_000);
  assert.equal(store.storageAccounting().baseBytes, 5_800_000_000);

  assert.throws(() => store.seedStorageBase({ baseBytes: -1 }), /storage_seed_shape/);
  assert.throws(() => store.seedStorageBase({ baseBytes: 1.5 }), /storage_seed_shape/);
  assert.throws(() => store.seedStorageBase({ baseBytes: "5736481302" }), /storage_seed_shape/);
  assert.throws(() => store.seedStorageBase({ baseBytes: 10, objectCount: -2 }), /storage_seed_shape/);
});

test("D: service halt fence (G2-amended contract: figureless; the executor never seeds implicitly)", async () => {
  // G2 (ENRICHMENT-DESIGN §3.2) superseded this test's original
  // caller-figures contract: the service seed is now figureless and
  // recounts worker-side. The halt fence — this test's Correction-2
  // core — is kept verbatim; the full amended contract (figures
  // refusal, recount, zero-tolerance compare, applied path) is
  // proven in tests/d6-seed-hardening.test.mjs.
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  const halted = createGenerationService(
    { coord: h.coord, env: { GENERATION_HALT: "1" }, store });
  const live = createGenerationService(
    { coord: h.coord, env: { GENERATION_HALT: "0" }, store });
  const noFlag = createGenerationService(
    { coord: h.coord, env: {}, store });

  const refused = await live.seedStorageBase({});
  assert.equal(refused.outcome, "rejected");
  assert.equal(refused.reason, "generation_not_halted");
  assert.equal(refused.seeded, false);
  const refused2 = await noFlag.seedStorageBase({});
  assert.equal(refused2.reason, "generation_not_halted",
    "a missing halt flag fails closed, never open");
  assert.equal(store.storageSeedState().seeded, false, "refusals write nothing");

  const figures = await halted.seedStorageBase({ baseBytes: 100, objectCount: 3 });
  assert.equal(figures.outcome, "rejected");
  assert.equal(figures.reason, "caller_figures_refused",
    "G2: caller-supplied figures are refused, never trusted");
  assert.equal(store.storageSeedState().seeded, false);

  const unconfigured = await halted.seedStorageBase({});
  assert.equal(unconfigured.outcome, "rejected");
  assert.equal(unconfigured.reason, "seed_expected_base_not_configured",
    "a bare construction without the pinned expected base fails closed");
  assert.equal(store.storageSeedState().seeded, false);
});

// --- entry-level fence, through the REAL D6 entry (C3 plumbing) ---

function makeDoState() {
  const db = new DatabaseSync(":memory:");
  let alarmAt = null;
  const storage = {
    sql: new SqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch { /* noop */ } throw e; }
    },
    async setAlarm(ms) { alarmAt = ms; },
    async getAlarm() { return alarmAt; },
    async deleteAlarm() { alarmAt = null; },
  };
  return { db, state: { storage }, storage };
}
function doEnv(extra = {}) {
  return {
    OPALREADER_V2_SCOPE: "production",
    OPALREADER_ACCESS_TOKEN: TOK,
    GENERATION_HALT: "1",
    OPALREADER_STORAGE: makeFakeR2Bucket(),
    ALLOWED_ORIGIN: ORIGIN,
    ...extra,
  };
}
function internalReq(path, body) {
  return new Request(`https://do.test${path}`, {
    method: "POST",
    headers: {
      "x-opalreader-internal": "1", "x-opalreader-scope": "production",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("D: entry fence — public gate chain, class gate, halt fence end-to-end (G2-amended)", async () => {
  // G2 amendment: the seed call is now figureless, requires the
  // operator credential in addition to the full client gate chain,
  // and the worker recounts its own bucket (here a metadata stub
  // totaling the recorded base). The Correction-2 skeleton of this
  // test — the gate chain order and the halt fence end-to-end — is
  // unchanged; the full G2 matrix lives in d6-seed-hardening.
  // SEED-FIX amendment: admission is now the operator credential
  // ALONE — the gate skips its client-token check for this route,
  // so the no-client-token probe below APPLIES the seed instead of
  // returning the G2-era 401 (the scope/instance refusals and the
  // halt fence are unchanged). Full matrix: d6-seedfix.
  const OPTOK2 = "prod-operator-token-synthetic";
  const recordedStub = {
    async list({ limit = 1000, cursor } = {}) {
      const total = 5942, bulk = 5_736_481_302 - (total - 1);
      const start = cursor ? Number(cursor) : 0;
      const n = Math.min(limit, total - start);
      const objects = [];
      for (let i = 0; i < n; i++)
        objects.push({ key: `k${start + i}`, size: (start + i) === 0 ? bulk : 1 });
      const truncated = start + n < total;
      return { objects, truncated, ...(truncated ? { cursor: String(start + n) } : {}) };
    },
  };
  const { db, state } = makeDoState();
  const inst = new D6Prod(state, doEnv({ OPALREADER_STORAGE: recordedStub }));
  const ns = { idFromName: n => n, get: () => ({ fetch: (req) => inst.fetch(req) }) };
  const entryEnv = {
    OPALREADER_V2_SCOPE: "production", OPALREADER_ACCESS_TOKEN: TOK,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPTOK2,
    GENERATION_HALT: "1", COORDINATOR: ns, ALLOWED_ORIGIN: ORIGIN,
  };
  const seedBody = {};
  const call = ({ token = TOK, scope = "production", instance = "account" } = {}) =>
    D6Entry.fetch(new Request("https://w.test/v2/d6-seed-storage", {
      method: "POST",
      headers: {
        ...(token === null ? {} : { "x-opalreader-token": token }),
        "x-opalreader-operator-token": OPTOK2,
        ...(scope === null ? {} : { "x-opalreader-scope": scope }),
        ...(instance === null ? {} : { "x-opalreader-instance": instance }),
        "content-type": "application/json",
      },
      body: JSON.stringify(seedBody),
    }), entryEnv);

  const badScope = await call({ scope: "staging" });
  assert.equal(badScope.status, 403);
  assert.equal((await badScope.json()).error, "production_scope_required");
  const badInst = await call({ instance: "other" });
  assert.equal(badInst.status, 403);
  assert.equal((await badInst.json()).error, "production_instance_required");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM d6_storage_state").get().n, 0,
    "gate refusals never reach the store");

  // The class gate: a direct internal-route call without the
  // internal header is refused exactly like the other D6 routes.
  const noInternal = await inst.fetch(new Request("https://do.test/internal/d6/seed-storage", {
    method: "POST",
    headers: { "x-opalreader-scope": "production", "content-type": "application/json" },
    body: JSON.stringify(seedBody),
  }));
  assert.equal(noInternal.status, 403);
  assert.equal((await noInternal.json()).error, "internal_only");

  // SEED-FIX admission while halted: this call carries NO client
  // token — the operator header alone admits — and the seed
  // applies from the worker's own recount, with provenance
  // recorded.
  const ok = await call({ token: null });
  assert.equal(ok.status, 200);
  const okBody = await ok.json();
  assert.equal(okBody.outcome, "applied");
  assert.equal(okBody.baseBytes, 5_736_481_302);
  assert.equal(okBody.objectCount, 5942);
  const row = db.prepare("SELECT * FROM d6_storage_state WHERE id = 1").get();
  assert.equal(row.base_bytes, 5_736_481_302);
  assert.equal(JSON.parse(row.provenance_json)[0].source, "worker-recount");

  // A call carrying the client token as well stays admitted (the
  // header is not consulted for this route) and the re-seed is
  // idempotent — no second provenance entry.
  const again = await call();
  assert.equal(again.status, 200);
  const againBody = await again.json();
  assert.equal(againBody.outcome, "applied");
  assert.equal(againBody.idempotent, true);
  assert.equal(JSON.parse(db.prepare("SELECT * FROM d6_storage_state WHERE id = 1").get().provenance_json).length, 1);

  // While NOT halted, an operator-admitted internal call is refused
  // by the service fence and writes nothing. (G2: the internal
  // request carries the admitted stamp — without it the class gate
  // refuses first, proven in d6-seed-hardening E4.)
  const { db: db2, state: state2 } = makeDoState();
  const inst2 = new D6Prod(state2, doEnv({ GENERATION_HALT: "0" }));
  const admittedReq = new Request("https://do.test/internal/d6/seed-storage", {
    method: "POST",
    headers: {
      "x-opalreader-internal": "1", "x-opalreader-scope": "production",
      "x-opalreader-operator-admitted": "1", "content-type": "application/json",
    },
    body: JSON.stringify(seedBody),
  });
  const direct = await inst2.fetch(admittedReq);
  assert.equal(direct.status, 200);
  const directBody = await direct.json();
  assert.equal(directBody.outcome, "rejected");
  assert.equal(directBody.reason, "generation_not_halted");
  assert.equal(db2.prepare("SELECT COUNT(*) AS n FROM d6_storage_state").get().n, 0,
    "unhalted seed writes no row");
});
