# Bugs

Laurin's running list of bugs from using the app (started 9 Nov 2026). Add new ones at the top of "Open"; when one is fixed, move it to "Fixed" with the PR number and date, in the same PR as the fix. Visual glitches from the 5 Nov audit are in [`design-todo.md`](design-todo.md). Once the web launch is done, new bugs can also go in as GitHub issues (see [`backlog.md`](backlog.md), step 3).

Each entry: what happens, where, how to reproduce, what should happen. Notes on the cause are marked *unverified* until someone has checked them on a device.

## Open

### 1. The phone's keyboard opens on top of the app's keypad

- **Seen:** 9 Nov 2026, iPhone, Expo Go, dark mode, running workout (Incline Bench Press).
- **What happens:** tapping a weight (or reps) field of a pending set opens the app's keypad (the “Weight · set 1” sheet with the −2.5 / + steps) **and** the iPhone's number pad, with its own bar (up and down arrows and a checkmark) on top. The iPhone's keyboard covers the lower half of the app's keypad, so the Next and +/− keys can't be reached. The field shows a blinking caret as well.
- **Should happen:** only the app's keypad (running workout). The phone's number pad opens only in the editors (workout edit, routine editor) and Tools.
- **Where:** `app/src/ui/workout/SetRow.tsx` (`SetField`), used by the running workout through `Session.tsx`.
- **Notes on the cause (unverified):** `SetField` relies on `showSoftInputOnFocus={false}` to keep the system keyboard down, and sets `caretHidden` on native. The caret is visible in the screenshot, and the bar above the number pad is the iPhone's default one, not our “Done” bar (that one is set only in the editors). So the field behaves as if it weren't treated as the keypad's field at all on this phone, or `showSoftInputOnFocus` isn't honoured on iOS in the current React Native. Check what `onKeypad` receives on focus, and whether it is the web-only path that keeps the system keyboard down in the browser tests. If the prop isn't honoured on iOS, an alternative is to make the field not take the keyboard at all (`inputMode="none"`, or a non-focusable field that only shows the value while the keypad types into the draft).
- **Test gap:** the browser suites run on the web, where the system keyboard doesn't exist, so they can't catch this. A fix needs a check on a real iPhone.

## Fixed

Nothing yet.
