"""One-time, read-only extraction of original icon assets from a Linux VM."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

HOME = Path(__file__).resolve().parents[1]
MAPPING = {
    "calendar": "org.gnome.Calendar", "contacts": "org.gnome.Contacts",
    "reminders": "org.gnome.Todo", "notes": "org.gnome.gedit",
    "files": "org.gnome.Nautilus", "calculator": "org.gnome.Calculator",
    "clock": "org.gnome.clocks", "settings": "org.gnome.Settings",
    "gallery": "org.gnome.eog", "habits": "org.gnome.Todo",
    "drawing": "libreoffice-draw", "openphoto": "gimp",
}

MAPPING.update({
 "deltachat":"deltachat-desktop", "drawio":"drawio", "libreoffice-draw":"libreoffice-draw", "spotube":"org.gnome.Rhythmbox", "vlc":"vlc", "mpv":"mpv", "rhythmbox":"org.gnome.Rhythmbox", "chrome":"google-chrome", "safari":"google-chrome", "document-viewer":"org.gnome.Evince", "terminal":"org.gnome.Terminal", "thunderbird":"thunderbird", "k9":"thunderbird", "maily":"thunderbird", "fsnotes":"org.gnome.gedit", "markor":"org.gnome.gedit", "notepad":"org.gnome.gedit", "notepadqq":"org.gnome.gedit", "textedit":"org.gnome.gedit", "vim":"gvim", "actual-budget":"applications-office", "flow":"applications-office", "oinkoin":"applications-office", "quickshop":"applications-internet", "tasks-org":"org.gnome.Todo", "fossify-calendar":"org.gnome.Calendar", "fossify-gallery":"org.gnome.eog", "material-files":"org.gnome.Nautilus", "habit":"org.gnome.Todo", "photos":"shotwell", "maps":"marble", "marble":"marble", "libreoffice-writer":"libreoffice-writer", "libreoffice-calc":"libreoffice-calc", "libreoffice-impress":"libreoffice-impress", "libreoffice":"libreoffice-startcenter", "gimp":"gimp", "blender":"blender", "wireshark":"org.wireshark.Wireshark", "vscode":"vscode", "vscodium":"vscode", "zotero":"applications-science"
})

MAPPING["actual-budget"] = "/home/user/.local/share/icons/osomni-desktop/actual-budget.png"
MAPPING["quickshop"] = "/home/user/.local/share/icons/osomni-desktop/openshop.png"
MAPPING["zotero"] = "/home/user/Applications/Zotero_linux-x86_64/icons/icon128.png"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-url", required=True)
    args = parser.parse_args()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    code = "\n".join([
        "import gi,json", "gi.require_version('Gtk','3.0')",
        "from gi.repository import Gtk", "Gtk.init([])",
        "theme=Gtk.IconTheme.get_default()",
        "names=" + repr(list(set(MAPPING.values()))),
        "print(json.dumps({n:n if n.startswith('/') else (theme.lookup_icon(n,128,0) or theme.lookup_icon('application-x-executable',128,0)).get_filename() for n in names}))",
    ])
    request = urllib.request.Request(args.runtime_url.rstrip("/") + "/execute",
        data=json.dumps({"command": ["python", "-c", code]}).encode(),
        headers={"Content-Type": "application/json"})
    result = json.loads(opener.open(request, timeout=30).read())
    if result.get("returncode") != 0:
        raise RuntimeError("Guest icon lookup failed")
    paths = json.loads(result["output"])
    output = HOME / "static/images/app-icons"
    output.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for app, name in MAPPING.items():
        source = paths[name]
        if not source.startswith(("/usr/share/icons/", "/usr/share/pixmaps/", "/home/user/.local/share/icons/", "/opt/", "/home/user/Applications/Zotero_linux-x86_64/icons/")):
            raise ValueError("Unexpected icon location")
        request = urllib.request.Request(args.runtime_url.rstrip("/") + "/file",
            data=urllib.parse.urlencode({"file_path": source}).encode(),
            headers={"Content-Type": "application/x-www-form-urlencoded"})
        artwork = opener.open(request, timeout=30).read()
        if not artwork.startswith(b"\x89PNG") and not source.endswith(".svg"):
            raise ValueError("Expected original PNG icon")
        target = output / (app + Path(source).suffix)
        target.write_bytes(artwork)
        manifest[app] = {"icon_name": name, "source": source,
            "asset": str(target.relative_to(HOME)).replace("\\", "/"),
            "sha256": hashlib.sha256(artwork).hexdigest(),
            "mapping": "related tool" if app in {"habits", "drawing", "openphoto", "notes"} else "system icon"}
    (output / "system-icons.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Imported", len(manifest), "original VM icon assets")
