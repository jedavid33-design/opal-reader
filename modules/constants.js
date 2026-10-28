// D5-B candidate constants (candidate-owned; design sections 4.1/7.1).
// Compiled production shape. This candidate is local/review-branch only
// and is never published by this build step.
export const CANDIDATE_BUILD_MARKER = "d5b-v2-playback-client-11";
export const CANDIDATE_BUNDLE_NAME = "app-257.js"; // named only; not added to main, index.html untouched
export const CANDIDATE_STYLES_NAME = "styles-150.css"; // named only in the manifest
export const CANDIDATE_CACHE_NAME = "opalreader-shell-d5b-3";
export const PRODUCTION_BASE_URL = "https://opalreader-api-v2-prod.4d8v7jw78c.workers.dev";
export const PRODUCTION_BASE_HOST = "opalreader-api-v2-prod.4d8v7jw78c.workers.dev";
export const V2_SCOPE = "production";
export const V2_INSTANCE = "account";
export const SHELL_DEVICE_ID_KEY = "opalreader.v2.deviceId";
export const STATE_KEY = "cs:state:v1";
export const SHELF_KEY = "cs:shelf-bridge:v1";
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
