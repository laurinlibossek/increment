// Sides (#54). Exercises are bilateral unless unilateral: the unilateral ones
// we ship are always unilateral (UNILATERAL_NAMES), and any other exercise,
// built-in or custom, is unilateral when the person turns it on (its
// `unilateral: true`). Every set stays its own row: records, volume,
// readiness, the CSV and logging progress count rows. Set totals count a
// unilateral exercise's complete left/right pairs.
import { UNILATERAL_IDS } from './exercise-catalogue.js';

export const sideOf = (set) => set?.side === 'left' || set?.side === 'right' ? set.side : undefined;

/** A unilateral exercise we ship: always unilateral, the person can't turn it off. */
export const shippedUnilateral = (ex) => !!ex && UNILATERAL_IDS.has(ex.id);

/** Whether an exercise is unilateral: one we ship as unilateral, or one the person turned on; otherwise bilateral. */
export function isUnilateral(ex) {
  return shippedUnilateral(ex) || ex?.unilateral === true;
}

/**
 * The sets one exercise counts in one workout or routine (#54), warm-ups left
 * out. Bilateral exercises count every working row. Unilateral ones count
 * complete pairs, min(left, right), once their sets say left or right; with
 * no side at all (a Strong import, or logged before the exercise was
 * unilateral) each row is a set that covered both sides, so every row counts
 * (Laurin, 12 Nov 2026). With `pair` off (Account → "Count left/right sets
 * together") every working row counts. `unpaired` is what a paired count
 * leaves out: one side's extra rows, and rows without a side among sided
 * ones (a side probably forgotten). Returns { sets, unpaired }.
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
  if (!unilateral || !pair || !(left + right)) return { sets: rows, unpaired: 0 };
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

const OTHER = { left: 'right', right: 'left' };

/**
 * The side of a set added to a unilateral exercise (#54): every working set
 * has one. A drop set stays on the side of the set before it; otherwise the
 * pattern goes on: after one side the other (L, R, L, R), after the same side
 * twice that side again (R, R, then L, L the person set up); the first is
 * left. Warm-ups need none.
 */
export function nextSide(sets, type = 'normal') {
  if (type === 'warmup') return undefined;
  const sided = sets.filter((s) => s.type !== 'warmup' && sideOf(s));
  const last = sideOf(sided[sided.length - 1]), before = sideOf(sided[sided.length - 2]);
  if (!last) return 'left';
  if (type === 'drop') return last;
  return last === before ? last : OTHER[last];
}

/**
 * A unilateral exercise's sets with each working set that has no side split
 * into a left and a right one (#54): an old set (Strong, or from before the
 * exercise was unilateral) covered both sides. Warm-ups and sided sets stay.
 * Returns the same array when nothing needs splitting.
 */
export function splitSides(sets) {
  if (!sets.some((s) => s.type !== 'warmup' && !sideOf(s))) return sets;
  return sets.flatMap((s) => (s.type === 'warmup' || sideOf(s) ? [s] : [{ ...s, side: 'left' }, { ...s, side: 'right' }]));
}

/**
 * The routine with its unilateral exercises' sets split (splitSides), or null
 * when nothing changed. Starting a workout saves it, so progression, readiness
 * and Update routine compare left with left and right with right.
 */
export function splitRoutine(template, isUnilateral) {
  let changed = false;
  const exercises = template.exercises.map((e) => {
    if (!isUnilateral(e.exerciseId)) return e;
    const sets = splitSides(e.sets);
    if (sets === e.sets) return e;
    changed = true;
    return { ...e, sets };
  });
  return changed ? { ...template, exercises } : null;
}

/**
 * A unilateral exercise's sets for the Strong CSV (#54): each left and right
 * pair (the k-th left with the k-th right of the same type) becomes one row,
 * as Strong logs it: the average weight, distance and time, the average reps
 * rounded down (never more than was done), the harder side's reps in reserve.
 * A side without a partner and sets without a side stay their own rows.
 */
export function mergeSidePairs(sets) {
  const avg = (a, b, k) => {
    const x = a[k], y = b[k];
    if (x === undefined || x === null) return y;
    if (y === undefined || y === null) return x;
    return (x + y) / 2;
  };
  const partner = new Map(), lefts = new Map(), rights = new Map();
  sets.forEach((s, i) => {
    const side = sideOf(s);
    if (!side) return;
    const map = side === 'left' ? lefts : rights, t = s.type || 'normal';
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(i);
  });
  for (const [t, ls] of lefts) {
    const rs = rights.get(t) || [];
    for (let k = 0; k < Math.min(ls.length, rs.length); k++) {
      const a = Math.min(ls[k], rs[k]), b = Math.max(ls[k], rs[k]);
      partner.set(a, b);
      partner.set(b, -1);
    }
  }
  const out = [];
  sets.forEach((s, i) => {
    if (partner.get(i) === -1) return;
    if (!partner.has(i)) { out.push(s); return; }
    const o = sets[partner.get(i)];
    const m = { ...s };
    delete m.side;
    for (const k of ['w', 'd', 't']) { const v = avg(s, o, k); if (v !== undefined && v !== null) m[k] = k === 't' ? Math.round(v) : Math.round(v * 1000) / 1000; }
    const r = avg(s, o, 'r');
    if (r !== undefined && r !== null) m.r = Math.floor(r);
    const rirs = [s.rir, o.rir].filter((x) => typeof x === 'number');
    if (rirs.length) m.rir = Math.min(...rirs); else delete m.rir;
    const rpes = [s.rpe, o.rpe].filter((x) => typeof x === 'number');
    if (rpes.length) m.rpe = Math.max(...rpes);
    out.push(m);
  });
  return out;
}
