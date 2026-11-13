"""Build a byte-preserving, deduplicated static-resource package."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import shutil

HOME = Path(__file__).resolve().parents[1]


def site_files(root):
    return sorted([root / name for name in ("index.html", "404.html")] + [p for name in ("static", "public") for p in (root / name).rglob("*") if p.is_file()])


def fingerprint(root, path):
    before = path.stat()
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError(f"Source changed during build: {path}")
    return {"path": path.relative_to(root).as_posix(), "sha256": digest, "bytes": after.st_size, "mtime_ns": after.st_mtime_ns}


def build(root, output, workers=4):
    root, output = root.resolve(), output.resolve()
    if not output.is_relative_to(root / "dist"):
        raise ValueError("Choose a new directory under this website's dist/ folder")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output must be empty; existing packages are never overwritten")
    output.mkdir(parents=True, exist_ok=True)
    paths = site_files(root)
    print(f"Hashing {len(paths)} files without changing their content...", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        entries = list(pool.map(lambda p: fingerprint(root, p), paths))
    representatives = {}
    for entry in entries:
        representatives.setdefault(entry["sha256"], entry)
    print(f"Encoding {len(representatives)} unique resources...", flush=True)

    def encode(pair):
        digest, entry = pair
        raw = (root / entry["path"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise RuntimeError("Source changed during encoding: " + entry["path"])
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        encoding = "gzip" if len(compressed) + 32 < len(raw) else "identity"
        body = compressed if encoding == "gzip" else raw
        target = output / "blobs" / digest[:2] / digest
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        return digest, {"bytes": len(raw), "stored_bytes": len(body), "encoding": encoding}

    with ThreadPoolExecutor(max_workers=workers) as pool:
        blobs = dict(pool.map(encode, representatives.items()))
    manifest = {"version": 1, "routes": {entry["path"]: entry["sha256"] for entry in entries}, "blobs": blobs}
    manifest_bytes = json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    (output / "routes.json.gz").write_bytes(gzip.compress(manifest_bytes, compresslevel=9, mtime=0))
    shutil.copy2(HOME / "tools/serve_compact_site.py", output / "serve.py")
    raw_bytes = sum(entry["bytes"] for entry in entries)
    unique_bytes = sum(entry["bytes"] for entry in representatives.values())
    stored_bytes = sum(p.stat().st_size for p in output.rglob("*") if p.is_file())
    report = {"source_files": len(entries), "unique_resources": len(blobs), "source_bytes": raw_bytes, "unique_original_bytes": unique_bytes, "package_bytes": stored_bytes, "duplicate_bytes_removed": raw_bytes - unique_bytes, "lossless_compression_bytes_saved": unique_bytes - sum(b["stored_bytes"] for b in blobs.values()), "unchanged": ["resource URLs", "HTML/CSS/JavaScript response bytes", "all App data and fixtures", "all replay frames and original images"]}
    (output / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Source {raw_bytes / 1024**3:.2f} GiB -> compact package {stored_bytes / 1024**3:.2f} GiB ({100 * (1 - stored_bytes / raw_bytes):.1f}% smaller)", flush=True)
    print(f"Package: {output}\nPreview: python \"{output / 'serve.py'}\" --port 8912", flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HOME / "dist/compact-site")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 8:
        parser.error("Choose between 1 and 8 workers")
    build(HOME, args.output, args.workers)
