"""Import source-pinned replay examples; never export prompts or reasoning."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath
import hashlib
import json
import shutil

from huggingface_hub import hf_hub_download
from huggingface_hub.errors import LocalEntryNotFoundError
from PIL import Image

HOME = Path(__file__).resolve().parents[1]
REPO = "YUNTA88/osomniresult"
REVISION = "c8c004959aed92a8a32202560370fb9ae87aeafa"
# One recorded model family supplies all examples. Its identity is not a
# presentation feature; exact archive paths are retained for reproducibility.


def selected_cases():
    """Select equal-size libraries of longer, fully recorded attempts."""
    catalog = {task["id"]: task for task in json.loads((HOME / "static/data/task-catalog.json").read_text(encoding="utf-8"))["tasks"]}
    configs = []
    sources = json.loads((HOME / "tools/case-study-sources.json").read_text(encoding="utf-8"))
    for task_id, title in json.loads((HOME / "tools/case-study-selection.json").read_text(encoding="utf-8")):
        task = catalog[task_id]
        platform = task["track"]
        configs.append({"id": task_id.replace(".", "-"), "platform": platform, "archive": sources[platform], "task_id": task_id, "app": (task.get("workflowApps") or task["apps"])[0], "apps": task["apps"], "title": title, "summary": "Follow the recorded actions and compare the final screenshot with the archived evaluator verdict.", "focus": "This is a selected archived attempt, not an aggregate score or a claim that every action succeeded."})
        if task_id.startswith("ios.deltachat."):
            # The archived instruction explicitly uses FSNotes as well as Delta Chat.
            configs[-1]["apps"] = ["Delta Chat", "FSNotes"]
    assert len({config["task_id"] for config in configs}) == len(configs)
    for platform in sources:
        assert sum(config["platform"] == platform for config in configs) == 12
    return configs


def fetch(name, revision=REVISION):
    options = dict(repo_id=REPO, repo_type="dataset", filename=name, revision=revision)
    try:
        return Path(hf_hub_download(**options, local_files_only=True))
    except LocalEntryNotFoundError:
        return Path(hf_hub_download(**options))


def screenshot_path(prefix, relative):
    relative = str(relative).replace("\\", "/")
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts or ":" in relative:
        raise ValueError("Unexpected screenshot path")
    return prefix + "/" + relative


def import_case(config):
    archive = config["archive"]
    revision = archive["revision"]
    prefix = archive["directory"] + "/" + archive["model"] + "/" + config["task_id"]
    result = json.loads(fetch(prefix + "/result.json", revision).read_text(encoding="utf-8"))
    args = json.loads(fetch(prefix + "/args.json", revision).read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in fetch(prefix + "/trajectory.jsonl", revision).read_text(encoding="utf-8").splitlines() if line.strip()]
    assert result["task_id"] == config["task_id"]
    assert len(rows) == result["steps_taken"]
    assert len(rows) >= archive["minimum_steps"], "Replay selection is shorter than its source threshold"
    evaluation = result.get("evaluation") or {}
    assert evaluation.get("status") in ("PASS", "FAIL", "ERROR")
    instruction = args["task"]["snapshot"]["instruction"]
    destination = HOME / "public/case-studies" / config["id"]
    destination.mkdir(parents=True, exist_ok=True)
    remote_paths = [screenshot_path(prefix, row["observation"]["screenshot_path"]) for row in rows]
    remote_paths.append(screenshot_path(prefix, result["final_observation"]["screenshot_path"]))
    with ThreadPoolExecutor(max_workers=5) as pool:
        images = list(pool.map(lambda name: fetch(name, revision), remote_paths))
    shots, provenance = [], []
    for index, (remote, cached) in enumerate(zip(remote_paths, images)):
        name = ("final" if index == len(rows) else f"step-{index + 1:03d}") + cached.suffix.lower()
        target = destination / name
        shutil.copyfile(cached, target)
        with Image.open(target) as image:
            width, height = image.size
        shots.append({"src": target.relative_to(HOME).as_posix(), "width": width, "height": height})
        provenance.append({"asset": target.relative_to(HOME).as_posix(), "source_path": remote, "source_revision": revision, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
    steps = []
    for index, row in enumerate(rows):
        parsed = row.get("action_parse") or {}
        action = parsed.get("action") or {}
        execution = row.get("action_execution") or {}
        kind = action.get("type") or "unparsed"
        # Only the explicit executed action is exported, never llm_response,
        # prompts, reasoning, encrypted content, credentials, or host config.
        steps.append({"number": row["step_index"], "before": shots[index], "after": shots[index + 1], "actionType": kind, "code": action.get("code", ""), "parseStatus": parsed.get("status", "UNAVAILABLE"), "executionStatus": execution.get("status", "NOT_EXECUTED"), "parseError": parsed.get("error") if parsed.get("error") == "missing_python_code_block" else None})
    case = {key: value for key, value in config.items() if key not in ("milestones", "task_id", "archive")}
    milestones = config.get("milestones") or [(i, "Start" if i == 0 else "Step " + str(i + 1)) for i in sorted({0, len(rows) // 3, 2 * len(rows) // 3})]
    case.setdefault("evidence", "Archived final-state evaluator: " + evaluation["status"] + ". This verdict is preserved from the source run.")
    runner_status = (result.get("episode_result") or {}).get("status", "UNAVAILABLE")
    if runner_status != "PASS":
        case["focus"] += " The episode runner reported " + runner_status + "; its status is separate from the final-state evaluator."
    case.update({"taskId": config["task_id"], "instruction": instruction, "stepCount": len(rows), "durationSeconds": round(result.get("latency_ms", 0) / 1000), "recordedStatus": result["status"], "evaluationStatus": evaluation["status"], "evaluationMessage": evaluation.get("message", ""), "runnerStatus": runner_status, "finalScreenshot": shots[-1], "steps": steps, "milestones": [{"index": i, "label": label} for i, label in milestones] + [{"index": len(rows), "label": "Final state"}], "source": {"repo": REPO, "revision": revision, "directory": prefix}})
    return case, provenance


def main():
    cases, provenance = [], []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for case, assets in pool.map(import_case, selected_cases()):
            cases.append(case)
            provenance.extend(assets)
            print(case["platform"], case["stepCount"], "recorded steps; evaluator", case["evaluationStatus"], flush=True)
    sources = json.loads((HOME / "tools/case-study-sources.json").read_text(encoding="utf-8"))
    payload = {"source": {"repo": REPO, "platforms": sources}, "note": "Selected recorded examples, not aggregate benchmark results. Replay timing is compressed. Model names are omitted from presentation.", "cases": cases}
    (HOME / "tools/case-studies-provenance.json").write_text(json.dumps({"repo": REPO, "platforms": sources, "assets": provenance}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Imported", len(cases), "cases and", len(provenance), "unmodified source screenshots")
    from build_case_previews import build_previews
    # Keep the current replay library visible until all new previews are ready.
    build_previews(payload)


if __name__ == "__main__":
    main()
