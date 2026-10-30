#!/usr/bin/env python3
"""gen-fix-1 — package-assemble with static checks (mirrors
gen-pkg-1's package-assemble.py):
  * package/publish == tree-a; package/delta == the 9 delta paths
  * the delta path set is EXACTLY: index.html (modified) + the 8
    added genfix1 paths; every non-delta publish path is
    byte-identical to the published gen-pkg-1 base
  * the Shelf bridge is byte-identical to its frozen SHA
  * the service worker's SHELL list equals the packaged import
    closure exactly
  * PURGE_ON_ACTIVATE is empty
"""
import hashlib
import json
import pathlib
import re
import shutil

HERE = pathlib.Path(__file__).resolve().parent
BASE = HERE / "base"
TREE = HERE / "tree-a"
PKG = HERE / "package"
BRIDGE_SHA = "bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e"
ADDED = {
    "app-269.js", "sw-genfix1.js", "styles-156.css",
    "modules/constants-genfix1.js", "modules/entry-genfix1.js",
    "modules/composition-genfix1.js", "modules/runnable-genfix1.js",
    "modules/generation-surface-genfix1.js",
}
MODIFIED = {"index.html"}


def sha(p):
    return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()


def manifest(root):
    return {str(p.relative_to(root)): sha(p) for p in sorted(root.rglob("*")) if p.is_file()}


def closure(tree):
    seen = set()
    stack = ["app-269.js"]
    pat = re.compile(r'(?:from|import)\s*\(?\s*"(\.[^"]+)"')
    while stack:
        rel = stack.pop()
        if rel in seen:
            continue
        seen.add(rel)
        text = (tree / rel).read_text()
        for m in pat.finditer(text):
            nxt = pathlib.PurePosixPath(rel).parent / m.group(1)
            parts = []
            for part in nxt.parts:
                if part == "..":
                    parts.pop()
                elif part != ".":
                    parts.append(part)
            stack.append("/".join(parts))
    return {
        "./", "./index.html", "./manifest.webmanifest", "./icon.png",
        "./icon-192.png", "./icon-512.png", "./icon.svg", "./styles-156.css",
        *("./" + s for s in seen),
    }


def main():
    if PKG.exists():
        shutil.rmtree(PKG)
    (PKG / "delta").mkdir(parents=True)
    shutil.copytree(TREE, PKG / "publish")
    pub, base = manifest(PKG / "publish"), manifest(BASE)
    delta = {k: pub[k] for k in pub if base.get(k) != pub[k]}
    assert set(delta) == ADDED | MODIFIED, f"delta set differs: {sorted(set(delta) ^ (ADDED | MODIFIED))}"
    for k in ADDED:
        assert k not in base, f"{k} unexpectedly already in base"
        (PKG / "delta" / k).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(TREE / k, PKG / "delta" / k)
    shutil.copyfile(TREE / "index.html", PKG / "delta" / "index.html")
    assert sha(PKG / "publish/modules/vendor/client/shelf-bridge.js") == BRIDGE_SHA, "bridge bytes differ"
    sw = (TREE / "sw-genfix1.js").read_text()
    shell = set(re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1).replace('"', "").replace(",", " ").split())
    assert shell == closure(TREE), f"SHELL != closure: {sorted(shell ^ closure(TREE))}"
    assert re.search(r"const PURGE_ON_ACTIVATE = \[\];", sw), "PURGE_ON_ACTIVATE not empty"
    (PKG / "manifest.json").write_text(json.dumps({
        "package": "gen-fix-1", "base": "gen-pkg-1 publish tree (Gate 3, main @ 46e853e5)",
        "delta_paths": sorted(delta), "bridge_sha256": BRIDGE_SHA,
        "build_marker": "d5b-v2-generation-client-3", "entry": "app-269.js",
        "service_worker": "sw-genfix1.js", "cache": "opalreader-shell-genfix1",
    }, indent=2) + "\n")
    print(f"package: publish {len(pub)} paths; delta {len(delta)} paths {sorted(delta)}")
    print("package: bridge byte-identical; SW SHELL == import closure; PURGE empty")
    print("package-assemble: OK")


if __name__ == "__main__":
    main()
