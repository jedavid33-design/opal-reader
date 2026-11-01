// RANGE-FIX (Option B) — equivalence + regression suite for the
// replacement of the five SQL LIKE prefix scans with half-open PK
// range scans (REMEDIATION-OPTIONS.md; Rowan ANALYSIS PASS
// 6560003451; build under Julie GO 6560015979).
//
// What this suite proves (and what it cannot): the local harness's
// SQLite ACCEPTS the LIKE construction production rejects, so no
// test here reproduces the production 500 and none proves the fix
// against the production engine. What is proven is SEMANTIC
// EQUIVALENCE: on every key the shipped writers can produce, the
// range scan returns byte-identical row sets to the LIKE it
// replaces (same rows, same order where the original ordered); on
// adversarial keys (pattern metacharacters in an id, case-variant
// keys) the range returns exactly the INTENDED byte-prefix set,
// and the LIKE's divergence is asserted openly as its documented
// over-match — the fix is strictly tighter there, never looser.
//
// Site map: L1 grant-finalizer §4.3.5 (detail_json, ORDER BY);
// L2 coordinator _voidDispatch (full rows); L3 coordinator
// handleReport grant-closure sweep (detail_json, in-transaction);
// L4 coordinator lease delivered branch (detail_json -> Set);
// L5 coordinator handleReport repair-chain COUNT over jobs.job_id.

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { makeHarness, makeProbe, occ, submit } from "./helpers/do-harness.mjs";
import { createGenStore } from "../worker/generation/genstore.mjs";
import {
  PLAN, JOB, GRANT, T0, AUTH_REF, seedStalledState,
} from "./helpers/grant-finalizer-fixture.mjs";
import {
  deriveGrantFinalizationState, previewGrantFinalization, finalizeGrant,
} from "../worker/generation/grant-finalizer.mjs";
import { prefixSuccessor, prefixRangeClause } from "../worker/generation/prefix-range.mjs";

// ----------------------------------------------------------------
// Part A — the shared helper: successor-bound computation.
// ----------------------------------------------------------------

test("helper: production prefixes end in ':' and succeed to ';'", () => {
  assert.equal(prefixSuccessor("op:grant:plan:e377a5559961b294154276b6:ch2:1:full:"),
    "op:grant:plan:e377a5559961b294154276b6:ch2:1:full;");
  assert.equal(prefixSuccessor("plan:x:follow:"), "plan:x:follow;");
  assert.equal(prefixSuccessor(":"), ";");
});

test("helper: boundary bytes — 0x7E succeeds to 0x7F; successor is exclusive", () => {
  assert.equal(prefixSuccessor("a~"), "a\x7F");
  assert.equal(prefixSuccessor("a\x7F"), "a\x80");
});

test("helper: trailing U+10FFFF code points drop before incrementing", () => {
  assert.equal(prefixSuccessor("a\u{10FFFF}"), "b");
  assert.equal(prefixSuccessor("ab\u{10FFFF}\u{10FFFF}"), "ac");
});

test("helper: no finite successor — empty and all-max prefixes return null", () => {
  assert.equal(prefixSuccessor(""), null);
  assert.equal(prefixSuccessor("\u{10FFFF}"), null);
  const c = prefixRangeClause("op_key", "\u{10FFFF}");
  assert.equal(c.clause, "op_key >= ?");
  assert.deepEqual(c.params, ["\u{10FFFF}"]);
});

test("helper: non-ASCII last code point increments by code point", () => {
  assert.equal(prefixSuccessor("xé"), "xê");       // U+00E9 -> U+00EA
  assert.equal(prefixSuccessor("xÿ"), "xĀ");       // U+00FF -> U+0100
});

test("helper: clause shape and params for the ordinary case", () => {
  const c = prefixRangeClause("op_key", "op:g:");
  assert.equal(c.clause, "op_key >= ? AND op_key < ?");
  assert.deepEqual(c.params, ["op:g:", "op:g;"]);
  const j = prefixRangeClause("job_id", "job-1:follow:");
  assert.deepEqual(j.params, ["job-1:follow:", "job-1:follow;"]);
});

// ----------------------------------------------------------------
// Part B — SQL-level equivalence on a scratch store, per site
// shape. The old queries are reproduced verbatim (with LIKE) and
// run against the same rows as the new range predicates.
// ----------------------------------------------------------------

const G1 = "grant:plan:aaaa1111bbbb2222cccc3333dddd4444:ch1:1:full";
const G1_NEXT_HEX = "grant:plan:aaaa1111bbbb2222cccc3333dddd4445:ch1:1:full"; // one hex char up
const G_SHORT = "grant:plan:ab";            // strict textual prefix of G_LONGER's id
const G_LONGER = "grant:plan:abc";
const G_FULL2 = "grant:plan:aaaa1111bbbb2222cccc3333dddd4444:ch1:1:full2"; // 'full' sibling segment

function scratchLedger() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE ledger_ops (op_key TEXT PRIMARY KEY, kind TEXT, detail_json TEXT)`);
  db.exec(`CREATE TABLE jobs (job_id TEXT PRIMARY KEY)`);
  return db;
}
function ins(db, key, kind = "attempt", occId = "occ") {
  db.prepare(`INSERT INTO ledger_ops (op_key, kind, detail_json) VALUES (?, ?, ?)`)
    .run(key, kind, JSON.stringify({ occurrenceId: occId }));
}
test("SQL L1 shape: range == LIKE row-for-row, in ORDER BY order, on the machine universe", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE ledger_ops (op_key TEXT PRIMARY KEY, kind TEXT, detail_json TEXT)`);
  ins(db, `op:${G1}:occ-2`, "attempt", "occ-2");
  ins(db, `op:${G1}:occ-1`, "attempt", "occ-1");
  ins(db, `op:${G1}:`, "attempt", "empty-suffix");
  ins(db, `op:${G1}:occ-é-3`, "attempt", "occ-é-3");
  ins(db, `op:${G1_NEXT_HEX}:occ-9`, "attempt", "occ-9");
  ins(db, `op:${G_SHORT}:occ-a`, "attempt", "occ-a");
  ins(db, `op:${G_LONGER}:occ-b`, "attempt", "occ-b");
  ins(db, `op:${G_FULL2}:occ-c`, "attempt", "occ-c");
  ins(db, `rel:op:${G1}:occ-1`, "attempt_release", "occ-1");
  const like = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ? ORDER BY op_key`)
    .all(`op:${G1}:%`);
  const pred = prefixRangeClause("op_key", `op:${G1}:`);
  const range = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${pred.clause} ORDER BY op_key`)
    .all(...pred.params);
  assert.deepEqual(range, like);
  assert.deepEqual(range.map(r => JSON.parse(r.detail_json).occurrenceId),
    ["empty-suffix", "occ-1", "occ-2", "occ-é-3"]);
  // Prefix-sibling with the colon guard: G_SHORT's prefix must NOT
  // reach G_LONGER's rows, under either construction.
  const likeShort = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ? ORDER BY op_key`)
    .all(`op:${G_SHORT}:%`).map(r => JSON.parse(r.detail_json).occurrenceId);
  const predShort = prefixRangeClause("op_key", `op:${G_SHORT}:`);
  const rangeShort = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${predShort.clause} ORDER BY op_key`)
    .all(...predShort.params).map(r => JSON.parse(r.detail_json).occurrenceId);
  assert.deepEqual(rangeShort, likeShort);
  assert.deepEqual(rangeShort, ["occ-a"]);
  // The successor bound itself is excluded by both constructions.
  ins(db, `op:${G1};zzz`, "attempt", "at-bound");
  const range2 = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${pred.clause} ORDER BY op_key`)
    .all(...pred.params);
  assert.deepEqual(range2, like);
});

test("SQL L2/L3/L4 shape (no ORDER BY, set consumption): range == LIKE as sets", () => {
  const db = scratchLedger();
  ins(db, `op:${G1}:occ-1`, "attempt", "occ-1");
  ins(db, `op:${G1}:occ-2`, "attempt", "occ-2");
  ins(db, `op:${G1_NEXT_HEX}:occ-9`, "attempt", "occ-9");
  ins(db, `op:${G1}:occ-1-rel`, "attempt_release", "occ-1");
  const like = db.prepare(
    `SELECT * FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?`).all(`op:${G1}:%`)
    .map(r => r.op_key).sort();
  const pred = prefixRangeClause("op_key", `op:${G1}:`);
  const range = db.prepare(
    `SELECT * FROM ledger_ops WHERE kind = 'attempt' AND ${pred.clause}`).all(...pred.params)
    .map(r => r.op_key).sort();
  assert.deepEqual(range, like);
  assert.deepEqual(range, [`op:${G1}:occ-1`, `op:${G1}:occ-2`]);
});

test("SQL adversarial: a metacharacter in the grant id — LIKE over-matches, range is exact", () => {
  const db = scratchLedger();
  const gUnder = "grant:x_y";   // hypothetical id containing '_'
  const gZ = "grant:xzy";       // differs exactly at the '_' position
  ins(db, `op:${gUnder}:occ-1`, "attempt", "mine");
  ins(db, `op:${gZ}:occ-2`, "attempt", "not-mine");
  const like = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?`)
    .all(`op:${gUnder}:%`).map(r => JSON.parse(r.detail_json).occurrenceId).sort();
  // The old construction's documented over-reach: '_' matches 'z'.
  assert.deepEqual(like, ["mine", "not-mine"]);
  const pred = prefixRangeClause("op_key", `op:${gUnder}:`);
  const range = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${pred.clause}`)
    .all(...pred.params).map(r => JSON.parse(r.detail_json).occurrenceId);
  // The intended byte-prefix set, exactly.
  assert.deepEqual(range, ["mine"]);
  // Same for '%' in an id component.
  const gPct = "grant:p%q";
  const gPctOther = "grant:pZZq";
  ins(db, `op:${gPct}:occ-3`, "attempt", "pct-mine");
  ins(db, `op:${gPctOther}:occ-4`, "attempt", "pct-not-mine");
  const pred2 = prefixRangeClause("op_key", `op:${gPct}:`);
  const range2 = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${pred2.clause}`)
    .all(...pred2.params).map(r => JSON.parse(r.detail_json).occurrenceId);
  assert.deepEqual(range2, ["pct-mine"]);
});

test("SQL adversarial: case-variant keys — the named delta, asserted as intended", () => {
  const db = scratchLedger();
  ins(db, `op:${G1}:occ-1`, "attempt", "lower");
  ins(db, `op:${G1.toUpperCase()}:occ-2`, "attempt", "upper-sibling");
  const like = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?`)
    .all(`op:${G1}:%`).map(r => JSON.parse(r.detail_json).occurrenceId).sort();
  // SQLite LIKE without case_sensitive_like is ASCII
  // case-insensitive: the old construction matches the variant.
  assert.deepEqual(like, ["lower", "upper-sibling"]);
  const pred = prefixRangeClause("op_key", `op:${G1}:`);
  const range = db.prepare(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${pred.clause}`)
    .all(...pred.params).map(r => JSON.parse(r.detail_json).occurrenceId);
  // The range returns the intended set (machine keys are lowercase;
  // the case-variant key is a DIFFERENT grant's row, not this
  // grant's). This divergence from LIKE is the fix's documented
  // tightening, not a regression.
  assert.deepEqual(range, ["lower"]);
});

test("SQL L5 shape: follow-on COUNT identical, siblings excluded", () => {
  const db = scratchLedger();
  for (const j of ["plan:X", "plan:X:follow:1", "plan:X:follow:2", "plan:X:follow:10",
                   "plan:XY:follow:1", "plan:X:follow:"])
    db.prepare(`INSERT INTO jobs (job_id) VALUES (?)`).run(j);
  const likeN = db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE job_id LIKE ?`)
    .get("plan:X:follow:%").n;
  const pred = prefixRangeClause("job_id", "plan:X:follow:");
  const rangeN = db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE ${pred.clause}`)
    .get(...pred.params).n;
  // 'plan:X:follow:' (the bare prefix as a key) counts under both
  // constructions — LIKE's % matches empty, the range includes its
  // lower bound; byte-identical behaviour, asserted as-is.
  assert.equal(likeN, 4);
  assert.equal(rangeN, likeN);
});

// ----------------------------------------------------------------
// Part C — the patched coordinator paths end to end (L2, L3, L4,
// L5 consumption unchanged).
// ----------------------------------------------------------------

test("L3 handleReport: a report closes its grant — unreported granted occurrences return to pending", async () => {
  const objects = new Map([["key-o1", { format: "mp3", identity: "fp-o1", sha: "a1" }]]);
  const h = makeHarness({ probe: makeProbe(objects) });
  await submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2"), occ("o3")]);
  const g = await h.coord.requestGrant("job-1");
  assert.equal(g.ok, true);
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }] });
  assert.equal(rep.ok, true);
  const view = h.coord.jobView("job-1");
  // o2/o3 were dispatched (attempt rows exist under the grant's
  // prefix) but unreported: the L3 sweep found them via the range
  // scan and deferred them.
  assert.equal(view.occurrences.find(o => o.occurrence_id === "o1").state, "ready");
  assert.equal(view.occurrences.find(o => o.occurrence_id === "o2").state, "pending");
  assert.equal(view.occurrences.find(o => o.occurrence_id === "o3").state, "pending");
  assert.equal(h.rows("grants")[0].state, "reported");
});

test("L4 lease delivered branch: expiry marks exactly the grant's dispatched occurrences unknown", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  await submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  await submit(h.coord, "c2", "job-2", [occ("o9")]);
  const g = await h.coord.requestGrant("job-1");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  // Job-2's grant is issued two minutes later so its lease is NOT
  // due when job-1's lease fires.
  h.advance(120000);
  await h.coord.requestGrant("job-2");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  const lease = h.rows("schedule").find(r => r.kind === "lease" && r.ref === g.grantId);
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  const v1 = h.coord.jobView("job-1");
  assert.deepEqual(v1.occurrences.map(o => o.state), ["outcome_unknown", "outcome_unknown"]);
  // The other grant's occurrence is untouched by this grant's sweep.
  const v2 = h.coord.jobView("job-2");
  assert.equal(v2.occurrences[0].state, "granted");
});

test("L2 _voidDispatch: an undelivered dispatch voids, releasing each attempt exactly once", async () => {
  const h = makeHarness({ probe: makeProbe(new Map(), () => null) });
  h.env.sendGrant = undefined; // no queue handler: never delivered
  await submit(h.coord, "c1", "job-1", [occ("o1"), occ("o2")]);
  const g = await h.coord.requestGrant("job-1");
  assert.equal(g.ok, true);
  const lease = h.rows("schedule").find(r => r.kind === "lease" && r.state === "pending");
  h.setNow(lease.due_at + 1000);
  await h.coord.alarm();
  assert.equal(h.rows("grants")[0].state, "voided");
  const attempts = h.rows("ledger_ops").filter(r => r.kind === "attempt");
  const releases = h.rows("ledger_ops").filter(r => r.kind === "attempt_release");
  assert.equal(attempts.length, 2);
  assert.equal(releases.length, 2); // exactly one rel:<op_key> per attempt
  assert.deepEqual(releases.map(r => r.op_key).sort(),
    attempts.map(r => "rel:" + r.op_key).sort());
  assert.deepEqual(h.coord.jobView("job-1").occurrences.map(o => o.state),
    ["pending", "pending"]);
  assert.equal(h.coord.quotaView().attemptsToday, 0);
});

test("L5 repair chain: follow-on numbering counts this job's existing follow-ons (prior >= 1)", async () => {
  const objects = new Map([
    ["key-o1", { format: "mp3", identity: "fp-o1", sha: "a1" }],
    ["key-o2", { format: "mp3", identity: "fp-o2", sha: "a2" }],
    ["key-o3", { format: "mp3", identity: "fp-o3", sha: "a3" }],
  ]);
  const h = makeHarness({ probe: makeProbe(objects) });
  const repair = (cid, jobId, occs) => h.coord.handleCommand({ command_id: cid,
    type: "RequestRepair", payload: { jobId, bookId: "book-1", chapterIndex: 2,
      lane: "standard", occurrences: occs, data: { estMicroCents: 1000 } } });
  await repair("r1", "repair-1", [occ("o1")]);
  await repair("r2", "repair-2", [occ("o3")]);
  const g = await h.coord.requestGrant("repair-1");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  const rep = await h.coord.handleReport({ grantId: g.grantId, jobRevision: 2,
    results: [{ occurrenceId: "o1", outcome: "success", revisionKey: "fp-o1", cacheKey: "key-o1" }],
    detail: { followOn: { occurrences: [occ("o2")] } } });
  assert.equal(rep.ok, true);
  assert.ok(h.coord.jobView("repair-1:follow:1"), "first follow-on numbered 1");
  const followGrant = h.rows("grants").find(x => x.job_id === "repair-1:follow:1");
  await h.coord.drainOutbox(x => h.sentGrants.push(x));
  // Follow-ons nest: children of "repair-1:follow:1" are numbered
  // under ITS prefix ("repair-1:follow:1:follow:<n>"). Seed one
  // pre-existing chain child (a clone of the follow job's own row)
  // so the count the L5 range scan must return is prior = 1.
  const frow = h.rows("jobs").find(j => j.job_id === "repair-1:follow:1");
  const cols = Object.keys(frow);
  h.db.prepare(`INSERT INTO jobs (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
    .run(...cols.map(c => (c === "job_id" ? "repair-1:follow:1:follow:1" : frow[c])));
  const rep2 = await h.coord.handleReport({ grantId: followGrant.grant_id,
    results: [{ occurrenceId: "o2", outcome: "success", revisionKey: "fp-o2", cacheKey: "key-o2" }],
    detail: { followOn: { occurrences: [occ("o3")] } } });
  assert.equal(rep2.ok, true);
  // The range count saw the seeded child (prior = 1) and numbered
  // the new job :follow:2 under the parent job's prefix — and the
  // sibling job repair-2's existence did not inflate the count.
  assert.ok(h.coord.jobView("repair-1:follow:1:follow:2"),
    "chain child numbered 2 after the seeded prior");
  assert.equal(h.coord.jobView("repair-2:follow:1"), null);
});

// ----------------------------------------------------------------
// Part D — finalizer equivalence (L1 in situ): classification and
// precondition digest byte-identical to the LIKE build.
//
// OLD_BUILD_DIGEST was captured from the UNPATCHED live-build tree
// (408f9149 sources, finalizer-build/worker-build) by running
// deriveGrantFinalizationState over the identical Fixture S seed
// before the patch existed; it is the LIKE implementation's digest
// for this state. The patched derivation must reproduce it exactly,
// and the patched finalizer ACTION must accept it as the expected
// precondition digest (the action re-derives in-transaction through
// the same §4.3.5 range scan).
// ----------------------------------------------------------------

const OLD_BUILD_DIGEST = "00db68a8d8a2cb7350f16064f933b4f33b6438659c554a05d9cd48f4e1f53674";

function seedStalledWorld(opts = {}) {
  const h = makeHarness({
    startMs: T0,
    extraEnv: { OPALREADER_V2_SCOPE: "production", GENERATION_HALT: "0" },
  });
  const store = createGenStore(h.coord);
  seedStalledState(h.coord, store, opts);
  return { coord: h.coord, store, harness: h };
}

test("L1 equivalence: Fixture S classification + precondition digest identical to the LIKE build", () => {
  const w = seedStalledWorld();
  const d = deriveGrantFinalizationState(w.coord, w.store, { grantId: GRANT });
  assert.equal(d.classification, "finalizable");
  assert.equal(d.digest, OLD_BUILD_DIGEST);
  const p = previewGrantFinalization(w.coord, w.store, { grantId: GRANT });
  assert.equal(p.outcome, "preview");
  assert.equal(p.preconditionDigest, OLD_BUILD_DIGEST);
});

test("L1 equivalence: unarmed Fixture S refuses identically to the LIKE build", () => {
  const w = seedStalledWorld({ armQuota: false });
  const d = deriveGrantFinalizationState(w.coord, w.store, { grantId: GRANT });
  assert.equal(d.classification, "refused");
  assert.equal(d.reason, "grant_finalization_quota_unarmed");
});

test("L1 equivalence: the §4.3.5 row set — literal old LIKE vs the patched range, on Fixture S", () => {
  const w = seedStalledWorld();
  const oldRows = w.coord._all(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND op_key LIKE ?
      ORDER BY op_key`, `op:${GRANT}:%`);
  const pred = prefixRangeClause("op_key", `op:${GRANT}:`);
  const newRows = w.coord._all(
    `SELECT detail_json FROM ledger_ops WHERE kind = 'attempt' AND ${pred.clause}
      ORDER BY op_key`, ...pred.params);
  assert.equal(oldRows.length, 8);
  assert.deepEqual(newRows, oldRows);
});

test("L1 equivalence: the patched finalizer action accepts the LIKE build's digest", () => {
  const w = seedStalledWorld();
  const r = finalizeGrant(w.coord, w.store, {
    grantId: GRANT, planId: PLAN, jobId: JOB,
    authorizationRef: AUTH_REF, expectedPreconditionDigest: OLD_BUILD_DIGEST,
  });
  assert.equal(r.outcome, "applied");
  const after = deriveGrantFinalizationState(w.coord, w.store, { grantId: GRANT });
  assert.equal(after.classification, "already_finalized");
});
