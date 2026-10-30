// Per-book rollback with reverse-delta reconciliation (assessment §5.5,
// package Correction C: rollback is RECONCILIATION, not restore-only).
//
// Migration never mutates v1, so rolling a book back is mechanically
// simple — the honest problem is the work created on v2 AFTER cutover.
// This module proves that work is accounted for: it diffs the pre-write
// corpus against the post-write corpus (reverse deltas computed from
// the states themselves, never from a write log that could lie by
// omission), restores the book from the pre-write state, and emits one
// reconciliation entry per delta with an explicit disposition:
//   - position deltas      -> carry-back: listening progress is exported
//                             to the v1 position; it is never rolled back.
//   - bindings added       -> carry-back: the binding is exported to v1;
//                             its audio is content-addressed and remains
//                             valid in v1's cache (§5.5).
//   - cast style revisions -> carry-back as a v1 cast update (B10: the
//                             revision was visible and logged in v2; the
//                             value travels back, it does not vanish).
//   - bindings removed/changed, outcomes changed -> FLAG for manual
//                             review: a rollback that would destroy
//                             v2-era state is never silent.
// Proof obligations (asserted by the rehearsal + tests): the
// reconciliation covers exactly the computed delta set, and the rolled
// book is byte-identical (canonical digest) to its pre-write state.
import { canonical, deepClone, digest } from "./util.mjs";

function styleOf(pov) {
  return pov?.voice?.style_direction ?? pov?.style_direction ?? null;
}

export function reverseDeltas(beforeBook, afterBook) {
  const deltas = [];
  const push = (d) => deltas.push({ deltaId: digest(d).slice(0, 16), ...d });

  if (canonical(beforeBook.position || null) !== canonical(afterBook.position || null)) {
    push({ kind: "position", bookId: afterBook.bookId,
           before: beforeBook.position || null, after: afterBook.position || null });
  }
  const bBind = new Map((beforeBook.bindings || []).map((b) => [b.occurrenceId, b]));
  const aBind = new Map((afterBook.bindings || []).map((b) => [b.occurrenceId, b]));
  for (const [occ, b] of aBind) {
    if (!bBind.has(occ)) push({ kind: "binding-added", bookId: afterBook.bookId, occurrenceId: occ, binding: b });
    else if (canonical(bBind.get(occ)) !== canonical(b)) {
      push({ kind: "binding-changed", bookId: afterBook.bookId, occurrenceId: occ, before: bBind.get(occ), after: b });
    }
  }
  for (const [occ, b] of bBind) {
    if (!aBind.has(occ)) push({ kind: "binding-removed", bookId: afterBook.bookId, occurrenceId: occ, binding: b });
  }
  const bOut = new Map((beforeBook.outcomes || []).map((o) => [o.occurrenceId, o]));
  const aOut = new Map((afterBook.outcomes || []).map((o) => [o.occurrenceId, o]));
  for (const occ of new Set([...bOut.keys(), ...aOut.keys()])) {
    if (canonical(bOut.get(occ) || null) !== canonical(aOut.get(occ) || null)) {
      push({ kind: "outcome-changed", bookId: afterBook.bookId, occurrenceId: occ });
    }
  }
  const bCast = new Map((beforeBook.content.cast || []).map((p) => [p.name, p]));
  for (const pov of afterBook.content.cast || []) {
    const before = bCast.get(pov.name);
    if (styleOf(before) !== styleOf(pov)) {
      push({ kind: "content-revision", bookId: afterBook.bookId, pov: pov.name,
             field: "style_direction", before: styleOf(before), after: styleOf(pov) });
    }
  }
  deltas.sort((a, b) => a.deltaId.localeCompare(b.deltaId));
  return deltas;
}

const DISPOSITIONS = {
  "position": (d) => ({ disposition: "carry-back",
    export: { type: "v1-position-update", position: d.after?.opening ?? null },
    rationale: "listening progress made on v2 is exported back; it is never rolled back" }),
  "binding-added": (d) => ({ disposition: "carry-back",
    export: { type: "v1-binding", binding: d.binding },
    rationale: "audio is content-addressed and remains valid in v1's cache; the binding is exported back (§5.5)" }),
  "content-revision": (d) => ({ disposition: "carry-back",
    export: { type: "v1-cast-update", pov: d.pov, style_direction: d.after },
    rationale: "a style-direction revision (B10) travels back as a cast update; it does not vanish" }),
  "binding-removed": () => ({ disposition: "flag-manual-review", export: null,
    rationale: "rollback would destroy a v2-era binding removal; never silent" }),
  "binding-changed": () => ({ disposition: "flag-manual-review", export: null,
    rationale: "rollback would overwrite a v2-era binding change; never silent" }),
  "outcome-changed": () => ({ disposition: "flag-manual-review", export: null,
    rationale: "rollback would overwrite a v2-era outcome change; never silent" }),
};

export function rollbackBook(corpusAfter, corpusBefore, bookId) {
  const beforeBook = corpusBefore.books[bookId];
  const afterBook = corpusAfter.books[bookId];
  if (!beforeBook || !afterBook) throw new Error(`rollback: book ${bookId} missing on one side`);
  const deltas = reverseDeltas(beforeBook, afterBook);
  const reconciliation = deltas.map((d) => ({
    deltaId: d.deltaId, kind: d.kind, ...DISPOSITIONS[d.kind](d),
  }));
  const rolled = deepClone(corpusAfter);
  rolled.books[bookId] = deepClone(beforeBook);
  return { rolled, deltas, reconciliation };
}
