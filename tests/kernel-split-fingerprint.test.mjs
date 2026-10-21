// Run: node --test tests/kernel-split-fingerprint.test.mjs
// P1 characterization (v2 Option C): pins the two kernel contracts v2 must
// preserve exactly —
//  (1) the synthesis fingerprint: cache_key = sha256(rawText + cfgJson),
//      cfgJson = JSON.stringify({provider, voice, model, rate: 1, style})
//      with that exact key order. This is Rowan's "content revision": if
//      the formula drifts, existing audio bindings silently stop matching.
//  (2) the inline split kernel: a blocked passage is cut ONLY at an
//      existing boundary, both halves >= 140 plain chars, wording never
//      rewritten (children tile the parent), <emphasis> markup balanced
//      across the seam. Unsplittable passages return -1 so the caller
//      marks them blocked instead of advancing (F3/F4).
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const worker=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const between=(src,a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);
  assert.ok(i>=0&&j>i,"missing source "+a);return src.slice(i,j)};
const code=[
  between(worker,"const plainSpeechText","const decodeBase64"),
  between(worker,"function naturalBlockedSplitPoint","// Status-entry fields"),
  between(worker,"async function sha256HexText","async function stageContinueSlice"),
].join("\n");
const {plainSpeechText,naturalBlockedSplitPoint,splitSpeechMarkup,sha256HexText}=
  new Function(code+"\nreturn {plainSpeechText,naturalBlockedSplitPoint,splitSpeechMarkup,sha256HexText};")();

const cfgJson=({provider="gemini",voice="Zephyr",model="gemini-3.8-flash-tts",style=""}={}) =>
  JSON.stringify({provider,voice,model,rate:1,style});
const sha256=s=>createHash("sha256").update(s).digest("hex");
const GOLDEN_TEXT="The quick brown fox jumps over the lazy dog.";
const GOLDEN_DIGEST="7fb2686043f7d60c419400d8e58cf6bc2951ddf76336dde07fab13155950e688";

test("fingerprint formula: golden vector pins inputs, key order and separator",async()=>{
  assert.equal(sha256(GOLDEN_TEXT+cfgJson()),GOLDEN_DIGEST); // fixture sanity
  assert.equal(await sha256HexText(GOLDEN_TEXT+cfgJson()),GOLDEN_DIGEST);
  // The shipped Worker still builds cfgJson with this exact shape and
  // hashes raw + cfgJson (source pin — a formula edit must fail loudly).
  assert.match(worker,/JSON\.stringify\(\{\s*provider: segment\.provider, voice: segment\.voice_id,\s*model: segment\.model_id, rate: 1, style: segment\.style_direction \|\| "",\s*\}\)/);
  assert.match(worker,/sha256HexText\(raw \+ cfgJson\)/);
});

test("fingerprint identity: style, voice and markup are all part of identity",async()=>{
  const base=await sha256HexText(GOLDEN_TEXT+cfgJson());
  assert.notEqual(await sha256HexText(GOLDEN_TEXT+cfgJson({style:"Warm Southern drawl"})),base);
  assert.notEqual(await sha256HexText(GOLDEN_TEXT+cfgJson({voice:"Charon"})),base);
  // Raw text is hashed, markup included — plain text hashes differently.
  assert.notEqual(await sha256HexText("<emphasis>"+GOLDEN_TEXT+"</emphasis>"+cfgJson()),base);
});

test("plainSpeechText strips only emphasis tags",()=>{
  assert.equal(plainSpeechText("a<emphasis>b</emphasis>c"),"abc");
  assert.equal(plainSpeechText("<EMPHASIS>x</EMPHASIS>"),"x");
  assert.equal(plainSpeechText("keep <b>other</b> tags"),"keep <b>other</b> tags");
  assert.equal(plainSpeechText(null),"");
});

const para=(ch,n)=>{ // exactly n chars of sentence-shaped filler ending "."
  const unit=(ch+"bcdefgh sentence number seven. "); // 32 chars
  let s=""; while(s.length<n)s+=unit;
  return s.slice(0,n-1)+".";
};
const squash=s=>s.replace(/\s+/g,"");
function assertTiles(original,halves){
  const plain=plainSpeechText(original);
  assert.equal(squash(plainSpeechText(halves[0]).trim()+plainSpeechText(halves[1]).trim()),
    squash(plain.trim()));
  assert.ok(plainSpeechText(halves[0]).trim().length>=140,"left half >= 140 plain chars");
  assert.ok(plainSpeechText(halves[1]).trim().length>=140,"right half >= 140 plain chars");
}

test("split prefers the paragraph break and children tile the parent",()=>{
  const original=para("A",200)+"\n\n"+para("B",200);
  const plain=plainSpeechText(original);
  const cut=naturalBlockedSplitPoint(plain);
  assert.equal(cut,202); // end of the \n\n run — the only candidate >= 140 both sides
  assertTiles(original,splitSpeechMarkup(original,cut));
});

test("split falls back to sentence boundaries without a paragraph break",()=>{
  const original=para("C",210)+" "+para("D",210);
  const plain=plainSpeechText(original);
  const cut=naturalBlockedSplitPoint(plain);
  assert.ok(cut>=140&&plain.length-cut>=140);
  assert.match(plain.slice(0,cut),/[.!?]["'”’)]?\s+$/); // seam sits after a sentence end
  assertTiles(original,splitSpeechMarkup(original,cut));
});

test("split picks the candidate closest to the middle",()=>{
  const original=para("E",320)+"\n\n"+para("F",100)+"\n\n"+para("G",280);
  const plain=plainSpeechText(original);
  const cut=naturalBlockedSplitPoint(plain);
  // paragraph candidates: 322 (dist 30 from mid 352) vs 424 (dist 72) -> 322 wins
  assert.equal(cut,322);
});

test("unsplittable passages return -1 (caller must block, never rewrite)",()=>{
  assert.equal(naturalBlockedSplitPoint("Short passage. ".repeat(8)),-1); // < 280 chars total
  assert.equal(naturalBlockedSplitPoint("x".repeat(500)),-1); // no boundary at all
  const lopsided=para("H",160)+"\n\n"+para("I",100); // right side < 140
  assert.equal(naturalBlockedSplitPoint(lopsided),-1);
});

test("emphasis spanning the seam is closed and reopened, wording intact",()=>{
  const original="<emphasis>"+para("J",200)+"\n\n"+para("K",200)+"</emphasis>";
  const plain=plainSpeechText(original);
  const cut=naturalBlockedSplitPoint(plain);
  assert.ok(cut>0);
  const halves=splitSpeechMarkup(original,cut);
  assert.ok(halves[0].endsWith("</emphasis>"),"left half closes the emphasis");
  assert.ok(halves[1].startsWith("<emphasis>"),"right half reopens it");
  assertTiles(original,halves);
});
