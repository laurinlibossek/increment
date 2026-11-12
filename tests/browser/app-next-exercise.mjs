// Stay on a finished exercise (#60): logging an exercise's last set (a
// superset's last round) keeps it on screen; the Action bar reads "Next:
// {exercise}" and moves on when tapped; one more set and logging it stays
// again; with a rest timer the rest bar shows a small "Next: …" first, and the
// rest ending doesn't move the screen; an earlier exercise skipped is named
// first; after the last exercise it's "Finish workout". Now Lifting names the
// next set in order. Light, dark and German at 375 pt.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-next-exercise');
const BENCH = 'x-bench-press-barbell', SQUAT = 'x-squat-barbell', ROW = 'x-bent-over-row-barbell', CURL = 'x-bicep-curl-dumbbell', PRESS = 'x-overhead-press-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const S = (w, r) => ({ type: 'normal', w, r });
const routine = { id: 'next', name: 'Next', exercises: [
  { exerciseId: BENCH, restSec: 0, sets: [S(80, 8), S(80, 8)] },
  { exerciseId: SQUAT, restSec: 2, sets: [S(100, 5)] },
  { exerciseId: ROW, restSec: 0, supersetId: 'g1', sets: [S(60, 10)] },
  { exerciseId: CURL, restSec: 60, supersetId: 'g1', sets: [S(12, 12)] },
  { exerciseId: PRESS, restSec: 0, sets: [S(40, 8)] },
] };
const data = (language) => ({
  exercises: SEED_EXERCISES, workouts: [], measurements: [], templates: [routine],
  kv: { settings: { language, showExamples: false, appKeepAwake: false, defaultRest: 0 }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: Date.now() } },
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
  const ids = (ex) => id(`block-${ex}`).locator('[data-testid^="label-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('label-'.length)));
  const log = async (setId) => { await id(`check-${setId}`).click(); await page.waitForTimeout(250); };
  const onScreen = async (ex) => (await id(`block-${ex}`).count()) > 0;
  await page.goto(`${APP}/template/next`);
  await id('start-template').click();
  await id(`block-${BENCH}`).waitFor();
  return { ctx, page, errors, id, ids, log, onScreen };
}

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors, id, ids, log, onScreen } = await open('en', theme);
  // no rest timer: the last set keeps the exercise on screen, the bar names the next one
  const [b1, b2] = await ids(BENCH);
  await log(b1);
  assert.equal(await id('log-set').count(), 1, 'a set left: the Log button');
  await log(b2);
  assert.equal(await onScreen(BENCH), true, 'Bench Press stays');
  assert.equal(await onScreen(SQUAT), false);
  assert.equal((await id('next-exercise').innerText()).trim(), 'Next: Squat (Barbell)');
  await page.screenshot({ path: `${OUT}/${theme}-next.png` });
  // one more set: logging it stays again
  await id(`add-set-${BENCH}`).click();
  await page.waitForTimeout(200);
  assert.equal(await id('log-set').count(), 1);
  const [, , b3] = await ids(BENCH);
  await log(b3);
  assert.equal(await onScreen(BENCH), true);
  assert.equal((await id('next-exercise').innerText()).trim(), 'Next: Squat (Barbell)');
  await id('next-exercise').click();
  await id(`block-${SQUAT}`).waitFor();
  assert.equal(await onScreen(BENCH), false);
  ok(`${theme}: the last set keeps Bench Press on screen with “Next: Squat (Barbell)”; one more set stays again; the button moves on`);

  // a rest timer: "Next: …" in the rest bar first; the rest running out doesn't move the screen
  const [q1] = await ids(SQUAT);
  await log(q1);
  assert.equal((await id('rest-next').innerText()).trim(), 'Next: Bent Over Row (Barbell) + Bicep Curl (Dumbbell)');
  await page.screenshot({ path: `${OUT}/${theme}-rest-next.png` });
  await id('rest-bar').waitFor({ state: 'detached', timeout: 6000 });
  assert.equal(await onScreen(SQUAT), true, 'the rest ended, Squat stays');
  assert.match((await id('next-exercise').innerText()).trim(), /^Next: Bent Over Row \(Barbell\) \+ Bicep Curl/);
  ok(`${theme}: with a rest, the rest bar says “Next: …” first; when it runs out the screen stays and the button appears`);

  // a superset stays only after its last round; tapping "Next" in the rest bar moves on, the rest keeps running
  await id('next-exercise').click();
  await id(`block-${ROW}`).waitFor();
  const [r1] = await ids(ROW), [c1] = await ids(CURL);
  await log(r1);
  assert.equal(await id('log-set').count(), 1, 'the round goes on with the curl');
  await log(c1);
  assert.equal(await onScreen(ROW), true);
  assert.equal((await id('rest-next').innerText()).trim(), 'Next: Overhead Press (Barbell)');
  await id('rest-next').click();
  await id(`block-${PRESS}`).waitFor();
  assert.equal(await id('rest-bar').count(), 1, 'the rest keeps running');
  await id('rest-skip').click();
  ok(`${theme}: the superset stays after its round; “Next” in the rest bar moves on while the rest runs`);

  // the last exercise: Finish workout; Now Lifting names the next set in order
  const [p1] = await ids(PRESS);
  await log(p1);
  assert.equal(await id('finish-workout').count(), 1);
  assert.equal(await id('next-exercise').count(), 0);
  ok(`${theme}: after the workout's last exercise, “Finish workout”`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

// an earlier exercise skipped comes first; Now Lifting; German
{
  const { ctx, page, errors, id, ids, log } = await open('de', 'light');
  await id(`jump-${PRESS}`).click();
  await id(`block-${PRESS}`).waitFor();
  const [p1] = await ids(PRESS);
  await log(p1);
  assert.equal((await id('next-exercise').innerText()).trim(), 'Weiter: Bankdrücken (Langhantel)');
  await page.screenshot({ path: `${OUT}/de-light-next.png` });
  // minimized back to the routine page, Now Lifting waits (shown on the tabs) and names the next set in order
  await id('minimize').click();
  await id('mini-bar').waitFor({ state: 'attached' });
  assert.match(await id('mini-bar').getAttribute('aria-label'), /^Bankdrücken \(Langhantel\) · Satz 1 von 2/, 'Now Lifting names the next set in order');
  ok('German: “Weiter: Bankdrücken (Langhantel)” after skipping ahead, the skipped exercise first; Now Lifting names it too');
  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
