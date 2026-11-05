// Design todo group 1. REVIEW_BEFORE=1 captures the same screens on main.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';
import { dateTicks } from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(before ? 'before' : 'after');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };
try {
  for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const data = demoData(lang);
    data.kv.settings.theme = theme;
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
    await ctx.addInitScript(grantWakeLock);
    await ctx.addInitScript((data) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, data);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
    const id = t => page.getByTestId(t);
    const shot = async name => { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${lang}-${theme}-${name}.png`) }); };
    const go = async route => { await page.goto(APP + route); await page.waitForTimeout(500); };
    const focus = async field => {
      // Reach the input with a hardware keyboard, including the auto-focused Search tab.
      await page.waitForTimeout(300);
      await field.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      if (!before) {
        assert.ok(await field.evaluate(e => e === document.activeElement), await page.evaluate(() => document.activeElement.outerHTML));
        const style = await field.evaluate(e => ({ input: getComputedStyle(e).outlineStyle, width: getComputedStyle(e.parentElement).outlineWidth, offset: getComputedStyle(e.parentElement).outlineOffset, radius: parseFloat(getComputedStyle(e.parentElement).borderRadius) }));
        assert.equal(style.input, 'none');
        assert.equal(style.width, '2px');
        assert.equal(style.offset, '2px');
        assert.ok(style.radius > 20);
      }
    };
    await go('/');
    await id('tab-search').click();
    await focus(id('exercise-search'));
    await shot('search');
    await id('exercise-search').fill('squat bb');
    await id('exercise-x-squat-barbell').click();
    await id('exercise-chart').waitFor();
    for (const [index, range] of ['3M', '6M', '1Y', 'All'].entries()) {
      await id(`exercise-range-${[90, 182, 365, 0][index]}`).click();
      if (!before) {
        const days = { '3M': 90, '6M': 182, '1Y': 365 }[range] || 0;
        const times = data.workouts.filter(w => w.exercises.some(e => e.exerciseId === 'x-squat-barbell') && (!days || w.startedAt >= Date.now() - days * 86400000)).map(w => w.startedAt).sort((a,b) => a-b);
        const labels = await id('exercise-chart').locator('svg text').allTextContents();
        const expected = dateTicks(times[0], times.at(-1)).map(at => new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month: 'short' }).format(at));
        assert.deepEqual(labels.slice(-expected.length), expected);
      }
      await shot(`exercise-${range}`);
    }
    await id('exercise-metric').click();
    if (!before) assert.match(await page.locator('body').innerText(), /Account\./);
    await shot('exercise-metric');
    await go('/tools');
    if (!before) assert.match(await page.locator('body').innerText(), /Account →/);
    await shot('tools');
    await go('/exercises');
    await focus(id('lifts-search'));
    await shot('lifts');
    await go('/pick-exercises');
    await focus(id('pick-search'));
    await shot('add-exercises');
    await go('/measure/bodyweight');
    await id('measure-chart').waitFor();
    await shot('bodyweight');
    await go('/measure');
    await shot('body');
    await go(`/template/${data.templates[0].id}`);
    await shot('routine');
    for (const width of lang === 'de' ? [390, 375] : [390]) {
      await page.setViewportSize({ width, height: 844 });
      await go('/account');
      await id('set-ask-template').scrollIntoViewIfNeeded();
      await shot(`account-workouts-${width}`);
      await id('set-plates').scrollIntoViewIfNeeded();
      await shot(`account-stats-${width}`);
      if (!before) {
        const titles = [lang === 'de' ? 'Routinen nach dem Training aktualisieren' : 'Update routines after workouts', lang === 'de' ? 'Verfügbare Scheiben' : 'Available plates', lang === 'de' ? 'Übungen mit Zusatzgewicht' : 'Weighted bodyweight exercises', lang === 'de' ? 'Übungen mit Unterstützung' : 'Assisted bodyweight exercises'];
        for (const title of titles) {
          const text = page.getByText(title, { exact: true });
          assert.equal(await text.count(), 1, title);
          const size = await text.evaluate(e => ({ h: e.clientHeight, sh: e.scrollHeight, w: e.clientWidth, sw: e.scrollWidth, clamp: getComputedStyle(e).webkitLineClamp }));
          assert.ok(size.sh <= size.h && size.sw <= size.w && size.clamp !== '1', `${width}: ${title} ${JSON.stringify(size)}`);
        }
      }
    }
    assert.deepEqual(errors, []);
    ok(`${lang} ${theme}: chart ranges, Account text and wrapping, keyboard search focus`);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
