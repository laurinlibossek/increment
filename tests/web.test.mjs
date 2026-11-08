// The website around the web app (web/, scripts/web-site.mjs): which page answers
// an address, and what the build adds to an export. Plain Node, on a small fake
// export; tests/browser/app-web-site.mjs checks the real one in a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pageFor } from '../web/routes.mjs';
import { buildSite, SITE_FILES } from '../scripts/web-site.mjs';
import { CONTACT_EMAIL } from '../core/links.js';

// the HTML pages of the app's export (Expo Router, one file per route)
const PAGES = ['index.html', '+not-found.html', '_sitemap.html', 'plan.html', 'progress.html', 'search.html',
  '(tabs)/index.html', '(tabs)/plan.html', 'measure.html', 'measure/[type].html', 'measure/index.html',
  'workout/[id].html', 'workout-edit/[id].html', 'exercise/[id].html', 'template/[id].html', 'summary/[id].html',
  'privacy.html', '404.html'];

test('pageFor: the export\'s page for an address', () => {
  const page = (p) => pageFor(PAGES, p);
  assert.equal(page('/'), 'index.html');
  assert.equal(page('/plan'), 'plan.html', 'a root file before the (tabs) group');
  assert.equal(page('/plan/'), 'plan.html');
  assert.equal(page('/measure'), 'measure.html');
  assert.equal(page('/measure/'), 'measure.html');
  assert.equal(page('/measure/weight'), 'measure/[type].html');
  assert.equal(page('/workout/w-123'), 'workout/[id].html');
  assert.equal(page('/workout-edit/w-123'), 'workout-edit/[id].html');
  assert.equal(page('/exercise/x-bench-press-barbell'), 'exercise/[id].html');
  assert.equal(page('/exercise/Bench%20Press'), 'exercise/[id].html', 'escaped ids');
  assert.equal(page('/privacy.html'), 'privacy.html');
  assert.equal(page('/workout'), null, 'no list page');
  assert.equal(page('/workout/a/b'), null);
  assert.equal(page('/nothing'), null);
  assert.equal(page('/../index.html'), null);
  assert.equal(page('/%E0%A4%A'), null, 'a broken escape');
});

function fakeExport() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'increment-export-'));
  const html = (title) => `<!DOCTYPE html><html><head><meta charSet="utf-8"/></head><body><div id="root">${title}</div>`
    + '<script defer="" src="/_expo/static/js/web/entry-abc.js"></script><script id="_R_">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script></body></html>';
  const files = {
    'index.html': html('Today'), '+not-found.html': html(''), 'measure.html': html('Body'), 'measure/[type].html': html('Weight'),
    'workout/[id].html': html('Workout'), '_expo/static/js/web/entry-abc.js': 'console.log(1)', '_expo/.routes.json': '{}',
  };
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}
const swBuild = (out) => JSON.parse(fs.readFileSync(path.join(out, 'sw.js'), 'utf8').match(/^const BUILD = (.*);$/m)[1]);

test('buildSite: the app\'s pages, the website\'s files and the service worker', () => {
  const from = fakeExport();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'increment-site-'));
  try {
    const site = buildSite({ from, out });
    const read = (f) => fs.readFileSync(path.join(out, f), 'utf8');
    for (const f of SITE_FILES) assert.ok(fs.existsSync(path.join(out, f)), f);
    // every page of the app: manifest, icon, theme colours from the tokens, the service worker
    for (const f of ['index.html', 'measure.html', 'workout/[id].html', '404.html']) {
      assert.match(read(f), /<link rel="manifest" href="\/manifest.webmanifest"\/>.*<\/head>/, f);
      assert.match(read(f), /content="#ffffff" media="\(prefers-color-scheme: light\)".*content="#000000" media="\(prefers-color-scheme: dark\)"/, f);
      assert.match(read(f), /navigator\.serviceWorker\.register\("\/sw\.js"\)/, f);
    }
    assert.match(read('measure/index.html'), /Body/, '/measure/ as well as /measure');
    assert.match(read('404.html'), /__EXPO_ROUTER_HYDRATE__=false;/, '404.html draws the screen instead of hydrating');
    assert.match(read('+not-found.html'), /__EXPO_ROUTER_HYDRATE__=true;/);
    assert.ok(!fs.existsSync(path.join(out, '_expo/.routes.json')), 'no hidden files');
    // the contact email, written into the privacy pages
    for (const f of ['privacy.html', 'datenschutz.html']) {
      assert.equal(read(f).split(`<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`).length - 1, 3, f);
      assert.ok(!read(f).includes('data-contact'), f);
    }
    // the service worker: this build's files, its pages, and the routing from web/routes.mjs
    const build = swBuild(out);
    assert.equal(build.version, site.version);
    assert.ok(build.files.includes('_expo/static/js/web/entry-abc.js'));
    assert.ok(build.files.includes('privacy.html') && build.files.includes('icons/icon-512.png'));
    assert.ok(!build.files.includes('sw.js'));
    assert.deepEqual(build.pages, build.files.filter((f) => f.endsWith('.html')));
    assert.match(read('sw.js'), /^function pageFor\(pages, pathname\)/m);
    assert.doesNotMatch(read('sw.js'), /^export /m);
    assert.match(read('sw.js'), /self\.addEventListener\('fetch'/);
    // the same export builds the same version; a changed file a new one
    assert.equal(buildSite({ from, out }).version, site.version);
    fs.appendFileSync(path.join(from, '_expo/static/js/web/entry-abc.js'), '\n');
    assert.notEqual(buildSite({ from, out }).version, site.version);
  } finally {
    fs.rmSync(from, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});
