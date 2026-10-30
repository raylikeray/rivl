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

  /* ---------- routes ----------
     #home #scores #standings #players #teams          league screens (league from the pills, remembered)
     #player/<lk>/<id> #team/<lk>/<id> #game/<lk>/<id>  entity screens
     #nba #wnba …                                       switch league, stay on the current league screen */
  const SCREENS = ['home', 'scores', 'standings', 'players', 'teams'];
  const lkOf = k => LEAGUES[k] ? k : 'nba';
  function route() {
    const h = (location.hash || '#home').slice(1);
    let m;
    if ((m = h.match(/^(player|team|game|article|venue)\/([a-z]+)\/([A-Za-z0-9]+)(?:\/p\/(\d+))?$/))) return { name: m[1], lk: lkOf(m[2]), args: m[4] ? [lkOf(m[2]), m[3], m[4]] : [lkOf(m[2]), m[3]] };   // a game can open on one player: #game/nba/401/p/1966
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
  }
  function paintTabs(name) {
    $tabs.querySelectorAll('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('on', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  }
  const TITLES = { home: 'Home', scores: 'Scores', standings: 'Standings', players: 'Players', teams: 'Teams', search: 'Search', settings: 'Settings', record: 'Record' };

  /* ---------- render ---------- */
  let seq = 0, current = null;
  /* where each screen was scrolled to, by screen key: going BACK to a screen lands where you were; a tab lands where you left it;
     a link to a player, team, game or story always opens at the top, however far down it you were last time */
  const scrollMem = new Map();
  let navN = 0;   // each history entry is numbered the first time it is shown; an entry numbered below the one we left is a step back
  async function render() {
    const r = route(); const my = ++seq; current = r; V.refresh = null; closeSheet();
    if (r.name !== 'scores' && V.todayPill) V.todayPill(false);   // the Scores screen's back-to-today pill goes with it
    const key = `${r.name}/${r.args.join('/')}`;
    const st = history.state; const back = !!(st && st.n != null && st.n < navN);
    if (st && st.n != null) navN = st.n; else { navN += 1; try { history.replaceState({ n: navN }, ''); } catch { } }
    const leagueScreen = SCREENS.includes(r.name);
    if (render.key && render.key !== key) scrollMem.set(render.key, window.scrollY);
    const leagueChanged = leagueScreen && render.lk && render.lk !== r.lk;   // a tap on the league switch starts the new league at the top
    $main.dataset.y = render.key !== key ? ((back || (leagueScreen && !leagueChanged)) ? String(scrollMem.get(key) || 0) : '0') : '';
    // a page that starts at the top goes there now, before its skeleton replaces the old screen — otherwise the old scroll
    // position clamps as the document shrinks and the eye sees two moves instead of one
    const fresh = render.key !== key;
    clearTimeout(render.holdT); render.onReal = null;
    if (fresh && MOTION()) {
      /* a crossfade, not a blink: a snapshot of the old screen is laid over the page and fades out while the new screen, held
         invisible until its real content has painted, fades in beneath it. If the content takes longer than a beat, the skeleton
         is shown instead so the hold never ends in a blank. */
      if (render.key) ghost();
      $main.classList.remove('fade', 'enter'); $main.classList.add('hold');
      const fadeIn = () => { clearTimeout(render.holdT); $main.classList.remove('hold', 'fade', 'enter'); void $main.offsetWidth; $main.classList.add('fade', 'enter'); document.querySelectorAll('.xghost:not(.out)').forEach(g => { g.classList.add('out'); setTimeout(() => g.remove(), 500); }); };   // the snapshot lets go only now, so the two cross
      render.onReal = fadeIn;
      render.holdT = setTimeout(() => { if (render.onReal === fadeIn && my === seq) { render.onReal = null; V.showSkeleton(); fadeIn(); render.onReal = () => { $main.classList.remove('enter'); void $main.offsetWidth; $main.classList.add('enter'); }; } }, 260);
    }
    if (leagueChanged || ($main.dataset.y === '0' && fresh)) window.scrollTo(0, 0);
    render.lk = r.lk;
    if (!['team', 'player', 'game'].includes(r.name) && V._.tint) V._.tint('');   // only a team's, a player's or a game's page wears a team colour
    if (leagueScreen) store.set('v5:screen', r.name);
    if (r.name !== 'scores') store.set('v5:date', todayCT());
    document.getElementById('top').hidden = !leagueScreen;
    paintPills(r.lk, leagueScreen);
    paintTabs(leagueScreen ? r.name : (r.name === 'player' ? 'players' : r.name === 'team' ? 'teams' : r.name === 'game' ? 'scores' : r.name === 'article' ? 'home' : ''));
    document.title = leagueScreen ? `${TITLES[r.name]} · ${LEAGUES[r.lk].label} · RIVL` : `${TITLES[r.name] || ''} RIVL`.trim();
    $main.dataset.top = '1';   // scroll to the top with the new screen's first real paint, not before it
    try { await (V[r.name] || V.home)(...r.args); }
    catch (err) { if (my === seq) $main.innerHTML = `<div class="empty"><b>Something went wrong</b><p style="margin:6px 0 0">${esc(err && err.message || 'Try again in a moment.')}</p></div>`; console.error(err); }
    if (my !== seq) return;
    V.settled();   // a view that painted into part of the screen (Scores' list, a standings chip, a refreshed game) made no full paint to clear the bar, the dimming and the slow note, or to land at its scroll
    paintPills(r.lk, leagueScreen);   // live counts may have arrived while the view loaded
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
      try { const g = await scoreboard(LEAGUES[k], today, k === r.lk ? 20000 : 120000); S.today[k] = g; if (g.some(isLive)) anyLive = true; }
      catch { failed = true; }
    }
    if (!failed) lastOk = Date.now();
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
    if (off && !staleSince) staleSince = lastOk || Date.now();
    if (!off) staleSince = 0;
    if (!staleEl) { staleEl = document.createElement('div'); staleEl.className = 'stale'; staleEl.hidden = true; document.getElementById('main').before(staleEl); }
    if (!off) { staleEl.hidden = true; return; }
    const m = Math.max(1, Math.round((Date.now() - staleSince) / 60000));
    staleEl.innerHTML = `<span></span>${navigator.onLine === false ? 'Offline' : 'Feed not answering'} · showing the last copy from ${m} min ago`;
    staleEl.hidden = false;
  }
  window.addEventListener('online', () => { stale(false); poll(); }); window.addEventListener('offline', () => stale(true));
  /* swap live scores into the cards on screen without repainting the whole page */
  function refreshCards() {
    const r = current; if (!r) return; const L = LEAGUES[r.lk];
    const byId = new Map(S.today[r.lk].map(g => [g.id, g]));
    $main.querySelectorAll('[data-gid]').forEach(el => {
      const g = byId.get(el.dataset.gid); if (!g) return;
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
    const side = (t, o) => { const lead = t.score != null && o.score != null && t.score > o.score; return `<span class="tm"${!tc(t) || /^#(2A2D33|55606e)$/i.test(tc(t)) ? '' : ` style="${V._.tcv(tc(t))}"`}>${V._.imgSized(t.logo || '', 64, 64)}<b>${esc(t.abbr)}</b><i class="sc${lead ? ' on' : ''}">${t.score ?? ''}</i></span>`; };
    return `<a class="lg${HW.isFav(g) ? ' fav' : ''}" href="#game/${L.key}/${esc(g.id)}" data-lid="${L.key}:${esc(g.id)}">${side(g.away, g.home)}${side(g.home, g.away)}<span class="st"><span class="dot"></span>${esc(g.detail)}</span></a>`;
  }
  function paintLive() {
    if (!$live) return;
    const r = current || route();
    const show = r && !['home', 'settings', 'search'].includes(r.name) && !document.body.classList.contains('onboarding');
    const list = show ? liveList() : [];
    const inner = $live.querySelector('.lb-in');
    if (!list.length) { if (!$live.hidden) { $live.hidden = true; inner.innerHTML = ''; } return; }
    const want = list.map(({ g, L }) => `${L.key}:${g.id}`);
    const have = [...inner.children].map(el => el.dataset.lid);
    if (want.join() !== have.join()) inner.innerHTML = list.map(({ g, L }) => liveChip(g, L)).join('');
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
  document.addEventListener('click', e => {
    const back = e.target.closest('[data-act="back"]');
    if (back) { if (history.length > 1) { e.preventDefault(); history.back(); } return; }
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
    if (a === 'onb-restart') { e.preventDefault(); onbLk = 'nba'; onbStep(0); }
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
      toast(on ? `Following ${act.dataset.name || 'team'}` : `Unfollowed ${act.dataset.name || 'team'}`);
      $main.dispatchEvent(new CustomEvent('rivl:fav')); $panel.dispatchEvent(new CustomEvent('rivl:fav')); document.dispatchEvent(new CustomEvent('rivl:fav'));
    }
    if (a === 'expand') { e.preventDefault(); $main.querySelectorAll(`[data-more="${act.dataset.more}"]`).forEach(el => { el.hidden = false; }); act.remove(); }
    if (a === 'stab') { e.preventDefault(); store.set('v5:stab:' + (current ? current.lk : 'nba'), act.dataset.tab); render(); }
    if (a === 'play') { e.preventDefault(); openSheet(act.dataset.vid); }
    if (a === 'injury') { e.preventDefault(); openInjury(act.dataset.key); }
    if (a === 'official') { e.preventDefault(); openOfficial(act.dataset.key); }
    if (a === 'gifold') { e.preventDefault(); V._.foldToggle(act, act.getAttribute('aria-expanded') !== 'true'); return; }
    if (a === 'injcol') { e.preventDefault(); const open = act.getAttribute('aria-expanded') !== 'true'; V._.foldToggle(act, open); const c = store.get('v5:injcol', {}) || {}; if (open) delete c[act.dataset.id]; else c[act.dataset.id] = true; store.set('v5:injcol', c); }
    if (a === 'reload') { e.preventDefault(); render(); }
    if (a === 'onb-next') { e.preventDefault(); onbLk = 'nba'; onbStep(+act.dataset.step); }
    if (a === 'onb-lk') { e.preventDefault(); onbLk = act.dataset.lk; onbStep(+(act.dataset.step || 0)); }
    if (a === 'onb-done') { e.preventDefault(); store.set('v5:onboarded', true); store.set('v5:lk', 'nba'); store.set('v5:screen', 'home'); closePanel(); if (location.hash !== '#home') location.hash = '#home'; else render(); }
    if (a === 'install') { e.preventDefault(); install(); }
    if (a === 'install-later') { e.preventDefault(); store.set('v5:installDismissed', Date.now()); const b = document.getElementById('installBar'); if (b) b.remove(); }
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
  function openInjury(key) {
    const rec = S.injuries && S.injuries[key]; if (!rec) return;
    const { x, team } = rec; const at = x.athlete || {}; const det = x.details || {}; const st = x.status || '';
    const lk = current ? current.lk : 'nba'; const L = LEAGUES[lk];
    const id = rec.id || V._.athId(at);
    const cls = /out/i.test(st) ? 'out' : /day|quest|doubt/i.test(st) ? 'q' : /prob|avail/i.test(st) ? 'ok' : '';
    const what = [det.type, det.detail && det.detail !== det.type ? det.detail : '', det.side && det.side !== 'Not Specified' ? det.side.toLowerCase() : '', det.location && det.location !== det.type ? det.location : ''].filter(Boolean).join(', ');
    const ret = V._.retInfo(L, det.returnDate);
    const rows = [['Status', `<span class="tag ${cls}">${esc(V._.statusWord(st))}</span>`], ['Injury', esc(what || '—')], ['Reported', x.date ? esc(new Date(x.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: HW.TZ })) : ''], ['Expected back', ret ? esc(ret.long) : (/out/i.test(st) ? 'No date given' : '')], ['Fantasy', det.fantasyStatus && det.fantasyStatus.description ? esc(det.fantasyStatus.description) : '']].filter(([, v]) => v);
    const note = x.longComment || x.shortComment || '';
    openPanel(`<button class="ib close" data-act="panel-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="inj-head">${id ? `<a href="#player/${lk}/${esc(id)}" data-act="panel-close" aria-label="${esc(at.displayName || '')} profile">` : ''}${V._.headshot(V._.hsUrl(at), V._.teamColor(team, L), 64, at.displayName)}${id ? '</a>' : ''}<div><h3>${esc(at.displayName || '')}</h3><p>${esc(team.short || '')}${at.position && at.position.abbreviation ? `, ${esc(at.position.abbreviation)}` : ''}</p></div></div>
      <table class="tbl kv"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
      ${note ? `<p class="inj-note">${esc(note)}</p>` : ''}
      <div style="display:flex;gap:8px;margin-top:14px">${id ? `<a class="btn" href="#player/${lk}/${esc(id)}" data-act="panel-close">Open profile</a>` : ''}${team.id ? `<a class="btn ghost" href="#team/${lk}/${esc(team.id)}" data-act="panel-close">${esc(team.short || 'Team')}</a>` : ''}</div>`);
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
  const STEPS = 4; let onbLk = 'nba';   // the league shown in setup; it never changes the league the app is on
  const onbMark = `<svg viewBox="0 0 250 123.41" fill="currentColor"><path d="M0 0H88.8A11.2 11.2 0 0 1 100 11.2V50.5A11.2 11.2 0 0 1 88.8 61.7H62.3L0 25.61ZM0 47.02L100 104.96V123.41H0ZM108 0H132V123.41H108ZM140 0H164.5L168.0 96L171.5 0H196L192 123.41H144ZM204 0H228V99.41H250V123.41H204Z"/></svg>`;
  async function onbStep(n) {
    const lk = lkOf(onbLk); const L = LEAGUES[lk];
    const dots = `<div class="onb-dots">${Array.from({ length: STEPS }, (_, i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>`;
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
      openPanel(`<div class="onb" data-step="${n}"><div class="onb-logo">${onbMark}</div>${dots}<h2>${title}</h2><p>${body}</p><div class="onb-body">${inner}</div><div class="onb-foot">${foot}</div></div>`, { full: true });
    };
    if (n === 0 || n === 1) {
      const nn = n === 0 ? ORDER.reduce((c, k) => c + (HW.favs.all()[k] || []).length, 0) : V.fplayers.all().length;
      frame(n === 0 ? 'Pick your teams' : 'Follow some players', n === 0 ? 'They lead Home and are the only ones you get updates about.' : 'Picked from the rosters of the teams you follow. Search any team to see its roster.',
        n === 0 ? `${leaguePills}<div id="onbPicked" class="onb-picked"></div><div class="search" style="margin:0 0 12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="onbq" type="search" placeholder="Search teams" autocomplete="off"></div><div id="onbList" class="onb-list">${Array.from({ length: 6 }, () => '<div class="skel row" style="margin:0 0 8px"></div>').join('')}</div>`
          : `${leaguePills}<div id="onbPicked" class="onb-picked"></div><div id="onbPick" class="onb-list">${Array.from({ length: 6 }, () => '<div class="skel row" style="margin:0 0 8px"></div>').join('')}</div>`,
        /* the button names where it goes. "Continue" next to a row of leagues read as "continue to the next league", which it
           never was — the switch changes league, the button changes step. Back exists from the second step on. */
        `${n ? `<button class="btn ghost" data-act="onb-next" data-step="${n - 1}">Back</button>` : '<span class="onb-gap"></span>'}<span class="onb-cnt" id="onbCnt">${onbTally(n, nn)}</span><button class="btn" data-act="onb-next" data-step="${n + 1}" id="onbNext">${n ? 'Next: your Home' : 'Next: players'}</button>`);
      if (n === 1) { onbCount(); await V.playerPicker(document.getElementById('onbPick'), L, { leaders: true, select: true }); onbCount(); return; }
      const list = document.getElementById('onbList'); const inp = document.getElementById('onbq');
      if (n === 0) {
        /* every team in the league. Pro leagues are one alphabetical grid; college is the AP Top 25 first, then each
           conference A to Z with its teams alphabetical, because 360 tiles in one wall is not a list anyone can use. */
        const [idx, st, R] = await Promise.all([V.teamsIndex(L), HW.standings(L).catch(() => null), HW.rankings(L).catch(() => null)]);
        const byShort = (a, b) => (a.short || a.name || '').localeCompare(b.short || b.name || '');
        const tile = (id, rank) => { const t = idx[id] || {}; const r = st && st.byId && st.byId[id]; return { id, short: t.short || (r && r.short) || t.name || (r && r.name) || '', name: t.name || (r && r.name) || '', abbr: t.abbr || (r && r.abbr) || '', logo: t.logo || (r && r.logo) || '', rec: r ? `${r.w}-${r.l}` : '', rank: rank || 0 }; };
        const seen = new Set(); const groups = [];
        if (L.standingsMode === 'conferences' && st && st.groups.length) {
          if (R && R.ranks && R.ranks.length) groups.push({ name: R.name || 'Top 25', rows: R.ranks.map(x => tile(String(x.team.id), x.rank)) });
          st.groups.slice().sort((a, b) => V._.confName(a.name, a.abbr).localeCompare(V._.confName(b.name, b.abbr))).forEach(g => { const rows = g.rows.map(r => { seen.add(r.id); return tile(r.id); }).sort(byShort); if (rows.length) groups.push({ name: V._.confName(g.name, g.abbr), rows }); });
          const rest = Object.keys(idx).filter(id => !seen.has(id)).map(id => tile(id)).sort(byShort); if (rest.length) groups.push({ name: 'Other', rows: rest });
        } else groups.push({ name: '', rows: Object.keys(idx).map(id => tile(id)).sort(byShort) });
        const paint = () => {
          const q = inp.value.trim().toLowerCase();
          const html = groups.map(g => { const rows = g.rows.filter(tm => !q || `${tm.name} ${tm.short} ${tm.abbr} ${g.name}`.toLowerCase().includes(q)); if (!rows.length) return ''; return `${g.name ? `<div class="onb-sec"><b>${esc(g.name)}</b><span>${rows.length}</span></div>` : ''}<div class="onb-grid">${rows.map(tm => { const on = HW.favs.has(lk, tm.id); return `<button class="onb-team${on ? ' on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(tm.id)}" data-name="${esc(tm.short)}" aria-pressed="${on}"><span class="logo">${V._.imgSized(tm.logo || '', 128, 128)}</span><b>${esc(tm.short)}</b><span>${tm.rank ? `<em>No. ${tm.rank}</em>` : ''}${esc(tm.rec)}</span><i></i></button>`; }).join('')}</div>`; }).join('');
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
        `<button class="btn ghost" data-act="onb-next" data-step="1">Back</button><span class="onb-gap"></span><button class="btn" data-act="onb-next" data-step="3">${standalone() ? 'Finish' : 'Next: install'}</button>`);
    } else {
      const done = standalone();
      frame(done ? "You're set" : 'Put RIVL on your home screen', done ? 'RIVL is on your home screen. Your teams and players are waiting on Home.' : 'It opens full screen like an app, with no browser bar, and your teams load first.',
        done ? '' : `<div class="onb-install"><img src="img/icon-192.png" alt="" width="64" height="64"><div>${deferredInstall ? `<button class="btn" data-act="install" id="installBtn">Install RIVL</button>` : isIOS ? `<b>In Safari</b><ol><li>Tap the Share button</li><li>Choose <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>` : `<b>In your browser menu</b><p style="margin:4px 0 0">Choose <b>Add to Home screen</b> (or <b>Install app</b>).</p>`}</div></div>`,
        `<button class="btn ghost" data-act="onb-next" data-step="2">Back</button><span class="onb-gap"></span><button class="btn" data-act="onb-done">${done ? 'Open Home' : 'Done'}</button>`);
    }
  }
  V.onbStep = onbStep;
  /* how many are picked so far, across every league — it sits between Back and the step button, so the button itself can say
     where it goes instead of carrying a number that looked like it belonged to the league switch */
  const onbTally = (step, n) => n ? `${n} ${step === 0 ? 'team' : 'player'}${n === 1 ? '' : 's'}` : '';
  /* a team in the Top 25 and in its conference is one tile drawn twice, so every tile re-syncs */
  const onbCount = () => { const b = document.getElementById('onbNext'); if (!b || $panel.hidden) return;
    $panel.querySelectorAll('.onb-team').forEach(t => { const on = HW.favs.has(t.dataset.lk, t.dataset.id); t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on)); });
    const step = +(b.dataset.step || 1) - 1; const nn = step === 0 ? ORDER.reduce((c, k) => c + (HW.favs.all()[k] || []).length, 0) : V.fplayers.all().length;
    const cnt = document.getElementById('onbCnt'); if (cnt) cnt.textContent = onbTally(step, nn);
    // each section says how many of its tiles are picked; the league pills carry their counts; the rail shows every pick
    $panel.querySelectorAll('.onb-sec').forEach(h => { const grid = h.nextElementSibling; const k = grid ? grid.querySelectorAll('.onb-team.on').length : 0; let em = h.querySelector('em'); if (k && !em) { em = document.createElement('em'); h.appendChild(em); } if (em) { if (k) em.textContent = `${k} picked`; else em.remove(); } });
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
  render().then(() => { poll(); if (needsOnboarding()) onbStep(0); });
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
