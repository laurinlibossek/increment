// @ts-check
// Helpers fixed by Laurin on 15 Nov 2026 (#127). Ids looked up by stored
// English name in the current catalogue and 0cf2f6b^ (before the #45 cuts).
// Missing ids have no helpers. Personal choices live on the exercise instead.
import { MUSCLES } from './seed.js';

export const HELPER_SET_WEIGHT = 0.5;

/** @type {Record<string, import('./types.js').Muscle[]>} */
export const BUILTIN_HELPERS = {
  'x-bench-press-barbell': ['triceps', 'front_delts'], // Bench Press (Barbell)
  'x-bench-press-dumbbell': ['triceps', 'front_delts'], // Bench Press (Dumbbell)
  'x-bench-press-smith-machine': ['triceps', 'front_delts'], // Bench Press (Smith Machine)
  'x-incline-bench-press-barbell': ['triceps', 'front_delts'], // Incline Bench Press (Barbell)
  'x-incline-bench-press-dumbbell': ['triceps', 'front_delts'], // Incline Bench Press (Dumbbell)
  'x-incline-bench-press-smith-machine': ['triceps', 'front_delts'], // Incline Bench Press (Smith Machine)
  'x-decline-bench-press-barbell': ['triceps', 'front_delts'], // Decline Bench Press (Barbell)
  'x-decline-bench-press-dumbbell': ['triceps', 'front_delts'], // Decline Bench Press (Dumbbell)
  'x-decline-bench-press-smith-machine': ['triceps', 'front_delts'], // Decline Bench Press (Smith Machine)
  'x-close-grip-bench-press-barbell': ['triceps', 'front_delts'], // Close Grip Bench Press (Barbell)
  'x-close-grip-bench-press-smith-machine': ['triceps', 'front_delts'], // Close Grip Bench Press (Smith Machine)
  'x-bench-press-wide-grip-barbell': ['triceps', 'front_delts'], // Bench Press - Wide Grip (Barbell)
  'x-floor-press-barbell': ['triceps', 'front_delts'], // Floor Press (Barbell)
  'x-floor-press-dumbbell': ['triceps', 'front_delts'], // Floor Press (Dumbbell)
  'x-paused-bench-press-barbell': ['triceps', 'front_delts'], // Paused Bench Press (Barbell)
  'x-spoto-press-barbell': ['triceps', 'front_delts'], // Spoto Press (Barbell)
  'x-pin-bench-press-barbell': ['triceps', 'front_delts'], // Pin Bench Press (Barbell)
  'x-larsen-press-barbell': ['triceps', 'front_delts'], // Larsen Press (Barbell)
  'x-chest-press-machine': ['triceps', 'front_delts'], // Chest Press (Machine)
  'x-chest-press-cable': ['triceps', 'front_delts'], // Chest Press (Cable)
  'x-incline-chest-press-machine': ['triceps', 'front_delts'], // Incline Chest Press (Machine)
  'x-decline-chest-press-machine': ['triceps', 'front_delts'], // Decline Chest Press (Machine)
  'x-iso-lateral-chest-press-machine': ['triceps', 'front_delts'], // Iso-Lateral Chest Press (Machine)
  'x-push-up': ['triceps', 'front_delts'], // Push Up
  'x-push-up-weighted': ['triceps', 'front_delts'], // Push Up (Weighted)
  'x-chest-dip': ['triceps', 'front_delts'], // Chest Dip
  'x-chest-dip-weighted': ['triceps', 'front_delts'], // Chest Dip (Weighted)
  'x-chest-dip-assisted': ['triceps', 'front_delts'], // Chest Dip (Assisted)
  'x-chest-fly-dumbbell': ['front_delts'], // Chest Fly (Dumbbell)
  'x-chest-fly-machine': ['front_delts'], // Chest Fly (Machine)
  'x-chest-fly-cable': ['front_delts'], // Chest Fly (Cable)
  'x-incline-chest-fly-dumbbell': ['front_delts'], // Incline Chest Fly (Dumbbell)
  'x-incline-chest-fly-cable': ['front_delts'], // Incline Chest Fly (Cable)
  'x-decline-chest-fly-dumbbell': ['front_delts'], // Decline Chest Fly (Dumbbell)
  'x-cable-crossover-cable': ['front_delts'], // Cable Crossover (Cable)
  'x-low-cable-fly-cable': ['front_delts'], // Low Cable Fly (Cable)
  'x-single-arm-chest-fly-cable': ['front_delts'], // Single Arm Chest Fly (Cable)
  'x-triceps-dip': ['chest', 'front_delts'], // Triceps Dip
  'x-triceps-dip-weighted': ['chest', 'front_delts'], // Triceps Dip (Weighted)
  'x-triceps-dip-assisted': ['chest', 'front_delts'], // Triceps Dip (Assisted)
  'x-pullover-dumbbell': ['lats'], // Pullover (Dumbbell)
  'x-deadlift-barbell': ['quads', 'adductors'], // Deadlift (Barbell)
  'x-deadlift-trap-bar': ['quads', 'adductors'], // Deadlift (Trap Bar)
  'x-sumo-deadlift-barbell': ['quads', 'adductors'], // Sumo Deadlift (Barbell)
  'x-deficit-deadlift-barbell': ['quads', 'adductors'], // Deficit Deadlift (Barbell)
  'x-paused-deadlift-barbell': ['quads', 'adductors'], // Paused Deadlift (Barbell)
  'x-rack-pull-barbell': ['hamstrings'], // Rack Pull (Barbell)
  'x-reverse-hyperextension-machine': ['hamstrings'], // Reverse Hyperextension (Machine)
  'x-glute-kickback-cable': ['hamstrings'], // Glute Kickback (Cable)
  'x-glute-kickback-machine': ['hamstrings'], // Glute Kickback (Machine)
  'x-cable-pull-through': ['hamstrings'], // Cable Pull Through
  'x-kettlebell-swing': ['hamstrings'], // Kettlebell Swing
  'x-romanian-deadlift-barbell': ['glutes'], // Romanian Deadlift (Barbell)
  'x-romanian-deadlift-dumbbell': ['glutes'], // Romanian Deadlift (Dumbbell)
  'x-romanian-deadlift-smith-machine': ['glutes'], // Romanian Deadlift (Smith Machine)
  'x-stiff-leg-deadlift-barbell': ['glutes'], // Stiff Leg Deadlift (Barbell)
  'x-stiff-leg-deadlift-dumbbell': ['glutes'], // Stiff Leg Deadlift (Dumbbell)
  'x-single-leg-romanian-deadlift-dumbbell': ['glutes'], // Single Leg Romanian Deadlift (Dumbbell)
  'x-back-extension': ['glutes'], // Back Extension
  'x-back-extension-barbell': ['glutes'], // Back Extension (Barbell)
  'x-back-extension-weighted': ['glutes'], // Back Extension (Weighted)
  'x-good-morning-barbell': ['glutes'], // Good Morning (Barbell)
  'x-good-morning-smith-machine': ['glutes'], // Good Morning (Smith Machine)
  'x-glute-ham-raise': ['glutes'], // Glute Ham Raise
  'x-bent-over-row-barbell': ['lats', 'rear_delts', 'biceps'], // Bent Over Row (Barbell)
  'x-bent-over-row-dumbbell': ['lats', 'rear_delts', 'biceps'], // Bent Over Row (Dumbbell)
  'x-bent-over-row-underhand-barbell': ['lats', 'rear_delts', 'biceps'], // Bent Over Row - Underhand (Barbell)
  'x-pendlay-row-barbell': ['lats', 'rear_delts', 'biceps'], // Pendlay Row (Barbell)
  'x-bent-over-one-arm-row-dumbbell': ['lats', 'rear_delts', 'biceps'], // Bent Over One Arm Row (Dumbbell)
  'x-kroc-row-dumbbell': ['lats', 'rear_delts', 'biceps'], // Kroc Row (Dumbbell)
  'x-meadows-row-barbell': ['lats', 'rear_delts', 'biceps'], // Meadows Row (Barbell)
  'x-t-bar-row': ['lats', 'rear_delts', 'biceps'], // T Bar Row
  'x-chest-supported-t-bar-row-machine': ['lats', 'rear_delts', 'biceps'], // Chest Supported T Bar Row (Machine)
  'x-chest-supported-row-dumbbell': ['lats', 'rear_delts', 'biceps'], // Chest Supported Row (Dumbbell)
  'x-chest-supported-row-machine': ['lats', 'rear_delts', 'biceps'], // Chest Supported Row (Machine)
  'x-helms-row-dumbbell': ['lats', 'rear_delts', 'biceps'], // Helms Row (Dumbbell)
  'x-seal-row-barbell': ['lats', 'rear_delts', 'biceps'], // Seal Row (Barbell)
  'x-seated-row-cable': ['lats', 'rear_delts', 'biceps'], // Seated Row (Cable)
  'x-seated-row-machine': ['lats', 'rear_delts', 'biceps'], // Seated Row (Machine)
  'x-seated-wide-grip-row-cable': ['lats', 'rear_delts', 'biceps'], // Seated Wide-Grip Row (Cable)
  'x-single-arm-row-cable': ['lats', 'rear_delts', 'biceps'], // Single Arm Row (Cable)
  'x-iso-lateral-row-machine': ['lats', 'rear_delts', 'biceps'], // Iso-Lateral Row (Machine)
  'x-high-row-machine': ['biceps', 'upper_back'], // High Row (Machine)
  'x-lat-pulldown-cable': ['biceps', 'upper_back'], // Lat Pulldown (Cable)
  'x-lat-pulldown-machine': ['biceps', 'upper_back'], // Lat Pulldown (Machine)
  'x-lat-pulldown-close-grip-cable': ['biceps', 'upper_back'], // Lat Pulldown - Close Grip (Cable)
  'x-lat-pulldown-wide-grip-cable': ['biceps', 'upper_back'], // Lat Pulldown - Wide Grip (Cable)
  'x-lat-pulldown-underhand-cable': ['biceps', 'upper_back'], // Lat Pulldown - Underhand (Cable)
  'x-lat-pulldown-single-arm': ['biceps', 'upper_back'], // Single Arm Lat Pulldown (Cable)
  'x-single-arm-lat-pulldown-machine': ['biceps', 'upper_back'], // Single Arm Lat Pulldown (Machine)
  'x-pull-up': ['biceps', 'upper_back'], // Pull Up
  'x-pull-up-weighted': ['biceps', 'upper_back'], // Pull Up (Weighted)
  'x-pull-up-assisted': ['biceps', 'upper_back'], // Pull Up (Assisted)
  'x-wide-grip-pull-up': ['biceps', 'upper_back'], // Wide Grip Pull Up
  'x-neutral-grip-pull-up': ['biceps', 'upper_back'], // Neutral Grip Pull Up
  'x-chin-up': ['biceps', 'upper_back'], // Chin Up
  'x-chin-up-weighted': ['biceps', 'upper_back'], // Chin Up (Weighted)
  'x-chin-up-assisted': ['biceps', 'upper_back'], // Chin Up (Assisted)
  'x-overhead-press-barbell': ['triceps', 'side_delts'], // Overhead Press (Barbell)
  'x-overhead-press-dumbbell': ['triceps', 'side_delts'], // Overhead Press (Dumbbell)
  'x-seated-overhead-press-dumbbell': ['triceps', 'side_delts'], // Seated Overhead Press (Dumbbell)
  'x-seated-overhead-press-barbell': ['triceps', 'side_delts'], // Seated Overhead Press (Barbell)
  'x-seated-overhead-press-smith-machine': ['triceps', 'side_delts'], // Seated Overhead Press (Smith Machine)
  'x-shoulder-press-machine': ['triceps', 'side_delts'], // Shoulder Press (Machine)
  'x-shoulder-press-smith-machine': ['triceps', 'side_delts'], // Shoulder Press (Smith Machine)
  'x-arnold-press-dumbbell': ['triceps', 'side_delts'], // Arnold Press (Dumbbell)
  'x-z-press-barbell': ['triceps', 'side_delts'], // Z Press (Barbell)
  'x-push-press-barbell': ['triceps', 'side_delts'], // Push Press (Barbell)
  'x-handstand-push-up': ['triceps', 'side_delts'], // Handstand Push Up
  'x-landmine-press-barbell': ['chest', 'triceps'], // Landmine Press (Barbell)
  'x-upright-row-dumbbell': ['upper_back'], // Upright Row (Dumbbell)
  'x-upright-row-cable': ['upper_back'], // Upright Row (Cable)
  'x-y-raise-dumbbell': ['upper_back'], // Y-Raise (Dumbbell)
  'x-y-raise-cable': ['upper_back'], // Y-Raise (Cable)
  'x-lu-raise-dumbbell': ['upper_back'], // Lu Raise (Dumbbell)
  'x-face-pull-cable': ['upper_back'], // Face Pull (Cable)
  'x-reverse-fly-machine': ['upper_back'], // Reverse Fly (Machine)
  'x-reverse-fly-cable': ['upper_back'], // Reverse Fly (Cable)
  'x-chest-supported-reverse-fly-dumbbell': ['upper_back'], // Chest Supported Reverse Fly (Dumbbell)
  'x-hammer-curl-dumbbell': ['forearms'], // Hammer Curl (Dumbbell)
  'x-hammer-curl-cable': ['forearms'], // Hammer Curl (Cable)
  'x-zottman-curl-dumbbell': ['forearms'], // Zottman Curl (Dumbbell)
  'x-reverse-curl-barbell': ['biceps'], // Reverse Curl (Barbell)
  'x-reverse-curl-dumbbell': ['biceps'], // Reverse Curl (Dumbbell)
  'x-reverse-grip-bicep-curl-cable': ['biceps'], // Reverse Grip Bicep Curl (Cable)
  'x-squat-barbell': ['glutes', 'adductors'], // Squat (Barbell)
  'x-squat-smith-machine': ['glutes', 'adductors'], // Squat (Smith Machine)
  'x-front-squat-barbell': ['glutes', 'adductors'], // Front Squat (Barbell)
  'x-front-squat-smith-machine': ['glutes', 'adductors'], // Front Squat (Smith Machine)
  'x-safety-bar-squat-barbell': ['glutes', 'adductors'], // Safety Bar Squat (Barbell)
  'x-zercher-squat-barbell': ['glutes', 'adductors'], // Zercher Squat (Barbell)
  'x-box-squat-barbell': ['glutes', 'adductors'], // Box Squat (Barbell)
  'x-paused-squat-barbell': ['glutes', 'adductors'], // Paused Squat (Barbell)
  'x-pin-squat-barbell': ['glutes', 'adductors'], // Pin Squat (Barbell)
  'x-hack-squat-machine': ['glutes', 'adductors'], // Hack Squat (Machine)
  'x-squat-press-machine': ['glutes', 'adductors'], // Squat Press (Machine)
  'x-pendulum-squat-machine': ['glutes', 'adductors'], // Pendulum Squat (Machine)
  'x-belt-squat-machine': ['glutes', 'adductors'], // Belt Squat (Machine)
  'x-goblet-squat-dumbbell': ['glutes', 'adductors'], // Goblet Squat (Dumbbell)
  'x-pistol-squat': ['glutes', 'adductors'], // Pistol Squat
  'x-leg-press-machine': ['glutes', 'adductors'], // Leg Press (Machine)
  'x-seated-leg-press-machine': ['glutes', 'adductors'], // Seated Leg Press (Machine)
  'x-single-leg-press-machine': ['glutes', 'adductors'], // Single Leg Press (Machine)
  'x-split-squat-barbell': ['glutes', 'adductors'], // Split Squat (Barbell)
  'x-split-squat-dumbbell': ['glutes', 'adductors'], // Split Squat (Dumbbell)
  'x-split-squat-smith-machine': ['glutes', 'adductors'], // Split Squat (Smith Machine)
  'x-bulgarian-split-squat-dumbbell': ['glutes', 'adductors'], // Bulgarian Split Squat (Dumbbell)
  'x-bulgarian-split-squat-barbell': ['glutes', 'adductors'], // Bulgarian Split Squat (Barbell)
  'x-bulgarian-split-squat-smith-machine': ['glutes', 'adductors'], // Bulgarian Split Squat (Smith Machine)
  'x-front-foot-elevated-split-squat-dumbbell': ['glutes', 'adductors'], // Front Foot Elevated Split Squat (Dumbbell)
  'x-lunge-dumbbell': ['glutes', 'adductors'], // Lunge (Dumbbell)
  'x-lunge-barbell': ['glutes', 'adductors'], // Lunge (Barbell)
  'x-walking-lunge-dumbbell': ['glutes', 'adductors'], // Walking Lunge (Dumbbell)
  'x-walking-lunge-barbell': ['glutes', 'adductors'], // Walking Lunge (Barbell)
  'x-reverse-lunge-barbell': ['glutes', 'adductors'], // Reverse Lunge (Barbell)
  'x-reverse-lunge-dumbbell': ['glutes', 'adductors'], // Reverse Lunge (Dumbbell)
  'x-reverse-lunge-smith-machine': ['glutes', 'adductors'], // Reverse Lunge (Smith Machine)
  'x-deficit-reverse-lunge-dumbbell': ['glutes', 'adductors'], // Deficit Reverse Lunge (Dumbbell)
  'x-step-up-dumbbell': ['glutes', 'adductors'], // Step Up (Dumbbell)
  'x-step-up-cable': ['glutes', 'adductors'], // Step Up (Cable)
  // Built-ins cut in #45; older libraries keep these ids.
  'x-neutral-grip-bench-press-dumbbell': ['triceps', 'front_delts'], // Neutral Grip Bench Press (Dumbbell)
  'x-push-up-band': ['triceps', 'front_delts'], // Push Up (Band)
  'x-incline-push-up': ['triceps', 'front_delts'], // Incline Push Up
  'x-decline-push-up': ['triceps', 'front_delts'], // Decline Push Up
  'x-deficit-push-up': ['triceps', 'front_delts'], // Deficit Push Up
  'x-close-grip-push-up': ['triceps', 'front_delts'], // Close Grip Push Up
  'x-wide-grip-push-up': ['triceps', 'front_delts'], // Wide Grip Push Up
  'x-ring-push-up': ['triceps', 'front_delts'], // Ring Push Up
  'x-bench-dip': ['chest', 'front_delts'], // Bench Dip
  'x-deadlift-dumbbell': ['quads', 'adductors'], // Deadlift (Dumbbell)
  'x-block-pull-barbell': ['hamstrings'], // Block Pull (Barbell)
  'x-glute-kickback-band': ['hamstrings'], // Glute Kickback (Band)
  'x-romanian-deadlift-trap-bar': ['glutes'], // Romanian Deadlift (Trap Bar)
  'x-single-leg-romanian-deadlift-kettlebell': ['glutes'], // Single Leg Romanian Deadlift (Kettlebell)
  'x-b-stance-romanian-deadlift-dumbbell': ['glutes'], // B Stance Romanian Deadlift (Dumbbell)
  'x-chest-supported-row-cable': ['lats', 'rear_delts', 'biceps'], // Chest Supported Row (Cable)
  'x-seal-row-dumbbell': ['lats', 'rear_delts', 'biceps'], // Seal Row (Dumbbell)
  'x-inverted-row': ['lats', 'rear_delts', 'biceps'], // Inverted Row
  'x-row-band': ['lats', 'rear_delts', 'biceps'], // Row (Band)
  'x-pull-up-band': ['biceps', 'upper_back'], // Pull Up (Band)
  'x-neutral-grip-pull-up-weighted': ['biceps', 'upper_back'], // Neutral Grip Pull Up (Weighted)
  'x-overhead-press-kettlebell': ['triceps', 'side_delts'], // Overhead Press (Kettlebell)
  'x-overhead-press-cable': ['triceps', 'side_delts'], // Overhead Press (Cable)
  'x-single-arm-overhead-press-dumbbell': ['triceps', 'side_delts'], // Single Arm Overhead Press (Dumbbell)
  'x-z-press-dumbbell': ['triceps', 'side_delts'], // Z Press (Dumbbell)
  'x-push-press-dumbbell': ['triceps', 'side_delts'], // Push Press (Dumbbell)
  'x-upright-row-barbell': ['upper_back'], // Upright Row (Barbell)
  'x-upright-row-smith-machine': ['upper_back'], // Upright Row (Smith Machine)
  'x-face-pull-band': ['upper_back'], // Face Pull (Band)
  'x-reverse-fly-dumbbell': ['upper_back'], // Reverse Fly (Dumbbell)
  'x-reverse-fly-band': ['upper_back'], // Reverse Fly (Band)
  'x-hammer-curl-band': ['forearms'], // Hammer Curl (Band)
  'x-cross-body-hammer-curl-dumbbell': ['forearms'], // Cross Body Hammer Curl (Dumbbell)
  'x-squat-dumbbell': ['glutes', 'adductors'], // Squat (Dumbbell)
  'x-squat-bodyweight': ['glutes', 'adductors'], // Squat (Bodyweight)
  'x-hack-squat-barbell': ['glutes', 'adductors'], // Hack Squat (Barbell)
  'x-goblet-squat-kettlebell': ['glutes', 'adductors'], // Goblet Squat (Kettlebell)
  'x-bulgarian-split-squat': ['glutes', 'adductors'], // Bulgarian Split Squat
  'x-lunge': ['glutes', 'adductors'], // Lunge
  'x-lateral-lunge-dumbbell': ['glutes', 'adductors'], // Lateral Lunge (Dumbbell)
  'x-step-up-barbell': ['glutes', 'adductors'], // Step Up (Barbell)
  'x-step-up-bodyweight': ['glutes', 'adductors'], // Step Up (Bodyweight)
};

// Full body counts on Today but is never a helper; neither are regions.
/** @type {Set<string>} */
const helperIds = new Set(MUSCLES.filter((m) => !['full', 'cardio', 'other'].includes(m.id)).map((m) => m.id));

/**
 * Own choices (an empty array too) win over the table. Filter at read time so
 * changing a main muscle never counts it twice. Pair sets before weighting.
 * @param {{ id: string, bodyPart?: string, helpers?: unknown } | null | undefined} exercise
 * @returns {import('./types.js').Muscle[]}
 */
export function helpersOf(exercise) {
  if (!exercise || !(helperIds.has(exercise.bodyPart || '') || exercise.bodyPart === 'full')) return [];
  const choices = Array.isArray(exercise.helpers) ? exercise.helpers
    : Object.hasOwn(BUILTIN_HELPERS, exercise.id) ? BUILTIN_HELPERS[exercise.id] : [];
  return [...new Set(choices)].filter((id) => helperIds.has(id) && id !== exercise.bodyPart).slice(0, 3);
}

/** A set total in halves, without decimal punctuation. @param {number} n */
export function halfText(n) {
  const whole = Math.floor(n);
  return n % 1 ? `${whole || ''}½` : String(whole);
}
