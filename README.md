# Medical Mysteries — published beta recovery

> **Current licensing policy — Forge Game License 2.0 (FG2-MEDICAL-MYSTERIES-20261015).** This licensing-only edition requires separate permission for either public hosting or AI training by above-threshold entities on qualifying new Forge-controlled material. Previously supplied gameplay/media retain MIT, earlier Forge and other applicable grants. No retroactive restriction is claimed. See [release scope](LICENSING.md), [complete current terms](LICENSE), [preserved prior terms](LICENSE-LEGACY-PRE-FORGE-2.0.txt), [offline licensing page](FORGE-LICENSING.html) and [new download](https://github.com/titans-forge/Medical-Mysteries/releases/tag/forge-license-2.0-20261015). Earlier statements below describe the earlier game and preserved grants.


[Play on itch.io](https://titans-forge.itch.io/medical-mysteries) · [Licensing](LICENSING.md) · [Original credits](CREDITS.txt)

Fictional cases, an investigation board, practice activities and a learning journal for educational medical reasoning. **Not a clinical tool or medical advice. AI-audited; not independently clinically reviewed. No clinical use.** Illustrations are synthetic scenes, not diagnostic imagery.

## Recovery scope

This repository recovers the exact readable JavaScript, HTML, styles and assets from the previously published September 13, 2026 v2 beta ZIP. These are native browser modules, not decompiled/minified reconstructed source. [SOURCE_SNAPSHOT.json](SOURCE_SNAPSHOT.json) binds every original member; release-manifest.json and CREDITS.txt are unchanged.

The original development folder, authoring JSONL case banks, generators and test suite were **not recovered**. Source hashes in the historical release manifest refer to that missing authoring workspace; their files are not implied to be here. `game-data.mjs` is the generated release case bank. New checks below are static packaging and syntax smoke checks, not the original test suite or clinical validation.

## Run and check

Python 3 and Node.js 22+:

```sh
python3 scripts/check-release.py
python3 -m http.server 18551 --bind 127.0.0.1
```

Open http://127.0.0.1:18551/ . No dependency install, model API or backend is needed. The optional package.json only declares JavaScript module syntax and a check shortcut. Start a fictional case from the board; notes and practice progress use local browser storage. Clearing that storage removes local learning records. No real patient data should be entered.

Only the owner's already published game payload and new public packaging/licensing documents are included. No private medical-vault files, authoring prompts or private history are exported. The Forge license covers applicable owner-controlled upgrades, preserves earlier grants and is source-available, not OSI open source.
