// Run: node --test tests/split-first-update-stop.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const reader=readFileSync(new URL("../app-244.js",import.meta.url),"utf8");
function between(src,a,b){
 const i=src.indexOf(a),j=src.indexOf(b,i);
 assert.ok(i>=0&&j>i,"Missing source "+a);return src.slice(i,j);
}
test("Update version fence stops old queued generation without losing saved audio",async()=>{
 let state={job_id:"a".repeat(64),state:"queued",completed:1,total:2,
   segments:[{state:"ready",cache_key:"1".repeat(64)},{state:"queued",cache_key:"2".repeat(64)}]};
 let calls=0,saves=0;
 const deps={
   matchesGenerationRelease:p=>p?.generation_release==="1.4.41/1.4.106" &&
     p?.client_version==="1.4.106",
   pauseGenerationForUpdate:async(_env,s)=>{
     state={...s,state:"paused_update",next_retry_at:null,updated_at:Date.now()};
     saves++;return state;
   },
   readGenerationStatus:async()=>JSON.parse(JSON.stringify(state)),
   synthesizeAudio:async()=>{calls++;throw Error("Old job synthesized after deploy")}
 };
 const names=Object.keys(deps),fn=new Function(...names,
   between(worker,"async function processGenerationJobLocked(","async function activateNextContinueJob(")+
   "\nreturn processGenerationJobLocked;")(...names.map(n=>deps[n]));
 const payload={segments:[{text:"First",provider:"gemini"},
   {text:"Second",provider:"gemini"}]};
 assert.equal((await fn({},state.job_id,payload,1,1)).next,-1);
 assert.equal((await fn({},state.job_id,payload,1,1)).next,-1);
 assert.equal(state.state,"paused_update");
 assert.equal(state.next_retry_at,null);
 assert.equal(state.completed,1);
 assert.equal(state.segments[0].state,"ready");
 assert.equal(calls,0);
 assert.ok(saves>0);
});
test("New Worker only accepts its paired frontend generation release",()=>{
 const source=between(worker,"// Release fence: every Queue delivery",
   "async function processGenerationJobLocked(");
 const f=new Function("APP_VERSION","READER_GENERATION_UI_VERSION",
   "addGenerationTrace","saveGenerationStatus",
   "const GENERATION_RELEASE_ID=APP_VERSION+'/'+READER_GENERATION_UI_VERSION;\n"+
   source+"\nreturn {matchesGenerationRelease,parkGenerationForUpdate};")(
     "1.4.41","1.4.106",()=>{},async()=>{});
 assert.equal(f.matchesGenerationRelease({generation_release:"1.4.41/1.4.106",client_version:"1.4.106"}),true);
 assert.equal(f.matchesGenerationRelease({generation_release:"1.4.40/1.4.105",client_version:"1.4.105"}),false);
 assert.equal(f.matchesGenerationRelease({}),false);
 assert.equal(f.parkGenerationForUpdate({state:"ready"}).state,"ready");
});
test("Adaptive processing always prioritizes newly activated split pieces",()=>{
 const helper=between(worker,"function validateAdaptiveRepairPayload(",
   "async function activateNextContinueJob(");
 let s={job_id:"a".repeat(64),state:"queued",completed:0,total:2,
   segments:[
    {state:"queued",cache_key:"a".repeat(64)},
    {state:"dormant",cache_key:"b".repeat(64)},
    {state:"dormant",cache_key:"c".repeat(64)},
    {state:"queued",cache_key:"d".repeat(64)}
   ]},seen=[];
 const nodes=[
   {repair_path:"",repair_parent:-1,segment_index:0,repair_source_index:0},
   {repair_path:"L",repair_parent:0,segment_index:0,repair_source_index:0},
   {repair_path:"R",repair_parent:0,segment_index:0,repair_source_index:0},
   {repair_path:"",repair_parent:-1,segment_index:1,repair_source_index:1}
 ].map((n,i)=>({...n,provider:"gemini",voice_id:"Puck",
   cache_key:["a","b","c","d"][i].repeat(64),model_id:"gemini-3.8-flash-tts",
   text:"This is the unchanged narration text."}));
 const deps={
   GENERATION_RELEASE_ID:"1.4.41/1.4.106",READER_GENERATION_UI_VERSION:"1.4.106",
   readGenerationStatus:async()=>JSON.parse(JSON.stringify(s)),
   saveGenerationStatus:async(_,st)=>{s=JSON.parse(JSON.stringify(st))},
   hasCachedAudio:async()=>false,previouslyGeneratedChapterAudio:async()=>null,
   acquireProcessingLease:async()=>true,releaseProcessingLease:async()=>{},
   r2Get:async()=>null,
   synthesizeAudio:async(_,__,node)=>{
     seen.push(node.repair_path||"source"+node.segment_index);
     if(node.repair_path===""){
       if(node.segment_index===0){
         const error=new Error("Input blocked");error.contentBlocked=true;throw error;
       }
     }
     return {cache:"MISS",model:node.model_id,calculated_cost:0};
   },
   addGenerationTrace:()=>{},recordTtsUsage:async()=>{}
 };
 const names=Object.keys(deps);
 const core=new Function(...names,helper+
   "\nreturn processGenerationJobLocked;")(...names.map(n=>deps[n]));
 for(let n=0;n<10;n++){
   s.next_retry_at=0;
   if(!s.segments.some(x=>x.state==="queued"))break;
   await core({OPALREADER_STORAGE:{put:async()=>{}}},s.job_id,{generation_release:"1.4.41/1.4.106",client_version:"1.4.106",
     adaptive_repair:true,adaptive_source_mode:"mixed",
     diagnostic_job_kind:"adaptive_repair",segments:nodes},3,1);
 }
 assert.deepEqual(seen,["source0","L","R","source1"]);
 assert.equal(s.state,"ready");
});
test("UI handles update pause without automatic resume",()=>{
 assert.match(reader,/const GENERATION_RELEASE_ID=/);
 assert.match(reader,/generationReleaseStamp/);
 assert.match(reader,/session\.state==="update_paused"/);
 assert.match(reader,/Generation paused for update/);
 assert.match(reader,/Restart after update/);
 assert.match(reader,/Worker update needed/);
 assert.match(reader,/async function continueAdaptiveBatches/);
 assert.match(reader,/if\(c\?\.state==="paused_update"\)/);
});
