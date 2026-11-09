// Browser-owned touch scrolling, not mouse drags or mocked swipe callbacks.
// The middle of cards/rows must scroll the actual scroll-snap container.
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
  // Also exercise the quiet-scroll fallback used by older iPhone Safari.
  if (scheme === 'dark') await ctx.addInitScript(() => { delete HTMLElement.prototype.onscrollend; });
  await ctx.addInitScript((data) => {
    if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data));
  }, demoData('en'));
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  const input = await ctx.newCDPSession(page);
  const id = (name) => page.getByTestId(name);
  const pager = id('tab-pager');
  const tabPage = (tab) => id(`tab-page-${tab}`);
  const scroll = (tab) => tabPage(tab).getByTestId('tab-scroll');
  const path = () => new URL(page.url()).pathname;
  const observeScroll = () => pager.evaluate((el) => {
    window.__pagerFrames = [];
    el.addEventListener('scroll', () => window.__pagerFrames.push({
      x: el.scrollLeft, path: location.pathname,
      selected: document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid'),
    }), { passive: true });
  });
  async function gesture({ x = 295, y = 200, dx = 0, dy = 0, speed = 450 } = {}) {
    await input.send('Input.synthesizeScrollGesture', {
      x, y, xDistance: dx, yDistance: dy, speed, preventFling: true, gestureSourceType: 'touch',
    });
  }
  async function selected(tab) {
    const expected = tab === 'index' ? '/' : `/${tab}`;
    await page.waitForURL(APP + expected);
    await page.waitForFunction((name) => {
      const pager = document.querySelector('[data-testid="tab-pager"]');
      const page = document.querySelector(`[data-testid="tab-page-${name}"]`);
      return pager && page && Math.abs(page.getBoundingClientRect().left - pager.getBoundingClientRect().left) < 1;
    }, tab);
    assert.equal(await id(`tab-${tab}`).getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('tabpanel').count(), 1, 'only the settled page is accessible');
  }
  async function swipe(direction, target) {
    await gesture({ x: direction === 'left' ? 295 : 95, y: 220, dx: direction === 'left' ? -250 : 250 });
    await selected(target);
  }

  try {
    await page.goto(APP);
    await id('up-next').waitFor();
    await selected('index');
    assert.equal(await pager.evaluate((el) => getComputedStyle(el).scrollSnapType), 'x mandatory');
    assert.equal(await page.locator('[data-testid^="tab-page-"]').count(), 3);
    for (const tab of ['index', 'plan', 'progress']) {
      assert.ok(await tabPage(tab).evaluate((el) => el.getBoundingClientRect().width) > 350);
      assert.ok(await tabPage(tab).getByTestId('tab-scroll').count(), 'every page is mounted');
      assert.ok(await scroll(tab).evaluate((el) => el.getBoundingClientRect().height) > 300, 'unvisited page content is already laid out');
    }
    const card = await id('up-next').boundingBox();
    const cardY = card.y + 65; // inside the tappable routine body, not the margin/Start button
    await gesture({ x: card.x + card.width * 0.75, y: cardY, dx: -250 });
    await selected('plan');
    await swipe('left', 'progress'); // begins on the Workouts/Lifts rows
    await swipe('right', 'plan');
    await swipe('right', 'index');
    ok(`${scheme}: real touch scrolls from the routine card and rows, Today → Plan → Progress and back, updating routes and the bar`);

    await swipe('right', 'index');
    await id('tab-progress').click();
    await selected('progress');
    await swipe('left', 'progress');
    await id('tab-index').click();
    await selected('index');
    ok(`${scheme}: browser snapping respects both ends without wrapping`);

    // Observe real intermediate scroll positions: the page follows the finger,
    // but address/highlight must stay on Today until a new page settles.
    await observeScroll();
    await gesture({ x: 280, y: cardY, dx: -185, speed: 100 });
    await selected('index');
    const frames = await page.evaluate(() => window.__pagerFrames.splice(0));
    assert.ok(frames.some((f) => f.x > 70 && f.x < 200), 'content moved part way with the touch');
    assert.ok(frames.every((f) => f.path === '/' && f.selected === 'tab-index'), 'no premature selection');
    ok(`${scheme}: a slow partial half swipe follows the finger and snaps back on release`);

    // A plain tap still opens the same card and the normal Back returns here.
    await id('up-next').getByRole('button').first().tap();
    await page.waitForURL(/\/template\//);
    await page.getByRole('link', { name: 'Go back', exact: true }).click();
    await selected('index');
    await id('tab-plan').click();
    await selected('plan');
    await tabPage('plan').locator('[data-testid^="template-"]').first().tap();
    await page.waitForURL(/\/template\//);
    await page.getByRole('link', { name: 'Go back', exact: true }).click();
    await selected('plan');
    ok(`${scheme}: tapping a routine card or row still opens it; pushed screens return to their tab`);

    await id('tab-index').click();
    await selected('index');
    await gesture({ x: 190, y: 470, dy: -260 });
    assert.equal(path(), '/');
    const todayY = await scroll('index').evaluate((el) => el.scrollTop);
    assert.ok(todayY > 40, 'the page really scrolls vertically');
    await id('tab-plan').click();
    await selected('plan');
    await id('tab-index').click();
    await selected('index');
    assert.ok(Math.abs(await scroll('index').evaluate((el) => el.scrollTop) - todayY) < 2);
    ok(`${scheme}: vertical scrolling stays in its page and survives visiting another tab`);

    await pager.evaluate(() => { window.__pagerFrames = []; });
    await id('tab-progress').click();
    await selected('progress');
    const smooth = await page.evaluate(() => window.__pagerFrames.splice(0));
    assert.ok(smooth.some((f) => f.x > 390 && f.x < 775), 'tab tap scrolls smoothly through intermediate positions');
    const chart = id('weekly-chart');
    await chart.scrollIntoViewIfNeeded();
    assert.equal(await chart.evaluate((el) => getComputedStyle(el).touchAction), 'pan-y');
    const b = await chart.boundingBox();
    const y = b.y + b.height * 0.55;
    await gesture({ x: b.x + 65, y, dx: 225 });
    await id('chart-tip').waitFor();
    const right = await id('chart-tip').innerText();
    await gesture({ x: b.x + b.width - 40, y, dx: -225 });
    await id('chart-tip').waitFor();
    assert.notEqual(await id('chart-tip').innerText(), right, 'chart touch selects another week');
    await selected('progress');
    ok(`${scheme}: tapping a tab scrolls to it; sideways chart drags scrub without paging`);

    await id('tab-index').click();
    await selected('index');
    await scroll('index').evaluate((el) => { el.scrollTop = 0; });
    await id('start-suggested').click();
    await id('workout-name').waitFor();
    await id('minimize').click();
    await selected('index');
    const dock = await id('mini-bar').boundingBox();
    for (const [direction, target] of [['left', 'plan'], ['left', 'progress'], ['right', 'plan']]) {
      await swipe(direction, target);
      assert.equal(await page.locator('[data-testid="mini-bar"]:visible').count(), 1);
      assert.deepEqual(await id('mini-bar').boundingBox(), dock, 'Now Lifting stays fixed');
    }
    ok(`${scheme}: Now Lifting remains fixed above the unchanged tab bar on every page`);

    await page.goto(APP + '/plan');
    await selected('plan');
    await id('tab-progress').click();
    await selected('progress');
    await page.goBack();
    await selected('plan');
    await page.goForward();
    await selected('progress');
    await id('open-search-progress').click();
    await id('exercise-search').waitFor();
    assert.equal(await page.getByRole('tab').count(), 0);
    await page.getByRole('link', { name: 'Go back', exact: true }).click();
    await selected('progress');
    ok(`${scheme}: direct /plan, browser Back/Forward and a pushed Search preserve the selected page`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await id('tab-index').click();
    await selected('index');
    await page.waitForTimeout(200);
    await observeScroll();
    await id('tab-progress').click();
    await selected('progress');
    const reduced = await page.evaluate(() => window.__pagerFrames);
    assert.ok(reduced.length > 0);
    assert.ok(reduced.every((f) => f.x < 1 || f.x > 779), 'reduced motion skips smooth intermediate pages');
    assert.deepEqual(errors, []);
    ok(`${scheme}: reduced-motion tab taps are instant; no browser errors`);
  } catch (error) {
    await page.screenshot({ path: `${OUT}/${scheme}-failure.png` });
    throw error;
  } finally {
    await ctx.close();
  }
}

await browser.close();
console.log(`${passed} checks passed`);
