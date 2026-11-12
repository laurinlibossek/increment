// A routine's pinned note for next time (#33): pinned from the running
// workout's ⋯, shown there at once and at the top of the routine page; edited
// from the routine page (and a running workout follows), the routine editor
// and Edit workout (saved with the workout); shown again at the next start, in
// German too. An empty workout and an example have no such action.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, waitStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-pinned-note');
const BENCH = 'x-bench-press-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const now = Date.now();
const push = { id: 'push', name: 'Push', exercises: [{ exerciseId: BENCH, sets: [{ type: 'normal', w: 80, r: 5 }] }] };
const running = (templateId) => ({ id: 'live', kind: 'workout', name: 'Push', notes: '', startedAt: now - 600000, templateId, templateNotes: '', rest: null, updatedAt: now,
  exercises: [{ id: 'e', exerciseId: BENCH, notes: '', showNotes: false, supersetId: null, restSec: 0, sets: [{ id: 's1', type: 'normal', w: '80', r: '5', d: '', t: '', rpe: '', done: true }] }] });
const data = (lang, templateId) => ({
  exercises: SEED_EXERCISES, workouts: [], measurements: [], templates: [push],
  kv: { settings: { language: lang, showExamples: true, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now }, active: running(templateId) },
});

async function open(seed, locale = 'en-US') {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return { ctx, page, errors, id: (t) => page.getByTestId(t) };
}
const routine = async (page) => (await storedData(page)).templates.find((t) => t.id === 'push');

const { ctx, page, errors, id } = await open(data('en', 'push'));
await page.goto(`${APP}/active`);
await id('workout-menu').click();
await id('menu-pin-note').click();
await id('prompt-input').fill('Go up 2.5 kg');
await id('prompt-ok').click();
await id('workout-pinned').waitFor();
assert.match(await id('workout-pinned').innerText(), /Pinned note\s+Go up 2\.5 kg/);
await waitStored(page, (d) => d.templates[0].pinnedNote === 'Go up 2.5 kg');
await page.screenshot({ path: `${OUT}/workout.png` });
ok('pinned from the running workout: shown there at once and saved on the routine');

// the routine page shows it; editing it there updates the running workout
await page.goto(`${APP}/template/push`);
await id('template-pinned').waitFor();
await id('template-options').click();
await id('tpl-menu-pin').click();
await id('prompt-input').fill('Seat 4, pause the first rep');
await id('prompt-ok').click();
await page.getByText('Seat 4, pause the first rep').first().waitFor();
await page.screenshot({ path: `${OUT}/routine.png` });
await page.goto(`${APP}/active`);
assert.match(await id('workout-pinned').innerText(), /Seat 4, pause the first rep/);
ok('the routine page shows and edits it; the running workout follows');

// the routine editor saves it with the routine
await page.goto(`${APP}/template/push`);
await id('template-options').click();
await id('tpl-menu-edit').click();
await id('tpl-pinned').fill('');
await id('template-save').click();
await waitStored(page, (d) => !('pinnedNote' in d.templates[0]));
await page.goto(`${APP}/template/push`);
await id('template-title').waitFor();
assert.equal(await id('template-pinned').count(), 0);
ok('emptied in the routine editor, it is removed on Save');

// finish, then Edit workout pins one with the workout's changes
await page.goto(`${APP}/active`);
await id('workout-menu').click();
await id('menu-finish').click();
await id('confirm-finish').click();
await id('summary-done').click();
await page.goto(`${APP}/workout-edit/live`);
await id('edit-pinned').fill('Next time 82.5');
await id('edit-notes').fill('Felt strong');
await id('edit-save').click();
await waitStored(page, (d) => d.templates[0].pinnedNote === 'Next time 82.5' && d.workouts[0].notes === 'Felt strong');
assert.equal((await routine(page)).pinnedNote, 'Next time 82.5');
ok('Edit workout saves the pinned note with the workout');
assert.deepEqual(errors, []);
await ctx.close();

// the next start shows it, in German; an empty workout and an example have no action
{
  const seed = data('de', null);
  seed.templates = [{ ...push, pinnedNote: 'Nächstes Mal 82,5' }];
  seed.kv.active = { ...running('push'), name: 'Push' };
  const b = await open(seed, 'de-DE');
  await b.page.goto(`${APP}/active`);
  assert.match(await b.id('workout-pinned').innerText(), /Angeheftete Notiz\s+Nächstes Mal 82,5/);
  await b.ctx.close();
  const c = await open({ ...data('en', null) });
  await c.page.goto(`${APP}/active`);
  await c.id('workout-menu').click();
  await c.id('menu-rename').waitFor();
  assert.equal(await c.id('menu-pin-note').count(), 0, 'an empty workout has no pinned note');
  await c.page.goto(`${APP}/template/x-push`);
  await c.page.waitForTimeout(300);
  assert.equal(await c.id('template-options').count(), 0, 'an example has no menu');
  assert.deepEqual(c.errors, []);
  await c.ctx.close();
  ok('the next start shows it (German); an empty workout and an example offer none');
}
await browser.close();
console.log(`\n${passed} checks passed`);
