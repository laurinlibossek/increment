// Review helper, not a test suite. Run on main's build first, then the branch:
// APP=http://localhost:8791 node tests/browser/exercise-review-shots.mjs before <folder>
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { launch, devices, APP, grantWakeLock } from './env.mjs';
import { SEED_EXERCISES } from '../../core/index.js';
const [stage, output] = process.argv.slice(2);
if (!['before', 'after'].includes(stage) || !output) throw new Error('Pass before|after and an output folder');
fs.mkdirSync(output, { recursive: true });
const browser = await launch();
try {
  for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
    await ctx.addInitScript(grantWakeLock);
    await ctx.addInitScript(({ lang, theme }) => localStorage.setItem('increment.data', JSON.stringify({
      exercises: [], workouts: [], templates: [], measurements: [], kv: { settings: { language: lang, theme } },
    })), { lang, theme });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(APP);
    await page.getByTestId('tab-search').click();
    await page.getByTestId('exercise-x-ab-wheel').waitFor();
    await page.waitForTimeout(300);
    await page.getByTestId('exercise-search').blur();
    await page.waitForTimeout(200);
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('increment.data')));
    assert.equal(data.exercises.length, stage === 'before' ? 190 : SEED_EXERCISES.length);
    await page.screenshot({ path: path.join(output, `${stage}-search-${lang}-${theme}.png`) });
    assert.deepEqual(errors, []);
    console.log(`${stage}: ${lang} ${theme}, ${data.exercises.length} exercises`);
    await ctx.close();
  }
} finally { await browser.close(); }
