import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const index=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const asset=index.match(/src="\.\/(app-\d+\.js)"/)?.[1];
assert.ok(asset,"Reader's app script should be referenced in index");
const source=readFileSync(new URL("../"+asset,import.meta.url),"utf8");
function between(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,"Missing code under test: "+start);
  return source.slice(a,b);
}
const snapshotCode=between("const MAX_DETACHED_COMPOSITE_BYTES","function localCompositeSignature");
const getCode=between("async function getCompositeBlob(","async function playChapterComposite(");
const log=[],origins=new WeakMap();
const detach=new Function("Blob","compositeBlobOrigins","dl",
  snapshotCode+"\nreturn detachCachedComposite;")(Blob,origins,msg=>log.push(msg));

test("cached WAV is copied into an independent Blob before playback",async()=>{
  let valid=true;
  const data=new Uint8Array(2048).fill(42);
  const cached={size:data.length,type:"audio/wav",arrayBuffer:async()=>{
    if(!valid)throw Object.assign(new Error("The object can not be found here."),{name:"NotFoundError"});
    return data.slice().buffer;
  }};
  const copy=await detach(cached);
  assert.ok(copy instanceof Blob);
  assert.equal(copy.size,data.length);
  assert.equal(origins.get(copy),"idb-detached");
  valid=false;
  assert.equal((await copy.arrayBuffer()).byteLength,data.length);
  assert.equal(await detach(cached),null);
  assert.ok(log.some(s=>s.includes("UNREADABLE NotFoundError")));
});

test("large cached WAV bypasses memory copy",async()=>{
  const huge={size:25*1024*1024,arrayBuffer:async()=>{throw Error("Should not read")}};
  assert.equal(await detach(huge),null);
  assert.ok(log.some(s=>s.includes("cache BYPASS")));
});

test("unreadable cache causes one deduplicated Worker fetch, no TTS requests",async()=>{
  const broken={size:2048,arrayBuffer:async()=>{throw Object.assign(new Error("gone"),{name:"NotFoundError"})}};
  const remote=new Blob([new Uint8Array(2048)],{type:"audio/wav"});
  let cloud=0,saves=0;
  const deps={
    localCompositeSignature:()=>"cache-signature",
    compositeInFlight:new Map(),
    recentComposite:async()=>broken,
    detachCachedComposite:detach,
    dl:msg=>log.push(msg),
    chapterComposite:async()=>{cloud++;return remote},
    a:{apiBase:"",accessToken:"",book:{}},
    compositeBlobOrigins:origins,
    rememberComposite:()=>{saves++},
  };
  const names=Object.keys(deps);
  const get=new Function(...names,getCode+"\nreturn getCompositeBlob;")(...Object.values(deps));
  const [a,b]=await Promise.all([get(0,0,4),get(0,0,4)]);
  assert.equal(a,remote);
  assert.equal(b,remote);
  assert.equal(cloud,1);
  assert.equal(saves,1);
  assert.equal(origins.get(remote),"fresh-worker");
  assert.ok(log.some(s=>s.includes("cache FALLBACK to Worker")));
});
