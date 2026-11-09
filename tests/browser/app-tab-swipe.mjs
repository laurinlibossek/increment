// Real touch streams on the phone-sized web build, in both themes. Screenshots
// are frame pairs from the same Today → Plan swipe for PR review.
import assert from 'node:assert/strict';
import { APP, devices, grantWakeLock, launch, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';

const OUT = shots('app-tab-swipe');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'en-US', colorScheme: scheme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((data) => localStorage.setItem('increment.data', JSON.stringify(data)), demoData('en'));
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  const input = await ctx.newCDPSession(page);
  const touch = (type, x, y) => input.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }],
  });
  async function drag(points, delay = 28) {
    await touch('touchStart', ...points[0]);
    for (const p of points.slice(1)) {
      await page.waitForTimeout(delay);
      await touch('touchMove', ...p);
    }
    await touch('touchEnd');
    await page.waitForTimeout(250);
  }
  const line = (x, y, dx, dy = 0, steps = 8) => Array.from({ length: steps + 1 }, (_, i) => [x + dx * i / steps, y + dy * i / steps]);
  const swipe = (direction) => drag(line(direction === 'left' ? 300 : 90, 260, direction === 'left' ? -210 : 210));
  const id = (name) => page.getByTestId(name);
  const path = () => new URL(page.url()).pathname;
  async function selected(tab) {
    const expected = tab === 'index' ? '/' : `/${tab}`;
    await page.waitForURL(APP + expected);
    const background = await id(`tab-${tab}`).evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.notEqual(background, 'rgba(0, 0, 0, 0)', 'the tab bar highlights the selected route');
    assert.equal(await page.getByRole('tab').evaluateAll((els) => els.filter((el) => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)').length), 1);
    assert.equal(await page.locator('[data-testid="mini-bar"]:visible').count(), 1);
  }

  try {
    await page.goto(APP);
    await id('start-suggested').click();
    await id('workout-name').waitFor();
    await id('minimize').click();
    await selected('index');
    await page.screenshot({ path: `${OUT}/${scheme}-01-before-today.png` });
    await swipe('left');
    await selected('plan');
    await page.screenshot({ path: `${OUT}/${scheme}-02-after-plan.png` });
    await swipe('left');
    await selected('progress');
    ok(`${scheme}: touch swipes Today → Plan → Progress select the actual tabs, with Now Lifting on each`);

    await swipe('left');
    await selected('progress');
    await swipe('right');
    await selected('plan');
    await swipe('right');
    await selected('index');
    await swipe('right');
    await selected('index');
    ok(`${scheme}: right swipes go back; swiping past either end does nothing`);

    const content = id('tab-content-index');
    await content.evaluate((el) => { el.scrollTop = 0; });
    await drag(line(195, 390, 2, -240));
    assert.equal(path(), '/');
    assert.ok(await content.evaluate((el) => el.scrollTop) > 40, 'vertical touch really scrolls');
    await content.evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(200);
    await drag(line(240, 260, -18, 10, 5));
    await selected('index');
    await drag([[300, 260], [270, 261], [230, 284], [190, 265], [90, 260]]);
    await selected('index');
    ok(`${scheme}: vertical scrolling, short diagonal drags and a vertical turn after activation never switch`);

    await drag(line(382, 260, -200));
    await selected('index');
    await swipe('left');
    await selected('plan');
    await drag(line(8, 260, 200));
    await selected('plan');
    ok(`${scheme}: swipes starting within 24 px of either screen edge are ignored`);

    await swipe('left');
    await selected('progress');
    const chart = id('weekly-chart');
    await chart.scrollIntoViewIfNeeded();
    const b = await chart.boundingBox();
    const y = b.y + b.height * 0.55;
    await touch('touchStart', b.x + 45, y);
    await id('chart-tip').waitFor();
    const first = await id('chart-tip').innerText();
    for (const p of line(b.x + 45, y, b.width - 80).slice(1)) {
      await page.waitForTimeout(28);
      await touch('touchMove', ...p);
    }
    assert.notEqual(await id('chart-tip').innerText(), first, 'scrubbing selects another week');
    await touch('touchEnd');
    await page.waitForTimeout(250);
    await selected('progress');
    await drag(line(b.x + 45, y, b.width - 40));
    await selected('progress');
    ok(`${scheme}: repeated horizontal chart drags scrub weeks without switching to Plan`);

    // Tab bar taps still work after blocked gestures. Pushed screens, modal
    // sheets, overlays, the workout and editor do not acquire this shortcut.
    await id('tab-index').click();
    await selected('index');
    await id('open-search-index').click();
    await id('exercise-search').waitFor();
    await swipe('left');
    assert.equal(path(), '/search');
    await page.getByRole('link', { name: 'Go back', exact: true }).click();
    await selected('index');
    await id('open-account').click();
    await id('account-done').waitFor();
    await swipe('left');
    assert.equal(path(), '/account');
    await id('account-done').click();
    await page.locator('[data-testid="mini-bar"]:visible').click();
    await id('workout-name').waitFor();
    await swipe('left');
    assert.equal(path(), '/active');
    await id('minimize').click();
    await id('tab-plan').click();
    await id('plan-add').click();
    await id('new-template').waitFor();
    await swipe('left');
    assert.equal(path(), '/plan');
    await id('new-template').click();
    await page.waitForURL(/\/template-edit/);
    await swipe('left');
    assert.equal(path(), '/template-edit');
    ok(`${scheme}: tab taps work; Search, Account, the running workout, an overlay and the routine editor stay on their screen`);
    assert.deepEqual(errors, []);
    ok(`${scheme}: no browser errors`);
  } finally {
    if (errors.length) console.error(errors);
    await ctx.close();
  }
}

await browser.close();
console.log(`${passed} checks passed`);
