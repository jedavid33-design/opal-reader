// S1 ENFORCEMENT BATTERY — the offline verification battery for the
// WS1 S1 build (spec: GENERATION-TURNON-S1-BUILD-SPEC.md §3, pin
// f61f46e6...; Rowan's R1 items 1–8 as named tests, plus the
// T-BOOTSTRAP ordering support case).
//
// The change under test is ONE branch in the candidate tree's
// v2/generation/service.mjs (admitPhaseRegistry): in an
// enforcement-bound construction, an unbound book submitting with
// no phase is refused { outcome: "rejected",
// reason: "book_not_onboarded" } instead of being admitted
// phase-null. Everything else is regression.
//
// Runs on the house harness (real node:sqlite, .one() THROWS with
// production semantics, statement-matching SQL fault injector).
// The harness world is ENFORCEMENT-bound by default
// (OPALREADER_PHASE_POLICY "enforce", GENERATION_HALT "1", the
// service constructed with phasePolicyMode: "enforce").
// Local only: no network, no production calls, synthetic content.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeWorld, BOOK, PHASE } from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = process.env.S1_TREE_DIR || join(HERE, "..", "candidate-tree");

// The unbound fixture book: content seeded, never phase-bound.
const UNBOUND = "book-unbound-fixture";
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// Seed synthetic content for one book (the harness seed's shape:
// one chapter, N Narrator segments with placeholder text only).
function seedBookContent(w, bookId, segCount, occPrefix) {
  const segs = Array.from({ length: segCount }, (_, i) => ({
    occurrenceId: `${occPrefix}${String(i + 1).padStart(12, "0")}`,
    text: "x".repeat(400), pov: "Narrator",
  }));
  const data = {
    chapters: [{ chapterId: "ch-0", index: 0, segments: segs }],
    povs: [{
      id: "pov-narrator", name: "Narrator",
      voice: { provider: "gemini", voice_id: "Zephyr",
               model_id: "gemini-3.8-flash-tts" },
    }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  w.db.prepare(`INSERT INTO sync_entities
      (family, entity_key, book_id, revision, deleted, data_json)
      VALUES ('content', ?, ?, 1, 0, ?)`)
    .run(bookId, bookId, JSON.stringify(data));
  return segs.map((s) => s.occurrenceId);
}

// An enforcement world with the FP-shaped registry established
// (PHASE bound to BOOK) and content for both fixture books.
async function seededWorld() {
  const w = await makeWorld(TREE);
  w.store.ensureSchema();
  seedBookContent(w, BOOK, 2, "0cc00000-0000-4000-8000-");
  seedBookContent(w, UNBOUND, 3, "0dd00000-0000-4000-8000-");
  const bind = w.service.bindPhaseBook({
    phase: PHASE, bookId: BOOK, authorizationRef: "battery:s1-seed",
  });
  assert.equal(bind.outcome, "applied");
  return w;
}

// Full-store snapshot: every user table's full contents, canonically
// ordered, as one JSON string (plus its sha256 for the log). Any
// write anywhere in the store changes the string.
function snapshotDb(db) {
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' ORDER BY name`).all()
    .map((r) => r.name);
  const dump = {};
  for (const t of tables) {
    const rows = db.prepare(`SELECT * FROM "${t}"`).all()
      .map((r) => JSON.stringify(r)).sort();
    dump[t] = rows;
  }
  return JSON.stringify(dump);
}

describe("S1 enforcement battery", () => {

  test("T-BOUND — bound book admitted; plan stores the DERIVED phase", async () => {
    const w = await seededWorld();
    const before = w.service.listPlans({ limit: 50 }).plans.length;
    const r = await w.service.submitIntent({
      commandId: "s1-t-bound", bookId: BOOK, scope: "chapter",
      chapterIndex: 0, phase: PHASE,
    });
    assert.ok(r.planId, `expected a plan, got ${JSON.stringify(r)}`);
    assert.equal(r.created, true);
    const plans = w.service.listPlans({ limit: 50 }).plans;
    assert.equal(plans.length, before + 1);
    const row = w.db.prepare(
      `SELECT phase, book_id FROM d6_plans WHERE plan_id = ?`)
      .get(r.planId);
    console.log(`T-BOUND evidence: planId=${r.planId} stored phase=${row.phase} book=${row.book_id}`);
    assert.equal(row.phase, PHASE); // derived from the binding row
    assert.equal(row.book_id, BOOK);
  });

  test("T-UNBOUND-NAMED — unbound book, named phase: pre-existing refusals unchanged", async () => {
    const w = await seededWorld();
    const r1 = await w.service.submitIntent({
      commandId: "s1-t-un-1", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: PHASE, // budgeted, bound to BOOK
    });
    assert.deepEqual(r1, { outcome: "rejected", reason: "phase_bound_to_other_book" });
    const r2 = await w.service.submitIntent({
      commandId: "s1-t-un-2", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: "phase-invented-fixture",
    });
    assert.deepEqual(r2, { outcome: "rejected", reason: "phase_not_budgeted" });
    // phase_unbound is NOT exercised: unreachable with the one-entry
    // budget constant (spec §1.3 row 8) — carried by the source table.
    console.log("T-UNBOUND-NAMED evidence: phase_bound_to_other_book + phase_not_budgeted, byte-identical to pre-change behavior");
  });

  test("T-NULL-REFUSAL — unbound book, null phase (and phase omitted): book_not_onboarded", async () => {
    const w = await seededWorld();
    const r1 = await w.service.submitIntent({
      commandId: "s1-t-null-1", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: null,
    });
    assert.deepEqual(r1, { outcome: "rejected", reason: "book_not_onboarded" });
    // The app's actual path for such a book: the field omitted (the
    // destructure defaults it to null).
    const r2 = await w.service.submitIntent({
      commandId: "s1-t-null-2", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0,
    });
    assert.deepEqual(r2, { outcome: "rejected", reason: "book_not_onboarded" });
    console.log("T-NULL-REFUSAL evidence: both the explicit-null and field-omitted calls refused book_not_onboarded");
  });

  test("T-NO-MUTATION — the refusal moves nothing (full-store byte identity)", async () => {
    const w = await seededWorld();
    // A non-trivial store: one admitted FP plan standing.
    const admitted = await w.service.submitIntent({
      commandId: "s1-t-nm-seed", bookId: BOOK, scope: "chapter",
      chapterIndex: 0, phase: PHASE,
    });
    assert.ok(admitted.planId);
    const before = snapshotDb(w.db);
    const beforeHash = sha256(before);
    const r = await w.service.submitIntent({
      commandId: "s1-t-nm", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: null,
    });
    assert.deepEqual(r, { outcome: "rejected", reason: "book_not_onboarded" });
    const after = snapshotDb(w.db);
    const afterHash = sha256(after);
    const counts = JSON.parse(after);
    console.log(`T-NO-MUTATION evidence: snapshot sha256 before=${beforeHash}`);
    console.log(`T-NO-MUTATION evidence: snapshot sha256 after =${afterHash}`);
    console.log(`T-NO-MUTATION evidence: d6_plans rows=${counts.d6_plans.length} (the one seeded FP plan); watermarks/accounting tables inside the identical snapshot`);
    assert.equal(after, before); // no plan, ledger, quota, epoch, or watermark movement
  });

  test("T-QUOTE-OPEN — eligibility quotes remain available for the unbound book", async () => {
    const w = await seededWorld();
    const q1 = await w.service.eligibilityQuote({ bookId: UNBOUND, scope: "book" });
    assert.equal(q1.eligibleCount, 3);
    assert.ok(q1.expectedCostMicroCents > 0);
    assert.ok(q1.totalChars > 0);
    const r = await w.service.submitIntent({
      commandId: "s1-t-quote", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: null,
    });
    assert.deepEqual(r, { outcome: "rejected", reason: "book_not_onboarded" });
    const q2 = await w.service.eligibilityQuote({ bookId: UNBOUND, scope: "book" });
    const strip = ({ quotedAt, ...rest }) => rest;
    assert.deepEqual(strip(q2), strip(q1)); // identical before and after the refusal
    console.log(`T-QUOTE-OPEN evidence: eligibleCount=${q1.eligibleCount} expectedCostMicroCents=${q1.expectedCostMicroCents} totalChars=${q1.totalChars} digest=${q1.digest}`);
  });

  test("T-LEGACY — a legacy construction over the SAME coordinator still admits phase-null", async () => {
    const w = await seededWorld();
    const serviceMod = await import(
      pathToFileURL(join(TREE, "v2/generation/service.mjs")).href);
    const planeMod = await import(
      pathToFileURL(join(TREE, "v2/generation/content-plane-adapter.mjs")).href);
    const constantsMod = await import(
      pathToFileURL(join(TREE, "v2/generation/gen-constants.mjs")).href);
    const bucket = {
      async head() { return null; },
      async get() { return null; },
      async put() { return {}; },
      async list() { return { objects: [], truncated: false }; },
    };
    const legacy = serviceMod.createGenerationService({
      coord: w.coord, env: w.classEnv, store: w.store,
      sources: planeMod.createCoordinatorPlaneSource(w.coord),
      expectedStorageBase: constantsMod.RECORDED_STORAGE_BASE,
      recountBucket: bucket,
      phasePolicyMode: "legacy", quarantineMode: "enforce",
    });
    const r = await legacy.submitIntent({
      commandId: "s1-t-legacy", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: null,
    });
    assert.ok(r.planId, `expected admission under legacy construction, got ${JSON.stringify(r)}`);
    const row = w.db.prepare(
      `SELECT phase FROM d6_plans WHERE plan_id = ?`).get(r.planId);
    assert.equal(row.phase, null); // the sanctioned fixture behavior survives
    console.log(`T-LEGACY evidence: legacy construction admitted planId=${r.planId} with stored phase=null over the same coordinator`);
  });

  test("T-REGRESSION — the lane fence precedes admission; batch still refused", async () => {
    const w = await seededWorld();
    const r1 = await w.service.submitIntent({
      commandId: "s1-t-reg-1", bookId: BOOK, scope: "chapter",
      chapterIndex: 0, phase: PHASE, lane: "batch",
    });
    assert.deepEqual(r1, { outcome: "rejected", reason: "lane_not_allowed" });
    // Ordering proof: even for the UNBOUND book with null phase, the
    // lane fence (:857) fires before admission (:861) — the new
    // branch never leaks ahead of it.
    const r2 = await w.service.submitIntent({
      commandId: "s1-t-reg-2", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: null, lane: "batch",
    });
    assert.deepEqual(r2, { outcome: "rejected", reason: "lane_not_allowed" });
    console.log("T-REGRESSION evidence: lane_not_allowed for batch on both the bound and the unbound/null-phase intent");
  });

  test("T-THROWSAFE — an unreadable registry fails closed (sentinel identity, nothing created)", async () => {
    const w = await seededWorld();
    const sentinel = new Error("s1-throwsafe-sentinel");
    w.faults.sql = { match: (q) => q.includes("d6_phase_bindings"), error: sentinel };
    let caught = null;
    try {
      await w.service.submitIntent({
        commandId: "s1-t-throw", bookId: BOOK, scope: "chapter",
        chapterIndex: 0, phase: PHASE, // the BOUND book: the read precedes any verdict
      });
    } catch (e) { caught = e; }
    assert.equal(caught, sentinel); // thrown identity (===), never coerced to an admission
    const plans = w.db.prepare(`SELECT COUNT(*) AS n FROM d6_plans`).get().n;
    assert.equal(plans, 0);
    w.faults.sql = null; // disarm: the fault was test-side only
    const r = await w.service.submitIntent({
      commandId: "s1-t-throw-2", bookId: BOOK, scope: "chapter",
      chapterIndex: 0, phase: PHASE,
    });
    assert.ok(r.planId);
    console.log("T-THROWSAFE evidence: sentinel propagated by identity; zero plans while faulted; same intent admitted after disarm");
  });

  test("T-BOOTSTRAP — the bootstrap gate precedes the branch; the branch arms when the registry establishes", async () => {
    const w = await makeWorld(TREE); // fresh world: NO binding recorded
    w.store.ensureSchema();
    seedBookContent(w, UNBOUND, 1, "0dd00000-0000-4000-8000-");
    const r1 = await w.service.submitIntent({
      commandId: "s1-t-boot-1", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: null,
    });
    assert.deepEqual(r1, { outcome: "rejected", reason: "phase_binding_required" });
    const bind = w.service.bindPhaseBook({
      phase: PHASE, bookId: BOOK, authorizationRef: "battery:s1-boot",
    });
    assert.equal(bind.outcome, "applied");
    const r2 = await w.service.submitIntent({
      commandId: "s1-t-boot-2", bookId: UNBOUND, scope: "chapter",
      chapterIndex: 0, phase: null,
    });
    assert.deepEqual(r2, { outcome: "rejected", reason: "book_not_onboarded" });
    console.log("T-BOOTSTRAP evidence: phase_binding_required while the registry is empty; book_not_onboarded for the identical intent once established");
  });
});
