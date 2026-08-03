/* ==========================================================================
   OS-Omni — data module   ***TEMPLATE / PLACEHOLDER***

   Every number in this file is invented. It exists so the page, the charts
   and the tables can be built and styled before OS-Omni's own results land.
   The schema is inherited from the OSReward page, which this template was
   derived from: it is a binary-verdict schema (accuracy, success recall,
   fail recall, balanced accuracy). Keep it, or replace it — the leaderboard
   columns are configurable, see LEADERBOARD_COLS below.

   HOW TO GO LIVE
     1. Replace the blocks below with OS-Omni's real numbers.
     2. Set PLACEHOLDER to false in the same commit. That switch removes the
        banner at the top of the page and the "placeholder data" chip on every
        chart card. Nothing else reads it.
     3. Set VIEWER.placeholder to false once the DataViewer carries real
        trajectories rather than the invented ones below.

   This file is the single source of truth for the page. Numbers never go
   inline in index.html or main.js — put them here.

   Usage:  <script src="osomni-data.js"></script>  ->  window.OSOmniData
   ========================================================================== */
(function (global) {
  "use strict";

  /* Drives the page-wide placeholder banner and the per-card chips. Flip to
     false only when every block below carries real numbers. */
  var PLACEHOLDER = true;

  /* ---------------------------------------------------------------- families
     Display colours for model families. Chosen for separation on the dark
     page; "ours" is gold so our own entry reads as the subject of every plot.
     TODO: keep the families OS-Omni actually evaluates, drop the rest. The
     logo files live in public/logos/. */
  var FAMILIES = {
    anthropic: { label: "Anthropic",   color: "#e5825f", logo: "Claude.png" },
    openai:    { label: "OpenAI",      color: "#8fa3bd", logo: "GPT.png" },
    google:    { label: "Google",      color: "#4f97ee", logo: "Gemini.png" },
    qwen:      { label: "Qwen",        color: "#a67ded", logo: "Qwen.png" },
    kimi:      { label: "Moonshot",    color: "#d0779a", logo: "Kimi.png" },
    doubao:    { label: "Seed",        color: "#2fbcbc", logo: "Doubao.png" },
    intern:    { label: "Intern",      color: "#46c489", logo: "InternLM.png" },
    /* TODO: rename once OS-Omni's own agent has a name; Ours.png is a
       placeholder mark carried over from the source template. */
    ours:      { label: "Ours",        color: "#d9a53a", logo: "Ours.png", ours: true }
  };

  /* -------------------------------------------------------- leaderboard cols
     What the leaderboard table shows. Each entry reads row[set][k], so
     changing the metric set means changing this list and the `full` / `hard`
     objects in MODELS together — no chart code needs touching.

     TODO: for an agent benchmark these are more likely to be success rate,
     milestone/progress rate, mean steps and cost per task. */
  var LEADERBOARD_COLS = [
    { k: "acc",  t: "Acc",    hint: "binary accuracy" },
    { k: "sRec", t: "sRec",   hint: "recall on GT = SUCCESS" },
    { k: "fRec", t: "fRec",   hint: "recall on GT = FAIL" },
    { k: "bal",  t: "BalAcc", hint: "balanced accuracy" }
  ];

  /* ------------------------------------------------------------ leaderboard
     PLACEHOLDER ROWS. Model names are real so the family logos and colours
     render; every number is invented and follows a smooth synthetic ladder.
     "access": closed | open | ours   (ours = open weights + open data)       */
  var MODELS = [
    // name,                     family,      access,  full[acc,sRec,fRec,bal],  hard[acc,sRec,fRec,bal]
    ["Claude-Opus-4-8",          "anthropic", "closed", [88.0, 91.0, 85.0, 88.0], [66.0, 70.0, 62.0, 66.0]],
    ["GPT-5.5",                  "openai",    "closed", [87.0, 92.0, 82.0, 87.0], [64.0, 69.0, 59.0, 64.0]],
    ["Gemini-3.1-Pro",           "google",    "closed", [86.0, 89.0, 83.0, 86.0], [62.0, 65.0, 59.0, 62.0]],
    ["Claude-Sonnet-4-6",        "anthropic", "closed", [85.0, 94.0, 76.0, 85.0], [59.0, 74.0, 44.0, 59.0]],
    ["GPT-5",                    "openai",    "closed", [84.0, 86.0, 82.0, 84.0], [57.0, 58.0, 56.0, 57.0]],
    ["Gemini-3.5-Flash",         "google",    "closed", [83.0, 93.0, 73.0, 83.0], [55.0, 72.0, 38.0, 55.0]],
    ["Kimi-K2.5",                "kimi",      "open",   [82.0, 92.0, 72.0, 82.0], [53.0, 70.0, 36.0, 53.0]],
    ["Qwen3.5-397B-A17B",        "qwen",      "open",   [81.0, 91.0, 71.0, 81.0], [52.0, 71.0, 33.0, 52.0]],
    ["GPT-5-mini",               "openai",    "closed", [80.0, 90.0, 70.0, 80.0], [50.0, 68.0, 32.0, 50.0]],
    ["Doubao-2.0-Lite",          "doubao",    "closed", [78.0, 93.0, 63.0, 78.0], [46.0, 76.0, 16.0, 46.0]],
    ["Intern-S1-Pro",            "intern",    "open",   [77.0, 88.0, 66.0, 77.0], [45.0, 64.0, 26.0, 45.0]],
    ["Qwen3.5-35B-A3B",          "qwen",      "open",   [75.0, 90.0, 60.0, 75.0], [43.0, 70.0, 16.0, 43.0]],
    ["Qwen3-VL-30B",             "qwen",      "open",   [70.0, 95.0, 45.0, 70.0], [36.0, 84.0,  8.0, 46.0]],
    ["Ours-9B",                  "ours",      "ours",   [83.0, 84.0, 82.0, 83.0], [58.0, 60.0, 56.0, 58.0]],
    ["Ours-35B-A3B",             "ours",      "ours",   [84.0, 85.0, 83.0, 84.0], [60.0, 62.0, 58.0, 60.0]]
  ].map(function (r) {
    return {
      name: r[0], family: r[1], access: r[2],
      full: { acc: r[3][0], sRec: r[3][1], fRec: r[3][2], bal: r[3][3] },
      hard: { acc: r[4][0], sRec: r[4][1], fRec: r[4][2], bal: r[4][3] }
    };
  });

  /* ------------------------------------------------------------------ multi
     PLACEHOLDER. Fine-grained grading table, rendered by main.js into
     #table-multi. Two quality axes plus a threshold-free ranking score.      */
  var MULTI = [
    { name: "GPT-5.5",           family: "openai",    align: 60.0, effic: 68.0, multi: 64.0, auc: 67.0 },
    { name: "Claude-Opus-4-8",   family: "anthropic", align: 58.0, effic: 66.0, multi: 62.0, auc: 65.0 },
    { name: "Ours-35B-A3B",      family: "ours",      align: 55.0, effic: 63.0, multi: 59.0, auc: 62.0 },
    { name: "Gemini-3.1-Pro",    family: "google",    align: 53.0, effic: 62.0, multi: 57.5, auc: 60.0 },
    { name: "Ours-9B",           family: "ours",      align: 50.0, effic: 58.0, multi: 54.0, auc: 58.0 },
    { name: "Kimi-K2.5",         family: "kimi",      align: 47.0, effic: 56.0, multi: 51.5, auc: 55.0 }
  ];

  /* ------------------------------------------------------------------- cost
     PLACEHOLDER. Cost against hard-set accuracy, drawn as a Pareto frontier.
     `cost` is USD to run the full set once, at whatever list prices the paper
     quotes. Set this to [] and the page prints a "figures being finalized"
     note in place of the chart instead of drawing invented points.           */
  var PARETO = [
    // name,                   family,      access,  cost,   hard,   full
    ["Claude-Opus-4-8",        "anthropic", "closed", 86.00, 66.00, 88.00],
    ["Claude-Sonnet-4-6",      "anthropic", "closed", 53.00, 59.00, 85.00],
    ["GPT-5.5",                "openai",    "closed", 45.00, 64.00, 87.00],
    ["Kimi-K2.5",              "kimi",      "open",   20.00, 53.00, 82.00],
    ["GPT-5",                  "openai",    "closed", 11.00, 57.00, 84.00],
    ["Gemini-3.1-Pro",         "google",    "closed",  8.00, 62.00, 86.00],
    ["Qwen3.5-397B-A17B",      "qwen",      "open",    8.00, 52.00, 81.00],
    ["Intern-S1-Pro",          "intern",    "open",    6.00, 45.00, 77.00],
    ["Gemini-3.5-Flash",       "google",    "closed",  5.50, 55.00, 83.00],
    ["Doubao-2.0-Lite",        "doubao",    "closed",  4.80, 46.00, 78.00],
    ["Ours-35B-A3B",           "ours",      "ours",    2.80, 60.00, 84.00],
    ["Qwen3.5-35B-A3B",        "qwen",      "open",    2.80, 43.00, 75.00],
    ["GPT-5-mini",             "openai",    "closed",  2.20, 50.00, 80.00],
    ["Ours-9B",                "ours",      "ours",    1.40, 58.00, 83.00],
    ["Qwen3-VL-30B",           "qwen",      "open",    1.40, 36.00, 70.00]
  ].map(function (r) {
    return { name: r[0], family: r[1], access: r[2], cost: r[3], hard: r[4], full: r[5] };
  });

  /* --------------------------------------------------------- failure modes
     PLACEHOLDER. Every incorrect outcome labelled into categories, as a share
     of that model's errors. `n` is the model's total error count. Set this to
     null and main.js skips the chart. TODO: replace the six categories with
     OS-Omni's own error taxonomy.                                            */
  var FAILURE_MODES = {
    categories: [
      { key: "incomplete", label: "Category A",  group: "accept", color: "#d9705c" },
      { key: "wrong",      label: "Category B",  group: "accept", color: "#e79470" },
      { key: "suppressed", label: "Category C",  group: "accept", color: "#e8c08f" },
      { key: "path",       label: "Category D",  group: "reject", color: "#a9d6c9" },
      { key: "deviation",  label: "Category E",  group: "reject", color: "#66b2a0" },
      { key: "ambiguous",  label: "Category F",  group: "reject", color: "#4f93a8" }
    ],
    rows: [
      { name: "Claude-Opus-4-8",   family: "anthropic", n: 120, values: [55.0, 8.0, 5.0, 4.0, 10.0, 18.0] },
      { name: "GPT-5.5",           family: "openai",    n: 130, values: [58.0, 6.0, 4.0, 4.0, 12.0, 16.0] },
      { name: "Gemini-3.1-Pro",    family: "google",    n: 140, values: [60.0, 5.0, 5.0, 4.0, 11.0, 15.0] },
      { name: "Claude-Sonnet-4-6", family: "anthropic", n: 150, values: [70.0, 6.0, 5.0, 3.0,  6.0, 10.0] },
      { name: "Kimi-K2.5",         family: "kimi",      n: 160, values: [72.0, 6.0, 4.0, 3.0,  5.0, 10.0] },
      { name: "Qwen3.5-397B-A17B", family: "qwen",      n: 170, values: [74.0, 5.0, 4.0, 2.0,  5.0, 10.0] }
    ]
  };

  /* --------------------------------------------------------------- hard set
     PLACEHOLDER. Mean per-model accuracy on the hard split, broken down two
     ways. `n` is the number of trajectories in each bucket.                  */
  var HARD_BREAKDOWN = {
    platform: [
      { key: "Mobile",  n: 120, acc: 58.0 },
      { key: "Web",     n: 160, acc: 54.0 },
      { key: "Ubuntu",  n: 140, acc: 50.0 },
      { key: "macOS",   n: 100, acc: 46.0 },
      { key: "Windows", n:  80, acc: 42.0 }
    ],
    failure: [
      { key: "Memory",     n:  60, acc: 52.0 },
      { key: "Planning",   n: 200, acc: 48.0 },
      { key: "Action",     n: 110, acc: 44.0 },
      { key: "Perception", n:  90, acc: 40.0 }
    ]
  };

  /* ------------------------------------------------------------- ablations
     PLACEHOLDER. Change in the headline metric against the main setting, in
     percentage points, one input component perturbed at a time. `avg` is the
     mean across the models shown and is drawn as a trailing column.          */
  var ABLATIONS = {
    models: ["Opus-4-8", "Sonnet-4-6", "GPT-5.5", "GPT-5", "GPT-5-mini",
             "3.1-Pro", "3.5-Flash", "K2.5", "3.5-397B"],
    families: ["anthropic", "anthropic", "openai", "openai", "openai",
               "google", "google", "kimi", "qwen"],
    rows: [
      { label: "Ablation 1", note: "TODO: what was removed",
        values: [-0.5, -0.3, 0.3, 0.2, -0.3, 0.2, 0.5, -0.2, -0.3], avg: -0.04 },
      { label: "Ablation 2", note: "TODO: what was removed",
        values: [-2.0, -1.5, -1.0, -1.8, -1.2, -1.4, -0.9, -1.1, -1.3], avg: -1.36 },
      { label: "Ablation 3", note: "TODO: what was removed",
        values: [-9.0, -7.0, -8.5, -10.0, -5.5, -8.0, -6.5, -7.5, -5.0], avg: -7.44 },
      { label: "Ablation 4", note: "TODO: what was removed",
        values: [-3.0, -1.6, -0.7, -3.4, -2.7, -2.5, -2.3, 0.3, -0.3], avg: -1.80 },
      { label: "Ablation 5", note: "TODO: what was removed",
        values: [0.2, 0.6, -0.3, 0.5, 0.6, 1.2, 0.4, 1.3, -0.2], avg: 0.48 }
    ]
  };

  /* --------------------------------------------------------- generalization
     PLACEHOLDER. Held-out benchmarks, scored against each benchmark's own
     verifier. `leniency` feeds the grouped-bar chart beside it.              */
  var GENERALIZATION = {
    benchmarks: ["Benchmark A", "Benchmark B", "Benchmark C"],
    rows: [
      { name: "Gemini-3.1-Pro",    family: "google",    v: [85, 88, 90], mean: 88 },
      { name: "Claude-Opus-4-8",   family: "anthropic", v: [84, 87, 89], mean: 87 },
      { name: "GPT-5.5",           family: "openai",    v: [82, 86, 88], mean: 85 },
      { name: "Ours-35B-A3B",      family: "ours",      v: [80, 84, 86], mean: 83 },
      { name: "Ours-9B",           family: "ours",      v: [78, 82, 84], mean: 81 },
      { name: "Kimi-K2.5",         family: "kimi",      v: [75, 78, 80], mean: 78 },
      { name: "Qwen3.5-397B",      family: "qwen",      v: [72, 75, 77], mean: 75 },
      { name: "Qwen3.5-35B",       family: "qwen",      v: [68, 71, 73], mean: 71 },
      { name: "Qwen3-VL-30B",      family: "qwen",      v: [64, 66, 68], mean: 66 }
    ],
    /* the grouped-bar chart beside the heatmap: one series per key below */
    leniencySeries: [
      { key: "ours9b",  label: "Ours-9B",             color: "#d9a53a" },
      { key: "ours35b", label: "Ours-35B-A3B",        color: "#a8741d" },
      { key: "base",    label: "Open baselines (median)", color: "#8093a8" }
    ],
    leniency: [
      { bench: "Benchmark A", ours9b: 0.45, ours35b: 0.50, base: 0.25 },
      { bench: "Benchmark B", ours9b: 0.80, ours35b: 0.85, base: 0.60 },
      { bench: "Benchmark C", ours9b: 0.65, ours35b: 0.70, base: 0.30 }
    ],
    n: { "Benchmark A": 700, "Benchmark B": 400, "Benchmark C": 300 }
  };

  /* ------------------------------------------------------------- benchmark
     PLACEHOLDER. Size and composition of the benchmark itself.
     `platforms` feeds the platform donut; `length` feeds the box plots beside
     the success/fail split bars. Percentages should sum to 100.              */
  var BENCHMARK = {
    /* headline count, used as the donut centre and in the page copy */
    total: 1000, totalShow: "1,000",
    full: { n: 1000, success: 40, fail: 60, nSuccess: 400, nFail: 600 },
    hard: { n:  300, success: 30, fail: 70, nSuccess:  90, nFail: 210 },
    multi: { n: 400 },
    platforms: [
      { key: "Web",     pct: 30, color: "#4f97ee" },
      { key: "Ubuntu",  pct: 25, color: "#2f9fbd" },
      { key: "Windows", pct: 20, color: "#6f7fa8" },
      { key: "macOS",   pct: 15, color: "#1a6b83" },
      { key: "Mobile",  pct: 10, color: "#d9a53a" }
    ],
    /* Trajectory length in steps; whiskers at 1.5 IQR, outliers not drawn. */
    length: {
      success: { min: 1, q1: 10, med: 20, q3: 35, max: 60, mean: 24.0 },
      fail:    { min: 1, q1: 20, med: 40, q3: 65, max: 100, mean: 46.0 }
    }
  };

  /* ------------------------------------------------------------ method data
     PLACEHOLDER. Composition of whatever corpus the Method section describes.
     Feeds the donut in that section.                                         */
  var CORPUS_PLATFORMS = [
    { key: "Web",     n: 40000, pct: 40 },
    { key: "Windows", n: 20000, pct: 20 },
    { key: "macOS",   n: 15000, pct: 15 },
    { key: "Ubuntu",  n: 15000, pct: 15 },
    { key: "Mobile",  n: 10000, pct: 10 }
  ];
  var CORPUS_TOTAL = 100000;

  /* --------------------------------------------------------- data pipeline
     PLACEHOLDER. The corpus funnel, drawn as a Sankey. Columns 1-4 count
     trajectories on one scale; the last two columns count a different unit
     (`judged.unit` / `corpus.unit`) and are drawn on their own scale, which
     is why the chart prints "unit changes · scale restarts" between them.
     Every caption here is data-driven — relabel the funnel from this object
     rather than editing osomni-charts.js.                                    */
  var CORPUS_FLOW = {
    stages: [
      { id: "raw",   label: "Raw instructions",   n: 100000, show: "100K",
        note: "TODO: where they came from" },
      { id: "instr", label: "Instructions kept",  n: 85000,  show: "85K",
        note: "TODO: what the filter does" },
      { id: "traj",  label: "Trajectories kept",  n: 75000,  show: "75K",
        note: "TODO: before the quality filter" },
      { id: "final", label: "Final trajectories", n: 80000,  show: "80K",
        note: "TODO: self-collected plus external corpora" }
    ],
    drops: [
      { after: "raw",   label: "Instruction filter",   n: 15000, show: "−15K" },
      { after: "instr", label: "Bad-trajectory filter", n: 10000, show: "−10K" },
      { after: "traj",  label: "Quality filter",       n: 25000, show: "−25K" }
    ],
    carried: { n: 50000, show: "50K", label: "Self-collected, kept" },
    sources: [
      { label: "Source A", n: 20000, show: "20K", color: "#a67ded" },
      { label: "Source B", n:  5000, show: "5K",  color: "#e5825f" },
      { label: "Source C", n:  3000, show: "3K",  color: "#4f97ee" },
      { label: "Source D", n:  2000, show: "2K",  color: "#8fa3bd" }
    ],
    judged: {
      label: "Annotation passes", n: 320000, show: "320,000",
      note: "TODO: how many passes per trajectory, and by whom",
      perTraj: 4.0,
      /* wording knobs — what this column counts, and how the ribbon reads */
      unit: "Passes", step: "Annotation", perTrajLabel: "Passes each"
    },
    agreement: {
      label: "Agreement filter", dropped: 12000, show: "−12K",
      keptTraj: 68000, keptPct: 85,
      note: "TODO: what has to agree for a record to be kept",
      dropNote: "annotators disagreed"
    },
    corpus: { label: "OS-Omni-Corpus", n: 96000, show: "100K",
              unit: "Training samples",
              note: "TODO: what one sample contains" }
  };

  /* ---------------------------------------------------------------- method
     PLACEHOLDER. Trained models against the checkpoints they start from,
     rendered by main.js into #table-training. `role`: base | ours.           */
  var TRAINING = [
    { name: "Base-9B (base)",     role: "base", full: [75.0, 95.0, 55.0, 75.0], hard: [40.0, 90.0, 12.0, 51.0] },
    { name: "Ours-9B",            role: "ours", full: [83.0, 84.0, 82.0, 83.0], hard: [58.0, 60.0, 56.0, 58.0] },
    { name: "Base-35B-A3B (base)", role: "base", full: [78.0, 92.0, 62.0, 77.0], hard: [45.0, 85.0, 20.0, 52.5] },
    { name: "Ours-35B-A3B",       role: "ours", full: [84.0, 85.0, 83.0, 84.0], hard: [60.0, 62.0, 58.0, 60.0] }
  ];

  /* ------------------------------------------------------------------
     DataViewer examples — PLACEHOLDER CONTENT, NOT BENCHMARK DATA.

     The viewer itself is fully wired and stays: instruction, stepped
     trajectory, then a reveal that shows the gold verdict and how each
     evaluated model scored it. These three records exist only so it can be
     built and styled. Replace `examples` with the real export and set
     `placeholder` to false in the same commit, so the viewer can never be
     advertised while showing invented data.

     Per step: `action` (a code line), `thought` (one sentence), and an
     optional `shot` image path. Without `shot` a labelled dashed frame is
     drawn, which is where a real screenshot belongs.
     ------------------------------------------------------------------ */
  var VIEWER = {
    placeholder: true,
    /* label above the per-model verdict list in the reveal panel */
    verdictLabel: "What the evaluated models called it",
    examples: [
      {
        id: "web-0007",
        platform: "Web",
        instruction: "Collect the last four quarterly revenue figures for the three companies in " +
          "the open watchlist, put them in a new spreadsheet with one row per company, and " +
          "share the file with the team.",
        gold: "failure",
        goldWhy: "All twelve figures are collected correctly and the sheet is built, but the run " +
          "stops before sharing it — the last clause of a four-part instruction is never carried out.",
        steps: [
          { action: "click(\"Watchlist\")",
            thought: "Read the three tickers off the watchlist before opening anything else." },
          { action: "open_tab(\"investor relations · company 1\")",
            thought: "Quarterly figures are on the IR page, not the summary card." },
          { action: "extract(table=\"Quarterly revenue\", rows=4)",
            thought: "Take the four most recent quarters in the order the table lists them." },
          { action: "repeat(companies 2-3)",
            thought: "Same route for the other two; the page layout is identical." },
          { action: "new_sheet(\"Q-revenue\") → paste(rows=3, cols=5)",
            thought: "One row per company, first column the name." },
          { action: "stop()",
            thought: "The spreadsheet is complete, so the task looks done." }
        ],
        judges: [
          { name: "GPT-5.5", verdict: "success", correct: false },
          { name: "Claude-Opus-4-8", verdict: "failure", correct: true },
          { name: "Qwen3-VL-30B", verdict: "success", correct: false },
          { name: "Ours-9B", verdict: "failure", correct: true }
        ]
      },
      {
        id: "windows-0031",
        platform: "Windows",
        instruction: "Reconcile this month's expense sheet against the receipts folder, flag any " +
          "row without a matching receipt, and email the flagged rows to the finance alias.",
        gold: "success",
        goldWhy: "Every row is checked against the folder, the three unmatched rows are highlighted " +
          "and copied into the message, and the mail is sent to the right address.",
        steps: [
          { action: "open(\"expenses-march.xlsx\")",
            thought: "Start from the sheet; the folder listing is easier to scan afterwards." },
          { action: "open_explorer(\"\\\\receipts\\\\2026-03\")",
            thought: "Match on the receipt number in the filename rather than on the amount." },
          { action: "for_each(row) → lookup(receipt_id)",
            thought: "Walk the sheet top to bottom so nothing is skipped." },
          { action: "highlight(rows=[14, 22, 31], color=\"amber\")",
            thought: "Three rows have no matching file." },
          { action: "copy(rows=[14, 22, 31]) → open(\"Outlook\") → new_mail()",
            thought: "Paste the flagged rows into the body so finance does not have to open the sheet." },
          { action: "type(to=\"finance@\", subject=\"March: 3 rows without receipts\") → click(\"Send\")",
            thought: "Sent; the sheet keeps the highlighting for the record." }
        ],
        judges: [
          { name: "GPT-5.5", verdict: "success", correct: true },
          { name: "Claude-Opus-4-8", verdict: "success", correct: true },
          { name: "Qwen3-VL-30B", verdict: "failure", correct: false },
          { name: "Ours-9B", verdict: "success", correct: true }
        ]
      },
      {
        id: "mobile-0018",
        platform: "Mobile",
        instruction: "Book the earliest train to Kyoto next Friday that still has a window seat, " +
          "then add it to the calendar with the platform number in the notes.",
        gold: "failure",
        goldWhy: "The booking is made and the calendar entry created, but on the 07:12 rather than " +
          "the 06:40 — the earlier train had window seats left and the agent never checked it.",
        steps: [
          { action: "open(\"Rail\") → search(from=\"Tokyo\", to=\"Kyoto\", date=\"next Fri\")",
            thought: "Set the route first; the seat map only loads once a service is picked." },
          { action: "click(\"07:12 · Nozomi 205\")",
            thought: "First service in the visible list." },
          { action: "click(\"Seat map\") → click(\"14A · window\")",
            thought: "A window seat is free, which is the constraint in the instruction." },
          { action: "click(\"Pay\") → confirm()",
            thought: "Booking confirmed, reference on screen." },
          { action: "open(\"Calendar\") → new_event(\"Kyoto 07:12\")",
            thought: "Put the platform in the notes as asked." },
          { action: "type(notes=\"Platform 14\") → click(\"Save\")",
            thought: "Both halves of the instruction look done." }
        ],
        judges: [
          { name: "GPT-5.5", verdict: "success", correct: false },
          { name: "Claude-Opus-4-8", verdict: "success", correct: false },
          { name: "Qwen3-VL-30B", verdict: "success", correct: false },
          { name: "Ours-9B", verdict: "failure", correct: true }
        ]
      }
    ]
  };

  global.OSOmniData = {
    placeholder: PLACEHOLDER,
    families: FAMILIES,
    leaderboardCols: LEADERBOARD_COLS,
    models: MODELS,
    paretoPoints: PARETO,
    failureModes: FAILURE_MODES,
    multi: MULTI,
    hardBreakdown: HARD_BREAKDOWN,
    ablations: ABLATIONS,
    generalization: GENERALIZATION,
    benchmark: BENCHMARK,
    corpus: { platforms: CORPUS_PLATFORMS, total: CORPUS_TOTAL },
    corpusFlow: CORPUS_FLOW,
    training: TRAINING,
    viewer: VIEWER,
    logoPath: "public/logos/",
    /* convenience lookup */
    byName: MODELS.reduce(function (m, j) { m[j.name] = j; return m; }, {})
  };
})(window);
