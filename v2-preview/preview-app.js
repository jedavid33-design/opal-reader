// Opal Reader v2 — preview bundle wiring (Part 1, B5).
//
// Binds the assembled v2 client (store + funnel + projection + surfaces
// + Shelf bridge) to these preview screens. This file is the §7 wiring
// for the PREVIEW only: the shipped root index.html / app-256.js are
// not part of it and are not modified by it. The preview talks only to
// the staging worker's smoke-p8 instance, with a token held in memory.
import { createAssembledClient } from "../v2/client/assembled-client.mjs";
import { createHttpTransport } from "../v2/client/http-transport.mjs";

const $ = (id) => document.getElementById(id);
const diag = [];
let client = null;
let transport = null;
let currentBook = null;

function log(line) {
  diag.push(`${new Date().toISOString()} ${line}`);
  const el = $("diagLog");
  if (el) el.textContent = diag.slice(-80).join("\n");
}
function fail(where, e) { log(`${where}: ${e?.message || e}`); }

// Preview-local storage: one namespaced localStorage record per key,
// matching the assembled client's async storage contract. The token is
// NEVER stored — it lives in the transport closure only.
const storage = {
  async get(key) {
    const raw = localStorage.getItem(`opalreader-v2-preview:${key}`);
    return raw === null ? undefined : JSON.parse(raw);
  },
  async set(key, value) {
    localStorage.setItem(`opalreader-v2-preview:${key}`, JSON.stringify(value));
  },
  async del(key) { localStorage.removeItem(`opalreader-v2-preview:${key}`); },
};

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

async function connect() {
  const baseUrl = $("workerBase").value.trim();
  const token = $("accessToken").value;
  const deviceId = $("deviceId").value.trim() || "preview-device";
  transport = createHttpTransport({
    baseUrl, token, deviceId, scope: "staging-smoke", instance: "smoke-p8",
  });
  client = createAssembledClient({
    deviceId, storage, transport,
    shelf: { shelfApiBase: $("shelfBase").value.trim() || undefined },
  });
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`);
    const health = await res.json();
    $("health").textContent = `Worker: ${health.app} ${health.version} · build ${health.build} · generation ${health.generation}`;
    log(`connected: ${JSON.stringify(health)}`);
  } catch (e) { fail("health", e); }
  await renderQuota();
  await renderShelf();
}

async function loadBook() {
  if (!client) return;
  const bookId = $("bookId").value.trim();
  try {
    await client.funnel.syncNow();
    const book = await client.funnel.refreshWorking(bookId);
    if (!book) { log(`loadBook: ${bookId} not in the smoke instance`); return; }
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
    try { const r = await client.shelfBridge.flush(); log(`shelfFlush: ${JSON.stringify(r)}`); }
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

wire();
log("preview bundle loaded (no worker connection yet)");
