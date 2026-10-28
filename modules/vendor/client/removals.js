// Opal Reader v2 — assembled client, Stage 4: the removals, as facts.
//
// Julie's approved v2-only removals (feature law): Prosody Lab, Azure, and
// Fish. In the assembled client they are absent BY CONSTRUCTION, and this
// module states the enforceable facts:
//
// - GENERATION: azure/fish are not carried over. The store rejects their
//   generation intents locally, before persistence (provider_not_carried_
//   over). There is no lab surface of any kind in this composition — Find
//   Text in Segments (F10) was separated from the lab in the P5 layer and
//   is verified working here with the lab simply not present.
// - PLAYBACK: existing audio is preserved for EVERY former provider. The
//   store's playback resolution is provider-agnostic — a binding resolves
//   by its cache key, never by who synthesized it.
// - CAST VOICES: a book whose POV voices name a removed provider keeps its
//   audio and gets a MAPPING PROMPT (voiceStatus below) — never a silent
//   substitution. This module reports; it does not rewrite. The payload it
//   inspects is returned untouched.

export const REMOVED_GENERATION_PROVIDERS = ["azure", "fish"];
export const LEGACY_PLAYABLE_PROVIDERS = ["azure", "fish", "elevenlabs", "speechify", "gemini", "openai"];

// Which of a book's voices will need a mapping decision before that book
// generates NEW audio in v2. Reads the real book shape (povs[].voice.
// provider, defaultVoice.provider); pure — mutates nothing.
export function voiceStatus(payload) {
  const flagged = [];
  const povs = Array.isArray(payload?.povs) ? payload.povs : [];
  for (const p of povs) {
    const provider = p?.voice?.provider;
    if (provider && REMOVED_GENERATION_PROVIDERS.includes(provider)) {
      flagged.push({ scope: "pov", povId: p.id ?? null, name: p.name ?? null, provider });
    }
  }
  const dv = payload?.defaultVoice?.provider;
  if (dv && REMOVED_GENERATION_PROVIDERS.includes(dv)) {
    flagged.push({ scope: "default", povId: null, name: "(default voice)", provider: dv });
  }
  return { mappingNeeded: flagged, clear: flagged.length === 0 };
}
