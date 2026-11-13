// The rest under the set (#53): the exercise's rest once in the line under its
// name ("Barbell · Chest · Rest 1:30"), and tapping it changes it; while a rest
// runs, a line under the set it follows drains with the time left at its end,
// in step with the Action bar through −15, +15, Skip, expiry and a reload; a
// superset's rest sits under the round's last set; a deleted set or another
// exercise on screen shows none; Reduce Motion steps it once a second. Light
// and dark at 375 pt.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-set-rest');
const BENCH = 'x-bench-press-barbell', ROW = 'x-bent-over-row-barbell', CURL = 'x-bicep-curl-dumbbell', SQUAT = 'x-squat-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const S = (w, r) => ({ type: 'normal', w, r });
const routine = { id: 'rest', name: 'Rest', exercises: [
  { exerciseId: BENCH, restSec: 90, sets: [S(80, 8), S(80, 8), S(80, 8)] },
  { exerciseId: ROW, restSec: 60, supersetId: 'g1', sets: [S(60, 10), S(60, 10)] },
  { exerciseId: CURL, restSec: 60, supersetId: 'g1', sets: [S(12, 12), S(12, 12)] },
  { exerciseId: SQUAT, restSec: 3, sets: [S(100, 5), S(100, 5)] },
] };
const data = {
  exercises: SEED_EXERCISES, workouts: [], measurements: [], templates: [routine],
  kv: { settings: { language: 'en', showExamples: false, appKeepAwake: false, defaultRest: 120 }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: Date.now() } },
};

async function open(theme, reducedMotion = 'no-preference') {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: 'en-US', colorScheme: theme, reducedMotion });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = (t) => page.getByTestId(t);
  const ids = (ex) => id(`block-${ex}`).locator('[data-testid^="label-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('label-'.length)));
  const indicators = () => page.locator('[data-testid^="set-rest-"]:not([data-testid$="-left"])');
  const secs = (text) => { const [m, s] = text.trim().split(':').map(Number); return m * 60 + s; };
  const left = async (setId) => secs(await id(`set-rest-${setId}-left`).innerText());
  const barLeft = async () => secs(await id('rest-left').innerText());
  const log = async (setId) => { await id(`check-${setId}`).click(); await page.waitForTimeout(200); };
  await page.goto(`${APP}/template/rest`);
  await id('start-template').click();
  await id(`block-${BENCH}`).waitFor();
  return { ctx, page, errors, id, ids, indicators, left, barLeft, log };
}

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors, id, ids, indicators, left, barLeft, log } = await open(theme);
  // the rest once, in the line under the name; a tap changes it
  assert.equal((await id(`last-${BENCH}`).innerText()).trim(), 'Barbell · Chest · Rest 1:30');
  await id(`rest-tag-${BENCH}`).click();
  await id('rest-120').click();
  await page.waitForTimeout(200);
  assert.equal((await id(`last-${BENCH}`).innerText()).trim(), 'Barbell · Chest · Rest 2:00');
  ok(`${theme}: “Barbell · Chest · Rest 1:30” under the name; tapping it sets 2:00`);

  // log set 1: the line under it, in step with the Action bar
  const [s1, s2, s3] = await ids(BENCH);
  await log(s1);
  await id(`set-rest-${s1}`).waitFor();
  assert.equal(await indicators().count(), 1, 'one line, under the set just logged');
  const y = async (t) => (await id(t).boundingBox());
  const row1 = await y(`set-${s1}`), line = await y(`set-rest-${s1}`), row2 = await y(`set-${s2}`);
  assert.ok(line.y >= row1.y + row1.height - 1 && line.y + line.height <= row2.y + 1, 'between set 1 and set 2');
  assert.ok(Math.abs(await left(s1) - await barLeft()) <= 1);
  assert.ok(await left(s1) > 110);
  assert.match(await id(`set-rest-${s1}`).getAttribute('aria-label'), /^Rest timer, \d+ seconds left$/);
  await page.screenshot({ path: `${OUT}/${theme}-resting.png` });
  // −15 and +15 move both
  const before = await left(s1);
  await id('rest-minus').click(); await page.waitForTimeout(150);
  assert.ok(Math.abs(await left(s1) - (before - 15)) <= 1, 'minus 15');
  assert.ok(Math.abs(await left(s1) - await barLeft()) <= 1);
  await id('rest-plus').click(); await id('rest-plus').click(); await page.waitForTimeout(150);
  assert.ok(Math.abs(await left(s1) - (before + 15)) <= 1, 'plus 15 twice');
  assert.ok(Math.abs(await left(s1) - await barLeft()) <= 1);
  // a reload keeps it, from the stored times
  await page.reload();
  await id(`set-rest-${s1}`).waitFor();
  assert.ok(Math.abs(await left(s1) - await barLeft()) <= 1);
  ok(`${theme}: logging set 1 puts the rest under it; −15, +15 and a reload keep it in step with the Action bar`);

  // Skip: gone from both
  await id('rest-skip').click();
  await id(`set-rest-${s1}`).waitFor({ state: 'detached' });
  assert.equal(await id('rest-bar').count(), 0);
  // the next set takes it over; deleting that set takes the line away, the Action bar keeps the rest
  await log(s2);
  await id(`set-rest-${s2}`).waitFor();
  assert.equal(await indicators().count(), 1);
  await id(`label-${s2}`).click();
  await id('set-delete').click();
  await id(`set-rest-${s2}`).waitFor({ state: 'detached' });
  assert.equal(await indicators().count(), 0);
  assert.equal(await id('rest-bar').count(), 1, 'the rest itself keeps running');
  await id('rest-skip').click();
  ok(`${theme}: Skip clears both; the next set takes the line over; deleting that set leaves no line, the Action bar keeps the rest`);

  // switching to another exercise during the rest: no line there, the Action bar keeps it
  await log(s3);
  await id(`set-rest-${s3}`).waitFor();
  await id(`jump-${ROW}`).click();
  await id(`block-${ROW}`).waitFor();
  assert.equal(await id('rest-bar').count(), 1);
  assert.equal(await indicators().count(), 0, 'Bench Press is off screen: the rest stays in the Action bar only');
  await id('rest-skip').click();
  // the superset: no rest after the row, the round's rest under the curl's set
  const [r1] = await ids(ROW), [c1] = await ids(CURL);
  await log(r1);
  assert.equal(await id('rest-bar').count(), 0, 'no rest inside the round');
  await log(c1);
  await id(`set-rest-${c1}`).waitFor();
  assert.equal(await indicators().count(), 1);
  assert.equal(await id(`set-rest-${r1}`).count(), 0);
  await page.screenshot({ path: `${OUT}/${theme}-superset.png` });
  await id('rest-skip').click();
  ok(`${theme}: switching to the superset during a rest shows no line there; the round's rest sits under the curl's set only`);

  // expiry: a 3-second rest ends by itself and takes the line with it
  await id(`jump-${SQUAT}`).click();
  await id(`block-${SQUAT}`).waitFor();
  const [q1] = await ids(SQUAT);
  await log(q1);
  await id(`set-rest-${q1}`).waitFor();
  await id(`set-rest-${q1}`).waitFor({ state: 'detached', timeout: 6000 });
  assert.equal(await id('rest-bar').count(), 0);
  ok(`${theme}: a rest that runs out takes its line with it`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

// Reduce Motion: the line steps with the seconds instead of gliding
{
  const { ctx, page, errors, id, ids, left, log } = await open('light', 'reduce');
  const [s1] = await ids(BENCH);
  await log(s1);
  await id(`set-rest-${s1}`).waitFor();
  await page.waitForTimeout(1300);
  const scale = () => id(`set-rest-${s1}`).evaluate((el) => {
    const fill = el.firstElementChild.firstElementChild;
    return new DOMMatrixReadOnly(getComputedStyle(fill).transform).a;
  });
  // two readings within one second are the same (a glide would have moved about 0.004)
  let a, b, same = false;
  for (let i = 0; i < 5 && !same; i++) {
    const t1 = await left(s1); a = await scale(); await page.waitForTimeout(350); b = await scale();
    same = t1 === await left(s1);
  }
  assert.ok(same, 'two readings within one second');
  assert.equal(a, b, 'no glide between them');
  const secsLeft = await left(s1);
  assert.ok(Math.abs(a - secsLeft / 90) <= 0.02, `the line shows ${secsLeft} of 90 s: ${a}`);
  ok('Reduce Motion: the line stands at the seconds left (it steps, it doesn’t glide)');
  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
