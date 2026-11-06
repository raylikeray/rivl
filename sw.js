/* RIVL service worker.
   The shell (this app's own files) is cached on install, so the app opens without the network.
   ESPN's feeds go network-first with a short leash: a fresh answer when there is one, the last good copy
   when the network is slow, down, or ESPN is throttling (429/5xx). Logos, headshots and fonts are cached
   on first sight and served from cache after that. */
const VERSION = 'rivl-v426';
const SHELL = `${VERSION}-shell`, DATA = 'rivl-data', MEDIA = 'rivl-media';   // feed copies and media outlive a version: the app reads the feed copies for a warm start
const Q = `?v=${VERSION.replace(/^rivl-v/, '')}`;   // the same stamp index.html puts on its assets
const SHELL_FILES = ['./', './index.html', ...['./app.css', './app.js', './views.js', './screens.js', './config.js', './js/core.js', './js/sim.js', './js/hub.js', './js/rating.js', './js/ask.js', './js/ask2.js', './js/stats.js', './js/recruit.js', './js/bracket.js', './more.js'].map(f => f + Q), './manifest.webmanifest', './img/mark.svg', './img/badge-96.png', './img/icon-192.png', './img/icon-512.png', './img/apple-touch-icon.png'];
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
    // v426: the app's own data files (leaders, recruits, Unrivaled) change through the day: the network first, one saved copy
    // each (not one per half-hour query string), the copy only when the network fails
    if (/\/data\/[^/]+\.json$/.test(url.pathname)) {
      e.respondWith((async () => { const c = await caches.open(DATA); const key = new Request(url.origin + url.pathname);
        try { const r = await withTimeout(fetch(req), 12000); if (r.ok) { stamp(r).then(sr => c.put(key, sr)).catch(() => { }); return r; } const hit = await c.match(key); return hit || r; }
        catch { const hit = await c.match(key); return hit || new Response('', { status: 504, statusText: 'offline' }); } })());
      return;
    }
    // the app itself: cache first (files are versioned by their query string), the network fills gaps; navigations fall back to the shell
    if (req.mode === 'navigate') { e.waitUntil(prune()); e.respondWith((async () => { try { const r = await withTimeout(fetch(req), 4000); const c = await caches.open(SHELL); c.put('./index.html', r.clone()); return r; } catch { return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error(); } })()); return; }
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) caches.open(SHELL).then(c => c.put(req, r.clone())); return r; })));
    return;
  }
  if (FEED.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      try {
        /* v386: a live scoreboard is never swapped for an old copy just because it was slow. College's opening-night board
           is ~180 games and took longer than 6 seconds on a phone, so the old copy (from before tip-off) was served and the
           app showed 6 PM games as not started at 8 PM. Scores and game pages wait up to 20 seconds; the old copy is only
           for a real failure, and it says how old it is. */
        const live = /\/(scoreboard|summary)\b/.test(url.pathname);
        const r = await withTimeout(fetch(req), live ? 20000 : DATA_TIMEOUT);
        if (r.ok) { stamp(r).then(sr => c.put(req, sr)).catch(() => { }); return r; }
        if (live) return r;   // v387: a live score is never answered with an old copy; the app tries ESPN directly and says if it can't
        const hit = await c.match(req); if (hit) return hit;   // throttled or broken upstream: the last good copy
        return r;
      } catch {
        if (live) return new Response('', { status: 504, statusText: 'unreachable' });
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
