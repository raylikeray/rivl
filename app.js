/* RIVL v5 — shell: routing, nav, polling, delegated actions. Views live in v5/views.js, data in js/core.js. */
(() => {
  'use strict';
  const { LEAGUES, ORDER, store, scoreboard, isLive, todayCT, S, esc } = HW;
  const V = HW.v5;
  const $main = document.getElementById('main'), $pills = document.getElementById('pills'), $tabs = document.getElementById('tabs'), $toast = document.getElementById('toast');
  /* Loading never blanks the screen. A view's first paint is a skeleton (marked by views.js); when there is real content
     on screen already, that paint is swallowed: the old screen stays, dims a touch, a slim bar runs under the header, and the
     next real paint swaps it out. The skeleton still shows when there is nothing to keep (first open, after an error). */
  { const proto = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'); let bar = null, barT = null, slowT = null;
    const showBar = () => { if (!bar) { bar = document.createElement('div'); bar.className = 'loadbar'; document.body.appendChild(bar); } clearTimeout(barT); barT = setTimeout(() => { bar.classList.add('on'); $main.setAttribute('aria-busy', 'true'); }, 160); };
    const hideBar = () => { clearTimeout(barT); if (bar) bar.classList.remove('on'); $main.removeAttribute('aria-busy'); };
    /* real content is on screen: the bar goes, the slow note is off, and a new screen lands at its remembered scroll */
    let pendingSkel = '';
    const settle = () => { $main.dataset.real = '1'; pendingSkel = ''; clearTimeout(slowT); const sl = $main.querySelector('.slow'); if (sl) sl.remove(); hideBar(); if ($main.dataset.top === '1') { $main.dataset.top = '0'; const y = +$main.dataset.y || 0; window.scrollTo(0, y); if (y) requestAnimationFrame(() => window.scrollTo(0, y)); } if (render.onReal) { const f = render.onReal; render.onReal = null; f(); } };
    /* a slow load: the skeleton that was swallowed while the old screen was kept is painted after all, so the hold never ends in a blank */
    V.showSkeleton = () => { if (!pendingSkel) return false; const s = pendingSkel; pendingSkel = ''; proto.set.call($main, s); $main.dataset.real = '0'; return true; };
    V.busy = on => on ? showBar() : hideBar();   // for views that patch themselves in place and have no paint to hang the bar on
    V.soft = el => { if (!el || !MOTION()) return; el.classList.remove('soft'); void el.offsetWidth; el.classList.add('soft'); };   // a block repainted in place eases in instead of popping
    V.settled = settle;   // for a view whose first real paint went into a part of the screen (Scores' list, a standings table) rather than the whole
    Object.defineProperty($main, 'innerHTML', {
      get() { return proto.get.call($main); },
      set(v) { const s = String(v); const keep = s.includes('<!--skel-->') && $main.dataset.real === '1'; if (keep) { pendingSkel = s; showBar(); return; } proto.set.call($main, s); clearTimeout(slowT); if (!s.includes('<!--skel-->')) settle(); else { $main.dataset.real = '0'; slowT = setTimeout(() => { if ($main.dataset.real === '0' && !$main.querySelector('.slow')) $main.insertAdjacentHTML('beforeend', '<p class="legend slow">The feed is slow to answer. It usually clears within a minute; pull down to try again.</p>'); }, 7000); } }
    }); }
  S.today = S.today || {}; ORDER.forEach(k => { S.today[k] = S.today[k] || []; });
  HW.alerts = {
    all() { const m = store.get('v5:alerts', {}) || {}; const cut = Date.now() - 2 * 864e5; let ch = false; for (const k in m) if (!m[k] || !(m[k].t > cut)) { delete m[k]; ch = true; } if (ch) store.set('v5:alerts', m); return m; },
    get(id) { const x = this.all()[id]; return x ? x.m : null; },
    set(id, m, t) { const all = this.all(); all[id] = { m, t: new Date(t).getTime() }; store.set('v5:alerts', all); }
  };

  /* ---------- routes ----------
     #home #scores #standings #players #teams          league screens (league from the pills, remembered)
     #player/<lk>/<id> #team/<lk>/<id> #game/<lk>/<id>  entity screens
     #nba #wnba …                                       switch league, stay on the current league screen */
  const SCREENS = ['home', 'scores', 'standings', 'stats', 'players', 'teams'];
  const lkOf = k => LEAGUES[k] ? k : 'nba';
  function route() {
    const h = (location.hash || '#home').slice(1);
    let m;
    if ((m = h.match(/^(player|team|game|article|venue)\/([a-z]+)\/([A-Za-z0-9]+)(?:\/p\/(\d+))?$/))) return { name: m[1], lk: lkOf(m[2]), args: m[4] ? [lkOf(m[2]), m[3], m[4]] : [lkOf(m[2]), m[3]] };   // a game can open on one player: #game/nba/401/p/1966
    if (LEAGUES[h]) { if (store.get('v5:lk') !== h) { store.set('v5:lk', h); if (V.applyAccent) V.applyAccent(); } const nm = store.get('v5:screen', 'home'); if (nm === 'home') store.set('v5:hometab', h); return { name: nm, lk: h, args: [nm === 'home' ? h : h] }; }
    if (h === 'search') return { name: 'search', lk: lkOf(store.get('v5:lk', 'nba')), args: [] };
    let km; if ((km = h.match(/^recruit\/(boys|girls)\/(\d{4})\/([a-z0-9-]+)$/))) return { name: 'recruit', lk: km[1] === 'girls' ? 'ncaaw' : 'ncaam', args: [km[1], km[2], km[3]] };
    let rm; if ((rm = h.match(/^record(?:\/([a-z]+))?$/))) { const k = rm[1] && LEAGUES[rm[1]] ? rm[1] : lkOf(store.get('v5:lk', 'nba')); return { name: 'record', lk: k, args: [k] }; }
    let sm; if ((sm = h.match(/^settings(?:\/([a-z]+))?$/))) return { name: 'settings', lk: lkOf(store.get('v5:lk', 'nba')), args: [sm[1] || ''] };
    const name = SCREENS.includes(h) ? h : 'home';
    const lk = lkOf(store.get('v5:lk', 'nba'));
    if (name === 'home') { const t = store.get('v5:hometab', 'following'); return { name, lk, args: [t === 'following' || LEAGUES[t] ? t : 'following'] }; }   // v423: Home is the Following feed, or one league's
    return { name, lk, args: [lk] };
  }

  /* ---------- nav ---------- */
  function paintPills(lk, show) {
    $pills.hidden = !show;
    if (!show) return;
    // built once; after that only the chosen league and the live counts change, so the knob slides and the labels fade in step
    if ($pills.children.length !== ORDER.length) $pills.innerHTML = ORDER.map(k => `<a class="pill" href="#${k}" data-lk="${k}"><span>${esc(LEAGUES[k].label)}</span></a>`).join('');
    ORDER.forEach((k, i) => { const el = $pills.children[i]; const on = k === lk; el.classList.toggle('on', on); if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); const n = S.today[k].filter(isLive).length; let ct = el.querySelector('.ct'); if (n && !ct) { ct = document.createElement('span'); ct.className = 'ct live'; el.appendChild(ct); } if (ct) { if (!n) ct.remove(); else if (ct.textContent !== String(n)) ct.textContent = n; } });
    $pills.style.setProperty('--n', ORDER.length); $pills.style.setProperty('--i', Math.max(0, ORDER.indexOf(lk)));   // the knob slides to the chosen league
    // the phone's one bar: the league is a small chip; a red dot when anything in it is live
    const chip = document.getElementById('lgchip'); if (chip) { const n = chip.querySelector('.lgn'); if (n.textContent !== LEAGUES[lk].label) n.textContent = LEAGUES[lk].label; chip.querySelector('.lv').hidden = !S.today[lk].some(isLive); }
  }
  /* the league switcher: a small menu that drops from the chip, with what is on today in each league */
  function closeLeagues() {
    const m = document.getElementById('lgmenu'); if (!m) return;
    const chip = document.getElementById('lgchip'); if (chip) chip.setAttribute('aria-expanded', 'false');
    m.classList.add('out'); setTimeout(() => m.remove(), 160);
  }
  function openLeagues() {
    if (document.getElementById('lgmenu')) { closeLeagues(); return; }
    const cur = current ? current.lk : 'nba';
    const line = k => { const g = S.today[k] || []; const live = g.filter(isLive).length; const n = g.length ? `${g.length} game${g.length === 1 ? '' : 's'} today` : 'No games today'; return live ? `<i class="lv"></i>${live} live · ${n}` : n; };
    const chip = document.getElementById('lgchip'); const r = chip.getBoundingClientRect();
    const m = document.createElement('div'); m.id = 'lgmenu'; m.className = 'lgmenu';
    m.innerHTML = `<div class="lgscrim" data-lgx></div><div class="lgm" role="menu" style="top:${Math.round(r.bottom + 8)}px;left:${Math.round(r.left)}px">${ORDER.map(k => `<a class="lgi${k === cur ? ' on' : ''}" role="menuitemradio" aria-checked="${k === cur}" href="#${k}" data-lgx><span><b>${esc(LEAGUES[k].label)}</b><small>${line(k)}</small></span>${k === cur ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</a>`).join('')}</div>`;
    m.addEventListener('click', e => { if (e.target.closest('[data-lgx]')) closeLeagues(); });
    document.body.appendChild(m); chip.setAttribute('aria-expanded', 'true');
    const first = m.querySelector('.lgi.on') || m.querySelector('.lgi'); if (first) first.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLeagues(); });
  window.addEventListener('hashchange', closeLeagues);
  window.addEventListener('scroll', () => { if (document.getElementById('lgmenu')) closeLeagues(); }, { passive: true });
  function paintTabs(name) {
    $tabs.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  }
  /* ---------- v423: X-style tabs across the top of every league screen ----------
     Home: Following, then a tab per league. Scores, Standings, Stats, Players, Teams: a tab per league. The league is
     shared across screens (WNBA on Scores means WNBA on Standings); Home keeps its own tab. Tap or swipe the page. */
  const $lgt = document.getElementById('lgtabs');
  const tabsFor = r => r.name === 'home' ? ['following', ...ORDER] : ORDER;
  const tabNow = r => r.name === 'home' ? r.args[0] : r.lk;
  const tabLabel = k => k === 'following' ? 'Following' : LEAGUES[k].label;
  function inkTo(i, frac = 0) {
    const sc = $lgt.querySelector('.lgsc'); const bs = $lgt.querySelectorAll('.lgt'); const ink = $lgt.querySelector('.lgink'); if (!sc || !bs.length || !ink) return;
    const r0 = sc.getBoundingClientRect();
    const at = j => { const b = bs[Math.max(0, Math.min(bs.length - 1, j))]; const r = b.querySelector('span').getBoundingClientRect(); return { x: r.left - r0.left + sc.scrollLeft, w: r.width }; };
    const a = at(i), b = at(i + Math.sign(frac)); const f = Math.abs(frac);
    ink.style.width = `${a.w + (b.w - a.w) * f}px`; ink.style.transform = `translateX(${a.x + (b.x - a.x) * f}px)`;
  }
  /* v433: X-style row. It is wider than the screen; the active tab slides into view with the one before it peeking */
  function lgScroll(i, smooth = true) {
    const sc = $lgt.querySelector('.lgsc'); const bs = $lgt.querySelectorAll('.lgt'); if (!sc || !bs[i]) return;
    const gut = bs[0].offsetLeft;   // the row's left gutter: tab 0 rests at 0, any other leaves the previous tab peeking
    const x = Math.max(0, Math.min(sc.scrollWidth - sc.clientWidth, bs[i].offsetLeft - gut - (i ? 44 : 0)));
    if (Math.abs(sc.scrollLeft - x) < 2) return;
    try { sc.scrollTo({ left: x, behavior: smooth && !matchMedia('(prefers-reduced-motion:reduce)').matches ? 'smooth' : 'auto' }); } catch (e) { sc.scrollLeft = x; }
  }
  function paintLgTabs(r, show) {
    $lgt.hidden = !show; document.getElementById('htitle').hidden = !(show && r.name === 'home');
    document.getElementById('hdr').classList.toggle('tabhd', !!show);   // v432: where there are league tabs, they are the header (the gear rides at the end)
    if (!show) return;
    const tabs = tabsFor(r), cur = tabNow(r);
    if ($lgt.dataset.set !== tabs.join(',')) {
      $lgt.dataset.set = tabs.join(','); $lgt.dataset.n = tabs.length;
      $lgt.innerHTML = '<div class="lgsc">' + tabs.map(k => `<button class="lgt" role="tab" data-lgt="${k}"><span>${esc(tabLabel(k))}<i class="lgd" hidden></i></span></button>`).join('') + '<i class="lgink" aria-hidden="true"></i></div>'
        + '<a class="lggear" href="#settings" aria-label="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></a>';
      $lgt.classList.add('noanim'); requestAnimationFrame(() => requestAnimationFrame(() => $lgt.classList.remove('noanim')));
    }
    $lgt.querySelectorAll('.lgt').forEach(b => { const k = b.dataset.lgt; const on = k === cur; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
      const d = b.querySelector('.lgd'); const live = k === 'following' ? ORDER.some(x => S.today[x].some(g => isLive(g) && HW.isFav(g))) : S.today[k].some(isLive); d.hidden = !live; });
    const fresh = $lgt.classList.contains('noanim');
    inkTo(tabs.indexOf(cur)); lgScroll(tabs.indexOf(cur), !fresh);
  }
  window.addEventListener('resize', () => { if (current && !$lgt.hidden) { const i = tabsFor(current).indexOf(tabNow(current)); inkTo(i); lgScroll(i, false); } });
  /* choosing a tab: no new history entry (Back never walks through tabs), each tab lands where you left it */
  function goTab(k, dir = 0) {
    if (!current) return; const r = current;
    if (k === tabNow(r)) return;
    if (r.name === 'home') store.set('v5:hometab', k);
    if (LEAGUES[k] && store.get('v5:lk') !== k) { store.set('v5:lk', k); if (V.applyAccent) V.applyAccent(); }
    render.slide = dir; homeKeep = null;
    render();
  }
  $lgt.addEventListener('click', e => {
    const b = e.target.closest('.lgt'); if (!b || !current) return;
    const tabs = tabsFor(current); const k = b.dataset.lgt;
    if (k === tabNow(current)) { window.scrollTo({ top: 0, behavior: MOTION() ? 'smooth' : 'auto' }); return; }
    const d = Math.sign(tabs.indexOf(k) - tabs.indexOf(tabNow(current)));
    if (MOTION()) slideOut(d, () => goTab(k, d)); else goTab(k, 0);
  });
  /* the slide: the page leaves the way the finger went, the next one comes in from the other side */
  function slideOut(d, then, from = 0) {
    const W = window.innerWidth; $main.style.transition = 'transform .16s cubic-bezier(.3,.7,.4,1),opacity .16s';
    $main.style.transform = `translate3d(${-d * W * .35}px,0,0)`; $main.style.opacity = '0';
    const i = tabsFor(current).indexOf(tabNow(current)); inkTo(i + d);
    setTimeout(() => { $main.style.transition = 'none'; then(); }, 150);
  }
  V.slideIn = d => {
    if (!MOTION()) { $main.style.transform = ''; $main.style.opacity = ''; return; }
    const W = window.innerWidth; $main.style.transition = 'none'; $main.style.transform = `translate3d(${d * W * .3}px,0,0)`; $main.style.opacity = '0'; void $main.offsetWidth;
    $main.style.transition = 'transform .26s cubic-bezier(.2,.8,.2,1),opacity .2s'; $main.style.transform = ''; $main.style.opacity = '';
    setTimeout(() => { $main.style.transition = ''; }, 300);
  };
  /* swiping the page sideways turns the tab. Anything that scrolls sideways itself (a wide table, a strip of chips, a
     pager inside the page) keeps the swipe until it reaches its end; a table's frozen first column always turns the page. */
  {
    let t0 = null, mode = '', dx = 0, lastX = 0, lastT = 0, vx = 0;
    const scroller = (el, dir) => {
      if (el.closest('[data-noswipe],input,textarea,select,.dkdeck,.bkov')) return true;
      const room = x => { const max = x.scrollWidth - x.clientWidth; return max > 1 && (dir < 0 ? x.scrollLeft < max - 1 : x.scrollLeft > 1); };
      const pg = el.closest('.pgr'); if (pg && room(pg)) return true;   // a pager inside the page turns its own pages first
      let frozen = false;
      for (let x = el; x && x !== $main && x !== pg; x = x.parentElement) {
        if ((x.tagName === 'TD' || x.tagName === 'TH') && getComputedStyle(x).position === 'sticky') { frozen = true; continue; }   // the frozen column turns the page
        const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowX) && x.scrollWidth > x.clientWidth + 1) { if (frozen) { frozen = false; continue; } if (room(x)) return true; }
      }
      return false; };
    const can = () => current && !$lgt.hidden && !document.querySelector('.sheet.on,#lgmenu,.bkov');
    $main.addEventListener('touchstart', e => { if (!can() || e.touches.length !== 1) { t0 = null; return; } const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY, el: e.target }; mode = ''; dx = 0; lastX = t.clientX; lastT = e.timeStamp; vx = 0; }, { passive: true });
    $main.addEventListener('touchmove', e => {
      if (!t0) return; const t = e.touches[0]; const ddx = t.clientX - t0.x, ddy = t.clientY - t0.y;
      if (!mode) { if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return; if (Math.abs(ddy) >= Math.abs(ddx) * .8) { mode = 'v'; return; } mode = scroller(t0.el, Math.sign(ddx)) ? 'inner' : 'page'; if (mode === 'page') { $main.style.transition = 'none'; } }
      if (mode !== 'page') return;
      e.preventDefault();
      const tabs = tabsFor(current), i = tabs.indexOf(tabNow(current)); const W = window.innerWidth;
      dx = ddx; const edge = (dx > 0 && i === 0) || (dx < 0 && i === tabs.length - 1); const shown = edge ? dx * .25 : dx;
      const dt = Math.max(1, e.timeStamp - lastT); vx = vx * .6 + ((t.clientX - lastX) / dt) * .4; lastX = t.clientX; lastT = e.timeStamp;
      $main.style.transform = `translate3d(${shown}px,0,0)`; $main.style.opacity = String(1 - Math.min(.5, Math.abs(shown) / W * .6));
      if (!edge) inkTo(i, Math.max(-1, Math.min(1, -dx / W)));
    }, { passive: false });
    const end = () => {
      if (!t0) return; const was = mode; t0 = null; mode = ''; if (was !== 'page') return;
      const tabs = tabsFor(current), i = tabs.indexOf(tabNow(current)); const W = window.innerWidth; const d = dx < 0 ? 1 : -1;
      const go = (Math.abs(dx) > W * .35 || (Math.abs(vx) > .25 && Math.sign(vx) === -d)) && tabs[i + d];
      if (go) { $main.style.transition = 'transform .14s ease-out,opacity .14s'; $main.style.transform = `translate3d(${-d * W * .5}px,0,0)`; $main.style.opacity = '0'; inkTo(i + d); setTimeout(() => { $main.style.transition = 'none'; goTab(tabs[i + d], d); }, 130); }
      else { $main.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1),opacity .2s'; $main.style.transform = ''; $main.style.opacity = ''; inkTo(i); setTimeout(() => { $main.style.transition = ''; }, 260); }
    };
    $main.addEventListener('touchend', end, { passive: true }); $main.addEventListener('touchcancel', end, { passive: true });
  }
  /* ---------- v423: the header slides away as you scroll down and comes back the moment you scroll up (X's), tied to
     the finger; at rest it settles fully in or fully out ---------- */
  {
    const hdr = document.getElementById('hdr'); let off = 0, lastY = window.scrollY, idleT = 0;
    const H = () => hdr.offsetHeight;
    const set = (v, anim) => { off = v; hdr.style.transition = anim ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none'; hdr.style.transform = v ? `translate3d(0,${-v}px,0)` : ''; document.documentElement.style.setProperty('--hdro', `${v}px`); };
    V.hdrReset = () => { lastY = window.scrollY; set(0, false); };
    window.addEventListener('scroll', () => {
      const y = window.scrollY; const d = y - lastY; lastY = y;
      if (document.getElementById('top').hidden) return;
      const h = H(); if (!MOTION()) { if (off) set(0, false); return; }
      if (y <= 0) { if (off) set(0, false); return; }
      if (Math.abs(d) > 250) return;   // a jump (a page landing at its remembered place), not a scroll
      const nv = Math.max(0, Math.min(h, off + d)); if (nv !== off) set(nv, false);
      clearTimeout(idleT); idleT = setTimeout(() => { if (off > 0 && off < h) set(off > h / 2 && window.scrollY > h ? h : 0, true); }, 140);
    }, { passive: true });
  }
  /* v424: a story's small square images are team logos, not photos: show them at logo size, never stretched full width */
  document.addEventListener('load', e => {
    const im = e.target; if (!im || im.tagName !== 'IMG' || !im.closest('.reader,.fimg')) return;
    const w = im.naturalWidth, h = im.naturalHeight; if (!w || !h) return; const ar = w / h;
    if (w < 300 || (ar > .8 && ar < 1.25)) { im.classList.add('imsm'); const f = im.closest('.fimg'); if (f) f.classList.add('imsm'); }
  }, true);
  const TITLES = { home: 'Home', scores: 'Scores', standings: 'Standings', players: 'Players', teams: 'Teams', search: 'Search', settings: 'Settings', record: 'Record' };

  /* ---------- render ---------- */
  let seq = 0, current = null;
  /* where each screen was scrolled to, by screen key: going BACK to a screen lands where you were; a tab lands where you left it;
     a link to a player, team, game or story always opens at the top, however far down it you were last time */
  const scrollMem = new Map();
  let navN = 0;   // each history entry is numbered the first time it is shown; an entry numbered below the one we left is a step back
  /* v394: a "Show all" you opened stays open. Each list is keyed by the screen (with the Scores day) and its position
     among the lists on it; whenever lists are drawn again (coming back from a game, a quiet refresh) they reopen before
     the scroll is restored, so you land where you were. */
  const clipOpen = new Set();
  const clipKey = list => { const all = [...$main.querySelectorAll('.lclip')]; const day = current && current.name === 'scores' ? store.get('v5:date', '') : ''; return `${location.hash}|${day}|${all.indexOf(list)}`; };
  const clipMem = (list, open) => { const k = clipKey(list); if (open) clipOpen.add(k); else clipOpen.delete(k); };
  const clipApply = () => { if (!clipOpen.size) return; $main.querySelectorAll('.lclip:not(.open)').forEach(l => { if (!clipOpen.has(clipKey(l))) return; l.classList.add('open'); const b = l.querySelector(':scope > .cliptog') || (l.nextElementSibling && l.nextElementSibling.classList.contains('cliptog') ? l.nextElementSibling : null); if (b) { b.setAttribute('aria-expanded', 'true'); b.textContent = 'Show less'; } }); };
  new MutationObserver(clipApply).observe($main, { childList: true, subtree: true });
  store.set('v5:date', todayCT());   // v397: a fresh open of the app starts Scores on today
  const TABS = ['home', 'scores', 'standings', 'stats', 'search'];
  const tabLast = {};   // v398: where you were last in each tab
  let homeKeep = null;   // Home as you left it
  async function render() {
    const r = route(); const my = ++seq;
    /* v382: leaving Home keeps it as it stood — the feed, Show more opened, the card in the deck, the scroll — so coming back
       lands exactly there, then refreshes quietly in place. Tapping Home while on Home goes to the top (handled below). */
    if (current && current.name === 'home' && r.name !== 'home' && $main.querySelector('.hfeed')) homeKeep = { lk: current.args[0], html: $main.innerHTML.replace(/ data-init="1"/g, ''), y: window.scrollY, at: Date.now(), refresh: V.refresh };
    const wasGame = current && current.name === 'game'; current = r; document.documentElement.dataset.page = r.name; V.refresh = null; closeSheet(); if (wasGame !== (r.name === 'game')) applyTheme();
    if (r.name !== 'scores' && V.todayPill) V.todayPill(false);   // the Scores screen's back-to-today pill goes with it
    const key = `${r.name}/${r.args.join('/')}`;
    const st = history.state; const back = !!(st && st.n != null && st.n < navN);
    if (st && st.n != null) navN = st.n; else { navN += 1; try { history.replaceState({ n: navN }, ''); } catch { } }
    const leagueScreen = SCREENS.includes(r.name);
    if (render.key && render.key !== key) scrollMem.set(render.key, window.scrollY);
    const tabOf = x => x.name === 'home' ? x.args[0] : x.lk;
    const leagueChanged = leagueScreen && render.lk && render.lk !== tabOf(r) && render.screen === r.name;   // a tap on the league switch starts the new league at the top
    $main.dataset.y = render.key !== key ? ((back || leagueScreen) ? String(scrollMem.get(key) || 0) : '0') : '';   // v423: each league tab keeps its own place, like X's
    // a page that starts at the top goes there now, before its skeleton replaces the old screen — otherwise the old scroll
    // position clamps as the document shrinks and the eye sees two moves instead of one
    const fresh = render.key !== key;
    clearTimeout(render.holdT); render.onReal = null;
    const slid = render.slide; render.slide = 0;
    if (fresh && MOTION() && !slid) {
      /* a crossfade, not a blink: a snapshot of the old screen is laid over the page and fades out while the new screen, held
         invisible until its real content has painted, fades in beneath it. If the content takes longer than a beat, the skeleton
         is shown instead so the hold never ends in a blank. */
      if (render.key) ghost();
      $main.classList.remove('fade', 'enter'); $main.classList.add('hold');
      const fadeIn = () => { clearTimeout(render.holdT); $main.classList.remove('hold', 'fade', 'enter'); void $main.offsetWidth; $main.classList.add('fade', 'enter'); document.querySelectorAll('.xghost:not(.out)').forEach(g => { g.classList.add('out'); setTimeout(() => g.remove(), 500); }); };   // the snapshot lets go only now, so the two cross
      render.onReal = fadeIn;
      render.holdT = setTimeout(() => { if (render.onReal === fadeIn && my === seq) { render.onReal = null; V.showSkeleton(); fadeIn(); render.onReal = null; } }, 260);   // v382: the real content replaces the skeleton in place, with no second entrance
    }
    if (leagueChanged) {
      /* A league switch is a new screen, not the old one refreshed: the old league never stays on screen while the new one
         loads (its skeleton paints instead), and a scroll still coasting from a flick is stopped before the jump to the top,
         so iOS cannot carry the page on down or bounce it back after the new league lands. */
      $main.dataset.real = '0';
      const de = document.documentElement; de.style.overflow = 'hidden'; void de.offsetHeight;
      requestAnimationFrame(() => { de.style.overflow = ''; });
    } else if ($main.dataset.y === '0' && fresh) window.scrollTo(0, 0);
    render.lk = tabOf(r); render.screen = r.name;
    if (!['team', 'player', 'game'].includes(r.name) && V._.tint) V._.tint('');   // only a team's, a player's or a game's page wears a team colour
    if (leagueScreen) store.set('v5:screen', r.name);
    /* The Scores date goes back to today when you move to another tab — Home, Standings, Teams, Players — so a day you
       looked at last week is not waiting the next time you open Scores. It does NOT reset when you drill into a game, a
       team or a player from a score card: those are children of the day you were on, and coming back lands on that day. */
    // v397: the Scores day stays put while you move between tabs; it goes back to today only when the app is opened fresh (see boot)
    document.getElementById('top').hidden = !leagueScreen;
    paintPills(r.lk, leagueScreen); paintLgTabs(r, leagueScreen); HW.v5.hdrReset && HW.v5.hdrReset();
    /* the bar lights the tab you are on; Teams, Players and a game, team or player page keep lit the tab you opened
       them from, so drilling in never leaves the bar blank */
    if (TABS.includes(r.name)) render.tab = r.name;
    if (leagueChanged) Object.keys(tabLast).forEach(k => delete tabLast[k]);   // the screens kept belonged to the other league
    const owner = TABS.includes(r.name) ? r.name : (render.tab || (r.name === 'game' ? 'scores' : 'home'));   // v398: a page belongs to the tab it was opened from
    tabLast[owner] = location.hash || '#' + owner;
    paintTabs(owner);
    document.title = r.name === 'home' && r.args[0] === 'following' ? 'Home · RIVL' : leagueScreen ? `${TITLES[r.name]} · ${LEAGUES[r.name === 'home' ? r.args[0] : r.lk].label} · RIVL` : `${TITLES[r.name] || ''} RIVL`.trim();
    const keep = r.name === 'home' && homeKeep && homeKeep.lk === r.args[0] && Date.now() - homeKeep.at < 20 * 60000 ? homeKeep : null; homeKeep = null;
    if (keep) {
      $main.dataset.top = ''; $main.dataset.y = ''; $main.dataset.real = '1';
      $main.innerHTML = keep.html; if (V.initDecks) V.initDecks($main);
      window.scrollTo(0, keep.y); requestAnimationFrame(() => window.scrollTo(0, keep.y));
      V.refresh = keep.refresh; if (render.onReal) render.onReal();
      if (keep.refresh) setTimeout(() => { if (current === r && V.refresh === keep.refresh) keep.refresh(); }, 400);
    } else {
    $main.dataset.top = '1';   // scroll to the top with the new screen's first real paint, not before it
    try { const pr = (V[r.name] || V.home)(...r.args); if (slid && V.slideIn) { V.slideIn(slid); } await pr; }
    catch (err) { $main.style.transform = ''; $main.style.opacity = ''; if (my === seq) $main.innerHTML = `<div class="empty"><b>Something went wrong</b><p style="margin:6px 0 0">${esc(err && err.message || 'Try again in a moment.')}</p></div>`; console.error(err); }
    }
    if (my !== seq) return;
    V.settled();   // a view that painted into part of the screen (Scores' list, a standings chip, a refreshed game) made no full paint to clear the bar, the dimming and the slow note, or to land at its scroll
    paintPills(r.lk, leagueScreen); paintLgTabs(r, leagueScreen);   // live counts may have arrived while the view loaded
    // the rise plays for a new screen; a screen repainting itself (another day on Scores, another conference) keeps still
    if (key !== render.key) { if (!$main.classList.contains('enter')) { void $main.offsetWidth; $main.classList.add('enter'); } } else $main.classList.remove('enter'); render.key = key;
    $main.classList.remove('hold'); clearTimeout(render.holdT); render.onReal = null; document.querySelectorAll('.xghost:not(.out)').forEach(g => { g.classList.add('out'); setTimeout(() => g.remove(), 500); });   // whatever happened, nothing stays held once the view has returned
    document.dispatchEvent(new CustomEvent('rivl:rendered'));
  }
  /* the old screen, as it stood, laid over the page and fading. NOTE the class is `xghost`, never `ghost`:
     `.btn.ghost` is the secondary-button style, and a bare `.ghost` rule captured every one of them (v86 regression —
     they turned position:fixed and pointer-events:none, and this function deleted them). Keep the names apart. — so the next screen appears through it instead of after a gap */
  function ghost() {
    document.querySelectorAll('.xghost').forEach(g => g.remove());
    const r = $main.getBoundingClientRect(); if (!r.width || !r.height) return;
    const g = document.createElement('div'); g.className = 'xghost'; g.setAttribute('aria-hidden', 'true');
    g.style.cssText = `left:${r.left}px;width:${r.width}px`;
    const c = $main.cloneNode(true); c.removeAttribute('id'); c.className = ''; c.style.cssText = `transform:translateY(${r.top}px)`;
    g.appendChild(c); document.body.appendChild(g);
    // v403: a copy starts every sideways strip at its left edge; set each back to where it was (the Home deck showed the
    // last game for a beat before the game page came in)
    { const o = $main.querySelectorAll('*'), k = c.querySelectorAll('*'); for (let i = 0; i < o.length && i < k.length; i++) { const x = o[i].scrollLeft; if (x) { k[i].style.scrollBehavior = 'auto'; k[i].style.scrollSnapType = 'none'; k[i].scrollLeft = x; } } }
    g.addEventListener('animationend', () => g.remove()); setTimeout(() => g.remove(), 1500);   // it fades once the new screen is ready (fadeIn adds .out); never outstays its welcome
  }
  HW.v5.render = render;
  window.addEventListener('hashchange', render);
  /* v398: the tab bar works like the iPhone's. Each tab keeps its own trail.
     · Tap another tab: back to it exactly as you left it (the page you were on inside it, the day, the scroll).
     · Tap the tab you're in: first to its main screen if you're on a page inside it; then to the top; then a reset
       (Home refreshes, Scores goes to today, Search clears). */
  document.getElementById('tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t || !current) return;
    const tab = t.dataset.tab; const cur = TABS.includes(current.name) ? current.name : (render.tab || 'home');
    e.preventDefault();
    if (tab !== cur) {
      const to = tabLast[tab] || '#' + tab; render.tab = tab;
      if (location.hash === to) render(); else location.hash = to;
      return;
    }
    homeKeep = null;
    const lk = current.lk || 'nba';
    // 1 · on a page inside the tab: its main screen
    if (current.name !== tab) { tabLast[tab] = '#' + tab; location.hash = '#' + tab; return; }
    if (tab === 'standings') { const main = store.get('v5:stab0:' + lk, ''); const now = store.get('v5:stab:' + lk, ''); if (main && now && main !== now && document.querySelector('.sthead')) { store.set('v5:stab:' + lk, main); window.scrollTo(0, 0); render(); return; } }
    // 2 · scrolled down: to the top
    if (window.scrollY > 8) { window.scrollTo({ top: 0, behavior: MOTION() ? 'smooth' : 'auto' }); return; }
    // 3 · at the top: the tab's reset
    if (tab === 'home' && V.refresh) { V.refresh(); return; }
    if (tab === 'scores') { const today = todayCT(); if (store.get('v5:date', today) !== today) { store.set('v5:date', today); render(); } return; }
    if (tab === 'search') { const i = document.querySelector('#main .xbox input'); if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); } return; }
  });


  /* ---------- polling: today's slate for every league, faster while something is live ---------- */
  let pollT = null, lastOk = 0;
  async function poll() {
    clearTimeout(pollT); poll.start = Date.now();
    const today = todayCT(); const r = current || route();
    poll.n = (poll.n || 0) + 1;
    const order = [r.lk, ...ORDER.filter(k => k !== r.lk && (poll.n % 4 === 1 || S.today[k].some(isLive)))];   // the other leagues every fourth pass, every pass while one of them has a game on (the live strip shows it)
    let anyLive = ORDER.some(k => k !== r.lk && S.today[k].some(isLive)), failed = false;
    for (const k of order) {
      try {
        const g = await scoreboard(LEAGUES[k], today, k === r.lk ? 20000 : 120000);
        /* a game in play never loses its score: when the feed sends a live game with the score missing (it has done so at
           the half), the last score it gave stands until a new one comes */
        const was = new Map((S.today[k] || []).map(x => [x.id, x]));
        g.forEach(x => { const p = was.get(x.id); if (!p || x.state !== 'in') return; ['home', 'away'].forEach(s => { if (x[s].score == null && p[s].score != null) x[s].score = p[s].score; }); });
        S.today[k] = g; if (g.some(isLive)) anyLive = true;
      }
      catch { failed = true; }
    }
    if (HW.feedStaleSeen && HW.feedStaleSeen >= poll.start) failed = true;   // the scores came from the phone's last copy, not the feed
    if (!failed) { lastOk = Date.now(); HW.feedStaleAt = 0; }
    stale(failed);
    document.dispatchEvent(new CustomEvent('rivl:polled'));
    if (SCREENS.includes((current || route()).name)) paintPills((current || route()).lk, true);
    if (anyLive && current && (current.name === 'home' || current.name === 'scores')) refreshCards();
    if (V.refresh) { try { await V.refresh(); } catch { } }
    pollT = setTimeout(poll, anyLive ? 25000 : V.refresh ? (V.refresh.every || 25000) : 90000);
  }
  /* a quiet line when the feed is unreachable: what's on screen is the last good copy */
  let staleEl = null, staleSince = 0;
  function stale(failed) {
    const off = failed || navigator.onLine === false;
    if (off && !staleSince) staleSince = Math.min(lastOk || Infinity, HW.feedStaleAt || Infinity, Date.now());
    if (!off) staleSince = 0;
    if (!staleEl) { staleEl = document.createElement('div'); staleEl.className = 'stale'; staleEl.hidden = true; document.getElementById('main').before(staleEl); }
    if (!off) { staleEl.hidden = true; return; }
    const m = Math.max(1, Math.round((Date.now() - staleSince) / 60000));
    const at = new Date(staleSince).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HW.TZ });
    staleEl.innerHTML = `<span></span>${navigator.onLine === false ? 'Offline' : "Can't reach the scores feed"} · these scores are from ${m < 60 ? `${m} min ago` : at}`;
    staleEl.hidden = false;
  }
  window.addEventListener('online', () => { stale(false); poll(); }); window.addEventListener('offline', () => stale(true));
  /* swap live scores into the cards on screen without repainting the whole page */
  function refreshCards() {
    const r = current; if (!r) return; const L = LEAGUES[r.lk];
    const byId = new Map(S.today[r.lk].map(g => [g.id, g]));
    $main.querySelectorAll('[data-gid]').forEach(el => {
      const g = byId.get(el.dataset.gid); if (!g) return;
      if (el.classList.contains('srow')) { const h = V._.scoreRow(L, g); const k = /data-k="([^"]*)"/.exec(h); if (k && el.getAttribute('data-k') !== k[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) { el.outerHTML = h; } if (g.state === 'post' && el.classList.contains('on')) render(); return; }
      const scores = el.querySelectorAll('.sc');
      if (el.classList.contains('hero')) { const sc = el.querySelector('.mid .sc'); const st = el.querySelector('.mid .st'); if (sc) { const txt = `${g.away.score ?? ''}–${g.home.score ?? ''}`; if (sc.textContent !== txt) { sc.innerHTML = `${g.away.score ?? ''}<i>–</i>${g.home.score ?? ''}`; sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); } } if (st) st.textContent = g.state === 'in' ? g.detail : g.state === 'post' ? HW.finalWord(g) : st.textContent; return; }
      if (scores.length === 2) {
        [g.away.score, g.home.score].forEach((v, i) => { const t = v == null ? '' : String(v); if (scores[i].textContent !== t) { if (V.tick) V.tick(scores[i], t); else scores[i].textContent = t; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } });
        const sides = el.querySelectorAll('.side'); const has = g.state !== 'pre' && g.away.score != null && g.home.score != null;
        [[g.away, g.home], [g.home, g.away]].forEach(([t, o], i) => { const lead = has && t.score > o.score; sides[i].classList.toggle('lo', has && t.score < o.score); scores[i].classList.toggle('on', lead); scores[i].classList.toggle('won', lead && g.state === 'post'); });
      }
      const live = el.querySelector('.status .live'); if (live && g.state === 'in') live.textContent = g.detail;
      if (g.state === 'post' && el.querySelector('.status .live')) render();   // a game just ended: let the view re-sort it into finals
    });
  }
  /* ---------- the live strip: every game in play right now, on every screen but Home (which has its own live section)
     and the game being read. One element, moved into whichever slot the screen offers (under the pills, or under an entity
     screen's top bar) and patched chip by chip as polls land, so a score ticking over never repaints the screen. ---------- */
  const $live = document.getElementById('livebar');
  function liveList() {
    const r = current || route(); const out = [];
    const onToday = r.name === 'scores' && (store.get('v5:date', todayCT()) || todayCT()) === todayCT();   // Scores on today already lists this league's live games
    [r.lk, ...ORDER.filter(k => k !== r.lk)].forEach(k => {
      if (onToday && k === r.lk) return;
      const L = LEAGUES[k]; const gs = S.today[k].filter(g => isLive(g) && !(r.name === 'game' && r.lk === k && String(r.args[1]) === g.id));
      gs.sort((a, b) => (HW.isFav(b) ? 1 : 0) - (HW.isFav(a) ? 1 : 0)).forEach(g => out.push({ g, L }));
    });
    return out;
  }
  function liveChip(g, L) {
    const tc = t => V._.teamColor(t, L);
    const side = (t, o) => { const lead = t.score != null && o.score != null && t.score > o.score; return `<span class="tm"${!tc(t) || /^#(2A2D33|55606e)$/i.test(tc(t)) ? '' : ` style="${V._.tcv(tc(t), V._.teamAlt(t, L))}"`}>${V._.logo(t.logo || '', 's', tc(t))}<b>${esc(t.abbr)}</b><i class="sc${lead ? ' on' : ''}">${t.score ?? ''}</i></span>`; };
    return `<a class="lg${HW.isFav(g) ? ' fav' : ''}" href="#game/${L.key}/${esc(g.id)}" data-lid="${L.key}:${esc(g.id)}">${side(g.away, g.home)}${side(g.home, g.away)}<span class="st"><span class="dot"></span>${esc(g.detail)}</span></a>`;
  }
  function paintLive() {
    if (!$live) return;
    const r = current || route();
    const show = false && r;   // v383: the live strip is gone for good — live games live on Home's feed, Scores and the game page
    const list = show ? liveList() : [];
    const inner = $live.querySelector('.lb-in');
    if (!list.length) { if (!$live.hidden) { $live.hidden = true; inner.innerHTML = ''; } return; }
    const want = list.map(({ g, L }) => `${L.key}:${g.id}`);
    const have = [...inner.children].map(el => el.dataset.lid);
    if (want.join() !== have.join()) { const x = inner.scrollLeft; inner.innerHTML = list.map(({ g, L }) => liveChip(g, L)).join(''); inner.scrollLeft = x; }   // a game starting or ending rebuilds the strip; where you had scrolled it stays put
    else list.forEach(({ g, L }, i) => {   // same games: touch only the numbers and the clock
      const el = inner.children[i]; const sc = el.querySelectorAll('.sc'); const st = el.querySelector('.st');
      [[g.away, g.home], [g.home, g.away]].forEach(([t, o], j) => { const txt = String(t.score ?? ''); if (sc[j].textContent !== txt) { sc[j].textContent = txt; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } sc[j].classList.toggle('on', t.score != null && o.score != null && t.score > o.score); });
      const d = `${esc(g.detail)}`; if (st.innerHTML !== `<span class="dot"></span>${d}`) st.innerHTML = `<span class="dot"></span>${d}`;
    });
    if ($live.hidden) $live.hidden = false;
    if (V.edges) V.edges();
  }
  /* the strip lives under the pills; an entity screen's top bar offers a slot of its own and the strip moves there */
  function placeLive() {
    if (!$live) return;
    const slot = $main.querySelector('.lb-slot');
    const home = slot || document.getElementById('lbhome');
    if (home && $live.parentNode !== home) home.appendChild($live);
  }
  new MutationObserver(() => { if (!document.contains($live)) placeLive(); else if (!$live.closest('.lb-slot') && $main.querySelector('.lb-slot')) placeLive(); }).observe($main, { childList: true, subtree: true });
  document.addEventListener('rivl:rendered', () => { placeLive(); paintLive(); });
  document.addEventListener('rivl:polled', paintLive);
  V.paintLive = paintLive;
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  /* long-pressing a name or a card is not a link to share: no context menu on the app's own controls */
  document.addEventListener('contextmenu', e => { if (!e.target.closest('.reader .body, input, textarea')) e.preventDefault(); });

  /* ---------- delegated actions ---------- */
  function toast(msg) { $toast.textContent = msg; $toast.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => $toast.classList.remove('on'), Math.min(9000, 1800 + String(msg).length * 55)); }   // a sentence needs longer on screen than a word
  V.toast = toast; V.rerender = () => render(); V.route = () => current;
  V.refreshAll = async () => { try { HW.cache.clear(); } catch { } await render(); poll(); };
  /* ---------- v435: game reminders. A bell on an upcoming game hands the phone's calendar an event with an alert, so
     the phone itself rings at tip-off (or 15 minutes / an hour before) even with RIVL closed. No server, no account. ---------- */
  const ALRT = [[0, 'Tip-off'], [15, '15 min before'], [60, '1 hr before']];
  function icsFor(b, mins) {
    const t = new Date(b.dataset.t); const z = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const x = s => String(s || '').replace(/[\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const L = LEAGUES[b.dataset.lk]; const desc = [L ? L.label : '', b.dataset.tv ? `On ${b.dataset.tv}` : ''].filter(Boolean).join(' · ');
    const title = b.dataset.ttl;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RIVL//Games//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:rivl-${b.dataset.lk}-${b.dataset.gid}@raylikeray.github.io`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(t)}`, `DTEND:${z(new Date(t.getTime() + 150 * 60000))}`,
      `SUMMARY:${x(title)}`, b.dataset.loc ? `LOCATION:${x(b.dataset.loc)}` : '', desc ? `DESCRIPTION:${x(desc)}` : '', `URL:${location.origin}${location.pathname}#game/${b.dataset.lk}/${b.dataset.gid}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${x(mins ? `${title} tips off in ${mins === 60 ? '1 hour' : mins + ' minutes'}` : `${title} is tipping off`)}`, `TRIGGER:-PT${mins}M`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  }
  async function sendIcs(b, mins) {
    const name = `${b.dataset.ttl.replace(/[^\w ]+/g, '').replace(/\s+/g, '-')}.ics`; const body = icsFor(b, mins);
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios) { try { const f = new File([body], name, { type: 'text/calendar' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: b.dataset.ttl }); return true; } } catch (e) { if (e && e.name === 'AbortError') return false; } }
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
    const l = document.createElement('a'); l.href = url; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); return true;
  }
  function bellOpen(b) {
    const row = b.closest('.srow'); if (!row) return;
    const nx = row.nextElementSibling; const was = nx && nx.classList.contains('salrt') && nx.dataset.gid === b.dataset.gid;
    $main.querySelectorAll('.salrt').forEach(x => x.remove()); if (was) return;
    const cur = HW.alerts.get(b.dataset.gid);
    row.insertAdjacentHTML('afterend', `<div class="salrt" data-gid="${esc(b.dataset.gid)}">${ALRT.map(([m, t]) => `<button class="${cur === m ? 'on' : ''}" data-act="bellset" data-m="${m}">${t}</button>`).join('')}</div>`);
  }
  /* v437: the conference finder filters as you type, by conference name or any team in it; a team match says which
     team put the conference on the list, so "Gonzaga" shows the West Coast with Gonzaga named under it */
  document.addEventListener('input', e => {
    const q0 = e.target && e.target.id === 'stconfq' ? e.target.value : null; if (q0 == null) return;
    const q = q0.trim().toLowerCase(); const page = e.target.closest('[data-pg]') || document; let any = false;
    page.querySelectorAll('.stcf').forEach(b => { const hit = !q || b.dataset.q.includes(q); b.hidden = !hit; if (hit) any = true;
      const sub = b.querySelector('.stcfs'); if (!sub) return;
      const names = (b.dataset.names || '').split('|').map(n => n.split('~')); const hitN = q.length > 1 ? names.find(n => n.some(x => x.toLowerCase().includes(q))) : null; const t = hitN ? hitN[0] : null;
      sub.textContent = t && !b.querySelector('b').textContent.toLowerCase().includes(q) ? `${t} plays here` : sub.dataset.base; });
    page.querySelectorAll('.stcg').forEach(g => { g.hidden = !g.querySelector('.stcf:not([hidden])'); });
    if (q) { const seen = new Set(); page.querySelectorAll('.stcf:not([hidden])').forEach(b => { if (seen.has(b.dataset.tab)) b.hidden = true; else seen.add(b.dataset.tab); }); page.querySelectorAll('.stcg').forEach(g => { g.hidden = !g.querySelector('.stcf:not([hidden])'); }); }
    const none = page.querySelector('.stnone'); if (none) none.hidden = any;
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act="bell"]'); if (b) { e.preventDefault(); e.stopPropagation(); bellOpen(b); return; }
    const s = e.target.closest('[data-act="bellset"]'); if (!s) return;
    e.preventDefault(); const box = s.closest('.salrt'); const bell = $main.querySelector(`.sbell[data-gid="${CSS.escape(box.dataset.gid)}"]`); if (!bell) { box.remove(); return; }
    const m = +s.dataset.m; const ok = await sendIcs(bell, m); if (!ok) return;
    HW.alerts.set(bell.dataset.gid, m, bell.dataset.t); box.remove();
    bell.classList.add('on'); bell.setAttribute('aria-label', 'Reminder set'); bell.querySelector('svg').setAttribute('fill', 'currentColor');
    toast(m ? `Added to your calendar · ${ALRT.find(x => x[0] === m)[1]}` : 'Added to your calendar · at tip-off');
  }, true);
  document.addEventListener('click', e => {
    const back = e.target.closest('[data-act="back"]');
    if (back) { if (history.length > 1) { e.preventDefault(); history.back(); } return; }
    /* v413: hopping between the day's games in the game header swaps the page in place rather than stacking a history
       step for each one, so Back returns to wherever the first game was opened from */
    const hop = e.target.closest('#g2strip a.g2gp[href^="#game/"]');
    if (hop && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (location.hash !== hop.getAttribute('href')) location.replace(hop.getAttribute('href')); return; }
    const row = e.target.closest('tr.click[data-href]');
    if (row && !e.target.closest('a')) { location.hash = row.dataset.href; return; }
    const act = e.target.closest('[data-act]'); if (!act) return;
    const a = act.dataset.act;
    if (a === 'follow-player') {
      e.preventDefault();
      let snap = null; try { snap = JSON.parse(act.dataset.snap); } catch { }
      if (!snap) return;
      const on = V.fplayers.toggle(snap);
      act.setAttribute('aria-pressed', String(on)); act.classList.toggle('on', on);
      const star = act.classList.contains('star') ? act : act.querySelector('.star'); if (star && on) { star.classList.add('pop'); setTimeout(() => star.classList.remove('pop'), 450); }   // the star pops as it fills, at the tap
      if (on && navigator.vibrate) { try { navigator.vibrate(8); } catch { } }   // a tick under the thumb on phones that can (Android); iOS ignores it
      if (act.classList.contains('prow')) { const st = act.querySelector('.star'); if (st) { st.classList.toggle('on', on); st.innerHTML = on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`; } }   // a setup row: the row is the button, only its star changes
      else if (act.classList.contains('star')) { act.innerHTML = on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`; act.setAttribute('aria-label', (on ? 'Unfollow ' : 'Follow ') + (snap.name || '')); }
      else act.innerHTML = (on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`) + (on ? 'Following' : 'Follow');
      toast(on ? `Following ${snap.short || snap.name}` : `Unfollowed ${snap.short || snap.name}`);
      $main.dispatchEvent(new CustomEvent('rivl:follow')); $panel.dispatchEvent(new CustomEvent('rivl:follow')); document.dispatchEvent(new CustomEvent('rivl:follow'));
    }
    if (a === 'mix') {
      e.preventDefault();
      const want = act.dataset.mix;
      $main.querySelectorAll('[data-act="mix"]').forEach(b => { const on = b.dataset.mix === want; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-selected', String(on)); });
      $main.querySelectorAll('[data-mix-panel]').forEach(p => { const on = p.dataset.mixPanel === want; if (on && p.hidden) { p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); } p.hidden = !on; });   // the new panel slides in
    }
    if (a === 'share') {
      e.preventDefault();
      const url = location.href, title = act.dataset.title || 'RIVL';
      if (navigator.share) navigator.share({ title, url }).catch(() => { });
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied')).catch(() => toast(url));
    }
    if (a === 'pref') { e.preventDefault(); const on = act.getAttribute('aria-checked') !== 'true'; V.prefs.set(act.dataset.pref, on); act.setAttribute('aria-checked', String(on)); }
    if (a === 'outlook') { e.preventDefault(); act.classList.add('busy'); act.querySelector('.t span').textContent = 'Reading the rest of the schedule…'; const box = act.closest('.outlook'); if (V.outlookFill) V.outlookFill(LEAGUES[box.dataset.lk], box.dataset.id, null, { feed: true }); return; }
    if (a === 'stab-odds') { store.set('v5:stab:' + (current ? current.lk : 'nba'), 'odds'); return; }   // the link itself goes to #standings
    if (a === 'watch') { e.preventDefault(); const id = act.dataset.id; const mine = HW.myServices(); const on = !mine.includes(id); store.set('watch', on ? [...mine, id] : mine.filter(x => x !== id)); act.classList.toggle('on', on); act.setAttribute('aria-pressed', String(on)); if (navigator.vibrate) navigator.vibrate(8); return; }
    if (a === 'theme') { e.preventDefault(); store.set('v5:theme', act.dataset.theme); applyTheme(); $main.querySelectorAll('[data-act="theme"]').forEach(b => { const on = b.dataset.theme === act.dataset.theme; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); }
    if (a === 'onb-restart') { e.preventDefault(); onbLk = 'nba'; onbWelcome(); }   // from the welcome, as a new person sees it; picks are kept
    if (a === 'alerts') { e.preventDefault(); const on = act.getAttribute('aria-checked') !== 'true'; (on ? V.alerts.enable() : V.alerts.disable()).catch(err => { try { store.set('v5:alertsWhy', 'Unexpected: ' + (err && err.message || err)); } catch { } toast('Unexpected: ' + (err && err.message || err)); }).then(() => render()); }
    if (a === 'alert-pref') { e.preventDefault(); const on = act.getAttribute('aria-checked') !== 'true'; V.alerts.setPref(act.dataset.pref, on); act.setAttribute('aria-checked', String(on)); }
    if (a === 'alert-test') { e.preventDefault(); V.alerts.test(); }
    if (a === 'sync-up') { e.preventDefault(); V.sync.up().then(code => { toast(`Backed up as ${code}`); render(); }).catch(() => toast("The server didn't answer")); }
    if (a === 'sync-down') { e.preventDefault(); const inp = document.getElementById('syncCode'); const code = inp && inp.value.trim(); if (!code || code.length !== 6) { toast('Enter the six-character code'); return; } V.sync.down(code).then(() => { toast('Restored'); location.hash = '#home'; location.reload(); }).catch(() => toast('No backup under that code')); }
    if (a === 'accent') { e.preventDefault(); store.set('v5:accent', act.dataset.accent); applyAccent(); $main.querySelectorAll('[data-act="accent"]').forEach(b => { const on = b.dataset.accent === act.dataset.accent; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); }
    if (a === 'fav') {
      e.preventDefault();
      const on = HW.favs.toggle(act.dataset.lk, act.dataset.id);
      act.setAttribute('aria-pressed', String(on)); act.classList.toggle('on', on);
      const star = on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`;
      // a setup tile keeps its logo, name and record; only its check changes. Stars and the hero button redraw.
      if (!act.classList.contains('onb-team')) act.innerHTML = act.classList.contains('star') ? star : star + (on ? 'Following' : 'Follow');
      if (!act.dataset.quiet) toast(on ? `Following ${act.dataset.name || 'team'}` : `Unfollowed ${act.dataset.name || 'team'}`);
      $main.dispatchEvent(new CustomEvent('rivl:fav')); $panel.dispatchEvent(new CustomEvent('rivl:fav')); document.dispatchEvent(new CustomEvent('rivl:fav'));
    }
    if (a === 'expand') { e.preventDefault(); $main.querySelectorAll(`[data-more="${act.dataset.more}"]`).forEach(el => { el.hidden = false; }); act.remove(); }
    if (a === 'clip') { e.preventDefault(); let list = act.parentElement && act.parentElement.classList.contains('lclip') ? act.parentElement : act.previousElementSibling; if (list && !list.classList.contains('lclip')) list = list.querySelector('.lclip'); if (!list) return; const open = !list.classList.contains('open'); const y0 = act.getBoundingClientRect().top;
      list.classList.toggle('open', open); act.setAttribute('aria-expanded', String(open)); clipMem(list, open); const what = act.dataset.what ? ' ' + act.dataset.what : ''; act.textContent = open ? 'Show less' : `Show all ${act.dataset.total}${what}`;
      if (!open) { const y1 = act.getBoundingClientRect().top; if (Math.abs(y1 - y0) > 1) window.scrollBy({ top: y1 - y0, behavior: 'instant' }); }
      return; }
    if (a === 'brkplay') { e.preventDefault(); const V2 = HW.v5; if (HW.bracket && V2._bkF) HW.bracket.play(LEAGUES[current ? current.lk : 'nba'], V2._bkKey || act.dataset.k, V2._bkF); return; }
    if (a === 'brk' || a === 'brkp') { e.preventDefault(); store.set(`v5:${a}:` + (current ? current.lk : 'nba'), act.dataset.k); if (a === 'brk') store.set('v5:brkp:' + (current ? current.lk : 'nba'), 'ff'); render(); return; }
    if (a === 'yt') { e.preventDefault(); const id = String(act.dataset.yt || '').replace(/[^\w-]/g, ''); if (!id) return;   // v437: the video plays in place, YouTube's own player
      const f = document.createElement('iframe'); f.className = 'fytp'; f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.title = act.getAttribute('aria-label') || 'Video';
      act.replaceWith(f); return; }
    if (a === 'pcarm') { e.preventDefault(); const m = act.dataset.m === 'tot' ? 'tot' : 'avg'; store.set('v5:pcarm', m); const w = act.closest('.pcarsec') && act.closest('.pcarsec').nextElementSibling; if (w && w.classList.contains('pcarw')) w.dataset.m = m; act.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === act)); return; }
    if (a === 'stab') { e.preventDefault(); store.set('v5:stab:' + (current ? current.lk : 'nba'), act.dataset.tab); render(); }
    if (a === 'play') { e.preventDefault(); openSheet(act.dataset.vid); }
    if (a === 'injury') { e.preventDefault(); openInjury(act.dataset.key); }
    if (a === 'official') { e.preventDefault(); openOfficial(act.dataset.key); }
    if (a === 'gifold') { e.preventDefault(); V._.foldToggle(act, act.getAttribute('aria-expanded') !== 'true'); return; }
    if (a === 'injcol') { e.preventDefault(); const open = act.getAttribute('aria-expanded') !== 'true'; V._.foldToggle(act, open); const c = store.get('v5:injcol', {}) || {}; if (open) delete c[act.dataset.id]; else c[act.dataset.id] = true; store.set('v5:injcol', c); }
    // a conference bar in setup: fold it, and remember which ones this device leaves open
    if (a === 'onbsec') { e.preventDefault(); const open = act.getAttribute('aria-expanded') !== 'true'; V._.foldToggle(act, open); const s = store.get('v5:onbsec', {}) || {}; s[act.dataset.sec] = open ? 1 : 0; store.set('v5:onbsec', s); return; }
    if (a === 'reload') { e.preventDefault(); render(); }
    if (a === 'onb-next') { e.preventDefault(); onbStep(+act.dataset.step); }
    if (a === 'onb-welcome') { e.preventDefault(); onbWelcome(); }
    if (a === 'onb-lk') { e.preventDefault(); onbLk = act.dataset.lk; onbStep(+(act.dataset.step || 0)); }
    if (a === 'onb-done') { e.preventDefault(); store.set('v5:onboarded', true); store.set('v5:lk', 'nba'); store.set('v5:screen', 'home'); closePanel(); if (location.hash !== '#home') location.hash = '#home'; else render(); }
    if (a === 'install') { e.preventDefault(); install(); }
    if (a === 'install-later') { e.preventDefault(); store.set('v5:installDismissed', Date.now()); const b = document.getElementById('installBar'); if (b) b.remove(); }
    /* +N opens the rest of the breaking items in place; the button becomes Less */
    if (a === 'wire-more') { e.preventDefault(); const w = act.closest('.wire2'); const on = !w.classList.contains('open'); w.classList.toggle('open', on); act.setAttribute('aria-expanded', String(on)); act.textContent = on ? 'Less' : '+' + w.querySelectorAll('.w2it').length; return; }
    if (a === 'wire-x') { e.preventDefault(); const ids = (act.dataset.ids || '').split(',').filter(Boolean); const seen = store.get('v5:wire:seen', []) || []; store.set('v5:wire:seen', [...new Set([...ids, ...seen])].slice(0, 80)); const post = act.closest('.fbrk'); if (post) { post.style.transition = 'opacity .2s'; post.style.opacity = '0'; setTimeout(() => post.remove(), 200); } else { const sec = act.closest('section'); if (sec) sec.remove(); } return; }
    if (a === 'scmode') { e.preventDefault(); store.set('v5:scunr', act.dataset.mode === 'unrivaled'); if (current && current.name === 'scores') render(); else location.hash = '#scores'; return; }
    if (a === 'scmine') { e.preventDefault(); store.set('v5:scmine', !store.get('v5:scmine', false)); render(); return; }
    if (a === 'lgsheet') { e.preventDefault(); openLeagues(); return; }
    if (a === 'panel-close') { e.preventDefault(); closePanel(); const to = act.getAttribute('href'); if (to && to.startsWith('#')) location.hash = to; }
    if (a === 'date') { e.preventDefault(); store.set('v5:date', act.dataset.ymd); closePanel(); if (current && current.name === 'scores') render(); else location.hash = '#scores'; }
    if (a === 'calendar') { e.preventDefault(); openCalendar(act.dataset.ymd || store.get('v5:date', todayCT())); }
    if (a === 'cal-nav') { e.preventDefault(); openCalendar(act.dataset.ym + '-01', true); }
  });

  /* ---------- video sheet: ESPN's own clip files, played here; the ESPN page is the fallback ---------- */
  const $sheet = document.getElementById('sheet');
  /* an overlay opens by sliding up under a backdrop that fades in, and closes the same way in reverse — the hidden flag only flips
     once the exit has played, so nothing pops */
  const MOTION = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = el => { el.classList.remove('out'); el.hidden = false; void el.offsetWidth; el.classList.add('in'); };
  const hide = (el, after) => { if (el.hidden) return; if (!MOTION()) { el.hidden = true; el.classList.remove('in', 'out'); if (after) after(); return; } el.classList.remove('in'); el.classList.add('out'); const done = () => { el.removeEventListener('animationend', done); el.hidden = true; el.classList.remove('out'); if (after) after(); }; el.addEventListener('animationend', done); setTimeout(done, 320); };
  function closeSheet() { if (!$sheet || $sheet.hidden) return; const v = $sheet.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.innerHTML = ''; v.load(); } hide($sheet); document.body.classList.remove('noscroll'); }
  function openSheet(vid) {
    const v = S.videos && S.videos[vid]; if (!v) { toast('That clip is not available'); return; }
    const L = v.links || {}; const src = L.source || {}; const web = L.web && L.web.href || (L.mobile && L.mobile.href) || '';
    const files = [];
    if (src.HLS && src.HLS.href) files.push([src.HLS.href, 'application/vnd.apple.mpegurl']);
    ['mezzanine', 'full', 'hds'].forEach(k => { if (src[k] && src[k].href && /\.mp4/i.test(src[k].href)) files.push([src[k].href, 'video/mp4']); });
    if (src.href && /\.mp4/i.test(src.href)) files.push([src.href, 'video/mp4']);
    if (L.mobile && L.mobile.source && L.mobile.source.href) files.push([L.mobile.source.href, 'video/mp4']);
    const seen = new Set(); const uniq = files.filter(([u]) => !seen.has(u) && seen.add(u));
    $sheet.querySelector('h3').textContent = v.headline || v.title || '';
    $sheet.querySelector('p').textContent = v.description || '';
    const out = $sheet.querySelector('#sheetOut'); out.href = web || '#'; out.hidden = !web;
    const fb = $sheet.querySelector('.fallback'); fb.hidden = true;
    const el = $sheet.querySelector('video'); el.innerHTML = uniq.map(([u, ty]) => `<source src="${esc(u)}" type="${ty}">`).join('');
    el.poster = v.thumbnail || (v.posterImages && v.posterImages.default && v.posterImages.default.href) || '';
    el.onerror = null; const lastSrc = el.querySelector('source:last-child'); if (lastSrc) lastSrc.addEventListener('error', () => { fb.hidden = false; }, { once: true });
    if (!uniq.length) fb.hidden = false;
    show($sheet); document.body.classList.add('noscroll'); el.load(); const p = el.play(); if (p && p.catch) p.catch(() => { });
  }
  $sheet.addEventListener('click', e => { if (e.target === $sheet || e.target.closest('[data-act="close"]')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  /* ---------- panel: a sheet for anything that isn't a video (injury notes, first-run setup) ---------- */
  const $panel = document.getElementById('panel');
  function openPanel(html, { full = false } = {}) { $panel.querySelector('.panel-in').innerHTML = html; $panel.classList.toggle('full', full); if ($panel.hidden) show($panel); document.body.classList.add('noscroll'); $panel.querySelector('.panel-in').scrollTop = 0; }
  function closePanel() { if ($panel.hidden) return; hide($panel, () => $panel.classList.remove('full')); document.body.classList.remove('noscroll'); }
  $panel.addEventListener('click', e => { if (e.target === $panel && !$panel.classList.contains('full')) closePanel(); });

  /* the month at a glance: games each day, a mark on the days your teams play; tap a day to go there */
  async function openCalendar(ymd, keep = false) {
    const lk = current ? current.lk : 'nba'; const L = LEAGUES[lk]; const today = todayCT(); const sel = store.get('v5:date', today);
    const ym = ymd.slice(0, 7); const [y, m] = ym.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); const lead = first.getUTCDay();
    const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`, next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
    const title = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const grid = (days, counted) => Array.from({ length: lead }, () => '<span class="cd pad"></span>').concat(Array.from({ length: last }, (_, i) => { const d = `${ym}-${String(i + 1).padStart(2, '0')}`; const info = days && days[d]; const has = !!(info && (info.has || info.n)); const cls = ['cd', d === today ? 'today' : '', d === sel ? 'on' : '', days && !has ? 'off' : '', info && info.mine ? 'mine' : ''].filter(Boolean).join(' '); return `<button class="${cls}" data-act="date" data-ymd="${d}"${days && !has ? ' disabled' : ''}><b>${i + 1}</b><span>${days ? (has ? `${info.mine ? '<i></i>' : ''}${counted && info.n ? info.n : (info.mine ? '' : '<u></u>')}` : '') : '·'}</span></button>`; })).join('');
    const page = (days, note, counted) => `<button class="ib close" data-act="panel-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="cal-h"><button class="ib" data-act="cal-nav" data-ym="${prev}" aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button><h3>${esc(title)}<small>${esc(L.label)}</small></h3><button class="ib" data-act="cal-nav" data-ym="${next}" aria-label="Next month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button></div>
      <div class="cal-w">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-g">${grid(days, counted)}</div>
      <p class="cal-f"><i class="dot"></i> your teams play${counted ? ' · numbers are games that day' : ' · <u></u> games that day'}${note ? ` · ${esc(note)}` : ''}</p>${sel !== today ? `<button class="btn cal-today" data-act="date" data-ymd="${today}">Back to today</button>` : ''}`;
    const html = (days, note, counted = true) => page(days, note, counted);
    if (!keep || $panel.hidden) openPanel(html(null, 'loading'), {}); else $panel.querySelector('.panel-in').innerHTML = html(null, 'loading');
    const r = await V.monthGames(L, ym).catch(() => null);
    if ($panel.hidden || !$panel.querySelector('.cal-g')) return;
    $panel.querySelector('.panel-in').innerHTML = html(r ? r.days : {}, r ? (r.truncated ? 'counts are partial on the busiest days' : '') : "the feed didn't answer", !!(r && r.counted));
  }

  /* an official: the feed names the crew and each one's role, and that is what is shown — no photo or record exists in it */
  async function openOfficial(key) {
    const rec = S.officials && S.officials[key]; if (!rec) return;
    const { o, crew, g, lk } = rec; const name = o.fullName || o.displayName || ''; const role = o.position && (o.position.displayName || o.position.name) || 'Official';
    const when = g.date ? new Date(g.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HW.TZ }) : '';
    const others = crew.filter(x => x !== o);
    openPanel(`<button class="ib close" data-act="panel-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="inj-head" id="offHead"><span class="hs noimg plain" style="width:64px;height:64px;font-size:22px"><i>${esc(V._.initials(name))}</i></span><div><h3>${esc(name)}</h3><p>${esc(role)}</p></div></div>
      <table class="tbl kv"><tbody><tr><td>Role</td><td>${esc(role)}</td></tr><tr><td>This game</td><td>${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}${when ? `<span class="mut"> · ${esc(when)}</span>` : ''}</td></tr>${others.length ? `<tr><td>Crew</td><td>${others.map(x => `${esc(x.fullName || x.displayName)}${x.position && (x.position.displayName || x.position.name) ? ` <span class="mut">${esc(x.position.displayName || x.position.name)}</span>` : ''}`).join('<br>')}</td></tr>` : ''}</tbody></table>
      <div id="offWiki"></div>
      <div style="display:flex;gap:8px;margin-top:14px"><a class="btn" href="#game/${lk}/${esc(String(g.id))}" data-act="panel-close">Back to the game</a></div>`);
    /* the leagues publish officials' names and nothing else, so anything more has to come from an article plainly about this
       official. Most have none — then the panel simply stays as it is rather than showing a guess. */
    const sport = LEAGUES[lk] && /ncaa/.test(lk) ? 'college basketball referee' : 'basketball referee NBA WNBA';
    const pg = await HW.wikiPerson(name, sport).catch(() => null);
    if (!pg || $panel.hidden) return;
    const head = document.getElementById('offHead'); const box = document.getElementById('offWiki');
    if (!head || !box) return;
    if (pg.img) { const d = head.querySelector('.hs'); if (d) d.outerHTML = `<span class="hs" style="width:64px;height:64px"><img src="${esc(pg.img)}" alt="" onerror="this.remove()"></span>`; }
    if (pg.extract) box.innerHTML = `<div class="vabout" style="margin-top:12px"><p>${esc(pg.extract.split(/(?<=\.)\s+/).slice(0, 3).join(' '))}</p><a class="src" href="${esc(pg.url)}" target="_blank" rel="noopener">Wikipedia<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M9 7h8v8"/></svg></a></div>`;
  }
  function openInjury(key) {
    const rec = S.injuries && S.injuries[key]; if (!rec) return;
    const { x, team } = rec; const at = x.athlete || {}; const det = x.details || {}; const st = x.status || '';
    const lk = current ? current.lk : 'nba'; const L = LEAGUES[lk];
    const id = rec.id || V._.athId(at);
    const cls = /out/i.test(st) ? 'out' : /day|quest|doubt/i.test(st) ? 'q' : /prob|avail/i.test(st) ? 'ok' : '';
    const what = [det.type, det.detail && det.detail !== det.type ? det.detail : '', det.side && det.side !== 'Not Specified' ? det.side.toLowerCase() : '', det.location && det.location !== det.type ? det.location : ''].filter(Boolean).join(', ');
    const ret = V._.retInfo(L, det.returnDate);
    const rows = [['Status', `<span class="tag ${cls}">${esc(V._.tagWord(st))}</span>`], ['Injury', esc(what || '—')], ['Reported', x.date ? esc(new Date(x.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: HW.TZ })) : ''], ['Expected back', ret ? esc(ret.long) : (/out/i.test(st) ? 'No date given' : '')], ['Fantasy', det.fantasyStatus && det.fantasyStatus.description ? esc(det.fantasyStatus.description) : '']].filter(([, v]) => v);
    const note = x.longComment || x.shortComment || '';
    openPanel(`<button class="ib close" data-act="panel-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="inj-head">${id ? `<a href="#player/${lk}/${esc(id)}" data-act="panel-close" aria-label="${esc(at.displayName || '')} profile">` : ''}${V._.headshot(V._.hsUrl(at), V._.teamColor(team, L), 64, at.displayName)}${id ? '</a>' : ''}<div><h3>${esc(at.displayName || '')}</h3><p>${esc(team.short || '')}${at.position && at.position.abbreviation ? `, ${esc(at.position.abbreviation)}` : ''}</p></div></div>
      <table class="tbl kv"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
      ${note ? `<p class="inj-note">${esc(note)}</p>` : ''}
      <div style="display:flex;gap:8px;margin-top:14px">${id ? `<a class="btn" href="#player/${lk}/${esc(id)}" data-act="panel-close">Open profile</a>` : ''}${team.id ? `<a class="btn ghost" href="#team/${lk}/${esc(team.id)}" data-act="panel-close">${esc(team.short || 'Team')}</a>` : ''}</div>`);
  }

  /* ---------- theme: match the phone, or force dark or light ---------- */
  function applyTheme() {
    const t = store.get('v5:theme', 'system'); const root = document.documentElement;   // v380: the game page follows the phone like every other screen
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    // the status bar takes the top of the wash, so the screen is one surface from its top edge down; once the wash has scrolled
    // away it takes the plain ground, the way a translucent bar would show what is behind it
    requestAnimationFrame(() => { statusBar.acc = cssColor('var(--wc)'); statusBar.bg = cssColor('var(--bg)'); statusBar.wash = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wash')) / 100 || .2; statusBar(); });
  }
  const cssColor = v => { const probe = document.createElement('i'); probe.style.cssText = 'position:absolute;visibility:hidden;background:' + v; document.body.appendChild(probe); const c = getComputedStyle(probe).backgroundColor; probe.remove(); const m = c.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/) || c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (!m) return ''; return '#' + [m[1], m[2], m[3]].map(x => Math.round(+x * (c.startsWith('color') ? 255 : 1))).map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join(''); };   // a plain hex: the status bar parser is picky
  /* the colour behind the status bar follows the wash as the page scrolls: the same stops the stylesheet draws, read at the
     scroll offset, so the bar fades with the page instead of snapping. In the home-screen app the bar is transparent and the
     glass strip shows the real page; this is for Safari's own chrome. */
  const STOPS = [[0, 1], [.14, .72], [.30, .46], [.50, .24], [.74, .09], [1, 0]];
  const hexRGB = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  function statusBar() {
    const y = window.scrollY; const root = document.documentElement;
    const on = root.classList.contains('scrolled'); root.classList.toggle('scrolled', y > (on ? 12 : 40));
    const meta = document.querySelector('meta[name="theme-color"]'); if (!meta || !statusBar.acc || !statusBar.bg) return;
    const t = Math.min(1, y / 560); let a = 0;
    for (let i = 1; i < STOPS.length; i++) { const [t0, a0] = STOPS[i - 1], [t1, a1] = STOPS[i]; if (t <= t1) { a = a0 + (a1 - a0) * (t - t0) / (t1 - t0); break; } }
    a *= (t <= .5 ? 1 : 1 - (t - .5) / .5) * statusBar.wash;
    const A = hexRGB(statusBar.acc), B = hexRGB(statusBar.bg);
    const want = '#' + A.map((v, i) => Math.round(B[i] + (v - B[i]) * a).toString(16).padStart(2, '0')).join('');
    if (meta.getAttribute('content') !== want) meta.setAttribute('content', want);
  }
  let sbT = 0; window.addEventListener('scroll', () => { if (sbT) return; sbT = setTimeout(() => { sbT = 0; statusBar(); }, 120); }, { passive: true });
  V.applyTheme = applyTheme;
  applyTheme(); window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
  /* accent: mono chrome, or the colour of the first team you follow in the league you're on */
  /* accents: black and white, the first team's colour, or one of these — the same colour runs the switcher, chips, tab bar, buttons and the header wash */
  const ACCENTS = { electric: ['#2F7CFF', 'Electric'], sky: ['#38BDF8', 'Sky'], indigo: ['#4F46E5', 'Indigo'], violet: ['#7C4DFF', 'Violet'], lavender: ['#A78BFA', 'Lavender'], pink: ['#FF4FA3', 'Pink'], rose: ['#F43F5E', 'Rose'], crimson: ['#E5304A', 'Crimson'], coral: ['#FF6B6B', 'Coral'], tangerine: ['#FF7A1A', 'Tangerine'], amber: ['#F59E0B', 'Amber'], gold: ['#F2B705', 'Gold'], lime: ['#A3E635', 'Lime'], emerald: ['#17B26A', 'Emerald'], mint: ['#2DD4BF', 'Mint'], teal: ['#13B5C8', 'Teal'] };
  V.ACCENTS = ACCENTS;
  const setAccent = (root, c, kind) => { const h = c.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; root.style.setProperty('--acc', c); root.style.setProperty('--acc-ink', lum > 0.6 ? '#000' : '#fff'); root.setAttribute('data-accent', kind); };
  async function applyAccent() {
    const root = document.documentElement; const mode = 'mono';   // accents are gone: black and white everywhere, light or dark by the phone
    if (ACCENTS[mode]) { setAccent(root, ACCENTS[mode][0], mode); applyTheme(); return; }
    root.removeAttribute('data-accent'); root.style.removeProperty('--acc'); root.style.removeProperty('--acc-ink');   // black and white (an old "team" setting lands here too)
    applyTheme();
  }
  V.applyAccent = applyAccent; applyAccent();
  document.addEventListener('rivl:fav', () => applyAccent());

  /* ---------- first run: pick teams, pick players, choose what Home shows, add to the home screen ---------- */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = document.getElementById('installBtn'); if (b) b.hidden = false; });
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  V.standalone = standalone;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  async function install() { if (deferredInstall) { deferredInstall.prompt(); const r = await deferredInstall.userChoice.catch(() => null); deferredInstall = null; if (r && r.outcome === 'accepted') { toast('Installed'); const b = document.getElementById('installBar'); if (b) b.remove(); } } else toast(isIOS ? 'Tap Share, then Add to Home Screen' : 'Use your browser menu: Add to Home screen'); }
  function needsOnboarding() { return !store.get('v5:onboarded', false); }
  let onbLk = 'nba';   // the league shown in setup; it never changes the league the app is on
  const arrow = `<svg class="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  const backBtn = attrs => `<button class="btn ghost ico" ${attrs} aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></button>`;
  /* The first thing a new person sees: not a wall of thirty teams but the mark, what RIVL is in two lines, and what the
     next three steps do. Then the picks. */
  /* the lockup, the same one as the top bar's, drawn large on the welcome */
  const onbMark = `<svg class="mark" viewBox="0 0 250 123.41" aria-hidden="true"><defs><linearGradient id="rivlMarkOnb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".40"/><stop offset=".05" stop-color="#fff" stop-opacity=".38"/><stop offset=".10" stop-color="#fff" stop-opacity=".10"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path class="r" d="M0 0H88.8A11.2 11.2 0 0 1 100 11.2V50.5A11.2 11.2 0 0 1 88.8 61.7H62.3L0 25.61ZM0 47.02L100 104.96V123.41H0Z"/><path class="w" d="M108 0H132V123.41H108ZM140 0H164.5L168.0 96L171.5 0H196L192 123.41H144ZM204 0H228V99.41H250V123.41H204Z"/><g class="sheen" fill="url(#rivlMarkOnb)"><path d="M0 0H88.8A11.2 11.2 0 0 1 100 11.2V50.5A11.2 11.2 0 0 1 88.8 61.7H62.3L0 25.61ZM0 47.02L100 104.96V123.41H0ZM108 0H132V123.41H108ZM140 0H164.5L168.0 96L171.5 0H196L192 123.41H144ZM204 0H228V99.41H250V123.41H204Z"/></g></svg>`;
  /* ===== Setup (v384): league by league =====
     A tester pressed Next expecting the next league, and people did not know WNBA and college were there to pick. So each
     league is its own step, the trail at the top shows all four with what you've picked in each, and the button always
     names where it goes ("Next: WNBA"). Every screen says what the picks are for. Then players, then Home, then install. */
  const ONB = () => [...ORDER.map(k => ({ t: 'lg', lk: k })), { t: 'players' }, { t: 'home' }, ...(standalone() ? [] : [{ t: 'install' }])];
  const onbName = st => !st ? 'Finish' : st.t === 'lg' ? LEAGUES[st.lk].label : st.t === 'players' ? 'Players' : st.t === 'home' ? 'Home' : 'Install';
  const nTeams = k => (HW.favs.all()[k] || []).length;
  const allTeams = () => ORDER.reduce((c, k) => c + nTeams(k), 0);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  /* the trail: the four leagues, a green dot and a count once something is picked in one, a line under the one you're on */
  /* v385: progress, not a menu. A thin bar with one segment per step (filled up to where you are) and one quiet line
     saying which step this is. The counts live in the bottom bar, so the top stays calm. */
  const onbTrail = n => { const S2 = ONB(); const st = S2[n]; return `<div class="otrail" aria-label="Step ${n + 1} of ${S2.length}"><div class="oseg">${S2.map((_, i) => `<i class="${i < n ? 'd' : i === n ? 'on' : ''}"></i>`).join('')}</div><p>Step ${n + 1} of ${S2.length}${st && st.t === 'lg' ? ` · ${esc(LEAGUES[st.lk].label)}` : ''}</p></div>`; };
  const onbBar = (n, mid) => { const S2 = ONB(); const nx = S2[n + 1];
    return `<div class="obar">${n >= 0 ? `<button class="oback" data-act="${n === 0 ? 'onb-welcome' : 'onb-next'}" data-step="${n - 1}">Back</button>` : '<span></span>'}<span class="omid" id="onbMid">${mid || ''}</span>${nx ? `<button class="onext" data-act="onb-next" data-step="${n + 1}" id="onbNext">Next: ${esc(onbName(nx))}</button>` : `<button class="onext" data-act="onb-done">${standalone() ? 'Open Home' : 'Finish'}</button>`}</div>`; };
  const onbMidText = n => { const st = ONB()[n]; if (!st) return ''; if (st.t === 'lg') { const c = nTeams(st.lk); return c ? `${plural(c, LEAGUES[st.lk].label + ' team')} picked` : 'None picked yet'; } if (st.t === 'players') { const c = V.fplayers.all().length; return `${plural(c, 'player')} picked`; } return ''; };
  let onbAt = -1;
  function onbOpen(html, n) {
    const dir = !$panel.hidden && $panel.querySelector('.onb') ? (n > onbAt ? 'f' : n < onbAt ? 'b' : '') : '';
    openPanel(html, { full: true });
    const root = $panel.querySelector('.onb');
    if (dir && root) { root.classList.add(`slide-${dir}`); root.addEventListener('animationend', () => root.classList.remove('slide-f', 'slide-b'), { once: true }); }
    onbAt = n;
  }
  function onbWelcome() {
    onbOpen(`<div class="onb o384 welcome"><div class="owel"><div class="onb-logo">${onbMark}</div><h2>Your teams.<br>Nothing else.</h2>
      <p>Pick the teams you follow in each league you watch. Home, Scores and Stats are built from what you choose here.</p>
      <div class="olgs">${ORDER.map(k => `<span>${esc(LEAGUES[k].label)}</span>`).join('')}</div>
      <p class="osmall">Skip any league you don't watch. You can change all of this later in Settings.</p></div>
      <div class="ofoot"><button class="onext big" style="display:block;width:100%" data-act="onb-next" data-step="0">Pick my teams</button><p class="osmall">About a minute. No account.</p></div></div>`, -1);
  }
  const CHECK = `<i class="ock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></i>`;
  async function onbStep(n) {
    const S2 = ONB(); n = Math.max(0, Math.min(n, S2.length - 1)); const st = S2[n];
    const noSave = store.broken() ? `<p class="legend warn">This browser isn't saving anything. Private browsing blocks it, so whatever you pick here will be gone when you close the tab.</p>` : '';
    const page = (title, body, inner, trail = true) => onbOpen(`<div class="onb o384" data-step="${n}">${onbTrail(n)}<div class="oscroll"><h2>${title}</h2><p class="olead">${body}</p>${noSave}<div class="onb-body">${inner}</div></div><div class="ofoot">${onbBar(n, onbMidText(n))}</div></div>`, n);
    if (st.t === 'lg') {
      const lk = st.lk, L = LEAGUES[lk], first = n === 0;
      const body = first ? `Tap the teams you follow. They lead Home and Scores, and they're the only teams you get alerts about.` : `Tap the teams you follow, or skip ahead if you don't watch ${/^ncaa/.test(lk) ? 'college' : 'the ' + L.label}.`;
      page(esc(L.label), body, `<div class="search osearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="onbq" type="search" placeholder="Search teams" autocomplete="off"></div><div id="onbList">${Array.from({ length: 6 }, () => '<div class="skel row" style="margin:0 0 8px"></div>').join('')}</div>`);
      const list = document.getElementById('onbList'); const inp = document.getElementById('onbq');
      const [idx, stg, R] = await Promise.all([V.teamsIndex(L), HW.standings(L).catch(() => null), HW.rankings(L).catch(() => null)]);
      if (!document.getElementById('onbList')) return;
      const byShort = (a, b) => (a.short || a.name || '').localeCompare(b.short || b.name || '');
      const tile = (id, rank) => { const t = idx[id] || {}; const r = stg && stg.byId && stg.byId[id]; const conf = r && L.standingsMode !== 'conferences' && r.pos ? ` · ${HW.ordinal(r.pos)} in the ${V._.confName(r.group, r.groupAbbr)}` : ''; return { id, short: t.short || (r && r.short) || t.name || (r && r.name) || '', name: t.name || (r && r.name) || '', abbr: t.abbr || (r && r.abbr) || '', logo: t.logo || (r && r.logo) || '', color: V._.teamColor({ id, abbr: t.abbr || (r && r.abbr) || '' }, L) || '', sub: r ? `${r.w}-${r.l}${conf}` : '', rank: rank || 0 }; };
      const once = rows => { const got = new Set(); return rows.filter(r => r && r.id && !got.has(r.id) && got.add(r.id)); };
      const seen = new Set(); const groups = [];
      if (L.standingsMode === 'conferences' && stg && stg.groups.length) {
        if (R && R.ranks && R.ranks.length) groups.push({ name: R.name || 'Top 25', note: 'Also listed under their conference.', rows: once(R.ranks.map(x => tile(String(x.team.id), x.rank))) });
        stg.groups.slice().sort((a, b) => V._.confName(a.name, a.abbr).localeCompare(V._.confName(b.name, b.abbr))).forEach(g => { const rows = once(g.rows.filter(r => !seen.has(r.id)).map(r => { seen.add(r.id); return tile(r.id); })).sort(byShort); if (rows.length) groups.push({ name: V._.confName(g.name, g.abbr), rows }); });
        const rest = once(Object.keys(idx).filter(id => !seen.has(id)).map(id => tile(id))).sort(byShort); if (rest.length) groups.push({ name: 'Other', rows: rest });
      } else groups.push({ name: '', rows: once(Object.keys(idx).map(id => tile(id))).sort(byShort) });
      const secKey = name => `${lk}:${name}`;
      const secOpen = (name, first) => { const s = store.get('v5:onbsec', {}) || {}; const v = s[secKey(name)]; return v === undefined ? first : !!v; };
      const row = tm => { const on = HW.favs.has(lk, tm.id); return `<button class="gr onb-team${on ? ' on' : ''}" data-act="fav" data-quiet="1" data-lk="${lk}" data-id="${esc(tm.id)}" data-name="${esc(tm.short)}" aria-pressed="${on}"><span class="logo">${V._.imgSized(tm.logo || '', 96, 96, 'loading="eager" fetchpriority="low" decoding="async"')}</span><span class="gm"><b>${tm.rank ? `<small class="ork">${tm.rank}</small>` : ''}${esc(tm.short)}</b>${tm.sub ? `<span>${esc(tm.sub)}</span>` : ''}</span>${CHECK}</button>`; };
      const paint = () => {
        const q = inp.value.trim().toLowerCase();
        const html = groups.map((g, gi) => {
          const rows = g.rows.filter(tm => !q || `${tm.name} ${tm.short} ${tm.abbr} ${g.name}`.toLowerCase().includes(q)); if (!rows.length) return '';
          const card = `<div class="gl">${rows.map(row).join('')}</div>`;
          if (!g.name) return card;
          const open = q ? true : secOpen(g.name, gi === 0);
          return `<button class="onb-sec" data-act="onbsec" data-sec="${esc(secKey(g.name))}" aria-expanded="${open}"><b>${esc(g.name)}</b><span>${rows.length}</span>${V._.chev}</button><div class="fold${open ? '' : ' closed'}"><div>${g.note ? `<p class="onb-note">${esc(g.note)}</p>` : ''}${card}</div></div>`;
        }).join('');
        list.innerHTML = html || `<div class="empty"><b>No team matches</b><p style="margin:6px 0 0">Try the school, the nickname or the conference.</p></div>`;
        onbCount();
      };
      paint(); inp.addEventListener('input', paint);
    } else if (st.t === 'players') {
      const withTeams = ORDER.filter(k => nTeams(k)); const pool = withTeams.length ? withTeams : ORDER;
      if (!pool.includes(onbLk)) onbLk = pool[0];
      const lk = onbLk, L = LEAGUES[lk];
      const seg = pool.length > 1 ? `<div class="segc">${pool.map(k => `<button class="${k === lk ? 'on' : ''}" data-act="onb-lk" data-lk="${k}" data-step="${n}">${esc(LEAGUES[k].label)}</button>`).join('')}</div>` : '';
      page('Players', `Follow players to get their stat line after every game and any injury news. Pick from your teams' rosters or search any name. This step is optional.`, `${seg}<div id="onbPick" class="onb-list">${Array.from({ length: 6 }, () => '<div class="skel row" style="margin:0 0 8px"></div>').join('')}</div>`);
      await V.playerPicker(document.getElementById('onbPick'), L, { leaders: true, select: true }); onbCount();
    } else if (st.t === 'home') {
      const P = V.prefs.all();
      const items = [['live', 'Game cards', "Swipeable cards for your teams' games today"], ['teams', 'Live and upcoming', "Your teams' games on now and later today"], ['brief', 'Results', "How your teams' games went, with the top scorers"], ['players', 'Player lines', "Your players' numbers after each game"], ['injuries', 'Injuries', 'Status changes on your teams and players'], ['news', 'News', 'Stories about your teams and players'], ['forecast', 'Win chances', "RIVL's pick on every game"]];
      page('Your Home screen', `Home is a feed of what happens to your teams and players. Turn off anything you don't want. You can change this later in Settings.`,
        `<div class="gl">${items.map(([k, t, b]) => `<button class="gr ni sw" data-act="pref" data-pref="${k}" role="switch" aria-checked="${P[k] !== false}"><span class="gm wrap"><b>${esc(t)}</b><span>${esc(b)}</span></span><span class="switch"></span></button>`).join('')}</div>`, false);
    } else {
      const carryNote = () => HW.carry.works()
        ? `<p class="osmall" style="text-align:left">Your teams and players come with you. The app opens with them already picked.</p>`
        : `<p class="legend warn">This browser is blocking cookies, so your picks can't move into the home-screen app on their own. Before you add it, open <b>Settings → Sync</b> and back up to a code, then restore it in the app.</p>`;
      page('Add RIVL to your home screen', 'It opens full screen like an app, with no browser bar, and your teams load first.',
        `<div class="gl"><div class="gr ni oinst"><img src="img/icon-192.png" alt="" width="56" height="56"><span class="gm wrap">${deferredInstall ? `<button class="onext" data-act="install" id="installBtn">Install RIVL</button>` : isIOS ? `<b>In Safari</b><span>Tap the Share button, choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</span>` : `<b>In your browser menu</b><span>Choose <b>Add to Home screen</b> or <b>Install app</b>.</span>`}</span></div></div>${carryNote()}`, false);
    }
  }
  V.onbStep = onbStep; V.onbWelcome = onbWelcome;
  /* after every tap: the checks, the trail's counts, each conference's "N picked", the line in the bar */
  const onbCount = () => {
    const root = $panel.querySelector('.o384'); if (!root || $panel.hidden) return;
    root.querySelectorAll('.onb-team').forEach(t => { const on = HW.favs.has(t.dataset.lk, t.dataset.id); t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on)); });
    root.querySelectorAll('.onb-sec').forEach(h => { const f = h.nextElementSibling; const k = f ? f.querySelectorAll('.onb-team.on').length : 0; let em = h.querySelector('em'); if (k && !em) { em = document.createElement('em'); const ch = h.querySelector('.chev'); if (ch) ch.before(em); else h.appendChild(em); } if (em) { if (k) em.textContent = `${k} picked`; else em.remove(); } });
    const mid = document.getElementById('onbMid'); if (mid) mid.textContent = onbMidText(+root.dataset.step);
  };
  $panel.addEventListener('rivl:fav', onbCount); $panel.addEventListener('rivl:follow', onbCount);

  /* ---------- boot ---------- */
  /* First launch of a Home Screen app on iOS: the storage is a fresh jar — nothing picked in Safari is in it — but the
     cookies were copied across as the app was created. If nothing is saved here yet and that cookie holds picks, take them
     over rather than make someone choose thirty teams a second time. Names ride along so the list reads properly at once;
     photos and colours refill from the feed. */
  function carryIn() {
    if (store.get('favs', null) || store.get('v5:onboarded', false)) return false;
    const c = HW.carry.read(); if (!c) return false;
    if (!Object.values(c.f || {}).some(a => a && a.length)) return false;
    if (!store.set('favs', c.f)) return false;
    if (c.p && c.p.length) store.set('v5:players', c.p.map(a => ({ lk: a[0], id: String(a[1]), name: a[2] || '', short: a[2] || '', team: a[3] || '', teamId: '', img: '', color: '' })));
    store.set('v5:onboarded', true);
    return true;
  }
  const carried = carryIn();
  // keep the cookie level with the picks, so it is ready whenever the app is added to the home screen
  HW.carry.save();
  document.addEventListener('rivl:fav', () => HW.carry.save());
  document.addEventListener('rivl:follow', () => HW.carry.save());
  render().then(() => {
    poll();
    if (needsOnboarding()) onbWelcome();
    else if (carried) toast('Picked up the teams and players you chose in your browser');
  });
  /* A browser that will not keep anything — private browsing blocks the write, and iOS throws on it. Say so on every
     screen and before anything is picked, because the alternative is someone choosing thirty teams, watching them all
     light up, and finding the lot gone when they come back. The probe is a real write and read, not a guess. */
  store.check();
  document.addEventListener('rivl:rendered', () => {
    if (!store.broken() || document.getElementById('noSaveBar')) return;
    const bar = document.createElement('div'); bar.id = 'noSaveBar'; bar.className = 'installbar nosave';
    bar.innerHTML = `<div><b>This browser isn't saving anything</b><span>Private browsing blocks it. Your teams and players will be gone when you close the tab. Open RIVL in a normal window to keep them.</span></div>`;
    $main.prepend(bar);
  });
  /* install bar on Home while the app isn't on the home screen yet */
  const origRender = render;
  document.addEventListener('rivl:rendered', () => {
    if (!current || current.name !== 'home' || standalone() || store.get('v5:installDismissed', 0) || !store.get('v5:onboarded', false)) return;
    if (document.getElementById('installBar')) return;
    const bar = document.createElement('div'); bar.id = 'installBar'; bar.className = 'installbar';
    bar.innerHTML = `<img src="img/icon-192.png" alt="" width="36" height="36"><div><b>Add RIVL to your home screen</b><span>Opens full screen, your teams first.</span></div><button class="btn" data-act="install">${deferredInstall ? 'Install' : 'How'}</button><button class="ib" data-act="install-later" aria-label="Not now"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    $main.prepend(bar);
  });
})();
/* the version on this phone, read off the stamp the page loaded its script with, shown small by the settings button */
(() => { const s = document.querySelector('script[src*="app.js"]'); const m = s && /[?&]v=(\d+)/.exec(s.getAttribute('src')); const el = document.getElementById('ver'); if (el && m) el.textContent = 'v' + m[1]; })();
