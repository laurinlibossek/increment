// Sets per muscle's breakdown (#89): a muscle's row on Today opens the sets
// behind its number, by exercise (most sets first) and per workout (newest
// first), adding up to the number on Today: warm-ups out, a repeated entry in
// one row, a one-side exercise's pairs with its unpaired row. An exercise's
// name opens the exercise, a workout row the workout; deleting a workout
// updates the breakdown and Today alike. A link to a muscle without sets, or
// to something that isn't one, says so. Light, dark and German.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION, DAY, muscleSets } from '../../core/index.js';

const OUT = shots('app-muscle-sets');
const BENCH = 'x-bench-press-barbell', INCLINE = 'x-incline-bench-press-dumbbell', CURL = 'x-bicep-curl-dumbbell', CONC = 'x-concentration-curl-dumbbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const now = Date.now();
const set = (w, r, extra = {}) => ({ type: 'normal', w, r, ...extra });
const workout = (id, name, startedAt, entries) => ({
  id, name, templateId: null, startedAt, endedAt: startedAt + 3600000,
  exercises: entries.map(([exerciseId, sets], i) => ({ id: `${id}e${i}`, exerciseId, sets: sets.map((x, j) => ({ id: `${id}s${i}${j}`, ...x })) })),
});
const workouts = [
  // yesterday: bench with a warm-up, then again at the end (one row of 3); incline 2
  workout('push2', 'Push', now - DAY, [
    [BENCH, [{ type: 'warmup', w: 40, r: 10 }, set(80, 8), set(80, 7)]], [INCLINE, [set(30, 10), set(30, 9)]], [BENCH, [set(70, 10)]],
  ]),
  // 2 days ago: concentration curl L R L (1 pair, 1 unpaired), bicep curl 3
  workout('arms', 'Arms', now - 2 * DAY, [
    [CONC, [set(12, 10, { side: 'left' }), set(12, 10, { side: 'right' }), set(12, 8, { side: 'left' })]], [CURL, [set(14, 10), set(14, 9), set(14, 8)]],
  ]),
  // 3 days ago: incline 4, bench 2
  workout('push1', 'Push', now - 3 * DAY, [[INCLINE, [set(28, 10), set(28, 10), set(28, 9), set(28, 8)]], [BENCH, [set(77.5, 8), set(77.5, 8)]]]),
  // 10 days ago: outside the 7 days
  workout('old', 'Push', now - 10 * DAY, [[BENCH, [set(75, 8), set(75, 8), set(75, 8), set(75, 8), set(75, 8)]]]),
];
const lib = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const chest = muscleSets(workouts, lib, 'chest', { now });
const arms = muscleSets(workouts, lib, 'arms', { now });
assert.deepEqual([chest.sets, arms.sets, arms.unpaired], [11, 4, 1], 'the fixture as planned');

const data = (language) => ({
  exercises: SEED_EXERCISES, workouts, templates: [], measurements: [],
  kv: { settings: { language, showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: Date.now() } },
});

async function open(language, theme) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: language === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data(language)));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = (t) => page.getByTestId(t);
  const text = async (t) => (await id(t).innerText()).replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim(); // icons are private-use glyphs
  const shot = async (name) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${language}-${theme}-${name}.png` }); };
  const path = () => new URL(page.url()).pathname;
  return { ctx, page, errors, id, text, shot, path };
}

/** Today's muscle row, in view, then tapped: the breakdown. */
async function openMuscle(a, muscle) {
  await a.id(`muscle-${muscle}`).scrollIntoViewIfNeeded();
  await a.id(`muscle-${muscle}`).click();
  await a.page.waitForURL((u) => u.pathname === `/muscle/${muscle}`);
  await a.id('muscle-title').waitFor();
}
const order = (page, prefix) => page.locator(`[data-testid^="${prefix}"]`).evaluateAll((els, p) => els.map((el) => el.getAttribute('data-testid').slice(p.length)), prefix);

for (const theme of ['light', 'dark']) {
  const a = await open('en', theme);
  const { page, id, text } = a;
  await page.goto(`${APP}/`);
  await id('muscle-chest').waitFor();
  assert.equal(await text('muscle-chest'), 'Chest 11');
  assert.equal(await id('muscle-chest').getAttribute('role'), 'button');
  await id('muscle-chest').scrollIntoViewIfNeeded();
  const before = await id('muscle-chest').boundingBox();
  if (theme === 'light') await a.shot('today');
  await openMuscle(a, 'chest');
  assert.equal(await text('muscle-title'), 'Chest');
  assert.equal(await text('muscle-total'), '11 sets in the last 7 days');
  assert.deepEqual(await order(page, 'muscle-ex-link-'), [INCLINE, BENCH], 'incline (6) before bench (5)');
  assert.equal(await text(`muscle-ex-link-${INCLINE}`), 'Incline Bench Press (Dumbbell) 6');
  assert.equal(await text(`muscle-ex-link-${BENCH}`), 'Bench Press (Barbell) 5');
  assert.deepEqual(await order(page, `muscle-workout-${INCLINE}-`), ['push2', 'push1'], 'newest first');
  assert.equal(await text(`muscle-workout-${INCLINE}-push2`), 'Yesterday · Push 30 kg × 10 · 30 kg × 9 2');
  assert.equal(await text(`muscle-workout-${BENCH}-push2`), 'Yesterday · Push 80 kg × 8 · 80 kg × 7 · 70 kg × 10 3', 'no warm-up; the repeated entry in the same row');
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now - 3 * DAY);
  assert.equal(await text(`muscle-workout-${BENCH}-push1`), `${weekday} · Push 77.5 kg × 8 · 77.5 kg × 8 2`);
  assert.equal(await page.locator('[data-testid="muscle-workout-x-bench-press-barbell-old"]').count(), 0, '10 days ago is out');
  assert.equal(await id('muscle-tally').getAttribute('aria-label'), '11 sets in the last 7 days');
  // the screen adds up to the core's numbers
  for (const e of chest.exercises) {
    assert.equal(await text(`muscle-ex-link-${e.exerciseId}`), `${lib.get(e.exerciseId).name} ${e.sets}`);
    for (const w of e.workouts) assert.match(await text(`muscle-workout-${e.exerciseId}-${w.id}`), new RegExp(` ${w.sets}$`));
  }
  await a.shot('chest');
  ok(`${theme}: Today’s Chest row (a button) opens Chest: 11 sets in the last 7 days, Incline Bench Press 6 then Bench Press 5, each workout newest first with its sets (no warm-up, the repeated entry in one row), adding up to the core’s numbers`);

  // a workout row opens the workout, the exercise's name the exercise; Back returns each time
  await id(`muscle-workout-${BENCH}-push1`).click();
  await page.waitForURL((u) => u.pathname === '/workout/push1');
  assert.equal(await text('workout-title'), 'Push');
  await page.goBack();
  await id(`muscle-ex-link-${INCLINE}`).click();
  await page.waitForURL((u) => u.pathname === `/exercise/${INCLINE}`);
  await page.goBack();
  await id('muscle-title').waitFor();
  assert.equal(a.path(), '/muscle/chest');
  await page.goBack();
  await id('muscle-chest').waitFor();
  assert.equal(a.path(), '/');
  const after = await id('muscle-chest').boundingBox();
  assert.ok(after && before && Math.abs(after.y - before.y) < 2, `Today keeps its scroll position (${before?.y} → ${after?.y})`);
  ok(`${theme}: a workout row opens the workout and the exercise’s name the exercise; Back returns to Chest, then to Today where it was`);

  // arms: a one-side exercise's pair, with its unpaired row
  await openMuscle(a, 'arms');
  assert.equal(await text('muscle-total'), '4 sets in the last 7 days');
  assert.deepEqual(await order(page, 'muscle-ex-link-'), [CURL, CONC]);
  const twoDays = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now - 2 * DAY);
  assert.equal(await text(`muscle-workout-${CONC}-arms`), `${twoDays} · Arms Left 12 kg × 10 · Right 12 kg × 10 · Left 12 kg × 8 1 unpaired 1`);
  assert.equal(await text(`muscle-ex-link-${CONC}`), 'Concentration Curl (Dumbbell) 1');
  await a.shot('arms');
  ok(`${theme}: Arms: Bicep Curl 3, Concentration Curl 1 with Left/Right on its rows and “1 unpaired”`);

  if (theme === 'light') {
    // deleting a workout: the breakdown and Today follow
    await id(`muscle-workout-${CURL}-arms`).click();
    await page.waitForURL((u) => u.pathname === '/workout/arms');
    await id('workout-options').click();
    await id('wo-menu-delete').click();
    await id('confirm-delete').click();
    await page.waitForURL((u) => u.pathname === '/muscle/arms');
    await id('muscle-empty').waitFor();
    assert.equal(await text('muscle-empty'), 'No sets in the last 7 days.');
    assert.equal(await page.locator('[data-testid^="muscle-ex-"]').count(), 0);
    await page.goBack();
    await id('muscle-chest').waitFor();
    assert.equal(await page.getByTestId('muscle-arms').count(), 0, 'Today no longer lists Arms');
    ok('deleting the arms workout from its page: Arms says “No sets in the last 7 days.” and Today drops the row');

    // links to a muscle without sets, and to something that isn't a muscle
    await page.goto(`${APP}/muscle/legs`);
    await id('muscle-empty').waitFor();
    assert.equal(await text('muscle-title'), 'Legs');
    assert.equal(await id('muscle-total').count(), 0);
    await page.goto(`${APP}/muscle/cardio`);
    await id('muscle-empty').waitFor();
    assert.equal(await id('muscle-title').count(), 0);
    ok('a link to Legs (no sets) or to cardio (not a muscle): “No sets in the last 7 days.”');
  }
  assert.deepEqual(a.errors, []);
  await a.ctx.close();
}

// German
{
  const a = await open('de', 'light');
  const { page, id, text } = a;
  await page.goto(`${APP}/`);
  await id('muscle-chest').waitFor();
  assert.equal(await text('muscle-chest'), 'Brust 11');
  await a.shot('today');
  await openMuscle(a, 'chest');
  assert.equal(await text('muscle-title'), 'Brust');
  assert.equal(await text('muscle-total'), '11 Sätze in den letzten 7 Tagen');
  assert.match(await text(`muscle-workout-${BENCH}-push2`), /^Gestern · Push 80 kg × 8 · 80 kg × 7 · 70 kg × 10 3$/);
  await a.shot('chest');
  await page.goBack();
  await openMuscle(a, 'arms');
  assert.match(await text(`muscle-workout-${CONC}-arms`), / · Arms Links 12 kg × 10 · Rechts 12 kg × 10 · Links 12 kg × 8 1 ohne Paar 1$/);
  await a.shot('arms');
  ok('German: Brust, “11 Sätze in den letzten 7 Tagen”, Gestern · Push, Links/Rechts and “1 ohne Paar”');
  assert.deepEqual(a.errors, []);
  await a.ctx.close();
}

await browser.close();
console.log(`\n${passed} checks passed`);
