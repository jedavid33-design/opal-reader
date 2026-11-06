# Phase B — Gate C3: BRANCH-(d) RECONCILIATION AMENDMENT to the operative C3 readiness package

_Amendment filed by Wren, 2026-11-05, under Rowan's ruling on the Phase B S1 window record (R3). Documentary only: this amendment authorizes nothing, requests no GO, and performs no production act. Production remains HELD under the INVESTIGATION HOLD (ruling R5)._

C3 reconciliation pin (this amendment): `<PACKAGE-PIN>` — repo `jedavid33-design/opal-reader`, branch `ui1-review`. (Pin-slot pattern, as established: a commit cannot name itself; the pinned copy carries the slot.)

---

## 1. Operative inputs, and what this amendment is

**Operative inputs:**

| Input | Identity |
|---|---|
| C3 readiness package, REBASED (the operative C3 specification) | `PHASEB-C3-READINESS-PACKAGE-REBASED.md`, pin `46112a03…` |
| Correction C3-R1 (branch-(c) consistency) | `PHASEB-C3-R1-CORRECTION.md`, pin `aba681a0…` |
| C3 readiness ruling | Rowan, 2026-11-02: **PASS — READINESS DESIGN ACCEPTED.** Operative package = `46112a03…` + `aba681a0…` |
| S1 window record | `PHASEB-S1-WINDOW-RECORD.md`, pin `f75130c6e3f36fad702b117b85dde3bb09f48c1c` |
| Rowan's ruling on the window record | 2026-11-05: **PASS WITH CONDITIONS** — R1 (S1 event accepted), R2 (W-4 accepted as observation, not resolution), R3 (C3 CONDITIONAL BRANCH (d)), R4 (resume documentary review permitted; OQ-1 open), R5 (no mutation authorized), R6 (this amendment is a named deliverable) |
| Post-window ownership basis | Window record §9; tail log `~/workspace/goals/opal-roundtable/hidden_files/phaseb-s1-tail-log.md`; tail watch `phaseb-s1-tail-watch` (daily, read-only) |

**What this amendment is.** Rowan's R3 selects branch **(d) — REVIVED-UNSTOPPED (POST-WINDOW)** — as the proposed C3 branch, *conditionally*: "subject to reconciliation with the operative C3 specification and a fresh execution census," with three demonstrations required — (i) the stop procedure is independent of future alarm delivery; (ii) the expected post-stop state is verifiable; (iii) the existing W-4 blocker is explicitly addressed — and with "any necessary amendments" returned for Rowan's review **before** Julie's separate C3 GO is requested.

This document is that reconciliation. It is an **amendment to the operative package, not a rewrite of it**. The operative package (`46112a03…` + `aba681a0…`) remains the C3 specification in full; this amendment changes **only**:

1. the **branch selection** — branch (d) is the executing branch, on the disposition basis stated in §2 of this amendment;
2. the **branch-(d) census delta** (§5 of this amendment) — the operative §4.4 adopts §4.1's branch-(a) delta with substitutions written for a chain *live at gate time*; the chain the window actually left behind is revived-but-not-delivering, and two of §4.1's expectations (A-3, A-4) and one value form (A-1) do not describe it. This amendment replaces the (d) delta with a delta written for the state as dispositioned, at the same hardness;
3. the **between-census-and-stop movement rule** for branch (d) (§6 of this amendment);
4. the **branch-(d) GO wording** (§9 of this amendment), replacing the branch-generic form of operative §6 for this branch.

**The C3 readiness PASS of 2026-11-02 stands.** Nothing in this amendment re-opens, re-argues, or weakens any part of the operative package it does not name. Where this amendment and the operative package could be read to differ on a matter this amendment does not name, the operative package governs and the difference is to be reported, not resolved by the executor.

**Dependency-leg accounting (operative §0), as this amendment leaves it:**

- Leg 1 (R5a-D closed): **SATISFIED** (unchanged).
- Leg 2 (the S1 event dispositioned in exactly one eligible form): the window record as reviewed carries the event in the form **EXPECTED-REVIVED**, and the post-window regime stands **REVIVED-UNSTOPPED / OWNED** — together the substance of the eligible form **EXPECTED-REVIVED (POST-WINDOW)**. But R3's selection of branch (d) is expressly **conditional on this reconciliation**, so leg 2 is satisfied in that form **only when Rowan accepts this amendment**. Until then leg 2 stands **conditionally satisfied — pending Rowan's acceptance of this amendment**, and no GO may be requested on it.
- Leg 3 (Rowan has reviewed the window record): **SATISFIED** — the 2026-11-05 ruling is that review (R1 accepts the event; R2 dispositions the W-4 in the form stated in §2 below).
- Leg 4 (Rowan's PASS on the operative package + Julie's GO recorded before the execution census): the package PASS stands; **Julie's GO is not requested by this amendment** and may be requested only after Rowan accepts this amendment (R3's ordering). The execution census remains fresh at gate time and supreme over every value quoted anywhere (operative §0, unchanged).

---

## 2. The W-4 blocker — explicitly addressed (operative §4.5; ruling R2 + R3)

### 2.1 The blocker as written

Operative §4.5 lists, among the states in which C3 may NOT open in any branch:

> **W-4 unresolved** (wake observed, delivery not observed, undispositioned) — *The event itself is unclassified — there is no branch whose census describes this state* — Path onward: *Rowan's disposition required; observation continues meanwhile.*

### 2.2 The disposition Rowan has now given

- **R1** accepts the S1 event: **W-2 EXPECTED S1 EVENT** — "successful wake and observed drive activity," expressly **not** "durable alarm-delivery reliability."
- **R2** accepts the W-4 **as observation, not resolution**: "Accept W-4 WAKE OBSERVED, DELIVERY NOT OBSERVED. The registration was 26h14m37s overdue at close. Root cause remains UNCONFIRMED. Do not attribute the stall to the 1101 fault without evidence, and do not presume that the registration will either fire or remain permanently inert."
- **R3** then selects branch (d) for this state, conditional on this reconciliation "explicitly address[ing]" the blocker.

**This amendment does not claim the W-4 is resolved.** It is not. The root cause is unconfirmed; the standing registration's future is unclaimed in both directions (R2, in terms). What has changed since §4.5 was written is not the W-4's resolution but its **disposition status and the fit of a branch census to the state** — the two things the blocker, read precisely, actually guards. §2.3 argues that discharge at exactly that strength, and no stronger.

### 2.3 Why the blocker's predicate no longer holds — argued precisely

The §4.5 row blocks on a compound predicate: the W-4 is (i) **undispositioned**, and therefore (ii) the event is **unclassified**, so (iii) **no branch's census describes the state**. Each element is addressed in turn:

**(i) "Undispositioned" is now false, in the only sense the row requires.** The row's own path-onward is "Rowan's disposition required." Rowan has dispositioned: R2 accepts the W-4 observation at full strength (and refuses resolution), and R3 routes the dispositioned state into branch (d) subject to this reconciliation. A disposition that says "accepted as observation, root cause open" **is** a disposition — the row never required the W-4 to be *explained*, only *dispositioned by Rowan rather than carried unexamined into a gate*. This amendment is the instrument R3 named for completing that routing; if Rowan does not accept this amendment, the blocker stands exactly as written (§2.4).

**(ii) The event is classified.** The window's classifications stand accepted: the event is **W-2 EXPECTED** (R1) and its terminal condition is **W-4** (R2). "Unclassified" described a state in which the executor would have had to guess what the window meant. No guessing remains about what was observed: the classification is Rowan's, not the executor's.

**(iii) A branch census now describes this state — this amendment writes it.** At package time no §4 delta described a revived chain that had *stopped delivering* under a standing past-due registration: §4.1/§4.4 describe a chain "turning ~10-minute halt-fenced passes" at gate time (A-3 expects accruing rows; A-4 expects a live registration moving through the re-arm cycle). §5 of this amendment replaces the (d) delta with expectations written for the state as it stands — non-delivering chain, standing past-due registration, one live grant in its churn position — at undiminished hardness (any deviation is a §7 STOP, as before). The state is therefore censused, not assumed.

### 2.4 What the W-4 does and does not leave ambiguous

**It does not leave the current observable state ambiguous.** At the window closing census (2026-11-05T23:21:06Z–23:21:18Z) and at the tail check that followed it (2026-11-05T23:28:42Z), every marker of the state was read, on both surfaces where two surfaces exist, and agreed:

- one live grant, `grant:plan:19cad189fab54b9c804a74a6:seg:87:full`, in issued state; seg:1–seg:86 all voided; never two live at any read;
- job `plan:19cad189fab54b9c804a74a6:seg` `generating`, revision **88**; the single occurrence `granted`;
- derived reserved **12**; dispatched **0** on every PT day; provider attempts 0; **$0**;
- phase frozen on both surfaces (settled 1029420 / estimatedUnverified 19018 / reservedUnverified 5648 / inFlightUpper 0 / unknownOpen 0 / remaining 12464932);
- the standing registration `armedAt` **1793826389431** (due 2026-11-04T21:06:29.431Z), read **identically** on the drive=1 surface and the containment-route surface at the +54h, +60h, +66h, closing, and tail reads; `pendingSchedule` 2 / `pendingWatchdog` 1;
- containment **NORMAL** / absent / verified, `stopConfidence` `"not_applicable"`, stop-record and episode fields empty — **no containment transition has ever run in production**;
- conflicts exactly the 4 pinned rows; bindings watermark 1841, 0 changes; queue paused, 1 consumer; build `fdb02395b3775dc945baa395591a73060ab146c4`.

**What the W-4 leaves open is exclusively about the future and about causation:** whether the standing registration will ever be delivered (R2: presume neither way); why delivery stopped (UNCONFIRMED); and the platform's general behavior in this region (post-retry-exhaustion `getAlarm()` semantics UNSPECIFIED — §7, A-2). None of those is a fact the stop act needs: the stop is **subtractive against the observed registration** (operative §1) — it observes the registration that stands, deletes it, and reads back. A stop whose target is fully observed in the present tense is well-defined against an open question about that target's future, because the act does not depend on the future arriving in any particular way — §3 demonstrates this step by step.

**The limit of this discharge, stated plainly:** the blocker is addressed by *disposition + branch fit*, not by the condition clearing. If Rowan judges that R2's accept-as-observation is not a disposition that can carry a §4.5 row — i.e., that the row requires resolution, not disposition — then the blocker stands, branch (d) does not open, and the onward path is whatever her ruling names (the §4.5 table's other rows and §3.7's ownership regime continue meanwhile). This amendment argues the reading above; it does not enact it. **Rowan's acceptance of this amendment is the act that discharges the blocker, and until that acceptance the blocker is carried in this amendment as ADDRESSED-ARGUED, NOT DISCHARGED.**

---

## 3. The stop procedure is independent of future alarm delivery (R3 demonstration i)

The stop act in branch (d) is operative §3's **C3-5 `stop_chain`**, unchanged. Its steps, and why none of them is — or needs — an alarm delivery:

1. **State commit** (operator route `POST /v2/d6-containment {action:"stop_chain"}`): one committed transaction on the `d6_containment_state` singleton — enum → CHAIN_STOPPED, episode minted (the `stop_chain:applied` audit row's id is the episode id). A storage write by the serving instance in response to the operator's call. No alarm is involved; nothing is scheduled, woken, or delivered.
2. **Physical act — observe:** the code reads `getAlarm()`. A read of the platform's registration state. It does not require the registration to fire, to be due, or to be deliverable — it returns whatever stands (in branch (d) as dispositioned: the value **1793826389431**, or null, or another value — each outcome has a named consequence in the ledger, §4 below).
3. **Physical act — delete:** `deleteAlarm()` removes the standing registration. Deletion is an act *on* the registration record, performed by the platform at the call, not a delivery *of* the registration. It is defined against a registration that never fires exactly as it is against one that would: the W-4 registration has stood undelivered for more than a day, and nothing in the delete step waits for, triggers, or presumes its delivery.
4. **Read-back:** `getAlarm()` again. The stop is claimed **verified only if this read returns null** (operative §3, C3-5 row; §5.1 expectations). A non-null read-back, or a throwing read, records the stop **unverified** and routes to C3-6 within the episode bound — never to a silent success.

**The surrounding steps are likewise delivery-free.** C3-1 `contain_drive` and C3-3 `clear` "touch no alarm API at all" (operative §1). An operator containment transition "is not an alarm wake: it does not deliver a pass, does not evaluate the schedule, and registers nothing" (operative §1). C3 in every branch "sends no command, induces no wake, delivers no pass, and manufactures no traffic of any kind" (operative §1). The one mechanism by which this system *receives* alarm deliveries — the DO alarm handler invoking `driveOnce` — is never invoked by, awaited by, or required by any step of the gate. If no alarm is ever delivered again, every step of branch (d) still runs to its named outcome; the outcomes differ (verified vs unverified stop), the procedure does not.

**Two independence caveats carried at full strength (not absorbed):**

- **The racing-wake consideration.** The containment design (v3 and later, carried in v4) fixed the proven race — a wake parked at `getAlarm()` resurrecting the chain after a stop landed mid-wake — by re-checking the containment gate in the same synchronous stretch that initiates `setAlarm` (harness CT13a/CT13b). Rowan's standing position keeps the racing-wake recheck **PLATFORM-UNVERIFIED**: harness proof is not live proof. In branch (d) as dispositioned the exposure is at its narrowest — the chain is not delivering, so no wake is expected to be in flight — but "not delivering" is an observation about the past interval, not a guarantee about the stop's instant (R2 forbids presuming the registration inert). The caveat therefore stands unreduced, and it is one of the named reasons the verdict remains PARTIAL (§8).
- **Storage-effect ordering (register R-02).** Whether an earlier-initiated `setAlarm` can take effect after a later-initiated `deleteAlarm` completes is unspecified. The stop rests on its read-back, not on ordering; a registration whose effect landed after the verified read-back would be detected only at the next successful dual read (the closing census, and after the gate the tail/C2-style reads). Named, not mitigated away (operative §8/§9, carried).

---

## 4. The expected post-stop state, and its verification (R3 demonstration ii)

### 4.1 Expected post-stop state (no-failure path)

Exactly operative §5.1's C3-5/C3-7 expectations, with the branch-(d) baseline substituted (§5 below):

- **Containment state CHAIN_STOPPED on BOTH surfaces** — the operator route (`GET /v2/d6-containment`) and the `drive=1` projection (`GET /v2/d6-diagnostics?drive=1`) — identical in substance: state `CHAIN_STOPPED`; `absent: false`; `verified: true`.
- **Stop-record fields populated:** `stopStatus: "verified"`; `stopVerifiedAt` = the act's timestamp; `stopVerifyAction: "stop_chain"`; `stopArmedBefore` = **the C3-5 observe-step value** (expected: the standing registration 1793826389431, as re-read in the act — whatever the observe step reads is what is recorded, per the ledger); `stopArmedAfter: null`; `stopVerifyAttempts: 1`; `stopEpisodeId` = the `stop_chain` audit row id; `stopEpisodeExhausted: false`.
- **`getAlarm()` read back null** inside the act, and **`armedAt: null`** in the closing census's diagnostics on both alarm surfaces.
- **Displayed `stopConfidence`: `verified_current`** (truth-table row 3 — recorded success **and** each surface's fresh null observation agree). No surface displays `stopStatus` alone as a present-tense claim (operative §5 preamble, unchanged).
- **Schedule rows preserved:** `pendingSchedule` 2 / `pendingWatchdog` 1, unchanged — the stop preserves schedule rows; nothing re-registers because re-registration happens only through the ordinary wake paths under NORMAL (operative §2), and the state is CHAIN_STOPPED.
- **Everything else bit-identical to the execution census** except the ledger's own writes and the deleted registration: phase, quota, conflicts, watermarks, parked job, plan/job state (the churn frozen mid-state at the stop — operative §2), holds, build, settings. Expected totals (operative §3.1): **state writes 4, audit rows 4, `deleteAlarm` 1, `setAlarm` 0, $0** — the RB-6 pre-satisfied variant does not apply (containment reads NORMAL/absent at baseline; Layer-1 was never applied in the window — window record §7 — so C3-1 runs in its sent form).

### 4.2 Verification protocol

- **Inside the act:** observe → `deleteAlarm()` → read-back, as §3 above; the read-back is the physical evidence, and the stop record is written from it (V4-2: recorded logical completion ≠ physical verification — a record proves a step was recorded; a fresh live read is what credits it physically).
- **Per-step read-backs on both surfaces** after C3-1, C3-3, and C3-5 (ledger C3-2/C3-4/C3-7 rows, unchanged); cross-surface disagreement at any read-back is a §7 STOP (operative §7 condition 3).
- **If C3-5 ends unverified** (delete throws; read-back throws or non-null): the stop record is written `unverified`, and **`verify_chain_stop` retries run only within the episode bound** — `MAX_STOP_VERIFY_ATTEMPTS = 3` per episode, the `stop_chain` act counting as attempt 1, C3-6 supplying at most attempts 2 and 3 (operative §3.2). The bound is provisional (register R-05 family) and is carried as such. At attempt 3 unverified the episode is **EXHAUSTED** (durable flag + `stop_episode_exhausted` audit event); C3 ends STOPPED-unverified and returns for ruling; **R3-V is the only path onward** — no clear, no re-stop, no further verify inside C3 (operative §7 condition 5).
- **Re-entry after any interruption** is operative §R, unchanged: the record (state route, `drive=1` projection, audit listing — in that order) determines what was RECORDED; a fresh `getAlarm()` read determines what is PHYSICALLY credited; a `stop_chain` whose audit row exists is **never re-sent** — an unverified or unresolved stop resumes exclusively through `verify_chain_stop` within the bound.

### 4.3 Premise failure at the execution census — the C-PF classes applied by analogy

The C3-R1 correction (pin `aba681a0…`) established, for branch (c), that a premise failure at census is a **STOP before any act**, classified under exactly one named class, recorded with its raw reads, and routed onward **only** through a fresh Rowan ruling + fresh Julie authorization (with R3-V the named candidate only where the failure establishes exhaustion or an unverified stop). Branch (d)'s premise is different in content — a standing registration under a non-delivering chain, against an **empty** containment history — so the correction's classes do not transfer by name. This amendment establishes the analogous classes for branch (d), modeled on C-PF in role and discipline:

| Class | Trigger at the branch-(d) execution census | Recorded as |
|---|---|---|
| **D-PF1 — STATE-SHORTFALL** | The containment display on either surface is anything other than NORMAL / `stopConfidence: "not_applicable"` / verified-readable — including any DRIVE_CONTAINED or CHAIN_STOPPED reading, any stop-record or episode field non-empty, or an unreadable/underivable display | the per-surface values and read shapes |
| **D-PF2 — REGISTRATION-OBSERVATION** | The alarm observation fails its premise: `armedAt` **null** on either surface (no standing registration — the stop has no target); the paired surfaces **disagree** on `armedAt`; or the observed value is inconsistent with the tail-adopted standing registration **other than** through the §6 movement rule's own handling | the observed value(s), per surface, with timestamps |
| **D-PF3 — HISTORY-NONEMPTY** | The append-only audit history (`d6_containment_events`) contains **any** event, or the containment tables exist — the dispositioned history is empty (no transition has ever run); any event present is one the disposition record does not account for | what the history actually shows |
| **D-PF4 — DISPOSITION-DISAGREEMENT** | Any other disagreement between the fresh census and the disposition basis (window record + ruling + tail-adopted baseline): plan/job/grant state beyond the §6 movement rule, phase/quota/conflicts/watermark/parked movement, holds disturbed, build/settings moved | the field-by-field disagreement |

On any D-PF class: **STOP before any mutation** (executor STOP law); no class is acted on inside C3; the classified finding, with raw reads, returns for a fresh Rowan ruling + fresh Julie authorization. **No verification budget exists to spend at census in branch (d)** — no episode has been minted — so there is no analogue of "spending" anything; if a D-PF finding establishes that a stop already exists unverified (e.g. a D-PF1/D-PF3 combination showing a prior stop episode), the onward candidate is R3-V under operative §3.2's law, named by Rowan's ruling, never by this amendment.

### 4.4 The mutation ledger — carried unchanged

Operative §3's ledger (steps C3-0…C3-7) and §R re-entry procedure apply to branch (d) **exactly as written**, including: the V4-2 separation of recorded completion from physical verification at every step; the ambiguous-response handling column; the worst-case budget totals of §3.1 (state writes ≤6, audit rows ≤7, `deleteAlarm` ≤3, `setAlarm` 0); and the rule that the stop act has **no rollback inside the gate**. This amendment changes no ledger row, no budget figure, and no failure branch. The only ledger-relevant fact it adds is the opening-state determination: containment NORMAL/absent (not DRIVE_CONTAINED), so **C3-1 runs in its sent form**, and the RB-6 pre-satisfied case is recorded as **not applicable** to this execution.

---

## 5. Branch (d) deltas vs branch (a) — the amended census delta

### 5.1 Baseline source and the tail-freshness rule

Branch (a)'s delta baselines from the **window closing census**. Branch (d)'s baselines come from the **tail log** — operative §4.4's substitution, carried with its rule at full strength:

- The baseline source is the **tail log's latest completed check**: the tail watch `phaseb-s1-tail-watch`, a **daily read-only** check under the §3.7 Branch 1 ownership regime (REVIVED-UNSTOPPED / OWNED), appending to `~/workspace/goals/opal-roundtable/hidden_files/phaseb-s1-tail-log.md`. At this amendment's drafting the latest completed tail check is the tail-start check, **2026-11-05T23:28:42Z** (classification TAIL-W4-CONTINUING, full read set at closing-census values).
- **48-hour freshness (operative §4.4, unchanged):** the latest completed tail check must be **less than 48 hours old at C3-0**, or the census re-baselines from a fresh supervised check performed and logged before C3-0 opens. A tail gap does not block the branch (the tail is an ownership regime, not a coverage claim) — staleness does, until re-baselined.
- **The execution census itself is fresh at gate time and supreme** (operative §0): tail-adopted values are expectations the census must match, never facts the census inherits. Every value in §5.2 is re-read at C3-0.

### 5.2 The amended (d) delta (replaces §4.1 A-1…A-6 for branch (d) only)

The branch-invariant core (operative §4.0, items 1–12) applies **unchanged**, with one value-form note at item 8: derived reserved is expected **exactly 12** in branch (d) as dispositioned (the standing live grant's reservation), not the set {0, 12} — a census reading of 0 means the standing grant has voided without re-issuance, which is movement under §6, not an in-set alternative. All other core items stand as written (including item 7's both-surfaces phase enumeration — the C2 item-7 repair).

| # | Item | Hard expectation (branch (d) as dispositioned) |
|---|---|---|
| D-1 | Phase B plan execution state | Plan `active` {eligible 1, done 0, failed 0, blocked 0}; entry occurrenceState `granted`; job `plan:19cad189fab54b9c804a74a6:seg` `generating` rev **88**; grants: **exactly one live grant**, the tail-adopted sequential successor **`grant:plan:19cad189fab54b9c804a74a6:seg:87:full`** in issued state, with seg:1–seg:86 all in their lease-expired void states; quarantine `held: false`. (Amends §4.1 A-1's value form, which named `seg:1:full` — the churn's first position. The expectation's substance is A-1's: exactly one grant, in a churn-invariant state, no second grant, no second plan movement — a second live grant is T4-class movement, §7.) |
| D-2 | Eligibility surface | As recorded at the closing census for the churn state; the three scope digests exactly `cdef2c7ec7bb8434b4e2fac66af49983ac7fa4b4e65bb0eda40354be51ff52d1` (definition digests — unchanged by grants). (Carries §4.1 A-2 unchanged.) |
| D-3 | `drive=1` baseline — **non-delivering chain** | Recorder table **exists**; the latest recorded pass is **id 296** at **1793825819071** (2026-11-04T20:56:59.071Z), stage complete, error fields null; **no row after 296**; `recorderHealth` as at the tail baseline (`recordingFailures` 0). `pendingSchedule` **2** / `pendingWatchdog` **1**. (Amends §4.1 A-3: no rows are expected to accrue in this branch — accrual is movement under §6.) |
| D-4 | **armedAt — ADOPTED standing value (form amended)** | `armedAt` exactly **1793826389431** on each paired read within the census set, **identical across the paired reads**; recorded verbatim as the pre-stop value; C3-5's observe step re-reads it and `stopArmedBefore` is the observe-step value. A **null** value contradicts the disposition (a standing registration is the branch's premise) → STOP and classify (D-PF2). A **different** value is movement, handled only under §6 — never adopted silently at census: at C3-0 the expectation is the adopted value exactly, and any other value stops the gate at C3-0 under operative §7 condition 1 (it is §6, not the census, that governs movement arising *after* a matching census). (Amends §4.1 A-4's form: A-4 expected a live registration moving through the re-arm cycle and treated cycle-consistent change between C3-0 and C3-5 as expected. In branch (d) as dispositioned the registration is standing and past-due; **no change is expected, and cycle-consistent change is not an available reading** — a changed value means a pass was delivered, which is the §6 event.) |
| D-5 | Containment projection (both surfaces) | `NORMAL`; `absent: true`; `verified: true`; `stopConfidence: "not_applicable"`; stop-record and episode fields at their empty values; the audit history **empty** (no containment transition has ever run — window record §7; tail check 2 concurs). (Narrows §4.1 A-5: A-5's DRIVE_CONTAINED alternative existed for a window Layer-1 act; none was applied, so the alternative does not arise in this branch — a DRIVE_CONTAINED reading is D-PF1, not an RB-6 opening.) |
| D-6 | Disposition evidence | The window record (pin `f75130c6e3f36fad702b117b85dde3bb09f48c1c`) carrying the W-2 event and the W-4 close; **Rowan's ruling on it (2026-11-05): R1 (event accepted), R2 (W-4 accepted as observation, not resolution), R3 (branch (d) conditional on this reconciliation)**; **Rowan's acceptance of THIS amendment** (the act that completes leg 2 and discharges the §4.5 W-4 blocker at the strength argued in §2); the tail record standing REVIVED-UNSTOPPED / OWNED at gate time, latest completed check < 48 h old (§5.1); S1-X **expired, never fired**; Part D state as recorded (one stimulus, sent and refused as designed). |

### 5.3 What branch (d) does not inherit from branch (a)

- **No in-set pass expectation.** Branch (a) treats passes during the gate as "expected evidence inside the invariants" (operative §1). Branch (d) as dispositioned expects **none** (§6). The closing-census delta allowance in operative §5.1's C3-7 row for "the churn accrual the live chain produced between C3-0 and the stop" **does not apply** in branch (d): any accrual is a §6 movement event, classified and handled as §6 states — it is not waved through the closing delta table.
- **No live-registration reasoning.** Operative §8's branch note — that in (a)/(d) the deleted registration is a *live* one sitting outside the post-exhaustion unspecified region — **does not carry to branch (d) as dispositioned**. The registration branch (d) deletes is past-due by more than a day and undelivered; §7 (A-2) carries the consequence for the assumptions register.
- **S1-X posture.** In branch (a) as written pre-close, S1-X's status was a window fact to record; in branch (d), **S1-X is dead** (expired at window close, never fired). There is **no bound stop authority** in the post-window regime: this gate, under Julie's separate GO, **is** the stop vehicle (operative §4.4; window record §9). Nothing in the tail watch, the tail log, or this amendment can stop the chain outside C3's own execution.

---

## 6. The between-census-and-stop movement rule (branch (d))

Stated precisely, and conservatively, for this branch:

1. **The interval.** From the moment the execution census (C3-0) completes matching §5.2 until the C3-5 stop act's observe step reads the registration, the system is expected to be **bit-identical in every §5.2/core figure except the ledger's own writes** (C3-1/C3-3 and their read-backs). No drive pass is expected in this interval; no grant change is expected; no `armedAt` change is expected.
2. **The rule.** **Any** of the following arising in that interval **STOPS the gate before the stop act** (or, if detected at the C3-5 observe step or a read-back, before any further act): a new drive-pass recorder row (id > 296, or any row beyond the census's adopted latest); any grant change (the live grant voiding, a successor issuing, a second grant appearing); any `armedAt` change from the census value; any job revision change; any derived-reserved change. Detection surfaces: the per-step read-backs (ledger C3-2/C3-4), the C3-5 observe step itself, and any poll the executor runs — a movement detected anywhere is the finding.
3. **A pass in the interval is not a stop-blocker by itself — it is a re-census event.** The movement means the chain's delivery state has changed (the W-4's open future arriving, in one direction). The gate does not proceed on the census it took, because the stop's target and the churn state are census facts that just changed. It also does not classify the movement as an anomaly: a delivered pass under the holds, inside the §7.3 invariants, is the pre-classified churn behavior resuming — expected machinery, newly timed. What it invalidates is the census, not the branch.
4. **Re-census procedure.** On a §6 movement: STOP all further acts; preserve steps already recorded (their recorded completion stands under §R — a sent C3-1/C3-3 is never re-sent); append the movement finding, with raw reads, to the gate record; then **re-run C3-0 in full** against §5.2, with the moved values (new latest pass, new live grant position, new `armedAt`, new job revision) adopted as the candidate baseline **only if** the re-census matches the branch's *form* in every item — exactly one live grant, occurrence `granted`, reserved 12, phase frozen, containment NORMAL, holds intact. If the re-census matches in form, the gate may proceed to C3-5 against the re-censused registration **only if Julie's GO, as given, expressly covers one re-census-and-continue** (§9's wording includes that term, as a deliberate term for Rowan's review — §9.1). If the re-census does not match in form, or the GO does not carry the term, the attempt **ends** on the movement finding and returns for ruling. **At most one re-census-and-continue per attempt**; a second movement ends the attempt unconditionally.
5. **What §6 is not.** It is not a relaxation of operative §7 condition 1 or 4: a movement that is *outside* the §7.3 invariants (a second grant, dispatched > 0, phase movement, an out-of-set recorder row) is a §7 STOP-and-escalate, never a §6 re-census. §6 governs only in-set movement — delivery resuming inside the invariants — and nothing else.

---

## 7. Assumptions register — branch-(d) execution

Every assumption the branch-(d) execution would rely on, labeled. **SUPPORTED** = established by the cited evidence at the strength stated. **UNSUPPORTED** = named plainly; the execution proceeds, if Rowan accepts this amendment, with the assumption visible, and the gate's design (read-back-based success, §R, PARTIAL verdict) is what bounds its failure modes — the assumption is never silently promoted.

| # | Assumption | Status | Basis / caveat |
|---|---|---|---|
| A-1 | The stop act's mechanics are as operative §3's ledger states (commit → observe → `deleteAlarm()` → read-back → record), and succeed or fail only in the ledger's named modes | **SUPPORTED at harness strength; production-unexecuted** | Containment battery v4 on the composed tree (42/42, Grant 1 gate), incl. CT16a (stop against a stale registration), CT16b/c (re-entry), CT11 (verify semantics), CT3/CT6 (verified-stop family). **No containment transition has ever run in production** — the first live `stop_chain` is this gate's own act, and no live precedent exists for any step of it |
| A-2 | The C3-5 read-back null, if obtained, means the standing registration is deleted | **SUPPORTED as an observation about this registration; UNSUPPORTED as platform generality** | The gate claims success only from the live read-back (operative §9, R-12 bounding). **But note the branch difference honestly:** operative §8's note placed (a)/(d)'s target "outside the unspecified region" because it was a *live* registration. Branch (d) as dispositioned deletes a registration **26h14m37s past due at window close and older at gate time, undelivered** — temporally the same region as branch (b)'s stale registration, where post-retry-exhaustion `getAlarm()` semantics are **UNSPECIFIED** in the accepted alarm-semantics record (register R-12). The read-back is therefore evidence about **this** registration at **that** moment — which is all the gate claims — and documents nothing about the platform's general behavior in this region |
| A-3 | `deleteAlarm()` against a past-due, undelivered registration deletes it in the documented-normal way | **UNSUPPORTED in this exact state (documented-normal, platform-unverified)** | Platform documentation describes deletion of the current registration without a past-due exception, but no record — harness, window, or platform document in the reviewed set — exercises a delete against a registration that stood >26 h past due undelivered. If the platform's representation of this registration differs from what `getAlarm()` reports, the failure surfaces inside the act as an unverified stop or a STOP (success is claimed only from the post-delete read-back null) — never as a silent success. The design absorbs the failure; it does not evidence the assumption |
| A-4 | The standing registration exists in deletable form — i.e., the persisted `armedAt` read corresponds to a registration the platform will present to the observe step and accept a delete against | **INFERRED — SUPPORTED as to the read, UNSUPPORTED as to deletability** | The value 1793826389431 is read identically on two surfaces at five consecutive completed checks (closing census, tail start, and the +54h/+60h/+66h window checks before them) — that establishes the *read* at full strength. But R4's warning is adopted verbatim: **persisted `armedAt` is not proof of delivery** — and, the distinction this register adds, it is likewise not proof of *deletable existence*: existence-for-delivery, existence-for-deletion, and existence-as-a-diagnostic-projection are three different facts, and only the third is directly observed. The first two are established, if at all, inside the act (the observe step reads the registration; the delete's read-back null confirms the deletion). R-13 (the lying-read residual: both surfaces read one store and do not corroborate each other) bounds even the read's strength, as operative §9 states. The gate is designed so this assumption is *tested by the act itself* and its failure is a named outcome (unverified stop / D-PF2 at census) — it is not load-bearing for safety, only for the stop's success |
| A-5 | The verify protocol can confirm the stop after the act (`verify_chain_stop`, audited, idempotent, bound 3/episode) | **SUPPORTED at harness strength; production-unexecuted** | Design v4 + battery CT11a–f, CT15a–c (operative §8). Same production-precedent caveat as A-1 |
| A-6 | A wake racing the stop cannot resurrect the chain over a verified stop | **SUPPORTED at harness strength; PLATFORM-UNVERIFIED (standing)** | The v3+ gate re-check in the synchronous stretch initiating `setAlarm`; CT13a/CT13b fail on v2 at the resurrection assertion and pass on v3/v4. Rowan's Ruling 2 remainder keeps the live claim open — carried unchanged (§3). One of the named reasons the verdict is PARTIAL |
| A-7 | The tail-adopted baseline is accurate at amendment time | **SUPPORTED (as a dated observation)** | Closing census + tail-start check, full read sets, values quoted in §2.4/§5.2. The execution census re-reads everything fresh (operative §0 supremacy); staleness is governed by §5.1's 48-h rule |
| A-8 | No containment history exists to review | **SUPPORTED** | Tables are created only by a transition; no transition has ever run (window record §7: state read NORMAL/absent at every completed check; audit history empty). Branch (d) therefore has no episode history — D-PF3 turns any contrary finding into a premise failure rather than a review item |
| A-9 | The chain will remain non-delivering through the gate | **UNSUPPORTED — and not relied on** | R2 forbids presuming the registration inert. §6 exists precisely because this may become false at any moment, including mid-gate; the gate's safety does not depend on it (holds fence dispatch and delivery independently of passes) |
| A-10 | Julie's app use or other foreign traffic will not wake the coordinator during the gate | **UNSUPPORTED — and not relied on** | Foreign wakes are possible in principle (operative §9, R-01's branch-(d) exposure note: branches (a)/(d) "run against a live chain by design — the passes are expected traffic" — in (d) as dispositioned, any pass is instead a §6 event). A foreign wake's effects are bounded by the holds and detected by §6's surfaces; the gate does not assume their absence |

---

## 8. What does NOT change

Carried from the operative package without amendment, and restated so this amendment cannot be read to dilute any of it:

- **The verdict is PARTIAL in every branch** (operative §8). C3's live drive suppression, genuine-concurrent-wake suppression, and racing-wake behavior remain platform-unverified after a perfect branch-(d) execution; branch (d) as dispositioned observes even less of the remainder than branch (a) would have (the chain is not delivering, so a revived chain's behavior under `contain_drive` and under the stop commit may go entirely unobserved — the incidental-observation note in operative §8 applies only if delivery resumes, and then §6, not the closing delta table, governs what is made of it).
- **Operative §10 exclusions, in full:** no generation (no SubmitJob, no grant issuance of C3's own, dispatched stays 0, spend stays $0); no action on any plan or job; **no restoration** (the only `clear` in the gate is the mechanics-leg clear from DRIVE_CONTAINED); no queue or halt change; no deployment. C3 ends CHAIN_STOPPED (no-failure path) and grants no onward authorization.
- **Restoration remains standalone** (operative §2): its own named Julie authorization after Rowan's review of C3's execution record, a fresh census at its start, a recorded reason, the §5.3 preconditions, and the mandatory historical audit review. Nothing in this amendment advances, bundles, or pre-approves it.
- **The generation-resume gate remains separate** (operative §10's path-after-C3). It must still resolve its own wake question: the companion analysis (`PHASEB-GENERATION-RESUME-OQ1-ANALYSIS.md`, same pin) takes up OQ-1 under ruling R4. Nothing in C3 — in any branch — pre-decides, pre-registers, or substitutes for the resume gate's wake, and C3's stop is precisely what makes that question necessary.
- **R3-V remains the exclusive post-exhaustion path** (operative §3.2), unrequested and unauthorized here.
- **The preserved plan and the idx-26 exemption are untouched** (ruling R5): C3 changes nothing about the plan's state; the churn it carries is the wake's system effect under the holds, pre-classified and accepted, not an operator act (operative §2).
- **The tail watch continues** under its existing ownership and exit conditions (ruling R6) until C3 execution, Rowan supersession, or the 14-day tail point (2026-11-19T23:28:41Z).

---

## 9. GO wording for Julie — branch-(d) form

Following operative §6's pattern, specialized to branch (d) as amended. **NOT requested by this amendment.** Inoperative until Rowan accepts this amendment **and** Julie's GO in this wording is recorded on the board before the execution census (operative §0 leg 4; ruling R3's ordering).

> "GO — execute exactly one Gate C3 attempt as pinned at `46112a03…` + `aba681a0…`, as amended for branch (d) at `<PACKAGE-PIN>`, **in branch (d) REVIVED-UNSTOPPED (POST-WINDOW) as dispositioned by Rowan's 2026-11-05 ruling (R1–R3)**: preflight census on the operative core plus the amendment's branch-(d) delta (tail-log baselines, latest completed tail check less than 48 hours old, the standing past-due registration `armedAt` 1793826389431 as the adopted pre-stop value); the contain_drive + reasoned clear mechanics pair (contain_drive in its sent form — containment stands NORMAL); exactly one stop_chain act against the then-current registration (with verify_chain_stop retries only within the design's attempts bound of 3 if the stop is unverified); if any drive pass, grant change, or armedAt change occurs between the census and the stop act, STOP, re-census once in full, and continue to the stop act only if the re-census matches the branch-(d) form in every item — a second such movement, or any out-of-set movement, ends the attempt; passive read-backs only, NO command, NO wake provocation, NO stimulus of any kind, ending HELD in CHAIN_STOPPED. I understand C3's verification is PARTIAL and its verdict cannot exceed PARTIAL, that the W-4 stands accepted as an observation and NOT resolved (root cause unconfirmed), that C3 does not restore NORMAL, that the return to NORMAL needs its own separate standalone authorization with a fresh census, a recorded reason, and a historical audit review, and that a deleted registration cannot be restored by this gate."

### 9.1 Terms in this wording that are new, flagged for Rowan's review

- **The re-census-and-continue term (§6).** Operative §6's wording contains no such term; operative §7's preamble states the GO "is consumed by the attempt either way," and §6.4's procedure is this amendment's construction. The term is included because branch (d)'s dispositioned state makes an in-set delivery resumption *foreseeable in kind* (the W-4's open future) in a way branch (a)'s live-chain design absorbed by expectation instead. If Rowan prefers the stricter form — any §6 movement ends the attempt, full stop — striking the term requires no other change: §6.4 then terminates at "the attempt ends on the movement finding." The executor will not choose between these at execution time; the wording Julie signs is the wording that governs, and this amendment asks Rowan to rule on the term expressly.
- **The adopted registration value in the GO text.** Branch (b)'s discipline re-derives its adopted value from the closing record rather than carrying it in the package text (operative §4.2, B-3). The value is stated in the wording above because branch (d)'s adopted value *is* its disposition's central fact and Julie should see what she is approving; the census (§5.2, D-4) nonetheless treats the value as an expectation to be matched by fresh reads, and §6/D-PF2 govern any difference — the wording's number never substitutes for the census.

---

## 10. Contents and turn

**Contents of this filing:** this amendment (`PHASEB-C3-BRANCH-D-RECONCILIATION.md`) + the companion OQ-1 analysis (`PHASEB-GENERATION-RESUME-OQ1-ANALYSIS.md`) + the companion cp (`PHASEB-C3D-OQ1-ROWAN-CP.md`), under one pin (`<PACKAGE-PIN>`). Verbatim sequential parts accompany any document exceeding ~30 KB (exact-concat verified), as established.

**Requested of Rowan:** a PASS / REVISE ruling on this reconciliation — specifically: (1) the §2 blocker disposition argument (ADDRESSED-ARGUED at the strength stated — acceptable, or does §4.5 require more?); (2) the §3 independence demonstration; (3) the §4 post-stop state + verification protocol, including the D-PF classes; (4) the §5.2 amended (d) delta; (5) the §6 movement rule and the §9.1 re-census term. **No execution and no GO request accompany this filing**; Julie's GO may be requested only on Rowan's acceptance (R3). Production remains HELD; the tail watch continues.

**Turn: Rowan's.**

— Wren
