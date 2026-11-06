// Builds the backup the app suites restore, from the core in plain Node: the
// sample Strong export (86 workouts) over the built-in library, a "Pull"
// routine in an "Upper / Lower" folder, two body weights, Intense Red, German
// and the name "Laurin". It's the same file the old Setlog web app made, so the
// suites also prove that a backup from Setlog restores in Increment.
// Writes tests/browser/data/setlog-backup.json. run.mjs calls it before the suites.
import fs from 'node:fs';
import path from 'node:path';
import * as core from '../../core/index.js';
import { BACKUP, STRONG, ROOT } from './env.mjs';

const exercises = new Map(core.SEED_EXERCISES.map((e) => [e.id, { ...e }]));
const preview = core.parseStrongCSV(fs.readFileSync(STRONG, 'utf8'), {
  weightUnit: 'kg', distUnit: 'km',
  exercises,
  workouts: [],
  defaultName: 'Workout',
});
// Explicit fixture decisions retain the legacy Setlog backup's custom names.
// Production never creates these from guesses; its review requires a choice.
const decisions = Object.fromEntries(preview.review.map((row) => [row.name, {
  kind: 'new', name: row.name, category: row.category, bodyPart: row.bodyPart || 'other',
}]));
const r = core.resolveStrongImport(preview, decisions, { exercises });

for (const e of r.exercises) exercises.set(e.id, e);
const workouts = [...r.workouts].sort((a, b) => b.startedAt - a.startedAt);

const id = (name) => core.findExerciseByName(exercises, name).id;
const pull = core.copyTemplateRecord({
  name: 'Pull', folder: 'Upper / Lower', notes: 'Last set to failure', exercises: [
    { exerciseId: id('Lat Pulldown (Cable)'), restSec: 120, sets: [{ type: 'warmup', w: 40, r: 10 }, { w: 60, r: 10 }, { w: 60, r: 9 }] },
    { exerciseId: id('Seated Row (Cable)'), sets: [{ w: 55, r: 12 }, { w: 55, r: 12 }] },
    { exerciseId: id('Pull Up'), sets: [{ r: 8 }, { r: 8 }] },
  ],
}, { hasExercise: (x) => exercises.has(x) });

const day = 86400000;
const measurements = [
  { id: core.uid(), type: 'bodyweight', value: 82.4, at: Date.now() - 2 * day },
  { id: core.uid(), type: 'bodyweight', value: 83.6, at: Date.now() - 40 * day },
];
let settings = { ...core.DEFAULT_SETTINGS };
settings = core.changeSetting(settings, 'theme', 'intense-red');
settings = core.changeSetting(settings, 'language', 'de');

const appVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/app.json'), 'utf8')).expo.version;
const text = core.makeBackup({
  exercises: [...exercises.values()],
  workouts,
  templates: [pull],
  measurements,
  kv: { settings, profile: { name: 'Laurin' }, meta: { seedVersion: core.SEED_VERSION, createdAt: Date.now() } },
}, appVersion);
fs.writeFileSync(BACKUP, text);
console.log('backup with', workouts.length, 'workouts,', (text.length / 1024).toFixed(0), 'KB');
