"""Export the complete compact site into ordinary GitHub Pages directories.

All production files are static. Browser Service Workers retain the existing
App/replay URLs while reading deduplicated files from sibling Pages projects.
Python is only a local build tool, never an online resource service.
"""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import mimetypes
import os
import re

from serve_compact_site import CompactSite

HOME = Path(__file__).resolve().parents[1]
FLUTTER = ("public/playground/apps/opendriver/", "public/playground/apps/macos/opendriver/", "public/playground/apps/windows/opendriver/")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def homepage_bootstrap(bootstrap, source_html):
    """Keep page titles and social preview metadata on the initial static entry."""
    head = re.search(r"<head[^>]*>(.*?)</head>", source_html, re.I | re.S)
    if not head:
        raise ValueError("Homepage head is missing")
    title = re.search(r"<title>.*?</title>", head[1], re.I | re.S)
    if title:
        bootstrap = re.sub(r"<title>.*?</title>", lambda _: title[0], bootstrap, count=1, flags=re.I | re.S)
    tags = [tag for tag in re.findall(r"<meta\b[^>]*>", head[1], re.I)
            if not re.search(r"\bcharset\s*=|\bname\s*=\s*['\"](?:viewport|theme-color)['\"]", tag, re.I)]
    tags.extend(tag for tag in re.findall(r"<link\b[^>]*>", head[1], re.I) if re.search(r"\brel\s*=\s*['\"](?:canonical|icon|apple-touch-icon)['\"]", tag, re.I))
    return bootstrap.replace("</head>", "\n" + "\n".join(tags) + "\n</head>", 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, default=HOME / "dist/compact-webp-v2")
    parser.add_argument("--output", type=Path, default=HOME / "dist/pages-ready")
    parser.add_argument("--site-name", default="OS-Omni-Home")
    parser.add_argument("--assets-prefix", default="OS-Omni-Assets")
    parser.add_argument("--organization", default="OS-Copilot")
    parser.add_argument("--shard-mib", type=int, default=750)
    args = parser.parse_args()
    for name in (args.site_name, args.assets_prefix, args.organization):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", name):
            parser.error("Names may only contain ASCII letters, digits, hyphens, underscores and dots")
    if not 100 <= args.shard_mib <= 850:
        parser.error("Choose shard sizes from 100 to 850 MiB")
    output = args.output.resolve()
    if not output.is_relative_to(HOME / "dist") or output == args.package.resolve():
        parser.error("Choose a separate output beneath this website's dist/")
    if output.exists() and any(output.iterdir()):
        parser.error("An existing output is never overwritten")
    output.mkdir(parents=True, exist_ok=True)
    site = CompactSite(args.package)
    routes = dict(site.routes)
    main_dir = output / args.site_name
    main_dir.mkdir()
    base = "/" + args.site_name + "/"
    # Flutter's own child Service Workers fetch without going through the parent
    # adapter. Their complete App trees and shared runtime files stay physical.
    physical = {p for p in routes if p.startswith("static/") or p.startswith(FLUTTER) or p.startswith("public/playground/apps/opennavigation/tiles/")}
    physical.update(p for p in routes if p.startswith("public/playground/apps/") and "/" not in p.removeprefix("public/playground/apps/") and not p.endswith(".html"))
    for route in sorted(physical):
        target = main_dir / route
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(site.original(routes[route]))

    # Refresh the worker on homepage visits; a newly activated release reloads
    # once, rather than mixing old page scripts with new resource indexes.
    update = '<script data-osomni-pages-update>(function(){if(!("serviceWorker" in navigator))return;navigator.serviceWorker.addEventListener("controllerchange",function(){location.reload();},{once:true});navigator.serviceWorker.getRegistration(' + json.dumps(base) + ').then(function(r){if(r)return r.update();}).catch(function(){});})();</script>'
    html = site.original(routes["index.html"]).decode("utf-8")
    html = html.replace("<head>", "<head>" + update, 1)
    raw_index = html.encode("utf-8")
    index_digest = sha(raw_index)
    index_stored = gzip.compress(raw_index, compresslevel=9, mtime=0)
    routes["index.html"] = index_digest
    blobs = dict(site.blobs)
    blobs[index_digest] = {"bytes": len(raw_index), "stored_bytes": len(index_stored), "encoding": "gzip"}
    used = {digest for route, digest in routes.items() if route not in physical}
    limit = args.shard_mib * 1024**2
    shard_sizes, assigned = [], {}
    for digest in sorted(used, key=lambda d: (-blobs[d]["stored_bytes"], d)):
        size = blobs[digest]["stored_bytes"]
        if size >= 100 * 1024**2:
            raise ValueError("A resource exceeds GitHub's per-file limit: " + digest)
        slot = next((i for i, total in enumerate(shard_sizes) if total + size <= limit), None)
        if slot is None:
            slot = len(shard_sizes)
            shard_sizes.append(0)
        assigned[digest] = slot
        shard_sizes[slot] += size
    shard_names = [f"{args.assets_prefix}-{i+1:02d}" for i in range(len(shard_sizes))]
    for name in shard_names:
        directory = output / name
        directory.mkdir()
        (directory / ".nojekyll").write_text("", encoding="utf-8")
        (directory / "index.html").write_text('<!doctype html><meta charset="utf-8"><title>OS-Omni assets</title><a href="' + base + '">OS-Omni homepage</a>', encoding="utf-8")
    for digest, slot in assigned.items():
        destination = output / shard_names[slot] / "blobs" / digest[:2] / (digest + ".bin")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if digest == index_digest:
            destination.write_bytes(index_stored)
        else:
            os.link(site.blob_path(digest), destination)
    overrides = {".js": "application/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".webp": "image/webp", ".avif": "image/avif", ".wasm": "application/wasm", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml"}
    mime = {}
    for route in routes:
        extension = Path(route).suffix.lower()
        value = overrides.get(extension) or mimetypes.guess_type(route)[0] or "application/octet-stream"
        if value.startswith("text/") or value in ("application/javascript", "application/json"):
            value += "; charset=utf-8"
        mime[extension.lstrip(".")] = value
    manifest = {"version": 1, "base": base, "routes": routes, "physical": sorted(physical),
                "shards": ["/" + name + "/" for name in shard_names], "mime": mime,
                "blobs": {d: [assigned[d], int(blobs[d]["encoding"] == "gzip"), blobs[d]["bytes"], blobs[d]["stored_bytes"]] for d in sorted(used)}}
    revision = sha(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode())[:16]
    manifest["revision"] = revision
    manifest_name = "osomni-resources." + revision + ".json"
    (main_dir / manifest_name).write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    config = {"base": base, "manifest": manifest_name, "revision": revision}
    worker = (HOME / "tools/pages-resource-worker.js").read_text(encoding="utf-8").replace("__OSOMNI_PAGES_CONFIG__", json.dumps(config))
    (main_dir / "osomni-pages-sw.js").write_text(worker, encoding="utf-8")
    bootstrap = (HOME / "tools/pages-bootstrap.html").read_text(encoding="utf-8").replace("__OSOMNI_BASE_JSON__", json.dumps(base)).replace("__OSOMNI_BASE__", base)
    gates = {"index.html", "404.html"} | {p for p in routes if p.endswith(".html") and p not in physical}
    for route in sorted(gates):
        target = main_dir / route
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(bootstrap, encoding="utf-8")
    (main_dir / "index.html").write_text(homepage_bootstrap(bootstrap, html), encoding="utf-8")
    (main_dir / ".nojekyll").write_text("", encoding="utf-8")
    projects = []
    for name in [args.site_name] + shard_names:
        directory = output / name
        total = sum(p.stat().st_size for p in directory.rglob("*") if p.is_file())
        if total >= 900 * 1024**2:
            raise ValueError("Pages project is too large: " + name)
        projects.append({"repository": f"{args.organization}/{name}", "directory": name,
                         "branch": "gh-pages", "bytes": total,
                         "url": f"https://{args.organization.lower()}.github.io/{name}/"})
    report = {"revision": revision, "manifest": f"{args.site_name}/{manifest_name}", "sourcePackage": str(args.package.resolve()),
              "productionBackendRequired": False, "serviceWorkerRequired": True,
              "cases": len(json.loads(site.original(site.routes["static/data/case-studies.json"]))["cases"]),
              "resourceURLs": len(routes), "deduplicatedBlobs": len(used), "physicalResources": len(physical),
              "mainIndexInjection": update, "projects": projects, "totalBytes": sum(p["bytes"] for p in projects),
              "published": False, "note": "All projects must be published on the same origin. Resource repository names in this plan are proposed, not created."}
    (output / "pages-build-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "mainIndexInjection"}, indent=2), flush=True)


if __name__ == "__main__":
    main()
