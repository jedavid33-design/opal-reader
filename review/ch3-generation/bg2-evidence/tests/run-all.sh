#!/bin/bash
# B-G2 runner: one invocation runs every suite against the candidate
# tree and captures full logs + exit codes under the given log dir.
# Usage: run-all.sh <log-dir>
# Exit code: 0 only if EVERY suite exits 0.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
LOGDIR="${1:?usage: run-all.sh <log-dir>}"
mkdir -p "$LOGDIR"
cd "$ROOT"

node tests/regen-fixtures.mjs > "$LOGDIR/regen-fixtures.log" 2>&1
echo "regen-fixtures exit: $?" >> "$LOGDIR/regen-fixtures.log"

overall=0
run_suite() {
  local name="$1"; shift
  echo "=== $name ==="
  "$@" > "$LOGDIR/$name.log" 2>&1
  local rc=$?
  echo "$name exit: $rc" | tee "$LOGDIR/$name.exit"
  if [ $rc -ne 0 ]; then overall=1; fi
}

run_suite containment env \
  CONTAINMENT_V4_CAND_DIR="$ROOT/candidate-tree" \
  CONTAINMENT_V4_BASE_DIR="$ROOT/baseline-tree" \
  CONTAINMENT_V4_IDENTITY="$ROOT/tests/fixtures/identity-bg2.json" \
  node --test tests/containment/containment-battery.test.mjs

run_suite p2 node --test tests/p2/battery.test.mjs
run_suite r5a node --test tests/r5a/r5a-battery.test.mjs
run_suite v3 env V3_TREE_DIR="$ROOT/candidate-tree" \
  node --test tests/v3/v3-cold-restart.test.mjs
run_suite bg2 node --test tests/batch-bg2-battery.test.mjs

{
  echo "run-all summary $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for f in "$LOGDIR"/*.exit; do cat "$f"; done
  echo "overall exit: $overall"
} | tee "$LOGDIR/SUMMARY.txt"
exit $overall
