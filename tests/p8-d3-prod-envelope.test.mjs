// Opal Reader v2 — P8 D3: production upload-envelope validation
// tests (the creation envelope for the NEW production script,
// opalreader-api-v2-prod).
//
// Builds the real artifact into a temp dir, runs the deterministic
// local prod envelope validator (tools/validate-prod-envelope.mjs)
// on it, and then proves the validator actually bites: each
// negative case introduces one topology defect into a COPY of the
// production metadata and requires a FAIL with the expected
// assertion id. Nothing is uploaded anywhere — D2 is a separate
// gate; this is preflight only.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const VALIDATOR = join(root, "tools", "validate-prod-envelope.mjs");
const BUILDER = join(root, "tools", "build-p8-part1.mjs");

function runValidator(dist) {
  try {
    const out = execFileSync(process.execPath, [VALIDATOR, "--dist", dist], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

const tmp = mkdtempSync(join(tmpdir(), "opal-prod-envelope-"));
const dist = join(tmp, "dist");
execFileSync(process.execPath, [BUILDER, "--out", dist], { encoding: "utf8", stdio: "pipe" });
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

function mutatedDist(fn) {
  const dir = join(tmp, "mut-" + Math.random().toString(36).slice(2, 9));
  cpSync(dist, dir, { recursive: true });
  const metaPath = join(dir, "upload-metadata-prod.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  fn(meta, dir);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  return dir;
}

test("prod envelope: the built artifact validates clean against the documented upload schema + production topology", () => {
  const { code, out } = runValidator(dist);
  assert.equal(code, 0, out);
  assert.match(out, /PROD ENVELOPE VALIDATION: PASS/);
  // The part table pins the production closure: the prod entry and
  // everything it reaches (including the shared coordinator core).
  for (const part of ["v2/worker-entry-prod.js", "v2/worker-entry.js", "v2/api.mjs",
                      "v2/coordinator.mjs", "v2/host/adapters.mjs", "v2/host/build-identity.mjs"])
    assert.ok(out.includes(`part ${part} `), `part table lists ${part}`);
});

test("prod envelope: a queue binding FAILS (P2 — the production script binds no queue)", () => {
  const dir = mutatedDist((m) => {
    m.bindings.push({ type: "queue", name: "OPALREADER_GENERATION", queue_name: "opalreader-generation" });
  });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P2 /);
});

test("prod envelope: an R2_KEY_PREFIX binding FAILS (P3 — absence is the production shape)", () => {
  const dir = mutatedDist((m) => {
    m.bindings.push({ type: "plain_text", name: "R2_KEY_PREFIX", text: "smoke-p8/" });
  });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P3 /);
});

test("prod envelope: the staging scope in production metadata FAILS (P1)", () => {
  const dir = mutatedDist((m) => {
    m.bindings.find((b) => b.name === "OPALREADER_V2_SCOPE").text = "staging-smoke";
  });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P1 /);
});

test("prod envelope: GENERATION_HALT lifted FAILS (P1)", () => {
  const dir = mutatedDist((m) => {
    m.bindings.find((b) => b.name === "GENERATION_HALT").text = "0";
  });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P1 /);
});

test("prod envelope: the DO binding naming the STAGING class FAILS (A4 — the script owns its class)", () => {
  const dir = mutatedDist((m) => {
    m.bindings.find((b) => b.type === "durable_object_namespace").class_name = "OpalReaderCoordinator";
  });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] A4 /);
});

test("prod envelope: a cross-script DO reference (script_name) FAILS (A5)", () => {
  const dir = mutatedDist((m) => {
    m.bindings.find((b) => b.type === "durable_object_namespace").script_name = "opalreader-api-v2";
  });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] A5 /);
});

test("prod envelope: migrations without new_tag FAIL (C4)", () => {
  const dir = mutatedDist((m) => { delete m.migrations.new_tag; });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] C4 /);
});

test("prod envelope: a secret_text binding in the payload FAILS (B4)", () => {
  const dir = mutatedDist((m) => {
    m.bindings.push({ type: "secret_text", name: "OPALREADER_ACCESS_TOKEN", text: "should-never-be-here" });
  });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] B4 /);
});

test("prod envelope: main_module pointing at the staging entry FAILS (A1)", () => {
  const dir = mutatedDist((m) => { m.main_module = "v2/worker-entry.js"; });
  const { code, out } = runValidator(dir);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] A1 /);
});
