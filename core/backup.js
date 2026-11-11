// Backup files: everything in the app as one JSON file, and reading it back.
import { withSeedExercises } from './seed-sync.js';
import { cleanCustomFamilies } from './exercise-families.js';

// The file says app 'setlog' on purpose: Increment reads and writes the same
// backups as the Setlog web app it grew out of, so data moves between them.
/** A backup file's text. `data` = { exercises, workouts, templates, measurements, kv }. */
export function makeBackup(data, appVersion, now = new Date()) {
  return JSON.stringify({
    app: 'setlog', schema: 1, appVersion, exportedAt: now.toISOString(), data,
  });
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
  // a running workout is never restored: the one in the app keeps going. The
  // apps' own backups don't carry one, but a file from elsewhere may, and it
  // would come back as a workout "in progress" the next time the app starts
  delete kv.active;
  const madeAt = Date.parse(obj.exportedAt || '');
  if (Number.isFinite(madeAt)) kv.meta = { ...(kv.meta || {}), lastBackupAt: Math.max(kv.meta?.lastBackupAt || 0, madeAt) };
  // keep the built-in library even if the backup predates it
  const exercises = withSeedExercises(d.exercises || [], seedExercises);
  kv.customFamilies = cleanCustomFamilies(kv.customFamilies, exercises);
  return {
    exportedAt: obj.exportedAt,
    data: {
      exercises,
      workouts: d.workouts || [],
      templates: d.templates || [],
      measurements: d.measurements || [],
      kv,
    },
  };
}

