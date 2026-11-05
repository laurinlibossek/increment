# Design todo: the unslop audit of 5 Nov 2026

A design audit of the whole app, done with the [unslop](https://github.com/heydamir/unslop) skill by Damir Sokolovsky (CC BY 4.0), checked against Tally. This file is the work list that came out of it, written for the coding agent that does the work. Laurin reviews each pull request; Claude checks the result against this list afterwards.

**Verdict:** light slop, so this is a polish pass, not a redesign. None of the usual AI tells are in the app (no gradients, glows, emoji, purple or pulsing), and Today, the session, the keypad, the rest bar and the summary are the standard to match. What's left: screens still in the old Strong look, numbers written several ways, a few bugs, dark-mode controls, and the web build at desktop width.

Line numbers are as of `5979a0a`; search for the quoted code if they've moved.

## Ground rules

- Read `AGENTS.md` and `docs/design/README.md` first. **Tally is the direction.** Where unslop's general rules and Tally disagree, Tally wins (see "Leave alone" at the end).
- One pull request per group below, in the order given (groups 1, 7, 8 and 10 don't depend on anything and can run in parallel; group 3 comes after group 2). Branch from `main`, keep each PR to its group.
- Every PR: before/after screenshots of each screen it touches, light and dark, German where text changed (`docs/dev/review-<date>-<topic>/`, removed in the next commit), `npm test` green, `tsc --noEmit` and `npm run bundle` green, the browser suites for the touched screens green, new checks for new behaviour, and `docs/dev/backlog.md` updated (move the group to Done).
- New text goes through `tr()` with German in `core/i18n-de.js`. Logic goes into `core/` with a unit test in `tests/core.test.mjs`.
- Items marked **Default** have a proposed answer: build that unless Laurin has said otherwise, and list it under "for Laurin to decide" in the PR description.
- Tick the boxes in this file in the same PR as the work.

## How to look at the screens

Build and serve the web app with `node tests/browser/run.mjs --serve` (port 8790). For realistic screens, load the store demo data (`tests/browser/store-demo.mjs`, 16 weeks of an upper/lower split) the way `tests/browser/app-store-shots.mjs` does: an init script that writes `demoData(lang)` to `localStorage['increment.data']`. The audit used an iPhone-sized page (390 × 844, `isMobile`, `hasTouch`) in light, dark and German, plus 1280 × 800 for the web build.

---

## 1. Bugs and wrong text

- [ ] **1.1 The exercise chart's month labels are wrong.** On Squat (Barbell), 6M reads "Jul, Aug, Sep, Nov": October is missing, and "Sep" sits at the end of September. The labels sit at 0, ⅓, ⅔ and 1 of the date range and take whatever month falls there.
  - Where: `app/src/ui/tally/LineChart.tsx:76-80`.
  - Do: put date labels on real boundaries: the 1st of each month for ranges of about 75 days to a year (thin them out to 3–4 labels that fit, never skip a month in between and then show the next), day and month for shorter ranges, month and year for longer ones. Pick the dates in `core/` (e.g. `dateTicks(from, to, max)`) with unit tests.
  - Done when: Squat at 3M, 6M, 1Y and All has labels at month starts with no gap in the sequence; unit tests cover a 6-month range that crosses a year end.

- [ ] **1.2 Text still says "Settings"; the screen is called Account.**
  - Where: `app/src/app/tools.tsx:119` ("…changed in Settings → Plates."), `app/src/app/exercise/[id].tsx:122-123` ("Change it in Settings."), and their German keys.
  - Do: say Account ("Account → Plates", "Change it in Account."). Keep `app/src/app/account.tsx:253`, which means Strong's own Settings.
  - Done when: no app string points to "Settings" except the Strong one; German matches.

- [ ] **1.3 The search field on the web shows a square outline inside the rounded field**, offset to the left, while it's focused (Search tab, both themes).
  - Where: `app/src/app/(tabs)/search.tsx:62`; check the other search fields too (Lifts, Add exercises).
  - Do: remove the browser's default outline on the inner input. If keyboard focus needs a visible ring, draw Tally's `focus` ring (2 px, 2 px offset) around the whole capsule.
  - Done when: no square outline in any search field; Tab-key focus is still visible.

- [ ] **1.4 Two Account rows have the same title, "Body weight in volume".** Only the grey subtitle tells them apart.
  - Where: `app/src/app/account.tsx:220-221`.
  - Do (**Default**): titles "Weighted bodyweight exercises" and "Assisted bodyweight exercises", both with the subtitle "Count body weight in volume" (like "Count dumbbells twice / For volume" just above).
  - Done when: every row title in Account is unique, in both languages.

- [ ] **1.5 Account titles are cut off in German:** "Routinen nach dem Training aktua…", "Verfügbare Sc…".
  - Where: the setting rows in `app/src/ui/kit.tsx` (title on one line; the value next to it takes up to 45 %, line 160).
  - Do: a row title never truncates: let it wrap to two lines, and shorten the value instead.
  - Done when: German Account at 375 and 390 wide shows every title in full.

## 2. One format per number

Unslop's rule and Tally's ("numbers are the interface") agree: the same kind of number looks the same everywhere.

- [ ] **2.1 Volume.** A workout's volume is "15,740 kg" on the workout page, "15.7k kg" in the history list, and Progress shows "172 t".
  - Where: `app/src/lib/format.ts:22-35` (`compact`, `volume`: compacts from 10,000), `app/src/app/(tabs)/progress.tsx:49-52`.
  - Do (**Default**): one workout's volume is always the full number with thousands separators ("15,740 kg"). Only totals over many workouts (Progress) may be shortened, in one form for both units ("172 t" / "379k lb"), never "k kg".
  - Done when: every place that shows one workout's volume (workout page, summary, history, shared text) uses the full number.

- [ ] **2.2 Workout length.** "1:11" on the workout page and summary (Tally's h:mm, `hm()` in `app/src/ui/facts.tsx:27`), "1h 11m" on history cards, "2h 11m" in the calendar stats, "1 h 11 min" in German.
  - Where: `app/src/app/history.tsx:149` and `:196` use `f.dur()` (`app/src/lib/format.ts:63`).
  - Do: workout length as a figure (stats, cards, calendar) is always h:mm with the label "Time", as Tally says. `f.dur()` stays for running text, like the "Finish workout?" dialog.
  - Done when: no screen shows workout length as "1h 11m" next to a figure.

- [ ] **2.3 Estimated 1RM has two decimals on Records** ("142.92 kg") and one everywhere else ("142.9").
  - Where: `app/src/app/records.tsx:41` (`f.wu`, which keeps two decimals for weights).
  - Do: estimated 1RM with one decimal everywhere; real weights stay as logged (122.5, 58.75).
  - Done when: Records, the exercise page and the workout page show the same 1RM the same way.

- [ ] **2.4 The unit is repeated on every set row** of the workout page ("122.5 kg × 5" four times). Tally: "in rows just '82.5 × 8' under a unit the screen already states".
  - Where: the set rows of `app/src/app/workout/[id].tsx`.
  - Do: drop the unit from the rows where the screen already shows it (the Volume stat in kg).

## 3. The Workouts list in Tally (after group 2)

The most out-of-place screen: Progress → Workouts is still Strong's history card.

- [ ] **3.1 Rebuild the history list.**
  - What's wrong: a grey card per past workout (Tally: a card marks something you can start, and never a table in a card), uppercase "EXERCISE / BEST SET" column headers (`app/src/app/history.tsx:232`; Tally: no small-caps labels), a row of Strong-style icons (clock, weight, trophy; Tally's records icon is the rosette), "15 PRs" in signal colour on every card, dates like "Tue, Nov 3, 2026 · 06:23 PM" (year in the current year, leading zero).
  - Do: full-width rows with `line` hairlines, like Lifts and Records, built from the shared `app/src/ui/tally/` components: the workout name; one meta line ("Tuesday · 1:11 · 15,740 kg", the year only for past years); the workout's tally (strokes per set, records as signal strokes, as on the workout page); "5 records" as text instead of the trophy. Keep the month headers with their counts. The exercise list either goes or becomes one plain subhead line ("Squat, Romanian Deadlift, Leg Press…"); **Default:** one line. Show the result to Laurin before polishing further: `docs/design/screens.html` has no Workouts screen yet.
  - Also: "PR"/"PRs" (German keys at `core/i18n-de.js:323-324`) become "record"/"records" ("Rekord"/"Rekorde"); delete the PR keys if nothing uses them any more.
  - Done when: no uppercase labels, no cards and no "PR" on the screen; tapping a row still opens the workout (suites `app-tabs`, `app-parity`); the calendar view is unchanged.

## 4. One list style

Plan, Progress, Lifts and Records use full-width rows with hairlines (Tally principle 4). Account, Body, a routine's page and Tools use inset grey cards (the iOS Settings look).

- [ ] **4.1 Account, Body and the routine page use full-width rows** (`ListRow` and the section header from `app/src/ui/tally/`), with section titles in `t-title-2`.
  - Where: `app/src/app/account.tsx`, `app/src/app/measure.tsx`, `app/src/app/template/[id].tsx`.
  - **Default:** follow Tally on all three, Account included (a settings sheet could keep the grouped look; Laurin may prefer that).
  - Related: backlog "Next" item 4 moves the summary, workout and exercise pages from `app/src/ui/facts.tsx` to the shared components; reuse the same ones here.
- [ ] **4.2 Body says "No entries yet" eleven times.** Show the subtitle only when there's an entry; an empty row is just its name.
- [ ] **4.3 Plan rows have both a ⋯ and a ›** (`app/src/app/(tabs)/plan.tsx:78-82`). **Default:** keep the ⋯ (the menu), drop the chevron; the whole row still opens the routine.

## 5. Headers and the main action

- [ ] **5.1 The routine page shows its name small in the top bar.** The workout and exercise pages put the title in `t-title-1` under the bar, as Tally says for detail screens. Do the same on `app/src/app/template/[id].tsx`.
- [ ] **5.2 Account on the web has both a back arrow and Done.** It's a modal (`app/src/app/_layout.tsx:42`): one way to close it (Done). Check whether this happens on the phone too or only on the web.
- [ ] **5.3 Main buttons in the thumb zone** (Tally principle 1): "Start workout" sits in the middle of the routine page (`app/src/app/template/[id].tsx:66`), "Log body weight" at the top of Body (`app/src/app/measure.tsx:45`). Put each in an Action bar at the bottom, like the session's Log button.
  - Done when: both buttons sit at the bottom edge with the content scrolling under them; `app-editing` (uses `start-template`) passes.

## 6. Less yellow, less noise

- [ ] **6.1 The exercise page has four yellow marks on its first screen:** the "+20.4 kg" chip, Best set, the 5 RM value and every chart dot. Each follows the rule on its own, but for anyone who keeps progressing the page is always yellow, so nothing stands out.
  - Where: `app/src/app/exercise/[id].tsx` (around lines 100-110 for the stat marks), `app/src/ui/tally/LineChart.tsx`.
  - **Default:** yellow for the hero change and the record dots on the chart; Best set and rep maxes in `ink`.
- [ ] **6.2 Records rows all have the same cut-off subtitle,** "Nov 3, 2026 · Est. 1RM, Weight, Set volu…", and the number on the right is only one of those.
  - Where: `app/src/app/records.tsx:56-57`.
  - Do: the subtitle names what the number is, plus how many other records that workout set ("Tuesday · Est. 1RM · 2 more"), without the year in the current year. Nothing truncates at 375 wide.
- [ ] **6.3 Progress shows "Records 72" (last 30 days) directly above "Records 231" (all time)**, and the same for Workouts (17 and 62).
  - **Default:** keep the 30-day strip; drop the all-time counts from the Workouts, Lifts and Records rows (they're navigation); Body keeps its latest value.

## 7. Dark mode controls

- [ ] **7.1 The selected segment is black on a dark grey track**, so it reads as a hole and is hard to spot (Account units, Tools, the exercise page's 3M/6M/1Y/All).
  - Where: `app/src/ui/kit.tsx:200` (`Segments`, selected = `c.bg`) and `app/src/ui/tally/SegmentedControl.tsx:33` (selected = `paper`).
  - Do: the selected segment is lighter than the track in dark (a new token step if needed: change `docs/design/tokens.json`, run `npm run tally`). While at it, one segmented control instead of two: move every screen to `SegmentedControl` and delete `Segments`.
  - Done when: the selected segment has at least 3:1 contrast against the track in every theme.
- [ ] **7.2 Switches: on and off look too alike in dark.** The off knob is hard-coded white (`app/src/ui/kit.tsx:185`), so off is a white knob on dark grey and on is a black knob on white.
  - Do: take every switch colour from `useTally()`, and make on and off tell apart at a glance in all four themes.

## 8. The web build at desktop width

Matters before the web app is published (backlog "Next" item 2).

- [ ] **8.1 No maximum width.** At 1280 × 800 the Start button is about 1,200 px wide, a set's weight and its ⋯ are about 1,100 px apart, and the tab bar spans the screen.
  - Do: on wide windows the app is a centred column of about 600 px on `paper` (tab bar, Now Lifting and the Action bar included; sheets and dialogs are already capped in `app/src/ui/overlay.tsx`). Phones don't change. Add a line about it to "The web build" in `docs/design/platforms.md`.
  - Done when: Today, the session and Progress at 1280 × 800 look like the phone layout in the middle of the window, in light and dark.
- [ ] **8.2 The page background is blue-grey** (`#f1f3f6` / `#0b0d11` in `app/src/app/+html.tsx:37-46`), left from the old look. Use Tally's `paper` (`#ffffff` light, `#000000` dark).

## 9. Older screens on the Tally scale

- [ ] **9.1 Spacing, radii and type from the tokens.** Older code still uses spacing off the 4-point grid (6, 10, 14, 22), radii outside Tally's four (8, 9, 10, 12, 15, 18, 22), hard-coded sizes and weights 700/800 outside the type scale.
  - Where: mostly `app/src/ui/overlay.tsx` (dialog titles at 18 px / 700 on lines 190, 219, 315, 330; dialog radius 18; toast radius 12), `app/src/ui/kit.tsx` (269: 22 px / 800; 278: 19 px / 700), `app/src/app/tools.tsx` (148: the 1RM result at 40 px / 800 with −0.5 tracking: use `t-number-xl`), `app/src/app/exercise-form.tsx`, `app/src/app/pick-exercises.tsx`, `app/src/app/template-edit.tsx`, `app/src/ui/Chart.tsx`.
  - Do: `SPACE`, `RADIUS` and `TYPE` from `app/src/design/tally.ts`. Allowed exceptions: 1–2 px nudges inside small controls, the stroke sizes, and the plate drawing in the plate calculator (real plate colours and sizes).
  - Done when: a search for off-grid padding, margin and gap values and for raw radii finds only the exceptions; dialogs, sheets, toasts and Tools look unchanged or closer to Tally in the screenshots.
- [ ] **9.2 The 1RM calculator opens as two empty boxes with no hint;** the plate calculator shows a ghost "100" and nothing else.
  - Do: placeholders in the fields and one line saying what the tool works out; the plate calculator shows the plates for the ghost value until something is typed.
- [ ] **9.3 Text people have to read is drawn in `ink-3`.** Tally keeps `ink-3` for pending strokes, ghost values and disabled text, never for text someone reads; on `paper-2` it's about 3.2:1, below the 4.5:1 that small text needs. The setting rows' subtitles and values (`app/src/ui/kit.tsx:157-160`, so all of Account), the hint under the plate calculator (`app/src/app/tools.tsx:119`) and the calendar hint are examples.
  - Where: `ink3` / `tone="ink3"` on text in `app/src/app/history.tsx` (8), `app/src/app/tools.tsx` (7), `app/src/ui/kit.tsx` (3), `app/src/app/warmup.tsx` (3), `app/src/app/account.tsx` (3) and single uses in about a dozen more files.
  - Do: `ink-2` for every readable line; `ink-3` stays only on ghost values (last time's numbers, placeholders), pending strokes and disabled text.

## 10. The routine popup: Keep is the normal choice, Update asks again

Laurin's decision (5 Nov 2026). People are expected to stick to their routines: the same exercises and sets each time, trying to beat last time's numbers (more weight or reps, faster, longer). Better numbers keep going into the routine by themselves, without a question, so next time shows what was done last time. Changing the routine's layout is the exception, so it takes a deliberate second step.

Today, when the layout changed (an exercise skipped or added, a set more or fewer, set types or supersets), the popup over the summary asks "Update Upper B?" with **Update routine** as the black main button and Keep routine below it (`announceRoutine` in `app/src/lib/workout.ts:208-237`).

- [x] **10.1 Keep routine is the main button.** Same two choices, Keep routine first and in the `primary` tone. Update routine looks clearly different, as the special choice (**Default:** `plain`). The title stops pushing towards updating (**Default:** "Change {name}?" with the same one-line summary of what differs, plus "Your better numbers are saved either way.").
- [x] **10.2 Update routine always asks once more**, on every finish, not only after Finish early. A second popup says exactly what the routine will lose and gain ("Removes Pull Up and Seated Row (Cable). 1 set fewer in Overhead Press."). **Default** buttons: "Update routine" to confirm, in the `danger` tone when anything is removed, and "Back" to return to the first popup with nothing changed.
- [x] **10.3 Undo stays.** After the confirmation the routine is saved and the toast "{name} updated" offers Undo, as now. Keep routine works as now: the layout stays, the better numbers are saved, with Undo.
- [x] **10.4 The changes as a diff** (Laurin, 5 Nov 2026): both popups list what differs one exercise per line, "+ Squat (Barbell) × 2" on a green marker for what the routine would gain, "− Pull Up × 4" on a red one for what it would lose, "× 4 → 1" when only the number of straight sets changed, like a git diff and in the style of the record highlight. × counts straight sets (normal and failure); warm-ups, drop sets, failure sets, supersets and the order get plain lines of their own ("Warm-ups changed"), and Update routine remembers them all.
- Unchanged: better numbers without a question; no popup with "Update routines after workouts" off, for example routines, "Do this workout again" or empty workouts.
- Tests: `tests/browser/app-logging.mjs` (around lines 413-426 and 546-563) gets the new step: Keep routine is the main button; Update routine opens the confirmation; Back changes nothing; confirming updates the routine; Undo restores it; in English and German.
- Docs: once built, update "How finishing a workout from a routine works" in `docs/dev/backlog.md`.

---

## Leave alone

Unslop's general rules would flag these, but they're deliberate Tally choices or Laurin's decisions:

- Bold titles (`t-large-title`, `t-title-1`, `t-title-2` at 700): the native iOS look.
- The uppercase date above Today and the summary title (`t-eyebrow`, one per screen).
- Full stops on one-sentence captions and coach notes (Tally's voice).
- The ⋯ on every set row (Laurin, #11).- The tally strokes, the yellow signal itself, the system fonts, true black in dark.
- Shadows on the floating navigation (tab bar, Now Lifting), a dragged row and the toast.
