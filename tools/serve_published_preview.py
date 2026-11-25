"""Preview local edits with published assets downloaded only when requested."""
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import urlopen
import argparse
import gzip
import hashlib
import json
import mimetypes
import re
import sys
import threading


HOME = Path(__file__).resolve().parents[1]
ORIGIN = "https://os-copilot.github.io"
MANIFEST = HOME / "exports/navbar-live-baseline/manifest.json"
CACHE = HOME / "exports/navbar-preview-cache"
EXTRA_ROUTES = {"static/css/navigation.css"}


class PublishedSite:
    def __init__(self, root=HOME, manifest_path=MANIFEST, cache=CACHE, origin=ORIGIN):
        self.root = Path(root).resolve()
        self.cache = Path(cache).resolve()
        self.origin = origin.rstrip("/")
        self.manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
        if self.manifest.get("version") != 1:
            raise ValueError("Unsupported published resource manifest")
        self.base = self.manifest["base"]
        self.routes = self.manifest["routes"]
        self.physical = set(self.manifest["physical"])
        self.allowed = set(self.routes) | EXTRA_ROUTES
        self.folded = {path.casefold(): path for path in self.allowed}
        self.locks = {}
        self.lock = threading.Lock()

    def canonical(self, path):
        return path if path in self.allowed else self.folded.get(path.casefold())

    def local_path(self, path):
        file = (self.root / path).resolve()
        return file if file.is_relative_to(self.root) and file.is_file() else None

    def remote_url(self, path, digest):
        if path in self.physical:
            return self.origin + self.base + quote(path, safe="/"), False
        shard, compressed = self.manifest["blobs"][digest][:2]
        base = urljoin(self.origin + self.base, self.manifest["shards"][shard])
        return urljoin(base, "blobs/" + digest[:2] + "/" + digest + ".bin"), bool(compressed)

    def resource(self, path):
        local = self.local_path(path)
        if local:
            return local
        digest = self.routes.get(path)
        if not digest:
            raise FileNotFoundError(path)
        destination = self.cache / digest[:2] / digest
        if destination.is_file():
            return destination
        with self.lock:
            lock = self.locks.setdefault(digest, threading.Lock())
        with lock:
            if not destination.is_file():
                url, compressed = self.remote_url(path, digest)
                with urlopen(url, timeout=45) as response:
                    data = response.read()
                if compressed:
                    data = gzip.decompress(data)
                if hashlib.sha256(data).hexdigest() != digest:
                    raise ValueError("Published resource differs from pinned manifest: " + path)
                destination.parent.mkdir(parents=True, exist_ok=True)
                temporary = destination.with_suffix(".part")
                temporary.write_bytes(data)
                temporary.replace(destination)
        return destination

    def content_type(self, path):
        suffix = Path(path).suffix.lower().lstrip(".")
        return self.manifest["mime"].get(suffix) or mimetypes.guess_type(path)[0] or "application/octet-stream"


class PreviewHandler(BaseHTTPRequestHandler):
    def __init__(self, *args, site, **kwargs):
        self.site = site
        super().__init__(*args, **kwargs)

    def log_message(self, format, *args):
        print("%s %s" % (self.log_date_time_string(), format % args), file=sys.stdout, flush=True)

    def do_GET(self):
        self.respond(False)

    def do_HEAD(self):
        self.respond(True)

    def redirect(self, target, query):
        self.send_response(301)
        self.send_header("Location", quote(target, safe="/") + ("?" + query if query else ""))
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def respond(self, head):
        parsed = urlsplit(self.path)
        path = unquote(parsed.path)
        if "\\" in path or "\0" in path or ".." in path.split("/"):
            self.send_error(400, "Invalid resource path")
            return
        if path in ("/", self.site.base.rstrip("/")):
            self.redirect(self.site.base, parsed.query)
            return
        relative = path[len(self.site.base):] if path.startswith(self.site.base) else path.lstrip("/")
        route = self.site.canonical(relative)
        if not route:
            directory = relative.rstrip("/")
            route = self.site.canonical((directory + "/" if directory else "") + "index.html")
            if route and not path.endswith("/"):
                self.redirect(self.site.base + route[:-len("index.html")], parsed.query)
                return
        if not route:
            self.send_error(404, "Resource is not in the published manifest")
            return
        try:
            file = self.site.resource(route)
            stream = file.open("rb")
        except FileNotFoundError:
            self.send_error(404, "Local resource does not exist")
            return
        except Exception as error:
            self.log_message("Unable to load %s: %s", route, error)
            self.send_error(502, "Published resource could not be loaded")
            return
        with stream:
            total = file.stat().st_size
            start, end, status = 0, total - 1, 200
            requested = self.headers.get("Range", "")
            # No validators are emitted: an If-Range validator cannot match.
            if requested and not self.headers.get("If-Range"):
                match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested)
                if match and any(match.groups()):
                    start = int(match[1]) if match[1] else max(0, total - int(match[2]))
                    end = min(int(match[2]), total - 1) if match[1] and match[2] else total - 1
                    if start >= total or start > end:
                        self.send_response(416)
                        self.send_header("Content-Range", "bytes */" + str(total))
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return
                    status = 206
            self.send_response(status)
            self.send_header("Content-Type", self.site.content_type(route))
            self.send_header("Content-Length", str(max(0, end - start + 1)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Accept-Ranges", "bytes")
            if status == 206:
                self.send_header("Content-Range", "bytes %s-%s/%s" % (start, end, total))
            self.end_headers()
            if head:
                return
            stream.seek(start)
            remaining = end - start + 1
            try:
                while remaining > 0:
                    chunk = stream.read(min(128 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8899)
    args = parser.parse_args()
    site = PublishedSite()
    server = PreviewServer(("127.0.0.1", args.port), partial(PreviewHandler, site=site))
    print("Published preview: http://127.0.0.1:%s%s (revision %s)" %
          (server.server_port, site.base, site.manifest["revision"]), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
