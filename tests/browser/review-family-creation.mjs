// English review captures, 390 CSS px. Serve main on :8791 for --before,
// then this branch on :8790 for after; APP chooses the server in either case.
import { launch, devices, grantWakeLock, APP, shots, openSearch } from './env.mjs';
import { familyCreationData } from './family-creation-data.mjs';
const before = process.argv.includes('--before');
const OUT = shots(`family-creation-review-${before ? 'before' : 'after'}`);
const browser = await launch();
try {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(grantWakeLock);
    await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(familyCreationData(theme)));
    const page = await ctx.newPage();
    const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${before ? 'before' : 'after'}-en-${theme}-${name}.png` }); };
    const create = async (name) => {
      await page.getByTestId('exercise-search').fill(name); await page.getByTestId('new-exercise').click();
      await page.getByTestId('exercise-name').blur();
    };
    const saved = async () => { await page.getByTestId('exercise-name').waitFor({ state: 'hidden' }); await page.getByTestId('exercise-title').waitFor(); };
    const back = async () => { await page.goBack(); await page.getByTestId('exercise-search').fill(''); };
    await page.goto(APP); await openSearch(page);
    await create('Squat (Cybex Machine)'); await shot('form'); await page.getByTestId('exercise-save').click();
    if (!before) {
      await page.getByTestId('confirm-exercise-family').waitFor(); await shot('question');
      await page.getByTestId('confirm-exercise-family').click(); await saved();
    } else {
      await saved(); await page.reload(); await page.getByTestId('exercise-title').waitFor();
      await shot('question'); // The old Save goes straight to the exercise; no question existed.
    }
    await back(); await create('Squat (Panatta Machine)'); await page.getByTestId('exercise-save').click();
    if (!before) await page.getByTestId('dialog-cancel').click();
    await saved(); await back(); await create('Kelso Shrug (Machine)'); await page.getByTestId('exercise-save').click();
    if (!before) await page.getByTestId('confirm-exercise-family').click();
    await saved(); await back(); await page.getByTestId('exercise-search').blur(); await shot('search');
    await page.getByTestId('exercise-search').fill('Kelso Shrug (Cable)'); await page.getByTestId('exercise-c-kelso-cable').click();
    await page.getByTestId('exercise-title').waitFor(); await shot('exercise');
    await ctx.close();
    // The old equivalent is the ordinary exercise picker; the new mode picks a family.
    const pickCtx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    await pickCtx.addInitScript(grantWakeLock);
    await pickCtx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(familyCreationData(theme)));
    const pickPage = await pickCtx.newPage(); await pickPage.goto(APP);
    if (before) {
      await pickPage.getByTestId('tab-plan').click(); await pickPage.getByTestId('plan-add').click();
      await pickPage.getByTestId('sheet-dialog').getByTestId('start-empty').click(); await pickPage.getByTestId('add-exercises').click();
    } else {
      await openSearch(pickPage); await pickPage.getByTestId('new-exercise').click(); await pickPage.getByTestId('exercise-family').click();
    }
    await pickPage.getByTestId('pick-title').waitFor(); await pickPage.waitForTimeout(250);
    await pickPage.screenshot({ path: `${OUT}/${before ? 'before' : 'after'}-en-${theme}-picker.png` });
    await pickCtx.close();
  }
} finally { await browser.close(); }
console.log(`Review screenshots: ${OUT}`);
