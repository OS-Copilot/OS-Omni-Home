"""Copy the complete static website into a deployment-ready directory."""
from pathlib import Path
import argparse
import json
import shutil

HOME = Path(__file__).resolve().parents[1]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=HOME.parent / "output/browser-site")
    parser.add_argument("--check-only", action="store_true", help="Validate packaging inputs and report size without copying files")
    args = parser.parse_args()
    if not (HOME / "public/playground/apps/system.html").exists():
        parser.error("Run tools/build_playground.py first")
    manifest_path = HOME / "static/data/case-studies.json"
    if not manifest_path.is_file():
        parser.error("Run tools/import_case_studies.py first")
    cases = json.loads(manifest_path.read_text(encoding="utf-8"))["cases"]
    required_media = set()
    for case in cases:
        shots = [case["finalScreenshot"]] + [step[key] for step in case["steps"] for key in ("before", "after")]
        for shot in shots:
            required_media.add(shot["src"])
            if "preview" not in shot:
                parser.error("Replay previews are missing; run tools/import_case_studies.py")
            required_media.add(shot["preview"]["src"])
    missing = []
    for relative in required_media:
        path = (HOME / relative).resolve()
        if not path.is_relative_to(HOME):
            parser.error("Replay asset path escaped the website directory")
        if not path.is_file():
            missing.append(relative)
    if missing:
        parser.error(f"{len(missing)} replay media files are missing; run tools/import_case_studies.py")
    if args.check_only:
        files = [p for folder in ("static", "public") for p in (HOME / folder).rglob("*") if p.is_file()]
        total = sum(p.stat().st_size for p in files)
        print(f"Packaging inputs present: {len(cases)} cases, {len(required_media)} replay media files, generated App pack")
        print(f"Complete static content: {len(files)} files, {total / 1024**3:.2f} GiB")
        print("No artifact copied. Generated App and replay directories must be deployed separately from the source Git push.")
        raise SystemExit(0)
    output = args.output.resolve()
    if output == HOME or output in HOME.parents or output.is_relative_to(HOME / "public") or output.is_relative_to(HOME / "static"):
        parser.error("Choose a separate artifact directory")
    output.mkdir(parents=True, exist_ok=True)
    def copy_asset(source, destination):
        target=Path(destination)
        if not target.resolve().is_relative_to(output):
            raise RuntimeError("Artifact destination escaped its output directory")
        if target.exists():
            target.chmod(0o666)
        return shutil.copy2(source, destination)
    for name in ("index.html", "404.html"):
        copy_asset(HOME / name, output / name)
    for name in ("static", "public"):
        shutil.copytree(HOME / name, output / name, dirs_exist_ok=True, copy_function=copy_asset)
        # Remove obsolete generated files, including old sparse map mosaics.
        # Copying over an existing artifact alone would leave them reachable.
        artifact_root=(output / name).resolve()
        for target in artifact_root.rglob("*"):
            if not target.is_file():
                continue
            if not target.resolve().is_relative_to(artifact_root):
                raise RuntimeError("Artifact path escaped its output directory")
            if not (HOME / name / target.relative_to(artifact_root)).exists():
                target.chmod(0o666)
                target.unlink()
    license_source = HOME.parent / "OS-Omni-V2/LICENSE"
    if license_source.exists():
        shutil.copy2(license_source, output / "APPLICATION-LICENSE.txt")
    print(f"Standalone static site: {output}", flush=True)
    print("Deploy the contents to a static host with sufficient asset capacity. No VM, Python API, or app server is required.", flush=True)
