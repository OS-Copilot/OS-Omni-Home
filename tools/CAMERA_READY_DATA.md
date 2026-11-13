# Camera Ready data provenance

Website measurements come from the supplied NeurIPS 2026 OS-Omni Camera Ready
PDF. The source PDF is unchanged. No new benchmark runs or scoring were performed.

| Website content | Paper source | Treatment |
| --- | --- | --- |
| Seven models and human reference | Table 1, p. 9 | All 64 numeric cells retained, including published averages |
| Average and per-platform bars | Table 1 | Reuse the table values |
| 300 tasks, six groups of 48, 12 cross-device workflows | Sections 3.3–3.6; Figure 5 | Task counts, not trajectory counts |
| Task taxonomy | Figure 5, p. 8 | Published percentages; no category counts inferred |
| 35 applications / websites | Figure 3, p. 5 | Benchmark coverage; separate from playground launcher inventory |
| 181 Open-series tasks | Section 3.3, p. 6 | Exact reported count |
| 30 annotators, 2,400 annotation hours, 400 review hours | Section 3.4, p. 6 | Hours remain qualified as approximate |
| Human steps and time | Introduction, p. 2 | OS-Omni: 67.54 / 200.97 s; OSWorld reference: 15.0 / 111.94 s |
| Observation/history and limits | Section 4.1, p. 8 | Screenshot-only; three recent steps/screenshots; single-platform 300 steps / 180 s per step; cross-device 300–650 / 120 s |
| Four failure categories | Section 4.3, p. 9 | Qualitative only; no numerical error composition |

## Interpretation

- Table 1 labels cross-device results “Cross-VM”. The body describes twelve
  single-screen desktop + Android workflows as cross-device. The website
  uses Cross-device and explains this naming difference beside the table.
- Avg. is an equal-weight mean over seven evaluation groups, not a task-weighted
  mean over 300 tasks. Published averages retain the paper's rounding.
- Model rankings exclude the human reference. Best model scores are bold;
  second-best distinct model scores are underlined. Ties are retained.
- The PDF does not report an easy/hard leaderboard split, binary-verdict recall,
  balanced accuracy, AUC, cost/Pareto, quantitative failure proportions,
  ablations, training gains, corpus funnel, or transfer results. The former
  template panels and invented datasets for these have been removed.
- Confidence intervals and error bars are not reported and are not invented.
- Task Explorer and browser-playground inventories retain their own sources.
  They do not establish experimental success rates or native-app parity.

## Implementation and validation

### Additional dataset visualizations

The Data Distribution / Composition panels add measured release statistics
without removing the paper's results or taxonomy:

- Platform donut: six groups of 48 and a cross-device group of 12.
- Source-category donut: 181 Open-series, 31 reviewed supplement, 76 legacy
  supplement, 12 cross-device. These are the manifest's mutually exclusive
  selection categories, not Figure 5's semantic taxonomy.
- Declared-App span: 264 single-label, 24 multi-label, 12 cross-device tasks.
  This is computed from the exported specifications; supporting Apps may not
  be named in metadata. It is explicitly not a semantic cross-App census.
- Cross-device flow: six Linux + Android and six Windows + Android workflows.
- Task Explorer uses 51 normalized specification labels. These are not
  substituted for Figure 3's 35 applications/websites. The duplicate coverage
  matrix and best-model-versus-human gap panel were removed from the page.

`dataset-composition.js` computes these panels from `task-catalog.json`, exported
from the release manifest and its task YAMLs by `build_task_catalog.py`. Search,
platform filters, and exact Task-Explorer navigation have been checked. All
source categories were compared with `manifest.category_counts`; both device
pairs were checked to contain six tasks. Rings include textual legends and
task source paths remain available.

### Interaction and palette reference

Interaction patterns and chart colors were reviewed against the live
OpenMobile-2 homepage (`https://os-copilot.github.io/OpenMobile2-Home/`) and
its `om2-charts.js`, `om2-charts.css`, and `om2-data.js` resources. The site
retains its own typography and measurements. Mint `#39cdb5`, coral `#ff8f6b`,
and the reference's seven category colors guide the chart palette. A platform
retains one color across distribution and coverage views; model families retain
one color across average and platform results.

Ring segments and legend buttons preview values on pointer/focus. Clicking pins
a category; clicking again or Escape clears it. Platform-result buttons switch
the same underlying Table 1 values, bars expose their values on hover/focus,
and the cross-device diagram has four selectable explanatory stages. Reduced
motion suppresses chart transitions. Interaction checks cover preview, pin,
reset, stage changes and platform selection; the 64 source values are unchanged.

`static/js/osomni-data.js` contains the Camera Ready values. `paper-results.js`
renders the results table and data-driven bars. `main.js` no longer
invokes template chart functions. The legacy chart library is not loaded.

All 64 cells were independently compared against text extracted by coordinates
from PDF p. 9. Every row's average was checked within printed rounding precision.
Task counts match `111/tasks/v1/manifest.json`. Syntax, default ranking, Linux
column sorting, and iOS chart selection were checked. Figures 3/5 and Table 1
were rendered and visually inspected. Browser visual QA remains unverified.
