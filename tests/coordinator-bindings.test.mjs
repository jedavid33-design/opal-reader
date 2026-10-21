// P2: audio create-if-absent conflict validation (Rowan criterion 2).
// Existing audio is never silently overwritten and never bound on faith.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe } from "./helpers/do-harness.mjs";

const bind = (h, payload) => h.coord.validateAndBind(payload);

test("clean bind: identity matches the recorded cache identity", () => {
  const h = makeHarness({ probe: makeProbe(new Map([["k1", { format: "mp3", identity: "fp-a" }]])) });
  const v = bind(h, { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k1" });
  assert.equal(v.bound, true);
  assert.equal(h.rows("bindings").length, 1);
  assert.equal(h.rows("binding_conflicts").length, 0);
});

test("first write binds and records the identity for future checks", () => {
  const h = makeHarness({ probe: makeProbe(new Map([["k1", { format: "wav", identity: null }]])) });
  const v = bind(h, { occurrenceId: "o1", revisionKey: "fp-new", cacheKey: "k1" });
  assert.equal(v.bound, true);
  assert.equal(h.rows("cache_index")[0].identity, "fp-new");
  // a later, different identity claiming the same key is now a conflict
  const v2 = bind(h, { occurrenceId: "o2", revisionKey: "fp-other", cacheKey: "k1" });
  assert.equal(v2.bound, false);
  assert.equal(v2.reason, "identity_mismatch");
});

test("identity mismatch: no bind, conflict visible, correct key still binds after", () => {
  const h = makeHarness({ probe: makeProbe(new Map([
    ["k1", { format: "mp3", identity: "fp-real" }],
    ["k2", { format: "mp3", identity: "fp-want" }],
  ])) });
  const v = bind(h, { occurrenceId: "o1", revisionKey: "fp-want", cacheKey: "k1" });
  assert.equal(v.bound, false);
  assert.equal(v.reason, "identity_mismatch");
  assert.equal(v.expected, "fp-want");
  assert.equal(v.found, "fp-real");
  assert.equal(h.rows("bindings").length, 0);
  const c = h.coord.conflictsView()[0];
  assert.equal(c.reason, "identity_mismatch");
  assert.equal(c.occurrence_id, "o1");
  const ok = bind(h, { occurrenceId: "o1", revisionKey: "fp-want", cacheKey: "k2" });
  assert.equal(ok.bound, true);
});

test("format invalid and object missing are distinct, and missing is not a conflict", () => {
  const h = makeHarness({ probe: makeProbe(new Map([["k1", { format: null, identity: null }]])) });
  const bad = bind(h, { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k1" });
  assert.equal(bad.bound, false);
  assert.equal(bad.reason, "format_invalid");
  const missing = bind(h, { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "ghost" });
  assert.equal(missing.bound, false);
  assert.equal(missing.reason, "object_missing");
  assert.equal(h.coord.conflictsView().filter(c => c.reason === "object_missing").length, 0);
  assert.equal(h.rows("bindings").length, 0);
});

test("legacy anchoring: a legacy revision binds only its own verified artifact (§1.3)", () => {
  const h = makeHarness({ probe: makeProbe(new Map([
    ["legkey", { format: "mp3", identity: null }],
    ["otherkey", { format: "mp3", identity: null }],
  ])) });
  const ok = bind(h, { occurrenceId: "o1", revisionKey: "legacy:legkey", cacheKey: "legkey" });
  assert.equal(ok.bound, true);
  const bad = bind(h, { occurrenceId: "o2", revisionKey: "legacy:legkey", cacheKey: "otherkey" });
  assert.equal(bad.bound, false);
  assert.equal(bad.reason, "legacy_anchor_mismatch");
});

test("an existing binding for the occurrence is never silently replaced", () => {
  const h = makeHarness({ probe: makeProbe(new Map([
    ["k1", { format: "mp3", identity: "fp-a" }],
    ["k2", { format: "mp3", identity: "fp-a" }],
  ])) });
  assert.equal(bind(h, { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k1" }).bound, true);
  const again = bind(h, { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k1" });
  assert.equal(again.bound, true);
  assert.equal(again.idempotent, true);
  const swap = bind(h, { occurrenceId: "o1", revisionKey: "fp-a", cacheKey: "k2" });
  assert.equal(swap.bound, false);
  assert.equal(swap.reason, "binding_conflict_existing");
  assert.equal(h.rows("bindings")[0].cache_key, "k1");
});

test("AdoptAudio command: applied when valid, recorded rejection on conflict", () => {
  const h = makeHarness({ probe: makeProbe(new Map([
    ["k1", { format: "mp3", identity: "fp-real" }],
  ])) });
  const bad = h.coord.handleCommand({ command_id: "a1", type: "AdoptAudio",
    payload: { occurrenceId: "o1", revisionKey: "fp-want", cacheKey: "k1" } });
  assert.equal(bad.outcome, "rejected");
  assert.equal(bad.reason, "identity_mismatch");
  assert.equal(h.coord.receipt("a1").outcome, "rejected");
});
