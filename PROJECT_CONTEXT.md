# OpalReader Project Context

Last updated: 2026-09-23

## Source of truth
- Repository: jedavid33-design/opal-reader
- Main branch is the source of truth.
- Current frontend generation: app-135.js / styles-135.css / sw-135.js.
- cloudflare-worker.js is the Worker source of truth.
- Keep deliverables flat when making ZIPs: all files at ZIP root, no enclosing folder.

## Product
OpalReader is Julie's EPUB-to-audiobook reader/generator. It imports EPUBs, identifies POV/narrator roles, casts voices, generates chapter audio through configured TTS providers, caches audio, and provides playback/progress controls.

## Current TTS providers / model work
- Speechify is actively used.
- Speechify model selector includes Simba 3.2 and Simba 3.0 for testing.
- Denise is a preferred narrator under investigation.
- Shaun at Speechify support confirmed Denise on Simba 3.2 can have a voice-identity defect because it is zero-shot on 3.2.
- Speechify recommended Simba 3.0 with Denise as the interim choice.
- Simba 3.0 has shown separate rendering glitches: repeated phrases that sound like a skipping CD and intermittent omitted text.
- Do not assume these are Denise-specific until other voices/books provide controls.

## Preserved Denise diagnostics
- Simba 3.2 Chapter 32 Segment 1 had major identity/timbre drift around 1:24, 2:20, 2:30.
- Simba 3.0 regeneration of the same segment fixed the dramatic identity shifts but had four repetition/skipping artifacts. Examples: about 0:40 "work as well work as well" and 1:22 "takes my face takes my face".
- The repeated phrases are present in the generated MP3, not merely app playback.
- Later Denise/Simba 3.0 chapters showed omitted passages.
- Two omissions were initially found at ends of segments, including Chapter 37 Segment 2.
- Chapter 39 then showed omissions near the beginning and middle of a segment, so this is not simply end-of-request truncation.
- An Emmett Simba 3.0 Chapter 36 was checked and was clean.
- Julie is preserving suspicious renders and highlighting omitted passages in the book for later debugging rather than regenerating them.
- One preserved omission diagnostic request ID: 5708c5994642ecfcec75b35f.
- Earlier known audio/cache keys from testing:
  - Simba 3.2 bad control: 3f9b43bb633284ee16b6c1c398b7e95980bfcd8b613a3d4016996e9c9727b627
  - Simba 3.0 Chapter 32 Segment 1 comparison: 1be51241bff1166d78e42f2d323fde871492c4eeba03dec1e5a7334e73e72439

## Diagnostic workflow
When missing/repeated/bad audio is found:
1. Do not regenerate the affected segment until evidence is preserved.
2. Confirm source text exists in EPUB/reader.
3. Use Review POV -> Listen to segment to play the cached segment MP3 directly.
4. Capture model, provider request ID, and audio key.
5. Verify exact TTS request text before assigning fault to Speechify.
6. Single-segment regeneration is available after evidence is preserved.

## Current features added during Speechify investigation
- Review POV exposes Prepare MP3 for generated segments.
- Review POV exposes Regenerate segment, which regenerates only that segment with the current cast/model.
- Review POV exposes Listen to segment, which plays only the existing cached MP3 and stops at that segment's end. It does not regenerate or mutate audio.
- Provider request IDs and generated model information are retained when returned by generation jobs.
- These diagnostics are intended to distinguish provider rendering failures from OpalReader chapter assembly/playback issues.

## Voice audition
- Voice audition uses book text appropriate to the selected POV/role.
- As of 2026-09-23, audition text was shortened from the previous ~240-character sample to roughly 110 characters, targeting about 20 seconds of speech.
- This change affects voice audition only. Production TTS segmentation is unchanged.

## Audio / generation principles
- Generation and playback must preserve existing cached audio until a replacement succeeds.
- Avoid unnecessary regeneration because it costs provider credits and destroys useful bug specimens.
- Single-segment regeneration should remain available permanently.
- Keep provider/model/cache/request metadata useful for debugging.
- Chapter playback bugs and provider-generation bugs must be isolated rather than assumed.

## Current investigation status
- Denise issues are intentionally on the back burner.
- Continue normal reading and observe whether omissions, repetitions, or identity drift reproduce with other voices in new books.
- If other voices show the same omissions, investigate a broader Speechify/model/request issue.
- If other voices remain clean while Denise repeatedly fails, strengthen the Denise-specific case and return to Speechify support with preserved request IDs/files.

## Recent commits
- 6196bb3: Add single-segment audio preview for TTS diagnostics.
- 4973368: Shorten voice audition samples to about 20 seconds.
