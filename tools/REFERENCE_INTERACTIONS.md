# Reference interaction decisions, 2026-11-16

The active preview continues to use the OS-Omni logo, full paper title, icon-led palette, original device applications, task catalog and recorded trajectories. Reference sites guide interaction structure, not benchmark claims.

## OpenMobile-2

Reference: https://os-copilot.github.io/OpenMobile2-Home/

Observed in the live homepage and its source: an environment section, an in-page simulator, step-by-step episodes, data/pipeline explanations, results and resources. The research argument is connected to things the reader can explore.

Applied: an explicit workspace → task → trajectory navigation bridge next to the five-platform playground. Existing platform switching, App launching, annotation animation and replay controls remain. OS-Omni does not claim OpenMobile-2's tool-use training, environment inventory or simulated-app equivalence.

## LiveCodeBench

Reference: https://livecodebench.github.io/leaderboard.html

Observed in its current inline implementation: evaluation-date range selection, scope-dependent score aggregation, an information summary, ranked rows and a compact table with Pass@1 / Easy / Medium / Hard columns. The table is the primary result surface.

Applied: evaluation-group scope selection, a compact full-results table, clear ranks, sortable numeric columns, and a scope summary. Adaptations for OS-Omni add model/provider filtering, CSV export and model comparison across the seven existing groups.

Not copied: date sliders, difficulty buckets, contamination labels, cost plots, confidence intervals or newly aggregated experiment results. The available OS-Omni results do not justify those controls or claims. Published macro averages and rounded rates remain unchanged in `static/js/osomni-data.js`.

## Isolation and rollback

- Only Orbit/current preview entries load `leaderboard-explorer.js` and its stylesheet.
- Classic and saved charcoal versions retain their original leaderboard.
- Pre-change Orbit sources: `D:/OTHER/osomni/site-version-backups/orbit-before-leaderboard-20261116-022847/`.
- Shared score data, App runtimes and replay assets are unchanged.
