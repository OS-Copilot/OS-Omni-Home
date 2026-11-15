/* OS-Omni Camera Ready data. Values transcribed from the user-supplied
   NeurIPS 2026 Camera Ready, Table 1, Figure 5, and Sections 1, 3, 4.
   Published averages are retained at the paper's precision.
   Cross-device is labelled Cross-VM in Table 1; these are the same 12 workflows. */
(function(global){
  "use strict";
  var tracks=[
    {key:"windows",label:"Windows",count:48,color:"#60a5fa"},
    {key:"linux",label:"Linux",count:48,color:"#5ec8f2"},
    {key:"macos",label:"macOS",count:48,color:"#a78bfa"},
    {key:"ios",label:"iOS",count:48,color:"#f472b6"},
    {key:"android",label:"Android",count:48,color:"#34d399"},
    {key:"web",label:"Web",count:48,color:"#fbbf24"},
    {key:"cross_device",label:"Cross-device",count:12,color:"#fb7185"}
  ];
  var rows=[
    ["Human Performance","human",[78.4,74.6,79.8,75.2,72.6,76.9,83.3],77.3],
    ["GPT-6-Astra","openai",[66.7,89.6,50.0,33.3,77.1,87.5,58.3],66.1],
    ["Claude Opus 5.5","anthropic",[62.5,85.4,54.2,41.7,81.3,70.8,83.3],68.5],
    ["Gemini 4","google",[58.3,95.8,39.6,18.8,66.7,81.3,50.0],58.6],
    ["DeepSeek V4.1 Flash","deepseek",[22.9,62.5,16.7,12.5,41.7,22.9,33.3],30.4],
    ["Qwen 3.8 Max","qwen",[6.3,6.3,4.2,12.5,31.3,6.3,25.0],13.1],
    ["Qwen 3.8 27B","qwen",[0.0,0.0,2.1,6.3,0.0,0.0,0.0],1.2],
    ["Qwen 3.8 9B","qwen",[0.0,0.0,0.0,0.0,0.0,0.0,0.0],0.0]
  ];
  global.OSOmniData={
    placeholder:false, release:"v1",
    source:{title:"OS-Omni Camera Ready",table:"Table 1 (p. 9)",distribution:"Figure 5 (p. 8)",workload:"Introduction (p. 2)",scope:"Sections 3.3–3.6 (pp. 6–8)",average:"Unweighted mean over six platforms and Cross-device; not task-weighted."},
    tracks:tracks,
    results:rows.map(function(row){return {name:row[0],family:row[1],scores:row[2],average:row[3],human:row[1]==="human"};}),
    benchmark:{tasks:300,platforms:6,crossDevice:12,openSeriesTasks:181,applications:35,annotators:30,annotationHours:2400,reviewHours:400},
    humanWorkload:{osomni:{steps:67.54,seconds:200.97},osworld:{steps:15.0,seconds:111.94}},
    taxonomy:[{label:"Cross-application",percent:25.7},{label:"Professional productivity",percent:22.9},{label:"Daily life",percent:20.0},{label:"Web tasks",percent:17.1},{label:"Operating-system tasks",percent:14.3}],
    protocol:{observation:"Screenshot only",history:3,singlePlatform:{maxSteps:300,stepTimeoutSeconds:180},crossDevice:{minSteps:300,maxSteps:650,stepTimeoutSeconds:120}},
    failureCategories:["Visual grounding","State tracking","Persistence","Platform and timing"],
    chartPalette:{primary:"#39cdb5",secondary:"#ff8f6b",categories:["#60a5fa","#5ec8f2","#a78bfa","#f472b6","#34d399","#fbbf24","#fb7185"],families:{openai:"#39cdb5",anthropic:"#ff8f6b",google:"#60a5fa",deepseek:"#a78bfa",qwen:"#f472b6",human:"#e4c880"}},
    unavailable:["Cost measurements","Quantified error frequencies","Ablation results","Training or fine-tuning gains","Confidence intervals","Per-platform human timing"]
  };
})(window);
