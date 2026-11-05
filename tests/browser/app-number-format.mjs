// Design todo group 2: one format for workout figures, with realistic review
// screenshots and edge cases for large volumes, converted units and precision.
// REVIEW_BEFORE=1 captures the same demo screens on the unchanged baseline.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';
import { est1RM, kgTo, roundW, toKg, workoutVolume, calendarMonth } from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const toolsOnly = process.env.REVIEW_TOOLS_ONLY === '1';
const checksOnly = process.env.NUMBER_CHECKS_ONLY === '1';
const OUT = shots(before ? 'before' : 'after');
const browser = await launch();
const BENCH = 'x-bench-press-barbell', PRESS = 'x-leg-press-machine', DEAD = 'x-deadlift-barbell';
const normal = text => text.replace(/\s+/g, ' ').trim();
const hm = ms => { const minutes = Math.round(ms / 60000); return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`; };
let passed = 0;
const ok = label => { passed++; console.log('PASS', label); };

async function newPage(data, lang, theme) {
  data.kv.settings.theme = theme;
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript(data => {
    if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data));
    Object.defineProperty(navigator, 'share', { configurable: true, value: async content => { window.__sharedText = content.text; } });
  }, data);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  const id = name => page.getByTestId(name);
  const go = async route => { await page.goto(APP + route); await page.waitForTimeout(350); };
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${lang}-${theme}-${name}.png`) }); };
  return { ctx, page, errors, id, go, shot };
}

// These stay the real 16-week demo: screenshots should show normal training,
// rather than the deliberately extreme values in the regressions below.
try {
  if (!checksOnly) for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const data = demoData(lang);
    const { ctx, page, errors, id, go, shot } = await newPage(data, lang, theme);
    const newest = data.workouts.reduce((a, b) => a.startedAt > b.startedAt ? a : b);
    if (!toolsOnly) {
      await go('/history');
      await id(`workout-${newest.id}`).waitFor();
      await shot('history');
      await id('history-view').click();
      await id('cal-stats').waitFor();
      await shot('calendar');
      await go(`/workout/${newest.id}`);
      await id('workout-title').waitFor();
      await shot('workout');
      await go(`/summary/${newest.id}`);
      await id('summary-title').waitFor();
      await shot('summary');
      await go('/records');
      await id('record-0').waitFor();
      await shot('records');
      await go('/');
      await id('tab-progress').click();
      await id('last-30').waitFor();
      await shot('progress');
      await go('/exercise/x-squat-barbell');
      await id('exercise-hero').waitFor();
      await shot('exercise');
    }
    await go('/tools?tab=rm');
    await id('rm-w').fill('58.74');
    await id('rm-r').fill('7');
    await shot('tools-rm');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  if (!before) for (const lang of ['en', 'de']) for (const unit of ['kg', 'lb']) {
    const data = demoData(lang);
    data.kv.settings.unit = unit;
    const day = new Date(); day.setDate(Math.min(15, day.getDate())); day.setHours(0, 0, 0, 0);
    const workout = (key, hour, exerciseId, sets) => ({ id: `format-${key}`, name: `Format ${key}`, startedAt: day.getTime() + hour * 3600000, endedAt: day.getTime() + hour * 3600000 + 71 * 60000, exercises: [{ id: `entry-${key}`, exerciseId, sets }] });
    const precise = workout('precise', 18, BENCH, [
      { id: 'precise-record', type: 'normal', w: 58.75, r: 7 },
      { id: 'precise-repeat', type: 'normal', w: 58.75, r: 7 },
    ]);
    // 58.74 × 7 estimates 72.446 kg: rounding to hundredths first would
    // incorrectly show 72.5 instead of the exercise hero's 72.4.
    precise.exercises.push({ id: 'entry-rounding', exerciseId: DEAD, sets: [
      { id: 'rounding-record', type: 'normal', w: 58.74, r: 7 },
      { id: 'rounding-repeat', type: 'normal', w: 58.74, r: 7 },
    ] });
    const large = workout('large', 16, PRESS, [{ id: 'large-set', type: 'normal', w: 157.4, r: 1000 }]);
    const medium = workout('medium', 14, PRESS, [{ id: 'medium-set', type: 'normal', w: 157.4, r: 100 }]);
    const zero = workout('zero', 12, BENCH, [{ id: 'zero-set', type: 'normal', w: 0, r: 5 }]);
    const baseline = workout('baseline', 10, BENCH, [{ id: 'baseline-bench', type: 'normal', w: 50, r: 5 }]);
    baseline.exercises.push({ id: 'entry-baseline-dead', exerciseId: DEAD, sets: [{ id: 'baseline-dead', type: 'normal', w: 50, r: 5 }] });
    data.workouts = [precise, large, medium, zero, baseline];
    const { ctx, page, errors, id, go } = await newPage(data, lang, 'light');
    const nf = (value, digits = 0) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: digits }).format(value);
    const lib = new Map(data.exercises.map(ex => [ex.id, ex]));
    const volume = w => `${nf(kgTo(workoutVolume(w, lib), unit))} ${unit}`;
    const rm = nf(kgTo(est1RM(58.75, 7, 'epley'), unit), 1);
    const timeLabel = lang === 'de' ? 'Zeit' : 'Time';

    await go('/history');
    for (const w of [medium, large]) {
      const row = normal(await id(`workout-${w.id}`).innerText());
      assert.ok(row.includes(volume(w)), `history: ${row} should contain ${volume(w)}`);
      assert.ok(row.includes('1:11'), `history: ${row}`);
      assert.doesNotMatch(row, /1h|1 h|k kg/);
    }
    await id('history-view').click();
    await id('cal-stats').waitFor();
    const month = calendarMonth(data.workouts, day.getTime(), { weekStart: 1 });
    const calendar = normal(await id('cal-stats').innerText());
    assert.ok(calendar.includes(`${hm(month.time)} ${timeLabel}`), calendar);
    ok(`${lang} ${unit}: full history volumes above 10,000 and 100,000; h:mm in list and calendar`);

    const fits = async locator => {
      const size = await locator.evaluate(e => { const value = e.lastElementChild; return { shown: value.clientWidth, needed: value.scrollWidth }; });
      assert.ok(size.needed <= size.shown + 1, `full volume at 375 px: ${JSON.stringify(size)}`);
    };
    for (const w of [medium, large]) {
      if (w === large) await page.setViewportSize({ width: 375, height: 844 });
      await go(`/workout/${w.id}`);
      assert.equal(normal(await id('workout-time').innerText()), `${timeLabel} 1:11`);
      assert.ok(normal(await id('workout-volume').innerText()).endsWith(volume(w)));
      if (w === large) await fits(id('workout-volume'));
      // The unit is stated once in the stat; weighted rows only contain values.
      assert.ok(!(await id(`workout-set-${w.exercises[0].sets[0].id}`).innerText()).includes(unit));
      await id('workout-options').click();
      await page.getByRole('button', { name: lang === 'de' ? 'Als Text teilen' : 'Share as text', exact: true }).click();
      await page.waitForFunction(() => typeof window.__sharedText === 'string');
      const shared = await page.evaluate(() => window.__sharedText);
      assert.ok(shared.includes(volume(w)), `shared text: ${shared}`);
      await go(`/summary/${w.id}`);
      assert.ok(normal(await id('summary-volume').innerText()).endsWith(volume(w)));
      assert.equal(normal(await id('summary-time').innerText()), `${timeLabel} 1:11`);
      if (w === large) await fits(id('summary-volume'));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    ok(`${lang} ${unit}: full workout and summary volumes, sharing, and unit-free weighted rows`);

    await go('/records');
    const record = normal(await id('record-0').innerText());
    assert.ok(record.endsWith(`${rm} ${unit}`), `${record}: expected estimated 1RM ${rm} ${unit}`);
    const edgeRm = nf(kgTo(est1RM(58.74, 7, 'epley'), unit), 1);
    assert.ok(normal(await id('record-1').innerText()).endsWith(`${edgeRm} ${unit}`), 'estimated records are rounded once');
    await go(`/exercise/${DEAD}`);
    assert.equal(normal(await id('exercise-hero').innerText()), `${edgeRm} ${unit}`);
    await go(`/exercise/${BENCH}`);
    assert.equal(normal(await id('exercise-hero').innerText()), `${rm} ${unit}`);
    // Heaviest weight is a logged weight: 58.75 kg stays 58.75 (129.5 lb), not 58.8
    await id('exercise-metric').click();
    await id('metric-weight').click();
    const heaviest = unit === 'kg' ? nf(58.75, 2) : nf(roundW(kgTo(58.75, 'lb'), 'lb'), 1);
    assert.equal(normal(await id('exercise-hero').innerText()), `${heaviest} ${unit}`, 'Heaviest weight keeps the logged precision');
    await go(`/workout/${precise.id}`);
    const repeat = normal(await id('workout-set-precise-repeat').innerText());
    assert.ok(repeat.endsWith(`1RM ${rm}`), repeat);
    assert.ok(normal(await id('workout-set-rounding-repeat').innerText()).endsWith(`1RM ${edgeRm}`), 'the workout matches the exercise hero at rounding boundaries');
    await go(`/summary/${precise.id}`);
    assert.ok(normal(await id(`pr-${DEAD}`).innerText()).endsWith(`${edgeRm} ${unit}`), 'summary estimated records are rounded once too');
    if (unit === 'kg') {
      assert.ok(repeat.includes(`${nf(58.75, 2)} × 7`), repeat);
      const summary = normal(await id(`pr-${BENCH}`).innerText());
      assert.ok(summary.includes(`${nf(58.75, 2)} kg × 7`), summary);
      assert.ok(summary.includes(`${lang === 'de' ? 'Gewicht' : 'Weight'} ${nf(58.75, 2)} kg`), summary);
    }
    await go(`/workout/${zero.id}`);
    assert.ok(normal(await id('workout-set-zero-set').innerText()).includes(`0 ${unit} × 5`), 'a zero-volume workout still states the weight unit on its set');
    ok(`${lang} ${unit}: one-decimal estimated 1RM on Records, exercise and workout; logged precision (also the exercise's Heaviest weight) and zero-volume units preserved`);

    await go('/tools?tab=rm');
    const toolWeight = unit === 'kg' ? 58.74 : 129.5;
    await id('rm-w').fill(String(toolWeight));
    await id('rm-r').fill('7');
    const toolRm = nf(kgTo(est1RM(toKg(toolWeight, unit), 7, 'epley'), unit), 1);
    await page.getByText(`${toolRm} ${unit}`, { exact: true }).first().waitFor();

    await go('/');
    await id('tab-progress').click();
    const totals = normal(await id('last-30').innerText());
    const v = kgTo(data.workouts.reduce((sum, w) => sum + workoutVolume(w, lib), 0), unit);
    const totalText = unit === 'kg' ? `${nf(v / 1000, v >= 100000 ? 0 : 1)} t` : `${nf(v / 1000, v >= 100000 ? 0 : 1)}k lb`;
    assert.ok(totals.includes(totalText), `${totals}: expected total ${totalText}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
