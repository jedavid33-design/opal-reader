// FINAL COMBINED DEPLOY — D1 VALIDATION HARNESS (actual upload envelope).
//
// Adapted from the disposition deploy's proof harness
// (~/workspace/ch2-program/disposition-deploy/envelope/proof-ch2disp-envelope.mjs)
// with these substitutions: the candidate tree (the FINAL combined
// tree at ~/workspace/ch2-program/quota-routes-fix2/worker-build —
// cache remediation + quota guard + corrections + operator routes +
// route fixes, COMBINED SOURCE PASS, Rowan 6546514192), an inventory
// cross-check against this package's tree-inventory.json, operator-
// fence source assertions over the entry part (E20–E23, per Rowan's
// amendment 4: a fence-weakened entry must never assemble), and the
// negative-mutation set Rowan specified for the final envelope.
//
// STAMP / PIN DISCIPLINE: the final-package pin does not exist until
// this package is pinned, so the harness stamps the build-identity
// part with a PIN supplied by --pin, defaulting to a 40-character
// PLACEHOLDER (40 zeros — exactly the length of a real commit SHA,
// so every byte count produced here is the byte count the real
// stamped envelope will have; only the stamp's content and therefore
// the envelope SHA-256 change when the real pin is substituted).
// Gate (a) D1 re-runs this harness with --pin <the final-package
// pin> against the pinned tree and records THAT run's envelope
// SHA-256; D2 must match it exactly, as in every prior deploy.
//
// LOCAL ONLY: assembles in memory + writes artifacts under this
// directory. Nothing is transmitted anywhere. The candidate tree
// is only READ. The worker test battery is NOT run here (source is
// unchanged since the pinned 1,099-test run on this tree).
//
// Usage:
//   node validate-final-envelope.mjs [--pin <40-hex>]
//       validate the real envelope (must PASS, exit 0)
//   node validate-final-envelope.mjs --mutate <name>
//       each mutation must FAIL validation (exit 1):
//       drop-part | duplicate-part | wrong-hash |
//       spoofed-operator-route | wrong-halt |
//       unexpected-metadata | migrations
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CANDIDATE = "/home/hatch/workspace/ch2-program/quota-routes-fix2/worker-build";
const WORKER_DIR = join(CANDIDATE, "worker");
const INVENTORY_PATH = resolve(here, "../tree-inventory.json");
const EXPECTED_ENTRY = "v2/worker-entry-prod-d6.js";

const args = process.argv.slice(2);
const mutate = args.includes("--mutate") ? args[args.indexOf("--mutate") + 1] : null;
const PIN = args.includes("--pin") ? args[args.indexOf("--pin") + 1]
  : "0000000000000000000000000000000000000000";
const PIN_IS_PLACEHOLDER = !args.includes("--pin");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const results = [];
function check(id, ok, label, detail = "") {
  results.push({ id, ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} ${label}${detail ? ` — ${detail}` : ""}`);
}

// ------------------------------------------------------------- inputs
const spec = JSON.parse(readFileSync(join(WORKER_DIR, "p8", "deploy-spec-prod-d6.json"), "utf8"));
const inventory = existsSync(INVENTORY_PATH) ? JSON.parse(readFileSync(INVENTORY_PATH, "utf8")) : null;

// Candidate module set: every .mjs/.js under worker/, part name "v2/<rel>".
const workerFiles = new Map();
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

// Build-identity stamp (part-only; tree untouched).
const BI_PART = "v2/host/build-identity.mjs";
const biTree = workerFiles.get(BI_PART);
const biTreeText = biTree.bytes.toString("utf8");
const unbuiltCount = (biTreeText.match(/BUILD_COMMIT = "UNBUILT"/g) || []).length;
const stampedText = biTreeText.replace(/export const BUILD_COMMIT = "[^"]*";/,
  `export const BUILD_COMMIT = "${PIN}";`);
const stampedBytes = Buffer.from(stampedText, "utf8");

// Mutation part overrides (applied to assembled part bytes only;
// the tree on disk is never touched).
const partOverrides = new Map();
if (mutate === "wrong-hash") {
  const target = "v2/host/adapters.mjs";
  const b = Buffer.from(workerFiles.get(target).bytes);
  b[b.length - 1] = b[b.length - 1] ^ 0xff;
  partOverrides.set(target, b);
} else if (mutate === "spoofed-operator-route") {
  // Weaken the DO bootstrap handler's admitted-stamp check: a
  // fence-weakened entry (quota handler trusting no stamp) must
  // never validate. Only the bootstrap handler segment is altered.
  const entryText = workerFiles.get(EXPECTED_ENTRY).bytes.toString("utf8");
  const marker = '"/internal/d6/quota-bootstrap"';
  const at = entryText.indexOf(marker);
  const checkLine = 'if (request.headers.get("x-opalreader-operator-admitted") !== "1")';
  const checkAt = entryText.indexOf(checkLine, at);
  const mutated = entryText.slice(0, checkAt) + 'if (false) /* stamp check removed */' + entryText.slice(checkAt + checkLine.length);
  partOverrides.set(EXPECTED_ENTRY, Buffer.from(mutated, "utf8"));
}
const partBytes = (name) => partOverrides.has(name) ? partOverrides.get(name)
  : name === BI_PART ? stampedBytes : workerFiles.get(name).bytes;

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
    for (const s of specifiersOf(workerFiles.get(cur).bytes)) {
      if (!s.startsWith(".")) { bareSpecifiers.add(s); continue; }
      const r = resolveRel(cur, s);
      if (!workerFiles.has(r)) unresolved.push(`${cur} -> ${s} (=> ${r})`);
      else if (!closure.has(r)) { closure.add(r); queue.push(r); }
    }
  }
}
let partNames = [...closure].sort();
if (mutate === "drop-part") partNames = partNames.filter((n) => n !== "v2/generation/quota-budget.mjs");
if (mutate === "duplicate-part") partNames = [...partNames, "v2/host/adapters.mjs"];

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
if (mutate === "wrong-halt") {
  metadata = { ...metadata, bindings: metadata.bindings.map((b) =>
    b.name === "GENERATION_HALT" ? { ...b, text: "0" } : b) };
} else if (mutate === "unexpected-metadata") {
  metadata = { ...metadata, unexpected_key: true };
} else if (mutate === "migrations") {
  metadata = { ...metadata, migrations: { new_tag: "v2", new_sqlite_classes: ["OpalReaderCoordinatorProd"] } };
}
const metadataBuf = Buffer.from(JSON.stringify(metadata, null, 2) + "\n", "utf8");

// ------------------------------------------------- envelope assembly
const BOUNDARY = "----opalreader-final-envelope-d1";
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
  mutate ? `mutation mode: ${mutate} (mutations applied AFTER spec read; spec itself intact)` : `spec main_module=${spec.main_module}`);
check("E2", metadata.main_module === EXPECTED_ENTRY && metadata.main_module === spec.main_module && closure.has(metadata.main_module),
  "entry module is the D6 production entry, exactly as specced, and is an actual envelope part",
  `main_module=${JSON.stringify(metadata.main_module)}`);
check("E3", unresolved.length === 0 && closure.size > 0,
  "every relative import in the D6 closure resolves to an exactly-named part",
  unresolved.length ? "unresolved: " + unresolved.join("; ") : `${closure.size} modules in closure`);
check("E4", [...bareSpecifiers].every((s) => s.startsWith("node:")),
  "bare specifiers are node:-only (covered by nodejs_compat)",
  [...bareSpecifiers].join(", ") || "none");

console.log("\nPART TABLE (part name — bytes — sha256 — tree source)");
const partManifest = [];
let hashOk = true;
for (const name of [...closure].sort()) {
  const bytes = partBytes(name);
  const treeBytes = workerFiles.get(name).bytes;
  let match;
  if (name === BI_PART) {
    match = !partOverrides.has(name) &&
      stampedText.replace(PIN, "UNBUILT") === biTreeText && unbuiltCount === 1 && stampedBytes.length !== 0;
  } else {
    match = bytes.equals(treeBytes);
  }
  if (!match) hashOk = false;
  partManifest.push({ part: name, bytes: bytes.length, sha256: sha256(bytes), tree: workerFiles.get(name).treeRel, stamped: name === BI_PART });
  console.log(`  ${name}  ${bytes.length} B  sha256 ${sha256(bytes)}  <- ${workerFiles.get(name).treeRel}${name === BI_PART ? "  [STAMPED part-only: BUILD_COMMIT = pin; tree keeps UNBUILT]" : ""}`);
}
check("E5", hashOk,
  "every envelope part hash-compares to the final candidate tree (build-identity: stamped part == tree with ONLY the pin substituted; tree still UNBUILT)",
  `${closure.size} parts, ${partManifest.reduce((a, p) => a + p.bytes, 0)} total module bytes (stamped)`);
check("E6", (stampedText.match(new RegExp(PIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length === 1 && !stampedText.includes("UNBUILT"),
  PIN_IS_PLACEHOLDER
    ? "stamped build-identity carries the pin exactly once (PLACEHOLDER pin of real-pin length; D1 re-runs with the real final-package pin)"
    : "stamped build-identity carries the pin exactly once",
  `pin=${PIN}${PIN_IS_PLACEHOLDER ? " (placeholder)" : ""}`);

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
const seenNames = moduleParts.map((p) => p.name);
const dupNames = seenNames.filter((n, i) => seenNames.indexOf(n) !== i);
let f1ok = !!metaPart && metaPart.bytes.equals(metadataBuf) && moduleParts.length === closure.size && dupNames.length === 0;
if (f1ok) for (const p of moduleParts) {
  if (!workerFiles.has(p.name) || !p.bytes.equals(partBytes(p.name)) || p.filename !== p.name || p.type !== MODULE_MIME) { f1ok = false; break; }
}
check("E16", f1ok,
  "multipart envelope round-trips byte-identically; every module part has filename == part name and Content-Type application/javascript+module; no duplicate parts",
  `${parsed.length} parts total (metadata + ${moduleParts.length} modules), envelope ${envelope.length} bytes${dupNames.length ? "; DUPLICATES: " + dupNames.join(",") : ""}`);
check("E17", specBindings.find((b) => b.name === "GENERATION_HALT")?.text === "1",
  "the deploy lands HALTED: GENERATION_HALT \"1\" in the assembled metadata (Step P creates the hold first; D2's code PUT carries the same value)");
check("E18", Object.keys(metadata).sort().join(",") === "bindings,compatibility_date,compatibility_flags,main_module,observability",
  "metadata top-level keys are exactly the proven D6 upload set (no extra keys, no migrations)",
  Object.keys(metadata).join(", "));

// E19: agreement with this package's tree-inventory.json.
let e19ok = !!inventory && inventory.envelopeParts?.count === closure.size;
const e19problems = [];
if (!inventory) e19problems.push("tree-inventory.json unreadable");
else {
  const invParts = new Map((inventory.envelopeParts.parts || []).map((p) => [p.part, p]));
  if (invParts.size !== closure.size) { e19ok = false; e19problems.push(`inventory parts ${invParts.size} != closure ${closure.size}`); }
  for (const name of closure) {
    const ip = invParts.get(name);
    if (!ip) { e19ok = false; e19problems.push(`${name} missing from inventory`); continue; }
    const treeBytes = workerFiles.get(name).bytes;
    if (ip.bytes !== treeBytes.length || ip.sha256 !== sha256(treeBytes)) { e19ok = false; e19problems.push(`${name} inventory hash/size mismatch`); }
    if (!partNames.includes(name)) { e19ok = false; e19problems.push(`${name} missing from assembled parts`); }
  }
  const invTotal = (inventory.envelopeParts.parts || []).reduce((a, p) => a + p.bytes, 0);
  if (inventory.envelopeParts.totalModuleBytes !== invTotal) { e19ok = false; e19problems.push("inventory totalModuleBytes inconsistent"); }
}
check("E19", e19ok,
  "assembled envelope agrees with this package's tree-inventory.json (part set, per-part tree SHA-256 + bytes, totals)",
  e19problems.join("; ") || `${closure.size} parts, inventory total ${inventory?.envelopeParts?.totalModuleBytes} tree bytes`);

// E20–E23: operator-fence source assertions over the entry part.
// A fence-weakened entry can never assemble: each quota handler
// segment must carry its admitted-stamp check and its fences.
function segment(src, startMarker, endMarker, maxLen = 9000) {
  const a = src.indexOf(startMarker);
  if (a < 0) return "";
  let b = endMarker ? src.indexOf(endMarker, a + startMarker.length) : -1;
  if (b < 0 || b - a > maxLen) b = a + maxLen;
  return src.slice(a, b);
}
const ADMITTED = 'request.headers.get("x-opalreader-operator-admitted") !== "1"';
const bootSeg = segment(entrySrc, '"/internal/d6/quota-bootstrap"', '"/internal/d6/quota-dispose-exception"');
const bootProblems = [];
if (!bootSeg) bootProblems.push("bootstrap handler not found");
for (const [needle, label] of [
  [ADMITTED, "admitted-stamp check"],
  ['this.env.GENERATION_HALT !== "1"', "halt-only fence"],
  ['"quota_bootstrap_body_read_error"', "body-read-error refusal"],
  ['"quota_bootstrap_body_malformed"', "malformed-body refusal"],
  ['"quota_bootstrap_body_null"', "explicit-null refusal"],
  ['"quota_bootstrap_figure_caller_supplied"', "figureless refusal"],
  ['"quota_bootstrap_request_key_not_allowed"', "empty-allowlist refusal"],
  ["bootstrapQuota(coord)", "store call"],
]) if (!bootSeg.includes(needle)) bootProblems.push(`missing ${label}`);
check("E20", bootProblems.length === 0,
  "operator fence — internal bootstrap handler: admitted-stamp check + halt-only + strict body handling (read-error/malformed/null) + figureless/empty-allowlist refusals, all before the store call",
  bootProblems.join("; ") || "all assertions present in the handler segment");

const dispSeg = segment(entrySrc, '"/internal/d6/quota-dispose-exception"', '"/internal/d6/quota-reconcile"');
const dispProblems = [];
if (!dispSeg) dispProblems.push("dispose handler not found");
for (const [needle, label] of [
  [ADMITTED, "admitted-stamp check"],
  ['this.env.GENERATION_HALT !== "1"', "halt-only fence"],
  ['"quota_disposition_figure_caller_supplied"', "figure refusal"],
  ['"quota_disposition_request_key_not_allowed"', "closed-allowlist refusal"],
  ['"attemptId", "dayKey", "authorizationRef", "source", "note"', "allowlist {attemptId, dayKey, authorizationRef, source, note}"],
  ["/^quota_[a-z0-9_]+$/", "named-domain-refusal matcher (unexpected faults rethrown)"],
  ["disposeBootstrapException(coord", "store call"],
]) if (!dispSeg.includes(needle)) dispProblems.push(`missing ${label}`);
check("E21", dispProblems.length === 0,
  "operator fence — internal dispose handler: admitted-stamp check + halt-only + closed allowlist + figure refusals + domain-refusal-only catch (faults surface as faults)",
  dispProblems.join("; ") || "all assertions present in the handler segment");

const recStart = entrySrc.indexOf('"/internal/d6/quota-reconcile"');
const recNext = recStart >= 0 ? entrySrc.indexOf('\n      if (url.pathname === "/internal/', recStart + 30) : -1;
const recSeg = recStart < 0 ? "" : entrySrc.slice(recStart, recNext > recStart ? recNext : recStart + 9000);
const recProblems = [];
if (!recSeg) recProblems.push("reconcile handler not found");
for (const [needle, label] of [
  [ADMITTED, "admitted-stamp check"],
  ['"quota_reconcile_offset_invalid"', "offset validation refusal"],
  ["exceptionOffset", "exception pagination"],
  ["driftOffset", "drift pagination"],
  ["censusComplete", "census completeness signal"],
  ["reconcileQuota(coord)", "store call"],
]) if (!recSeg.includes(needle)) recProblems.push(`missing ${label}`);
if (recSeg.includes("cache.flush()")) recProblems.push("handler calls cache.flush() (read-purity violation)");
check("E22", recProblems.length === 0,
  "operator fence — internal reconcile handler: admitted-stamp check + strictly validated pagination + censusComplete signal + NO cache.flush (SELECT-only read purity)",
  recProblems.join("; ") || "all assertions present in the handler segment; no cache.flush in segment");

const pubProblems = [];
for (const [needle, label] of [
  ['url.pathname === "/v2/d6-quota-bootstrap"', "public bootstrap route predicate"],
  ['url.pathname === "/v2/d6-quota-dispose-exception"', "public dispose route predicate"],
  ['url.pathname === "/v2/d6-quota-reconcile"', "public reconcile route predicate"],
  ["isQuotaBootstrapRoute\n        || isQuotaDisposeRoute || isQuotaReconcileRoute", "quota routes in the skipClientToken operator class"],
  ['req.headers.set("x-opalreader-operator-admitted", operatorAdmitted ? "1" : "0")', "admitted stamp set unconditionally from server-side admission (caller value overwritten, never trusted)"],
]) if (!entrySrc.includes(needle)) pubProblems.push(`missing ${label}`);
const stampSets = entrySrc.split('.set("x-opalreader-operator-admitted"').length - 1;
if (stampSets !== 1) pubProblems.push(`admitted stamp is set ${stampSets} times (expected exactly 1, in forward())`);
const bootFwdSeg = segment(entrySrc, "if (isQuotaBootstrapRoute)", "if (isQuotaDisposeRoute)", 3000);
if (!bootFwdSeg.includes("await request.text()")) pubProblems.push("public bootstrap forward does not read raw text");
if (!bootFwdSeg.includes('"quota_bootstrap_body_read_error"')) pubProblems.push("public bootstrap forward lacks the read-error refusal");
if (bootFwdSeg.includes("?? {}") || bootFwdSeg.includes('catch(() => "")') || bootFwdSeg.includes("catch(() => '')"))
  pubProblems.push("public bootstrap forward coerces a failed/empty read (fail-open)");
const recFwdSeg = segment(entrySrc, "if (isQuotaReconcileRoute)", "return forward(new Request(url.toString()", 2000);
for (const k of ["exceptionOffset", "driftOffset"]) if (!recFwdSeg.includes(k)) pubProblems.push(`public reconcile forward does not forward ${k}`);
check("E23", pubProblems.length === 0,
  "operator fence — public entry: three quota routes in the operator-alone class, admitted stamp stamped server-side exactly once, bootstrap forwarded as raw text with a named read-error refusal, reconcile offsets forwarded",
  pubProblems.join("; ") || "all assertions present");

// ------------------------------------------------------------- outputs
if (!mutate) {
  writeFileSync(join(here, "assembled-metadata.json"), metadataBuf);
  writeFileSync(join(here, "assembled-envelope.bin"), envelope);
  writeFileSync(join(here, "parts-manifest.json"),
    Buffer.from(JSON.stringify({
      pin: PIN, pinIsPlaceholder: PIN_IS_PLACEHOLDER, entry: ENTRY,
      totalModuleBytesTree: partManifest.reduce((a, p) => a + p.bytes, 0),
      envelopeBytes: envelope.length, envelopeSha256: sha256(envelope),
      parts: partManifest,
    }, null, 2) + "\n", "utf8"));
}
const failed = results.filter((r) => !r.ok);
const summary = { mutate: mutate || "none", pin: PIN, pinIsPlaceholder: PIN_IS_PLACEHOLDER, parts: closure.size, assembledParts: partNames.length, checks: results.length, passed: results.length - failed.length, failed: failed.map((f) => f.id), envelopeBytes: envelope.length, envelopeSha256: sha256(envelope) };
writeFileSync(join(here, mutate ? `proof-result-${mutate}.json` : "proof-result.json"),
  Buffer.from(JSON.stringify({ ...summary, results }, null, 2) + "\n", "utf8"));
console.log(`\nFINAL ENVELOPE VALIDATION: ${failed.length === 0 ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length} assertions)`);
console.log(`envelope: ${envelope.length} bytes, sha256 ${sha256(envelope)} (pin ${PIN}${PIN_IS_PLACEHOLDER ? ", PLACEHOLDER — re-run at D1 with the real final-package pin" : ""})`);
if (failed.length) { console.log("failed: " + failed.map((f) => f.id).join(", ")); process.exit(1); }
