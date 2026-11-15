# Exercise thumbnails (#50), 15 November 2026

Real web captures at DPR 1: English 375 × 844 CSS px, German 320 × 844 CSS px. Light and dark. The sample contact sheet enlarges the actual app SVGs to 4× (224 px per drawing).

- `before-*`: main at `12bc883`, with German enabled for review.
- `off-*`: `d7c39f5`, thumbnails disabled. Search and Lifts lose their chevrons. The English/German light/dark picker captures are byte-identical to main.
- `on-*`: `d7c39f5`, `EXPO_PUBLIC_ENABLE_EXERCISE_THUMBNAILS=1` and German enabled. The three sample drawings remain drafts for #51; undrawn and custom exercises show letters.

`search-results` shows exact exercises, `search-families` the latest logged target, `picker` the expanded family, and `lifts` the trained exercises. German `search-custom` and `search-long-name` captures check the letter fallback and wrapping at 320 px. The duplicate English name is intentional: one row is a custom exercise and must never borrow the built-in's drawing.

The PNGs are removed in the next commit; pull-request images link to this commit. Reproduce with `tests/browser/app-exercise-thumbnails.mjs` (see the browser README).
