// @ts-check
// Built-in exercise library and example templates.
// Names follow the common "Movement (Equipment)" convention so a Strong CSV
// import lines up with these entries automatically.
// Labels and example names are English; they double as translation keys in the apps.
import { slug } from './units.js';
import { EXERCISE_CATALOGUE, UNILATERAL_IDS } from './exercise-catalogue.js';

export const CATEGORIES = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'machine', label: 'Machine / Other' },
  { id: 'weighted_bw', label: 'Weighted bodyweight' },
  { id: 'assisted_bw', label: 'Assisted bodyweight' },
  { id: 'reps', label: 'Reps only' },
  { id: 'cardio', label: 'Cardio (distance + time)' },
  { id: 'duration', label: 'Duration' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
/** What each kind of exercise logs, shown under the choice when creating one. */
export const CATEGORY_HELP = {
  barbell: 'Weight × reps. Gets the plate calculator and warm-up sets.',
  dumbbell: 'Weight × reps. Enter the weight of one dumbbell.',
  machine: 'Weight × reps for machines, cables, kettlebells and anything else with a load.',
  weighted_bw: 'Extra weight × reps (belt, vest). Leave the weight at 0 for plain bodyweight.',
  assisted_bw: 'Assistance weight × reps. Less assistance means progress.',
  reps: 'Reps only, e.g. push-ups or pull-ups.',
  cardio: 'Distance and time, with pace.',
  duration: 'Time only, e.g. planks.',
};

/** @type {{ id: import('./types.js').Region, label: string }[]} */
export const BODY_PARTS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
  { id: 'full', label: 'Full body' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'other', label: 'Other' },
];
/** Sixteen main muscles, then the three non-muscle choices, in browsing order.
 * @type {import('./types.js').MuscleDefinition[]} */
export const MUSCLES = [
  { id: 'chest', label: 'Chest', region: 'chest' },
  { id: 'lats', label: 'Lats', region: 'back' },
  { id: 'upper_back', label: 'Upper back', region: 'back' },
  { id: 'lower_back', label: 'Lower back', region: 'back' },
  { id: 'front_delts', label: 'Front delts', region: 'shoulders' },
  { id: 'side_delts', label: 'Side delts', region: 'shoulders' },
  { id: 'rear_delts', label: 'Rear delts', region: 'shoulders' },
  { id: 'biceps', label: 'Biceps', region: 'arms' },
  { id: 'triceps', label: 'Triceps', region: 'arms' },
  { id: 'forearms', label: 'Forearms', region: 'arms' },
  { id: 'quads', label: 'Quads', region: 'legs' },
  { id: 'hamstrings', label: 'Hamstrings', region: 'legs' },
  { id: 'glutes', label: 'Glutes', region: 'legs' },
  { id: 'adductors', label: 'Adductors', region: 'legs' },
  { id: 'calves', label: 'Calves', region: 'legs' },
  { id: 'core', label: 'Core', region: 'core' },
  { id: 'full', label: 'Full body', region: 'full' },
  { id: 'cardio', label: 'Cardio', region: 'cardio' },
  { id: 'other', label: 'Other', region: 'other' },
];
/** Labels for current muscles AND legacy regions. @type {Record<string, string>} */
export const BODY_PART_LABEL = Object.fromEntries([...BODY_PARTS, ...MUSCLES].map((b) => [b.id, b.label]));

/** @param {string | null | undefined} part @returns {import('./types.js').Region} */
export function regionOf(part) {
  return MUSCLES.find((m) => m.id === part)?.region
    || BODY_PARTS.find((r) => r.id === part)?.id || 'other';
}

export const SEED_VERSION = 4;

// Family membership comes from the catalogue by id, never from stored built-ins.
export const SEED_EXERCISES = EXERCISE_CATALOGUE.flatMap((f) =>
  f.members.map((e) => ({ ...e, builtin: true })));

// Example templates. Sets: [type, reps] — weights stay empty so the app shows
// your own previous numbers once you have them. An exercise done one side at a
// time gets each set as a left and a right row (#54), so 3 sets are 3 pairs.
/** @param {string} name @param {number} sets @param {number} reps @param {number} [restSec] */
const ex = (name, sets, reps, restSec) => {
  const exerciseId = 'x-' + slug(name);
  const sides = UNILATERAL_IDS.has(exerciseId) ? ['left', 'right'] : [null];
  return {
    exerciseId,
    restSec,
    sets: Array.from({ length: sets }, () => sides.map((side) => ({ type: 'normal', r: reps, ...(side ? { side } : {}) }))).flat(),
  };
};

export const EXAMPLE_TEMPLATES = [
  {
    id: 'example-push', name: 'Push', folder: 'Push / Pull / Legs', example: true,
    exercises: [
      ex('Bench Press (Barbell)', 3, 8, 150),
      ex('Incline Bench Press (Dumbbell)', 3, 10, 120),
      ex('Seated Overhead Press (Dumbbell)', 3, 10, 120),
      ex('Lateral Raise (Dumbbell)', 3, 15, 60),
      ex('Triceps Pushdown - Rope (Cable)', 3, 12, 60),
    ],
  },
  {
    id: 'example-pull', name: 'Pull', folder: 'Push / Pull / Legs', example: true,
    exercises: [
      ex('Deadlift (Barbell)', 3, 5, 180),
      ex('Lat Pulldown (Cable)', 3, 10, 120),
      ex('Seated Row (Cable)', 3, 10, 120),
      ex('Face Pull (Cable)', 3, 15, 60),
      ex('Bicep Curl (Dumbbell)', 3, 12, 60),
    ],
  },
  {
    id: 'example-legs', name: 'Legs', folder: 'Push / Pull / Legs', example: true,
    exercises: [
      ex('Squat (Barbell)', 3, 6, 180),
      ex('Romanian Deadlift (Barbell)', 3, 8, 150),
      ex('Leg Press (Machine)', 3, 10, 120),
      ex('Lying Leg Curl (Machine)', 3, 12, 90),
      ex('Standing Calf Raise (Machine)', 4, 12, 60),
    ],
  },
  {
    id: 'example-5x5-a', name: 'Strength A', folder: 'Strength 5×5', example: true,
    exercises: [
      ex('Squat (Barbell)', 5, 5, 180),
      ex('Bench Press (Barbell)', 5, 5, 180),
      ex('Bent Over Row (Barbell)', 5, 5, 180),
    ],
  },
  {
    id: 'example-5x5-b', name: 'Strength B', folder: 'Strength 5×5', example: true,
    exercises: [
      ex('Squat (Barbell)', 5, 5, 180),
      ex('Overhead Press (Barbell)', 5, 5, 180),
      ex('Deadlift (Barbell)', 1, 5, 180),
    ],
  },
  {
    id: 'example-full', name: 'Full Body', folder: 'Full body', example: true,
    exercises: [
      ex('Goblet Squat (Dumbbell)', 3, 10, 90),
      ex('Bench Press (Dumbbell)', 3, 10, 90),
      ex('Bent Over One Arm Row (Dumbbell)', 3, 10, 90),
      ex('Hip Thrust (Barbell)', 3, 10, 90),
      { exerciseId: 'x-plank', restSec: 60, sets: [{ type: 'normal', t: 45 }, { type: 'normal', t: 45 }] },
    ],
  },
];

export const MEASUREMENTS = [
  { id: 'bodyweight', label: 'Body weight', kind: 'weight', group: 'core' },
  { id: 'bodyfat', label: 'Body fat', kind: 'percent', group: 'core' },
  { id: 'calories', label: 'Calorie intake', kind: 'kcal', group: 'core' },
  { id: 'neck', label: 'Neck', kind: 'length', group: 'body' },
  { id: 'shoulders', label: 'Shoulders', kind: 'length', group: 'body' },
  { id: 'chest', label: 'Chest', kind: 'length', group: 'body' },
  { id: 'bicep_l', label: 'Left biceps', kind: 'length', group: 'body' },
  { id: 'bicep_r', label: 'Right biceps', kind: 'length', group: 'body' },
  { id: 'forearm_l', label: 'Left forearm', kind: 'length', group: 'body' },
  { id: 'forearm_r', label: 'Right forearm', kind: 'length', group: 'body' },
  { id: 'waist', label: 'Waist', kind: 'length', group: 'body' },
  { id: 'hips', label: 'Hips', kind: 'length', group: 'body' },
  { id: 'thigh_l', label: 'Left thigh', kind: 'length', group: 'body' },
  { id: 'thigh_r', label: 'Right thigh', kind: 'length', group: 'body' },
  { id: 'calf_l', label: 'Left calf', kind: 'length', group: 'body' },
  { id: 'calf_r', label: 'Right calf', kind: 'length', group: 'body' },
];
export const MEASUREMENT_BY_ID = Object.fromEntries(MEASUREMENTS.map((m) => [m.id, m]));
