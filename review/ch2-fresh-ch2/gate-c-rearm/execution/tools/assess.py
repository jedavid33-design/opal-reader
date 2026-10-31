#!/usr/bin/env python3
"""Gate-(a) combined deploy: extract the compared inventory values from
one capture sample into a canonical summary JSON for cross-sample
diffing. Adapted from the combined deploy's assess.py: additionally
extracts the capabilities surface, plan-summary unverified keys, and
the diagnostics phaseAccounting block (the new build's additive read
keys, per Rowan's D4 data-not-shape interpretation).
Usage: assess.py <dir> <sfx>  -> prints canonical JSON."""
import json, sys, hashlib
from pathlib import Path

d = Path(sys.argv[1]); sfx = sys.argv[2]

def load(name):
    p = d / f"{name}-{sfx}.json"
    try:
        env = json.loads(p.read_text())
    except Exception as e:
        return {"_load_error": str(e)}
    if isinstance(env, dict) and "body" in env:
        return {"_status": env.get("status"), "body": env.get("body")}
    return env

def body(name):
    r = load(name)
    return r.get("body") if isinstance(r, dict) else r

def sha(x):
    return hashlib.sha256(json.dumps(x, sort_keys=True, default=str).encode()).hexdigest()

def canon(v):
    if v is None or not isinstance(v, (dict, list)):
        return json.dumps(v)
    if isinstance(v, list):
        return "[" + ",".join(canon(x) for x in v) + "]"
    return "{" + ",".join(f"{json.dumps(k)}:{canon(v[k])}" for k in sorted(v)) + "}"

out = {}
out["timestamp"] = (d / f"timestamp-{sfx}.txt").read_text().strip()

h = body("health") or {}
out["health"] = {k: h.get(k) for k in ("build", "generation", "coordinator", "scope", "version")}

for qn in ("queue", "queue-v1"):
    q = body(qn) or {}
    res = q.get("result") or q
    out[qn] = {
        "delivery_paused": (res.get("settings") or {}).get("delivery_paused"),
        "consumers": sorted(
            [{"consumer_id": c.get("consumer_id"), "script": c.get("script")}
             for c in (res.get("consumers") or [])], key=lambda x: str(x)),
        "producers": sorted(
            [p.get("script") for p in (res.get("producers") or [])]),
        "queue_name": res.get("queue_name"),
    }

b = body("bindings") or {}
bres = b.get("result") or b
binds = []
for x in (bres.get("bindings") or []):
    e = {"name": x.get("name"), "type": x.get("type")}
    if x.get("type") == "plain_text":
        e["text"] = x.get("text")
    binds.append(e)
out["bindings"] = sorted(binds, key=lambda x: x["name"])

ss = body("script-settings") or {}
ssres = ss.get("result") or ss
out["observability"] = ssres.get("observability")

for sn in ("prod", "v1", "staging"):
    meta = json.loads((d / f"script-{sn}-{sfx}.meta.json").read_text())
    out[f"etag-{sn}"] = {"etag": (meta.get("etag") or "").strip('"'),
                         "status": meta.get("status"), "bytes": meta.get("bytes")}

cap = body("capabilities") or {}
out["capabilities"] = {
    "generationState": cap.get("generationState"),
    "configuredLane": cap.get("configuredLane"),
    "lanes": cap.get("lanes"),
    "phases": sorted(
        [{k: ph.get(k) for k in ("phase", "bookId", "budgetMicroCents",
                                 "settledMicroCents", "inFlightUpperMicroCents",
                                 "estimatedUnverifiedMicroCents",
                                 "reservedUnverifiedMicroCents",
                                 "remainingMicroCents")}
         for ph in (cap.get("phases") or [])], key=lambda x: str(x.get("phase"))),
}

st = body("settings") or {}
out["settings"] = {"revision": st.get("revision"),
                    "monthlyCap": st.get("monthlyCap"),
                    "geminiLane": st.get("geminiLane"), "raw_sha": sha(st)}

qt = body("quota") or {}
out["quota"] = qt

pl = body("plan-list") or {}
plans = pl.get("plans") or pl.get("items") or []
out["plan-list"] = {
    "nextCursor": pl.get("nextCursor"),
    "plans": sorted(
        [{"planId": p.get("planId") or p.get("plan_id"), "state": p.get("state") or p.get("status"),
          "estimatedUnverifiedMicroCents": p.get("estimatedUnverifiedMicroCents"),
          "estimatedUnverifiedStatus": p.get("estimatedUnverifiedStatus")}
         for p in plans], key=lambda x: str(x["planId"])),
    "raw_sha": sha(pl),
}

for pn in ("plan-smoke", "plan-ch2", "plan-ch2fresh"):
    p = body(pn) or {}
    entries = p.get("entries") or []
    from collections import Counter
    out[pn] = {
        "planId": p.get("planId") or p.get("plan_id"),
        "state": p.get("state") or p.get("status"),
        "stopReason": p.get("stopReason"),
        "totals": p.get("totals"),
        "settledMicroCents": p.get("settledMicroCents"),
        "estimatedUnverifiedMicroCents": p.get("estimatedUnverifiedMicroCents"),
        "estimatedUnverifiedStatus": p.get("estimatedUnverifiedStatus"),
        "quarantine": p.get("quarantine"),
        "entry_dispositions": dict(Counter(str(e.get("disposition")) for e in entries)),
        "entry_exec_states": dict(Counter(str(e.get("executionState")) for e in entries)),
        "entries_n": len(entries),
        "raw_sha": sha(p),
    }

for jn in ("job-smoke", "job-ch2"):
    jb = body(jn) or {}
    out[jn] = {"jobId": jb.get("jobId"), "state": jb.get("state"),
               "revision": jb.get("revision"), "grants": jb.get("grants"),
               "raw_sha": sha(jb)}

j = body("job-ch3") or {}
occs = j.get("occurrences") or []
rows = sorted(([o.get("occurrence_id"), o.get("state")] for o in occs),
              key=lambda r: r[0] or "")
fp = hashlib.sha256(canon({
    "jobId": j.get("jobId"), "bookId": j.get("bookId"),
    "chapterIndex": j.get("chapterIndex"), "state": j.get("state"),
    "lane": j.get("lane"), "rows": rows}).encode()).hexdigest()
from collections import Counter
out["job-ch3"] = {
    "jobId": j.get("jobId"), "state": j.get("state"),
    "fingerprint": fp,
    "rows_n": len(rows),
    "row_states": dict(Counter(r[1] for r in rows)),
    "grants": j.get("grants"),
}

cf = body("conflicts") or {}
out["conflicts"] = {"raw_sha": sha(cf), "body": cf}

for fam in ("content", "bindings"):
    s = body(f"snap-{fam}") or {}
    ents = s.get("entities") or []
    out[f"snap-{fam}"] = {"watermark": s.get("watermark"),
                          "entities_n": len(ents), "raw_sha": sha(s)}

for dn in ("diag-smoke", "diag-ch2", "diag-ch2fresh"):
    r = load(dn)
    db = r.get("body") if isinstance(r, dict) else None
    if not isinstance(db, dict):
        out[dn] = {"_status": r.get("_status") if isinstance(r, dict) else None,
                   "raw": str(r)[:200]}
        continue
    recs = db.get("executions") or db.get("records") or db.get("executionRecords") or []
    attempts = []
    for x in recs:
        attempts += x.get("attempts") or []
    from collections import Counter
    dplan = db.get("plan") or {}
    out[dn] = {
        "found": db.get("found"),
        "plan_state": dplan.get("state"),
        "plan_phaseAccounting": dplan.get("phaseAccounting"),
        "records_n": len(recs),
        "record_states": dict(Counter(str(x.get("state") or x.get("outcome")) for x in recs)),
        "record_stages": dict(Counter(str(x.get("stage")) for x in recs)),
        "attempts_n": len(attempts),
        "attempt_phases": dict(Counter(str(a.get("phase")) for a in attempts)),
        "attempt_outcomes": dict(Counter(str(a.get("outcome")) for a in attempts)),
        "raw_sha": sha(db),
    }

print(json.dumps(out, indent=2, sort_keys=True, default=str))
