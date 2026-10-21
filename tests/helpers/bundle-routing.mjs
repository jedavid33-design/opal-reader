// Save-path routing analysis over the shipped bundle (P5 Stage-1 FU1).
// Demonstrates, from the actual app-256.js source, that the client's book
// uploads converge on ONE seam: pe() (the save funnel) triggers sync only
// via Er (debounce) -> Ee (the sync engine), and Ee is the only caller of
// _r (the single PUT /api/sync/book helper). Character offsets are used
// throughout (the bundle has very long lines; line numbers are too coarse).
export function analyzeSaveRouting(src) {
  const sites = (re) => [...src.matchAll(re)].map((m) => m.index);
  const defOf = (name) => {
    const m = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
    return m ? m.index : -1;
  };
  const peDef = defOf("pe");
  const erDef = defOf("Er");
  const eeDef = defOf("Ee");
  const rDef = defOf("_r");
  // Ee's span: from its definition to the next top-level function (Er).
  const eeSpan = { start: eeDef, end: erDef };
  const isDefName = (i) => /(?:async\s+)?function\s+$/.test(src.slice(Math.max(0, i - 24), i));
  const rCallSites = sites(/\b_r\(/g).filter((i) => !isDefName(i));
  const eeCallSites = sites(/\bEe\(/g).filter((i) => !isDefName(i));
  const erCallSites = sites(/\bEr\(/g).filter((i) => !isDefName(i));
  const peBody = src.slice(peDef, src.indexOf("async function delIDB", peDef));
  return {
    counts: {
      peTokens: sites(/\bpe\(/g).length,
      rCallSites: rCallSites.length,
      eeCallSites: eeCallSites.length,
      erCallSites: erCallSites.length,
    },
    rCallsInsideEe: rCallSites.every((i) => i > eeSpan.start && i < eeSpan.end),
    peCallsEr: /\bEr\(/.test(peBody),
    peCallsRDirectly: /\b_r\(/.test(peBody),
    peBody,
    eeSpan,
    defs: { peDef, erDef, eeDef, rDef },
  };
}
