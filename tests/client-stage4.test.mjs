import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeHarness } from "./helpers/do-harness.mjs";
import { SyncClient } from "./helpers/sync-client.mjs";
import { createAssembledClient } from "../v2/client/assembled-client.mjs";

// Stage 4 evidence, IN THE PLAN'S ORDER: (1) Find Text in Segments verified
// working in the assembled client FIRST — the lab is absent from the
// composition, and Find never depended on it (F10). (2) The removals:
// azure/fish generation rejected, existing audio on every former provider
// still plays, removed-provider cast voices flagged for a mapping decision
// — never silently substituted.
function makeWorld() {
  const h = makeHarness();
  const coord = h.coord;
  const mkStorage = () => {
    const map = new Map();
    return { get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined), set: async (k, v) => { map.set(k, structuredClone(v)); }, del: async (k) => { map.delete(k); } };
  };
  const byteWorld = new Set();
  const transport = {
    sendCommand: async ({ command_id, type, payload }) => coord.handleCommand({ command_id, type, payload }),
    pullChanges: async (family, sinceSeq, limit) => coord.pullChanges({ family, sinceSeq, limit }),
    snapshot: async (family) => coord.syncSnapshot({ family }),
    pushPosition: async () => { throw new Error("unused"); },
    positionView: async (bookId) => coord.positionView(bookId),
    quotaView: async () => coord.quotaView(),
    byteCheck: async (key) => byteWorld.has(key),
  };
  const device = (deviceId) => createAssembledClient({ deviceId, storage: mkStorage(), transport });
  return { coord, byteWorld, device };
}

const BOOK = {
  title: "Findable", occurrenceIds: ["o1", "o2", "o3"],
  chapters: [
    { id: "ch1", segments: [{ occurrenceId: "o1", text: "the harbor at dawn" }] },
    { id: "ch2", segments: [{ occurrenceId: "o2", text: "a needle in the second chapter" }, { occurrenceId: "o3", text: "another NEEDLE here" }] },
  ],
  povs: [
    { id: "pov-g", name: "Gemma", voice: { provider: "gemini", voice_id: "Aoede" } },
    { id: "pov-a", name: "Azura", voice: { provider: "azure", voice_id: "en-US-Jenny" } },
    { id: "pov-f", name: "Fisher", voice: { provider: "fish", voice_id: "f-123" } },
  ],
  defaultVoice: { provider: "openai", voice_id: "alloy" },
};

test("stage4 FIRST — Find works in the assembled client, with no lab anywhere in the composition", async () => {
  const w = makeWorld();
  const seed = new SyncClient(w.coord, "seed");
  await seed.pushBook("bk", BOOK);
  await seed.pushBook("other", { title: "Other", occurrenceIds: ["x1"], chapters: [{ id: "ch1", segments: [{ occurrenceId: "x1", text: "needle elsewhere" }] }] });
  const a = w.device("devA");
  await a.funnel.syncNow();
  const hits = await a.findText("needle");
  assert.equal(hits.length, 3); // ch2 twice (case-insensitive) + the other book once
  const inBk = hits.filter((x) => x.bookId === "bk");
  assert.deepEqual(inBk.map((x) => x.occurrenceId).sort(), ["o2", "o3"]);
  assert.equal(inBk[0].chapterId, "ch2");
  assert.match(inBk[0].snippet, /needle/i);
  const scoped = await a.findText("needle", { bookId: "bk" });
  assert.equal(scoped.length, 2); // bookId scoping works
  // The lab is absent BY CONSTRUCTION: no prosody code in any client module.
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const p of ["../v2/client/assembled-client.mjs", "../v2/client/funnel.mjs", "../v2/client/projection.mjs", "../v2/client/surfaces.mjs", "../v2/client/removals.mjs", "../v2/client-store.mjs"]) {
    const src = strip(await readFile(new URL(p, import.meta.url), "utf8"));
    assert.equal(/prosody/i.test(src), false, p);
  }
});

test("stage4 removals: azure/fish generation intents are rejected locally before persistence; kept providers pass", async () => {
  const w = makeWorld();
  const a = w.device("devA");
  await assert.rejects(() => a.store.intent("SubmitJob", { provider: "azure", bookId: "bk" }), /provider_not_carried_over/);
  await assert.rejects(() => a.store.intent("SubmitJob", { provider: "fish", bookId: "bk" }), /provider_not_carried_over/);
  let st = await a.store.outboxState();
  assert.equal(st.pending.length, 0); // nothing persisted for the rejected providers
  await a.store.intent("SubmitJob", { provider: "gemini", bookId: "bk" });
  st = await a.store.outboxState();
  assert.equal(st.pending.length, 1);
});

test("stage4 legacy playback: bindings from EVERY former provider resolve and count — audio is preserved", async () => {
  const w = makeWorld();
  const seed = new SyncClient(w.coord, "seed");
  await seed.pushBook("bk", BOOK);
  for (const [occ, prov] of [["o1", "azure"], ["o2", "elevenlabs"], ["o3", "speechify"]]) {
    await seed.push([{ family: "bindings", entityKey: `bk:${occ}`, bookId: "bk", baseRevision: 0, op: "upsert", payload: { cacheKey: `k-${occ}`, outcome: "ready", provider: prov } }]);
  }
  const a = w.device("devA");
  await a.funnel.syncNow();
  for (const prov of ["azure", "fish", "elevenlabs", "speechify", "gemini", "openai"]) {
    const r = a.store.resolvePlayback({ cacheKey: `k-any`, provider: prov });
    assert.equal(r.ok, true, prov); // resolution is by cache key — provider-agnostic
    assert.equal(r.provider, prov);
  }
  for (const occ of ["o1", "o2", "o3"]) { w.byteWorld.add(`k-${occ}`); await a.store.verifyBindingBytes("bk", occ); }
  const m1 = await a.projection.chapterModel("bk", "ch1");
  const m2 = await a.projection.chapterModel("bk", "ch2");
  assert.equal(m1.label, "Complete"); // azure audio counts, in full
  assert.equal(m2.label, "Complete"); // elevenlabs + speechify too
});

test("stage4 review gate: an UNMAPPED removed-provider voice cannot submit new generation — the flag enforces, not warns", async () => {
  const w = makeWorld();
  const a = w.device("devA");
  const bookBefore = structuredClone(BOOK);
  // The job names a KEPT provider — the old provider-level guard alone would wave it through:
  await assert.rejects(() => a.store.intent("SubmitJob", { provider: "gemini", bookId: "bk", book: BOOK }), /unmapped_removed_provider_voice/);
  let st = await a.store.outboxState();
  assert.equal(st.pending.length, 0); // rejected before persistence
  // With an explicit mapping for both removed-provider POVs, the same job is accepted:
  const id = await a.store.intent("SubmitJob", {
    provider: "gemini", bookId: "bk", book: BOOK,
    voiceMapping: { "pov-a": { provider: "gemini", voice_id: "Aoede" }, "pov-f": { provider: "openai", voice_id: "alloy" } },
  });
  assert.ok(id);
  st = await a.store.outboxState();
  assert.equal(st.pending.length, 1);
  assert.deepEqual(BOOK, bookBefore); // the mapping is a job directive — the book was never rewritten
  // A partial mapping still blocks (the unmapped fish voice remains):
  await assert.rejects(() => a.store.intent("SubmitJob", {
    provider: "gemini", bookId: "bk", book: BOOK,
    voiceMapping: { "pov-a": { provider: "gemini", voice_id: "Aoede" } },
  }), /unmapped_removed_provider_voice/);
});

test("stage4 review gate 2: a bare { bookId } request is checked against the SAVED book — POVs, default voice, SubmitJob and RepairJob", async () => {
  const w = makeWorld();
  const seed = new SyncClient(w.coord, "seed");
  await seed.pushBook("bk", BOOK); // azure + fish POVs, openai default
  await seed.pushBook("bk2", { ...BOOK, title: "DefaultVoiced", povs: [{ id: "p1", name: "G", voice: { provider: "gemini", voice_id: "Aoede" } }], defaultVoice: { provider: "azure", voice_id: "en-US-Jenny" } });
  const a = w.device("devA");
  await a.funnel.syncNow(); // both books now SAVED in this device's cache
  // bookId-only, SubmitJob: the saved book's azure/fish POVs block it:
  await assert.rejects(() => a.store.intent("SubmitJob", { bookId: "bk" }), /unmapped_removed_provider_voice/);
  // bookId-only, RepairJob: same enforcement:
  await assert.rejects(() => a.store.intent("RepairJob", { bookId: "bk" }), /unmapped_removed_provider_voice/);
  // bookId-only with full mappings: accepted:
  const id = await a.store.intent("SubmitJob", { bookId: "bk", voiceMapping: { "pov-a": { provider: "gemini", voice_id: "Aoede" }, "pov-f": { provider: "openai", voice_id: "alloy" } } });
  assert.ok(id);
  // defaultVoice coverage: bk2's POVs are clean but its DEFAULT voice is azure:
  await assert.rejects(() => a.store.intent("SubmitJob", { bookId: "bk2" }), /unmapped_removed_provider_voice: \(default voice\) \(azure\)/);
  const id2 = await a.store.intent("SubmitJob", { bookId: "bk2", voiceMapping: { defaultVoice: { provider: "gemini", voice_id: "Aoede" } } });
  assert.ok(id2);
  const st = await a.store.outboxState();
  assert.equal(st.pending.length, 2); // only the two mapped jobs were ever persisted
});

test("stage4 voice mapping: removed-provider POVs are flagged for a decision; the book is never rewritten", async () => {
  const w = makeWorld();
  const a = w.device("devA");
  const before = structuredClone(BOOK);
  const vs = a.removals.voiceStatus(BOOK);
  assert.equal(vs.clear, false);
  assert.deepEqual(vs.mappingNeeded.map((x) => x.name).sort(), ["Azura", "Fisher"]);
  assert.deepEqual(vs.mappingNeeded.map((x) => x.provider).sort(), ["azure", "fish"]);
  assert.deepEqual(BOOK, before); // inspected, not substituted — byte for byte
  const clean = a.removals.voiceStatus({ povs: [{ id: "p", name: "G", voice: { provider: "gemini" } }], defaultVoice: { provider: "openai" } });
  assert.equal(clean.clear, true);
  assert.deepEqual(a.removals.REMOVED_GENERATION_PROVIDERS, ["azure", "fish"]);
});
