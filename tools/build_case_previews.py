"""Build lightweight replay images while preserving every archived original."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OPTIONS = {"desktop_width": 1600, "portrait_width": 720, "quality": 86, "method": 4}


def build_previews(data=None):
    data_path = ROOT / "static/data/case-studies.json"
    if data is None:
        data = json.loads(data_path.read_text(encoding="utf-8"))
    manifest_path = ROOT / "tools/case-study-previews.json"
    previous = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    cached = {a["original"]: a for a in previous.get("assets", [])} if previous.get("options") == OPTIONS else {}
    shots = {}
    for case in data["cases"]:
        for shot in [case["finalScreenshot"]] + [s[key] for s in case["steps"] for key in ("before", "after")]:
            shots[shot["src"]] = shot

    def convert(entry):
        src, shot = entry
        source = ROOT / src
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        old = cached.get(src)
        if old and old["sourceSha256"] == source_hash and (ROOT / old["src"]).is_file():
            if hashlib.sha256((ROOT / old["src"]).read_bytes()).hexdigest() == old["sha256"]:
                return old
        target = ROOT / "public/case-previews" / source.parent.name / (source.stem + ".webp")
        target.parent.mkdir(parents=True, exist_ok=True)
        max_width = OPTIONS["portrait_width"] if shot["height"] > shot["width"] else OPTIONS["desktop_width"]
        with Image.open(source) as original:
            image = original.convert("RGB")
            width = min(image.width, max_width)
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=OPTIONS["quality"], method=OPTIONS["method"])
        return {"original": src, "sourceSha256": source_hash, "src": target.relative_to(ROOT).as_posix(), "width": width, "height": height, "bytes": target.stat().st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}

    with ThreadPoolExecutor(max_workers=4) as pool:
        assets = list(pool.map(convert, shots.items()))
    previews = {a["original"]: {key: a[key] for key in ("src", "width", "height")} for a in assets}
    for case in data["cases"]:
        for shot in [case["finalScreenshot"]] + [s[key] for s in case["steps"] for key in ("before", "after")]:
            shot["preview"] = previews[shot["src"]]
    staged_data_path = data_path.with_suffix(".json.tmp")
    staged_data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    staged_data_path.replace(data_path)
    manifest_path.write_text(json.dumps({"options": OPTIONS, "assets": assets}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    original_bytes = sum((ROOT / src).stat().st_size for src in shots)
    preview_bytes = sum(a["bytes"] for a in assets)
    print(f"Built {len(assets)} replay previews: {preview_bytes / 1024**2:.1f} MiB vs {original_bytes / 1024**2:.1f} MiB originals ({100 * (1 - preview_bytes / original_bytes):.1f}% smaller). Originals unchanged.", flush=True)


if __name__ == "__main__":
    build_previews()
