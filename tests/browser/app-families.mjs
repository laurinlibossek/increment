// Families browse siblings; every selected id retains its own history/records.
// REVIEW_BEFORE=1 captures the matching main screens, before family UI existed.
import assert from 'node:assert/strict';
import { openSearch, launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { familiesData, SQ, SMITH, DB, FRONT, FRONT_SMITH, CABLE, CURL_DB } from './families-data.mjs';
import { SEED_EXERCISES } from '../../core/index.js';
const before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(before ? 'app-families-before' : 'app-families');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };
async function open(data) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 844 } });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  await page.goto(APP); await page.getByTestId('open-search-index').waitFor();
  return { ctx, page, errors };
}
const shot = async (page, theme, name) => { await page.getByText('Hidden from lists', { exact: true }).waitFor({ state: 'hidden' }); await page.waitForTimeout(220); await page.screenshot({ path: `${OUT}/${theme}-${name}.png` }); };
async function backToSearch(page) {
  await page.goBack();
  await page.waitForURL(APP + '/search');
  await page.getByTestId('exercise-search').waitFor();
}
async function openExercise(page, id, query) {
  await page.getByTestId('exercise-search').fill(query);
  await page.getByTestId(`exercise-${id}`).click();
  await page.getByTestId('exercise-title').waitFor();
}
async function replace(page, id) {
  await page.getByTestId(`ex-menu-${id}`).click();
  await page.getByText('Replace exercise', { exact: true }).click();
  await page.getByTestId('pick-title').waitFor();
}
for (const theme of ['light', 'dark']) {
  const data = familiesData(theme);
  const { ctx, page, errors } = await open(data);
  await openSearch(page);
  const search = page.getByTestId('exercise-search');
  if (!before) {
    assert.match(await page.getByTestId('family-f-squat').innerText(), /Squat[\s\S]*Legs · 19 variations/);
    assert.match(await search.getAttribute('placeholder'), /Search 24 exercises/);
    assert.equal(await page.locator('[data-testid^="family-"]').count(), 3);
    assert.match(await page.getByTestId('exercise-c-own-row').innerText(), /My Row \(Upper\) \(Cybex Machine\)/);
    const order = await page.locator('[data-testid^="family-"], [data-testid="exercise-c-own-row"]').allInnerTexts();
    assert.deepEqual(order.map((t) => t.split('\n')[0]), ['Bicep Curl', 'Dead Hang', 'My Row (Upper) (Cybex Machine)', 'Squat']);
    await page.getByTestId('search-parts-other').click();
    assert.equal(await page.getByTestId('family-f-squat').count(), 0, 'a custom Other member does not change the usual family body part');
    await page.getByTestId('search-parts-all').click();
    ok(`${theme}: family rows, visible counts, alphabetical order, custom row and usual-version body-part filter`);
  }
  await shot(page, theme, 'search');
  await search.fill('smith squat');
  if (!before) {
    assert.match(await page.getByTestId(`exercise-${SMITH}`).innerText(), /Squat \(Smith Machine\)/);
    assert.match(await page.getByTestId(`exercise-${FRONT_SMITH}`).innerText(), /Front Squat \(Smith Machine\)/);
    assert.equal(await page.getByTestId('family-f-squat').count(), 0);
    ok(`${theme}: a typed query lists exact variations for one-tap selection`);
    await search.fill('');
    await page.getByTestId('family-f-squat').click();
  } else await page.getByTestId(`exercise-${SMITH}`).click();
  await page.getByTestId('exercise-title').waitFor();
  if (!before) {
    assert.ok(page.url().includes(SMITH), 'family opens the latest logged version, including history before a filter');
    assert.equal(await page.getByTestId('exercise-title').innerText(), 'Squat');
    assert.equal(await page.getByTestId('exercise-equipment').innerText(), 'Smith Machine · Legs');
    assert.match(await page.getByTestId('exercise-sessions').innerText(), /2/);
    assert.match(await page.getByTestId(`family-equipment-${SMITH}`).getAttribute('aria-selected'), /true/);
    ok(`${theme}: family opens the last logged version with an equipment/body-part header and its own sessions`);
  }
  await shot(page, theme, 'squat');
  if (!before) {
    const historyLength = await page.evaluate(() => history.length);
    const smithHero = await page.getByTestId('exercise-hero').innerText();
    await page.getByTestId(`family-exercises-${FRONT}`).click();
    await page.waitForURL(new RegExp(FRONT_SMITH));
    assert.ok(page.url().includes(FRONT_SMITH), 'movement chip uses its last logged equipment');
    assert.equal(await page.getByTestId('exercise-title').innerText(), 'Front Squat');
    assert.match(await page.getByTestId('exercise-sessions').innerText(), /1/);
    assert.notEqual(await page.getByTestId('exercise-hero').innerText(), smithHero);
    await page.getByTestId(`family-equipment-${FRONT}`).click();
    await page.waitForURL(new RegExp(FRONT));
    assert.ok(page.url().includes(FRONT));
    assert.equal(await page.getByTestId('exercise-hero').count(), 0, 'this variation has no counted sessions after Start history from');
    assert.match(await page.getByTestId('exercise-sessions').innerText(), /1/, 'all-time session count is still its own');
    await page.getByTestId(`family-exercises-${SQ}`).click();
    await page.waitForURL(new RegExp(SMITH));
    assert.ok(page.url().includes(SMITH));
    await page.getByTestId(`family-equipment-${DB}`).click();
    await page.waitForURL(new RegExp(DB));
    assert.equal(await page.getByTestId('exercise-hero').count(), 0);
    assert.match(await page.getByTestId('exercise-sessions').innerText(), /0/);
    assert.equal(await page.evaluate(() => history.length), historyLength, 'chip switches do not push history entries');
    ok(`${theme}: movement/equipment chips keep per-id history and metrics, use last equipment, and replace in place`);
  }
  await backToSearch(page);
  await openExercise(page, 'x-dead-hang', 'dead hang');
  if (!before) {
    assert.equal(await page.getByTestId('family-exercises').count(), 0);
    assert.equal(await page.getByTestId('family-equipment').count(), 0);
    assert.equal(await page.getByTestId('exercise-equipment').innerText(), 'Arms', 'no empty equipment separator');
  }
  await shot(page, theme, 'single');
  await backToSearch(page);
  if (!before) {
    await openExercise(page, 'c-own-row', 'my row');
    assert.equal(await page.getByTestId('exercise-title').innerText(), 'My Row (Upper)');
    assert.equal(await page.getByTestId('exercise-equipment').innerText(), 'Cybex Machine · Back');
    await backToSearch(page);
    await openExercise(page, 'x-safety-bar-squat-barbell', 'safety bar');
    await page.getByTestId('exercise-options').click(); await page.getByTestId('ex-hide').click();
    await backToSearch(page); await search.fill('');
    assert.match(await page.getByTestId('family-f-squat').innerText(), /18 variations/);
    await page.getByTestId('family-f-squat').click();
    await page.getByTestId('exercise-title').waitFor();
    assert.equal(await page.getByTestId('family-exercises-x-safety-bar-squat-barbell').count(), 0);
    await backToSearch(page);
    ok(`${theme}: single exercises have no chips, custom names split only their last bracket, hidden members leave counts/chips`);
  }
  if (before) {
    await openExercise(page, 'x-safety-bar-squat-barbell', 'safety bar');
    await page.getByTestId('exercise-options').click(); await page.getByTestId('ex-hide').click();
    await backToSearch(page); await search.fill('');
  }
  await page.goBack(); // Search → the tab root
  await page.waitForURL(APP + '/');
  await page.getByTestId('tab-plan').click();
  await page.getByTestId('plan-add').click(); await page.getByTestId('sheet-dialog').getByTestId('start-empty').click();
  await page.getByTestId('add-exercises').click();
  if (before) await page.getByTestId('pick-search').fill('squat');
  else await page.getByTestId('pick-family-f-squat').click();
  await shot(page, theme, 'picker');
  await page.getByTestId(`pick-${SMITH}`).click();
  await page.getByTestId(`pick-${SQ}`).click();
  await page.getByTestId('pick-add').click();
  await page.getByTestId(`block-${SMITH}`).waitFor();
  if (!before) {
    assert.equal(await page.getByTestId(`exercise-header-${SMITH}`).innerText(), 'Squat');
    assert.match(await page.getByTestId(`last-${SMITH}`).innerText(), /^Smith Machine · Legs/);
    assert.match(await page.locator('body').innerText(), /Squat \(Barbell\)/, 'Up next names the exact other variation');
    ok(`${theme}: picker expands inline and picks multiple IDs; the session splits its current header and keeps Up next exact`);
  }
  await shot(page, theme, 'session');
  await replace(page, SMITH);
  if (!before) {
    assert.match((await page.locator('[data-testid^="pick-family-"]').first().getAttribute('data-testid')), /f-squat$/);
    assert.equal(await page.getByTestId(`pick-${SMITH}`).getAttribute('aria-current'), 'true');
    assert.match(await page.getByTestId(`pick-${SMITH}`).innerText(), /Current exercise/);
  }
  await shot(page, theme, 'replace');
  if (before) await page.getByTestId('pick-search').fill('squat db');
  await page.getByTestId(`pick-${DB}`).click();
  await page.getByTestId(`block-${DB}`).waitFor();
  if (!before) ok(`${theme}: Replace opens the current family first, marks the current version, and swaps directly`);
  // Pushed editors share the same Replace flow; verify both without saving.
  if (!before) for (const route of ['/template-edit?id=family-routine', '/workout-edit/family-smith-new']) {
    await page.goto(APP + route);
    const id = route.startsWith('/template') ? CABLE : SMITH;
    await replace(page, id);
    assert.match(await page.locator('[data-testid^="pick-family-"]').first().getAttribute('data-testid'), new RegExp(route.startsWith('/template') ? 'f-bicep-curl$' : 'f-squat$'));
    const next = id === CABLE ? CURL_DB : DB;
    await page.getByTestId(`pick-${next}`).click(); await page.getByTestId(`block-${next}`).waitFor();
  }
  if (!before) ok(`${theme}: routine and workout editors offer the current family and select a sibling`);
  await page.goto(APP); await page.getByTestId('tab-progress').click();
  await page.getByTestId('progress-workouts').click();
  if (!before) assert.equal(await page.getByTestId('history-exercises-family-smith-new').innerText(), 'Squat (Smith Machine), Squat (Cybex Machine)');
  await shot(page, theme, 'workouts');
  await page.getByTestId('workout-family-smith-new').click();
  if (!before) {
    const linkText = await page.getByTestId(`ex-link-${SMITH}`).innerText();
    assert.equal(linkText.replace(/[\uE000-\uF8FF]/g, '').trim(), 'Squat (Smith Machine)');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('increment.data')));
    assert.deepEqual(stored.workouts, data.workouts, 'browsing/swapping drafts changes no completed history');
    assert.deepEqual(stored.templates, data.templates, 'unsaved editor choices change no routine');
    ok(`${theme}: Workouts and workout details show exact variations, with stored history and routines intact`);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
}
if (!before) {
  const data = familiesData(); data.exercises = SEED_EXERCISES;
  const { ctx, page, errors } = await open(data);
  await openSearch(page);
  assert.match(await page.getByTestId('exercise-search').getAttribute('placeholder'), /Search 400 exercises/);
  assert.deepEqual(errors, []); await ctx.close();
  ok('the search placeholder counts exercises, not families');
}
await browser.close();
console.log(`\n${passed} checks passed`);
