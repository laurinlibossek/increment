// Plan previews each routine (#32) in three levels (#116): the name in
// semibold with when it was last done on its right ("Not done yet" for a new
// one; examples without it), its exercises (three names, then "& N more"), then
// sets · about how long in ink and semibold, and the muscle groups in grey.
// 30 routines, one in a folder, at 375 px, light and dark. About how long
// (#114): from how long the routine took, per working set; a routine not done
// yet from the person's pace in general; with no workouts at all, from the
// sets and their rest.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, selectTab } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION, routineSize, withDefaults } from '../../core/index.js';

const OUT = shots('app-plan-rows');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const day = 86400000, now = Date.now();
const set = (w, r) => ({ type: 'normal', w, r });
const IDS = ['x-squat-barbell', 'x-bench-press-barbell', 'x-pull-up', 'x-deadlift-barbell', 'x-overhead-press-barbell'];
const full = { id: 'full', name: 'Full body with a rather long routine name', lastUsedAt: now - 3 * day, exercises: IDS.map((exerciseId) => ({ exerciseId, sets: [{ type: 'warmup', w: 40, r: 5 }, set(80, 5), set(80, 5)] })) };
const fresh = { id: 'fresh', name: 'New one', exercises: [{ exerciseId: 'x-bench-press-barbell', sets: [set(60, 8)] }] };
const filed = { id: 'filed', name: 'Legs', folder: 'Block A', exercises: [{ exerciseId: 'x-squat-barbell', sets: [set(100, 5), set(100, 5)] }] };
const more = Array.from({ length: 27 }, (_, i) => ({ id: `r${i}`, name: `Routine ${i + 1}`, exercises: [{ exerciseId: IDS[i % 5], sets: [set(50, 10)] }] }));
const templates = [full, fresh, filed, ...more];
// three sessions of Full body, 10 working sets each in 50, 60 and 70 minutes: 6 minutes a set
const session = (d, min) => ({
  id: `full-${d}`, name: full.name, templateId: 'full', startedAt: now - d * day, endedAt: now - d * day + min * 60000,
  exercises: full.exercises.map((e, i) => ({ id: `e${d}${i}`, exerciseId: e.exerciseId, sets: e.sets.map((x, j) => ({ id: `s${d}${i}${j}`, ...x })) })),
});
const workouts = [session(3, 50), session(5, 60), session(7, 70)];
const data = (withHistory) => ({
  exercises: SEED_EXERCISES, workouts: withHistory ? workouts : [], measurements: [], templates,
  kv: { settings: { language: 'en', showExamples: true, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now } },
});
const lib = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const settings = withDefaults(data(true).kv.settings);

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data(true)));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = (t) => page.getByTestId(t);
  const facts = async (t) => (await id(`template-facts-${t}`).innerText()).split('\n');
  await page.goto(APP);
  await selectTab(page, 'plan');
  await id('template-full').waitFor();

  const size = (t) => routineSize(t, lib, { defaultRest: settings.defaultRest, workouts });
  assert.deepEqual([size(full).minutes, size(full).basis, size(filed).minutes, size(filed).basis], [60, 'routine', 10, 'all'], 'the fixture as planned');
  assert.deepEqual(await facts('full'), ['Squat (Barbell), Bench Press (Barbell), Pull Up & 2 more', '10 sets · about 60 min · Chest, Back, Shoulders, Legs']);
  assert.deepEqual(await facts('fresh'), ['Bench Press (Barbell)', '1 set · about 5 min · Chest']);
  assert.deepEqual(await facts('filed'), ['Squat (Barbell)', '2 sets · about 10 min · Legs']);
  assert.deepEqual([await id('template-when-full').innerText(), await id('template-when-fresh').innerText(), await id('template-when-filed').innerText()], ['3 days ago', 'Not done yet', 'Not done yet']);
  ok(`${theme}: rows show their exercises (& 2 more), working sets, minutes and muscles, and last done next to the name; a new one is “Not done yet”; one in a folder too. Minutes (#114): Full body about 60 (its sessions took 6 minutes a set), Legs about 10 (not done yet: 2 sets at your 6 minutes a set)`);

  // three levels (#116): the name semibold in ink, last done on its line and
  // never pushed out by a long name, the exercises a size larger than the facts,
  // whose sets and minutes are semibold in ink and the muscles grey
  const style = (loc, text) => loc.evaluate((el, want) => {
    const hit = want ? [...el.querySelectorAll('*')].find((x) => x.childNodes[0]?.nodeValue === want) : el;
    const cs = getComputedStyle(hit);
    return { weight: cs.fontWeight, size: cs.fontSize, color: cs.color };
  }, text);
  const name = await style(id('template-name-full')), when = await style(id('template-when-full'));
  const [list, line] = await id('template-facts-full').evaluate((el) => [...el.children].map((x) => getComputedStyle(x).fontSize));
  const amount = await style(id('template-facts-full'), '10 sets · about 60 min');
  const muscles = await id('template-facts-full').evaluate((el) => getComputedStyle(el.lastElementChild).color);
  assert.deepEqual([name.weight, name.size, when.weight, when.size, list, line, amount.weight], ['600', '17px', '400', '13px', '15px', '13px', '600']);
  assert.equal(amount.color, name.color, 'sets and minutes in ink');
  assert.equal(muscles, when.color, 'muscles in grey');
  assert.notEqual(name.color, when.color);
  const nb = await id('template-name-full').boundingBox(), wb = await id('template-when-full').boundingBox(), menu = await id('template-menu-full').boundingBox();
  assert.ok(Math.abs(nb.y + nb.height - (wb.y + wb.height)) < 6 && wb.x >= nb.x + nb.width, `last done on the name's line: ${JSON.stringify([nb, wb])}`);
  assert.ok(wb.x + wb.width <= menu.x, 'and before ⋯');
  assert.ok(nb.height < 24, 'the long name stays on one line');
  // the lines stay inside the row at 375 px
  const box = await id('template-facts-full').boundingBox();
  assert.ok(box.x + box.width <= 375, JSON.stringify(box));
  await page.screenshot({ path: `${OUT}/plan-${theme}.png` });
  ok(`${theme}: the name is semibold (17 px) with last done (13 px) on its line before ⋯, the exercises 15 px, the facts 13 px with the sets and minutes semibold in ink and the muscles in grey`);

  // all 30 are there, and the examples have no "last done"
  assert.equal(await page.locator('[data-testid^="template-facts-"]').count() >= 30, true);
  const example = page.locator('[data-testid^="template-facts-"]').last();
  await example.scrollIntoViewIfNeeded();
  const exampleText = await example.innerText();
  assert.doesNotMatch(exampleText, /not done yet|ago|today|yesterday/i);
  assert.match(exampleText, /\n\d+ sets · about \d+ min · /);
  const exampleId = (await example.getAttribute('data-testid')).replace('template-facts-', '');
  assert.equal(await id(`template-when-${exampleId}`).count(), 0);
  ok(`${theme}: 30 routines and the examples, which leave out last done`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

// no workouts at all (a new install): the minutes from the sets and their rest, as before #114
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: 'en-US', colorScheme: 'light' });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data(false)));
  const page = await ctx.newPage();
  await page.goto(APP);
  await selectTab(page, 'plan');
  await page.getByTestId('template-full').waitFor();
  const sz = routineSize(full, lib, { defaultRest: settings.defaultRest, workouts: [] });
  assert.deepEqual([sz.minutes, sz.basis], [35, 'formula'], '10 sets and 5 warm-ups with 2:00 rest');
  assert.match(await page.getByTestId('template-facts-full').innerText(), /\n10 sets · about 35 min · /);
  ok('no workouts yet: Full body says about 35 min, from its sets and their 2:00 rest');
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
