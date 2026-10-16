// Run: node --test tests/gemini-quota-diagnostics.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const worker=readFileSync(new URL("../cloudflare-worker.js",import.meta.url),"utf8");
const app=readFileSync(new URL("../app-240.js",import.meta.url),"utf8");
const begin=worker.indexOf("function extractGeminiQuotaDiagnostics(");
const end=worker.indexOf("function gemini429Cooldown(",begin);
assert.ok(begin>=0&&end>begin,"Worker diagnostic parser exists");
const extract=new Function(worker.slice(begin,end)+"\nreturn extractGeminiQuotaDiagnostics;")();
const err=(message,details=[],retryAfterSeconds=null)=>({
  message:"Gemini error (429): "+message,
  details:{error:{status:"RESOURCE_EXHAUSTED",message,details}},
  retryAfterSeconds
});
const split={diagnostic_job_kind:"blocked_split",segments:[{},{}]};
const cooldown={scope:"daily",retryAt:12345678};

test("daily quota metric, limit, provider retry and split source are captured",()=>{
  const evidence=extract(err("Quota exceeded for quota metric 'GenerateRequestsPerDayPerProjectPerModel' and limit: 100 for project PRIVATE123",
    [{"@type":"type.googleapis.com/google.rpc.RetryInfo",retryDelay:"15s"}],21),
    {model_id:"gemini-3.8-flash-tts",segment_index:13},split,cooldown);
  assert.deepEqual(evidence.quota_metrics,["GenerateRequestsPerDayPerProjectPerModel"]);
  assert.deepEqual(evidence.stated_limits,[100]);
  assert.equal(evidence.google_status,"RESOURCE_EXHAUSTED");
  assert.equal(evidence.retry_after_seconds,21);
  assert.equal(evidence.retry_info_seconds,15);
  assert.equal(evidence.job_kind,"blocked_split");
  assert.equal(evidence.job_segment_count,2);
  assert.equal(evidence.attempted_segment,14);
  assert.equal(evidence.scheduled_retry_at,12345678);
  assert.ok(!JSON.stringify(evidence).includes("PRIVATE123"));
});

test("temporary per-minute limit remains distinct from daily limit",()=>{
  const evidence=extract(err("Quota exceeded for quota metric 'GenerateRequestsPerMinutePerProjectPerModel' and limit: 10"),
    {model_id:"gemini-3.8-flash-tts",segment_index:2},
    {diagnostic_job_kind:"single_segment",segments:[{}]},{scope:"temporary",retryAt:56789});
  assert.deepEqual(evidence.quota_metrics,["GenerateRequestsPerMinutePerProjectPerModel"]);
  assert.deepEqual(evidence.stated_limits,[10]);
  assert.equal(evidence.cooldown_scope,"temporary");
  assert.equal(evidence.job_kind,"single_segment");
});

test("unavailable values are not fabricated or filled from secrets",()=>{
  const evidence=extract(err("Request failed for project PRIVATE123"),{model_id:"gemini-3.8-flash-tts"},split,cooldown);
  assert.deepEqual(evidence.quota_metrics,[]);
  assert.deepEqual(evidence.stated_limits,[]);
  assert.equal(evidence.retry_info_seconds,null);
  assert.ok(!JSON.stringify(evidence).includes("PRIVATE123"));
});

test("Worker stores bounded metadata and Reader copies it without full provider bodies",()=>{
  assert.match(worker,/status\.quota_diagnostics = \[/);
  assert.match(worker,/\.slice\(-7\)/);
  assert.match(worker,/extractGeminiQuotaDiagnostics\(error, segment, payload, cooldown\)/);
  assert.match(app,/Gemini 429 quota evidence/);
  assert.match(app,/quota_diagnostics/);
  assert.match(app,/diagnostic_job_kind:"blocked_split"/);
  assert.match(app,/diagnostic_job_kind:"single_segment"/);
});
