// GEN-PKG-1 candidate entry: the ui-pkg-4 entry with its
// composition/runnable/constants pointers advanced to the
// genpkg1 successors, PLUS the generation-surface exports
// (createGenerationClient + the plain-language renderers) the
// shell's live generation surface consumes. Local/review only
// until separately authorized publication.
export { createCandidate } from "./composition-genpkg1.js";
export { createRunnableClient } from "./runnable-genpkg1.js";
export { createAudioTransport } from "./audio-transport.js";
export { createBrowserStorage, createStorageLike } from "./storage-adapter.js";
export { createIndexedDbStorage, createStateRoutingStorage, runStorageMigration, classifyStorageError } from "./storage-state.js";
export { CANDIDATE_BUILD_MARKER } from "./constants-genpkg1.js";
export * as screens from "./screens.js";
export { createGenerationClient, laneOptions, exclusionLines, formatMicroCents,
  phaseForBook, findActivePlan, planStatusText, stopReasonText, isTerminalPlanState,
  rejectionText, planSemanticsText, planMoneyText }
  from "./generation-surface.js";
