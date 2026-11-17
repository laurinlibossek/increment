# Account → Workouts: reminder to log sets

Same fixture at 375 × 812 CSS pixels, DPR 1, English and German, light and dark. Before: main at `bfe96e6`. After: #117 implementation. German enabled for both builds.

Captured with `tests/browser/review-log-reminder.mjs`, using `APP` and `REVIEW_BEFORE=1` for the baseline.

| | Before | After |
|---|---|---|
| English, light | ![](before/en-light.png) | ![](after/en-light.png) |
| English, dark | ![](before/en-dark.png) | ![](after/en-dark.png) |
| German, light | ![](before/de-light.png) | ![](after/de-light.png) |
| German, dark | ![](before/de-dark.png) | ![](after/de-dark.png) |

Browser suites cannot show a native notification. No notification screenshot is included; delivery and taps need the phone checks listed in the backlog.
