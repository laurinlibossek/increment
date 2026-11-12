# Browser tests

End-to-end suites that drive the app's web build in an emulated iPhone 13 (Playwright, Chromium). The unit tests for the shared core are separate: `npm test` in the repo root.

```sh
node tests/browser/run.mjs                    # every suite (runs `expo export` first; a few minutes from a fresh clone)
node tests/browser/run.mjs app-logging app-tabs   # single suites
node tests/browser/run.mjs app-english-only    # shipped English-only behavior
node tests/browser/run.mjs app-web-site        # the published website: offline, installable, deep links
node tests/browser/run.mjs --no-build         # reuse both language exports
```

The runner serves the app on :8790 itself, runs `npm ci` in `app/` if needed, downloads the sample Strong export into `data/` and builds a fresh backup from it before the suites. Screenshots land in `.out/<suite>/`. `data/` and `.out/` are git-ignored.

`app-english-only` tests the shipped build in `app/dist`: English UI regardless of the browser locale or saved/restored language, dates and numbers in the phone's region ("Friday, 6 November", "82,4 kg" for de-DE), and Language hidden in Account. The existing suites run against a separate export in `.out/german-app`, built with `EXPO_PUBLIC_ENABLE_GERMAN=1` (the setting behind `ENABLE_GERMAN` in `app/src/lib/i18n.ts`). No source file is edited, so an interrupted run can't leave German switched on. Both exports use `--clear`, because Metro would otherwise reuse transforms with the other value inlined. `app-web-site` also runs on `app/dist`: it builds the website from it into `.out/site` and serves that itself, with the service worker.

`--no-build` reuses each export separately (and builds a missing one). `--serve` only serves the normal English `app/dist` build, for review screenshots. Stop a server already running on :8790 before running tests, so they cannot accidentally use the wrong language build.

`app-tab-swipe` uses native CDP `Input.dispatchTouchEvent` (`touchStart`, several `touchMove`s, `touchEnd`). `Input.synthesizeScrollGesture` with `gestureSourceType: "touch"` does not scroll in headless Chromium here, even in a plain HTML scroller; the same failure occurred on Ubuntu CI. No DOM-created touch/pointer events or pager handlers move the scroller: browser scrolling and CSS scroll snap do it. The suite reads `scrollLeft` after a move and before release, checks the final page boundary, and checks a partial swipe moves then snaps back.

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
| `app-web-site` | 8 | the published website (`scripts/web-site.mjs`, built from `app/dist`) served like GitHub Pages on :8792: manifest and icons on every page, `/exercise/<id>` and `/measure` with and without the service worker, Chrome's installability check, Today, an exercise and the privacy policy offline with no request reaching the server, a new deploy replacing the cache; `/get-started` with each device's steps first (iPhone, Android, computer), Install when the browser offers it, the link preview, `/getstarted` forwarding and the jump to the app from the home screen; the privacy pages in light and dark with the email written in and no Setlog |
| `app-english-only` | 10 | shipped English UI, exercise names and date/number formatting across browser languages, saved preferences and a real Setlog backup restore; hidden Account language choices and reload persistence |
| `app-tab-swipe` | 18 | browser-owned CDP touch scrolling from cards/rows in light/dark: finger-following offsets, half-swipe snap-back, both ends, working taps, separate vertical offsets, smooth/reduced-motion bar taps, chart scrubbing, fixed Now Lifting, direct /plan, Back/Forward and pushed Search |
| `app-family-creation` | 21 | saving exact-base exercises into built-in/custom families, Keep separate, custom-family counts and chips with isolated histories, Variation of family/exercise choices and None with the current choice ticked, the Strong review naming a custom family, a real backup download/restore and reload, Cancel with no persisted changes, failed-storage retry and a nested session picker; English light/dark review at 390 px |
| `app-families` | 19 | Search families/counts/body-part filters, exact query results, last logged opening, sibling movement/equipment chips with separate histories and no extra Back entries, hidden members, inline multi-pick, Replace in the session and both editors, exact names, split headers and a 400-exercise placeholder; English light/dark review at 375 px |
| `app-storage` | 15 | the move from localStorage (read back before the original goes; a stale copy, a failed first try with a half copy, unreadable data with Save the old data and Start empty), failed saves (no success message, the warning with Retry and Back up now, the changes kept), recovery backups with the running workout (a fresh install, a different workout running), Finish in one transaction, two tabs (different records, a stale save of the same settings, running workout and routine editor held for review, Keep mine and Use the saved version, catching up after a missed message, delete, Finish and Delete all data not undone) |
| `app-live-records` | 4 | records while lifting (#37): three equal sets above the old best are one record in the session, its notes and ticks; a better set takes it over and gives it back when unchecked; Today's card, Now Lifting, the summary and History count the same |
| `app-set-counts` | 3 | set counts without warm-ups (#38): four logged warm-ups are 0 of 5 in the session, on Today and in Now Lifting (at working set 1 of 3, "warm-up set" before); Now Lifting follows a jump to another exercise; Finish, the summary, the Workouts row and the workout page say 5 sets |
| `app-superset-remove` | 3 | removing from a superset (#39): one of two leaves the partner without "Superset A" at once, Undo restores both in place; one of three keeps the other two; deleting an exercise from the library dissolves the group it leaves alone in a routine |
| `app-one-rm` | 2 | estimated 1RM above 12 reps (#41): with Brzycki set, the calculator gives 144 for 100 × 12 and 44 (Epley) for 20 × 36 and names the formula used; the exercise page shows 44 and its Chart menu mentions Epley above 12 reps |
| `app-progress-account` | 4 | Progress's Account avatar (#30) beside Search at 375 px, without a name (person symbol, "Account") and with one (its initial on Today and Progress), opening Account; the web app's wording (#42): Account's storage line without phone or iCloud, the empty Workouts screen pointing to Account, deleting an exercise that is only in the running workout |
| `app-chart-metric` | 4 | exercise charts (#27): Bench Press opens on Heaviest weight, Pull Up on Most reps; the chart chosen for Bench Press stays across other exercises, revisits and a reload; a downloaded backup carries it and a restore in a fresh browser brings it back; deleting an exercise drops its chart |
| `app-keypad-drag` | 7 | dragging the keypad down (#31), with CDP touch, and its fields keeping Safari's keyboard down (`inputmode="none"`, #25; Tools keeps its number keyboards): it follows the finger, a short drag springs back, a long one or a flick closes it and the Action bar returns, from the handle or the title; sliding over the keys leaves it open; a tap on the handle and a mouse drag close it; light and dark (mid-drag screenshots) |
| `app-plan-rows` | 4 | Plan's routine rows (#32) at 375 px, light and dark: three exercise names and "& 2 more", then muscles · working sets · about how many minutes · last done; "not done yet" for a new routine and one in a folder; 30 routines; examples without last done |
| `app-ready-weight` | 7 | "Weight increase recommended" (#49): the routine page marks a barbell exercise and an assisted one (less assistance), not reps-only or unranged ones; the next session shows it; 85 × 8 next time raises the routine and clears it (and a skipped exercise isn't ready); the editor explains a missing range, and a heavier prescription clears every mark; none with "Update routines after workouts" off; German; light and dark |
| `app-set-rows` | 10 | the set rows (#48): one "Set kg Reps" header ("Set Time" for a plank, "Set km Time" for a run, "Set lb Reps" in lb, "Satz kg Wdh." in German); labels W 1 2 D open the set's menu and read "Warm-up set", "Drop set"; no ⋯; the tick logs and un-logs; "+1 rep", "Record", "−0:15" and "+0.5 km" beside logged sets, nothing for warm-ups or an unchanged set; pinned note → exercise note → header; the routine editor has no ticks; light and dark at 375 pt |
| `app-paired-sets` | 14 | left/right sets (#54): Side only on unilateral exercises (Concentration Curl yes, Bench Press no, a bench set already tagged keeps it); the exercise form's Unilateral switch, on and locked for Side Plank, toggled on (survives a reload) and off for Leg Extension, on for a custom exercise; pairs in Sets per muscle, Plan ("5 sets · 3 unpaired"), the routine page, the workout page and the summary ("6 sets · 2 unpaired"); "Count left/right sets together" off counts rows and leaves Sets per muscle alone; Strong data without sides counts every set; starting such a routine splits each set into Left and Right (saved) with last time's numbers on both, no Clear, Add set goes on Left; the CSV merges pairs (3 rows on, 4 off); German; light and dark at 375 pt |
| `app-set-rest` | 11 | the rest under the set (#53): "Barbell · Chest · Rest 1:30" under the name, a tap sets 2:00; logging puts a draining line under the set with the time left, in step with the Action bar through −15, +15, a reload, Skip and a 3-second rest running out; the next set takes it over, deleting it or switching exercises leaves none; a superset's rest under the round's last set; Reduce Motion steps it (two readings within a second match); light and dark at 375 pt |
| `app-next-exercise` | 9 | stay on a finished exercise (#60): the last set keeps it on screen with "Next: Squat (Barbell)"; one more set stays again; the button moves on; with a rest, "Next: …" in the rest bar, and the rest running out doesn't move the screen; a superset stays after its round, and Next in the rest bar moves on while the rest runs; "Finish workout" after the last; German "Weiter: Bankdrücken (Langhantel)" for a skipped earlier exercise, and Now Lifting names it; light and dark at 375 pt |
| `app-rep-ranges` | 8 | rep ranges on a routine's sets (#44): Today ("× 8–10") and the routine page ("80 × 8–10"); the running workout's "8–10 reps" chip, last time's reps as the ghost, the range on the keypad; Finish moves the targets to 9 and 10 for 9 and 12 reps and keeps 8–10, the workout stores 12 and no range; the editor shows 8–10, refuses 10-8, saves 10-12 and a plain number; German; light and dark |
| `app-pinned-note` | 5 | a routine's pinned note (#33): pinned from the running workout (shown at once, saved on the routine), shown and edited on the routine page (the running workout follows), removed in the routine editor, saved with Edit workout, shown at the next start in German; none for an empty workout or an example |
| `app-strong-review` | 22 | exact counts, spelling preselection, session counts, compatible suggestions and manual picker, required body part, editable names, logged-field categories, exact family grouping, Cancel (“Discard changes?” after a change, Keep editing keeps the choices; at once without one), actual import, reload, an already-imported file answered at once without the review, newer exports, backup/restore and retry after a storage failure; English/German light/dark screenshots |
| `app-exercise-catalogue` | 7 | first start, v1 catalogue upgrades, renamed/hidden built-ins, custom-name collisions with unchanged history/routine references, persisted reloads, real file-chooser backup restore and new entries in the unchanged Search/exercise pages |
| `app-first-start` | 15 | first start, restore a Setlog backup (Account), every screen with data, live theme/language/unit switches, Strong import |
| `app-set-sides` | 37 | sides on a unilateral exercise (#54): the routine's set without a side starts as Left and Right (saved in the routine), side-aware grey values, Side after effort with Left/Right only (no Clear), Add set goes on L, R, L, sides in row and tick labels, Finish/Update routine/restart, workout footnotes, the routine and workout editors, duration support and cardio exclusion; English/German light/dark at 390 px |
| `app-logging` | 23 | logging a workout end to end in the Tally session: Log button, keypad, the "Set kg Reps" header (English and German), rest bar and "Reps left?" (0 · 1 · 2+, 0 = Failure both ways), set types from the set's label (W, 1, D, F) and its RIR note, supersets, Up next (switch and drag), minimize and reload, reorder, finish early, screen not kept on, the summary tally; the routine after a workout: better numbers saved without asking (not worse ones), the layout popup (Keep routine first; Update routine asks again, Go back changes nothing), Undo, the setting off (German and English) |
| `app-editing` | 22 | template editor and menus on Plan, folders, shared links, Edit workout, focus metric, plates and 1RM, start time, new exercises, the exercise page (hero number, chart, range, rep maxes, history), Body, Progress and backups, settings |
| `app-parity` | 13 | History calendar (light, dark, German; only the month's own days are drawn), Merge into another exercise, Warm-up sets and ⋯ → Add warm-up sets, the name row, Delete all data, template links that open the app, Settings → Privacy policy |
| `app-design-bugs` | 4 | design group 1 in light/dark and English/German: regular month-start labels across every exercise range with three years of data, Account links and titles (375/390 px), keyboard focus around all three search capsules; also captures the affected screens |
| `app-workouts-list` | 15 | design group 3: Tally Workouts rows in English/German and light/dark, record sets and strokes, month counts and pagination, dates, translated exercise line with full bracketed variations and wrapping, 375/390/1280 px widths, navigation, and the calendar's selected day as a heading over the same row; before/after review screenshots |
| `app-list-style` | 20 | design group 4 in English/German and light/dark: full-width Account, Body and routine rows with hairlines and Title 2 sections; Account title/value wrapping at 375/390 px and preserved controls; name-only empty measurements, routine targets and notes, and Plan rows with a working menu and no chevron; before/after review screenshots |
| `app-main-actions` | 25 | design group 5 in English/German and light/dark: Account entered from Today with Done as its only close control, Warm-up Cancel and ordinary detail Back preserved; routine Title 1 and wrapping; fixed routine/Body action bars with scrolling content and reachable last rows, actual workout start and body-weight logging, example saving and the 600 px desktop column; before/after review screenshots |
| `app-progress-noise` | 22 | design group 6 in English/German and light/dark: neutral exercise stats and rep maxes with retained hero/chart record signal, Records headline metric and other-record counts with complete titles/subtitles/values at 375 px, singular/plural counts and past-year dates, preserved 30-day Progress figures (records counted as record sets, the same as the Workouts row) and Body measurement with working count-free navigation; before/after review screenshots |
| `app-number-format` | 12 | design group 2 in English/German and kg/lb: full single-workout volumes (including above 100,000) in history, workout, summary and shared text; h:mm figures in history/calendar; estimated 1RM precision (including the calculator and rounding boundaries), actual logged weight precision (also the exercise page's Heaviest weight) and contextual set-row units; realistic before/after review screenshots in light/dark |
| `app-tally-scale` | 100 | design group 9 in English/German and light/dark: readable prose, SVG chart labels and typed fields at 4.5:1 against their backgrounds, with line heights no looser than Tally's (1.45 × the size); token type/radii in calculators and overlays; 1RM placeholders/hints; kg/lb ghost plates, typed overrides and clear fallback; older forms, picker header at 375/390 px with disabled/enabled Add, Account, calendar, Warm-up, measurement/history, editors, Plan and session/reorder; before/after review screenshots |
| `app-tabs` | 14 | the tabs with the store demo data: Today (Up next, week strip and sets per muscle against the core), three tabs in order; Now Lifting (rest, Skip, one per root, absent on pushed Search and restored after Back), Plan's + menu, the Progress hub and its pages, Search icons on every root with 44 pt hit areas and accessible labels, focus on push and Back to the originating tab, a reload on Search with Back to Today; + and empty-state creation, the Account sheet, German and dark, "routine" instead of "template" everywhere the app says it, in English and German, a 1280 px window (the app in a centred 600 px column, a menu dimming the whole window), and dark controls (the chosen segment at 3:1 or more against its track, a dim knob on a switch that's off, every part of a switch that's on at 3:1 or more against the page) |

`make-backup.mjs` is a helper, not a suite: it builds a backup from the core in plain Node, the sample export over the built-in library with explicit fixture decisions retaining the old custom names, a "Pull" routine in an "Upper / Lower" folder, two body weights, Intense Red, German and the name "Laurin", and writes `data/setlog-backup.json`. It's the same file the Setlog web app used to make, so the suites also prove that a Setlog backup restores in Increment. The app suites restore it (`restore(page, dialogs, { english: true })` in `app-editing.mjs` switches to English afterwards).

## Writing tests

- Use `selectTab(page, 'index' | 'plan' | 'progress')` from `env.mjs` when a flow taps the tab bar, then uses that page. It clicks the real bar and waits for the settled address/selection. All three roots stay mounted, so a testID being visible does not mean its tab is active; Playwright's automatic scroll-into-view can interrupt an unfinished smooth tab scroll. The motion suite deliberately uses raw bar clicks so it can observe the animation itself.
- Every suite imports from `env.mjs` (`launch`, `devices`, `APP`, `shots`, `grantWakeLock`, data paths), counts its checks with `ok(...)` and ends with `console.log(\`\n${passed} checks passed\`)`, which the runner reads. Add a new suite to `APP_SUITES` in `run.mjs`.
- Each scenario collects `pageerror` and console errors and ends with `assert.deepEqual(errors, [])`.
- Contexts call `await ctx.addInitScript(grantWakeLock)` (headless Chromium denies the Screen Wake Lock, and expo-keep-awake then logs an error a phone never shows). testIDs become `data-testid`, so use `page.getByTestId(...)`. Hidden tabs stay mounted on web: check rows by testID, not the whole page text, and keep testIDs unique across tabs (Search has `exercise-*`, Lifts `lift-*`). The three tabs are `tab-index` (Today), `tab-plan` and `tab-progress`. Search is a pushed screen: use the shared `openSearch(page)` helper from `env.mjs`, which taps the accessible root's `open-search-index`, `open-search-plan` or `open-search-progress` icon and waits for `exercise-search`. Back returns to that same tab; return from Search before switching tabs. Now Lifting stays on the tab roots and is absent from Search. The web build has JS tabs (`app/src/app/(tabs)/_layout.web.tsx`), the phone native ones. Settings are in Account: `open-account` (the avatar on Today), closed with `page.goBack()` or `account-done`. Progress opens Workouts (`progress-workouts`), Lifts, Records and Body. An empty workout starts from Today (`start-empty`, when nothing is suggested) or from Plan's + (`plan-add`, then `start-empty`). Pushed screens hide the tab bar, so `page.goBack()` before switching tabs. App data is in IndexedDB (`increment`); suites still seed it as `localStorage['increment.data']` in an init script, which the app moves in on its first start and ignores afterwards. Read it with `storedData(page)` or `waitStored(page, (d) => …)`, replace it with `writeStored(page, data)` (then reload), and make storage refuse writes with `failWrites(page)` (all from `env.mjs`). A page reload drops changes storage hasn't saved, as in any web app, so move around inside the app while writes fail.
- Nested picker flows leave the outer picker mounted. Wait for the visible inner title and scope shared picker testIDs with `.filter({ visible: true })`; session drafts reach durable storage after the store’s debounce.
- Timing: overlays fade in for 180 ms, so wait before screenshots.

## Screenshots for review

Laurin reviews changes by looking at them, so a pull request that changes the UI comes with before/after screenshots of the screens it touches: light and dark, and German where text changed. Serve both versions side by side and screenshot the same screen in each with a short script that imports `launch` and `devices` from `env.mjs`:

```sh
git worktree add ../before origin/main                # the version before your change
(cd ../before && APP=http://localhost:8791 node tests/browser/run.mjs --serve) &
node tests/browser/run.mjs --serve &                   # yours on :8790
```

The worktree needs its own `npm ci` in `app/` (the runner does it).

Family-creation captures use `APP=http://localhost:8791 node tests/browser/review-family-creation.mjs --before` against the main worktree, then `node tests/browser/review-family-creation.mjs` against this branch. Both use the same fixture and steps at 390 CSS px in English, light and dark. The old Save had no question, so its corresponding capture shows the exercise page reached immediately. The picker comparison shows the existing Add exercises picker before and the new Variation of mode after.


Tab-pager motion review: serve the web build with `node tests/browser/run.mjs --serve`, then run `node tests/browser/review-tab-pager.mjs` (set `APP` for another port). It records English light/dark MP4 clips under `.out/review-tab-pager/`: card/row swipes, a half swipe snapping back, vertical scroll and another swipe. The gray contact marker exists only in the recording script and never takes input.

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
