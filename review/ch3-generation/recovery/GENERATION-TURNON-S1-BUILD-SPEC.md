# WS1 — S1 ENFORCEMENT BUILD SPECIFICATION, OFFLINE VERIFICATION BATTERY, AND R2-CONFORMED GO PASSAGE

_Wren's return under Rowan's WS1 final readiness ruling (relayed by Julie 2026-11-06; verbatim record `ROWAN-WS1-READINESS-BG2-SCOPE-RULING.md`; board verbatim 6687725188). The ruling: **S1–S4 ACCEPTED IN SUBSTANCE; DESIGN ACCEPTED WITH TWO REQUIRED GATE CORRECTIONS; GO PRESENTATION NOT YET APPROVED.** This document answers R1 (a narrow build specification + offline verification battery) and R2 (the SUSPENDED-BY-FAULT default), and carries the GO passage conformed for R2. It is a SPECIFICATION ONLY: it implements nothing, builds nothing, pins nothing by itself, deploys nothing, and presents no GO. Review pin: `<S1B-PIN>` (repo `jedavid33-design/opal-reader`, branch `ui1-review`). Operative sources: the WS1 correction (pin `0e2f03fa9c3b2ec8771d8ecef7f14e7d211104fe`), the WS1 design package (pin `5cca000fac0838203f084aa07d9ada53c7fa1c75`), and the deployed source (the containment-v4 composed tree — the tree of the live build `fdb02395b3775dc945baa395591a73060ab146c4`)._

**Reading note.** §1 specifies the code change exactly, against the deployed source. §2 specifies the refusal's surface semantics and the zero-mutation guarantee. §3 is the offline verification battery — R1's eight named coverage items as named tests on the house harness. §4 is the candidate's identity discipline. §5 specifies the post-deploy refused-intent probe for the eventual gate. §6 performs the R2 conformance (struck passages quoted verbatim) and presents the FULL R2-conformed GO passage as one operative text. §7 states boundaries. S1–S4 stand accepted in substance; nothing in this document relitigates them.

---

## 1. The change, exactly

### 1.1 The branch and its surroundings (source, verified for this specification)

Admission lives in `v2/generation/service.mjs` (the composed tree). The dispatch is `admitPhase` (:402):

- Enforcement-bound construction + registry EMPTY → refusal `phase_binding_required` (the round-5 bootstrap gate, :424). Every intent is refused in that window.
- Non-enforcement construction + registry EMPTY → `admitPhaseLegacy` (the round-1 history derivation, preserved verbatim).
- Registry ESTABLISHED (either construction) → `admitPhaseRegistry` (:431).

`admitPhaseRegistry` reads the book's own binding row first — `const own = phaseBindingForBook(coord, bookId);` (:432), a synchronous coordinator SQLite read (`coord._oneOrNull` over `d6_phase_bindings WHERE book_id = ?`, phase-policy.mjs) — and its final line is the fall-through (:447):

```
    return { ok: true, phase: null };
```

That return is the whole gap: registry established, the book has NO binding row (`own === null`), the caller named NO phase (`callerPhase === null`) → the book is admitted unbudgeted, and the plan it creates skips both phase checks at grant time (`grant-guards.mjs:223`, `if (plan.phase) { … }`). The construction flag is `enforcePhasePolicy`, bound at construction (`phasePolicyMode === "enforce"`, service.mjs:233 in substance): the production entry (`worker-entry-prod-d6.js`, `d6Service`) constructs the service with `phasePolicyMode: "enforce"` UNCONDITIONALLY (:407), and the entry's intent route returns a 503 configuration failure if the deployment var is not exactly `"enforce"`. Every direct construction (test fixtures, legacy suites) defaults to `"legacy"` (service.mjs:201). No request, command, or intent field can select the mode.

### 1.2 The delta

One branch, in `admitPhaseRegistry`, in `v2/generation/service.mjs` — the fall-through case split on the construction flag (the operative code text was ruled on in the correction, §1.2, and is reproduced here as the build's exact target):

```
    // E1 (S1 enforcement): in an enforcement-bound construction, a
    // book with no registry row may not submit unbudgeted. The
    // per-book-budget policy (Q1 ruling) is enforced HERE, at the
    // only admission gate, on the row already read above.
    if (enforcePhasePolicy)
      return { ok: false, reason: "book_not_onboarded" };
    return { ok: true, phase: null };
```

The delta is confined to this branch (plus its comment). The build touches **exactly one file: `v2/generation/service.mjs`**. Expressly NOT touched: `phase-policy.mjs` (the read already exists and is unchanged), `grant-guards.mjs` (the :223 skip is correct for plans that legitimately carry a phase; null-phase plans become uncreatable in the production construction instead), `gen-constants.mjs` (no budget change; `PHASE_BUDGET_MICRO_CENTS` stands at its one entry, :75), `worker-entry-prod-d6.js` (the construction is already unconditionally enforce), any route, the schema, and the client.

### 1.3 Before/after behavior — every admission case

Verified against the deployed code paths for this specification. "Registry" = `d6_phase_bindings`; FP = the one bound pair (`forever-pucked` ↔ book `5c589095-f812-48a2-8ab2-03ba2791f2b2`).

| # | Construction | Registry | Book's row | Caller phase | TODAY | AFTER E1 |
|---|---|---|---|---|---|---|
| 1 | enforce | empty | — | any | refused `phase_binding_required` (bootstrap gate) | **unchanged** — the E1 branch is unreachable; the gate fires first (ordering proven by T-BOOTSTRAP, §3) |
| 2 | legacy | empty | — | any | `admitPhaseLegacy` history rules | **unchanged** — that function is not modified |
| 3 | any | established | bound | null | refused `phase_required` | unchanged |
| 4 | any | established | bound | = its phase | admitted; phase DERIVED from the row | unchanged (the FP path; T-BOUND) |
| 5 | any | established | bound | ≠ its phase | refused `phase_mismatch` | unchanged |
| 6 | any | established | unbound | a non-budgeted string | refused `phase_not_budgeted` | unchanged (T-UNBOUND-NAMED) |
| 7 | any | established | unbound | budgeted, bound to another book | refused `phase_bound_to_other_book` | unchanged (T-UNBOUND-NAMED) |
| 8 | any | established | unbound | budgeted, no binding for that phase | refused `phase_unbound` | unchanged — **UNREACHABLE with the current constant**: the only budgeted phase is `forever-pucked`, and it is bound. This case becomes reachable only when a second phase is budgeted (an onboarding act under its own gate). It is asserted from the source table here and is NOT a battery case (§3.2) |
| 9 | **enforce** | established | unbound | null | **admitted `{ ok: true, phase: null }`** | **REFUSED `book_not_onboarded` — THE CHANGE** (T-NULL-REFUSAL) |
| 10 | legacy | established | unbound | null | admitted `{ ok: true, phase: null }` | **unchanged** — the refusal is gated on `enforcePhasePolicy`; the sanctioned fixture behavior is preserved (T-LEGACY) |
| — | any | any | the binding READ THROWS | any | the exception propagates out of `admitPhase` / `submitIntent` before any write; the intent errors; nothing is created | unchanged — E1 adds no catch, no default, no coercion (T-THROWSAFE) |

One correction to the case list this specification was asked to cover: "bound book + null caller phase" is sometimes wondered about as unreachable — it IS reachable and is row 3 (`phase_required`). Every other listed case is reachable except row 8's `phase_unbound`, flagged above.

### 1.4 What does NOT change (the negative scope)

- **No new read.** The branch decides on `own`, the value `phaseBindingForBook` already returned at the head of the function. No new query, table, index, route, settings key, or configuration surface is introduced.
- **No new empty-result path.** The branch rides the existing `coord._oneOrNull` null return — the throw-safe reader. No `.one()` call is added; the standing harness/real-DO `.one()` divergence is not engaged by this change.
- **The eligibility/quote path is untouched.** `eligibilityQuote` (exposed on the service alongside `submitIntent`) never passes through `admitPhase`; quotes for unonboarded books remain available by design — the onboarding procedure's figure step is computed from a fresh whole-book quote for a book that is by definition not yet onboarded. E1 refuses generation, not information (T-QUOTE-OPEN).
- **Resumption, the driver, and repair never re-run admission.** `admitPhase` has exactly one call site (`submitIntent`, service.mjs:861). A stored plan carries its phase; the design's state matrix (AUTO / RE-TESTED rows) describes driver behavior over stored plans, which this change cannot reach. A plan admitted before the deploy keeps the phase it was admitted with. The parked Chapter 3 job (preserved) is a job, not an intent; untouched.
- **Not an onboarding.** No budget constant changes, no binding is recorded by this build; FP's constant and binding stand exactly as they are. Not a registry redesign (accepted decision 1 stands).

---

## 2. Refusal semantics

### 2.1 The refusal's shape — house form

`submitIntent` (service.mjs:851) presents every refusal as the same object shape. The lane refusal, two lines above admission, is the template (:857–858):

```
    if (!D6_LANE_ALLOWLIST.includes(lane || "standard"))
      return { outcome: "rejected", reason: "lane_not_allowed" };
```

and admission refusals return identically (:861–863):

```
    const admission = admitPhase(bookId, phase);
    if (!admission.ok)
      return { outcome: "rejected", reason: admission.reason };
```

`book_not_onboarded` therefore surfaces as `{ outcome: "rejected", reason: "book_not_onboarded" }` — indistinguishable in form from `lane_not_allowed`, `phase_required`, `phase_mismatch`, and the rest of the existing family. The client surfaces the server's reason string; no client change is needed or proposed. The name was a Wren proposal in the correction; the ruling's acceptance list carries the E1 design (with the name) — the name stands as ruled unless Rowan renames it in this review, in which case the rename is a one-token change inside this same branch.

### 2.2 The zero-mutation guarantee — ordering established from source

The guarantee is not a hope about the branch; it follows from `submitIntent`'s write ordering, verified for this specification:

1. The function's pre-admission acts are the input destructure and the lane check — both pure; neither writes.
2. Admission is called next (:861). On refusal the function returns at :863.
3. EVERY write in the function lies strictly after that return: the halt-epoch note (`noteHaltObservation`, :909) and the plan insert with its entries, inside `coord._tx` (:912 onward). There is no ledger, quota, epoch, or watermark write before or inside admission (the source's own comment at :859–860 attests the invariant: *"a rejection creates no plan and moves no ledger state"*).
4. Inside admission itself, the only store interaction before the verdict is READS (`phaseBindingForBook`, `phaseRegistryEstablished`), plus the idempotent `ensurePhaseBindingSchema` DDL (`CREATE TABLE IF NOT EXISTS`) — ensured during any earlier binding read or write in the world's life, and a no-op once the table exists.

So a `book_not_onboarded` refusal executes **zero writes**: no plan row, no plan entries, no attempt-ledger row, no quota or dispatch counter movement, no phase-accounting movement, no epoch note, no sync watermark movement. This ordering is the battery's central assertion (T-NO-MUTATION, §3) and the post-deploy probe's safety basis (§5): the probe intent cannot spend, reserve, or generate, because the code path that could do those things is never entered.

---

## 3. The offline verification battery

### 3.0 The harness and the world

The battery runs on the house harness (`containment-v4/tests/harness.mjs`): real SQLite via `node:sqlite`, a `SqlCursor` whose `.one()` THROWS on 0 or >1 rows (production DO semantics — the fake that returns null is exactly the divergence that hid the P8 deadlock), a fake clock, a statement-matching SQL fault injector (`faults.sql = { match(query), error }`, the exact error object thrown), and `makeWorld(treeDir)` instantiating the SHIPPED entry class over the harness storage. `makeWorld`'s defaults are the production shape: `OPALREADER_PHASE_POLICY: "enforce"`, `GENERATION_HALT: "1"`, and the service constructed with `phasePolicyMode: "enforce"` — i.e., the harness world is ENFORCEMENT-bound by default, and the battery's enforce cases need no special construction. The world exposes the service's own surface (`submitIntent`, `eligibilityQuote`, `bindPhaseBook`, `listPlans`, `planStatus`, `capabilities`) and the coordinator, so assertions read the same surfaces the code reads. Registry seeding follows the harness pattern: `service.bindPhaseBook({ phase: "forever-pucked", bookId: BOOK })` (the harness constants `BOOK` / `PHASE` carry the FP shape). The battery file is new (proposed home: alongside the standing batteries, e.g. `tests/s1-enforcement-battery.test.mjs` in the candidate's test tree — the implementation return names its actual home); it adds cases, it does not modify any standing battery.

### 3.1 The named tests (R1's eight items)

**T-BOUND** — *bound book admission* (R1 item 1, first half). Enforce world, registry seeded with the FP pair. `submitIntent` for the bound book with `phase: "forever-pucked"`, chapter scope → admitted; `listPlans` shows exactly one new plan whose stored phase is `"forever-pucked"` (the DERIVED phase, not merely the caller's string). Proves: the production construction's one legitimate path is undisturbed by the branch — the FP-unaffected regression at the service surface.

**T-UNBOUND-NAMED** — *unbound book admission, named phase* (R1 item 1, second half). Enforce world, registry established. The unbound fixture book submits with (i) `phase: "forever-pucked"` → `{ outcome: "rejected", reason: "phase_bound_to_other_book" }`; (ii) an invented phase string → `{ outcome: "rejected", reason: "phase_not_budgeted" }`. Proves: the pre-existing named-phase refusals are byte-identical in behavior after the change (the delta touched only the fall-through). The third named-phase refusal, `phase_unbound`, is NOT exercised — it is unreachable with the one-entry budget constant (§1.3 row 8); the battery does not pretend otherwise, and the case is carried by the §1.3 source table.

**T-NULL-REFUSAL** — *null-phase refusal* (R1 item 2). Enforce world, registry established. The unbound fixture book submits with `phase: null` (and, as a second call, with the phase field omitted — the destructure defaults it to null, the path the app actually takes for such a book) → `{ outcome: "rejected", reason: "book_not_onboarded" }`. Proves: the gap is closed, in the house refusal shape (§2.1), on exactly the fall-through case.

**T-NO-MUTATION** — *no plan, ledger, or quota mutation on refusal* (R1 item 3; the battery's central assertion). Enforce world, registry established; the FP plan from T-BOUND (or a seeded equivalent) standing, so the store is non-trivial. Snapshot BEFORE the refused intent: the full `d6_plans` contents, the genstore accounting tables' contents (attempt ledger / phase accounting inputs), the quota and dispatch counters as the service's reads report them, and both sync watermarks. Run the T-NULL-REFUSAL intent. Snapshot AFTER and require byte-identity of every snapshot element. (The "before" snapshot is taken after seeding, so the schema-ensure DDL of §2.2.4 has long since run and cannot masquerade as a mutation.) Proves at harness strength: the §2.2 ordering claim — the refusal precedes every write, so nothing moved. This is the property the post-deploy probe (§5) relies on in production.

**T-QUOTE-OPEN** — *eligibility quotes remain available* (R1 item 4). Enforce world. `eligibilityQuote` for the UNBOUND fixture book returns a computed quote (eligible counts and expected units present; no rejection, no throw) — before the refused intent and again after it, with identical content. Proves: E1 refuses generation, not information; the onboarding figure step's input survives the enforcement it precedes.

**T-LEGACY** — *legacy/fixture construction compatibility* (R1 item 5). A second service constructed over the SAME harness coordinator with `phasePolicyMode: "legacy"` (direct construction through `createGenerationService` with the harness world's coord/store/sources — the mode is a construction argument, and fixtures are exactly direct constructions). Registry established; the unbound fixture book submits null-phase through the LEGACY service → ADMITTED, a plan created with phase `null`. Proves: the refusal discriminates by construction, not by data — the fall-through survives precisely where the sanctioned fixture behavior requires it, and the gate on `enforcePhasePolicy` is itself under test. (The registry-EMPTY legacy path, `admitPhaseLegacy`, is unmodified code and remains covered by the standing legacy suites under T-REGRESSION; this battery does not duplicate it.)

**T-REGRESSION** — *Standard and Batch admission regressions* (R1 item 6). (i) Batch: an enforce-world `submitIntent` with `lane: "batch"` → `{ outcome: "rejected", reason: "lane_not_allowed" }` — `batch_not_armed`'s admission-layer equivalent, unchanged; and a batch intent for the UNBOUND book with null phase STILL returns `lane_not_allowed` (the lane fence at :857 precedes admission at :861 — the ordering proves the new branch did not disturb the lane fence, and no `book_not_onboarded` leaks ahead of it). (ii) Standard: T-BOUND / T-UNBOUND-NAMED / T-NULL-REFUSAL ARE the Standard admission regression at the changed surface. (iii) The standing batteries — containment (42), P2, R5A, V-3 cold-restart — re-run complete on the candidate tree (§3.3's exit rule governs the whole set).

**T-THROWSAFE** — *real-SQLite throw-safe paths* (R1 item 7). Enforce world, registry seeded. Arm the harness SQL fault injector to throw a sentinel error on any query touching `d6_phase_bindings`; submit an intent — for the BOUND book (the read precedes any verdict, so the bound case is the strong one) → the call surfaces the sentinel (thrown identity, `===`) and creates NOTHING: no plan, no admission, no ledger movement (asserted against the T-NO-MUTATION snapshot discipline). Disarm the injector; the same intent then admits normally (the fault was test-side only). Proves: an unreadable registry can never produce an admission — fail-closed by propagation, on the real-SQLite harness whose `.one()` throws with production semantics (no null-fake anywhere in the path).

**T-BOOTSTRAP** — *ordering support case* (supporting; beyond R1's eight). Fresh enforce world, NO binding recorded: a null-phase intent for the unbound book → `phase_binding_required` (the bootstrap gate fires; the E1 branch is unreachable). Then record the FP binding and repeat the identical intent → `book_not_onboarded`. Proves: the branch arms exactly when the registry establishes, and the pre-existing bootstrap refusal's precedence is preserved.

### 3.2 What the battery does NOT prove

Harness-green is claimed at harness strength only, per standing law. The battery proves the branch's behavior in the harness world; it does not prove platform behavior (DO runtime adoption of a deploy is proven only by the post-deploy read-backs and the §5 probe, in the gate); it does not exercise `phase_unbound` (unreachable, §1.3 row 8); it makes no provider call and touches no staging or production state.

### 3.3 The exit rule

The battery's verdict exists only as ONE complete run — the new S1 battery plus the standing batteries (containment, P2, R5A, V-3) — executed on the EXACT pinned candidate tree (§4), with the full log and exit code captured and filed with the implementation return. No partial run, no subset, and no run on a pre-pin tree supports any claim. A single failing case fails the candidate: the delta is corrected and the battery re-run complete, or the candidate is withdrawn — there is no "green except" for a one-branch change.

---

## 4. The candidate's identity discipline

- **Base.** The candidate tree derives from the composed tree (the deployed source of the live build `fdb02395…`). The delta is §1.2's branch and nothing else.
- **Manifest discipline.** The candidate's upload manifest is compared part-by-part against the live build's 31-part manifest (SHA-256 per part, the standing deploy discipline). The comparison must show **exactly one differing part — the part carrying `v2/generation/service.mjs`** — with the other 30 parts byte-identical. Any second differing part is a STOP: the candidate is out of scope as built and is not presented. (If the upload composition ever groups modules differently than one part per module, the comparison is over the composed module set and must still isolate the difference to `service.mjs`'s content alone.)
- **Build stamp.** Per house practice, the deployed worker's `/health` build marker is the pinned review-artifact commit of the deployed tree (the live build reads `fdb02395…`, its pin). The candidate, once pinned, stamps that pin commit when deployed; the offline battery identifies its tree by the manifest hash set above, and the pin (§below) binds the two.
- **Pin before review.** The implementation return pins, on `ui1-review`, in one commit: the candidate tree delta (or the tree manifest + the changed file at full content, following the house pin pattern for build candidates), the battery file, and the complete battery log with its exit code. Rowan's independent review (R1) is of THAT pin — candidate, tests, and logs together. The design documents (the correction, this specification) are not a candidate and are never presented as one (the ruling, R1: *"Do not treat the current design as an already-built candidate"*).
- **Sequence the ruling fixes.** This specification → Rowan's review → implementation + battery run + pin (a separate return) → Rowan's independent review of the built candidate → only then is the production GO (with the §6 passage) presented to Julie. The deployment itself happens inside that GO's gate, under the holds, per §5.

---

## 5. Post-deploy verification — the refused-intent probe (specified now, executed only inside the gate)

Carried forward from the correction (§1.4) unchanged in substance, restated against the built candidate:

1. **Place in sequence**: census (on the live build) → deploy of the pinned candidate under the holds (GENERATION_HALT still `"1"`, queue still paused) → post-deploy read-backs → **the probe** → halt lift → queue unpause → smoke. The probe precedes every lift.
2. **Post-deploy read-backs** (before the probe): capabilities + health read back the candidate's build identity (its pin); phases render unchanged (FP present, budget 13,500,000, binding link intact); containment NORMAL; the gate's census predicates re-run against the new build where they name state — a deploy that moved any of them stops the gate. Observability re-checked after the upload and re-applied if reset, per standing deploy law; the etag captured and saved as an evidence artifact.
3. **The probe**: exactly ONE intent, submitted by the executor through the client connector, for a named unonboarded library book (named in the GO at presentation; any of the six), `phase: null`, chapter scope, Standard lane. Expected and REQUIRED outcome: the rejection `{ outcome: "rejected", reason: "book_not_onboarded" }`.
4. **Zero-movement read-back**: after the probe — plans list unchanged, sync watermarks unchanged, phase accounting unchanged, quota counters unchanged. The probe's safety basis is §2.2's ordering (proven offline by T-NO-MUTATION, observed live here).
5. **Failure disposition**: if the probe is ADMITTED, or refused under any other reason, or any state moved — STOP: the gate ends HELD, no lift is attempted, and the deploy is dispositioned under the standing rollback rules (the rollback target for this deploy is the census build `fdb02395…`, itself above the permanent floor `6a73d962…`) before anything else is contemplated.
6. **Counting**: the probe is a SubmitJob-class command and is counted in the gate's acts; it is the GO's sole named exception to its no-Wren-submission bar (§6). No FP probe is needed pre-lift: the smoke itself is the FP admission proof, and an FP admission failure would refuse closed at submission (no spend) inside the gate's observation.

---

## 6. R2 conformance — the suspended-smoke default, and the full R2-conformed GO passage

### 6.1 What R2 displaces (quoted verbatim from the correction, then struck)

The correction's §2.2(c) classification read:

> "**(c) SMOKE SUSPENDED-BY-FAULT** — at the decision bound, a platform fault of the 1101 class is verified in progress on the read surfaces (the standing signature: /health 200 while DO-backed /v2 routes fail), or such a fault consumed the interval such that the evidence cannot distinguish stall from fault. The gate PAUSES: no classification of the plan itself, no soak, no retry; the holds stay exactly as they are (lifted — the fault is not a safety event, and re-holding into a fault would repeat the program's standing WAIT law error); the gate re-convenes only on Julie's word after the fault clears, with a fresh decision interval for the still-standing plan or a fresh smoke, as Julie and Rowan direct. Suspension is a named state in the record, never an unmarked overrun of the bound."

The correction's §2.5 predicate sentence read, in its relevant clause:

> "every other path ends in a named state (FAILED-and-re-held, SUSPENDED-BY-FAULT, or TURNED ON UNDER OBSERVATION with the soak still running) recorded in the gate record."

And the correction's §5 GO passage carried the clause:

> "or SUSPENDED-BY-FAULT (a verified 1101-class platform fault — the gate pauses, holds untouched, and re-convenes only on my word)"

All three are **STRUCK** to the extent they leave the holds lifted during a suspension. The ruling is explicit: the default is a verified emergency re-hold followed by a fresh Julie GO before resumption; *"No indefinitely paused gate may leave generation enabled by default."* The correction's reasoning at §2.2(c) (that a fault is not a safety event and re-holding into one repeats the WAIT-law error) is displaced as the DEFAULT; §6.2 states the ruled replacement and the one mechanics note that makes it executable.

### 6.2 The R2 replacement (operative text)

**§2.2(c), as conformed:**

> "**(c) SMOKE SUSPENDED-BY-FAULT** — at the decision bound, a platform fault of the 1101 class is verified in progress on the read surfaces (the standing signature: /health 200 while DO-backed /v2 routes fail), or such a fault consumed the interval such that the evidence cannot distinguish stall from fault. The classification LANDS (it is a terminal classification of the smoke, never an unmarked overrun of the bound), and the gate then closes by the R2 default: **the executor runs the verified emergency re-hold pair (re-pause, then re-halt — §7.3's order and read-back verifications) as the suspension's closing acts, and the gate ends HELD.** There is no soak and no retry. Resumption is not a re-convening of this gate: it requires **Julie's FRESH GO through a new gate**, which re-censuses the still-standing plan under P-5 and gives it its own disposition there. The incomplete plan is left exactly as it stands (§2.3's disposition). **The sole exception**: Julie's explicit contemporaneous direction (her word in the moment, recorded verbatim in the gate record) to leave generation enabled — which is valid only with (i) a **bounded observation period** named in the direction (a clock end or an interval; at its expiry, without a fresh direction, the re-hold pair runs as the default act — an extension requires a fresh contemporaneous direction, never an executor roll-over), and (ii) **named responsibility** for the watch and the report at the bound (Wren, unless Julie names another)."

**Mechanics note (why the default is executable during the fault it answers).** The standing WAIT law governs generation acts during a platform fault — no feeding, no restarting, no retrying — and R2 authorizes none: the re-hold pair contains no generation act and touches no plan. The pair's two acts and their read-backs live on the Cloudflare control plane (the queue `delivery_paused` PUT and the script-settings `GENERATION_HALT` flip, both via cf-api) — not on the DO-backed `/v2` routes whose 500/1101 failures form the fault signature. The pair can therefore ordinarily be executed AND verified while the fault stands. **Verification caveat, stated as a rule**: if either act's read-back cannot be obtained, the re-hold stands in the record as UNVERIFIED — reported immediately, treated as not-safely-held until the verification lands, and never claimed as HELD on the executor's assertion. (Wren's reading, flagged as such: so read, R2 and the WAIT law compose — the fault still gets no generation and no diagnosis-by-mutation; the gate simply does not idle open while everyone waits.)

**§2.5, conformed clause**: the named-state list now reads "(FAILED-and-re-held, SUSPENDED-BY-FAULT-and-re-held (or under a live R2 exception), or TURNED ON UNDER OBSERVATION with the soak still running)".

**The no-indefinite-enabled predicate (new, gate level)**: at every moment after the halt lift, the gate record must show exactly one of — (i) an active named phase running inside its own bound (the smoke inside its decision bound; the soak accruing); (ii) a completed, verified re-hold; or (iii) a live R2 exception record (Julie's verbatim contemporaneous direction + its named bound, unexpired + its named owner). Anything else — a pause, suspension, or drift with generation enabled and no live exception — is a gate-record violation: the executor closes it with the re-hold pair immediately and records it as an anomaly. The passage of time is never itself a transition (the correction §2.5, preserved), and under R2 it is never an excuse for an open gate either.

**What R2 does not change**: the FAILED failure close (correction §2.3) already defaulted to the re-hold pair; R2 extends the same posture to SUSPENDED-BY-FAULT and removes the one asymmetry. §2.2(a)/(b), the decision bound, the soak-entry set (§2.4), and every S3/S4 mechanism stand as accepted.

### 6.3 The FULL R2-conformed GO passage (one operative text, for Rowan's review — NOT for presentation)

> "GO — execute the Standard turn-on gate under the revised design as pinned at `<DESIGN-PIN>`, as corrected at `<CORR2-PIN>`: a fresh execution census against the fifteen A1 predicates (the script etag captured and saved as an evidence artifact before any act; containment NORMAL; conflicts exactly the four baseline rows; the five baseline plans all terminal and none held; the parked Chapter 3 job `parked_policy` revision 1, untouched; settings revision 1; quota reconcile ok with the sole known straddler; phase figures and sync watermarks at their design values; the recorder alive with a standing registration; the smoke chapter's quote reproduced; and the OQ-5 post-gate duty closed on its two named artifacts — the first scheduled run's log entry and the termination record) — any predicate failure or unexplained movement stops the gate before any act and returns for ruling; **then the S1 enforcement step**: one deploy of the S1 enforcement candidate as pinned at `<S1-CAND-PIN>` and independently reviewed (the single `admitPhaseRegistry` branch, `book_not_onboarded`, gated on the enforcement construction; the deploy manifest compared part-by-part against the live build's — exactly the one service part differing, the other thirty byte-identical; etag and observability verified after; the gate still HELD throughout), post-deploy predicates re-verified, and exactly one verification intent submitted by Wren for a named unonboarded book, null phase, REQUIRED to be refused `book_not_onboarded` with zero state movement verified after it — the sole exception to this GO's no-Wren-submission bar, and if the probe is admitted or moves anything, the gate stops and ends HELD; then exactly two further counted production acts, in order: one halt lift (the metadata-only envelope flip of `GENERATION_HALT` to `"0"` against the enforcement build, all script parts byte-identical to it, etag and observability verified after) and one queue unpause (cf-api, read back); then the bounded smoke — I submit Forever Pucked Chapter 4 (chapter scope, `keepGoing` off, Standard lane, phase forever-pucked; expected 20 segments ≈ 375,535 units) from my own app, or another single chapter I name when I give this GO — observed read-only under the sliding 35-minute stall test and the A-7 recorder discipline, **inside a four-hour decision bound from my submission**, landing exactly one classification: COMPLETE (the full A3 evidence set: plan done 20/failed 0, exactly 20 new bindings, watermark 1862, the three-line exposure report), FAILED (a declared stall, incompleteness at the bound, a fired trigger, or an unattainable evidence set — the gate attempt ends and the re-hold pair runs as its failure close unless I direct otherwise at the time, the incomplete plan left exactly as it stands), or SUSPENDED-BY-FAULT (a verified 1101-class platform fault — the verified emergency re-hold pair runs as the suspension's closing acts and the gate ends HELD, resumption only under my fresh GO through a new gate; the sole exception is my explicit direction in the moment to leave generation enabled for a bounded period I name, with Wren named responsible for the watch and the report at its end — at its expiry, without my fresh direction, the re-hold runs; no paused or suspended state of this gate leaves generation enabled by default); and my playback of the chapter as the smoke's acceptance, outside the executor's verdict; then — only when the soak-entry set stands complete (the smoke COMPLETE, its accounting check clean, my playback acceptance recorded, the observation arrangement verified active in its three soak-entry items, P-14 closed) — a seven-day soak of seven CLEAN observation days (a missed-read day extends the soak day-for-day and is covered by the next check's gap comparison; two consecutive missed days, or any anomaly undispositioned 24 hours after its report, pause the soak in place until disposition), during which I may submit further Standard intents for onboarded books (Forever Pucked) inside their phase budgets, under the soak restrictions (no Batch, no mid-soak onboarding, no settings writes, no operator-route acts, no further deploys except under separate authorization) and the daily `normal-ops-daily-check` observation (owner Wren; QUIET / MOVEMENT / ANOMALY classifications; the accounting checks as designed, with unresolved findings blocking any declaration unless I disposition them in writing, named in the record); the emergency re-hold standing throughout — my word at any time, or Wren's preauthorized act on any of the nine enumerated triggers as refined (every trigger evaluated on its named evidence source; an unreadable source never counts as a pass; T-8 decided only by the bounded-recheck protocol, in which the settings binding and the queue state are authoritative and capabilities/health are projections) — executed as exactly two verified acts (re-pause, then re-halt) with immediate reporting, after which any re-turn-on needs my fresh GO through a new gate; **NO Batch arming or Batch act of any kind, NO book onboarding (no budget deploy, no phase-binding record), NO quarantine release, NO plan retirement, NO adjudication or reconcile act, NO settings write, NO SubmitJob by Wren except the single named verification probe, NO containment transition**; on success the gate ends TURNED ON UNDER OBSERVATION — the holds stay lifted by design — and normal operations are declared only on the full A6 set (the accepted smoke, seven clean soak days, clean-or-dispositioned end-of-soak accounting, no unresolved anomaly, the filed execution record with Rowan's acceptance, and my confirmation of the app experience), never on the smoke alone; on any abort or suspension after the lifts the re-hold pair runs (a suspension's R2 exception aside), the gate ends HELD, and the soak is void. I understand the per-book budget law (Q1) is now TECHNICALLY ENFORCED by this gate's own deploy: only Forever Pucked is onboarded, an unonboarded book's submission is refused `book_not_onboarded` by the server, and any other book requires the onboarding procedure under its own authorization before it can generate."

**Delta from the correction's §5 passage** (enumerated so Rowan can rule on the changes alone): (1) **R2** — the SUSPENDED-BY-FAULT clause is replaced: the suspension now closes by the verified re-hold pair and ends HELD, resumption only under a fresh GO through a new gate, with the sole exception in its ruled shape (explicit contemporaneous direction + a named bound + named responsibility), and the no-indefinite-enabled rule stated expressly in the passage. (2) **R1** — the S1 deploy step now deploys the candidate **as pinned at `<S1-CAND-PIN>` and independently reviewed**, with the one-part manifest comparison named in the passage itself; the gate no longer builds what it deploys. (3) The closing abort sentence is conformed to include suspension ("on any abort or suspension after the lifts…"). Everything else is carried verbatim from the correction's §5.

---

## 7. What this specification is not — boundaries

- **Not code, not a candidate.** This document specifies a one-branch change and the battery that will verify it. No file in the composed tree (or anywhere) was modified in its preparation; no battery was run; no candidate exists yet. The ruling's caution is adopted as this document's own: the design is not an already-built candidate.
- **The next steps, in the ruling's order**: Rowan's review of this specification → the implementation return (the candidate tree, the battery file, one complete battery run's full log + exit code, the manifest comparison — pinned before review) → Rowan's independent review of the built candidate → presentation of the §6.3 GO passage to Julie for her separate GO. Only inside that GO do the §5 probe and the lifts exist.
- **No production or staging act** of any kind is authorized by this document or by the ruling it answers: no deploy, no hold lift, no queue change, no submission, no provider call. Production remains HELD at NORMAL.
- **WS2 is untouched** by this document; the B-G2 scope pass and its B2-R1..B2-R4 items proceed (or not) in their own return, under their own approvals.
- **Open items carried**: none new. The five PROPOSAL parameters of the correction stand as the ruling accepted them (the refusal name, the four-hour bound, the T-8 recheck shape, the 24-hour disposition deadline, the failure-close default) — R2 ruled the suspended-smoke default outright, and it is conformed at §6, not carried as a proposal. P-14's evidence (the post-gate watch's first scheduled run, Fri 2026-11-06 18:28 ET, + the termination act) remains a gate-time predicate, evaluable when the gate is presented.

— Wren (drafted 2026-11-06; WS1 S1 build specification + battery + R2-conformed GO, specification only, for Rowan's review)
