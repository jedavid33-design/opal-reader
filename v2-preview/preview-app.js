// Opal Reader v2 — preview bundle wiring (Part 1, B5).
//
// Binds the assembled v2 client (store + funnel + projection + surfaces
// + Shelf bridge) to these preview screens. This file is the §7 wiring
// for the PREVIEW only: the shipped root index.html / app-256.js are
// not part of it and are not modified by it. The preview talks only to
// the pinned staging worker's smoke-p8 instance, with a token held in
// memory. Before any token-bearing transport can be created, an
// unauthenticated health response must match the deployed staging
// build exactly (preview source review P1, Rowan 6351482794). Each
// browser/device gets its own stable preview device identity (P2).
// Its Shelf bridge never leaves the page: it is composed with a local
// fixture transport (./fake-shelf-transport.js), so no external Shelf
// POST is possible from this bundle (B7 safety round, 6346291349).
import { createAssembledClient } from "../v2/client/assembled-client.mjs";
import { createHttpTransport } from "../v2/client/http-transport.mjs";
import { createFakeShelfTransport } from "./fake-shelf-transport.js";

const $ = (id) => document.getElementById(id);
const diag = [];
let client = null;
let transport = null;
let currentBook = null;

// The preview's Shelf bridge is dry-run/local-only BY CONSTRUCTION
// (B7 safety round, Rowan 6346291349): there is no Shelf API base
// input and no code path that can POST to an external Shelf. The
// bridge is composed with this fixture transport as its fetch seam —
// flushing exercises the bridge's FIFO discipline against the local
// fixture and records what WOULD be sent, visibly, in the Shelf card.
const fakeShelf = createFakeShelfTransport();

function log(line) {
  diag.push(`${new Date().toISOString()} ${line}`);
  const el = $("diagLog");
  if (el) el.textContent = diag.slice(-80).join("\n");
}
function fail(where, e) { log(`${where}: ${e?.message || e}`); }

// Preview-local storage: one namespaced localStorage record per key,
// matching the assembled client's async storage contract. The token is
// NEVER stored — it lives in the transport closure only.
export function createPreviewStorage(storageLike) {
  if (!storageLike) throw new Error("preview local storage is required");
  return {
    async get(key) {
      const raw = storageLike.getItem(`opalreader-v2-preview:${key}`);
      return raw === null ? undefined : JSON.parse(raw);
    },
    async set(key, value) {
      storageLike.setItem(`opalreader-v2-preview:${key}`, JSON.stringify(value));
    },
    async del(key) { storageLike.removeItem(`opalreader-v2-preview:${key}`); },
  };
}

const inertLocalStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const storage = createPreviewStorage(globalThis.localStorage ?? inertLocalStorage);

export const STAGING_WORKER_ORIGIN = "https://opalreader-api-v2.4d8v7jw78c.workers.dev";
// The deployed staging Worker's build stamp. This preview correction
// does not redeploy the Worker, so the value intentionally remains the
// Part 2 replacement pin even though the preview source is repinned.
export const EXPECTED_STAGING_BUILD = "a2b0031fcba6d3cdaadb949d900a4a642da05807";
export const EXPECTED_STAGING_HEALTH = Object.freeze({
  ok: true,
  app: "OpalReader API v2",
  version: "2.0.0",
  build: EXPECTED_STAGING_BUILD,
  coordinator: "armed",
  scope: "staging-smoke",
  generation: "halted",
});

export function assertStagingHealth(health) {
  if (!health || typeof health !== "object" || Array.isArray(health))
    throw new Error("staging_health_malformed");
  const expectedKeys = Object.keys(EXPECTED_STAGING_HEALTH).sort();
  const actualKeys = Object.keys(health).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys))
    throw new Error("staging_health_mismatch: fields");
  for (const [key, expected] of Object.entries(EXPECTED_STAGING_HEALTH)) {
    if (health[key] !== expected)
      throw new Error(`staging_health_mismatch: ${key}`);
  }
  return health;
}

// The F-B authenticated proof (Rowan 6353186341): a candidate
// connection is proven by a DIRECT transport quotaView() whose
// resolved payload is checked against the coordinator's quota view
// (v2/coordinator.mjs quotaView()) — specifically the numeric fields
// the client itself consumes (the store's as-of stamps and the
// Settings money text). A genuine quota view always carries them; an
// error body or a junk 200 does not.
//
// This deliberately does NOT go through surfaces.quotaModel() /
// store.refreshMoney(): that path catches EVERY quotaView()
// rejection and returns cached money (marked stale) instead of
// throwing, so a refused token could appear to pass — precisely the
// misleading reconnect outcome F-B exists to prevent. The proof runs
// at the transport level, where a refusal still throws and nothing
// is read from any cache.
const QUOTA_PROOF_NUMERIC_FIELDS = Object.freeze([
  "attemptsToday", "dailyLimit", "spentMicroCents",
  "monthlyCap", "ledgerSeq", "settingsRevision",
]);

export function assertWellFormedQuotaView(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("preview_quota_proof_malformed");
  for (const field of QUOTA_PROOF_NUMERIC_FIELDS) {
    if (typeof payload[field] !== "number" || !Number.isFinite(payload[field]))
      throw new Error("preview_quota_proof_malformed");
  }
  return payload;
}

export async function fetchVerifiedStagingHealth({
  fetchFn = (...args) => globalThis.fetch(...args),
} = {}) {
  let res;
  try {
    // Deliberately no headers: the staging token must not be attached
    // to the identity probe, and no transport exists yet.
    res = await fetchFn(`${STAGING_WORKER_ORIGIN}/health`, { method: "GET" });
  } catch (e) {
    throw new Error(`staging_health_unreachable: ${e?.message || e}`);
  }
  if (!res?.ok) throw new Error(`staging_health_http_${res?.status ?? "unknown"}`);
  let health;
  try { health = await res.json(); }
  catch { throw new Error("staging_health_malformed"); }
  return assertStagingHealth(health);
}

export const PREVIEW_DEVICE_ID_KEY = "device-id";

function defaultRandomPreviewDeviceId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `preview-${uuid}`;
  return `preview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function deviceIdMismatch(message) {
  const err = new Error(`device_id_mismatch: ${message}`);
  err.code = "device_id_mismatch";
  return err;
}

export async function ensurePreviewDeviceId(previewStorage, randomId = defaultRandomPreviewDeviceId) {
  if (!previewStorage) throw new Error("preview storage is required");
  const existing = await previewStorage.get(PREVIEW_DEVICE_ID_KEY);
  if (typeof existing === "string" && existing.trim()) return existing;
  if (existing !== undefined && existing !== null)
    throw deviceIdMismatch("stored preview device identity is malformed");
  const generated = randomId();
  if (typeof generated !== "string" || !generated.trim())
    throw new Error("preview device identity generation failed");
  await previewStorage.set(PREVIEW_DEVICE_ID_KEY, generated);
  return generated;
}

export async function assertPreviewDeviceIdentity(previewStorage, deviceId) {
  const state = await previewStorage.get("cs:state:v1");
  const storedDeviceId = state?.deviceId;
  if (storedDeviceId !== undefined && storedDeviceId !== null && storedDeviceId !== deviceId)
    throw deviceIdMismatch(`storage belongs to ${storedDeviceId}, not ${deviceId}`);
  return true;
}

let deviceIdentityPromise = null;
export function previewDeviceIdentity() {
  deviceIdentityPromise ??= ensurePreviewDeviceId(storage).then((id) => {
    const el = $("deviceId");
    if (el) el.textContent = id;
    return id;
  });
  return deviceIdentityPromise;
}

export async function connectPreviewClient({
  token,
  deviceId,
  fetchFn = (...args) => globalThis.fetch(...args),
  createTransportFn = createHttpTransport,
  createClientFn = createAssembledClient,
  clientStorage = storage,
  shelfTransport = fakeShelf,
} = {}) {
  // F-B (Rowan 6353186341): a blank token is refused before anything
  // is touched — no identity read, no health probe, no transport —
  // and therefore long before connect() could swap the installed
  // client for an unproven one.
  if (typeof token !== "string" || token.trim() === "")
    throw new Error("Enter the staging token to connect.");
  if (!deviceId) throw new Error("preview device identity is required");
  // Local identity preflight happens before the health probe and
  // therefore before any possible authenticated request. A mismatch is
  // surfaced; neither the dedicated identity nor the client state is
  // silently rewritten to make it agree.
  await assertPreviewDeviceIdentity(clientStorage, deviceId);
  const health = await fetchVerifiedStagingHealth({ fetchFn });
  const createdTransport = createTransportFn({
    baseUrl: STAGING_WORKER_ORIGIN, token, deviceId,
    scope: "staging-smoke", instance: "smoke-p8", fetchFn,
  });
  // F-B authenticated proof: the candidate exists only as a TRANSPORT
  // until it proves itself. quotaView() throws on any non-2xx, and
  // the resolved payload must be a well-formed quota view — so a
  // wrong, expired, or otherwise refused token fails here, before
  // any assembled client (the thing that can mutate shared local
  // storage) is composed around it. The candidate's token dies with
  // this discarded transport on failure; it is never logged or
  // persisted either way.
  assertWellFormedQuotaView(await createdTransport.quotaView());
  const shelf = shelfTransport === fakeShelf
    ? { shelfApiBase: fakeShelf.base, fetchFn: fakeShelf.fetchFn }
    : { shelfApiBase: shelfTransport.base, fetchFn: shelfTransport.fetchFn };
  const createdClient = createClientFn({
    deviceId, storage: clientStorage, transport: createdTransport, shelf,
  });
  return { health, transport: createdTransport, client: createdClient };
}

function row(label, value) {
  const div = document.createElement("div");
  div.className = "model-row";
  const a = document.createElement("span"); a.textContent = label;
  const b = document.createElement("strong"); b.textContent = value;
  div.append(a, b);
  return div;
}

async function renderChapterModels() {
  const host = $("chapterModels");
  host.replaceChildren();
  if (!client || !currentBook) return;
  const chapterId = $("chapterSelect").value;
  if (!chapterId) return;
  // One projection, every surface — the model cannot diverge (P5).
  for (const surface of client.projection.SURFACES) {
    const m = await client.projection.surfaceModel(surface, currentBook.id, chapterId);
    host.append(row(`${surface}`, `${m.text}${m.certain ? "" : " · uncertain"}`));
  }
}

async function renderPosition() {
  const host = $("positionModel");
  host.replaceChildren();
  if (!client || !currentBook) return;
  try {
    const m = await client.surfaces.positionModel(currentBook.id);
    host.append(row("Canonical position", m.text));
    host.append(row("As of receipt", String(m.asOfReceiptSeq)));
    host.append(row("Pending local events", String(m.pendingLocal)));
    if (m.journalGaps?.length) host.append(row("Journal gaps", JSON.stringify(m.journalGaps)));
  } catch (e) { fail("positionModel", e); }
}

async function renderQuota() {
  const host = $("quotaModel");
  host.replaceChildren();
  if (!client) return;
  try {
    const q = await client.surfaces.quotaModel(); // F8: quota lives in Settings
    host.append(row("Generation quota", q.text));
    host.append(row("Ledger as of", String(q.asOfLedgerSeq ?? "—")));
    host.append(row("Settings revision", String(q.asOfSettingsRevision ?? "—")));
  } catch (e) { fail("quotaModel", e); }
}

async function renderShelf() {
  const host = $("shelfStatus");
  host.replaceChildren();
  if (!client) return;
  const pending = await client.shelfBridge.pendingCount();
  host.append(row("Shelf outbox pending", String(pending)));
  host.append(row("Shelf transport", "local fixture — dry-run only; nothing leaves this page"));
  host.append(row("Would-be sends recorded", String(fakeShelf.sent.length)));
  fakeShelf.sent.forEach((p, i) => {
    host.append(row(`would-send #${i + 1}`,
      `${p.read_id} · ${p.duration_seconds}s · ${p.started_at}`));
  });
}

function populateBook(book) {
  currentBook = book;
  const chapters = $("chapterSelect");
  chapters.replaceChildren();
  for (const ch of book?.chapters || []) {
    const opt = document.createElement("option");
    opt.value = ch.id; opt.textContent = ch.title || ch.id;
    chapters.append(opt);
  }
  const povs = $("povSelect");
  povs.replaceChildren();
  for (const pov of book?.povs || []) {
    const opt = document.createElement("option");
    opt.value = pov.id; opt.textContent = pov.name || pov.id;
    povs.append(opt);
  }
  syncStyleEditor();
  syncSegments();
  void renderChapterModels();
  void renderPosition();
}

function syncStyleEditor() {
  const pov = (currentBook?.povs || []).find((p) => p.id === $("povSelect").value);
  $("styleText").value = pov?.voice?.style_direction ?? pov?.voice?.styleDirection ?? "";
}

function syncSegments() {
  const sel = $("segmentSelect");
  sel.replaceChildren();
  const ch = (currentBook?.chapters || []).find((c) => c.id === $("chapterSelect").value);
  for (const seg of ch?.segments || []) {
    const opt = document.createElement("option");
    opt.value = seg.occurrenceId;
    opt.textContent = seg.occurrenceId;
    sel.append(opt);
  }
}

// F-B attempt sequencing: only the NEWEST connect attempt may
// install its candidate or report its outcome. A slower attempt
// resolving later — successfully or not — never overwrites a newer
// connection and never relabels the page with its stale result.
let connectAttemptSeq = 0;

export async function connect() {
  const tokenInput = $("accessToken");
  const token = tokenInput.value ?? "";
  // F-B (Rowan 6353186341): a blank token ends the tap HERE, with a
  // visible explanation, before the installed client/transport is
  // touched. The field is cleared after every successful connect, so
  // this is exactly where a second Connect tap used to land: it read
  // the empty field, discarded the working client, and installed an
  // empty-token replacement that still reported "connected" (the
  // acceptance session's opening wall). Now the tap changes nothing.
  if (!token.trim()) {
    $("health").textContent = "Enter the staging token to connect.";
    log("connect: no token entered; any existing connection was left unchanged");
    return false;
  }
  const attempt = ++connectAttemptSeq;
  let connected;
  try {
    const deviceId = await previewDeviceIdentity();
    connected = await connectPreviewClient({ token, deviceId });
  } catch (e) {
    if (attempt !== connectAttemptSeq) {
      log(`connect: a superseded attempt failed (${e?.message || e}); the current connection was left unchanged`);
      return false;
    }
    $("health").textContent = `Connection refused: ${e?.message || e}`;
    fail("connect", e);
    return false;
  }
  if (attempt !== connectAttemptSeq) {
    // The candidate proved itself, but a newer attempt started while
    // it was proving: the newer attempt owns the installed
    // connection, so this candidate is discarded uninstalled.
    log("connect: a superseded attempt was discarded; the current connection was kept");
    return false;
  }
  // Replace-after-proof (F-B): the installed client/transport is
  // swapped ONLY here, after the candidate has proven itself on a
  // direct authenticated read (connectPreviewClient). The client
  // being replaced is Julie's own earlier connection, made with the
  // credential she herself entered; keeping it through a failed new
  // attempt exposes nothing new, and the health line always states
  // which connection the page is actually using.
  transport = connected.transport;
  client = connected.client;
  // Successful connection only: do not leave Julie's staging token in
  // the DOM. It remains solely in the transport closure.
  tokenInput.value = "";
  const { health } = connected;
  $("health").textContent = `Worker: ${health.app} ${health.version} · build ${health.build} · generation ${health.generation}`;
  log(`connected to pinned staging worker: ${JSON.stringify(health)}`);
  await renderQuota();
  await renderShelf();
  return true;
}

// F-C (Rowan 6353186341): the not-found diagnostics name the exact
// ID submitted — never a rewritten or normalized one — and, when
// that ID contains uppercase characters, add the exact-case hint.
// The hint deliberately does NOT assert the OS or the keyboard
// changed the input; it points at the likeliest cause, and IDs stay
// case-sensitive end to end (the #bookId input now also opts out of
// keyboard capitalization/correction — see v2-preview/index.html).
export function bookNotFoundLines(bookId) {
  const lines = [`loadBook: ${bookId} not in the smoke instance`];
  if (/[A-Z]/.test(bookId))
    lines.push("loadBook: IDs are case-sensitive; check the exact case");
  return lines;
}

async function loadBook() {
  if (!client) return;
  const bookId = $("bookId").value.trim();
  try {
    await client.funnel.syncNow();
    const book = await client.funnel.refreshWorking(bookId);
    if (!book) { for (const line of bookNotFoundLines(bookId)) log(line); return; }
    populateBook({ id: bookId, ...book });
    log(`loaded book ${bookId}`);
  } catch (e) { fail("loadBook", e); }
}

async function reportPosition(kind) {
  if (!client || !currentBook) return;
  const occurrenceId = $("segmentSelect").value;
  if (!occurrenceId) return;
  try {
    const audio = $("previewAudio");
    const res = await client.surfaces.reportPosition(currentBook.id, {
      kind, occurrenceId, offsetSec: Number(audio?.currentTime || 0),
    });
    log(`reportPosition ${kind}: ${JSON.stringify(res)}`);
    // F12: position playback feeds the Shelf sessionizer.
    if (kind === "play") client.shelfBridge.playbackStarted($("readId").value);
    if (kind === "pause") client.shelfBridge.playbackPaused($("readId").value);
    await renderPosition();
    await renderShelf();
  } catch (e) { fail("reportPosition", e); }
}

// F11: Playback Restore + diagnostics, relocated to the secondary
// player controls. Restore sound re-attempts playback of the current
// source after a silent-audio failure; the playback log is the
// diagnostics record (position model + journal + this session's log).
async function recoverAudio() {
  const audio = $("previewAudio");
  try {
    if (!audio.src) throw new Error("No audio source is loaded in the preview player.");
    audio.pause();
    audio.load();
    await audio.play();
    log("recoverAudio: playback restarted");
  } catch (e) {
    fail("recoverAudio", e);
    alert("Restore sound failed. Tap Play to retry.");
  }
}
async function copyPlaybackLog() {
  const payload = { at: new Date().toISOString(), log: diag };
  try {
    if (currentBook && client) payload.journal = await client.store.journalState(currentBook.id);
  } catch {}
  try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); log("playback log copied"); }
  catch { log(`playback log: ${JSON.stringify(payload)}`); }
}

function wire() {
  $("connect").addEventListener("click", () => void connect());
  $("syncNow").addEventListener("click", async () => {
    try { const r = await client.funnel.syncNow(); $("syncStatus").textContent = `synced ${JSON.stringify(r)}`; }
    catch (e) { fail("syncNow", e); }
  });
  $("loadBook").addEventListener("click", () => void loadBook());
  $("chapterSelect").addEventListener("change", () => { syncSegments(); void renderChapterModels(); });
  $("povSelect").addEventListener("change", syncStyleEditor);
  $("findRun").addEventListener("click", async () => {
    const host = $("findResults");
    host.replaceChildren();
    try {
      // F10: Find Text in Segments — a pure read, no generation, no lab.
      const hits = await client.findText($("findQuery").value);
      if (!hits.length) host.append(row("Find", "no matches"));
      for (const h of hits) host.append(row(`${h.bookId} · ${h.chapterId}`, h.occurrenceId));
    } catch (e) { fail("findText", e); }
  });
  $("styleSave").addEventListener("click", async () => {
    if (!client || !currentBook) return;
    try {
      // F9: a style edit is a new content revision via the funnel —
      // conflict surfaces, silent apply never happens.
      const working = client.funnel.getWorking(currentBook.id) || { ...currentBook };
      const pov = (working.povs || []).find((p) => p.id === $("povSelect").value);
      if (!pov) return;
      pov.voice = { ...(pov.voice || {}), style_direction: $("styleText").value };
      client.funnel.setWorking(currentBook.id, working);
      const saved = await client.funnel.saveBook(currentBook.id);
      const settled = await client.funnel.settle();
      $("styleStatus").textContent = saved.skipped ? `skipped: ${saved.reason}` : `saved; outcomes: ${settled.outcomes.length}`;
      log(`styleSave: ${JSON.stringify(saved)}`);
    } catch (e) { fail("styleSave", e); }
  });
  $("posPlay").addEventListener("click", () => void reportPosition("play"));
  $("posPause").addEventListener("click", () => void reportPosition("pause"));
  $("posRefresh").addEventListener("click", () => void renderPosition());
  $("recoverAudio").addEventListener("click", () => void recoverAudio());
  $("copyPlaybackLog").addEventListener("click", () => void copyPlaybackLog());
  $("shelfStart").addEventListener("click", async () => { client?.shelfBridge.playbackStarted($("readId").value); await renderShelf(); });
  $("shelfPause").addEventListener("click", async () => { client?.shelfBridge.playbackPaused($("readId").value); await renderShelf(); });
  $("shelfStop").addEventListener("click", async () => { client?.shelfBridge.playbackStopped($("readId").value); await renderShelf(); });
  $("shelfFlush").addEventListener("click", async () => {
    try { const r = await client.shelfBridge.flush(); log(`shelfFlush (local dry-run — nothing was sent to any Shelf): ${JSON.stringify(r)}`); }
    catch (e) { fail("shelfFlush", e); }
    await renderShelf();
  });
  $("settingsLoad").addEventListener("click", async () => {
    try {
      const m = await client.surfaces.settingsModel();
      $("settingsJson").value = JSON.stringify(m.data ?? {}, null, 2);
      $("settingsStatus").textContent = `revision ${m.revision}`;
      await renderQuota();
    } catch (e) { fail("settingsLoad", e); }
  });
  $("settingsSave").addEventListener("click", async () => {
    try {
      const data = JSON.parse($("settingsJson").value || "{}");
      const r = await client.surfaces.updateSettings(data);
      $("settingsStatus").textContent = r.applied ? `applied at revision ${r.revision}`
        : r.conflict ? `conflict — current revision ${r.currentRevision}`
        : r.pending ? "pending (durable in outbox)" : `not applied: ${r.reason || "unknown"}`;
      log(`updateSettings: ${JSON.stringify(r)}`);
      await renderQuota();
    } catch (e) { fail("settingsSave", e); }
  });
}

if (typeof document !== "undefined") {
  wire();
  void previewDeviceIdentity().catch((e) => {
    const el = $("health");
    if (el) el.textContent = `Device identity error: ${e?.message || e}`;
  });
  log("preview bundle loaded (no worker connection yet)");
}
