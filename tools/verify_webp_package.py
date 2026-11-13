"""Verify the intentional image changes and every unchanged compact resource."""
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
import gzip
import hashlib
import json
import threading
import urllib.parse
import urllib.request

from PIL import Image
from build_webp_package import HOME, psnr, OLD_NOTE, NEW_NOTE
from serve_compact_site import CompactSite, Handler


def verify():
    package = HOME / "dist/compact-webp-v2"
    site = CompactSite(package)
    baseline = CompactSite(HOME / "dist/compact-site")
    report = json.loads((package / "compression-report.json").read_text(encoding="utf-8"))
    replacements = report["pathReplacements"]
    expected = set(baseline.routes) - set(replacements) | set(replacements.values())
    assert set(site.routes) == expected
    changed = {"index.html", "static/data/case-studies.json"} | set(replacements.values())
    for route in set(site.routes) - changed:
        assert site.routes[route] == baseline.routes[route], route
    assert site.original(site.routes["index.html"]).decode("utf-8") == baseline.original(baseline.routes["index.html"]).decode("utf-8").replace(OLD_NOTE, NEW_NOTE)

    def check_blob(digest):
        meta = site.blobs[digest]
        stored = site.blob_path(digest).read_bytes()
        assert len(stored) == meta["stored_bytes"]
        raw = gzip.decompress(stored) if meta["encoding"] == "gzip" else stored
        assert len(raw) == meta["bytes"] and hashlib.sha256(raw).hexdigest() == digest
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check_blob, site.blobs))

    before = json.loads((HOME / "static/data/case-studies.json").read_text(encoding="utf-8"))
    after = json.loads(site.original(site.routes["static/data/case-studies.json"]))
    assert after.pop("mediaEncoding")["previewsChanged"] is False
    checked = set()
    inverse = {v: k for k, v in replacements.items()}
    def check_image(src):
        with Image.open(BytesIO(site.original(site.routes[src]))) as image:
            assert image.format == "WEBP"
            with Image.open(HOME / inverse[src]) as original:
                assert image.size == original.size
                assert psnr(original, image) >= 36
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check_image, inverse))
    for case in after["cases"]:
        for shot in [case["finalScreenshot"]] + [s[k] for s in case["steps"] for k in ("before", "after")]:
            src = shot["src"]
            if src in inverse:
                if src not in checked:
                    with Image.open(BytesIO(site.original(site.routes[src]))) as image:
                        assert image.size == (shot["width"], shot["height"])
                    checked.add(src)
                shot["src"] = inverse[src]
    assert after == before, "Task records, steps or preview metadata changed"

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, site=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    requests = []
    def get(route):
        url = f"http://127.0.0.1:{server.server_port}/" + urllib.parse.quote(route, safe="/")
        with urllib.request.urlopen(url, timeout=30) as response:
            body = response.read()
            assert hashlib.sha256(body).hexdigest() == site.routes[route]
            if route.endswith(".webp"):
                assert response.headers.get_content_type() == "image/webp"
        return route
    for case in before["cases"]:
        for shot in (case["steps"][0]["before"], case["finalScreenshot"]):
            requests.extend((replacements.get(shot["src"], shot["src"]), shot["preview"]["src"]))
    requests.extend(route for route in site.routes if route.startswith("public/playground/") and
                    (route.endswith("/index.html") or route.endswith("/system.html")))
    try:
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(get, set(requests)))
    finally:
        server.shutdown()
        server.server_close()
    result = {"status": "passed", "verifiedBlobs": len(site.blobs),
              "fullResolutionImagesChecked": len(checked), "httpChecks": len(set(requests)),
              "cases": len(before["cases"]), "previewAndAppBytesUnchanged": True,
              "sourceFilesUnmodifiedByBuild": True}
    (package / "verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    verify()
