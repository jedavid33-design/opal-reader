# W-4 RECOVERY DESIGN — AMENDED PACKAGE

**Case:** Opal Roundtable, issue #15. **Round:** W-4 diagnostic round, third filing. **Prepared on Julie's explicit go of 2026-11-14** (button tap, Coding Projects chat), in response to Rowan's design-review ruling of 2026-11-14 (handoff `RT-H-20261113-ccf694`; verbatim on the board, comment 6878405627), which accepted the first design package's direction with qualifications and required amendments A-R1–A-R7 and B-R1–B-R5 in an amended package. **Status: DESIGN PREPARATION ONLY.** Nothing in this document is implemented, deployed, or executed; no production act is proposed for authorization here. Production remains HELD (GENERATION_HALT `"1"`, queue paused, live build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`).

**Supersession:** §§5–7 of the first design filing (pin `e5f454fdf35101b7a29f2263abfb11928b6e317a`) are superseded by §§3–9 of this package. The evidence closures (§§1–4 of the first filing) stand, as amended in §2 below. Accepted documentary findings are not reopened.

**Language law** (unchanged, per Rowan's Q-1 corrections and the 2026-11-14 ruling): "no handler execution was recorded," never "never invoked"; a `getAlarm()` value is a **reported registration** (P-REG), not proof an executable alarm is queued; a fault is described as *continuous across recorded observations*, not verified at every intervening instant; H-4 is stated as: *no application-controlled autonomous recovery path is identified in the reviewed implementation after the alarm chain ceases, absent another qualifying entry path*.

---

## 1. Amendment disposition map

| Amendment | Incorporated at |
|---|---|
| A-R1 Recovery guarantee corrected (conditional target; four stages kept distinct) | §3.4 (outcome ladder), §3.1 (guarantee statement) |
| A-R2 Concurrency safety (six named hazards; v3 recheck applicability) | §3.5 |
| A-R3 Independent scheduler observability (record outside the coordinator; six states) | §5.3 |
| A-R4 Topology and least privilege (separate scheduler Worker preferred; narrow entrypoint) | §5.1–§5.2, recommendation §5.4 |
| A-R5 Recovery authority (containment × halt × authority-expiry matrix; WAIT law) | §3.6 |
| A-R6 Cadence and cost (full inventory; free-tier feasibility as a checklist, not an assumption) | §6 |
| A-R7 Scope of detection (absent / future-dated / silent-despite-fresh classes) | §3.2 |
| B-R1 Exclude an already-live chain | §7, checkpoint 0 |
| B-R2 Witness independence (no scheduler during L-1; no disable mutation) | §7, checkpoint 2 + pre-gate condition |
| B-R3 Prove consecutive continuation (per-pass records; cadence consistency) | §7, checkpoint 4 |
| B-R4 Refined outcomes | §7, outcome definitions |
| B-R5 Closing boundary (verified census or "HELD by last verified state") | §7, checkpoint 5 |
| G-1 language correction ("continuous across recorded observations") | §2.1 |
| G-4 qualification (exact ranges; immutable source identities) | §2.2 |
| G-5 clarification (documented retry-exhaustion behavior; no Cron extension) | §2.3 |
| G-6 corollaries (repair ≠ P-DEL; recent P-REC ≠ interval health) | §2.4, enforced in §3.4 |

## 2. Evidence closures, as amended

### 2.1 G-1 — CLOSED WITH INDETERMINATE RESIDUE (language corrected)

The §1 extraction of the first filing stands, with one phrasing replaced throughout per the ruling: fault #1 was **continuous across recorded observations** between its onset bracket (2026-11-01T19:46:25Z last verified-good reads → 20:06:25Z first located primary failure) and its recovery bracket (2026-11-02T00:16:03Z last 500 → 00:26:25Z first clean run; verified form 00:31:08Z). No statement in this program implies the fault was independently verified at every intervening instant, and none implies that a particular retry sequence necessarily occurred in any incident. S-0's due time (2026-11-01T19:49:36.104Z) falls inside the onset bracket; the association is accepted; fault causation is not established; the originating pending row remains unidentified, and that uncertainty does not block recovery design (ruling).

### 2.2 G-4 — Evidence index, code rows corrected to exact ranges with source identities

The first filing's index is accepted as a documentary map; its two approximate code references are replaced here, verified firsthand against the candidate tree on 2026-11-14. **Immutable source identities:** tree = the S1 candidate tree, the deployed build's source (build `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`, deployed 2026-11-07T01:25:44Z; parts verified byte-identical to the deployed script at deploy). File SHA-256: `v2/coordinator.mjs` = `5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed`; `v2/worker-entry-prod-d6.js` = `2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1`.

| Claim | Exact range |
|---|---|
| `WATCHDOG_PERIOD_MS` = `10 * 60 * 1000` | `v2/coordinator.mjs:133` |
| `ALARM_STALE_THRESHOLD_MS` = `60 * 60 * 1000` (provisional) | `v2/coordinator.mjs:144` |
| `_armAlarm()` — unconditional min-due registration; `setAlarm` at :2816 | `v2/coordinator.mjs:2790–2817` |
| `wake()` — watchdog ensure, then `_armAlarmIfEarlier` | `v2/coordinator.mjs:3200–3205` |
| `_armAlarmIfEarlier` — R5a condition at :3265 (unarmed / stale / earlier-due), v3 recheck, `setAlarm` at :3267 | `v2/coordinator.mjs:3220–3270` |
| `alarm()` — due-row processing; `finally` ensures the watchdog row (:3300–3302) and calls `_armAlarm()` (:3303) unconditionally | `v2/coordinator.mjs:3272–3305` |
| Wake-path arm call sites | `v2/coordinator.mjs:853`, `:2140`, `:2551` |
| Recorder: table DDL; health key; `_recordDrivePass` (INSERT :1914; 288-row prune :1925–1929) | `v2/worker-entry-prod-d6.js:434`, `:455`, `:1899–1937` (comment header :1888) |

The non-code rows of the first filing's index are unchanged. Per the qualification, this index is a map, not a replay of the underlying records; before any implementation verification relies on it, the cited ranges are re-verified against the implementation tree's own hashes (checklist item, §8 T-00).

### 2.3 G-5 — ACCEPTED WITH CLARIFICATIONS (one documented item added)

The **Documented guarantees** list gains the item Rowan supplied: *Cloudflare explicitly documents that exhausted alarm retries can leave an alarm without further execution until another `setAlarm()` call.* Recorded at its true strength: it supports the recovery architecture; it does **not** establish that retry exhaustion caused any Opal incident, and no statement in this package asserts that it did. The unresolved questions (post-exhaustion registration visibility, pre-handler failures, platform reconciliation) remain open and are carried into §9's inquiry. Documented alarm retry semantics are **not** extended to Cron Triggers anywhere in this package; the scheduler design in §5 relies only on the trigger firing, never on alarm-like retry behavior.

### 2.4 G-6 — ACCEPTED (distinctions mandatory in both tracks)

P-REC (recorder health), P-REG (reported registration), and P-DEL (proven delivery) remain distinct propositions, with the ruling's two corollaries enforced in this package's mechanics: **a successful repair evaluation, or an advancing P-REG, is not P-DEL** (§3.4's ladder keeps "delivery observed" and "continuation demonstrated" as separate, later-filled fields that an evaluation can never set itself); and **recent recorder health is not proof the recorder remained healthy throughout an unobserved interval** (no predicate in §§3–7 draws an interval conclusion from endpoint observations).

## 3. The shared repair evaluation — revised specification

### 3.1 What it is, and the guarantee stated at true strength (A-R1)

The **repair evaluation** is a single coordinator method, invocable from exactly two sources — the A-1 operator route (§4.1) and the A-3 scheduler (§4.2) — which examines the chain's reported state and, when a repairable condition holds and containment permits, issues **exactly one** `setAlarm(due)`. It is the only new write-capable operation this design introduces.

**Guarantee, correctly stated:** with a 6-hour scheduler cadence and the 1-hour stale threshold, an eligible stale registration *should receive a repair evaluation* within ≈7 hours of becoming eligible — a **conditional engineering target**, conditioned on the scheduler running, the coordinator being reachable, and containment and recovery authority permitting. It is not a platform guarantee, and no outcome of an evaluation is ever reported as "repaired": the four stages of §3.4 are recorded and reported separately.

### 3.2 Detection predicates (A-R7 — what the evaluation can see, and what it must not touch)

