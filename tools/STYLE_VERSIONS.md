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
