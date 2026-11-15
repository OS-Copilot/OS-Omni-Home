# Browser-local device playground

Android V3 and Windows v3.1 are now imported from their own inspected images.
`import_android_profile.py` consumes the APK audit, original drawer icon captures
and embedded WebView assets. `import_windows_profile.py` consumes the native
shortcut/Start menu audit, extracted icon resources and Electron ASAR frontend
caches. `platform_browser_assets.py` packages those distinct sources and injects
the browser storage/runtime adapters. Profile URL and icon overrides prevent
another platform's asset set from being silently substituted. Android uses the
image's 1080×2400 display at 420 dpi (411×914 CSS pixels); Windows uses the audited
1920×1080 virtual desktop and Pacific timezone. The 1024×768 measurement from
Windows' noninteractive execution session is retained as source metadata, rather
than used as the webpage viewport. Browser-only reconstructions
retain the limitations recorded in the platform audits.

The default homepage now follows the reference site's architecture: device shells
and applications run inside each visitor's browser. There are no native runtime
requests, no shared VM, and no server-side mutable application data.

## Build and preview

```powershell
python tools/build_playground.py
python tools/serve_browser.py
```

Open `http://127.0.0.1:8899/#playground-section` or port 8900. The build reads Web
application sources from a sibling `OS-Omni-V2` checkout. Override the location
with `--source /path/to/OS-Omni-V2`. After the build, any ordinary static server
works, including `python -m http.server 8899`. Application source files in V2
are left unchanged.

## Deploy as a static site

```powershell
python tools/package_browser_site.py
```

The output is `../output/browser-site/`. Deploy **the contents** of that directory
to the intended static host. It includes the generated application assets;
uploading only the homepage and JS files is not sufficient. Normal visitors
load the page and the assets needed by opened applications. They do not download
the VM archive or the whole deployment directory.

The generated asset pack is ignored by Git. The tracked build script and catalog
provide a reproducible source path; a deployment must include the built pack.
The current pack contains high-resolution benchmark media, so its full deployment
size is about 815 MiB without reference PDFs, or about 1.25 GiB with the 80
original PDF attachments. Choose a static host with sufficient asset capacity.
A build does not require npm or a JavaScript framework.

The reference library's original PDF attachments were migrated once from the
downloaded image with `tools/import_reference_pdfs.py --runtime-url URL` into
`../linux_img/reference-pdfs/`. The build copies them into static app assets and
rewrites VM-local file URLs. This is an asset migration step, not a runtime
dependency. If the cache is absent, the build links to the corresponding public
arXiv PDF URLs instead.

## Applications and scope

Six surfaces are available: iPhone/iOS, Android, Windows, macOS, Ubuntu/Linux,
and a browser workspace. Desktops include draggable/resizable windows,
minimize/maximize/close controls, an application launcher, and a running-app dock.
Phones use full-screen applications, a pinned dock, and a Home gesture button.
The hero device is also interactive.

The packaging catalog has 74 entries: 19 reused Web applications, 11 system utilities,
and 42 named browser workflow editions for the paper's platform-specific apps.
Workflow editions reuse 6 new engines or an existing browser engine; they are not
42 ports of the native applications. The launcher and description identify the
workflow scope. The launcher uses `tools/device-profiles.json` as an allowlist. Linux has 37 browser implementations matching inspected image entries; 32 further image entries are recorded as outstanding or broken launchers. Other OS inventories are unavailable and do not borrow this list. Safari is absent from Linux and Web launchers.

OpenDriver preserves the original compiled Flutter renderer plus its server,
domain, and seed logic. A per-frame browser adapter replaces HTTP, database file
I/O, and demo credential processing. Real account authentication, payments,
external dispatch, and unrestricted road routing are not connected. The original
business validation, rider/driver/admin records, fare estimation, ride requests,
and history execute against the visitor's own browser database. Demo identities
are not a secure account system. Bootstrap preserves saved state; Reset device
clears it. CanvasKit loads from the packaged app assets, without a service worker.

The new engines support demo contacts/chats, message forwarding/archiving/search,
diagrams with editable draggable boxes and SVG/JSON export, local media import and
queue playback, browser navigation/bookmarks, imported PDF viewing, and a limited
terminal operating on browser demo files. Notes supports folders and moving notes.
Streaming providers, real messaging delivery, the native shell, and the full
original LibreOffice/GIMP/Blender features are not replicated.

Messages, orders, transfers, and bookings are simulated records within the user's
browser workspace; they do not send mail to real recipients or transact with
commercial services.

## Data isolation and integration

- Each browser/profile owns its own localStorage and IndexedDB. There is no
  application backend that could mix visitor data.
- App storage keys are namespaced by platform and application. Reload preserves
  data; switching platforms retains separate workspaces.
- Files uses IndexedDB for imported/exported Blob objects, shared between apps
  on the same device. Exports remain available through the normal browser download
  flow and are also registered in Files.
- Device reset removes only that platform's browser data and file records.
  Persistence is suspended on closing frames during reset so unload autosave
  cannot re-create erased document state.
- Existing seed accounts are initialized for demo use. Real user credentials and
  native runtime tokens are not needed by the browser application pack.

## Verification

The 37 current Linux implementations were loaded in a real browser without script errors. Functional
checks covered shopping-cart writes, mail compose/send, social posts and direct
messages, calendar creation, calculator results, note autosave/export to Files,
reload persistence, two isolated browser contexts, per-platform isolation,
and reset with document unload autosave. Phone-width shopping and calendar
workflows were exercised. Native-runtime requests were absent.

The earlier native gateway files remain as optional development tools; they are
not loaded by the current homepage and are not required for this architecture.

The virtual display uses a fixed CSS viewport (Linux 1920?1080; fallback desktop 1440?900, phone 390?844). The display scales uniformly to fit the page; host resizing does not change app breakpoints. Window dragging converts screen coordinates back into device coordinates. Added Photo Studio, Habits, Drawing, and Gallery are browser-local implementations.

OpenNavigation reuses the original renderer, VM launcher icon, built-in place fixtures, and 354 original cached map tiles (coverage is limited). Browser demo routes use the upstream mock-provider approach and are explicitly labelled estimates, not real road navigation. App visibility follows the verified image inventory; complex desktop tools retain their desktop interface inside the phone viewport. Tile migration cache is linux_img/map-tiles.zip; rebuild generates parent zoom levels with Pillow.

The expanded catalog was checked against app families in the repository task
YAMLs. Coverage includes DeltaChat, draw.io, Spotube, OpenDriver, Thunderbird,
K-9 Mail, Maily, FSNotes, Markor, Notepad/Notepadqq/TextEdit/Vim, Actual Budget,
Flow/Oinkoin, QuickShop, Tasks.org, Fossify Calendar/Gallery, Material Files,
Habit, Photos/Maps/Marble, Safari/Chrome, and desktop office/code/graphics tools.
`tools/workflow-apps.json` records each edition and its reused engine/platforms.
All icons are original image assets extracted from the Linux image, using related
Linux application artwork where the corresponding iOS/Android icon is unavailable.
This does not establish visual parity with unavailable platform images.

Large JSON values are transparently compressed if localStorage reaches its quota,
retaining independent per-app/per-platform state rather than duplicating native
sessions on a server. Imported files remain in IndexedDB. App source assets and
all PDF/map caches must be present in a complete deployment build.

## Linux image audit and calibration

The inspected image has 83 visible desktop launcher entries. After preferring
Desktop launchers and merging known aliases, the inventory records 69 entries.
37 have browser implementations; 32 remain unimplemented or have broken image
launchers. Mines, Mahjongg, and Sudoku target executables are missing in the
image itself. Additional Drivers was recovered by parsing duplicate desktop-entry
keys correctly. Loading a browser implementation does not establish native parity.
`static/data/linux-app-audit.json` records each item and its remaining gaps.

The current image's 16 packaged Web clients and their 2,648 asset hashes were
checked against the local v3 cache. Build prefers `linux_img/web-clients-v3` over
the older repository snapshot. Its source files remain unchanged; browser bridges
are injected only into generated output. Cached file contents and source SHA-256
values are recorded in `linux_img/web-clients-v3/manifest.json`.

Original draw.io Web assets were extracted from the image's Electron app.asar into
`linux_img/drawio-web.zip`. The generated editor retains the actual shape libraries,
menus and XML format; storage/downloads use the browser. Its IndexedDB and Storage
names are scoped to the device and app, and device reset also removes its databases.
PWA registration is disabled for this embedded packaged version.

Linux display, dock, wallpaper and clock were calibrated to the image. Its time
zone is Asia/Hong_Kong (UTC+8 for current dates); application frames use this zone
rather than the host PC zone. Historical timezone transitions and independent
worker contexts are outside the current clock adapter.

Calendar now follows the observed GNOME month/year layout, Sunday week start,
variable week count, Personal and read-only Birthdays & Anniversaries sources,
date navigation, calendar filtering and local event editing. It remains a browser
reimplementation, without the native calendar database or account integrations.

Files gained folders, rename, move and recursive deletion. Shotwell's browser
edition gained albums, rename, moving and preview. Image Viewer has a separate
image/zoom/rotate/export implementation. Text Editor now has document tabs,
open/save, find/replace and undo rather than the generic Notes interface.
Their original filesystem/library data and complete native functionality are not
claimed to be reproduced.

Driver routing data is packaged from `linux_img/driver-routing-v3.json.gz` (18 road
graphs and 19 route-cache files). The original route algorithm reads it via the
browser adapter. Navigation uses this for drive-mode cached routes and marks
fallback estimates; its other modes and full global navigation remain incomplete.

Rebuild the audit from the inspected launcher inventory and browser-load results:
`python tools/audit_linux_catalog.py --inventory <inventory.json> --browser-results <results.json>`.

The build now requires calibrated v3 caches when the Linux inventory is marked verified; it fails if they are absent instead of silently reverting to the older snapshot. The exact image Flutter renderer (38 assets) and backend sources are preferred over the repository versions. The routing archive contains immutable road data only, excluding the native rider database.
# Map tile loading

Navigation, Marble and OpenDriver use `static/js/map-tiles.js`. The tile manifest contains only original complete image tiles; the builder removes previously generated sparse parent mosaics. Missing tiles load on demand from the configurable `window.OSOmniMapTileURL` template (default OpenStreetMap Standard), without prefetching. Browser HTTP caching remains enabled and visible attribution is included. If network loading fails, a cached ancestor is cropped to the exact requested child footprint. An unavailable region produces an explicit failure; the small image cache does not provide worldwide offline coverage. Provider policy: https://operations.osmfoundation.org/policies/tiles/.


## Apple image profiles

The iOS v3 simulator and macOS v3 Tart image have separate audited application
allowlists. Run `python tools/import_apple_profile.py ios` or
`python tools/import_apple_profile.py macos` after extracting their inventories,
native icons, display metadata, and `browser-clients-v3` caches. Then run the
normal playground build and static-site packager. A missing platform cache is a
build error; the packager does not silently substitute another OS frontend.

The iPhone profile uses the simulator device metadata and original wallpaper
texture dimensions (1320 by 2868, logical 440 by 956). Installed bundle icons and
SpringBoard/chronod texture caches supply the native artwork; the original home
page assignment is retained. The simulator archive includes 30 launcher entries,
22 browser implementations, and 8 entries without a port. Six Open WebView
frontends are packaged directly. Other iOS binaries remain partial browser
counterparts, without UIKit or native service parity.

The macOS profile covers application bundles on the Data and sealed System
volumes, plus Safari in the App cryptex. There are 89 inspected entries, 39 browser
implementations, and 50 entries without a port. Native ICNS resources, the
original default wallpaper, seven Open frontends, and the macOS draw.io ASAR web
editor are reused. Zotero uses its own embedded macOS toolbar icon because its
launcher artwork is an asset catalog. The source manifest says macOS 15.2 while
the mounted SystemVersion.plist reports 26.5.2; the audit records this difference.
The Tart display configuration is 1920 by 1080.

Each platform opens on a lock screen, then enters its home screen. Application
iframes and personal data stay scoped to the platform. iOS Control Center and
macOS sound/brightness controls change the browser device model and media volume,
not the visitor's hardware. Bluetooth and connectivity controls represent local
device state. Pending native applications and feature gaps remain visible in the
platform audit; image resource reuse does not imply full operating-system parity.

### iOS inventory and functional verification

`python tools/audit_ios_catalog.py` independently checks active bundle Info.plist
files, SpringBoard home/dock IDs, and FrontBoard uninstall history. The simulator
archive's 30 launcher entries are a home-screen inventory, not a count of every
built-in application in the separate iOS runtime SDK. All 13 active third-party
bundles have browser counterparts. Eight system launchers remain unported.
QuickShop and Daybreak do not appear as active bundles or home-screen entries in
this archive; OpenShop is present. Historical removed OpenNavigation launchers
are excluded.

Supply `--browser-results <metrics.json>` and
`--functional-results <workflow-results.json> ...` to attach measured viewport
checks and tested workflows to the public audit. The ordinary profile importer
rebuilds the audit, so run verification after importing and testing. The check
only certifies the named workflows; native binary, UIKit, native database, iCloud,
IMAP, camera, and hardware service parity is not implied.

`ios-app-adapter.js` and `ios-app.css` adapt Maily and Flow to the phone viewport:
collapsible navigation, a mail reader with a back action, and finance transaction
cards. The adapter suppresses a redundant search `change` redraw after `input`
already refreshed Flow results; otherwise blur can replace a clicked row before
its click event arrives. The iOS Flow counterpart displays transaction cents.
Other platform presentations remain scoped to their own profiles.

FSNotes includes search, folder rename, archiving, and Markdown import/export.
Habit supports renaming and historical check-ins in the device time zone.
Existing browser app storage keys are retained when these features are added.
