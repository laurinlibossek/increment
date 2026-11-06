// Catalogue upgrades through the real store: first start, v1 data, reload,
// backup restore, custom-name collisions, and the unchanged Search screen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION, makeBackup, familyOf } from '../../core/index.js';

const v1 = JSON.parse(fs.readFileSync(new URL('../fixtures/exercises-v1.json', import.meta.url), 'utf8'));
const OUT = shots('app-exercise-catalogue');
const browser = await launch();
let passed = 0;
const ok = (name) => { passed++; console.log('PASS', name); };
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('increment.data')));
const base = () => ({ exercises: [], workouts: [], templates: [], measurements: [], kv: { settings: { language: 'en', theme: 'light' } } });
async function open(data) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  await page.goto(APP);
  await page.getByTestId('tab-search').waitFor();
  await page.waitForFunction((version) => JSON.parse(localStorage.getItem('increment.data'))?.kv?.meta?.seedVersion === version, SEED_VERSION);
  return { ctx, page, errors };
}
function upgradedData() {
  const data = base();
  data.exercises = structuredClone(v1.exercises);
  data.exercises[0] = { ...data.exercises[0], name: 'Personal bench', hidden: true, restSec: 77 };
  data.exercises.push({ id: 'c-kelso', name: 'Kelso Shrug (Dumbbell)', category: 'machine', bodyPart: 'other', restSec: 99, notes: 'keep' });
  data.kv.meta = { seedVersion: 1, createdAt: 123 };
  data.workouts = [{ id: 'old-workout', name: 'Old pull', startedAt: 1000, endedAt: 2000, templateId: null, exercises: [{ id: 'e', exerciseId: 'c-kelso', sets: [{ id: 's', type: 'normal', w: 25, r: 8 }] }] }];
  data.templates = [{ id: 'old-routine', name: 'Old routine', exercises: [{ exerciseId: 'c-kelso', sets: [{ type: 'normal', w: 20, r: 10 }] }] }];
  return data;
}
function checkUpgrade(actual, before) {
  assert.equal(actual.kv.meta.seedVersion, SEED_VERSION);
  assert.equal(actual.kv.meta.createdAt, 123);
  assert.equal(actual.exercises.length, SEED_EXERCISES.length);
  assert.deepEqual(actual.exercises.find((e) => e.id === before.exercises[0].id), before.exercises[0]);
  assert.deepEqual(actual.exercises.find((e) => e.id === 'c-kelso'), { ...before.exercises.at(-1), family: 'f-kelso-shrug' });
  assert.ok(!actual.exercises.some((e) => e.id === 'x-kelso-shrug-dumbbell'));
  assert.deepEqual(actual.workouts, before.workouts);
  assert.deepEqual(actual.templates, before.templates);
}
try {
  {
    const { ctx, page, errors } = await open(base());
    const data = await stored(page);
    assert.equal(data.exercises.length, SEED_EXERCISES.length);
    assert.ok(data.exercises.every((e) => familyOf(e)));
    ok('first start seeds the whole catalogue; every exercise resolves to a family without a stored family field');
    await page.getByTestId('tab-search').click();
    const search = page.getByTestId('exercise-search');
    await search.fill('keenan');
    await page.getByTestId('exercise-x-keenan-flap-cable').waitFor();
    assert.match(await page.getByTestId('exercise-x-keenan-flap-cable').innerText(), /Keenan Flap \(Cable\)/);
    await search.fill('squat');
    await page.getByTestId('exercise-x-squat-barbell').waitFor();
    await page.getByTestId('exercise-x-squat-smith-machine').waitFor();
    assert.ok(await page.getByTestId('exercise-x-front-squat-barbell').count());
    await page.screenshot({ path: `${OUT}/search-variations.png` });
    ok('Search finds the new names and keeps separate variation rows for PR 1');
    await search.fill('bayesian');
    await page.getByTestId('exercise-x-bayesian-curl-cable').click();
    assert.match(await page.locator('body').innerText(), /Bayesian Curl \(Cable\)/);
    ok('a new catalogue entry opens its own exercise page');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  {
    const before = upgradedData();
    const { ctx, page, errors } = await open(before);
    checkUpgrade(await stored(page), before);
    ok('v1 startup preserves renamed/hidden built-ins, custom identity, settings and workout/routine references');
    await page.reload();
    await page.getByTestId('tab-search').waitFor();
    checkUpgrade(await stored(page), before);
    ok('upgrade is persisted and repeatable after reload');
    // Restore the v1 file through the actual file chooser and confirmation flow.
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
    await page.getByTestId('open-account').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('restore').click()]);
    await chooser.setFiles({ name: 'old-backup.json', mimeType: 'application/json', buffer: Buffer.from(makeBackup(before, '1')) });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('increment.data'))?.kv?.meta?.lastBackupAt > 0);
    await page.waitForTimeout(400);
    assert.ok(dialogs.some((d) => /Backup restored/.test(d)), dialogs.join('\n'));
    checkUpgrade(await stored(page), before);
    ok('restoring a v1 backup adds the catalogue without duplicating a custom exercise or moving its history');
    await page.goto(APP);
    await page.getByTestId('tab-search').waitFor();
    checkUpgrade(await stored(page), before);
    ok('restored family assignment and original custom id survive another reload');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
