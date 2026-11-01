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
    const settle = () => { $main.dataset.real = '1'; pendingSkel = ''; clearTimeout(slowT); const sl = $main.querySelector('.slow'); if (sl) sl.remove(); hideBar(); if ($main.dataset.top === '1') { $main.dataset.top = '0'; const y = +$main.dataset.y || 0; window.scrollTo(0, y); if (y) requestAnimationFrame(() => window.scrollTo(0, y)); requestAnimationFrame(() => requestAnimationFrame(() => { $main.style.minHeight = ''; })); } if (render.onReal) { const f = render.onReal; render.onReal = null; f(); } };
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
    let rc; if ((rc = h.match(/^recruit\/(boys|girls)\/(\d{4})\/([a-z0-9-]+)$/))) return { name: 'recruit', lk: rc[1] === 'girls' ? 'ncaaw' : 'ncaam', args: [rc[1], rc[2], rc[3]] };
    if (LEAGUES[h]) { if (store.get('v5:lk') !== h) { store.set('v5:lk', h); if (V.applyAccent) V.applyAccent(); } return { name: store.get('v5:screen', 'home'), lk: h, args: [h] }; }
    if (h === 'search') return { name: 'search', lk: lkOf(store.get('v5:lk', 'nba')), args: [] };
    let rm; if ((rm = h.match(/^record(?:\/([a-z]+))?$/))) { const k = rm[1] && LEAGUES[rm[1]] ? rm[1] : lkOf(store.get('v5:lk', 'nba')); return { name: 'record', lk: k, args: [k] }; }
    let sm; if ((sm = h.match(/^settings(?:\/([a-z]+))?$/))) return { name: 'settings', lk: lkOf(store.get('v5:lk', 'nba')), args: [sm[1] || ''] };
    const name = SCREENS.includes(h) ? h : 'home';
    const lk = lkOf(store.get('v5:lk', 'nba'));
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
    // X-style: the line sits under the chosen league's word, as wide as the word, and slides to the next one
    requestAnimationFrame(() => { const on = $pills.querySelector('.pill.on'), sp = on && on.querySelector('span'); if (!sp) return; $pills.style.setProperty('--ux', (on.offsetLeft + sp.offsetLeft - 10) + 'px'); $pills.style.setProperty('--uw', (sp.offsetWidth + 20) + 'px'); });
  }
  function paintTabs(name) {
    $tabs.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  }
  const TITLES = { home: 'Following', stats: 'Stats', scores: 'Scores', standings: 'Standings', players: 'Players', teams: 'Teams', search: 'Search', settings: 'Settings', record: 'Record' };

  /* ---------- render ---------- */
  let seq = 0, current = null;
  /* where each screen was scrolled to, by screen key: going BACK to a screen lands where you were; a tab lands where you left it;
     a link to a player, team, game or story always opens at the top, however far down it you were last time */
  const J = (n, f) => HW.perf ? HW.perf.job(n, f) : f();
  /* the gesture gate: while a finger is on the screen or a slide is settling, nothing that could take a frame runs
     (polling repaints, crest fitting, building the next league's copy). It all waits for the hand to lift. */
  let touching = false; const later = [];
  V.busy = () => touching || !!render.swiping || !!render.gliding;
  V.whenIdle = fn => { if (!V.busy()) { fn(); return; } if (!later.includes(fn)) later.push(fn); };
  V.flushIdle = () => { if (V.busy() || !later.length) return; const q = later.splice(0); q.forEach(f => { try { f(); } catch (e) { console.error(e); } }); };
  document.addEventListener('touchstart', () => { touching = true; clearTimeout(V.flushT); }, { passive: true, capture: true });
  const lift = () => { touching = false; clearTimeout(V.flushT); V.flushT = setTimeout(V.flushIdle, 320); };
  document.addEventListener('touchend', lift, { passive: true, capture: true }); document.addEventListener('touchcancel', lift, { passive: true, capture: true });
  setInterval(() => V.flushIdle(), 1500);
  const scrollMem = new Map();
  const entSnaps = new Map();   // the last few game, team and player pages, as they stood when you left them
  /* every sideways strip (last night's results, a rail of players, the date row) remembers how far you moved it, per
     screen, so coming back by a league swipe, a tab or a refresh finds it exactly where you left it */
  const STRIP_SEL = '.dates,.brief-row,.chips,.rail,.media,.tw,.onb-picked-row,.frows-x';
  const stripMem = new Map();
  const stripKeys = root => { const cnt = {}; return [...root.querySelectorAll(STRIP_SEL)].map(el => { const sec = el.closest('[data-sec]'); const b = (sec ? sec.dataset.sec : '') + '|' + (el.classList[0] || ''); cnt[b] = (cnt[b] || 0) + 1; return [b + '|' + cnt[b], el]; }); };
  const stripsOf = root => { const m = {}; stripKeys(root).forEach(([k, el]) => { if (el.scrollLeft > 0) m[k] = el.scrollLeft; }); return m; };
  const stripsTo = (root, m) => { if (!root || !m) return; stripKeys(root).forEach(([k, el]) => { const v = m[k] || 0; if (Math.abs(el.scrollLeft - v) > 1) el.scrollLeft = v; }); };
  const keyOf = r => r ? `${r.name}/${(r.args || []).join('/')}` : '';
  document.addEventListener('scroll', e => { const t = e.target; if (render.swiping || !t || t.nodeType !== 1 || !t.matches(STRIP_SEL) || !$main.contains(t)) return; const k = keyOf(current); if (k) stripMem.set(k, stripsOf($main)); }, true);
  // sections that arrive after the first paint get their place back too
  new MutationObserver(() => { if (render.swiping) return; J('mo:strips', () => { const k = keyOf(current); const m = k && stripMem.get(k); if (m && Object.keys(m).length) stripsTo($main, m); }); }).observe($main, { childList: true, subtree: true });
  let navN = 0;   // each history entry is numbered the first time it is shown; an entry numbered below the one we left is a step back
  async function render() {
    const r = route(); const my = ++seq; current = r; V.refresh = null; closeSheet();
    if (r.name !== 'scores' && V.todayPill) V.todayPill(false);   // the Scores screen's back-to-today pill goes with it
    const key = `${r.name}/${r.args.join('/')}`; const sp = HW.perf && HW.perf.span('render ' + key);
    const st = history.state; const back = !!(st && st.n != null && st.n < navN);
    if (st && st.n != null) navN = st.n; else { navN += 1; try { history.replaceState({ n: navN }, ''); } catch { } }
    const leagueScreen = SCREENS.includes(r.name);
    if (render.key && render.key !== key && !render.memDone) { scrollMem.set(render.key, window.scrollY); stripMem.set(render.key, stripsOf($main)); } render.memDone = false;   // a swipe already saved where you were
    const leagueChanged = leagueScreen && render.lk && render.lk !== r.lk;   // a tap on the league switch starts the new league at the top
    $main.dataset.y = render.key !== key ? ((back || leagueScreen) ? String(scrollMem.get(key) || 0) : '0') : '';
    // a page that starts at the top goes there now, before its skeleton replaces the old screen — otherwise the old scroll
    // position clamps as the document shrinks and the eye sees two moves instead of one
    const fresh = render.key !== key;
    /* a game, team or player page you leave is kept as it stood (its scroll included), so coming back to it, by the arrow or
       the phone's own back swipe, shows it at once exactly as you left it; its numbers then refresh in place */
    const ENT = ['game', 'team', 'player'];
    if (fresh && render.key && ENT.includes(render.screen) && $main.querySelector('#gpage') && $main.dataset.real === '1') { const gs = $main.querySelector('#gxscroll'); entSnaps.delete(render.key); entSnaps.set(render.key, { html: $main.innerHTML, st: gs ? gs.scrollTop : 0 }); while (entSnaps.size > 8) entSnaps.delete(entSnaps.keys().next().value); }
    render.screen = r.name;
    /* hold the page's height through the switch: while the new screen loads, a shorter page would clamp the scroll and the
       header with the league switch would drop in and slide back out (the hitch between tabs). Released once the new
       screen has landed at its scroll. */
    if (fresh && render.key) { $main.style.minHeight = $main.offsetHeight + 'px'; clearTimeout(render.mhT); render.mhT = setTimeout(() => { $main.style.minHeight = ''; }, 1500); }
    clearTimeout(render.holdT); render.onReal = null;
    /* the phone's own back swipe (or its back button) already animates the move with a snapshot of the screen you are
       going back to: our crossfade on top of that showed the old page a second time, fading out over the new one (the hitch
       on swiping back). So the fade runs only for a move started by a tap inside the app. */
    const byTap = render.tapAt && performance.now() - render.tapAt < 1500; render.tapAt = 0;
    const swiped = render.swipe; render.swipe = false; if (swiped) { $main.classList.remove('enter', 'fade', 'hold'); $main.classList.add('noanim'); }
    if (fresh && MOTION() && !swiped && (byTap || !render.key)) {
      /* a crossfade, not a blink: a snapshot of the old screen is laid over the page and fades out while the new screen, held
         invisible until its real content has painted, fades in beneath it. If the content takes longer than a beat, the skeleton
         is shown instead so the hold never ends in a blank. */
      if (render.key) ghost();
      /* switching leagues slides like X's tabs: the new league comes in from the side of the tab you tapped, the old one leaves the other way */
      const dir = leagueChanged ? (ORDER.indexOf(r.lk) > ORDER.indexOf(render.lk) ? 'r' : 'l') : '';
      if (dir) $main.dataset.dir = dir; else delete $main.dataset.dir; const gh = document.querySelector('.xghost:not(.out)'); if (gh && dir) gh.dataset.dir = dir;
      $main.classList.remove('fade', 'enter'); $main.classList.add('hold');
      const fadeIn = () => { clearTimeout(render.holdT); $main.classList.remove('hold', 'fade', 'enter'); void $main.offsetWidth; $main.classList.add('fade', 'enter'); document.querySelectorAll('.xghost:not(.out)').forEach(g => { g.classList.add('out'); setTimeout(() => g.remove(), 500); }); };   // the snapshot lets go only now, so the two cross
      render.onReal = fadeIn;
      render.holdT = setTimeout(() => { if (render.onReal === fadeIn && my === seq) { render.onReal = null; V.showSkeleton(); fadeIn(); render.onReal = () => { $main.classList.remove('enter'); void $main.offsetWidth; $main.classList.add('enter'); }; } }, dir ? 110 : 260);   // a league swipe starts moving almost at once, as X's does
    }
    if (leagueChanged) {
      /* A league switch is a new screen, not the old one refreshed: the old league never stays on screen while the new one
         loads (its skeleton paints instead), and a scroll still coasting from a flick is stopped before the jump to the top,
         so iOS cannot carry the page on down or bounce it back after the new league lands. */
      if (!swiped) $main.dataset.real = '0';   // after a swipe the page already holds that league's last screen; it updates in place
      const de = document.documentElement, y0 = +$main.dataset.y || 0; de.style.overflow = 'hidden'; window.scrollTo(0, y0); void de.offsetHeight;   // each league comes back where you left it
      requestAnimationFrame(() => { de.style.overflow = ''; window.scrollTo(0, y0); });
    } else if ($main.dataset.y === '0' && fresh) window.scrollTo(0, 0);
    render.lk = r.lk;
    if (r.name !== 'game') document.documentElement.classList.remove('gxon');
    if (!['team', 'player', 'game'].includes(r.name) && V._.tint) V._.tint('');   // only a team's, a player's or a game's page wears a team colour
    if (leagueScreen) store.set('v5:screen', r.name);
    /* The Scores date goes back to today when you move to another tab — Home, Standings, Teams, Players — so a day you
       looked at last week is not waiting the next time you open Scores. It does NOT reset when you drill into a game, a
       team or a player from a score card: those are children of the day you were on, and coming back lands on that day. */
    if (leagueScreen && r.name !== 'scores') store.set('v5:date', todayCT());
    document.getElementById('top').hidden = !leagueScreen;
    // a game, team or player page is full screen, like X's game page: no bottom bar; the back button takes you out
    document.documentElement.classList.toggle('entity', ['game', 'team', 'player', 'venue', 'recruit'].includes(r.name));
    paintPills(r.lk, leagueScreen);
    /* the bar lights the tab you are in; a player, team or game page keeps lit the tab you opened it from */
    const TABS = ['scores', 'standings', 'home', 'stats', 'search'], tabOf = n => n === 'players' || n === 'teams' ? 'home' : n;
    if (TABS.includes(tabOf(r.name))) render.tab = tabOf(r.name);
    paintTabs(TABS.includes(tabOf(r.name)) ? tabOf(r.name) : (render.tab || (r.name === 'game' ? 'scores' : 'home')));
    document.title = leagueScreen ? `${TITLES[r.name]} · ${LEAGUES[r.lk].label} · RIVL` : `${TITLES[r.name] || ''} RIVL`.trim();
    $main.dataset.top = '1';   // scroll to the top with the new screen's first real paint, not before it
    { const es = fresh && ENT.includes(r.name) ? entSnaps.get(key) : null; if (es) { $main.innerHTML = es.html; const gs = $main.querySelector('#gxscroll'); if (gs) gs.scrollTop = es.st; if (V._ && V._.gxAttach) V._.gxAttach(); } }
    if (sp) sp.end();
    try { await (V[r.name] || V.home)(...r.args); }
    catch (err) { if (my === seq) $main.innerHTML = `<div class="empty"><b>Something went wrong</b><p style="margin:6px 0 0">${esc(err && err.message || 'Try again in a moment.')}</p></div>`; console.error(err); }
    if (my !== seq) return;
    V.settled();   // a view that painted into part of the screen (Scores' list, a standings chip, a refreshed game) made no full paint to clear the bar, the dimming and the slow note, or to land at its scroll
    paintPills(r.lk, leagueScreen);   // live counts may have arrived while the view loaded
    // the rise plays for a new screen; a screen repainting itself (another day on Scores, another conference) keeps still
    if (swiped) { $main.classList.remove('enter', 'fade', 'hold'); $main.classList.add('noanim'); clearTimeout(render.naT); render.naT = setTimeout(() => $main.classList.remove('noanim'), 1200); }   // a swipe already moved the page: it lands still, no fade, no rise
    else if (key !== render.key) { if (!$main.classList.contains('enter')) { void $main.offsetWidth; $main.classList.add('enter'); } } else $main.classList.remove('enter');
    render.key = key;
    $main.classList.remove('hold'); clearTimeout(render.holdT); render.onReal = null; document.querySelectorAll('.xghost:not(.out)').forEach(g => { g.classList.add('out'); setTimeout(() => g.remove(), 500); });   // whatever happened, nothing stays held once the view has returned
    document.dispatchEvent(new CustomEvent('rivl:rendered'));
  }
  /* the old screen, as it stood, laid over the page and fading. NOTE the class is `xghost`, never `ghost`:
     `.btn.ghost` is the secondary-button style, and a bare `.ghost` rule captured every one of them (v86 regression —
     they turned position:fixed and pointer-events:none, and this function deleted them). Keep the names apart. — so the next screen appears through it instead of after a gap */
  function ghost() {
    document.querySelectorAll('.xghost').forEach(g => g.remove());
    /* a game, team or player page is fixed to the viewport, so the page box itself has no height: the copy then covers the
       whole viewport. Otherwise the copy sits exactly over the page, with the page's own padding (no few-pixel shift). */
    const ent = !!$main.querySelector(':scope > .gxpage'); let r = $main.getBoundingClientRect();
    if (ent) r = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }; if (!r.width || !r.height) return;
    const g = document.createElement('div'); g.className = 'xghost' + (ent ? ' ent' : ''); g.setAttribute('aria-hidden', 'true');
    g.style.cssText = `left:${r.left}px;width:${r.width}px`;
    const c = $main.cloneNode(true); c.removeAttribute('id'); c.className = ''; const cs = getComputedStyle($main); c.style.cssText = ent ? `transform:translateY(0);width:${r.width}px;height:${r.height}px;margin:0;padding:0` : `transform:translateY(${r.top}px);padding:${cs.padding};margin:0;width:${r.width}px;box-sizing:border-box`;
    g.appendChild(c); document.body.appendChild(g);
    /* a copy starts every strip and scroll box at its start, so the date strip, a rail or the page's own scroll box jumped
       inside the fading copy. Put each one back where it was. */
    const src = $main.querySelectorAll('*'), dst = c.querySelectorAll('*');
    for (let i = 0; i < src.length; i++) { const x = src[i].scrollLeft, y = src[i].scrollTop; if (dst[i]) { if (x) dst[i].scrollLeft = x; if (y) dst[i].scrollTop = y; } }
    g.addEventListener('animationend', () => g.remove()); setTimeout(() => g.remove(), 1500);   // it fades once the new screen is ready (fadeIn adds .out); never outstays its welcome
  }
  window.addEventListener('hashchange', render);

  /* ---------- polling: today's slate for every league, faster while something is live ---------- */
  let pollT = null, lastOk = 0;
  async function poll() {
    clearTimeout(pollT);
    const today = todayCT(); const r = current || route();
    poll.n = (poll.n || 0) + 1;
    const order = [r.lk, ...ORDER.filter(k => k !== r.lk && (poll.n % 4 === 1 || S.today[k].some(isLive)))];   // the other leagues every fourth pass, every pass while one of them has a game on (the live strip shows it)
    let anyLive = ORDER.some(k => k !== r.lk && S.today[k].some(isLive)), failed = false;
    for (const k of order) {
      try {
        const g = await scoreboard(LEAGUES[k], today, k === r.lk || S.today[k].some(isLive) ? 15000 : 120000);   // a league with a game on refreshes fast whichever tab you are on (the live bar shows it)
        /* a game in play never loses its score: when the feed sends a live game with the score missing (it has done so at
           the half), the last score it gave stands until a new one comes */
        const was = new Map((S.today[k] || []).map(x => [x.id, x]));
        g.forEach(x => { const p = was.get(x.id); if (!p || x.state !== 'in') return; ['home', 'away'].forEach(s => { if (x[s].score == null && p[s].score != null) x[s].score = p[s].score; }); });
        S.today[k] = g; if (g.some(isLive)) anyLive = true;
      }
      catch { failed = true; }
    }
    if (!failed) lastOk = Date.now();
    stale(failed);
    V.whenIdle(() => J('polled', () => document.dispatchEvent(new CustomEvent('rivl:polled'))));
    if (SCREENS.includes((current || route()).name)) paintPills((current || route()).lk, true);
    if (anyLive && current && (current.name === 'home' || current.name === 'scores')) refreshCards();
    if (V.refresh) { try { await V.refresh(); } catch { } }
    pollT = setTimeout(poll, anyLive ? 25000 : V.refresh ? (V.refresh.every || 25000) : 90000);
  }
  /* a quiet line when the feed is unreachable: what's on screen is the last good copy */
  let staleEl = null, staleSince = 0;
  function stale(failed) {
    const off = failed || navigator.onLine === false;
    if (off && !staleSince) staleSince = lastOk || Date.now();
    if (!off) staleSince = 0;
    if (!staleEl) { staleEl = document.createElement('div'); staleEl.className = 'stale'; staleEl.hidden = true; document.getElementById('main').before(staleEl); }
    if (!off) { staleEl.hidden = true; return; }
    const m = Math.max(1, Math.round((Date.now() - staleSince) / 60000));
    staleEl.innerHTML = `<span></span>${navigator.onLine === false ? 'Offline' : 'Feed not answering'} · showing the last copy from ${m} min ago`;
    staleEl.hidden = false;
  }
  /* a quiet line at the foot of Following and Scores saying when the numbers were last fetched */
  const updAt = () => {
    const r = current || route(); const want = r && (r.name === 'home' || r.name === 'scores') && $main.dataset.real === '1' && lastOk;
    let el = $main.querySelector(':scope > .updat');
    if (!want) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('p'); el.className = 'updat'; $main.appendChild(el); }
    const s = Math.round((Date.now() - lastOk) / 1000); const w = s < 45 ? 'just now' : s < 90 ? '1 min ago' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(lastOk).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const t = `Updated ${w} · pull down to refresh`; if (el.textContent !== t) el.textContent = t;
  };
  document.addEventListener('rivl:polled', updAt); document.addEventListener('rivl:rendered', () => setTimeout(updAt, 50)); setInterval(updAt, 30000);
  window.addEventListener('online', () => { stale(false); poll(); }); window.addEventListener('offline', () => stale(true));
  /* swap live scores into the cards on screen without repainting the whole page */
  function refreshCards() {
    const r = current; if (!r) return; const L = LEAGUES[r.lk];
    const byId = new Map(S.today[r.lk].map(g => [g.id, g]));
    $main.querySelectorAll('[data-gid]').forEach(el => {
      const g = byId.get(el.dataset.gid); if (!g) return;
      if (el.classList.contains('grow')) {   // a score row: copy over the numbers, the middle and the fading; the crests stay put
        const t = document.createElement('div'); t.innerHTML = V._.gameRow(L, g, null); const n = t.firstElementChild; if (!n) return;
        const a2 = el.querySelectorAll(':scope > .sc'), b2 = n.querySelectorAll(':scope > .sc'); a2.forEach((s, i) => { if (!b2[i]) return; if (s.textContent !== b2[i].textContent) s.textContent = b2[i].textContent; if (s.className !== b2[i].className) s.className = b2[i].className; });
        const m1 = el.querySelector(':scope > .mid'), m2 = n.querySelector(':scope > .mid'); if (m1 && m2 && m1.innerHTML !== m2.innerHTML) m1.innerHTML = m2.innerHTML;
        const t1 = el.querySelectorAll(':scope > .tm'), t2 = n.querySelectorAll(':scope > .tm'); t1.forEach((s, i) => { if (t2[i] && s.className !== t2[i].className) s.className = t2[i].className; });
        if (g.state === 'post' && el.closest('[data-sec="live"]')) render();
        return;
      }
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
    const onToday = false;   // the bar stays, whichever league and screen you are on
    [r.lk, ...ORDER.filter(k => k !== r.lk)].forEach(k => {
      if (onToday && k === r.lk) return;
      if (r.name === 'game') return;   // the game page carries the day's games in its own bar
      const L = LEAGUES[k]; const gs = S.today[k].filter(g => isLive(g) && !(r.name === 'game' && r.lk === k && String(r.args[1]) === g.id)).sort((a, b) => (HW.isFav(b) ? 1 : 0) - (HW.isFav(a) ? 1 : 0));
      gs.sort((a, b) => (HW.isFav(b) ? 1 : 0) - (HW.isFav(a) ? 1 : 0)).forEach(g => out.push({ g, L }));
    });
    return out;
  }
  /* the live bar, Spotify's mini player: a floating card in both teams' colours, the score on one line, the clock and
     the channel under it, a thin line along the bottom for how much of the game is played */
  function liveChip(g, L) {
    const tc = t => V._.teamColor(t, L); const a = g.away, h = g.home;
    const left = HW.fracLeft ? HW.fracLeft(L, g) : null; const played = left == null || !isFinite(left) ? 0 : Math.max(0, Math.min(1, 1 - left));
    const nm = t => esc(t.short || t.abbr), sc = t => t.score ?? '';
    const tv = g.tv && g.tv.label ? ` · ${esc(g.tv.label)}` : '';
    const mine = HW.favs && HW.favs.has(L.key, a.id) ? a : HW.favs && HW.favs.has(L.key, h.id) ? h : null;   // the card takes your team's color, like Spotify takes the cover's
    const base = tc(mine || h) || tc(a) || '#333';
    const as = Number(a.score), hs = Number(h.score), lo = t => (isFinite(as) && isFinite(hs) && as !== hs && (t === a ? as < hs : hs < as)) ? ' lo' : '';
    const row = t => `<span class="lr${lo(t)}">${V._.logo(t.logo || '', 's', tc(t))}<span class="nm">${nm(t)}</span><i class="sc">${sc(t)}</i></span>`;
    return `<a class="lg sb${HW.isFav(g) ? ' fav' : ''}" href="#game/${L.key}/${esc(g.id)}" data-lid="${L.key}:${esc(g.id)}" style="--ca:${esc(tc(a) || '#333')};--ch:${esc(tc(h) || '#333')};--cb:${esc(base)};--pl:${(played * 100).toFixed(1)}%"><span class="lrows">${row(a)}${row(h)}</span><span class="lside"><span class="st"><span class="dot"></span>${esc(HW.clockOf ? HW.clockOf(g, L) : g.detail)}</span>${g.tv && g.tv.label ? `<small>${esc(g.tv.label)}</small>` : ''}</span></a>`;
  }
  const paintLive = () => J('paintLive', paintLive0);
  function paintLive0() {
    if (!$live) return;
    const r = current || route();
    const show = r && !['settings', 'search'].includes(r.name) && !document.body.classList.contains('onboarding');
    const list = show ? liveList() : [];
    const inner = $live.querySelector('.lb-in');
    if (!list.length) { if (!$live.hidden) { $live.hidden = true; inner.innerHTML = ''; } document.documentElement.classList.remove('lbon'); return; }
    const want = list.map(({ g, L }) => `${L.key}:${g.id}`);
    const have = [...inner.children].map(el => el.dataset.lid);
    if (want.join() !== have.join()) { const x = inner.scrollLeft; inner.innerHTML = list.map(({ g, L }) => liveChip(g, L)).join(''); inner.scrollLeft = x; }   // a game starting or ending rebuilds the strip; where you had scrolled it stays put
    else list.forEach(({ g, L }, i) => {   // same games: touch only the numbers, the clock and the line
      const el = inner.children[i]; const t = document.createElement('div'); t.innerHTML = liveChip(g, L); const n = t.firstElementChild; if (!n) return;
      el.querySelectorAll('.sc').forEach((x, j) => { const y = n.querySelectorAll('.sc')[j]; if (y && x.textContent !== y.textContent) x.textContent = y.textContent; });
      el.querySelectorAll('.lr').forEach((x, j) => { const y = n.querySelectorAll('.lr')[j]; if (y) x.classList.toggle('lo', y.classList.contains('lo')); });   // who leads can change between polls
      const st = el.querySelector('.st'), st2 = n.querySelector('.st'); if (st && st2 && st.innerHTML !== st2.innerHTML) st.innerHTML = st2.innerHTML;
      el.style.setProperty('--pl', n.style.getPropertyValue('--pl'));
    });
    if ($live.hidden) $live.hidden = false;
    document.documentElement.classList.add('lbon');
    if (V.edges) V.edges();
  }
  document.addEventListener('rivl:rendered', () => { if ($live && $live.hidden) document.documentElement.classList.remove('lbon'); });
  /* the strip lives under the pills; an entity screen's top bar offers a slot of its own and the strip moves there */
  function placeLive() {
    if (!$live) return;
    const home = document.getElementById('lbhome');
    if (home && $live.parentNode !== home) home.appendChild($live);
  }
  new MutationObserver(() => { if (!document.contains($live)) placeLive(); else if (!$live.closest('.lb-slot') && $main.querySelector('.lb-slot')) placeLive(); }).observe($main, { childList: true, subtree: true });
  document.addEventListener('rivl:rendered', () => { placeLive(); paintLive(); });
  document.addEventListener('rivl:polled', paintLive);
  V.paintLive = paintLive;
  /* Spotify's open and close. A tap on the live bar: the card grows into the full screen in the game's colours, the game
     page arrives under it and the colour gives way to it. Back (the arrow, or a swipe down on the hero): the page drops
     away downward and the screen you came from is already there, at the same scroll, with the bar back in its place. */
  (() => {
    let trip = null;   // where the game was opened from: the screen, its scroll, the bar's place
    const de = document.documentElement;
    const deep = c => `color-mix(in srgb,${c} 74%,#000)`;
    const EASE = 'cubic-bezier(.2,.9,.25,1)';   // Spotify's sheet: quick off the mark, a long soft landing
    // the game's data is asked for the moment a finger lands on the bar, so the page is ready by the time the sheet is up
    const warm = a => { try { const [lk, id] = a.dataset.lid.split(':'); const L = LEAGUES[lk]; if (L && HW.jSoft) HW.jSoft(`${HW.API(L)}/summary?event=${encodeURIComponent(id)}`, 60000); } catch { } };
    document.getElementById('livebar').addEventListener('pointerdown', e => { const a = e.target.closest('a.lg'); if (a) warm(a); }, { passive: true });
    /* open: a sheet in the game's colours slides up from the bar (transform only, so it never stutters), the screen behind
       dims, the game page lands under the sheet and the sheet lets go of it */
    document.getElementById('livebar').addEventListener('click', e => {
      const a = e.target.closest('a.lg'); if (!a || !MOTION()) return; e.preventDefault(); e.stopPropagation(); warm(a);
      const r = current || route(); const rc = a.getBoundingClientRect(); const ca = a.style.getPropertyValue('--ca'), ch = a.style.getPropertyValue('--ch');
      if ($main.dataset.real === '1' && V._snaps) V._snaps[r.lk + ':' + r.name] = $main.innerHTML;
      trip = { hash: location.hash || '#home', lk: r.lk, name: r.name, y: window.scrollY };
      const H = window.innerHeight;
      const dim = document.createElement('div'); dim.className = 'bardim'; document.body.appendChild(dim);
      const cv = document.createElement('div'); cv.className = 'barexp';
      cv.style.cssText = `transform:translate3d(0,${rc.top}px,0);border-radius:12px 12px 0 0;background:linear-gradient(112deg,${deep(ca)} 0%,${deep(ca)} 34%,${deep(ch)} 76%)`;
      document.body.appendChild(cv); void cv.offsetWidth;
      cv.style.transition = `transform 380ms ${EASE},border-radius 380ms ${EASE}`; dim.style.transition = `opacity 380ms ${EASE}`;
      cv.style.transform = 'translate3d(0,0,0)'; cv.style.borderRadius = '0'; dim.style.opacity = '1';
      setTimeout(() => { render.swipe = true; render.tapAt = performance.now(); location.hash = a.getAttribute('href'); dim.remove();
        const t0 = performance.now(); const wait = () => { const hero = document.getElementById('gxhero'); if ((hero && $main.dataset.real === '1') || performance.now() - t0 > 3000) { cv.style.transition = 'opacity 160ms linear'; cv.style.opacity = '0'; setTimeout(() => cv.remove(), 180); } else requestAnimationFrame(wait); }; requestAnimationFrame(wait); }, 380);
    }, true);
    /* lift: the screen you came from goes back under the game page, real and at its scroll, before the page moves at all, so a
       drag down shows it the way Spotify shows Home under the player. Undone if the drag is let go short. */
    let held = null;
    const lift = () => {
      if (held) return held; const gp = document.getElementById('gpage'); if (!trip || !gp) return null;
      const snap = V._snaps && V._snaps[trip.lk + ':' + trip.name]; if (!snap) return null;
      const wrap = document.createElement('div'); wrap.className = 'barclose'; document.body.appendChild(wrap);
      const gs = gp.querySelector('#gxscroll'), st = gs ? gs.scrollTop : 0; const kids = [...$main.childNodes]; const gy = window.scrollY;
      gp.style.transform = ''; wrap.appendChild(gp); if (gs) gs.scrollTop = st;
      $main.innerHTML = snap; stripsTo($main, stripMem.get(trip.name + '/' + trip.lk)); de.classList.remove('entity', 'gxon'); document.getElementById('top').hidden = false; window.scrollTo(0, trip.y);
      held = { wrap, gp, kids, gs, st, gy, t: trip }; return held;
    };
    const unlift = () => {   // let go short: everything goes back exactly as it was
      const h = held; held = null; if (!h) return;
      $main.replaceChildren(...h.kids.map(n => n === h.gp ? h.gp : n)); if (!h.gp.isConnected) $main.appendChild(h.gp);
      de.classList.add('entity', 'gxon'); document.getElementById('top').hidden = true; window.scrollTo(0, h.gy); if (h.gs) h.gs.scrollTop = h.st; h.wrap.remove();
    };
    const close = (dy0 = 0, v0 = 0) => {
      const h = lift();
      if (!h) { const gp = document.getElementById('gpage'); if (!trip || !gp) return false; trip = null; history.back(); return true; }
      held = null; const t = h.t; trip = null; const H = window.innerHeight; const wrap = h.wrap;
      wrap.style.transform = `translate3d(0,${dy0}px,0)`;
      render.swipe = true; render.tapAt = performance.now(); $main.dataset.hlk = t.lk;
      history.back();
      const ms = Math.round(Math.max(180, Math.min(340, v0 > .3 ? (H - dy0) / v0 : 320)));   // a flick keeps its speed
      requestAnimationFrame(() => { window.scrollTo(0, t.y); wrap.style.transition = `transform ${ms}ms ${v0 > .3 ? 'cubic-bezier(.25,.6,.4,1)' : EASE}`; wrap.style.transform = `translate3d(0,${H}px,0)`; setTimeout(() => wrap.remove(), ms + 30); });
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, t.y)));
      return true; };
    V.barTrip = () => trip; V.barClose = close; V.barHeld = () => !!held;
    window.addEventListener('hashchange', () => { if (trip && !/^#game\//.test(location.hash)) trip = null; });
    // a swipe down on the hero of a game opened from the bar: the page follows the finger, the screen you came from under it
    let y0 = null, dy = 0, vy = 0, ly = 0, lt = 0;
    document.addEventListener('touchstart', e => { const gp = document.getElementById('gpage'); y0 = null; if (!trip || !gp || e.touches.length > 1) return; const sc = document.getElementById('gxscroll'); if (sc && sc.scrollTop > 2) return; if (!e.target.closest('#gxhero, .gxbar, .gxspace')) return; y0 = e.touches[0].clientY; dy = 0; vy = 0; ly = y0; lt = performance.now(); }, { passive: true });
    const onMove = e => { if (y0 == null) return; const y = e.touches[0].clientY; dy = Math.max(0, y - y0); const now = performance.now(); if (now > lt) vy = vy * .5 + .5 * (y - ly) / (now - lt); ly = y; lt = now;
      if (dy > 4) { e.preventDefault(); const h = held || lift(); const el = h ? h.wrap : document.getElementById('gpage'); if (el) { el.style.transition = 'none'; el.style.transform = `translate3d(0,${dy}px,0)`; } } };
    /* a listener that can stop scrolling makes every scroll wait on it, so it is only attached while a game opened from the bar is on screen */
    let hooked = false; const hook = on => { if (on === hooked) return; hooked = on; if (on) document.addEventListener('touchmove', onMove, { passive: false }); else document.removeEventListener('touchmove', onMove, { passive: false }); };
    window.addEventListener('hashchange', () => hook(!!trip && /^#game\//.test(location.hash)));
    const end = () => { if (y0 == null) return; y0 = null;
      if (dy > 120 || (vy > .5 && dy > 20)) { close(dy, vy); return; }
      const h = held; const el = h ? h.wrap : document.getElementById('gpage'); if (!el) return;
      el.style.transition = `transform 260ms ${EASE}`; el.style.transform = 'translate3d(0,0,0)';
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; if (h) unlift(); }, 270); };
    document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  /* the performance log: hold the Settings title for a moment. Copy puts it on the clipboard for Ray. */
  (() => { let pt = 0; const open = () => { if (!HW.perf) return; const txt = HW.perf.text(); openPanel(`<div class="grab"></div><h2 style="margin:0 0 10px">Performance log</h2><p class="legend" style="margin:0 0 10px">Kept on this phone only. Long tasks, dropped frames during gestures, slow jobs.</p><div style="display:flex;gap:8px;margin:0 0 12px"><button class="btn" data-act="perfcopy">Copy</button><button class="btn" data-act="perfreset">Reset</button></div><pre class="perfpre" style="font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;color:var(--ink-2);margin:0">${esc(txt)}</pre>`, { full: true }); };
    document.addEventListener('click', e => { if (e.target.closest('[data-act="perfopen"]')) { e.preventDefault(); open(); } });
    document.addEventListener('click', e => { const a = e.target.closest('[data-act="perfcopy"],[data-act="perfreset"]'); if (!a) return; e.preventDefault(); if (a.dataset.act === 'perfreset') { HW.perf.reset(); closePanel(); toast('Log cleared'); return; } try { navigator.clipboard.writeText(HW.perf.text()).then(() => toast('Copied')); } catch { toast("Couldn't copy"); } });
  })();
  /* long-pressing a name or a card is not a link to share: no context menu on the app's own controls */
  document.addEventListener('contextmenu', e => { if (!e.target.closest('.reader .body, input, textarea')) e.preventDefault(); });

  /* ---------- delegated actions ---------- */
  function toast(msg) { $toast.textContent = msg; $toast.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => $toast.classList.remove('on'), Math.min(4000, 900 + String(msg).length * 30)); }   // short: a follow note is gone in about a second and a half   // a sentence needs longer on screen than a word
  V.toast = toast; V.rerender = () => render(); V.route = () => current;
  V.refreshAll = async () => { try { HW.cache.clear(); } catch { } await render(); poll(); };
  /* your icon, top left (it replaced the settings gear): your own photo when you've added one, otherwise your jersey in your
     team's colours with your number. Tapping it opens your profile and settings. */
  window.RIVL_avatar = () => {
    const photo = HW.store.get('v5:avatar', ''); if (photo) return `<img class="avimg" src="${esc(photo)}" alt="">`;
    const j = HW.store.get('v5:jlook', null) || { main: '#1D9BF0', trim: '#FFFFFF', ink: '#FFFFFF', num: '' };
    const nm = String(HW.store.get('v5:name', '') || '').trim(); const ch = (nm.charAt(0) || '').toUpperCase();
    // no photo: your first initial (or your number) in your team's colour, ringed in its second colour, so it reads as you
    return `<span class="avini" style="background:${esc(j.main)};color:${esc(j.ink)};box-shadow:inset 0 0 0 2px ${esc(j.trim)}">${esc(ch || String(j.num || '') || '+')}</span>`;
  };
  window.RIVL_paintAv = () => { const b = document.getElementById('avbtn'); if (!b) return; b.innerHTML = window.RIVL_avatar(); const j = HW.store.get('v5:jlook', null); b.style.setProperty('--avc', j && j.main || '#1D9BF0'); };
  window.RIVL_paintAv();
  /* tapping the league you're already on, like tapping X's tab again: back to that screen's start, at the top */
  $pills.addEventListener('click', e => { const a = e.target.closest('.pill.on'); if (!a) return; e.preventDefault(); document.dispatchEvent(new CustomEvent('rivl:retap', { detail: a.dataset.lk })); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  /* the side panel, like X's: your icon opens it, or drag the page to the right from anywhere. It follows your finger:
     the panel slides in from the left, the page is pushed along to the right and dims, and letting go settles it open or
     shut on the same curve. Your photo and name open your profile; the list holds what Settings holds. */
  (() => {
    const btn = document.getElementById('avbtn'); if (!btn) return;
    const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const ICO = { me: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'), teams: I('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
      players: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2 .7 3.5 2.4 3.5 5.3"/>'), bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
      tv: I('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>'),
      sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'), moon: I('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>') };
    const EASE = 'cubic-bezier(.32,.72,0,1)';
    let el = null, panel = null, bg = null, W = 300, p = 0;
    const pushed = () => ['main', 'hdr', 'tabs', 'lbhome'].map(id => document.getElementById(id)).filter(Boolean);
    const build = () => {
      if (el) return; const S = HW.store, name = S.get('v5:name', '') || 'Add your name', F = HW.favs.all(), nT = Object.values(F).reduce((a, x) => a + (x || []).length, 0), nP = V.fplayers ? V.fplayers.all().length : 0;
      const theme = S.get('v5:theme', 'system'), dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      el = document.createElement('div'); el.className = 'xdrawer';
      el.innerHTML = `<div class="xdbg"></div><nav class="xdp" aria-label="You and settings">
        <div class="xdtop"><a class="xdav avbtn" href="#settings/profile" aria-label="Your profile">${window.RIVL_avatar()}</a><button class="xdtheme" data-xd="theme" data-dark="${dark ? 1 : 0}" aria-label="Switch to ${dark ? 'light' : 'dark'} mode">${dark ? ICO.sun : ICO.moon}</button></div>
        <a class="xdme" href="#settings/profile"><b>${esc(name)}</b><span>Your profile</span></a>
        <div class="xdst"><a href="#teams"><b>${nT}</b> Teams</a><a href="#players"><b>${nP}</b> Players</a></div>
        <div class="xdnav"><a href="#settings/profile">${ICO.me}Profile</a><a href="#teams">${ICO.teams}Teams</a><a href="#players">${ICO.players}Players</a><a href="#settings/watch">${ICO.tv}Where you watch</a></div>
        <div class="xdsub"><a href="#settings/home">Display</a><a href="#settings/sync">Sync</a><a href="#settings/app">App</a><a href="#settings">All settings</a><a href="#settings/about">About and sources</a></div></nav>`;
      document.body.appendChild(el); panel = el.querySelector('.xdp'); bg = el.querySelector('.xdbg'); W = panel.offsetWidth || 300;
      const av = el.querySelector('.xdav'); const j = HW.store.get('v5:jlook', null); av.style.setProperty('--avc', j && j.main || '#1D9BF0');
      el.addEventListener('click', e => { const t = e.target.closest('[data-xd="theme"]'); if (t) { e.preventDefault(); HW.store.set('v5:theme', t.dataset.dark === '1' ? 'light' : 'dark'); applyTheme(); go(0); return; } if (e.target.closest('a') || e.target === bg) go(0); });
      // dragging the open panel back to the left
      let x0 = null, p0 = 1; panel.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; p0 = p; }, { passive: true });
      panel.addEventListener('touchmove', e => { if (x0 == null) return; set(Math.max(0, Math.min(1, p0 + (e.touches[0].clientX - x0) / W)), false); }, { passive: true });
      panel.addEventListener('touchend', () => { if (x0 == null) return; x0 = null; go(p > .6 ? 1 : 0); });
      bg.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; p0 = p; }, { passive: true });
      bg.addEventListener('touchmove', e => { if (x0 == null) return; set(Math.max(0, Math.min(1, p0 + (e.touches[0].clientX - x0) / W)), false); }, { passive: true });
      bg.addEventListener('touchend', () => { if (x0 == null) return; const moved = Math.abs(p - p0) > .02; x0 = null; go(moved ? (p > .6 ? 1 : 0) : 0); });
    };
    // p: 0 shut, 1 open. The panel, the dimming and the pushed page all move from this one number.
    const set = (v, ease) => { p = v; const tr = ease ? `transform .34s ${EASE}, translate .34s ${EASE}, opacity .34s ${EASE}` : 'none';
      panel.style.transition = tr; bg.style.transition = tr; panel.style.transform = `translate3d(${(p - 1) * 100}%,0,0)`; bg.style.opacity = String(p * .9);
      el.style.pointerEvents = p > 0 ? 'auto' : 'none';
      pushed().forEach(n => { n.style.transition = ease ? `translate .34s ${EASE}` : 'none'; n.style.translate = p ? `${(p * W * .82).toFixed(1)}px 0` : ''; }); };
    const go = v => { if (!el) build(); set(v, true); if (!v) setTimeout(() => { if (p === 0 && el) { el.remove(); el = null; pushed().forEach(n => { n.style.translate = ''; }); } }, 360); };
    btn.addEventListener('click', e => { e.preventDefault(); build(); requestAnimationFrame(() => go(1)); });
    window.addEventListener('hashchange', () => { if (el) go(0); });
    /* drag the page to the right, from anywhere on it, to pull the panel out (not on a strip that scrolls sideways, and only
       on the screens that show your icon) */
    const sideScroller = t => { for (let n = t; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 2) { const ox = getComputedStyle(n).overflowX; if (ox === 'auto' || ox === 'scroll') return true; } if (n.matches && n.matches('input,textarea,[type=range]')) return true; } return false; };
    /* one sideways drag, two jobs, the way X does it. The page follows the finger and the next league is already there
       beside it, sliding in attached (the last copy of that league's screen, or its skeleton the first time); the two
       league names cross-fade with the finger and the line under them travels and stretches 1:1. Past a quarter of the
       screen, or with a flick, it carries on; short of that both spring back. On the first league a drag to the right
       pulls out your profile instead. A tap on a league runs the same slide. */
    let sx = null, sy = 0, mode = '', vx = 0, lx = 0, lt = 0, W2 = window.innerWidth, from = null, to = null, curX = 0, peek = null, peekFor = null;
    const $m = document.getElementById('main'); const snaps = {}; V._snaps = snaps;
    const ready = {};   // copies of the leagues either side, built while the phone is idle so a drag never has to build one
    const idle = f => (window.requestIdleCallback || (g => setTimeout(g, 120)))(f, { timeout: 800 });
    const prebuild = () => { const r = current || route(); if (!r || !SCREENS.includes(r.name)) return; const i = ORDER.indexOf(r.lk);
      Object.keys(ready).forEach(k => { if (ready[k] && ready[k] !== peek) { ready[k].remove(); } delete ready[k]; });
      [ORDER[i - 1], ORDER[i + 1]].filter(Boolean).forEach(k => idle(() => { if (V.busy() || mode) { V.whenIdle(prebuild); return; } const r2 = current || route(); if (!r2 || r2.lk !== r.lk || r2.name !== r.name) return;
        const el2 = $m.cloneNode(false); el2.removeAttribute('id'); el2.classList.remove('hold', 'fade', 'enter', 'noanim'); el2.classList.add('xpeek'); el2.dataset.for = k + ':' + r.name;
        el2.innerHTML = snaps[k + ':' + r.name] || (V._ && V._.skeleton ? V._.skeleton(1, 'card') + V._.skeleton(4, 'row') : '');
        el2.style.cssText = 'position:fixed;left:0;width:100%;top:0;bottom:0;overflow:hidden;pointer-events:none;z-index:1;margin:0;visibility:hidden;transform:translate3d(200vw,0,0);will-change:transform;contain:layout paint';
        $m.parentNode.insertBefore(el2, $m.nextSibling); ready[k] = el2; })); };
    document.addEventListener('rivl:rendered', () => { const r = current || route(); if (r && SCREENS.includes(r.name) && $m.dataset.real !== '0') snaps[r.lk + ':' + r.name] = $m.innerHTML; if (peek && !render.swiping) { peek.remove(); peek = null; } if (!render.swiping) setTimeout(prebuild, 400); });
    const pillOf = k => $pills.querySelector(`.pill[data-lk="${k}"]`);
    const geo = k => { const pl = pillOf(k), sp = pl && pl.querySelector('span'); return sp ? { x: pl.offsetLeft + sp.offsetLeft - 10, w: sp.offsetWidth + 20 } : null; };
    const track = t => {   // t: 0 at the league you are on, 1 at the one the finger is heading to
      const a = geo(from), b = to && geo(to); if (!a) return;
      if (!b) { $pills.style.setProperty('--ux', (a.x + t * 14).toFixed(1) + 'px'); return; }
      $pills.style.setProperty('--ux', (a.x + (b.x - a.x) * t).toFixed(1) + 'px'); $pills.style.setProperty('--uw', (a.w + (b.w - a.w) * t).toFixed(1) + 'px');
      const pa = pillOf(from), pb = pillOf(to); if (pa) pa.style.setProperty('--on', (1 - t).toFixed(3)); if (pb) pb.style.setProperty('--on', t.toFixed(3)); };
    const clearTrack = () => { $pills.classList.remove('dragging'); $pills.querySelectorAll('.pill').forEach(p => p.style.removeProperty('--on')); };
    const makePeek = k => { if (peek && peekFor === k) return; if (peek && peek !== ready[peekFor]) peek.remove(); else if (peek) { peek.style.visibility = 'hidden'; peek.style.transform = 'translate3d(200vw,0,0)'; }
      const r = current || route(); const rc = $m.getBoundingClientRect();
      peek = ready[k] && ready[k].dataset.for === k + ':' + r.name ? ready[k] : null; peekFor = k;
      if (!peek) { peek = $m.cloneNode(false); peek.removeAttribute('id'); peek.classList.remove('hold', 'fade', 'enter', 'noanim'); peek.classList.add('xpeek'); const sn = snaps[k + ':' + r.name]; peek.innerHTML = sn || (V._ && V._.skeleton ? V._.skeleton(1, 'card') + V._.skeleton(4, 'row') : ''); if (sn) peek.dataset.for = k + ':' + r.name; else delete peek.dataset.for; $m.parentNode.insertBefore(peek, $m.nextSibling); }
      const mainTop = rc.top + window.scrollY, ny = scrollMem.get(r.name + '/' + k) || 0;   // where the next league will sit once it lands: its own scroll, the top bar drawn over it as on the real page
      peek.style.cssText = `position:fixed;left:${rc.left}px;width:${rc.width}px;top:${Math.max(0, mainTop - ny)}px;bottom:0;overflow:hidden;pointer-events:none;z-index:1;margin:0;will-change:transform;contain:layout paint;transform:translate3d(${rc.width}px,0,0)`;
      peek.scrollTop = Math.max(0, ny - mainTop); stripsTo(peek, stripMem.get(r.name + '/' + k)); };   // the next league shows where you left it, or its top
    /* a critically damped spring, the physics X and iOS use: it starts at the finger's own speed (px/ms) and settles on
       the target without overshoot, so letting go never changes the speed the page was moving at */
    let springRaf = 0;
    const spring = (x0, v0, target, onStep, onDone) => { cancelAnimationFrame(springRaf); const d = target - x0, sgn = Math.sign(d) || 1, sp = Math.max(0, v0 * sgn);
      // the duration that lets the page leave the finger at its own speed and come to rest with no lurch: slower fingers get a little longer, never past 420 ms
      const T = Math.max(170, Math.min(300, Math.abs(d) / Math.max(sp, .6) * 1.25)), t0 = performance.now();
      const step = now => { const u = Math.min(1, (now - t0) / T), u2 = u * u, u3 = u2 * u;
        const x = (2 * u3 - 3 * u2 + 1) * x0 + (u3 - 2 * u2 + u) * T * v0 + (-2 * u3 + 3 * u2) * target;   // a cubic that starts at the finger's place and speed, ends still on the target
        if (u >= 1) { onStep(target); onDone && onDone(); return; } onStep(x); springRaf = requestAnimationFrame(step); };
      springRaf = requestAnimationFrame(step); };
    const place = x => { $m.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`; if (peek) peek.style.transform = `translate3d(${(x + (x < 0 ? W2 : -W2)).toFixed(1)}px,0,0)`; };
    const springBack = (x0, v0) => { $m.style.transition = 'none'; if (peek) peek.style.transition = 'none'; $pills.classList.remove('dragging'); const pk = peek;
      spring(x0 || 0, v0 || 0, 0, x => { $m.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; if (pk) pk.style.transform = `translate3d(${(x + (x0 < 0 ? W2 : -W2)).toFixed(2)}px,0,0)`; track(Math.min(1, Math.abs(x) / W2)); },
        () => { peek = null; $m.style.transform = ''; $m.style.willChange = ''; if (pk) { if (Object.values(ready).includes(pk)) { pk.style.visibility = 'hidden'; pk.style.transform = 'translate3d(200vw,0,0)'; } else pk.remove(); } clearTrack(); const r = current || route(); paintPills(r.lk, true); }); };
    /* carry on to league k: the page leaves, the next slides fully in, then the real screen takes the copy's place */
    const slideTo = (k, dirL, ms, fromX = null, v0 = 0) => { const r0 = current || route(); from = from || r0.lk; to = k; if ($m.dataset.real === '1') snaps[r0.lk + ':' + r0.name] = $m.innerHTML; makePeek(k); W2 = window.innerWidth;
      render.swipe = true; render.swiping = true; render.gliding = true; render.tapAt = performance.now(); peek.style.visibility = '';
      const land = () => J('land', () => { $m.style.transition = 'none'; $m.style.transform = ''; $m.style.willChange = ''; const snap = snaps[k + ':' + r0.name];
        scrollMem.set(r0.name + '/' + r0.lk, window.scrollY); const ny = scrollMem.get(r0.name + '/' + k) || 0; render.memDone = true; render.keepHdr = ny > 4; render.hdrHold = true; if (ny <= 4 && V.showTop) V.showTop(); setTimeout(() => { render.hdrHold = false; }, 400);
        stripMem.set(r0.name + '/' + r0.lk, stripsOf($m));
        if (snap) { if (peek && peek.dataset.for === k + ':' + r0.name && peek.childNodes.length) $m.replaceChildren(...peek.childNodes); else $m.innerHTML = snap;   // the very nodes you were looking at slide into place: nothing is rebuilt or decoded again
          stripsTo($m, stripMem.get(r0.name + '/' + k)); window.scrollTo(0, ny); $m.dataset.hlk = k; location.hash = '#' + k; requestAnimationFrame(() => requestAnimationFrame(() => { render.swiping = false; if (peek) { peek.remove(); Object.keys(ready).forEach(q => { if (ready[q] === peek) delete ready[q]; }); peek = null; } clearTrack(); $pills.classList.remove('gliding'); render.gliding = false; V.flushIdle(); setTimeout(prebuild, 500); })); return; }
        $m.style.visibility = 'hidden'; location.hash = '#' + k; const done = () => { requestAnimationFrame(() => { render.swiping = false; $m.style.visibility = ''; if (peek) { peek.remove(); Object.keys(ready).forEach(k => { if (ready[k] === peek) delete ready[k]; }); peek = null; } clearTrack(); $pills.classList.remove('gliding'); render.gliding = false; V.flushIdle(); setTimeout(prebuild, 500); }); }; const t0 = performance.now(); const wait = () => { if ($m.dataset.real === '1' || performance.now() - t0 > 2500) done(); else requestAnimationFrame(wait); }; requestAnimationFrame(wait); });
      if (fromX != null) { $m.style.transition = 'none'; peek.style.transition = 'none'; $pills.classList.remove('dragging');
        spring(fromX, v0, dirL ? -W2 : W2, x => { $m.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; peek.style.transform = `translate3d(${(x + (dirL ? W2 : -W2)).toFixed(2)}px,0,0)`; track(Math.min(1, Math.abs(x) / W2)); }, land); return; }
      const T = `transform ${ms}ms cubic-bezier(.25,.8,.25,1)`; if (!dirL) peek.style.transform = `translate3d(${-W2}px,0,0)`; void peek.offsetWidth; $m.style.transition = T; peek.style.transition = T; $pills.classList.remove('dragging'); $pills.classList.add('gliding');
      requestAnimationFrame(() => { $m.style.transform = `translate3d(${dirL ? -W2 : W2}px,0,0)`; peek.style.transform = 'translate3d(0,0,0)'; track(1); });
      setTimeout(land, ms); };
    document.addEventListener('touchstart', e => { if (el || render.swiping || document.getElementById('top').hidden || document.documentElement.classList.contains('sheet-open') || e.touches.length > 1) { sx = null; return; }
      const t = e.touches[0]; if (sideScroller(e.target)) { sx = null; return; } sx = t.clientX; sy = t.clientY; mode = ''; W2 = window.innerWidth; }, { passive: true });
    document.addEventListener('touchmove', e => { if (sx == null) return; let t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (!mode) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sx = null; return; } if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        const r = current || route(); from = r.lk; const i = ORDER.indexOf(from);
        if (dx > 0 && i <= 0) { mode = 'drawer'; build(); }
        else { mode = 'league'; to = null; if ($m.dataset.real === '1') snaps[from + ':' + r.name] = $m.innerHTML; $pills.classList.add('dragging'); $m.classList.remove('fade', 'enter'); delete $m.dataset.dir; $m.style.transition = 'none'; $m.style.willChange = 'transform'; }
        lx = t.clientX; lt = performance.now(); vx = 0; sx = t.clientX - Math.sign(dx); dx = t.clientX - sx; }   // the drag starts from where it was recognised, so nothing jumps to catch up
      const now = performance.now(); if (now > lt) { vx = vx * .5 + .5 * (t.clientX - lx) / (now - lt); } lx = t.clientX; lt = now;
      if (mode === 'drawer') { set(Math.max(0, Math.min(1, dx / W)), false); return; }
      const i = ORDER.indexOf(from), want = ORDER[i + (dx < 0 ? 1 : -1)] || null;
      if (want !== to) { to = want; if (to) makePeek(to); else if (peek) { if (Object.values(ready).includes(peek)) { peek.style.visibility = 'hidden'; peek.style.transform = 'translate3d(200vw,0,0)'; } else peek.remove(); peek = null; } if (peek) { peek.style.transition = 'none'; peek.style.visibility = ''; } }
      const x = to ? dx : dx / 4; curX = x; place(x); track(to ? Math.min(1, Math.abs(dx) / W2) : (dx < 0 ? 1 : -1) * Math.min(1, Math.abs(dx) / W2) * .5); }, { passive: true });   // passive: the phone scrolls on its own and never waits on this (touch-action in the CSS keeps a sideways drag from scrolling)
    document.addEventListener('touchend', () => { if (!mode) { sx = null; return; } const m0 = mode; mode = ''; sx = null;
      if (m0 === 'drawer') { go(vx > .35 ? 1 : vx < -.35 ? 0 : (p > .4 ? 1 : 0)); return; }
      const cur = curX; curX = 0; const dirL = cur < 0;
      const commit = to && (Math.abs(cur) > W2 * .25 || (dirL ? vx < -.3 : vx > .3));
      if (!commit) { springBack(cur, vx); return; }
      // the rest of the way starts at exactly the finger's speed and settles, so release is seamless
      slideTo(to, dirL, 0, cur, vx); });
    document.addEventListener('touchcancel', () => { if (mode === 'league') springBack(curX, 0); mode = ''; sx = null; });
    /* a tap on the league you are already on, or the tab you are already on, glides back to the top the way X does:
       quick off the mark, a long soft landing, the top bar coming back with it */
    let topRaf = 0;
    const toTop = () => { cancelAnimationFrame(topRaf); const y0 = window.scrollY; if (V.showTop) V.showTop(); if (y0 <= 0) return;
      if (!MOTION()) { window.scrollTo(0, 0); return; }
      const T = Math.min(560, Math.max(280, 220 + y0 * .12)), t0 = performance.now(); const ease = u => 1 - Math.pow(1 - u, 4);
      const stop = () => { cancelAnimationFrame(topRaf); window.removeEventListener('touchstart', stop); };   // a finger on the screen stops it where it is
      window.addEventListener('touchstart', stop, { passive: true, once: true });
      const step = now => { const u = Math.min(1, (now - t0) / T); window.scrollTo(0, Math.round(y0 * (1 - ease(u)))); if (u < 1) topRaf = requestAnimationFrame(step); else stop(); };
      topRaf = requestAnimationFrame(step); };
    V.toTop = toTop;
    $pills.addEventListener('click', e => { const a = e.target.closest('.pill.on'); if (!a) return; e.preventDefault(); e.stopPropagation(); toTop(); }, true);
    document.getElementById('tabs').addEventListener('click', e => { const a = e.target.closest('a.tab.on, .tab.on'); if (!a) return; const r = current || route(); if (!r || !SCREENS.includes(r.name) && r.name !== 'search') return; if (window.scrollY > 0) { e.preventDefault(); e.stopPropagation(); toTop(); } }, true);
    /* a tap on another league: the same slide, from the side that league sits on */
    $pills.addEventListener('click', e => { const a = e.target.closest('.pill:not(.on)'); if (!a || render.swiping || !MOTION()) return; const r = current || route(); if (!r || !SCREENS.includes(r.name)) return;
      e.preventDefault(); from = r.lk; slideTo(a.dataset.lk, ORDER.indexOf(a.dataset.lk) > ORDER.indexOf(r.lk), 300); }, true);
  })();
  /* the top (your icon, the R, the leagues) behaves like X's: it slides up out of the way as you scroll down, following
     your finger, and slides back down the moment you scroll up. When you stop halfway it settles open or closed. */
  (() => {
    const hdr = document.getElementById('hdr'); if (!hdr) return; const phone = matchMedia('(max-width:1039px)');
    let off = 0, lastY = window.scrollY, idle = 0;
    let hH = 0; const hdrH = () => hH || (hH = hdr.offsetHeight); window.addEventListener('resize', () => { hH = 0; }); document.addEventListener('rivl:rendered', () => { hH = 0; });   // measured once, not on every scroll event
    const bar = document.getElementById('tabs');
    // the bottom bar moves with the top, the same share of its own height, so both leave and come back together
    const set = (v, ease) => { off = v; const tr = ease ? 'transform .22s cubic-bezier(.3,.7,.2,1)' : 'none'; hdr.style.transition = tr; hdr.style.transform = off ? `translate3d(0,${-off}px,0)` : '';
      /* the bottom bar and the live bar above it stay put while you scroll; only the top slides away */ };
    window.addEventListener('scroll', () => {
      if (!phone.matches) { if (off) set(0); return; }
      if (render.hdrHold || document.querySelector('#bsheet.on, .xpsheet.in, .xdrawer.in')) { lastY = window.scrollY; return; }   // a swipe landing at the league's own scroll is not you scrolling   // a sheet or the side panel is open: the bars stay put
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { lastY = window.scrollY; return; }   // the bottom bounce never counts as scrolling up
      const y = Math.max(0, window.scrollY), H = hdrH(), dy = y - lastY; lastY = y;
      set(Math.min(H, Math.max(0, Math.min(off + dy, y))), false);
      clearTimeout(idle); idle = setTimeout(() => { const h = hdrH(); if (off > 0 && off < h) set(off > h / 2 && window.scrollY > h ? h : 0, true); }, 140);
    }, { passive: true });
    // a new screen always starts with the top showing
    V.showTop = () => set(0, true);
    let hk = ''; document.addEventListener('rivl:rendered', () => { lastY = window.scrollY; const r = V.route && V.route(); const k = r ? r.name + '/' + (r.args || []).join('/') : ''; const keep = render.keepHdr; render.keepHdr = false; if (k === hk || keep) { hk = k; return; } hk = k; set(0, true); });   // a refresh of the same screen, or a league swipe, leaves the top where it is
  })();
  const flwHTML = (on, what) => window.RIVL_flw(on, what);
  document.addEventListener('click', e => {
    render.tapAt = performance.now();   // a move that follows a tap is ours to animate; one without a tap was the phone's own swipe
    const back = e.target.closest('[data-act="back"]');
    if (back) { if (V.barTrip && V.barTrip() && /^#game\//.test(location.hash)) { e.preventDefault(); V.barClose(0); return; } if (history.length > 1) { e.preventDefault(); history.back(); } return; }
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
      if (act.classList.contains('flw')) { act.innerHTML = flwHTML(on, 'player'); act.setAttribute('aria-label', (on ? 'Unfollow ' : 'Follow ') + (snap.name || '')); }
      else if (act.classList.contains('prow')) { const st = act.querySelector('.star'); if (st) { st.classList.toggle('on', on); st.innerHTML = on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`; } }   // a setup row: the row is the button, only its star changes
      else if (act.classList.contains('star')) { act.innerHTML = on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`; act.setAttribute('aria-label', (on ? 'Unfollow ' : 'Follow ') + (snap.name || '')); }
      else act.innerHTML = (on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`) + (on ? 'Following' : 'Follow');
      if (!act.classList.contains('flw')) toast(on ? `Following ${snap.short || snap.name}` : `Unfollowed ${snap.short || snap.name}`); else { act.classList.remove('pop'); void act.offsetWidth; act.classList.add('pop'); }
      $main.dispatchEvent(new CustomEvent('rivl:follow')); $panel.dispatchEvent(new CustomEvent('rivl:follow')); document.dispatchEvent(new CustomEvent('rivl:follow'));
    }
    if (a === 'mix') {
      e.preventDefault();
      const want = act.dataset.mix;
      $main.querySelectorAll('[data-act="mix"]').forEach(b => { const on = b.dataset.mix === want; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-selected', String(on)); });
      $main.querySelectorAll('[data-mix-panel]').forEach(p => { const on = p.dataset.mixPanel === want; if (on && p.hidden) { p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); } p.hidden = !on; });   // the new panel slides in
    }
    /* Add to calendar: a plain .ics file the phone opens in its own calendar; no account, nothing sent anywhere */
    if (a === 'ics') { e.preventDefault(); const st = new Date(act.dataset.start); if (isNaN(st)) return; const en = new Date(st.getTime() + 150 * 60000); const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RIVL//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@rivl`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(st)}`, `DTEND:${f(en)}`, `SUMMARY:${act.dataset.title}`, act.dataset.loc ? `LOCATION:${act.dataset.loc.replace(/,/g, '\\,')}` : '', `URL:${location.href}`, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
      const blob = new Blob([ics], { type: 'text/calendar' }); const url = URL.createObjectURL(blob); const a2 = document.createElement('a'); a2.href = url; a2.download = `${act.dataset.title.replace(/[^\w]+/g, '-')}.ics`; document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return; }
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
    if (a === 'sync-up') { e.preventDefault(); V.sync.up().then(code => { toast(`Backed up as ${code}`); render(); }).catch(() => toast("The server didn't answer")); }
    if (a === 'sync-down') { e.preventDefault(); const inp = document.getElementById('syncCode'); const code = inp && inp.value.trim(); if (!code || code.length !== 6) { toast('Enter the six-character code'); return; } V.sync.down(code).then(() => { toast('Restored'); location.hash = '#home'; location.reload(); }).catch(() => toast('No backup under that code')); }
    if (a === 'accent') { e.preventDefault(); store.set('v5:accent', act.dataset.accent); applyAccent(); $main.querySelectorAll('[data-act="accent"]').forEach(b => { const on = b.dataset.accent === act.dataset.accent; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); }
    if (a === 'fav') {
      e.preventDefault();
      const on = HW.favs.toggle(act.dataset.lk, act.dataset.id);
      act.setAttribute('aria-pressed', String(on)); act.classList.toggle('on', on);
      const star = on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`;
      // a setup tile keeps its logo, name and record; only its check changes. Stars and the hero button redraw.
      if (act.classList.contains('flw')) act.innerHTML = flwHTML(on, 'team');
      else if (!act.classList.contains('onb-team')) act.innerHTML = act.classList.contains('star') ? star : star + (on ? 'Following' : 'Follow');
      if (!act.classList.contains('flw')) toast(on ? `Following ${act.dataset.name || 'team'}` : `Unfollowed ${act.dataset.name || 'team'}`); else { act.classList.remove('pop'); void act.offsetWidth; act.classList.add('pop'); }
      $main.dispatchEvent(new CustomEvent('rivl:fav')); $panel.dispatchEvent(new CustomEvent('rivl:fav')); document.dispatchEvent(new CustomEvent('rivl:fav'));
    }
    if (a === 'expand') { e.preventDefault(); $main.querySelectorAll(`[data-more="${act.dataset.more}"]`).forEach(el => { el.hidden = false; }); act.remove(); }
    if (a === 'stab') { e.preventDefault(); store.set('v5:stab:' + (current ? current.lk : 'nba'), act.dataset.tab); render(); }
    if (a === 'play') { e.preventDefault(); openSheet(act.dataset.vid); }
    if (a === 'injury') { e.preventDefault(); openInjury(act.dataset.key); }
    if (a === 'bsheet-close') { e.preventDefault(); closeSheet7(); const to = act.getAttribute('href'); if (to && to.startsWith('#')) location.hash = to; }
    if (a === 'ijtoggle') { e.preventDefault(); const c = act.closest('.ijc'); if (c) { const min = !c.classList.contains('min'); c.classList.toggle('min', min); const m = store.get('ij:min', {}) || {}; if (min) m[c.dataset.pid] = 1; else delete m[c.dataset.pid]; store.set('ij:min', m); } }
    if (act.dataset.ijopen) { const m = store.get('ij:min', {}) || {}; delete m[act.dataset.ijopen]; store.set('ij:min', m);
      /* opening a player from an injury report lands on their injury write-up, not the top of the page */
      const pid = act.dataset.ijopen, t0 = Date.now();
      const seek = () => { const card = document.querySelector(`#injury[data-pid="${CSS.escape(pid)}"]`), box = document.getElementById('gxscroll');
        if (card && box) { requestAnimationFrame(() => box.scrollTo({ top: Math.max(0, box.scrollTop + card.getBoundingClientRect().top - 150), behavior: 'smooth' })); return; }
        if (Date.now() - t0 < 6000) setTimeout(seek, 120); };
      setTimeout(seek, 250); }
    if (a === 'official') { e.preventDefault(); openOfficial(act.dataset.key); }
    if (a === 'gifold') { e.preventDefault(); V._.foldToggle(act, act.getAttribute('aria-expanded') !== 'true'); return; }
    if (a === 'injcol') { e.preventDefault(); const open = act.getAttribute('aria-expanded') !== 'true'; V._.foldToggle(act, open); const c = store.get('v5:injcol', {}) || {}; if (open) delete c[act.dataset.id]; else c[act.dataset.id] = true; store.set('v5:injcol', c); }
    // a conference bar in setup: fold it, and remember which ones this device leaves open
    if (a === 'onbsec') { e.preventDefault(); const open = act.getAttribute('aria-expanded') !== 'true'; V._.foldToggle(act, open); const s = store.get('v5:onbsec', {}) || {}; s[act.dataset.sec] = open ? 1 : 0; store.set('v5:onbsec', s); return; }
    if (a === 'reload') { e.preventDefault(); render(); }
    if (a === 'onb-next') { e.preventDefault(); onbLk = 'nba'; onbStep(+act.dataset.step); }
    if (a === 'onb-welcome') { e.preventDefault(); onbWelcome(); }
    if (a === 'onb-lk') { e.preventDefault(); onbLk = act.dataset.lk; onbStep(+(act.dataset.step || 0)); }
    if (a === 'onb-done') { e.preventDefault(); store.set('v5:onboarded', true); store.set('v5:lk', 'nba'); store.set('v5:screen', 'home'); closePanel(); if (location.hash !== '#home') location.hash = '#home'; else render(); }
    if (a === 'install') { e.preventDefault(); install(); }
    if (a === 'install-later') { e.preventDefault(); store.set('v5:installDismissed', Date.now()); const b = document.getElementById('installBar'); if (b) b.remove(); }
    if (a === 'wire-more') { e.preventDefault(); const w = act.closest('.wire2'); const on = !w.classList.contains('open'); w.classList.toggle('open', on); act.setAttribute('aria-expanded', String(on)); act.textContent = on ? 'Less' : '+' + w.querySelectorAll('.w2it').length; return; }
    if (a === 'wire-x') { e.preventDefault(); const ids = (act.dataset.ids || '').split(',').filter(Boolean); const seen = store.get('v5:wire:seen', []) || []; store.set('v5:wire:seen', [...new Set([...ids, ...seen])].slice(0, 80)); const sec = act.closest('section'); if (sec) sec.remove(); return; }
    if (a === 'scmine') { e.preventDefault(); store.set('v5:scmine', !store.get('v5:scmine', false)); render(); return; }
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
  { let y0 = null, dy = 0; const pin = () => $panel.querySelector('.panel-in');
    $panel.addEventListener('touchstart', e => { const p = pin(); if (!p || !p.querySelector('.grab') || p.scrollTop > 0 || e.touches.length !== 1) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; p.style.transition = 'none'; }, { passive: true });
    $panel.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); const p = pin(); if (p) p.style.transform = dy ? `translateY(${dy}px)` : ''; }, { passive: true });
    $panel.addEventListener('touchend', () => { if (y0 == null) return; const p = pin(); y0 = null; if (!p) return; p.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'; if (dy > 90) { p.style.transform = 'translateY(100%)'; setTimeout(() => { closePanel(); p.style.transform = ''; p.style.transition = ''; }, 200); } else { p.style.transform = ''; setTimeout(() => { p.style.transition = ''; }, 230); } dy = 0; }, { passive: true }); }

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
      <p class="cal-f"><i class="dot"></i> your teams play${counted ? ' · numbers are games that day' : ' · <u></u> games that day'}${note ? ` · ${esc(note)}` : ''}</p>`;
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
  /* v7's bottom sheet, as built there: it rises on a long soft curve while the page behind dims; it follows your finger when you
     pull it down, the dimming easing off with it; a pull past a third of a hand (or a quick flick) sends it away, less springs back */
  function openSheet7(html) {
    let el = document.getElementById('bsheet'); if (!el) { el = document.createElement('div'); el.id = 'bsheet'; el.hidden = true; document.body.appendChild(el); }
    clearTimeout(openSheet7.t); el.className = 'bottom'; el.innerHTML = '<div class="scrim" data-act="bsheet-close"></div><div class="bpanel">' + html + '</div>';
    el.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on'))); document.body.classList.add('noscroll');
    const pn = el.querySelector('.bpanel'), sc = el.querySelector('.scrim'); let y0 = 0, t0 = 0, dy = 0, on = false;
    pn.addEventListener('touchstart', e => { if (pn.scrollTop > 0) return; on = true; y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; pn.style.transition = 'none'; sc.style.transition = 'none'; }, { passive: true });
    pn.addEventListener('touchmove', e => { if (!on) return; dy = e.touches[0].clientY - y0; if (dy < 0) dy = dy / 6; pn.style.transform = `translateY(${dy}px)`; sc.style.opacity = String(Math.max(0, 1 - dy / (pn.offsetHeight || 500))); }, { passive: true });
    pn.addEventListener('touchend', () => { if (!on) return; on = false; const v = dy / Math.max(1, Date.now() - t0);
      if (dy > 110 || v > .55) { pn.style.transition = 'transform .32s cubic-bezier(.32,.72,0,1)'; pn.style.transform = 'translateY(105%)'; sc.style.transition = 'opacity .32s'; sc.style.opacity = '0'; openSheet7.t = setTimeout(() => { el.classList.remove('on'); document.body.classList.remove('noscroll'); el.hidden = true; el.innerHTML = ''; }, 320); }
      else { pn.style.transition = ''; pn.style.transform = ''; sc.style.transition = ''; sc.style.opacity = ''; } });
  }
  function closeSheet7() { const el = document.getElementById('bsheet'); if (!el || el.hidden) return; const pn = el.querySelector('.bpanel'), sc = el.querySelector('.scrim');
    if (pn) { pn.style.transition = ''; pn.style.transform = ''; } if (sc) { sc.style.transition = ''; sc.style.opacity = ''; }
    el.classList.remove('on'); document.body.classList.remove('noscroll'); clearTimeout(openSheet7.t); openSheet7.t = setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 500); }
  function openInjury(key) {
    const rec = S.injuries && S.injuries[key]; if (!rec) return;
    const { x, team } = rec; const at = x.athlete || {}; const det = x.details || {}; const st = x.status || '';
    const lk = current ? current.lk : 'nba'; const L = LEAGUES[lk];
    const id = rec.id || V._.athId(at);
    const cls = /out/i.test(st) ? 'out' : /day|quest|doubt/i.test(st) ? 'q' : /prob|avail/i.test(st) ? 'ok' : '';
    const what = [det.type, det.detail && det.detail !== det.type ? det.detail : '', det.side && det.side !== 'Not Specified' ? det.side.toLowerCase() : '', det.location && det.location !== det.type ? det.location : ''].filter(Boolean).join(', ');
    const ret = V._.retInfo(L, det.returnDate);
    const rows = [['Status', `<span class="tag ${cls}">${esc(String(st || '').replace(/\bDay[- ]To[- ]Day\b/i, 'Day to day').replace(/\bGame Time Decision\b/i, 'Game-time decision'))}</span>`], ['Injury', esc(what || '—')], ['Reported', x.date ? esc(new Date(x.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: HW.TZ })) : ''], ['Expected back', ret ? esc(ret.long) : (/out/i.test(st) ? 'No date given' : '')], ['Fantasy', det.fantasyStatus && det.fantasyStatus.description ? esc(det.fantasyStatus.description) : '']].filter(([, v]) => v);
    const note = x.longComment || x.shortComment || '';
    const ib = V._.injBody(L, x, false); const tl = team.logo || (team.id && HW.S && HW.S.tIdx && HW.S.tIdx[team.id] && HW.S.tIdx[team.id].logo) || '';
    const who = `${V._.headshot(V._.hsUrl(at) || at.headshot || '', V._.teamColor(team, L), 56, at.displayName)}<span><b>${esc(at.displayName || '')}</b><em>${tl ? V._.imgSized(tl, 48, 48) : ''}${esc(team.short || '')}</em></span>`;
    openSheet7(`<i class="grab" aria-hidden="true"></i>
      <div class="ijs st-${ib.cls}">${id ? `<a class="ijwho" href="#player/${lk}/${esc(id)}" data-act="bsheet-close" data-ijopen="${esc(id)}" aria-label="Open ${esc(at.displayName || '')}'s profile">${who}<i class="chev">›</i></a>` : `<div class="ijwho">${who}</div>`}${ib.html}
      <p class="xnote">${x.date ? `Updated ${esc(new Date(x.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: HW.TZ }))} · ` : ''}From the league injury report, through ESPN</p></div>`);
  }

  /* ---------- theme: match the phone, or force dark or light ---------- */
  function applyTheme() {
    const t = store.get('v5:theme', 'system'); const root = document.documentElement;
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
    const root = document.documentElement; const mode = store.get('v5:accent', 'mono');
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
  /* Where you are in setup, in the footer bar on every screen: a slot per step, a knob that slides to the one you are on,
     the ones behind it filled, and "Step 2 of 4". On the welcome the knob is not out yet: the track is empty and reads
     "4 steps"; it appears on the first step and slides from there. The home-screen step only counts when there is one. */
  const onbSteps = () => standalone() ? ['Teams', 'Players', 'Home'] : ['Teams', 'Players', 'Home', 'Install'];
  const onbProg = cur => { const t = onbSteps().length; const k = Math.max(0, Math.min(cur, t - 1)); const pre = cur < 0; const label = pre ? `${t} steps` : `Step ${k + 1} of ${t}`;
    return `<span class="onb-prog${pre ? ' pre' : ''}" style="--i:${k};--n:${t}" role="img" aria-label="${label}"><span class="pd">${Array.from({ length: t }, (_, i) => `<i class="${!pre && i < k ? 'd' : ''}"></i>`).join('')}<u></u></span><span class="ps">${label}</span></span>`; };
  const onbSlot = `<span class="onb-slot" aria-hidden="true"></span>`;
  /* One bar for the whole of setup. Each screen is drawn fresh, but the bar from the screen before is kept and patched: the
     knob's position changes as a style, so it slides; the label crossfades; Back appears or goes; the step button is
     swapped. The new screen's content slides in from the side it came from. */
  let onbAt = -1;
  function onbOpen(html, n) {
    const was = !$panel.hidden && $panel.querySelector('.onb'); const kept = was ? was.querySelector('.onb-bar') : null; const dir = was ? (n > onbAt ? 'f' : 'b') : '';
    openPanel(html, { full: true });
    const root = $panel.querySelector('.onb');
    if (kept) {
      const fresh = root.querySelector('.onb-bar'); fresh.replaceWith(kept);
      void kept.offsetWidth;   // a node put back in the page has no style to move from: lay it out as it was, then change it, so the knob slides rather than lands
      const np = fresh.querySelector('.onb-prog'), op = kept.querySelector('.onb-prog');
      const od = op.querySelectorAll('.pd i'), nd = np.querySelectorAll('.pd i');
      if (od.length !== nd.length) op.replaceWith(np);
      else {
        op.style.setProperty('--i', np.style.getPropertyValue('--i')); op.classList.toggle('pre', np.classList.contains('pre')); op.setAttribute('aria-label', np.getAttribute('aria-label'));
        od.forEach((d, i) => { d.className = nd[i].className; });
        const ol = op.querySelector('.ps'), nl = np.querySelector('.ps').textContent;
        if (ol.textContent !== nl) { ol.classList.remove('swap'); void ol.offsetWidth; ol.textContent = nl; ol.classList.add('swap'); }
      }
      const ob = kept.firstElementChild, nb = fresh.firstElementChild;
      if (ob.tagName !== nb.tagName) { ob.replaceWith(nb); nb.classList.add('pop'); } else if (nb.tagName === 'BUTTON') { ob.dataset.act = nb.dataset.act; if (nb.dataset.step) ob.dataset.step = nb.dataset.step; else delete ob.dataset.step; }
      kept.lastElementChild.replaceWith(fresh.lastElementChild);
    }
    if (dir) { root.classList.add(`slide-${dir}`); root.addEventListener('animationend', () => root.classList.remove('slide-f', 'slide-b'), { once: true }); }
    onbAt = n;
  }
  /* The first thing a new person sees: the lockup large and lifted on a lit ground, what RIVL is in a line, the steps ahead
     as a stack of raised cards with the first one forward, and the bar that stays for the rest of setup. Black and white;
     the only colour in setup is the teams you pick. */
  function onbWelcome() {
    const rows = [['Pick your teams', 'NBA, WNBA and college'], ['Follow players', 'From your teams or anyone'], ['Set up Home', 'Choose what you see first'], ['Add to your home screen', 'Opens full screen, like an app']].slice(0, onbSteps().length);
    onbOpen(`<div class="onb welcome"><div class="wstage"><div class="onb-logo">${onbMark}</div><h2>Your teams.<br>Nothing else.</h2><p>Scores, stats and news for the teams and players you follow.</p></div><label class="onb-name"><span>What should we call you?</span><input id="onbName" type="text" maxlength="24" autocomplete="given-name" autocapitalize="words" placeholder="Your first name" value="${esc(store.get('v5:name', '') || '')}" oninput="HW.store.set('v5:name', this.value.trim())"></label><div class="wset"><p class="wlab">Set up in ${rows.length === 3 ? 'three' : 'four'} steps</p><ol class="wrows">${rows.map(([t, b], i) => `<li class="${i ? '' : 'on'}"><i>${i + 1}</i><span><b>${t}</b><span>${b}</span></span></li>`).join('')}</ol></div><div class="onb-foot"><div class="onb-bar">${onbSlot}${onbProg(-1)}<button class="btn" data-act="onb-next" data-step="0">Start${arrow}</button></div></div></div>`, -1);
  }
  async function onbStep(n) {
    const lk = lkOf(onbLk); const L = LEAGUES[lk];
    const countFor = k => n === 1 ? V.fplayers.all().filter(p => p.lk === k).length : (HW.favs.all()[k] || []).length;
    const leaguePills = `<div class="pills onb-pills" style="--n:${ORDER.length};--i:${Math.max(0, ORDER.indexOf(lk))}">${ORDER.map(k => `<button class="pill${k === lk ? ' on' : ''}" data-act="onb-lk" data-lk="${k}" data-step="${n}"><span>${esc(LEAGUES[k].label)}</span>${countFor(k) ? `<span class="ct">${countFor(k)}</span>` : ''}</button>`).join('')}</div>`;
    const frame = (title, body, inner, foot) => {
      /* a league change on the pick steps swaps the list in place: the switch moves at once and the old list stays until the new
         one is ready, so a tap never shows a blank step or a frozen knob */
      const cur = !$panel.hidden && $panel.querySelector('.onb');
      if (cur && cur.dataset.step === String(n) && (n === 0 || n === 1)) {
        const pills = cur.querySelector('.onb-pills'); if (pills) { pills.style.setProperty('--i', Math.max(0, ORDER.indexOf(lk))); pills.querySelectorAll('.pill').forEach(p => p.classList.toggle('on', p.dataset.lk === lk)); }
        const host = cur.querySelector('.onb-body'); if (host) { const keep = host.querySelector('.onb-pills'); host.innerHTML = inner; const fresh = host.querySelector('.onb-pills'); if (keep && fresh) fresh.replaceWith(keep); }   // the same switch stays, so its knob slides
        return;
      }
      /* Setup is a full-screen panel, so the warning bar on Home is behind it — and setup is exactly where someone in a
         private window is about to pick thirty teams that will not be kept. It has to be said here. */
      const noSave = store.broken() ? `<p class="legend warn">This browser isn't saving anything. Private browsing blocks it. Whatever you pick here will be gone when you close the tab.</p>` : '';
      onbOpen(`<div class="onb" data-step="${n}"><h2>${title}</h2><p>${body}</p>${noSave}<div class="onb-body">${inner}</div><div class="onb-foot"><div class="onb-bar">${foot}</div></div></div>`, n);
    };
    if (n === 0 || n === 1) {
      const nn = n === 0 ? ORDER.reduce((c, k) => c + (HW.favs.all()[k] || []).length, 0) : V.fplayers.all().length;
      frame(n === 0 ? 'Pick your teams' : 'Follow some players', n === 0 ? 'Switch leagues above. Your picks are kept for each. Your teams lead Home and are the only ones you get updates about.' : 'Switch leagues above. These are the rosters of the teams you picked; search any team to see its roster.',
        n === 0 ? `${leaguePills}<div id="onbPicked" class="onb-picked"></div><div class="search" style="margin:0 0 12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="onbq" type="search" placeholder="Search teams" autocomplete="off"></div><div id="onbList" class="onb-list">${Array.from({ length: 6 }, () => '<div class="skel row" style="margin:0 0 8px"></div>').join('')}</div>`
          : `${leaguePills}<div id="onbPicked" class="onb-picked"></div><div id="onbPick" class="onb-list">${Array.from({ length: 6 }, () => '<div class="skel row" style="margin:0 0 8px"></div>').join('')}</div>`,
        /* the button names where it goes. "Continue" next to a row of leagues read as "continue to the next league", which it
           never was — the switch changes league, the button changes step. Back exists from the second step on. */
        `${backBtn(n ? `data-act="onb-next" data-step="${n - 1}"` : 'data-act="onb-welcome"')}${onbProg(n)}<button class="btn" data-act="onb-next" data-step="${n + 1}" id="onbNext">${n ? 'Next: Home' : 'Next: players'}${arrow}</button>`);
      if (n === 1) { onbCount(); await V.playerPicker(document.getElementById('onbPick'), L, { leaders: true, select: true }); onbCount(); return; }
      const list = document.getElementById('onbList'); const inp = document.getElementById('onbq');
      if (n === 0) {
        /* every team in the league. Pro leagues are one alphabetical grid; college is the AP Top 25 first, then each
           conference A to Z with its teams alphabetical, because 360 tiles in one wall is not a list anyone can use. */
        const [idx, st, R] = await Promise.all([V.teamsIndex(L), HW.standings(L).catch(() => null), HW.rankings(L).catch(() => null)]); const pal = V._.distinctPalette(L, idx);
        const byShort = (a, b) => (a.short || a.name || '').localeCompare(b.short || b.name || '');
        const tile = (id, rank) => { const t = idx[id] || {}; const r = st && st.byId && st.byId[id]; return { id, short: t.short || (r && r.short) || t.name || (r && r.name) || '', name: t.name || (r && r.name) || '', abbr: t.abbr || (r && r.abbr) || '', logo: t.logo || (r && r.logo) || '', color: pal[id] || V._.teamColor({ id, abbr: t.abbr || (r && r.abbr) || '' }, L) || '', alt: V._.teamAlt({ id, abbr: t.abbr || (r && r.abbr) || '', alt: t.alt || '' }, L) || '', rec: r ? `${r.w}-${r.l}` : '', rank: rank || 0 }; };
        const seen = new Set(); const groups = [];
        /* ESPN's college standings put some schools in more than one group — a conference and a division of it — so a team
           could be drawn twice. Each conference keeps only the first claim on a team, and no group repeats one internally.
           The ranked group is deliberately a second home for its teams; the note inside it says so. */
        const once = rows => { const got = new Set(); return rows.filter(r => r && r.id && !got.has(r.id) && got.add(r.id)); };
        if (L.standingsMode === 'conferences' && st && st.groups.length) {
          if (R && R.ranks && R.ranks.length) groups.push({ name: R.name || 'Top 25', note: 'Also listed under their conference.', rows: once(R.ranks.map(x => tile(String(x.team.id), x.rank))) });
          st.groups.slice().sort((a, b) => V._.confName(a.name, a.abbr).localeCompare(V._.confName(b.name, b.abbr))).forEach(g => { const rows = once(g.rows.filter(r => !seen.has(r.id)).map(r => { seen.add(r.id); return tile(r.id); })).sort(byShort); if (rows.length) groups.push({ name: V._.confName(g.name, g.abbr), rows }); });
          const rest = once(Object.keys(idx).filter(id => !seen.has(id)).map(id => tile(id))).sort(byShort); if (rest.length) groups.push({ name: 'Other', rows: rest });
        } else groups.push({ name: '', rows: once(Object.keys(idx).map(id => tile(id))).sort(byShort) });
        /* 360 college teams in one wall is not a list anyone can use, so each conference is a full-width bar that folds its
           own grid. The ranked group leads and stays open; the conferences start closed, so the whole league fits on a screen
           and you open the one you want. A search opens every section that still has a match, without disturbing the saved
           state. Pro leagues are one unnamed alphabetical group of thirty — nothing to section, so nothing folds. */
        const secKey = name => `${lk}:${name}`;
        const secOpen = (name, first) => { const s = store.get('v5:onbsec', {}) || {}; const v = s[secKey(name)]; return v === undefined ? first : !!v; };
        const paint = () => {
          const q = inp.value.trim().toLowerCase();
          const html = groups.map((g, gi) => {
            const rows = g.rows.filter(tm => !q || `${tm.name} ${tm.short} ${tm.abbr} ${g.name}`.toLowerCase().includes(q));
            if (!rows.length) return '';
            /* eager, at low priority: a crest inside a closed fold would otherwise not be fetched until the fold opened,
               so every conference popped in blank and then filled. They load quietly up front, the service worker keeps
               them, and the section is already drawn when you open it — with or without a signal the second time. */
            const grid = `<div class="onb-grid">${rows.map(tm => { const on = HW.favs.has(lk, tm.id); return `<button class="onb-team${on ? ' on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(tm.id)}" data-name="${esc(tm.short)}" aria-pressed="${on}"${tm.color ? ` style="${V._.tcv(tm.color, tm.alt)}"` : ''}><span class="logo">${V._.imgSized(tm.logo || '', 128, 128, 'loading="eager" fetchpriority="low" decoding="async"')}</span><b>${esc(tm.short)}</b><span>${tm.rank ? `<em>No. ${tm.rank}</em>` : ''}${esc(tm.rec)}</span><i></i></button>`; }).join('')}</div>`;
            const body = g.note ? `<p class="onb-note">${esc(g.note)}</p>${grid}` : grid;
            if (!g.name) return grid;
            const open = q ? true : secOpen(g.name, gi === 0);
            return `<button class="onb-sec" data-act="onbsec" data-sec="${esc(secKey(g.name))}" aria-expanded="${open}"><b>${esc(g.name)}</b><span>${rows.length}</span>${V._.chev}</button><div class="fold${open ? '' : ' closed'}"><div>${body}</div></div>`;
          }).join('');
          list.innerHTML = html || `<div class="empty"><b>No team matches</b><p style="margin:6px 0 0">Try the school, the nickname or the conference.</p></div>`;
          onbCount();
        };
        paint(); inp.addEventListener('input', paint);
      }
    } else if (n === 2) {
      const P = V.prefs.all();
      const items = [['brief', 'Tonight and last night', "Your teams' games in one line, and last night's results"], ['live', 'Live now', 'A big card when one of your teams is playing'], ['teams', 'My teams', 'Record, the game that matters and the chance to win'], ['players', 'My players', 'Scoring lines, one tap to the profile'], ['injuries', 'Injuries', 'Reports on your teams and players'], ['news', 'News', 'Stories about your teams and players'], ['forecast', 'Win chances', "RIVL's own estimate on each game card"]];
      frame('What do you want to see?', 'Home is yours. Switch off anything you don\'t care about; you can change it later in Settings.',
        `<div class="rows onb-prefs">${items.map(([k, t, b]) => `<button class="row sw" data-act="pref" data-pref="${k}" role="switch" aria-checked="${P[k] !== false}"><span class="t"><b>${esc(t)}</b><span class="wrap">${esc(b)}</span></span><span class="switch"></span></button>`).join('')}</div>`,
        `${backBtn('data-act="onb-next" data-step="1"')}${onbProg(2)}<button class="btn" data-act="onb-next" data-step="3">${standalone() ? 'Finish' : 'Next: install'}${arrow}</button>`);
    } else {
      /* The home-screen app starts with its own storage, so what was picked in the browser is not in it. RIVL carries the
         picks over in a cookie, which is the one thing iOS copies as the app is created — but only if cookies are allowed.
         When they are not, say so here rather than let someone install and find an empty app. */
      const carryNote = () => HW.carry.works()
        ? `<p class="legend" style="padding-left:0;padding-right:0">Your teams and players come with you. The app starts with them already chosen.</p>`
        : `<p class="legend warn">This browser is blocking cookies, so your picks can't be carried into the home-screen app automatically. Before you add it, open <b>Settings → Sync</b> and back up to a code, then restore it in the app.</p>`;
      const done = standalone();
      frame(done ? "You're set" : 'Put RIVL on your home screen', done ? 'RIVL is on your home screen. Your teams and players are waiting on Home.' : 'It opens full screen like an app, with no browser bar, and your teams load first.',
        done ? '' : `<div class="onb-install"><img src="img/icon-192.png" alt="" width="64" height="64"><div>${deferredInstall ? `<button class="btn" data-act="install" id="installBtn">Install RIVL</button>` : isIOS ? `<b>In Safari</b><ol><li>Tap the Share button</li><li>Choose <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>` : `<b>In your browser menu</b><p style="margin:4px 0 0">Choose <b>Add to Home screen</b> (or <b>Install app</b>).</p>`}</div></div>${carryNote()}`,
        `${backBtn('data-act="onb-next" data-step="2"')}${onbProg(3)}<button class="btn" data-act="onb-done">${done ? 'Open Home' : 'Done'}${arrow}</button>`);
    }
  }
  V.onbStep = onbStep; V.onbWelcome = onbWelcome;
  /* how many are picked so far, across every league — it sits between Back and the step button, so the button itself can say
     where it goes instead of carrying a number that looked like it belonged to the league switch */
  const onbTally = (step, n) => n ? `${n} ${step === 0 ? 'team' : 'player'}${n === 1 ? '' : 's'}` : '';
  /* a team in the Top 25 and in its conference is one tile drawn twice, so every tile re-syncs */
  const onbCount = () => { const b = document.getElementById('onbNext'); if (!b || $panel.hidden) return;
    $panel.querySelectorAll('.onb-team').forEach(t => { const on = HW.favs.has(t.dataset.lk, t.dataset.id); t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on)); });
    const step = +(b.dataset.step || 1) - 1; const nn = step === 0 ? ORDER.reduce((c, k) => c + (HW.favs.all()[k] || []).length, 0) : V.fplayers.all().length;
    const cnt = document.getElementById('onbCnt'); if (cnt) cnt.textContent = onbTally(step, nn);   // (no longer drawn; the switch above carries the counts)
    // each section says how many of its tiles are picked; the league pills carry their counts; the rail shows every pick
    // the bar carries its own tally, so a folded conference still says how many of its teams you follow
    $panel.querySelectorAll('.onb-sec').forEach(h => { const n = h.nextElementSibling; const grid = n ? (n.classList.contains('onb-grid') ? n : n.querySelector('.onb-grid')) : null; const k = grid ? grid.querySelectorAll('.onb-team.on').length : 0; let em = h.querySelector('em'); if (k && !em) { em = document.createElement('em'); const ch = h.querySelector('.chev'); if (ch) ch.before(em); else h.appendChild(em); } if (em) { if (k) em.textContent = `${k} picked`; else em.remove(); } });
    $panel.querySelectorAll('.onb-pills .pill').forEach(p => { const k = p.dataset.lk; const c = step === 0 ? (HW.favs.all()[k] || []).length : V.fplayers.all().filter(x => x.lk === k).length; let ct = p.querySelector('.ct'); if (c && !ct) { ct = document.createElement('span'); ct.className = 'ct'; p.appendChild(ct); } if (ct) { if (c) ct.textContent = c; else ct.remove(); } });
    const rail = document.getElementById('onbPicked');
    if (rail) {
      /* what has been picked, by league: a count for each league (tap one to go there), then this league's picks, wrapping, each with its x */
      let picks;
      if (step === 0) {
        const names = {}; $panel.querySelectorAll('.onb-team').forEach(t => { names[`${t.dataset.lk}:${t.dataset.id}`] = { name: t.dataset.name, logo: (t.querySelector('img') || {}).src || '' }; }); const kept = store.get('v5:onbNames', {}) || {}; Object.assign(kept, names); store.set('v5:onbNames', kept);
        const F = HW.favs.all();
        // a pick made elsewhere (another device, an earlier session) has no tile on this screen yet: its name and logo come from the league's index
        const tried = onbCount.tried || (onbCount.tried = new Set());
        const unknown = ORDER.filter(k => !tried.has(k) && (F[k] || []).some(id => !kept[`${k}:${id}`]));
        if (unknown.length) { unknown.forEach(k => tried.add(k)); Promise.all(unknown.map(k => V.teamsIndex(LEAGUES[k]).then(idx => { (F[k] || []).forEach(id => { const t = idx[id]; if (t && !kept[`${k}:${id}`]) kept[`${k}:${id}`] = { name: t.short || t.name || 'Team', logo: t.logo || '' }; }); }).catch(() => { }))).then(() => { store.set('v5:onbNames', kept); onbCount(); }); }   // each league is looked up once
        picks = ORDER.flatMap(k => (F[k] || []).map(id => ({ k, id, ...(kept[`${k}:${id}`] || { name: 'Team', logo: '' }), html: p => `<button class="pick" data-act="fav" data-lk="${p.k}" data-id="${esc(p.id)}" data-name="${esc(p.name)}" aria-label="Unfollow ${esc(p.name)}"><span class="logo s"><img src="${esc(p.logo)}" alt="" onerror="this.style.visibility='hidden'"></span><b>${esc(p.name)}</b><s></s></button>` })));
      } else {
        picks = V.fplayers.all().map(pl => ({ k: pl.lk, id: pl.id, name: pl.short || pl.name, html: p => `<button class="pick" data-act="follow-player" data-snap='${esc(JSON.stringify(pl))}' aria-label="Unfollow ${esc(pl.name)}">${V._.headshot(pl.img, pl.color || '', 26, pl.name)}<b>${esc(p.name)}</b>${pl.team ? `<i>${esc(pl.team)}</i>` : ''}<s></s></button>` }));
      }
      /* patched in place, never rebuilt: re-writing the row's innerHTML on every tap threw away each <img> and made the
         logos already on screen blink and jump as they decoded again — and it reset the row's scroll position. Chips that
         are still picked are moved, not recreated; only a new one is built and only a dropped one is removed. */
      const lk = lkOf(onbLk); const here = picks.filter(p => p.k === lk);
      if (!here.length) { if (rail.firstChild) rail.textContent = ''; }
      else {
        let row = rail.querySelector('.onb-picked-row');
        if (!row) { rail.textContent = ''; row = document.createElement('div'); row.className = 'onb-picked-row'; rail.appendChild(row); }
        const have = new Map(); row.querySelectorAll('.pick').forEach(el => have.set(el.dataset.key, el));
        const want = new Set(); let prev = null;
        here.forEach(p => {
          const key = `${p.k}:${p.id}`; want.add(key);
          let el = have.get(key);
          if (!el) { const t = document.createElement('template'); t.innerHTML = p.html(p).trim(); el = t.content.firstElementChild; if (!el) return; el.dataset.key = key; }
          if (prev ? prev.nextElementSibling !== el : row.firstElementChild !== el) { if (prev) prev.after(el); else row.prepend(el); }
          prev = el;
        });
        have.forEach((el, key) => { if (!want.has(key)) el.remove(); });
      }
    }
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
