# Opal Reader v2 — P8 migration-specific import path: design

*Responds to Rowan's D10 scope ruling + import-path STOPs (board
6354217340) and Wren's ack (6354236546). Authorized by Julie
(Oct 22, ~20:19 ET, "Build it"): repo-only design + implementation
+ synthetic rehearsal. No uploads, no live contact, no real data.*

*Base pin: `5f9748cfcd66d5eb9857d6a49dbe4ac5bd48692b`
(`v2/p8-integration`). All line references below are to that tree.*

## 0. What Rowan ruled, and what this design does about it

D10-independence is valid **in principle** for importing
pre-existing, durable, byte-verified audio — but the import
protocol the binding audit described (§5.2 of
`opal-reader-v2-p8-binding-audit-report.md`) is **not cleared as
implemented**, for four source-level reasons (I1–I4). This design
does not patch the described protocol; it **replaces the split
path for migration** with a dedicated, migration-specific
verified bind primitive — one of the two shapes Rowan's ruling
explicitly offers for I1 ("replace the split path with a
migration-specific verified bind primitive"). The general paths
(`SyncPush`, `AdoptAudio`) keep today's behavior and defaults,
byte for byte, for every non-migration caller.

Two new durable command types, both fenced to migration use:

- `MigrateImportBindings` — one command per book: prime →
  byte-verify → bind **both planes** inside the command's single
  DO transaction, or apply nothing at all.
- `MigrateRecordFlipGate` — the external per-book flip gate as a
  durable record that the coordinator itself refuses to write
  unless its own state proves both-plane completeness.

One new read surface:

- `migrationBookView(bookId)` on the coordinator, exposed
  read-only as `GET /v2/migration/book/<bookId>` through the
  existing SELECT-only facade (`v2/api.mjs:12`) — the read-back
  instrument for the flip fence.

## 1. I1 — one source of truth, both planes, one transaction

**The defect, at source.** `SyncPush` accepts binding entities by
revision/identity validation plus upsert only:
`_validateSyncChange`'s bindings branch (`v2/coordinator.mjs:1904`,
bindings at 1926–1936) checks book/occurrence ownership and CAS,
and `_applyValidatedSyncChange` then simply `_upsertSyncEntity`
(`v2/coordinator.mjs:1878`). It never calls `validateAndBind`,
`probe.exists`, `probe.hash`, or any digest check. The
byte-verifying path is a **different command**: `AdoptAudio`
(`v2/coordinator.mjs:385–388`) → `validateAndBind`
(`v2/coordinator.mjs:974`), writing the SQL `bindings` /
`cache_index` tables. The client reads the **sync** family
(`v2/client-store.mjs:326`, `:369` — `caches.bindings.entities`),
not the SQL tables. So a binding could be client-visible via
SyncPush while the coordinator's own index refuses it — the
two-plane divergence, acute for the 31 identity-refused rows.

**The design.** `MigrateImportBindings` is the single import
primitive. Within the one transaction `handleCommand` already
opens per command (`v2/coordinator.mjs:339`, apply at `:352–366`),
it validates **every** row of the book against primed byte facts
(§2–§3) and current DB state; if **any** row is blocked, the
command records a `rejected` outcome with the per-row certificate
and **applies nothing** — no content entity, no sync entities, no
SQL rows, no audit rows (the durable `commands` record is the
refusal's audit surface; unlike `AdoptAudio`, the migration path
writes no `binding_conflicts` residue, so a corrected retry
starts from a provably clean slate). If every row verifies, it
applies, in the same transaction:

1. the book's content entity (if carried and not already present
   identically — divergence is a validation failure, §4);
2. per row, the SQL plane: a `bindings` insert (or idempotent
   recognition) plus the `cache_index` anchor, written by a
   migration-internal bind that mirrors `validateAndBind`'s
   checks but reads primed facts instead of the snapshot probe;
3. per row, the sync plane: the `bindings` entity
   `<bookId>:<occurrenceId>` with payload
   `{ cacheKey, revisionKey, sha256, format, size, provenance }`,
   where `sha256` is the import-time computed digest (§3). An
   already-identical entity is recognized, not rewritten (no
   revision churn on idempotent re-import).

**Source of truth, stated explicitly.** For an imported binding,
the authoritative record is the SQL plane (`bindings` +
`cache_index` anchor), exactly as for `AdoptAudio`; the sync
entity is the client-visible projection of the same verified
fact, written in the same transaction from the same primed
bytes. The two planes therefore cannot diverge *at import*: they
commit or roll back together. Any *later* divergence (tampering,
a bug, a partial future write) is detectable through
`migrationBookView`'s set-equality computation and blocks the
flip gate (§4). Reconciliation rule: a book may be recorded
flipped only when the book's **imported manifest row set** — the
reference set the import command itself records durably in
`migration_books` (canonically digested, so a re-import under a
different row set is a divergence, never an overwrite) — is
exactly the set present in both planes, with per-occurrence
`cacheKey` equality and digest-anchor equality
(sync payload `sha256` = `cache_index.sha256` = freeze manifest
expectation = import-time computed digest). The reference set
is the manifest rows, not the book's full occurrence list: a
book legitimately has occurrences with no audio yet (Forever
Pucked: 407 segments, 50 bindings), and completeness is a
statement about the bindings being flipped, not about the book
being finished.

Non-migration commands are untouched: `SyncPush` still does not
verify bytes (it is the client-sync path; client byte
confirmation remains the client store's `byteCheck` flow), and
`AdoptAudio` still verifies through the request snapshot. This
design claims the exception only for the migration primitive,
which is the scope Rowan's ruling contemplates.

## 2. I2 — cold visibility: priming inside the import operation

**The defect, at source.** The host cache's probe reads a
request-local snapshot (`v2/host/adapters.mjs:587–594`), and the
worker's `_cache()` (`v2/worker-entry.js:117–139`) populates that
snapshot only via `hydrateIndex`, which loads **only keys
already in `cache_index`** (`v2/host/adapters.mjs:476–482`). On
a fresh production coordinator every pre-existing v1 object is
invisible: `validateAndBind` returns `object_missing` for audio
that exists. A `byteCheck` (`adapters.mjs:596`) hydrates one key
for its own request only.

**The design.** A new host seam, `primeForMigration(cacheKey)`,
on the R2 audio cache (`createR2AudioCache`,
`v2/host/adapters.mjs:445`), wired into the coordinator's
environment by `hostEnv` (`v2/worker-entry.js:96`) as
`env.migrationPrime`. It performs a direct bucket `get` of the
exact candidate object keys for the cache key — inside the same
import operation, before any bind — and returns the verified
fact record (§3). It never consults or mutates the snapshot (the
general probe path is byte-identical to before), and it never
writes: `get` only, no `head`, no `put`, anywhere on this path.

`handleCommand` runs the prime **asynchronously before** opening
the command transaction, only for `MigrateImportBindings`, only
after the receipt-replay check (a replayed command re-primes
nothing and re-applies nothing). The prepared facts are passed
into the synchronous apply step as data; the transaction itself
stays synchronous, matching the coordinator's storage contract.
If `env.migrationPrime` is absent, every row blocks with
`migration_prime_unavailable` — the path fails closed rather
than falling back to the snapshot. Under the staging worker the
prime inherits the existing key-prefix fence
(`v2/worker-entry.js:117–139`): a staging cache is constructed
with `smoke-p8/`, so a migration prime there can only ever see
smoke objects and real-book imports fail `object_missing` —
consistent with Rowan's note that the staging script cannot
validate real v1 audio. The production-scope worker remains a
separate routing/deploy authorization; nothing here exercises
it.

## 3. I3 — byte-true verification, three-way, fail closed

**The defect, at source.** `hydrateKey` sets the snapshot's
`sha256` **and** `recordedSha256` to
`meta.sha256 ?? sha256Hex(bytes)` (`v2/host/adapters.mjs:463–465`).
When an object carries a `sha256` custom-metadata field,
`probe.hash` can return the **advertised metadata**, so
`validateAndBind`'s digest comparison
(`v2/coordinator.mjs:1002–1013`) can degenerate into
metadata-vs-metadata. (For v1 objects this happens not to bite —
v1 wrote no `sha256` metadata — but the migration path may not
rest on that accident.)

**The design.** `primeForMigration` **always** computes
`computedSha256 = sha256Hex(bytes)` from the bytes it just
downloaded. The metadata value is retained as a **separate**
field, `metadataSha256` (`customMetadata.sha256 ?? null`),
alongside `metadataIdentity`, the object key actually hit, the
format (from the object key's extension — the same format
evidence `hydrateKey` uses), the byte length, and the object's
etag. Per row, inside the transaction, verification is
three-way and fail-closed, in this order (first failure names
the row's reason; any failure blocks the **whole book**):

1. no primed fact → `object_missing`;
2. the object key actually read ≠ the expected key for
   `(cacheKey, manifest.format)` under the host's key shape, or
   primed format ≠ manifest format → `object_key_mismatch` /
   `format_mismatch`;
3. primed byte length ≠ manifest size → `size_mismatch`;
4. **computed ≠ freeze-manifest expected SHA-256** →
   `content_hash_mismatch`. This is the swapped-bytes case: the
   bytes changed under a stale label, and neither the metadata
   nor the manifest can talk the computed digest out of it;
5. metadata SHA-256 present and ≠ computed →
   `metadata_digest_mismatch`. This is the tampered-metadata
   case: bytes are exactly as frozen, the label lies, and the
   import still refuses — a label that disagrees with its own
   bytes is not evidence this path will carry;
6. an existing `cache_index` anchor for the key whose SHA-256
   disagrees with computed → `content_hash_mismatch` (bytes
   swapped under a previously anchored key are a conflict,
   never a fresh success — the same rule `validateAndBind`
   enforces at `v2/coordinator.mjs:1006–1013`).

Only after all six does the identity rule (§5) run. Key,
length, format, and every authoritative digest are verified
before anything binds — Rowan's ordering, verbatim.

## 4. I4 — the per-book commit / visibility fence

**The limit, at source.** `handleCommand` persists receipt +
application in one transaction (`v2/coordinator.mjs:339–366`),
and a SyncPush book group validates-then-applies inside its
command — but content push, bindings push, 1,799 `AdoptAudio`
operations, position and jobs share **no** cross-plane
transaction. The audit's §5.2 sequence inherited that limit.

**The design.** The fence has three locks, and a book is
"flipped" only when all three hold:

- **Lock 1 — atomic import.** `MigrateImportBindings` collapses
  the audit's steps 1–3 for the bindings plane into **one
  command, one transaction** (content + both binding planes, §1).
  There is no interleaving in which a book is half-imported: any
  blocked row rejects the whole command and applies nothing.
  Position events and job aggregates keep riding their own
  receipted commands (`PushPositionEvents`, `SubmitJob`) — they
  are not bindings, D10 does not concern them, and the flip
  gate's read-back (lock 2) is where their presence is checked
  for the cutover runner's full per-book protocol; this build's
  gate command certifies the **bindings plane**, and says so.
- **Lock 2 — read-back set-equality.** After import, the runner
  reads the book through `migrationBookView` — served by the
  SELECT-only facade (`v2/api.mjs:12–27`), which holds no write
  capability in scope — and requires `complete: true` with an
  empty divergence list: the imported manifest row set (§1)
  present identically in the sync bindings set and the SQL
  bindings set, cacheKey equality per occurrence, digest anchors
  equal across planes and manifest. A divergence injected after
  import (a deleted row, a swapped key) shows up here, not at
  playback.
- **Lock 3 — the explicit gate record.** `MigrateRecordFlipGate`
  `{ migrationId, bookId, certificateSha256 }` writes the
  `migration_gates` row **only if the coordinator's own in-
  transaction check** re-proves both-plane completeness at gate
  time (same set-equality as lock 2, computed inside the
  transaction) — the runner's read-back is necessary but not
  sufficient; the record cannot be written over an incomplete
  or divergent book (`flip_gate_incomplete`, with the missing
  list). Re-gating a book under a **different** certificate is
  refused (`flip_gate_conflict`); the same certificate replays
  idempotently. Supersession, if ever needed, is a new reviewed
  decision, not a flag.

**Idempotency / receipt semantics.** Both commands ride the
existing durable receipt machinery: the same `command_id`
returns the stored outcome with `replayed: true` and applies
nothing twice. A **new** command id carrying an already-imported
book converges idempotently: identical rows are recognized
per-row (`accepted_idempotent`), identical content is not
rewritten, sync entities are not revision-bumped, and any
divergence from the already-imported fact is a validation
failure for the whole command. An interrupted import therefore
has exactly two possible durable states — not imported, or
imported — because each book's import is one transaction; a
crash **between** import and gate leaves an imported-but-
ungated book, which is not flipped and remains v1-visible in
every sense that matters: **nothing is client-visible until the
global client repoint**, which is a separately gated cutover
step that only runs for gate-recorded books.

## 5. The 31 — typed, migration-only provenance acceptance

**The fact, at source.** For a non-legacy revision,
`validateAndBind` requires the object's recorded identity to
equal the revision key (`v2/coordinator.mjs:1023–1031`), with
existing `cache_index` identity winning and the storage record
as fallback. `hydrateKey` defaults a v1 object's recorded
identity to its cache key (`v2/host/adapters.mjs:463`) because
v1's `storeAudio` metadata is `{provider, voiceId, format[,
generationMode]}` — no identity field exists to record. The 31
fingerprinted-distinct bindings (29 *Pucked Up*, 2 *Pucked
Over*, per the audit) have revision keys that are fingerprints
of a **later slicing** than the retained audio's cache key, so
the strict rule refuses them `identity_mismatch` — correctly,
for every path that lacks independent evidence.

**The design.** A row of `MigrateImportBindings` may carry a
`provenanceAttestation`, a typed object:

```
{ kind: "freeze_snapshot_attestation",
  snapshotDigest,            // must equal the command's freezeDigest
  bookId, occurrenceId, revisionKey, cacheKey,   // must equal the row's
  sha256, size, format,      // must equal manifest AND primed facts
  r2Key,                     // must equal the object key actually read
  r2Etag,                    // must equal the primed object's etag when one is supplied by the host
  identityLimitation: "v1_metadata_no_identity" }
```

The identity rule for the migration path is then:

- legacy revision (`legacy:<cacheKey>` form): the anchor rule,
  unchanged (`revisionKey === "legacy:" + cacheKey`, else
  `legacy_anchor_mismatch`);
- recorded identity (index identity ?? metadata identity ??
  the v1 default, the cache key) **equals** the revision key →
  strict acceptance, as today;
- recorded identity **disagrees**, and an attestation is
  present and **fully validates** against the row, the
  manifest, and the primed facts (every field above), and the
  disagreement is *exactly* the known v1 limitation — no
  identity in the index, no identity in the object's metadata,
  so the recorded identity is the cache-key default and nothing
  else → **provenance acceptance**: the binding is written with
  `provenance = "migration:freeze_snapshot_attestation"`, and a
  `migration_audit` row durably records the migration id, the
  row, the recorded identity at import, and the attestation's
  SHA-256 fingerprint, so the acceptance is per-row auditable
  forever;
- anything else — no attestation, an attestation field that
  disagrees with bytes/manifest/key (`attestation_invalid`), or
  a **positive** foreign identity in index or metadata (a real
  identity that is simply *wrong* — not the v1 absence the
  attestation speaks to) → `identity_mismatch`, blocked, whole
  book rejected.

Stated limit: group validation reads pre-command state (the
same semantics as SyncPush book groups). The real corpus' one
shared object is shared by two rows whose revision keys both
equal the shared cache key, so it imports strictly, first time
and on re-import. Two *distinct* revision keys over one shared
key would anchor the first row's identity in `cache_index` at
apply; a later re-import of the second row would then meet a
positive index identity and fail closed (`identity_mismatch`)
rather than re-open the provenance path — a named, visible
stop for a human decision, never a silent relaxation. That
shape does not occur in the audited corpus.

Fences: the acceptance exists **only** inside
`MigrateImportBindings` (a migration-identified command);
`AdoptAudio` and every other path keep strict refusal of the
same rows — no general suppression of `identity_mismatch`
anywhere. No audio is mutated or overwritten (the path performs
no R2 writes at all), no provider is called, and the
`cache_index` identity anchored at bind follows
`validateAndBind`'s existing precedent (the revision key),
with the pre-import recorded identity preserved in
`migration_audit` — the coordinator asserts the binding's
identity going forward; the audit row remembers why that was
permitted. If this proof cannot be made in rehearsal, the
fallback is Rowan's: *Pucked Up* and *Pucked Over* stay frozen
and listenable on v1.

## 6. The per-binding certificate

The runner assembles, per book, a certificate whose
input→digest→outcome rows keep the three evidence classes
distinct — never merged, never upgraded:

- **Class A — snapshot-era listing facts**: key, size, and etag
  as recorded in the freeze-time bucket listing.
- **Class B — freeze byte-pass raw verification**: the SHA-256
  the dress rehearsal computed from the object's bytes; carried
  into the import as the row's manifest expectation.
- **Class C — import-time per-object raw verification**: the
  SHA-256 recomputed **inside this import operation** from the
  bytes the prime downloaded, plus the separately retained
  metadata SHA-256 and the live etag observed at prime.

`MigrateImportBindings`' outcome carries, per row:
`{ occurrenceId, revisionKey, cacheKey, objectKey,
manifestSha256, computedSha256, metadataSha256, etag,
status: accepted | accepted_idempotent | accepted_provenance |
blocked, reason? }` — the class-C column verbatim from the
operation itself, joined by the runner with classes A and B
from the freeze manifest. A row whose class C is missing or
blocked reads as blocked in the certificate no matter how
strong its A/B evidence is: the certificate never lets
snapshot-era evidence impersonate import-time verification,
which is the distinction Rowan's ruling requires preserved.

## 7. Schema and surface changes (complete list)

- `v2/coordinator.mjs`: `COMMAND_TYPES` +=
  `MigrateImportBindings`, `MigrateRecordFlipGate`; three new
  tables (`migration_books`, `migration_audit`,
  `migration_gates`), created by the same idempotent DDL as
  every other table; the prime hook in `handleCommand`
  (post-replay, pre-transaction, migration type only);
  `_prepareMigrationImport`, `_migrateImportBindings`,
  `_migrationCompleteness`, `_migrateRecordFlipGate`,
  `migrationBookView`. No existing function changes behavior.
- `v2/host/adapters.mjs`: `primeForMigration` on the R2 audio
  cache (get-only; snapshot untouched).
- `v2/worker-entry.js`: `hostEnv` wires `migrationPrime` from
  the request cache.
- `v2/api.mjs`: `GET /v2/migration/book/<bookId>` on the
  read-only facade.
- `tests/helpers/do-harness.mjs`: `makeHarness` accepts extra
  env entries (e.g. `migrationPrime`) — additive, all existing
  callers unaffected.

## 8. What this design does NOT claim

- It does not fix, waive, or narrow D10 for the executor: every
  executor-produced binding and all generation remain gated on
  the flush-before-commit redesign.
- It does not exercise any live path: the rehearsal is synthetic
  (cold DO over a fake bucket), and the production-scope worker
  is a separate routing/deploy authorization.
- It does not schedule a flip. It asks Rowan to rule on whether
  the **implemented** path earns the D10-independent exception
  for scheduling per-book flips — the cutover list, routing,
  deploy, and queue decisions remain separately gated, and
  Forever Pucked's Chapter 3 remains `PARKED_POLICY`.
