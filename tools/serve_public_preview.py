"""Serve only the six public website directories for a temporary HTTPS tunnel.

Build reports, Git metadata, credentials and all other workspace paths are denied.
This is a local preview origin, not a production deployment or VM backend.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import json

HOME = Path(__file__).resolve().parents[1]


class PublicPreview(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webp": "image/webp", ".wasm": "application/wasm",
                      ".js": "application/javascript", ".woff2": "font/woff2"}

    def __init__(self, *args, root, projects, **kwargs):
        self.public_root = root
        self.projects = projects
        super().__init__(*args, directory=str(root), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        # Preserve the published HTML (including demo email addresses) instead
        # of allowing the proxy to rewrite it or inject additional scripts.
        self.send_header("Cache-Control", "public, max-age=60, no-transform")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def send_head(self):
        raw_path = unquote(urlsplit(self.path).path)
        if raw_path == "/":
            self.send_response(302)
            self.send_header("Location", "/" + self.projects[0] + "/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        parts = [part for part in raw_path.split("/") if part]
        if not parts or parts[0] not in self.projects or any(part.startswith(".") or "\\" in part or ":" in part for part in parts):
            self.send_error(404)
            return None
        target = (self.public_root / Path(*parts)).resolve()
        if not target.is_relative_to(self.public_root / parts[0]):
            self.send_error(404)
            return None
        return super().send_head()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=HOME / "dist/pages-ready")
    parser.add_argument("--port", type=int, default=8916)
    args = parser.parse_args()
    root = args.directory.resolve()
    report = json.loads((root / "pages-build-report.json").read_text(encoding="utf-8"))
    projects = [project["directory"] for project in report["projects"]]
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(PublicPreview, root=root, projects=projects))
    print(f"Public website preview origin: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
