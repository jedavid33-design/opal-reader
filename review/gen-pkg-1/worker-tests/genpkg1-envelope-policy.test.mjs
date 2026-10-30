// gen-pkg-1 round-5 (R4-2 item 4; Rowan round-5 ruling, comment
// 6514899384; Julie's approval, comment 6522602149) — the
// seventh-binding release gate.
//
// tools/validate-prod-envelope.mjs now gates the D6 successor's
// deploy spec (worker/p8/deploy-spec-prod-d6.json — the spec the
// deploy gate re-derives the actual upload envelope from) on
// the OPALREADER_PHASE_POLICY binding: present exactly once,
// plain_text, text exactly "enforce", among exactly the specced
// seven bindings (checks P6/P7). Those checks run BEFORE the
// validator's dist inputs, so a missing or malformed seventh
// binding fails the gate even with no dist present — which is
// what this suite exercises: it runs the real validator against
// the real spec and against mutated copies in a temp dir,
// asserting the P6/P7 lines and, for the negative cases, the
// FAIL verdict + exit 1. (The validator's remaining checks need
// a built dist and are covered by the p8 envelope suites and
// the round-5 demonstrated full run in the build logs.)
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const VALIDATOR = join(root, "tools", "validate-prod-envelope.mjs");
const SPEC = join(root, "worker", "p8", "deploy-spec-prod-d6.json");
const NO_DIST = join(tmpdir(), "genpkg1-envelope-no-dist");

const tmp = mkdtempSync(join(tmpdir(), "genpkg1-envelope-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

function runValidator(d6SpecPath) {
  const args = [VALIDATOR, "--dist", NO_DIST];
  if (d6SpecPath) args.push("--d6-spec", d6SpecPath);
  try {
    const out = execFileSync(process.execPath, args, { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

function mutatedSpec(fn) {
  const spec = JSON.parse(readFileSync(SPEC, "utf8"));
  fn(spec);
  const p = join(tmp, `spec-${Math.random().toString(36).slice(2, 9)}.json`);
  writeFileSync(p, JSON.stringify(spec, null, 2) + "\n");
  return p;
}

test("R5 envelope: the real D6 spec passes the seventh-binding gate (P6 + P7)", () => {
  const { out } = runValidator(null);
  assert.match(out, /\[PASS\] P6 /, out);
  assert.match(out, /\[PASS\] P7 /, out);
  assert.ok(!/\[FAIL\] P[67] /.test(out), "no seventh-binding failure on the real spec");
});

test("R5 envelope: a MISSING seventh binding fails the release gate (P6)", () => {
  const p = mutatedSpec((s) => {
    s.bindings = s.bindings.filter((b) => b.name !== "OPALREADER_PHASE_POLICY");
  });
  const { code, out } = runValidator(p);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P6 /);
  assert.match(out, /PROD ENVELOPE VALIDATION: FAIL/);
});

test("R5 envelope: a MALFORMED seventh binding (mistyped value) fails the release gate (P6)", () => {
  const p = mutatedSpec((s) => {
    s.bindings.find((b) => b.name === "OPALREADER_PHASE_POLICY").text = "enfore";
  });
  const { code, out } = runValidator(p);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P6 /);
  assert.match(out, /PROD ENVELOPE VALIDATION: FAIL/);
});

test("R5 envelope: a MALFORMED seventh binding (wrong type) fails the release gate (P6)", () => {
  const p = mutatedSpec((s) => {
    const b = s.bindings.find((x) => x.name === "OPALREADER_PHASE_POLICY");
    b.type = "secret_text";
  });
  const { code, out } = runValidator(p);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P6 /);
  assert.match(out, /PROD ENVELOPE VALIDATION: FAIL/);
});

test("R5 envelope: an EXTRA eighth binding fails the gate (P6 count + P7 set)", () => {
  const p = mutatedSpec((s) => {
    s.bindings.push({ type: "plain_text", name: "EXTRA_BINDING", text: "x" });
  });
  const { code, out } = runValidator(p);
  assert.equal(code, 1);
  assert.match(out, /\[FAIL\] P6 /);
  assert.match(out, /\[FAIL\] P7 /);
  assert.match(out, /PROD ENVELOPE VALIDATION: FAIL/);
});
