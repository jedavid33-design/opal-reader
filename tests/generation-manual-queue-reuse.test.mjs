// Run: node --test tests/generation-manual-queue-reuse.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const app=readFileSync(new URL("../app-239.js",import.meta.url),"utf8");
const between=(src,a,b)=>{const start=src.indexOf(a),end=src.indexOf(b,start);assert.ok(start>=0&&end>start);return src.slice(start,end)};
const queue=between(worker,"function addGenerationTrace(","async function processGenerationJob(");
const fp="f".repeat(64),audio="e".repeat(64),fresh="c".repeat(64);
const clone=v=>JSON.parse(JSON.stringify(v));
async function exercise(saved,key,exists=true){
  let syntheses=0,park=null;
  const status={job_id:"d".repeat(64),state:"queued",total:1,segments:[{state:"queued",cache_key:key}]};
  const store=new Map();
  const env={OPALREADER_KV:{get:async()=>({id:"validbook123",chapters:[{segments:[saved]}]})},
    OPALREADER_STORAGE:{put:async(k,v)=>store.set(k,v),
      get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k)),
        text:async()=>store.get(k)}:null}};
  const args=[
    x=>/^[a-zA-Z0-9_-]{8,100}$/.test(x||""),
    x=>/^[a-f0-9]{64}$/.test(x||""),
    async(_,x)=>exists&&x===audio,
    async()=>clone(status),async()=>{},
    async()=>{syntheses++;return{cache:"MISS",calculated_cost:0.01}},
    async()=>{},()=>({end:Date.now()+10_000}),
    "1.4.43/1.4.117","1.4.117",
    async()=>park,
    async(_,c)=>{if(!park||Number(c?.parked_until)>Number(park.parked_until))park=c;return park},
    (p,now=Date.now())=>!!p&&Number(p.parked_until)>now,
    p=>{try{return new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",
      hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(
      new Date(Number(p?.parked_until)||0))}catch{return ""}},
    async()=>true,async()=>{},async()=>null
  ];
  const fn=new Function("validId","validCacheKey","hasCachedAudio","readGenerationStatus","saveGenerationStatus","synthesizeAudio","recordTtsUsage","geminiPacificDayBounds","GENERATION_RELEASE_ID","READER_GENERATION_UI_VERSION","readGeminiQuotaPark","recordGeminiQuotaPark","geminiParkIsActive","parkUntilLabel","acquireProcessingLease","releaseProcessingLease","r2Get",queue+"\nreturn processGenerationJobLocked;")(...args);
  const payload={book_id:"validbook123",chapter_index:0,generation_release:"1.4.43/1.4.117",client_version:"1.4.117",segments:[{provider:"gemini",segment_index:0,cache_key:key,fingerprint:fp}]};
  return {out:await fn(env,status.job_id,payload,0,1),syntheses};
}
test("saved matching manual audio avoids a new Gemini request",async()=>{
  const {out,syntheses}=await exercise({audioKey:audio,generationFingerprint:fp,audioStale:false},fp);
  assert.equal(syntheses,0);
  assert.equal(out.status.segments[0].cache_key,audio);
  assert.ok(out.status.generation_trace.some(x=>x.event==="reused_manual_audio"&&x.segment===1));
});
test("mismatched fingerprint, stale audio and missing R2 never skip synthesis",async()=>{
  for(const [saved,exists] of [
    [{audioKey:audio,generationFingerprint:"a".repeat(64)},true],
    [{audioKey:audio,generationFingerprint:fp,audioStale:true},true],
    [{audioKey:audio,generationFingerprint:fp},false]
  ])assert.equal((await exercise(saved,fp,exists)).syntheses,1);
});
test("intentional forced regeneration bypasses manual reuse",async()=>{
  const {out,syntheses}=await exercise({audioKey:audio,generationFingerprint:fp},fresh);
  assert.equal(syntheses,1);
  assert.ok(!out.status.generation_trace.some(x=>x.event==="reused_manual_audio"));
});
test("missing manual audio uses stable key, existing or stale regenerations stay fresh",()=>{
  const code=between(app,"function needsFreshManualTake(","async function regenerateOneSegment(");
  const policy=new Function(code+"return needsFreshManualTake;")();
  assert.equal(policy({audioKey:null,audioStale:false}),false);
  assert.equal(policy({audioKey:audio,audioStale:false}),true);
  assert.equal(policy({audioKey:null,audioStale:true}),true);
  assert.match(app,/cacheKey=needsFreshManualTake\(seg\)\?await tt\(fingerprint\+":force:"\+crypto.randomUUID\(\)\):fingerprint/);
});
