"""Shared Cloudflare REST access for P1 offline verification tools.

Read-only usage only: these tools never send a mutating request.
Auth flows through the custom.cloudflare surrogate (no raw secrets here).
"""
import json
import sys
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request  # noqa: E402

ACCOUNT = "b35ff435ff24d134ff640e0099dd13fc"
KV_NS = "0e6fc5f440684b628db4b1e3b16486b1"
R2_BUCKET = "opalreader-storage"
BASE = "https://api.cloudflare.com/client/v4"


def cf_request(method, path, data=None):
    url = BASE + path
    req = urllib.request.Request(url, method=method, data=data)
    req.add_header("User-Agent", "muse-cloudflare-skill")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    add_surrogate_to_request(req, "custom.cloudflare",
                             entry_name="access_token",
                             allowed_hosts=("api.cloudflare.com",))
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        # urllib raises for >=400; callers handle status themselves
        # (404 is a legitimate "missing" answer for KV/R2 GETs, and
        # cf_json still rejects error statuses via its success check).
        return e.code, e.read(), dict(e.headers or {})


def cf_json(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    status, raw, _ = cf_request(method, path, data)
    parsed = json.loads(raw) if raw else {}
    if status >= 300 or not parsed.get("success", True):
        raise RuntimeError(f"CF API {method} {path} -> {status}: {raw[:300]!r}")
    return parsed


def kv_list_keys(prefix):
    keys, cursor = [], ""
    while True:
        q = f"?prefix={urllib.parse.quote(prefix)}&limit=1000"
        if cursor:
            q += f"&cursor={urllib.parse.quote(cursor)}"
        r = cf_json("GET", f"/accounts/{ACCOUNT}/storage/kv/namespaces/{KV_NS}/keys{q}")
        keys += [k["name"] for k in r["result"]]
        cursor = (r.get("result_info") or {}).get("cursor") or ""
        if not cursor:
            return keys


def kv_get(key):
    q = urllib.parse.quote(key, safe="")
    status, raw, _ = cf_request(
        "GET", f"/accounts/{ACCOUNT}/storage/kv/namespaces/{KV_NS}/values/{q}")
    if status == 404:
        return None
    return raw


def r2_list(prefix):
    """All objects under a prefix: [{key, size, etag}]."""
    out, cursor = [], ""
    while True:
        q = f"?prefix={urllib.parse.quote(prefix)}&per_page=1000"
        if cursor:
            q += f"&cursor={urllib.parse.quote(cursor)}"
        r = cf_json("GET", f"/accounts/{ACCOUNT}/r2/buckets/{R2_BUCKET}/objects{q}")
        out += r["result"]
        cursor = r.get("result_info", {}).get("cursor") or ""
        if not r.get("result_info", {}).get("is_truncated"):
            return out


def r2_get(key):
    q = urllib.parse.quote(key, safe="")
    status, raw, headers = cf_request(
        "GET", f"/accounts/{ACCOUNT}/r2/buckets/{R2_BUCKET}/objects/{q}")
    if status == 404:
        return None, {}
    return raw, headers
