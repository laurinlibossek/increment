// Starting and finishing a workout: the questions on the way (a workout is
// already running, unchecked sets), where the app goes next, and what a
// finished workout does to its routine: better numbers go in by themselves,
// a changed layout is asked about once over the summary. The rules are the
// shared core's (core/workout.js, templates.js).
import { useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import {
  progressOf, workoutNameKey, pendingSets, logPendingSets, templateChanges, progressTemplate, entriesSetCount, routineReadiness, entryKeys,
} from '@increment/core';

import {
  discardActive, editActive, finishActive, getState, previousSets, restoreTemplateExercises, saveTemplate, startWorkout,
} from '@/data/store';
import type {
  ActiveWorkout, Template, TemplateEntry, Workout,
} from '@/data/types';
import {
  actionSheet, ask, choose, toast, type DiffLine,
} from '@/ui/overlay';
import type { Format } from './format';
import type { Tr } from './i18n';
import { attempt } from './saving';

type F = Format & { tr: Tr };

export function openWorkout() { router.push('/active'); }

/** One question for every way of throwing a running workout away. */
/** The logged sets as the summary will count them (entriesSetCount): a left and a right are one set (#72). */
function loggedSets(a: ActiveWorkout) {
  const { exercises, settings } = getState();
  const done = a.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }));
  return (entriesSetCount(done, exercises, { pair: settings.pairSides !== false }) as { sets: number }).sets;
}

export function confirmDiscard(a: ActiveWorkout, title: string, tr: Tr) {
  const { done, typed } = progressOf(a);
  return ask({
    title,
    message: done ? tr('Everything you logged in it will be deleted.')
      : typed ? tr('The numbers you typed in it will be lost.') : tr('Nothing has been logged yet.'),
    ok: tr('Discard'), cancel: tr('Keep going'), destructive: true, testID: 'confirm-discard',
  });
}

/** Start a workout (empty, from a template, or again from a finished one) and open it. */
export async function beginWorkout(from: { template?: Template | null; fromWorkout?: Workout | null }, f: F) {
  const { tr } = f;
  const a = getState().active;
  if (a) {
    const c = await actionSheet<string>({
      title: tr('A workout is already running'),
      message: tr('“{name}” started {time}.', { name: a.name, time: f.date.time(a.startedAt) }),
      actions: [
        { label: tr('Resume that workout'), value: 'resume', testID: 'resume-running' },
        { label: tr('Discard it and start new'), value: 'new', destructive: true, testID: 'replace-running' },
      ],
    });
    if (c === 'resume') { openWorkout(); return; }
    if (c !== 'new') return;
    const { done, typed } = progressOf(a);
    if ((done || typed) && !(await confirmDiscard(a, tr('Discard “{name}”?', { name: a.name }), tr))) return;
    discardActive();
  }
  startWorkout(from, tr(workoutNameKey(Date.now())));
  openWorkout();
}

/** Finish: ask about unchecked sets, save, then show the summary in place of the workout. */
export async function finishFlow(f: F) {
  const { tr } = f;
  const a = getState().active;
  if (!a) return;
  const s = getState();
  let done = 0;
  for (const e of a.exercises) for (const x of e.sets) if (x.done) done++;
  const pending = pendingSets(a, {
    exercises: s.exercises, settings: s.settings, previousSets: (id: string, templateId: string | null) => previousSets(id, { templateId }),
  }) as { set: { id: string }; filled: Record<string, unknown> }[];
  if (!done && !pending.length) {
    const ok = await ask({
      title: tr('Nothing logged yet'), message: tr('Check off at least one set to save this workout. Discard it instead?'),
      ok: tr('Discard workout'), cancel: tr('Keep going'), destructive: true,
    });
    if (ok) { discardActive(); router.back(); }
    return;
  }
  if (pending.length) {
    const c = await actionSheet<'all' | 'done'>({
      title: pending.length === 1 ? tr('1 set with numbers isn’t checked off') : tr('{n} sets with numbers aren’t checked off', { n: pending.length }),
      actions: [
        { label: tr('Save them as done'), value: 'all', testID: 'save-pending' },
        { label: tr('Leave them out'), value: 'done', destructive: true, testID: 'drop-pending' },
      ],
    });
    if (!c) return;
    if (c === 'done' && !done) { toast(tr('Nothing checked off to save')); return; }
    if (c === 'all') {
      const filled = new Map(pending.map((p) => [p.set.id, p.filled]));
      editActive((draft) => {
        logPendingSets(draft, filled, Date.now());
      });
    }
  } else {
    const ok = await ask({
      // the summary's count: a left and a right are one set (#72)
      title: tr('Finish workout?'), message: tr('{sets} logged in {time}.', { sets: f.plural(loggedSets(a), 'set'), time: f.dur(Date.now() - a.startedAt) }),
      ok: tr('Finish'), cancel: tr('Cancel'), testID: 'confirm-finish',
    });
    if (!ok) return;
  }
  const result = await attempt(tr, finishActive('done', tr(workoutNameKey(a.startedAt))));
  if (!result) return;
  await progressRoutine(result.workout);
  router.replace({ pathname: '/summary/[id]', params: { id: result.workout.id } });
}

/** What a finished workout changed in its routine (core templateChanges). */
export interface TemplateDiff {
  addedExercises: number; removedExercises: number; reordered: boolean; addedSets: number; removedSets: number;
  typesChanged: boolean; sidesChanged: boolean; supersetsChanged: boolean; valueSets: number; structure: boolean;
  added: string[]; removed: string[];
  /** Per exercise whose number of straight sets (normal and failure) changed: the routine's and the workout's; added and removed exercises too. */
  sets: { exerciseId: string; from: number; to: number; added?: boolean; removed?: boolean }[];
  /** A kept exercise has a different number of warm-ups, drop sets or failure sets. */
  warmupsChanged: boolean; dropsChanged: boolean; failuresChanged: boolean;
}

/**
 * What finishing a workout did to its routine, for the summary. The better
 * numbers are saved at Finish; when the layout changed too, `answer` is
 * 'pending' until the summary has asked "Change Push A?".
 */
export interface RoutineResult {
  templateId: string;
  /** The routine's exercises before the workout, for Undo. */
  before: TemplateEntry[];
  /** Sets whose numbers went up. */
  raised: number;
  /** The layout changes, when there are any. */
  diff: TemplateDiff | null;
  answer: 'pending' | 'updated' | 'kept' | null;
  undone: boolean;
  announced: boolean;
}
const results = new Map<string, RoutineResult>();
const routineListeners = new Set<() => void>();
function setResult(workoutId: string, patch: Partial<RoutineResult>) {
  const r = results.get(workoutId);
  if (!r) return;
  results.set(workoutId, { ...r, ...patch });
  routineListeners.forEach((l) => l());
}
const subscribeRoutine = (l: () => void) => { routineListeners.add(l); return () => { routineListeners.delete(l); }; };
/** The routine result of a workout finished in this session (or null), kept current for the summary. */
export function useRoutineResult(workoutId: string | undefined) {
  const get = () => (workoutId ? results.get(workoutId) || null : null);
  return useSyncExternalStore(subscribeRoutine, get, get);
}

const categoryOf = (exerciseId: string) => getState().exercises.get(exerciseId)?.category || 'barbell';
const routineOf = (templateId: string) => getState().templates.find((x) => x.id === templateId) || null;

/**
 * Progressive overload, right after Finish: a workout from a routine raises
 * the routine's numbers where the done sets were better (core progressTemplate);
 * equal or worse sets and anything skipped keep theirs. Nothing happens for
 * examples, "Do this workout again" or empty workouts (no templateId), or with
 * Settings → Update routines after workouts off. The summary then announces
 * it, and asks about the layout when that changed too.
 */
export async function progressRoutine(workout: Workout) {
  const s = getState();
  if (s.settings.askTemplateUpdate === false || !workout.templateId) return null;
  const t = routineOf(workout.templateId);
  if (!t || t.example) return null;
  const diff = templateChanges(t, workout) as TemplateDiff;
  const { exercises, raised } = progressTemplate(t.exercises, workout, categoryOf) as { exercises: TemplateEntry[]; raised: number };
  if (!raised && !diff.structure) return null;
  const before = JSON.parse(JSON.stringify(t.exercises)) as TemplateEntry[];
  if (raised) await saveTemplate({ ...t, exercises });
  const r: RoutineResult = {
    templateId: t.id, before, raised, diff: diff.structure ? diff : null, answer: diff.structure ? 'pending' : null, undone: false, announced: false,
  };
  results.set(workout.id, r);
  return r;
}

/** Which prompt an exercise of a routine gets (#49): "Weight increase recommended", "Less assistance weight recommended", or none. */
export type Readiness = 'weight' | 'assistance' | null;

/**
 * "Weight increase recommended" per entry of a routine (#49, core routineReadiness),
 * from its latest finished workout against the routine as it is now. None for
 * examples, and none with Settings → Update routines after workouts off.
 */
export function routineReady(t: Template | null | undefined): Readiness[] {
  if (!t) return [];
  const s = getState();
  if (t.example || s.settings.askTemplateUpdate === false) return t.exercises.map(() => null);
  const latest = s.workouts.find((w) => w.templateId === t.id) || null; // newest first
  return routineReadiness(t, latest, categoryOf) as Readiness[];
}

/** The same for a running workout's entries, matched to the routine's by exercise and occurrence. */
export function workoutReady(a: ActiveWorkout | null): Map<string, Readiness> {
  const out = new Map<string, Readiness>();
  const t = a?.templateId ? routineOf(a.templateId) : null;
  if (!a || !t) return out;
  const ready = routineReady(t);
  const byKey = new Map((entryKeys(t.exercises) as string[]).map((k, i) => [k, ready[i]]));
  (entryKeys(a.exercises) as string[]).forEach((k, i) => { const r = byKey.get(k); if (r) out.set(a.exercises[i].id, r); });
  return out;
}

/** The prompt's text. */
export const readyText = (r: Readiness, tr: Tr) => (r === 'assistance' ? tr('Less assistance weight recommended') : r === 'weight' ? tr('Weight increase recommended') : '');

/**
 * What's different in the layout, as diff lines for the routine popup: the
 * exercises and sets the routine would gain (+, on diff-added) first, then
 * what it would lose (−, on diff-removed), "× n" counting straight sets
 * (normal and failure). Then, plain, what else differs: warm-ups, drop sets,
 * failure sets, supersets, the order. Straight sets after warm-ups are the
 * plan Increment encourages, so intensifiers get a line of their own instead
 * of a count (Laurin, 5 Nov 2026); Update routine remembers them all.
 */
export function layoutLines(d: TemplateDiff, f: F): DiffLine[] {
  const { tr } = f;
  const name = (id: string) => f.exName(getState().exercises.get(id)) || tr('Unknown exercise');
  const gains = (x: TemplateDiff['sets'][number]) => !x.removed && (x.added || x.to > x.from);
  const line = (x: TemplateDiff['sets'][number]): DiffLine => {
    const n = x.added ? x.to : x.removed ? x.from : 0;
    const count = x.added || x.removed ? (n ? ` × ${n}` : '') : ` × ${x.from} → ${x.to}`;
    return { text: `${gains(x) ? '+' : '−'} ${name(x.exerciseId)}${count}`, tone: gains(x) ? 'added' : 'removed' };
  };
  return [
    ...d.sets.filter(gains).map(line),
    ...d.sets.filter((x) => !gains(x)).map(line),
    ...[
      d.warmupsChanged && tr('Warm-ups changed'),
      d.dropsChanged && tr('Drop sets changed'),
      d.failuresChanged && tr('Failure sets changed'),
      d.supersetsChanged && tr('Supersets changed'),
      d.reordered && tr('Order changed'),
      d.typesChanged && !d.warmupsChanged && !d.dropsChanged && !d.failuresChanged && tr('Set types changed'),
      d.sidesChanged && tr('Sides changed'),
    ].filter((x): x is string => !!x).map((text) => ({ text })),
  ];
}

/** The summary's line about the routine, or '' when there's nothing to say (yet). */
export function routineLine(r: RoutineResult | null, f: F) {
  if (!r || r.undone || r.answer === 'pending') return '';
  const name = routineOf(r.templateId)?.name || '';
  if (r.answer === 'updated') return f.tr('{name} now has this workout’s exercises and sets', { name });
  return r.raised ? f.tr('New numbers for {n} in {name}', { n: f.plural(r.raised, 'set'), name }) : '';
}

/**
 * Once, when the summary of a just-finished workout opens: ask about the
 * layout if it changed ("Keep routine", the main button, or "Update routine",
 * which asks once more and can go back; the better numbers are saved either
 * way), then a toast with Undo, which puts the routine back as it was before
 * the workout.
 */
export async function announceRoutine(workout: Workout, f: F) {
  const { tr } = f;
  const r = results.get(workout.id);
  if (!r || r.announced) return;
  setResult(workout.id, { announced: true });
  const name = () => routineOf(r.templateId)?.name || '';
  const undo = { label: tr('Undo'), fn: () => {
    restoreTemplateExercises(r.templateId, r.before).then(() => { setResult(workout.id, { undone: true }); toast(tr('Routine change undone')); });
  } };
  if (r.answer === 'pending' && r.diff) {
    const lines = layoutLines(r.diff, f);
    const removes = r.diff.removed.length > 0 || r.diff.removedSets > 0;
    // Sticking to the routine is the normal case, so Keep is the main button;
    // changing the layout takes a second, deliberate step (Laurin, 5 Nov 2026).
    let choice: 'update' | 'keep' | 'back' = 'back';
    while (choice === 'back') {
      choice = await choose<'update' | 'keep'>({
        title: tr('Change {name}?', { name: name() }),
        lines,
        message: r.raised ? tr('Your better numbers are saved either way.') : undefined,
        cancel: false,
        options: [
          { label: tr('Keep routine'), value: 'keep', tone: 'primary', testID: 'routine-keep' },
          { label: tr('Update routine'), value: 'update', tone: 'plain', testID: 'routine-update' },
        ],
      }) ?? 'keep';
      if (choice !== 'update') break;
      choice = await choose<'update' | 'back'>({
        title: tr('Update {name}?', { name: name() }),
        lines,
        message: tr('Next time, {name} starts with this workout’s exercises and sets.', { name: name() }),
        cancel: false,
        options: [
          { label: tr('Update routine'), value: 'update', tone: removes ? 'danger' : 'primary', testID: 'routine-update-confirm' },
          { label: tr('Go back'), value: 'back', tone: 'plain', testID: 'routine-update-back' },
        ],
      }) ?? 'back';
    }
    const t = routineOf(r.templateId);
    if (choice === 'update' && t) {
      const { exercises, raised } = progressTemplate(r.before, workout, categoryOf, { layout: true }) as { exercises: TemplateEntry[]; raised: number };
      await saveTemplate({ ...t, exercises });
      setResult(workout.id, { answer: 'updated', raised });
      toast(tr('{name} updated', { name: name() }), undo);
      return;
    }
    setResult(workout.id, { answer: 'kept' });
  }
  if (r.raised) toast(tr('New numbers for {n} in {name}', { n: f.plural(r.raised, 'set'), name: name() }), undo);
}
