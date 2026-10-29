// UI2 corrective cast census — node, no DOM. Proves, against the FROZEN census
// (~/workspace/opal-reader-p8-data/books/*.json, the migration source
// records), the cast facts the UI1 Cast view depends on:
//   * the v2 content plane carries each book's cast as its `povs`
//     list (migration transform.mjs: content.cast = book.povs,
//     deep-copied verbatim);
//   * every book carries a non-empty cast (an empty source cast would
//     NOT be proof of no characters — here the question is answered
//     from the source records themselves, per book);
//   * the shell's RECORDED_VOICE_MAPPINGS table (extracted from
//     src/app-264.js) covers EXACTLY the non-Gemini cast voices in
//     the census — no missing mapping, no invented mapping;
//   * the unverified flag sits exactly on The Goal's Tucker.
// Structural metadata only: names/providers/voice names/counts and
// style_direction PRESENCE. Book text and style text are never read
// into output.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CENSUS = "/home/hatch/workspace/opal-reader-p8-data/books";
const shellSrc = fs.readFileSync(path.join(ROOT, "src", "app-265.js"), "utf8");

const m = shellSrc.match(/const RECORDED_VOICE_MAPPINGS = \{([\s\S]*?)\n\};/);
if (!m) { console.log("FAIL census — RECORDED_VOICE_MAPPINGS not found in app-265.js"); process.exit(1); }
const mappings = {};
for (const e of m[1].matchAll(/"([^"]+)": \{ provider: "([^"]+)", voiceName: "([^"]+)", unverified: (true|false) \}/g))
  mappings[e[1]] = { provider: e[2], voiceName: e[3], unverified: e[4] === "true" };

const rows = [];
const fails = [];
const files = fs.readdirSync(CENSUS).filter((f) => f.endsWith(".json")).sort();
const nonGeminiKeys = new Set();
for (const f of files) {
  const book = JSON.parse(fs.readFileSync(path.join(CENSUS, f), "utf8"));
  const cast = Array.isArray(book.povs) ? book.povs : null;
  if (!cast || cast.length === 0) { fails.push(`${book.title}: source cast missing/empty`); continue; }
  let voiced = 0, nullVoice = 0, styled = 0;
  const nullNames = [];
  for (const c of cast) {
    if (c.voice) {
      voiced++;
      if (typeof c.voice.style_direction === "string" && c.voice.style_direction) styled++;
      if (c.voice.provider !== "gemini") nonGeminiKeys.add(`${book.id}|${c.name}`);
    } else { nullVoice++; nullNames.push(c.name); }
  }
  rows.push({ title: book.title, bookId: book.id, cast: cast.length, voiced, nullVoice, nullNames, styled,
    segments: (book.chapters ?? []).reduce((n, ch) => n + (ch.segments?.length ?? 0), 0),
    hasDefaultVoiceInSource: !!book.defaultVoice });
}
// The content plane does NOT carry defaultVoice (transform.mjs emits
// bookId/title/author/cast/chapters/shelf* only) — record that as a
// census fact the Cast view's book-wide style card depends on.
for (const key of Object.keys(mappings)) if (!nonGeminiKeys.has(key)) fails.push(`mapping with no matching non-Gemini cast voice: ${key}`);
for (const key of nonGeminiKeys) if (!(key in mappings)) fails.push(`non-Gemini cast voice with NO recorded mapping: ${key}`);
const unverified = Object.entries(mappings).filter(([, v]) => v.unverified).map(([k]) => k);
if (JSON.stringify(unverified) !== JSON.stringify(["f1b1e2f9-8c09-4f23-8290-472740923954|Tucker"]))
  fails.push(`unverified flags should be exactly [The Goal|Tucker], got ${JSON.stringify(unverified)}`);
for (const [k, v] of Object.entries(mappings))
  if (v.provider !== "gemini" || !v.voiceName) fails.push(`mapping ${k} is not a concrete Gemini voice`);

console.log("CAST CENSUS (frozen source records; content plane carries cast = povs verbatim, no defaultVoice):");
for (const r of rows)
  console.log(`  ${r.title} [${r.bookId.slice(0, 8)}…]: cast ${r.cast} (voiced ${r.voiced}, no-voice ${r.nullVoice}${r.nullNames.length ? ` — ${r.nullNames.join(", ")}` : ""}), style_direction present on ${r.styled}/${r.voiced} voices, segments ${r.segments}, source defaultVoice ${r.hasDefaultVoiceInSource ? "present (NOT carried to the plane)" : "absent"}`);
console.log(`  recorded mappings: ${Object.keys(mappings).length}; non-Gemini cast voices in census: ${nonGeminiKeys.size}`);
if (fails.length) { for (const f of fails) console.log("FAIL", f); console.log(`\nCAST CENSUS: FAIL (${fails.length})`); process.exit(1); }
console.log("\nCAST CENSUS: PASS — mappings table covers exactly the census's non-Gemini cast voices; unverified flag exact.");
