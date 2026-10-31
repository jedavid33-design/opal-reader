// D6 — production content-plane adapter (integration deliverable).
//
// WS-1's generation service consumes `sources.eligiblePlane(bookId)`
// returning the structural plane WS-3's buildEligibleSet/proofs are
// specified against (CONTRACTS.md). This module is that source for the
// real coordinator: it derives the plane from the coordinator's OWN
// state — the content sync family (the named text source of proposal
// §5; the same snapshot the executor's work source reads), the
// bindings table (the bound set), and the parked job's rows.
//
// Structural data only: occurrence IDs, POV keys, character COUNTS
// (computed in memory from the content entity; the text itself is
// never copied, logged, or persisted by this module), block-history
// flags, and revision keys. Fail-closed: an unknown book throws a
// named error rather than planning over an unverified set.
import { createHash } from "node:crypto";

function povKeyOf(p) { return p?.id ?? p?.name ?? null; }
function povProviderOf(p) { return p?.voice?.provider ?? p?.provider ?? null; }
function povVoiceIdOf(p) { return p?.voice?.voice_id ?? p?.voice?.voiceId ?? p?.voiceId ?? null; }

// The book's cast in plane shape: [{ key, name, provider, voiceId }].
// The content entity carries the cast under `povs` (work-source shape)
// or `cast` (migration-transform shape); both are read.
function castOf(data) {
  const raw = data?.povs || data?.cast || [];
  return raw.map(p => ({
    key: povKeyOf(p),
    name: p?.name ?? povKeyOf(p),
    provider: povProviderOf(p),
    voiceId: povVoiceIdOf(p),
  })).filter(p => p.key != null);
}

// CORRECTION 2 (arming sub-step 0, live-data finding A): live content
// segments carry `pov` as the cast NAME ("Violet", "Miller", …) while
// cast entries are keyed by UUID id. A pov VALUE therefore resolves
// against the cast, never through verbatim: an exact id match wins;
// else an exact name match against EXACTLY ONE cast entry maps to
// that entry's id; a name matching multiple entries (ambiguous) or
// none returns null — never a guess. A segment/chapter that NAMES a
// speaker who cannot be resolved is unresolved, full stop: it is
// never silently reassigned to the chapter/default voice (that would
// be a substitution, and the POV proof exists to name exactly these).
function resolvePovValue(value, cast) {
  if (value == null) return null;
  const byId = cast.find(p => p.key === value);
  if (byId) return byId.key;
  const byName = cast.filter(p => p.name === value);
  if (byName.length === 1) return byName[0].key;
  return null;
}

// Resolve a segment's POV key: segment pov, else chapter pov (each
// resolved via resolvePovValue — id, else unique name), else — only
// when NEITHER names a speaker — the book default voice matched back
// to a cast entry by (provider, voice_id): the same fallback chain
// WS-3's census fixture documents. Returns null when nothing
// resolves (the POV proof names those; the builder never silently
// drops them).
function resolvePovKey(seg, ch, cast, data) {
  const direct = seg?.pov ?? ch?.pov ?? null;
  if (direct != null) return resolvePovValue(direct, cast);
  const dv = data?.defaultVoice || null;
  if (dv) {
    const match = cast.find(p =>
      String(p.provider || "").toLowerCase() === String(dv.provider || "").toLowerCase() &&
      p.voiceId != null && dv.voice_id != null && p.voiceId === dv.voice_id);
    if (match) return match.key;
  }
  return null;
}

// CORRECTION 2 (arming sub-step 0, live-data finding B): every live
// segment of The Goal carries speechChars: 0 with its real count in
// textChars — a numeric speechChars of 0 is an absent count, not a
// measured one. speechChars counts only when positive; then
// textChars when numeric; then the text length itself.
function charCountOf(seg) {
  if (typeof seg?.speechChars === "number" && seg.speechChars > 0)
    return seg.speechChars;
  if (typeof seg?.textChars === "number") return seg.textChars;
  const t = seg?.speechText ?? seg?.text ?? "";
  return String(t).length;
}

function blockHistoryOf(seg, ch) {
  if (seg?.blockRootId) return true;
  if (seg?.generationBlocked) return true;
  const hist = ch?.geminiBlockHistory || null;
  return !!(hist && seg?.occurrenceId && hist[seg.occurrenceId]);
}

function revisionKeyOf(seg, bound) {
  if (seg?.revisionKey) return seg.revisionKey;
  if (bound) {
    if (seg?.generationFingerprint) return seg.generationFingerprint;
    if (seg?.audioKey) return `legacy:${seg.audioKey}`;
    return null;
  }
  // Unbound occurrences have no transform revision; the migration /
  // harness convention is "fp-<occurrenceId>" (WS-3 fixture documents
  // the derivation).
  return seg?.occurrenceId ? `fp-${seg.occurrenceId}` : null;
}

// The parked job (exactly one exists in the production state plane:
// Forever Pucked Ch 3, state parked_policy). Read from the jobs /
// occurrences tables; occurrence dispositions map ready -> parked-
// ready, everything else -> parked-pending.
function parkedJobOf(coord) {
  const job = coord._oneOrNull(
    `SELECT * FROM jobs WHERE state = 'parked_policy' ORDER BY created_at LIMIT 1`);
  if (!job) return null;
  const rows = coord._all(
    `SELECT occurrence_id, state FROM occurrences WHERE job_id = ?`, job.job_id);
  const entries = new Map(rows.map(r => [
    r.occurrence_id, r.state === "ready" ? "parked-ready" : "parked-pending",
  ]));
  return {
    jobId: job.job_id, bookId: job.book_id,
    chapterIndex: job.chapter_index, entries,
  };
}

// planeFromCoordinator(coord, bookId) -> plane (CONTRACTS.md shape).
// Throws Error("d6_content_plane_book_missing") when the content plane
// holds no live entity for the book.
export function planeFromCoordinator(coord, bookId) {
  const snapshot = coord.syncSnapshot({ family: "content" });
  if (!snapshot || snapshot.error)
    throw new Error("d6_content_plane_unavailable");
  const entity = (snapshot.entities || [])
    .find(e => e.entityKey === bookId && !e.tombstone);
  if (!entity || !entity.data)
    throw new Error("d6_content_plane_book_missing");
  const data = entity.data;
  const cast = castOf(data);
  const boundRows = coord._all(`SELECT occurrence_id FROM bindings`);
  const boundOccurrenceIds = new Set(boundRows.map(r => r.occurrence_id));
  const chapters = (data.chapters || []).map((ch, ci) => ({
    chapterId: ch?.chapterId ?? ch?.id ?? null,
    chapterIndex: typeof ch?.index === "number" ? ch.index : ci,
    segments: (ch?.segments || []).map(seg => {
      const occurrenceId = seg?.occurrenceId ?? seg?.id ?? null;
      const bound = boundOccurrenceIds.has(occurrenceId);
      return {
        occurrenceId,
        povKey: resolvePovKey(seg, ch, cast, data),
        charCount: charCountOf(seg),
        blockHistory: blockHistoryOf(seg, ch),
        // CORRECTION 2: the split-lineage root id rides the plane so
        // proof 5 can name the POLICY_BLOCK anchor as the lineage
        // ROOT (proofs.mjs), not merely flag that history exists.
        blockRootId: seg?.blockRootId ?? null,
        revisionKey: revisionKeyOf(seg, bound),
      };
    }),
  }));
  return {
    books: [{ bookId, chapters, povs: cast }],
    boundOccurrenceIds,
    parkedJob: parkedJobOf(coord),
  };
}

// The service-facing source: { eligiblePlane(bookId) }.
export function createCoordinatorPlaneSource(coord) {
  return {
    eligiblePlane: (bookId) => planeFromCoordinator(coord, bookId),
  };
}

export function _sha256Hex(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}
