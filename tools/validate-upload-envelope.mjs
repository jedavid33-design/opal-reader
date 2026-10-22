// Opal Reader v2 — Part 2 PREFLIGHT: deterministic local upload-envelope
// validation (Rowan 6347245912).
//
// Usage: node tools/validate-upload-envelope.mjs [--dist <dir>]
// Default dist: dist/p8-part1 (the builder output, tools/build-p8-part1.mjs).
//
// This assembles the EXACT multipart envelope the Part 2 upload would
// send — in memory only; nothing is transmitted anywhere — and asserts
// it against Cloudflare's DOCUMENTED Workers Script Upload schema:
//
//   * Multipart upload metadata (developers.cloudflare.com/workers/
//     configuration/multipart-upload-metadata/): main_module is "The
//     part name that contains the module entry point"; the bindings
//     list documents the complete shape of each binding type (queue:
//     {type, name, queue_name}); the top-level attribute list contains
//     no queue_consumers key.
//   * Workers API reference (Upload Worker Module / SingleStepMigration):
//     migrations is a single-step OBJECT {new_tag, old_tag,
//     new_classes, new_sqlite_classes, deleted_classes, renamed_classes,
//     transferred_classes, steps}; new_tag = "Tag to set as the latest
//     migration tag".
//   * Durable Object class migrations (legacy): "Migrations require a
//     migration tag... Migration tags are treated like unique names and
//     are used to determine which migrations have already been applied."
//   * Consumers attach ONLY via the Queues API / wrangler queues
//     consumer — never via a script upload (Queues: How Queues Works).
//
// Part-name mapping (preflight item 1): the bundle root is the builder's
// worker/ directory; a module's part name is its path relative to that
// root. The part set is the entry's transitive relative-import closure
// — the only modules the runtime can reach. Tree files outside the
// closure are NOT uploaded as parts and are listed as excluded.
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
const fail = (id, label, detail) => check(id, false, label, detail);

function readDist(rel) {
  const p = join(distDir, rel);
  return existsSync(p) ? readFileSync(p) : null;
}

// ------------------------------------------------------------ inputs
const manifestBuf = readDist("manifest.json");
const metadataBuf = readDist("upload-metadata.json");
const specBuf = readDist("deploy-spec.json");
if (!manifestBuf || !metadataBuf || !specBuf) {
  console.log("[FAIL] A0 artifact inputs present — manifest.json / upload-metadata.json / deploy-spec.json missing under " + distDir);
  process.exit(1);
}
const manifest = JSON.parse(manifestBuf.toString("utf8"));
const metadata = JSON.parse(metadataBuf.toString("utf8"));
const spec = JSON.parse(specBuf.toString("utf8"));

// ------------------------------------------------- A0: artifact intact
let a0ok = true; const missing = [];
const workerFiles = new Map(); // part-name candidate (path under worker/) -> {distRel, bytes}
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
function resolveRel(fromPart, spec) {
  const parts = (posixDir(fromPart) + "/" + spec).split("/");
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

check("A1", typeof ENTRY === "string" && partNames.includes(ENTRY),
  "main_module names an actual part", `main_module=${JSON.stringify(ENTRY)}`);
check("A2", unresolved.length === 0 && closure.size > 0,
  "every relative import in the closure resolves to an exactly-named part",
  unresolved.length ? "unresolved: " + unresolved.join("; ") : `${closure.size} modules in closure; bare specifiers: ${[...bareSpecifiers].join(", ") || "none"} (node: covered by nodejs_compat)`);

// ------------------------------------------------- envelope assembly
const BOUNDARY = "----opalreader-preflight-envelope";
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
function excludeReason(name) {
  if (name.endsWith(".json")) return "not a module (JSON); its content reaches the upload only as the derived metadata";
  if (name.includes("/client/") || name.endsWith("client-store.mjs")) return "client-side module set (preview bundle), not imported by the Worker entry";
  if (name.includes("/migration/")) return "local migration runner modules (decision D3), not imported by the Worker entry";
  if (name.endsWith("freeze-worker.js")) return "archival frozen v1 worker source, not imported by the Worker entry";
  return "not in the entry's import graph";
}
console.log("EXCLUDED FROM THE ENVELOPE (present in the artifact tree, not uploaded as parts):");
for (const name of excluded) console.log(`  ${name} — ${excludeReason(name)}`);

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
check("B3", b3ok, "every binding matches its documented shape exactly (queue = {type,name,queue_name}; no producer_only)",
  b3problems.join("; ") || `${(metadata.bindings || []).length} bindings`);
const secretBindings = (metadata.bindings || []).filter((b) => b.type === "secret_text");
check("B4", secretBindings.length === 0,
  "no secret_text bindings in the upload payload (the staging token is dashboard-set by Julie and carried by inherit on later uploads)");
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check("B5", eq(metadata.bindings, spec.bindings) && metadata.main_module === spec.main_module && metadata.compatibility_date === spec.compatibility_date && eq(metadata.compatibility_flags, spec.compatibility_flags),
  "emitted metadata is exactly derived from the reviewed deploy spec (bindings / main_module / compatibility)");

// ------------------------------------------------- migrations
const mig = metadata.migrations;
check("C1", !!mig && typeof mig === "object" && !Array.isArray(mig),
  "migrations is a SingleStepMigration OBJECT (API schema), not an array");
const MIG_KEYS = ["new_tag", "old_tag", "new_classes", "new_sqlite_classes", "deleted_classes", "renamed_classes", "transferred_classes", "steps"];
check("C2", !!mig && Object.keys(mig).every((k) => MIG_KEYS.includes(k)),
  "migrations carries only documented SingleStepMigration keys", mig ? Object.keys(mig).join(", ") : "absent");
check("C3", !!mig && eq(mig, spec.durable_object_migrations),
  "emitted migrations are exactly the spec's durable_object_migrations");
check("C4", !!mig && typeof mig.new_tag === "string" && mig.new_tag.length > 0,
  "migrations.new_tag is present — the documented migrations flow requires a tag to identify the migration",
  mig ? `new_tag=${JSON.stringify(mig.new_tag)}` : "absent");
check("C5", !!mig && !("old_tag" in mig),
  "no old_tag (first migration on a new script; nothing to verify against)");

// ------------------------------------------------- no-consumer shape
check("D1", !("queue_consumers" in metadata),
  "no top-level queue_consumers key in the upload metadata (not a documented upload attribute; consumers attach via the Queues API only)");
const TOP_KEYS = ["main_module", "assets", "keep_assets", "bindings", "placement", "compatibility_date", "compatibility_flags", "migrations", "logpush", "tail_consumers", "tags", "annotations", "observability"];
const extraTop = Object.keys(metadata).filter((k) => !TOP_KEYS.includes(k));
check("D2", extraTop.length === 0,
  "top-level metadata keys are within the documented set (observability is settings-managed and live-verified at proposal S5)",
  "keys: " + Object.keys(metadata).join(", ") + (extraTop.length ? ` | UNDOCUMENTED: ${extraTop.join(", ")}` : ""));

// ------------------------------------------------- staging invariants
const plain = Object.fromEntries((metadata.bindings || []).filter((b) => b.type === "plain_text").map((b) => [b.name, b.text]));
check("E1", plain.OPALREADER_V2_SCOPE === "staging-smoke" && plain.GENERATION_HALT === "1" && plain.R2_KEY_PREFIX === "smoke-p8/",
  "staging invariants in plain_text bindings (scope=staging-smoke, GENERATION_HALT=1, R2_KEY_PREFIX=smoke-p8/)");
const absent = new Set(spec.provider_secrets_absent_by_design || []);
const badNames = (metadata.bindings || []).filter((b) => absent.has(b.name));
check("E2", badNames.length === 0, "no provider-secret bindings present (absence verified here statically and live at proposal S6)");

// ------------------------------------------------- DO cross-check
const doBinding = (metadata.bindings || []).find((b) => b.type === "durable_object_namespace");
const entryBytes = workerFiles.get(ENTRY)?.bytes.toString("utf8") || "";
const classExported = !!doBinding && new RegExp(`export\\s+class\\s+${doBinding.class_name}\\b`).test(entryBytes);
check("A4", !!doBinding && classExported && eq(mig?.new_sqlite_classes, [doBinding.class_name]),
  "DO binding class_name == migrations.new_sqlite_classes == the class the entry part actually exports",
  doBinding ? `class=${doBinding.class_name}` : "no DO binding");

// ------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\nENVELOPE VALIDATION: ${failed.length === 0 ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length} assertions)`);
if (failed.length) { console.log("failed: " + failed.map((f) => f.id).join(", ")); process.exit(1); }
