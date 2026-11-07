3-recovery/v3-harness/tree-manifest.sha256`.

**Exactly ONE part differs**:

| Part | Live build (baseline) | Candidate |
|---|---|---|
| `v2/generation/service.mjs` | `5c5183e664218b9746c497e9456af45c7467a8ace66fd1b9ef0928eccb3c7c14` | `a77765910cdbcf283d2b475b47d97067587d4b4b799eb15dd40d58efcdf10d64` |

The other 30 parts are byte-identical. The full candidate manifest (SHA-256 per part):

```
9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d  v2/api.mjs
b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616  v2/audio-route.mjs
5303cb6323da01c21a5ebe9a7983f87abe08e14945660daaebce99734849e1ed  v2/coordinator.mjs
5c6db175e68abdf727bf2e1d1a23626be0651db3c6eb48dd4af9e7f7d4ee14c9  v2/executor.mjs
d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654  v2/generation/binding-projection.mjs
d8db2cbab33f16a5909fae0e74af672eed93b77b4f917f63d332cd3a221ba9c7  v2/generation/content-plane-adapter.mjs
c3613a818f598a2fc9f0f975312ad76879edab6bdffcdd06fe3fb2e3b123984c  v2/generation/d6-executor.mjs
8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006  v2/generation/d6-work-source.mjs
a9932a82ab3a81eeca38a80d3a555b56951a1d4dcef02fcf686bd9a9a264d1f7  v2/generation/eligible-set.mjs
e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325  v2/generation/flush-store.mjs
9af664fafc61dff1c16de8f94d06c0097271313bae7327d2a9a9d16efe14c77d  v2/generation/gen-constants.mjs
d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5  v2/generation/gen-schema.mjs
811b6b15b790097ad0010be3c71881c5024331143b4b0e2031392287bb839c2a  v2/generation/genstore.mjs
0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076  v2/generation/grant-finalizer.mjs
9249539fb867fb086338c72840539dcd130062772631a523e2b4373fc5487629  v2/generation/grant-guards.mjs
ba2952af66ee64f81491b003b7e8f225af7ccbafb15adeedeff34e41ac87f6bd  v2/generation/park-release.mjs
09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f  v2/generation/phase-policy.mjs
61dc00148c803cb7f6b2eead2ca12caf707a3653bb3d0f7f5c97c9d8fa997876  v2/generation/policy-split.mjs
a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514  v2/generation/prefix-range.mjs
64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62  v2/generation/quarantine.mjs
2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820  v2/generation/quota-budget.mjs
a77765910cdbcf283d2b475b47d97067587d4b4b799eb15dd40d58efcdf10d64  v2/generation/service.mjs
f8ac357e3ca4d23bb9edd46dab1843257d26c6fafe6a52b3fffaff676a749368  v2/host/adapters.mjs
5d80fe5a6604b1e5ba5649b3853e293e1827b4de2048e5d093980218d52a227c  v2/host/build-identity.mjs
24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46  v2/p8/approved-freeze-carry.mjs
b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a  v2/p8/approved-freeze-chunks.mjs
e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd  v2/p8/approved-freeze-manifest.mjs
886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41  v2/p8/migration-chunk-limits.mjs
2bb0608b589a084ca275428c3236c24680f4a4692afe2245dfcb2880257983c1  v2/worker-entry-prod-d6.js
1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5  v2/worker-entry-prod.js
91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5  v2/worker-entry.js
```

### 1.4 The build-stamp rule (one mechanical substitution, disclosed)

`v2/host/build-identity.mjs` carries `BUILD_COMMIT`, which the deterministic artifact builder replaces with the exact source (review) commit of the tree being deployed — the file's own header states this, and it is never hand-edited. The composed source file carries the older stamp `86ad06ab…` while the live `/health` reads build `fdb02395…` (the Grant 1 tree's pin): the stamp substitution is how every build in this chain got its marker. For this gate's deploy, the builder stamps the candidate's pin, `ef69b8f9…`, and the post-deploy `/health` read-back must show build `ef69b8f9…` (§2.4). The stamp substitution is a builder act on the identity part alone, its entire content change being the pin string; it is therefore NOT a second differing source part under §1.3's comparison, which is a comparison of source trees. The deploy verification (§2.4) checks the deployed part set against the candidate manifest with exactly this one mechanical exception, named in advance here — any other difference is a STOP.

### 1.5 Binding clause

This package is bound to the candidate exactly as pinned at `ef69b8f9…`. **Any change to the candidate — any part, any test, any manifest value — voids this package**: the changed candidate is a new candidate, requiring its own battery run, pin, and Rowan review before any execution package can name it. There is no silent substitution, no in-gate rebuild, and no composition with any other candidate (WS2's included).

---

## 2. The gate sequence, end to end

Owner key: **Julie** (authorization, the smoke submission, playback acceptance, dispositions), **Wren** (executor: census, deploy, probe, lifts, observation, records), **Rowan** (reviewer: the execution record and the declaration are pronounced only on her acceptance). Read-only reads are never counted acts. The counted production acts are enumerated at §4.2: deploy (1), probe (1), halt lift (1), queue unpause (1), and — only if a failure path runs — the re-hold pair (2). Every act below names its verification; an act whose verification fails stops the gate at that point, in the state then standing, and the deviation is reported to Julie and Rowan before anything else is contemplated (the executor STOP law: a stopped gate is never restarted on the executor's interpretation; one GO covers one attempt).

### 2.1 Act 0 — the GO of record (P-15's ordering)

Julie's GO for THIS gate, adopting §3's text and naming the operative package's filing pin (this corrected package at its filing pin, per §0's pin binding), is recorded on the board **before** the census runs (the established ordering, kept from the resume gate). No census, deploy, or other act precedes it. If Julie's GO names a different smoke chapter than Chapter 4, that chapter is the smoke target and P-13 is evaluated against it (§2.2).

### 2.2 Act 1 — the pre-flight census and the A1 predicates

Wren runs the full census read set (the design §2 surfaces, in full) against production, read-only, and records every predicate's observed value with its surface and timestamp in the execution record. **All fifteen predicates must pass.** Any predicate failure, or any unexplained movement on any surface, stops the gate before any act: the state is preserved, the deviation and its proposed explanation are reported to Julie and Rowan, and proceeding requires a fresh GO or a Rowan ruling for that deviation — the executor's own tracing never clears its own stop.

#### 2.2.1 The predicates (design §8.1, as corrected; expected values are the standing record)

| # | Predicate — expected value | Surface(s) | Drift rule |
|---|---|---|---|
| P-1 | Live build `fdb02395b3775dc945baa395591a73060ab146c4`; script etag `bb90f182…` CAPTURED AND SAVED as an evidence artifact before any act (Rowan R4) | Deployments list + script GET (etag from response headers, saved artifact) | Exact. Any difference = an intervening deploy: STOP and re-baseline the paperwork |
| P-2 | BOTH holds standing: `GENERATION_HALT` `"1"` (script settings) and queue `opalreader-generation-v2` `delivery_paused: true`, sole consumer `f260f2188d80426bb0588685e9d084eb` | `GET /workers/scripts/{name}/settings`; cf-api queue read | Exact. Either already lifted = unexplained state: STOP |
| P-3 | Containment NORMAL on BOTH surfaces: state NORMAL, known true, absent false, verified true; `stopConfidence: not_applicable`; `updatedAt` 1793933356719; closed-episode summary prevEpisodeId 3, prevEpisodeAttempts 1, prevEpisodeExhausted false, prevEpisodeClosedAt 1793933356719 | `GET /v2/d6-containment` (operator) + `GET /v2/d6-diagnostics?drive=1` projection | Exact. Any new episode or transition = STOP |
| P-4 | Conflicts = exactly the four baseline `schedule_dead` rows: id 1 `grant:plan:3183ecbf2ac4bf50bbc6166e:seg:1:full` (2026-10-29T23:54:14.808Z); id 2 `grant:plan:603ab416bd67ab1b25de97be:ch1:1:full` (2026-10-30T00:24:14.632Z); id 3 `grant:plan:b2dc2a3d1cd367a0245b9102:ch1:1:full` (2026-10-31T05:14:24.089Z); id 4 `grant:plan:e377a5559961b294154276b6:ch2:1:full` (2026-11-01T01:04:30.364Z) — all cache_key `lease`, expected `7`, reason `schedule_dead` | `GET /v2/conflicts` | Exact set. Any addition or change = STOP (Q6: the rows are preserved; no conflicts row is cleared under this gate) |
| P-5 | Plans inventory = exactly the five baseline plans, ALL terminal, totals as censused: Phase B `plan:19cad189fab54b9c804a74a6` complete (1/1); Ch 3 `plan:e377a5559961b294154276b6` complete (23/23); Ch 2 `plan:b2dc2a3d1cd367a0245b9102` complete (18/18); smoke `plan:3183ecbf2ac4bf50bbc6166e` comp