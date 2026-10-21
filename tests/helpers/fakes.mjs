// P3 test doubles: fake providers + fake audio cache. Zero spend, by
// construction — these stand at the synthesis seam exactly where the
// real Gemini/R2 adapters will sit in the integration phase.
import { createHash } from "node:crypto";
//
// Error taxonomy the executor relies on (mirrors v1's classification):
//   throw { httpStatus: n }  -> the provider ANSWERED: a known outcome
//   throw anything else      -> transport ambiguity: outcome unknown
export function makeFakeProviders() {
  const calls = { synthesize: 0, submitBatch: 0, getBatch: 0, listBatches: 0 };
  const batches = new Map(); // name -> { displayName, polls }
  let batchSeq = 0;
  const providers = {
    calls, batches,
    behavior: { synth: null, submit: null, list: null },
    async synthesize(occ) {
      calls.synthesize++;
      if (providers.behavior.synth) return providers.behavior.synth(occ, calls.synthesize);
      const secs = Math.max(1, Math.round(String(occ.payload.text).length / 14));
      return { audio: `AUDIO:${occ.occurrenceId}`, format: "mp3", durationSec: secs };
    },
    async submitBatch(occ, displayName) {
      calls.submitBatch++;
      if (providers.behavior.submit) return providers.behavior.submit(occ, displayName, calls.submitBatch);
      const name = `batches/fake-${++batchSeq}`;
      batches.set(name, { displayName, polls: 0 });
      return { name };
    },
    async getBatch(name) {
      calls.getBatch++;
      const b = batches.get(name);
      if (!b) throw Object.assign(new Error("no such batch"), { httpStatus: 404 });
      b.polls++;
      if (b.polls >= 2)
        return { done: true, state: "BATCH_STATE_SUCCEEDED",
                 audio: `BATCHAUDIO:${name}`, format: "mp3", durationSec: 42 };
      return { done: false, state: "BATCH_STATE_RUNNING" };
    },
    async listBatchesByDisplayName(displayName) {
      calls.listBatches++;
      if (providers.behavior.list) return providers.behavior.list(displayName);
      return [...batches.entries()]
        .filter(([, b]) => b.displayName === displayName)
        .map(([name]) => ({ name, displayName }));
    },
  };
  return providers;
}

// The audio cache: content-addressed, putIfAbsent at the storage
// layer (R2 onlyIf in production). Its probe matches the harness's
// probe contract ({exists, sniff, recordedIdentity, hash,
// recordedSha256, keyFor}); an object's recorded identity is the
// content key it lives under.
export function makeFakeCache() {
  const store = new Map();
  return {
    store,
    putIfAbsent(key, entry) {
      if (store.has(key)) return { stored: false, object: store.get(key) };
      // The write-time record: the digest of the bytes as written —
      // what the coordinator's mandatory digest check (P2 round 3)
      // compares the report's stated hash against.
      const sha = createHash("sha256").update(String(entry.audio)).digest("hex");
      store.set(key, { ...entry, identity: key, sha });
      return { stored: true, object: store.get(key) };
    },
    get(key) { return store.get(key); },
    probe: {
      exists: k => store.has(k),
      sniff: k => (store.has(k) ? store.get(k).format : null),
      recordedIdentity: k => (store.has(k) ? store.get(k).identity ?? null : null),
      hash: k => (store.has(k) ? store.get(k).sha ?? null : null),
      recordedSha256: k => (store.has(k) ? store.get(k).sha ?? null : null),
      keyFor: () => null,
    },
  };
}
