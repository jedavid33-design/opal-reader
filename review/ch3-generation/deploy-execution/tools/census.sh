#!/bin/bash
# Ch3 halted deploy: fresh complete quota census (operator reads only).
# Usage: census.sh <outdir> <sfx>
# Pages per gate-(b) section 5.3 / gate-(c) RC pattern:
#   000 default (offsets default)
#   001 explicit exceptionOffset=0&driftOffset=0
#   002 explicit exceptionOffset=1&driftOffset=0 (past-end probe)
#   003 default (closing read)
set -u
OUT="$1"; SFX="$2"
mkdir -p "$OUT"
export PYTHONPATH=/opt/hatch/workflow-skills/custom-connector-setup/bin
OP=~/workspace/custom-connectors/custom.opalreader-v2-prod-operator/bin/v2prod-operator-api
H1="X-OpalReader-Scope: production"
H2="X-OpalReader-Instance: account"

date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/census-timestamp-$SFX.txt"
$OP GET "/v2/d6-quota-reconcile" --header "$H1" --header "$H2" > "$OUT/census-page-000-$SFX.json" 2>&1
$OP GET "/v2/d6-quota-reconcile?exceptionOffset=0&driftOffset=0" --header "$H1" --header "$H2" > "$OUT/census-page-001-$SFX.json" 2>&1
$OP GET "/v2/d6-quota-reconcile?exceptionOffset=1&driftOffset=0" --header "$H1" --header "$H2" > "$OUT/census-page-002-$SFX.json" 2>&1
$OP GET "/v2/d6-quota-reconcile" --header "$H1" --header "$H2" > "$OUT/census-page-003-$SFX.json" 2>&1
echo "census $SFX done -> $OUT"
