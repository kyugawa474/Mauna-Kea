# Mauna Kea

A training-and-fuel app for the Sea to Stars ride up Mauna Kea (Dec 20, 2026).

- **Today**: the sun is the energy you burned on the bike today, and its size is the kJ.
  - Pull down to draw the power rays. Each ray is 4 W, and its length is the time you spent at that power.
  - The water under the frost is refuelling. It's sized to today's kJ target.
  - Swipe up to draw the three macro goal rings (carbs, protein, fat).
  - Swipe left or right to change day.
- **+**: log food from your recent foods. Closing the panel animates the numbers and rings.
- **Training**:
  - Weekly kJ against target, in pages.
  - Variability, average per week, and this week.
  - Time in zone from real Strava rides.
  - Consistency grid.
  - Activity log.

**Milestone 1** is screens plus sample data. There's no login and no live Strava or food data yet. Everything comes from `src/data/sample.ts`.

---

## Run it on your iPhone (quickest: Expo Go)

You need a Mac with [Node.js 20+](https://nodejs.org) and the **Expo Go** app on your iPhone (App Store).

```bash
git clone https://github.com/kyugawa474/Mauna-Kea.git
cd Mauna-Kea
npm install
npx expo start
```

Scan the QR code with the iPhone camera. It opens in Expo Go. Your phone and Mac must be on the same Wi-Fi. If they can't see each other, run `npx expo start --tunnel`.

Edits you save on the Mac reload on the phone instantly.

## Run it from Xcode (Simulator or a cable-connected iPhone)

You need Xcode from the Mac App Store. Open it once to install its components.

```bash
npx expo run:ios            # builds and opens the iOS Simulator
npx expo run:ios --device   # pick your iPhone, connected by USB
```

This generates an `ios/` folder and builds it with Xcode. You can also open `ios/MaunaKea.xcworkspace` in Xcode and press ▶.

For a real iPhone:
- Sign in under Xcode → Settings → Accounts with your Apple ID (a free one works).
- Pick your team under Signing & Capabilities.
- On the phone, trust the developer under Settings → General → VPN & Device Management.

Free-account builds expire after 7 days. When you want a lasting install (or to share builds), use TestFlight via `npx eas-cli build` and `npx eas-cli submit`. That needs the $99/yr Apple Developer Program.

`ios/` is generated, so don't edit it by hand. Change `app.json` instead, then run `npx expo prebuild --clean`.

## Development

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
```

To preview the three Thursday states (start, mid, end of day), long-press the date label on Thursday.

### Layout

```
src/
  app/                 Expo Router routes
    _layout.tsx        fonts, gesture root, app state
    (tabs)/_layout.tsx tab navigator, custom nav bar, + panel
    (tabs)/index.tsx   Today
    (tabs)/training.tsx
  components/
    today/             SunCanvas (sun + power rays), FrostCanvas (water + macro rings), WeekStrip
    training/          WeeklyBars, ZoneGraph
    NavBar.tsx, AddPanel.tsx
  data/sample.ts       all sample data
  lib/frost.ts         the frost-edge model that drives the Today screen
  state/AppState.tsx   selected day, food log, committed totals
  theme.ts             colours, fonts, design-px scaling
```

The design was drawn on a 390 × 844 frame. Positions are kept in "design px" and scaled by `width / 390`.

### Stack

- Expo SDK 58 (React Native 0.88)
- Expo Router
- Reanimated 4
- Gesture Handler 3
- React Native Skia, for every drawn graphic
- Inter Tight and IBM Plex Mono

## Next milestones

1. Real data: Strava OAuth for rides and zones, and a food log store.
2. Targets engine: daily kJ and macro targets from the training plan.
3. TestFlight build.
