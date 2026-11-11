// Estimated 1RM above 12 reps (#41): every formula setting gives way to
// Epley, so 20 kg × 36 with Brzycki is 44 kg, not 720 kg. The 1RM calculator
// names the formula it used; the exercise page's Chart menu says so; its
// record comes from the same estimate.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const BENCH = 'x-bench-press-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const at = Date.now() - 86400000;
const data = {
  exercises: SEED_EXERCISES, templates: [], measurements: [],
  workouts: [{ id: 'w', name: 'Push', startedAt: at, endedAt: at + 3600000, templateId: null,
    exercises: [{ id: 'e', exerciseId: BENCH, sets: [{ id: 's1', type: 'normal', w: 20, r: 36 }] }] }],
  kv: { settings: { language: 'en', showExamples: false, appKeepAwake: false, formula: 'brzycki' }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: at } },
};

const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US' });
await ctx.addInitScript(grantWakeLock);
await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const id = (t) => page.getByTestId(t);
const num = async (t) => Number((await id(t).innerText()).replace(/[^\d.]/g, ''));

await page.goto(`${APP}/tools`);
await id('tools-tabs-rm').click();
await id('rm-w').fill('20');
await id('rm-r').fill('36');
assert.equal(await num('rm-result'), 44);
assert.equal(await id('rm-formula').innerText(), 'Epley formula');
await id('rm-w').fill('100');
await id('rm-r').fill('12');
assert.equal(await num('rm-result'), 144);
assert.equal(await id('rm-formula').innerText(), 'Brzycki formula');
ok('the calculator: Brzycki up to 12 reps (100 × 12 → 144), Epley above (20 × 36 → 44, not 720)');

await page.goto(`${APP}/exercise/${BENCH}`);
await id('exercise-hero').waitFor();
assert.match(await id('exercise-hero').innerText(), /\b44\b/);
assert.doesNotMatch(await id('exercise-hero').innerText(), /720/);
await id('exercise-metric').click();
assert.match(await page.locator('body').innerText(), /Brzycki formula on your best working set of each session, and Epley above 12 reps/);
ok('the exercise page shows 44 kg and its Chart menu explains Epley above 12 reps');

assert.deepEqual(errors, []);
await browser.close();
console.log(`\n${passed} checks passed`);
