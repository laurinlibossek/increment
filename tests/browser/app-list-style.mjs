// Design todo group 4. REVIEW_BEFORE=1 captures the matching review baseline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { selectTab, launch, devices, grantWakeLock, APP, shots, waitStored } from './env.mjs';
import { demoData } from './store-demo.mjs';
import { DEFAULT_SETTINGS, MEASUREMENTS, exerciseDisplayName, translator } from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(before ? 'before' : 'after');
const browser = await launch();
const normal = text => text.replace(/\s+/g, ' ').trim();
let passed = 0;
const ok = label => { passed++; console.log('PASS', label); };

// Every section sits on its own card (Laurin, 22 Nov 2026): paper-2 with radius-l
// corners and no border, on the screen margin of the (at most 600 px) content
// column. A row spans its card; rows after the first get the shared hairline.
const tokens = JSON.parse(fs.readFileSync(new URL('../../docs/design/tokens.json', import.meta.url)));
const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const cardWant = theme => ({ bg: rgb(tokens.color.tokens.find(t => t.name === 'paper-2').value[theme]), radius: parseFloat(tokens.radius.tokens.find(t => t.name === 'radius-l').value) });
function onMargin(box, viewport) {
  const content = Math.min(viewport, 600), left = Math.max(0, (viewport - 600) / 2);
  assert.ok(Math.abs(box.x - (left + 20)) <= 1 && Math.abs(box.width - (content - 40)) <= 1, `a card on the screen margin: ${JSON.stringify({ box, viewport })}`);
}
async function rowOnCard(row, theme, { hairline = false } = {}) {
  const style = await row.evaluate((element, want) => {
    const box = element.getBoundingClientRect();
    const visible = color => !['transparent', 'rgba(0, 0, 0, 0)'].includes(color);
    let card = null;
    for (let e = element.parentElement; e && e !== document.body && !card; e = e.parentElement) {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      if (parseFloat(s.borderTopLeftRadius) > 0 && visible(s.backgroundColor)) card = { x: r.x, width: r.width, bg: s.backgroundColor === want.bg, radius: parseFloat(s.borderTopLeftRadius) === want.radius, border: parseFloat(s.borderTopWidth) || 0 };
    }
    const line = [...element.querySelectorAll('div')].some(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return r.height > 0 && r.height <= 1 && r.width > box.width * 0.75 && visible(s.backgroundColor);
    });
    return { x: box.x, width: box.width, viewport: innerWidth, card, line };
  }, cardWant(theme));
  assert.ok(style.card, `the row sits on a section card: ${JSON.stringify(style)}`);
  onMargin(style.card, style.viewport);
  assert.deepEqual([style.card.bg, style.card.radius, style.card.border], [true, true, 0], `paper-2, radius-l, no border: ${JSON.stringify(style)}`);
  assert.ok(Math.abs(style.x - style.card.x) <= 1 && Math.abs(style.width - style.card.width) <= 1, `the row spans its card: ${JSON.stringify(style)}`);
  assert.equal(style.line, hairline, hairline ? 'hairline between rows' : 'no hairline above the first row');
}
// A thing of its own in a list (a routine on Plan) is a card of its own.
async function ownCard(row, theme) {
  const style = await row.evaluate((element, want) => {
    const box = element.getBoundingClientRect(), c = element.firstElementChild, s = getComputedStyle(c), r = c.getBoundingClientRect();
    return { x: box.x, width: box.width, viewport: innerWidth, bg: s.backgroundColor === want.bg, radius: parseFloat(s.borderTopLeftRadius) === want.radius, fills: Math.abs(r.width - box.width) < 1 };
  }, cardWant(theme));
  onMargin(style, style.viewport);
  assert.deepEqual([style.bg, style.radius, style.fills], [true, true, true], `paper-2 card with radius-l corners: ${JSON.stringify(style)}`);
}

async function title2(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  const style = await heading.evaluate(e => ({ size: getComputedStyle(e).fontSize, weight: getComputedStyle(e).fontWeight }));
  assert.equal(style.size, '22px');
  assert.ok(Number(style.weight) >= 700, JSON.stringify(style));
}

async function uncut(text) {
  const size = await text.evaluate(e => ({ h: e.clientHeight, sh: e.scrollHeight, w: e.clientWidth, sw: e.scrollWidth, clamp: getComputedStyle(e).webkitLineClamp }));
  assert.ok(size.sh <= size.h && size.sw <= size.w && size.clamp !== '1', JSON.stringify(size));
}

try {
  for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const data = demoData(lang), tr = translator(lang);
    data.kv.settings.theme = theme;
    const routine = data.templates[0];
    routine.notes = lang === 'de' ? 'Wähle jedes Mal die gleiche Bankhöhe.' : 'Use the same bench height each time.';
    const locale = lang === 'de' ? 'de-DE' : 'en-US';
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale, colorScheme: theme });
    await ctx.addInitScript(grantWakeLock);
    await ctx.addInitScript(data => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, data);
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' && !/favicon|DevTools/.test(message.text())) errors.push(message.text()); });
    const id = value => page.getByTestId(value);
    const go = async route => { await page.goto(APP + route); await page.waitForTimeout(350); };
    const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${lang}-${theme}-${name}.png`) }); };

    await go('/account');
    await id('set-name').waitFor();
    await shot('account-top');
    for (const [target, name] of [['set-ask-template', 'account-workouts'], ['set-plates', 'account-stats'], ['language-de', 'account-appearance'], ['privacy', 'account-data']]) {
      await id(target).scrollIntoViewIfNeeded();
      await shot(name);
    }
    if (!before) {
      await rowOnCard(id('set-rest'), theme);
      await rowOnCard(id('set-previous-values'), theme, { hairline: true });
      await rowOnCard(id('set-plates'), theme, { hairline: true });
      for (const section of ['Units', 'Workouts', 'Stats', 'Plates', 'Theme', 'Language', 'Your data']) await title2(page, tr(section));
      // German titles retain the wrapping fixed in group 1. A long value can
      // shorten independently; it must never squeeze a title into one line.
      for (const width of lang === 'de' ? [390, 375] : [390]) {
        await page.setViewportSize({ width, height: 844 });
        await id('set-ask-template').scrollIntoViewIfNeeded();
        for (const label of ['Update routines after workouts', 'Weighted bodyweight exercises', 'Assisted bodyweight exercises', 'Available plates']) await uncut(page.getByText(tr(label), { exact: true }));
        await id('set-plates').scrollIntoViewIfNeeded();
        const value = id('set-plates').getByText((data.kv.settings.plates || DEFAULT_SETTINGS.plates).map(value => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)).join(', '), { exact: true });
        const bounds = await value.evaluate(e => ({ w: e.clientWidth, sw: e.scrollWidth, clamp: getComputedStyle(e).webkitLineClamp, whiteSpace: getComputedStyle(e).whiteSpace }));
        assert.ok(bounds.sw > bounds.w, 'long plate value shortens within its row');
        assert.ok(bounds.clamp === '1' || bounds.whiteSpace === 'nowrap', JSON.stringify(bounds));
      }
      ok(`${lang} ${theme}: Account rows on section cards, hairlines, Title 2 sections and independent title/value wrapping`);
    }
    if (lang === 'de') {
      await page.setViewportSize({ width: 375, height: 844 });
      await id('set-ask-template').scrollIntoViewIfNeeded();
      await shot('account-workouts-375');
      await id('set-plates').scrollIntoViewIfNeeded();
      await shot('account-stats-375');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (!before) {
      const toggle = id('set-ask-template');
      await toggle.scrollIntoViewIfNeeded();
      const input = toggle.getByRole('switch');
      assert.equal(await input.isChecked(), true);
      await toggle.click();
      assert.equal(await input.isChecked(), false);
      await toggle.click();
      assert.equal(await input.isChecked(), true);
      // Setting rows retain their radio semantics and persist a chosen value.
      const otherLanguage = lang === 'en' ? 'de' : 'en';
      await id(`language-${otherLanguage}`).click();
      assert.equal(await id(`language-${otherLanguage}`).getAttribute('role'), 'radio');
      await waitStored(page, (d, value) => d.kv.settings.language === value, otherLanguage);
      await id(`language-${lang}`).click();
      await waitStored(page, (d, value) => d.kv.settings.language === value, lang);
      assert.equal(await id(`theme-${theme}`).getAttribute('role'), 'radio');
      assert.equal(await id(`theme-${theme}`).locator('[aria-hidden="true"]').count(), 1, 'chosen theme retains its checkmark');
      await id('set-rest').click();
      await id('sheet-cancel').waitFor();
      await id('sheet-cancel').click();
      ok(`${lang} ${theme}: Account switches, radio choices and setting menus still work`);
    }

    await go('/measure');
    await id('measure-bodyweight').waitFor();
    await shot('body');
    if (!before) {
      await rowOnCard(id('measure-bodyweight'), theme);
      await rowOnCard(id('measure-bodyfat'), theme, { hairline: true });
      await title2(page, tr('Circumference'));
      assert.match(await id('measure-bodyweight').innerText(), /kg/);
      for (const measure of MEASUREMENTS.filter(measure => measure.id !== 'bodyweight')) {
        const labels = await id(`measure-${measure.id}`).locator('[dir="auto"]:not([aria-hidden="true"])').allTextContents();
        assert.deepEqual(labels.map(normal), [tr(measure.label)], measure.id);
      }
      assert.equal(await page.getByText(tr('No entries yet'), { exact: true }).count(), 0);
      await id('measure-bodyweight').click();
      await id('measure-chart').waitFor();
      await page.goBack();
      await id('measure-bodyfat').click();
      await id('measure-add').waitFor();
      ok(`${lang} ${theme}: Body has rows on section cards, a populated value, name-only empty rows and working navigation`);
    }

    await go(`/template/${routine.id}`);
    await id('start-template').waitFor();
    await shot('routine');
    if (!before) {
      await title2(page, tr('Exercises'));
      await title2(page, tr('Notes'));
      await rowOnCard(id('template-exercise-0'), theme);
      await rowOnCard(id('template-exercise-1'), theme, { hairline: true });
      assert.equal(normal(await id('template-notes').innerText()), routine.notes);
      const lib = new Map(data.exercises.map(exercise => [exercise.id, exercise]));
      for (const [index, exercise] of routine.exercises.entries()) {
        const text = normal(await id(`template-exercise-${index}`).innerText());
        assert.ok(text.startsWith(exerciseDisplayName(lib.get(exercise.exerciseId), lang)), text);
        // warm-ups aren't counted (#38)
        const n = exercise.sets.filter((x) => x.type !== 'warmup').length;
        assert.ok(text.includes(`${n} ${tr(n === 1 ? 'set' : 'sets')}`), text);
        for (const set of exercise.sets) assert.ok(text.includes(`${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(set.w)} × ${set.r}`), text);
        assert.ok(text.includes(`${Math.floor(exercise.restSec / 60)}:${String(exercise.restSec % 60).padStart(2, '0')}`), text);
      }
      ok(`${lang} ${theme}: routine notes and exercises on section cards, with every target and rest`);
    }

    await go('/');
    await selectTab(page, 'plan');
    const row = id(`template-${routine.id}`), menu = id(`template-menu-${routine.id}`);
    await row.waitFor();
    await shot('plan');
    if (!before) {
      await ownCard(row, theme);
      assert.equal(await menu.locator('[aria-hidden="true"]').count(), 1, 'the options button keeps its symbol');
      assert.equal(await row.locator('[aria-hidden="true"]').count(), 1, 'the row has no additional chevron');
      await menu.click();
      await id('tpl-menu-edit').waitFor();
      assert.ok(!page.url().includes('/template/'), 'the menu does not open the routine');
      await id('sheet-cancel').click();
      await row.click({ position: { x: 90, y: 20 } });
      await id('start-template').waitFor();
      assert.ok(page.url().includes(`/template/${routine.id}`), page.url());
      ok(`${lang} ${theme}: Plan's routine is a card that keeps the options menu, has no chevron and opens from the whole card`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
