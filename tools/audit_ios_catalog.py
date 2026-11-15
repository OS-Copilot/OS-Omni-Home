"""Verify iOS bundle and SpringBoard counts independently of browser availability."""
from pathlib import Path
import json,plistlib,sqlite3,argparse
HOME=Path(__file__).resolve().parents[1]
def verify(image,browser_results=None,functional_results=()):
 device=next((image/'extracted').glob('*/device.plist'));data=device.parent/'data';bundles=[]
 for info in (data/'Containers/Bundle/Application').glob('*/*.app/Info.plist'):
  record=plistlib.loads(info.read_bytes());bundles.append({'bundle':record['CFBundleIdentifier'],'name':record.get('CFBundleDisplayName') or record.get('CFBundleName')})
 state=plistlib.loads((data/'Library/SpringBoard/IconState.plist').read_bytes());home=[]
 def walk(items):
  for item in items:
   if isinstance(item,str):home.append(item)
   elif isinstance(item,list):walk(item)
   elif isinstance(item,dict) and 'iconLists' in item:walk(item['iconLists'])
 walk(state['iconLists']);walk(state['buttonBar']);home=list(dict.fromkeys(home))
 with sqlite3.connect((data/'Library/FrontBoard/applicationState.db').resolve().as_uri()+'?mode=ro',uri=True) as connection:
  removed=[row[0] for row in connection.execute("select a.application_identifier from kvs join application_identifier_tab a on a.id=kvs.application_identifier join key_tab k on k.id=kvs.key where k.key='__UninstallDate'")]
 profile=json.loads((HOME/'tools/device-profiles.json').read_text(encoding='utf-8'))['ios'];available={row['bundle'] for row in profile['applications']};pending={row['bundle'] for row in profile['pending']};active={row['bundle'] for row in bundles}
 if available&pending or available|pending!=set(home):raise RuntimeError('Browser profile does not cover the image launcher inventory exactly')
 if not active.issubset(available):raise RuntimeError('Active third-party bundle missing from available browser profile')
 if available&set(removed):raise RuntimeError('Historical uninstalled application incorrectly exposed')
 report={'count_scope':'Active third-party app bundles and unique SpringBoard home/dock launchers. The simulator archive does not include its separate runtime SDK or full built-in app binaries.','active_third_party_bundles':len(active),'home_and_dock_launchers':len(home),'browser_implementations':len(available),'pending_launchers':len(pending),'third_party':bundles,'home_bundles':home,'historical_uninstalled_bundles':removed,'pending':profile['pending'],'verified':True,'paper_task_app_presence':{'QuickShop':'No active bundle or launcher under this name; image contains OpenShop','Daybreak':'No active bundle or launcher in this image'}}
 local=image/'app-audit/count-verification.json';local.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 audit_path=HOME/'static/data/ios-app-audit.json';audit=json.loads(audit_path.read_text(encoding='utf-8'));audit['inventory_verification']=report
 if browser_results:
  metrics={row['id']:row for row in json.loads(browser_results.read_text(encoding='utf-8'))}
  for entry in audit['applications']:
   if entry.get('id') in metrics:
    row=metrics[entry['id']];entry['viewport_check']={'logical_width':row['viewport'],'document_width':row['width'],'horizontal_overflow':row['width']>row['viewport']};entry['browser_document_title']=row['title']
 workflows={}
 for result_path in functional_results:workflows.update(json.loads(result_path.read_text(encoding='utf-8')))
 if workflows:
  for entry in audit['applications']:
   if entry.get('id') in workflows:entry['verified_workflows']=workflows[entry['id']];entry['core_function_check']='passed'
  audit['quality_verification']={'browser_apps_with_tested_workflows':len(workflows),'native_full_feature_parity':False,'note':'Only the listed workflows were tested. This is not a claim of complete native app parity.'}
 audit_path.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(f"Verified {len(active)} third-party bundles, {len(home)} launcher entries, {len(available)} available, {len(pending)} pending")
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--image',type=Path,default=HOME.parent/'ios_img');parser.add_argument('--browser-results',type=Path);parser.add_argument('--functional-results',type=Path,nargs='*',default=[]);args=parser.parse_args();verify(args.image,args.browser_results,args.functional_results)
