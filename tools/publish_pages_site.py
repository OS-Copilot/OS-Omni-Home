"""Review or publish the prepared Pages projects. Default is read-only dry-run.

--publish creates missing public asset repositories, pushes gh-pages branches,
and configures Pages. It never force-pushes or changes the source main branch.
"""
from pathlib import Path
import argparse
import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

HOME = Path(__file__).resolve().parents[1]


def git(directory, *args, input=None, missing_ok=False):
    environment = dict(os.environ, GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="never")
    result = subprocess.run(["git", *args], cwd=directory, input=input, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment)
    if result.returncode and not missing_ok:
        raise RuntimeError("Git command failed: " + " ".join(args[:2]) + "\n" + result.stderr[-1600:])
    return result


def credential():
    result = git(HOME, "credential", "fill", input="protocol=https\nhost=github.com\n\n")
    fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    if not fields.get("password"):
        raise RuntimeError("No GitHub credential is available. Sign into GitHub through Git first.")
    # Keep credentials in this process only; never print them or write them into URLs.
    value = fields.get("username", "git") + ":" + fields["password"]
    return "Basic " + base64.b64encode(value.encode()).decode()


def api(auth, method, path, body=None, allow404=False):
    raw = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request("https://api.github.com" + path, data=raw, method=method,
        headers={"Authorization": auth, "Accept": "application/vnd.github+json", "Content-Type": "application/json",
                 "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "OS-Omni-Pages-Publisher"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as error:
        if allow404 and error.code == 404:
            return None
        # Only the API's short error message, never headers or complete bodies.
        try:
            message = json.loads(error.read()).get("message", "")[:300]
        except (ValueError, TypeError):
            message = ""
        raise RuntimeError(f"GitHub API {method} {path} returned HTTP {error.code}: {message}") from None


def push_project(output, project, revision):
    directory = output / project["directory"]
    remote = "https://github.com/" + project["repository"] + ".git"
    if not (directory / ".git").exists():
        git(directory, "init", "--initial-branch=gh-pages")
        git(directory, "remote", "add", "origin", remote)
        git(directory, "config", "user.name", "OS-Omni Pages")
        git(directory, "config", "user.email", "noreply@users.noreply.github.com")
    if git(directory, "remote", "get-url", "origin").stdout.strip() != remote:
        raise RuntimeError("Unexpected origin in " + str(directory))
    existing = git(directory, "ls-remote", "--heads", "origin", "gh-pages").stdout.split()
    parent = []
    if existing:
        git(directory, "fetch", "--depth=1", "origin", "refs/heads/gh-pages")
        parent = ["-p", git(directory, "rev-parse", "FETCH_HEAD").stdout.strip()]
    git(directory, "add", "--all")
    tree = git(directory, "write-tree").stdout.strip()
    commit = git(directory, "commit-tree", tree, *parent, "-m", "Publish OS-Omni static build " + revision).stdout.strip()
    git(directory, "update-ref", "refs/heads/gh-pages", commit)
    git(directory, "push", "origin", "refs/heads/gh-pages:refs/heads/gh-pages")
    return commit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=HOME / "dist/pages-ready")
    parser.add_argument("--publish", action="store_true", help="Actually create asset repos, push gh-pages and enable Pages")
    parser.add_argument("--check-access", action="store_true", help="Read GitHub repository/Pages permissions without changing anything")
    parser.add_argument("--allow-pending-pages", action="store_true", help="Upload branches even if an existing repo needs a maintainer to configure Pages")
    parser.add_argument("--upload-only", action="store_true", help="Push branches without configuring or building Pages")
    parser.add_argument("--only-homepage", action="store_true", help="With --upload-only, stage just the existing homepage's release branch")
    args = parser.parse_args()
    output = args.directory.resolve()
    if not output.is_relative_to(HOME / "dist"):
        parser.error("Use a prepared package beneath this website's dist/")
    report = json.loads((output / "pages-build-report.json").read_text(encoding="utf-8"))
    for filename in ("pages-verification.json", "pages-runtime-verification.json"):
        check = json.loads((output / filename).read_text(encoding="utf-8"))
        if check.get("status") != "passed":
            raise RuntimeError("Verification did not pass: " + filename)
    projects = report["projects"][1:] + report["projects"][:1]
    if args.only_homepage:
        if not args.upload_only:
            parser.error("--only-homepage requires --upload-only; assets must be online before publishing the homepage")
        projects = report["projects"][:1]
    print("PUBLISH" if args.publish else "DRY RUN - no remote changes", flush=True)
    for project in projects:
        print(f"  {project['repository']} : gh-pages, {project['bytes']/1024**2:.2f} MiB", flush=True)
    print("Source main branch stays unchanged; all six sites must share the planned origin.", flush=True)
    if args.upload_only:
        print("Branch upload only; no Pages setting or deployment will be changed.", flush=True)
    print("Real-browser visual acceptance and public deployment have not been established by the protocol checks.", flush=True)
    if args.check_access and not args.publish:
        auth = credential()
        account = api(auth, "GET", "/user")
        checks = []
        for project in projects:
            info = api(auth, "GET", "/repos/" + project["repository"], allow404=True)
            pages = api(auth, "GET", "/repos/" + project["repository"] + "/pages", allow404=True) if info else None
            checks.append({"repository": project["repository"], "visibleToCredential": info is not None,
                           "permissions": info.get("permissions", {}) if info else {},
                           "pages": {"url": pages.get("html_url"), "build_type": pages.get("build_type"), "source": pages.get("source")} if pages else None})
        access = {"account": account.get("login"), "readOnlyChecks": checks}
        (output / "pages-access-check.json").write_text(json.dumps(access, indent=2), encoding="utf-8")
        print(json.dumps(access, indent=2), flush=True)
        return
    if not args.publish:
        return
    # Complete local verification before any external mutation.
    from verify_pages_site import main as verify_files
    old_argv = __import__("sys").argv
    try:
        __import__("sys").argv = [old_argv[0], "--directory", str(output)]
        verify_files()
    finally:
        __import__("sys").argv = old_argv
    auth = credential()
    states = {}
    for project in projects:
        repository = project["repository"]
        info = api(auth, "GET", "/repos/" + repository, allow404=True)
        if info is None and project is report["projects"][0]:
            raise RuntimeError("The existing homepage repo is not accessible; no changes were made.")
        pages = api(auth, "GET", "/repos/" + repository + "/pages", allow404=True) if info else None
        if pages and (pages.get("cname") or pages.get("html_url", "").rstrip("/").lower() != project["url"].rstrip("/").lower()):
            raise RuntimeError("Existing Pages uses a different domain; review the deployment plan before publishing.")
        if info and not info.get("permissions", {}).get("push"):
            raise RuntimeError("No push permission for " + repository + "; no remote changes were made.")
        needs_settings = not pages or pages.get("build_type") != "legacy" or pages.get("source") != {"branch": "gh-pages", "path": "/"}
        if info and needs_settings and not any(info.get("permissions", {}).get(role) for role in ("admin", "maintain")) and not (args.allow_pending_pages or args.upload_only):
            raise RuntimeError("Pages needs configuration for " + repository + ". Ask a repository admin or maintainer to select gh-pages / (root) first; no remote changes were made.")
        states[repository] = (info, pages)
    published = []
    for project in projects:
        repository = project["repository"]
        info, pages = states[repository]
        if info is None:
            owner, name = repository.split("/", 1)
            api(auth, "POST", "/orgs/" + owner + "/repos", {"name": name, "private": False, "auto_init": False,
                "description": "Static resource package for the OS-Omni project website"})
        print("Publishing " + repository, flush=True)
        commit = push_project(output, project, report["revision"])
        can_configure = info is None or any(info.get("permissions", {}).get(role) for role in ("admin", "maintain"))
        settings = {"build_type": "legacy", "source": {"branch": "gh-pages", "path": "/"}}
        pending_settings = (not pages or pages.get("build_type") != "legacy" or pages.get("source") != settings["source"]) and not can_configure
        if args.upload_only or pending_settings:
            published.append({"repository": repository, "commit": commit, "url": project["url"], "status": "branch_pushed_pages_not_configured"})
            (output / "publication-progress.json").write_text(json.dumps({"revision": report["revision"], "published": published}, indent=2), encoding="utf-8")
            print("Branch pushed; Pages configuration pending: " + repository, flush=True)
            continue
        if not pages or pages.get("build_type") != "legacy" or pages.get("source") != settings["source"]:
            api(auth, "PUT" if pages else "POST", "/repos/" + repository + "/pages", settings)
        api(auth, "POST", "/repos/" + repository + "/pages/builds")
        deadline = time.monotonic() + 600
        while True:
            build = api(auth, "GET", "/repos/" + repository + "/pages/builds/latest", allow404=True)
            if build and build.get("commit") == commit:
                if build.get("status") == "built":
                    break
                if build.get("status") == "errored":
                    raise RuntimeError("Pages build failed for " + repository)
            if time.monotonic() > deadline:
                raise RuntimeError("Pages build not confirmed after ten minutes: " + repository)
            time.sleep(5)
        published.append({"repository": repository, "commit": commit, "url": project["url"], "status": "pages_built"})
        (output / "publication-progress.json").write_text(json.dumps({"revision": report["revision"], "published": published}, indent=2), encoding="utf-8")
    if all(p["status"] == "pages_built" for p in published):
        print("All Pages builds completed. Verify the public homepage and five-platform interactions.", flush=True)
    else:
        print("Branches uploaded; some Pages configuration is still pending. The complete website is not confirmed online.", flush=True)


if __name__ == "__main__":
    main()
