## 5. B2 — the complete paginated reconcile census

### 5.1 The surface

`GET /v2/d6-quota-reconcile` → `reconcileQuota(coord)`
(quota-budget.mjs L478–542), via the operator connector (GET; the same
admitted-stamp operator fence as the sibling routes applies; the
handler is read-only — it performs no mutation of any kind (the
routes-fix read-purity correction removed its last incidental write
path).

`reconcileQuota` reports, for the whole recorded history:

- `armed` — whether the durable bootstrap record exists;
- the per-day dispatch totals derived from `d6_provider_dispatches`;
- the outstanding-reservation totals derived from
  `d6_grant_reservations`;
- `exceptions` — recorded dispatch rows whose day could **not** be
  assigned with proof at bootstrap (the unassigned residue);
- `drift` — every way the derived totals disagree with what the
  records claim, each entry named (including `day_over_limit` for any
  PT day whose proven total exceeds the app-selected cap of 100);
- `ok` — defined in §5.2.

### 5.2 What `ok` means

CONFIRMED from source: `reconcileQuota.ok === true` exactly when
**the drift list is empty AND no current-day block exists** (no
exception or drift entry touches the current PT day in a way that
would fence new dispatch). An over-limit historical day is drift —
it makes `ok` false truthfully; it is never absorbed, averaged, or
renamed. `ok` is a statement about the accounting records only; it
grants nothing by itself (see the re-arm law, §10).

### 5.3 The pagination law

The exceptions and drift arrays page at a **fixed size of 100** via
`exceptionOffset` / `driftOffset` query parameters, forwarded to the
DO and strictly validated (`/^(0|[1-9]\d*)$/` plus a safe-integer
check; anything else is refused `quota_reconcile_offset_invalid`
before any read). Each response carries the per-array **total**, the
**next offset** (or null at the end), and `censusComplete` — true
only when every array has been walked to its end under stable
totals. Exceptions are returned in the store's deterministic
`created_at, attempt_id` order; drift entries are stably sorted at
the route. (Suite proof at build time: QROUTE-17 enumerated 107
all-straddling exceptions as disjoint pages of 100 + 7 whose union
equals the stored set, with zero disposition calls.)

B2 is **complete** only when all of the following hold: pages are
pairwise disjoint; their union equals the reported totals for both
arrays; the totals are identical on the first and last page (no
movement during the census); and `censusComplete` is true on the
final page.

**Queue-pause checkpoints during B2 (explicit; the same law as
B0 §3 and B3 §7).** The Worker cannot read queue pause state
(send-only binding), so pause is proven by cf-api read-back at
exactly these checkpoints: **C-1** in B0, immediately before the
B1 call; **C-2** after B1, immediately before the first census
page; **C-3** at census completion, before any outcome (§5.5) is
declared; **C-4** before *each* B3 disposition call (§7). A
read-back showing `delivery_paused != true` at any checkpoint is
a STOP under §5.4(6) during B2 (archive INCOMPLETE) and a hard
stop at C-1/C-4. No checkpoint is skippable, and no other
checkpoints are implied — the list is the whole list.

### 5.4 STOP-and-archive-INCOMPLETE conditions

B2 stops, and the census is archived explicitly as **INCOMPLETE**,
if any of the following occurs:

1. a page request faults (HTTP 500-class) or returns a refusal;
2. totals change between pages (movement during the census);
3. pages overlap, or their union does not equal the reported totals;
4. `censusComplete` never becomes true at the reported totals;
5. any entry cannot be parsed into the documented shape;
6. the queue-pause read-back (B0 law) fails at any checkpoint.

An INCOMPLETE census closes nothing: gate (b) does not proceed to
B3, no end state is declared, and the partial census is filed as
evidence with the gap named. A later census requires Julie's fresh
word if it would run under a new session.

### 5.5 The three outcomes

| Outcome | Condition | Consequence |
|---|---|---|
| **Clean** | Census complete; `ok === true` | Gate (b) may close on the B1+B2 record (subject to the DP-B2 closure rule, §12). No B3 exists. |
| **Explained hold** | Census complete; `ok === false`; **every** drift/exception entry enumerated and individually explained in the record | Gate (b) may close as a *documented accounting hold* only. Re-arm remains fenced by §10 — an explained hold is never re-arm clearance. B3 may be proposed for provably same-day exceptions only (§7). |
| **Unexplained — STOP** | Census complete but any entry cannot be explained from the records, or census INCOMPLETE | Gate (b) does not close. Everything stays halted + paused; the discrepancy is filed and the next step is a decision for Julie, not an improvisation. |

---
