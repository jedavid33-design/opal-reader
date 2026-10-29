// UI4 candidate phone-width proof (LOCAL ONLY, zero production
// contact). Window findings W-1 (player bar clipped at phone width),
// W-2 (chapter-header collision at phone width), W-3 (player bar not
// pinned to the viewport bottom). Serves the tree under test under
// the production project subpath (/opal-reader/) with a stub
// coordinator + stub Shelf, under emulated phone/tablet viewports.
//
// Fixture book "fp" mirrors Julie's Forever Pucked window state:
//   ch1: 27 segments, single POV "Violet", all bound, no byte
//        confirmations on this device -> pill "Uncertain — audio not
//        verified on this device (0/27 confirmed)";
//   ch2: 4 segments, 2 bound -> "Partial 2/4";
//   ch3: 3 segments, all bound; the test seeds byte confirmations
//        into the device state record -> "Complete 3/3";
//   ch4: 3 segments, none bound -> "Not started 0/3" on a complete
//        drain; "Sync incomplete — audio index still loading
//        (0/3 loaded)" on the failed-drain profile.
// Book "lh" carries one chapter whose single POV name is long
// ("Violet Morningstar-Blackwood") for the long-narrator check.
//
// Tree under test: UI4_TREE env var, default ../tree-a. Point it at
// ../base to run against the published ui-pkg-2 tree (the W-5 Q-rows
// are expected to FAIL there — that is the reproduction evidence;
// the UI2 W-1/W-2/W-3 rows pass there because ui-pkg-2 fixed them).
// UI3 additions: rows Q1/Q2 (finding W-5: the Settings quota row)
// and a /v2/quota stub route so the row renders Julie's real text
// ("0/100 generation attempts today · $0.00 of $50 this month")
// instead of the fallback the UI2 stub produced.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TREE = process.env.UI4_TREE ? path.resolve(ROOT, process.env.UI4_TREE) : path.join(ROOT, "tree-a");
const CAND_INDEX = fs.readFileSync(path.join(TREE, "index.html"));
const hex = (i) => i.toString(16).padStart(64, "0");
const TOKEN = "proof-token-123";
const PROBE_KEY = "c10cb90e978621a98590e17b16e5bfb2090c9b78d8a3bfdeb55162bfa429067a";

// ---------------- fixtures ----------------
const segs = (prefix, n, pov, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ occurrenceId: `${prefix}s${i + 1}`, pov, ...(extra[i] ?? {}) }));
const fpBook = { bookId: "fp", title: "Fixture Pucked", author: "Fixture Author",
  shelfReadId: "read_fixture_fp", shelfBookId: "shelf-fp", shelfBookTitle: "Fixture Pucked",
  chapters: [
    { chapterId: "fp-ch1", index: 0, segments: segs("c1", 27, "Violet") },
    { chapterId: "fp-ch2", index: 1, segments: segs("c2", 4, "Violet", { 2: { text: "zebraquill marker sentence" } }) },
    { chapterId: "fp-ch3", index: 2, segments: segs("c3", 3, "Violet") },
    { chapterId: "fp-ch4", index: 3, segments: segs("c4", 3, "Violet") } ] };
const lhBook = { bookId: "lh", title: "Fixture Longname", author: "Fixture Author",
  chapters: [ { chapterId: "lh-ch1", index: 0, segments: segs("l1", 2, "Violet Morningstar-Blackwood") } ] };
const contentLog = [
  { seq: 1, op: "upsert", entityKey: "fp", bookId: "fp", revision: 2, payload: fpBook },
  { seq: 2, op: "upsert", entityKey: "lh", bookId: "lh", revision: 1, payload: lhBook } ];
// Binding cache keys are assigned sequentially: c1s1 is the Table C
// probe (PROBE_KEY, 10944 bytes); c1s2..c1s27 -> hex(1002..1027),
// c2s1..c2s2 -> hex(1028..1029), c3s1..c3s3 -> hex(1030..1032),
// l1s1..l1s2 -> hex(1033..1034). Pads push the bindings tip past 100
// so the fail profile's drain stops mid-family.
function binding(seq, entityKey, bookId, key, sizeBytes = 480044, format = "wav") {
  return { seq, op: "upsert", entityKey, bookId, revision: 1, payload: { cacheKey: key, sha256: key, format, sizeBytes } };
}
const bindingsLog = [ binding(1, "fp:c1s1", "fp", PROBE_KEY, 10944, "mp3") ];
for (let i = 2; i <= 27; i++) bindingsLog.push(binding(i, `fp:c1s${i}`, "fp", hex(1000 + i)));
bindingsLog.push(binding(28, "fp:c2s1", "fp", hex(1028)), binding(29, "fp:c2s2", "fp", hex(1029)));
for (let i = 1; i <= 3; i++) bindingsLog.push(binding(29 + i, `fp:c3s${i}`, "fp", hex(1029 + i)));
bindingsLog.push(binding(33, "lh:l1s1", "lh", hex(1033)), binding(34, "lh:l1s2", "lh", hex(1034)));
for (let i = 0; i < 130; i++) bindingsLog.push(binding(35 + i, `pad:occ-${i + 1}`, "pad", hex(2000 + i)));
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
const audioFor = (p) => (p.includes(PROBE_KEY) ? AUDIO_PROBE : AUDIO_LONG);
const ETAG = '"stub-etag-1"';

// ---------------- server ----------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
function coordinator(req, res, failBindings) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname.replace(/^\/(api-v2fail|api-v2)/, "");
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
  if (p === "/v2/sync/changes") {
    const family = u.searchParams.get("family");
    const since = Number(u.searchParams.get("sinceSeq") ?? 0);
    const limit = Number(u.searchParams.get("limit") ?? 100);
    const log = family === "content" ? contentLog : family === "bindings" ? bindingsLog : family === "settings" ? settingsLog : [];
    if (failBindings && family === "bindings" && since >= 100) return send(500, { error: "boom" });
    const slice = log.filter((c) => c.seq > since && c.seq <= since + limit);
    return send(200, { family, changes: slice, nextSeq: slice.length ? slice[slice.length - 1].seq : since, highWatermark: log.length });
  }
  if (p === "/v2/sync/snapshot") {
    const family = u.searchParams.get("family");
    const log = family === "content" ? contentLog : family === "bindings" ? bindingsLog : family === "settings" ? settingsLog : [];
    return send(200, { family, watermark: log.length, entities: log.map((c) => ({ entityKey: c.entityKey, bookId: c.bookId, revision: 1, data: c.payload })) });
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
  if (p.startsWith("/v2/sync/position/")) {
    const bookId = decodeURIComponent(p.slice("/v2/sync/position/".length));
    const canonical = bookId === "fp" ? { occurrenceId: "c1s2", offsetSec: 20 } : null;
    return send(200, { canonical, asOfReceiptSeq: 0, supersededCount: 0, journalGaps: [] });
  }
  if (p === "/v2/sync/position") return send(200, { receipts: [], rejected: [], tip: 0, journalGaps: [] });
  return send(404, { error: "no_route" });
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api-v2fail/")) return coordinator(req, res, true);
  if (u.pathname.startsWith("/api-v2/")) return coordinator(req, res, false);
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
class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.onEvent = null;
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
  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
  }
  async scrollToY(y) {
    await this.eval(`window.scrollTo(0, ${y === "max" ? "document.documentElement.scrollHeight" : y}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`, { awaitPromise: true });
    await sleep(120);
  }
}
// UI3 harness adaptation (environment, not semantics): this VM's
// Chromium build refuses to start without the image-owned WebGL
// domain policy switches (normally supplied by browser-daemon).
const WEBGL_POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const WEBGL_SHA = crypto.createHash("sha256").update(fs.readFileSync(WEBGL_POLICY)).digest("hex");
async function makeBrowser(apiBase) {
  const profile = fs.mkdtempSync("/tmp/ui3-phone-profile-");
  const dbgPort = 21100 + Math.floor(Math.random() * 1200);
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
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__OPAL_V2_BASE_URL__ = ${JSON.stringify(apiBase)}; window.__OPAL_V2_SHELF_BASE_URL__ = ${JSON.stringify(origin + "/api-shelf")};` });
  return { chrome, page };
}
async function row(id, name, fn) {
  try { const ev = await fn(); rows.push([id, "PASS"]); console.log("PASS", id, name, ev ? JSON.stringify(ev).slice(0, 700) : ""); }
  catch (e) { rows.push([id, "FAIL"]); console.log("FAIL", id, name, "-", e?.message ?? e); }
}
async function connect(page) {
  await page.waitFor(`!!document.getElementById('access-token')`, { label: "access screen" });
  await page.eval(`document.getElementById('access-token').value = ${JSON.stringify(TOKEN)}; document.getElementById('access-connect').click();`);
  await page.waitFor(`window.__opalReaderV2 && window.__opalReaderV2.screen() === 'library'`, { label: "library after connect" });
  await page.waitFor(`!!document.getElementById('open-fp')`, { label: "library rows rendered" });
}

// ---------------- measurement helpers (page-side) ----------------
const MEASURE_PLAYER = `(() => {
  const bar = document.getElementById('v2playerbar');
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10, top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; };
  return {
    iw: window.innerWidth, ih: window.innerHeight,
    docScrollWidth: document.documentElement.scrollWidth,
    scrollY: Math.round(window.scrollY),
    barPos: bar ? getComputedStyle(bar).position : null,
    bar: R(bar),
    status: R(document.getElementById('player-status')),
    prev: R(document.getElementById('player-prev')),
    play: R(document.getElementById('player-playpause')),
    next: R(document.getElementById('player-next')),
    seek: R(document.getElementById('player-seek')),
    rate: R(document.getElementById('player-rate')),
  };
})()`;
const measureHeader = (chapId) => `(() => {
  const card = document.getElementById('chap-${chapId}');
  const head = document.getElementById('chap-toggle-${chapId}');
  const h4 = head?.querySelector('h4');
  const pov = head?.querySelector('.ui-pov');
  const pill = head?.querySelector('.ui-pill');
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10, top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; };
  const inter = (a, b) => { if (!a || !b) return 0;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return (w > 0 && h > 0) ? Math.round(w * h) : 0; };
  return {
    iw: window.innerWidth, docScrollWidth: document.documentElement.scrollWidth,
    card: R(card), head: R(head), h4: R(h4), pov: R(pov), pill: R(pill),
    h4Text: h4?.textContent ?? null, h4ScrollW: h4?.scrollWidth ?? null, h4ClientW: h4?.clientWidth ?? null,
    povText: pov?.textContent ?? null, povScrollW: pov?.scrollWidth ?? null, povClientW: pov?.clientWidth ?? null,
    pillText: pill?.textContent ?? null, pillScrollW: pill?.scrollWidth ?? null, pillClientW: pill?.clientWidth ?? null,
    h4PovOverlap: inter(R(h4), R(pov)), h4PillOverlap: inter(R(h4), R(pill)),
  };
})()`;
const SCAN_OVERFLOW = `(() => {
  const iw = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll('#v2shell *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > iw + 1 || r.left < -1)) out.push({ tag: el.tagName, id: el.id || null, cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 40), right: Math.round(r.right), width: Math.round(r.width) });
    if (out.length >= 8) break;
  }
  return { iw, docScrollWidth: document.documentElement.scrollWidth, offenders: out };
})()`;

const MEASURE_QUOTA = `(() => {
  const val = document.getElementById('settings-quota');
  const rowEl = val?.closest('.ui-srow');
  const lab = rowEl?.querySelector('.ui-lab');
  const labSpan = lab?.querySelector('span');
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10, top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; };
  const inter = (a, b) => { if (!a || !b) return 0;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return (w > 0 && h > 0) ? Math.round(w * h) : 0; };
  const L = R(lab), V = R(val), S = R(labSpan);
  return { iw: window.innerWidth, docScrollWidth: document.documentElement.scrollWidth,
    text: val?.textContent ?? null, lab: L, val: V, labSpan: S, overlap: inter(L, V), spanOverlap: inter(S, V) };
})()`;
function assertQuotaRow(m, label) {
  assert(m.text === "0/100 generation attempts today · $0.00 of $50 this month", `${label}: quota text "${m.text}"`);
  assert(m.lab && m.val, `${label}: quota row parts missing`);
  assert(m.overlap === 0, `${label}: label/value boxes overlap by ${m.overlap}px^2 (lab ${JSON.stringify(m.lab)} vs val ${JSON.stringify(m.val)})`);
  assert(m.spanOverlap === 0, `${label}: label TEXT paints across the value box by ${m.spanOverlap}px^2 (the on-device W-5 defect; labSpan ${JSON.stringify(m.labSpan)} vs val ${JSON.stringify(m.val)})`);
  assert(m.lab.width >= 100, `${label}: label column crushed to ${m.lab.width}px wide (word-by-word wrap column)`);
  assert(m.val.left >= -1 && m.val.right <= m.iw + 1, `${label}: value outside viewport: ${m.val.left}..${m.val.right} vs ${m.iw}`);
  assert(m.lab.bottom <= m.val.top + 1, `${label}: value not stacked below the label (label bottom ${m.lab.bottom}, value top ${m.val.top})`);
  assert(m.docScrollWidth <= m.iw + 1, `${label}: document scrollWidth ${m.docScrollWidth} > innerWidth ${m.iw}`);
}
function assertPlayerFits(m, label) {
  assert(m.docScrollWidth <= m.iw + 1, `${label}: document scrollWidth ${m.docScrollWidth} > innerWidth ${m.iw}`);
  assert(m.bar && m.bar.left >= -1 && m.bar.right <= m.iw + 1, `${label}: bar spans ${m.bar?.left}..${m.bar?.right} vs viewport ${m.iw}`);
  for (const k of ["prev", "play", "next", "seek", "rate", "status"]) {
    const c = m[k];
    assert(c, `${label}: ${k} missing`);
    assert(c.left >= m.bar.left - 1 && c.right <= m.bar.right + 1, `${label}: ${k} spans ${c.left}..${c.right}, bar ${m.bar.left}..${m.bar.right} (clipped)`);
    assert(c.left >= -1 && c.right <= m.iw + 1, `${label}: ${k} outside viewport: ${c.left}..${c.right} vs ${m.iw}`);
    assert(c.height >= 40 || k === "status" || k === "seek", `${label}: ${k} tap height ${c.height} < 40`);
  }
}
function assertHeader(m, label, expectPill) {
  assert(m.pillText === expectPill, `${label}: pill text "${m.pillText}" != "${expectPill}"`);
  assert(m.docScrollWidth <= m.iw + 1, `${label}: document scrollWidth ${m.docScrollWidth} > innerWidth ${m.iw}`);
  assert(m.h4ScrollW <= m.h4ClientW + 1, `${label}: heading text clipped/wrapped (scrollW ${m.h4ScrollW} > clientW ${m.h4ClientW})`);
  assert(m.h4.height < 30, `${label}: heading wrapped to multiple lines (height ${m.h4.height})`);
  assert(m.h4PovOverlap === 0, `${label}: heading/narrator overlap area ${m.h4PovOverlap}`);
  assert(m.h4PillOverlap === 0, `${label}: heading/pill overlap area ${m.h4PillOverlap}`);
  if (m.pov) {
    assert(m.pov.left >= m.card.left - 1 && m.pov.right <= m.card.right + 1, `${label}: narrator outside card: ${m.pov.left}..${m.pov.right} vs card ${m.card.left}..${m.card.right}`);
    assert(m.povScrollW <= m.povClientW + 1, `${label}: narrator text clipped (scrollW ${m.povScrollW} > clientW ${m.povClientW})`);
  }
  assert(m.pill.left >= m.card.left - 1 && m.pill.right <= m.card.right + 1, `${label}: pill outside card: ${m.pill.left}..${m.pill.right} vs card ${m.card.left}..${m.card.right}`);
  assert(m.pill.right <= m.iw + 1, `${label}: pill clipped by viewport: right ${m.pill.right} > ${m.iw}`);
  assert(m.pillScrollW <= m.pillClientW + 1, `${label}: pill text clipped (scrollW ${m.pillScrollW} > clientW ${m.pillClientW})`);
}

// ---------------- profile A: 390x844, complete drain ----------------
const bA = await makeBrowser(origin + "/api-v2");
const pA = bA.page;
await pA.setViewport(390, 844);
await pA.send("Page.navigate", { url: APP });
await pA.waitFor(`navigator.serviceWorker.controller`, { label: "sw controller (A)" });
await connect(pA);
await row("P1", "W-1 @390: player bar + every control fully inside the viewport on the Library", async () => {
  const m = await pA.eval(MEASURE_PLAYER);
  assertPlayerFits(m, "P1");
  return m;
});
await row("S1", "W-3 @390: bar pinned to viewport bottom while scrolling Library + book view; last row scrolls clear", async () => {
  const steps = [];
  for (const y of [0, 400, "max"]) {
    await pA.scrollToY(y);
    const m = await pA.eval(MEASURE_PLAYER);
    steps.push({ y, pos: m.barPos, barBottom: m.bar.bottom, ih: m.ih });
    assert(Math.abs(m.bar.bottom - (m.ih - 10)) <= 3, `library scroll ${y}: bar bottom ${m.bar.bottom} not pinned at ${m.ih - 10} (position ${m.barPos})`);
    assert(m.bar.top >= 0, `library scroll ${y}: bar top ${m.bar.top} above viewport`);
  }
  await pA.eval(`document.getElementById('open-fp').click()`);
  await pA.waitFor(`!!document.getElementById('chap-fp-ch1')`, { label: "fp chapters (S1)" });
  await pA.scrollToY(600);
  const mid = await pA.eval(MEASURE_PLAYER);
  assert(Math.abs(mid.bar.bottom - (mid.ih - 10)) <= 3, `book mid-scroll: bar bottom ${mid.bar.bottom} not pinned`);
  await pA.scrollToY("max");
  const end = await pA.eval(`(() => { const cards = document.querySelectorAll('#v2-main .ui-card'); const last = cards[cards.length - 1]; const bar = document.getElementById('v2playerbar'); const lr = last.getBoundingClientRect(); const br = bar.getBoundingClientRect(); return { lastBottom: Math.round(lr.bottom * 10) / 10, barTop: Math.round(br.top * 10) / 10, scrollY: Math.round(window.scrollY) }; })()`);
  assert(end.lastBottom <= end.barTop - 2, `book end-scroll: last card bottom ${end.lastBottom} hidden under bar top ${end.barTop}`);
  return { steps, mid: { barBottom: mid.bar.bottom }, end };
});
await row("V1", "scan @390: no document horizontal overflow on Library / Book / Find text / Settings", async () => {
  const scans = {};
  await pA.eval(`document.getElementById('nav-library').click()`);
  await pA.waitFor(`!!document.getElementById('open-fp')`, { label: "library (V1)" });
  scans.library = await pA.eval(SCAN_OVERFLOW);
  await pA.eval(`document.getElementById('open-fp').click()`);
  await pA.waitFor(`!!document.getElementById('chap-fp-ch1')`, { label: "book (V1)" });
  scans.book = await pA.eval(SCAN_OVERFLOW);
  await pA.eval(`document.getElementById('nav-findText').click()`);
  await pA.waitFor(`!!document.getElementById('find-input')`, { label: "find (V1)" });
  await pA.eval(`document.getElementById('find-input').value = 'zebraquill'; document.getElementById('find-go').click()`);
  await pA.waitFor(`document.getElementById('find-results').innerText.includes('zebraquill')`, { label: "find results (V1)" });
  scans.find = await pA.eval(SCAN_OVERFLOW);
  await pA.eval(`document.getElementById('nav-settings').click()`);
  await pA.waitFor(`!!document.getElementById('diag-sync-bindings')`, { label: "settings (V1)" });
  scans.settings = await pA.eval(SCAN_OVERFLOW);
  for (const [view, s] of Object.entries(scans)) {
    assert(s.docScrollWidth <= s.iw + 1, `${view}: scrollWidth ${s.docScrollWidth} > ${s.iw}; offenders ${JSON.stringify(s.offenders)}`);
    assert(s.offenders.length === 0, `${view}: elements outside the viewport: ${JSON.stringify(s.offenders)}`);
  }
  return scans;
});
await row("Q1", "W-5 @390: Settings quota row — label and value disjoint, value stacked full-width below the label, inside the viewport", async () => {
  await pA.eval(`document.getElementById('nav-settings').click()`);
  await pA.waitFor(`!!document.getElementById('settings-quota')`, { label: "settings quota row (Q1)" });
  const m = await pA.eval(MEASURE_QUOTA);
  assertQuotaRow(m, "Q1");
  return m;
});
const headAt = async (page, chapId) => {
  await page.eval(`document.getElementById('chap-${chapId}').scrollIntoView(); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`, { awaitPromise: true });
  await sleep(100);
  return page.eval(measureHeader(chapId));
};
await row("H1", "W-2 @390: chapter headers — heading one line, no overlap, pill inside card + fully readable (Uncertain / Partial / Not started / long narrator)", async () => {
  await pA.eval(`document.getElementById('nav-library').click()`);
  await pA.waitFor(`!!document.getElementById('open-fp')`, { label: "library (H1)" });
  await pA.eval(`document.getElementById('open-fp').click()`);
  await pA.waitFor(`!!document.getElementById('chap-fp-ch1')`, { label: "fp chapters (H1)" });
  const ev = {};
  ev.ch1 = await headAt(pA, "fp-ch1");
  assertHeader(ev.ch1, "ch1 Uncertain", "Uncertain — audio not verified on this device (0/27 confirmed)");
  ev.ch2 = await headAt(pA, "fp-ch2");
  assertHeader(ev.ch2, "ch2 Partial", "Partial 2/4");
  ev.ch4 = await headAt(pA, "fp-ch4");
  assertHeader(ev.ch4, "ch4 Not started", "Not started 0/3");
  await pA.eval(`document.getElementById('book-back').click()`);
  await pA.waitFor(`!!document.getElementById('open-lh')`, { label: "library (lh)" });
  await pA.eval(`document.getElementById('open-lh').click()`);
  await pA.waitFor(`!!document.getElementById('chap-lh-ch1')`, { label: "lh chapters (H1)" });
  ev.lh = await headAt(pA, "lh-ch1");
  assertHeader(ev.lh, "lh long narrator", "Uncertain — audio not verified on this device (0/2 confirmed)");
  return ev;
});
await row("H3a", "W-2 @390: Complete-state header (bytes seeded confirmed on this device)", async () => {
  // UI4 adaptation: this profile has cut over, so the confirmed
  // bytes are seeded into the authoritative IndexedDB record (the
  // localStorage copy is the frozen pre-migration snapshot;
  // writing it would be a legacy-writer act by design).
  await pA.eval(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('opalreader-v2-state', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const raw = await new Promise((res, rej) => { const rq = db.transaction('records', 'readonly').objectStore('records').get('cs:state:v1'); rq.onsuccess = () => res(rq.result?.value ?? null); rq.onerror = () => rej(rq.error); });
    const s = JSON.parse(raw);
    s.bytes = { ...(s.bytes ?? {}), ${JSON.stringify(hex(1030))}: { bindingRevision: 1 }, ${JSON.stringify(hex(1031))}: { bindingRevision: 1 }, ${JSON.stringify(hex(1032))}: { bindingRevision: 1 } };
    await new Promise((res, rej) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put({ key: 'cs:state:v1', value: JSON.stringify(s) }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  })()`, { awaitPromise: true });
  await pA.eval(`location.reload()`);
  await connect(pA);
  await pA.eval(`document.getElementById('open-fp').click()`);
  await pA.waitFor(`!!document.getElementById('chap-fp-ch3')`, { label: "fp chapters (H3a)" });
  const m = await headAt(pA, "fp-ch3");
  assertHeader(m, "ch3 Complete", "Complete 3/3");
  return m;
});
bA.chrome.kill();

// ---------------- profile B: 360x740, complete drain ----------------
const bB = await makeBrowser(origin + "/api-v2");
const pB = bB.page;
await pB.setViewport(360, 740);
await pB.send("Page.navigate", { url: APP });
await pB.waitFor(`navigator.serviceWorker.controller`, { label: "sw controller (B)" });
await connect(pB);
await row("P2", "W-1 @360: player bar + every control fully inside the viewport", async () => {
  const m = await pB.eval(MEASURE_PLAYER);
  assertPlayerFits(m, "P2");
  return m;
});
await row("H2", "W-2 @360: chapter header (Uncertain, 0/27) intact", async () => {
  await pB.eval(`document.getElementById('open-fp').click()`);
  await pB.waitFor(`!!document.getElementById('chap-fp-ch1')`, { label: "fp chapters (H2)" });
  const m = await headAt(pB, "fp-ch1");
  assertHeader(m, "ch1 Uncertain @360", "Uncertain — audio not verified on this device (0/27 confirmed)");
  return m;
});
await row("Q2", "W-5 @360: Settings quota row — label and value disjoint, value stacked below the label", async () => {
  await pB.eval(`document.getElementById('nav-settings').click()`);
  await pB.waitFor(`!!document.getElementById('settings-quota')`, { label: "settings quota row (Q2)" });
  const m = await pB.eval(MEASURE_QUOTA);
  assertQuotaRow(m, "Q2");
  return m;
});
bB.chrome.kill();

// ---------------- profile C: 390x844, bindings drain fails mid-family ----------------
const bC = await makeBrowser(origin + "/api-v2fail");
const pC = bC.page;
await pC.setViewport(390, 844);
await pC.send("Page.navigate", { url: APP });
await pC.waitFor(`navigator.serviceWorker.controller`, { label: "sw controller (C)" });
await connect(pC);
await row("H3b", "W-2 @390: Sync-incomplete header — long pill intact, heading one line", async () => {
  await pC.eval(`document.getElementById('open-fp').click()`);
  await pC.waitFor(`!!document.getElementById('chap-fp-ch4')`, { label: "fp chapters (H3b)" });
  const m4 = await headAt(pC, "fp-ch4");
  assertHeader(m4, "ch4 Sync incomplete", "Sync incomplete — audio index still loading (0/3 loaded)");
  const m1 = await headAt(pC, "fp-ch1");
  assertHeader(m1, "ch1 Uncertain (incomplete drain)", "Uncertain — audio not verified on this device (0/27 confirmed)");
  return { ch4: m4, ch1: m1 };
});
bC.chrome.kill();

// ---------------- profile D: 768x1024 tablet portrait ----------------
const bD = await makeBrowser(origin + "/api-v2");
const pD = bD.page;
await pD.setViewport(768, 1024);
await pD.send("Page.navigate", { url: APP });
await pD.waitFor(`navigator.serviceWorker.controller`, { label: "sw controller (D)" });
await connect(pD);
await row("T1", "tablet @768: player fits + pinned, chapter header keeps single-row arrangement, no overflow", async () => {
  const m = await pD.eval(MEASURE_PLAYER);
  assertPlayerFits(m, "T1 player");
  assert(Math.abs(m.bar.bottom - (m.ih - 10)) <= 3, `tablet: bar bottom ${m.bar.bottom} not pinned at ${m.ih - 10}`);
  assert(m.bar.width <= 720 + 1, `tablet: bar width ${m.bar.width} exceeds the 720 design width`);
  await pD.eval(`document.getElementById('open-fp').click()`);
  await pD.waitFor(`!!document.getElementById('chap-fp-ch1')`, { label: "fp chapters (T1)" });
  const h = await headAt(pD, "fp-ch1");
  assertHeader(h, "ch1 Uncertain @768", "Uncertain — audio not verified on this device (0/27 confirmed)");
  assert(Math.abs(h.pill.top - h.h4.top) <= 6, `tablet: pill dropped off the heading row (pill top ${h.pill.top} vs h4 top ${h.h4.top}) — single-row arrangement lost`);
  return { player: m, header: h };
});
bD.chrome.kill();

const fails = rows.filter((r) => r[1] !== "PASS");
console.log(`\nPHONE-WIDTH PROOF (${path.relative(ROOT, TREE)}): ${rows.length - fails.length}/${rows.length} PASS`);
server.close();
process.exit(fails.length ? 1 : 0);
