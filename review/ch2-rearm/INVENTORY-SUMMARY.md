# Gate 7 — stale Chapter 2 work inventory (read-only, 2026-10-31T01:55:55Z)

GETs only — client connector reads, operator diagnostics read,
Cloudflare GETs. No mutation, no provider call. Canonical form:
`evidence/inventory-assessment.json`; raw captures remain local
under `inventory/` (not pinned).

- **Build:** `opalreader-api-v2-prod` at
  `6a73d9622e1b4eac00c58e289de1c674ed6b3d6b`; `/health` generation
  "halted"; `GENERATION_HALT` binding `"1"`; phase policy
  `enforce`; 10 bindings.
- **Retired plan** `plan:603ab416bd67ab1b25de97be`: `retired` /
  `retired_unknown_billing`; chapter scope (ch 1), standard lane,
  phase `forever-pucked`, keepGoing false; 38 entries (20
  `bound_already` + 18 `eligible`, 25,091 chars); plan settled
  179,991; not quarantine-held.
- **Stale job** `plan:603ab416bd67ab1b25de97be:ch1`: `generating`
  rev 2; 18 occurrence rows all `granted`; no quarantine hold.
- **Stale grant** `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full`:
  `issued` rev 2.
- **Execution plane (this plan):** 9 execution records — 8
  `failed`, 1 `unknown_billing`
  (`exec-6a9c4e14-2223-4806-9694-90cd140cbd8e`, the disposed
  attempt's execution; recovery-scan action `reconcile_hold`).
  Zero records in `granted` / `attempted` / `synthesized` /
  `flushed` / `verified`. Attempt census: 51 confirmed = 29
  success + 21 policy_block + 1 `estimated_unverified` + 0
  unknown; disposed attempt cost NULL, estimate 19,018 /
  reservation 5,648.
- **Conflicts:** exactly two `schedule_dead` lease rows — id 2
  (2026-10-30T00:24:14Z) naming the stale grant; id 1
  (2026-10-29T23:54:14Z) naming the completed smoke grant.
- **Queue** `opalreader-generation-v2`: delivery **paused**,
  retention 86,400 s, sole producer + sole consumer
  `opalreader-api-v2-prod`.
- **Settings** rev 1 (standard, $50 cap). **Quota view:**
  attemptsToday 0, spentMicroCents 371,485 (grant-time estimate
  debits, not provider spend), ledgerSeq 19.
- **Phase** `forever-pucked`: settled 199,665; estimated
  unverified 19,018; reserved unverified 5,648; in-flight 0;
  unknownOpen 0; remaining 13,294,687; `provider_unverified`;
  budget 13,500,000.
- **All D6 plans:** the retired Ch 2 plan + the `complete` smoke
  plan — no active plan exists.
- **Chapter 3 job:** `parked_policy` rev 1, no grants, 3 `ready` /
  24 `pending` — unchanged.
- **Not observable:** queue message backlog (no surface; no
  emptiness claimed), the DO outbox table (no read surface), the
  claims table directly (visible only via the two lease conflict
  rows). The proposal's §2 demonstration depends on none of these.
