// P7 migration transformer (rehearsal form): v1 snapshot records -> the
// v2 corpus representation of preimplementation-package §5.3 / §1.4.
//
// Families produced per book:
//   Content   — chapters/segments normalized to occurrence ids, lineage
//               unified (parentSegId from blockRootId), cast carried as
//               data. Segment text is carried as digest + char counts:
//               identity verification never needs the words themselves,
//               and book text stays out of every derived artifact.
//   Bindings  — one record per bound segment: (occurrence, revision) ->
//               cache key, with §1.3 legacy anchoring (revision =
//               "legacy:" + audioKey when no fingerprint was ever stored;
//               the fingerprint is NEVER recomputed — that would be
//               fabrication) and §2.3 A2 provenance labels. Device-voice
//               segments (A4) migrate as device-voice bindings with no
//               cache key, exactly as Julie chose them in v1.
//   Outcomes  — blocked/failed stamps carried as binding-family outcomes
//               (POLICY_BLOCK set equality is a §5.4 check).
// Plus: job aggregates for non-terminal statuses (§2.2 dispositions),
// the orphan-audio inventory (A6: preserved, never assigned), and the
// usage-ledger adoption note (§5.3).
//
// Pure functions over plain JSON. No I/O, no production access.
import { canonical, digest, sha256hex } from "./util.mjs";

// The §2.2 census classification: exactly one live job at census time.
export const CENSUS_LIVE_JOB = "1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a";
export const TERMINAL_STATES = new Set(["ready", "partial", "failed"]);

export function audioObjectIndex(listings) {
  // bare audioKey -> {key, size, ext} from the complete audio/ listing.
  const idx = new Map();
  for (const o of listings["audio/"] || []) {
    const name = o.key.slice("audio/".length);
    const dot = name.lastIndexOf(".");
    const bare = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot + 1) : null;
    if (!idx.has(bare)) idx.set(bare, { key: o.key, size: o.size, ext });
  }
  return idx;
}

function castModelMap(book) {
  // pov -> set of stamped models, for A2 cast inference.
  const map = new Map();
  for (const ch of book.chapters || []) {
    for (const s of ch.segments || []) {
      if (s.generatedModel) {
        if (!map.has(s.pov)) map.set(s.pov, new Set());
        map.get(s.pov).add(s.generatedModel);
      }
    }
  }
  return map;
}

export function transformBook(book, audioIdx) {
  const models = castModelMap(book);
  const content = {
    bookId: book.id,
    title: book.title,
    author: book.author ?? null,
    cast: JSON.parse(JSON.stringify(book.povs || [])),
    chapters: [],
  };
  const bindings = [];
  const outcomes = [];
  const unbound = [];
  const counts = { chapters: 0, segments: 0, boundR2: 0, deviceVoice: 0, unbound: 0, blocked: 0 };

  (book.chapters || []).forEach((ch, ci) => {
    const outCh = { chapterId: ch.id ?? null, index: ci, segments: [] };
    counts.chapters += 1;
    (ch.segments || []).forEach((s, si) => {
      counts.segments += 1;
      const root = s.blockRootId || null;
      outCh.segments.push({
        occurrenceId: s.id ?? null,
        pov: s.pov ?? null,
        textSha256: sha256hex(s.speechText ?? s.text ?? ""),
        textChars: (s.text || "").length,
        speechChars: (s.speechText || "").length,
        parentSegId: root && root !== s.id ? root : null,
        blockRootId: root,
      });
      if (s.generationBlocked) {
        counts.blocked += 1;
        outcomes.push({
          occurrenceId: s.id, chapterIndex: ci, segmentIndex: si,
          outcome: "blocked_policy",
          reason: s.generationBlocked.blockReason || "POLICY_BLOCK",
          model: s.generationBlocked.model || null,
          jobId: s.generationBlocked.jobId || null,
        });
      }
      if (s.systemVoiceFallback) {
        counts.deviceVoice += 1;
        bindings.push({
          occurrenceId: s.id, chapterIndex: ci, segmentIndex: si,
          kind: "device-voice", revision: "device-voice", cacheKey: null,
          provenance: { model: null, providerRequestId: null, label: "manual-device-voice" },
          staleFlag: !!s.audioStale,
        });
      } else if (s.audioKey) {
        counts.boundR2 += 1;
        let provenance;
        if (s.generationFingerprint) {
          provenance = { model: s.generatedModel || null, providerRequestId: s.providerRequestId || null, label: "recorded" };
        } else if (s.generatedModel) {
          provenance = { model: s.generatedModel, providerRequestId: s.providerRequestId || null, label: "recorded-partial" };
        } else {
          const inferred = models.get(s.pov);
          provenance = inferred && inferred.size === 1
            ? { model: [...inferred][0], providerRequestId: null, label: "cast-inferred" }
            : { model: null, providerRequestId: null, label: "legacy-unknown" };
        }
        bindings.push({
          occurrenceId: s.id, chapterIndex: ci, segmentIndex: si,
          kind: "r2",
          revision: s.generationFingerprint || `legacy:${s.audioKey}`,
          cacheKey: s.audioKey,
          provenance,
          staleFlag: !!s.audioStale,
        });
      } else {
        counts.unbound += 1;
        unbound.push({
          occurrenceId: s.id, chapterIndex: ci, segmentIndex: si,
          classification: s.generationBlocked ? "blocked" : "never-generated",
        });
      }
    });
    content.chapters.push(outCh);
  });

  return { bookId: book.id, title: book.title, content, bindings, outcomes, unbound, counts };
}

export function transformJobs(statuses, completeBookIds) {
  const inventory = { total: statuses.length, terminal: {}, nonTerminal: 0 };
  const aggregates = [];
  for (const st of statuses) {
    const state = st.state || st.status;
    if (TERMINAL_STATES.has(state)) {
      inventory.terminal[state] = (inventory.terminal[state] || 0) + 1;
      continue;
    }
    inventory.nonTerminal += 1;
    const definitionDigest = digest({
      job_id: st.job_id, book_id: st.book_id, chapter_index: st.chapter_index,
      total: st.total, completed: st.completed,
      segments: (st.segments || []).map((s) => ({
        id: s.id ?? null, segment_index: s.segment_index ?? null,
        repair_path: s.repair_path ?? null, repair_parent: s.repair_parent ?? null,
        text_sha: sha256hex(s.text ?? s.speechText ?? ""),
      })),
    });
    let disposition, v2State, cause;
    if (st.job_id === CENSUS_LIVE_JOB) {
      disposition = "carry-live"; v2State = "parked_policy";
      cause = "§2.2 live job: carries as a coordinator aggregate in PARKED_POLICY with its definition intact; never auto-resubmitted";
    } else if (completeBookIds.has(st.book_id)) {
      disposition = "superseded"; v2State = "superseded";
      cause = "inert remnant on a complete book; closed as SUPERSEDED with cause recorded (I12)";
    } else {
      disposition = "carry-held-manual-review"; v2State = "parked_policy";
      cause = "non-terminal job not classified by the §2.2 census (post-census drift): carried held, never auto-resubmitted, flagged for manual classification";
    }
    aggregates.push({
      jobId: st.job_id, bookId: st.book_id, chapterIndex: st.chapter_index,
      v1State: state, segmentCount: (st.segments || []).length,
      total: st.total ?? null, completed: st.completed ?? null,
      batchJobName: st.batch_job_name ?? null,
      definitionDigest, disposition, v2State, cause,
    });
  }
  aggregates.sort((a, b) => String(a.jobId).localeCompare(String(b.jobId)));
  return { aggregates, inventory };
}

export function computeOrphans(audioIdx, allBindings) {
  const referenced = new Set(allBindings.filter((b) => b.cacheKey).map((b) => b.cacheKey));
  const orphans = [];
  for (const [bare, obj] of audioIdx) {
    if (!referenced.has(bare)) orphans.push({ audioKey: bare, key: obj.key, size: obj.size, ext: obj.ext });
  }
  orphans.sort((a, b) => a.audioKey.localeCompare(b.audioKey));
  return orphans;
}

export function computeChapterTruth(corpusBook, aggregates) {
  const boundByOcc = new Map(corpusBook.bindings.map((b) => [b.occurrenceId, b]));
  const blockedOcc = new Set(corpusBook.outcomes.map((o) => o.occurrenceId));
  const covering = new Set(
    (aggregates || []).filter((a) => a.bookId === corpusBook.bookId && a.v2State === "parked_policy")
      .map((a) => a.chapterIndex));
  return corpusBook.content.chapters.map((ch) => {
    let playable = 0, blocked = 0;
    for (const s of ch.segments) {
      if (boundByOcc.has(s.occurrenceId)) playable += 1;
      else if (blockedOcc.has(s.occurrenceId)) blocked += 1;
    }
    const total = ch.segments.length;
    const generating = covering.has(ch.index);
    let state;
    if (playable === total) state = "Complete";
    else if (generating) state = "Generating";
    else if (playable > 0) state = "Partial";
    else if (blocked > 0) state = "Blocked";
    else state = "Failed";
    return { chapterIndex: ch.index, total, playable, blocked, generating, state };
  });
}

export { canonical, digest };
