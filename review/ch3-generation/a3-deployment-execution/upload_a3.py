import json, pathlib, sys, urllib.request, uuid
sys.path.insert(0, "/opt/hatch/workflow-skills/custom-connector-setup/bin")
sys.path.insert(0, "/home/hatch/workspace/ch2-program/a1-deploy-gate")
import dynamic_credentials
import cf

ACCT = cf.ACCT
SCRIPT = "opalreader-api-v2-prod"
ROOT = pathlib.Path("/home/hatch/workspace/ch2-program/a3-deploy-gate/stamped-tree")
GATE = pathlib.Path("/home/hatch/workspace/ch2-program/a3-deploy-gate")

settings = cf.api("GET", f"/accounts/{ACCT}/workers/scripts/{SCRIPT}/settings")["result"]
json.dump(settings, open(GATE / "settings-pre-full.json", "w"), indent=1)

# E2: verify the binding inventory by identity, type and non-secret config
inv = [(b["name"], b["type"]) for b in settings["bindings"]]
# Expected inventory = the ACTUAL live inventory, read from the settings GET at
# census time (2026-11-16) and confirmed identical on the pre-upload read.
# (An earlier draft of this script guessed two names wrong — PROVIDER_ATTEMPT_DAILY_LIMIT
# is a code constant, not a binding, and there is no KV binding; the assertion
# aborted BEFORE any upload attempt, so Act 1 was not consumed. The correction
# is disclosed in the execution record.)
expected = {
    ("ALLOWED_ORIGIN", "plain_text"), ("COORDINATOR", "durable_object_namespace"),
    ("GEMINI_API_KEY", "secret_text"), ("GENERATION_HALT", "plain_text"),
    ("OPALREADER_ACCESS_TOKEN", "secret_text"), ("OPALREADER_GENERATION_V2", "queue"),
    ("OPALREADER_MIGRATION_OPERATOR_TOKEN", "secret_text"),
    ("OPALREADER_PHASE_POLICY", "plain_text"), ("OPALREADER_STORAGE", "r2_bucket"),
    ("OPALREADER_V2_SCOPE", "plain_text"),
}
print("binding inventory:", sorted(inv))
assert set(inv) == expected, f"BINDING INVENTORY MISMATCH: {set(inv) ^ expected}"
halt = [b for b in settings["bindings"] if b["name"] == "GENERATION_HALT"][0]
assert halt["text"] == "0", "GENERATION_HALT is not 0 — STOP"
observability = settings.get("observability")
assert observability and observability.get("enabled") is True, "observability not enabled pre-upload"
print("E2 inventory OK: 10 bindings by identity/type; GENERATION_HALT '0'; observability enabled")

bindings = []
for b in settings["bindings"]:
    if b["type"] == "secret_text":
        bindings.append({"name": b["name"], "type": "inherit"})
    else:
        bindings.append({k: v for k, v in b.items()})
metadata = {
    "main_module": "v2/worker-entry-prod-d6.js",
    "compatibility_date": settings["compatibility_date"],
    "compatibility_flags": settings["compatibility_flags"],
    "bindings": bindings,
    "observability": observability,
}
parts = sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file())
assert len(parts) == 31, len(parts)
boundary = "----opalA3" + uuid.uuid4().hex
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
print("multipart body bytes:", len(body), "| parts:", len(parts))
json.dump({"metadata_bindings": [(b["name"], b["type"]) for b in bindings], "parts": parts, "body_bytes": len(body)},
          open(GATE / "upload-ledger.json", "w"), indent=1)

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{SCRIPT}"
req = urllib.request.Request(url, data=body, method="PUT",
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
dynamic_credentials.add_surrogate_to_request(req, "custom.cloudflare",
    entry_name="access_token", allowed_hosts=("api.cloudflare.com",))
print("=== ACT 1: THE SINGLE UPLOAD ATTEMPT ===")
try:
    with urllib.request.urlopen(req, timeout=180) as resp:
        out = json.loads(resp.read().decode())
        print("UPLOAD HTTP", resp.status, "success:", out.get("success"))
        print("errors:", out.get("errors"))
        json.dump(out, open(GATE / "upload-response.json", "w"), indent=1)
except urllib.error.HTTPError as e:
    print("UPLOAD HTTPError", e.code)
    print(e.read().decode()[:1200])
    print("ACT 1 CONSUMED — outcome to be established by read-back only; NO RETRY")
except Exception as e:
    print("UPLOAD EXCEPTION:", type(e).__name__, str(e)[:400])
    print("ACT 1 CONSUMED — outcome to be established by read-back only; NO RETRY")
