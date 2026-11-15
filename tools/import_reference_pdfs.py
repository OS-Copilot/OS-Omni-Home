"""One-time migration of benchmark PDF attachments into static browser assets."""
from pathlib import Path, PurePosixPath
import argparse
from concurrent.futures import ThreadPoolExecutor
import re
import urllib.parse
import urllib.request

HOME = Path(__file__).resolve().parents[1]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-url", required=True, help="Running baseline's OSWorld runtime URL; used only for asset migration")
    parser.add_argument("--output", type=Path, default=HOME.parent / "linux_img/reference-pdfs")
    args = parser.parse_args()
    source = HOME.parent / "OS-Omni-V2/apps/_vm_webapps_linux_snapshot/applications/openzotero_web/public/seed-data.js"
    urls = set(re.findall(r'file:///[^"\n]+', source.read_text(encoding="utf-8")))
    args.output.mkdir(parents=True, exist_ok=True)

    def copy(url):
        path = PurePosixPath(urllib.parse.unquote(url[7:]))
        if not str(path).startswith("/home/user/Zotero/storage/") or not re.fullmatch(r"[A-Z0-9]{8}", path.parent.name) or path.suffix.lower() != ".pdf":
            raise ValueError("Unexpected attachment path")
        target = args.output / (path.parent.name + ".pdf")
        if target.exists():
            return target.stat().st_size
        req = urllib.request.Request(args.runtime_url.rstrip("/") + "/file", data=urllib.parse.urlencode({"file_path": str(path)}).encode(), headers={"Content-Type": "application/x-www-form-urlencoded"})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=60) as response:
            data = response.read()
        if not data.startswith(b"%PDF-"):
            raise RuntimeError("Attachment download did not return a PDF")
        target.write_bytes(data)
        return len(data)

    with ThreadPoolExecutor(max_workers=4) as pool:
        sizes = list(pool.map(copy, sorted(urls)))
    print(f"Imported {len(sizes)} original PDF attachments ({sum(sizes) / 1024**2:.1f} MiB). Browser operation does not need the VM.", flush=True)
