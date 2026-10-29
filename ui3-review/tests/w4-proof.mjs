// UI3 W-4 proof (LOCAL ONLY, zero production contact). Drives the
// real candidate app in Chromium against a stub coordinator whose
// byte-check route COUNTS requests per key and can fail (HTTP 500),
// abort (socket destroy), or HOLD (deferred response) per key —
// the transport-boundary stub for the store's byteCheck. Proves
// Amendment A-1's T1-T6 plus quota immobility (TQ):
//   T1 first successful play of an unconfirmed segment issues
//      exactly ONE byte-check GET, records the confirmation in the
//      device state, and the chapter pill advances (0/3 -> 1/3);
//   T2 replay of the confirmed segment issues ZERO further GETs;
//   T3 byte-check failures (500 + network abort): playback still
//      succeeds, nothing is recorded, exactly one attempt per
//      initiation (no retry), no unhandled rejections surface;
//   T4 Connect + sync drain + library/book/chapter browsing issue
//      ZERO byte-check GETs for any segment binding (the only
//      byte-check at Connect is the preflight's designated C3
//      probe, pre-existing accepted behaviour, counted separately);
//   T5 a failed start (media play() rejects on undecodable bytes)
//      issues ZERO byte-check GETs and records nothing;
//   T6 two play initiations for the same binding while its
//      byte-check response is held produce exactly ONE GET
//      (single-flight), and a post-settle initiation still totals
//      ONE GET (persisted early return) — the per-device bound;
//   TQ the money/quota counters in the device state are identical
//      before and after all of the above, and no /v2/commands POST
//      (generation) was ever issued.
// Tree under test: UI3_TREE env var, default ../tree-a.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TREE = process.env.UI3_TREE ? path.resolve(ROOT, process.env.UI3_TREE) : path.join(ROOT, "tree-a");
const CAND_INDEX = fs.readFileSync(path.join(TREE, "index.html"));
const hex = (i) => i.toString(16).padStart(64, "0");
const TOKEN = "proof-token-123";
const PROBE_KEY = "c10cb90e978621a98590e17b16e5bfb2090c9b78d8a3bfdeb55162bfa429067a";
const K_A2 = hex(601), K_A3 = hex(602);
const K_500 = hex(501), K_ABORT = hex(502), K_HELD = hex(503), K_GARBAGE = hex(604);

// ---------------- fixtures ----------------
const w4Book = { bookId: "w4", title: "Fixture W4", author: "Fixture Author",
  chapters: [
    { chapterId: "w4-ch1", index: 0, segments: [{ occurrenceId: "a1" }, { occurrenceId: "a2" }, { occurrenceId: "a3" }] },
    { chapterId: "w4-ch2", index: 1, segments: [{ occurrenceId: "b1" }, { occurrenceId: "b2" }] },
    { chapterId: "w4-ch3", index: 2, segments: [{ occurrenceId: "c1" }] },
    { chapterId: "w4-ch4", index: 3, segments: [{ occurrenceId: "d1" }] } ] };
const contentLog = [
  { seq: 1, op: "upsert", entityKey: "w4", bookId: "w4", revision: 1, payload: w4Book } ];
const binding = (seq, occ, key, format = "wav", sizeBytes = 480044) =>
  ({ seq, op: "upsert", entityKey: `w4:${occ}`, bookId: "w4", revision: 1, payload: { cacheKey: key, sha256: key, format, sizeBytes } });
const bindingsLog = [
  binding(1, "a1", PROBE_KEY, "mp3", 10944),
  binding(2, "a2", K_A2), binding(3, "a3", K_A3),
  binding(4, "b1", K_500), binding(5, "b2", K_ABORT),
  binding(6, "c1", K_HELD), binding(7, "d1", K_GARBAGE) ];
const settingsLog = [
  { seq: 1, op: "upsert", entityKey: "settings", revision: 0, payload: { monthlyCap: 50, geminiLane: "batch" } } ];
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
const AUDIO_GARBAGE = Buffer.alloc(480044); // exact expected size, no RIFF header: undecodable
const audioFor = (p) => (p.includes(PROBE_KEY) ? AUDIO_PROBE : p.includes(K_GARBAGE) ? AUDIO_GARBAGE : AUDIO_LONG);
const ETAG = '"stub-etag-1"';

// ---------------- byte-check instrumentation ----------------
const byteCheckCounts = {};   // key -> GET count
const byteCheckOrder = [];    // keys in arrival order
const heldByteChecks = [];    // { key, res } awaiting release
const reqLog = [];            // "METHOD path" for every /api-v2 request
const count = (k) => byteCheckCounts[k] ?? 0;
function releaseHeldByteChecks() {
  for (const h of heldByteChecks.splice(0)) {
    try { h.res.writeHead(200, { "content-type": "application/json" }); h.res.end(JSON.stringify({ exists: true })); } catch {}
  }
}

// ---------------- server ----------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
function coordinator(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname.replace(/^\/(api-v2)/, "");
  const send = (code, obj, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(obj === null ? "" : JSON.stringify(obj)); };
  const token = req.headers["x-opalreader-token"];
  const instance = req.headers["x-opalreader-instance"];
  if (p === "/v2/settings") {
    if (instance === "preflight-wrong-instance") return send(403, { error: "production_instance_required" });
    if (token !== TOKEN) return send(401, { error: "unauthorized" });
    return send(200, { monthlyCap: 50, geminiLane: "batch", revision: 0 });
  }
  if (token !== TOKEN) return send(401, { error: "unauthorized" });
  if (p === "/v2/quota") return send(200, { attemptsToday: 0, dailyLimit: 100, spentMicroCents: 0, monthlyCap: 50, ledgerSeq: 0, settingsRevision: 0 });
  if (p === "/v2/commands") return send(500, { error: "generation_must_never_be_called_in_this_proof" });
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
  if (p.startsWith("/v2/sync/byte-check/")) {
    const key = decodeURIComponent(p.slice("/v2/sync/byte-check/".length));
    byteCheckCounts[key] = count(key) + 1; byteCheckOrder.push(key);
    if (key === K_500) return send(500, { error: "boom" });
    if (key === K_ABORT) { req.socket.destroy(); return; }
    if (key === K_HELD) { heldByteChecks.push({ key, res }); return; } // deferred until the test releases it
    return send(200, { exists: true });
  }
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
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api-v2") || u.pathname.startsWith("/api-shelf")) reqLog.push(`${req.method} ${u.pathname}`);
  if (u.pathname.startsWith("/api-v2/")) return coordinator(req, res);
  if (u.pathname === "/api-shelf/api/sessions" && req.method === "POST") {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (u.pathname === "/opal-reader" || u.pathname === "/opal-reader/" || u.pathname === "/opal-reader/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(CAND_INDEX);
  }
  if (u.pathname.startsWith("/opal-reader/")) {
    const rel = decodeURIComponent(u.pathname.slice("/opal-reader/".length));
    if (rel.includes("..")) { res.writeHead(400); return res.end(); }
    const file = path.join(TREE, rel);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const APP = origin + "/opal-reader/";

// ---------------- CDP plumbing ----------------
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
  const profile = fs.mkdtempSync("/tmp/ui3-w4-profile-");
  const dbgPort = 22300 + Math.floor(Math.random() * 1200);
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
  // App-layer byte-check counter: wraps window.fetch BEFORE any page
  // script runs, so __bcApp counts the fetch() CALLS the client makes
  // (the app layer), distinct from the server-side request count —
  // a browser network stack may transparently retry a connection-
  // reset GET below the app layer; the two counts separate those.
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__OPAL_V2_BASE_URL__ = ${JSON.stringify(apiBase)}; window.__OPAL_V2_SHELF_BASE_URL__ = ${JSON.stringify(origin + "/api-shelf")};
    window.__bcApp = {};
    const __origFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      try { const url = String(typeof input === 'string' ? input : input.url);
        const marker = '/v2/sync/byte-check/';
        const i = url.indexOf(marker);
        if (i >= 0) { const k = decodeURIComponent(url.slice(i + marker.length).split(/[?#]/)[0]); window.__bcApp[k] = (window.__bcApp[k] ?? 0) + 1; }
      } catch {}
      return __origFetch(input, init);
    };` });
  return { chrome, page };
}
async function row(id, name, fn) {
  try { const ev = await fn(); rows.push([id, "PASS"]); console.log("PASS", id, name, ev ? JSON.stringify(ev).slice(0, 500) : ""); }
  catch (e) { rows.push([id, "FAIL"]); console.log("FAIL", id, name, "-", e?.message ?? e); }
}
const appCount = (page, key) => page.eval(`window.__bcApp?.[${JSON.stringify(key)}] ?? 0`);
const stateBytes = (page) => page.eval(`(() => { const s = JSON.parse(localStorage.getItem('cs:state:v1') ?? '{}'); return s.bytes ?? {}; })()`);
const moneyView = (page) => page.eval(`(() => { const s = JSON.parse(localStorage.getItem('cs:state:v1') ?? '{}'); const v = s.money?.view; return v ? { attemptsToday: v.attemptsToday, spentMicroCents: v.spentMicroCents, monthlyCap: v.monthlyCap } : null; })()`);
const playerIs = (page, occ) => page.waitFor(`window.__opalReaderV2.playerState()?.state === 'playing' && window.__opalReaderV2.playerState()?.current?.occurrenceId === '${occ}'`, { label: `playing ${occ}`, timeout: 20000 });
async function ensureChapterOpen(page, chapId) {
  const hidden = await page.eval(`document.getElementById('chap-body-${chapId}')?.hidden`);
  if (hidden) await page.eval(`document.getElementById('chap-toggle-${chapId}').click()`);
}
async function waitForCount(key, n, label) {
  const t0 = Date.now();
  for (;;) { if (count(key) >= n) return true;
    if (Date.now() - t0 > 15000) throw new Error(`timeout waiting for byte-check count ${n} for ${label ?? key} (got ${count(key)})`); await sleep(150); }
}
async function waitForBytes(page, key) {
  const t0 = Date.now();
  for (;;) { const b = await stateBytes(page); if (b[key]) return b;
    if (Date.now() - t0 > 15000) throw new Error(`timeout waiting for confirmation of ${key}`); await sleep(200); }
}

// ---------------- the run ----------------
const b = await makeBrowser(origin + "/api-v2");
const p = b.page;
await p.send("Page.navigate", { url: APP });
await p.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui3.js')`, { label: "ui3 controller" });
await p.waitFor(`!!document.getElementById('access-token')`, { label: "access screen" });
await p.eval(`document.getElementById('access-token').value = ${JSON.stringify(TOKEN)}; document.getElementById('access-connect').click();`);
await p.waitFor(`window.__opalReaderV2 && window.__opalReaderV2.screen() === 'library'`, { label: "library after connect" });
await p.waitFor(`!!document.getElementById('open-w4')`, { label: "library rows rendered" });

let money0 = null;
await row("T4", "no-play browsing: Connect + drain + library/book/chapter/Settings issue ZERO byte-check GETs for segment bindings (only the preflight C3 probe fires)", async () => {
  const atConnect = { ...byteCheckCounts };
  const nonProbe = Object.entries(atConnect).filter(([k]) => k !== PROBE_KEY);
  assert(nonProbe.length === 0, `byte-checks for non-probe keys at Connect: ${JSON.stringify(nonProbe)}`);
  assert(count(PROBE_KEY) >= 1, "the preflight C3 probe byte-check is expected at Connect");
  await p.eval(`document.getElementById('open-w4').click()`);
  await p.waitFor(`!!document.getElementById('chap-w4-ch1')`, { label: "w4 chapters" });
  await ensureChapterOpen(p, "w4-ch2");
  await ensureChapterOpen(p, "w4-ch3");
  await p.eval(`document.getElementById('nav-settings').click()`);
  await p.waitFor(`!!document.getElementById('settings-quota')`, { label: "settings (T4)" });
  await p.eval(`document.getElementById('nav-library').click()`);
  await p.waitFor(`!!document.getElementById('open-w4')`, { label: "library again (T4)" });
  await sleep(600);
  assert(JSON.stringify({ ...byteCheckCounts }) === JSON.stringify(atConnect),
    `byte-check counts moved during browsing: ${JSON.stringify(byteCheckCounts)} vs ${JSON.stringify(atConnect)}`);
  const bytes = await stateBytes(p);
  assert(Object.keys(bytes).length === 0, `no confirmations may exist before any playback, got ${JSON.stringify(bytes)}`);
  money0 = await moneyView(p);
  assert(money0 && money0.attemptsToday === 0 && money0.spentMicroCents === 0 && money0.monthlyCap === 50,
    `money view after connect: ${JSON.stringify(money0)}`);
  return { atConnect };
});

await p.eval(`document.getElementById('open-w4').click()`);
await p.waitFor(`!!document.getElementById('chap-w4-ch1')`, { label: "w4 chapters (T1)" });
await row("T1", "first play of unconfirmed a2: exactly ONE byte-check GET, confirmation recorded, pill advances 0/3 -> 1/3", async () => {
  const before = count(K_A2);
  await p.eval(`document.getElementById('play-a2').click()`);
  await playerIs(p, "a2");
  const bytes = await waitForBytes(p, K_A2);
  assert(bytes[K_A2].bindingRevision === 1, `confirmation shape: ${JSON.stringify(bytes[K_A2])}`);
  await sleep(500);
  assert(count(K_A2) - before === 1, `byte-check GETs for a2: ${count(K_A2) - before} (expected exactly 1)`);
  await p.eval(`document.getElementById('book-back').click()`);
  await p.waitFor(`!!document.getElementById('open-w4')`, { label: "library (T1 pill)" });
  await p.eval(`document.getElementById('open-w4').click()`);
  await p.waitFor(`!!document.getElementById('chap-w4-ch1')`, { label: "w4 chapters (T1 pill)" });
  const pill = await p.eval(`document.querySelector('#chap-w4-ch1 .ui-pill')?.textContent`);
  assert(pill && pill.includes("(1/3 confirmed)"), `ch1 pill after one confirmed segment: ${pill}`);
  return { pill };
});
await row("T2", "replay of confirmed a2 (pause -> play): ZERO additional byte-check GETs", async () => {
  const before = count(K_A2);
  await p.eval(`document.getElementById('player-playpause').click()`);
  await p.waitFor(`window.__opalReaderV2.playerState()?.state === 'paused'`, { label: "paused (T2)" });
  await p.eval(`document.getElementById('player-playpause').click()`);
  await playerIs(p, "a2");
  await sleep(800);
  assert(count(K_A2) === before, `byte-check GETs for a2 after replay: ${count(K_A2) - before} (expected 0)`);
  return { total: count(K_A2) };
});
await row("T3", "byte-check failures (HTTP 500 + network abort): playback succeeds, nothing recorded, one attempt per initiation, no unhandled rejections", async () => {
  await ensureChapterOpen(p, "w4-ch2");
  await p.eval(`document.getElementById('play-b1').click()`);
  await playerIs(p, "b1");
  await sleep(900);
  assert(count(K_500) === 1, `500-key GETs after first initiation: ${count(K_500)} (expected 1)`);
  let bytes = await stateBytes(p);
  assert(!(K_500 in bytes), "nothing may be recorded on a 500 byte-check");
  await p.eval(`document.getElementById('player-playpause').click()`);
  await p.waitFor(`window.__opalReaderV2.playerState()?.state === 'paused'`, { label: "paused (T3)" });
  await p.eval(`document.getElementById('player-playpause').click()`);
  await playerIs(p, "b1");
  await sleep(900);
  assert(count(K_500) === 2, `500-key GETs after second initiation: ${count(K_500)} (expected 2 = one attempt per initiation, no retry burst)`);
  bytes = await stateBytes(p);
  assert(!(K_500 in bytes), "still nothing recorded for the 500 key");
  await p.eval(`document.getElementById('play-b2').click()`);
  await playerIs(p, "b2");
  await sleep(900);
  const appAbort = await appCount(p, K_ABORT);
  assert(appAbort === 1, `abort-key byte-check fetch() CALLS by the app: ${appAbort} (expected exactly 1 — one attempt per initiation)`);
  bytes = await stateBytes(p);
  assert(!(K_ABORT in bytes), "nothing may be recorded on a network-aborted byte-check");
  const unhandled = p.exceptions.filter((e) => e.includes("Uncaught") || e.includes("in promise"));
  assert(unhandled.length === 0, `unhandled rejections surfaced: ${JSON.stringify(unhandled)}`);
  return { c500: count(K_500), cAbortServerSide: count(K_ABORT), cAbortAppLayer: await appCount(p, K_ABORT), exceptions: p.exceptions.length,
    note: "server-side count for the abort key exceeds the app-layer count: Chromium's network stack transparently retries a connection-reset GET below the app layer (the client made exactly one fetch() call and recorded nothing)" };
});
await row("T5", "failed start (undecodable audio -> play() rejects): ZERO byte-check GETs, nothing recorded, player not playing", async () => {
  await ensureChapterOpen(p, "w4-ch4");
  await p.eval(`document.getElementById('play-d1').click()`);
  await sleep(2500);
  const st = await p.eval(`window.__opalReaderV2.playerState()?.state`);
  assert(st !== "playing", `player state after failed start: ${st}`);
  assert(count(K_GARBAGE) === 0, `byte-check GETs for the failed-start segment: ${count(K_GARBAGE)} (expected 0)`);
  const bytes = await stateBytes(p);
  assert(!(K_GARBAGE in bytes), "nothing may be recorded for a failed start");
  return { state: st };
});
await row("T6", "concurrency: two initiations while the byte-check is held -> exactly ONE GET; post-settle initiation still ONE GET total (per-device bound)", async () => {
  await ensureChapterOpen(p, "w4-ch3");
  await p.eval(`document.getElementById('play-c1').click()`);
  await playerIs(p, "c1");
  await waitForCount(K_HELD, 1, "held key first GET");
  await p.eval(`document.getElementById('player-playpause').click()`);
  await p.waitFor(`window.__opalReaderV2.playerState()?.state === 'paused'`, { label: "paused (T6)" });
  await p.eval(`document.getElementById('player-playpause').click()`);
  await playerIs(p, "c1");
  await sleep(900);
  assert(count(K_HELD) === 1, `held-key GETs with a check in flight: ${count(K_HELD)} (expected exactly 1 — single-flight)`);
  assert(heldByteChecks.length === 1, `held responses: ${heldByteChecks.length}`);
  releaseHeldByteChecks();
  const bytes = await waitForBytes(p, K_HELD);
  assert(bytes[K_HELD].bindingRevision === 1, "the single in-flight check records the confirmation on settle");
  await p.eval(`document.getElementById('player-playpause').click()`);
  await p.waitFor(`window.__opalReaderV2.playerState()?.state === 'paused'`, { label: "paused (T6 post-settle)" });
  await p.eval(`document.getElementById('player-playpause').click()`);
  await playerIs(p, "c1");
  await sleep(900);
  assert(count(K_HELD) === 1, `held-key GETs after settle + fresh initiation: ${count(K_HELD)} (expected still 1 — persisted early return)`);
  return { total: count(K_HELD) };
});
await row("TQ", "quota immobility: money counters identical before/after all W-4 traffic; zero generation commands issued", async () => {
  const money1 = await moneyView(p);
  assert(JSON.stringify(money1) === JSON.stringify(money0), `money view moved: ${JSON.stringify(money0)} -> ${JSON.stringify(money1)}`);
  const commands = reqLog.filter((r) => r.includes("/v2/commands"));
  assert(commands.length === 0, `generation command POSTs: ${JSON.stringify(commands)}`);
  const quotaGets = reqLog.filter((r) => r.includes("/v2/quota")).length;
  return { money: money1, quotaGets, byteCheckTotals: { ...byteCheckCounts } };
});
b.chrome.kill();

const fails = rows.filter((r) => r[1] !== "PASS");
console.log(`\nW-4 PROOF (${path.relative(ROOT, TREE)}): ${rows.length - fails.length}/${rows.length} PASS`);
server.close();
process.exit(fails.length ? 1 : 0);
