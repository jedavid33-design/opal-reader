// CH2 FIX PACKAGE — fix 1: the Gemini 3.8 interactions branch
// must map an HTTP-200 no-audio / blocked response to the same
// contentBlocked result the generateContent branch produces, so
// the recursive POLICY_BLOCK splitting path engages (feature law
// F3). Pre-fix, that branch threw a plain synthesized 502, the
// refusal was classified as a known provider failure, and no
// split was ever attempted — the Oct 29, 2026 Ch 2 halt
// diagnosis's prime-suspect branch (Q5 (b)): eight segments
// failed identically on exactly one call each.
//
// Synthetic responses only; the fetch stub records every request
// so call counts, texts, and voice identity are asserted exactly.
// No voice substitution is possible anywhere in this path: every
// split retry carries the original payload's voice/model/style,
// with only the text cut — asserted below on the recorded calls.
import test from "node:test";
import assert from "node:assert/strict";
import { createProviderAdapters } from "../worker/host/adapters.mjs";
import { synthesizeSegment } from "../worker/generation/policy-split.mjs";
import { syntheticWav } from "./helpers/d6-fakes.mjs";

const ENV = { GEMINI_API_KEY: "ch2fix-test-key", GENERATION_HALT: "0" };
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const WAV_B64 = b64(syntheticWav("x").audio);

function jsonResponse(status, data, rawText = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => rawText ?? JSON.stringify(data ?? {}),
  };
}

// A fetch stub for the interactions endpoint. `behavior(text)`
// returns the response for a request carrying that text.
function interactionsFetch(behavior) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    assert.match(String(url), /\/v1beta\/interactions$/);
    const body = JSON.parse(init.body);
    const text = body.input[0].content[0].text;
    calls.push({ text, voice: body.generation_config.speech_config[0].voice, model: body.model });
    return behavior(text);
  };
  return { calls, fetchImpl };
}

const audioResponse = () => jsonResponse(200, {
  id: "req-ok",
  steps: [{ type: "model_output", content: [{ type: "audio", data: WAV_B64 }] }],
});
const textRefusalResponse = () => jsonResponse(200, {
  id: "req-refused",
  steps: [{ type: "model_output", content: [{ type: "text", text: "I can't generate audio for that passage." }] }],
});
const signalRefusalResponse = () => jsonResponse(200, {
  id: "req-refused-signal",
  steps: [{ type: "model_output", finishReason: "PROHIBITED_CONTENT", content: [] }],
});

const occ = (text) => ({
  occurrenceId: "occ-ch2fix",
  payload: { provider: "gemini", model: "gemini-3.8-flash-tts", text, voice: "Zephyr", styleDirection: "warm" },
});

test("fix1: a text-refusal interactions 200 maps to contentBlocked (POLICY_BLOCK), not a bare 502", async () => {
  const { calls, fetchImpl } = interactionsFetch(() => textRefusalResponse());
  const adapters = createProviderAdapters(ENV, fetchImpl);
  await assert.rejects(adapters.synthesize(occ("any text")), (err) => {
    assert.equal(err.contentBlocked, true, "the splitting path's trigger flag is set");
    assert.equal(err.blockReason, "POLICY_BLOCK");
    assert.equal(err.httpStatus, 502, "still the no-audio 502 shape underneath");
    assert.match(err.message, /returned no audio/);
    return true;
  });
  assert.equal(calls.length, 1);
});

test("fix1: an explicit PROHIBITED_CONTENT signal maps blockReason PROHIBITED_CONTENT (generateContent parity)", async () => {
  const { fetchImpl } = interactionsFetch(() => signalRefusalResponse());
  const adapters = createProviderAdapters(ENV, fetchImpl);
  await assert.rejects(adapters.synthesize(occ("any text")), (err) => {
    assert.equal(err.contentBlocked, true);
    assert.equal(err.blockReason, "PROHIBITED_CONTENT");
    return true;
  });
});

test("fix1: a clean interactions response is unchanged — one call, audio returned as-is", async () => {
  const { calls, fetchImpl } = interactionsFetch(() => audioResponse());
  const adapters = createProviderAdapters(ENV, fetchImpl);
  const res = await adapters.synthesize(occ("clean text"));
  assert.equal(calls.length, 1, "exactly one provider call");
  assert.deepEqual(Buffer.from(res.audio).toString("base64"), WAV_B64, "audio bytes pass through untouched");
  assert.equal(res.format, "wav");
});

test("fix1: non-block provider errors keep their classification — no contentBlocked, no split fuel", async () => {
  const http500 = interactionsFetch(() =>
    jsonResponse(500, { error: { message: "internal error" } }));
  const a500 = createProviderAdapters(ENV, http500.fetchImpl);
  await assert.rejects(a500.synthesize(occ("boom")), (err) => {
    assert.equal(err.httpStatus, 500);
    assert.ok(!err.contentBlocked, "a 500 is not a policy block");
    return true;
  });
  const http400 = interactionsFetch(() =>
    jsonResponse(400, { error: { message: "invalid voice name" } }));
  const a400 = createProviderAdapters(ENV, http400.fetchImpl);
  await assert.rejects(a400.synthesize(occ("boom")), (err) => {
    assert.equal(err.httpStatus, 400);
    assert.ok(!err.contentBlocked, "a non-policy 400 is not a policy block");
    return true;
  });
  const transport = createProviderAdapters(ENV, async () => { throw new Error("socket reset"); });
  await assert.rejects(transport.synthesize(occ("boom")), (err) => {
    assert.ok(!err.httpStatus && !err.contentBlocked,
      "a transport throw stays billing-unknown class — neither flag set");
    return true;
  });
});

test("fix1: splitter engagement end-to-end — blocked whole splits, halves succeed, voice identical on every call", async () => {
  const MARK_A = "marker-alpha", MARK_B = "marker-beta";
  const left = `Alpha synthetic sentence carries ${MARK_A} inside a comfortably long line of invented prose.`;
  const right = `Beta synthetic sentence carries ${MARK_B} inside another comfortably long line of prose.`;
  const text = `${left} ${right}`;
  // The stub refuses (interactions text-refusal shape) whenever a
  // request carries BOTH markers — the whole segment — and serves
  // audio for any proper part. This is the Ch 2 failure shape:
  // pre-fix it cost exactly one call and a failed execution.
  const { calls, fetchImpl } = interactionsFetch((t) =>
    t.includes(MARK_A) && t.includes(MARK_B) ? textRefusalResponse() : audioResponse());
  const adapters = createProviderAdapters(ENV, fetchImpl);
  const payload = { provider: "gemini", model: "gemini-3.8-flash-tts", text, voice: "Zephyr", styleDirection: "warm" };
  const budget = { remaining: 12 };
  const r = await synthesizeSegment({
    synthesize: (p) => adapters.synthesize({ occurrenceId: "occ-ch2fix", payload: p }),
    payload, budget,
  });
  assert.equal(calls.length, 3, "whole (refused) + two halves — the split actually happened");
  assert.equal(r.attemptsUsed, 3);
  assert.equal(r.parts.length, 2, "two leaf parts in reading order");
  assert.equal(calls[1].text + calls[2].text, text, "the parts concatenate to the original text EXACTLY");
  for (const c of calls) {
    assert.equal(c.voice, "Zephyr", "same cast voice on every call — never substituted");
    assert.equal(c.model, "gemini-3.8-flash-tts", "same model on every call");
  }
});

test("fix1: a segment that blocks at every depth still terminates as TerminalBlock through the adapter mapping", async () => {
  const { calls, fetchImpl } = interactionsFetch(() => textRefusalResponse());
  const adapters = createProviderAdapters(ENV, fetchImpl);
  const payload = {
    provider: "gemini", model: "gemini-3.8-flash-tts",
    text: "One synthetic sentence that the stub refuses at every size, padded to a splittable length for the recursion.",
    voice: "Zephyr", styleDirection: "",
  };
  const budget = { remaining: 12 };
  await assert.rejects(
    synthesizeSegment({
      synthesize: (p) => adapters.synthesize({ occurrenceId: "occ-ch2fix", payload: p }),
      payload, budget,
    }),
    (err) => err && err.code === "policy_block_terminal",
    "unresolvable blocks surface as TerminalBlock, never as a bare provider failure");
  assert.ok(calls.length > 1 && calls.length <= 12,
    `the split tree was explored within the pinned budget (calls: ${calls.length})`);
});
