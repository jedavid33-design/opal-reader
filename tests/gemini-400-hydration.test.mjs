// Regression test for blank Reader background during book hydration.
// Run from repository root: node --test tests/gemini-400-hydration.test.mjs
// Only synthetic chapters; no user text, credentials, Gemini calls, or storage.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "app-232.js"), "utf8");
const oldSource = readFileSync(join(root, "app-231.js"), "utf8");
const sourceBetween = (s, begin, end) => {
  const start = s.indexOf(begin), finish = s.indexOf(end, start);
  assert.ok(start >= 0 && finish > start, "expected source anchors exist");
  return s.slice(start, finish);
};
const segIdentity = (s,pov) => `${s?.speechText||s?.text||""}\u241f${s?.pov||pov||""}`;
const events=[];
const recovered = sourceBetween(source,"function isLegacyGeminiInputBlock(","function or(e,c,");
const hydration = sourceBetween(source,"function xe(e){","function st(e){");
const { xe } = new Function("segIdentity","recordGeminiFailure","rr",
  recovered + "\n" + hydration + "\nreturn {xe}")(
    segIdentity, (ch,seg,meta,kind)=>events.push({id:seg.id,kind}), book=>book
  );
const rawError = "Gemini error (400): Input blocked: The prompt contains sensitive words that violate Google's Generative AI Prohibited Use policy.";
const fixture=()=>({chapters:[
  {pov:"Lily",segments:[{id:"s1",pov:"Lily",text:"first"},{id:"s2",pov:"Lily",text:"second"}],generation:{state:"ready"}},
  {pov:"Randy",segments:[{id:"s3",pov:"Randy",text:"third"}],generation:{state:"ready"}}
]});
const failedJob=(book,patch={})=>({
  state:"failed",error:rawError,
  segments:[{state:"generating"},{state:"queued"}],
  segmentKeys:book.chapters[0].segments.map(s=>segIdentity(s,"Lily")),
  jobId:"queue123",...patch
});
test("book hydration works with no failed jobs",()=>{
  const book=fixture();
  assert.equal(xe(book),book);
});
test("old code threw a ReferenceError at startup; new code stays in chapter scope",()=>{
  const oldHydration=sourceBetween(oldSource,"function xe(e){","function st(e){");
  const hydrateOld=new Function("rr","recordGeminiFailure","segIdentity","recoverLegacyGeminiInputBlock",
    oldHydration+"\nreturn xe")(book=>book,()=>{},segIdentity,()=>{});
  assert.throws(()=>hydrateOld(fixture()),ReferenceError);
  assert.doesNotThrow(()=>xe(fixture()));
});
test("previously failed Gemini input-block 400 recovers only the matching segment",()=>{
  const book=fixture();
  book.chapters[0].generation=failedJob(book);
  xe(book);
  assert.equal(book.chapters[0].segments[0].generationBlocked?.finishReason,"HTTP_400");
  assert.equal(book.chapters[0].segments[0].generationBlocked?.blockReason,"POLICY_BLOCK");
  assert.equal(book.chapters[0].segments[1].generationBlocked,undefined);
});
test("unrelated HTTP 400 errors are not treated as policy refusals",()=>{
  const book=fixture();
  book.chapters[0].generation=failedJob(book,{error:"Gemini error (400): invalid model name"});
  xe(book);
  assert.equal(book.chapters[0].segments[0].generationBlocked,undefined);
});
test("already-generated audio is preserved",()=>{
  const book=fixture();
  book.chapters[0].segments[0].audioKey="ready-key";
  book.chapters[0].generation=failedJob(book,{segments:[{state:"ready"},{state:"generating"}]});
  xe(book);
  assert.equal(book.chapters[0].segments[0].audioKey,"ready-key");
  assert.equal(book.chapters[0].segments[0].generationBlocked,undefined);
  assert.equal(book.chapters[0].segments[1].generationBlocked?.finishReason,"HTTP_400");
});
test("ambiguous historical segment identities are not guessed",()=>{
  const book=fixture();
  book.chapters[0].generation=failedJob(book,{segmentKeys:["missing\u241fLily","other\u241fLily"]});
  xe(book);
  assert.equal(book.chapters[0].segments[0].generationBlocked,undefined);
});
test("auto repair must require live policy-aware Worker before spending requests",()=>{
  assert.match(source,/if\(!await geminiInputBlockWorkerReady\(\)\)/);
  assert.match(source,/patch>=34/);
  assert.match(source,/APP_UI_VERSION="1\.4\.94"/);
});
