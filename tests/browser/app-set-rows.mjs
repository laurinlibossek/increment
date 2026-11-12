// The set rows (#48): one header names the columns ("Set kg Reps", lb, time,
// distance); each set's label (W, 1, 2, D, F) opens its menu; one tick at the
// end logs and un-logs it; a logged set says what changed since last time's
// paired set ("+1 rep" up, "−0:15" grey), or Record instead; warm-ups and
// matching sets say nothing. The pinned note comes first, then the exercise's
// note, then the header. The routine editor has the header and labels, no
// ticks. Light, dark, German and lb, at 375 pt.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-set-rows');
const BENCH = 'x-bench-press-barbell', PLANK = 'x-side-plank', RUN = 'x-running';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const day = 86400000, now = Date.now();
const S = (type, o) => ({ type, ...o });
const routine = { id: 'rows', name: 'Rows', exercises: [
  { exerciseId: BENCH, notes: 'Elbows in', sets: [S('warmup', { w: 40, r: 10 }), S('normal', { w: 80, r: 8 }), S('normal', { w: 80, r: 8 }), S('drop', { w: 60, r: 10 })] },
  { exerciseId: PLANK, sets: [S('normal', { t: 60 })] },
  { exerciseId: RUN, sets: [S('normal', { d: 5, t: 1500 })] },
] };
const done = (id, at, ex) => ({ id, name: 'Rows', templateId: 'rows', startedAt: at, endedAt: at + 3600000,
  exercises: ex.map(([exerciseId, sets], i) => ({ id: `${id}e${i}`, exerciseId, sets: sets.map((x, j) => ({ id: `${id}s${i}${j}`, ...x })) })) });
// long ago: heavier and further, so today's sets are changes, not records (except 90 kg)
const old = done('w0', now - 10 * day, [[BENCH, [S('normal', { w: 85, r: 10 })]], [PLANK, [S('normal', { t: 90 })]], [RUN, [S('normal', { d: 10, t: 3000 })]]]);
const last = done('w1', now - 3 * day, routine.exercises.map((e) => [e.exerciseId, e.sets]));
const data = (language, unit = 'kg') => ({
  exercises: SEED_EXERCISES.map((e) => (e.id === BENCH ? { ...e, pinnedNote: 'Seat 4' } : e)),
  workouts: [last, old], measurements: [], templates: [routine],
  kv: { settings: { language, unit, showExamples: false, appKeepAwake: false, defaultRest: 0 }, meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now } },
});

async function open(seed, { locale = 'en-US', theme = 'light' } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, locale, colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(seed));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const id = (t) => page.getByTestId(t);
  const block = (ex) => id(`block-${ex}`);
  const ids = async (ex) => (await block(ex).locator('[data-testid^="label-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('label-'.length))));
  const texts = (ex, prefix) => block(ex).locator(`[data-testid^="${prefix}-"]`).evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const head = async (ex) => (await id(`sets-head-${ex}`).innerText()).replace(/×/g, ' ').split(/\s+/).filter(Boolean);
  const start = async () => { await page.goto(`${APP}/template/rows`); await id('start-template').click(); await block(BENCH).waitFor(); };
  return { ctx, page, errors, id, block, ids, texts, head, start };
}
const checked = async (loc) => (await loc.getAttribute('aria-checked')) === 'true';

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors, id, block, ids, texts, head, start } = await open(data('en'), { theme });
  await start();
  // the header, the labels, the notes above the table
  assert.deepEqual(await head(BENCH), ['Set', 'kg', 'Reps']);
  assert.deepEqual(await texts(BENCH, 'label'), ['W', '1', '2', 'D']);
  assert.equal(await block(BENCH).locator('[data-testid^="set-menu-"]').count(), 0, 'no ⋯ on the rows');
  const y = async (t) => (await id(t).boundingBox()).y;
  assert.ok(await y(`pinned-${BENCH}`) < await y(`ex-note-${BENCH}`), 'the pinned note comes first');
  assert.ok(await y(`ex-note-${BENCH}`) < await y(`sets-head-${BENCH}`), 'then the exercise note, then the header');
  ok(`${theme}: one “Set kg Reps” header, labels W 1 2 D, no ⋯; pinned note → note → header`);

  // the label opens the set's menu
  const [w, s1, s2, d] = await ids(BENCH);
  await id(`label-${s1}`).click();
  await id('type-normal').waitFor();
  await id('sheet-cancel').click();
  assert.equal(await id(`label-${w}`).getAttribute('aria-label'), 'Options for Warm-up set');
  assert.equal(await id(`label-${d}`).getAttribute('aria-label'), 'Options for Drop set');
  ok(`${theme}: the set’s label opens its menu and reads “Warm-up set”, “Drop set” to screen readers`);

  // log: the warm-up says nothing, 80 × 9 is +1 rep, 90 × 5 a record, the drop set matches last time
  await id(`in-r-${s1}`).fill('9');
  await id(`in-w-${s2}`).fill('90');
  await id(`in-r-${s2}`).fill('5');
  await id('keypad-close').click().catch(() => {});
  const log = async (s) => { await id(`check-${s}`).click(); await page.waitForTimeout(150); };
  for (const s of [w, s1, s2]) await log(s);
  assert.equal(await checked(id(`check-${s1}`)), true);
  assert.deepEqual(await texts(BENCH, 'notes'), ['', '+1 rep', 'Record', '']);
  // the tick un-logs too, and a pending set says nothing
  await log(s1);
  assert.equal(await checked(id(`check-${s1}`)), false);
  assert.deepEqual(await texts(BENCH, 'notes'), ['', '', 'Record', '']);
  await log(s1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/session-${theme}.png` });
  // the drop set like last time: nothing; Bench Press is done, so Side Plank comes up; back to Bench to look
  await log(d);
  if (await id('rest-skip').count()) await id('rest-skip').click();
  await block(PLANK).waitFor();
  await id(`jump-${BENCH}`).click();
  await block(BENCH).waitFor();
  assert.deepEqual(await texts(BENCH, 'notes'), ['', '+1 rep', 'Record', '']);
  await id(`jump-${PLANK}`).click();
  ok(`${theme}: the tick logs and un-logs; “+1 rep” for 80 × 9, “Record” for 90 × 5, nothing for the warm-up or a drop set like last time`);

  // a time and a distance: their own columns, a worse time in grey
  await block(PLANK).waitFor();
  assert.deepEqual(await head(PLANK), ['Set', 'Time']);
  const [p1] = await ids(PLANK);
  await id(`in-t-${p1}`).fill('45');
  await log(p1);
  if (await id('rest-skip').count()) await id('rest-skip').click();
  await block(RUN).waitFor();
  await id(`jump-${PLANK}`).click();
  assert.deepEqual(await texts(PLANK, 'notes'), ['−0:15']);
  await id(`jump-${RUN}`).click();
  await block(RUN).waitFor();
  assert.deepEqual(await head(RUN), ['Set', 'km', 'Time']);
  const [r1] = await ids(RUN);
  await id(`in-d-${r1}`).fill('5,5');
  await id(`in-t-${r1}`).fill('2830');
  await log(r1);
  if (!(await block(RUN).count())) await id(`jump-${RUN}`).click();
  assert.deepEqual(await texts(RUN, 'notes'), ['+0.5 km']);
  ok(`${theme}: “Set Time” for a plank (45 s is −0:15), “Set km Time” for a run (5.5 km is +0.5 km)`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

// the routine editor: header and labels, no ticks; lb
{
  const { ctx, page, errors, id, block, texts, head } = await open(data('en', 'lb'));
  await page.goto(`${APP}/template-edit?id=rows`);
  await block(BENCH).waitFor();
  assert.deepEqual(await head(BENCH), ['Set', 'lb', 'Reps']);
  assert.deepEqual(await texts(BENCH, 'label'), ['W', '1', '2', 'D']);
  assert.equal(await page.locator('[data-testid^="check-"]').count(), 0, 'no ticks in the editor');
  await page.screenshot({ path: `${OUT}/editor-lb.png` });
  ok('the routine editor: “Set lb Reps”, labels W 1 2 D, no ticks');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// German
{
  const { ctx, page, errors, id, block, ids, texts, head, start } = await open(data('de'), { locale: 'de-DE' });
  await start();
  assert.deepEqual(await head(BENCH), ['Satz', 'kg', 'Wdh.']);
  const [, s1] = await ids(BENCH);
  await id(`in-r-${s1}`).fill('9');
  await id('keypad-close').click().catch(() => {});
  for (const s of (await ids(BENCH)).slice(0, 2)) { await id(`check-${s}`).click(); await page.waitForTimeout(150); }
  assert.deepEqual((await texts(BENCH, 'notes')).slice(0, 2), ['', '+1 Wdh.']);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/session-de.png` });
  ok('German: “Satz kg Wdh.” and “+1 Wdh.”');
  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
