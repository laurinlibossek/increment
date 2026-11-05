// Design todo group 5. REVIEW_BEFORE=1 captures the matching review baseline.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';
import { EXAMPLE_TEMPLATES, MEASUREMENTS, translator } from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(before ? 'before' : 'after');
const browser = await launch();
let passed = 0;
const ok = label => { passed++; console.log('PASS', label); };
const store = page => page.evaluate(() => JSON.parse(localStorage.getItem('increment.data')));

async function scenario(lang, theme, desktop = false) {
  const data = demoData(lang);
  data.kv.settings.theme = theme;
  data.templates[0].notes = lang === 'de' ? 'Wähle jedes Mal die gleiche Bankhöhe.' : 'Use the same bench height each time.';
  const ctx = await browser.newContext({
    ...(desktop ? {} : devices['iPhone 13']),
    viewport: desktop ? { width: 1280, height: 800 } : { width: 390, height: 844 },
    locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: theme,
  });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript(data => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, data);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|DevTools/.test(message.text())) errors.push(message.text()); });
  const id = value => page.getByTestId(value);
  const go = async route => { await page.goto(APP + route); await page.waitForTimeout(350); };
  const shot = async name => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${lang}-${theme}-${desktop ? 'desktop-' : ''}${name}.png`) });
  };
  return { ctx, page, errors, data, id, go, shot };
}

// React Native's ScrollView owns the scroll, rather than the browser window.
async function scroll(row, fraction) {
  return row.evaluate((element, fraction) => {
    for (let e = element.parentElement; e; e = e.parentElement) {
      if (!/(auto|scroll)/.test(getComputedStyle(e).overflowY)) continue;
      const max = e.scrollHeight - e.clientHeight;
      e.scrollTop = max * fraction;
      const r = e.getBoundingClientRect();
      return { max, bottom: r.bottom, top: r.top };
    }
    throw new Error('No ScrollView ancestor');
  }, fraction);
}

async function dock(page, barID, buttonID) {
  const bar = await page.getByTestId(barID).boundingBox();
  const button = await page.getByTestId(buttonID).boundingBox();
  const { width, height } = page.viewportSize(), column = Math.min(width, 600);
  assert.ok(bar && button, 'the action bar and its button are visible');
  assert.ok(Math.abs(bar.y + bar.height - height) <= 1, JSON.stringify(bar));
  assert.ok(Math.abs(bar.x - (width - column) / 2) <= 1, JSON.stringify(bar));
  assert.ok(Math.abs(bar.width - column) <= 1, JSON.stringify(bar));
  assert.ok(button.y >= height - 132 && button.y + button.height <= height - 12, JSON.stringify(button));
  assert.ok(button.height >= 44, JSON.stringify(button));
  assert.ok(Math.abs(button.x - (width - column) / 2 - 20) <= 1, JSON.stringify(button));
  assert.ok(Math.abs(button.width - column + 40) <= 1, JSON.stringify(button));
  return { bar, button };
}

async function scrollPastDock(page, row, barID, buttonID, { mustScroll = false } = {}) {
  const initial = await dock(page, barID, buttonID);
  const scroller = await scroll(row, 1);
  await page.waitForTimeout(150);
  const bottom = await dock(page, barID, buttonID);
  assert.ok(Math.abs(initial.button.y - bottom.button.y) <= 1, 'primary action stays in reach while scrolling');
  assert.ok(scroller.bottom > bottom.bar.y, 'the content viewport continues under the action bar');
  if (mustScroll) assert.ok(scroller.max > 100, JSON.stringify(scroller));
  const last = await row.boundingBox();
  assert.ok(last.y >= scroller.top && last.y + last.height <= bottom.bar.y + 1, `last row clears the action bar: ${JSON.stringify({ last, bar: bottom.bar })}`);
  return scroller;
}

async function title(page, name, { wraps = false } = {}) {
  const heading = page.getByTestId('template-title');
  assert.equal(await heading.innerText(), name);
  const style = await heading.evaluate(e => {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return { size: s.fontSize, weight: s.fontWeight, line: parseFloat(s.lineHeight), height: r.height, top: r.top, width: e.clientWidth, scrollWidth: e.scrollWidth, clamp: s.webkitLineClamp };
  });
  assert.equal(style.size, '28px');
  assert.ok(Number(style.weight) >= 700, JSON.stringify(style));
  assert.ok(style.top >= 50, 'detail title sits under the navigation bar');
  assert.equal(await page.getByText(name, { exact: true }).count(), 1, 'the navigation bar does not repeat the routine name');
  assert.ok(style.scrollWidth <= style.width && style.clamp !== '1', JSON.stringify(style));
  if (wraps) assert.ok(style.height > style.line * 1.5, JSON.stringify(style));
}

try {
  for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const { ctx, page, errors, data, id, go, shot } = await scenario(lang, theme);
    const routine = data.templates[0], tr = translator(lang);

    // Enter through the avatar: a direct /account URL has no back stack and
    // therefore cannot reproduce the duplicate Back + Done header.
    await go('/');
    await id('open-account').click();
    await id('account-done').waitFor();
    await shot('account');
    if (!before) {
      assert.equal(await page.getByRole('link', { name: /^(go back|.*, back)$/i }).count(), 0, 'Account has Done as its only close control');
      await id('set-warmup').click();
      await id('wu-bar').waitFor();
      await id('wu-cancel').click();
      await id('account-done').waitFor();
      await id('account-done').click();
      await id('open-account').waitFor();
      assert.equal(await id('account-done').count(), 0);
      ok(`${lang} ${theme}: Account opens from Today with one close control; Warm-up Cancel and Done return correctly`);
    }

    await go(`/template/${routine.id}`);
    await id('start-template').waitFor();
    await shot('routine-top');
    const lastExercise = id(`template-exercise-${routine.exercises.length - 1}`);
    if (!before) {
      await title(page, routine.name);
      await scrollPastDock(page, lastExercise, 'template-action-bar', 'start-template');
      assert.equal(await id('start-template').innerText(), tr('Start workout'));
      ok(`${lang} ${theme}: routine has one Title 1 below the bar and a fixed Start workout; its last exercise clears the dock`);
    } else await scroll(lastExercise, 1);
    await shot('routine-bottom');
    await id('start-template').click();
    await id('workout-name').waitFor();
    await shot('session');
    if (!before) {
      assert.equal(await id('workout-name').inputValue(), routine.name);
      const active = (await store(page)).kv.active;
      assert.equal(active.templateId, routine.id);
      assert.deepEqual(active.exercises.map(e => e.exerciseId), routine.exercises.map(e => e.exerciseId));
      ok(`${lang} ${theme}: fixed Start workout begins the selected routine with all its exercises`);
    }
    await id('discard-workout').click();
    await id('confirm-discard').waitFor();
    await id('confirm-discard').click();

    await go('/measure');
    await id('measure-bodyweight').waitFor();
    await shot('body-top');
    const lastMeasure = id(`measure-${MEASUREMENTS.at(-1).id}`);
    if (!before) {
      await scrollPastDock(page, lastMeasure, 'body-action-bar', 'log-bodyweight', { mustScroll: true });
      assert.equal(await id('log-bodyweight').innerText(), tr('Log body weight'));
      ok(`${lang} ${theme}: Body scrolls under its fixed Log body weight bar and the final measurement remains reachable`);
    } else await scroll(lastMeasure, 1);
    await shot('body-bottom');
    if (!before) {
      const count = (await store(page)).measurements.length;
      await id('log-bodyweight').click();
      await id('number-dialog').waitFor();
      await id('number-input').fill(lang === 'de' ? '81,9' : '81.9');
      await id('number-ok').click();
      await page.waitForFunction(count => JSON.parse(localStorage.getItem('increment.data')).measurements.length === count + 1, count);
      const latest = (await store(page)).measurements.filter(m => m.type === 'bodyweight').sort((a, b) => b.at - a.at)[0];
      assert.equal(latest.value, 81.9);
      await scroll(id('measure-bodyweight'), 0);
      assert.match(await id('measure-bodyweight').innerText(), lang === 'de' ? /81,9 kg/ : /81\.9 kg/);
      // Hiding the modal's Back must not hide the ordinary pushed-screen Back.
      await id('measure-bodyweight').click();
      await id('measure-chart').waitFor();
      const back = page.getByRole('link', { name: /^(go back|.*, back)$/i });
      assert.equal(await back.count(), 1);
      await back.click();
      await id('log-bodyweight').waitFor();
      ok(`${lang} ${theme}: the dock opens number entry and saves body weight; measurement detail keeps its Back control`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // A longer user-written name and a long routine exercise wrapping and the
  // full scroll range independently of the short store-demo names.
  for (const [lang, theme] of [['en', 'light'], ['de', 'dark']]) {
    const { ctx, page, errors, data, id, go, shot } = await scenario(lang, theme);
    const routine = data.templates[0];
    routine.name = lang === 'de' ? 'Oberkörper A mit zusätzlichem Schulter- und Armtraining' : 'Upper body A with extra shoulder and arm work';
    routine.exercises = data.templates.slice(0, 3).flatMap(t => t.exercises);
    await go('/');
    await page.evaluate(data => localStorage.setItem('increment.data', JSON.stringify(data)), data);
    await go(`/template/${routine.id}`);
    await id('start-template').waitFor();
    await shot('routine-long-title');
    if (!before) {
      await title(page, routine.name, { wraps: true });
      await scrollPastDock(page, id(`template-exercise-${routine.exercises.length - 1}`), 'template-action-bar', 'start-template', { mustScroll: true });
      ok(`${lang} ${theme}: long routine title wraps and every row of a long routine can scroll above the action bar`);
    } else await scroll(id(`template-exercise-${routine.exercises.length - 1}`), 1);
    await shot('routine-long-bottom');
    const example = EXAMPLE_TEMPLATES[0];
    await go(`/template/${example.id}`);
    await id('add-example').waitFor();
    await scroll(id(`template-exercise-${example.exercises.length - 1}`), 1);
    await shot('example');
    if (!before && lang === 'en') {
      await id('add-example').scrollIntoViewIfNeeded();
      await id('add-example').click();
      await page.waitForFunction(count => JSON.parse(localStorage.getItem('increment.data')).templates.length === count + 1, data.templates.length);
      await id('template-options').waitFor();
      await dock(page, 'template-action-bar', 'start-template');
      ok('example routine keeps a reachable Add to my routines action and opens the saved copy');
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  for (const [lang, theme] of [['en', 'light'], ['de', 'dark']]) {
    const { ctx, page, errors, data, id, go, shot } = await scenario(lang, theme, true);
    const routine = data.templates[0];
    await go(`/template/${routine.id}`);
    await id('start-template').waitFor();
    await shot('routine');
    if (!before) await scrollPastDock(page, id(`template-exercise-${routine.exercises.length - 1}`), 'template-action-bar', 'start-template');
    await go('/measure');
    await id('measure-bodyweight').waitFor();
    await shot('body');
    if (!before) {
      await scrollPastDock(page, id(`measure-${MEASUREMENTS.at(-1).id}`), 'body-action-bar', 'log-bodyweight', { mustScroll: true });
      ok(`${lang} ${theme}: routine and Body action bars stay inside the centred 600 px column at 1280 px`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
