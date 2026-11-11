// Family creation and edits keep each exercise's history separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectTab, launch, devices, grantWakeLock, APP, shots, openSearch, storedData, waitStored, failWrites } from './env.mjs';
import { SEED_EXERCISES, familyOf } from '../../core/index.js';
import { familyCreationData } from './family-creation-data.mjs';

const OUT = shots('app-family-creation');
const browser = await launch();
let activePage;
let passed = 0;
const ok = (name) => { passed++; console.log('PASS', name); };
const stored = (page) => storedData(page);
async function open(data) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
  const page = await ctx.newPage(), errors = [], dialogs = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  await page.goto(APP); await page.getByTestId('tab-index').waitFor(); await openSearch(page);
  return { ctx, page, errors, dialogs };
}
async function create(page, name) {
  await page.getByTestId('exercise-search').fill(name);
  await page.getByTestId('new-exercise').click();
  await page.getByTestId('exercise-name').waitFor();
  await page.getByTestId('exercise-name').blur();
}
async function edit(page) {
  await page.getByTestId('exercise-options').click();
  await page.getByTestId('ex-edit').click();
  await page.getByTestId('exercise-name').waitFor();
}
async function searchAgain(page) { await page.goBack(); await page.getByTestId('exercise-search').fill(''); }
const shot = async (page, theme, name) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/after-en-${theme}-${name}.png` }); };
try {
  for (const theme of ['light', 'dark']) {
    const initial = familyCreationData(theme);
    const { ctx, page, errors, dialogs } = await open(initial);
    activePage = page;
    const squatCount = SEED_EXERCISES.filter((e) => familyOf(e) === 'f-squat').length;
    await create(page, 'Squat (Cybex Machine)');
    assert.match(await page.getByTestId('exercise-family').innerText(), /Variation of[\s\S]*None/);
    await shot(page, theme, 'form');
    await page.getByTestId('exercise-save').click();
    await page.getByTestId('confirm-exercise-family').waitFor();
    assert.ok(await page.getByText('Add to Squat?', { exact: true }).count());
    assert.ok(await page.getByText('Squat (Cybex Machine) becomes a variation of Squat. Its records and history stay its own.', { exact: true }).count());
    await shot(page, theme, 'question');
    await page.getByTestId('confirm-exercise-family').click();
    await page.getByTestId('exercise-title').waitFor();
    let data = await stored(page);
    const cybex = data.exercises.find((e) => e.name === 'Squat (Cybex Machine)');
    assert.equal(cybex.family, 'f-squat');
    assert.ok(await page.getByTestId(`family-equipment-${cybex.id}`).count());
    assert.match(await page.getByTestId('exercise-sessions').innerText(), /0/);
    await page.getByTestId('family-equipment-x-squat-barbell').click();
    await edit(page);
    assert.equal(await page.getByTestId('exercise-family').count(), 0, 'built-ins keep their catalogue family');
    await page.getByTestId('exercise-cancel').click();
    await page.getByTestId(`family-equipment-${cybex.id}`).click();
    await searchAgain(page);
    assert.match(await page.getByTestId('family-f-squat').innerText(), new RegExp(`${squatCount + 1} variations`));
    ok(`${theme}: a new exact squat base asks before saving and joins Squat's count and chips with its own empty history`);

    await create(page, 'Squat (Panatta Machine)');
    await page.getByTestId('exercise-save').click();
    await page.getByTestId('dialog-cancel').click();
    await page.getByTestId('exercise-title').waitFor();
    const separate = (await stored(page)).exercises.find((e) => e.name === 'Squat (Panatta Machine)');
    assert.equal(separate.family, null);
    assert.equal(await page.getByTestId('family-equipment').count(), 0);
    await searchAgain(page);
    assert.ok(await page.getByTestId(`exercise-${separate.id}`).count());
    assert.match(await page.getByTestId('family-f-squat').innerText(), new RegExp(`${squatCount + 1} variations`));
    ok(`${theme}: Keep separate stores an explicit opt-out and leaves a full-name Search row`);

    await create(page, 'Kelso Shrug (Machine)');
    await page.getByTestId('exercise-save').click();
    await page.getByTestId('confirm-exercise-family').waitFor();
    assert.ok(await page.getByText('Group with Kelso Shrug (Cable)?', { exact: true }).count());
    await page.getByTestId('confirm-exercise-family').click();
    await page.getByTestId('exercise-title').waitFor();
    data = await stored(page);
    const machine = data.exercises.find((e) => e.name === 'Kelso Shrug (Machine)');
    const familyId = machine.family;
    assert.match(familyId, /^fc-/);
    assert.equal(data.kv.customFamilies[familyId], 'Kelso Shrug');
    assert.equal(data.exercises.find((e) => e.id === 'c-kelso-cable').family, familyId);
    assert.ok(await page.getByTestId('family-equipment-c-kelso-cable').count());
    assert.ok(await page.getByTestId(`family-equipment-${machine.id}`).count());
    assert.match(await page.getByTestId('exercise-sessions').innerText(), /0/);
    await page.getByTestId('family-equipment-c-kelso-cable').click();
    await page.waitForURL(/c-kelso-cable/);
    await page.getByTestId('exercise-sessions').getByText('1', { exact: true }).waitFor();
    assert.match(await page.getByTestId('exercise-sessions').innerText(), /1/);
    await shot(page, theme, 'exercise');
    await searchAgain(page);
    assert.match(await page.getByTestId(`family-${familyId}`).innerText(), /Kelso Shrug[\s\S]*2 variations/);
    await shot(page, theme, 'search');
    ok(`${theme}: Group with creates a custom registry family, both members browse together and retain separate histories`);

    await create(page, 'Squat (Technogym Machine)');
    await page.getByTestId('exercise-family').click(); await page.getByTestId('pick-none').click();
    await page.getByTestId('exercise-save').click();
    await page.getByTestId('exercise-name').waitFor({ state: 'hidden' });
    assert.equal(await page.getByTestId('confirm-exercise-family').count(), 0);
    assert.equal((await stored(page)).exercises.find((e) => e.name === 'Squat (Technogym Machine)').family, null);
    await searchAgain(page);
    ok(`${theme}: explicitly choosing None on a new exact-base exercise suppresses the question`);

    // A Strong exercise with the same base joins the person's own family, and the review says so.
    // (Before the restore below, which brings back the catalogue's own Kelso Shrug family.)
    await page.goto(APP); await page.getByTestId('open-account').click();
    const strongCsv = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes\n'
      + '2026-10-02 12:00:00,Shrugs,20m,Kelso Shrug (Band),1,20,12,0,0,,\n';
    const [strongFile] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('strong-import').click()]);
    await strongFile.setFiles({ name: 'kelso.csv', mimeType: 'text/csv', buffer: Buffer.from(strongCsv) });
    await page.getByTestId('strong-review').waitFor();
    await page.getByTestId('strong-new-0').click();
    assert.match(await page.getByTestId('strong-family-0').innerText(), /Joins Kelso Shrug/);
    await page.getByTestId('strong-cancel').click();
    await page.getByTestId('confirm-discard-changes').click();
    await page.getByTestId('strong-import').waitFor();
    assert.equal((await stored(page)).exercises.some((e) => e.name === 'Kelso Shrug (Band)'), false);
    await page.goto(APP); await openSearch(page);
    ok(`${theme}: the Strong review says a new exercise joins the person's own family`);

    // Download the real backup, remove the family through the form, then restore it.

    await page.goto(APP); await page.getByTestId('open-account').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-now').click()]);
    const backupFile = await download.path();
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    assert.equal(backup.data.kv.customFamilies[familyId], 'Kelso Shrug');
    await page.goto(APP); await openSearch(page);
    for (const id of [machine.id, 'c-kelso-cable']) {
      await page.getByTestId('exercise-search').fill('Kelso Shrug');
      await page.getByTestId(`exercise-${id}`).click(); await edit(page);
      await page.getByTestId('exercise-family').click(); await page.getByTestId('pick-none').click();
      await page.getByTestId('exercise-save').click();
      await page.getByTestId('exercise-name').waitFor({ state: 'hidden' });
      await searchAgain(page);
    }
    assert.equal((await stored(page)).kv.customFamilies?.[familyId], undefined);
    assert.equal(await page.getByTestId(`family-${familyId}`).count(), 0);
    await page.goto(APP); await page.getByTestId('open-account').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('restore').click()]);
    await chooser.setFiles({ name: 'family-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await waitStored(page, (d, id) => d.kv.customFamilies?.[id] === 'Kelso Shrug', familyId);
    await waitStored(page, (d) => d.exercises.filter((e) => e.family?.startsWith('fc-')).length === 2);
    assert.ok(dialogs.some((d) => d.startsWith('Replace all data?')));
    assert.ok(dialogs.some((d) => d.startsWith('Backup restored')));
    await page.goto(APP); await openSearch(page);
    assert.match(await page.getByTestId(`family-${familyId}`).innerText(), /Kelso Shrug[\s\S]*2 variations/);
    await page.reload(); await page.getByTestId('exercise-search').waitFor();
    assert.equal((await stored(page)).kv.customFamilies[familyId], 'Kelso Shrug');
    await page.getByTestId(`family-${familyId}`).click();
    await page.getByTestId('family-equipment-c-kelso-cable').waitFor();
    assert.ok(await page.getByTestId('family-equipment-c-kelso-cable').count());
    assert.ok(await page.getByTestId(`family-equipment-${machine.id}`).count());
    await searchAgain(page);
    ok(`${theme}: moving the last custom member out cleans its registry; actual backup restore restores names, ids and chips after reload`);

    await page.getByTestId('exercise-search').fill('Kelso Shrug (Machine)');
    await page.getByTestId(`exercise-${machine.id}`).click(); await edit(page);
    assert.match(await page.getByTestId('exercise-family').innerText(), /Kelso Shrug/);
    await page.getByTestId('exercise-family').click();
    assert.equal(await page.getByTestId('pick-new').count(), 0);
    // the current choice is ticked; rows choose instead of opening
    assert.equal(await page.getByTestId(`pick-family-${familyId}`).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByTestId('pick-family-f-squat').getAttribute('aria-checked'), 'false');
    assert.equal(await page.getByTestId('pick-none').getAttribute('aria-checked'), 'false');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/after-en-${theme}-variation-picker.png` });
    await page.getByTestId('pick-family-f-squat').click();
    await page.getByTestId('exercise-name').waitFor();
    assert.match(await page.getByTestId('exercise-family').innerText(), /Squat/);
    await page.getByTestId('exercise-save').click(); await page.getByTestId('exercise-title').waitFor();
    assert.equal(await page.getByTestId('confirm-exercise-family').count(), 0);
    assert.equal((await stored(page)).exercises.find((e) => e.id === machine.id).family, 'f-squat');
    assert.ok(await page.getByTestId('family-exercises-x-squat-barbell').count());
    await edit(page); await page.getByTestId('exercise-family').click();
    assert.equal(await page.getByTestId('pick-family-f-squat').getAttribute('aria-checked'), 'true');
    await page.getByTestId('pick-none').click();
    await page.getByTestId('exercise-save').click(); await page.getByTestId('exercise-title').waitFor();
    assert.equal((await stored(page)).exercises.find((e) => e.id === machine.id).family, null);
    assert.equal(await page.getByTestId('family-exercises').count(), 0);
    await searchAgain(page);
    assert.ok(await page.getByTestId(`exercise-${machine.id}`).count());
    ok(`${theme}: Variation of ticks the current family, selects a family row with creation disabled, moves chips and Search, and None opts out`);

    await create(page, 'Kelso Shrug (Lever Machine)');
    await page.getByTestId('exercise-family').click();
    await page.getByTestId('pick-search').fill('Kelso Shrug (Machine)');
    await page.getByTestId(`pick-${machine.id}`).click();
    await page.getByTestId('exercise-save').click();
    await page.getByTestId('exercise-name').waitFor({ state: 'hidden' });
    assert.equal(await page.getByTestId('confirm-exercise-family').count(), 0);
    data = await stored(page);
    const lever = data.exercises.find((e) => e.name === 'Kelso Shrug (Lever Machine)');
    assert.match(lever.family, /^fc-/);
    assert.equal(data.kv.customFamilies[lever.family], 'Kelso Shrug');
    assert.equal(data.exercises.find((e) => e.id === machine.id).family, lever.family);
    assert.ok(await page.getByTestId(`family-equipment-${machine.id}`).count());
    await searchAgain(page);
    ok(`${theme}: explicitly picking an ungrouped exercise creates a family for both without another question`);

    const beforeCancel = await stored(page);
    await create(page, 'Cancelled exercise');
    await page.getByTestId('exercise-family').click(); await page.getByTestId('pick-search').fill('Squat (Panatta Machine)');
    await page.getByTestId(`pick-${separate.id}`).click();
    await page.getByTestId('exercise-family').waitFor(); await page.getByTestId('exercise-cancel').click();
    await page.getByTestId('exercise-search').waitFor();
    assert.deepEqual(await stored(page), beforeCancel);
    assert.deepEqual((await stored(page)).workouts, initial.workouts);
    ok(`${theme}: Cancel after picking an ungrouped exercise saves no exercise, family, sibling change or history`);
    if (theme === 'light') {
      const beforeFailure = await stored(page);
      await create(page, 'Retry Row (Machine)');
      await page.getByTestId('exercise-family').click(); await page.getByTestId('pick-search').fill('Squat (Panatta Machine)');
      await page.getByTestId(`pick-${separate.id}`).click();
      await failWrites(page);
      await page.getByTestId('exercise-save').click();
      await page.getByText('Couldn’t save. Your changes are still here; try again or back up now.', { exact: true }).waitFor();
      assert.deepEqual(await stored(page), beforeFailure);
      assert.ok(await page.getByTestId('exercise-name').isVisible());
      await failWrites(page, false);
      await page.getByTestId('exercise-save').click(); await page.getByTestId('exercise-name').waitFor({ state: 'hidden' });
      const retry = (await stored(page)).exercises.find((e) => e.name === 'Retry Row (Machine)');
      assert.match(retry.family, /^fc-/);
      assert.equal((await stored(page)).exercises.find((e) => e.id === separate.id).family, retry.family);
      await searchAgain(page);
      ok('a failed grouped Save keeps the form and all stored data intact, and retry saves both members and their family');
    }

    await page.goto(APP); await selectTab(page, 'plan');
    await page.getByTestId('plan-add').click(); await page.getByTestId('sheet-dialog').getByTestId('start-empty').click();
    await page.getByTestId('add-exercises').click(); await page.getByTestId('pick-new').click();
    await page.getByTestId('exercise-name').fill('Nested Squat (Cable)');
    await page.getByTestId('exercise-family').click();
    await page.getByTestId('pick-title').filter({ visible: true, hasText: 'Variation of' }).waitFor();
    await page.getByTestId('pick-family-f-squat').filter({ visible: true }).click();
    await page.getByTestId('exercise-save').click();
    await page.getByTestId('exercise-name').waitFor({ state: 'hidden' });
    const nested = (await stored(page)).exercises.find((e) => e.name === 'Nested Squat (Cable)');
    assert.equal(nested.family, 'f-squat');
    await page.getByTestId('pick-add').filter({ visible: true }).click(); await page.getByTestId(`block-${nested.id}`).waitFor();
    await waitStored(page, (d, id) => d.kv.active?.exercises.some((e) => e.exerciseId === id), nested.id);
    assert.ok((await stored(page)).kv.active.exercises.some((e) => e.exerciseId === nested.id));
    ok(`${theme}: a Variation picker inside New exercise preserves the outer session picker and adds the exercise to its draft`);
    assert.deepEqual(errors, []); await ctx.close();
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${OUT}/failure.png` });
    console.log('Failure URL:', activePage.url());
    console.log('Visible picker titles:', await activePage.getByTestId('pick-title').filter({ visible: true }).allTextContents());
  }
  throw error;
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
