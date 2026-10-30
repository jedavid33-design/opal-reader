// Device-manifest adjudication dry-run (assessment §5.1), rehearsal form.
//
// The cloud record is a CLAIM, not the truth: devices and cloud can
// disagree. Conflicts are resolved by EVIDENCE, not timestamps:
//   - a position counts only if its target occurrence exists in the
//     book's content graph (validity);
//   - a manifest is corroborated when every per-chapter checkpoint it
//     carries resolves in the graph and none runs ahead of its own
//     claimed position;
//   - one position EXPLAINS a rival when its checkpoint history passes
//     through or beyond the rival's position (the winner's own record
//     shows it was once where the loser still is);
//   - among valid positions the greatest progress wins when it explains
//     every rival; ties break toward corroborated, then toward cloud.
// Anything evidence cannot resolve goes to the manual-review list with
// the competing values shown, and the opening position falls back to
// the cloud claim (fail-safe: a book is never dropped, never guessed).
// A device tombstone against live copies is the same shape: the book
// migrates, the conflict is flagged for the real device inspection (P8).

function progressOf(pos) {
  return [pos.chapterIndex, pos.segmentIndex];
}
function cmpProgress(a, b) {
  return a[0] - b[0] || a[1] - b[1];
}
function samePos(a, b) {
  return a.chapterIndex === b.chapterIndex && a.segmentIndex === b.segmentIndex;
}

export function validatePosition(graph, pos) {
  if (!pos || !Number.isInteger(pos.chapterIndex) || !Number.isInteger(pos.segmentIndex)) {
    return { valid: false, reason: "malformed position" };
  }
  const ch = graph[pos.chapterIndex];
  if (!ch || pos.segmentIndex < 0 || pos.segmentIndex >= ch.length) {
    return { valid: false, reason: "target outside content graph" };
  }
  if (pos.occurrenceId != null && ch[pos.segmentIndex] !== pos.occurrenceId) {
    return { valid: false, reason: "occurrence id does not match graph at target" };
  }
  return { valid: true, occurrenceId: ch[pos.segmentIndex] };
}

export function corroborated(graph, manifest) {
  if (!manifest.position) return false;
  for (const ck of manifest.checkpoints || []) {
    if (!validatePosition(graph, ck).valid) return false;
    if (cmpProgress(progressOf(ck), progressOf(manifest.position)) > 0) return false;
  }
  return true;
}

function explains(graph, winner, loser) {
  if (samePos(winner.position, loser.position)) return true;
  return (winner.checkpoints || []).some(
    (ck) => validatePosition(graph, ck).valid &&
      cmpProgress(progressOf(ck), progressOf(loser.position)) >= 0);
}

// graph: array of chapters, each an array of occurrence ids.
// cloud: {position, checkpoints} from the v1 book record.
// devices: [{device, position?, checkpoints?, tombstone?}]
export function adjudicateBook({ bookId, graph, cloud, devices }) {
  const conflicts = [];
  let manualReview = false;

  const tombstonedBy = (devices || []).filter((d) => d.tombstone).map((d) => d.device);
  if (tombstonedBy.length) {
    manualReview = true;
    conflicts.push({
      kind: "tombstone-vs-live",
      devices: tombstonedBy,
      resolution: "flag-manual-review",
      evidence: "device tombstone(s) against a live cloud graph and live copies; the book migrates, the deletion claim is decided at the P8 device inspection, never by this tooling",
    });
  }

  const candidates = [];
  const consider = (source, manifest) => {
    if (!manifest || !manifest.position) return;
    const v = validatePosition(graph, manifest.position);
    if (!v.valid) {
      conflicts.push({
        kind: "invalid-position", source,
        position: manifest.position,
        resolution: "discarded-with-evidence", evidence: v.reason,
      });
      return;
    }
    candidates.push({
      source,
      position: { ...manifest.position, occurrenceId: v.occurrenceId },
      checkpoints: manifest.checkpoints || [],
      corroborated: corroborated(graph, manifest),
    });
  };
  consider("cloud", cloud);
  for (const d of devices || []) consider(d.device, d);

  if (!candidates.length) {
    return { bookId, openingPosition: null, source: "none", checkpoints: [],
             conflicts, manualReview: true };
  }

  // Evidence before progress: a corroborated claim (valid position +
  // internally consistent checkpoint history) outranks a further-along
  // claim that cannot corroborate itself. Only when nothing is
  // corroborated does the cloud claim stand as the fail-safe.
  const bestOf = (pool) => [...pool].sort((a, b) =>
    cmpProgress(progressOf(b.position), progressOf(a.position)) ||
    (a.source === "cloud" ? 0 : 1) - (b.source === "cloud" ? 0 : 1))[0];
  const trusted = candidates.filter((c) => c.corroborated);
  let winner, source;
  if (trusted.length) {
    winner = bestOf(trusted);
    source = winner.source;
  } else {
    winner = candidates.find((c) => c.source === "cloud") || bestOf(candidates);
    source = "cloud-failsafe";
    manualReview = true;
    conflicts.push({
      kind: "no-corroborated-position",
      positions: candidates.map((c) => ({ source: c.source, position: c.position })),
      resolution: "flag-manual-review",
      evidence: "no candidate position is corroborated by a consistent checkpoint history; the cloud claim stands as the fail-safe opening position",
    });
  }

  const rivals = candidates.filter((c) => c !== winner && !samePos(c.position, winner.position));
  const unexplained = rivals.filter((r) => !explains(graph, winner, r));
  if (unexplained.length) {
    manualReview = true;
    conflicts.push({
      kind: "divergent-positions",
      positions: candidates.map((c) => ({ source: c.source, position: c.position })),
      resolution: "flag-manual-review",
      evidence: "the winning position's checkpoint history does not explain every rival claim; the unexplained claim(s) are listed for the P8 device inspection",
    });
  } else if (rivals.length) {
    conflicts.push({
      kind: "divergent-positions",
      positions: candidates.map((c) => ({ source: c.source, position: c.position })),
      resolution: "resolved-by-evidence",
      evidence: "the winning position's checkpoint history passes through or beyond every rival position",
    });
  }
  return { bookId, openingPosition: winner.position, source,
           checkpoints: winner.checkpoints, conflicts, manualReview };
}
