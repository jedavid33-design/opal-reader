// Run: node --test tests/first-chapter-segment-joining.test.mjs
// Covers the first segment not joining when a remote composite finishes before
// Safari's HTMLAudioElement enters a playable state. No provider calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const source=readFileSync(new URL("../app-226.js",import.meta.url),"utf8");
const between=(start,end)=>{
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,"Missing joining function "+start);
  return source.slice(from,to);
};
const prefetchFn=between("function warmNextChapterAudio(","async function playContinuousFrom(");
function warmHarness(){
  const calls=[];
  const a={apiBase:"worker",providers:{sync:true},book:{id:"book-1",chapters:[
    {segments:[{audioKey:"previous"}]},
    {segments:[{audioKey:"a"},{audioKey:"b"},{audioKey:"c"}]},
  ]}};
  const ctx={
    a,
    document:{visibilityState:"visible"},
    nr:(_book,_ch)=>({segment:0,position:0}),
    continuousRunEnd:(ch,start)=>{
      let index=start;
      while(index<ch.segments.length&&ch.segments[index].audioKey&&
        !ch.segments[index].audioStale&&!ch.segments[index].systemVoiceFallback)index++;
      return index;
    },
    getCompositeBlob:async(ch,start,end)=>{calls.push([ch,start,end]);return {size:1024};},
    dl:()=>{},
  };
  const warm=new Function("ctx",
    "const {a,document,nr,continuousRunEnd,getCompositeBlob,dl}=ctx;\n"+
    prefetchFn+"\nreturn warmNextChapterAudio;"
  )(ctx);
  return {warm,calls,ctx};
}
test("finishing one chapter prefills the next chapter's first combined run",async()=>{
  const h=warmHarness();
  h.warm(0);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(h.calls,[[1,0,3]]);
});
test("no combining across missing narration or device voice boundary",async()=>{
  const h=warmHarness();
  h.ctx.a.book.chapters[1].segments[1]={audioKey:null,systemVoiceFallback:{name:"Device"}};
  h.warm(0);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(h.calls.length,0);
});
test("do not prefetch while sync is disconnected or app is backgrounded",async()=>{
  const h=warmHarness();
  h.ctx.a.providers.sync=false;h.warm(0);
  h.ctx.a.providers.sync=true;h.ctx.document.visibilityState="hidden";h.warm(0);
  assert.equal(h.calls.length,0);
});
