// D6 (WS-2) — recursive POLICY_BLOCK splitting (CONTRACTS.md §policy-split).
//
// Feature law: when the provider refuses a segment with POLICY_BLOCK,
// split the segment text and retry the parts recursively, keeping the
// same cast voice throughout — never substituting a different voice.
// The original text is preserved across every split: parts concatenate
// to the segment's text EXACTLY; nothing is rewritten, trimmed, or
// re-worded to slip past the filter. A part that still blocks at the
// recursion floor (depth cap, unsplittable without breaching the
// minimum part floor, or attempt budget exhausted) is terminal for
// that segment and surfaces as TerminalBlock — never silently skipped.
//
// Pinned values (CONTRACTS.md "Pins"): depth ≤ 4 (≤16 leaf parts),
// floor 50 chars, ≤12 attempted calls per segment across split tree +
// repair chain combined. Imported from WS-1's gen-constants.mjs (the
// canonical pin) and re-exported for this module's consumers.
import { SPLIT_MAX_DEPTH, SPLIT_MIN_PART_CHARS, SEGMENT_ATTEMPT_BUDGET } from "./gen-constants.mjs";
export { SPLIT_MAX_DEPTH, SPLIT_MIN_PART_CHARS, SEGMENT_ATTEMPT_BUDGET };

// Terminal POLICY_BLOCK: the segment (or a part of it) cannot be
// resolved by further splitting within the pinned ceilings.
export class TerminalBlock extends Error {
  constructor(depth, detail = null) {
    super(`policy_block_terminal at depth ${depth}${detail ? `: ${detail}` : ""}`);
    this.name = "TerminalBlock";
    this.code = "policy_block_terminal";
    this.depth = depth;
    this.detail = detail;
  }
}

// splitText(text, floor) -> [part, part] | null
//
// Split at the sentence boundary nearest the midpoint; fallback to the
// word boundary nearest the midpoint; final fallback the char
// midpoint. Both parts are >= floor whenever text.length >= 2*floor
// (candidates that would breach the floor are never chosen, and the
// char midpoint always satisfies the floor in that case). Returns null
// when the text cannot be split without breaching the floor
// (text.length < 2*floor). concat(parts) === text, always: a split is
// a single cut index, never an edit.
export function splitText(text, floor = SPLIT_MIN_PART_CHARS) {
  const s = String(text ?? "");
  if (s.length < 2 * floor) return null;
  const mid = s.length / 2;
  const ok = (i) => i >= floor && s.length - i >= floor;

  // Sentence boundaries: a cut just past sentence-ending punctuation
  // plus any following whitespace (the whitespace stays with the left
  // part, so concatenation stays exact and the right part starts at
  // the next sentence's first character).
  const sentenceCuts = [];
  const re = /[.!?]+["')\]]*\s+/g;
  let m;
  while ((m = re.exec(s)) !== null) sentenceCuts.push(m.index + m[0].length);
  const pickNearest = (cuts) => {
    let best = null;
    for (const i of cuts) {
      if (!ok(i)) continue;
      if (best === null || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
    }
    return best;
  };
  let cut = pickNearest(sentenceCuts);
  if (cut === null) {
    // Word boundaries: a cut just past a whitespace run nearest the
    // midpoint (whitespace stays with the left part).
    const wordCuts = [];
    const wre = /\s+/g;
    while ((m = wre.exec(s)) !== null) wordCuts.push(m.index + m[0].length);
    cut = pickNearest(wordCuts);
  }
  if (cut === null) cut = Math.floor(mid); // char midpoint; ok() holds by construction
  if (!ok(cut)) return null;
  return [s.slice(0, cut), s.slice(cut)];
}

// --- WAV stitching ---------------------------------------------------
//
// All D6 parts are WAV PCM 16-bit mono 24 kHz. stitchWav concatenates
// the PCM data chunks and rewraps them in one canonical 44-byte WAV
// header. Any format deviation throws — a corrupt composite is never
// produced silently.
function parseWav(bytes) {
  const fail = (why) => {
    const e = new Error(`wav_format_mismatch: ${why}`);
    e.code = "wav_format_mismatch";
    throw e;
  };
  if (!(bytes instanceof Uint8Array) || bytes.length < 44) fail("too short for a WAV header");
  const tag = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") fail("missing RIFF/WAVE header");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt = null, pcm = null;
  for (let at = 12; at + 8 <= bytes.length;) {
    const type = tag(at), length = dv.getUint32(at + 4, true);
    const start = at + 8, end = start + length;
    if (end > bytes.length) fail("chunk overruns file");
    if (type === "fmt " && length >= 16) {
      fmt = {
        audioFormat: dv.getUint16(start, true),
        channels: dv.getUint16(start + 2, true),
        sampleRate: dv.getUint32(start + 4, true),
        bitsPerSample: dv.getUint16(start + 14, true),
      };
    } else if (type === "data" && !pcm) {
      pcm = bytes.slice(start, end);
    }
    at = end + (length & 1);
  }
  if (!fmt) fail("no fmt chunk");
  if (!pcm) fail("no data chunk");
  if (fmt.audioFormat !== 1 || fmt.channels !== 1 ||
      fmt.sampleRate !== 24000 || fmt.bitsPerSample !== 16)
    fail(`expected PCM 16-bit mono 24kHz, got format=${fmt.audioFormat} channels=${fmt.channels} rate=${fmt.sampleRate} bits=${fmt.bitsPerSample}`);
  return pcm;
}

export function pcmToWav(pcmBytes, { sampleRate = 24000, channels = 1, bitsPerSample = 16 } = {}) {
  const pcm = pcmBytes instanceof Uint8Array ? pcmBytes : new Uint8Array(pcmBytes);
  const header = new DataView(new ArrayBuffer(44));
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) header.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  header.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, channels, true);
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, (sampleRate * channels * bitsPerSample) / 8, true);
  header.setUint16(32, (channels * bitsPerSample) / 8, true);
  header.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  header.setUint32(40, pcm.byteLength, true);
  const out = new Uint8Array(44 + pcm.byteLength);
  out.set(new Uint8Array(header.buffer), 0);
  out.set(pcm, 44);
  return out;
}

// stitchWav(parts) -> one WAV Uint8Array. Each part may be a raw
// Uint8Array or a provider result { audio, format }; a non-WAV part
// is a format mismatch and throws.
export function stitchWav(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    const e = new Error("wav_format_mismatch: no parts to stitch");
    e.code = "wav_format_mismatch";
    throw e;
  }
  const pcms = parts.map((p) => {
    const audio = p instanceof Uint8Array ? p : p?.audio;
    const format = p instanceof Uint8Array ? "wav" : (p?.format || "wav");
    if (format !== "wav") {
      const e = new Error(`wav_format_mismatch: part format is ${format}, expected wav`);
      e.code = "wav_format_mismatch";
      throw e;
    }
    if (!(audio instanceof Uint8Array)) {
      const e = new Error("wav_format_mismatch: part audio is not bytes");
      e.code = "wav_format_mismatch";
      throw e;
    }
    return parseWav(audio);
  });
  const total = pcms.reduce((n, p) => n + p.byteLength, 0);
  const pcm = new Uint8Array(total);
  let at = 0;
  for (const p of pcms) { pcm.set(p, at); at += p.byteLength; }
  return pcmToWav(pcm, { sampleRate: 24000, channels: 1, bitsPerSample: 16 });
}

// --- Pre-dispatch length split (CH2 FIX PACKAGE, fix 3) -----------
//
// The provider fetch carries a 120 s ceiling (AbortSignal.timeout
// (120000) in worker/host/adapters.mjs, both Gemini branches). A
// call that exceeds it throws a bare timeout — neither httpStatus
// nor contentBlocked — which the executor must classify
// unknown_billing (the billing outcome is genuinely ambiguous),
// halting the phase fail-closed. The Oct 29, 2026 Ch 2 halt's
// unknown attempt was most plausibly exactly this, on segments
// averaging ~1,394 chars (~87 s of audio at the realized rate).
//
// The pinned cost model already carries the conservative bound
// this threshold is derived from: upperBoundAttemptMicro
// (gen-constants.mjs) prices an attempt at chars / 10 chars-per-
// second — the slowest speaking rate the model admits. A segment
// of C chars can therefore legitimately produce up to C/10
// seconds of audio, and a successful generation whose audio alone
// can exceed the 120 s fetch window is a timeout risk BY
// CONSTRUCTION. Pre-splitting every segment above
// 120 s × 10 chars/s = 1,200 chars — through splitText, the same
// exact-concat machinery as the policy path — guarantees every
// single provider call's worst-case audio (≤120 s at the pinned
// bound; ~75 s at the realized 15.96 chars/s) fits the window.
// Unknown billing stays fail-closed: this reduces the incidence
// of timeout-unknowns, it never reclassifies one after the fact.
export const PRE_SPLIT_MAX_CHARS = 1200;

// preSplitText(text, maxChars) -> [chunk, ...]: every chunk is
// <= maxChars, chunks concatenate to the text EXACTLY, in order.
// Splits only ever happen at splitText cut points (sentence, then
// word, then char midpoint) — the text is never edited. A text at
// or under the ceiling is returned as a single untouched chunk.
export function preSplitText(text, maxChars = PRE_SPLIT_MAX_CHARS) {
  const s = String(text ?? "");
  if (s.length <= maxChars) return [s];
  const halves = splitText(s, SPLIT_MIN_PART_CHARS);
  // maxChars (1200) >> 2 * SPLIT_MIN_PART_CHARS, so any text over
  // the ceiling is always splittable; the fallback is defensive
  // only and keeps the segment whole rather than dropping text.
  if (!halves) return [s];
  return [...preSplitText(halves[0], maxChars), ...preSplitText(halves[1], maxChars)];
}

// synthesizeSegment({ synthesize, payload, budget, depth? })
//
// `synthesize` is a function(payload) -> { audio, format, durationSec }
// (the executor wraps the provider adapter in exactly this shape and
// owns attempt reservation/confirmation around every call).
// `payload` is the occurrence's full synthesis payload; every part
// call passes a payload identical to it except for `text` — voice,
// model, provider and style pass through UNCHANGED (voice law).
// `budget` is a mutable { remaining } counter shared with the
// executor's attempt accounting: synthesizeSegment decrements it once
// per provider call it makes and treats exhaustion as terminal.
//
// Returns { parts: [{ audio, format, durationSec }], attemptsUsed }
// with leaf parts in reading order. Throws TerminalBlock on a block
// that cannot be split further; any non-block provider error is
// rethrown untouched for the executor to classify.
export async function synthesizeSegment({ synthesize, payload, budget, _depth = 0 }) {
  if (typeof synthesize !== "function") throw new Error("synthesizeSegment requires a synthesize function");
  if (!budget || typeof budget.remaining !== "number") throw new Error("synthesizeSegment requires budget {remaining}");
  const startRemaining = budget.remaining;

  async function attempt(text, depth) {
    if (budget.remaining <= 0) throw new TerminalBlock(depth, "attempt_budget_exhausted");
    budget.remaining -= 1;
    let res;
    try {
      res = await synthesize({ ...payload, text });
    } catch (err) {
      if (!(err && err.contentBlocked)) throw err;
      if (depth >= SPLIT_MAX_DEPTH)
        throw new TerminalBlock(depth, "max_depth");
      const parts = splitText(text, SPLIT_MIN_PART_CHARS);
      if (!parts) throw new TerminalBlock(depth, "unsplittable_floor");
      const left = await attempt(parts[0], depth + 1);
      const right = await attempt(parts[1], depth + 1);
      return [...left, ...right];
    }
    return [{ audio: res.audio, format: res.format || "wav", durationSec: res.durationSec }];
  }

  const parts = await attempt(String(payload.text ?? ""), _depth);
  return { parts, attemptsUsed: startRemaining - budget.remaining };
}

// synthesizeLongSegment({ synthesize, payload, budget })
//
// CH2 FIX PACKAGE (fix 3) — the pre-dispatch composition the
// executor uses for segments over PRE_SPLIT_MAX_CHARS. The
// segment is cut with preSplitText (exact-concat, machinery
// above) and each chunk is synthesized through the UNMODIFIED
// synthesizeSegment, sequentially, sharing the caller's budget
// object — so the pinned per-segment attempt ceiling binds
// across the whole segment exactly as it binds inside one
// synthesizeSegment call, and each chunk's policy-depth budget
// is its own (pre-splitting is a length accommodation, not
// policy recursion). Leaf parts concatenate in reading order
// and attemptsUsed is the sum across chunks. A text at or
// under the ceiling takes the identical single synthesizeSegment
// call it always took — this wrapper exists so the pinned
// whole-segment semantics of synthesizeSegment (exact tree call
// counts, depth measured from the segment root — see
// tests/d6-policy-split.test.mjs) are never perturbed: the
// pre-split lives ABOVE that contract, at the executor's
// pre-dispatch seam, not inside it.
export async function synthesizeLongSegment({ synthesize, payload, budget }) {
  const text = String(payload.text ?? "");
  const chunks = preSplitText(text, PRE_SPLIT_MAX_CHARS);
  if (chunks.length <= 1)
    return synthesizeSegment({ synthesize, payload, budget });
  const parts = [];
  let attemptsUsed = 0;
  for (const chunk of chunks) {
    const r = await synthesizeSegment({
      synthesize, payload: { ...payload, text: chunk }, budget,
    });
    parts.push(...r.parts);
    attemptsUsed += r.attemptsUsed;
  }
  return { parts, attemptsUsed };
}
