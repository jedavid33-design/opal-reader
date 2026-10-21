#!/usr/bin/env python3
"""P1 audio byte pass for Opal Reader v2 migration verification (Rowan
correction 4: verified existence != verified correctness).

For every UNIQUE bound audio object in the snapshot:
  - downloads the object (read-only GET), recording size + sha256 prefix
  - sniffs the real format from magic bytes (never trusts the extension)
  - computes duration: WAV exactly from the data chunk; MP3 by walking
    MPEG frames and summing samples (Xing header used as a cross-check)
  - plausibility: spoken chars/second vs the bound segment's text length
    (band 6..30 chars/s; outliers listed for manual review, never failed
    silently and never auto-passed)

Resumable: results append to audio-results.jsonl; rerunning skips keys
already recorded. Book text is used only to compute lengths locally.
"""
import concurrent.futures as futures
import hashlib
import json
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cf  # noqa: E402

DATA = os.path.expanduser("~/workspace/opal-reader-p1-data")
RESULTS = os.path.join(DATA, "audio-results.jsonl")

# ---------- format parsing ----------

BITRATES_V1_L3 = [None, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, None]
BITRATES_V2_L3 = [None, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, None]
SAMPLE_RATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}


def mp3_duration(data):
    """Walk MPEG Layer III frames; return (seconds, frames, method)."""
    pos = 0
    if data[:3] == b"ID3":
        size = 0
        for b in data[6:10]:
            size = (size << 7) | (b & 0x7F)
        pos = 10 + size
    frames, total_samples, rate_seen, xing_frames = 0, 0, None, None
    n = len(data)
    while pos + 4 <= n:
        hdr = struct.unpack(">I", data[pos:pos + 4])[0]
        if (hdr >> 21) & 0x7FF != 0x7FF:
            nxt = data.find(b"\xff", pos + 1)
            if nxt < 0:
                break
            pos = nxt
            continue
        version = (hdr >> 19) & 0x3
        layer = (hdr >> 17) & 0x3
        if version == 1 or layer != 1:  # reserved version / not Layer III
            pos += 1
            continue
        br_idx = (hdr >> 12) & 0xF
        sr_idx = (hdr >> 10) & 0x3
        padding = (hdr >> 9) & 0x1
        if br_idx in (0, 15) or sr_idx == 3:
            pos += 1
            continue
        bitrate = (BITRATES_V1_L3 if version == 3 else BITRATES_V2_L3)[br_idx]
        rate = SAMPLE_RATES[version][sr_idx]
        if version == 3:
            flen = (144 * bitrate * 1000) // rate + padding
            spf = 1152
        else:
            flen = (72 * bitrate * 1000) // rate + padding
            spf = 576
        if flen < 4 or pos + flen > n + 4:
            break
        if frames == 0:
            rate_seen = rate
            # Xing/Info header sits inside the first frame
            side = 17 if version == 3 else 9  # mono offsets differ; scan both
            for off in (side, 32, 17, 9):
                p = pos + 4 + off
                if data[p:p + 4] in (b"Xing", b"Info") and p + 12 <= n:
                    flags = struct.unpack(">I", data[p + 4:p + 8])[0]
                    if flags & 0x1:
                        xing_frames = struct.unpack(">I", data[p + 8:p + 12])[0]
                    break
        frames += 1
        total_samples += spf
        pos += flen
    if frames == 0 or not rate_seen:
        return None, 0, "unparsed"
    secs = total_samples / rate_seen
    method = "frame-walk"
    if xing_frames:
        xing_secs = xing_frames * (1152 if version == 3 else 576) / rate_seen
        if abs(xing_secs - secs) / max(secs, 0.01) < 0.05:
            method = "frame-walk+xing-agree"
    return secs, frames, method


def wav_duration(data):
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return None
    pos, byte_rate, data_size = 12, None, None
    while pos + 8 <= len(data):
        cid = data[pos:pos + 4]
        size = struct.unpack("<I", data[pos + 4:pos + 8])[0]
        if cid == b"fmt ":
            byte_rate = struct.unpack("<I", data[pos + 16:pos + 20])[0]
        elif cid == b"data":
            data_size = size
            break
        pos += 8 + size + (size & 1)
    if byte_rate and data_size:
        return data_size / byte_rate
    return None


def sniff(data):
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "wav"
    if data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
        return "mp3"
    if data[:4] == b"OggS":
        return "ogg"
    if data[4:8] == b"ftyp":
        return "m4a"
    return "unknown"


# ---------- pass driver ----------

def bound_segments():
    """audioKey -> list of (book title, chapter, index, text length)."""
    out = {}
    books_dir = os.path.join(DATA, "books")
    for name in sorted(os.listdir(books_dir)):
        with open(os.path.join(books_dir, name)) as f:
            book = json.load(f)
        for ci, ch in enumerate(book.get("chapters", [])):
            for si, s in enumerate(ch.get("segments", [])):
                key = s.get("audioKey")
                if key:
                    text = re.sub(r"</?emphasis>", "", s.get("speechText") or s.get("text") or "")
                    out.setdefault(key, []).append(
                        {"book": book.get("title"), "chapter": ci + 1,
                         "index": si, "chars": len(text),
                         "stale_flag": bool(s.get("audioStale")),
                         "fingerprinted": bool(s.get("generationFingerprint"))})
    return out


EXTENSIONS = {}  # audioKey -> "mp3"/"wav", from one listing pass


def verify_one(item):
    key, uses = item
    result = {"key": key, "uses": uses}
    raw = None
    known = EXTENSIONS.get(key)
    for ext in ([known] if known else ["mp3", "wav"]):
        raw, _ = cf.r2_get(f"audio/{key}.{ext}")
        if raw is not None:
            result["ext"] = ext
            break
    if raw is None:
        result["error"] = "object missing for both extensions"
        return result
    result["bytes"] = len(raw)
    result["sha256"] = hashlib.sha256(raw).hexdigest()[:16]
    fmt = sniff(raw)
    result["format"] = fmt
    if fmt == "mp3":
        secs, frames, method = mp3_duration(raw)
        result["duration_s"] = round(secs, 2) if secs else None
        result["frames"] = frames
        result["duration_method"] = method
    elif fmt == "wav":
        secs = wav_duration(raw)
        result["duration_s"] = round(secs, 2) if secs else None
        result["duration_method"] = "wav-header"
    chars = max(u["chars"] for u in uses)
    if result.get("duration_s"):
        cps = chars / result["duration_s"]
        result["chars_per_s"] = round(cps, 1)
        result["plausible"] = 6.0 <= cps <= 30.0
    else:
        result["plausible"] = False
    return result


def main():
    for o in cf.r2_list("audio/"):
        name = o["key"].split("/")[-1]
        if "." in name:
            k, ext = name.rsplit(".", 1)
            EXTENSIONS[k] = ext
    print(f"listing: {len(EXTENSIONS)} audio objects", flush=True)
    bound = bound_segments()
    done = set()
    if os.path.exists(RESULTS):
        with open(RESULTS) as f:
            for line in f:
                try:
                    done.add(json.loads(line)["key"])
                except Exception:
                    pass
    todo = [(k, v) for k, v in bound.items() if k not in done]
    print(f"unique bound objects: {len(bound)}; already done: {len(done)}; "
          f"to fetch: {len(todo)}", flush=True)
    with open(RESULTS, "a") as out:
        with futures.ThreadPoolExecutor(max_workers=6) as ex:
            futs = {ex.submit(verify_one, item): item[0] for item in todo}
            n = 0
            for fut in futures.as_completed(futs):
                try:
                    res = fut.result()
                except Exception as e:  # keep the row; classify later
                    res = {"key": futs[fut], "error": f"exception: {e}"}
                out.write(json.dumps(res) + "\n")
                out.flush()
                n += 1
                if n % 100 == 0:
                    print(f"  {n}/{len(todo)}", flush=True)
    print("audio pass complete", flush=True)


if __name__ == "__main__":
    main()
