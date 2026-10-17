# Medical Mysteries — 0.7.0 Investigation Edition

This **0.7.0 release** is built from the recovered September 13, 2026 v2 beta. It includes fictional cases, an investigation board, practice activities and a browser-local learning journal. **Educational game only; no clinical use or medical advice.** The owner reports clinician review of earlier Medical Mysteries material; its exact reviewed scope, artifact and version are not recorded here. The new arrival content and care workflow additions have not received separate clinician review. Illustrations are synthetic scenes, not diagnostic imagery.

This release improves the learning loop:

- All six story cases use a distinct version 2 bundle with revised decision prompts across all 22 stages. Distractors and their feedback focus on specific reasoning errors; the original correct clinical instructions, observations, timing and media remain unchanged.
- Existing full story sessions reopen with their original wording, option order, answer labels and results, including active original-edition routes. New plays default to the revised edition. Earlier best scores do not complete or award points in the revised edition.
- The three investigation families now contain six distinct version 4 arrivals. Paired records share the same hypothesis options but supply different evidence: a limited CTA, incomplete supplied imaging or a contrasting metabolic pattern changes what can be concluded. Some records justify a cause-unresolved judgment after the relevant limitations are reviewed; that result does not confirm pathology.
- Each arrival has a care team workboard with named task owners. Independent requests can run in parallel; explicit fictional team update rounds make reports available, and reviewing a ready report adds its finding to the evidence. Rounds are not clinical minutes, recommended waits or a patient outcome clock. Earlier investigation content versions 1, 2 and 3 remain bundled unchanged.
- Priority choices, evidence-specific reassessment, a structured early handoff and receiver readback develop alongside diagnostic reasoning. Reviewing the ECG, initial CT or plasma glucose activates the relevant reassessment question. Each arrival also releases an authored change in the patient or witness account, requiring its own communication response. Handoffs snapshot only the then-known findings, patient updates, responses, pending work and named owners; later information, changed hypotheses or newly assigned work make the earlier communication outdated. Changed choices and corrected readbacks retain their earlier attempts. A learner can conclude early without completing every task; diagnostic support, cited-evidence reasoning and coordination remain separate.
- All arrivals retain explicit support and uncertainty prompts. Debriefs describe the route's actual evidence and distinguish a provisional concern from a supported conclusion.
- After the Weekend requires the relevant combined evidence: the ketoacidotic record uses glucose, ketones and acid-base, while the contrasting hyperosmolar record also requires osmolality. A combined support choice is available only after its required findings are present; one abnormal number cannot stand in for the whole pattern.
- Confidence feedback reports first-response counts and descriptive differences between recorded confidence and observed outcomes, with missing-data and small-sample context.
- Known historical investigations and contrast questions remain bundled. Existing supported saves use their recorded content version, including all three v1, all three v2 and all three frozen v3 investigations with their original profiles, reports and answers. Altered or unknown stored definitions do not become trusted game content; contrast questions stay attached to the appropriate bundled version.
- Journal entries are checked individually. Unreadable entries remain exportable alongside valid routes, and a recovery copy is preserved before a partial journal is updated. Matching assessed routes and reflections keep their first contrast answer. A full journal refuses an additional entry without deleting an earlier route; contrast feedback can still save for an existing entry. Clearing the journal also clears its recovery copies on that browser.
- The optional review queue routes original version 1 review variants to the original story bundle and revised version 2 variants to the revised bundle. A success in one edition cannot retire a review from the other. These records are local learning aids, not a measure of clinical competence.

## Run and check

Python 3.9+ and Node.js 22+ are required. No dependency install, model API or backend is needed.

```sh
npm test
python3 -m http.server 18551 --bind 127.0.0.1
```

Open `http://127.0.0.1:18551/`. Progress and notes use local browser storage. Do not enter real patient data. The tests use isolated fixtures and storage mocks; they do not read or clear a player's browser records.

`npm test` runs the candidate packaging verifier and twelve focused behavioral suites with 201 scenarios covering investigation versions and reasoning, confidence descriptions, review retention, additional-case content, revised story decisions, story-history replay, edition-specific progress receipts, care workflow replay, journal capacity, arrival selection, patient updates, delayed practice and coexistence of saved editions. These are newly authored checks, not the missing original test suite or clinical validation. Browser interaction and visual checks are separate from these command-line tests.

## Story history and progress

The original `mmBetaSessions:v1` session store and `mmProfile` profile are read-only. An active original session continues through a separate per-session record carrying its original build identity. New sessions use `mmStorySession:v2:<session_id>` records and do not inherit the older app's global twelve-session eviction rule. Storage limits or conflicts produce a visible warning; a route marked **This tab only** may not survive a reload.

Story history lists recoverable full routes and keeps earlier profile score summaries separate. Export includes the available route records, progress receipts and unreadable stored bytes. The older app retained at most twelve full sessions. Sessions it already discarded cannot be reconstructed from a score summary; this candidate does not invent missing choices or observations.

Completion receipts are validated against known bundled editions and keep progress separate by build. Existing receipts cannot be replaced by a changed completion under the same session identity. Original results remain original-edition records; revised results contribute only to revised-edition progress. Unknown, damaged and incompatible records remain available for export and do not silently replace valid history. These browser-local records are learning aids, not authenticated qualifications or evidence of clinical competence.

## Investigation saves and delayed practice

Arrival-family selection controls navigation only. A saved route belongs to its exact episode ID and content version. New v4 checkpoints use separate edition-specific slots, so starting a current arrival does not replace a paused older route. Recognized legacy routes use a continuation sidecar when saving would otherwise replace another older edition. Resume controls can select the recorded edition; a damaged current slot does not silently fall back to an older one.

Current v4 contrast questions use delayed practice: **save a new attempt in a different arrival, then return to the earlier journal entry**. The source must be the exact saved route and reflection, followed by a saved completion from a different arrival with a strictly later recorded timestamp. The question keeps its first answer once submitted. Earlier v1–v3 practice remains immediately available.

For QA and recovery, this gate uses immutable saved records rather than a new completion ledger. Replaying an identical route and reflection keeps its original record and date, so it does not create a later qualifying attempt. A different saved route or reflection does; an equal or earlier timestamp does not. Changing the source reflection creates its own attempt and cannot borrow another source attempt's eligibility. This is spacing within the learning journal, not a clinical clock or a validated learning-outcome measure.

## Preserved source and candidate provenance

The original readable browser source was recovered from the already published v2 beta ZIP. The original authoring workspace, case-bank JSONL files, generators and development tests were **not recovered**. `game-data.mjs` remains the unchanged generated release story bank; the original six stories are preserved byte-for-byte and remain available for historical replay. `story_decisions.mjs` supplies a separate revised bundle with its own build identity. The original and revised six-story bundles remain intact. The three original investigation families and their v1/v2/v3 definitions remain available alongside the six current v4 arrivals. Historical manifest `sources` hashes refer to missing authoring files and do not imply those files are included here.

[SOURCE_SNAPSHOT.json](SOURCE_SNAPSHOT.json), [release-manifest.json](release-manifest.json) and [scripts/check-release.py](scripts/check-release.py) retain their original bytes. Their hashes describe the historical published payload. They do not describe the modified candidate root.

[baselines/published-beta-v2](baselines/published-beta-v2/BASELINE.json) preserves all 17 original root JavaScript, HTML and CSS files from recovery commit `1c16a334772732ee4360d1d63d2b3ae62a69a55e`, including the subsequent licensing page. This small source baseline shares the unchanged original assets and credits at the candidate root; it is not a standalone playable build. The original verifier remains a historical artifact and is not the candidate test command.

[scripts/check-upgrade.py](scripts/check-upgrade.py) pins the historical metadata and license hashes, verifies all 92 original archive members through the frozen source baseline or unchanged root files, then verifies current candidate hashes, module syntax, literal module imports, `loadModule` references and local HTML/CSS references. Missing baseline sources never fall back to modified current sources. The verifier also pins the unchanged current story bank against its published bytes. [UPGRADE_MANIFEST.json](UPGRADE_MANIFEST.json) records the candidate's runtime and support files separately, plus changed and added runtime paths. Normal verification never refreshes hashes.

Stored runs select known bundled builds. Before revising story content in a later edition, preserve the preceding trusted bundle and keep it registered for replay; refreshing file hashes alone does not migrate old histories.

After an intentional source edit has been reviewed, refresh the candidate inventory explicitly and rerun the checks:

```sh
python3 scripts/check-upgrade.py --write-manifest
npm test
```

The manifest records a release artifact and distinguishes owner-reported prior clinician review from the new arrival content and workflow additions that have not received separate review. It does not certify clinical validity, deployment or publication.

## Licensing

Forge Game License 2.0 (`FG2-MEDICAL-MYSTERIES-20261015`) remains unchanged. Applicable owner-controlled upgrades are source-available, not OSI open source. Previously supplied gameplay and media retain MIT, earlier Forge and other applicable grants; no retroactive restriction is claimed. See [0.7.0 release scope](RELEASE-0.7.0.md), [licensing history](LICENSING.md), [current terms](LICENSE), [preserved prior terms](LICENSE-LEGACY-PRE-FORGE-2.0.txt), [offline licensing page](FORGE-LICENSING.html) and [original credits](CREDITS.txt).

The [itch.io page](https://titans-forge.itch.io/medical-mysteries) and [v0.7.0 release](https://github.com/titans-forge/Medical-Mysteries/releases/tag/v0.7.0) provide the current distribution; earlier releases remain available. The 0.7.0 browser player and downloadable ZIP are distributed through that itch.io page and the GitHub v0.7.0 release. No private medical-vault files, authoring prompts or private history are included.
