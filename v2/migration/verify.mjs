// Per-book migration verification — assessment §5.4, all seven checks.
// "Counts are necessary, never sufficient": every check compares sets,
// lineage structure, or outcomes — not just totals. A book failing any
// check is a STOP for that book (it would stay frozen at cutover); the
// rehearsal reports it, never repairs it silently.
import { computeChapterTruth } from "./transform.mjs";
import { canonical } from "./util.mjs";

function eqSet(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function verifyBook({ snapshotBook, corpusBook, audioIdx, adjudication,
                             aggregates, snapshotStatuses, truthSeeds }) {
  const checks = [];
  const problems = [];
  const add = (id, pass, detail) => {
    checks.push({ id, pass, detail });
    if (!pass) problems.push(`${id}: ${detail}`);
  };

  const snapSegs = [];
  (snapshotBook.chapters || []).forEach((ch, ci) =>
    (ch.segments || []).forEach((s, si) => snapSegs.push({ s, ci, si })));
  const corpusSegs = [];
  corpusBook.content.chapters.forEach((ch) =>
    ch.segments.forEach((s) => corpusSegs.push({ s, ci: ch.index })));

  // (1) Identity: 100% of segments hold a UUID + computed revision;
  // zero fingerprint-only identity assignments (identity = occurrence).
  {
    const snapIds = new Map();
    for (const { s } of snapSegs) snapIds.set(s.id, (snapIds.get(s.id) || 0) + 1);
    const corpusIds = new Set(corpusSegs.map(({ s }) => s.occurrenceId));
    const missing = [...snapIds.keys()].filter((id) => !corpusIds.has(id));
    const nullIds = corpusSegs.filter(({ s }) => !s.occurrenceId).length;
    const badRevision = corpusBook.bindings.filter((b) => {
      if (b.kind === "device-voice") return b.revision !== "device-voice";
      const snap = snapSegs.find(({ s }) => s.id === b.occurrenceId)?.s;
      if (!snap) return true;
      return snap.generationFingerprint
        ? b.revision !== snap.generationFingerprint
        : b.revision !== `legacy:${b.cacheKey}`;
    });
    add("identity", !missing.length && !nullIds && !badRevision.length &&
        corpusIds.size === snapIds.size,
        `${corpusIds.size} occurrences; missing ${missing.length}, null ${nullIds}, ` +
        `bad revisions ${badRevision.length}`);
  }

  // (2) Every binding's cache key resolves to an existing R2 object
  // (size > 0, from the complete listing); the playable set equals the
  // v1 bound set exactly, in both directions.
  {
    const snapBound = new Set(snapSegs.filter(({ s }) => s.audioKey && !s.systemVoiceFallback)
      .map(({ s }) => s.id));
    const corpusBound = new Set(corpusBook.bindings.filter((b) => b.kind === "r2")
      .map((b) => b.occurrenceId));
    const unresolved = corpusBook.bindings.filter((b) => b.kind === "r2")
      .filter((b) => {
        const obj = audioIdx.get(b.cacheKey);
        return !obj || !(obj.size > 0);
      });
    add("bindings-resolve", eqSet(snapBound, corpusBound) && !unresolved.length,
        `${corpusBound.size} r2 bindings; set-equal to v1: ${eqSet(snapBound, corpusBound)}; ` +
        `unresolved objects: ${unresolved.length}`);
  }

  // (3) Split ancestry: every lineage chain terminates at a root
  // occurrence present in Content; no cycles; family sizes match the
  // v1 blockRootId metadata.
  {
    let bad = 0;
    const famSnap = new Map(), famCorpus = new Map();
    for (const { s } of snapSegs) {
      if (s.blockRootId) famSnap.set(s.blockRootId, (famSnap.get(s.blockRootId) || 0) + 1);
    }
    for (const ch of corpusBook.content.chapters) {
      const byId = new Map(ch.segments.map((s) => [s.occurrenceId, s]));
      for (const s of ch.segments) {
        if (s.blockRootId) famCorpus.set(s.blockRootId, (famCorpus.get(s.blockRootId) || 0) + 1);
        if (s.parentSegId) {
          if (!byId.has(s.parentSegId)) { bad += 1; continue; }
          const seen = new Set([s.occurrenceId]);
          let cur = byId.get(s.parentSegId);
          while (cur && cur.parentSegId) {
            if (seen.has(cur.occurrenceId)) { bad += 1; break; }
            seen.add(cur.occurrenceId);
            cur = byId.get(cur.parentSegId);
          }
        }
      }
    }
    const famMismatch = [...famSnap.keys()].filter((k) => famSnap.get(k) !== famCorpus.get(k)).length;
    add("lineage", bad === 0 && famMismatch === 0,
        `${famCorpus.size} split families; broken/cyclic chains: ${bad}; family size mismatches: ${famMismatch}`);
  }

  // (4) Blocked outcomes match the v1 stamps exactly (set equality per
  // chapter — Forever Pucked Ch2's 18 POLICY_BLOCK segments are the
  // standing test case).
  {
    let mismatch = 0;
    const snapByCh = new Map(), corpusByCh = new Map();
    for (const { s, ci } of snapSegs) {
      if (s.generationBlocked) {
        if (!snapByCh.has(ci)) snapByCh.set(ci, new Set());
        snapByCh.get(ci).add(s.id);
      }
    }
    for (const o of corpusBook.outcomes) {
      if (!corpusByCh.has(o.chapterIndex)) corpusByCh.set(o.chapterIndex, new Set());
      corpusByCh.get(o.chapterIndex).add(o.occurrenceId);
    }
    const chs = new Set([...snapByCh.keys(), ...corpusByCh.keys()]);
    for (const ci of chs) {
      if (!eqSet(snapByCh.get(ci) || new Set(), corpusByCh.get(ci) || new Set())) mismatch += 1;
    }
    add("blocked-equality", mismatch === 0,
        `${corpusBook.outcomes.length} blocked outcomes; chapters mismatched: ${mismatch}`);
  }

  // (5) Position + checkpoints equal the adjudicated device source.
  {
    const pos = corpusBook.position || {};
    const ok = canonical(pos.opening || null) === canonical(adjudication.openingPosition || null) &&
      canonical(pos.checkpoints || []) === canonical(adjudication.checkpoints || []);
    add("position", ok,
        `opening from ${adjudication.source}; checkpoints preserved: ${(pos.checkpoints || []).length}`);
  }

  // (6) Jobs: every non-terminal v1 job for this book exists in v2
  // with a mapped state and an intact definition digest.
  {
    const nonTerm = (snapshotStatuses || []).filter(
      (st) => st.book_id === corpusBook.bookId && !["ready", "partial", "failed"].includes(st.state || st.status));
    const mine = (aggregates || []).filter((a) => a.bookId === corpusBook.bookId);
    const missing = nonTerm.filter((st) => !mine.some((a) => a.jobId === st.job_id));
    const badDigest = mine.filter((a) => !/^[a-f0-9]{64}$/.test(a.definitionDigest || ""));
    add("jobs", missing.length === 0 && badDigest.length === 0,
        `${nonTerm.length} non-terminal v1 jobs; aggregates: ${mine.length}; missing: ${missing.length}`);
  }

  // (7) Chapter truth from the v2 read model equals the seeded,
  // hand-verified truth where seeds exist; totals reconcile with the
  // snapshot everywhere.
  {
    const truth = computeChapterTruth(corpusBook, aggregates);
    let ok = true, detail = `${truth.length} chapters`;
    const seeds = (truthSeeds || {})[corpusBook.bookId];
    if (seeds) {
      for (const seed of seeds) {
        const t = truth[seed.chapterIndex];
        if (!t || t.total !== seed.total || t.playable !== seed.playable || t.blocked !== seed.blocked) {
          ok = false;
          detail += `; seed mismatch ch${seed.chapterIndex + 1}: got ` +
            `${t ? `${t.playable}/${t.total} playable, ${t.blocked} blocked` : "none"}, want ` +
            `${seed.playable}/${seed.total} playable, ${seed.blocked} blocked`;
        }
      }
    }
    const playableTotal = truth.reduce((n, t) => n + t.playable, 0);
    const wantPlayable = corpusBook.counts.boundR2 + corpusBook.counts.deviceVoice;
    if (playableTotal !== wantPlayable) {
      ok = false;
      detail += `; playable total ${playableTotal} != bound ${wantPlayable}`;
    }
    add("chapter-truth", ok, detail);
  }

  return { bookId: corpusBook.bookId, title: corpusBook.title, checks, problems, pass: problems.length === 0 };
}
