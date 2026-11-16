// Main muscles: seed-3 upgrade, forms, both browsing filters, headers and review.
// REVIEW_BEFORE=1 on main captures the same fixture/screens without new assertions.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, openSearch, storedData, selectTab } from './env.mjs';
import { SEED_EXERCISES, regionOf, DAY } from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(`muscles/${before ? 'before' : 'after'}`);
const browser = await launch();
const SQ = 'x-squat-smith-machine', TRI = 'x-triceps-pushdown-cable';
const oldRegions = {
  'x-close-grip-bench-press-barbell': 'arms', 'x-close-grip-bench-press-smith-machine': 'arms',
  'x-farmer-s-walk-dumbbell': 'full', 'x-back-extension': 'back', 'x-back-extension-barbell': 'back', 'x-back-extension-weighted': 'back',
  'x-deadlift-barbell': 'back', 'x-deadlift-trap-bar': 'back', 'x-sumo-deadlift-barbell': 'back', 'x-deficit-deadlift-barbell': 'back',
  'x-paused-deadlift-barbell': 'back', 'x-rack-pull-barbell': 'back', 'x-reverse-hyperextension-machine': 'back',
  'x-kettlebell-swing': 'full', 'x-external-rotation-dumbbell': 'shoulders', 'x-external-rotation-cable': 'shoulders',
  'x-tibialis-raise': 'legs', 'x-tibialis-raise-machine': 'legs',
};
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };
const sets = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, type: 'normal', w: 30, r: 10 }));
function data(language, theme) {
  const at = Date.now() - DAY;
  return {
    exercises: [...SEED_EXERCISES.map((e) => ({ ...e, bodyPart: oldRegions[e.id] || regionOf(e.bodyPart) })),
      { id: 'c-old-arms', name: 'My arm exercise (Cable)', category: 'machine', bodyPart: 'arms' },
      { id: 'x-glute-bridge', name: 'Glute Bridge', category: 'reps', bodyPart: 'legs', builtin: true }],
    workouts: [{ id: 'push', name: 'Push', startedAt: at, endedAt: at + 3600000,
      exercises: ['x-bench-press-barbell', 'x-overhead-press-barbell', TRI, 'c-old-arms'].map((exerciseId, i) => ({ id: `e${i}`, exerciseId, sets: sets(i === 3 ? 2 : 3) })) }],
    templates: [], measurements: [],
    kv: { settings: { language, theme, showExamples: false, defaultRest: 0, appKeepAwake: false }, meta: { seedVersion: 3, createdAt: 1, lastBackupAt: Date.now() } },
  };
}
for (const language of ['en', 'de']) for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, viewport: { width: 390, height: 844 }, locale: language === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((d) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(d)); }, data(language, theme));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = (x) => page.getByTestId(x);
  const formPosition = async () => id('part-chest').evaluate((el) => {
    let scroller = el.parentElement;
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (scroller) scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 80;
  });
  const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${language}-${theme}-${name}.png` }); };
  await page.goto(APP);
  await id('muscle-chest').scrollIntoViewIfNeeded();
  if (!before) {
    assert.match(await id('muscle-front_delts').innerText(), /Front delts|Vordere Schulter/);
    if (language === 'de') {
      assert.ok(await id('muscle-front_delts').getByText('Vordere Schulter', { exact: true }).evaluate((el) =>
        el.clientHeight > parseFloat(getComputedStyle(el).lineHeight) && el.scrollWidth <= el.clientWidth),
      'The full German muscle label wraps without truncation');
    }
    assert.match(await id('muscle-triceps').innerText(), /Triceps|Trizeps/);
    assert.match(await id('muscle-arms').innerText(), /Arms|Arme/);
    assert.equal((await storedData(page)).kv.meta.seedVersion, 5);
    assert.equal((await storedData(page)).exercises.find((e) => e.id === 'x-glute-bridge').bodyPart, 'glutes', 'a built-in cut in #45 gets its muscle');
    assert.equal((await storedData(page)).exercises.find((e) => e.id === 'c-old-arms').bodyPart, 'arms');
    ok(`${language}/${theme}: a v3 store upgrades built-ins and keeps custom Arms`);
  }
  await shot('today');
  await id(before ? 'muscle-arms' : 'muscle-triceps').click();
  await id('muscle-title').waitFor();
  await shot('breakdown');

  await page.goto(`${APP}/exercises`);
  await id(`lift-${TRI}`).waitFor();
  if (!before) assert.match(await id(`lift-${TRI}`).innerText(), /Triceps|Trizeps/);
  await shot('lifts');

  // Same header, before Legs / after Quads.
  await page.goto(`${APP}/exercise/${SQ}`);
  await id('exercise-equipment').waitFor();
  if (!before) assert.match(await id('exercise-equipment').innerText(), /· (Quads|Quadrizeps)/);
  await shot('exercise');
  await id('exercise-options').click(); await id('ex-edit').click();
  await id(before ? 'part-legs' : 'part-quads').scrollIntoViewIfNeeded();
  if (!before) assert.equal(await id('part-quads').getAttribute('aria-selected'), 'true');
  await id('exercise-cancel').click();

  // Legacy edit has no muscle selected; Save keeps the old region.
  await page.goto(`${APP}/exercise/c-old-arms`);
  await id('exercise-options').click(); await id('ex-edit').click();
  await id(before ? 'part-arms' : 'exercise-legacy-muscle').scrollIntoViewIfNeeded();
  if (!before) {
    assert.equal(await page.locator('[data-testid^="part-"][aria-selected="true"]').count(), 0);
    assert.equal(await id('exercise-legacy-muscle').innerText(), language === 'en' ? 'Counted as Arms until you pick a muscle.' : 'Zählt als Arme, bis du einen Muskel wählst.');
  }
  await formPosition(); await shot('form-old-arms');
  await id('exercise-save').click(); await id('exercise-title').waitFor();
  assert.equal((await storedData(page)).exercises.find((e) => e.id === 'c-old-arms').bodyPart, 'arms');

  await page.goto(APP); await openSearch(page);
  await id('new-exercise').click();
  await id('exercise-name').fill('My Pushdown (Cable)');
  await id('exercise-name').blur();
  if (!before) {
    assert.equal(await page.locator('[data-testid^="part-"][aria-selected="true"]').count(), 0);
    await id('exercise-save').click();
    await page.getByText(language === 'en' ? 'Choose a muscle' : 'Wähle einen Muskel', { exact: true }).waitFor();
    assert.ok(!(await storedData(page)).exercises.some((e) => e.name === 'My Pushdown (Cable)'));
  }
  await id(before ? 'part-arms' : 'part-triceps').scrollIntoViewIfNeeded();
  if (!before) await page.getByText(language === 'en' ? 'Choose a muscle' : 'Wähle einen Muskel', { exact: true }).waitFor({ state: 'hidden' });
  if (!before) {
    // Chest, Core, Full body, Cardio and Other come first, above every region heading.
    const y = async (x) => (await id(x).boundingBox()).y;
    for (const own of ['core', 'full', 'cardio', 'other']) assert.ok(await y(`part-${own}`) < await y('part-lats'), `${own} above Back`);
  }
  await formPosition(); await shot('form-new');
  await id(before ? 'part-arms' : 'part-triceps').click();
  await id('exercise-save').click(); await id('exercise-equipment').waitFor();
  if (!before) {
    assert.match(await id('exercise-equipment').innerText(), /· (Triceps|Trizeps)/);
    assert.equal((await storedData(page)).exercises.find((e) => e.name === 'My Pushdown (Cable)').bodyPart, 'triceps');
    ok(`${language}/${theme}: a new exercise requires a muscle; Triceps saves; a legacy region survives editing`);
  }

  await page.goto(APP); await openSearch(page);
  await id('search-parts-legs').click();
  if (!before) {
    await id('family-f-deadlift').waitFor();
    await id('search-muscles-hamstrings').click();
    assert.equal(await id('family-f-deadlift').count(), 0);
    await id('family-f-romanian-deadlift').waitFor();
    // Real chip boxes, including the second row, are at least 44pt.
    for (const chip of await page.locator('[data-testid^="search-muscles-"]').all()) {
      const box = await chip.boundingBox(); assert.ok(box.height >= 44 && box.width >= 44);
    }
  }
  await shot('search-hamstrings');
  if (!before) {
    await id('exercise-search').fill('deadlift');
    await id('exercise-x-romanian-deadlift-barbell').waitFor();
    assert.equal(await id('exercise-x-deadlift-barbell').count(), 0);
    await id('search-parts-back').click();
    assert.equal(await id('search-muscles-all').getAttribute('aria-selected'), 'true');
    await id('search-parts-legs').click();
    await id('exercise-x-deadlift-barbell').waitFor();
    await id('exercise-search').fill('');
    await id('family-f-deadlift').waitFor();
    ok(`${language}/${theme}: Search Legs includes Deadlift; Hamstrings narrows families and queries; region resets`);
  }

  // Running header and picker use the same muscles/filters.
  await page.goto(APP); await selectTab(page, 'plan');
  await id('plan-add').click(); await id('sheet-dialog').getByTestId('start-empty').click();
  await id('add-exercises').click();
  await id('pick-parts-legs').click();
  if (!before) {
    await id('pick-family-f-deadlift').waitFor();
    await id('pick-muscles-hamstrings').click();
    assert.equal(await id('pick-family-f-deadlift').count(), 0);
    await id('pick-family-f-romanian-deadlift').waitFor();
    await id('pick-search').fill('deadlift');
    await id('pick-x-romanian-deadlift-barbell').waitFor();
    assert.equal(await id('pick-x-deadlift-barbell').count(), 0);
    await id('pick-parts-back').click();
    assert.equal(await id('pick-muscles-all').getAttribute('aria-selected'), 'true');
    await id('pick-parts-legs').click();
    await id('pick-x-deadlift-barbell').waitFor();
    await id('pick-search').fill(''); await id('pick-muscles-hamstrings').click();
  }
  await shot('picker-hamstrings');
  if (!before) await id('pick-muscles-all').click();
  await id('pick-search').fill('Squat Smith');
  await id(`pick-${SQ}`).click(); await id('pick-add').click();
  await id(`block-${SQ}`).waitFor();
  if (!before) assert.match(await id(`last-${SQ}`).innerText(), /· (Quads|Quadrizeps)/);
  await shot('workout');

  await page.goto(APP); await id('open-account').click();
  const csv = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes\n2026-11-01 12:00:00,Review,30m,Leg Curl (Custom Machine),1,30,10,0,0,,\n';
  const [file] = await Promise.all([page.waitForEvent('filechooser'), id('strong-import').click()]);
  await file.setFiles({ name: 'muscle-review.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await id('strong-new-0').click();
  if (!before) assert.match(await id('strong-body-0').innerText(), /Hamstrings|Beinbeuger/);
  await id('strong-body-0').scrollIntoViewIfNeeded(); await shot('strong');
  await id('strong-body-0').click();
  if (!before) {
    assert.equal(await page.locator('[data-testid^="strong-option-"]').count(), 19);
    assert.equal(await id('strong-option-arms').count(), 0);
    assert.match(await id('strong-option-hamstrings').innerText(), /Hamstrings|Beinbeuger/);
    const order = await page.locator('[data-testid^="strong-option-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid').slice(14)));
    assert.deepEqual(order.slice(0, 6), ['chest', 'core', 'full', 'cardio', 'other', 'lats'], 'own-region choices before Back');
    assert.equal(order.at(-1), 'calves');
  }
  await shot('strong-choices');
  if (!before) {
    await id('strong-option-calves').click();
    assert.match(await id('strong-body-0').innerText(), /Calves|Waden/);
  }
  if (!before) ok(`${language}/${theme}: picker filters, workout header, Strong guess and muscle choices`);
  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
