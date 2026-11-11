// Progress has Today's Account avatar beside Search (#30), and the web app's
// wording doesn't talk about a phone or iCloud (#42): Account's storage line,
// the empty Workouts screen, and deleting an exercise that is only in the
// workout you're doing now.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, selectTab } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-progress-account');
const MINE = { id: 'c-band-pull', name: 'Band Pull', category: 'reps', bodyPart: 'back', custom: true };
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const now = Date.now();
const data = (name, active) => ({
  exercises: [...SEED_EXERCISES, MINE], workouts: [], templates: [], measurements: [],
  kv: {
    settings: { language: 'en', showExamples: false, appKeepAwake: false },
    meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now },
    profile: { name },
    ...(active ? { active: { id: 'live', kind: 'workout', name: 'Pull', notes: '', startedAt: now - 60000, templateId: null, templateNotes: '', rest: null, updatedAt: now,
      exercises: [{ id: 'e', exerciseId: MINE.id, notes: '', showNotes: false, supersetId: null, restSec: 0, sets: [{ id: 's', type: 'normal', w: '', r: '10', d: '', t: '', rpe: '', done: false }] }] } } : {}),
  },
});

async function open(seed, theme = 'light') {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors, id: (t) => page.getByTestId(t) };
}

// no name: the person symbol and "Account"; it opens the same sheet as Today's
{
  const { ctx, page, errors, id } = await open(data('', false));
  await page.goto(APP);
  await selectTab(page, 'progress');
  const avatar = id('open-account-progress');
  await avatar.waitFor();
  assert.equal(await avatar.getAttribute('aria-label'), 'Account');
  assert.doesNotMatch(await avatar.innerText(), /\p{L}/u, 'the person symbol, no initial');
  // Search and the avatar both fit in the title row at 375 px
  const [search, av] = [await id('open-search-progress').boundingBox(), await avatar.boundingBox()];
  assert.ok(search.x + search.width <= av.x && av.x + av.width <= 375, JSON.stringify({ search, av }));
  await page.screenshot({ path: `${OUT}/progress-light.png` });
  await avatar.click();
  await id('restore').waitFor();
  assert.match(await page.locator('body').innerText(), /Everything stays on this device\. Nothing is uploaded anywhere — back up regularly and keep the file in a safe place\./);
  assert.doesNotMatch(await page.locator('body').innerText(), /this phone|iCloud/);
  ok('Progress: the avatar beside Search opens Account; the web app’s storage line names no phone or iCloud');

  // the empty Workouts screen points to Account, not to Setlog
  await page.goto(`${APP}/history`);
  await id('history-restore').waitFor();
  const empty = await page.locator('body').innerText();
  assert.match(empty, /Finished workouts show up here\. To bring your history over, use Import from Strong or Restore from backup in Account\./);
  assert.doesNotMatch(empty, /Setlog/);
  assert.match(await id('history-restore').innerText(), /Open Account$/);
  await id('history-restore').click();
  await id('restore').waitFor();
  ok('no workouts yet: Workouts says finished workouts show up there and points to Account');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// a name: the initial on both tabs' avatars, dark
{
  const { ctx, page, errors, id } = await open(data('Laurin', false), 'dark');
  await page.goto(APP);
  await selectTab(page, 'progress');
  await id('open-account-progress').waitFor();
  assert.equal(await id('open-account-progress').getAttribute('aria-label'), 'Account, Laurin');
  assert.equal((await id('open-account-progress').innerText()).trim(), 'L');
  assert.equal((await id('open-account').innerText()).trim(), 'L');
  await page.screenshot({ path: `${OUT}/progress-dark.png` });
  ok('with a name, Today’s and Progress’s avatars show its initial');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// an exercise only in the running workout: it says so, not "it's in 0 workouts"
{
  const { ctx, page, errors, id } = await open(data('', true));
  await page.goto(`${APP}/exercise/${MINE.id}`);
  await id('exercise-options').click();
  await id('ex-delete').click();
  await page.getByText('This exercise is in your workout', { exact: true }).waitFor();
  const text = await page.locator('body').innerText();
  assert.match(text, /It’s in the workout you’re doing now\. Remove it there first to delete it, or hide it from lists instead\./);
  assert.doesNotMatch(text, /0 workouts/);
  ok('deleting an exercise that is only in the current workout says it is in that workout');
  assert.deepEqual(errors, []);
  await ctx.close();
}

await browser.close();
console.log(`\n${passed} checks passed`);
