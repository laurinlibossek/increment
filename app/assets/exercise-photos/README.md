# Exercise photos (trial)

A trial of photo thumbnails instead of the drawings (#46, #51). They're shown only in a build with `EXPO_PUBLIC_ENABLE_EXERCISE_PHOTOS=1`, which also turns the tiles on. Without it, Metro leaves these files out of the bundle.

- **Source:** [Open Exercise Illustrations](https://github.com/hitmanrepo/open-exercise-illustrations), CC0 1.0 (public domain, no credit required). The images are AI-generated 3D renders that no coach has reviewed, so form details can be off.
- **What's here:** one 168 px square WebP per source image, cropped around the figure by `scripts/exercise-photos.py`. The script also writes `manifest.json` (every built-in with its image and frame, or `null`) and `app/src/lib/exercisePhotos.ts`.
- **Matches:**
  - 177 built-ins are an exact match (same movement and equipment).
  - 48 use a stand-in: a variant that looks the same in a still, such as Paused Bench Press showing a bench press.
  - 81 have no image and keep the drawing or the letter.
  - Different equipment never counts as a match.
- **Rebuild:** clone the source, then run `python3 scripts/exercise-photos.py <clone>` (needs Pillow).
