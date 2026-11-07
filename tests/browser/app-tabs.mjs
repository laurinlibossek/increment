// The Expo app's tabs (web build) on an emulated iPhone, with the store demo
// data (16 weeks of an upper/lower split up to yesterday): Today's Up next
// card, week strip and sets per muscle against the core's own numbers; Now
// Lifting with the rest and Skip; Plan's + menu; the Progress hub and its
// pages; Search focused on open; the Account sheet; German and dark; routines,
// not templates, in English and German; a wide window (the centred column);
// dark segmented controls and switches. 13 checks.
import assert from 'node:assert/strict';
import { openSearch, devices, launch, grantWakeLock, APP as BASE, shots } from './env.mjs';
import * as core from '../../core/index.js';
import { demoData } from './store-demo.mjs';

const OUT = shots('app-tabs');
const DAY = 86400000;
const browser = await launch();
let passed = 0;
const ok = (n) => { passed++; console.log('PASS', n); };

async function newPage({ lang = 'en', scheme = 'light' } = {}) {
  const data = demoData(lang);
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: lang === 'de' ? 'de-DE' : 'en-US', colorScheme: scheme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE);
  await page.getByTestId('start-suggested').waitFor();
  return { ctx, page, errors, data };
}
const id = (page, t) => page.getByTestId(t);
const wait = (page, ms = 300) => page.waitForTimeout(ms);
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('increment.data')));
const text = (page) => page.locator('body').innerText();
async function discard(page) {
  await id(page, 'discard-workout').click();
  await wait(page, 400);
  if (await id(page, 'confirm-discard').count()) await id(page, 'confirm-discard').click();
  await wait(page, 500);
}

// ---------- 1. Today, Now Lifting, Plan, Progress, Search, Account ----------
{
  const { ctx, page, errors, data } = await newPage();
  const lib = new Map(data.exercises.map((e) => [e.id, e]));
  const settings = core.withDefaults(data.kv.settings);
  const sug = core.suggestTemplate(data.templates, data.workouts);
  const size = core.routineSize(sug.template, lib, { defaultRest: settings.defaultRest });
  const week = core.weekStrip(data.workouts, { weekStart: settings.weekStart, goal: settings.weeklyGoal });
  const muscles = core.setsPerMuscle(data.workouts, lib);

  const tabs = page.getByRole('tab');
  assert.deepEqual(await tabs.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid'))), ['tab-index', 'tab-plan', 'tab-progress']);
  assert.deepEqual(await tabs.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))), ['Today', 'Plan', 'Progress']);
  assert.equal(new URL(page.url()).pathname, '/');
  ok('the bottom bar has Today, Plan and Progress in that order, with Today selected on launch');

  const card = await id(page, 'up-next').innerText();
  assert.match(card, new RegExp(`Up next · [^\\n]+\\n${sug.template.name}`));
  assert.ok(card.includes(`${size.exercises} exercises · ${size.sets} sets · about ${size.minutes} min`), card);
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(Date.now());
  assert.ok((await text(page)).toLowerCase().includes(date.toLowerCase()), `eyebrow ${date}`);
  assert.match(await id(page, 'week-head').innerText(), new RegExp(`${week.done} of ${settings.weeklyGoal} sessions`));
  assert.equal(await id(page, 'week-strip').getAttribute('aria-label'), `This week: ${week.done} of ${settings.weeklyGoal} sessions`);
  assert.ok(muscles.length >= 3, 'the demo trained several muscles this week');
  for (const m of muscles) assert.match(await id(page, `muscle-${m.muscle}`).innerText(), new RegExp(`^${m.label}\\s+${m.sets}$`));
  assert.equal(await page.locator('[data-testid^="muscle-"]').count(), muscles.length);
  await page.screenshot({ path: `${OUT}/01-today.png` });
  ok(`Today: the date, Up next (${sug.template.name}, about ${size.minutes} min), ${week.done} of ${settings.weeklyGoal} sessions, sets per muscle as the core counts them`);

  // start it, log the warm-up and the first set, minimize: the accessory
  await id(page, 'start-suggested').click();
  await id(page, 'workout-name').waitFor();
  assert.equal(await id(page, 'workout-name').inputValue(), sug.template.name);
  const checks = page.locator('[data-testid^="check-"]');
  await checks.nth(0).click(); await wait(page, 150);
  await checks.nth(1).click(); await wait(page, 300);
  assert.ok((await store(page)).kv.active.rest, 'a rest is running');
  await id(page, 'minimize').click();
  await id(page, 'mini-bar').waitFor();
  const first = sug.template.exercises[0];
  const firstName = lib.get(first.exerciseId).name;
  const bar = await id(page, 'mini-bar').innerText();
  assert.ok(bar.includes(`${firstName} · set 3 of ${first.sets.length}`), bar);
  assert.match(bar, /Rest \d:\d\d/);
  const now = await id(page, 'now-card').innerText();
  assert.match(now, /In progress · since/);
  assert.ok(now.includes(`1 of ${size.sets} sets`), now);
  await page.screenshot({ path: `${OUT}/02-now-lifting.png` });
  await id(page, 'mini-skip-rest').click();
  await wait(page, 300);
  assert.equal((await store(page)).kv.active.rest, null, 'Skip ends the rest');
  assert.equal(await id(page, 'mini-skip-rest').count(), 0);
  assert.match(await id(page, 'mini-bar').innerText(), new RegExp(`${sug.template.name} · \\d+:\\d\\d`));
  // One accessory on every root; Search sits above the roots and has none.
  for (const tab of ['index', 'plan', 'progress']) {
    await id(page, `tab-${tab}`).click();
    await page.waitForURL(BASE + (tab === 'index' ? '/' : `/${tab}`));
    await page.locator('[data-testid="mini-bar"]:visible').waitFor();
    assert.equal(await page.locator('[data-testid="mini-bar"]:visible').count(), 1);
    await openSearch(page);
    assert.equal(await page.locator('[data-testid="mini-bar"]:visible').count(), 0, 'Search has no duplicated or covering accessory');
    assert.equal(await page.getByRole('tablist').count(), 0, 'Search is pushed above the tab bar');
    await page.getByRole('link', { name: 'Go back', exact: true }).click();
    await id(page, `open-search-${tab}`).waitFor();
    assert.equal(new URL(page.url()).pathname, tab === 'index' ? '/' : `/${tab}`);
    assert.equal(await page.locator('[data-testid="mini-bar"]:visible').count(), 1);
  }
  await page.locator('[data-testid="mini-bar"]:visible').click();
  await id(page, 'workout-name').waitFor();
  await discard(page);
  assert.equal(await id(page, 'mini-bar').count(), 0);
  ok('Now Lifting: rest and Skip, exactly one on each tab root, none on pushed Search, restored after Back; opens the workout');

  // Plan: the templates as rows, + starts an empty workout
  await id(page, 'tab-plan').click();
  await wait(page);
  for (const t of data.templates) assert.match(await id(page, `template-${t.id}`).innerText(), new RegExp(`${t.name}\\n${t.exercises.length} exercises · `));
  await id(page, 'plan-add').click();
  await id(page, 'new-template').waitFor();
  await id(page, 'new-folder').waitFor();
  await wait(page, 250);
  await page.screenshot({ path: `${OUT}/03-plan-add.png` });
  await id(page, 'start-empty').click();
  await id(page, 'workout-name').waitFor();
  assert.match(await id(page, 'workout-name').inputValue(), /Workout$/);
  await discard(page);
  ok('Plan: the routines as rows; + has Empty workout (starts one), New routine and New folder');

  // Progress: last 30 days and the four pages
  await id(page, 'tab-progress').click();
  await wait(page);
  const since = Date.now() - 30 * DAY;
  const recent = data.workouts.filter((w) => w.startedAt >= since).length;
  assert.match(await id(page, 'last-30').innerText(), new RegExp(`^Workouts\\n${recent}\\n`));
  for (const [key, title] of [['workouts', 'Workouts'], ['lifts', 'Lifts'], ['records', 'Records']]) {
    const row = id(page, `progress-${key}`);
    const labels = await row.locator('[dir="auto"]:not([aria-hidden="true"])').allTextContents();
    assert.deepEqual(labels, [title], `${title}: navigation label without an all-time count`);
    assert.equal(await row.getAttribute('role'), 'button', `${title}: navigation remains tappable`);
    assert.equal(await row.locator('[aria-hidden="true"]').count(), 2, `${title}: leading symbol and chevron`);
  }
  const lifts = new Set(data.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId))).size;
  const bw = [...data.measurements].sort((a, b) => b.at - a.at)[0];
  assert.ok((await id(page, 'progress-body').innerText()).includes(`${bw.value} kg`));
  await page.screenshot({ path: `${OUT}/04-progress.png`, fullPage: true });
  await id(page, 'progress-records').click();
  await id(page, 'record-0').waitFor();
  assert.match(await id(page, 'record-0').innerText(), / · (Est\. 1RM|Weight|Reps)(?: · \d+ more)?/);
  assert.doesNotMatch(await id(page, 'record-0').innerText(), new RegExp(`\\b${new Date().getFullYear()}\\b`), 'current-year record date omits the year');
  await page.goBack();
  await id(page, 'progress-lifts').click();
  await page.locator('[data-testid^="lift-"]').first().waitFor();
  assert.equal(await page.locator('[data-testid^="lift-"]').count(), lifts, 'Lifts still lists every trained exercise');
  await id(page, 'lifts-search').fill('squat bb');
  await wait(page);
  assert.deepEqual(await page.locator('[data-testid^="lift-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))), ['lift-x-squat-barbell']);
  await id(page, 'lift-x-squat-barbell').click();
  await id(page, 'exercise-options').waitFor();
  await page.goBack(); await page.goBack();
  await id(page, 'progress-workouts').click();
  await page.locator('[data-testid^="workout-"]').first().waitFor();
  await page.goBack();
  ok(`Progress: ${recent} workouts in 30 days; Workouts, Lifts and Records navigate without counts; ${lifts} searchable lifts and Body (${bw.value} kg)`);

  // Every root has a plain Search control with a full hit area. Back preserves the origin.
  for (const tab of ['index', 'plan', 'progress']) {
    await id(page, `tab-${tab}`).click();
    await page.waitForURL(BASE + (tab === 'index' ? '/' : `/${tab}`));
    const icon = id(page, `open-search-${tab}`);
    await icon.waitFor();
    assert.equal(await icon.getAttribute('role'), 'button');
    assert.equal(await icon.getAttribute('aria-label'), 'Search');
    const area = await icon.boundingBox();
    assert.ok(area.width >= 44 && area.height >= 44, `${tab}: Search hit area ${area.width} × ${area.height}`);
    await openSearch(page);
    await wait(page, 400);
    assert.equal(new URL(page.url()).pathname, '/search');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'exercise-search');
    assert.equal(await page.getByRole('tablist').count(), 0);
    await page.getByRole('link', { name: 'Go back', exact: true }).click();
    await icon.waitFor();
    assert.equal(new URL(page.url()).pathname, tab === 'index' ? '/' : `/${tab}`);
  }
  ok('Search: a labelled 44 pt icon on all three roots, focused on push; Back returns to the originating tab');

  await openSearch(page);
  await id(page, 'new-exercise').click();
  await id(page, 'exercise-name').waitFor();
  assert.equal(await id(page, 'exercise-name').inputValue(), '');
  await id(page, 'exercise-cancel').click();
  await id(page, 'exercise-search').fill('Navigation test exercise');
  await page.getByText('Nothing found', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Create “Navigation test exercise”', exact: true }).click();
  assert.equal(await id(page, 'exercise-name').inputValue(), 'Navigation test exercise');
  await id(page, 'exercise-save').click();
  await id(page, 'exercise-title').waitFor();
  assert.equal(await id(page, 'exercise-title').innerText(), 'Navigation test exercise');
  await page.goBack();
  await id(page, 'exercise-search').waitFor();
  assert.equal(await id(page, 'exercise-search').inputValue(), 'Navigation test exercise');
  await page.getByRole('link', { name: 'Go back', exact: true }).click();
  await id(page, 'open-search-progress').waitFor();
  ok('Search keeps + and the empty-state Create flow, opens the saved exercise, and preserves the route back to Progress');

  // Account: from the avatar, Done closes it
  await id(page, 'tab-index').click();
  await id(page, 'open-account').click();
  await id(page, 'account-done').waitFor();
  assert.match(await id(page, 'set-name').innerText(), /Not set/);
  await wait(page, 300);
  await page.screenshot({ path: `${OUT}/05-account.png` });
  await id(page, 'account-done').click();
  await wait(page, 400);
  assert.equal(await id(page, 'account-done').count(), 0);
  await id(page, 'open-account').waitFor();
  ok('Account opens from the avatar on Today and closes with Done');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// ---------- 2. German, dark ----------
{
  const { ctx, page, errors } = await newPage({ lang: 'de', scheme: 'dark' });
  const today = await text(page);
  for (const s of ['Heute', 'Als Nächstes', 'Starten', 'Diese Woche', 'Einheiten', 'Sätze pro Muskel', 'Letzte 7 Tage']) assert.ok(today.includes(s), s);
  await page.screenshot({ path: `${OUT}/06-today-de-dark.png` });
  await id(page, 'tab-progress').click();
  await wait(page);
  const progress = await text(page);
  for (const s of ['Fortschritt', 'Letzte 30 Tage', 'Trainings', 'Übungen', 'Rekorde', 'Körper', 'Trainings pro Woche']) assert.ok(progress.includes(s), s);
  await page.screenshot({ path: `${OUT}/07-progress-de-dark.png` });
  ok('German: Today and Progress');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// ---------- 3. routines, not templates (Laurin, 4 Nov 2026) ----------
// The store app calls templates routines; the summary's routine question is checked in app-logging.
for (const lang of ['en', 'de']) {
  const { ctx, page, errors, data } = await newPage({ lang });
  const de = lang === 'de';
  const old = de ? /vorlage/i : /\btemplates?\b/i;
  const says = async (where, ...texts) => {
    const body = await text(page);
    assert.doesNotMatch(body, old, `${where} still says ${de ? 'Vorlage' : 'template'}`);
    for (const t of texts) assert.ok(body.includes(t), `${where}: “${t}”`);
  };
  const t = data.templates[0];
  await id(page, 'tab-plan').click();
  await wait(page);
  await says('Plan', de ? 'Routinen' : 'Routines');
  await id(page, 'plan-add').click();
  await id(page, 'new-template').waitFor();
  await wait(page, 250);
  await says('Plan +', de ? 'Neue Routine' : 'New routine');
  await id(page, 'sheet-cancel').click();
  await id(page, 'templates-menu').click();
  await id(page, 'add-shared').waitFor();
  await wait(page, 250);
  await says('Routines ⋯', de ? 'Geteilte Routine hinzufügen' : 'Add shared routine');
  await id(page, 'sheet-cancel').click();
  await id(page, `template-menu-${t.id}`).click();
  await id(page, 'tpl-menu-edit').waitFor();
  await wait(page, 250);
  await says('a routine’s ⋯', de ? 'Routine bearbeiten' : 'Edit routine', de ? 'Routine löschen' : 'Delete routine');
  await id(page, 'sheet-cancel').click();
  await id(page, `template-${t.id}`).click();
  await id(page, 'start-template').waitFor();
  await says('the routine', t.name);
  await page.goBack();
  await wait(page, 400);
  await id(page, `template-menu-${t.id}`).click();
  await id(page, 'tpl-menu-edit').click();
  await id(page, 'tpl-name').waitFor();
  assert.equal(await id(page, 'tpl-name').getAttribute('placeholder'), de ? 'Name der Routine' : 'Routine name');
  await says('the editor', de ? 'Routine' : 'routine');
  await id(page, 'tpl-cancel').click();
  await wait(page, 500);
  await id(page, 'tab-index').click();
  await id(page, 'open-account').click();
  await id(page, 'set-ask-template').waitFor();
  await says('Account', de ? 'Routinen nach dem Training aktualisieren' : 'Update routines after workouts', de ? 'Beispielroutinen' : 'Example routines');
  await page.goBack();
  await wait(page, 400);
  await id(page, 'tab-progress').click();
  await id(page, 'progress-workouts').click();
  await page.locator('[data-testid^="workout-"]').first().click();
  await id(page, 'workout-options').click();
  await id(page, 'wo-menu-template').waitFor();
  await wait(page, 250);
  await says('a workout’s ⋯', de ? 'Als Routine speichern' : 'Save as routine');
  await page.screenshot({ path: `${OUT}/08-workout-menu-${lang}.png` });
  await id(page, 'sheet-cancel').click();
  ok(`${de ? 'German' : 'English'}: routines, not templates, on Plan and its menus, a routine, the editor, Account and a workout’s menu`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

// ---------- 4. a wide window: the phone layout in a centred column, dialogs dim the whole window ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(demoData('en')));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE);
  await id(page, 'start-suggested').waitFor();
  const box = (t) => id(page, t).boundingBox();
  const inColumn = (b, what) => assert.ok(b.x >= 340 - 1 && b.x + b.width <= 940 + 1, `${what} inside the 600 px column: ${b.x}–${b.x + b.width}`);
  inColumn(await box('start-suggested'), 'Start');
  inColumn(await box('tab-index'), 'the Today tab');
  inColumn(await box('open-search-index'), 'the Search icon');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)', 'the page background is paper');
  await id(page, 'start-suggested').click();
  await id(page, 'workout-name').waitFor();
  inColumn(await box('workout-name'), 'the workout');
  await id(page, 'workout-menu').click();
  await id(page, 'menu-finish').waitFor();
  await wait(page, 300);
  const scrim = await page.getByLabel('Close').boundingBox();
  assert.ok(scrim.x <= 0 && scrim.width >= 1280, `the dim covers the window: ${scrim.x}, ${scrim.width}`);
  inColumn(await box('menu-finish'), 'the menu');
  await page.screenshot({ path: `${OUT}/09-wide-menu.png` });
  await id(page, 'sheet-cancel').click();
  ok('a 1280 px window shows the app in a centred 600 px column on paper; a menu dims the whole window');
  assert.deepEqual(errors, []);
  await ctx.close();
}

// ---------- 5. dark controls: the chosen segment stands out from its track, a switch that's off is dim, one that's on is visible ----------
{
  const { ctx, page, errors } = await newPage({ scheme: 'dark' });
  await id(page, 'open-account').click();
  await id(page, 'set-unit').waitFor();
  await wait(page, 400);
  const rgb = (css) => css.match(/\d+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
  const track = rgb(await bg(id(page, 'set-unit')));
  const chosen = rgb(await bg(id(page, 'set-unit-kg')));
  const ratio = contrast(chosen, track);
  assert.ok(ratio >= 3, `the chosen segment against its track: ${ratio.toFixed(2)}:1`);
  const knobs = (t) => id(page, t).locator('div').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
  const off = await knobs('set-keep-awake');
  assert.ok(off.includes('rgb(166, 166, 160)'), `an off switch has an ink-2 knob: ${off}`);
  assert.ok(!off.includes('rgb(255, 255, 255)'), 'and no white one');
  // A switch that's on: its track and its knob both stand out from the page
  // (a paper knob would vanish into the black page beside the white track).
  const pageBg = rgb(await id(page, 'set-rest-alert').evaluate((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const c = getComputedStyle(p).backgroundColor;
      if (c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return 'rgb(0, 0, 0)';
  }));
  const on = (await knobs('set-rest-alert')).filter((c) => c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)).map(rgb);
  assert.ok(on.length >= 2, `an on switch draws a track and a knob: ${JSON.stringify(on)}`);
  for (const part of on) assert.ok(contrast(part, pageBg) >= 3, `every part of an on switch stands out from the page: ${part} on ${pageBg}`);
  await page.screenshot({ path: `${OUT}/09-dark-controls.png` });
  ok(`dark: the chosen segment stands out from its track (${ratio.toFixed(1)}:1); a switch that's off has a dim knob, one that's on stands out from the page`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

await browser.close();
console.log(`\n${passed} checks passed`);
