"""Push the verified official homepage, then request GitHub Pages activation."""
from pathlib import Path
import argparse
import hashlib
import json
import time
import urllib.error
import urllib.request

from publish_pages_site import api, credential, push_project

HOME = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=HOME / "dist/pages-ready")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    root = args.directory.resolve()
    report = json.loads((root / "pages-build-report.json").read_text(encoding="utf-8"))
    if not report.get("assetHosting", "").startswith("immutable commits"):
        raise RuntimeError("Wire the verified resource branches before publishing the homepage")
    for name in ("pages-verification.json", "pages-runtime-verification.json"):
        check = json.loads((root / name).read_text(encoding="utf-8"))
        if check.get("status") != "passed" or check.get("revision") != report["revision"]:
            raise RuntimeError("A required verification has not passed: " + name)
    project = report["projects"][0]
    print("PUBLISH" if args.publish else "DRY RUN", project["repository"], project["branch"], project["url"], flush=True)
    if not args.publish:
        return
    commit = push_project(root, project, report["revision"])
    result = {"repository": project["repository"], "revision": report["revision"], "commit": commit,
              "url": project["url"], "resourcesUploaded": True, "homepageBranchPushed": True,
              "pagesConfigured": False, "liveVerified": False}
    status_path = root / "official-deployment.json"
    def save():
        status_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    save()
    print("Homepage release pushed:", commit, flush=True)
    expected = (root / project["directory"] / "osomni-pages-sw.js").read_bytes()
    def live_matches():
        try:
            request = urllib.request.Request(project["url"] + "osomni-pages-sw.js?release=" + report["revision"], headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.status == 200 and hashlib.sha256(response.read()).digest() == hashlib.sha256(expected).digest()
        except (urllib.error.URLError, TimeoutError):
            return False
    if live_matches():
        result.update({"pagesConfigured": True, "liveVerified": True})
        save()
        print(json.dumps(result, indent=2), flush=True)
        return
    auth = credential()
    endpoint = "/repos/" + project["repository"] + "/pages"
    try:
        current = api(auth, "GET", endpoint, allow404=True)
        if current and current.get("cname"):
            raise RuntimeError("Existing Pages has a custom domain; do not replace it automatically")
        settings = {"build_type": "legacy", "source": {"branch": project["branch"], "path": "/"}}
        if not current or current.get("build_type") != "legacy" or current.get("source") != settings["source"]:
            api(auth, "PUT" if current else "POST", endpoint, settings)
        result["pagesConfigured"] = True
        api(auth, "POST", endpoint + "/builds")
        save()
    except RuntimeError as error:
        if live_matches():
            result.update({"pagesConfigured": True, "liveVerified": True})
            save()
            print(json.dumps(result, indent=2), flush=True)
            return
        result["configurationError"] = str(error)
        result["maintainerAction"] = "Settings > Pages > Deploy from a branch > gh-pages > /(root) > Save"
        save()
        print(json.dumps(result, indent=2), flush=True)
        return
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        if live_matches():
            result["liveVerified"] = True
            save()
            print(json.dumps(result, indent=2), flush=True)
            return
        time.sleep(10)
    result["verificationNote"] = "The matching public release was not observed within ten minutes"
    save()
    print(json.dumps(result, indent=2), flush=True)


if __name__ == "__main__":
    main()
