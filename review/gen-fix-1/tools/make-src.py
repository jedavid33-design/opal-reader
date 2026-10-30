#!/usr/bin/env python3
"""gen-fix-1 — build the corrective candidate's delta sources.

Base: the PUBLISHED gen-pkg-1 tree (Gate 3, main @ 46e853e5;
publish-tree digest 97e280948341e0d993975f46ebf089c10e9a2dfdc7
4487783ff80dd2069cc398), copied into ./base. Every source here is
generated from a base file by anchored replacements that must
match exactly or the build aborts (the gen-pkg-1 make-src.py
discipline).

THE correction (the only behaviour delta in the package):
modules/generation-surface-genfix1.js adds "halted_unknown" to
TERMINAL_PLAN_STATES. Everything else is the mechanical packaging
consequence: advanced identities (app-269.js, styles-156.css,
sw-genfix1.js / cache opalreader-shell-genfix1, *-genfix1 module
names, packaging marker "gen-fix-1", build marker
d5b-v2-generation-client-3) so no live gen-pkg-1 path is
overwritten and rollback to gen-pkg-1 (or ui-pkg-4) stays exact.

Diagnosis: Roundtable board 6530278010 (issue #15). Build
authorized by Julie: board 6530302659. Publication is NOT part of
this build.
"""
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
BASE = HERE / "base"
SRC = HERE / "src"


def sub(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"ANCHOR FAIL {label}: found {n} copies of {old[:70]!r}")
    return text.replace(old, new)


def read(p):
    return (BASE / p).read_text()


def write(rel, text):
    p = SRC / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
    print("wrote", p.relative_to(HERE))


# ---------------------------------------------------------------- index
t = read("index.html")
t = sub(t, 'src="./app-268.js?v=gen-pkg-1"', 'src="./app-269.js?v=gen-fix-1"', "index entry pointer")
t = sub(t, 'href="./styles-155.css?v=gen-pkg-1"', 'href="./styles-156.css?v=gen-fix-1"', "index styles pointer")
# NOTE: the inline crash notice's stale "build
# d5b-v2-playback-client-15" string is inherited verbatim from
# the published gen-pkg-1 index (a pre-existing wart); it is NOT
# part of this correction and is left untouched, as gen-pkg-1
# left ui-pkg-4's.
write("index-genfix1.html", t)

# ---------------------------------------------------------------- constants
t = read("modules/constants-genpkg1.js")
old_header = """// GEN-PKG-1 candidate constants. Byte-identical to the UI4
// candidate constants except the build/bundle/cache identities
// below: the gen-pkg-1 candidate is separately named and
// versioned so no live path of the accepted ui-pkg-4 release is
// overwritten. The build marker ADVANCES to
// d5b-v2-generation-client-2: gen-pkg-1 changes behaviour (the
// generation surface goes live). The -2 distinguishes this build
// from the WS-4 d5b-v2-generation-client-1 candidate, which was
// built on the superseded ui-pkg-3 base and never published.
// (d5b-v2-generation-client-1's app-267.js is a DIFFERENT file
// from ui-pkg-4's app-267.js; this build's entry is app-268.js.)"""
new_header = """// GEN-FIX-1 corrective candidate constants. Byte-identical to
// the GEN-PKG-1 candidate constants except the build/bundle/
// cache identities below: the gen-fix-1 candidate is separately
// named and versioned so no live path of the published
// gen-pkg-1 release (Gate 3, main @ 46e853e5) is overwritten.
// The build marker ADVANCES to d5b-v2-generation-client-3:
// gen-fix-1 carries exactly ONE behaviour correction over
// gen-pkg-1 — "halted_unknown" joins TERMINAL_PLAN_STATES in
// modules/generation-surface-genfix1.js, ending the refresh
// loop Julie reported on the published build ("it constantly
// refreshes", Oct 30 2026; diagnosis board 6530278010; build
// authorized board 6530302659). This build's entry is
// app-269.js."""
t = sub(t, old_header, new_header, "constants header")
t = sub(t, 'export const CANDIDATE_BUILD_MARKER = "d5b-v2-generation-client-2";',
        'export const CANDIDATE_BUILD_MARKER = "d5b-v2-generation-client-3";', "build marker")
t = sub(t, 'export const CANDIDATE_BUNDLE_NAME = "app-268.js";',
        'export const CANDIDATE_BUNDLE_NAME = "app-269.js";', "bundle name")
t = sub(t, 'export const CANDIDATE_STYLES_NAME = "styles-155.css";',
        'export const CANDIDATE_STYLES_NAME = "styles-156.css";', "styles name")
t = sub(t, 'export const CANDIDATE_CACHE_NAME = "opalreader-shell-genpkg1";',
        'export const CANDIDATE_CACHE_NAME = "opalreader-shell-genfix1";', "cache name")
write("modules/constants-genfix1.js", t)

# ---------------------------------------------------------------- entry
t = read("modules/entry-genpkg1.js")
old_header = """// GEN-PKG-1 candidate entry: the ui-pkg-4 entry with its
// composition/runnable/constants pointers advanced to the
// genpkg1 successors, PLUS the generation-surface exports
// (createGenerationClient + the plain-language renderers) the
// shell's live generation surface consumes. Local/review only
// until separately authorized publication."""
new_header = """// GEN-FIX-1 corrective candidate entry: the gen-pkg-1 entry
// with its composition/runnable/constants pointers advanced to
// the genfix1 successors, PLUS the generation-surface exports
// re-pointed at generation-surface-genfix1.js (the corrected
// module). Local/review only until separately authorized
// publication."""
t = sub(t, old_header, new_header, "entry header")
t = sub(t, 'from "./composition-genpkg1.js"', 'from "./composition-genfix1.js"', "entry composition")
t = sub(t, 'from "./runnable-genpkg1.js"', 'from "./runnable-genfix1.js"', "entry runnable")
t = sub(t, 'from "./constants-genpkg1.js"', 'from "./constants-genfix1.js"', "entry constants")
t = sub(t, 'from "./generation-surface.js"', 'from "./generation-surface-genfix1.js"', "entry generation-surface")
write("modules/entry-genfix1.js", t)

# ---------------------------------------------------------------- composition
t = read("modules/composition-genpkg1.js")
old_header = """// GEN-PKG-1: composition-ui4.js with ONLY the constants pointer
// advanced to constants-genpkg1.js, so every marker this
// composition reports (Diagnostics included) is THIS build's
// — no marker split between shell and composition. The store
// wiring (assembled-client-ui4) is reused unchanged."""
new_header = """// GEN-FIX-1: composition-genpkg1.js with ONLY the constants
// pointer advanced to constants-genfix1.js, so every marker
// this composition reports (Diagnostics included) is THIS
// build's — no marker split between shell and composition.
// The store wiring (assembled-client-ui4) is reused unchanged."""
t = sub(t, old_header, new_header, "composition header")
t = sub(t, 'from "./constants-genpkg1.js"', 'from "./constants-genfix1.js"', "composition constants")
write("modules/composition-genfix1.js", t)

# ---------------------------------------------------------------- runnable
t = read("modules/runnable-genpkg1.js")
old_header = """// GEN-PKG-1: runnable-ui4.js with ONLY the composition pointer
// advanced to composition-genpkg1.js. Behaviour unchanged."""
new_header = """// GEN-FIX-1: runnable-genpkg1.js with ONLY the composition
// pointer advanced to composition-genfix1.js. Behaviour
// unchanged."""
t = sub(t, old_header, new_header, "runnable header")
t = sub(t, 'from "./composition-genpkg1.js"', 'from "./composition-genfix1.js"', "runnable composition")
write("modules/runnable-genfix1.js", t)

# ---------------------------------------------------------------- generation-surface (THE FIX)
t = read("modules/generation-surface.js")
old_header = """// gen-pkg-1 — the generation surface's client logic (DESIGN BRIEF
// v2 §2/§4/§5). Authored for gen-pkg-1; imported by app-268.js and
// by entry-genpkg1.js."""
new_header = """// gen-fix-1 — the generation surface's client logic (DESIGN BRIEF
// v2 §2/§4/§5). Authored for gen-pkg-1; imported by app-268.js and
// by entry-genpkg1.js. This genfix1 successor is imported by
// app-269.js via entry-genfix1.js; its ONLY behaviour delta from
// the gen-pkg-1 module is the TERMINAL_PLAN_STATES correction
// documented at the set itself."""
t = sub(t, old_header, new_header, "generation-surface header")
old_set = """export const TERMINAL_PLAN_STATES = Object.freeze(
  ["complete", "partial", "failed", "cancelled", "superseded", "retired"]);"""
new_set = """export const TERMINAL_PLAN_STATES = Object.freeze(
  ["complete", "partial", "failed", "cancelled", "superseded", "retired", "halted_unknown"]);"""
t = sub(t, old_set, new_set, "THE FIX: halted_unknown joins TERMINAL_PLAN_STATES")
old_note = """// "retired" joined the terminal set in round 3 (R3-2): it is
// the server state an operator-cleared halted_unknown plan ends
// in. Without it here, the shell's live-plan detection would
// treat a retired plan as still live and keep rerouting its
// book's Generate action to the Generation view forever."""
new_note = """// "retired" joined the terminal set in round 3 (R3-2): it is
// the server state an operator-cleared halted_unknown plan ends
// in. Without it here, the shell's live-plan detection would
// treat a retired plan as still live and keep rerouting its
// book's Generate action to the Generation view forever.
//
// "halted_unknown" joins in gen-fix-1 (Oct 30 2026): a halted
// plan cannot advance on its own either — no driver selects it
// (round 4, R4-1) and its only exits are operator reconcile and
// retire — but gen-pkg-1 left it OUT of this set, so the shell
// treated Forever Pucked's halted Ch 2 plan as live: the book
// screen re-rendered itself every 15 seconds and the
// Generation view refreshed every 5 seconds, indefinitely
// (Julie's device report: "it constantly refreshes"; diagnosis
// Roundtable board 6530278010). Classifying it terminal stops
// both polls. The plan still RENDERS — planStatusText and
// planMoneyText carry dedicated halted_unknown cases and no
// list filters on this set — and the server's own fence
// (PLAN_FENCE_TERMINAL, worker-side) is unchanged and remains
// the authority that refuses overlapping submissions: a sheet
// opened on a halted plan's exact scope in a server-enabled
// state now reaches the server's quote and, on Start, the
// server's plan_overlap_conflict refusal in plain words
// (identical-intent resubmission converges on the halted plan
// server-side), instead of the client-side reroute. While the
// server reports generation halted, the sheet stops at the
// capabilities gate before any of this is consulted."""
t = sub(t, old_note, new_note, "terminal-set comment")
write("modules/generation-surface-genfix1.js", t)

# ---------------------------------------------------------------- service worker
t = read("sw-genpkg1.js")
old_header = """// GEN-PKG-1 service worker: sw-ui4.js with the cache advanced to
// opalreader-shell-genpkg1 and the SHELL closure advanced to the
// genpkg1 identities (app-268.js, styles-155.css, the *-genpkg1
// modules, and the new modules/generation-surface.js). The"""
new_header = """// GEN-FIX-1 service worker: sw-genpkg1.js with the cache
// advanced to opalreader-shell-genfix1 and the SHELL closure
// advanced to the genfix1 identities (app-269.js,
// styles-156.css, the *-genfix1 modules, and
// modules/generation-surface-genfix1.js). The"""
t = sub(t, old_header, new_header, "sw header")
t = sub(t, 'const CACHE = "opalreader-shell-genpkg1";',
        'const CACHE = "opalreader-shell-genfix1";', "sw cache")
for old, new in [
    ('"./app-268.js",', '"./app-269.js",'),
    ('"./styles-155.css",', '"./styles-156.css",'),
    ('"./modules/composition-genpkg1.js",', '"./modules/composition-genfix1.js",'),
    ('"./modules/constants-genpkg1.js",', '"./modules/constants-genfix1.js",'),
    ('"./modules/entry-genpkg1.js",', '"./modules/entry-genfix1.js",'),
    ('"./modules/runnable-genpkg1.js",', '"./modules/runnable-genfix1.js",'),
    ('"./modules/generation-surface.js",', '"./modules/generation-surface-genfix1.js",'),
]:
    t = sub(t, old, new, f"sw shell {old}")
write("sw-genfix1.js", t)

# ---------------------------------------------------------------- app-269.js
t = read("app-268.js")
t = sub(t, "// Opal Reader v2 — UI1 pretty shell, GEN-PKG-1 candidate package (app-268.js).",
        "// Opal Reader v2 — UI1 pretty shell, GEN-FIX-1 corrective candidate package (app-269.js).",
        "app line-1 header")
fix_para = """// GEN-FIX-1 CORRECTIVE CANDIDATE (gen-fix-1, Oct 30 2026):
// this entry is app-268.js (gen-pkg-1, published at Gate 3,
// main @ 46e853e5) with its packaging identity advanced
// (packaging marker gen-fix-1, service worker sw-genfix1.js /
// cache opalreader-shell-genfix1, build marker
// d5b-v2-generation-client-3 via constants-genfix1.js) and ONE
// behaviour correction, carried entirely in
// modules/generation-surface-genfix1.js: "halted_unknown"
// joins TERMINAL_PLAN_STATES. A halted plan cannot advance on
// its own (its only exits are operator reconcile, then
// retire), but the gen-pkg-1 client classified it as live, so
// a book screen listing one re-rendered itself every 15
// seconds forever and the Generation view refreshed every 5
// seconds forever — Julie's device report on the published
// build, Oct 30 2026: "it constantly refreshes." Diagnosis
// filed on the Roundtable board at 6530278010; correction
// build authorized by Julie at 6530302659. Nothing else
// changes: the halted plan still renders with its
// plain-language stop text, and the server-side plan fence is
// untouched and remains the authority on overlapping
// submissions. The GEN-PKG-1 block below is this file's
// lineage, kept verbatim.
//
// GEN-PKG-1 CANDIDATE (gen-pkg-1, Oct 29 2026): this entry is"""
t = sub(t, "// GEN-PKG-1 CANDIDATE (gen-pkg-1, Oct 29 2026): this entry is", fix_para, "app fix paragraph")
t = sub(t, 'from "./modules/entry-genpkg1.js"', 'from "./modules/entry-genfix1.js"', "app entry import")
t = sub(t, 'from "./modules/constants-genpkg1.js"', 'from "./modules/constants-genfix1.js"', "app constants import")
t = sub(t, 'const PACKAGING_MARKER = "gen-pkg-1";', 'const PACKAGING_MARKER = "gen-fix-1";', "app packaging marker")
t = sub(t, 'navigator.serviceWorker.register("./sw-genpkg1.js")',
        'navigator.serviceWorker.register("./sw-genfix1.js")', "app sw register")
write("app-269.js", t)

# ---------------------------------------------------------------- styles
t = read("styles-155.css")
t += ("\n/* gen-fix-1 (Oct 30 2026): identity-only advance from "
      "styles-155.css; no rule changes. The gen-fix-1 correction "
      "is entirely in modules/generation-surface-genfix1.js "
      "(TERMINAL_PLAN_STATES). */\n")
write("styles-156.css", t)

print("make-src: OK")
