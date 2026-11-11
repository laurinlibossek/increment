// Screens with dates move on with the day (#36): at midnight while the app is
// open, and when it comes back to the foreground days later. Uses Playwright's
// clock, so no real waiting; the data never changes.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, selectTab } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-day-change');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

// Monday 9 November 2026, two minutes to midnight (local time)
const monday = new Date(2026, 10, 9, 23, 58, 0);
const morning = new Date(2026, 10, 9, 8, 0, 0).getTime();
const data = {
  exercises: SEED_EXERCISES,
  workouts: [{ id: 'mon', name: 'Arms', startedAt: morning, endedAt: morning + 45 * 60000, templateId: 'arms',
    exercises: [{ id: 'e', exerciseId: 'x-bench-press-barbell', sets: [{ id: 's', type: 'normal', w: 60, r: 8 }] }] }],
  templates: [{ id: 'arms', name: 'Arms', lastUsedAt: morning + 45 * 60000, exercises: [{ exerciseId: 'x-bench-press-barbell', sets: [{ type: 'normal', w: 60, r: 8 }] }] }],
  measurements: [],
  kv: { settings: { language: 'en', showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: morning } },
};

const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone });
await ctx.addInitScript(grantWakeLock);
await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.clock.install({ time: monday });
await page.goto(APP);
await page.getByTestId('tab-index').waitFor();
const before = await storedData(page);
const eyebrow = (text) => page.getByText(text, { exact: true }).first().waitFor();
const routine = () => page.getByTestId('template-arms').innerText();

await eyebrow('Monday, November 9');
await selectTab(page, 'plan');
assert.match(await routine(), /today/);

// midnight passes while the app is open
await page.clock.runFor('03:00');
await page.getByTestId('template-arms').getByText(/yesterday/).waitFor();
await selectTab(page, 'index');
await eyebrow('Tuesday, November 10');
await page.screenshot({ path: `${OUT}/after-midnight.png` });
ok('at midnight Today shows the new date and Plan says yesterday, without a reload');

// the phone was in a pocket until Friday morning: the timer didn't run, coming back catches up
await page.clock.setSystemTime(new Date(2026, 10, 13, 9, 0, 0));
for (const state of ['hidden', 'visible']) {
  await page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}
await eyebrow('Friday, November 13');
await selectTab(page, 'plan');
assert.doesNotMatch(await routine(), /today|yesterday/);
ok('coming back to the app days later shows the right day everywhere');

assert.deepEqual(await storedData(page), before, 'only the screens change, not the data');
assert.deepEqual(errors, []);
await ctx.close();

// Daylight saving: Sunday 29 March 2026 has 23 hours in Berlin. The next change comes at the
// next midnight, not 24 hours later (which would still show Sunday at 00:01 on Monday).
{
  const c = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: 'Europe/Berlin' });
  await c.addInitScript(grantWakeLock);
  await c.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
  const p = await c.newPage();
  await p.clock.install({ time: new Date('2026-03-28T23:58:00+01:00') });
  await p.goto(APP);
  await p.getByText('Saturday, March 28', { exact: true }).first().waitFor();
  await p.clock.runFor('03:00');
  await p.getByText('Sunday, March 29', { exact: true }).first().waitFor();
  await p.clock.runFor('23:00:00'); // 00:01 CET + 23 hours = 00:01 CEST on Monday
  await p.getByText('Monday, March 30', { exact: true }).first().waitFor();
  await c.close();
  ok('across the switch to summer time the day still changes at midnight');
}
await browser.close();
console.log(`\n${passed} checks passed`);
