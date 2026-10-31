# QUOTA ROUTES CORRECTIONS — BUILD REPORT

Repo-only correction build answering Rowan's NARROW SOURCE HOLD
(board comment **6546277727**, issue #15,
`jedavid33-design/opal-roundtable` — read in full before
building). The hold ACCEPTED the operator routes'
authentication design (the operator-alone fence class stands;
the seed route's both-tokens shape is NOT required) and the
Option-3 combined sequencing; it held the ROUTE ADDITION only,
on three corrections + one non-blocking hardening item. The
source-passed cache/quota core was NOT held. Rowan ruled the
corrections fit Julie's existing route-build approval
(**6546054510**) — no new Julie go was needed or sought.

Baseline: `~/workspace/ch2-program/quota-routes/` (the reviewed
routes tree, pin `60c5b900…`), copied to
`~/workspace/ch2-program/quota-routes-fix/` and corrected
there. The baseline tree is untouched. (The previous stage's
build report, which the copy carried at this path, remains of
record in the untouched `quota-routes/` package.)

**No production contact. No deploy. No GitHub posts or pins.**

Labels: **CONFIRMED** = verified firsthand in this session
(command output / firsthand source read). **INFERRED** =
follows from cited source or arithmetic, not independently
executed. **OPEN** = not resolved here.

---

## 1. Correction 1 — strict bootstrap body handling — CONFIRMED

**Before.** The public entry parsed the bootstrap body with
`await request.json().catch(() => null)` and forwarded
`JSON.stringify(body ?? {})` — a malformed body was coerced to
`{}` and BOOTED the guard. The DO handler in turn treated
`body === null` (unparseable OR explicit `null`) as
admissible, skipping all figure/key validation.

**After — exact semantics.**

- **Public entry:** the bootstrap body is forwarded as **raw
  text** (`await request.text()`, verbatim) to
  `/internal/d6/quota-bootstrap`. No parsing, no coercion at
  the entry.
- **DO handler** (enforcement here is bypass-safe — a direct
  internal call is held to the same contract): the body is
  read as text **after** the stamp and halt fences, **before**
  `bootstrapQuota` is constructed/called, so a refusal happens
  before any quota schema, attempt stamp, dispatch row, or
  bootstrap marker can exist.
  - Genuinely absent/empty body (or whitespace-only) → applies
    (the figureless shape).
  - Explicit `{}` → applies. Any other well-formed JSON runs
    the pre-existing shape validation unchanged (bare number →
    `quota_bootstrap_figure_caller_supplied`; string/array →
    `quota_bootstrap_request_not_figureless`; figure keys →
    `quota_bootstrap_figure_caller_supplied`; foreign keys →
    `quota_bootstrap_request_key_not_allowed`).
  - Syntactically malformed JSON → HTTP 200
    `{ outcome: "rejected", reason:
    "quota_bootstrap_body_malformed" }`.
  - Explicit JSON `null` → HTTP 200
    `{ outcome: "rejected", reason: "quota_bootstrap_body_null" }`.
- The disposition forward keeps its pre-existing JSON
  pass-through (Rowan's correction named the bootstrap path;
  the disposition handler validates its own body shape against
  a closed allowlist inside the DO).

**Proof — QROUTE-16.** Malformed JSON, explicit `null`, and a
malformed figure payload (`{"assignedCount": }`), each WITH
the correct operator credential through the public entry:
named refusals, attempt/execution/dispatch/meta snapshot
byte-identical, `d6_provider_dispatches` table never created,
no bootstrap marker. The malformed and null bodies are then
sent DIRECTLY to the DO handler (stamp admitted): identical
refusals — enforcement is at the handler, not the entry. A
subsequent no-body request applies (`alreadyArmed: false`,
`assigned: 2`): the refusals are not sticky.

## 2. Correction 2 — reconcile pagination — CONFIRMED

**Before.** `GET /v2/d6-quota-reconcile` returned
`exceptions.slice(0, 100)` + count/truncation with no paging;
a straddling exception can never be dispositioned (Hold-B
law), so it never leaves page 1 and a >100 census was
unenumerable.

**After — exact semantics.**

- Query params `exceptionOffset` and `driftOffset`
  (independent per array), forwarded verbatim by the public
  route (only these two keys) to the DO handler.
- Strict validation at the DO handler: absent → 0; otherwise
  must match `/^(0|[1-9]\d*)$/` and be a safe integer, else
  HTTP 400 `{ error: "quota_reconcile_offset_invalid" }`
  (a request-shape error, deliberately NOT a domain
  `rejected` shape — a census runner treats non-200 as a
  failed page, per the plan's STOP rule).
- Fixed page size: `QUOTA_ROUTE_DETAIL_LIMIT` (100).
- Response, per array: the page slice, the EXACT total
  (`exceptionCount` / `driftCount`), the applied offset
  (`exceptionsOffset` / `driftOffset`), a next-page signal
  (`exceptionsNextOffset` / `driftNextOffset` — the offset of
  the next page, or `null` on the last page), and the
  truncation flag (true exactly when more entries remain
  beyond this page).
- `censusComplete`: `true` only when a single response
  (offsets 0) contains both arrays whole (both next offsets
  null). A truncated or mid-census page never presents as the
  complete census.
- Ordering: exceptions page in the store's own deterministic
  order (`bootstrapExceptions`: `ORDER BY created_at,
  attempt_id`); drift is sorted at the route by a stable key
  (kind, reservationId, attemptId, dayKey, serialized entry)
  before paging, because `reconcileQuota` assembles it from
  several unordered queries. Paging is a pure read: offsets
  address positions in a freshly computed report, and repeated
  reads return identical pages (asserted).
- The unarmed floor shape is returned before any pagination
  handling — D4's view is unchanged.

**Plan text (REVISED-DEPLOY-PLAN.md, updated copy in this
package).** §4.2: the truncated-bootstrap-list finding now
routes to B2's pagination ("never by repeated first-page
reads, which cannot advance past un-dispositionable
entries"). §4.3 rewritten: B2 is a paginated census that must
be COMPLETE before it means anything; **STOP and archive the
report as INCOMPLETE — the gate does not close and no B3
decision rests on it — if any page is missing or fails, if a
total count changes unexpectedly mid-census, if pages overlap
or do not sum to the reported totals, or if read-back
fails.** The old "page the full set via repeated reconciles
as dispositions land" language is REMOVED. §4 route inventory
and §8 summary updated to match.

**Proof — QROUTE-17.** The 107-all-straddling-exception
census (QROUTE-15's fixture extended): page 1 = 100 items,
total 107, nextOffset 100, truncated, `censusComplete:
false`; page 2 (`exceptionOffset=100`) = 7 items, nextOffset
null; the two pages are disjoint and their union equals the
DB-derived exception set exactly; page 1 re-read is identical
(stable ordering); **zero disposition calls** — all 107
attempts remain unstamped and the dispatch ledger holds only
the bootstrap's 2 assigned rows. Invalid offsets (`abc`,
`-1`, `1.5`, an unsafe-integer string, `driftOffset=-3`)
refuse 400 with the named error and move nothing. Drift:
105 inserted reservations with stale stored counters page
100 + 5, disjoint and complete, all
`slots_consumed_mismatch`.

## 3. Correction 3 — reconcile read purity — CONFIRMED

**Before.** The DO reconcile handler called
`await cache.flush()` after `reconcileQuota`; `flush()`
carries a conditional R2 `bucket.put` path, so the "read"
could write to R2 depending on cache state.

**After.** The `cache.flush()` call is REMOVED from the
reconcile handler — the only change of its kind: no other
handler/route was touched (adjudicate, retire, seed,
bootstrap, and dispose handlers keep their historical
flushes), and `host/adapters.mjs` is untouched (byte-identical,
§5). The quota SQL path remains SELECT-only
(`reconcileQuota` unchanged — `quota-budget.mjs`
byte-identical, §5). Output stays bounded — now paginated
(Correction 2).

**Proof — QROUTE-18.** After a normal boot, the DO instance's
`_cache` is replaced with a REAL `createR2AudioCache` over a
counting fake bucket, holding one staged pending entry
(`putIfAbsent`). The reconcile GET returns the armed report
(exceptionCount 2) with **bucket PUT count 0**, the
attempt/execution/dispatch/meta snapshot unchanged, and the
pending entry still pending afterwards — a manual
`cache.flush()` then flushes exactly 1 (PUT count 1),
proving the GET neither flushed nor consumed it.

## 4. Hardening — disposition error laundering — CONFIRMED

**Before.** The disposition handler caught EVERY store error
and returned HTTP 200 `{ outcome: "rejected", reason: <first
token of the message> }` — an unexpected SQLite/runtime fault
was indistinguishable from a domain refusal.

**After — exact semantics.** The catch now matches the
store's named domain refusals explicitly — first token
`attempt_not_found` or matching `/^quota_[a-z0-9_]+$/` (the
`disposeBootstrapException` vocabulary:
`quota_disposition_authorization_required`,
`quota_disposition_day_invalid`,
`quota_disposition_not_an_exception`,
`quota_disposition_ambiguous_interval`,
`quota_disposition_day_outside_evidence_interval`,
`quota_disposition_unattributable`) → HTTP 200 `rejected`
with that reason, unchanged. ANY other error is **rethrown**:
the class fetch's top-level catch answers HTTP 500
`{ error: <message> }` — the same fault shape as the entry
file's other handlers. The store's accounting contract does
not change (`quota-budget.mjs` byte-identical).

**Proof — QROUTE-19.** A same-day, attributable exception
with malformed stored `detail_json` makes the store's
`JSON.parse` throw a `SyntaxError` (an unexpected fault, not
a named refusal): the route answers **HTTP 500** with an
`error` string and NO `outcome` field, and the snapshot is
unchanged (the store's transaction rolled back). Contrast in
the same world: the straddler's domain refusal still returns
HTTP 200 `{ outcome: "rejected", reason:
"quota_disposition_ambiguous_interval" }`. QROUTE-12 (all five
named refusal passthroughs) and QROUTE-11/13/14 continue to
pass unchanged.

---

## 5. Change surface — before/after SHA-256 — CONFIRMED

Exactly three files differ from the `quota-routes` baseline
(whole-tree recursive diff; `v2/` is the mirror of `worker/`,
same hash):

| File | Before (quota-routes) | After (quota-routes-fix) |
|---|---|---|
| `worker-build/worker/worker-entry-prod-d6.js` (+ `v2/` mirror) | `91ab9d5c3ef1afc1a9d45fb74e66691a24c93d4298ba53ae962ee372b9898e51` | `d862612e6d3291047f06b7c0544845fe87b8ee7fa70ba73f4455c718315a35ff` |
| `worker-build/tests/quota-operator-routes.test.mjs` | `f68eaed8dcbb7580000c4fe631ad2fa7cf92290f92a9644b83062455329c6fdc` | `63386e30b7a5d34da83948a0802566a7e72237e516347cecd2e175bf1b4ddf8a` |
| `REVISED-DEPLOY-PLAN.md` | `3303d3e70353dfa38edb2d72a85ceca0c7c322bbe74db79d6abd8b40bc775235` | `8f28bc36433d44cadb9f2c63daaf4c01e358e1cf9cd5f961840a4106bb328027` |

Byte-identical (protected): `worker/generation/quota-budget.mjs`
`2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820`
in both trees; `worker/host/adapters.mjs` and every other file
in the tree — the recursive diff lists ONLY the three files
above. Test-file delta: +1 import (`createR2AudioCache`), +4
tests (QROUTE-16..19), +1 fixture helper (`seedStraddlers`);
QROUTE-1..15 unmodified. Plan delta: §4 route inventory
(pagination + read purity), §4.2 finding language, §4.3
census procedure + INCOMPLETE stop rule, §8 gate-(b) summary
line. Entry-file delta: 5 edit sites (DO bootstrap body
handling + comment; DO disposition catch + comment; DO
reconcile handler — flush removed, pagination added; public
bootstrap forward → raw text; public reconcile forward →
offset forwarding). No envelope/stamp change: this package
does not recompute the deploy envelope — the deploy proposal
must be re-derived from this tree (per amendment 4 of
6546037460, counts are harness outputs, not assumptions) when
the parent files the re-pin.

## 6. Battery — before/after — CONFIRMED

Full battery on the final `quota-routes-fix` tree
(`run-battery.sh`, copied from the baseline package):
**135 suites, 113 pass / 22 fail; 1,098 tests, 1,076 pass /
22 fail; runner exit code 0** (`logs/battery-exit-code.txt`).
Baseline (`quota-routes/logs/`): 135 suites 113/22; 1,094
tests 1,072/22. **Delta: +4 tests, +4 passes, +0 failures —
exactly QROUTE-16..19.** The 22 failing-suite set is
**programmatically identical** to the baseline's
(`diff` of the sorted `logs/failing-files.txt` lists — empty).
Route suite: 19/19. Quota store suites: budget 13/13,
corrections 7/7, executor 10/10, park-concurrency 2/2,
park-governance 4/4, probe 2/2, rereview 2/2 — all green,
unchanged.

Deliverables in this package: this report,
`REVISED-DEPLOY-PLAN.md` (updated), `worker-build/` (the
corrected tree), `logs/` (full battery log, exit code,
summary, failing-files, per-file logs).

## 7. OPEN / notes for the re-review

- **OPEN (parent, not this build):** re-pin of this exact tree
  as a child of `60c5b900…` on `ui1-review`, the filing, and
  the operational re-proposal of the combined deploy — the
  main agent's steps, out of this task's scope.
- **INFERRED:** the disposition domain-matcher covers the
  store's current throw vocabulary (enumerated from
  `disposeBootstrapException`'s source in the byte-identical
  `quota-budget.mjs`); any future store refusal outside the
  `quota_*` / `attempt_not_found` vocabulary would surface as
  a fault until the matcher is extended — fail-closed by
  design, and the safe direction for an accounting route.
- Nothing in this package authorizes a deploy, a bootstrap
  call, or any production contact. Turn: Rowan's (re-review of
  the exact combined tree).
