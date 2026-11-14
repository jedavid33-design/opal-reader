5. **P-STALE** (the initial release's only repairable predicate, IC-1): `armed !== null && armed <= now − ALARM_STALE_THRESHOLD_MS`, with `now` re-read inside the stretch and the comparison at the deployed constant's own semantics (`<=`, coordinator.mjs:3265) — equality is stale (boundary case, T-30).
6. **Diagnostic-only classes** (recorded with full predicate values; never an act): **P-ABSENT** (`armed === null` with pending rows present — IC-1: diagnostic-only in this release; its observation fields are retained for future evidence), **P-FUTURE** (`armed > now + WATCHDOG_PERIOD_MS + 60,000`), **P-SILENT** (registration fresh but the latest recorder row — read defensively: the `d6_drive_passes` table is created by the entry part, and a construction lacking it reads as "no rows" — is older than `2 × WATCHDOG_PERIOD_MS + 300,000`, or absent). A healthy chain (registration fresh, recent pass) → decline `not_stale`.
7. **The registration act** (only from step 5, and in DRIVE_CONTAINED only for the watchdog due): inside the boundary stretch, in order — re-read containment synchronously (the v3 recheck, verbatim pattern); re-read GENERATION_HALT synchronously; compute `due` from a **fresh synchronous** `MIN(due_at)` read over pending schedule rows (watchdog-row ensure first if none is pending, the `wake()` pattern :3200–3205; fallback `now + WATCHDOG_PERIOD_MS`); write the `intent` event row (synchronous SQL — deliberately placed inside the stretch so the intent precedes the act with no intervening await, IC-5's coordinator analogue); initiate `setAlarm(due)` — the stretch's final act. Then, after the stretch: read back `getAlarm()` and write the `completion` row with the outcome and the read-back value.

### 2.4 What the act may never do

The method's complete write set is §5.1's inventory. It cannot lift the halt, unpause the queue, transition containment, submit or alter any command/job/plan, touch quota or phase ledgers, or call any provider surface — structurally: it references none of those surfaces, which the implementation verifies statically and behaviorally (T-11). In the held state a repaired chain produces drive passes only (sendGrant is not wired while GENERATION_HALT is `"1"`, entry :326/:343 pattern) — stated as an observation about the held configuration, **not** as a harmlessness argument (IC-6): the release is scoped to the held state precisely because the unhalted authority model is not yet demonstrated, and step 2's rechecks are what keep it there.

### 2.5 The strike counter (IC-2, as amended)

- **Counts** registering evaluations only: an evaluation that reaches step 7 and initiates `setAlarm` increments the counter (the increment is part of the completion write; an evaluation whose completion write fails leaves an unresolved intent, which counts as registering until resolved — conservative accounting).
- **Effective strikes at step 3** = registering evaluations (completed + unresolved) since the last **qualifying complete recorder pass** (a `d6_drive_passes` row with stage `complete` and `at` after the most recent registering evaluation), computed from the events table and the recorder table at evaluation time. A qualifying pass therefore resets the count **automatically and only** (IC-2) — no code writes a reset at pass time; the reset is a derivation, which is why a pass the evaluation cannot see (missing table, §2.3 step 6) can never reset it.
- **Manual reset** exists only as the separate coordinator verb `acknowledgeRepairCounter({ authorizationRef, reason })`, exposed on the same operator route as a distinct action (§3): it appends an `acknowledgment` event and zeroes the counter, is **never** invoked implicitly by an evaluation, and each use requires its own specific authorization, recorded with its reference (IC-2). Declined or failed evaluations never touch the counter in either direction; operator-route invocation alone never resets it (the amended design's withdrawn provision is not reintroduced).
- **Concurrency:** the counter's read and the bound check occur before the await (step 3) and the increment is a single synchronous SQL statement inside the completion write; two overlapping evaluations can both pass the bound check only if both then register — each registration increments, so the count after them reflects both acts, and the *next* evaluation sees the true total (T-18 tests exactly this; the bound is on consecutive ineffective registrations as recorded, not a lock).

### 2.6 The evaluation record (IC-7)

The completion row and the route response carry: evaluation id (the intent row's id); source; timestamps (evaluation start; registration initiation; read-back) kept separate; predicate found with its input values (reported registration, threshold, `now`, latest pass id/at, pending counts); the outcome — one of `registered`, `not_stale`, `contained_stop`, `contained_drive`, `held_state_required`, `repair_ineffective`, `diagnostic_only:<class>`, `error:<surface>`; and the ladder's first two stages kept distinct per IC-7: **`setAlarm` call completed** (the initiation resolved without throwing) versus **registration reported afterward** (the read-back value, which may be null — a null read-back is recorded as `readback_null` and proves neither success nor failure of delivery, or of the call's platform effect). Stages 3–4 (delivery observed; continuation) are **not fields this method writes**: delivery and continuation are derived and reported **externally** by read-only observation (the weekly peek, a gate census), per IC-7's linkage rule — persistent annotation inside production would require its own authorized write path, and none is proposed here. Where the amended design's ladder language survives, routine external observation of two further passes is labeled **routine observed continuation**, never L-1 certification.

## 3. Operator route contract and authorization boundary

**Route:** `POST /v2/d6-repair-evaluate`. It joins the existing operator fence class, in all three places that class is enforced (no new fence is invented):

1. **Production gate (entry fetch):** the client token is skipped for this route (admission is on the migration-operator credential alone), exactly as for the phase-binding and containment routes.
2. **Operator admission (entry fetch):** the `x-opalreader-operator-token` header must equal the configured migration-operator credential, else HTTP 403 `migration_operator_required`; a missing/misconfigured credential pair yields 503 `migration_operator_not_configured` (the :2203–2208 pattern, inherited unchanged).
3. **Class gate (DO class):** the handler re-checks the operator-admitted stamp (`x-opalreader-operator-admitted`), else 403 `migration_operator_required` (the :821/:879 pattern). Credential-less and client-token-only calls are refused; the everyday client build has no path to this surface. The production scope/instance headers are required as for every `/v2/*` route.

**Request bodies — written in full** (standing lesson of 2026-11-05: operator transition bodies are never abbreviated in gate paperwork). The body is a closed allowlist; any other key, a missing required key, or an unknown action is refused HTTP 400 `repair_body_not_allowed` **before** any coordinator state is read for action (the refusal itself writes nothing):

Evaluate (the A-1 verb):
```json
{
  "action": "evaluate_repair",
  "authorizationRef": "<nonblank string, ≤2000 chars — required>",
  "reason": "<nonblank string — required for this route>"
}
```
Acknowledge (the counter-reset verb, §2.5; each use separately authorized):
```json
{
  "action": "acknowledge_repair_counter",
  "authorizationRef": "<nonblank string, ≤2000 chars — required>",
  "reason": "<nonblank string — required>"
}
```
Both bodies are complete: there are no optional keys, no defaults, and no caller-supplied source, identity, predicate, threshold, or due fields — a body carrying any of those is refused under the allowlist rule.

**Responses:** HTTP 200 with the §2.6 evaluation record as JSON (for `acknowledge_repair_counter`: the acknowledgment event id, the counter value before and after, and the latest registering event id it resolves). Declines are 200 outcomes, not errors — a decline is a successful evaluation whose answer was no. Errors of execution (a storage surface failing mid-evaluation) return the record with outcome `error:<surface>` when a record can be written, else HTTP 500 with the same shape the containment routes use; an unresolved intent left by such a failure is a designed, visible state (§2.2), never a silent one.

