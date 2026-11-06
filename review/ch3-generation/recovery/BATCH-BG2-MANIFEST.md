# B-G2 candidate manifest — per-file delta vs the composed tree

Baseline: containment-v4 composed tree (build fdb02395b3775dc945baa395591a73060ab146c4 source).
Generated: 2026-11-06, from the exit-run tree (test-logs/exit-run, overall exit 0).

## Changed files (8 — exactly the spec §3 file map)

| file | baseline lines | candidate lines | delta | candidate sha256 |
|---|---:|---:|---:|---|
| v2/coordinator.mjs | 5844 | 6284 | +440 | 6e04df3301eab49f11c86458cb15e683fdfc1fa008440a24bb2faab2b6b9b0d7 |
| v2/executor.mjs | 274 | 292 | +18 | f91ce0bda5aecac813f283d83b2b38ba2a5b8e3839bb8fbfc329f93ed3bcb666 |
| v2/generation/d6-executor.mjs | 891 | 1812 | +921 | 9d469bf03b1a3fdcaf8f660c4c003ecc69ba9ef5df8ee87b32f35d8c8f7ded4e |
| v2/generation/gen-constants.mjs | 102 | 113 | +11 | a713dc35dbc13c71b777dc448a604c357ae0aa098a38f0153ea8e246fa445469 |
| v2/generation/genstore.mjs | 954 | 1221 | +267 | f8614f9df097833182061e2e08b238fc9a371b6dc6652d460e24032378ab907f |
| v2/generation/service.mjs | 1900 | 2108 | +208 | 761ac47736ec6c958f60e85a70789cd613590c274286729713b55974c246db03 |
| v2/host/adapters.mjs | 811 | 983 | +172 | ee99bdf2e6d21ab1c70504e95c16f0744e1c2b3feed958083803a41164af1620 |
| v2/worker-entry-prod-d6.js | 2539 | 2850 | +311 | 4087d3c7f310ebad85ac2a229cbb368d34fd4397e68eb2768e473e126add75eb |

Unchanged and verified identical to baseline: every other file in the tree, including v2/generation/quota-budget.mjs (spec §3: no change) and the client. The allowlist line in v2/generation/gen-constants.mjs is unchanged: D6_LANE_ALLOWLIST = ["standard"] (asserted from the tree by BG2-S).

## Full candidate part manifest (sha256)

```
9b1d0eba128c972b5329020018fefc10b0db9250f3134393de190d54e4e3237d  v2/api.mjs
b6383d21be32f119271e1d39f3894bd7f84b15ac1be4c38655601d1dee20d616  v2/audio-route.mjs
6e04df3301eab49f11c86458cb15e683fdfc1fa008440a24bb2faab2b6b9b0d7  v2/coordinator.mjs
f91ce0bda5aecac813f283d83b2b38ba2a5b8e3839bb8fbfc329f93ed3bcb666  v2/executor.mjs
d100f02ce199bbcd6935569c8daabadbd6783d79b0bf1abd41f811e5763d8654  v2/generation/binding-projection.mjs
d8db2cbab33f16a5909fae0e74af672eed93b77b4f917f63d332cd3a221ba9c7  v2/generation/content-plane-adapter.mjs
9d469bf03b1a3fdcaf8f660c4c003ecc69ba9ef5df8ee87b32f35d8c8f7ded4e  v2/generation/d6-executor.mjs
8fa929b2d283084542d9dc76c1e75278d9f5ea4ed7a8d94540e55bef45e05006  v2/generation/d6-work-source.mjs
a9932a82ab3a81eeca38a80d3a555b56951a1d4dcef02fcf686bd9a9a264d1f7  v2/generation/eligible-set.mjs
e8f622bf4ed8745dd342cdbdd8d66f2a59a586ce034e8e1b1e21d68a2460f325  v2/generation/flush-store.mjs
a713dc35dbc13c71b777dc448a604c357ae0aa098a38f0153ea8e246fa445469  v2/generation/gen-constants.mjs
d7ae4936b11fe0d01c9ff8a6e1ccbb7364541ecad7d012b8fc3e712a453aacc5  v2/generation/gen-schema.mjs
f8614f9df097833182061e2e08b238fc9a371b6dc6652d460e24032378ab907f  v2/generation/genstore.mjs
0da45d8e6d156d1fc7441ce97e3338aa2a9e143a5560d640ee909c5727f8c076  v2/generation/grant-finalizer.mjs
9249539fb867fb086338c72840539dcd130062772631a523e2b4373fc5487629  v2/generation/grant-guards.mjs
ba2952af66ee64f81491b003b7e8f225af7ccbafb15adeedeff34e41ac87f6bd  v2/generation/park-release.mjs
09883c40e365815f48cc9cb9d3bfdf1908f994b809c73ba27535638c7607f37f  v2/generation/phase-policy.mjs
61dc00148c803cb7f6b2eead2ca12caf707a3653bb3d0f7f5c97c9d8fa997876  v2/generation/policy-split.mjs
a6546b3e94247adcd4215aa1ed4ab691a2595520a2783dd67849056a498da514  v2/generation/prefix-range.mjs
64a491f3b1345219cb8816b80252908df9aaaadbd67e910547658aa9ade0fe62  v2/generation/quarantine.mjs
2b39924579e5af2d5d20eea01122d2323ccedac9fe9ff9f7026c49af14770820  v2/generation/quota-budget.mjs
761ac47736ec6c958f60e85a70789cd613590c274286729713b55974c246db03  v2/generation/service.mjs
ee99bdf2e6d21ab1c70504e95c16f0744e1c2b3feed958083803a41164af1620  v2/host/adapters.mjs
5d80fe5a6604b1e5ba5649b3853e293e1827b4de2048e5d093980218d52a227c  v2/host/build-identity.mjs
24ddc8ee428e6e161fc2114af9a572f348db5959977402090539163cacb5bb46  v2/p8/approved-freeze-carry.mjs
b49cfcfcaf656d957f0c828566d390d6b2bc4b25238885fa60c3e3293563f06a  v2/p8/approved-freeze-chunks.mjs
e59ab3d37245cc049d23215e0538933d633621ceb3fd29e48afdcda07e519edd  v2/p8/approved-freeze-manifest.mjs
886c8ea6d79dd6d2014976c50e23fe6553fd3d0ff81dd1f5f2337bf109b0fe41  v2/p8/migration-chunk-limits.mjs
4087d3c7f310ebad85ac2a229cbb368d34fd4397e68eb2768e473e126add75eb  v2/worker-entry-prod-d6.js
1d2f333a75a3ffff3d4e7c9454f218ba8a8042fab179fcd4f50031c6d80a27c5  v2/worker-entry-prod.js
91daefdd4778599db83024b074a5c4e78ef4d396a5d815712b381d40f72bd6e5  v2/worker-entry.js
