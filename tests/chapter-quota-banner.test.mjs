// Run: node --test tests/chapter-quota-banner.test.mjs
// No Gemini/Worker requests. Tests chapter card's visible quota state.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const app=readFileSync(new URL("../app-234.js",import.meta.url),"utf8");
const start=app.indexOf("function chapterQuotaBanner("),end=app.indexOf("function Pr(){",start);
assert.ok(start>=0&&end>start,"Chapter quota banner helper missing");
const fn=new Function(app.slice(start,end)+"return chapterQuotaBanner;")();
const now=Date.now();
test("queued daily quota appears on chapter card with scheduled retry",()=>{
 const result=fn({generation:{state:"queued",cooldown_reason:"quota",cooldown_scope:"daily",next_retry_at:now+3600000}},now);
 assert.match(result,/Paused for Gemini quota/);assert.match(result,/Daily quota limit/);
 assert.match(result,/Auto-retry at/);assert.match(result,/Generated audio is saved/);
});
test("temporary limit and replacement generation are supported",()=>{
 const result=fn({replacementGeneration:{state:"queued",cooldown_reason:"quota",cooldown_scope:"temporary",next_retry_at:now+3600000}},now);
 assert.match(result,/Temporary rate limit/);
});
test("scheduled retry time has elapsed but Queue remains paused",()=>{
 assert.match(fn({generation:{state:"queued",cooldown_reason:"quota",next_retry_at:now-100}},now),/Automatic retry pending/);
});
test("stopped auto-split is distinct from scheduled auto-retry",()=>{
 const result=fn({autoSplitStatus:"Automatic splitting paused: Gemini request quota reached."},now);
 assert.match(result,/Automatic splitting stopped/);assert.doesNotMatch(result,/Auto-retry at/);
});
test("normal queue, active generation and finished chapter show no quota note",()=>{
 for(const state of ["generating","ready","failed"]){
  assert.equal(fn({generation:{state,cooldown_reason:"quota",next_retry_at:now+3600000}},now),"");
 }
 assert.equal(fn({generation:{state:"queued",cooldown_reason:null}},now),"");
});
test("visible on chapter card and previous audio recovery intact",()=>{
 const card=app.slice(app.indexOf("function Pr(){"),app.indexOf("function $r(){"));
 assert.match(card,/chapterQuotaBanner\(e\)/);
 assert.match(card,/\$\{quotaBanner\}/);
 assert.match(app,/async function recoverSilentAudio\(\)/);
 assert.match(app,/navigator\.serviceWorker\.register\("\.\/sw-196\.js"\)/);
});
