# Step D2 — upload: PASS
Precondition (queue-precondition.json): delivery_paused == true, sole
consumer f260f2188d80426bb0588685e9d084eb. Envelope SHA-256 re-verified
immediately before upload: 9c5f1ce4103dea7d07099f2332c954cdecd25c299e12f14077ccf9b9033ff21a.
PUT window 2026-10-30T20:53:10Z -> 20:53:20Z. Response (put-response.json):
HTTP 200, success true, errors []. New etag
72a4ee815e01af5cd505c580999e73633bd355aceb8513f4e9b024eb526e4669,
deployment_id ccb584808ab84132a6484d0627463515, entry_point
v2/worker-entry-prod-d6.js, handlers [fetch, queue], compatibility
2026-08-29 + nodejs_compat. Read-backs: health-after.json build ==
288508073b5218a6e0dd90b68d497a331ad872b6, generation "halted";
bindings-after.json exactly 10 names, GENERATION_HALT "1",
OPALREADER_PHASE_POLICY "enforce". C2 not engaged (unambiguous 200).
