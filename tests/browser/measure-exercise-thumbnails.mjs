// Review measurement, not a timing assertion. Serve off/on builds on separate
// ports, then: node tests/browser/measure-exercise-thumbnails.mjs <off URL> <on URL>
// Uses the real FlatList and a fixed-distance browser scroll on each RAF.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, devices, grantWakeLock, shots } from './env.mjs';
import { thumbnailsData } from './thumbnails-data.mjs';

const [off, on] = process.argv.slice(2);
if (!off || !on) throw new Error('Pass the off and on build URLs');
const browser = await launch();
const OUT = shots('exercise-thumbnails-performance');
const runs = [];
try {
  for (let run = 0; run < 5; run++) for (const enabled of run % 2 ? [true, false] : [false, true]) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, viewport: { width: 375, height: 844 } });
    await ctx.addInitScript(grantWakeLock);
    const data = thumbnailsData('light', 'en', true);
    await ctx.addInitScript(json => localStorage.setItem('increment.data', json), JSON.stringify(data));
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) errors.push(m.text()); });
    await page.goto(`${enabled ? on : off}/exercises`);
    const row = page.locator('[data-testid^="lift-"]').first(); await row.waitFor();
    assert.equal(await page.locator('[data-testid^="exercise-thumbnail-"]').count() > 0, enabled);
    await page.waitForTimeout(500);
    const measured = await row.evaluate(async first => {
      let scroll = first.parentElement;
      while (scroll && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
      if (!scroll) throw new Error('No FlatList scroll container');
      const longTasks = [], frames = [], positions = new Set();
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(e => e.duration)));
      observer.observe({ type: 'longtask' });
      let previous, direction = 1, peakSvg = 0;
      await new Promise(resolve => {
        let n = 0;
        const frame = at => {
          if (previous !== undefined) frames.push(at - previous);
          previous = at;
          if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2) direction = -1;
          if (scroll.scrollTop <= 0) direction = 1;
          scroll.scrollBy(0, direction * 240);
          positions.add(scroll.scrollTop);
          peakSvg = Math.max(peakSvg, document.querySelectorAll('[data-testid^="exercise-thumbnail-"] svg').length);
          if (++n < 180) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      observer.disconnect();
      const sorted = [...frames].sort((a, b) => a - b);
      return { frames: frames.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)],
        maxMs: Math.max(...frames), framesOver25Ms: frames.filter(t => t > 25).length, longTasks: longTasks.length,
        longTaskMs: longTasks.reduce((a, b) => a + b, 0), peakSvg, scrollPositions: positions.size };
    });
    assert.ok(measured.scrollPositions > 100, 'actually scrolled through the list');
    assert.deepEqual(errors, []);
    runs.push({ run: run + 1, enabled, exercises: data.exercises.length, ...measured });
    console.log(JSON.stringify(runs.at(-1)));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ browser: browser.version(), viewport: '375 × 844, DPR 1', method: '5 alternating runs per build; 180 RAF scroll steps of 240px per run; 408 lifts, three SVG drafts and letter fallbacks; no CPU throttle', runs }, null, 2));
} finally { await browser.close(); }
