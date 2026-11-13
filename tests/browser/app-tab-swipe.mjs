// Real browser input only: CDP Input.dispatchTouchEvent sends touchStart,
// several touchMoves and touchEnd. No DOM-created TouchEvent/PointerEvent or
// dispatchEvent, and no JS touch/pointer handlers move the pager. The browser's
// native scrolling and scroll-snap move it, including from cards and rows.
// Read scrollLeft while contact is still held, then verify the settled boundary.
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
    if (window.__pagerObserved) return;
    window.__pagerObserved = true;
    el.addEventListener('scroll', () => window.__pagerFrames.push({
      x: el.scrollLeft, path: location.pathname,
      selected: document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-testid'),
    }), { passive: true });
  });
  // `back` drags the same finger back by that many pixels before release,
  // after `beforeBack` looked at the held position.
  async function gesture({ x = 295, y = 200, dx = 0, dy = 0, speed = 450, back = 0, beforeBack, beforeRelease } = {}) {
    const move = async (from, mx, my) => {
      const distance = Math.max(Math.abs(mx), Math.abs(my));
      const steps = Math.max(8, Math.ceil(distance / 8));
      for (let i = 1; i <= steps; i++) {
        await page.waitForTimeout(1000 * distance / speed / steps);
        await input.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: from.x + mx * i / steps, y: from.y + my * i / steps }],
        });
      }
      // Let the compositor apply the last move and stop fling velocity.
      await page.waitForTimeout(120);
    };
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await move({ x, y }, dx, dy);
    if (back) {
      if (beforeBack) await beforeBack();
      await move({ x: x + dx, y: y + dy }, -Math.sign(dx) * back, 0);
    }
    if (beforeRelease) await beforeRelease();
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const TABS = ['tab-index', 'tab-plan', 'tab-progress'];
  const shownTab = () => page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-testid');
  // The bar shows the mostly visible page; a frame may still show the page of
  // the frame before, while the bar's render catches up.
  const mostlyVisible = (x, width) => TABS[Math.min(2, Math.max(0, Math.round(x / width)))];
  const barFollows = (frames, width) => frames.every((f, i) => f.selected === mostlyVisible(f.x, width)
    || (i > 0 && f.selected === mostlyVisible(frames[i - 1].x, width)));
  async function selected(tab) {
    const expected = tab === 'index' ? '/' : `/${tab}`;
    await page.waitForURL(APP + expected);
    const index = ['index', 'plan', 'progress'].indexOf(tab);
    await page.waitForFunction(({ name, index }) => {
      const pager = document.querySelector('[data-testid="tab-pager"]');
      const page = document.querySelector(`[data-testid="tab-page-${name}"]`);
      return pager && page && Math.abs(page.getBoundingClientRect().left - pager.getBoundingClientRect().left) < 1
        && pager.scrollLeft === index * pager.clientWidth;
    }, { name: tab, index });
    const position = await pager.evaluate((el) => ({ left: el.scrollLeft, width: el.clientWidth }));
    assert.equal(position.left, index * position.width, 'settles exactly on the page boundary');
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
    const pageWidth = await pager.evaluate((el) => el.clientWidth);
    await gesture({
      x: card.x + card.width * 0.75, y: cardY, dx: -250,
      beforeRelease: async () => {
        const heldLeft = await pager.evaluate((el) => el.scrollLeft);
        assert.ok(heldLeft > 100 && heldLeft < pageWidth, 'card swipe moves the pager before touchEnd');
        assert.equal(path(), '/', 'held swipe does not change the address');
        assert.equal(await shownTab(), mostlyVisible(heldLeft, pageWidth), 'the bar shows the mostly visible page while held');
      },
    });
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
    await gesture({
      x: 280, y: cardY, dx: -185, speed: 100,
      beforeRelease: async () => {
        const heldLeft = await pager.evaluate((el) => el.scrollLeft);
        assert.ok(heldLeft > 70 && heldLeft < pageWidth / 2, 'half swipe moves partway before touchEnd');
        assert.equal(path(), '/');
      },
    });
    await selected('index');
    const frames = await page.evaluate(() => window.__pagerFrames.splice(0));
    assert.ok(frames.some((f) => f.x > 70 && f.x < 200), 'content moved part way with the touch');
    assert.ok(frames.every((f) => f.path === '/' && f.selected === 'tab-index'), 'no premature selection');
    ok(`${scheme}: a slow partial half swipe follows the finger and snaps back on release`);

    // Past halfway the bar already shows the next page while the finger is
    // down; the address and the accessible page wait for the settled snap.
    await observeScroll();
    await gesture({
      x: 330, y: cardY, dx: -260, speed: 200,
      beforeRelease: async () => {
        const heldLeft = await pager.evaluate((el) => el.scrollLeft);
        assert.ok(heldLeft > pageWidth / 2 + 20, 'held past halfway');
        assert.equal(await shownTab(), 'tab-plan', 'the bar switches before touchEnd');
        assert.equal(path(), '/', 'the address waits for the settled page');
        assert.equal(await tabPage('index').getAttribute('aria-hidden'), 'false', 'Today stays the accessible page');
        assert.equal(await page.getByRole('tabpanel').count(), 1);
      },
    });
    await selected('plan');
    let frames2 = await page.evaluate(() => window.__pagerFrames.splice(0));
    assert.ok(frames2.some((f) => f.selected === 'tab-index') && frames2.some((f) => f.selected === 'tab-plan'));
    assert.ok(barFollows(frames2, pageWidth), 'the highlight switches at halfway, not on release');
    const firstPlan = frames2.findIndex((f) => f.selected === 'tab-plan');
    assert.ok(frames2.slice(firstPlan).every((f) => f.selected === 'tab-plan'), 'the snap ends on the highlighted page');
    ok(`${scheme}: the bar highlight follows a swipe past halfway before release; the address waits for the snap`);

    // Across halfway and back: the highlight returns, and the page snaps back.
    await swipe('right', 'index');
    await observeScroll();
    await gesture({
      x: 330, y: cardY, dx: -260, speed: 200, back: 200,
      beforeBack: async () => assert.equal(await shownTab(), 'tab-plan', 'past halfway shows Plan'),
      beforeRelease: async () => {
        assert.ok(await pager.evaluate((el) => el.scrollLeft) < pageWidth / 2 - 20, 'back before halfway');
        assert.equal(await shownTab(), 'tab-index', 'reversing restores Today');
      },
    });
    await selected('index');
    frames2 = await page.evaluate(() => window.__pagerFrames.splice(0));
    assert.ok(frames2.some((f) => f.selected === 'tab-plan'), 'the highlight did move to Plan');
    assert.ok(barFollows(frames2, pageWidth));
    assert.equal(frames2.at(-1).selected, 'tab-index');
    assert.ok(frames2.every((f) => f.path === '/'), 'the reversed swipe never navigated');
    ok(`${scheme}: a swipe that crosses halfway and reverses restores the highlight and snaps back`);

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
    assert.ok(smooth.every((f) => f.selected === 'tab-progress'), 'a tab tap highlights its tab at once, not Plan on the way');
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
    await observeScroll();
    await page.goBack();
    await selected('plan');
    await page.goForward();
    await selected('progress');
    const history = await page.evaluate(() => window.__pagerFrames.splice(0));
    assert.ok(barFollows(history, pageWidth), 'Back/Forward realign the highlight with the page');
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
