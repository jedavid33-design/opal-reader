// Run: node --test tests/playback-bookmarks.test.mjs
// No real book text, audio, network calls, or credentials are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source=readFileSync(new URL("../app-226.js",import.meta.url),"utf8");
const span=(a,b)=>{
  const start=source.indexOf(a),end=source.indexOf(b,start);
  assert.ok(start>=0&&end>start,"Missing Reader function: "+a);
  return source.slice(start,end);
};
const bookmarkHelpers=span('const READER_BOOKMARK_KEY=','function Ie(e)');
const resumeFn=span('async function Me(e){','}async function Ot(')+"}";
const fakeBook=()=>({
  id:"book-1",currentChapter:0,currentSegment:0,
  chapters:[{id:"chapter-1",segments:Array.from({length:8},(_,i)=>({
    audioKey:"audio-"+i,audioStale:false,speechText:"A sample."
  })),playback:{segment:0,position:0,started:false,completed:false}}]
});
function harness(){
  const mem=new Map();
  const localStorage={
    getItem:(key)=>mem.get(key)||null,
    setItem:(key,v)=>{mem.set(key,v);},
    removeItem:(key)=>{mem.delete(key);}
  };
  const a={book:fakeBook()};
  const ee={
    _chapterPlayback:true,_restoringPosition:false,_singleSegmentPreview:false,
    _systemSpeechActive:false,_compositePlayback:true,
    _compositeStartSegment:2,_compositeEndSegment:6,
    currentTime:105,
  };
  const env={localStorage,a,ee,Ke:{segment:0,position:0,started:false,completed:false},
    normalizeCompletedChapterStatus:()=>{}};
  const functions=new Function("env",
    "const {localStorage,a,ee,Ke,normalizeCompletedChapterStatus}=env;\n"+
    bookmarkHelpers+"\nreturn {rr,nr,at,ar,checkpointReaderPlayback,latestReaderBookmark};"
  )(env);
  const makeResume=(book=env.a.book)=>{
    const calls=[];
    const playContinuousFrom=async(...args)=>{calls.push(args);};
    const play=new Function("env",
      "const {a,nr,segmentPlayable,firstPlayable,validReaderChunk,playContinuousFrom,dl,alert}=env;\n"+
      "return "+resumeFn+";"
    )({
      a:{book},nr:functions.nr,
      segmentPlayable:(seg)=>!!seg?.audioKey,
      firstPlayable:()=>0,
      validReaderChunk:(ch,chunk)=>new Function("ctx",
        "const {localStorage,a,ee,Ke,normalizeCompletedChapterStatus}=ctx;\n"+
        bookmarkHelpers+"\nreturn validReaderChunk;")(env)(ch,chunk),
      playContinuousFrom,dl:()=>{},alert:msg=>{throw new Error(msg)}
    });
    return {play,calls};
  };
  return {...env,...functions,makeResume};
}
test("combined playback stores exact chunk boundaries, keys, and elapsed time",()=>{
  const h=harness();
  assert.equal(h.checkpointReaderPlayback(true),true);
  const v=h.latestReaderBookmark();
  assert.equal(v.chapter,0);
  assert.equal(v.segment,2);
  assert.equal(v.position,105);
  assert.deepEqual(v.chunk,{start:2,end:6,keys:["audio-2","audio-3","audio-4","audio-5"]});
});
test("reopened Reader restores an exact chunk, even if default planner changes",async()=>{
  const h=harness();
  h.checkpointReaderPlayback(true);
  const reopened=h.rr(fakeBook());
  assert.equal(reopened.chapters[0].playback.position,105);
  assert.equal(reopened.chapters[0].playback.composite.end,6);
  const {play,calls}=h.makeResume(reopened);
  await play(0);
  assert.equal(calls[0][0],0);
  assert.equal(calls[0][1],2);
  assert.equal(calls[0][2],105);
  assert.deepEqual(calls[0][3],{fastStart:true,preferredEnd:6});
});
test("individual playback saves a per-segment clock instead of an old chunk",()=>{
  const h=harness();
  h.checkpointReaderPlayback(true);
  h.ee._compositePlayback=false;
  h.a.book.currentSegment=4;
  h.ee.currentTime=13;
  h.checkpointReaderPlayback(true);
  const reopened=h.rr(fakeBook());
  assert.equal(reopened.chapters[0].playback.segment,4);
  assert.equal(reopened.chapters[0].playback.position,13);
  assert.equal(reopened.chapters[0].playback.composite,undefined);
});
test("an invalidated chunk cannot restore its timestamp into an individual segment",()=>{
  const h=harness();
  h.checkpointReaderPlayback(true);
  const fresh=fakeBook();
  fresh.chapters[0].segments[3].audioKey="regenerated-audio";
  const result=h.rr(fresh);
  assert.equal(result.chapters[0].playback.position,0);
  assert.equal(result.chapters[0].playback.composite,undefined);
});
test("a newer saved playback state wins over stale emergency checkpoint",()=>{
  const h=harness();
  h.checkpointReaderPlayback(true);
  const v=h.latestReaderBookmark();
  const newer=fakeBook();
  newer.currentSegment=5;
  newer.chapters[0].playback={started:true,segment:5,position:17,updatedAt:v.savedAt+1000};
  const result=h.rr(newer);
  assert.equal(result.chapters[0].playback.position,17);
  assert.equal(result.currentSegment,5);
});
test("completing a chapter clears the old emergency checkpoint",()=>{
  const h=harness();
  h.checkpointReaderPlayback(true);
  h.ar(h.a.book,0);
  assert.equal(h.latestReaderBookmark(),null);
  assert.equal(h.a.book.chapters[0].playback.completed,true);
});
