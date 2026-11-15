"""Check every static Pages file against the validated compact package."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse
import gzip
import hashlib
import json

from serve_compact_site import CompactSite

HOME = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=HOME / "dist/pages-ready")
    args = parser.parse_args()
    output = args.directory.resolve()
    report = json.loads((output / "pages-build-report.json").read_text(encoding="utf-8"))
    manifest = json.loads((output / report["manifest"]).read_text(encoding="utf-8"))
    source = CompactSite(report["sourcePackage"])
    main_dir = output / report["projects"][0]["directory"]
    assert set(manifest["routes"]) == set(source.routes)
    physical = set(manifest["physical"])
    assert set(manifest["blobs"]) == {d for p, d in manifest["routes"].items() if p not in physical}
    index_digest = manifest["routes"]["index.html"]

    def verify_blob(pair):
        digest, meta = pair
        shard, compressed, size, stored_size = meta
        path = output / report["projects"][shard + 1]["directory"] / "blobs" / digest[:2] / (digest + ".bin")
        stored = path.read_bytes()
        assert len(stored) == stored_size and stored_size < 100 * 1024**2, str(path)
        raw = gzip.decompress(stored) if compressed else stored
        assert len(raw) == size and hashlib.sha256(raw).hexdigest() == digest, str(path)
        if digest == index_digest:
            original = raw.decode("utf-8").replace(report["mainIndexInjection"], "", 1).encode("utf-8")
            assert original == source.original(source.routes["index.html"])
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(verify_blob, manifest["blobs"].items()))
    for path in physical:
        assert hashlib.sha256((main_dir / path).read_bytes()).hexdigest() == source.routes[path], path
    for path, digest in manifest["routes"].items():
        if path != "index.html":
            assert digest == source.routes[path], path
    for route in ("index.html", "404.html", "public/playground/apps/openbank/index.html"):
        text = (main_dir / route).read_text(encoding="utf-8")
        assert "navigator.serviceWorker.register" in text and "__OSOMNI_" not in text
    worker = (main_dir / "osomni-pages-sw.js").read_text(encoding="utf-8")
    assert "__OSOMNI_" not in worker and manifest["revision"] in worker
    all_files = []
    project_sizes = {}
    for project in report["projects"]:
        directory = output / project["directory"]
        assert (directory / ".nojekyll").is_file()
        files = [p for p in directory.rglob("*") if p.is_file() and ".git" not in p.relative_to(directory).parts]
        total = sum(p.stat().st_size for p in files)
        assert total == project["bytes"] and total < 900 * 1024**2
        assert not any(p.suffix.lower() in (".py", ".env", ".envv") for p in files)
        all_files.extend(files)
        project_sizes[project["directory"]] = round(total / 1024**2, 2)
    cases = json.loads((main_dir / "static/data/case-studies.json").read_text(encoding="utf-8"))["cases"]
    frames = set()
    for case in cases:
        for shot in [case["finalScreenshot"]] + [s[k] for s in case["steps"] for k in ("before", "after")]:
            for path in (shot["src"], shot["preview"]["src"]):
                assert path in manifest["routes"]
            frames.add(shot["src"])
    result = {"status": "passed", "revision": manifest["revision"], "verifiedBlobs": len(manifest["blobs"]), "verifiedPhysicalFiles": len(physical),
              "resourceURLs": len(manifest["routes"]), "cases": len(cases), "frames": len(frames),
              "projectMiB": project_sizes, "backendFilesRequired": False,
              "browserVisualValidation": "Not established by this file/protocol check"}
    (output / "pages-verification.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2), flush=True)


if __name__ == "__main__":
    main()
