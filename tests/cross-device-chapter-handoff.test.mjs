// Run: node --test tests/cross-device-chapter-handoff.test.mjs
// Safe fixtures only: no audiobook content, credentials, audio, or external calls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const code=readFileSync(new URL("../app-253.js",import.meta.url),"utf8");
function section(first,last){
  const a=code.indexOf(first),b=code.indexOf(last,a);
  assert.ok(a>=0&&b>a,"Unable to find "+first);
  return code.slice(a,b);
}
const restoreSource=section("function restoreReaderBookmark(book){","function checkpointReaderPlayback(");
const releaseSource=section("function releaseOldPlaybackForCloudResume(previous,incoming){","async function rt(){");

function book(activeAt=200){
  return {
    id:"example-book-1",currentChapter:2,currentSegment:0,position:44,lastPlayedAt:activeAt,
    chapters:Array.from({length:3},(_,i)=>({
      segments:[{audioKey:"demo-"+i,audioStale:false}],
      playback:{segment:0,position:i===2?44:1,started:true,completed:false,updatedAt:i===2?activeAt:80}
    }))
  };
}
function bookmarkHarness(){
  const values=new Map();
  const localStorage={
    getItem:key=>values.get(key)||null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key)
  };
  const latestReaderBookmark=()=>JSON.parse(localStorage.getItem("opalreader.playbackCheckpoint.v187")||"null");
  const restore=new Function("deps",
    "const {latestReaderBookmark,validReaderChunk}=deps;"+restoreSource+";return restoreReaderBookmark"
  )({latestReaderBookmark,validReaderChunk:()=>false});
  const save=(chapter,savedAt,position=12)=>{
    localStorage.setItem("opalreader.playbackCheckpoint.v187",
      JSON.stringify({bookId:"example-book-1",chapter,segment:0,position,savedAt}));
  };
  return {restore,save};
}
test("cloud-selected newer chapter beats an old local emergency bookmark",()=>{
  const h=bookmarkHarness();h.save(0,150);
  const b=h.restore(book(200));
  assert.equal(b.currentChapter,2);
  assert.equal(b.position,44);
});
test("a genuinely newer local bookmark still wins",()=>{
  const h=bookmarkHarness();h.save(0,350);
  const b=h.restore(book(200));
  assert.equal(b.currentChapter,0);
  assert.equal(b.position,12);
});
test("old local timestamp cannot rewind the correct cloud chapter",()=>{
  const h=bookmarkHarness();h.save(2,190,11);
  assert.equal(h.restore(book(200)).position,44);
});
test("newer local same-chapter position is retained",()=>{
  const h=bookmarkHarness();h.save(2,250,48);
  assert.equal(h.restore(book(200)).position,48);
});
function audioHarness(){
  const events=[];
  const ee={
    _chapterPlayback:true,_restoringPosition:false,_compositePlayback:true,
    _compositeStartSegment:0,_compositeEndSegment:3,_systemSpeechActive:false,
    src:"blob:old-audio",paused:true,
    pause(){events.push("pause");this.paused=true},
    removeAttribute(name){events.push("remove:"+name);this.src=""},
    load(){events.push("load")}
  };
  const fn=new Function("deps",
    "const {ee,window,URL,dl}=deps;"+releaseSource+";return releaseOldPlaybackForCloudResume"
  )({ee,window:{},URL:{revokeObjectURL(src){events.push("revoke:"+src)}},dl:()=>{}});
  return {ee,fn,events};
}
test("accepting a newer cloud chapter unloads stale player audio, not audio cache",()=>{
  const h=audioHarness();
  const old=book(100);old.currentChapter=0;old.position=15;
  h.fn(old,book(200));
  assert.equal(h.ee._chapterPlayback,false);
  assert.equal(h.ee.src,"");
  assert.equal(h.ee._compositePlayback,false);
  assert.ok(h.events.includes("revoke:blob:old-audio"));
  assert.ok(h.events.includes("load"));
});
test("unchanged cloud progress does not reset the player",()=>{
  const h=audioHarness(),same=book(200);
  h.fn(same,same);
  assert.equal(h.ee._chapterPlayback,true);
  assert.deepEqual(h.events,[]);
});
test("cloud acceptance calls the player realignment helper",()=>{
  const rt=section("async function rt(){","function se(){");
  assert.ok(rt.includes("releaseOldPlaybackForCloudResume(a.book,u),a.book=u"));
});
