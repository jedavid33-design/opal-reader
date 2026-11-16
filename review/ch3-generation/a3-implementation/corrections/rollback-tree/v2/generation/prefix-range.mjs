// Prefix RANGE scans — the Option B replacement for SQL LIKE prefix
// patterns (REMEDIATION-OPTIONS.md, Rowan ANALYSIS PASS 6560003451).
//
// Why this module exists: production rejected the LIKE prefix
// construction `op_key LIKE 'op:<grantId>:%'` five times with the
// byte-identical message "LIKE or GLOB pattern too complex:
// SQLITE_ERROR" (four recorded schedule_dead conflict rows + the
// Gate 3 E3 finalizer-preview HTTP 500). The engine-level cause is
// UNPROVEN (hypothesis H1); this module removes the construction
// family from every query path, replacing each pattern predicate
// with a half-open range on the indexed key column:
//
//     key >= lo AND key < hi        lo = prefix, hi = successor(prefix)
//
// SQLite compares TEXT under the default BINARY collation bytewise
// (memcmp over the UTF-8 encoding), and UTF-8 byte order preserves
// code-point order, so the set { k : lo <= k < hi } is EXACTLY the
// set of strings having `prefix` as a prefix — for every suffix:
// the empty suffix (a key exactly equal to the prefix is included,
// exactly as LIKE's trailing % matches empty), ASCII suffixes, and
// non-ASCII suffixes. On every key the shipped writers can produce
// (lowercase hex / UUID / ASCII namespaces) the returned row set is
// byte-identical to the LIKE row set, in the same PK index order.
//
// The one semantic delta, named openly (proposal §3): SQLite LIKE
// without PRAGMA case_sensitive_like is case-insensitive for ASCII,
// so the old predicate could also match case-VARIANT keys (and keys
// reached through % / _ metacharacters inside an interpolated id).
// A range scan is case-sensitive byte equality on the prefix. The
// key namespaces in this system are machine-generated lowercase;
// the intended set at every call site is the byte-prefix set, and
// the range scan returns exactly that set on every input — never
// more, never fewer. Where LIKE and the range differ, LIKE is the
// one over-matching.
//
// successor(prefix): the least string strictly greater than every
// string having `prefix` as a prefix, computed over Unicode code
// points: increment the last code point, first dropping any
// trailing U+10FFFF code points (the code-point form of the general
// byte-successor rule "drop trailing 0xFF, increment the last
// byte"; for the ASCII prefixes used here the two rules coincide
// exactly — ':' 0x3A -> ';' 0x3B). Returns null when no finite
// successor exists (empty prefix, or a prefix consisting solely of
// U+10FFFF); callers then use the unbounded-above predicate
// `key >= lo`. No production prefix reaches that branch: every
// prefix here is a non-empty ASCII namespace ending in ':'.

export function prefixSuccessor(prefix) {
  const chars = Array.from(String(prefix));
  while (chars.length > 0) {
    const last = chars[chars.length - 1];
    const cp = last.codePointAt(0);
    if (cp === 0x10FFFF) { chars.pop(); continue; }
    chars[chars.length - 1] = String.fromCodePoint(cp + 1);
    return chars.join("");
  }
  return null;
}

// The shared range predicate for a key column. `column` is always
// an internal constant at the call site (a table's primary-key
// column name), never caller input; the prefix and bounds are
// always bound parameters. Returns { clause, params } to splice
// into the caller's query in place of `<column> LIKE ?`.
export function prefixRangeClause(column, prefix) {
  const lo = String(prefix);
  const hi = prefixSuccessor(lo);
  if (hi === null) return { clause: `${column} >= ?`, params: [lo] };
  return { clause: `${column} >= ? AND ${column} < ?`, params: [lo, hi] };
}
