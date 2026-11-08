// The web app's service worker. It keeps a copy of the app on the device, so the
// app opens without a connection (in the gym), and it answers addresses that
// have no file of their own on GitHub Pages: /workout/<id> gets workout/[id].html.
// It never sees the training data, which stays in the browser's storage.
//
// This is a template: scripts/web-site.mjs writes the published sw.js as
//   const BUILD = { version, files, pages };  // this build's files and HTML pages
//   function pageFor(pages, pathname) { … }    // from web/routes.mjs
// followed by this file.
//
// - Install: the whole build goes into its own cache, increment-<version>.
// - Activate: it takes over at once and deletes the caches of older builds.
// - Pages: from the network when it answers within NETWORK_WAIT, so a new
//   version shows the first time the app opens after a deploy; else from the cache.
// - Everything else (scripts, fonts, images) from the cache, else the network.

const CACHE = `increment-${BUILD.version}`;
const NETWORK_WAIT = 3000;
const at = (file) => new URL(file, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // no-cache: GitHub Pages lets browsers keep files for 10 minutes, so a page
    // could still be the previous build's and point at scripts this one lacks
    await cache.addAll(BUILD.files.map((file) => new Request(at(file), { cache: 'no-cache' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('increment-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? page(new URL(request.url)) : file(request));
});

async function file(request) {
  return (await caches.match(request, { cacheName: CACHE, ignoreSearch: true })) || fetch(request);
}

async function page(url) {
  const key = at(pageFor(BUILD.pages, url.pathname) || '+not-found.html');
  const fresh = fetch(key, { cache: 'no-cache' }).then((res) => (res.ok ? res : null), () => null);
  const late = new Promise((resolve) => { setTimeout(resolve, NETWORK_WAIT, null); });
  const res = (await Promise.race([fresh, late]))
    || (await caches.match(key, { cacheName: CACHE }))
    || (await fresh);
  if (!res) return Response.error();
  // a navigation can't be answered with a redirected response
  return res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
}
