#!/bin/bash
cd "$(dirname "$0")/../../" || exit 1
OUT=logs/seedfix/worker-suites
mkdir -p "$OUT"
: > logs/seedfix/worker-suites-summary.txt
pass=0; fail=0; failed=""
for f in tests/*.test.mjs; do
  name=$(basename "$f" .test.mjs)
  if node --test --test-timeout=120000 "$f" > "$OUT/$name.log" 2>&1; then
    ec=0; pass=$((pass+1))
  else
    ec=$?; fail=$((fail+1)); failed="$failed $name"
  fi
  echo "$name exit=$ec" >> logs/seedfix/worker-suites-summary.txt
done
echo "TOTAL files=$((pass+fail)) pass=$pass fail=$fail" >> logs/seedfix/worker-suites-summary.txt
echo "FAILED:$failed" >> logs/seedfix/worker-suites-summary.txt
echo "done: pass=$pass fail=$fail failed:$failed"
