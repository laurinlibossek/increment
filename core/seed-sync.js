// Shared by first start, catalogue upgrades and backup restore.
import { SEED_EXERCISES } from './seed.js';
import { familyOf } from './exercise-families.js';

const nameKey = (name) => String(name).trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Return only records that must be added or updated. Existing ids always win:
 * hidden/renamed built-ins and their settings stay untouched. A user's own
 * exercise with a new built-in's name keeps its id and history and gains the
 * catalogue family (unless it already chose a family). No history is moved.
 * `seedExercises` is injectable for backups from older callers and unit tests.
 */
export function seedExerciseChanges(exercises, seedExercises = SEED_EXERCISES) {
  const all = exercises instanceof Map ? [...exercises.values()] : [...exercises];
  const ids = new Set(all.map((e) => e.id));
  const names = new Map();
  for (const e of all) {
    const key = nameKey(e.name);
    if (!names.has(key)) names.set(key, []);
    names.get(key).push(e);
  }
  const changes = new Map();
  for (const seed of seedExercises) {
    if (ids.has(seed.id)) continue;
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
      ids.add(added.id);
      names.set(nameKey(added.name), [added]);
    }
  }
  return [...changes.values()];
}

/** Apply the patch without mutating the library or its exercise objects. */
export function withSeedExercises(exercises, seedExercises = SEED_EXERCISES) {
  const records = new Map(exercises.map((e) => [e.id, e]));
  for (const e of seedExerciseChanges(exercises, seedExercises)) records.set(e.id, e);
  return [...records.values()];
}
