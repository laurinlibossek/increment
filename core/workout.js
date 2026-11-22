// @ts-check
// The running workout: starting one, the grey placeholders next to every set,
// checking sets off, supersets, warm-ups, the focus metric and finishing.
// Everything works on the active draft (the shape both apps store, see
// drafts.js) and changes it in place; the apps own the state around it.
// Messages are English translation keys (WORKOUT_MESSAGES), translated by the UI.
import { uid, numToInput, parseNum } from './units.js';
import {
  usesWeight, setIsValid, loggedFields, warmupSets, prsForNewWorkout, countsVolume, setVolume, isWorking, normRir,
} from './calc.js';
import {
  newSetDraft, setToDraft, draftToSet, entryToDraft, newEntryDraft, remapSupersets, draftEntries, dissolveLoneSupersets,
} from './drafts.js';
import { pairSets } from './templates.js';
import { nextSide, sideOf, splitSides } from './set-sides.js';

/**
 * @typedef {import('./types.js').SetLike} SetLike
 * @typedef {import('./types.js').EntryLike} EntryLike
 * @typedef {import('./types.js').ExerciseLike} ExerciseLike
 * @typedef {import('./types.js').UnitSettings} UnitSettings
 *
 * A set in a running workout or an editor: its numbers as the text typed (drafts.js).
 * @typedef {{ id: string, type?: string, side?: string, done?: boolean, doneAt?: number,
 *   w: string, r: string, d: string, t: string, rpe?: string, rir?: number,
 *   tpl?: object, range?: [number, number], orig?: Record<string, [string, number]> }} DraftSet
 *
 * An exercise in a running workout or an editor.
 * @typedef {{ id: string, exerciseId: string, supersetId?: string | null, restSec?: number | null,
 *   focus?: string | null, sets: DraftSet[] }} DraftEntry
 *
 * An entry that can be in a superset.
 * @typedef {{ id: string, supersetId?: string | null }} Grouped
 *
 * The grey text of a set's fields (placeholders): last time's numbers, the
 * routine's target or the row above's; `orig` as in a set draft.
 * @typedef {{ w: string, r: string, d: string, t: string, orig?: Record<string, [string, number]> }} Placeholder
 */

/**
 * One exercise, or one superset done together; its id is its first entry's.
 * @template E
 * @typedef {{ id: string, entries: E[] }} Unit
 */

/**
 * What removeEntry took out, for restoreEntry.
 * @template [E=Grouped]
 * @typedef {{ entry: E, index: number, supersetId: string | null, dissolved: (string | undefined)[] }} Removed
 */

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'];
/** Rest timer choices per exercise (seconds; 0 = off). */
export const REST_CHOICES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
/** Rest timer started by hand. */
export const REST_PRESETS = [30, 60, 90, 120, 150, 180, 240, 300];
export const RPE_CHOICES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export const WORKOUT_MESSAGES = {
  weightFirst: 'Enter the weight first',
  repsFirst: 'Enter reps first',
  distOrTimeFirst: 'Enter distance or time first',
  timeFirst: 'Enter a time first',
  warmupNeedsWeight: 'Enter the weight of your first working set first',
  warmupTooLight: 'That weight is too light for warm-up sets',
};

/** The default name for a workout started at `t` (an English key). @param {number} t */
export function workoutNameKey(t) {
  const h = new Date(t).getHours();
  if (h < 5) return 'Night Workout';
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  if (h < 22) return 'Evening Workout';
  return 'Night Workout';
}

/**
 * A new running workout: empty, from a template (its sets become grey
 * targets) or again from a finished workout. `name` is the (translated)
 * default name for an empty one. A unilateral exercise's sets without a
 * side become a left and a right set (splitSides, #54).
 * @param {{ template?: { id: string, name: string, notes?: string, example?: boolean, exercises: EntryLike[] } | null,
 *   fromWorkout?: { name: string, exercises: EntryLike[] } | null, hasExercise?: (id: string) => boolean,
 *   isUnilateral?: (id: string) => boolean, settings: UnitSettings, now?: number, name?: string }} o
 */
export function newActiveWorkout({
  template = null, fromWorkout = null, hasExercise = () => true, isUnilateral = () => false, settings, now = Date.now(), name = '',
}) {
  // a unilateral exercise's sets without a side become a left and a right set (#54)
  /** @template {EntryLike} T @param {T} e */
  const split = (e) => (isUnilateral(e.exerciseId) ? { ...e, sets: splitSides(e.sets) } : e);
  /** @type {ReturnType<typeof entryToDraft>[]} */
  let exercises = [];
  let templateNotes = '';
  if (template) {
    name = template.name;
    templateNotes = template.notes || '';
    exercises = remapSupersets(template.exercises.filter((e) => hasExercise(e.exerciseId))
      .map((e) => entryToDraft(split(e), settings, { asTemplateTargets: true })));
  } else if (fromWorkout) {
    name = fromWorkout.name;
    exercises = remapSupersets(fromWorkout.exercises.filter((e) => hasExercise(e.exerciseId))
      .map((e) => entryToDraft(split({ ...e, notes: '' }), settings, { asTemplateTargets: true })));
  }
  return {
    id: uid(),
    kind: 'workout',
    name,
    notes: '',
    startedAt: now,
    templateId: template && !template.example ? template.id : null,
    templateNotes,
    exercises,
    rest: null,
    updatedAt: now,
  };
}

/**
 * The template a draft belongs to (for "previous values from the same template").
 * @param {{ kind?: string, id: string, templateId?: string | null }} draft
 * @returns {string | null}
 */
export const draftTemplateId = (draft) => (draft.kind === 'template' ? draft.id : draft.templateId || null);

/**
 * Rest after a set of this entry: its own, else the exercise's, else the default.
 * @param {{ restSec?: number | null }} entry
 * @param {{ restSec?: number | null } | null | undefined} ex
 * @param {number} defaultRest
 * @returns {number}
 */
export function restFor(entry, ex, defaultRest) {
  if (entry.restSec !== null && entry.restSec !== undefined) return entry.restSec;
  if (ex && ex.restSec !== null && ex.restSec !== undefined) return ex.restSec;
  return defaultRest;
}

/**
 * The grey placeholder strings and the "previous" set for each row of an
 * entry: last time's set (warm-ups pair with warm-ups), else the template's
 * target, else whatever the row above has.
 * @template {SetLike} P
 * @param {{ sets: DraftSet[] }} entry
 * @param {P[] | null | undefined} prevSets
 * @param {UnitSettings} settings
 * @returns {{ prev: P | null, ph: Placeholder }[]}
 */
export function placeholders(entry, prevSets, settings) {
  const previous = prevSets || [];
  // a set without a side last time covered both: its numbers fill this time's left and right (#54)
  const pairs = pairSets(entry.sets, previous, { split: true });
  /** @type {Placeholder | null} */
  let lastPh = null;
  return entry.sets.map((s, i) => {
    const p = previous[pairs[i]];
    /** @type {Placeholder} */
    let ph;
    if (p) ph = setToDraft(p, settings);
    else if (s.tpl) ph = setToDraft(s.tpl, settings);
    else if (lastPh) ph = lastPh;
    else ph = { w: '', r: '', d: '', t: '' };
    // next rows fall back to what this row has (typed values beat placeholders)
    lastPh = {
      w: s.w || ph.w, r: s.r || ph.r, d: s.d || ph.d, t: s.t || ph.t,
    };
    return { prev: p || null, ph };
  });
}

/**
 * Copy a placeholder value into a set, with the stored number behind it (no rounding drift).
 * @param {DraftSet} set
 * @param {'w' | 'r' | 'd' | 't'} f
 * @param {Placeholder} ph
 */
export function fillFrom(set, f, ph) {
  set[f] = ph[f];
  if (ph.orig && ph.orig[f]) set.orig = { ...(set.orig || {}), [f]: ph.orig[f] };
}

/** @param {unknown} v */
const blank = (v) => !String(v || '').trim();

/**
 * A copy of the set with its empty fields taken from the placeholder, as checking it off does.
 * @param {DraftSet} set
 * @param {Placeholder} ph
 * @param {string} cat
 * @returns {DraftSet}
 */
export function completeSet(set, ph, cat) {
  const filled = { ...set };
  for (const f of loggedFields(cat)) if (blank(filled[f]) && ph[f]) fillFrom(filled, f, ph);
  if (usesWeight(cat) && blank(filled.w) && (cat === 'weighted_bw' || cat === 'assisted_bw')) filled.w = '0';
  return filled;
}

/**
 * Why a set can't be saved yet (a WORKOUT_MESSAGES text), or null if it can.
 * @param {DraftSet} set
 * @param {string} cat
 * @param {UnitSettings} settings
 * @returns {string | null}
 */
export function setProblem(set, cat, settings) {
  const c = draftToSet(set, settings);
  if (setIsValid(c, cat)) return null;
  if (usesWeight(cat)) return (c.r ?? 0) > 0 ? WORKOUT_MESSAGES.weightFirst : WORKOUT_MESSAGES.repsFirst;
  if (cat === 'reps') return WORKOUT_MESSAGES.repsFirst;
  if (cat === 'cardio') return WORKOUT_MESSAGES.distOrTimeFirst;
  return WORKOUT_MESSAGES.timeFirst;
}

/**
 * Check off set `i` of `entry`: empty fields come from the placeholders.
 * Returns { problem } when it can't be checked off yet (the set keeps what
 * was filled in, like the web app always did), else { rest } with the
 * seconds of rest to start (0 for none). A logged set gets `doneAt`: when the
 * person logged it (#43), not proof of when the set ended.
 * @param {{ exercises: Grouped[] }} draft
 * @param {DraftEntry} entry
 * @param {number} i
 * @param {{ category: string, ph: Placeholder, rest: number, settings: UnitSettings, now?: number }} o
 * @returns {{ problem: string, rest?: undefined } | { rest: number, problem?: undefined }}
 */
export function checkOffSet(draft, entry, i, { category, ph, rest, settings, now = Date.now() }) {
  const set = entry.sets[i];
  Object.assign(set, completeSet(set, ph, category));
  const problem = setProblem(set, category, settings);
  if (problem) return { problem };
  set.done = true;
  set.doneAt = now;
  // inside a superset the rest starts after the last exercise of the round
  if (entry.supersetId) {
    const group = draft.exercises.filter((e) => e.supersetId === entry.supersetId);
    if (group[group.length - 1] !== entry) return { rest: 0 };
  }
  if (!(rest > 0)) return { rest: 0 };
  return { rest: set.type === 'warmup' ? Math.min(rest, 60) : rest };
}

/** Uncheck a logged set: it's no longer logged, so its logging time goes too. @param {{ done?: boolean, doneAt?: number }} set */
export function uncheckSet(set) {
  set.done = false;
  delete set.doneAt;
}

export const LOG_REMINDER_DELAY = 15 * 60000;

/**
 * When the "log your set" reminder is due (ms), or null with no workout running.
 * Warm-ups count as logging too. No clock here: a past due time stays past.
 * @param {{ startedAt: number, exercises: { sets: { done?: boolean, doneAt?: number }[] }[], rest?: { end: number } | null, restEndedAt?: number } | null | undefined} active
 * @param {{ restEnd?: number | null, delay?: number }} [options]
 * @returns {number | null}
 */
export function logReminderAt(active, { restEnd = active?.rest?.end ?? active?.restEndedAt, delay = LOG_REMINDER_DELAY } = {}) {
  if (!active) return null;
  let latest = active.startedAt;
  for (const entry of active.exercises) {
    for (const set of entry.sets) {
      if (set.done && set.doneAt) latest = Math.max(latest, set.doneAt);
    }
  }
  if (restEnd != null) latest = Math.max(latest, restEnd);
  return latest + delay;
}

/**
 * "Save them as done" at Finish: the pending sets (from pendingSets) are filled
 * and logged now; a set keeps a logging time it already has (#43).
 * `filled` maps set id -> the filled values.
 * @param {{ exercises: { sets: DraftSet[] }[] }} draft
 * @param {Map<string, Partial<DraftSet>>} filled
 * @param {number} [now]
 */
export function logPendingSets(draft, filled, now = Date.now()) {
  for (const e of draft.exercises) {
    for (const x of e.sets) {
      if (!filled.has(x.id)) continue;
      Object.assign(x, filled.get(x.id), { done: true });
      if (!x.doneAt) x.doneAt = now;
    }
  }
}

/**
 * Unchecked sets the user started typing into, completed from the
 * placeholders like checking them off would. Returns [{ set, filled }] for
 * the ones that would be valid. `previousSets(exerciseId, templateId)` looks
 * up last time's sets.
 * @template {DraftSet} S
 * @param {{ kind?: string, id: string, templateId?: string | null, exercises: { exerciseId: string, sets: S[] }[] }} draft
 * @param {{ exercises: Map<string, { category: string }>, previousSets: (exerciseId: string, templateId: string | null) => SetLike[] | null | undefined,
 *   settings: UnitSettings }} o
 * @returns {{ set: S, filled: DraftSet }[]}
 */
export function pendingSets(draft, { exercises, previousSets, settings }) {
  /** @type {{ set: S, filled: DraftSet }[]} */
  const out = [];
  for (const entry of draft.exercises) {
    const ex = exercises.get(entry.exerciseId);
    if (!ex) continue;
    const fields = loggedFields(ex.category);
    const rows = placeholders(entry, previousSets(entry.exerciseId, draftTemplateId(draft)), settings);
    entry.sets.forEach((set, i) => {
      if (set.done || !fields.some((f) => !blank(set[f]))) return;
      const filled = completeSet(set, rows[i].ph, ex.category);
      if (!setProblem(filled, ex.category, settings)) out.push({ set, filled });
    });
  }
  return out;
}

/** How much a running workout holds: checked sets, and unchecked sets with typed numbers. @param {{ exercises: { sets: DraftSet[] }[] }} a */
export function progressOf(a) {
  let done = 0, typed = 0;
  for (const e of a.exercises) {
    for (const s of e.sets) {
      if (s.done) done++;
      else if (/** @type {const} */ (['w', 'r', 'd', 't']).some((k) => !blank(s[k]))) typed++;
    }
  }
  return { done, typed };
}

/**
 * The finished workout to save. `mode` 'done' keeps only checked sets, 'all'
 * also unchecked sets that are valid as typed. `defaultName` is used when the
 * name was cleared.
 * @param {{ id: string, name?: string, notes?: string, startedAt: number, templateId?: string | null, exercises: DraftEntry[] }} a
 * @param {{ settings: UnitSettings, exercises: Map<string, { category: string }>, now?: number, mode?: 'done' | 'all', defaultName?: string }} o
 */
export function finishWorkout(a, { settings, exercises, now = Date.now(), mode = 'done', defaultName = '' }) {
  return {
    id: a.id,
    name: (a.name || '').trim() || defaultName,
    notes: (a.notes || '').trim(),
    startedAt: a.startedAt,
    endedAt: Math.max(now, a.startedAt + 60000),
    templateId: a.templateId || null,
    exercises: draftEntries(a, settings, exercises, { onlyDone: mode === 'done' }),
  };
}

/**
 * Rate a set by the reps left in reserve (0, 1, or 2 for "2+"), or clear the
 * rating with null. 0 is failure: a working set rated 0 becomes a failure set,
 * and a failure set rated anything else (or unrated) becomes a working set
 * again, so the type and the rating never disagree. An RPE on the set gives
 * way too. Warm-ups and drop sets keep their type.
 * @param {DraftSet} set
 * @param {unknown} rir
 */
export function rateSet(set, rir) {
  const v = normRir(rir);
  if (v === null) delete set.rir;
  else set.rir = v;
  if (set.rpe !== undefined) set.rpe = '';
  if (v === 0 && (set.type || 'normal') === 'normal') set.type = 'failure';
  else if (v !== 0 && set.type === 'failure') set.type = 'normal';
}

/**
 * Change a set's type the way the set menu does: a failure set has 0 reps
 * left, and a set that stops being one loses that 0.
 * @param {DraftSet} set
 * @param {string} type
 */
export function setSetType(set, type) {
  const was = set.type || 'normal';
  set.type = type;
  if (type === 'failure') {
    set.rir = 0;
    if (set.rpe !== undefined) set.rpe = '';
  } else if (was === 'failure' && normRir(set.rir) === 0) {
    delete set.rir;
  }
}

// ---------- the session: what comes next ----------
// The running workout is done exercise by exercise; a superset is done
// together, one round after another. A "unit" is one exercise or one
// superset; its id is the id of its first entry.

/**
 * The units of a list of entries, in order. A superset stays together where its first exercise is.
 * @template {Grouped} E
 * @param {E[]} list
 * @returns {Unit<E>[]}
 */
export function sessionUnits(list) {
  /** @type {Unit<E>[]} */
  const units = [];
  /** @type {Map<string, Unit<E>>} */
  const bySuperset = new Map();
  for (const e of list) {
    const group = e.supersetId ? bySuperset.get(e.supersetId) : null;
    if (group) { group.entries.push(e); continue; }
    const unit = { id: e.id, entries: [e] };
    if (e.supersetId) bySuperset.set(e.supersetId, unit);
    units.push(unit);
  }
  return units;
}

/**
 * The sets of a unit in the order they are done: set 1 of each exercise, then set 2…
 * @template {{ sets: unknown[] }} E
 * @param {Unit<E>} unit
 * @returns {{ entry: E, set: E['sets'][number], index: number }[]}
 */
export function unitSets(unit) {
  /** @type {{ entry: E, set: E['sets'][number], index: number }[]} */
  const out = [];
  const rounds = Math.max(0, ...unit.entries.map((e) => e.sets.length));
  for (let i = 0; i < rounds; i++) {
    for (const entry of unit.entries) if (entry.sets[i]) out.push({ entry, set: entry.sets[i], index: i });
  }
  return out;
}

/** The unit an entry belongs to. @template {{ id: string }} E @param {Unit<E>[]} units @param {string} entryId @returns {Unit<E> | null} */
export const unitOf = (units, entryId) => units.find((u) => u.entries.some((e) => e.id === entryId)) || null;

/**
 * Where the session is: the unit on screen and the set to log next.
 * `current` is the entry the person switched to (or null): its unit stays on
 * screen. Otherwise, while a rest runs, the unit of the set just logged
 * stays (to rate it, or add one more); else it is the first unit with sets
 * left to log. Returns { units, unit, next } where `next` is
 * { entry, set, index } or null when the unit has nothing left to log.
 * @template {Grouped & { sets: { done?: boolean }[] }} E
 * @param {{ exercises: E[] }} draft
 * @param {{ current?: string | null, restEntryId?: string | null }} [o]
 * @returns {{ units: Unit<E>[], unit: Unit<E> | null, next: { entry: E, set: E['sets'][number], index: number } | null }}
 */
export function sessionState(draft, { current = null, restEntryId = null } = {}) {
  const units = sessionUnits(draft.exercises);
  /** @param {Unit<E>} u */
  const pending = (u) => unitSets(u).find((x) => !x.set.done) || null;
  const unit = (current && unitOf(units, current))
    || (restEntryId && unitOf(units, restEntryId))
    || units.find((u) => pending(u))
    || units[units.length - 1]
    || null;
  return { units, unit, next: unit ? pending(unit) : null };
}

/**
 * The exercise the session goes to next (#60): the first unit in order, other
 * than the one with entry `fromId`, that still has sets to log (an earlier one
 * the person skipped comes first). Null when nothing else is left: Finish.
 * @template {Grouped & { sets: { done?: boolean }[] }} E
 * @param {{ exercises: E[] }} draft
 * @param {string | null} [fromId]
 * @returns {Unit<E> | null}
 */
export function nextUnit(draft, fromId = null) {
  const units = sessionUnits(draft.exercises);
  const from = fromId ? unitOf(units, fromId) : null;
  return units.find((u) => u !== from && unitSets(u).some((x) => !x.set.done)) || null;
}

/**
 * Where the session stays after a set of entry `entryId` was logged (#60):
 * once that set finishes its exercise (a superset: its last round), on it, so
 * the person moves on with "Next: …" (one more set stays possible); the rest
 * timer ending doesn't move it. Otherwise where it was. Returns the new
 * `current`.
 * @param {{ exercises: (Grouped & { sets: { done?: boolean }[] })[], current?: string | null }} draft
 * @param {string} entryId
 * @returns {string | null}
 */
export function currentAfterLog(draft, entryId) {
  const unit = unitOf(sessionUnits(draft.exercises), entryId);
  if (unit && !unitSets(unit).some((x) => !x.set.done)) return entryId;
  return draft.current ?? null;
}

/**
 * The smallest change of an exercise's weight, in the person's unit, for the
 * keypad's −/+ keys: a pair of the smallest plates on a barbell (2.5 kg,
 * 5 lb), the dumbbell rack's step (2 kg, 5 lb), else 2.5 kg or 5 lb.
 * @param {string} cat
 * @param {{ unit: string, plates?: number[] }} settings
 * @returns {number}
 */
export function weightStep(cat, settings) {
  const lb = settings.unit === 'lb';
  if (cat === 'barbell') {
    const smallest = Math.min(...(settings.plates || []).filter((p) => p > 0));
    if (Number.isFinite(smallest)) return smallest * 2;
  }
  if (cat === 'dumbbell') return lb ? 5 : 2;
  return lb ? 5 : 2.5;
}

/** Is there any set left to log in the workout? @param {{ exercises: { sets: { done?: boolean }[] }[] }} draft */
export const hasPendingSets = (draft) => draft.exercises.some((e) => e.sets.some((s) => !s.done));

/**
 * Move the unit that starts with entry `fromId` to where the unit starting
 * with `toId` is (before it when moving up, after it when moving down),
 * keeping supersets together. Returns false if nothing moved.
 * @param {Grouped[]} list
 * @param {string} fromId
 * @param {string} toId
 */
export function moveUnit(list, fromId, toId) {
  const units = sessionUnits(list);
  const from = units.findIndex((u) => u.id === fromId);
  const to = units.findIndex((u) => u.id === toId);
  if (!moveItem(units, from, to)) return false;
  list.splice(0, list.length, ...units.flatMap((u) => u.entries));
  return true;
}

/**
 * Move a unit in the running workout (moveUnit) and return the entry to show
 * afterwards, the new `current` (#137); null when nothing moved. An exercise
 * on screen with a set logged stays on screen. One with nothing logged yet
 * gives way: an exercise dropped above it comes on screen, and when it is
 * dragged down, the first one it passed that has sets left takes its place.
 * Any other move leaves the screen as it was.
 * @param {(Grouped & { sets: { done?: boolean }[] })[]} list
 * @param {string} fromId the unit moved (the id of its first entry)
 * @param {string} toId the unit whose place it takes
 * @param {string | null} shownId an entry of the unit on screen
 * @returns {string | null}
 */
export function sessionMove(list, fromId, toId, shownId) {
  const before = sessionUnits(list);
  const shown = shownId ? unitOf(before, shownId) : null;
  if (!moveUnit(list, fromId, toId)) return null;
  if (!shown) return null;
  const sets = unitSets(shown);
  if (sets.some((x) => x.set.done)) return shown.id;
  const after = sessionUnits(list);
  /** @param {Unit<Grouped & { sets: { done?: boolean }[] }>[]} units @param {string} id */
  const at = (units, id) => units.findIndex((u) => u.id === id);
  /** @param {Unit<Grouped & { sets: { done?: boolean }[] }>} u */
  const left = (u) => unitSets(u).some((x) => !x.set.done);
  if (fromId === shown.id) {
    const was = at(before, shown.id), now = at(after, shown.id);
    return (now > was && after.slice(was, now).find(left)?.id) || shown.id;
  }
  const moved = after[at(after, fromId)];
  const above = at(before, fromId) > at(before, shown.id) && at(after, fromId) < at(after, shown.id);
  return above && moved && left(moved) ? moved.id : shown.id;
}

// ---------- editing the list ----------
/**
 * New entries for picked exercises, with as many sets as last time (templates
 * get at least 3). A unilateral exercise (#54) gets them per side: last
 * time's sides in order, or a left and a right for each set without one (or
 * each new set).
 * @param {string[]} exerciseIds
 * @param {{ previousSets: (id: string) => SetLike[] | null | undefined, kind?: string, isUnilateral?: (id: string) => boolean }} o
 */
export function newEntries(exerciseIds, { previousSets, kind = 'workout', isUnilateral = () => false }) {
  return exerciseIds.map((id) => {
    const prev = previousSets(id);
    const working = prev ? prev.filter((s) => s.type !== 'warmup') : [];
    if (isUnilateral(id)) {
      const sides = working.some(sideOf)
        ? working.filter(sideOf).slice(0, 12).map(sideOf)
        : Array.from({ length: Math.min(Math.max(working.length || 1, kind === 'template' ? 3 : 1), 6) }, () => ['left', 'right']).flat();
      const entry = newEntryDraft(id, 0);
      entry.sets = sides.map((side) => newSetDraft('normal', { side }));
      return entry;
    }
    const count = prev ? Math.min(working.length || 1, 6) : 1;
    return newEntryDraft(id, kind === 'template' ? Math.max(count, 3) : count);
  });
}

/**
 * Add a set: retain repeated sides, otherwise alternate; drop sets keep their
 * type. A unilateral exercise's set always gets a side (nextSide, #54).
 * @param {{ sets: DraftSet[] }} entry
 */
export function addSet(entry, { unilateral = false } = {}) {
  const last = entry.sets[entry.sets.length - 1];
  const side = sideOf(last), before = sideOf(entry.sets[entry.sets.length - 2]);
  const type = last && last.type === 'drop' ? 'drop' : 'normal';
  const next = unilateral ? nextSide(entry.sets, type) : side && (side === before ? side : side === 'left' ? 'right' : 'left');
  // a routine's rep range carries on to a set like the one above (#44)
  const range = last && (last.type || 'normal') === type && last.range ? { range: last.range } : {};
  entry.sets.push(newSetDraft(type, { ...(next ? { side: next } : {}), ...range }));
}

/** Move an item of a list from one place to another. @param {unknown[]} list @param {number} from @param {number} to */
export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
  return true;
}

/**
 * Put `entry` into a superset with `other`: it joins other's group (or they start one) and moves next to it.
 * @param {Grouped[]} list
 * @param {Grouped} entry
 * @param {Grouped} other
 */
export function joinSuperset(list, entry, other) {
  const old = entry.supersetId;
  const id = other.supersetId || uid();
  other.supersetId = id;
  entry.supersetId = id;
  if (old && old !== id) dissolveLoneSupersets(list, { only: [old], asNull: true });
  // keep the group together: this entry goes right after the group's last one
  list.splice(list.indexOf(entry), 1);
  const lastOfGroup = list.map((e, i) => (e.supersetId === id ? i : -1)).filter((i) => i >= 0).pop();
  list.splice((lastOfGroup ?? -1) + 1, 0, entry);
}

/** Take `entry` out of its superset; one left with one exercise dissolves. @param {Grouped[]} list @param {Grouped} entry */
export function leaveSuperset(list, entry) {
  const id = entry.supersetId;
  entry.supersetId = null;
  if (id) dissolveLoneSupersets(list, { only: [id], asNull: true });
}

/**
 * Take entry `id` out of a list (running workout, routine editor, Edit
 * workout): a superset left with one exercise dissolves, one left with two or
 * more stays (#39). Returns what restoreEntry needs to undo it, or null.
 * @template {Grouped} E
 * @param {E[]} list
 * @param {string} id
 * @returns {Removed<E> | null}
 */
export function removeEntry(list, id) {
  const index = list.findIndex((e) => e.id === id);
  if (index < 0) return null;
  const [entry] = list.splice(index, 1);
  const supersetId = entry.supersetId || null;
  const dissolved = supersetId ? dissolveLoneSupersets(list, { only: [supersetId], asNull: true }) : [];
  return { entry: JSON.parse(JSON.stringify(entry)), index, supersetId, dissolved };
}

/**
 * Undo removeEntry: the entry back in its place and in its superset, with a partner that was left alone (unless it joined another since).
 * @param {Grouped[]} list
 * @param {Removed | null | undefined} removed
 */
export function restoreEntry(list, removed) {
  if (!removed || list.some((e) => e.id === removed.entry.id)) return;
  const { supersetId, dissolved } = removed;
  for (const e of list) if (dissolved.includes(e.id) && !e.supersetId) e.supersetId = supersetId;
  list.splice(Math.min(removed.index, list.length), 0, JSON.parse(JSON.stringify({ ...removed.entry, supersetId })));
}

/**
 * A stored routine's entries without an exercise (deleted from the library): supersets left with one exercise dissolve (#39).
 * @template {{ exerciseId: string, supersetId?: string | null }} E
 * @param {E[]} entries
 * @param {string} exerciseId
 * @returns {E[]}
 */
export function withoutExercise(entries, exerciseId) {
  const out = entries.filter((e) => e.exerciseId !== exerciseId).map((e) => ({ ...e }));
  dissolveLoneSupersets(out);
  return out;
}

/**
 * Superset letter (A, B, …) and index for every group, in list order.
 * @param {{ supersetId?: string | null }[]} list
 * @returns {Map<string, { index: number, letter: string }>}
 */
export function supersetLetters(list) {
  /** @type {Map<string, { index: number, letter: string }>} */
  const out = new Map();
  for (const e of list) if (e.supersetId && !out.has(e.supersetId)) out.set(e.supersetId, { index: out.size, letter: String.fromCharCode(65 + out.size) });
  return out;
}

/**
 * Swap the exercise of an entry. Values go when the new one logs different fields.
 * @param {{ exerciseId: string, restSec?: number | null, focus?: string | null, sets: DraftSet[] }} entry
 * @param {{ category: string } | null | undefined} oldEx
 * @param {{ id: string, category: string }} newEx
 */
export function replaceExercise(entry, oldEx, newEx) {
  const sameKind = newEx && oldEx && loggedFields(newEx.category).join() === loggedFields(oldEx.category).join();
  entry.exerciseId = newEx.id;
  if (!sameKind) for (const s of entry.sets) { s.w = ''; s.r = ''; s.d = ''; s.t = ''; s.done = false; delete s.orig; }
  for (const s of entry.sets) delete s.tpl;
  // the rest timer and focus metric belonged to the old exercise
  entry.restSec = null;
  if (!focusOptions(newEx.category).some((k) => k === entry.focus)) entry.focus = null;
}

/**
 * Put warm-up sets in front of the first working set (replacing unchecked
 * warm-ups). Weights are worked out in the unit you lift in, so lb dumbbells
 * land on 5 lb steps. Returns { added } or { problem }.
 * @param {{ sets: DraftSet[] }} entry
 * @param {{ ph: Placeholder }[]} rows
 * @param {string} cat
 * @param {{ unit: string, bar: number, plates: number[], warmup?: { barReps: number, steps?: [number, number][] } }} settings
 * @returns {{ added: number, problem?: undefined } | { problem: string, added?: undefined }}
 */
export function addWarmups(entry, rows, cat, settings) {
  const firstWork = entry.sets.findIndex((s) => s.type !== 'warmup');
  const src = firstWork >= 0 ? (parseNum(entry.sets[firstWork].w) ?? parseNum(rows[firstWork].ph.w)) : null;
  if (!src) return { problem: WORKOUT_MESSAGES.warmupNeedsWeight };
  const st = settings;
  const ws = warmupSets(src, st.bar, st.plates, cat === 'barbell', st.warmup, st.unit === 'lb' ? 5 : 2);
  if (!ws.length) return { problem: WORKOUT_MESSAGES.warmupTooLight };
  entry.sets = entry.sets.filter((s) => !(s.type === 'warmup' && !s.done));
  entry.sets.unshift(...ws.map((x) => newSetDraft('warmup', { w: numToInput(x.w), r: String(x.r) })));
  return { added: ws.length };
}

/**
 * The record sets of the running workout so far (#37), worked out the way the
 * summary does it (the logged sets as Finish saves them, prsForNewWorkout): per
 * exercise and metric at most one set, the best logged working set if it beats
 * the stored best. A later, better set takes the record over; an equal one
 * doesn't; several entries of one exercise count together; an exercise's first
 * session sets none. Returns setId -> the metrics it holds, so its size is the
 * number of records (a set beating several metrics is one record).
 * @param {{ startedAt: number, exercises: DraftEntry[] }} a
 * @param {Map<string, Record<string, number>>} bests
 * @param {Map<string, ExerciseLike>} exercises
 * @param {UnitSettings & { formula: string }} settings
 * @returns {Map<string, string[]>}
 */
export function liveRecordSets(a, bests, exercises, settings) {
  const logged = { startedAt: a.startedAt, exercises: draftEntries(a, settings, exercises, { onlyDone: true }) };
  /** @type {Map<string, string[]>} */
  const out = new Map();
  for (const p of prsForNewWorkout(logged, { bests }, exercises, settings.formula)) out.set(p.setId, [...(out.get(p.setId) || []), p.metric]);
  return out;
}

// ---------- focus metric ----------
// One number per exercise the user wants to push (the "focus metric"),
// from the sets as they stand (typed values, else the grey placeholders),
// compared with the previous session.
export const FOCUS_LABEL = {
  volume: 'Total volume', volumeChange: 'Volume increase', reps: 'Total reps', weightPerRep: 'Weight/rep', repsChange: 'Reps increase',
};
/** @typedef {keyof typeof FOCUS_LABEL} FocusMetric */
/** The focus metrics an exercise of category `cat` offers. @param {string | undefined} cat @returns {FocusMetric[]} */
export function focusOptions(cat) {
  if (usesWeight(cat) && countsVolume(cat)) return ['volume', 'volumeChange', 'reps', 'weightPerRep'];
  if (cat === 'reps' || cat === 'assisted_bw') return ['reps', 'repsChange'];
  return [];
}
/**
 * Each focus metric's value for an entry, its sets as they stand (typed, else
 * the placeholders); the changes are against `prevSets`, null without them.
 * @param {{ sets: DraftSet[] }} entry
 * @param {{ ph: Placeholder }[]} rows
 * @param {string} cat
 * @param {SetLike[] | null | undefined} prevSets
 * @param {UnitSettings} settings
 * @param {number} [now]
 * @returns {Record<FocusMetric, number | null>}
 */
export function focusValues(entry, rows, cat, prevSets, settings, now = Date.now()) {
  const cur = entry.sets.map((s, i) => draftToSet({ ...s, w: s.w || rows[i].ph.w, r: s.r || rows[i].ph.r }, settings))
    .filter((s) => isWorking(s) && (s.r ?? 0) > 0);
  const prev = (prevSets || []).filter((s) => isWorking(s) && s.r > 0);
  /** @template {SetLike} T @param {T[]} list @param {(s: T) => number} f */
  const sum = (list, f) => list.reduce((a, s) => a + f(s), 0);
  const vol = sum(cur, (s) => setVolume(s, cat, now));
  const pvol = sum(prev, (s) => setVolume(s, cat, now));
  const reps = sum(cur, (s) => s.r ?? 0);
  const preps = sum(prev, (s) => s.r);
  return {
    volume: vol,
    volumeChange: pvol > 0 && vol > 0 ? (vol - pvol) / pvol : null,
    reps,
    weightPerRep: reps > 0 && vol > 0 ? vol / reps : null,
    repsChange: preps > 0 && reps > 0 ? (reps - preps) / preps : null,
  };
}
