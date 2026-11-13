# Native OS-Omni playground

This is an optional developer gateway, separate from the current homepage's
browser-local App playground. Its scripts can attach to running baselines for
input and screenshots. The homepage does not mount the old native connection
interface by default. These tools are retained for development, not required by
the packaged static website.

## Start the local gateway

### Downloaded Linux v3 VMware image

```powershell
python tools/start_linux_preview.py --port 8900
```

This uses `../linux_img/preview-vm/OS-Omni-Linux.vmx`. If absent, it creates a
full independent clone from `../linux_img/Ubuntu-x86/Ubuntu.vmx`, starts it
without a VMware window, discovers its IP through VMware Tools, and connects
the local homepage. The archive and extracted source disk remain the baseline.
The v3 image runs an OSWorld-compatible runtime on port 5000, so the launcher
sets `OSOMNI_LINUX_PROTOCOL=osworld`. This adapter uses `/screenshot` and
validated mouse/keyboard operations through `/execute`.

The Linux sidebar reads the running guest's desktop/application launchers.
Click a launcher to open the actual application. Screen coordinates account
for scaling and letterboxing. Unicode text is pasted through the guest's
clipboard; the guest clipboard is replaced by text sent with this method.
Common shortcut buttons avoid browser-reserved key combinations.

Verified in the actual v3 guest: browser connection, launcher inventory,
LibreOffice Writer launch, screen clicking, English/Chinese text entry,
Ctrl+S, and a saved DOCX containing both input strings. This does not assert
that every installed application's feature has been individually tested.
OpenShop and GIMP launchers were also exercised from the browser and their
actual guest windows were verified. Browser checks reported no JavaScript errors.

Set only the endpoints that exist, then run `python tools/preview.py --port 8900`.
Open `http://127.0.0.1:8900/#playground-section` and click Connect.

Desktop environments use the existing OS-Omni guest HTTP runtime:

```powershell
$env:OSOMNI_WINDOWS_URL = 'http://WINDOWS_GUEST:5000'
$env:OSOMNI_LINUX_URL = 'http://LINUX_GUEST:5001'
$env:OSOMNI_MACOS_URL = 'http://MACOS_GUEST:5000'
# Set OSOMNI_WINDOWS_TOKEN, OSOMNI_LINUX_TOKEN and OSOMNI_MACOS_TOKEN
# in the process environment to the corresponding existing runtime tokens.
python tools/preview.py --port 8900
```

For Android, install Android platform-tools and connect a running benchmark AVD:

```powershell
$env:OSOMNI_ANDROID_DEVICE = 'emulator-5554'
# Optional: OSOMNI_ADB_PATH points to adb.exe if it is not on PATH.
```

For iOS, provide an existing prepared Simulator and reachable Appium server:

```powershell
$env:OSOMNI_IOS_APPIUM_URL = 'http://MAC_HOST:4723'
$env:OSOMNI_IOS_UDID = 'SIMULATOR_UDID'
```

The iOS adapter imports the existing OS-Omni controller, so the gateway host
needs its Python Appium dependencies. Appium and XCUITest execute on the Mac.
The environment variables must be set before starting or restarting the gateway.

## Current scope and verification

- Native desktop screenshots use `/observe` with UI-tree collection disabled.
- Desktop actions use the existing `/action` schema and bearer authentication.
- Android screenshots use ADB; taps, swipes and navigation keys use ADB input.
  Text uses the repository controller. Desktop shortcuts and wheel events are
  not currently mapped to Android; drag on the screen to swipe.
- iOS captures and actions use the existing controller. Touch and keyboard
  differences still need real-device integration testing.
- Screen rendering preserves aspect ratio, with coordinates mapped through
  the displayed image's letterboxing. Screenshots are converted to JPEG for
  lower bandwidth and refreshed after a short delay. This is screenshot
  polling, not a low-latency video stream.
- Unconfigured environments display an explicit offline state. A configured
  endpoint is not marked connected until a valid PNG is received.
- The Linux launcher creates/starts a full clone. Baseline reset, per-visitor
  sessions, application installation, task initialization, and public hosting
  are not implemented here.
- The Linux sidebar reads installed launchers. Offline platforms still show
  application families from the paper/task examples.

For the full requested experience, use the actual paper baselines, verify every
installed application and task initializer, then add native video transport,
complete input mappings, baseline restoration, and per-visitor session allocation.

The gateway is a localhost development tool for one user; guest credentials stay
server-side. It is not a public multi-user deployment.
