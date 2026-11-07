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

### Strava

Rides come from Strava once you connect (Training → **Connect Strava**); until then the app shows the sample data. The client secret lives only on the server: two Expo Router API routes (`src/app/api/strava/token+api.ts`, `refresh+api.ts`) exchange and refresh tokens. Tokens are kept in SecureStore; rides are cached in `strava-cache.json` in the app's documents folder, and each sync asks Strava only for rides newer than the last one.

1. Create an API application at https://www.strava.com/settings/api. New apps are limited to one athlete (you), which is fine here.
2. Set **Authorization Callback Domain** to `localhost`. The app redirects to `maunakea://localhost/strava` (dev and release builds) or `exp://localhost:<port>/--/strava` (Expo Go), and Strava accepts any redirect whose host is `localhost`.
3. `cp .env.example .env.local` and fill in `EXPO_PUBLIC_STRAVA_CLIENT_ID`, `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` from that page. `.env.local` is git-ignored.
4. Run `npx expo start` and connect. Metro serves the API routes, so nothing else is needed locally.
5. Release builds use the routes on EAS Hosting at https://mauna-kea.expo.app (EAS project `@kyu474/mauna-kea`). The production EAS environment holds `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` (secret), `EXPO_PUBLIC_STRAVA_CLIENT_ID` and `EXPO_PUBLIC_API_ORIGIN`. Local Release builds get the origin from the committed `.env.production`. To redeploy after changing the routes:
   ```bash
   npx expo export --platform web --no-ssg
   npx eas-cli@latest deploy --prod --environment production
   ```
   To change a variable: `npx eas-cli@latest env:set --environment production --name <NAME> --value <value> --visibility <plaintext|secret>`, then redeploy.

FTP (242 W), weight (72 kg unless Strava returns one) and heart-rate zones are constants in `src/data/strava.ts` for now; reading the athlete's own needs the `profile:read_all` scope. Daily kJ targets, the plan weeks and nutrition still come from the sample.

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
  app/strava.tsx       connect / disconnect Strava (modal)
  app/api/strava/      token exchange and refresh (server only)
  data/sample.ts       all sample data
  data/training.ts     the data shape screens read, and the sample fallback
  data/strava.ts       Strava session, on-device ride cache, mapping to that shape
  server/strava.ts     server-side token helper (holds the client secret)
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

1. Real data: Strava rides are in (see above); a food log store is next.
2. Targets engine: daily kJ and macro targets from the training plan.
3. TestFlight build.
