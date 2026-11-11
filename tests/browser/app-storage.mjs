// Storage (#34, #35): the one-time move from localStorage to IndexedDB, saves
// that fail without a false success and stay on screen under a warning, a
// recovery backup that carries the running workout, an atomic Finish, and two
// tabs that can't save over each other's changes.
//
// Storage failures are injected at IndexedDB's own put/delete (failWrites). A
// "stale" tab has no BroadcastChannel, like a tab the browser suspended: it
// only catches up when it comes back to the foreground or saves.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, devices, grantWakeLock, APP, shots, storedData, waitStored, failWrites, selectTab } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION, DAY } from '../../core/index.js';

const OUT = shots('app-storage');
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const CURL = 'x-concentration-curl-dumbbell';
const ROUTINE = 'storage-routine';
function fixture(kv = {}) {
  const at = Date.now() - 2 * DAY;
  return {
    exercises: SEED_EXERCISES,
    workouts: [{ id: 'old-workout', name: 'Arms', startedAt: at, endedAt: at + 1800000, templateId: ROUTINE,
      exercises: [{ id: 'old-entry', exerciseId: CURL, sets: [{ id: 'old-set', type: 'normal', w: 18, r: 6 }] }] }],
    templates: [{ id: ROUTINE, name: 'Arms', exercises: [{ exerciseId: CURL, sets: [{ type: 'normal', w: 20, r: 5 }] }] }],
    measurements: [{ id: 'bw-1', type: 'bodyweight', value: 80, at: Date.now() - DAY }],
    kv: {
      settings: { theme: 'light', language: 'en', showExamples: true, appKeepAwake: false, defaultRest: 0, askTemplateUpdate: false },
      meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: Date.now() },
      ...kv,
    },
  };
}

/** A browser profile; `seed` is put into the old localStorage key before the app first starts (as the other suites do). */
async function profile(seed, theme = 'light') {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: theme, locale: 'en-US', acceptDownloads: true });
  await ctx.addInitScript(grantWakeLock);
  if (seed !== undefined) {
    await ctx.addInitScript((text) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', text); }, typeof seed === 'string' ? seed : JSON.stringify(seed));
  }
  return ctx;
}

/** A tab of the app. `stale`: no BroadcastChannel, so it doesn't hear about other tabs' changes. */
async function tab(ctx, { stale = false, ready = true } = {}) {
  const page = await ctx.newPage(), errors = [], dialogs = [];
  if (stale) await page.addInitScript(() => { window.BroadcastChannel = undefined; });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept().catch(() => {}); });
  await page.goto(APP);
  if (ready) await page.getByTestId('tab-index').waitFor();
  return { page, errors, dialogs, id: (x) => page.getByTestId(x) };
}

/** Wait for a browser dialog (alert, confirm) with this text; the tab accepts every one. */
async function dialog(t, text) {
  for (let i = 0; i < 200 && !t.dialogs.some((d) => text.test(d)); i++) await t.page.waitForTimeout(50);
  assert.ok(t.dialogs.some((d) => text.test(d)), `no dialog ${text}: ${t.dialogs.join(' | ')}`);
}
const shot = async (page, name) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${name}.png` }); };
/** Wait for a toast with this text (an earlier one may still be showing). */
const toast = (page, text) => page.getByTestId('toast').filter({ hasText: text }).waitFor();

async function logBodyWeight(t, value) {
  await t.page.goto(`${APP}/measure`);
  await t.id('log-bodyweight').click();
  await t.id('number-input').fill(String(value));
  await t.id('number-ok').click();
}
async function account(t) {
  await t.page.goto(APP);
  await t.id('open-account').click();
  await t.id('set-examples').waitFor();
}
/** Hide or show the example routines in Account. */
async function examples(t, on) {
  await account(t);
  const sw = t.id('set-examples').getByRole('switch');
  if ((await sw.isChecked()) !== on) await sw.click();
}
async function startRoutine(t) {
  await t.page.goto(`${APP}/template/${ROUTINE}`);
  await t.id('start-template').click();
  await t.id(`block-${CURL}`).waitFor();
}
const weight = (t, i = 0) => t.id(`block-${CURL}`).locator('[data-testid^="in-w-"]').nth(i);
/** Leave the tab and come back (the browser fires visibilitychange both ways). */
async function background(page) {
  for (const state of ['hidden', 'visible']) {
    await page.evaluate((state) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  }
}
async function finish(t) {
  await t.id('workout-menu').click();
  await t.id('menu-finish').click();
  const pending = t.id('save-pending'), confirm = t.id('confirm-finish');
  await pending.or(confirm).first().waitFor();
  if (await pending.count()) await pending.click(); else await confirm.click();
}
const download = async (page, click) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), click()]);
  return fs.readFileSync(await dl.path(), 'utf8');
};

try {
  // ---------- the move from localStorage ----------
  {
    const active = { id: 'run-1', kind: 'workout', name: 'Arms', notes: '', startedAt: Date.now() - 600000, templateId: ROUTINE, templateNotes: '', rest: null, updatedAt: Date.now(),
      exercises: [{ id: 'run-entry', exerciseId: CURL, sets: [{ id: 'run-set', type: 'normal', w: 22, r: 5, done: true }] }] };
    const seed = fixture({ settings: { ...fixture().kv.settings, unit: 'lb' }, active });
    const ctx = await profile(seed);
    const a = await tab(ctx);
    const d = await storedData(a.page);
    assert.deepEqual([d.workouts.length, d.templates.length, d.measurements.length], [1, 1, 1]);
    assert.equal(d.kv.settings.unit, 'lb');
    assert.equal(d.kv.active.id, 'run-1', 'the running workout moves too');
    assert.equal(await a.page.evaluate(() => localStorage.getItem('increment.data')), null, 'the original goes once the copy was read back');
    await logBodyWeight(a, 81);
    await waitStored(a.page, (x) => x.measurements.length === 2);
    // the init script puts the old copy back on every load: it is never moved again
    await a.page.goto(APP);
    await a.id('tab-index').waitFor();
    assert.ok(await a.page.evaluate(() => localStorage.getItem('increment.data')));
    assert.equal((await storedData(a.page)).measurements.length, 2, 'a repeated move cannot overwrite newer data');
    assert.deepEqual(a.errors, []);
    ok('the old data moves to IndexedDB once, is removed after the read-back, and a stale copy is ignored');
    await ctx.close();
  }
  {
    // the first attempt fails (storage full), and a half copy is left behind: the retry replaces it
    const ctx = await profile(fixture());
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('armed')) return;
      sessionStorage.setItem('armed', '1');
      window.__writeGuard = { on: true };
      for (const name of ['put', 'add', 'delete', 'clear']) {
        const original = IDBObjectStore.prototype[name];
        IDBObjectStore.prototype[name] = function (...args) {
          if (window.__writeGuard.on) throw new DOMException('Storage is full', 'QuotaExceededError');
          return original.apply(this, args);
        };
      }
    });
    const a = await tab(ctx, { ready: false });
    await a.id('load-problem').waitFor();
    assert.match(await a.id('load-problem').innerText(), /Couldn’t load your data: Storage is full/);
    assert.ok(await a.page.evaluate(() => localStorage.getItem('increment.data')), 'the original stays');
    assert.equal((await storedData(a.page)).workouts.length, 0);
    await a.page.evaluate(async () => {
      window.__writeGuard.on = false;
      const db = await new Promise((r) => { const q = indexedDB.open('increment', 1); q.onsuccess = () => r(q.result); });
      await new Promise((r) => { const tx = db.transaction('docs', 'readwrite'); tx.objectStore('docs').put({ store: 'workouts', id: 'half', rev: 1, data: { id: 'half' } }); tx.oncomplete = r; });
      db.close();
    });
    await a.id('load-retry').click();
    await a.id('tab-index').waitFor();
    const d = await storedData(a.page);
    assert.deepEqual(d.workouts.map((w) => w.id), ['old-workout'], 'the retried move replaces the half copy, without duplicates');
    assert.equal(await a.page.evaluate(() => localStorage.getItem('increment.data')), null);
    ok('an interrupted move keeps the original, shows Try again, and the retry replaces a half copy');
    await ctx.close();
  }
  {
    const raw = '{"workouts": [{"id": "w1", "name": "Legs"';
    const ctx = await profile(raw);
    const a = await tab(ctx, { ready: false });
    await a.id('load-problem').waitFor();
    assert.match(await a.id('load-problem').innerText(), /Your saved data can’t be read/);
    await shot(a.page, 'unreadable-light');
    assert.equal(await download(a.page, () => a.id('save-old-data').click()), raw, 'Save the old data hands over the text as it is');
    assert.equal((await storedData(a.page)).workouts.length, 0, 'nothing is written over it');
    await a.id('start-empty').click();
    await a.id('tab-index').waitFor();
    await dialog(a, /Start without the old data\?/);
    await a.page.reload();
    await a.id('tab-index').waitFor();
    assert.equal(await a.page.evaluate(() => localStorage.getItem('increment.data')), raw, 'the unreadable data stays untouched');
    ok('unreadable old data stops the app with Save the old data and a deliberate Start empty; it is never overwritten');
    await ctx.close();
  }

  // ---------- failed saves ----------
  // (moving around inside the app: a page reload would drop what isn't saved, as it does in any web app)
  let recovery;
  {
    const ctx = await profile(fixture());
    const a = await tab(ctx);
    await failWrites(a.page);
    await selectTab(a.page, 'progress');
    await a.id('progress-body').click();
    await a.id('log-bodyweight').click();
    await a.id('number-input').fill('82');
    await a.id('number-ok').click();
    await toast(a.page, /Couldn’t save/);
    assert.equal(await a.id('toast').filter({ hasText: /logged/ }).count(), 0, 'no success message');
    await a.id('save-warning').waitFor();
    assert.match(await a.id('measure-bodyweight').innerText(), /82 kg/, 'the entry stays on screen');
    assert.equal((await storedData(a.page)).measurements.length, 1);
    await shot(a.page, 'warning-light');
    // keep working: a setting and a routine fail too, the warning stays
    await a.page.goBack();
    await selectTab(a.page, 'index');
    await a.id('open-account').click();
    await a.id('set-examples').getByRole('switch').click();
    await a.id('account-done').click();
    // the running workout: its autosave fails
    await selectTab(a.page, 'plan');
    await a.id(`template-${ROUTINE}`).click();
    await a.id('start-template').click();
    await a.id(`block-${CURL}`).waitFor();
    await weight(a).fill('30');
    await a.page.waitForTimeout(400);
    assert.equal((await storedData(a.page)).kv.active, undefined, 'nothing about the workout could be stored');
    // the routine: archived from Plan while the workout runs
    await a.page.goBack();
    await a.page.goBack();
    await a.id(`template-menu-${ROUTINE}`).click();
    await a.id('tpl-menu-archive').click();
    await toast(a.page, /Couldn’t save/);
    await a.id('save-retry').click();
    await toast(a.page, /Still not saved/);
    await a.id('save-warning').waitFor();
    // Back up now still works and has it all
    await a.id('mini-bar').first().click();
    await a.id(`block-${CURL}`).waitFor();
    recovery = await download(a.page, () => a.id('save-backup').click());
    await toast(a.page, /Backup downloaded/); // the file is made although the "last backed up" note can't be saved
    const file = JSON.parse(recovery);
    assert.equal(Number(file.recovery.active.exercises[0].sets[0].w), 30, 'the backup has the running workout as on screen');
    assert.ok(file.data.measurements.some((m) => m.value === 82), 'and the measurement storage refused');
    assert.equal(file.data.templates[0].archived, true);
    assert.equal(file.data.kv.settings.showExamples, false);
    // Finish while storage fails: nothing is finished, the workout stays
    await finish(a);
    await toast(a.page, /Couldn’t save/);
    await a.id(`block-${CURL}`).waitFor();
    assert.equal((await storedData(a.page)).workouts.length, 1);
    // storage works again: Retry saves everything that waited, then Finish clears the draft in the same transaction
    await failWrites(a.page, false);
    await a.id('save-retry').click();
    await a.id('save-warning').waitFor({ state: 'hidden' });
    let s = await storedData(a.page);
    assert.ok(s.measurements.some((m) => m.value === 82));
    assert.equal(s.kv.settings.showExamples, false);
    assert.equal(s.templates[0].archived, true);
    assert.equal(Number(s.kv.active.exercises[0].sets[0].w), 30);
    await finish(a);
    await a.id('summary-title').waitFor();
    await a.page.waitForTimeout(600);
    s = await storedData(a.page);
    assert.equal(s.workouts.length, 2);
    assert.equal(s.kv.active, undefined, 'a late autosave can’t bring the finished workout back');
    await a.page.goto(APP);
    await a.id('tab-index').waitFor();
    assert.equal((await storedData(a.page)).kv.active, undefined);
    assert.deepEqual(a.errors, []);
    ok('failed saves: no success message, the changes stay on screen under a warning with Retry and Back up now, Retry saves them in order');
    ok('Finish is one transaction: it fails without finishing anything, then saves the workout and clears the draft together');
    await ctx.close();
  }
  {
    // dark screenshot of the warning
    const ctx = await profile(fixture({ settings: { ...fixture().kv.settings, theme: 'dark' } }), 'dark');
    const a = await tab(ctx);
    await failWrites(a.page);
    await logBodyWeight(a, 82);
    await a.id('save-warning').waitFor();
    await shot(a.page, 'warning-dark');
    await ctx.close();
  }

  // ---------- recovery backups ----------
  {
    const backup = `${OUT}/recovery.json`;
    fs.writeFileSync(backup, recovery);
    const ctx = await profile(undefined);
    const a = await tab(ctx);
    await account(a);
    // storage refuses the restore: nothing changes, and it says so
    await failWrites(a.page);
    const [refused] = await Promise.all([a.page.waitForEvent('filechooser'), a.id('restore').click()]);
    await refused.setFiles(backup);
    await dialog(a, /Couldn’t restore the backup/);
    assert.equal(a.dialogs.some((d) => /Backup restored/.test(d)), false);
    assert.equal((await storedData(a.page)).kv.active, undefined);
    await failWrites(a.page, false);
    const [chooser] = await Promise.all([a.page.waitForEvent('filechooser'), a.id('restore').click()]);
    await chooser.setFiles(backup);
    await waitStored(a.page, (d) => Number(d.kv.active?.exercises[0].sets[0].w) === 30);
    await dialog(a, /Backup restored/);
    ok('a refused restore changes nothing; a fresh install restores the running workout from a recovery backup');
    // a different running workout is here: the person picks, and the replaced one is saved to a file first
    const other = JSON.parse(recovery);
    other.recovery.active = { ...other.recovery.active, id: 'other-run', name: 'Other' };
    fs.writeFileSync(backup, JSON.stringify(other));
    await account(a);
    const [again] = await Promise.all([a.page.waitForEvent('filechooser'), a.id('restore').click()]);
    await again.setFiles(backup);
    await a.id('restore-use-backup-workout').waitFor();
    await shot(a.page, 'restore-which-workout');
    const saved = JSON.parse(await download(a.page, () => a.id('restore-use-backup-workout').click()));
    assert.equal(saved.recovery.active.id, JSON.parse(recovery).recovery.active.id, 'the replaced workout is in the file');
    await waitStored(a.page, (d) => d.kv.active?.id === 'other-run');
    for (let i = 0; i < 100 && a.dialogs.filter((x) => /Backup restored/.test(x)).length < 2; i++) await a.page.waitForTimeout(50);
    assert.deepEqual(a.errors, []);
    ok('restoring over a different running workout asks which to keep and saves the replaced one first');
    await ctx.close();
  }

  // ---------- two tabs ----------
  {
    const ctx = await profile(fixture());
    const a = await tab(ctx);
    const b = await tab(ctx);
    // the original report: a measurement in A, examples hidden in the older B
    await logBodyWeight(a, 83);
    await waitStored(a.page, (d) => d.measurements.length === 2);
    await examples(b, false);
    await waitStored(b.page, (d) => d.kv.settings.showExamples === false);
    await b.page.goto(APP);
    await b.id('tab-index').waitFor();
    const d = await storedData(b.page);
    assert.ok(d.measurements.some((m) => m.value === 83), 'B’s save doesn’t remove A’s measurement');
    // a clean tab takes in the other's change at once; a dirty editor keeps its text
    await b.page.goto(`${APP}/template-edit?id=${ROUTINE}`);
    await b.id('tpl-name').fill('Arms B');
    await logBodyWeight(a, 84);
    await b.page.waitForTimeout(400);
    assert.equal(await b.id('tpl-name').inputValue(), 'Arms B', 'an open editor keeps what was typed');
    await b.id('template-save').click();
    await waitStored(b.page, (x) => x.templates[0].name === 'Arms B');
    await b.page.goto(`${APP}/measure`);
    assert.match(await b.id('measure-bodyweight').innerText(), /84 kg/, 'without a reload');
    // the same routine: B's editor is open while A renames it; B's save is held, Keep mine saves it
    await b.page.goto(`${APP}/template-edit?id=${ROUTINE}`);
    await b.id('tpl-name').fill('Arms C');
    await a.page.goto(`${APP}/template/${ROUTINE}`);
    await a.id('template-options').click();
    await a.id('tpl-menu-rename').click();
    await a.id('prompt-input').fill('Arms A');
    await a.id('prompt-ok').click();
    await waitStored(a.page, (x) => x.templates[0].name === 'Arms A');
    await b.page.waitForTimeout(400);
    await b.id('template-save').click();
    await b.id('conflict-review').waitFor();
    assert.equal((await storedData(b.page)).templates[0].name, 'Arms A', 'the editor can’t save over the rename');
    await b.id('conflict-review').click();
    assert.match(await b.page.getByTestId('choice-title').locator('..').innerText(), /Routine “Arms C”[\s\S]*Arms A[\s\S]*Arms C/);
    await b.id('conflict-keep-mine').click();
    await waitStored(b.page, (x) => x.templates[0].name === 'Arms C');
    assert.deepEqual([...a.errors, ...b.errors], []);
    ok('two tabs: changes to different records both stay; a clean tab updates, an open editor keeps its edits and can’t save over a rename');
    await ctx.close();
  }
  {
    const ctx = await profile(fixture());
    const a = await tab(ctx);
    const b = await tab(ctx, { stale: true });
    await examples(b, true); // Account open in B, examples on
    await a.page.goto(APP);
    await a.id('open-account').click();
    await a.id('theme-dark').click();
    await waitStored(a.page, (d) => d.kv.settings.theme === 'dark');
    // the stale B saves the same settings record: refused, its change stays
    await b.id('set-examples').getByRole('switch').click();
    await b.id('conflict-review').waitFor();
    assert.equal((await storedData(b.page)).kv.settings.showExamples, true, 'the stale save was blocked');
    assert.equal((await storedData(b.page)).kv.settings.theme, 'dark');
    assert.equal(await b.id('set-examples').getByRole('switch').isChecked(), false, 'B still shows its change');
    await b.id('conflict-review').click();
    await b.id('conflict-keep-mine').waitFor();
    await shot(b.page, 'conflict-review');
    const text = await b.page.getByTestId('choice-title').locator('..').innerText();
    assert.match(text, /Settings/);
    assert.match(text, /showExamples: false/);
    await b.id('conflict-keep-mine').click();
    await waitStored(b.page, (d) => d.kv.settings.showExamples === false);
    await b.id('save-warning').waitFor({ state: 'hidden' });
    ok('the same record in two tabs: the stale save is blocked with its edit kept, Keep mine saves it after review');
    // and the other way: B takes the saved version
    await background(a.page); // the stale B can't tell A either
    await a.id('theme-dark').click();
    await waitStored(a.page, (d) => d.kv.settings.theme === 'dark');
    await b.id('set-examples').getByRole('switch').click();
    await b.id('conflict-review').click();
    await b.id('conflict-use-saved').click();
    await b.id('save-warning').waitFor({ state: 'hidden' });
    const saved = (await storedData(b.page)).kv.settings;
    assert.deepEqual([saved.theme, saved.showExamples], ['dark', false]);
    assert.equal(await b.id('set-examples').getByRole('switch').isChecked(), false, 'B shows the saved value again');
    await b.page.waitForTimeout(300);
    assert.equal(await b.page.evaluate(() => getComputedStyle(document.body).backgroundColor), await a.page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'B shows the saved theme');
    ok('Use the saved version drops the stale change deliberately and shows what is saved');
    // a suspended tab catches up when it comes back
    await logBodyWeight(a, 85);
    await waitStored(a.page, (d) => d.measurements.some((m) => m.value === 85));
    await b.page.goto(`${APP}/measure`);
    await b.id('measure-bodyweight').waitFor();
    await background(b.page);
    await b.page.waitForFunction(() => /85 kg/.test(document.querySelector('[data-testid="measure-bodyweight"]')?.innerText || ''));
    assert.deepEqual([...a.errors, ...b.errors], []);
    ok('a tab that missed the messages catches up on returning to the foreground');
    await ctx.close();
  }
  {
    // the same running workout in two tabs, edits inside the autosave delay
    const ctx = await profile(fixture());
    const a = await tab(ctx);
    const b = await tab(ctx, { stale: true });
    await startRoutine(a);
    await waitStored(a.page, (d) => d.kv.active);
    await background(b.page);
    await b.page.goto(`${APP}/active`);
    await b.id(`block-${CURL}`).waitFor();
    await weight(a).fill('40');
    await weight(b).fill('45');
    await b.id('conflict-review').waitFor();
    await waitStored(a.page, (d) => Number(d.kv.active.exercises[0].sets[0].w) === 40);
    assert.equal(await weight(b).inputValue(), '45', 'B keeps its number');
    await b.id('conflict-review').click();
    await b.id('conflict-keep-mine').click();
    await waitStored(b.page, (d) => Number(d.kv.active.exercises[0].sets[0].w) === 45);
    ok('the same running workout edited in two tabs: the later stale save is held until the person picks');
    // A finishes; B, stale, edits the finished workout: refused, nothing comes back
    await background(a.page);
    await a.page.goto(`${APP}/active`);
    await finish(a);
    await a.id('summary-title').waitFor();
    await waitStored(a.page, (d) => !d.kv.active && d.workouts.length === 2);
    await weight(b).fill('50');
    await b.id('conflict-review').waitFor();
    await b.page.waitForTimeout(400);
    assert.equal((await storedData(b.page)).kv.active, undefined, 'a stale tab can’t bring a finished workout back');
    await b.id('conflict-review').click();
    await b.id('conflict-use-saved').click();
    await b.id(`block-${CURL}`).waitFor({ state: 'hidden' });
    ok('Finish in one tab: the other tab’s stale edits are held, and Use the saved version ends its workout too');
    await ctx.close();
  }
  {
    // deletes, Delete all data and a restore in one tab can't be undone by a stale one
    const ctx = await profile(fixture());
    const a = await tab(ctx);
    const b = await tab(ctx, { stale: true });
    await b.page.goto(`${APP}/template/${ROUTINE}`);
    await b.id('template-options').waitFor();
    await a.page.goto(`${APP}/template/${ROUTINE}`);
    await a.id('template-options').click();
    await a.id('tpl-menu-delete').click();
    await a.id('confirm-delete').click();
    await waitStored(a.page, (d) => !d.templates.length);
    await b.id('template-options').click();
    await b.id('tpl-menu-archive').click();
    await b.id('conflict-review').waitFor();
    assert.equal((await storedData(b.page)).templates.length, 0, 'the deleted routine stays deleted');
    await b.id('conflict-review').click();
    await b.id('conflict-use-saved').click();
    await b.id('save-warning').waitFor({ state: 'hidden' });
    ok('a routine deleted in one tab is not brought back by a stale tab’s change');
    // Delete all data in A while B (stale) changes a setting
    await account(b);
    await account(a);
    await a.id('delete-all').scrollIntoViewIfNeeded();
    await a.id('delete-all').click();
    await a.id('confirm-delete-all').click();
    await a.id('prompt-input').fill('DELETE');
    await a.id('prompt-ok').click();
    await waitStored(a.page, (d) => !d.workouts.length && !d.measurements.length);
    await b.id('set-examples').getByRole('switch').click();
    await b.id('conflict-review').waitFor();
    const d = await storedData(b.page);
    assert.equal(d.workouts.length + d.measurements.length, 0, 'nothing comes back');
    assert.equal(d.kv.settings?.showExamples, undefined, 'the stale settings save is held');
    assert.deepEqual([...a.errors, ...b.errors], []);
    ok('Delete all data invalidates a stale tab’s waiting saves');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${passed} checks passed`);
