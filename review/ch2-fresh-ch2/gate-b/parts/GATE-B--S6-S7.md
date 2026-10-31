## 6. Accounting treatment — what the counter counts, and what it never claims

### 6.1 Requests, not billing

CONFIRMED: the quota guard counts **provider dispatch requests**
(the calls the old counter could not see — up to 12 per grant). It
does not measure, estimate, or settle money. Google billing remains
what it has always been in this case: day-level aggregates only;
per-request cost is unknowable retroactively; nothing in gate (b)
changes that, and no figure produced by B1–B3 may ever be quoted as
a provider charge.

### 6.2 Two ledgers, kept separate

Grant-time **estimates** (the old counter's world: 19,652 units per
grant) and per-dispatch **reality** (the new ledger's world) are
different instruments. Gate (b) does not restate one in terms of
the other, does not true-up estimates into actuals, and does not
touch the phase accounting: settled **579,339**, estimatedUnverified
**19,018**, reservedUnverified **5,648**, unknownOpen **0**,
remaining **12,915,013** — all five figures are byte-identical
before and after gate (b), because the quota ledger and the phase
ledger are separate books.

### 6.3 The already-adjudicated attempt — flagged, not silently handled

The one mystery attempt from the original Chapter 2 halt,
`att-37d63768-db4b-447d-8150-580b7c6ee257`, was disposed in the
separate adjudication case as **`estimated_unverified`**: its
`cost_micro_cents` stays **NULL**, its estimate (19,018) and
reservation (5,648) stand as recorded, and its actual Google charge
remains **UNKNOWN**. Gate (b) does not revisit, re-price, or
re-label it.

If — hypothetically — that attempt surfaced in the B2 census as a
bootstrap exception with a provably single-day interval, a B3
disposition would add only a day-key assignment and its provenance
block to the *quota* ledger; it would not touch the adjudication
record. Wren flags this interaction explicitly rather than deciding
it inside this proposal: **no disposition naming that attempt will
be presented as a routine B3 item** — if it ever arises, it gets
its own named callout to Julie and Rowan first. (Expectation: it
does not arise — its interval is a straddle by construction of the
split that created it, and multi-day intervals are never
dispositionable under §7 in any case.)

### 6.4 Over-limit days and unresolved items

- A historical PT day whose proven dispatch total exceeds 100 is
  recorded as `day_over_limit` drift and named in the record with
  its total. It is a fact about the past (the old counter could not
  see per-dispatch calls), not a violation to be repaired.
- **Winner provenance** (which pre-existing objects won the eight
  fingerprint collisions in the Gate-8 run) remains **UNRESOLVED**;
  gate (b) neither needs nor performs the gated R2-HEAD read that
  could close it.
- The three `schedule_dead` conflict rows are **not cleared** by
  gate (b) (Rowan's gate-(a) ruling); the underlying lease SQL error
  remains a known issue, out of scope here.

---

## 7. B3 — dispositions: a presentation protocol, not a pre-approval

B3 exists only if the B2 census surfaces exceptions. This proposal
pre-approves **none** of them. Each disposition is its own
sub-decision, presented to Julie individually with:

1. the attempt's identity (attempt id, plan, occurrence);
2. its evidence interval `[created_at, updated_at]` and the proof
   that the interval lies inside exactly one PT day;
3. the single provable day-key it would be assigned to;
4. the expected effects (exception removed; that day's total
   incremented by one; whether the day crosses the cap — named
   before the call, never discovered after);
5. the verbatim refusal possibilities (below);
6. Julie's approval recorded as the call's `authorizationRef`.

**Store law (CONFIRMED from source, applied in order):** a
multi-day interval is refused `quota_disposition_ambiguous_interval`
**before** any bounds check — no authorization, Julie's included,
can make a straddling interval dispositionable; an out-of-interval
or non-real-calendar day-key is refused; a malformed stored row is
refused rather than guessed; disposition is exactly-once (a second
call for the same attempt refuses); a disposition that pushes a day
over the cap is **recorded with its over-limit consequence named**,
and `reconcileQuota` thereafter reports that day as drift until the
clock leaves it — disposition never manufactures `ok: true`.
Unexpected store faults surface as HTTP 500 faults, never laundered
into 200-style rejections (the routes-fix hardening).

Before **each** B3 call, the B0 queue-pause read-back is repeated
(cf-api; the Worker cannot read pause state). Any fault or refusal
stops B3 at that item; completed dispositions stand as recorded
(they are additive records, §9), the rest are not attempted.

---
