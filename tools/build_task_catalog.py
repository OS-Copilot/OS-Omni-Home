"""Export public task briefs from the authoritative release manifest."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import yaml

HOME = Path(__file__).resolve().parents[1]
ALIASES = {
    'deltachat': 'Delta Chat', 'delta chat': 'Delta Chat',
    'libreoffice_writer': 'LibreOffice Writer', 'libreoffice_calc': 'LibreOffice Calc',
    'libreoffice_impress': 'LibreOffice Impress', 'thunderbird_calendar': 'Thunderbird Calendar',
    'thunderbird_mail': 'Thunderbird', 'thunderbird mail': 'Thunderbird',
    'vscode': 'Visual Studio Code', 'actual-budget': 'Actual Budget',
    'apple-maps': 'Maps', 'apple-photos': 'Photos', 'openphoto edit': 'OpenPhotoEdit',
    'opennavigation webpage': 'OpenNavigation', 'draw.io': 'draw.io',
    'actual_budget': 'Actual Budget', 'drawio': 'draw.io', 'textedit': 'TextEdit',
    'vscodium': 'VSCodium', 'libreoffice-calc': 'LibreOffice Calc',
    'libreoffice-impress': 'LibreOffice Impress', 'libreoffice-writer': 'LibreOffice Writer',
}
NAMES = ['OpenBank', 'OpenShop', 'OpenTrip', 'OpenDriver', 'OpenFood', 'OpenNote',
         'OpenTwitter', 'OpenPhotoEdit', 'OpenNavigation', 'OpenBlender', 'OpenCode',
         'OpenDoc', 'OpenFinance', 'OpenMail', 'OpenSheet', 'OpenSlide', 'OpenWireshark',
         'OpenZotero', 'Blender', 'GIMP', 'Thunderbird', 'Zotero', 'Marble', 'Safari',
         'Calendar', 'Contacts', 'Flow', 'FSNotes', 'Habit', 'Reminders', 'Maily',
         'Notepad', 'Notepadqq', 'Rhythmbox', 'Markor', 'Tasks', 'Spotube', 'Wireshark']
ALIASES.update({name.lower(): name for name in NAMES})

def app_name(value):
    key = str(value).strip().lower()
    key = re.sub(r'(?:_qa\d+|\d+)$', '', key)
    return ALIASES.get(key, str(value).strip().replace('_', ' '))

def export(source):
    manifest_path = source / 'tasks/v1/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    rows = []
    for entry in manifest['tasks']:
        path = source / entry['task_path']
        task = yaml.safe_load(path.read_text(encoding='utf-8'))
        if task['task_id'] != entry['task_id']:
            raise ValueError(f'Task ID mismatch: {entry["task_path"]}')
        metadata = task.get('metadata') or {}
        raw_apps = metadata.get('app_name') or metadata.get('app') or metadata.get('apps')
        if entry['track'] == 'cross_device':
            raw_apps = ['Markor'] + [name for name in ['LibreOffice Calc', 'LibreOffice Writer', 'LibreOffice Impress', 'Calendar', 'Tasks'] if re.search(r'\b' + re.escape(name) + r'\b', task['instruction'])]
        if not raw_apps:
            raw_apps = task['task_id'].split('.')[1]
            if raw_apps == 'libreoffice' and len(task['task_id'].split('.')) > 2:
                raw_apps = 'libreoffice_' + task['task_id'].split('.')[2]
        parts = raw_apps if isinstance(raw_apps, list) else re.split(r'\s*\+\s*', raw_apps)
        workflow_apps = list(dict.fromkeys(app_name(value) for value in parts))
        apps = sorted(workflow_apps)
        rows.append({
            'id': task['task_id'], 'track': entry['track'], 'platform': task['platform'],
            'category': entry['category'],
            'apps': apps, 'difficulty': str(metadata.get('difficulty') or 'unspecified'),
            'workflowApps': workflow_apps,
            'description': str(metadata.get('description') or ''),
            'instruction': str(task['instruction']), 'path': entry['task_path'],
            'maxSteps': (task.get('limits') or {}).get('max_steps'),
        })
    counts = dict(Counter(row['track'] for row in rows))
    if len(rows) != manifest['task_count'] or counts != manifest['track_counts']:
        raise ValueError('Manifest task counts do not match exported tasks')
    if len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Duplicate task IDs')
    output = HOME / 'static/data/task-catalog.json'
    output.write_text(json.dumps({'release': manifest['release'], 'counts': counts, 'tasks': rows}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'tasks': len(rows), 'tracks': counts, 'output': str(output)}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=HOME.parent / '111')
    export(parser.parse_args().source)
