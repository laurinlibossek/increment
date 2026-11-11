// The shipped app stays English even on a non-English phone or after restoring
// Setlog's German language setting, with dates and numbers in the phone's region
// (English words: "Friday, 6 November", "82,4 kg" on a German phone). Built without
// EXPO_PUBLIC_ENABLE_GERMAN, like the store and web apps.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectTab, openSearch, launch, devices, grantWakeLock, APP, BACKUP, shots, storedData } from './env.mjs';

const OUT = shots('app-english-only');
const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
assert.equal(backup.data.kv.settings.language, 'de', 'the Setlog fixture must carry German');
const browser = await launch();
let passed = 0;
const ok = label => { passed++; console.log('PASS', label); };
const stored = page => storedData(page);

async function englishAccount(page) {
  assert.match(await page.getByTestId('restore').innerText(), /Restore from backup/);
  assert.match(await page.getByTestId('account-done').innerText(), /Done/);
  assert.equal(await page.locator('[data-testid^="language-"]').count(), 0);
  assert.equal(await page.getByText('Language', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Sprache', { exact: true }).count(), 0);
}

try {
  for (const [locale, theme] of [['de-DE', 'light'], ['fr-FR', 'dark']]) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale, colorScheme: theme });
    await ctx.addInitScript(grantWakeLock);
    const page = await ctx.newPage();
    const errors = [], dialogs = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' && !/favicon|DevTools/.test(message.text())) errors.push(message.text()); });
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
    const id = name => page.getByTestId(name);

    await page.goto(APP);
    await id('start-empty').waitFor();
    assert.match(await id('up-next').innerText(), /Up next[\s\S]*Empty workout[\s\S]*Start an empty workout/);
    const region = `en-${locale.split('-')[1]}`;
    const today = await page.evaluate((l) => new Intl.DateTimeFormat(l, { weekday: 'long', day: 'numeric', month: 'long' }).format(Date.now()), region);
    assert.match(today, /^[A-Z][a-z]+day, \d{1,2} [A-Z][a-z]+$/, 'English words, day before month');
    await page.getByText(today, { exact: true }).waitFor();
    ok(`${locale}: first start is English, the date in the phone's region (${today})`);

    await id('open-account').click();
    await id('restore').waitFor();
    await englishAccount(page);
    await page.screenshot({ path: `${OUT}/${locale}-${theme}-account-first-start.png` });
    ok(`${locale}: Account is English and has no Language choice`);

    const restored = page.waitForEvent('dialog', { predicate: dialog => /Backup restored/.test(dialog.message()) });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), id('restore').click()]);
    await chooser.setFiles(BACKUP);
    await restored;
    assert.match(dialogs[0], /Replace all data\?[\s\S]*86 workouts, 1 routine and 2 measurements/);
    assert.match(dialogs[1], /Backup restored[\s\S]*86 workouts stored/);
    await englishAccount(page);
    assert.match(await id('set-name').innerText(), /Laurin/);
    const data = await stored(page);
    assert.equal(data.kv.settings.language, 'de', 'the dormant preference is preserved');
    assert.equal(data.kv.settings.theme, backup.data.kv.settings.theme);
    assert.equal(data.kv.settings.unit, backup.data.kv.settings.unit);
    assert.deepEqual(data.workouts, backup.data.workouts);
    assert.deepEqual(data.templates, backup.data.templates);
    assert.deepEqual(data.measurements, backup.data.measurements);
    assert.equal(await id('theme-intense-red').getAttribute('aria-checked'), 'true');
    await page.screenshot({ path: `${OUT}/${locale}-${theme}-account-restored.png` });
    ok(`${locale}: restoring a German Setlog backup stays English and preserves settings and data`);

    await page.reload();
    await id('restore').waitFor();
    await englishAccount(page);
    assert.equal((await stored(page)).kv.settings.language, 'de');
    // A reloaded modal has no Expo navigation stack to pop back to Today.
    await page.goto(APP);
    await selectTab(page, 'progress');
    assert.match(await id('progress-workouts').innerText(), /Workouts/);
    assert.match(await id('progress-body').innerText(), /82,4 kg/);
    await id('progress-body').click();
    assert.match(await id('measure-bodyweight').innerText(), /Body weight[\s\S]*82,4 kg/);
    ok(`${locale}: persisted German settings reload in English, numbers in the phone's region (82,4 kg)`);

    await page.goBack();
    await openSearch(page);
    await id('exercise-search').fill('bench bb');
    await id('exercise-x-bench-press-barbell').waitFor();
    assert.match(await id('exercise-x-bench-press-barbell').innerText(), /Bench Press \(Barbell\)[\s\S]*Chest/);
    assert.doesNotMatch(await id('exercise-x-bench-press-barbell').innerText(), /Bankdrücken|Brust/);
    await page.screenshot({ path: `${OUT}/${locale}-${theme}-exercises.png` });
    ok(`${locale}: built-in exercise names and body parts stay English`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${passed} checks passed`);
