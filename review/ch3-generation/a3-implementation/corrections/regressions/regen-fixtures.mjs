// S1 scaffolding: regenerate the cured identity fixtures from the
// two trees on disk. Run after any candidate-tree change (and once
// before the final run). Adapted from the B-G2 build's regen script
// (same mechanics, S1 labels). Writes:
//   fixtures/identity-s1.json  — containment-fixture shape
//     (changedParts + nodeCheckParts) PLUS a full pinned manifest of
//     the baseline (pre-build) tree, so every standing battery's
//     identity test verifies BOTH trees against recorded hashes.
//   p2/combined.diff            — unified diff baseline -> candidate
//     over the changed parts (patch -p1 round-trip evidence).
//   r5a/coordinator.diff        — the coordinator-only slice of it
//     (empty for S1: the coordinator is not a changed part).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CAND = join(ROOT, "candidate-tree");
const BASE = join(ROOT, "baseline-tree");
const shaFile = (p) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");

function listFiles(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) out.push(...listFiles(join(dir, name.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

const files = listFiles(CAND);
const baseFiles = listFiles(BASE);
if (JSON.stringify(files) !== JSON.stringify(baseFiles))
  throw new Error("candidate and baseline file lists differ");

const baselineParts = files.map((rel) => ({ rel, sha256: shaFile(join(BASE, rel)) }));
const changedParts = files
  .filter((rel) => shaFile(join(BASE, rel)) !== shaFile(join(CAND, rel)))
  .map((rel) => ({ rel, sha256: shaFile(join(CAND, rel)) }));

writeFileSync(join(HERE, "fixtures", "identity-s1.json"), JSON.stringify({
  baseline: "baseline-tree (composed build fdb02395b3775dc945baa395591a73060ab146c4, pre-S1)",
  tree: "candidate-tree",
  changedParts,
  nodeCheckParts: changedParts.map((p) => p.rel),
  baselineParts,
}, null, 2) + "\n");

function unifiedDiff(rels) {
  let out = "";
  for (const rel of rels) {
    try {
      out += execFileSync("diff", ["-u", "--label", `a/${rel}`,
        "--label", `b/${rel}`, join(BASE, rel), join(CAND, rel)],
        { encoding: "utf8" });
    } catch (e) {
      if (e.status === 1 && typeof e.stdout === "string") out += e.stdout;
      else throw e;
    }
  }
  return out;
}
writeFileSync(join(HERE, "p2", "combined.diff"),
  unifiedDiff(changedParts.map((p) => p.rel)));
writeFileSync(join(HERE, "r5a", "coordinator.diff"),
  changedParts.some((p) => p.rel === "v2/coordinator.mjs")
    ? unifiedDiff(["v2/coordinator.mjs"]) : "");

console.log(`changed parts: ${changedParts.length}`);
for (const p of changedParts) console.log(`  ${p.rel}  ${p.sha256}`);
