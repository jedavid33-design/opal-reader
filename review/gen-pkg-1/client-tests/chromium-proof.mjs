// gen-pkg-1 Chromium proof (LOCAL ONLY, loopback stub coordinator,
// zero production contact). Drives the real gen-pkg-1 candidate
// (GEN_TREE, default ../tree-a) plus the ui-pkg-4 rollback base
// (../base) in Chromium. The stub implements the NEW worker
// surfaces exactly as built (capabilities / plans list / plan
// status / eligibility quote / SubmitJob->intent receipt) over
// the accepted sync fixture pattern.
//
// Rows:
//   GP-1  boot under sw-genpkg1 + connect + library
//   GP-2  sheet renders the SERVER quote (count/chars/estimate/
//         exclusions), Batch disabled with its server reason
//   GP-3  Start submits exactly ONE SubmitJob of the pinned
//         shape under a double-tap; phase null for unbudgeted book
//   GP-4  reopening the same scope reroutes to the active plan
//         (no second submit); View progress opens the view
//   GP-5  Generation view: Wren-submitted (pre-seeded) plan is
//         discovered; phase budget line uses server amounts only
//   GP-6  chapter scope submits scoped (chapterIndex, keepGoing
//         false outside book scope)
//   GP-7  parked chapter: no Start, parked wording, no submit
//   GP-8  voice_prompt segment: no Start, voice-choice wording
//   GP-9  FP book submit carries phase "forever-pucked" from the
//         server capabilities (never hard-coded)
//   GP-10 timeout-after-accepted-submit: the answer is dropped
//         AFTER the server recorded the plan; the sheet re-reads
//         the plan list and reports Started — no blind resubmit
//   GP-11 candidate state record + Shelf record byte-stable
//         across every generation flow (submissions write nothing
//         locally)
//   GP-12 halted capabilities: Start never offered
//   GP-13 rollback: the ui-pkg-4 build boots on the same profile
//         and state, state byte-identical after; the gen build
//         boots again after it (no migration either direction)
//   GP-14 halted_unknown plan (round-1 corrections; fixture made
//         clearly synthetic in round-2 R2-3): renders with the
//         plain-language stop reason, settled figure WITH the
//         unconfirmed-charge qualifier, its lane named, and no
//         retry/resume affordance; nothing is submitted
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TREE = process.env.GEN_TREE ? path.resolve(ROOT, process.env.GEN_TREE) : path.join(ROOT, "tree-a");
const BASE_TREE = path.join(ROOT, "base");
const GEN_INDEX = fs.readFileSync(path.join(TREE, "index.html"));
const UI4_INDEX = fs.readFileSync(path.join(BASE_TREE, "index.html"));
const hex = (i) => i.toString(16).padStart(64, "0");
const TOKEN = "proof-token-123";
const PROBE_KEY = "c10cb90e978621a98590e17b16e5bfb2090c9b78d8a3bfdeb55162bfa429067a";
const FP_ID = "5c589095-f812-48a2-8ab2-03ba2791f2b2"; // Forever Pucked (production bookId; fixture content synthetic)

// ---------------- fixtures ----------------
const gbBook = { bookId: "gb", title: "Fixture Generic", author: "Fixture Author",
  cast: [{ id: "pov-b", name: "Narrator", voice: { provider: "gemini", voice_id: "Kore", name: "Kore" } }],
  chapters: [
    { chapterId: "gb-ch1", index: 0, segments: [
      { occurrenceId: "g1", pov: "Narrator" },
      { occurrenceId: "g2", pov: "Narrator", text: "y".repeat(1596) },
      { occurrenceId: "g3", pov: "Narrator", text: "z".repeat(800) }] },
    { chapterId: "gb-ch2", index: 1, segments: [
      { occurrenceId: "g4", pov: "Narrator", text: "w".repeat(1596) }] }] };
const fpBook = { bookId: FP_ID, title: "Fixture Forever", author: "Fixture Author",
  cast: [
    { id: "pov-a", name: "Violet", voice: { provider: "gemini", voice_id: "Zephyr", name: "Zephyr" } },
    { id: "pov-s", name: "Sabrina", voice: { provider: "azure", voice_id: "Aoede", name: "Aoede" } }],
  chapters: [
    { chapterId: "fp-ch1", index: 0, segments: [{ occurrenceId: "f1", pov: "Violet" }] },
    { chapterId: "fp-ch2", index: 1, segments: [{ occurrenceId: "f2", pov: "Violet" }] },
    { chapterId: "fp-ch3", index: 2, segments: [{ occurrenceId: "x1", pov: "Violet" }, { occurrenceId: "x2", pov: "Violet" }] },
    { chapterId: "fp-ch4", index: 3, segments: [
      { occurrenceId: "f5", pov: "Violet", text: "v".repeat(1200) },
      { occurrenceId: "f9", pov: "Sabrina" }] }] };
const contentLog = [
  { seq: 1, op: "upsert", entityKey: "gb", bookId: "gb", revision: 1, payload: gbBook },
  { seq: 2, op: "upsert", entityKey: FP_ID, bookId: FP_ID, revision: 1, payload: fpBook }];
const binding = (seq, bookId, occ, key, format = "wav", sizeBytes = 480044) =>
  ({ seq, op: "upsert", entityKey: `${bookId}:${occ}`, bookId, revision: 1, payload: { cacheKey: key, sha256: key, format, sizeBytes } });
const bindingsLog = [
  binding(1, FP_ID, "f1", PROBE_KEY, "mp3", 10944),
  binding(2, FP_ID, "f2", hex(71)),
  binding(3, "gb", "g1", hex(72))];
const settingsLog = [
  { seq: 1, op: "upsert", entityKey: "settings", revision: 0, payload: { monthlyCap: 50, geminiLane: "batch" } }];

// The stub's eligibility table — the same numbers the worker's
// quote would compute from this fixture (expected cost per
// segment = round(chars / 15.96 * 225), the service's formula).
const SEG_CHARS = { g2: 1596, g3: 800, g4: 1596, f5: 1200 };
const segCost = (id) => Math.round((SEG_CHARS[id] ?? 0) / 15.96 * 225);
function quoteFor(bookId, scope, chapterIndex, occurrenceId) {
  const zero = { bound_already: 0, voice_prompt: 0, parked: 0, other: 0 };
  const mk = (ids, exclusions) => ({
    bookId, scope, chapterIndex: chapterIndex ?? null, occurrenceId: occurrenceId ?? null,
    eligibleCount: ids.length, totalChars: ids.reduce((s, id) => s + (SEG_CHARS[id] ?? 0), 0),
    expectedCostMicroCents: ids.reduce((s, id) => s + segCost(id), 0),
    exclusions, digest: "stubdigest", quotedAt: new Date().toISOString(), advisory: true });
  if (bookId === "gb") {
    if (scope === "book") return mk(["g2", "g3", "g4"], { ...zero, bound_already: 1 });
    if (scope === "chapter" && chapterIndex === 0) return mk(["g2", "g3"], { ...zero, bound_already: 1 });
    if (scope === "chapter" && chapterIndex === 1) return mk(["g4"], { ...zero });
    if (scope === "segment") return mk([occurrenceId], { ...zero });
  }
  if (bookId === FP_ID) {
    if (scope === "book") return mk(["f5"], { ...zero, bound_already: 2, parked: 2, voice_prompt: 1 });
    if (scope === "chapter" && chapterIndex === 2) return mk([], { ...zero, parked: 2 });
    if (scope === "chapter" && chapterIndex === 3) return mk(["f5"], { ...zero, voice_prompt: 1 });
    if (scope === "segment" && occurrenceId === "f9") return mk([], { ...zero, voice_prompt: 1 });
    if (scope === "segment") return mk([occurrenceId], { ...zero });
    if (scope === "chapter") return mk([], { ...zero, bound_already: 1 });
  }
  return mk([], { ...zero });
}

// ---------------- plan store + captured traffic ----------------
const commands = [];       // logical (deduped) commands — the coordinator's view
const wireCommands = [];   // every wire copy, incl. browser re-deliveries
const receiptsByCommandId = new Map();
const planStore = [{
  planId: "plan-wren-fp", bookId: FP_ID, scope: "chapter", chapterIndex: 3, lane: "standard",
  keepGoing: false,
  phase: "forever-pucked", state: "active", stopReason: null,
  totals: { eligible: 2, done: 1, failed: 0, blocked: 0, prompts: 0 },
  settledMicroCents: 17749, bindingsPublished: 1, bindingsPending: 0,
  createdAt: "2026-10-29T22:57:00.000Z", updatedAt: "2026-10-29T22:58:00.000Z",
}];
let planSeq = 0;
let capsMode = "enabled";
let commandResponseDrops = 0;

function wav(seconds) {
  const samples = Math.floor(8000 * seconds), dataLen = samples * 2, buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataLen, 40);
  return buf;
}
const AUDIO_PROBE = wav(10900 / 16000);
const AUDIO_LONG = wav(30);
const audioFor = (p) => (p.includes(PROBE_KEY) ? AUDIO_PROBE : AUDIO_LONG);
const ETAG = '"stub-etag-1"';

function coordinator(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname.replace(/^\/api-v2/, "");
  const send = (code, obj, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(obj === null ? "" : JSON.stringify(obj)); };
  const token = req.headers["x-opalreader-token"];
  const instance = req.headers["x-opalreader-instance"];
  if (p === "/v2/settings") {
    if (instance === "preflight-wrong-instance") return send(403, { error: "production_instance_required" });
    if (token !== TOKEN) return send(401, { error: "unauthorized" });
    return send(200, { monthlyCap: 50, geminiLane: "batch", revision: 0 });
  }
  if (token !== TOKEN) return send(401, { error: "unauthorized" });
  if (p === "/v2/quota") return send(200, { attemptsToday: 1, dailyLimit: 100, spentMicroCents: 17749, monthlyCap: 50, ledgerSeq: 1, settingsRevision: 1 });
  if (p === "/v2/generation/capabilities") {
    return send(200, capsMode === "enabled"
      ? { generationState: "enabled",
          lanes: { standard: { admitted: true }, batch: { admitted: false, reason: "batch_not_armed" } },
          configuredLane: "standard",
          phases: [{ phase: "forever-pucked", bookId: FP_ID, budgetMicroCents: 13500000, settledMicroCents: 17749, remainingMicroCents: 13482251 }],
          asOf: new Date().toISOString() }
      : { generationState: "halted",
          lanes: { standard: { admitted: true }, batch: { admitted: false, reason: "batch_not_armed" } },
          configuredLane: "standard", phases: [], asOf: new Date().toISOString() });
  }
  if (p === "/v2/d6-eligibility") {
    return send(200, quoteFor(u.searchParams.get("bookId"),
      u.searchParams.get("scope"),
      u.searchParams.has("chapterIndex") ? Number(u.searchParams.get("chapterIndex")) : null,
      u.searchParams.get("occurrenceId")));
  }
  if (p === "/v2/d6-plans" && req.method === "GET") return send(200, { plans: planStore, nextCursor: null });
  if (p.startsWith("/v2/d6-plans/")) {
    const id = decodeURIComponent(p.slice("/v2/d6-plans/".length));
    const plan = planStore.find((x) => x.planId === id);
    return plan ? send(200, plan) : send(404, { error: "plan_not_found" });
  }
  if (p === "/v2/commands" && req.method === "POST") {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      let parsed = null; try { parsed = JSON.parse(body); } catch {}
      wireCommands.push(parsed);
      // The coordinator dedupes by command_id (the command log):
      // a re-delivered copy returns the stored receipt and mints
      // nothing new. The drop counter models lost responses —
      // the command is still recorded exactly once.
      const cid = parsed?.command_id;
      if (cid && receiptsByCommandId.has(cid)) {
        if (commandResponseDrops > 0) { commandResponseDrops--; res.socket.destroy(); return; }
        return send(200, receiptsByCommandId.get(cid));
      }
      commands.push(parsed);
      const intent = parsed?.payload?.data?.d6Intent ?? {};
      const q = quoteFor(parsed?.payload?.bookId, intent.scope, intent.chapterIndex ?? null, intent.occurrenceId ?? null);
      const plan = {
        planId: `plan-stub-${++planSeq}`, bookId: parsed?.payload?.bookId, scope: intent.scope,
        chapterIndex: intent.scope === "chapter" ? intent.chapterIndex : null,
        lane: parsed?.payload?.lane, phase: intent.phase ?? null, keepGoing: !!intent.keepGoing,
        state: "active", stopReason: null,
        totals: { eligible: q.eligibleCount, done: 0, failed: 0, blocked: 0, prompts: 0 },
        settledMicroCents: 0, bindingsPublished: 0, bindingsPending: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      planStore.unshift(plan);
      const receipt = { outcome: "applied", planId: plan.planId, state: "active" };
      if (cid) receiptsByCommandId.set(cid, receipt);
      if (commandResponseDrops > 0) { commandResponseDrops--; res.socket.destroy(); return; }
      send(200, receipt);
    });
    return;
  }
  if (p === "/v2/sync/changes") {
    const family = u.searchParams.get("family");
    const since = Number(u.searchParams.get("sinceSeq") ?? 0);
    const limit = Number(u.searchParams.get("limit") ?? 100);
    const log = family === "content" ? contentLog : family === "bindings" ? bindingsLog : family === "settings" ? settingsLog : [];
    const slice = log.filter((c) => c.seq > since && c.seq <= since + limit);
    return send(200, { family, changes: slice, nextSeq: slice.length ? slice[slice.length - 1].seq : since, highWatermark: log.length });
  }
  if (p === "/v2/sync/snapshot") {
    const family = u.searchParams.get("family");
    const log = family === "content" ? contentLog : family === "bindings" ? bindingsLog : family === "settings" ? settingsLog : [];
    return send(200, { family, watermark: log.length, entities: log.map((c) => ({ entityKey: c.entityKey, bookId: c.bookId, revision: c.revision, data: c.payload })) });
  }
  if (p.startsWith("/v2/sync/byte-check/")) return send(200, { exists: true });
  if (p.startsWith("/v2/sync/audio/")) {
    const AUDIO = audioFor(p);
    const inm = req.headers["if-none-match"];
    const range = req.headers["range"];
    if (inm && inm === ETAG) { res.writeHead(304, { etag: ETAG }); return res.end(); }
    if (req.method === "HEAD") { res.writeHead(200, { "content-length": String(AUDIO.length), etag: ETAG }); return res.end(); }
    if (range === "bytes=0-0") { res.writeHead(206, { "content-range": `bytes 0-0/${AUDIO.length}`, etag: ETAG, "content-length": "1" }); return res.end(AUDIO.subarray(0, 1)); }
    res.writeHead(200, { "content-length": String(AUDIO.length), etag: ETAG }); return res.end(AUDIO);
  }
  if (p.startsWith("/v2/sync/position/")) return send(200, { canonical: null, asOfReceiptSeq: 0, supersededCount: 0, journalGaps: [] });
  if (p === "/v2/sync/position") return send(200, { receipts: [], rejected: [], tip: 0, journalGaps: [] });
  return send(404, { error: "no_route" });
}
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
function serveTree(rootDir, indexBytes) {
  return (req, res, u, prefix) => {
    if (u.pathname === prefix || u.pathname === prefix + "/" || u.pathname === prefix + "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(indexBytes);
    }
    const rel = decodeURIComponent(u.pathname.slice(prefix.length + 1));
    if (rel.includes("..")) { res.writeHead(400); return res.end(); }
    const file = path.join(rootDir, rel);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    return res.end(fs.readFileSync(file));
  };
}
const serveGen = serveTree(TREE, GEN_INDEX);
const serveUi4 = serveTree(BASE_TREE, UI4_INDEX);
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api-v2/")) return coordinator(req, res);
  if (u.pathname === "/api-shelf/api/sessions" && req.method === "POST") {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (u.pathname.startsWith("/opal-reader")) return serveGen(req, res, u, "/opal-reader");
  if (u.pathname.startsWith("/opal-ui4")) return serveUi4(req, res, u, "/opal-ui4");
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const APP = origin + "/opal-reader/";
const APP_UI4 = origin + "/opal-ui4/";

// ---------------- CDP plumbing (the established harness style) ----------------
const rows = [];
function assert(c, m) { if (!c) throw new Error(m); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WEBGL_POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const WEBGL_SHA = crypto.createHash("sha256").update(fs.readFileSync(WEBGL_POLICY)).digest("hex");
class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.onEvent = null; this.exceptions = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); }
      else if (d.method && this.onEvent) this.onEvent(d); }; }
  send(method, params = {}) { return new Promise((res, rej) => { const id = ++this.id; const to = setTimeout(() => { this.pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); }, 25000); this.pending.set(id, (v) => { clearTimeout(to); res(v); }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expr, { awaitPromise = false } = {}) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
    if (r.result?.exceptionDetails) throw new Error("page exception: " + JSON.stringify(r.result.exceptionDetails).slice(0, 500));
    return r.result?.result?.value;
  }
  async waitFor(expr, { timeout = 40000, label = expr } = {}) {
    const t0 = Date.now();
    for (;;) { const v = await this.eval(expr, { awaitPromise: true }).catch(() => false); if (v) return true;
      if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for: ${label}`); await sleep(300); }
  }
}
async function makeBrowser(apiBase) {
  const profile = fs.mkdtempSync("/tmp/genpkg1-proof-profile-");
  const dbgPort = 23400 + Math.floor(Math.random() * 1200);
  const chrome = spawn("/opt/meta-chromium/chrome", [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-proxy-server",
    `--ip-address-space-overrides=127.0.0.1:${server.address().port}=public`,
    "--autoplay-policy=no-user-gesture-required",
    `--hatch-webgl-allowed-domains-file=${WEBGL_POLICY}`, `--hatch-webgl-allowed-domains-sha256=${WEBGL_SHA}`,
    `--user-data-dir=${profile}`, `--remote-debugging-port=${dbgPort}`, "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  chrome.stderr.on("data", () => {});
  const listUrl = `http://127.0.0.1:${dbgPort}/json/list`;
  for (let i = 0; i < 50; i++) { try { await (await fetch(listUrl)).json(); break; } catch { await sleep(200); } }
  const t = await (await fetch(`http://127.0.0.1:${dbgPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const page = new Page(ws);
  await page.send("Runtime.enable");
  await page.send("Page.enable");
  page.onEvent = (d) => {
    if (d.method === "Runtime.exceptionThrown") page.exceptions.push(JSON.stringify(d.params?.exceptionDetails?.exception?.description ?? d.params?.exceptionDetails?.text ?? "?").slice(0, 300));
    if (d.method === "Fetch.requestPaused") {
      const url = d.params.request.url;
      if (url.startsWith(origin) || url.startsWith("about:") || url.startsWith("data:") || url.startsWith("blob:")) page.send("Fetch.continueRequest", { requestId: d.params.requestId }).catch(() => {});
      else page.send("Fetch.failRequest", { requestId: d.params.requestId, errorReason: "Aborted" }).catch(() => {});
    }
  };
  await page.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__OPAL_V2_BASE_URL__ = ${JSON.stringify(apiBase)}; window.__OPAL_V2_SHELF_BASE_URL__ = ${JSON.stringify(origin + "/api-shelf")};` });
  return { chrome, page };
}
async function row(id, name, fn) {
  try { const ev = await fn(); rows.push([id, "PASS"]); console.log("PASS", id, name, ev ? JSON.stringify(ev).slice(0, 400) : ""); }
  catch (e) { rows.push([id, "FAIL"]); console.log("FAIL", id, name, "-", e?.message ?? e); }
}

// ---------------- the run ----------------
const b = await makeBrowser(origin + "/api-v2");
const p = b.page;
const sheetNote = () => p.eval(`document.getElementById('gen-sheet-offnote')?.textContent ?? null`);
const sheetAttempts = () => p.eval(`document.getElementById('gen-sheet-attempts')?.textContent ?? null`);
const startDisabled = () => p.eval(`document.querySelector('#gen-sheet .ui-btn-plum:last-child')?.disabled ?? document.getElementById('gen-sheet-start')?.disabled`);
const startBtnState = () => p.eval(`(() => { const btns = [...document.querySelectorAll('#gen-sheet .ui-row2 .ui-btn-plum')]; const start = btns.find(x => x.textContent.includes('Start') || x.textContent.includes('Starting')); return start ? start.disabled : null; })()`);
const waitSheetReady = async () => { await p.waitFor(`(document.getElementById('gen-sheet-attempts')?.textContent ?? '') !== 'Checking…'`, { label: "sheet quote rendered" }); };
const closeSheet = async () => { await p.eval(`document.getElementById('gen-sheet-cancel').click()`); await p.waitFor(`document.getElementById('gen-sheet').hidden`, { label: "sheet closed" }); };
const openBook = async (id) => {
  await p.eval(`document.getElementById('nav-library')?.click()`);
  await p.waitFor(`!!document.getElementById('open-${id}')`, { label: `library row ${id}` });
  await p.eval(`document.getElementById('open-${id}').click()`);
  await p.waitFor(`!!document.getElementById('book-genall')`, { label: "book screen rendered" });
};
const expandChapter = async (chapterId) => {
  await p.eval(`(() => { const body = document.getElementById('chap-body-${chapterId}'); if (body && body.hidden) document.getElementById('chap-toggle-${chapterId}').click(); })()`);
  await sleep(250);
};
const fingerprint = () => p.eval(`(async () => {
  const ls = {};
  for (const k of ['cs:shelf-bridge:v1', 'cs:state:backend', 'cs:state:meta', 'cs:state:v1']) ls[k] = localStorage.getItem(k);
  const idb = await new Promise((resolve) => {
    const req = indexedDB.open('opalreader-v2-state');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) { resolve({}); return; }
      const tx = db.transaction('records', 'readonly');
      const values = tx.objectStore('records').getAll();
      const keys = tx.objectStore('records').getAllKeys();
      tx.oncomplete = () => { const out = {}; keys.result.forEach((k, i) => { out[k] = values.result[i]; }); resolve(out); };
      tx.onerror = () => resolve(null);
    };
  });
  return JSON.stringify({ ls, idb });
})()`, { awaitPromise: true });
let F0 = null;

await row("GP-1", "boot under sw-genpkg1, connect, library renders", async () => {
  await p.send("Page.navigate", { url: APP });
  await p.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-genpkg1.js')`, { label: "genpkg1 controller" });
  await p.waitFor(`!!document.getElementById('access-token')`, { label: "access screen" });
  await p.eval(`document.getElementById('access-token').value = ${JSON.stringify(TOKEN)}; document.getElementById('access-connect').click();`);
  await p.waitFor(`window.__opalReaderV2 && window.__opalReaderV2.screen() === 'library'`, { label: "library after connect" });
  await p.waitFor(`!!document.getElementById('open-gb') && !!document.getElementById('open-${FP_ID}')`, { label: "library rows" });
  assert((await p.eval(`window.__opalReaderV2.generationInfo().connected`)) === true, "generation session connected");
  await sleep(1200);
  F0 = await fingerprint();
  assert(F0 && F0.length > 10, "fingerprint captured");
  return { marker: await p.eval(`window.__opalReaderV2.buildMarker`) };
});

await row("GP-2", "sheet renders the server quote; Batch disabled with its server reason", async () => {
  await openBook("gb");
  await p.eval(`document.getElementById('book-actions-toggle').click()`);
  await p.eval(`document.getElementById('book-genall').click()`);
  await p.waitFor(`!document.getElementById('gen-sheet').hidden`, { label: "sheet open" });
  await waitSheetReady();
  const attempts = await sheetAttempts();
  assert(attempts.includes("3 segments") && attempts.includes("3,992 characters"), `attempts: ${attempts}`);
  const cost = await p.eval(`document.getElementById('gen-sheet-cost')?.textContent`);
  assert(cost === "$0.06 (estimate)", `cost: ${cost}`);
  const excl = await p.eval(`document.getElementById('gen-sheet-exclusions')?.textContent`);
  assert(excl.includes("1 already has audio"), `exclusions: ${excl}`);
  assert((await p.eval(`document.getElementById('gen-sheet-batch').disabled`)) === true, "Batch disabled");
  const cap = await p.eval(`document.getElementById('gen-sheet-lanecap')?.textContent`);
  assert(cap.includes("Batch isn't enabled yet"), `lane caption: ${cap}`);
  assert((await startBtnState()) === false, "Start enabled");
  assert((await p.eval(`document.getElementById('gen-sheet-quota').getAttribute('aria-checked')`)) === "true", "keep-going on for book scope");
  return { attempts, cost };
});

await row("GP-3", "double-tap submits exactly ONE SubmitJob of the pinned shape", async () => {
  const before = commands.length;
  await p.eval(`(() => { const btns = [...document.querySelectorAll('#gen-sheet .ui-row2 .ui-btn-plum')]; const start = btns.find(x => x.textContent.includes('Start')); start.click(); start.click(); })()`);
  await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').startsWith('Started.')`, { label: "started note" });
  await sleep(600);
  assert(commands.length === before + 1, `commands after double-tap: ${commands.length - before}`);
  const cmd = commands[commands.length - 1];
  assert(cmd.type === "SubmitJob" && typeof cmd.command_id === "string" && cmd.command_id.length >= 8, "command head");
  assert(cmd.payload.bookId === "gb" && cmd.payload.lane === "standard", "payload book/lane");
  const di = cmd.payload.data.d6Intent;
  assert(di.scope === "book" && di.keepGoing === true && di.phase === null, `intent: ${JSON.stringify(di)}`);
  assert((await p.eval(`window.__opalReaderV2.generationInfo().sheetPlanId`)) === "plan-stub-1", "receipt planId on the introspection handle");
  return { planId: "plan-stub-1" };
});

await row("GP-4", "reopening the same scope reroutes to the active plan (no second submit)", async () => {
  await closeSheet();
  const before = commands.length;
  await p.eval(`document.getElementById('book-genall').click()`);
  await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').includes('already being generated')`, { label: "reroute note" });
  // Round-1 B2: the reroute names the EXISTING plan's own lane +
  // continuation semantics, never a bare "already running".
  const rerouteNote = await sheetNote();
  assert(rerouteNote.includes("Standard lane") && rerouteNote.includes("continues through the rest of the book"),
    `reroute names the plan's semantics: ${rerouteNote}`);
  assert((await startBtnState()) === true, "Start disabled on reroute");
  assert((await p.eval(`document.getElementById('gen-sheet-view').hidden`)) === false, "View progress offered");
  await sleep(400);
  assert(commands.length === before, "no second submit");
  await p.eval(`document.getElementById('gen-sheet-view').click()`);
  await p.waitFor(`window.__opalReaderV2.screen() === 'generation'`, { label: "generation view" });
  await p.waitFor(`!!document.getElementById('genline-plan-stub-1')`, { label: "plan line rendered" });
  const line = await p.eval(`document.getElementById('genline-plan-stub-1')?.textContent`);
  assert(line && line.includes("Whole book — Working — 0 of 3 done"), `plan line: ${line}`);
  return { line };
});

await row("GP-5", "Generation view discovers the Wren-submitted plan; budget line from server amounts", async () => {
  await p.waitFor(`(document.getElementById('generation-summary')?.textContent ?? '').startsWith('Generation is on.')`, { label: "view summary rendered" });
  await p.waitFor(`!!document.getElementById('genline-plan-wren-fp')`, { label: "wren plan line rendered" });
  const summary = await p.eval(`document.getElementById('generation-summary')?.textContent`);
  assert(summary.includes("Generation is on."), `summary: ${summary}`);
  assert(summary.includes("budget $13.50") && summary.includes("settled $0.02") && summary.includes("$13.48 left"), `budget line: ${summary}`);
  const wren = await p.eval(`document.getElementById('genline-plan-wren-fp')?.textContent`);
  assert(wren && wren.includes("Fixture Forever") && wren.includes("Chapter 4") && wren.includes("Settled $0.02"), `wren plan: ${wren}`);
  const anyResume = await p.eval(`[...document.querySelectorAll('#generation-list button')].some(x => /resume|restart|retry/i.test(x.textContent))`);
  assert(anyResume === false, "no resume/restart/retry control anywhere in the view");
  return { summary };
});

await row("GP-14", "halted_unknown plan: accurate money labels, plain stop reason, no retry affordance", async () => {
  // A SYNTHETIC halted_unknown plan (round-2 correction R2-3).
  // The round-1 fixture reused the production FP Ch 2 halt's
  // numbers — including 353736 micro-cents as settledMicroCents —
  // and called itself that halt's "exact shape". That figure was
  // the GRANT-TIME ESTIMATE/debit from the Ch 2 diagnosis, NOT
  // known-settled spend, and presenting it as settled was wrong.
  // This fixture therefore uses clearly synthetic amounts: a
  // round known-settled figure ($0.30) in settledMicroCents, and
  // the unconfirmed charge represented SEPARATELY — by the
  // halted_unknown state and its qualifier text — never folded
  // into the settled figure. A real Ch 2 display waits on the
  // attempt-log accounting, not on any figure reused here.
  planStore.unshift({
    planId: "plan-halted-synthetic", bookId: FP_ID, scope: "chapter", chapterIndex: 1, lane: "standard",
    keepGoing: false, phase: "forever-pucked", state: "halted_unknown",
    stopReason: "phase_halted_unknown_billing",
    totals: { eligible: 12, done: 4, failed: 2, blocked: 0, prompts: 0 },
    settledMicroCents: 300000, bindingsPublished: 0, bindingsPending: 0,
    createdAt: "2026-10-30T00:00:00.000Z", updatedAt: "2026-10-30T00:01:00.000Z",
  });
  const before = commands.length;
  // The view polls while any non-terminal plan exists; the new
  // line appears on the next refresh.
  await p.waitFor(`!!document.getElementById('genline-plan-halted-synthetic')`, { label: "halted plan line rendered", timeout: 20000 });
  const line = await p.eval(`document.getElementById('genline-plan-halted-synthetic')?.textContent`);
  assert(line && line.includes("a charge needs checking"), `plain-language stop reason: ${line}`);
  assert(line.includes("Settled $0.30"), `settled (known-settled, synthetic) figure present: ${line}`);
  assert(line.includes("isn't confirmed yet"), `unconfirmed charge called out, never folded into a total: ${line}`);
  assert(!/bill(ed)?\b|spent at/i.test(line), `no provider-bill language: ${line}`);
  assert(line.includes("Standard lane"), `the plan's lane is named: ${line}`);
  const anyRetry = await p.eval(`[...document.querySelectorAll('#generation-list button')].some(x => /resume|restart|retry/i.test(x.textContent))`);
  assert(anyRetry === false, "no retry/resume affordance for a halted_unknown plan");
  await sleep(600);
  assert(commands.length === before, "viewing a halted plan submits nothing (no implicit retry)");
  return { line };
});

await row("GP-6", "chapter scope submits scoped: chapterIndex + keepGoing false", async () => {
  await openBook("gb");
  await expandChapter("gb-ch2");
  const before = commands.length;
  await p.eval(`document.getElementById('gen-chap-gb-ch2').click()`);
  await waitSheetReady();
  const attempts = await sheetAttempts();
  assert(attempts.includes("1 segment"), `chapter attempts: ${attempts}`);
  assert((await p.eval(`document.getElementById('gen-sheet-quota').disabled`)) === true, "keep-going disabled outside book scope");
  await p.eval(`(() => { const btns = [...document.querySelectorAll('#gen-sheet .ui-row2 .ui-btn-plum')]; btns.find(x => x.textContent.includes('Start')).click(); })()`);
  await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').startsWith('Started.')`, { label: "chapter started" });
  assert(commands.length === before + 1, "one chapter submit");
  const di = commands[commands.length - 1].payload.data.d6Intent;
  assert(di.scope === "chapter" && di.chapterIndex === 1 && di.keepGoing === false, `chapter intent: ${JSON.stringify(di)}`);
  await closeSheet();
  return { intent: di };
});

await row("GP-7", "parked chapter: Start never offered, parked wording, nothing submitted", async () => {
  await openBook(FP_ID);
  await expandChapter("fp-ch3");
  const before = commands.length;
  await p.eval(`document.getElementById('gen-chap-fp-ch3').click()`);
  await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').includes('parked')`, { label: "parked note" });
  assert((await startBtnState()) === true, "Start disabled for parked chapter");
  assert((await sheetAttempts()).includes("Nothing to generate here"), "attempts line");
  await sleep(300);
  assert(commands.length === before, "nothing submitted for parked content");
  await closeSheet();
  return { note: await sheetNote().catch(() => null) };
});

await row("GP-8", "voice_prompt segment: 'needs a voice choice first', no control submits", async () => {
  await expandChapter("fp-ch4");
  const before = commands.length;
  await p.eval(`document.getElementById('gen-seg-f9').click()`);
  await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').includes('voice choice first')`, { label: "voice note" });
  assert((await startBtnState()) === true, "Start disabled for voice_prompt segment");
  await sleep(300);
  assert(commands.length === before, "nothing submitted for voice_prompt content");
  await closeSheet();
  return {};
});

await row("GP-9", "FP book submit carries the phase from server capabilities", async () => {
  await p.eval(`document.getElementById('book-actions-toggle').click()`);
  const before = commands.length;
  await p.eval(`document.getElementById('book-genall').click()`);
  await waitSheetReady();
  const attempts = await sheetAttempts();
  assert(attempts.includes("1 segment"), `FP attempts: ${attempts}`);
  const excl = await p.eval(`document.getElementById('gen-sheet-exclusions')?.textContent`);
  assert(excl.includes("parked") && excl.includes("voice choice"), `FP exclusions: ${excl}`);
  await p.eval(`(() => { const btns = [...document.querySelectorAll('#gen-sheet .ui-row2 .ui-btn-plum')]; btns.find(x => x.textContent.includes('Start')).click(); })()`);
  await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').startsWith('Started.')`, { label: "FP started" });
  assert(commands.length === before + 1, "one FP submit");
  const di = commands[commands.length - 1].payload.data.d6Intent;
  assert(di.scope === "book" && di.phase === "forever-pucked", `FP intent: ${JSON.stringify(di)}`);
  await closeSheet();
  return { intent: di };
});

await row("GP-10", "timeout-after-accepted-submit: plan re-read reports Started, no blind resubmit", async () => {
  await openBook("gb");
  const before = commands.length;
  const wireBefore = wireCommands.length;
  commandResponseDrops = 5; // lose the response AND every browser re-delivery of it
  await p.eval(`document.getElementById('gen-seg-g3').click()`);
  await waitSheetReady();
  await p.eval(`(() => { const btns = [...document.querySelectorAll('#gen-sheet .ui-row2 .ui-btn-plum')]; btns.find(x => x.textContent.includes('Start')).click(); })()`);
  await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').includes('answer was lost')`, { label: "lost-answer note", timeout: 30000 });
  await sleep(500);
  assert(commands.length === before + 1, `coordinator recorded exactly one logical command: +${commands.length - before}`);
  const copies = wireCommands.slice(wireBefore);
  assert(copies.length >= 1 && copies.every((c) => c.command_id === copies[0].command_id),
    `every wire copy carries the one command_id the client minted (no client resubmit): ${copies.length} copies`);
  const segPlans = planStore.filter((x) => x.bookId === "gb" && x.scope === "segment");
  assert(segPlans.length === 1, `exactly one segment plan exists after the dropped submit: ${segPlans.length}`);
  assert((await p.eval(`document.getElementById('gen-sheet-view').hidden`)) === false, "View progress offered after recovery");
  await closeSheet();
  return { wireCopies: copies.length };
});

await row("GP-11", "state record + Shelf record byte-stable across all generation flows", async () => {
  await sleep(800);
  const F1 = await fingerprint();
  assert(F1 === F0, "fingerprint drift across generation flows");
  return { bytes: F1.length };
});

await row("GP-12", "halted capabilities: Start never offered", async () => {
  capsMode = "halted";
  try {
    await p.eval(`document.getElementById('gen-seg-g2').click()`);
    await p.waitFor(`(document.getElementById('gen-sheet-offnote')?.textContent ?? '').includes('paused on the server')`, { label: "halted note" });
    assert((await startBtnState()) === true, "Start disabled while halted");
    await closeSheet();
  } finally { capsMode = "enabled"; }
  return {};
});

await row("GP-13", "rollback: ui-pkg-4 boots on the same state untouched; gen build boots after it", async () => {
  await p.send("Page.navigate", { url: APP_UI4 });
  await p.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui4.js')`, { label: "ui4 controller" });
  await p.waitFor(`!!document.getElementById('access-token')`, { label: "ui4 access screen" });
  await p.eval(`document.getElementById('access-token').value = ${JSON.stringify(TOKEN)}; document.getElementById('access-connect').click();`);
  await p.waitFor(`window.__opalReaderV2 && window.__opalReaderV2.screen() === 'library'`, { label: "ui4 library" });
  await sleep(1000);
  const F2 = await fingerprint();
  // The one volatile field is the state record's sync-summary
  // "at" timestamp — the accepted shell rewrites it on EVERY
  // connect, in both builds (bookkeeping, not migration). Strip
  // it and require byte-equality of everything else.
  // (The record is a JSON string inside the fingerprint's JSON,
  // so the scrub runs on the parsed values, not the raw text.)
  const stable = (s) => {
    const o = JSON.parse(s);
    // The IDB record value is a structured object (not a string):
    // scrub every "at" timestamp structurally, at any depth.
    const scrubDeep = (x) => {
      if (typeof x === "string" && (x.startsWith("{") || x.startsWith("["))) {
        // The state record rides as a JSON string inside the IDB
        // record's value field: scrub inside it too.
        try { return JSON.stringify(scrubDeep(JSON.parse(x))); } catch { return x; }
      }
      if (Array.isArray(x)) return x.map(scrubDeep);
      if (x && typeof x === "object") {
        const out = {};
        for (const [k, v] of Object.entries(x))
          out[k] = (k === "at" && typeof v === "string") ? "<ts>" : scrubDeep(v);
        return out;
      }
      return x;
    };
    const scrubValue = (v) => {
      if (typeof v !== "string") return scrubDeep(v);
      try { return JSON.stringify(scrubDeep(JSON.parse(v))); } catch { return v; }
    };
    for (const k of Object.keys(o.ls)) o.ls[k] = scrubValue(o.ls[k]);
    for (const k of Object.keys(o.idb ?? {})) o.idb[k] = scrubValue(o.idb[k]);
    return JSON.stringify(o);
  };
  assert(stable(F2) === stable(F0), "state drifted under the rollback build (beyond the sync-run timestamp)");
  assert(JSON.stringify(JSON.parse(F2).idb["cs:state:v1"]).length === JSON.stringify(JSON.parse(F0).idb["cs:state:v1"]).length, "state record length changed under rollback");
  await p.send("Page.navigate", { url: APP });
  await p.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-genpkg1.js')`, { label: "gen controller again" });
  await p.waitFor(`!!document.getElementById('access-token')`, { label: "gen access screen again" });
  await p.eval(`document.getElementById('access-token').value = ${JSON.stringify(TOKEN)}; document.getElementById('access-connect').click();`);
  await p.waitFor(`window.__opalReaderV2 && window.__opalReaderV2.screen() === 'library'`, { label: "gen library again" });
  const F3 = await fingerprint();
  assert(stable(F3) === stable(F0), "state drifted returning to the gen build (beyond the sync-run timestamp)");
  return { ui4Marker: "d5b-v2-playback-client-15 (rollback base)" };
});

const failed = rows.filter((r) => r[1] !== "PASS");
console.log(`\nCHROMIUM PROOF: ${rows.length - failed.length}/${rows.length} PASS; page exceptions: ${p.exceptions.length}`);
if (p.exceptions.length) console.log("exceptions:", p.exceptions.slice(0, 3).join(" | "));
try { b.chrome.kill("SIGKILL"); } catch {}
server.close();
process.exit(failed.length || p.exceptions.length ? 1 : 0);
