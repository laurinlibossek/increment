// The plate calculator goes up to 1000 kg (2200 lb, #130): above that it says
// so instead of drawing thousands of plates (20000 kg was 399 a side). Up to
// it, the bar's drawing stays inside its card: the plates get narrower when
// they don't fit at full width (1000 kg is 20 a side, at 320 and 375 px).
// Logged weights have no limit; the workout keypad just leaves out "Plates per
// side" above 1000 kg.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-plate-cap');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const SQUAT = 'x-squat-barbell';
const now = Date.now();
const data = ({ language = 'en', unit = 'kg', active = false } = {}) => ({
  exercises: SEED_EXERCISES, workouts: [], templates: [], measurements: [],
  kv: {
    settings: { language, unit, showExamples: false, appKeepAwake: false },
    meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now },
    ...(active ? { active: { id: 'live', kind: 'workout', name: 'Legs', notes: '', startedAt: now - 60000, templateId: null, templateNotes: '', rest: null, updatedAt: now,
      exercises: [{ id: 'e', exerciseId: SQUAT, notes: '', showNotes: false, supersetId: null, restSec: 0,
        sets: [{ id: 's1', type: 'normal', w: '100', r: '5', d: '', t: '', rpe: '', done: false }] }] } } : {}),
  },
});

async function open(seed, { width = 375, scheme = 'light', locale = 'en-US', path = '/tools' } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width, height: 812 }, locale, colorScheme: scheme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${APP}${path}`);
  return { ctx, page, errors, id: (t) => page.getByTestId(t) };
}

// the drawing's parts (shaft, collar, plates, sleeve) and the card around them
const drawing = (page) => page.getByTestId('plate-result').evaluate((card) => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x0: r.left, x1: r.right, w: r.width }; };
  const row = card.querySelector('[data-testid="plate-list"]')?.previousElementSibling;
  const parts = row ? [...row.children].map(box) : [];
  return { card: box(card), parts, plates: parts.slice(2, -1) };
});
const chips = async (id) => (await id('plate-list').innerText()).split(/\s+/).filter(Boolean);

// 1000 kg at 320 and 375 px: 19 × 25 and a 15 a side, all inside the card; 100 kg at full width
for (const [width, scheme] of [[320, 'light'], [375, 'light'], [375, 'dark']]) {
  const { ctx, page, errors, id } = await open(data(), { width, scheme });
  await id('plate-target').fill('1000');
  await page.waitForTimeout(300);
  const d = await drawing(page);
  assert.equal(d.plates.length, 20, JSON.stringify(d.plates));
  assert.deepEqual(await chips(id), [...Array(19).fill('25'), '15']);
  assert.match(await id('plate-loaded').innerText(), /^Loaded: 1,000 kg$/);
  assert.ok(d.parts.every((p) => p.x0 >= d.card.x0 && p.x1 <= d.card.x1), `inside the card at ${width} px: ${JSON.stringify(d)}`);
  assert.ok(d.plates[0].w < 15, `narrower than 15 px: ${d.plates[0].w}`);
  await page.screenshot({ path: `${OUT}/1000-${width}-${scheme}.png`, fullPage: true });
  await id('plate-target').fill('100');
  await page.waitForTimeout(300);
  const small = await drawing(page);
  assert.deepEqual(await chips(id), ['25', '15']);
  assert.deepEqual(small.plates.map((p) => Math.round(p.w)), [15, 15], 'full width when they fit');
  assert.deepEqual(errors, []);
  await ctx.close();
  ok(`${width} px ${scheme}: 1000 kg is 19 × 25 and a 15 a side, drawn narrower so the bar stays inside its card; 100 kg keeps its full-width plates`);
}

// over the limit: the line instead of plates, in kg, lb and German
for (const [label, seed, locale, over, max, want] of [
  ['kg', data(), 'en-US', '20000', '1000', /^The calculator goes up to 1,000\u00a0kg\.$/],
  ['lb', data({ unit: 'lb' }), 'en-US', '2300', '2200', /^The calculator goes up to 2,200\u00a0lb\.$/],
  ['German', data({ language: 'de' }), 'de-DE', '20000', '1000', /^Der Rechner geht bis 1\.000\u00a0kg\.$/],
]) {
  const { ctx, page, errors, id } = await open(seed, { locale });
  await id('plate-target').fill(over);
  await id('plate-too-heavy').waitFor();
  assert.match(await id('plate-too-heavy').innerText(), want);
  assert.equal(await id('plate-bar-row').count() + await id('plate-list').count(), 0, 'no plates drawn or listed');
  await page.screenshot({ path: `${OUT}/over-${label}.png` });
  await id('plate-target').fill(max);
  await id('plate-list').waitFor();
  assert.equal(await id('plate-too-heavy').count(), 0, 'the limit itself is worked out');
  assert.deepEqual(errors, []);
  await ctx.close();
  ok(`${label}: ${over} says “${want.source.replace(/\\u00a0/g, ' ').replace(/\\|\^|\$/g, '')}” (the number and unit kept together) and draws no plates; ${max} is worked out`);
}

// the workout keypad: any weight can be logged; "Plates per side" only up to 1000 kg
{
  const { ctx, page, errors, id } = await open(data({ active: true }), { path: '/active' });
  await id('in-w-s1').click();
  await id('keypad').waitFor();
  assert.match(await id('keypad-aside').innerText(), /Plates per side\s*25 · 15/);
  for (const k of ['2', '0', '0', '0', '0']) await id(`key-${k}`).click();
  assert.match(await id('keypad-value').innerText(), /^20000/);
  assert.equal(await id('keypad-aside').count(), 0, 'no plates for 20000 kg');
  await id('key-next').click();
  await page.waitForTimeout(300);
  assert.match(await id('in-w-s1').inputValue(), /^20[,.]?000$/, 'kept as typed');
  assert.deepEqual(errors, []);
  await ctx.close();
  ok('workout keypad: 100 kg shows plates per side (25 · 15); 20000 kg is kept as typed, without plates');
}

await browser.close();
console.log(`\n${passed} checks passed`);
