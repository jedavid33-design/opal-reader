// Shared helpers for the P7 migration-rehearsal modules: canonical JSON
// (stable key order) + digests, so corpus comparisons are byte-exact and
// order-insensitive in construction but strict in content.
import { createHash } from "node:crypto";

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}

export function digest(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function sha256hex(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
