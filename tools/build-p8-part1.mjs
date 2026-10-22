// Opal Reader v2 — Part 1 deterministic artifact builder (B6).
//
// Usage: node tools/build-p8-part1.mjs [--out dist/p8-part1]
//
// Emits, from a CLEAN checkout (the script refuses a dirty worktree):
//   worker/            the v2 module set with the build identity's
//                      BUILD_COMMIT replaced by `git rev-parse HEAD`
//   preview/           the v2-preview/ bundle, byte-copied
//   upload-metadata.json  the future Part 2 upload metadata, derived
//                      from v2/p8/deploy-spec.json (a SPEC — building
//                      it uploads nothing)
//   manifest.json      per-file {path, bytes, sha256} plus separate
//                      worker/preview digests and the artifact digest
//
// Determinism: no timestamps, no absolute paths, sorted file lists,
// fixed JSON formatting. Two runs from the same commit produce
// byte-identical output trees.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outArg = args.includes("--out") ? args[args.indexOf("--out") + 1] : "dist/p8-part1";
const outDir = resolve(root, outArg);

const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
const sourceCommit = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain");
if (dirty && process.env.OPAL_BUILD_ALLOW_DIRTY !== "1") {
  console.error("Refusing to build from a dirty worktree (artifacts must be reproducible from the pinned commit):");
  console.error(dirty);
  process.exit(1);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(relative(base, p).split("\\").join("/"));
  }
  return out.sort();
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const manifest = { sourceCommit, files: [] };
function emit(relPath, bytes) {
  const dest = join(outDir, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  manifest.files.push({ path: relPath, bytes: bytes.length, sha256: sha256(bytes) });
}

// --- worker module set: every .mjs/.js under v2/, with the build
// identity stamped from the source commit.
const v2Dir = join(root, "v2");
for (const rel of listFiles(v2Dir)) {
  if (!/\.(mjs|js|json)$/.test(rel)) continue;
  let bytes = readFileSync(join(v2Dir, rel));
  if (rel === "host/build-identity.mjs") {
    const text = bytes.toString("utf8");
    const stamped = text.replace(/export const BUILD_COMMIT = "[^"]*";/,
      `export const BUILD_COMMIT = "${sourceCommit}";`);
    if (stamped === text) { console.error("build identity stamp failed"); process.exit(1); }
    bytes = Buffer.from(stamped, "utf8");
  }
  emit(`worker/v2/${rel}`, bytes);
}

// --- preview bundle: byte copies of v2-preview/.
const previewDir = join(root, "v2-preview");
if (!existsSync(previewDir)) { console.error("v2-preview/ is missing"); process.exit(1); }
for (const rel of listFiles(previewDir)) emit(`preview/v2-preview/${rel}`, readFileSync(join(previewDir, rel)));

// --- upload metadata derived from the checked-in deploy SPEC.
const spec = JSON.parse(readFileSync(join(v2Dir, "p8", "deploy-spec.json"), "utf8"));
const uploadMetadata = {
  main_module: spec.main_module,
  compatibility_date: spec.compatibility_date,
  compatibility_flags: spec.compatibility_flags,
  bindings: spec.bindings,
  migrations: spec.durable_object_migrations,
  observability: spec.observability,
  queue_consumers: spec.queue_consumers,
};
emit("upload-metadata.json", Buffer.from(JSON.stringify(uploadMetadata, null, 2) + "\n", "utf8"));
emit("deploy-spec.json", readFileSync(join(v2Dir, "p8", "deploy-spec.json")));

// --- protected root files: recorded so the artifact itself proves the
// build touched nothing it must not. (Hashes, not copies.)
const protectedRoots = {};
for (const name of ["index.html", "app-256.js", "cloudflare-worker.js"])
  protectedRoots[name] = sha256(readFileSync(join(root, name)));

manifest.files.sort((a, b) => (a.path < b.path ? -1 : 1));
const digestOf = (entries) => sha256(Buffer.from(
  entries.map((f) => `${f.path}\0${f.sha256}\n`).join(""), "utf8"));
manifest.workerDigest = digestOf(manifest.files.filter((f) => f.path.startsWith("worker/")));
manifest.previewDigest = digestOf(manifest.files.filter((f) => f.path.startsWith("preview/")));
manifest.protectedRootSha256 = protectedRoots;
manifest.artifactDigest = digestOf(manifest.files);
writeFileSync(join(outDir, "manifest.json"),
  Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8"));

console.log(`source commit: ${sourceCommit}`);
console.log(`files: ${manifest.files.length}`);
console.log(`worker digest: ${manifest.workerDigest}`);
console.log(`preview digest: ${manifest.previewDigest}`);
console.log(`artifact digest: ${manifest.artifactDigest}`);
console.log(`manifest: ${join(outDir, "manifest.json")}`);
