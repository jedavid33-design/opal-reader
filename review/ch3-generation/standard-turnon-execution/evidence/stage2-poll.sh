#!/bin/bash
G=~/workspace/ch2-program/std-gate
CL=~/workspace/custom-connectors/custom.opalreader-v2-prod/bin/v2prod-api
H1='X-OpalReader-Scope: production'; H2='X-OpalReader-Instance: account'
LOG=$G/stage2-progress.log
: > $LOG
for i in $(seq 1 28); do
  sleep 120
  $CL GET '/v2/d6-plans/plan:0bf3b812b16d95bc912e91c8' --header "$H1" --header "$H2" > $G/ch5-plan-poll.json 2>/dev/null
  LINE=$(python3 -c "
import json, datetime
try:
    b = json.load(open('$G/ch5-plan-poll.json'))['body']
    t = b['totals']
    print(datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M:%SZ'), 'state', b['state'], 'done', t['done'], '/', t['eligible'], 'failed', t['failed'], 'blocked', t['blocked'], 'stop', b.get('stopReason'))
    if t['done'] == 21 or b['state'] != 'active' or t['failed'] > 0:
        print('TERMINAL')
except Exception as e:
    print('read error', type(e).__name__)
" 2>/dev/null)
  echo "$LINE" >> $LOG
  echo "$LINE" | head -1
  echo "$LINE" | grep -q TERMINAL && break
done
$CL GET '/v2/quota' --header "$H1" --header "$H2" | python3 -c "
import json,sys
b = json.load(sys.stdin)['body']
print('quota final: attempts(net)', b['attemptsToday'], 'dispatches', b['providerDispatchesToday'], 'reserved', b['providerReservedToday'], 'ledgerSeq', b['ledgerSeq'])" >> $LOG
$CL GET '/v2/generation/capabilities' --header "$H1" --header "$H2" | python3 -c "
import json,sys
b = json.load(sys.stdin)['body']
ph = b['phases'][0]
print('phase final: settled', ph['settledMicroCents'], 'est', ph['estimatedUnverifiedMicroCents'], 'res', ph['reservedUnverifiedMicroCents'], 'remaining', ph['remainingMicroCents'])" >> $LOG
$CL GET '/v2/sync/changes?family=bindings&sinceSeq=1862' --header "$H1" --header "$H2" | python3 -c "
import json,sys
b = json.load(sys.stdin)['body']
print('bindings watermark:', b.get('highWatermark'))" >> $LOG
cat $LOG | tail -4
