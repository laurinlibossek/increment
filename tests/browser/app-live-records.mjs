// Records while lifting (#37): the session, Today's card, Now Lifting and the
// summary count the same record sets, by the summary's rule. After a best of
// 95 kg × 5, three sets of 100 kg × 5 are one record (the first); a better set
// later takes it over, and unchecking that set gives it back.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, selectTab } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-live-records');
const BENCH = 'x-bench-press-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const day = 24 * 3600000;
const now = Date.now();
const pending = (i) => ({ id: `s${i}`, type: 'normal', w: '100', r: '5', d: '', t: '', rpe: '', done: false });
const data = {
  exercises: SEED_EXERCISES,
  workouts: [{ id: 'before', name: 'Push', startedAt: now - 3 * day, endedAt: now - 3 * day + 3600000, templateId: null,
    exercises: [{ id: 'be', exerciseId: BENCH, sets: [{ id: 'b1', type: 'normal', w: 95, r: 5 }] }] }],
  templates: [],
  measurements: [],
  kv: {
    settings: { language: 'en', showExamples: false, appKeepAwake: false },
    meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now },
    active: { id: 'live', kind: 'workout', name: 'Push', notes: '', startedAt: now - 600000, templateId: null, templateNotes: '', rest: null, updatedAt: now,
      exercises: [{ id: 'e', exerciseId: BENCH, notes: '', showNotes: false, supersetId: null, restSec: 0, sets: [0, 1, 2].map(pending) }] },
  },
};

const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US' });
await ctx.addInitScript(grantWakeLock);
await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const id = (t) => page.getByTestId(t);
const block = () => id(`block-${BENCH}`);
const checks = () => block().locator('[data-testid^="check-"]');
const labels = () => block().locator('[data-testid^="notes-"]');
const wait = (ms = 300) => page.waitForTimeout(ms);
/** Which set rows have the Record chip. */
const chips = async () => {
  const out = [];
  for (let i = 0; i < await labels().count(); i++) if (/Record/.test(await labels().nth(i).innerText())) out.push(i);
  return out;
};
/** Record strokes (the signal colour) inside a test ID. */
const signalStrokes = (testID) => id(testID).first().evaluate((el) => [...el.querySelectorAll('div')]
  .filter((d) => getComputedStyle(d).backgroundColor === 'rgb(255, 214, 10)').length);

await page.goto(APP);
await id('resume-workout').click();
await block().waitFor();
for (let i = 0; i < 3; i++) { await checks().nth(i).click(); await wait(200); }
await wait();
assert.deepEqual(await chips(), [0], 'one record chip, on the first set');
assert.match(await id('session-count').innerText(), /3 of 3 sets · 1 record$/);
assert.equal(await signalStrokes('session-tally'), 1);
await page.screenshot({ path: `${OUT}/three-equal-sets.png` });
ok('three sets of 100 × 5 after 95 × 5: one record in the session, its chip and its stroke');

// a better set later takes the record over; unchecking it gives it back to the first
await id(`add-set-${BENCH}`).click();
await wait(200);
await block().locator('[data-testid^="in-w-"]').nth(3).fill('102.5');
await block().locator('[data-testid^="in-r-"]').nth(3).fill('5');
await checks().nth(3).click();
await wait();
assert.deepEqual(await chips(), [3]);
assert.match(await id('session-count').innerText(), /· 1 record$/);
await checks().nth(3).click();
await wait();
assert.deepEqual(await chips(), [0], 'back to the first set');
await checks().nth(3).click();
await wait();
assert.deepEqual(await chips(), [3]);
assert.equal(await signalStrokes('session-tally'), 1);
ok('102.5 × 5 takes the record over; unchecked, the first set has it again');

// Today's card and Now Lifting count the same
await id('minimize').click();
await selectTab(page, 'index');
await id('now-card').waitFor();
assert.match(await id('now-card').innerText(), /4 of 4 sets · 1 record/);
assert.equal(await signalStrokes('now-card'), 1);
assert.equal(await signalStrokes('mini-bar'), 1);
await page.screenshot({ path: `${OUT}/today.png` });
ok('Today’s card and Now Lifting show one record');

// the summary and the history agree
await id('resume-workout').click();
await id('workout-menu').click();
await id('menu-finish').click();
await id('confirm-finish').click();
await id('summary-title').waitFor();
assert.match(await id('summary-tally').getAttribute('aria-label'), /4 sets · 1 record/);
assert.equal(await signalStrokes('summary-tally'), 1);
const saved = (await storedData(page)).workouts.find((w) => w.id === 'live');
assert.deepEqual(saved.exercises[0].sets.map((s) => s.w), [100, 100, 100, 102.5]);
await page.screenshot({ path: `${OUT}/summary.png` });
await id('summary-done').click();
await page.goto(`${APP}/history`);
await id('history-records-live').waitFor();
assert.equal((await id('history-records-live').innerText()).replace(/\s+/g, ' '), '1 record');
ok('the summary and History count the same record');

assert.deepEqual(errors, []);
await browser.close();
console.log(`\n${passed} checks passed`);
