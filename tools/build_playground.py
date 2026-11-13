"""Package OS-Omni Web applications for a buildless, browser-local playground."""
from pathlib import Path
import argparse
import json
import os
import shutil
import re
import urllib.parse
import zipfile
from pathlib import PurePosixPath

HOME = Path(__file__).resolve().parents[1]
APPS = [
    ("opendriver", "OpenDriver", "Book demo rides, manage payments, and explore rider and driver workflows.", "#303743", "D"),
    ("opennavigation", "OpenNavigation", "Explore maps, search places, save destinations, and try demo routes.", "#4285db", "N"),
    ("openphoto", "Photo Studio", "Retouch photos, apply filters, stickers, and export images.", "#be65cf", "P"),
    ("opendoc", "Documents", "Write, format, import, and export documents.", "#2778dc", "D"),
    ("opensheet", "Sheets", "Edit cells, formulas, charts, and workbooks.", "#24965d", "S"),
    ("openslide", "Slides", "Build and present slides with text and shapes.", "#e38932", "P"),
    ("openmail", "Mail", "Read, compose, reply, and organize messages.", "#328fe7", "M"),
    ("openshop", "OpenShop", "Search products, edit a cart, and place demo orders.", "#ef7949", "S"),
    ("opentwitter", "OpenTwitter", "Publish posts, follow people, and send messages.", "#459bea", "T"),
    ("openbank", "OpenBank", "Manage demo accounts, transfers, bills, and statements.", "#395eca", "B"),
    ("openfood", "OpenFood", "Browse restaurants, order meals, and track orders.", "#39a77e", "F"),
    ("opentrip", "OpenTrip", "Search travel options and create bookings.", "#27a9cc", "T"),
    ("openrednote", "Rednote", "Publish photo notes, comment, save, and message.", "#eb4866", "R"),
    ("openfinance", "Finance", "Manage accounts, budgets, and transactions.", "#885add", "$"),
    ("openphotoedit", "Photo Editor", "Import photos, adjust colors, crop, and export.", "#bf65cf", "✦"),
    ("openblender", "3D Studio", "Edit objects, materials, lights, and scene views.", "#ee9745", "3D"),
    ("opencode", "Code", "Edit files and projects in a browser workspace.", "#3e9bcf", "</>"),
    ("openwireshark", "Packet Lab", "Inspect seeded captures and apply packet filters.", "#369ac5", "W"),
    ("openzotero", "References", "Manage a library, collections, tags, and notes.", "#db5354", "Z"),
]
SYSTEM = [
    ("habits", "Habits", "Track daily habits and review your progress.", "#48a87c", "?"),
    ("drawing", "Drawing", "Draw with pen and colors, undo strokes, and export PNG.", "#eab456", "?"),
    ("gallery", "Gallery", "Import photos into albums and view your collection.", "#cd668a", "?"),
    ("calendar", "Calendar", "Create, edit, and organize calendar events.", "#e65a62", "31"),
    ("contacts", "Contacts", "Manage names, phone numbers, and email addresses.", "#6397ba", "◎"),
    ("reminders", "Reminders", "Plan tasks, set due dates, and mark completion.", "#aa8adb", "✓"),
    ("notes", "Notes", "Create and edit notes with autosave.", "#e8b83f", "N"),
    ("files", "Files", "Import, organize, and download your local files.", "#589fe4", "▰"),
    ("calculator", "Calculator", "Calculate expressions and review your history.", "#ed9952", "+"),
    ("clock", "Clock", "View time zones and use a stopwatch.", "#444e62", "◷"),
    ("settings", "Settings", "Personalize this device's appearance.", "#8b98a9", "⚙"),
]


def build(source):
    profile_data = json.loads((HOME / "tools/device-profiles.json").read_text(encoding="utf-8"))
    if profile_data.get("linux", {}).get("verified"):
        required = ["linux_img/web-clients-v3/manifest.json", "linux_img/drawio-web.zip", "linux_img/driver-backend-v3/server.js", "linux_img/driver-routing-v3.json.gz"]
        missing = [name for name in required if not (HOME.parent / name).exists()]
        if missing:
            raise RuntimeError("Missing calibrated image assets: " + ", ".join(missing))
    snapshot = source / "apps/_vm_webapps_linux_snapshot/applications"
    output = HOME / "public/playground/apps"
    output.mkdir(parents=True, exist_ok=True)
    for name in ("browser-bridge.js", "browser-bootstrap.js", "ios-app-adapter.js", "system-app.js", "system-app.css", "extra-app.js", "navigation-local.js", "driver-runtime.js", "workflow-app.js", "calendar-app.js", "drawio-adapter.js", "text-editor.js", "device-clock.js", "map-tiles.js"):
        shutil.copy2(HOME / "static" / ("css" if name.endswith(".css") else "js") / name, output / name)
    shutil.copy2(HOME / "static/css/ios-app.css", output / "ios-app.css")
    catalog = []
    for app_id, title, description, color, glyph in APPS:
        folder = "opennote" if app_id == "openrednote" else app_id
        source_root = source / ("apps/" + app_id + "/public") if app_id in {"openphoto", "opennavigation", "opendriver"} else snapshot / (folder + "_web")
        mirror_root = HOME.parent / "linux_img/web-clients-v3" / folder
        if (mirror_root / "index.html").is_file():
            source_root = mirror_root
        if (source_root / "public/index.html").exists():
            source_root /= "public"
        if not (source_root / "index.html").exists():
            raise RuntimeError(f"Missing browser source for {app_id}")
        destination = output / app_id
        for file in source_root.rglob("*"):
            if not file.is_file() or file.suffix.lower() in {".blend1", ".sh", ".icns"} or file.relative_to(source_root).parts[0] == "node_modules":
                continue
            target = destination / file.relative_to(source_root)
            target.parent.mkdir(parents=True, exist_ok=True)
            if file.suffix.lower() == ".html":
                text = file.read_text(encoding="utf-8")
                bridge = os.path.relpath(output / "browser-bridge.js", target.parent).replace("\\", "/")
                bootstrap = os.path.relpath(output / "browser-bootstrap.js", target.parent).replace("\\", "/")
                clock = os.path.relpath(output / "device-clock.js", target.parent).replace("\\", "/")
                text = text.replace("<head>", f'<head><script src="{bridge}"></script><script src="{clock}"></script>', 1)
                if app_id == "opendriver":
                    text = text.replace('</body>', '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="position:fixed;left:8px;bottom:4px;z-index:998;background:#fff;padding:2px 6px;font:12px Arial;color:#333">© OpenStreetMap contributors</a></body>')
                    text = text.replace('<base href="/">', '<base href="./">')
                    text = text.replace('</head>', '<script src="driver-modules.js"></script><script src="../map-tiles.js"></script><script src="../driver-runtime.js"></script></head>')
                    text = text.replace('</body>', '<details style="position:fixed;bottom:12px;right:12px;z-index:999;background:white;border:1px solid #ddd;border-radius:8px;padding:10px;font:12px Arial;max-width:300px"><summary>Demo accounts</summary><p>Rider: rider@example.com<br>Driver: driver@example.com<br>Admin: admin@example.com<br>Password: Password123!</p><small>Use these demo credentials only.</small></details></body>')
                if app_id == "opennavigation":
                    text = text.replace('<div class="list-tabs" id="list-tabs">', '<button id="save-place-button" style="margin:8px 0;padding:8px 14px">Save place</button><div class="list-tabs" id="list-tabs">')
                    text = text.replace('</body>', '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="position:fixed;right:8px;bottom:4px;z-index:30;background:#fff;padding:2px 6px;font:12px Arial;color:#333">© OpenStreetMap contributors</a></body>')
                    text = text.replace("</head>", '<script src="../opendriver/driver-modules.js"></script><script src="../map-tiles.js"></script><script src="../driver-runtime.js"></script><script src="../navigation-local.js"></script></head>')
                needle = '<script src="./app.js"></script>' if '<script src="./app.js"></script>' in text else '<script src="app.js"></script>'
                text = text.replace(needle, f'<script src="{bootstrap}"></script>' + needle)
                target.write_text(text, encoding="utf-8")
            elif app_id == "openzotero" and file.name == "seed-data.js":
                text = file.read_text(encoding="utf-8")
                def attachment(match):
                    path = PurePosixPath(urllib.parse.unquote(match.group(0)[7:]))
                    filename = path.parent.name + ".pdf"
                    cached = HOME.parent / "linux_img/reference-pdfs" / filename
                    if cached.exists():
                        pdf = destination / "assets/papers" / filename
                        pdf.parent.mkdir(parents=True, exist_ok=True)
                        if not pdf.exists() or pdf.stat().st_size != cached.stat().st_size:
                            shutil.copy2(cached, pdf)
                        return "./assets/papers/" + filename
                    arxiv = re.match(r"\d{4}\.\d{4,5}", path.name)
                    return "https://arxiv.org/pdf/" + arxiv.group(0) if arxiv else "about:blank"
                text = re.sub(r'file:///[^"\n]+', attachment, text)
                target.write_text(text, encoding="utf-8")
            elif app_id == "opendriver" and file.name == "flutter_bootstrap.js":
                text = file.read_text(encoding="utf-8")
                text = text[:text.rfind("_flutter.loader.load({")] + '_flutter.loader.load({config:{canvasKitBaseUrl:"./canvaskit/"}});\n'
                target.write_text(text, encoding="utf-8")
            elif file.name == "app.js":
                text = file.read_text(encoding="utf-8")
                if app_id in ("openshop", "opentrip"):
                    text = text.replace('const isLocalShell =', 'const isLocalShell = (window.openshopUseLocalApi === true || window.opentripUseLocalApi === true) ||')
                if app_id == "openfinance":
                    text = text.replace('money(Math.abs(value))', '(window.OSOmniDevice?.platform === "ios" && window.OSOmniDevice.app === "flow" ? moneyExact : money)(Math.abs(value))')
                if app_id == "opennavigation":
                    text = text.replace('const rect = map.getBoundingClientRect();', 'const rect = {width: map.clientWidth, height: map.clientHeight, left:0, top:0};')
                    start = text.index('window.openNavigationTileFallback =')
                    end = text.index('\nconst currentLocationPlace', start)
                    text = text[:start] + 'window.openNavigationTileFallback = image => window.OSOmniMapTiles.recover(image);\n' + text[end:]
                    text = text.replace('panel.getBoundingClientRect().right', '(panel.offsetLeft + panel.offsetWidth)')
                    text = text.replace('async function api(path, options = {}) {', 'async function api(path, options = {}) { return window.OSOmniNavigationAPI(path, options); }\nasync function unusedRemoteApi(path, options = {}) {')
                    text = text.replace('state.savedPlaces = [...state.currentAccount.savedPlaces];', 'state.savedPlaces = JSON.parse(localStorage.getItem("navigation.saved") || "null") || [...state.currentAccount.savedPlaces];')
                    text = text.replace('function bindEvents() {', 'function bindEvents() { document.getElementById("save-place-button").addEventListener("click", () => {const place=state.selectedPlace||(state.directionsMode?state.destination:null);if(!place){setStatus("Choose a place first.");return;}if(!state.savedPlaces.some(p=>p.provider_place_id===place.provider_place_id)){state.savedPlaces.unshift(structuredClone(place));localStorage.setItem("navigation.saved",JSON.stringify(state.savedPlaces));}setStatus("Place saved.");});')
                    text += '\nwindow.addEventListener("pagehide", () => localStorage.setItem("navigation.saved", JSON.stringify(state.savedPlaces)));\n'
                # Shared shopping/travel scripts define their local API in this file.
                for call in ["boot().catch(", "init().catch("]:
                    index = text.rfind(call)
                    if index >= 0:
                        text = text[:index] + "window.OSOmniBrowserBoot && window.OSOmniBrowserBoot();\n" + text[index:]
                        break
                target.write_text(text, encoding="utf-8")
            elif not target.exists() or target.stat().st_size != file.stat().st_size:
                shutil.copy2(file, target)
        if app_id == "opendriver":
            backend = source / "apps/opendriver/shared/backend/src"
            image_backend = HOME.parent / "linux_img/driver-backend-v3"
            if (image_backend / "server.js").is_file():
                backend = image_backend
            parts = ["window.OSOmniDriverModules = {};"]
            for module_id, filename in [("./domain", "domain.js"), ("../domain", "domain.js"), ("./database/seed", "database/seed.js"), ("./seed", "database/seed.js"), ("./database/store", "database/store.js"), ("server", "server.js")]:
                code = (backend / filename).read_text(encoding="utf-8")
                if filename == "domain.js":
                    # These are isolated demo identities, never real authentication.
                    code = re.sub(r'const hash = crypto.pbkdf2Sync[^;]+;', 'const hash = btoa(unescape(encodeURIComponent(String(password) + salt)));', code)
                if filename == "server.js":
                    code = code.replace("const reset = store.resetDb();", "const reset = store.loadDb();")
                    code = code[:code.rfind("\nhttp\n")] + "\nmodule.exports = { handle };"
                parts.append("window.OSOmniDriverModules[" + json.dumps(module_id) + "] = function(require,module,exports,process,__dirname){\n" + code + "\n};")
            routing = HOME.parent / "linux_img/driver-routing-v3.json.gz"
            if routing.exists():
                shutil.copy2(routing, destination / "routing.json.gz")
            (destination / "driver-modules.js").write_text("\n".join(parts), encoding="utf-8")
        if app_id == "opennavigation":
            archive = HOME.parent / "linux_img/map-tiles.zip"
            if archive.exists():
                tile_root = destination / "tiles"
                with zipfile.ZipFile(archive) as bundle:
                    for entry in bundle.infolist():
                        target = tile_root / entry.filename
                        if not target.resolve().is_relative_to(tile_root.resolve()):
                            raise ValueError("Invalid map tile path")
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(bundle.read(entry))
                # Only original, complete tiles. Never create sparse mosaics with blank quadrants.
                original = [entry.filename for entry in bundle.infolist() if entry.filename.endswith('.png')]
                for tile in tile_root.glob('*/*/*.png'):
                    if tile.relative_to(tile_root).as_posix() not in original:
                        tile.unlink()
                (tile_root / "manifest.json").write_text(json.dumps(original), encoding="utf-8")
            css = destination / "styles.css"
            css.write_text(css.read_text(encoding="utf-8") + '\n@media(max-width:480px){.rail{width:52px}.search-pill{left:62px;right:10px;width:auto}.panel{left:52px;width:calc(100% - 52px)}.navigation-overlay{left:62px;right:10px;top:85px}.sign-out{display:none}.category-strip{display:none}}\n', encoding="utf-8")
        icon = next((p for p in (destination / "assets/brand").glob("*.svg") if "icon" in p.name), None)
        if icon is None:
            icon = next((p for p in (destination / "assets/brand").glob("*.png") if "icon" in p.name), None)
        # Preserve the VM launcher artwork byte-for-byte, ahead of app branding.
        vm_name = "actual-budget" if app_id == "openfinance" else app_id
        vm_icon = snapshot.parent / "icons/osomni-desktop" / (vm_name + ".png")
        if vm_icon.exists():
            icon = HOME / "static/images/app-icons" / (app_id + ".png")
            icon.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(vm_icon, icon)
        elif icon is not None:
            # Keep source app artwork tracked, independent of generated packages.
            target_icon = HOME / "static/images/app-icons" / (app_id + icon.suffix)
            target_icon.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(icon, target_icon)
            icon = target_icon
        catalog.append({"id": app_id, "name": title, "description": description, "color": color, "glyph": glyph,
                        "url": f"public/playground/apps/{app_id}/index.html", "icon": str(icon.relative_to(HOME)).replace("\\", "/") if icon else (f"static/images/app-icons/{app_id}.png" if (HOME / f"static/images/app-icons/{app_id}.png").exists() else None), "kind": "web"})
        print("Packaged", title, flush=True)
    for app_id, title, description, color, glyph in SYSTEM:
        catalog.append({"id": app_id, "name": title, "description": description, "color": color, "glyph": glyph,
                        "url": f"public/playground/apps/system.html?app={app_id}", "icon": f"static/images/app-icons/{app_id}.png", "kind": "system"})
    (output / "system.html").write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OS-Omni</title><script src="browser-bridge.js"></script><script src="device-clock.js"></script><link rel="stylesheet" href="system-app.css"></head><body><div id="system-app"></div><script src="calendar-app.js"></script><script src="text-editor.js"></script><script src="system-app.js"></script><script src="extra-app.js"></script><script src="workflow-app.js"></script></body></html>', encoding="utf-8")
    drawio_archive = HOME.parent / "linux_img/drawio-web.zip"
    if drawio_archive.exists():
        destination = output / "drawio"
        with zipfile.ZipFile(drawio_archive) as bundle:
            for entry in bundle.infolist():
                target = destination / entry.filename
                if not target.resolve().is_relative_to(destination.resolve()):
                    raise ValueError("Invalid native draw.io asset")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(bundle.read(entry))
        index = destination / "index.html"
        text = index.read_text(encoding="utf-8").replace('<head>', '<head><script src="../browser-bridge.js"></script><script src="../device-clock.js"></script><script src="../drawio-adapter.js"></script>', 1)
        index.write_text(text, encoding="utf-8")
    for resource in ("ios-system-app.js", "ios-system-app.css"):
        shutil.copy2(HOME / "static" / ("css" if resource.endswith(".css") else "js") / resource, output / resource)
    (output / "ios-system.html").write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="browser-bridge.js"></script><script src="device-clock.js"></script><link rel="stylesheet" href="ios-system-app.css"></head><body><main></main><script src="ios-system-app.js"></script></body></html>', encoding="utf-8")
    for entry in json.loads((HOME / "tools/device-profiles.json").read_text(encoding="utf-8"))["ios"]["applications"]:
        if entry["id"].startswith("ios-"):
            catalog.append({"id":entry["id"],"name":entry["name"],"description":entry["description"],"color":"#007aff","glyph":entry["name"][0],"url":entry["url"],"icon":entry["icon"],"kind":"system","platforms":["ios"]})
    base = {app["id"]: app for app in catalog}
    for workflow in json.loads((HOME / "tools/workflow-apps.json").read_text(encoding="utf-8")):
        engine = workflow["engine"]
        original = base.get(engine)
        url = original["url"] if original else f"public/playground/apps/system.html?app={engine}"
        if workflow["id"] == "drawio" and drawio_archive.exists():
            url = "public/playground/apps/drawio/index.html?offline=1&pwa=0&mode=browser&stealth=1&gapi=0&db=0&gh=0&gl=0&od=0&lang=en"
        if "system.html" in url:
            url += "&title=" + urllib.parse.quote(workflow["name"])
        own_icon = HOME / "static/images/app-icons" / (workflow["id"] + ".png")
        if not own_icon.exists():
            own_icon = own_icon.with_suffix(".svg")
        fallback = {"chat":"contacts", "media":"clock", "browser":"opennavigation", "pdf":"opendoc", "diagram":"drawing", "terminal":"opencode", "imageviewer":"gallery"}.get(engine, engine)
        fallback_icon = base.get(fallback, {}).get("icon")
        catalog.append({"id": workflow["id"], "name": workflow["name"], "description": "Browser workflow edition: " + (original["description"] if original else {"chat":"Contacts, conversations, message search, forwarding, and archiving.", "media":"Import local audio/video, search a queue, and play media.", "browser":"Visit pages and manage bookmarks; embedding depends on the destination.", "pdf":"Import and read PDF documents.", "diagram":"Create, connect, move, and export diagram boxes.", "terminal":"Run a limited command set against browser demo files.", "imageviewer":"Open images, zoom, rotate, and fit them to the viewing area."}[engine]), "color": "#527aa5", "glyph": workflow["name"][0], "url": url, "icon": str(own_icon.relative_to(HOME)).replace("\\", "/") if own_icon.exists() else fallback_icon, "kind": "workflow", "engine": engine, "platforms": workflow["platforms"]})
    for app in catalog:
        if not app["icon"] or not (HOME / app["icon"]).is_file():
            raise RuntimeError("Missing original icon asset for " + app["id"])
    (HOME / "static/js/browser-apps.js").write_text("window.OSOmniBrowserApps = " + json.dumps(catalog, ensure_ascii=False) + ";\n", encoding="utf-8")
    profiles = json.loads((HOME / "tools/device-profiles.json").read_text(encoding="utf-8"))
    from platform_browser_assets import package_platform_assets
    package_platform_assets(HOME, output, profiles)
    (HOME / "static/js/device-profiles.js").write_text("window.OSOmniDeviceProfiles = " + json.dumps(profiles, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Packaged {len(catalog)} implementation entries. Linux image allowlist: {len(profiles['linux']['applications'])} available, {len(profiles['linux']['pending'])} outstanding. Static hosting is sufficient.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=HOME.parent / "OS-Omni-V2")
    build(parser.parse_args().source.resolve())
