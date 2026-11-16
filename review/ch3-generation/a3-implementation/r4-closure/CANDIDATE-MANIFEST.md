# A-3 Candidate Manifest

CORRECTIONS ROUND (Rowan's IMPLEMENTATION HOLD ruling,
R1–R8): this manifest states the CORRECTED candidate. The
three changed parts' hashes and diff stats below supersede
the first build's; the corrections are itemized in
`IMPLEMENTATION-NOTES.md` (corrections-round section), the
composition is mechanically verified in
`COMPOSITION-VERIFICATION.md`, and the rollback candidate has
its own manifest (`ROLLBACK-MANIFEST.md`).

R4 CLOSURE ROUND (Rowan's CONDITIONAL IMPLEMENTATION PASS on
the corrections round): the entry and coordinator hashes and
diff stats below include the closure round's one correction —
the registration revision fence in the tick's admission path
(entry) and its pure-read accessor (coordinator, mirrored
verbatim into the rollback tree to preserve Part 2's
byte-identity). Itemized in `IMPLEMENTATION-NOTES.md`
(R4 closure section); final-run evidence in
`evidence/final-run-r4closure/`.

Candidate: `candidate-tree/` in `~/workspace/ch2-program/a3-build/`.
Baseline: `BASELINE-MANIFEST.txt` — sha256 of the pristine copy of
the live build `8a16def4` source (from `a1-build/candidate-tree/`),
taken before any A-3 change. The same baseline bytes are preserved
as `pre-a3-tree/` (hash-verified against the baseline manifest,
31/31) and used as the diff reference for the per-part stats.

Files: 31 total; 3 changed; 28 byte-identical to baseline.

| File | sha256 (candidate) | vs baseline |
|---|---|---|
| `v2/api.mjs` | `9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d` | UNCHANGED |
| `v2/audio-route.mjs` | `b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616` | UNCHANGED |
| `v2/coordinator.mjs` | `ce90852ac4fbd37e222d4bf442327266de6a0949ac1b37c501febb4b40781b00` | CHANGED |
| `v2/executor.mjs` | `5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9` | UNCHANGED |
| `v2/generation/binding-projection.mjs` | `d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654` | UNCHANGED |
| `v2/generation/content-plane-adapter.mjs` | `d8db2cbab33f16a5909fae0e74af672eed93b77b4f917f63d332cd3a221ba9c7` | UNCHANGED |
| `v2/generation/d6-executor.mjs` | `c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c` | UNCHANGED |
| `v2/generation/d6-work-source.mjs` | `8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006` | UNCHANGED |
| `v2/generation/eligible-set.mjs` | `a9932a82ab3a81eeca38a80d3a555b56951a1d4dcef02fcf686bd9a9a264d1f7` | UNCHANGED |
| `v2/generation/flush-store.mjs` | `e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325` | UNCHANGED |
| `v2/generation/gen-constants.mjs` | `9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d` | UNCHANGED |
| `v2/generation/gen-schema.mjs` | `d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5` | UNCHANGED |
| `v2/generation/genstore.mjs` | `811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a` | UNCHANGED |
| `v2/generation/grant-finalizer.mjs` | `0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076` | UNCHANGED |
| `v2/generation/grant-guards.mjs` | `9249539fb867fb086338c72840539dcd130062772631a523e2b4373fc5487629` | UNCHANGED |
| `v2/generation/park-release.mjs` | `ba2952af66ee64f81491b003b7e8f225af7ccbafb15adeedeff34e41ac87f6bd` | UNCHANGED |
| `v2/generation/phase-policy.mjs` | `09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f` | UNCHANGED |
| `v2/generation/policy-split.mjs` | `61dc00148c803cb7f6b2eead2ca12caf707a3653bb3d0f7f5c97c9d8fa997876` | UNCHANGED |
| `v2/generation/prefix-range.mjs` | `a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514` | UNCHANGED |
| `v2/generation/quarantine.mjs` | `64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62` | UNCHANGED |
| `v2/generation/quota-budget.mjs` | `2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820` | UNCHANGED |
| `v2/generation/service.mjs` | `e9f99bd2d308be2d679fa2dec5205d60caf99847de7d27a01093dc0c342ad92c` | CHANGED |
| `v2/host/adapters.mjs` | `f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368` | UNCHANGED |
| `v2/host/build-identity.mjs` | `5d80fe5a6604b1e5ba5649b3853e293e1827b4de2048e5d093980218d52a227c` | UNCHANGED |
| `v2/p8/approved-freeze-carry.mjs` | `24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46` | UNCHANGED |
| `v2/p8/approved-freeze-chunks.mjs` | `b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a` | UNCHANGED |
| `v2/p8/approved-freeze-manifest.mjs` | `e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd` | UNCHANGED |
| `v2/p8/migration-chunk-limits.mjs` | `886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41` | UNCHANGED |
| `v2/worker-entry-prod-d6.js` | `c5853a70b683fec10ff635fea27302822e910b08173e3987d14a0e5874cfd601` | CHANGED |
| `v2/worker-entry-prod.js` | `1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5` | UNCHANGED |
| `v2/worker-entry.js` | `91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5` | UNCHANGED |

## Changed parts (the implementation boundary — exactly three)

| Part | Diff vs pre-A-3 tree | Role |
|---|---|---|
| `v2/worker-entry-prod-d6.js` | +1730 / −77 lines (zero-context diff) | Part 1 — scheduler: `scheduled()` export + DO-internal tick, activation/status routes, `_drivePass(entryKind)` extraction, per-instance guard, exit assurance, scheduler tables, WAIT hold, recorder migration (entry_kind/seq/finished_at/admitted_at), tick predicate + single synchronous admission stretch, I3 containment re-checks (scheduled only), owner-safe active-pass clearing. Corrections round: R3 watchdog-only predicate rows; R4 admission-stretch recompute + classifier re-evaluation + stale-observation rejection; R5 verified-inactive hold in both observations; R6(a) read-back-classified assurance outcomes (`assurance_outcome` / `assurance_armed_after` recorder fields); R6(b) unrecorded-drain disposition. Closure round: the registration revision fence — the tick captures the coordinator's alarm revision before its registration read and the admission stretch compares it, refusing (`skip_revision_changed`) without consuming the tick when any registration writer moved it |
| `v2/coordinator.mjs` | +145 / −10 lines | Part 2 — RC-2 derivation reading rules only: seq-adjacency + native-qualification for qualifying pairs; post-watermark NULL/unknown kinds fail closed; legacy fallback preserved for pre-A-3-shaped rows. Corrections round (R2): the schema state is established by explicit per-column probes — legacy semantics ONLY for a positively established pre-migration schema; an extended-read failure in a migrated or uncertain world fails closed; any not-well-formed extended row in an intent's window fails that intent closed (`failClosedIntentIds`, surfaced on the repair status). Closure round: ONE addition — the exported pure read `alarmRevisionFor(state)` (the revision WeakMap's only read, factored out of `_alarmRevision()`, which now delegates to it) so the entry's admission stretch can compare the fence without constructing a coordinator; no behavior change to any coordinator path |
| `v2/generation/service.mjs` | +34 / −0 lines | Part 3 — drive-diagnostics projection only: `entryKind`, `seq`, `admittedAt`, `exitArmed`, `assuranceFired` surfaced on pass rows; `wait_interrupted` added to the readable stage set. Corrections round (R6(a)): `assuranceOutcome` (validated against the outcome set) and `assuranceArmedAfter` also surfaced |

Every other file is byte-identical to the baseline (see table).
The boundary is asserted mechanically against `pre-a3-tree/`
by `verify-composition.mjs` (the `composition` suite in
`run-all.sh`; see `COMPOSITION-VERIFICATION.md`).
