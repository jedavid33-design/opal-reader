#!/usr/bin/env python3
"""Gate-(a) execution: multipart part parse/compare/assemble helpers.

Subcommands:
  parse <bin> <outdir>            parse a multipart body into <outdir>/<part> files + manifest
  compare-manifest <partsdir> <manifest.json>
                                  byte-compare parsed parts against a parts-manifest
  assemble <partsdir> <order.json> <metadata.json> <boundary> <out.bin>
                                  assemble metadata-first multipart envelope
  metadiff <a.json> <b.json>      parsed-JSON deep diff (prints differing leaf paths)
"""
import sys, os, json, hashlib

def parse_multipart(data):
    first = data.split(b"\r\n", 1)[0]
    assert first.startswith(b"--"), "no boundary"
    boundary = first[2:]
    parts = {}
    order = []
    for seg in data.split(b"--" + boundary):
        if not seg or seg in (b"--\r\n", b"--"):
            continue
        if seg.startswith(b"\r\n"):
            seg = seg[2:]
        if seg.endswith(b"--"):
            seg = seg[:-2]
            if seg.endswith(b"\r\n"):
                seg = seg[:-2]
        elif seg.endswith(b"\r\n"):
            seg = seg[:-2]
        head, _, body = seg.partition(b"\r\n\r\n")
        name = None
        for line in head.decode("utf8", "replace").split("\r\n"):
            if line.lower().startswith("content-disposition:"):
                for tok in line.split(";"):
                    tok = tok.strip()
                    if tok.startswith('name="'):
                        name = tok[6:-1]
        assert name, head[:120]
        parts[name] = body
        order.append(name)
    return parts, order

def cmd_parse(binpath, outdir):
    data = open(binpath, "rb").read()
    parts, order = parse_multipart(data)
    os.makedirs(outdir, exist_ok=True)
    man = []
    for name in order:
        body = parts[name]
        p = os.path.join(outdir, name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(body)
        man.append({"part": name, "bytes": len(body),
                    "sha256": hashlib.sha256(body).hexdigest()})
    print(json.dumps({"parts": len(man), "manifest": man}, indent=2))

def cmd_compare(partsdir, manifest_path):
    man = json.load(open(manifest_path))
    rows, ok = [], True
    seen = set()
    for ent in man["parts"]:
        name = ent["part"]
        seen.add(name)
        p = os.path.join(partsdir, name)
        if not os.path.exists(p):
            rows.append({"part": name, "present": False}); ok = False; continue
        body = open(p, "rb").read()
        same = len(body) == ent["bytes"] and hashlib.sha256(body).hexdigest() == ent["sha256"]
        ok = ok and same
        rows.append({"part": name, "present": True, "bytes": len(body), "byte_identical": same})
    extra = []
    for root, _, files in os.walk(partsdir):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), partsdir)
            if rel not in seen:
                extra.append(rel)
    if extra: ok = False
    print(json.dumps({"all_identical": ok, "compared": len(rows), "extra_parts": extra, "rows": rows}, indent=2))
    sys.exit(0 if ok else 1)

def cmd_assemble(partsdir, order_path, metadata_path, boundary, out_path):
    order = json.load(open(order_path))
    meta = open(metadata_path, "rb").read()
    B = boundary.encode()
    out = bytearray()
    out += b"--" + B + b"\r\n"
    out += b'Content-Disposition: form-data; name="metadata"\r\n'
    out += b"Content-Type: application/json\r\n\r\n"
    out += meta + b"\r\n"
    for name in order:
        body = open(os.path.join(partsdir, name), "rb").read()
        out += b"--" + B + b"\r\n"
        out += f'Content-Disposition: form-data; name="{name}"; filename="{name}"\r\n'.encode()
        out += b"Content-Type: application/javascript+module\r\n\r\n"
        out += body + b"\r\n"
    out += b"--" + B + b"--\r\n"
    open(out_path, "wb").write(bytes(out))
    print(json.dumps({"bytes": len(out), "sha256": hashlib.sha256(bytes(out)).hexdigest()}))

def diff(a, b, path=""):
    out = []
    if type(a) is not type(b):
        return [path]
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{path}.{k}")
            else:
                out += diff(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append(path + " (length)")
        for i, (x, y) in enumerate(zip(a, b)):
            out += diff(x, y, f"{path}[{i}]")
    elif a != b:
        out.append(path)
    return out

def cmd_metadiff(pa, pb):
    a = json.load(open(pa)); b = json.load(open(pb))
    d = diff(a, b)
    print(json.dumps({"diff_paths": d, "count": len(d)}, indent=2))

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "parse": cmd_parse(sys.argv[2], sys.argv[3])
    elif cmd == "compare-manifest": cmd_compare(sys.argv[2], sys.argv[3])
    elif cmd == "assemble": cmd_assemble(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])
    elif cmd == "metadiff": cmd_metadiff(sys.argv[2], sys.argv[3])
    else: sys.exit(f"unknown {cmd}")
