// Removing an exercise from a superset (#39): a group left with one exercise
// dissolves at once (its partner loses "Superset A"), one left with two stays,
// and Undo brings the exercise back in its place and group. Deleting an
// exercise from the library leaves no one-exercise superset in a routine.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, waitStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-superset-remove');
const CURL = 'x-bicep-curl-dumbbell', PUSHDOWN = 'x-triceps-pushdown-cable';
const ROW = 'x-bent-over-row-barbell', PULLUP = 'x-pull-up', LAT = 'x-lat-pulldown-cable';
const MINE = { id: 'c-my-curl', name: 'My Curl', category: 'dumbbell', bodyPart: 'arms', custom: true };
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const now = Date.now();
const entry = (id, exerciseId, supersetId) => ({ id, exerciseId, notes: '', showNotes: false, supersetId, restSec: 0,
  sets: [{ id: `${id}1`, type: 'normal', w: '20', r: '10', d: '', t: '', rpe: '', done: false }] });
const data = {
  exercises: [...SEED_EXERCISES, MINE], workouts: [], measurements: [],
  templates: [{ id: 'arms', name: 'Arms', exercises: [
    { exerciseId: MINE.id, supersetId: 's', sets: [{ type: 'normal', w: 12, r: 10 }] },
    { exerciseId: PUSHDOWN, supersetId: 's', sets: [{ type: 'normal', w: 30, r: 12 }] },
    { exerciseId: ROW, sets: [{ type: 'normal', w: 60, r: 8 }] },
  ] }],
  kv: {
    settings: { language: 'en', showExamples: false, appKeepAwake: false },
    meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now },
    active: { id: 'live', kind: 'workout', name: 'Pull', notes: '', startedAt: now - 600000, templateId: null, templateNotes: '', rest: null, updatedAt: now,
      exercises: [entry('a', CURL, 'g1'), entry('b', PUSHDOWN, 'g1'), entry('c', ROW, 'g2'), entry('d', PULLUP, 'g2'), entry('e', LAT, 'g2')] },
  },
};

const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US' });
await ctx.addInitScript(grantWakeLock);
await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const id = (t) => page.getByTestId(t);
const label = (ex) => id(`block-${ex}`).getByText(/^Superset [A-Z]$/).allInnerTexts();
const groups = async () => (await storedData(page)).kv.active.exercises.map((e) => `${e.exerciseId.slice(2)}:${e.supersetId ? 'S' : '-'}`).join(' ');
const remove = async (ex) => {
  await id(`ex-menu-${ex}`).click();
  await id('menu-remove').click();
  await id('toast-action').waitFor();
};

await page.goto(APP);
await id('resume-workout').click();
await id(`block-${CURL}`).waitFor();
assert.deepEqual(await label(PUSHDOWN), ['Superset A']);

// two members: the partner stands alone at once
await remove(CURL);
await id(`block-${CURL}`).waitFor({ state: 'detached' });
assert.deepEqual(await label(PUSHDOWN), [], 'no "Superset A" on its own');
await waitStored(page, (d) => !d.kv.active.exercises[0].supersetId);
assert.equal(await groups(), 'triceps-pushdown-cable:- bent-over-row-barbell:S pull-up:S lat-pulldown-cable:S');
await page.screenshot({ path: `${OUT}/partner-alone.png` });
// Undo: back in its place and its superset
await id('toast-action').click();
await id(`block-${CURL}`).waitFor();
assert.deepEqual(await label(CURL), ['Superset A']);
assert.deepEqual(await label(PUSHDOWN), ['Superset A']);
await waitStored(page, (d) => d.kv.active.exercises.length === 5);
assert.equal(await groups(), 'bicep-curl-dumbbell:S triceps-pushdown-cable:S bent-over-row-barbell:S pull-up:S lat-pulldown-cable:S');
ok('removing one of two in a superset leaves its partner on its own at once; Undo puts both back');

// three members: the other two stay a superset (still B after A)
await id(`jump-${ROW}`).click();
await id(`block-${PULLUP}`).waitFor();
await remove(PULLUP);
await id(`block-${PULLUP}`).waitFor({ state: 'detached' });
assert.deepEqual([await label(ROW), await label(LAT)], [['Superset B'], ['Superset B']]);
await id('toast-action').click();
await id(`block-${PULLUP}`).waitFor();
await waitStored(page, (d) => d.kv.active.exercises.length === 5);
const back = (await storedData(page)).kv.active.exercises;
assert.deepEqual(back.map((e) => e.id), ['a', 'b', 'c', 'd', 'e'], 'the same order');
assert.equal(new Set(back.slice(2).map((e) => e.supersetId)).size, 1);
ok('removing one of three keeps the other two together; Undo restores the order');

// the library: deleting My Curl leaves Arms without a one-exercise superset
await page.goto(`${APP}/exercise/${MINE.id}`);
await id('exercise-options').click();
await id('ex-delete').click();
await id('confirm-delete').click();
await waitStored(page, (d) => !d.exercises.some((e) => e.id === MINE.id));
const arms = (await storedData(page)).templates.find((t) => t.id === 'arms');
assert.deepEqual(arms.exercises.map((e) => [e.exerciseId, e.supersetId ?? null]), [[PUSHDOWN, null], [ROW, null]]);
ok('deleting an exercise from the library dissolves the superset it leaves alone in a routine');

assert.deepEqual(errors, []);
await browser.close();
console.log(`\n${passed} checks passed`);
