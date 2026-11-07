#!/usr/bin/env node
// Runs the browser suites against the app's web build.
//
//   node tests/browser/run.mjs              every suite (builds the web export first)
//   node tests/browser/run.mjs app-logging app-tabs   single suites (file names without .mjs)
//   --no-build    reuse the English-only and German-enabled exports
//   --serve       only build and serve the app and keep it running, e.g. for screenshot
//                 scripts; Ctrl-C stops it
//
// It checks the shipped English-only build, then the existing bilingual suites
// with the same code switch enabled. German's export stays separate from app/dist.
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, ROOT, APP, STRONG } from './env.mjs';

export const APP_SUITES = ['app-english-only', 'app-families', 'app-family-creation', 'app-strong-review', 'app-exercise-catalogue', 'app-first-start', 'app-logging', 'app-editing', 'app-parity', 'app-tabs', 'app-design-bugs', 'app-number-format', 'app-workouts-list', 'app-list-style', 'app-main-actions', 'app-progress-noise', 'app-tally-scale'];
const STRONG_URL = 'https://raw.githubusercontent.com/AlexandrosKyriakakis/StrongAppAnalytics/main/Data/strong.csv';

const args = process.argv.slice(2);
const noBuild = args.includes('--no-build');
const serveOnly = args.includes('--serve');
const picks = args.filter((a) => !a.startsWith('--'));
let suites = [];
for (const p of picks.length ? picks : ['all']) {
  if (p === 'all' || p === 'app') suites.push(...APP_SUITES);
  else {
    const name = path.basename(p).replace(/\.mjs$/, '');
    if (!fs.existsSync(path.join(HERE, `${name}.mjs`))) { console.error(`No suite ${name}.mjs in tests/browser`); process.exit(2); }
    suites.push(name);
  }
}
suites = [...new Set(suites)];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const get = (url) => new Promise((resolve) => {
  http.get(url, (res) => { let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, body })); })
    .on('error', () => resolve(null));
});

// A static file server. `resolve(pathname)` maps a URL path to a file (or null for a 404).
async function serve(port, resolve, notFound = null) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = resolve(pathname);
    let status = 200;
    if (!file && notFound) { file = notFound; status = 404; }
    if (!file) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(status, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(Number(port), ok); });
  return server;
}
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

// Expo Router's static web export: /measure → measure.html, /workout/abc → workout/[id].html.
// (`npx expo serve` redirects /measure to /measure/ once measure/[type] exists, and then 404s.)
function expoRoute(dist, pathname) {
  const exact = path.join(dist, pathname);
  if (!exact.startsWith(dist)) return null;
  if (isFile(exact)) return exact;
  const segs = pathname.split('/').filter(Boolean);
  if (!segs.length) return path.join(dist, 'index.html');
  const match = (dir, rest) => {
    const [seg, ...more] = rest;
    if (!more.length) {
      if (isFile(path.join(dir, `${seg}.html`))) return path.join(dir, `${seg}.html`);
      if (isFile(path.join(dir, seg, 'index.html'))) return path.join(dir, seg, 'index.html');
    } else if (fs.existsSync(path.join(dir, seg))) {
      const hit = match(path.join(dir, seg), more);
      if (hit) return hit;
    }
    for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      if (!/^\[.+\]/.test(entry)) continue; // a dynamic segment: [id].html or [id]/
      if (!more.length && entry.endsWith('.html')) return path.join(dir, entry);
      if (more.length && fs.statSync(path.join(dir, entry)).isDirectory()) {
        const hit = match(path.join(dir, entry), more);
        if (hit) return hit;
      }
    }
    return null;
  };
  return match(dist, segs);
}

function sh(cmd, argv, cwd, env = {}) {
  console.log(`$ (${path.relative(ROOT, cwd) || '.'}) ${Object.entries(env).map(([k, v]) => `${k}=${v} `).join('')}${cmd} ${argv.join(' ')}`);
  const r = spawnSync(cmd, argv, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1', ...env } });
  if (r.status !== 0) throw new Error(`failed: ${cmd} ${argv.join(' ')}`);
}

async function serveApp(german = false) {
  const appDir = path.join(ROOT, 'app');
  const dist = german ? path.join(HERE, '.out/german-app') : path.join(appDir, 'dist');
  if (!fs.existsSync(path.join(appDir, 'node_modules'))) sh('npm', ['ci'], appDir);
  // `npm run bundle` writes the iOS/Android export into the same dist/, so build web unless told not to
  if (!noBuild || !isFile(path.join(dist, 'index.html'))) {
    // German is a build setting (app/src/lib/i18n.ts), so no source file is touched. --clear keeps
    // Metro from reusing the other build's transforms, which have the setting inlined.
    sh('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dist, '--clear'], appDir, { EXPO_PUBLIC_ENABLE_GERMAN: german ? '1' : '0' });
  }
  const port = new URL(APP).port || '8790';
  const already = await get(APP);
  if (already && already.status === 200) {
    if (!serveOnly) throw new Error(`Stop the server at ${APP} before testing both language builds`);
    console.log(`app: already served at ${APP}`); return null;
  }
  const server = await serve(port, (p) => expoRoute(dist, p.replace(/\/+$/, '') || '/'), path.join(dist, '+not-found.html'));
  console.log(`app: serving ${path.relative(ROOT, dist)} at ${APP}${german ? ' (German enabled)' : ''}`);
  return server;
}

async function ensureStrong() {
  if (fs.existsSync(STRONG)) return;
  console.log('data: downloading the sample Strong export (86 workouts)');
  const res = await fetch(STRONG_URL);
  if (!res.ok) throw new Error(`could not download ${STRONG_URL}: ${res.status}`);
  fs.writeFileSync(STRONG, await res.text());
}

function runSuite(name) {
  return new Promise((resolve) => {
    console.log(`\n=== ${name} ===`);
    const child = spawn(process.execPath, [path.join(HERE, `${name}.mjs`)], { cwd: ROOT, env: { ...process.env, APP } });
    let out = '';
    child.stdout.on('data', (c) => { out += c; process.stdout.write(c); });
    child.stderr.on('data', (c) => { out += c; process.stderr.write(c); });
    child.on('close', (code) => {
      const m = out.match(/(\d+) checks passed/);
      resolve({ name, ok: code === 0, checks: m ? Number(m[1]) : (out.match(/^PASS /gm) || []).length });
    });
  });
}

if (serveOnly) {
  await serveApp();
  console.log('Serving until Ctrl-C.');
  await new Promise(() => {});
}
let app = null;
const results = [];
try {
  await ensureStrong();
  // a fresh backup every run: the suites rely on recent dates (backup reminder, body weight)
  results.push(await runSuite('make-backup'));
  if (!results[0].ok) throw new Error('make-backup failed');
  results.length = 0;
  for (const german of [false, true]) {
    const selected = suites.filter((s) => (s !== 'app-english-only') === german);
    if (!selected.length) continue;
    app = await serveApp(german);
    for (const s of selected) results.push(await runSuite(s));
    await new Promise((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
    app = null;
  }
} finally {
  app?.close();
}

console.log('\n--- summary ---');
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.checks ? ` (${r.checks} checks)` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} suites failed` : `\nall ${results.length} suites passed`);
process.exit(failed ? 1 : 0);
