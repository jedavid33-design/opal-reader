#!/bin/bash
cd ~/workspace/ch2-program/gate-c-rearm/execution
date -u +%Y-%m-%dT%H:%M:%SZ > evidence/window-r4-start.txt
sleep 900
bash tools/capture.sh evidence r4mid >/dev/null 2>&1
export PYTHONPATH=/opt/hatch/workflow-skills/custom-connector-setup/bin
~/workspace/custom-connectors/custom.opalreader-v2-prod/bin/v2prod-api GET "/v2/jobs/plan:b2dc2a3d1cd367a0245b9102:ch1" --header "X-OpalReader-Scope: production" --header "X-OpalReader-Instance: account" > evidence/job-ch2fresh-r4mid.json 2>&1
date -u +%Y-%m-%dT%H:%M:%SZ > evidence/window-r4-mid-done.txt
sleep 960
bash tools/capture.sh evidence r4end >/dev/null 2>&1
~/workspace/custom-connectors/custom.opalreader-v2-prod/bin/v2prod-api GET "/v2/jobs/plan:b2dc2a3d1cd367a0245b9102:ch1" --header "X-OpalReader-Scope: production" --header "X-OpalReader-Instance: account" > evidence/job-ch2fresh-r4end.json 2>&1
date -u +%Y-%m-%dT%H:%M:%SZ > evidence/window-r4-end-done.txt
echo R4_WINDOW_DONE
