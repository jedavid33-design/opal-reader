# WS1 — STANDARD TURN-ON: FINAL EXECUTION (GO-READINESS) PACKAGE

_Wren's return under Rowan's WS1 built-candidate ruling (relayed by Julie 2026-11-06; verbatim record `ROWAN-WS1-CANDIDATE-PASS-WS2-HOLD-CLOSED.md`): **OFFLINE CANDIDATE PASS** — the S1 enforcement candidate is accepted for the production authorization-readiness review, and Wren is to prepare the final execution package with eight named contents. This document is that package. It EXECUTES nothing, presents no GO, and authorizes nothing: its §3 authorization text is presented to Julie only after Rowan's review of THIS package, and the gate it describes runs only inside her GO. Review pin: `<FINAL-PIN>` (repo `jedavid33-design/opal-reader`, branch `ui1-review`). Operative sources: the design package (pin `5cca000fac0838203f084aa07d9ada53c7fa1c75`), the S1–S4 correction (pin `0e2f03fa9c3b2ec8771d8ecef7f14e7d211104fe`), the S1 build specification (pin `f61f46e6179712c6628023308bc9a53682f6d681`), the S1 implementation record and candidate (pin `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72`), and the gate record of the program (Gate 4, the generation-resume gate, C1/R5a-D, the post-gate watch). Where the correction or the build specification superseded design text, the corrected text governs and is cited as such._

**The ruling's eight required contents, mapped**: (1) exact candidate identity + one-part manifest comparison → §1; (2) fresh production census + all A1 predicates → §2.2 (predicates reproduced in full; the census itself is a gate-time act recorded in the slot at §2.2.3); (3) P-14 verification + termination evidence → §2.3 (slot, filled at filing); (4) deployment under existing holds → §2.4; (5) post-deploy refused-intent probe + zero-movement read-back → §2.5; (6) separately authorized halt lift and queue unpause → §2.6; (7) bounded smoke + verified re-hold rules → §§2.7–2.8; (8) seven-clean-day soak + declaration criteria → §§2.9–2.10.

**Preliminary state note (NOT the census).** The expected values in §2.2's predicate table are the last verified standing values, from the read-only reads of 2026-11-06 (the scoping census 13:52–13:56Z; the design refresh ~14:0xZ; a capabilities read ~13:49Z): production HELD at NORMAL, build `fdb02395…`, containment NORMAL, recorder advancing under the holds with `recordingFailures` 0 and a standing registration, five plans all terminal, conflicts exactly 4, queue paused, `GENERATION_HALT` `"1"`. They are reproduced so Rowan can review the predicates against a known state. They are design-time evidence only: the gate runs its own fresh census (§2.2), and any difference between that census and these values is judged by the predicates' drift rules, never explained away by this note.

---

## 1. Candidate identity — the gate is bound to exactly this candidate

### 1.1 Identity block

| Field | Value |
|---|---|
| Candidate | The S1 enforcement candidate: the containment-v4 composed tree (the deployed source of the live build) plus exactly one branch |
| Review pin | `ef69b8f91dad3acbed0b9c36cf3c11e238e27f72` (repo `jedavid33-design/opal-reader`, branch `ui1-review`; the pin carries the implementation record, the manifest, the build log, the changed `service.mjs` verbatim, the complete test implementation as run, and the complete final-run logs) |
| Build basis | The composed tree = live build `fdb02395b3775dc945baa395591a73060ab146c4` (deployment `552db8a1-70e4-4a7f-9480-585bb99ab961`), script etag `bb90f18223e1802e1c417f17359f344499dc2d29c78e54db259f6f9ae4ac5c9e` |
| The change | One branch in `v2/generation/service.mjs`, `admitPhaseRegistry`, candidate lines 447–452 (+6 lines, one file, `node --check` clean): the E1 comment and `if (enforcePhasePolicy) return { ok: false, reason: "book_not_onboarded" };` before the fall-through return |
| Candidate manifest | 31 parts, SHA-256 per part (§1.3); the manifest document itself is `s1-build/MANIFEST.md`, SHA-256 `013635e0…`, pinned at the candidate pin |
| Build stamp on deploy | `ef69b8f9…` (the candidate's pin), per §1.4 |

**WS1/WS2 separation, restated for this gate**: the WS2 B-G2 candidate (pin `9d6f6b85…`) also changes `service.mjs`. It is not a base for this candidate, was never read as one, and is not composed with it. This gate deploys the WS1 candidate alone; nothing in this package touches, references, or advances WS2.

### 1.2 The battery and exit-run identity (as Rowan's candidate ruling accepted)

- **Battery**: `tests/s1-enforcement-battery.test.mjs` (13,268 B, SHA-256 `bb164d6c…`) — the build specification §3 battery as written: T-BOUND, T-UNBOUND-NAMED, T-NULL-REFUSAL (explicit-null and field-omitted), T-NO-MUTATION, T-QUOTE-OPEN, T-LEGACY, T-REGRESSION (incl. the lane-fence ordering proof), T-THROWSAFE, T-BOOTSTRAP — on the house harness (real `node:sqlite`; `.one()` throws with production semantics).
- **Final run**: ONE invocation of `tests/run-all.sh` on the final candidate tree, 2026-11-06T16:06:55Z, overall exit 0 — S1 battery 9/9, containment 42/42, P2 32/32, R5A 23/23, V-3 5/5, every suite exit 0, full logs pinned at the candidate pin. (The standing batteries ran with the disclosed identity-fixture cure — fixtures regenerated from the trees on disk; the uncured standing outcomes, P2 31/32 and R5A 21/23 on identity groups only, are stated in the implementation record for contrast. No behavioral group was altered.)
- **Key evidence the ruling cited**: T-NO-MUTATION's full-store before/after snapshot SHA-256 identical (`3632ac4d…`) around a refused intent; T-BOUND's created plan storing the DERIVED phase `forever-pucked`; T-QUOTE-OPEN's unbound-book quote computing identically before and after a refusal.

### 1.3 The one-part manifest comparison

The candidate's 31 parts were compared part-by-part (SHA-256) against the live build's 31 parts. The live basis is verified, not assumed: the baseline manifest recomputed from a byte copy of the composed tree is byte-identical to the composed-tree manifest recorded at `ch3-recovery/v3-harness/tree-manifest.sha256`.

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
e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd  v2/p8/approved-