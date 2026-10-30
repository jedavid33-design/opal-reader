# Step D4 — post-state verification: PASS (capture 2026-10-30T20:53:45Z)
- Parts: all 27 module parts of the deployed script byte-identical to
  the validated envelope (parts-verification.json). The GET script
  representation returns module parts only (no metadata part); metadata
  effects proven by the D2 PUT response + GET /settings bindings
  read-back. Download etag 72a4ee81... == D2 PUT etag.
- Canonical assessment (assess-d4.json) identical to D0 (assess-s2.json)
  on every compared value except health.build (f3b6e6e9 -> 28850807)
  and the script etag/bytes — i.e. queue PAUSED, settings rev 1, quota
  unchanged, watermarks 18/1800, plans/diagnostics/grants/conflicts/
  neighbors all unchanged; Ch 2 halted_unknown intact; Ch 3
  parked_policy + fingerprint b991f18a...282 exact.
- Per C3: no playback smoke claimed; D4 proves identity + containment.
