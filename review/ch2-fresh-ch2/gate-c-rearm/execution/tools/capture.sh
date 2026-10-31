#!/bin/bash
# Gate-(a) combined deploy: read-only inventory capture.
# Usage: capture.sh <outdir> <sfx>
# Pure reads only: client connector reads, operator diagnostics reads,
# Cloudflare GETs. No mutations of any kind.
set -u
OUT="$1"; SFX="$2"
mkdir -p "$OUT"
export PYTHONPATH=/opt/hatch/workflow-skills/custom-connector-setup/bin
CF=~/workspace/custom-connectors/custom.legacy-cloudflare/bin/cf-api
V2=~/workspace/custom-connectors/custom.opalreader-v2-prod/bin/v2prod-api
OP=~/workspace/custom-connectors/custom.opalreader-v2-prod-operator/bin/v2prod-operator-api
ACCT=b35ff435ff24d134ff640e0099dd13fc
QID=93b6a35fb8cf4788a91a2c90b748ae66
V1Q=e2706b79473d4ece90f37bd784c83386
H1="X-OpalReader-Scope: production"
H2="X-OpalReader-Instance: account"
TOOLS="$(cd "$(dirname "$0")" && pwd)"

date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/timestamp-$SFX.txt"

$V2 GET /health > "$OUT/health-$SFX.json" 2>&1
$CF GET "/client/v4/accounts/$ACCT/queues/$QID" > "$OUT/queue-$SFX.json" 2>&1
$CF GET "/client/v4/accounts/$ACCT/queues/$V1Q" > "$OUT/queue-v1-$SFX.json" 2>&1
$CF GET "/client/v4/accounts/$ACCT/workers/scripts/opalreader-api-v2-prod/settings" > "$OUT/bindings-$SFX.json" 2>&1
$CF GET "/client/v4/accounts/$ACCT/workers/scripts/opalreader-api-v2-prod/script-settings" > "$OUT/script-settings-$SFX.json" 2>&1
python3 "$TOOLS/cf_get_script.py" opalreader-api-v2-prod "$OUT/script-prod-$SFX.bin" "$OUT/script-prod-$SFX.meta.json" > "$OUT/script-prod-$SFX.log" 2>&1
python3 "$TOOLS/cf_get_script.py" opalreader-api "$OUT/script-v1-$SFX.bin" "$OUT/script-v1-$SFX.meta.json" > "$OUT/script-v1-$SFX.log" 2>&1
python3 "$TOOLS/cf_get_script.py" opalreader-api-v2 "$OUT/script-staging-$SFX.bin" "$OUT/script-staging-$SFX.meta.json" > "$OUT/script-staging-$SFX.log" 2>&1

$V2 GET "/v2/generation/capabilities" --header "$H1" --header "$H2" > "$OUT/capabilities-$SFX.json" 2>&1
$V2 GET "/v2/settings" --header "$H1" --header "$H2" > "$OUT/settings-$SFX.json" 2>&1
$V2 GET "/v2/quota" --header "$H1" --header "$H2" > "$OUT/quota-$SFX.json" 2>&1
$V2 GET "/v2/d6-plans" --header "$H1" --header "$H2" > "$OUT/plan-list-$SFX.json" 2>&1
$V2 GET "/v2/d6-plans/plan:3183ecbf2ac4bf50bbc6166e" --header "$H1" --header "$H2" > "$OUT/plan-smoke-$SFX.json" 2>&1
$V2 GET "/v2/d6-plans/plan:603ab416bd67ab1b25de97be" --header "$H1" --header "$H2" > "$OUT/plan-ch2-$SFX.json" 2>&1
$V2 GET "/v2/d6-plans/plan:b2dc2a3d1cd367a0245b9102" --header "$H1" --header "$H2" > "$OUT/plan-ch2fresh-$SFX.json" 2>&1
$V2 GET "/v2/jobs/1832c21fcf0425454227c4736048a8a632f422abca4a2685ddb775bb1681406a" --header "$H1" --header "$H2" > "$OUT/job-ch3-$SFX.json" 2>&1
$V2 GET "/v2/jobs/plan:3183ecbf2ac4bf50bbc6166e:seg" --header "$H1" --header "$H2" > "$OUT/job-smoke-$SFX.json" 2>&1
$V2 GET "/v2/jobs/plan:603ab416bd67ab1b25de97be:ch1" --header "$H1" --header "$H2" > "$OUT/job-ch2-$SFX.json" 2>&1
$V2 GET "/v2/conflicts" --header "$H1" --header "$H2" > "$OUT/conflicts-$SFX.json" 2>&1
$V2 GET "/v2/sync/snapshot?family=content" --header "$H1" --header "$H2" > "$OUT/snap-content-$SFX.json" 2>&1
$V2 GET "/v2/sync/snapshot?family=bindings" --header "$H1" --header "$H2" > "$OUT/snap-bindings-$SFX.json" 2>&1
$OP GET "/v2/d6-diagnostics?planId=plan%3A3183ecbf2ac4bf50bbc6166e" --header "$H1" --header "$H2" > "$OUT/diag-smoke-$SFX.json" 2>&1
$OP GET "/v2/d6-diagnostics?planId=plan%3A603ab416bd67ab1b25de97be" --header "$H1" --header "$H2" > "$OUT/diag-ch2-$SFX.json" 2>&1
$OP GET "/v2/d6-diagnostics?planId=plan%3Ab2dc2a3d1cd367a0245b9102" --header "$H1" --header "$H2" > "$OUT/diag-ch2fresh-$SFX.json" 2>&1
echo "capture $SFX done -> $OUT"
