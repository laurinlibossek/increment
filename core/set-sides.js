// Sides (#54). An exercise is done one side at a time (unilateral) by the
// catalogue's default for its variation, or by its own `unilateral` choice.
// Every set stays its own row: records, volume, readiness, the CSV and logging
// progress count rows. Set totals count a unilateral exercise's complete
// left/right pairs.
import { UNILATERAL_IDS } from './exercise-catalogue.js';

export const sideOf = (set) => set?.side === 'left' || set?.side === 'right' ? set.side : undefined;

/** The catalogue's default for an exercise: one side at a time or not (custom exercises: not). */
export const unilateralDefault = (ex) => !!ex && UNILATERAL_IDS.has(ex.id);

/** Whether an exercise is done one side at a time: its own choice, else the catalogue's default. */
export function isUnilateral(ex) {
  if (typeof ex?.unilateral === 'boolean') return ex.unilateral;
  return unilateralDefault(ex);
}

/**
 * The sets one exercise counts in one workout or routine (#54), warm-ups left
 * out. Two-sided exercises count every working row. One side at a time, they
 * count complete pairs, min(left, right); with `pair` off (Account → "Count
 * left/right sets together") every working row. `unpaired` is what a paired
 * count leaves out: one side's extra rows and rows without a side, which prove
 * no pair. Returns { sets, unpaired }.
 */
export function exerciseSetCount(sets, unilateral, { pair = true } = {}) {
  let left = 0, right = 0, none = 0;
  for (const set of sets) {
    if (set.type === 'warmup') continue;
    const side = sideOf(set);
    if (side === 'left') left++;
    else if (side === 'right') right++;
    else none++;
  }
  const rows = left + right + none;
  if (!unilateral || !pair) return { sets: rows, unpaired: 0 };
  const pairs = Math.min(left, right);
  return { sets: pairs, unpaired: rows - 2 * pairs };
}

const lookup = (exercises) => (exercises instanceof Map ? (id) => exercises.get(id) : (id) => exercises?.[id]);

/** An exercise's rows across its entries: repeated entries in one workout pair with each other. */
export function setsByExercise(entries) {
  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.exerciseId)) groups.set(e.exerciseId, []);
    groups.get(e.exerciseId).push(...e.sets);
  }
  return groups;
}

/**
 * The set total of one workout's or one routine's entries (#54): each
 * exercise's exerciseSetCount, its repeated entries together; never pairs
 * across workouts or exercises. `exercises` maps id → exercise (Map or object).
 * Returns { sets, unpaired }.
 */
export function entriesSetCount(entries, exercises, { pair = true } = {}) {
  const get = lookup(exercises);
  let sets = 0, unpaired = 0;
  for (const [id, rows] of setsByExercise(entries)) {
    const n = exerciseSetCount(rows, isUnilateral(get(id)), { pair });
    sets += n.sets;
    unpaired += n.unpaired;
  }
  return { sets, unpaired };
}
