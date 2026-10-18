# Medical Mysteries — 1.0.0

Medical Mysteries is an offline educational investigation game with six guided stories, nine investigation arrivals and a personal learning journal. **Clinician review completed, as confirmed by the creator.** Fictional learning cases are not medical advice or a clinical decision tool; generated scenes are illustrative rather than diagnostic images.

Version 1.0.0 removes interim release labels, unifies the review statement, keeps the full investigation and practice library enabled, and adds a bundled iPhone application with committed native saves, source links in the system browser and native history exports. See [1.0 release notes](RELEASE-1.0.0.md) and [iPhone build instructions](docs/IPHONE.md).

This release adds clearer authored decisions, record-specific communication and a focused art pass to the published 0.7.0 foundation:

- Version 6 revises investigation choice labels, prompts and receiver messages without changing findings, IDs, scores, gates or timing. Version 3 story questions and distractors retain their original clinical instructions, outcomes and feedback. Astra Max reviewed the editorial meanings and persistence boundaries.
- Story sessions can start on local HTTP Safari previews using secure random bytes when `randomUUID` is unavailable. Unavailable secure randomness fails without overwriting an earlier session. Errors receive focus and are scrolled into view.

- Three new 1536 × 1024 AI-generated scenes provide fictional atmosphere across the investigation families. All arrivals in a family share the same neutral scene. Earlier-version art and story hotspot images are preserved. Scene enlargement supports keyboard controls and focus return.
- Six original vector reference guides replace unsupported metabolic curves, fixed lesion/fluid marks and cosmetic comparison effects. Reference anatomy remains separate from current-stage facts; the figures do not invent patient findings or plot a treatment response. Investigation players can open a reference desk, enlarge the guide and toggle labels.
- Report status counts distinguish in-progress, available and reviewed work. Earlier saved editions remain accessible under a disclosure on the case board.

- Receiver verification now presents an authored readback of the sent information. Players must accept an accurate summary or correct a specific unsupported claim, omitted observation or missing ownership detail; replies are bound to the handoff snapshot.
- Reassessment questions depend on the released patient update and reviewed or pending report context. New information and newly tracked work make the previous reassessment outdated.
- All six story cases now use a distinct version 3 bundle with clearer questions and distractors across all 22 stages. The exact version 2 bundle is retained in `story_content_v2.mjs` for history replay. Distractors and their feedback focus on specific reasoning errors; the original correct clinical instructions, observations, timing and media remain unchanged.
- Existing full story sessions reopen with their original wording, option order, answer labels and results, including active original-edition routes. New plays default to the revised edition. Earlier best scores do not complete or award points in the revised edition.
- The three investigation families now contain nine distinct version 6 arrivals. The exact nine version 5 definitions and all six published version 4 arrivals are frozen unchanged for saved-history replay. Paired records share the same hypothesis options but supply different evidence: a limited CTA, incomplete supplied imaging or a contrasting metabolic pattern changes what can be concluded. Some records justify a cause-unresolved judgment after the relevant limitations are reviewed; that result does not confirm pathology.
- Each arrival has a care team workboard with named task owners. Independent requests can run in parallel; explicit fictional team update rounds make reports available, and reviewing a ready report adds its finding to the evidence. Rounds are not clinical minutes, recommended waits or a patient outcome clock. Earlier investigation content versions 1 through 5 remain bundled unchanged.
- Priority choices, evidence-specific reassessment, a structured early handoff and receiver readback develop alongside diagnostic reasoning. Reviewing the ECG, initial CT or plasma glucose activates the relevant reassessment question. Each arrival also releases an authored change in the patient or witness account, requiring its own communication response. Handoffs snapshot only the then-known findings, patient updates, responses, pending work and named owners; later information, changed hypotheses or newly assigned work make the earlier communication outdated. Changed choices and corrected readbacks retain their earlier attempts. A learner can conclude early without completing every task; diagnostic support, cited-evidence reasoning and coordination remain separate.
- All arrivals retain explicit support and uncertainty prompts. Debriefs describe the route's actual evidence and distinguish a provisional concern from a supported conclusion.
- After the Weekend requires the relevant combined evidence: the ketoacidotic record uses glucose, ketones and acid-base, while the contrasting hyperosmolar record also requires osmolality. A combined support choice is available only after its required findings are present; one abnormal number cannot stand in for the whole pattern.
- Confidence feedback reports first-response counts and descriptive differences between recorded confidence and observed outcomes, with missing-data and small-sample context.
- Known historical investigations and contrast questions remain bundled. Existing supported saves use their recorded content version, including all three v1, all three v2, all three v3 and all six frozen v4 investigations with their original profiles, reports and answers. Altered or unknown stored definitions do not become trusted game content; contrast questions stay attached to the appropriate bundled version.
- Journal entries are checked individually. Unreadable entries remain exportable alongside valid routes, and a recovery copy is preserved before a partial journal is updated. Matching assessed routes and reflections keep their first contrast answer. A full journal refuses an additional entry without deleting an earlier route; contrast feedback can still save for an existing entry. Clearing the journal also clears its recovery copies on that browser.
- The optional review queue routes original version 1 review variants to the original story bundle and version 2 and 3 variants to their exact corresponding bundles. A success in one edition cannot retire a review from the other. These records are local learning aids, not a measure of clinical competence.

## Run and check

Python 3.9+ and Node.js 22+ are required. No dependency install, model API or backend is needed.

```sh
npm test
python3 -m http.server 18551 --bind 127.0.0.1
```

Open `http://127.0.0.1:18551/`. Progress and notes use local browser storage. Do not enter real patient data. The tests use isolated fixtures and storage mocks; they do not read or clear a player's browser records.

`npm test` runs the candidate packaging verifier and eighteen focused behavioral suites covering the existing 247 scenarios plus release-mode, native-storage adapter and export checks covering investigation versions and reasoning, confidence descriptions, review retention, additional-case content, revised story decisions, story-history replay, edition-specific progress receipts, care workflow replay, journal capacity, arrival selection, patient updates, delayed practice, coexistence of saved editions, snapshot-bound receiver verification, contextual reassessment, and old/new mixed-journal storage boundaries. These are newly authored checks, not the missing original test suite or clinical validation. Browser interaction and visual checks are separate from these command-line tests.

## Story history and progress

The original `mmBetaSessions:v1` session store and `mmProfile` profile are read-only. An active original session continues through a separate per-session record carrying its original build identity. New sessions use `mmStorySession:v2:<session_id>` records and do not inherit the older app's global twelve-session eviction rule. Storage limits or conflicts produce a visible warning; a route marked **This tab only** may not survive a reload.

Story history lists recoverable full routes and keeps earlier profile score summaries separate. Export includes the available route records, progress receipts and unreadable stored bytes. The older app retained at most twelve full sessions. Sessions it already discarded cannot be reconstructed from a score summary; this candidate does not invent missing choices or observations.

Completion receipts are validated against known bundled editions and keep progress separate by build. Existing receipts cannot be replaced by a changed completion under the same session identity. Original results remain original-edition records; revised results contribute only to revised-edition progress. Unknown, damaged and incompatible records remain available for export and do not silently replace valid history. These browser-local records are learning aids, not authenticated qualifications or evidence of clinical competence.

## Investigation saves and delayed practice

Arrival-family selection controls navigation only. A saved route belongs to its exact episode ID and content version. Current v6 checkpoints use separate edition-specific slots, so starting a current arrival does not replace a paused older route. Recognized legacy routes use a continuation sidecar when saving would otherwise replace another older edition. Resume controls can select the recorded edition; a damaged current slot does not silently fall back to an older one.

The checkpoint limit remains 64 KiB, including maximum-length communication routes. Journals containing a fully validated completed v5 or v6 record may use up to 1 MiB; legacy-only journals and reflection stores retain their 512 KiB limits. The twenty-entry cap remains for older stores; a fully validated completed v6 record permits up to thirty entries, still within 1 MiB. Storage-conflict checks, unreadable-entry preservation and refusal to evict prior routes remain in place. A claimed or damaged v6 row does not grant larger capacity. Browser quota failures remain visible and exports remain available.

Current v6 contrast questions use delayed practice: **save a new attempt in a different arrival, then return to the earlier journal entry**. The source must be the exact saved route and reflection, followed by a saved completion from a different arrival with a strictly later recorded timestamp. The question keeps its first answer once submitted. Earlier v1–v3 practice remains immediately available; v4 keeps its original delayed-practice behavior.

For QA and recovery, this gate uses immutable saved records rather than a new completion ledger. Replaying an identical route and reflection keeps its original record and date, so it does not create a later qualifying attempt. A different saved route or reflection does; an equal or earlier timestamp does not. Changing the source reflection creates its own attempt and cannot borrow another source attempt's eligibility. This is spacing within the learning journal, not a clinical clock or a validated learning-outcome measure.

For the 0.9.0 editorial pass, native macOS Safari completed The Mountain Acid story (including a wrong-first-answer retry, retained as 75%) and The Missed Turn Arrival B v6 (all six findings, justified unresolved conclusion, handoff and corrected receiver reply). Reference enlargement, fit-to-screen, Escape and focus return worked in Safari. An enlarged browser-zoom layout was inspected; its exact percentage was not captured, so this is not a certified 200% sweep.

The connected physical iPhone 14 Pro Max completed The Dropped Pen v3 with 3/3 first answers. Night Shift v6 testing covered priority, tracking, patient update, report review, the native handoff selector, reference enlargement and fit, plus reload/resume with the reviewed report retained. This was a full story playthrough and a partial investigation smoke test, not completion of all nine arrivals on iPhone. Testing found and fixed a local-HTTP Safari session-start failure caused by `randomUUID` being unavailable. Astra Max reviewed the editorial meanings, journal bounds and compatibility fix. Fresh-player observation, a small-screen/landscape/VoiceOver sweep remain outstanding for the 0.9 browser test record. Automated and agent QA do not establish learning effectiveness.

## Preserved source and candidate provenance

The original readable browser source was recovered from the already published v2 beta ZIP. The original authoring workspace, case-bank JSONL files, generators and development tests were **not recovered**. `game-data.mjs` remains the unchanged generated release story bank; the original six stories are preserved byte-for-byte and remain available for historical replay. `story_decisions.mjs` supplies a separate revised bundle with its own build identity. All three six-story bundles remain available with their own content identities. The three original investigation families and their v1/v2/v3/v4/v5 definitions remain available alongside the nine current v6 arrivals. Historical manifest `sources` hashes refer to missing authoring files and do not imply those files are included here.

[SOURCE_SNAPSHOT.json](SOURCE_SNAPSHOT.json), [release-manifest.json](release-manifest.json) and [scripts/check-release.py](scripts/check-release.py) retain their original bytes. Their hashes describe the historical published payload. They do not describe the modified candidate root.

[baselines/published-beta-v2](baselines/published-beta-v2/BASELINE.json) preserves all 17 original root JavaScript, HTML and CSS files from recovery commit `1c16a334772732ee4360d1d63d2b3ae62a69a55e`, including the subsequent licensing page. This small source baseline shares the unchanged original assets at the candidate root and a frozen original CREDITS.txt alongside the baseline sources; it is not a standalone playable build. The original verifier remains a historical artifact and is not the candidate test command.

[scripts/check-upgrade.py](scripts/check-upgrade.py) pins the historical metadata and license hashes, verifies all 92 original archive members through the frozen source baseline or unchanged root files, then verifies current candidate hashes, module syntax, literal module imports, `loadModule` references and local HTML/CSS references. Missing baseline sources never fall back to modified current sources. The verifier also pins the unchanged current story bank against its published bytes. [UPGRADE_MANIFEST.json](UPGRADE_MANIFEST.json) records the candidate's runtime and support files separately, plus changed and added runtime paths. The current CREDITS.txt carries the consistent 1.0 statement; the original credits remain hash-verified in the historical baseline. Normal verification never refreshes hashes.

Stored runs select known bundled builds. Before revising story content in a later edition, preserve the preceding trusted bundle and keep it registered for replay; refreshing file hashes alone does not migrate old histories.

After an intentional source edit has been reviewed, refresh the candidate inventory explicitly and rerun the checks:

```sh
python3 scripts/check-upgrade.py --write-manifest
npm test
```

The manifest is a build inventory, separate from live publication receipts. The clinician-review statement records the creator’s direct confirmation on October 18, 2026; that is the confirmation date, not an invented review date. Software test results establish the checked behavior, not measured learning or clinical outcomes. Historical release files retain their original wording.

## Licensing

Forge Game License 2.0 (`FG2-MEDICAL-MYSTERIES-20261015`) remains unchanged. Applicable owner-controlled upgrades are source-available, not OSI open source. Previously supplied gameplay and media retain MIT, earlier Forge and other applicable grants; no retroactive restriction is claimed. See [0.7.0 release scope](RELEASE-0.7.0.md), [licensing history](LICENSING.md), [current terms](LICENSE), [preserved prior terms](LICENSE-LEGACY-PRE-FORGE-2.0.txt), [offline licensing page](FORGE-LICENSING.html) and [current credits](CREDITS.txt) and [historical credits](baselines/published-beta-v2/CREDITS.txt).

Play the current version on [itch.io](https://titans-forge.itch.io/medical-mysteries), or get matching browser and download ZIPs from the [v1.0.0 release](https://github.com/titans-forge/Medical-Mysteries/releases/tag/v1.0.0). Earlier releases remain available. See [0.9.0 release scope](RELEASE-0.9.0.md) for this edition’s changes and preserved permissions. No private medical-vault files, original case-authoring prompts or private learner history are included. New synthetic-scene prompts are recorded in the art provenance document.
