"""Build the current cool-blue research theme; retain the prior mint design."""
from pathlib import Path
import subprocess
import sys
import re
import json

ROOT=Path(__file__).resolve().parents[1]

def main():
    subprocess.run([sys.executable,str(ROOT/'tools/build_orbit_preview.py'),'--mint-only'],cwd=ROOT,check=True)
    mint=(ROOT/'index.mint.html').read_text(encoding='utf-8')
    html=mint.replace('<body class="charcoal orbit">','<body class="charcoal orbit research">',1)
    html=html.replace('content="#dce8e2"','content="#d3dce7"',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/research-preview.css?v=20261116-1">\n</head>',1)
    html,n=re.subn(r'<a class="charcoal-compare".*?</a>',
                  '<a class="charcoal-compare" href="index.mint.saved.html" title="Compare with the saved mint version">Previous palette ↗</a>',html,count=1,flags=re.S)
    assert n==1
    (ROOT/'index.research.light.html').write_text(html,encoding='utf-8')
    html=html.replace('<body class="charcoal orbit research">','<body class="charcoal orbit research research-dark">',1)
    html=html.replace('d.setAttribute("data-theme","light")','d.setAttribute("data-theme","dark")',1)
    html=html.replace('<meta name="color-scheme" content="light">','<meta name="color-scheme" content="dark">',1)
    html=html.replace('content="#d3dce7"','content="#0c1524"',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/research-dark.css?v=20261116-3">\n</head>',1)
    html=html.replace('href="index.mint.saved.html" title="Compare with the saved mint version">Previous palette',
                      'href="index.research.light.saved.html" title="Compare with the saved light research version">Light version',1)
    assert re.findall(r'<script\s+src="([^"]+)"',html)==re.findall(r'<script\s+src="([^"]+)"',mint)
    assert 'class="charcoal-brand-art"' in html and 'Long-Horizon Workflows Across Platforms</h1>' in html
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/mascot-3d.css?v=companion-actions-15">\n</head>',1)
    html=html.replace('</body>','  <script type="module" src="static/js/mascot-3d.js?v=companion-actions-15"></script>\n</body>',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/exploration-motion.css?v=exploration-9">\n</head>',1)
    html=html.replace('</body>','  <script type="module" src="static/js/exploration-motion.js?v=exploration-9"></script>\n</body>',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/galaxy.css?v=galaxy-10">\n</head>',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/page-galaxy.css?v=page-galaxy-11">\n</head>',1)
    html=html.replace('</body>','  <script type="module" src="static/js/page-galaxy.js?v=unified-galaxy-12"></script>\n</body>',1)
    for entry in ['index.research.html','index.orbit.html','index.charcoal.html']:
        (ROOT/entry).write_text(html,encoding='utf-8')
    print(json.dumps({'entry':'index.research.html','active_aliases':['index.orbit.html','index.charcoal.html'],
                      'saved_mint':'index.mint.saved.html','saved_light':'index.research.light.saved.html','theme':'dark navy / cold white / electric blue'}))

if __name__=='__main__':main()