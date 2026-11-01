/* RIVL — the extras that make it feel like an app: the service worker, pull to refresh, haptics, score ticks,
   the app-icon badge and share cards. Loaded last; everything here is optional and fails quietly. */
(() => {
  'use strict';
  const { LEAGUES, ORDER, S, esc, store, isLive, isFav } = HW;
  const V = HW.v5;
  const toast = m => V.toast && V.toast(m);

  /* ---------- service worker: instant opens, last good data when the feed is slow ---------- */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
        /* look for a new version whenever the app is opened or comes back to the front */
        reg.update().catch(() => { }); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { }); });
        reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(); }); });
      }).catch(() => { });
      const had = !!navigator.serviceWorker.controller;   // first install takes control without a reload; a later update reloads once
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || more.reloading) return; more.reloading = true; location.reload(); });
    });
  }
  const more = {};
  function showUpdate() {
    if (document.getElementById('upd')) return;
    const b = document.createElement('button'); b.id = 'upd'; b.className = 'upd'; b.innerHTML = '<b>RIVL updated</b><span>Tap to load the new version</span>';
    b.addEventListener('click', () => { navigator.serviceWorker.getRegistration().then(r => { if (r && r.waiting) r.waiting.postMessage({ type: 'rivl:skip' }); else location.reload(); }); });
    document.body.appendChild(b);
  }

  /* ---------- pull to refresh ---------- */
  const ptr = document.createElement('div'); ptr.className = 'ptr'; ptr.innerHTML = '<i></i>'; document.body.appendChild(ptr);
  let y0 = 0, x0 = 0, pulling = false, armed = false, dir = '';
  const reset = () => { ptr.classList.remove('arm', 'go'); ptr.style.removeProperty('--p'); armed = false; };
  /* at the top means at the top of whatever the finger is scrolling: the window, or a box that scrolls on its own (the game page) */
  let box = null, strip = null;
  const scrollerOf = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.scrollHeight > n.clientHeight + 1) { const oy = getComputedStyle(n).overflowY; if (oy === 'auto' || oy === 'scroll') return n; } } return null; };
  const sideOf = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 1) { const ox = getComputedStyle(n).overflowX; if (ox === 'auto' || ox === 'scroll') return n; } } return null; };
  const atTop = () => window.scrollY <= 0 && (!box || box.scrollTop <= 0);
  /* a pull is a straight drag down from the very top. The first few pixels decide what the finger is doing: a sideways start
     (a strip of tiles, a table) is never a pull, even if the finger then drifts down with the strip still held. */
  window.addEventListener('touchstart', e => { box = scrollerOf(e.target); strip = sideOf(e.target); dir = ''; pulling = atTop() && !document.body.classList.contains('noscroll') && e.touches.length === 1; y0 = pulling ? e.touches[0].clientY : 0; x0 = pulling ? e.touches[0].clientX : 0; }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (!pulling) return; const t = e.touches[0], dy = t.clientY - y0, dx = t.clientX - x0;
    if (!dir) { if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return; dir = Math.abs(dx) > Math.abs(dy) * .8 ? 'x' : 'y'; }
    if (dir === 'x' || dy <= 0 || !atTop() || (strip && strip.scrollLeft > 0 && strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1 && Math.abs(dx) > 6)) { pulling = false; reset(); return; }
    const d = Math.min(Math.max(0, dy - 12), 130); ptr.style.setProperty('--p', (d / 90).toFixed(2)); armed = d > 84; ptr.classList.toggle('arm', armed);
  }, { passive: true });
  window.addEventListener('touchend', async () => { if (!pulling) return; pulling = false; if (!armed) { reset(); return; } ptr.classList.add('go'); buzz(10); try { await V.refreshAll(); } finally { setTimeout(reset, 250); } }, { passive: true });

  /* ---------- haptics: a tick when something is followed or switched ---------- */
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { } };
  document.addEventListener('click', e => { if (e.target.closest('[data-act="follow-player"],[data-act="fav"],[data-act="pref"],[data-act="theme"],[data-act="accent"],.tab,[data-pp="fold"],[data-act="injcol"]')) buzz(8); }, true);

  /* ---------- score ticks: numbers count to the new score instead of snapping ---------- */
  V.tick = (el, to) => {
    const from = parseInt(el.textContent, 10); const target = parseInt(to, 10);
    if (isNaN(from) || isNaN(target) || from === target || Math.abs(target - from) > 30) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 520;
    const step = now => { const k = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = String(Math.round(from + (target - from) * e)); if (k < 1) requestAnimationFrame(step); else el.textContent = to; };
    requestAnimationFrame(step);
  };

  /* ---------- app-icon badge: how many of your teams are playing right now ---------- */
  document.addEventListener('rivl:polled', () => {
    if (!navigator.setAppBadge) return;
    const n = ORDER.reduce((c, k) => c + (S.today[k] || []).filter(g => isLive(g) && isFav(g)).length, 0);
    try { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge && navigator.clearAppBadge(); } catch { }
  });

  /* ---------- logos sized by their artwork, not their file: ESPN's PNGs carry different padding ---------- */
  const fitCache = new Map();
  /* the artwork's box inside a logo file: ESPN's PNGs pad wildly (a shield fills its square, a wordmark sits in a strip),
     so every disc scales and centres the artwork itself, not the file. Needs the CDN's CORS header; without it a disc keeps its default size. */
  function measure(src) {
    if (fitCache.has(src)) return fitCache.get(src);
    const p = new Promise(res => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { try { const S = 72; const c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, S, S); const d = x.getImageData(0, 0, S, S).data; let x0 = S, y0 = S, x1 = -1, y1 = -1; for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) if (d[(y * S + xx) * 4 + 3] > 30) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 < 0) return res(null); res({ w: (x1 - x0 + 1) / S, h: (y1 - y0 + 1) / S, cx: ((x0 + x1 + 1) / 2) / S, cy: ((y0 + y1 + 1) / 2) / S }); } catch { res(null); } };
      im.onerror = () => res(null); im.src = src + (src.includes('?') ? '&' : '?') + 'fit';   // its own URL, so the cache never hands a no-CORS copy to a CORS load
    });
    fitCache.set(src, p); return p;
  }
  const apply = (img, scale, m) => { img.style.setProperty('--fit', scale.toFixed(3)); img.style.setProperty('--fx', (-(m.cx - .5) * 100).toFixed(1) + '%'); img.style.setProperty('--fy', (-(m.cy - .5) * 100).toFixed(1) + '%'); img.classList.add('fit'); };
  async function fitLogos() {
    // the big ones: fill the box
    for (const img of document.querySelectorAll('.ehero .biglogo:not(.fitted), .hero .tm .logo img:not(.fitted)')) { img.classList.add('fitted'); const m = await measure(img.getAttribute('src') || ''); if (!m) continue; apply(img, Math.min(1.45, Math.max(1, Math.min(1 / m.w, 1 / m.h) * 0.94)), m); }
    // the discs: the artwork's longer side lands at 68% of the disc, whatever the file's padding, and sits on the disc's centre
    for (const img of document.querySelectorAll('.logo img:not(.fitted)')) {
      img.classList.add('fitted'); if (img.closest('.onb-team,.thead,.injhd,.pp-team,.hero,.ehero,.gxpage')) continue;
      const m = await measure(img.getAttribute('src') || ''); if (!m) continue;
      const base = parseFloat(getComputedStyle(img).width) / Math.max(1, parseFloat(getComputedStyle(img.parentElement).width)) || .74;
      apply(img, Math.min(1.4, Math.max(.7, (0.68 / base) / Math.max(m.w, m.h))), m);
    }
  }
  document.addEventListener('rivl:rendered', fitLogos); setTimeout(fitLogos, 1200);

  /* ---------- strips fade at the edge that still has more to show ---------- */
  const STRIPS = '.dates,.brief-row,.chips,.rail,.media,.tw,.onb-picked-row,.livebar .lb-in';
  /* the fade on each side grows with the scroll — 0 at the end of travel, full 48px once there is that much behind it —
     so the haze eases in instead of switching on at the first few pixels */
  const FADE = 48;
  const edge = el => {
    const max = el.scrollWidth - el.clientWidth; const more = max > 4;
    const fl = more ? Math.round(Math.min(FADE, Math.max(0, el.scrollLeft))) : 0, fr = more ? Math.round(Math.min(FADE, Math.max(0, max - el.scrollLeft))) : 0;
    const v = fl + '|' + fr; if (el.dataset.edge === v) return; el.dataset.edge = v;
    el.style.setProperty('--fl', fl + 'px'); el.style.setProperty('--fr', fr + 'px'); el.classList.toggle('fades', fl > 0 || fr > 0);
  };
  const edges = () => document.querySelectorAll(STRIPS).forEach(edge);
  V.edges = edges;
  document.addEventListener('scroll', e => { const t = e.target; if (t && t.nodeType === 1 && t.matches && t.matches(STRIPS)) edge(t); }, true);
  document.addEventListener('rivl:rendered', () => { edges(); setTimeout(edges, 300); });
  window.addEventListener('resize', edges);
  new MutationObserver(() => { clearTimeout(edges.t); edges.t = setTimeout(() => { edges(); fitLogos(); }, 60); }).observe(document.getElementById('main'), { childList: true, subtree: true });

  /* ---------- share cards: a picture of the result or the line, not a link ---------- */
  const loadImg = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const mark = (ctx, x, y, h, color) => { // the R mark, scaled from the wordmark path's first glyph
    const p = new Path2D('M0 0H88.8A11.2 11.2 0 0 1 100 11.2V50.5A11.2 11.2 0 0 1 88.8 61.7H62.3L0 25.61ZM0 47.02L100 104.96V123.41H0Z'); ctx.save(); ctx.translate(x, y); ctx.scale(h / 123.41, h / 123.41); ctx.fillStyle = color; ctx.fill(p); ctx.restore();
  };
  const fontsReady = () => (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 120px "Big Shoulders Display"'), document.fonts.load('700 40px "Schibsted Grotesk"'), document.fonts.load('800 40px "Schibsted Grotesk"')]).catch(() => { }) : Promise.resolve());
  const NUM = '"Big Shoulders Display","Arial Narrow",sans-serif', UI = '"Schibsted Grotesk","Helvetica Neue",Arial,sans-serif';
  async function drawGame(card, withImages) {
    const W = 1200, H = 630; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const a = card.away, h = card.home;
    // the diagonal in the two team colours, with the black seam
    x.fillStyle = a.color || '#1d2633'; x.fillRect(0, 0, W, H);
    x.fillStyle = h.color || '#1d2633'; x.beginPath(); x.moveTo(W * .56, 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(W * .44, H); x.closePath(); x.fill();
    x.fillStyle = '#000'; x.beginPath(); x.moveTo(W * .56, 0); x.lineTo(W * .575, 0); x.lineTo(W * .455, H); x.lineTo(W * .44, H); x.closePath(); x.fill();
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const [la, lh] = withImages ? await Promise.all([loadImg(a.logo), loadImg(h.logo)]) : [null, null];
    const logoAt = (im, cx, cy, t) => { if (im) { x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 24; x.shadowOffsetY = 8; x.drawImage(im, cx - 110, cy - 110, 220, 220); x.restore(); } else { x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.arc(cx, cy, 108, 0, Math.PI * 2); x.fill(); x.fillStyle = '#fff'; x.font = `800 84px ${NUM}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t || '', cx, cy + 4); } };
    logoAt(la, 200, 250, a.abbr); logoAt(lh, W - 200, 250, h.abbr);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = `800 44px ${UI}`; x.fillText(a.short, 200, 420); x.fillText(h.short, W - 200, 420);
    x.font = `500 28px ${UI}`; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(a.rec || '', 200, 462); x.fillText(h.rec || '', W - 200, 462);
    x.fillStyle = '#fff'; x.font = `800 210px ${NUM}`; x.textAlign = 'right'; x.fillText(String(a.score ?? ''), W / 2 - 40, 330); x.textAlign = 'left'; x.fillText(String(h.score ?? ''), W / 2 + 40, 330);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(W / 2 - 14, 255, 28, 8);
    rr(x, W / 2 - 110, 70, 220, 54, 12); x.fillStyle = 'rgba(0,0,0,.55)'; x.fill(); x.fillStyle = '#fff'; x.font = `800 26px ${UI}`; x.textAlign = 'center'; x.fillText(card.status || 'Final', W / 2, 106);
    x.font = `600 26px ${UI}`; x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText(card.sub || '', W / 2, 420);
    if (card.note) { x.font = `700 30px ${UI}`; x.fillStyle = '#fff'; x.fillText(card.note, W / 2, 470); }
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, H - 86, W, 86);
    mark(x, 48, H - 68, 48, '#fff'); x.font = `800 30px ${UI}`; x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText('RIVL', 104, H - 32);
    x.font = `600 24px ${UI}`; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText(card.date || '', W - 48, H - 32);
    return c;
  }
  async function drawPlayer(card, withImages) {
    const W = 1200, H = 630; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const col = card.color || '#1d2633';
    x.fillStyle = col; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.38)'; x.beginPath(); x.moveTo(W * .62, 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(W * .5, H); x.closePath(); x.fill();
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.font = `800 520px ${NUM}`; x.textAlign = 'right'; x.textBaseline = 'alphabetic'; x.fillText(card.jersey || '', W - 30, 500);
    const im = withImages ? await loadImg(card.img) : null;
    if (im) { x.save(); x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 30; x.shadowOffsetY = 10; const s = 520; x.drawImage(im, W - s - 60, H - s + 40, s, s); x.restore(); }
    x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,.88)'; x.font = `700 30px ${UI}`; x.fillText(card.sub || '', 64, 110);
    x.fillStyle = '#fff'; x.font = `800 104px ${NUM}`; const nm = (card.name || '').toUpperCase().split(' '); x.fillText(nm[0] || '', 64, 215); x.fillText(nm.slice(1).join(' '), 64, 315);
    const parts = card.line || [];
    let cx = 64; parts.forEach(([v, l]) => { x.fillStyle = '#fff'; x.font = `800 112px ${NUM}`; x.fillText(String(v), cx, 450); const w = x.measureText(String(v)).width; x.fillStyle = 'rgba(255,255,255,.8)'; x.font = `700 28px ${UI}`; x.fillText(l, cx + w + 10, 450); cx += w + x.measureText(l).width + 56; });
    if (card.note) { x.fillStyle = 'rgba(255,255,255,.85)'; x.font = `600 30px ${UI}`; x.fillText(card.note, 64, 505); }
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, H - 86, W, 86);
    mark(x, 48, H - 68, 48, '#fff'); x.font = `800 30px ${UI}`; x.fillStyle = '#fff'; x.fillText('RIVL', 104, H - 32);
    x.font = `600 24px ${UI}`; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText(card.date || '', W - 48, H - 32);
    return c;
  }
  const toBlob = c => new Promise((res, rej) => { try { c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'); } catch (e) { rej(e); } });
  async function shareCard(card) {
    toast('Making your card…');
    await fontsReady();
    const draw = card.kind === 'player' ? drawPlayer : drawGame;
    let blob = null;
    try { blob = await toBlob(await draw(card, true)); } catch { try { blob = await toBlob(await draw(card, false)); } catch { blob = null; } }   // a logo that refuses cross-origin use taints the canvas: draw again without pictures
    if (!blob) { toast("Couldn't make the card"); return; }
    const file = new File([blob], `${(card.file || 'rivl').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.png`, { type: 'image/png' });
    const text = card.text || ''; const url = location.href;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: card.title || 'RIVL', text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Card saved');
    if (navigator.share) navigator.share({ title: card.title || 'RIVL', url }).catch(() => { });
  }
  V.shareCard = shareCard; V._draw = { drawGame, drawPlayer };

  /* alerts were removed: no push, no subscriptions, nothing sent to the worker. A phone that had them on lets go of its
     push subscription once, quietly. */
  V.alerts = { available() { return false; }, on() { return false; } };
  (async () => { try { if (!store.get('v5:alerts', false)) return; store.set('v5:alerts', false); const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) { } })();

  /* ---------- sync: your follows and settings behind a six-character code ---------- */
  const KEYS = ['favs', 'v5:players', 'v5:prefs', 'v5:theme', 'v5:accent', 'v5:alertPrefs', 'v5:injcol'];
  V.sync = {
    available() { return !!WORKER; },
    code() { return store.get('v5:syncCode', ''); },
    data() { const d = {}; KEYS.forEach(k => { const v = store.get(k, null); if (v != null) d[k] = v; }); return d; },
    async up() { const r = await post('/sync', { code: this.code() || undefined, data: this.data() }); if (!r.ok) throw new Error(r.error || 'failed'); store.set('v5:syncCode', r.code); store.set('v5:syncAt', Date.now()); return r.code; },
    async down(code) { code = String(code || '').trim().toUpperCase(); const r = await fetch(`${WORKER}/sync?code=${encodeURIComponent(code)}`).then(x => x.json()); if (!r.ok || !r.data) throw new Error(r.error || 'unknown code'); KEYS.forEach(k => { if (r.data[k] != null) store.set(k, r.data[k]); }); store.set('v5:syncCode', code); store.set('v5:onboarded', true); store.set('v5:syncAt', Date.now()); return true; }
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-act="share"][data-card]'); if (!b) return; e.preventDefault(); e.stopPropagation(); let card = null; try { card = JSON.parse(b.dataset.card); } catch { } if (card) shareCard(card); }, true);

  /* this file defines Alerts and Sync, and it loads after the first screen has already painted: a Settings screen opened
     straight from a link (or from the home-screen app, which reopens where it was) would have drawn itself before either
     existed and said the server was missing. Paint it again now that they do. */
  { const r = V.route && V.route(); if (r && r.name === 'settings' && V.rerender) V.rerender(); }
})();

/* The underline under the chosen game or team tab slides to the new tab instead of hopping. One bar per tab row,
   moved with a transform; if the row is rebuilt, the new bar starts where the old one was so it still slides. */
(() => {
  let last = null, lastKey = '', queued = false;
  const key = () => location.hash.split('/').slice(0, 3).join('/');
  const sync = () => {
    queued = false;
    document.querySelectorAll('.gxtabs').forEach(t => {
      const on = t.querySelector('.chip.on, .chip[aria-pressed="true"]');
      let ind = t.querySelector(':scope > .gxind');
      if (!on) { if (ind) ind.style.opacity = '0'; return; }
      // one rule for every tab line in the app (the leagues too): as wide as the word plus 10px each side, centred under it
      const rg = document.createRange(); rg.selectNodeContents(on); const tw = rg.getBoundingClientRect().width || on.offsetWidth;
      const w = Math.round(tw + 20), x = Math.round(on.offsetLeft + (on.offsetWidth - w) / 2); if (!on.offsetWidth) return;
      if (!ind) {
        ind = document.createElement('i'); ind.className = 'gxind'; ind.setAttribute('aria-hidden', 'true'); t.appendChild(ind);
        const from = lastKey === key() && last ? last : { x, w };
        ind.style.transition = 'none'; ind.style.transform = `translateX(${from.x}px)`; ind.style.width = from.w + 'px';
        void ind.offsetWidth; ind.style.transition = '';
      }
      if (ind.dataset.x !== String(x) || ind.dataset.w !== String(w)) {
        ind.dataset.x = x; ind.dataset.w = w; ind.style.transform = `translateX(${x}px)`; ind.style.width = w + 'px';
      }
      ind.style.opacity = '1'; last = { x, w }; lastKey = key();
    });
  };
  const q = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
  new MutationObserver(q).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
  window.addEventListener('resize', q);
  document.fonts && document.fonts.ready.then(q);
  q();
})();

/* Home lists show five at a time: teams, players, last night's lines, games. "Show all" opens the rest in place and
   "Show fewer" folds them again; the choice is kept for the visit. Works on whatever the list holds, so live updates that
   redraw the rows keep the same cap. */
(() => {
  const SEL = '#main .hsec .gp.frows, #main .hsec .gp.grows, #main .brief-rows';
  const open = (() => { try { return JSON.parse(sessionStorage.getItem('rivl:open') || '{}'); } catch { return {}; } })();
  const keyOf = el => { const h = el.closest('.hsec,.brief'); return (h && (h.dataset.sec || (h.classList.contains('brief') ? 'brief' : ''))) + ':' + [...(h ? h.querySelectorAll(SEL) : [])].indexOf(el); };
  const apply = () => document.querySelectorAll(SEL).forEach(el => {
    const n = [...el.children].filter(c => !c.hidden && !c.classList.contains('capbtn')).length, k = keyOf(el);
    /* on the white cards the button sits inside the card, under the last row; the brief keeps it after its list */
    const inside = el.classList.contains('gp');
    let b = inside ? el.querySelector(':scope > .capbtn') : (el.nextElementSibling && el.nextElementSibling.classList.contains('capbtn') ? el.nextElementSibling : null);
    if (n <= 5) { el.classList.remove('capped', 'capopen'); if (b) b.remove(); return; }
    el.classList.add('capped'); el.classList.toggle('capopen', !!open[k]);
    if (b && inside && b !== el.lastElementChild) el.appendChild(b);
    if (!b) { b = document.createElement('button'); b.className = 'capbtn' + (inside ? ' capin' : ''); if (inside) el.appendChild(b); else el.after(b);
      b.addEventListener('click', () => {
        /* the button stays under your finger: closing the list scrolls the page up by what was removed, so you land on the
           five rows you kept instead of whatever sat further down the page */
        const y0 = b.getBoundingClientRect().top; open[k] = !open[k]; try { sessionStorage.setItem('rivl:open', JSON.stringify(open)); } catch { } apply();
        const d = b.getBoundingClientRect().top - y0; if (d) window.scrollBy(0, d); }); }
    const txt = open[k] ? 'Show fewer' : `Show all ${n}`; if (b.textContent !== txt) b.textContent = txt;
  });
  let q = false; const run = () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; apply(); }); } };
  const m = document.getElementById('main'); if (m) new MutationObserver(run).observe(m, { childList: true, subtree: true });
  run();
})();
