# Browser tests

End-to-end suites that drive the app's web build in an emulated iPhone 13 (Playwright, Chromium). The unit tests for the shared core are separate: `npm test` in the repo root.

```sh
node tests/browser/run.mjs                    # every suite (runs `expo export` first; a few minutes from a fresh clone)
node tests/browser/run.mjs app-logging app-tabs   # single suites
node tests/browser/run.mjs --no-build         # reuse app/dist
```

The runner serves `app/dist` on :8790 itself, runs `npm ci` in `app/` if needed, downloads the sample Strong export into `data/` and builds a fresh backup from it before the suites. Screenshots land in `.out/<suite>/`. `data/` and `.out/` are git-ignored.

## Setup

- Node 22.13 or newer (Expo SDK 58).
- Playwright: `env.mjs` uses a local install (`npm install` in this folder installs the version pinned in `package.json`, the one CI uses) or a global one (cloud containers often have one at `/opt/npm-tools`).
- Chromium: Playwright's own if it matches, otherwise any `chromium-*` under `$PLAYWRIGHT_BROWSERS_PATH`, `/opt/pw-browsers` or `~/.cache/ms-playwright`, or the path in `$CHROMIUM`. With none installed: `npx playwright install chromium` (needs access to Playwright's download host).
- Network for the app suites: the npm registry (`npm ci`) and `raw.githubusercontent.com` (the sample export, 86 workouts from a public Strong export, not committed because its licence is unknown).

## In CI

The `browser` job in `.github/workflows/test.yml` runs every suite on every push and pull request: `npm ci` in `app/`, `npm install` here, `npx playwright install --with-deps chromium` (the browser and the Linux libraries it needs), then `node tests/browser/run.mjs`. When a suite fails, `.out/` is attached to the run as the artifact `browser-test-screenshots` (kept 14 days): open the run on GitHub, then Artifacts at the bottom of its summary. The job takes about 4 minutes (3 of them the suites).

When you update Playwright, change the version in `package.json` here; the suites have to pass with it locally first.

## Suites

| Suite | Checks | What it covers |
|---|---|---|
| `app-first-start` | 15 | first start, restore a Setlog backup (Account), every screen with data, live theme/language/unit switches, Strong import |
| `app-logging` | 22 | logging a workout end to end in the Tally session: Log button, keypad, captions in the boxes (English and German), rest bar and "Reps left?" (0 · 1 · 2+, 0 = Failure both ways), set types and the set's ⋯, supersets, Up next (switch and drag), minimize and reload, reorder, finish early, screen not kept on, the summary tally; the routine after a workout: better numbers saved without asking (not worse ones), the layout popup with Update routine and Keep routine, Undo, the setting off (German and English) |
| `app-editing` | 22 | template editor and menus on Plan, folders, shared links, Edit workout, focus metric, plates and 1RM, start time, new exercises, the exercise page (hero number, chart, range, rep maxes, history), Body, Progress and backups, settings |
| `app-parity` | 13 | History calendar (light, dark, German), Merge into another exercise, Warm-up sets and ⋯ → Add warm-up sets, the name row, Delete all data, template links that open the app, Settings → Privacy policy |
| `app-design-bugs` | 4 | design group 1 in light/dark and English/German: regular month-start labels across every exercise range with three years of data, Account links and titles (375/390 px), keyboard focus around all three search capsules; also captures the affected screens |
| `app-tabs` | 10 | the tabs with the store demo data: Today (Up next, week strip and sets per muscle against the core), Now Lifting (rest, Skip, every tab), Plan's + menu, the Progress hub and its pages, Search focused on open, the Account sheet, German and dark, "routine" instead of "template" everywhere the app says it, in English and German, and dark controls (the chosen segment at 3:1 or more against its track, a dim knob on a switch that's off) |

`make-backup.mjs` is a helper, not a suite: it builds a backup from the core in plain Node, the sample export over the built-in library, a "Pull" routine in an "Upper / Lower" folder, two body weights, Intense Red, German and the name "Laurin", and writes `data/setlog-backup.json`. It's the same file the Setlog web app used to make, so the suites also prove that a Setlog backup restores in Increment. The app suites restore it (`restore(page, dialogs, { english: true })` in `app-editing.mjs` switches to English afterwards).

## Writing tests

- Every suite imports from `env.mjs` (`launch`, `devices`, `APP`, `shots`, `grantWakeLock`, data paths), counts its checks with `ok(...)` and ends with `console.log(\`\n${passed} checks passed\`)`, which the runner reads. Add a new suite to `APP_SUITES` in `run.mjs`.
- Each scenario collects `pageerror` and console errors and ends with `assert.deepEqual(errors, [])`.
- Contexts call `await ctx.addInitScript(grantWakeLock)` (headless Chromium denies the Screen Wake Lock, and expo-keep-awake then logs an error a phone never shows). testIDs become `data-testid`, so use `page.getByTestId(...)`. Hidden tabs stay mounted on web: check rows by testID, not the whole page text, and keep testIDs unique across tabs (Search has `exercise-*`, Lifts `lift-*`). The tabs are `tab-index` (Today), `tab-plan`, `tab-progress` and `tab-search`; the web build has JS tabs for them (`app/src/app/(tabs)/_layout.web.tsx`), the phone native ones. Settings are in Account: `open-account` (the avatar on Today), closed with `page.goBack()` or `account-done`. Progress opens Workouts (`progress-workouts`), Lifts, Records and Body. An empty workout starts from Today (`start-empty`, when nothing is suggested) or from Plan's + (`plan-add`, then `start-empty`). Pushed screens hide the tab bar, so `page.goBack()` before switching tabs. App data is in `localStorage['increment.data']`.
- Timing: overlays fade in for 180 ms, so wait before screenshots.

## Screenshots for review

Laurin reviews changes by looking at them, so a pull request that changes the UI comes with before/after screenshots of the screens it touches: light and dark, and German where text changed. Serve both versions side by side and screenshot the same screen in each with a short script that imports `launch` and `devices` from `env.mjs`:

```sh
git worktree add ../before origin/main                # the version before your change
(cd ../before && APP=http://localhost:8791 node tests/browser/run.mjs --serve) &
node tests/browser/run.mjs --serve &                   # yours on :8790
```

The worktree needs its own `npm ci` in `app/` (the runner does it).

## Store screenshots

```sh
node tests/browser/run.mjs app-store-shots     # builds and serves the app, then writes tests/browser/.out/store/
node tests/browser/store-frame.mjs <folder>    # frames your own screenshots the same way (add --store play for Google Play)
```

`app-store-shots.mjs` isn't a test suite (CI doesn't run it). It loads the demo data from `store-demo.mjs`, not the test backup:
- 16 weeks of a 4-day upper/lower split up to yesterday, with steady progression and one deload week (half the sets at the same weights, so the charts don't dip);
- no personal name.

It takes six screens in English and German: a running workout with last time's numbers, the rest timer, an exercise's 1RM chart, the History calendar, Today with the suggested workout, and Progress.

What it writes, into `tests/browser/.out/store/` (git-ignored):
- the bare screens in `raw/`;
- the framed ones for the App Store (6.9″, 1320 × 2868) and Google Play (phone, 1080 × 1920): black background, a headline above the screen;
- the 1024 × 500 Play feature graphic, from `app/assets/images/icon.png`.

The headlines are in `store-captions.mjs`, one per screen and language. `store-frame.mjs` adds them, so screenshots from the iOS Simulator or a phone get the same look: name them `<lang>-<n>….png` (`en-1.png`, `de-3-chart.png`; n is the screen 1–6 and picks the caption), put them in a folder, and run it on that folder. The framed copies land in `<folder>/framed/`.

Store screenshots have to show the real app, and the web build differs from it:

- **Icons:** the app uses SF Symbols on iPhone and Material Symbols on Android and the web. The web screenshots show the Android icons.
- **Font:** the browser's sans-serif (Inter in the cloud container, whatever is installed elsewhere), not SF Pro (iPhone) or Roboto (Android).
- **No status bar or home indicator.** Both stores accept that, but a phone screenshot has them.
- **The running workout** is a full screen in the web build; on iPhone it's a page sheet with the screen behind it showing at the top.

So the Play screenshots from the web build are close to the Android app (icons match; only the font differs), and the App Store screenshots are drafts for layout and text. For the final App Store set:

1. Make the demo data a backup file with `node tests/browser/store-demo.mjs en > store-demo-en.json` (or `de`). Drag it onto an iPhone with a 6.9″ screen in the iOS Simulator to save it to Files, and restore it under Settings → Restore from backup.
2. Open the same six screens and run `xcrun simctl io booted screenshot en-1.png` for each.
3. Frame them with `store-frame.mjs`.
