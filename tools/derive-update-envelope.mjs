// Opal Reader v2 — Part 2 F1 REVISION (Rowan 6349834892): derive the
// EXISTING-SCRIPT UPDATE envelope from a built artifact.
//
// Usage: node tools/derive-update-envelope.mjs [--dist <dir>] [--out <file>]
// Default dist: dist/p8-part1. Default out: tools/update-envelope.json.
//
// The first upload (Part 2 Phase A) CREATED opalreader-api-v2 with a
// class-creation migration. The replacement upload is an UPDATE of
// that existing script, and its metadata is a DERIVED OVERLAY on the
// pinned creation metadata — not a builder/spec change:
//
//   * `migrations` is REMOVED. The Script Upload API schema types
//     the field optional ("Migrations to apply for Durable Objects
//     associated with this Worker"); nothing is being applied. The
//     legacy migrations documentation is explicit that
//     `new_sqlite_classes` on a later migration FAILS for an
//     already-deployed class, and tags are unique/applied-once —
//     replaying the creation step is affirmatively wrong. The
//     script's `migration_tag` is persistent script state ("the tag
//     of the Durable Object migration that was most recently
//     applied"), not a per-upload input; the execution plan
//     re-verifies it reads "v1" after the update.
//   * The secret the first upload did not carry (Julie set it on
//     the script afterwards) is appended as the documented
//     {type:"inherit", name:"OPALREADER_ACCESS_TOKEN"} binding —
//     the API's binding kind whose value is copied from the
//     previous version and never travels in the payload.
//   * The request carries bindings_inherit=strict as a QUERY
//     parameter (ScriptUpdateParams: "the upload will fail if any
//     `inherit` type bindings cannot be resolved against the
//     previous version of the Worker. Without this, unresolvable
//     inherit bindings are silently dropped."), recorded in the
//     artifact's `request` block so it is pinned, not remembered.
//
// Everything else — main_module, compatibility, the seven config
// bindings, observability — is carried field-identical from the
// creation metadata. Deterministic: fixed key order, fixed JSON
// formatting, no timestamps. The companion validator
// (tools/validate-update-envelope.mjs) re-derives the same metadata
// from the dist artifact and compares, so the committed artifact is
// proven derived on every validation run.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export const INHERIT_BINDING = { name: "OPALREADER_ACCESS_TOKEN", type: "inherit" };

// The derivation, as a pure function of the creation metadata.
export function deriveUpdateMetadata(creationMetadata) {
  const metadata = JSON.parse(JSON.stringify(creationMetadata));
  delete metadata.migrations; // no migration is applied by an update of an unchanged class
  metadata.bindings = [...metadata.bindings, { ...INHERIT_BINDING }];
  return metadata;
}

export function buildUpdateEnvelopeArtifact(creationMetadata, spec) {
  return {
    comment:
      "Existing-script UPDATE envelope for opalreader-api-v2 (Part 2 replacement upload). " +
      "DERIVED from the pinned creation metadata by tools/derive-update-envelope.mjs: the creation " +
      "migration is removed (no migration is applied; replaying new_sqlite_classes on the deployed " +
      "class would fail), and the dashboard-set secret is carried as an inherit binding. The value of " +
      "OPALREADER_ACCESS_TOKEN never appears here. Execution is governed by the replacement-upload " +
      "plan; this file authorizes nothing.",
    request: {
      method: "PUT",
      path: `/accounts/{account_id}/workers/scripts/${spec.script_name}`,
      query: { bindings_inherit: "strict" },
    },
    metadata: deriveUpdateMetadata(creationMetadata),
  };
}

// CLI portion — runs only when invoked directly, never on import
// (tools/validate-update-envelope.mjs imports the pure derivation).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const distDir = args.includes("--dist") ? resolve(root, args[args.indexOf("--dist") + 1]) : join(root, "dist", "p8-part1");
  const outPath = args.includes("--out") ? resolve(root, args[args.indexOf("--out") + 1]) : join(root, "tools", "update-envelope.json");
  const creation = JSON.parse(readFileSync(join(distDir, "upload-metadata.json"), "utf8"));
  const spec = JSON.parse(readFileSync(join(distDir, "deploy-spec.json"), "utf8"));
  const artifact = buildUpdateEnvelopeArtifact(creation, spec);
  const bytes = Buffer.from(JSON.stringify(artifact, null, 2) + "\n", "utf8");
  writeFileSync(outPath, bytes);
  const metadataBytes = Buffer.from(JSON.stringify(artifact.metadata, null, 2) + "\n", "utf8");
  console.log(`update envelope written: ${outPath}`);
  console.log(`envelope file sha256: ${sha256(bytes)}`);
  console.log(`serialized metadata sha256: ${sha256(metadataBytes)}`);
  console.log(`metadata part bytes: ${metadataBytes.length}`);
}
