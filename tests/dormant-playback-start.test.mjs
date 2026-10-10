// Run: node --test tests/dormant-playback-start.test.mjs
// No Gemini requests, audio uploads, or network calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const source=readFileSync(new URL("../app-226.js", import.meta.url),"utf8");
const between=(start,end)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,"Missing Reader function: "+start);
 return source.slice(a,b);
};
const fastStartFn=between("async function individualFromCompositeTime(","async function Me(");
const mockBook=()=>({id:"book1",currentChapter:0,currentSegment:2,chapters:[
 {id:"chapter1",segments:[{}, {},{audioKey:"a"},{audioKey:"b"},{audioKey:"c"}]}
]});
function harness({cloud,visibility="visible"}={}){
 const calls=[],book=mockBook();
 const mediaListeners=new Map();
 const ee={src:"",paused:true,currentTime:3,duration:40,readyState:4,
   _compositePlayback:false,_restoringPosition:false,_systemSpeechActive:false,
   addEventListener:(event,handler)=>{if(!mediaListeners.has(event))mediaListeners.set(event,new Set());mediaListeners.get(event).add(handler);},
   removeEventListener:(event,handler)=>mediaListeners.get(event)?.delete(handler),
   emit:(event)=>{for(const handler of [...(mediaListeners.get(event)||[])])handler();}
 };
 const ctx={
  a:{book},ee,document:{visibilityState:visibility},
  continuousRunEnd:()=>5,
  sectionDuration:async()=>25,
  localCompositeSignature:(chapter,start,end)=>[book.id,chapter,start,end,
   ...book.chapters[chapter].segments.slice(start,end).map(seg=>seg.audioKey||"")].join("|"),
  Ot:async(ch,seg,pos)=>{calls.push(["segment",ch,seg,pos]);ee.src="blob:segment";ee.paused=false;return true;},
  playChapterComposite:async(ch,seg,pos,end,blob)=>{
    calls.push(["composite",ch,seg,pos,end,!!blob]);
    ee.src="blob:composite";ee._compositePlayback=true;return true;
  },
  getCompositeBlob:cloud??(async()=>({size:3000})),
  dl:()=>{},console:{warn:()=>{}}
 };
 const start=new Function("ctx",
 "const {a,ee,document,continuousRunEnd,sectionDuration,localCompositeSignature,Ot,playChapterComposite,getCompositeBlob,dl,console}=ctx;\n"+
 fastStartFn+"\nreturn playContinuousFrom;")(ctx);
 return {start,calls,book,ee,mediaListeners};
}
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

test("warm or fast composite starts directly, without an individual segment",async()=>{
 const h=harness();
 await h.start(0,2,4,{fastStart:true});
 assert.deepEqual(h.calls,[["composite",0,2,4,5,true]]);
});
test("dormant cold start begins with segment instead of waiting for Cloudflare",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 await h.start(0,2,4,{fastStart:true});
 assert.deepEqual(h.calls,[["segment",0,2,4]]);
 finish({size:4000});
 await delay(10);
 assert.deepEqual(h.calls[1],["composite",0,2,3,5,true]);
});
test("do not restart paused playback when background composite arrives",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 await h.start(0,2,0,{fastStart:true});
 h.ee.paused=true;
 finish({size:4000});
 await delay(10);
 assert.equal(h.calls.length,1);
});
test("do not switch audio after user navigates to another chapter",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 await h.start(0,2,0,{fastStart:true});
 h.book.currentChapter=1;
 finish({size:4000});
 await delay(10);
 assert.equal(h.calls.length,1);
});
test("do not upgrade composite while app is backgrounded",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 await h.start(0,2,0,{fastStart:true});
 h.ee.src="blob:another-segment";
 finish({size:4000});
 await delay(10);
 assert.equal(h.calls.length,1);
});
test("do not restart a changed narration segment after remote completion",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 await h.start(0,2,0,{fastStart:true});
 h.book.chapters[0].segments[2].audioKey="new-audio-key";
 finish({size:4000});
 await delay(10);
 assert.equal(h.calls.length,1);
});
test("do not switch a paused or hidden app after remote completion",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 await h.start(0,2,0,{fastStart:true});
 h.ee.paused=true;
 finish({size:4000});
 await delay(10);
 assert.equal(h.calls.length,1);
});
test("stale composite fallback resolves a saved group timestamp to the correct segment",async()=>{
 const h=harness({cloud:async()=>{throw new Error("composite offline")}});
 await h.start(0,2,50,{fastStart:true});
 assert.deepEqual(h.calls,[["segment",0,4,0]]);
});
test("late composite response waits for iPhone metadata and actual playback before joining",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 h.ee.readyState=0;
 h.ee._restoringPosition=true;
 await h.start(0,2,0,{fastStart:true});
 h.ee.paused=true;
 finish({size:4000});
 await delay(12);
 assert.equal(h.calls.length,1);
 h.ee._restoringPosition=false;
 h.ee.readyState=4;
 h.ee.emit("loadedmetadata");
 assert.equal(h.calls.length,1);
 h.ee.paused=false;
 h.ee.emit("playing");
 await delay(2);
 assert.equal(h.calls[1][0],"composite");
 assert.equal(h.calls[1][2],2);
 assert.equal(h.mediaListeners.get("playing").size,0);
});
test("warm composite response does not join after a genuine user pause",async()=>{
 let finish;const delayed=new Promise(resolve=>finish=resolve);
 const h=harness({cloud:()=>delayed});
 await h.start(0,2,0,{fastStart:true});
 h.ee.paused=true;h.ee.emit("pause");
 finish({size:4000});
 await delay(12);
 h.ee.paused=false;h.ee.emit("playing");
 assert.equal(h.calls.length,1);
});
test("failed composite download still starts locally",async()=>{
 const h=harness({cloud:async()=>{throw new Error("offline")}});
 await h.start(0,2,0,{fastStart:true});
 assert.deepEqual(h.calls,[["segment",0,2,0]]);
});

const cacheSrc=between('const LOCAL_CONTINUOUS_AUDIO_ID=',"async function playChapterComposite(");
function mockCache(){
 const records=new Map(),a={book:mockBook()},calls=[];
 const methods=new Function("ctx",
  "const {a,Oe,ke,chapterComposite,dl,console}=ctx;\n"+cacheSrc+
  "\nreturn {localCompositeSignature,recentComposite,rememberComposite,getCompositeBlob};"
 )({
   a,
   Oe:async(store,id)=>records.get(store+"/"+id)||null,
   ke:async(store,row)=>{records.set(store+"/"+row.id,row);return row;},
   chapterComposite:async()=>{calls.push("remote");return {size:5000};},
   dl:()=>{},console:{warn:()=>{}},
 });
 return {...methods,a,records,calls};
}
test("cached composite is keyed to exact book and narration segment audio",async()=>{
 const c=mockCache(),sig=c.localCompositeSignature(0,2,5);
 assert.ok(sig.includes("book1"));
 assert.equal(await c.recentComposite(sig),null);
 assert.equal((await c.getCompositeBlob(0,2,5)).size,5000);
 await delay(1);
 assert.equal((await c.getCompositeBlob(0,2,5)).size,5000);
 assert.equal(c.calls.length,1);
 c.a.book.chapters[0].segments[2].audioKey="regenerated";
 assert.equal(await c.recentComposite(c.localCompositeSignature(0,2,5)),null);
});
test("large composites are not persisted in the phone cache",async()=>{
 const c=mockCache(),sig=c.localCompositeSignature(0,2,5);
 c.rememberComposite(sig,{size:49*1024*1024});
 await delay(1);
 assert.equal(c.records.size,0);
});
