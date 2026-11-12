// Exercise charts (#27): a loaded exercise opens on Heaviest weight, a
// bodyweight one on Most reps; the chart chosen in the Chart menu is
// remembered per exercise across visits and reloads, travels in a backup and
// comes back on restore; deleting the exercise drops it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, storedData, waitStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const BENCH = 'x-bench-press-barbell', PULLUP = 'x-pull-up';
const MINE = { id: 'c-floor-press', name: 'Floor Press', category: 'barbell', bodyPart: 'chest', custom: true };
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const day = 86400000, now = Date.now();
const session = (i, exerciseId, w, r) => ({ id: `w${i}`, name: 'Push', startedAt: now - (10 - i) * day, endedAt: now - (10 - i) * day + 3600000, templateId: null,
  exercises: [{ id: `e${i}`, exerciseId, sets: [{ id: `s${i}`, type: 'normal', ...(w ? { w } : {}), r }] }] });
const data = {
  exercises: [...SEED_EXERCISES, MINE], templates: [], measurements: [],
  workouts: [session(1, BENCH, 80, 5), session(2, BENCH, 82.5, 5), session(3, PULLUP, null, 8)],
  kv: { settings: { language: 'en', showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now },
    // chosen earlier for an exercise that is never logged (so it can be deleted)
    chartMetrics: { [MINE.id]: 'volume' } },
};

async function open(seed) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US', acceptDownloads: true });
  await ctx.addInitScript(grantWakeLock);
  if (seed) await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return { ctx, page, errors, id: (t) => page.getByTestId(t) };
}
/** The chart's name in the hero's label ("Heaviest weight, last session"). */
const metric = async (id) => { await id('exercise-metric').waitFor(); return (await id('exercise-metric').innerText()).split(',')[0].trim(); };

const a = await open(data);
await a.page.goto(`${APP}/exercise/${BENCH}`);
assert.equal(await metric(a.id), 'Heaviest weight');
await a.page.goto(`${APP}/exercise/${PULLUP}`);
assert.equal(await metric(a.id), 'Most reps (set)');
ok('Bench Press opens on Heaviest weight, Pull Up on Most reps');

// choose Est. 1RM for Bench Press: it stays across another exercise, a revisit and a reload
await a.page.goto(`${APP}/exercise/${BENCH}`);
await a.id('exercise-metric').click();
await a.id('metric-e1rm').click();
assert.equal(await metric(a.id), 'Estimated 1RM');
await waitStored(a.page, (d) => d.kv.chartMetrics?.['x-bench-press-barbell'] === 'e1rm');
await a.page.goto(`${APP}/exercise/${PULLUP}`);
assert.equal(await metric(a.id), 'Most reps (set)');
await a.page.goto(`${APP}/exercise/${BENCH}`);
assert.equal(await metric(a.id), 'Estimated 1RM');
await a.page.reload();
assert.equal(await metric(a.id), 'Estimated 1RM');
ok('the chosen chart stays with Bench Press, across other exercises, revisits and a reload');

// a backup carries it; restored on another device, Bench Press opens on Estimated 1RM
await a.page.goto(`${APP}/account`);
const [dl] = await Promise.all([a.page.waitForEvent('download'), a.id('backup-now').click()]);
const file = await dl.path();
assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).data.kv.chartMetrics, { [MINE.id]: 'volume', [BENCH]: 'e1rm' });
const b = await open(null);
await b.page.goto(`${APP}/account`);
const [chooser] = await Promise.all([b.page.waitForEvent('filechooser'), b.id('restore').click()]);
await chooser.setFiles(file);
await waitStored(b.page, (d) => d.kv.chartMetrics?.['x-bench-press-barbell'] === 'e1rm');
await b.page.goto(`${APP}/exercise/${BENCH}`);
assert.equal(await metric(b.id), 'Estimated 1RM');
assert.deepEqual(b.errors, []);
await b.ctx.close();
ok('a backup carries the chosen chart, and a restore brings it back');

// deleting an exercise drops its chart
await a.page.goto(`${APP}/exercise/${MINE.id}`);
await a.id('exercise-options').click();
await a.id('ex-delete').click();
await a.id('confirm-delete').click();
await waitStored(a.page, (d) => !d.exercises.some((e) => e.id === 'c-floor-press'));
assert.deepEqual((await storedData(a.page)).kv.chartMetrics, { [BENCH]: 'e1rm' });
ok('deleting an exercise drops its chart and leaves the others alone');

assert.deepEqual(a.errors, []);
await browser.close();
console.log(`\n${passed} checks passed`);
