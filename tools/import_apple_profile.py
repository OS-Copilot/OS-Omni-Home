"""Import original Apple image application inventories and extracted native artwork."""
from pathlib import Path
import json,shutil,argparse
HOME=Path(__file__).resolve().parents[1]
def main(platform):
 image=HOME.parent/(platform+'_img');rows=json.loads((image/'app-audit/applications.json').read_text(encoding='utf-8'));profiles=json.loads((HOME/'tools/device-profiles.json').read_text(encoding='utf-8'));available=[];pending=[];audit=[];seen=set()
 catalog=json.loads((HOME/'static/js/browser-apps.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'));ids={a['id'] for a in catalog}
 page_positions={}
 for row in rows:
  app_id=row.get('id')
  if platform=='ios' and not app_id and 'ios-'+row['name'].lower() in ids:app_id='ios-'+row['name'].lower()
  entry={'id':app_id,'name':row['name'],'bundle':row['bundle'],'description':platform+' image application; browser counterpart has a limited feature scope.'}
  if 'home_page' in row:
   entry['home_page']=row['home_page']
   entry['home_position']=page_positions.get(row['home_page'],0)
   page_positions[row['home_page']]=entry['home_position']+1
  if row.get('icon'):
   source=image/'app-audit/icons'/row['icon'];target=HOME/'static/images/app-icons'/platform/row['icon'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target);entry['icon']=target.relative_to(HOME).as_posix()
  elif platform=='ios' and app_id and app_id.startswith('ios-'):
   fallback=HOME/'static/images/app-icons/ios'/(row['bundle']+'.svg')
   if fallback.exists():entry['icon']=fallback.relative_to(HOME).as_posix()
  mode='Not implemented'
  if app_id in ids and app_id not in seen and entry.get('icon'):
   if platform=='ios' and app_id.startswith('ios-'):entry['url']='public/playground/apps/ios-system.html?app='+app_id[4:]
   original=image/'browser-clients-v3'/app_id/'index.html'
   if original.exists():entry['url']=f'public/playground/apps/{platform}/{app_id}/index.html';mode='Original '+platform+' application frontend, browser adapted'
   else:mode='Partial browser counterpart; native binary not ported'
   if app_id=='drawio' and original.exists():entry['url']+='?offline=1&pwa=0&mode=browser&stealth=1&gapi=0&db=0&gh=0&gl=0&od=0&lang=en'
   available.append(entry);seen.add(app_id)
  else:pending.append({'name':row['name'],'bundle':row['bundle'],'icon':entry.get('icon'),'status':'not ported' if app_id not in ids else 'native icon unavailable'})
  audit.append({'id':app_id,'name':row['name'],'bundle':row['bundle'],'mode':mode,'native_full_feature_parity':False,'source_icon':row.get('source_icon',None),'known_gaps':['Native operating-system services and advanced native features are not fully reproduced.']})
 display=json.loads((image/'app-audit/display.json').read_text(encoding='utf-8'))
 profiles[platform]={'verified':True,'source':'OS-Omni '+('iOS v3: installed bundles and SpringBoard inventory' if platform=='ios' else 'macOS v3: APFS application bundle inventory'),'display':display,'applications':available,'pending':pending,'pinned':(['safari','messages','maily','photos'] if platform=='ios' else ['files','safari','textedit','photos'])}
 (HOME/'tools/device-profiles.json').write_text(json.dumps(profiles,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 # Public audit contains provenance descriptions, not machine-local extraction paths.
 for row in audit:row.pop('source_icon',None)
 (HOME/'static/data'/f'{platform}-app-audit.json').write_text(json.dumps({'platform':platform,'applications':audit,'image_launcher_entries':len(rows),'browser_implementations':len(available),'not_implemented':len(pending),'note':'Original image resources do not imply native feature parity.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(platform,len(available),'browser counterparts;',len(pending),'pending')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('platform',choices=['ios','macos']);main(parser.parse_args().platform)
