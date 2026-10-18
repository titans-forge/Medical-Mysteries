# Medical Mysteries for iPhone

A small UIKit/WebKit application using only Apple SDK frameworks and SQLite. Bundle ID `com.titansforge.medicalmysteries`, version 1.0.0, build 1. iPhone target, iOS 16+ declared; qualify older supported devices before distribution.

## Build

From the repository root:

```sh
npm test
sh scripts/ios-build.sh
sh scripts/ios-build.sh device
```

The scripts verify the source manifest and copy only public game and licensing files to `ios/Game`, recording their hashes in `BUNDLE_MANIFEST.json`. Open `ios/MedicalMysteries.xcodeproj` to run the MedicalMysteries scheme. Select the authorized development team to sign for your phone; preserve the bundle ID when updating an installed copy. The device script builds unsigned for inspection, not an installable or distributable IPA.

## Offline play and references

Game assets load from a fixed bundled `forge://medical-mysteries/` origin through `WKURLSchemeHandler`, with explicit JavaScript MIME types and path containment. No private file-access settings, remote game URL or downloaded scripts. Source links open in the system's selected browser; only the browser needs internet access. Local licensing pages open in a separate unprivileged sheet with Done. The native webview fills the screen and CSS applies safe-area insets once, including dialogs.

## Saved progress

`game_storage.mjs` routes every story, draft, score, investigation, reflection, practice and review store to the same authoritative native SQLite database. Browser play continues to use ordinary localStorage. The native Storage facade preserves existing synchronous failure handling and comparison checks. Its versioned prompt protocol accepts only the bundled main frame; it returns only after a native operation finishes. No optimistic cache or fallback to a disposable web store.

SQLite WAL mode and `synchronous=FULL` provide committed-write recovery. The database lives in Application Support, is eligible for app backup, and uses device file protection until first unlock. Values retain their existing JSON formats; individual values can be up to 4 MiB, with up to 64 MiB total and 10,000 keys. Quota and database errors never silently reset the store or replace earlier saves. Availability still depends on device storage and the operating system. Reinstalling after deleting the app does not preserve its private data container.

On iPhone, both Export story history and Export journal produce a full backup of committed app saves using the `medical-mysteries-native-backup-v1` JSON schema (`records` contain unchanged `key`/`raw` strings). Native code streams a consistent database snapshot without a smaller export-size cap. Unsaved work that failed to commit is not in that database backup. This version provides export, not native backup import. Choose Save to Files for a separate copy. Opening or cancelling the share sheet does not save an external backup automatically and never clears game progress. Native saves and web-origin saves are separate; this version does not claim automatic Safari-to-app transfer or cloud sync.

## Review record

The creator confirmed completed clinician review on October 18, 2026. Player-facing wording and credits use that same statement. Reviewer identity, review date and exact reviewed artifact have not been supplied, so they are not invented. Software verification and agent design review are distinct from measured educational or clinical outcomes.

## Qualification

Use the current QA receipt for actually completed tests. The declared deployment target alone does not establish oldest-device support. Before App Store submission, finish physical-device accessibility and performance checks, privacy/support metadata, signing/archive validation and Apple's review process. No App Store submission occurs in this pass.
