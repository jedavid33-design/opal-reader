# UI3 (ui-pkg-3) — packaging evidence: independent re-verification

Performed Oct 29, 2026, under Julie's PACKAGING Go (board issue #15, comment 6499419871), after Rowan's source/correction review closed PASS (comment 6499354696). Packaging only — nothing published.

## Base / main recheck (read-only)

- `GET /repos/jedavid33-design/opal-reader/git/ref/heads/main` → `b83a6d99b8e3428b462fd328a65cfeab484761ab` — **still equals the candidate's ui-pkg-2 base. PASS.**
- Review branch `ui1-review` head at pin time: `d1d737bfb09f5957b0be68d4084752be3666dba3` (the C-1 corrected artifact commit), used as this evidence commit's parent.

## Independent package re-verification (recomputed, not transcribed)

1. **File hashes:** all **63/63** publish-tree files' SHA-256 recomputed and compared against PACKAGE-MANIFEST.json — **all match, no extra files. PASS.**
2. **Publish digest:** recomputed from the manifest file map (SHA-256 of the sorted `path sha256` lines, trailing newline) = `86719a0f3b7f84b74aa9aaee65f477cf503ec8b6c7e15ae0efd8241f79622dc1` — **equals the manifest's recorded digest. PASS.**
3. **Delta classification vs the ui-pkg-2 base tree** (~/workspace/ui2-fix-build/package/publish): exactly **8** paths differ or are new — `app-266.js`, `index.html`, `modules/composition-ui3.js`, `modules/constants-ui3.js`, `modules/entry-ui3.js`, `modules/runnable-ui3.js`, `styles-153.css`, `sw-ui3.js` — identical to the manifest's declared delta; the other **55** paths are byte-identical to base. **PASS.**
4. **index.html diff vs base: exactly 3 lines** (18 lines both sides): the line carrying the app pointer (`app-266.js?v=ui-pkg-3`, exactly 1 occurrence), the stylesheet pointer line (`styles-153.css?v=ui-pkg-3`), and the startup-notice line (`(build d5b-v2-playback-client-14)`, exactly 1 occurrence). **PASS.**
5. **styles-153.css** begins with the exact bytes of base styles-152.css plus **1,013 appended bytes** (the W-5 corrective section) — pure addition. **PASS.**
6. **Pinned hashes inside the package:** client store `modules/vendor/client-store-ui1.js` = `778d4c3367b5f9b65b738ab48ac8c9cfcfce4bb514acb927defc1df0c013e3ad` (byte-identical to the accepted store); frozen Shelf bridge = `bc0a5879fbf4a6f455170ead8e0fbe1aa19d82126df4eb631bd0ebad9112ec8e`; corrected composition-ui3.js = `a1d81ff739639fa6a6839649bd7a39d18e54e1a364621982d8c9bf7bb68f0cf0`. **PASS.**
7. **Package assemble rerun** (`package-assemble.py`, this session; full log = `assemble-rerun.txt` alongside): **exit 0, ALL CHECKS PASS** — including sw-ui3 SHELL == packaged ui3 closure, `PURGE_ON_ACTIVATE == []`, all three rollback SHELLs (ui2/ui1/CORR1) fully resolvable in-tree, all import closures resolving and uncontaminated across generations, markers consistent. The rerun regenerated PACKAGE-MANIFEST.json with the identical digest (`86719a0f…`), confirming manifest stability. **PASS.**

## Candidate identity (unchanged by packaging)

app-266.js · sw-ui3.js · cache `opalreader-shell-ui3` · styles-153.css · build `d5b-v2-playback-client-14` · packaging `ui-pkg-3` · publish tree 63 paths · delta 8 paths · digest `86719a0f…`.

Publishing remains a separate, un-authorized gate (Julie's publish/window Go + the attended device verification: play Forever Pucked Ch 1 Seg 2 and watch the chapter pill advance 0/27 → 1/27; Settings quota row stacked; iPad spot check).
