// Which page of the app's web export answers an address. Expo Router writes one
// HTML file per route: / → index.html, /measure → measure.html, /workout/abc →
// workout/[id].html. GitHub Pages only serves files that exist, so the service
// worker (web/sw.js) looks the file up here. scripts/web-site.mjs copies this
// function into the published sw.js; tests/web.test.mjs tests it.

/**
 * The HTML file for `pathname`, or null when no route matches.
 * `pages` lists the export's HTML files relative to its root, e.g. 'workout/[id].html'.
 */
export function pageFor(pages, pathname) {
  // every folder's entries: files by name, folders with a trailing slash
  const entries = new Map();
  for (const page of pages) {
    const parts = page.split('/');
    parts.forEach((part, i) => {
      const dir = parts.slice(0, i).join('/');
      if (!entries.has(dir)) entries.set(dir, new Set());
      entries.get(dir).add(i === parts.length - 1 ? part : `${part}/`);
    });
  }
  let segs;
  try { segs = decodeURIComponent(pathname).split('/').filter(Boolean); } catch { return null; }
  if (segs.some((s) => s === '.' || s === '..')) return null;
  const join = (dir, name) => (dir ? `${dir}/${name}` : name);
  if (!segs.length) return entries.get('')?.has('index.html') ? 'index.html' : null;

  const match = (dir, [seg, ...more]) => {
    const here = entries.get(dir) || new Set();
    if (!more.length) {
      if (seg.endsWith('.html') && here.has(seg)) return join(dir, seg);
      if (here.has(`${seg}.html`)) return join(dir, `${seg}.html`);
      if (entries.get(join(dir, seg))?.has('index.html')) return join(join(dir, seg), 'index.html');
    } else if (here.has(`${seg}/`)) {
      const hit = match(join(dir, seg), more);
      if (hit) return hit;
    }
    for (const name of here) { // a dynamic segment: [id].html or [id]/
      if (!/^\[.+\]/.test(name)) continue;
      if (!more.length && name.endsWith('.html')) return join(dir, name);
      if (more.length && name.endsWith('/')) {
        const hit = match(join(dir, name.slice(0, -1)), more);
        if (hit) return hit;
      }
    }
    return null;
  };
  return match('', segs);
}
