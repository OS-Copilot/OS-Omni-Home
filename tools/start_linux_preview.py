"""Start the isolated VMware Linux preview and attach the local homepage."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

HOME = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8900)
    parser.add_argument("--vmx", type=Path, default=HOME.parent / "linux_img/preview-vm/OS-Omni-Linux.vmx")
    parser.add_argument("--source-vmx", type=Path, default=HOME.parent / "linux_img/Ubuntu-x86/Ubuntu.vmx")
    args = parser.parse_args()
    vmrun = shutil.which("vmrun")
    if not vmrun:
        candidate = Path(os.environ.get("ProgramFiles(x86)", "C:/Program Files (x86)")) / "VMware/VMware Workstation/vmrun.exe"
        if candidate.exists():
            vmrun = str(candidate)
    if not vmrun:
        parser.error("VMware Workstation vmrun is required")
    if not args.vmx.exists():
        if not args.source_vmx.exists():
            parser.error("Extract the baseline image first, or set --source-vmx")
        print("Creating an independent full clone. The source baseline is preserved.", flush=True)
        subprocess.run([vmrun, "clone", str(args.source_vmx), str(args.vmx), "full", "-cloneName=OS-Omni-Linux-Preview"], check=True)
    running = subprocess.check_output([vmrun, "list"], text=True)
    if str(args.vmx.resolve()).lower() not in running.lower():
        subprocess.run([vmrun, "start", str(args.vmx), "nogui"], check=True)
    print("Waiting for VMware Tools and the guest IP…", flush=True)
    address = subprocess.check_output([vmrun, "getGuestIPAddress", str(args.vmx), "-wait"], text=True, timeout=180).strip()
    os.environ["OSOMNI_LINUX_URL"] = f"http://{address}:5000"
    os.environ["OSOMNI_LINUX_PROTOCOL"] = "osworld"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(os.environ["OSOMNI_LINUX_URL"] + "/screenshot", timeout=15) as response:
        if not response.read(8).startswith(b"\x89PNG"):
            raise RuntimeError("Guest screenshot service is unavailable")
    print(f"Linux preview ready: http://127.0.0.1:{args.port}/#playground-section", flush=True)
    subprocess.run([sys.executable, str(HOME / "tools/preview.py"), "--port", str(args.port)], check=True, env=os.environ)


if __name__ == "__main__":
    main()
