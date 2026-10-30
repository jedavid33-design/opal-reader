// GEN-PKG-1 candidate constants. Byte-identical to the UI4
// candidate constants except the build/bundle/cache identities
// below: the gen-pkg-1 candidate is separately named and
// versioned so no live path of the accepted ui-pkg-4 release is
// overwritten. The build marker ADVANCES to
// d5b-v2-generation-client-2: gen-pkg-1 changes behaviour (the
// generation surface goes live). The -2 distinguishes this build
// from the WS-4 d5b-v2-generation-client-1 candidate, which was
// built on the superseded ui-pkg-3 base and never published.
// (d5b-v2-generation-client-1's app-267.js is a DIFFERENT file
// from ui-pkg-4's app-267.js; this build's entry is app-268.js.)
// D5-B candidate constants (candidate-owned; design sections 4.1/7.1).
// Compiled production shape. This candidate is local/review-branch only
// and is never published by this build step.
export const CANDIDATE_BUILD_MARKER = "d5b-v2-generation-client-2";
export const CANDIDATE_BUNDLE_NAME = "app-268.js"; // named only; not added to main, index.html untouched
export const CANDIDATE_STYLES_NAME = "styles-155.css"; // named only in the manifest
export const CANDIDATE_CACHE_NAME = "opalreader-shell-genpkg1";
export const PRODUCTION_BASE_URL = "https://opalreader-api-v2-prod.4d8v7jw78c.workers.dev";
export const PRODUCTION_BASE_HOST = "opalreader-api-v2-prod.4d8v7jw78c.workers.dev";
export const V2_SCOPE = "production";
export const V2_INSTANCE = "account";
export const SHELL_DEVICE_ID_KEY = "opalreader.v2.deviceId";
export const STATE_KEY = "cs:state:v1";
export const SHELF_KEY = "cs:shelf-bridge:v1";
// UI4 (G7): storage-backend constants for the state record's move
// to IndexedDB (design 5.3/5.4). STATE_KEY and SHELF_KEY above are
// UNCHANGED — the migration keys off their exact values, and the
// Shelf key is never routed anywhere new.
export const STATE_BACKEND_MARKER_KEY = "cs:state:backend";
export const STATE_META_KEY = "cs:state:meta";
export const STATE_DB_NAME = "opalreader-v2-state";
export const STATE_DB_VERSION = 1;
export const STATE_DB_STORE = "records";
export const UI_PREFS_KEY = "opalreader.v2.uiPrefs";
export const CHECKPOINT_INTERVAL_MS = 30000;
// Bounded shutdown settlement (follow-up 5, Rowan 6390233573): ONE
// deadline bounds a close-time player settlement end to end — the
// local journal commit, the pending-sync readout, and the OPTIONAL
// dispatch attempt. The tracked settlement operation resolves by
// this deadline even when the underlying work dangles (fenced), so
// closeShelfLifecycle() and the ownership release path stay bounded
// inside the drain loop's existing ~2s envelope. A locally committed
// pause is durable WITHOUT cloud acknowledgment; an unfinished
// dispatch leaves the event pending under its stable eventId for
// next-launch retry, reported via the settlement's pending-sync
// readout — never as acknowledged.
export const SETTLE_DEADLINE_MS = 1500;
// Budget for the post-deadline accounting read of the persisted
// journal (used only when the settlement body outlived its deadline:
// durability is then read from persisted per-event state, never
// fabricated; if even that read cannot complete in budget, the
// settlement records its accounting as unavailable).
export const SETTLE_READOUT_BUDGET_MS = 250;
// Honest durability wording (design 3.3, safeguard 3): durability is
// conditional on timer execution and on successful storage commits.
// No elapsed-time loss assurance is made anywhere in this candidate.
export const DURABILITY_STATEMENT =
  "A position is durable only after its storage commit resolves. " +
  "Durability is conditional on timer execution and successful storage commits.";
