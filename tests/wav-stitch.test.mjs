// Run: node --test tests/wav-stitch.test.mjs
// Uses synthetic audio only: no private book narration or provider calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(new URL("../cloudflare-worker.js", import.meta.url), "utf8");
const between = (start, end) => {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert.ok(a >= 0 && b > a, "Worker source is missing WAV stitching functions");
  return src.slice(a, b);
};
const helpers = between("function pcmToWav(", "// Cloudflare's R2/KV bindings occasionally");
const composer = between("async function chapterCompositeAudio(", "async function compositeCacheKey(");

const archive = new Map();
const storage = {
  head: async (key) => archive.has(key) ? { size: archive.get(key).length } : null,
  get: async (key) => archive.has(key) ? { body: archive.get(key) } : null,
  put: async (key, value) => { archive.set(key, value instanceof Uint8Array ? value : new Uint8Array(value)); },
};
const FakeResponse = class {
  constructor(body) { this.body = body; }
  async arrayBuffer() {
    return this.body.buffer.slice(this.body.byteOffset, this.body.byteOffset + this.body.byteLength);
  }
};
const worker = new Function("deps", 
  "const { AUDIO_EXTENSIONS, r2Head, r2Get, validCacheKey, audioContentType, Response } = deps;\n" +
  helpers + "\n" + composer + "\nreturn { chapterCompositeAudio, extractWavPcm };"
)({
  AUDIO_EXTENSIONS: ["mp3", "wav"],
  r2Head: (env, key) => env.OPALREADER_STORAGE.head(key),
  r2Get: (env, key) => env.OPALREADER_STORAGE.get(key),
  validCacheKey: (key) => /^[a-f0-9]{64}$/.test(key),
  audioContentType: (format) => format === "wav" ? "audio/wav" : "audio/mpeg",
  Response: FakeResponse,
});

const key1 = "a".repeat(64), key2 = "b".repeat(64);
const env = { OPALREADER_STORAGE: storage };

function riff(chunks) {
  const len = 12 + chunks.reduce((sum, [, b]) => sum + 8 + b.length + (b.length & 1), 0);
  const output = new Uint8Array(len), view = new DataView(output.buffer);
  const writeTag = (pos, tag) => {
    for (let i = 0; i < 4; i++) output[pos + i] = tag.charCodeAt(i);
  };
  writeTag(0, "RIFF"); view.setUint32(4, len - 8, true); writeTag(8, "WAVE");
  let at = 12;
  for (const [type, data] of chunks) {
    writeTag(at, type); view.setUint32(at + 4, data.length, true);
    output.set(data, at + 8); at += 8 + data.length + (data.length & 1);
  }
  return output;
}
function wav(pcm, { extraHeader = false, sampleRate = 24000 } = {}) {
  const fmt = new Uint8Array(16), v = new DataView(fmt.buffer);
  v.setUint16(0, 1, true); v.setUint16(2, 1, true); // PCM mono
  v.setUint32(4, sampleRate, true); v.setUint32(8, sampleRate * 2, true);
  v.setUint16(12, 2, true); v.setUint16(14, 16, true);
  return riff([
    ["fmt ", fmt],
    ...(extraHeader ? [["JUNK", Uint8Array.of(1, 2, 3)]] : []),
    ["data", pcm],
    ["C2PA", new Uint8Array(6062).fill(0xff)],
  ]);
}

test("chapter stitch includes only PCM data, never trailing C2PA metadata", async () => {
  archive.clear();
  const first = Uint8Array.of(5, 0, 9, 0);
  const second = Uint8Array.of(11, 0, 13, 0);
  archive.set("audio/" + key1 + ".wav", wav(first));
  archive.set("audio/" + key2 + ".wav", wav(second, { extraHeader: true }));
  const combined = await worker.chapterCompositeAudio(env, [key1, key2], "stitch-regression-v2");
  assert.equal(combined.cache, "MISS");
  const parsed = worker.extractWavPcm(combined.body);
  assert.deepEqual(Array.from(parsed.pcm), [...first, ...second]);
  assert.equal(parsed.format.sampleRate, 24000);
  assert.equal(combined.body.length, 44 + first.length + second.length);
  const cached = await worker.chapterCompositeAudio(env, [key1, key2], "stitch-regression-v2");
  assert.equal(cached.cache, "HIT");
});

test("mixed WAV formats fail safely instead of creating corrupt narration", async () => {
  archive.clear();
  archive.set("audio/" + key1 + ".wav", wav(Uint8Array.of(0, 0)));
  archive.set("audio/" + key2 + ".wav", wav(Uint8Array.of(0, 0), { sampleRate: 16000 }));
  await assert.rejects(
    worker.chapterCompositeAudio(env, [key1, key2], "format-test-v2"),
    (error) => error.status === 422 && /incompatible/i.test(error.message),
  );
});

test("invalid RIFF headers are rejected", () => {
  assert.throws(() => worker.extractWavPcm(new Uint8Array(44)), (error) => error.status === 422);
});
