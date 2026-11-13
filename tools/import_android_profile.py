"""Import the audited Android APK inventory and original launcher artwork."""
from pathlib import Path
import json,shutil
from PIL import Image,ImageDraw
HOME=Path(__file__).resolve().parents[1];IMAGE=HOME.parent/'android_img'
MAPPING={
 'app.organicmaps.web':'maps','chat.delta':'deltachat','com.android.chrome':'chrome','com.android.settings':'settings',
 'com.fsck.k9':'k9','com.github.emavgl.piggybankpro':'oinkoin','com.google.android.apps.maps':'google-maps',
 'com.google.android.apps.messaging':'messages','com.google.android.apps.photos':'photos','com.google.android.calendar':'calendar',
 'com.google.android.contacts':'contacts','com.google.android.deskclock':'clock','com.google.android.documentsui':'files',
 'com.google.android.gm':'gmail','com.killt.openbank':'openbank','com.killt.opendriver':'opendriver','com.killt.openfood':'openfood',
 'com.killt.opennavigation':'opennavigation','com.killt.opennote':'openrednote','com.killt.openphotoedit':'openphotoedit',
 'com.killt.openshop':'openshop','com.killt.opentrip':'opentrip','com.killt.opentwitter':'opentwitter',
 'me.zhanghai.android.files':'material-files','net.gsantner.markor':'markor','org.documentfoundation.libreoffice':'document-viewer',
 'org.fossify.calendar':'fossify-calendar','org.fossify.gallery':'fossify-gallery','org.fossify.math':'calculator',
 'org.tasks':'tasks-org','oss.krtirtho.spotube':'spotube'}
NATIVE_WEB={'com.killt.openbank','com.killt.openfood','com.killt.opennavigation','com.killt.opennote','com.killt.openshop','com.killt.opentrip','com.killt.opentwitter'}
def main():
 records=json.loads((IMAGE/'app-audit/applications.json').read_text(encoding='utf-8'));icons=json.loads((IMAGE/'launcher-icons/icons.json').read_text(encoding='utf-8'))
 profiles=json.loads((HOME/'tools/device-profiles.json').read_text(encoding='utf-8'));available=[];pending=[];audit=[]
 for record in records:
  package=record['package'];app_id=MAPPING.get(package);name=record['name'];label='TMoble' if package=='com.android.stk' else ('YT Music' if package=='com.google.android.apps.youtube.music' else name)
  matches=[i for i in icons if i['label']==label]
  if package=='org.fossify.calendar':matches=matches[1:]
  if not matches:raise RuntimeError('Original launcher icon missing: '+package)
  # Prefer a complete drawer row, rather than the bottom clipped row.
  artwork=matches[0];target=HOME/'static/images/app-icons/android'/f'{package}.png';target.parent.mkdir(parents=True,exist_ok=True)
  icon=Image.open(IMAGE/'launcher-icons'/artwork['file']).convert('RGBA').crop((10,10,166,166))
  mask=Image.new('L',icon.size);ImageDraw.Draw(mask).ellipse((0,0,155,155),fill=255);icon.putalpha(mask);icon.save(target);icon.close()
  entry={'id':app_id,'name':name,'package':package,'icon':target.relative_to(HOME).as_posix(),'description':'Android image application; browser implementation has a limited feature scope.'}
  mode='Partial browser reconstruction';gaps=['Native Android UI and operating-system integrations are not fully reproduced.']
  if package in NATIVE_WEB:
   source=IMAGE/'app-audit'/package/'assets/public';cache=IMAGE/'browser-clients-v3'/app_id
   shutil.copytree(source,cache,dirs_exist_ok=True);entry['url']=f'public/playground/apps/android/{app_id}/index.html'
   mode='Original Android APK WebView frontend, browser adapted';gaps=['Capacitor native services and external backend integrations require browser adapters.']
  if app_id:available.append(entry)
  else:pending.append({'name':name,'package':package,'icon':entry['icon'],'status':'not ported'});mode='Not implemented';gaps=['No browser implementation is provided.']
  audit.append({'id':app_id,'name':name,'package':package,'version':record['version'],'apk_sha256':record['sha256'],'mode':mode,'native_full_feature_parity':False,'known_gaps':gaps})
 profile={'verified':True,'source':'OS-Omni Android V3: installed APK and launcher inventory','display':{'width':411,'height':914,'physical_width':1080,'physical_height':2400,'density':420,'timezone':'Etc/UTC'},'applications':available,'pending':pending,'pinned':['messages','chrome','gmail','photos']}
 profiles['android']=profile;(HOME/'tools/device-profiles.json').write_text(json.dumps(profiles,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (HOME/'static/data/android-app-audit.json').write_text(json.dumps({'platform':'android','applications':audit,'installed_launchable_packages':len(records),'browser_implementations':len(available),'not_implemented':len(pending),'note':'Original APK assets do not imply full native feature parity.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Android:',len(available),'browser counterparts;',len(pending),'pending;',len(NATIVE_WEB),'original APK frontends')
if __name__=='__main__':main()
