<p align="center">
  <img src="app/assets/images/icon.png" width="88" height="88" alt="">
</p>

<h1 align="center">Increment</h1>

<p align="center">
  A free, open-source workout tracker built around progressive overload.<br>
  Log your sets, see what you lifted last time, and watch your numbers go up.
</p>

<p align="center">
  <a href="#try-it">Try it</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#how-its-built">How it's built</a>
</p>

## Why Increment

Most workout trackers put their best features behind a subscription or want an account before you log a single set. Increment doesn't:

- **Free.** Logging, history, charts and records cost nothing and show no ads. If a paid coaching add-on comes to the store version, it never locks your own numbers.
- **Private.** No account and no server. Your training log stays on your phone.
- **Offline.** It keeps working in a basement gym with no signal.
- **Open source.** GPL-3.0. iPhone, Android and the web from one codebase.
- **English and German.** It follows your phone's language.

## How it works

**Today** shows the routine that's probably next and how your week is going. Start it, and the workout shows one exercise at a time: every set is a stroke, last time's numbers are already filled in, and the button at the bottom logs the next set, counts down your rest and asks how many reps you had left (0, 1 or 2+). When you finish, the routine takes every number that went up, so next time starts where you left off. If you changed the routine's layout (a set more, an exercise swapped), it asks once whether to keep the new layout.

Over time, every exercise gets its own chart, records and history under **Progress**.

**Good to know**
- Tap a number to type it on Increment's keypad, with −/+ in the exercise's real step and the plates per side.
- The ⋯ at the end of a set makes it a warm-up, drop or failure set or rates it; swipe a set left to delete it.
- Press and hold an exercise under **Up next** to move it.
- Rating a set 0 marks it as a failure set, and the other way round.
- To share a routine, use its ⋯ → **Share**; the other person pastes the link under **Plan → Routines ⋯ → Add shared routine**.

## Try it

**[increment-training.app/get-started](https://increment-training.app/get-started)**: the web app, and what to tap to add it to your home screen on iPhone, Android or a computer. From there it opens like an app and works offline. Increment isn't in the App Store or Google Play yet; until then you can also run it from this repository with Expo Go on your phone (free, no developer account): see [app/README.md](app/README.md).

## Coming from Strong or Setlog?

- **Strong:** in Strong, **Settings → Export Workouts**; in Increment, the avatar on **Today** → **Import from Strong**. Notes, set types and your custom exercises come along, and importing the same file again only adds what's missing.
- **Setlog:** back up in Setlog and restore the file in Increment (the avatar on **Today** → **Restore from backup**). Increment grew out of Setlog and reads its backups as they are.

## Back up your data

Your workouts exist only on your device. Nothing is uploaded, so nobody else has a copy either. Use **Back up now** every so often (the app reminds you every two weeks), and always before deleting the app or switching phones. **Restore from backup** brings everything back. On a phone, the system's own backup (iCloud, Google) also keeps the app's data, if it's turned on.

## Known limits

- In a browser, a locked phone pauses web apps, so the rest timer can't alert you with the phone in your pocket. The phone apps send a notification.
- On iPhone, use the web app from the home screen: Safari can delete a website's data after seven days without a visit, while a home screen app keeps it. Its data is separate from Safari's, so restore a backup there if you tried it in Safari first.
- There's no sync between devices. Use backup and restore to move your data.
- There's no Apple Health, Google Fit or smartwatch integration yet.

## How it's built

Increment is an [Expo](https://expo.dev) (React Native) app in TypeScript: one codebase for iPhone, Android and the web.

- **Shared core:** the training logic (records, estimated 1RM, the suggested routine, progressive overload, editing routines and finished workouts, chart axes, Strong import and export, backups, translations) lives in `core/` as plain JavaScript modules. It doesn't touch the DOM, storage or a UI framework, and `npm test` checks that it stays that way.
- **Progressive overload:** at the end of a workout, each set is paired with the routine's (warm-ups with warm-ups, working sets with working sets, in order, so a skipped warm-up doesn't shift anything) and only better sets update the routine: more weight, or the same weight and more reps; less assistance; for cardio more distance, or the same distance faster.
- **Records:** a single chronological pass over the history works out the personal records for every set (estimated 1RM, weight, set volume, reps, distance and time).
- **Design:** Tally, a design language of its own: ink on paper, one stroke per set, one colour that's only earned when a number goes up. The tokens in `docs/design/tokens.json` generate the app's theme (`npm run tally`).
- **Light on the battery:** the screen isn't kept on, the rest bar animates on the UI thread and its text changes once a second, and the workout in progress is saved a quarter second after a change instead of on every keystroke.
- **Storage:** SQLite on the phone, localStorage in the browser. Data is stored in kg, km and seconds and converted for display; inputs accept decimal commas ("62,5").
- **Import:** a CSV parser for both of Strong's export layouts that skips workouts it already has.
- **Testing:** unit tests for the core in plain Node, and end-to-end tests that drive the web build in an emulated iPhone (Playwright) through a real 86-workout import, a whole workout, routines and backups, on every push.
- **Open core:** the store version is built from a private repository that adds the coaching engine (TrueTrain) and the store setup to this code. Everything else is here.
- Developed with the assistance of Claude (Anthropic).

```
app/                     the app (Expo): screens in src/app, Tally components in src/ui/tally; see app/README.md
core/                    the training logic, no UI or storage (see core/index.js)
docs/design/             Tally: tokens, components, navigation, motion, the build plan
docs/dev/                status and backlog, how it's built
tests/core.test.mjs      unit tests for the core (npm test)
tests/browser/           end-to-end tests of the web build
web/                     the website around the web app: get started, privacy pages, manifest and icons, the offline service worker
scripts/web-site.mjs     builds the website; CI publishes it to increment-training.app
```

### Run it locally

```sh
git clone https://github.com/laurinlibossek/increment.git
cd increment/app
npm install
npx expo start          # scan the QR code with Expo Go, or press w for the browser
```

Node 22.13 or newer.

## Background

Increment started as Setlog, a personal replacement for a paid tracker. I wanted every feature I actually used, my full history in open formats and no monthly fee. It turned out useful enough to share, so now it's free and open source for anyone who wants.

## Contributing

Found a bug or missing a feature? Open an issue. Pull requests are welcome too. Because the store version is built from this code as well, I'll ask you to agree that your change can ship there before I merge it. Run `npm test` and the type check (`cd app && npx tsc --noEmit`), and try your change on a real phone.

## License

[GPL-3.0](LICENSE) © 2026 Laurin Libossek. Setlog, the web app Increment grew out of, was MIT-licensed; its code stays available under MIT in [laurinlibossek/setlog](https://github.com/laurinlibossek/setlog).

Increment is an independent project and isn't affiliated with Strong or any other workout app.
