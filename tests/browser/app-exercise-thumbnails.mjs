// The tiles in Search, the picker and Lifts: a built-in's photo, otherwise the first letter (#46).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, devices, grantWakeLock, APP, shots, openSearch, selectTab, storedData, waitStored } from './env.mjs';
import { thumbnailsData, BAR, CABLE, ONE, LETTER, CUSTOM, SAME_NAME } from './thumbnails-data.mjs';
import { exerciseDisplayName } from '../../core/index.js';

const OUT = shots('app-exercise-thumbnails');
const tokens = JSON.parse(fs.readFileSync(new URL('../../docs/design/tokens.json', import.meta.url)));
const photos = JSON.parse(fs.readFileSync(new URL('../../app/assets/exercise-photos/manifest.json', import.meta.url))).exercises;
const color = (token, theme) => tokens.color.tokens.find(t => t.name === token).value[theme];
const radius = token => tokens.radius.tokens.find(t => t.name === token).value;
const rgb = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
assert.ok(photos[BAR] && photos[CABLE] && photos[ONE], 'the fixture’s photo rows have photos');
assert.equal(photos[LETTER], null, 'the fixture’s letter row has none');
const browser = await launch();
let passed = 0;
const ok = label => { passed++; console.log('PASS', label); };
const thumb = (row, id) => row.getByTestId(`exercise-thumbnail-${id}`);
// aria-hidden elements of a row outside its tile: chevrons and other indicators
const indicators = row => row.evaluate(r => [...r.querySelectorAll('[aria-hidden="true"]')].filter(e => !e.closest('[data-testid^="exercise-thumbnail-"]')).length);
async function open(data, width = 375) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, viewport: { width, height: 844 } });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript(json => localStorage.setItem('increment.data', json), JSON.stringify(data));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  await page.goto(APP); await page.getByTestId('open-search-index').waitFor();
  return { ctx, page, errors };
}
async function checkTile(row, id, name, theme) {
  await row.waitFor();
  const tile = thumb(row, id);
  await tile.waitFor();
  const box = await tile.boundingBox();
  assert.equal(box.width, 56); assert.equal(box.height, 56);
  assert.deepEqual(await tile.evaluate(e => [getComputedStyle(e).borderRadius, getComputedStyle(e).overflow]), [radius('radius-m'), 'hidden'], 'rounded tile clips its photo');
  assert.equal(await tile.getAttribute('aria-hidden'), 'true');
  assert.equal(await tile.locator('button, [role="button"], [tabindex="0"]').count(), 0);
  assert.equal(await tile.evaluate(e => getComputedStyle(e).pointerEvents), 'none');
  assert.equal(await tile.evaluate(e => getComputedStyle(e).backgroundColor), await row.evaluate((_, c) => {
    const el = document.createElement('div'); el.style.color = c; document.body.append(el);
    const result = getComputedStyle(el).color; el.remove(); return result;
  }, color('paper-3', theme)));
  const photo = photos[id]?.image;
  if (photo) {
    const img = tile.locator('img');
    assert.equal(await img.count(), 1);
    assert.match(await img.getAttribute('src'), new RegExp(`/exercise-photos/${photo}\\.[0-9a-f]+\\.webp$`), `${id} shows its own photo`);
    await img.evaluate(e => e.complete || new Promise(r => { e.onload = r; e.onerror = r; }));
    assert.equal(await img.evaluate(e => e.naturalWidth), 168, 'the photo loads');
    assert.deepEqual(await img.evaluate(e => { const b = e.parentElement.getBoundingClientRect(); return [b.width, b.height]; }), [56, 56], 'the photo fills the tile');
    assert.equal(await tile.innerText(), '');
  } else {
    assert.equal(await tile.locator('img').count(), 0, 'no other movement’s photo');
    assert.equal(await tile.innerText(), Array.from(name)[0].toLocaleUpperCase());
    assert.equal(await tile.locator('div[dir="auto"]').evaluate(e => getComputedStyle(e).color), await row.evaluate((_, c) => {
      const el = document.createElement('div'); el.style.color = c; document.body.append(el);
      const result = getComputedStyle(el).color; el.remove(); return result;
    }, color('ink', theme)));
    assert.equal((await row.ariaSnapshot()).includes(`text: ${Array.from(name)[0].toLocaleUpperCase()}\n`), false, 'letter is decorative');
  }
}
// records DOM changes inside a tile until the returned function is called, once its photo is in
async function watch(tile, id) {
  if (photos[id]) await tile.locator('img').evaluate(e => e.complete || new Promise(r => { e.onload = r; e.onerror = r; }));
  await tile.evaluate(el => {
    window.watched = el; window.watchedImg = el.querySelector('img'); window.mutations = [];
    window.watcher = new MutationObserver(m => window.mutations.push(...m.map(x => `${x.type} ${x.attributeName || ''} ${x.target.tagName}`)));
    window.watcher.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  return () => tile.page().evaluate(() => { window.watcher.disconnect(); return window.mutations; });
}
const shot = async (page, prefix, name) => {
  await page.waitForTimeout(240);
  await page.screenshot({ path: `${OUT}/${prefix}-${name}.png` });
};
try {
  for (const [theme, lang, width] of [['light', 'en', 375], ['dark', 'en', 375], ['light', 'de', 320], ['dark', 'de', 320], ['strawberry-matcha', 'en', 375], ['intense-red', 'en', 375]]) {
    const data = thumbnailsData(theme, lang), prefix = `${lang}-${theme}-${width}`;
    const name = id => exerciseDisplayName(data.exercises.find(e => e.id === id), lang);
    const { ctx, page, errors } = await open(data, width);
    await openSearch(page);
    const search = page.getByTestId('exercise-search');
    const family = page.getByTestId('family-f-row');
    await checkTile(family, ONE, name(ONE), theme);
    assert.equal(await indicators(family), 0, 'no navigation chevron');
    if (theme === 'light' && lang === 'en') {
      const tile = thumb(family, ONE);
      const changes = await watch(tile, ONE);
      const account = await ctx.newPage();
      account.on('pageerror', e => errors.push(String(e)));
      account.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
      await account.goto(`${APP}/account`);
      await account.getByTestId('set-examples').getByRole('switch').click();
      await waitStored(page, d => d.kv.settings.showExamples === true);
      await page.waitForFunction(() => document.querySelector('[data-testid="family-f-row"]'));
      await page.waitForTimeout(500); // cross-tab store debounce/broadcast
      assert.deepEqual(await changes(), [], 'unrelated settings leave the tile alone');
      await account.getByTestId('theme-dark').click();
      await page.waitForFunction(c => getComputedStyle(window.watched).backgroundColor === c, rgb(color('paper-3', 'dark')));
      await checkTile(family, ONE, name(ONE), 'dark');
      assert.equal(await tile.evaluate(el => el === window.watched && el.querySelector('img') === window.watchedImg), true, 'the theme recolours the same tile and keeps its photo');
      await account.getByTestId('theme-light').click();
      await page.waitForFunction(c => getComputedStyle(window.watched).backgroundColor === c, rgb(color('paper-3', 'light')));
      await account.close();
    }
    await shot(page, prefix, 'search-families');
    await family.click(); await page.getByTestId('exercise-title').waitFor();
    assert.ok(page.url().endsWith(ONE), 'family opens the exercise its tile represents');
    await page.locator('[data-testid^="exercise-thumbnail-"]').filter({ visible: true }).first().waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-testid^="exercise-thumbnail-"]').filter({ visible: true }).count(), 0, 'exercise page stays unchanged');
    await page.goBack(); await search.fill('row');
    for (const id of [BAR, CABLE, ONE, LETTER, SAME_NAME]) {
      const row = page.getByTestId(`exercise-${id}`);
      await checkTile(row, id, name(id), theme);
      const accessible = await row.ariaSnapshot();
      assert.ok(accessible.includes(name(id)), 'row still announces its exercise name');
      assert.equal(await row.getByRole('img').count(), 0, 'no repeated image announcement');
    }
    await shot(page, prefix, 'search-results');
    for (const id of [BAR, CABLE, ONE]) {
      await page.getByTestId(`exercise-${id}`).click(); await page.getByTestId('exercise-title').waitFor();
      assert.ok(page.url().endsWith(id)); await page.goBack(); await search.waitFor();
    }
    await search.fill(name(CUSTOM));
    await checkTile(page.getByTestId(`exercise-${CUSTOM}`), CUSTOM, name(CUSTOM), theme);
    await shot(page, prefix, 'search-custom');
    await search.fill('triceps');
    const longRow = page.getByTestId('exercise-x-single-arm-overhead-triceps-extension-cable');
    await longRow.waitFor();
    assert.ok((await longRow.boundingBox()).width <= width);
    assert.equal(await longRow.evaluate(e => e.scrollWidth <= e.clientWidth), true);
    if (lang === 'de') assert.ok((await longRow.boundingBox()).height > 68, 'German title wraps at 320px');
    await shot(page, prefix, 'search-long-name');
    ok(`${prefix}: each built-in’s own photo, translated/custom letters, decorative semantics, wrapped names and Search taps`);

    await page.goBack(); await selectTab(page, 'progress'); await page.getByTestId('progress-lifts').click();
    for (const id of [ONE, BAR, CABLE, CUSTOM, SAME_NAME]) {
      const row = page.getByTestId(`lift-${id}`);
      await checkTile(row, id, name(id), theme);
      assert.equal(await indicators(row), 0, 'no navigation chevron');
    }
    await shot(page, prefix, 'lifts');
    await page.getByTestId(`lift-${CABLE}`).click(); await page.getByTestId('exercise-title').waitFor();
    assert.ok(page.url().endsWith(CABLE)); await page.goBack(); await page.goBack();
    ok(`${prefix}: Lifts shows each trained exercise’s tile and keeps its row navigation`);

    await selectTab(page, 'plan'); await page.getByTestId('plan-add').click();
    await page.getByTestId('sheet-dialog').getByTestId('start-empty').click(); await page.getByTestId('add-exercises').click();
    const pickFamily = page.getByTestId('pick-family-f-row');
    await checkTile(pickFamily, ONE, name(ONE), theme);
    assert.equal(await indicators(pickFamily), 1, 'family keeps its expansion indicator');
    await pickFamily.click(); const members = page.getByTestId('pick-members-f-row'); await members.waitFor();
    for (const id of [BAR, CABLE, ONE, LETTER, CUSTOM]) await checkTile(page.getByTestId(`pick-${id}`), id, name(id), theme);
    await shot(page, prefix, 'picker');
    await pickFamily.click(); await members.waitFor({ state: 'hidden' }); await pickFamily.click(); await members.waitFor();
    const changes = await watch(thumb(page.getByTestId(`pick-${BAR}`), BAR), BAR);
    await page.getByTestId(`pick-${BAR}`).click();
    assert.equal(await page.getByTestId(`pick-${BAR}`).getAttribute('aria-checked'), 'true');
    await page.getByTestId(`pick-${BAR}`).click();
    assert.equal(await page.getByTestId(`pick-${BAR}`).getAttribute('aria-checked'), 'false');
    assert.equal(await thumb(page.getByTestId(`pick-${BAR}`), BAR).evaluate(el => el === window.watched), true);
    assert.deepEqual(await changes(), [], 'selection leaves the tile alone');
    await page.getByTestId('pick-search').fill('row');
    await checkTile(page.getByTestId(`pick-${CABLE}`), CABLE, name(CABLE), theme);
    await page.getByTestId(`pick-${CABLE}`).click(); await page.getByTestId(`pick-${ONE}`).click();
    await page.getByTestId('pick-add').click(); await page.getByTestId(`block-${CABLE}`).waitFor();
    await page.waitForTimeout(400);
    assert.deepEqual((await storedData(page)).kv.active.exercises.map(e => e.exerciseId), [CABLE, ONE]);
    assert.deepEqual(errors, []);
    await ctx.close();
    ok(`${prefix}: picker expands/collapses, selects/deselects, searches and adds exact IDs without touching unchanged tiles`);
  }
  for (const lang of ['en', 'de']) {
    const data = thumbnailsData('light', lang);
    const latest = data.workouts.find(w => w.exercises[0].exerciseId === CUSTOM);
    latest.startedAt = Date.now() - 3600000; latest.endedAt = Date.now();
    const { ctx, page, errors } = await open(data, 320);
    await openSearch(page);
    const family = page.getByTestId('family-f-row');
    await checkTile(family, CUSTOM, exerciseDisplayName(data.exercises.find(e => e.id === CUSTOM), lang), 'light');
    assert.equal(await family.locator('img').count(), 0, 'family does not borrow a sibling’s photo for its custom target');
    await family.click(); await page.getByTestId('exercise-title').waitFor();
    assert.ok(page.url().endsWith(CUSTOM));
    assert.deepEqual(errors, []); await ctx.close();
    ok(`${lang}: a family represented by a custom exercise uses its letter and opens that custom`);
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
