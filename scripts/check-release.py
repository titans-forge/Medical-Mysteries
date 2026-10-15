# Copyright (c) 2026 Titans Forge LLC; see LICENSE.
"""Static packaging/syntax checks, not recovered original tests or clinical validation."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
snapshot = json.loads((root / "SOURCE_SNAPSHOT.json").read_text())
manifest = json.loads((root / "release-manifest.json").read_text())
assert manifest["human_review_claimed"] is False
for record in snapshot["runtime_files"]:
    path = root / record["path"]
    assert not path.is_symlink() and path.is_file(), record["path"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == record["sha256"], record["path"]
for name, record in manifest["files"].items():
    data = (root / name).read_bytes()
    assert len(data) == record["bytes"] and hashlib.sha256(data).hexdigest() == record["sha256"], name
modules = sorted(list(root.glob("*.js")) + list(root.glob("*.mjs")))
for path in modules:
    subprocess.run(["node", "--check", str(path)], check=True)
    text = path.read_text()
    for name in re.findall(r"(?:from\s*|import\s*\()['\"](\./[^'\"]+)['\"]", text):
        assert (root / name).is_file(), name
assert hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest() == "01c53180ca78bee80411c2d07e436014b62f7e48dd37de70c2fed72238ee57dc"
print(f"Verified {len(snapshot['runtime_files'])} unchanged archive files and {len(modules)} JavaScript modules. Static checks only; no clinical-use claim.")
