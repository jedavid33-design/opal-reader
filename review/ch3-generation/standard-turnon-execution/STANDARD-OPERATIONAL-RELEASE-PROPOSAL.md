# STANDARD OPERATIONAL RELEASE — PROPOSAL

Case: Opal Roundtable, issue #15. Date: 2026-11-14.
Prepared under Julie's preparation GO (board comment 6883636191),
following Rowan's Standard smoke-gate execution ruling §6 (verbatim
board comment 6883625102). Documentary only; no production contact
was made in its preparation. This proposal returns for Rowan's
documentary review; a separate execution GO from Julie is required
before any act in it. Production remains HELD.

## 1. What is proposed

Leave Standard generation **LIVE** as the standing state, for one
book — *Forever Pucked* (phase `forever-pucked`) — driven by Julie
through her normal in-app workflow. No window, no closing acts: the
release's end state is LIVE, and it stays live until Julie says
otherwise. Revocation is one word from Julie at any time; re-hold is
the proven two-flip procedure (queue pause + halt flip, ~1 minute,
etag-preserving) executed on her word.

This is deliberately much narrower than the smoke gate: the smoke
proved the machinery under supervision; the release changes only who
initiates (Julie, in-app, at her pace) and how long the state lasts
(standing, not a window).

## 2. Release-boundary census (executed at GO time, before any act)

A fresh census repeating the smoke gate's checks at release strength:
health/build/etag; settings + bindings; queue object; containment;
capabilities + phase accounting; quota + reconcile; all plans and
both known jobs; conflicts (exactly 4); settings revision; sync
watermarks; repair status; recorder liveness on the due-aligned
standard (latest passes complete, delivered within minutes of their
due times, failures 0) **plus** the weekly peek's log since the smoke
gate as continued-liveness evidence; and a fresh whole-book remainder
quote for Forever Pucked. Any unexplained deviation = STOP before any
act, reported to Julie and Rowan; the release does not proceed on an
executor's explanation.

## 3. Scope — what the release covers, and what it does not

Covers: Standard-lane generation for *Forever Pucked* only,
submitted by Julie from the app, chapter by chapter at her pace,
bounded by the existing phase budget.

Does not cover: the Batch lane (WS2 untouched; `batch_not_armed`
stands); any other book (Finding Home and all others remain
unonboarded and are refused by S1 enforcement); operator-submitted
jobs (none — Julie submits in-app); settings changes; quarantine
releases; conflicts-row disposition; any deployment; A-3; any repair
evaluation or acknowledgment.

Remaining work estimate (to be re-quoted at the boundary census):
the whole-book remainder was quoted at 314 eligible occurrences
(≈ $5.84 at model rates) before Chapters 4–5; the smoke gate consumed
42 occurrences for $0.4421 settled, leaving ≈ 272 occurrences and
≈ $5.40 expected — comfortably inside the remaining phase budget of
11,645,806 units (≈ $11.65). The phase budget is a server-side hard
stop: plans park rather than overspend.

## 4. Safeguards relied on (all live today; no new code)

- **S1 phase enforcement**: an unonboarded book's submission is
  refused `book_not_onboarded`; quotes stay open; admission is
  scoped to onboarded phases only.
- **Quota guard**: provider-attempt admission ≤ 100/day (PT), fresh
  cohorts bounded to 12 worst-case slots; reconcile surface live.
- **Phase guard**: per-grant projection against the frozen
  13,500,000-unit phase budget ($13.50); overspend parks the plan.
- **Settings cap**: $50 monthly ceiling (outer backstop; the phase
  budget binds far earlier for this book).
- **Prepay physical limit**: Gemini balance ≈ $15.97 remaining
  (derived from Julie's $16.41 confirmation less gate spend);
  auto-reload OFF; Julie's top-up rule ($20 at a time, from fun) is
  hers alone — nothing tops up automatically, ever.
- **Quarantine machinery**: unchanged; any quarantine event surfaces
  on the plan read and stops that plan pending disposition.

## 5. Operational spending and stop boundaries

- Julie sees the app's quote before each chapter submission; the
  quote is the expected figure for that chapter.
- A chapter settling **more than 10% over its quote** is reported to
  Julie at the next accounting check with the per-chapter figures;
  it triggers no automatic action (the phase budget is the hard
  backstop, and Chapter 5's +2.8% is the observed normal variance
  from split syntheses).
- **Immediate-report conditions** (Wren reports to Julie the same
  day they are observed, with re-hold as the standing recommendation):
  reconcile drift non-empty; `unknownOpen` > 0; any quarantine hold;
  any generation not attributable to Julie's submissions; recorder
  silence beyond the peek's reporting threshold.
- Julie may re-hold at any time for any reason, effective on her
  word. Whether Wren is pre-authorized to re-hold *first* on a
  clearly foreign generation event is a named decision for Julie at
  GO time (§8) — this proposal does not assume it.

## 6. Supervision model under release

Julie-paced, deliberately light:

- Wren runs an accounting spot-check (quota, reconcile, phase,
  plans, bindings watermark) **whenever Julie says she has submitted
  a chapter**, and reports the chapter's settled figures once it
  completes — with a cost surface read, per the §4 supervision note,
  not totals alone.
- A **weekly accounting spot-check** on the same surfaces, silent
  unless a §5 report condition holds — proposed as part of the
  release GO for Julie to accept or decline (§8). (This is an
  accounting check only; the existing recorder weekly peek continues
  unchanged and separately.)
- Julie's playback acceptance remains per-chapter and informal: she
  listens; a playback problem reported by her pauses further
  submissions until it is understood.

## 7. Fault response, re-hold, and the A-3-absent risk

- **1101-class fault**: Julie's standing WAIT law governs — no
  dashboard escalation, no mutation as a "fix"; Wren reports the
  last verified states and the unknowns as unknown.
- **Recorder silence / stalled chapter**: grants safe-void on lease
  expiry and nothing bills twice (observed across every gate);
  a stalled chapter is recoverable, not corrupting. Revival follows
  the L-1 precedent — a documentary round and a separately gated
  stimulus; no improvisation.
- **Residual risk, stated plainly**: while A-3 (the independent
  scheduler) remains absent, the recorder chain's liveness still
  depends on qualifying entry paths. Under release, ordinary in-app
  submissions are themselves frequent entry paths, which reduces —
  but does not eliminate — the silence risk. Julie accepts this
  residual risk for operational use, or defers the release until
  A-3; the proposal takes no position for her.
- **Re-hold procedure** (on Julie's word or an accepted §8
  pre-authorization): queue pause PUT + read-back, then the halt
  envelope flip + read-backs (halt "1", etag unchanged,
  observability intact), then a terminal census. In-flight grants at
  re-hold are accounted to terminal state in that census; re-hold
  cancels nothing already initiated.

## 8. Decisions reserved to Julie at execution GO

1. Release GO itself (after Rowan's documentary review of this
   proposal).
2. The weekly accounting spot-check: accept or decline.
3. Foreign-generation pre-authorization: whether Wren may re-hold
   first and report after, on a clearly foreign generation event —
   or reports first and re-holds only on Julie's word.
4. Confirmation that she understands the end state is LIVE and
   standing, revocable on her word at any time.

## 9. Execution shape (for the later GO)

Boundary census (§2) → act 1: queue unpause + read-back → act 2:
halt lift (the proven settings-envelope flip) + read-backs → LIVE.
Two counted acts, no closing acts. The release's own smoke step is
Julie's first self-submitted chapter: Wren verifies its accounting
on completion (§6) and reports; a failure there returns the question
to Julie before any second chapter.

Turn: Rowan's (documentary review). Then Julie's (execution GO).
