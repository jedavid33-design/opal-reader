// D6 WS-3 — the migrated-text plane proofs (D6-PROPOSAL §5, CONTRACTS.md
// "generation/proofs.mjs (WS-3)"). Pure functions over the structural
// plane + the frozen census. Every proof reports NAMED offenders, never
// just a boolean. No book text anywhere — IDs, counts, POV keys only.
//
//   runProofs(plane, census) -> {
//     completeness:    { pass, offenders: [occurrenceId...], perBook },
//     idStability:     { pass, onlyInPlane: [...], onlyInCensus: [...] },
//     povResolution:   { pass, offenders: [occurrenceId...] },
//     noSilentSkips:   { pass, missing: [...], duplicated: [...],
//                        undispositioned: [...] },
//     ch3Reconciliation: { pass, rows: [exactly 27 x { occurrenceId,
//                        censusDisposition, parkedDisposition,
//                        liveParkedDisposition, resolution }],
//                        absentOccurrenceId, policyBlockOccurrenceId,
//                        parkedAccounting: { censusParkedCount,
//                        liveParkedCount, liveOnlyRows,
//                        censusOnlyRows }, offenders: [...] },
//     pass }
//
// census = { <bookId>: { occurrenceIds: [...], eligibleCount,
//              povKeys: [...] }, ...,
//            ch3: { structuralIds: [27 ids in order],
//                   parkedEntries: Map<occurrenceId,
//                     "parked-pending"|"parked-ready"> } }
// `eligibleCount` is the census count of UNBOUND occurrences for the
// book (the generation-eligible universe before Ch 3 / voice-prompt
// dispositioning). povKeys are the book's cast keys.
import { buildEligibleSet } from "./eligible-set.mjs";

const REMOVED = new Set(["azure", "fish", "speechify", "elevenlabs"]);

function planeBook(plane, bookId) {
  return (plane.books || []).find(b => b.bookId === bookId) || null;
}
function allPlaneIds(plane) {
  const ids = [];
  for (const b of plane.books || [])
    for (const ch of b.chapters || [])
      for (const s of ch.segments || []) ids.push(s.occurrenceId);
  return ids;
}
// The generation universe for a book: occurrences with no binding.
function unboundEntries(plane, bookId) {
  return buildEligibleSet(plane, bookId).entries
    .filter(e => e.disposition !== "bound_already");
}

export function runProofs(plane, census) {
  const bookIds = Object.keys(census).filter(k => k !== "ch3");
  const bound = plane.boundOccurrenceIds || new Set();

  // ---- 1. Completeness -------------------------------------------------
  // Every eligible-universe occurrence resolves to a text payload in the
  // content plane: it is present as a plane segment AND carries a
  // payload (hasPayload !== false and a positive charCount). Count
  // equality per book against the census is part of the same proof.
  const completeness = { pass: true, offenders: [], perBook: {} };
  for (const bookId of bookIds) {
    const book = planeBook(plane, bookId);
    const segById = new Map();
    if (book) for (const ch of book.chapters || [])
      for (const s of ch.segments || []) segById.set(s.occurrenceId, s);
    const universe = census[bookId].occurrenceIds.filter(id => {
      // census-side bound/unbound split comes from the plane's bound
      // set; an ID missing from the plane is an ID-stability failure
      // AND a completeness failure (it resolves to nothing).
      return !bound.has(id);
    });
    // The eligible universe per the census is its unbound count; the
    // plane must enumerate exactly that many unbound occurrences.
    const planeUnbound = book ? unboundEntries(plane, bookId) : [];
    const bookOffenders = [];
    if (planeUnbound.length !== census[bookId].eligibleCount)
      bookOffenders.push(
        `count_mismatch:${bookId}:plane=${planeUnbound.length}` +
        `:census=${census[bookId].eligibleCount}`);
    for (const e of planeUnbound) {
      const seg = segById.get(e.occurrenceId);
      if (!seg || seg.hasPayload === false ||
          typeof seg.charCount !== "number" || !(seg.charCount > 0))
        bookOffenders.push(e.occurrenceId);
    }
    // Census IDs in the universe with no plane segment at all.
    for (const id of universe) if (!segById.has(id)) bookOffenders.push(id);
    completeness.perBook[bookId] = {
      planeUnbound: planeUnbound.length,
      censusEligible: census[bookId].eligibleCount,
      offenders: bookOffenders,
    };
    completeness.offenders.push(...bookOffenders);
  }
  completeness.pass = completeness.offenders.length === 0;

  // ---- 2. ID stability ---------------------------------------------------
  // Set equality between the content plane and the frozen census,
  // across all books; differences are named in both directions.
  const planeIds = new Set(allPlaneIds(plane));
  const censusIds = new Set();
  for (const bookId of bookIds)
    for (const id of census[bookId].occurrenceIds) censusIds.add(id);
  const onlyInPlane = [...planeIds].filter(id => !censusIds.has(id)).sort();
  const onlyInCensus = [...censusIds].filter(id => !planeIds.has(id)).sort();
  const idStability = {
    pass: onlyInPlane.length === 0 && onlyInCensus.length === 0,
    onlyInPlane, onlyInCensus,
    planeCount: planeIds.size, censusCount: censusIds.size,
  };

  // ---- 3. POV resolution -------------------------------------------------
  // Every occurrence in the generation universe (eligible + voice_prompt
  // candidates, i.e. all unbound occurrences) must resolve its POV to a
  // cast entry for its book. Removed-provider POVs DO resolve (they are
  // voice_prompt, not unresolvable). Unresolvable = povKey null or not
  // among the book's cast keys (plane cast, cross-checked against the
  // census cast keys when the census carries them).
  const povOffenders = [];
  for (const bookId of bookIds) {
    const book = planeBook(plane, bookId);
    if (!book) continue;
    const castKeys = new Set((book.povs || []).map(p => p.key));
    const censusKeys = new Set(census[bookId].povKeys || []);
    for (const e of unboundEntries(plane, bookId)) {
      if (e.povKey == null || !castKeys.has(e.povKey) ||
          (censusKeys.size > 0 && !censusKeys.has(e.povKey)))
        povOffenders.push(e.occurrenceId);
    }
  }
  const povResolution = { pass: povOffenders.length === 0, offenders: povOffenders };

  // ---- 4. No silent skips --------------------------------------------------
  // The job builder's enumeration (buildEligibleSet over every book)
  // accounts for every census occurrence exactly once, each carrying a
  // disposition.
  const seen = new Map();
  const undispositioned = [];
  for (const bookId of bookIds) {
    if (!planeBook(plane, bookId)) continue;
    for (const e of buildEligibleSet(plane, bookId).entries) {
      seen.set(e.occurrenceId, (seen.get(e.occurrenceId) || 0) + 1);
      if (!e.disposition) undispositioned.push(e.occurrenceId);
    }
  }
  const missing = [...censusIds].filter(id => !seen.has(id)).sort();
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1)
    .map(([id]) => id).sort();
  const noSilentSkips = {
    pass: missing.length === 0 && duplicated.length === 0 &&
      undispositioned.length === 0,
    missing, duplicated, undispositioned,
    enumerated: seen.size, censusTotal: censusIds.size,
  };

  // ---- 5. Ch 3 boundary reconciliation -------------------------------------
  // Exactly one row per structural Ch 3 occurrence (27), checked against
  // BOTH the structural census (bound | unbound) and the parked job's
  // entries (parked-pending | parked-ready | absent). The structural ID
  // absent from the parked job and the ID carrying the POLICY_BLOCK
  // failure record are named on the report itself.
  const ch3 = census.ch3 || { structuralIds: [], parkedEntries: new Map() };
  const parkedEntries = ch3.parkedEntries instanceof Map
    ? ch3.parkedEntries : new Map(Object.entries(ch3.parkedEntries || {}));
  // The LIVE parked job's rows (the plane side) — CORRECTION 2: the
  // accounting states BOTH sides explicitly; the two need not agree
  // (live Ch 3 carries 27 rows, the census 26 parked entries), and a
  // divergence is named, never absorbed silently.
  const liveEntriesRaw = plane.parkedJob ? plane.parkedJob.entries : null;
  const liveEntries = liveEntriesRaw instanceof Map
    ? liveEntriesRaw
    : new Map(Object.entries(liveEntriesRaw || {}));
  const fpBook = plane.parkedJob ? planeBook(plane, plane.parkedJob.bookId) : null;
  const blockById = new Map();
  const ch3SegById = new Map();
  if (fpBook && plane.parkedJob) {
    for (const ch of fpBook.chapters || []) {
      if (ch.chapterIndex !== plane.parkedJob.chapterIndex) continue;
      for (const s of ch.segments || []) {
        // Blocked = carries the failure record OR any block history
        // (split lineage). A boolean policyBlockRecord of false must
        // never mask a true blockHistory (the `??` form did exactly
        // that on planes carrying both fields).
        blockById.set(s.occurrenceId, !!(s.policyBlockRecord || s.blockHistory));
        ch3SegById.set(s.occurrenceId, s);
      }
    }
  }
  // CORRECTION 2 — the POLICY_BLOCK anchor is the blockRootId lineage
  // ROOT: the occurrence whose blockRootId is self-referential, or
  // the target the other block-rooted occurrences chain to. (The
  // pre-correction scan took the LAST segment with block history,
  // which named a downstream split child on live data.) Planes
  // without lineage ids (the census fixture) fall back to the
  // occurrence carrying the POLICY_BLOCK failure record itself,
  // then to the first blocked segment in structural order —
  // deterministic, never scan-order "last wins".
  const blockedIds = ch3.structuralIds.filter(id => blockById.get(id) === true);
  const policyBlockOccurrenceId = (() => {
    const rootIdOf = new Map();
    for (const [id, s] of ch3SegById)
      if (s.blockRootId != null) rootIdOf.set(id, s.blockRootId);
    const rootOf = (id) => {
      let cur = id;
      const seen = new Set([id]);
      while (rootIdOf.has(cur)) {
        const next = rootIdOf.get(cur);
        if (next === cur || seen.has(next)) return next;
        seen.add(next);
        cur = next;
      }
      return cur;
    };
    const roots = [];
    for (const id of blockedIds) {
      if (!rootIdOf.has(id)) continue;
      const r = rootOf(id);
      if (!roots.includes(r)) roots.push(r);
    }
    if (roots.length === 1) return roots[0];
    if (roots.length > 1) {
      const recorded = roots.find(
        r => ch3SegById.get(r)?.policyBlockRecord === true);
      if (recorded) return recorded;
      return ch3.structuralIds.find(id => roots.includes(id)) ?? roots[0];
    }
    const recorded = blockedIds.find(
      id => ch3SegById.get(id)?.policyBlockRecord === true);
    if (recorded) return recorded;
    return blockedIds[0] ?? null;
  })();
  // CORRECTION 2 — two-sided parked accounting. A live-only row (a
  // row the live parked job carries that the census parked entries
  // do not) and a census-only entry are each NAMED with both sides'
  // dispositions. Naming is not an offender: on live data the one
  // live-only row (idx 26) is excluded from generation on both
  // accounts — live side as a parked entry of the inert parked job,
  // census side as a structural Ch 3 exclusion.
  const parkedAccounting = {
    censusParkedCount: parkedEntries.size,
    liveParkedCount: liveEntries.size,
    liveOnlyRows: [...liveEntries.entries()]
      .filter(([id]) => !parkedEntries.has(id))
      .map(([id, disp]) => ({
        occurrenceId: id,
        liveDisposition: disp,
        censusDisposition: "absent",
        inStructure: ch3.structuralIds.includes(id),
        note: "live parked-job row with no census parked entry; excluded " +
          "from generation on both accounts (live side: parked entry of " +
          "the inert parked job; census side: structural Ch 3 exclusion) " +
          "— named, never absorbed silently",
      })),
    censusOnlyRows: [...parkedEntries.entries()]
      .filter(([id]) => !liveEntries.has(id))
      .map(([id, disp]) => ({
        occurrenceId: id,
        censusDisposition: disp,
        liveDisposition: "absent",
        note: "census parked entry with no row in the live parked job; " +
          "the structural exclusion stands on the census side",
      })),
  };
  const rows = [];
  const ch3Offenders = [];
  let absentOccurrenceId = null;
  for (const id of ch3.structuralIds) {
    const censusDisposition = bound.has(id) ? "bound" : "unbound";
    const parkedDisposition = parkedEntries.has(id)
      ? parkedEntries.get(id) : "absent";
    const liveParkedDisposition = liveEntries.has(id)
      ? liveEntries.get(id) : "absent";
    if (parkedDisposition === "absent") absentOccurrenceId = id;
    const hasBlock = blockById.get(id) === true;
    let resolution;
    if (censusDisposition === "bound" && parkedDisposition === "parked-ready")
      resolution = "bound_already — bound in the census and parked-ready " +
        "in the parked job; excluded from the eligible set as bound";
    else if (censusDisposition === "unbound" && parkedDisposition === "parked-pending")
      resolution = "excluded_parked — unbound, held by the parked job; " +
        "never enumerated for generation";
    else if (parkedDisposition === "absent")
      resolution = "excluded_ch3 — structural Ch 3 occurrence absent from " +
        "the parked job; excluded with the whole parked chapter";
    else
      resolution = `other-with-reason — census=${censusDisposition} ` +
        `parked=${parkedDisposition} combination is not one of the ` +
        "reconciled dispositions";
    if (resolution.startsWith("other-with-reason")) ch3Offenders.push(id);
    if (hasBlock)
      resolution += "; carries Ch 3 POLICY_BLOCK block history " +
        "(split lineage / failure record from the parked job's own run)";
    if (id === policyBlockOccurrenceId)
      resolution += "; this occurrence is the POLICY_BLOCK lineage root " +
        "(the anchor named as policyBlockOccurrenceId)";
    if (liveParkedDisposition !== parkedDisposition)
      resolution += `; live parked job carries this occurrence as ` +
        `${liveParkedDisposition} (census parked side: ${parkedDisposition}) ` +
        "— excluded either way; see parkedAccounting";
    rows.push({
      occurrenceId: id, censusDisposition, parkedDisposition,
      liveParkedDisposition, resolution,
    });
  }
  if (rows.length !== 27)
    ch3Offenders.push(`row_count:${rows.length}:expected:27`);
  if (absentOccurrenceId === null)
    ch3Offenders.push("no_absent_structural_id_found");
  const ch3Reconciliation = {
    pass: ch3Offenders.length === 0 && rows.length === 27,
    rows, absentOccurrenceId, policyBlockOccurrenceId, parkedAccounting,
    offenders: ch3Offenders,
  };

  const pass = completeness.pass && idStability.pass && povResolution.pass &&
    noSilentSkips.pass && ch3Reconciliation.pass;
  return { completeness, idStability, povResolution, noSilentSkips,
           ch3Reconciliation, pass };
}
