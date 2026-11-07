# Building it

## Where the tokens live

`docs/design/tokens.json` is the source. `npm run tally` writes `app/src/design/tally.ts` from it (colours per theme, spacing, radii, stroke and control sizes, type styles), and `npm test` fails when the two differ. The app reads colours through `src/lib/theme.ts`: `useTally()` gives the Tally names, `useColors()` still gives the old names (mapped onto Tally) until every screen is rebuilt. The website's own pages (the privacy pages) use `web/css/tally.css`, which `npm run tally` writes from the same tokens: light and dark follow the device.

## iPhone (Expo, `app/`)

- Tabs: `NativeTabs` from `expo-router/native-tabs` (stable and in Expo Go since SDK 58). `NativeTabs.BottomAccessory` holds Now Lifting; `usePlacement()` switches it between the regular and inline layouts. Search is pushed from the magnifying glass in each tab root’s large title. `minimizeBehavior="onScrollDown"`.
- Symbols: the app already draws SF Symbols and Material Symbols through `expo-symbols` (`Icon` in `src/ui/kit.tsx`); add the names Tally uses there.
- Sheets and menus: native where they exist (form sheets with detents, context menus). The keypad and the effort picker are drawn by the app.
- Live Activity and Dynamic Island for the session and rest: `expo-widgets` (needs a development build, not Expo Go). The countdown is drawn by the system.
- Haptics: `expo-haptics`, mapped as in Motion.

## Android

- The same `NativeTabs` give the Material bottom bar; keep Today, Plan and Progress, with Search in each root’s title. TrueTrain joins once the store apps are live.
- Material Symbols through `expo-symbols`. Roboto through the system.
- Rest: the scheduled notification with a countdown chronometer (no Live Activity).
- Predictive back and edge-to-edge are on; the Action bar respects the gesture inset.

## The web build (the open web app)

- The same app, built by Expo for the web (react-native-web): the same tokens through `useTally()`; JS tabs drawn like the native bar (`(tabs)/_layout.web.tsx`).
- `glass` with `backdrop-filter` stands in for Liquid Glass; fall back to `paper-2` where it isn't supported.
- A web app can't run timers with the phone locked, so offer Keep screen on during a workout and a mostly black rest screen in dark themes to save power.
- On a wide window the app is the phone layout in a centred column, at most 600 px wide, on `paper` (`app/src/app/_layout.tsx`). Tab bar, Now Lifting, the Action bar and the keypad stay inside it; dialogs, sheets and toasts dim and centre on the whole window (one overlay host at the root on the web). The page behind the app is `paper` too (`+html.tsx`).
- Published at `increment-training.app` (`docs/dev/architecture.md` → "The website"). It installs from the browser (Add to Home Screen on iPhone, Install app in Chrome) with the app's icon, opens standalone, and works offline after the first visit. The browser's bar takes `paper` (white, black in dark).
