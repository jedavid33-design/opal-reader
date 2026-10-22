// Opal Reader v2 — Part 2 preflight: upload-envelope validation tests
// (Rowan 6347245912).
//
// Builds the real artifact into a temp dir, runs the deterministic
// local envelope validator (tools/validate-upload-envelope.mjs) on it,
// and then proves the validator actually bites: each negative case
// reintroduces one of the pre-amendment envelope defects (or a new one)
// into a COPY of the metadata and requires a FAIL with the expected
// assertion id.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VALIDATOR = join(root, "tools", "validate-upload-envelope.mjs");
const BUILDER = join(root, "tools", "build-p8-part1.mjs");

function runValidator(dist) {
  try {
    const out = execFileSync(process.execPath, [VALIDATOR, "--dist", dist], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

const tmp = mkdtempSync(join(tmpdir(), "opal-envelope-"));
const dist = join(tmp, "dist");
execFileSync(process.execPath, [BUILDER, "--out", dist], { encoding: "utf8", stdio: "pipe" });
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

function mutatedDist(fn) {
  const dir = join(tmp, "mut-" + Math.random().toString(36).slice(2, 9));
  cpSync(dist, dir, { recursive: true });
  const metaPath = join(dir, "upload-metadata.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  fn(meta, dir);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  return dir;
}

test("envelope: the built artifact validates clean against the documented upload schema", () => {
  const { code, out } = runValidator(dist);
  assert.equal(code, 0, out);
  assert.match(out, /ENVELOPE VALIDATION: PASS/);
  // The part table pins the mapping: bundle root dist worker/, part name
  // = path relative to it; entry + its whole closure present as parts.
  for (const part of ["v2/worker-entry.js", "v2/api.mjs", "v2/coordinator.mjs", "v2/executor.mjs", "v2/host/adapters.mjs", "v2/host/build-identity.mjs"])
    assert.ok(out.includes(`part ${part} `), `part table lists ${part}`);
  // Non-closure tree files are excluded from the envelope, by name.
  for (const excluded of ["v2/p8/freeze-worker.js", "v2/p8/deploy-spec.json", "v2/migration/verify.mjs", "v2/client/surfaces.mjs"])
    assert.ok(out.includes(excluded), `excluded list names ${excluded}`);
});

test("envelope: pre-amendment migrations without new_tag FAIL (C4)", () => {
  const dir = mutatedDist((m) => { delete m.migrations.new_tag; });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] C4 /);
});

test("envelope: queue binding with producer_only FAIL (B3)", () => {
  const dir = mutatedDist((m) => { m.bindings.find((b) => b.type === "queue").producer_only = true; });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] B3 /);
});

test("envelope: top-level queue_consumers key FAIL (D1)", () => {
  const dir = mutatedDist((m) => { m.queue_consumers = []; });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] D1 /);
});

test("envelope: main_module that names no part FAIL (A1)", () => {
  const dir = mutatedDist((m) => { m.main_module = "worker-entry.js"; });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] A1 /);
});

test("envelope: migrations as an array FAIL (C1)", () => {
  const dir = mutatedDist((m) => { m.migrations = [m.migrations]; });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] C1 /);
});

test("envelope: a missing closure module FAIL (A0/A2)", () => {
  const dir = mutatedDist((m, d) => { rmSync(join(d, "worker", "v2", "host", "adapters.mjs")); });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] (A0|A2) /);
});

// ------------------------------------------------- UPDATE envelope
// F1 revision, Proof 2 (Rowan 6349834892): the SECOND upload is an
// update of the existing script, validated separately by
// tools/validate-update-envelope.mjs against the committed overlay
// tools/update-envelope.json. The positive case must pass 13/13;
// each negative reintroduces one update-specific defect into a COPY
// of the envelope and requires a FAIL with the expected assertion id.
const UPDATE_VALIDATOR = join(root, "tools", "validate-update-envelope.mjs");
const UPDATE_ENVELOPE = join(root, "tools", "update-envelope.json");

function runUpdateValidator(envelope) {
  try {
    const out = execFileSync(process.execPath, [UPDATE_VALIDATOR, "--dist", dist, "--envelope", envelope], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

function mutatedEnvelope(fn) {
  const path = join(tmp, "env-" + Math.random().toString(36).slice(2, 9) + ".json");
  const env = JSON.parse(readFileSync(UPDATE_ENVELOPE, "utf8"));
  fn(env);
  writeFileSync(path, JSON.stringify(env, null, 2) + "\n");
  return path;
}

test("update-envelope: the committed overlay validates clean against the built artifact", () => {
  const { code, out } = runUpdateValidator(UPDATE_ENVELOPE);
  assert.equal(code, 0, out);
  assert.match(out, /UPDATE ENVELOPE VALIDATION: PASS \(13\/13 assertions\)/);
  for (const part of ["v2/worker-entry.js", "v2/api.mjs", "v2/coordinator.mjs", "v2/executor.mjs", "v2/host/adapters.mjs", "v2/host/build-identity.mjs"])
    assert.ok(out.includes(part), `update closure lists ${part}`);
});

test("update-envelope: replaying the creation migration FAIL (U2/U3)", () => {
  const creation = JSON.parse(readFileSync(join(dist, "upload-metadata.json"), "utf8"));
  const path = mutatedEnvelope((e) => { e.metadata.migrations = creation.migrations; });
  const { code, out } = runUpdateValidator(path);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] U2 /);
  assert.match(out, /\[FAIL\] U3 /);
});

test("update-envelope: omitting the inherit binding FAIL (U4)", () => {
  const path = mutatedEnvelope((e) => {
    e.metadata.bindings = e.metadata.bindings.filter((b) => b.type !== "inherit");
  });
  const { code, out } = runUpdateValidator(path);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] U4 /);
});

test("update-envelope: renaming the inherited secret FAIL (U4)", () => {
  const path = mutatedEnvelope((e) => {
    e.metadata.bindings.find((b) => b.type === "inherit").name = "OPALREADER_ACCESS_TOKN";
  });
  const { code, out } = runUpdateValidator(path);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] U4 /);
});

test("update-envelope: dropping a configuration binding FAIL (U6)", () => {
  const path = mutatedEnvelope((e) => {
    e.metadata.bindings = e.metadata.bindings.filter((b) => b.name !== "OPALREADER_STORAGE");
  });
  const { code, out } = runUpdateValidator(path);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] U6 /);
});

test("update-envelope: altering a configuration binding FAIL (U6)", () => {
  const path = mutatedEnvelope((e) => {
    e.metadata.bindings.find((b) => b.name === "GENERATION_HALT").text = "0";
  });
  const { code, out } = runUpdateValidator(path);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] U6 /);
});

test("update-envelope: dropping bindings_inherit=strict FAIL (U5)", () => {
  const path = mutatedEnvelope((e) => { delete e.request.query.bindings_inherit; });
  const { code, out } = runUpdateValidator(path);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] U5 /);
});
