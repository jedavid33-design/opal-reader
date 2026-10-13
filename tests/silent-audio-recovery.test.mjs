// Run: node --test tests/silent-audio-recovery.test.mjs
// No network, Gemini calls, or personal audio.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const js=readFileSync(new URL("../app-233.js",import.meta.url),"utf8");
const start=js.indexOf("async function recoverSilentAudio(){");
const end=js.indexOf("function copyPlaybackLog(){",start);
assert.ok(start>=0&&end>start);
const fn=js.slice(start,end);
class FakeAudio {
  constructor(){
    Object.assign(this,{src:"",paused:true,muted:false,volume:1,currentTime:0,readyState:0,networkState:0});
  }
  pause(){this.paused=true;}
  load(){}
  removeAttribute(){this.src="";}
  addEventListener(){}
}
function harness({composite=true,src="blob:chapter"}={}){
  const old=new FakeAudio;
  Object.assign(old,{src,paused:false,currentTime:66.2,_chapterPlayback:true,
    _compositePlayback:composite,_compositeStartSegment:3,_compositeEndSegment:5,
    readyState:4,onplay:()=>{},onpause:()=>{},onended:()=>{},ontimeupdate:()=>{}});
  const calls=[],a={book:{id:"book-1",currentChapter:0,currentSegment:3,
    chapters:[{segments:Array.from({length:6},()=>({audioKey:"ready"}))}]}};
  const ctx={old,a,Audio:FakeAudio,URL:{revokeObjectURL:()=>{}},
    dl:msg=>calls.push(msg),checkpointReaderPlayback:()=>true,
    shelfListenPaused:()=>{},individualFromCompositeTime:async()=>({segment:4,position:6.2}),
    me:()=>{},updatePlayerTimeline:()=>{},updateMediaSession:()=>{},It:()=>{},
    traceAudioState:()=>{},Ot:async(...args)=>calls.push(args),
    alert:msg=>calls.push(msg)};
  const instance=new Function("ctx",
    "let ee=ctx.old,silentRecoveryChapter=null;"+
    "const {a,Audio,URL,dl,checkpointReaderPlayback,shelfListenPaused,individualFromCompositeTime,me,updatePlayerTimeline,updateMediaSession,It,traceAudioState,Ot,alert}=ctx;"+
    fn+"\nreturn {run:recoverSilentAudio,state:()=>({ee,silentRecoveryChapter})};")(ctx);
  return {...instance,old,calls};
}
test("silent stitched audio creates a new player and resumes at mapped original segment",async()=>{
  const h=harness();
  await h.run();
  assert.notEqual(h.state().ee,h.old);
  assert.deepEqual(h.state().silentRecoveryChapter,{bookId:"book-1",chapterIndex:0});
  assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]===0&&c[1]===4&&c[2]===6.2));
  assert.equal(h.old.src,"");
  assert.equal(h.old.onended,null);
});
test("individual playback also gets a fresh media element without losing position",async()=>{
  const h=harness({composite:false});
  await h.run();
  assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]===0&&c[1]===3&&c[2]===66.2));
});
test("no current audio is a safe no-op",async()=>{
  const h=harness({src:""});
  await h.run();
  assert.equal(h.state().ee,h.old);
  assert.ok(h.calls.some(x=>typeof x==="string"&&x.includes("Start a generated narration")));
});
test("silence recovery is local playback only; no synthesis, worker or generation calls",()=>{
  for(const forbidden of ["chapterComposite(","getCompositeBlob(","generateRestOfChapter(","gt(","xt("])
    assert.ok(!fn.includes(forbidden),forbidden);
  assert.ok(js.includes('if(silentRecoveryChapter){'));
  assert.ok(js.includes('navigator.serviceWorker.register("./sw-195.js")'));
  assert.ok(js.includes('id="recoverAudio"'));
});
