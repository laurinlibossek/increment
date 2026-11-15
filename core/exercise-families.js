// @ts-check
// Families help people find and swap variations. History always uses exercise id.
import { EXERCISE_CATALOGUE } from './exercise-catalogue.js';
import { SEED_EXERCISES, regionOf } from './seed.js';
import { exerciseBaseName } from './search.js';
import { exerciseEquipment, compareExerciseEquipment } from './exercise-equipment.js';
import { slug, uid } from './units.js';

/** English/German family names and ordered exercise ids; no stored migration. */
export const EXERCISE_FAMILIES = EXERCISE_CATALOGUE.map(({ members, ...family }) => ({
  ...family, members: members.map((/** @type {{ id: string }} */ e) => e.id),
}));
export const FAMILY_BY_ID = Object.fromEntries(EXERCISE_FAMILIES.map((f) => [f.id, f]));
/** @type {Map<string, string>} */
const familyByExerciseId = new Map(EXERCISE_FAMILIES.flatMap((f) => f.members.map((/** @type {string} */ id) => /** @type {[string, string]} */ ([id, f.id]))));
const memberOrder = new Map(SEED_EXERCISES.map((e, i) => [e.id, i]));

/**
 * Family id, or undefined for an ungrouped custom exercise. An explicit family
 * wins, including null (opt out) and ids for custom families introduced later.
 * Renaming/hiding a built-in cannot change its catalogue membership.
 * @param {{ id: string, family?: string | null } | null | undefined} ex
 * @returns {string | null | undefined}
 */
export function familyOf(ex) {
  if (!ex) return undefined;
  if (ex.family !== undefined) return ex.family;
  return familyByExerciseId.get(ex.id);
}

/** Catalogue metadata or the person's own family name, unchanged in either language.
 * @param {string | null | undefined} id
 * @param {Record<string, string>} [customFamilies]
 */
export function exerciseFamily(id, customFamilies = {}) {
  if (!id) return undefined;
  if (Object.hasOwn(FAMILY_BY_ID, id)) return FAMILY_BY_ID[id];
  const name = customFamilies[id];
  return /^fc-[a-z0-9-]+$/.test(id) && typeof name === 'string' && name.trim()
    ? { id, name, nameDe: name, members: [] } : undefined;
}

/** Exact English base identity: only the last bracket, case and spaces differ. */
export const exerciseFamilyBaseKey = (/** @type {string} */ name) => exerciseBaseName({ name }, 'en').toLowerCase().replace(/\s+/g, '');

/** Suggest a unique existing family first, otherwise one ungrouped custom exercise.
 * No spelling, partial-word, punctuation or plural matching. Nothing is changed.
 * @param {string} name
 * @param {any[] | Map<string, any>} exercises
 * @param {Record<string, string>} [customFamilies]
 */
export function suggestExerciseFamily(name, exercises, customFamilies = {}) {
  const base = exerciseFamilyBaseKey(name);
  if (!base) return undefined;
  const all = exercises instanceof Map ? [...exercises.values()] : exercises;
  const matches = all.filter((ex) => exerciseFamilyBaseKey(ex.name) === base);
  const grouped = matches.filter((ex) => exerciseFamily(familyOf(ex), customFamilies));
  const families = new Set(grouped.map(familyOf));
  if (families.size > 1) return undefined;
  const exercise = grouped[0] || matches.find((ex) => !ex.builtin && !familyOf(ex));
  if (!exercise) return undefined;
  return { family: exerciseFamily(familyOf(exercise), customFamilies) || null,
    exercise, name: exerciseBaseName(exercise, 'en') };
}

/** Remove empty or damaged custom registry entries. Hidden exercises still belong.
 * @param {Record<string, string>} customFamilies
 * @param {any[] | Map<string, any>} exercises
 * @returns {Record<string, string>}
 */
export function cleanCustomFamilies(customFamilies, exercises) {
  const members = new Set([...(exercises instanceof Map ? exercises.values() : exercises)].map(familyOf));
  return Object.fromEntries(Object.entries(customFamilies || {})
    .filter(([id, name]) => /^fc-[a-z0-9-]+$/.test(id) && typeof name === 'string' && name.trim() && members.has(id)));
}

/** Save an exercise and its staged family choice together, without mutating inputs.
 * A family/exercise id joins that family; an ungrouped picked exercise creates
 * a family named after its base. Null leaves it separate; undefined keeps it.
 * Built-ins retain their catalogue assignment. Other exercise fields stay intact.
 * @param {any} exercise The inserted or updated exercise record.
 * @param {string | null | undefined} selection A family id or picked exercise id.
 * @param {any[] | Map<string, any>} exercises
 * @param {Record<string, string>} [customFamilies]
 * @returns {{ exercises: any[], customFamilies: Record<string, string> }}
 */
export function changeExerciseFamily(exercise, selection, exercises, customFamilies = {}) {
  const all = new Map([...(exercises instanceof Map ? exercises.values() : exercises)].map((ex) => [ex.id, ex]));
  let registry = { ...customFamilies };
  let next = exercise;
  if (!exercise.builtin && !familyByExerciseId.has(exercise.id) && selection !== undefined) {
    /** @type {string | null | undefined} */
    let family = selection;
    if (selection !== null && !exerciseFamily(selection, registry)) {
      const picked = all.get(selection);
      if (!picked || picked.id === exercise.id) family = familyOf(exercise);
      else if (exerciseFamily(familyOf(picked), registry)) family = familyOf(picked);
      else {
        const name = exerciseBaseName(picked, 'en');
        family = 'fc-' + slug(name);
        if (family === 'fc-' || registry[family]) family = 'fc-' + uid();
        registry[family] = name;
        all.set(picked.id, { ...picked, family });
      }
    }
    next = { ...exercise, family };
  }
  all.set(next.id, next);
  const result = [...all.values()];
  return { exercises: result, customFamilies: cleanCustomFamilies(registry, result) };
}

/**
 * Members present in the supplied library, in catalogue order; custom members
 * follow in their input order. Uses the actual stored objects (names, categories,
 * hidden flags), never copies from the catalogue. Accepts an array or a Map.
 * Hidden exercises are excluded unless includeHidden is true.
 * @param {string | null | undefined} familyId
 * @param {any[] | Map<string, any>} [exercises]
 * @returns {any[]}
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
 * @param {string | null | undefined} familyId
 * @param {any[] | Map<string, any>} exercises
 * @param {{ includeHidden?: boolean }} [options]
 * @returns {{ name: string, members: { equipment: string, exercise: any }[] }[]}
 */
export function familyMemberGroups(familyId, exercises = SEED_EXERCISES, options = {}) {
  /** @type {Map<string, { name: string, members: { equipment: string, exercise: any }[] }>} */
  const groups = new Map();
  for (const exercise of familyMembers(familyId, exercises, options)) {
    const name = exerciseBaseName(exercise, 'en');
    let group = groups.get(name);
    if (!group) groups.set(name, group = { name, members: [] });
    group.members.push({ equipment: exerciseEquipment(exercise), exercise });
  }
  return [...groups.values()].map((group) => {
    // familyMembers puts built-ins first in catalogue order, so a group's usual version leads it
    const [first, ...rest] = group.members;
    const lead = memberOrder.has(first.exercise.id) ? [first] : [];
    const others = (lead.length ? rest : group.members).sort((a, b) => compareExerciseEquipment(a.exercise, b.exercise));
    return { ...group, members: [...lead, ...others] };
  });
}

/** Latest session of any supplied member. Ties keep the usual/catalogue order.
 * @param {any[]} members
 * @param {Map<string, any[]>} sessions Newest first, from sessionsByExercise.
 */
export function lastLoggedExercise(members, sessions) {
  let chosen = members[0];
  let lastAt = -Infinity;
  for (const ex of members) {
    const at = sessions.get(ex.id)?.[0]?.startedAt;
    if (Number.isFinite(at) && at > lastAt) { chosen = ex; lastAt = at; }
  }
  return chosen;
}

/** Browse rows for Search and the picker. Uses the person's actual library.
 * Hidden and rejected members never count or become the row's opening target.
 * Without a region/muscle filter the usual member supplies the body part, even
 * when hidden or rejected. With a filter, only matching members can open or
 * expand, and the first matching member supplies the label.
 * Family ids absent from both the catalogue and registry show exercises alone.
 * @param {any[] | Map<string, any>} exercises
 * @param {Map<string, any[]>} sessions
 * @param {{ accepts?: (exercise: any) => boolean, customFamilies?: Record<string, string>, region?: string, muscle?: string }} [options]
 */
export function exerciseBrowseRows(exercises, sessions, { accepts = () => true, customFamilies = {}, region = 'all', muscle = 'all' } = {}) {
  const all = exercises instanceof Map ? [...exercises.values()] : exercises;
  const rows = [], seen = new Set();
  for (const ex of all) {
    const familyId = familyOf(ex), family = exerciseFamily(familyId, customFamilies);
    const id = family ? familyId : ex.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const members = (family ? familyMemberGroups(id, all).flatMap((g) => g.members.map((m) => m.exercise)) : [ex])
      .filter((e) => !e.hidden && accepts(e) && (region === 'all' || regionOf(e.bodyPart) === region) && (muscle === 'all' || e.bodyPart === muscle));
    if (!members.length) continue;
    const usual = family ? familyMembers(id, all, { includeHidden: true })[0] : ex;
    const exercise = lastLoggedExercise(members, sessions);
    rows.push({ id, family: family || null, members, exercise, bodyPart: region === 'all' && muscle === 'all' ? usual.bodyPart : members[0].bodyPart,
      lastAt: sessions.get(exercise.id)?.[0]?.startedAt });
  }
  return rows;
}
