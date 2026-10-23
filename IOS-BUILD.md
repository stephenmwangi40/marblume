# Marblume — iPhone & iPad builds

Apple only compiles iOS apps on a Mac, so the `.ipa` is built on a GitHub-hosted Mac by
`.github/workflows/build.yml`. Every run attaches the files to a GitHub Release.

## Unsigned .ipa (no Apple account)
Built automatically. It can be installed on your own iPhone or iPad with AltStore or Sideloadly,
which sign it with your free Apple ID. It cannot go to the App Store as-is.

## App Store / TestFlight (.ipa signed by Apple)
Needs an Apple Developer account ($99/year).
1. Create the app in App Store Connect with Bundle ID `com.marblume.ballsort`.
2. App Store Connect > Users and Access > Integrations > Keys: create an API key (role App Manager) and download the `.p8`.
3. In the GitHub repo, Settings > Secrets and variables > Actions, add
   `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8_BASE64` (the `.p8` file, base64-encoded).
4. Actions > Build apps > Run workflow. The signed build goes to TestFlight and the Release.

App Store Connect answers: privacy policy https://marblume.stephenmurigimwangi403.workers.dev/privacy ,
age rating 4+, no in-app purchases, data collection as described in `store/LISTING.md`.
Already in the project: PrivacyInfo.xcprivacy, export-compliance flag, all iPad orientations, an opaque app icon.
