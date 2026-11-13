"""Serve an exact-content compact site; no application data or VM backend."""
from functools import lru_cache, partial
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
import argparse
import gzip
import html
import json
import re


class CompactSite:
    def __init__(self, root):
        self.root = Path(root).resolve()
        with gzip.open(self.root / "routes.json.gz", "rt", encoding="utf-8") as stream:
            manifest = json.load(stream)
        if manifest.get("version") != 1:
            raise ValueError("Unsupported compact-site format")
        self.routes, self.blobs = manifest["routes"], manifest["blobs"]
        self.casefold_routes = {key.casefold(): key for key in self.routes}
        if any(not re.fullmatch(r"[0-9a-f]{64}", key) for key in self.blobs):
            raise ValueError("Invalid resource identifier")

    def blob_path(self, digest):
        return self.root / "blobs" / digest[:2] / digest

    @lru_cache(maxsize=6)
    def original(self, digest):
        body = self.blob_path(digest).read_bytes()
        return gzip.decompress(body) if self.blobs[digest]["encoding"] == "gzip" else body


class Handler(BaseHTTPRequestHandler):
    # Windows' MIME registry does not reliably include WebP or WebAssembly.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webp": "image/webp", ".avif": "image/avif",
                      ".wasm": "application/wasm", ".woff": "font/woff", ".woff2": "font/woff2"}
    guess_type = SimpleHTTPRequestHandler.guess_type

    def __init__(self, *args, site, base_path="", **kwargs):
        self.site = site
        self.base_path = base_path.rstrip("/")
        super().__init__(*args, **kwargs)

    def log_message(self, *args):
        pass

    def do_GET(self):
        self.respond(False)

    def do_HEAD(self):
        self.respond(True)

    def respond(self, head):
        parsed = urlsplit(self.path)
        path = unquote(parsed.path)
        query = "?" + parsed.query if parsed.query else ""
        if self.base_path:
            if path in ("/", self.base_path):
                self.send_response(301)
                self.send_header("Location", self.base_path + "/" + query)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if not path.startswith(self.base_path + "/"):
                self.send_error(404)
                return
            path = path[len(self.base_path):]
        if ".." in PurePosixPath(path).parts or "\\" in path:
            self.send_error(400)
            return
        relative = path.lstrip("/")
        canonical = relative if relative in self.site.routes else self.site.casefold_routes.get(relative.casefold())
        if canonical is not None:
            return self.resource(canonical, head)
        directory = relative.rstrip("/")
        prefix = directory + "/" if directory else ""
        index = prefix + "index.html"
        canonical_index = index if index in self.site.routes else self.site.casefold_routes.get(index.casefold())
        if canonical_index is not None:
            if not path.endswith("/"):
                self.send_response(301)
                self.send_header("Location", self.base_path + path + "/" + query)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            return self.resource(canonical_index, head)
        if any(key.startswith(prefix) for key in self.site.routes):
            if not path.endswith("/"):
                self.send_response(301)
                self.send_header("Location", self.base_path + path + "/" + query)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            names = sorted({key[len(prefix):].split("/")[0] + ("/" if "/" in key[len(prefix):] else "") for key in self.site.routes if key.startswith(prefix)})
            body = ("<!doctype html><title>Directory listing</title><ul>" + "".join('<li><a href="' + html.escape(name, quote=True) + '">' + html.escape(name) + '</a></li>' for name in names) + "</ul>").encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if not head:
                self.wfile.write(body)
            return
        self.send_error(404)

    def resource(self, relative, head):
        digest = self.site.routes[relative]
        meta = self.site.blobs[digest]
        etag = '"' + digest + '"'
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Vary", "Accept-Encoding")
            self.end_headers()
            return
        requested_range = self.headers.get("Range", "")
        if requested_range and self.headers.get("If-Range", etag) != etag:
            requested_range = ""
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested_range)
        if match and any(match.groups()):
            total = meta["bytes"]
            start = int(match[1]) if match[1] else max(0, total - int(match[2]))
            end = min(int(match[2]), total - 1) if match[1] and match[2] else total - 1
            if start >= total or start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{total}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(relative))
            self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", etag)
            self.end_headers()
            if not head:
                if meta["encoding"] == "identity":
                    with self.site.blob_path(digest).open("rb") as stream:
                        stream.seek(start)
                        self.wfile.write(stream.read(end - start + 1))
                else:
                    self.wfile.write(self.site.original(digest)[start:end + 1])
            return
        accepts_gzip = False
        for item in self.headers.get("Accept-Encoding", "").lower().split(","):
            parts = item.strip().split(";")
            if parts[0] == "gzip":
                quality = next((p.strip()[2:] for p in parts[1:] if p.strip().startswith("q=")), "1")
                try:
                    accepts_gzip = float(quality) > 0
                except ValueError:
                    accepts_gzip = False
        encoded = meta["encoding"] == "gzip" and accepts_gzip
        length = meta["stored_bytes"] if encoded else meta["bytes"]
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(relative))
        self.send_header("Content-Length", str(length))
        self.send_header("ETag", etag)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("Accept-Ranges", "bytes")
        if encoded:
            self.send_header("Content-Encoding", "gzip")
        self.end_headers()
        if not head:
            if encoded or meta["encoding"] == "identity":
                with self.site.blob_path(digest).open("rb") as stream:
                    while chunk := stream.read(128 * 1024):
                        self.wfile.write(chunk)
            else:
                self.wfile.write(self.site.original(digest))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8912)
    parser.add_argument("--base-path", default="")
    args = parser.parse_args()
    if args.base_path and (not args.base_path.startswith("/") or ".." in args.base_path):
        parser.error("Use a root-relative base path")
    site = CompactSite(args.root)
    server = ThreadingHTTPServer((args.host, args.port), partial(Handler, site=site, base_path=args.base_path))
    print(f"Compact site: http://{args.host}:{server.server_port}{args.base_path.rstrip('/')}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
