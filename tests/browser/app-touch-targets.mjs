// The box itself is the touch target. Run REVIEW=1 (and REVIEW_BEFORE=1 on
// main) for matching light/dark, real-size captures of every visited surface.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, devices, grantWakeLock, APP, BACKUP, ROOT, shots, openSearch, storedData, writeStored } from './env.mjs';

const review = process.env.REVIEW === '1', before = process.env.REVIEW_BEFORE === '1';
const OUT = shots(review ? `touch-targets/${before ? 'before' : 'after'}` : 'app-touch-targets');
const hitMin = parseFloat(JSON.parse(fs.readFileSync(`${ROOT}/docs/design/tokens.json`, 'utf8')).control.tokens.find(t => t.name === 'hit-min').value);
assert.ok(Number.isFinite(hitMin) && hitMin > 0, 'read the touch-target token');
const browser = await launch();
let passed = 0;
const failures = new Set();
const ok = label => { passed++; console.log('PASS', label); };

// Exceptions are delegated inputs, never a size waiver: measure the enclosing
// target instead. SetField focuses its input; the web switch's padding toggles
// once while the native input keeps keyboard and screen-reader semantics.
const exceptions = [
  { selector: 'input[data-testid^="in-"]', ancestor: '[data-testid^="field-"]', reason: 'SetField focuses its input from the whole box' },
  { selector: 'input[role="switch"]', ancestor: '[data-testid$="-target"]', reason: 'web SwitchSettingRow toggles from its padded box' },
];
// Full-width rows need no exception: their own box must meet the same minimum.
const targets = 'button, a[href], [role="button"], [role="link"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role="menuitem"], input, textarea';

async function measure(page, screen) {
  const result = await page.evaluate(({ targets, exceptions, hitMin }) => {
    const checked = [], failed = [];
    for (const input of document.querySelectorAll(targets)) {
      if (input.closest('[inert], [aria-hidden="true"]')) continue;
      const style = getComputedStyle(input);
      if (style.display === 'none' || style.visibility === 'hidden' || input.type === 'hidden') continue;
      const exception = exceptions.find(x => input.matches(x.selector));
      const el = exception ? input.closest(exception.ancestor) : input;
      const label = input.dataset.testid || input.getAttribute('aria-label') || input.textContent?.trim().slice(0, 80) || input.tagName;
      const rect = (el || input).getBoundingClientRect();
      const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
      const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
      if (!rect.width || !rect.height || right <= left || bottom <= top) continue;
      // Hit testing excludes clipped rows, inactive screens, and controls behind
      // a modal/sheet. Probe more than the centre for partially visible targets.
      const exposed = [0.2, 0.5, 0.8].some(x => [0.2, 0.5, 0.8].some(y => {
        const hit = document.elementFromPoint(left + (right - left) * x, top + (bottom - top) * y);
        return hit && (el || input).contains(hit);
      }));
      if (!exposed) continue;
      checked.push(label);
      if (!el) failed.push(`${label}: missing target wrapper (${exception.reason})`);
      else if (rect.width < hitMin - 0.5 || rect.height < hitMin - 0.5) failed.push(`${el.dataset.testid || label}: ${rect.width.toFixed(1)} × ${rect.height.toFixed(1)} px`);
    }
    return { checked, failed };
  }, { targets, exceptions, hitMin });
  for (const f of result.failed) {
    const message = `${screen}: ${f}`;
    if (!failures.has(message)) console.error(message);
    failures.add(message);
  }
  return result.checked.length;
}

async function audit(page, name) {
  let count = await measure(page, name);
  // Sweep real scroll views so checks cover controls below the fold too.
  const scrolls = await page.locator('div').evaluateAll(els => els.filter(el => {
    const r = el.getBoundingClientRect();
    return !el.closest('[inert], [aria-hidden="true"]') && r.width > 0 && r.height > 100 && r.left < innerWidth && r.right > 0 && el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY);
  }).map((el, i) => { el.setAttribute('data-touch-scroll', String(i)); return { id: i, height: el.clientHeight, max: el.scrollHeight - el.clientHeight, initial: el.scrollTop }; }));
  for (const scroll of scrolls) {
    const el = page.locator(`[data-touch-scroll="${scroll.id}"]`);
    for (let y = 0; y < scroll.max + scroll.height; y += scroll.height * 0.75) {
      await el.evaluate((el, y) => { el.scrollTop = y; }, Math.min(y, scroll.max));
      await page.waitForTimeout(35);
      count += await measure(page, name);
    }
    await el.evaluate((el, y) => { el.scrollTop = y; el.removeAttribute('data-touch-scroll'); }, scroll.initial);
  }
  await page.waitForTimeout(150); // let the final scroll/keyboard-dismiss events settle
  assert.ok(count > 0, `${name}: measured no targets`);
  ok(`${name}: ${count} visible target measurements`);
}

async function neighbours(page, exercise) {
  const ids = ['ex-title-', 'focus-', 'ex-menu-'].map(p => p + exercise);
  if (await page.getByTestId(`rest-tag-${exercise}`).count()) ids.push(`rest-tag-${exercise}`);
  const boxes = await Promise.all(ids.map(id => page.getByTestId(id).boundingBox()));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(a && b, `missing ${ids[i]} or ${ids[j]}`);
    const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;
    assert.ok(!overlap, `${ids[i]} overlaps ${ids[j]}: ${JSON.stringify({ a, b })}`);
  }
}

// The grey line under the name wraps in parts (facts, Rest and its dot, last time):
// a wrapped part starts with a word, never with the "·" that joined it to Rest.
async function noLeadingDot(page, exercise) {
  const parts = await page.getByTestId(`last-${exercise}`).evaluate(el => [...el.children].map(c => c.innerText.trim()));
  assert.ok(parts.length > 1 && parts.every(p => !p.startsWith('·')), `a part of the grey line starts with "·": ${parts.join(' | ')}`);
  const rest = await page.getByTestId(`rest-tag-${exercise}`).boundingBox();
  const dot = await page.getByTestId(`rest-tag-${exercise}`).evaluate(el => el.nextElementSibling?.getBoundingClientRect().y);
  if (dot !== undefined) assert.ok(Math.abs(dot - rest.y) < 1, 'the dot after Rest stays on its line');
}

try {
  for (const theme of review ? ['light', 'dark'] : ['light']) {
    const data = JSON.parse(fs.readFileSync(BACKUP, 'utf8')).data;
    const now = new Date(); now.setHours(12, 0, 0, 0);
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const delta = +yesterday - Math.max(...data.workouts.map(w => w.startedAt));
    // Shift the 2021 export as a whole, preserving workout lengths and spacing.
    for (const w of data.workouts) {
      w.startedAt += delta; w.endedAt += delta;
      for (const e of w.exercises) for (const s of e.sets) if (s.at) s.at += delta;
    }
    Object.assign(data.kv.settings, { language: 'en', theme, showExamples: true, appKeepAwake: false, defaultRest: 120 });
    Object.assign(data.kv.meta, { lastBackupAt: +now - 30 * 86400000, backupSnoozedAt: 0 });
    const routine = data.templates[0];
    // The backup's Pull routine has no logged history. Use a logged exercise
    // in its first slot to cover the last-time footnote as well as the targets.
    routine.exercises[0].exerciseId = 'x-bench-press-barbell';
    const exercise = routine.exercises[0].exerciseId;
    const latest = data.workouts.reduce((a, b) => a.startedAt > b.startedAt ? a : b);
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: theme });
    await ctx.addInitScript(grantWakeLock);
    await ctx.addInitScript(data => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', JSON.stringify(data)); }, data);
    const page = await ctx.newPage(), errors = [];
    let clock = +now;
    await page.clock.setFixedTime(clock);
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
    const id = value => page.getByTestId(value).filter({ visible: true });
    const go = async (route, ready) => { await page.waitForTimeout(350); await page.goto(APP + route); await id(ready).waitFor(); await page.waitForTimeout(250); };
    const screen = async name => {
      console.log('SCREEN', theme, name);
      // RN Animated uses Date.now(): advance the fixed date so sheets/keypads
      // finish opening, while before/after timers remain deterministic.
      await page.clock.setFixedTime(clock += 1000);
      const timerVisible = name.startsWith('workout-') || ['start-time', 'rest-menu', 'focus-menu', 'rest-next', 'today-running'].includes(name);
      await page.waitForTimeout(timerVisible ? 1100 : 250);
      for (const dialog of await page.locator('[data-testid="sheet-dialog"], [data-testid="datetime-dialog"]').all()) {
        assert.ok(await dialog.evaluate(el => {
          for (let p = el; p; p = p.parentElement) if (Number(getComputedStyle(p).opacity) < 0.99) return false;
          return true;
        }), `${name}: the overlay must finish fading in before capture and measurement`);
      }
      await page.screenshot({ path: `${OUT}/${theme}-${name}.png` });
      if (!before && !review) await audit(page, name);
    };
    const sheet = async (trigger, name) => { await id(trigger).click(); await id('sheet-cancel').waitFor(); await screen(name); await id('sheet-cancel').click(); };

    await go('/', 'open-account'); await screen('today');
    await go('/muscle/legs', 'muscle-title'); await screen('muscle');
    if (!before) {
      const link = page.locator('[data-testid^="muscle-ex-link-"]').first();
      const row = page.locator('[data-testid^="muscle-workout-"]').first();
      const a = await link.boundingBox(), b = await row.boundingBox();
      assert.ok(a.y + a.height <= b.y + 0.5, 'muscle section link must not overlap its first workout row');
    }
    await go('/plan', 'templates-menu'); await screen('plan');
    if (!before) {
      const a = await id('hide-examples').boundingBox(), b = await id('template-example-push').boundingBox();
      assert.ok(a.y + a.height <= b.y + 0.5, 'Hide must not overlap the first example');
    }
    await sheet('plan-add', 'plan-add-menu');
    await sheet('templates-menu', 'plan-routines-menu');
    await sheet(`folder-menu-${routine.folder}`, 'plan-folder-menu');
    await sheet(`template-menu-${routine.id}`, 'plan-routine-menu');
    await id(`template-menu-${routine.id}`).click(); await id('tpl-menu-edit').click(); await id('tpl-name').waitFor(); await screen('routine-editor');
    if (!before) await neighbours(page, exercise);
    await id('tpl-cancel').click();
    await id(`template-menu-${routine.id}`).click(); await id('tpl-menu-archive').click(); await id('toast-action').waitFor(); await screen('toast'); await id('toast-action').click();
    await go('/progress', 'open-account-progress'); await screen('progress');
    await go('/history', 'history-view'); await screen('history'); await id('history-view').click(); await id('cal-month').waitFor(); await screen('history-calendar');
    await go('/exercises', 'lifts-search'); await screen('lifts');
    await go(`/workout/${latest.id}`, 'workout-title'); await screen('workout-detail');
    await go(`/workout-edit/${latest.id}`, 'edit-name'); await screen('edit-workout'); await id('edit-cancel').click();
    await go(`/exercise/${exercise}`, 'exercise-metric'); await screen('exercise');
    await sheet('exercise-metric', 'exercise-metric-menu');
    await go('/measure/bodyweight', 'measure-chart'); await screen('body-weight');
    await go('/tools', 'tools-done'); await screen('tools-plates'); await id('tools-tabs-rm').click(); await screen('tools-rm');
    await go('/', 'open-account'); await openSearch(page); await id('exercise-search').focus(); await screen('search');
    if (!before) {
      await id('exercise-search').blur(); await id('exercise-search-target').click({ position: { x: 3, y: hitMin / 2 } });
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'exercise-search');
      await id('search-parts-chest').click();
      await id('search-parts-all').click({ position: { x: 0.25, y: hitMin / 2 } });
      assert.equal(await id('search-parts-all').getAttribute('aria-selected'), 'true', 'the first chip target is not clipped by its scroll view');
    }
    await id('new-exercise').click(); await id('exercise-name').waitFor(); await screen('new-exercise'); await id('exercise-cancel').click();
    await go('/', 'open-account'); await id('open-account').click(); await id('account-done').waitFor(); await screen('account');
    await id('set-pair-sides').scrollIntoViewIfNeeded(); await screen('account-switches');
    if (!before) {
      const input = id('set-pair-sides').locator('input');
      const initial = await input.isChecked();
      await input.click(); assert.equal(await input.isChecked(), !initial, 'one switch click toggles once');
      await id('set-pair-sides-target').click({ position: { x: 2, y: 2 } }); assert.equal(await input.isChecked(), initial, 'padding toggles once');
      await input.focus(); await page.keyboard.press('Space'); assert.equal(await input.isChecked(), !initial, 'keyboard still toggles the one switch');
      await input.click();
    }
    await id('set-warmup').click(); await id('wu-bar').waitFor(); await screen('warmup'); await id('wu-cancel').click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), id('strong-import').click()]);
    await chooser.setFiles(`${ROOT}/tests/fixtures/strong-review.csv`); await id('strong-review').waitFor(); await screen('strong-import'); await id('strong-cancel').click();
    await go(`/template/${routine.id}`, 'start-template'); await screen('routine-detail');
    await id('start-template').click(); await id('workout-name').waitFor(); await screen('workout-running');
    if (!before) await neighbours(page, exercise);
    await id(`ex-menu-${exercise}`).click(); await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await id(`ex-note-${exercise}`).waitFor(); await screen('workout-note');
    if (!before) {
      const a = await id(`rest-tag-${exercise}`).boundingBox(), b = await id(`ex-note-${exercise}`).boundingBox();
      assert.ok(a.y + a.height <= b.y + 0.5, 'Rest must not overlap the note input');
      await noLeadingDot(page, exercise);
    }
    await id(`ex-menu-${exercise}`).click(); await page.getByRole('button', { name: 'Remove note', exact: true }).click();
    await id('start-time').click(); await id('day-prev').waitFor(); await screen('start-time'); await id('dialog-cancel').click();
    await id(`rest-tag-${exercise}`).click(); await id('rest-120').waitFor(); await screen('rest-menu'); await id('rest-120').click();
    await id(`focus-${exercise}`).click(); await id('sheet-cancel').waitFor(); await screen('focus-menu'); await id('focus-volume').click(); await screen('workout-focus');
    if (!before) await neighbours(page, exercise);
    if (before) await id(`block-${exercise}`).locator('input[data-testid^="in-w-"]').first().click();
    else await id(`block-${exercise}`).locator('[data-testid^="field-w-"]').first().click({ position: { x: 4, y: hitMin / 2 } }); await id('keypad-close').waitFor(); await screen('workout-keypad'); await id('keypad-close').click();
    await id(`block-${exercise}`).locator('[data-testid^="check-"]').nth(1).click(); await id('rest-skip').waitFor(); await screen('workout-resting');
    for (const check of await id(`block-${exercise}`).locator('[data-testid^="check-"]').all()) if ((await check.getAttribute('aria-checked')) !== 'true') await check.click();
    await id('rest-next').waitFor(); await screen('rest-next'); await id('rest-skip').click();
    await id(`ex-menu-${exercise}`).click(); await id('menu-reorder').click(); await id('reorder-done').waitFor(); await screen('reorder'); await id('reorder-done').click();
    await id('add-exercises').click(); await id('pick-search').waitFor(); await screen('exercise-picker'); await id('pick-cancel').click();
    await id('minimize').click(); await id('start-template').waitFor(); await page.waitForTimeout(200); await go('/', 'open-account'); await screen('today-running');

    // Long exercise and facts at 320 px: targets stay separate; text stays on screen.
    const saved = await storedData(page);
    saved.exercises.find(e => e.id === exercise).name = 'A very long exercise name for the narrow phone (Cable)';
    await writeStored(page, saved); await page.setViewportSize({ width: 320, height: 844 });
    await go('/active', 'workout-name'); await screen('workout-narrow');
    if (!before) {
      await neighbours(page, exercise);
      const meta = await id(`last-${exercise}`).boundingBox();
      assert.ok(meta.x >= 0 && meta.x + meta.width <= 320, 'facts stay within 320 px');
      await noLeadingDot(page, exercise);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await go(`/summary/${latest.id}`, 'summary-done'); await screen('summary');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  assert.deepEqual([...failures], [], 'undersized touch targets (screen: testID/label: width × height)');
} finally { await browser.close(); }
console.log(`\n${passed} checks passed`);
