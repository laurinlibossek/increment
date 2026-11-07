# Search navigation review

English captures of the web build at 390 × 844 CSS pixels (iPhone 13 emulation), using the same store demo data in both versions. Before is `f78e363`; after is this branch. Each tab capture includes its large-title header and bottom bar; the tab bar also has a separate crop. Search is focused in both versions.

| Screen | Light before | Light after | Dark before | Dark after |
| --- | --- | --- | --- | --- |
| Today | [Before](before-en-light-today.png) | [After](after-en-light-today.png) | [Before](before-en-dark-today.png) | [After](after-en-dark-today.png) |
| Plan | [Before](before-en-light-plan.png) | [After](after-en-light-plan.png) | [Before](before-en-dark-plan.png) | [After](after-en-dark-plan.png) |
| Progress | [Before](before-en-light-progress.png) | [After](after-en-light-progress.png) | [Before](before-en-dark-progress.png) | [After](after-en-dark-progress.png) |
| Search | [Before](before-en-light-search.png) | [After](after-en-light-search.png) | [Before](before-en-dark-search.png) | [After](after-en-dark-search.png) |
| Tab bar | [Before](before-en-light-tab-bar.png) | [After](after-en-light-tab-bar.png) | [Before](before-en-dark-tab-bar.png) | [After](after-en-dark-tab-bar.png) |

Reproduce with `tests/browser/review-search-navigation.mjs`, passing `before` or `after` and the corresponding served English build URL. See the script for commands. These captures use Material icons and the browser's font; native iPhone uses SF Symbols and SF Pro.
