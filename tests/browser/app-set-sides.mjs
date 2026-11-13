// Sides on a unilateral exercise (#54): a routine's set without a side starts
// as Left and Right, Side offers Left and Right only, Add set goes on with the
// pattern, side-aware grey values, Finish and Update routine, the editors.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots, storedData, waitStored } from './env.mjs';
import { setSidesData, CURL, PLANK, CARDIO, ROUTINE } from './set-sides-data.mjs';
const OUT = shots('app-set-sides');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };
const stored = (p) => storedData(p);
const block = (p, ex = CURL) => p.getByTestId(`block-${ex}`);
// the set's label (W, 1, 2, D, F) opens its menu (#48)
const setIds = (p, ex = CURL) => block(p, ex).locator('[data-testid^="label-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice('label-'.length)));
const input = (p, f, i) => block(p).locator(`[data-testid^="in-${f}-"]`).nth(i);
async function menu(p, i = 0, ex = CURL) {
  const ids = await setIds(p, ex);
  await p.getByTestId(`label-${ids[i]}`).click();
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
const shot = async (p, language, theme, name) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${language}-${theme}-${name}.png` }); };
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
    // beside a set (#48) "Left"; the workout page's footnote still says "Left side"
    const left = language === 'de' ? 'Links' : 'Left', right = language === 'de' ? 'Rechts' : 'Right';
    const leftLine = language === 'de' ? 'Links' : 'Left side';
    const sideOf = async (id) => (await p.getByTestId(`notes-${id}`).innerText()).split('\n').map((x) => x.trim()).find((x) => x === left || x === right);
    // the routine's one curl set has no side: a unilateral exercise starts it as a left and a right set (#54)
    await start(p);
    let ids = await setIds(p);
    assert.equal(ids.length, 2);
    assert.deepEqual([await sideOf(ids[0]), await sideOf(ids[1])], [left, right]);
    await waitStored(p, (d) => d.templates.find((t) => t.id === ROUTINE).exercises[0].sets.map((s) => s.side).join() === 'left,right');
    assert.equal(await input(p, 'w', 0).getAttribute('placeholder'), '26', 'Left takes the left history');
    assert.equal(await input(p, 'w', 1).getAttribute('placeholder'), '16', 'Right takes the right history');
    ok(`${language}/${theme}: the routine's set without a side starts as Left and Right (saved in the routine), each with its side's grey values`);

    // Side follows effort; a unilateral working set offers Left and Right only
    await menu(p, 0); await shot(p, language, theme, 'set-menu');
    assert.match(await p.getByTestId('set-side').innerText(), language === 'de' ? /Seite · Links/ : /Side · Left/);
    const effortY = (await p.getByTestId('set-rir').boundingBox()).y;
    assert.ok((await p.getByTestId('set-side').boundingBox()).y > effortY);
    await p.getByTestId('set-side').click();
    assert.equal(await p.getByTestId('side-left').locator(':scope > *').count(), 2, 'the selected side has its check icon');
    assert.equal(await p.getByTestId('side-right').locator(':scope > *').count(), 1, 'the other side has no check icon');
    assert.equal(await p.getByTestId('side-clear').count(), 0, 'no Clear: a unilateral working set always has a side');
    await shot(p, language, theme, 'side-sheet');
    await p.getByTestId('side-right').click();
    await p.getByTestId('side-left').waitFor({ state: 'hidden' });
    assert.equal(await sideOf(ids[0]), right);
    assert.equal(await input(p, 'w', 0).getAttribute('placeholder'), '16', 'the grey value follows the side');
    await side(p, 'left', 0);
    assert.equal(await input(p, 'w', 0).getAttribute('placeholder'), '26');
    ok(`${language}/${theme}: Side follows effort, offers Left and Right only, and switching it moves the grey value`);

    // Add set goes on with the pattern: after Left, Right comes Left
    await p.getByTestId(`add-set-${CURL}`).click();
    ids = await setIds(p);
    assert.equal(ids.length, 3);
    assert.equal(await sideOf(ids[2]), left);
    ok(`${language}/${theme}: Add set goes on Left, Right, Left`);

    await input(p, 'w', 0).fill('30'); await input(p, 'r', 0).fill('5');
    for (const id of ids) { await p.getByTestId(`check-${id}`).click(); await p.waitForTimeout(150); }
    const expected = language === 'de' ? /Satz 1, links, 30 × 5, eingetragen/ : /Set 1, left side, 30 × 5, logged/;
    assert.match(await p.getByTestId(`check-${ids[0]}`).getAttribute('aria-label'), expected);
    assert.match(await p.getByTestId(`set-${ids[0]}`).getAttribute('aria-label'), expected);
    // a left/right pair and a lone left: two sets, both logged (#72)
    assert.match(await p.getByTestId('session-count').innerText(), language === 'de' ? /^2 von 2 Arbeitssätzen · 100 %/ : /^2 of 2 working sets · 100%/);
    ok(`${language}/${theme}: the set says its side, row and tick read the side; a pair and a lone left count 2 of 2`);
    await shot(p, language, theme, 'running');
    if (await p.getByTestId('rest-skip').count()) await p.getByTestId('rest-skip').click();
    await p.getByTestId('workout-menu').click(); await p.getByTestId('menu-finish').click();
    await p.getByTestId('confirm-finish').click(); await p.getByTestId('routine-update').waitFor();
    assert.ok((await p.getByTestId('diff-line').allInnerTexts()).includes(language === 'de' ? 'Seiten geändert' : 'Sides changed'));
    assert.equal(await p.getByTestId('diff-added').count(), 1, 'the existing set-count marker is retained');
    await shot(p, language, theme, 'routine-popup');
    await p.getByTestId('routine-update').click(); await p.getByTestId('routine-update-confirm').click();
    const data = await stored(p), finished = data.workouts.find((w) => w.id !== 'side-history');
    assert.deepEqual(data.templates.find((t) => t.id === ROUTINE).exercises[0].sets.map((s) => s.side), ['left', 'right', 'left']);
    assert.deepEqual(finished.exercises[0].sets.map((s) => s.side), ['left', 'right', 'left']);
    ok(`${language}/${theme}: Finish shows the plain Sides changed line and confirmed Update routine saves the sides`);

    await p.goto(`${APP}/workout/${finished.id}`); await p.getByTestId('workout-title').waitFor();
    const line = await p.getByTestId(`workout-set-${ids[0]}`).innerText();
    assert.ok(line.includes(leftLine + ' · '), line);
    await shot(p, language, theme, 'workout-detail');
    ok(`${language}/${theme}: workout detail leads the set footnote with the side before record flags`);

    await start(p);
    const again = await setIds(p);
    assert.deepEqual([await sideOf(again[0]), await sideOf(again[1]), await sideOf(again[2])], [left, right, left]);
    assert.equal(await input(p, 'w', 0).getAttribute('placeholder'), '30');
    assert.equal(await input(p, 'w', 1).getAttribute('placeholder'), '16');
    ok(`${language}/${theme}: restarting the routine restores Left/Right and each side's grey values`);
    // a side changes, it doesn't go: the other sets stay as they were
    await side(p, 'right', 0);
    await waitStored(p, (d, id) => d.kv.active.exercises[0].sets.find((s) => s.id === id).side === 'right', again[0]);
    assert.equal((await stored(p)).kv.active.exercises[0].sets[1].side, 'right');
    ok(`${language}/${theme}: switching one set's side leaves the others`);
    // Both editors use this same menu and persist the selected side on Save.
    await p.goto(`${APP}/template-edit?id=${ROUTINE}`);
    await block(p).waitFor(); const routineSet = await side(p, 'right');
    await p.getByTestId(`notes-${routineSet}`).getByText(right, { exact: true }).waitFor();
    await p.getByTestId('template-save').click();
    assert.equal((await stored(p)).templates.find((t) => t.id === ROUTINE).exercises[0].sets[0].side, 'right');
    await p.goto(`${APP}/workout-edit/${finished.id}`); await block(p).waitFor();
    await side(p, 'right'); await p.getByTestId('edit-save').click();
    assert.equal((await stored(p)).workouts.find((w) => w.id === finished.id).exercises[0].sets[0].side, 'right');
    ok(`${language}/${theme}: routine editor and Edit workout restore the sides and save Side changes`);
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
    assert.deepEqual(errors, []); await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
