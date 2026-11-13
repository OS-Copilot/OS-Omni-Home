"""Verify original bytes for every compact route and exercise its HTTP contract."""
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import random
import threading
import urllib.error
import urllib.parse
import urllib.request

from build_compact_site import HOME, fingerprint, site_files
from serve_compact_site import CompactSite, Handler


def verify(root, package):
    root, package = root.resolve(), package.resolve()
    site = CompactSite(package)
    files = site_files(root)
    expected_paths = {p.relative_to(root).as_posix() for p in files}
    assert expected_paths == set(site.routes), "Original resource URL set differs"
    print(f"Checking source SHA-256 for {len(files)} routes...", flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for entry in pool.map(lambda path: fingerprint(root, path), files):
            assert site.routes[entry["path"]] == entry["sha256"], entry["path"]
    print(f"Checking {len(site.blobs)} stored resources after lossless decoding...", flush=True)

    def check_blob(pair):
        digest, meta = pair
        stored = site.blob_path(digest).read_bytes()
        assert len(stored) == meta["stored_bytes"], digest
        raw = gzip.decompress(stored) if meta["encoding"] == "gzip" else stored
        assert len(raw) == meta["bytes"] and hashlib.sha256(raw).hexdigest() == digest, digest

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check_blob, site.blobs.items()))
    source_bytes = sum(site.blobs[digest]["bytes"] for digest in site.routes.values())
    selections = {"index.html", "404.html", "static/data/case-studies.json", "static/data/task-catalog.json"}
    selections.update(path for path in site.routes if path.startswith("static/") and path.endswith((".js", ".css")))
    selections.update(path for path in site.routes if path.startswith("public/playground/") and (path.endswith("/index.html") or path.endswith("/system.html")))
    cases = json.loads((root / "static/data/case-studies.json").read_text(encoding="utf-8"))["cases"]
    for case in cases:
        for shot in (case["steps"][0]["before"], case["finalScreenshot"]):
            selections.update((shot["src"], shot["preview"]["src"]))
    selections.update(random.Random(20261112).sample(sorted(site.routes), min(100, len(site.routes))))
    selections = selections.intersection(site.routes)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, site=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_port}"

    def read(path, headers=None, method="GET"):
        request = urllib.request.Request(origin + "/" + urllib.parse.quote(path, safe="/"), headers=headers or {}, method=method)
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, dict(response.headers), response.read()

    def check_http(path):
        _, headers, body = read(path, {"Accept-Encoding": "gzip"})
        if headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        assert hashlib.sha256(body).hexdigest() == site.routes[path], path

    try:
        print(f"Checking {len(selections)} HTTP resources including every App entry and replay endpoints...", flush=True)
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(check_http, sorted(selections)))
        small_json = "static/data/case-studies.json"
        digest = site.routes[small_json]
        original = (root / small_json).read_bytes()
        _, headers, body = read(small_json, {"Accept-Encoding": "identity"})
        assert body == original and "Content-Encoding" not in headers
        _, headers, body = read(small_json, {"Accept-Encoding": "gzip;q=0"})
        assert body == original and "Content-Encoding" not in headers
        status, headers, body = read(small_json, {"Accept-Encoding": "gzip"}, "HEAD")
        assert status == 200 and not body and int(headers["Content-Length"]) == site.blobs[digest]["stored_bytes"]
        ranged_paths = [small_json, next(path for path in site.routes if path.endswith(".pdf"))]
        for path in ranged_paths:
            raw = (root / path).read_bytes()
            status, headers, body = read(path, {"Range": "bytes=13-112", "Accept-Encoding": "gzip"})
            assert status == 206 and body == raw[13:113] and "Content-Encoding" not in headers
            status, _, body = read(path, {"Range": "bytes=-97"})
            assert status == 206 and body == raw[-97:]
            status, _, body = read(path, {"Range": "bytes=13-112", "If-Range": '"outdated"'})
            assert status == 200 and body == raw
        try:
            read(small_json, {"Range": "bytes=999999999999-"})
            raise AssertionError("Unsatisfiable range was accepted")
        except urllib.error.HTTPError as error:
            assert error.code == 416
        try:
            read(small_json, {"If-None-Match": '"' + digest + '"'})
            raise AssertionError("Conditional request did not return 304")
        except urllib.error.HTTPError as error:
            assert error.code == 304
        _, _, body = read("INDEX.HTML")
        assert body == (root / "index.html").read_bytes()
        _, _, body = read("public/playground/apps/opentrip/")
        assert hashlib.sha256(body).hexdigest() == site.routes["public/playground/apps/opentrip/index.html"]
        with urllib.request.urlopen(origin + "/public/playground/apps/opentrip?kept=yes", timeout=30) as response:
            assert urllib.parse.urlsplit(response.geturl()).query == "kept=yes"
            assert hashlib.sha256(response.read()).hexdigest() == site.routes["public/playground/apps/opentrip/index.html"]
    finally:
        server.shutdown()
        server.server_close()
    subserver = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, site=site, base_path="/OS-Omni-Home"))
    threading.Thread(target=subserver.serve_forever, daemon=True).start()
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{subserver.server_port}/OS-Omni-Home/", timeout=30) as response:
            assert response.read() == (root / "index.html").read_bytes()
    finally:
        subserver.shutdown()
        subserver.server_close()
    report = {"verified_source_routes": len(site.routes), "verified_unique_resources": len(site.blobs), "http_resources_checked": len(selections), "original_payload_bytes": source_bytes, "result": "PASS", "checks": ["all original URLs", "all original SHA-256 hashes after decoding", "App entry pages", "all replay first/final originals and previews", "identity and gzip responses", "gzip q=0", "HEAD", "JSON/PDF range and suffix reads", "If-Range", "416", "ETag 304", "case-insensitive URL compatibility", "directory redirect query preservation", "project subpath"]}
    (package / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, default=HOME / "dist/compact-site")
    args = parser.parse_args()
    verify(HOME, args.package)
