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
import { createRunnableClient, createAudioTransport } from "./modules/entry-corr1.js";
import * as screens from "./modules/screens.js";
import {
  CANDIDATE_BUILD_MARKER, PRODUCTION_BASE_URL, PRODUCTION_BASE_HOST,
  V2_SCOPE, V2_INSTANCE, DURABILITY_STATEMENT, STATE_KEY, SHELF_KEY,
} from "./modules/constants-corr1.js";

const PACKAGING_MARKER = "corr-pkg-1";
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
  navigator.serviceWorker.register("./sw-corr1.js").catch(() => {});
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
let lastShelfFlush = null; // CORR1: redacted summary of the last Shelf flush result
let successorOf = () => null; // legacy seam, unused: auto-next reads the player's live selection (see connectWith)

const media = document.createElement("audio");
media.preload = "auto";
media.id = "v2-audio";

function readStateRecord() {
  try { return JSON.parse(window.localStorage.getItem(STATE_KEY) || "null"); } catch { return null; }
}
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
const nav = el("nav", { id: "v2-nav" });
const main = el("main", { id: "v2-main" });
const playerBar = el("div", { id: "v2playerbar" });
playerBar.append(media);
const playerStatus = el("div", { id: "player-status", class: "v2muted", text: "Player idle." });
const seek = el("input", { type: "range", id: "player-seek", min: "0", max: "0", step: "0.1", value: "0" });
const playBtn = el("button", { id: "player-playpause", class: "v2btn", text: "Play" });
const rateSel = el("select", { id: "player-rate" },
  ...["0.75", "1", "1.25", "1.5", "2"].map((r) => el("option", { value: r, text: `${r}×` })));
rateSel.value = "1";
const controlsRow = el("div", { class: "v2row" }, playBtn, seek, rateSel);
playerBar.append(controlsRow, playerStatus);
root.append(nav, main, playerBar);

function renderNav() {
  clear(nav);
  if (!tokenHeld) return;
  for (const [id, label] of [["library", "Library"], ["findText", "Find text"], ["settings", "Settings"], ["diagnostics", "Diagnostics"]]) {
    const b = el("button", { text: label, id: `nav-${id}`, onclick: () => show(id) });
    if (currentScreen === id) b.setAttribute("aria-current", "page");
    nav.append(b);
  }
}
function show(screen, arg) {
  currentScreen = screen;
  renderNav();
  clear(main);
  if (screen === "access") return renderAccess();
  if (screen === "library") return renderLibrary();
  if (screen === "book") return renderBook(arg);
  if (screen === "findText") return renderFindText();
  if (screen === "settings") return renderSettings();
  if (screen === "diagnostics") return renderDiagnostics();
}

function refreshPlayerStatus(extra = "") {
  if (!run?.player) { playerStatus.textContent = "Player idle."; return; }
  const p = run.player;
  const cur = p.current;
  const last = p.records?.[p.records.length - 1];
  playerStatus.textContent =
    `Player: ${p.state}` +
    (cur ? ` · segment ${cur.occurrenceId} · ${media.currentTime.toFixed(1)}s / ${Number.isFinite(media.duration) ? media.duration.toFixed(1) : "?"}s` : "") +
    (last?.code ? ` · last event: ${last.code}` : "") + (extra ? ` · ${extra}` : "");
  playBtn.textContent = p.state === "playing" ? "Pause" : "Play";
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

// ------------------------------------------------------------ Library / Book
async function renderLibrary() {
  main.append(el("h1", { text: "Library" }));
  // CORR1: an incomplete sync is announced on the library itself,
  // with the resumable counts — not buried in Diagnostics.
  if (lastSync?.some((d) => d && d.complete === false)) {
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
  for (const bookId of ids) {
    const book = ents[bookId].payload;
    const flat = flattenSegments(bookId);
    let bound = 0;
    for (const s of flat) if (bindingFor(bookId, s.occurrenceId)) bound++;
    let canonical = null;
    try { canonical = (await run.candidate.playerSurfaces.positionModel(bookId)).canonical; } catch {}
    const row = screens.libraryRowModel(book, (book.chapters ?? []).length, { bound, unbound: flat.length - bound }, canonical);
    const div = el("div", { class: "v2row", id: `book-row-${bookId}` },
      el("span", { class: "v2grow" },
        el("strong", { text: row.title ?? bookId }),
        document.createTextNode(` — ${row.author ?? ""} · ${row.chapterCount} chapters · ${row.bound} with audio · ${row.unbound} ${bindingsIncomplete() ? "not yet synced" : "not generated"}`)),
      el("button", { class: "v2btn", text: "Open", id: `open-${bookId}`, onclick: () => show("book", bookId) }));
    if (row.resume) div.append(el("span", { class: "v2muted", text: `Resume at segment ${row.resume.occurrenceId}, ${row.resume.offsetSec.toFixed(1)}s` }));
    main.append(div);
  }
}

async function renderBook(bookId) {
  currentBookId = bookId;
  if (!openedBooks.includes(bookId)) openedBooks.push(bookId);
  const book = contentEntities()[bookId]?.payload;
  if (!book) { main.append(el("p", { class: "v2error", text: "That book is not cached on this device." })); return; }
  successorOf = (tok) => computeSuccessor(tok);
  main.append(el("h1", { text: book.title ?? bookId }),
    el("button", { class: "v2btn", text: "Back to Library", onclick: () => show("library") }));
  let canonical = null;
  try { canonical = (await run.candidate.playerSurfaces.positionModel(bookId)).canonical; } catch {}
  if (canonical) {
    const b = bindingFor(bookId, canonical.occurrenceId);
    main.append(el("div", { class: "v2row", id: "book-resume-row" },
      el("span", { class: "v2grow", text: `Saved position: segment ${canonical.occurrenceId} at ${canonical.offsetSec.toFixed(1)}s` }),
      el("button", {
        class: "v2btn", id: "book-resume", text: "Resume",
        onclick: () => { if (b) void selectSegment({ bookId, occurrenceId: canonical.occurrenceId, ...b }, { restoreOffset: canonical.offsetSec, autoplay: true }); },
      })));
  }
  for (const ch of book.chapters ?? []) {
    const model = await run.candidate.library.chapterModel(bookId, ch.chapterId);
    const rowModel = screens.chapterRowModel(model);
    main.append(el("h2", { text: `Chapter ${ch.index + 1} — ${rowModel.text}` }));
    for (const seg of ch.segments ?? []) {
      const b = bindingFor(bookId, seg.occurrenceId);
      const div = el("div", { class: "v2row", id: `seg-${seg.occurrenceId}` },
        el("span", { class: "v2grow", text: `Segment ${seg.occurrenceId}` }),
        b ? el("button", {
          class: "v2btn", text: "Play", id: `play-${seg.occurrenceId}`,
          onclick: () => { void selectSegment({ bookId, occurrenceId: seg.occurrenceId, ...b }, { autoplay: true }); },
        }) : el("span", { class: "v2muted", text: bindingsIncomplete() ? "not yet synced — reconnect to finish loading the audio index" : screens.playerModel({ state: "idle", token: null, offsetSec: 0 }).unboundText }));
      main.append(div);
    }
  }
}

async function selectSegment(token, opts) {
  try {
    const r = await run.player.select(token, opts);
    if (r && r.attached === false) refreshPlayerStatus(`selection refused: ${r.error?.code ?? r.code ?? "unknown"}`);
    else refreshPlayerStatus();
  } catch (e) { refreshPlayerStatus(`selection refused: ${e?.code ?? e?.message ?? e}`); }
}

// ------------------------------------------------------------ Find text (F10)
function renderFindText() {
  const input = el("input", { type: "search", id: "find-input" });
  const results = el("div", { id: "find-results" });
  main.append(el("h1", { text: "Find text in segments" }),
    el("div", {}, input, el("button", {
      class: "v2btn", text: "Search", id: "find-go",
      onclick: async () => {
        clear(results);
        const hits = await run.candidate.findText(input.value, {});
        if (hits.length === 0) { results.append(el("p", { class: "v2muted", text: "No matches." })); return; }
        for (const h of hits)
          results.append(el("div", { class: "v2row" },
            el("span", { class: "v2grow", text: `${h.bookId} · ${h.chapterId} · ${h.occurrenceId} — ${h.snippet}` })));
      },
    })), results);
}

// ------------------------------------------------------------ Settings (read-only)
async function renderSettings() {
  main.append(el("h1", { text: "Settings" }),
    el("p", { class: "v2muted", text: "Read-only in this client. There are no settings edits here." }));
  try {
    const settings = await run.candidate.settingsRead.settingsModel();
    const quota = await run.candidate.settingsRead.quotaModel();
    const view = screens.settingsModelView(settings, quota);
    main.append(el("pre", { id: "settings-view", text: JSON.stringify(view, null, 2) }));
  } catch (e) {
    main.append(el("p", { class: "v2error", text: `Settings could not be read (${e?.code ?? e?.message ?? e}).` }));
  }
}

// ------------------------------------------------------------ Diagnostics
async function renderDiagnostics() {
  main.append(el("h1", { text: "Diagnostics" }));
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
    ["Device", run?.deviceId ?? "—", "diag-device"],
    ["Writes enabled (Table C gate)", gate ? String(gate.writesEnabled) : "—", "diag-writes"],
    ["Preflight", gate ? `${gate.preflight.status}${gate.preflight.step ? ` at ${gate.preflight.step}` : ""}${gate.preflight.code ? ` (${gate.preflight.code})` : ""}` : "—", "diag-preflight"],
    ["Durability", DURABILITY_STATEMENT, "diag-durability"],
  ];
  for (const [k, v, id] of rows)
    main.append(el("div", { class: "v2row" }, el("strong", { text: `${k}: ` }), el("span", { id, text: String(v) })));
  if (gate?.preflight?.steps && Object.keys(gate.preflight.steps).length)
    main.append(el("h2", { text: "Table C preflight steps" }),
      el("pre", { id: "diag-preflight-steps", text: JSON.stringify(gate.preflight.steps, null, 2) }));
  if (run) {
    const sl = run.shelfLifecycleState();
    main.append(el("h2", { text: "Lifecycle" }),
      el("pre", { id: "diag-lifecycle", text: JSON.stringify({ phase: sl.phase, closed: sl.closed, pendingSync: sl.pendingSync }, null, 2) }));
  }
  if (d) main.append(el("h2", { text: "Per-book positions" }), el("pre", { id: "diag-books", text: JSON.stringify(d.perBook, null, 2) }));
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
  lastShelfFlush: () => lastShelfFlush,
  attemptShelfFlush: async () => {
    if (!run) return { refused: true, code: "not_connected" };
    try { return { refused: false, result: await run.candidate.shelfBridge.flush() }; }
    catch (e) { return { refused: true, code: e?.code ?? e?.message ?? "flush_refused" }; }
  },
};
