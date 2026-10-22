// Build the synthetic P7 rehearsal inputs ONCE (Rowan condition 2: both
// rehearsals consume the SAME inputs; neither run may mutate them).
// The device manifests follow the assessment §5.1 inventory format and
// are derived from the snapshot's real content graph (real occurrence
// ids at chosen indexes) with scripted divergences — but every value in
// them is synthetic: no real device was captured, and the real
// two-device inspection remains a P8 step. The adjudicator decides each
// case by the §5.1 evidence rules; the intents documented here are what
// the scenarios are DESIGNED to exercise, the ledger reports what the
// rules actually did.
//
// Usage: node tools/build-rehearsal-inputs.mjs <snapshotDir> <inputsDir>
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [snapDir, inputsDir] = process.argv.slice(2);
if (!snapDir || !inputsDir) { console.error("usage: build-rehearsal-inputs.mjs <snapshotDir> <inputsDir>"); process.exit(2); }
mkdirSync(inputsDir, { recursive: true });

const books = readdirSync(join(snapDir, "books")).map((f) =>
  JSON.parse(readFileSync(join(snapDir, "books", f), "utf8")));
const graphOf = (b) => (b.chapters || []).map((ch) => (ch.segments || []).map((s) => s.id));
const at = (g, ci, si) => {
  const c = Math.min(ci, g.length - 1);
  const s = Math.min(si, g[c].length - 1);
  return { chapterIndex: c, segmentIndex: s, occurrenceId: g[c][s] };
};
const byTitle = Object.fromEntries(books.map((b) => [b.title, b]));
const TOKEN = "SYNTHETIC-TOKEN-p7-rehearsal-do-not-export";

const manifests = { iphone: { device: "iphone", books: {}, settings: { usageSpent: 12.34, token: TOKEN } },
                    ipad: { device: "ipad", books: {}, settings: { usageSpent: 9.87, token: TOKEN } } };
const intent = {};

// Pucked Up — ipad ahead of iphone, and ipad's checkpoint history
// passes exactly through iphone's position: evidence resolves it.
{
  const b = byTitle["Pucked Up"], g = graphOf(b);
  manifests.iphone.books[b.id] = { position: at(g, 9, 5), checkpoints: [at(g, 4, 2), at(g, 9, 0)] };
  manifests.ipad.books[b.id] = { position: at(g, 11, 3), checkpoints: [at(g, 4, 2), at(g, 9, 5), at(g, 11, 0)] };
  intent[b.title] = "ipad ahead; its checkpoints pass through iphone's position -> resolved-by-evidence (ipad)";
}
// In Her Own League — iphone tombstones the book; ipad holds it live.
{
  const b = byTitle["In Her Own League"], g = graphOf(b);
  manifests.iphone.books[b.id] = { tombstone: true };
  manifests.ipad.books[b.id] = { position: at(g, 5, 2), checkpoints: [at(g, 2, 0), at(g, 5, 0)] };
  intent[b.title] = "device tombstone vs live copies -> book migrates, conflict flagged for P8 inspection";
}
// The Goal — both devices agree on a position ahead of the cloud claim.
{
  const b = byTitle["The Goal"], g = graphOf(b);
  const pos = at(g, Math.min(20, g.length - 1), 1);
  const ck = [at(g, 10, 0), at(g, pos.chapterIndex, 0)];
  manifests.iphone.books[b.id] = { position: pos, checkpoints: ck };
  manifests.ipad.books[b.id] = { position: pos, checkpoints: ck };
  intent[b.title] = "both devices agree ahead of cloud -> device position wins on agreement + validity";
}
// Finding Home — ipad's position names an occurrence that is not in
// the graph (a truly divergent copy): discarded with evidence.
{
  const b = byTitle["Finding Home"], g = graphOf(b);
  manifests.iphone.books[b.id] = { position: at(g, 3, 4), checkpoints: [at(g, 1, 0)] };
  const bad = at(g, 6, 2); bad.occurrenceId = "00000000-0000-0000-0000-000000000000";
  manifests.ipad.books[b.id] = { position: bad, checkpoints: [at(g, 1, 0)] };
  intent[b.title] = "ipad position targets a non-existent occurrence -> discarded-with-evidence; iphone wins";
}
// Forever Pucked — devices mirror the cloud claim exactly.
{
  const b = byTitle["Forever Pucked"], g = graphOf(b);
  const pos = at(g, b.currentChapter || 0, b.currentSegment || 0);
  manifests.iphone.books[b.id] = { position: pos, checkpoints: [at(g, 0, 0)] };
  manifests.ipad.books[b.id] = { position: pos, checkpoints: [at(g, 0, 0)] };
  intent[b.title] = "full agreement -> cloud claim stands";
}
// Pucked — devices diverge; each carries a checkpoint ahead of its own
// position (internally inconsistent, uncorroborated).
{
  const b = byTitle["Pucked"], g = graphOf(b);
  manifests.iphone.books[b.id] = { position: at(g, 7, 0), checkpoints: [at(g, 9, 0)] };
  manifests.ipad.books[b.id] = { position: at(g, 9, 0), checkpoints: [at(g, 11, 0)] };
  intent[b.title] = "divergent, self-inconsistent device claims -> cloud stands, claims flagged for P8 inspection";
}
// Pucked Over — on neither device: cloud only.
intent["Pucked Over"] = "no device copies -> cloud claim stands unchallenged";

// Synthetic v1 Shelf outbox (rides in the iphone manifest per §5.1 and
// stands alone for the import step). Ids follow the shipped queue-id
// format; read ids are the books' real Shelf read ids.
const fp = byTitle["Forever Pucked"], ihol = byTitle["In Her Own League"];
const R1 = fp.shelfReadId || "synthetic-read-fp";
const R2 = ihol.shelfReadId || "synthetic-read-ihol";
const qid = (readId, ms, u) => "shelf_" + String(readId).replace(/[^a-zA-Z0-9_-]/g, "").slice(-48) + "_" + ms + "_" + u;
const T0 = Date.parse("2026-10-19T14:00:00.000Z");
const outbox = [
  { queueId: qid(R1, T0, "u0001"), clientSessionId: qid(R1, T0, "u0001"), readId: R1,
    startedAt: new Date(T0).toISOString(), duration_seconds: 1500, attempts: 0 },
  { queueId: qid(R1, T0 + 1560_000, "u0002"), clientSessionId: qid(R1, T0 + 1560_000, "u0002"), readId: R1,
    startedAt: new Date(T0 + 1560_000).toISOString(), duration_seconds: 900, attempts: 0 },
  { queueId: qid(R2, T0 + 68_400_000, "u0003"), clientSessionId: qid(R2, T0 + 68_400_000, "u0003"), readId: R2,
    startedAt: new Date(T0 + 68_400_000).toISOString(), duration_seconds: 2400, attempts: 2,
    lastStatus: 500, lastError: "Shelf 500" },
  { queueId: qid(R2, T0 + 73_800_000, "u0004"), clientSessionId: qid(R2, T0 + 73_800_000, "u0004"), readId: R2,
    startedAt: new Date(T0 + 73_800_000).toISOString(), duration_seconds: 600, attempts: 0 },
];
manifests.iphone.shelfOutbox = outbox;

writeFileSync(join(inputsDir, "manifests.json"), JSON.stringify(manifests, null, 1));
writeFileSync(join(inputsDir, "outbox.json"), JSON.stringify(outbox, null, 1));
writeFileSync(join(inputsDir, "intent.json"), JSON.stringify(intent, null, 1));
writeFileSync(join(inputsDir, "token.txt"), TOKEN);
console.log(JSON.stringify({ books: books.length, outboxItems: outbox.length, readIds: [R1, R2] }));
