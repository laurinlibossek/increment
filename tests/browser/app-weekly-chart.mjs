// Workouts per week on Progress (#122): the goal's label sits at the start of
// its dashed line, drawn over the bars with an outline in the paper colour.
// The end of the line belongs to this week, whose number is always shown, so
// "Goal 5" and this week's "5" never land on each other ("Goa5 5"), with this
// week at the goal or above it, in every theme and in German. Touching a week
// whose number would land on the label hides the label while the bubble shows.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, selectTab } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION, weeklyCounts } from '../../core/index.js';

const OUT = shots('app-weekly-chart');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

// eleven past weeks around a goal of 5, then this week
const PAST = [3, 5, 5, 5, 3, 4, 5, 5, 4, 5, 5];
const now = Date.now();
const starts = weeklyCounts([], { weeks: 12, weekStart: 1, now }).map((w) => w.start);
const workouts = (thisWeek) => [...PAST, thisWeek].flatMap((n, wi) => Array.from({ length: n }, (_, k) => {
  const from = starts[wi], to = wi === 11 ? now : from + 7 * 86400000;
  const at = from + Math.floor(((to - from) * (k + 1)) / (n + 1));
  return { id: `w${wi}-${k}`, name: 'Workout', startedAt: at, endedAt: at + 1000, exercises: [] };
}));
const data = (thisWeek, theme, language) => ({
  exercises: SEED_EXERCISES, workouts: workouts(thisWeek), templates: [], measurements: [],
  kv: { settings: { language, theme, weeklyGoal: 5, showExamples: false, appKeepAwake: false }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now } },
});

async function open(thisWeek, { theme = 'system', scheme = 'light', language = 'en' } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale: language === 'de' ? 'de-DE' : 'en-US', colorScheme: scheme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data(thisWeek, theme, language)));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(APP);
  await selectTab(page, 'progress');
  const chart = page.getByTestId('weekly-chart');
  await chart.locator('svg text').first().waitFor();
  await chart.scrollIntoViewIfNeeded();
  return { ctx, page, errors, chart };
}

// what the chart drew: its labels with their boxes, the bars, and the order they're drawn in
const drawn = (chart) => chart.locator('svg').evaluate((svg) => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; };
  const all = [...svg.querySelectorAll('*')];
  const texts = [...svg.querySelectorAll('text')].map((el) => ({
    text: el.textContent, hidden: el.getAttribute('aria-hidden') === 'true', bold: Number(getComputedStyle(el).fontWeight) >= 600, stroke: el.getAttribute('stroke'), fill: el.getAttribute('fill'), order: all.indexOf(el), ...box(el),
  }));
  const bars = [...svg.querySelectorAll('path')].map((el) => ({ order: all.indexOf(el), ...box(el) }));
  return { texts, bars, left: svg.getBoundingClientRect().left };
});
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const goalLabels = (d, goal) => d.texts.filter((x) => x.text === goal);

// at the goal and above it, in every theme: "Goal 5" at the start of the line,
// clear of this week's number and bar, drawn over the bars with a paper outline
const VARIANTS = [
  ['light', { scheme: 'light' }], ['dark', { scheme: 'dark' }],
  ['strawberry-matcha', { theme: 'strawberry-matcha', scheme: 'light' }], ['intense-red', { theme: 'intense-red', scheme: 'dark' }],
  ['light-de', { scheme: 'light', language: 'de' }],
];
for (const [name, opts] of VARIANTS) {
  for (const thisWeek of [5, 6]) {
    const { ctx, page, errors, chart } = await open(thisWeek, opts);
    const goal = opts.language === 'de' ? 'Ziel 5' : 'Goal 5';
    const d = await drawn(chart);
    const labels = goalLabels(d, goal);
    assert.equal(labels.length, 2, `the outline and the label: ${JSON.stringify(d.texts.map((x) => x.text))}`);
    const [outline, label] = labels;
    assert.ok(outline.hidden && outline.stroke && outline.stroke === outline.fill && !label.hidden && label.fill !== outline.fill && !label.stroke, JSON.stringify(labels));
    const week = d.texts.filter((x) => x.bold);
    assert.deepEqual(week.map((x) => x.text), [String(thisWeek)], 'only this week’s number is shown');
    const bar = d.bars[d.bars.length - 1];
    assert.ok(!overlap(label, week[0]), `${goal} clear of this week’s number: ${JSON.stringify([label, week[0]])}`);
    assert.ok(!overlap(label, bar), `and of this week’s bar: ${JSON.stringify([label, bar])}`);
    assert.ok(label.x0 - d.left < 50, `at the start of the line: ${label.x0 - d.left}`);
    assert.ok(Math.min(outline.order, label.order) > Math.max(...d.bars.map((b) => b.order)), 'drawn over the bars');
    await page.screenshot({ path: `${OUT}/${name}-${thisWeek}.png` });
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  ok(`${name}: with this week at the goal (5 of 5) and above it (6), “${opts.language === 'de' ? 'Ziel' : 'Goal'} 5” sits at the start of the line, clear of this week’s number and bar, over the bars with a paper outline`);
}

// touching a week whose number lands on the label hides it while the bubble
// shows; a lower week leaves it; it comes back when the bubble goes
{
  const { ctx, page, errors, chart } = await open(5);
  const d = await drawn(chart);
  const label = goalLabels(d, 'Goal 5')[1];
  const at = (i) => ({ x: (d.bars[i].x0 + d.bars[i].x1) / 2 - d.left, y: 8 });
  await chart.click({ position: at(1) });
  await page.getByTestId('chart-tip').waitFor();
  assert.match(await page.getByTestId('chart-tip').innerText(), /^5\n/);
  const touched = await drawn(chart);
  assert.equal(goalLabels(touched, 'Goal 5').length, 0, 'hidden while the second week’s 5 would land on it');
  const five = touched.texts.find((x) => x.bold && Math.abs((x.x0 + x.x1) / 2 - (d.bars[1].x0 + d.bars[1].x1) / 2) < 2);
  assert.ok(five && overlap(label, five), 'where the label was');
  await page.screenshot({ path: `${OUT}/touch-week-2.png` });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="weekly-chart"] svg text').length && ![...document.querySelectorAll('[data-testid="chart-tip"]')].length, null, { timeout: 5000 });
  assert.equal(goalLabels(await drawn(chart), 'Goal 5').length, 2, 'back once the bubble goes');
  await chart.click({ position: at(0) });
  await page.getByTestId('chart-tip').waitFor();
  assert.match(await page.getByTestId('chart-tip').innerText(), /^3\n/);
  assert.equal(goalLabels(await drawn(chart), 'Goal 5').length, 2, 'a week of 3 leaves it');
  assert.deepEqual(errors, []);
  await ctx.close();
  ok('touching a week of 5 next to the label hides it while the bubble shows, and it comes back; touching a week of 3 leaves it');
}
await browser.close();
console.log(`\n${passed} checks passed`);
