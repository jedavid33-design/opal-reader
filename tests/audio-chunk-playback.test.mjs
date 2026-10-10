// Run: node --test tests/audio-chunk-playback.test.mjs
// Playback planner regression tests. No Gemini calls or personal audio.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const js=readFileSync(new URL("../app-225.js",import.meta.url),"utf8");
const range=(from,to)=>{
 const a=js.indexOf(from),b=js.indexOf(to,a);
 assert.ok(a>=0&&b>a,"Missing playback function: "+from);
 return js.slice(a,b);
};
const chunkHelpers=range("function continuousRunEnd(","async function Me(");
function player(book, combine){
 const calls=[];
 const a={book};
 const fn=new Function("context",
   "const a=context.a, playChapterComposite=context.combine, Ot=context.single, sectionDuration=context.sectionDuration;\n"+
   chunkHelpers+"\nreturn {continuousRunEnd,playContinuousFrom};")({
     a,sectionDuration:async()=>25, combine:async(...args)=>{calls.push(["combine",args[1],args[3]]);return combine(...args)},
     single:async(...args)=>{calls.push(["single",args[1]]);return true},
   });
 return {...fn,calls};
}
const seg=(text="Hello",{ready=true,device=false,stale=false}={})=>({
 audioKey:ready?"a".repeat(64):null,text,
 audioStale:stale,systemVoiceFallback:device?{name:"Device"}:null,
});
test("large chapters are bounded by characters and section count",()=>{
 const ch={segments:Array.from({length:25},()=>seg("x".repeat(1000)))};
 const x=player({chapters:[ch]},async()=>true);
 assert.equal(x.continuousRunEnd(ch,0),14);
 assert.equal(x.continuousRunEnd(ch,14),25);
});
test("small chapters remain a single continuous recording",async()=>{
 const ch={segments:Array.from({length:8},()=>seg("x".repeat(900)))};
 const x=player({chapters:[ch]},async()=>true);
 await x.playContinuousFrom(0,0);
 assert.deepEqual(x.calls,[["combine",0,8]]);
});
test("oversized or failing chunk is retried at half length",async()=>{
 const ch={segments:Array.from({length:10},()=>seg("x".repeat(1000)))};
 const x=player({chapters:[ch]},async(_ch,start,_pos,end)=>end-start<=5);
 await x.playContinuousFrom(0,0);
 assert.deepEqual(x.calls,[["combine",0,10],["combine",0,5]]);
});
test("unready and device-fallback sections delimit otherwise continuous runs",async()=>{
 const ch={segments:[seg(),seg(),seg("",{ready:false}),seg(),seg(),seg("",{ready:false,device:true})]};
 const x=player({chapters:[ch]},async()=>true);
 await x.playContinuousFrom(0,0);
 await x.playContinuousFrom(0,3);
 await x.playContinuousFrom(0,5);
 assert.deepEqual(x.calls,[["combine",0,2],["combine",3,5],["single",5]]);
});
test("when no composite succeeds, fallback is individual playback",async()=>{
 const ch={segments:[seg(),seg()]};
 const x=player({chapters:[ch]},async()=>null);
 await x.playContinuousFrom(0,0);
 assert.deepEqual(x.calls,[["combine",0,2],["single",0]]);
});
const h=range("ee.onended=async()=>{","};(async()=>{a.books=").replace(/^ee.onended=/,"")+"}";
function endPlayer({end=5,segments=10,nextChapter=false,ready=true}={}){
 const calls=[],a={book:{currentChapter:0,currentSegment:0,completed:false,chapters:[
 {segments:Array.from({length:segments},(_,i)=>seg("Hello",{ready:ready||i!==end}))},
 ...(nextChapter?[{segments:[seg()]}]:[]),
 ]}};
 const ee={_compositePlayback:true,_compositeEndSegment:end,_singleSegmentPreview:false,_chapterPlayback:true};
 const deps={
   ee,a,dl:()=>{},shelfListenStop:()=>calls.push("stop"),
   ar:()=>calls.push("complete"),at:(_book,ch,idx)=>{a.book.currentChapter=ch;a.book.currentSegment=idx;calls.push(["at",ch,idx])},
   pe:async()=>calls.push("saved"),playContinuousFrom:async(ch,idx,pos)=>calls.push(["start",ch,idx,pos]),
   Me:async(ch)=>calls.push(["chapter",ch]),playable:(ch)=>ch.segments.some(x=>x.audioKey),
   segmentPlayable:(x)=>!!x?.audioKey,se:()=>{},updateMediaSession:()=>{},
 };
 const handle=new Function("ctx",
  "const {ee,a,dl,shelfListenStop,ar,at,pe,playContinuousFrom,Me,playable,segmentPlayable,se,updateMediaSession}=ctx;\nreturn "+h+";"
 )(deps);
 return {handle,calls,a};
}
test("composite chunk ending advances without completing the chapter",async()=>{
 const x=endPlayer({end:5,segments:10});
 await x.handle();
 assert.ok(x.calls.some(t=>Array.isArray(t)&&t[0]==="start"&&t[2]===5));
 assert.ok(!x.calls.includes("complete"));
});
test("last chunk completes the chapter and advances",async()=>{
 const x=endPlayer({end:10,segments:10,nextChapter:true});
 await x.handle();
 assert.ok(x.calls.includes("complete"));
 assert.ok(x.calls.some(t=>Array.isArray(t)&&t[0]==="chapter"&&t[1]===1));
});
test("gaps stop cleanly and preserve the next resume position",async()=>{
 const x=endPlayer({end:5,segments:10,ready:false});
 await x.handle();
 assert.ok(x.calls.includes("stop"));
 assert.ok(x.calls.some(t=>Array.isArray(t)&&t[0]==="at"&&t[2]===5));
 assert.ok(!x.calls.some(t=>Array.isArray(t)&&t[0]==="start"));
});
