// GATE 2D RETRY — FINALIZER ENVELOPE ASSEMBLER + VALIDATOR.
//
// Recipe-identical to the Chapter 3 mechanisms assembler
// (ch3-deploy/pin-tree/tools/assemble-ch3-envelope.mjs), which is
// recipe-identical to the gate-(a) final-envelope harness: import
// closure rooted at the deploy spec's main_module, part names
// "v2/<rel under worker/>", build-identity part stamped part-only
// with the deploy pin, metadata derived from the tree's own deploy
// spec (spec bindings + inherit secrets), multipart boundary
// "----opalreader-final-envelope-d1", metadata part first (JSON,
// 2-space indent + trailing newline), module parts sorted by name,
// each with filename == part name and
// Content-Type application/javascript+module. Envelope SHA-256 is
// the SHA-256 of the assembled multipart body.
//
// Reference live identity: the Chapter 3 operative manifest (the
// parts of live build 63d7260e, deployed 2026-10-31).
//
// STAMP / PIN DISCIPLINE (gate-(a) precedent): the candidate tree
// keeps BUILD_COMMIT = "UNBUILT". Run with --pin <deploy pin>
// (the ui1-review commit pinning this envelope package) to produce
// the operative envelope; the default 40-zero placeholder run is
// for validation only and must never be uploaded.
//
// LOCAL ONLY: reads the candidate tree, writes artifacts under
// --out. Nothing is transmitted anywhere. The candidate tree is
// never modified.
//
// Usage:
//   node assemble-finalizer-envelope.mjs [--pin <40-hex>] [--tree <worker-build dir>] --out <dir>
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name, dflt) => args.includes(name) ? args[args.indexOf(name) + 1] : dflt;
const PIN = opt("--pin", "0000000000000000000000000000000000000000");
const PIN_IS_PLACEHOLDER = !args.includes("--pin");
const TREE = resolve(opt("--tree", "/home/hatch/workspace/ch2-program/ch3-recovery/finalizer-build/worker-build"));
const OUT = resolve(opt("--out", "/home/hatch/workspace/ch2-program/ch3-recovery/gate2d-retry/execution/operative"));
const LIVE_MANIFEST = "/home/hatch/workspace/ch2-program/ch3-deploy/execution/operative/parts-manifest.json";
const LIVE_METADATA = "/home/hatch/workspace/ch2-program/ch3-deploy/execution/operative/assembled-metadata.json";
const WORKER_DIR = join(TREE, "worker");
const EXPECTED_ENTRY = "v2/worker-entry-prod-d6.js";
const BI_PART = "v2/host/build-identity.mjs";
const NEW_PART = "v2/generation/grant-finalizer.mjs";
const EXPECTED_CHANGED = ["v2/worker-entry-prod-d6.js"].sort();

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const results = [];
function check(id, ok, label, detail = "") {
  results.push({ id, ok, label });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id} ${label}${detail ? ` — ${detail}` : ""}`);
}

// ------------------------------------------------------------- inputs
const spec = JSON.parse(readFileSync(join(WORKER_DIR, "p8", "deploy-spec-prod-d6.json"), "utf8"));
const live = JSON.parse(readFileSync(LIVE_MANIFEST, "utf8"));
const liveMetaText = readFileSync(LIVE_METADATA, "utf8");
const liveParts = new Map(live.parts.map((p) => [p.part, p]));

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
    for (const s of specifiersOf(workerFiles.get(cur).bytes)) {
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
const metadata = {
  main_module: spec.main_module,
  compatibility_date: spec.compatibility_date,
  compatibility_flags: spec.compatibility_flags,
  bindings: [...spec.bindings, ...inheritSecrets],
  observability: spec.observability,
};
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

// ------------------------------------------------------------- checks
check("C1", spec.script_name === "opalreader-api-v2-prod" && ENTRY === EXPECTED_ENTRY && closure.has(ENTRY),
  "spec identity + entry", `main_module=${ENTRY}`);
check("C2", unresolved.length === 0 && [...bareSpecifiers].every((s) => s.startsWith("node:")),
  "closure resolves; bare specifiers node:-only", unresolved.join("; ") || `${closure.size} modules`);
check("C3", closure.size === 30 && [...liveParts.keys()].every((n) => closure.has(n)) && closure.has(NEW_PART),
  "part set == live 29 + grant-finalizer.mjs == 30", `${closure.size} parts`);

const classes = { identical: [], changed: [], new: [], stamped: [] };
for (const name of partNames) {
  const bytes = partBytes(name);
  if (name === BI_PART) { classes.stamped.push(name); continue; }
  if (name === NEW_PART) { classes.new.push(name); continue; }
  const lp = liveParts.get(name);
  if (lp && sha256(bytes) === lp.sha256 && bytes.length === lp.bytes) classes.identical.push(name);
  else classes.changed.push(name);
}
check("C4", classes.identical.length === 27 && classes.changed.length === 1 &&
  JSON.stringify(classes.changed) === JSON.stringify(EXPECTED_CHANGED) &&
  classes.new.length === 1 && classes.stamped.length === 1,
  "class table: 27 identical + 1 changed (entry) + 1 new (grant-finalizer) + 1 stamped",
  `identical=${classes.identical.length} changed=[${classes.changed.join(", ")}] new=[${classes.new.join(", ")}] stamped=[${classes.stamped.join(", ")}]`);
check("C5", unbuiltCount === 1 && (stampedText.match(new RegExp(PIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length === 1 &&
  !stampedText.includes("UNBUILT") && stampedBytes.length === liveParts.get(BI_PART).bytes,
  "stamp exactly once; stamped length == live stamped length (411)",
  `stamped ${stampedBytes.length} B, live stamped ${liveParts.get(BI_PART).bytes} B`);
check("C6", metadataBuf.toString("utf8") === liveMetaText && !("migrations" in metadata) &&
  metadata.bindings.find((b) => b.name === "GENERATION_HALT")?.text === "1" && metadata.bindings.length === 10,
  "metadata byte-identical to the live operative metadata (GENERATION_HALT \"1\", 10 bindings, no migrations)");
const moduleParts = parsed.filter((p) => p.name !== "metadata");
check("C7", moduleParts.length === 30 && moduleParts.every((p) => p.filename === p.name && p.type === MODULE_MIME) &&
  moduleParts.every((p) => sha256(p.bytes) === sha256(partBytes(p.name))),
  "multipart round-trip: 30 module parts, filename == name, module MIME, bytes exact");

// Additive-table scope: the finalizer's lazy audit table name occurs
// only in the NEW part across all candidate worker sources.
const tableNames = ["d6_grant_finalizations"];
let scopeOk = true;
for (const [name, f] of workerFiles) {
  const t = f.bytes.toString("utf8");
  for (const tn of tableNames) if (t.includes(tn) && name !== NEW_PART) scopeOk = false;
}
check("C8", scopeOk, "d6_grant_finalizations occurs only in grant-finalizer.mjs across all candidate worker sources");
const genSchema = workerFiles.get("v2/generation/gen-schema.mjs");
check("C9", sha256(genSchema.bytes) === liveParts.get("v2/generation/gen-schema.mjs").sha256 &&
  (genSchema.bytes.toString("utf8").match(/CREATE TABLE/g) || []).length === 8,
  "GEN_SCHEMA byte-identical to live; exactly 8 tables");

// ------------------------------------------------------------- outputs
mkdirSync(OUT, { recursive: true });
const partManifest = [];
for (const name of partNames) {
  const bytes = partBytes(name);
  const treeBytes = workerFiles.get(name).bytes;
  const rec = {
    part: name, bytes: bytes.length, sha256: sha256(bytes), tree: workerFiles.get(name).treeRel,
    stamped: name === BI_PART,
    class: name === BI_PART ? "stamped" : name === NEW_PART ? "new"
      : classes.changed.includes(name) ? "changed" : "identical",
    unstampedBytes: treeBytes.length, unstampedSha256: sha256(treeBytes),
    liveBytes: liveParts.get(name)?.bytes ?? null, liveSha256: liveParts.get(name)?.sha256 ?? null,
  };
  partManifest.push(rec);
  const dest = join(OUT, name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
}
writeFileSync(join(OUT, "assembled-metadata.json"), metadataBuf);
writeFileSync(join(OUT, "assembled-envelope.bin"), envelope);
writeFileSync(join(OUT, "parts-manifest.json"), JSON.stringify({
  pin: PIN, pinIsPlaceholder: PIN_IS_PLACEHOLDER, entry: ENTRY,
  totalModuleBytes: partManifest.reduce((a, p) => a + p.bytes, 0),
  envelopeBytes: envelope.length, envelopeSha256: sha256(envelope),
  classes: { identical: classes.identical.length, changed: classes.changed, new: classes.new, stamped: classes.stamped },
  parts: partManifest,
}, null, 2) + "\n");

const failed = results.filter((r) => !r.ok);
console.log(`\nFINALIZER ENVELOPE ASSEMBLY: ${failed.length === 0 ? "PASS" : "FAIL"} (${results.length - failed.length}/${results.length} checks)`);
console.log(`envelope: ${envelope.length} bytes, sha256 ${sha256(envelope)} (pin ${PIN}${PIN_IS_PLACEHOLDER ? ", PLACEHOLDER — re-run with the real deploy pin before any upload; this envelope must never be uploaded" : ""})`);
process.exit(failed.length === 0 ? 0 : 1);
