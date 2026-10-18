# Medical Mysteries 0.9.0 — clearer decisions and refreshed visuals

Release edition: **FG2-MEDICAL-MYSTERIES-0.9.0-20261017**. Prepared October 17, 2026 (New York).

Six guided stories and three investigation families with nine current arrivals. This edition improves choice wording, receiver verification, context-specific reassessment, scene art, anatomy/report guides and physical-iPhone compatibility.

## Changes

- Investigation content v6 revises prompts, choice labels and receiver messages while preserving findings, identifiers, ordering, rules, scores and timing. Story content v3 revises questions and distractors across all 22 stages without changing the original clinical instructions, outcomes, observations, media or teaching feedback.
- Receiver replies can contain a specific omission, unsupported claim or ownership error. Players compare the reply with the actual sent handoff. Later reports and patient changes do not silently rewrite that snapshot. Corrected choices retain their earlier attempts.
- Nine arrivals include contrasting and incomplete evidence. A justified unresolved conclusion stays distinct from confirming or excluding a diagnosis. Task updates are fictional rounds, not recommended clinical waits.
- Three new fictional scene images and six original vector reference guides provide clearer presentation without inventing patient scans, lesions or treatment-response curves. Enlargement, labels and fit-to-screen are available.
- Earlier investigation v1–v5 and story v1/v2 remain bundled for exact history replay. A completed validated v6 record permits up to 30 journal entries within 1 MiB, without evicting old entries. Earlier-only/v5 stores retain their 20-entry cap.
- Local HTTP Safari can create story sessions using secure random bytes when its UUID convenience API is unavailable. Error messages receive focus and scroll into view.

## Scope and preserved permissions

This edition identifies qualifying new Forge-controlled contributions added after 0.7.0 in the v5/v6 authored investigation banks, story v3 editorial expression, original scene art and vector guides, presentation, compatibility and verification code. Their inventory is recorded in UPGRADE_MANIFEST.json. Forge Game License 2.0 in LICENSE remains unchanged and applies prospectively only to qualifying new Forge-controlled expression. An updated file or version number does not make every earlier byte newly restricted.

Earlier MIT, earlier Forge and third-party grants remain effective for their material, including earlier portions of modified files. Facts, ideas, public-domain material and statutory rights keep their status. Historical sources and notices, original story data and earlier media remain preserved. See RELEASE-0.7.0.md, LICENSING.md, LICENSE-LEGACY-PRE-FORGE-2.0.txt, CREDITS.txt and docs/licensing-history/.

For covered new material, entities with company-wide annual gross revenue strictly over US$1 million require separate written permission for public hosting or AI training under the full license. The requirements are independent; no automatic educational-institution exemption applies. Ordinary play and permitted private/classroom use remain free. Read LICENSE for the exact terms and exceptions.

## Validation and practical limits

247 automated scenarios in 17 behavioral suites pass, with 92 original beta members preserved. Astra at Max in Codex independently reviewed the editorial meanings, persistence boundaries and Safari repair. Native macOS Safari completed a story and a full v6 investigation with a corrected receiver reply. The physical iPhone 14 Pro Max completed The Dropped Pen v3 and tested part of Night Shift v6, native selection, diagram enlargement/fit and reload/resume. This does not certify all nine arrivals on every phone, VoiceOver or landscape use. Fresh-player observation and learning effectiveness remain untested.

The owner reports clinician review of earlier material; its exact reviewed artifact and scope are not recorded. No separate clinician review of the new content or this edition is claimed. Fictional cases and generated scenes are educational; illustrations are not diagnostic images. The game is not medical advice or a clinical decision tool.

The upgrade manifest records the pre-upload build inventory. Its candidate status is retained as provenance, rather than treated as evidence of live publication. GitHub release records and the separately saved publication receipt establish distribution state.

## Downloaded play

The browser and downloadable ZIPs contain the same verified payload. Extract the ZIP and serve its directory over local HTTP, for example:

```sh
python3 -m http.server 18551 --bind 127.0.0.1
```

Then open http://127.0.0.1:18551/. ES modules require HTTP; double-clicking index.html may not work. No model API, AI subscription, dependency installation or backend is required for play. Progress is local to the browser and origin, so it does not automatically transfer between itch, GitHub and a local copy. Do not enter patient data.

Play online: https://titans-forge.itch.io/medical-mysteries
Source and matching downloads: https://github.com/titans-forge/Medical-Mysteries/releases/tag/v0.9.0
