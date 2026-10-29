// UI1 Chromium proof (LOCAL ONLY, zero production contact).
// Serves the UI1 build tree under the production project subpath
// (/opal-reader/) with switchable index (accepted CORR1 <-> UI1),
// plus a stub coordinator and stub Shelf on the same loopback origin
// (injected via the shell's loopback-only override seam).
// Rows C0-C9 preserve the CORR1 proof's assertions on the new tree
// (baseline is now the CORR1 shell; diagnostics live in Settings).
// Rows V1-V4 are the UI1 additions: generation/cast inertness with
// zero network writes and a byte-stable candidate state record; the
// Cast view against census-shaped fixtures (incl. the real Goal cast
// metadata and the recorded mappings); accessibility + collapsible
// persistence; playback with humanized status and prev/next.
// Tree under test: UI1_TREE env var, default ../tree-a (the package
// run points it at ../package/publish).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TREE = process.env.UI1_TREE ? path.resolve(ROOT, process.env.UI1_TREE) : path.join(ROOT, "tree-a");
const BASE_INDEX = fs.readFileSync(path.join(ROOT, "base", "index.html"));
const CAND_INDEX = fs.readFileSync(path.join(TREE, "index.html"));
const hex = (i) => i.toString(16).padStart(64, "0");
const TOKEN = "proof-token-123";
const PROBE_KEY = "c10cb90e978621a98590e17b16e5bfb2090c9b78d8a3bfdeb55162bfa429067a";
const GOAL_ID = "f1b1e2f9-8c09-4f23-8290-472740923954"; // The Goal's real book id (recorded mappings key on it)

// ---------------- fixtures ----------------
const fpBook = { bookId: "fp", title: "Fixture Pucked", author: "Fixture Author",
  shelfReadId: "read_fixture_fp", shelfBookId: "shelf-fp", shelfBookTitle: "Fixture Pucked",
  cast: [
    { id: "pov-miller", name: "Miller", voice: { provider: "gemini", voice_id: "Algenib", name: "Algenib", style_direction: "Warm and relaxed (fixture style)" } },
    { id: "pov-sunny", name: "Sunny", voice: { provider: "azure", voice_id: "en-US-FixtureNeural", name: "Fixture Ava" } },
    { id: "pov-epi", name: "Epilogue - Miller", voice: null } ],
  chapters: [
    { chapterId: "fp-ch1", index: 0, segments: [{ occurrenceId: "o1", pov: "Miller" }, { occurrenceId: "o2", pov: "Miller" }] },
    { chapterId: "fp-ch2", index: 1, segments: [{ occurrenceId: "o3", pov: "Miller", text: "zebraquill marker sentence" }, { occurrenceId: "o4", pov: "Sunny" }] } ] };
const fhBook = { bookId: "fh", title: "Fixture Home", author: "Fixture Author",
  chapters: [ { chapterId: "fh-ch1", index: 0, segments: [{ occurrenceId: "s1" }] } ] };
const goalBook = { bookId: GOAL_ID, title: "Fixture Goal", author: "Fixture Author",
  cast: [
    { id: "db7f5ffe-216d-446b-ae84-578c6f8ac0d6", name: "Sabrina", voice: { provider: "azure", voice_id: "en-US-Ava:DragonHDLatestNeural", name: "Ava Dragon HD Latest" } },
    { id: "315aab42-3dbe-49a6-95a3-108140b1c882", name: "Tucker", voice: { provider: "elevenlabs", voice_id: "OIxekrEs4tx6iYn6RKEE", name: "Rhett - Lively, Clear, and Smooth" } } ],
  chapters: [ { chapterId: "goal-ch1", index: 0, segments: [{ occurrenceId: "g1", pov: "Sabrina" }] } ] };
const contentLog = [
  { seq: 1, op: "upsert", entityKey: "fp", bookId: "fp", revision: 2, payload: fpBook },
  { seq: 2, op: "upsert", entityKey: "fh", bookId: "fh", revision: 1, payload: fhBook },
  { seq: 3, op: "upsert", entityKey: GOAL_ID, bookId: GOAL_ID, revision: 1, payload: goalBook } ];
// Binding payloads carry the full production shape (format +
// sizeBytes): the player refuses a binding without them
// (invalid_audio_binding), and the preflight requires them of the
// probe. sizeBytes values match the stub objects below: the probe
// object is 10,944 bytes; every other object is the 30 s WAV
// (44 + 8000*30*2 = 480,044 bytes).
const bindingsLog = [
  { seq: 1, op: "upsert", entityKey: "fp:o1", bookId: "fp", revision: 1, payload: { cacheKey: PROBE_KEY, sha256: hex(1), format: "mp3", sizeBytes: 10944 } },
  { seq: 2, op: "upsert", entityKey: "fp:o2", bookId: "fp", revision: 1, payload: { cacheKey: hex(2), sha256: hex(2), format: "wav", sizeBytes: 480044 } },
  { seq: 3, op: "upsert", entityKey: "fp:o3", bookId: "fp", revision: 1, payload: { cacheKey: hex(3), sha256: hex(3), format: "wav", sizeBytes: 480044 } },
  { seq: 4, op: "upsert", entityKey: "fh:s1", bookId: "fh", revision: 1, payload: { cacheKey: hex(4), sha256: hex(4), format: "wav", sizeBytes: 480044 } },
  { seq: 5, op: "upsert", entityKey: `${GOAL_ID}:g1`, bookId: GOAL_ID, revision: 1, payload: { cacheKey: hex(5), sha256: hex(5), format: "wav", sizeBytes: 480044 } },
  ...Array.from({ length: 246 }, (_, i) => ({ seq: 6 + i, op: "upsert", entityKey: `pad:occ-${i + 1}`, bookId: "pad", revision: 1, payload: { cacheKey: hex(1000 + i), sha256: hex(1000 + i), format: "wav", sizeBytes: 480044 } })) ];
const settingsLog = [
  { seq: 1, op: "upsert", entityKey: "settings", revision: 0, payload: { monthlyCap: 50, geminiLane: "batch" } } ];
// A real decodable WAV (3 s of silence, 8 kHz mono PCM16): the
// player's state machine reaches "playing" only on actual media
// playback, so undecodable stub bytes would stall it in "loading".
// Two decodable WAVs (8 kHz mono PCM16 silence). The probe object
// must be EXACTLY 10,944 bytes: the shell's compiled DESIGNATED_PROBE
// pins sizeBytes 10944, and preflight step C4 requires the stub's
// Content-Range total to equal it. Non-probe objects get a 3 s clip
// so the playback row has time to observe the "playing" state (the
// 10,944-byte probe clip is only ~0.68 s at 8 kHz).
function wav(seconds) {
  const samples = Math.floor(8000 * seconds), dataLen = samples * 2, buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataLen, 40);
  return buf;
}
const AUDIO_PROBE = wav(10900 / 16000); // 44 + 10900 = 10,944 bytes
const AUDIO_LONG = wav(30); // wide "playing" window for the V4 row under load
const audioFor = (p) => (p.includes(PROBE_KEY) ? AUDIO_PROBE : AUDIO_LONG); // path ends "<key>.mp3"
const ETAG = '"stub-etag-1"';
const shelfPosts = [];
const reqLog = [];
let shelfMode = "accept"; // or "reject409"
let indexMode = "corr1";   // or "ui1"

// ---------------- server ----------------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
function coordinator(req, res, failBindings, failBindingsFirst = false) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname.replace(/^\/(api-v2fail1|api-v2fail|api-v2)/, "");
  const send = (code, obj, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(obj === null ? "" : JSON.stringify(obj)); };
  const token = req.headers["x-opalreader-token"];
  const instance = req.headers["x-opalreader-instance"];
  if (p === "/v2/settings") {
    if (instance === "preflight-wrong-instance") return send(403, { error: "production_instance_required" });
    if (token !== TOKEN) return send(401, { error: "unauthorized" });
    return send(200, { monthlyCap: 50, geminiLane: "batch", revision: 0 });
  }
  if (token !== TOKEN) return send(401, { error: "unauthorized" });
  if (p === "/v2/sync/changes") {
    const family = u.searchParams.get("family");
    const since = Number(u.searchParams.get("sinceSeq") ?? 0);
    const limit = Number(u.searchParams.get("limit") ?? 100);
    const log = family === "content" ? contentLog : family === "bindings" ? bindingsLog : family === "settings" ? settingsLog : [];
    if (failBindingsFirst && family === "bindings") return send(500, { error: "boom" });
    if (failBindings && family === "bindings" && since >= 100) return send(500, { error: "boom" });
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
  if (p.startsWith("/v2/sync/position/")) {
    const bookId = decodeURIComponent(p.slice("/v2/sync/position/".length));
    const canonical = bookId === "fp" ? { occurrenceId: "o2", offsetSec: 20 } : null;
    return send(200, { canonical, asOfReceiptSeq: 0, supersededCount: 0, journalGaps: [] });
  }
  if (p === "/v2/sync/position") return send(200, { receipts: [], rejected: [], tip: 0, journalGaps: [] });
  return send(404, { error: "no_route" });
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api-v2") || u.pathname.startsWith("/api-shelf")) reqLog.push(`${req.method} ${u.pathname}`);
  if (u.pathname.startsWith("/api-v2fail1/")) return coordinator(req, res, false, true);
  if (u.pathname.startsWith("/api-v2fail/")) return coordinator(req, res, true);
  if (u.pathname.startsWith("/api-v2/")) return coordinator(req, res, false);
  if (u.pathname === "/api-shelf/api/sessions" && req.method === "POST") {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      let parsed = null; try { parsed = JSON.parse(body); } catch {}
      shelfPosts.push(parsed);
      if (shelfMode === "accept") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true })); }
      else { res.writeHead(409, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "This read-through is not active; sessions can only be logged while reading" })); }
    });
    return;
  }
  if (u.pathname === "/opal-reader" || u.pathname === "/opal-reader/" || u.pathname === "/opal-reader/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(indexMode === "ui1" ? CAND_INDEX : BASE_INDEX);
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
}
async function makeBrowser(apiBase) {
  const profile = fs.mkdtempSync("/tmp/ui1-proof-profile-");
  const dbgPort = 19700 + Math.floor(Math.random() * 1200);
  const chrome = spawn("/opt/meta-chromium/chrome", [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-proxy-server",
    `--ip-address-space-overrides=127.0.0.1:${server.address().port}=public`,
    "--autoplay-policy=no-user-gesture-required",
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
const swState = (page) => page.eval(`(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const keys = await caches.keys();
  return { active: reg?.active?.scriptURL ?? null, controller: navigator.serviceWorker.controller?.scriptURL ?? null, keys };
})()`, { awaitPromise: true });
async function row(id, name, fn) {
  try { const ev = await fn(); rows.push([id, "PASS"]); console.log("PASS", id, name, ev ? JSON.stringify(ev).slice(0, 300) : ""); }
  catch (e) { rows.push([id, "FAIL"]); console.log("FAIL", id, name, "-", e?.message ?? e); }
}
async function connect(page) {
  await page.waitFor(`!!document.getElementById('access-token')`, { label: "access screen" });
  await page.eval(`document.getElementById('access-token').value = ${JSON.stringify(TOKEN)}; document.getElementById('access-connect').click();`);
  await page.waitFor(`window.__opalReaderV2 && window.__opalReaderV2.screen() === 'library'`, { label: "library after connect" });
  await page.waitFor(`!!document.getElementById('open-fp')`, { label: "library rows rendered" });
}

// ---------------- profile 1: CORR1 baseline -> UI1 upgrade -> rollback -> flush failure ----------------
const b1 = await makeBrowser(origin + "/api-v2");
const p1 = b1.page;
indexMode = "corr1";
await p1.send("Page.navigate", { url: APP });
await row("C0", "CORR1 baseline: sw-corr1 controls, marker -12, corr1 cache present", async () => {
  await p1.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-corr1.js')`, { label: "corr1 controller" });
  const st = await swState(p1);
  const marker = await p1.eval(`window.__opalReaderV2.buildMarker`);
  assert(marker === "d5b-v2-playback-client-12", `marker ${marker}`);
  assert(st.keys.includes("opalreader-shell-corr1"), `caches ${st.keys}`);
  return { marker };
});
indexMode = "ui1";
await p1.eval(`location.reload()`);
await row("C1", "upgrade: sw-ui1 activates, ui1 cache == SHELL set, corr1 cache preserved, markers -13/ui-pkg-1", async () => {
  await p1.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui1.js')`, { label: "ui1 controller" });
  const st = await swState(p1);
  assert(st.keys.includes("opalreader-shell-ui1") && st.keys.includes("opalreader-shell-corr1"), `caches ${st.keys}`);
  const keys = await p1.eval(`(async () => { const c = await caches.open('opalreader-shell-ui1'); const ks = await c.keys(); return ks.map((r) => new URL(r.url).pathname.replace('/opal-reader/', './')); })()`, { awaitPromise: true });
  const shellSrc = fs.readFileSync(path.join(TREE, "sw-ui1.js"), "utf8");
  const shellArr = shellSrc.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  const shellList = [...shellArr.matchAll(/"\.\/[^"]*"/g)].map((m) => m[0].slice(1, -1)).sort();
  assert(JSON.stringify([...keys].sort()) === JSON.stringify(shellList), `cache keys vs SHELL:\n${JSON.stringify(keys.sort())}\nvs\n${JSON.stringify(shellList)}`);
  const bm = await p1.eval(`window.__opalReaderV2.buildMarker`);
  const pm = await p1.eval(`window.__opalReaderV2.packagingMarker`);
  assert(bm === "d5b-v2-playback-client-13" && pm === "ui-pkg-1", `markers ${bm}/${pm}`);
  return { caches: st.keys };
});
await row("C2", "connect: one-connect drain converges (bindings 251/251 in 3 pages), library truthful + hero, seeded Shelf session flushes", async () => {
  await p1.eval(`localStorage.setItem('cs:shelf-bridge:v1', JSON.stringify({ outbox: [{ queueId: 'shelf_read_fixture_0001', readId: 'read_fixture_fp', startedAt: new Date(Date.now() - 3600e3).toISOString(), duration_seconds: 42, attempts: 0 }] }))`);
  await connect(p1);
  const sync = await p1.eval(`window.__opalReaderV2.syncSummary()`);
  const b = sync.find((d) => d.family === "bindings");
  const c = sync.find((d) => d.family === "content");
  assert(b && b.complete === true && b.cursor === 251 && b.tip === 251 && b.pages === 3, `bindings drain ${JSON.stringify(b)}`);
  assert(c && c.complete === true && c.cursor === 3, `content drain ${JSON.stringify(c)}`);
  const libText = await p1.eval(`document.getElementById('v2shell').innerText`);
  assert(libText.includes("3 with audio") && libText.includes("1 to go"), `library rows: ${libText.slice(0, 400)}`);
  assert(libText.includes("Complete"), `FH/Goal complete captions: ${libText.slice(0, 400)}`);
  const hero = await p1.eval(`document.getElementById('hero-resume-line')?.textContent ?? null`);
  assert(hero === "Chapter 1 · Segment 2 · 20s in", `hero resume line: ${hero}`);
  const banner = await p1.eval(`!!document.getElementById('library-sync-incomplete')`);
  assert(banner === false, "no incomplete banner after a complete drain");
  assert(shelfPosts.length === 1 && shelfPosts[0]?.read_id === "read_fixture_fp", `shelf posts ${JSON.stringify(shelfPosts)}`);
  return { bindings: b };
});
await row("C3", "book view: per-chapter truth pills, collapsibles, YOU ARE HERE, No audio yet + chapter footer, no stray cross-book card", async () => {
  await p1.eval(`document.getElementById('open-fp').click()`);
  await p1.waitFor(`window.__opalReaderV2.screen() === 'book'`, { label: "book screen" });
  await p1.waitFor(`!!document.getElementById('chap-fp-ch2')`, { label: "chapter cards rendered" });
  const text = await p1.eval(`document.getElementById('v2shell').innerText`);
  assert(!text.includes("undefined"), "no 'undefined' in book view");
  assert(!text.includes("Fixture Home") && !text.includes("Fixture Goal"), "no stray cross-book card in FP book view");
  const pill1 = await p1.eval(`document.querySelector('#chap-fp-ch1 .ui-pill')?.textContent`);
  const pill2 = await p1.eval(`document.querySelector('#chap-fp-ch2 .ui-pill')?.textContent`);
  assert(pill1 && pill1.includes("0/2 confirmed"), `ch1 pill: ${pill1}`);
  assert(pill2 && pill2.includes("Partial 1/2"), `ch2 pill: ${pill2}`);
  const here = await p1.eval(`document.querySelector('#seg-o2 .ui-where')?.textContent ?? null`);
  assert(here === "YOU ARE HERE", `current marker: ${here}`);
  const ch2Hidden = await p1.eval(`document.getElementById('chap-body-fp-ch2').hidden`);
  assert(ch2Hidden === true, "ch2 (not current) starts collapsed");
  await p1.eval(`document.getElementById('chap-toggle-fp-ch2').click()`);
  const ch2Open = await p1.eval(`document.getElementById('chap-body-fp-ch2').hidden`);
  assert(ch2Open === false, "ch2 expands on header tap");
  const o4state = await p1.eval(`document.getElementById('seg-state-o4')?.textContent ?? null`);
  assert(o4state === "No audio yet", `o4 label after complete sync: ${o4state}`);
  assert(await p1.eval(`!!document.getElementById('gen-seg-o4')`), "per-segment + present on a No audio yet row");
  const foot = await p1.eval(`document.querySelector('#chap-foot-fp-ch2 .ui-t')?.textContent ?? null`);
  assert(foot === "1 segment without audio", `ch2 footer: ${foot}`);
  return { pill1, pill2 };
});
await row("C4", "settings: diagnostics section rows keep CORR1 meanings; cap row; backup unavailable; token absent from storage", async () => {
  await p1.eval(`document.getElementById('nav-settings').click()`);
  await p1.waitFor(`!!document.getElementById('diag-sync-bindings')`, { label: "diagnostics section" });
  const g = (id) => p1.eval(`document.getElementById('${id}')?.textContent ?? null`);
  const sb = await g("diag-sync-bindings"); const sc = await g("diag-sync-content");
  const fl = await g("diag-shelf-flush"); const at = await g("diag-shelf-attribution");
  const bm = await g("diag-build-marker"); const pm = await g("diag-packaging-marker");
  assert(sb === "251/251 COMPLETE", `bindings row: ${sb}`);
  assert(sc === "3/3 COMPLETE", `content row: ${sc}`);
  assert(fl && fl.includes("sent 1") && fl.includes("0 pending"), `flush row: ${fl}`);
  assert(at === "1 of 3 books carry a Shelf read ID — sessions for the others are not attributed", `attribution row: ${at}`);
  assert(bm === "d5b-v2-playback-client-13" && pm === "ui-pkg-1", `markers ${bm}/${pm}`);
  assert((await g("settings-cap")) === "$50", "monthly cap row");
  assert((await g("settings-lane")) === "batch", "lane row shows the server setting");
  assert((await g("settings-backup-note"))?.includes("aren't part of this build"), "backup honestly unavailable");
  assert((await p1.eval(`document.getElementById('settings-backup-download').disabled`)) === true, "backup download disabled");
  const leak = await p1.eval(`(() => { const vals = []; for (let i = 0; i < localStorage.length; i++) vals.push(localStorage.getItem(localStorage.key(i))); for (let i = 0; i < sessionStorage.length; i++) vals.push(sessionStorage.getItem(sessionStorage.key(i))); return vals.join(' ').includes(${JSON.stringify(TOKEN)}); })()`);
  assert(leak === false, "token must not appear in web storage");
  return { fl };
});
indexMode = "corr1";
await p1.eval(`location.reload()`);
await row("C5", "rollback: CORR1 shell runs again under sw-corr1; ui1 cache preserved inert", async () => {
  await p1.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-corr1.js')`, { label: "corr1 controller again" });
  const bm = await p1.eval(`window.__opalReaderV2.buildMarker`);
  assert(bm === "d5b-v2-playback-client-12", `marker ${bm}`);
  const st = await swState(p1);
  assert(st.keys.includes("opalreader-shell-ui1"), "ui1 cache preserved (inert), not deleted");
  return { caches: st.keys };
});
indexMode = "ui1";
shelfMode = "reject409";
await p1.eval(`location.reload()`);
await row("C6", "flush failure instrument: 409 -> Settings diagnostics shows blocked HTTP 409, session still pending", async () => {
  await p1.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui1.js')`, { label: "ui1 controller again" });
  await p1.eval(`localStorage.setItem('cs:shelf-bridge:v1', JSON.stringify({ outbox: [{ queueId: 'shelf_read_fixture_0002', readId: 'read_fixture_fp', startedAt: new Date(Date.now() - 3600e3).toISOString(), duration_seconds: 30, attempts: 0 }] }))`);
  await connect(p1);
  await p1.eval(`document.getElementById('nav-settings').click()`);
  await p1.waitFor(`!!document.getElementById('diag-shelf-flush')`, { label: "diagnostics section" });
  const fl = await p1.eval(`document.getElementById('diag-shelf-flush')?.textContent`);
  assert(fl && fl.includes("blocked: HTTP 409") && fl.includes("1 pending"), `flush row: ${fl}`);
  const pending = await p1.eval(`window.__opalReaderV2.shelfPendingCount()`);
  assert(pending === 1, `pending count ${pending}`);
  return { fl };
});
b1.chrome.kill();

// ---------------- profile 2: partial drain honesty ----------------
const b2 = await makeBrowser(origin + "/api-v2fail");
const p2 = b2.page;
indexMode = "ui1";
await p2.send("Page.navigate", { url: APP });
await row("C7", "partial drain: banner + not-yet-synced counts + Sync incomplete pill + Not checked yet + no generate affordances + PARTIAL diagnostics", async () => {
  await p2.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui1.js')`, { label: "ui1 controller (p2)" });
  await connect(p2);
  const banner = await p2.eval(`document.getElementById('library-sync-incomplete')?.textContent ?? null`);
  assert(banner && banner.includes("bindings 100/251"), `banner: ${banner}`);
  const libText = await p2.eval(`document.getElementById('v2shell').innerText`);
  assert(libText.includes("not yet synced"), `library label: ${libText.slice(0, 300)}`);
  assert(!libText.includes("No audio yet"), "library must not claim 'No audio yet' while incomplete");
  await p2.eval(`document.getElementById('open-fp').click()`);
  await p2.waitFor(`window.__opalReaderV2.screen() === 'book'`, { label: "book screen (p2)" });
  await p2.waitFor(`!!document.getElementById('chap-fp-ch2')`, { label: "chapter cards (p2)" });
  const pill2 = await p2.eval(`document.querySelector('#chap-fp-ch2 .ui-pill')?.textContent`);
  assert(pill2 && pill2.includes("Sync incomplete"), `ch2 pill: ${pill2}`);
  const o4state = await p2.eval(`document.getElementById('seg-state-o4')?.textContent ?? null`);
  assert(o4state === "Not checked yet", `o4 label while incomplete: ${o4state}`);
  const plusCount = await p2.eval(`document.querySelectorAll('.ui-genplus').length`);
  assert(plusCount === 0, "no per-segment generate + while sync is incomplete");
  const foot = await p2.eval(`document.querySelector('#chap-foot-fp-ch2 .ui-t')?.textContent ?? null`);
  assert(foot && foot.includes("Still syncing"), `ch2 footer while incomplete: ${foot}`);
  const genAllDisabled = await p2.eval(`document.getElementById('book-genall').disabled`);
  assert(genAllDisabled === true, "Generate all disabled while incomplete");
  await p2.eval(`document.getElementById('nav-settings').click()`);
  await p2.waitFor(`!!document.getElementById('diag-sync-bindings')`, { label: "diagnostics (p2)" });
  const sb = await p2.eval(`document.getElementById('diag-sync-bindings')?.textContent`);
  assert(sb && sb.startsWith("100/251 PARTIAL/SYNC INCOMPLETE"), `bindings row: ${sb}`);
  return { banner, sb };
});
b2.chrome.kill();

// ---------------- profile 3: first-page bindings failure ----------------
const b3 = await makeBrowser(origin + "/api-v2fail1");
const p3 = b3.page;
indexMode = "ui1";
await p3.send("Page.navigate", { url: APP });
await row("C8", "first-page bindings failure: banner + Not checked yet + Sync incomplete + 0/0 PARTIAL diagnostics agree", async () => {
  await p3.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui1.js')`, { label: "ui1 controller (p3)" });
  await connect(p3);
  const banner = await p3.eval(`document.getElementById('library-sync-incomplete')?.textContent ?? null`);
  assert(banner && banner.includes("bindings 0/0"), `banner: ${banner}`);
  const libText = await p3.eval(`document.getElementById('v2shell').innerText`);
  assert(libText.includes("0 with audio"), `no phantom audio: ${libText.slice(0, 300)}`);
  assert(!libText.includes("No audio yet"), "must never say 'No audio yet' after a failed drain");
  await p3.eval(`document.getElementById('open-fp').click()`);
  await p3.waitFor(`window.__opalReaderV2.screen() === 'book'`, { label: "book screen (p3)" });
  await p3.waitFor(`!!document.getElementById('chap-fp-ch2')`, { label: "chapter cards (p3)" });
  const pill2 = await p3.eval(`document.querySelector('#chap-fp-ch2 .ui-pill')?.textContent`);
  assert(pill2 && pill2.includes("Sync incomplete"), `ch2 pill: ${pill2}`);
  const o4state = await p3.eval(`document.getElementById('seg-state-o4')?.textContent ?? null`);
  assert(o4state === "Not checked yet", `o4 label: ${o4state}`);
  await p3.eval(`document.getElementById('nav-settings').click()`);
  await p3.waitFor(`!!document.getElementById('diag-sync-bindings')`, { label: "diagnostics (p3)" });
  const sb = await p3.eval(`document.getElementById('diag-sync-bindings')?.textContent`);
  assert(sb === "0/0 PARTIAL/SYNC INCOMPLETE (network_error)", `bindings row: ${sb}`);
  return { banner, sb };
});
b3.chrome.kill();

// ---------------- profile 4: Find Text ----------------
const b4 = await makeBrowser(origin + "/api-v2");
const p4 = b4.page;
indexMode = "ui1";
await p4.send("Page.navigate", { url: APP });
await row("C9", "Find Text: result card carries human chapter/segment labels, real ids, and a highlighted match", async () => {
  await p4.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui1.js')`, { label: "ui1 controller (p4)" });
  await connect(p4);
  await p4.eval(`document.getElementById('nav-findText').click()`);
  await p4.waitFor(`!!document.getElementById('find-input')`, { label: "find screen" });
  await p4.eval(`document.getElementById('find-input').value = 'zebraquill'; document.getElementById('find-go').click()`);
  await p4.waitFor(`document.getElementById('find-results').innerText.includes('zebraquill')`, { label: "find results" });
  const loc = await p4.eval(`document.querySelector('#find-results .ui-loc')?.textContent`);
  assert(loc === "Fixture Pucked · Chapter 2 · Segment 1", `loc line: ${loc}`);
  const ids = await p4.eval(`document.querySelector('#find-results .ui-ids')?.textContent`);
  assert(ids === "fp-ch2 · o3", `ids line: ${ids}`);
  const mark = await p4.eval(`document.querySelector('#find-results mark')?.textContent`);
  assert(mark === "zebraquill", `highlight: ${mark}`);
  const res = await p4.eval(`document.getElementById('find-results').innerText`);
  assert(!res.includes("undefined"), "no undefined in results");
  return { loc, ids };
});
b4.chrome.kill();

// ---------------- profile 5: inertness, cast, accessibility/persistence, playback ----------------
const b5 = await makeBrowser(origin + "/api-v2");
const p5 = b5.page;
indexMode = "ui1";
shelfMode = "accept";
await p5.send("Page.navigate", { url: APP });
await p5.waitFor(`navigator.serviceWorker.controller?.scriptURL.endsWith('sw-ui1.js')`, { label: "ui1 controller (p5)" });
await connect(p5);
await row("V1", "generation affordances are inert: sheets open with the off-note, Start/Batch disabled, zero network writes, candidate state byte-stable", async () => {
  const stateBefore = await p5.eval(`localStorage.getItem('cs:state:v1')`);
  const reqBefore = reqLog.length;
  await p5.eval(`document.getElementById('open-fp').click()`);
  await p5.waitFor(`!!document.getElementById('book-actions')`, { label: "book actions" });
  await p5.eval(`document.getElementById('book-actions-toggle').click()`);
  await p5.eval(`document.getElementById('book-genall').click()`);
  await p5.waitFor(`!document.getElementById('gen-sheet').hidden`, { label: "gen sheet open (Generate all)" });
  let off = await p5.eval(`document.getElementById('gen-sheet-offnote')?.textContent`);
  assert(off && off.includes("Generation isn't on yet"), `off-note: ${off}`);
  assert((await p5.eval(`document.querySelector('#gen-sheet .ui-btn-plum').disabled`)) === true, "Start generation disabled");
  assert((await p5.eval(`document.getElementById('gen-sheet-batch').disabled`)) === true, "Batch disabled");
  assert((await p5.eval(`document.getElementById('gen-sheet-quota').disabled`)) === true, "until-quota toggle disabled");
  await p5.eval(`document.getElementById('gen-sheet-cancel').click()`);
  assert((await p5.eval(`document.getElementById('gen-sheet').hidden`)) === true, "sheet closes via Not now");
  await p5.eval(`document.getElementById('chap-toggle-fp-ch2').click()`);
  await p5.eval(`document.getElementById('gen-chap-fp-ch2').click()`);
  await p5.waitFor(`!document.getElementById('gen-sheet').hidden`, { label: "gen sheet open (chapter)" });
  await p5.eval(`document.getElementById('gen-sheet-cancel').click()`);
  await p5.eval(`document.getElementById('gen-seg-o4').click()`);
  await p5.waitFor(`!document.getElementById('gen-sheet').hidden`, { label: "gen sheet open (segment)" });
  const title = await p5.eval(`document.getElementById('gen-sheet-title')?.textContent`);
  assert(title === "Generate Segment 2", `segment sheet title: ${title}`);
  await p5.eval(`document.getElementById('gen-sheet-cancel').click()`);
  const newReqs = reqLog.slice(reqBefore);
  const writes = newReqs.filter((r) => !r.startsWith("GET "));
  assert(writes.length === 0, `network writes after connect: ${JSON.stringify(writes)}`);
  assert(!newReqs.some((r) => r.includes("commands")), "no command submissions");
  const stateAfter = await p5.eval(`localStorage.getItem('cs:state:v1')`);
  assert(stateAfter === stateBefore, "candidate state record must be byte-stable across inert clicks");
  return { newReqs: newReqs.length };
});
await row("V2", "cast view: census-shaped rows, recorded mappings + unverified flag, attention order, inert change sheet, no-cast book handled", async () => {
  const stateBefore = await p5.eval(`localStorage.getItem('cs:state:v1')`);
  // The Goal (real book id; recorded mappings key on it)
  await p5.eval(`document.getElementById('nav-library').click()`);
  await p5.waitFor(`!!document.getElementById('open-${GOAL_ID}')`, { label: "goal row" });
  await p5.eval(`document.getElementById('open-${GOAL_ID}').click()`);
  await p5.waitFor(`!!document.getElementById('book-actions')`, { label: "goal actions" });
  await p5.eval(`document.getElementById('book-actions-toggle').click()`);
  await p5.eval(`document.getElementById('book-cast').click()`);
  await p5.waitFor(`window.__opalReaderV2.screen() === 'cast'`, { label: "cast screen (goal)" });
  const names = await p5.eval(`[...document.querySelectorAll('#cast-list .ui-srow')].map((r) => r.dataset.name)`);
  assert(JSON.stringify(names) === JSON.stringify(["Tucker", "Sabrina"]), `attention order (unverified first): ${JSON.stringify(names)}`);
  const tucker = await p5.eval(`document.querySelector('#cast-list .ui-srow[data-name="Tucker"]').innerText`);
  assert(tucker.includes("ElevenLabs · Rhett - Lively, Clear, and Smooth"), `tucker chip: ${tucker.slice(0, 150)}`);
  assert(tucker.includes("Recorded mapping: Gemini Puck"), "tucker mapping line");
  assert(tucker.includes("Match not verified"), "tucker unverified flag");
  const sabrina = await p5.eval(`document.querySelector('#cast-list .ui-srow[data-name="Sabrina"]').innerText`);
  assert(sabrina.includes("Azure · Ava Dragon HD Latest"), "sabrina chip");
  assert(sabrina.includes("Recorded mapping: Gemini Aoede"), "sabrina mapping line");
  assert(!sabrina.includes("Match not verified"), "sabrina has NO unverified flag");
  const castText = await p5.eval(`document.getElementById('v2shell').innerText`);
  assert(!castText.includes("Style:"), "Goal cast voices carry no style_direction — no style lines may appear");
  assert(castText.includes("No book-wide style note is carried"), "book-wide style card states the plane gap");
  const cm = await p5.eval(`window.__opalReaderV2.castModel(${JSON.stringify(GOAL_ID)})`);
  assert(cm.available === true && cm.total === 2 && cm.attention === 1, `cast model: ${JSON.stringify(cm)}`);
  assert(cm.rows[0].name === "Tucker" && cm.rows[0].mapping?.unverified === true, "model flags Tucker unverified");
  // Change/Try open the (inert) voice sheet; nothing mutates.
  await p5.eval(`[...document.querySelectorAll('#cast-list .ui-srow')].find((r) => r.dataset.name === 'Sabrina').querySelector('.ui-btn').click()`);
  await p5.waitFor(`!document.getElementById('voice-sheet').hidden`, { label: "voice sheet open" });
  const voff = await p5.eval(`document.getElementById('voice-sheet-offnote')?.textContent`);
  assert(voff && voff.includes("Generation isn't on yet"), `voice off-note: ${voff}`);
  assert((await p5.eval(`document.querySelector('#voice-sheet .ui-btn-plum').disabled`)) === true, "Use this voice disabled");
  await p5.eval(`document.getElementById('voice-sheet-cancel').click()`);
  // Fixture Pucked cast: unmapped azure + null voice float first, gemini last.
  await p5.eval(`document.getElementById('cast-back').click()`);
  await p5.waitFor(`window.__opalReaderV2.screen() === 'book'`, { label: "back to goal book" });
  await p5.eval(`document.getElementById('book-back').click()`);
  await p5.waitFor(`!!document.getElementById('open-fp')`, { label: "library again" });
  await p5.eval(`document.getElementById('open-fp').click()`);
  await p5.waitFor(`!!document.getElementById('book-actions')`, { label: "fp actions" });
  await p5.eval(`document.getElementById('book-actions-toggle').click()`);
  await p5.eval(`document.getElementById('book-cast').click()`);
  await p5.waitFor(`window.__opalReaderV2.screen() === 'cast'`, { label: "cast screen (fp)" });
  const fpNames = await p5.eval(`[...document.querySelectorAll('#cast-list .ui-srow')].map((r) => r.dataset.name)`);
  assert(fpNames.length === 3 && fpNames[2] === "Miller", `fp order (attention first, gemini last): ${JSON.stringify(fpNames)}`);
  const fpText = await p5.eval(`document.getElementById('v2shell').innerText`);
  assert(fpText.includes("No mapping recorded"), "unmapped azure voice flagged");
  assert(fpText.includes("Needs a voice") && fpText.includes("No voice recorded"), "null-voice epilogue entry flagged truthfully");
  assert(fpText.includes("Style: Warm and relaxed (fixture style)"), "per-character style line renders from style_direction");
  assert(fpText.includes("Gemini · Algenib"), "gemini chip");
  // Fixture Home carries no cast array at all: Cast is unavailable, never invented.
  await p5.eval(`document.getElementById('cast-back').click()`);
  await p5.waitFor(`window.__opalReaderV2.screen() === 'book'`, { label: "back to fp book" });
  await p5.eval(`document.getElementById('book-back').click()`);
  await p5.waitFor(`!!document.getElementById('open-fh')`, { label: "library (fh)" });
  await p5.eval(`document.getElementById('open-fh').click()`);
  await p5.waitFor(`!!document.getElementById('book-actions')`, { label: "fh actions" });
  await p5.eval(`document.getElementById('book-actions-toggle').click()`);
  const fhCastDisabled = await p5.eval(`document.getElementById('book-cast').disabled`);
  const fhSummary = await p5.eval(`document.getElementById('book-cast-summary')?.textContent`);
  assert(fhCastDisabled === true && fhSummary === "Cast data isn't carried for this book", `fh cast state: ${fhSummary}`);
  const stateAfter = await p5.eval(`localStorage.getItem('cs:state:v1')`);
  assert(stateAfter === stateBefore, "candidate state record byte-stable across all cast interactions");
  return { names };
});
await row("V3", "accessibility + collapsible persistence: labelled controls, tap targets, state survives reload + reconnect", async () => {
  await p5.eval(`document.getElementById('book-back').click()`);
  await p5.waitFor(`!!document.getElementById('open-fp')`, { label: "library (v3)" });
  await p5.eval(`document.getElementById('open-fp').click()`);
  await p5.waitFor(`!!document.getElementById('chap-fp-ch1')`, { label: "fp chapters (v3)" });
  const dims = await p5.eval(`(() => {
    const h = (id) => document.getElementById(id)?.getBoundingClientRect().height ?? 0;
    return { nav: h('nav-library'), chapToggle: h('chap-toggle-fp-ch1'), play: h('play-o1'), actionsToggle: h('book-actions-toggle') };
  })()`);
  assert(dims.nav >= 40 && dims.chapToggle >= 44 && dims.play >= 36 && dims.actionsToggle >= 40, `tap targets: ${JSON.stringify(dims)}`);
  const aria = await p5.eval(`(() => ({
    chap: document.getElementById('chap-toggle-fp-ch1').getAttribute('aria-expanded'),
    act: document.getElementById('book-actions-toggle').getAttribute('aria-expanded'),
    playLabel: document.getElementById('play-o1').getAttribute('aria-label') }))()`);
  assert(aria.chap === "true" && aria.playLabel && aria.playLabel.includes("Play segment 1"), `aria: ${JSON.stringify(aria)}`);
  // Collapse ch1 (open by default) and expand the actions card; both must persist.
  await p5.eval(`document.getElementById('chap-toggle-fp-ch1').click()`);
  assert((await p5.eval(`document.getElementById('chap-body-fp-ch1').hidden`)) === true, "ch1 collapsed");
  if ((await p5.eval(`document.getElementById('book-actions-more').hidden`)) === true)
    await p5.eval(`document.getElementById('book-actions-toggle').click()`);
  await p5.eval(`location.reload()`);
  await connect(p5);
  await p5.eval(`document.getElementById('open-fp').click()`);
  await p5.waitFor(`!!document.getElementById('chap-fp-ch1')`, { label: "fp chapters after reload" });
  assert((await p5.eval(`document.getElementById('chap-body-fp-ch1').hidden`)) === true, "ch1 collapse persisted across reload");
  assert((await p5.eval(`document.getElementById('book-actions-more').hidden`)) === false, "actions expansion persisted across reload");
  return { dims };
});
await row("V4", "playback: play a segment, humanized status, Next advances to the successor", async () => {
  if ((await p5.eval(`document.getElementById('chap-body-fp-ch1').hidden`)) === true)
    await p5.eval(`document.getElementById('chap-toggle-fp-ch1').click()`);
  // Play o2 (a non-probe binding with the 3 s clip), then Next -> o3.
  await p5.eval(`document.getElementById('play-o2').click()`);
  await p5.waitFor(`window.__opalReaderV2.playerState()?.state === 'playing'`, { label: "player playing o2" });
  const st1 = await p5.eval(`document.getElementById('player-status')?.textContent`);
  assert(st1 && st1.includes("Chapter 1 · Segment 2"), `status after play: ${st1}`);
  await p5.eval(`document.getElementById('player-next').click()`);
  await p5.waitFor(`window.__opalReaderV2.playerState()?.current?.occurrenceId === 'o3'`, { label: "player advanced to o3" });
  const st2 = await p5.eval(`document.getElementById('player-status')?.textContent`);
  assert(st2 && st2.includes("Chapter 2 · Segment 1"), `status after next: ${st2}`);
  return { st1: st1.slice(0, 80), st2: st2.slice(0, 80) };
});
b5.chrome.kill();

const fails = rows.filter((r) => r[1] !== "PASS");
console.log(`\nCHROMIUM PROOF: ${rows.length - fails.length}/${rows.length} PASS`);
server.close();
process.exit(fails.length ? 1 : 0);
