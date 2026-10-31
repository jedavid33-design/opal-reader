#!/usr/bin/env python3
"""Gate-(a) execution: PUT exact envelope bytes to the prod Worker script
endpoint as multipart/form-data via the custom.cloudflare credential
surrogate (headers copied into curl; body --data-binary, byte-exact).
Usage: cf_put_envelope.py <envelope.bin> <boundary> <resp-out> <headers-out>
Prints status only; never prints credential material."""
import sys, subprocess, urllib.request
sys.path.insert(0, "/opt/hatch/workflow-skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request

ACCT = "b35ff435ff24d134ff640e0099dd13fc"
SCRIPT = "opalreader-api-v2-prod"
envelope_path, boundary, out_path, hdr_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{SCRIPT}"
req = urllib.request.Request(url, method="PUT")
req.add_header("User-Agent", "muse-gatea-deploy")
add_surrogate_to_request(req, "custom.cloudflare", entry_name="access_token",
                         allowed_hosts=("api.cloudflare.com",))
args = ["curl", "-sS", "-X", "PUT", "-o", out_path, "-D", hdr_path, "-w", "%{http_code}",
        "--data-binary", f"@{envelope_path}",
        "-H", f"Content-Type: multipart/form-data; boundary={boundary}"]
seen_auth = False
for k, v in req.header_items():
    if k.lower() == "content-type":
        continue
    if k.lower() == "authorization":
        if seen_auth:
            continue
        seen_auth = True
    args += ["-H", f"{k}: {v}"]
args.append(url)
r = subprocess.run(args, capture_output=True, text=True)
print("curl exit:", r.returncode, "| http:", r.stdout.strip(),
      "| stderr:", r.stderr.strip()[:300])
