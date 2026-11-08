// Builds the website https://increment-training.app: the app's web export plus
// what the website adds around it, from web/:
// - /get-started, the page to link people to: what Increment is and how to add
//   it to the home screen (/getstarted forwards to it);
// - the privacy pages, with the contact email from core/links.js written in;
// - the manifest and icons, so the app can be added to the home screen;
// - sw.js, the service worker that keeps the app offline (web/sw.js and
//   web/routes.mjs, with this build's file list);
// - 404.html, for addresses without a file of their own before the service
//   worker runs (the app reads the address and shows the right screen).
//
//   node scripts/web-site.mjs                   exports the app (English only, like the store apps)
//                                               and writes the site to app/web-build
//   node scripts/web-site.mjs --from app/dist   uses an existing web export instead
//   node scripts/web-site.mjs --out <folder>    writes the site somewhere else
//
// CI publishes app/web-build to GitHub Pages after every check on main passed
// (.github/workflows/test.yml, job "deploy").
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTACT_EMAIL } from '../core/links.js';
import { tallyFromTokens, TOKENS_FILE } from './tally-tokens.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const APP = path.join(ROOT, 'app');

/** The files the website adds from web/, as they're published. */
export const SITE_FILES = ['get-started.html', 'getstarted.html', 'privacy.html', 'datenschutz.html', 'manifest.webmanifest',
  'css/tally.css', 'css/page.css', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'icons/favicon-32.png', 'icons/og-image.png'];
/** Pages of the website that belong to the app: they link the manifest and start the service worker too. */
const INSTALL_PAGES = ['get-started.html'];

const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const f = path.join(dir, e.name);
  return e.isDirectory() ? walk(f, base) : [path.relative(base, f).split(path.sep).join('/')];
});

/** What makes a page part of the installable app: manifest, icon, theme colours, the service worker. */
function installHead() {
  const { light, dark } = tallyFromTokens(JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'))).themes;
  return [
    '<link rel="manifest" href="/manifest.webmanifest"/>',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"/>',
    `<meta name="theme-color" content="${light.colors.paper}" media="(prefers-color-scheme: light)"/>`,
    `<meta name="theme-color" content="${dark.colors.paper}" media="(prefers-color-scheme: dark)"/>`,
    '<meta name="apple-mobile-web-app-title" content="Increment"/>',
    // the service worker; and once the app is on the home screen, ask the browser to keep
    // its storage under storage pressure (asked only there: Firefox would show a prompt)
    '<script>if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})});'
      + 'try{if((matchMedia("(display-mode: standalone)").matches||navigator.standalone)&&navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}</script>',
  ].join('');
}

export function buildSite({ from = null, out = path.join(APP, 'web-build') } = {}) {
  if (!/^[^\s@[\]]+@[^\s@[\]]+\.[a-z]{2,}$/i.test(CONTACT_EMAIL)) {
    throw new Error(`CONTACT_EMAIL in core/links.js is "${CONTACT_EMAIL}", not an email address: the privacy pages can't go online without one`);
  }
  fs.rmSync(out, { recursive: true, force: true });
  if (from) {
    if (!fs.existsSync(path.join(from, 'index.html'))) throw new Error(`${from} is not a web export (no index.html)`);
    fs.cpSync(from, out, { recursive: true });
  } else {
    // --clear: Metro mustn't reuse transforms built with German switched on (tests/browser/run.mjs)
    const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out, '--clear'],
      { cwd: APP, stdio: 'inherit', env: { ...process.env, CI: '1', EXPO_PUBLIC_ENABLE_GERMAN: '0' } });
    if (r.status !== 0) throw new Error('expo export failed');
  }
  // hidden files (_expo/.routes.json, for Expo's own server) aren't uploaded to GitHub
  // Pages, and the service worker must not wait for files that aren't there
  for (const f of walk(out).filter((p) => p.split('/').some((seg) => seg.startsWith('.')))) fs.rmSync(path.join(out, f));

  // the app's pages: the head tags, and /measure/ as well as /measure (GitHub Pages
  // sends /measure to /measure/ once a folder measure/ exists)
  const head = installHead() + '<meta name="description" content="A free workout log built around progressive overload. Your training stays on your device."/>';
  for (const page of walk(out).filter((f) => f.endsWith('.html'))) {
    const file = path.join(out, page);
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('</head>')) throw new Error(`${page} has no </head>`);
    fs.writeFileSync(file, html.replace('</head>', `${head}</head>`));
  }
  for (const page of walk(out).filter((f) => f.endsWith('.html') && !f.endsWith('index.html'))) {
    const dir = path.join(out, page.slice(0, -'.html'.length));
    if (fs.existsSync(dir) && !fs.existsSync(path.join(dir, 'index.html'))) fs.copyFileSync(path.join(out, page), path.join(dir, 'index.html'));
  }
  // 404.html answers /workout/<id> and the like: the not-found page (an empty frame), drawn
  // by the app instead of hydrated, since the screen the address asks for isn't in it
  const notFound = fs.readFileSync(path.join(out, '+not-found.html'), 'utf8');
  const hydrate = 'globalThis.__EXPO_ROUTER_HYDRATE__=true;';
  if (!notFound.includes(hydrate)) throw new Error(`+not-found.html no longer sets ${hydrate} (Expo changed its export)`);
  fs.writeFileSync(path.join(out, '404.html'), notFound.replace(hydrate, 'globalThis.__EXPO_ROUTER_HYDRATE__=false;'));

  // the website's own files, the contact email written in. A route of the app with the same
  // name (an app screen called get-started) would be replaced without a word, so that stops the build
  const taken = SITE_FILES.filter((f) => fs.existsSync(path.join(out, f)));
  if (taken.length) throw new Error(`the app's export already has ${taken.join(', ')}: rename the page in web/ or the route`);
  for (const f of SITE_FILES) {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    if (!f.endsWith('.html')) { fs.copyFileSync(path.join(WEB, f), path.join(out, f)); continue; }
    let html = fs.readFileSync(path.join(WEB, f), 'utf8')
      .replace(/<a data-contact><\/a>/g, `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`);
    if (html.includes('data-contact')) throw new Error(`${f}: the contact links are <a data-contact></a>`);
    if (INSTALL_PAGES.includes(f)) html = html.replace('</head>', `${installHead()}</head>`);
    fs.writeFileSync(path.join(out, f), html);
  }

  // the service worker, with this build's files; the version changes when any file does
  const files = walk(out).filter((f) => f !== 'sw.js').sort();
  const odd = files.filter((f) => /[\s#?%\\]/.test(f));
  if (odd.length) throw new Error(`file names the service worker can't address: ${odd.join(', ')}`);
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(`${f}\0`).update(fs.readFileSync(path.join(out, f)));
  const version = hash.digest('hex').slice(0, 12);
  const build = { version, files, pages: files.filter((f) => f.endsWith('.html')) };
  const routes = fs.readFileSync(path.join(WEB, 'routes.mjs'), 'utf8').replace(/^export function /m, 'function ');
  fs.writeFileSync(path.join(out, 'sw.js'), `const BUILD = ${JSON.stringify(build)};\n\n${routes}\n${fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8')}`);
  return { out, version, files: files.length + 1 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? path.resolve(args[i + 1]) : undefined; };
  const site = buildSite({ from: opt('--from'), out: opt('--out') });
  console.log(`website: ${site.files} files in ${path.relative(ROOT, site.out) || '.'}, service worker version ${site.version}`);
}
