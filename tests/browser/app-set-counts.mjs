// Set counts leave warm-ups out (#38): they're logged and drawn (W rows, short
// strokes) but no number of sets counts them, in the running workout (header,
// Up next, Today's card, Now Lifting) or after Finish (summary, Workouts row,
// workout page). Now Lifting names the set the session shows next, also after
// jumping to another exercise, and says "warm-up set" during a warm-up.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, selectTab } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-set-counts');
const BENCH = 'x-bench-press-barbell', SQUAT = 'x-squat-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const now = Date.now();
const row = (id, type, w, r) => ({ id, type, w: String(w), r: String(r), d: '', t: '', rpe: '', done: false });
const entry = (id, exerciseId, sets) => ({ id, exerciseId, notes: '', showNotes: false, supersetId: null, restSec: 0, sets });
const data = {
  exercises: SEED_EXERCISES, workouts: [], templates: [], measurements: [],
  kv: {
    settings: { language: 'en', showExamples: false, appKeepAwake: false },
    meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now },
    active: { id: 'live', kind: 'workout', name: 'Legs and chest', notes: '', startedAt: now - 1200000, templateId: null, templateNotes: '', rest: null, updatedAt: now,
      exercises: [
        entry('b', BENCH, [row('w1', 'warmup', 20, 10), row('w2', 'warmup', 40, 5), row('w3', 'warmup', 50, 3), row('w4', 'warmup', 60, 2),
          row('b1', 'normal', 70, 5), row('b2', 'normal', 70, 5), row('b3', 'normal', 70, 5)]),
        entry('q', SQUAT, [row('q1', 'normal', 100, 5), row('q2', 'normal', 100, 5)]),
      ] },
  },
};

const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US' });
await ctx.addInitScript(grantWakeLock);
await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const id = (t) => page.getByTestId(t);
const checks = (ex) => id(`block-${ex}`).locator('[data-testid^="check-"]');
const wait = (ms = 300) => page.waitForTimeout(ms);
const today = async () => { await id('minimize').click(); await selectTab(page, 'index'); await id('now-card').waitFor(); };
const nowLifting = () => id('mini-bar').first().innerText();

await page.goto(APP);
await id('now-card').waitFor();
assert.match(await id('now-card').innerText(), /0 of 5 sets/);
assert.match(await nowLifting(), /Bench Press \(Barbell\) · warm-up set/);
await id('resume-workout').click();
await id(`block-${BENCH}`).waitFor();
assert.match(await id('session-count').innerText(), /^0 of 5 sets/);
for (let i = 0; i < 4; i++) { await checks(BENCH).nth(i).click(); await wait(150); }
await wait();
assert.match(await id('session-count').innerText(), /^0 of 5 sets/, 'logged warm-ups count for nothing');
assert.match(await id('session-tally').getAttribute('aria-label'), /^0 of 5 sets logged/);
await page.screenshot({ path: `${OUT}/warm-ups-logged.png` });
await today();
assert.match(await id('now-card').innerText(), /0 of 5 sets/);
assert.match(await nowLifting(), /Bench Press \(Barbell\) · set 1 of 3/);
ok('four warm-ups logged: 0 of 5 in the session, on Today and in Now Lifting, which is at working set 1 of 3');

// jumping to another exercise: Now Lifting follows the session, not the first set left
await id('resume-workout').click();
await id(`jump-${SQUAT}`).click();
await wait();
await today();
assert.match(await nowLifting(), /Squat \(Barbell\) · set 1 of 2/);
ok('after jumping to Squat, Now Lifting shows Squat’s next set');

// everything logged: the same 5 sets in the session, the summary, Workouts and the workout page
await id('resume-workout').click();
await id(`block-${SQUAT}`).waitFor();
for (let i = 0; i < 2; i++) { await checks(SQUAT).nth(i).click(); await wait(150); }
// Squat done: it stays on screen until Next goes back to the session's order, to Bench (#60)
assert.equal((await id('next-exercise').innerText()).trim(), 'Next: Bench Press (Barbell)');
await id('next-exercise').click();
await id(`block-${BENCH}`).waitFor();
for (let i = 4; i < 7; i++) { await checks(BENCH).nth(i).click(); await wait(150); }
await wait();
assert.match(await id('session-count').innerText(), /^5 of 5 sets/);
await id('workout-menu').click();
await id('menu-finish').click();
await id('confirm-finish').waitFor();
assert.match(await page.locator('body').innerText(), /5 sets logged in/);
await id('confirm-finish').click();
await id('summary-title').waitFor();
assert.equal(await id('summary-sets').innerText().then((t) => t.match(/\d+/)[0]), '5');
assert.match(await id('summary-tally').getAttribute('aria-label'), /^5 sets · workout #1$/);
await page.screenshot({ path: `${OUT}/summary.png` });
await id('summary-done').click();
await page.goto(`${APP}/history`);
await id('history-tally-live').waitFor();
assert.equal(await id('history-tally-live').getAttribute('aria-label'), '5 sets');
await id('workout-live').click();
await id('workout-tally').waitFor();
assert.equal(await id('workout-tally').getAttribute('aria-label'), '5 sets');
ok('Finish, the summary, the Workouts row and the workout page all say 5 sets');

assert.deepEqual(errors, []);
await browser.close();
console.log(`\n${passed} checks passed`);
