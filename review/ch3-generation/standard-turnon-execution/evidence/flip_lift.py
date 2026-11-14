import hashlib, json, pathlib, re, sys, urllib.request, uuid
sys.path.insert(0, "/opt/hatch/workflow-skills/custom-connector-setup/bin")
sys.path.insert(0, "/home/hatch/workspace/ch2-program/a1-deploy-gate")
import dynamic_credentials
from cf import api, ACCT

SCRIPT = "opalreader-api-v2-prod"
ROOT = pathlib.Path("/home/hatch/workspace/ch2-program/a1-deploy-gate/stamped-tree")
GATE = pathlib.Path("/home/hatch/workspace/ch2-program/std-gate")
STAMPED_IDENTITY_SHA = "d1c90ca0"  # prefix from the A-1 deployment record (build-identity stamp)

# 1. verify stamped tree vs candidate manifest (30 parts) + stamped identity part
manifest = {}
for line in open("/home/hatch/workspace/ch2-program/a1-build/CANDIDATE-MANIFEST.md"):
    m = re.match(r"^([0-9a-f]{64})\s+(v2/\S+)$", line.strip())
    if m: manifest[m.group(2)] = m.group(1)
assert len(manifest) == 31, len(manifest)
parts = sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file())
assert parts == sorted(manifest.keys()), "part set mismatch"
diffs = []
for rel in parts:
    h = hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()
    if h != manifest[rel]:
        diffs.append((rel, h))
assert len(diffs) == 1 and diffs[0][0] == "v2/host/build-identity.mjs" and diffs[0][1].startswith(STAMPED_IDENTITY_SHA), diffs
print("tree verified: 30/31 == candidate manifest; sole diff = stamped build-identity", diffs[0][1][:12])

# 2. fresh settings + script-settings (just-before reads)
settings = api('GET', f'/accounts/{ACCT}/workers/scripts/{SCRIPT}/settings')['result']
json.dump(settings, open(GATE / "settings-just-before-lift.json", "w"), indent=1)
ss = api('GET', f'/accounts/{ACCT}/workers/scripts/{SCRIPT}/script-settings')['result']
observability = ss.get('observability')
assert observability and observability.get('enabled') is True
bindings = []
for b in settings["bindings"]:
    if b["type"] == "secret_text":
        bindings.append({"name": b["name"], "type": "inherit"})
    else:
        bindings.append({k: v for k, v in b.items()})
halt = [b for b in bindings if b.get("name") == "GENERATION_HALT"]
assert len(bindings) == 10 and halt and halt[0].get("text") == "1", "precondition: halt must be '1'"
halt[0]["text"] = "0"
metadata = {
    "main_module": "v2/worker-entry-prod-d6.js",
    "compatibility_date": settings["compatibility_date"],
    "compatibility_flags": settings["compatibility_flags"],
    "bindings": bindings,
    "observability": observability,
}
print("metadata: 10 bindings, sole change GENERATION_HALT 1->0, observability carried verbatim")

# 3. multipart build (A-1 upload construction)
boundary = "----opalStdGate" + uuid.uuid4().hex
chunks = []
def add_field(name, filename, ctype, data):
    chunks.append(f"--{boundary}\r\n".encode())
    disp = f'Content-Disposition: form-data; name="{name}"'
    if filename: disp += f'; filename="{filename}"'
    chunks.append((disp + "\r\n").encode())
    chunks.append(f"Content-Type: {ctype}\r\n\r\n".encode())
    chunks.append(data if isinstance(data, bytes) else data.encode())
    chunks.append(b"\r\n")
add_field("metadata", None, "application/json", json.dumps(metadata))
for rel in parts:
    add_field(rel, rel, "application/javascript+module", (ROOT / rel).read_bytes())
chunks.append(f"--{boundary}--\r\n".encode())
body = b"".join(chunks)
print("multipart body bytes:", len(body))
json.dump({"bindings": [(b["name"], b["type"]) for b in bindings], "parts": parts, "body_bytes": len(body)},
          open(GATE / "lift-ledger.json", "w"), indent=1)

# 4. single PUT — no retry on any outcome
url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{SCRIPT}"
req = urllib.request.Request(url, data=body, method="PUT",
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
dynamic_credentials.add_surrogate_to_request(req, "custom.cloudflare",
    entry_name="access_token", allowed_hosts=("api.cloudflare.com",))
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        out = json.loads(resp.read().decode())
        print("LIFT PUT HTTP", resp.status, "success:", out.get("success"), "errors:", out.get("errors"))
        print("deployment_id:", out.get("result", {}).get("deployment_id") or out.get("result", {}).get("id"))
        json.dump(out, open(GATE / "lift-put-response.json", "w"), indent=1)
except urllib.error.HTTPError as e:
    print("LIFT PUT HTTPError", e.code); print(e.read().decode()[:1000])
    print("OUTCOME UNCERTAIN — reconcile read-only, do not re-send")
except Exception as e:
    print("LIFT PUT exception:", type(e).__name__, str(e)[:300])
    print("OUTCOME UNCERTAIN — reconcile read-only, do not re-send")
