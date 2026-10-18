# Copyright (c) 2026 Titans Forge LLC; see LICENSE.
"""Verify the preserved historical release and the current product inventory.

Default mode compares pinned hashes and never rewrites them. --write-manifest is
an explicit maintenance operation after intentional candidate edits.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / 'baselines/published-beta-v2'
UPGRADE = ROOT / 'UPGRADE_MANIFEST.json'
BASE_COMMIT = '1c16a334772732ee4360d1d63d2b3ae62a69a55e'
# Independently pinned from the original recovery commit; these files stay unchanged.
ORIGINAL_HASHES = {
    'SOURCE_SNAPSHOT.json': '3190d5fbfa3d238d8136c01af6f5fc1b47e2ab83bcfe1e978f1b2520957c66cd',
    'release-manifest.json': 'e61f73efeff83f23aae3978f10463307f75b948cf4cc12006cc281c56212494a',
    'scripts/check-release.py': '5b2c5b2fe4e3996124d2913d2c3271d708f6761f6b76ee68430aa66302927c64',
    'LICENSE': '01c53180ca78bee80411c2d07e436014b62f7e48dd37de70c2fed72238ee57dc',
}
FROZEN_SOURCES = {
    'FORGE-LICENSING.html', 'app.js', 'game-data.mjs', 'index.html',
    'investigation.mjs', 'investigation_cases.mjs', 'investigation_history.mjs',
    'investigation_journal.mjs', 'investigation_learning_view.mjs',
    'investigation_transfer.mjs', 'investigation_view.mjs', 'offline_api.mjs',
    'offline_engine.mjs', 'practice_history.mjs', 'review_queue.mjs',
    'styles.css', 'transfer_practice.mjs',
}
# This licensing page was added after the original ZIP and is not in its manifest.
BASELINE_EXTRA_HASHES = {
    'FORGE-LICENSING.html': 'd368492517c398a02ab9f3d87e82c8a33b9434e7b116df09c2e9d630fa20cd2e',
}
SOURCE_SUFFIXES = {'.js', '.mjs', '.html', '.css'}
IMPORTS = re.compile(r'''\b(?:from\s*|import\s*\(\s*|import\s+|loadModule\s*\(\s*)["']([^"']+)["']''')
CSS_URLS = re.compile(r'''url\(\s*["']?([^\s)'";]+)''')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_file(base, name):
    relative = PurePosixPath(name)
    require(isinstance(name, str) and not relative.is_absolute()
            and '..' not in relative.parts and relative.parts, f'Unsafe file path: {name!r}')
    path = base.joinpath(*relative.parts)
    require(not path.is_symlink() and path.is_file(), f'Missing or symlinked file: {path.relative_to(ROOT)}')
    require(path.resolve().is_relative_to(ROOT), f'File escapes candidate: {name}')
    return path


def descriptor(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def verify_record(path, expected, name):
    require(isinstance(expected, dict)
            and isinstance(expected.get('bytes'), int) and expected['bytes'] >= 0
            and isinstance(expected.get('sha256'), str)
            and re.fullmatch(r'[0-9a-f]{64}', expected['sha256']), f'Invalid descriptor: {name}')
    actual = descriptor(path)
    require(actual == {key: expected[key] for key in ['bytes', 'sha256']}, f'Hash/size mismatch: {name}')


def verify_original():
    for name, digest in ORIGINAL_HASHES.items():
        require(descriptor(safe_file(ROOT, name))['sha256'] == digest, f'Historical file changed: {name}')
    snapshot = json.loads((ROOT / 'SOURCE_SNAPSHOT.json').read_text())
    release = json.loads((ROOT / 'release-manifest.json').read_text())
    baseline = json.loads(safe_file(BASELINE, 'BASELINE.json').read_text())
    require(baseline.get('schema') == 'medical_mysteries_published_beta_baseline_v1'
            and baseline.get('source_commit') == BASE_COMMIT, 'Wrong baseline provenance')
    require(set(baseline.get('files', {})) == FROZEN_SOURCES, 'Frozen baseline inventory differs')
    actual_sources = {path.name for path in BASELINE.iterdir() if path.suffix in SOURCE_SUFFIXES}
    require(actual_sources == FROZEN_SOURCES, 'Missing or unexpected frozen source copy')
    for name, record in baseline['files'].items():
        verify_record(safe_file(BASELINE, name), record, f'baseline/{name}')
    require(release.get('human_review_claimed') is False, 'Historical human-review claim changed')
    records = snapshot['runtime_files']
    names = [record['path'] for record in records]
    require(len(names) == len(set(names)), 'Duplicate snapshot paths')
    require(set(names) == set(release['files']) | {'release-manifest.json'}, 'Historical manifests disagree on inventory')
    for record in records:
        name = record['path']
        # A required frozen source never falls back to the modified candidate root.
        location = BASELINE if name in FROZEN_SOURCES or name == 'CREDITS.txt' else ROOT
        verify_record(safe_file(location, name), record, f'original/{name}')
    for name, record in release['files'].items():
        location = BASELINE if name in FROZEN_SOURCES or name == 'CREDITS.txt' else ROOT
        verify_record(safe_file(location, name), record, f'original release/{name}')
    verify_record(safe_file(ROOT, 'game-data.mjs'), baseline['files']['game-data.mjs'], 'unchanged current story bank')
    for name, digest in BASELINE_EXTRA_HASHES.items():
        require(descriptor(safe_file(BASELINE, name))['sha256'] == digest, f'Historical licensing page changed: {name}')
    return snapshot, baseline, len(records)


def current_runtime_paths():
    paths = {path.relative_to(ROOT).as_posix() for path in ROOT.iterdir()
             if path.is_file() and path.suffix in SOURCE_SUFFIXES}
    paths.update(path.relative_to(ROOT).as_posix() for path in (ROOT / 'assets').rglob('*') if path.is_file())
    paths.add('CREDITS.txt')
    return paths


def support_paths():
    paths = {
        'README.md', 'package.json', '.github/workflows/check.yml',
        'SOURCE_SNAPSHOT.json', 'release-manifest.json', 'LICENSE',
        'LICENSING.md', 'LICENSE-LEGACY-PRE-FORGE-2.0.txt',
        'LICENSE_ADOPTION_SOURCE.json', 'LICENSING_CHECKPOINT.json', 'MEDIA_RIGHTS.md', 'RELEASE-0.7.0.md', 'RELEASE-0.9.0.md', 'RELEASE-1.0.0.md',
    }
    paths.update(path.relative_to(ROOT).as_posix() for path in (ROOT / 'scripts').rglob('*')
                 if path.is_file() and path.suffix in {'.py', '.mjs', '.json', '.sh'})
    paths.update(path.relative_to(ROOT).as_posix() for path in BASELINE.rglob('*') if path.is_file())
    paths.update(path.relative_to(ROOT).as_posix() for path in (ROOT / 'docs').rglob('*') if path.is_file())
    paths.update(path.relative_to(ROOT).as_posix() for path in (ROOT / 'ios').rglob('*')
                 if path.is_file() and not set(path.relative_to(ROOT / 'ios').parts) & {'Game', 'build', 'xcuserdata'}
                 and path.suffix in {'.swift', '.plist', '.xcprivacy', '.pbxproj', '.xcscheme', '.png', '.json'})
    return paths


def local_reference(containing, specifier, covered, module=False):
    parsed = urlsplit(specifier)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return
    if module:
        require(specifier.startswith(('./', '../')), f'Unresolved module specifier in {containing.name}: {specifier}')
    target = (containing.parent / unquote(parsed.path)).resolve()
    require(target.is_relative_to(ROOT), f'Reference escapes candidate: {specifier}')
    name = target.relative_to(ROOT).as_posix()
    safe_file(ROOT, name)
    require(name in covered, f'Unmanifested reference in {containing.name}: {specifier}')


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for key in ['src', 'href']:
            if values.get(key):
                self.values.append(values[key])


def verify_syntax_and_references(runtime, support):
    covered = runtime | support
    modules = sorted(name for name in runtime | support if Path(name).suffix in {'.js', '.mjs'}
                     and not name.startswith('baselines/'))
    for name in modules:
        path = safe_file(ROOT, name)
        checked = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
        require(checked.returncode == 0, f'JavaScript syntax error in {name}: {checked.stderr.strip()}')
        for specifier in IMPORTS.findall(path.read_text()):
            local_reference(path, specifier, covered, module=True)
    for name in runtime:
        path = safe_file(ROOT, name)
        if path.suffix == '.html':
            parser = References()
            parser.feed(path.read_text())
            for reference in parser.values:
                local_reference(path, reference, covered)
        elif path.suffix == '.css':
            for reference in CSS_URLS.findall(path.read_text()):
                local_reference(path, reference, covered)
    return len(modules)


def manifest_data(snapshot, baseline, runtime, support):
    original = {record['path']: record for record in snapshot['runtime_files']}
    original.update(baseline['files'])
    runtime_files = {name: descriptor(safe_file(ROOT, name)) for name in sorted(runtime)}
    return {
        'schema': 'medical_mysteries_upgrade_manifest_v1',
        'game': 'Medical Mysteries',
        'version': '1.0.0',
        'status': 'release_artifact',
        'published': False,
        'human_review_claimed': True,
        'clinical_review_status': 'completed_creator_confirmed',
        'clinical_review_provenance': {
            'attestation_source': 'creator_direct_confirmation',
            'confirmation_date': '2026-10-18',
            'reviewer_name': None,
            'review_date': None,
            'reviewed_artifact': None,
            'statement': 'Clinician review completed, as confirmed by the creator.',
        },
        'clinical_use': False,
        'generated_utc': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
        'baseline': {
            'source_commit': BASE_COMMIT,
            'frozen_source_directory': 'baselines/published-beta-v2',
            'original_file_hashes': ORIGINAL_HASHES,
            'original_zip_sha256': snapshot['selected_source_sha256'],
            'authoring_workspace_recovered': False,
        },
        'changed_runtime_files': sorted(name for name in runtime if name in original and runtime_files[name]['sha256'] != original[name]['sha256']),
        'added_runtime_files': sorted(runtime - set(original)),
        'runtime_files': runtime_files,
        'support_files': {name: descriptor(safe_file(ROOT, name)) for name in sorted(support)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-manifest', action='store_true', help='Explicitly refresh candidate hashes after intentional edits')
    arguments = parser.parse_args()
    snapshot, baseline, original_count = verify_original()
    package = json.loads((ROOT / 'package.json').read_text())
    require(package.get('version') == '1.0.0' and package.get('type') == 'module', 'Wrong candidate package version/type')
    runtime = current_runtime_paths()
    support = support_paths()
    module_count = verify_syntax_and_references(runtime, support)
    expected = manifest_data(snapshot, baseline, runtime, support)
    if arguments.write_manifest:
        UPGRADE.write_text(json.dumps(expected, indent=2) + '\n')
        print('Wrote UPGRADE_MANIFEST.json after baseline, syntax and reference checks. Run npm test to verify behavior.')
        return
    require(UPGRADE.is_file() and not UPGRADE.is_symlink(), 'Missing UPGRADE_MANIFEST.json; an intentional refresh is required')
    actual = json.loads(UPGRADE.read_text())
    require(set(actual) == set(expected), 'Candidate manifest fields differ')
    require(isinstance(actual['generated_utc'], str), 'Missing candidate generation timestamp')
    expected['generated_utc'] = actual['generated_utc']
    require(actual == expected, 'Candidate manifest is stale or altered; inspect changes before an intentional refresh')
    print(f'Verified {original_count} preserved beta members, {len(runtime)} candidate runtime files, '
          f'{len(support)} support files and {module_count} module syntax/reference checks. '
          'Release inventory checked; publication is recorded separately.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f'Upgrade verification failed: {error}', file=sys.stderr)
        sys.exit(1)
