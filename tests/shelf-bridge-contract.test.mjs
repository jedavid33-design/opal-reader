// Run: node --test tests/shelf-bridge-contract.test.mjs
// P1 characterization (v2 Option C, requirement F12 — Shelf bridge FROZEN):
// drives the actual shipped shelf* functions extracted from app-256.js
// against the golden fixtures in tests/fixtures/shelf/. No Shelf Worker,
// DB or API is touched; fetch is stubbed. If any of this goes red, the
// Reader->Shelf wire contract changed — deliberate or not.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../app-256.js",import.meta.url),"utf8");
const fixture=n=>JSON.parse(readFileSync(new URL("./fixtures/shelf/"+n,import.meta.url),"utf8"));
const between=(src,a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);
  assert.ok(i>=0&&j>i,"missing source "+a);return src.slice(i,j)};
// Extracted verbatim from the shipped bundle — declarations, not ports.
const code=[
  between(app,"function shelfNewQueueId","function shelfOutbox"),
  between(app,"function shelfOutbox","function shelfQueue"),
  between(app,"function shelfQueue","function shelfLocalDate"),
  between(app,"function shelfLocalDate","function shelfOverlapParts"),
  between(app,"function shelfOverlapParts","function shelfReplaceQueueItem"),
  between(app,"function shelfReplaceQueueItem","let shelfFlushAgain"),
  between(app,"let shelfFlushAgain","function shelfLinkOpen"),
].join("\n");
function makeShelf(fetchImpl){
  const store=new Map();
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)};
  const a={shelfApiBase:"https://shelf.test"};
  const factory=new Function("localStorage","fetch","a",
    "let shelfFlushing=false;\n"+code+
    "\nreturn {shelfQueue,shelfFlush,shelfOutbox,shelfOverlapParts,shelfLocalDate};");
  return {api:factory(localStorage,fetchImpl,a),store};
}
const ID_RE=readId=>new RegExp("^shelf_"+readId+"_\\d+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

test("queue stores the golden outbox item shape",()=>{
  const {api}=makeShelf(async()=>{throw new Error("no fetch expected")});
  const f=fixture("queue-merge.case.json");
  api.shelfQueue(f.base.readId,f.base.startedMs,f.base.secs);
  const q=api.shelfOutbox();
  assert.equal(q.length,1);
  const item=fixture("outbox-item.simple.json");
  assert.deepEqual({...q[0],queueId:item.queueId,clientSessionId:item.clientSessionId},item);
  assert.match(q[0].queueId,ID_RE(f.base.readId));
  assert.equal(q[0].clientSessionId,q[0].queueId);
});

test("merge rule: inside 90s merges durations, outside creates a second item",()=>{
  const f=fixture("queue-merge.case.json");
  { const {api}=makeShelf(async()=>{});
    api.shelfQueue(f.base.readId,f.base.startedMs,f.base.secs);
    api.shelfQueue(f.base.readId,f.base.startedMs+f.insideWindow.secondStartOffsetMs,f.insideWindow.secondSecs);
    const q=api.shelfOutbox();
    assert.equal(q.length,f.insideWindow.expectedItems);
    assert.equal(q[0].duration_seconds,f.insideWindow.expectedDurationSeconds);
  }
  { const {api}=makeShelf(async()=>{});
    api.shelfQueue(f.base.readId,f.base.startedMs,f.base.secs);
    api.shelfQueue(f.base.readId,f.base.startedMs+f.outsideWindow.secondStartOffsetMs,f.outsideWindow.secondSecs);
    const q=api.shelfOutbox();
    assert.equal(q.length,f.outsideWindow.expectedItems);
    assert.equal(q[1].duration_seconds,f.outsideWindow.expectedSecondDurationSeconds);
  }
});

test("flush POSTs the golden session payload and removes the item",async()=>{
  const calls=[];
  let attemptsAtPost=null;
  const {api,store}=makeShelf(async(url,opts)=>{
    calls.push({url,opts});
    attemptsAtPost=api.shelfOutbox()[0]?.attempts;
    return {ok:true,status:200,json:async()=>({})};
  });
  const f=fixture("queue-merge.case.json");
  api.shelfQueue(f.base.readId,f.base.startedMs,f.base.secs);
  const result=await api.shelfFlush();
  assert.equal(result.sent,1);
  assert.equal(api.shelfOutbox().length,0);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://shelf.test/api/sessions");
  assert.equal(calls[0].opts.method,"POST");
  // attempts is incremented and persisted BEFORE the POST (crash-safe).
  assert.equal(attemptsAtPost,1);
  const golden=fixture("session-payload.simple.json");
  const body=JSON.parse(calls[0].opts.body);
  assert.deepEqual({...body,client_session_id:golden.client_session_id},golden);
  assert.match(body.client_session_id,ID_RE(f.base.readId));
  assert.deepEqual(Object.keys(body).sort(),
    ["client_session_id","duration_seconds","local_date","read_id","started_at"]);
});

test("409 overlap carve math matches the golden parts exactly",()=>{
  const f=fixture("overlap-carve.case.json");
  const {api}=makeShelf(async()=>{});
  const parts=api.shelfOverlapParts(f.item,f.serverMessage);
  assert.deepEqual(parts.map(p=>({startedAt:p.startedAt,duration_seconds:p.duration_seconds})),
    f.expectedParts);
  for(const p of parts){ assert.match(p.queueId,ID_RE(f.item.readId));
    assert.equal(p.clientSessionId,p.queueId); assert.equal(p.attempts,0);
    assert.notEqual(p.queueId,f.item.queueId); }
  assert.deepEqual(api.shelfOverlapParts(f.item,f.fullyCoveredMessage),
    f.expectedPartsWhenFullyCovered);
});

test("flush carves on 409, then delivers the parts with fresh ids",async()=>{
  const f=fixture("overlap-carve.case.json");
  const bodies=[];
  let call=0;
  const {api}=makeShelf(async(url,opts)=>{
    bodies.push(JSON.parse(opts.body));
    call++;
    if(call===1)return {ok:false,status:409,json:async()=>({error:f.serverMessage})};
    return {ok:true,status:200,json:async()=>({})};
  });
  api.shelfQueue(f.item.readId,Date.parse(f.item.startedAt),f.item.duration_seconds);
  const result=await api.shelfFlush();
  assert.equal(result.sent,2);
  assert.equal(api.shelfOutbox().length,0);
  assert.deepEqual(bodies.slice(1).map(b=>({started_at:b.started_at,duration_seconds:b.duration_seconds})),
    f.expectedParts.map(p=>({started_at:p.startedAt,duration_seconds:p.duration_seconds})));
  assert.notEqual(bodies[1].client_session_id,bodies[0].client_session_id);
  assert.notEqual(bodies[2].client_session_id,bodies[1].client_session_id);
});

test("fully covered overlap drops the item and counts it covered",async()=>{
  const f=fixture("overlap-carve.case.json");
  const {api}=makeShelf(async()=>({ok:false,status:409,
    json:async()=>({error:f.fullyCoveredMessage})}));
  api.shelfQueue(f.item.readId,Date.parse(f.item.startedAt),f.item.duration_seconds);
  const result=await api.shelfFlush();
  assert.equal(result.covered,1);
  assert.equal(api.shelfOutbox().length,0);
});

test("a failed head item blocks the queue (FIFO, head-of-line)",async()=>{
  let fetches=0;
  const {api}=makeShelf(async()=>{ fetches++;
    return {ok:false,status:500,json:async()=>({error:"Shelf boom"})}; });
  const f=fixture("queue-merge.case.json");
  api.shelfQueue(f.base.readId,f.base.startedMs,300);
  api.shelfQueue("other_read_99",f.base.startedMs+86400000,300);
  const result=await api.shelfFlush();
  assert.equal(fetches,1); // second item never attempted
  assert.equal(result.sent,0);
  assert.equal(result.error,"Shelf boom");
  const q=api.shelfOutbox();
  assert.equal(q.length,2);
  assert.equal(q[0].attempts,1);
  assert.equal(q[0].lastStatus,500);
  assert.equal(q[0].lastError,"Shelf boom");
});

test("overlap parser returns null for non-overlap messages",()=>{
  const {api}=makeShelf(async()=>{});
  const f=fixture("overlap-carve.case.json");
  assert.equal(api.shelfOverlapParts(f.item,"Some other error"),null);
  assert.equal(api.shelfOverlapParts(f.item,"overlaps an existing session (nonsense)"),null);
});

test("outbox cap keeps the newest 300 items, oldest dropped first",()=>{
  const {api}=makeShelf(async()=>{throw new Error("no fetch expected")});
  const t0=1760000000000;
  for(let i=0;i<305;i++) api.shelfQueue("cap_read",t0+i*120000,10);
  const q=api.shelfOutbox();
  assert.equal(q.length,300);
  assert.equal(q[0].startedAt,new Date(t0+5*120000).toISOString());
  assert.equal(q[299].startedAt,new Date(t0+304*120000).toISOString());
});

// --- Session timing (fake clock + fake timers through the shipped code) ---
const sessionCode=[
  between(app,"function shelfActive","function shelfNewQueueId"),
].join("\n");
function fakeClock(startMs){
  let now=startMs,seq=1; const timers=new Map();
  const arm=(fn,ms,interval)=>{const id=seq++;timers.set(id,{fn,at:now+ms,interval});return id;};
  return { now:()=>now,
    setTimeout:(fn,ms)=>arm(fn,ms,0), setInterval:(fn,ms)=>arm(fn,ms,ms),
    clearTimeout:id=>timers.delete(id), clearInterval:id=>timers.delete(id),
    advance(ms){ const end=now+ms;
      for(;;){ let due=null;
        for(const [id,t] of timers) if(t.at<=end&&(!due||t.at<due.at)) due={id,at:t.at,t};
        if(!due)break;
        now=due.at;
        if(due.t.interval) due.t.at=now+due.t.interval; else timers.delete(due.id);
        due.t.fn(); }
      now=end; } };
}
function makeShelfTimed(fetchImpl,startMs){
  const clock=fakeClock(startMs);
  class FakeDate extends Date{ static now(){return clock.now();} }
  const store=new Map();
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)};
  const a={shelfApiBase:"https://shelf.test",shelfLogEnabled:true,
    book:{id:"book-1",shelfReadId:"read-1"}};
  const ee={_singleSegmentPreview:false};
  const factory=new Function("localStorage","fetch","a","ee",
    "setTimeout","clearTimeout","setInterval","clearInterval","Date",
    "let shelfListenWallStart=0,shelfListenBookId=null,shelfListenReadId=null,shelfListenTimer=null,shelfFlushing=false;\n"+
    sessionCode+"\n"+code+
    "\nreturn {shelfListenStart,shelfListenPaused,shelfListenStop,shelfOutbox,shelfFlush};");
  const api=factory(localStorage,fetchImpl,a,ee,
    clock.setTimeout,clock.clearTimeout,clock.setInterval,clock.clearInterval,FakeDate);
  return {api,clock,store};
}
const drain=async()=>{ await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r)); };

test("timing: 30s checkpoints queue chunks that merge into one session",()=>{
  const {api,clock}=makeShelfTimed(async()=>{throw new Error("no fetch expected")},1760000000000);
  api.shelfListenStart();
  clock.advance(30000);
  let q=api.shelfOutbox();
  assert.equal(q.length,1); assert.equal(q[0].duration_seconds,30);
  clock.advance(30000);
  q=api.shelfOutbox();
  assert.equal(q.length,1); assert.equal(q[0].duration_seconds,60);
});

test("timing: pause under 4s resumes; confirmed stop backdates to the pause",async()=>{
  const calls=[];
  const {api,clock}=makeShelfTimed(async(url,opts)=>{ calls.push(opts);
    return {ok:true,status:200,json:async()=>({})}; },1760000000000);
  const T=clock.now();
  api.shelfListenStart();
  clock.advance(20000);
  api.shelfListenPaused();
  clock.advance(3900);
  assert.equal(api.shelfOutbox().length,0); // grace period: nothing ended yet
  api.shelfListenStart(); // resume inside the grace period
  clock.advance(10000); // crosses the 30s checkpoint (wall clock, pause included)
  let q=api.shelfOutbox();
  assert.equal(q.length,1); assert.equal(q[0].duration_seconds,30);
  api.shelfListenPaused();
  clock.advance(4000); // stop confirmed; remainder is 3.9s -> below the 5s floor, not queued
  q=api.shelfOutbox();
  assert.equal(q.length,1); assert.equal(q[0].duration_seconds,30);
  clock.advance(90000); // flush is armed for 95s after the stop: not yet
  assert.equal(calls.length,0);
  clock.advance(10000); await drain();
  assert.equal(calls.length,1);
  assert.equal(api.shelfOutbox().length,0);
  assert.equal(JSON.parse(calls[0].body).duration_seconds,30);
  assert.equal(JSON.parse(calls[0].body).started_at,new Date(T).toISOString());
});

test("timing: a confirmed pause-stop counts listening only up to the pause moment",()=>{
  const {api,clock}=makeShelfTimed(async()=>{throw new Error("no fetch expected")},1760000000000);
  const T=clock.now();
  api.shelfListenStart();
  clock.advance(25000);
  api.shelfListenPaused();
  clock.advance(4000);
  const q=api.shelfOutbox();
  assert.equal(q.length,1);
  assert.equal(q[0].duration_seconds,25); // NOT 29: the 4s grace is excluded
  assert.equal(q[0].startedAt,new Date(T).toISOString());
});

test("timing: resume within 90s of a stop cancels the flush and continues the same session",async()=>{
  const calls=[];
  const {api,clock}=makeShelfTimed(async(url,opts)=>{ calls.push(opts);
    return {ok:true,status:200,json:async()=>({})}; },1760000000000);
  api.shelfListenStart();
  clock.advance(20000);
  api.shelfListenPaused();
  clock.advance(4000); // stopped; 20s queued; flush armed for +95s
  assert.equal(api.shelfOutbox()[0].duration_seconds,20);
  clock.advance(80000); // 84s after the pause: inside the 90s resume window
  api.shelfListenStart(); // cancels the pending flush, session continues
  clock.advance(120000); // checkpoints merge into the still-queued session
  assert.equal(calls.length,0); // the armed flush never fired
  const q=api.shelfOutbox();
  assert.equal(q.length,1);
  assert.equal(q[0].duration_seconds,140); // 20 + 4x30 checkpoint chunks, merged
  clock.advance(10000); // 10s past the last checkpoint
  api.shelfListenStop(); await drain(); // stop queues the >=5s remainder (merged: +10) and flushes
  assert.equal(calls.length,1);
  assert.equal(JSON.parse(calls[0].body).duration_seconds,150);
  assert.equal(api.shelfOutbox().length,0);
});
