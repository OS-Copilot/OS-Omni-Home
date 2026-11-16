"""Create an icon-led mint/blue visual version; preserve both earlier versions."""
from pathlib import Path
import hashlib
import re
import json
import sys

ROOT=Path(__file__).resolve().parents[1]

def main():
    saved=ROOT/'index.charcoal.saved.html'
    if not saved.exists():
        saved.write_bytes((ROOT/'index.charcoal.html').read_bytes())
    charcoal=saved.read_text(encoding='utf-8')
    original=(ROOT/'index.html').read_bytes()
    html=charcoal.replace('<body class="charcoal">','<body class="charcoal orbit">',1)
    html=html.replace('<meta name="theme-color" content="#101112">','<meta name="theme-color" content="#dce8e2">',1)
    html=html.replace('<meta name="color-scheme" content="dark">','<meta name="color-scheme" content="light">',1)
    html=html.replace('d.setAttribute("data-theme","dark")','d.setAttribute("data-theme","light")',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/orbit-preview.css?v=20261116-3">\n</head>',1)
    html=html.replace('href="index.classic.html" title="Compare with the saved original design">Original ↗',
                      'href="index.charcoal.saved.html" title="Compare with the saved charcoal version">Charcoal ↗',1)
    scripts=lambda s:re.findall(r'<script\s+src="([^"]+)"',s)
    assert scripts(html)==scripts(charcoal)
    html,n=re.subn(r'(<h2 class="section-title" id="device-showcase-title">).*?(</h2>)',
                  r'\1Explore the applications.\2',html,count=1,flags=re.S)
    assert n==1
    html=html.replace('Choose a platform, then an App. Explore five browser-local device workspaces; the benchmark also evaluates Web as a sixth platform. Native benchmark execution runs in the separate OS-Omni environments.',
                      'Choose a platform and open an App in five browser-local workspaces. Native benchmark runs use separate environments; Web is evaluated as a sixth platform.',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/leaderboard-explorer.css?v=20261116-1">\n</head>',1)
    html=html.replace('</body>','  <script src="static/js/leaderboard-explorer.js?v=20261116-2"></script>\n</body>',1)
    # A small, useful bridge between live workspaces, task specifications and
    # recorded evidence follows the exploration flow of the reference homepage.
    guide='''<div class="orbit-explore-guide" aria-label="Ways to explore OS-Omni">
      <a href="#playground"><span>01</span><strong>Open a workspace</strong><small>Choose a platform and an application.</small><b aria-hidden="true">↗</b></a>
      <a href="#tasks"><span>02</span><strong>Find a task</strong><small>Browse the released instructions by App.</small><b aria-hidden="true">↗</b></a>
      <a href="#case-studies"><span>03</span><strong>Follow a trajectory</strong><small>Inspect recorded actions and final states.</small><b aria-hidden="true">↗</b></a>
    </div>'''
    marker='<div id="playground" data-platform="linux"></div>'
    assert marker in html
    html=html.replace(marker,guide+'\n    '+marker,1)
    assert 'class="charcoal-brand-art"' in html
    assert 'Benchmarking Generalist Computer-Using Agents on Long-Horizon Workflows Across Platforms</h1>' in html
    assert (ROOT/'index.classic.html').read_bytes()==original
    (ROOT/'index.mint.html').write_text(html,encoding='utf-8')
    # Keep the previously shared preview address on the current design too.
    if '--mint-only' not in sys.argv:
        (ROOT/'index.orbit.html').write_text(html,encoding='utf-8')
        (ROOT/'index.charcoal.html').write_text(html,encoding='utf-8')
    print(json.dumps({'entry':'index.orbit.html','runtime_scripts_preserved':len(scripts(html)),
                      'active_preview_alias':'index.charcoal.html','saved_charcoal':'index.charcoal.saved.html',
                      'original_sha256':hashlib.sha256(original).hexdigest(),
                      'charcoal_sha256':hashlib.sha256(charcoal.encode('utf-8')).hexdigest()}))

if __name__=='__main__':main()
