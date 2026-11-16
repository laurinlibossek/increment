// @ts-check
// Today, the store app's first tab: the week strip, sets per muscle and the
// size of the routine that is up next. Labels are English translation keys.
import { startOfDay, startOfWeek, addDays } from './units.js';
import { BODY_PARTS, BODY_PART_LABEL, MUSCLES, regionOf } from './seed.js';
import { helpersOf, HELPER_SET_WEIGHT } from './exercise-helpers.js';
import { restFor } from './workout.js';
import {
  entriesSetCount, exerciseLookup, exerciseSetCount, isUnilateral, setsByExercise,
} from './set-sides.js';

/**
 * @typedef {import('./types.js').EntryLike} EntryLike
 * @typedef {import('./types.js').Exercises} Exercises
 * @typedef {import('./types.js').WorkoutLike} WorkoutLike
 * @typedef {import('./types.js').RoutineLike} RoutineLike
 */

/** Index of the day a time falls on in a list of day starts, or -1. @param {number[]} days @param {number} t */
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
 * `today` is an index into `days`.
 * @param {{ startedAt: number }[]} workouts
 * @returns {{ days: { start: number, done: number, planned: boolean }[], today: number, done: number, goal: number }}
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

// Legacy region rows follow that region's muscles; cardio and Other never count.
const MUSCLE_ROWS = BODY_PARTS.flatMap((r) => {
  const muscles = MUSCLES.filter((m) => m.region === r.id);
  return muscles.some((m) => m.id === r.id) ? muscles : [...muscles, r];
}).filter((m) => m.id !== 'cardio' && m.id !== 'other');
/** @type {Set<string>} */
const countedParts = new Set(MUSCLE_ROWS.map((m) => m.id));

/**
 * Each exercise of a muscle (its body part) in each workout of the last `days`
 * days including today, with its working rows and their count:
 * The main muscle has weight 1, each helper HELPER_SET_WEIGHT; sets and
 * unpaired stay unweighted here. Warm-ups and cardio do not count. An exercise done one side at a time counts its complete
 * left/right pairs within each workout (#54), whatever Account's "Count
 * left/right sets together" says. Repeated entries of an exercise in one
 * workout count together. One walk for setsPerMuscle and muscleSets, so a
 * breakdown always adds up to the number on Today (#89).
 * @template {WorkoutLike} W
 * @param {W[]} workouts
 * @param {Exercises} exercises
 * @param {{ days: number, now: number }} range
 * @param {(x: { workout: W, exerciseId: string, muscle: string, weight: number, rows: W['exercises'][number]['sets'][number][], sets: number, unpaired: number }) => void} fn
 */
function eachMuscleExercise(workouts, exercises, { days, now }, fn) {
  const get = exerciseLookup(exercises);
  const since = startOfDay(addDays(now, -(days - 1)));
  for (const w of workouts) {
    if (w.startedAt < since || w.startedAt > now) continue;
    for (const [id, rows] of setsByExercise(w.exercises)) {
      const ex = get(id), muscle = ex?.bodyPart;
      if (!muscle || !countedParts.has(muscle)) continue;
      const counted = { workout: w, exerciseId: id, rows, ...exerciseSetCount(rows, isUnilateral(ex)) };
      fn({ ...counted, muscle, weight: 1 });
      for (const helper of helpersOf(ex)) fn({ ...counted, muscle: helper, weight: HELPER_SET_WEIGHT });
    }
  }
}

/**
 * Working sets per muscle (the exercise's body part) over the last `days`
 * days including today, counted as eachMuscleExercise says. Only muscles with
 * sets, in a fixed order.
 * @param {WorkoutLike[]} workouts
 * @param {Exercises} exercises
 * @returns {{ muscle: string, label: string, sets: number, direct: number, helper: number }[]}
 */
export function setsPerMuscle(workouts, exercises, { days = 7, now = Date.now() } = {}) {
  /** @type {Map<string, { direct: number, helper: number }>} */
  const counts = new Map();
  eachMuscleExercise(workouts, exercises, { days, now }, ({ muscle, sets, weight }) => {
    if (!sets) return;
    const count = counts.get(muscle) || { direct: 0, helper: 0 };
    count[weight === 1 ? 'direct' : 'helper'] += sets * weight;
    counts.set(muscle, count);
  });
  return MUSCLE_ROWS.filter((b) => counts.has(b.id)).map((b) => {
    const { direct, helper } = counts.get(b.id) || { direct: 0, helper: 0 };
    return { muscle: b.id, label: b.label, sets: direct + helper, direct, helper };
  });
}

/**
 * The sets behind one muscle's number in Sets per muscle (#89), grouped by
 * exercise: direct exercises first, then helpers; most sets first in each
 * group, on a tie the one done most recently (then in the order done). Each exercise lists its workouts newest first, with that
 * workout's working rows in logged order (warm-ups out), its count and the
 * rows a left/right pairing leaves out. An exercise with rows but no complete
 * pair is listed with 0 sets, so its unpaired rows show. `sets` is always
 * setsPerMuscle's number for the muscle (0 when it has none); `label` is null
 * for an id that isn't a muscle.
 * @template {WorkoutLike} W
 * @param {W[]} workouts
 * @param {Exercises} exercises
 * @param {string} muscle
 */
export function muscleSets(workouts, exercises, muscle, { days = 7, now = Date.now() } = {}) {
  /** @typedef {W['exercises'][number]['sets'][number]} Row */
  /** @type {Map<string, { exerciseId: string, helper: boolean, sets: number, unpaired: number, workouts: { id: string, name: string | undefined, startedAt: number, sets: number, unpaired: number, rows: Row[] }[] }>} */
  const byExercise = new Map();
  let sets = 0, direct = 0, helper = 0, unpaired = 0;
  eachMuscleExercise(newestFirst(workouts), exercises, { days, now }, ({ workout: w, exerciseId, muscle: m, weight, rows, sets: n, unpaired: u }) => {
    if (m !== muscle || !(n || u)) return;
    let e = byExercise.get(exerciseId);
    if (!e) byExercise.set(exerciseId, e = { exerciseId, helper: weight !== 1, sets: 0, unpaired: 0, workouts: [] });
    const weighted = n * weight;
    e.sets += weighted; e.unpaired += u; sets += weighted; unpaired += u;
    if (e.helper) helper += weighted; else direct += weighted;
    e.workouts.push({ id: w.id, name: w.name, startedAt: w.startedAt, sets: weighted, unpaired: u, rows: rows.filter((r) => r.type !== 'warmup') });
  });
  // a stable sort: ties keep the order met, newest workout first
  const list = [...byExercise.values()].sort((a, b) => Number(a.helper) - Number(b.helper) || b.sets - a.sets);
  /** @type {string | null} */
  const label = countedParts.has(muscle) ? BODY_PART_LABEL[muscle] : null;
  return { muscle, label, sets, direct, helper, unpaired, exercises: list };
}

// Rough time per set, for the estimate on a routine card before there's history.
const WORK_SEC = 45, WARMUP_SEC = 30, WARMUP_REST_SEC = 60;
// The estimate from history (#114): this routine's last 5 sessions, else the
// last 10 of any kind; sessions under 2 minutes (imports without a duration
// are saved as 1 minute long) or over 4 hours (Finish forgotten) don't count.
const ROUTINE_SESSIONS = 5, ANY_SESSIONS = 10;
const MIN_SESSION_MS = 2 * 60000, MAX_SESSION_MS = 4 * 3600000;

/** Minutes to show: rounded to 5, at least 5. @param {number} sec */
const roundMinutes = (sec) => Math.max(5, Math.round(sec / 60 / 5) * 5);

/** The middle value of a list that isn't empty. @param {number[]} xs */
function median(xs) {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** @type {WeakMap<WorkoutLike[], WorkoutLike[]>} */
const sortedCache = new WeakMap();
/** The workouts newest first, sorted once per list (every row on Plan asks). @param {WorkoutLike[]} workouts */
function newestFirst(workouts) {
  let sorted = sortedCache.get(workouts);
  if (!sorted) { sorted = [...workouts].sort((a, b) => b.startedAt - a.startedAt); sortedCache.set(workouts, sorted); }
  return sorted;
}

/**
 * Seconds per working set the person took (#114): each session's length over
 * its working sets (entriesSetCount, with `pair` as for the routine), the
 * median of this routine's last 5 usable sessions, else of the last 10 of any
 * kind. Skipped: unfinished, under 2 minutes, over 4 hours, no working sets.
 * Null without a usable session.
 * @param {WorkoutLike[]} workouts
 * @param {Exercises} exercises
 * @param {string | undefined} routineId
 * @param {boolean} pair
 * @returns {{ pace: number, basis: 'routine' | 'all' } | null}
 */
function historyPace(workouts, exercises, routineId, pair) {
  /** @type {number[]} */
  const mine = [];
  /** @type {number[]} */
  const any = [];
  for (const w of newestFirst(workouts)) {
    if (mine.length >= ROUTINE_SESSIONS && any.length >= ANY_SESSIONS) break;
    const ours = !!routineId && w.templateId === routineId && mine.length < ROUTINE_SESSIONS;
    if (!ours && any.length >= ANY_SESSIONS) continue;
    const ms = (w.endedAt ?? NaN) - w.startedAt;
    if (!(ms >= MIN_SESSION_MS && ms <= MAX_SESSION_MS)) continue;
    const { sets } = entriesSetCount(w.exercises, exercises, { pair });
    if (!sets) continue;
    const pace = ms / 1000 / sets;
    if (ours) mine.push(pace);
    if (any.length < ANY_SESSIONS) any.push(pace);
  }
  if (mine.length) return { pace: median(mine), basis: 'routine' };
  if (any.length) return { pace: median(any), basis: 'all' };
  return null;
}

/**
 * A routine's size for its card: exercises, working sets and about how many
 * minutes it takes, rounded to 5 minutes (at least 5). Sets are the prescribed
 * rows' entriesSetCount (#54): `pair` (Account → "Count left/right sets
 * together") counts complete left/right pairs, and `unpaired` the rows left
 * out. Exercises missing from the library are left out.
 * Minutes (#114): given the finished `workouts`, the person's own pace (see
 * historyPace: this routine's sessions, else any) times the routine's working
 * sets, `basis` 'routine' or 'all'. Without usable history, `basis` 'formula':
 * each row's work (45 s, a warm-up 30 s) plus the rest after it (a warm-up's at
 * most 1 minute), the last row without.
 * @param {RoutineLike} template
 * @param {Exercises} exercises
 * @param {{ defaultRest?: number, pair?: boolean, workouts?: WorkoutLike[] }} [options]
 * @returns {{ exercises: number, sets: number, unpaired: number, minutes: number, basis: 'routine' | 'all' | 'formula' }}
 */
export function routineSize(template, exercises, { defaultRest = 120, pair = true, workouts } = {}) {
  const get = exerciseLookup(exercises);
  const entries = template.exercises.filter((e) => get(e.exerciseId));
  const { sets, unpaired } = entriesSetCount(entries, exercises, { pair });
  const size = { exercises: entries.length, sets, unpaired };
  const history = workouts && sets ? historyPace(workouts, exercises, template.id, pair) : null;
  if (history) return { ...size, minutes: roundMinutes(history.pace * sets), basis: history.basis };
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
  return { ...size, minutes: all ? roundMinutes(sec) : 0, basis: 'formula' };
}

/**
 * A routine's muscle groups for its row in Plan (#32): the body parts of its
 * exercises that are muscles, each once, in Sets per muscle's order, as
 * [{ muscle, label }]. Exercises missing from the library are left out.
 * @param {RoutineLike} template
 * @param {Exercises} exercises
 * @returns {{ muscle: string, label: string }[]}
 */
export function routineMuscles(template, exercises) {
  const get = exerciseLookup(exercises);
  const parts = new Set(template.exercises.map((e) => regionOf(get(e.exerciseId)?.bodyPart)).filter((p) => countedParts.has(p)));
  return BODY_PARTS.filter((b) => parts.has(b.id)).map((b) => ({ muscle: b.id, label: b.label }));
}

/** The first `max` names and how many more there are, for "Bench Press, Squat & 2 more" (#32). @param {string[]} names */
export function namesPreview(names, max = 3) {
  return { shown: names.slice(0, max), more: Math.max(0, names.length - max) };
}
