// P7 migration rehearsal runner. Executes ONE full rehearsal from a
// pristine snapshot copy + the shared synthetic inputs, and writes the
// complete evidence ledger set to the output directory:
//   corpus.json            the transformed v2 corpus (families per §5.3)
//   verifier-report.json   per-book §5.4 checks + audio byte-pass cross-check
//   dispositions.json      the §2.2/§2.3 disposition ledger (A1–A7, jobs,
//                          orphans, manual review — everything explicit)
//   adjudication.json      device-manifest adjudication, per book
//   outbox-proof.json      synthetic Shelf outbox import against the real
//                          P6 bridge (scripted fetch only, never live)
//   restore-test.json      a v1 backup restored via the transformer
//   rollback.json          per-book rollback + reverse-delta reconciliation
//   invariants.json        idempotency, snapshot integrity, token scan
//   run-summary.json       headline counts + verdict
// Exit code 0 iff the rehearsal is CLEAN. A dirty rehearsal is a result,
// not an error to hide: the ledgers say exactly what failed.
//
// Usage: node tools/run-rehearsal.mjs <snapshotDir> <inputsDir> <outDir>
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { audioObjectIndex, transformBook, transformJobs, computeOrphans,
         computeChapterTruth } from "../v2/migration/transform.mjs";
import { adjudicateBook } from "../v2/migration/adjudicate.mjs";
import { verifyBook } from "../v2/migration/verify.mjs";
import { rollbackBook } from "../v2/migration/rollback.mjs";
import { importV1Outbox } from "../v2/migration/shelf-outbox-import.mjs";
import { createShelfBridge } from "../v2/client/shelf-bridge.mjs";
import { canonical, deepClone, digest, sha256hex } from "../v2/migration/util.mjs";

const [snapDir, inputsDir, outDir] = process.argv.slice(2);
if (!snapDir || !inputsDir || !outDir) {
  console.error("usage: run-rehearsal.mjs <snapshotDir> <inputsDir> <outDir>"); process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (name, obj) => writeFileSync(join(outDir, name), JSON.stringify(obj, null, 1));
const problems = [];
const stop = (msg) => problems.push(msg);

// ------------------------------------------------------------ load inputs
const manifest = readJson(join(snapDir, "snapshot-manifest.json"));
const listings = readJson(join(snapDir, "listings.json"));
const books = readdirSync(join(snapDir, "books")).map((f) => readJson(join(snapDir, "books", f)));
const statuses = readdirSync(join(snapDir, "statuses")).map((f) => readJson(join(snapDir, "statuses", f)));
const audioResults = new Map();
for (const line of readFileSync(join(snapDir, "audio-results.jsonl"), "utf8").split("\n")) {
  if (line.trim()) { const r = JSON.parse(line); audioResults.set(r.key, r); }
}
const inputs = {
  manifests: readJson(join(inputsDir, "manifests.json")),
  outbox: readJson(join(inputsDir, "outbox.json")),
  intent: readJson(join(inputsDir, "intent.json")),
  token: readFileSync(join(inputsDir, "token.txt"), "utf8"),
};
const audioIdx = audioObjectIndex(listings);
const graphOf = (corpusBook) => corpusBook.content.chapters.map((ch) => ch.segments.map((s) => s.occurrenceId));

// -------------------------------------------- snapshot input integrity
let snapshotIntact = true;
for (const [rel, want] of Object.entries(manifest.file_hashes)) {
  let got = null;
  try { got = createHash("sha256").update(readFileSync(join(snapDir, rel))).digest("hex"); } catch { /* missing */ }
  if (got !== want) { snapshotIntact = false; stop(`snapshot input changed: ${rel}`); }
}

// ---------------------------------------------------------------- transform
function buildCorpus() {
  const corpusBooks = {};
  for (const b of books) corpusBooks[b.id] = transformBook(b, audioIdx);
  const completeBookIds = new Set(books.filter((b) =>
    (b.chapters || []).every((ch) => (ch.segments || []).every((s) => s.audioKey || s.systemVoiceFallback)))
    .map((b) => b.id));
  const jobs = transformJobs(statuses, completeBookIds);
  const orphans = computeOrphans(audioIdx, Object.values(corpusBooks).flatMap((t) => t.bindings));
  return { books: corpusBooks, jobs, orphans };
}
const corpus = buildCorpus();
const corpusAgain = buildCorpus();
const idempotent = digest(corpus) === digest(corpusAgain);
if (!idempotent) stop("transform is not idempotent: two runs over the same input differ");

// ------------------------------------------------------------- adjudication
const adjudications = {};
for (const b of books) {
  const cb = corpus.books[b.id];
  const g = graphOf(cb);
  const cc = Math.min(b.currentChapter || 0, g.length - 1);
  const cs = Math.min(b.currentSegment || 0, g[cc].length - 1);
  const cloud = {
    position: { chapterIndex: cc, segmentIndex: cs, occurrenceId: g[cc][cs] },
    checkpoints: (b.chapters || []).map((ch, ci) => ch.playback
      ? { chapterIndex: ci, segmentIndex: Math.min(ch.playback.segment || 0, g[ci].length - 1),
          occurrenceId: g[ci][Math.min(ch.playback.segment || 0, g[ci].length - 1)] } : null).filter(Boolean),
  };
  const devices = ["iphone", "ipad"].map((name) => {
    const entry = inputs.manifests[name].books[b.id];
    return entry ? { device: name, ...entry } : { device: name };
  });
  const adj = adjudicateBook({ bookId: b.id, graph: g, cloud, devices });
  adjudications[b.id] = { title: b.title, intent: inputs.intent[b.title] || null, ...adj };
  cb.position = { opening: adj.openingPosition, checkpoints: adj.checkpoints, source: adj.source };
}

// ------------------------------------------------------------------- verify
const FP_ID = books.find((b) => b.title === "Forever Pucked")?.id;
const truthSeeds = FP_ID ? { [FP_ID]: [
  { chapterIndex: 0, total: 27, playable: 27, blocked: 0 },
  { chapterIndex: 1, total: 38, playable: 20, blocked: 18 },
  { chapterIndex: 2, total: 27, playable: 3, blocked: 0 },
] } : {};
const bookReports = [];
for (const b of books) {
  const rep = verifyBook({ snapshotBook: b, corpusBook: corpus.books[b.id], audioIdx,
    adjudication: adjudications[b.id], aggregates: corpus.jobs.aggregates,
    snapshotStatuses: statuses, truthSeeds });
  bookReports.push(rep);
  if (!rep.pass) stop(`book failed §5.4 verification: ${b.title}: ${rep.problems.join("; ")}`);
}

// Audio byte-pass cross-check (Rowan condition 5: stop on any missing or
// misbound audio). Listing existence is necessary; the byte pass is the
// proof the object is what the binding claims.
const audioCross = { checked: 0, missing: [], sizeMismatch: [], formatMismatch: [], implausible: [] };
for (const cb of Object.values(corpus.books)) {
  for (const bind of cb.bindings) {
    if (bind.kind !== "r2") continue;
    audioCross.checked += 1;
    const row = audioResults.get(bind.cacheKey);
    const obj = audioIdx.get(bind.cacheKey);
    if (!row || row.error) { audioCross.missing.push(bind.cacheKey); continue; }
    if (obj && row.bytes !== obj.size) audioCross.sizeMismatch.push(bind.cacheKey);
    if (row.format !== row.ext) audioCross.formatMismatch.push(bind.cacheKey);
  }
}
for (const row of audioResults.values()) {
  if (row.plausible === false) {
    for (const u of row.uses || []) audioCross.implausible.push(
      { book: u.book, chapter: u.chapter, index: u.index, chars: u.chars,
        duration_s: row.duration_s, chars_per_s: row.chars_per_s, stale_flag: u.stale_flag });
  }
}
if (audioCross.missing.length || audioCross.sizeMismatch.length || audioCross.formatMismatch.length) {
  stop(`audio cross-check failed: missing ${audioCross.missing.length}, size ${audioCross.sizeMismatch.length}, format ${audioCross.formatMismatch.length}`);
}

// --------------------------------------------------------- disposition ledger
const allBindings = Object.values(corpus.books).flatMap((cb) => cb.bindings);
const provLabels = {};
for (const b of allBindings) provLabels[b.provenance.label] = (provLabels[b.provenance.label] || 0) + 1;
const staleFlagged = [];
for (const cb of Object.values(corpus.books)) {
  for (const b of cb.bindings) if (b.staleFlag) staleFlagged.push(
    { book: cb.title, chapterIndex: b.chapterIndex, segmentIndex: b.segmentIndex, occurrenceId: b.occurrenceId });
}
const manualReview = [
  ...staleFlagged.map((s) => ({ kind: "A3-stale-flag", ...s,
    disposition: "migrates bound-but-flagged; listen-check at cutover; never silently honored or dropped" })),
  ...audioCross.implausible.map((u) => ({ kind: "duration-anomaly", ...u,
    disposition: "flagged for listen-check (the P1-carried item is In Her Own League Ch4 seg3); byte-pass outliers are reported, never auto-cleared" })),
  ...Object.values(adjudications).filter((a) => a.manualReview).map((a) => ({ kind: "adjudication-conflict",
    book: a.title, conflicts: a.conflicts.filter((c) => c.resolution === "flag-manual-review"),
    disposition: "opening position set by the evidence rules; the conflict itself is decided at the P8 device inspection" })),
  ...corpus.jobs.aggregates.filter((a) => a.disposition === "carry-held-manual-review").map((a) => ({
    kind: "unclassified-nonterminal-job", jobId: a.jobId, bookId: a.bookId, chapterIndex: a.chapterIndex, v1State: a.v1State,
    disposition: "carried held in PARKED_POLICY, never auto-resubmitted; classification required before cutover" })),
];
const dispositions = {
  A1_legacyAnchoring: {
    count: allBindings.filter((b) => b.revision.startsWith("legacy:")).length,
    disposition: "bound segments with no stored fingerprint are anchored as legacy revisions (revision = 'legacy:' + audioKey); the historical fingerprint is never recomputed",
  },
  A2_provenanceLabels: { counts: provLabels,
    disposition: "recorded / recorded-partial where stamped; cast-inferred (single-model pov) or legacy-unknown where not; metadata only, never blocks migration" },
  A3_staleFlag: { items: staleFlagged, disposition: "bound-but-flagged onto the manual-review list (see manualReview)" },
  A4_deviceVoice: { count: allBindings.filter((b) => b.kind === "device-voice").length,
    disposition: "migrated as device-voice bindings (Julie's deliberate manual choices)" },
  A5_nonTerminalJobs: { inventory: corpus.jobs.inventory, aggregates: corpus.jobs.aggregates },
  A6_orphanAudio: { count: corpus.orphans.length,
    totalBytes: corpus.orphans.reduce((n, o) => n + (o.size || 0), 0),
    disposition: "preserved in place, inventoried, never assigned to a passage",
    items: corpus.orphans },
  A7_emptyCastEntries: { disposition: "content fact, no migration action (computed at transform; IHOL epilogue POV entries govern zero segments)" },
  manualReview,
};

// --------------------------------------------------------------- outbox proof
const outboxProof = { assertions: [] };
{
  const assert = (name, cond) => { outboxProof.assertions.push({ name, pass: !!cond }); if (!cond) stop(`outbox proof: ${name}`); };
  const { record, report } = importV1Outbox(inputs.outbox);
  outboxProof.importReport = report;
  assert("import preserves ids/attempts/order byte-for-byte",
    canonical(record.outbox) === canonical(inputs.outbox));

  const memStorage = () => { const m = new Map(); return {
    get: async (k) => m.get(k), set: async (k, v) => m.set(k, v) }; };

  // FIFO flush, all accepted: bodies leave in import order, ids intact.
  const storage1 = memStorage();
  await storage1.set("cs:shelf-bridge:v1", record);
  const sentBodies = [];
  const okFetch = async (url, opts) => { sentBodies.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => ({}) }; };
  const bridge1 = createShelfBridge({ storage: storage1, fetchFn: okFetch,
    shelfApiBase: "https://shelf.example", idGen: () => "unused" });
  const flush1 = await bridge1.flush();
  assert("flush sends every imported item", flush1.sent === inputs.outbox.length);
  assert("flush order is FIFO with original client_session_ids",
    canonical(sentBodies.map((b) => b.body.client_session_id)) === canonical(inputs.outbox.map((i) => i.clientSessionId)));
  assert("flush bodies carry the frozen wire fields",
    sentBodies.every((b) => b.url === "https://shelf.example/api/sessions" &&
      ["read_id", "local_date", "started_at", "duration_seconds", "client_session_id"].every((k) => k in b.body)));

  // Retry semantics: a failing head blocks the queue; attempts continue
  // from the imported values (item 3 enters with attempts 2).
  const storage2 = memStorage();
  await storage2.set("cs:shelf-bridge:v1", importV1Outbox(inputs.outbox).record);
  const failFetch = async () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
  const bridge2 = createShelfBridge({ storage: storage2, fetchFn: failFetch,
    shelfApiBase: "https://shelf.example", idGen: () => "unused" });
  await bridge2.flush();
  const blocked = await bridge2.outbox();
  assert("head-of-line blocking: nothing behind a failed head moves",
    blocked.length === inputs.outbox.length && blocked[0].attempts === inputs.outbox[0].attempts + 1);
  assert("items behind the head keep their imported attempts",
    blocked[2].attempts === inputs.outbox[2].attempts && blocked[2].lastStatus === 500);

  // Merge after import honors the attempts===0 rule against imported items.
  const tail = inputs.outbox[inputs.outbox.length - 1];
  const tailEnd = new Date(tail.startedAt).getTime() + tail.duration_seconds * 1000;
  await bridge2.sessionEnded({ readId: tail.readId, startedAtMs: tailEnd + 30_000, durationSeconds: 45 });
  const afterMerge = await bridge2.outbox();
  assert("session ending within 90s of an imported tail (attempts 0) merges into it",
    afterMerge.length === inputs.outbox.length &&
    afterMerge[afterMerge.length - 1].duration_seconds === tail.duration_seconds + 45);
}

// --------------------------------------------------------------- restore test
let restoreReport;
{
  const src = books.find((b) => b.title === "Finding Home");
  const backup = { book: src, epubListed: (listings["epubs/"] || []).length > 0,
                   audioKeys: src.chapters.flatMap((ch) => ch.segments).filter((s) => s.audioKey).map((s) => s.audioKey) };
  const restored = transformBook(backup.book, audioIdx);
  const g = restored.content.chapters.map((ch) => ch.segments.map((s) => s.occurrenceId));
  const adj = adjudicateBook({ bookId: src.id, graph: g,
    cloud: { position: { chapterIndex: 0, segmentIndex: 0 }, checkpoints: [] }, devices: [] });
  restored.position = { opening: adj.openingPosition, checkpoints: adj.checkpoints, source: adj.source };
  const rep = verifyBook({ snapshotBook: src, corpusBook: restored, audioIdx, adjudication: adj,
    aggregates: [], snapshotStatuses: [], truthSeeds: {} });
  restoreReport = { book: src.title, backupAudioKeys: backup.audioKeys.length, epubListed: backup.epubListed,
                    verifierPass: rep.pass, problems: rep.problems };
  if (!rep.pass) stop(`restore test failed: ${rep.problems.join("; ")}`);
}

// ------------------------------------------------------------------ rollback
let rollbackReport;
{
  const before = deepClone(corpus);
  const after = deepClone(corpus);
  const fpBook = after.books[FP_ID];
  const g = graphOf(fpBook);
  // synthetic v2-era writes: (1) position advances, (2) a new binding is
  // created for a never-generated segment, (3) a cast style direction
  // is edited (a new content revision, B10).
  fpBook.position = { opening: { chapterIndex: 1, segmentIndex: 10, occurrenceId: g[1][10] },
                      checkpoints: fpBook.position.checkpoints, source: "synthetic-v2-write" };
  const target = fpBook.unbound.find((u) => u.classification === "never-generated");
  const synthKey = sha256hex("p7-synthetic-audio-" + target.occurrenceId);
  fpBook.bindings.push({ occurrenceId: target.occurrenceId, chapterIndex: target.chapterIndex,
    segmentIndex: target.segmentIndex, kind: "r2", revision: synthKey, cacheKey: synthKey,
    provenance: { model: "synthetic", providerRequestId: null, label: "synthetic-rehearsal" }, staleFlag: false });
  const pov0 = fpBook.content.cast[0];
  if (pov0.voice && typeof pov0.voice === "object") pov0.voice.style_direction = "synthetic rehearsal style";
  else pov0.style_direction = "synthetic rehearsal style";

  const { rolled, deltas, reconciliation } = rollbackBook(after, before, FP_ID);
  const otherBooksUntouched = Object.keys(before.books).every((id) =>
    id === FP_ID || digest(rolled.books[id]) === digest(before.books[id]));
  const rolledMatches = digest(rolled.books[FP_ID]) === digest(before.books[FP_ID]);
  const coversAll = canonical(reconciliation.map((r) => r.deltaId).sort()) ===
                    canonical(deltas.map((d) => d.deltaId).sort());
  rollbackReport = { book: "Forever Pucked", deltas, reconciliation,
    assertions: { rolledBookMatchesPreWrite: rolledMatches, otherBooksUntouched, reconciliationCoversEveryDelta: coversAll } };
  if (!rolledMatches || !otherBooksUntouched || !coversAll) stop("rollback reconciliation assertions failed");
}

// ------------------------------------------------------- usage ledger (§5.3)
let ledgerReport = { events: 0 };
{
  const dir = join(snapDir, "usage-events");
  let files = [];
  try { files = readdirSync(dir); } catch { /* none */ }
  let empty = 0, est = 0, calc = 0, mtd = 0;
  const month = manifest.taken_at.slice(0, 7); // snapshot month, UTC
  for (const f of files) {
    let e = null;
    try { e = readJson(join(dir, f)); } catch { e = null; }
    if (!e) { empty += 1; continue; }
    ledgerReport.events += 1;
    if (typeof e.estimated_cost === "number") est += e.estimated_cost;
    if (typeof e.calculated_cost === "number") calc += e.calculated_cost;
    if (typeof e.timestamp === "number" &&
        new Date(e.timestamp).toISOString().slice(0, 7) === month &&
        typeof e.estimated_cost === "number") mtd += e.estimated_cost;
  }
  ledgerReport = { ...ledgerReport, objects: files.length, emptyObjects: empty,
    allTimeEstimatedCost: Math.round(est * 1e6) / 1e6,
    allTimeCalculatedCost: Math.round(calc * 1e6) / 1e6,
    openingMonthToDate: Math.round(mtd * 1e6) / 1e6, month,
    clientFiguresFromManifests: { iphone: inputs.manifests.iphone.settings.usageSpent,
                                  ipad: inputs.manifests.ipad.settings.usageSpent },
    note: "the v1 usage/events history is adopted as-is; the server-recomputed figure is authoritative and the client-side numbers ride along as a variance note (I7)" };
}

// ------------------------------------------------------------------ outputs
const corpusOut = { books: {}, jobs: corpus.jobs, orphans: corpus.orphans, ledger: ledgerReport };
for (const [id, cb] of Object.entries(corpus.books)) {
  corpusOut.books[id] = { content: cb.content, bindings: cb.bindings, outcomes: cb.outcomes,
                          unbound: cb.unbound, counts: cb.counts, position: cb.position,
                          chapterTruth: computeChapterTruth(cb, corpus.jobs.aggregates) };
}
writeJson("corpus.json", corpusOut);
writeJson("verifier-report.json", { books: bookReports, audioCrossCheck: audioCross });
writeJson("dispositions.json", dispositions);
writeJson("adjudication.json", adjudications);
writeJson("outbox-proof.json", outboxProof);
writeJson("restore-test.json", restoreReport);
writeJson("rollback.json", rollbackReport);
writeJson("invariants.json", { snapshotInputIntact: snapshotIntact, transformIdempotent: idempotent,
  settingsTokenRedactedInSnapshot: manifest.settings?.token_redacted === true,
  orphanNonAssignment: corpus.orphans.every((o) => !allBindings.some((b) => b.cacheKey === o.audioKey)) });

// Token scan over everything this run exported (the manifests carry a
// synthetic token; no export may).
let tokenLeaks = [];
for (const f of readdirSync(outDir)) {
  if (readFileSync(join(outDir, f), "utf8").includes(inputs.token)) tokenLeaks.push(f);
}
if (tokenLeaks.length) stop(`token leaked into exports: ${tokenLeaks.join(", ")}`);
writeJson("invariants.json", { snapshotInputIntact: snapshotIntact, transformIdempotent: idempotent,
  settingsTokenRedactedInSnapshot: manifest.settings?.token_redacted === true,
  orphanNonAssignment: corpus.orphans.every((o) => !allBindings.some((b) => b.cacheKey === o.audioKey)),
  tokenLeaks });

const totals = bookReports.reduce((acc, r) => {
  acc.books += 1; if (r.pass) acc.booksPassing += 1; return acc;
}, { books: 0, booksPassing: 0 });
const summary = {
  verdict: problems.length === 0 ? "clean" : "dirty",
  problems,
  books: totals,
  segments: Object.values(corpus.books).reduce((n, cb) => n + cb.counts.segments, 0),
  bindingsR2: allBindings.filter((b) => b.kind === "r2").length,
  bindingsDeviceVoice: allBindings.filter((b) => b.kind === "device-voice").length,
  audioObjectsByteChecked: audioCross.checked,
  audioImplausible: audioCross.implausible.length,
  orphans: corpus.orphans.length,
  nonTerminalJobs: corpus.jobs.aggregates.length,
  manualReviewItems: manualReview.length,
  snapshotDigest: manifest.corpus_digest,
};
writeJson("run-summary.json", summary);
console.log(JSON.stringify(summary, null, 1));
process.exit(problems.length === 0 ? 0 : 1);
