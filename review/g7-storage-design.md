# G7 Storage Design — Moving the v2 Client State Record from localStorage to IndexedDB

**Status:** DESIGN ONLY. Prepared for Rowan's source-level review at Julie's instruction
("Fuller design to appease Rowan," Oct 29, 2026). The IndexedDB fix itself remains
**HELD**: this document authorizes nothing. No client, worker, or production code has
been modified; no data has been touched; nothing has been deployed, armed, generated,
or spent in its preparation. Evidence work was done in local scratch only
(`~/workspace/d6-build/g7-design-evidence/`) with synthetic fixture payloads.

**Review target:** Rowan's conditional review, board comment `6506410946`
(issue #15), which ruled the G7 diagnosis *plausible*, the IndexedDB direction
*conditionally sound*, and required a concrete design covering eight points before any
build approval. Sections 3–10 of this document map one-to-one onto those eight points.

**Basis (all verified firsthand from the published package tree):**

- Live accepted client: ui-pkg-3, commit `bf4e5ba2a31d6e47390817d2b1333ff2d7df9f1d`,
  build marker `d5b-v2-playback-client-14` (`modules/constants-ui3.js:11`).
- Source tree: `~/workspace/ui3-build/package/publish/` — `index.html` loads
  `./app-266.js?v=ui-pkg-3`; `app-266.js:173-174` registers `./sw-ui3.js`
  (cache `opalreader-shell-ui3`).
- SHA-256 of the load-bearing files in that tree (for pinning at build time):
  - `app-266.js` — `7709738b69c0cf15bc8f312e0425b2b3c0e896c5ab9050422b62ccdc0bc2a7d9`
  - `modules/storage-adapter.js` — `d41ae89c6001bab105ae89ba75815b90b2b844b49fc5444865c2467f4718bf64`
  - `modules/vendor/client-store-ui1.js` — `778d4c3367b5f9b65b738ab48ac8c9cfcfce4bb514acb927defc1df0c013e3ad`
  - `modules/runnable-ui3.js` — `d271b4d3df3930711f63492bb85ece4c9eed643c91965539d9f31659e5389b1a`
  - `modules/composition-ui3.js` — `a1d81ff739639fa6a6839649bd7a39d18e54e1a364621982d8c9bf7bb68f0cf0`
  - `modules/ownership.js` — `bf4e2578756e25406d4629f6b5bbd61c4dc66cb6a4b34993747694f76f9f70cd`
  - `index.html` — `a3bf01936147aaba49aecd88149d68487cbb5e27d02700588cbc7e89ea2355a6`
  - `sw-ui3.js` — `424cd8a81ea04c494809e307e6de440fae0be2c28316727753f098385d2be881`

---

## 1. Executive summary

Julie's iPhone cannot finish syncing the enriched library. Bindings are fully synced
(1799/1799); content is stuck at checkpoint 12 of 18, and every retry fails identically
with the drain reason `network_error`. The server library is complete and verified —
all seven books enriched, all five production proofs passing; the same changes pull
succeeds from a workstation.

The cause is on the device, in storage capacity. The v2 client persists its **entire**
state record — every family cache, the position journals, the command outbox, byte
confirmations — as **one JSON record in `window.localStorage`** under the key
`cs:state:v1`. Enrichment takes that record from ≈1.9M characters to ≈8.3M characters.
Browser localStorage quotas sit far below that (measured in a real Chromium on this
machine: 5,200,000 characters accepted, then `QuotaExceededError`). Because a sync page
applies atomically — one `setItem` or nothing — the six-book page can never land, the
cursor can never move, and the store's drain loop labels the storage throw
`network_error`, which is why the failure masquerades as a network problem.

**This is no longer only a plausible diagnosis.** Section 4 presents a deterministic
reproduction, run with byte-identical copies of the shipped store and storage adapter:
seed the record at its measured watermark-12 size, offer the measured seq 13–18 page,
and cap storage at a quota ceiling — the drain reproduces the device symptom exactly
(cursor frozen at 12, recorded reason `network_error`) while the error actually thrown
at the storage boundary is `QuotaExceededError`. With the identical store, page, and
seed over capacity-unconstrained storage, the same drain completes 12 → 18. The only
variable is whether the storage layer accepts the atomic write.

**The proposed fix** is the one the store was designed for. The store's own durability
contract says: *"In production the single record maps to one IndexedDB transaction"*
(`client-store-ui1.js` header, lines 22–28) — but production wired it to localStorage
instead. This design:

1. Adds a **key-scoped routing storage adapter**: the state key `cs:state:v1` is served
   by IndexedDB; **every other key — including the frozen Shelf bridge record
   `cs:shelf-bridge:v1` — continues to be served by the existing localStorage adapter,
   byte-for-byte unchanged.**
2. Performs a **one-time, verified, crash-safe migration** of the existing record
   under the client's existing single-writer lock, with digest verification before
   cutover and a forensic localStorage snapshot retained afterward.
3. Adds a **privacy-safe failure classification** so a storage failure can never again
   be reported as a network error.
4. Re-points the shell's synchronous localStorage state reads at an in-memory snapshot
   loaded from the active backend, so Diagnostics and the library stay truthful.

Nothing else changes: no server change, no data change, no Shelf bridge change, no
sync-protocol change, no payload shrinking. Section 11 lists the moves this design
explicitly forbids (including Rowan's: no cache splitting, no cache clearing, no
discarding positions or outboxes, no bypassing atomic sync to force 18/18).

---

## 2. Confirmed source facts

Each fact below was read directly from the published ui-pkg-3 tree named in the header.
Line numbers are from those files.

### 2.1 How state is stored today

| # | Fact | Source |
|---|------|--------|
| F1 | The whole client state is ONE record under key `cs:state:v1`. | `modules/constants-ui3.js:19` (`STATE_KEY`); `client-store-ui1.js:41` |
| F2 | Record shape: `deviceId`, `commandCounter`, `journalCounters`, `outbox[]`, `journals{}`, `caches{}` (per family: `floor/tip/cursor/entities/tombstones`), `bytes{}`, `money{}`; the drain adds `drainStatus{}` at runtime. | `client-store-ui1.js:45-53` (`emptyState`); `:296` (drainStatus write) |
| F3 | Every mutation is load → mutate → one atomic `storage.set(STATE_KEY, s)`, serialized per storage object by a promise-chain mutex. IDs (command IDs, journal localSeqs) are allocated inside the same write. | `client-store-ui1.js:59-81` |
| F4 | The store is storage-agnostic: it talks to an injected `{get,set,delete}` adapter, and its header states the production intent was one IndexedDB transaction per set. | `client-store-ui1.js:22-28, 56-57` |
| F5 | Production wires the store to **localStorage**: the runnable builds `createBrowserStorage(storageLike)` and the shell passes `storageLike: window.localStorage`. | `modules/runnable-ui3.js:41`; `app-266.js:602-604` |
| F6 | `createBrowserStorage` string-serializes: `get` = `JSON.parse(storageLike.getItem(key))`; `set` = `storageLike.setItem(key, JSON.stringify(value))`. A throwing `setItem` propagates to the caller. It implements the at-commit guard contract (`supportsCommitGuard: true`; guard runs immediately before the write). | `modules/storage-adapter.js:65-99` (esp. `:81`, `:87`) |
| F7 | All store/bridge/funnel writes funnel through an ownership-gated wrapper that **refuses any adapter without the at-commit guard contract** (`unsupported_storage_adapter`, fail closed). | `modules/storage-adapter.js:118-145`; `modules/composition-ui3.js:~478-520` |
| F8 | The composition intercepts `set` calls for `STATE_KEY` specifically (first-commit device-identity persistence). Key names are therefore load-bearing at the composition layer; any routing must be **below** this layer, keyed by the same names. | `modules/composition-ui3.js:497` |

### 2.2 The sync failure path

| # | Fact | Source |
|---|------|--------|
| F9 | A pull page applies atomically: the whole page is validated (contiguity from cursor, inside the pinned watermark) inside one `mutate`, so a failed write leaves the cache byte-identical and the cursor unmoved. | `client-store-ui1.js:241-272` (`applyPullPage`) |
| F10 | The drain loops pages until cursor ≥ tip, max 40 pages, and records a durable `drainStatus` on every exit. **Any** throw from `syncFamily` — fetch failure, parse failure, validation throw, or **storage write throw** — is caught and recorded as reason `network_error`. The label is a catch-all, not a classification. | `client-store-ui1.js:290-316` (catch at `:303`) |
| F11 | The transport swallows response-body parse errors (`try { data = await res.json(); } catch { data = null; }`), a second place where dissimilar failures collapse. | `modules/vendor/client/http-transport.js:~28-37` |
| F12 | Pending content changes seq 13–18 arrive as **one page**: the store requests up to 100 changes per page (`syncFamily(family, limit = 100)`), and only 6 are pending. Page payload sizes measured from the live changes pull: 667,341 / 1,167,017 / 1,201,938 / 1,383,057 / 1,404,946 / 1,454,026 JSON chars (≈7.28M total). | `client-store-ui1.js:274-278`; G5/G6 workstation pull |

### 2.3 Measured sizes (production figures, used as numbers only)

| Quantity | Value |
|---|---|
| Enriched content entity data (7 books) | ≈ 7.74M JSON chars |
| Bindings entity data (1,799) | ≈ 0.55M JSON chars |
| Device record at content watermark 12 (as seeded in the repro) | 1,871,025 JSON chars |
| Record after applying seq 13–18 (measured in the repro, Run B) | 8,276,823 JSON chars |
| Single `setItem` attempted at the failing apply (measured in the repro, Run A) | 8,276,702 chars |
| Real Chromium localStorage capacity (measured, §4.2) | 5,200,000 chars, then `QuotaExceededError` (code 22) |

### 2.4 Everything else that touches these keys

| Key / consumer | Where it lives today | Source |
|---|---|---|
| `cs:shelf-bridge:v1` (Shelf bridge record `{outbox:[…]}`, cap 300) | localStorage, via the **same injected storage** as the state record (the bridge calls `storage.get/set(BRIDGE_KEY)` on the composition's gated storage) | `modules/vendor/client/shelf-bridge.js:28-29, 81-106`; `modules/constants-ui3.js:20` |
| `opalreader.v2.deviceId` (shell device-identity slot) | localStorage via the shell storage (separate from the store adapter) | `modules/constants-ui3.js:18`; `modules/device-identity.js` |
| `opalreader.v2.uiPrefs` (presentation only) | localStorage, read/written directly by the shell | `app-266.js:666-676` |
| Device identity resolution reads **both** `STATE_KEY` and `SHELF_KEY` through the store storage (`inspectStoreRecord`, `resolveDeviceIdentity`), with stop-and-report states on mismatch — including "shell slot present + store record missing" | injected storage | `modules/device-identity.js:20-60` |
| The shell reads `STATE_KEY` **directly from localStorage, synchronously**, for: sync truth (`bindingsIncomplete`, `syncRowText`), library contents (`contentEntities`), bindings lookup (`bindingFor`), Shelf attribution (`shelfReadIdFor`), successor computation (`flattenSegments`) | `window.localStorage` | `app-266.js:210-211, 224, 230, 276-277, 282-307` |
| The shell reads `SHELF_KEY` directly from localStorage for the pending count | `window.localStorage` | `app-266.js:301-307` |
| Single-writer ownership: Web Locks (`navigator.locks`), lock name `opalreader-v2-single-writer`, fail-closed if unavailable; epoch token re-checked at every write commit; draining release | Modules | `modules/ownership.js` (whole file); runnable acquires **before** constructing the candidate: `runnable-ui3.js:44-47` |
| The v1 app (rollback line, bundled in `app-262.js`) has its **own** IndexedDB database named `opalreader.v1` (stores: books/audio/settings/epubs). No v2 module references IndexedDB at all today. | — | `app-262.js` (v1 bundle); grep of `modules/` |

**Name-collision check (for §5's new names):** the strings `opalreader-v2-state` and
`cs:state:backend` appear nowhere in the published tree; the only IndexedDB database in
the tree is v1's `opalreader.v1`, which this design does not touch.

---

## 3. Rowan point 1 — Failure classification (privacy-safe, conclusive)

### 3.1 Why the current label cannot classify

In the shipped code, four dissimilar failure families converge on one string:

1. **Transport**: `fetch` rejects (offline, TLS, timeout) inside `pullChanges`.
2. **Protocol/validation**: `applyPullPage` *returns* `{applied:false, reason}` for
   family mismatch / non-contiguous page / next-seq mismatch — these are already
   truthfully labelled and must stay distinct.
3. **Serialization**: `JSON.stringify` in the adapter's `set` can throw (cyclic
   structure → `TypeError`; over-length string → `RangeError` in some engines).
4. **Storage capacity/availability**: `setItem` throws `QuotaExceededError`
   (DOMException, code 22 in Chromium/WebKit; `NS_ERROR_DOM_QUOTA_REACHED` in Firefox),
   or `SecurityError` when storage is blocked.

Families 1, 3, and 4 all surface through `syncFamily`'s throw into the drain's single
`catch` at `client-store-ui1.js:303`, which records `network_error` for all of them.
The device evidence (`network_error` + frozen cursor + successful workstation pull) is
consistent with family 4 and inconsistent with family 1, but the label itself proves
nothing — exactly Rowan's objection.

### 3.2 The classifier (future build; specified here, not built)

A single function, `classifyStorageError(err, stage)`, living beside the storage
adapter, mapping a caught error to a closed enum. Matching is by `err.name` first,
then legacy `err.code`, never by message text:

| Class | Match rule | Meaning |
|---|---|---|
| `storage_quota_exceeded` | name `QuotaExceededError` or `NS_ERROR_DOM_QUOTA_REACHED`, or code `22` / `1014` | The backend refused the write for space. |
| `storage_unavailable` | name `SecurityError`, `InvalidStateError`, `UnknownError` (IDB), or the adapter's own `browser_storage_required` / a synchronous throw on a probe write | Storage exists in the API but cannot be used (blocked, private-mode, corrupted DB, blocked open). |
| `storage_serialization_failed` | `TypeError` mentioning cyclic structure, or `RangeError`, thrown **inside the adapter's set stage** | The record could not be serialized. |
| `storage_write_failed` | Any other throw from the adapter's set/delete stage | Unclassified storage failure; still not a network error. |
| `network_error` | A throw from the **transport stage only** (`pullChanges`/`snapshot` fetch), where the adapter was never reached | Reserved; regains its literal meaning. |
| `apply_failed` (+ existing sub-reasons) | `applyPullPage` non-applied returns, unchanged | Protocol validation, as today. |

**Instrumentation points** (the minimum set that makes classification conclusive
on-device):

- `syncFamilyDrain` distinguishes *where* `syncFamily` threw by wrapping its two
  stages separately: the transport call and the apply (which internally performs the
  storage write). The store gains an optional injected `onStageError({stage, class,
  ...fields})` hook — the same injected-seam pattern the codebase already uses for
  transport, clock, and ID generation — so the vendored store's logic changes are
  limited to (a) the stage split and (b) carrying the classified reason into
  `finish()`. `drainStatus.reason` then records the class, not the catch-all.
- The routing adapter (§5.2) classifies its own failures at the boundary where they
  occur and rethrows with a stable `.code` equal to the class. Store-level
  classification therefore never has to guess from a raw DOMException.

### 3.3 Privacy-safe diagnostic field set (closed allowlist)

Every storage/sync diagnostic record — in `drainStatus`, in the new storage-health
diagnostics row (§5.6), and in any migration report — may contain **only**:

- `op` (e.g. `sync_drain`, `storage_set`, `migration`), `family`, `stage`
  (`transport` | `apply` | `storage_write` | `storage_open` | `verify`)
- `class` (the §3.2 enum) and the raw `errorName` / `errorCode` of the caught error
- `cursor`, `tip`, page `seqFrom`/`seqTo`, `pageCount`
- `pagePayloadChars` (sum of the page's payload JSON lengths), `recordChars`
  (length of the serialized record at the failing write), `attemptedChars`
- `storageBackend` (`localstorage` | `indexeddb`), `storageEstimateUsage` /
  `storageEstimateQuota` from `navigator.storage.estimate()` **where the browser
  provides it** (best-effort; absence is recorded as `null`, never estimated by hand)
- `at` (ISO timestamp), `build` (build marker)

**Never** recorded: segment text or any content payload or fragment, book titles,
Shelf queue/read IDs, command IDs beyond counts, the access token, or any part of any
record body. Digests (SHA-256) of records are computed on-device for verification and
reported only as *match/mismatch booleans* off-device; the digest values themselves
stay in the local evidence file, consistent with how G5/G6 evidence handled digests.

### 3.4 What this buys at the device gate

On the first attended Connect under a future build, Diagnostics will state the class
in plain terms — e.g. `content 12/18 PARTIAL (storage_quota_exceeded)` on the legacy
backend if migration were somehow bypassed, or a complete drain on IndexedDB. That
on-device, classified readout — together with §4's reproduction — is the conclusive
evidence Rowan asked for: the reproduction proves the mechanism deterministically; the
classified device readout proves which class the real device hit.

---

## 4. Evidence — deterministic reproduction (run Oct 29, 2026)

All artifacts: `~/workspace/d6-build/g7-design-evidence/`. Synthetic fixture payloads
only; production figures used as size numbers only. No production code was modified —
the reproduction imports **byte-identical copies** of the shipped modules (SHA-256
verified against the published tree: `storage-adapter.mjs` = `d41ae89c…`,
`client-store-ui1.mjs` = `778d4c33…`).

### 4.1 Reproduction 1 — mechanism (Node 24, shipped store + shipped adapter)

Script: `repro-quota.mjs`; output: `repro-quota-output.txt`.

Setup: the store's state is seeded at the G7 device posture — content cursor 12 / tip
12 (Finding Home enriched, six books not), bindings 1799/1799 — serialized size
**1,871,025 chars**. The stub transport returns one content page, seq 13–18,
`highWatermark 18`, whose payloads are sized to the measured live page
(667,341 … 1,454,026 chars; ≈7.28M total). Two runs differ in **one variable only**:
whether the storage layer accepts the atomic write.

**Run A** — shipped `createBrowserStorage` over a localStorage stub whose `setItem`
throws `QuotaExceededError` (code 22) above a 5,000,000-char ceiling:

```
storage.set threw: [{"name":"QuotaExceededError","code":22,"attemptedChars":8276702}]
drain result: complete=false reason=network_error pages=0
content cursor: 12 -> 12 (tip 12)
drainStatus recorded in state: {"complete":false,"cursor":12,"tip":12,"reason":"network_error",...}
record size after attempt: 1871158 chars (page never landed)
```

This is the G7 device symptom reproduced exactly — including the subtle detail that
the *drainStatus write itself succeeds* (the pre-page record still fits, so the
failure gets durably recorded, which is why Julie's Diagnostics can display
`network_error` at 12/12 at all).

**Run B** — identical seed, identical page, identical store; storage =
capacity-unconstrained adapter (the shipped `createAsyncStorage` harness adapter):

```
drain result: complete=true reason=null pages=1
content cursor: 12 -> 18 (tip 18)
final record: 8276823 JSON chars
```

**What this proves:** the shipped sync/store logic is correct; the page is valid; the
failure is fully explained by the storage write being refused, and the refusal is
mislabelled by the drain's catch-all. The result is threshold-independent: any quota
ceiling strictly between 1,871,025 and 8,276,702 chars produces Run A's outcome.

**What it does not prove by itself:** the exact quota number of Julie's WKWebView.
That is why §4.2 anchors a real-browser figure and §3.4 makes the future build report
the class from the device itself.

### 4.2 Reproduction 2 — real-browser localStorage capacity (Chromium)

Script: `quota-probe-cdp.mjs` (+ `quota-probe.html`); output: `quota-probe-output.txt`.
The bundled Chromium (HeadlessChrome 155) was driven over CDP against a loopback page
that grows one localStorage value in 100,000-char steps until `setItem` throws:

```json
{"maxStoredChars": 5200000, "chunks": 52,
 "error": {"name": "QuotaExceededError", "code": 22},
 "ua": "Mozilla/5.0 ... HeadlessChrome/155.0.0.0 ..."}
```

A real browser engine accepts **5,200,000 chars** — comfortably above the device's
current 1.87M-char record and far below the 8,276,823 chars the enriched record needs.
Chromium's ceiling is the *generous* end of the browser range (WebKit's documented
localStorage quota has historically been smaller), so the conclusion does not depend
on WKWebView matching Chromium's number: the enriched record exceeds even the largest
mainstream localStorage quota, and the pre-enrichment record fits under the smallest
plausible one. That asymmetry — fits before, cannot fit after, atomic page — is the
whole failure.

### 4.3 Honest limits of the evidence

- WKWebView's exact quota on Julie's iOS 27 devices was **not** measured (doing so
  requires running code on her device, which this design does not do uninvited; the
  classified readout at the attended device gate is the sanctioned measurement).
- IndexedDB quotas and eviction behavior in WKWebView are addressed as design
  constraints in §5.3, not as measured facts.
- The reproduction uses the *harness* adapter as Run B's control, not a real
  IndexedDB adapter — deliberately: it isolates the variable (write acceptance). The
  real IDB adapter is a build deliverable and is tested in §9 before any device sees
  it.

---

## 5. The design

### 5.1 Shape in one paragraph

Production's only change is **which adapter object the runnable constructs**. Today
`runnable-ui3.js:41` builds `createBrowserStorage(window.localStorage)` and hands it
to the candidate. The new package (working name **ui-pkg-4**) builds instead a
**routing adapter** (`createStateRoutingStorage`) that wraps two backends:

- an **IndexedDB adapter** serving exactly one key: `cs:state:v1`;
- the existing `createBrowserStorage(window.localStorage)`, serving **every other
  key unchanged** — including `cs:shelf-bridge:v1`.

Everything above the adapter — the ownership gate, the composition's `STATE_KEY`
interception, device identity, the store, the Shelf bridge, the funnel — sees the same
`{get, set, delete}` contract with `supportsCommitGuard: true` and the same at-commit
guard semantics (F6, F7). The store needs **no** logic change for the migration itself
(the §3.2 stage split for classification is the only store delta). The runnable also
runs the §5.4 migration, after acquiring the single-writer lock and before
constructing the candidate — the exact seam at `runnable-ui3.js:44-47`.

### 5.2 The routing adapter

```
createStateRoutingStorage({ idb, legacy, stateKey = STATE_KEY, marker })
  get(key)    -> key === stateKey && cutoverDone ? idb.get(key) : legacy.get(key)
  set(key, v, guard)
              -> stateKey && cutoverDone ? idb.set(key, v, guard) : legacy.set(...)
  delete(...) -> same dispatch
  supportsCommitGuard: true
```

Rules:

- **Dispatch is by exact key equality against `STATE_KEY` only.** No prefix matching,
  no family sniffing. A key the router does not recognize goes to the legacy adapter.
  This is the mechanical guarantee that the Shelf record can never be routed into
  IndexedDB by accident.
- **Before cutover**, even `STATE_KEY` goes to the legacy adapter (the migration
  module drives the IDB side explicitly through the IDB adapter's own interface, not
  through the router). The router flips its internal `cutoverDone` flag only when the
  migration state machine reports state CUTOVER (§5.4) or when boot finds a valid
  prior cutover (marker + IDB meta agree, §5.5).
- **After cutover there is no path back through the router.** No option, flag, or
  error branch re-enables legacy writes to `STATE_KEY` (§7).
- The router preserves the test seams the existing adapters expose (`setFailureOnce`,
  `setDelay`) by delegation, so the established ownership/drain harnesses keep working
  against it.

### 5.3 The IndexedDB adapter

| Decision | Choice | Justification |
|---|---|---|
| Database | Name `opalreader-v2-state`, version `1` | Name verified collision-free (§2.4); v1's DB (`opalreader.v1`) is a different database and is never opened by v2 code. |
| Layout | One object store `records`, `keyPath: "key"`. Rows: `{key, value}` where `value` is the **JSON string** of the record. A second row under key `cs:state:meta` holds migration provenance (§5.4). | Mirrors the store's single-record model exactly — one row, one transaction per set, precisely the contract the store header describes. |
| Value form | **String, not structured clone** | Byte equality is the migration's verification primitive (§5.4): digest the string read from localStorage, store that exact string, read it back, digest again, compare. Structured clone would store an object graph whose re-serialization is not guaranteed byte-identical (key order, number formatting), destroying the digest check and complicating export/rollback. String storage also keeps the adapter's semantics identical to the localStorage adapter's (F6), so the store cannot observe the difference. |
| `get` | Readonly transaction; returns `JSON.parse(row.value)`, `undefined` if absent | Matches the existing adapter contract exactly (including `undefined` for missing). |
| `set` | One `readwrite` transaction on `records`; invoke the at-commit **guard immediately before `put`** (the IDB analogue of the localStorage adapter's pre-`setItem` guard — if the guard throws, abort the transaction and let nothing land); resolve on `tx.oncomplete`, reject with the classified error on `tx.onerror`/`onabort` | Preserves F7's ownership-epoch-at-commit guarantee across the backend swap; a transaction is atomic, so a crash mid-set leaves either the old or the new record, never a torn one. |
| Open/upgrade | Open is awaited once at runnable construction (before migration/identity). `onversionchange` on the live connection → close it and surface `storage_unavailable` rather than fighting an upgrade. A blocked open (another connection holding a version change) beyond a bounded wait → `storage_unavailable`, fail closed. | Matches the client's existing fail-closed posture on ownership (F: ownership.js) — never degrade to uncoordinated writes. |
| Durability | After a successful cutover the build calls `navigator.storage.persist()` (best-effort, result only recorded) and surfaces `navigator.storage.estimate()` figures in the storage diagnostics row when available. | WKWebView may treat web storage as evictable under pressure; the design **does not claim** persistence guarantees the platform doesn't give. The honest mitigations are: the server remains the source of truth for both caches (any evicted state re-syncs), the Shelf outbox deliberately stays in localStorage (its current, known-surviving home), and §9 includes an eviction-recovery test (delete the DB → next launch detects marker/meta disagreement → stop-and-report with re-sync path, never silent state fabrication). |
| Quota | IDB quota is origin-wide and orders of magnitude larger (gigabyte-scale on both Chromium and WebKit in normal conditions); an 8.3M-char string is unremarkable. A quota refusal at the IDB layer classifies as `storage_quota_exceeded` (§3.2) and fails closed with the pre-write record intact (transaction abort). | The failure mode Rowan required be handled: IDB full/unavailable must be a *diagnosed stop*, not a fallback. |

### 5.4 Migration state machine (Rowan points 2, 3, 4)

Migration runs **once**, inside `createRunnableClient`, after `owner.acquire()`
(single-writer lock held — no other tab of this build can be mid-write) and before
`createCandidate` (so device identity, the store, and the bridge are all constructed
over the already-decided backend). It is driven by a small explicit state machine;
every state is recoverable by re-running from boot, and no state transition deletes
anything.

| State | Action | Crash/reload during → recovery |
|---|---|---|
| **S0 LEGACY_ONLY** | Boot state when no cutover marker exists. Router serves all keys from legacy. Record the raw localStorage string for `STATE_KEY` (`sourceRaw`, may be absent on a genuinely fresh install — then there is nothing to migrate: initialize IDB empty, write meta `{migratedFrom: "none"}`, go straight to CUTOVER). | Nothing written yet. Re-run is a no-op. |
| **S1 IDB_PREPARED** | Open/create the DB (§5.3). If open fails → classify (`storage_unavailable`), **stay in S0**, surface the diagnostic, and let the client run on legacy exactly as today (capped, but functional and truthful). Migration is retried on the next launch. | DB creation is idempotent; partial preparation is indistinguishable from prepared. |
| **S2 SOURCE_SNAPSHOT** | Read `sourceRaw`; parse it; validate schema (plain object; the F2 top-level keys present or defaultable exactly as `load()` defaults them; `deviceId` either null or equal to the shell slot if a slot exists — a mismatch is **not** migrated over: stop with the same stop-and-report posture device identity already uses). Compute `sourceChars` and `sourceSha256` (SHA-256 of the exact raw string). Compute the **Shelf guard**: SHA-256 of the raw `SHELF_KEY` string (or `absent`), stored in the migration report for S6 comparison. | Read-only state. Re-run recomputes identical values. |
| **S3 IDB_WRITTEN** | One readwrite transaction puts two rows: `{key: STATE_KEY, value: sourceRaw}` and the meta row `{schema: 1, source: "localStorage", sourceChars, sourceSha256, stateSha256: sourceSha256, migratedAt, migratedByBuild}`. | IDB transactions are atomic: the pair is either wholly present or wholly absent on next boot. If absent → S2 re-runs. If present → boot detects it (marker not yet written, meta present) and resumes at S4 instead of re-writing. **No split state is possible.** |
| **S4 VERIFIED** | In a **fresh transaction and a fresh DB connection**, read the state row back. Require: string equality with `sourceRaw` (byte-for-byte), SHA-256 equality, successful `JSON.parse`, and field-level invariant counts equal to the source's (per-family cursor/tip/entity counts, outbox length, journal event counts, `commandCounter`, deviceId). Any mismatch → **abort migration**: delete the two IDB rows (the only delete in the machine, of data this machine itself just wrote), classify `storage_write_failed`/`verify_failed`, stay in S0, surface the diagnostic. Legacy was never modified, so aborting is lossless. | Verification is read-only; re-running it is always safe. |
| **S5 CUTOVER** | Write the localStorage marker `cs:state:backend` = `{"backend":"indexeddb","version":1,"stateSha256":<sourceSha256>,"at":<ISO>}` (tiny; cannot itself hit quota). Only **after** the marker write succeeds does the router flip to IDB for `STATE_KEY`. From this instant: legacy `STATE_KEY` is never written by this build again. | Crash between marker write and router flip is impossible to observe (same synchronous boot path). Crash after → next boot sees marker + meta; runs the §5.5 boot agreement check and serves IDB. |
| **S6 STEADY + RETIREMENT_ELIGIBLE** | Steady state: router serves `STATE_KEY` from IDB. The legacy record remains **byte-identical**, a forensic snapshot. Recompute the Shelf guard at the first post-cutover Connect and require equality with S2's value (proof the migration left the frozen record untouched — the router never routes it, so this should be a tautology; it is checked anyway). **Retirement** (removing the legacy snapshot) is *not* part of steady state or of this package's rollout: it requires its own later, separate Julie authorization after both devices verify (§10), and the retirement step is exactly: verify IDB health → `removeItem(STATE_KEY)` → leave the marker (the marker is what prevents any legacy-mode misread of the now-absent record). | If the app is killed in steady state, nothing is pending; boot agreement check (§5.5) is the whole recovery. |

**Idempotence & replay safety:** every step is either read-only, atomic, or guarded by
the marker/meta agreement check. Re-running migration after any crash converges to the
same end state and can never replay store mutations — migration moves the record
*verbatim*; it does not re-execute outbox commands, journal events, or sync pages.
Command dedupe is preserved structurally: `commandCounter` and the outbox migrate as
data (§8), so no command ID can be reissued after migration.

**Multi-tab / multi-context (Rowan point 3, concurrency half):**

- The existing Web Lock (`opalreader-v2-single-writer`) is held for the whole
  migration (§5.4 preamble), and the ownership epoch guard continues to fence every
  store write afterward (F7). A second tab of the *new* build blocks on the lock with
  the shell's existing "Waiting for the other open copy…" message, then boots into
  S6 via the agreement check.
- A second tab of the **old** build is the genuine hazard: it ignores the marker and
  would write the legacy record. Defenses, in order:
  1. **Procedural** (rollout, §10): all other copies are closed before the first
     new-build Connect — the standing practice from every prior window, and the old
     tab also holds the same Web Lock, so a new-build Connect in another tab waits
     rather than racing it.
  2. **Detective** (§5.5): every post-cutover boot hashes the legacy raw string. If it
     differs from `sourceSha256`, a legacy writer touched it → **stop-and-report**
     (`legacy_writer_detected`), no merge, no silent choice of either copy. The IDB
     record remains authoritative and untouched by the contaminated legacy copy.
  3. **Structural**: after cutover the new build never *reads* the legacy state record
     as live state (only hashes it), so contamination cannot flow into IDB.
- Two *devices* (iPhone/iPad) are independent by construction: each has its own
  browser storage, its own migration, its own deviceId. Nothing in this design
  coordinates or needs to coordinate across devices; the coordinator server already
  owns cross-device truth.

### 5.5 Boot agreement check (every launch after first migration)

Before the router decides the backend for `STATE_KEY`:

1. Marker absent → legacy mode (S0). If IDB meta exists anyway (crashed mid-S3/S4),
   resume verification (§5.4) rather than trusting either copy.
2. Marker present → require: IDB opens; meta row exists; `meta.stateSha256` equals
   the SHA-256 of the IDB state row's string **at migration time** is *not* required
   after steady-state writes begin (the record legitimately evolves) — instead require
   meta presence + schema version + the state row parses + its `deviceId` agrees with
   the shell slot. (Provenance fields stay frozen in meta; liveness checks are
   structural, not digest-based, after cutover.)
3. Marker present but IDB missing/unreadable/schema-mismatched → **fail closed**:
   `storage_unavailable` stop with diagnostics. Never serve the stale legacy snapshot
   as if it were current (§7).
4. Legacy tripwire: hash the legacy raw string; mismatch vs `sourceSha256` →
   `legacy_writer_detected` stop-and-report (§5.4). (Skipped gracefully once the
   snapshot has been retired under S6 authorization — absence then is expected.)

### 5.6 Diagnostics and shell reads after migration (the `readStateRecord` problem)

The shell currently reads the state record **synchronously from localStorage** in
seven places (§2.4). If those reads kept pointing at localStorage after cutover,
Diagnostics would freeze at the watermark-12 snapshot and the library would render
stale books — a truthful-UI violation of exactly the kind CORR1 was built to fix.
Design:

- The shell gains `loadStateSnapshot()`: an async boot step that reads the record
  **from the active backend** (marker-aware: legacy → the same localStorage read as
  today; IDB → a readonly IDB read via the same adapter module) and caches the parsed
  record in memory as `stateSnapshot`. Boot awaits it before first render (the
  existing startup-failure notice is the backstop if it throws, and the failure is
  classified per §3.2).
- `readStateRecord()` becomes a synchronous accessor over `stateSnapshot` — **same
  return shape, same call sites** (`bindingsIncomplete`, `syncRowText`,
  `contentEntities`, `bindingEntities`, `shelfReadIdFor`, `bindingFor`,
  `flattenSegments` all keep working verbatim). The snapshot is refreshed at the
  points the shell already re-reads state today: after Connect's drains complete, and
  on entering the Library/Diagnostics screens after any sync.
- `shelfOutboxCount()` is **unchanged**: it reads `SHELF_KEY` from localStorage,
  which is still exactly where that record lives (§6).
- Diagnostics gains one row, **State storage**, showing: backend
  (`IndexedDB` / `Local (legacy)`), migration state/date when applicable, the last
  classified storage result (§3.3 fields), and `navigator.storage.estimate()` figures
  when available. The existing sync rows are untouched in form; their *source* becomes
  truthful again.
- `modules/device-identity.js` needs no change: it already reads through the injected
  storage, so the router gives it the migrated record (§2.4). Its stop-and-report
  states keep working — and §5.4/S2 deliberately runs migration *before* identity
  resolution so a storage failure is classified as storage, not mistaken for an
  identity reset.

---

## 6. Rowan point 5 — Exclusion and hash guard for the frozen Shelf bridge and UI prefs

The frozen surfaces are excluded by **three independent mechanisms**, so no single
mistake can move them:

1. **Routing exclusion (mechanical).** The router dispatches on exact equality with
   `STATE_KEY` (§5.2). `cs:shelf-bridge:v1` can only ever reach the legacy adapter —
   the same adapter, wrapping the same localStorage, that serves it today. The Shelf
   bridge module itself (`modules/vendor/client/shelf-bridge.js`, SHA-256 pinned at
   build time against the accepted `bc0a5879…` bridge lineage) is **not modified**;
   neither is any bridge constant (`BRIDGE_KEY`, `MAX_OUTBOX 300`, merge window,
   checkpoint/grace/flush timings).
2. **Direct-read exclusion.** The shell's `shelfOutboxCount()` and the UI prefs
   accessors (`app-266.js:301-307, 666-676`) read/write localStorage directly and are
   **not re-pointed** — there is no new code path between them and localStorage at all.
   `opalreader.v2.deviceId` (shell slot) likewise stays in shell storage.
3. **Hash guard (detective).** Migration S2 computes SHA-256 over the raw localStorage
   strings of `SHELF_KEY` and `UI_PREFS_KEY` (or records `absent`); S6 recomputes them
   at the first post-cutover Connect and requires equality. (The deviceId slot is
   excluded from the guard because the composition legitimately writes it on a first
   durable commit for a *fresh* identity; on Julie's devices the identity is long
   established, and identity agreement is separately enforced by device-identity's
   existing checks.) Guard outcomes are reported as booleans + the Shelf outbox
   **count** (7 on the iPhone at G7) — never the digests or contents off-device.
   A guard mismatch aborts nothing retroactively (the state migration is already
   verified independently) but **stops the rollout** and is reported before any
   further step: it would mean something outside this design touched frozen state.

Additionally, the build's byte-stability battery (§9) must prove the candidate tree's
Shelf bridge file and the bridge's storage-key handling are byte-identical to the
accepted package, in line with every prior package's frozen-bridge discipline.

## 7. Rowan point 4 (second half) — Rollback policy and failure recovery

Rollback has three distinct regimes; conflating them is how stale records get
resurrected, so they are named separately:

**R1 — Pre-cutover abandonment (full, clean rollback).** At any point before S5
completes, abandoning the migration is lossless by construction: delete the two IDB
rows the migration wrote, leave localStorage untouched, and the device is bit-for-bit
in its pre-package state (modulo the package's own code/cache identity). The old
build (ui-pkg-3) also remains fully viable in this regime — nothing it reads has
changed. This is the rollback exercised in tests (§9) and available throughout the
build/review phase and the first attended Connect (migration can be refused at S1/S4
and the session continues on legacy).

**R2 — Post-cutover package rollback (NOT silent; honestly limited).** After S5, the
legacy record is a stale snapshot. Reverting to ui-pkg-3 would make the old build read
that snapshot as live state — resurrecting watermark 12 and discarding everything
since — **and** the old build could not hold the enriched library anyway (that is the
bug). Therefore: *there is no silent or automatic rollback to the old build after
cutover, and this design does not pretend otherwise.* The sanctioned post-cutover
recovery paths are, in order:
   1. **Forward-fix**: a corrected ui-pkg-4.x build over the same IDB database (the
      database name/version and record format are package-stable by design; a
      forward build must read the existing DB or explicitly migrate it forward).
   2. **Attended export-back** (Julie-authorized, diagnostics-driven): the new build
      writes the current IDB state string toward localStorage **only if it fits** —
      post-enrichment it does not (≈8.3M chars > quota), so export-back is expected to
      refuse with `storage_quota_exceeded` and say so; it exists for completeness and
      for pre-enrichment-sized records, not as the plan.
   3. **Attended reset-and-resync** (Julie-authorized, last resort): clear the IDB
      state record and let the client re-sync caches from the server (the server is
      the source of truth for content and bindings). What this **loses** is exactly
      the device-only data enumerated in §8 — unacknowledged journal events (listening
      positions not yet receipted), byte confirmations, and drain history. It is
      therefore a human decision with the loss stated in advance, never an automatic
      recovery. (The Shelf outbox is **not** lost in a reset: it lives in localStorage
      and is out of scope of the reset.)
   This asymmetry — full rollback before cutover, forward-fix after — is a deliberate
   design decision that must be explicitly accepted at Julie's build approval gate.

**R3 — Backend failure in steady state.** IDB unavailable at boot after cutover →
§5.5 fail-closed stop (`storage_unavailable`), state intact in whichever backend
holds it, no fallback writes anywhere. IDB write refusal (quota) → transaction abort,
pre-write record intact, classified diagnostic, client continues read/playback from
the last durable record where the existing code already tolerates a failed mutation
by surfacing it. At no point does any error path write the state record to
localStorage "temporarily" — a temporary copy is precisely how split-brain starts.

## 8. Rowan point 6 — Data-preservation inventory

Migration moves the record **verbatim as a string**; preservation is therefore a
property of the copy, verified field-by-field in S4. The inventory of what must
survive, and how each item is checked:

| State (location) | Contents | Preservation check |
|---|---|---|
| `deviceId` (state record) | The device's stable identity (iPhone `b3af41bb-…`, iPad `993e2e00-…`) | S4 equality; agreement with shell slot enforced by existing device-identity checks on first post-migration launch |
| `commandCounter` + `outbox[]` | Command dedupe: IDs are `${deviceId}-cmd-${counter}`; the counter and every queued/sent_unacked/acked entry with receipts migrate as data | S4: counter equality + outbox length + per-entry status counts. No entry is dispatched, dropped, or re-minted by migration |
| `journals{}` + `journalCounters{}` | Position journal events (incl. unacknowledged ones) and per-book localSeq counters | S4: per-book event counts + counter equality. Counters moving verbatim is what prevents event-ID reissue |
| `caches.content` | floor/tip/cursor (12) + 7 entities + tombstones | S4: floor/tip/cursor + entity count equality; post-rollout: drain to 18 is the live proof |
| `caches.bindings` | tip/cursor 1799 + 1,799 entities | S4 counts; Diagnostics row must still read 1799/1799 COMPLETE after migration |
| `caches.position` (if present) | Position-family cache state | Same treatment; counts compared generically per family so no family is special-cased |
| `bytes{}` | Byte confirmations keyed by (cacheKey, bindingRevision) | S4: entry-count equality |
| `money{}` | Quota/money view snapshot | Verbatim in the string copy; counted as part of record equality |
| `drainStatus{}` | Per-family durable drain outcomes (incl. the G7 `network_error` record) | Verbatim; after the first successful post-migration drain it is legitimately overwritten by the new outcome |
| `cs:shelf-bridge:v1` (localStorage, **outside** the record) | Shelf outbox — **7 pending items** on the iPhone (resident Oct-22 item + 6 session records), 409-blocked, under Julie's "leave it" disposition | §6 hash guard + count check (7) at S6 and at the device gate |
| `opalreader.v2.deviceId` (localStorage shell slot) | Identity slot | Untouched by migration; agreement enforced as today |
| `opalreader.v2.uiPrefs` (localStorage) | Presentation prefs | §6 hash guard |

## 9. Rowan point 7 — Test matrix (build-gate requirements)

No build is complete without all rows passing on the exact final tree, with one
complete run's full log + exit code captured (standing rule). Fixtures are synthetic;
sizes use the §2.3 production figures.

| # | Test | Proves |
|---|---|---|
| T1 | Router unit battery: dispatch by key (state→IDB, shelf→legacy, unknown→legacy), guard contract honored on both backends, `supportsCommitGuard` refusal still fires for foreign adapters | §5.2 mechanics; F7 preserved |
| T2 | Classifier battery: table-driven errors (QuotaExceededError/22, NS_ERROR_DOM_QUOTA_REACHED, SecurityError, cyclic TypeError, RangeError, IDB UnknownError/VersionError, fetch TypeError) at each stage → exact §3.2 classes; assert no field outside the §3.3 allowlist is emitted | Point 1 |
| T3 | Migration harness: fake-IDB + Map legacy; seed a watermark-12 record; run the machine; assert S0→S6, digest equality, field-level counts (§8), marker written last, legacy bytes unchanged, Shelf/prefs hashes unchanged | Points 2, 5, 6 |
| T4 | **Crash-at-every-boundary matrix**: kill/restart between each pair of states (S0→S1, …, S5→S6) and *during* S3's transaction; assert convergence to the same end state, no double migration, no record loss, no replayed commands | Point 3 |
| T5 | Legacy-writer tripwire: after cutover, mutate the legacy string externally; next boot → `legacy_writer_detected` stop; IDB state untouched | Point 3 |
| T6 | IDB failure battery: open blocked/failing pre-cutover → stays legacy + classified; IDB removed post-cutover → fail-closed stop, **no** legacy resurrection; IDB quota throw on set → abort, prior record intact, classified | Points 1, 4 |
| T7 | **Full-size Chromium proof** (extends §4): serve the candidate tree + stub coordinator; seed localStorage with the §4.1 fixture (1.87M chars, cursor 12, page seq 13–18 at measured sizes); Connect → migration runs → drain completes **12 → 18** → record in IDB is 8.28M chars → library renders all 7 books → restart → state intact, cursor 18 → legacy string byte-identical → Shelf record hash unchanged, outbox count preserved | Points 2, 6, 7 (the headline proof) |
| T8 | Real-quota legacy proof: same as T7 but with migration *disabled* in a test build flag → the classified drain reason is `storage_quota_exceeded` (not `network_error`) against Chromium's real localStorage | Point 1 on-device-class evidence in a real engine |
| T9 | Rollback proofs: pre-cutover abandonment restores bit-identical legacy state (R1); post-cutover old-build load is *detected* (tripwire fires in T5 conditions); export-back refuses honestly when the record exceeds legacy quota (R2) | Points 4, 8 |
| T10 | Byte-stability/frozen-surface battery (standing package discipline): Shelf bridge file byte-identical to accepted; worker untouched; all non-delta files byte-identical to ui-pkg-3 pins | Point 5; package hygiene |
| T11 | Eviction simulation: delete the IDB database in steady state → boot stop-and-report with the §5.3 recovery posture; caches re-sync from stub coordinator after Julie-path reset; Shelf outbox (legacy) unaffected | §5.3 durability honesty |
| T12 | Phone-width + accessibility regressions carried from the UI3 batteries (the shell changes in §5.6 must not regress rendering) | Package hygiene |

## 10. Rowan point 8 — Rollout sequencing, compatibility, and gates

**Compatibility statement.** The worker is unchanged — no server code, route, or data
is touched by this design at any point. The sync protocol is unchanged. v1 and its
rollback line (including v1's own IndexedDB) are untouched. The new package follows
the established packaging discipline: new bundle/style names, new service-worker
cache name (`opalreader-shell-ui4` pattern), prior caches preserved, index advanced
only at publication. Old and new builds read the same record *format*; they differ
only in where the record lives, which is exactly why §5.4's lock + tripwire and §7/R2's
no-silent-rollback rule exist.

**Sequence (each arrow is a gate, not a formality):**

1. **This design** → Rowan source-level design review. (Rowan's G7 review was
   conditional partly because she could not fetch the live source; §2's file/line
   citations and header hashes are provided so this review can be source-level, and
   the review branch should pin this document beside the cited files.)
2. **Julie build approval** — explicitly including acceptance of the R2 rollback
   asymmetry (§7) and the §12 unknowns.
3. **Build (repo-only)** → full §9 matrix on the final tree → **Rowan source review**
   of the delta (expected delta surface: `storage-adapter.js` successor module,
   `runnable` wiring + migration module, shell snapshot reads in `app`, classifier;
   the store delta limited to §3.2's stage split; **zero** delta to the Shelf bridge,
   constants' key values, device-identity, ownership).
4. **Julie publication approval** → publish ui-pkg-4 → **attended iPhone session**:
   close all other Reader copies → open → Connect (migration runs under lock;
   Diagnostics: State storage = IndexedDB, Shelf pending still 7, bindings
   1799/1799) → content drain **12 → 18 COMPLETE** → library renders all seven books →
   playback sample incl. Continue Listening position preserved (FP Ch 1 Seg 3, 5.1s)
   → force-close + reopen → state persists, no re-migration.
5. **Attended iPad session**: same protocol on the iPad's own record/cursor.
6. **Only then** does the D6 sequence resume: sub-step 0 re-run is already green
   server-side; arming requires its own fresh Julie approval; the smoke follows.
   The legacy-snapshot **retirement** (S6) is a separate, later Julie authorization,
   not part of steps 4–5.

**Stop conditions (any step):** any §9 row red; any guard/hash mismatch; any
classification surprise on device; any state Rowan has not passed. A stopped rollout
before iPhone cutover leaves production exactly as it is today (legacy, capped,
functional); a stop after iPhone cutover uses §7/R2 paths — forward-fix first.

## 11. Non-goals and forbidden moves

Per Rowan's G7 warnings and the standing feature law, this design does **not**:

- split, shrink, clear, or re-key the caches (including "just store text separately"
  or dropping `speechText` from the device copy — that would silently change Find
  Text and the generation voice-gate inputs);
- discard or reset listening positions, journals, outboxes, or the Shelf queue to
  force a sync;
- bypass or weaken atomic page application, the single-writer lock, or the ownership
  epoch guard;
- modify the Shelf bridge, its record, its key, or its delivery behavior in any way;
- change the worker, the sync protocol, any production data, or any book content;
- authorize arming, generation, the storage seed, or any spending — those remain
  separately gated behind G7 device acceptance.

## 12. Unknowns and assumptions (stated, not smoothed over)

1. **WKWebView's exact localStorage quota** on Julie's iOS 27 devices: unmeasured.
   The design does not depend on it (§4.1 threshold-independence + §4.2's real-engine
   anchor), and §3.4 turns the first device Connect into the conclusive measurement.
2. **WKWebView IndexedDB persistence/eviction**: treated as best-effort platform
   behavior with the §5.3 mitigations; if Apple evicts the database under storage
   pressure, §5.5/T11's stop-and-resync posture is the designed outcome — acceptable
   because caches are server-backed, but it is a real residual risk Julie should
   approve knowingly.
3. **`navigator.storage.estimate()/persist()` support in WKWebView** varies; both are
   used only as best-effort diagnostics, never as control flow.
4. **JSON string round-trip stability**: byte equality is asserted over the *stored
   string* end-to-end (§5.3), so the design never relies on re-serialization being
   canonical — except S2's parse validation, which relies only on `JSON.parse`
   accepting what `JSON.stringify` produced, as it does today on every write.
5. **IndexedDB availability in the app's WKWebView home-screen context** is assumed
   present (the v1 app in the same context uses its own IndexedDB database in
   production on these devices — §2.4 — which is direct evidence the API works in
   this exact installed-app context). S1 still handles absence by staying on legacy.
6. Device free space on the iPhone/iPad is unknown; §5.3's classified quota stop is
   the designed outcome if IDB itself cannot be written.

## Appendix A — Reproduction artifacts

Directory: `~/workspace/d6-build/g7-design-evidence/`

| File | Contents |
|---|---|
| `storage-adapter.mjs` | Byte-identical copy of shipped `modules/storage-adapter.js` (SHA-256 `d41ae89c…` verified both sides) |
| `client-store-ui1.mjs` | Byte-identical copy of shipped `modules/vendor/client-store-ui1.js` (SHA-256 `778d4c33…` verified both sides) |
| `repro-quota.mjs` / `repro-quota-output.txt` | §4.1 mechanism reproduction + captured output |
| `quota-probe.html` / `quota-probe-cdp.mjs` / `quota-probe-output.txt` | §4.2 real-Chromium quota probe (CDP-driven; launches `/opt/meta-chromium/chrome` headless with the environment's WebGL policy flags, loopback origin) |

Commands run (Oct 29, 2026, this VM):

```
node repro-quota.mjs            # Node v24.22.1 -> repro-quota-output.txt (§4.1)
node quota-probe-cdp.mjs        # HeadlessChrome 155 -> quota-probe-output.txt (§4.2)
```

## Appendix B — Source citation index (for Rowan's source-level review)

- Keys & build identity: `modules/constants-ui3.js:11, 18-20`
- Store shape, load/mutate, atomicity contract: `modules/vendor/client-store-ui1.js:22-28, 41, 45-53, 59-81`
- Page validation & atomic apply: `client-store-ui1.js:241-278`
- Drain + catch-all `network_error`: `client-store-ui1.js:290-316` (catch `:303`)
- Browser storage adapter (string serialization, guard): `modules/storage-adapter.js:65-99`; gated wrapper refusal: `:118-145`
- Production wiring to localStorage: `modules/runnable-ui3.js:41-47`; `app-266.js:602-604`
- Composition `STATE_KEY` interception: `modules/composition-ui3.js:497`
- Shell direct localStorage reads: `app-266.js:210-211, 224, 230, 276-277, 282-307, 666-676`; SW registration: `:173-174`
- Device identity (both keys, stop-and-report): `modules/device-identity.js:20-60`
- Shelf bridge key/cap/plumbing: `modules/vendor/client/shelf-bridge.js:28-29, 81-106`
- Ownership (Web Lock, epoch, draining release): `modules/ownership.js` (whole file)
- Transport parse-error swallow: `modules/vendor/client/http-transport.js:~28-37`; pullChanges shape: `:45-52`

*End of design. Implementation remains HELD pending Rowan's review and Julie's
separate build approval.*
