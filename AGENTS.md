# Increment: notes for coding agents

Increment is a free, open-source workout tracker built around progressive overload (GPL-3.0), by Laurin Libossek (GitHub `laurinlibossek`). He's the only maintainer and reviews everything. This file is for every coding agent: Codex and others read it directly, Claude Code through `CLAUDE.md`.

- **App** (`app/`): Expo / React Native (SDK 58, Expo Router, TypeScript), one codebase for iPhone, Android and the web. The web build is the open web app. Not released yet; Laurin runs it in Expo Go, which only runs the latest SDK: when Expo Go updates on his phone, the app has to follow.
- **Core** (`core/`): the training logic without DOM, storage or UI framework, imported as `@increment/core`.
- **Open core:** the store version is built from the private repository `laurinlibossek/increment-prod`: this repository plus TrueTrain (the membership and its coaching engine) and the store setup. It pulls this repository in; nothing flows back. Build everything else here, and never put TrueTrain's workings (its rules, notes, data, membership or pricing) or store-only material into this repository; here it is only the TrueTrain tab's public page and empty slots. See `docs/dev/architecture.md` → "Open core".
- Increment grew out of Setlog (`laurinlibossek/setlog`, a Preact web app). Backups keep Setlog's format, so Setlog backups restore here.

Read next, in this order:
1. [`docs/dev/backlog.md`](docs/dev/backlog.md): where things stand and what to do next.
2. [`docs/design/README.md`](docs/design/README.md) before touching any screen: the Tally design language, and `phases.md`, the plan the app is built by.
3. [`docs/dev/architecture.md`](docs/dev/architecture.md): decisions, code map, gotchas.
4. [`tests/browser/README.md`](tests/browser/README.md): the browser tests.
5. [`app/AGENTS.md`](app/AGENTS.md) before touching `app/` (Expo changes between SDKs: check the versioned docs, not memory).

## Branches and pull requests

- `main` is the current state. Branch from `main`, push your branch and open a pull request into `main`. Laurin merges after reviewing (or tells an agent to merge).
- Several sessions may work at the same time on different branches. Keep each PR to one task so they merge cleanly, and expect conflicts in the shared hot spots: `core/i18n-de.js`, `docs/dev/backlog.md`, `tests/browser/app-logging.mjs`. Fetch and rebase on `origin/main` before opening the PR; when two branches add the same German key, `npm test` names it: keep one.
- Commits use Laurin's GitHub noreply address (`134843708+laurinlibossek@users.noreply.github.com`), never a personal email.
- In the PR description: what changed for the user, before/after screenshots of every screen you touched (light and dark, German where text changed; see "Screenshots for review" in `tests/browser/README.md`; commit them under `docs/dev/review-<date>-<topic>/` and remove them in the next commit), the test results, and anything Laurin has to decide.
- Contributions from people other than Laurin: he also ships this code in the store version, so they need his OK on that before merging.

## Rules for every change

- **Both languages:** ship the apps in English only for now (Laurin, 6 Nov 2026); German stays maintained but hidden, including Account’s Language choice; a build with `EXPO_PUBLIC_ENABLE_GERMAN=1` brings it back (`ENABLE_GERMAN` in `app/src/lib/i18n.ts`). English dates and numbers follow the phone's region (`englishFormatLocale` in core: "Friday, 6 November", 19:15, 62,5 kg on a German phone). Every new text people see still goes through `tr('…')` (`useLang()`) and has German in `core/i18n-de.js`. Keep `core/exercise-names-de.js` and the German browser checks working with that setting on. The English text is the key; German uses "du". `npm test` still fails on a missing translation or a duplicate key.
- **Logic goes into `core/`**, with no browser APIs (checked by `npm test`), and gets a unit test in `tests/core.test.mjs`.
- **Design:** the app's colours, spacing and type are the Tally tokens in `docs/design/tokens.json` (after changing one, run `npm run tally`, which regenerates `app/src/design/tally.ts`; `npm test` checks it). New code takes colours from `useTally()`. The look follows `docs/design/`.
- **Units:** stored as kg, km and seconds; inputs accept decimal commas. Stored exercise names stay English (they match Strong exports); German is a display name from `core/exercise-names-de.js`, so show exercises with `f.exName(ex)`, never `ex.name`.
- **UI text:** short, plain, sentence case ("Update routine", "Keep routine"), matching the existing strings. The app says "routine(s)"; the code and the stored data say template.
- **Root README** (Laurin's rule): explain the core mechanics and the non-obvious tricks only, no lists of settings or minor features. Keep the install steps, backup advice, limits, "How it's built" and his Background text.

## Commands

```sh
npm test                                   # core unit tests + guards (repo root, Node 22.13+, nothing to install)
node tests/browser/run.mjs                 # browser suites against the web build (see tests/browser/README.md)
cd app && npm ci && npx tsc --noEmit       # app type check
cd app && npm run bundle                   # iOS + Android export (what CI checks)
cd app && npx expo-doctor                  # dependency and config check
```

CI (`.github/workflows/test.yml`) runs `npm test`, the app type check, both bundles and the browser suites on every push and PR. When a browser suite fails, the run has the suites' screenshots attached as an artifact (`browser-test-screenshots`).

## Done means

- `npm test` is green; `tsc --noEmit` and `npm run bundle` too if `app/` changed.
- The browser suites for the parts you touched are green, and new behaviour has new checks (extend a suite, or add one and register it in `tests/browser/run.mjs`).
- Screenshots for review are in the PR.
- `docs/dev/backlog.md` is updated in the same PR, and `docs/dev/architecture.md` if you changed how something works.
