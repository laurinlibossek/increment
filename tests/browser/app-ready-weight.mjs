// "Weight increase recommended" (#49): when the routine's latest workout reached
// the top of every prescribed working set's rep range at the prescribed
// weight, the routine page and the next session say so (assisted exercises:
// less assistance; reps-only and unranged exercises: nothing). More weight
// next time clears it; so does a changed prescription; none with "Update
// routines after workouts" off; the editor explains when a range is missing.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, waitStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-ready-weight');
const BENCH = 'x-bench-press-barbell', ASSIST = 'x-pull-up-assisted', PUSHUP = 'x-push-up', SQUAT = 'x-squat-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const day = 86400000, now = Date.now();
const R = (w, r) => ({ type: 'normal', w, r, rMin: 8, rMax: 10 });
const push = { id: 'push', name: 'Push', exercises: [
  { exerciseId: BENCH, sets: [{ type: 'warmup', w: 40, r: 10 }, R(80, 10), R(80, 10), R(80, 10)] },
  { exerciseId: ASSIST, sets: [R(30, 10), R(30, 10)] },
  { exerciseId: PUSHUP, sets: [{ type: 'normal', r: 12, rMin: 8, rMax: 12 }] },
  { exerciseId: SQUAT, sets: [{ type: 'normal', w: 100, r: 5 }] },
] };
const session = (id, ago) => ({ id, name: 'Push', startedAt: now - ago * day, endedAt: now - ago * day + 3600000, templateId: 'push', exercises: [
  { id: `${id}a`, exerciseId: BENCH, sets: [{ id: `${id}1`, type: 'warmup', w: 40, r: 10 }, ...[2, 3, 4].map((n) => ({ id: `${id}${n}`, type: 'normal', w: 80, r: 10 }))] },
  { id: `${id}b`, exerciseId: ASSIST, sets: [5, 6].map((n) => ({ id: `${id}${n}`, type: 'normal', w: 30, r: 10 })) },
  { id: `${id}c`, exerciseId: PUSHUP, sets: [{ id: `${id}7`, type: 'normal', r: 12 }] },
  { id: `${id}d`, exerciseId: SQUAT, sets: [{ id: `${id}8`, type: 'normal', w: 100, r: 5 }] },
] });
const data = (settings = {}) => ({
  exercises: SEED_EXERCISES, workouts: [session('w1', 3), session('w0', 6)], measurements: [], templates: [push],
  kv: { settings: { language: 'en', showExamples: false, appKeepAwake: false, ...settings }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now } },
});

async function open(seed, { locale = 'en-US', theme = 'light' } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale, colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return { ctx, page, errors, id: (t) => page.getByTestId(t) };
}
const readyOn = async (id) => Promise.all([0, 1, 2, 3].map(async (i) => ((await id(`template-ready-${i}`).count()) ? id(`template-ready-${i}`).innerText() : null)));

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors, id } = await open(data(), { theme });
  await page.goto(`${APP}/template/push`);
  await id('template-ready-0').waitFor();
  assert.deepEqual(await readyOn(id), ['Weight increase recommended', 'Less assistance weight recommended', null, null]);
  await page.waitForTimeout(300); // the mark fades in
  await page.screenshot({ path: `${OUT}/routine-${theme}.png` });
  ok(`${theme}: the routine page marks Bench Press (more weight) and the assisted Pull Up (less assistance); not Push Up (reps only) or Squat (no range)`);

  await id('start-template').click();
  await id(`ready-${BENCH}`).waitFor();
  assert.equal(await id(`ready-${BENCH}`).innerText(), 'Weight increase recommended');
  await page.waitForTimeout(300); // the mark fades in
  await page.screenshot({ path: `${OUT}/session-${theme}.png` });
  ok(`${theme}: the next session says so under Bench Press`);

  if (theme === 'light') {
    // 85 × 8 three times: the routine takes the weight, and the mark goes (the latest workout no longer qualifies)
    const checks = id(`block-${BENCH}`).locator('[data-testid^="check-"]');
    await checks.nth(0).click();
    if (await id('rest-skip').count()) await id('rest-skip').click();
    for (let n = 1; n <= 3; n++) {
      const set = (await checks.nth(n).getAttribute('data-testid')).replace(/^check-/, '');
      await id(`in-w-${set}`).click();
      await id('keypad').waitFor();
      for (const k of ['8', '5', 'next', '8', 'next']) { await id(`key-${k}`).click(); await page.waitForTimeout(120); }
      if (await id('rest-skip').count()) await id('rest-skip').click();
    }
    await id('workout-menu').click();
    await id('menu-finish').click();
    // the other exercises weren't logged: leave them out if asked
    await page.waitForSelector('[data-testid="drop-pending"], [data-testid="confirm-finish"]');
    await id((await id('drop-pending').count()) ? 'drop-pending' : 'confirm-finish').click();
    await id('summary-done').waitFor();
    if (await id('routine-keep').count()) await id('routine-keep').click();
    await waitStored(page, (d) => d.templates[0].exercises[0].sets[1].w === 85);
    assert.deepEqual((await storedData(page)).templates[0].exercises[0].sets.slice(1), [R(85, 8), R(85, 8), R(85, 8)]);
    await page.goto(`${APP}/template/push`);
    await id('template-title').waitFor();
    assert.deepEqual(await readyOn(id), [null, null, null, null], 'more weight clears it; the assisted Pull Up was skipped this time');
    ok('light: 85 × 8 raises the routine to 85 and clears the mark; nothing adds up across workouts');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
}

// the editor: a missing range is explained; a changed prescription makes the old workout count for nothing
{
  const { ctx, page, errors, id } = await open(data());
  await page.goto(`${APP}/template/push`);
  await id('template-options').click();
  await id('tpl-menu-edit').click();
  const reps = id(`block-${BENCH}`).locator('[data-testid^="in-r-"]');
  assert.equal(await id(`range-hint-${BENCH}`).count(), 0);
  await reps.nth(3).fill('10');
  assert.equal(await id(`range-hint-${BENCH}`).innerText(), 'Weight increases are recommended once every working set has a rep range');
  await page.screenshot({ path: `${OUT}/editor-hint.png` });
  await reps.nth(3).fill('8-10');
  assert.equal(await id(`range-hint-${BENCH}`).count(), 0);
  // a heavier prescription: the last workout was at 80, so nothing is ready until a workout at 82.5
  const weights = id(`block-${BENCH}`).locator('[data-testid^="in-w-"]');
  await weights.nth(1).fill('82.5');
  await id('template-save').click();
  await waitStored(page, (d) => d.templates[0].exercises[0].sets[1].w === 82.5 && d.templates[0].prescribedAt > 0);
  await page.goto(`${APP}/template/push`);
  await id('template-title').waitFor();
  assert.deepEqual(await readyOn(id), [null, null, null, null]);
  ok('the editor explains a missing range; a changed prescription clears the mark for every exercise');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// Update routines after workouts off: no marks; German texts
{
  const off = await open(data({ askTemplateUpdate: false }));
  await off.page.goto(`${APP}/template/push`);
  await off.id('template-title').waitFor();
  assert.deepEqual(await readyOn(off.id), [null, null, null, null]);
  await off.ctx.close();
  const de = await open(data({ language: 'de' }), { locale: 'de-DE' });
  await de.page.goto(`${APP}/template/push`);
  await de.id('template-ready-0').waitFor();
  assert.deepEqual(await readyOn(de.id), ['Mehr Gewicht empfohlen', 'Weniger Unterstützungsgewicht empfohlen', null, null]);
  await de.page.waitForTimeout(300); // the mark fades in
  await de.page.screenshot({ path: `${OUT}/routine-de.png` });
  assert.deepEqual(de.errors, []);
  await de.ctx.close();
  ok('none with “Update routines after workouts” off; German says “Mehr Gewicht empfohlen” and “Weniger Unterstützungsgewicht empfohlen”');
}
await browser.close();
console.log(`\n${passed} checks passed`);
