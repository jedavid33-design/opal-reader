// Run: node --test tests/continue-preparation-progress.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../app-254.js",import.meta.url),"utf8");
const page=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const span=(s,start,end)=>{const a=s.indexOf(start),b=s.indexOf(end,a);assert.ok(a>=0&&b>a);return s.slice(a,b)};
test("preparation UI disables duplicate taps and exposes live progress",()=>{
  assert.match(app,/id="continuePreparation"/);
  const helper=span(app,"function setContinuePreparation(","async function refreshContinueSession(");
  let status={textContent:""},button={disabled:false,setAttribute:()=>{},removeAttribute:()=>{}};
  const document={querySelector:selector=>selector==="#continuePreparation"?status:selector==="#continueToQuota"?button:null};
  const a={book:{continueSession:null}};
  const update=new Function("document","a",helper+"return setContinuePreparation;")(document,a);
  update("Preparing chapter 2 of 19"); assert.equal(status.textContent,"Preparing chapter 2 of 19");assert.equal(button.disabled,true);
  update(""); assert.equal(status.textContent,"");assert.equal(button.disabled,false);
});
test("chapter and passage preparation yields before submit; confirmation still precedes POST",()=>{
 const plan=span(app,"async function continueToQuota(){","async function resumeChapterQuota(");
 const tree=span(app,"async function continueAdaptiveBatches(","async function continueToQuota(){");
 assert.match(plan,/setContinuePreparation\("Checking generation connection/);
 assert.match(plan,/setContinuePreparation\("Preparing chapter "/);
 assert.match(plan,/setContinuePreparation\("Chapter "/);
 assert.match(tree,/await new Promise\(resolve=>setTimeout\(resolve,0\)\)/);
 const confirmAt=plan.indexOf('if(!confirm((a.geminiLane');
 const submitAt=plan.indexOf('"\/api\/generation\/continue"');
 // The retry path may have an earlier submit. Inspect the fresh-queue section specifically.
 const newQueue=plan.slice(plan.indexOf("const jobs=[],localJobs=[]"));
 assert.ok(newQueue.indexOf("if(!confirm((a.geminiLane")<newQueue.indexOf('"/api/generation/continue"'));
 assert.match(plan,/finally\{\s*continueBusy=false;\s*setContinuePreparation\(""\)/);
});
test("Worker release stays compatible and frontend file gets cache-busted",()=>{
 assert.match(app,/const APP_UI_VERSION="1\.4\.116"/);
 assert.match(app,/const GENERATION_WORKER_VERSION="1\.4\.42"/);
 assert.match(page,/app-256\.js\?v=case4-truthful-status/);
});
