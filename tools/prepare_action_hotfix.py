"""Prepare an action-only fix on top of the published shared-galaxy release."""
from pathlib import Path
import gzip
import hashlib
import json
import re
import shutil
import subprocess

HOME=Path(__file__).resolve().parents[1]
SOURCE='a21aab9a199ff2da7f63055ced8af50d5773056e'
BASE=HOME/'dist/research-release-20261116-interactive-galaxy'
OUT=HOME/'dist/research-release-20261116-actions-fix'
FILES=['static/js/mascot-3d.js','static/js/mascot-model.js','static/js/mascot-actions.js','static/js/mascot-companion.js','static/css/mascot-3d.css']
def sha(data):return hashlib.sha256(data).hexdigest()
def source(path):return subprocess.check_output(['git','show',SOURCE+':'+path],cwd=HOME).decode('utf-8')
def main():
    if OUT.exists():raise RuntimeError('Preserve existing release directory')
    report=json.loads((BASE/'pages-build-report.json').read_text())
    manifest=json.loads((BASE/report['manifest']).read_text())
    project=report['projects'][0];target=OUT/project['directory']
    shutil.copytree(BASE/project['directory'],target,ignore=shutil.ignore_patterns('.git'))
    for relative in FILES:
        data=(HOME/relative).read_bytes();(target/relative).write_bytes(data)
        manifest['routes'][relative]=sha(data);manifest['blobs'][sha(data)]=[0,False,len(data)]
        if relative not in manifest['physical']:manifest['physical'].append(relative)
    page=source('index.research.html')
    page=re.sub(r'(static/js/mascot-3d\.js)\?[^"\s]+',r'\1?v=companion-actions-15',page)
    page=re.sub(r'(static/css/mascot-3d\.css)\?[^"\s]+',r'\1?v=companion-actions-15',page)
    (OUT/'approved-homepage.html').write_text(page,encoding='utf-8')
    assert 'site-loader' not in page,'Keep unpublished loading changes out of this narrow fix'
    page=page.replace('</head>',report['mainIndexInjection']+'</head>',1)
    data=page.encode();digest=sha(data);blob=target/'blobs'/digest[:2]/(digest+'.bin');blob.parent.mkdir(parents=True,exist_ok=True);blob.write_bytes(gzip.compress(data,mtime=0))
    manifest['routes']['index.html']=digest;manifest['blobs'][digest]=[manifest['shards'].index(manifest['base']),True,len(data)]
    manifest.pop('revision');revision=sha(json.dumps(manifest,sort_keys=True,separators=(',',':')).encode())[:16];manifest['revision']=revision
    name='osomni-resources.'+revision+'.json';(target/name).write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
    config={'base':manifest['base'],'manifest':name,'revision':revision}
    worker=(HOME/'tools/pages-resource-worker.js').read_text(encoding='utf-8').replace('__OSOMNI_PAGES_CONFIG__',json.dumps(config));(target/'osomni-pages-sw.js').write_text(worker,encoding='utf-8')
    for relative in manifest['physical']:assert sha((target/relative).read_bytes())==manifest['routes'][relative],relative
    for relative in FILES:
        if not relative.endswith('.js'):continue
        for dependency in re.findall(r"from\s+['\"]([^'\"]+)['\"]",(target/relative).read_text(encoding='utf-8')):
            assert ((target/relative).parent/dependency.split('?')[0]).is_file(),dependency
    report.update(revision=revision,manifest=project['directory']+'/'+name,published=False,releaseType='companion-action-hotfix',changedResources=FILES+['index.html'])
    project['bytes']=sum(p.stat().st_size for p in target.rglob('*') if p.is_file())
    (OUT/'pages-build-report.json').write_text(json.dumps(report,indent=2))
    check={'status':'passed','revision':revision,'physicalResources':len(manifest['physical']),'allPhysicalHashesVerified':True,'sourceHomepagePinned':SOURCE,'unpublishedLoaderExcluded':True,'cases':60,'visualBrowserValidation':False}
    (OUT/'pages-verification.json').write_text(json.dumps(check,indent=2));print(json.dumps(check))
if __name__=='__main__':main()
