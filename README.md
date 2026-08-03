# OS-Omni — project page

Source for the OS-Omni homepage: *Benchmarking Generalist Computer-Using Agents
on Long-Horizon Workflows Across Platforms*.

Static HTML, CSS and vanilla JS. No build step, no framework, no CDN scripts,
nothing to install.

## Running it

```bash
git clone https://github.com/OS-Copilot/OS-Omni-Home.git
cd OS-Omni-Home
python3 -m http.server 8899        # then open http://localhost:8899
```

Any static server works; the port is arbitrary. Edit a file and reload the
browser — there is no watcher and nothing to rebuild.

Opening `index.html` straight from the file system works for a quick look. Only
`404.html` needs a server, and specifically one serving the site under
`/OS-Omni-Home/`, since its paths are root-absolute — see Deploying.

## Status: this is a template

The layout, the design system and the chart library are finished and working.
**Every number, table, figure and most of the prose is placeholder content**,
carried over from the [OSReward page](https://os-copilot.github.io/OSReward-Home/)
that this page was derived from. Nothing on it describes a real OS-Omni result yet.

While that is true the page says so itself, in three places, all driven by one
flag:

| Marker | Where | Driven by |
| --- | --- | --- |
| Banner under the byline | top of `<main>` | `PLACEHOLDER` in `static/js/osomni-data.js` |
| "placeholder data" chip | every chart card | same flag |
| Viewer banner | DataViewer section | `VIEWER.placeholder` in the same file |

Set both to `false` in the same commit that lands real content, and all three
disappear. Do not turn Pages on for a public audience before then.

## Layout

```
index.html               the page
404.html                 not-found page
static/css/main.css      design system + all page styles
static/js/
  osomni-data.js         every number, one place — currently placeholders
  osomni-charts.js       dependency-free SVG chart library
  main.js                page behaviour + chart wiring
public/
  OS-Omni-V6.png         the brand logo, 1024x1024 RGBA — source of the icons
  favicon*.png .ico      built from it, see tools/
  apple-touch-icon.png   built from it
  cover.png .webp        hero key art  (PLACEHOLDER — still OSReward's)
  social/og-image.png    1200x630 social card (PLACEHOLDER — still OSReward's)
  logos/                 model-family marks used in tables and plots
  logos/projects/        marks for the "More research" nav dropdown
tools/
  build_brand_assets.py  rebuilds every icon from the logo
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

## What to fill in

Search `index.html` for `TODO` — there are about forty, each naming what belongs
in that spot. The larger jobs, roughly in order:

1. **The two remaining brand assets.** The icons are done. `public/cover.png`,
   `cover.webp` (the hero art) and `public/social/og-image.png` (the social
   card) are still the source page's artwork — replace them before the page is
   shared anywhere. `public/logos/Ours.png` is a placeholder mark for our own
   entry in the plots.
2. **The data file.** `static/js/osomni-data.js` is the single source of truth.
   Nothing goes inline in `index.html` or `main.js` — put it there. Each block is
   commented with what it feeds and what needs deciding.
3. **Section copy.** Overview, Problem, Benchmark, Findings, Leaderboard.
4. **The Method section** (`#method`) is a generic slot for a method, a corpus or
   a released model. If OS-Omni ships none of those, delete the whole section,
   its nav entry, its footer link, and the fourth item in the Overview list.
5. **Release links.** Every artifact link is parked. In `index.html`, search for
   `class="btn pending"` (hero) and `class="card feature pending-card"`
   (Resources). For each, drop the `pending` / `pending-card` class, add the
   `href`, and delete the `<span class="soon">` badge. The `data-link` attribute
   names which artifact each one points at: `paper`, `arxiv`, `code`,
   `benchmark`, `corpus`, `models`.
6. **The BibTeX entry and the author line.** The page ships a single collective
   credit, `OS-Omni Contributors`, and no affiliation marks. To go back to a full
   author list, restore the `.affils` and `.legend` markup in the `.byline`
   section — the CSS for both is still in `main.css`.

## The interactive figures

`osomni-charts.js` is written to be lifted into a blog post as-is. Include the
three files, then mount:

```html
<link rel="stylesheet" href="main.css">
<div id="pareto"></div>
<script src="osomni-data.js"></script>
<script src="osomni-charts.js"></script>
<script>
  OSOmniCharts.pareto("#pareto", { metric: "hard" });
</script>
```

Every constructor takes a selector or element and returns
`{ el, update(opts), destroy() }`, and re-renders on container resize so labels
stay at true size instead of being scaled with the SVG.

| Call | What it draws |
| --- | --- |
| `pareto(sel, {metric})` | cost vs. accuracy, log x, Pareto frontier |
| `biasPlane(sel, {set})` | fail recall vs. success recall, balanced diagonal |
| `leaderboard(sel, {set, cols, maxHeight})` | sortable, filterable, searchable table |
| `failureModes(sel)` | stacked error composition per model |
| `barPair(sel, {groups})` | paired horizontal bar groups |
| `heatmap(sel, {cols, rows, ...})` | sequential or diverging heatmap |
| `donut(sel, {data, centerTop})` | ring chart with a centre stat |
| `groupedBars(sel, {series, groups})` | grouped horizontal bars |
| `composition(sel)` | success/fail split bars + length box plot |
| `corpusSankey(sel)` | pipeline funnel; scrolls sideways below 800 px |

All colours come from the CSS custom properties in `main.css` and the family
palette in `osomni-data.js`, so restyling is one file each.

Two things are configurable from the data file rather than the library, because
they are the parts most likely to change:

- **Leaderboard columns** — `leaderboardCols`, or `opts.cols` per mount. Each
  entry is `{ k, t, hint }` and reads `row[set][k]`. The metric set inherited
  from the source page is a binary-verdict one (accuracy, success recall, fail
  recall, balanced accuracy); an agent benchmark probably wants success rate,
  progress rate, steps and cost instead. Changing it means editing
  `leaderboardCols` and the `full` / `hard` objects in `models` together.
- **Sankey captions** — every label, unit and note in `corpusFlow`, including
  what the right-hand columns count (`judged.unit`, `corpus.unit`). The chart
  restarts its vertical scale where the unit changes, and prints a marker there.

## Themes

The page ships a light and a dark theme off one token set: `:root` is dark,
`:root[data-theme="light"]` overrides the same variables, and an inline script in
`<head>` sets `data-theme` before first paint (localStorage →
`prefers-color-scheme` → dark) so there is no flash. Anything that bakes a colour
into an SVG attribute goes through `cssVar()` in the chart library, and
`OSOmniCharts.redrawAll()` repaints every chart when the theme flips.

## Deploying

GitHub Pages from a branch, folder `/ (root)`, to be served at
`https://os-copilot.github.io/OS-Omni-Home/`. No `.nojekyll` is needed — nothing
in the tree starts with an underscore.

Pages is **not on yet**. To turn it on: repository *Settings → Pages → Build and
deployment → Deploy from a branch → `main` / `/ (root)`*. Note that Pages on a
private repository needs a paid plan for the organisation; on the free plan the
repository has to be public first.

Two things hardcode that address. The Open Graph tags in `<head>` are absolute,
because social scrapers do not resolve relative URLs. And `404.html` uses
root-absolute `/OS-Omni-Home/…` paths, because Pages serves it for a miss at any
depth below the project path, where relative paths would resolve against the
wrong directory. Everything else on the page is relative and survives a move on
its own. Change those two together if the site is hosted elsewhere.
