# Step D1 — identity + envelope re-validation: PASS (no production contact)
- ui1-review head re-read at execution time: cf89a2e88c1b61b8e43b1981bd2389a5b314cf10
  (the proposal pin; sole parent 288508073b5218a6e0dd90b68d497a331ad872b6, the
  reviewed fence identity) — lineage exactly as proposal section 1.
- Envelope harness re-run against the combined tree (local copy in this dir):
  PASS 18/18 (proof-pass.log). Envelope SHA-256 =
  9c5f1ce4103dea7d07099f2332c954cdecd25c299e12f14077ccf9b9033ff21a — EXACT match
  to the approved value. Metadata SHA-256 e08b06bc840810739ef5a2fbd5279c6670c1759235fa830121964507f162a9fd.
  28 multipart parts total (metadata + 27 modules), envelope 1,224,335 bytes.
- Negative mutations each FAIL validation (exit 1): drop-seventh (E7,E8,E9,E10),
  typo-enforce (E8,E9), wrong-entry (E2). Logs in this dir.
- Adversarial spoofed-planId / fence suite re-run against the LOCAL combined
  tree (tests/ch2fix-rearm-fence.test.mjs): 29/29 PASS, exit 0 (fence-suite.log).
  Tree file hashes match the reviewed pin declarations: suite 07ff78bd44c...,
  executor worker/generation/d6-executor.mjs 68e3f84ed6... (the hash Rowan
  cited in her operational-plan PASS).
- C3 note: the harness E17 log line's parenthetical "(spec value; the live
  \"0\" ...)" is stale descriptive wording carried from the Gate-1-era harness.
  The assembled metadata itself carries GENERATION_HALT "1", and the live
  binding also reads "1" (verified at Step P). Corrected here per C3; the
  compiled envelope contents are unchanged.
