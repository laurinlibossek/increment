// Short English motion review, light/dark. Run against run.mjs --serve.
// Native touch input moves the browser's real scroll containers.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { APP, devices, grantWakeLock, launch, shots } from './env.mjs';
import { demoData } from './store-demo.mjs';

const OUT = shots('review-tab-pager');
const browser = await launch();
for (const scheme of ['light', 'dark']) {
  const device = devices['iPhone 13'];
  const ctx = await browser.newContext({ ...device, locale: 'en-US', colorScheme: scheme,
    recordVideo: { dir: path.join(OUT, 'raw'), size: device.viewport } });
  await ctx.addInitScript(grantWakeLock);
  await ctx.addInitScript((data) => localStorage.setItem('increment.data', JSON.stringify(data)), demoData('en'));
  const page = await ctx.newPage();
  const video = page.video();
  await page.goto(APP);
  await page.getByTestId('up-next').waitFor();
  // A small recording-only marker makes the moving contact visible. It never
  // takes input or moves the app; all touch listeners are passive.
  await page.evaluate(() => {
    const marker = document.createElement('div');
    marker.style.cssText = 'position:fixed;width:24px;height:24px;border:2px solid #888;border-radius:50%;background:#8885;pointer-events:none;z-index:99999;display:none;transform:translate(-50%,-50%)';
    document.body.append(marker);
    const move = (e) => {
      const t = e.touches[0];
      if (!t) return;
      marker.style.display = 'block'; marker.style.left = `${t.clientX}px`; marker.style.top = `${t.clientY}px`;
    };
    document.addEventListener('touchstart', move, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', () => { marker.style.display = 'none'; }, { passive: true });
  });
  const input = await ctx.newCDPSession(page);
  async function drag(x, y, dx, dy = 0, speed = 280) {
    const steps = Math.max(8, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= steps; i++) {
      await page.waitForTimeout(1000 * Math.max(Math.abs(dx), Math.abs(dy)) / speed / steps);
      await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] });
    }
    await page.waitForTimeout(120);
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(300);
  const b = await page.getByTestId('up-next').boundingBox();
  await drag(295, b.y + 65, -250);
  await page.waitForURL(APP + '/plan');
  await drag(295, 220, -250);
  await page.waitForURL(APP + '/progress');
  await drag(95, 220, 250);
  await page.waitForURL(APP + '/plan');
  await drag(95, 220, 250);
  await page.waitForURL(APP + '/');
  await drag(280, b.y + 65, -185, 0, 110); // half swipe, native snap-back
  await drag(190, 470, 0, -230);
  await drag(295, 220, -250); // scroll, then swipe
  await page.waitForURL(APP + '/plan');
  await page.waitForTimeout(300);
  await ctx.close();
  const webm = path.join(OUT, `${scheme}-pager.webm`);
  await video.saveAs(webm);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, `${scheme}-pager.mp4`)]);
  fs.unlinkSync(webm);
  console.log(`Recorded ${scheme}: card swipe, rows, half swipe, vertical scroll, then swipe`);
}
await browser.close();
