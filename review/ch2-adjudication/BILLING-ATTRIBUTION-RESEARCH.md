# Billing-attribution research — Chapter 2 unknown attempt

**Companion to `ADJUDICATION-PROPOSAL.md` (§7 summary there).**
Prepared by Wren under Rowan's assignment in her focused HOLD
(issue #15, comment 6533798118): *"Seek a provider billing/usage
record that can attribute charge or no-charge to the unknown
attempt after accounting for the other eight, ideally by request,
narrow timestamp/model/SKU, or another defensible independently
checked allocation with sufficient precision."*

**Corrections R1–R3 applied (Rowan's re-review, issue #15,
comment 6534423731).** Rowan cleared both HOLDs on this
research and directed three corrections to its framing, applied
in place below and flagged where they land: **R1** — the
BigQuery-export passage overstated retroactivity (§1 table);
**R2** — the recorded `upperMicroCents` is a *modeled internal
budgeting cap*, not a guaranteed provider bill ceiling, and
every passage that treated it as a mathematical bound on
Google's real charge is softened to scenario language (§§3.1,
3.2 S3/S4, 3.5, and this conclusion); **R3** — the uniform
illustration's arithmetic does not even reach cent-rounded
equality with the displayed total (§3.2 S1). None of the three
corrections weakens the conclusion; R3 reinforces it.

**Conclusion, stated first: no such record or allocation exists
at the required standard.** Google confirms exactly one figure —
the account/day aggregate ($0.20 net, Oct 29, 2026, rounded to
cents). Every per-attempt figure in existence is our own system's
record. The allocation exercise below explores the scenario
space: exactly one extreme distribution is excluded (by the
model's per-request output cap, a provider property — §3.2 S4),
and every interior value the scenarios reach is consistent with
all the evidence. Our records prove **no ceiling** on the
unknown attempt's real charge: the recorded upper bound is a
modeled budgeting cap (R2), and the practical scenario range is
in any case far too wide to certify a figure. **No
allocation reaches per-attempt proof, and no exact micro-cent
figure — 19,652 or any other — can honestly be recorded as a
known cost.** On the deployed route vocabulary, the §2.4 STOP
branch is final for this evidence. Repo-only research; no
production calls; no further screenshot requested of Julie.

Units: the system's micro-cent ("units"); $1 = 1,000,000 units.

---

## 1. What Google can actually provide for this account/model

| Surface | Granularity | Can it isolate the Oct 29 unknown attempt? |
|---|---|---|
| **AI Studio billing view** (Exhibit A's surface) | Date-range totals; filters for API key and model; **daily** bars | No. All ten Oct 29 requests share one API key and one model, so the filters subdivide nothing that matters; there are no per-request rows at any setting. This view *is* the day aggregate. |
| **Cloud Billing Reports** (console) | Group by **project / service / SKU / location**; daily cost series (Google Cloud Billing docs, "Analyze billing data and cost trends with Reports") | No. Project, service, and SKU are the smallest attribution dimensions the billing system offers. A practitioner write-up of exactly this problem (GDE, dev.to, "Solving Gemini Cost Allocation in a Single Project") confirms: costs cannot be displayed by API key — all keys in a project are lumped into one Gemini API total — and there is no per-request dimension. A SKU view for Oct 29 would split the day into the model's **input-token SKU** vs **audio-output-token SKU** totals: useful corroboration of bounds (§3.4), still an aggregate over all ten requests. Availability for this AI Studio **prepay** account is also not established (the account's billing surface is the AI Studio view Julie used), and obtaining it would be a further Julie action this research does not request — the conclusion does not depend on it, since even the best SKU outcome cannot isolate one request. |
| **Cloud Billing BigQuery export** | One row per SKU per usage window (detailed export: hourly windows), with cost and usage quantity | No. Same SKU-level ceiling as Reports. **Correction (R1, Rowan 6534423731):** an earlier version of this note claimed the export "cannot be created retroactively" — that was categorical and wrong. Google Cloud's own export documentation says first-time *usage-cost* exports into an **EU or US multi-region dataset** may backfill **the current and previous month** (supported regional datasets generally do not; the pricing export has a different no-retroactive rule). This account's eligibility for Cloud Billing export at all is **unverified**. The correction does not move the conclusion: a backfilled export would still be a SKU/time aggregate over all ten requests, so it could not attribute the unknown attempt. |
| **Request labels** | Per-request billing labels | Vertex AI only, and prospective only. These calls were made with an AI Studio API key, which cannot attach billing labels (dev.to, above). Not available for Oct 29; noted only so the avenue is closed on the record, not left open. |
| **Per-response usage metadata** | Token counts returned in each API response | Not recoverable. The unknown attempt produced **no response we received** (nothing to read), and the failed responses' metadata was not retained by the build that ran them (the attempt/execution records hold outcomes and our cost figures, not provider usage). |
| **Third-party summaries** | — | Corroborate the negative: "Google Cloud billing shows total Gemini spend, but it does not natively show cost per API call" (CloudZero, "Gemini Cost Per API Call in 2026"). |

**Granularity limit, plainly:** Google's finest retroactive
lens on this account is **one day × one SKU**. The adjudication
needs **one request**. The gap is structural, not a matter of
digging further.

## 2. The published pricing basis (why per-attempt charges are uneven)

`gemini-3.8-flash-tts`, Standard lane, introductory pricing
through Dec 31, 2026 (Google's Gemini API pricing page; launch
pricing as reported consistently by DataNorth's release report
and neomanex's pricing table, and cross-checked below):

- **Text input: $0.50 per 1M tokens** (= 0.5 units per token).
- **Audio output: $9.00 per 1M audio tokens**, and audio tokens
  meter at **25 tokens per second of audio** (Google Cloud
  Text-to-Speech pricing page, Gemini-TTS SKU table) — i.e.
  **$0.000225 per audio second = 225 units per second**,
  ≈ **$0.81 per audio hour**.

Cross-checks: 225 units/second is **exactly the deployed
system's rate constant** (its estimator prices expected cost as
`round(chars / 15.96 × 225)` units — chars at an assumed
15.96 chars/second of speech), and $0.81/audio-hour is Julie's
own verified intro-rate figure. The rates are not in doubt.

What follows from the basis:

- Billing is **token-metered per response** — input tokens
  actually processed plus audio tokens actually generated.
  There is no per-request flat charge. Nine attempts of
  different lengths, with different outcomes, would bill nine
  *different* amounts; a uniform per-attempt charge (the §2.5
  illustration) is a modeling convenience, not a pricing
  behavior.
- A response containing **no audio** meters ~zero output
  tokens. Its input side (~1,394 chars ≈ ~350 tokens) costs
  ≈ **175 units ≈ $0.0002** — two orders of magnitude below
  the estimator figure. This asymmetry drives §3.
- The screenshot's list/savings split (list $0.40, savings
  $0.20, net $0.20) is consistent with the intro-rate structure
  (net = half of list); it adds no per-request information.

## 3. The allocation exercise

### 3.1 Recorded particulars (all (b)-class — our records)

| Request | Input | Response character | Our recorded cost |
|---|---|---|---|
| Smoke (Ch 4 Seg 1) | 1,259 chars | Success; audio file 4,197,164 B WAV (PCM 16-bit mono 24 kHz ⇒ ≈ 87.4 s of audio) | Settled **17,749 units** — which equals the *estimator* output for its own length, `round(1259 / 15.96 × 225)`; at published rates on its measured duration it would be ≈ 19,700–19,900 units. Even our one "settled" figure is estimator-derived, not a meter read. |
| 8 failed Ch 2 attempts | Segments of the 18-entry, 25,091-char chapter set (mean 1,394 chars/entry); the 9 attempted are the first 9 by occurrence-id order | HTTP 200 with steps but **no audio content part** (diagnosis Q5 branch (b); the defect the B1 fix corrects) — one call each | `failed_known` at **cost 0 — by local convention** (the executor confirms every known failure at cost 0 by construction). Not a provider measurement. |
| 1 unknown attempt | One segment of the same set (own length in its attempt record; `upperMicroCents` recorded on the chars/10 basis ⇒ ≈ **31,400 units ≈ $0.0314** at the mean length — a **modeled internal budgeting cap** derived from an assumed speech rate, **not** a guaranteed ceiling on Google's actual charge for the request; see R2 note under §3.2) | **No usable response received.** Mechanism classes (diagnosis Q1/Q5): (1) fetch timeout at the 120 s `AbortSignal` — Google may or may not have completed generation server-side; (2) truncated-body JSON parse throw — a 200 *was* received; (3) base64 decode throw — a 200 *with audio* was received and lost client-side. One call by construction (the message stops at the first unknown). | `unknown`, cost NULL — the only honest entry our system could write. |

Day total to allocate: **T = $0.20 net displayed, cent-rounded**,
so T ∈ [$0.195, $0.205) on the displayed total's own rounding —
and list/savings are each rounded too, so the effective interval
is a touch wider. Ten requests: smoke + 9.

### 3.2 Distributions

**R2 framing note (Rowan 6534423731).** Several scenarios below
refer to an attempt's recorded `upperMicroCents` (chars/10 ×
225). That figure is the system's **internal estimation cap for
budgeting** — seconds modeled at an assumed minimum speech
rate. It is **not** proof of Google's maximum charge for a
partially completed or server-side-metered request: nothing in
our records mathematically prevents a real provider charge
above it, and "spend is never understated" cannot be guaranteed
merely by reserving a modeled upper figure against a budget.
Where a scenario uses the recorded upper bound, it is a
*modeled scenario boundary*, and exclusions are claimed only
where a provider property (the model's per-request output cap)
does the excluding.

**S1 — Uniform-estimator (the original §2.5 illustration).**
Smoke at its recorded 17,749 + 9 × 19,652 (the flat grant
estimate) = **194,617 units = $0.194617**. **Correction (R3,
Rowan 6534423731):** $0.194617 is **below the $0.195 lower
threshold** that would normally round to a displayed $0.20 —
so the uniform distribution does not even reach exact
cent-rounded equality with T; it is a rough illustration that
falls just short of the displayed total's own rounding
interval, not an exact fit. (That it lands within ~0.3% is
suggestive atmosphere, nothing more.) It further assumes all
nine Ch 2 attempts were billed, each at the *same flat figure*
despite differing lengths, and the eight no-audio refusals
billed as though they were full audio — i.e., it assumes the
fact in question. **Verdict: an illustration — and, after R3,
not even an arithmetically exact one. Not an attribution.**
The mismatch reinforces, rather than weakens, the HOLD 1
conclusion.

**S2 — Literal published metering.** Smoke at published rates
≈ 19,800; eight failures at input-only ≈ 8 × 175 ≈ 1,400;
unknown billed for full audio at the realized rate (smoke's
1,259 chars → 87.4 s ⇒ ~14.4 chars/s; a mean-length segment
⇒ ~97 s) ≈ 21,975. **Total ≈ 43,000 units ≈ $0.043 — about
$0.16 short of T.** **Verdict: fails.** The recorded response
characters plus published token metering do **not** explain
the day. Some unmodeled charging of roughly $0.16 occurred.

**S3 — Failures-absorb (unknown charged $0).** The eight
failures must sum to T − smoke ≈ **$0.177–0.187**, i.e.
≈ $0.022–0.023 each ≈ **98–104 seconds of metered audio per
no-audio refusal**. Arithmetically inside each attempt's
recorded upper figure (≈ $0.0314) — a modeled scenario
boundary, not a proven ceiling (R2); the scenario needs no
more than that consistency. Requires billed-but-
undelivered audio on all eight. **Verdict: cannot be
excluded by the aggregate.**

**S4 — Unknown-absorb (failures charged $0).** The unknown
alone would carry ≈ $0.177–0.187 ⇒ **787–831 seconds** of
audio. **Correction (R2, Rowan 6534423731):** the exclusion is
rested on the provider property, not on our modeled figure.
787–831 s exceeds the model's **per-request output cap**
(16,384 audio tokens ≈ 655 s ≈ $0.1475 at published rates) —
a hard property of the model, not of our estimator. The
recorded upper bound (≈ 139 s, $0.0314, exceeded here by
≈ 5.7×) points the same way but is a modeled internal cap and
is **not** itself proof (R2). **Verdict: EXCLUDED — by the
output cap; the single hard exclusion this evidence
supports.**

**S5 — Mixed central.** Unknown billed full audio ≈ $0.0220;
failures share the rest ≈ **$0.0200 each** (≈ 89 s metered
audio each). Fits T. **Verdict: as consistent as S1 and S3 —
and incompatible with both about the unknown.**

### 3.3 The alternative hypothesis, squarely

**"Audio generated + billed but mishandled client-side"** is
not a conjecture invented to save a theory; it is one of the
diagnosis's own mechanism classes for the unknown attempt
(class (3): the audio arrived and the client threw decoding
it), and S2's ≈ $0.16 shortfall independently indicates that
metering on Oct 29 did not follow the tidy
"no-audio-response ⇒ no output charge" model for the failures
either — the leading explanation being audio generated
server-side and metered although the delivered response
carried no audio part (the interactions surface's refusal
shape). Implications, stated symmetrically:

- *For the unknown:* every one of its mechanism classes
  involves a fully processed request, and two of the three
  involve completed, delivered generation. Its having been
  billed — plausibly near a full-audio figure — is the more
  likely story. **Plausibility is not proof, and "near" is
  not a figure**: if billed, its charge is its own input
  tokens plus its own generated duration at an unobserved
  realized rate — somewhere above zero, in the region the
  scenarios explore (the modeled full-audio region around
  ≈ $0.022–0.031; our records prove no exact ceiling, R2),
  not demonstrably 19,652 units (a flat mean over 18 entries,
  not even this attempt's own-length estimate).
- *For the failures:* the same hypothesis is what S3 needs
  (all eight billed ≈ full audio, unknown at zero). The
  hypothesis therefore raises the plausibility of *both*
  sides of the question at once and cannot adjudicate
  between them.

### 3.4 What even a SKU-level record would and would not settle

A Cloud Billing SKU split for Oct 29 (input-token quantity vs
audio-output-token quantity) would bound the day's **total
metered audio seconds**. A total near ~185 s would support an
S2-class world (only smoke + unknown generated billable
audio) — and would then leave the $0.20 total itself
unexplained by these SKUs, pointing at yet another component.
A total near ~890 s would support S3/S5-class worlds. Either
outcome refines the *distribution family*; neither partitions
metered seconds **among requests**, so neither attributes the
unknown attempt. The avenue is noted for completeness; its
ceiling is below the proof standard regardless of what it
showed.

### 3.5 Verdict

- The unknown attempt's charge is **$0 or some positive
  figure our evidence cannot fix**. S4-class extremes are
  excluded by the model's per-request output cap; **every
  interior value the scenarios reach is realized by some
  distribution consistent with the aggregate, the published
  pricing, and all local records.** The recorded upper bound
  (≈ $0.0314) is a modeled budgeting cap, **not a proven
  ceiling** on Google's real charge (R2) — but the correction
  changes nothing that matters here: even the widest
  provider-capped scenario range (≈ $0.1475) is ~7× the
  estimate and nowhere near certifying an exact figure.
- A cent-rounded, ten-request day aggregate cannot certify a
  sub-cent exact figure under *any* allocation method — the
  precision Rowan's standard requires ("sufficient precision"
  for a *known* cost) is unattainable from this evidence
  class, full stop.
- **Therefore: no allocation reaches per-attempt proof.
  Neither `no_charge` nor `failed_known` at 19,652 (or any
  figure) may be recorded as known.** The §2.4 STOP branch
  governs the deployed route vocabulary. The remaining path
  is the transparently marked uncertain/estimated-accounting
  disposition outlined in proposal §8 — a separate design,
  with its own code change, review, deploy, and approvals —
  presented there as an option for Rowan's ruling and
  Julie's decision, not as a conclusion of this research.

## Sources

- Google, *Gemini Developer API pricing* —
  https://ai.google.dev/gemini-api/docs/pricing (per-token
  pricing structure for Gemini API models incl. TTS).
- Google Cloud, *Review pricing for Text-to-Speech* —
  https://cloud.google.com/text-to-speech/pricing (Gemini-TTS
  SKU structure: separate input/output token SKUs; "Audio
  tokens correspond to 25 tokens per second of audio").
- DataNorth, *Gemini 3.8 Flash TTS: Google ships 2,000
  voices* — https://datanorth.ai/news/google-releases-gemini-3-8-flash-tts
  (3.8 Flash TTS launch pricing: $0.50 input / $9.00 audio
  output per 1M tokens through Dec 31, 2026, doubling Jan 1,
  2027; model id `gemini-3.8-flash-tts`).
- neomanex, *Gemini 3.8 Flash TTS and Flash-Lite TTS pricing*
  — https://neomanex.com/news/gemini-3-8-flash-tts-flash-lite-tts-api-pricing
  (same pricing table, corroborating).
- Google Cloud Billing docs, *Analyze billing data and cost
  trends with Reports* —
  https://cloud.google.com/billing/docs/how-to/reports
  (Reports group by project / service / SKU / location;
  daily series).
- Google Cloud Billing docs, *Set up Cloud Billing data
  export to BigQuery* —
  https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-setup
  (cited by Rowan for R1: first-time usage-cost exports into
  an EU or US multi-region dataset may backfill the current
  and previous month; pricing export is not retroactive).
- GDE (dev.to), *[GCP Billing & Vertex AI] Solving Gemini
  Cost Allocation in a Single Project* —
  https://dev.to/gde/gcp-billing-vertex-ai-solving-gemini-cost-allocation-in-a-single-project-vertex-ai-dynamic-5aok
  (smallest billing dimensions are project/service/SKU; API
  keys are not a billing dimension; per-request labels are a
  Vertex AI feature unavailable to AI Studio API-key calls).
- CloudZero, *Gemini Cost Per API Call in 2026* —
  https://www.cloudzero.com/blog/gemini-cost-per-api-call/
  ("Google Cloud billing shows total Gemini spend, but it
  does not natively show cost per API call").
- Local records: halt diagnosis
  (`~/workspace/d6-build/deploy-evidence/followon-fp/ch2-halt-diagnosis.md`,
  Q1/Q2/Q5 — classification mechanics, the estimator's
  construction, the failure/unknown mechanism classes);
  Exhibit A as read in proposal §2.5; deployed cost model
  (`gen-constants` estimator: `chars / 15.96 × 225` units
  expected, `chars / 10 × 225` units upper bound — the code's
  name for its modeled cap; see the R2 correction above).

— Wren
