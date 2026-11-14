// Today, the store app's first tab: the week strip, sets per muscle and the
// size of the routine that is up next. Labels are English translation keys.
import { startOfDay, startOfWeek, addDays } from './units.js';
import { BODY_PARTS, BODY_PART_LABEL } from './seed.js';
import { restFor } from './workout.js';
import { entriesSetCount, exerciseSetCount, isUnilateral, setsByExercise } from './set-sides.js';

const lookup = (exercises) => (exercises instanceof Map ? (id) => exercises.get(id) : (id) => exercises?.[id]);

/** Index of the day a time falls on in a list of day starts, or -1. */
function dayIndex(days, t) {
  for (let i = days.length - 1; i >= 0; i--) if (t >= days[i]) return t < addDays(days[i], 1) ? i : -1;
  return -1;
}

/**
 * The current week for the week strip: each day from `weekStart` with the
 * sessions done on it, and which days are still planned to reach the weekly
 * goal. Without a block there is no schedule, so a planned day is one the
 * person usually trains on (a weekday with at least 2 workouts in the 8 weeks
 * before this one, most often first), from today on and without a session yet,
 * until the goal is covered.
 * Returns { days: [{ start, done, planned }], today (index), done, goal }.
 */
export function weekStrip(workouts, { weekStart = 1, goal = 3, now = Date.now() } = {}) {
  const first = startOfWeek(now, weekStart);
  const starts = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const days = starts.map((start) => ({ start, done: 0, planned: false }));
  const since = addDays(first, -56);
  const habit = new Array(7).fill(0); // workouts per weekday (getDay) in the 8 weeks before
  let done = 0;
  for (const w of workouts) {
    const i = dayIndex(starts, w.startedAt);
    if (i >= 0) { days[i].done++; done++; } else if (w.startedAt >= since && w.startedAt < first) habit[new Date(w.startedAt).getDay()]++;
  }
  const today = dayIndex(starts, startOfDay(now));
  const left = Math.max(0, goal - done);
  days
    .map((d, i) => ({ i, n: habit[new Date(d.start).getDay()] }))
    .filter(({ i, n }) => i >= today && n >= 2 && !days[i].done)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, left)
    .forEach(({ i }) => { days[i].planned = true; });
  return { days, today, done, goal };
}

// Body parts that are muscles, in the order Sets per muscle lists them.
const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full'];

/**
 * Each exercise of a muscle (its body part) in each workout of the last `days`
 * days including today, with its working rows and their count:
 * fn({ workout, exerciseId, muscle, rows, sets, unpaired }). Warm-ups and cardio
 * don't count. An exercise done one side at a time counts its complete
 * left/right pairs within each workout (#54), whatever Account's "Count
 * left/right sets together" says. Repeated entries of an exercise in one
 * workout count together. One walk for setsPerMuscle and muscleSets, so a
 * breakdown always adds up to the number on Today (#89).
 */
function eachMuscleExercise(workouts, exercises, { days, now }, fn) {
  const get = lookup(exercises);
  const since = startOfDay(addDays(now, -(days - 1)));
  for (const w of workouts) {
    if (w.startedAt < since || w.startedAt > now) continue;
    for (const [id, rows] of setsByExercise(w.exercises)) {
      const ex = get(id), muscle = ex?.bodyPart;
      if (!MUSCLES.includes(muscle)) continue;
      fn({ workout: w, exerciseId: id, muscle, rows, ...exerciseSetCount(rows, isUnilateral(ex)) });
    }
  }
}

/**
 * Working sets per muscle (the exercise's body part) over the last `days`
 * days including today, counted as eachMuscleExercise says. Only muscles with
 * sets, in a fixed order: [{ muscle, label, sets }].
 */
export function setsPerMuscle(workouts, exercises, { days = 7, now = Date.now() } = {}) {
  const counts = new Map();
  eachMuscleExercise(workouts, exercises, { days, now }, ({ muscle, sets }) => {
    if (sets) counts.set(muscle, (counts.get(muscle) || 0) + sets);
  });
  return BODY_PARTS.filter((b) => counts.has(b.id)).map((b) => ({ muscle: b.id, label: b.label, sets: counts.get(b.id) }));
}

/**
 * The sets behind one muscle's number in Sets per muscle (#89), grouped by
 * exercise: most sets first, on a tie the one done most recently (then in the
 * order done). Each exercise lists its workouts newest first, with that
 * workout's working rows in logged order (warm-ups out), its count and the
 * rows a left/right pairing leaves out. An exercise with rows but no complete
 * pair is listed with 0 sets, so its unpaired rows show. `sets` is always
 * setsPerMuscle's number for the muscle (0 when it has none); `label` is null
 * for an id that isn't a muscle.
 * Returns { muscle, label, sets, unpaired,
 *   exercises: [{ exerciseId, sets, unpaired, workouts: [{ id, name, startedAt, sets, unpaired, rows }] }] }.
 */
export function muscleSets(workouts, exercises, muscle, { days = 7, now = Date.now() } = {}) {
  const byExercise = new Map();
  let sets = 0, unpaired = 0;
  const newestFirst = [...workouts].sort((a, b) => b.startedAt - a.startedAt);
  eachMuscleExercise(newestFirst, exercises, { days, now }, ({ workout: w, exerciseId, muscle: m, rows, sets: n, unpaired: u }) => {
    if (m !== muscle || !(n || u)) return;
    if (!byExercise.has(exerciseId)) byExercise.set(exerciseId, { exerciseId, sets: 0, unpaired: 0, workouts: [] });
    const e = byExercise.get(exerciseId);
    e.sets += n; e.unpaired += u; sets += n; unpaired += u;
    e.workouts.push({ id: w.id, name: w.name, startedAt: w.startedAt, sets: n, unpaired: u, rows: rows.filter((r) => r.type !== 'warmup') });
  });
  // a stable sort: ties keep the order met, newest workout first
  const list = [...byExercise.values()].sort((a, b) => b.sets - a.sets);
  return { muscle, label: MUSCLES.includes(muscle) ? BODY_PART_LABEL[muscle] : null, sets, unpaired, exercises: list };
}

// Rough time per set, for the estimate on a routine card.
const WORK_SEC = 45, WARMUP_SEC = 30, WARMUP_REST_SEC = 60;

/**
 * A routine's size for its card: exercises, working sets and about how many
 * minutes it takes (each set's work plus the rest after it, the last set
 * without; rounded to 5 minutes). Sets are the prescribed rows' entriesSetCount
 * (#54): `pair` (Account → "Count left/right sets together") counts complete
 * left/right pairs, and `unpaired` the rows left out. Minutes count every row.
 * Exercises missing from the library are left out.
 */
export function routineSize(template, exercises, { defaultRest = 120, pair = true } = {}) {
  const get = lookup(exercises);
  const entries = template.exercises.filter((e) => get(e.exerciseId));
  const { sets, unpaired } = entriesSetCount(entries, exercises, { pair });
  let sec = 0, all = 0, lastRest = 0;
  for (const e of entries) {
    const rest = restFor(e, get(e.exerciseId), defaultRest) || 0;
    for (const s of e.sets) {
      all++;
      lastRest = s.type === 'warmup' ? Math.min(rest, WARMUP_REST_SEC) : rest;
      if (s.type === 'warmup') sec += WARMUP_SEC + lastRest;
      else sec += WORK_SEC + lastRest;
    }
  }
  sec -= lastRest; // nothing to rest for after the last set
  const minutes = all ? Math.max(5, Math.round(sec / 60 / 5) * 5) : 0;
  return { exercises: entries.length, sets, unpaired, minutes };
}

/**
 * A routine's muscle groups for its row in Plan (#32): the body parts of its
 * exercises that are muscles, each once, in Sets per muscle's order, as
 * [{ muscle, label }]. Exercises missing from the library are left out.
 */
export function routineMuscles(template, exercises) {
  const get = lookup(exercises);
  const parts = new Set(template.exercises.map((e) => get(e.exerciseId)?.bodyPart).filter((p) => MUSCLES.includes(p)));
  return BODY_PARTS.filter((b) => parts.has(b.id)).map((b) => ({ muscle: b.id, label: b.label }));
}

/** The first `max` names and how many more there are, for "Bench Press, Squat & 2 more" (#32). */
export function namesPreview(names, max = 3) {
  return { shown: names.slice(0, max), more: Math.max(0, names.length - max) };
}
