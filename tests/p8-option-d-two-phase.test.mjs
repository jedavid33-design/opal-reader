// Opal Reader v2 — P8 Option D: the two-phase command protocol
// (transport plan Part 3, Revision 3; Rowan's final design
// review 6373710222 with its mandatory build gates).
//
// Coverage map:
//   §3.3.1 submit ......... S3 (inert submit), durable refusals,
//                           same-id conflict, duplicate submit
//   §3.3.2 T2/T3 .......... S1 (wrong hash, permanent), S2
//                           (exactly-once + replay), S5
//                           (concurrent approvals), S6 (unknown
//                           id), t2-stale-pending-refusal,
//                           t3-lease-lapse-no-commit
//   §3.3.3 receipts ....... final-only replay; state views carry
//                           { state, storedState, projected }
//   §3.3.4 reconciliation . the mandatory security set: caller
//                           outcome/evidence are REQUESTS, never
//                           proofs; the handler verifies claim +
//                           receipt + business effects server-
//                           side before settling anything;
//                           Correction 2 (6375091653): the chunk
//                           audit reads the ACTUAL bindings /
//                           cache_index / attestation rows, and
//                           the gate audit binds the gate record
//                           to the exact command (detail_json)
//   §3.3.5 crash matrix ... every row, by name
//   §3.5 / I2 read purity . read-purity-overdue-pending,
//                           read-purity-stale-lease-executing
//                           (stored row byte-identical after GET,
//                           through the real SELECT-only facade)
//   §3.8 staging .......... short-TTL configuration seam;
//                           the retired legacy dual-header path
//                           stays inaccessible (negative tests)
//
// Everything runs against the local harness only — no deploy, no
// live contact (the build's authorized scope).
import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../v2/api.mjs";
import stagingEntry from "../v2/worker-entry.js";
import {
  makeWorld, seedRow, importCmd, chunkCmd, positionsCmd, jobsCmd, gateCmd,
  attestationFor, canonicalJson,
  SYNTHETIC_FREEZE_DIGEST as FREEZE,
} from "./helpers/migration-fixtures.mjs";

const MIG = "mig-option-d";
const WRONG_HASH = "0".repeat(64);

// ------------------------------------------------------------ worlds
// A small chunk-pinned book: `n` bound rows, one chunk.
function chunkWorld(n = 3, bookId = "od-book") {
  const w = makeWorld();
  const pairs = [];
  const contentIds = [];
  for (let i = 1; i <= n; i++) {
    const s = seedRow(w.bucket, { bookId, occurrenceId: `${bookId}-o${i}` });
    pairs.push({ row: s.row, etag: s.etag });
    contentIds.push(s.row.occurrenceId);
  }
  w.pinBookChunks(bookId, pairs);
  const content = { title: bookId, occurrenceIds: contentIds };
  const rows = pairs.map((p) => p.row);
  return { w, bookId, pairs, rows, content };
}
const chunk0 = (id, ctx, over = {}) => chunkCmd(id, {
  migrationId: MIG, freezeDigest: FREEZE, bookId: ctx.bookId, chunkIndex: 0,
  content: ctx.content, rows: ctx.rows, ...over });
const submit = (w, cmd) => w.coord.submitMigrationCommand(cmd);
const approve = (w, commandId, payloadSha256, action) =>
  w.coord.approveMigrationCommand({ commandId, payloadSha256, action });
const pendingRow = (w, id) =>
  w.harness.rows("pending_commands").find((r) => r.command_id === id);
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
// Park a chunk approval mid-preparation: the claim commits, then
// preparation blocks on the gate until the test releases it (the
// real prime runs then, exactly as production would).
function blockPreparation(w) {
  const gate = deferred();
  const real = w.coord._prepareMigrationImport.bind(w.coord);
  w.coord._prepareMigrationImport = async (payload) => {
    await gate.promise;
    return real(payload);
  };
  return gate;
}

// ============================================================ S3 + submit
test("S3: a submit stores the command verbatim + inert — zero business rows, zero R2 work, hash is server-computed over the canonical command", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-s3", ctx);
  const view = submit(w, cmd);
  assert.equal(view.state, "pending_operator");
  assert.equal(view.storedState, "pending_operator");
  assert.equal(view.projected, false);
  assert.match(view.payloadSha256, /^[0-9a-f]{64}$/);
  assert.equal(view.payloadSha256, w.coord._pendingHashOf(cmd),
    "the stored hash is the server's canonical hash of the submitted command");
  assert.equal(view.expiresAt - view.submittedAt, 24 * 60 * 60 * 1000,
    "the pending TTL is 24h from submit on the coordinator clock");
  // Inert: nothing executed, nothing fetched.
  assert.equal(w.bucket.getCalls, 0);
  assert.equal(w.bucket.putCalls.length, 0);
  for (const t of ["commands", "bindings", "cache_index", "sync_entities",
                   "migration_books", "migration_audit", "migration_carry",
                   "migration_gates", "jobs"])
    assert.equal(w.harness.rows(t).length, 0, `${t} must stay empty at submit`);
  const rec = pendingRow(w, "od-s3");
  assert.equal(rec.state, "pending_operator");
  assert.deepEqual(JSON.parse(rec.payload_json), cmd.payload,
    "the payload is stored verbatim");
});

test("submit validation failures are durable refusals, never pending (chunk pin match, unpinned book)", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  // A chunk index the pin does not know refuses AT SUBMIT.
  const noContent = chunkCmd("od-v1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: ctx.bookId, chunkIndex: 5, rows: ctx.rows });
  const v1 = submit(w, noContent);
  assert.equal(v1.state, "refused");
  assert.equal(v1.outcome, "rejected");
  assert.ok(v1.reason, "a refusal reason is recorded");
  assert.equal(pendingRow(w, "od-v1").state, "refused");
  // A row tampered against the chunk pin (size +1) refuses AT
  // SUBMIT: the payload must match the pinned chunk exactly.
  const tampered = chunk0("od-v2", ctx, { rows: ctx.rows.map((r, i) =>
    i === 0 ? { ...r, manifest: { ...r.manifest, size: r.manifest.size + 1 } } : r) });
  const v2 = submit(w, tampered);
  assert.equal(v2.state, "refused");
  assert.equal(v2.reason, "migration_chunk_mismatch");
  assert.equal(w.harness.rows("bindings").length, 0);
  // A book outside the approved freeze refuses at submit (with
  // a well-shaped payload, so the freeze check is what fires).
  const stray = seedRow(w.bucket, { bookId: "od-unpinned", occurrenceId: "od-unpinned-o1" });
  const v3 = submit(w, importCmd("od-v3", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: "od-unpinned",
    content: { title: "X", occurrenceIds: ["od-unpinned-o1"] }, rows: [stray.row] }));
  assert.equal(v3.state, "refused");
  assert.equal(v3.reason, "migration_freeze_unapproved");
  // The submit refusal can never be approved into execution.
  const after = await approve(w, "od-v1", v1.payloadSha256);
  assert.equal(after.state, "refused", "a submit refusal is final");
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("commands").length, 0,
    "submit refusals write no commands row — nothing executed");
});

test("chunk-1 content pin at submit: on a carry-pinned book (the production shape — every frozen book carries one), chunk 0 without content, or with content that does not hash to the pin, refuses AT SUBMIT", async () => {
  const ctx = chunkWorld(3, "od-content-book");
  const { w } = ctx;
  w.pinBookCarry(ctx.bookId, { content: ctx.content,
    position: { occurrenceId: ctx.content.occurrenceIds[0], offsetSec: 0, checkpoints: [] },
    jobs: [] });
  const noContent = chunkCmd("od-cp1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: ctx.bookId, chunkIndex: 0, rows: ctx.rows });
  const v1 = submit(w, noContent);
  assert.equal(v1.state, "refused");
  assert.equal(v1.reason, "migration_content_mismatch");
  const tampered = chunk0("od-cp2", ctx,
    { content: { ...ctx.content, title: "Tampered Title" } });
  const v2 = submit(w, tampered);
  assert.equal(v2.state, "refused");
  assert.equal(v2.reason, "migration_content_mismatch");
  // The faithful chunk 0 pends and applies.
  const ok = submit(w, chunk0("od-cp3", ctx));
  assert.equal(ok.state, "pending_operator");
  assert.equal((await approve(w, "od-cp3", ok.payloadSha256)).outcome, "applied");
});

test("same-id / changed-payload submit is a conflict: the original record is untouched and the conflict itself stores nothing new", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const first = submit(w, chunk0("od-c1", ctx));
  assert.equal(first.state, "pending_operator");
  const before = JSON.stringify(pendingRow(w, "od-c1"));
  // Same id, different payload (an extra row appended — the
  // canonical hash changes).
  const changed = chunk0("od-c1", ctx, { rows: [...ctx.rows, ctx.rows[0]] });
  const conflict = submit(w, changed);
  assert.equal(conflict.outcome, "rejected");
  assert.equal(conflict.reason, "pending_payload_conflict");
  assert.equal(conflict.storedState, "pending_operator");
  assert.equal(JSON.stringify(pendingRow(w, "od-c1")), before,
    "the original pending record is byte-identical after the conflict");
  // A faithful duplicate submit returns the current view and
  // still stores exactly one record.
  const dup = submit(w, chunk0("od-c1", ctx));
  assert.equal(dup.state, "pending_operator");
  assert.equal(dup.payloadSha256, first.payloadSha256);
  assert.equal(w.harness.rows("pending_commands").length, 1);
  // And the original still approves and executes normally.
  const done = await approve(w, "od-c1", first.payloadSha256);
  assert.equal(done.outcome, "applied");
});

// ============================================================ S1
test("S1: a wrong-hash approval refuses the record PERMANENTLY — a later correct-hash approval is still refused", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-s1", ctx));
  const refused = await approve(w, "od-s1", WRONG_HASH);
  assert.equal(refused.state, "refused");
  assert.equal(refused.outcome, "rejected");
  assert.equal(refused.reason, "pending_hash_mismatch");
  const later = await approve(w, "od-s1", view.payloadSha256);
  assert.equal(later.state, "refused");
  assert.equal(later.reason, "pending_hash_mismatch",
    "the refusal is the durable receipt; the correct hash does not revive the id");
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("commands").length, 0);
  // The correction path is a NEW id (the :g2 discipline).
  const fixed = submit(w, chunk0("od-s1:g2", ctx));
  const done = await approve(w, "od-s1:g2", fixed.payloadSha256);
  assert.equal(done.outcome, "applied");
});

// ============================================================ S2
test("S2: exactly-once execution — duplicate approval and duplicate submit replay the stored receipt and change nothing", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-s2", ctx));
  const applied = await approve(w, "od-s2", view.payloadSha256);
  assert.equal(applied.state, "applied");
  assert.equal(applied.outcome, "applied");
  const counts = () => ({
    commands: w.harness.rows("commands").length,
    bindings: w.harness.rows("bindings").length,
    books: w.harness.rows("migration_books").length,
    gets: w.bucket.getCalls,
  });
  const once = counts();
  assert.equal(once.commands, 1);
  assert.equal(once.bindings, ctx.rows.length);
  // Duplicate approval → the stored final receipt, replayed.
  const again = await approve(w, "od-s2", view.payloadSha256);
  assert.equal(again.state, "applied");
  assert.equal(again.outcome, "applied");
  assert.deepEqual(counts(), once);
  // Duplicate submit after final → the same final view.
  const resub = submit(w, chunk0("od-s2", ctx));
  assert.equal(resub.state, "applied");
  assert.equal(resub.outcome, "applied");
  assert.deepEqual(counts(), once);
  // An operator REJECT against a final record changes nothing.
  const rej = await approve(w, "od-s2", view.payloadSha256, "reject");
  assert.equal(rej.state, "applied");
  assert.deepEqual(counts(), once);
});

test("operator reject action: an explicit rejection settles the record refused without executing", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-rej", ctx));
  const refused = await approve(w, "od-rej", view.payloadSha256, "reject");
  assert.equal(refused.state, "refused");
  assert.equal(refused.reason, "operator_rejected");
  assert.equal(w.harness.rows("bindings").length, 0);
});

// ============================================================ S6
test("S6: approving an unknown id refuses and stores NOTHING", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const res = await approve(w, "od-never-submitted", WRONG_HASH);
  assert.equal(res.ok, false);
  assert.equal(res.error, "pending_command_not_found");
  assert.equal(w.harness.rows("pending_commands").length, 0);
  assert.equal(w.harness.rows("commands").length, 0);
});

// ============================================================ S4
test("S4: expiry — an approval after the pending TTL materializes expired and refuses; the id never reopens", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-s4", ctx));
  w.harness.advance(24 * 60 * 60 * 1000 + 1);
  const late = await approve(w, "od-s4", view.payloadSha256);
  assert.equal(late.state, "expired");
  assert.equal(late.storedState, "expired");
  assert.equal(late.outcome, "rejected");
  assert.equal(late.reason, "pending_expired");
  assert.equal(pendingRow(w, "od-s4").state, "expired",
    "T2 materialized the transition (a mutation entry point)");
  // Resubmitting the same id + payload does not reopen it.
  const resub = submit(w, chunk0("od-s4", ctx));
  assert.equal(resub.state, "expired");
  assert.equal(w.harness.rows("bindings").length, 0);
  // The correction goes under a new id.
  const fixed = submit(w, chunk0("od-s4:g2", ctx));
  assert.equal((await approve(w, "od-s4:g2", fixed.payloadSha256)).outcome, "applied");
});

test("t2-stale-pending-refusal: T2 rechecks expiry in-transaction even with NO intervening read or materialization", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-t2", ctx));
  w.harness.advance(24 * 60 * 60 * 1000 + 1);
  assert.equal(pendingRow(w, "od-t2").state, "pending_operator",
    "nothing has touched the record since submit — the stored state is still pending");
  const res = await approve(w, "od-t2", view.payloadSha256);
  assert.equal(res.state, "expired");
  assert.equal(res.reason, "pending_expired");
});

test("staging short-TTL seam (§3.8): the TTL is deployment configuration, never client input", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  w.harness.env.pendingCommandTtlMs = 120_000; // staging-only config
  const view = submit(w, chunk0("od-ttl", ctx));
  assert.equal(view.expiresAt - view.submittedAt, 120_000);
  w.harness.advance(120_001);
  const late = await approve(w, "od-ttl", view.payloadSha256);
  assert.equal(late.state, "expired");
  // A client cannot extend it: the payload carries no TTL field
  // the server would honor — resubmission keeps the stored one.
  const again = submit(w, chunk0("od-ttl", ctx));
  assert.equal(again.state, "expired");
});

// ============================================================ S5 + executing views
test("S5: concurrent approvals claim exactly once — the loser gets the processing view and the store shows one execution", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-s5", ctx));
  const gate = blockPreparation(w);
  const first = approve(w, "od-s5", view.payloadSha256);
  // The first approval has claimed (synchronously) and is parked
  // in preparation; a second approval sees the live claim.
  const second = await approve(w, "od-s5", view.payloadSha256);
  assert.equal(second.state, "executing");
  assert.equal(second.storedState, "executing");
  assert.equal(second.projected, false);
  gate.resolve();
  const done = await first;
  assert.equal(done.outcome, "applied");
  assert.equal(w.harness.rows("commands").length, 1);
  assert.equal(w.harness.rows("bindings").length, ctx.rows.length);
  assert.equal(w.harness.rows("migration_books").length, 1,
    "the single chunk completed the book exactly once");
  assert.equal(w.bucket.putCalls.length, 0);
});

// ============================================================ crash matrix
test("crash matrix — before claim: a coordinator crash between submit and approval loses nothing", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-x1", ctx));
  w.harness.crash();
  const done = await approve(w, "od-x1", view.payloadSha256);
  assert.equal(done.outcome, "applied");
  assert.equal(w.harness.rows("bindings").length, ctx.rows.length);
});

test("crash matrix — after claim / during preparation: the claim survives, the lease lapses, the record projects needs_reconciliation and never auto-redoes", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-x2", ctx));
  const gate = blockPreparation(w);
  const approving = approve(w, "od-x2", view.payloadSha256);
  assert.equal(pendingRow(w, "od-x2").state, "executing");
  w.harness.crash();
  w.harness.advance(10 * 60 * 1000 + 1); // past the claim lease
  const look = w.coord.commandReceiptView("od-x2");
  assert.equal(look.state, "needs_reconciliation");
  assert.equal(look.storedState, "executing");
  assert.equal(look.projected, true);
  assert.equal(w.harness.rows("bindings").length, 0, "no auto-redo, no partial apply");
  // A fresh approval is a STOP, not a retry.
  const stop = await approve(w, "od-x2", view.payloadSha256);
  assert.equal(stop.state, "needs_reconciliation");
  assert.equal(pendingRow(w, "od-x2").state, "needs_reconciliation",
    "the approval materialized the stale claim (mutation entry point)");
  // Release the parked preparation: its late T3 must refuse to
  // commit — the claim it held is no longer live.
  gate.resolve();
  const lateView = await approving;
  assert.equal(lateView.state, "needs_reconciliation");
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("commands").length, 0);
});

test("t3-lease-lapse-no-commit: preparation finishing after the lease lapses commits NOTHING — no receipt, no rows, no writes at all", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-t3", ctx));
  const gate = blockPreparation(w);
  const approving = approve(w, "od-t3", view.payloadSha256);
  w.harness.advance(10 * 60 * 1000 + 1); // lease lapses mid-preparation
  gate.resolve();                        // preparation now completes
  const after = await approving;
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.projected, true);
  const rec = pendingRow(w, "od-t3");
  assert.equal(rec.state, "executing", "T3 wrote nothing — the stored row is untouched");
  assert.equal(rec.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("migration_books").length, 0);
});

test("crash matrix — during apply: an exception inside the apply transaction rolls back whole (no commands row, no bindings, claim left to lapse)", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = importCmd("od-x3", { migrationId: MIG, freezeDigest: FREEZE,
    bookId: ctx.bookId, content: ctx.content, rows: ctx.rows });
  w.pinBook(ctx.bookId, ctx.pairs);
  const view = submit(w, cmd);
  assert.equal(view.state, "pending_operator");
  const realApply = w.coord._applyCommand.bind(w.coord);
  let armed = true;
  w.coord._applyCommand = (c, client) => {
    if (armed) { armed = false; throw new Error("simulated crash inside apply"); }
    return realApply(c, client);
  };
  await assert.rejects(() => approve(w, "od-x3", view.payloadSha256),
    /simulated crash inside apply/);
  assert.equal(w.harness.rows("commands").length, 0, "the commands insert rolled back");
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(pendingRow(w, "od-x3").state, "executing",
    "the claim remains, to lapse into reconciliation — never silently retried");
});

test("crash matrix — submit/approve race: an approval that arrives before its submit is an unknown id and stores nothing; the submit then flows normally", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const early = await approve(w, "od-race", WRONG_HASH);
  assert.equal(early.ok, false);
  assert.equal(early.error, "pending_command_not_found");
  assert.equal(w.harness.rows("pending_commands").length, 0);
  const view = submit(w, chunk0("od-race", ctx));
  assert.equal((await approve(w, "od-race", view.payloadSha256)).outcome, "applied");
});

// ============================================================ payload integrity
// (Blocker A correction, Rowan code review 6374624466; design
// §3.3.6 invariant 2.) The stored payload hash is RECOMPUTED
// over the stored (command_id, type, payload) at T2 before any
// claim, and again at T3 inside the apply transaction. These
// tests corrupt the DURABLE record itself — not the operator's
// input — and exercise the actual coordinator logic.
const flipFirstHex = (hex) => (hex[0] === "a" ? "b" : "a") + hex.slice(1);
function tamperPayloadRow(w, id) {
  const rec = pendingRow(w, id);
  const p = JSON.parse(rec.payload_json);
  p.rows[0].manifest.sha256 = flipFirstHex(p.rows[0].manifest.sha256);
  w.harness.db.prepare(
    `UPDATE pending_commands SET payload_json = ? WHERE command_id = ?`)
    .run(JSON.stringify(p), id);
}

test("payload integrity (T2 recompute): a stored payload rewritten after submit fails approval closed — permanently refused, never claimed", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-i1", ctx));
  tamperPayloadRow(w, "od-i1");
  // The approval names the ORIGINAL digest, which still equals
  // the stored digest field — only the recomputation can see
  // that the stored payload no longer hashes to it.
  const res = await approve(w, "od-i1", view.payloadSha256);
  assert.equal(res.state, "refused");
  assert.equal(res.reason, "pending_payload_integrity");
  const rec = pendingRow(w, "od-i1");
  assert.equal(rec.state, "refused");
  assert.equal(rec.claimed_at, null, "never claimed");
  assert.equal(JSON.parse(rec.receipt_json).reason, "pending_payload_integrity");
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
  // Durable: a later approval replays the refusal; there is no
  // blind retry path back to claimable.
  const again = await approve(w, "od-i1", view.payloadSha256);
  assert.equal(again.state, "refused");
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
});

test("payload integrity (T2 recompute): a stored TYPE rewritten after submit fails approval closed", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-i2", ctx));
  w.harness.db.prepare(
    `UPDATE pending_commands SET type = 'MigrateImportJobs' WHERE command_id = ?`)
    .run("od-i2");
  const res = await approve(w, "od-i2", view.payloadSha256);
  assert.equal(res.state, "refused");
  assert.equal(res.reason, "pending_payload_integrity");
  assert.equal(pendingRow(w, "od-i2").claimed_at, null);
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("jobs").length, 0);
});

test("payload integrity (T2 recompute): a tampered stored payload_sha256 fails closed even when the approval names the tampered digest", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  submit(w, chunk0("od-i3", ctx));
  w.harness.db.prepare(
    `UPDATE pending_commands SET payload_sha256 = ? WHERE command_id = ?`)
    .run(WRONG_HASH, "od-i3");
  // The supplied digest now EQUALS the stored field, so the
  // naive stored-vs-supplied comparison would pass; the
  // recomputation over the intact payload is what refuses.
  const res = await approve(w, "od-i3", WRONG_HASH);
  assert.equal(res.state, "refused");
  assert.equal(res.reason, "pending_payload_integrity");
  assert.equal(pendingRow(w, "od-i3").claimed_at, null);
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
});

test("payload integrity (T2 recompute): a tampered stored command_id fails closed — the digest binds the id", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-i4", ctx));
  w.harness.db.prepare(
    `UPDATE pending_commands SET command_id = 'od-i4-moved' WHERE command_id = 'od-i4'`)
    .run();
  const gone = await approve(w, "od-i4", view.payloadSha256);
  assert.equal(gone.ok, false);
  assert.equal(gone.error, "pending_command_not_found");
  // Under its new id the record is findable and the stored
  // digest still matches the approval — but the recomputation
  // binds the id, so it refuses.
  const res = await approve(w, "od-i4-moved", view.payloadSha256);
  assert.equal(res.state, "refused");
  assert.equal(res.reason, "pending_payload_integrity");
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
});

test("payload integrity (T3 recompute is authoritative): a payload mutated DURING preparation fails the apply closed — no effects, no receipt, durable STOP", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-i5", ctx);
  const view = submit(w, cmd);
  const gate = blockPreparation(w);
  const approving = approve(w, "od-i5", view.payloadSha256);
  assert.equal(pendingRow(w, "od-i5").state, "executing",
    "T2's recompute passed on the intact record and the claim committed");
  // Mutate the stored payload in the async window between
  // claim and apply — the case T2 cannot see.
  tamperPayloadRow(w, "od-i5");
  gate.resolve();
  const after = await approving;
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.storedState, "needs_reconciliation",
    "T3 materialized the STOP state itself — this is not a projection");
  const rec = pendingRow(w, "od-i5");
  assert.equal(rec.state, "needs_reconciliation");
  assert.equal(rec.receipt_json, null, "no applied receipt");
  assert.equal(rec.claim_owner, null);
  assert.equal(JSON.parse(rec.detail_json).integrityFailure, true);
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("migration_chunks").length, 0);
  assert.equal(w.harness.rows("migration_books").length, 0);
  // No blind retry: a fresh approval is a STOP, not a redo.
  const stop = await approve(w, "od-i5", view.payloadSha256);
  assert.equal(stop.state, "needs_reconciliation");
  assert.equal(w.harness.rows("bindings").length, 0);
});

test("payload integrity (T3 recompute): a TYPE mutated DURING preparation fails the apply closed", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-i6", ctx));
  const gate = blockPreparation(w);
  const approving = approve(w, "od-i6", view.payloadSha256);
  assert.equal(pendingRow(w, "od-i6").state, "executing");
  w.harness.db.prepare(
    `UPDATE pending_commands SET type = 'MigrateImportJobs' WHERE command_id = ?`)
    .run("od-i6");
  gate.resolve();
  const after = await approving;
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.storedState, "needs_reconciliation");
  const rec = pendingRow(w, "od-i6");
  assert.equal(rec.receipt_json, null);
  assert.equal(JSON.parse(rec.detail_json).integrityFailure, true);
  assert.equal(w.harness.rows("commands").length, 0);
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("jobs").length, 0);
});

// ============================================================ read purity (I2)
test("read-purity-overdue-pending: a GET projects expired but the stored row stays byte-identical (through the SELECT-only facade)", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-rp1", ctx));
  w.harness.advance(24 * 60 * 60 * 1000 + 1);
  const before = JSON.stringify(pendingRow(w, "od-rp1"));
  const api = createApi({ ...w.harness.env });
  const res = await api(new Request(`https://api.test/v2/commands/od-rp1`, {
    headers: { "x-opalreader-scope": "staging-smoke" } }), w.harness.state);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.state, "expired");
  assert.equal(body.storedState, "pending_operator");
  assert.equal(body.projected, true);
  assert.equal(JSON.stringify(pendingRow(w, "od-rp1")), before,
    "the read persisted NOTHING — projection is view-only");
  assert.equal(pendingRow(w, "od-rp1").state, "pending_operator");
});

test("read-purity-stale-lease-executing: a GET projects needs_reconciliation but the stored row stays byte-identical", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const view = submit(w, chunk0("od-rp2", ctx));
  const gate = blockPreparation(w);
  const approving = approve(w, "od-rp2", view.payloadSha256);
  w.harness.advance(10 * 60 * 1000 + 1);
  const before = JSON.stringify(pendingRow(w, "od-rp2"));
  const look = w.coord.commandReceiptView("od-rp2");
  assert.equal(look.state, "needs_reconciliation");
  assert.equal(look.storedState, "executing");
  assert.equal(look.projected, true);
  const api = createApi({ ...w.harness.env });
  const res = await api(new Request(`https://api.test/v2/commands/od-rp2`, {
    headers: { "x-opalreader-scope": "staging-smoke" } }), w.harness.state);
  const body = await res.json();
  assert.equal(body.state, "needs_reconciliation");
  assert.equal(JSON.stringify(pendingRow(w, "od-rp2")), before,
    "neither read materialized anything");
  // Settle the parked approval so the world ends clean: its T3
  // refuses to commit (lapsed lease) — still no writes.
  gate.resolve();
  await approving;
  assert.equal(JSON.stringify(pendingRow(w, "od-rp2")), before);
});

test("handleCommand replay is fenced to final states: a pending id is never replayed as a receipt by the legacy dispatch", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-fence", ctx);
  submit(w, cmd);
  const viaLegacy = await w.coord.handleCommand(cmd);
  assert.equal(viaLegacy.state, "pending_operator",
    "the legacy path answers with the pending view, not an execution");
  assert.equal(viaLegacy.outcome, undefined);
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.harness.rows("commands").length, 0);
});

// ============================================================ reconciliation (§3.3.4)
// A stuck record, crafted exactly as a crash would leave it: a
// committed claim whose execution outcome is unknown. The
// reconciliation handler must verify — claim, receipt, business
// effects — from durable server-side state, in its transaction.
const LEASE = 10 * 60 * 1000;
function craftStuckRecord(w, cmd, { claimedAt }) {
  const now = w.harness.now();
  w.harness.db.prepare(
    `INSERT INTO pending_commands (command_id, type, payload_json, migration_id,
       payload_sha256, state, submitted_at, expires_at, claim_owner, claimed_at)
     VALUES (?, ?, ?, ?, ?, 'executing', ?, ?, ?, ?)`)
    .run(cmd.command_id, cmd.type, JSON.stringify(cmd.payload),
         cmd.payload.migrationId || null, w.coord._pendingHashOf(cmd),
         now - 1000, now + 24 * 60 * 60 * 1000,
         claimedAt === null ? null : "crashed-claim", claimedAt);
}
const staleClaim = (w) => w.harness.now() - LEASE - 1000;
const reconcile = (w, commandId, outcome, evidence = {}) =>
  w.coord.reconcileMigrationCommand({ commandId, outcome, evidence });
function bindingsCmd(id, ctx) {
  return importCmd(id, { migrationId: MIG, freezeDigest: FREEZE,
    bookId: ctx.bookId, content: ctx.content, rows: ctx.rows });
}

test("reconciliation security: a FALSE success claim with zero effects fails closed and preserves the record", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  w.pinBook(ctx.bookId, ctx.pairs);
  const cmd = bindingsCmd("od-r1", ctx);
  const claimedAt = staleClaim(w);
  craftStuckRecord(w, cmd, { claimedAt });
  const res = reconcile(w, "od-r1", "applied",
    { note: "the operator believes it worked", receipt: { outcome: "applied" } });
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(res.verification.effectsZero, true);
  // Forged evidence settles NOTHING: the only change is the
  // designed materialization of the stale claim at this mutation
  // entry point — the record stays uncertain (needs_reconciliation,
  // no receipt written, claim timestamp preserved for the audit).
  const after = pendingRow(w, "od-r1");
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(after.claimed_at, claimedAt);
  assert.equal(w.harness.rows("bindings").length, 0);
});

test("reconciliation security: a correct zero-effects settlement refuses the record (reconciled_abandoned) and executes nothing", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  w.pinBook(ctx.bookId, ctx.pairs);
  const cmd = bindingsCmd("od-r2", ctx);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const getsBefore = w.bucket.getCalls;
  const settled = reconcile(w, "od-r2", "refused", { basis: "no effects found" });
  assert.equal(settled.state, "refused");
  assert.equal(settled.reason, "reconciled_abandoned");
  const rec = pendingRow(w, "od-r2");
  assert.equal(rec.state, "refused");
  assert.equal(JSON.parse(rec.detail_json).reconciled, true);
  assert.equal(w.harness.rows("commands").length, 0,
    "settlement writes no commands row — the route never executes or back-fills");
  assert.equal(w.harness.rows("bindings").length, 0);
  assert.equal(w.bucket.getCalls, getsBefore,
    "the audit is server-side SQL; reconciliation performs no R2 work");
  // And the settled record is final: a later approval replays it.
  const replay = await approve(w, "od-r2", w.coord._pendingHashOf(cmd));
  assert.equal(replay.state, "refused");
});

test("reconciliation security: a FALSE refusal claim with complete effects fails closed and preserves the record", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  w.pinBook(ctx.bookId, ctx.pairs);
  const cmd = bindingsCmd("od-r3", ctx);
  const applied = await w.coord.handleCommand(cmd); // effects + receipt really exist
  assert.equal(applied.outcome, "applied");
  const claimedAt = staleClaim(w);
  craftStuckRecord(w, cmd, { claimedAt });
  const res = reconcile(w, "od-r3", "refused", { note: "assume it never ran" });
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, true);
  assert.equal(res.verification.receiptPresent, true);
  const after = pendingRow(w, "od-r3");
  assert.equal(after.state, "needs_reconciliation", "unsettled — only materialized");
  assert.equal(after.receipt_json, null);
  assert.equal(after.claimed_at, claimedAt);
  // The receipt vocabulary is not the route's vocabulary: an
  // outcome of "rejected" fails closed as malformed at the
  // coordinator seam too, and settles nothing.
  const badVocab = reconcile(w, "od-r3", "rejected", {});
  assert.equal(badVocab.ok, false);
  assert.equal(badVocab.error, "malformed_reconciliation");
  assert.equal(pendingRow(w, "od-r3").state, "needs_reconciliation");
  assert.equal(pendingRow(w, "od-r3").receipt_json, null);
});

test("reconciliation security: a correct complete-effects settlement applies with the EXISTING durable receipt — nothing is re-executed or re-invented", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  w.pinBook(ctx.bookId, ctx.pairs);
  const cmd = bindingsCmd("od-r4", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  const cert = applied.certificate.certificateSha256;
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const settled = reconcile(w, "od-r4", "applied", { basis: "effects verified" });
  assert.equal(settled.state, "applied");
  assert.equal(settled.outcome, "applied");
  const rec = pendingRow(w, "od-r4");
  assert.equal(JSON.parse(rec.receipt_json).certificate.certificateSha256, cert,
    "the settled receipt IS the durable execution receipt, not a caller's copy");
  assert.equal(JSON.parse(rec.detail_json).reconciled, true);
  assert.equal(w.harness.rows("bindings").length, ctx.rows.length);
  assert.equal(w.harness.rows("commands").length, 1, "still exactly one execution");
});

test("reconciliation security: a record with NO recorded claim cannot be settled even with complete effects (the execution is unattributable to the two-phase claim)", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  w.pinBook(ctx.bookId, ctx.pairs);
  const cmd = bindingsCmd("od-r5", ctx);
  await w.coord.handleCommand(cmd);
  craftStuckRecord(w, cmd, { claimedAt: null });
  const res = reconcile(w, "od-r5", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.claimRecorded, false);
  const after = pendingRow(w, "od-r5");
  assert.equal(after.state, "needs_reconciliation", "unsettled — only materialized");
  assert.equal(after.receipt_json, null);
});

test("reconciliation security: the route cannot bypass T2/T3 — pending, live-executing, and final records are not reconcilable; unknown ids store nothing", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  // Merely pending (never claimed).
  const view = submit(w, chunk0("od-r6a", ctx));
  let res = reconcile(w, "od-r6a", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "not_reconcilable");
  assert.equal(pendingRow(w, "od-r6a").state, "pending_operator");
  // Live executing (claim within its lease) — even the operator
  // credential cannot force-settle a live claim through this
  // route.
  const gate = blockPreparation(w);
  const approving = approve(w, "od-r6a", view.payloadSha256);
  res = reconcile(w, "od-r6a", "refused", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "not_reconcilable");
  gate.resolve();
  assert.equal((await approving).outcome, "applied");
  // Final record.
  res = reconcile(w, "od-r6a", "refused", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "not_reconcilable");
  // Unknown id.
  const countBefore = w.harness.rows("pending_commands").length;
  res = reconcile(w, "od-r6-unknown", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "pending_command_not_found");
  assert.equal(w.harness.rows("pending_commands").length, countBefore);
});

// ============================================================ reconciliation audit
// (Blocker B correction, Rowan code review 6374624466.)
// `complete` now demands full, server-recomputed, pin-exact,
// COMMAND-ATTRIBUTABLE evidence per type — and `applied`
// settlement demands the durable commands receipt BOUND to the
// pending record. Shallow markers earn nothing.
test("reconciliation audit (Blocker B): a chunk slot with a corrupted row digest under the CORRECT migration id earns no completion credit", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-b1", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  // Corrupt the slot's row digest in place — same book, same
  // chunk, same correct migration id, same command attribution.
  w.harness.db.prepare(
    `UPDATE migration_chunks SET rows_sha256 = ? WHERE book_id = ?`)
    .run(WRONG_HASH, ctx.bookId);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-b1", "applied", { note: "looks complete" });
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false,
    "the recomputed digest over the stored payload's rows is the yardstick");
  assert.equal(res.verification.receiptBound, true,
    "the receipt was genuine — the EFFECTS are what failed proof");
  const after = pendingRow(w, "od-b1");
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 1, "no synthetic receipt inserted");
});

test("reconciliation audit (Blocker B): a completed slot belonging to a DIFFERENT command id earns this command no credit", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const applied = await w.coord.handleCommand(chunk0("od-b3-other", ctx));
  assert.equal(applied.outcome, "applied");
  // This command's record carries the IDENTICAL payload — only
  // the id differs — and was never executed by anyone.
  craftStuckRecord(w, chunk0("od-b3", ctx), { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-b3", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false,
    "attribution is part of completeness: the slot names the other command");
  assert.equal(pendingRow(w, "od-b3").state, "needs_reconciliation");
  assert.equal(pendingRow(w, "od-b3").receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 1);
});

test("reconciliation audit (Blocker B): a positions carry marker whose ACTUAL stored position was rewritten earns no completion credit", async () => {
  const ctx = carryWorld();
  const { w, bookId, carry } = ctx;
  const chunkReceipt = await w.coord.handleCommand(chunkCmd("od-b4-c", {
    migrationId: MIG, freezeDigest: FREEZE, bookId, chunkIndex: 0,
    content: ctx.content, rows: ctx.rows }));
  assert.equal(chunkReceipt.outcome, "applied");
  const cmd = positionsCmd("od-b4",
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry });
  assert.equal((await w.coord.handleCommand(cmd)).outcome, "applied");
  assert.equal(w.harness.rows("migration_carry").length, 1,
    "the carry marker exists and names this command");
  // Rewrite the ACTUAL stored position under the intact marker.
  w.harness.db.prepare(
    `UPDATE position_state SET offset_sec = 999 WHERE book_id = ?`).run(bookId);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-b4", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(pendingRow(w, "od-b4").state, "needs_reconciliation");
  assert.equal(pendingRow(w, "od-b4").receipt_json, null);
  assert.equal(w.harness.rows("migration_gates").length, 0, "no book flip");
});

test("reconciliation audit (Blocker B): a jobs carry marker whose stored job row was rewritten earns no completion credit", async () => {
  const ctx = carryWorld();
  const { w, bookId, carry } = ctx;
  const chunkReceipt = await w.coord.handleCommand(chunkCmd("od-b5-c", {
    migrationId: MIG, freezeDigest: FREEZE, bookId, chunkIndex: 0,
    content: ctx.content, rows: ctx.rows }));
  assert.equal(chunkReceipt.outcome, "applied");
  const cmd = jobsCmd("od-b5",
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry });
  assert.equal((await w.coord.handleCommand(cmd)).outcome, "applied");
  assert.equal(w.harness.rows("jobs")[0].state, "parked_policy");
  // Rewrite the stored job's state under the intact marker.
  w.harness.db.prepare(
    `UPDATE jobs SET state = 'queued' WHERE job_id = 'od-parked-1'`).run();
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-b5", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(pendingRow(w, "od-b5").state, "needs_reconciliation");
  assert.equal(pendingRow(w, "od-b5").receipt_json, null);
});

async function carryWorldFullyExecuted(w, ctx, prefix) {
  const { bookId, carry } = ctx;
  const chunkReceipt = await w.coord.handleCommand(chunkCmd(`${prefix}-c`, {
    migrationId: MIG, freezeDigest: FREEZE, bookId, chunkIndex: 0,
    content: ctx.content, rows: ctx.rows }));
  assert.equal(chunkReceipt.outcome, "applied");
  assert.equal((await w.coord.handleCommand(positionsCmd(`${prefix}-p`,
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry }))).outcome, "applied");
  assert.equal((await w.coord.handleCommand(jobsCmd(`${prefix}-j`,
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry }))).outcome, "applied");
  const gate = gateCmd(`${prefix}-g`,
    { migrationId: MIG, bookId, certificateSha256: chunkReceipt.certificateSha256 });
  assert.equal((await w.coord.handleCommand(gate)).outcome, "applied");
  return { chunkReceipt, gate };
}

test("reconciliation audit (Blocker B): a gate row naming a wrong certificate earns no completion credit", async () => {
  const ctx = carryWorld();
  const { w, bookId } = ctx;
  const { gate } = await carryWorldFullyExecuted(w, ctx, "od-b6");
  // Corrupt the gate row's certificate AND the book's anchored
  // certificate to the SAME wrong value: the two stored copies
  // agree with each other perfectly — only comparison against
  // the COMMAND'S PIN catches it. Internal consistency between
  // two corruptible copies is not proof.
  w.harness.db.prepare(
    `UPDATE migration_gates SET certificate_sha256 = ? WHERE book_id = ?`)
    .run(WRONG_HASH, bookId);
  w.harness.db.prepare(
    `UPDATE migration_books SET certificate_sha256 = ? WHERE book_id = ?`)
    .run(WRONG_HASH, bookId);
  craftStuckRecord(w, gate, { claimedAt: staleClaim(w) });
  const res = reconcile(w, gate.command_id, "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(pendingRow(w, gate.command_id).state, "needs_reconciliation");
  assert.equal(pendingRow(w, gate.command_id).receipt_json, null);
});

test("reconciliation audit (Blocker B): a gate row over a book whose ANCHORED certificate was rewritten earns no completion credit", async () => {
  const ctx = carryWorld();
  const { w, bookId } = ctx;
  const { gate } = await carryWorldFullyExecuted(w, ctx, "od-b7");
  // The gate row itself stays intact; the book's server-side
  // anchor is what no longer matches the command.
  w.harness.db.prepare(
    `UPDATE migration_books SET certificate_sha256 = ? WHERE book_id = ?`)
    .run(WRONG_HASH, bookId);
  craftStuckRecord(w, gate, { claimedAt: staleClaim(w) });
  const res = reconcile(w, gate.command_id, "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(pendingRow(w, gate.command_id).state, "needs_reconciliation");
  assert.equal(pendingRow(w, gate.command_id).receipt_json, null);
});

test("reconciliation (Blocker B): complete-looking effects with NO trustworthy receipt stay uncertain — no synthetic receipt, no flip, no grant", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-b8", ctx);
  // Hand-plant a slot that satisfies EVERY effects check —
  // correct migration, attribution to this command, the
  // recomputed row digest, field-exact evidence — plus the
  // bindings the chunk would have written. What does NOT exist
  // is any execution: no commands receipt, because no T3 ever
  // ran — and T3 writes effects and receipt in ONE transaction,
  // so this state is unattributable by construction.
  const pinned = w.coord._pinnedChunk(ctx.bookId, 0);
  // The slot's row digest, computed HERE from the payload rows
  // (the apply construction, restated independently).
  const plantedDigest = sha256Hex(canonicalJson(cmd.payload.rows
    .map(r => ({ occurrenceId: r.occurrenceId, revisionKey: r.revisionKey,
                 cacheKey: r.cacheKey, sha256: r.manifest.sha256,
                 size: r.manifest.size, format: r.manifest.format }))
    .sort((a, b) => (a.occurrenceId < b.occurrenceId ? -1 : 1))));
  const evidence = cmd.payload.rows.map(r => ({
    occurrenceId: r.occurrenceId, revisionKey: r.revisionKey, cacheKey: r.cacheKey,
    objectKey: `audio/${r.cacheKey}.${r.manifest.format}`,
    manifestSha256: r.manifest.sha256, computedSha256: r.manifest.sha256,
    metadataSha256: null, etag: null, verified: true, status: "accepted", reason: null }));
  w.harness.db.prepare(
    `INSERT INTO migration_chunks (book_id, chunk_index, migration_id, rows_sha256,
       row_count, total_bytes, evidence_json, command_id, applied_at)
     VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ctx.bookId, MIG, plantedDigest,
         cmd.payload.rows.length, pinned.chunk.totalBytes,
         JSON.stringify(evidence), "od-b8", w.harness.now());
  for (const r of cmd.payload.rows)
    w.harness.db.prepare(
      `INSERT INTO bindings (occurrence_id, revision_key, cache_key, provenance, bound_at)
       VALUES (?, ?, ?, 'migration', ?)`)
      .run(r.occurrenceId, r.revisionKey, r.cacheKey, w.harness.now());
  // Correction 2 (B1): the audit now also reads the cache_index
  // rows a genuine apply writes — plant those too, exactly as
  // the apply writes them, so this state remains what it claims
  // to be: COMPLETE effects with no execution behind them.
  for (const r of cmd.payload.rows)
    w.harness.db.prepare(
      `INSERT INTO cache_index (cache_key, identity, format, sha256, recorded_at)
       VALUES (?, ?, ?, ?, ?)`)
      .run(r.cacheKey, r.revisionKey, r.manifest.format, r.manifest.sha256,
           w.harness.now());
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const grantsBefore = w.harness.sentGrants.length;
  const res = reconcile(w, "od-b8", "applied", { basis: "effects verified complete" });
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, true,
    "the effects audit DOES find them complete — settlement still refuses");
  assert.equal(res.verification.receiptPresent, false);
  assert.equal(res.verification.receiptBound, false);
  const after = pendingRow(w, "od-b8");
  assert.equal(after.state, "needs_reconciliation", "the uncertain record is preserved");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 0,
    "NO synthetic commands receipt inserted");
  assert.equal(w.harness.rows("migration_gates").length, 0, "no book flip");
  assert.equal(w.harness.sentGrants.length, grantsBefore, "no grant");
});

test("reconciliation audit (Blocker B): a genuinely complete chunk execution settles applied on its EXISTING receipt (positive control)", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-b2", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  assert.equal(applied.bookComplete, true);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const settled = reconcile(w, "od-b2", "applied", {});
  assert.equal(settled.state, "applied");
  assert.equal(settled.outcome, "applied");
  assert.equal(settled.certificateSha256, applied.certificateSha256,
    "the settled receipt IS the durable execution receipt");
  const rec = pendingRow(w, "od-b2");
  assert.equal(JSON.parse(rec.detail_json).verification.receiptBound, true,
    "the settlement's recorded evidence shows the receipt binding was verified");
  assert.equal(w.harness.rows("commands").length, 1, "still exactly one execution");
});

test("reconciliation audit (Blocker B): a genuinely complete positions carry settles applied on its existing receipt (positive control)", async () => {
  const ctx = carryWorld();
  const { w, bookId, carry } = ctx;
  const chunkReceipt = await w.coord.handleCommand(chunkCmd("od-b9-c", {
    migrationId: MIG, freezeDigest: FREEZE, bookId, chunkIndex: 0,
    content: ctx.content, rows: ctx.rows }));
  assert.equal(chunkReceipt.outcome, "applied");
  const cmd = positionsCmd("od-b9",
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry });
  assert.equal((await w.coord.handleCommand(cmd)).outcome, "applied");
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const settled = reconcile(w, "od-b9", "applied", {});
  assert.equal(settled.state, "applied");
  assert.equal(settled.outcome, "applied");
  assert.equal(
    JSON.parse(pendingRow(w, "od-b9").detail_json).verification.receiptBound, true);
  assert.equal(w.harness.rows("commands").length, 2,
    "chunk + positions executions only — nothing re-executed or inserted");
});

test("reconciliation audit (Blocker B): a genuinely complete gate settles applied on its existing receipt (positive control)", async () => {
  const ctx = carryWorld();
  const { w } = ctx;
  const { gate } = await carryWorldFullyExecuted(w, ctx, "od-b10");
  craftStuckRecord(w, gate, { claimedAt: staleClaim(w) });
  const settled = reconcile(w, gate.command_id, "applied", {});
  assert.equal(settled.state, "applied");
  assert.equal(settled.outcome, "applied");
  assert.equal(
    JSON.parse(pendingRow(w, gate.command_id).detail_json).verification.receiptBound, true);
  assert.equal(w.harness.rows("commands").length, 4,
    "chunk + positions + jobs + gate — nothing re-executed or inserted");
});

// ============================================================ Correction 2 (Rowan re-review 6375091653)
// B1: the chunk audit must read the ACTUAL applied rows — the
// live bindings / cache_index records and the provenance
// attestation — not only the slot's reported evidence. In every
// negative case below the slot, its evidence_json and the
// genuine bound commands receipt are left perfectly intact; a
// single live row is deleted, altered or corrupted, and an
// `applied` reconciliation must still preserve the record.
// B2: the gate record must name the exact command that created
// it (migration_gates.detail_json.commandId) before a gate
// command can be credited with the flip.

test("reconciliation audit (Correction 2, B1): a DELETED binding earns no completion credit — the slot's evidence is not the effects", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-c2-b1-del", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  assert.equal(w.harness.rows("bindings").length, ctx.rows.length);
  // Delete ONE binding the chunk applied. Slot, evidence and
  // receipt all stay intact.
  const victim = ctx.rows[1];
  w.harness.db.prepare(
    `DELETE FROM bindings WHERE occurrence_id = ? AND revision_key = ?`)
    .run(victim.occurrenceId, victim.revisionKey);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const grantsBefore = w.harness.sentGrants.length;
  const res = reconcile(w, "od-c2-b1-del", "applied", { note: "slot looks complete" });
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false,
    "a missing applied row is a missing effect, however intact the summary");
  assert.equal(res.verification.receiptBound, true,
    "the receipt was genuine — the live rows are what failed proof");
  const after = pendingRow(w, "od-c2-b1-del");
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 1, "no synthetic receipt inserted");
  assert.equal(w.harness.rows("migration_gates").length, 0, "no book flip");
  assert.equal(w.harness.sentGrants.length, grantsBefore, "no grant");
});

test("reconciliation audit (Correction 2, B1): an ALTERED binding (cache key rewritten) earns no completion credit", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-c2-b1-alt", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  const victim = ctx.rows[0];
  w.harness.db.prepare(
    `UPDATE bindings SET cache_key = 'rewritten-cache-key' WHERE occurrence_id = ? AND revision_key = ?`)
    .run(victim.occurrenceId, victim.revisionKey);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-c2-b1-alt", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(res.verification.receiptBound, true);
  const after = pendingRow(w, "od-c2-b1-alt");
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 1);
  assert.equal(w.harness.rows("migration_gates").length, 0);
});

test("reconciliation audit (Correction 2, B1): an altered cache_index SHA-256 earns no completion credit", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-c2-b1-sha", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  const victim = ctx.rows[2];
  w.harness.db.prepare(
    `UPDATE cache_index SET sha256 = ? WHERE cache_key = ?`)
    .run(WRONG_HASH, victim.cacheKey);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-c2-b1-sha", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false,
    "the anchored digest in the live index no longer equals the pinned manifest digest");
  assert.equal(res.verification.receiptBound, true);
  const after = pendingRow(w, "od-c2-b1-sha");
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 1);
});

test("reconciliation audit (Correction 2, B1): an altered cache_index identity earns no completion credit", async () => {
  const ctx = chunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-c2-b1-ident", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  const victim = ctx.rows[0];
  w.harness.db.prepare(
    `UPDATE cache_index SET identity = 'foreign-identity' WHERE cache_key = ?`)
    .run(victim.cacheKey);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-c2-b1-ident", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false,
    "the identity the index anchored is not the identity the pin admits");
  assert.equal(res.verification.receiptBound, true);
  const after = pendingRow(w, "od-c2-b1-ident");
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 1);
});

// A chunk world whose middle row is fingerprinted-distinct:
// accepted only through its freeze-snapshot attestation, so its
// apply writes a migration_audit record (the provenance leg).
function provenanceChunkWorld(bookId = "od-c2-prov-book") {
  const w = makeWorld();
  const pairs = [], rows = [], contentIds = [];
  const forms = ["fingerprinted", "distinct", "fingerprinted"];
  for (let i = 1; i <= 3; i++) {
    const s = seedRow(w.bucket, { bookId, occurrenceId: `${bookId}-o${i}`, form: forms[i - 1] });
    const row = { ...s.row };
    if (forms[i - 1] === "distinct")
      row.provenanceAttestation = attestationFor(s, { bookId, freezeDigest: FREEZE });
    pairs.push({ row, etag: s.etag });
    rows.push(row);
    contentIds.push(row.occurrenceId);
  }
  w.pinBookChunks(bookId, pairs);
  return { w, bookId, pairs, rows, content: { title: bookId, occurrenceIds: contentIds } };
}

test("reconciliation audit (Correction 2, B1): a corrupted provenance attestation earns no completion credit", async () => {
  const ctx = provenanceChunkWorld();
  const { w } = ctx;
  const cmd = chunk0("od-c2-b1-prov", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  const auditRows = w.harness.rows("migration_audit");
  assert.equal(auditRows.length, 1, "the provenance row's apply wrote its audit record");
  assert.equal(auditRows[0].outcome, "accepted_provenance");
  // Corrupt the stored attestation itself — flip the digest it
  // claims for the audio. The audit row still exists, the slot
  // evidence still says accepted_provenance, the receipt is
  // genuine; only re-reading the attestation catches it.
  const tampered = { ...JSON.parse(auditRows[0].attestation_json), sha256: WRONG_HASH };
  w.harness.db.prepare(
    `UPDATE migration_audit SET attestation_json = ? WHERE book_id = ?`)
    .run(JSON.stringify(tampered), ctx.bookId);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const res = reconcile(w, "od-c2-b1-prov", "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(res.verification.receiptBound, true);
  const after = pendingRow(w, "od-c2-b1-prov");
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 1);
  assert.equal(w.harness.rows("migration_gates").length, 0);
});

test("reconciliation audit (Correction 2, B1): genuinely applied rows settle applied on the EXISTING receipt (positive control)", async () => {
  const ctx = provenanceChunkWorld("od-c2-pos-book");
  const { w } = ctx;
  const cmd = chunk0("od-c2-b1-pos", ctx);
  const applied = await w.coord.handleCommand(cmd);
  assert.equal(applied.outcome, "applied");
  assert.equal(applied.bookComplete, true);
  // The live rows are exactly what the stricter audit reads:
  // all bindings (incl. the provenance one), all index rows,
  // the one audit record — untouched.
  assert.equal(w.harness.rows("bindings").length, 3);
  assert.equal(w.harness.rows("cache_index").length, 3);
  assert.equal(w.harness.rows("migration_audit").length, 1);
  craftStuckRecord(w, cmd, { claimedAt: staleClaim(w) });
  const settled = reconcile(w, "od-c2-b1-pos", "applied", {});
  assert.equal(settled.state, "applied");
  assert.equal(settled.outcome, "applied");
  assert.equal(settled.certificateSha256, applied.certificateSha256,
    "the settled receipt IS the durable execution receipt");
  assert.equal(
    JSON.parse(pendingRow(w, "od-c2-b1-pos").detail_json).verification.effectsComplete, true);
  assert.equal(w.harness.rows("commands").length, 1, "still exactly one execution");
});

test("reconciliation audit (Correction 2, B2): a gate record naming a DIFFERENT command earns this command no credit", async () => {
  const ctx = carryWorld();
  const { w, bookId } = ctx;
  const { gate } = await carryWorldFullyExecuted(w, ctx, "od-c2-g1");
  // Everything stays genuine — anchored certificate, complete
  // planes, verified carries — except the gate record's own
  // attribution: it now names another command as its creator.
  w.harness.db.prepare(
    `UPDATE migration_gates SET detail_json = ? WHERE book_id = ?`)
    .run(JSON.stringify({ commandId: "od-c2-g1-OTHER" }), bookId);
  craftStuckRecord(w, gate, { claimedAt: staleClaim(w) });
  const res = reconcile(w, gate.command_id, "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false,
    "a marker created by a different command must not be credited to this one");
  assert.equal(res.verification.receiptBound, true);
  const after = pendingRow(w, gate.command_id);
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 4, "no synthetic receipt inserted");
  assert.equal(w.harness.rows("migration_gates").length, 1, "the gate row itself is untouched");
});

test("reconciliation audit (Correction 2, B2): a gate record with NO command attribution earns no credit", async () => {
  const ctx = carryWorld();
  const { w, bookId } = ctx;
  const { gate } = await carryWorldFullyExecuted(w, ctx, "od-c2-g2");
  w.harness.db.prepare(
    `UPDATE migration_gates SET detail_json = ? WHERE book_id = ?`)
    .run(JSON.stringify({}), bookId);
  craftStuckRecord(w, gate, { claimedAt: staleClaim(w) });
  const res = reconcile(w, gate.command_id, "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  const after = pendingRow(w, gate.command_id);
  assert.equal(after.state, "needs_reconciliation");
  assert.equal(after.receipt_json, null);
  assert.equal(w.harness.rows("commands").length, 4);
});

test("reconciliation audit (Correction 2, B2): an UNPARSEABLE gate detail earns no credit", async () => {
  const ctx = carryWorld();
  const { w, bookId } = ctx;
  const { gate } = await carryWorldFullyExecuted(w, ctx, "od-c2-g3");
  w.harness.db.prepare(
    `UPDATE migration_gates SET detail_json = ? WHERE book_id = ?`)
    .run("{not json", bookId);
  craftStuckRecord(w, gate, { claimedAt: staleClaim(w) });
  const res = reconcile(w, gate.command_id, "applied", {});
  assert.equal(res.ok, false);
  assert.equal(res.error, "reconciliation_evidence_mismatch");
  assert.equal(res.verification.effectsComplete, false);
  assert.equal(pendingRow(w, gate.command_id).state, "needs_reconciliation");
  assert.equal(pendingRow(w, gate.command_id).receipt_json, null);
});

test("reconciliation audit (Correction 2, B2): a genuinely attributed gate settles applied on its existing receipt (positive control)", async () => {
  const ctx = carryWorld();
  const { w, bookId } = ctx;
  const { gate } = await carryWorldFullyExecuted(w, ctx, "od-c2-g4");
  assert.equal(
    JSON.parse(w.harness.rows("migration_gates")[0].detail_json).commandId,
    gate.command_id, "the gate record names the command that created it");
  craftStuckRecord(w, gate, { claimedAt: staleClaim(w) });
  const settled = reconcile(w, gate.command_id, "applied", {});
  assert.equal(settled.state, "applied");
  assert.equal(settled.outcome, "applied");
  const detail = JSON.parse(pendingRow(w, gate.command_id).detail_json);
  assert.equal(detail.verification.receiptBound, true);
  assert.equal(detail.verification.effectsComplete, true);
  assert.equal(w.harness.rows("commands").length, 4,
    "chunk + positions + jobs + gate — nothing re-executed or inserted");
});

// ============================================================ API negatives
const MARK = { "x-opalreader-operator-admitted": "1" };

test("API negatives: the approval route refuses a missing admission mark, malformed bodies, and content-carrying bodies — and stores nothing for any of them", async () => {
  const world = chunkWorld();
  const pend = world.w.coord.submitMigrationCommand(chunk0("od-a1", world));
  const api = createApi({ ...world.w.harness.env });
  const callApi = (path, opts) => api(new Request(`https://api.test${path}`, {
    method: opts.method || "GET",
    headers: { "x-opalreader-scope": "staging-smoke",
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(opts.headers || {}) },
    body: opts.body !== undefined
      ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined,
  }), world.w.harness.state);
  const approvalBody = { commandId: "od-a1", payloadSha256: pend.payloadSha256 };
  // No admission mark (what a client-only caller can produce).
  let res = await callApi("/v2/command-approvals", { method: "POST", body: approvalBody });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "migration_operator_required");
  // Mark present, body not JSON.
  res = await callApi("/v2/command-approvals",
    { method: "POST", body: "{not json", headers: MARK });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, "malformed_operator_request");
  // Mark present, body carries CONTENT (the one thing the route
  // must never accept — content travels only via submit).
  for (const extra of [{ rows: [] }, { payload: {} }, { command: {} }, { outcome: "applied" }]) {
    res = await callApi("/v2/command-approvals",
      { method: "POST", body: { ...approvalBody, ...extra }, headers: MARK });
    assert.equal(res.status, 422, JSON.stringify(extra));
    assert.equal((await res.json()).error, "malformed_approval");
  }
  // Mark present, hash of the wrong shape.
  res = await callApi("/v2/command-approvals",
    { method: "POST", body: { commandId: "od-a1", payloadSha256: "xyz" }, headers: MARK });
  assert.equal(res.status, 422);
  // Nothing moved: the record is still pending, unexecuted.
  assert.equal(pendingRow(world.w, "od-a1").state, "pending_operator");
  assert.equal(world.w.harness.rows("commands").length, 0);
  // The well-formed approval then works through the same route.
  res = await callApi("/v2/command-approvals",
    { method: "POST", body: approvalBody, headers: MARK });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).outcome, "applied");
});

test("API negatives: approval of an unknown id is a 404 storing nothing; approval naming a non-two-phase (legacy) command id is refused the same way", async () => {
  const world = chunkWorld();
  const { w } = world;
  const api = createApi({ ...w.harness.env });
  const callApi = (path, opts) => api(new Request(`https://api.test${path}`, {
    method: opts.method || "GET",
    headers: { "x-opalreader-scope": "staging-smoke",
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(opts.headers || {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }), w.harness.state);
  let res = await callApi("/v2/command-approvals", { method: "POST", headers: MARK,
    body: { commandId: "od-ghost", payloadSha256: WRONG_HASH } });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, "pending_command_not_found");
  assert.equal(w.harness.rows("pending_commands").length, 0);
  // A legacy executed command id (a real commands row, no
  // two-phase record): approvals do not operate on it.
  const legacy = await w.coord.handleCommand({ command_id: "od-legacy-1",
    type: "SyncPush", payload: { bookId: "od-book", baseTip: null, changes: [] } });
  assert.equal(legacy.outcome, "applied");
  res = await callApi("/v2/command-approvals", { method: "POST", headers: MARK,
    body: { commandId: "od-legacy-1", payloadSha256: WRONG_HASH } });
  assert.equal(res.status, 404);
  assert.equal(w.harness.rows("pending_commands").length, 0);
});

test("API negatives: malformed submits never pend — missing command_id is a 400 envelope error; a shapeless migration payload stores a durable REFUSAL, not a pending record", async () => {
  const world = chunkWorld();
  const { w } = world;
  const api = createApi({ ...w.harness.env });
  const post = (body) => api(new Request("https://api.test/v2/commands", {
    method: "POST",
    headers: { "x-opalreader-scope": "staging-smoke", "content-type": "application/json" },
    body: JSON.stringify(body) }), w.harness.state);
  let res = await post({ type: "MigrateImportChunk", payload: {} });
  assert.equal(res.status, 400);
  res = await post({ command_id: "od-bad", type: "MigrateImportChunk", payload: {} });
  assert.equal(res.status, 200);
  const refused = await res.json();
  assert.equal(refused.state, "refused");
  assert.equal(pendingRow(w, "od-bad").state, "refused");
  assert.equal(w.harness.rows("commands").length, 0);
  // A forged admission mark on the SUBMIT changes nothing: the
  // command pends exactly like any other submit.
  res = await api(new Request("https://api.test/v2/commands", {
    method: "POST",
    headers: { "x-opalreader-scope": "staging-smoke", "content-type": "application/json",
      ...MARK },
    body: JSON.stringify(chunk0("od-forge", world)) }), w.harness.state);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state, "pending_operator");
  assert.equal(w.harness.rows("commands").length, 0);
});

// ============================================================ flip gate + carry through the protocol
import { pinnedCarryEntry } from "./helpers/migration-fixtures.mjs";
function carryWorld() {
  const ctx = chunkWorld(3, "od-carry-book");
  const { w } = ctx;
  const entry = pinnedCarryEntry({ bookId: ctx.bookId, content: ctx.content,
    position: { occurrenceId: ctx.content.occurrenceIds[0], offsetSec: 12.5,
                checkpoints: [{ chapterIndex: 0, segmentIndex: 0, offsetSec: 0 }] },
    jobs: [{ jobId: "od-parked-1", chapterIndex: 0, v2State: "parked_policy",
      cause: "synthetic parked job",
      definition: { kind: "job", bookId: ctx.bookId, chapterIndex: 0, lane: "standard",
        batchJobName: null, migrationProvenance: "synthetic", statusSegments: [] },
      occurrences: [{ occurrenceId: ctx.content.occurrenceIds[0],
                      revisionKey: ctx.rows[0].revisionKey, state: "ready" }] }] });
  w.carryManifest.books[ctx.bookId] = entry;
  return { ...ctx, carry: entry };
}
const drive = async (w, cmd) => {
  const pend = submit(w, cmd);
  assert.equal(pend.state, "pending_operator", JSON.stringify(pend));
  return approve(w, cmd.command_id, pend.payloadSha256);
};

test("flip gate through the protocol fails closed at EXECUTION: a wrong certificate pends at submit (shape is all submit may judge) and refuses at approval, recording no gate", async () => {
  const ctx = carryWorld();
  const { w, bookId, carry } = ctx;
  const chunkReceipt = await drive(w, chunkCmd("od-g1", { migrationId: MIG,
    freezeDigest: FREEZE, bookId, chunkIndex: 0, content: ctx.content, rows: ctx.rows }));
  assert.equal(chunkReceipt.outcome, "applied");
  assert.equal(chunkReceipt.bookComplete, true);
  // Wrong certificate: shape-valid, so it pends…
  const badGate = gateCmd("od-g2", { migrationId: MIG, bookId,
    certificateSha256: WRONG_HASH });
  const pend = submit(w, badGate);
  assert.equal(pend.state, "pending_operator");
  // …and refuses at execution, recording no gate.
  const refused = await approve(w, "od-g2", pend.payloadSha256);
  assert.equal(refused.state, "refused");
  assert.equal(refused.reason, "flip_gate_certificate_mismatch");
  assert.equal(w.harness.rows("migration_gates").length, 0);
  // The honest sequence still completes: carry first, then the
  // gate with the anchored certificate applies.
  assert.equal((await drive(w, positionsCmd("od-g3",
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry }))).outcome, "applied");
  assert.equal((await drive(w, jobsCmd("od-g4",
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry }))).outcome, "applied");
  const good = await drive(w, gateCmd("od-g5", { migrationId: MIG, bookId,
    certificateSha256: chunkReceipt.certificateSha256 }));
  assert.equal(good.outcome, "applied");
  assert.equal(w.harness.rows("migration_gates").length, 1);
});

test("parked_policy carry stays inert through the whole two-phase sequence; quota, settings and grants are untouched by migration", async () => {
  const ctx = carryWorld();
  const { w, bookId, carry } = ctx;
  const before = {
    settings: w.harness.rows("settings").length,
    quotaParks: w.harness.rows("quota_parks").length,
    grants: w.harness.sentGrants.length,
  };
  const chunkReceipt = await drive(w, chunkCmd("od-p1", { migrationId: MIG,
    freezeDigest: FREEZE, bookId, chunkIndex: 0, content: ctx.content, rows: ctx.rows }));
  assert.equal(chunkReceipt.outcome, "applied");
  assert.equal(chunkReceipt.bookComplete, true);
  const pos = await drive(w, positionsCmd("od-p2",
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry }));
  assert.equal(pos.outcome, "applied", JSON.stringify(pos));
  const job = await drive(w, jobsCmd("od-p3",
    { migrationId: MIG, freezeDigest: FREEZE, bookId, carry }));
  assert.equal(job.outcome, "applied", JSON.stringify(job));
  const gate = await drive(w, gateCmd("od-p4", { migrationId: MIG, bookId,
    certificateSha256: chunkReceipt.certificateSha256 }));
  assert.equal(gate.outcome, "applied", JSON.stringify(gate));
  const jobs = w.harness.rows("jobs");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].state, "parked_policy",
    "the carried job is parked — never granted, never resumed");
  assert.equal(w.harness.sentGrants.length, before.grants);
  assert.equal(w.harness.rows("settings").length, before.settings);
  assert.equal(w.harness.rows("quota_parks").length, before.quotaParks);
  const view = w.coord.migrationBookView(bookId);
  assert.equal(view.carry.ok, true, JSON.stringify(view.carry.divergences));
  assert.equal(view.gate.flipped, true);
});

// ============================================================ staging entry: the retired legacy path (§3.4)
// One protocol, no dual paths: the mirrored staging legacy
// dual-header path is RETIRED in this build. The negative
// regression: the old single-request shape (client + operator
// headers on POST /v2/commands) now behaves exactly like a plain
// submit — it pends and executes NOTHING — and execution happens
// only through the approval route.
import { DatabaseSync } from "node:sqlite";
import { OpalReaderCoordinator } from "../v2/worker-entry.js";
import { createR2AudioCache } from "../v2/host/adapters.mjs";
import { RecordingBucket as StagingBucket, pinnedEntry, v1Meta, sha256Hex, syntheticBytes } from "./helpers/migration-fixtures.mjs";

const STAGE_CLIENT = "stage-client-token-synthetic";
const STAGE_OPERATOR = "stage-operator-token-synthetic";
const STAGE_ORIGIN = "https://jedavid33-design.github.io";
class StageSqlCursor {
  constructor(rows) { this.rows = rows ?? []; }
  toArray() { return this.rows; }
  one() {
    if (this.rows.length === 0) throw new Error("Expected exactly one result from SQL query, but got no results.");
    if (this.rows.length > 1) throw new Error("Expected exactly one result from SQL query, but got multiple results.");
    return this.rows[0];
  }
}
class StageSqlFacade {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    if (params.length === 0 && query.includes(";")) { this.db.exec(query); return new StageSqlCursor([]); }
    const stmt = this.db.prepare(query);
    const isQuery = /^\s*(SELECT|WITH)\b/i.test(query);
    return new StageSqlCursor(isQuery ? stmt.all(...params) : (stmt.run(...params), null));
  }
}
function makeStagingWorld() {
  const bucket = new StagingBucket();
  const cache = createR2AudioCache(bucket);
  const manifest = { snapshotDigest: FREEZE, books: {} };
  const db = new DatabaseSync(":memory:");
  const state = { storage: {
    sql: new StageSqlFacade(db),
    transactionSync(fn) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = fn(); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    },
    async setAlarm() {}, async getAlarm() { return null; }, async deleteAlarm() {},
  }, blockConcurrencyWhile: async (fn) => { await fn(); } };
  const doEnv = { OPALREADER_V2_SCOPE: "staging-smoke",
    OPALREADER_ACCESS_TOKEN: STAGE_CLIENT, GENERATION_HALT: "1",
    R2_KEY_PREFIX: "smoke-p8/", OPALREADER_STORAGE: bucket,
    PAGES_ORIGIN: STAGE_ORIGIN,
    approvedFreezeManifest: manifest,
    approvedFreezeChunks: { snapshotDigest: FREEZE, books: {} },
    approvedFreezeCarry: { snapshotDigest: FREEZE, books: {} },
    migrationPrime: (k) => cache.primeForMigration(k) };
  const instance = new OpalReaderCoordinator(state, doEnv);
  const namespace = { idFromName: (n) => n, get: () => ({ fetch: (req) => instance.fetch(req) }) };
  const env = { OPALREADER_ACCESS_TOKEN: STAGE_CLIENT, OPALREADER_V2_SCOPE: "staging-smoke",
    COORDINATOR: namespace, PAGES_ORIGIN: STAGE_ORIGIN,
    OPALREADER_MIGRATION_OPERATOR_TOKEN: STAGE_OPERATOR };
  const call = (path, { method = "GET", body, operator, token = STAGE_CLIENT, headers = {} } = {}) =>
    stagingEntry.fetch(new Request(`https://staging.test${path}`, {
      method,
      headers: { "x-opalreader-token": token, "x-opalreader-scope": "staging-smoke",
        "x-opalreader-instance": "smoke-p8", Origin: STAGE_ORIGIN,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(operator !== undefined ? { "x-opalreader-operator-token": operator } : {}),
        ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }), env);
  const rows = (table) => db.prepare(`SELECT * FROM ${table}`).all();
  return { bucket, manifest, call, rows,
           harness: { rows } };
}

test("staging legacy retirement: the old dual-header single-request execution path is INACCESSIBLE — it pends like any submit and only the approval route executes", async () => {
  const s = makeStagingWorld();
  const bookId = "od-stage-book";
  const bytes = syntheticBytes("od-stage");
  const sha = sha256Hex(bytes);
  const objectKey = `smoke-p8/audio/${sha}.mp3`;
  s.bucket.seed(objectKey, bytes, v1Meta("mp3"));
  const row = { occurrenceId: "od-stage-o1", revisionKey: sha, cacheKey: sha,
    manifest: { sha256: sha, size: bytes.length, format: "mp3" } };
  s.manifest.books[bookId] = pinnedEntry([{ row, etag: `"etag:${objectKey}"` }]);
  const cmd = importCmd("od-stage-1", { migrationId: MIG, freezeDigest: FREEZE,
    bookId, content: { title: bookId, occurrenceIds: ["od-stage-o1"] }, rows: [row] });
  // THE LEGACY SHAPE: both credentials on the submit request.
  const res = await s.call("/v2/commands",
    { method: "POST", operator: STAGE_OPERATOR, body: cmd });
  assert.equal(res.status, 200);
  const pend = await res.json();
  assert.equal(pend.state, "pending_operator",
    "the dual-header request did NOT execute — it pended (the legacy path is gone)");
  assert.equal(s.harness.rows("commands").length, 0);
  assert.equal(s.harness.rows("bindings").length, 0);
  // The approval route without the operator credential refuses…
  let app = await s.call("/v2/command-approvals", { method: "POST",
    body: { commandId: "od-stage-1", payloadSha256: pend.payloadSha256 } });
  assert.equal(app.status, 403);
  // …with a forged admission mark refuses…
  app = await s.call("/v2/command-approvals", { method: "POST",
    headers: { "x-opalreader-operator-admitted": "1" },
    body: { commandId: "od-stage-1", payloadSha256: pend.payloadSha256 } });
  assert.equal(app.status, 403);
  assert.equal(s.harness.rows("commands").length, 0);
  // …and with the operator credential executes exactly once.
  app = await s.call("/v2/command-approvals", { method: "POST", operator: STAGE_OPERATOR,
    body: { commandId: "od-stage-1", payloadSha256: pend.payloadSha256 } });
  assert.equal(app.status, 200);
  assert.equal((await app.json()).outcome, "applied");
  assert.equal(s.harness.rows("bindings").length, 1);
  assert.equal(s.bucket.putCalls.length, 0);
});

test("staging entry: an unknown command receipt is a 404 (the throwing .one() empty path), and a pending receipt reads as the state view", async () => {
  const s = makeStagingWorld();
  const res = await s.call("/v2/commands/od-stage-ghost");
  assert.equal(res.status, 404);
  const bookId = "od-stage-book2";
  const bytes = syntheticBytes("od-stage-2");
  const sha = sha256Hex(bytes);
  const objectKey = `smoke-p8/audio/${sha}.mp3`;
  s.bucket.seed(objectKey, bytes, v1Meta("mp3"));
  const row = { occurrenceId: "od-stage-o1", revisionKey: sha, cacheKey: sha,
    manifest: { sha256: sha, size: bytes.length, format: "mp3" } };
  s.manifest.books[bookId] = pinnedEntry([{ row, etag: `"etag:${objectKey}"` }]);
  const sub = await s.call("/v2/commands", { method: "POST",
    body: importCmd("od-stage-2", { migrationId: MIG, freezeDigest: FREEZE,
      bookId, content: { title: bookId, occurrenceIds: ["od-stage-o1"] }, rows: [row] }) });
  assert.equal(sub.status, 200);
  const look = await s.call("/v2/commands/od-stage-2");
  assert.equal(look.status, 200);
  const view = await look.json();
  assert.equal(view.state, "pending_operator");
  assert.equal(view.storedState, "pending_operator");
  assert.equal(view.projected, false);
});
