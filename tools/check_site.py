"""Read-only homepage preflight: structure, assets, task records and paper values."""
from argparse import ArgumentParser
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import hashlib

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.refs = []
        self.pending = []
        self.scripts = []
        self.styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for key in ("src", "href"):
            if attrs.get(key):
                self.refs.append(attrs[key])
        if attrs.get("aria-disabled") == "true":
            self.pending.append(attrs.get("data-link", tag))
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.styles.append(attrs["href"])


def assignment(path, name):
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\." + re.escape(name) + r"\s*=\s*(.*);\s*$", text, re.S)
    if not match:
        raise ValueError(f"Cannot read data assignment: {path.name}")
    return json.loads(match.group(1))


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark-source", type=Path)
    parser.add_argument("--paper", type=Path)
    args = parser.parse_args()
    errors, warnings = [], []
    page = Page()
    page.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    ids = Counter(page.ids)
    errors.extend(f"Duplicate ID: {key}" for key, count in ids.items() if count > 1)
    checked = set()

    def asset(ref, base=ROOT):
        url = urlsplit(ref)
        if url.scheme or url.netloc or not url.path:
            return
        path = (base / unquote(url.path)).resolve()
        checked.add(path)
        if not path.is_file():
            errors.append(f"Missing asset: {ref}")

    for ref in page.refs:
        if ref.startswith("#"):
            if ref[1:] not in ids:
                errors.append(f"Missing anchor: {ref}")
        else:
            asset(ref)
    for ref in page.styles:
        url = urlsplit(ref)
        if url.scheme or url.netloc:
            continue
        path = ROOT / url.path
        if path.is_file():
            for match in re.finditer(r"url\(\s*['\"]?([^)'\"]+)", path.read_text(encoding="utf-8")):
                asset(match.group(1).strip(), path.parent)

    catalog = json.loads((ROOT / "static/data/task-catalog.json").read_text(encoding="utf-8"))
    tasks = catalog["tasks"]
    task_ids = [task["id"] for task in tasks]
    if len(tasks) != 300 or len(set(task_ids)) != 300:
        errors.append("Expected 300 distinct v1 tasks")
    counts = dict(Counter(task["track"] for task in tasks))
    expected = dict.fromkeys(["linux", "windows", "macos", "android", "ios", "web"], 48)
    expected["cross_device"] = 12
    if counts != expected or counts != catalog["counts"]:
        errors.append("Release task-count mismatch")
    categories = dict(Counter(task["category"] for task in tasks))
    if categories != {"open_series": 181, "reviewed_supplement": 31, "legacy_supplement": 76, "cross_device": 12}:
        errors.append("Release composition mismatch")
    if args.benchmark_source:
        import yaml
        manifest = json.loads((args.benchmark_source / "tasks/v1/manifest.json").read_text(encoding="utf-8"))
        selected = {entry["task_id"]: entry for entry in manifest["tasks"]}
        if set(selected) != set(task_ids):
            errors.append("Public task IDs differ from the authoritative manifest")
        # Compare the public briefs directly, without running task setup or evaluation.
        for task in tasks:
            chosen = selected.get(task["id"], {})
            if (chosen.get("task_path"), chosen.get("track"), chosen.get("category")) != (task["path"], task["track"], task["category"]):
                errors.append(f"Manifest selection mismatch: {task['id']}")
            spec = yaml.safe_load((args.benchmark_source / task["path"]).read_text(encoding="utf-8"))
            if spec["task_id"] != task["id"] or spec["instruction"].strip() != task["instruction"].strip():
                errors.append(f"Stale task brief: {task['id']}")
        if manifest.get("category_counts") != categories:
            errors.append("Manifest category-count mismatch")
    cases = []
    if "recorded-cases" in ids:
        case_data = json.loads((ROOT / "static/data/case-studies.json").read_text(encoding="utf-8"))
        cases = case_data["cases"]
        case_counts = dict(Counter(case["platform"] for case in cases))
        case_sources = json.loads((ROOT / "tools/case-study-sources.json").read_text(encoding="utf-8"))
        if case_counts != {platform: 12 for platform in case_sources}:
            errors.append(f"Recorded library platform counts differ: {case_counts}")
        if len({case["id"] for case in cases}) != len(cases) or len({case["taskId"] for case in cases}) != len(cases):
            errors.append("Recorded library contains duplicate cases")
        for case in cases:
            archived_source = case_sources[case["platform"]]
            if case["source"]["revision"] != archived_source["revision"] or not case["source"]["directory"].startswith(archived_source["directory"] + "/" + archived_source["model"] + "/"):
                errors.append(f"Recorded case source binding differs: {case['id']}")
            if case["stepCount"] < case_sources[case["platform"]]["minimum_steps"]:
                errors.append(f"Replay selection is shorter than its source threshold: {case['id']}")
            if case["evaluationStatus"] not in ("PASS", "FAIL", "ERROR"):
                errors.append(f"Unexpected archived verdict: {case['id']}")
            if len(case["steps"]) != case["stepCount"]:
                errors.append(f"Case step-count mismatch: {case['id']}")
            asset(case["finalScreenshot"]["src"])
            shots = [case["finalScreenshot"]] + [s[key] for s in case["steps"] for key in ("before", "after")]
            for shot in shots:
                if "preview" not in shot:
                    errors.append(f"Missing replay preview: {shot['src']}")
                    continue
                asset(shot["preview"]["src"])
                if abs(shot["preview"]["width"] / shot["preview"]["height"] - shot["width"] / shot["height"]) > .002:
                    errors.append(f"Replay preview aspect-ratio mismatch: {shot['src']}")
            for step in case["steps"]:
                asset(step["before"]["src"])
                asset(step["after"]["src"])
        if len({case["source"]["directory"].split("/")[1] for case in cases}) != 1:
            errors.append("Recorded cases do not come from one model group")
        provenance = json.loads((ROOT / "tools/case-studies-provenance.json").read_text(encoding="utf-8"))
        for item in provenance["assets"]:
            path = ROOT / item["asset"]
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
                errors.append(f"Recorded screenshot changed: {item['asset']}")
        previews = json.loads((ROOT / "tools/case-study-previews.json").read_text(encoding="utf-8"))
        original_hashes = {item["asset"]: item["sha256"] for item in provenance["assets"]}
        for item in previews["assets"]:
            path = ROOT / item["src"]
            if item["sourceSha256"] != original_hashes.get(item["original"]) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
                errors.append(f"Replay preview provenance mismatch: {item['src']}")

    apps = {app["id"]: app for app in assignment(ROOT / "static/js/browser-apps.js", "OSOmniBrowserApps")}
    profiles = assignment(ROOT / "static/js/device-profiles.js", "OSOmniDeviceProfiles")
    app_counts = {}
    for platform, profile in profiles.items():
        if platform not in ["linux", "windows", "macos", "android", "ios"]:
            continue
        app_counts[platform] = 0
        for entry in profile["applications"]:
            app = apps.get(entry["id"])
            if not app:
                errors.append(f"Missing browser implementation: {platform}/{entry['id']}")
                continue
            app_counts[platform] += 1
            asset(entry.get("url") or app["url"])
            if entry.get("icon") or app.get("icon"):
                asset(entry.get("icon") or app["icon"])
        asset(f"static/data/{platform}-app-audit.json")

    rows = re.findall(r'\["([^"]+)","([^"]+)",\[([^\]]+)\],([\d.]+)\]', (ROOT / "static/js/osomni-data.js").read_text(encoding="utf-8"))
    if len(rows) != 8:
        errors.append("Expected seven model rows and one human reference")
    values_checked = 0
    if args.paper:
        import pymupdf
        with pymupdf.open(args.paper) as pdf:
            text = pdf[8].get_text()
        for name, _, scores, average in rows:
            actual = [float(value) for value in scores.split(",")] + [float(average)]
            after_name = text[text.index(name) + len(name):]
            published = [float(value) for value in re.findall(r"\d+\.\d+", after_name)[:8]]
            if actual != published:
                errors.append(f"Camera Ready mismatch: {name}")
            values_checked += len(actual)
    if page.pending:
        warnings.append("Public release links pending: " + ", ".join(page.pending))
    warnings.extend([
        "Citation author/publication metadata is explicitly marked as draft.",
        "Browser inventory counts do not establish native feature parity or evaluator execution.",
        "Browser screenshots, mobile visual QA and public deployment are not verified by this check.",
        "Generated playground and replay media are ignored by Git; deployment needs the packaged assets.",
    ])
    print(json.dumps({"errors": errors, "warnings": warnings, "local_assets_checked": len(checked), "loaded_scripts": len(page.scripts), "task_counts": counts, "task_categories": categories, "recorded_cases": len(cases), "browser_app_counts": app_counts, "paper_values_checked": values_checked}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
