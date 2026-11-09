// Optional sides in every editor, their persistence, and side-aware grey values.
// REVIEW_BEFORE=1 captures matching old screens without asserting new behavior.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { setSidesData, CURL, PLANK, CARDIO, ROUTINE } from './set-sides-data.mjs';
const before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(before ? 'set-sides-before' : 'app-set-sides');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('increment.data')));
const block = (p, ex = CURL) => p.getByTestId(`block-${ex}`);
const setIds = (p, ex = CURL) => block(p, ex).locator('[data-testid^="set-menu-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('set-menu-'.length)));
const input = (p, f, i) => block(p).locator(`[data-testid^="in-${f}-"]`).nth(i);
async function menu(p, i = 0, ex = CURL) {
  const ids = await setIds(p, ex);
  await p.getByTestId(`set-menu-${ids[i]}`).click();
  await p.getByTestId('type-normal').waitFor();
  return ids[i];
}
async function side(p, value, i = 0, ex = CURL) {
  const id = await menu(p, i, ex);
  await p.getByTestId('set-side').click();
  await p.getByTestId(`side-${value}`).click();
  await p.getByTestId('side-left').waitFor({ state: 'hidden' });
  return id;
}
const shot = async (p, language, theme, name) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${before ? 'before' : 'after'}-${language}-${theme}-${name}.png` }); };
async function open(theme, language) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: language === 'de' ? 'de-DE' : 'en-US' });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(setSidesData(theme, language)));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  await page.goto(APP); await page.getByTestId('tab-index').waitFor();
  return { ctx, page, errors };
}
async function start(p) {
  await p.goto(`${APP}/template/${ROUTINE}`);
  await p.getByTestId('start-template').click();
  await block(p).waitFor();
}
try {
  for (const language of ['en', 'de']) for (const theme of ['light', 'dark']) {
    const { ctx, page: p, errors } = await open(theme, language);
    const left = language === 'de' ? 'Links' : 'Left side', right = language === 'de' ? 'Rechts' : 'Right side';
    await start(p);
    let first;
    if (before) {
      first = await menu(p); await shot(p, language, theme, 'set-menu');
      await p.getByTestId('set-rir').click(); await shot(p, language, theme, 'side-sheet');
      await p.getByTestId('sheet-cancel').click();
    } else {
      first = await menu(p);
      assert.equal(await p.getByTestId('set-side').innerText(), language === 'de' ? 'Seite' : 'Side');
      const effortY = (await p.getByTestId('set-rir').boundingBox()).y;
      assert.ok((await p.getByTestId('set-side').boundingBox()).y > effortY);
      await p.getByTestId('set-side').click();
      assert.equal(await p.getByTestId('side-clear').count(), 0);
      await p.getByTestId('side-left').click();
      await p.getByTestId(`label-${first}`).getByText(left, { exact: true }).waitFor();
      assert.equal(await input(p, 'w', 0).getAttribute('placeholder'), '26', 'Left uses the left history, although Right was logged first');
      await menu(p); await shot(p, language, theme, 'set-menu');
      assert.match(await p.getByTestId('set-side').innerText(), language === 'de' ? /Seite · Links/ : /Side · Left/);
      await p.getByTestId('set-side').click();
      assert.equal(await p.getByTestId('side-left').locator(':scope > *').count(), 2, 'the selected side has its check icon');
      assert.equal(await p.getByTestId('side-right').locator(':scope > *').count(), 1, 'the other side has no check icon');
      assert.ok(await p.getByTestId('side-clear').isVisible());
      await shot(p, language, theme, 'side-sheet'); await p.getByTestId('sheet-cancel').click();
      ok(`${language}/${theme}: Side follows effort, tagging Left updates its chip and grey value, and the sheet checks Left and offers Clear`);
    }
    await p.getByTestId(`add-set-${CURL}`).click();
    const ids = await setIds(p);
    assert.equal(ids.length, 2);
    if (!before) {
      await p.getByTestId(`label-${ids[1]}`).getByText(right, { exact: true }).waitFor();
      assert.equal(await input(p, 'w', 1).getAttribute('placeholder'), '16');
      ok(`${language}/${theme}: Add set alternates to Right and its grey value pairs with Right`);
    }
    await input(p, 'w', 0).fill('30'); await input(p, 'r', 0).fill('5');
    if (before) { await input(p, 'w', 1).fill('16'); await input(p, 'r', 1).fill('7'); }
    await p.getByTestId(`check-${ids[0]}`).click(); await p.getByTestId(`check-${ids[1]}`).click();
    if (!before) {
      const expected = language === 'de' ? /Satz 1, links, 30 × 5, eingetragen/ : /Set 1, left side, 30 × 5, logged/;
      assert.match(await p.getByTestId(`check-${ids[0]}`).getAttribute('aria-label'), expected);
      assert.match(await p.getByTestId(`set-${ids[0]}`).getAttribute('aria-label'), expected);
      const chips = await p.getByTestId(`label-${ids[0]}`).innerText();
      assert.ok(chips.startsWith(left), chips);
      assert.match(await p.getByTestId('session-count').innerText(), /2/);
      ok(`${language}/${theme}: chips lead other flags, row and stroke read the side, and two rows remain two tally strokes`);
    }
    await shot(p, language, theme, 'running');
    await p.getByTestId('workout-menu').click(); await p.getByTestId('menu-finish').click();
    await p.getByTestId('confirm-finish').click(); await p.getByTestId('routine-update').waitFor();
    if (!before) {
      assert.ok((await p.getByTestId('diff-line').allInnerTexts()).includes(language === 'de' ? 'Seiten geändert' : 'Sides changed'));
      assert.equal(await p.getByTestId('diff-added').count(), 1, 'the existing set-count marker is retained');
    }
    await shot(p, language, theme, 'routine-popup');
    await p.getByTestId('routine-update').click(); await p.getByTestId('routine-update-confirm').click();
    const data = await stored(p), finished = data.workouts.find((w) => w.id !== 'side-history');
    if (!before) {
      assert.deepEqual(data.templates.find((t) => t.id === ROUTINE).exercises[0].sets.map((s) => s.side), ['left', 'right']);
      assert.deepEqual(finished.exercises[0].sets.map((s) => s.side), ['left', 'right']);
      ok(`${language}/${theme}: Finish shows the plain Sides changed line and confirmed Update routine saves the sides`);
    }
    await p.goto(`${APP}/workout/${finished.id}`); await p.getByTestId('workout-title').waitFor();
    if (!before) {
      const line = await p.getByTestId(`workout-set-${ids[0]}`).innerText();
      assert.ok(line.includes(left + ' · '), line);
    }
    await shot(p, language, theme, 'workout-detail');
    if (!before) {
      ok(`${language}/${theme}: workout detail leads the set footnote with the side before record flags`);
      await start(p);
      const again = await setIds(p);
      await p.getByTestId(`label-${again[0]}`).getByText(left, { exact: true }).waitFor();
      await p.getByTestId(`label-${again[1]}`).getByText(right, { exact: true }).waitFor();
      assert.equal(await input(p, 'w', 0).getAttribute('placeholder'), '30');
      assert.equal(await input(p, 'w', 1).getAttribute('placeholder'), '16');
      ok(`${language}/${theme}: restarting the routine restores Left/Right chips and the correct side's grey values`);
      await side(p, 'clear');
      await p.getByTestId(`label-${again[0]}`).getByText(left, { exact: true }).waitFor({ state: 'hidden' });
      await p.waitForFunction((id) => {
        const set = JSON.parse(localStorage.getItem('increment.data')).kv.active.exercises[0].sets.find((s) => s.id === id);
        return !Object.hasOwn(set, 'side');
      }, again[0]);
      assert.equal((await stored(p)).kv.active.exercises[0].sets[1].side, 'right');
      ok(`${language}/${theme}: Clear removes the side field and chip without changing the other set`);
      // Both editors use this same menu and persist the selected side on Save.
      await p.goto(`${APP}/template-edit?id=${ROUTINE}`);
      await block(p).waitFor(); const routineSet = await side(p, 'right');
      await p.getByTestId(`label-${routineSet}`).getByText(right, { exact: true }).waitFor();
      await p.getByTestId('template-save').click();
      assert.equal((await stored(p)).templates.find((t) => t.id === ROUTINE).exercises[0].sets[0].side, 'right');
      await p.goto(`${APP}/workout-edit/${finished.id}`); await block(p).waitFor();
      await side(p, 'right'); await p.getByTestId('edit-save').click();
      assert.equal((await stored(p)).workouts.find((w) => w.id === finished.id).exercises[0].sets[0].side, 'right');
      ok(`${language}/${theme}: routine editor and Edit workout restore chips and save Side changes`);
      if (language === 'en' && theme === 'light') {
        await p.goto(`${APP}/template-edit?id=side-duration`); await block(p, PLANK).waitFor();
        await side(p, 'left', 0, PLANK);
        await p.getByTestId('template-save').click();
        assert.equal((await stored(p)).templates.find((t) => t.id === 'side-duration').exercises[0].sets[0].side, 'left');
        await p.goto(`${APP}/template-edit?id=side-cardio`); await block(p, CARDIO).waitFor();
        await menu(p, 0, CARDIO); assert.equal(await p.getByTestId('set-side').count(), 0);
        await p.getByTestId('sheet-cancel').click();
        ok('duration has Side for planks, while cardio has no Side row');
      }
    }
    assert.deepEqual(errors, []); await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
