// Design todo group 3: the first Tally Workouts list, before further polish.
// REVIEW_BEFORE=1 captures matching screens from main without new assertions.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';
import { buildStats, workoutVolume, exerciseDisplayName, startOfMonth, startOfDay, calendarMonth } from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const checksOnly = process.env.WORKOUTS_CHECKS_ONLY === '1';
const OUT = shots(before ? 'before' : 'after');
const browser = await launch();
const normal = value => value.replace(/\s+/g, ' ').trim();
const hm = ms => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const dayKey = at => { const d = new Date(at); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
let passed = 0;
const ok = label => { passed++; console.log('PASS', label); };

async function newPage(data, lang, theme) {
  data.kv.settings.theme = theme;
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale, colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript(data => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, data);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|DevTools/.test(message.text())) errors.push(message.text()); });
  const id = value => page.getByTestId(value);
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${lang}-${theme}-${name}.png`) }); };
  return { ctx, page, errors, id, shot, locale };
}

try {
  if (!checksOnly) for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const data = demoData(lang);
    const sorted = [...data.workouts].sort((a, b) => b.startedAt - a.startedAt);
    const newest = sorted[0];
    const lib = new Map(data.exercises.map(ex => [ex.id, ex]));
    const prs = buildStats(data.workouts, lib, data.kv.settings.formula).prsByWorkout.get(newest.id) || [];
    const records = new Set(prs.map(pr => pr.setId)).size;
    const sets = newest.exercises.reduce((n, entry) => n + entry.sets.length, 0);
    const warmups = newest.exercises.flatMap(entry => entry.sets).filter(set => set.type === 'warmup').length;
    const { ctx, page, errors, id, shot, locale } = await newPage(data, lang, theme);
    await page.goto(APP);
    await id('tab-progress').click();
    await id('progress-workouts').click();
    const row = id(`workout-${newest.id}`);
    await row.waitFor();
    await shot('list');
    if (!before) {
      const text = normal(await row.innerText());
      assert.ok(text.startsWith(newest.name), text);
      assert.doesNotMatch(await page.locator('body').innerText(), /\bPRs?\b|EXERCISE|BEST SET|ÜBUNG|BESTER SATZ/);
      const meta = normal(await id(`history-meta-${newest.id}`).innerText());
      const vol = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(workoutVolume(newest, lib));
      assert.ok(meta.includes(`${hm(newest.endedAt - newest.startedAt)} · ${vol} kg`), meta);
      const year = new Date(newest.startedAt).getFullYear();
      assert.equal(meta.includes(String(year)), year !== new Date().getFullYear(), meta);
      assert.equal(normal(await id(`history-records-${newest.id}`).innerText()), `${records} ${lang === 'de' ? 'Rekorde' : 'records'}`);
      // A metric can earn several PR entries on the same set. The list counts
      // record sets, exactly like the tally on the finished workout page.
      assert.ok(prs.length > records, 'the fixture distinguishes metric records from record sets');
      const tally = id(`history-tally-${newest.id}`);
      assert.equal(await tally.getAttribute('aria-label'), `${sets} ${lang === 'de' ? 'Sätze' : 'sets'} · ${records} ${lang === 'de' ? 'Rekorde' : 'records'}`);
      const marks = await tally.locator('div').evaluateAll(elements => elements.filter(e => !e.children.length).map(e => {
        const s = getComputedStyle(e), rgb = s.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
        return { width: parseFloat(s.width), height: parseFloat(s.height), rgb };
      }).filter(s => s.width > 0 && s.height > 0 && s.rgb.length >= 3 && (s.rgb.length < 4 || s.rgb[3] > 0)));
      assert.equal(marks.length, sets, 'one drawn stroke per set');
      const fullHeight = Math.max(...marks.map(mark => mark.height));
      assert.equal(marks.filter(mark => mark.height < fullHeight * 0.7).length, warmups, 'warm-up strokes are shorter');
      const signal = marks.filter(({ rgb: [r, g, b] }) => r > 100 && g > 80 && b < Math.min(r, g) * 0.6);
      assert.equal(signal.length, records, 'only the record sets have signal strokes');
      const exercises = id(`history-exercises-${newest.id}`);
      const names = newest.exercises.map(entry => exerciseDisplayName(lib.get(entry.exerciseId), lang));
      assert.equal(normal(await exercises.innerText()), names.join(', '));
      const line = await exercises.evaluate(e => { const s = getComputedStyle(e); return { height: e.getBoundingClientRect().height, lineHeight: parseFloat(s.lineHeight), clamp: s.webkitLineClamp, whiteSpace: s.whiteSpace }; });
      assert.ok(line.clamp === '1' || line.whiteSpace === 'nowrap' || line.height <= line.lineHeight + 1, JSON.stringify(line));
      const card = await row.evaluate(e => [...e.querySelectorAll('div')].some(child => {
        const s = getComputedStyle(child), r = child.getBoundingClientRect();
        return parseFloat(s.borderRadius) > 0 && r.width > e.getBoundingClientRect().width * 0.8 && r.height > 50 && !['transparent', 'rgba(0, 0, 0, 0)'].includes(s.backgroundColor);
      }));
      assert.equal(card, false, 'the workout is a row without an inset card');
      const month = startOfMonth(newest.startedAt);
      const count = data.workouts.filter(workout => startOfMonth(workout.startedAt) === month).length;
      assert.ok(normal(await id(`history-month-${month}`).innerText()).endsWith(`${count} ${lang === 'de' ? 'Trainings' : 'workouts'}`));
      ok(`${lang} ${theme}: full-width list content, translated exercise line, month count, one stroke per set and distinct record sets`);
    }
    for (const [width, name] of [[375, 'list-375'], [1280, 'list-desktop']]) {
      await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
      await shot(name);
      if (!before) {
        const r = await row.boundingBox();
        assert.ok(Math.abs(r.width - Math.min(width, 600)) <= 1, JSON.stringify(r));
        assert.ok(Math.abs(r.x - Math.max(0, (width - 600) / 2)) <= 1, JSON.stringify(r));
        const meta = await id(`history-meta-${newest.id}`).boundingBox();
        assert.ok(meta.x >= r.x && meta.x + meta.width <= r.x + r.width + 1, JSON.stringify(meta));
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (!before) {
      await row.click();
      await id('workout-title').waitFor();
      assert.equal(await id('workout-title').innerText(), newest.name);
      assert.equal(await id('workout-tally').getAttribute('aria-label'), `${sets} ${lang === 'de' ? 'Sätze' : 'sets'} · ${records} ${lang === 'de' ? 'Rekorde' : 'records'}`);
      await page.goBack();
      await row.waitFor();
      ok(`${lang} ${theme}: phone/desktop row widths and tapping through to the matching workout tally`);
    }
    await id('history-view').click();
    await id('cal-stats').waitFor();
    const now = new Date(), newestDate = new Date(newest.startedAt);
    const monthSteps = (now.getFullYear() - newestDate.getFullYear()) * 12 + now.getMonth() - newestDate.getMonth();
    for (let n = 0; n < monthSteps; n++) await id('cal-prev').click();
    await shot('calendar');
    const cal = calendarMonth(data.workouts, newest.startedAt, { weekStart: data.kv.settings.weekStart });
    const stats = normal(await id('cal-stats').innerText());
    assert.ok(stats.includes(hm(cal.time)), stats);
    await id(`cal-${dayKey(newest.startedAt)}`).click();
    await row.waitFor();
    await shot('calendar-selected');
    if (!before) {
      // The calendar still has its original best-set table and day navigation.
      assert.match(await row.innerText(), lang === 'de' ? /bester satz/i : /best set/i);
      assert.doesNotMatch(await row.innerText(), /\bPRs?\b/);
      await row.click();
      await id('workout-title').waitFor();
      assert.equal(await id('workout-title').innerText(), newest.name);
      ok(`${lang} ${theme}: the calendar grid, h:mm totals and selected-day card still open the workout`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  if (!before) for (const lang of ['en', 'de']) {
    const data = demoData(lang);
    const today = new Date(); today.setHours(8, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekday = new Date(today); weekday.setDate(weekday.getDate() - 3);
    const pastYear = new Date(today.getFullYear() - 1, 9, 3, 8);
    const older = new Date(today.getFullYear(), 0, 1, 8);
    const examples = [['today', today], ['yesterday', yesterday], ['weekday', weekday], ['past-year', pastYear]];
    if (startOfDay(today) - startOfDay(older) >= 7 * 86400000) examples.push(['older', older]);
    data.workouts = examples.map(([key, at]) => ({ id: `dates-${key}`, name: key, startedAt: at.getTime(), endedAt: at.getTime() + 71 * 60000,
      exercises: [{ id: `dates-entry-${key}`, exerciseId: 'x-bench-press-barbell', sets: [{ id: `dates-set-${key}`, type: 'normal', w: 50, r: 5 }] }] }));
    const { ctx, page, errors, id, locale } = await newPage(data, lang, 'light');
    await page.goto(APP + '/history');
    assert.ok((await id('history-meta-dates-today').innerText()).startsWith(lang === 'de' ? 'Heute ·' : 'Today ·'));
    const yesterdayLabel = yesterday.getFullYear() === today.getFullYear()
      ? (lang === 'de' ? 'Gestern' : 'Yesterday')
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(yesterday);
    assert.ok((await id('history-meta-dates-yesterday').innerText()).startsWith(`${yesterdayLabel} ·`));
    const weekdayLabel = new Intl.DateTimeFormat(locale, weekday.getFullYear() === today.getFullYear()
      ? { weekday: 'long' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(weekday);
    assert.ok((await id('history-meta-dates-weekday').innerText()).startsWith(`${weekdayLabel} ·`));
    const past = normal(await id('history-meta-dates-past-year').innerText());
    assert.ok(past.startsWith(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(pastYear)), past);
    if (examples.some(([key]) => key === 'older')) {
      const olderText = normal(await id('history-meta-dates-older').innerText());
      assert.ok(olderText.startsWith(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(older)), olderText);
      assert.ok(!olderText.includes(String(today.getFullYear())), olderText);
    }
    for (const [key] of examples) {
      assert.equal(await id(`history-records-dates-${key}`).count(), 0, 'an unchanged workout has no record label');
    }
    assert.deepEqual(errors, []);
    await ctx.close();
    ok(`${lang}: Today/Yesterday/weekday, older current-year and past-year dates; unchanged sets earn no record label`);
  }

  if (!before) {
    const data = demoData('en');
    // Forty-five sessions in one month: the heading must count all of them
    // before the initial 40-row limit has been expanded.
    const at = new Date(); at.setDate(15); at.setHours(8, 0, 0, 0);
    const base = data.workouts[0];
    data.workouts = Array.from({ length: 45 }, (_, i) => ({ ...structuredClone(base), id: `page-${i}`, name: `Session ${i}`, startedAt: at.getTime() - i * 60000, endedAt: at.getTime() - i * 60000 + 71 * 60000 }));
    const { ctx, page, errors, id } = await newPage(data, 'en', 'light');
    await page.goto(APP + '/history');
    assert.ok(normal(await id(`history-month-${startOfMonth(at.getTime())}`).innerText()).endsWith('45 workouts'));
    const older = page.getByRole('button', { name: 'Show older workouts', exact: true });
    await older.scrollIntoViewIfNeeded();
    await older.click();
    assert.equal(await older.count(), 0);
    await page.locator('[data-testid^="workout-"]').last().scrollIntoViewIfNeeded();
    await id('workout-page-44').waitFor();
    await id('workout-page-44').click();
    await id('workout-title').waitFor();
    assert.equal(await id('workout-title').innerText(), 'Session 44');
    assert.deepEqual(errors, []);
    await ctx.close();
    ok('month counts include every workout beyond the initial limit; Show older workouts reveals the last session');
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
