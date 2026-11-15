"""Serve the standalone browser playground; no VM or application backend."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import threading

HOME = Path(__file__).resolve().parents[1]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ports", type=int, nargs="+", default=[8899, 8900])
    args = parser.parse_args()
    if not (HOME / "public/playground/apps/system.html").exists():
        parser.error("Run python tools/build_playground.py first")
    servers = [ThreadingHTTPServer(("127.0.0.1", port), partial(SimpleHTTPRequestHandler, directory=str(HOME))) for port in args.ports]
    for server in servers:
        print(f"Browser playground: http://127.0.0.1:{server.server_port}/#playground-section", flush=True)
        threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        for server in servers:
            server.shutdown()
            server.server_close()
