// P2: the command API + I2 (every GET is pure — the store snapshot is
// byte-identical across each GET route) and the F7 chapter-state
// derivation, all seven states.
import test from "node:test";
import assert from "node:assert/strict";
import { makeHarness, makeProbe, occ } from "./helpers/do-harness.mjs";
import { createApi } from "../v2/api.mjs";
import { deriveChapterState } from "../v2/coordinator.mjs";

const req = (method, path, body) => new Request("https://v2.test" + path, {
  method, body: body ? JSON.stringify(body) : undefined,
  headers: { "content-type": "application/json" },
});

test("I2: every GET route leaves the store byte-identical", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  const api = createApi(h.env);
  const post = await api(req("POST", "/v2/commands", {
    command_id: "c1", type: "SubmitJob",
    payload: { jobId: "job-1", bookId: "b", chapterIndex: 0, lane: "standard",
               occurrences: [occ("o1")], data: {} },
  }), h.state);
  assert.equal(post.status, 200);
  const before = h.snapshot();
  for (const path of ["/v2/commands/c1", "/v2/commands/nope", "/v2/jobs/job-1",
                      "/v2/jobs/nope", "/v2/quota", "/v2/settings", "/v2/conflicts",
                      "/v2/chapter-state?job=job-1", "/v2/nowhere"]) {
    const res = await api(req("GET", path), h.state);
    assert.ok([200, 404].includes(res.status), `${path} -> ${res.status}`);
    assert.equal(h.snapshot(), before, `GET ${path} mutated the store`);
  }
});

test("API round trip: command receipt and job view agree with the coordinator", async () => {
  const h = makeHarness({ probe: makeProbe(new Map()) });
  const api = createApi(h.env);
  const post = await api(req("POST", "/v2/commands", {
    command_id: "c1", type: "SubmitJob",
    payload: { jobId: "job-1", bookId: "b", chapterIndex: 3, lane: "batch",
               occurrences: [occ("o1")], data: {} },
  }), h.state);
  const receipt = await post.json();
  assert.equal(receipt.outcome, "applied");
  const got = await (await api(req("GET", "/v2/commands/c1"), h.state)).json();
  assert.equal(got.outcome, "applied");
  assert.equal(got.type, "SubmitJob");
  const view = await (await api(req("GET", "/v2/jobs/job-1"), h.state)).json();
  assert.equal(view.state, "queued");
  assert.equal(view.lane, "batch");
  const quota = await (await api(req("GET", "/v2/quota"), h.state)).json();
  assert.equal(quota.dailyLimit, 100);
  assert.match(quota.basis, /estimate/i);
});

test("F7 derivation: all seven chapter states from one function", () => {
  assert.equal(deriveChapterState(["ready", "ready"], ["complete"]), "Complete");
  assert.equal(deriveChapterState(["ready", "pending"], []), "Partial");
  assert.equal(deriveChapterState(["ready"], ["generating"]), "Generating");
  assert.equal(deriveChapterState(["pending"], ["queued"]), "Generating");
  assert.equal(deriveChapterState(["ready", "pending"], ["paused_quota"]), "Quota Paused");
  assert.equal(deriveChapterState(["blocked_policy"], []), "Blocked");
  assert.equal(deriveChapterState(["blocked_policy", "ready"], []), "Partial");
  assert.equal(deriveChapterState(["pending"], ["failed"]), "Failed");
  assert.equal(deriveChapterState(["outcome_unknown"], ["generating"]), "Outcome Unknown");
  assert.equal(deriveChapterState(["ready"], ["outcome_unknown"]), "Outcome Unknown");
});
