/* RIVL service worker.
   The shell (this app's own files) is cached on install, so the app opens without the network.
   ESPN's feeds go network-first with a short leash: a fresh answer when there is one, the last good copy
   when the network is slow, down, or ESPN is throttling (429/5xx). Logos, headshots and fonts are cached
   on first sight and served from cache after that. */
const VERSION = 'rivl-v120';
const SHELL = `${VERSION}-shell`, DATA = 'rivl-data', MEDIA = 'rivl-media';   // feed copies and media outlive a version: the app reads the feed copies for a warm start
const Q = `?v=${VERSION.replace(/^rivl-v/, '')}`;   // the same stamp index.html puts on its assets
const SHELL_FILES = ['./', './index.html', ...['./app.css', './app.js', './views.js', './screens.js', './config.js', './js/core.js', './js/sim.js', './more.js'].map(f => f + Q), './manifest.webmanifest', './img/mark.svg', './img/badge-96.png', './img/icon-192.png', './img/icon-512.png', './img/apple-touch-icon.png'];
const FEED = /(^|\.)espn\.com$|\.workers\.dev$|(^|\.)wikipedia\.org$|(^|\.)wikidata\.org$/;   // the venue and official lookups answer from the last copy when the network is slow
const MEDIA_HOST = /espncdn\.com$|upload\.wikimedia\.org$|fonts\.gstatic\.com$|fonts\.googleapis\.com$/;   // arena and official photos are kept like any other picture
const DATA_TIMEOUT = 6000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, DATA, MEDIA, 'rivl-meta']);
    for (const k of await caches.keys()) if (!keep.has(k) && k.startsWith('rivl-')) await caches.delete(k);
    await self.clients.claim();
    const cs = await self.clients.matchAll({ type: 'window' }); cs.forEach(c => c.postMessage({ type: 'rivl:updated', version: VERSION }));
    await prune();
  })());
});
/* the feed copies: anything older than three days goes, checked at most twice a day */
async function prune() {
  try {
    const m = await caches.open('rivl-meta'); const last = await m.match('./prune'); const t = last ? +(await last.text()) : 0;
    if (Date.now() - t < 12 * 3600000) return;
    await m.put('./prune', new Response(String(Date.now())));
    const c = await caches.open(DATA); const cutoff = Date.now() - 3 * 86400000;
    for (const req of await c.keys()) { const r = await c.match(req); const at = r ? +(r.headers.get('x-rivl-t') || 0) : 0; if (!at || at < cutoff) await c.delete(req); }
  } catch { }
}
self.addEventListener('message', e => { if (e.data && e.data.type === 'rivl:skip') self.skipWaiting(); });

/* a feed copy carries the time it was fetched (a cross-origin answer's own Date header isn't readable), so the app and the prune can age it */
const stamp = async r => { const b = await r.clone().arrayBuffer(); const h = new Headers(); const ct = r.headers.get('content-type'); if (ct) h.set('content-type', ct); h.set('x-rivl-t', String(Date.now())); return new Response(b, { status: 200, headers: h }); };
const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, err => { clearTimeout(t); rej(err); }); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // the app itself: cache first (files are versioned by their query string), the network fills gaps; navigations fall back to the shell
    if (req.mode === 'navigate') { e.waitUntil(prune()); e.respondWith((async () => { try { const r = await withTimeout(fetch(req), 4000); const c = await caches.open(SHELL); c.put('./index.html', r.clone()); return r; } catch { return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error(); } })()); return; }
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) caches.open(SHELL).then(c => c.put(req, r.clone())); return r; })));
    return;
  }
  if (FEED.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      try {
        const r = await withTimeout(fetch(req), DATA_TIMEOUT);
        if (r.ok) { stamp(r).then(sr => c.put(req, sr)).catch(() => { }); return r; }
        const hit = await c.match(req); if (hit) return hit;   // throttled or broken upstream: the last good copy
        return r;
      } catch {
        const hit = await c.match(req); if (hit) return hit;
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }
  if (MEDIA_HOST.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(MEDIA); const hit = await c.match(req); if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; } catch { return Response.error(); }
    })());
  }
});

/* ---------- push alerts ---------- */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'RIVL', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'RIVL', { body: d.body || '', tag: d.tag || undefined, renotify: !!d.renotify, icon: './img/icon-192.png', badge: './img/badge-96.png', data: { url: d.url || '#home' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL('./' + ((e.notification.data && e.notification.data.url) || '#home'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { if ('navigate' in c) return c.navigate(target).then(w => w && w.focus()); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
