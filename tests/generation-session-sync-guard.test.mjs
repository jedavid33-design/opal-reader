// Run: node --test tests/generation-session-sync-guard.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../app-254.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles-149.css",import.meta.url),"utf8");
const start=src.indexOf("function preserveInFlightGenerationSession(");
const end=src.indexOf("async function Ee(",start);
assert.ok(start>0&&end>start,"Expected isolated sync guard");
const preserve=new Function(src.slice(start,end)+"return preserveInFlightGenerationSession")();
const chapter=(key=null,g=null)=>({title:"Chapter 25",segments:[{text:"Hello",speechText:"Hello",pov:"Lily",audioKey:key}],
  generation:g||{state:"paused_update"}});
const old={id:"old",state:"update_paused",startedAt:100,jobs:[{jobId:"old-job"}]};
const active={id:"batch",state:"running",startedAt:200,jobs:[{jobId:"batch-job"}]};
const book=(stamp,session,chapters=[chapter()])=>({id:"pucked-over",updatedAt:stamp,continueSession:session,chapters});
test("newer Batch session survives stale cloud snapshot",()=>{
 const remote=book(400,old),local=book(300,active,[chapter("cached",{jobId:"batch-job",state:"queued"})]);
 const result=preserve(remote,local);
 assert.equal(result.continueSession.id,"batch");
 assert.equal(result.chapters[0].generation.jobId,"batch-job");
 assert.equal(result.chapters[0].segments[0].audioKey,"cached");
 assert.ok(result.updatedAt>remote.updatedAt);
});
test("older session cannot displace newer session",()=>{
 const latest=book(400,active);
 assert.strictEqual(preserve(latest,book(300,old)),latest);
});
test("same-session terminal states are not resurrected",()=>{
 for(const state of ["complete","update_paused","error"]){
  const latest=book(400,{...active,state});
  assert.strictEqual(preserve(latest,book(300,active)),latest);
 }
});
test("unrelated books and stale audio are not imported",()=>{
 const remote=book(400,old);
 assert.strictEqual(preserve(remote,{...book(300,active),id:"other"}),remote);
 const stale=book(300,active,[{...chapter("old-audio"),segments:[
  {text:"Hello",speechText:"Hello",pov:"Lily",audioKey:"old-audio",audioStale:true}
 ]}]);
 assert.equal(preserve(remote,stale).chapters[0].segments[0].audioKey,null);
});
test("late background upload reads newest local book and release fence remains unchanged",()=>{
 const method=src.slice(src.indexOf("async function Ee("),src.indexOf("function Er(",src.indexOf("async function Ee(")));
 assert.ok(method.includes('await Oe("books",e?.id)'));
 assert.ok(method.includes("preserveInFlightGenerationSession"));
 assert.ok(src.includes("const reconciled=preserveInFlightGenerationSession(selected,cloudNewer?local:incoming)"));
 assert.ok(src.includes('const GENERATION_WORKER_VERSION="1.4.42"'));
 assert.ok(src.includes('const APP_UI_VERSION="1.4.116"'));
});
test("paused chapter title, controls and quota notice fit iPhone cards",()=>{
 for(const selector of [".chapter.quota-paused{",".chapter.quota-paused .chapter-main{",
  ".chapter.quota-paused .chapter-actions{",".chapter.quota-paused .chapter-title h3{",
  ".chapter.quota-paused .chapter-quota-note{"])assert.ok(css.includes(selector),selector);
});
