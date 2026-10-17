// Run: node --test tests/adaptive-background-repair.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const app=readFileSync(new URL("../app-241.js",import.meta.url),"utf8");
const section=(src,start,end)=>{const i=src.indexOf(start),j=src.indexOf(end,i);
  assert.ok(i>=0&&j>i,start+" source missing");return src.slice(i,j)};
const repair=section(worker,"function validateAdaptiveRepairPayload(","async function processGenerationJob(");
const helpers=new Function(repair+"\nreturn {validateAdaptiveRepairPayload,activateAdaptiveChildren,generationSegmentTerminal,nextGenerationSegmentIndex};")();
const tree=[[-1,"L"],[0,"LL"],[0,"LR"],[-1,"R"]].map(([parent,path],i)=>({
  repair_parent:parent,repair_path:path,repair_source_index:18,segment_index:18,
  provider:"gemini",voice_id:"Puck",model_id:"gemini-3.8-flash-tts",
  cache_key:"a".repeat(63)+i,text:"test"
}));
test("reject malformed adaptive trees and non-Gemini requests",()=>{
  const valid=parts=>helpers.validateAdaptiveRepairPayload({
    adaptive_repair:true,diagnostic_job_kind:"adaptive_repair",segments:parts});
  assert.equal(valid(tree),true);
  for(const edit of [p=>p[2].repair_path="LL",
    p=>p[3].provider="openai",p=>p[2].repair_parent=2]){
    const broken=JSON.parse(JSON.stringify(tree));edit(broken);assert.equal(valid(broken),false);
  }
});
test("dormant repair branches never synthesize until parent blocks",()=>{
  const status={segments:tree.map(p=>({state:p.repair_parent<0?"queued":"dormant"}))};
  assert.equal(helpers.nextGenerationSegmentIndex(status.segments),0);
  assert.equal(helpers.generationSegmentTerminal(status.segments[1]),true);
  assert.ok(helpers.activateAdaptiveChildren({segments:tree},status,0));
  assert.deepEqual(status.segments.map(x=>x.state),["split","queued","queued","queued"]);
});
test("durable Worker queue finishes a nested blocked passage without browser callbacks",async()=>{
  let saved={job_id:"b".repeat(64),state:"queued",total:2,completed:0,
    segments:tree.map(p=>({cache_key:p.cache_key,state:p.repair_parent<0?"queued":"dormant"}))};
  const calls=[];
  const deps={
    readGenerationStatus:async()=>JSON.parse(JSON.stringify(saved)),
    saveGenerationStatus:async(_env,status)=>{saved=JSON.parse(JSON.stringify(status))},
    hasCachedAudio:async()=>false,previouslyGeneratedChapterAudio:async()=>null,
    synthesizeAudio:async(_env,_provider,p)=>{
      calls.push(p.repair_path);
      if(p.repair_path==="L"){const err=new Error("Input blocked");err.contentBlocked=true;
        err.blockReason="POLICY_BLOCK";err.finishReason="HTTP_400";throw err}
      return {cache:"MISS",model:p.model_id,calculated_cost:0.0002};
    },
    recordTtsUsage:async()=>{},addGenerationTrace:()=>{},
    extractGeminiQuotaDiagnostics:()=>({http_status:429}),
    // Queue simulation: independently test the actual shared pacing below.
    acquireProcessingLease:async()=>true,releaseProcessingLease:async()=>{},
    r2Get:async()=>null
  };
  const names=Object.keys(deps);
  const process=new Function(...names,repair+"\nreturn processGenerationJobLocked;")(...names.map(n=>deps[n]));
  for(let i=0;i<8;i++){
    saved.next_retry_at=0; // simulate the actual delayed Cloudflare Queue delivery
    const next=saved.segments.findIndex(x=>x.state==="queued");
    if(next<0)break;
    await process({OPALREADER_STORAGE:{put:async()=>{}}},saved.job_id,{adaptive_repair:true,segments:tree,
      book_id:"book_12345678",chapter_index:0},next,1);
  }
  assert.deepEqual(calls,["L","LL","LR","R"]);
  assert.deepEqual(saved.segments.map(x=>x.state),["split","ready","ready","ready"]);
  assert.equal(saved.state,"ready");
  assert.equal(saved.total,3);
  assert.equal(saved.completed,3);
});
test("reconnect merges leaves by exact original segment while keeping neighboring audio",()=>{
  const code=section(app,"function applyAdaptiveRepair(","async function queueAdaptiveRepair(");
  let uid=0;
  const apply=new Function("crypto","segIdentity","geminiRootInfo",
    code+"\nreturn applyAdaptiveRepair;")(
      {randomUUID:()=>String(++uid)},s=>s.id+":"+s.text,()=>({splits:0,failures:[]}));
  const ch={pov:"Narrator",segments:[
    {id:"a",text:"ready",audioKey:"existing"},
    {id:"b",text:"blocked text",generationBlocked:{blockReason:"POLICY_BLOCK"}},
    {id:"c",text:"more ready",audioKey:"existing2"}
  ]};
  const local={repairApplied:false,
    repairRoots:[{index:1,id:"b",identity:"b:blocked text",rootId:"b",begin:0,count:2}],
    repairNodes:[{text:"blocked ",speechText:"blocked ",fingerprint:"x",model_id:"gemini"},
      {text:"text",speechText:"text",fingerprint:"y",model_id:"gemini"}]};
  const response={job_id:"job",state:"ready",segments:[
    {cache_key:"x",state:"ready",model:"gemini"},{cache_key:"y",state:"ready",model:"gemini"}]};
  assert.equal(apply(ch,local,response),true);
  assert.deepEqual(ch.segments.map(x=>x.audioKey),["existing","x","y","existing2"]);
  assert.equal(apply(ch,local,response),false);
});

test("shared Gemini queue pace reserves at most one new call per seven seconds",async()=>{
  const source=section(worker,"const GEMINI_GLOBAL_PACE_MS","function adaptiveRepairCounts(");
  let now=10000,stamp=null,puts=0,locks=0;
  const reserve=new Function("Date","acquireProcessingLease","releaseProcessingLease","r2Get",
    source+"\nreturn reserveGeminiQueuePace;")(
    {now:()=>now},async()=>{locks++;return true},async()=>{},
    async()=>stamp?{json:async()=>stamp}:null);
  const env={OPALREADER_STORAGE:{put:async(_key,raw)=>{stamp=JSON.parse(raw);puts++}}};
  const first=await reserve(env),second=await reserve(env);
  assert.equal(first.ready,true);
  assert.equal(second.ready,false);
  assert.equal(second.retryAt,17000);
  now=17000;
  assert.equal((await reserve(env)).ready,true);
  assert.equal(puts,2);
  assert.equal(locks,3);
});
