// Sets per muscle's breakdown (#89): a muscle's row on Today, a 44 pt touch
// target across the full width, opens the sets behind its number, by exercise (most sets first) and per workout (newest
// first), adding up to the number on Today: warm-ups out, a repeated entry in
// one row, a one-side exercise's pairs with its unpaired row. An exercise's
// name opens the exercise, a workout row the workout; deleting a workout
// updates the breakdown and Today alike. A link to a muscle without sets, or
// to something that isn't one, says so. Light, dark and German.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, writeStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION, DAY, muscleSets } from '../../core/index.js';

const helperBefore = process.env.REVIEW_HELPERS_BEFORE === '1';
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
const exercises = [...SEED_EXERCISES, { id: 'c-old-arms', name: 'Old arms exercise', category: 'machine', bodyPart: 'arms' }];
workouts.push(workout('legacy', 'Old arms', now - DAY, [['c-old-arms', [set(10, 10)]]]));
const lib = new Map(exercises.map((e) => [e.id, e]));
const chest = muscleSets(workouts, lib, 'chest', { now });
const arms = muscleSets(workouts, lib, 'biceps', { now });
assert.deepEqual([chest.sets, arms.sets, arms.unpaired], [11, 4, 1], 'the fixture as planned');

const data = (language) => ({
  exercises, workouts, templates: [], measurements: [],
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

if (!helperBefore) {
for (const theme of ['light', 'dark']) {
  const a = await open('en', theme);
  const { page, id, text } = a;
  await page.goto(`${APP}/`);
  await id('muscle-chest').waitFor();
  assert.equal(await text('muscle-chest'), 'Chest 11');
  assert.equal(await text('muscle-biceps'), 'Biceps 4');
  assert.equal(await text('muscle-arms'), 'Arms 1');
  assert.ok((await id('muscle-arms').boundingBox()).y > (await id('muscle-biceps').boundingBox()).y);
  await openMuscle(a, 'arms');
  assert.equal(await text('muscle-title'), 'Arms');
  assert.equal(await text('muscle-ex-link-c-old-arms'), 'Old arms exercise 1');
  await page.goBack();
  assert.equal(await id('muscle-chest').getAttribute('role'), 'button');
  await id('muscle-chest').scrollIntoViewIfNeeded();
  const before = await id('muscle-chest').boundingBox();
  const armsRow = await id('muscle-biceps').boundingBox();
  const vw = page.viewportSize().width;
  for (const b of [before, armsRow]) assert.ok(b.height >= 44 && b.x === 0 && b.width === vw, `a 44 pt row across the full width: ${JSON.stringify(b)}`);
  const front = await id('muscle-front_delts').boundingBox();
  // only a hairline between neighbouring rows, from the text's margin to the screen's edge (Laurin, 16 Nov 2026)
  const line = await id('volume-line-front_delts').boundingBox();
  const labelX = (await id('muscle-chest').getByText('Chest', { exact: true }).boundingBox()).x;
  assert.ok(line.height > 0 && line.height <= 1 && Math.abs(line.y - (before.y + before.height)) < 0.01 && Math.abs(front.y - (line.y + line.height)) < 0.01,
    `a hairline between Chest and the helper-only Front delts, and nothing else: ${JSON.stringify({ before, line, front })}`);
  assert.ok(Math.abs(line.x - labelX) < 0.5 && Math.abs(line.x + line.width - vw) < 0.5, `inset to the labels, to the edge: ${JSON.stringify(line)}`);
  assert.equal(await page.locator('[data-testid="volume-line-chest"]').count(), 0, 'no line above the first row');
  if (theme === 'light') await a.shot('today');
  await openMuscle(a, 'chest');
  assert.equal(await text('muscle-title'), 'Chest');
  assert.equal(await text('muscle-total'), '11 sets in the last 7 days');
  assert.deepEqual(await order(page, 'muscle-ex-link-'), [INCLINE, BENCH], 'incline (6) before bench (5)');
  assert.equal(await text(`muscle-ex-link-${INCLINE}`), 'Incline Bench Press (Dumbbell) 6');
  assert.equal(await text(`muscle-ex-link-${BENCH}`), 'Bench Press (Barbell) 5');
  assert.deepEqual(await order(page, `muscle-workout-${INCLINE}-`), ['push2', 'push1'], 'newest first');
  // one line per workout: the day, the routine and how many sets; not the weights (Laurin, 17 Nov 2026)
  assert.equal(await text(`muscle-workout-${INCLINE}-push2`), 'Yesterday · Push · 2 sets');
  assert.equal(await id(`muscle-workout-${INCLINE}-push2`).getAttribute('aria-label'), 'Yesterday · Push, 2 sets');
  assert.equal(await text(`muscle-workout-${BENCH}-push2`), 'Yesterday · Push · 3 sets', 'no warm-up; the repeated entry in the same row');
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now - 3 * DAY);
  assert.equal(await text(`muscle-workout-${BENCH}-push1`), `${weekday} · Push · 2 sets`);
  assert.equal(await page.locator('[data-testid^="muscle-group-"]').count(), chest.exercises.some((e) => e.helper) ? 2 : 0, 'group labels only with indirect sets');
  assert.equal(await page.locator('[data-testid="muscle-workout-x-bench-press-barbell-old"]').count(), 0, '10 days ago is out');
  assert.equal(await id('muscle-tally').getAttribute('aria-label'), '11 sets in the last 7 days');
  // the screen adds up to the core's numbers
  for (const e of chest.exercises) {
    assert.equal(await text(`muscle-ex-link-${e.exerciseId}`), `${lib.get(e.exerciseId).name} ${e.sets}`);
    for (const w of e.workouts) assert.match(await id(`muscle-workout-${e.exerciseId}-${w.id}`).getAttribute('aria-label'), new RegExp(`, ${w.sets} sets?( · \\d+ unpaired)?$`));
  }
  assert.ok(!(await page.locator('body').innerText()).includes('\uE5CC'), 'no chevrons on the breakdown (U+E5CC on the web)');
  await a.shot('chest');
  ok(`${theme}: Today’s Chest row (a button, 44 pt tall across the full width, hairlines between rows) opens Chest, without chevrons: 11 sets in the last 7 days, Incline Bench Press 6 then Bench Press 5, each workout newest first with its sets (no warm-up, the repeated entry in one row), adding up to the core’s numbers`);

  // a workout row opens the workout, the exercise's name the exercise; Back returns each time
  await id(`muscle-workout-${BENCH}-push1`).click();
  await page.waitForURL((u) => u.pathname === '/workout/push1');
  assert.equal(await text('workout-title'), 'Push');
  assert.ok(!(await page.locator('body').innerText()).includes('\uE5CC'), 'no chevrons on the workout page');
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
  await openMuscle(a, 'biceps');
  assert.equal(await text('muscle-total'), '4 sets in the last 7 days');
  assert.deepEqual(await order(page, 'muscle-ex-link-'), [CURL, CONC]);
  const twoDays = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now - 2 * DAY);
  assert.equal(await text(`muscle-workout-${CONC}-arms`), `${twoDays} · Arms · 1 set · 1 unpaired`);
  assert.equal(await text(`muscle-ex-link-${CONC}`), 'Concentration Curl (Dumbbell) 1');
  await a.shot('arms');
  ok(`${theme}: Biceps: Bicep Curl 3, Concentration Curl 1 with “1 set · 1 unpaired” on its row`);

  if (theme === 'light') {
    // deleting a workout: the breakdown and Today follow
    await id(`muscle-workout-${CURL}-arms`).click();
    await page.waitForURL((u) => u.pathname === '/workout/arms');
    await id('workout-options').click();
    await id('wo-menu-delete').click();
    await id('confirm-delete').click();
    await page.waitForURL((u) => u.pathname === '/muscle/biceps');
    await id('muscle-empty').waitFor();
    assert.equal(await text('muscle-empty'), 'No sets in the last 7 days.');
    assert.equal(await page.locator('[data-testid^="muscle-ex-"]').count(), 0);
    await page.goBack();
    await id('muscle-chest').waitFor();
    assert.equal(await page.getByTestId('muscle-biceps').count(), 0, 'Today no longer lists Biceps');
    ok('deleting the arms workout from its page: Biceps says “No sets in the last 7 days.” and Today drops the row');

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
  assert.match(await text(`muscle-workout-${BENCH}-push2`), /^Gestern · Push · 3 Sätze$/);
  await a.shot('chest');
  await page.goBack();
  await openMuscle(a, 'biceps');
  assert.match(await text(`muscle-workout-${CONC}-arms`), / · Arms · 1 Satz · 1 ohne Paar$/);
  await a.shot('arms');
  ok('German: Brust, “11 Sätze in den letzten 7 Tagen”, “Gestern · Push · 3 Sätze” and “1 Satz · 1 ohne Paar”');
  assert.deepEqual(a.errors, []);
  await a.ctx.close();
}

}

// Real-size review captures also exercise half totals in both languages/themes.
const helperShots = shots(`helper-muscles/${helperBefore ? 'before' : 'after'}`);
const SQ = 'x-squat-barbell', RDL = 'x-romanian-deadlift-barbell', HIP = 'x-hip-thrust-barbell';
// helper strokes: ink-3, except Strawberry Matcha's pale matcha, which its green strokes don't swallow (Laurin, 17 Nov 2026)
const HELPER_INK = { light: 'rgb(138, 138, 132)', dark: 'rgb(114, 114, 108)', 'strawberry-matcha': 'rgb(152, 174, 132)' };
for (const [language, theme] of [['en', 'light'], ['en', 'dark'], ['de', 'light'], ['de', 'dark'], ['en', 'strawberry-matcha']]) {
  const at = Date.now() - DAY;
  const makeEntry = (exerciseId, n) => ({ exerciseId, sets: Array.from({ length: n }, (_, i) => ({ id: `${exerciseId}-${i}`, type: 'normal', w: 60, r: 8 })) });
  const fixture = {
    exercises: SEED_EXERCISES, templates: [], measurements: [],
    workouts: [{ id: 'lower', name: 'Lower', startedAt: at, endedAt: at + 3600000, exercises: [makeEntry(SQ, 4)] }],
    kv: { settings: { language, theme, showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, lastBackupAt: Date.now() } },
  };
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, viewport: { width: 390, height: 844 }, locale: language === 'de' ? 'de-DE' : 'en-US', colorScheme: theme === 'dark' ? 'dark' : 'light' });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((data) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, fixture);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = (name) => page.getByTestId(name);
  const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: `${helperShots}/${language}-${theme}-${name}.png` }); };
  await page.goto(APP); await id('muscle-quads').waitFor();
  if (!helperBefore) {
    const row = id('muscle-glutes');
    assert.equal(await row.getAttribute('aria-label'), language === 'en' ? 'Glutes, 2 sets' : 'Gesäß, 2 Sätze');
    assert.equal(await row.getByTestId('stroke-helper').count(), 2);
    const rect = await row.getByTestId('stroke-helper').first().boundingBox();
    assert.equal(rect.height, 20, 'a helper is full height, never a warm-up stroke');
    assert.equal(rect.width, 5, 'a helper is a stem, not a pending hairline');
    if (!(helperBefore && theme === 'strawberry-matcha')) {
      const ink = await row.getByTestId('stroke-helper').first().evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.equal(ink, HELPER_INK[theme], `${theme}: helper strokes in stroke-helper`);
    }
  }
  const final = await storedData(page);
  if (!helperBefore) {
    const halfOnly = structuredClone(final);
    halfOnly.workouts[0].exercises = [makeEntry(RDL, 1)];
    await writeStored(page, halfOnly); await page.reload(); await id('muscle-glutes').waitFor();
    assert.equal(await id('muscle-glutes').getAttribute('aria-label'), language === 'en' ? 'Glutes, ½ set' : 'Gesäß, ½ Satz');
    assert.equal(await id('muscle-glutes').getByTestId('stroke-helper').count(), 0, 'a final half has no stroke');
    await id('muscle-glutes').click(); await id('muscle-total').waitFor();
    assert.equal(await id('muscle-total').innerText(), language === 'en' ? '½ set in the last 7 days' : '½ Satz in den letzten 7 Tagen');
  }
  final.workouts[0].exercises.push(makeEntry(RDL, 3), makeEntry(HIP, 4));
  await writeStored(page, final); await page.goto(APP); await page.reload(); await id('muscle-glutes').waitFor();
  if (!helperBefore) {
    assert.equal(await id('muscle-glutes').getAttribute('aria-label'), language === 'en' ? 'Glutes, 7½ sets' : 'Gesäß, 7½ Sätze');
    assert.match(await id('muscle-glutes').innerText(), /7½$/);
    assert.equal(await id('muscle-glutes').getByTestId('stroke-helper').count(), 3, 'remaining half appears only in the number');
  }
  await id('muscle-quads').scrollIntoViewIfNeeded(); await shot('today');
  await id('muscle-glutes').click(); await id('muscle-total').waitFor();
  if (!helperBefore) {
    assert.equal(await id('muscle-total').innerText(), language === 'en' ? '7½ sets in the last 7 days' : '7½ Sätze in den letzten 7 Tagen');
    assert.deepEqual(await order(page, 'muscle-ex-link-'), [HIP, SQ, RDL]);
    assert.match(await id(`muscle-ex-link-${SQ}`).innerText(), /2$/);
    assert.match(await id(`muscle-ex-link-${RDL}`).innerText(), /1½$/);
    assert.ok(await id(`muscle-ex-link-${RDL}`).getByText('1½', { exact: true }).evaluate((el) =>
      el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) && el.scrollWidth <= el.clientWidth), 'the half count stays on one line beside a long German name');
    // Direct sets, then Indirect sets with how they count, instead of a label on each helper
    assert.equal(await id('muscle-group-direct').innerText(), language === 'en' ? 'Direct sets' : 'Direkte Sätze');
    assert.match(await id('muscle-group-indirect').innerText(), language === 'en' ? /^Indirect sets\nExercises where this muscle helps count half a set\.$/ : /^Indirekte Sätze\nÜbungen, bei denen dieser Muskel mithilft, zählen als halber Satz\.$/);
    const [direct, hip, indirect, sq] = await Promise.all(['muscle-group-direct', `muscle-ex-link-${HIP}`, 'muscle-group-indirect', `muscle-ex-link-${SQ}`].map(async (t) => (await id(t).boundingBox()).y));
    assert.ok(direct < hip && hip < indirect && indirect < sq, 'Direct sets heads the hip thrust; Indirect sets heads the squat');
    // big headers led by the tally's stroke for each kind; Direct sets in the logged-set colour
    assert.equal(await id('muscle-group-direct').getByText(language === 'en' ? 'Direct sets' : 'Direkte Sätze').evaluate((el) => getComputedStyle(el).fontSize), '22px', 'Title 2');
    assert.equal(await id('muscle-group-indirect').getByTestId('stroke-helper').count(), 1, 'Indirect sets is led by a helper stroke');
    if (theme === 'strawberry-matcha') {
      assert.equal(await id('muscle-group-direct').getByText('Direct sets').evaluate((el) => getComputedStyle(el).color), 'rgb(85, 128, 58)', 'Direct sets in matcha green');
      assert.equal(await id('muscle-group-indirect').getByTestId('stroke-helper').evaluate((el) => getComputedStyle(el).backgroundColor), HELPER_INK[theme]);
    }
    assert.match(await id(`muscle-workout-${RDL}-lower`).getAttribute('aria-label'), language === 'en' ? /, 1½ sets$/ : /, 1½ Sätze$/, 'the weighted count is read out on the row');
    assert.equal(await id('muscle-tally').getByTestId('stroke-helper').count(), 3);
    await id('muscle-helper-note').waitFor();
  }
  await shot('glutes');
  await page.goto(`${APP}/exercise/${SQ}`); await id('exercise-options').click(); await id('ex-edit').click();
  if (!helperBefore) {
    await id('helper-chest').evaluate((el) => {
      let scroller = el.parentElement;
      while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      if (scroller) scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 110;
    });
    assert.equal(await id('helper-quads').count(), 0);
    assert.equal(await id('helper-glutes').getAttribute('aria-selected'), 'true');
    assert.equal(await id('helper-adductors').getAttribute('aria-selected'), 'true');
  } else await id('part-quads').scrollIntoViewIfNeeded();
  await shot('form');
  if (!helperBefore) ok(`${language}/${theme}: helper-only Glutes, full-height stems in stroke-helper, 7½ total, Direct then Indirect sets, helper form`);
  assert.deepEqual(errors, []); await ctx.close();
}

await browser.close();
console.log(`\n${passed} checks passed`);
