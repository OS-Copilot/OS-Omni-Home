"""Combine inspected image launchers, browser checks, and explicit parity gaps."""
import argparse
import json
from pathlib import Path

HOME = Path(__file__).resolve().parents[1]
GAPS = {
    "calendar": ["原生日历数据库尚未导入", "重复事件、在线同步及联系人生日联动未实现"],
    "drawio": ["Electron 本地文件系统及桌面专用导出接口已改为浏览器存储/下载"],
    "files": ["镜像文件系统尚未挂载到浏览器工作区", "文件权限、挂载、回收站等原生功能未实现"],
    "notes": ["原生最近文件和文件系统未导入", "语法高亮、插件和完整 gedit 设置未实现"],
    "vim": ["当前仍为通用编辑器替代", "Vim 模式、命令、键位及插件未还原"],
    "terminal": ["当前只有浏览器演示命令", "原生 shell、程序执行及 Linux 文件系统未接入"],
    "settings": ["目前只支持浏览器外观设置", "GNOME 网络、声音、用户、显示器、隐私等系统面板未还原"],
    "calculator": ["仅基本表达式和历史记录可用", "高级、金融和编程模式及单位换算未还原"],
    "marble": ["当前使用 OpenNavigation 替代界面", "Marble 球体、地图主题、KML/GPX 和完整地理搜索未还原"],
    "opennavigation": ["地图仅覆盖镜像中的缓存区域", "路线是明确标注的演示估算，未接原版道路/公交路由数据"],
    "chrome": ["目前为网页嵌入和书签工作流", "Chrome 标签、扩展、下载历史及被禁止嵌入的网站未还原"],
    "deltachat": ["目前为本地聊天工作流，未复用原生客户端", "真实邮件账户、同步、附件及完整群组能力未接入"],
    "thunderbird": ["使用镜像 OpenMail 网页对应版本", "原生 Thunderbird 界面、账户、邮件同步和日历扩展未还原"],
    "actual-budget": ["使用镜像 OpenFinance 网页对应版本", "原生预算数据库、完整预算表和 Actual 客户端界面未还原"],
    "libreoffice-writer": ["使用镜像 OpenDoc 网页对应版本", "不是原生 Writer，复杂文档、宏、打印及高级格式功能未完整还原"],
    "libreoffice-calc": ["使用镜像 OpenSheet 网页对应版本", "不是原生 Calc，完整函数、数据透视表、宏及复杂工作簿兼容性未验证"],
    "libreoffice-impress": ["使用镜像 OpenSlide 网页对应版本", "不是原生 Impress，动画、母版及复杂演示兼容性未完整还原"],
    "libreoffice-draw": ["目前仍为简化流程图工作流", "原生 Draw 页面、形状库及文件格式未还原"],
    "gimp": ["使用镜像 OpenPhotoEdit 网页对应版本", "原生 GIMP 界面、XCF、插件及完整图像操作未还原"],
    "blender": ["使用镜像 OpenBlender 网页对应版本", "原生 Blender、完整 blend 格式、编辑器和渲染器未还原"],
    "wireshark": ["使用镜像 OpenWireshark 网页对应版本", "原生抓包、网络接口及完整协议解析未接入"],
    "vscode": ["使用镜像 OpenCode 网页对应版本", "原生扩展宿主、调试器、终端和文件系统未接入"],
    "zotero": ["使用镜像 OpenZotero 网页对应版本", "原生数据库、完整插件/同步及文档编辑器集成未还原"],
    "shotwell": ["浏览器相册，非原生 Shotwell", "原始照片库、标签、EXIF 和完整照片管理功能未导入/还原"],
    "image-viewer": ["浏览器图像查看器，非原生 EOG", "原生图片列表、元数据和完整保存格式未还原"],
    "document-viewer": ["使用浏览器 PDF 插件", "原生最近文件、批注、签名及其他 Evince 支持格式未还原"],
    "reminders": ["本地待办列表，非原生 GNOME To Do", "原生账户同步、列表分组和完整子任务能力未还原"],
    "opendriver": ["原版 Flutter 页面使用浏览器演示后端", "真实调度/支付未接入，原版地图和完整原生环境兼容性未验证"],
}
MEDIA = {"vlc", "mpv", "rhythmbox"}
IMAGE_CLIENTS = {"openbank", "openfood", "openshop", "opentwitter", "openrednote", "opentrip", "opennavigation"}

def audit(inventory, browser_results):
    profiles = json.loads((HOME / "tools/device-profiles.json").read_text(encoding="utf-8"))
    profile = profiles["linux"]
    inspected = json.loads(inventory.read_text(encoding="utf-8"))
    checks = {r["id"]: r for r in json.loads(browser_results.read_text(encoding="utf-8"))}
    native = {r["id"]: r for r in inspected if "error" not in r}
    rows = []
    for app in profile["applications"]:
        ident = app["id"]
        gaps = GAPS.get(ident, ["演示业务记录保存在访客浏览器中，未验证与原生程序的全部功能一致"])
        if ident in MEDIA:
            gaps = ["使用本地媒体导入/播放队列替代", "原生媒体库、流媒体、均衡器及完整格式支持未还原"]
        category = "浏览器重建，功能不完整"
        if ident in IMAGE_CLIENTS:
            category = "镜像网页客户端，浏览器适配"
        elif ident == "drawio":
            category = "镜像原版网页编辑器"
        elif ident in {"actual-budget", "thunderbird", "libreoffice-writer", "libreoffice-calc", "libreoffice-impress", "gimp", "blender", "wireshark", "vscode", "zotero"}:
            category = "镜像网页对应版本，非原生客户端"
        elif ident == "opendriver":
            category = "原版 Flutter 界面，演示后端"
        result = checks.get(ident)
        rows.append({"id": ident, "name": app["name"], "desktop_entry": app["desktop_entry"],
            "native_executable_exists": native.get(app["desktop_entry"], {}).get("exists"),
            "status": category, "browser_load_checked": result is not None,
            "browser_load_errors": result["load_errors"] if result else None,
            "native_full_feature_parity": False, "known_gaps": gaps})
    for app in profile["pending"]:
        exists = native.get(app["desktop_entry"], {}).get("exists")
        rows.append({"name": app["name"], "desktop_entry": app["desktop_entry"],
            "native_executable_exists": exists,
            "status": "镜像启动项对应程序缺失" if exists is False else "尚未接入网页",
            "browser_load_checked": False, "browser_load_errors": None,
            "native_full_feature_parity": False,
            "known_gaps": ["未提供该应用的网页实现"]})
    report = {"platform": "linux", "source": "OS-Omni Ubuntu x86 v3 image",
        "display": profile["display"], "desktop_entries_inspected": len(inspected),
        "catalog_entries": len(rows), "browser_implementations_checked": len(checks),
        "not_implemented_or_broken": len(profile["pending"]),
        "note": "加载检查不代表原生功能一致。每项保留已确认的功能缺口；未接入项不计为通过。",
        "applications": rows}
    output = HOME / "static/data/linux-app-audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--browser-results", type=Path, required=True)
    args = parser.parse_args()
    report = audit(args.inventory, args.browser_results)
    print("Audited", report["catalog_entries"], "image entries;", report["browser_implementations_checked"], "browser load checks")
