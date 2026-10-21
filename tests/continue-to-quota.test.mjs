// node --test tests/continue-to-quota.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const w=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const app=readFileSync(new URL("../app-242.js",import.meta.url),"utf8");
const between=(src,a,b)=>{
  const i=src.indexOf(a),j=src.indexOf(b,i);
  assert.ok(i>=0&&j>i,"missing source "+a);return src.slice(i,j);
};
test("Gemini 429 pauses permanently until a manual action; late deliveries cannot spend",async()=>{
  const code=between(w,"async function processGenerationJobLocked(","async function activateNextContinueJob(");
  let state={job_id:"a".repeat(64),state:"queued",completed:0,total:1,
    segments:[{cache_key:"b".repeat(64),state:"queued"}]};
  let calls=0,park=null;
  const deps={
    readGenerationStatus:async()=>JSON.parse(JSON.stringify(state)),
    saveGenerationStatus:async(_,v)=>{state=JSON.parse(JSON.stringify(v))},
    hasCachedAudio:async()=>false,previouslyGeneratedChapterAudio:async()=>null,
    reserveGeminiQueuePace:async()=>({ready:true}),
    synthesizeAudio:async()=>{
      calls++;const e=new Error("Quota exceeded");e.quotaExceeded=true;throw e;
    },
    gemini429Cooldown:()=>({scope:"daily",retryAt:Date.now()+500000,delaySeconds:500}),
    matchesGenerationRelease:v=>v?.generation_release==="1.4.43/1.4.117"&&
      v?.client_version==="1.4.117",
    pauseGenerationForUpdate:async(_,s)=>{state={...s,state:"paused_update",
      next_retry_at:null};return state},
    readGeminiQuotaPark:async()=>park,
    recordGeminiQuotaPark:async(_,c)=>{if(!park||
      Number(c?.parked_until)>Number(park.parked_until))park=c;return park},
    geminiParkIsActive:(p,now=Date.now())=>!!p&&Number(p.parked_until)>now,
    parkUntilLabel:p=>{try{return new Intl.DateTimeFormat("en-US",{
      timeZone:"America/Los_Angeles",hour:"numeric",minute:"2-digit",
      timeZoneName:"short"}).format(new Date(Number(p?.parked_until)||0))}
      catch{return ""}},
    geminiBatchMode:(pl,seg)=>pl?.generation_mode==="batch"&&seg?.provider==="gemini",
    extractGeminiQuotaDiagnostics:()=>({http_status:429}),
    addGenerationTrace:()=>{},generationDelaySeconds:()=>0,
    legacyOvernightQuota:()=>false,
    nextGenerationSegmentIndex:arr=>arr.findIndex(x=>
      !["ready","blocked","provider_failed","dormant","split"].includes(x.state)),
    generationSegmentTerminal:item=>["ready","blocked","provider_failed","dormant","split"].includes(item?.state)
  };
  const names=Object.keys(deps),fn=new Function(...names,code+"\nreturn processGenerationJobLocked;")(
    ...names.map(n=>deps[n]));
  const p={generation_release:"1.4.43/1.4.117",client_version:"1.4.117",
    segments:[{provider:"gemini",text:"Test",voice_id:"Puck",
    cache_key:"b".repeat(64),model_id:"gemini-3.8-flash-tts"}]};
  const response=await fn({},state.job_id,p,0,1);
  assert.equal(response.next,-1);
  assert.equal(state.state,"paused_quota");
  assert.equal(state.next_retry_at,null);
  assert.equal(state.quota_diagnostics[0].manual_resume_required,true);
  assert.equal(state.quota_diagnostics[0].scheduled_retry_at,null);
  await fn({},state.job_id,p,0,1); // already delayed from older Queue
  assert.equal(calls,1);
});
test("Continue stage is sequential and idempotent; manual resume enqueues exactly once",async()=>{
  const code=between(w,"async function activateNextContinueJob(","async function processGenerationJob(");
  const statuses=new Map(),messages=[],payloads=new Map();
  const deps={
    validJobId:x=>/^[a-f0-9]{64}$/.test(x),
    validId:x=>/^[A-Za-z0-9_-]{8,100}$/.test(x),
    validCacheKey:x=>/^[a-f0-9]{64}$/.test(x),
    validateAdaptiveRepairPayload:()=>true,
    hasCachedAudio:async()=>false,
    acquireProcessingLease:async()=>true,releaseProcessingLease:async()=>{},
    readGenerationStatus:async(_,id)=>statuses.get(id)||null,
    saveGenerationStatus:async(_,s)=>statuses.set(s.job_id,JSON.parse(JSON.stringify(s))),
    GENERATION_RELEASE_ID:"1.4.43/1.4.117",
    matchesGenerationRelease:v=>v?.generation_release==="1.4.43/1.4.117"&&
      v?.client_version==="1.4.117",
    pauseGenerationForUpdate:async(_,s)=>{const u={...s,state:"paused_update",
      next_retry_at:null};statuses.set(u.job_id,JSON.parse(JSON.stringify(u)));return u},
    readGeminiQuotaPark:async()=>null,
    geminiParkIsActive:(p,now=Date.now())=>!!p&&Number(p.parked_until)>now,
    recordJobRegistryMarker:async()=>{},
    readGenerationPayload:async(_,id)=>{const raw=payloads.get(
      "generation/jobs/"+id+".json");return raw?JSON.parse(raw):null},
    generationPayloadKey:id=>"generation/jobs/"+id+".json",
    nextGenerationSegmentIndex:arr=>arr.findIndex(x=>x.state==="queued"),
    finishGenerationState:s=>{s.state="ready"},
    addGenerationTrace:()=>{},syncReady:()=>true
  };
  const names=Object.keys(deps),helpers=new Function(...names,
    code+"\nreturn {stageContinueSession,activateNextContinueJob,resumeQuotaJob};")(
      ...names.map(n=>deps[n]));
  const env={OPALREADER_STORAGE:{put:async(k,v)=>payloads.set(k,v),
      get:async k=>payloads.has(k)?{json:async()=>JSON.parse(payloads.get(k)),
        text:async()=>payloads.get(k)}:null},
    OPALREADER_GENERATION:{send:async msg=>messages.push(msg)}};
  const ids=["a".repeat(64),"b".repeat(64)],session="c".repeat(64),book="book12345";
  const job=i=>({job_id:ids[i],book_id:book,chapter_index:i+22,
    generation_release:"1.4.43/1.4.117",client_version:"1.4.117",
    segments:[{provider:"gemini",voice_id:"Puck",text:"Words",
      cache_key:String(i+1).repeat(64)}]});
  const plan={session_id:session,book_id:book,jobs:[job(0),job(1)]};
  const staged=await helpers.stageContinueSession(env,plan);
  assert.deepEqual(staged.jobs.map(j=>j.state),["queued","parked"]);
  assert.equal(messages.length,1);
  await helpers.stageContinueSession(env,plan);
  assert.equal(messages.length,1);
  await helpers.activateNextContinueJob(env,{continue_next_job_id:ids[1]});
  assert.equal(messages.length,2);
  assert.equal(statuses.get(ids[1]).state,"queued");
  const paused=statuses.get(ids[1]);
  paused.state="paused_quota";paused.cooldown_reason="quota";
  statuses.set(ids[1],paused);
  const resumed=await helpers.resumeQuotaJob(env,ids[1]);
  assert.equal(resumed.resumed,true);
  assert.equal(messages.length,3);
  assert.equal(statuses.get(ids[1]).state,"queued");
  await helpers.resumeQuotaJob(env,ids[1]);
  assert.equal(messages.length,3);
});
test("Older 3AM cooldown messages are migrated to manual pause",async()=>{
  const code=between(w,"const legacyOvernightQuota =","async function processGenerationJobLocked(");
  let state={job_id:"a".repeat(64),state:"queued",cooldown_reason:"quota",cooldown_scope:"daily",
    next_retry_at:Date.now()+800000,segments:[{state:"queued"}]};
  const deps={acquireProcessingLease:async()=>true,releaseProcessingLease:async()=>{},
    readGenerationStatus:async()=>state,
    saveGenerationStatus:async(_,updated)=>{state=updated},
    addGenerationTrace:()=>{}};
  const names=Object.keys(deps);
  const migrate=new Function(...names,code+"\nreturn pauseLegacyQuotaJob;")(
    ...names.map(n=>deps[n]));
  const after=await migrate({},state.job_id,state);
  assert.equal(after.state,"paused_quota");
  assert.equal(after.next_retry_at,null);
});
test("Frontend shows manual restart and isolates the book to upcoming Gemini chapters",()=>{
  assert.match(app,/Continue to quota/);
  assert.match(app,/Continue to quota requires deployed Reader Worker 1\.4\.39/);
  assert.match(app,/async function continueToQuota\(/);
  assert.match(app,/async function resumeChapterQuota\(/);
  assert.match(app,/refreshContinueSession/);
  assert.match(app,/manual restart/);
  assert.doesNotMatch(app,/Auto-retry at/);
  assert.match(app,/for\(let i=start;i<book\.chapters\.length/);
  assert.match(app,/candidate\?\.provider!=="gemini"/);
});

test("Temporary Gemini minute-rate 429 backs off but does not require morning tap",async()=>{
  const code=between(w,"async function processGenerationJobLocked(","async function activateNextContinueJob(");
  let state={job_id:"a".repeat(64),state:"queued",completed:0,total:1,
    segments:[{cache_key:"b".repeat(64),state:"queued"}]};
  let calls=0,park=null;
  const deps={
    readGenerationStatus:async()=>JSON.parse(JSON.stringify(state)),
    saveGenerationStatus:async(_,v)=>{state=JSON.parse(JSON.stringify(v))},
    hasCachedAudio:async()=>false,previouslyGeneratedChapterAudio:async()=>null,
    reserveGeminiQueuePace:async()=>({ready:true}),
    synthesizeAudio:async()=>{calls++;const e=new Error("per minute rate limit");
      e.quotaExceeded=true;throw e},
    gemini429Cooldown:()=>({scope:"temporary",retryAt:Date.now()+90000,delaySeconds:90}),
    matchesGenerationRelease:v=>v?.generation_release==="1.4.43/1.4.117"&&
      v?.client_version==="1.4.117",
    pauseGenerationForUpdate:async(_,s)=>{state={...s,state:"paused_update",
      next_retry_at:null};return state},
    readGeminiQuotaPark:async()=>park,
    recordGeminiQuotaPark:async(_,c)=>{if(!park||
      Number(c?.parked_until)>Number(park.parked_until))park=c;return park},
    geminiParkIsActive:(p,now=Date.now())=>!!p&&Number(p.parked_until)>now,
    parkUntilLabel:p=>{try{return new Intl.DateTimeFormat("en-US",{
      timeZone:"America/Los_Angeles",hour:"numeric",minute:"2-digit",
      timeZoneName:"short"}).format(new Date(Number(p?.parked_until)||0))}
      catch{return ""}},
    geminiBatchMode:(pl,seg)=>pl?.generation_mode==="batch"&&seg?.provider==="gemini",
    extractGeminiQuotaDiagnostics:()=>({http_status:429}),
    addGenerationTrace:()=>{},generationDelaySeconds:()=>0,
    legacyOvernightQuota:()=>false,
    nextGenerationSegmentIndex:arr=>arr.findIndex(x=>
      !["ready","blocked","provider_failed","dormant","split"].includes(x.state)),
    generationSegmentTerminal:item=>["ready","blocked","provider_failed","dormant","split"].includes(item?.state)
  };
  const names=Object.keys(deps),fn=new Function(...names,code+"\nreturn processGenerationJobLocked;")(
    ...names.map(n=>deps[n]));
  const response=await fn({},state.job_id,{generation_release:"1.4.43/1.4.117",
    client_version:"1.4.117",segments:[{provider:"gemini",text:"T",
    voice_id:"Puck",cache_key:"b".repeat(64)}]},0,1);
  assert.equal(response.next,0);
  assert.equal(response.delaySeconds,90);
  assert.equal(state.state,"queued");
  assert.ok(state.next_retry_at>Date.now());
  assert.equal(state.quota_diagnostics[0].manual_resume_required,false);
  assert.equal(calls,1);
});
