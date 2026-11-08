// The published website (scripts/web-site.mjs), served the way GitHub Pages
// serves it: only files that exist, /x → /x/ when a folder x exists, 404.html for
// everything else, kept by browsers for 10 minutes. Checks that the app opens,
// that addresses without a file of their own show the right screen, that it can
// be installed (manifest, icons, service worker), opens offline and picks up a
// new deploy, and the privacy pages. Uses the English-only export in app/dist,
// like the published site.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { launch, devices, grantWakeLock, HERE, ROOT, shots } from './env.mjs';
import { buildSite } from '../../scripts/web-site.mjs';
import { CONTACT_EMAIL } from '../../core/links.js';

const OUT = shots('app-web-site');
const SITE = path.join(HERE, '.out', 'site');
const PORT = 8792;
const URL_ = `http://localhost:${PORT}`;
const EXERCISE = '/exercise/x-bench-press-barbell'; // a built-in, so every device has it

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const requests = [];
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, URL_).pathname);
  requests.push(pathname);
  const p = path.join(SITE, pathname);
  let file = null;
  if (!p.startsWith(SITE)) file = null;
  else if (isFile(p)) file = p;
  else if (isDir(p) && !pathname.endsWith('/')) { res.writeHead(301, { Location: `${pathname}/` }); res.end(); return; }
  else if (isDir(p)) file = isFile(path.join(p, 'index.html')) ? path.join(p, 'index.html') : null;
  else if (isFile(`${p}.html`)) file = `${p}.html`;
  const status = file ? 200 : 404;
  file ||= path.join(SITE, '404.html');
  res.writeHead(status, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
  fs.createReadStream(file).pipe(res);
});

let passed = 0;
const ok = (label) => { passed++; console.log('PASS', label); };
const pngSize = (file) => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const site = buildSite({ from: path.join(ROOT, 'app', 'dist'), out: SITE });
await new Promise((resolve) => server.listen(PORT, resolve));
const browser = await launch();

async function open(options = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ...options });
  await ctx.addInitScript(grantWakeLock);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|DevTools|status of 404/i.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
const controlled = (page) => page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
const swVersion = (page) => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('increment-')));

try {
  // ---------- the files ----------
  const manifest = JSON.parse(fs.readFileSync(path.join(SITE, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Increment');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    assert.deepEqual(pngSize(path.join(SITE, icon.src)), icon.sizes.split('x').map(Number), icon.src);
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  assert.deepEqual(pngSize(path.join(SITE, 'icons/apple-touch-icon.png')), [180, 180]);
  for (const page of ['index.html', 'workout/[id].html', '404.html', 'measure/index.html']) {
    const html = fs.readFileSync(path.join(SITE, page), 'utf8');
    assert.match(html, /<link rel="manifest" href="\/manifest.webmanifest"\/>/, page);
    assert.match(html, /serviceWorker\.register\("\/sw\.js"\)/, page);
  }
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  assert.match(sw, new RegExp(`increment-\\$\\{BUILD\\.version\\}`));
  assert.ok(!sw.includes('.routes.json'), 'no hidden files');
  ok(`site: ${site.files} files, the manifest and its icons, every page links them and registers sw.js (version ${site.version})`);

  // ---------- addresses without a file, before the service worker runs ----------
  {
    const { ctx, page, errors } = await open({ serviceWorkers: 'block' });
    const res = await page.goto(URL_ + EXERCISE);
    assert.equal(res.status(), 404, 'GitHub Pages answers with 404.html');
    await page.getByTestId('exercise-title').waitFor();
    assert.match(await page.getByTestId('exercise-title').innerText(), /Bench Press/);
    await page.goto(`${URL_}/measure`);
    assert.equal(new URL(page.url()).pathname, '/measure/');
    await page.getByTestId('body-scroll').waitFor();
    await page.goto(`${URL_}/no-such-page`);
    await page.getByText(/doesn't exist|Unmatched/i).first().waitFor();
    assert.deepEqual(errors, []);
    await ctx.close();
    ok('without the service worker: /exercise/<id> and /measure show their screens, an unknown address the not-found screen');
  }

  // ---------- install, offline, deep links from the cache ----------
  const { ctx, page, errors } = await open();
  await page.goto(URL_);
  await page.getByTestId('start-empty').waitFor();
  await controlled(page);
  assert.deepEqual(await swVersion(page), [`increment-${site.version}`]);
  const cdp = await ctx.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(installabilityErrors, [], 'Chrome can install it');
  const cached = await page.evaluate(async (v) => (await (await caches.open(`increment-${v}`)).keys()).length, site.version);
  assert.equal(cached, site.files - 1, 'the whole build is cached (all but sw.js)');
  ok(`installable, the service worker controls the page and cached ${cached} files`);

  requests.length = 0;
  await page.goto(URL_ + EXERCISE);
  await page.getByTestId('exercise-title').waitFor();
  assert.ok(requests.includes('/exercise/[id].html'), 'the service worker asks for the route\'s own page');
  assert.ok(!requests.includes(EXERCISE), 'not for the address, which has no file');
  ok('with the service worker: /exercise/<id> loads exercise/[id].html, no 404');

  await ctx.setOffline(true);
  requests.length = 0;
  await page.goto(URL_);
  await page.getByTestId('start-empty').waitFor();
  await page.goto(URL_ + EXERCISE);
  await page.getByTestId('exercise-title').waitFor();
  await page.goto(`${URL_}/privacy.html`);
  await page.getByRole('heading', { name: 'Privacy policy' }).waitFor();
  await page.goto(URL_);
  await page.getByTestId('start-empty').waitFor();
  await page.screenshot({ path: `${OUT}/offline-today.png` });
  assert.deepEqual(requests, [], 'nothing reached the server');
  ok('offline: Today, an exercise page and the privacy policy open from the cache');

  // a deploy: new files; online again, the next open shows them and the old cache goes
  await ctx.setOffline(false);
  const index = path.join(SITE, 'index.html');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('</head>', '<meta name="deploy" content="2"/></head>'));
  const swFile = path.join(SITE, 'sw.js');
  fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace(`"version":"${site.version}"`, '"version":"deploy2"'));
  await page.goto(URL_);
  await page.getByTestId('start-empty').waitFor();
  assert.equal(await page.locator('meta[name="deploy"]').count(), 1, 'the page came from the network');
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await page.waitForFunction(async () => (await caches.keys()).join() === 'increment-deploy2', null, { timeout: 30000, polling: 250 });
  ok('after a deploy: the next open shows the new page, the new service worker replaces the old cache');
  assert.deepEqual(errors, []);
  await ctx.close();

  // ---------- the privacy pages ----------
  for (const scheme of ['light', 'dark']) {
    const { ctx: c, page: p, errors: e } = await open({ colorScheme: scheme, serviceWorkers: 'block' });
    for (const [file, heading] of [['privacy.html', 'Privacy policy'], ['datenschutz.html', 'Datenschutzerklärung']]) {
      await p.goto(`${URL_}/${file}`);
      await p.getByRole('heading', { name: heading }).waitFor();
      const contact = p.locator(`a[href="mailto:${CONTACT_EMAIL}"]`);
      assert.equal(await contact.count(), 3, `${file}: the email, three times`);
      assert.equal(await contact.first().innerText(), CONTACT_EMAIL);
      const text = await p.locator('body').innerText();
      assert.doesNotMatch(text, /setlog|\[EMAIL\]/i, file);
      assert.match(text, /increment-training\.app/);
      const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.equal(bg, scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)', `${file}: Tally paper`);
      const width = await p.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(width <= 390, `${file}: no sideways scrolling (${width})`);
      await p.screenshot({ path: `${OUT}/${file.replace('.html', '')}-${scheme}.png`, fullPage: true });
    }
    await p.getByRole('link', { name: 'English' }).click();
    await p.getByRole('heading', { name: 'Privacy policy' }).waitFor();
    assert.deepEqual(e, []);
    await c.close();
  }
  ok('privacy pages: Tally paper in light and dark, the email written in, no Setlog, each links the other language');

  console.log(`\n${passed} checks passed`);
} finally {
  await browser.close();
  server.close();
}
