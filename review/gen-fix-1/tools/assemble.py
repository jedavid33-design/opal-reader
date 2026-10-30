#!/usr/bin/env python3
"""gen-fix-1 — assemble the candidate tree from ./base (the
published gen-pkg-1 tree) plus the genfix1 delta sources, twice
(tree-a / tree-b), and assert the twins are byte-identical.
Mirrors gen-pkg-1's assemble.py."""
import hashlib
import pathlib
import shutil

HERE = pathlib.Path(__file__).resolve().parent
BASE = HERE / "base"
SRC = HERE / "src"

OVERLAY = {
    "index.html": "index-genfix1.html",
    "app-269.js": "app-269.js",
    "sw-genfix1.js": "sw-genfix1.js",
    "styles-156.css": "styles-156.css",
    "modules/constants-genfix1.js": "modules/constants-genfix1.js",
    "modules/entry-genfix1.js": "modules/entry-genfix1.js",
    "modules/composition-genfix1.js": "modules/composition-genfix1.js",
    "modules/runnable-genfix1.js": "modules/runnable-genfix1.js",
    "modules/generation-surface-genfix1.js": "modules/generation-surface-genfix1.js",
}


def sha(p):
    return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()


def build(dest):
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(BASE, dest)
    for target, src in OVERLAY.items():
        shutil.copyfile(SRC / src, dest / target)


def manifest(root):
    out = {}
    for p in sorted(root.rglob("*")):
        if p.is_file():
            out[str(p.relative_to(root))] = sha(p)
    return out


build(HERE / "tree-a")
build(HERE / "tree-b")
ma, mb = manifest(HERE / "tree-a"), manifest(HERE / "tree-b")
assert ma == mb, "twin trees differ"
base = manifest(BASE)
changed = sorted(k for k in ma if base.get(k) != ma[k])
print(f"tree paths: {len(ma)} (base {len(base)}); delta vs base: {changed}")
print("assemble: OK — twin trees byte-identical")
