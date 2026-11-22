// Hidden until #51 supplies and approves every built-in drawing. Browser review
// builds opt in; release builds leave this unset (no tile or extra spacing).
// Trial: EXPO_PUBLIC_ENABLE_EXERCISE_PHOTOS=1 shows the tiles with the CC0 photos
// from scripts/exercise-photos.py where a built-in has one (ExerciseThumbnail.tsx).
export const ENABLE_EXERCISE_PHOTOS = process.env.EXPO_PUBLIC_ENABLE_EXERCISE_PHOTOS === '1';
export const ENABLE_EXERCISE_THUMBNAILS = process.env.EXPO_PUBLIC_ENABLE_EXERCISE_THUMBNAILS === '1' || ENABLE_EXERCISE_PHOTOS;
