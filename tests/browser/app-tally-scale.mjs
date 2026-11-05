// Design todo group 9. REVIEW_BEFORE=1 captures the unchanged main build.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';
import { DEFAULT_SETTINGS, platesFor, translator } from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const emptyOnly = process.env.REVIEW_EMPTY_ONLY === '1';
const OUT = shots(before ? 'before' : 'after');
const browser = await launch();
const normal = text => text.replace(/\s+/g, ' ').trim();
let passed = 0;
const ok = message => { passed++; console.log('PASS', message); };

async function scenario(lang, theme, unit = 'kg') {
  const data = demoData(lang);
  data.kv.settings = { ...DEFAULT_SETTINGS, ...data.kv.settings };
  data.kv.settings.theme = theme;
  data.kv.settings.showExamples = true;
  data.templates[0].folder = lang === 'de' ? 'Oberkörper' : 'Upper body';
  if (unit === 'lb') {
    data.kv.settings.unit = 'lb';
    data.kv.settings.bar = 45;
    data.kv.settings.plates = [45, 35, 25, 10, 5, 2.5];
  }
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript(data => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, data);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|DevTools/.test(message.text())) errors.push(message.text()); });
  const id = value => page.getByTestId(value);
  const go = async route => { await page.goto(APP + route); await page.waitForTimeout(350); };
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${lang}-${theme}-${unit === 'lb' ? 'lb-' : ''}${name}.png`) }); };
  return { ctx, page, errors, data, id, go, shot };
}

async function scroll(locator, fraction = 1) {
  await locator.evaluate((element, fraction) => {
    for (let e = element.parentElement; e; e = e.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) { e.scrollTop = (e.scrollHeight - e.clientHeight) * fraction; return; }
    }
  }, fraction);
}

// Measure the actual rendered foreground and its composed ancestor background.
// Placeholders and disabled controls are intentionally outside this readable-text
// rule. SVG labels use their fill; symbols have no prose text to check.
async function readable(locator) {
  const rows = await locator.evaluate(root => {
    const rgba = value => {
      const values = value.match(/[\d.]+/g)?.map(Number) || [];
      return [values[0] || 0, values[1] || 0, values[2] || 0, values.length > 3 ? values[3] : 1];
    };
    const over = (foreground, background) => foreground.slice(0, 3).map((v, i) => v * foreground[3] + background[i] * (1 - foreground[3]));
    const light = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out = [], candidates = [];
    let node;
    while ((node = walker.nextNode())) candidates.push({ text: node.textContent, element: node.parentElement });
    for (const element of root.querySelectorAll('input, textarea')) {
      if (element.value) candidates.push({ text: element.value, element });
    }
    for (const candidate of candidates) {
      const text = candidate.text.replace(/\s+/g, ' ').trim(), element = candidate.element;
      if (!text || !element || /[\uE000-\uF8FF]/.test(text) || element.closest('[aria-disabled="true"], [disabled]')) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;
      const chain = [];
      for (let e = element; e; e = e.parentElement) chain.unshift(e);
      if (chain.some(e => { const s = getComputedStyle(e); return s.visibility === 'hidden' || s.display === 'none'; })) continue;
      let background = [255, 255, 255], opacity = 1;
      for (const ancestor of chain) {
        const style = getComputedStyle(ancestor);
        background = over(rgba(style.backgroundColor), background);
        opacity *= Number(style.opacity);
      }
      if (opacity <= 0) continue;
      const style = getComputedStyle(element);
      const foreground = rgba(element.namespaceURI === 'http://www.w3.org/2000/svg' ? style.fill : style.color);
      foreground[3] *= opacity;
      const rendered = over(foreground, background), l1 = light(rendered), l2 = light(background);
      out.push({ text, ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), color: style.color, background, opacity });
    }
    return out;
  });
  assert.ok(rows.length > 0, 'some visible readable text was measured');
  const low = rows.filter(row => row.ratio < 4.5);
  assert.deepEqual(low, [], `readable text needs 4.5:1 contrast: ${JSON.stringify(low)}`);
  return rows;
}

async function tokenStyle(locator, expected) {
  const actual = await locator.evaluate((e, names) => Object.fromEntries(names.map(name => [name, getComputedStyle(e)[name]])), Object.keys(expected));
  assert.deepEqual(actual, expected);
}

async function ghostPlates(s, lang, unit) {
  const { id, page, data } = s;
  const ghost = unit === 'lb' ? 225 : 100;
  assert.equal(await id('plate-target').getAttribute('placeholder'), String(ghost));
  assert.equal(await id('plate-target').inputValue(), '', 'the example remains a ghost rather than a typed value');
  const number = value => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 }).format(value);
  const expected = target => platesFor(target, data.kv.settings.bar, data.kv.settings.plates).plates.map(number);
  const actual = () => id('plate-list').locator('[dir="auto"]').allTextContents();
  assert.deepEqual(await actual(), expected(ghost));
  const initial = normal(await id('plate-loaded').innerText());
  await id('plate-target').fill(unit === 'lb' ? '135' : '60');
  await page.waitForTimeout(100);
  assert.deepEqual(await actual(), expected(unit === 'lb' ? 135 : 60), 'typed weight replaces the example plates');
  assert.notEqual(normal(await id('plate-loaded').innerText()), initial);
  await readable(page.locator('body')); // includes the typed target, never its empty placeholder
  await id('plate-target').fill('');
  await page.waitForTimeout(100);
  assert.deepEqual(await actual(), expected(ghost), 'clearing returns to the example plates');
  assert.equal(normal(await id('plate-loaded').innerText()), initial);
}

async function emptyRoutine(s, lang, theme) {
  // Use a fresh screen context for this second instance of the same editor.
  // The earlier picker is still unwinding its navigation stack after Cancel.
  const fresh = await scenario(lang, theme);
  try {
    await fresh.go('/template-edit');
    await fresh.id('tpl-name').waitFor();
    const heading = fresh.page.getByText(translator(lang)('Build your routine'), { exact: true });
    await heading.waitFor();
    await fresh.shot('routine-editor-empty');
    if (!before) {
      await tokenStyle(heading, { fontSize: '20px', lineHeight: '25px', fontWeight: '600' });
      await readable(fresh.page.locator('body'));
      ok(`${lang} ${theme}: empty routine uses Title 3 and readable guidance`);
    }
    assert.deepEqual(fresh.errors, []);
  } finally { await fresh.ctx.close(); }
}

try {
  for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const s = await scenario(lang, theme), { ctx, page, errors, data, id, go, shot } = s;
    const tr = translator(lang), routine = data.templates[0], workout = data.workouts[0];
    const check = async label => { if (!before) { await readable(page.locator('body')); ok(`${lang} ${theme}: ${label}`); } };
    if (emptyOnly) { await emptyRoutine(s, lang, theme); assert.deepEqual(errors, []); await ctx.close(); continue; }

    await go('/tools');
    await id('plate-target').waitFor();
    await shot('tools-plates');
    if (!before) {
      assert.equal(await id('plate-hint').innerText(), tr('The plates you need on each side of the bar.'));
      await ghostPlates(s, lang, 'kg');
      await readable(page.locator('body'));
      ok(`${lang} ${theme}: plate hint and ghost plates; typed weight overrides and clearing restores the ghost`);
    }
    await id('tools-tabs-rm').click();
    await id('rm-w').waitFor();
    await shot('tools-rm-empty');
    if (!before) {
      assert.equal(await id('rm-w').getAttribute('placeholder'), '100');
      assert.equal(await id('rm-r').getAttribute('placeholder'), '5');
      assert.equal(await id('rm-w').inputValue(), '');
      assert.equal(await id('rm-r').inputValue(), '');
      assert.equal(await id('rm-hint').innerText(), tr('Estimate your one-rep max from a set.'));
      assert.equal(await id('rm-result').count(), 0, 'the estimate waits for typed values');
      await readable(page.locator('body'));
      ok(`${lang} ${theme}: 1RM has translated guidance and weight/reps placeholders`);
    }
    await id('rm-w').fill('100');
    await id('rm-r').fill('5');
    await page.locator('body').click({ position: { x: 2, y: 90 } });
    await shot('tools-rm-result');
    if (!before) {
      assert.match(await id('rm-result').innerText(), lang === 'de' ? /116,7 kg/ : /116\.7 kg/);
      await tokenStyle(id('rm-result'), { fontSize: '56px', lineHeight: '60px', fontWeight: '600' });
    }
    await check('1RM result uses Number XL and its formula/table remain readable');

    await go('/account');
    await id('set-name').waitFor();
    await shot('account-top');
    await id('set-name').click();
    await id('prompt-input').waitFor();
    await shot('prompt');
    if (!before) {
      await tokenStyle(id('prompt-dialog'), { borderTopLeftRadius: '24px' });
      await readable(id('prompt-dialog'));
      ok(`${lang} ${theme}: name prompt has Tally shape and readable text`);
    }
    await id('prompt-cancel').click();
    await scroll(id('privacy'));
    await shot('account-bottom');
    await check('Account subtitles, Strong-unit hints and storage footer remain readable');

    await go('/warmup');
    await id('wu-bar').waitFor();
    await shot('warmup');
    await check('Warm-up units and guidance remain readable');

    await go('/history');
    await id('history-view').click();
    await id('cal-stats').waitFor();
    await shot('calendar');
    await check('calendar weekdays, dates, stats and hint meet 4.5:1');

    await go('/measure/bodyweight');
    await id('measure-chart').waitFor();
    await shot('measurement');
    await check('measurement latest caption and chart labels remain readable');
    await id('measure-add-top').click();
    await id('number-dialog').waitFor();
    await shot('number-dialog');
    if (!before) {
      await tokenStyle(id('number-dialog'), { borderTopLeftRadius: '24px' });
      await readable(id('number-dialog'));
      ok(`${lang} ${theme}: number-entry dialog has Tally shape and readable labels`);
    }
    await id('dialog-cancel').click();

    await go(`/template-edit?id=${routine.id}`);
    await id('tpl-name').waitFor();
    await shot('routine-editor-top');
    await scroll(id('add-exercises'));
    await shot('routine-editor-bottom');
    await check('routine-editor target guidance and set captions remain readable');
    await id('add-exercises').click();
    await id('pick-search').waitFor();
    await shot('picker');
    await check('picker metadata remains readable');
    await id('pick-new').click();
    await id('exercise-name').waitFor();
    await shot('exercise-form-top');
    await scroll(id('exercise-notes'));
    await shot('exercise-form-bottom');
    await check('exercise categories, body-part choices and help remain readable');
    await id('exercise-cancel').click();
    await id('pick-cancel').click();
    await emptyRoutine(s, lang, theme);

    await go(`/workout/${workout.id}`);
    await id('workout-title').waitFor();
    await shot('workout');
    await check('finished-workout warm-up labels remain readable');
    await id('workout-options').click();
    await id('wo-menu-delete').click();
    await id('confirm-delete').waitFor();
    await shot('choice-dialog');
    if (!before) {
      await tokenStyle(id('choice-dialog'), { borderTopLeftRadius: '24px' });
      await readable(id('choice-dialog'));
      ok(`${lang} ${theme}: generic confirmation has Tally shape and readable message`);
    }
    await id('dialog-cancel').click();
    await go(`/workout-edit/${workout.id}`);
    await id('edit-name').waitFor();
    await shot('workout-editor-top');
    await id('edit-start').click();
    await id('datetime-dialog').waitFor();
    await shot('datetime-dialog');
    if (!before) {
      await tokenStyle(id('datetime-dialog'), { borderTopLeftRadius: '24px' });
      await readable(id('datetime-dialog'));
      ok(`${lang} ${theme}: date/time dialog has readable labels and token shape`);
    }
    await id('dialog-cancel').click();
    await scroll(id('add-exercises'));
    await shot('workout-editor-bottom');
    await check('workout-editor save guidance remains readable');

    await go('/exercise/x-squat-barbell');
    const history = page.locator('[data-testid^="ex-session-"]').first();
    await history.waitFor();
    await history.evaluate(e => e.scrollIntoView({ block: 'start' }));
    await shot('exercise-history');
    await check('exercise-history warm-up values remain readable');

    await go('/');
    await id('tab-progress').click();
    await id('weekly-chart').waitFor();
    await id('weekly-chart').scrollIntoViewIfNeeded();
    await shot('progress-chart');
    if (!before) await readable(id('weekly-chart'));
    await id('weekly-chart').click({ position: { x: 220, y: 70 } });
    await id('chart-tip').waitFor();
    await shot('chart-tooltip');
    if (!before) {
      await readable(id('chart-tip'));
      await tokenStyle(id('chart-tip'), { borderTopLeftRadius: '14px' });
      ok(`${lang} ${theme}: bar-chart labels and tooltip are readable with token shape/type`);
    }
    await id('tab-plan').click();
    await id(`template-${routine.id}`).waitFor();
    await shot('plan');
    await check('Plan folder counts remain readable');
    await id('plan-add').click();
    await id('sheet-cancel').waitFor();
    await shot('action-sheet');
    if (!before) {
      await readable(id('sheet-dialog'));
      ok(`${lang} ${theme}: action-sheet choices remain readable`);
    }
    await id('sheet-cancel').click();
    await id('hide-examples').scrollIntoViewIfNeeded();
    await id('hide-examples').click();
    await id('toast').waitFor();
    await shot('toast');
    if (!before) {
      await readable(id('toast'));
      await tokenStyle(id('toast'), { borderTopLeftRadius: '24px' });
      ok(`${lang} ${theme}: toast and Undo are readable with Tally shape`);
    }
    await id('toast-action').click();

    await go(`/template/${routine.id}`);
    await id('start-template').click();
    await id('workout-name').waitFor();
    await shot('session');
    await check('session set separators and labels remain readable');
    const firstExercise = routine.exercises[0].exerciseId;
    await id(`ex-menu-${firstExercise}`).click();
    await id('menu-reorder').click();
    await id('reorder-done').waitFor();
    await shot('reorder');
    await check('reorder set counts and drag hint remain readable');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  if (!before && !emptyOnly) for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const s = await scenario(lang, theme, 'lb');
    await s.go('/tools');
    await s.id('plate-target').waitFor();
    await ghostPlates(s, lang, 'lb');
    await s.id('tools-tabs-rm').click();
    assert.equal(await s.id('rm-w').getAttribute('placeholder'), '225');
    assert.equal(await s.id('rm-r').getAttribute('placeholder'), '5');
    await readable(s.page.locator('body'));
    assert.deepEqual(s.errors, []);
    ok(`${lang} ${theme}: pound examples use 225 with matching ghost plates and 1RM placeholder`);
    await s.ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
