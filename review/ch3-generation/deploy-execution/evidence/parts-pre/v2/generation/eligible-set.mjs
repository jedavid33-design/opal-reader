// D6 WS-3 — the generation-eligible set builder (CONTRACTS.md,
// "generation/eligible-set.mjs (WS-3) — pure functions").
//
// Pure: no I/O, no coordinator access, no mutation of the input plane.
// Structural data only — occurrence IDs, POV keys, character counts and
// block-history flags. Book text never enters this module.
//
// Plane shape (content-plane view, structural only):
//   plane = { books: [{ bookId, chapters: [{ chapterId, chapterIndex,
//     segments: [{ occurrenceId, povKey, charCount, blockHistory,
//                  revisionKey? }] }],
//     povs: [{ key, name, provider, voiceId }] }],
//     boundOccurrenceIds: Set<string>,
//     parkedJob: { jobId, bookId, chapterIndex,
//       entries: Map<occurrenceId, "parked-pending"|"parked-ready"> } | null }
//
// Disposition precedence (first match wins), per CONTRACTS rules order:
//   1. bound_already   — occurrence is in plane.boundOccurrenceIds.
//   2. excluded_parked — occurrence is an entry of the parked job
//                        (parked job's book only).
//   3. excluded_ch3    — same (bookId, chapterIndex) as the parked job
//                        but not itself a parked entry: the whole parked
//                        chapter is out of bounds (§5 corollary: the
//                        generation path never enumerates a Ch 3
//                        occurrence of Forever Pucked).
//   4. voice_prompt    — the occurrence's POV resolves to a cast voice
//                        whose provider is a removed provider
//                        (azure | fish | speechify | elevenlabs):
//                        generation stops at a voice-mapping prompt,
//                        never a silent substitution (§6.4).
//   5. eligible        — everything else. An occurrence whose POV does
//                        not resolve at all (povKey null or unknown) is
//                        dispositioned eligible here; the POV-resolution
//                        proof (proofs.mjs) is what names it — the
//                        builder never silently drops it.
import { createHash } from "node:crypto";

export const REMOVED_PROVIDERS = Object.freeze(
  new Set(["azure", "fish", "speechify", "elevenlabs"]));

export const DISPOSITIONS = Object.freeze([
  "eligible", "voice_prompt", "excluded_ch3", "excluded_parked",
  "bound_already",
]);

function povByKey(book, povKey) {
  if (povKey == null) return null;
  return (book.povs || []).find(p => p.key === povKey) || null;
}

// buildEligibleSet(plane, bookId) ->
//   { bookId, entries: [{ occurrenceId, bookId, chapterId, chapterIndex,
//       position, povKey, charCount, blockHistory, revisionKey,
//       disposition, reason }], digest }
// Entries are in reading order (chapter order as given in the plane,
// segment order within each chapter); `position` is the 0-based
// reading-order index across the whole book, so EVERY occurrence of the
// book appears exactly once (no silent skips — proofs.mjs asserts it).
// Digest = sha256 of the canonical entry list (ids + dispositions):
// JSON of [[occurrenceId, disposition], ...] in reading order.
export function buildEligibleSet(plane, bookId) {
  const book = (plane.books || []).find(b => b.bookId === bookId);
  if (!book) throw new Error(`buildEligibleSet: unknown bookId ${bookId}`);
  const bound = plane.boundOccurrenceIds || new Set();
  const parked = plane.parkedJob || null;
  const parkedApplies = !!parked && parked.bookId === bookId;

  const entries = [];
  let position = 0;
  for (const ch of book.chapters || []) {
    for (const seg of ch.segments || []) {
      let disposition, reason;
      if (bound.has(seg.occurrenceId)) {
        disposition = "bound_already";
        reason = "occurrence already has a binding (audio present)";
      } else if (parkedApplies && parked.entries.has(seg.occurrenceId)) {
        disposition = "excluded_parked";
        reason = `occurrence is an entry of parked job ${parked.jobId} ` +
          `(${parked.entries.get(seg.occurrenceId)}); the parked job ` +
          "resumes only on Julie's explicit word";
      } else if (parkedApplies && ch.chapterIndex === parked.chapterIndex) {
        disposition = "excluded_ch3";
        reason = `same chapter as parked job ${parked.jobId} ` +
          `(chapterIndex ${parked.chapterIndex}) but not a parked entry; ` +
          "the parked chapter is excluded from the eligible set entirely";
      } else {
        const pov = povByKey(book, seg.povKey);
        if (pov && REMOVED_PROVIDERS.has(String(pov.provider || "").toLowerCase())) {
          disposition = "voice_prompt";
          reason = `POV "${pov.name}" resolves to removed-provider voice ` +
            `(${pov.provider}/${pov.voiceId}); voice-mapping prompt ` +
            "required, never a silent substitution";
        } else {
          disposition = "eligible";
          reason = seg.blockHistory
            ? "unbound, no binding, POV live; carries a POLICY_BLOCK " +
              "failure record — eligible via the splitting path"
            : "unbound, no binding, POV live";
        }
      }
      entries.push({
        occurrenceId: seg.occurrenceId,
        bookId,
        chapterId: ch.chapterId,
        chapterIndex: ch.chapterIndex,
        position: position++,
        povKey: seg.povKey ?? null,
        charCount: seg.charCount,
        blockHistory: !!seg.blockHistory,
        revisionKey: seg.revisionKey ?? null,
        disposition,
        reason,
      });
    }
  }
  const canonical = JSON.stringify(
    entries.map(e => [e.occurrenceId, e.disposition]));
  const digest = createHash("sha256").update(canonical).digest("hex");
  return { bookId, entries, digest };
}

// Convenience: disposition tallies for one built set.
export function dispositionCounts(built) {
  const counts = {};
  for (const d of DISPOSITIONS) counts[d] = 0;
  for (const e of built.entries) counts[e.disposition] += 1;
  return counts;
}
