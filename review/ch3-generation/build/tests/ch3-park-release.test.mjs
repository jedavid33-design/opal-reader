// Ch 3 mechanisms (CH3-GENERATION-PROPOSAL-v2 §5A / §5A.2 / §5B) —
// the park release + chapter-occurrence exemption stores, the
// mechanical definition derivation, and the builder/adapter fence
// consumption.
//
// Fixture discipline: the parked job is seeded EXACTLY as
// production holds it (coordinator._migrateImportJobs' output
// shape): the real pinned aggregate from
// worker/p8/approved-freeze-carry.mjs supplies the job row's
// stored definition (canonicalJson of the definition) and all 27
// occurrence rows (ids, revision keys, states) for job
// 1832c21f… / Forever Pucked / chapterIndex 2, definition total
// 26 — so the definition set is idx 0–25 and the beyond-definition
// set is exactly { idx 26 = 2a85f74f… }. Content entities are
// synthetic and structural only (invented placeholder text, never
// book text); char counts are fixture values.
//
// Coverage map (Rowan's implementation-review test list, board
// 6548728089): definition-set derivation against pinned AND live
// identity; no-release byte-identical behavior (builder census +
// adapter, tables absent AND empty, all scopes via the service
// quote); idx 26 voice_prompt STOP surface; exact scope filtering;
// duplicate/idempotency; rollback/tombstones; mutual exclusion.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness } from "./helpers/do-harness.mjs";
import { APPROVED_FREEZE_CARRY } from "../worker/p8/approved-freeze-carry.mjs";
import {
  deriveParkDefinition, releasePark, revokeParkRelease,
  exemptChapterOccurrence, revokeChapterExemption,
  getParkRelease, getChapterExemption, liveParkFenceRecords,
  liveChapterExemptionRow, chapterExemptionView,
  chapterExemptionEvents, chapterExemptionEventView,
  ensureParkReleaseSchema,
} from "../worker/generation/park-release.mjs";
import {
  buildEligibleSet, dispositionCounts,
} from "../worker/generation/eligible-set.mjs";
import {
  planeFromCoordinator, createCoordinatorPlaneSource,
} from "../worker/generation/content-plane-adapter.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import { createGenerationService } from "../worker/generation/service.mjs";
import {
  loadRealCensus, FP_BOOK_ID, FP_CH3_INDEX, PARKED_JOB_ID,
} from "./helpers/d6-census-fixture.mjs";

const BOOK = FP_BOOK_ID;
const JOB = PARKED_JOB_ID;
const AGG = APPROVED_FREEZE_CARRY.books[BOOK].jobs.aggregates
  .find(a => a.jobId === JOB);
const IDS = AGG.occurrences.map(o => o.occurrenceId);
const IDX26 = IDS[26];
const RELEASE_SET = IDS.slice(3, 26); // idx 3–25, the §7(a) set
const AUTH = { authorizationRef: "board:ch3-test-go", source: "test", note: "ch3 suite" };

// The coordinator's canonical JSON (sorted keys, recursively) —
// the exact discipline _migrateImportJobs stored data_json under.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

// Seed the jobs/occurrences rows exactly as _migrateImportJobs
// left them for this job.
function seedLiveJob(h) {
  const now = 1761000000000;
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane,
                  state, revision, data_json, created_at, updated_at)
                VALUES (?, 'job', ?, 2, 'standard', 'parked_policy', 1, ?, ?, ?)`)
    .run(JOB, BOOK, canonicalJson(AGG.definition), now, now);
  const occ = h.db.prepare(`INSERT INTO occurrences
    (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, ?)`);
  for (const o of AGG.occurrences) occ.run(JOB, o.occurrenceId, o.revisionKey, o.state);
}

// Seed a synthetic content entity for the FP book holding ONLY
// chapter 2 with all 27 segments (structural placeholder text),
// idx 0–2 bound in the bindings table. voice26 selects idx 26's
// cast voice provider (the §5B.2 open item: its voice disposition
// has never been evaluated — fixture it both ways).
function seedContent(h, { voice26 = "gemini" } = {}) {
  const segs = IDS.map((id, i) => ({
    occurrenceId: id,
    text: `synthetic segment ${i} ` + "x".repeat(600),
    pov: i === 26 && voice26 !== "gemini" ? "AltVoice" : "Narrator",
  }));
  const povs = [{
    id: "pov-narrator", name: "Narrator",
    voice: { provider: "gemini", voice_id: "Zephyr", model_id: "gemini-3.8-flash-tts" },
  }];
  if (voice26 !== "gemini")
    povs.push({
      id: "pov-alt", name: "AltVoice",
      voice: { provider: voice26, voice_id: "alt-voice", model_id: "alt-tts" },
    });
  const data = {
    chapters: [{ chapterId: "ch-2", index: 2, segments: segs }],
    povs,
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  h.db.prepare(`INSERT INTO sync_entities (family, entity_key, book_id, revision, deleted, data_json)
                VALUES ('content', ?, ?, 1, 0, ?)`).run(BOOK, BOOK, JSON.stringify(data));
  const bind = h.db.prepare(`INSERT INTO bindings
    (occurrence_id, revision_key, cache_key, provenance, bound_at)
    VALUES (?, ?, ?, 'migration', 1)`);
  for (let i = 0; i < 3; i++) bind.run(IDS[i], AGG.occurrences[i].revisionKey, "f".repeat(64));
}

function makeWorld(opts = {}) {
  const h = makeHarness({});
  const store = createGenStore(h.coord);
  store.ensureSchema();
  seedLiveJob(h);
  seedContent(h, opts);
  const service = createGenerationService({
    coord: h.coord, env: h.env, store,
    sources: createCoordinatorPlaneSource(h.coord) });
  return { h, store, service };
}

const jobRow = (h) => h.db.prepare(`SELECT * FROM jobs WHERE job_id = ?`).get(JOB);
const chapterEntries = (h) => buildEligibleSet(planeFromCoordinator(h.coord, BOOK), BOOK)
  .entries.filter(e => e.chapterIndex === FP_CH3_INDEX);
const dispOf = (entries, id) => entries.find(e => e.occurrenceId === id)?.disposition;
const pairList = (entries) => entries.map(e => [e.occurrenceId, e.disposition]);

// ------------------------------------------------------------------
// Definition derivation (§5A.2)

test("derivation: pinned aggregate and live-shaped store agree; first-26/last-1 partition is exact", () => {
  const { h } = makeWorld();
  const d = deriveParkDefinition(h.coord, jobRow(h));
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.equal(d.total, 26);
  assert.deepEqual(d.orderedIds, IDS, "ordered list is the pin's canonical list");
  assert.deepEqual(d.definitionIds, IDS.slice(0, 26));
  assert.deepEqual(d.beyondIds, [IDX26]);
  assert.equal(d.definitionSet.has(IDX26), false);
  assert.equal(d.beyondSet.has(IDX26), true);
  assert.equal(d.bookId, BOOK);
  assert.equal(d.chapterIndex, 2);
});

test("derivation refuses: no pinned aggregate for the job (park_definition_unpinned)", () => {
  const { h } = makeWorld();
  const ghost = { job_id: "no-such-job", book_id: "no-such-book", chapter_index: 2, data_json: "{}" };
  const d = deriveParkDefinition(h.coord, ghost);
  assert.equal(d.ok, false);
  assert.equal(d.reason, "park_definition_unpinned");
});

test("derivation refuses: stored definition total disagrees with the pin (park_definition_mismatch)", () => {
  const { h } = makeWorld();
  const tampered = { ...AGG.definition, total: 25 };
  h.db.prepare(`UPDATE jobs SET data_json = ? WHERE job_id = ?`)
    .run(canonicalJson(tampered), JOB);
  const d = deriveParkDefinition(h.coord, jobRow(h));
  assert.equal(d.ok, false);
  assert.equal(d.reason, "park_definition_mismatch");
});

test("derivation refuses: a live occurrence state disagrees with the pin (park_definition_mismatch)", () => {
  const { h } = makeWorld();
  h.db.prepare(`UPDATE occurrences SET state = 'ready'
                 WHERE job_id = ? AND occurrence_id = ?`).run(JOB, IDS[10]);
  const d = deriveParkDefinition(h.coord, jobRow(h));
  assert.equal(d.ok, false);
  assert.equal(d.reason, "park_definition_mismatch");
});

test("derivation refuses: a live occurrence row is missing (park_definition_mismatch)", () => {
  const { h } = makeWorld();
  h.db.prepare(`DELETE FROM occurrences WHERE job_id = ? AND occurrence_id = ?`)
    .run(JOB, IDS[7]);
  const d = deriveParkDefinition(h.coord, jobRow(h));
  assert.equal(d.ok, false);
  assert.equal(d.reason, "park_definition_mismatch");
});

test("derivation refuses: stored definition is not JSON (park_definition_malformed)", () => {
  const { h } = makeWorld();
  h.db.prepare(`UPDATE jobs SET data_json = 'not-json' WHERE job_id = ?`).run(JOB);
  const d = deriveParkDefinition(h.coord, jobRow(h));
  assert.equal(d.ok, false);
  assert.equal(d.reason, "park_definition_malformed");
});

// ------------------------------------------------------------------
// Release (§5A)

test("release happy path: chapter quote shows exactly idx 3–25 eligible; idx 26 still fenced; idx 0–2 bound; job untouched", async () => {
  const { h, service } = makeWorld();
  const before = await service.eligibilityQuote(
    { bookId: BOOK, scope: "chapter", chapterIndex: 2 });
  assert.equal(before.eligibleCount, 0);
  assert.deepEqual(before.exclusions,
    { bound_already: 3, voice_prompt: 0, parked: 24, other: 0 });

  // Input order is deliberately shuffled: the stored set must be
  // normalized to definition order.
  const shuffled = [...RELEASE_SET].reverse();
  const res = releasePark(h.coord, { jobId: JOB, occurrenceIds: shuffled, ...AUTH });
  assert.equal(res.outcome, "applied", JSON.stringify(res));
  assert.equal(res.alreadyReleased, false);
  assert.deepEqual(res.occurrenceIds, RELEASE_SET);
  assert.deepEqual(res.release.occurrenceIds, RELEASE_SET);
  assert.equal(res.release.state, "live");
  assert.equal(res.release.jobId, JOB);
  assert.equal(res.release.bookId, BOOK);
  assert.equal(res.release.chapterIndex, 2);
  assert.equal(res.release.authorizationRef, AUTH.authorizationRef);

  const quote = await service.eligibilityQuote(
    { bookId: BOOK, scope: "chapter", chapterIndex: 2 });
  assert.equal(quote.eligibleCount, 23);
  assert.deepEqual(quote.exclusions,
    { bound_already: 3, voice_prompt: 0, parked: 1, other: 0 },
    "only idx 26 remains parked after the release");
  const entries = chapterEntries(h);
  assert.deepEqual(
    entries.filter(e => e.disposition === "eligible").map(e => e.occurrenceId),
    RELEASE_SET, "exactly the released set is eligible, in reading order");
  assert.equal(dispOf(entries, IDX26), "excluded_parked",
    "idx 26 is a live entry row, so the entry fence is its live label");
  for (let i = 0; i < 3; i++)
    assert.equal(dispOf(entries, IDS[i]), "bound_already");

  // Segment scope filtering is exact (§6 E1 read-back shape).
  const seg26 = await service.eligibilityQuote(
    { bookId: BOOK, scope: "segment", occurrenceId: IDX26 });
  assert.equal(seg26.eligibleCount, 0);
  assert.equal(seg26.exclusions.parked, 1);
  const seg5 = await service.eligibilityQuote(
    { bookId: BOOK, scope: "segment", occurrenceId: IDS[5] });
  assert.equal(seg5.eligibleCount, 1);

  // The parked job record itself is untouched by the release.
  const job = jobRow(h);
  assert.equal(job.state, "parked_policy");
  assert.equal(job.revision, 1);
  assert.equal(h.db.prepare(
    `SELECT COUNT(*) AS n FROM occurrences WHERE job_id = ? AND state = 'pending'`)
    .get(JOB).n, 24, "no occurrence row moved");
});

test("release refuses idx 26 by name — park_release_outside_definition, zero writes", () => {
  const { h } = makeWorld();
  const withIdx26 = releasePark(h.coord,
    { jobId: JOB, occurrenceIds: [...RELEASE_SET, IDX26], ...AUTH });
  assert.equal(withIdx26.outcome, "rejected");
  assert.equal(withIdx26.reason, "park_release_outside_definition");
  assert.equal(withIdx26.occurrenceId, IDX26);
  const onlyIdx26 = releasePark(h.coord,
    { jobId: JOB, occurrenceIds: [IDX26], ...AUTH });
  assert.equal(onlyIdx26.outcome, "rejected");
  assert.equal(onlyIdx26.reason, "park_release_outside_definition");
  assert.equal(h.rows("d6_park_releases").length, 0, "zero writes on refusal");
});

test("release fences: not-pending, not-in-job, unknown job, non-parked job, set shape — all refuse with zero writes", () => {
  const { h } = makeWorld();
  const bound = releasePark(h.coord, { jobId: JOB, occurrenceIds: [IDS[0]], ...AUTH });
  assert.equal(bound.reason, "park_release_occurrence_not_pending",
    "idx 0 is a ready (bound) row — never releasable");
  const stranger = releasePark(h.coord,
    { jobId: JOB, occurrenceIds: ["00000000-0000-0000-0000-000000000000"], ...AUTH });
  assert.equal(stranger.reason, "park_release_occurrence_not_in_job");
  const noJob = releasePark(h.coord,
    { jobId: "no-such-job", occurrenceIds: [IDS[3]], ...AUTH });
  assert.equal(noJob.reason, "park_release_job_not_found");
  const now = Date.now();
  h.db.prepare(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane,
                  state, revision, data_json, created_at, updated_at)
                VALUES ('job-done', 'job', ?, 0, 'standard', 'complete', 1, '{}', ?, ?)`)
    .run(BOOK, now, now);
  const notParked = releasePark(h.coord,
    { jobId: "job-done", occurrenceIds: [IDS[3]], ...AUTH });
  assert.equal(notParked.reason, "park_release_job_not_parked");
  assert.equal(releasePark(h.coord, { jobId: JOB, occurrenceIds: [], ...AUTH }).reason,
    "park_release_set_empty");
  assert.equal(releasePark(h.coord,
    { jobId: JOB, occurrenceIds: [IDS[3], IDS[3]], ...AUTH }).reason,
    "park_release_set_duplicate");
  assert.equal(releasePark(h.coord,
    { jobId: JOB, occurrenceIds: "not-an-array", ...AUTH }).reason,
    "park_release_set_invalid");
  assert.equal(releasePark(h.coord,
    { jobId: JOB, occurrenceIds: [42], ...AUTH }).reason,
    "park_release_set_invalid");
  assert.equal(h.rows("d6_park_releases").length, 0, "zero writes across the matrix");
});

test("release idempotency: identical re-release is a no-op; a different set conflicts", () => {
  const { h } = makeWorld();
  const first = releasePark(h.coord, { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH });
  assert.equal(first.outcome, "applied");
  const again = releasePark(h.coord,
    { jobId: JOB, occurrenceIds: [...RELEASE_SET].reverse(), ...AUTH });
  assert.equal(again.outcome, "applied");
  assert.equal(again.alreadyReleased, true, "same set, any order: idempotent no-op");
  assert.equal(h.rows("d6_park_releases").length, 1, "still exactly one row");
  const conflict = releasePark(h.coord,
    { jobId: JOB, occurrenceIds: RELEASE_SET.slice(0, 22), ...AUTH });
  assert.equal(conflict.outcome, "rejected");
  assert.equal(conflict.reason, "park_release_conflict");
  assert.equal(h.rows("d6_park_releases").length, 1);
  assert.equal(getParkRelease(h.coord, JOB).state, "live");
});

test("release tombstone restores the fence output EXACTLY; re-release after tombstone is a new audited row", () => {
  const { h } = makeWorld();
  const baselinePairs = pairList(chapterEntries(h));
  const baselineDigest = buildEligibleSet(planeFromCoordinator(h.coord, BOOK), BOOK).digest;

  releasePark(h.coord, { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH });
  assert.notDeepEqual(pairList(chapterEntries(h)), baselinePairs);

  const revoked = revokeParkRelease(h.coord, { jobId: JOB, ...AUTH });
  assert.equal(revoked.outcome, "applied");
  assert.equal(revoked.alreadyRevoked, false);
  assert.equal(revoked.release.state, "tombstoned");
  assert.ok(revoked.release.tombstonedAt > 0);
  assert.deepEqual(pairList(chapterEntries(h)), baselinePairs,
    "tombstone restores the original fence output exactly");
  assert.equal(buildEligibleSet(planeFromCoordinator(h.coord, BOOK), BOOK).digest,
    baselineDigest);

  const revokedAgain = revokeParkRelease(h.coord, { jobId: JOB, ...AUTH });
  assert.equal(revokedAgain.outcome, "applied");
  assert.equal(revokedAgain.alreadyRevoked, true, "double revoke is an idempotent no-op");

  const reReleased = releasePark(h.coord, { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH });
  assert.equal(reReleased.outcome, "applied");
  assert.equal(reReleased.alreadyReleased, false);
  assert.equal(h.rows("d6_park_releases").length, 2,
    "the tombstoned row is preserved; the new release is its own row");
  assert.equal(dispOf(chapterEntries(h), IDS[5]), "eligible");
});

test("revoke with no release row refuses park_release_not_found", () => {
  const { h } = makeWorld();
  const res = revokeParkRelease(h.coord, { jobId: JOB, ...AUTH });
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "park_release_not_found");
});

// ------------------------------------------------------------------
// Exemption (§5B)

test("exemption happy path: idx 26 falls through to eligible (live voice); chapter parked count drops to the 23 unreleased", async () => {
  const { h, service } = makeWorld();
  const res = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(res.outcome, "applied", JSON.stringify(res));
  assert.equal(res.alreadyExempted, false);
  assert.equal(res.exemption.occurrenceId, IDX26);
  assert.equal(res.exemption.tombstoned, false);

  const seg = await service.eligibilityQuote(
    { bookId: BOOK, scope: "segment", occurrenceId: IDX26 });
  assert.equal(seg.eligibleCount, 1, "idx 26 is evaluated normally once exempted");
  const entries = chapterEntries(h);
  assert.equal(dispOf(entries, IDX26), "eligible");
  assert.equal(entries.filter(e => e.disposition === "excluded_parked").length, 23,
    "idx 3–25 remain fenced (no release in this world)");
});

test("exemption STOP surface: a removed-provider voice on idx 26 surfaces as voice_prompt once exempted (§5B.2)", () => {
  const { h } = makeWorld({ voice26: "azure" });
  assert.equal(dispOf(chapterEntries(h), IDX26), "excluded_parked",
    "before the exemption the fence hides the voice disposition entirely");
  const res = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(res.outcome, "applied");
  assert.equal(dispOf(chapterEntries(h), IDX26), "voice_prompt",
    "Phase B's STOP signal: the exemption surfaces the voice decision, never bypasses it");
});

test("exemption refuses a definition member by name — chapter_exemption_inside_definition, zero writes", () => {
  const { h } = makeWorld();
  const member = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDS[10], ...AUTH });
  assert.equal(member.outcome, "rejected");
  assert.equal(member.reason, "chapter_exemption_inside_definition");
  const boundMember = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDS[0], ...AUTH });
  assert.equal(boundMember.reason, "chapter_exemption_inside_definition",
    "the definition fence precedes the bound fence");
  assert.equal(h.rows("d6_chapter_exemptions").length, 0, "zero writes on refusal");
});

test("exemption fences: bound idx 26, not-in-job, unknown job — all refuse", () => {
  const { h } = makeWorld();
  h.db.prepare(`INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
                VALUES (?, 'unbound', ?, 'migration', 1)`)
    .run(IDX26, "e".repeat(64));
  const bound = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(bound.reason, "chapter_exemption_occurrence_bound");
  const stranger = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: "00000000-0000-0000-0000-000000000000", ...AUTH });
  assert.equal(stranger.reason, "chapter_exemption_occurrence_not_in_job");
  const noJob = exemptChapterOccurrence(h.coord,
    { jobId: "no-such-job", occurrenceId: IDX26, ...AUTH });
  assert.equal(noJob.reason, "chapter_exemption_job_not_found");
  assert.equal(h.rows("d6_chapter_exemptions").length, 0);
});

test("exemption idempotency + tombstone restores both fences exactly; reactivation keeps the tombstone audit", () => {
  const { h } = makeWorld();
  const baselinePairs = pairList(chapterEntries(h));
  const first = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(first.outcome, "applied");
  const again = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(again.outcome, "applied");
  assert.equal(again.alreadyExempted, true);
  assert.equal(h.rows("d6_chapter_exemptions").length, 1);

  const revoked = revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(revoked.outcome, "applied");
  assert.equal(revoked.exemption.tombstoned, true);
  assert.deepEqual(pairList(chapterEntries(h)), baselinePairs,
    "tombstone restores the original fence output exactly");
  const revokedAgain = revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(revokedAgain.alreadyRevoked, true);
  const missing = revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDS[9], ...AUTH });
  assert.equal(missing.reason, "chapter_exemption_not_found");

  const reactivated = exemptChapterOccurrence(h.coord, {
    jobId: JOB, occurrenceId: IDX26,
    authorizationRef: "board:ch3-test-go-2", source: "test", note: "reactivation",
  });
  assert.equal(reactivated.outcome, "applied");
  assert.equal(reactivated.alreadyExempted, false);
  assert.equal(reactivated.exemption.tombstoned, false);
  assert.equal(reactivated.exemption.authorizationRef, "board:ch3-test-go-2");
  assert.ok(reactivated.exemption.tombstonedAt > 0,
    "the prior tombstone remains on the row as the reversal record");
  assert.equal(h.rows("d6_chapter_exemptions").length, 1,
    "one row per occurrence (the §5B.2 primary key)");
  assert.equal(getChapterExemption(h.coord, IDX26).tombstoned, 0);
});

// ------------------------------------------------------------------
// Mutual exclusion (§11) — both directions. Through the routes the
// partition already makes overlap impossible (the definition fence
// fires first); these seed the inconsistent state directly to prove
// the named mutual-exclusion fences exist and hold.

test("mutual exclusion: release refuses an id covered by a live exemption (park_release_occurrence_exempted)", () => {
  const { h } = makeWorld();
  ensureParkReleaseSchema(h.coord.sql);
  h.db.prepare(`INSERT INTO d6_chapter_exemptions
      (occurrence_id, job_id, book_id, chapter_index, authorization_ref,
       source, note, created_at, tombstoned)
    VALUES (?, ?, ?, 2, 'seeded-inconsistent', 'test', NULL, 1, 0)`)
    .run(IDS[5], JOB, BOOK);
  const res = releasePark(h.coord, { jobId: JOB, occurrenceIds: [IDS[5]], ...AUTH });
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "park_release_occurrence_exempted");
  assert.equal(h.rows("d6_park_releases").length, 0);
});

test("mutual exclusion: exemption refuses an id covered by a live release (chapter_exemption_occurrence_released)", () => {
  const { h } = makeWorld();
  ensureParkReleaseSchema(h.coord.sql);
  h.db.prepare(`INSERT INTO d6_park_releases
      (job_id, book_id, chapter_index, occurrence_ids_json,
       authorization_ref, source, note, released_at, state)
    VALUES (?, ?, 2, ?, 'seeded-inconsistent', 'test', NULL, 1, 'live')`)
    .run(JOB, BOOK, JSON.stringify([IDX26]));
  const res = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  assert.equal(res.outcome, "rejected");
  assert.equal(res.reason, "chapter_exemption_occurrence_released");
  assert.equal(h.rows("d6_chapter_exemptions").length, 0);
});

// ------------------------------------------------------------------
// No-release byte-identical behavior (Rowan's inertness condition)

test("byte-identical: census builder output with fence fields absent vs empty sets", () => {
  const { plane } = loadRealCensus();
  const base = buildEligibleSet(plane, FP_BOOK_ID);
  const withEmpty = buildEligibleSet({
    ...plane,
    parkedJob: { ...plane.parkedJob, releasedIds: new Set(), exemptIds: new Set() },
  }, FP_BOOK_ID);
  assert.equal(withEmpty.digest, base.digest);
  assert.deepEqual(pairList(withEmpty.entries), pairList(base.entries));
  assert.deepEqual(dispositionCounts(base),
    { eligible: 333, voice_prompt: 0, excluded_ch3: 1, excluded_parked: 23, bound_already: 50 });
});

test("census scope: released idx 3–25 become eligible; idx 26 stays fenced until exempted; then the chapter fully clears", () => {
  const { plane } = loadRealCensus();
  const ch3 = (set) => set.entries.filter(e => e.chapterIndex === FP_CH3_INDEX);
  const released = buildEligibleSet({
    ...plane,
    parkedJob: { ...plane.parkedJob, releasedIds: new Set(RELEASE_SET), exemptIds: new Set() },
  }, FP_BOOK_ID);
  const relCh3 = ch3(released);
  assert.deepEqual(
    relCh3.filter(e => e.disposition === "eligible").map(e => e.occurrenceId),
    RELEASE_SET);
  assert.equal(dispOf(relCh3, IDX26), "excluded_ch3",
    "in the census plane idx 26 is not a parked entry, so the chapter rule is its fence — the release never reaches it");
  assert.equal(dispositionCounts(released).eligible, 356);

  const both = buildEligibleSet({
    ...plane,
    parkedJob: {
      ...plane.parkedJob,
      releasedIds: new Set(RELEASE_SET), exemptIds: new Set([IDX26]),
    },
  }, FP_BOOK_ID);
  const bothCh3 = ch3(both);
  assert.equal(dispOf(bothCh3, IDX26), "eligible",
    "the exemption skips BOTH parked dispositions (here: the chapter rule)");
  assert.equal(bothCh3.filter(e => e.disposition === "eligible").length, 24);
  assert.equal(bothCh3.filter(e => e.disposition === "bound_already").length, 3);
  assert.equal(dispositionCounts(both).eligible, 357);
});

test("byte-identical: adapter plane with tables ABSENT vs tables EMPTY, and fence records read empty without throwing", () => {
  const { h } = makeWorld();
  // Tables absent: the adapter's fence reads must tolerate it
  // (real DO .one() throws on empty; absence must read as none).
  const records = liveParkFenceRecords(h.coord, JOB);
  assert.equal(records.releasedIds.size, 0);
  assert.equal(records.exemptIds.size, 0);
  const absent = buildEligibleSet(planeFromCoordinator(h.coord, BOOK), BOOK);
  ensureParkReleaseSchema(h.coord.sql);
  const empty = buildEligibleSet(planeFromCoordinator(h.coord, BOOK), BOOK);
  assert.equal(empty.digest, absent.digest);
  assert.deepEqual(pairList(empty.entries), pairList(absent.entries));
  const plane = planeFromCoordinator(h.coord, BOOK);
  assert.equal(plane.parkedJob.releasedIds.size, 0);
  assert.equal(plane.parkedJob.exemptIds.size, 0);
});

// ------------------------------------------------------------------
// Exemption audit journal (Rowan 6548945443 — revision of judgment
// call 5): reactivation must retain an append-only durable audit
// trail of EVERY authorization and reversal. The singleton
// d6_chapter_exemptions row is only the current-state projection;
// the complete history lives in d6_chapter_exemption_events.

test("journal: three revoke/reactivate cycles — exact ordered event sequence; projection matches the state at every step", () => {
  const { h } = makeWorld();
  const actions = () => chapterExemptionEvents(h.coord, IDX26).map(e => e.action);

  const first = exemptChapterOccurrence(h.coord, {
    jobId: JOB, occurrenceId: IDX26,
    authorizationRef: "board:go-1", source: "test", note: "auth 1",
  });
  assert.equal(first.outcome, "applied");
  assert.deepEqual(actions(), ["exempted"]);
  const ev0 = chapterExemptionEvents(h.coord, IDX26)[0];
  assert.equal(ev0.authorization_ref, "board:go-1");
  assert.equal(ev0.source, "test");
  assert.equal(ev0.note, "auth 1");
  assert.equal(ev0.resulting_state, "live");
  assert.equal(ev0.job_id, JOB);
  assert.equal(ev0.book_id, BOOK);
  assert.equal(getChapterExemption(h.coord, IDX26).tombstoned, 0);

  // An idempotent duplicate is NOT a state change: no journal event.
  const dup = exemptChapterOccurrence(h.coord, {
    jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:go-dup", source: "test",
  });
  assert.equal(dup.alreadyExempted, true);
  assert.deepEqual(actions(), ["exempted"],
    "idempotent no-op appends no event");

  for (let cycle = 1; cycle <= 3; cycle++) {
    const rv = revokeChapterExemption(h.coord, {
      jobId: JOB, occurrenceId: IDX26,
      authorizationRef: `board:revoke-${cycle}`, source: "test",
      note: `revoke ${cycle}`,
    });
    assert.equal(rv.outcome, "applied");
    assert.equal(rv.alreadyRevoked, false);
    assert.equal(getChapterExemption(h.coord, IDX26).tombstoned, 1,
      `projection is tombstoned after revoke ${cycle}`);
    const rvDup = revokeChapterExemption(h.coord, {
      jobId: JOB, occurrenceId: IDX26,
      authorizationRef: `board:revoke-${cycle}-dup`, source: "test",
    });
    assert.equal(rvDup.alreadyRevoked, true);
    const re = exemptChapterOccurrence(h.coord, {
      jobId: JOB, occurrenceId: IDX26,
      authorizationRef: `board:go-${cycle + 1}`, source: "test",
      note: `auth ${cycle + 1}`,
    });
    assert.equal(re.outcome, "applied");
    assert.equal(re.alreadyExempted, false);
    assert.equal(getChapterExemption(h.coord, IDX26).tombstoned, 0,
      `projection is live after reactivation ${cycle}`);
  }

  const events = chapterExemptionEvents(h.coord, IDX26);
  assert.deepEqual(events.map(e => e.action),
    ["exempted", "revoked", "reactivated", "revoked", "reactivated",
     "revoked", "reactivated"]);
  assert.deepEqual(events.map(e => e.resulting_state),
    ["live", "tombstoned", "live", "tombstoned", "live", "tombstoned", "live"]);
  assert.deepEqual(events.map(e => e.authorization_ref),
    ["board:go-1", "board:revoke-1", "board:go-2", "board:revoke-2",
     "board:go-3", "board:revoke-3", "board:go-4"],
    "EVERY authorization and reversal survives — reactivation overwrote none");
  assert.deepEqual(events.map(e => e.event_id), [1, 2, 3, 4, 5, 6, 7],
    "event ids are the dense append sequence");
  const proj = getChapterExemption(h.coord, IDX26);
  assert.equal(proj.authorization_ref, "board:go-4",
    "the projection carries only the LATEST authorization");
  assert.equal(proj.tombstone_authorization_ref, "board:revoke-3",
    "the projection carries only the MOST RECENT reversal");
  assert.equal(h.rows("d6_chapter_exemptions").length, 1,
    "still exactly one projection row (the §5B.2 primary key)");
  assert.equal(h.rows("d6_chapter_exemption_events").length, 7);
});

test("journal: complete audit recovery — replaying the journal alone reconstructs every transition and the current state", () => {
  const { h } = makeWorld();
  exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:go-a", source: "test" });
  revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:revoke-a", source: "test" });
  exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:go-b", source: "test" });
  revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:revoke-b", source: "test" });

  // Replay from the journal alone: fold the events in order,
  // tracking state + the authorization behind each state.
  const events = chapterExemptionEvents(h.coord, IDX26)
    .map(chapterExemptionEventView);
  assert.equal(events.length, 4);
  let state = "none", liveRef = null, lastRevokeRef = null;
  for (const ev of events) {
    if (ev.action === "exempted" || ev.action === "reactivated") {
      state = "live"; liveRef = ev.authorizationRef;
    } else if (ev.action === "revoked") {
      state = "tombstoned"; lastRevokeRef = ev.authorizationRef;
    }
    assert.equal(ev.resultingState, state,
      "each event's recorded resulting state matches the replay");
    assert.equal(ev.occurrenceId, IDX26);
    assert.equal(ev.jobId, JOB);
  }
  assert.equal(state, "tombstoned");
  assert.equal(liveRef, "board:go-b",
    "the journal recovers the SUPERSEDED authorization the projection overwrote");
  assert.equal(lastRevokeRef, "board:revoke-b");

  // The replay agrees with the projection on current state — and
  // the projection demonstrably holds less than the journal.
  const proj = chapterExemptionView(getChapterExemption(h.coord, IDX26));
  assert.equal(proj.tombstoned, true);
  assert.equal(proj.authorizationRef, liveRef);
  assert.equal(proj.tombstoneAuthorizationRef, lastRevokeRef);
  assert.equal(liveChapterExemptionRow(h.coord, IDX26), null);
});

test("journal: immutability — prior event rows are byte-stable across later operations; refusals append nothing", () => {
  const { h } = makeWorld();
  exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:go-1", source: "test" });
  const afterFirst = JSON.stringify(h.rows("d6_chapter_exemption_events"));
  revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:revoke-1", source: "test" });
  const afterRevoke = JSON.stringify(h.rows("d6_chapter_exemption_events"));
  exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:go-2", source: "test" });

  const rowsNow = h.rows("d6_chapter_exemption_events");
  assert.equal(rowsNow.length, 3);
  assert.equal(JSON.stringify(rowsNow.slice(0, 1)), afterFirst,
    "the first event row is byte-identical after later writes");
  assert.equal(JSON.stringify(rowsNow.slice(0, 2)), afterRevoke,
    "the revoke event row is byte-identical after reactivation");

  // Refusals are not transitions: no event, no write.
  const member = exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDS[9], ...AUTH });
  assert.equal(member.reason, "chapter_exemption_inside_definition");
  const missing = revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDS[9], ...AUTH });
  assert.equal(missing.reason, "chapter_exemption_not_found");
  assert.equal(h.rows("d6_chapter_exemption_events").length, 3,
    "refused calls append no journal events");
});

test("journal: fence output with journal history present is byte-identical once the exemption is tombstoned", () => {
  const { h } = makeWorld();
  const baselinePairs = pairList(chapterEntries(h));
  const baselineDigest = buildEligibleSet(planeFromCoordinator(h.coord, BOOK), BOOK).digest;
  exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:go-1", source: "test" });
  revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:revoke-1", source: "test" });
  exemptChapterOccurrence(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:go-2", source: "test" });
  revokeChapterExemption(h.coord,
    { jobId: JOB, occurrenceId: IDX26, authorizationRef: "board:revoke-2", source: "test" });
  assert.equal(h.rows("d6_chapter_exemption_events").length, 4,
    "the journal holds the full history");
  assert.deepEqual(pairList(chapterEntries(h)), baselinePairs,
    "journal writes never alter any fence output");
  assert.equal(buildEligibleSet(planeFromCoordinator(h.coord, BOOK), BOOK).digest,
    baselineDigest);
});

test("combined: release + exemption together clear the whole chapter (bound 3 / eligible 24 / parked 0)", async () => {
  const { h, service } = makeWorld();
  releasePark(h.coord, { jobId: JOB, occurrenceIds: RELEASE_SET, ...AUTH });
  exemptChapterOccurrence(h.coord, { jobId: JOB, occurrenceId: IDX26, ...AUTH });
  const quote = await service.eligibilityQuote(
    { bookId: BOOK, scope: "chapter", chapterIndex: 2 });
  assert.equal(quote.eligibleCount, 24);
  assert.deepEqual(quote.exclusions,
    { bound_already: 3, voice_prompt: 0, parked: 0, other: 0 });
  const records = liveParkFenceRecords(h.coord, JOB);
  assert.deepEqual([...records.releasedIds].sort(), [...RELEASE_SET].sort());
  assert.deepEqual([...records.exemptIds], [IDX26]);
});
