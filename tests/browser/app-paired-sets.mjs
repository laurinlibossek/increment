// Left/right sets (#54): only unilateral exercises offer Side (a set already
// tagged keeps it to change or clear); the exercise form's Unilateral switch
// is on and locked for the unilateral exercises we ship, and turns any other
// exercise (built-in or custom) unilateral and back, surviving a reload; routine and workout totals count complete left/right pairs and show
// the rest as unpaired, or every row with Account's "Count left/right sets
// together" off; Sets per muscle always counts pairs. Light, dark and German.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, devices, grantWakeLock, APP, shots, selectTab, openSearch, storedData, waitStored } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION, DAY } from '../../core/index.js';

const OUT = shots('app-paired-sets');
const CURL = 'x-concentration-curl-dumbbell', LEGX = 'x-single-leg-extension-machine', BENCH = 'x-bench-press-barbell';
const PLANK = 'x-side-plank', EXT = 'x-leg-extension-machine', LEGCURL = 'x-single-leg-curl-machine';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const S = (side, type = 'normal') => ({ type, w: 20, r: 8, ...(side ? { side } : {}) });
const rows = (sides) => [...sides].map((x) => S(x === 'L' ? 'left' : x === 'R' ? 'right' : undefined));
const at = Date.now() - DAY;
// the routine: curl L R L R (2 pairs), single-leg extension L L L (no pair), bench 3 (with a warm-up)
const routine = { id: 'pairs', name: 'Pairs', exercises: [
  { exerciseId: CURL, sets: rows('LRLR') }, { exerciseId: LEGX, sets: rows('LLL') }, { exerciseId: BENCH, sets: [S(null, 'warmup'), ...rows('---')] },
] };
// yesterday: curl L R L R and a warm-up (2), extension L L L R (1 pair, 2 unpaired), bench 3
const done = { id: 'done', name: 'Pairs', templateId: 'pairs', startedAt: at, endedAt: at + 3600000, exercises: [
  [CURL, [S(null, 'warmup'), ...rows('LRLR')]], [LEGX, rows('LLLR')], [BENCH, rows('---')],
].map(([exerciseId, sets], i) => ({ id: `e${i}`, exerciseId, sets: sets.map((x, j) => ({ id: `s${i}${j}`, ...x })) })) };
// a bilateral exercise with an old side tag on its first set
const legacy = { id: 'legacy', name: 'Legacy', exercises: [{ exerciseId: BENCH, sets: [S('left'), S()] }] };
// from Strong: a unilateral exercise's routine and workout without sides, each set both legs
const strongRoutine = { id: 'split', name: 'From Strong', exercises: [{ exerciseId: LEGCURL, sets: [S(), S()] }] };
const old = { id: 'old-curl', name: 'From Strong', templateId: null, startedAt: at - 4 * DAY, endedAt: at - 4 * DAY + 3600000, exercises: [
  { id: 'oc', exerciseId: LEGCURL, sets: [{ id: 'oc1', type: 'normal', w: 30, r: 10 }, { id: 'oc2', type: 'normal', w: 32, r: 9 }] },
] };
const data = (language) => ({
  exercises: SEED_EXERCISES, workouts: [done, old], measurements: [], templates: [routine, legacy, strongRoutine],
  kv: { settings: { language, showExamples: false, appKeepAwake: false, defaultRest: 0, askTemplateUpdate: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: Date.now() } },
});

async function open(language, theme) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: language === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data(language)));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const id = (t) => page.getByTestId(t);
  const text = async (t) => (await id(t).innerText()).replace(/\s+/g, ' ').trim();
  const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${language}-${theme}-${name}.png` }); };
  return { ctx, page, errors, id, text, shot };
}
const firstSet = async (page, ex) => (await page.getByTestId(`block-${ex}`).locator('[data-testid^="label-"]').first().getAttribute('data-testid')).slice('label-'.length);
async function hasSide(page, setId) {
  await page.getByTestId(`label-${setId}`).click();
  await page.getByTestId('type-normal').waitFor();
  const n = await page.getByTestId('set-side').count();
  await page.getByTestId('sheet-cancel').click();
  await page.getByTestId('type-normal').waitFor({ state: 'hidden' });
  return n > 0;
}
async function editExercise(page, ex) {
  await page.goto(`${APP}/exercise/${ex}`);
  await page.getByTestId('exercise-options').click();
  await page.getByTestId('ex-edit').click();
  await page.getByTestId('exercise-name').waitFor();
  return page.getByTestId('exercise-unilateral').getByRole('switch');
}
async function setPairing(page, on) {
  await page.goto(`${APP}/account`);
  const toggle = page.getByTestId('set-pair-sides');
  await toggle.scrollIntoViewIfNeeded();
  if ((await toggle.getByRole('switch').isChecked()) !== on) await toggle.click();
  await waitStored(page, (d, v) => (d.kv.settings.pairSides !== false) === v, on);
}

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors, id, text, shot } = await open('en', theme);
  await page.goto(APP);
  // Sets per muscle: pairs within the workout, warm-ups out
  for (const [m, n] of [['chest', 3], ['arms', 2], ['legs', 3]]) assert.match(await text(`muscle-${m}`), new RegExp(` ${n}$`), m);
  // Plan: the routine's prescribed rows, paired; the rest unpaired
  await selectTab(page, 'plan');
  await id('template-pairs').waitFor();
  assert.match(await text('template-facts-pairs'), /· 5 sets · 3 unpaired ·/);
  await shot('plan');
  ok(`${theme}: Sets per muscle counts pairs (arms 2, legs 3 with the Strong workout, chest 3); Plan says “5 sets · 3 unpaired”`);

  await page.goto(`${APP}/template/pairs`);
  assert.match(await text('template-exercise-0'), /2 sets/);
  assert.match(await text('template-exercise-1'), /0 sets · 3 unpaired/);
  assert.match(await text('template-exercise-2'), /3 sets/);
  await shot('routine');
  // the workout: its page and its summary
  await page.goto(`${APP}/workout/done`);
  await id('workout-title').waitFor();
  assert.equal(await text('workout-sets'), 'Sets 6');
  assert.ok(await page.getByText('6 sets · 2 unpaired', { exact: true }).count(), 'the line under the tally');
  await shot('workout');
  await page.goto(`${APP}/summary/done`);
  await id('summary-title').waitFor();
  assert.equal(await text('summary-sets'), 'Sets 6');
  assert.ok(await page.getByText(/^6 sets · 2 unpaired · /).count());
  await page.goto(APP);
  await selectTab(page, 'plan');
  ok(`${theme}: the routine page says “2 sets”, “0 sets · 3 unpaired”, “3 sets”; the workout and its summary “6 sets · 2 unpaired”`);

  // Side: offered on the one-side exercise, not on bench; an old tag on bench still opens it
  await page.goto(`${APP}/template/pairs`);
  await id('start-template').click();
  await page.getByTestId(`block-${CURL}`).waitFor();
  assert.equal(await hasSide(page, await firstSet(page, CURL)), true);
  await id(`jump-${BENCH}`).click();
  await page.getByTestId(`block-${BENCH}`).waitFor();
  const benchIds = await page.getByTestId(`block-${BENCH}`).locator('[data-testid^="label-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('label-'.length)));
  assert.equal(await hasSide(page, benchIds[1]), false, 'bilateral: no Side');
  await id('workout-menu').click();
  await id('menu-discard').click();
  await id('confirm-discard').click().catch(() => {});
  await page.goto(`${APP}/template-edit?id=legacy`);
  await page.getByTestId(`block-${BENCH}`).waitFor();
  const legacyIds = await page.getByTestId(`block-${BENCH}`).locator('[data-testid^="label-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('label-'.length)));
  assert.equal(await hasSide(page, legacyIds[0]), true, 'the tagged set can still change or clear its side');
  assert.equal(await hasSide(page, legacyIds[1]), false);
  ok(`${theme}: Side in the running workout for Concentration Curl, not for Bench Press; the routine editor keeps it on bench's tagged set only`);

  // switching the preference changes the summaries, never Sets per muscle
  await setPairing(page, false);
  await shot('account');
  await page.goto(APP);
  for (const [m, n] of [['chest', 3], ['arms', 2], ['legs', 3]]) assert.match(await text(`muscle-${m}`), new RegExp(` ${n}$`), m);
  await selectTab(page, 'plan');
  assert.match(await text('template-facts-pairs'), /· 10 sets ·/);
  assert.doesNotMatch(await text('template-facts-pairs'), /unpaired/);
  await page.goto(`${APP}/template/pairs`);
  assert.match(await text('template-exercise-1'), /3 sets/);
  await page.goto(`${APP}/workout/done`);
  assert.equal(await text('workout-sets'), 'Sets 11');
  const stored = await storedData(page);
  assert.equal(stored.workouts[0].exercises[1].sets.length, 4, 'the stored rows stay');
  await setPairing(page, true);
  ok(`${theme}: “Count left/right sets together” off counts rows (Plan 10, workout 11, extension 3); Sets per muscle stays 3 / 2 / 3`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

// the exercise form: a shipped unilateral exercise is locked; any other built-in and a custom one toggle
{
  const { ctx, page, errors, id, shot } = await open('en', 'light');
  await page.goto(APP);
  let toggle = await editExercise(page, PLANK);
  assert.equal(await toggle.isChecked(), true, 'Side Plank is unilateral');
  assert.equal(await toggle.isDisabled(), true, 'and can’t be turned off');
  assert.ok(await page.getByText('Always on for this exercise', { exact: true }).count());
  await id('exercise-unilateral').scrollIntoViewIfNeeded();
  await shot('form-locked');
  await id('exercise-save').click();
  await page.waitForTimeout(300);
  assert.equal(Object.hasOwn((await storedData(page)).exercises.find((e) => e.id === PLANK), 'unilateral'), false, 'nothing stored for it');
  toggle = await editExercise(page, EXT);
  assert.equal(await toggle.isChecked(), false, 'Leg Extension (Machine) is bilateral');
  assert.equal(await toggle.isDisabled(), false);
  await id('exercise-unilateral').click();
  await id('exercise-unilateral').scrollIntoViewIfNeeded();
  await shot('form');
  await id('exercise-save').click();
  await waitStored(page, (d) => d.exercises.find((e) => e.id === EXT)?.unilateral === true);
  await page.reload();
  toggle = await editExercise(page, EXT);
  assert.equal(await toggle.isChecked(), true, 'Unilateral survives a reload');
  await id('exercise-unilateral').click();
  await id('exercise-save').click();
  await waitStored(page, (d) => !Object.hasOwn(d.exercises.find((e) => e.id === EXT), 'unilateral'));
  ok('the form: Side Plank’s Unilateral is on and locked; Leg Extension turns unilateral (survives a reload) and back to bilateral (nothing stored)');

  await page.goto(APP);
  await openSearch(page);
  await id('exercise-search').fill('Zebra Reach');
  await id('new-exercise').click();
  await id('exercise-name').waitFor();
  await id('exercise-unilateral').click();
  await id('exercise-save').click();
  const d = await waitStored(page, (x) => x.exercises.some((e) => e.name === 'Zebra Reach'));
  assert.equal(d.exercises.find((e) => e.name === 'Zebra Reach').unilateral, true);
  ok('a new custom exercise can be unilateral');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// the rework (#54): Strong data without sides, the split at start, no Clear, Add set's side, the CSV
{
  const { ctx, page, errors, id, text, shot } = await open('en', 'light');
  await page.goto(APP);
  await selectTab(page, 'plan');
  await id('template-split').waitFor();
  assert.match(await text('template-facts-split'), /· 2 sets · about/, 'no sides: each set covered both legs');
  await page.goto(`${APP}/workout/old-curl`);
  await id('workout-title').waitFor();
  assert.equal(await text('workout-sets'), 'Sets 2');
  assert.ok(await page.getByText('2 sets', { exact: true }).count(), 'the line under the tally: 2 sets, nothing unpaired');
  ok('Strong data without sides: a unilateral exercise counts every set (2 sets, nothing unpaired)');

  await page.goto(`${APP}/template/split`);
  await id('start-template').click();
  await id(`block-${LEGCURL}`).waitFor();
  const ids = await id(`block-${LEGCURL}`).locator('[data-testid^="label-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('label-'.length)));
  assert.equal(ids.length, 4, 'each set became a left and a right one');
  const ghosts = await id(`block-${LEGCURL}`).locator('[data-testid^="in-w-"]').evaluateAll((els) => els.map((e) => e.placeholder));
  assert.deepEqual(ghosts, ['30', '30', '32', '32'], 'last time’s set 1 fills left 1 and right 1');
  const d1 = await waitStored(page, (d) => d.templates.find((t) => t.id === 'split').exercises[0].sets.length === 4);
  assert.deepEqual(d1.templates.find((t) => t.id === 'split').exercises[0].sets.map((x) => x.side), ['left', 'right', 'left', 'right']);
  assert.deepEqual(d1.kv.active.exercises[0].sets.map((x) => x.side), ['left', 'right', 'left', 'right']);
  await shot('split');
  // logging counts a set once both its sides are (#72): two pairs are two working sets, not four
  const tick = async (i) => { await id(`check-${ids[i]}`).click(); await page.waitForTimeout(300); };
  assert.equal(await text('session-count'), '0 of 2 working sets · 0%');
  await tick(0);
  assert.match(await text('session-count'), /^0 of 2 working sets · 0%/, 'one side alone is not a set yet');
  assert.match(await id('session-tally').getAttribute('aria-label'), /^0 of 2 working sets logged, 0%/);
  await tick(1);
  assert.match(await text('session-count'), /^1 of 2 working sets · 50%/);
  await waitStored(page, (d) => d.kv.active.exercises[0].sets.filter((x) => x.done).length === 2);
  await page.goto(APP);
  await id('now-card').waitFor();
  assert.match(await text('now-card'), /1 of 2 working sets · 50%/);
  assert.match(await id('mini-bar').first().innerText(), /Single Leg Curl \(Machine\) · set 2 of 2 · Left/, 'Now Lifting numbers the pair and names the side');
  await id('resume-workout').click();
  await id(`block-${LEGCURL}`).waitFor();
  await tick(2); await tick(3);
  assert.match(await text('session-count'), /^2 of 2 working sets · 100%/);
  await id('workout-menu').click();
  await id('menu-finish').click();
  await id('confirm-finish').waitFor();
  assert.match(await page.locator('body').innerText(), /2 sets logged in/, 'Finish counts as the summary will: two pairs, two sets');
  await id('dialog-cancel').click();
  ok('a left/right pair is one working set: 0 of 2 after one side, 1 of 2 · 50% after both, in the session, on Today and in Now Lifting (“set 2 of 2 · Left”); Finish asks about 2 sets');
  await id(`label-${ids[0]}`).click();
  await id('set-side').click();
  assert.equal(await id('side-clear').count(), 0, 'a unilateral working set keeps a side');
  await id('sheet-cancel').click();
  await id(`add-set-${LEGCURL}`).click();
  await waitStored(page, (d) => d.kv.active.exercises[0].sets.length === 5);
  assert.equal((await storedData(page)).kv.active.exercises[0].sets[4].side, 'left');
  assert.match(await text('session-count'), /^2 of 3 working sets · 66%/, 'a lone left is a set of its own while logging');
  ok('starting it splits each set into Left and Right (saved in the routine) with last time’s numbers on both; no Clear; Add set goes on Left');
  await id('workout-menu').click(); await id('menu-discard').click(); await id('confirm-discard').click().catch(() => {});

  // the CSV: with pairs on, Single Leg Extension's L L L R goes out as one merged row and the two lone lefts
  const csvRows = async () => {
    await page.goto(`${APP}/account`);
    const [file] = await Promise.all([page.waitForEvent('download'), id('export-csv').click()]);
    return fs.readFileSync(await file.path(), 'utf8').split('\n').filter((l) => l.includes('"Single Leg Extension (Machine)"'));
  };
  assert.equal((await csvRows()).length, 3);
  await setPairing(page, false);
  assert.equal((await csvRows()).length, 4, 'pairs off: every side its own row');
  ok('CSV: L L L R of a unilateral exercise is 3 rows with pairs on (one merged), 4 with pairs off');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// German
{
  const { ctx, page, errors, id, text, shot } = await open('de', 'light');
  await page.goto(APP);
  await selectTab(page, 'plan');
  await id('template-pairs').waitFor();
  assert.match(await text('template-facts-pairs'), /· 5 Sätze · 3 ohne Paar ·/);
  await shot('plan');
  await page.goto(`${APP}/account`);
  await id('set-pair-sides').scrollIntoViewIfNeeded();
  assert.ok(await page.getByText('Links und rechts zusammen zählen', { exact: true }).count());
  await shot('account');
  await editExercise(page, PLANK);
  assert.ok(await page.getByText('Unilateral', { exact: true }).count());
  assert.ok(await page.getByText('Bei dieser Übung immer an', { exact: true }).count());
  await id('exercise-unilateral').scrollIntoViewIfNeeded();
  await shot('form');
  ok('German: “5 Sätze · 3 ohne Paar”, “Links und rechts zusammen zählen”, “Unilateral”');
  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
