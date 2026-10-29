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
      navigator.serviceWorker.register('sw.js').then(reg => {
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
  let y0 = 0, pulling = false, armed = false;
  const reset = () => { ptr.classList.remove('arm', 'go'); ptr.style.removeProperty('--p'); armed = false; };
  window.addEventListener('touchstart', e => { pulling = window.scrollY <= 0 && !document.body.classList.contains('noscroll') && e.touches.length === 1; y0 = pulling ? e.touches[0].clientY : 0; }, { passive: true });
  window.addEventListener('touchmove', e => { if (!pulling) return; const dy = e.touches[0].clientY - y0; if (dy <= 0 || window.scrollY > 0) { reset(); return; } const d = Math.min(dy, 130); ptr.style.setProperty('--p', (d / 90).toFixed(2)); armed = d > 84; ptr.classList.toggle('arm', armed); }, { passive: true });
  window.addEventListener('touchend', async () => { if (!pulling) return; pulling = false; if (!armed) { reset(); return; } ptr.classList.add('go'); buzz(10); try { await V.refreshAll(); } finally { setTimeout(reset, 250); } }, { passive: true });

  /* ---------- haptics: a tick when something is followed or switched ---------- */
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { } };
  document.addEventListener('click', e => { if (e.target.closest('[data-act="follow-player"],[data-act="fav"],[data-act="pref"],[data-act="theme"],[data-act="accent"],.tab')) buzz(8); }, true);

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
      img.classList.add('fitted'); if (img.closest('.onb-team,.thead,.injhd,.pp-team,.hero,.ehero')) continue;
      const m = await measure(img.getAttribute('src') || ''); if (!m) continue;
      const base = parseFloat(getComputedStyle(img).width) / Math.max(1, parseFloat(getComputedStyle(img.parentElement).width)) || .74;
      apply(img, Math.min(1.4, Math.max(.7, (0.68 / base) / Math.max(m.w, m.h))), m);
    }
  }
  document.addEventListener('rivl:rendered', fitLogos); setTimeout(fitLogos, 1200);

  /* ---------- strips fade at the edge that still has more to show ---------- */
  const STRIPS = '.dates,.brief-row,.chips,.rail,.media,.tw,.onb-picked-row';
  const edge = el => { const more = el.scrollWidth - el.clientWidth > 4; const l = more && el.scrollLeft > 4, r = more && el.scrollLeft < el.scrollWidth - el.clientWidth - 4; const v = l && r ? 'lr' : l ? 'l' : r ? 'r' : ''; if (el.dataset.edge !== v) { if (v) el.dataset.edge = v; else delete el.dataset.edge; } };
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

  /* ---------- alerts: web push through the RIVL worker, for your teams and players ---------- */
  const WORKER = HW.WORKER || ''; const PUSHKEY = HW.PUSH && HW.PUSH.key || '';
  const unb64u = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return Uint8Array.from(atob(str), c => c.charCodeAt(0)); };
  const post = (path, body) => fetch(WORKER + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  V.alerts = {
    available() { return !!WORKER && !!PUSHKEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
    on() { return !!store.get('v5:alerts', false); },
    prefs() { return Object.assign({ pre: true, close: true, final: true, inj: true }, store.get('v5:alertPrefs', {}) || {}); },
    setPref(k, v) { const a = store.get('v5:alertPrefs', {}) || {}; a[k] = !!v; store.set('v5:alertPrefs', a); this.push(); },
    async enable() {
      if (!this.available()) { toast('Alerts need the RIVL server'); return false; }
      const perm = await Notification.requestPermission(); if (perm !== 'granted') { toast('Notifications are off for RIVL in your phone settings'); return false; }
      const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(PUSHKEY) });
      store.set('v5:alerts', true); await this.push(); toast('Alerts on'); return true;
    },
    async disable() { store.set('v5:alerts', false); try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await post('/unsubscribe', { endpoint: sub.endpoint }); } catch { } toast('Alerts off'); },
    async push() {
      if (!this.on() || !this.available()) return;
      try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (!sub) return; const F = HW.favs.all(); const teams = ORDER.flatMap(k => (F[k] || []).map(id => `${k}:${id}`)); const players = V.fplayers.all().map(p => `${p.lk}:${p.id}`); await post('/subscribe', { sub: sub.toJSON(), teams, players, prefs: this.prefs() }); } catch { }
    },
    async test() { try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (!sub) { toast('Turn alerts on first'); return; } const r = await post('/test', { endpoint: sub.endpoint }); toast(r.ok ? 'Sent a test alert' : 'The server could not send it'); } catch { toast("The server didn't answer"); } }
  };
  let pushT = null; const repush = () => { clearTimeout(pushT); pushT = setTimeout(() => V.alerts.push(), 1500); };
  document.addEventListener('rivl:fav', repush); document.addEventListener('rivl:follow', repush);

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
})();
