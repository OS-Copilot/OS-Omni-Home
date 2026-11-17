# Companion release cleanup ? 2026-11-16

- Archived the unreferenced 2D mask prototype (`interactive-mascot.js` and `.css`) outside the repository.
- Moved the incomplete `dist/research-release-20261116` build (192,658,773 bytes) outside the repository. It had no build report and was not the published release.
- Archive location: `D:/OTHER/osomni/site-version-backups/cleanup-20261116-companion/`.
- Kept the previous published release, paper artifacts, raw trajectories, application resources and approved design snapshots.
- Generated `dist/`, `tmp/`, application packs, trajectory media and credentials remain excluded by `.gitignore`.
- Retained saved palette pages: the current navigation and build chain still reference them.
- Current production entry is built from `index.research.html`, with native 3D orbit, corrected proportions and a collapsible companion. Original `index.html` is the preserved classic source; the release overlay deliberately selects the approved research entry.
- Three.js is locally vendored with its MIT license; no third-party CDN is required by the mascot.
- Build revision: `2d5e788420f13583`. Static verification passed for 921 physical resources, 60 cases, 299 runtime resource responses and 30 protocol checks. Companion transition and leaderboard checks passed separately.
- Browser automation could not perform visual acceptance; the user reviewed and approved the current design.
- Source working-tree changes unrelated to this release were preserved. Source snapshots and `gh-pages` are pushed separately, without a force push.
