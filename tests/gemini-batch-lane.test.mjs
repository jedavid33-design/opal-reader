// Run: node --test tests/gemini-batch-lane.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const app=readFileSync(new URL("../app-254.js",import.meta.url),"utf8");
const start=worker.indexOf("// Gemini 3.8 Batch uses generateContent");
const end=worker.indexOf("\nasync function processGenerationJobLocked(",start);
assert.ok(start>0&&end>start,"Missing Batch helper");
const helper=worker.slice(start,end);
const makeWav=()=>Buffer.concat([Buffer.from("RIFF"),Buffer.alloc(40)]);
function harness(fetchImpl){
 const events=[],saved=[],stored=[];
 const audio=makeWav();
 const deps={
  saveGenerationStatus:async(_e,status)=>{saved.push(JSON.parse(JSON.stringify(status)))},
  fetch:fetchImpl,recordGeminiGenerationSuccess:async()=>{},
  recordTtsUsage:async(_e,_seg,detail)=>{events.push(detail)},
  addGenerationTrace:()=>{},
  plainSpeechText:x=>x,hasCachedAudio:async()=>false,
  storeAudioWithRetry:async(_e,key,bytes)=>{stored.push({key,bytes})},
  decodeBase64:data=>new Uint8Array(Buffer.from(data,"base64")),
  geminiUsageAccounting:()=>({calculated_cost:1,input_price_per_million:0.5,
    output_price_per_million:9,input_tokens:5,output_tokens:12}),
 };
 const names=Object.keys(deps);
 const run=new Function(...names,helper+"\nreturn stepGeminiBatch;")(...names.map(n=>deps[n]));
 return {run,events,saved,stored,audio};
}
const fakeSegment={
 model_id:"gemini-3.8-flash-tts",provider:"gemini",voice_id:"Zephyr",
 style_direction:"bright conversational",text:"A quiet harbor at sunrise.",
 cache_key:"a".repeat(64),segment_index:2,
};
test("Batch submission is one-time, polls same name and stores playable WAV",async()=>{
 let gets=0,posts=0;
 const h=harness(async(url,req)=>{
  if(req?.method==="POST"){
    posts++;
    const body=JSON.parse(req.body);
    assert.equal(body.batch.input_config.requests.requests.length,1);
    const one=body.batch.input_config.requests.requests[0].request;
    assert.equal(one.generationConfig.speechConfig.voiceConfig.voice,"Zephyr");
    assert.equal(one.contents[0].parts[0].text,fakeSegment.text);
    assert.match(one.contents[0].parts[0].speech_metadata.style,/bright conversational/);
    return new Response(JSON.stringify({name:"batches/test_123"}),{status:200});
  }
  gets++;
  if(gets===1)return new Response(JSON.stringify({state:"JOB_STATE_RUNNING"}),{status:200});
  return new Response(JSON.stringify({state:"JOB_STATE_SUCCEEDED",
    dest:{inlinedResponses:[{response:{candidates:[{content:{parts:[
      {inlineData:{data:h.audio.toString("base64"),mimeType:"audio/wav"}}
    ]}}],usageMetadata:{promptTokenCount:5,candidatesTokenCount:12}}}]}}),{status:200});
 });
 const status={state:"generating",segments:[{state:"generating"}]};
 const env={GEMINI_API_KEY:"secret"};
 const id="f".repeat(64);
 const one=await h.run(env,id,fakeSegment,status,0);
 assert.equal(one.waiting,true);
 assert.equal(status.segments[0].batch_job_name,"batches/test_123");
 const two=await h.run(env,id,fakeSegment,status,0);
 assert.equal(two.waiting,true);
 const three=await h.run(env,id,fakeSegment,status,0);
 assert.equal(three.cache,"MISS");
 assert.equal(posts,1,"Never duplicate a billable submit");
 assert.equal(gets,2);
 assert.equal(h.stored.length,1);
 assert.equal(h.stored[0].key,fakeSegment.cache_key);
 assert.equal(h.events.length,1);
 assert.equal(h.events[0].calculated_cost,0.5,"Batch discounted cost");
});
test("An ambiguous POST never triggers an automatic second submission",async()=>{
 let posts=0;
 const h=harness(async(_url,req)=>{if(req?.method==="POST")posts++;throw Error("network timeout")});
 const status={state:"generating",segments:[{state:"generating"}]},env={GEMINI_API_KEY:"secret"};
 await assert.rejects(h.run(env,"f".repeat(64),fakeSegment,status,0),e=>e.noRetry===true);
 await assert.rejects(h.run(env,"f".repeat(64),fakeSegment,status,0),/unknown outcome/);
 assert.equal(posts,1);
 assert.equal(status.segments[0].batch_submit_attempted,true);
});
test("Mode control is saved and included in new jobs only",()=>{
 assert.match(app,/geminiLane:"batch"/);
 assert.match(app,/id="chapterLane"/);
 assert.match(app,/id="generationLane"/);
 assert.match(app,/generation_mode:a\.geminiLane/);
 assert.match(app,/mode:a\.geminiLane/);
 assert.match(worker,/const APP_VERSION = "1\.4\.42"/);
 assert.match(worker,/const READER_GENERATION_UI_VERSION = "1\.4\.116"/);
 assert.match(app,/const APP_UI_VERSION="1\.4\.116"/);
});
