#!/usr/bin/env python3
"""Ch2 deploy: GET a Worker script's content + response headers (etag)
via the custom.cloudflare credential surrogate. Read-only.
Usage: cf_get_script.py <script-name> <body-out> <meta-out.json>
Prints status + etag only; never prints credential material."""
import sys, json, urllib.request
sys.path.insert(0, "/opt/hatch/workflow-skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request

ACCT = "b35ff435ff24d134ff640e0099dd13fc"
script, body_out, meta_out = sys.argv[1], sys.argv[2], sys.argv[3]
url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{script}"
req = urllib.request.Request(url, method="GET")
req.add_header("User-Agent", "muse-ch2-deploy")
add_surrogate_to_request(req, "custom.cloudflare", entry_name="access_token",
                         allowed_hosts=("api.cloudflare.com",))
try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read()
        meta = {"status": resp.status, "etag": resp.headers.get("ETag"),
                "content_type": resp.headers.get("Content-Type"),
                "bytes": len(body)}
except urllib.error.HTTPError as e:
    body = e.read()
    meta = {"status": e.code, "etag": e.headers.get("ETag") if e.headers else None,
            "content_type": e.headers.get("Content-Type") if e.headers else None,
            "bytes": len(body)}
open(body_out, "wb").write(body)
json.dump(meta, open(meta_out, "w"), indent=2)
print(script, "status:", meta["status"], "| etag:", meta["etag"], "| bytes:", meta["bytes"])
