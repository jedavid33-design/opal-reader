import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildEligibleSet, dispositionCounts } from "/home/hatch/workspace/ch2-program/s1-build/candidate-tree/v2/generation/eligible-set.mjs";

const FP = "5c589095-f812-48a2-8ab2-03ba2791f2b2";
const REC = "/home/hatch/workspace/ch2-program/ch3-recovery/turnon2-execution/reconciliation";
const CEN2 = "/home/hatch/workspace/ch2-program/ch3-recovery/turnon2-execution/census";
const EXPECT_BEFORE = "7d76a0538d8156a050eab0c34ecdb584d92da0c39f6d97a2589fc16ad5e5247f";
const EXPECT_AFTER  = "831e456db0d82373d2f408fd9e37d6d9a3dd46e9f2419153be7d2d9755b60f94";
const out = {};
const env = (p) => { const d = JSON.parse(readFileSync(p, "utf8")); return d.body ?? d; };

// ---- bindings feed (fresh read-only pull, watermark 1861) ----
let changes = [];
for (let i = 1; i <= 10; i++) changes = changes.concat(env(`${REC}/page-${i}.json`).changes);
changes.sort((a, b) => a.seq - b.seq);
out.bindings = { totalChanges: changes.length, ops: [...new Set(changes.map(c => c.op))],
  seqMin: changes[0].seq, seqMax: changes[changes.length - 1].seq };
const boundAt = (wm) => { const s = new Set(); for (const c of changes) { if (c.seq > wm) break;
  if (c.bookId === FP && c.op === "upsert") s.add(c.entityKey.split(":").slice(1).join(":")); } return s; };
const boundBefore = boundAt(1842), boundAfter = boundAt(1861);
out.bindings.fpBoundBefore = boundBefore.size;
out.bindings.fpBoundAfter = boundAfter.size;
const delta = [...boundAfter].filter(id => !boundBefore.has(id));
const deltaSeqs = changes.filter(c => c.bookId === FP && c.seq >= 1843 && c.seq <= 1861)
  .map(c => ({ seq: c.seq, occurrenceId: c.entityKey.split(":").slice(1).join(":") }));
out.bindings.deltaCount = delta.length;
out.bindings.deltaSeqRange = [Math.min(...deltaSeqs.map(d => d.seq)), Math.max(...deltaSeqs.map(d => d.seq))];
out.bindings.deltaMatchesSeqWindow = deltaSeqs.length === delta.length &&
  deltaSeqs.every(d => delta.includes(d.occurrenceId));

// ---- content plane (Nov 9 census capture; content watermark 18 at BOTH censuses) ----
const content = env(`${CEN2}/sync-content.json`);
const fpPayload = content.changes.filter(c => c.bookId === FP).at(-1).payload;
const chapters = fpPayload.chapters.map(ch => ({
  chapterId: ch.chapterId, chapterIndex: ch.index,
  segments: ch.segments.map(s => ({ occurrenceId: s.occurrenceId, povKey: s.pov ?? null,
    charCount: s.speechChars ?? s.textChars ?? 0, blockHistory: false })),
}));
const povs = fpPayload.cast.map(c => ({ key: c.name, name: c.name,
  provider: c.voice?.provider, voiceId: c.voice?.voice_id }));
out.content = { chapters: chapters.length,
  chapterArrayOrderIsIndexOrder: chapters.every((c, i) => c.chapterIndex === i),
  totalSegments: chapters.reduce((n, c) => n + c.segments.length, 0),
  distinctPovs: [...new Set(chapters.flatMap(c => c.segments.map(s => s.povKey)))],
  povProviders: povs.map(p => p.provider),
  allPovsResolve: chapters.flatMap(c => c.segments).every(s => povs.some(p => p.key === s.povKey)) };
const book = { bookId: FP, chapters, povs };

// ---- parked job (Nov 9 census read) ----
const parked = env(`${CEN2}/parked-job.json`);
const parkedEntries = new Map(parked.occurrences.map(o => [o.occurrence_id, o.state]));
const ch2Ids = chapters[2].segments.map(s => s.occurrenceId);
out.parked = { bookIdMatches: parked.bookId === FP, chapterIndex: parked.chapterIndex,
  entries: parkedEntries.size,
  entriesEqualChapter2Segments: parkedEntries.size === ch2Ids.length && ch2Ids.every(id => parkedEntries.has(id)),
  allEntriesBoundBefore: ch2Ids.every(id => boundBefore.has(id)),
  allEntriesBoundAfter: ch2Ids.every(id => boundAfter.has(id)) };
const parkedJob = { jobId: parked.jobId, bookId: parked.bookId,
  chapterIndex: parked.chapterIndex, entries: parkedEntries };

// ---- run the pinned canonicalization on both states ----
const run = (bound, pj) => buildEligibleSet({ books: [book], boundOccurrenceIds: bound, parkedJob: pj }, FP);
const before = run(boundBefore, parkedJob);
const after = run(boundAfter, parkedJob);
const ownSha = (built) => createHash("sha256")
  .update(JSON.stringify(built.entries.map(e => [e.occurrenceId, e.disposition]))).digest("hex");
out.digests = { beforeModule: before.digest, beforeOwnSha: ownSha(before),
  beforeMatchesRecord: before.digest === EXPECT_BEFORE,
  afterModule: after.digest, afterOwnSha: ownSha(after),
  afterMatchesObserved: after.digest === EXPECT_AFTER };
out.tallies = { before: dispositionCounts(before), after: dispositionCounts(after) };
const perCh = (built, idx) => { const es = built.entries.filter(e => e.chapterIndex === idx);
  const t = {}; for (const e of es) t[e.disposition] = (t[e.disposition] || 0) + 1; return t; };
out.perChapter = { before_ch3: perCh(before, 3), after_ch3: perCh(after, 3),
  before_ch4: perCh(before, 4), after_ch4: perCh(after, 4),
  before_ch2: perCh(before, 2), after_ch2: perCh(after, 2) };

// ---- the diff ----
const canonB = before.entries.map(e => [e.occurrenceId, e.disposition]);
const canonA = after.entries.map(e => [e.occurrenceId, e.disposition]);
out.sameUniverseSameOrder = canonB.length === canonA.length &&
  canonB.every((e, i) => e[0] === canonA[i][0]);
const diffs = [];
for (let i = 0; i < canonB.length; i++) if (canonB[i][1] !== canonA[i][1])
  diffs.push({ position: i, chapterIndex: after.entries[i].chapterIndex,
    occurrenceId: canonB[i][0], from: canonB[i][1], to: canonA[i][1] });
out.diff = { count: diffs.length,
  allEligibleToBound: diffs.every(d => d.from === "eligible" && d.to === "bound_already"),
  allInChapterIndex3: diffs.every(d => d.chapterIndex === 3),
  positions: diffs.map(d => d.position),
  idsEqualBindingsDelta: diffs.length === delta.length &&
    diffs.every(d => delta.includes(d.occurrenceId)), entries: diffs };

// ---- cross-check: the inherited plan's published ids (Nov 9 census reads) ----
const plan = env(`${CEN2}/plan-8f14c8885548b9c5ddd6b8df.json`);
const jobI = env(`${CEN2}/job-inherited.json`);
const planEntries = plan.entries || jobI.entries || [];
const committedIds = planEntries.filter(e => e.executionState === "committed")
  .map(e => e.occurrenceId || e.occurrence_id);
out.planCrossCheck = { planEntriesSeen: planEntries.length, committedCount: committedIds.length,
  committedEqualDiff: committedIds.length === diffs.length &&
    committedIds.every(id => diffs.some(d => d.occurrenceId === id)) };

// ---- robustness variants (parked adjustments are immaterial if digests hold) ----
const occ = parked.occurrences.map(o => o.occurrence_id);
const pjVariant = { ...parkedJob, releasedIds: new Set(occ.slice(3, 26)), exemptIds: new Set(occ.slice(26)) };
out.variants = {
  withReleasedAndExempt: { before: run(boundBefore, pjVariant).digest === EXPECT_BEFORE,
    after: run(boundAfter, pjVariant).digest === EXPECT_AFTER },
  parkedJobNull: { before: run(boundBefore, null).digest === EXPECT_BEFORE,
    after: run(boundAfter, null).digest === EXPECT_AFTER },
  povsEmpty: { before: buildEligibleSet({ books: [{ ...book, povs: [] }], boundOccurrenceIds: boundBefore, parkedJob }, FP).digest === EXPECT_BEFORE,
    after: buildEligibleSet({ books: [{ ...book, povs: [] }], boundOccurrenceIds: boundAfter, parkedJob }, FP).digest === EXPECT_AFTER } };

writeFileSync(`${REC}/results.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ bindings: out.bindings, content: out.content, parked: out.parked,
  digests: out.digests, tallies: out.tallies, perChapter: out.perChapter,
  sameUniverseSameOrder: out.sameUniverseSameOrder,
  diff: { count: out.diff.count, allEligibleToBound: out.diff.allEligibleToBound,
    allInChapterIndex3: out.diff.allInChapterIndex3, positions: out.diff.positions,
    idsEqualBindingsDelta: out.diff.idsEqualBindingsDelta },
  planCrossCheck: out.planCrossCheck, variants: out.variants }, null, 1));
