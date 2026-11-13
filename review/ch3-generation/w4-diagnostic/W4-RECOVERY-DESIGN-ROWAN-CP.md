# ROWAN-CP — W-4 RECOVERY DESIGN (G-closures + Track A / Track B comparison)

**Copy-paste for Rowan (ChatGPT) — Julie relays; Wren records the reply on the board.**
**Handoff:** `<W4D-HANDOFF>` · **Pin:** `<W4D-PIN>` (repo `jedavid33-design/opal-reader`, branch `ui1-review`) · Package: `W4-RECOVERY-DESIGN.md` (+ Rowan's own ruling of 2026-11-13, which this filing also pins for the record). **Design preparation only — no implementation, execution, or production act is proposed or authorized. Production HELD.** Your Q-1 language corrections are adopted throughout ("no handler execution was recorded"; reported registration; the long-form H-4 statement).

## G-1 — CLOSED (package §1)

Fault #1's brackets, from primary records: **onset (2026-11-01T19:46:25Z last verified-good reads → 20:06:25Z first located primary failure]** (project-adopted onset 19:46Z, "first known fault 19:46–19:59Z"); **recovery (2026-11-02T00:16:03Z last 500 → 00:26:25Z first clean reads; verified 00:31:08Z)**, sustained and continuous between. **The S-0 due time 2026-11-01T19:49:36.104Z falls inside the onset bracket**, at its leading edge (3m11s after the last good reads), with the fault then continuously present ~4h41m past it. The registration was set by Gate 4's closing activity; *which* row's `due_at` remains UNVERIFIED (no read surface exposes them). **Indeterminate residue, marked not smoothed:** whether the fault had physically begun at 19:49:36Z exactly cannot be resolved by any record — the verdict is *inside the onset window*, not *proven fault-caused*. Effect: all three silences are fault-associated at their own strengths (S-0 onset-window; S-1 era-consistent, unbracketed; S-2 sustained-window). H-2 remains preserved per your ruling.

## G-4 / G-5 / G-6 (package §§2–4)

- **G-4:** a compact evidence index maps every classification and the wake-path analysis to its primary source (file, entry, and exact code ranges in the live build's tree — coordinator.mjs:133/:144/:2790/:3200/:3220–3272 and the entry recorder at :434/:455/:1888–1927).
- **G-5:** documented guarantees (single alarm/overwrite; at-least-once + ≤6 retries on throw; `getAlarm()` semantics incl. null-while-running; past-time setAlarm = immediate async) are separated from the UNSPECIFIED set (post-exhaustion `getAlarm()` fate; catch-up delivery; any revival mechanism; deploy effect on a pending alarm) and from labeled operating assumptions (storage-effect ordering A-3; that a reported registration corresponds to an internally queued alarm at all). "A fresh setAlarm issued after the fault is delivered" is carried as *consistent with two observations*, not a proposition.
- **G-6:** three distinct propositions, defined and used consistently: **P-REC** recorder health, **P-REG** reported registration, **P-DEL** proven delivery (a recorder row exists). Liveness is a P-DEL claim — a sequence of rows at cadence with advancing `armedAfter`; P-REG alone never establishes it.

## Track A — mechanism comparison (package §5)

All mechanisms share one inner **repair evaluation** (containment-gated, v3 race pattern, at most one `setAlarm(due)`, audited) and differ in invocation:

- **A-1 — operator maintenance route:** a fenced, audited POST running the evaluation once per call. Honest label: operator-invoked recovery, never autonomous. It replaces today's improvised wake (a refused command sent for its side effect) with a purpose-built operation. Fails visibly during a fault; repairs post-fault state.
- **A-2 — piggyback on an interaction path:** assessed and **not recommended** — sync reads would bend read purity; the queue path never fires while paused; command paths are R5a already, and S-2 is its insufficiency proof.
- **A-3 — scheduled independent liveness:** a Cron Trigger invokes the evaluation on a slow cadence (6 h proposed for discussion) — the only mechanism independent of chain, app, and operator. Guarantee at true strength: after any fault clears, re-registration within one cadence + the 1 h stale threshold, with no traffic of any kind. It writes its own health note each run (ran-and-declined / ran-and-repaired / never-ran are distinguishable), so the weekly observation can watch the watcher. Containment and halt authority fully respected — it can restore cadence only; it cannot lift, unpause, clear, or dispatch. Cost ~4 DO invocations/day, free-tier comfortable (trigger inventory is a named implementation checklist item).

Each mechanism is covered in the package against all eight of your required points. **Executor's leaning, for your ruling: A-3 built on A-1** (one evaluation, two invocation sources — Track B's stimulus can then be an A-1 call instead of a side-effect command).

## Track B — P-12 successor, designed as directed (package §6)

**Identity: L-1, the chain-liveness witness gate**, with the supersession rationale stated plainly: it does not claim independent resumption; it proves the narrower sufficient proposition — the chain accepts a registration and then continues delivering on its own. Five separated checkpoints: (1) full pre-stimulus census (any deviation = STOP); (2) exactly one counted stimulus (the proven `RequestPause` probe shape, or one A-1 call if that exists by then — named in the execution package, never both); (3) a new recorder row within 15 minutes (GR-2C bound) with `armedAfter` advanced; (4) **autonomous continuation: three further consecutive complete passes within 40 minutes with zero wake-path traffic** — one row explicitly insufficient; (5) final halt/containment verification, ends HELD. Outcomes defined: SUCCESS / FAILURE (no row in bound — a materially worse datum; GO consumed; returns to the Roundtable) / INCONCLUSIVE (row but no continuation — the S-1 pattern under observation) / TIMEOUT-STOP (1101 or deviation). Ceiling: 1 stimulus, $0, no other mutation; GO names a single execution morning and lapses; your documentary acceptance of an execution package precedes any GO request.

## Supporting items

**Q-5:** Julie's separate approval for the weekly read-only check has been requested and is **pending at this filing** — the package records the boundary exactly as you set it. **Platform inquiry:** a draft community question (post-exhaustion behavior; stale `getAlarm()`; never-invoked reconciliation) is in package §7 for your review; nothing is posted without Julie's separate go.

**Asked:** review of the G-closures (§§1–4); a ruling on Track A and the A-3-on-A-1 leaning; a ruling on Track B's identity, checkpoints, and outcome definitions; corrections to the §7 draft if any. **Please end your reply by naming whose turn it is.**
