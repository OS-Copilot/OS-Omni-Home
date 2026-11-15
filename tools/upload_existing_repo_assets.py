"""Upload validated website blobs to branches in the existing official repo.

No new repositories, no Pages configuration and no source main changes.
"""
from pathlib import Path
import argparse
import json
import urllib.request

from publish_pages_site import push_project

HOME = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=HOME / "dist/pages-ready")
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()
    root = args.directory.resolve()
    report = json.loads((root / "pages-build-report.json").read_text(encoding="utf-8"))
    verified = json.loads((root / "pages-verification.json").read_text(encoding="utf-8"))
    if verified.get("status") != "passed":
        raise RuntimeError("The source bundle has not passed verification")
    repository = report["projects"][0]["repository"]
    state_path = root / "existing-repo-assets.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {"repository": repository, "revision": report["revision"], "assets": []}
    if state["repository"] != repository:
        raise RuntimeError("The existing upload belongs to a different repository")
    for index, source in enumerate(report["projects"][1:], 1):
        project = {**source, "repository": repository, "branch": f"site-assets-{index:02d}", "binaryAssets": True}
        print(f"{'PUSH' if args.push else 'PLAN'} {repository}:{project['branch']} ({source['bytes']/1024**2:.2f} MiB)", flush=True)
        if not args.push:
            continue
        commit = push_project(root, project, report["revision"])
        raw = f"https://raw.githubusercontent.com/{repository}/{commit}/"
        # An immutable commit URL avoids stale branch-name caches after updates.
        entry = {"slot": index - 1, "directory": source["directory"], "branch": project["branch"], "commit": commit,
                 "rawBase": raw, "repository": repository, "bytes": source["bytes"]}
        state["assets"] = sorted([x for x in state["assets"] if x["slot"] != index - 1] + [entry], key=lambda x: x["slot"])
        state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        print(f"Uploaded {index}/5: {commit}", flush=True)
        # Confirm anonymous content access and browser CORS on this actual branch.
        sample = min((root / source["directory"] / "blobs").rglob("*.bin"), key=lambda p: p.stat().st_size)
        url = raw + sample.relative_to(root / source["directory"]).as_posix()
        with urllib.request.urlopen(url, timeout=60) as response:
            if response.headers.get("Access-Control-Allow-Origin") != "*" or response.read() != sample.read_bytes():
                raise RuntimeError("Public asset bytes or CORS differ: " + project["branch"])
        print(f"Verified public content and CORS: {project['branch']}", flush=True)


if __name__ == "__main__":
    main()
