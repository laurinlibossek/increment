// Dragging the keypad down (#31): from the handle or the title the whole
// keypad follows the finger; a long enough drag or a flick closes it, a short
// one springs back; a drag that starts on the keys never closes it; a tap on
// the handle and a mouse drag still work. Its fields keep Safari's keyboard
// down (inputmode none, #25); Tools keeps its number keyboards. Touch is real
// browser input (CDP Input.dispatchTouchEvent), as in app-tab-swipe.
import assert from 'node:assert/strict';
import { launch, devices, grantWakeLock, APP, shots } from './env.mjs';
import { SEED_EXERCISES, SEED_VERSION } from '../../core/index.js';

const OUT = shots('app-keypad-drag');
const BENCH = 'x-bench-press-barbell';
const browser = await launch();
let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };

const now = Date.now();
const data = {
  exercises: SEED_EXERCISES, workouts: [], templates: [], measurements: [],
  kv: {
    settings: { language: 'en', showExamples: false, appKeepAwake: false },
    meta: { seedVersion: SEED_VERSION, createdAt: 1000, lastBackupAt: now },
    active: { id: 'live', kind: 'workout', name: 'Push', notes: '', startedAt: now - 60000, templateId: null, templateNotes: '', rest: null, updatedAt: now,
      exercises: [{ id: 'e', exerciseId: BENCH, notes: '', showNotes: false, supersetId: null, restSec: 0,
        sets: [{ id: 's1', type: 'normal', w: '80', r: '5', d: '', t: '', rpe: '', done: false }] }] },
  },
};

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, locale: 'en-US', colorScheme: theme });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((json) => { if (!localStorage.getItem('increment.data')) localStorage.setItem('increment.data', json); }, JSON.stringify(data));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = (t) => page.getByTestId(t);
  const input = await ctx.newCDPSession(page);
  const keypad = id('keypad');
  const shift = () => keypad.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
  const openPad = async () => { await id('in-w-s1').click(); await keypad.waitFor(); await page.waitForTimeout(150); };
  const centre = async (t) => { const b = await id(t).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  /** A finger from `from` down by `dy` px at `speed` px/s; `during` runs before it lets go. */
  async function drag(from, dy, { speed = 300, during, hold = 120, steps = Math.max(6, Math.ceil(dy / 10)) } = {}) {
    const { x, y } = await centre(from);
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= steps; i++) {
      await page.waitForTimeout(1000 * dy / speed / steps);
      await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * i / steps }] });
    }
    if (hold) await page.waitForTimeout(hold);
    if (during) await during();
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  await page.goto(`${APP}/active`);
  await id(`block-${BENCH}`).waitFor();
  // the phone's own keyboard stays down: Safari only honours inputmode="none" (#25)
  assert.deepEqual(await page.locator('[data-testid^="in-"]').evaluateAll((els) => els.map((e) => e.getAttribute('inputmode'))), ['none', 'none']);
  await openPad();

  // a short drag follows the finger and springs back
  let mid = 0;
  await drag('keypad-close', 40, { during: async () => { mid = await shift(); } });
  // it follows from the moment the drag is recognised (a few px in), so a little less than the finger's 40 px
  assert.ok(mid > 15 && mid <= 40, `the keypad moved ${mid} px with the finger`);
  await page.waitForTimeout(500);
  assert.equal(await keypad.count(), 1, 'still open');
  assert.ok(Math.abs(await shift()) < 1, 'back in place');

  // a long drag from the handle closes it, mid-drag on screen
  await drag('keypad-close', 160, { during: async () => { await page.screenshot({ path: `${OUT}/mid-drag-${theme}.png` }); } });
  await keypad.waitFor({ state: 'detached' });
  await id('log-set').waitFor();
  ok(`${theme}: the keypad follows the finger; a short drag springs back, a long one closes it and the Action bar is back`);

  // from the title too; and a quick flick of a few dozen px
  await openPad();
  await drag('keypad-value', 120);
  await keypad.waitFor({ state: 'detached' });
  await openPad();
  // 60 px in four quick moves and let go at once: under the distance, over the speed
  await drag('keypad-close', 60, { speed: 6000, hold: 0, steps: 4 });
  await keypad.waitFor({ state: 'detached' });
  ok(`${theme}: a drag from the title and a flick close it too`);

  // sliding down over the keys never closes it
  await openPad();
  await drag('key-5', 200);
  await page.waitForTimeout(400);
  assert.equal(await keypad.count(), 1);
  assert.ok(Math.abs(await shift()) < 1);
  // a tap on the handle still closes it, and a mouse drag works in the web app
  await id('keypad-close').click();
  await keypad.waitFor({ state: 'detached' });
  await openPad();
  const { x, y } = await centre('keypad-close');
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + 16 * i);
  await page.mouse.up();
  await keypad.waitFor({ state: 'detached' });
  ok(`${theme}: a drag over the keys leaves it open; a tap on the handle and a mouse drag close it`);

  // the editors and Tools keep their number keyboards
  if (theme === 'light') {
    await page.goto(`${APP}/tools`);
    await id('tools-tabs-rm').click();
    assert.equal(await id('rm-w').getAttribute('inputmode'), 'decimal');
    assert.equal(await id('rm-r').getAttribute('inputmode'), 'numeric');
    ok('the keypad\'s fields keep the phone\'s keyboard down (inputmode none); Tools keeps its number keyboards');
  }

  assert.deepEqual(errors, []);
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
