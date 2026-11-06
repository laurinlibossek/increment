# Exercise family screens

Before: main at `77d7ea9`, after PR #13 merged. After: `exercises/family-screens`. English, light and dark, 375 × 844 px in Chromium's iPhone emulation. These are web-build layout captures, not native-device screenshots. German strings remain maintained; German captures were not requested for this PR.

The full-library Search pair has all 400 built-ins visible. The focused fixture keeps 24 exercises visible so Squat, Bicep Curl, a family of one and an ungrouped custom fit in view. Its variations have different histories. Squat opens the last logged Smith Machine version; movement/equipment chips select sibling ids with their own chart and session counts. The single-example page is Dead Hang. Both runs hide Safety Bar Squat before the picker shots. Before the family picker existed, its related versions are shown with a `squat` query; the new picker expands Squat inline without a query. Replace opens with no query in both versions.

The Workouts example logs two variations in the same session: Squat (Smith Machine) and Squat (Cybex Machine). The old base-name line collapsed them to “Squat”; the new line keeps both exact variations. Only the exercise-page and current-session headers split equipment onto a separate line.

## Light

| Screen | Before | After |
|---|---|---|
| Search, all 400 exercises | <img width="220" src="before-light-search-all.png"> | <img width="220" src="after-light-search-all.png"> |
| Search, focused fixture | <img width="220" src="before-light-search.png"> | <img width="220" src="after-light-search.png"> |
| Picker, Squat open | <img width="220" src="before-light-picker.png"> | <img width="220" src="after-light-picker.png"> |
| Replace, current family first | <img width="220" src="before-light-replace.png"> | <img width="220" src="after-light-replace.png"> |
| Exercise page, Squat | <img width="220" src="before-light-squat.png"> | <img width="220" src="after-light-squat.png"> |
| Exercise page, family of one | <img width="220" src="before-light-single.png"> | <img width="220" src="after-light-single.png"> |
| Current-session header | <img width="220" src="before-light-session.png"> | <img width="220" src="after-light-session.png"> |
| Workouts, exact variations | <img width="220" src="before-light-workouts.png"> | <img width="220" src="after-light-workouts.png"> |

## Dark

| Screen | Before | After |
|---|---|---|
| Search, all 400 exercises | <img width="220" src="before-dark-search-all.png"> | <img width="220" src="after-dark-search-all.png"> |
| Search, focused fixture | <img width="220" src="before-dark-search.png"> | <img width="220" src="after-dark-search.png"> |
| Picker, Squat open | <img width="220" src="before-dark-picker.png"> | <img width="220" src="after-dark-picker.png"> |
| Replace, current family first | <img width="220" src="before-dark-replace.png"> | <img width="220" src="after-dark-replace.png"> |
| Exercise page, Squat | <img width="220" src="before-dark-squat.png"> | <img width="220" src="after-dark-squat.png"> |
| Exercise page, family of one | <img width="220" src="before-dark-single.png"> | <img width="220" src="after-dark-single.png"> |
| Current-session header | <img width="220" src="before-dark-session.png"> | <img width="220" src="after-dark-session.png"> |
| Workouts, exact variations | <img width="220" src="before-dark-workouts.png"> | <img width="220" src="after-dark-workouts.png"> |

## Validation

- 68 core tests pass, including last logged selection, visibility, compatibility filters, ordering, actual stored objects and custom names with multiple brackets.
- All 15 browser suites pass (329 checks): the full regression run passed the other 13 suites; `app-families` (19) and `app-tally-scale` (100) were rerun successfully after their assertions were updated for the new headers/names. Existing data, logging, editing, Strong import, parity, charts, themes and German checks stay covered.
- TypeScript and fresh iOS/Android exports pass.
- The repository has no lint configuration. Expo's automatic lint setup did not produce a usable run; its generated config and dependency changes were removed and the locked dependencies restored.

The screenshots are committed for review and removed in the immediately following commit. The PR links their original commit.
