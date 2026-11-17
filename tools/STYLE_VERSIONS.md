# Website visual versions

## Classic baseline, saved 2026-11-16

- Entry: `index.html` (unchanged) or `index.classic.html` (byte-identical saved entry).
- Appearance: original navy/gold/starfield theme.
- Source backup: `D:/OTHER/osomni/site-version-backups/classic-20261116-013609/source.zip`.
- Backup manifest: sibling `manifest.json`, containing a SHA-256 for each of 493 source files.
- The archive has been reopened and checked. Generated browser application packs and replay media remain shared and unmodified in `public/`.

## Charcoal research version

- Saved entry: `index.charcoal.saved.html`. The previously shared `index.charcoal.html` address now serves the current Orbit preview to prevent users staying on an outdated design.
- Theme: `static/css/charcoal-preview.css`, loaded only by that entry.
- Builder: `python tools/build_charcoal_preview.py`.
- Design: charcoal backgrounds, neutral typography, restrained mint accents, full paper title, large OS-Omni project artwork in the right half of the hero, quieter chart and explorer surfaces.
- Original homepage, application runtime, evaluation data, replay files, and public deployment are not replaced.

## Compare locally

- Current preview: `http://127.0.0.1:8899/index.orbit.html` (also available at `index.charcoal.html`).
- Saved charcoal: `http://127.0.0.1:8899/index.charcoal.saved.html`.
- Original: `http://127.0.0.1:8899/index.classic.html`.
- The new navigation has an **Original** link for direct comparison.

## Orbit / icon-led version, added 2026-11-16

- Entry: `index.orbit.html`.
- Builder: `python tools/build_orbit_preview.py`, using the intact charcoal version as its layout source.
- Theme: `static/css/orbit-preview.css` overrides the shared charcoal structure.
- Appearance: mint-gray backgrounds, lake-blue typography, teal controls, and restrained gold accents derived from the OS-Omni mark. No white-dominant page background.
- Full paper title and large right-hand OS-Omni artwork are retained. Native app surfaces, task records, charts, and trajectory data are not rewritten.
- Preview: `http://127.0.0.1:8899/index.orbit.html`.
- Navigation includes a **Charcoal** link to `index.charcoal.saved.html`. Original navy/gold remains at `index.classic.html`; the charcoal design is preserved at its saved entry.
- The current preview now adds the OpenMobile-2 exploration bridge and a results-first leaderboard adapted from LiveCodeBench's interaction pattern. See `tools/REFERENCE_INTERACTIONS.md` for the exact adaptations and excluded features.

## Revert this visual experiment

Open `index.html` or `index.classic.html`; no source restoration is required because the original entry and styles were not changed. If the new theme is adopted later, preserve this baseline archive and validate its paths before restoring any files. Never overwrite later unrelated work automatically.

## Research / current blue-gray version

- Current entry: `index.research.html`. The previously shared `index.orbit.html` and `index.charcoal.html` are aliases for this version.
- Builder: `python tools/build_research_preview.py` (builds the shared mint structure internally without replacing current entries until the final research theme is ready).
- New theme: `static/css/research-preview.css`; steel-blue surfaces, navy text, electric-blue actions, a faint technical grid confined to the hero, and less rounded panels.
- Preserves the large project artwork, full paper title, compact playground, LCB-inspired results explorer, task catalog and trajectories.
- Saved previous mint version: `index.mint.saved.html`; its source archive is `D:/OTHER/osomni/site-version-backups/mint-before-research-20261116-025033/source.zip`.
- Original and saved charcoal entries remain available.

## Dark research / current preview

- Current preview uses `research-dark.css`, loaded after the research structure, and `data-theme="dark"`.
- Navy surfaces, cold white text and electric-blue actions; tables, inputs, charts and replay shell all receive dark-specific colors.
- Light research snapshot: `index.research.light.saved.html`; archive: `D:/OTHER/osomni/site-version-backups/light-research-20261116-025412/source.zip`.
- Current URLs remain `index.research.html`, `index.orbit.html`, and `index.charcoal.html`.


## Interactive 3D mascot ? 2026-11-16

Current local research entries now load `mascot-3d.js` as a module and `mascot-3d.css`. The robot is native jointed Three.js geometry (`mascot-model.js`); it replaces the earlier SVG-mask prototype. The original project image stays as a WebGL fallback and in the navigation. Three.js r169 is vendored locally with its MIT license. This iteration is local-only; production release `04b302e2198880ec29b252ea4ec132fe99071433` remains unchanged.

Validation: 200 finite animation poses, model bounds and blink limits, JS syntax, CSS parse, and HTTP module dependency checks passed. Browser rendering has not been visually accepted because the browser access host is unavailable.


## Approved companion release ? 2026-11-16

The approved dark research version includes the original-palette 3D robot, corrected mouth and suit silhouette, rear explorer equipment, true near/far satellite orbit, and a collapsible companion while scrolling. Hero and companion share one WebGL renderer and canvas. The approved pre-companion source is archived outside the repository as `site-version-backups/approved-mascot-before-companion-20261116-183338.zip`.

Current builder: `python tools/build_research_preview.py`. Publication overlay: `python tools/prepare_research_release.py --output dist/research-release-20261116-companion`. This release supersedes the earlier local-only status above. The unused 2D mask prototype was archived outside the repo. Native application and trajectory resources remain pinned to their existing immutable resource commits.

Validation covers companion DOM transitions, minimize/restore, focus, reduced motion, articulated geometry, near/far ray intersections, and the static Pages runtime. Visual browser automation remains unavailable; the user reviewed screenshots and approved the current version.


## Exploration motion preview ? 2026-11-16

Local research entries load `exploration-motion.css` and `exploration-motion.js`. Added a thin reading-progress line, wide-screen section waypoints, one-time entrance animations, chart-bar reveals, card pointer highlights, gentle filter feedback and three continuation links. The companion caption and click greeting reflect the section being read; they are preset navigation hints, not a chat-model connection.

The approved robot model, orbit, site palette, published data, task catalog and replay code are unchanged. Dynamic lists remove stale observations. Reduced-motion preferences cancel entrance animations and disable hover movement. DOM-level regression checks: `tools/check_exploration_motion.cjs`; these do not claim browser visual validation. Current production remains companion release `ca5443c022facbc02493b6150ff4673c478f21b3` until publication is requested. Previous approved source is archived outside this checkout under `site-version-backups/before-exploration-motion-20261116-213741.zip`.


## Galactic environment preview ? 2026-11-16

Added `mascot-galaxy.js` and `galaxy.css`: a runtime-generated layered nebula with a winding dark dust lane, a depth-distributed 1,800-point star belt, slow parallax and gentle twinkling. The companion uses a reduced 440-point field and dimmer nebula. The hero grid fades behind the illustration while the existing navy/cyan/gold palette remains in place. No downloaded image or large media asset is required. Robot geometry, task data and numeric results are unchanged. Exploration motion remains included.

Validation: deterministic finite star data, scene transforms, compact/full draw ranges, reduced motion, CSS parsing and HTTP dependency checks. Browser visual acceptance is pending. This is local-only; official production remains the approved companion release.


## Continuous page galaxy preview ? 2026-11-16

Added `page-galaxy.js` and `page-galaxy.css`. A fixed, non-interactive backdrop now spans every section. It paints two native Canvas2D layers only on initialization/resize, then uses composited parallax and CSS opacity/glint animations. Full-width opaque section fills and the hero grid give way to the continuous scene; cards, tables, app frames and controls retain their original solid surfaces. No new WebGL context or external asset is used. Reduced motion, background-tab pause, bounded pixel density and mobile density limits are included.

Verified all eight primary section background winners using CSS cascade resolution; checked density, deterministic positions, no canvas repaint on scroll, reduced motion, pause/cleanup and HTTP references. Visual browser acceptance remains pending. Local preview only; official production is unchanged.


## Shared interactive galaxy preview ? 2026-11-16

Supersedes the static page-backdrop behavior above. The nebula texture is still painted only on resize, but the foreground star canvas now runs at a bounded 30fps with autonomous drift/twinkle, depth-dependent scroll inertia and short scroll streaks. Pointer proximity attracts/highlights nearby points. Primary clicks in non-interactive page areas emit a bounded, short-lived ring of star dust; links, controls, selectable text, tables, canvases and iframes are excluded.

A ready/dispose event switches off/on the robot-local galaxy, so only the shared full-page galaxy is visible while the page background is active. Hero and companion both sit in this shared environment. Character geometry and palette are unchanged.

Regression command: `node tools/check_page_galaxy.cjs` verifies drift, scrolling, blank click response, interactive-control exclusion, animation lifecycle, reduced-motion stop, hidden-tab pause and local fallback. This remains a local preview pending user visual review and publication.


## Approved shared-galaxy publication ? 2026-11-16

The user approved the interactive full-page galaxy and requested cleanup/publication. Release package: `dist/research-release-20261116-interactive-galaxy`, revision `5b574ea126235ddb`. This supersedes earlier local-only status entries for exploration and galaxy previews. Previous published worker indexes and homepage blobs are preserved for upgrades. See `tools/CLEANUP_20261116_GALAXY.md` for cleanup and verification scope.
