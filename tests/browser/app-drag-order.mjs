// Dragging exercises into place (#137). In the routine editor and Edit
// workout, press and hold an exercise's name: the blocks fold to one row each,
// the held one stays under the finger, the others slide out of the way, near
// the screen's edge it scrolls, and after the drop the moved exercise is in
// view; a tap still opens its menu. In the running workout every exercise
// drags to any place, also above the one on screen: one with nothing logged
// gives way (an exercise dropped above it comes on screen, and dragged down,
// the one it passed takes its place); one with a set logged stays. A superset
// moves as one. The editors' fields no longer say "(optional)".
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, waitStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-drag-order');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

// the routine from Laurin's screenshots
const RF = 'x-reverse-fly-machine', TBAR = 'x-t-bar-row', LAT = 'x-lat-pulldown-cable', PULLOVER = 'x-single-arm-pullover-cable';
const PREACHER = 'x-preacher-curl-machine', HAMMER = 'x-hammer-curl-dumbbell';
const PULL = [RF, TBAR, LAT, PULLOVER, PREACHER, HAMMER];
const LONG = [...PULL, 'x-face-pull-cable', 'x-shrug-dumbbell', 'x-bicep-curl-barbell', 'x-seated-row-cable', 'x-pull-up', 'x-deadlift-barbell'];
const now = Date.now();
const three = () => [1, 2, 3].map(() => ({ type: 'normal', w: 60, r: 10 }));
const routine = (id, ids) => ({ id, name: id === 'pull' ? 'Pull' : 'Back day', exercises: ids.map((exerciseId) => ({ exerciseId, sets: three() })) });
const finished = { id: 'done', name: 'Pull', startedAt: now - 86400000, endedAt: now - 86400000 + 3600000, templateId: null,
  exercises: PULL.slice(0, 4).map((exerciseId, i) => ({ id: `d${i}`, exerciseId, sets: [{ id: `d${i}s`, type: 'normal', w: 50, r: 8 }] })) };
const set = (id, done = false) => ({ id, type: 'normal', w: '60', r: '10', d: '', t: '', rpe: '', done });
const running = (ids, { done = [], superset = [] } = {}) => ({
  id: 'live', kind: 'workout', name: 'Pull', notes: '', startedAt: now - 60000, templateId: null, templateNotes: '', rest: null, updatedAt: now,
  exercises: ids.map((exerciseId, i) => ({
    id: `e${i}`, exerciseId, notes: '', showNotes: false, supersetId: superset.includes(exerciseId) ? 'ss' : null, restSec: 0,
    sets: [set(`s${i}a`, done.includes(exerciseId)), set(`s${i}b`), set(`s${i}c`)],
  })),
});
const data = ({ language = 'en', active = null } = {}) => ({
  exercises: SEED_EXERCISES, workouts: [finished], measurements: [], templates: [routine('pull', PULL), routine('long', LONG)],
  kv: { settings: { language, showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now }, ...(active ? { active } : {}) },
});
for (const id of LONG) assert.ok(SEED_EXERCISES.some((e) => e.id === id), id);

async function open(seed, path, { scheme = 'light', locale = 'en-US' } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: scheme, locale });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${APP}${path}`);
  return { ctx, page, errors, id: (t) => page.getByTestId(t) };
}

/** Press and hold `target`, check what's under the finger once it's picked up (`held`), drag it by `dy`, let go. */
async function drag(page, target, dy, { held, shot, during } = {}) {
  // Press away from the screen's edges: within 72 px of one the screen scrolls a frame-rate-dependent
  // amount before the finger leaves it (a row at the bottom landed one place short on a slow runner).
  await target.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const b = await target.boundingBox();
  const x = b.x + Math.min(60, b.width / 3), y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  if (held) {
    const r = await held.boundingBox();
    assert.ok(r && r.y <= y && y <= r.y + r.height, `the held row stays under the finger (${y}): ${JSON.stringify(r)}`);
  }
  if (shot) await page.screenshot({ path: shot });
  const steps = 14;
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x, y + (dy * i) / steps); await page.waitForTimeout(16); }
  await page.waitForTimeout(100);
  if (during) await during();
  await page.mouse.up();
  await page.waitForTimeout(500);
}
const blocks = (page) => page.locator('[data-testid^="block-x-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').slice(6)));
const rows = (page) => page.locator('[data-testid^="jump-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').slice(5)));
const inView = async (loc) => { const b = await loc.boundingBox(); return b && b.y >= 0 && b.y + b.height <= 844; };
const ROW_EDIT = 64, ROW_SESSION = 60;

// ---------- the routine editor ----------
for (const scheme of ['light', 'dark']) {
  const { ctx, page, errors, id } = await open(data(), '/template-edit?id=pull', { scheme });
  // the fields don't say "(optional)"
  assert.deepEqual(await Promise.all(['tpl-folder', 'tpl-notes', 'tpl-pinned'].map((t) => id(t).getAttribute('placeholder'))), ['Folder', 'Notes', 'Pin a note for next time']);
  // Hammer Curl, the last one, three places up
  await id(`ex-title-${HAMMER}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  let folds = 0;
  await drag(page, id(`ex-title-${HAMMER}`), -3 * ROW_EDIT + 8, {
    held: id(`fold-${HAMMER}`), shot: `${OUT}/editor-folded-${scheme}.png`,
    during: async () => {
      folds = await page.locator('[data-testid^="fold-x-"]').count();
      await page.screenshot({ path: `${OUT}/editor-dragging-${scheme}.png` });
    },
  });
  assert.equal(folds, 6, 'every exercise is a row while one is dragged');
  assert.equal(await page.locator('[data-testid^="fold-x-"]').count(), 0, 'and a block again after the drop');
  assert.deepEqual(await blocks(page), [RF, TBAR, HAMMER, LAT, PULLOVER, PREACHER]);
  assert.ok(await inView(id(`ex-title-${HAMMER}`)), 'the moved exercise is in view');
  await page.screenshot({ path: `${OUT}/editor-dropped-${scheme}.png` });
  // a tap on the name still opens its menu; a long press without moving changes nothing
  await id(`ex-title-${TBAR}`).click();
  await id('menu-reorder').waitFor();
  await id('sheet-cancel').click();
  await page.waitForTimeout(300);
  await drag(page, id(`ex-title-${TBAR}`), 0);
  assert.deepEqual(await blocks(page), [RF, TBAR, HAMMER, LAT, PULLOVER, PREACHER]);
  await id('template-save').click();
  await waitStored(page, (d) => d.templates.find((t) => t.id === 'pull').exercises.map((e) => e.exerciseId).join() === [RF, TBAR, HAMMER, LAT, PULLOVER, PREACHER].join());
  assert.deepEqual(errors, []);
  await ctx.close();
  ok(`routine editor (${scheme}): the fields say Folder, Notes and Pin a note for next time; holding Hammer Curl’s name folds the 6 exercises to rows with it under the finger; dragged 3 up it lands above Lat Pulldown, in view, and is saved; a tap still opens the menu and a hold without moving changes nothing`);
}

// a long routine: dragging the last one to the top edge scrolls the screen up, and it lands first
{
  const { ctx, page, errors, id } = await open(data(), '/template-edit?id=long');
  const last = LONG.at(-1);
  await id(`ex-title-${last}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const b = await id(`ex-title-${last}`).boundingBox();
  const x = b.x + 60, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  const scrolled = () => page.evaluate(() => [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 10 && getComputedStyle(d).overflowY !== 'visible')?.scrollTop ?? -1);
  // the list has the finger (it trades the space that held the row for scrolling), then the finger goes to the top edge
  await page.mouse.move(x, y - 4);
  await page.waitForTimeout(200);
  const held = await id(`fold-${last}`).boundingBox();
  assert.ok(held.y <= y && y <= held.y + held.height, `still under the finger: ${JSON.stringify(held)} at ${y}`);
  const top = await scrolled();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(x, y + ((110 - y) * i) / 10); await page.waitForTimeout(16); }
  await page.waitForTimeout(2500);
  const after = await scrolled();
  await page.screenshot({ path: `${OUT}/editor-edge-scroll.png` });
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.ok(top > 200 && after === 0, `the screen scrolled up to the top while held at the edge: ${top} → ${after}`);
  assert.equal((await blocks(page))[0], last);
  assert.ok(await inView(id(`ex-title-${last}`)));
  assert.deepEqual(errors, []);
  await ctx.close();
  ok(`a 12-exercise routine: Deadlift, the last, held at the top edge scrolls the screen up (by ${top - after} px) and lands first, in view`);
}

// Edit workout: the same, saved with the workout
{
  const { ctx, page, errors, id } = await open(data(), '/workout-edit/done');
  assert.equal(await id('edit-pinned').count(), 0, 'no routine, no pinned note');
  await drag(page, id(`ex-title-${PULLOVER}`), -2 * ROW_EDIT);
  assert.deepEqual(await blocks(page), [RF, PULLOVER, TBAR, LAT]);
  await id('edit-save').click();
  await waitStored(page, (d) => d.workouts[0].exercises.map((e) => e.exerciseId).join() === [RF, PULLOVER, TBAR, LAT].join());
  assert.deepEqual(errors, []);
  await ctx.close();
  ok('Edit workout: Single Arm Pullover dragged 2 up by its name, saved in that order');
}

// ---------- the running workout ----------
const order = async (page) => (await storedData(page)).kv.active.exercises.map((e) => e.exerciseId);
// nothing of Reverse Fly logged: T Bar Row dropped above it comes on screen
for (const scheme of ['light', 'dark']) {
  const { ctx, page, errors, id } = await open(data({ active: running(PULL) }), '/active', { scheme });
  await id(`jump-${TBAR}`).waitFor();
  assert.deepEqual(await blocks(page), [RF]);
  let during = [];
  await drag(page, id(`jump-${TBAR}`), -ROW_SESSION - 10, {
    held: id(`jump-${TBAR}`), shot: `${OUT}/session-folded-${scheme}.png`,
    during: async () => {
      during = await rows(page);
      await page.screenshot({ path: `${OUT}/session-dragging-${scheme}.png` });
    },
  });
  assert.deepEqual(during, PULL, 'the exercise on screen is a row too while one is dragged');
  assert.deepEqual(await order(page), [TBAR, RF, LAT, PULLOVER, PREACHER, HAMMER]);
  assert.deepEqual(await blocks(page), [TBAR], 'T Bar Row comes on screen');
  assert.match(await id('log-set').innerText(), /^Log 60 × 10$/);
  assert.equal((await storedData(page)).kv.active.current, 'e1');
  assert.deepEqual(await rows(page), [RF, LAT, PULLOVER, PREACHER, HAMMER], 'Reverse Fly is up next');
  await page.waitForTimeout(400);
  assert.ok(await inView(id(`exercise-header-${TBAR}`)));
  await page.screenshot({ path: `${OUT}/session-dropped-${scheme}.png` });
  assert.deepEqual(errors, []);
  await ctx.close();
  ok(`running workout (${scheme}): T Bar Row dragged above an untouched Reverse Fly (which folds to a row meanwhile) comes on screen, ready to log; Reverse Fly is up next`);
}

// the exercise on screen, untouched, dragged down by its name: the first one it passed takes its place
{
  const { ctx, page, errors, id } = await open(data({ active: running(PULL) }), '/active');
  await drag(page, id(`ex-title-${RF}`), 2 * ROW_SESSION + 10, { held: id(`jump-${RF}`) });
  assert.deepEqual(await order(page), [TBAR, LAT, RF, PULLOVER, PREACHER, HAMMER]);
  assert.deepEqual(await blocks(page), [TBAR]);
  assert.deepEqual(await rows(page), [LAT, RF, PULLOVER, PREACHER, HAMMER]);
  assert.deepEqual(errors, []);
  await ctx.close();
  ok('Reverse Fly, on screen and untouched, dragged 2 down by its name: T Bar Row takes its place on screen');
}

// a set of Reverse Fly logged: it stays on screen; a row from above it drags below it
{
  const { ctx, page, errors, id } = await open(data({ active: running(PULL, { done: [RF] }) }), '/active');
  await drag(page, id(`jump-${LAT}`), -2 * ROW_SESSION - 10);
  assert.deepEqual(await order(page), [LAT, RF, TBAR, PULLOVER, PREACHER, HAMMER]);
  assert.deepEqual(await blocks(page), [RF], 'Reverse Fly stays');
  assert.deepEqual(await rows(page), [LAT, TBAR, PULLOVER, PREACHER, HAMMER], 'Lat Pulldown above it, the others up next');
  await page.screenshot({ path: `${OUT}/session-started-stays.png` });
  await drag(page, id(`jump-${LAT}`), 2 * ROW_SESSION + 10);
  assert.deepEqual(await order(page), [RF, TBAR, LAT, PULLOVER, PREACHER, HAMMER]);
  assert.deepEqual(await blocks(page), [RF]);
  assert.deepEqual(errors, []);
  await ctx.close();
  ok('with a set of Reverse Fly logged it stays on screen: Lat Pulldown dropped above it shows as a row there, and drags back below T Bar Row');
}

// a superset moves as one, and comes on screen above an untouched exercise
{
  const { ctx, page, errors, id } = await open(data({ active: running(PULL, { superset: [PREACHER, HAMMER] }) }), '/active');
  await id(`jump-${TBAR}`).waitFor();
  assert.deepEqual(await rows(page), [TBAR, LAT, PULLOVER, PREACHER]);
  await drag(page, id(`jump-${PREACHER}`), -4 * ROW_SESSION - 10);
  assert.deepEqual(await order(page), [PREACHER, HAMMER, RF, TBAR, LAT, PULLOVER]);
  assert.deepEqual(await blocks(page), [PREACHER, HAMMER]);
  assert.deepEqual(errors, []);
  await ctx.close();
  ok('the Preacher Curl + Hammer Curl superset dragged to the top moves as one and comes on screen');
}

// ---------- German ----------
{
  const { ctx, page, errors, id } = await open(data({ language: 'de' }), '/template-edit?id=pull', { locale: 'de-DE' });
  assert.deepEqual(await Promise.all(['tpl-folder', 'tpl-notes', 'tpl-pinned'].map((t) => id(t).getAttribute('placeholder'))), ['Ordner', 'Notizen', 'Notiz fürs nächste Mal anheften']);
  await page.screenshot({ path: `${OUT}/editor-fields-de.png` });
  let text = '';
  await drag(page, id(`ex-title-${LAT}`), ROW_EDIT, { during: async () => { text = (await id(`fold-${LAT}`).innerText()).split('\n').slice(0, 2).join('\n'); } });
  assert.match(text, /^Latzug \(Kabelzug\)\n3\sSätze$/);
  assert.deepEqual(await blocks(page), [RF, TBAR, PULLOVER, LAT, PREACHER, HAMMER]);
  assert.deepEqual(errors, []);
  await ctx.close();
  ok(`German: Ordner, Notizen, Notiz fürs nächste Mal anheften; a folded row reads “${text.replace(/\n/g, ' · ')}”`);
}

await browser.close();
console.log(`\n${passed} checks passed`);
