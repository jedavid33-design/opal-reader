// Opal Reader v2 — Part 2 F1 REVISION: existing-script UPDATE-envelope
// validation (Rowan 6349834892, Proof 2).
//
// Usage: node tools/validate-update-envelope.mjs [--dist <dir>] [--envelope <file>]
// Default dist: dist/p8-part1. Default envelope: tools/update-envelope.json.
//
// The companion to tools/validate-upload-envelope.mjs (the CREATION
// envelope, unchanged, 20/20). This validates the SECOND upload — the
// replacement of the already-created opalreader-api-v2 — as an
// update, against Cloudflare's documented Script Upload API schema
// (OpenAPI-generated reference, ScriptUpdateParams):
//
//   * `metadata.migrations` is OPTIONAL ("Migrations to apply for
//     Durable Objects associated with this Worker"). The update
//     applies none: the envelope OMITS the key. Replaying the
//     creation migration is not a no-op — the legacy migrations
//     documentation states `new_sqlite_classes` on a later migration
//     FAILS for an already-deployed class, and migration tags are
//     unique names applied at most once. No documented "no-change"
//     migration object exists, so none is invented.
//   * The secret set on the script after creation is carried as a
//     {type:"inherit", name:"OPALREADER_ACCESS_TOKEN"} binding —
//     the documented WorkersBindingKindInherit shape {name, type}
//     (old_name only for renames; version_id defaults to "latest",
//     the only value script upload accepts).
//   * `bindings_inherit=strict` is a QUERY parameter of the update
//     request: "the upload will fail if any `inherit` type bindings
//     cannot be resolved against the previous version of the Worker.
//     Without this, unresolvable inherit bindings are silently
//     dropped." It is pinned in the envelope artifact's request
//     block and asserted here.
//   * The seven configuration bindings, main_module, compatibility
//     and observability are field-identical to the creation
//     metadata — proven by re-deriving the expected update metadata
//     from the built creation metadata (tools/derive-update-envelope
//     .mjs) and comparing exactly.
//
// Assembles the exact multipart body the update would send (same
// fixed-boundary discipline as the creation validator), in memory
// only; nothing is transmitted. Deterministic. Exit 0 iff every
// assertion passes.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveUpdateMetadata, INHERIT_BINDING } from "./derive-update-envelope.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const distDir = args.includes("--dist") ? resolve(root, args[args.indexOf("--dist") + 1]) : join(root, "dist", "p8-part1");
const envelopePath = args.includes("--envelope") ? resolve(root, args[args.indexOf("--envelope") + 1]) : join(root, "tools", "update-envelope.json");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const results = [];
function check(id, ok, label, detail = "") {
  results.push({ id, ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} ${label}${detail ? ` — ${detail}` : ""}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function readDist(rel) {
  const p = join(distDir, rel);
  return existsSync(p) ? readFileSync(p) : null;
}

// ------------------------------------------------------------ inputs
const manifestBuf = readDist("manifest.json");
const creationBuf = readDist("upload-metadata.json");
const specBuf = readDist("deploy-spec.json");
const envelopeBuf = existsSync(envelopePath) ? readFileSync(envelopePath) : null;
if (!manifestBuf || !creationBuf || !specBuf || !envelopeBuf) {
  console.log("[FAIL] U0 inputs present — need manifest.json / upload-metadata.json / deploy-spec.json under dist and the update envelope at " + envelopePath);
  process.exit(1);
}
const manifest = JSON.parse(manifestBuf.toString("utf8"));
const creation = JSON.parse(creationBuf.toString("utf8"));
const spec = JSON.parse(specBuf.toString("utf8"));
const envelope = JSON.parse(envelopeBuf.toString("utf8"));
const update = envelope.metadata;
const updateMetadataBytes = Buffer.from(JSON.stringify(update, null, 2) + "\n", "utf8");
console.log(`envelope file sha256: ${sha256(envelopeBuf)}`);
console.log(`serialized metadata sha256: ${sha256(updateMetadataBytes)}`);

// ------------------------------------------------- U0: artifact intact
let u0ok = true; const missing = [];
const workerFiles = new Map();
for (const f of manifest.files) {
  const bytes = readDist(f.path);
  if (!bytes) { u0ok = false; missing.push(f.path); continue; }
  if (sha256(bytes) !== f.sha256 || bytes.length !== f.bytes) { u0ok = false; missing.push(f.path + " (hash/size mismatch)"); }
  if (f.path.startsWith("worker/")) workerFiles.set(f.path.slice("worker/".length), { distRel: f.path, bytes });
}
check("U0", u0ok, "artifact files match the build manifest (sha256 + size)",
  u0ok ? `${manifest.files.length} files, source commit ${manifest.sourceCommit}` : "mismatch: " + missing.join(", "));

// ------------------------------------------------- import closure (as creation)
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
const ENTRY = creation.main_module;
const closure = new Set();
const unresolved = [];
if (typeof ENTRY === "string" && workerFiles.has(ENTRY)) {
  closure.add(ENTRY);
  const queue = [ENTRY];
  while (queue.length) {
    const cur = queue.shift();
    for (const s of specifiersOf(workerFiles.get(cur).bytes)) {
      if (!s.startsWith(".")) continue;
      const r = resolveRel(cur, s);
      if (!workerFiles.has(r)) unresolved.push(`${cur} -> ${s} (=> ${r})`);
      else if (!closure.has(r)) { closure.add(r); queue.push(r); }
    }
  }
}
const partNames = [...closure].sort();

// ------------------------------------------------- U1: envelope assembly
const BOUNDARY = "----opalreader-update-envelope";
const MODULE_MIME = "application/javascript+module";
function assemble() {
  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "utf8"));
  push(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n`);
  chunks.push(updateMetadataBytes); push("\r\n");
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
let u1ok = !!metaPart && metaPart.bytes.equals(updateMetadataBytes)
  && moduleParts.length === partNames.length && partNames.length > 0 && unresolved.length === 0
  && moduleParts.every((p) => p.type === MODULE_MIME);
if (u1ok) for (const p of moduleParts) {
  const src = workerFiles.get(p.name);
  if (!src || !p.bytes.equals(src.bytes)) { u1ok = false; break; }
}
check("U1", u1ok, "update multipart envelope round-trips byte-identically — metadata part is the pinned update metadata; module parts are the creation closure, MIME-correct",
  `${parsed.length} parts total; closure: ${partNames.join(", ")}`);

// ------------------------------------------------- migrations: none
check("U2", !!update && !("migrations" in update),
  "no `migrations` key in the update metadata — the validated no-new-migration representation for an existing script (field is optional in the update schema; nothing is applied)");
const MIGRATION_KEYS = ["new_sqlite_classes", "new_classes", "new_tag", "old_tag", "deleted_classes", "renamed_classes", "transferred_classes", "steps"];
const foundMigKeys = [];
(function scan(v) {
  if (Array.isArray(v)) return v.forEach(scan);
  if (v && typeof v === "object") for (const k of Object.keys(v)) {
    if (MIGRATION_KEYS.includes(k)) foundMigKeys.push(k);
    scan(v[k]);
  }
})(update);
check("U3", foundMigKeys.length === 0,
  "no migration directive anywhere in the update metadata (no creation replay, no new tag, no steps)",
  foundMigKeys.length ? "found: " + foundMigKeys.join(", ") : "clean");

// ------------------------------------------------- the inherit binding
const bindings = Array.isArray(update?.bindings) ? update.bindings : [];
const inheritEntries = bindings.filter((b) => b.type === "inherit");
const namedToken = bindings.filter((b) => b.name === "OPALREADER_ACCESS_TOKEN");
check("U4", inheritEntries.length === 1 && eq(inheritEntries[0], INHERIT_BINDING) && namedToken.length === 1,
  "exactly one inherit binding, exactly {type:\"inherit\", name:\"OPALREADER_ACCESS_TOKEN\"} (documented minimal shape: no old_name, no version_id), and it is the only binding of that name",
  `${inheritEntries.length} inherit entries; ${namedToken.length} bindings named OPALREADER_ACCESS_TOKEN`);

// ------------------------------------------------- request parameters
check("U5", envelope.request?.method === "PUT" && envelope.request?.query?.bindings_inherit === "strict"
  && typeof envelope.request?.path === "string" && envelope.request.path.endsWith("/workers/scripts/" + spec.script_name),
  "the pinned request is PUT to the script endpoint with query bindings_inherit=strict — an unresolved inherit aborts the upload (error 10057) instead of silently dropping the secret");

// ------------------------------------------------- config preservation
const configOnly = bindings.filter((b) => b.type !== "inherit");
check("U6", eq(configOnly, creation.bindings) && eq(configOnly, spec.bindings),
  "the seven configuration bindings are field-identical (order included) to the creation metadata and to the pinned deploy spec");
const queueBinding = bindings.find((b) => b.type === "queue");
check("U7", !!queueBinding && eq(Object.keys(queueBinding).sort(), ["name", "queue_name", "type"]) && eq(queueBinding, spec.bindings.find((b) => b.type === "queue")),
  "queue binding is still the documented minimal shape {type,name,queue_name}, identical to the spec");
check("U8", !!update && update.main_module === creation.main_module
  && update.compatibility_date === creation.compatibility_date
  && eq(update.compatibility_flags, creation.compatibility_flags)
  && eq(update.observability, creation.observability),
  "main_module, compatibility_date/flags and observability are identical to the creation metadata",
  `main_module=${update?.main_module}, date=${update?.compatibility_date}, flags=${JSON.stringify(update?.compatibility_flags)}`);

// ------------------------------------------------- derivation proof
check("U9", eq(update, deriveUpdateMetadata(creation)),
  "the pinned update metadata is EXACTLY the deterministic derivation from the built creation metadata (migrations removed; inherit appended) — a derived upload-time overlay, not a hand-edited file");

// ------------------------------------------------- no secrets travel
const secretText = bindings.filter((b) => b.type === "secret_text");
const absent = new Set(spec.provider_secrets_absent_by_design || []);
const badNames = bindings.filter((b) => absent.has(b.name));
check("U10", secretText.length === 0 && badNames.length === 0,
  "no secret_text binding and no provider-secret name anywhere in the update metadata (the token's value never travels in the payload)");

// ------------------------------------------------- DO namespace preserved
const doBinding = bindings.find((b) => b.type === "durable_object_namespace");
const creationDo = (creation.bindings || []).find((b) => b.type === "durable_object_namespace");
const entryBytes = workerFiles.get(ENTRY)?.bytes.toString("utf8") || "";
const classExported = !!doBinding && new RegExp(`export\\s+class\\s+${doBinding.class_name}\\b`).test(entryBytes);
check("U11", !!doBinding && eq(doBinding, creationDo) && classExported,
  "the COORDINATOR durable_object_namespace binding is field-identical to creation and names the class the entry exports — the binding that resolves to the already-provisioned namespace (40873aba…) is untouched",
  doBinding ? `class=${doBinding.class_name}` : "no DO binding");

// ------------------------------------------------- top-level key discipline
const expectedTop = Object.keys(creation).filter((k) => k !== "migrations").sort();
const actualTop = update ? Object.keys(update).sort() : [];
check("U12", eq(actualTop, expectedTop),
  "top-level keys of the update metadata are exactly the creation keys minus `migrations` — nothing added, nothing else dropped",
  "keys: " + actualTop.join(", "));

// ------------------------------------------------- summary
const failed = results.filter((r) => !r.ok);
console.log(`\nUPDATE ENVELOPE VALIDATION: ${failed.length === 0 ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length} assertions)`);
if (failed.length) { console.log("failed: " + failed.map((f) => f.id).join(", ")); process.exit(1); }
