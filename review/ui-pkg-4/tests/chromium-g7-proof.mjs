// G7 Chromium proof (LOCAL ONLY, zero production contact).
// Design §9 rows T7 (full-size browser sync), T8 (real-quota
// legacy classification) and T11 (eviction fail-closed), plus the
// §10 attended-gate shape rehearsed locally: migration at Connect,
// drain 12->18 at the measured production sizes, state resident
// in IndexedDB, legacy snapshot byte-identical, Shelf outbox of 7
// preserved, playback smoke, restart persistence.
// Tree under test: UI4_TREE env var, default ../tree-a (the
// package run points it at ../package/publish).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { DEVICE_ID, PAGE_SIZES, SEED_TARGET_CHARS, shelfRecordRaw, PREFS_RAW } from "./g7-fixtures.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TREE = process.env.UI4_TREE ? path.resolve(ROOT, process.env.UI4_TREE) : path.join(ROOT, "tree-a");
const TOKEN = "proof-token-123";
const PROBE_KEY = "c10cb90e978621a98590e17b16e5bfb2090c9b78d8a3bfdeb55162bfa429067a";
const hex = (i) => i.toString(16).padStart(64, "0");
const FH_AUDIO_KEY = hex(42);
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ---------------- fixtures (production wire shapes) ----------------
const BOOK_IDS = ["book-fh", "book-b2", "book-b3", "book-b4", "book-b5", "book-b6", "book-b7"];
function bookPayload(id, pad) {
  return { bookId: id, title: `Synthetic ${id}`, author: "Fixture Author",
    chapters: [{ chapterId: `${id}-ch1`, index: 0, segments: [{ occurrenceId: id === "book-fh" ? "occ-fh-1" : `${id}-occ-1` }] }],
    pad };
}
function seedRecordRaw() {
  const build = (pad) => {
    const entities = {};
    entities["book-fh"] = { payload: bookPayload("book-fh", pad), revision: 1 };
    BOOK_IDS.slice(1).forEach((id, i) => { entities[id] = { payload: bookPayload(id, "y".repeat(60000 + i * 7919)), revision: 1 }; });
    const bindings = {};
    bindings["book-fh:occ-fh-1"] = { payload: { cacheKey: FH_AUDIO_KEY, sha256: FH_AUDIO_KEY, format: "wav", sizeBytes: 480044 }, revision: 1 };
    for (let i = 0; i < 1798; i += 1) bindings[`book-pad:occ-${i}`] = { payload: { cacheKey: hex(1000 + i), sha256: hex(1000 + i), format: "wav", sizeBytes: 480044 }, revision: 1 };
    return {
      schemaVersion: 1, deviceId: DEVICE_ID, commandCounter: 41,
      outbox: [
        { commandId: "cmd-40", type: "confirm_bytes", status: "acked", enqueuedAt: 1, attempts: 1, payload: {} },
        { commandId: "cmd-41", type: "journal_append", status: "pending", enqueuedAt: 2, attempts: 0, payload: {} },
      ],
      journals: { "book-fh": [{ seq: 1, type: "position", at: 1 }, { seq: 2, type: "bookmark", at: 2 }] },
      journalCounters: { "book-fh": 2 },
      caches: {
        content: { floor: 0, tip: 12, cursor: 12, entities, tombstones: {} },
        bindings: { floor: 0, tip: 1799, cursor: 1799, entities: bindings, tombstones: {} },
      },
      bytes: {}, money: {},
      drainStatus: { content: { family: "content", complete: false, reason: "network_error", cursor: 12, tip: 12, pages: 1, at: "2026-10-29T00:00:00.000Z" } },
    };
  };
  const probe = JSON.stringify(build(""));
  const raw = JSON.stringify(build("x".repeat(SEED_TARGET_CHARS - probe.length)));
  if (raw.length !== SEED_TARGET_CHARS) throw new Error(`seed ${raw.length} != ${SEED_TARGET_CHARS}`);
  return raw;
}
const SEED_RAW = seedRecordRaw();
const SEED_SHA = sha256(SEED_RAW);
function pageChanges() {
  return BOOK_IDS.slice(1).map((id, i) => {
    const base = { ...bookPayload(id, ""), enriched: true };
    const probeLen = JSON.stringify(base).length;
    const payload = { ...base, pad: "z".repeat(PAGE_SIZES[i] - probeLen) };
    if (JSON.stringify(payload).length !== PAGE_SIZES[i]) throw new Error("page payload sizing");
    return { seq: 13 + i, op: "upsert", entityKey: id, bookId: id, revision: 2, payload };
  });
}
const CHANGES = pageChanges();
const SETTINGS_LOG = [
  { seq: 1, op: "upsert", entityKey: "settings", bookId: "settings", revision: 0, payload: { monthlyCap: 50, geminiLane: "batch" } },
];

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
const ETAG = '"stub-etag-1"';
const reqLog = [];

// ---------------- server ----------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
function coordinator(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname.replace(/^\/api-v2/, "");
  const send = (code, obj, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(obj === null ? "" : JSON.stringify(obj)); };
  // Table C step C1: the wrong-instance probe must be refused.
  if (req.headers["x-opalreader-instance"] === "preflight-wrong-instance") return send(403, { error: "production_instance_required" });
  if (req.headers["x-opalreader-token"] !== TOKEN) return send(401, { error: "unauthorized" });
  if (p === "/v2/settings") return send(200, { monthlyCap: 50, geminiLane: "batch", revision: 0 });
  if (p === "/v2/sync/changes") {
    const family = u.searchParams.get("family");
    const since = Number(u.searchParams.get("sinceSeq") ?? 0);
    const limit = Number(u.searchParams.get("limit") ?? 100);
    const log = family === "content" ? CHANGES : family === "settings" ? SETTINGS_LOG : [];
    const hw = family === "content" ? 18 : family === "bindings" ? 1799 : family === "settings" ? 1 : 0;
    const slice = log.filter((c) => c.seq > since && c.seq <= since + limit);
    return send(200, { family, changes: slice, nextSeq: slice.length ? slice[slice.length - 1].seq : since, highWatermark: hw });
  }
  if (p === "/v2/sync/snapshot") {
    const family = u.searchParams.get("family");
    const entities = family === "settings" ? SETTINGS_LOG.map((c) => ({ entityKey: c.entityKey, bookId: c.bookId, revision: c.revision, data: c.payload })) : [];
    return send(200, { family, watermark: family === "content" ? 18 : family === "bindings" ? 1799 : family === "settings" ? 1 : 0, entities });
  }
  if (p.startsWith("/v2/sync/byte-check/")) return send(200, { exists: true });
  if (p.startsWith("/v2/sync/audio/")) {
    const AUDIO = p.includes(PROBE_KEY) ? AUDIO_PROBE : AUDIO_LONG;
    const inm = req.headers["if-none-match"];
    const range = req.headers["range"];
    if (inm && inm === ETAG) { res.writeHead(304, { etag: ETAG }); return res.end(); }
    if (req.method === "HEAD") { res.writeHead(200, { "content-length": String(AUDIO.length), etag: ETAG }); return res.end(); }
    if (range === "bytes=0-0") { res.writeHead(206, { "content-range": `bytes 0-0/${AUDIO.length}`, etag: ETAG, "content-length": "1" }); return res.end(AUDIO.subarray(0, 1)); }
    res.writeHead(200, { "content-length": String(AUDIO.length), etag: ETAG }); return res.end(AUDIO);
  }
  if (p.startsWith("/v2/sync/position/")) return send(200, { canonical: null, asOfReceiptSeq: 0, supersededCount: 0, journalGaps: [] });
  if (p === "/v2/sync/position") return send(200, { receipts: [], rejected: [], tip: 0, journalGaps: [] });
  return send(404, { error: "no_route" }); // /v2/commands included: outbox flush fails, items stay pending
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api-v2") || u.pathname.startsWith("/api-shelf")) reqLog.push(`${req.method} ${u.pathname}`);
  if (u.pathname.startsWith("/api-v2/")) return coordinator(req, res);
  if (u.pathname === "/api-shelf/api/sessions" && req.method === "POST") {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      // Mirror the device truth: the resident outbox item's
      // read-through is inactive, so the bridge gets a 409 and the
      // queue is preserved.
      res.writeHead(409, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "read_through_not_active" }));
    });
    return;
  }
  const rel = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
  const file = path.join(TREE, rel);
  if (!file.startsWith(TREE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const APP = origin + "/";

// ---------------- CDP plumbing (pattern from the UI3 proof) ----------------
const rows = [];
function assert(c, m) { if (!c) throw new Error(m); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.onEvent = null;
    ws.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); }
      else if (d.method && this.onEvent) this.onEvent(d); }; }
  send(method, params = {}) { return new Promise((res, rej) => { const id = ++this.id; const to = setTimeout(() => { this.pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); }, 30000); this.pending.set(id, (v) => { clearTimeout(to); res(v); }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expr, { awaitPromise = false } = {}) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
    if (r.result?.exceptionDetails) throw new Error("page exception: " + JSON.stringify(r.result.exceptionDetails).slice(0, 500));
    return r.result?.result?.value;
  }
  async waitFor(expr, { timeout = 60000, label = expr } = {}) {
    const t0 = Date.now();
    for (;;) { const v = await this.eval(expr, { awaitPromise: true }).catch(() => false); if (v) return true;
      if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for: ${label}`); await sleep(300); }
  }
}
const WEBGL_POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const WEBGL_SHA = crypto.createHash("sha256").update(fs.readFileSync(WEBGL_POLICY)).digest("hex");
async function makeBrowser(seedScript) {
  const profile = fs.mkdtempSync("/tmp/ui4-g7-profile-");
  const dbgPort = 21000 + Math.floor(Math.random() * 1500);
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
    if (d.method === "Fetch.requestPaused") {
      const url = d.params.request.url;
      if (url.startsWith(origin) || url.startsWith("about:") || url.startsWith("data:") || url.startsWith("blob:")) page.send("Fetch.continueRequest", { requestId: d.params.requestId }).catch(() => {});
      else page.send("Fetch.failRequest", { requestId: d.params.requestId, errorReason: "Aborted" }).catch(() => {});
    }
  };
  await page.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: seedScript });
  return { chrome, page };
}
async function row(id, name, fn) {
  try { const ev = await fn(); rows.push([id, "PASS"]); console.log("PASS", id, name, ev ? JSON.stringify(ev).slice(0, 260) : ""); }
  catch (e) { rows.push([id, "FAIL"]); console.log("FAIL", id, name, "-", e?.message ?? e); }
}
const seedSource = (noIdb) => `
  window.__OPAL_V2_BASE_URL__ = ${JSON.stringify(origin + "/api-v2")};
  window.__OPAL_V2_SHELF_BASE_URL__ = ${JSON.stringify(origin + "/api-shelf")};
  ${noIdb ? "try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {}" : ""}
  try {
    if (location.origin === ${JSON.stringify(origin)} && !localStorage.getItem('g7:seeded')) {
      localStorage.setItem('cs:state:v1', ${JSON.stringify(SEED_RAW)});
      localStorage.setItem('cs:shelf-bridge:v1', ${JSON.stringify(shelfRecordRaw(7))});
      localStorage.setItem('opalreader.v2.uiPrefs', ${JSON.stringify(PREFS_RAW)});
      localStorage.setItem('opalreader.v2.deviceId', ${JSON.stringify(DEVICE_ID)});
      localStorage.setItem('g7:seeded', '1');
    }
  } catch (e) {}
`;
const idbRead = (expr) => `(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('opalreader-v2-state', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out = await (${expr});
  db.close();
  return out;
})()`;
const idbStateRaw = idbRead(`new Promise((res, rej) => { const rq = db.transaction('records', 'readonly').objectStore('records').get('cs:state:v1'); rq.onsuccess = () => res(rq.result ? rq.result.value : null); rq.onerror = () => rej(rq.error); })`);
const idbMeta = idbRead(`new Promise((res, rej) => { const rq = db.transaction('records', 'readonly').objectStore('records').get('cs:state:meta'); rq.onsuccess = () => res(rq.result ? JSON.parse(rq.result.value) : null); rq.onerror = () => rej(rq.error); })`);
async function connect(page) {
  await page.waitFor(`!!document.getElementById('access-token')`, { label: "access screen" });
  await page.eval(`document.getElementById('access-token').value = ${JSON.stringify(TOKEN)}; document.getElementById('access-connect').click();`);
}

// ---------------- T7: full-size migration + drain ----------------
const b1 = await makeBrowser(seedSource(false));
const p1 = b1.page;
await p1.send("Page.navigate", { url: APP });
await row("P0", "boot: ui-pkg-4 shell up; pre-connect snapshot reads the legacy posture (content 12, no marker yet)", async () => {
  await p1.waitFor(`!!window.__opalReaderV2`, { label: "shell ready" });
  const bm = await p1.eval(`window.__opalReaderV2.buildMarker`);
  const pm = await p1.eval(`window.__opalReaderV2.packagingMarker`);
  assert(bm === "d5b-v2-playback-client-15" && pm === "ui-pkg-4", `markers ${bm}/${pm}`);
  const info = await p1.eval(`window.__opalReaderV2.storageInfo()`);
  assert(info.backend === "localstorage", `pre-migration backend ${JSON.stringify(info)}`);
  const snap = await p1.eval(`window.__opalReaderV2.stateRecord()`);
  assert(snap?.caches?.content?.cursor === 12, `snapshot cursor ${snap?.caches?.content?.cursor}`);
  return { bm, pm };
});
let metaBefore = null;
await row("P1", "T7 connect: migration verifies + cuts over; content drains 12->18 COMPLETE at full size; Diagnostics truthful", async () => {
  await connect(p1);
  try { await p1.waitFor(`window.__opalReaderV2.screen() === 'library'`, { label: "library after connect", timeout: 120000 }); }
  catch (e) { const txt = await p1.eval(`document.getElementById('v2shell').innerText`).catch(() => "?"); throw new Error(`${e.message} :: shell: ${String(txt).slice(0, 700)}`); }
  const sync = await p1.eval(`window.__opalReaderV2.syncSummary()`);
  const c = sync.find((d) => d.family === "content");
  const b = sync.find((d) => d.family === "bindings");
  assert(c && c.complete === true && c.cursor === 18 && c.tip === 18, `content drain ${JSON.stringify(c)}`);
  assert(b && b.complete === true && b.cursor === 1799, `bindings drain ${JSON.stringify(b)}`);
  metaBefore = await p1.eval(idbMeta, { awaitPromise: true });
  assert(metaBefore && metaBefore.sourceChars === SEED_TARGET_CHARS, `meta ${JSON.stringify(metaBefore).slice(0, 200)}`);
  // Diagnostics (Settings screen)
  await p1.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Settings')?.click()`);
  await p1.waitFor(`!!document.getElementById('diag-state-storage')`, { label: "diagnostics rendered" });
  const stateRow = await p1.eval(`document.getElementById('diag-state-storage').textContent`);
  const contentRow = await p1.eval(`document.getElementById('diag-sync-content').textContent`);
  const bindingsRow = await p1.eval(`document.getElementById('diag-sync-bindings').textContent`);
  const shelfRow = await p1.eval(`document.getElementById('diag-shelf-pending').textContent`);
  assert(stateRow.includes("IndexedDB"), `state storage row: ${stateRow}`);
  assert(contentRow.includes("COMPLETE"), `content row: ${contentRow}`);
  assert(bindingsRow.includes("1799/1799"), `bindings row: ${bindingsRow}`);
  assert(shelfRow.trim() === "7", `shelf pending row: ${shelfRow}`);
  return { stateRow: stateRow.slice(0, 120), contentRow };
});
await row("P2", "T7 residence: state lives in IDB at full enriched size; legacy snapshot byte-identical; outbox + journals preserved", async () => {
  const raw = await p1.eval(idbStateRaw, { awaitPromise: true });
  // ~8.67M chars: the design's 8.28M content record plus the
  // settings/position caches and drain-status entries the connect
  // added (the T8 diag measured the same 8,669,485 attempted).
  assert(typeof raw === "string" && raw.length > 8500000 && raw.length < 8800000, `IDB record chars ${raw?.length}`);
  const rec = JSON.parse(raw);
  assert(rec.caches.content.cursor === 18 && Object.keys(rec.caches.content.entities).length === 7, "content cursor/entities in IDB");
  assert(Object.keys(rec.caches.bindings.entities).length === 1799, "bindings inventory in IDB");
  assert(rec.outbox.length === 2 && rec.outbox.filter((o) => o.status === "pending").length === 1, "pending outbox command preserved through migration + drains");
  assert(rec.journals["book-fh"].length === 2 && rec.commandCounter === 41, "journals + commandCounter preserved");
  const legacySha = await p1.eval(`(async () => { const s = localStorage.getItem('cs:state:v1'); const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join(''); })()`, { awaitPromise: true });
  assert(legacySha === SEED_SHA, `legacy snapshot sha ${legacySha} != seed ${SEED_SHA}`);
  const marker = await p1.eval(`localStorage.getItem('cs:state:backend')`);
  assert(marker && JSON.parse(marker).backend === "indexeddb", "cutover marker present");
  return { idbChars: raw.length };
});
await row("P3", "T7 library renders 7 books; playback smoke of an existing binding reaches the audio pipeline", async () => {
  await p1.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Library')?.click()`);
  await p1.waitFor(`!!document.getElementById('open-book-fh')`, { label: "library rows" });
  const rowsCount = await p1.eval(`document.querySelectorAll('[id^="open-book-"]').length`);
  assert(rowsCount === 7, `library book rows ${rowsCount}`);
  const before = reqLog.filter((r) => r.includes(FH_AUDIO_KEY)).length;
  await p1.eval(`document.getElementById('open-book-fh').click()`);
  await p1.waitFor(`!!document.getElementById('play-occ-fh-1')`, { label: "segment Play button (play-<occurrenceId>)" });
  await p1.eval(`document.getElementById('play-occ-fh-1').click()`);
  await sleep(6000);
  const audioHits = reqLog.filter((r) => r.includes("/v2/sync/audio/") && r.includes(FH_AUDIO_KEY)).length;
  const bodyText = await p1.eval(`document.getElementById('v2shell').innerText`);
  assert(audioHits > before, `audio pipeline engaged for the bound segment (hits ${audioHits}; recent reqs: ${reqLog.slice(-6).join(" | ")}; screen: ${bodyText.slice(0, 400)})`);
  assert(/pause/i.test(bodyText) || audioHits > before, "player engaged");
  return { audioHits };
});
await row("P4", "T7 restart: state persists from IDB, no re-migration, legacy still byte-identical, reconnect is a no-op drain", async () => {
  await p1.eval(`location.reload()`);
  await p1.waitFor(`!!window.__opalReaderV2`, { label: "shell after reload" });
  // The boot snapshot resolves asynchronously from IndexedDB;
  // wait for it rather than racing it.
  await p1.waitFor(`window.__opalReaderV2.storageInfo().backend === 'indexeddb'`, { label: "boot snapshot resolved from IDB", timeout: 30000 });
  const info = await p1.eval(`window.__opalReaderV2.storageInfo()`);
  const snap = await p1.eval(`window.__opalReaderV2.stateRecord()`);
  assert(snap?.caches?.content?.cursor === 18, `snapshot cursor after reload ${snap?.caches?.content?.cursor}`);
  const metaAfter = await p1.eval(idbMeta, { awaitPromise: true });
  assert(metaAfter.migratedAt === metaBefore.migratedAt, "no re-migration on relaunch (meta untouched)");
  const legacySha = await p1.eval(`(async () => { const s = localStorage.getItem('cs:state:v1'); const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join(''); })()`, { awaitPromise: true });
  assert(legacySha === SEED_SHA, "legacy snapshot still byte-identical after restart");
  await connect(p1);
  await p1.waitFor(`window.__opalReaderV2.screen() === 'library'`, { label: "library after reconnect", timeout: 120000 });
  const sync = await p1.eval(`window.__opalReaderV2.syncSummary()`);
  const c = sync.find((d) => d.family === "content");
  assert(c && c.complete === true && c.cursor === 18, `reconnect drain ${JSON.stringify(c)}`);
  return { backend: info.backend };
});
await row("P5", "T11 eviction: IDB deleted in steady state -> Connect fails closed with storage_unavailable; stale legacy never served", async () => {
  await p1.eval(`location.reload()`);
  await p1.waitFor(`!!window.__opalReaderV2`, { label: "shell after reload (pre-eviction)" });
  const deleted = await p1.eval(`new Promise((res) => { const r = indexedDB.deleteDatabase('opalreader-v2-state'); r.onsuccess = () => res('ok'); r.onerror = () => res('error'); r.onblocked = () => res('blocked'); setTimeout(() => res('timeout'), 8000); })`, { awaitPromise: true });
  assert(deleted === "ok", `deleteDatabase result ${deleted}`);
  await connect(p1);
  await p1.waitFor(`document.getElementById('v2shell').innerText.includes('storage_unavailable')`, { label: "classified fail-closed surface", timeout: 60000 });
  const screen = await p1.eval(`window.__opalReaderV2.screen()`);
  assert(screen !== "library", `never reached the library on stale legacy (screen ${screen})`);
  const text = await p1.eval(`document.getElementById('v2shell').innerText`);
  assert(!text.includes("Synthetic book-fh"), "stale legacy library not rendered");
  return { deleted };
});
b1.chrome.kill();

// ---------------- T8: real quota on the forced legacy path ----------------
const b2 = await makeBrowser(seedSource(true));
const p2 = b2.page;
await p2.send("Page.navigate", { url: APP });
await row("P6", "T8 legacy path (IndexedDB unavailable at first launch): drain classifies storage_quota_exceeded against Chromium's real localStorage quota", async () => {
  await p2.waitFor(`!!window.__opalReaderV2`, { label: "shell ready (no IDB)" });
  const info = await p2.eval(`window.__opalReaderV2.storageInfo()`);
  assert(info.backend === "localstorage", `stays on legacy, classified: ${JSON.stringify(info).slice(0, 200)}`);
  await connect(p2);
  await p2.waitFor(`window.__opalReaderV2.screen() === 'library'`, { label: "library shell after connect", timeout: 120000 });
  const sync = await p2.eval(`window.__opalReaderV2.syncSummary()`);
  const c = sync.find((d) => d.family === "content");
  assert(c && c.complete === false && c.cursor === 12, `drain stopped at 12: ${JSON.stringify(c)}`);
  assert(c.reason === "storage_quota_exceeded", `classified reason (NOT network_error): ${c.reason}`);
  const snap = await p2.eval(`window.__opalReaderV2.stateRecord()`);
  assert(snap?.drainStatus?.content?.diag?.class === "storage_quota_exceeded", `persisted diag: ${JSON.stringify(snap?.drainStatus?.content?.diag)}`);
  assert(snap.drainStatus.content.diag.recordChars > 8000000, "attempted size in diag");
  return { reason: c.reason, diag: snap.drainStatus.content.diag };
});
b2.chrome.kill();

server.close();
const failed = rows.filter((r) => r[1] === "FAIL").length;
console.log(`chromium-g7-proof tree=${path.relative(ROOT, TREE)}: ${rows.length - failed}/${rows.length} passed`);
process.exit(failed ? 1 : 0);
