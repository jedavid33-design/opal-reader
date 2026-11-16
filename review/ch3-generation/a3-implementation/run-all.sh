#!/bin/bash
# A-3 runner: one invocation runs the A-3 acceptance battery,
# the adapted A-1 acceptance battery, and every standing
# regression suite against the A-3 candidate tree, capturing
# full logs + exit codes under the given log dir.
# Usage: run-all.sh <log-dir>
# Exit code: 0 only if EVERY suite exits 0.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
LOGDIR="${1:?usage: run-all.sh <log-dir>}"
mkdir -p "$LOGDIR"
cd "$HERE"

overall=0
run_suite() {
  local name="$1"; shift
  echo "=== $name ==="
  "$@" > "$LOGDIR/$name.log" 2>&1
  local rc=$?
  echo "$name exit: $rc" | tee "$LOGDIR/$name.exit"
  if [ $rc -ne 0 ]; then overall=1; fi
}

run_suite a3 node --test tests/a3-battery.test.mjs

run_suite a1 env A1_CAND_DIR="$HERE/candidate-tree" \
  A1_BASE_DIR="$HERE/baseline-tree" \
  node --test tests/a1-battery.test.mjs

run_suite s1 env S1_TREE_DIR="$HERE/candidate-tree" \
  node --test regressions/s1-enforcement-battery.test.mjs

run_suite containment env \
  CONTAINMENT_V4_CAND_DIR="$HERE/candidate-tree" \
  CONTAINMENT_V4_BASE_DIR="$HERE/baseline-tree" \
  CONTAINMENT_V4_IDENTITY="$HERE/regressions/fixtures/identity-s1.json" \
  node --test regressions/containment/containment-battery.test.mjs

run_suite p2 node --test regressions/p2/battery.test.mjs
run_suite r5a node --test regressions/r5a/r5a-battery.test.mjs
run_suite v3 env V3_TREE_DIR="$HERE/candidate-tree" \
  node --test regressions/v3/v3-cold-restart.test.mjs

{
  echo "run-all summary $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for f in "$LOGDIR"/*.exit; do cat "$f"; done
  echo "overall exit: $overall"
} | tee "$LOGDIR/SUMMARY.txt"
exit $overall
