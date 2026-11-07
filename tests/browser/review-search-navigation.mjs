// English before/after review captures for the Search navigation change.
// Serve origin/main on :8791 and the changed English build on :8792, then:
//   node tests/browser/review-search-navigation.mjs before http://localhost:8791
//   node tests/browser/review-search-navigation.mjs after http://localhost:8792
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, devices, grantWakeLock, openSearch, ROOT } from './env.mjs';
import { demoData } from './store-demo.mjs';

const [version, base] = process.argv.slice(2);
assert.ok(['before', 'after'].includes(version) && base, 'Pass before|after and the served build URL');
const out = path.join(ROOT, 'docs/dev/review-2026-11-07-search-top-right');
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
try {
  for (const scheme of ['light', 'dark']) {
    const data = demoData('en');
    data.kv.settings.theme = scheme;
    const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US', colorScheme: scheme });
    await context.addInitScript(grantWakeLock);
    await context.addInitScript((json) => {
      if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json);
    }, JSON.stringify(data));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const id = (name) => page.getByTestId(name);
    const shot = async (name) => {
      await page.waitForTimeout(600);
      const file = path.join(out, `${version}-en-${scheme}-${name}.png`);
      await page.screenshot({ path: file });
      console.log(path.relative(ROOT, file));
    };
    await page.goto(base);
    await id('start-suggested').waitFor();
    await shot('today');
    await page.getByRole('tablist').screenshot({ path: path.join(out, `${version}-en-${scheme}-tab-bar.png`) });
    await id('tab-plan').click();
    await id('plan-add').waitFor({ state: 'visible' });
    await shot('plan');
    await id('tab-progress').click();
    await id('last-30').waitFor({ state: 'visible' });
    await shot('progress');
    if (version === 'before') await id('tab-search').click();
    else await openSearch(page);
    await id('exercise-search').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'exercise-search');
    await shot('search');
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
