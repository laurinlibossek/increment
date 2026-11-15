// @ts-check
// Shared by first start, catalogue upgrades and backup restore.
import { SEED_EXERCISES, regionOf } from './seed.js';
import { familyOf } from './exercise-families.js';
import { nameKey } from './search.js';

// The 18 seed-4 region moves. Every other v3 value is the new muscle's region.
/** @type {Record<string, import('./types.js').Region>} */
const V3_REGION = {
  'x-close-grip-bench-press-barbell': 'arms',
  'x-close-grip-bench-press-smith-machine': 'arms',
  'x-farmer-s-walk-dumbbell': 'full',
  'x-back-extension': 'back',
  'x-back-extension-barbell': 'back',
  'x-back-extension-weighted': 'back',
  'x-deadlift-barbell': 'back',
  'x-deadlift-trap-bar': 'back',
  'x-sumo-deadlift-barbell': 'back',
  'x-deficit-deadlift-barbell': 'back',
  'x-paused-deadlift-barbell': 'back',
  'x-rack-pull-barbell': 'back',
  'x-reverse-hyperextension-machine': 'back',
  'x-kettlebell-swing': 'full',
  'x-external-rotation-dumbbell': 'shoulders',
  'x-external-rotation-cable': 'shoulders',
  'x-tibialis-raise': 'legs',
  'x-tibialis-raise-machine': 'legs',
};

// Seed 5: built-ins cut in #45 that libraries from before 12 Nov 2026 still
// hold. The seed-4 upgrade only knew the 306 kept ones, so these kept a region
// (Back, Shoulders, Arms, Legs). Old value, then the main muscle by the same
// rule as the catalogue. The other 43 cut ones were Chest, Core, Full body,
// Cardio or Other, which are already muscle ids.
/** @type {Record<string, [import('./types.js').Region, import('./types.js').Muscle]>} */
const RETIRED_MUSCLES = {
  'x-bench-dip': ['arms', 'triceps'], // Bench Dip
  'x-deadlift-dumbbell': ['back', 'glutes'], // Deadlift (Dumbbell)
  'x-block-pull-barbell': ['back', 'glutes'], // Block Pull (Barbell)
  'x-romanian-deadlift-trap-bar': ['legs', 'hamstrings'], // Romanian Deadlift (Trap Bar)
  'x-single-leg-romanian-deadlift-kettlebell': ['legs', 'hamstrings'], // Single Leg Romanian Deadlift (Kettlebell)
  'x-b-stance-romanian-deadlift-dumbbell': ['legs', 'hamstrings'], // B Stance Romanian Deadlift (Dumbbell)
  'x-chest-supported-row-cable': ['back', 'upper_back'], // Chest Supported Row (Cable)
  'x-seal-row-dumbbell': ['back', 'upper_back'], // Seal Row (Dumbbell)
  'x-inverted-row': ['back', 'upper_back'], // Inverted Row
  'x-row-band': ['back', 'upper_back'], // Row (Band)
  'x-pull-up-band': ['back', 'lats'], // Pull Up (Band)
  'x-neutral-grip-pull-up-weighted': ['back', 'lats'], // Neutral Grip Pull Up (Weighted)
  'x-shrug-trap-bar': ['back', 'upper_back'], // Shrug (Trap Bar)
  'x-shrug-cable': ['back', 'upper_back'], // Shrug (Cable)
  'x-overhead-press-kettlebell': ['shoulders', 'front_delts'], // Overhead Press (Kettlebell)
  'x-overhead-press-cable': ['shoulders', 'front_delts'], // Overhead Press (Cable)
  'x-single-arm-overhead-press-dumbbell': ['shoulders', 'front_delts'], // Single Arm Overhead Press (Dumbbell)
  'x-z-press-dumbbell': ['shoulders', 'front_delts'], // Z Press (Dumbbell)
  'x-push-press-dumbbell': ['shoulders', 'front_delts'], // Push Press (Dumbbell)
  'x-lateral-raise-band': ['shoulders', 'side_delts'], // Lateral Raise (Band)
  'x-front-raise-barbell': ['shoulders', 'front_delts'], // Front Raise (Barbell)
  'x-front-raise-plate': ['shoulders', 'front_delts'], // Front Raise (Plate)
  'x-upright-row-barbell': ['shoulders', 'side_delts'], // Upright Row (Barbell)
  'x-upright-row-smith-machine': ['shoulders', 'side_delts'], // Upright Row (Smith Machine)
  'x-face-pull-band': ['shoulders', 'rear_delts'], // Face Pull (Band)
  'x-reverse-fly-dumbbell': ['shoulders', 'rear_delts'], // Reverse Fly (Dumbbell)
  'x-reverse-fly-band': ['shoulders', 'rear_delts'], // Reverse Fly (Band)
  'x-external-rotation-band': ['shoulders', 'other'], // External Rotation (Band)
  'x-bicep-curl-band': ['arms', 'biceps'], // Bicep Curl (Band)
  'x-hammer-curl-band': ['arms', 'biceps'], // Hammer Curl (Band)
  'x-cross-body-hammer-curl-dumbbell': ['arms', 'biceps'], // Cross Body Hammer Curl (Dumbbell)
  'x-triceps-pushdown-band': ['arms', 'triceps'], // Triceps Pushdown (Band)
  'x-squat-dumbbell': ['legs', 'quads'], // Squat (Dumbbell)
  'x-squat-bodyweight': ['legs', 'quads'], // Squat (Bodyweight)
  'x-hack-squat-barbell': ['legs', 'quads'], // Hack Squat (Barbell)
  'x-goblet-squat-kettlebell': ['legs', 'quads'], // Goblet Squat (Kettlebell)
  'x-bulgarian-split-squat': ['legs', 'quads'], // Bulgarian Split Squat
  'x-lunge': ['legs', 'quads'], // Lunge
  'x-lateral-lunge-dumbbell': ['legs', 'quads'], // Lateral Lunge (Dumbbell)
  'x-step-up-barbell': ['legs', 'quads'], // Step Up (Barbell)
  'x-step-up-bodyweight': ['legs', 'quads'], // Step Up (Bodyweight)
  'x-seated-good-morning-barbell': ['legs', 'glutes'], // Seated Good Morning (Barbell)
  'x-sliding-leg-curl': ['legs', 'hamstrings'], // Sliding Leg Curl
  'x-nordic-hamstring-curl-band': ['legs', 'hamstrings'], // Nordic Hamstring Curl (Band)
  'x-hip-thrust-bodyweight': ['legs', 'glutes'], // Hip Thrust (Bodyweight)
  'x-glute-bridge': ['legs', 'glutes'], // Glute Bridge
  'x-single-leg-hip-thrust': ['legs', 'glutes'], // Single Leg Hip Thrust
  'x-single-leg-glute-bridge': ['legs', 'glutes'], // Single Leg Glute Bridge
  'x-glute-kickback-band': ['legs', 'glutes'], // Glute Kickback (Band)
  'x-hip-abduction-band': ['legs', 'glutes'], // Hip Abduction (Band)
  'x-standing-calf-raise-bodyweight': ['legs', 'calves'], // Standing Calf Raise (Bodyweight)
  'x-seated-calf-raise-dumbbell': ['legs', 'calves'], // Seated Calf Raise (Dumbbell)
  'x-box-jump': ['legs', 'quads'], // Box Jump
};

/**
 * Return only records that must be added or updated. Existing ids keep their
 * settings, except that a built-in still holding its old region gets its main
 * muscle: seed 4 for the catalogue (its v3 value), seed 5 for the built-ins cut
 * in #45. Hidden/renamed built-ins upgrade too. A user's own
 * exercise with a new built-in's name keeps its id and history and gains the
 * catalogue family (unless it already chose a family). No history is moved.
 * `seedExercises` is injectable for backups from older callers and unit tests.
 * @param {any[] | Map<string, any>} exercises
 * @param {any[]} [seedExercises]
 * @returns {any[]}
 */
export function seedExerciseChanges(exercises, seedExercises = SEED_EXERCISES) {
  const all = exercises instanceof Map ? [...exercises.values()] : [...exercises];
  const records = new Map(all.map((e) => [e.id, e]));
  /** @type {Map<string, any[]>} */
  const names = new Map();
  for (const e of all) {
    const key = nameKey(e.name);
    let same = names.get(key);
    if (!same) names.set(key, same = []);
    same.push(e);
  }
  const changes = new Map();
  for (const seed of seedExercises) {
    const stored = records.get(seed.id);
    if (stored) {
      if (stored.builtin && stored.bodyPart !== seed.bodyPart
          && stored.bodyPart === (V3_REGION[seed.id] || regionOf(seed.bodyPart))) {
        changes.set(stored.id, { ...stored, bodyPart: seed.bodyPart });
      }
      continue;
    }
    const matches = names.get(nameKey(seed.name));
    if (matches) {
      for (const match of matches) {
        const family = familyOf(seed);
        if (!match.builtin && family && familyOf(match) === undefined) {
          changes.set(match.id, { ...match, family });
        }
      }
    } else {
      const added = { ...seed };
      changes.set(added.id, added);
      records.set(added.id, added);
      names.set(nameKey(added.name), [added]);
    }
  }
  for (const stored of all) {
    const retired = Object.hasOwn(RETIRED_MUSCLES, stored.id) ? RETIRED_MUSCLES[stored.id] : undefined;
    if (retired && stored.builtin && stored.bodyPart === retired[0]) changes.set(stored.id, { ...stored, bodyPart: retired[1] });
  }
  return [...changes.values()];
}

/** Apply the patch without mutating the library or its exercise objects. @param {any[]} exercises @param {any[]} [seedExercises] @returns {any[]} */
export function withSeedExercises(exercises, seedExercises = SEED_EXERCISES) {
  const records = new Map(exercises.map((e) => [e.id, e]));
  for (const e of seedExerciseChanges(exercises, seedExercises)) records.set(e.id, e);
  return [...records.values()];
}
