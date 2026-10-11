// Run: node --test tests/generation-playback-concurrency.test.mjs
// Synthetic playback data only. No Gemini requests or book audio.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src=readFileSync(new URL("../app-227.js",import.meta.url),"utf8");
const span=(begin,end)=>{
  const a=src.indexOf(begin),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,"Missing expected function "+begin);
  return src.slice(a,b);
};
const runner=span("function continuousRunEnd(","async function individualFromCompositeTime(");
const planner=new Function("a",runner+"\nreturn continuousRunEnd;");
const seg=()=>({text:"x".repeat(1700),audioKey:"a".repeat(64),audioStale:false});

test("generating a different chapter shrinks composite work without disabling continuous playback",()=>{
  const playing={segments:Array.from({length:10},seg)};
  const later={generation:{state:"generating"},segments:[seg()]};
  const a={book:{chapters:[playing,later]}},run=planner(a);
  assert.equal(run(playing,0),2);
  assert.equal(run(playing,2),4);
  later.generation.state="ready";
  assert.equal(run(playing,0),8);
});

test("next-section starts use the nonblocking path by default",()=>{
  assert.match(src,/async function playContinuousFrom\(chapterIndex,segmentIndex,position=0,\{fastStart=true,/);
  assert.match(src,/timer=setTimeout\(cleanup,60000\)/);
  assert.match(src,/warmFollowingAudioChunk\(e,end\)/);
});

test("concurrent playback and warmup request a given composite only once",async()=>{
  const cacheSource=span('const LOCAL_CONTINUOUS_AUDIO_ID=',"async function playChapterComposite(");
  const records=new Map(),calls=[];
  const a={apiBase:"fake",accessToken:"fake",book:{
    id:"book-one",chapters:[{id:"chapter-one",segments:[{audioKey:"a"},{audioKey:"b"}]}]
  }};
  const run=new Function("deps",
    "const {a,Oe,ke,chapterComposite,dl,console}=deps;\n"+
    cacheSource+"\nreturn getCompositeBlob;")({
      a,
      Oe:async(store,key)=>records.get(key)||null,
      ke:async(store,record)=>records.set(record.id,record),
      chapterComposite:async()=>{calls.push("POST");await new Promise(ok=>setTimeout(ok,10));return {size:5000};},
      dl:()=>{},
      console:{warn:()=>{}},
    });
  const results=await Promise.all([run(0,0,2),run(0,0,2),run(0,0,2)]);
  assert.equal(calls.length,1);
  assert.ok(results.every(x=>x?.size===5000));
});
