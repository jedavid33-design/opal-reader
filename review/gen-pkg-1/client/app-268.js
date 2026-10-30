// Opal Reader v2 — UI1 pretty shell, GEN-PKG-1 candidate package (app-268.js).
//
// The UI1 candidate (Julie local-build authorization, Oct 28 2026;
// design: ui-design/DESIGN.md as approved by Julie in full; scoped
// proposal: ui-design/BUILD-PROPOSAL.md; Rowan's five design-review
// criteria, board comment 6483284931, and her proposal-review
// clarifications are the acceptance basis). Separately named and
// versioned: entry app-267.js, service worker sw-ui4.js, cache
// opalreader-shell-ui4, build marker d5b-v2-playback-client-15,
// packaging marker ui-pkg-4. No path of the accepted CORR1 release
// (app-263.js / sw-corr1.js / opalreader-shell-corr1) is overwritten;
// changed modules live at new *-ui1 paths and every unchanged module
// is reused at its accepted path, byte-identical — including the
// frozen Shelf bridge.
//
// Deltas from app-263.js, and ONLY these: (1) the visual design —
// the v1 design language (Quicksand, plum, opalescent washes, frosted
// cards, cover tiles, dark plum player) restored via styles-153.css (the ui-pkg-2 corrective
// stylesheet plus the UI3 W-5 section; ui-pkg-1 shipped
// styles-151.css, and styles-151/152 are retained for rollback);
// (2) three tabs (Library · Find text · Settings) with Diagnostics as
// a section inside Settings, its readouts keeping their CORR1 ids
// and exact meanings; (3) Library hero + progress cards with plain
// counts; (4) Book view: collapsible actions card (Saved position /
// Resume strip; Generate all, Cast, Shelf rows), collapsible
// chapters, "Segment N" rows with a YOU ARE HERE marker, and the
// truthful label rule — "No audio yet" only when the book's sync is
// COMPLETE, otherwise "Not checked yet" / "Still syncing"; (5) the
// per-book Cast view (display + flags + style lines; auditions and
// voice changes render the design's sheets but are unavailable);
// (6) generation affordances (Generate all, chapter Generate,
// per-segment +, the confirm sheet) rendered but INERT — generation
// is not armed in this build, the sheet states so, its Start control
// is disabled, and clicking submits nothing; (7) Find text results
// as chapter/segment cards with the match highlighted; (8) player
// prev/next segment controls and a humanized status line. Playback,
// sync (bounded drain), positions, Shelf flush capture, token
// discipline, and every candidate API call are the accepted shell's,
// unchanged. The CORR1 lineage record follows.
//
// Opal Reader v2 — CORR1 corrective shell (app-263.js).
//
// The corrective candidate (Julie implementation authorization,
// Oct 28 2026; Rowan amendments, board comment 6479219236). It is a
// SEPARATELY NAMED, separately versioned candidate: entry
// app-263.js, service worker sw-corr1.js, cache
// opalreader-shell-corr1, build marker d5b-v2-playback-client-12,
// packaging marker corr-pkg-1. No path of the accepted pkg-8
// release (app-259.js / sw-d5c3.js / opalreader-shell-d5c3) is
// overwritten; files this candidate changes live at new paths
// (the *-corr1 modules), and every unchanged module is reused at
// its accepted path, byte-identical — including the frozen Shelf
// bridge. Deltas from app-259.js, and ONLY these: chapter headings
// keyed by chapterId with truthful numbering; the Connect sync is
// the bounded drain, with PARTIAL/SYNC INCOMPLETE surfaced
// honestly; unreceived bindings are never labelled "not generated"
// while a sync is incomplete; the Shelf flush RESULT is captured
// (redacted) for Diagnostics; the stale GAP comment below is
// corrected. Everything else is the accepted shell, unchanged.
//
// The DOM shell for the D5-B candidate as corrected by F-1
// (build marker d5b-v2-playback-client-11, pin 336367bb; the F-1
// candidate awaits its own acceptance + P-8 re-acceptance gates).
// It renders the design 3.2
// screens by binding the candidate's own models (modules/screens.js)
// to live composition state, constructs the client ONLY through the
// candidate's createRunnableClient() with page-real dependencies
// (real localStorage, a real <audio> element, real fetch), and
// registers the corrective service worker (sw-corr1.js). It contains no
// generation, settings-edit, import, or delete surface, and it never
// reimplements candidate logic: every behaviour below is a candidate
// API call or a render of a candidate model.
//
// Why app-259 (rename history; earlier text here is SUPERSEDED):
// the packaged shell shipped as app-258.js through d5c-pkg-6,
// named when app-257.js was the Q2 readout build's path (branch
// q2/readout-v1, pin a7e594ea, UI 1.4.118) and 258 was the next
// free number. The Q2 line then moved: the adapter release
// (UI 1.4.119, Oct 25 2026, main 74947538) shipped a DIFFERENT
// app-258.js at the repo root, so app-258.js now names two
// different byte streams. At d5c-pkg-7 the shell is renamed to
// app-259.js (D5-C window packet draft v6 §4.4); app-257.js
// remains deliberately skipped — it names the unreleased readout
// intermediate. The released app-258.js is never a delta path for
// this artifact in either direction.
//
// Lineage: derived from the accepted pkg-8 shell (app-259.js)
// under the corrective case; see the banner above.
//
// Token discipline (design 4.4): the production access token exists
// only in this module's memory (and inside the constructed client).
// It is never written to any storage, never logged, and the password
// field is cleared from the DOM the moment Connect succeeds. A reload
// therefore returns to the Access screen by construction.
//
// Base URLs (API + Shelf): the compiled production URLs are the
// defaults. A host page may set window.__OPAL_V2_BASE_URL__ /
// window.__OPAL_V2_SHELF_BASE_URL__ before this module loads (the
// local proof harness does, to point at its local stacks), BUT an
// override is honored ONLY when it parses as a URL whose hostname is
// loopback (127.0.0.1, localhost, ::1). Any other override is
// rejected at module load — before any token exists or is
// transmitted — and the compiled production URL is used instead.
// The Access and Diagnostics screens always display the EFFECTIVE
// destination hosts; when a loopback override is active they say so
// explicitly ("TEST OVERRIDE (loopback only) — not the production
// service") and never present the override destination as
// production. Nothing in the published page sets an override, and
// the URLs are never editable fields in the UI. Scope and instance
// are the candidate's compiled constants and are not overridable.
// UI4 CANDIDATE (ui-pkg-4, Oct 29 2026): this entry is app-266.js
// with its packaging identity advanced (packaging marker ui-pkg-4,
// service worker sw-ui4.js / cache opalreader-shell-ui4, build
// marker d5b-v2-playback-client-15 via constants-ui4.js) PLUS the
// G7 storage deltas: the shell's state-record reads serve an
// in-memory snapshot taken from the ACTIVE storage backend
// (design 5.6 — localStorage before migration, IndexedDB after
// cutover) instead of reading localStorage directly; Diagnostics
// gains the State storage row (backend, migration state, last
// classified storage result, frozen-record guard); and Connect
// checks the frozen-record guard before the session's Shelf
// flush. Playback, sync, positions, the frozen Shelf bridge, and
// every other behaviour are the accepted UI3 shell's, unchanged.
//
// GEN-PKG-1 CANDIDATE (gen-pkg-1, Oct 29 2026): this entry is
// app-267.js (ui-pkg-4, accepted and live) with its packaging
// identity advanced (packaging marker gen-pkg-1, service worker
// sw-genpkg1.js / cache opalreader-shell-genpkg1, build marker
// d5b-v2-generation-client-2 via constants-genpkg1.js) PLUS the
// live generation surface (DESIGN BRIEF v2 §5; Rowan sign-off
// 6510767252): the confirm sheet reads the server's capabilities
// and eligibility quote before Start can be offered; submission
// is a POST /v2/commands SubmitJob the entry forwards to the
// generation service (command_id minted once per sheet; the
// server's intent identity absorbs double-taps and retries); an
// already-active plan reroutes the sheet to the Generation view
// instead of submitting; the book screen gains a Generation
// section and a read-only Generation view reads the plan list +
// capabilities (settled amounts from the server only; NO resume
// control anywhere; parked and voice-unmapped content offer no
// control). The client authors no bindings and stores nothing
// new — the generation session is a memory-only closure created
// at Connect, on the same token discipline as every transport
// here. Playback, sync, storage (ui-pkg-4), positions, and the
// frozen Shelf bridge are unchanged.

// UI3 CANDIDATE (ui-pkg-3, Oct 29 2026): this entry is app-265.js
// with its packaging identity advanced — packaging marker ui-pkg-3,
// service worker sw-ui3.js / cache opalreader-shell-ui3 — PLUS the
// ui3 module pointers below (entry-ui3 / constants-ui3, hence
// composition-ui3): UI3 wires byte-confirmation to successful
// playback starts (W-4, in composition-ui3.js; the store module is
// reused byte-identical) and appends the W-5 Settings quota-row
// stacking section to the stylesheet (styles-153.css). BEHAVIOUR
// changed this round, so the build marker ADVANCES to
// d5b-v2-playback-client-14 (via constants-ui3.js). ui-pkg-2 and
// ui-pkg-1 stay byte-intact in the tree as rollback bases.
//
// UI2 CORRECTIVE (ui-pkg-2, Oct 28 2026): this entry is app-264.js
// with ONLY its packaging identity advanced — packaging marker
// ui-pkg-2 and service worker sw-ui2.js / cache
// opalreader-shell-ui2 — so the styles-152.css corrective (window
// findings W-1/W-2: player bar clipped + not pinned at phone
// widths, chapter-header collision at phone widths) ships as a
// separately versioned package and ui-pkg-1 stays byte-intact as
// the rollback basis. The build marker stays
// d5b-v2-playback-client-13: no behaviour code changed, and every
// module is reused at its ui1 path, byte-identical.
import { createRunnableClient, createAudioTransport, createGenerationClient, laneOptions, exclusionLines, formatMicroCents, phaseForBook, findActivePlan, planStatusText, isTerminalPlanState, rejectionText, planSemanticsText, planMoneyText } from "./modules/entry-genpkg1.js";
import { readStateRecordFromBackend } from "./modules/storage-state.js";
import * as screens from "./modules/screens.js";
import {
  CANDIDATE_BUILD_MARKER, PRODUCTION_BASE_URL, PRODUCTION_BASE_HOST,
  V2_SCOPE, V2_INSTANCE, DURABILITY_STATEMENT, STATE_KEY, SHELF_KEY,
} from "./modules/constants-genpkg1.js";

const PACKAGING_MARKER = "gen-pkg-1";
// Table C designated probe binding (design 7.3; D5-C packet draft v2
// section 9.3): The Goal's carried segment. The full Table C
// preflight runs against exactly this binding before any write path
// opens; it is a read-only probe, never a playback default.
const DESIGNATED_PROBE = { cacheKey: "c10cb90e978621a98590e17b16e5bfb2090c9b78d8a3bfdeb55162bfa429067a", format: "mp3", sizeBytes: 10944 };
// v1's production Shelf endpoint (present in the shipped v1/Q2
// bundle, app-256.js/app-257.js; the "your-name.workers.dev" string
// elsewhere in that bundle is a placeholder, not this endpoint).
// Compiled into the shell as its own constant — NOT read from v1
// storage or settings, so no v1 residue configures the v2 bridge.
const PRODUCTION_SHELF_BASE_URL = "https://opal-shelf.4d8v7jw78c.workers.dev";
const PRODUCTION_SHELF_HOST = "opal-shelf.4d8v7jw78c.workers.dev";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
function resolveBaseUrl(override, compiledUrl, compiledHost) {
  if (override === undefined || override === null || override === "") {
    return { url: compiledUrl, host: compiledHost, overrideActive: false, rejected: false };
  }
  try {
    const u = new URL(String(override));
    if (LOOPBACK_HOSTS.has(u.hostname)) {
      const url = String(override).replace(/\/+$/, "");
      return { url, host: u.host, overrideActive: true, rejected: false };
    }
  } catch { /* unparseable overrides are rejected the same way */ }
  return { url: compiledUrl, host: compiledHost, overrideActive: false, rejected: true };
}
const API_BASE = resolveBaseUrl(typeof window !== "undefined" ? window.__OPAL_V2_BASE_URL__ : undefined, PRODUCTION_BASE_URL, PRODUCTION_BASE_HOST);
const SHELF_BASE = resolveBaseUrl(typeof window !== "undefined" ? window.__OPAL_V2_SHELF_BASE_URL__ : undefined, PRODUCTION_SHELF_BASE_URL, PRODUCTION_SHELF_HOST);
const BASE_URL = API_BASE.url;
const SHELF_API_BASE = SHELF_BASE.url;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw-genpkg1.js").catch(() => {});
}

const app = document.getElementById("app");
app.innerHTML = "";
const root = document.createElement("div");
root.id = "v2shell";
app.appendChild(root);

const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(c);
  return n;
};
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };

// ------------------------------------------------------------ shell state
let run = null;              // the runnable client handle (after Connect)
let tokenHeld = false;       // a client exists; the token itself lives only inside it
let currentScreen = "access";
let currentBookId = null;
let openedBooks = [];
let lastDiagnostics = null;
let lastSync = null;       // CORR1: this session's Connect drain results
let lastStorageGuard = null; // UI4 (G7): first-post-cutover-Connect frozen-record guard result
let lastShelfFlush = null; // CORR1: redacted summary of the last Shelf flush result
let successorOf = () => null; // legacy seam, unused: auto-next reads the player's live selection (see connectWith)

const media = document.createElement("audio");
media.preload = "auto";
media.id = "v2-audio";

// UI4 (G7, design 5.6): the state record's home depends on the
// storage backend (localStorage pre-migration, IndexedDB after
// cutover), so the shell no longer reads localStorage directly
// for it. readStateRecord() serves an in-memory snapshot taken
// from the ACTIVE backend; it is refreshed after the client is
// constructed, after Connect's drains complete, and whenever
// Diagnostics is built — the points where this shell's consumers
// need post-sync truth. (The Shelf record still lives in
// localStorage and is read directly, exactly as before.)
let stateSnapshot = null;
let stateSnapshotBackend = "localstorage";
function readStateRecord() { return stateSnapshot; }
async function refreshStateSnapshot() {
  if (run?.stateSnapshot) {
    try { const rec = await run.stateSnapshot(); if (rec) stateSnapshot = rec; } catch {}
    return stateSnapshot;
  }
  try {
    const r = await readStateRecordFromBackend({ storageLike: window.localStorage });
    if (r) { stateSnapshot = r.record; stateSnapshotBackend = r.backend; }
  } catch {}
  return stateSnapshot;
}
void refreshStateSnapshot();
// CORR1 helpers: sync truth is read from the persisted candidate
// state record (cursors, watermarks, and the store's durable drain
// status) — the same record this shell already enumerates.
function bindingsIncomplete() {
  // CORR1-R1 (Rowan recheck): incomplete state is derived from EITHER
  // the cursor/watermark OR the recorded drain status — even when no
  // bindings cache object exists at all (a first-page failure leaves
  // no cache but does persist drainStatus.complete=false). Checking
  // the cache first and returning false early was the bug: the shell
  // then labelled unreceived bindings "not generated" while the store
  // correctly said "Sync incomplete".
  const rec = readStateRecord();
  const bc = rec?.caches?.bindings;
  if (bc && bc.tip > 0 && bc.cursor < bc.tip) return true;
  return rec?.drainStatus?.bindings?.complete === false;
}
function storageRowText() {
  const h = run?.storageHealth ? run.storageHealth() : null;
  const backend = h?.backend ?? stateSnapshotBackend;
  const parts = [backend === "indexeddb" ? "IndexedDB" : "Local (legacy)"];
  if (h?.state) parts.push(`migration ${h.state}`);
  if (h?.migratedAt) parts.push(`migrated ${h.migratedAt}`);
  if (h?.markerWriteFailed) parts.push("cutover marker write failed — still on legacy, will retry");
  const diag = h?.lastDiag;
  if (diag?.class) parts.push(`last storage result: ${diag.class}`);
  if (h?.estimate) parts.push(`storage estimate ${h.estimate.usage ?? "?"}/${h.estimate.quota ?? "?"} bytes`);
  if (lastStorageGuard?.applicable) parts.push(`frozen-record guard: Shelf ${lastStorageGuard.shelfMatch ? "unchanged" : "CHANGED"}, prefs ${lastStorageGuard.prefsMatch ? "unchanged" : "CHANGED"}`);
  return parts.join(" · ");
}
function syncRowText(family) {
  const rec = readStateRecord();
  const c = rec?.caches?.[family];
  const ds = rec?.drainStatus?.[family];
  if (!c) {
    // CORR1-R1: a recorded incomplete drain is a real sync state even
    // when no cache object exists (first-page failure, cursor 0/0);
    // suppressing it as "not synced yet" contradicted the banner and
    // the store. Only a family with NO drain record at all reads
    // "not synced yet".
    if (ds && ds.complete === false) return `0/0 PARTIAL/SYNC INCOMPLETE${ds.reason ? ` (${ds.reason})` : ""}`;
    return "not synced yet";
  }
  const complete = ds ? ds.complete : (c.tip === 0 || c.cursor >= c.tip);
  return `${c.cursor}/${c.tip} ${complete ? "COMPLETE" : `PARTIAL/SYNC INCOMPLETE${ds?.reason ? ` (${ds.reason})` : ""}`}`;
}
// Redacted flush summary (CORR1, Rowan amendment 3): outcome counts
// and HTTP statuses only — never queue ids, read ids, or Shelf error
// text. The bridge's raw result stays inside the composition.
function redactFlush(r) {
  if (!r || typeof r !== "object") return { at: new Date().toISOString(), malformed: true, pending: shelfOutboxCount() };
  const outcomes = Array.isArray(r.outcomes) ? r.outcomes : [];
  const count = (k) => outcomes.filter((o) => o?.outcome === k).length;
  return {
    at: new Date().toISOString(),
    sent: typeof r.sent === "number" ? r.sent : count("sent"),
    covered: typeof r.covered === "number" ? r.covered : count("covered"),
    carved: count("carved"),
    blocked: outcomes.filter((o) => o?.outcome === "blocked").map((o) => ({ status: typeof o.status === "number" ? o.status : null })),
    pending: typeof r.pending === "number" ? r.pending : shelfOutboxCount(),
    errorPresent: !!r.error,
    relinkNeeded: !!r.relinkNeeded,
  };
}
function flushRowText(f) {
  if (f.malformed) return `no result recorded — ${f.pending} still pending`;
  if (f.refused) return `refused (${f.code ?? "unknown"}) — ${f.pending} still pending`;
  const blocked = f.blocked?.length ? `, blocked: ${f.blocked.map((b) => `HTTP ${b.status ?? "?"}`).join(", ")}` : "";
  return `sent ${f.sent}, covered ${f.covered}, carved ${f.carved}${blocked} — ${f.pending} pending${f.errorPresent ? " (Shelf reported an error)" : ""}${f.relinkNeeded ? " — relink needed" : ""}`;
}
function shelfAttributionText() {
  const ents = contentEntities();
  const ids = Object.keys(ents);
  if (!ids.length) return "no books cached";
  const withId = ids.filter((id) => typeof ents[id].payload?.shelfReadId === "string" && ents[id].payload.shelfReadId.length > 0).length;
  return `${withId} of ${ids.length} books carry a Shelf read ID${withId < ids.length ? " — sessions for the others are not attributed" : ""}`;
}
function contentEntities() { return readStateRecord()?.caches?.content?.entities ?? {}; }
function bindingEntities() { return readStateRecord()?.caches?.bindings?.entities ?? {}; }
// Shelf attribution (D5-C corrections pass, item 3): v1 attributes a
// listening session via the book's own shelfReadId (a.book.shelfReadId,
// non-empty). The shell reads it from the SAME candidate state it
// already enumerates for the library — the synced content-family
// record in cs:state:v1. When the record carries a non-empty
// shelfReadId it is returned verbatim; otherwise null, and the frozen
// bridge's own falsy-readId path (listenStart -> listenStop) queues
// NO session for that book. No synthetic id is ever invented here.
// CORRECTED RECORD (CORR1; supersedes the earlier GAP note): the
// P7 migration transform dropped shelfReadId, but the Oct 26 2026
// production repairs restored it on four books — Forever Pucked,
// Pucked, Pucked Up, Pucked Over (coordinator content revision 2) —
// whose records DO carry shelfReadId/shelfBookId/shelfBookTitle
// today (verified against the live content snapshot, Oct 28 2026).
// Three books still carry none — Finding Home, The Goal, In Her Own
// League: a visible functional limitation (Diagnostics shows the
// count); sessions for those books are not attributed, and any
// mapping for them is a separate, user-gated decision. This lookup
// is correct for any record that carries the field.
function shelfReadIdFor(bookId) {
  const rid = contentEntities()[bookId]?.payload?.shelfReadId;
  return typeof rid === "string" && rid.length > 0 ? rid : null;
}
function shelfOutboxCount() {
  try {
    const rec = JSON.parse(window.localStorage.getItem(SHELF_KEY) || "null");
    return Array.isArray(rec?.outbox) ? rec.outbox.length : 0;
  } catch { return 0; }
}
function bindingFor(bookId, occurrenceId) {
  const rec = bindingEntities()[`${bookId}:${occurrenceId}`];
  if (!rec?.payload?.cacheKey) return null;
  return { cacheKey: rec.payload.cacheKey, format: rec.payload.format, sizeBytes: rec.payload.size };
}
function flattenSegments(bookId) {
  const book = contentEntities()[bookId]?.payload;
  const out = [];
  for (const ch of book?.chapters ?? []) for (const seg of ch.segments ?? [])
    out.push({ chapterId: ch.chapterId, occurrenceId: seg.occurrenceId });
  return out;
}
function computeSuccessor(tok) {
  if (!tok?.bookId || !tok?.occurrenceId) return null;
  const flat = flattenSegments(tok.bookId);
  const i = flat.findIndex((s) => s.occurrenceId === tok.occurrenceId);
  if (i < 0) return null;
  for (let j = i + 1; j < flat.length; j++) {
    const b = bindingFor(tok.bookId, flat[j].occurrenceId);
    if (b) return { bookId: tok.bookId, occurrenceId: flat[j].occurrenceId, ...b };
  }
  return null;
}

// ------------------------------------------------------------ chrome (nav + player bar)
// UI1: three tabs (Library · Find text · Settings); Diagnostics is a
// section inside Settings (Julie's design, round 1). The historical
// "diagnostics" route still resolves — it renders Settings with the
// Diagnostics section present, so every diag-* readout keeps its id
// and its exact CORR1 meaning.
const nav = el("nav", { id: "v2-nav" });
const main = el("main", { id: "v2-main" });
const playerBar = el("div", { id: "v2playerbar" });
playerBar.append(media);
const playerStatus = el("div", { id: "player-status", text: "Player idle." });
const seek = el("input", { type: "range", id: "player-seek", min: "0", max: "0", step: "0.1", value: "0" });
seek.setAttribute("aria-label", "Seek");
const playBtn = el("button", { id: "player-playpause", class: "ui-pround big", text: "Play" });
playBtn.setAttribute("aria-label", "Play or pause");
const prevBtn = el("button", { id: "player-prev", class: "ui-pround", "aria-label": "Previous segment" });
prevBtn.innerHTML = '<svg width="15" height="14" viewBox="0 0 15 14" aria-hidden="true"><path d="M7 1 L1 7 L7 13 Z M14 1 L8 7 L14 13 Z" fill="#3d2a47"/></svg>';
const nextBtn = el("button", { id: "player-next", class: "ui-pround", "aria-label": "Next segment" });
nextBtn.innerHTML = '<svg width="15" height="14" viewBox="0 0 15 14" aria-hidden="true"><path d="M1 1 L7 7 L1 13 Z M8 1 L14 7 L8 13 Z" fill="#3d2a47"/></svg>';
const rateSel = el("select", { id: "player-rate" },
  ...["0.75", "1", "1.25", "1.5", "2"].map((r) => el("option", { value: r, text: `${r}×` })));
rateSel.value = "1";
rateSel.setAttribute("aria-label", "Playback speed");
const controlsRow = el("div", { class: "ui-pcontrols" }, prevBtn, playBtn, nextBtn, seek, rateSel);
playerBar.append(controlsRow, playerStatus);
root.append(nav, main, playerBar);

function renderNav() {
  clear(nav);
  if (!tokenHeld) return;
  const activeTab = currentScreen === "diagnostics" || currentScreen === "cast" || currentScreen === "book" || currentScreen === "generation" ? (currentScreen === "cast" || currentScreen === "book" || currentScreen === "generation" ? "library" : "settings") : currentScreen;
  for (const [id, label] of [["library", "Library"], ["findText", "Find text"], ["settings", "Settings"]]) {
    const b = el("button", { text: label, id: `nav-${id}`, onclick: () => show(id) });
    if (activeTab === id) b.setAttribute("aria-current", "page");
    nav.append(b);
  }
}
async function show(screen, arg) {
  if (genPollTimer) { clearInterval(genPollTimer); genPollTimer = null; }
  currentScreen = screen;
  // UI4 (design 5.6; Rowan condition (c)): refresh the shell's
  // state snapshot on entering a data screen, so mutations landed
  // through the backend since the last refresh (byte
  // confirmations, position reports, journal appends) are what
  // the screen renders.
  if (screen !== "access") await refreshStateSnapshot();
  renderNav();
  clear(main);
  if (screen === "access") return renderAccess();
  if (screen === "library") return renderLibrary();
  if (screen === "book") return renderBook(arg);
  if (screen === "generation") return renderGeneration(arg);
  if (screen === "cast") return renderCast(arg);
  if (screen === "findText") return renderFindText();
  if (screen === "settings") return renderSettings();
  if (screen === "diagnostics") return renderSettings("diagnostics");
}

// Locate a segment inside a book's content record: chapter index and
// segment index (both 0-based), or null. Human labels derive from
// this — never from raw ids.
function locateSegment(bookId, occurrenceId) {
  const book = contentEntities()[bookId]?.payload;
  if (!book) return null;
  const chapters = book.chapters ?? [];
  for (let ci = 0; ci < chapters.length; ci++) {
    const segs = chapters[ci].segments ?? [];
    for (let si = 0; si < segs.length; si++)
      if (segs[si].occurrenceId === occurrenceId) return { chapterIndex: ci, segmentIndex: si, chapterId: chapters[ci].chapterId };
  }
  return null;
}
function fmtClock(sec) {
  if (!Number.isFinite(sec) || sec === null || sec === undefined) return "?";
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtOffset(sec) {
  const s = Number(sec) || 0;
  return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
}
function positionLabel(bookId, occurrenceId, offsetSec) {
  const loc = locateSegment(bookId, occurrenceId);
  if (!loc) return `segment ${occurrenceId}`;
  return `Chapter ${loc.chapterIndex + 1} · Segment ${loc.segmentIndex + 1} · ${fmtOffset(offsetSec)} in`;
}

function refreshPlayerStatus(extra = "") {
  if (!run?.player) { playerStatus.textContent = "Player idle."; return; }
  const p = run.player;
  const cur = p.current;
  const last = p.records?.[p.records.length - 1];
  let place = "";
  if (cur) {
    const loc = locateSegment(cur.bookId, cur.occurrenceId);
    place = loc ? ` · Chapter ${loc.chapterIndex + 1} · Segment ${loc.segmentIndex + 1}` : ` · segment ${cur.occurrenceId}`;
  }
  playerStatus.textContent =
    `Player: ${p.state}` + place +
    (cur ? ` · ${fmtClock(media.currentTime)} / ${fmtClock(media.duration)}` : "") +
    (last?.code ? ` · last event: ${last.code}` : "") + (extra ? ` · ${extra}` : "");
  playBtn.textContent = p.state === "playing" ? "Pause" : "Play";
  playBtn.setAttribute("aria-label", p.state === "playing" ? "Pause" : "Play");
  if (Number.isFinite(media.duration) && media.duration > 0) seek.max = String(media.duration);
  seek.value = String(media.currentTime || 0);
}
playBtn.addEventListener("click", async () => {
  if (!run?.player) return;
  try {
    if (run.player.state === "playing") await run.player.pause();
    else await run.player.play();
  } catch (e) { refreshPlayerStatus(`refused: ${e?.code ?? e?.message ?? e}`); return; }
  refreshPlayerStatus();
});
nextBtn.addEventListener("click", () => {
  const nxt = computeSuccessor(run?.player?.current);
  if (nxt) void selectSegment(nxt, { autoplay: true });
});
prevBtn.addEventListener("click", () => {
  const cur = run?.player?.current;
  if (!cur?.bookId || !cur?.occurrenceId) return;
  const flat = flattenSegments(cur.bookId);
  const i = flat.findIndex((s) => s.occurrenceId === cur.occurrenceId);
  for (let j = i - 1; j >= 0; j--) {
    const b = bindingFor(cur.bookId, flat[j].occurrenceId);
    if (b) { void selectSegment({ bookId: cur.bookId, occurrenceId: flat[j].occurrenceId, ...b }, { autoplay: true }); return; }
  }
});
seek.addEventListener("change", async () => {
  if (!run?.player) return;
  await run.player.seek(Number(seek.value));
  refreshPlayerStatus();
});
rateSel.addEventListener("change", () => { media.playbackRate = Number(rateSel.value); });
for (const ev of ["play", "pause", "ended", "loadedmetadata", "seeked", "error", "waiting", "stalled"])
  media.addEventListener(ev, () => refreshPlayerStatus());
media.addEventListener("timeupdate", () => {
  if (Number.isFinite(media.duration) && media.duration > 0) seek.max = String(media.duration);
  seek.value = String(media.currentTime || 0);
});

// ------------------------------------------------------------ sheets (generation + voice)
// GEN-PKG-1: the generation confirm sheet is LIVE (DESIGN BRIEF
// v2 §5; Rowan sign-off 6510767252). Before Start can be offered,
// the sheet reads the server's capabilities (which lanes exist)
// and its eligibility quote for the exact scope (how many
// segments, how many characters, the estimated cost, and what is
// excluded and why). Starting work is a POST /v2/commands
// SubmitJob carrying the D6 intent; the command_id is minted once
// per sheet opening, and the server's intent identity (same book
// + scope + eligible set + lane + keepGoing + server-admitted
// phase = same plan; round-1 corrections) absorbs double-taps,
// retries, and a second device asking for the same work. If a
// plan for the same scope is already running, the sheet routes to
// it instead of submitting. If the submit's answer is lost, the
// sheet re-reads the plan list before saying anything failed. The
// client authors NO bindings (publication is the server's
// projection) and writes NOTHING locally. The voice picker below
// stays as ui-pkg-4 shipped it: display only, unavailable.
const genSheet = el("div", { class: "ui-sheetback", id: "gen-sheet", hidden: "" });
const genSheetTitle = el("h3", { id: "gen-sheet-title", text: "" });
const genSheetSub = el("div", { class: "ui-author", id: "gen-sheet-sub", text: "" });
const genSheetNote = el("div", { class: "ui-offnote", id: "gen-sheet-offnote", text: "" });
const genAttempts = el("b", { id: "gen-sheet-attempts", text: "" });
const genSheetCost = el("b", { id: "gen-sheet-cost", text: "" });
const genSheetVoices = el("b", { id: "gen-sheet-voices", text: "Book's cast, already set" });
const genSheetExclusions = el("div", { id: "gen-sheet-exclusions", class: "ui-genexcl" });
const genSheetClose = () => { genSheet.hidden = true; genCtx = null; };
const genStartBtn = el("button", { class: "ui-btn ui-btn-plum", text: "Start generation", disabled: "" });
genStartBtn.setAttribute("aria-disabled", "true");
const genViewBtn = el("button", { class: "ui-btn ui-btn-plum", text: "View progress", id: "gen-sheet-view", hidden: "" });
const genStandardBtn = el("button", { id: "gen-sheet-standard", text: "Standard" });
const genBatchBtn = el("button", { id: "gen-sheet-batch", text: "Batch", title: "Batch isn't available" });
const genLaneCap = el("div", { class: "ui-cap", id: "gen-sheet-lanecap", text: "" });
const genKeepBtn = el("button", { class: "ui-sw on", id: "gen-sheet-quota", role: "switch", "aria-checked": "true", "aria-label": "Keep going to the next chapter automatically" }, el("i", {}));
genSheet.append(el("div", { class: "ui-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "gen-sheet-title" },
  genSheetTitle, genSheetSub, genSheetNote,
  el("div", { class: "ui-segctl" }, genStandardBtn, genBatchBtn),
  genLaneCap,
  el("div", {},
    el("div", { class: "ui-erow" }, el("span", { text: "Voices" }), genSheetVoices),
    el("div", { class: "ui-erow" }, el("span", { text: "Segments" }), genAttempts),
    el("div", { class: "ui-erow" }, el("span", { text: "Estimated cost" }), genSheetCost),
    genSheetExclusions,
    el("div", { class: "ui-erow" }, el("span", { text: "Keep going to the next chapter automatically" }),
      genKeepBtn)),
  el("div", { class: "ui-row2" },
    el("button", { class: "ui-btn ui-btn-soft", text: "Not now", id: "gen-sheet-cancel", onclick: genSheetClose }),
    genViewBtn, genStartBtn)));
genSheet.addEventListener("click", (e) => { if (e.target === genSheet) genSheetClose(); });
root.append(genSheet);

// The generation session + the open sheet's transient context.
// Memory only — nothing here is ever persisted (design §5).
let genClient = null;
let genCtx = null;
let genPollTimer = null;

function genSetStart(enabled, label) {
  genStartBtn.disabled = !enabled;
  if (enabled) genStartBtn.removeAttribute("aria-disabled");
  else genStartBtn.setAttribute("aria-disabled", "true");
  if (label) genStartBtn.textContent = label;
}

function genRenderLanePicker() {
  const ctx = genCtx;
  if (!ctx?.caps) return;
  const opts = laneOptions(ctx.caps);
  const std = opts.find((o) => o.lane === "standard");
  const bat = opts.find((o) => o.lane === "batch");
  genStandardBtn.disabled = !std.admitted;
  genStandardBtn.className = ctx.lane === "standard" ? "on" : "";
  genBatchBtn.disabled = !bat.admitted;
  genBatchBtn.className = ctx.lane === "batch" ? "on" : "";
  genBatchBtn.title = bat.admitted ? "Batch" : (bat.reason ?? "Batch isn't available");
  genLaneCap.textContent = !bat.admitted
    ? (bat.reason ?? "")
    : (!std.admitted ? (std.reason ?? "") : "Standard makes audio right away. Batch waits for a batch window.");
}

genStandardBtn.addEventListener("click", () => {
  if (!genCtx || genStandardBtn.disabled) return;
  genCtx.lane = "standard";
  genRenderLanePicker();
});
genBatchBtn.addEventListener("click", () => {
  // A disabled Batch button never selects anything; when the
  // server admits Batch this same handler selects it.
  if (!genCtx || genBatchBtn.disabled) return;
  genCtx.lane = "batch";
  genRenderLanePicker();
});
genKeepBtn.addEventListener("click", () => {
  if (!genCtx || genCtx.scope !== "book") return;
  genCtx.keepGoing = !genCtx.keepGoing;
  genKeepBtn.className = genCtx.keepGoing ? "ui-sw on" : "ui-sw";
  genKeepBtn.setAttribute("aria-checked", genCtx.keepGoing ? "true" : "false");
});
genStartBtn.addEventListener("click", () => { void genSheetSubmit(); });
genViewBtn.addEventListener("click", () => {
  const bookId = genCtx?.bookId;
  genSheetClose();
  show("generation", bookId);
});

async function genSheetSubmit() {
  const ctx = genCtx;
  if (!ctx || ctx.submitted || !genClient) return;
  ctx.submitted = true;
  genSetStart(false, "Starting…");
  const intent = { scope: ctx.scope, keepGoing: ctx.scope === "book" ? !!ctx.keepGoing : false, phase: phaseForBook(ctx.caps, ctx.bookId) };
  if (ctx.scope === "chapter") intent.chapterIndex = ctx.chapterIndex;
  if (ctx.scope === "segment") intent.occurrenceId = ctx.occurrenceId;
  try {
    const receipt = await genClient.submitIntent({ commandId: ctx.commandId, bookId: ctx.bookId, lane: ctx.lane, intent });
    if (genCtx !== ctx) return;
    // The intent route answers 200 with the service result, so a
    // REJECTION (Rowan round 1, comment 6511518715: B1 phase
    // admission, the lane gate) arrives WITH no planId. It must
    // never be reported as "Started".
    if (!receipt?.planId) {
      ctx.submitted = false;
      genSheetNote.textContent = rejectionText(receipt?.reason);
      genSetStart(true, "Start generation");
      return;
    }
    ctx.planId = receipt.planId;
    genSheetNote.textContent = "Started. It runs on the server — you can close the app and it keeps going. Progress is on the Generation view.";
    genViewBtn.hidden = false;
  } catch (e) {
    if (genCtx !== ctx) return;
    // A lost answer is not a lost intent: the server keys the
    // plan by the intent itself, so look before claiming failure.
    // The match must be on the run's SEMANTICS (lane + keepGoing),
    // not just its scope: a plan minted under different semantics
    // is not the run this sheet asked for, and must never be
    // reported as "Started" (Rowan round 1, B2).
    let started = null, otherActive = null;
    try {
      const plans = await genClient.listAllPlans();
      const scoped = plans.filter((p) => p && p.bookId === ctx.bookId && p.scope === ctx.scope
        && (ctx.scope !== "chapter" || p.chapterIndex === ctx.chapterIndex));
      started = scoped.find((p) => p.lane === ctx.lane
        && !!p.keepGoing === (ctx.scope === "book" ? !!ctx.keepGoing : false)) ?? null;
      otherActive = started ? null
        : (scoped.find((p) => !isTerminalPlanState(p.state)) ?? null);
    } catch { started = null; otherActive = null; }
    if (started) {
      ctx.planId = started.planId;
      genSheetNote.textContent = "Started — the answer was lost on the way back, but the plan is on the server. Progress is on the Generation view.";
      genViewBtn.hidden = false;
      return;
    }
    if (otherActive) {
      ctx.planId = otherActive.planId;
      genSheetNote.textContent = `A run with different settings is already going for this — ${planSemanticsText(otherActive)}. This sheet's start wasn't submitted. The running one is on the Generation view.`;
      genViewBtn.hidden = false;
      return;
    }
    if (genCtx !== ctx) return;
    ctx.submitted = false;
    genSheetNote.textContent = "That start didn't go through — nothing was submitted. You can try again safely: the server treats the same start as one request, never two.";
    genSetStart(true, "Start generation");
  }
}

async function prepareGenSheet() {
  const ctx = genCtx;
  if (!ctx || !genClient) return;
  genSheetNote.textContent = "Checking with the server…";
  genSetStart(false, "Start generation");
  genViewBtn.hidden = true;
  try {
    const [caps, quote, plans] = await Promise.all([
      genClient.capabilities(),
      genClient.quote({ bookId: ctx.bookId, scope: ctx.scope, chapterIndex: ctx.chapterIndex ?? null, occurrenceId: ctx.occurrenceId ?? null }),
      genClient.listAllPlans(),
    ]);
    if (genCtx !== ctx) return;
    ctx.caps = caps;
    ctx.quote = quote;
    genRenderLanePicker();
    genAttempts.textContent = quote.eligibleCount > 0
      ? `${quote.eligibleCount} segment${quote.eligibleCount === 1 ? "" : "s"} · ${Number(quote.totalChars).toLocaleString("en-US")} characters`
      : "Nothing to generate here";
    genSheetCost.textContent = quote.eligibleCount > 0 ? `${formatMicroCents(quote.expectedCostMicroCents)} (estimate)` : "—";
    genSheetExclusions.replaceChildren(...exclusionLines(quote).map((t) => el("div", { text: t })));
    if (caps.generationState !== "enabled") {
      genSheetNote.textContent = "Generation is paused on the server right now — nothing can be started. Everything already made still plays.";
      genSetStart(false);
      return;
    }
    const active = findActivePlan(plans, { bookId: ctx.bookId, scope: ctx.scope, chapterIndex: ctx.chapterIndex ?? null });
    if (active) {
      ctx.activePlan = active;
      // Name the running plan's own lane + continuation semantics:
      // rerouting must never imply the sheet's chosen settings are
      // the ones in force (Rowan round 1, B2).
      genSheetNote.textContent = `This is already being generated — ${planSemanticsText(active)}. Starting it again would do nothing. Its progress is on the Generation view.`;
      genSetStart(false);
      genViewBtn.hidden = false;
      return;
    }
    if (quote.eligibleCount === 0) {
      const ex = quote.exclusions ?? {};
      genSheetNote.textContent = (ex.parked ?? 0) > 0 && (ex.voice_prompt ?? 0) === 0 && (ex.bound_already ?? 0) === 0
        ? "Everything here is parked. Parked work resumes only on your explicit word — it can't be started from here."
        : (ex.voice_prompt ?? 0) > 0 && (ex.bound_already ?? 0) === 0 && (ex.parked ?? 0) === 0
          ? "These segments need a voice choice first — there's nothing to start until that's decided."
          : "Everything here already has audio, or can't be generated yet.";
      genSetStart(false);
      return;
    }
    genSheetNote.textContent = "The estimate comes from the server. Making audio happens on the server too — you can close the app and it keeps going, and new segments appear here as the server publishes them.";
    genSetStart(true, "Start generation");
  } catch (e) {
    if (genCtx !== ctx) return;
    genSheetNote.textContent = "Couldn't reach the generation service — nothing was submitted. Check your connection and try again.";
    genSetStart(false);
  }
}

function openGenSheet({ bookId, scope, chapterIndex = null, occurrenceId = null, title, sub, voices }) {
  const commandId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `gen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  genCtx = { bookId, scope, chapterIndex, occurrenceId, commandId, lane: "standard", keepGoing: scope === "book", submitted: false, caps: null, quote: null, planId: null };
  genSheetTitle.textContent = title ?? "Generate";
  genSheetSub.textContent = sub ?? "";
  genAttempts.textContent = "Checking…";
  genSheetCost.textContent = "—";
  genSheetExclusions.replaceChildren();
  if (voices) genSheetVoices.textContent = voices;
  genKeepBtn.className = genCtx.keepGoing ? "ui-sw on" : "ui-sw";
  genKeepBtn.setAttribute("aria-checked", genCtx.keepGoing ? "true" : "false");
  genKeepBtn.disabled = scope !== "book";
  genSheet.hidden = false;
  genSetStart(false, "Start generation");
  genViewBtn.hidden = true;
  document.getElementById("gen-sheet-cancel").focus();
  void prepareGenSheet();
}

// One plan line, shared by the book screen's Generation section
// and the Generation view. Display only — server state in, plain
// words out; there is deliberately no control here that could
// resume, retry, or alter a plan.
function genPlanLine(p, bookTitle) {
  const scopeLabel = p.scope === "book" ? "Whole book" : p.scope === "chapter" ? `Chapter ${(p.chapterIndex ?? 0) + 1}` : "One segment";
  const line = el("div", { class: "ui-genline", id: `genline-${p.planId}` });
  line.append(el("span", { class: "ui-genstatus", text: `${bookTitle ? `${bookTitle} · ` : ""}${scopeLabel} — ${planStatusText(p)}` }));
  line.append(el("span", { class: "ui-genplan-meta",
    text: `${planMoneyText(p)} · ${planSemanticsText(p)} · audio published ${p.bindingsPublished ?? 0}${(p.bindingsPending ?? 0) > 0 ? ` · publishing ${p.bindingsPending}` : ""}` }));
  return line;
}

// The Generation view (read-only): every plan on the account —
// including ones started from elsewhere (the operator path) —
// with the server's own progress and settled amounts, and the
// phase budget picture from capabilities. No resume control
// exists here by design.
async function renderGeneration(focusBookId) {
  const head = el("section", { class: "ui-card" });
  const summary = el("div", { id: "generation-summary", text: "Checking with the server…" });
  head.append(el("h2", { class: "ui-h", text: "Generation" }), summary);
  const list = el("div", { id: "generation-list" });
  main.append(head, list);
  const refresh = async () => {
    if (!genClient) { summary.textContent = "Connect to see generation."; return; }
    try {
      const [caps, plans] = await Promise.all([genClient.capabilities(), genClient.listAllPlans()]);
      const bits = [];
      bits.push(caps.generationState === "enabled" ? "Generation is on." : "Generation is paused on the server.");
      for (const ph of caps.phases ?? []) {
        const title = ph.bookId ? (contentEntities()[ph.bookId]?.payload?.title ?? null) : null;
        bits.push(`${title ? `${title}: ` : ""}budget ${formatMicroCents(ph.budgetMicroCents)} · settled ${formatMicroCents(ph.settledMicroCents)}${(ph.inFlightUpperMicroCents ?? 0) > 0 ? ` · reserved up to ${formatMicroCents(ph.inFlightUpperMicroCents)}` : ""} · ${formatMicroCents(ph.remainingMicroCents)} left`);
      }
      summary.textContent = bits.join(" ");
      list.replaceChildren();
      if (!plans.length) list.append(el("section", { class: "ui-card", text: "Nothing has been generated yet." }));
      const sorted = [...plans].sort((x, y) => ((focusBookId && y.bookId === focusBookId) ? 1 : 0) - ((focusBookId && x.bookId === focusBookId) ? 1 : 0));
      for (const p of sorted) {
        const card = el("section", { class: "ui-card" });
        const title = contentEntities()[p.bookId]?.payload?.title ?? null;
        card.append(genPlanLine(p, title));
        list.append(card);
      }
      if (genPollTimer) { clearInterval(genPollTimer); genPollTimer = null; }
      if (plans.some((p) => !isTerminalPlanState(p.state)) && currentScreen === "generation") {
        genPollTimer = setInterval(() => { if (currentScreen === "generation") void refresh(); }, 5000);
      }
    } catch {
      summary.textContent = "Generation status unavailable right now.";
    }
  };
  await refresh();
}


const voiceSheet = el("div", { class: "ui-sheetback", id: "voice-sheet", hidden: "" });
const voiceSheetTitle = el("h3", { id: "voice-sheet-title", text: "" });
const voiceSheetNote = el("div", { class: "ui-cap", id: "voice-sheet-note", text: "" });
const voiceSheetClose = () => { voiceSheet.hidden = true; };
const voiceUseBtn = el("button", { class: "ui-btn ui-btn-plum", text: "Use this voice", disabled: "" });
voiceUseBtn.setAttribute("aria-disabled", "true");
voiceSheet.append(el("div", { class: "ui-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "voice-sheet-title" },
  voiceSheetTitle,
  el("div", { class: "ui-author", text: "Try a voice on one segment first — nothing changes until you pick." }),
  voiceSheetNote,
  el("div", { class: "ui-offnote", id: "voice-sheet-offnote", text: "Generation isn't on yet — auditions and voice changes arrive with generation. Nothing was changed." }),
  el("div", {},
    ...["Charon", "Kore", "Puck", "Aoede"].map((v) => el("div", { class: "ui-erow" },
      el("span", {}, el("b", { text: v }), document.createTextNode(" · Gemini")),
      el("button", { class: "ui-play", disabled: "", "aria-label": `Try Gemini ${v} (not available yet)` },
        el("span", { text: "▶", "aria-hidden": "true" }))))),
  el("div", { class: "ui-row2" },
    el("button", { class: "ui-btn ui-btn-soft", text: "Cancel", id: "voice-sheet-cancel", onclick: voiceSheetClose }),
    voiceUseBtn)));
voiceSheet.addEventListener("click", (e) => { if (e.target === voiceSheet) voiceSheetClose(); });
root.append(voiceSheet);
function openVoiceSheet(name, styleText) {
  voiceSheetTitle.textContent = `Change ${name}'s voice`;
  voiceSheetNote.textContent = styleText ? `Style note: ${styleText}` : "No style note recorded for this character.";
  voiceSheet.hidden = false;
  document.getElementById("voice-sheet-cancel").focus();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { genSheet.hidden = true; voiceSheet.hidden = true; }
});

// ------------------------------------------------------------ Access (design 4.4)
function renderAccess() {
  const m = screens.accessScreenModel();
  const status = el("div", { id: "access-status", class: "v2muted", text: "" });
  const waiting = el("div", { id: "access-waiting", class: "v2muted", text: "", hidden: "" });
  const field = el("input", { type: "password", id: "access-token", autocomplete: "off" });
  field.setAttribute("aria-label", m.fieldLabel);
  const connect = el("button", {
    id: "access-connect", class: "v2btn", text: m.connectLabel,
    onclick: () => { void connectWith(field.value, { field, status, waiting, connect }); },
  });
  main.append(
    el("h1", { text: m.serviceLine }),
    el("label", { text: m.fieldLabel, for: "access-token" }),
    el("div", {}, field, connect),
    waiting, status,
    el("p", { class: "v2muted", id: "access-compiled", text: `Service: ${PRODUCTION_BASE_HOST} · scope ${V2_SCOPE} · instance ${V2_INSTANCE} (compiled into this build; not editable).` }),
    el("p", { class: "v2muted", id: "access-effective", text: `Effective API destination: ${API_BASE.host} · Effective Shelf destination: ${SHELF_BASE.host}` }),
    ...(API_BASE.overrideActive || SHELF_BASE.overrideActive
      ? [el("p", { class: "v2error", id: "access-override-notice", text: "TEST OVERRIDE (loopback only) — not the production service. One or both destinations above are loopback test endpoints, not production." })]
      : []),
    ...(API_BASE.rejected || SHELF_BASE.rejected
      ? [el("p", { class: "v2error", id: "access-override-rejected", text: "A non-loopback destination override was ignored; the compiled production service is in use." })]
      : []),
    el("p", { class: "v2muted", text: "The token is held in memory only and is never saved. Reloading this app returns here." }),
  );
}

async function connectWith(token, { field, status, waiting, connect }) {
  if (!token) { status.textContent = "Enter the production access token first."; return; }
  connect.disabled = true;
  status.textContent = "Connecting…";
  // Design 4.4 step 3, sequenced deliberately: the single read-only
  // verification (GET /v2/settings) runs FIRST, through the
  // candidate's own audio transport — the same instrument the
  // candidate's verifyAccess() uses. Only a verified token constructs
  // the full client. This ordering matters: constructing the client
  // mints the device identity shell slot, and the candidate's
  // safeguard 1 (never reuse an identity whose store counters reset)
  // stops a later construction if a first construction left a shell
  // slot with no store record — so a mistyped token must never be
  // allowed to burn the identity. The full Table C preflight inside
  // the constructed client re-verifies settings as its C2 row.
  const transport = createAudioTransport({ baseUrl: BASE_URL, token, scope: V2_SCOPE, instance: V2_INSTANCE });
  try {
    await transport.rawSettingsGet();
  } catch (e) {
    const branch = e?.status === 401 ? "token" : e?.status === 403 ? "fence" : "network";
    connect.disabled = false;
    status.innerHTML = "";
    if (branch === "token")
      status.append(el("span", { class: "v2error", id: "access-error-token", text: "That token was not accepted for the production Reader." }));
    else if (branch === "fence")
      status.append(el("span", { class: "v2error", id: "access-error-fence", text: "This build is pointing at the wrong service fence." }));
    else
      status.append(el("span", { class: "v2error", id: "access-error-network", text: "Could not reach the production Reader." }),
        el("button", { class: "v2btn", id: "access-retry", text: "Retry", onclick: () => { void connectWith(field.value, { field, status, waiting, connect }); } }));
    return;
  }
  // Success: the token field is cleared from the DOM (design 4.4).
  field.value = "";
  let client = null;
  const waitTimer = setTimeout(() => {
    waiting.hidden = false;
    waiting.textContent = "Waiting for the other open copy of the Reader to close — only one copy can be the writer at a time.";
  }, 1500);
  try {
    client = await createRunnableClient({
      token,
      storageLike: window.localStorage,
      media,
      shelf: { shelfApiBase: SHELF_API_BASE },
      idGen: () => crypto.randomUUID(),
      baseUrl: BASE_URL,
      readIdFor: (tok) => shelfReadIdFor(tok.bookId),
      resolveBinding: async (tok) => bindingFor(tok.bookId, tok.occurrenceId),
      // The candidate's auto-next contract: nextSelection is invoked
      // with NO arguments when the current segment ends; the shell
      // answers from the player's live current selection.
      nextSelection: () => computeSuccessor(run?.player?.current),
    });
  } catch (e) {
    clearTimeout(waitTimer);
    connect.disabled = false;
    status.innerHTML = "";
    status.append(el("span", { class: "v2error", text: `Could not start the Reader (${e?.code ?? e?.message ?? "unknown error"}).` }));
    return;
  }
  clearTimeout(waitTimer);
  waiting.hidden = true;
  if (client.stopped) {
    connect.disabled = false;
    status.innerHTML = "";
    status.append(el("span", { class: "v2error", id: "access-stopped", text: `This device identity needs a decision before the Reader can start (${client.candidate?.code ?? "device_id_unrecoverable"}). See Diagnostics in the full report.` }));
    return;
  }
  run = client;
  tokenHeld = true;
  // gen-pkg-1: the generation session — same credential posture
  // as every transport here (token in this closure's memory only,
  // never persisted, never in any local record).
  genClient = createGenerationClient({ baseUrl: BASE_URL, token, scope: V2_SCOPE, instance: V2_INSTANCE });
  await refreshStateSnapshot();
  // Full Table C preflight against the designated probe before any
  // write path opens; only then are the library families synced.
  status.textContent = "Access confirmed. Running the full preflight checks…";
  const pf = await run.runPreflight(DESIGNATED_PROBE);
  if (!pf.ok) {
    show("diagnostics");
    return;
  }
  // CORR1: the family syncs are bounded drains. Their results are
  // kept for the Library banner and Diagnostics; an incomplete drain
  // is stated plainly (PARTIAL/SYNC INCOMPLETE with the resumable
  // cursor/watermark), never dressed as success — and the library
  // still opens with whatever has loaded.
  lastSync = [await run.candidate.library.syncContent(), await run.candidate.library.syncBindings()];
  await refreshStateSnapshot();
  // UI4 (G7, design 5.4/S6 + section 6): the frozen-record guard
  // is checked at the first post-cutover Connect, BEFORE this
  // session's Shelf flush can touch the bridge record.
  try { lastStorageGuard = run.verifyStorageGuard ? await run.verifyStorageGuard() : null; } catch { lastStorageGuard = null; }
  if (lastStorageGuard?.applicable && (!lastStorageGuard.shelfMatch || !lastStorageGuard.prefsMatch)) {
    status.textContent = "Storage check: a protected on-device record changed during migration — stop and report this before going further.";
  }
  const incompleteDrains = lastSync.filter((d) => d && d.complete === false);
  if (incompleteDrains.length) {
    status.textContent = `Sync incomplete — ${incompleteDrains.map((d) => `${d.family} ${d.cursor}/${d.tip}`).join(", ")}. What has loaded is usable; reconnect to resume.`;
  }
  // Queued Shelf sessions from a prior run flush once the gate is
  // open (the bridge's flush is gate-fenced by the composition, so
  // this can only ever dispatch after a full preflight pass). CORR1:
  // the flush RESULT is captured (redacted) instead of discarded —
  // a refusal or a Shelf-side failure leaves the queue intact and
  // its actual outcome is visible in Diagnostics, never hidden.
  try { lastShelfFlush = redactFlush(await run.candidate.shelfBridge.flush()); }
  catch (e) { lastShelfFlush = { at: new Date().toISOString(), refused: true, code: e?.code ?? null, pending: shelfOutboxCount() }; }
  show("library");
}

// ------------------------------------------------------------ UI prefs (presentation only)
// Collapsible state for the Book view, kept in this device's local
// storage under a shell-owned key. Presentation only: it never
// touches the candidate state record, positions, or backups.
const UI_PREFS_KEY = "opalreader.v2.uiPrefs";
function readUiPrefs() {
  try { const p = JSON.parse(window.localStorage.getItem(UI_PREFS_KEY) || "null"); return p && typeof p === "object" ? p : {}; }
  catch { return {}; }
}
function writeUiPrefs(patch) {
  try {
    const p = { ...readUiPrefs(), ...patch };
    window.localStorage.setItem(UI_PREFS_KEY, JSON.stringify(p));
  } catch { /* presentation state is best-effort */ }
}
function actionsOpenFor(bookId) {
  const v = readUiPrefs().actionsOpen?.[bookId];
  return typeof v === "boolean" ? v : false; // design: collapsed to the Resume strip
}
function chapterOpenFor(bookId, chapterId, fallback) {
  const v = readUiPrefs().chaptersOpen?.[`${bookId}|${chapterId}`];
  return typeof v === "boolean" ? v : fallback;
}

// ------------------------------------------------------------ Cast model
// Recorded voice mappings (Roundtable record, Julie's decisions —
// recorded ONLY; nothing here remaps or generates). Keyed by
// bookId|character name, matching the content plane's cast entries.
// These four are the library's non-Gemini cast voices; the census
// test (tests/cast-census.mjs) proves this table covers exactly the
// non-Gemini cast voices in the frozen census — no more, no fewer.
const RECORDED_VOICE_MAPPINGS = {
  "1c6bc7a6-6ef7-45b9-9a58-f492a1526ea0|Emmett": { provider: "gemini", voiceName: "Charon", unverified: false },
  "1c6bc7a6-6ef7-45b9-9a58-f492a1526ea0|Reese": { provider: "gemini", voiceName: "Kore", unverified: false },
  "f1b1e2f9-8c09-4f23-8290-472740923954|Sabrina": { provider: "gemini", voiceName: "Aoede", unverified: false },
  "f1b1e2f9-8c09-4f23-8290-472740923954|Tucker": { provider: "gemini", voiceName: "Puck", unverified: true },
};
const PROVIDER_LABELS = { gemini: "Gemini", azure: "Azure", speechify: "Speechify", elevenlabs: "ElevenLabs", fish: "Fish", openai: "OpenAI" };
function providerLabel(p) { return PROVIDER_LABELS[p] ?? (p ? p[0].toUpperCase() + p.slice(1) : "Unknown"); }
// Pure derivation from the book's content-plane record: the cast is
// the record's own `cast` array (the migration transform carries the
// book's POV list as data). A book whose record carries no cast array
// reports available:false — the UI shows the gap, never an invention.
function castModelFor(book) {
  const cast = Array.isArray(book?.cast) ? book.cast : null;
  if (!cast) return { available: false, rows: [], total: 0, attention: 0 };
  const rows = cast.map((c) => {
    const v = c?.voice ?? null;
    const mapping = RECORDED_VOICE_MAPPINGS[`${book.bookId}|${c?.name}`] ?? null;
    const voice = v ? {
      provider: v.provider ?? null,
      voiceId: v.voice_id ?? null,
      name: v.name ?? v.voice_id ?? null,
      style: typeof v.style_direction === "string" && v.style_direction ? v.style_direction : null,
    } : null;
    const needsAttention = !voice || (!!mapping && mapping.unverified) || (!!voice && voice.provider !== "gemini" && !mapping);
    return { povId: c?.id ?? null, name: c?.name ?? "(unnamed)", voice, mapping, needsAttention };
  });
  // Stable: needs-attention rows float first; source order kept within groups.
  rows.sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention));
  return { available: true, rows, total: rows.length, attention: rows.filter((r) => r.needsAttention).length };
}
function initialsFor(title) {
  const words = String(title ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}
function playTriangle(color) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("width", "13"); s.setAttribute("height", "14"); s.setAttribute("viewBox", "0 0 13 14");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", "M1 1 L12 7 L1 13 Z"); p.setAttribute("fill", color);
  s.append(p);
  return s;
}
function plusGlyph() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("width", "12"); s.setAttribute("height", "12"); s.setAttribute("viewBox", "0 0 12 12");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", "M6 1 V11 M1 6 H11"); p.setAttribute("stroke", "#765d83");
  p.setAttribute("stroke-width", "2.4"); p.setAttribute("stroke-linecap", "round");
  s.append(p);
  return s;
}

// ------------------------------------------------------------ Library
async function renderLibrary() {
  main.append(el("div", { class: "ui-brand", text: "Opal Reader" }));
  // UI1: an incomplete sync is announced on the library itself, with
  // the resumable counts — not buried in Diagnostics. (Same banner
  // text and id as the accepted corrective shell.)
  const incomplete = lastSync?.some((d) => d && d.complete === false);
  main.append(el("div", { class: "ui-sync", id: "library-sync-line",
    text: incomplete ? "Sync incomplete — reconnect to resume loading" : "All synced" }));
  if (incomplete) {
    const inc = lastSync.filter((d) => d && d.complete === false)
      .map((d) => `${d.family} ${d.cursor}/${d.tip}`).join(", ");
    main.append(el("p", { class: "v2error", id: "library-sync-incomplete", text: `Sync incomplete — ${inc}. Reconnect to resume loading.` }));
  }
  const ents = contentEntities();
  const ids = Object.keys(ents);
  if (ids.length === 0) {
    main.append(el("p", { id: "library-empty", class: "v2muted", text: "No books are cached on this device yet." }));
    return;
  }
  const rowsData = [];
  for (const bookId of ids) {
    const book = ents[bookId].payload;
    const flat = flattenSegments(bookId);
    let bound = 0;
    for (const s of flat) if (bindingFor(bookId, s.occurrenceId)) bound++;
    let canonical = null;
    try { canonical = (await run.candidate.playerSurfaces.positionModel(bookId)).canonical; } catch {}
    rowsData.push({ bookId, book, total: flat.length, bound, unbound: flat.length - bound, canonical,
      row: screens.libraryRowModel(book, (book.chapters ?? []).length, { bound, unbound: flat.length - bound }, canonical) });
  }
  // Continue listening: the first book (library order) with a saved position.
  const hero = rowsData.find((r) => r.canonical);
  if (hero) {
    const b = bindingFor(hero.bookId, hero.canonical.occurrenceId);
    main.append(el("div", { class: "ui-sect", text: "Continue listening" }));
    const heroCard = el("div", { class: "ui-card ui-hero", id: "library-hero" },
      el("div", { class: "ui-tile ui-tile-lg", text: initialsFor(hero.book.title) }),
      el("div", { class: "v2grow" },
        el("h3", { text: hero.book.title ?? hero.bookId }),
        el("div", { class: "ui-author", text: hero.book.author ?? "" }),
        el("div", { class: "ui-resume-line", id: "hero-resume-line", text: positionLabel(hero.bookId, hero.canonical.occurrenceId, hero.canonical.offsetSec) })));
    if (b) heroCard.append(el("button", { class: "ui-btn ui-btn-plum", id: "hero-resume", text: "Resume",
      onclick: () => { void selectSegment({ bookId: hero.bookId, occurrenceId: hero.canonical.occurrenceId, ...b }, { restoreOffset: hero.canonical.offsetSec, autoplay: true }); } }));
    else heroCard.append(el("span", { class: "ui-noaudio", text: "not yet synced" }));
    main.append(heroCard);
  }
  main.append(el("div", { class: "ui-sect", text: "Your library" }));
  for (const r of rowsData) {
    const pct = r.total ? Math.round((r.bound / r.total) * 100) : 0;
    const cap = bindingsIncomplete()
      ? `${r.bound} with audio · ${r.unbound} not yet synced`
      : r.unbound === 0 ? `${r.bound} with audio · Complete` : `${r.bound} with audio · ${r.unbound} to go`;
    const info = el("div", { class: "ui-info" },
      el("h4", { text: r.row.title ?? r.bookId }),
      el("div", { class: "ui-author", text: r.row.author ?? "" }));
    const bar = el("div", { class: "ui-bar" }); const fill = el("i", {}); fill.style.width = `${pct}%`; bar.append(fill);
    info.append(bar, el("div", { class: "ui-cap", text: cap }));
    if (r.canonical) info.append(el("div", { class: "ui-resume-line", text: `Resume · ${positionLabel(r.bookId, r.canonical.occurrenceId, r.canonical.offsetSec)}` }));
    main.append(el("div", { class: "ui-card ui-book", id: `book-row-${r.bookId}` },
      el("div", { class: "ui-tile ui-tile-sm", text: initialsFor(r.book.title) }),
      info,
      el("button", { class: "ui-btn ui-btn-soft", text: "Open", id: `open-${r.bookId}`, onclick: () => show("book", r.bookId) })));
  }
}

// ------------------------------------------------------------ Book
async function renderBook(bookId) {
  currentBookId = bookId;
  if (!openedBooks.includes(bookId)) openedBooks.push(bookId);
  const book = contentEntities()[bookId]?.payload;
  if (!book) { main.append(el("p", { class: "v2error", text: "That book is not cached on this device." })); return; }
  successorOf = (tok) => computeSuccessor(tok);
  main.append(el("button", { class: "ui-btn ui-btn-soft", text: "‹ Library", id: "book-back", onclick: () => show("library") }));
  const flat = flattenSegments(bookId);
  let boundTotal = 0;
  for (const s of flat) if (bindingFor(bookId, s.occurrenceId)) boundTotal++;
  const unboundTotal = flat.length - boundTotal;
  let canonical = null;
  try { canonical = (await run.candidate.playerSurfaces.positionModel(bookId)).canonical; } catch {}
  const currentOcc = run?.player?.current?.bookId === bookId ? run.player.current.occurrenceId : null;
  const pct = flat.length ? Math.round((boundTotal / flat.length) * 100) : 0;
  const headInfo = el("div", { class: "v2grow" },
    el("h1", { text: book.title ?? bookId }),
    el("div", { class: "ui-author", text: book.author ?? "" }),
    el("div", { class: "ui-cap", text: `${(book.chapters ?? []).length} chapters · ${boundTotal} with audio` }));
  const hbar = el("div", { class: "ui-bar" }); const hfill = el("i", {}); hfill.style.width = `${pct}%`; hbar.append(hfill);
  headInfo.append(hbar);
  main.append(el("div", { class: "ui-card ui-bookhead", id: "book-head" },
    el("div", { class: "ui-tile ui-tile-head", text: initialsFor(book.title) }), headInfo));

  // Actions card — collapsible to the Saved-position / Resume strip.
  const castModel = castModelFor(book);
  const inc = bindingsIncomplete();
  const actionsOpen = actionsOpenFor(bookId);
  const resumeBinding = canonical ? bindingFor(bookId, canonical.occurrenceId) : null;
  const resumeLab = el("div", { class: "ui-lab" },
    el("b", { text: "Saved position" }),
    el("span", { id: "book-resume-label", text: canonical ? positionLabel(bookId, canonical.occurrenceId, canonical.offsetSec) : "No saved position yet" }));
  const resumeBtn = el("button", { class: "ui-btn ui-btn-plum", id: "book-resume", text: "Resume" });
  if (canonical && resumeBinding) resumeBtn.addEventListener("click", () => { void selectSegment({ bookId, occurrenceId: canonical.occurrenceId, ...resumeBinding }, { restoreOffset: canonical.offsetSec, autoplay: true }); });
  else resumeBtn.disabled = true;
  const chevBtn = el("button", { class: "ui-chevbtn", id: "book-actions-toggle", "aria-controls": "book-actions-more" },
    el("span", { class: "ui-chev" }));
  chevBtn.setAttribute("aria-expanded", String(actionsOpen));
  chevBtn.setAttribute("aria-label", "More actions for this book");
  const genAllLab = el("div", { class: "ui-lab" }, el("b", { text: "Generate all" }),
    el("span", { id: "book-genall-count", text: inc ? "Audio index still syncing" : `${unboundTotal} segment${unboundTotal === 1 ? "" : "s"} without audio` }));
  const genAllBtn = el("button", { class: "ui-btn ui-btn-soft", id: "book-genall", text: "Generate",
    onclick: () => openGenSheet({ bookId, scope: "book", title: "Generate all missing audio",
      sub: `${book.title ?? ""} — the rest of the book`,
      voices: castModel.available ? `Book's cast — ${castModel.total} voices set` : "Book's cast" }) });
  if (inc || unboundTotal === 0) genAllBtn.disabled = true;
  const castLab = el("div", { class: "ui-lab" }, el("b", { text: "Cast" }),
    el("span", { id: "book-cast-summary", text: castModel.available ? `${castModel.total} voices · ${castModel.attention} to check` : "Cast data isn't carried for this book" }));
  const castBtn = el("button", { class: "ui-btn ui-btn-soft", id: "book-cast", text: "Review", onclick: () => show("cast", bookId) });
  if (!castModel.available) castBtn.disabled = true;
  const linked = typeof book.shelfReadId === "string" && book.shelfReadId.length > 0;
  const shelfLab = el("div", { class: "ui-lab" }, el("b", { text: "Shelf" }),
    el("span", { text: linked ? "Linked to your Shelf" : "Not linked to Shelf" }));
  const shelfRow = el("div", { class: "ui-srow" }, shelfLab,
    el("span", { class: `ui-pill ${linked ? "ui-pill-teal" : "ui-pill-lav"}`, id: "book-shelf-pill", text: linked ? "Linked" : "Not linked" }));
  if (linked) {
    const a = el("a", { class: "ui-btn ui-btn-soft", id: "book-shelf-open", href: `${SHELF_BASE.url}/`, target: "_blank", rel: "noopener", text: "Open in Shelf" });
    a.style.textDecoration = "none"; a.style.display = "inline-grid"; a.style.placeItems = "center";
    shelfRow.append(a);
  } else {
    // The Link action itself is NOT part of this build (separately
    // gated Shelf-side work); the row shows the state truthfully.
    const lb = el("button", { class: "ui-btn ui-btn-soft", id: "book-shelf-link", text: "Link", disabled: "", title: "Linking is a separate step — not part of this build" });
    lb.setAttribute("aria-disabled", "true");
    shelfRow.append(lb);
  }
  const more = el("div", { id: "book-actions-more" },
    el("div", { class: "ui-srow" }, genAllLab, genAllBtn),
    el("div", { class: "ui-srow" }, castLab, castBtn),
    shelfRow);
  more.hidden = !actionsOpen;
  const actions = el("div", { class: `ui-card ui-panel${actionsOpen ? " ui-open" : ""}`, id: "book-actions" },
    el("div", { class: "ui-srow" }, resumeLab, resumeBtn, chevBtn), more);
  chevBtn.addEventListener("click", () => {
    const open = more.hidden;
    more.hidden = !open;
    actions.classList.toggle("ui-open", open);
    chevBtn.setAttribute("aria-expanded", String(open));
    const p = readUiPrefs(); p.actionsOpen = { ...(p.actionsOpen ?? {}), [bookId]: open }; writeUiPrefs(p);
  });
  main.append(actions);
  // gen-pkg-1: this book's generation plans from the server's
  // read surface — display only; starting work goes through the
  // confirm sheet, and there is no resume control anywhere.
  const genSect = el("section", { class: "ui-card", id: "book-generation" });
  const genSectBody = el("div", { id: "book-generation-body", text: "Checking generation…" });
  genSect.append(el("h2", { class: "ui-h", text: "Generation" }), genSectBody);
  main.append(genSect);
  void (async () => {
    if (!genClient) { genSectBody.textContent = "Connect to see generation."; return; }
    try {
      const plans = (await genClient.listAllPlans()).filter((p) => p.bookId === bookId);
      genSectBody.replaceChildren();
      if (!plans.length) genSectBody.append(el("div", { class: "ui-dim", text: "Nothing generated for this book yet." }));
      for (const p of plans.slice(0, 5)) genSectBody.append(genPlanLine(p));
      genSectBody.append(el("button", { class: "ui-btn ui-btn-soft", text: "Open generation view",
        onclick: () => show("generation", bookId) }));
      if (plans.some((p) => !isTerminalPlanState(p.state))) {
        if (genPollTimer) clearInterval(genPollTimer);
        genPollTimer = setInterval(() => { if (currentScreen === "book" && genSectBody.isConnected) show("book", bookId); }, 15000);
      }
    } catch { genSectBody.textContent = "Generation status unavailable right now."; }
  })();

  main.append(el("div", { class: "ui-sect", text: "Chapters" }));
  for (const ch of book.chapters ?? []) {
    const model = await run.candidate.library.chapterModel(bookId, ch.chapterId);
    const rowModel = screens.chapterRowModel(model);
    const segs = ch.segments ?? [];
    const boundInCh = segs.filter((s) => bindingFor(bookId, s.occurrenceId)).length;
    const unboundInCh = segs.length - boundInCh;
    const povsInCh = [...new Set(segs.map((s) => s.pov).filter(Boolean))];
    const containsCurrent = segs.some((s) => s.occurrenceId === (currentOcc ?? canonical?.occurrenceId));
    const openDefault = containsCurrent || (book.chapters[0] === ch && !canonical && !currentOcc);
    const open = chapterOpenFor(bookId, ch.chapterId, openDefault);
    const pillClass = rowModel.label === "Complete" ? "ui-pill-teal" : rowModel.label === "Sync incomplete" ? "ui-pill-amber" : "ui-pill-lav";
    const headBtn = el("button", { class: "ui-chap-head", id: `chap-toggle-${ch.chapterId}`, "aria-controls": `chap-body-${ch.chapterId}` },
      el("h4", { text: `Chapter ${ch.index + 1}` }),
      ...(povsInCh.length === 1 ? [el("span", { class: "ui-pov", text: povsInCh[0] })] : []),
      el("span", { class: `ui-pill ${pillClass}`, text: rowModel.text }),
      el("span", { class: "ui-chev" }));
    headBtn.setAttribute("aria-expanded", String(open));
    const body = el("div", { id: `chap-body-${ch.chapterId}` });
    body.hidden = !open;
    segs.forEach((seg, si) => {
      const b = bindingFor(bookId, seg.occurrenceId);
      const isHere = canonical?.occurrenceId === seg.occurrenceId || currentOcc === seg.occurrenceId;
      const rowEl = el("div", { class: `ui-seg${isHere ? " now" : ""}`, id: `seg-${seg.occurrenceId}` });
      rowEl.dataset.occurrenceId = seg.occurrenceId;
      rowEl.append(el("span", { class: "ui-nm", text: `Segment ${si + 1}` }));
      if (seg.pov) rowEl.append(el("span", { class: "ui-cap", text: seg.pov }));
      if (isHere) rowEl.append(el("span", { class: "ui-where", text: "YOU ARE HERE" }));
      if (b) {
        const pb = el("button", { class: `ui-play${isHere ? " fill" : ""}`, id: `play-${seg.occurrenceId}` },
          playTriangle(isHere ? "#fff" : "#4a315c"));
        pb.setAttribute("aria-label", `Play segment ${si + 1} of chapter ${ch.index + 1}`);
        pb.addEventListener("click", () => { void selectSegment({ bookId, occurrenceId: seg.occurrenceId, ...b }, { autoplay: true }); });
        rowEl.append(pb);
      } else if (inc) {
        rowEl.append(el("span", { class: "ui-noaudio", id: `seg-state-${seg.occurrenceId}`, text: "Not checked yet" }));
      } else {
        rowEl.append(el("span", { class: "ui-noaudio", id: `seg-state-${seg.occurrenceId}`, text: "No audio yet" }));
        const gb = el("button", { class: "ui-genplus", id: `gen-seg-${seg.occurrenceId}` }, plusGlyph());
        gb.setAttribute("aria-label", `Generate segment ${si + 1} of chapter ${ch.index + 1}`);
        gb.addEventListener("click", () => openGenSheet({ bookId, scope: "segment", occurrenceId: seg.occurrenceId, title: `Generate Segment ${si + 1}`,
          sub: `${book.title ?? ""} — Chapter ${ch.index + 1} · Segment ${si + 1}`,
          voices: castModel.available ? `Book's cast — ${castModel.total} voices set` : "Book's cast" }));
        rowEl.append(gb);
      }
      body.append(rowEl);
    });
    if (inc) {
      body.append(el("div", { class: "ui-chapfoot", id: `chap-foot-${ch.chapterId}` },
        el("span", { class: "ui-t", text: "Still syncing — some segments aren't checked yet" })));
    } else if (unboundInCh > 0) {
      const gb = el("button", { class: "ui-btn ui-btn-plum", id: `gen-chap-${ch.chapterId}`, text: "Generate",
        onclick: () => openGenSheet({ bookId, scope: "chapter", chapterIndex: book.chapters.indexOf(ch), title: `Generate Chapter ${ch.index + 1}`,
          sub: `${book.title ?? ""} — Chapter ${ch.index + 1}`,
          voices: castModel.available ? `Book's cast — ${castModel.total} voices set` : "Book's cast" }) });
      body.append(el("div", { class: "ui-chapfoot", id: `chap-foot-${ch.chapterId}` },
        el("span", { class: "ui-t", text: `${unboundInCh} segment${unboundInCh === 1 ? "" : "s"} without audio` }), gb));
    }
    const card = el("div", { class: `ui-card ui-chap${open ? " ui-open" : ""}`, id: `chap-${ch.chapterId}` }, headBtn, body);
    headBtn.addEventListener("click", () => {
      const nowOpen = body.hidden;
      body.hidden = !nowOpen;
      card.classList.toggle("ui-open", nowOpen);
      headBtn.setAttribute("aria-expanded", String(nowOpen));
      const p = readUiPrefs(); p.chaptersOpen = { ...(p.chaptersOpen ?? {}), [`${bookId}|${ch.chapterId}`]: nowOpen }; writeUiPrefs(p);
    });
    main.append(card);
  }
}

async function selectSegment(token, opts) {
  let refusal = "";
  try {
    const r = await run.player.select(token, opts);
    if (r && r.attached === false) refusal = `selection refused: ${r.error?.code ?? r.code ?? "unknown"}`;
  } catch (e) { refusal = `selection refused: ${e?.code ?? e?.message ?? e}`; }
  // UI4 (Rowan condition (c)): playback mutates the state record
  // through the storage backend; refresh the shell snapshot
  // before re-rendering status so on-screen counts reflect what
  // actually landed.
  await refreshStateSnapshot();
  refreshPlayerStatus(refusal);
}

// ------------------------------------------------------------ Cast (per book)
function renderCast(bookId) {
  currentBookId = bookId;
  const book = contentEntities()[bookId]?.payload;
  main.append(el("button", { class: "ui-btn ui-btn-soft", text: "‹ Book", id: "cast-back", onclick: () => show("book", bookId) }));
  if (!book) { main.append(el("p", { class: "v2error", text: "That book is not cached on this device." })); return; }
  main.append(el("h1", { text: "Cast" }),
    el("div", { class: "ui-sync", text: `Voice assignments for ${book.title ?? bookId}` }));
  const model = castModelFor(book);
  main.append(el("div", { class: "ui-sect", text: "Style notes" }));
  // The content plane carries NO book-level style field (the v1
  // defaultVoice was not carried by the migration transform), so the
  // book-wide card states that plainly instead of inventing a note.
  // Per-character style lines come from each cast voice's own
  // style_direction, below.
  main.append(el("div", { class: "ui-card ui-note", id: "cast-style-book" },
    el("div", { class: "ui-style", text: "No book-wide style note is carried in this book's data." }),
    el("div", { class: "ui-cap", text: "Per-character style notes are listed with each voice below." })));
  if (!model.available) {
    main.append(el("div", { class: "ui-card ui-note", id: "cast-unavailable",
      text: "Cast data isn't carried for this book in this client's data — nothing to show, and nothing invented." }));
    return;
  }
  const search = el("input", { type: "search", id: "cast-search" });
  search.setAttribute("aria-label", "Search cast");
  search.setAttribute("placeholder", "Search cast");
  main.append(el("div", { class: "ui-search" }, search));
  main.append(el("div", { class: "ui-sect", text: "Voices" }));
  const panel = el("div", { class: "ui-card ui-panel", id: "cast-list" });
  for (const r of model.rows) {
    const lab = el("div", { class: "ui-lab" }, el("b", { text: r.name }));
    if (r.voice) lab.append(el("span", { class: "ui-vchip", text: `${providerLabel(r.voice.provider)} · ${r.voice.name ?? ""}` }));
    else lab.append(el("span", { class: "ui-cap", text: "No voice recorded" }));
    if (r.voice?.style) lab.append(el("div", { class: "ui-cap", text: `Style: ${r.voice.style}` }));
    if (r.mapping) {
      const ml = el("div", { class: "ui-mapline", text: `Recorded mapping: Gemini ${r.mapping.voiceName}` });
      lab.append(ml);
    }
    const rowEl = el("div", { class: "ui-srow", id: `cast-row-${r.povId ?? r.name}` });
    rowEl.dataset.name = r.name;
    if (r.povId) rowEl.dataset.povId = r.povId;
    rowEl.append(lab);
    if (!r.voice) rowEl.append(el("span", { class: "ui-pill ui-pill-amber", text: "Needs a voice" }));
    if (r.mapping?.unverified) rowEl.append(el("span", { class: "ui-pill ui-pill-amber", id: `cast-flag-${r.povId}`, text: "Match not verified" }));
    if (r.voice && r.voice.provider !== "gemini" && !r.mapping) rowEl.append(el("span", { class: "ui-pill ui-pill-amber", text: "No mapping recorded" }));
    const tryBtn = el("button", { class: "ui-play", id: `cast-try-${r.povId ?? r.name}` }, playTriangle("#4a315c"));
    tryBtn.setAttribute("aria-label", `Try ${r.name}'s voice (not available yet)`);
    tryBtn.addEventListener("click", () => openVoiceSheet(r.name, r.voice?.style ?? null));
    const chBtn = el("button", { class: "ui-btn ui-btn-soft", id: `cast-change-${r.povId ?? r.name}`, text: "Change",
      onclick: () => openVoiceSheet(r.name, r.voice?.style ?? null) });
    rowEl.append(tryBtn, chBtn);
    panel.append(rowEl);
  }
  main.append(panel);
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const rowEl of panel.children) rowEl.style.display = !q || rowEl.dataset.name.toLowerCase().includes(q) ? "" : "none";
  });
  main.append(el("div", { class: "ui-card ui-note", id: "cast-law",
    text: "Audio already made in older voices keeps playing exactly as it is. If a voice ever needs replacing, the app asks you first — it never swaps a voice silently." }));
}

// ------------------------------------------------------------ Find text (F10)
function renderFindText() {
  const input = el("input", { type: "search", id: "find-input" });
  input.setAttribute("aria-label", "Search text in segments");
  const results = el("div", { id: "find-results" });
  main.append(el("div", { class: "ui-brand", text: "Find text" }),
    el("div", { class: "ui-sync", text: "Search inside your books" }),
    el("div", { class: "ui-search" }, input, el("button", {
      class: "ui-btn ui-btn-plum", text: "Search", id: "find-go",
      onclick: async () => {
        clear(results);
        const q = input.value;
        const hits = await run.candidate.findText(q, {});
        if (hits.length === 0) { results.append(el("p", { class: "v2muted", text: "No matches." })); return; }
        for (const h of hits) {
          const book = contentEntities()[h.bookId]?.payload;
          const loc = locateSegment(h.bookId, h.occurrenceId);
          const locText = loc && book
            ? `${book.title ?? h.bookId} · Chapter ${loc.chapterIndex + 1} · Segment ${loc.segmentIndex + 1}`
            : `${h.bookId} · ${h.chapterId} · ${h.occurrenceId}`;
          const snip = el("div", { class: "ui-snip" });
          const text = String(h.snippet ?? "");
          const needle = q.trim().toLowerCase();
          if (needle) {
            let rest = text;
            for (;;) {
              const i = rest.toLowerCase().indexOf(needle);
              if (i < 0) { snip.append(document.createTextNode(rest)); break; }
              if (i > 0) snip.append(document.createTextNode(rest.slice(0, i)));
              snip.append(el("mark", { text: rest.slice(i, i + needle.length) }));
              rest = rest.slice(i + needle.length);
            }
          } else snip.append(document.createTextNode(text));
          results.append(el("div", { class: "ui-card ui-hit" },
            el("div", { class: "ui-loc", text: locText }),
            el("div", { class: "ui-ids", text: `${h.chapterId} · ${h.occurrenceId}` }),
            snip));
        }
      },
    })), results);
}

// ------------------------------------------------------------ Settings (incl. Diagnostics section)
function diagDotFor(key, value) {
  const v = String(value);
  let cls = null;
  if (key === "Bindings sync" || key === "Content sync") cls = v.includes("COMPLETE") && !v.includes("INCOMPLETE") ? "ok" : v.includes("not synced") ? "warn" : "warn";
  else if (key === "Last Shelf flush") cls = v.includes("pending") && !v.startsWith("sent 0, covered 0, carved 0 — 0 pending") ? "warn" : "ok";
  else if (key === "Shelf attribution") cls = v.includes("not attributed") || v.includes("no books") ? "warn" : "ok";
  else if (key === "Access") cls = v.includes("connected") ? "ok" : "warn";
  if (!cls) return null;
  const d = el("span", { class: `ui-dot ${cls}` });
  d.setAttribute("aria-hidden", "true");
  return d;
}
async function buildDiagnosticsSection(container) {
  await refreshStateSnapshot();
  const gate = run ? run.writeGateState() : null;
  try { lastDiagnostics = run ? await run.candidate.diagnostics(openedBooks) : null; } catch { lastDiagnostics = null; }
  const d = lastDiagnostics;
  const rows = [
    ["Build marker", d?.buildMarker ?? CANDIDATE_BUILD_MARKER, "diag-build-marker"],
    ["Packaging marker", PACKAGING_MARKER, "diag-packaging-marker"],
    ["Access", tokenHeld ? "access: connected (token in memory)" : "not connected", "diag-access"],
    ["Worker host (live)", d?.baseHost ?? "—", "diag-base-host"],
    ["Compiled production service", PRODUCTION_BASE_HOST, "diag-compiled-host"],
    ["Effective API destination", API_BASE.host, "diag-effective-host"],
    ["API destination override", API_BASE.overrideActive ? "TEST OVERRIDE (loopback only) — not the production service" : API_BASE.rejected ? "rejected (non-loopback) — compiled production in use" : "none", "diag-api-override"],
    ["Effective Shelf destination", SHELF_BASE.host, "diag-shelf-host"],
    ["Shelf destination override", SHELF_BASE.overrideActive ? "TEST OVERRIDE (loopback only) — not the production service" : SHELF_BASE.rejected ? "rejected (non-loopback) — compiled production in use" : "none", "diag-shelf-override"],
    ["Shelf sessions pending (bridge queue)", d ? String(d.shelfPending) : String(shelfOutboxCount()), "diag-shelf-pending"],
    ["Current book Shelf read ID", currentBookId ? (shelfReadIdFor(currentBookId) ?? "none — sessions are not attributed for this book") : "no book opened", "diag-shelf-readid"],
    ["Bindings sync", syncRowText("bindings"), "diag-sync-bindings"],
    ["Content sync", syncRowText("content"), "diag-sync-content"],
    ["Last Shelf flush", lastShelfFlush ? flushRowText(lastShelfFlush) : "not run yet this session", "diag-shelf-flush"],
    ["Shelf attribution", shelfAttributionText(), "diag-shelf-attribution"],
    ["Scope", d?.scope ?? V2_SCOPE, "diag-scope"],
    ["Instance", d?.instance ?? V2_INSTANCE, "diag-instance"],
    ["State storage", storageRowText(), "diag-state-storage"],
    ["Device", run?.deviceId ?? "—", "diag-device"],
    ["Writes enabled (Table C gate)", gate ? String(gate.writesEnabled) : "—", "diag-writes"],
    ["Preflight", gate ? `${gate.preflight.status}${gate.preflight.step ? ` at ${gate.preflight.step}` : ""}${gate.preflight.code ? ` (${gate.preflight.code})` : ""}` : "—", "diag-preflight"],
    ["Durability", DURABILITY_STATEMENT, "diag-durability"],
  ];
  const panel = el("div", { class: "ui-card ui-panel" });
  for (const [k, v, id] of rows) {
    const row = el("div", { class: "ui-srow" });
    const dot = diagDotFor(k, v);
    if (dot) row.append(dot);
    row.append(el("div", { class: "ui-lab" }, el("b", { text: k }), el("span", { id, text: String(v) })));
    panel.append(row);
  }
  container.append(panel);
  if (gate?.preflight?.steps && Object.keys(gate.preflight.steps).length)
    container.append(el("h3", { text: "Table C preflight steps" }),
      el("pre", { id: "diag-preflight-steps", text: JSON.stringify(gate.preflight.steps, null, 2) }));
  if (run) {
    const sl = run.shelfLifecycleState();
    container.append(el("h3", { text: "Lifecycle" }),
      el("pre", { id: "diag-lifecycle", text: JSON.stringify({ phase: sl.phase, closed: sl.closed, pendingSync: sl.pendingSync }, null, 2) }));
  }
  if (d) container.append(el("h3", { text: "Per-book positions" }), el("pre", { id: "diag-books", text: JSON.stringify(d.perBook, null, 2) }));
}

async function renderSettings(anchor) {
  main.append(el("div", { class: "ui-brand", text: "Settings" }),
    el("div", { class: "ui-sync", text: "Connected · production" }));
  main.append(el("div", { class: "ui-sect", text: "Reading" }));
  try {
    const settings = await run.candidate.settingsRead.settingsModel();
    const quota = await run.candidate.settingsRead.quotaModel();
    const view = screens.settingsModelView(settings, quota);
    const data = view.settings ?? {};
    const panel = el("div", { class: "ui-card ui-panel" },
      el("div", { class: "ui-srow" }, el("div", { class: "ui-lab" }, el("b", { text: "Monthly cap" }), el("span", { text: "Spending limit for new audio" })),
        el("span", { class: "ui-val", id: "settings-cap", text: typeof data.monthlyCap === "number" ? `$${data.monthlyCap}` : "—" })),
      el("div", { class: "ui-srow" }, el("div", { class: "ui-lab" }, el("b", { text: "Gemini attempts" }), el("span", { text: "Quota counter (kept from the accepted client)" })),
        el("span", { class: "ui-val", id: "settings-quota", text: quota?.text ?? "Quota unavailable" })));
    if (typeof data.geminiLane === "string")
      panel.append(el("div", { class: "ui-srow" }, el("div", { class: "ui-lab" }, el("b", { text: "Gemini lane (server setting)" }),
        el("span", { text: data.geminiLane === "batch" ? "Batch is recorded server-side; it is not armed by this client" : "Standard generation lane" })),
        el("span", { class: "ui-val", id: "settings-lane", text: data.geminiLane })));
    main.append(panel);
    const det = el("details", {}, el("summary", { text: "Settings data (read-only)" }),
      el("pre", { id: "settings-view", text: JSON.stringify(view, null, 2) }));
    main.append(det);
  } catch (e) {
    main.append(el("p", { class: "v2error", text: `Settings could not be read (${e?.code ?? e?.message ?? e}).` }));
  }
  main.append(el("div", { class: "ui-sect", text: "Backup" }));
  const dlBtn = el("button", { class: "ui-btn ui-btn-soft", id: "settings-backup-download", text: "Download", disabled: "" });
  dlBtn.setAttribute("aria-disabled", "true");
  const rsBtn = el("button", { class: "ui-btn ui-btn-soft", id: "settings-backup-restore", text: "Restore", disabled: "" });
  rsBtn.setAttribute("aria-disabled", "true");
  main.append(el("div", { class: "ui-card ui-panel" },
    el("div", { class: "ui-srow" }, el("div", { class: "ui-lab" }, el("b", { text: "Download backup" }), el("span", { text: "Library, positions, and settings — no audio" })), dlBtn),
    el("div", { class: "ui-srow" }, el("div", { class: "ui-lab" }, el("span", { text: "Backup and restore aren't part of this build yet.", id: "settings-backup-note" })), rsBtn)));
  const diagSect = el("div", { id: "settings-diagnostics" });
  main.append(el("div", { class: "ui-sect", text: "Diagnostics" }), diagSect);
  await buildDiagnosticsSection(diagSect);
  main.append(el("div", { class: "ui-sect", text: "Connection" }));
  main.append(el("div", { class: "ui-card ui-panel" },
    el("div", { class: "ui-srow" }, el("div", { class: "ui-lab" }, el("b", { text: "Reconnect" }), el("span", { text: "Re-enter your access code and sync" })),
      el("button", { class: "ui-btn ui-btn-plum", id: "settings-reconnect", text: "Connect", onclick: () => window.location.reload() }))));
  if (anchor === "diagnostics") { try { diagSect.scrollIntoView(); } catch {} }
}

// ------------------------------------------------------------ boot
show("access");
refreshPlayerStatus();
// Proof/introspection handle: markers and state readouts, plus ONE
// explicitly-named diagnostic action (attemptShelfFlush) so the
// packaged proof can capture the composition's gate fence refusing a
// Shelf flush while the Table C gate is closed, and the same call
// succeeding once it is open. No token is exposed, and no other
// mutation method exists on this handle; it is not a UI control.
window.__opalReaderV2 = {
  packagingMarker: PACKAGING_MARKER,
  buildMarker: CANDIDATE_BUILD_MARKER,
  screen: () => currentScreen,
  writeGateState: () => (run ? run.writeGateState() : null),
  playerState: () => (run?.player ? { state: run.player.state, current: run.player.current, records: run.player.records } : null),
  connected: () => tokenHeld,
  effectiveApiBase: () => BASE_URL,
  effectiveShelfBase: () => SHELF_API_BASE,
  apiOverride: () => ({ ...API_BASE }),
  shelfOverride: () => ({ ...SHELF_BASE }),
  shelfReadIdFor: (bookId) => shelfReadIdFor(bookId),
  shelfPendingCount: () => shelfOutboxCount(),
  shelfLifecycleState: () => (run ? run.shelfLifecycleState() : null),
  syncSummary: () => lastSync,
  storageInfo: () => (run?.storageHealth ? run.storageHealth() : { backend: stateSnapshotBackend }),
  storageGuard: () => lastStorageGuard,
  stateRecord: () => readStateRecord(),
  refreshStateSnapshot: () => refreshStateSnapshot(),
  lastShelfFlush: () => lastShelfFlush,
  castModel: (bookId) => castModelFor(contentEntities()[bookId]?.payload ?? {}),
  uiPrefs: () => readUiPrefs(),
  generationInfo: () => ({
    connected: !!genClient,
    sheetOpen: !genSheet.hidden,
    sheetScope: genCtx?.scope ?? null,
    sheetLane: genCtx?.lane ?? null,
    sheetPlanId: genCtx?.planId ?? null,
  }),
  attemptShelfFlush: async () => {
    if (!run) return { refused: true, code: "not_connected" };
    try { return { refused: false, result: await run.candidate.shelfBridge.flush() }; }
    catch (e) { return { refused: true, code: e?.code ?? e?.message ?? "flush_refused" }; }
  },
};
