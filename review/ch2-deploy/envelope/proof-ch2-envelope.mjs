// gen-pkg-1 DEPLOY-GATE PROOF HARNESS — ACTUAL D6 upload envelope.
//
// Prepared for Rowan's round-6 sign-off condition A (board issue
// #15, comment 6523652449): the round-5 validator's 26/26 run
// validated the D6 successor SPEC (P6/P7) plus the OLD pre-D6
// production dist (main_module v2/worker-entry-prod.js, 5
// bindings, D6 modules EXCLUDED). This harness closes that gap:
// it assembles the ACTUAL D6 upload envelope from the pinned
// candidate tree (ui1-review 5ae38942e493a4b53f541b5e1f589060d58d158d)
// exactly as the proven G4 / seed-fix halted deploys assembled
// theirs, and validates THAT envelope against the pinned D6 spec
// (worker/p8/deploy-spec-prod-d6.json).
//
// Assembly conventions mirrored from the G4 / seed-fix D1–D2
// records (~/workspace/d6-build/deploy-evidence/{g4,seedfix-deploy}/):
//   * module parts = the import closure rooted at the D6 entry
//     (v2/worker-entry-prod-d6.js) over the candidate tree's
//     worker/ module set (part name = "v2/" + path under worker/);
//   * host/build-identity.mjs is the sole stamp part: its part
//     bytes carry BUILD_COMMIT = the pin; the tree on disk keeps
//     "UNBUILT" (verified);
//   * metadata = { main_module, compatibility_date,
//     compatibility_flags, bindings, observability } derived from
//     the D6 spec, with the spec's seven bindings PLUS the three
//     required secrets as {"type":"inherit","name":...} entries
//     (names only — no secret values anywhere);
//   * NO migrations key (the D6 spec applies no DO migration:
//     durable_object_migrations.applied_for_d6 == false);
//   * every module part: name == filename == part name,
//     Content-Type application/javascript+module (AGENTS.md:
//     ES-module uploads need main_module + filename attributes).
// Queue topology note: a script upload cannot attach a queue
// consumer (proven at G4 attempt 1; consumers are queue-side
// state). The envelope therefore carries the PRODUCER binding;
// the consumer declaration is validated here against the spec,
// and the deploy plan requires read-back verification of the
// live consumer at the gate. The G4-era metadata's inert
// queues.consumers entry is deliberately NOT reproduced: it was
// ignored by the API then, and omitting it changes nothing
// operationally (disclosed in the proof report for Rowan).
//
// LOCAL ONLY: assembles in memory + writes artifacts under this
// directory. Nothing is transmitted anywhere. The candidate tree
// is only READ.
//
// Usage:
//   node proof-d6-envelope.mjs                 validate the real envelope (must PASS, exit 0)
//   node proof-d6-envelope.mjs --mutate drop-seventh   (must FAIL, exit 1)
//   node proof-d6-envelope.mjs --mutate typo-enforce   (must FAIL, exit 1)
//   node proof-d6-envelope.mjs --mutate wrong-entry    (must FAIL, exit 1)
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CANDIDATE = "/home/hatch/workspace/ch2-program/fix/worker-build";
const WORKER_DIR = join(CANDIDATE, "worker");
const PIN = "288508073b5218a6e0dd90b68d497a331ad872b6";
const EXPECTED_ENTRY = "v2/worker-entry-prod-d6.js";

const args = process.argv.slice(2);
const mutate = args.includes("--mutate") ? args[args.indexOf("--mutate") + 1] : null;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const results = [];
function check(id, ok, label, detail = "") {
  results.push({ id, ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} ${label}${detail ? ` — ${detail}` : ""}`);
}

// ------------------------------------------------------------- inputs
const spec = JSON.parse(readFileSync(join(WORKER_DIR, "p8", "deploy-spec-prod-d6.json"), "utf8"));

// Candidate module set: every .mjs/.js under worker/, part name "v2/<rel>".
const workerFiles = new Map(); // partName -> { bytes, treeRel }
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(mjs|js)$/.test(name)) {
      const rel = relative(WORKER_DIR, p).split("\\").join("/");
      workerFiles.set("v2/" + rel, { bytes: readFileSync(p), treeRel: "worker/" + rel });
    }
  }
})(WORKER_DIR);

// Build-identity stamp (part-only; tree untouched), exactly the
// builder's substitution (tools/build-p8-part1.mjs).
const BI_PART = "v2/host/build-identity.mjs";
const biTree = workerFiles.get(BI_PART);
const biTreeText = biTree.bytes.toString("utf8");
const unbuiltCount = (biTreeText.match(/BUILD_COMMIT = "UNBUILT"/g) || []).length;
const stampedText = biTreeText.replace(/export const BUILD_COMMIT = "[^"]*";/,
  `export const BUILD_COMMIT = "${PIN}";`);
const stampedBytes = Buffer.from(stampedText, "utf8");
const partBytes = (name) => name === BI_PART ? stampedBytes : workerFiles.get(name).bytes;

// ------------------------------------------------------- import closure
const SPEC_RE = /(?:import\s+(?:[^"']*?\s+from\s+)?|export\s+[^"']*?\s+from\s+|import\s*\()\s*["']([^"']+)["']/g;
function specifiersOf(bytes) {
  const src = bytes.toString("utf8"); const out = []; let m;
  SPEC_RE.lastIndex = 0;
  while ((m = SPEC_RE.exec(src))) out.push(m[1]);
  return out;
}
const posixDir = (p) => p.split("/").slice(0, -1).join("/");
function resolveRel(fromPart, spec2) {
  const parts = (posixDir(fromPart) + "/" + spec2).split("/");
  const out = [];
  for (const s of parts) { if (s === "" || s === ".") continue; if (s === "..") out.pop(); else out.push(s); }
  return out.join("/");
}
const ENTRY = spec.main_module;
const closure = new Set();
const unresolved = [];
const bareSpecifiers = new Set();
if (workerFiles.has(ENTRY)) {
  closure.add(ENTRY);
  const queue = [ENTRY];
  while (queue.length) {
    const cur = queue.shift();
    for (const s of specifiersOf(partBytes(cur))) {
      if (!s.startsWith(".")) { bareSpecifiers.add(s); continue; }
      const r = resolveRel(cur, s);
      if (!workerFiles.has(r)) unresolved.push(`${cur} -> ${s} (=> ${r})`);
      else if (!closure.has(r)) { closure.add(r); queue.push(r); }
    }
  }
}
const partNames = [...closure].sort();

// ------------------------------------------------------------- metadata
const inheritSecrets = (spec.secret_bindings_required || [])
  .map((s) => s.name).sort()
  .map((name) => ({ name, type: "inherit" }));
let metadata = {
  main_module: spec.main_module,
  compatibility_date: spec.compatibility_date,
  compatibility_flags: spec.compatibility_flags,
  bindings: [...spec.bindings, ...inheritSecrets],
  observability: spec.observability,
};
if (mutate === "drop-seventh") {
  metadata = { ...metadata, bindings: metadata.bindings.filter((b) => b.name !== "OPALREADER_PHASE_POLICY") };
} else if (mutate === "typo-enforce") {
  metadata = { ...metadata, bindings: metadata.bindings.map((b) =>
    b.name === "OPALREADER_PHASE_POLICY" ? { ...b, text: "enfore" } : b) };
} else if (mutate === "wrong-entry") {
  metadata = { ...metadata, main_module: "v2/worker-entry-prod.js" };
}
const metadataBuf = Buffer.from(JSON.stringify(metadata, null, 2) + "\n", "utf8");

// ------------------------------------------------- envelope assembly
const BOUNDARY = "----opalreader-d6-actual-envelope-proof";
const MODULE_MIME = "application/javascript+module";
function assemble(metaBuf, names) {
  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "utf8"));
  push(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n`);
  chunks.push(metaBuf); push("\r\n");
  for (const name of names) {
    push(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}"\r\nContent-Type: ${MODULE_MIME}\r\n\r\n`);
    chunks.push(partBytes(name)); push("\r\n");
  }
  push(`--${BOUNDARY}--\r\n`);
  return Buffer.concat(chunks);
}
function parseBack(body) {
  const text = body.toString("binary");
  const parts = [];
  for (const seg of text.split(`--${BOUNDARY}`)) {
    if (!seg.startsWith("\r\n")) continue;
    const headEnd = seg.indexOf("\r\n\r\n");
    if (headEnd < 0) continue;
    const head = seg.slice(2, headEnd);
    let payload = seg.slice(headEnd + 4);
    if (payload.endsWith("\r\n")) payload = payload.slice(0, -2);
    parts.push({
      name: /name="([^"]*)"/.exec(head)?.[1],
      filename: /filename="([^"]*)"/.exec(head)?.[1],
      type: /Content-Type: ([^\r\n]*)/.exec(head)?.[1],
      bytes: Buffer.from(payload, "binary"),
    });
  }
  return parts;
}
const envelope = assemble(metadataBuf, partNames);
const parsed = parseBack(envelope);
const metaPart = parsed.find((p) => p.name === "metadata");
const moduleParts = parsed.filter((p) => p.name !== "metadata");

// ------------------------------------------------------------- checks
check("E1", spec.script_name === "opalreader-api-v2-prod",
  "spec is the pinned D6 successor spec for opalreader-api-v2-prod",
  mutate ? `mutation mode: ${mutate} (metadata mutated AFTER spec read; spec itself intact)` : `spec main_module=${spec.main_module}`);
check("E2", metadata.main_module === EXPECTED_ENTRY && metadata.main_module === spec.main_module && partNames.includes(metadata.main_module),
  "entry module is the D6 production entry, exactly as specced, and is an actual envelope part",
  `main_module=${JSON.stringify(metadata.main_module)}`);
check("E3", unresolved.length === 0 && closure.size > 0,
  "every relative import in the D6 closure resolves to an exactly-named part",
  unresolved.length ? "unresolved: " + unresolved.join("; ") : `${closure.size} modules in closure`);
check("E4", [...bareSpecifiers].every((s) => s.startsWith("node:")),
  "bare specifiers are node:-only (covered by nodejs_compat)",
  [...bareSpecifiers].join(", ") || "none");

// Part table + per-part hash comparison against the candidate tree.
console.log("\nPART TABLE (part name — bytes — sha256 — tree source)");
const partManifest = [];
let hashOk = true;
for (const name of partNames) {
  const bytes = partBytes(name);
  const treeBytes = workerFiles.get(name).bytes;
  let match;
  if (name === BI_PART) {
    // Stamped part must equal the tree bytes with ONLY the pin
    // substituted for "UNBUILT" (and the tree must still be UNBUILT).
    match = stampedText.replace(PIN, "UNBUILT") === biTreeText && unbuiltCount === 1 && stampedBytes.length !== 0;
  } else {
    match = bytes.equals(treeBytes);
  }
  if (!match) hashOk = false;
  partManifest.push({ part: name, bytes: bytes.length, sha256: sha256(bytes), tree: workerFiles.get(name).treeRel, stamped: name === BI_PART });
  console.log(`  ${name}  ${bytes.length} B  sha256 ${sha256(bytes)}  <- ${workerFiles.get(name).treeRel}${name === BI_PART ? "  [STAMPED part-only: BUILD_COMMIT = pin; tree keeps UNBUILT]" : ""}`);
}
check("E5", hashOk,
  "every envelope part hash-compares to the signed candidate tree (build-identity: stamped part == tree with ONLY the pin substituted; tree still UNBUILT)",
  `${partNames.length} parts, ${partManifest.reduce((a, p) => a + p.bytes, 0)} total module bytes`);
check("E6", (stampedText.match(new RegExp(PIN, "g")) || []).length === 1 && !stampedText.includes("UNBUILT"),
  "stamped build-identity carries the signed pin exactly once",
  `pin=${PIN}`);

const specBindings = metadata.bindings.filter((b) => b.type !== "inherit");
const pp = specBindings.filter((b) => b.name === "OPALREADER_PHASE_POLICY");
check("E7", specBindings.length === 7,
  "exactly SEVEN spec bindings in the assembled metadata",
  `count=${specBindings.length}: ${specBindings.map((b) => b.name).join(", ")}`);
const EXPECTED = {
  COORDINATOR: ["durable_object_namespace", { class_name: "OpalReaderCoordinatorProd" }],
  OPALREADER_STORAGE: ["r2_bucket", { bucket_name: "opalreader-storage" }],
  ALLOWED_ORIGIN: ["plain_text", { text: "https://jedavid33-design.github.io" }],
  OPALREADER_V2_SCOPE: ["plain_text", { text: "production" }],
  GENERATION_HALT: ["plain_text", { text: "1" }],
  OPALREADER_PHASE_POLICY: ["plain_text", { text: "enforce" }],
  OPALREADER_GENERATION_V2: ["queue", { queue_name: "opalreader-generation-v2" }],
};
let e8ok = specBindings.length === 7 && new Set(specBindings.map((b) => b.name)).size === 7;
const e8problems = [];
for (const [name, [type, extra]] of Object.entries(EXPECTED)) {
  const b = specBindings.find((x) => x.name === name);
  if (!b) { e8ok = false; e8problems.push(`${name} missing`); continue; }
  if (b.type !== type) { e8ok = false; e8problems.push(`${name} type ${b.type} != ${type}`); }
  for (const [k, v] of Object.entries(extra)) if (b[k] !== v) { e8ok = false; e8problems.push(`${name}.${k}=${JSON.stringify(b[k])} != ${JSON.stringify(v)}`); }
}
for (const b of specBindings) if (!(b.name in EXPECTED)) { e8ok = false; e8problems.push(`extra binding ${b.name}`); }
check("E8", e8ok, "each of the seven bindings has the specced name, type, and value-class fields",
  e8problems.join("; ") || "all seven exact");
check("E9", pp.length === 1 && pp[0].type === "plain_text" && pp[0].text === "enforce" &&
            Object.keys(pp[0]).sort().join(",") === "name,text,type",
  "OPALREADER_PHASE_POLICY present exactly once, plain_text \"enforce\", no extra keys",
  JSON.stringify(pp));
check("E10", metadata.bindings.length === 10 && inheritSecrets.length === 3 &&
             inheritSecrets.every((b) => Object.keys(b).sort().join(",") === "name,type") &&
             !metadata.bindings.some((b) => b.type === "secret_text") &&
             !metadataBuf.toString("utf8").includes("secret_text"),
  "three required secrets ride as inherit-by-name only (10 bindings total); zero secret_text, zero secret values in the envelope",
  `inherit: ${inheritSecrets.map((b) => b.name).join(", ")}`);
check("E11", !("migrations" in metadata) && spec.durable_object_migrations?.applied_for_d6 === false &&
             spec.durable_object_migrations?.new_tag === null &&
             (spec.durable_object_migrations?.new_sqlite_classes || []).length === 0,
  "NO migrations key in the upload metadata; the D6 spec applies NO Durable Object migration (existing v1 migration / existing class only)");
const entrySrc = partBytes(ENTRY).toString("utf8");
const doBinding = specBindings.find((b) => b.type === "durable_object_namespace");
check("E12", !!doBinding && doBinding.class_name === "OpalReaderCoordinatorProd" && !("script_name" in doBinding) &&
             new RegExp(`export\\s+class\\s+OpalReaderCoordinatorProd\\b`).test(entrySrc) &&
             spec.do_topology?.coordinator_class === "OpalReaderCoordinatorProd" && spec.do_topology?.migration_tag === "v1",
  "DO topology: binding names the EXISTING production class OpalReaderCoordinatorProd (no script_name, no new class); the D6 entry exports that same class; spec records the existing v1 migration");
const producers = spec.queue_producers || [];
const consumers = spec.queue_consumers || [];
check("E13", producers.length === 1 && producers[0].binding === "OPALREADER_GENERATION_V2" && producers[0].queue === "opalreader-generation-v2" &&
             specBindings.some((b) => b.type === "queue" && b.queue_name === "opalreader-generation-v2") &&
             consumers.length === 1 && consumers[0].queue === "opalreader-generation-v2" &&
             consumers[0].max_batch_size === 10 && consumers[0].max_retries === 3 &&
             !specBindings.some((b) => b.queue_name === "opalreader-generation" || b.name === "R2_KEY_PREFIX"),
  "queue topology per spec: producer binding OPALREADER_GENERATION_V2 -> opalreader-generation-v2 in the envelope; spec declares exactly one consumer (this script, batch 10 / retries 3) on that queue; the v1 queue is not bound; no R2_KEY_PREFIX",
  "consumer attachment itself is queue-side state (upload metadata cannot create it — G4 attempt 1) and is read-back-verified at the deploy gate per the plan");
check("E14", metadata.compatibility_date === "2026-08-29" && JSON.stringify(metadata.compatibility_flags) === JSON.stringify(["nodejs_compat"]),
  "compatibility preserved: 2026-08-29 + nodejs_compat",
  `date=${metadata.compatibility_date}, flags=${JSON.stringify(metadata.compatibility_flags)}`);
check("E15", JSON.stringify(metadata.observability) === JSON.stringify(spec.observability) &&
             spec.observability.enabled === true && spec.observability.logs?.enabled === true && spec.observability.logs?.persist_invocations === true,
  "observability object carried exactly per spec (enabled, head_sampling_rate 1, logs enabled + persist_invocations)",
  JSON.stringify(metadata.observability));
let f1ok = !!metaPart && metaPart.bytes.equals(metadataBuf) && moduleParts.length === partNames.length;
if (f1ok) for (const p of moduleParts) {
  if (!workerFiles.has(p.name) || !p.bytes.equals(partBytes(p.name)) || p.filename !== p.name || p.type !== MODULE_MIME) { f1ok = false; break; }
}
check("E16", f1ok,
  "multipart envelope round-trips byte-identically; every module part has filename == part name and Content-Type application/javascript+module",
  `${parsed.length} parts total (metadata + ${moduleParts.length} modules), envelope ${envelope.length} bytes`);
check("E17", specBindings.find((b) => b.name === "GENERATION_HALT")?.text === "1",
  "the deploy lands HALTED: GENERATION_HALT \"1\" in the assembled metadata (spec value; the live \"0\" is not carried into the successor upload)");
check("E18", Object.keys(metadata).sort().join(",") === "bindings,compatibility_date,compatibility_flags,main_module,observability",
  "metadata top-level keys are exactly the proven D6 upload set (no extra keys)",
  Object.keys(metadata).join(", "));

// ------------------------------------------------------------- outputs
if (!mutate) {
  writeFileSync(join(here, "assembled-metadata.json"), metadataBuf);
  writeFileSync(join(here, "assembled-envelope.bin"), envelope);
  writeFileSync(join(here, "parts-manifest.json"),
    Buffer.from(JSON.stringify({ pin: PIN, entry: ENTRY, totalModuleBytes: partManifest.reduce((a, p) => a + p.bytes, 0), envelopeBytes: envelope.length, parts: partManifest }, null, 2) + "\n", "utf8"));
}
const failed = results.filter((r) => !r.ok);
const summary = { mutate: mutate || "none", pin: PIN, parts: partNames.length, checks: results.length, passed: results.length - failed.length, failed: failed.map((f) => f.id) };
writeFileSync(join(here, mutate ? `proof-result-${mutate}.json` : "proof-result.json"),
  Buffer.from(JSON.stringify({ ...summary, results }, null, 2) + "\n", "utf8"));
console.log(`\nACTUAL D6 ENVELOPE VALIDATION: ${failed.length === 0 ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length} assertions)`);
if (failed.length) { console.log("failed: " + failed.map((f) => f.id).join(", ")); process.exit(1); }
