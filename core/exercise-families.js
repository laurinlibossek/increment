// Families help people find and swap variations. History always uses exercise id.
import { EXERCISE_CATALOGUE } from './exercise-catalogue.js';
import { SEED_EXERCISES } from './seed.js';
import { exerciseBaseName } from './search.js';
import { exerciseEquipment, compareExerciseEquipment } from './exercise-equipment.js';

/** English/German family names and ordered exercise ids; no stored migration. */
export const EXERCISE_FAMILIES = EXERCISE_CATALOGUE.map(({ members, ...family }) => ({
  ...family, members: members.map((e) => e.id),
}));
export const FAMILY_BY_ID = Object.fromEntries(EXERCISE_FAMILIES.map((f) => [f.id, f]));
const familyByExerciseId = new Map(EXERCISE_FAMILIES.flatMap((f) => f.members.map((id) => [id, f.id])));
const memberOrder = new Map(SEED_EXERCISES.map((e, i) => [e.id, i]));

/**
 * Family id, or undefined for an ungrouped custom exercise. An explicit family
 * wins, including null (opt out) and ids for custom families introduced later.
 * Renaming/hiding a built-in cannot change its catalogue membership.
 */
export function familyOf(ex) {
  if (!ex) return undefined;
  if (ex.family !== undefined) return ex.family;
  return familyByExerciseId.get(ex.id);
}

/**
 * Members present in the supplied library, in catalogue order; custom members
 * follow in their input order. Uses the actual stored objects (names, categories,
 * hidden flags), never copies from the catalogue. Accepts an array or a Map.
 * Hidden exercises are excluded unless includeHidden is true.
 */
export function familyMembers(familyId, exercises = SEED_EXERCISES, { includeHidden = false } = {}) {
  if (!familyId) return [];
  const all = exercises instanceof Map ? [...exercises.values()] : [...exercises];
  return all.filter((e) => familyOf(e) === familyId && (includeHidden || !e.hidden))
    .sort((a, b) => (memberOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (memberOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Family → exercise base name → equipment entries. Names here stay English;
 * screens translate each actual exercise when rendering. Weighted/assisted
 * versions share a base group but retain their own id and logging category.
 * A group starts with its usual version (the first built-in the catalogue lists
 * for it: Push Up before Push Up (Band), Lat Pulldown (Cable) before (Machine));
 * the others, custom members included, follow the common equipment order.
 */
export function familyMemberGroups(familyId, exercises = SEED_EXERCISES, options = {}) {
  const groups = new Map();
  for (const exercise of familyMembers(familyId, exercises, options)) {
    const name = exerciseBaseName(exercise, 'en');
    if (!groups.has(name)) groups.set(name, { name, members: [] });
    groups.get(name).members.push({ equipment: exerciseEquipment(exercise), exercise });
  }
  return [...groups.values()].map((group) => {
    // familyMembers puts built-ins first in catalogue order, so a group's usual version leads it
    const [first, ...rest] = group.members;
    const lead = memberOrder.has(first.exercise.id) ? [first] : [];
    const others = (lead.length ? rest : group.members).sort((a, b) => compareExerciseEquipment(a.exercise, b.exercise));
    return { ...group, members: [...lead, ...others] };
  });
}
