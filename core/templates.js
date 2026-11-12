// Templates: comparing a finished workout with the template it came from,
// writing it back, and cleaning template data. Plain data in, plain data out.
import { remapSupersets } from './drafts.js';
import { sideOf } from './set-sides.js';
import { repRange, withRepRange, clampReps } from './rep-range.js';

const VALUE_KEYS = ['w', 'r', 'd', 't'];
const setType = (s) => s.type || 'normal';
/** How many sets of a kind: 'straight' (normal and failure sets, the working sets), 'warmup', 'drop', 'failure'. */
const count = (sets, kind) => sets.filter((s) => (kind === 'straight' ? ['normal', 'failure'].includes(setType(s)) : setType(s) === kind)).length;
const setBucket = (s) => (setType(s) === 'warmup' ? 'warmup' : 'work');

/** "exerciseId#n" per entry, so the n-th Bench Press pairs with the n-th Bench Press. */
export function entryKeys(entries) {
  const n = new Map();
  return entries.map((e) => {
    const i = n.get(e.exerciseId) || 0;
    n.set(e.exerciseId, i + 1);
    return `${e.exerciseId}#${i}`;
  });
}
/** For each template entry, the index of the matching workout entry (or -1). */
function pairEntries(tplEntries, woEntries) {
  const tk = entryKeys(tplEntries), wk = entryKeys(woEntries);
  const at = new Map(wk.map((k, i) => [k, i]));
  return { pairs: tk.map((k) => (at.has(k) ? at.get(k) : -1)), tk, wk };
}
/**
 * For each template set, the index of the workout set it lines up with (or -1).
 * Warm-ups pair only with warm-ups. When both lists carry sides, each side
 * (and untagged sets) pairs separately in order; otherwise use the old order.
 */
export function pairSets(tplSets, woSets) {
  const sided = tplSets.some(sideOf) && woSets.some(sideOf);
  const bucket = (s) => `${setBucket(s)}:${sided ? sideOf(s) || 'none' : ''}`;
  const pos = new Map(), used = new Map();
  woSets.forEach((s, i) => {
    const b = bucket(s);
    if (!pos.has(b)) pos.set(b, []);
    pos.get(b).push(i);
  });
  return tplSets.map((s) => {
    const b = bucket(s), at = used.get(b) || 0;
    const j = pos.get(b)?.[at];
    used.set(b, at + 1);
    return j === undefined ? -1 : j;
  });
}
function sameValues(a, b) {
  for (const k of VALUE_KEYS) {
    const x = a[k] ?? null, y = b[k] ?? null;
    if ((x === null) !== (y === null)) return false;
    if (x !== null && Math.abs(x - y) > 1e-6) return false;
  }
  return true;
}
/** A routine set of `type` with the numbers of `from`; side and rep range (#44) come from `meta`. */
function templateSet(type, from, meta = from) {
  const o = { type };
  for (const k of [...VALUE_KEYS, 'rpe']) if (from[k] !== null && from[k] !== undefined) o[k] = from[k];
  if (sideOf(meta)) o.side = sideOf(meta);
  return withRepRange(o, repRange(meta));
}
/** Superset grouping as "key → first key of its group", over the given keys only. */
function supersetLeaders(entries, keys, only) {
  const leader = new Map(), first = new Map();
  entries.forEach((e, i) => {
    const k = keys[i];
    if (!only.has(k)) return;
    if (!e.supersetId) { leader.set(k, k); return; }
    if (!first.has(e.supersetId)) first.set(e.supersetId, k);
    leader.set(k, first.get(e.supersetId));
  });
  return leader;
}

/**
 * What finishing `workout` would change in `template`.
 * `structure` is true when exercises, their order, set counts, set types, sides or
 * supersets differ; `valueSets` counts template sets whose numbers would change
 * with "Update values only"; `added` and `removed` are the exercise ids of the
 * entries only the workout or only the template has.
 */
export function templateChanges(template, workout) {
  const T = template.exercises, W = workout.exercises;
  const { pairs, tk, wk } = pairEntries(T, W);
  const c = {
    addedExercises: 0, removedExercises: 0, reordered: false, addedSets: 0, removedSets: 0,
    typesChanged: false, sidesChanged: false, supersetsChanged: false, valueSets: 0, structure: false,
    added: [], removed: [],
    // per exercise whose number of straight sets (normal and failure) changed:
    // the routine's (`from`) and the workout's (`to`); added and removed
    // exercises too. Template order, added last. Warm-ups and drop sets aren't
    // counted here; a different number of them (or of failure sets) in an
    // exercise both kept sets the flags below.
    sets: [],
    warmupsChanged: false, dropsChanged: false, failuresChanged: false,
  };
  const order = [];
  const matched = new Set();
  pairs.forEach((wi, ti) => {
    if (wi < 0) {
      c.removedExercises++; c.removed.push(T[ti].exerciseId);
      if (T[ti].sets.some(sideOf)) c.sidesChanged = true;
      c.sets.push({ exerciseId: T[ti].exerciseId, from: count(T[ti].sets, 'straight'), to: 0, removed: true });
      return;
    }
    order.push(wi);
    matched.add(tk[ti]);
    const ts = T[ti].sets, ws = W[wi].sets;
    const sp = pairSets(ts, ws);
    let paired = 0;
    sp.forEach((j, i) => {
      if (j < 0) { c.removedSets++; return; }
      paired++;
      if (setType(ts[i]) !== setType(ws[j])) c.typesChanged = true;
      if (sideOf(ts[i]) !== sideOf(ws[j])) c.sidesChanged = true;
      if (!sameValues(ts[i], ws[j])) c.valueSets++;
    });
    c.addedSets += ws.length - paired;
    for (const side of ['left', 'right']) {
      for (const bucket of ['warmup', 'work']) {
        const n = (sets) => sets.filter((s) => sideOf(s) === side && setBucket(s) === bucket).length;
        if (n(ts) !== n(ws)) c.sidesChanged = true;
      }
    }
    const [from, to] = [count(ts, 'straight'), count(ws, 'straight')];
    if (from !== to) c.sets.push({ exerciseId: T[ti].exerciseId, from, to });
    if (count(ts, 'warmup') !== count(ws, 'warmup')) c.warmupsChanged = true;
    if (count(ts, 'drop') !== count(ws, 'drop')) c.dropsChanged = true;
    if (count(ts, 'failure') !== count(ws, 'failure')) c.failuresChanged = true;
    // same set types, but in another order (a warm-up moved after a working set)
    if (ts.length === ws.length && ts.some((s, i) => setType(s) !== setType(ws[i]))) c.typesChanged = true;
  });
  c.addedExercises = W.length - order.length;
  c.added = W.filter((e, wi) => !order.includes(wi)).map((e) => e.exerciseId);
  W.forEach((e, wi) => {
    if (!order.includes(wi)) {
      c.sets.push({ exerciseId: e.exerciseId, from: 0, to: count(e.sets, 'straight'), added: true });
      if (e.sets.some(sideOf)) c.sidesChanged = true;
    }
  });
  c.reordered = order.some((w, i) => i > 0 && w < order[i - 1]);
  const lt = supersetLeaders(T, tk, matched), lw = supersetLeaders(W, wk, matched);
  c.supersetsChanged = [...matched].some((k) => lt.get(k) !== lw.get(k));
  c.structure = !!(c.addedExercises || c.removedExercises || c.reordered || c.sets.length
    || c.warmupsChanged || c.dropsChanged || c.failuresChanged || c.typesChanged || c.sidesChanged || c.supersetsChanged);
  return c;
}
/** Did a finished workout change the structure of its template? */
export const templateDiffers = (template, workout) => templateChanges(template, workout).structure;

/**
 * The template's exercises after saving a finished workout into it. `valuesOnly`
 * keeps the template's exercises and sets and copies the performed numbers into
 * the matching sets; otherwise the workout's structure and numbers replace them.
 */
export function applyWorkoutToTemplate(templateExercises, workout, { valuesOnly = false } = {}) {
  const { pairs } = pairEntries(templateExercises, workout.exercises);
  if (valuesOnly) {
    return templateExercises.map((e, ti) => {
      const wi = pairs[ti];
      if (wi < 0) return e;
      const ws = workout.exercises[wi].sets;
      const sp = pairSets(e.sets, ws);
      return { ...e, sets: e.sets.map((s, i) => (sp[i] < 0 ? s : templateSet(setType(s), ws[sp[i]], s))) };
    });
  }
  const tplOf = new Map();
  pairs.forEach((wi, ti) => { if (wi >= 0) tplOf.set(wi, templateExercises[ti]); });
  return workout.exercises.map((e, wi) => {
    const out = { exerciseId: e.exerciseId, sets: e.sets.map((s) => templateSet(setType(s), s)) };
    const notes = tplOf.get(wi)?.notes; // keep the template's own exercise notes
    if (notes) out.notes = notes;
    if (e.supersetId) out.supersetId = e.supersetId;
    if (e.restSec !== null && e.restSec !== undefined) out.restSec = e.restSec;
    if (e.focus) out.focus = e.focus;
    return out;
  });
}

// ---------- progressive overload ----------
// What "better" means per kind of exercise, compared key by key: more weight
// (or, for assisted exercises, less assistance), then more reps; for
// time-only exercises (planks, holds) more time. Cardio is compareCardio.
const BETTER = {
  barbell: [['w', 1], ['r', 1]],
  dumbbell: [['w', 1], ['r', 1]],
  machine: [['w', 1], ['r', 1]],
  weighted_bw: [['w', 1], ['r', 1]],
  assisted_bw: [['w', -1], ['r', 1]],
  reps: [['r', 1]],
  duration: [['t', 1]],
};
const valueOf = (s, k) => (Number.isFinite(Number(s[k])) && s[k] !== null && s[k] !== '' ? Number(s[k]) : 0);
const hasNumbers = (s) => VALUE_KEYS.some((k) => valueOf(s, k) !== 0);

const sign = (d) => (d > 1e-6 ? 1 : d < -1e-6 ? -1 : 0);

/**
 * Cardio (distance and time): more distance, or the same distance in less
 * time (faster). A set without a time can't be faster; sets without any
 * distance are compared like a time-only exercise (more time).
 */
function compareCardio(routineSet, doneSet) {
  const rd = valueOf(routineSet, 'd'), dd = valueOf(doneSet, 'd');
  const rt = valueOf(routineSet, 't'), dt = valueOf(doneSet, 't');
  if (!rd && !dd) return sign(dt - rt);
  const further = sign(dd - rd);
  if (further) return further;
  return rt > 0 && dt > 0 ? sign(rt - dt) : 0;
}

/**
 * Compares a done set with the routine's set for an exercise of `category`:
 * 1 when the done set is better, 0 when it's as good, -1 when it's worse.
 * More weight wins, or the same weight and more reps; for assisted exercises
 * less assistance; for time-only exercises more time; for cardio more
 * distance, or the same distance in less time. A routine set without numbers
 * is beaten by any done set that has some.
 */
export function compareSets(routineSet, doneSet, category) {
  if (!hasNumbers(doneSet)) return hasNumbers(routineSet) ? -1 : 0;
  if (!hasNumbers(routineSet)) return 1;
  if (category === 'cardio') return compareCardio(routineSet, doneSet);
  for (const [k, dir] of BETTER[category] || BETTER.barbell) {
    const d = (valueOf(doneSet, k) - valueOf(routineSet, k)) * dir;
    if (d > 1e-6) return 1;
    if (d < -1e-6) return -1;
  }
  return 0;
}

/** The routine set with the done set's numbers; its own type, targets (RPE) and rep range stay. */
function raisedSet(routineSet, doneSet, type = setType(routineSet), sideFrom = routineSet) {
  const o = { ...routineSet, type };
  delete o.side;
  if (sideOf(sideFrom)) o.side = sideOf(sideFrom);
  for (const k of VALUE_KEYS) if (doneSet[k] !== null && doneSet[k] !== undefined && doneSet[k] !== '') o[k] = doneSet[k];
  return withRepRange(o, repRange(routineSet));
}

/**
 * The done set as the routine set can take it: its reps moved inside the
 * routine set's rep range (#44), so 80 × 12 against 8–10 counts as 80 × 10
 * and 82.5 × 6 as 82.5 × 8. The workout keeps what was done.
 */
function withinRange(routineSet, doneSet) {
  const range = repRange(routineSet);
  return range && Number.isFinite(doneSet.r) ? { ...doneSet, r: clampReps(doneSet.r, range) } : doneSet;
}

/**
 * A routine's exercises after a finished workout from it, for progressive
 * overload. Sets pair as in templateChanges (by exercise and occurrence,
 * warm-ups with warm-ups, working sets with working sets, separately per side
 * when both lists carry sides); a paired
 * routine set takes the done set's numbers only when they're better
 * (compareSets), so a routine's numbers only ever go up. Skipped sets and
 * exercises keep theirs. With `layout`, the routine takes the workout's
 * exercises and sets instead: paired sets still only go up, new sets take
 * what was done, and the routine's own exercise notes stay.
 * Rep ranges (#44) stay as they are: a ranged set's target only moves inside
 * its bounds, never the bounds themselves, and with `layout` a new set takes
 * the range of the set before it of the same type and side.
 * `categoryOf(exerciseId)` gives each exercise's category.
 * Returns { exercises, raised }: `raised` counts the sets whose numbers went up.
 */
export function progressTemplate(templateExercises, workout, categoryOf, { layout = false } = {}) {
  const T = templateExercises, W = workout.exercises;
  const { pairs } = pairEntries(T, W);
  let raised = 0;
  const better = (r, d, exerciseId) => compareSets(r, d, categoryOf(exerciseId)) > 0;
  if (!layout) {
    const exercises = T.map((e, ti) => {
      const wi = pairs[ti];
      if (wi < 0) return e;
      const ws = W[wi].sets;
      const sp = pairSets(e.sets, ws);
      return {
        ...e,
        sets: e.sets.map((s, i) => {
          if (sp[i] < 0 || !better(s, withinRange(s, ws[sp[i]]), e.exerciseId)) return s;
          raised++;
          return raisedSet(s, withinRange(s, ws[sp[i]]));
        }),
      };
    });
    return { exercises, raised };
  }
  const tplOf = new Map();
  pairs.forEach((wi, ti) => { if (wi >= 0) tplOf.set(wi, T[ti]); });
  const exercises = W.map((we, wi) => {
    const te = tplOf.get(wi);
    let sets;
    if (!te) sets = we.sets.map((s) => templateSet(setType(s), s));
    else {
      const routineOf = new Map();
      pairSets(te.sets, we.sets).forEach((j, i) => { if (j >= 0) routineOf.set(j, te.sets[i]); });
      const rangeBefore = new Map(); // "type:side" → the range of the set before
      sets = we.sets.map((s, j) => {
        const r = routineOf.get(j);
        const key = `${setType(s)}:${sideOf(s) || ''}`;
        let out;
        if (!r) out = withRepRange(templateSet(setType(s), s), rangeBefore.get(key) || null);
        else if (!better(r, withinRange(r, s), we.exerciseId)) out = raisedSet(r, {}, setType(s), s);
        else { raised++; out = raisedSet(r, withinRange(r, s), setType(s), s); }
        rangeBefore.set(key, repRange(out));
        return out;
      });
    }
    const out = { exerciseId: we.exerciseId, sets };
    if (te?.notes) out.notes = te.notes; // the routine's own exercise notes stay
    if (we.supersetId) out.supersetId = we.supersetId;
    if (we.restSec !== null && we.restSec !== undefined) out.restSec = we.restSec;
    if (we.focus) out.focus = we.focus;
    return out;
  });
  return { exercises, raised };
}

/**
 * A template's exercises as stored: only known exercises, only the fields a
 * template keeps, fresh superset ids. `hasExercise(id)` says which exist.
 */
export function cleanTemplateExercises(exercises, hasExercise = () => true) {
  return remapSupersets(JSON.parse(JSON.stringify(exercises)).map((e) => ({
    exerciseId: e.exerciseId,
    notes: e.notes,
    supersetId: e.supersetId,
    restSec: e.restSec,
    focus: e.focus,
    sets: e.sets.map((s) => templateSet(setType(s), s)),
  }))).filter((e) => hasExercise(e.exerciseId));
}


// ---------- weight increase recommended (#49) ----------
const STRAIGHT = new Set(['normal', 'failure']);

/** Which prompt an exercise of this category can get: more weight, less assistance, or none (reps only, time, cardio). */
export function readinessKind(category) {
  if (category === 'assisted_bw') return 'assistance';
  return ['barbell', 'dumbbell', 'machine', 'weighted_bw'].includes(category) ? 'weight' : null;
}

/**
 * What a routine prescribes, for telling whether it changed (#49): per
 * exercise its sets' types, sides, weights and rep ranges, and the reps of
 * sets without a range. A ranged set's target is left out, since progression
 * moves it inside the range.
 */
export function prescriptionKey(exercises) {
  return JSON.stringify((exercises || []).map((e) => [e.exerciseId, e.sets.map((s) => {
    const range = repRange(s);
    return [setType(s), sideOf(s) || '', s.w ?? null, range || (s.r ?? null)];
  })]));
}

/**
 * "Weight increase recommended" (#49), per entry of `template`: 'weight', 'assistance'
 * (assisted exercises: less assistance weight recommended) or null. `workout` is the
 * routine's latest finished workout; readiness comes from that one workout
 * against the routine as it is, never from sets gathered across workouts.
 * An entry is ready when every prescribed working set (normal and failure)
 * has a rep range and its done counterpart reached the top of that range at
 * the prescribed weight or more (less assistance). Working sets pair in
 * order, per side when the routine has sides, so a skipped set or a missing
 * side keeps it from being ready; warm-ups, drop sets and extra sets don't
 * count either way. A workout from before the routine's prescription last
 * changed (`prescribedAt`, stamped by the editor) counts for nothing.
 * `categoryOf(exerciseId)` gives each exercise's category.
 */
export function routineReadiness(template, workout, categoryOf) {
  const T = template.exercises;
  const none = T.map(() => null);
  if (!workout || workout.templateId !== template.id) return none;
  if (Number.isFinite(template.prescribedAt) && !(workout.startedAt >= template.prescribedAt)) return none;
  const { pairs } = pairEntries(T, workout.exercises);
  return T.map((e, ti) => {
    const kind = readinessKind(categoryOf(e.exerciseId));
    const prescribed = e.sets.filter((s) => STRAIGHT.has(setType(s)));
    if (!kind || !prescribed.length || prescribed.some((s) => !repRange(s)) || pairs[ti] < 0) return null;
    const sided = prescribed.some(sideOf);
    const bucket = (s) => (sided ? sideOf(s) || 'none' : '');
    const done = new Map();
    for (const s of workout.exercises[pairs[ti]].sets) {
      if (!STRAIGHT.has(setType(s))) continue;
      if (!done.has(bucket(s))) done.set(bucket(s), []);
      done.get(bucket(s)).push(s);
    }
    const used = new Map();
    for (const p of prescribed) {
      const b = bucket(p), n = used.get(b) || 0;
      used.set(b, n + 1);
      const d = done.get(b)?.[n];
      if (!d || !(Number(d.r) >= p.rMax)) return null;
      const pw = Number(p.w) || 0, dw = Number(d.w) || 0;
      if (kind === 'weight' ? dw < pw - 1e-6 : dw > pw + 1e-6) return null;
    }
    return kind;
  });
}
