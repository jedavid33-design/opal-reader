#!/bin/bash
# Targeted-additions runner (T1–T3, Rowan ruling 6690000339):
# runs the NEW targeted test file and a confirmation run of the
# existing B-G2 battery file, sequentially, capturing full logs +
# exit codes under test-logs/targeted-additions/.
# This run is SEPARATELY LABELED: it never writes to
# test-logs/exit-run/ (the original exit-run evidence) and does
# not substitute for it.
# Exit code: 0 only if BOTH suites exit 0.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
LOGDIR="$ROOT/test-logs/targeted-additions"
mkdir -p "$LOGDIR"
cd "$ROOT"

overall=0
run_suite() {
  local name="$1"; shift
  echo "=== $name ==="
  "$@" > "$LOGDIR/$name.log" 2>&1
  local rc=$?
  echo "$name exit: $rc" | tee "$LOGDIR/$name.exit"
  if [ $rc -ne 0 ]; then overall=1; fi
}

run_suite targeted-t1t2t3 node --test tests/batch-bg2-targeted-t1t2t3.test.mjs
run_suite bg2-confirmation node --test tests/batch-bg2-battery.test.mjs

{
  echo "targeted-additions summary $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for f in "$LOGDIR"/*.exit; do cat "$f"; done
  echo "overall exit: $overall"
} | tee "$LOGDIR/SUMMARY.txt"
exit $overall
