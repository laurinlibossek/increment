# Screens and navigation

Strong organises the app by object (Profile, History, Workout, Exercises, Measure). Increment organises it by time: what to do now, what you plan, how it went.

## Tabs

Laurin's decision (6 Nov 2026): Today, Plan and Progress are the three tabs. TrueTrain is planned for when the store apps are live.

| Tab | SF Symbol | What it holds | Replaces |
| --- | --- | --- | --- |
| Today | `sun.max` | Up next (the routine to start), this week's sessions, sets per muscle for the last 7 days, recent records. At the top right, the magnifying glass opens Search and the avatar opens Account and settings. | Workout tab, Profile dashboard |
| Plan | `list.bullet.rectangle.portrait` | The current block (mesocycle) with its weeks, routines and folders, examples. Search and + at the top right. | Templates on the Workout tab |
| Progress | `chart.line.uptrend.xyaxis` | Last 30 days at a glance, then Workouts (history and calendar), Lifts (every exercise with its chart and records), Records, Body (measurements), Moving up. Search at the top right. | History, Exercises, Measure tabs |
| TrueTrain | a plain symbol, to be chosen (no sparkles) | The membership. On the web: what TrueTrain is and that it's in the App Store and Google Play apps, with links. In the store apps: the same page with a free trial, and for members the coach itself (built in the private repository). | — |

- Today, Plan and Progress in this order, Today selected on launch. TrueTrain becomes the fourth tab once the store apps are live.
- **Search** is a magnifying glass at the top right of Today, Plan and Progress, not a tab. It pushes the Search screen with Back and the field focused. Search keeps the exercise family rows, body-part chips, exact variations for typed queries, + for a new exercise, and the empty state with Create. Back returns to the tab it opened from.
- **The free app is complete:** logging, history, charts, records, your own exercises, import, export and backups. The TrueTrain tab is the one place that explains the membership, on the web too; nothing else is locked, greyed out or advertised.
- On iOS use native tabs (`NativeTabs` from `expo-router/native-tabs`): the system glass bar, minimize on scroll down. On Android the same API gives the Material bottom bar.
- **Swipe between tab roots:** a deliberate horizontal swipe on Today, Plan or Progress selects the neighbouring tab, the same as tapping its tab. Left goes Today → Plan → Progress; right goes back, without wrapping at either end. It switches on release, with no slide, drag-follow or haptic. The bars remain the accessible way to switch.
- Scrolling wins: the swipe starts recognizing beyond 25 px horizontally, fails at 15 px vertically (including a later turn), and needs 60 px distance or a fast fling. Short or diagonal drags do nothing. Progress's bar chart keeps its scrub gesture; a touch that starts there never switches tabs. On the web the first/last 24 px of the screen are excluded for Safari's back/forward gesture. Android's system back remains the system's. Pushed screens, sheets, the running workout, its accessory and the editors have no tab-swipe shortcut.
- Account (name, units, appearance, rest timer, backups, import, privacy policy) is a sheet from the avatar, not a tab.

## The session

The running workout is a full-height sheet, like Now Playing in a music app.

- **Minimized**, it becomes the Now Lifting accessory above the tab bar (`NativeTabs.BottomAccessory`): the session's tally, the exercise and set, the rest countdown, and Skip. It shrinks to the inline layout when the tab bar minimizes. Tapping it opens the sheet again.
- **Header**: Minimize (`chevron.down`), ⋯ (rename, change start time, notes, discard), the workout name in `t-title-1`, elapsed time in `t-number-m` `ink-2`, and the hero tally of every set in the session with "4 of 22 sets · 1 record" under it.
- **Current exercise**: base name in `t-title-3`, equipment · body part ("Smith Machine · Legs") and last time in `t-footnote`, a slot the store version can fill, then the set rows. The next pending set's fields are filled with last time's numbers (or a target from the store version) as ghost values.
- **Up next**: the remaining exercises as list rows, each with its own small tally. Drag to reorder; tap to jump.
- **Action bar**, bottom, three states:
  1. *Logging*: one primary button, "Log 82.5 × 8". Tapping it logs the set, turns its stroke into a stem with a light haptic, and starts the rest.
  2. *Resting*: the countdown in `t-number-l`, −15, +15 and Skip, the drain bar, and "Reps left?" with 0 · 1 · 2+ to rate the set just done (0 is failure, 1 the target). Rating is optional and one tap.
  3. *Done*: after the last set the button becomes "Finish workout". Finishing is never a button in the top corner.

## Screen templates

- **Tab root**: `t-eyebrow` (Today only) → `t-large-title` with trailing controls (Search next to the avatar on Today, next to + on Plan, on its own on Progress) → content sections `space-8` apart, each with a `t-title-2` header. Floating tab bar.
- **Detail** (exercise, workout, routine): back and ⋯ in the bar → `t-title-1` with a `t-footnote` line → the hero number if there is one → chart → Stat strip → lists. One scrolling page; no inner tabs. On an exercise page, movement/equipment chips switch to a sibling exercise with `setParams`, replacing the selected id without another history entry. They do not split the page into sections; every number and history row still belongs to that selected exercise.
- **Summary**: Done at the top right → date eyebrow → workout name → Stat strip (Time, Volume, Sets) → hero tally → Records (highlighted) → Notes → Routine (a switch: "Save changes to Push A" with one line of what changes). The routine question is a row, not a dialog.
- **Sheets**: system sheets with detents for choices and short forms. The keypad is a sheet drawn by the app at `paper-2`.

## Mapping from the current app

| Today in Setlog | In Increment |
| --- | --- |
| Workout tab: Start an empty workout, template grid | Today: Up next card; Plan: routines; "Empty workout" in the + menu on Plan |
| Logging table with ✓ column | Set rows with strokes; Action bar logs the current set |
| Green Finish button, top right | "Finish workout" in the Action bar after the last set; ⋯ → Finish early |
| "Update template?" dialog after finishing | Routine section on the summary with a switch |
| History tab + calendar | Progress → Workouts |
| Exercises tab, exercise pages with About / History / Charts / Records tabs | Progress → Lifts and Search; one scrolling exercise page |
| Measure tab | Progress → Body |
| Profile tab + settings gear | Today avatar → Account sheet; the dashboard's charts move to Progress |
