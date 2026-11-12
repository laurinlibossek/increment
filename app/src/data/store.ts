// App state: loaded from storage once, then replaced (never mutated) on every
// change, so screens re-render through useAppState(). All the logic for
// backups, Strong import, records and suggestions is the shared core's.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  SEED_EXERCISES, SEED_VERSION, withDefaults, cleanChartMetrics, buildStats, sessionsByExercise, configureCalc, bodyweightFrom,
  parseBackup, parseStrongCSV, resolveStrongImport, STRONG_EXERCISE_ALIASES, suggestTemplate, previousSetsFrom, newActiveWorkout, finishWorkout, prsForNewWorkout, liveRecordSets, withoutExercise, withPinnedNote,
  workoutVolume, makeBackup, uid, seedExerciseChanges,
  templateFromDraft, workoutFromEditDraft, copyTemplateRecord, folderNames, findExerciseByName, newExerciseRecord,
  exerciseInDraft, patchDraftExercise, changeSetting, convertDraftUnits, mergeExercisePatch, moveExerciseEntries,
  changeExerciseFamily, cleanCustomFamilies, writeKey, coalesceWrites, splitBlocked, recordsOf,
} from '@increment/core';

import * as db from './storage';
import { Conflict, Unreadable, type Op, type Saved } from './storage-types';
import type {
  ActiveWorkout, AnyDraft, Data, DraftKey, EditDraft, EntryDraft, Exercise, Measurement, Meta, Profile, Settings, Template,
  TemplateDraft, TemplateEntry, WorkSet, Workout, WorkoutEditDraft,
} from './types';

export interface State {
  ready: boolean;
  error: string | null;
  exercises: Map<string, Exercise>;
  /** newest first */
  workouts: Workout[];
  templates: Template[];
  /** newest first */
  measurements: Measurement[];
  settings: Settings;
  profile: Profile;
  meta: Meta;
  strongAliases: Record<string, string>;
  /** The chart each exercise page shows, when chosen (#27). */
  chartMetrics: Record<string, string>;
  customFamilies: Record<string, string>;
  /** the running workout, or null */
  active: ActiveWorkout | null;
  /** the template or finished workout being edited, or null (not stored) */
  edit: EditDraft | null;
  /** changes are on screen but storage refused them (its message); cleared once they're all saved */
  saveProblem: string | null;
  /** records another tab changed while this one had changes to them waiting; see keepMine / takeSaved */
  conflicts: ConflictItem[];
  /** the browser's old data couldn't be read (its text, to save as a file); see startEmpty */
  unreadable: string | null;
  /** the running workout another tab finished or discarded (its id): its screen here closes instead of showing it on */
  activeGone: string | null;
}

/** A record with changes held because another tab changed it: this tab's value and the saved one (null: none, deleted). */
export interface ConflictItem { key: string; mine: unknown; saved: unknown }

let state: State = {
  ready: false,
  error: null,
  exercises: new Map(),
  workouts: [],
  templates: [],
  measurements: [],
  settings: withDefaults({}) as Settings,
  profile: { name: '' },
  meta: {},
  strongAliases: { ...STRONG_EXERCISE_ALIASES },
  chartMetrics: {},
  customFamilies: {},
  active: null,
  edit: null,
  saveProblem: null,
  conflicts: [],
  unreadable: null,
  activeGone: null,
};

const listeners = new Set<() => void>();
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  syncCalc();
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getState = () => state;
export const useAppState = () => useSyncExternalStore(subscribe, getState, getState);
/** Re-render only when the selected part changes (it must keep its identity otherwise). */
export function useAppSelector<T>(select: (s: State) => T): T {
  const get = () => select(state);
  return useSyncExternalStore(subscribe, get, get);
}
export const useSettings = () => useAppSelector((s) => s.settings);

// ---------- loading ----------
const byNewest = <T extends { startedAt?: number; at?: number }>(a: T, b: T) => ((b.startedAt ?? b.at ?? 0) - (a.startedAt ?? a.at ?? 0));

function fromData(data: Data): Partial<State> {
  return {
    exercises: new Map(data.exercises.map((e) => [e.id, e])),
    workouts: [...data.workouts].sort(byNewest),
    templates: data.templates,
    measurements: [...data.measurements].sort(byNewest),
    settings: withDefaults(data.kv.settings) as Settings,
    profile: { name: '', ...(data.kv.profile || {}) },
    meta: { ...(data.kv.meta || {}) },
    strongAliases: { ...STRONG_EXERCISE_ALIASES, ...(data.kv.strongAliases || {}) },
    customFamilies: cleanCustomFamilies(data.kv.customFamilies || {}, data.exercises),
    chartMetrics: cleanChartMetrics(data.kv.chartMetrics, data.exercises),
    active: data.kv.active || null,
  };
}

// ---------- saving ----------
// Every change is saved as a batch of writes, all or nothing (a finished
// workout with its cleared running workout, an import). Batches wait in `queue`
// until storage confirms them and are saved in order: the queue's latest value
// per record in one transaction, each record checked against the revision this
// app last read (`revs`), so a tab can't save over what another tab changed.
//  - 'shown' (most changes): on screen at once. If storage refuses, the batch
//    stays queued, state.saveProblem says so (a warning with Retry and Back up
//    now), and it is tried again on Retry and with the next change.
//  - 'after' (Finish, imports, exercise changes): `publish` puts it on screen
//    once it is saved. If storage refuses, it is dropped and the caller says so.
// A batch that writes a record another tab changed is held (`held`), with every
// batch saved together with it, and stays on screen until the person keeps
// theirs or takes the saved one (state.conflicts, keepMine, takeSaved; #35).
type Batch = {
  ops: Op[];
  mode: 'shown' | 'after';
  publish?: () => void;
  /** kv values that are patches: on a conflict they're applied to the saved value instead (meta's bookkeeping) */
  merge?: Partial<Record<string, Record<string, unknown>>>;
  resolve: () => void;
  reject: (e: unknown) => void;
};
let queue: Batch[] = [];
let held: Batch[] = [];
/** the saved value of each record held by a conflict */
const conflictSaved = new Map<string, Saved>();
/** each record's revision as this app last read or saved it (0 or missing: none) */
let revs = new Map<string, number>();
/** records an editor knows changed elsewhere since it opened: their save must be held */
const staleKeys = new Set<string>();
/** the change number this app has caught up to */
let lastSeen = 0;
/** how often another tab's change to each record was taken in (editors compare it, see openEdit) */
const external = new Map<string, number>();
let running: Promise<unknown> = Promise.resolve();

const docOp = (store: Op['store'] & string, value: { id: string }): Op => ({ store, id: value.id, value });
const delOp = (store: Op['store'] & string, id: string): Op => ({ store, id, value: null });
const kvOp = (key: keyof Data['kv'], value: unknown): Op => ({ kv: key, value: value ?? null });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)) || 'Couldn’t save';

/** Storage refused a save (`cause` is its own error). */
export class SaveFailed extends Error {
  cause: unknown;
  constructor(cause: unknown) {
    super(message(cause));
    this.name = 'SaveFailed';
    this.cause = cause;
  }
}
/** A save that didn't happen: the warning at the top already says so, so a screen that didn't wait for it needn't. */
const isSaveError = (e: unknown) => e instanceof Conflict || e instanceof SaveFailed;

/** Run after everything saved so far (restore and Delete all data). */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const r = running.then(fn);
  running = r.catch(() => {});
  return r;
}

/** Save a batch. Resolves once storage has it; rejects if it doesn't (Conflict: another tab changed one of its records). */
function save(ops: Op[], o: { mode?: Batch['mode']; publish?: () => void; merge?: Batch['merge'] } = {}): Promise<void> {
  if (!ops.length) { o.publish?.(); return Promise.resolve(); }
  let batch!: Batch;
  const p = new Promise<void>((resolve, reject) => { batch = { ops, mode: o.mode || 'shown', publish: o.publish, merge: o.merge, resolve, reject }; });
  // a screen that doesn't wait for it still has the warning; one that does still gets the error
  p.catch(() => {});
  queue.push(batch);
  kick();
  return p;
}

let kicked = false;
function kick() {
  if (kicked) return;
  kicked = true;
  running = running.then(() => { kicked = false; return drain(); }).catch(() => {});
}

async function drain() {
  while (queue.length) {
    if (held.length) {
      // a change to a held record waits with it
      const keys = new Set(held.flatMap((b) => b.ops.map(writeKey)));
      const s = splitBlocked(queue, keys) as { blocked: Batch[]; rest: Batch[] };
      if (s.blocked.length) { hold(s.blocked); queue = s.rest; continue; }
    }
    const batches = queue.slice();
    const ops = coalesceWrites(batches) as Op[];
    const expect = new Map(ops.map((op) => { const k = writeKey(op); return [k, staleKeys.has(k) ? -1 : revs.get(k) || 0]; }));
    try {
      const seq = await db.commit(ops, expect);
      for (const op of ops) {
        const k = writeKey(op);
        if (op.value === null || op.value === undefined) revs.delete(k); else revs.set(k, seq);
      }
      queue = queue.filter((b) => !batches.includes(b));
      for (const b of batches) { b.publish?.(); b.resolve(); }
      if (state.saveProblem && !queue.some((b) => b.mode === 'shown')) setState({ saveProblem: null });
    } catch (e) {
      if (e instanceof Conflict) {
        if (rebase(batches, e.saved)) continue;
        const s = splitBlocked(batches, [...e.saved.keys()]) as { blocked: Batch[]; rest: Batch[] };
        for (const [k, v] of e.saved) if (s.blocked.some((b) => b.ops.some((op) => writeKey(op) === k))) conflictSaved.set(k, v);
        queue = [...s.rest, ...queue.filter((b) => !batches.includes(b))];
        hold(s.blocked);
        continue;
      }
      // storage refused: what the screen shows waits for Retry; the rest is dropped
      queue = queue.filter((b) => !batches.includes(b) || b.mode === 'shown');
      const failed = new SaveFailed(e);
      for (const b of batches) b.reject(failed);
      if (queue.some((b) => b.mode === 'shown')) setState({ saveProblem: message(e) });
      return;
    }
  }
}

/** Meta's bookkeeping (last backup, folders…) changed in two tabs: apply this tab's patches to the saved value and go on. */
function rebase(batches: Batch[], saved: Map<string, Saved>): boolean {
  for (const k of saved.keys()) {
    const key = k.slice(3);
    if (!k.startsWith('kv/')) return false;
    const touching = batches.filter((b) => b.ops.some((op) => writeKey(op) === k));
    if (!touching.length || touching.some((b) => !b.merge?.[key])) return false;
  }
  const patch: Partial<State> = {};
  for (const [k, v] of saved) {
    const key = k.slice(3);
    let value = { ...((v.value as Record<string, unknown>) || {}) };
    for (const b of batches) {
      if (!b.merge?.[key]) continue;
      value = { ...value, ...b.merge[key] };
      b.ops = b.ops.map((op) => (writeKey(op) === k ? kvOp(key as keyof Data['kv'], value) : op));
    }
    if (v.rev) revs.set(k, v.rev); else revs.delete(k);
    if (key === 'meta') patch.meta = value as Meta;
  }
  setState(patch);
  return true;
}

/** Hold batches until the person decides (shown ones), or give up on them ('after' ones: the screen never had them). */
function hold(batches: Batch[]) {
  const conflict = new Conflict(conflictSaved);
  for (const b of batches) {
    b.reject(conflict);
    if (b.mode === 'shown') held.push(b);
  }
  const mine = new Map((coalesceWrites(held) as Op[]).map((op) => [writeKey(op), op.value]));
  setState({ conflicts: [...conflictSaved].filter(([k]) => mine.has(k)).map(([key, v]) => ({ key, mine: mine.get(key) ?? null, saved: v.value })) });
}

/** Records with changes this app hasn't saved yet: another tab's version doesn't replace them. */
function dirtyKeys() {
  const keys = new Set<string>();
  for (const b of [...queue, ...held]) if (b.mode === 'shown') for (const op of b.ops) keys.add(writeKey(op));
  if (activeTimer) keys.add('kv/active');
  return keys;
}

/** Try the waiting changes again (the warning's Retry). Resolves to true once everything is saved. */
export async function retrySaves(): Promise<boolean> {
  kick();
  await running;
  return !queue.length;
}

/** After a conflict: save this tab's version over the one saved now (the person looked at both). */
export async function keepMine() {
  if (!held.length) return;
  const keys = new Set(held.flatMap((b) => b.ops.map(writeKey)));
  const now = await db.readKeys(keys);
  for (const [k, v] of now) { if (v.rev) revs.set(k, v.rev); else revs.delete(k); staleKeys.delete(k); }
  queue = [...held, ...queue];
  held = [];
  conflictSaved.clear();
  rebaseEdit();
  setState({ conflicts: [] });
  return retrySaves();
}

/** After a conflict: drop this tab's changes to those records and take the saved version. */
export async function takeSaved() {
  const keys = new Set(held.flatMap((b) => b.ops.map(writeKey)));
  held = [];
  conflictSaved.clear();
  if (keys.has('kv/active') && activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
  const now = await db.readKeys(keys);
  for (const k of keys) staleKeys.delete(k);
  takeIn(now);
  rebaseEdit();
  setState({ conflicts: [] });
}

// ---------- other tabs ----------
/** Put records as saved now into the state (not those with changes waiting here). */
function takeIn(records: Map<string, Saved>, all = false) {
  const dirty = dirtyKeys();
  const changes = new Map<string, unknown>();
  for (const [k, v] of records) {
    if (dirty.has(k) || (!all && (v.rev || 0) === (revs.get(k) || 0))) continue;
    changes.set(k, v.value);
    if (v.rev) revs.set(k, v.rev); else revs.delete(k);
    external.set(k, (external.get(k) || 0) + 1);
  }
  if (!changes.size) return;
  const exercises = new Map(state.exercises);
  const lists = { workouts: new Map(state.workouts.map((w) => [w.id, w])), templates: new Map(state.templates.map((t) => [t.id, t])), measurements: new Map(state.measurements.map((m) => [m.id, m])) };
  const kv: Data['kv'] = {};
  const touched = new Set<string>();
  for (const [k, value] of changes) {
    const i = k.indexOf('/');
    const store = k.slice(0, i);
    const id = k.slice(i + 1);
    touched.add(store === 'kv' ? id : store);
    if (store === 'kv') (kv as Record<string, unknown>)[id] = value;
    else if (store === 'exercises') { if (value) exercises.set(id, value as Exercise); else exercises.delete(id); }
    else if (store in lists) {
      const list = lists[store as keyof typeof lists] as Map<string, unknown>;
      if (value) list.set(id, value); else list.delete(id);
    }
  }
  const patch: Partial<State> = {};
  if (touched.has('exercises')) patch.exercises = exercises;
  if (touched.has('workouts')) patch.workouts = [...lists.workouts.values()].sort(byNewest);
  if (touched.has('templates')) patch.templates = [...lists.templates.values()];
  if (touched.has('measurements')) patch.measurements = [...lists.measurements.values()].sort(byNewest);
  if (touched.has('settings')) patch.settings = withDefaults(kv.settings) as Settings;
  if (touched.has('profile')) patch.profile = { name: '', ...(kv.profile || {}) };
  if (touched.has('meta')) patch.meta = { ...(kv.meta || {}) };
  if (touched.has('strongAliases')) patch.strongAliases = { ...STRONG_EXERCISE_ALIASES, ...(kv.strongAliases || {}) };
  if (touched.has('chartMetrics')) patch.chartMetrics = cleanChartMetrics(kv.chartMetrics, patch.exercises || state.exercises);
  if (touched.has('customFamilies') || touched.has('exercises')) {
    const families = touched.has('customFamilies') ? kv.customFamilies || {} : state.customFamilies;
    patch.customFamilies = cleanCustomFamilies(families, [...exercises.values()]);
  }
  if (touched.has('active')) {
    patch.active = kv.active || null;
    if (!patch.active && state.active) patch.activeGone = state.active.id;
  }
  setState(patch);
}

let catching: Promise<void> | null = null;
let catchAgain = false;
/** Take in what other tabs saved since this one last looked (their message, coming back to the tab). */
export function catchUp(): Promise<void> {
  if (!loaded) return Promise.resolve();
  if (catching) { catchAgain = true; return catching; }
  catching = (async () => {
    try {
      do {
        catchAgain = false;
        const c = await db.changesSince(lastSeen);
        if (c.all) {
          // everything, after a restore elsewhere or a long time away: records gone there go here too
          const saved = new Map<string, Saved>();
          for (const [k, v] of recordsOf(c.all.data) as Map<string, unknown>) saved.set(k, { value: v, rev: c.all.revs.get(k) || 0 });
          for (const k of recordsOf(currentData()).keys() as Iterable<string>) if (!saved.has(k)) saved.set(k, { value: null, rev: 0 });
          takeIn(saved);
        } else if (c.changed?.size) takeIn(c.changed);
        lastSeen = c.seq;
      } while (catchAgain);
    } catch { /* the next message or return to the tab tries again */ } finally { catching = null; }
  })();
  return catching;
}

/** The state as stored data (what a backup holds, and what is compared with storage). */
function currentData(s: State = state): Data {
  return {
    exercises: [...s.exercises.values()], workouts: s.workouts, templates: s.templates, measurements: s.measurements,
    kv: { settings: s.settings, profile: s.profile, meta: s.meta, strongAliases: s.strongAliases, customFamilies: s.customFamilies, chartMetrics: s.chartMetrics, active: s.active },
  };
}

// ---------- loading ----------
/** Add built-in exercises the data doesn't have yet (first start, older backups). */
async function ensureSeed(tries = 2): Promise<void> {
  if ((state.meta.seedVersion || 0) >= SEED_VERSION && state.exercises.size) return;
  const changed = seedExerciseChanges(state.exercises) as Exercise[];
  const meta = { ...state.meta, seedVersion: SEED_VERSION, createdAt: state.meta.createdAt || Date.now() };
  const show = () => {
    const exercises = new Map(state.exercises);
    for (const e of changed) exercises.set(e.id, e);
    setState({ exercises, meta });
  };
  const ops = [...changed.map((e) => docOp('exercises', e)), kvOp('meta', meta)];
  try {
    await save(ops, { mode: 'after', publish: show });
  } catch (e) {
    // another tab added them first
    if (e instanceof Conflict && tries > 0) { await catchUp(); return ensureSeed(tries - 1); }
    if (e instanceof Conflict) throw e;
    // storage refused: work with them anyway, the warning shows and Retry saves them
    show();
    save(ops, { merge: { meta } });
  }
}

let watching = false;
/** storage was read: catching up has something to compare with */
let loaded = false;
export async function load() {
  if (!watching) {
    watching = true;
    AppState.addEventListener('change', (s) => {
      // write the running workout right away when the app goes to the background; catch up on coming back
      if (s !== 'active') flushActive(); else catchUp();
    });
    db.onExternalChange(() => { catchUp(); });
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => { catchUp(); });
      window.addEventListener('pageshow', () => { catchUp(); });
      window.addEventListener('unhandledrejection', (e) => { if (isSaveError(e.reason)) e.preventDefault(); });
      // a browser forgets what isn't saved when the page goes: ask first
      window.addEventListener('beforeunload', (e) => {
        if (!queue.some((b) => b.mode === 'shown') && !held.length) return;
        e.preventDefault();
        e.returnValue = '';
      });
    }
  }
  try {
    const l = await db.loadAll();
    revs = l.revs;
    lastSeen = l.seq;
    loaded = true;
    setState(fromData(l.data));
    await ensureSeed();
    setState({ ready: true, error: null, unreadable: null });
  } catch (e) {
    setState({ ready: true, error: message(e), unreadable: e instanceof Unreadable ? e.raw : null });
  }
}

/** After an error: try loading again. */
export function reload() {
  setState({ ready: false, error: null });
  return load();
}

/** The old data can't be read: start with none, deliberately (it stays in the browser, untouched). */
export async function startEmpty() {
  await db.startEmpty();
  return reload();
}

// ---------- derived ----------
function syncCalc() {
  const st = state.settings;
  configureCalc({
    formula: st.formula, dumbbellTwice: !!st.dumbbellTwice, bwWeighted: !!st.bwWeighted, bwAssisted: !!st.bwAssisted,
    bodyweightAt: (at: number) => bodyweightFrom(state.measurements, at),
  });
}

type Stats = ReturnType<typeof buildStats>;
let statsFor: { workouts: Workout[]; exercises: Map<string, Exercise>; key: string } | null = null;
let statsCache: Stats | null = null;
/** Records, PRs and sessions per exercise; follows "Start history from" like the web app. */
export function stats(s: State = state): Stats {
  const st = s.settings;
  const key = [st.formula, st.historyStart, st.dumbbellTwice, st.bwWeighted, st.bwAssisted].join(':');
  if (!statsCache || !statsFor || statsFor.workouts !== s.workouts || statsFor.exercises !== s.exercises || statsFor.key !== key) {
    const from = st.historyStart || 0;
    statsCache = buildStats(from ? s.workouts.filter((w) => w.startedAt >= from) : s.workouts, s.exercises, st.formula);
    statsFor = { workouts: s.workouts, exercises: s.exercises, key };
  }
  return statsCache;
}

let recordsFor: { active: State['active']; stats: Stats; settings: Settings } | null = null;
let recordsCache: Map<string, string[]> = new Map();
/**
 * The running workout's record sets (set id -> the metrics it holds), by the
 * summary's rule (#37): what the session, Now Lifting and Today count and colour.
 */
export function activeRecords(s: State = state): Map<string, string[]> {
  const st = stats(s);
  if (!s.active) return new Map();
  if (!recordsFor || recordsFor.active !== s.active || recordsFor.stats !== st || recordsFor.settings !== s.settings) {
    recordsCache = liveRecordSets(s.active, st.bests, s.exercises, s.settings) as Map<string, string[]>;
    recordsFor = { active: s.active, stats: st, settings: s.settings };
  }
  return recordsCache;
}

let allFor: Workout[] | null = null;
let allCache: Map<string, { workoutId: string; startedAt: number; name: string; entry: Workout['exercises'][number] }[]> | null = null;
/** Every session of every exercise, including those before "Start history from". */
export function allSessions(s: State = state) {
  if (!allCache || allFor !== s.workouts) {
    allCache = sessionsByExercise(s.workouts);
    allFor = s.workouts;
  }
  return allCache!;
}

export const suggestion = (s: State = state, now = Date.now()) => suggestTemplate(s.templates, s.workouts, now) as
  | { template: Template; why: { kind: 'after' | 'weekday' | 'due'; name?: string; day?: number; at?: number } }
  | null;

export const exerciseName = (id: string, s: State = state) => s.exercises.get(id)?.name;

// ---------- settings ----------
export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const prev = state.settings;
  const settings = changeSetting(prev, key as string, value) as Settings;
  const patch: Partial<State> = { settings };
  // numbers typed in the running workout (or an editor) follow a unit change
  if ((key === 'unit' || key === 'distUnit') && prev[key] !== value) {
    if (state.active) { const a = clone(state.active); convertDraftUnits(a, prev, settings); patch.active = a; }
    if (state.edit) { const d = clone(state.edit); convertDraftUnits(d, prev, settings); patch.edit = d; }
  }
  setState(patch);
  const ops = [kvOp('settings', settings)];
  if (patch.active) {
    if (activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
    ops.push(kvOp('active', patch.active));
  }
  await save(ops);
}

export async function setMeta(patch: Partial<Meta>) {
  const meta = { ...state.meta, ...patch };
  setState({ meta });
  await save([kvOp('meta', meta)], { merge: { meta: patch } });
}

/** Remember the chart chosen on an exercise's page (#27). */
export async function setChartMetric(exerciseId: string, metric: string) {
  const chartMetrics = { ...state.chartMetrics, [exerciseId]: metric };
  setState({ chartMetrics });
  await save([kvOp('chartMetrics', chartMetrics)]);
}

export async function setProfile(patch: Partial<Profile>) {
  const profile = { ...state.profile, ...patch };
  setState({ profile });
  await save([kvOp('profile', profile)]);
}

// ---------- backup ----------
export type BackupPreview = ReturnType<typeof readBackup>;

/** Check a backup file and say what's in it. Throws with an English message (a translation key). */
export function readBackup(text: string) {
  const parsed = parseBackup(text, SEED_EXERCISES) as { exportedAt?: string; data: Data; recovery: { active: ActiveWorkout } | null };
  const d = parsed.data;
  return {
    data: d,
    /** the running workout the backup was made during, if any (see runningWorkoutChoice) */
    active: parsed.recovery?.active || null,
    exportedAt: parsed.exportedAt ? Date.parse(parsed.exportedAt) : null,
    counts: { workouts: d.workouts.length, templates: d.templates.length, measurements: d.measurements.length },
  };
}

/**
 * Replace everything in storage with `data`, keeping `active` as the running
 * workout, in one transaction. Changes still waiting are part of what is
 * replaced; another tab's waiting changes are refused afterwards (revisions).
 */
function replaceEverything(data: Data, active: ActiveWorkout | null, patch: Partial<State> = {}) {
  return exclusive(async () => {
    if (activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
    const all: Data = { ...data, kv: { ...data.kv, active: active || undefined } };
    const seq = await db.replaceAll(all);
    const dropped = [...queue, ...held];
    queue = [];
    held = [];
    conflictSaved.clear();
    staleKeys.clear();
    revs = new Map([...(recordsOf(all).keys() as Iterable<string>)].map((k) => [k, seq]));
    lastSeen = seq;
    for (const b of dropped) b.reject(new Error('Replaced'));
    setState({ ...fromData(all), ...patch, saveProblem: null, conflicts: [] });
  });
}

/**
 * Replace everything in the app with a backup. The running workout is
 * `active`: by default the one in the app keeps going (the backup's, if the
 * app has none); see runningWorkoutChoice.
 */
export async function restoreBackup(preview: BackupPreview, active: ActiveWorkout | null = state.active || preview.active) {
  const data: Data = { ...preview.data, kv: { ...preview.data.kv, meta: { ...(preview.data.kv.meta || {}), seedVersion: 0 } } };
  await replaceEverything(data, active);
  await ensureSeed();
}

/**
 * Delete everything: workouts, templates, measurements, custom exercises,
 * settings, name and folders; the built-in exercises come back as new. Like
 * restoring a backup, a running workout keeps going.
 */
export async function deleteAllData() {
  const data: Data = { exercises: [], workouts: [], templates: [], measurements: [], kv: { meta: { seedVersion: 0 } } };
  await replaceEverything(data, state.active, { edit: null });
  await ensureSeed();
}

/**
 * Everything in the app as a backup file's text (the same format as the web
 * app's): what the screens show, so changes storage refused or holds for a
 * conflict are in it too, and the running workout beside the data (core
 * makeBackup). Reads nothing from storage, so it works when storage doesn't.
 */
export function backupText(appVersion: string, active: ActiveWorkout | null = state.active) {
  const { kv: { active: _running, ...kv }, ...lists } = currentData();
  return makeBackup({ ...lists, kv }, appVersion, new Date(), { active }) as string;
}

export const markBackedUp = () => setMeta({ lastBackupAt: Date.now() });

// ---------- Strong import ----------
export type StrongReview = ReturnType<typeof parseStrongCSV>;
/** Use an existing exercise, create one, or leave the exercise out of the import (#40). */
export type StrongChoice = { kind: 'existing'; exerciseId: string } | { kind: 'new'; name: string; category: string; bodyPart: string } | { kind: 'skip' };
export type StrongChoices = Record<string, StrongChoice>;

/** Parse a Strong export against the app's data. Nothing is saved yet. */
export function readStrong(text: string, units: { weightUnit: 'kg' | 'lb'; distUnit: 'km' | 'mi' }, defaultName: string) {
  return parseStrongCSV(text, {
    ...units,
    exercises: state.exercises,
    aliases: state.strongAliases,
    workouts: state.workouts,
    defaultName,
  });
}

/** All of the file's workouts are here already, every exercise matches and no notes are missing: nothing to review. */
export function strongNothingNew(preview: StrongReview): boolean {
  if (preview.review.length || preview.stats.workouts) return false;
  try {
    const r = resolveStrongImport(preview, {}, {
      exercises: state.exercises, workouts: state.workouts, aliases: state.strongAliases,
    }) as { stats: { notesAdded: number } };
    return !r.stats.notesAdded;
  } catch { return false; }
}

export async function saveStrongImport(preview: StrongReview, choices: StrongChoices) {
  const r = resolveStrongImport(preview, choices, {
    exercises: state.exercises, workouts: state.workouts, aliases: state.strongAliases,
  }) as { exercises: Exercise[]; workouts: Workout[]; aliases: Record<string, string>;
    noteUpdates: { id: string; notes?: string; entries: [number, string][] }[];
    stats: { workouts: number; notesAdded: number; duplicates: number; omitted: { sets: number; workouts: number; exercises: string[] } } };
  const exercises = new Map(state.exercises);
  for (const e of r.exercises) exercises.set(e.id, e);
  // notes for workouts that are already here (older imports that dropped them)
  const updated = new Map<string, Workout>();
  for (const u of r.noteUpdates) {
    const w = state.workouts.find((x) => x.id === u.id);
    if (!w) continue;
    const copy: Workout = JSON.parse(JSON.stringify(w));
    if (u.notes && !copy.notes) copy.notes = u.notes;
    for (const [i, note] of u.entries) if (copy.exercises[i] && !copy.exercises[i].notes) copy.exercises[i].notes = note;
    updated.set(copy.id, copy);
  }
  const workouts = [...state.workouts.map((w) => updated.get(w.id) || w), ...r.workouts].sort(byNewest);
  await save([
    ...r.exercises.map((e) => docOp('exercises', e)), ...[...r.workouts, ...updated.values()].map((w) => docOp('workouts', w)), kvOp('strongAliases', r.aliases),
  ], { mode: 'after', publish: () => setState({ exercises, workouts, strongAliases: r.aliases }) });
  return r.stats;
}

// ---------- exercises ----------
/** An exercise, its grouped sibling and the registry change, saved before screens see them. */
function familyOps(exercises: Exercise[], customFamilies: Record<string, string>, removed: string[] = [],
  related: { workouts?: Workout[]; templates?: Template[]; active?: ActiveWorkout } = {}): Op[] {
  return [
    ...exercises.map((e) => docOp('exercises', e)),
    ...(related.workouts || []).map((w) => docOp('workouts', w)),
    ...(related.templates || []).map((t) => docOp('templates', t)),
    ...removed.map((id) => delOp('exercises', id)),
    kvOp('customFamilies', customFamilies),
    ...(related.active ? [kvOp('active', related.active)] : []),
  ];
}

// Exercise writes publish state after storage succeeds. Queue them so a second
// fire-and-forget patch derives from the first save, including sibling changes.
let exerciseWrite: Promise<void> = Promise.resolve();
function mutateExercises<T>(operation: () => Promise<T>): Promise<T> {
  const result = exerciseWrite.then(operation);
  exerciseWrite = result.then(() => {}, () => {});
  return result;
}

/** Save the exercise and any sibling assignment together, before notifying screens. */
async function saveExerciseFamily(ex: Exercise, selection?: string | null): Promise<Exercise> {
  const result = changeExerciseFamily(ex, selection, state.exercises, state.customFamilies) as {
    exercises: Exercise[]; customFamilies: Record<string, string>;
  };
  const changed = result.exercises.filter((e) => state.exercises.get(e.id) !== e);
  const exercises = new Map(result.exercises.map((e) => [e.id, e]));
  await save(familyOps(changed, result.customFamilies), { mode: 'after', publish: () => setState({ exercises, customFamilies: result.customFamilies }) });
  return exercises.get(ex.id)!;
}

/** Change an exercise; a field set to undefined is removed (an override back at its default, #54). */
export async function updateExercise(id: string, patch: Partial<Exercise>, familySelection?: string | null) {
  return mutateExercises(async () => {
    const ex = state.exercises.get(id);
    if (!ex) return;
    const next: Exercise = { ...ex, ...patch };
    for (const k of Object.keys(patch) as (keyof Exercise)[]) if (patch[k] === undefined) delete next[k];
    await saveExerciseFamily(next, familySelection);
  });
}

export const findExercise = (name: string): Exercise | null => findExerciseByName(state.exercises, name) as Exercise | null;

/** Create a custom exercise. Family choices stay in the form until this save. */
export async function addExercise(o: { name: string; category: Exercise['category']; bodyPart: string; notes?: string; family?: string | null; unilateral?: boolean }, familySelection?: string | null): Promise<Exercise> {
  return mutateExercises(async () => {
    const ex = newExerciseRecord(o, { hasId: (id: string) => state.exercises.has(id) }) as Exercise;
    if (o.family !== undefined) ex.family = o.family;
    return saveExerciseFamily(ex, familySelection);
  });
}

/** Where an exercise is used: workouts, templates, the running workout. */
export function exerciseUsage(id: string) {
  return {
    sessions: allSessions().get(id)?.length || 0,
    templates: state.templates.filter((t) => t.exercises.some((e) => e.exerciseId === id)).length,
    inActive: !!state.active?.exercises.some((e) => e.exerciseId === id),
  };
}

/** Delete an exercise nobody has logged; it leaves the templates too. */
export async function deleteExercise(id: string) {
  return mutateExercises(async () => {
    const exercises = new Map(state.exercises);
    exercises.delete(id);
    const changed: Template[] = [];
    const templates = state.templates.map((t) => {
      if (!t.exercises.some((e) => e.exerciseId === id)) return t;
      // a superset left with one exercise dissolves (#39)
      const next = { ...t, exercises: withoutExercise(t.exercises, id) as Template['exercises'] };
      changed.push(next);
      return next;
    });
    const customFamilies = cleanCustomFamilies(state.customFamilies, exercises);
    // its remembered chart goes with it (#27)
    const chartMetrics = cleanChartMetrics(state.chartMetrics, exercises) as Record<string, string>;
    const chartOps = id in state.chartMetrics ? [kvOp('chartMetrics', chartMetrics)] : [];
    await save([...familyOps([], customFamilies, [id], { templates: changed }), ...chartOps], { mode: 'after', publish: () => setState({ exercises, templates, customFamilies, chartMetrics }) });
  });
}

/**
 * Merge one exercise into another: its workouts, templates and the running
 * workout (and an open editor) move to the target, then it is deleted. The
 * target keeps its own rest timer and notes; ones it lacks come from the
 * source. The caller checks canMergeExercises first.
 */
export async function mergeExercise(fromId: string, intoId: string) {
  return mutateExercises(async () => {
    const from = state.exercises.get(fromId);
    const into = state.exercises.get(intoId);
    if (!from || !into || fromId === intoId) return;
    const target = { ...into, ...mergeExercisePatch(from, into) } as Exercise;
    const exercises = new Map(state.exercises);
    exercises.delete(fromId);
    exercises.set(intoId, target);
    const movedWorkouts = moveExerciseEntries(state.workouts, fromId, intoId) as Workout[];
    const movedTemplates = moveExerciseEntries(state.templates, fromId, intoId) as Template[];
    const swap = <T extends { id: string }>(list: T[], changed: T[]) => {
      if (!changed.length) return list;
      const byId = new Map(changed.map((x) => [x.id, x]));
      return list.map((x) => byId.get(x.id) || x);
    };
    const customFamilies = cleanCustomFamilies(state.customFamilies, exercises);
    // the merged exercise's chart goes; the target keeps its own (#27)
    const chartMetrics = cleanChartMetrics(state.chartMetrics, exercises) as Record<string, string>;
    const chartOps = fromId in state.chartMetrics ? [kvOp('chartMetrics', chartMetrics)] : [];
    const patch: Partial<State> = { exercises, customFamilies, chartMetrics, workouts: swap(state.workouts, movedWorkouts), templates: swap(state.templates, movedTemplates) };
    const [active] = state.active ? moveExerciseEntries([state.active], fromId, intoId) as ActiveWorkout[] : [];
    if (active) patch.active = active;
    const [edit] = state.edit ? moveExerciseEntries([state.edit], fromId, intoId) as EditDraft[] : [];
    if (edit) patch.edit = edit;
    if (state.edit?.exPatches?.[fromId]) {
      const d = (patch.edit || state.edit) as EditDraft;
      const { [fromId]: _drop, ...rest } = d.exPatches || {};
      patch.edit = { ...d, exPatches: rest } as EditDraft;
    }
    // A delayed draft write must not put the old source id back after this transaction.
    if (active && activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
    try {
      await save([...familyOps([target], customFamilies, [fromId], { workouts: movedWorkouts, templates: movedTemplates, active }), ...chartOps], { mode: 'after', publish: () => setState(patch) });
    } catch (error) {
      if (active) persistActive(true);
      throw error;
    }
  });
}

// ---------- workouts ----------
/** Save a finished workout, and its routine with it when Edit workout changed the routine's pinned note (one transaction, #33). */
export async function saveWorkout(w: Workout, routine: Template | null = null) {
  setState({
    workouts: [...state.workouts.filter((x) => x.id !== w.id), w].sort(byNewest),
    ...(routine ? { templates: state.templates.map((x) => (x.id === routine.id ? routine : x)) } : {}),
  });
  await save([docOp('workouts', w), ...(routine ? [docOp('templates', routine)] : [])]);
}

/** Set or remove a routine's pinned note for next time (#33); a running workout from it shows the new one at once. */
export async function setPinnedNote(templateId: string, note: string) {
  const t = state.templates.find((x) => x.id === templateId);
  if (!t) return;
  const next = withPinnedNote(t, note) as Template;
  setState({ templates: state.templates.map((x) => (x.id === templateId ? next : x)) });
  await save([docOp('templates', next)]);
}

/** Delete a finished workout. Returns it, for undo. */
export async function deleteWorkout(id: string): Promise<Workout | null> {
  const w = state.workouts.find((x) => x.id === id) || null;
  if (!w) return null;
  setState({ workouts: state.workouts.filter((x) => x.id !== id) });
  await save([delOp('workouts', id)]);
  return w;
}

// ---------- measurements ----------
export async function addMeasurement(m: { type: string; value: number; at?: number; id?: string }): Promise<Measurement> {
  const rec: Measurement = { id: m.id || uid(), type: m.type, value: m.value, at: m.at || Date.now() };
  setState({ measurements: [...state.measurements, rec].sort(byNewest) });
  await save([docOp('measurements', rec)]);
  return rec;
}

export async function deleteMeasurement(id: string): Promise<Measurement | null> {
  const m = state.measurements.find((x) => x.id === id) || null;
  if (!m) return null;
  setState({ measurements: state.measurements.filter((x) => x.id !== id) });
  await save([delOp('measurements', id)]);
  return m;
}

// ---------- templates ----------
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export async function saveTemplate(t: Template) {
  const next = { ...t, updatedAt: Date.now() };
  setState({ templates: state.templates.some((x) => x.id === t.id) ? state.templates.map((x) => (x.id === t.id ? next : x)) : [...state.templates, next] });
  await save([docOp('templates', next)]);
}

/** Change a template's own fields (name, folder, archived). */
export async function patchTemplate(id: string, patch: Partial<Template>) {
  const t = state.templates.find((x) => x.id === id);
  if (!t) return;
  const next: Template = { ...t, ...patch };
  if (patch.archived === false) delete next.archived;
  await saveTemplate(next);
}

/** Delete a template. Returns it, for undo. */
export async function deleteTemplate(id: string): Promise<Template | null> {
  const t = state.templates.find((x) => x.id === id) || null;
  if (!t) return null;
  setState({ templates: state.templates.filter((x) => x.id !== id) });
  await save([delOp('templates', id)]);
  return t;
}

/** A new template copied from another (Duplicate, Add to my templates). */
export async function copyTemplate(src: Template, patch: Partial<Template> = {}): Promise<Template> {
  const t = copyTemplateRecord(src, { patch, hasExercise: (id: string) => state.exercises.has(id) }) as Template;
  await saveTemplate(t);
  return t;
}

/** Folder names in use, plus empty ones made with "New folder". */
export const templateFolders = (s: State = state): string[] => folderNames(s.templates, s.meta.folders);

export async function addFolder(name: string): Promise<boolean> {
  const n = name.trim();
  if (!n || templateFolders().includes(n)) return false;
  await setMeta({ folders: [...(state.meta.folders || []), n] });
  return true;
}

export async function renameFolder(from: string, to: string) {
  const n = to.trim();
  if (!n || n === from) return;
  const changed: Template[] = [];
  const templates = state.templates.map((t) => ((t.folder || '') === from ? (changed.push({ ...t, folder: n }), changed[changed.length - 1]) : t));
  const folders = [...new Set((state.meta.folders || []).map((f) => (f === from ? n : f)))];
  const meta = { ...state.meta, folders };
  setState({ templates, meta });
  await save([...changed.map((t) => docOp('templates', t)), kvOp('meta', meta)], { merge: { meta: { folders } } });
}

/** Remove a folder; its templates move out of it (nothing is deleted). */
export async function removeFolder(name: string) {
  const changed: Template[] = [];
  const templates = state.templates.map((t) => ((t.folder || '') === name ? (changed.push({ ...t, folder: '' }), changed[changed.length - 1]) : t));
  const folders = (state.meta.folders || []).filter((f) => f !== name);
  const meta = { ...state.meta, folders };
  setState({ templates, meta });
  await save([...changed.map((t) => docOp('templates', t)), kvOp('meta', meta)], { merge: { meta: { folders } } });
}

export async function restoreTemplateExercises(templateId: string, exercises: TemplateEntry[]) {
  const t = state.templates.find((x) => x.id === templateId);
  if (t) await saveTemplate({ ...t, exercises });
}

// ---------- the running workout ----------
// Kept in state.active and written to storage a moment after each change (and
// at once when the app goes to the background), so it survives the app being
// closed. The logic is the core's (core/workout.js).
let activeTimer: ReturnType<typeof setTimeout> | null = null;
/** Finish is saving: the running workout's own saves wait (Finish's batch clears it, or saves it again if it fails). */
let finishing = false;
function persistActive(now = false) {
  if (activeTimer) clearTimeout(activeTimer);
  activeTimer = null;
  const write = () => { activeTimer = null; if (!finishing) save([kvOp('active', state.active)]); };
  if (now) write(); else activeTimer = setTimeout(write, 250);
}
export function flushActive() { if (activeTimer) persistActive(true); }

export const getDraft = (key: DraftKey, s: State = state): AnyDraft | null => (key === 'active' ? s.active : s.edit);

/**
 * Change a draft: the running workout ('active') or the one being edited
 * ('edit'). `fn` gets a copy to change in place (the core's functions work
 * that way). With `entryId` only that exercise is copied, so the other
 * exercises keep their identity and don't re-render.
 */
export function editDraft<D extends AnyDraft>(key: DraftKey, fn: (d: D, entry: EntryDraft) => void, entryId?: string) {
  const cur = getDraft(key) as D | null;
  if (!cur) return;
  let d: D;
  let entry: EntryDraft | undefined;
  if (entryId) {
    const i = cur.exercises.findIndex((e) => e.id === entryId);
    if (i < 0) return;
    entry = clone(cur.exercises[i]);
    const exercises = cur.exercises.slice();
    exercises[i] = entry;
    d = { ...cur, exercises };
  } else {
    d = clone(cur);
  }
  fn(d, entry as EntryDraft);
  if (key === 'active') {
    (d as ActiveWorkout).updatedAt = Date.now();
    setState({ active: d as ActiveWorkout });
    persistActive();
  } else {
    (d as EditDraft).dirty = true;
    setState({ edit: d as EditDraft });
  }
}

/** Change the running workout (see editDraft). */
export const editActive = (fn: (a: ActiveWorkout, entry: EntryDraft) => void, entryId?: string) => editDraft<ActiveWorkout>('active', fn, entryId);

/** Change top-level fields of a draft (name, notes, rest…) without touching the exercises. */
export function patchDraft(key: DraftKey, patch: Partial<ActiveWorkout> | Partial<TemplateDraft> | Partial<WorkoutEditDraft>) {
  const cur = getDraft(key);
  if (!cur) return;
  if (key === 'active') {
    setState({ active: { ...(cur as ActiveWorkout), ...(patch as Partial<ActiveWorkout>), updatedAt: Date.now() } });
    persistActive();
  } else {
    setState({ edit: { ...(cur as EditDraft), ...(patch as Partial<EditDraft>), dirty: true } as EditDraft });
  }
}

/** Change top-level fields of the running workout. */
export const patchActive = (patch: Partial<ActiveWorkout>) => patchDraft('active', patch);

// ---------- editing templates and finished workouts ----------
/** Start editing (the screen calls this once with core's templateDraft / workoutEditDraft). */
export function openEdit(d: EditDraft) {
  editBase = { key: draftKey(d), seen: external.get(draftKey(d)) || 0 };
  setState({ edit: { ...d, dirty: false } });
}
/** The record an editor edits, and how often another tab's change to it was taken in when it opened. */
let editBase: { key: string; seen: number } | null = null;
const draftKey = (d: EditDraft) => `${d.kind === 'template' ? 'templates' : 'workouts'}/${d.id}`;
/** Saving an editor: if another tab changed its record since it opened, the save is held for the person to decide. */
function checkEditBase(d: EditDraft) {
  const key = draftKey(d);
  if (editBase?.key === key && (external.get(key) || 0) !== editBase.seen) staleKeys.add(key);
}
/** After a conflict is settled, an open editor saves over the version saved now. */
function rebaseEdit() {
  if (editBase) editBase = { ...editBase, seen: external.get(editBase.key) || 0 };
}
/** Stop editing (only if `id` is still the draft being edited). */
export function closeEdit(id?: string) { if (state.edit && (!id || state.edit.id === id)) setState({ edit: null }); }

/** The exercise as a draft sees it, with changes waiting for Save. */
export const exerciseFor = (key: DraftKey, id: string, s: State = state) => exerciseInDraft(s.exercises, getDraft(key, s), id) as Exercise | undefined;

/** Change an exercise from an editor: at once in the running workout, at Save elsewhere. */
export function changeExercise(key: DraftKey, id: string, patch: Partial<Exercise>) {
  if (key === 'active') { updateExercise(id, patch); return; }
  editDraft<EditDraft>('edit', (d) => { patchDraftExercise(d, id, patch); });
}

async function applyExercisePatches(d: EditDraft) {
  for (const [id, patch] of Object.entries(d.exPatches || {})) if (state.exercises.has(id)) await updateExercise(id, patch);
}

/** Save the template editor. Returns { problem } (an English text) or { template }. */
export async function saveTemplateDraft(): Promise<{ problem?: string; template?: Template; created?: boolean }> {
  const d = state.edit;
  if (!d || d.kind !== 'template') return { problem: 'Nothing to save' };
  const existing = state.templates.find((t) => t.id === d.id) || null;
  const r = templateFromDraft(d, { settings: state.settings, exercises: state.exercises, existing }) as { problem?: string; template?: Template };
  if (r.problem || !r.template) return { problem: r.problem };
  checkEditBase(d);
  await saveTemplate(r.template);
  await applyExercisePatches(d);
  setState({ edit: { ...d, dirty: false } });
  return { template: r.template, created: !existing };
}

/** Save "Edit workout". Returns { problem } or { workout }. */
export async function saveWorkoutEdit(defaultName: string): Promise<{ problem?: string; workout?: Workout }> {
  const d = state.edit;
  if (!d || d.kind !== 'edit') return { problem: 'Nothing to save' };
  const r = workoutFromEditDraft(d, { settings: state.settings, exercises: state.exercises, defaultName }) as { problem?: string; workout?: Workout };
  if (r.problem || !r.workout) return { problem: r.problem };
  checkEditBase(d);
  // the routine's pinned note, edited here, is saved with the workout (#33)
  const routine = d.templateId ? state.templates.find((x) => x.id === d.templateId) : null;
  const pinned = routine && d.pinnedNote !== undefined && (d.pinnedNote.trim() || undefined) !== routine.pinnedNote
    ? withPinnedNote(routine, d.pinnedNote) as Template : null;
  await saveWorkout(r.workout, pinned);
  await applyExercisePatches(d);
  setState({ edit: { ...d, dirty: false } });
  return { workout: r.workout };
}

export function startWorkout(from: { template?: Template | null; fromWorkout?: Workout | null }, defaultName: string) {
  const active = newActiveWorkout({
    template: from.template || null, fromWorkout: from.fromWorkout || null, hasExercise: (id: string) => state.exercises.has(id),
    settings: state.settings, now: Date.now(), name: defaultName,
  }) as ActiveWorkout;
  setState({ active });
  persistActive(true);
  return active;
}

export function discardActive() {
  setState({ active: null });
  persistActive(true);
}

/** Sets from the latest earlier session of an exercise ("Previous"); the same template first if that's the setting. */
export function previousSets(exerciseId: string, opts: { templateId?: string | null; before?: number; excludeWorkoutId?: string | null } = {}): WorkSet[] | null {
  return previousSetsFrom(stats().byExercise.get(exerciseId), {
    before: opts.before ?? Infinity, excludeWorkoutId: opts.excludeWorkoutId ?? null,
    templateId: state.settings.prevSource === 'template' ? opts.templateId ?? null : null,
  });
}

export interface Record_ { exerciseId: string; metric: string; value: number; setId: string }
export interface FinishResult { workout: Workout; prs: Record_[]; volume: number; number: number }
const finished = new Map<string, FinishResult>();
/** The summary of a workout finished in this session. */
export const finishResult = (id: string) => finished.get(id) || null;

/**
 * Save the running workout. `mode` 'done' keeps checked sets only, 'all' also
 * unchecked sets that are valid as typed. `defaultName` replaces an empty name.
 */
export async function finishActive(mode: 'done' | 'all', defaultName: string): Promise<FinishResult | null> {
  const a = state.active;
  if (!a) return null;
  const now = Date.now();
  const workout = finishWorkout(a, { settings: state.settings, exercises: state.exercises, now, mode, defaultName }) as Workout;
  const prs = prsForNewWorkout(workout, stats(), state.exercises, state.settings.formula) as Record_[];
  const t = workout.templateId ? state.templates.find((x) => x.id === workout.templateId) : null;
  const usedTemplate = t ? { ...t, lastUsedAt: now } : null;
  // one transaction: the workout, its routine's last use and the cleared running workout,
  // on screen only once saved. A failed save leaves the running workout as it was.
  if (activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
  finishing = true;
  try {
    await save([docOp('workouts', workout), kvOp('active', null), ...(usedTemplate ? [docOp('templates', usedTemplate)] : [])], {
      mode: 'after',
      publish: () => {
        const templates = usedTemplate ? state.templates.map((x) => (x.id === usedTemplate.id ? usedTemplate : x)) : state.templates;
        setState({ workouts: [...state.workouts.filter((w) => w.id !== workout.id), workout].sort(byNewest), templates, active: null });
      },
    });
  } catch (e) {
    finishing = false;
    // saved again as it is (or held, if another tab changed it), so it can't be lost
    persistActive(true);
    throw e;
  } finally {
    finishing = false;
  }
  const workouts = state.workouts;
  // its place in the history by start time (the start can have been moved earlier)
  const number = workouts.filter((w) => w.startedAt <= workout.startedAt).length;
  const result = { workout, prs, volume: workoutVolume(workout, state.exercises) as number, number };
  finished.set(workout.id, result);
  return result;
}

// ---------- rest timer ----------
/** Start the rest timer; `after` is the set it follows. */
export function startRest(sec: number, label = '', after?: { entryId: string; setId: string }) {
  if (!state.active || !(sec > 0)) return;
  const now = Date.now();
  patchActive({ rest: { start: now, end: now + sec * 1000, total: sec, label, ...after } });
}
export function adjustRest(deltaSec: number) {
  const r = state.active?.rest;
  if (!r) return;
  const end = r.end + deltaSec * 1000;
  if (end <= Date.now()) { skipRest(); return; }
  patchActive({ rest: { ...r, end, total: Math.max(1, r.total + deltaSec) } });
}
export function skipRest() {
  if (state.active?.rest) patchActive({ rest: null });
}
