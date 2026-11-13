"""Local input/screenshot gateway to existing OS-Omni runtimes.

Endpoints and bearer credentials come from the process environment, never the
browser. This attaches to running devices; it does not provision or reset VMs.
"""
import base64
import io
import json
import os
import shutil
import subprocess
import sys
import threading
import urllib.request
from pathlib import Path

PLATFORMS = ("windows", "linux", "macos", "ios", "android")
ALLOWED = {"tap", "double_tap", "right_click", "drag", "scroll", "type_text", "keyboard", "hotkey", "move", "launch_app"}


def validate_action(action):
    if not isinstance(action, dict) or action.get("type") not in ALLOWED:
        raise ValueError("Unsupported input action")
    kind = action["type"]
    result = {"type": kind}
    for key in ("target", "from_target", "to_target"):
        if key in action:
            point = action[key]
            if not isinstance(point, list) or len(point) != 2 or any(type(v) not in (int, float) or not 0 <= v <= 32768 for v in point):
                raise ValueError("Invalid screen coordinate")
            result[key] = [int(v) for v in point]
    if kind in {"tap", "double_tap", "right_click"} and "target" not in result:
        raise ValueError("Missing target")
    if kind == "drag" and not all(k in result for k in ("from_target", "to_target")):
        raise ValueError("Missing drag coordinates")
    if kind == "type_text":
        text = action.get("text")
        if not isinstance(text, str) or not text or len(text) > 10000:
            raise ValueError("Enter between 1 and 10000 characters")
        result["text"] = text
    if kind == "scroll":
        if action.get("direction") not in {"up", "down", "left", "right"}:
            raise ValueError("Invalid scroll direction")
        result.update(direction=action["direction"], distance=3)
    if kind == "keyboard":
        if action.get("action") not in {"enter", "escape", "backspace", "delete", "tab", "space", "up", "down", "left", "right", "home", "end", "pageup", "pagedown", "insert", *[f"f{i}" for i in range(1, 13)]}:
            raise ValueError("Unsupported key")
        result["action"] = action["action"]
    if kind == "hotkey":
        keys = action.get("keys")
        if not isinstance(keys, list) or not 1 <= len(keys) <= 4 or any(not isinstance(k, str) or len(k) > 20 for k in keys):
            raise ValueError("Invalid shortcut")
        result["keys"] = keys
    if kind == "move" and "target" not in result:
        raise ValueError("Missing pointer target")
    if kind == "launch_app":
        if not isinstance(action.get("app_id"), str) or len(action["app_id"]) > 1000:
            raise ValueError("Invalid app launcher")
        result["app_id"] = action["app_id"]
    return result


class NativeGateway:
    def __init__(self, source):
        self.source = Path(source)
        self.locks = {p: threading.Lock() for p in PLATFORMS}
        self.ios = None
        self.app_cache = {}

    def configured(self, platform):
        if platform in ("windows", "linux", "macos"):
            return bool(os.environ.get(f"OSOMNI_{platform.upper()}_URL"))
        if platform == "android":
            return bool(os.environ.get("OSOMNI_ANDROID_DEVICE"))
        return bool(os.environ.get("OSOMNI_IOS_UDID") and os.environ.get("OSOMNI_IOS_APPIUM_URL"))

    def status(self):
        return {p: {"configured": self.configured(p)} for p in PLATFORMS}

    def request(self, platform, path, payload=None):
        url = os.environ[f"OSOMNI_{platform.upper()}_URL"].rstrip("/") + path
        headers = {}
        token = os.environ.get(f"OSOMNI_{platform.upper()}_TOKEN")
        if token:
            headers["Authorization"] = "Bearer " + token
        if payload is not None:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(req, timeout=15) as response:
            return response.read()

    def osworld(self, platform):
        return os.environ.get(f"OSOMNI_{platform.upper()}_PROTOCOL") == "osworld"

    def execute_guest(self, platform, code):
        result = json.loads(self.request(platform, "/execute", {"command": ["python", "-c", code]}))
        if result.get("returncode") != 0:
            raise RuntimeError("Guest operation failed")
        return result.get("output", "")

    def apps(self, platform):
        if platform != "linux" or not self.configured(platform) or not self.osworld(platform):
            return []
        code = '''import pathlib,json
from configparser import ConfigParser
result=[]
for folder in [pathlib.Path.home()/"Desktop",pathlib.Path("/usr/share/applications")]:
 for p in folder.glob("*.desktop"):
  try:
   c=ConfigParser(interpolation=None);c.read(p);d=c["Desktop Entry"]
   if d.get("Type")=="Application" and d.get("NoDisplay", "false").lower()!="true":result.append({"id":str(p),"name":d.get("Name",p.stem),"featured":"Desktop" in str(p)})
  except Exception:pass
desktop=pathlib.Path.home()/"Desktop"
for p in (desktop/"webpage").glob("*.html"):
 result.append({"id":str(p),"name":p.stem,"featured":True})
print(json.dumps(result))'''
        with self.locks[platform]:
            result = json.loads(self.execute_guest(platform, code))
            self.app_cache[platform] = {a["id"] for a in result}
            # Prefer desktop launchers when installed and desktop entries duplicate.
            unique = {}
            for app in sorted(result, key=lambda a: not a["featured"]):
                unique.setdefault(app["name"], app)
            return sorted(unique.values(), key=lambda a: (not a["featured"], a["name"].lower()))

    def osworld_action(self, platform, action):
        if action["type"] == "launch_app":
            if action["app_id"] not in self.app_cache.get(platform, set()):
                raise ValueError("App is not in this device's installed launcher inventory")
            argv = ["gio", "launch", action["app_id"]] if action["app_id"].endswith(".desktop") else ["xdg-open", action["app_id"]]
            self.execute_guest(platform, "import subprocess;subprocess.run(" + repr(argv) + ",stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=10)")
            return {"success": True}
        encoded = base64.b64encode(json.dumps(action).encode()).decode()
        code = '''import pyautogui as p,json,base64,time
p.FAILSAFE=False
a=json.loads(base64.b64decode("''' + encoded + '''"));k=a["type"]
if k=="tap":p.click(*a["target"])
elif k=="double_tap":p.doubleClick(*a["target"],interval=0.12)
elif k=="right_click":p.click(*a["target"],button="right")
elif k=="move":p.moveTo(*a["target"])
elif k=="drag":p.moveTo(*a["from_target"]);p.dragTo(*a["to_target"],duration=0.4)
elif k=="scroll":
 if "target" in a:p.moveTo(*a["target"])
 direction=a["direction"]
 (p.hscroll if direction in ("left","right") else p.scroll)(3 if direction in ("up","right") else -3)
elif k=="keyboard":p.press({"escape":"esc"}.get(a["action"],a["action"]))
elif k=="hotkey":p.hotkey(*a["keys"])
elif k=="type_text":
 if a["text"].isascii():p.write(a["text"],interval=0.005)
 else:
  import tkinter as tk
  w=tk.Tk();w.withdraw();w.clipboard_clear();w.clipboard_append(a["text"]);w.update()
  p.hotkey("ctrl","v")
  until=time.monotonic()+0.4
  while time.monotonic()<until:w.update();time.sleep(0.01)
  w.destroy()
'''
        self.execute_guest(platform, code)
        return {"success": True}

    def adb(self, arguments):
        executable = os.environ.get("OSOMNI_ADB_PATH") or shutil.which("adb")
        if not executable:
            raise RuntimeError("ADB is not installed; set OSOMNI_ADB_PATH")
        return subprocess.run([executable, "-s", os.environ["OSOMNI_ANDROID_DEVICE"], *arguments],
                              capture_output=True, check=True, timeout=10).stdout

    def ios_controller(self):
        if self.ios is None:
            sys.path.insert(0, str(self.source))
            from platforms.ios.runtime_env.controller import iOSController
            self.ios = iOSController(server_url=os.environ["OSOMNI_IOS_APPIUM_URL"], udid=os.environ["OSOMNI_IOS_UDID"])
        return self.ios

    def screenshot(self, platform):
        if platform not in PLATFORMS or not self.configured(platform):
            raise ValueError("This platform has no configured running environment")
        with self.locks[platform]:
            if platform in ("windows", "linux", "macos"):
                if self.osworld(platform):
                    image = self.request(platform, "/screenshot")
                else:
                    data = json.loads(self.request(platform, "/observe?include_ui_tree=0&include_screenshot_data=1"))
                    image = base64.b64decode(data["screenshot_data_base64"], validate=True)
            elif platform == "android":
                image = self.adb(["exec-out", "screencap", "-p"])
            else:
                image = self.ios_controller().get_screenshot_png()
            if not image.startswith(b"\x89PNG\r\n\x1a\n"):
                raise RuntimeError("Runtime did not return a PNG screenshot")
            return image

    def frame(self, platform):
        image = self.screenshot(platform)
        try:
            from PIL import Image
            out = io.BytesIO()
            Image.open(io.BytesIO(image)).convert("RGB").save(out, "JPEG", quality=82)
            return out.getvalue(), "image/jpeg"
        except ImportError:
            return image, "image/png"

    def action(self, platform, action):
        action = validate_action(action)
        if platform not in PLATFORMS or not self.configured(platform):
            raise ValueError("This platform has no configured running environment")
        with self.locks[platform]:
            if platform in ("windows", "linux", "macos"):
                result = self.osworld_action(platform, action) if self.osworld(platform) else json.loads(self.request(platform, "/action", {"action": action, "ui_nodes": []}))
            elif platform == "ios":
                controller = self.ios_controller()
                if action["type"] == "type_text":
                    controller.type_text(action["text"])
                    result = {"success": True}
                else:
                    result = controller.execute_action(action, [])
            else:
                kind = action["type"]
                if kind == "tap":
                    self.adb(["shell", "input", "tap", *map(str, action["target"])])
                elif kind == "drag":
                    self.adb(["shell", "input", "swipe", *map(str, action["from_target"] + action["to_target"]), "400"])
                elif kind == "keyboard":
                    code = {"enter": 66, "escape": 4, "backspace": 67, "delete": 112, "tab": 61, "space": 62,
                            "up": 19, "down": 20, "left": 21, "right": 22}[action["action"]]
                    self.adb(["shell", "input", "keyevent", str(code)])
                elif kind == "type_text":
                    # Android's shell input is ASCII-only; use repository controller for Unicode.
                    sys.path.insert(0, str(self.source))
                    from platforms.android.controller import AdbController
                    controller = AdbController(adb_device=os.environ["OSOMNI_ANDROID_DEVICE"], adb_path=os.environ.get("OSOMNI_ADB_PATH") or shutil.which("adb"))
                    result = controller.execute_action(action, [])
                    if result.get("success") is False:
                        return result
                else:
                    raise ValueError("Use touch dragging on Android for swipes; this input is not supported")
                result = {"success": True}
            return result

    def close(self):
        if self.ios:
            self.ios.quit()
