// A-3 BATTERY COPY of the A-1 battery harness (itself a copy of
// the containment-v4 house harness), with additive extensions
// for the scheduled drive entry (all marked "A-3 extension"):
// per-instance storage AUTHORITY with revocation (models DO
// instance replacement: a replaced instance's next storage
// access detects the loss of authority and throws — the
// platform behavior the lifecycle docs describe), spawnInstance
// over the same durable facets, a COORDINATOR namespace stub
// that records get() options (the retry finding) and can be
// re-pointed at a replacement instance, an in-memory R2 bucket
// with conditional-put semantics and a call log (richBucket),
// a deferrable queue send (an external effect initiated but not
// completed), and a fireScheduled helper driving the tree's own
// scheduled() export. The A-1 extensions and everything else are
// carried over unmodified.
// A-1 BATTERY COPY of the containment-v4 house harness, with
// additive extensions for the repair evaluation (all marked
// "A-1 extension"): the storage.sync() commitment seam
// (fault + one-shot deferral; review I-C1), a setAlarm fault switch, sql
// faults that can inspect params and fire once, and makeWorld
// db injection for the rollback test (T-36). The original
// harness is unmodified.
// Battery harness for the Phase B instrumentation candidate
// (spec §9.0). Adapted from the proven do-harness pattern
// (range-fix-build/worker-build/tests/helpers/do-harness.mjs):
// real SQLite via node:sqlite, a SqlCursor whose .one() THROWS on
// 0 or >1 rows (production DO semantics — the fake that returns
// null is exactly the divergence that hid the P8 deadlock), a
// fake clock, and crash() = a new instance over the same storage.
//
// Battery extensions (spec §9.0 items 1 and 3):
//   1. a KV facet on the storage object (get/put/delete over a
//      Map, structuredClone in and out) — the recorder's health
//      channel lives there;
//   3. a statement-matching fault injector on sql.exec plus fault
//      switches on getAlarm / KV get / KV put. A fault is an
//      object { match(query) -> bool, error } for SQL, or a bare
//      error object for the switches; the EXACT error object is
//      thrown, so tests can assert record-then-rethrow identity
//      with ===.
//
// The world builder instantiates the SHIPPED entry class
// (OpalReaderCoordinatorProd) over the harness storage with a
// stub R2 binding, following the ch2disp-route entryWorld
// pattern, and wires a COORDINATOR namespace stub so the tree's
// own public entry fetch handler can drive the class end-to-end.
//
// V3 EXTENSION (marked; containment-v3 package, async item C):
// a one-shot DEFERRED getAlarm seam for race tests. Calling
// w.deferGetAlarm() arms the NEXT storage.getAlarm() call to park
// on a promise the test releases with the value the read should
// observe. This expresses, inside the harness, the interleaving
// the async analysis traces from source: an invocation suspended
// at its getAlarm() await while a containment transition runs to
// completion. The value released models "the read was processed
// against the pre-transition registration" (a stale value, or
// null if the delete was processed first) — which branch the real
// platform takes for an in-flight read is a platform uncertainty
// listed in the analysis; the v3 gate re-check is load-bearing
// under BOTH branches, and the race tests exercise both.

import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

export class SqlCursor {
  constructor(rows) { this.rows = rows ?? []; }
  toArray() { return this.rows; }
  one() {
    if (this.rows.length !== 1)
      throw new Error(
        `Expected exactly one result, got ${this.rows.length}`);
    return this.rows[0];
  }
}

export class SqlFacade {
  constructor(db, faults) { this.db = db; this.faults = faults; }
  exec(query, ...params) {
    const f = this.faults.sql;
    if (f && f.match(query, params)) {
      if (f.once) this.faults.sql = null; // A-1 extension
      throw f.error;
    }
    if (params.length === 0 && query.includes(";")) {
      this.db.exec(query);
      return new SqlCursor([]);
    }
    const stmt = this.db.prepare(query);
    const isQuery = /^\s*(SELECT|WITH)\b/i.test(query);
    let rows = null;
    if (isQuery) rows = stmt.all(...params);
    else stmt.run(...params);
    return new SqlCursor(rows);
  }
}

export const CLIENT_TOKEN = "battery-client-token";
export const OPERATOR_TOKEN = "battery-operator-token";
export const BOOK = "book-battery";
export const PHASE = "forever-pucked";
export const OCC26 = "0cc00000-0000-4000-8000-000000000026";
export const PARKED_JOB = "battery-parked-job";
export const SETTLED_PLAN = "plan:batterysettled0000000000";
export const T0 = 1762000000000; // fixed fake epoch (ms)

export async function makeWorld(treeDir, { now = T0,
    envOverrides = {}, db: injectedDb = null,
    richBucket = false } = {}) { // A-3 extension: richBucket
  const db = injectedDb ?? new DatabaseSync(":memory:");
  const kv = new Map();
  const faults = { sql: null, getAlarm: null, kvGet: null, kvPut: null,
    deleteAlarm: null, // containment extension: deleteAlarm fault
    sync: null, setAlarm: null }; // A-1 extension (sync: review I-C1)
  let deferredGetAlarm = null; // V3 extension: one-shot race seam
  let deferredSync = null; // A-1 extension: one-shot race seam
  let deferredQueueSend = null; // A-3 extension: one-shot send seam
  let alarmAt = null;
  const alarmCalls = []; // R5a extension: every setAlarm WRITE, logged
  const alarmDeletes = []; // containment extension: every deleteAlarm
  const clock = { now };
  // A-3 extension: storage is built per AUTHORITY. All facets
  // (db, kv, alarm cell, clock, faults) are shared; each instance
  // gets its own storage object whose every operation first
  // checks its authority — once revoked (instance replacement),
  // the next storage access throws, modeling the platform's
  // authority-loss detection. The default world's authority is
  // never revoked by the harness itself.
  const makeAuthority = () => ({ revoked: false });
  const authorityError = () => {
    const e = new Error("Durable Object authority lost (instance replaced)");
    e.name = "AuthorityLostError";
    return e;
  };
  const makeStorage = (authority) => {
    const guardedSql = {
      exec(query, ...params) {
        if (authority.revoked) throw authorityError();
        return new SqlFacade(db, faults).exec(query, ...params);
      },
    };
    const check = () => {
      if (authority.revoked) throw authorityError();
    };
    return {
      sql: guardedSql,
      transactionSync(fn) {
        check();
        db.exec("BEGIN");
        try {
          const r = fn();
          db.exec("COMMIT");
          return r;
        } catch (e) {
          try { db.exec("ROLLBACK"); } catch { /* already rolled back */ }
          throw e;
        }
      },
      async setAlarm(t) {
        check();
        if (faults.setAlarm) throw faults.setAlarm; // A-1 extension
        alarmCalls.push({ value: t, at: clock.now }); alarmAt = t;
      },
      async getAlarm() {
        check();
        if (faults.getAlarm) throw faults.getAlarm;
        if (deferredGetAlarm) {
          const d = deferredGetAlarm;
          deferredGetAlarm = null;
          return d.promise;
        }
        return alarmAt;
      },
      async deleteAlarm() {
        check();
        if (faults.deleteAlarm) throw faults.deleteAlarm;
        alarmDeletes.push({ at: clock.now });
        alarmAt = null;
      },
      // A-1 extension (review I-C1): the commitment boundary —
      // storage.sync() resolves when pending writes complete.
      // The deferred seam parks the caller between its intent
      // write and its act, which is where the adversarial
      // interleavings live.
      async sync() {
        check();
        if (faults.sync) throw faults.sync;
        if (deferredSync) {
          const d = deferredSync;
          deferredSync = null;
          return d.promise;
        }
        return undefined;
      },
      async get(key) {
        check();
        if (faults.kvGet) throw faults.kvGet;
        const v = kv.get(key);
        return v === undefined ? null : structuredClone(v);
      },
      async put(key, value) {
        check();
        if (faults.kvPut) throw faults.kvPut;
        kv.set(key, structuredClone(value));
      },
      async delete(key) { check(); kv.delete(key); },
    };
  };
  const defaultAuthority = makeAuthority();
  const storage = makeStorage(defaultAuthority);
  const state = { storage };

  const imp = (rel) => import(pathToFileURL(join(treeDir, rel)).href);
  const entryMod = await imp("v2/worker-entry-prod-d6.js");
  const coordMod = await imp("v2/coordinator.mjs");
  const serviceMod = await imp("v2/generation/service.mjs");
  const genstoreMod = await imp("v2/generation/genstore.mjs");
  const planeMod = await imp("v2/generation/content-plane-adapter.mjs");
  const constantsMod = await imp("v2/generation/gen-constants.mjs");

  // A-3 extension: with richBucket, an in-memory R2 with real
  // conditional-put semantics (create-if-absent returns null on
  // an occupied key), etags, and a call log — the surface the
  // I1 flush tests and the replacement tests observe. Without
  // it, the original all-null stub, unchanged.
  let bucket;
  if (richBucket) {
    const objects = new Map();
    let etagCounter = 0;
    bucket = {
      objects, puts: [], gets: [], heads: [],
      async head(key) {
        this.heads.push(key);
        const o = objects.get(key);
        return o ? { size: o.bytes.byteLength, etag: o.etag,
          customMetadata: o.customMetadata } : null;
      },
      async get(key) {
        this.gets.push(key);
        const o = objects.get(key);
        return o ? {
          arrayBuffer: async () => o.bytes.slice().buffer,
          etag: o.etag, size: o.bytes.byteLength,
          customMetadata: o.customMetadata } : null;
      },
      async put(key, value, opts = {}) {
        this.puts.push({ key, opts });
        if (opts && opts.onlyIf &&
            opts.onlyIf.etagDoesNotMatch === "*" &&
            objects.has(key))
          return null;
        const bytes = value instanceof Uint8Array ? value
          : new Uint8Array(value);
        const etag = `etag-${++etagCounter}`;
        objects.set(key, { bytes, etag,
          customMetadata: opts.customMetadata ?? {} });
        return { etag, size: bytes.byteLength };
      },
      async list() {
        return { objects: [...objects.keys()].map((key) => ({ key })),
          truncated: false };
      },
    };
  } else {
    bucket = {
      async head() { return null; },
      async get() { return null; },
      async put() { return {}; },
      async list() { return { objects: [], truncated: false }; },
    };
  }
  const queue = { sent: [], sendCalls: 0,
    async send(m) {
      this.sendCalls += 1;
      // A-3 extension: a deferred send parks the caller AFTER
      // the invocation is counted and BEFORE the message lands —
      // an external effect initiated but not completed.
      if (deferredQueueSend) {
        const d = deferredQueueSend;
        deferredQueueSend = null;
        await d.promise;
      }
      this.sent.push(m);
    } };
  const classEnv = {
    OPALREADER_V2_SCOPE: "production",
    OPALREADER_ACCESS_TOKEN: CLIENT_TOKEN,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: OPERATOR_TOKEN,
    OPALREADER_PHASE_POLICY: "enforce",
    GENERATION_HALT: "1",
    OPALREADER_STORAGE: bucket,
    ALLOWED_ORIGIN: "https://opalreader.invalid",
    now: () => clock.now,
    ...envOverrides,
  };
  const inst = new entryMod.OpalReaderCoordinatorProd(state, classEnv);
  const coord = new coordMod.GenerationCoordinator(state, classEnv);
  const store = genstoreMod.createGenStore(coord);
  const service = serviceMod.createGenerationService({
    coord, env: classEnv, store,
    sources: planeMod.createCoordinatorPlaneSource(coord),
    expectedStorageBase: constantsMod.RECORDED_STORAGE_BASE,
    recountBucket: bucket,
    phasePolicyMode: "enforce",
    quarantineMode: "enforce",
  });
  // A-3 extension: the namespace stub records every get() call's
  // options (the retry configuration is asserted from this) and
  // fetches through the CURRENT instance, which a replacement
  // test can re-point with setCurrentInstance().
  const coordinatorGetCalls = [];
  let currentInst = inst;
  const entryEnv = {
    ...classEnv,
    COORDINATOR: {
      idFromName: (n) => n,
      get: (id, options) => {
        coordinatorGetCalls.push({ id, options });
        return { fetch: (req) => currentInst.fetch(req) };
      },
    },
    OPALREADER_GENERATION_V2: queue,
  };
  return {
    treeDir, db, kv, faults, clock, storage, state,
    entry: entryMod.default, OpalReaderCoordinatorProd:
      entryMod.OpalReaderCoordinatorProd,
    inst, coord, store, service, queue, bucket, classEnv, entryEnv,
    constants: constantsMod,
    alarmAt: () => alarmAt,
    alarmCalls, // R5a extension
    alarmDeletes, // containment extension
    seedAlarm(t) { alarmAt = t; }, // R5a extension: set registration without logging a write
    clearAlarmCalls() { alarmCalls.length = 0; }, // R5a extension
    // V3 extension: park the NEXT getAlarm() until released.
    // Returns release(value): the parked read resolves with
    // `value` (the registration the read observes).
    deferGetAlarm() {
      let release;
      const promise = new Promise((res) => { release = res; });
      deferredGetAlarm = { promise };
      return (value) => release(value);
    },
    // True while a deferred read is ARMED (not yet consumed by a
    // getAlarm call); false once a caller has parked on it.
    deferArmed: () => deferredGetAlarm !== null,
    // A-1 extension (review I-C1): park the NEXT storage
    // sync() until released. Returns release(): the parked
    // call resolves.
    deferSync() {
      let release;
      const promise = new Promise((res) => { release = res; });
      deferredSync = { promise };
      return () => release(undefined);
    },
    deferSyncArmed: () => deferredSync !== null,
    advance(ms) { clock.now += ms; },
    async fireClassAlarm() { return inst.alarm(); },
    // A new class instance over the same storage (crash/restart).
    crash() {
      return new entryMod.OpalReaderCoordinatorProd(state, classEnv);
    },
    // ---- A-3 extensions ----
    coordinatorGetCalls,
    bucketObj: bucket,
    setCurrentInstance(i) { currentInst = i; },
    currentInstance: () => currentInst,
    // A new class instance over a NEW state whose storage shares
    // every durable facet but carries its OWN authority (instance
    // replacement). Returns { inst, state, authority, revoke }.
    spawnInstance() {
      const authority = makeAuthority();
      const st = { storage: makeStorage(authority) };
      const instance = new entryMod.OpalReaderCoordinatorProd(
        st, classEnv);
      return { inst: instance, state: st, authority,
        revoke: () => { authority.revoked = true; } };
    },
    // Park the NEXT queue send until released (an external
    // effect initiated but not completed). Returns release().
    deferQueueSend() {
      let release;
      const promise = new Promise((res) => { release = res; });
      deferredQueueSend = { promise };
      return () => release(undefined);
    },
    // Drive the tree's own scheduled() export end to end.
    async fireScheduled(cron = "*/30 * * * *", scheduledTime) {
      const controller = { cron,
        scheduledTime: scheduledTime ?? clock.now };
      return entryMod.default.scheduled(controller, entryEnv, {});
    },
  };
}

// ----------------------------------------------------------------
// Structural seeding to the attempt-3 closing SHAPE (spec §9 T1):
// synthetic content (placeholder text only — no book content), a
// phase binding, the storage-base row the operator seed writes, a
// segment-scope plan submitted through the service's own intent
// path (the preserved-plan shape: active plan, single pending
// occurrence, job queued rev 1), a parked_policy job, four
// schedule_dead conflicts, and phase accounting at the attempt-3
// figures (settled 1,029,420; estimatedUnverified 19,018;
// reservedUnverified 5,648) built from synthetic attempt /
// adjudication rows.
// ----------------------------------------------------------------
export async function seedAttempt3Shape(w) {
  const { db, service, store } = w;
  store.ensureSchema();
  const now = w.clock.now;
  const segs = [{
    occurrenceId: OCC26, text: "x".repeat(569), pov: "Narrator",
  }];
  const data = {
    chapters: [{ chapterId: "ch-2", index: 2, segments: segs }],
    povs: [{
      id: "pov-narrator", name: "Narrator",
      voice: { provider: "gemini", voice_id: "Zephyr",
               model_id: "gemini-3.8-flash-tts" },
    }],
    defaultVoice: { provider: "gemini", voice_id: "Zephyr" },
  };
  db.prepare(`INSERT INTO sync_entities
      (family, entity_key, book_id, revision, deleted, data_json)
      VALUES ('content', ?, ?, 1, 0, ?)`)
    .run(BOOK, BOOK, JSON.stringify(data));
  const bind = service.bindPhaseBook({
    phase: PHASE, bookId: BOOK,
    authorizationRef: "battery:seed",
  });
  if (bind.outcome !== "applied")
    throw new Error(`seed: bindPhaseBook -> ${JSON.stringify(bind)}`);
  const base = w.constants.RECORDED_STORAGE_BASE;
  db.prepare(`INSERT INTO d6_storage_state
      (id, base_bytes, object_count, seeded_at, provenance_json,
       updated_at)
      VALUES (1, ?, ?, ?, ?, ?)`)
    .run(base.baseBytes, base.objectCount, now,
         JSON.stringify({ source: "battery-seed" }), now);
  // Mirror attempt 3's R1: the preserved plan was submitted
  // during a brief halt lift, so it was born UNMARKED (no
  // quarantine birth-mark) and then re-halted. Flip the shared
  // env for the submission only.
  w.classEnv.GENERATION_HALT = "0";
  let submitted;
  try {
    submitted = await service.submitIntent({
      commandId: "battery-submit-1", bookId: BOOK, scope: "segment",
      occurrenceId: OCC26, phase: PHASE,
    });
  } finally {
    w.classEnv.GENERATION_HALT = "1";
  }
  if (!submitted.planId)
    throw new Error(`seed: submitIntent -> ${JSON.stringify(submitted)}`);
  const planId = submitted.planId;
  const jobId = `${planId}:seg`;
  // Parked job (structural: definition JSON + occurrences).
  const parkedOccs = [0, 1, 2].map((i) => ({
    occurrenceId: `0cc00000-0000-4000-8000-00000000010${i}`,
    revisionKey: `rk-parked-${i}`, state: "pending",
  }));
  const definition = {
    kind: "job", bookId: BOOK, chapterIndex: 2, lane: "standard",
    total: parkedOccs.length, occurrences: parkedOccs,
    estMicroCents: 424242,
  };
  const canonical = (v) => {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    return `{${Object.keys(v).sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  };
  db.prepare(`INSERT INTO jobs
      (job_id, kind, book_id, chapter_index, lane, state, revision,
       data_json, created_at, updated_at)
      VALUES (?, 'job', ?, 2, 'standard', 'parked_policy', 1, ?, ?, ?)`)
    .run(PARKED_JOB, BOOK, canonical(definition), now, now);
  const occIns = db.prepare(`INSERT INTO occurrences
      (job_id, occurrence_id, revision_key, state) VALUES (?, ?, ?, ?)`);
  for (const o of parkedOccs)
    occIns.run(PARKED_JOB, o.occurrenceId, o.revisionKey, o.state);
  // Four schedule_dead conflicts (the census baseline shape).
  const confIns = db.prepare(`INSERT INTO binding_conflicts
      (at, occurrence_id, cache_key, expected, found, reason)
      VALUES (?, ?, 'lease', '7', ?, 'schedule_dead')`);
  for (let i = 0; i < 4; i++)
    confIns.run(now - (4 - i) * 1000, jobId,
      "LIKE or GLOB pattern too complex: SQLITE_ERROR");
  // Phase accounting at the attempt-3 figures.
  db.prepare(`INSERT INTO d6_plans
      (plan_id, intent_key, book_id, scope, keep_going, phase, lane,
       state, stop_reason, eligible_digest, created_at, updated_at)
      VALUES (?, ?, ?, 'chapter', 0, ?, 'standard', 'complete', NULL,
              NULL, ?, ?)`)
    .run(SETTLED_PLAN, `intent:${SETTLED_PLAN}`, BOOK, PHASE, now, now);
  db.prepare(`INSERT INTO d6_attempt_log
      (attempt_id, execution_id, plan_id, occurrence_id, seq, phase,
       outcome, cost_micro_cents, upper_micro_cents,
       provider_request_id, detail_json, created_at, updated_at)
      VALUES ('att-battery-settled', 'exec-battery-1', ?, ?, 1,
              'confirmed', 'success', 1029420, 1029420, NULL, NULL,
              ?, ?)`)
    .run(SETTLED_PLAN, OCC26, now, now);
  db.prepare(`INSERT INTO d6_attempt_log
      (attempt_id, execution_id, plan_id, occurrence_id, seq, phase,
       outcome, cost_micro_cents, upper_micro_cents,
       provider_request_id, detail_json, created_at, updated_at)
      VALUES ('att-battery-unverified', 'exec-battery-2', ?, ?, 2,
              'estimated_unverified', 'estimated_unverified', NULL,
              19018, NULL, NULL, ?, ?)`)
    .run(SETTLED_PLAN, OCC26, now, now);
  // The disposition DDL pair (lazy, beside its writer in the
  // shipped code) so the adjudication join can see the row.
  db.exec(`CREATE TABLE IF NOT EXISTS d6_billing_adjudications (
    attempt_id TEXT PRIMARY KEY, plan_id TEXT, phase TEXT,
    disposition TEXT NOT NULL,
    estimated_cost_micro_cents INTEGER NOT NULL,
    reserved_cost_micro_cents INTEGER NOT NULL,
    estimate_basis TEXT NOT NULL, evidence_refs TEXT,
    authorization_ref TEXT NOT NULL, note TEXT, source TEXT,
    current_amendment INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS d6_billing_adjudication_amendments (
    attempt_id TEXT NOT NULL, amendment_seq INTEGER NOT NULL,
    kind TEXT NOT NULL, verified_outcome TEXT NOT NULL,
    verified_cost_micro_cents INTEGER,
    provider_request_id TEXT, evidence_refs TEXT,
    authorization_ref TEXT NOT NULL, note TEXT, source TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (attempt_id, amendment_seq));`);
  db.prepare(`INSERT INTO d6_billing_adjudications
      (attempt_id, plan_id, phase, disposition,
       estimated_cost_micro_cents, reserved_cost_micro_cents,
       estimate_basis, evidence_refs, authorization_ref, note,
       source, current_amendment, created_at)
      VALUES ('att-battery-unverified', ?, ?, 'estimated', 19018,
              5648, 'provider_upper_bound', NULL, 'battery:seed',
              NULL, 'battery', 0, ?)`)
    .run(SETTLED_PLAN, PHASE, now);
  return { planId, jobId, submitted };
}

// Full-database snapshot for twin equivalence: every table's rows
// as canonical JSON lines, tables and rows sorted, EXCLUDING the
// named volatile tables (the recorder's own table is the point of
// the candidate; everything else must match the unmodified build
// byte-for-byte at the row level).
export function snapshotDb(db, { exclude = [] } = {}) {
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' ORDER BY name`).all()
    .map((r) => r.name).filter((n) => !exclude.includes(n));
  const out = [];
  for (const t of tables) {
    const rows = db.prepare(`SELECT * FROM "${t}"`).all()
      .map((r) => JSON.stringify(r,
        Object.keys(r).sort())).sort();
    out.push(`== ${t} (${rows.length})`);
    out.push(...rows);
  }
  return out.join("\n");
}

// Request helpers driving the tree's own public entry handler.
export async function entryGet(w, path, { operator = false,
    client = true } = {}) {
  const headers = {
    "x-opalreader-scope": "production",
    "x-opalreader-instance": "account",
    Origin: "https://opalreader.invalid",
  };
  if (client) headers["x-opalreader-token"] = CLIENT_TOKEN;
  if (operator) headers["x-opalreader-operator-token"] = OPERATOR_TOKEN;
  const res = await w.entry.fetch(
    new Request(`https://opalreader.invalid${path}`,
      { method: "GET", headers }), w.entryEnv);
  return { status: res.status,
           body: await res.json().catch(() => null) };
}

// Containment extension: POST helper mirroring entryGet's header
// discipline (operator routes take the operator token and NO
// client token requirement is bypassed by the gate itself — the
// harness passes both, and fence tests drop them selectively).
export async function entryPost(w, path, body, { operator = false,
    client = true, operatorToken = true } = {}) {
  const headers = {
    "x-opalreader-scope": "production",
    "x-opalreader-instance": "account",
    Origin: "https://opalreader.invalid",
    "content-type": "application/json",
  };
  if (client) headers["x-opalreader-token"] = CLIENT_TOKEN;
  if (operator && operatorToken)
    headers["x-opalreader-operator-token"] = OPERATOR_TOKEN;
  const res = await w.entry.fetch(
    new Request(`https://opalreader.invalid${path}`,
      { method: "POST", headers,
        body: JSON.stringify(body ?? {}) }), w.entryEnv);
  return { status: res.status,
           body: await res.json().catch(() => null) };
}
