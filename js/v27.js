/* RIVL 2027 preview (v462).
   Off unless Settings has "Try the new design" switched on, so the app everyone has is unchanged.
   Section 1 of the redesign: the four-tab bar, the search field, and Home. Home is the scrolling feed the app already
   had (results, lines, injuries, news), Following only, with the date and greeting, the search field and story cards on
   top and a row of clips, tonight's picks and Around the league mixed in. Watch, Scores and You open the screens the
   app has today until their own sections are built. Every fact on this screen comes from the feeds the app already
   reads; RIVL's own numbers are labeled "RIVL projection". */
(() => {
  'use strict';
  const { LEAGUES, ORDER, store, esc, S, isLive, isDone, isFav, favs, todayCT, tipOf, relDay, finalWord } = HW;
  const V = HW.v5, X = V.x27, U = V._;
  if (!X || !U) return;
  const root = document.documentElement, $main = document.getElementById('main');
  const $bar = document.getElementById('tb27'), $seg = document.getElementById('seg27');
  const on = () => !!store.get('v5:rv27', false);
  const MOTION = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = s => { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
  const ymd = g => HW.ymdOf(g.date);
  const noTz = t => String(t).replace(/\s+(CT|ET|PT|MT|CST|CDT|EST|EDT|PST|PDT|MST|MDT)$/, '');
  const gameOf = k => { const i = k.indexOf(':'); return (S.today[k.slice(0, i)] || []).find(g => g.id === k.slice(i + 1)) || null; };

  /* ---------- colour: a team's colour as a surface white text can sit on ---------- */
  const tone = c => { let b = U.V_deep(c && !/^#?2A2D33$/i.test(c) ? c : '#3a3f4b'); if (U.lumOf(b) < .045) b = '#3a3f4b'; return b; };
  const grad = (c, deg = 160) => { const b = tone(c); return `linear-gradient(${deg}deg,${b},${U.mixTo(b, 0, .55)})`; };
  const disc = (t, px) => `<span class="cr27${t.logo ? '' : ' noimg'}" style="width:${px}px;height:${px}px;font-size:${Math.max(8, Math.round(px * .26))}px">${t.logo ? U.imgSized(t.logo, 96, 96, '', "this.parentNode.classList.add('noimg');this.remove()") : ''}<b>${esc(String(t.abbr || '').slice(0, 4))}</b></span>`;
  const face = (src, name, px) => `<span class="fc27" style="width:${px}px;height:${px}px;font-size:${Math.round(px * .36)}px"><b>${esc(U.initials(name))}</b>${src ? U.imgSized(src, 254, 185, '', 'this.remove()') : ''}</span>`;
  const I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.9 4.9 0 0 1 0-7 5 5 0 0 1 7 0l.4.4.4-.4a5 5 0 0 1 7 0 4.9 4.9 0 0 1 0 7z"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1.5 1.5 0 0 1 1.500 1.500v15.500L12 16.400l-6.500 4.100V5A1.500 1.500 0 0 1 7 3.500z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200"/></svg>',
    me: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="16" r="7"/><path d="M6 41c1-10 7-15 14-15s13 5 14 15z"/></svg>',
    mark: '<svg class="mk27" viewBox="0 0 160 160" role="img" aria-label="RIVL"><rect width="160" height="160" rx="40"/><g transform="translate(44 36) scale(0.713)"><path d="M0 0H88.800A11.200 11.200 0 0 1 100 11.200V50.500A11.200 11.200 0 0 1 88.800 61.700H62.300L0 25.610Z"/><path d="M0 47.020 100 104.960V123.410H0Z"/></g></svg>'
  };

  /* ---------- the shell: the four-tab bar, and Games / Standings / Leaders across the top of Scores ---------- */
  const SCORES = ['scores', 'standings', 'stats'];
  function paintBar() {
    const live = on(); root.classList.toggle('rv27', live); if ($bar) $bar.hidden = !live; if (!live) { if ($seg) $seg.hidden = true; return; }
    const pg = root.dataset.page || 'home'; const old = document.querySelector('#tabs .tab.on'); const owner = old ? old.dataset.tab : 'home';
    const cur = pg === 'settings' ? 'you' : SCORES.includes(owner) ? 'scores' : 'home';
    $bar.querySelectorAll('[data-t27]').forEach(a => { const is = a.dataset.t27 === cur; a.classList.toggle('on', is); if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const inScores = SCORES.includes(pg); $seg.hidden = !inScores;
    if (inScores) $seg.querySelectorAll('a').forEach(a => { const is = a.dataset.s27 === pg; a.classList.toggle('on', is); if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  if ($bar) $bar.addEventListener('click', e => {
    const a = e.target.closest('[data-t27]'); if (!a) return; e.preventDefault(); const k = a.dataset.t27;
    if (k === 'watch') { watch(); return; }
    if (k === 'you') { if (root.dataset.page === 'settings' && location.hash === '#settings') window.scrollTo({ top: 0, behavior: MOTION() ? 'smooth' : 'auto' }); else location.hash = '#settings'; return; }
    const pg = root.dataset.page;
    if (k === 'scores' && (pg === 'standings' || pg === 'stats')) { location.hash = '#scores'; return; }
    const t = document.querySelector(`#tabs .tab[data-tab="${k}"]`); if (t) t.click();   // the bar the app has today keeps each tab's trail; this one drives it
  });
  document.addEventListener('rivl:rendered', paintBar);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="rv27"]'); if (!b) return; e.preventDefault();
    const next = b.getAttribute('aria-checked') !== 'true'; store.set('v5:rv27', next); b.setAttribute('aria-checked', String(next)); paintBar();
    V.toast(next ? 'New design is on. Tap Home to see it.' : 'Back to the current design.');
  });
  /* how sharp clips play: Auto (the full-size file on Wi-Fi), Sharpest (always), Data saver (never) */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="vq"]'); if (!b) return; e.preventDefault(); store.set('v5:vq', b.dataset.vq);
    b.parentNode.querySelectorAll('[data-act="vq"]').forEach(x => { const is = x === b; x.classList.toggle('on', is); x.setAttribute('aria-checked', String(is)); });
  });
  const vqRow = () => { const cur = store.get('v5:vq', 'auto');
    return `<div class="gl setlook"><div class="gr ni"><span class="sico" data-k="watch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9.500 4.500 2.500-4.500 2.500z" fill="currentColor"/></svg></span><span class="gm"><b>Clip quality</b></span><div class="segc fit" role="radiogroup" aria-label="Clip quality">${[['auto', 'Auto'], ['always', 'Sharpest'], ['never', 'Saver']].map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="vq" data-vq="${k}" role="radio" aria-checked="${cur === k}">${l}</button>`).join('')}</div></div></div><p class="vq27">Auto plays clips at full size on Wi-Fi and lighter on cellular. A full-size clip is about 20 MB.</p>`; };
  V.rv27 = { on, vq: vqRow, miss(el) { const p = el.parentNode; if (p) { p.className = 'ph27 no27'; p.innerHTML = I.me; } },
    row: () => `<div class="gl"><button class="gr ni sw" data-act="rv27" role="switch" aria-checked="${on()}"><span class="sico" data-k="look"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.500 13.900 9l5.600 1.900-5.600 1.900L12 18.300l-1.900-5.500L4.500 10.900 10.100 9z"/></svg></span><span class="gm wrap"><b>Try the new design</b><span>A preview of the 2027 look. Home and the bottom bar so far. Switch it off any time.</span></span><span class="switch"></span></button></div>` };

  /* Watch opens the clips the app has today: For you when there is one, otherwise the league's biggest plays */
  async function watch(startId, key) {
    const srcs = ORDER.map(X.feedSource);
    if (!srcs.some(s => s.out)) await Promise.race([Promise.all(srcs.map(s => s.ready)), new Promise(r => setTimeout(r, 4000))]);
    const subs = X.storySubjects();
    const s = (key && subs.find(x => x.key === key)) || subs.find(x => x.key === 'all:feed') || subs.find(x => x.kind === 'league') || subs.find(x => x.un) || subs[0];
    if (!s) { V.toast('No clips yet. Follow a team and its plays show up here.'); return; }
    V.storyOpen(s.key, startId);
  }

  /* ---------- words ---------- */
  const greet = () => { const h = new Date().getHours(); const w = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; const n = String(store.get('v5:name', '') || '').trim().slice(0, 24); return n ? `${w}, ${n}` : w; };
  const dateLine = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const shortStanding = s => String(s || '').replace(' in the ', ' in ');
  const dayWord = g => { const w = relDay(ymd(g)); return w === 'Tonight' ? 'Today' : w; };
  const pctOf = ph => Math.round(Math.max(ph, 1 - ph) * 100);
  const projOf = (L, g, ctx) => { if (!V.prefs.get('forecast') || !ctx) return null; const f = U.safeF(L, g, ctx); return f && f.pHome != null && isFinite(f.pHome) ? f.pHome : null; };

  /* ---------- pieces ---------- */
  const head = (t, link, to, attr = '') => `<div class="sh27"><h2>${esc(t)}</h2>${link ? `<a href="${to}"${attr}>${link}</a>` : ''}</div>`;
  function storiesHtml(subs) {
    if (!subs.length) return '';
    return `<div class="rl27 st27">${subs.map(x => { const inner = x.kind === 'player' ? face(x.hs, x.full || x.name, 44) : x.kind === 'team' ? disc({ logo: x.logo, abbr: x.abbr }, 44) : `<em>${x.kind === 'feed' ? I.play : x.kind === 'saved' ? I.save : esc(x.abbr || '')}</em>`;
      return `<button class="sc27${x.un ? '' : ' seen'}" data-act="story" data-key="${esc(x.key)}" aria-label="${esc(x.full || x.name)} story"><span style="background:${grad(x.kind === 'league' || x.kind === 'feed' || x.kind === 'saved' ? '#3a3f4b' : x.color, 170)}">${inner}<small>${esc(x.kind === 'player' ? String(x.full || x.name).split(' ')[0] : x.name)}</small></span></button>`; }).join('')}</div>`;
  }
  function todays() {
    const t = todayCT(); const rank = g => (isLive(g) ? 0 : g.state === 'pre' ? 2 : 4) + (isFav(g) ? 0 : 1);
    return ORDER.flatMap(lk => (S.today[lk] || []).filter(g => !g.off && !g.tbd && (isLive(g) || ymd(g) === t))).sort((a, b) => (rank(a) - rank(b)) || (new Date(a.date) - new Date(b.date)));
  }
  /* The card for a player or a team: the photo or the logo is the card. Home no longer shows these rails (Ray: Home is
     for the news, not for cards of who you follow); they are kept for the Roster tab and the You page. */
  const cardVars = c => { const b = tone(c); return `--c:${b};--c1:${U.mixTo(b, 255, .2)};--c2:${U.mixTo(b, 0, .5)}`; };
  const mark27 = src => src ? `<span class="wm27">${U.imgSized(src, 300, 300, '', 'this.parentNode.remove()')}</span>` : '';
  function playersHtml(outs) {
    const all = V.fplayers.all(); if (!all.length) return '';
    const lines = new Map(); outs.forEach(o => (o.lines || []).forEach(x => lines.set(`${o.lk}:${x.p.id}`, x)));
    const cards = all.slice(0, 16).map(p => { const L = LEAGUES[p.lk]; if (!L) return null; const o = outs.find(z => z.lk === p.lk); const x = lines.get(`${p.lk}:${p.id}`);
      const tm = (x && x.us) || (o && o.tIdx && p.teamId && o.tIdx[String(p.teamId)]) || null; const color = tm ? U.teamColor(tm, L) : U.playerColor(p, L);
      const nm0 = p.short || p.name || ''; const nm = nm0.length > 17 ? V.lastName(p.name || nm0) : nm0;
      const line = x && !x.dnp ? `${x.pts} pts · ${x.reb} reb · ${x.ast} ast` : x ? x.dnp : (tm && (tm.short || tm.name)) || p.team || L.short;
      return { has: x && !x.dnp ? 0 : 1, html: `<a class="pc27" href="${x ? `${U.href.game(p.lk, x.g.id)}/p/${esc(String(p.id))}` : U.href.player(p.lk, p.id)}" style="${cardVars(color)}" aria-label="${esc(p.name || nm)}, ${esc(String(line))}">${mark27(tm && tm.logo)}${p.img ? `<span class="ph27">${U.imgSized(p.img, 600, 436, '', 'HW.v5.rv27.miss(this)')}</span>` : `<span class="ph27 no27">${I.me}</span>`}<span class="pt27"><b${nm.length > 14 ? ' class="lg27n"' : ''}>${esc(nm)}</b><small class="n">${esc(String(line))}</small></span></a>` }; }).filter(Boolean).sort((a, b) => a.has - b.has);
    return head('Your players', 'Edit', '#settings/following') + `<div class="rl27">${cards.map(c => c.html).join('')}</div>`;
  }
  function teamsHtml(outs) {
    const cards = outs.flatMap(o => (o.myTeams || []).map(t => { const live = (S.today[o.lk] || []).find(g => isLive(g) && (String(g.home.id) === t.id || String(g.away.id) === t.id));
      const vs = g => { const home = String(g.home.id) === t.id; return `${home ? 'vs' : 'at'} ${(home ? g.away : g.home).abbr}`; };
      let nxt = '', rank = 2;
      if (live) { const home = String(live.home.id) === t.id; const us = home ? live.home : live.away, th = home ? live.away : live.home; nxt = `<em><i></i>Live · ${esc(String(us.score ?? ''))}-${esc(String(th.score ?? ''))}</em>`; rank = 0; }
      else if (t.nx) { nxt = `<em>${esc(noTz(tipOf(t.nx)))} ${esc(vs(t.nx))}</em>`; rank = 1; }
      else if (t.next && t.next.state !== 'post') nxt = `<em>${esc(relDay(ymd(t.next)))} ${esc(vs(t.next))}</em>`;
      const line = [t.rec, t.rank ? `No. ${t.rank}` : shortStanding(t.standing)].filter(Boolean).join(' · ');
      return { rank, at: t.nx ? new Date(t.nx.date).getTime() : 0, html: `<a class="tc27" href="${U.href.team(o.lk, t.id)}" style="${cardVars(t.color)}">${mark27(t.logo)}<span class="lg27">${t.logo ? U.imgSized(t.logo, 200, 200, '', "this.outerHTML='<b>" + esc(String(t.abbr || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4)) + "</b>'") : `<b>${esc(String(t.abbr || '').slice(0, 4))}</b>`}</span><span class="pt27"><b>${esc(t.short || t.name)}</b>${line ? `<small>${esc(line)}</small>` : ''}${nxt}</span></a>` }; }));
    if (!cards.length) return '';
    cards.forEach((c, i) => { c.i = i; }); cards.sort((a, b) => (a.rank - b.rank) || (a.at - b.at) || (a.i - b.i));   // playing now, then tonight by tip, then the order you keep them in
    return head('Your teams', 'Edit', '#settings/following') + `<div class="rl27">${cards.map(c => c.html).join('')}</div>`;
  }
  const resultRow = (g, L) => { const hw = +g.home.score > +g.away.score; const w = hw ? g.home : g.away, l = hw ? g.away : g.home;
    return `<a class="rr27" href="${U.href.game(L.key, g.id)}">${disc(w, 28)}<span><b>${esc(w.short)} ${esc(String(w.score))}</b>, ${esc(l.short)} ${esc(String(l.score))}</span><small>${esc(finalWord(g))}</small></a>`; };
  /* Tonight's picks. A pick is made before the tip and cannot be changed after it. RIVL's side is the app's own
     projection at the moment of the pick, shown only once a side is chosen. Results are settled from final scores. */
  const PK = 'v5:mypicks';
  const picks = () => store.get(PK, {}) || {};
  function settle(outs) {
    const P = picks(); let ch = false;
    Object.values(P).forEach(p => { if (p.res) return; const g = gameOf(`${p.lk}:${p.id}`) || outs.flatMap(o => o.lk === p.lk ? (o.doneAll || []) : []).find(x => x.id === p.id); if (!g) return;
      if (g.off) { p.res = 'x'; ch = true; return; }
      if (!isDone(g) || +g.home.score === +g.away.score) return;
      const hw = +g.home.score > +g.away.score; p.res = (p.side === 'home') === hw ? 'w' : 'l'; p.rv = p.ph == null ? null : ((p.ph >= .5) === hw ? 'w' : 'l'); p.fs = [+g.away.score, +g.home.score]; ch = true; });
    const ks = Object.keys(P); if (ks.length > 400) { ks.sort((a, b) => (P[a].t || 0) - (P[b].t || 0)).slice(0, ks.length - 400).forEach(k => delete P[k]); ch = true; }
    if (ch) store.set(PK, P); return P;
  }
  function picksHtml(outs, P) {
    const t = todayCT(); const ctxOf = lk => { const o = outs.find(x => x.lk === lk); return o ? o.ctx : null; };
    const gs = todays().filter(g => (g.state === 'pre' && ymd(g) === t) || P[`${g.lk}:${g.id}`]);
    const list = [...gs.filter(isFav), ...gs.filter(g => !isFav(g))]; const show = list.filter((g, i) => i < 3 || P[`${g.lk}:${g.id}`]).slice(0, 6); if (!show.length) return '';
    let w = 0, l = 0, rw = 0, rl = 0; Object.values(P).forEach(p => { if (p.res === 'w') w++; else if (p.res === 'l') l++; if (p.rv === 'w') rw++; else if (p.rv === 'l') rl++; });
    const rec = w + l ? `<em>You ${w}-${l}${rw + rl ? ` · RIVL ${rw}-${rl}` : ''}</em>` : '';
    const card = g => { const L = LEAGUES[g.lk], k = `${g.lk}:${g.id}`, p = P[k], open = g.state === 'pre';
      const btn = (side, tm) => `<button data-pick27="${esc(k)}:${side}" class="${p ? (p.side === side ? 'on' : 'dim') : ''}"${open ? '' : ' disabled'} style="background:${grad(U.teamColor(tm, L))}" aria-pressed="${!!(p && p.side === side)}">${disc(tm, 34)}<span>${esc(tm.short)}</span>${p && p.side === side ? I.check : ''}</button>`;
      const when = open ? noTz(tipOf(g)) : isDone(g) ? `${finalWord(g)} · ${g.away.score}-${g.home.score}` : `${g.detail || 'Live'} · ${g.away.score ?? ''}-${g.home.score ?? ''}`;
      let foot = '<span>Pick a side to see RIVL\u2019s projection</span>';
      if (p) { const mine = p.side === 'home' ? g.home : g.away; const rf = p.ph == null ? null : (p.ph >= .5 ? g.home : g.away);
        const end = p.res === 'w' ? ' · Right' : p.res === 'l' ? ' · Wrong' : '';
        foot = `<span>Your pick: ${esc(mine.short)}${end}</span>${rf ? `<span>RIVL projection: <b class="n">${esc(rf.short)} ${pctOf(p.ph)}%</b></span>` : ''}`; }
      else if (!V.prefs.get('forecast') || !ctxOf(g.lk)) foot = '<span>Pick a side before the tip</span>';
      return `<div class="pk27"><span class="ph27"><b>${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}</b><span>${esc(when)}</span></span><div class="op27">${btn('away', g.away)}${btn('home', g.home)}</div><span class="pf27">${foot}</span></div>`; };
    return `<div class="irule ir27"><span>${new Date().getHours() < 16 ? 'Today\u2019s picks' : 'Tonight\u2019s picks'}</span>${rec}</div>` + show.map(card).join('');
  }
  function pick(key, side, outs) {
    const g = gameOf(key); if (!g) return false;
    if (g.state !== 'pre') { V.toast('Picks lock at the tip.'); return false; }
    const P = picks(); const o = outs.find(x => x.lk === g.lk); const tm = side === 'home' ? g.home : g.away;
    P[key] = { lk: g.lk, id: g.id, side, tid: String(tm.id), tn: tm.short, on: (side === 'home' ? g.away : g.home).short, ha: side === 'home' ? 'vs' : 'at', ph: o ? projOf(LEAGUES[g.lk], g, o.ctx) : null, date: g.date, t: Date.now() };
    store.set(PK, P); return true;
  }
  /* Around the league: results and streaks, read straight from the scoreboard and the standings */
  function leagueHtml(outs) {
    const rows = [];
    outs.forEach(o => (o.lastL || []).slice(0, o.follows ? 2 : 1).forEach(g => { if (isDone(g)) rows.push(resultRow(g, o.L)); }));
    outs.forEach(o => { const by = o.st && o.st.byId; if (!by) return; const best = Object.values(by).map(r => ({ r, m: /^([WL])(\d+)$/.exec(r.strk || '') })).filter(x => x.m && ((x.m[1] === 'W' && +x.m[2] >= 5) || (x.m[1] === 'L' && +x.m[2] >= 7))).sort((a, b) => +b.m[2] - +a.m[2])[0];
      if (best) rows.push(`<a class="rr27" href="${U.href.team(o.lk, best.r.id)}">${disc(best.r, 28)}<span><b>${esc(best.r.short || best.r.name)}</b> have ${best.m[1] === 'W' ? 'won' : 'lost'} ${best.m[2]} in a row</span><small class="n">${esc(best.r.strk)}</small></a>`); });
    if (!rows.length) return '';
    return `<div class="irule ir27"><span>Around the league</span><a href="#standings">Standings</a></div><div class="rw27">${rows.slice(0, 5).join('')}</div>`;
  }
  /* a row of clips: upright pictures, a tap opens full-screen video on that clip */
  const up916 = t => String(t || '').replace(/\.jpg(\?.*)?$/i, '_9x16.jpg');
  function clipsHtml(label, sub, its) {
    its = its.filter(i => i.kind === 'vid'); if (!sub || its.length < 3) return '';
    return `<div class="irule ir27"><span>${esc(label)}</span><button data-s27="clip" data-key="${esc(sub.key)}" data-id="${esc(its[0].id)}">Watch</button></div><div class="rl27 cv27">${its.map(it => `<button class="cl27" data-s27="clip" data-key="${esc(sub.key)}" data-id="${esc(it.id)}" aria-label="${esc(it.title)}">${it.thumb ? `<img src="${esc(up916(it.thumb))}" data-o="${esc(it.thumb)}" alt="" loading="lazy" onerror="if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute('data-o')}else this.remove()">` : ''}${it.rank ? `<i class="n">No. ${it.rank}</i>` : ''}<b>${esc(it.title)}</b></button>`).join('')}</div>`;
  }
  const topHtml = subs => `<div class="hi27"><small>${esc(dateLine())}</small><b>${esc(greet())}</b></div><div class="sr27">${I.mark}<a class="sf27" href="#search" role="search" aria-label="Search">${I.search}<span>Search teams, players, anything</span></a></div>${storiesHtml(subs)}`;

  /* ---------- Home ----------
     The feed is painted by the app's own Home (views.js). This lays the new top over it and sets the mixed-in blocks
     into it, and puts them back whenever the feed repaints itself. Nothing here rebuilds unless what it shows changed. */
  const outsNow = () => ORDER.map(lk => V.feedSrc[lk] && V.feedSrc[lk].out).filter(Boolean);
  let subsNow = [], made = null, madeAt = 0, mo = null, inDeco = false;
  const blockOf = (host, key, html) => { let el = host.querySelector(`[data-x27="${key}"]`); if (!html) { if (el) el.remove(); return null; }
    if (!el) { el = document.createElement('div'); el.className = `x27 h27 x27-${key}`; el.dataset.x27 = key; } const h = hash(html); if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = html; } return el; };
  const put = (el, parent, before) => { if (el.parentNode !== parent || el.nextSibling !== before) parent.insertBefore(el, before); };
  function decorate(force) {
    if (inDeco || !on() || root.dataset.page !== 'home') return; inDeco = true;
    try {
      const now = performance.now();
      if (force || !made || now - madeAt > 300) { madeAt = now; const outs = outsNow(); subsNow = outs.length ? X.storySubjects() : []; const P = settle(outs);
        const tops = subsNow.find(x => x.kind === 'league' && x.its.length >= 3), mine = subsNow.find(x => x.key === 'all:feed');
        made = { top: topHtml(subsNow), list: [
          ['plays', 0, tops ? clipsHtml(`Biggest plays · ${(LEAGUES[tops.lk] || {}).short || ''}`, tops, tops.its.slice(0, 10)) : ''],
          ['picks', 3, picksHtml(outs, P)],
          ['clips', 9, mine ? clipsHtml('For you', mine, mine.its.slice(0, 10)) : ''],
          ['league', 14, leagueHtml(outs)]] };
        X.warm([...(tops ? tops.its.slice(0, 6) : []), ...(mine ? mine.its.slice(0, 6) : [])]); }
      /* the top: date and greeting, search, stories */
      let top = $main.querySelector(':scope > .t27'); if (!top) { top = document.createElement('div'); top.className = 't27 h27'; }
      if ($main.firstElementChild !== top) $main.insertBefore(top, $main.firstChild);
      const th = hash(made.top); if (top.dataset.h !== th) { const r0 = top.querySelector('.rl27'); const x = r0 ? r0.scrollLeft : 0; top.dataset.h = th; top.innerHTML = made.top; const r1 = top.querySelector('.rl27'); if (r1 && x) r1.scrollLeft = x; }
      /* the blocks mixed into the feed: before the latest posts, then after the third, ninth and fourteenth */
      const hf = $main.querySelector(':scope > .hfeed');
      if (hf) { hf.setAttribute('data-noswipe', '');
        const rsec = hf.querySelector(':scope > section[data-sec="river"]'), feed = rsec && rsec.querySelector('.feed.hfl');
        const posts = feed ? [...feed.children].filter(c => c.classList.contains('fp')) : []; const tail = feed ? feed.querySelector(':scope > .hmore,:scope > .hend') : null;
        const groups = new Map();
        made.list.forEach(([key, at, html]) => { const el = blockOf(hf, key, html); if (!el) return;
          const parent = at === 0 || !feed ? hf : feed; const ref = at === 0 ? (rsec || null) : !feed ? null : (posts[at] || tail || null); const k = parent === hf ? 'hf' : (ref ? 'p' + posts.indexOf(ref) : 'end');
          if (!groups.has(k)) groups.set(k, { parent, ref, els: [] }); groups.get(k).els.push(el); });
        groups.forEach(g => { let before = g.ref; for (let i = g.els.length - 1; i >= 0; i--) { put(g.els[i], g.parent, before); before = g.els[i]; } }); }
    } catch (err) { console.error(err); }
    finally { inDeco = false; if (mo) mo.takeRecords(); }
  }
  mo = new MutationObserver(() => decorate(false)); mo.observe($main, { childList: true, subtree: true });
  ['rivl:rendered', 'rivl:polled'].forEach(ev => document.addEventListener(ev, () => decorate(true)));
  $main.addEventListener('click', e => {
    const p = e.target.closest('[data-pick27]');
    if (p && on()) { e.preventDefault(); const k = p.dataset.pick27; const i = k.lastIndexOf(':'); if (pick(k.slice(0, i), k.slice(i + 1), outsNow())) decorate(true); return; }
    const b = e.target.closest('[data-s27]'); if (!b || !b.closest('.h27')) return; const a = b.dataset.s27;
    if (a === 'watch') { e.preventDefault(); watch(); return; }
    if (a === 'story') { e.preventDefault(); V.storyOpen(b.dataset.key); return; }
    if (a === 'clip') { e.preventDefault(); watch(b.dataset.id, b.dataset.key); return; }
  });

  /* with the preview on, Home is the Following feed and nothing else: one feed for what you follow */
  const home0 = V.home;
  V.home = (...a) => { if (on() && a[0] !== 'following') { store.set('v5:hometab', 'following'); return V.rerender(); } return home0(...a); };
  paintBar();
})();
