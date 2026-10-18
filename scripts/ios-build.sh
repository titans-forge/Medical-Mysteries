#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
python3 scripts/ios-sync.py
if [ "${1:-simulator}" = "device" ]; then
  xcodebuild -project ios/MedicalMysteries.xcodeproj -scheme MedicalMysteries -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath ios/build/device CODE_SIGNING_ALLOWED=NO build
else
  xcodebuild -project ios/MedicalMysteries.xcodeproj -scheme MedicalMysteries -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build/simulator CODE_SIGNING_ALLOWED=NO build
fi
