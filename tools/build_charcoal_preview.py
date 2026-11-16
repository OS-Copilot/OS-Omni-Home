"""Build a separate visual version without rewriting the current homepage."""
from pathlib import Path
import hashlib
import json
import re

ROOT=Path(__file__).resolve().parents[1]

HERO='''  <header class="hero" id="top">
    <div class="wrap">
      <div class="charcoal-hero-grid">
        <div class="hero-content">
          <div class="charcoal-brand-lockup">
            <div><p class="charcoal-kicker"><i aria-hidden="true"></i>CROSS-PLATFORM BENCHMARK</p><p class="charcoal-brand-name">OS-Omni</p></div>
          </div>
          <h1 class="charcoal-paper-title">Benchmarking Generalist Computer-Using Agents on Long-Horizon Workflows Across Platforms</h1>
          <p class="lede">Real work moves between applications, platforms, and devices. OS-Omni evaluates computer-using agents on 300 long-horizon tasks, with success checked against the state they leave behind.</p>
          <div class="charcoal-hero-actions">
            <a class="btn charcoal-primary" href="#playground-section">Explore the playground <span aria-hidden="true">↗</span></a>
            <a class="btn" href="#leaderboard">View results</a>
            <a class="charcoal-text-link" href="#tasks">Browse tasks <span aria-hidden="true">→</span></a>
          </div>
          <a class="charcoal-paper-link" href="#resources">Paper &amp; research resources <span aria-hidden="true">↗</span></a>
        </div>
        <figure class="charcoal-brand-visual">
          <img class="charcoal-brand-art" src="public/favicon-512.png" width="512" height="512" alt="OS-Omni project mark: a robot surrounded by Windows, Linux, macOS, iOS, Android, and Web devices." fetchpriority="high" decoding="async">
        </figure>
      </div>
      <div class="charcoal-facts" aria-label="Benchmark at a glance">
        <div><strong>300</strong><span>long-horizon tasks</span></div>
        <div><strong>6</strong><span>evaluation platforms</span></div>
        <div><strong>12</strong><span>cross-device workflows</span></div>
        <div><strong>7</strong><span>evaluated models</span></div>
      </div>
    </div>
  </header>'''

def main():
    original=(ROOT/'index.html').read_text(encoding='utf-8')
    classic=ROOT/'index.classic.html'
    if not classic.exists():classic.write_text(original,encoding='utf-8')
    assert classic.read_bytes()==(ROOT/'index.html').read_bytes(),'Classic snapshot diverged; do not overwrite it.'
    html=original.replace('<body>','<body class="charcoal">',1)
    html=html.replace('<meta name="theme-color" content="#02091a">','<meta name="theme-color" content="#101112">',1)
    html=html.replace('<meta name="color-scheme" content="light dark">','<meta name="color-scheme" content="dark">',1)
    html=html.replace('</head>','  <link rel="stylesheet" href="static/css/charcoal-preview.css?v=20261116-3">\n</head>',1)
    boot='''<script>
    (function(){var d=document.documentElement;d.className+=" js";d.setAttribute("data-theme","dark");})();
  </script>'''
    html,n=re.subn(r'<script>\s*\(function\s*\(\).*?</script>',lambda _:boot,html,count=1,flags=re.S)
    assert n==1
    html=re.sub(r'\s*<div class="cosmos" aria-hidden="true"></div>','',html,count=1)
    html=re.sub(r'\s*<canvas id="starfield" aria-hidden="true"></canvas>','',html,count=1)
    start=html.index('      <ul class="nav-links" id="navLinks">')
    end=html.index('      <div class="nav-tools">',start)
    links='''      <ul class="nav-links" id="navLinks">
        <li><a href="#abstract">Overview</a></li>
        <li><a href="#playground-section">Playground</a></li>
        <li><a href="#benchmark">Benchmark</a></li>
        <li><a href="#leaderboard">Results</a></li>
        <li><a href="#resources">Resources</a></li>
      </ul>
'''
    html=html[:start]+links+html[end:]
    html,n=re.subn(r'<button class="icon-btn" id="themeToggle".*?</button>',
                  '<a class="charcoal-compare" href="index.classic.html" title="Compare with the saved original design">Original ↗</a>',html,count=1,flags=re.S)
    assert n==1
    html,n=re.subn(r'  <header class="hero" id="top">.*?</header>',lambda _:HERO,html,count=1,flags=re.S)
    assert n==1
    html=html.replace('Five platforms.<br><span class="gilt">Open something.</span>','Open a device.<br><span class="gilt">Explore its applications.</span>')
    html=html.replace('Seven models.<br><span class="gilt">Every score, in the open.</span>','Results across platforms.<br><span class="gilt">Every score, in the open.</span>')
    # All runtime scripts and all content section IDs must survive the style version.
    script=lambda s:re.findall(r'<script\s+src="([^"]+)"',s)
    assert script(html)==script(original)
    assert 'Benchmarking Generalist Computer-Using Agents on Long-Horizon Workflows Across Platforms</h1>' in html
    assert 'class="charcoal-brand-art"' in html
    for section_id in ['playground-section','abstract','benchmark','leaderboard','findings','method','tasks','case-studies','resources','cite']:
        assert f'id="{section_id}"' in html
    target='index.charcoal.saved.html' if (ROOT/'index.charcoal.saved.html').exists() else 'index.charcoal.html'
    (ROOT/target).write_text(html,encoding='utf-8')
    print(json.dumps({'preview':target,'classic':'index.classic.html','original_sha256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'preserved_runtime_scripts':len(script(html))}))

if __name__=='__main__':main()
