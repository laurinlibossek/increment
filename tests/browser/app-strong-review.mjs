// Import decisions, compatible matching, cancellation and durable aliases.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, devices, grantWakeLock, APP, ROOT, shots } from './env.mjs';

const OUT = shots('app-strong-review');
const csv = fs.readFileSync(path.join(ROOT, 'tests/fixtures/strong-review.csv'), 'utf8');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };
const data = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('increment.data')));
async function pickFile(page, text = csv) {
  const [picker] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('strong-import').click()]);
  await picker.setFiles({ name: 'review.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
  await page.getByTestId('strong-review').waitFor();
}
async function option(page, id, value) {
  await page.getByTestId(id).click();
  await page.getByTestId(`strong-option-${value}`).click();
}
async function setup(theme, language) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: language === 'de' ? 375 : 390, height: 844 }, colorScheme: theme, locale: language === 'de' ? 'de-DE' : 'en-US' });
  await ctx.addInitScript(grantWakeLock);
  const page = await ctx.newPage(), errors = [], dialogs = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Download the React DevTools/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  await page.goto(APP);
  await page.getByTestId('open-account').click();
  await page.getByTestId(`language-${language}`).click();
  await page.getByTestId(`theme-${theme}`).click();
  return { ctx, page, errors, dialogs };
}

for (const language of ['en', 'de']) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await setup(theme, language);
  const before = await data(page);
  await pickFile(page);
  assert.equal(await page.locator('[data-testid^="strong-row-"]').count(), 4);
  assert.match(await page.getByTestId('strong-matched').innerText(), language === 'en' ? /1 exercise matched/ : /1 Übung zugeordnet/);
  assert.match(await page.getByTestId('strong-row-0').innerText(), language === 'en' ? /2 sessions/ : /2 Einheiten/);
  assert.equal(await page.getByTestId('strong-use-0-x-keenan-flap-cable').getAttribute('aria-checked'), 'true');
  assert.equal(await page.getByTestId('strong-confirm').getAttribute('aria-disabled'), 'true');
  assert.equal(await page.getByTestId('strong-row-2').locator('[data-testid^="strong-use-"]').count(), 0, 'time cannot suggest a loaded exercise');
  assert.equal(await page.getByTestId('strong-row-3').locator('[aria-checked="true"]').count(), 0, 'different equipment is never preselected');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${language}-${theme}-review.png` });
  ok(`${language}/${theme}: exact count, distinct sessions, spelling preselection, compatible candidates and disabled Import`);

  // The fallback picker also filters by logged fields and cannot create anything.
  await page.getByTestId('strong-choose-2').click();
  await page.getByTestId('pick-search').fill('Keenan');
  assert.equal(await page.getByTestId('pick-x-keenan-flap-cable').count(), 0);
  assert.equal(await page.getByTestId('pick-new').count(), 0);
  assert.equal(await page.getByTestId('pick-create').count(), 0);
  await page.getByTestId('pick-search').fill('Plank');
  await page.getByTestId('pick-x-plank').waitFor();
  await page.screenshot({ path: `${OUT}/${language}-${theme}-picker.png` });
  await page.getByTestId('pick-x-plank').click();
  assert.equal(await page.getByTestId('strong-choose-2').getAttribute('aria-checked'), 'true');
  ok(`${language}/${theme}: manual existing choice shows only compatible exercises, with no create side effect`);

  await page.getByTestId('strong-new-1').click();
  await page.getByTestId('strong-name-1').fill('Orbit Machine');
  assert.match(await page.getByTestId('strong-problem-1').innerText(), language === 'en' ? /Choose a body part/ : /Körperbereich/);
  await page.getByTestId('strong-category-1').click();
  assert.equal(await page.locator('[data-testid^="strong-option-"]').count(), 5);
  await page.getByTestId('strong-option-dumbbell').click();
  await page.getByTestId('strong-body-1').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/${language}-${theme}-new.png` });
  await option(page, 'strong-body-1', 'shoulders');
  await page.getByTestId('strong-new-2').click();
  await page.getByTestId('strong-name-2').fill('Flap Hold');
  await page.getByTestId('strong-category-2').click();
  assert.equal(await page.locator('[data-testid^="strong-option-"]').count(), 1);
  await page.getByTestId('strong-option-duration').click();
  await option(page, 'strong-body-2', 'chest');
  await page.getByTestId('strong-new-3').click();
  assert.match(await page.getByTestId('strong-family-3').innerText(), language === 'en' ? /Joins Squat/ : /Gehört zu Kniebeuge/);
  await page.getByTestId('strong-family-3').scrollIntoViewIfNeeded();
  assert.equal(await page.getByTestId('strong-confirm').isEnabled(), true);
  await page.screenshot({ path: `${OUT}/${language}-${theme}-family.png` });
  ok(`${language}/${theme}: editable names, required body part, category limits and exact family grouping`);
  assert.deepEqual(await data(page), before, 'review has written nothing');
  // Choices were made, so leaving asks first.
  await page.getByTestId('strong-cancel').click();
  await page.getByTestId('confirm-discard-changes').waitFor();
  await page.getByText(language === 'en' ? 'Discard changes?' : 'Änderungen verwerfen?', { exact: true }).waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${language}-${theme}-discard.png` });
  await page.getByTestId('dialog-cancel').click();
  await page.getByTestId('confirm-discard-changes').waitFor({ state: 'detached' });
  assert.equal(await page.getByTestId('strong-new-3').getAttribute('aria-checked'), 'true', 'Keep editing keeps every choice');
  await page.getByTestId('strong-cancel').click();
  await page.getByTestId('confirm-discard-changes').click();
  await page.getByTestId('strong-import').waitFor();
  assert.deepEqual(await data(page), before, 'Cancel has written nothing');
  ok(`${language}/${theme}: Cancel after changes asks first; Keep editing keeps the choices, Discard leaves workouts, exercises and aliases unchanged`);
  assert.deepEqual(errors, []);
  await ctx.close();
}

{
  const { ctx, page, errors, dialogs } = await setup('light', 'en');
  await pickFile(page);
  await page.getByTestId('strong-new-1').click();
  await page.getByTestId('strong-name-1').fill('Orbit Machine');
  await option(page, 'strong-body-1', 'shoulders');
  await page.getByTestId('strong-new-2').click();
  await page.getByTestId('strong-name-2').fill('Flap Hold');
  await option(page, 'strong-body-2', 'chest');
  await page.getByTestId('strong-new-3').click();
  await page.getByTestId('strong-confirm').click();
  await page.getByTestId('strong-import').waitFor();
  const first = await data(page);
  assert.match(dialogs.at(-1), /Imported 2 workouts/);
  assert.equal(first.workouts.length, 2);
  assert.equal(first.exercises.filter((e) => e.imported).length, 3);
  const session = first.workouts.find((w) => w.notes === 'First session');
  assert.equal(session.exercises[1].exerciseId, 'x-keenan-flap-cable');
  assert.equal(session.exercises[1].notes, 'Keep this note');
  assert.equal(session.exercises[1].sets[0].w, 20);
  assert.equal(first.kv.strongAliases['Mystery Orbit'], 'c-orbit-machine');
  assert.equal(first.exercises.find((e) => e.id === 'c-squat-cybex-machine').family, 'f-squat');
  ok('Import saves selected IDs, all sets and notes, new names, families and aliases together');

  await page.reload();
  await page.getByTestId('strong-import').waitFor();
  // the same file again: nothing new, so it says so at once instead of opening the review
  const shown = dialogs.length;
  const [again] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('strong-import').click()]);
  await again.setFiles({ name: 'review.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  for (let i = 0; i < 50 && dialogs.length === shown; i++) await page.waitForTimeout(100);
  assert.match(dialogs.at(-1), /All 2 workouts are already imported/);
  assert.equal(await page.getByTestId('strong-review').count(), 0, 'no review screen for a file with nothing new');
  assert.equal((await data(page)).workouts.length, 2);
  ok('same file after reload matches silently and says at once that its workouts are already imported');
  await pickFile(page, csv.replaceAll('2026-10-0', '2026-11-0'));
  assert.equal(await page.locator('[data-testid^="strong-row-"]').count(), 0);
  assert.match(await page.getByTestId('strong-matched').innerText(), /5 exercises matched/);
  await page.screenshot({ path: `${OUT}/en-light-remembered.png` });
  await page.getByTestId('strong-confirm').click();
  await page.getByTestId('strong-import').waitFor();
  assert.equal((await data(page)).workouts.length, 4);
  assert.equal((await data(page)).exercises.filter((e) => e.imported).length, 3);
  ok('newer export reuses remembered targets without creating duplicates');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-now').click()]);
  const backupFile = await download.path();
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  assert.deepEqual(backup.data.kv.strongAliases, (await data(page)).kv.strongAliases);
  const [picker] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('restore').click()]);
  await picker.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('increment.data')).kv.meta.lastBackupAt > 0);
  await pickFile(page, csv.replaceAll('2026-10-0', '2026-12-0'));
  assert.equal(await page.locator('[data-testid^="strong-row-"]').count(), 0);
  ok('downloaded backup and real restore retain every Strong choice');
  // Nothing was changed, so Cancel closes at once.
  await page.getByTestId('strong-cancel').click();
  await page.getByTestId('strong-import').waitFor();
  assert.equal(await page.getByTestId('confirm-discard-changes').count(), 0);
  ok('Cancel without changes closes the review at once');
  assert.deepEqual(errors, []);
  await ctx.close();
}

{
  const { ctx, page, errors, dialogs } = await setup('light', 'en');
  const before = await data(page);
  // One exact match and one spelling suggestion; both are ready immediately.
  await pickFile(page, csv.split('\n').slice(0, 3).join('\n'));
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    window.restoreStorage = () => { Storage.prototype.setItem = setItem; };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'increment.data') throw new DOMException('Storage is full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.getByTestId('strong-confirm').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="strong-confirm"]').getAttribute('aria-disabled') !== 'true');
  assert.match(dialogs.at(-1), /Couldn’t save the import/);
  assert.deepEqual(await data(page), before, 'a failed write cannot publish exercises, workouts or aliases');
  await page.evaluate(() => window.restoreStorage());
  await page.getByTestId('strong-confirm').click();
  await page.getByTestId('strong-import').waitFor();
  assert.match(dialogs.at(-1), /Imported 1 workout/);
  assert.equal((await data(page)).workouts.length, 1, 'the failed attempt did not advance in-memory history');
  assert.equal((await data(page)).kv.strongAliases['Kenan Flaps'], 'x-keenan-flap-cable');
  ok('storage failure leaves the review retryable and saves no partial import');
  assert.deepEqual(errors, []);
  await ctx.close();
}

await browser.close();
console.log(`\n${passed} checks passed`);
