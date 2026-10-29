// D6 WS-1 — settings reconciliation mechanism (proposal §6.6,
// Amendment A-1 Q2). The geminiLane tension: production settings
// read {"monthlyCap":50,"geminiLane":"batch","revision":0}, and a
// Standard-only case cannot arm against a record that names batch.
//
// This module is the MECHANISM ONLY: a revision-checked
// compare-and-swap issued as a SetSettings command conditioned on
// baseRevision EXACTLY 0, changing exactly the lane (the monthly cap
// is untouched — SetSettings merges over the current record). If
// the current revision is anything other than 0, the coordinator
// rejects with settings_conflict and the record is left untouched —
// a stale revision is never overwritten.
//
// It is executed at the ARMING step, not in the halted deploy, and
// is never called outside tests in this build: arming is Julie's
// separate gate. The command outcome is returned verbatim.
export async function reconcileGeminiLaneForArming(coord, commandId) {
  return coord.handleCommand({
    command_id: commandId,
    type: "SetSettings",
    payload: { baseRevision: 0, data: { geminiLane: "standard" } },
  });
}
