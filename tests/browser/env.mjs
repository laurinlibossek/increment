// Shared setup for the browser suites: where things are, which URLs to test,
// and a Chromium that works in a cloud container or on a laptop.
//
// Every suite imports from here. Run them through run.mjs, which builds and
// serves the app and prepares the test data; see README.md in this folder.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
/** The app's web build (app/dist, served by run.mjs). */
export const APP = process.env.APP || 'http://localhost:8790';
/** Downloaded and generated test data (git-ignored). */
export const DATA = path.join(HERE, 'data');
export const BACKUP = path.join(DATA, 'setlog-backup.json');
export const STRONG = path.join(DATA, 'strong.csv');
fs.mkdirSync(DATA, { recursive: true });

/** A folder for a suite's screenshots: tests/browser/.out/<name> (git-ignored). */
export function shots(name) {
  const dir = path.join(process.env.SHOTS || path.join(HERE, '.out'), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Playwright: the local install (npm install in this folder) or a global one
// (cloud containers often ship one outside any node_modules ESM can see).
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch { /* not installed here */ }
  const candidates = [process.env.PLAYWRIGHT_DIR, '/opt/npm-tools/node_modules/playwright'];
  try { candidates.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch { /* no npm */ }
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, 'package.json'))) return createRequire(import.meta.url)(dir);
  }
  throw new Error('Playwright not found. Run `npm install` in tests/browser (then `npx playwright install chromium` if no browser is installed).');
}
const pw = await loadPlaywright();
export const { chromium, devices } = pw;

function chromiumCandidates() {
  const out = [];
  if (process.env.CHROMIUM) out.push(process.env.CHROMIUM);
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(root, d, sub);
        if (fs.existsSync(p)) out.push(p);
      }
    }
  }
  return out;
}

/** Launches Chromium: $CHROMIUM, else Playwright's own, else any installed Playwright Chromium. */
export async function launch(options = {}) {
  if (process.env.CHROMIUM) return chromium.launch({ ...options, executablePath: process.env.CHROMIUM });
  try {
    return await chromium.launch(options);
  } catch (err) {
    for (const executablePath of chromiumCandidates()) {
      try { return await chromium.launch({ ...options, executablePath }); } catch { /* try the next */ }
    }
    throw err;
  }
}

/**
 * Init script for app contexts: headless Chromium denies the Screen Wake Lock
 * (NotAllowedError), and expo-keep-awake then logs "The wake lock with tag workout
 * has not activated yet" when a workout ends. A phone grants the lock, so the
 * suites do too: `await ctx.addInitScript(grantWakeLock)`.
 */
export function grantWakeLock() {
  const lock = () => {
    const l = new EventTarget();
    l.type = 'screen';
    l.released = false;
    l.release = async () => { l.released = true; l.dispatchEvent(new Event('release')); };
    return l;
  };
  try { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => lock() } }); } catch { /* ignore */ }
}

/** Tap the bar and wait for the settled tab before using its mounted content. */
export async function selectTab(page, name) {
  await page.getByTestId(`tab-${name}`).click();
  await page.waitForURL(APP + (name === 'index' ? '/' : `/${name}`));
  await page.getByTestId(`tab-${name}`).and(page.getByRole('tab', { selected: true })).waitFor();
}

/** Open Search from the accessible tab root; inactive web roots stay mounted. */
export async function openSearch(page) {
  await page.getByRole('button').and(page.getByTestId(/^open-search-/)).click();
  await page.getByTestId('exercise-search').waitFor();
}

// ---------- the app's stored data ----------
// The web app keeps its data in IndexedDB ('increment': a record per document
// in `docs`, per kv value in `kv`; app/src/data/storage.web.ts). Suites still
// seed it the old way, `localStorage['increment.data']` in an init script: the
// app moves that in on its first start and ignores it afterwards.

/** In the page: the stored data as { exercises, workouts, templates, measurements, kv }, documents in the order they were written; null before the app made its database. */
async function readStoredInPage() {
  const db = await new Promise((resolve) => {
    const r = indexedDB.open('increment', 1);
    r.onupgradeneeded = () => r.transaction.abort(); // not there yet: don't make it
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  });
  if (!db) return null;
  try {
    const tx = db.transaction(['docs', 'kv'], 'readonly');
    const all = (name) => new Promise((resolve, reject) => {
      const q = tx.objectStore(name).getAll();
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    const [docs, kv] = await Promise.all([all('docs'), all('kv')]);
    const data = { exercises: [], workouts: [], templates: [], measurements: [], kv: {} };
    for (const r of docs.sort((a, b) => a.rev - b.rev)) (data[r.store] ||= []).push(r.data);
    for (const r of kv) data.kv[r.key] = r.value;
    return data;
  } finally { db.close(); }
}

/** The app's stored data (see readStoredInPage). */
export const storedData = (page) => page.evaluate(readStoredInPage);

/** Wait until `test(storedData, arg)` is true (it runs here, in Node). */
export async function waitStored(page, test, arg, timeout = 10000) {
  const until = Date.now() + timeout;
  for (;;) {
    const d = await storedData(page);
    if (d && test(d, arg)) return d;
    if (Date.now() > until) throw new Error(`stored data never matched: ${test}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Replace the stored data behind the app's back (as another app version would); reload the page to see it. */
export const writeStored = (page, data) => page.evaluate(async (data) => {
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('increment', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['docs', 'kv', 'sys', 'log'], 'readwrite');
    const sys = tx.objectStore('sys');
    const s = sys.get('seq');
    s.onsuccess = () => {
      const seq = (s.result?.value || 0) + 1;
      for (const name of ['docs', 'kv', 'log']) tx.objectStore(name).clear();
      for (const store of ['exercises', 'workouts', 'templates', 'measurements']) for (const doc of data[store] || []) tx.objectStore('docs').put({ store, id: doc.id, rev: seq, data: doc });
      for (const [key, value] of Object.entries(data.kv || {})) if (value !== null && value !== undefined) tx.objectStore('kv').put({ key, rev: seq, value });
      sys.put({ key: 'seq', value: seq });
      tx.objectStore('log').put({ seq, keys: null });
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}, data);

/** In the page: IndexedDB's put/delete throw "storage full" while localStorage['test.failWrites'] is '1'. */
function writeGuard() {
  if (window.__writeGuarded) return;
  window.__writeGuarded = true;
  for (const name of ['put', 'add', 'delete', 'clear']) {
    const original = IDBObjectStore.prototype[name];
    IDBObjectStore.prototype[name] = function (...args) {
      if (localStorage.getItem('test.failWrites') === '1') throw new DOMException('Storage is full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  }
}
const guarded = new WeakSet();
/** Make the app's storage refuse every write (true) or take them again (false), at IndexedDB's own put/delete: storage full. Lasts across page loads and holds for every tab of the context. */
export async function failWrites(page, on = true) {
  const ctx = page.context();
  if (!guarded.has(ctx)) { guarded.add(ctx); await ctx.addInitScript(writeGuard); }
  await page.evaluate(writeGuard);
  await page.evaluate((on) => { if (on) localStorage.setItem('test.failWrites', '1'); else localStorage.removeItem('test.failWrites'); }, on);
}
