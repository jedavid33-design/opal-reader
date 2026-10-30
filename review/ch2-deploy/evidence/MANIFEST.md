# Evidence manifest — Combined Chapter 2 halted Worker deploy, post-deploy subset

**Purpose.** Minimal, redacted, reviewable evidence subset for Rowan's
independent closeout, requested in issue #15 comment 6533330426, of the
combined Chapter 2 halted Worker deployment executed 2026-10-30
20:41–20:54Z under Julie's one-attempt C1–C3 approval (comment
6533012361) and recorded in the execution record (comment 6533267319).

**Provenance.** Every artifact below is a copy (with only the redactions
listed here) of a capture made *during the completed run* and held
locally at `~/workspace/ch2-program/deploy/evidence/`. This publication
is evidence-only: no production operation was re-run, no code was
re-uploaded, and nothing in this subset is a new observation. Timestamps
are the original capture timestamps (UTC).

**Identities preserved (already public on the board).** Build stamp
`288508073b5218a6e0dd90b68d497a331ad872b6`; envelope SHA-256
`9c5f1ce4103dea7d07099f2332c954cdecd25c299e12f14077ccf9b9033ff21a`;
new etag `72a4ee815e01af5cd505c580999e73633bd355aceb8513f4e9b024eb526e4669`;
deployment id `ccb584808ab84132a6484d0627463515`; plan IDs
`plan:603ab416bd67ab1b25de97be` (Chapter 2) and
`plan:3183ecbf2ac4bf50bbc6166e` (smoke); Chapter 3 job ID and parked
fingerprint `b991f18ac058b96ff84deede2403bb6e856bcbd1c54b76b492ef55a89b56e282`;
queue/consumer IDs named in the filed records.

## Included artifacts, by requested item

### (i) Step P + D0 two-sample assessment + R precheck
- `stepP/STEP-P-RECORD.md` — Step P verify-and-hold narrative (sample =
  D0 sample 1, 2026-10-30T20:41:52Z).
- `stepP/health-s1.json`, `stepP/queue-s1.json` — raw read-backs at P.
- `stepP/bindings-s1.json` — raw GET /settings read-back at P.
  **Redacted:** the Durable Object `namespace_id` value (see Redactions).
  Secret bindings appear by name and type only — the source capture
  contains no secret values.
- `d0/D0-RECORD.md` — D0 narrative.
- `d0/timestamp-s1.txt` (20:41:52Z), `d0/timestamp-s2.txt` (20:52:19Z)
  — the two sample times, 10m27s apart.
- `d0/assess-s1.json`, `d0/assess-s2.json` — canonical closed-inventory
  assessments of both samples (identical on every compared value).
  These are assessor summaries: raw per-surface response bodies are
  represented by their `raw_sha` SHA-256 digests inside the assessment,
  so no raw account-private payload is republished.
- `d0/script-settings-s1.json` — pre-deploy observability baseline
  (companion to item iv).
- `r/assess-r.json`, `r/timestamp-r.txt` (20:52:45Z) — Step R pre-upload
  recheck assessment, identical inventory to D0.

### (ii) Step D1 — envelope identity, tests, negative mutations
- `d1/D1-RECORD.md` — D1 narrative (head re-read, harness re-run).
- `d1/proof-result.json` — envelope harness result: 18/18 checks PASS,
  envelope SHA-256 as above, 28 parts (metadata + 27 modules),
  1,224,335 bytes.
- `d1/proof-result-drop-seventh.json`, `d1/proof-result-typo-enforce.json`,
  `d1/proof-result-wrong-entry.json` — the three negative-mutation
  results, each failing validation as designed (E7–E10; E8/E9; E2).
- `d1/proof-pass.log` — full harness log incl. the 27-part table
  (part name, bytes, SHA-256, tree source).
- `d1/parts-manifest.json` — per-part bytes + SHA-256 + tree mapping.
- `d1/assembled-metadata.json` — the exact upload metadata part
  (bindings by name/type; the three secrets ride as
  `"type": "inherit"` — no values).
- `d1/fence-suite.log` — adversarial fence suite re-run on the pinned
  tree: 29/29 PASS.

### (iii) Step D2 — upload + read-backs
- `d2/D2-RECORD.md` — D2 narrative.
- `d2/queue-precondition.json` — queue read-back immediately before the
  PUT (`delivery_paused == true`, sole consumer unchanged).
- `d2/upload-start-utc.txt` (20:53:10Z), `d2/upload-end-utc.txt`
  (20:53:20Z) — the PUT window.
- `d2/put-response.json` — the PUT response: success, etag
  `72a4ee81…` and deployment id `ccb58480…` as above, entry point,
  handlers, compatibility preserved.
- `d2/health-after.json` — /health read-back: build
  `28850807…` (exact), generation "halted".
- `d2/bindings-after.json` — GET /settings read-back: exactly the 10
  expected binding names, `GENERATION_HALT "1"`,
  `OPALREADER_PHASE_POLICY "enforce"`. **Redacted:** `namespace_id`
  (see Redactions).

### (iv) Step D3 — observability, no PATCH
- `d3/D3-RECORD.md` — D3 narrative: observability survived; the
  conditional C1 PATCH was not performed; no settings edits of any kind.
- `d3/script-settings-after.json` — GET script-settings after the
  upload: observability enabled + logs enabled + persist true,
  identical in shape to the pre-deploy baseline
  (`d0/script-settings-s1.json`).

### (v) Step D4 — module comparison + post-state / paused queue
- `d4/D4-RECORD.md` — D4 narrative (capture 2026-10-30T20:53:45Z).
- `d4/parts-verification.json` — per-part comparison of the deployed
  script download against the validated envelope: all 27 module parts
  byte-identical (SHA-256 each). The 28th envelope part (`metadata`)
  is listed with `in_download: false` — the GET-script representation
  returns module parts only; the metadata's operative content is
  proven by `d2/put-response.json` and `d2/bindings-after.json`. This
  is the representation difference disclosed in the execution record,
  not a byte-check failure.
- `d4/assess-d4.json` — canonical post-state assessment: identical to
  D0 on every compared value except `health.build` and the script
  etag/bytes — settings revision 1, quota unchanged, watermarks
  18 / 1800, plans/diagnostics/grants/conflicts/neighbors unchanged,
  Chapter 2 `halted_unknown` intact, Chapter 3 `parked_policy` +
  fingerprint exact.
- `d4/queue-d4.json` — post-state queue read-back:
  `delivery_paused == true`, sole consumer unchanged.
- `d4/health-d4.json` — post-state /health read-back.
- `d4/timestamp-d4.txt` — D4 capture time (20:53:45Z).

## Redactions applied

1. `stepP/bindings-s1.json` and `d2/bindings-after.json`: the Durable
   Object binding's `namespace_id` value was replaced with `REDACTED`
   (an internal namespace identifier not needed for review; binding
   name, class name, and type preserved). No other field in either
   file was altered.
2. No other included artifact required redaction: the source captures
   contain no credentials, tokens, secret values, authorization
   headers, or cookies (secret bindings are recorded by name/type
   only, and the upload metadata carries them as `inherit`). The
   canonical assessor summaries were already redacted by construction
   (raw bodies represented by SHA-256 digest).

## Source artifacts deliberately NOT included

- Raw script downloads (`script-*.bin`, `assembled-envelope.bin`) —
  deployed/upload code bytes; identity is proven by the SHA-256 part
  tables in `d1/` and `d4/` instead of republishing ~1.2 MB of code
  that is already pinned as reviewed source.
- Raw snapshot bodies (`snap-content-*`, `snap-bindings-*`) — full
  content/bindings plane payloads (account-private); represented in
  the assessments by entity counts, watermarks, and `raw_sha` digests.
- Raw per-surface response bodies for plans/jobs/diagnostics/settings/
  quota/conflicts — represented by the canonical assessments
  (`raw_sha` per surface); structural IDs and all compared values are
  in the assessments themselves.
- Capture/upload helper scripts (`evidence/tools/`) — operator tooling
  containing account addressing and credential-handling code; not
  evidence of record.
- Download sidecar logs/metas (`script-*.log`, `*.meta.json`) —
  superseded by the etag/byte entries in the canonical assessments.
- The envelope proof harness script (`proof-ch2-envelope.mjs`) —
  tooling; its outputs (result JSONs + log) are included above.

## Verification performed before pinning
The final subset was grepped for token-shaped strings, `Bearer`,
`x-opalreader` headers, `authorization`, cookie keys, secret-value
shapes, and the Cloudflare account id. The only matches are binding
*names* (e.g. `OPALREADER_ACCESS_TOKEN`, `secret_text` type labels,
and the E10 check text stating secrets ride inherit-by-name) — no
values. The account id does not appear anywhere in the subset.

— Wren
