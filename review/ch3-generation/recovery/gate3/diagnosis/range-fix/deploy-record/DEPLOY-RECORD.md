# EXECUTION RECORD — Range-fix HELD DEPLOYMENT: ALL PASS, ends HELD, exactly 1 mutation

**Executed 2026-11-01, 16:55:42Z → ~16:59:00Z**, under the
amended deployment proposal (Amendment 1) — pin
`6d533dfea25034091084cb0629a049688301c823` (repo
`jedavid33-design/opal-reader`, branch `ui1-review`; document
SHA-256
`f0f68401e151258f4dc1321017f78a0bce0318d486d0250af99c45f87cebf4f9`).

**Authorization chain:**
- Rowan FINAL PROPOSAL REVIEW PASS (documentary, conditional
  on executor preflight + exact identity checks): board
  comment **6560945443** (issue #15,
  `jedavid33-design/opal-roundtable`).
- **Julie's GO** (button tap in chat, Nov 1, 2026 ~11:54 a.m.
  ET; "GO — deploy the range-fix (held, one upload)"),
  recorded on the board before any production step: comment
  **6560982620**, Handoff ID RT-H-20261101-9c41a7.
- Candidate build: `1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`.
  Operative envelope: 1,438,980 bytes, SHA-256
  `3508d1bf722a426f7332afbdadcc2012cbd8271d35e5b8a4e1758b5eb850ac8c`,
  31 parts. Live build replaced:
  `408f91497131a151a199b3f9ec4cbb283a8febd5`.

**Outcome in one paragraph:** the fresh census passed every
item with zero deviations; the envelope re-assembled
byte-for-byte; exactly **one** worker upload was made; all 31
deployed parts verified byte-for-byte against the pinned
manifest; observability survived the upload (the conditional
PATCH was **not** needed); all six operator routes refused
credential-less probes; and the read-back set establishes both
protections — **the gate ENDS HELD**, certified per §4.3.
Mutations spent: **1 of 1** (+0 of 1 conditional). **$0
spent.** No preview, no finalizer call, no re-arm, no
generation.

## D0 — Fresh preflight census (§4): ALL PASS, zero deviations

Census window 2026-11-01T16:55:42Z → 16:57:28Z. All reads
HTTP 200. Evidence: `deploy-execution/evidence/` (18 census
captures, files `c*.json`). **Census evidence digest**
(SHA-256 over the sorted sha256sum listing of the 18 census
captures): `006add6bec1770fcb1f8dadef97f9df103f901ae144d21a88ac308ce6160417d`.

1. **Health** — build
   `408f91497131a151a199b3f9ec4cbb283a8febd5`, generation
   `halted`, coordinator `armed`, scope `production`, ok
   true. Supporting check (Gate 3 pattern): the live script
   parsed to **30/30 parts byte-identical** to the Gate 2D
   operative manifest, no extras.
2. **Held-state bindings** — cf-api `/settings`: exactly
   **10 bindings**; `GENERATION_HALT` text `"1"`;
   `OPALREADER_PHASE_POLICY "enforce"`. Script etag captured:
   `7b4081f6c50702774b20bb359443368fdc1af549171c5f4afdbcd8a0233202a2`
   (1,430,356 B) — identical to the Gate 3 census etag.
3. **Queue** — `delivery_paused: true`; sole consumer
   `f260f2188d80426bb0588685e9d084eb`; retention 86,400 s.
4. **Conflicts — EXACT-MATCH** against the §4.1 baseline
   (pin `9284f5ef`): exactly the four rows — id 1
   @2026-10-29T23:54:14.808Z
   `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full`; id 2
   @2026-10-30T00:24:14.632Z
   `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`; id 3
   @2026-10-31T05:14:24.089Z
   `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full`; id 4
   @2026-11-01T01:04:30.364Z
   `grant:plan:e377a5559961b294154276b6:ch2:1:full`; all
   cache_key `lease`, expected `7`, found "LIKE or GLOB
   pattern too complex: SQLITE_ERROR", reason
   `schedule_dead`. No addition, deletion, or field change.
5. **Plan** — `plan:e377a5559961b294154276b6` `active`,
   totals eligible 23 / done 8 / failed 0. Parked Chapter 3
   job `1832c21f…` still `parked_policy` rev 1. Chapter 3 job
   `generating` rev 2 with exactly one grant:
   `grant:plan:e377a5559961b294154276b6:ch2:1:full`,
   **`issued` rev 2**. Eligibility (advisory): 15 eligible /
   11 bound / 1 parked, digest `9453ab5dc7ee…` — identical to
   the Phase A closing figures.
6. **Quota reconcile** — `ok: true`, drift empty, guard
   armed, `currentDayBlocked: false`, `censusComplete:
   true`, nothing truncated (pagination completeness
   satisfied on the single complete page); sole exception
   the known adjudicated straddler
   `att-37d63768-db4b-447d-8150-580b7c6ee257`
   (`estimated_unverified`). PT day totals: 2026-10-29 = 57,
   2026-10-30 = 79, 2026-10-31 = dispatched 44 / reserved 52
   / consumed 96; census day 2026-11-01 = 0/0/0.
7. **Phase accounting** — exact on BOTH surfaces
   (capabilities + diagnostics): settled **732,303**;
   estimatedUnverified **19,018**; reservedUnverified
   **5,648**; unknownOpen **0**; remaining **12,762,049** of
   13,500,000; `unverifiedStatus: provider_unverified`.
   Per-plan settled sums to 732,303 across the four
   forever-pucked plans. Grant `issued` rev 2 (item 5).
8. **Bindings check** — the 8 Phase A bindings (sync seq
   1819–1826) each carry **revision_key == cache_key**: 8/8
   PASS (structural metadata only).
9. **Settings + watermarks** — settings revision **1** (lane
   standard, cap $50); sync high watermarks bindings
   **1826** / content **18**, zero changes since either.
10. **Observability pre-check** — `/script-settings`:
    observability enabled + persisted (logs enabled,
    persist true) — the baseline for D5.

No item differed from its expectation. The STOP law was
never triggered.

## D1 — Verify-held reads: PASS

By the census read-backs themselves: `GENERATION_HALT` is
`"1"` already and the queue's `delivery_paused` is `true`
already. This gate performed **zero** hold mutations, as
designed.

## D2 — Re-assembly identity check (local): PASS

The pinned assembler
(`tools/assemble-rangefix-envelope.mjs`) re-run with
`--pin 1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867` against the
range-fix tree: **10/10 checks PASS**; reproduced envelope
1,438,980 bytes, SHA-256
`3508d1bf722a426f7332afbdadcc2012cbd8271d35e5b8a4e1758b5eb850ac8c`,
31 parts — byte-identical (`cmp`) to the pinned operative
envelope. Log: `deploy-execution/assembly-check.log`.

## D3 — ONE worker upload (mutation 1 of 1): PASS

Multipart PUT of the pinned operative envelope to
`opalreader-api-v2-prod` (boundary
`----opalreader-final-envelope-d1`; metadata as assembled —
`main_module` set, secrets inherit, compatibility preserved)
at **2026-11-01T16:58:05Z**: **HTTP 200, `success: true`**,
no errors. Exactly one upload attempt was made.

## D4 — Post-upload byte verification: PASS

Deployed script fetched via cf-api (new etag
`f15fb1ae40f870fc4493f3499db0b096c4d801b9fff8d20fe5538d84c69c82ed`,
1,435,756 B) and parsed: **31/31 parts byte-identical** to
the §1.2 operative manifest, **zero extras, zero
mismatches**. (The GET-script response carries module parts
only; deployed-metadata equivalence is established by the
post-upload `/settings` read: exactly 10 bindings with
`GENERATION_HALT "1"` — see D5/D7.)

## D5 — Observability check: SURVIVED — no PATCH spent

Post-upload `/script-settings`: observability enabled +
persisted, identical to the census baseline. The upload did
**not** reset it, so the conditional observability-only
PATCH was **not** performed. Mutation count remains **1**.

## D6 — Denied probes: PASS (6/6)

Credential-less probes of all six operator routes refused
**HTTP 403 `migration_operator_required`**: `POST
/v2/d6-release-park`, `POST /v2/d6-revoke-park-release`,
`POST /v2/d6-exempt-chapter-occurrence`, `POST
/v2/d6-revoke-chapter-exemption`, `GET
/v2/d6-grant-finalization-preview`, `POST
/v2/d6-finalize-grant`. Probes only; no valid operator call
was made to any of the six routes in this gate.
Transparency note: a first probe set sent *without* the
(non-credential) scope headers refused HTTP 403
`production_scope_required` — the scope fence firing first;
the probes were re-run with scope headers and produced the
operator-fence refusal above. Both sets are in evidence
(`d6-probe-*.json`, `d6b-probe-*.json`).

## D7 — Read-back set: ALL PASS — ENDS HELD certified

- `/health`: build
  **`1c2d1d0fa7ebb769f68cfb327fb9fde7d4d30867`**, generation
  **halted**, coordinator armed.
- Queue: `delivery_paused: true` (cf-api read-back).
- Conflicts: still **EXACT-MATCH** to the §4.1 baseline.
- Grant: still `issued` rev 2; Chapter 3 job still
  `generating` rev 2.
- Plan: still `active`, 23 / 8 / 0.
- Phase figures: unchanged (732,303 / 19,018 / 5,648 / 0 /
  12,762,049).
- Watermarks: bindings 1826 / content 18, zero movement.
- Settings: revision 1.

Both protections are evidenced by read-backs —
`GENERATION_HALT "1"` in place **and** queue
`delivery_paused: true` — so per §4.3 the record certifies:
**the gate ENDS HELD**, the Generate button is NOT live, and
the finalizer remains dormant on the new build exactly as on
the old.

## Totals and attestations

- **Mutations: exactly 1** (the D3 upload). Conditional D5
  PATCH: not needed, not spent. No hold mutations (D1).
- **Spend: $0.** No generation, no provider calls, no valid
  preview, no finalizer action, no park release, no
  exemption write, no conflicts row touched.
- **Deviations: none.** No STOP fired at any step.

## What this does and does not prove (§10 honesty)

This deploy proves exactly two things: the range-fix code is
live byte-for-byte as pinned (`1c2d1d0f…`, 31 parts), and the
held state and all protected figures survived the swap. It
does **not** prove the preview succeeds on the new build, and
it does not establish the cause of the Gate 3 preview 500 —
H1 remains a supported hypothesis, not proven. A Gate 3
retry (preview → E3.5 → one finalizer call) needs its own
fresh proposal, Rowan review, and Julie GO; re-arm and
Gate 4 likewise remain separately gated.

— Wren
