# Marblume — build & release guide

Calm ball-sort puzzle: 10,000 levels, 20 worlds. One web codebase (`www/`) wrapped with Capacitor for Android and iOS.

| What | Where |
|---|---|
| Android installer (sideload / website) | `Marblume-x.y.z.apk` on the GitHub Releases page |
| Android bundle (Google Play upload) | `Marblume-x.y.z.aab` on the GitHub Releases page |
| iPhone & iPad app | `.ipa` on the GitHub Releases page, built by `.github/workflows/build.yml` (see IOS-BUILD.md) |
| Website | https://marblume.stephenmurigimwangi403.workers.dev (source: `site-src/`) |

## ⚠️ Back up the signing key now

`android/keystore/marblume-upload.jks` and `android/keystore.properties` (holds its password) sign every Android release.
**If you lose them you can never publish an update to the same app.** Copy both to a USB drive and a password manager / private cloud folder. They are git-ignored on purpose — never commit them.

## Everyday commands

```bash
npm install                 # once
npm run sync                # rebuild web assets + copy into android/ and ios/
npm run deploy:site         # rebuild website (incl. latest APK) and publish to Cloudflare
npm run levels:verify       # prove all 10,000 levels are solvable and unique
node scripts/ui-test.mjs app shots          # screenshot every app screen on 10 phone/tablet/desktop sizes
node scripts/serve.mjs site 8788            # preview the website locally (then: node scripts/ui-test.mjs site shots http://localhost:8788/)
node scripts/resize-test.mjs <siteUrl> <siteUrl>/play/ shots   # resize live through 8 screen sizes without reloading
```

## Build the Android APK + AAB (Windows)

```bash
npm run sync
cd android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr      # JDK 21 from Android Studio
gradlew.bat assembleRelease bundleRelease
```
Outputs: `android/app/build/outputs/apk/release/app-release.apk` and `.../bundle/release/app-release.aab`.
Copy them into `release/` with the new version in the name.

**New version:** bump `versionCode` (+1 every upload) and `versionName` in `android/app/build.gradle`, `version` in `package.json`, and `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode.

## Publish on Google Play

1. Create a developer account at play.google.com/console (one-time $25).
2. Create the app → upload `the latest Marblume-x.y.z.aab from GitHub Releases`. Opt in to **Play App Signing** (Google keeps the final key; ours is the upload key).
3. Privacy policy URL: `https://marblume.stephenmurigimwangi403.workers.dev/privacy`
4. Data safety form: see `store/LISTING.md` (v1.6: optional anonymous app interactions + a random app code, not shared, deletable in the app). Content rating: Everyone. Ads: Yes (optional rewarded videos, see "Ads" below). In-app purchases: No.
5. Phones are locked to portrait; on tablets and foldables Android 16 allows any orientation, and the app's layout adapts to it.

### Store-rules notes
- No placeholder or "coming soon" features in the app (App Store guideline 2.1).
- Privacy policy linked inside the app (Settings → About) and on the store listings.
- iOS includes `PrivacyInfo.xcprivacy` (no tracking; optional product-interaction stats, app-made ID and survey answers, not linked to the user); iPad supports all orientations.
- No purchases and no accounts. The game plays offline; it goes online only for the optional stats (off until the player taps “Share”), surveys and the optional videos in the phone apps.
- Surveys must never offer rewards or ask for a store rating (the admin refuses questions that mention store reviews).

## Build for iOS

iOS apps can only be compiled on macOS with Xcode — not on Windows. Two options:

**A. GitHub Actions (no Mac needed)**
1. Join the Apple Developer Program ($99/yr) and create the app in App Store Connect with bundle ID `com.marblume.ballsort`.
2. In App Store Connect → Users and Access → Integrations → create an API key (App Manager). Download the `.p8`.
3. Push this folder to a **private** GitHub repo (keystore files are git-ignored).
4. Add repo secrets: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (`base64 -w0 AuthKey_XXXX.p8`).
5. Actions → **iOS build** → Run workflow. It archives, signs, uploads to TestFlight and attaches the `.ipa` as an artifact.
   Without the secrets it still runs an unsigned simulator build to prove the project compiles.

**B. On a Mac**: `npm ci && npx cap sync ios && npx cap open ios`, choose your team under Signing & Capabilities, then Product → Archive → Distribute.

## Levels

`www/levels.js` holds 10,000 levels made by `scripts/generate-levels.mjs` — every board is verified solvable by an A* solver, with a par move count, and **no two levels are the same puzzle** (the generator rejects any board that only reorders tubes or swaps colours of an earlier level). `npm run levels:verify` re-checks all of this.
Difficulty: every level gets its own setup (5–12 colours, tubes of 3–7 balls, 1–3 spare tubes, sometimes hidden balls) chosen to match a difficulty curve that rises across all 10,000 levels, with world "flavours" (`FLAVOUR` in `scripts/generate-levels.mjs`) and a rule that neighbouring levels never share a setup. Each level stores a difficulty 1–100 shown in the app as Hard / Very hard / Expert / Master. Regenerate with `node scripts/generate-levels.mjs` (~35 min), then `npm run levels:verify`. `node scripts/play-test.mjs 40` plays sample levels to a win inside the real game.
To use your original `marblume-levels.json` instead, put it in the project root, delete `www/levels.js` and run `npm run sync`.

## Support admin (two-way conversations)

- Players write from https://marblume.stephenmurigimwangi403.workers.dev/support (in the app: Settings → Help & support). The page remembers their conversations and shows "New reply" when you answer; they can reply back. They also get a private link to their conversation.
- You sign in at **https://marblume.stephenmurigimwangi403.workers.dev/admin** with the key in `support-admin-key.txt` (git-ignored, never in a zip). Read, reply, mark solved, copy the player's link, email the player, or delete.
- Data: Cloudflare D1 database `marblume-support` (tables in `worker/schema.sql`); conversations auto-delete 12 months after the last message. Wrong-key attempts are limited to 10 per hour per visitor.
- New key: put it in `support-admin-key.txt`, then `tr -d '
' < support-admin-key.txt | npx wrangler secret put ADMIN_KEY`.

### Admin tools
Tabs at /admin: Inbox (paged and searched on the server; labels, private notes, saved replies, "+ Ideas & bugs"), **Players** (v1.6: overview, players list, per-level results, one player's history — all paginated), **Surveys** (v1.6: one live question at a time, stars / multiple choice / free text, answers with averages, CSV), Dashboard, Ideas & bugs, Saved replies, FAQ (live on /support), Website announcement bar, Releases log, Store checklist (with an automatic website health check), Privacy tools (CSV export, delete by email). Code: `worker/tools.js`, `worker/insights.js`; tables in `worker/schema.sql`. Game stats come only from players who tapped “Share” and are deleted after 24 months.
Test the API with `node scripts/api-test.mjs <siteUrl> <adminKey>` (it cleans up after itself).

### Game features added in 1.6
- Balls fly between tubes, glass sounds, tube-complete burst; frozen tubes (`scripts/add-frozen.mjs` adds them to `www/levels.json`, `npm run levels:verify` checks them).
- Relaxed play, dark mode, text size (follows the phone via `@capacitor/text-zoom`), 7 languages (`scripts/i18n/*.json` → `www/i18n.js` by `scripts/build-i18n.mjs`; `node scripts/i18n-keys.mjs` lists any missing phrase), monthly Daily calendar, 20 badges, backup / restore code, tube shapes, keyboard play on computers.
- Design checks: `node scripts/design-audit.mjs <outDir>` measures text contrast in light and dark mode and looks for clipped text at 150% text size and in German.

### Website structure
Shared header/menu/footer live in `site-src/partials/` and `site-src/site.css` / `site.js`, inserted into every page by `scripts/build-site.mjs`. Home sections have clean addresses (/features, /profile, /worlds, /collect, /faq, /get) served by the worker. Test: `node scripts/site-test.mjs <siteUrl> <adminKey> shots`. After any change to the game's look, refresh the website screenshots with `node scripts/site-shots.mjs` and the store screenshots with `node scripts/store-assets.mjs`, then `npm run deploy:site`.

## Store listing kit

`store/LISTING.md` has every text field, the Data safety / App Privacy answers, content-rating answers and reviewer notes.
Images at the exact required sizes, with headlines, are in `store/play/` and `store/appstore/` (regenerate with `node scripts/store-assets.mjs`). Preview videos are in `store/video/` (regenerate with `node scripts/store-video.mjs`).

## Logo & icons

The logo (three tubes of marbles with a marble flower blooming from the middle one) lives in `scripts/logo.mjs`. To regenerate every icon and splash: `node scripts/make-icons.mjs` then `npx @capacitor/assets generate --iconBackgroundColor "#16213A" --iconBackgroundColorDark "#16213A" --splashBackgroundColor "#16213A" --splashBackgroundColorDark "#16213A" --android --ios`.

## Website

Static files in `site-src/` (landing page, privacy policy, 404). `scripts/build-site.mjs` adds the playable web game at `/play/`, screenshots from `site-src/shots/` and the latest APK at `/download/`. Hosted as a Cloudflare Worker with static assets (`wrangler.jsonc`).
To use your own domain: Cloudflare dashboard → Workers & Pages → marblume → Settings → Domains & Routes → Add custom domain.

## Ads (Google AdMob, phone apps only)

Optional **rewarded videos**: for a hint (after the 3 free daily hints), an extra tube (after the free one), double seeds on the win screen and +20 seeds in the Shop. At most 10 a day (5 from the Shop), never between levels, none in Expert play, none on the web. Order on first launch: Google's consent message (where required) → Apple's tracking prompt on iOS → ads load. Settings has **Ad choices** and **Report an ad**.

All IDs live in **`ads.json`** (now Google's test IDs, which show test ads and earn nothing). Put your AdMob app IDs, rewarded ad unit IDs and publisher ID there; `npm run build:web` copies them into Android, iOS, `www/ads.js` and `site-src/app-ads.txt`. Store answers for ads are in `store/LISTING.md`.

## Flutter version (flutter/)

The core game rebuilt in Flutter: the same 10,000 levels and rules (undo, hints, Expert play, frozen tubes, hidden balls) with 3D marbles and liquid glass.
It installs next to the main app as **Marblume F** (`com.marblume.flutter` on Android and iOS). GitHub Actions builds its APK, AAB and .ipa with every release.

```bash
cp www/levels.json flutter/assets/levels.json   # the levels are shared, not duplicated in git
cd flutter && flutter test && flutter run
flutter build web --release --base-href /flutter/ --no-web-resources-cdn   # npm run deploy:site then publishes it at /flutter/
```

## Credits

Interface icons from [awesome_icons](https://github.com/JonathanGech/awesome_icons) by Jonathan Getachew (MIT licence).
Fonts: DM Sans and Fraunces (SIL Open Font Licence).
