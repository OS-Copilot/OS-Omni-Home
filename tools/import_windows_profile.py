"""Import the Windows v3.1 shortcut/Start menu audit and native icon assets."""
from pathlib import Path
import json,shutil
HOME=Path(__file__).resolve().parents[1];IMAGE=HOME.parent/'windows_img'
MAPPING={'Actual Budget':'actual-budget','Actual':'actual-budget','Blender 2.79b':'blender','DeltaChat':'deltachat','draw.io':'drawio','GIMP 2.10.38':'gimp','Google Chrome':'chrome','LibreOffice 26.2':'libreoffice','LibreOffice':'libreoffice','Marble':'marble','Microsoft Edge':'edge','OpenBank':'openbank','OpenDriver':'opendriver','OpenFood':'openfood','OpenNavigation':'opennavigation','OpenNote':'openrednote','OpenPhotoEdit':'openphotoedit','OpenShop':'openshop','OpenTrip':'opentrip','OpenTwitter':'opentwitter','Spotube':'spotube','Thunderbird':'thunderbird','Visual Studio Code':'vscode','VLC media player':'vlc','Wireshark':'wireshark','Zotero':'zotero','LibreOffice Calc':'libreoffice-calc','LibreOffice Draw':'libreoffice-draw','LibreOffice Impress':'libreoffice-impress','LibreOffice Writer':'libreoffice-writer','Calculator':'calculator','Clock':'clock','File Explorer':'files','Media Player':'media-player','Windows Media Player Legacy':'windows-media-player','Microsoft To Do':'to-do','Notepad':'notepad','Outlook':'outlook','Paint':'paint','Photos':'photos','Settings':'settings','Sticky Notes':'sticky-notes','Terminal':'terminal','Command Prompt':'command-prompt','Windows PowerShell':'powershell'}
WEB={'OpenBank','OpenDriver','OpenFood','OpenNavigation','OpenNote','OpenShop','OpenTrip','OpenTwitter'}
def main():
 rows=json.loads((IMAGE/'app-audit/applications.json').read_text(encoding='utf-8-sig'));display=json.loads((IMAGE/'app-audit/display.json').read_text(encoding='utf-8-sig'))
 profiles=json.loads((HOME/'tools/device-profiles.json').read_text(encoding='utf-8'));available=[];pending=[];audit=[];seen=set()
 for row in rows:
  app_id=MAPPING.get(row['name']);entry={'id':app_id,'name':row['name'],'launcher_id':row['id'],'desktop':'\\Desktop\\' in row.get('shortcut',''),'description':'Windows image application; browser counterpart has a limited feature scope.'};mode='Not implemented'
  if row.get('icon'):
   target=HOME/'static/images/app-icons/windows'/row['icon'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(IMAGE/'app-audit/icons'/row['icon'],target);entry['icon']=target.relative_to(HOME).as_posix()
  if app_id and app_id not in seen and row.get('exists'):
   if not entry.get('icon'):raise RuntimeError('Native icon missing: '+row['name'])
   if row['name'] in WEB:
    if not (IMAGE/'browser-clients-v31'/app_id/'index.html').exists():raise RuntimeError('Original frontend missing: '+row['name'])
    entry['url']=f'public/playground/apps/windows/{app_id}/index.html';mode='Original Windows Electron frontend, browser adapted'
   else:mode='Partial browser counterpart; native implementation not ported'
   available.append(entry);seen.add(app_id)
  elif app_id in seen:mode='Duplicate launcher for '+app_id
  else:pending.append({'name':row['name'],'launcher_id':row['id'],'status':'not ported' if row.get('exists') else 'image target missing'})
  audit.append({'id':app_id,'name':row['name'],'launcher_id':row['id'],'native_target_exists':row.get('exists'),'mode':mode,'native_full_feature_parity':False,'known_gaps':['Native filesystem, OS services and advanced native features are not fully reproduced.'] if app_id else ['No browser implementation is provided.']})
 profiles['windows']={'verified':True,'source':'OS-Omni Windows v3.1: native shortcuts and Start menu inventory','display':{'width':1920,'height':1080,'source_execution_width':display['width'],'source_execution_height':display['height'],'timezone':'America/Los_Angeles'},'applications':available,'pending':pending,'pinned':['files','edge','chrome','notepad']}
 (HOME/'tools/device-profiles.json').write_text(json.dumps(profiles,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (HOME/'static/data/windows-app-audit.json').write_text(json.dumps({'platform':'windows','launcher_entries_inspected':len(rows),'browser_implementations':len(available),'not_implemented_or_broken':len(pending),'applications':audit,'note':'Original Electron frontend reuse does not imply native feature parity.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Windows:',len(rows),'launch entries;',len(available),'browser counterparts;',len(pending),'pending')
if __name__=='__main__':main()
