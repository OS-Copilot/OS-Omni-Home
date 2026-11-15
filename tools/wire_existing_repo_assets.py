"""Point the Pages resource index at immutable commits in the official repo."""
from pathlib import Path
import argparse
import hashlib
import json

HOME = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=HOME / "dist/pages-ready")
    args = parser.parse_args()
    root = args.directory.resolve()
    report_path = root / "pages-build-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    state = json.loads((root / "existing-repo-assets.json").read_text(encoding="utf-8"))
    assets = sorted(state["assets"], key=lambda a: a["slot"])
    if [a["slot"] for a in assets] != list(range(5)):
        raise RuntimeError("All five resource branches must be uploaded before the homepage is rewired")
    manifest = json.loads((root / report["manifest"]).read_text(encoding="utf-8"))
    manifest["shards"] = [a["rawBase"] for a in assets]
    manifest.pop("revision", None)
    revision = hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:16]
    manifest["revision"] = revision
    main_dir = root / report["projects"][0]["directory"]
    name = "osomni-resources." + revision + ".json"
    (main_dir / name).write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    config = {"base": manifest["base"], "manifest": name, "revision": revision}
    worker = (HOME / "tools/pages-resource-worker.js").read_text(encoding="utf-8").replace("__OSOMNI_PAGES_CONFIG__", json.dumps(config))
    (main_dir / "osomni-pages-sw.js").write_text(worker, encoding="utf-8")
    report["assetSnapshotRevision"] = state["revision"]
    report["revision"] = revision
    report["manifest"] = report["projects"][0]["directory"] + "/" + name
    report["assetHosting"] = "immutable commits on resource branches in the existing official repository"
    report["externalResourceOrigins"] = ["https://raw.githubusercontent.com"]
    for project, asset in zip(report["projects"][1:], assets):
        project.update({"repository": asset["repository"], "branch": asset["branch"], "commit": asset["commit"], "url": asset["rawBase"], "hosting": "raw-content"})
    for project in report["projects"]:
        directory = root / project["directory"]
        project["bytes"] = sum(p.stat().st_size for p in directory.rglob("*") if p.is_file() and ".git" not in p.relative_to(directory).parts)
    report["totalBytes"] = sum(project["bytes"] for project in report["projects"])
    report["note"] = "No new repositories are needed. Only the existing homepage gh-pages branch needs Pages enabled. Source main is unchanged."
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for filename in ("pages-verification.json", "pages-runtime-verification.json"):
        verification_path = root / filename
        previous = json.loads(verification_path.read_text(encoding="utf-8")) if verification_path.exists() else {}
        if previous.get("revision") != revision:
            verification_path.write_text(json.dumps({"status": "needs_recheck", "revision": revision,
                "reason": "Resource URLs changed; verify this exact release before publication"}, indent=2), encoding="utf-8")
    print(json.dumps({"revision": revision, "mainUrl": report["projects"][0]["url"], "resourceBranches": [a["branch"] for a in assets]}, indent=2))


if __name__ == "__main__":
    main()
