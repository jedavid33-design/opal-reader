// Opal Reader v2 — D3: deterministic local upload-envelope
// validation for the PRODUCTION script (opalreader-api-v2-prod).
//
// Usage: node tools/validate-prod-envelope.mjs [--dist <dir>] [--d6-spec <file>]
// Default dist: dist/p8-part1 (the builder output,
// tools/build-p8-part1.mjs).
//
// The production counterpart of tools/validate-upload-envelope.mjs
// (which validates the staging script and is unchanged). This
// assembles the EXACT multipart envelope a future D2 upload of the
// production script would send — in memory only; nothing is
// transmitted anywhere — and asserts it against Cloudflare's
// DOCUMENTED Workers Script Upload schema plus the production
// topology invariants of the corrected cutover plan (§S4):
//
//   * the script OWNS its coordinator class: the DO binding's
//     class_name is OpalReaderCoordinatorProd, the class the
//     production entry part actually exports, and migrations
//     .new_sqlite_classes is exactly [that class], with a new_tag
//     ("v1" — the first migration on THIS script's own new
//     namespace; tags are per-script/per-namespace);
//   * production invariants in the bindings themselves: scope
//     "production", GENERATION_HALT "1", NO queue binding of any
//     kind, NO R2_KEY_PREFIX binding (its absence is the
//     production namespace shape), exactly the five specced
//     bindings;
//   * no secret_text bindings in the payload (both production
//     secrets are dashboard-set by Julie at D2 and carried by
//     inherit on later uploads), and no provider-secret bindings.
//
// ROUND 5 (R4-2; Rowan round-5 ruling, comment 6514899384,
// item 4; Julie's approval, comment 6522602149): this validator
// ALSO gates the D6 successor's deploy spec
// (worker/p8/deploy-spec-prod-d6.json — the spec the gen-pkg-1
// deploy gate will re-derive the actual upload envelope from)
// on its SEVENTH binding: OPALREADER_PHASE_POLICY must be
// present exactly once, as plain_text with text exactly
// "enforce", among exactly seven bindings (checks P6/P7 below,
// run before the dist checks so a missing or malformed seventh
// binding fails the release gate even when no dist is present).
// Point --d6-spec at another file to validate a variant spec.
//
// Deterministic: fixed boundary, sorted parts, no timestamps, no
// randomness, no network. Exit 0 iff every assertion passes.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const distDir = args.includes("--dist") ? resolve(root, args[args.indexOf("--dist") + 1]) : join(root, "dist", "p8-part1");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const results = [];
function check(id, ok, label, detail = "") {
  results.push({ id, ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} ${label}${detail ? ` — ${detail}` : ""}`);
}

function readDist(rel) {
  const p = join(distDir, rel);
  return existsSync(p) ? readFileSync(p) : null;
}

// ------------------------------------- D6 successor spec gate (R5)
// The seventh-binding checks (P6/P7). They read the D6 deploy
// SPEC directly from the source tree (or --d6-spec), not from
// the dist: the dist carries the BASE production spec emission,
// while the D6 successor's actual upload envelope is re-derived
// from this spec at its deploy gate — gating the spec gates
// every envelope derived from it. A failure here exits before
// the dist checks: the release gate fails on the spec alone.
const d6SpecPath = args.includes("--d6-spec")
  ? resolve(root, args[args.indexOf("--d6-spec") + 1])
  : join(root, "worker", "p8", "deploy-spec-prod-d6.json");
let d6Spec = null;
try { d6Spec = JSON.parse(readFileSync(d6SpecPath, "utf8")); } catch { d6Spec = null; }
const d6Bindings = d6Spec && Array.isArray(d6Spec.bindings) ? d6Spec.bindings : [];
const phasePolicyBindings = d6Bindings.filter((b) => b.name === "OPALREADER_PHASE_POLICY");
const ppb = phasePolicyBindings[0] || {};
check("P6", !!d6Spec && d6Bindings.length === 7 && phasePolicyBindings.length === 1 &&
            ppb.type === "plain_text" && ppb.text === "enforce" &&
            Object.keys(ppb).sort().join(",") === "name,text,type",
  "D6 successor spec carries the seventh binding exactly once: OPALREADER_PHASE_POLICY plain_text \"enforce\" (7 bindings total)",
  d6Spec ? `bindings=${d6Bindings.length}, phasePolicy=${JSON.stringify(phasePolicyBindings.map((b) => [b.type, b.text]))}`
         : `D6 spec unreadable at ${d6SpecPath}`);
const D6_EXPECTED_BINDINGS = {
  COORDINATOR: "durable_object_namespace",
  OPALREADER_STORAGE: "r2_bucket",
  ALLOWED_ORIGIN: "plain_text",
  OPALREADER_V2_SCOPE: "plain_text",
  GENERATION_HALT: "plain_text",
  OPALREADER_PHASE_POLICY: "plain_text",
  OPALREADER_GENERATION_V2: "queue",
};
const d6Names = d6Bindings.map((b) => b.name);
const d6ShapeOk = !!d6Spec && d6Names.length === new Set(d6Names).size &&
  Object.entries(D6_EXPECTED_BINDINGS).every(([name, type]) => {
    const b = d6Bindings.find((x) => x.name === name);
    return !!b && b.type === type;
  }) && d6Bindings.every((b) => D6_EXPECTED_BINDINGS[b.name] === b.type);
check("P7", d6ShapeOk,
  "D6 successor spec binding set is exactly the specced seven (names + types, no duplicates, no extras)",
  `names=${d6Names.join(", ")}`);
if (results.some((r) => !r.ok)) {
  const failedNow = results.filter((r) => !r.ok);
  console.log(`\nPROD ENVELOPE VALIDATION: FAIL (${results.length - failedNow.length}/${results.length} assertions)`);
  console.log("failed: " + failedNow.map((f) => f.id).join(", "));
  process.exit(1);
}

// ------------------------------------------------------------ inputs
const manifestBuf = readDist("manifest.json");
const metadataBuf = readDist("upload-metadata-prod.json");
const specBuf = readDist("deploy-spec-prod.json");
if (!manifestBuf || !metadataBuf || !specBuf) {
  console.log("[FAIL] A0 artifact inputs present — manifest.json / upload-metadata-prod.json / deploy-spec-prod.json missing under " + distDir);
  process.exit(1);
}
const manifest = JSON.parse(manifestBuf.toString("utf8"));
const metadata = JSON.parse(metadataBuf.toString("utf8"));
const spec = JSON.parse(specBuf.toString("utf8"));

// ------------------------------------------------- A0: artifact intact
let a0ok = true; const missing = [];
const workerFiles = new Map();
for (const f of manifest.files) {
  const bytes = readDist(f.path);
  if (!bytes) { a0ok = false; missing.push(f.path); continue; }
  if (sha256(bytes) !== f.sha256 || bytes.length !== f.bytes) { a0ok = false; missing.push(f.path + " (hash/size mismatch)"); }
  if (f.path.startsWith("worker/")) workerFiles.set(f.path.slice("worker/".length), { distRel: f.path, bytes });
}
check("A0", a0ok, "artifact files match the build manifest (sha256 + size)",
  a0ok ? `${manifest.files.length} files, source commit ${manifest.sourceCommit}` : "mismatch: " + missing.join(", "));

// ------------------------------------------------- import closure
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
const ENTRY = metadata.main_module;
const closure = new Set();
const unresolved = [];
const bareSpecifiers = new Set();
if (typeof ENTRY === "string" && workerFiles.has(ENTRY)) {
  closure.add(ENTRY);
  const queue = [ENTRY];
  while (queue.length) {
    const cur = queue.shift();
    for (const s of specifiersOf(workerFiles.get(cur).bytes)) {
      if (!s.startsWith(".")) { bareSpecifiers.add(s); continue; }
      const r = resolveRel(cur, s);
      if (!workerFiles.has(r)) unresolved.push(`${cur} -> ${s} (=> ${r})`);
      else if (!closure.has(r)) { closure.add(r); queue.push(r); }
    }
  }
}
const partNames = [...closure].sort();

check("A1", typeof ENTRY === "string" && ENTRY === "v2/worker-entry-prod.js" && partNames.includes(ENTRY),
  "main_module is the production entry and names an actual part", `main_module=${JSON.stringify(ENTRY)}`);
check("A2", unresolved.length === 0 && closure.size > 0,
  "every relative import in the closure resolves to an exactly-named part",
  unresolved.length ? "unresolved: " + unresolved.join("; ") : `${closure.size} modules in closure; bare specifiers: ${[...bareSpecifiers].join(", ") || "none"} (node: covered by nodejs_compat)`);

// ------------------------------------------------- envelope assembly
const BOUNDARY = "----opalreader-preflight-envelope-prod";
const MODULE_MIME = "application/javascript+module";
function assemble() {
  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "utf8"));
  push(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n`);
  chunks.push(metadataBuf); push("\r\n");
  for (const name of partNames) {
    push(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"; filename="${name}"\r\nContent-Type: ${MODULE_MIME}\r\n\r\n`);
    chunks.push(workerFiles.get(name).bytes); push("\r\n");
  }
  push(`--${BOUNDARY}--\r\n`);
  return Buffer.concat(chunks);
}
function parseBack(body) {
  const text = body.toString("binary");
  const segments = text.split(`--${BOUNDARY}`);
  const parts = [];
  for (const seg of segments) {
    if (!seg.startsWith("\r\n")) continue;
    const headEnd = seg.indexOf("\r\n\r\n");
    if (headEnd < 0) continue;
    const head = seg.slice(2, headEnd);
    let payload = seg.slice(headEnd + 4);
    if (payload.endsWith("\r\n")) payload = payload.slice(0, -2);
    const name = /name="([^"]*)"/.exec(head)?.[1];
    const type = /Content-Type: ([^\r\n]*)/.exec(head)?.[1];
    parts.push({ name, type, bytes: Buffer.from(payload, "binary") });
  }
  return parts;
}
const parsed = parseBack(assemble());
const metaPart = parsed.find((p) => p.name === "metadata");
const moduleParts = parsed.filter((p) => p.name !== "metadata");
let f1ok = !!metaPart && metaPart.bytes.equals(metadataBuf) && moduleParts.length === partNames.length;
if (f1ok) for (const p of moduleParts) {
  const src = workerFiles.get(p.name);
  if (!src || !p.bytes.equals(src.bytes)) { f1ok = false; break; }
}
check("F1", f1ok, "multipart envelope round-trips byte-identically (metadata + every module part)",
  `${parsed.length} parts total`);
check("A3", moduleParts.every((p) => p.type === MODULE_MIME),
  `every module part carries Content-Type ${MODULE_MIME}`);

// ------------------------------------------------- part table
console.log("\nPART TABLE (bundle root = dist worker/; part name = path relative to root)");
for (const name of partNames) {
  const f = workerFiles.get(name);
  console.log(`  part ${name}  <-  ${f.distRel}  [${MODULE_MIME}, ${f.bytes.length} bytes, sha256 ${sha256(f.bytes).slice(0, 12)}…]`);
}
const excluded = [...workerFiles.keys()].filter((k) => !closure.has(k)).sort();
console.log("EXCLUDED FROM THE ENVELOPE (present in the artifact tree, not uploaded as parts):");
for (const name of excluded) console.log(`  ${name}`);

// ------------------------------------------------- metadata shape
check("B1", metadata && typeof metadata === "object" && !Array.isArray(metadata), "metadata is a JSON object (the `metadata` part)");
check("B2", metadata.compatibility_date === "2026-08-29" && Array.isArray(metadata.compatibility_flags) && metadata.compatibility_flags.includes("nodejs_compat"),
  "compatibility_date + compatibility_flags present", `date=${metadata.compatibility_date}, flags=${JSON.stringify(metadata.compatibility_flags)}`);

const BINDING_SHAPES = {
  durable_object_namespace: { required: ["type", "name", "class_name"], allowed: ["type", "name", "class_name", "script_name", "environment"] },
  r2_bucket: { required: ["type", "name", "bucket_name"], allowed: ["type", "name", "bucket_name"] },
  queue: { required: ["type", "name", "queue_name"], allowed: ["type", "name", "queue_name"] },
  plain_text: { required: ["type", "name", "text"], allowed: ["type", "name", "text"] },
  secret_text: { required: ["type", "name", "text"], allowed: ["type", "name", "text"] },
};
let b3ok = true; const b3problems = [];
for (const b of metadata.bindings || []) {
  const shape = BINDING_SHAPES[b.type];
  if (!shape) { b3ok = false; b3problems.push(`undocumented binding type ${b.type}`); continue; }
  for (const k of shape.required) if (!(k in b)) { b3ok = false; b3problems.push(`${b.type}/${b.name}: missing ${k}`); }
  for (const k of Object.keys(b)) if (!shape.allowed.includes(k)) { b3ok = false; b3problems.push(`${b.type}/${b.name}: undocumented key ${k}`); }
}
check("B3", b3ok, "every binding matches its documented shape exactly",
  b3problems.join("; ") || `${(metadata.bindings || []).length} bindings`);
const secretBindings = (metadata.bindings || []).filter((b) => b.type === "secret_text");
check("B4", secretBindings.length === 0,
  "no secret_text bindings in the upload payload (both production secrets are dashboard-set by Julie and carried by inherit on later uploads)");
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check("B5", eq(metadata.bindings, spec.bindings) && metadata.main_module === spec.main_module && metadata.compatibility_date === spec.compatibility_date && eq(metadata.compatibility_flags, spec.compatibility_flags),
  "emitted metadata is exactly derived from the reviewed production deploy spec (bindings / main_module / compatibility)");

// ------------------------------------------------- migrations
const mig = metadata.migrations;
check("C1", !!mig && typeof mig === "object" && !Array.isArray(mig),
  "migrations is a SingleStepMigration OBJECT (API schema), not an array");
const MIG_KEYS = ["new_tag", "old_tag", "new_classes", "new_sqlite_classes", "deleted_classes", "renamed_classes", "transferred_classes", "steps"];
check("C2", !!mig && Object.keys(mig).every((k) => MIG_KEYS.includes(k)),
  "migrations carries only documented SingleStepMigration keys", mig ? Object.keys(mig).join(", ") : "absent");
check("C3", !!mig && eq(mig, spec.durable_object_migrations),
  "emitted migrations are exactly the production spec's durable_object_migrations");
check("C4", !!mig && mig.new_tag === "v1",
  "migrations.new_tag is \"v1\" — the first migration on THIS script's own new namespace (tags are per-script)",
  mig ? `new_tag=${JSON.stringify(mig.new_tag)}` : "absent");
check("C5", !!mig && !("old_tag" in mig),
  "no old_tag (first migration on a new script; nothing to verify against)");

// ------------------------------------------------- no-consumer shape
check("D1", !("queue_consumers" in metadata),
  "no top-level queue_consumers key in the upload metadata (not a documented upload attribute)");
const TOP_KEYS = ["main_module", "assets", "keep_assets", "bindings", "placement", "compatibility_date", "compatibility_flags", "migrations", "logpush", "tail_consumers", "tags", "annotations", "observability"];
const extraTop = Object.keys(metadata).filter((k) => !TOP_KEYS.includes(k));
check("D2", extraTop.length === 0,
  "top-level metadata keys are within the documented set",
  "keys: " + Object.keys(metadata).join(", ") + (extraTop.length ? ` | UNDOCUMENTED: ${extraTop.join(", ")}` : ""));

// ------------------------------------------------- production invariants
const bindings = metadata.bindings || [];
const plain = Object.fromEntries(bindings.filter((b) => b.type === "plain_text").map((b) => [b.name, b.text]));
check("P1", plain.OPALREADER_V2_SCOPE === "production" && plain.GENERATION_HALT === "1",
  "production invariants in plain_text bindings (scope=production, GENERATION_HALT=1)");
check("P2", !bindings.some((b) => b.type === "queue") &&
            (spec.queue_producers || []).length === 0 && (spec.queue_consumers || []).length === 0,
  "NO queue binding of any kind (no producer, no consumer; opalreader-generation keeps its single v1 consumer)");
check("P3", !bindings.some((b) => b.name === "R2_KEY_PREFIX"),
  "NO R2_KEY_PREFIX binding (its absence is the production namespace shape; the class enforces it in code)");
check("P4", bindings.length === 5 && spec.script_name === "opalreader-api-v2-prod",
  "exactly the five specced bindings, for the production script",
  `script=${spec.script_name}, bindings=${bindings.map((b) => b.name).join(", ")}`);
const absent = new Set(spec.provider_secrets_absent_by_design || []);
const badNames = bindings.filter((b) => absent.has(b.name));
check("P5", badNames.length === 0 && (spec.provider_secrets_present || []).length === 0,
  "no provider-secret bindings present (absence verified here statically and live at D2)");

// ------------------------------------------------- DO cross-check
const doBinding = bindings.find((b) => b.type === "durable_object_namespace");
const entryBytes = workerFiles.get(ENTRY)?.bytes.toString("utf8") || "";
const classExported = !!doBinding && new RegExp(`export\\s+class\\s+${doBinding.class_name}\\b`).test(entryBytes);
check("A4", !!doBinding && doBinding.class_name === "OpalReaderCoordinatorProd" && classExported &&
            eq(mig?.new_sqlite_classes, [doBinding.class_name]),
  "DO binding class_name == OpalReaderCoordinatorProd == migrations.new_sqlite_classes == the class the production entry part actually exports (the script owns its class)",
  doBinding ? `class=${doBinding.class_name}` : "no DO binding");
check("A5", !!doBinding && !("script_name" in doBinding),
  "the DO binding names NO script_name (the class is this script's own, never a cross-script reference to staging)",
  doBinding && "script_name" in doBinding ? `script_name=${doBinding.script_name}` : "own class");

// ------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\nPROD ENVELOPE VALIDATION: ${failed.length === 0 ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length} assertions)`);
if (failed.length) { console.log("failed: " + failed.map((f) => f.id).join(", ")); process.exit(1); }
