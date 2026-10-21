#!/usr/bin/env python3
"""P1 offline migration verification for Opal Reader v2 (Option C).

Read-only against production: snapshots come from the Cloudflare REST API
(GET only); every check runs locally against the snapshot in
~/workspace/opal-reader-p1-data/. Book text never leaves the local disk and
is never printed — reports carry counts, ids and hashes only.

Subcommands:
  snapshot-statuses   fetch generation statuses + job payloads into the snapshot
  structure           identity / binding / provenance / lineage checks on books
                      + split-tree tiling checks on job payloads and statuses
"""
import collections
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cf  # noqa: E402

DATA = os.path.expanduser("~/workspace/opal-reader-p1-data")
HEX64 = re.compile(r"^[a-f0-9]{64}$")


def load_books():
    books = []
    for name in sorted(os.listdir(os.path.join(DATA, "books"))):
        with open(os.path.join(DATA, "books", name)) as f:
            books.append(json.load(f))
    return books


def squash(s):
    return re.sub(r"\s+", "", s or "")


def snapshot_statuses():
    os.makedirs(os.path.join(DATA, "statuses"), exist_ok=True)
    os.makedirs(os.path.join(DATA, "jobs"), exist_ok=True)
    objs = cf.r2_list("generation/status/")
    n = 0
    for o in objs:
        raw, _ = cf.r2_get(o["key"])
        name = o["key"].split("/")[-1]
        with open(os.path.join(DATA, "statuses", name), "wb") as f:
            f.write(raw)
        n += 1
    print(f"statuses: {n}")
    objs = cf.r2_list("generation/jobs/")
    n = 0
    for o in objs:
        raw, _ = cf.r2_get(o["key"])
        name = o["key"].split("/")[-1]
        with open(os.path.join(DATA, "jobs", name), "wb") as f:
            f.write(raw)
        n += 1
    print(f"job payloads: {n}")


def check_books(books):
    rep = {"books": [], "totals": collections.Counter(),
           "problems": [], "provenance": collections.Counter()}
    all_ids = collections.Counter()
    for b in books:
        bt = {"title": b.get("title"), "id": b.get("id"),
              "segments": 0, "bound": 0, "problems": []}
        seen_ids = collections.Counter()
        for ci, ch in enumerate(b.get("chapters", [])):
            segs = ch.get("segments", [])
            fam = collections.defaultdict(list)
            for i, s in enumerate(segs):
                bt["segments"] += 1
                sid = s.get("id")
                if not sid:
                    bt["problems"].append(f"ch{ci+1} seg{i}: missing id")
                seen_ids[sid] += 1
                all_ids[sid] += 1
                if s.get("blockRootId"):
                    fam[s["blockRootId"]].append(i)
                key = s.get("audioKey")
                if key:
                    bt["bound"] += 1
                    if not HEX64.match(str(key)):
                        bt["problems"].append(f"ch{ci+1} seg{i}: audioKey not 64-hex")
                    if s.get("systemVoiceFallback"):
                        rep["provenance"]["manual_device_voice"] += 1
                    elif s.get("generationFingerprint"):
                        rep["provenance"]["fingerprinted"] += 1
                    else:
                        rep["provenance"]["legacy_unfingerprinted"] += 1
                if s.get("audioStale"):
                    bt.setdefault("stale_flagged", []).append(
                        {"chapter": ci + 1, "index": i, "id": sid,
                         "audioKey": key})
            for root, idxs in fam.items():
                if not any(segs[j].get("id") == root for j in range(len(segs))):
                    bt["problems"].append(
                        f"ch{ci+1}: blockRootId {root[:8]}… unresolved in chapter")
                if idxs != list(range(idxs[0], idxs[0] + len(idxs))):
                    bt["problems"].append(
                        f"ch{ci+1}: family {root[:8]}… not contiguous")
        dups = [i for i, c in seen_ids.items() if c > 1]
        if dups:
            bt["problems"].append(f"duplicate segment ids in book: {len(dups)}")
        rep["books"].append(bt)
        rep["totals"]["segments"] += bt["segments"]
        rep["totals"]["bound"] += bt["bound"]
        rep["problems"] += [f"{bt['title']}: {p}" for p in bt["problems"]]
    rep["cross_book_duplicate_ids"] = sum(1 for _, c in all_ids.items() if c > 1)
    return rep


def plain(s):
    """Plain speech text: emphasis markup is not wording (the split kernel
    itself adds a tag pair at an emphasized seam, so tag characters must
    not count as text)."""
    return squash(re.sub(r"</?emphasis>", "", s or "", flags=re.I))


def tile_check(segments, label, problems, originals, compare_external=True):
    """Verify split trees in one job segment list.

    Two linkage conventions exist in the wild:
      A) in-list roots: repair_path "" nodes are present and children link
         via repair_parent = the parent node's list index.
      B) adaptive jobs: the list holds only split nodes; first-level
         children carry repair_parent -1 and repair_source_index pointing
         at the source segment in the book (their parent text lives
         outside this record).
    Checks: parent links resolve and paths agree with parents; every node
    with in-list children is tiled exactly by its children (plain-text
    comparison); convention-B leaf sets are tiled against the original
    segment text when that original survives in another job payload.
    Returns (internal_tiled, external_tiled, external_missing)."""
    internal = external = missing = 0
    children = collections.defaultdict(list)
    for i, s in enumerate(segments):
        if isinstance(s.get("repair_path"), str):
            par = s.get("repair_parent")
            if isinstance(par, int) and par >= 0:
                children[par].append(i)
    for i, s in enumerate(segments):
        p = s.get("repair_path")
        if not isinstance(p, str) or p == "":
            continue
        par = s.get("repair_parent")
        if isinstance(par, int) and par >= 0:
            if par >= len(segments) or segments[par].get("repair_path") != p[:-1]:
                problems.append(f"{label}: seg{i} path {p}: parent link broken")
        elif par == -1:
            if len(p) != 1 or not isinstance(s.get("repair_source_index"), int):
                problems.append(f"{label}: seg{i} path {p}: malformed external root")
        else:
            problems.append(f"{label}: seg{i} path {p}: bad repair_parent {par!r}")
    for i, kids in children.items():
        joined = "".join(segments[k].get("text") or "" for k in kids)
        if plain(joined) != plain(segments[i].get("text")):
            problems.append(
                f"{label}: node seg{i} path {segments[i].get('repair_path')!r} "
                f"not tiled by its children (joined {len(joined)} chars vs "
                f"node {len(segments[i].get('text') or '')})")
        else:
            internal += 1
    # convention B: leaves under each external source
    ext_roots = [i for i, s in enumerate(segments)
                 if isinstance(s.get("repair_path"), str) and s.get("repair_path")
                 and s.get("repair_parent") == -1]
    by_source = collections.defaultdict(list)
    for i in ext_roots:
        by_source[segments[i].get("repair_source_index")].append(i)

    def leaves_of(i):
        if i not in children:
            return [i]
        out = []
        for k in children[i]:
            out += leaves_of(k)
        return out

    superseded = 0
    for src, roots in by_source.items():
        leaves = []
        for r in roots:
            leaves += leaves_of(r)
        leaves.sort()
        if not compare_external:
            # A later repair round on the same chapter: its source indexes
            # are relative to the post-earlier-repair chapter layout, so
            # the generation payload is no longer the right original.
            # Internal tiling (above) is the check for these trees.
            superseded += 1
            continue
        original = originals.get(src)
        if original is None:
            missing += 1
            continue
        joined = "".join(segments[k].get("text") or "" for k in leaves)
        if plain(joined) != plain(original):
            problems.append(
                f"{label}: source seg{src} leaves do not tile the surviving "
                f"original (joined {len(joined)} chars vs {len(original)})")
        else:
            external += 1
    return internal, external, missing, superseded


def check_jobs():
    problems = []
    files = internal = external = missing = 0
    docs = []
    for sub in ("jobs", "statuses"):
        d = os.path.join(DATA, sub)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            try:
                with open(os.path.join(d, name)) as f:
                    docs.append((sub, name, json.load(f)))
            except Exception:
                continue
    # originals: repair-free payloads keyed by (book, chapter) -> {seg_index: text}
    original_index = {}
    for sub, name, doc in docs:
        segs = doc.get("segments")
        if not isinstance(segs, list):
            continue
        if any(isinstance(s, dict) and "repair_path" in s for s in segs):
            continue
        key = (doc.get("book_id"), doc.get("chapter_index"))
        if key not in original_index:
            original_index[key] = {
                s.get("segment_index"): s.get("text")
                for s in segs if isinstance(s, dict)}
    status_time = {}
    for sub, name, doc in docs:
        if sub == "statuses":
            status_time[doc.get("job_id")] = doc.get("updated_at") or 0
    tree_docs = [(sub, name, doc) for sub, name, doc in docs
                 if isinstance(doc.get("segments"), list) and any(
                     isinstance(s, dict) and "repair_path" in s
                     for s in doc["segments"])]
    groups = collections.defaultdict(list)
    for item in tree_docs:
        doc = item[2]
        groups[(doc.get("book_id"), doc.get("chapter_index"))].append(item)
    superseded = 0
    for key, group in groups.items():
        # Earliest repair round on a chapter compares against the
        # generation originals; later rounds re-indexed the chapter.
        group.sort(key=lambda it: status_time.get(it[2].get("job_id"), 0))
        for n, (sub, name, doc) in enumerate(group):
            files += 1
            originals = original_index.get(key, {})
            a, b, c, d = tile_check(doc["segments"], f"{sub}/{name[:20]}",
                                    problems, originals,
                                    compare_external=(n == 0))
            internal += a
            external += b
            missing += c
            superseded += d
    return {"files_with_trees": files, "internal_nodes_tiled": internal,
            "external_roots_tiled_vs_original": external,
            "external_originals_not_in_records": missing,
            "external_roots_superseded_original": superseded,
            "problems": problems}


def structure():
    books = load_books()
    rep = check_books(books)
    rep["jobs"] = check_jobs()
    rep["totals"] = dict(rep["totals"])
    rep["provenance"] = dict(rep["provenance"])
    with open(os.path.join(DATA, "structure-report.json"), "w") as f:
        json.dump(rep, f, indent=1)
    print(json.dumps({k: rep[k] for k in
                      ("totals", "provenance", "cross_book_duplicate_ids")}, indent=1))
    print("book problems:", len(rep["problems"]))
    for p in rep["problems"][:10]:
        print("  -", p)
    print("job trees:", rep["jobs"]["files_with_trees"], "files,",
          rep["jobs"]["internal_nodes_tiled"], "internal nodes tiled,",
          rep["jobs"]["external_roots_tiled_vs_original"], "external roots tiled vs originals,",
          rep["jobs"]["external_originals_not_in_records"], "originals not in records,",
          rep["jobs"]["external_roots_superseded_original"], "superseded-original roots,",
          len(rep["jobs"]["problems"]), "problems")
    for p in rep["jobs"]["problems"][:10]:
        print("  -", p)
    for bt in rep["books"]:
        if bt.get("stale_flagged"):
            print("STALE-FLAGGED:", bt["title"], bt["stale_flagged"])


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "structure"
    if cmd == "snapshot-statuses":
        snapshot_statuses()
    elif cmd == "structure":
        structure()
    else:
        print(__doc__)
        sys.exit(2)
