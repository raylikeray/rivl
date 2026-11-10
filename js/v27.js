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
  const $bar = document.getElementById('tb27'), $seg = document.getElementById('seg27'), $sh = document.getElementById('sh27');
  const on = () => !!store.get('v5:rv27', false);
  const MOTION = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = s => { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
  const ymd = g => HW.ymdOf(g.date);
  const noTz = t => String(t).replace(/\s+(CT|ET|PT|MT|CST|CDT|EST|EDT|PST|PDT|MST|MDT)$/, '');
  const gameOf = k => { const i = k.indexOf(':'); return (S.today[k.slice(0, i)] || []).find(g => g.id === k.slice(i + 1)) || null; };

  /* ---------- colour: a team's colour as a surface white text can sit on ---------- */
  const tone = c => { let b = U.V_deep(c && !/^#?2A2D33$/i.test(c) ? c : '#3a3f4b'); if (U.lumOf(b) < .045) b = '#3a3f4b'; return b; };
  const grad = (c, deg = 160) => { const b = tone(c); return `linear-gradient(${deg}deg,${b},${U.mixTo(b, 0, .55)})`; };
  /* a team's logo, on nothing: a thin light edge keeps it readable on its own colour and on a dark page (no white disc) */
  const disc = (t, px) => `<span class="lg27s${t.logo ? '' : ' noimg'}" style="width:${px}px;height:${px}px;font-size:${Math.max(9, Math.round(px * .3))}px">${t.logo ? U.imgSized(t.logo, 128, 128, '', "this.parentNode.classList.add('noimg');this.remove()") : ''}<b>${esc(String(t.abbr || '').slice(0, 4))}</b></span>`;
  const I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.9 4.9 0 0 1 0-7 5 5 0 0 1 7 0l.4.4.4-.4a5 5 0 0 1 7 0 4.9 4.9 0 0 1 0 7z"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1.5 1.5 0 0 1 1.500 1.500v15.500L12 16.400l-6.500 4.100V5A1.500 1.500 0 0 1 7 3.500z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200"/></svg>',
    me: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="16" r="7"/><path d="M6 41c1-10 7-15 14-15s13 5 14 15z"/></svg>'
  };

  /* ---------- the shell: the four-tab bar, and Games / Standings / Leaders across the top of Scores ---------- */
  const SCORES = ['scores', 'standings', 'stats'];
  function paintBar() {
    const live = on(); root.classList.toggle('rv27', live); if ($bar) $bar.hidden = !live; if (!live) { if ($seg) $seg.hidden = true; if ($sh) $sh.hidden = true; return; }
    const pg = root.dataset.page || 'home'; const old = document.querySelector('#tabs .tab.on'); const owner = old ? old.dataset.tab : 'home';
    const cur = root.classList.contains('w27on') ? 'watch' : pg === 'settings' ? 'you' : SCORES.includes(owner) ? 'scores' : 'home';
    $bar.querySelectorAll('[data-t27]').forEach(a => { const is = a.dataset.t27 === cur; a.classList.toggle('on', is); if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const inScores = SCORES.includes(pg); $seg.hidden = !inScores; if ($sh) $sh.hidden = !inScores;
    if (inScores) { const lk = (V.route && V.route() || {}).lk || '', col = /^ncaa/.test(lk), rec = col && pg === 'stats' && !!store.get('v5:ldrec', false); $seg.classList.toggle('four', col);
      $seg.querySelectorAll('a').forEach(a => { const k = a.dataset.s27; if (k === 'recruits') a.hidden = !col; const is = k === 'recruits' ? rec : k === pg && !(k === 'stats' && rec); a.classList.toggle('on', is); if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
  }
  if ($bar) $bar.addEventListener('click', e => {
    const a = e.target.closest('[data-t27]'); if (!a) return; e.preventDefault(); const k = a.dataset.t27;
    if (k === 'watch') { watchTab(); return; }
    /* Watch sits over the page it was opened from. Another tab puts it away first (one step back, which is how it closes),
       then goes where it was asked. */
    const st = document.querySelector('.story.w27v'); if (st && !st.dataset.leaving) { st.dataset.leaving = '1'; addEventListener('popstate', () => setTimeout(() => a.click(), 0), { once: true }); history.back(); return; }
    if (k === 'you') { if (root.dataset.page === 'settings' && location.hash === '#settings') window.scrollTo({ top: 0, behavior: MOTION() ? 'smooth' : 'auto' }); else location.hash = '#settings'; return; }
    const pg = root.dataset.page;
    if (k === 'scores' && (pg === 'standings' || pg === 'stats')) { location.hash = '#scores'; return; }
    const t = document.querySelector(`#tabs .tab[data-tab="${k}"]`); if (t) t.click();   // the bar the app has today keeps each tab's trail; this one drives it
  });
  /* Leaders and Recruits share the stats page: the switch says which one is wanted */
  if ($seg) $seg.addEventListener('click', e => { const a = e.target.closest('[data-s27]'); if (!a) return; const k = a.dataset.s27; if (k !== 'stats' && k !== 'recruits') return; const want = k === 'recruits', was = !!store.get('v5:ldrec', false); store.set('v5:ldrec', want); if (root.dataset.page === 'stats') { e.preventDefault(); if (want !== was) { V.rerender(); paintBar(); } } });
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
  V.rv27 = { on, vq: vqRow, miss(el, cls) { const p = el.parentNode; if (p) { p.className = (cls || 'ph27') + ' no27'; p.innerHTML = I.me; } },
    row: () => `<div class="gl"><button class="gr ni sw" data-act="rv27" role="switch" aria-checked="${on()}"><span class="sico" data-k="look"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.500 13.900 9l5.600 1.900-5.600 1.900L12 18.300l-1.900-5.500L4.500 10.900 10.100 9z"/></svg></span><span class="gm wrap"><b>Try the new design</b><span>A preview of the 2027 look. Home, Watch and Scores so far. Switch it off any time.</span></span><span class="switch"></span></button></div>` };

  /* Watch opens the clips the app has today: For you when there is one, otherwise the league's biggest plays */
  async function watch(startId, key) {
    const srcs = ORDER.map(X.feedSource);
    if (!srcs.some(s => s.out)) await Promise.race([Promise.all(srcs.map(s => s.ready)), new Promise(r => setTimeout(r, 4000))]);
    const subs = X.storySubjects();
    const s = (key && subs.find(x => x.key === key)) || subs.find(x => x.key === 'all:feed') || subs.find(x => x.kind === 'league') || subs.find(x => x.un) || subs[0];
    if (!s) { V.toast('No clips yet. Follow a team and its plays show up here.'); return; }
    V.storyOpen(s.key, startId);
  }

  /* ---------- Scores, Games (v472): a week of days, your team's game on top, then Live, Tonight and Final ---------- */
  const addD = (d, n) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const monOf = d => { const t = new Date(d + 'T12:00:00'); return addD(d, -((t.getDay() + 6) % 7)); };
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const longDay = d => { const t = new Date(d + 'T12:00:00'); return `${WD[t.getDay()]}, ${MO[t.getMonth()]} ${t.getDate()}`; };
  const periodWord = (L, g) => { const d = String(g.detail || ''); if (/half\s*time|halftime/i.test(d)) return 'Halftime'; if (/^end/i.test(d) || !g.period) return d; const n = L.periods || 4, p = g.period;
    const nm = p > n ? (p - n > 1 ? `${p - n}OT` : 'Overtime') : n === 2 ? (p === 1 ? '1st half' : '2nd half') : `${['1st', '2nd', '3rd', '4th'][p - 1] || p + 'th'} quarter`; return g.clock ? `${nm} \u00b7 ${g.clock}` : nm; };
  const leadWord = g => { const h = +g.home.score || 0, a = +g.away.score || 0; return h === a ? 'Tied' : `${esc(h > a ? g.home.short : g.away.short)} by ${Math.abs(h - a)}`; };
  const projWord = (L, g, ctx) => { const ph = g.state === 'pre' && !g.off ? projOf(L, g, ctx) : null; if (ph == null) return null; const t = ph >= .5 ? g.home : g.away; return { t, pct: pctOf(ph), home: ph >= .5 }; };
  const clipWord = g => { const n = X.clipsOf(g.id); return n ? `Recap, ${n} clip${n === 1 ? '' : 's'}` : ''; };
  const sLine = (t, lead, lose, score) => `<span class="ln27">${disc(t, 28)}<span class="${lose ? 'lo' : ''}">${t.rank ? `<i>${t.rank}</i>` : ''}${lead ? `<b>${esc(t.short)}</b>` : esc(t.short)}${t.rec ? `<small>${esc(t.rec)}</small>` : ''}</span><strong class="${lose ? 'lo' : ''}">${score ? esc(String(t.score == null ? '' : t.score)) : ''}</strong></span>`;
  function sRow(L, g, ctx) {
    const live = isLive(g) && !g.off, fin = g.state === 'post' && !g.off, h = +g.home.score || 0, a = +g.away.score || 0, sc = live || fin;
    let st; if (g.off) st = `${esc(g.off)}`; else if (live) st = `<em>${esc(g.detail || 'Live')}</em><small>${leadWord(g)}</small>`;
    else if (fin) { const c = clipWord(g); st = `${esc(finalWord(g))}${c ? `<small>${c}</small>` : ''}`; }
    else { const p = projWord(L, g, ctx); st = `${esc(noTz(tipOf(g)))}${p ? `<small>RIVL: ${esc(p.t.abbr)} ${p.pct}%</small>` : g.tv ? `<small>${esc(String(g.tv).split(',')[0])}</small>` : ''}`; }
    return `<a class="g27${isFav(g) ? ' my' : ''}" href="${U.href.game(L.key, g.id)}"><span class="tm27">${sLine(g.away, sc && a > h, sc && fin && a < h || (live && a < h), sc)}${sLine(g.home, sc && h > a, sc && fin && h < a || (live && h < a), sc)}</span><span class="st27${live ? ' lv' : ''}">${st}</span></a>`;
  }
  function sHero(L, g, ctx) {
    const live = isLive(g) && !g.off, fin = g.state === 'post' && !g.off, h = +g.home.score || 0, a = +g.away.score || 0, ca = tone(g.away.color), ch = tone(g.home.color);
    const top = g.off ? esc(g.off) : live ? `<i></i>${esc(periodWord(L, g))}` : fin ? esc(finalWord(g)) : `${esc(relDay(ymd(g)))} \u00b7 ${esc(noTz(tipOf(g)))}`;
    const mid = live || fin ? `<span class="${a < h ? 'lo' : ''}">${a}</span><span class="${h < a ? 'lo' : ''}">${h}</span>` : `<em>at</em>`;
    const p = projWord(L, g, ctx), c = fin ? clipWord(g) : '';
    const foot = p ? `<span class="hb27"><span class="${p.home ? 'r' : ''}" style="width:${p.pct}%"></span></span><span class="hf27"><span>RIVL projection</span><b>${esc(p.t.short)} ${p.pct}%</b></span>` : `<span class="hf27 one"><b>${live ? leadWord(g) : c || (g.tv ? esc(String(g.tv).split(',')[0]) : '')}</b></span>`;
    const side = (t, r) => `<span class="hs27${r ? ' r' : ''}">${disc(t, 40)}<b>${esc(t.short)}</b></span>`;
    return `<a class="hero27${live ? ' lv' : ''}" href="${U.href.game(L.key, g.id)}" style="background:linear-gradient(100deg,${U.mixTo(ca, 0, .45)} 0%,${ca} 40%,${ch} 60%,${U.mixTo(ch, 255, .12)} 100%)"><span class="hbl27 a" style="background:${U.mixTo(ca, 255, .25)}"></span><span class="hbl27 b" style="background:${U.mixTo(ch, 255, .3)}"></span><span class="hsh27"></span><span class="ht27">${top}</span><span class="hm27">${side(g.away)}<span class="hn27">${mid}</span>${side(g.home, 1)}</span><span class="hft27">${foot}</span></a>`;
  }
  const sSec = (label, list, L, ctx, pulse) => { if (!list.length) return ''; const N = 14, rows = list.map(g => sRow(L, g, ctx));
    return `<div class="sl27">${pulse ? '<i></i>' : ''}${label}${list.length > 3 ? `<span>${list.length}</span>` : ''}</div>${rows.slice(0, N).join('')}${rows.length > N ? `<div class="mo27" hidden>${rows.slice(N).join('')}</div><button class="mb27" data-a27="more">Show all ${rows.length}</button>` : ''}`; };
  function sBody(L, day, games, ctx, cal) {
    const today = todayCT();
    if (!games) return `<div class="em27"><b>Couldn't load the scoreboard</b><p>The feed didn't answer. It usually comes back within a minute.</p></div>`;
    if (!games.length) { const next = (cal || []).find(d => d > day);
      return `<div class="em27"><b>No ${esc(L.label)} games ${day === today ? 'today' : 'on ' + esc(longDay(day))}</b>${next ? `<p>The next games are ${next === addD(today, 1) ? 'tomorrow' : 'on ' + esc(longDay(next))}.</p><button data-act="date" data-ymd="${esc(next)}">Go to ${esc(longDay(next))}</button>` : ''}</div>`; }
    const ok = games.filter(g => !g.tbd), mine = (x, y) => isFav(y) - isFav(x), byTip = (x, y) => new Date(x.date) - new Date(y.date);
    const hero = ok.find(g => isFav(g) && isLive(g) && !g.off) || ok.find(g => isFav(g) && g.state === 'pre' && !g.off) || ok.find(g => isFav(g) && !g.off) || null;
    const rest = games.filter(g => g !== hero), off = rest.filter(g => g.off), live = rest.filter(g => isLive(g) && !g.off).sort(mine), done = rest.filter(g => !isLive(g) && g.state === 'post' && !g.off).sort((x, y) => mine(x, y) || byTip(y, x)), ahead = rest.filter(g => !live.includes(g) && !done.includes(g) && !g.off).sort((x, y) => byTip(x, y) || mine(x, y));
    return (hero ? sHero(L, hero, ctx) : '') + sSec('Live', live, L, ctx, true) + sSec(day === today ? esc(relDay(day)) : 'Scheduled', ahead, L, ctx) + sSec('Final', done, L, ctx) + sSec('Not played', off, L, ctx);
  }
  function sWeeks(day, cal) {
    const today = todayCT(), m0 = monOf(day), gd = new Set(cal || []); let h = '';
    for (let w = -3; w <= 4; w++) { const m = addD(m0, w * 7); h += `<div class="wp27" data-w="${m}">`;
      for (let i = 0; i < 7; i++) { const d = addD(m, i), t = new Date(d + 'T12:00:00'); h += `<a href="#scores" data-act="date" data-ymd="${d}" class="${d === day ? 'on ' : ''}${d === today ? 'td ' : ''}${gd.has(d) ? 'gd' : ''}" aria-label="${longDay(d)}"${d === day ? ' aria-current="date"' : ''}><span>${WD[t.getDay()]}</span><b>${t.getDate()}</b><i></i></a>`; }
      h += '</div>'; }
    return h;
  }
  let scRun = 0;
  async function scores27(lk, quiet) {
    const L = LEAGUES[lk]; if (!L) return; const today = todayCT(), run = ++scRun;
    let day = store.get('v5:date', today); if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Math.abs(new Date(day) - new Date(today)) > 200 * 864e5) day = today;
    let pg = $main.querySelector('#sc27'); const same = pg && pg.dataset.lk === lk;
    const unr = lk === 'wnba' ? `<div class="um27"><button class="on">WNBA</button><button data-act="scmode" data-mode="unrivaled">Unrivaled</button></div>` : '';
    if (!same) { $main.innerHTML = `<div id="sc27" class="h27 sp27" data-lk="${esc(lk)}">${unr}<div class="wk27" id="wk27"></div><div class="mn27" id="mn27"></div><div id="scb27"><div class="sk27"></div><div class="sk27"></div><div class="sk27"></div></div></div>`; pg = $main.querySelector('#sc27'); }
    const wk = pg.querySelector('#wk27'), body = pg.querySelector('#scb27'), mn = pg.querySelector('#mn27');
    const strip = cal => { const has = wk.querySelector(`[data-ymd="${day}"]`);
      if (!has || wk.dataset.cal !== String((cal || []).length)) { wk.innerHTML = sWeeks(day, cal); wk.dataset.cal = String((cal || []).length); const cur = wk.querySelector(`.wp27[data-w="${monOf(day)}"]`); if (cur) wk.scrollLeft = cur.offsetLeft - wk.offsetLeft; }
      else wk.querySelectorAll('a').forEach(a => { const is = a.dataset.ymd === day; a.classList.toggle('on', is); if (is) a.setAttribute('aria-current', 'date'); else a.removeAttribute('aria-current'); });
      const t = new Date(day + 'T12:00:00'); mn.textContent = day === today ? `Today, ${MO[t.getMonth()]} ${t.getDate()}` : longDay(day) + (t.getFullYear() !== new Date().getFullYear() ? `, ${t.getFullYear()}` : ''); };
    if (!wk.children.length || body.dataset.d !== day) strip(wk.dataset.calv ? JSON.parse(wk.dataset.calv) : null);
    if (same && body.dataset.d !== day && !quiet) V.busy(true);
    const [games, ctx, meta] = await Promise.all([day === today && S.today[lk] && S.today[lk].length && !quiet ? S.today[lk] : HW.scoreboard(L, day).catch(() => null), HW.forecastCtx(L, day).catch(() => null), X.sbMeta(L, day).catch(() => null)]);
    if (run !== scRun || !document.body.contains(pg)) return; V.busy(false);
    if (day === today && games) S.today[lk] = games;
    const cal = (meta && meta.cal) || []; wk.dataset.calv = JSON.stringify(cal.filter(d => Math.abs(new Date(d) - new Date(day)) < 50 * 864e5)); strip(JSON.parse(wk.dataset.calv));
    const html = sBody(L, day, games, ctx, cal), hh = hash(html); if (body.dataset.h !== hh) { const open = !!body.querySelector('.mo27:not([hidden])'); body.innerHTML = html; body.dataset.h = hh; if (open) body.querySelectorAll('.mo27').forEach(m => { m.hidden = false; if (m.nextElementSibling) m.nextElementSibling.remove(); }); }
    body.dataset.d = day;
    V.refresh = () => scores27(lk, true); V.refresh.every = 25000;
  }
  $main.addEventListener('click', e => { const b = e.target.closest('[data-a27="more"]'); if (!b) return; e.preventDefault(); const m = b.previousElementSibling; if (m) m.hidden = false; b.remove(); });
  { const sc0 = V.scores; V.scores = (lk, ...a) => on() && !(lk === 'wnba' && (V.unrOn ? V.unrOn() : store.get('v5:scunr', false))) ? scores27(lk) : sc0(lk, ...a); }

  /* ---------- Scores, Leaders (v474): All players or Rookies, one stat at a time. First place is the big card, second and
     third sit side by side, the rest are rows with a bar. Numbers come from data/leaders.json, the same file Search reads. ---------- */
  const LCATS = [['pts', 'Points', 'points per game'], ['reb', 'Rebounds', 'rebounds per game'], ['ast', 'Assists', 'assists per game'], ['stl', 'Steals', 'steals per game'], ['blk', 'Blocks', 'blocks per game'], ['tpm', 'Threes', 'threes made per game']];
  const one = v => (Math.round(v * 10) / 10).toFixed(1);
  let ldRun = 0;
  async function stats27(lk) {
    const L = LEAGUES[lk]; if (!L) return; const run = ++ldRun;
    let pg = $main.querySelector('#ld27'); if (!pg || pg.dataset.lk !== lk) { $main.innerHTML = `<div id="ld27" class="h27 lp27" data-lk="${esc(lk)}"><div class="sk27"></div><div class="sk27"></div><div class="sk27"></div></div>`; pg = $main.querySelector('#ld27'); }
    const [lg, idx] = await Promise.all([HW.hub.league(L).catch(() => null), V.teamsIndex(L).catch(() => ({}))]);
    if (run !== ldRun || !document.body.contains(pg)) return;
    const ps = (lg && lg.players) || [];
    if (lk.startsWith('ncaa') && store.get('v5:ldrec', false)) return recruits27(lk, pg, run);
    const st = store.get('v5:ld27', {}) || {}; let who = st.who === 'rookies' && ps.some(p => p.rookie) ? 'rookies' : 'all', cat = LCATS.some(c => c[0] === st.cat) ? st.cat : 'pts';
    const byAbbr = {}; Object.values(idx || {}).forEach(t => { if (t && t.abbr) byAbbr[t.abbr] = t; });
    const colorOf = p => tone(U.teamColor({ abbr: p.team, id: (byAbbr[p.team] || {}).id }, L));
    const maxG = Math.max(1, ...ps.map(p => (p.s || {}).gp || 0));
    const qual = p => { const s = p.s || {}; return (s.gp || 0) >= Math.max(1, Math.ceil(maxG * .5)) && (s.min || 0) >= (lk.startsWith('ncaa') ? 10 : 12); };
    const pills = `<div class="pl27">${[['all', 'All players']].concat(ps.some(p => p.rookie) ? [['rookies', 'Rookies']] : []).map(([k, l]) => `<button data-ld="who" data-v="${k}" class="${who === k ? 'on' : ''}" aria-pressed="${who === k}">${l}</button>`).join('')}</div>`;
    const cats = `<div class="sx27">${LCATS.map(c => `<button data-ld="cat" data-v="${c[0]}" class="${cat === c[0] ? 'on' : ''}" aria-pressed="${cat === c[0]}">${c[1]}</button>`).join('')}</div>`;
    if (!ps.length) { pg.innerHTML = pills + `<div class="em27"><b>No numbers yet</b><p>${esc(L.label)} leaders show here once the season has games.</p></div>`; return; }
    const C = LCATS.find(c => c[0] === cat);
    const rows = ps.filter(p => (who !== 'rookies' || p.rookie) && qual(p) && (p.s || {})[cat] != null).map(p => ({ p, v: +(p.s || {})[cat] })).filter(x => isFinite(x.v)).sort((a, b) => b.v - a.v).slice(0, 30);
    const sub = p => `${esc(p.teamName || p.team || '')}${p.rookie && p.pick ? ` \u00b7 Pick ${p.pick}` : who === 'rookies' ? '' : p.pos ? ` \u00b7 ${esc(p.pos)}` : ''}`;
    const cut = (p, w, h) => p.img ? U.imgSized(p.img, w, h, 'class="cu27"', "this.remove()") : '';
    const grad3 = (c, a) => `linear-gradient(${a}deg,${U.mixTo(c, 255, .16)},${c} 55%,${U.mixTo(c, 0, .6)})`;
    const label = `${who === 'rookies' ? 'Rookies, ' : ''}${who === 'rookies' ? C[2] : C[2].charAt(0).toUpperCase() + C[2].slice(1)}`;
    let h = '';
    if (!rows.length) h = `<div class="em27"><b>Nobody qualifies yet</b><p>A player needs half of the games played and regular minutes to be ranked.</p></div>`;
    else {
      const a = rows[0], c0 = colorOf(a.p);
      h += `<a class="l1x27" href="${U.href.player(lk, a.p.id)}" style="background:${grad3(c0, 150)}"><span class="lb27" style="background:${U.mixTo(c0, 255, .35)}"></span>${cut(a.p, 500, 364)}<span class="lsh27"></span><span class="lt27">1 \u00b7 ${esc(label)}</span><span class="lf27"><strong>${one(a.v)}</strong><b>${esc(a.p.n)}</b><small>${sub(a.p)}</small></span></a>`;
      if (rows.length > 1) h += `<div class="l2x27">${rows.slice(1, 3).map((x, i) => `<a href="${U.href.player(lk, x.p.id)}" style="background:${grad3(colorOf(x.p), 160)}"><u>${i + 2}</u>${cut(x.p, 254, 185)}<strong>${one(x.v)}</strong><b>${esc(x.p.n)}</b><small>${sub(x.p)}</small></a>`).join('')}</div>`;
      h += `<div class="lr27">${rows.slice(3).map((x, i) => { const c = colorOf(x.p); return `<a href="${U.href.player(lk, x.p.id)}"><span>${i + 4}</span><span class="fc27" style="background:linear-gradient(160deg,${U.mixTo(c, 255, .12)},${U.mixTo(c, 0, .45)})">${p_img(x.p)}</span><span class="tx27"><b>${esc(x.p.n)}<small>${sub(x.p)}</small></b><i><s style="width:${Math.max(4, Math.round(x.v / (a.v || 1) * 100))}%;background:${U.lumOf(c) < .06 ? U.mixTo(c, 255, .45) : c}"></s></i></span><strong>${one(x.v)}</strong></a>`; }).join('')}</div>`;
    }
    const note = lg.lastSeason ? `<p class="ln27n">${esc(lg.label)} season. The new season's numbers take over once it has games.</p>` : `<p class="ln27n">Per game, ${esc(lg.label || '')}. A player needs half of the games played to be ranked.</p>`;
    const html = pills + cats + h + note, hh = hash(html); if (pg.dataset.h !== hh) { const sx = pg.querySelector('.sx27'), x0 = sx ? sx.scrollLeft : 0; pg.innerHTML = html; pg.dataset.h = hh; const s2 = pg.querySelector('.sx27'); if (s2) { s2.scrollLeft = x0; const onb = s2.querySelector('.on'); if (onb && (onb.offsetLeft + onb.offsetWidth > s2.scrollLeft + s2.clientWidth || onb.offsetLeft < s2.scrollLeft)) s2.scrollLeft = Math.max(0, onb.offsetLeft - 18); } }
  }
  const p_img = p => p.img ? U.imgSized(p.img, 160, 116, '', "this.remove()") : '';
  $main.addEventListener('click', e => { const b = e.target.closest('[data-ld]'); if (!b) return; e.preventDefault(); const lk = (b.closest('#ld27') || {}).dataset ? b.closest('#ld27').dataset.lk : '';
    if (b.dataset.ld === 'cls') { store.set('v5:strcls', b.dataset.v); if (lk) stats27(lk); return; }
    const st = store.get('v5:ld27', {}) || {}; st[b.dataset.ld] = b.dataset.v; store.set('v5:ld27', st); if (lk) stats27(lk); });
  /* Recruits (college only): the high-school classes, boys under NCAA M and girls under NCAA W, from data/recruits.json */
  async function recruits27(lk, pg, run) {
    const L = LEAGUES[lk], g = lk === 'ncaaw' ? 'girls' : 'boys';
    const [REC, idx] = await Promise.all([HW.hub.recruits().catch(() => null), V.teamsIndex(L).catch(() => ({}))]);
    if (run !== ldRun || !document.body.contains(pg)) return;
    const all = (REC && REC[g]) || {}, classes = Object.keys(all).filter(k => (all[k] || []).length).sort();
    if (!classes.length) { pg.innerHTML = `<div class="em27"><b>No recruit rankings yet</b><p>The classes show here once the rankings are posted.</p></div>`; pg.dataset.h = ''; return; }
    let cls = store.get('v5:strcls', classes[0]); if (!classes.includes(cls)) cls = classes[0];
    const list = [...all[cls]].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    const sch = {}; Object.values(idx || {}).forEach(t => { if (!t) return; [t.loc, t.short, t.name].filter(Boolean).forEach(n => { const k = String(n).toLowerCase(); if (!sch[k]) sch[k] = t; }); });
    const crest = (name, px) => { const t = sch[String(name || '').toLowerCase()]; return t && t.logo ? `<span class="cr27" title="${esc(name)}">${U.imgSized(t.logo, 96, 96, '', "this.parentNode.classList.add('tx');this.parentNode.textContent=this.parentNode.title.slice(0,3).toUpperCase()")}</span>` : `<span class="cr27 tx" title="${esc(name)}">${esc(String(name || '').replace(/[^A-Za-z ]/g, '').split(' ').map(w => w[0] || '').join('').slice(0, 3).toUpperCase() || '?')}</span>`; };
    const where = (r, hero) => r.commitTo ? `<span class="cm27">${WI.tick}${hero ? 'Committed to ' : ''}${esc(r.commitTo)}</span>` : (r.top || []).length ? `${hero ? '<span>Uncommitted, looking at</span>' : ''}<span class="sc27r">${r.top.slice(0, 3).map(n => crest(n)).join('')}</span>` : hero ? '<span>Uncommitted</span>' : '';
    const href = r => V.recruitHref ? V.recruitHref(g, cls, r) : '#search';
    const pic = (r, w, h, c) => r.img ? `<img class="${c}" src="${esc(r.img)}" alt="" loading="lazy" onerror="this.remove()">` : '';
    const a = list[0];
    const hero = `<a class="r1x27" href="${href(a)}"><span class="rn27" aria-hidden="true">${a.rank || 1}</span><span class="rsw27"></span>${pic(a, 0, 0, 'cu27')}<span class="lsh27"></span><span class="lt27">${a.rank || 1} \u00b7 Class of ${esc(cls)}</span><span class="rf27"><b>${esc(a.n)}</b><span class="rh27">${esc([a.hs, a.home].filter(Boolean).join(' \u00b7 '))}</span><span class="rc27">${[a.pos, a.ht, a.wt ? a.wt + ' lb' : ''].filter(Boolean).map(x => `<i>${esc(x)}</i>`).join('')}</span><span class="rw27">${where(a, true)}</span></span></a>`;
    const row = r => `<a href="${href(r)}"><span>${r.rank || ''}</span><span class="fc27 rp27">${pic(r, 0, 0, '')}</span><span class="tx27"><b>${esc(r.n)}</b><small>${esc([r.pos, r.ht, r.hs].filter(Boolean).join(' \u00b7 '))}</small></span>${where(r, false)}</a>`;
    const rest = list.slice(1), N = 9;
    const html = `<div class="pl27">${classes.map(c => `<button data-ld="cls" data-v="${esc(c)}" class="${c === cls ? 'on' : ''}" aria-pressed="${c === cls}">Class of ${esc(c)}</button>`).join('')}</div>${hero}<h2 class="rh2x27">Top of the class</h2><div class="lr27 rr27x">${rest.slice(0, N).map(row).join('')}${rest.length > N ? `<div class="mo27" hidden>${rest.slice(N).map(row).join('')}</div><button class="mb27" data-a27="more">Show all ${list.length}</button>` : ''}</div><p class="ln27n">${g === 'girls' ? 'Girls' : 'Boys'} high-school class of ${esc(cls)}, ranked by PrepRanks.</p>`;
    const hh = hash(html); if (pg.dataset.h !== hh) { pg.innerHTML = html; pg.dataset.h = hh; }
  }
  { const st0 = V.stats; V.stats = (lk, ...a) => on() ? stats27(lk) : st0(lk, ...a); }

  /* ---------- Watch: one clip to a screen, Following / For you / Top plays ---------- */
  const WI = {
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.500 4.500 21 11.500l-7.500 7v-4.300C8.300 14.200 5 15.800 3 19.500c.300-5.600 3.600-10.300 10.500-10.800z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.500 4 4 8-9"/></svg>' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function wChrome(el) {
    el.style.bottom = `${$bar ? $bar.offsetHeight : 0}px`;
    const subs = el.__subs || [], act = el.querySelector('.stact');   // the tabs and search sit over the clips and stay put while a clip slides
    el.insertAdjacentHTML('beforeend', `<div class="wt27" data-w27 role="tablist" aria-label="Watch">${subs.map((x, i) => `<button data-wtab="${i}" role="tab">${esc(x.name)}</button>`).join('')}<i class="wi27"></i></div><a class="ws27" data-w27 href="#search" aria-label="Search">${I.search}</a>`);
    act.insertAdjacentHTML('afterbegin', `<span class="wa27" data-w27 hidden></span>`);
    act.insertAdjacentHTML('beforeend', `<button data-w27 data-wact="share" aria-label="Share">${WI.share}</button>`);
    el.querySelector('.stpane').insertAdjacentHTML('beforeend', `<div class="wpl27" aria-hidden="true">${I.play}</div>`);
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-wtab]'); if (t) { e.preventDefault(); el.__w.tab(+t.dataset.wtab); return; }
      const b = e.target.closest('[data-wact]'); if (!b) return; e.preventDefault(); const it = el.__w.item; if (!it) return;
      if (b.dataset.wact === 'share') return wShare(it);
      if (b.dataset.wact === 'follow') return wFollow(el, b);
    });
    /* a link out of Watch (the player, search) puts Watch away first, then goes */
    el.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (!a) return; e.preventDefault(); const to = a.getAttribute('href'); if (el.dataset.leaving) return; el.dataset.leaving = '1'; addEventListener('popstate', () => setTimeout(() => { location.hash = to; }, 0), { once: true }); history.back(); });
  }
  /* the underline under the tabs: f is the place between tabs (1.4 is partway from the second to the third). It travels
     with the finger while a list is being dragged (live) and glides when a tab is tapped or the drag is let go. */
  function wInd(el, f, live) {
    const bs = [...el.querySelectorAll('[data-wtab]')], ind = el.querySelector('.wi27'); if (!bs.length || !ind) return;
    f = Math.max(0, Math.min(bs.length - 1, f)); const i0 = Math.floor(f), i1 = Math.min(bs.length - 1, i0 + 1), t = f - i0, mid = b => b.offsetLeft + b.offsetWidth / 2;
    const x = mid(bs[i0]) + (mid(bs[i1]) - mid(bs[i0])) * t;
    ind.style.transition = live || !ind.dataset.set ? 'none' : ''; ind.style.transform = `translateX(${(x - 11).toFixed(1)}px)`; ind.dataset.set = '1';
    const on = Math.round(f); bs.forEach((b, i) => { b.classList.toggle('on', i === on); b.setAttribute('aria-selected', String(i === on)); });
  }
  const wColor = (lk, tm) => { const c = tm && tm.color ? '#' + String(tm.color).replace('#', '') : ((tm && tm.id && X.teamOf(lk, tm.id)) || {}).color || ''; return /^#[0-9a-f]{6}$/i.test(c) ? c : ''; };
  const wWho = new Map();   // player id -> { name, team } once the feed has answered
  function wItem(el, it, x, si) {
    store.set('v5:wtab', x.key);
    wInd(el, si, false);
    const who = el.querySelector('.wa27'), L = it.L, a = (it.aths || [])[0];
    if (!L || !a) { who.hidden = true; who.innerHTML = ''; return; }
    const lk = L.key, fol = X.follows(lk, a), src = X.headshotOf(L, a);
    const k = `${lk}:${a}`, known = wWho.get(k), fp = (store.get('v5:players', []) || []).find(p => p.lk === lk && String(p.id) === String(a)), col = (known && known.color) || (fp && fp.color) || '';
    if (col) who.style.setProperty('--c', col); else who.style.removeProperty('--c');
    who.hidden = false; who.innerHTML = `<a href="#player/${esc(lk)}/${esc(a)}" aria-label="Player page"><span><img src="${esc(src)}" alt="" onerror="this.closest('.wa27').hidden=true"></span></a>${fol ? '' : `<button data-wact="follow" data-lk="${esc(lk)}" data-id="${esc(a)}" aria-label="Follow this player">${WI.plus}</button>`}`;
    /* the player's name goes over the words once the feed has said who it is; the words are written after this runs */
    const show = w => Promise.resolve().then(() => { if (!el.__w || el.__w.item !== it || !w || !w.name) return; const cap = el.querySelector('.stcap'); if (!cap || cap.querySelector('.wn27')) return;
      const nm = document.createElement('div'); nm.className = 'wn27'; nm.dataset.w27 = ''; nm.innerHTML = `<a href="#player/${esc(lk)}/${esc(a)}">${esc(w.name)}</a>${w.team ? (w.teamId ? `<a class="tm" href="#team/${esc(lk)}/${esc(w.teamId)}">${esc(w.team)}</a>` : `<span>${esc(w.team)}</span>`) : ''}`; cap.prepend(nm); });
    if (known) return show(known);
    X.athlete(L, a).then(bio => { const p = bio && (bio.athlete || bio); if (!p || !p.displayName) return; const tm = p.team || {};
      const w = { name: p.displayName, short: p.shortName || p.displayName, team: tm.shortDisplayName || tm.name || tm.abbreviation || '', abbr: tm.abbreviation || '', teamId: tm.id ? String(tm.id) : '', img: (p.headshot && p.headshot.href) || src, color: wColor(lk, tm) };
      wWho.set(k, w); if (w.color && el.__w && el.__w.item === it) who.style.setProperty('--c', w.color); show(w); }, () => {});
  }
  async function wFollow(el, b) {
    const lk = b.dataset.lk, id = b.dataset.id, L = (HW.LEAGUES || {})[lk]; if (!L || b.dataset.busy) return; b.dataset.busy = '1';
    let w = wWho.get(`${lk}:${id}`);
    if (!w) { const bio = await X.athlete(L, id).catch(() => null); const p = bio && (bio.athlete || bio); if (p && p.displayName) { const tm = p.team || {}; w = { name: p.displayName, short: p.shortName || p.displayName, abbr: tm.abbreviation || '', teamId: tm.id ? String(tm.id) : '', img: (p.headshot && p.headshot.href) || X.headshotOf(L, id), color: wColor(lk, tm) }; } }
    if (!w) { delete b.dataset.busy; V.toast('Could not reach that player. Try again.'); return; }
    if (!X.follows(lk, id)) X.follow({ lk, id: String(id), name: w.name, short: w.short || w.name, img: w.img || '', team: w.abbr || '', teamId: w.teamId || '', color: w.color || '' });
    b.innerHTML = WI.tick; b.classList.add('ok'); V.toast(`Following ${w.name}`); stDirty = true; setTimeout(() => b.remove(), 900);
  }
  function wShare(it) {
    const url = `${location.origin}${location.pathname}#watch/${encodeURIComponent(it.id)}`;
    if (navigator.share) { navigator.share({ title: 'RIVL', text: it.title || '', url }).catch(() => {}); return; }
    const done = () => V.toast('Link copied'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => V.toast('Could not copy the link')); else V.toast('Sharing is not available here');
  }
  async function watchTab(startId) {
    if (document.querySelector('.story')) return;
    const srcs = ORDER.map(X.feedSource);
    if (!srcs.some(s => s.out)) await Promise.race([Promise.all(srcs.map(s => s.ready)), sleep(4000)]);
    let subs = X.watchSubs();
    for (let i = 0; i < 12 && !subs.some(x => x.key === 'w:fy'); i++) { if (i === 1) V.busy(true); await sleep(300); subs = X.watchSubs(); }   // the clip file may still be on its way
    V.busy(false);
    if (!subs.length) { V.toast('No clips right now. They show up after games tip off.'); return; }
    if (document.querySelector('.story')) return;
    let key = store.get('v5:wtab', 'w:fy'); if (startId) { const has = subs.find(x => x.key === 'w:fy' && x.its.some(i => i.id === startId)) || subs.find(x => x.its.some(i => i.id === startId)); if (has) key = has.key; else startId = ''; }
    if (!subs.some(x => x.key === key)) key = (subs.find(x => x.key === 'w:fy') || subs[0]).key;
    stDirty = true;
    V.storyOpen(key, startId, { watch: true, subs, chrome(el) { el.__subs = subs; wChrome(el); paintBar(); }, onItem: wItem, onSlide: wInd, onClose() { paintBar(); } });
  }
  /* a shared clip link (#watch/<id>) opens Watch on that clip once the first page is up */
  { const m = /^#watch(?:\/(.+))?$/.exec(location.hash || ''); if (m) { const id = m[1] ? decodeURIComponent(m[1]) : ''; try { history.replaceState(null, '', '#home'); } catch (e) { location.hash = '#home'; }
      if (on()) document.addEventListener('rivl:rendered', () => setTimeout(() => watchTab(id), 300), { once: true }); } }

  /* ---------- words ---------- */
  const greet = () => { const h = new Date().getHours(); const w = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; const n = String(store.get('v5:name', '') || '').trim().slice(0, 24); return n ? `${w}, ${n}` : w; };
  const dateLine = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const shortStanding = s => String(s || '').replace(' in the ', ' in ');
  const dayWord = g => { const w = relDay(ymd(g)); return w === 'Tonight' ? 'Today' : w; };
  const pctOf = ph => Math.round(Math.max(ph, 1 - ph) * 100);
  const projOf = (L, g, ctx) => { if (!V.prefs.get('forecast') || !ctx) return null; const f = U.safeF(L, g, ctx); return f && f.pHome != null && isFinite(f.pHome) ? f.pHome : null; };

  /* ---------- pieces ---------- */
  const head = (t, link, to, attr = '') => `<div class="sh27"><h2>${esc(t)}</h2>${link ? `<a href="${to}"${attr}>${link}</a>` : ''}</div>`;
  /* Story cards. Each is the small version of the player and team card: a picture fills it, with the name at the foot.
     A team's card is its logo on its colour, a player's is their photo. For you, Saved and a league's biggest plays
     take the picture of the first clip waiting inside.
     Order, the way Instagram does it: stories with something new first, watched ones at the back, For you and Saved
     always last; inside each group, the order you follow things in. The row does not shuffle while the feed is still
     loading or while a finger is on it: it re-sorts when a story is closed, and once everything has loaded. It opens
     from the last order it showed. */
  const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.500 14.300 9.200l6.700 2.300-6.700 2.300L12 20.500l-2.300-6.700L3 11.500l6.700-2.300z"/></svg>';
  const artOf = x => { if (x.art != null) return x.art; const it = (x.its || []).find(i => i.kind === 'vid' && i.thumb); return it ? it.thumb : ''; };
  const up916 = t => String(t || '').replace(/\.jpg(\?.*)?$/i, '_9x16.jpg');
  const storyCard = x => { const plain = x.kind === 'league' || x.kind === 'feed' || x.kind === 'saved'; const art = plain ? artOf(x) : '';
    const name = x.kind === 'player' ? String(x.full || x.name).split(' ')[0] : x.name;
    const pic = x.kind === 'player' ? (x.hs ? `<span class="sp27">${U.imgSized(x.hs, 350, 254, 'loading="eager"', "HW.v5.rv27.miss(this,'sp27')")}</span>` : `<span class="sp27 no27">${I.me}</span>`)
      : x.kind === 'team' ? `<span class="sg27">${x.logo ? U.imgSized(x.logo, 160, 160, 'loading="eager"', "this.outerHTML='<b>" + esc(String(x.abbr || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4)) + "</b>'") : `<b>${esc(String(x.abbr || '').slice(0, 4))}</b>`}</span>`
      : (art ? `<img class="sa27" src="${esc(up916(art))}" data-o="${esc(art)}" alt="" onerror="if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute('data-o')}else{this.parentNode.parentNode.classList.remove('art');this.remove()}">` : '')
        + (x.kind === 'league' ? `<i class="sb27">${esc(x.abbr || '')}</i>` : `<span class="si27">${x.kind === 'feed' ? SPARK : I.save}</span>`);
    return `<button class="sc27${plain ? ` k-${x.kind}${art ? ' art' : ''}` : ''}" data-s27="story" data-key="${esc(x.key)}" aria-label="${esc(x.full || x.name)} story"><span style="${plain ? '--c:#3a3f4b;--c1:#4b515d;--c2:#15171a' : cardVars(x.color)}">${pic}<small>${x.kind === 'feed' ? SPARK : ''}${esc(name)}</small></span></button>`; };
  const SC = 'v5:st27'; const stMem = new Map(); let stSig = '', stAt = 0, stT = 0, stOrder = [], stDirty = false, railAt = 0, railHeld = false;
  const stRank = () => { const F = favs.all(), P = V.fplayers.all(), r = new Map(); let n = 0;
    ORDER.forEach(lk => { (F[lk] || []).forEach(id => r.set(`${lk}:t${id}`, n++)); P.filter(p => p.lk === lk).forEach(p => r.set(`${lk}:p${p.id}`, n++)); r.set(`${lk}:top`, n++); });
    r.set('all:feed', n++); r.set('all:saved', n++); return r; };
  const stGroup = x => x.kind === 'feed' ? 0 : x.kind === 'saved' ? 3 : x.un ? 1 : 2;   // v469: For you leads the row, then what is new, then what has been watched, then Saved
  function storyList(fresh, loaded) {
    if (!stMem.size && !stAt) { (store.get(SC, []) || []).forEach(c => { if (c && c.key) { stMem.set(c.key, c); stOrder.push(c.key); } }); stOrder.sort((x, y) => (y === 'all:feed') - (x === 'all:feed')); }   // the row as it was last time
    fresh.forEach(x => stMem.set(x.key, x));
    const rank = stRank(), now = Date.now(), sig = fresh.map(x => x.key).sort().join(',');
    if (sig !== stSig || !stAt) { stSig = sig; stAt = now; clearTimeout(stT); stT = setTimeout(() => decorate(true), 6500); }
    [...stMem.keys()].forEach(k => { if (!rank.has(k)) stMem.delete(k); });   // unfollowed: gone at once
    const settled = loaded && now - stAt >= 6000;
    /* a story that has ended leaves only once every league has loaded and the list has held still for six seconds */
    if (settled) { const live = new Set(fresh.map(x => x.key)); [...stMem.keys()].forEach(k => { if (!live.has(k)) stMem.delete(k); }); }
    const ideal = [...stMem.values()].sort((a, b) => (stGroup(a) - stGroup(b)) || (rank.get(a.key) - rank.get(b.key))).map(x => x.key);
    const open = !!document.querySelector('.story'), touched = railHeld || now - railAt < 1200;
    if (!stOrder.length || ((settled || stDirty) && !open && !touched)) { stOrder = ideal; stDirty = false; }
    else { stOrder = stOrder.filter(k => stMem.has(k)); const at = new Map(ideal.map((k, i) => [k, i])); ideal.forEach(k => { if (stOrder.includes(k)) return; const i = stOrder.findIndex(o => at.get(o) > at.get(k)); if (i < 0) stOrder.push(k); else stOrder.splice(i, 0, k); });   // held: what is new takes its own place, nothing already there moves
      if ((settled || stDirty) && !open && touched) { clearTimeout(stT); stT = setTimeout(() => decorate(true), 1300); } }
    if (settled) store.set(SC, stOrder.map(k => { const x = stMem.get(k); return { key: x.key, kind: x.kind, name: x.name, full: x.full || '', color: x.color || '', logo: x.logo || '', abbr: x.abbr || '', hs: x.hs || '', un: !!x.un, art: artOf(x) }; }));
    return stOrder.map(k => stMem.get(k));
  }
  function railSync(rail, list) {
    const have = new Map([...rail.children].map(el => [el.dataset.key, el])); let prev = null;
    list.forEach(x => { const html = storyCard(x), h = hash(html); let el = have.get(x.key);
      if (!el || el.dataset.h !== h) { const t = document.createElement('template'); t.innerHTML = html; const neu = t.content.firstElementChild; neu.dataset.h = h; if (el) el.replaceWith(neu); el = neu; }
      el.classList.toggle('seen', !x.un); have.delete(x.key);
      const want = prev ? prev.nextSibling : rail.firstChild; if (el !== want) rail.insertBefore(el, want); prev = el; });
    have.forEach(el => el.remove()); rail.hidden = !list.length;
  }
  /* a card can be on screen a moment before its story has loaded (the row opens from last time): the tap waits for it */
  async function openStory(key) { stDirty = true;
    for (let i = 0; i < 18; i++) { if (X.storySubjects().some(x => x.key === key)) { V.busy(false); V.storyOpen(key); return; } if (i === 1) V.busy(true); await new Promise(r => setTimeout(r, 300)); }
    V.busy(false); V.toast('That story is still loading. Try again in a moment.');
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
  function clipsHtml(label, sub, its) {
    its = its.filter(i => i.kind === 'vid'); if (!sub || its.length < 3) return '';
    return `<div class="irule ir27"><span>${esc(label)}</span><button data-s27="clip" data-key="${esc(sub.key)}" data-id="${esc(its[0].id)}">Watch</button></div><div class="rl27 cv27">${its.map(it => `<button class="cl27" data-s27="clip" data-key="${esc(sub.key)}" data-id="${esc(it.id)}" aria-label="${esc(it.title)}">${it.thumb ? `<img src="${esc(up916(it.thumb))}" data-o="${esc(it.thumb)}" alt="" loading="lazy" onerror="if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute('data-o')}else this.remove()">` : ''}${it.rank ? `<i class="n">No. ${it.rank}</i>` : ''}<b>${esc(it.title)}</b></button>`).join('')}</div>`;
  }
  const topHtml = () => `<div class="hi27"><small>${esc(dateLine())}</small><b>${esc(greet())}</b></div><div class="sr27"><a class="sf27" href="#search" role="search" aria-label="Search">${I.search}<span>Search teams, players, anything</span></a></div>`;

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
        const loaded = ORDER.every(lk => { const f = (favs.all()[lk] || []).length || V.fplayers.all().some(p => p.lk === lk); return !f || (V.feedSrc[lk] && V.feedSrc[lk].out); });
        made = { top: topHtml(), stories: storyList(subsNow, loaded), list: [
          ['plays', 0, tops ? clipsHtml(`Biggest plays · ${(LEAGUES[tops.lk] || {}).short || ''}`, tops, tops.its.slice(0, 10)) : ''],
          ['picks', 3, picksHtml(outs, P)],
          ['clips', 9, mine ? clipsHtml('For you', mine, mine.its.slice(0, 10)) : ''],
          ['league', 14, leagueHtml(outs)]] };
        X.warm([...(tops ? tops.its.slice(0, 6) : []), ...(mine ? mine.its.slice(0, 6) : [])]); }
      /* the top: date and greeting, search, stories */
      let top = $main.querySelector(':scope > .t27'); if (!top) { top = document.createElement('div'); top.className = 't27 h27'; }
      if ($main.firstElementChild !== top) $main.insertBefore(top, $main.firstChild);
      let hd = top.querySelector(':scope > .hd27'), rail = top.querySelector(':scope > .st27');
      if (!hd) { top.innerHTML = '<div class="hd27"></div><div class="rl27 st27" hidden></div>'; hd = top.firstChild; rail = top.lastChild; }
      const th = hash(made.top); if (hd.dataset.h !== th) { hd.dataset.h = th; hd.innerHTML = made.top; }
      railSync(rail, made.stories);
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
  /* a finger on the story row, or the row still coasting, holds its order */
  $main.addEventListener('touchstart', e => { if (e.target.closest && e.target.closest('.st27')) { railHeld = true; railAt = Date.now(); } }, { passive: true });
  ['touchend', 'touchcancel'].forEach(ev => $main.addEventListener(ev, () => { if (railHeld) { railHeld = false; railAt = Date.now(); } }, { passive: true }));
  document.addEventListener('scroll', e => { const t = e.target; if (t && t.classList && t.classList.contains('st27')) railAt = Date.now(); }, { capture: true, passive: true });
  mo = new MutationObserver(() => decorate(false)); mo.observe($main, { childList: true, subtree: true });
  ['rivl:rendered', 'rivl:polled'].forEach(ev => document.addEventListener(ev, () => decorate(true)));
  $main.addEventListener('click', e => {
    const p = e.target.closest('[data-pick27]');
    if (p && on()) { e.preventDefault(); const k = p.dataset.pick27; const i = k.lastIndexOf(':'); if (pick(k.slice(0, i), k.slice(i + 1), outsNow())) decorate(true); return; }
    const b = e.target.closest('[data-s27]'); if (!b || !b.closest('.h27')) return; const a = b.dataset.s27;
    if (a === 'watch') { e.preventDefault(); watch(); return; }
    if (a === 'story') { e.preventDefault(); openStory(b.dataset.key); return; }
    if (a === 'clip') { e.preventDefault(); stDirty = true; watch(b.dataset.id, b.dataset.key); return; }
  });

  /* with the preview on, Home is the Following feed and nothing else: one feed for what you follow */
  const home0 = V.home;
  V.home = (...a) => { if (on() && a[0] !== 'following') { store.set('v5:hometab', 'following'); return V.rerender(); } return home0(...a); };
  paintBar();
})();
