# P8 preview source-review corrections — P1/P2 addendum (2026-10-22)

Status: implemented in the preview layer only, for Rowan's source
re-review of the preview proposal (issue #15). Rowan's findings:
comment 6351482794; Wren's acceptance: comment 6351526572. Nothing in
this addendum publishes the preview, contacts Cloudflare, or redeploys
any Worker. Publication still requires Rowan's re-review and Julie's
separate explicit approval.

## P1 — fail-closed staging health/origin gate

Finding: the preview page exposed an arbitrary editable worker URL;
`connect()` created the token-bearing transport/client first, fetched
`/health` only to display unverified JSON, swallowed errors, and still
called `renderQuota()`, which would send the staging token to whatever
host had been typed.

Fix (`v2-preview/index.html`, `v2-preview/preview-app.js` only):

- The editable `#workerBase` field is removed. There is no
  user-entered worker URL anywhere in the preview UI.
- The staging origin is hard-pinned in `preview-app.js`:
  `STAGING_WORKER_ORIGIN = "https://opalreader-api-v2.4d8v7jw78c.workers.dev"`.
  It is the only API base used to construct the HTTP transport.
- `connectPreviewClient()` performs, in order: (1) the preview-local
  device-identity preflight (P2, below) — before any network use;
  (2) an unauthenticated `GET /health` with no token header; (3) an
  exact seven-field identity check — `ok: true`,
  `app: "OpalReader API v2"`, `version: "2.0.0"`,
  `build: EXPECTED_STAGING_BUILD`, `scope: "staging-smoke"`,
  `generation: "halted"`, `coordinator: "armed"` — with no extra or
  missing fields tolerated. Only after an exact match is the
  token-bearing transport or assembled client constructed.
- `EXPECTED_STAGING_BUILD` is
  `a2b0031fcba6d3cdaadb949d900a4a642da05807`, the build actually
  deployed on the staging Worker by Part 2. This correction does not
  redeploy the Worker, so the gate intentionally names the deployed
  build rather than this preview source pin. A test binds the literal
  to the expected-health object used by the gate.
- Wrong origin is impossible by construction (no caller-selected base
  exists; a test passes a poisoned `baseUrl` and proves it is ignored).
  Failed fetch, non-200, malformed JSON, or any identity-field
  mismatch stops the connection before transport construction, with
  zero authenticated requests.
- After a successful connection the password input is cleared, so the
  token is not left in the DOM. It is never logged and never
  persisted; it lives only in the transport closure, as before.

## P2 — distinct, stable per-device identities

Finding: `index.html` defaulted `#deviceId` to the literal
`"preview-device"` on both devices, while client-store derives command
IDs as `${deviceId}-cmd-N` and position `eventId` as
`${deviceId}:${localSeq}` — shared IDs could collide or replay and
falsify acceptance A7/A8.

Fix (`v2-preview/index.html`, `v2-preview/preview-app.js` only):

- The editable device-ID input and the shared literal default are
  removed. The page shows its device ID in a read-only `<strong
  id="deviceId">` in the connection header, expressly labelled
  non-secret, so the acceptance session log can cite both devices'
  IDs, revisions, and tips for A7/A8.
- `ensurePreviewDeviceId()` generates a fresh random ID
  (`preview-<uuid>`) once per browser/device and retains it in
  preview-local storage under the namespaced key
  `opalreader-v2-preview:device-id`. Later runs reuse it. The token is
  never stored; the ID is not a secret.
- No manual ID field remains, so uniqueness cannot be typo'd away.
  `assertPreviewDeviceIdentity()` additionally compares the identity
  against any existing assembled-client state (`cs:state:v1`) before
  any network use; a mismatch throws `device_id_mismatch`, is surfaced
  in the page, and is never silently mutated.

## Tests

- `tests/p8-preview-p1-p2.test.mjs` — static source assertions (no
  `workerBase`, pinned origin present, no shared default/input);
  instrumented-fetch health gating: correct identity opens the gate
  and the authenticated quota call proceeds on the pinned origin;
  poisoned origin ignored; eight bad-health variants (wrong build,
  wrong scope, generation active, coordinator unbound, wrong app,
  malformed JSON, HTTP failure, fetch failure) each refused with
  exactly one unauthenticated probe, zero transport/client
  constructions, and zero authenticated requests; identity
  generate-once/reuse/distinctness; mismatch refused before any
  network; and a two-client regression over one shared recording
  transport proving disjoint command IDs (`<deviceId>-cmd-1`) and
  position event IDs (`<deviceId>:1`), with no ID accepted twice.
- `tests/p8-preview-ui.test.mjs` — fake-DOM run of the real bootstrap
  and `connect()`: failed health leaves the password value in place
  and makes zero authenticated requests; successful gated connect
  clears the password input, displays the generated device ID, and
  matches it to preview-local storage.

All tokens in tests are obvious fakes. No test contacts the live
worker.

## Repin

- New preview digest:
  `1a1208ee528b720e6796a55ce9f3ac4b980924cf1a39321ae54b5a6908e90232`
  (was `d2f4e5b5402d6c8b910af1b2440f078fc40496e2814688c422a547f430242597`).
- Revised six-file publish list (same six operations; only the two
  changed preview files have new blob hashes):
  1. add `…/opal-reader/v2-preview/index.html` — new blob
     `6cb6ff1cabbe41608356b318484e35cbb4a3e1a5` (was `5f3d4cdda7…`).
  2. add `…/opal-reader/v2-preview/preview-app.js` — new blob
     `b4fe36d9e209b42f64a92636f1a80ecf89d70282` (was `305160e0aa…`).
  3. add `…/opal-reader/v2-preview/preview.css` — unchanged,
     `6c924fa7dd6a9c86852414b2837ab2e5b56c1ce7`.
  4. add `…/opal-reader/v2-preview/fake-shelf-transport.js` —
     unchanged, `119f84f412fdced56a01d5b0f82fabb7f611f872`.
  5. add `…/opal-reader/v2/client/http-transport.mjs` — unchanged,
     `1e45823458facf782a469d2bd48e60c03b3c2573`.
  6. update `…/opal-reader/v2/client/assembled-client.mjs` —
     unchanged, `c24e889a69c93a8b3f773e6f60aa74cd9cd245bf`
     (main's stale copy: `cb2373ce7463e3e1c39724f95d4aa204e11ddfac`).
- No Worker-closure source file changed: `v2/worker-entry.js`, the
  coordinator, the executor, and every module in the Worker closure
  are byte-identical to the base pin. The deployed staging Worker is
  untouched and still runs build `a2b0031f…`. (The deterministic
  builder stamps the source commit into `build-identity.mjs`, so a
  clean build of any new source pin necessarily reports a new worker
  digest through that stamp line alone; no Worker code changes and
  nothing is redeployed. The exact clean-build values for the
  re-review pin are reported with the verification evidence on
  issue #15.)
- Root served files (`index.html`, `app-256.js`,
  `cloudflare-worker.js`) remain byte-identical to `main`.
