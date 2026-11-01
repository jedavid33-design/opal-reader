// Shared Fixture S for the grant-finalizer suites: the
// LIVE-SHAPED stalled Chapter 3 Phase A state (exact production
// identities and values from the Phase A execution record),
// seeded by direct SQL into any coordinator + gen store pair.
// Structural metadata only — no segment text anywhere.
import { createGenStore } from "../../worker/generation/genstore.mjs";
import { ensureQuotaSchema } from "../../worker/generation/quota-budget.mjs";
import { ensureParkReleaseSchema } from "../../worker/generation/park-release.mjs";

export const BOOK = "5c589095-f812-48a2-8ab2-03ba2791f2b2";
export const PLAN = "plan:e377a5559961b294154276b6";
export const JOB = "plan:e377a5559961b294154276b6:ch2";
export const GRANT = "grant:plan:e377a5559961b294154276b6:ch2:1:full";
export const PARKED_JOB = "1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a";
export const DAY = "2026-10-31";
export const T0 = Date.UTC(2026, 10, 1, 3, 0, 0); // Oct 31 2026, PT afternoon
export const AUTH_REF = "julie-gate-3-authorization-fixture";

export const BOUND3 = [
  "6bd358a7-f590-4c49-8c07-dacf558c2721",
  "16e860aa-66c5-4a1a-a06b-ae0931b06bc3",
  "467174dd-eb2f-4430-83ef-44c8196ab159",
];
// The 23 eligible occurrences in plan (chapter) order, idx 3..25.
export const ELIGIBLE = [
  "81881ab7-fe99-4feb-98f6-bcbf7fc7e2a4", "72672ef5-8481-403b-ba97-f5c1dc0e4a77",
  "c731c8e7-4d18-4f59-bd73-f3c42a093063", "e651189e-9085-4590-ba4a-f0af18d24287",
  "05941584-5669-4ea9-91e7-59a5397f46c4", "94f6f847-7ded-470e-9a1d-577951c3a496",
  "5f6ca428-524d-448a-8fbf-a773dfc132e6", "962bc05c-666e-4967-aee2-d2bdd4283084",
  "4e163ba6-87d6-467f-a8a7-52a0062ca69e", "4746f9a6-9f05-4a65-a175-83b24f8d539a",
  "e98450a5-2ee3-4ac7-bdcf-9226749b8000", "e51a7f03-eb79-4500-965f-f3f77efad254",
  "7fa865b8-ed32-4b8c-ae37-fd2d71cba0f6", "338676cd-63fa-409d-8e42-e13c28636de3",
  "9150d43c-a37a-4bbf-af88-ec88d1669614", "635505ae-e0ff-4d38-8015-eb66357d3908",
  "b522918a-5973-4061-adaa-462460670e6a", "203af7f9-d88a-4f2a-a0fd-3f70d0a11f07",
  "b8e75022-23a0-41f2-9297-47e71f255394", "f1aba4cc-ca84-42db-9b38-1104e01fd4e0",
  "0c83bc51-7fc9-4ac7-b0ca-f81f1729a38e", "712f42d8-5460-475a-a41a-fd3e6b57d00e",
  "35ab06fd-8459-41ff-a8b7-ae4bf25be731",
];
export const FINAL26 = "2a85f74f-353d-4c25-a86a-4a4db392868b";
// The eight grant targets, in plan order, with attempt counts.
export const TARGET_COUNTS = new Map([
  ["05941584-5669-4ea9-91e7-59a5397f46c4", 4],
  ["5f6ca428-524d-448a-8fbf-a773dfc132e6", 6],
  ["4e163ba6-87d6-467f-a8a7-52a0062ca69e", 6],
  ["4746f9a6-9f05-4a65-a175-83b24f8d539a", 6],
  ["338676cd-63fa-409d-8e42-e13c28636de3", 6],
  ["203af7f9-d88a-4f2a-a0fd-3f70d0a11f07", 6],
  ["0c83bc51-7fc9-4ac7-b0ca-f81f1729a38e", 4],
  ["35ab06fd-8459-41ff-a8b7-ae4bf25be731", 6],
]);
export const TARGETS = ELIGIBLE.filter(id => TARGET_COUNTS.has(id));
export const PENDING = ELIGIBLE.filter(id => !TARGET_COUNTS.has(id));

// The eight committed executions with their real attempt rows
// (ids, outcomes, costs) from the Phase A stall diagnostics.
const EXECUTIONS_LITERAL = [
 {
  "executionId": "exec-3de522c3-e88e-49f7-8f72-7a4279aac7e6",
  "occurrenceId": "05941584-5669-4ea9-91e7-59a5397f46c4",
  "cacheKey": "5da475e255f1b37cfcae4033f4183eae27cd2c7588b84bf7c7c73ef6cff4daa5",
  "attempts": [
   {
    "attemptId": "att-6daa1665-3471-4f79-a691-562544bfce46",
    "outcome": "success",
    "cost": 9135,
    "upper": 15750
   },
   {
    "attemptId": "att-7f47f60f-0f3e-49d5-b0f2-cc9f18a8f2a4",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 16043
   },
   {
    "attemptId": "att-ef8e5f84-21a7-416a-8b71-242fac9f3649",
    "outcome": "success",
    "cost": 5364,
    "upper": 8685
   },
   {
    "attemptId": "att-30143d44-9d59-4c32-bd6a-1a286d7e9b80",
    "outcome": "success",
    "cost": 4212,
    "upper": 7358
   }
  ]
 },
 {
  "executionId": "exec-1204dd83-b063-4a1d-87b7-1048a55d1e69",
  "occurrenceId": "0c83bc51-7fc9-4ac7-b0ca-f81f1729a38e",
  "cacheKey": "860ecfcd7570707eb4636ee97f14b8e463bf879a3948ea10fee74c5abe9c202d",
  "attempts": [
   {
    "attemptId": "att-8a25f824-281e-4920-b784-31ae6043367d",
    "outcome": "success",
    "cost": 11412,
    "upper": 17483
   },
   {
    "attemptId": "att-5ee89b82-749c-489d-a9fc-b653bd3e7f4b",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 15772
   },
   {
    "attemptId": "att-6ee12dfb-9bc7-440f-869d-f8d6630f1014",
    "outcome": "success",
    "cost": 5076,
    "upper": 8505
   },
   {
    "attemptId": "att-051fccb4-65fd-435e-83ae-dd3923692c43",
    "outcome": "success",
    "cost": 4905,
    "upper": 7267
   }
  ]
 },
 {
  "executionId": "exec-65ef1985-a73e-430d-bb95-871051707583",
  "occurrenceId": "203af7f9-d88a-4f2a-a0fd-3f70d0a11f07",
  "cacheKey": "91a39f0adc05a97ee40c5b17250da15f9e7c62520aad20113707b1cb844810e4",
  "attempts": [
   {
    "attemptId": "att-b80dde6f-fea9-4180-9ea1-e5b2497598d2",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 13455
   },
   {
    "attemptId": "att-455cc11c-af12-42f7-b6c5-aea68bd099fc",
    "outcome": "success",
    "cost": 3996,
    "upper": 6548
   },
   {
    "attemptId": "att-b814b1b3-624a-41b8-a5d7-20c1e1d27707",
    "outcome": "success",
    "cost": 4167,
    "upper": 6908
   },
   {
    "attemptId": "att-6edd931f-eb63-4255-bd99-dfe547a8117f",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 13950
   },
   {
    "attemptId": "att-9dd2e47a-c4ef-4035-8ced-30bbd8e52a64",
    "outcome": "success",
    "cost": 3780,
    "upper": 6525
   },
   {
    "attemptId": "att-a68b6750-18ca-4d79-9277-a60dbce4af87",
    "outcome": "success",
    "cost": 4590,
    "upper": 7425
   }
  ]
 },
 {
  "executionId": "exec-b0609572-0792-472d-af40-6dfca76ccec4",
  "occurrenceId": "338676cd-63fa-409d-8e42-e13c28636de3",
  "cacheKey": "c423ea015961f3b10cdad3a6764636022eca7f651eebc7157be7fa130be25137",
  "attempts": [
   {
    "attemptId": "att-7cb0634a-e396-4ee6-b969-3acc04cfc8d0",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 17235
   },
   {
    "attemptId": "att-4303621e-41d3-4fd5-97ca-dcfdd8639916",
    "outcome": "success",
    "cost": 4428,
    "upper": 8303
   },
   {
    "attemptId": "att-90357c1b-8cac-44f8-b5cf-07b76294332b",
    "outcome": "success",
    "cost": 5382,
    "upper": 8933
   },
   {
    "attemptId": "att-56f75049-83f5-4065-b22a-1c1978b27409",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 15547
   },
   {
    "attemptId": "att-6de8ac66-8e17-4a66-a393-5e84c76f1d1c",
    "outcome": "success",
    "cost": 5499,
    "upper": 7358
   },
   {
    "attemptId": "att-00896b12-8034-4d52-8b80-e8b514b2f7fd",
    "outcome": "success",
    "cost": 4977,
    "upper": 8190
   }
  ]
 },
 {
  "executionId": "exec-7fa2dcf8-96ac-457f-9f03-a3f1a8d7c907",
  "occurrenceId": "35ab06fd-8459-41ff-a8b7-ae4bf25be731",
  "cacheKey": "2b7fbef0f2e0de6984f8d2c85947f482a9d1e60bcddf06a681ce30a1456da310",
  "attempts": [
   {
    "attemptId": "att-c80fad34-d147-4a70-97d3-939d86a500f1",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 15435
   },
   {
    "attemptId": "att-d2bc6f38-94d0-4708-9d8e-1b56a29e10ee",
    "outcome": "success",
    "cost": 4797,
    "upper": 8258
   },
   {
    "attemptId": "att-cf0d97cf-8189-44fb-8b22-24fd943aab5f",
    "outcome": "success",
    "cost": 4023,
    "upper": 7178
   },
   {
    "attemptId": "att-3593e2f5-9639-49b6-b795-9648259871f9",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 15322
   },
   {
    "attemptId": "att-d35cbdb8-a6c5-4564-a399-705d2cc124f0",
    "outcome": "success",
    "cost": 4608,
    "upper": 7065
   },
   {
    "attemptId": "att-2a17b219-3edb-4766-bda1-c3abb50bb88d",
    "outcome": "success",
    "cost": 4923,
    "upper": 8258
   }
  ]
 },
 {
  "executionId": "exec-c3ace002-46b2-49e1-98b5-4663f60d9e12",
  "occurrenceId": "4746f9a6-9f05-4a65-a175-83b24f8d539a",
  "cacheKey": "fe6075faccaf68a1f1551b2c96ef347e9368a360d3e5ea5b45b0f5462a183a8e",
  "attempts": [
   {
    "attemptId": "att-d231c9d4-dcff-4886-8c25-3d5e4f80f842",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 16628
   },
   {
    "attemptId": "att-01556314-f294-4770-ad57-5dbc3510cbf5",
    "outcome": "success",
    "cost": 5571,
    "upper": 8438
   },
   {
    "attemptId": "att-7a4003d5-8045-4623-8588-7341046ccb12",
    "outcome": "success",
    "cost": 5310,
    "upper": 8190
   },
   {
    "attemptId": "att-468190ca-af22-41df-8d89-64d56df2c2b4",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 15233
   },
   {
    "attemptId": "att-a4b50cfd-67a1-4dc6-b7f3-9005f3e95fb8",
    "outcome": "success",
    "cost": 4734,
    "upper": 8348
   },
   {
    "attemptId": "att-a05b571b-093e-4f08-ac44-8fdd4d48fb25",
    "outcome": "success",
    "cost": 4536,
    "upper": 6885
   }
  ]
 },
 {
  "executionId": "exec-3e7c3a0f-8342-46a6-a6d1-b7899a390399",
  "occurrenceId": "4e163ba6-87d6-467f-a8a7-52a0062ca69e",
  "cacheKey": "38fae69bff0dd58581a7efe4a3816a59b79665d5dc529980218ad9cad9104b33",
  "attempts": [
   {
    "attemptId": "att-97632396-a175-4588-8848-79f4297f5a7f",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 15975
   },
   {
    "attemptId": "att-49e24b1c-69f4-4fc2-b2b6-46f8aee9768c",
    "outcome": "success",
    "cost": 4554,
    "upper": 7920
   },
   {
    "attemptId": "att-b72b458b-adbd-4421-88aa-e9ee9ea24344",
    "outcome": "success",
    "cost": 4653,
    "upper": 8055
   },
   {
    "attemptId": "att-9eda403d-dc62-4579-8110-26d14ffe1f86",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 14220
   },
   {
    "attemptId": "att-2e2bc8b0-963e-4bd9-992a-351cb125b730",
    "outcome": "success",
    "cost": 3609,
    "upper": 6435
   },
   {
    "attemptId": "att-098da980-dff5-4f32-bff0-c0333d44914e",
    "outcome": "success",
    "cost": 4491,
    "upper": 7785
   }
  ]
 },
 {
  "executionId": "exec-bf78cf72-e49c-464c-97fd-f3f3ee01063d",
  "occurrenceId": "5f6ca428-524d-448a-8fbf-a773dfc132e6",
  "cacheKey": "0cc6d7ea8ba2548618650131a7e206a7baa9ea181c27be4e709cda95d10f3e5e",
  "attempts": [
   {
    "attemptId": "att-9635dc7c-0fe9-47af-a767-e18252901836",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 17843
   },
   {
    "attemptId": "att-f6a53a94-92f9-4b72-9d64-a47cc9a8285a",
    "outcome": "success",
    "cost": 6498,
    "upper": 9878
   },
   {
    "attemptId": "att-63cb77f7-9178-4348-a466-43fb599612c8",
    "outcome": "success",
    "cost": 4608,
    "upper": 7965
   },
   {
    "attemptId": "att-7b77f17e-fa7c-4dab-b3c7-16c541d0e1ed",
    "outcome": "policy_block",
    "cost": 0,
    "upper": 14805
   },
   {
    "attemptId": "att-9f167d62-5fe4-487a-a680-8ff87630c41f",
    "outcome": "success",
    "cost": 5832,
    "upper": 8955
   },
   {
    "attemptId": "att-d9b40db5-c443-4b12-9857-c275d6e3b4ad",
    "outcome": "success",
    "cost": 3294,
    "upper": 5850
   }
  ]
 }
];
export const EXECUTIONS = EXECUTIONS_LITERAL;
export const EXEC_BY_OCC = new Map(EXECUTIONS.map(e => [e.occurrenceId, e]));


export function seedStalledState(coord, store, { armQuota = true } = {}) {
  store.ensureSchema();
  // The adjudication tables bootstrap lazily inside
  // genstore.adjudicateEstimated in production; the fixture
  // creates them with the identical DDL so the straddler row can
  // be seeded.
  coord.sql.exec(`
CREATE TABLE IF NOT EXISTS d6_billing_adjudications (
  attempt_id TEXT PRIMARY KEY, plan_id TEXT, phase TEXT,
  disposition TEXT NOT NULL, estimated_cost_micro_cents INTEGER NOT NULL,
  reserved_cost_micro_cents INTEGER NOT NULL, estimate_basis TEXT NOT NULL,
  evidence_refs TEXT, authorization_ref TEXT NOT NULL, note TEXT,
  source TEXT, current_amendment INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS d6_billing_adjudication_amendments (
  attempt_id TEXT NOT NULL, amendment_seq INTEGER NOT NULL,
  kind TEXT NOT NULL, verified_outcome TEXT NOT NULL,
  verified_cost_micro_cents INTEGER NOT NULL, evidence_refs TEXT,
  authorization_ref TEXT NOT NULL, note TEXT, source TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (attempt_id, amendment_seq));`);

  ensureParkReleaseSchema(coord.sql);
  ensureQuotaSchema(coord.sql);
  const sql = coord.sql;
  const X = (q, ...p) => sql.exec(q, ...p);

  // Jobs: the parked definition job and the chapter job.
  X(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state,
       revision, data_json, created_at, updated_at)
     VALUES (?, 'job', ?, 2, 'standard', 'parked_policy', 1, '{}', ?, ?)`,
    PARKED_JOB, BOOK, T0 - 86400000, T0 - 86400000);
  X(`INSERT INTO jobs (job_id, kind, book_id, chapter_index, lane, state,
       revision, data_json, created_at, updated_at)
     VALUES (?, 'job', ?, 2, 'standard', 'generating', 2, '{}', ?, ?)`,
    JOB, BOOK, T0 - 3600000, T0 - 3000000);
  // Parked job occurrences: 3 ready + 24 pending (untouched by
  // everything in this file).
  for (const id of [...BOUND3, ...ELIGIBLE, FINAL26]) {
    const ready = BOUND3.includes(id);
    X(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state,
         cache_key, detail_json)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      PARKED_JOB, id, `fp-${id}`, ready ? "ready" : "pending",
      ready ? "a".repeat(64) : null);
  }
  // Chapter job occurrences: 8 ready (targets) + 15 pending.
  for (const id of ELIGIBLE) {
    const target = TARGET_COUNTS.has(id);
    X(`INSERT INTO occurrences (job_id, occurrence_id, revision_key, state,
         cache_key, detail_json)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      JOB, id, `fp-${id}`, target ? "ready" : "pending",
      target ? EXEC_BY_OCC.get(id).cacheKey : null);
  }
  // Bindings for the eight targets, matching the executions.
  // D6 commits bind under the payload fingerprint as revision
  // key (the d6-integration identity rule): revision_key ==
  // cache_key == the execution's cache key.
  for (const id of TARGETS) {
    X(`INSERT INTO bindings (occurrence_id, revision_key, cache_key,
         provenance, bound_at) VALUES (?, ?, ?, 'd6', ?)`,
      id, EXEC_BY_OCC.get(id).cacheKey, EXEC_BY_OCC.get(id).cacheKey,
      T0 - 2400000);
  }
  // Grant, claim, outbox, ledger ops.
  X(`INSERT INTO grants (grant_id, job_id, revision, state, created_at,
       lease_expires_at, report_json)
     VALUES (?, ?, 2, 'issued', ?, ?, NULL)`, GRANT, JOB, T0 - 3000000, T0 - 2100000);
  X(`INSERT INTO claims (grant_id, state, consumer_id, claimed_at,
       closed_reason, updated_at)
     VALUES (?, 'claimed', 'd6-executor', ?, NULL, ?)`,
    GRANT, T0 - 3000000, T0 - 3000000);
  const outboxOrder = [...TARGETS].sort();
  X(`INSERT INTO outbox (id, kind, payload_json, created_at, sent_at,
       send_attempted_at) VALUES (?, 'dispatch', ?, ?, ?, ?)`,
    GRANT, JSON.stringify({ grantId: GRANT, jobId: JOB, occurrences: outboxOrder }),
    T0 - 3000000, T0 - 2990000, T0 - 2990000);
  for (const id of TARGETS) {
    X(`INSERT INTO ledger_ops (op_key, at, day_key, month_key, kind,
         est_micro_cents, detail_json)
       VALUES (?, ?, ?, '2026-10', 'attempt', 19652, ?)`,
      `op:${GRANT}:${id}`, T0 - 3000000, DAY,
      JSON.stringify({ jobId: JOB, occurrenceId: id }));
  }
  // Plans: the stalled chapter plan + the two prior FP plans.
  const planRow = (planId, intentKey, state, created) => X(
    `INSERT INTO d6_plans (plan_id, intent_key, book_id, scope, keep_going,
       phase, lane, state, stop_reason, eligible_digest, created_at, updated_at)
     VALUES (?, ?, ?, 'chapter', 0, 'forever-pucked', 'standard', ?, NULL, ?, ?, ?)`,
    planId, intentKey, BOOK, state, "d6".repeat(32), created, created);
  planRow(PLAN, "fresh-ch3-20261031-fp-chapter3-v1", "active", T0 - 3600000);
  planRow("plan:b2dc2a3d1cd367a0245b9102", "fresh-ch2-20261031-fp-chapter2-v1",
    "complete", T0 - 86400000);
  planRow("plan:603ab416bd67ab1b25de97be", "retired-ch2-plan", "retired",
    T0 - 2 * 86400000);
  X(`INSERT INTO d6_plan_jobs (plan_id, job_id, chapter_index, seq)
     VALUES (?, ?, 2, 1)`, PLAN, JOB);
  // Plan entries: positions 65..91 (chapter idx 0..26).
  const all = [...BOUND3, ...ELIGIBLE, FINAL26];
  all.forEach((id, i) => {
    const disposition = BOUND3.includes(id) ? "bound_already"
      : id === FINAL26 ? "excluded_parked" : "eligible";
    X(`INSERT INTO d6_plan_entries (plan_id, occurrence_id, book_id,
         chapter_id, chapter_index, position, pov_key, char_count,
         upper_micro_cents, disposition, job_id)
       VALUES (?, ?, ?, 'fp-chapter-3', ?, ?, 'narrator', 1400, 31500, ?, ?)`,
      PLAN, id, BOOK, 2, 65 + i, disposition,
      disposition === "eligible" ? JOB : PARKED_JOB);
  });
  // Prior settled attempts: 579,339 across the complete Ch 2 plan.
  let seq = 1;
  const priorCosts = [...Array(17).fill(32185), 32194];
  priorCosts.forEach((cost, i) => {
    X(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
         occurrence_id, seq, phase, outcome, cost_micro_cents,
         upper_micro_cents, created_at, updated_at)
       VALUES (?, ?, 'plan:b2dc2a3d1cd367a0245b9102',
         ?, ?, 'confirmed', 'success', ?, ?, ?, ?)`,
      `att-prior-ch2-${i}`, `exec-prior-ch2-${i}`, `ch2-occ-${i}`, seq++, cost,
      cost, T0 - 86400000, T0 - 86400000);
  });
  // The adjudicated straddler (never settled; estimate + reserved
  // live only in the adjudication row).
  X(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
       occurrence_id, seq, phase, outcome, cost_micro_cents,
       upper_micro_cents, created_at, updated_at)
     VALUES ('att-37d63768-db4b-447d-8150-580b7c6ee257',
       'exec-6a9c4e14-2223-4806-9694-90cd140cbd8e',
       'plan:603ab416bd67ab1b25de97be',
       '59acff00-d6a4-4e2b-9734-34d50f4f59f0', ?,
       'confirmed', 'estimated_unverified', NULL, 5648, ?, ?)`,
    seq++, T0 - 86400000, T0 - 86400000);
  X(`INSERT INTO d6_billing_adjudications (attempt_id, plan_id, phase,
       disposition, estimated_cost_micro_cents, reserved_cost_micro_cents,
       estimate_basis, evidence_refs, authorization_ref, note, source,
       current_amendment, created_at)
     VALUES ('att-37d63768-db4b-447d-8150-580b7c6ee257',
       'plan:603ab416bd67ab1b25de97be', 'forever-pucked',
       'estimated_unverified', 19018, 5648, 'flat_estimate', '[]',
       'julie-gate-5', NULL, 'operator', 0, ?)`, T0 - 86400000);
  // The eight committed executions + their 44 confirmed attempts +
  // 44 dispatch rows + 8 open reservations.
  for (const ex of EXECUTIONS) {
    X(`INSERT INTO d6_execution_records (execution_id, plan_id, job_id,
         grant_id, occurrence_id, state, cache_key, detail_json, created_at,
         updated_at) VALUES (?, ?, ?, ?, ?, 'committed', ?, '{}', ?, ?)`,
      ex.executionId, PLAN, JOB, GRANT, ex.occurrenceId, ex.cacheKey,
      T0 - 3000000, T0 - 2400000);
    for (const a of ex.attempts) {
      X(`INSERT INTO d6_attempt_log (attempt_id, execution_id, plan_id,
           occurrence_id, seq, phase, outcome,
           cost_micro_cents, upper_micro_cents, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`,
        a.attemptId, ex.executionId, PLAN, ex.occurrenceId,
        seq++, a.outcome, a.cost, a.upper, T0 - 2500000, T0 - 2500000);
      X(`INSERT INTO d6_provider_dispatches (attempt_id,
           grant_id, occurrence_id, plan_id, execution_id,
           dispatch_day_key, dispatched_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        a.attemptId, GRANT, ex.occurrenceId, PLAN, ex.executionId,
        DAY, T0 - 2500000);
    }
    X(`INSERT INTO d6_grant_reservations (reservation_id, grant_id, plan_id,
         job_id, occurrence_id, day_key, slots_total, slots_consumed, state,
         close_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 12, ?, 'open', NULL, ?, ?)`,
      `qres:${GRANT}:${ex.occurrenceId}:${DAY}`, GRANT, PLAN, JOB,
      ex.occurrenceId, DAY, ex.attempts.length, T0 - 3000000, T0 - 3000000);
  }
  // Park release: releaseId 1, live, covering exactly the 23
  // eligible ids (never the final occurrence).
  X(`INSERT INTO d6_park_releases (job_id, book_id, chapter_index,
       occurrence_ids_json, authorization_ref, source, note, released_at,
       state)
     VALUES (?, ?, 2, ?, 'julie-phase-a-go', 'operator', NULL, ?, 'live')`,
    PARKED_JOB, BOOK, JSON.stringify(ELIGIBLE), T0 - 3600000);
  // Phase state + sync watermarks.
  X(`INSERT INTO d6_phase_state (phase, halted_unknown_billing, updated_at)
     VALUES ('forever-pucked', 0, ?)`, T0);
  X(`UPDATE sync_family_state SET tip = 1826 WHERE family = 'bindings'`);
  X(`UPDATE sync_family_state SET tip = 18 WHERE family = 'content'`);
  if (armQuota) {
    X(`INSERT INTO meta (key, value) VALUES ('d6_quota_bootstrapped_at', ?)`,
      JSON.stringify({ bootstrappedAt: T0 - 86400000, census: [] }));
  }
}