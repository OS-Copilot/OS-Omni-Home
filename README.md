# OS-Omni — project page

Source for the OS-Omni homepage: *Benchmarking Generalist Computer-Using Agents
on Long-Horizon Workflows Across Platforms*.

Static HTML, CSS and vanilla JS, with no application server required at runtime.
The full App playground and recorded-image library require separately generated
assets; a fresh source clone is not a complete deployment package.

## Running it

### Task Explorer

The `#tasks` section lists the 300 tasks selected by the v1 release manifest,
with platform, application, full-text search, and expandable instructions.
Platform navigation, numbered cards, and a random-task discovery action support
browsing the collection. Discovery respects all active filters. Motion respects
the visitor's reduced-motion preference. The placeholder DataViewer section and
its navigation links have been removed; no synthetic trajectories are shown there.
Web is a separate track even though its runtime platform is Linux. Oracle companions,
retired tasks, and supporting stages are excluded from the release count.

Refresh the public briefs after editing the benchmark tasks:

```powershell
python tools/build_task_catalog.py --source ../111
```

This requires PyYAML. The exporter reads `tasks/v1/manifest.json` and its referenced
YAML files; it does not execute initializers or evaluators. Only brief fields are
exported, excluding setup scripts, evaluator rules, and environment configuration.
The generated `static/data/task-catalog.json` ships with the static website.
This directory provides task browsing; it does not run or score tasks in the playground.

### Browser-local device playground

One five-device playground appears immediately after the hero. Its App catalog
opens browser implementations on the selected device, including the startup
transition. App search and the highlighted foreground App stay in sync with
platform changes. Task browsing lives in Task Explorer; the duplicate coverage
matrix, live-state/task-preview panel and five-platform App tour are not mounted.
The benchmark covers six platforms; this device gallery covers five OS shells
and does not include a separate Web shell or run native evaluators.

`research-stories.js` presents the unified five-stage annotation pipeline from
Camera Ready Figure 4. The separate task-anatomy walkthrough section was removed.
The pipeline automatically loops over 15 seconds, with progress integrated into
the stage navigation. It pauses outside the viewport or in a hidden tab and
resumes on return. Stages and the timeline can be selected manually. CSS motion
respects reduced-motion preferences. These are explanatory illustrations, not
measured agent trajectories. Original task instructions remain in Task Explorer.

The interactive hero and Playground follow the browser-simulator architecture:
each visitor runs the apps locally in their browser with independent data.
Each launcher follows its own inspected image inventory: Linux v3 has 37 browser
implementations; Android V3 has 31, including 7 original APK WebView frontends;
Windows v3.1 has 43, including 8 original Electron frontends. Icons come from the
corresponding native launchers. Unsupported launch entries remain listed in the
inventory panel. Feature scope is recorded in the [Linux](static/data/linux-app-audit.json),
[Android](static/data/android-app-audit.json), and [Windows](static/data/windows-app-audit.json)
audits. Browser counterparts do not establish full native feature parity.

```powershell
python tools/build_playground.py
python tools/serve_browser.py
# http://127.0.0.1:8899/#playground-section (also served on port 8900)
```

The build packages browser application sources from the sibling `OS-Omni-V2`
checkout. Override with `--source /path/to/OS-Omni-V2`. Once built, the site is
entirely static and needs no VM or application server. To prepare a complete
static deployment folder, run `python tools/package_browser_site.py`.
See [browser playground architecture and validation](tools/BROWSER_PLAYGROUND.md).
The generated application pack and trajectory media are ignored by Git and must
be included in a deployment. They remain available in the prepared local checkout.

The ordinary static-server workflow is also supported after the app pack is built:

```bash
git clone https://github.com/OS-Copilot/OS-Omni-Home.git
cd OS-Omni-Home
python3 -m http.server 8899        # then open http://localhost:8899
```

Prepare the generated assets described above before using this fresh-clone
preview command. Any static server works; the port is arbitrary. Edit a file and reload the
browser — there is no watcher and nothing to rebuild.

Use an HTTP server rather than opening `index.html` with `file://`. Task records,
application audits, and walkthroughs use fetch and require the HTTP origin.
The not-found page additionally expects the `/OS-Omni-Home/` project subpath.

## Camera Ready results

### Recorded case studies

The Trajectories link opens twelve archived attempts for each available platform.
Desktop, Mobile and Browser entries are grouped separately; empty groups stay hidden.
Visitors can filter by application, search titles and select a task card. Selected
lengths are Windows 40–99, macOS 30–96, iOS 31–137, Linux 26–300 and Web 30–243 real recorded steps.
Only attempts with all referenced screenshots are included. Linux includes three
complete 26/29-step examples to retain twelve cases; no frame repetition is used
to increase the recorded step count. All use one recorded model group; model
identity is omitted from the presentation. The viewer supports before/next
observation, step playback, checkpoints, original screenshots and final verdicts.
Playback never executes the code it displays. Failing final-state verdicts are
shown explicitly, and episode-runner status remains separate from the final-state
evaluator when they disagree. Archived instructions are
used because some task revisions differ from the current task catalog.

`tools/import_case_studies.py` imports a pinned revision from
`YUNTA88/osomniresult`, using an existing Hugging Face login when needed. It
exports only instructions, explicit actions, statuses and unmodified source
screenshots. `tools/build_case_previews.py` produces 1600-pixel
desktop and 720-pixel portrait WebP previews without changing
the originals. The importer rebuilds these previews automatically. Replay decodes
the current image before showing it, buffers up to five following observations,
and keeps at most twelve images in its decoded cache. It never downloads the full
library on entry. An opacity transition preserves the previous image until the
next is ready; autoplay advances one observation per step without replaying the
same frame as both an after/before pause. Manual before/next inspection remains.
The selection is listed in `tools/case-study-selection.json`. Platform directories,
model group, exact source revisions and minimum lengths are declared in
`tools/case-study-sources.json`; existing platforms retain their original pinned
revision when another platform is added. Web task IDs can start with `linux.`
because the browser runs in Linux; the public replay platform follows the task
catalog's `track`, while source paths follow the result archive's `web/` directory.
Linux archive paths use `ubuntu/`. New platforms are enabled only after all
screenshots referenced by their twelve selected trajectories are present at the
pinned revision; README summaries alone are not replay artifacts.
Prompts, reasoning, encrypted model content and
runtime credentials are excluded. `tools/case-studies-provenance.json` records
source paths and screenshot SHA-256 hashes. Raw archive snapshots do not replace
the Camera Ready leaderboard. The local replay works without Hugging Face login;
opening the source archive itself may require sign-in.

The visible results and charts use the supplied NeurIPS 2026 Camera Ready.
`static/js/osomni-data.js` contains Table 1 values, task statistics, and source
metadata. `paper-results.js` renders the sortable success-rate table, platform
comparisons, task mix, and human workload references. The legacy synthetic
OSReward metrics, hard split, cost, training and ablation panels are removed.

See [data provenance and validation](tools/CAMERA_READY_DATA.md). Published
averages are equal-weight means over seven groups, rather than task-weighted
averages. No numerical error frequencies or confidence intervals are invented.

## Layout

```
index.html               the page
404.html                 not-found page
static/css/main.css      design system + all page styles
static/js/
  osomni-data.js         Camera Ready results and source metadata
  paper-results.js       published results, sortable table and shared chart
  main.js                page behaviour and Camera Ready rendering
public/
  OS-Omni-V6.png         the brand logo, 1024x1024 RGBA — source of the icons
  favicon*.png .ico      built from it, see tools/
  apple-touch-icon.png   built from it
  os-omni-cover-v2.png   the hero key art, 1254x1254 — source of cover.*
  cover.png .webp        900x900 hero art, built from it
  logos/                 model-family marks used in tables and plots
  logos/projects/        marks for the "More research" nav dropdown
tools/
  build_brand_assets.py  rebuilds every icon from the logo
  build_cover.py         rebuilds the hero art from the source cover
  export_logo.py         exports the logo for slides, papers, avatars
exports/                 output of export_logo.py (gitignored)
figure/                  local-only working material (gitignored)
```

## Brand marks

`python3 tools/build_brand_assets.py` regenerates the whole icon set from
`public/OS-Omni-V6.png`. Run it whenever the logo changes.

Every icon keeps the whole composition — robot, plinth, orbit ring and all six
platform cards. The logo is wider than it is tall, so it is squared by padding,
never by cropping: the transparent margin is trimmed off, then equal strips are
added above and below. The cost is legibility at the smallest sizes, where a
scene this detailed reads as a coloured cluster rather than a mark; it resolves
from about 48 px up.

Everything stays transparent, so each icon sits on whatever is behind it. An
earlier pass put the small ones on a navy plate, on the theory that the robot's
white shell needs contrast against a light tab strip. Rendered against Chrome's
actual tab colours that was clearly wrong: at 16 px the plate is the icon and
the art inside it is eleven pixels tall, so the tab shows a black square. The
composition carries its own contrast — a blue monitor, a green phone, an orange
laptop, a teal ring.

`apple-touch-icon.png` is the exception, because iOS fills transparent pixels
with black. It gets an opaque navy square, matching the page background.

For the logo outside this site — a slide, a paper, an organisation avatar —
`python3 tools/export_logo.py` writes a set of trimmed copies to `exports/`,
which is gitignored. The lossless WebP is the one to reach for: identical in
every visible pixel to the PNG, at about half the file size. Where WebP is not
accepted, use the PNG; where an alpha channel would render as black, use the
JPEG, which is flattened onto white.

## Results maintenance

The benchmark section contains Data Distribution and Composition rings,
declared-App span and cross-device flow. These use the release manifest and
task briefs, with sources labelled beside each figure. The redundant coverage
matrix has been removed. Regenerate `task-catalog.json` after changing task
metadata or manifest categories. The leaderboard has eight metric views, seven
model rows and one pinned human reference. A single bar chart switches between
the published average and seven evaluation groups.

Before presenting or publishing, run the read-only preflight:

```powershell
python tools/check_site.py --benchmark-source ../111 --paper "../_NeurIPS_2026_Release__OS_Omni (1).pdf"
```

See [the presentation review](tools/PRESENTATION_REVIEW.md) for the current
verification scope and remaining release items. Build a complete deployment
directory with `tools/package_browser_site.py`; the generated `public/playground`
App bundle is ignored by Git and is not included by pushing the HTML alone.

Update source values in `static/js/osomni-data.js` and record their paper
locations in `tools/CAMERA_READY_DATA.md`. Keep benchmark figures separate
from browser-playground inventories. Never infer model success counts from
rounded rates. Use `paper-results.js` for the current paper panels. The unused
legacy chart implementation and retired workflow/coverage UI assets were removed.

## Themes

The page ships a light and a dark theme off one token set: `:root` is dark,
`:root[data-theme="light"]` overrides the same variables, and an inline script in
`<head>` sets `data-theme` before first paint (localStorage →
`prefers-color-scheme` → dark) so there is no flash. Anything that bakes a colour
into an SVG attribute follows the active theme tokens. The current chart modules
listen for the page's theme-change event.

## Deploying

For GitHub Pages, use the new [pure-static multi-project package](tools/PURE_STATIC_PAGES.md).
The current official release uses a 178 MiB `gh-pages` homepage and five 401–750
MiB resource branches in the existing official repository. All files are uploaded;
no production Python server or additional repositories are needed. A maintainer
must enable Pages on `gh-pages` / `(root)`, followed by public-release and browser
verification. See the [current deployment status](tools/OFFICIAL_DEPLOYMENT.md).

The source checkout's configured remote is
`https://github.com/OS-Copilot/OS-Omni-Home`, branch `main`. Push website source
there, rather than to the benchmark repository or the Hugging Face result dataset.
No push or publication is performed by the cleanup tools.

Source publication and a working deployed website are separate steps. Generated
`public/playground/`, `public/case-studies/` and `public/case-previews/` are kept
locally but excluded from Git. A direct source-only Pages publication will miss
the App frontends and replay media. The complete local static content is over
8 GiB, while [GitHub Pages limits published sites to 1 GB](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
Large generated resources need separate asset hosting, or the complete package
needs a static host that supports its size. Current remote Pages settings have
not been checked; do not treat the intended URL as proof of deployment.

Validate source and packaging inputs before preparing an artifact:

```powershell
python tools/check_site.py
python tools/package_browser_site.py --check-only
```

See [the cleanup and publication note](tools/CLEANUP_REPORT.md) for the removed
files, retained generated resources and source-size check.

An alternative [byte-preserving compact package](tools/COMPACT_DEPLOYMENT.md)
reduces the measured complete content from 8.47 GiB to 4.24 GiB using exact
deduplication and reversible compression. It preserves the original resource URLs
and decoded response bytes, including every App asset and original screenshot.
It requires its supplied static-resource server; it is not a normal Pages folder.

A separate [moderate image-compression variant](tools/IMAGE_COMPRESSION.md)
keeps every replay case and step, existing playback previews, and all App assets.
Only full-resolution replay downloads may use high-quality WebP; the source
originals remain available. This variant also requires the compact resource
server and does not by itself solve the Pages publication requirements.
The separate pure-static exporter above supplies the Pages-compatible layout.

Two things hardcode that address. The Open Graph tags in `<head>` are absolute,
because social scrapers do not resolve relative URLs. And `404.html` uses
root-absolute `/OS-Omni-Home/…` paths, because Pages serves it for a miss at any
depth below the project path, where relative paths would resolve against the
wrong directory. Everything else on the page is relative and survives a move on
its own. Change those two together if the site is hosted elsewhere.
