// Runs twice: the ordinary German build (off) and the thumbnail review build (on).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, devices, grantWakeLock, APP, shots, openSearch, selectTab, storedData, waitStored } from './env.mjs';
import { thumbnailsData, BAR, CABLE, ONE, UNDRAWN, CUSTOM, SAME_NAME } from './thumbnails-data.mjs';
import { exerciseDisplayName } from '../../core/index.js';

const enabled = process.env.THUMBNAILS_ENABLED === '1';
const before = process.env.REVIEW_BEFORE === '1';
const mode = before ? 'before' : enabled ? 'on' : 'off';
const OUT = shots(`app-exercise-thumbnails-${mode}`);
const tokens = JSON.parse(fs.readFileSync(new URL('../../docs/design/tokens.json', import.meta.url)));
const color = (token, theme) => tokens.color.tokens.find(t => t.name === token).value[theme];
const browser = await launch();
let passed = 0;
const contact = [];
const ok = label => { passed++; console.log('PASS', label); };
const thumb = (row, id) => row.getByTestId(`exercise-thumbnail-${id}`);
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
async function checkTile(row, id, name, theme, drawing = true) {
  await row.waitFor();
  const tile = thumb(row, id);
  if (!enabled) { assert.equal(await tile.count(), 0); return; }
  await tile.waitFor();
  const box = await tile.boundingBox();
  assert.equal(box.width, 56); assert.equal(box.height, 56);
  assert.equal(await tile.getAttribute('aria-hidden'), 'true');
  assert.equal(await tile.locator('button, [role="button"], [tabindex="0"]').count(), 0);
  assert.equal(await tile.evaluate(e => getComputedStyle(e).pointerEvents), 'none');
  assert.equal(await tile.evaluate(e => getComputedStyle(e).backgroundColor), await row.evaluate((_, c) => {
    const el = document.createElement('div'); el.style.color = c; document.body.append(el);
    const result = getComputedStyle(el).color; el.remove(); return result;
  }, color('paper-3', theme)));
  if (drawing) {
    assert.equal(await tile.locator('svg').count(), 1);
    assert.equal(await tile.locator('svg').getAttribute('aria-hidden'), 'true');
    assert.equal(await tile.locator('svg').evaluate(e => e.tabIndex), -1, 'SVG is not a keyboard target');
    assert.ok(await tile.locator(`g[fill="${color('ink', theme)}"] path`).count() > 0);
    assert.ok(await tile.locator(`g[stroke="${color('ink-2', theme)}"]`).count() > 0);
    assert.ok(await tile.locator(`g[stroke="${color('paper-3', theme)}"][stroke-width="3.5"]`).count() > 0, 'per-part halos');
  } else {
    assert.equal(await tile.locator('svg').count(), 0, 'no other movement’s drawing');
    assert.equal(await tile.innerText(), Array.from(name)[0].toLocaleUpperCase());
    assert.equal((await row.ariaSnapshot()).includes(`text: ${Array.from(name)[0].toLocaleUpperCase()}\n`), false, 'letter is decorative');
  }
}
const shot = async (page, prefix, name) => {
  await page.waitForTimeout(240);
  await page.screenshot({ path: `${OUT}/${prefix}-${name}.png` });
};
try {
  for (const [theme, lang, width] of [['light', 'en', 375], ['dark', 'en', 375], ['light', 'de', 320], ['dark', 'de', 320], ['strawberry-matcha', 'en', 375], ['intense-red', 'en', 375]]) {
    // Main's ordinary review build is English-only; German before captures use a German export.
    const data = thumbnailsData(theme, lang), prefix = `${lang}-${theme}-${width}`;
    const name = id => exerciseDisplayName(data.exercises.find(e => e.id === id), lang);
    const { ctx, page, errors } = await open(data, width);
    await openSearch(page);
    const search = page.getByTestId('exercise-search');
    const family = page.getByTestId('family-f-row');
    await checkTile(family, ONE, name(ONE), theme);
    if (!before) assert.equal(await family.locator('[aria-hidden="true"]').count(), enabled ? 2 : 0, 'no navigation chevron');
    if (!enabled) assert.equal(await page.locator('[data-testid^="exercise-thumbnail-"]').count(), 0, 'flag off reserves no tiles');
    if (enabled && theme === 'light' && lang === 'en') {
      const tile = thumb(family, ONE);
      await tile.evaluate(el => {
        window.savedSvg = el.querySelector('svg'); window.settingMutations = [];
        window.settingObserver = new MutationObserver(m => window.settingMutations.push(...m.map(x => x.type)));
        window.settingObserver.observe(window.savedSvg, { subtree: true, attributes: true, childList: true });
      });
      const account = await ctx.newPage();
      account.on('pageerror', e => errors.push(String(e)));
      account.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
      await account.goto(`${APP}/account`);
      await account.getByTestId('set-examples').getByRole('switch').click();
      await waitStored(page, d => d.kv.settings.showExamples === true);
      await page.waitForFunction(() => document.querySelector('[data-testid="family-f-row"]'));
      await page.waitForTimeout(500); // cross-tab store debounce/broadcast
      assert.deepEqual(await page.evaluate(() => { window.settingObserver.disconnect(); return window.settingMutations; }), [], 'unrelated settings leave SVG unchanged');
      await account.getByTestId('theme-dark').click();
      await tile.locator(`g[fill="${color('ink', 'dark')}"]`).first().waitFor();
      await checkTile(family, ONE, name(ONE), 'dark');
      assert.equal(await tile.evaluate(el => el.querySelector('svg') === window.savedSvg), true, 'theme updates the same drawing');
      await account.getByTestId('theme-light').click();
      await tile.locator(`g[fill="${color('ink', 'light')}"]`).first().waitFor();
      await account.close();
    }
    await shot(page, prefix, 'search-families');
    await family.click(); await page.getByTestId('exercise-title').waitFor();
    assert.ok(page.url().endsWith(ONE), 'family opens the exercise its tile represents');
    await page.locator('[data-testid^="exercise-thumbnail-"]').filter({ visible: true }).first().waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[data-testid^="exercise-thumbnail-"]').filter({ visible: true }).count(), 0, 'exercise page stays unchanged');
    await page.goBack(); await search.fill('row');
    for (const id of [BAR, CABLE, ONE, UNDRAWN, SAME_NAME]) {
      const row = page.getByTestId(`exercise-${id}`);
      await checkTile(row, id, name(id), theme, [BAR, CABLE, ONE].includes(id));
      const accessible = await row.ariaSnapshot();
      assert.ok(accessible.includes(name(id)), 'row still announces its exercise name');
      assert.equal(await row.getByRole('img').count(), 0, 'no repeated image announcement');
    }
    await shot(page, prefix, 'search-results');
    if (enabled && lang === 'en' && ['light', 'dark'].includes(theme)) {
      for (const id of [BAR, CABLE, ONE]) contact.push({ theme, name: name(id), paper: color('paper-3', theme), ink: color('ink', theme), svg: await thumb(page.getByTestId(`exercise-${id}`), id).locator('svg').evaluate(e => e.outerHTML) });
    }
    for (const id of [BAR, CABLE, ONE]) {
      await page.getByTestId(`exercise-${id}`).click(); await page.getByTestId('exercise-title').waitFor();
      assert.ok(page.url().endsWith(id)); await page.goBack(); await search.waitFor();
    }
    await search.fill(name(CUSTOM));
    await checkTile(page.getByTestId(`exercise-${CUSTOM}`), CUSTOM, name(CUSTOM), theme, false);
    await shot(page, prefix, 'search-custom');
    await search.fill('triceps');
    const longRow = page.getByTestId('exercise-x-single-arm-overhead-triceps-extension-cable');
    await longRow.waitFor();
    assert.ok((await longRow.boundingBox()).width <= width);
    assert.equal(await longRow.evaluate(e => e.scrollWidth <= e.clientWidth), true);
    if (enabled && lang === 'de') assert.ok((await longRow.boundingBox()).height > 68, 'German title wraps at 320px');
    await shot(page, prefix, 'search-long-name');
    ok(`${mode} ${prefix}: exact drawings, translated/custom letters, decorative semantics, wrapped names and Search taps`);

    await page.goBack(); await selectTab(page, 'progress'); await page.getByTestId('progress-lifts').click();
    for (const id of [ONE, BAR, CABLE, CUSTOM, SAME_NAME]) {
      const row = page.getByTestId(`lift-${id}`);
      await checkTile(row, id, name(id), theme, [BAR, CABLE, ONE].includes(id));
      if (!before) assert.equal(await row.locator('[aria-hidden="true"]').count(), enabled ? ([BAR, CABLE, ONE].includes(id) ? 2 : 1) : 0);
    }
    await shot(page, prefix, 'lifts');
    await page.getByTestId(`lift-${CABLE}`).click(); await page.getByTestId('exercise-title').waitFor();
    assert.ok(page.url().endsWith(CABLE)); await page.goBack(); await page.goBack();
    ok(`${mode} ${prefix}: Lifts draws each trained exercise and keeps its row navigation`);

    await selectTab(page, 'plan'); await page.getByTestId('plan-add').click();
    await page.getByTestId('sheet-dialog').getByTestId('start-empty').click(); await page.getByTestId('add-exercises').click();
    const pickFamily = page.getByTestId('pick-family-f-row');
    await checkTile(pickFamily, ONE, name(ONE), theme);
    await pickFamily.locator('[aria-hidden="true"]').nth(enabled ? 2 : 0).waitFor({ state: 'attached' });
    assert.equal(await pickFamily.locator('[aria-hidden="true"]').count(), enabled ? 3 : 1, 'family keeps its expansion indicator');
    await pickFamily.click(); const members = page.getByTestId('pick-members-f-row'); await members.waitFor();
    for (const id of [BAR, CABLE, ONE, UNDRAWN, CUSTOM]) await checkTile(page.getByTestId(`pick-${id}`), id, name(id), theme, [BAR, CABLE, ONE].includes(id));
    await shot(page, prefix, 'picker');
    await pickFamily.click(); await members.waitFor({ state: 'hidden' }); await pickFamily.click(); await members.waitFor();
    if (enabled) await thumb(page.getByTestId(`pick-${BAR}`), BAR).evaluate(el => {
      window.thumbnailSvg = el.querySelector('svg'); window.thumbnailMutations = [];
      window.thumbnailObserver = new MutationObserver(m => window.thumbnailMutations.push(...m.map(x => x.type)));
      window.thumbnailObserver.observe(window.thumbnailSvg, { subtree: true, childList: true, attributes: true, characterData: true });
    });
    await page.getByTestId(`pick-${BAR}`).click();
    assert.equal(await page.getByTestId(`pick-${BAR}`).getAttribute('aria-checked'), 'true');
    await page.getByTestId(`pick-${BAR}`).click();
    assert.equal(await page.getByTestId(`pick-${BAR}`).getAttribute('aria-checked'), 'false');
    if (enabled) {
      assert.equal(await thumb(page.getByTestId(`pick-${BAR}`), BAR).evaluate(el => el.querySelector('svg') === window.thumbnailSvg), true);
      assert.deepEqual(await page.evaluate(() => { window.thumbnailObserver.disconnect(); return window.thumbnailMutations; }), [], 'selection does not rebuild SVG DOM');
    }
    await page.getByTestId('pick-search').fill('row');
    await checkTile(page.getByTestId(`pick-${CABLE}`), CABLE, name(CABLE), theme);
    await page.getByTestId(`pick-${CABLE}`).click(); await page.getByTestId(`pick-${ONE}`).click();
    await page.getByTestId('pick-add').click(); await page.getByTestId(`block-${CABLE}`).waitFor();
    await page.waitForTimeout(400);
    assert.deepEqual((await storedData(page)).kv.active.exercises.map(e => e.exerciseId), [CABLE, ONE]);
    assert.deepEqual(errors, []);
    await ctx.close();
    ok(`${mode} ${prefix}: picker expands/collapses, selects/deselects, searches and adds exact IDs without redrawing unchanged SVGs`);
  }
  for (const lang of ['en', 'de']) {
    const data = thumbnailsData('light', lang);
    const latest = data.workouts.find(w => w.exercises[0].exerciseId === CUSTOM);
    latest.startedAt = Date.now() - 3600000; latest.endedAt = Date.now();
    const { ctx, page, errors } = await open(data, 320);
    await openSearch(page);
    const family = page.getByTestId('family-f-row');
    await checkTile(family, CUSTOM, exerciseDisplayName(data.exercises.find(e => e.id === CUSTOM), lang), 'light', false);
    if (enabled) assert.equal(await family.locator('svg').count(), 0, 'family does not borrow a drawn sibling for its custom target');
    await family.click(); await page.getByTestId('exercise-title').waitFor();
    assert.ok(page.url().endsWith(CUSTOM));
    assert.deepEqual(errors, []); await ctx.close();
    ok(`${mode} ${lang}: a family represented by a custom exercise uses its letter and opens that custom`);
  }
  if (enabled) {
    const page = await browser.newPage({ viewport: { width: 816, height: 720 }, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(3,272px);font:16px system-ui">${contact.map(c => `<div style="padding:24px;background:${c.paper};color:${c.ink}"><div style="width:224px;height:224px">${c.svg}</div><p>${c.name}</p><small>${c.theme} · 4× (56 pt tile)</small></div>`).join('')}</body></html>`);
    await page.screenshot({ path: `${OUT}/sample-contact-sheet.png`, fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
