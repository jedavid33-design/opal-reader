#!/usr/bin/env python3
"""P7 fresh read-only snapshot for Opal Reader v2 migration rehearsals.

GET-only against production (same discipline as the P1 tools): KV book
records, complete R2 listings, every generation/status + generation/jobs
object, and the usage/events ledger objects. The snapshot lands in a
local data directory (default ~/workspace/opal-reader-p7-data) and NEVER
in the repo. The settings record is stored REDACTED only: the access
token is device-local credential material — it is never written to disk,
never printed; the manifest carries its presence flag + the sha256 of
the raw record so drift is detectable without holding the secret.

Subcommands:
  snapshot    take the snapshot + write snapshot-manifest.json (checksums)
  digest      recompute the corpus digest from the files on disk and
              compare with the manifest (snapshot-immutability proof)
  audio-pass  full byte pass over every unique bound audio object
              (reuses tools/audio_verify.py parsers + discipline)
"""
import concurrent.futures as futures
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cf  # noqa: E402

DATA = os.path.expanduser(
    sys.argv[2] if len(sys.argv) > 2 else "~/workspace/opal-reader-p7-data")
LISTING_PREFIXES = ["audio/", "chapter-audio/", "generation/", "epubs/",
                    "usage/", "quota/"]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def redact(obj):
    """Replace any token-ish value with REDACTED, recursively."""
    if isinstance(obj, dict):
        return {k: ("REDACTED" if "token" in k.lower() else redact(v))
                for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    return obj


def write(rel, raw):
    p = os.path.join(DATA, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if isinstance(raw, str):
        raw = raw.encode()
    with open(p, "wb") as f:
        f.write(raw)
    return rel, sha(raw)


def fetch_many(keys, subdir):
    """Fetch R2 objects concurrently into DATA/subdir/<basename>."""
    os.makedirs(os.path.join(DATA, subdir), exist_ok=True)
    hashes = {}

    def one(key):
        raw, _ = cf.r2_get(key)
        if raw is None:
            return key, None
        name = key.split("/")[-1]
        with open(os.path.join(DATA, subdir, name), "wb") as f:
            f.write(raw)
        return key, sha(raw)

    with futures.ThreadPoolExecutor(max_workers=6) as ex:
        for key, h in ex.map(one, keys):
            hashes[key] = h
    return hashes


def snapshot():
    os.makedirs(DATA, exist_ok=True)
    file_hashes = {}
    manifest = {"counts": {}, "books": []}

    # ---- KV: inventory every key; store books + library index in full,
    # ---- settings REDACTED only.
    kv_keys = cf.kv_list_keys("")
    manifest["kv_keys"] = sorted(kv_keys)
    manifest["counts"]["kv_keys"] = len(kv_keys)
    settings_info = {"present": False}
    for key in kv_keys:
        raw = cf.kv_get(key)
        if raw is None:
            continue
        if key.startswith("book:"):
            rel, h = write(os.path.join("books", key[5:] + ".json"), raw)
            file_hashes[rel] = h
            doc = json.loads(raw)
            segs = [s for ch in doc.get("chapters", [])
                    for s in ch.get("segments", [])]
            manifest["books"].append({
                "id": doc.get("id"), "title": doc.get("title"),
                "bytes": len(raw), "sha256": h,
                "segments": len(segs),
                "bound": sum(1 for s in segs if s.get("audioKey"))})
        elif key == "library:index":
            rel, h = write("library-index.json", raw)
            file_hashes[rel] = h
        elif key == "settings:shared":
            settings_info = {"present": True, "raw_sha256": sha(raw),
                             "token_redacted": True}
            doc = json.loads(raw)
            rel, h = write("settings-redacted.json",
                           json.dumps(redact(doc), indent=1))
            file_hashes[rel] = h
    manifest["settings"] = settings_info
    manifest["books"].sort(key=lambda b: b["title"] or "")

    # ---- R2: complete listings for every store family.
    listings = {}
    for prefix in LISTING_PREFIXES:
        objs = cf.r2_list(prefix)
        listings[prefix] = [{"key": o["key"], "size": o.get("size"),
                             "etag": (o.get("etag") or "").strip('"')}
                            for o in objs]
        manifest["counts"][f"r2:{prefix}"] = len(objs)
    rel, h = write("listings.json", json.dumps(listings, indent=1))
    file_hashes[rel] = h

    # ---- Fetch the generation status + job payload objects.
    gen = [o["key"] for o in listings["generation/"]]
    status_keys = [k for k in gen if k.startswith("generation/status/")]
    job_keys = [k for k in gen if k.startswith("generation/jobs/")]
    sh = fetch_many(status_keys, "statuses")
    jh = fetch_many(job_keys, "jobs")
    manifest["counts"]["statuses"] = len(status_keys)
    manifest["counts"]["job_payloads"] = len(job_keys)
    manifest["missing_fetches"] = [k for k, v in
                                   list(sh.items()) + list(jh.items())
                                   if v is None]
    for sub in ("statuses", "jobs"):
        d = os.path.join(DATA, sub)
        for name in sorted(os.listdir(d)):
            with open(os.path.join(d, name), "rb") as f:
                file_hashes[os.path.join(sub, name)] = sha(f.read())

    # ---- Usage ledger objects (adopted as-is by the migration).
    usage_keys = [o["key"] for o in listings["usage/"]
                  if o["key"].startswith("usage/events/")]
    uh = fetch_many(usage_keys, "usage-events")
    manifest["counts"]["usage_events"] = len(usage_keys)
    manifest["missing_fetches"] += [k for k, v in uh.items() if v is None]
    d = os.path.join(DATA, "usage-events")
    if os.path.isdir(d):
        for name in sorted(os.listdir(d)):
            with open(os.path.join(d, name), "rb") as f:
                file_hashes[os.path.join("usage-events", name)] = sha(f.read())

    # ---- Corpus digest over every snapshot file.
    digest = hashlib.sha256()
    for rel in sorted(file_hashes):
        digest.update(f"{rel}:{file_hashes[rel]}\n".encode())
    manifest["file_hashes"] = file_hashes
    manifest["corpus_digest"] = digest.hexdigest()
    import datetime
    manifest["taken_at"] = datetime.datetime.now(
        datetime.timezone.utc).isoformat()
    with open(os.path.join(DATA, "snapshot-manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print(json.dumps({"counts": manifest["counts"],
                      "books": manifest["books"],
                      "settings": settings_info,
                      "missing_fetches": manifest["missing_fetches"],
                      "corpus_digest": manifest["corpus_digest"]},
                     indent=1))


def digest():
    with open(os.path.join(DATA, "snapshot-manifest.json")) as f:
        manifest = json.load(f)
    d = hashlib.sha256()
    bad = []
    for rel, want in sorted(manifest["file_hashes"].items()):
        p = os.path.join(DATA, rel)
        if not os.path.exists(p):
            bad.append(f"{rel}: MISSING")
            continue
        with open(p, "rb") as f:
            got = sha(f.read())
        if got != want:
            bad.append(f"{rel}: hash mismatch")
        d.update(f"{rel}:{got}\n".encode())
    got_digest = d.hexdigest()
    ok = got_digest == manifest["corpus_digest"] and not bad
    print(json.dumps({"digest_matches": ok,
                      "corpus_digest": got_digest,
                      "problems": bad}))
    return 0 if ok else 1


def audio_pass():
    import audio_verify
    audio_verify.DATA = DATA
    audio_verify.RESULTS = os.path.join(DATA, "audio-results.jsonl")
    audio_verify.main()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "snapshot"
    if cmd == "snapshot":
        snapshot()
    elif cmd == "digest":
        sys.exit(digest())
    elif cmd == "audio-pass":
        audio_pass()
    else:
        print(__doc__)
        sys.exit(2)
