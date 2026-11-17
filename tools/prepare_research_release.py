"""Overlay the approved theme onto the existing immutable Pages resource release."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import re
import shutil

HOME = Path(__file__).resolve().parents[1]
OLD = HOME / 'dist/pages-ready'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=HOME/'dist/research-release-20261116-companion')
    args=parser.parse_args()
    OUT=args.output.resolve()
    if not OUT.is_relative_to((HOME/'dist').resolve()):
        raise RuntimeError('Release output must stay beneath this website dist directory')
    if OUT.exists():
        raise RuntimeError('Release directory already exists; preserve it')
    report = json.loads((OLD / 'pages-build-report.json').read_text())
    manifest = json.loads((OLD / report['manifest']).read_text())
    project = report['projects'][0]
    target = OUT / project['directory']
    shutil.copytree(OLD / project['directory'], target, ignore=shutil.ignore_patterns('.git'))
    # A still-active previous worker must be able to load its homepage while
    # the new worker installs. Retain immutable old indexes and local blobs.
    for previous in sorted((HOME/'dist').glob('research-release-*')):
        prior_report=previous/'pages-build-report.json'
        published=previous/'official-deployment.json'
        if previous.resolve()==OUT or not prior_report.is_file() or not published.is_file():
            continue
        state=json.loads(published.read_text(encoding='utf-8'))
        if not state.get('homepageBranchPushed'):
            continue
        prior=json.loads(prior_report.read_text(encoding='utf-8'))
        previous_main=previous/prior['projects'][0]['directory']
        for index in previous_main.glob('osomni-resources.*.json'):
            destination=target/index.name
            if not destination.exists():shutil.copy2(index,destination)
        if (previous_main/'blobs').exists():
            shutil.copytree(previous_main/'blobs',target/'blobs',dirs_exist_ok=True)
    changed = []
    for folder in ('static/css', 'static/js'):
        for source in (HOME / folder).rglob('*'):
            if not source.is_file():
                continue
            relative = source.relative_to(HOME).as_posix()
            dest = target / relative
            data = source.read_bytes()
            if dest.exists() and dest.read_bytes() == data:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            manifest['routes'][relative] = digest(data)
            manifest['blobs'][digest(data)] = [0, False, len(data)]
            if relative not in manifest['physical']:
                manifest['physical'].append(relative)
            changed.append(relative)
    for relative in ('index.research.light.saved.html', 'index.mint.saved.html', 'index.charcoal.saved.html', 'index.classic.html'):
        data = (HOME / relative).read_bytes()
        (target / relative).write_bytes(data)
        manifest['routes'][relative] = digest(data)
        manifest['blobs'][digest(data)] = [0, False, len(data)]
        manifest['physical'].append(relative)
    page = (HOME / 'index.research.html').read_text(encoding='utf-8')
    page = page.replace('</head>', report['mainIndexInjection'] + '</head>', 1)
    data = page.encode('utf-8')
    sha = digest(data)
    blob = target / 'blobs' / sha[:2] / (sha + '.bin')
    blob.parent.mkdir(parents=True, exist_ok=True)
    blob.write_bytes(gzip.compress(data, mtime=0))
    manifest['shards'].append(manifest['base'])
    manifest['routes']['index.html'] = sha
    manifest['blobs'][sha] = [len(manifest['shards']) - 1, True, len(data)]
    manifest.pop('revision')
    revision = digest(json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode())[:16]
    manifest['revision'] = revision
    name = 'osomni-resources.' + revision + '.json'
    (target / name).write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
    config = dict(base=manifest['base'], manifest=name, revision=revision)
    worker = (HOME / 'tools/pages-resource-worker.js').read_text(encoding='utf-8')
    (target / 'osomni-pages-sw.js').write_text(worker.replace('__OSOMNI_PAGES_CONFIG__', json.dumps(config)), encoding='utf-8')
    # Check every physical resource and each local link in the approved page.
    for relative in manifest['physical']:
        assert digest((target / relative).read_bytes()) == manifest['routes'][relative], relative
    for ref in re.findall(r'(?:src|href)=["\']([^"\']+)', page):
        ref = ref.split('?')[0].split('#')[0]
        if not ref or ':' in ref or ref.startswith('//'):
            continue
        relative = ref.removeprefix(manifest['base']).lstrip('/')
        assert relative in manifest['routes'] or (target / relative).is_file(), relative
    assert gzip.decompress(blob.read_bytes()) == data
    assert 'research-dark.css?v=20261116-3' in page
    assert 'mascot-3d.js?v=companion-8' in page
    # Modules must resolve on Pages, including the locally vendored renderer.
    for relative in ['static/js/mascot-3d.js','static/js/mascot-model.js','static/js/mascot-platforms.js',
                     'static/js/mascot-orbit.js','static/js/mascot-companion.js']:
        text=(target/relative).read_text(encoding='utf-8')
        for imported in re.findall(r"from\s+['\"]([^'\"]+)['\"]",text):
            assert imported.startswith('./'), imported
            dependency=((target/relative).parent/imported.split('?')[0]).resolve()
            assert dependency.is_relative_to(target.resolve()) and dependency.is_file(),imported
    assert len(json.loads((target / 'static/data/case-studies.json').read_text())['cases']) == 60
    assert manifest['shards'][:5] == json.loads((OLD / report['manifest']).read_text())['shards']
    project['bytes'] = sum(p.stat().st_size for p in target.rglob('*') if p.is_file())
    report.update(revision=revision, manifest=project['directory'] + '/' + name,
                  published=False, changedResources=changed + ['index.html'],
                  releaseOverlay=True, sourceHomepage='index.research.html')
    (OUT / 'pages-build-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    verification = dict(status='passed', revision=revision, physicalResources=len(manifest['physical']),
                        allPhysicalHashesVerified=True, homepageLinksVerified=True,
                        immutableResourceCommitsPreserved=True, cases=60, visualBrowserValidation=False)
    (OUT / 'pages-verification.json').write_text(json.dumps(verification, indent=2))
    print(json.dumps(dict(directory=str(OUT), revision=revision, changed=changed, verification=verification), indent=2))

if __name__ == '__main__':
    main()
