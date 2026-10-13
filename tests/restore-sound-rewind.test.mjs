
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
// Verify the offset is applied before mapping stitched time to the original audio.
const js=readFileSync(new URL("../app-235.js",import.meta.url),"utf8");
const start=js.indexOf("async function recoveryRewindPosition(");
const stop=js.indexOf("async function recoverSilentAudio(){",start);
assert.ok(start>=0&&stop>start);
const code=js.slice(start,stop);
function h(durations){
 const events=[],book={chapters:[{segments:durations.map(()=>({audioKey:"a"}))}]};
 const a={book};
 const sectionDuration=async(ch,i)=>durations[i];
 const lastPlayable=(ch,i)=>i>=0?i:-1;
 const individualFromCompositeTime=async(ch,start,end,time)=>{
  events.push(["map",time]);
  let remaining=time;
  for(let i=start;i<end;i++){if(remaining<durations[i])return{segment:i,position:remaining};remaining-=durations[i]}
  return {segment:end-1,position:Math.max(0,durations[end-1]-.25)};
 };
 const fn=new Function("ctx",
  "const {a,sectionDuration,lastPlayable,individualFromCompositeTime,dl}=ctx;"+
  code+"return recoveryRewindPosition;")({a,sectionDuration,lastPlayable,individualFromCompositeTime,dl:()=>{}});
 return{fn,events};
}
test("stitched recovery rewinds 15 seconds before mapping segment",async()=>{
 const {fn,events}=h([45,60,80]);
 assert.deepEqual(await fn(0,0,3,67,true),{segment:1,position:7});
 assert.deepEqual(events,[["map",52]]);
});
test("at the beginning of a composite, rewind crosses into previous segment",async()=>{
 const {fn}=h([30,50,80,40]);
 assert.deepEqual(await fn(0,2,4,7,true),{segment:1,position:42});
});
test("individual recovery rewinds within the segment",async()=>{
 const {fn}=h([30,50]);
 assert.deepEqual(await fn(0,1,2,35,false),{segment:1,position:20});
});
test("individual recovery at 6 seconds includes previous segment",async()=>{
 const {fn}=h([30,50]);
 assert.deepEqual(await fn(0,1,2,6,false),{segment:0,position:21});
});
test("start of chapter clamps at zero",async()=>{
 const {fn}=h([30,50]);
 assert.deepEqual(await fn(0,0,2,6,true),{segment:0,position:0});
});
test("safe fallback if duration metadata unavailable",async()=>{
 const {fn}=h([0,50]);
 assert.deepEqual(await fn(0,1,2,6,false),{segment:0,position:0});
});
test("previous fixes and continuity remain available",()=>{
 assert.match(js,/async function recoverSilentAudio\(\)/);
 assert.match(js,/function chapterQuotaBanner\(/);
 assert.match(js,/recovery segment-only/);
 assert.match(js,/navigator\.serviceWorker\.register\("\.\/sw-197\.js"\)/);
 assert.match(js,/const APP_UI_VERSION="1\.4\.97"/);
});
