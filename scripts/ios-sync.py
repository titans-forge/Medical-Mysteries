#!/usr/bin/env python3
"""Stage exactly the current verified runtime and public license files for iOS."""
from pathlib import Path
import hashlib, json, shutil, subprocess
ROOT = Path(__file__).resolve().parents[1]
subprocess.run(['python3', 'scripts/check-upgrade.py'], cwd=ROOT, check=True)
manifest = json.loads((ROOT / 'UPGRADE_MANIFEST.json').read_text())
files = set(manifest['runtime_files']) | {'LICENSE','LICENSING.md','LICENSE-LEGACY-PRE-FORGE-2.0.txt','LICENSE_ADOPTION_SOURCE.json','LICENSING_CHECKPOINT.json','MEDIA_RIGHTS.md'}
destination = ROOT / 'ios/Game'
if destination.is_symlink(): raise ValueError('Native staging directory cannot be a symlink')
if destination.exists(): shutil.rmtree(destination)
records = {}
for name in sorted(files):
 source = ROOT / name
 if source.is_symlink() or not source.resolve().is_relative_to(ROOT): raise ValueError('Unsafe bundled path')
 target = destination / name; target.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(source,target)
 records[name] = {'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
(destination / 'BUNDLE_MANIFEST.json').write_text(json.dumps({'version':'1.0.0','files':records},indent=2)+'\n')
print(f'Staged {len(records)} local files, including all cases, media and licenses. No remote game URL.')
