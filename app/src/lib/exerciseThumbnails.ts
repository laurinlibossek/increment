// Hidden until #51 supplies and approves every built-in drawing. Browser review
// builds opt in; release builds leave this unset (no tile or extra spacing).
export const ENABLE_EXERCISE_THUMBNAILS = process.env.EXPO_PUBLIC_ENABLE_EXERCISE_THUMBNAILS === '1';
