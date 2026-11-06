// Design todo group 6. REVIEW_BEFORE=1 captures the unchanged review baseline.
import assert from 'node:assert/strict';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';
import {
  DAY, PR_LABEL, buildStats, exerciseDisplayName, exerciseBaseName, kgTo, kmTo, roundW, translator, workoutVolume,
} from '../../core/index.js';

const before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(before ? 'before' : 'after');
const browser = await launch();
const normal = text => text.replace(/\s+/g, ' ').trim();
const locale = lang => lang === 'de' ? 'de-DE' : 'en-US';
const num = (lang, value, digits = 0) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(value);
let passed = 0;
const ok = label => { passed++; console.log('PASS', label); };

async function scenario(data, lang, theme) {
  data.kv.settings.theme = theme;
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: locale(lang), colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript(data => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, data);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error' && !/favicon|DevTools/.test(message.text())) errors.push(message.text()); });
  const id = value => page.getByTestId(value);
  const go = async route => { await page.goto(APP + route); await page.waitForTimeout(350); };
  const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${lang}-${theme}-${name}.png`) }); };
  return { ctx, page, errors, id, go, shot };
}

// Compare roles within the current theme, rather than pinning a particular RGB.
async function neutral(locator, ink) {
  const colors = await locator.evaluate(e => [e, ...e.querySelectorAll('*')].map(node => {
    const s = getComputedStyle(node);
    return { background: s.backgroundColor, color: s.color, text: node.childElementCount ? '' : node.textContent.trim() };
  }));
  for (const s of colors) {
    const rgb = s.background.match(/[\d.]+/g)?.map(Number) || [];
    if (rgb.length >= 3 && (rgb.length < 4 || rgb[3] > 0)) assert.ok(Math.max(...rgb.slice(0, 3)) - Math.min(...rgb.slice(0, 3)) < 25, `neutral background: ${JSON.stringify(s)}`);
  }
  assert.ok(colors.some(s => s.text && /\d/.test(s.text) && s.color === ink), `a value uses the main ink: ${JSON.stringify(colors)}`);
}

async function uncut(locator) {
  const box = await locator.evaluate(e => {
    const s = getComputedStyle(e), r = e.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(e);
    return {
      text: e.textContent, width: e.clientWidth, needed: e.scrollWidth, height: e.clientHeight, neededHeight: e.scrollHeight,
      clamp: s.webkitLineClamp, overflow: s.textOverflow,
      inside: [...range.getClientRects()].every(t => t.left >= r.left - 1 && t.right <= r.right + 1 && t.top >= r.top - 1 && t.bottom <= r.bottom + 1),
    };
  });
  assert.ok(box.width > 0 && box.needed <= box.width + 1 && box.neededHeight <= box.height + 1 && box.inside, JSON.stringify(box));
  assert.ok(!box.clamp || box.clamp === 'none' || box.clamp === '0', JSON.stringify(box));
  assert.notEqual(box.overflow, 'ellipsis', JSON.stringify(box));
}

function recordRows(data) {
  const exercises = new Map(data.exercises.map(ex => [ex.id, ex]));
  const stats = buildStats(data.workouts, exercises, data.kv.settings.formula);
  const rows = [];
  for (const workout of [...data.workouts].sort((a, b) => b.startedAt - a.startedAt)) {
    const grouped = new Map();
    for (const record of stats.prsByWorkout.get(workout.id) || []) {
      if (!grouped.has(record.exerciseId)) grouped.set(record.exerciseId, []);
      grouped.get(record.exerciseId).push(record);
    }
    for (const [exerciseId, records] of grouped) rows.push({ workout, exercise: exercises.get(exerciseId), records });
  }
  return rows;
}

function recordValue(record, data, lang) {
  const unit = data.kv.settings.unit, distanceUnit = data.kv.settings.distUnit;
  if (record.metric === 'e1rm') return `${num(lang, kgTo(record.value, unit), 1)} ${unit}`;
  if (record.metric === 'weight' || record.metric === 'volume') return `${num(lang, roundW(kgTo(record.value, unit), unit), unit === 'lb' ? 1 : 2)} ${unit}`;
  if (record.metric === 'distance') return `${num(lang, kmTo(record.value, distanceUnit), 2)} ${distanceUnit}`;
  if (record.metric === 'time') return `${Math.floor(record.value / 60)}:${String(Math.round(record.value) % 60).padStart(2, '0')}`;
  return num(lang, record.value);
}

async function recordsMatch(id, data, lang, count) {
  const tr = translator(lang);
  for (const [index, row] of recordRows(data).slice(0, count).entries()) {
    const lead = ['e1rm', 'weight', 'reps', 'distance', 'time', 'volume'].map(metric => row.records.find(record => record.metric === metric)).find(Boolean);
    assert.equal(await id(`record-title-${index}`).innerText(), exerciseDisplayName(row.exercise, lang));
    assert.equal(normal(await id(`record-value-${index}`).innerText()), recordValue(lead, data, lang));
    const parts = (await id(`record-meta-${index}`).innerText()).split(' · ');
    assert.equal(parts[1], tr(PR_LABEL[lead.metric]), 'the subtitle names the metric displayed on the right');
    const others = row.records.length - 1;
    assert.equal(parts.length, others ? 3 : 2, 'only the lead metric and an optional other-record count');
    if (others) assert.equal(parts[2], tr(others === 1 ? '1 more' : '{n} more', { n: others }));
    const date = new Date(row.workout.startedAt), today = new Date(), year = date.getFullYear();
    const civilDay = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
    const days = (civilDay(today) - civilDay(date)) / DAY;
    const expectedDate = year !== today.getFullYear()
      ? new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
      : days <= 0 ? tr('Today') : days === 1 ? tr('Yesterday')
        : new Intl.DateTimeFormat(locale(lang), days < 7 ? { weekday: 'long' } : { day: 'numeric', month: 'short' }).format(date);
    assert.equal(parts[0], expectedDate, 'recent dates use day names; the year appears only for older years');
    for (const field of ['title', 'meta', 'value']) await uncut(id(`record-${field}-${index}`));
    const title = await id(`record-title-${index}`).boundingBox(), value = await id(`record-value-${index}`).boundingBox();
    assert.ok(title.x + title.width < value.x && value.x + value.width <= 375 - 19, `title/value stay in separate columns: ${JSON.stringify({ title, value })}`);
  }
}

try {
  for (const lang of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const data = demoData(lang), tr = translator(lang);
    const { ctx, page, errors, id, go, shot } = await scenario(data, lang, theme);

    await go('/exercise/x-squat-barbell');
    await id('exercise-hero').waitFor();
    await shot('exercise-top');
    if (!before) {
      const ink = await id('exercise-hero').evaluate(e => getComputedStyle(e).color);
      await neutral(id('exercise-best'), ink);
      const signal = await id('exercise-hero').evaluate(e => {
        const colored = [...e.parentElement.querySelectorAll('*')].find(node => {
          const s = getComputedStyle(node), rgb = s.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
          return /^\+/.test(node.textContent) && rgb.length >= 3 && Math.max(...rgb.slice(0, 3)) - Math.min(...rgb.slice(0, 3)) > 40;
        });
        return colored ? getComputedStyle(colored).backgroundColor : null;
      });
      assert.ok(signal, 'the positive hero change retains its coloured highlight');
      const dots = await id('exercise-chart').locator('circle').evaluateAll(nodes => nodes.map(node => ({ fill: getComputedStyle(node).fill, stroke: getComputedStyle(node).stroke, strokeWidth: parseFloat(getComputedStyle(node).strokeWidth) })));
      assert.ok(dots.length > 1, 'the progressing demo has record dots');
      assert.ok(dots.every(dot => dot.fill === signal && dot.stroke !== 'none' && dot.strokeWidth > 0), 'record dots retain the same signal as the hero change');
      ok(`${lang} ${theme}: Best set is ink; hero change and chart record dots retain signal`);
    }
    await id('exercise-best').evaluate(e => e.scrollIntoView({ block: 'start' }));
    await id('repmax-5').waitFor({ state: 'visible' });
    await shot('exercise-repmaxes');
    if (!before) {
      const ink = await id('exercise-hero').evaluate(e => getComputedStyle(e).color);
      for (const row of await page.locator('[data-testid^="repmax-"]').all()) {
        await neutral(row, ink);
        assert.equal(await row.getByText(/^[\d,.]+ kg$/).evaluate(e => getComputedStyle(e).color), ink, 'the rep max load itself uses ink');
      }
      ok(`${lang} ${theme}: rep max values are plain ink`);
    }

    await go('/records');
    await id('record-0').waitFor();
    await shot('records-390');
    await page.setViewportSize({ width: 375, height: 844 });
    await shot('records-375');
    if (!before) {
      await recordsMatch(id, data, lang, 6);
      await id('record-0').click();
      await id('exercise-title').waitFor();
      assert.equal(await id('exercise-title').innerText(), exerciseBaseName(recordRows(data)[0].exercise, lang));
      ok(`${lang} ${theme}: Records name their headline value, count the others, omit the current year and fit at 375 px; rows still open the exercise`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await go('/');
    await id('tab-progress').click();
    await id('last-30').waitFor();
    await shot('progress');
    if (!before) {
      const lib = new Map(data.exercises.map(ex => [ex.id, ex]));
      const stats = buildStats(data.workouts, lib, data.kv.settings.formula);
      const recent = data.workouts.filter(workout => workout.startedAt >= Date.now() - 30 * DAY);
      // record sets, the same count the Workouts rows, the workout page and the summary show
      const records = recent.reduce((sum, workout) => sum + new Set((stats.prsByWorkout.get(workout.id) || []).map(record => record.setId)).size, 0);
      const volume = recent.reduce((sum, workout) => sum + workoutVolume(workout, lib), 0);
      const total = volume >= 10000 ? `${num(lang, volume / 1000, volume >= 100000 ? 0 : 1)} t` : `${num(lang, volume)} kg`;
      assert.equal(normal(await id('last-30').innerText()), `${tr('Workouts')} ${num(lang, recent.length)} ${tr('Volume')} ${total} ${tr('Records')} ${num(lang, records)}`);
      for (const [key, label, destination] of [['workouts', 'Workouts', 'history-view'], ['lifts', 'Lifts', 'lifts-search'], ['records', 'Records', 'record-0']]) {
        const text = normal(await id(`progress-${key}`).innerText());
        assert.ok(text.includes(tr(label)), text);
        assert.doesNotMatch(text, /\d/, 'navigation rows have no all-time counts');
        await id(`progress-${key}`).click();
        await id(destination).waitFor();
        await page.goBack();
        await id('last-30').waitFor();
      }
      const latest = [...data.measurements].filter(value => value.type === 'bodyweight').sort((a, b) => b.at - a.at)[0];
      assert.ok(normal(await id('progress-body').innerText()).includes(`${num(lang, roundW(latest.value, 'kg'), 1)} kg`), 'Body keeps its latest measurement');
      ok(`${lang} ${theme}: Progress counts record sets like the Workouts rows, keeps the other 30-day figures and Body, with working count-free navigation`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  if (!before) for (const lang of ['en', 'de']) {
    const data = demoData(lang), now = new Date(), year = now.getFullYear();
    const longName = lang === 'de' ? 'Ausfallschritte mit angehobenem hinterem Fuß und langem Namen' : 'Rear foot elevated split squat with a deliberately long name';
    const custom = [
      { id: 'c-noise-reps', name: longName, category: 'reps', bodyPart: 'legs' },
      { id: 'c-noise-cardio', name: 'Record distance', category: 'cardio', bodyPart: 'cardio' },
      { id: 'c-noise-barbell', name: 'Record load', category: 'barbell', bodyPart: 'legs' },
    ];
    data.exercises.push(...custom);
    const workout = (id, at, entries) => ({ id, name: id, startedAt: at, endedAt: at + 3600000, exercises: entries.map(([exerciseId, ...sets], index) => ({ id: `${id}-${index}`, exerciseId, sets: sets.map((values, n) => ({ id: `${id}-set-${index}-${n}`, type: 'normal', ...values })) })) });
    // Three exercises are enough to exercise zero, one and two other records.
    // Record load's second set beats only the set volume, so its three records sit on two sets.
    // A previous-year record and a long custom name stress both metadata and title wrapping.
    data.workouts = [
      workout('noise-new', now.getTime() - DAY, [['c-noise-cardio', { d: 2, t: 600 }], ['c-noise-barbell', { w: 58.75, r: 7 }, { w: 50, r: 12 }]]),
      workout('noise-old', new Date(year - 1, 5, 6, 12).getTime(), [['c-noise-reps', { r: 11 }]]),
      workout('noise-baseline', new Date(year - 1, 0, 2, 12).getTime(), [['c-noise-reps', { r: 10 }], ['c-noise-cardio', { d: 1, t: 300 }], ['c-noise-barbell', { w: 50, r: 5 }]]),
    ];
    const { ctx, page, errors, id, go } = await scenario(data, lang, 'light');
    await page.setViewportSize({ width: 375, height: 844 });
    await go('/records');
    await id('record-0').waitFor();
    assert.deepEqual(recordRows(data).map(row => row.records.length), [2, 3, 1]);
    await recordsMatch(id, data, lang, 3);
    const longTitle = await id('record-title-2').evaluate(e => ({ height: e.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) }));
    assert.ok(longTitle.height > longTitle.line * 1.5, 'long exercise names wrap onto multiple lines');
    ok(`${lang}: one, two and three record metrics; singular/plural others, a past year and a complete long name at 375 px`);
    // two exercises set records yesterday, on three sets: Progress counts the sets, as the Workouts row does
    const lib = new Map(data.exercises.map(ex => [ex.id, ex]));
    const yesterday = buildStats(data.workouts, lib, data.kv.settings.formula).prsByWorkout.get('noise-new');
    assert.equal(new Set(yesterday.map(record => record.setId)).size, 3);
    assert.equal(new Set(yesterday.map(record => record.exerciseId)).size, 2);
    await go('/history');
    assert.equal(normal(await id('history-records-noise-new').innerText()), lang === 'de' ? '3 Rekorde' : '3 records');
    await go('/');
    await id('tab-progress').click();
    await id('last-30').waitFor();
    assert.ok(normal(await id('last-30').innerText()).endsWith(`${translator(lang)('Records')} 3`), await id('last-30').innerText());
    ok(`${lang}: Progress's 30-day records and the Workouts row both count 3 record sets, not 2 exercises`);
    await go('/exercise/c-noise-reps');
    await id('exercise-best').waitFor();
    assert.ok((await id('exercise-best').innerText()).includes(translator(lang)('Most reps')));
    await neutral(id('exercise-best'), await id('exercise-hero').evaluate(e => getComputedStyle(e).color));
    ok(`${lang}: a new Most reps record also uses neutral ink`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
