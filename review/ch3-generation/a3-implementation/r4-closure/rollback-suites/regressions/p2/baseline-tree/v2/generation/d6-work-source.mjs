// D6 (WS-2) — discriminated content work source (CONTRACTS.md
// §d6-executor step 4).
//
// createD6WorkSource(coord, { cache }) returns
// workSource(jobId, occurrenceId) resolving to exactly one of:
//   { status: "ok", payload }                       — synthesizable
//   { status: "no_content" }                        — no job / no
//     content entity / no segment / no segment text
//   { status: "removed_provider", povName, provider, recordedMapping }
//     — the segment's cast voice belongs to a removed provider
//     (azure | fish | speechify | elevenlabs): generation stops at a
//     voice-mapping prompt, ZERO synthesis, never a silent swap
//   { status: "unmapped_pov" }                      — the segment
//     exists but its POV/voice cannot be resolved to a live provider
//     voice (no POV, no voice id, or a provider D6 does not carry)
//
// G2 (ENRICHMENT-DESIGN Part 2; Rowan review 6504846855): the cast
// is read from the LIVE entity shape first — `cast` (the migration
// transform's output key, what production entities carry) with
// `povs` (the source-record key) as fallback, mirroring the
// content-plane adapter's dual-read. Before this fix the source read
// `povs` only, so on an enriched live entity every pov lookup would
// have missed. Companion fix in the same function: when resolution
// falls to the book defaultVoice, styleDirection also reads the
// FALLBACK voice's recorded style_direction (previously only the
// cast voice object or the segment were consulted, so the
// title-segment case would have synthesized with an empty style).
// Deliberate NON-fix (design §2.2): no chapter-pov fallback —
// entities carry no chapter pov, and this source reads segment.pov
// only, as before.
//
// Resolution mirrors createContentWorkSource in
// worker/host/adapters.mjs exactly (content snapshot -> segment ->
// pov -> voice), with ONE deliberate difference: where the P1 source
// returns null for removed/unknown providers — silently dropping the
// occurrence from generation — this source NAMES the outcome, so the
// executor can record the prompt/skip with its reason (proposal §5
// proof 4: no silent skips).
import { fingerprintFor } from "../executor.mjs";

// Providers removed by feature law (CONTRACTS.md eligible-set rule).
export const REMOVED_PROVIDERS = new Set(["azure", "fish", "speechify", "elevenlabs"]);
const LIVE_PROVIDERS = new Set(["gemini", "openai"]);

// Recorded voice mappings (recorded only — CONTRACTS.md pins; the
// prompt names the character and this mapping where one exists).
export const RECORDED_VOICE_MAPPINGS = Object.freeze({
  Emmett: "Gemini Charon",
  Reese: "Gemini Kore",
  Tucker: "Gemini Puck",
  Sabrina: "Gemini Aoede",
});

export function createD6WorkSource(coord, { cache = null } = {}) {
  function findSegment(data, occurrenceId) {
    for (const ch of data?.chapters || [])
      for (const seg of ch?.segments || [])
        if (seg?.occurrenceId === occurrenceId) return seg;
    return null;
  }
  function resolvePov(data, segment) {
    // Live shape first: entities carry the cast under `cast`;
    // `povs` is the source-record key, kept as the fallback read.
    const cast = data?.cast || data?.povs || [];
    const key = segment?.pov;
    return cast.find((p) => p?.id === key || p?.name === key) || null;
  }
  return async function d6WorkSource(jobId, occurrenceId) {
    const view = coord.jobView(jobId);
    if (!view || !view.bookId) return { status: "no_content" };
    const snapshot = coord.syncSnapshot({ family: "content" });
    if (snapshot?.error) return { status: "no_content" };
    const entity = (snapshot.entities || []).find((e) => e.entityKey === view.bookId && !e.tombstone);
    const data = entity?.data;
    if (!data) return { status: "no_content" };
    const segment = findSegment(data, occurrenceId);
    if (!segment?.text) return { status: "no_content" };
    const pov = resolvePov(data, segment);
    // A segment that NAMES a speaker the cast cannot resolve is
    // unmapped_pov — the defaultVoice fallback applies only when
    // NO speaker is named (the title-segment case). Substituting
    // the book default for a named-but-unknown speaker would be a
    // silent voice swap; design §2.3 names this disposition, and
    // the adapter's Correction-2 chain holds the same line.
    if (segment?.pov != null && !pov)
      return { status: "unmapped_pov",
               povName: typeof segment.pov === "string" ? segment.pov : null };
    const povName = pov?.name ?? (typeof segment.pov === "string" ? segment.pov : null);
    const voiceObj = pov?.voice || null;
    const fallback = data.defaultVoice || null;
    const voice = voiceObj?.voice_id || voiceObj?.voiceId ||
      fallback?.voice_id || fallback?.voiceId || null;
    const provider = voiceObj?.provider || fallback?.provider || "gemini";
    if (REMOVED_PROVIDERS.has(provider)) {
      return {
        status: "removed_provider",
        povName,
        provider,
        recordedMapping: povName ? (RECORDED_VOICE_MAPPINGS[povName] ?? null) : null,
      };
    }
    if (!pov && !fallback) return { status: "unmapped_pov", povName };
    if (!voice) return { status: "unmapped_pov", povName };
    if (!LIVE_PROVIDERS.has(provider)) return { status: "unmapped_pov", povName };
    const payload = {
      text: String(segment.text),
      voice,
      provider,
      model: voiceObj?.model_id || voiceObj?.model ||
        (provider === "openai" ? "gpt-4o-mini-tts" : "gemini-3.8-flash-tts"),
      styleDirection: voiceObj?.style_direction ?? voiceObj?.styleDirection ??
        fallback?.style_direction ?? fallback?.styleDirection ??
        segment.styleDirection ?? "",
      mode: view.lane === "batch" ? "batch" : "standard",
    };
    if (cache && typeof cache.prime === "function") await cache.prime(payload);
    return { status: "ok", payload, povName, fingerprint: fingerprintFor(payload) };
  };
}
