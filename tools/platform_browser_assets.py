"""Package platform-specific original WebView/Electron assets from audited caches."""
from pathlib import Path
import os,shutil,re
def package_platform_assets(home,output,profiles):
 for platform,cache in [('android',home.parent/'android_img/browser-clients-v3'),('windows',home.parent/'windows_img/browser-clients-v31'),('ios',home.parent/'ios_img/browser-clients-v3'),('macos',home.parent/'macos_img/browser-clients-v3')]:
  for app in profiles.get(platform,{}).get('applications',[]):
   if not app.get('url','').startswith(f'public/playground/apps/{platform}/'):continue
   source=cache/app['id'];destination=output/platform/app['id']
   if not (source/'index.html').is_file():raise RuntimeError('Platform source missing: '+str(source))
   shutil.copytree(source,destination,dirs_exist_ok=True)
   for html in destination.rglob('*.html'):
    rel=os.path.relpath(output,html.parent).replace('\\','/');text=html.read_text(encoding='utf-8')
    text=re.sub(r'(<head\b[^>]*>)',r'\1'+f'<script src="{rel}/browser-bridge.js"></script><script src="{rel}/device-clock.js"></script>',text,count=1)
    # Bootstrap after the local API has loaded but before the main renderer starts.
    text=re.sub(r'(<script\b[^>]*src=["\'](?:\./)?app\.js["\'][^>]*>)',f'<script src="{rel}/browser-bootstrap.js"></script>'+r'\1',text)
    if app['id']=='drawio' and html.name=='index.html':text=text.replace('</head>',f'<script src="{rel}/drawio-adapter.js"></script></head>')
    if app['id']=='opennavigation':
     scripts=f'<script src="{rel}/map-tiles.js"></script>'
     if platform!='android':
      scripts+=f'<script>window.OSOmniMapTileBase="../../opennavigation/tiles";</script><script src="{rel}/opendriver/driver-modules.js"></script><script src="{rel}/driver-runtime.js"></script><script src="{rel}/navigation-local.js"></script>'
      text=text.replace('<div class="list-tabs" id="list-tabs">','<button id="save-place-button" style="margin:8px;padding:8px">Save place</button><div class="list-tabs" id="list-tabs">')
     text=text.replace('</head>',scripts+'</head>')
     text=text.replace('</body>','<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="position:fixed;bottom:3px;right:4px;z-index:50;font:10px Arial;background:white;padding:2px">© OpenStreetMap contributors</a></body>')
    if app['id']=='opendriver':
     text=text.replace('<base href="/">','<base href="./">')
     text=text.replace('</head>',f'<script src="{rel}/opendriver/driver-modules.js"></script><script src="{rel}/map-tiles.js"></script><script src="{rel}/driver-runtime.js"></script></head>')
    html.write_text(text,encoding='utf-8')
   js=destination/'app.js'
   if js.exists():
    text=js.read_text(encoding='utf-8')
    if app['id'] in ('openshop','opentrip'):
     text=text.replace('const isLocalShell =','const isLocalShell = (window.openshopUseLocalApi === true || window.opentripUseLocalApi === true) ||')
    if app['id']=='opennavigation':
     if platform=='android':
      text=text.replace('function shouldUseLocalBackend() {','function shouldUseLocalBackend() { return true;')
      text=text.replace('function defaultTileBasePath() {','function defaultTileBasePath() { return "../../opennavigation/tiles";')
     else:
      text=text.replace('async function api(path, options = {}) {','async function api(path, options = {}) { return OSOmniNavigationAPI(path,options); }\nasync function unusedRemoteApi(path, options = {}) {')
      text=text.replace('state.savedPlaces = [...state.currentAccount.savedPlaces];','state.savedPlaces = JSON.parse(localStorage.getItem("navigation.saved") || "null") || [...state.currentAccount.savedPlaces];')
      text=text.replace('function bindEvents() {','function bindEvents() {document.getElementById("save-place-button").onclick=()=>{const p=state.selectedPlace||(state.directionsMode?state.destination:null);if(!p)return;if(!state.savedPlaces.some(s=>s.provider_place_id===p.provider_place_id))state.savedPlaces.unshift(structuredClone(p));localStorage.setItem("navigation.saved",JSON.stringify(state.savedPlaces));setStatus("Place saved.");};')
     start=text.index('window.openNavigationTileFallback =');end=text.index('\nconst currentLocationPlace',start)
     text=text[:start]+'window.openNavigationTileFallback = image => OSOmniMapTiles.recover(image);\n'+text[end:]
     text=text.replace('const rect = map.getBoundingClientRect();','const rect = {width:map.clientWidth,height:map.clientHeight,left:0,top:0};')
    for call in ['bootstrap().catch(', 'boot().catch(', 'init().catch(']:
     index=text.rfind(call)
     if index>=0:text=text[:index]+'window.OSOmniBrowserBoot && window.OSOmniBrowserBoot();\n'+text[index:];break
    js.write_text(text,encoding='utf-8')
   flutter=destination/'flutter_bootstrap.js'
   if flutter.exists():
    text=flutter.read_text(encoding='utf-8');text=text[:text.rfind('_flutter.loader.load({')]+'_flutter.loader.load({config:{canvasKitBaseUrl:"./canvaskit/"}});\n';flutter.write_text(text,encoding='utf-8')
   print('Packaged original',platform,app['name'],flush=True)
