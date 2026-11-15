"""Local homepage preview with OS-Omni application mounts (no source copies)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse
import json
from native_gateway import NativeGateway

HOME = Path(__file__).resolve().parents[1]
APPS = {"openshop", "opentwitter"}


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = unquote(urlsplit(path).path)
        parts = clean.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "demo-apps" and parts[1] in APPS:
            root = self.server.apps_root / parts[1] / "public"
            target = root.joinpath(*parts[2:]).resolve()
        else:
            root = HOME
            target = root.joinpath(*parts).resolve()
        if not target.is_relative_to(root.resolve()):
            return str(HOME / "__forbidden__")
        return str(target)

    def do_GET(self):
        native = urlsplit(self.path).path
        if native == "/api/native/status":
            self.send_json(self.server.native.status())
            return
        if native.startswith("/api/native/") and native.endswith("/apps"):
            try:
                self.send_json({"apps": self.server.native.apps(native.split("/")[3])})
            except Exception:
                self.send_json({"error": "Unable to read the installed application inventory"}, 503)
            return
        if native.startswith("/api/native/") and native.endswith("/screen"):
            platform = native.split("/")[3]
            try:
                data, mime = self.server.native.frame(platform)
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception:
                self.send_json({"error": "Environment unavailable. Check its runtime and host configuration."}, 503)
            return
        parts = unquote(urlsplit(self.path).path).strip("/").split("/")
        if len(parts) >= 3 and parts[0] == "demo-apps" and parts[1] in APPS and parts[-1].endswith(".html"):
            file = Path(self.translate_path(self.path))
            if not file.is_file():
                self.send_error(404)
                return
            html = file.read_text(encoding="utf-8")
            html = html.replace("<head>", '<head><script src="/static/js/playground-bridge.js"></script>', 1)
            boot = '<script src="/static/js/playground-boot.js"></script>'
            app_script = '<script src="./app.js"></script>'
            login_script = '<script src="./login.js"></script>'
            if app_script in html:
                html = html.replace(app_script, boot + app_script)
            elif login_script in html:
                html = html.replace(login_script, boot + login_script)
            data = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def send_json(self, payload, status=200):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin != "http://" + self.headers.get("Host", "") or self.headers.get("Content-Type") != "application/json":
            self.send_json({"error": "Same-origin JSON requests required"}, 403)
            return
        path = urlsplit(self.path).path
        if path.startswith("/api/native/") and path.endswith("/action"):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length < 65536:
                    raise ValueError("Invalid request size")
                action = json.loads(self.rfile.read(length))
                self.send_json(self.server.native.action(path.split("/")[3], action))
            except ValueError as error:
                self.send_json({"error": str(error)}, 400)
            except Exception:
                self.send_json({"error": "Input failed. Check the platform runtime."}, 503)
            return
        self.send_json({"error": "Not found"}, 404)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8900)
    parser.add_argument("--apps-root", type=Path, default=HOME.parent / "OS-Omni-V2" / "apps")
    args = parser.parse_args()
    for app in APPS:
        if not (args.apps_root / app / "public" / "index.html").exists():
            parser.error(f"Missing app: {app}; set --apps-root to OS-Omni-V2/apps")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.apps_root = args.apps_root.resolve()
    server.native = NativeGateway(server.apps_root.parent)
    print(f"OS-Omni playground: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.native.close()
        server.server_close()
