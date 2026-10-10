// Run: node --test tests/dormant-playback-start.test.mjs
// No Gemini requests, audio uploads, or network calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const source=readFileSync(new URL("../app-224.js", import.meta.url),"utf8");
const between=(start,end)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,"Missing Reader function: "+start);
 return source.slice(a,b);
};
const fastStartFn=between("async function playContinuousFrom(","async function Me(");
const mockBook=()=>({id:"book1",currentChapter:0,currentSegment:2,chapters:[
 {id:"chapter1",segments:[{}, {},{audioKey:"a"},{audioKey:"b"},{audioKey:"c"}]}
]});
function harness({cloud,visibility="visible"}={}){
 const calls=[],book=mockBook();
 const ee={src:"",paused:true,currentTime:3,duration:40,
   _compositePlayback:false,_restoringPosition:false,_systemSpeechActive:false};
 const ctx={
  a:{book},ee,document:{visibilityState:visibility},
  continuousRunEnd:()=>5,
  Ot:async(ch,seg,pos)=>{calls.push(["segment",ch,seg,pos]);ee.src="blob:segment";ee.paused=false;return true;},
  playChapterComposite:async(ch,seg,pos,end,blob)=>{
    calls.push(["composite",ch,seg,pos,end,!!blob]);
    ee.src="blob:composite";ee._compositePlayback=true;return true;
  },
  getCompositeBlob:cloud??(async()=>({size:3000})),
  dl:()=>{},console:{warn:()=>{}}
 };
 const start=new Function("ctx",
 "const {a,ee,document,continuousRunEnd,Ot,playChapterComposite,getCompositeBlob,dl,console}=ctx;\n"+
 fastStartFn+"\nreturn playContinuousFrom;")(ctx);
 return {start,calls,book,ee};
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
