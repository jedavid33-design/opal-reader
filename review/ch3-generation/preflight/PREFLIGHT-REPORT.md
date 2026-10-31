# CHAPTER 3 — FINGERPRINT COLLISION PREFLIGHT REPORT

Executed under Julie's recorded GO (board comment 6548743249), per
`CH3-GENERATION-PROPOSAL-v2.md` §9, procedure P1–P5. READ-ONLY end to end:
live Worker read endpoints, local computation, Cloudflare R2 metadata
LISTING. No writes of any kind were made (no R2 PUT/DELETE, no Worker
mutation, no GitHub or board post). No segment text or speechText appears
in this report or its evidence — ids, counts, fingerprints, keys only.

- **Checked at:** 2026-10-31 16:34 EDT (America/New_York) / 2026-10-31T20:34:24Z
- **Book / chapter:** Forever Pucked `5c589095-f812-48a2-8ab2-03ba2791f2b2`, chapterIndex 2 (27 segments)
- **Bucket:** `opalreader-storage` (account `b35ff435ff24d134ff640e0099dd13fc`)
- **Evidence:** `preflight-evidence.json` (same directory) — full per-key rows.

## Bottom line

**Zero occupied keys.** Every derivable first-pass key — §9's prescribed
47 keys, the executor's actual 24 flush keys, and the 23 speech-basis
whole-segment keys (73 unique prefixes in total) — was FREE at check time.
No pre-existing object sits at any key this generation would write, so no
adoption-or-repair work from pre-existing objects is predicted, and the
Chapter 2 collision shape (8 × `winner_digest_mismatch`) has no foothold
in the enumerated key space. P3 replication self-check: **PASS 3/3** on
§9's prescribed basis — with one load-bearing caveat (Caveat 1) that the
both-bases enumeration was designed to close.

## P1 — Live text basis (CONFIRMED)

- Content snapshot via the client connector (`GET /v2/sync/snapshot?family=content`):
  watermark **18**, 7 entities; Forever Pucked entity revision **3**, 21 chapters,
  Chapter 3 = 27 segments. Served-body SHA-256
  `e879f9de9ba1e36fb2a398eba8f4a4a884a098fef438912d5db79dac43789ce9`.
- Bindings snapshot (`family=bindings`): watermark **1818** (matches the
  gate-(c) closing watermark); served-body SHA-256
  `fde0c05002557dc1671696e8ed4392fcd16bc78ecc40a001d6bd674e14847342`.
  Exactly **3** bindings exist for Chapter 3 occurrences (idx 0–2), all
  provenance `migration`, format `wav`.
- Payloads were computed from this LIVE snapshot text — the census
  text-basis caveat (§4) does not apply to this preflight.

## P2 — Payload + key enumeration (CONFIRMED, shipped modules)

- Payload assembly: the SHIPPED `createD6WorkSource`
  (`worker/generation/d6-work-source.mjs`) driven against the live entity;
  all 27 segments resolve `ok`. Every segment is pov **Alex** → cast voice
  **Charon / gemini / gemini-3.8-flash-tts**, style direction 289 chars
  (SHA-256 `947c6ac695d91571bcb759d546463d76a7a0c0cddcbace3159a5ca2907ac1025`).
- Fingerprints: the SHIPPED `fingerprintFor` (`worker/executor.mjs:36`).
- Pre-split: the SHIPPED `preSplitText` (`worker/generation/policy-split.mjs`,
  ceiling 1,200 chars). Chunk concatenation reproduced each segment exactly
  (27/27). idx 3–25 → 2 chunks each on both text bases; idx 26 → 1 chunk.
- One reimplementation, disclosed: the speech-basis payload variant
  (Caveat 1) reuses the identical voice/model/style resolution with only
  the text field swapped to `speechText` — the basis §9 P2 prescribes.

## P3 — Replication self-check (CONFIRMED: PASS 3/3 on the §9 basis)

Recorded revision keys (live bindings, byte-identical to the approved
freeze-carry pin values, proposal §13):

| idx | occurrence | recorded revision key | speech-basis computed | text-basis computed |
|---|---|---|---|---|
| 0 | `6bd358a7…` | `e240adac1f4e3507…` | **MATCH** | MATCH |
| 1 | `16e860aa…` | `8963058e19995243…` | **MATCH** | MATCH |
| 2 | `467174dd…` | `987636ed2df4a51b…` | **MATCH** | MISMATCH (`3c9de805b19c9462…`) |

On §9's prescribed payload basis (`speechText`), the shipped
`fingerprintFor` + resolution pipeline reproduces all three recorded keys
exactly — the derivation is proven, and the preflight proceeded to P4.
The single text-basis mismatch is fully explained in Caveat 1 and changes
no conclusion: idx 2 is bound and will never be dispatched.

## Derivation caveats (read before citing the key sets)

**Caveat 1 — two text bases (CONFIRMED from source).** §9's key derivation
and the recorded migration-era fingerprints use payload text =
`segment.speechText`. The SHIPPED D6 work source instead builds
`payload.text = String(segment.text)` (`d6-work-source.mjs`), and the
provider adapter sends `plainSpeechText(payload.text)` (emphasis tags
stripped) to Gemini. The two strings are IDENTICAL for 23 of 27 Chapter 3
segments; they differ at idx 2 (bound) and at **idx 4, 5, 18**
(generatable). Consequence: at dispatch, the executor's flush/commit key
for idx 4, 5, 18 will be the TEXT-basis whole-segment fingerprint (Set B),
not the speech-basis one. This preflight therefore enumerated and checked
BOTH bases (Sets A/B/C below); all are free, so the divergence has no
occupancy consequence for this gate — but any future citation of "the"
Chapter 3 key set must name its basis.

**Caveat 2 — what a "key" is in the shipped D6 path (CONFIRMED from source).**
§9 counts 47 first-pass keys (46 chunk + 1 whole). In the shipped code,
chunk payloads go ONLY to the provider (`wrappedSynthesize` performs no
R2 write); the single R2 write per occurrence is the stitched flush under
`audio/<fingerprintFor(whole-segment payload)>` (`d6-executor.mjs`,
`flush-store.mjs`), which is also the binding's revision key. Runtime
POLICY_BLOCK sub-splits likewise create further provider CALLS under the
same whole-segment storage key, not further R2 keys. Set A is §9's set as
written and was checked as instructed; Set B is the actual R2 write
surface; Set C completes the speech-basis whole-key picture (the basis on
which the book's existing bindings' keys live).

**Caveat 3 — minor recorded-count delta (structural only).** idx 23's
recorded `textChars` is 1478 while both live strings measure 1477 — a
one-char recorded-vs-live delta of the same kind §7 already notes for the
chapter (≈63 chars across the work set). Immaterial to keys and occupancy.

## P4 — Occupancy reads (CONFIRMED)

Method: one cf-api R2 objects LIST per unique prefix `audio/<fingerprint>`
(metadata only — key, size, etag; no object body was downloaded for any
key). Mechanism validated against a known-occupied key before the sweep:
idx 0's binding key returned its object at size 2,171,878 — byte-equal to
the live binding record's size. Two generatable prefixes were re-listed
after the sweep and confirmed empty a second time.

| set | basis / shape | keys | occupied | free |
|---|---|---|---|---|
| A — §9 as written | speech-basis chunk keys idx 3–25 (46) + idx 26 whole (1) | 47 | **0** | **47** |
| B — executor flush surface | text-basis whole-segment keys idx 3–26 | 24 | **0** | **24** |
| C — speech-basis whole keys | whole-segment keys idx 3–25 | 23 | **0** | **23** |
| **unique prefixes** | (overlaps: idx 26 in A∩B; 20 identical-text segments in B∩C) | **73** | **0** | **73** |

Occupied keys: **none** — there is no occupied-key list to file.

## What this preflight proves, and what it does not (§9 strength, as executed)

- PROVES (at check time): for each enumerated key, whether an object
  exists at that exact key in `opalreader-storage`, with size and etag.
  Result: none exists at any of the 73 unique keys.
- DOES NOT prove adoptability: the executor adopts a pre-existing object
  only on digest match at its verify step; an occupied key could still
  have yielded `winner_digest_mismatch` → `failed_known` + repair
  (Chapter 2's shape — recorded cost, never a billing unknown). With zero
  occupied keys, this path is not predicted to arise from pre-existing
  objects at all.
- DOES NOT prove the converse at dispatch time: a key free at check time
  is free *then*. INFERRED practical reading: nothing else writes `audio/`
  keys absent a generation run, and no other generation is authorized in
  the window — so the check-time picture is the dispatch-time picture
  unless Julie authorizes other work in between.
- DOES NOT resolve winner provenance (which era/process wrote an
  occupying object, or why) — moot here (no occupying objects in scope),
  and in general remains the separately-gated provenance question,
  untouched by this preflight.
- An occupied key whose object is another occurrence's binding would not
  automatically be a collision: identical payload (same text + voice +
  style) yields the identical fingerprint BY CONSTRUCTION, and adoption
  is then legitimate deduplication. The collision case is precisely an
  occupying object whose recorded digest ≠ the payload's expected
  digest — which only the executor's verify step can finally determine.
- Coverage: every R2-addressable key derivable for the 24 generatable
  occurrences on either text basis (Sets A/B/C, 73 unique). Per Caveat 2,
  runtime POLICY_BLOCK sub-splits address no additional R2 keys.

## Per-key table (all FREE; full rows in `preflight-evidence.json`)

| set | idx | chunk | chars | fingerprint (prefix `audio/`) | occupied |
|---|---|---|---|---|---|
| A-s9-chunk | 3 | 0 | 716 | `1bf13ac334b25de0a38b35ae4f8112263d42cd89ff8d2764ad324b7ffc9f40ce` | no |
| A-s9-chunk | 3 | 1 | 714 | `b731164a0423f80dee1b7bc31c4225ab209f4c649f9c9867c4f5c04d60aed546` | no |
| A-s9-chunk | 4 | 0 | 680 | `4ea73b4996a34399ecf2e3f5bce9c8d1655731385acaad50b5ab96245755319d` | no |
| A-s9-chunk | 4 | 1 | 641 | `68ebf1509ad6eafb74acfff5c01670c38fc94d42a70e87aaa1d960f9d636e649` | no |
| A-s9-chunk | 5 | 0 | 682 | `bfe09257e0d176240fe71f5d83dd4a2c5788b9274fd280228bd8123539a84283` | no |
| A-s9-chunk | 5 | 1 | 661 | `fc3906f3189f4f5c937873b290cd495b679f0a64121e9d6169758ca268801bb4` | no |
| A-s9-chunk | 6 | 0 | 673 | `3d190ad0eb68d7e0c4413ae4697a6f0841ff24498ad06bcc16a8975411613d1c` | no |
| A-s9-chunk | 6 | 1 | 583 | `43119bf4a271ce5d57f3e6ed03cf0a08027cd55a0f5c0282fa072163dad301f6` | no |
| A-s9-chunk | 7 | 0 | 700 | `043f14ca50e59ee0b06dbcec6cdb84afd05fa1147cec7e32b1137a853bae1bfc` | no |
| A-s9-chunk | 7 | 1 | 713 | `c5a9032d07bffb8a97fbc8efbb9f392c03db674471e8f850f5cc3204c24b97bd` | no |
| A-s9-chunk | 8 | 0 | 732 | `1316fca6f07b6ada39ddd3724470e1dc5825a940644ce960504097bd44e17136` | no |
| A-s9-chunk | 8 | 1 | 724 | `e52470e94464f98157133f36485900f303cca06bfd13365eef34014ae3986fd3` | no |
| A-s9-chunk | 9 | 0 | 793 | `8e467385930412b9efabd1483a76588513da8a4ee2da0b6ff3be1a5ad55a6a10` | no |
| A-s9-chunk | 9 | 1 | 658 | `37ef6b0d9bcc23ade092c1a4c2a55c667de6cddce5e8a019674bea865dcbc2ea` | no |
| A-s9-chunk | 10 | 0 | 732 | `f05afb81ac962f7427d12d0687a58601bdc30d6b566f8d093388f8d3d0f1423b` | no |
| A-s9-chunk | 10 | 1 | 665 | `116776330ad4d0f0596747fec8e0e009f1c5716b9432370582356275e26edae5` | no |
| A-s9-chunk | 11 | 0 | 710 | `717eafdcaa1fac0588b7cd00642a7d782cdf77816736785c5d3bcf07878aea07` | no |
| A-s9-chunk | 11 | 1 | 632 | `dfc9f12b20624368a6070fcfa754777a4e417eb21fd4c4b25fb9ea6eacbe9f49` | no |
| A-s9-chunk | 12 | 0 | 739 | `aa5c5563eccbff80010b4f20680c9d656720b1ec0e3a30565524cf104a169d69` | no |
| A-s9-chunk | 12 | 1 | 677 | `44c93657be77458e02a0284e1f51d25977a4bac6fd978b6767ac641d95c10cd4` | no |
| A-s9-chunk | 13 | 0 | 715 | `6680617f2e730b451f32e3f187dc6f0082d0997d7bf00168fc5bb4c44aa7e95b` | no |
| A-s9-chunk | 13 | 1 | 656 | `cca17f43f6e6579d5168b7e78956b71a48b5769bc4035cecc5e739e9cf727465` | no |
| A-s9-chunk | 14 | 0 | 565 | `08acc303d7870ecd96e94295e95e8728e6843d341e958e77df580f20240760cb` | no |
| A-s9-chunk | 14 | 1 | 650 | `6629c4229787e53197df71f661dd01e399eaec1a6e104a29699f4a1ff1a7f0c3` | no |
| A-s9-chunk | 15 | 0 | 737 | `cdbe2e66495e2a87b3df2344fee0858f61f89e7153466022547a8b2b8472b228` | no |
| A-s9-chunk | 15 | 1 | 734 | `6a95781a5491e855ad8bd1b7a8e61234ebf493d2fb52c3e9db93a245836d1316` | no |
| A-s9-chunk | 16 | 0 | 766 | `7d9a9e1cd982f51fbba984e409360c9e71275bf7164f1c24c58f36f8cb95bdfa` | no |
| A-s9-chunk | 16 | 1 | 691 | `1b651634588c18ed2d89a85f0304e998e60ac7ce0f3d16ec8a056bbab444942d` | no |
| A-s9-chunk | 17 | 0 | 746 | `41015e1507358cd6afd9ca10cfbb641e20a870376a93265d5cddf6837fc60d7e` | no |
| A-s9-chunk | 17 | 1 | 743 | `5a725af0459ee3e7a7021cfd6e2ef1ef2e5dbec276f3fe799575a1ad9375f0fc` | no |
| A-s9-chunk | 18 | 0 | 727 | `a518357758d486128927d3bbe6aa7a4810239b62938b9cbfce4edcf898b4755e` | no |
| A-s9-chunk | 18 | 1 | 721 | `7533a692c8051db222918bb12c347720356d8c41ae852d931144030c5b25f954` | no |
| A-s9-chunk | 19 | 0 | 809 | `dd1c89cc9bd9dff73cdcf6e52d599998f3ebd1cb1c59e4ab0d34fb0456f3764e` | no |
| A-s9-chunk | 19 | 1 | 684 | `8579756945b8f8a695d1966cb1a6665b406fc0f53a8fc495853252f1036b068f` | no |
| A-s9-chunk | 20 | 0 | 598 | `8a100f3fc861b76a4c060b57c0568002a82d4779f6c4f896e933d35ed593889f` | no |
| A-s9-chunk | 20 | 1 | 620 | `92a42a9914887421ca8b708bc93bc9ccc16e46c2a2ad67000e64ca1d8fe3a6f1` | no |
| A-s9-chunk | 21 | 0 | 626 | `2e9c966515b6d9e4bbed297b09d043449d871a0f59e4e934fd807aaa2642b7fd` | no |
| A-s9-chunk | 21 | 1 | 665 | `3f13d8ba3d8020a430a1c95fd7d1628d74d6b03ef26f28f5615144fd61d55bbc` | no |
| A-s9-chunk | 22 | 0 | 691 | `b2db2c285266b5fc20109d03413485919824f6de6b42706ba2d1d538ddf20a8b` | no |
| A-s9-chunk | 22 | 1 | 739 | `7fce29006c0a59e10971b009083258f3c47a632b2ee1c6033ece34b9c7ad8112` | no |
| A-s9-chunk | 23 | 0 | 777 | `1976187c29b5989fca77ac8efcf22c73b78f9a640ee29ce157e872bbc2319d8f` | no |
| A-s9-chunk | 23 | 1 | 701 | `cace77a75f1ce8c5df63e29d55fc7e756734c9e9f0b8d49c9c96907893239dd1` | no |
| A-s9-chunk | 24 | 0 | 706 | `cacad33b749546fe932a099870fe72eaa25d030de25d1ab8911c3675f357f90a` | no |
| A-s9-chunk | 24 | 1 | 747 | `c6f114f49f4afebbe9b85d3d137e60ed82c4981fb5cab02ad00f1a106d8c8546` | no |
| A-s9-chunk | 25 | 0 | 686 | `475c0c820d7d36315477d15533e1d58fde14cd9c083d4bb6a8a0a7696b11442b` | no |
| A-s9-chunk | 25 | 1 | 681 | `ddfcb31ee56ff2b78e498cfc215b7d814571e52e06bc0169b9647d0d009aaa00` | no |
| A-s9-whole26 | 26 |  | 569 | `07d145f7b87b9621497d3b8a2c5828141592b94425fd5696fffedde9957d9590` | no |
| B-flush-whole-text | 3 |  | 1430 | `a0b6e95f4e8357b345ecfb142eb0d453b04672f6d6e39b70dd1306d69082574b` | no |
| B-flush-whole-text | 4 |  | 1300 | `6bc78cfb6f932e83a0b0aa3d524b27c42b182b7d1def4d30cf5e7085056d8cb6` | no |
| B-flush-whole-text | 5 |  | 1322 | `d590241a20b1854c354731a95b2a259525da7f1881c12b92f8f5a207fdd7fd5c` | no |
| B-flush-whole-text | 6 |  | 1256 | `dcc097bdc6cc77f7d463213e506d124ed01cf9d1ee26aa64bd6e655748a09208` | no |
| B-flush-whole-text | 7 |  | 1413 | `5da475e255f1b37cfcae4033f4183eae27cd2c7588b84bf7c7c73ef6cff4daa5` | no |
| B-flush-whole-text | 8 |  | 1456 | `1a586b45f7644ae062223503e6a157ca3ebf35a4f799bf71b3214270c2abf74d` | no |
| B-flush-whole-text | 9 |  | 1451 | `0cc6d7ea8ba2548618650131a7e206a7baa9ea181c27be4e709cda95d10f3e5e` | no |
| B-flush-whole-text | 10 |  | 1397 | `55c05ecb3458ca77f7c9c209e4aabfebb957d224a97a9c0827f2fda35709c6f8` | no |
| B-flush-whole-text | 11 |  | 1342 | `38fae69bff0dd58581a7efe4a3816a59b79665d5dc529980218ad9cad9104b33` | no |
| B-flush-whole-text | 12 |  | 1416 | `fe6075faccaf68a1f1551b2c96ef347e9368a360d3e5ea5b45b0f5462a183a8e` | no |
| B-flush-whole-text | 13 |  | 1371 | `a34b33e2fa4e010b9dc23d3119a2a2528423d757229973799435ec52b1b467b0` | no |
| B-flush-whole-text | 14 |  | 1215 | `b5ab7b6c2493cdbf68811f2e7a43c8cdbf34552cd84f31e13e1c9f59db91260a` | no |
| B-flush-whole-text | 15 |  | 1471 | `c1c17deebe3c7fa8cb4e0f6455dc5bee35d05fcd8fe392a5d5c5c636a813f6a7` | no |
| B-flush-whole-text | 16 |  | 1457 | `c423ea015961f3b10cdad3a6764636022eca7f651eebc7157be7fa130be25137` | no |
| B-flush-whole-text | 17 |  | 1489 | `104da525302013f70b35aef2aaa4b275b75da09572638108e9e4a249e3967d15` | no |
| B-flush-whole-text | 18 |  | 1427 | `1edb0d1fac467fe976f75e11c21e2f8d3cc6696cb710ff877aee582144f3af5b` | no |
| B-flush-whole-text | 19 |  | 1493 | `6c4d359ec9294194da53520c00ad4edd3c815008c41f1e7d5d453352e617d837` | no |
| B-flush-whole-text | 20 |  | 1218 | `91a39f0adc05a97ee40c5b17250da15f9e7c62520aad20113707b1cb844810e4` | no |
| B-flush-whole-text | 21 |  | 1291 | `9cc2c0d0b53b24e95f191e142024c546862268b3bb963188a9a0fbbf929cff8f` | no |
| B-flush-whole-text | 22 |  | 1430 | `21a52e870f508f4756b2b44ef7f135eb358cb9b02878544d127b6358de2dbd12` | no |
| B-flush-whole-text | 23 |  | 1478 | `860ecfcd7570707eb4636ee97f14b8e463bf879a3948ea10fee74c5abe9c202d` | no |
| B-flush-whole-text | 24 |  | 1453 | `df883ce900458a2effe3e2e028927816cc672b98fab157380ccee73533fdf557` | no |
| B-flush-whole-text | 25 |  | 1367 | `2b7fbef0f2e0de6984f8d2c85947f482a9d1e60bcddf06a681ce30a1456da310` | no |
| B-flush-whole-text | 26 |  | 569 | `07d145f7b87b9621497d3b8a2c5828141592b94425fd5696fffedde9957d9590` | no |
| C-whole-speech | 3 |  | 1430 | `a0b6e95f4e8357b345ecfb142eb0d453b04672f6d6e39b70dd1306d69082574b` | no |
| C-whole-speech | 4 |  | 1321 | `06c64e58a230e88a36726d922dc80f0840ec5ca3e07b36db99b3d0634e81e1eb` | no |
| C-whole-speech | 5 |  | 1343 | `d1aa5adc302fdace37f29e8b1dd9e0bacff1a128f312ddea40841c8e693e7c6a` | no |
| C-whole-speech | 6 |  | 1256 | `dcc097bdc6cc77f7d463213e506d124ed01cf9d1ee26aa64bd6e655748a09208` | no |
| C-whole-speech | 7 |  | 1413 | `5da475e255f1b37cfcae4033f4183eae27cd2c7588b84bf7c7c73ef6cff4daa5` | no |
| C-whole-speech | 8 |  | 1456 | `1a586b45f7644ae062223503e6a157ca3ebf35a4f799bf71b3214270c2abf74d` | no |
| C-whole-speech | 9 |  | 1451 | `0cc6d7ea8ba2548618650131a7e206a7baa9ea181c27be4e709cda95d10f3e5e` | no |
| C-whole-speech | 10 |  | 1397 | `55c05ecb3458ca77f7c9c209e4aabfebb957d224a97a9c0827f2fda35709c6f8` | no |
| C-whole-speech | 11 |  | 1342 | `38fae69bff0dd58581a7efe4a3816a59b79665d5dc529980218ad9cad9104b33` | no |
| C-whole-speech | 12 |  | 1416 | `fe6075faccaf68a1f1551b2c96ef347e9368a360d3e5ea5b45b0f5462a183a8e` | no |
| C-whole-speech | 13 |  | 1371 | `a34b33e2fa4e010b9dc23d3119a2a2528423d757229973799435ec52b1b467b0` | no |
| C-whole-speech | 14 |  | 1215 | `b5ab7b6c2493cdbf68811f2e7a43c8cdbf34552cd84f31e13e1c9f59db91260a` | no |
| C-whole-speech | 15 |  | 1471 | `c1c17deebe3c7fa8cb4e0f6455dc5bee35d05fcd8fe392a5d5c5c636a813f6a7` | no |
| C-whole-speech | 16 |  | 1457 | `c423ea015961f3b10cdad3a6764636022eca7f651eebc7157be7fa130be25137` | no |
| C-whole-speech | 17 |  | 1489 | `104da525302013f70b35aef2aaa4b275b75da09572638108e9e4a249e3967d15` | no |
| C-whole-speech | 18 |  | 1448 | `321fcc8b3865fc464ddb6a6e78898337fbcc5b72ee3ad2302e0a470c84daee25` | no |
| C-whole-speech | 19 |  | 1493 | `6c4d359ec9294194da53520c00ad4edd3c815008c41f1e7d5d453352e617d837` | no |
| C-whole-speech | 20 |  | 1218 | `91a39f0adc05a97ee40c5b17250da15f9e7c62520aad20113707b1cb844810e4` | no |
| C-whole-speech | 21 |  | 1291 | `9cc2c0d0b53b24e95f191e142024c546862268b3bb963188a9a0fbbf929cff8f` | no |
| C-whole-speech | 22 |  | 1430 | `21a52e870f508f4756b2b44ef7f135eb358cb9b02878544d127b6358de2dbd12` | no |
| C-whole-speech | 23 |  | 1478 | `860ecfcd7570707eb4636ee97f14b8e463bf879a3948ea10fee74c5abe9c202d` | no |
| C-whole-speech | 24 |  | 1453 | `df883ce900458a2effe3e2e028927816cc672b98fab157380ccee73533fdf557` | no |
| C-whole-speech | 25 |  | 1367 | `2b7fbef0f2e0de6984f8d2c85947f482a9d1e60bcddf06a681ce30a1456da310` | no |

— End of report. Prepared by Wren (preflight execution), 2026-10-31.
