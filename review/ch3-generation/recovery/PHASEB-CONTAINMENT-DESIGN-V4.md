# Phase B — independent containment design, V4 (stop-record truth, episode law)

Design only. No production calls were made for this document.
**Supersedes** `PHASEB-CONTAINMENT-DESIGN-V3.md` (SHA-256
`ab83305a…`, pin `89dca999874d514d1152926312e30504b5e319a0`,
repo `jedavid33-design/opal-reader`, branch `ui1-review`) in
response to Rowan's V3 ruling (verdict: REVISE BEFORE GATE
APPROVAL; relayed verbatim by Julie in chat Nov 2, 2026; record
`ROWAN-CONTAINMENT-V3-RULING.md`). This revision answers
corrections **R1** (stop-record truth) and **R3** (retry
exhaustion) in the design; **R2** is answered in the companion
async analysis v4, **R4/R5** in the gates v4, **R6** in the
identities record and the risk register.

**Carried from v3 unchanged** (accepted as direction by the
ruling; restated here only by reference so this document stays
the operative text): the three-state core — one singleton
enumerated state **NORMAL / DRIVE_CONTAINED / CHAIN_STOPPED** —
the transition table and its verified-read preconditions, the
fail-closed gate rules (`containmentDriveSuppressed` /
`containmentArmSuppressed`, darker branch on any unverified
read), the effects matrix (v3 design §4, as amended by §5
below), the reason-required audited clear, and the restoration
policy (v3 design §5, as amended by §6 below). The v3 stop
record's separation of three stored facts — (i) the enum,
(ii) the physical verification record, (iii) the stop-
verification status — is retained and extended, not replaced.

## 1. What changes in v4

1. **A fourth, DERIVED display value** — CURRENT PHYSICAL
   CONFIDENCE (§2) — computed read-side from the stored record
   plus a fresh registration read. It is never stored, never
   written by any transition, and it is the only value a
   surface may present as "how stopped is it now."
2. **Episode bookkeeping for the exhaustion law** (§4): the
   stop episode is keyed by its `stop_chain` audit-event id;
   exhaustion is durable state plus an audit event; a clear
   CLOSES the episode and preserves its summary in the record
   (`prevEpisode*`) instead of erasing it.
3. **Two narrowed claims**: the v3 code comments and design
   text that spoke of "the last physical act wins" are
   withdrawn and replaced (async analysis v4 §3 lists them by
   name; the v4 candidate's comments carry the narrowed text).
4. **Failed registration reads are no longer collapsed to
   "absent"** on either read surface: a surface that cannot
   read the registration says so, and the derivation degrades
   accordingly (§2.3).

## 2. The stop record — truth model (R1)

### 2.1 The reconciliation Rowan asked for

The v3 record conflated two different claims in one displayed
status: "we once verified a stop" (a historical fact) and "it
is stopped now" (a present physical claim). V4 separates them
permanently:

- **The ENUM never downgrades.** Once `CHAIN_STOPPED` is
  committed, no read failure, retry outcome, or later evidence
  moves it except an authorized `clear`. (V3 claim, retained.)
- **CONFIDENCE is not the enum, and degrades freely.** The
  displayed confidence is a derived value that must move to a
  named weaker value on ANY later evidence that weakens the
  present-tense claim: a later surviving registration, a failed
  or unverifiable read, or a failed re-verification after an
  earlier success.
- **The last-successful-verification fact is immutable.**
  `stopVerifiedAt` / `stopVerifyAction` / `stopArmedBefore` /
  `stopArmedAfter` record the most recent SUCCESSFUL
  verification and are never erased or overwritten by a later
  failure (v3 behavior, retained). A later failure changes
  `stopStatus` (to `unverified`) and therefore the derived
  confidence — it does not rewrite history.

### 2.2 Where the derivation lives, and why

**Read-side derivation.** Confidence is computed by a pure
exported function, `deriveStopConfidence(read, fresh)`, in
`coordinator.mjs`:

- `read` — the stored record as returned by
  `readContainmentState` (enum, `stopStatus`, `stopVerifiedAt`,
  the read's own `verified`/`known` flags).
- `fresh` — the CALLING SURFACE's own registration observation
  made during that same request, one of
  `{kind:"value", armed:<number|null>}` (a `getAlarm()` that
  returned), `{kind:"failed"}` (the read threw), or
  `{kind:"unavailable"}` (the surface made no fresh read).

Justification for read-side over a stored field: (a) the
evidence that degrades confidence — a later surviving
registration — is observed BY reads, not by transitions; a
stored field could only be updated by adding writes to read
paths, which the design forbids (reads never write; v3 §2.2,
CT1). (b) A stored field can go stale in exactly the silent
way R1 prohibits; a derivation is recomputed from the record
plus the freshest observation at every display. (c) The two
display surfaces already each perform a `getAlarm()` read in
the same request (the diagnostics projection and the
containment GET), so the fresh input costs no extra platform
call. The derivation writes nothing; `containmentConfidence`
(the coordinator method wrapping it) is a pure read.

Surfaces computing it (both changed in the v4 candidate):
`generation/service.mjs` `drivePassDiagnostics` (the `drive=1`
projection) and the entry's `GET /internal/d6/containment`
(served publicly as `GET /v2/d6-containment`). Both now track
whether their `getAlarm()` read FAILED and pass
`{kind:"failed"}` in that case; v3 collapsed a failed read to
`armedAt = null`, which would have mis-derived
`verified_current` — that collapse is removed.

### 2.3 The truth table (the proof artifact)

Displayed confidence for every combination of {enum} × {last
verification outcome (the stored record)} × {later evidence
(the fresh input)}. "Verified" below means `stopStatus` ∈
{`verified`, `re_verified`} with `stopVerifiedAt` set;
"unverified-never" means `stopStatus` = `unverified` (or null)
with `stopVerifiedAt` null; "failed-after-success" means
`stopStatus` = `unverified` with `stopVerifiedAt` set (a later
`verify_chain_stop` failed after an earlier success — the
failure write preserves `stopVerifiedAt`, §2.1).

| # | Enum | Stored record | Later evidence | Displayed | Why this wording, and no stronger |
|---|------|---------------|----------------|-----------|-----------------------------------|
| 1 | NORMAL / DRIVE_CONTAINED | any | any | `not_applicable` | No stop exists; a confidence claim would be meaningless, not reassuring. |
| 2 | any | record unreadable (`verified:false`/`known:false`) | any | `unknown` | An unreadable record supports no claim at all — not even applicability. |
| 3 | CHAIN_STOPPED | verified | fresh read: `armed = null` | `verified_current` | A recorded success AND this derivation's own fresh observation agree: the strongest claim the evidence supports. |
| 4 | CHAIN_STOPPED | verified | fresh read: `armed = <number>` | `contested` | A registration physically survives NOW; the historical success cannot be displayed as a present stop. |
| 5 | CHAIN_STOPPED | verified | fresh read failed | `unknown` | A failed read is not an observation of absence; claiming currency on it would repeat the v3 conflation. |
| 6 | CHAIN_STOPPED | verified | no fresh observation | `verified_recorded` | The record supports "verified then"; with no fresh read, "current" would be an upgrade beyond the evidence. |
| 7 | CHAIN_STOPPED | unverified-never | fresh read: `armed = null` | `unverified` | Absence observed now, but no verification has ever succeeded; the stop ACT remains unverified even though the present fact looks stopped. |
| 8 | CHAIN_STOPPED | unverified-never | fresh read: `armed = <number>` | `contested` | A surviving registration is positive evidence against the stop, whatever the record says. |
| 9 | CHAIN_STOPPED | unverified-never | fresh read failed | `unknown` | No successful verification and no usable fresh evidence: nothing displayable beyond ignorance. |
| 10 | CHAIN_STOPPED | unverified-never | no fresh observation | `unverified` | Exactly what the record says, no more. |
| 11 | CHAIN_STOPPED | failed-after-success | fresh read: `armed = null` | `unknown` | The LAST action on the record failed; re-asserting currency from an incidental read would silently forgive that failure. (Deliberately darker than row 3.) |
| 12 | CHAIN_STOPPED | failed-after-success | fresh read: `armed = <number>` | `contested` | As row 8: present physical evidence dominates. |
| 13 | CHAIN_STOPPED | failed-after-success | fresh read failed | `unknown` | A failure on top of a failure. |
| 14 | CHAIN_STOPPED | failed-after-success | no fresh observation | `unknown` | The most recent recorded outcome is a failure; "verified_recorded" would misstate which outcome is latest. Only a successful `verify_chain_stop` restores a verified display. |

**Proof by construction.** `deriveStopConfidence` is a total
function over exactly these inputs, and its control flow IS
the table: (1) unreadable record → `unknown` before anything
else; (2) non-stopped enum → `not_applicable`; (3) a failed
fresh read → `unknown`; (4) in the fresh-value branch, a
non-null registration returns `contested` BEFORE any verified
check — present physical evidence dominates every stored
claim; (5) the only paths to a `verified_*` value pass through
`stopStatus` ∈ {`verified`, `re_verified`}, i.e. a recorded
successful verification, and `verified_current` additionally
requires the fresh null in the same derivation; (6) the
failed-after-success shape is checked before the plain
unverified return, so it can never fall through to a verified
or plain-unverified display. No input combination reaches a
value stronger than its row. Battery CT14a evaluates the
exported function on every row (and every non-stopped
combination); CT14b/CT14c exercise the surfaces end-to-end,
including degradation by a later surviving registration and by
a failed read, with the enum and `stopVerifiedAt` asserted
unchanged throughout.

### 2.4 Read surfaces (delta)

Both surfaces now project, in addition to the v3 fields:
`stopEpisodeId`, `stopEpisodeExhausted`, `prevEpisodeId`,
`prevEpisodeAttempts`, `prevEpisodeExhausted`,
`prevEpisodeClosedAt`, `stopConfidence` (§4 for the episode
fields). No surface may display `stopStatus` alone as a
present-tense claim; the gates and any future UI copy must use
`stopConfidence` for the present tense and the
`stopVerified*` fields, labeled as history, for the past.

## 3. `verify_chain_stop` (carried, one change)

The mechanism is v3 §3 unchanged — observe first, delete only
a registration actually observed, success only from an actual
`getAlarm()` read-back of null, failure never downgrades the
enum and never erases the last-success record — with ONE
change: the attempt that reaches the bound unverified now
also records the episode EXHAUSTED durably (state flag +
audit event), in the same transaction as the attempt's record
write (§4). The refusal path remains write-free; if it ever
encounters attempts ≥ bound with the exhausted flag unset
(a state the write paths cannot produce), it records the
exhaustion defensively, once, rather than leaving it
unrecorded.

## 4. Episode and exhaustion law (R3)

### 4.1 Definitions

- An **episode** is one stop: it begins at a `stop_chain`
  transition and is keyed by that transition's audit-event row
  id (`stopEpisodeId`, captured from `last_insert_rowid()` in
  the committing transaction). The episode covers the
  `stop_chain` act (attempt 1) plus any `verify_chain_stop`
  attempts against the same stop.
- `MAX_STOP_VERIFY_ATTEMPTS = 3` per episode (provisionally
  accepted by the ruling; unchanged).
- An episode is **EXHAUSTED** when its attempts reach the
  bound without a successful verification.

### 4.2 Storage and lifetime

State-row columns (v4 additions): `stop_episode_id`,
`stop_episode_exhausted` (0/1), and the closed-episode summary
`prev_episode_id`, `prev_episode_attempts`,
`prev_episode_exhausted`, `prev_episode_closed_at`. Audit
events: `stop_episode_exhausted` (appended in the same
transaction as the attempt that reaches the bound) and
`stop_episode_closed` (appended inside the clear transaction,
detail carries episodeId, attempts, exhausted, final
`stopStatus`, and the clear's reason).

**A clear does not reset anything informally.** The clear's
committing transaction FIRST copies the current episode's
summary into `prevEpisode*` and appends `stop_episode_closed`,
and only then resets the current-episode fields — atomically,
so no interleaving can observe a reset record without the
preserved summary. (Implementation note: v3 performed the
stop-record reset as a separate write AFTER the clear commit;
v4 moves it inside the commit transaction. The behavior the
v3 battery asserted is unchanged; the atomicity is new.)
After a clear, the exhausted episode remains disclosed on
every read surface via `prevEpisode*` indefinitely (until a
later clear overwrites the summary with a newer episode's —
the audit trail itself is append-only and permanent).

### 4.3 What the code enforces vs what the paperwork carries

| Rule | Enforced by |
|------|-------------|
| Attempts stop at the bound; a refused verify performs no physical act and appends nothing | CODE (`_verifyChainStop` + the stop act's own bound handling; CT11d, CT15a, CT15c) |
| Exhaustion is durably recorded (flag + audit) at the moment the bound is reached | CODE (CT15a) |
| The counter/summary survives a clear; the exhausted episode stays disclosed | CODE (CT15b) |
| Verify refuses on an exhausted episode even if the physical fault later clears | CODE (CT15c) |
| A NEW stop mints a NEW episode only via a new `stop_chain` transition | CODE (episode id is minted only in the `stop_chain` commit path) |
| An exhausted episode may NOT be circumvented by clear + re-stop: further verification after exhaustion requires a fresh Rowan ruling + fresh Julie authorization under the gates' R3 micro-scope, and restoration paperwork must disclose `prevEpisodeExhausted` and name the exhausted episode | PAPERWORK (gates v4). The code cannot distinguish a circumvention re-stop from a legitimate new stop — the surfaces expose exactly the fields the paperwork must check (`prevEpisodeId/Attempts/Exhausted`), and the gates make presenting a re-stop as a fresh budget a stated violation |

## 5. Effects matrix (delta only)

The v3 §4 matrix stands. Added rows:

| activity | NORMAL | DRIVE_CONTAINED | CHAIN_STOPPED |
|---|---|---|---|
| confidence derivation (`containmentConfidence`) | returns `not_applicable`; no writes | same | derived per §2.3; no writes |
| episode summary on clear | n/a (no episode) | n/a | closed + preserved in the SAME transaction as the state write (§4.2) |

## 6. Restoration policy (v3 §5, plus the R3 disclosure)

V3 §5 stands (no automatic clear anywhere; NORMAL return only
via an explicit standalone authorization, a fresh census, and
a demonstrated reason; separate paths per state). One
addition, from R3: **any restoration request out of
CHAIN_STOPPED must disclose the current AND previous episode
summaries** (`stopEpisodeId/Exhausted`, `prevEpisode*`) and,
if either is exhausted, must name the R3 micro-scope
authorization (gates v4) under which any subsequent stop/
verify work would proceed. A restoration that omits an
exhausted episode is incomplete on its face.

## 7. Race posture (narrowed; async analysis v4 governs)

The post-await gate re-check in `_armAlarmIfEarlier` is
retained exactly as v3 built it (the ruling accepted it as an
appropriate correction). What v4 changes is the CLAIM: v3's
design sentence "the LAST PHYSICAL ACT wins" is **withdrawn**
(async analysis v4 §3). The narrowed posture: the re-check
guarantees at the JS level that a wake resuming after its
`getAlarm()` await does not INITIATE a registration when the
gate — re-read in the same synchronous stretch — says
suppressed; the stop act's own verification rests on its
read-back, not on ordering; and any residual divergence
between the record and physical reality (e.g., a registration
whose platform effect lands after a verified delete) is not
claimed prevented — it is DETECTED at the next read by the
§2 derivation (`contested`) and carried as an explicit
unresolved platform-ordering risk (register R-02). The
finally re-arm trace (v3 analysis §4.1) is re-stated in the
same narrowed terms in analysis v4 §5.

## 8. Battery mapping (v4)

Containment battery v4 = the v3 battery (32 tests, adaptations
as disclosed in its header) plus: **CT14a** the truth table,
cell by cell, against the exported derivation; **CT14b** a
verified stop displays `verified_current`, then a later
surviving registration degrades it to `contested` with enum
and `stopVerifiedAt` intact; **CT14c** an unverified stop
never displays a verified value, and a failed registration
read degrades a verified stop's display to `unknown`;
**CT15a** exhaustion recorded (flag + exactly one audit event)
at the bound, refusal write-free; **CT15b** clear closes the
episode, summary persists, new stop mints a new episode,
exhausted history still disclosed on the surface; **CT15c**
verify still refuses on the exhausted episode after the
physical fault clears, with zero delete attempts; **CT16a–c**
the C3 ledger dry-run (gates v4). Full results in the
identities record: containment 41/41 on both v4 trees, P2
32/32 on both, R5a 23/23 on the composed tree, all exit 0.

## 9. Open items for Rowan's ruling

1. The truth table's row 11 choice (failed-after-success +
   fresh null → `unknown`, deliberately darker than row 3):
   accepted, or should a fresh null restore `verified_current`
   despite the failed action? (Design position: no — the
   failed action is the latest recorded outcome; only a
   successful verify restores a verified display.)
2. The code/paperwork split in §4.3 — in particular that the
   anti-circumvention rule is paperwork-enforced, with the
   surfaces exposing `prevEpisode*` as the check.
3. `MAX_STOP_VERIFY_ATTEMPTS = 3` remains provisional (the
   ruling's position; unchanged).
4. Whether `stopConfidence` should also ride the transitions
   ledger's operator responses in a future package (v4 adds it
   to the two read surfaces only; transition RESPONSES already
   carry the full state read).
