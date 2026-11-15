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

/**
 * Return only records that must be added or updated. Existing ids keep their
 * settings, except seed 4 upgrades a built-in whose bodyPart is its v3 region.
 * Hidden/renamed built-ins upgrade too. A user's own
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
  return [...changes.values()];
}

/** Apply the patch without mutating the library or its exercise objects. @param {any[]} exercises @param {any[]} [seedExercises] @returns {any[]} */
export function withSeedExercises(exercises, seedExercises = SEED_EXERCISES) {
  const records = new Map(exercises.map((e) => [e.id, e]));
  for (const e of seedExerciseChanges(exercises, seedExercises)) records.set(e.id, e);
  return [...records.values()];
}
