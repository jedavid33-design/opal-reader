// Writer census over the shipped client bundle (P5, Rowan check 2).
// The derivations inventory (roundtable issue #12) is only complete if it
// accounts for EVERY client writer — the 94 pe() save-funnel call sites and
// the hidden fallback writers — not just the named helpers. This census
// measures the shipped bundle; the P5 tests assert the measured numbers so
// any bundle change breaks loudly and forces an inventory update instead of
// silently drifting from the pre-deletion map.
export function censusClientBundle(source) {
  const count = (re) => (source.match(re) ?? []).length;
  const lineOf = (token) => {
    const idx = source.indexOf(token);
    return idx < 0 ? null : source.slice(0, idx).split("\n").length;
  };
  return {
    peCallSites: count(/\bpe\(/g),
    localStorageSetItem: count(/localStorage\.setItem/g),
    updatedAtRefs: count(/updatedAt/g),
    audioStaleRefs: count(/audioStale/g),
    audioKeyAssignments: count(/\.audioKey\s*=/g),
    releaseOldPlaybackRefs: count(/releaseOldPlaybackForCloudResume/g),
    syncBookRefs: count(/sync\/book/g),
    cloudSettingsHatchRefs: count(/cloud settings|useCloudSettings/gi),
    derivations: {
      chapterTruth: lineOf("chapterTruth"),
      normalizeCompletedChapterStatus: lineOf("normalizeCompletedChapterStatus"),
      chapterPlaybackReady: lineOf("chapterPlaybackReady"),
    },
  };
}
