// Backup files: everything in the app as one JSON file, and reading it back.
import { withSeedExercises } from './seed-sync.js';
import { cleanCustomFamilies } from './exercise-families.js';
import { cleanChartMetrics } from './calc.js';
import { sameRecord } from './pending-writes.js';

// The file says app 'setlog' on purpose: Increment reads and writes the same
// backups as the Setlog web app it grew out of, so data moves between them.
/**
 * A backup file's text. `data` = { exercises, workouts, templates, measurements, kv }:
 * what the app shows, including changes storage hasn't saved yet. `recovery`
 * carries what isn't part of the saved data: `active`, the running workout. It
 * sits beside `data`, so Setlog and older versions read the file as before.
 * @param {object} data
 * @param {string} appVersion
 * @param {Date} [now]
 * @param {{ active?: object | null } | null} [recovery]
 */
export function makeBackup(data, appVersion, now = new Date(), recovery = null) {
  const file = { app: 'setlog', schema: 1, appVersion, exportedAt: now.toISOString(), data };
  if (recovery?.active) file.recovery = { active: recovery.active };
  return JSON.stringify(file);
}

/** A running workout as backups and storage keep it. */
const isRunningWorkout = (a) => !!a && typeof a === 'object' && typeof a.id === 'string' && Array.isArray(a.exercises) && Number.isFinite(a.startedAt);

/**
 * Restoring a backup with a running workout (`recovery.active`): 'restore' it
 * when the app has none, 'keep' the app's when there is nothing new, 'ask'
 * which to keep when they differ.
 */
export function runningWorkoutChoice(current, fromBackup) {
  if (!fromBackup) return 'keep';
  if (!current) return 'restore';
  return sameRecord(current, fromBackup) ? 'keep' : 'ask';
}

/** An error with an English message (a translation key) and its {placeholders}. */
function fail(message, vars) {
  const e = new Error(message);
  if (vars) e.vars = vars;
  return e;
}

/** Read a backup file. The built-in `seedExercises` are added back if the backup predates them. */
export function parseBackup(text, seedExercises = []) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { throw fail('This file isn’t valid JSON.'); }
  if (!obj || obj.app !== 'setlog' || !obj.data) throw fail('This isn’t a Setlog backup file.');
  const d = obj.data;
  for (const k of ['exercises', 'workouts', 'templates', 'measurements']) {
    if (d[k] !== undefined && !Array.isArray(d[k])) throw fail('The backup is damaged ({part}).', { part: k });
  }
  // the backup itself counts as a backup: without this the reminder would come
  // back early after a restore (the file holds the time of the backup before it)
  const kv = { ...(d.kv || {}) };
  // a running workout in kv is never restored: the apps keep theirs in
  // `recovery` (below), but a file from elsewhere may carry one here, and it
  // would come back as a workout "in progress" the next time the app starts
  delete kv.active;
  const madeAt = Date.parse(obj.exportedAt || '');
  if (Number.isFinite(madeAt)) kv.meta = { ...(kv.meta || {}), lastBackupAt: Math.max(kv.meta?.lastBackupAt || 0, madeAt) };
  // keep the built-in library even if the backup predates it
  const exercises = withSeedExercises(d.exercises || [], seedExercises);
  kv.customFamilies = cleanCustomFamilies(kv.customFamilies, exercises);
  // the chart each exercise page shows (#27); older backups have none
  if (kv.chartMetrics !== undefined) kv.chartMetrics = cleanChartMetrics(kv.chartMetrics, exercises);
  // the running workout of a recovery backup comes back only when asked for (runningWorkoutChoice)
  const recovered = obj.recovery?.active;
  if (recovered !== undefined && recovered !== null && !isRunningWorkout(recovered)) throw fail('The backup is damaged ({part}).', { part: 'recovery' });
  return {
    exportedAt: obj.exportedAt,
    recovery: recovered ? { active: recovered } : null,
    data: {
      exercises,
      workouts: d.workouts || [],
      templates: d.templates || [],
      measurements: d.measurements || [],
      kv,
    },
  };
}

