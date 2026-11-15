"""Make a separate compact package with quality-checked, full-size replay WebP images.

The original website and lossless package are never modified. Existing playback
previews, App files, icons and task records remain byte-identical.
"""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import math
import os
import shutil

from PIL import Image, ImageChops, ImageStat

HOME = Path(__file__).resolve().parents[1]
OLD_NOTE = 'Playback uses lightweight previews; unmodified originals are available through “Open screenshot”.'
NEW_NOTE = 'Playback uses lightweight previews; “Open screenshot” provides full-resolution images with high-quality compression where beneficial. The source archive retains the originals.'


def finalize_publication_note(output):
    """Keep the published screenshot description truthful without altering source HTML."""
    manifest = json.loads(gzip.decompress((output / "routes.json.gz").read_bytes()))
    old_digest = manifest["routes"]["index.html"]
    meta = manifest["blobs"][old_digest]
    stored = (output / "blobs" / old_digest[:2] / old_digest).read_bytes()
    raw = gzip.decompress(stored) if meta["encoding"] == "gzip" else stored
    html = raw.decode("utf-8")
    assert OLD_NOTE in html or NEW_NOTE in html
    raw = html.replace(OLD_NOTE, NEW_NOTE).encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    body = gzip.compress(raw, compresslevel=9, mtime=0)
    target = output / "blobs" / digest[:2] / digest
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    manifest["routes"]["index.html"] = digest
    manifest["blobs"][digest] = {"bytes": len(raw), "stored_bytes": len(body), "encoding": "gzip"}
    used = set(manifest["routes"].values())
    manifest["blobs"] = {key: value for key, value in manifest["blobs"].items() if key in used}
    (output / "routes.json.gz").write_bytes(gzip.compress(json.dumps(manifest, separators=(",", ":")).encode(), mtime=0))
    report = json.loads((output / "compression-report.json").read_text(encoding="utf-8"))
    report["unchanged"] = [item for item in report["unchanged"] if item != "website HTML/CSS/JS"]
    report["unchanged"].append("website CSS/JS and layout")
    report["publicationNoteUpdated"] = True
    report["packageBytes"] = sum(p.stat().st_size for p in output.rglob("*") if p.is_file())
    (output / "compression-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def psnr(a, b):
    difference = ImageChops.difference(a.convert("RGB"), b.convert("RGB"))
    mse = sum(ImageStat.Stat(difference).sum2) / (a.width * a.height * 3)
    return 99.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def build(output, workers):
    source = HOME / "dist/compact-site"
    output = output.resolve()
    if not output.is_relative_to(HOME / "dist") or output == source:
        raise ValueError("Choose a new output under dist/")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Existing output is never overwritten")
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(gzip.decompress((source / "routes.json.gz").read_bytes()))
    routes, blobs = manifest["routes"], manifest["blobs"]
    initial_size = sum(p.stat().st_size for p in source.rglob("*") if p.is_file())
    data = json.loads((HOME / "static/data/case-studies.json").read_text(encoding="utf-8"))
    shots = {shot["src"]: shot for case in data["cases"] for shot in
             [case["finalScreenshot"]] + [s[k] for s in case["steps"] for k in ("before", "after")]}
    assets = {}
    for src in shots:
        assets.setdefault(routes[src], src)

    def encode(pair):
        digest, src = pair
        raw = (HOME / src).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise RuntimeError("Source changed: " + src)
        with Image.open(BytesIO(raw)) as original:
            image = original.convert("RGB")
            best, score, selected = raw, 99.0, "original"
            for quality in (94, 98):
                buffer = BytesIO()
                image.save(buffer, "WEBP", quality=quality, method=2,
                           **({"icc_profile": original.info["icc_profile"]} if original.info.get("icc_profile") else {}))
                candidate = buffer.getvalue()
                with Image.open(BytesIO(candidate)) as decoded:
                    score_candidate = psnr(image, decoded)
                if score_candidate >= 36:
                    if len(candidate) < len(best):
                        best, score, selected = candidate, score_candidate, quality
                    break
            # Preserve screenshots which WebP cannot represent closely enough.
            if selected == "original":
                return digest, {"source": src, "sourceSha256": digest, "sha256": digest,
                                "originalBytes": len(raw), "bytes": len(raw), "quality": selected,
                                "psnr": 99.0, "width": image.width, "height": image.height}
            new_digest = hashlib.sha256(best).hexdigest()
            target = output / "blobs" / new_digest[:2] / new_digest
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(best)
            return digest, {"source": src, "sourceSha256": digest, "sha256": new_digest,
                            "originalBytes": len(raw), "bytes": len(best), "quality": selected,
                            "psnr": round(score, 4), "width": image.width, "height": image.height}

    converted = {}
    print(f"Checking {len(assets)} unique full-resolution screenshots (PSNR >= 36 dB, quality 94/98)...", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for index, (digest, entry) in enumerate(pool.map(encode, assets.items()), 1):
            converted[digest] = entry
            if index % 200 == 0:
                print(f"Screenshots {index}/{len(assets)}", flush=True)

    replacements = {}
    for src in shots:
        entry = converted[routes[src]]
        if entry["quality"] == "original":
            continue
        new_src = str(Path(src).with_suffix(".webp")).replace("\\", "/")
        if new_src in routes and routes[new_src] != entry["sha256"]:
            raise RuntimeError("Conflicting WebP path: " + new_src)
        replacements[src] = new_src
        routes[new_src] = entry["sha256"]
        del routes[src]
        blobs[entry["sha256"]] = {"bytes": entry["bytes"], "stored_bytes": entry["bytes"], "encoding": "identity"}
    for case in data["cases"]:
        for shot in [case["finalScreenshot"]] + [s[k] for s in case["steps"] for k in ("before", "after")]:
            shot["src"] = replacements.get(shot["src"], shot["src"])
    data["mediaEncoding"] = {"format": "WebP where beneficial", "resized": False,
                             "minimumPSNR": 36, "previewsChanged": False,
                             "note": "Full-resolution screenshots may use lossy WebP; source result archive retains the originals."}
    raw = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode()
    digest = hashlib.sha256(raw).hexdigest()
    body = gzip.compress(raw, compresslevel=9, mtime=0)
    target = output / "blobs" / digest[:2] / digest
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    routes["static/data/case-studies.json"] = digest
    blobs[digest] = {"bytes": len(raw), "stored_bytes": len(body), "encoding": "gzip"}
    used = set(routes.values())
    manifest["blobs"] = {digest: blobs[digest] for digest in used}
    for digest in used:
        target = output / "blobs" / digest[:2] / digest
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        # Hard links save local disk space. Neither build nor server writes blobs.
        os.link(source / "blobs" / digest[:2] / digest, target)
    (output / "routes.json.gz").write_bytes(gzip.compress(json.dumps(manifest, separators=(",", ":")).encode(), mtime=0))
    shutil.copy2(HOME / "tools/serve_compact_site.py", output / "serve.py")
    report = {"cases": len(data["cases"]), "frames": len(shots), "convertedFrames": len(replacements),
              "uniqueScreenshots": len(assets), "minimumPSNR": min(e["psnr"] for e in converted.values()),
              "originalScreenshotBytes": sum((HOME / src).stat().st_size for src in shots),
              "publishedScreenshotBytes": sum(manifest["blobs"][routes[replacements.get(src, src)]]["bytes"] for src in shots),
              "losslessPackageBytes": initial_size,
              "packageBytes": sum(p.stat().st_size for p in output.rglob("*") if p.is_file()),
              "unchanged": ["all App files and icons", "all existing replay previews", "all cases and recorded steps", "screenshot dimensions", "website HTML/CSS/JS"],
              "hosting": "Requires compact resource server; not a direct GitHub Pages artifact.",
              "assets": list(converted.values()), "pathReplacements": replacements}
    (output / "compression-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    finalize_publication_note(output)
    print(json.dumps({k: v for k, v in report.items() if k not in ("assets", "pathReplacements")}, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HOME / "dist/compact-webp-v2")
    parser.add_argument("--workers", type=int, default=4, choices=range(1, 9))
    args = parser.parse_args()
    build(args.output, args.workers)
