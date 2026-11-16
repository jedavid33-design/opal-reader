// Composition verification (HOLD ruling R1): mechanically
// verifies each corrected tree against the CORRECT baseline —
// pre-a3-tree/, the live build 8a16def4's source — and prints
// the exact differ set with per-part sha256 and diff stats.
// This is the separate A-3 composition check the ruling asks
// for: it does not touch the historical regression fixtures
// (whose T0 identity subtests pin earlier trees and fail for
// that reason alone — see COMPOSITION-VERIFICATION.md).
//
// Usage: node verify-composition.mjs
// Exit 0 iff: candidate-tree and rollback-tree each differ
// from the baseline in EXACTLY the three implementation parts,
// and the two trees' coordinator.mjs + generation/service.mjs
// are byte-identical (the shared-code claim).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, "pre-a3-tree");
const PARTS = ["v2/worker-entry-prod-d6.js", "v2/coordinator.mjs",
  "v2/generation/service.mjs"];

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
function walk(dir, prefix = "") {
  const out = new Map();
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(p).isDirectory()) {
      for (const [k, v] of walk(p, rel)) out.set(k, v);
    } else out.set(rel, sha(readFileSync(p)));
  }
  return out;
}
function diffStat(a, b) {
  const r = spawnSync("diff", ["--unified=0", a, b],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let added = 0, removed = 0;
  for (const line of (r.stdout || "").split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    else if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return { added, removed };
}

let failures = 0;
const baseFiles = walk(BASE);
for (const treeName of ["candidate-tree", "rollback-tree"]) {
  const tree = walk(join(HERE, treeName));
  const all = new Set([...baseFiles.keys(), ...tree.keys()]);
  const differ = [...all].filter(
    (k) => baseFiles.get(k) !== tree.get(k)).sort();
  console.log(`== ${treeName} vs pre-a3-tree (live-build baseline)`);
  console.log(`   files: baseline ${baseFiles.size}, tree ${tree.size}`);
  console.log(`   differ set (${differ.length}): ${differ.join(", ")}`);
  const exact = differ.length === PARTS.length &&
    PARTS.every((p) => differ.includes(p));
  if (!exact) {
    failures++;
    console.log("   FAIL: differ set is not exactly the three parts");
  }
  for (const part of PARTS) {
    const a = join(BASE, part), b = join(HERE, treeName, part);
    const st = diffStat(a, b);
    console.log(`   ${part}`);
    console.log(`     baseline sha256 ${baseFiles.get(part)}`);
    console.log(`     tree     sha256 ${tree.get(part)}`);
    console.log(`     diff: +${st.added} / -${st.removed} lines`);
  }
}
const candCoord = readFileSync(join(HERE, "candidate-tree", PARTS[1]));
const rbCoord = readFileSync(join(HERE, "rollback-tree", PARTS[1]));
const candSvc = readFileSync(join(HERE, "candidate-tree", PARTS[2]));
const rbSvc = readFileSync(join(HERE, "rollback-tree", PARTS[2]));
const shared = candCoord.equals(rbCoord) && candSvc.equals(rbSvc);
console.log(`== shared code: candidate and rollback coordinator.mjs ` +
  `byte-identical: ${candCoord.equals(rbCoord)}; ` +
  `generation/service.mjs byte-identical: ${candSvc.equals(rbSvc)}`);
if (!shared) failures++;
console.log(failures === 0
  ? "COMPOSITION OK: both trees differ from the live baseline in " +
    "exactly the three parts; Parts 2 and 3 are shared verbatim."
  : `COMPOSITION FAILED (${failures} check(s))`);
process.exit(failures === 0 ? 0 : 1);
