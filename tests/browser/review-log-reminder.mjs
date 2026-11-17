// Same Account → Workouts view on main and the reminder branch.
// Serve both with --german; APP chooses the build and REVIEW_BEFORE names the captures.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const phase = process.env.REVIEW_BEFORE ? 'before' : 'after';
const out = shots(`log-reminder/${phase}`);
const browser = await launch();
for (const language of ['en', 'de']) for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: language === 'de' ? 'de-DE' : 'en-GB', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((data) => localStorage.setItem('increment.data', JSON.stringify(data)), {
    exercises: SEED_EXERCISES, workouts: [], templates: [], measurements: [],
    kv: { settings: { language, theme }, meta: { seedVersion: SEED_VERSION } },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${APP}/account`);
  await page.getByTestId('set-rest-alert').waitFor();
  await page.getByText(language === 'de' ? 'Trainings' : 'Workouts', { exact: true }).last().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${language}-${theme}.png` });
  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
