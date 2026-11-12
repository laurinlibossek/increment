// Rep ranges on a routine's sets (#44): Today and the routine page show the
// prescribed range; the running workout shows it beside the set and on the
// keypad while the ghost stays last time's reps; Finish moves the target
// inside the bounds (12 reps against 8–10 stops at 10) and never the bounds;
// the routine editor takes "8-10" and "8–10" and refuses "10-8"; German too.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, waitStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-rep-ranges');
const BENCH = 'x-bench-press-barbell', SQUAT = 'x-squat-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const day = 86400000, now = Date.now();
const ranged = (r) => ({ type: 'normal', w: 80, r, rMin: 8, rMax: 10 });
const push = { id: 'push', name: 'Push', exercises: [
  { exerciseId: BENCH, sets: [{ type: 'warmup', w: 40, r: 10 }, ranged(8), ranged(8)] },
  { exerciseId: SQUAT, sets: [{ type: 'normal', w: 100, r: 5 }] },
] };
// last time: 80 × 9 and 80 × 9, so the ghost says 9 while the range says 8–10
const last = { id: 'w1', name: 'Push', startedAt: now - 3 * day, endedAt: now - 3 * day + 3600000, templateId: 'push',
  exercises: [{ id: 'e1', exerciseId: BENCH, sets: [{ id: 'a', type: 'warmup', w: 40, r: 10 }, { id: 'b', type: 'normal', w: 80, r: 9 }, { id: 'c', type: 'normal', w: 80, r: 9 }] },
    { id: 'e2', exerciseId: SQUAT, sets: [{ id: 'd', type: 'normal', w: 100, r: 5 }] }] };
// Today suggests a routine after two workouts from routines
const before = { ...last, id: 'w0', startedAt: now - 6 * day, endedAt: now - 6 * day + 3600000,
  exercises: last.exercises.map((e) => ({ ...e, id: `${e.id}0`, sets: e.sets.map((x) => ({ ...x, id: `${x.id}0`, r: x.type === 'warmup' ? x.r : 8 })) })) };
const data = (language) => ({
  exercises: SEED_EXERCISES, workouts: [before, last], measurements: [], templates: [push],
  kv: { settings: { language, showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now } },
});

async function open(seed, { locale = 'en-US', theme = 'light' } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale, colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const id = (t) => page.getByTestId(t);
  const checks = (ex) => id(`block-${ex}`).locator('[data-testid^="check-"]');
  const setId = async (ex, n) => (await checks(ex).nth(n).getAttribute('data-testid')).replace(/^check-/, '');
  return { ctx, page, errors, id, checks, setId };
}
const benchSets = async (page) => (await storedData(page)).templates.find((t) => t.id === 'push').exercises[0].sets;

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors, id, checks, setId } = await open(data('en'), { theme });
  // Today and the routine page show the prescription
  await page.goto(APP);
  await id('up-next').waitFor();
  assert.match(await id('up-next').innerText(), /Bench Press \(Barbell\) × 8–10, Squat \(Barbell\)(?! ×)/);
  if (theme === 'light') await page.screenshot({ path: `${OUT}/today.png` });
  await page.goto(`${APP}/template/push`);
  assert.match(await id('template-exercise-0').innerText(), /2 sets · 40 × 10, 80 × 8–10/);
  assert.match(await id('template-exercise-1').innerText(), /1 set · 100 × 5$/);
  await page.screenshot({ path: `${OUT}/routine-${theme}.png` });
  ok(`${theme}: Today and the routine page show 8–10 for Bench Press, plain numbers for Squat`);

  // the running workout: the range beside the set, last time's reps as the ghost, the range on the keypad
  await id('start-template').click();
  await id(`block-${BENCH}`).waitFor();
  const [s1, s2] = [await setId(BENCH, 1), await setId(BENCH, 2)];
  assert.match(await id(`set-${s1}`).innerText(), /8–10 reps/);
  assert.equal(await id(`in-r-${s1}`).getAttribute('placeholder'), '9');
  assert.doesNotMatch(await id(`set-${await setId(BENCH, 0)}`).innerText(), /reps/, 'the warm-up has no range');
  await id(`in-r-${s2}`).click();
  await id('keypad').waitFor();
  assert.match(await id('keypad-aside').innerText(), /Rep range\s*8–10/);
  await id('key-1').click();
  await id('key-2').click();
  await page.screenshot({ path: `${OUT}/session-${theme}.png` });
  await id('keypad-close').click();
  await id('keypad').waitFor({ state: 'detached' });
  ok(`${theme}: the session shows “8–10 reps” beside the set, 9 (last time) as the ghost, and the range on the keypad`);

  // log everything (the first working set at last time's 9, the second at 12) and finish
  for (const ex of [BENCH, SQUAT]) {
    // the session shows one exercise at a time: Squat comes up with Next once Bench Press is done
    await checks(ex).first().waitFor();
    if (ex === SQUAT) assert.doesNotMatch(await id(`set-${await setId(SQUAT, 0)}`).innerText(), /reps/, 'Squat has no range');
    const n = await checks(ex).count();
    for (let i = 0; i < n; i++) { await checks(ex).nth(i).click(); await page.waitForTimeout(150); if (await id('rest-skip').count()) await id('rest-skip').click(); }
    // a finished exercise stays on screen until Next (#60)
    if (await id('next-exercise').count()) await id('next-exercise').click();
  }
  await id('workout-menu').click();
  await id('menu-finish').click();
  await id('confirm-finish').click();
  await id('summary-done').waitFor();
  await waitStored(page, (d) => d.templates[0].exercises[0].sets[1].r === 9);
  assert.deepEqual(await benchSets(page), [{ type: 'warmup', w: 40, r: 10 }, ranged(9), ranged(10)]);
  const done = (await storedData(page)).workouts.find((w) => !['w0', 'w1'].includes(w.id));
  assert.deepEqual(done.exercises[0].sets.map((x) => x.r), [10, 9, 12], 'the workout keeps the 12 reps');
  assert.ok(done.exercises[0].sets.every((x) => !('rMin' in x) && !('rMax' in x)), 'a workout stores no range');
  ok(`${theme}: Finish moves the targets to 9 and 10 (not 12) and keeps 8–10; the workout keeps 12 and no range`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

// the routine editor: "8–10" as it is, "10-8" refused, "10-12" and a plain number saved
{
  const { ctx, page, errors, id } = await open(data('en'));
  await page.goto(`${APP}/template/push`);
  await id('template-options').click();
  await id('tpl-menu-edit').click();
  await id('template-save').waitFor();
  const reps = page.locator('[data-testid^="in-r-"]');
  assert.deepEqual(await reps.evaluateAll((els) => els.map((e) => e.value)), ['10', '8–10', '8–10', '5']);
  await reps.nth(2).fill('10-8');
  await page.screenshot({ path: `${OUT}/editor.png` });
  await id('template-save').click();
  await id('toast').waitFor();
  assert.match(await id('toast').innerText(), /A rep range needs two whole numbers, like 8–10/);
  assert.equal(await id('template-save').count(), 1, 'still in the editor');
  assert.deepEqual(await benchSets(page), push.exercises[0].sets, 'nothing saved');
  await reps.nth(2).fill('10-12');
  await reps.nth(3).fill('6');
  await id('template-save').click();
  await waitStored(page, (d) => d.templates[0].exercises[0].sets[2].rMax === 12);
  const t = (await storedData(page)).templates[0];
  assert.deepEqual(t.exercises[0].sets, [{ type: 'warmup', w: 40, r: 10 }, ranged(8), { type: 'normal', w: 80, r: 10, rMin: 10, rMax: 12 }]);
  assert.deepEqual(t.exercises[1].sets, [{ type: 'normal', w: 100, r: 6 }]);
  await page.goto(`${APP}/template/push`);
  assert.match(await id('template-exercise-0').innerText(), /40 × 10, 80 × 8–10, 80 × 10–12/);
  ok('the editor shows 8–10, refuses 10-8 with a message, saves 10-12 (target 10) and a plain 6');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// German: Today, the set's chip and the keypad
{
  const { ctx, page, errors, id, setId } = await open(data('de'), { locale: 'de-DE' });
  await page.goto(APP);
  await id('up-next').waitFor();
  assert.match(await id('up-next').innerText(), /× 8–10/);
  await page.goto(`${APP}/template/push`);
  await id('start-template').click();
  await id(`block-${BENCH}`).waitFor();
  const s1 = await setId(BENCH, 1);
  assert.match(await id(`set-${s1}`).innerText(), /8–10 Wdh\./);
  await id(`in-r-${s1}`).click();
  assert.match(await id('keypad-aside').innerText(), /Wiederholungsbereich\s*8–10/);
  await page.screenshot({ path: `${OUT}/session-de.png` });
  ok('German: “× 8–10” on Today, “8–10 Wdh.” beside the set and “Wiederholungsbereich” on the keypad');
  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
