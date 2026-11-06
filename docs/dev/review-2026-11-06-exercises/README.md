# Exercise families — catalogue/core review

[Every family and exercise](catalogue.md): 97 families, 406 exercises, 216 new; English, German, logging fields/category, body part and stable id. New entries and proposed corrections are marked. Generated from the catalogue with `node scripts/exercise-review.mjs`.

[Movement source checks and questions](../exercise-sources.md) and [the family rules](../../design/exercises.md).

Search screenshots: fresh library, emulated iPhone 13 (390 CSS px), same top-of-list view, no workout data. The layout still shows one row per exercise. Only the catalogue, names and total change. Captured with `tests/browser/exercise-review-shots.mjs` against detached main `c96e59b` and this branch. There are no other screen changes.

| Language / theme | Before | After |
|---|---|---|
| English / light | ![Before](before-search-en-light.png) | ![After](after-search-en-light.png) |
| English / dark | ![Before](before-search-en-dark.png) | ![After](after-search-en-dark.png) |
| German / light | ![Before](before-search-de-light.png) | ![After](after-search-de-light.png) |
| German / dark | ![Before](before-search-de-dark.png) | ![After](after-search-de-dark.png) |

These assets are committed for review and removed in the following commit. The PR links to this commit so the table and screenshots remain reviewable.
