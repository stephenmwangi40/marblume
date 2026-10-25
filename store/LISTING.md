# Marblume — store listing kit (version 1.12.3)

Everything below is ready to paste. Images are in `store/play/` and `store/appstore/`, videos in `store/video/`.

| Link | URL |
|---|---|
| Privacy policy | https://marblume.stephenmurigimwangi403.workers.dev/privacy |
| Support | https://marblume.stephenmurigimwangi403.workers.dev/support |
| Marketing / website | https://marblume.stephenmurigimwangi403.workers.dev |

> **Ads (from 1.12.0).** The phone apps show optional **rewarded videos from Google AdMob** (hint, extra tube, double win seeds, +20 seeds in the Shop; max 10 a day, never between levels, none in Expert, none on the web). Before you publish:
> 1. Create the app in [AdMob](https://apps.admob.com) for Android and iOS, make one **Rewarded** ad unit for each, and put the two app IDs, the two ad unit IDs and your publisher ID (`pub-…`) into `ads.json`. Until then the builds show Google's **test ads** and earn nothing.
> 2. Run `npm run deploy:site` so `/app-ads.txt` goes live, and use the website URL above as the **developer website** in both stores (AdMob checks app-ads.txt there).
> 3. In AdMob → Privacy & messaging, create the **GDPR (EEA/UK/Switzerland)** message and the **IDFA explainer** for iOS; the app shows them through Google's consent SDK before any ad loads.
> 4. Fill in the ads answers below in Play Console and App Store Connect.

---

## Google Play Console

**App name (≤30):** Marblume: Ball Sort Puzzle

**Short description (≤80):** Hard ball sort puzzle: 10,000 unique levels, frozen tubes and daily puzzles.

**Full description (≤4000):**

Marblume is a ball sort puzzle for players who want a real challenge.

Pour marbles between glass tubes until every tube holds a single colour. It sounds simple, but every Marblume level has its own board: 5 to 12 colours, tubes that hold 3 to 7 balls, one to three spare tubes, hidden balls, and — from World 2 — frozen tubes that only thaw when you finish the right colour. It starts hard on level 1 and climbs steadily, and every level shows its difficulty: Hard, Very hard, Expert or Master.

HARD, BUT ALWAYS FAIR
• 10,000 unique levels, every one solved by computer before release, so there is always a way through
• Each level has a par: beat it for three stars
• Unlimited free undo and free restarts
• Hints that work out a real solution from where you are
• An extra tube when you are really stuck — or Relaxed play, with an extra empty tube on every level
• No timers and no lives

SATISFYING TO PLAY
• Balls arc from tube to tube and land with a soft glass clink
• Finished tubes cap themselves with a burst of colour
• Gentle vibration on supported phones

20 WORLDS, EACH WITH A TWIST
Frozen tubes, mystery balls, tall tubes, one-spare-tube challenges, 12-colour boards and more. A gentler breather every ten levels and a boss level every twenty-five.

DAILY BLOOM
A fresh puzzle every day on a monthly calendar. Catch up on days you missed, keep your streak, and finish a whole month for a bonus.

GROW YOUR GARDEN AND MAKE IT YOURS
• A new flower blooms every ten levels
• 10 illustrated avatars, a name and a ring colour
• Nine ranks from Seed to Legend and 21 badges that pay out seeds
• 55 items to collect: ball styles, tube styles and shapes, game scenes and win effects

PLAY YOUR WAY
• 7 languages: English, Español, Português, Français, Deutsch, Bahasa Indonesia, हिन्दी
• Dark mode and larger text
• Colour-blind symbols on every ball
• Left-handed toolbar and a reduce-motion option
• Plays offline; a backup code moves your progress to a new phone

Seeds are earned by playing. Your progress stays on your device. Sharing anonymous game results to help balance the puzzles is optional and can be switched off at any time.

**Category:** Game → Puzzle · **Tags:** Puzzle, Casual, Logic, Brain games
**Contains ads:** Yes (optional rewarded videos, Google AdMob) · **In-app purchases:** No

### Data safety form (version 1.12.0)
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS)
- Do you provide a way for users to request that their data is deleted? **Yes** — in the app: Settings → Delete my shared stats (and the website Support page)
- Data types collected (all **optional**, **not shared** with third parties, **not processed ephemerally**):
  - **App activity → App interactions** — levels played, moves, hints, time. Purpose: **Analytics**.
  - **App activity → Other user-generated content** — answers to optional in-app surveys. Purpose: **Analytics**.
  - **Device or other IDs** — a random code created by the app (not the advertising ID). Purpose: **Analytics**.
- Is collection required or optional? **Optional** for all of the above (nothing is sent until the player taps "Share"; survey answers are optional).
- Data shared: **None** by Marblume itself.
- **Google AdMob (ads SDK) — add these too.** Collected **and shared** with Google, collected automatically when ads load (in the EEA/UK only after consent), encrypted in transit:
  - **Location → Approximate location** (from the IP address) — Advertising or marketing, Analytics, Fraud prevention, security and compliance.
  - **App activity → App interactions** (ad views and taps) — Advertising or marketing, Analytics.
  - **App info and performance → Crash logs, Diagnostics** — Analytics, Fraud prevention.
  - **Device or other IDs → Advertising ID** — Advertising or marketing, Analytics, Fraud prevention.
  See Google's guide: https://support.google.com/admob/answer/11128377

### App content
- **Privacy policy:** URL above
- **Ads:** **Yes, my app contains ads** (rewarded videos the player chooses to watch)
- **Advertising ID:** **Yes**, the app uses the advertising ID. Purposes: **Advertising or marketing**, **Analytics**, **Fraud prevention, security and compliance** (it comes from the Google Mobile Ads SDK)
- **App access:** All functionality available without special access (no login)
- **Content rating (IARC questionnaire):** Category "Game"; answer **No** to violence, sexuality, language, controlled substances, gambling, user interaction/communication, sharing location, digital purchases → expected rating **Everyone / PEGI 3**
- **Target audience:** choose **13+** (13–15, 16–17, 18+). Choosing under-13 brings in the Families policy and extra review; the game is still fine for all ages.
- **News app:** No · **Government app:** No · **Financial features:** None · **Health:** No

### Graphics
- App icon: `store/play/icon-512.png` (512×512)
- Feature graphic: `store/play/feature-graphic-1024x500.png`
- Phone screenshots (with headlines): `store/play/phone/` (1080×1920, 8 images)
- 7-inch tablet: `store/play/tablet-7in/` · 10-inch tablet: `store/play/tablet-10in/`
- Promo video: upload `store/video/promo-1920x1080.mp4` to YouTube (public or unlisted, ads off) and paste its link in *Main store listing → Video*.

### Before production (new personal developer accounts)
Google requires a **closed test with at least 12 testers for 14 days in a row** before you can publish to production. Upload the latest `Marblume-x.y.z.aab` from GitHub Releases to a closed testing track first, invite 12+ testers (friends' Gmail addresses or a Google Group), and keep it running for 14 days.

---

## App Store Connect

**Name (≤30):** Marblume: Ball Sort Puzzle
**Subtitle (≤30):** Hard colour sorting puzzles
**Promotional text (≤170):** 10,000 unique levels that start hard and get harder, frozen tubes, a daily puzzle calendar and 55 items to collect. Unlimited undo, no timers.
**Keywords (≤100):** ball,sort,puzzle,color,colour,marble,logic,brain,water,tube,daily,relax,hard,challenge,frozen
**Description:** use the Google Play full description above.
**Category:** Games → Puzzle (secondary: Games → Casual)
**Age rating:** answer **None** to every content question → **4+**. "Unrestricted web access": **No** (links open in Safari). "Advertising": **Yes** (optional reward videos, limited to General content).
**Copyright:** © 2026 Marblume
**Price:** Free · **In-app purchases:** None

### App Privacy ("nutrition label")
Choose **"Yes, we collect data"**, then:
- **Usage Data → Product Interaction** — used for **Analytics**; **not linked** to the user's identity; **not used for tracking**.
- **Identifiers → Device ID** — the random code the app creates (not the IDFA); **Analytics**; not linked; not tracking.
- **User Content → Other User Content** — optional survey answers; **Analytics**; not linked; not tracking.
These match `ios/App/App/PrivacyInfo.xcprivacy`. For **Google AdMob** (the optional videos) also add — Google's SDK ships its own privacy manifest for these:
- **Identifiers → Device ID** (the IDFA, only if the player allows tracking) — **Third-Party Advertising**, **Analytics**; **used for tracking: Yes**.
- **Usage Data → Advertising Data** and **Product Interaction** — **Third-Party Advertising**, **Analytics**.
- **Location → Coarse Location** (from the IP address) — **Third-Party Advertising**, **Analytics**.
- **Diagnostics → Crash Data, Performance Data** — **Analytics**.
The app asks for **App Tracking Transparency** permission (after Google's consent message where required) with the text in `Info.plist` → `NSUserTrackingUsageDescription`. Ads are limited to the **General** content rating, matching 4+. Players can report an ad in Settings → Report an ad (guideline 2.5.18).
See Google's guide: https://developers.google.com/admob/ios/privacy/data-disclosure

### Screenshots and app preview
- iPhone 6.9″ (required): `store/appstore/iphone-6.9in/` (1320×2868)
- iPad 13″ (required because the app runs on iPad): `store/appstore/ipad-13in/` (2064×2752)
- App preview (iPhone 6.9″/6.5″): `store/video/app-preview-886x1920.mp4` (29.5 s, 30 fps, H.264, AAC stereo)

### App Review information
- **Sign-in required:** No
- **Notes for the reviewer:**
  > Marblume is a puzzle game that plays fully offline; all 10,000 levels ship inside the app. No account and no purchases. Ads are optional rewarded videos (Google AdMob): the player is offered one only when free hints or the free extra tube are used up, after a win (to double seeds) or in the Shop (+20 seeds), can always choose "Not now" or spend seeds, and never sees ads between levels. On first launch Google's consent message appears where required, then the App Tracking Transparency prompt. Seeds are an in-game reward and cannot be bought. After three levels the app asks once whether the player wants to share anonymous game results (level, moves, hints, time) with a random app-generated code; nothing is sent unless they tap "Share", and Settings → Privacy can switch it off and delete it. An optional one-question survey may appear on the Home screen; it gives no rewards and never asks for an App Store rating. Tap Play on the home screen to start; Settings (gear icon) contains the privacy policy, support links, language and appearance.
- **Contact:** your name, phone and email (only visible to Apple)

### Export compliance
Already answered in the app (`ITSAppUsesNonExemptEncryption = NO`): the app only uses standard HTTPS provided by iOS, which is exempt.

---

## What's new in 1.12.3 (paste into both stores)
• Opens straight to Home, faster, with a sharp launch screen that matches Light and Dark

## What's new in 1.12.2
• Tap the level card on Home to start playing

## What's new in 1.12.1
• Fixes: video buttons now only appear when a video is ready

## What's new in 1.12.0
• Optional videos: watch one for a hint, an extra tube or bonus seeds — only when you choose, never between levels
• Settings → Ad choices and Report an ad
• Updated privacy policy

## What's new in 1.11.1
• Home now follows your Light, Dark or Automatic appearance setting

## What's new in 1.11.0
• A brand-new Home: your next level front and centre, with a live board, the next boss and your next flower
• Daily countdown and streak, Expert switch and your world path right on Home
• Liquid glass across the app, and faster screens on older phones

## What's new in 1.10.0
• A clean new look in solid colours: no colour blends anywhere
• Marbles and glass tubes drawn in crisp 3D, with a rim on every tube
• Daily Bloom fits on one screen on iPad in landscape

## What's new in 1.9.0
• 3D marbles and glass tubes that catch the light
• Clearer liquid glass across the app
• Faster and smoother, especially on older phones

## What's new in 1.8.0
• Expert play: no hints, no extra tubes, 5 undos a level and double seeds, plus a new badge
• Stuck? The next two levels are always open, so one hard level never blocks you
• Better layouts on iPad in portrait and landscape

## What's new in 1.7.0
• A lighter, glassier look: translucent buttons, a floating tab bar and softer sheets
• New, clearer icons throughout
• Respects Reduce Transparency and Increase Contrast settings

## What's new in 1.6.0
• Balls now fly between tubes, with glass sounds and a burst when a tube is finished
• Frozen tubes: a new twist from World 2
• Daily Bloom calendar: catch up on missed days and finish a month for a bonus
• 20 badges with seed rewards, and 4 new tube shapes in the Shop
• Relaxed play, dark mode, larger text and 7 languages
• Back up your progress with a code and restore it on a new phone
• Bigger, clearer boards on tablets and computers
