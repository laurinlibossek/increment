# Exercise families — revised catalogue review

[Every family and exercise](catalogue.md): 87 families, 392 exercises, 202 new; English, German, logging fields/category, body part and stable id. New entries and proposed corrections are marked. Generated with `node scripts/exercise-review.mjs`.

This revision removes 14 additions covering sports/classes, generic recovery labels, conditioning fillers and redundant cardio variants. The only new cardio entries are Walking (Treadmill) and Recumbent Bike. All original 190 entries remain unchanged. [Selection rules](../../design/exercises.md) and [the removed-entry list](../exercise-sources.md).

Search screenshots: fresh library, emulated iPhone 13 (390 CSS px), same top-of-list view, no workout data. Before is main `c96e59b` (190); after is this revised catalogue (392). Captured with `tests/browser/exercise-review-shots.mjs`.

| Language / theme | Before | After |
|---|---|---|
| English / light | ![Before](before-search-en-light.png) | ![After](after-search-en-light.png) |
| English / dark | ![Before](before-search-en-dark.png) | ![After](after-search-en-dark.png) |
| German / light | ![Before](before-search-de-light.png) | ![After](after-search-de-light.png) |
| German / dark | ![Before](before-search-de-dark.png) | ![After](after-search-de-dark.png) |

These assets are committed for review and removed in the following commit. The PR links to this commit so the table and screenshots remain reviewable.
