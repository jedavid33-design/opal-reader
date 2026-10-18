// Run with: node --test tests/continue-setup-recovery.test.mjs
// Regression: precise Worker 400 errors, faithful Reader errors, and safe discard.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const app=readFileSync(new URL("../app-254.js",import.meta.url),"utf8");
function extract(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,"Missing "+start);
 return source.slice(a,b);
}
const validator=extract(worker,"function describeContinuePayloadIssue(","async function stageContinueSession(");
const release="1.4.42/1.4.116";
const isId=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const validate=new Function("validJobId","validCacheKey","validateAdaptiveRepairPayload","matchesGenerationRelease","GENERATION_RELEASE_ID",
 validator+"return describeContinuePayloadIssue;")(
 isId,isId,p=>p?.adaptive_repair===true,p=>p?.generation_release===release,release);
const sample={job_id:"a".repeat(64),book_id:"bk",chapter_index:6,
 segments:[{provider:"gemini",cache_key:"b".repeat(64),voice_id:"Charon",text:"Hello"}],
 adaptive_repair:true,generation_release:release};
test("Worker explains specific job input errors without narration content",()=>{
 assert.equal(validate(sample,"bk"),null);
 assert.match(validate({...sample,book_id:"other"},"bk"),/Book ID/);
 assert.match(validate({...sample,segments:[]},"bk"),/Segment count/);
 assert.match(validate({...sample,segments:[{...sample.segments[0],voice_id:""}]},"bk"),/Segment 1.*voice ID/);
 assert.match(validate({...sample,segments:[{...sample.segments[0],cache_key:"bad"}]},"bk"),/cache key/);
 assert.match(validate({...sample,adaptive_repair:false},"bk"),/repair tree/);
 assert.match(validate({...sample,generation_release:"old"},"bk"),/release mismatch/);
});
test("Worker rejection identifies chapter before any staging write",async()=>{
 const stageSource=extract(worker,"async function stageContinueSession(","async function resumeQuotaJob(");
 let writes=0;
 // Make a lexical wrapper that only needs validation dependencies because it rejects before storage.
 const runner=new Function("validJobId","validId","describeContinuePayloadIssue",
   stageSource+"\nreturn stageContinueSession;");
 const invoke=runner(isId,x=>typeof x==="string"&&x.length>0,validate);
 const env={OPALREADER_STORAGE:{put:async()=>{writes++}}};
 await assert.rejects(()=>invoke(env,{session_id:"c".repeat(64),book_id:"bk",
   jobs:[{...sample,segments:[{...sample.segments[0],voice_id:""}]}]}),
   /job 1, chapter 7.*Segment 1.*voice ID/);
 assert.equal(writes,0);
});
test("Reader formats HTTP 400 and no-response failures correctly",()=>{
 const source=extract(app,"function continueSetupErrorDetail(","async function discardUnconfirmedContinueSetup(");
 const format=new Function(source+"\nreturn continueSetupErrorDetail;")();
 assert.match(format({status:400,message:"Continue plan rejected at job 2, chapter 7"}),/HTTP 400.*chapter 7/);
 assert.match(format(new TypeError("Failed to fetch")) ,/no HTTP response/);
 assert.ok(app.includes("book.continueSession.error=continueSetupErrorDetail(err)"));
});
async function simulate(outcomes){
 const session={id:"local",state:"staging_unconfirmed",requests:[{job_id:"x"}],
   jobs:[{jobId:"a".repeat(64)},{jobId:"b".repeat(64)}]};
 const a={book:{continueSession:session},apiBase:"https://example.invalid",accessToken:""};
 let saves=0;const messages=[];
 const kr=async(_base,_token,id)=>{
   if(outcomes[id[0]]===404){const e=Error("Not found");e.status=404;throw e}
   if(outcomes[id[0]]===500){const e=Error("Worker unavailable");e.status=500;throw e}
   return {state:"queued"};
 };
 const source=extract(app,"async function discardUnconfirmedContinueSetup(","async function continueToQuota(");
 const fn=new Function("a","kr","pe","se","confirm","alert",
   "let continueBusy=false;\n"+source+"\nreturn discardUnconfirmedContinueSetup;")(
   a,kr,async()=>{saves++},()=>{},()=>true,message=>messages.push(message));
 await fn();return {a,saves,messages};
}
test("Discard clears ONLY local session if every saved job is 404",async()=>{
 const {a,saves,messages}=await simulate({a:404,b:404});
 assert.equal(a.book.continueSession,null);
 assert.equal(saves,1);
 assert.match(messages.at(-1),/confirmed absent/);
});
test("Discard refuses partially staged jobs and uncertain network replies",async()=>{
 for(const outcome of [{a:404,b:200},{a:500,b:404}]){
   const {a,saves,messages}=await simulate(outcome);
   assert.ok(a.book.continueSession?.requests?.length);
   assert.equal(saves,0);
   assert.match(messages.at(-1),/NOT discarded/);
 }
});
test("UI wires discard action but leaves release fence and narration unchanged",()=>{
 assert.match(app,/id="discardUnconfirmedContinue"/);
 assert.match(app,/addEventListener\("click",discardUnconfirmedContinueSetup\)/);
 assert.match(app,/const APP_UI_VERSION="1\.4\.116"/);
 assert.match(worker,/const READER_GENERATION_UI_VERSION = "1\.4\.116"/);
 assert.match(worker,/const APP_VERSION = "1\.4\.42"/);
});
