"""Overlay the approved theme onto the existing immutable Pages resource release."""
from pathlib import Path
import gzip
import hashlib
import json
import re
import shutil

HOME = Path(__file__).resolve().parents[1]
OLD = HOME / 'dist/pages-ready'
OUT = HOME / 'dist/research-release-20261116-v2'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    if OUT.exists():
        raise RuntimeError('Release directory already exists; preserve it')
    report = json.loads((OLD / 'pages-build-report.json').read_text())
    manifest = json.loads((OLD / report['manifest']).read_text())
    project = report['projects'][0]
    target = OUT / project['directory']
    shutil.copytree(OLD / project['directory'], target, ignore=shutil.ignore_patterns('.git'))
    changed = []
    for folder in ('static/css', 'static/js'):
        for source in (HOME / folder).glob('*'):
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
