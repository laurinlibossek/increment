// Export measurements as CSV (#29): Account → Your data has it under "Export
// workouts as CSV"; it downloads increment-measurements-<date>.csv, one file in
// the five columns of Strong's measurement export, byte for byte the core's golden
// files: kg and cm, or lb and in when the lifting units are lb and mi (body weight
// and sizes follow them unless set apart). The type names stay English in German.
// Light, dark and German.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, shots, HERE } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';
import { EXPORT_MEASUREMENTS } from '../fixtures/measurements-export.mjs';

const OUT = shots('app-measure-csv');
const golden = (name) => fs.readFileSync(path.join(HERE, '..', 'fixtures', name), 'utf8');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const data = (language, settings = {}, measurements = EXPORT_MEASUREMENTS) => ({
  exercises: SEED_EXERCISES, workouts: [], templates: [], measurements,
  kv: { settings: { language, showExamples: false, appKeepAwake: false, ...settings }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: Date.now() } },
});

async function open(seed, language, theme) {
  // the golden files are in UTC; the CSV writes the phone's local time
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: language === 'de' ? 'de-DE' : 'en-US', colorScheme: theme, timezoneId: 'UTC' });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = (t) => page.getByTestId(t);
  return { ctx, page, errors, id };
}

async function exportFile(page, id) {
  await page.goto(`${APP}/account`);
  await id('export-measurements-csv').scrollIntoViewIfNeeded();
  const [file] = await Promise.all([page.waitForEvent('download'), id('export-measurements-csv').click()]);
  assert.match(file.suggestedFilename(), /^increment-measurements-\d{4}-\d\d-\d\d\.csv$/);
  return fs.readFileSync(await file.path(), 'utf8');
}

// kg and cm (the defaults), light
{
  const { ctx, page, errors, id } = await open(data('en'), 'en', 'light');
  const csv = await exportFile(page, id);
  assert.equal(csv, golden('measurements-export-kg-cm.csv'));
  await page.getByText('CSV exported', { exact: true }).waitFor();
  assert.equal(await id('export-csv').getByText('Export workouts as CSV', { exact: true }).count(), 1, 'the workouts’ export says so now');
  await page.waitForTimeout(2500); // the toast gone
  await page.screenshot({ path: `${OUT}/en-light-account.png` });
  ok('Account → Export measurements as CSV downloads every measurement in Strong’s five columns, oldest first, kg and cm (the golden file)');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// lb and mi lifting units: body weight in lb, sizes in in; dark
{
  const { ctx, page, errors, id } = await open(data('en', { unit: 'lb', distUnit: 'mi' }), 'en', 'dark');
  assert.equal(await exportFile(page, id), golden('measurements-export-lb-in.csv'));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/en-dark-account.png` });
  ok('with lb and mi, body weight goes out in lb and sizes in in (the lb/in golden file); body fat and calories as they are');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// body weight and sizes set apart from the lifting units; nothing logged: the header only
{
  const { ctx, page, errors, id } = await open(data('en', { unit: 'lb', distUnit: 'mi', bodyUnit: 'kg', sizeUnit: 'cm' }), 'en', 'light');
  assert.equal(await exportFile(page, id), golden('measurements-export-kg-cm.csv'));
  await ctx.close();
  const empty = await open(data('en', {}, []), 'en', 'light');
  assert.equal(await exportFile(empty.page, empty.id), 'Date,Measurement Type,Value,Unit,Source\n');
  ok('Account’s own body-weight and size units win over the lifting units; no measurements: the header only');
  assert.deepEqual([...errors, ...empty.errors], []);
  await empty.ctx.close();
}

// German: the rows in German, the file's names still English
{
  const { ctx, page, errors, id } = await open(data('de'), 'de', 'light');
  const csv = await exportFile(page, id);
  assert.equal(csv, golden('measurements-export-kg-cm.csv'), 'Weight, Body Fat … in every language');
  await page.getByText('CSV exportiert', { exact: true }).waitFor();
  assert.equal(await id('export-measurements-csv').getByText('Messwerte als CSV exportieren', { exact: true }).count(), 1);
  assert.equal(await id('export-csv').getByText('Trainings als CSV exportieren', { exact: true }).count(), 1);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/de-light-account.png` });
  ok('German: “Messwerte als CSV exportieren” and “Trainings als CSV exportieren”; the file is the same, its names English');
  assert.deepEqual(errors, []);
  await ctx.close();
}

await browser.close();
console.log(`\n${passed} checks passed`);
