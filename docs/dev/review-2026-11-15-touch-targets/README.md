# Touch-target review — 15 Nov 2026

164 original Chromium captures: 41 screens/states, before and after, light and dark. Each image is 390 × 844 CSS px at DPR 1; the narrow workout is 320 × 844. No image resizing or editing is applied to these files.

Before: main at `f7a3684`. After: implementation at `b6e5756`.

Serve the baseline and branch separately, then use the suite from the branch:

```sh
REVIEW=1 REVIEW_BEFORE=1 APP=http://localhost:8791 node tests/browser/app-touch-targets.mjs
REVIEW=1 APP=http://localhost:8790 node tests/browser/app-touch-targets.mjs
```

The fixture comes from `tests/browser/data/setlog-backup.json`, with workout timestamps shifted so the latest workout starts yesterday at noon. Its first routine exercise uses logged Bench Press to cover a long last-time line. The clock advances in fixed steps so menus finish fading in and timer labels settle. Body-weight and summary baseline captures were refreshed from the same regenerated fixture used by the final captures.

Visible changes: 44 pt search capsules and warm-up inputs; the rest tag becomes a separate target, which can wrap the last-time text and needs clearance before an exercise note; horizontal chip strips expose an extra pixel at each clipping edge so their padded targets are usable. Review the 320 px workout and the workout with a note for the rest-line tradeoff. Other web surfaces preserve their visible shapes and spacing. The native iOS keyboard accessory bar cannot be captured in Chromium.

These files are removed in the immediately following commit, as AGENTS.md requires. PR image links point to this capture commit.
