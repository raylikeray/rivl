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
    row: () => `<div class="gl"><button class="gr ni sw" data-act="rv27" role="switch" aria-checked="${on()}"><span class="sico" data-k="look"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.500 13.900 9l5.600 1.900-5.600 1.900L12 18.300l-1.900-5.500L4.500 10.900 10.100 9z"/></svg></span><span class="gm wrap"><b>Try the new design</b><span>A preview of the 2027 look. Switch it off any time.</span></span><span class="switch"></span></button></div>` };

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
  /* Glow (v493, Ray's pick from Round 10): a dark card lit by each team's colour from its own side. A team whose colour is
     near black (Spurs, Nets) glows in its second colour, or a lifted version of the first, so the light always shows. */
  const hx6 = c => { c = String(c || '').replace('#', ''); return /^[0-9a-f]{6}$/i.test(c) ? '#' + c : ''; };
  const glowC = t => { let c = hx6(t && t.color) || '#5b6b8c'; const al = hx6(t && (t.alt || t.alternateColor)), l = U.lumOf(c); if (l < .1) c = al && U.lumOf(al) > .2 && U.lumOf(al) < .92 ? al : U.mixTo(c, 255, .5); else if (l < .2) c = U.mixTo(c, 255, .22); return c; };
  function sRow(L, g, ctx) {
    const live = isLive(g) && !g.off, fin = g.state === 'post' && !g.off, h = +g.home.score || 0, a = +g.away.score || 0, sc = live || fin;
    let st; if (g.off) st = `${esc(g.off)}`; else if (live) st = `<em><i></i>${esc(g.detail || 'Live')}</em><small>${leadWord(g)}</small>`;
    else if (fin) { const c = clipWord(g); st = `${esc(finalWord(g))}${c ? `<small>${c}</small>` : ''}`; }
    else { const p = projWord(L, g, ctx); st = `${esc(noTz(tipOf(g)))}${p ? `<small>RIVL: ${esc(p.t.abbr)} ${p.pct}%</small>` : g.tv ? `<small>${esc(String(g.tv).split(',')[0])}</small>` : ''}`; }
    const nm = t => { const n = t.short || t.name || t.abbr || ''; return n.length > 10 && t.abbr ? t.abbr : n; };
    const side = (t, r, lose) => `<span class="gn27${r ? ' r' : ''}${lose ? ' lo' : ''}">${sc ? `<b class="n">${esc(String(t.score == null ? '' : t.score))}</b><small>${t.rank ? `${t.rank} ` : ''}${esc(nm(t))}</small>` : `<b>${t.rank ? `<i>${t.rank}</i>` : ''}${esc(nm(t))}</b>${t.rec ? `<small>${esc(t.rec)}</small>` : ''}`}</span>`;
    const p2 = !sc && !g.off ? projWord(L, g, ctx) : null, aw = p2 ? (p2.home ? 100 - p2.pct : p2.pct) : 0;
    return `<a class="g27 gw27${isFav(g) ? ' my' : ''}${live ? ' lv' : ''}" href="${U.href.game(L.key, g.id)}" style="--a:${glowC(g.away)};--h:${glowC(g.home)}">${disc(g.away, 40)}${side(g.away, 0, sc && a < h)}<span class="st27${live ? ' lv' : ''}">${st}</span>${side(g.home, 1, sc && h < a)}${disc(g.home, 40)}${p2 ? `<span class="gm27"><i style="width:${aw}%"></i></span>` : ''}</a>`;
  }
  function sHero(L, g, ctx) {
    const live = isLive(g) && !g.off, fin = g.state === 'post' && !g.off, h = +g.home.score || 0, a = +g.away.score || 0;
    const top = g.off ? esc(g.off) : live ? `<i></i>${esc(periodWord(L, g))}` : fin ? esc(finalWord(g)) : `${esc(relDay(ymd(g)))} · ${esc(noTz(tipOf(g)))}`;
    const mid = live || fin ? `<b class="${a < h ? 'lo' : ''}">${a}</b><em></em><b class="${h < a ? 'lo' : ''}">${h}</b>` : `<u>at</u>`;
    const p = projWord(L, g, ctx), c = fin ? clipWord(g) : '', aw = p ? (p.home ? 100 - p.pct : p.pct) : 50;
    const foot = p ? `<span class="gmt27"><i style="width:${aw}%"></i><u style="left:${aw}%"></u></span><span class="gft27"><b>${esc(g.away.abbr || '')} ${aw}%</b><span>RIVL projection</span><b>${100 - aw}% ${esc(g.home.abbr || '')}</b></span>` : `<span class="gft27 one"><b>${live ? leadWord(g) : c || (g.tv ? esc(String(g.tv).split(',')[0]) : '')}</b></span>`;
    const side = t => `<span class="gs27">${disc(t, 58)}<b>${esc(t.short)}</b></span>`;
    return `<a class="hero27 gw27${live ? ' lv' : ''}" href="${U.href.game(L.key, g.id)}" style="--a:${glowC(g.away)};--h:${glowC(g.home)}"><span class="gin27"><span class="gbl27 a"></span><span class="gbl27 h"></span><span class="gtp27">${top}</span><span class="grw27">${side(g.away)}<span class="gsc27">${mid}</span>${side(g.home)}</span>${foot}</span></a>`;
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
/* v477: a player the feed has no photo for (or whose photo fails) shows his initials in a ring instead of an empty card */
    const ini = n => String(n || '').split(/\s+/).filter(w => /^[A-Za-z]/.test(w) && !/^(jr|sr|ii|iii|iv|v)\.?$/i.test(w)).map(w => w[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();
    const noPic = "this.replaceWith(Object.assign(document.createElement('span'),{className:'in27',textContent:this.dataset.i}))";
    const cut = (p, w, h) => p.img ? U.imgSized(p.img, w, h, `class="cu27" data-i="${esc(ini(p.n))}"`, noPic) : `<span class="in27">${esc(ini(p.n))}</span>`;
    const face = p => p.img ? U.imgSized(p.img, 160, 116, `data-i="${esc(ini(p.n))}"`, "this.parentNode.textContent=this.dataset.i") : esc(ini(p.n));
    const grad3 = (c, a) => `linear-gradient(${a}deg,${U.mixTo(c, 255, .16)},${c} 55%,${U.mixTo(c, 0, .6)})`;
    const label = `${who === 'rookies' ? 'Rookies, ' : ''}${who === 'rookies' ? C[2] : C[2].charAt(0).toUpperCase() + C[2].slice(1)}`;
    let h = '';
    if (!rows.length) h = `<div class="em27"><b>Nobody qualifies yet</b><p>A player needs half of the games played and regular minutes to be ranked.</p></div>`;
    else {
      const a = rows[0];
      /* the card: team colour, the logo large and white behind the player, two angled bands in the second colour */
      const vars = p => { const c = colorOf(p), t = byAbbr[p.team] || {}; let al = U.teamAlt({ id: t.id, abbr: p.team, alt: t.alt }, L) || ''; let bo = '.92'; if (!al || Math.abs(U.lumOf(al) - U.lumOf(c)) < .08) { al = '#ffffff'; bo = '.16'; }   // no second colour to speak of: quiet white stripes
        return `--bo:${bo};--c:${c};--c1:${U.mixTo(c, 255, .22)};--c2:${U.mixTo(c, 0, .6)};--a:${al};--at:${U.lumOf(al) > .45 ? '#0b0c0e' : '#ffffff'}`; };
      const back = p => `<span class="lbd27"></span><span class="lgl27"></span>`;
      /* v477: the team's logo sits beside the place, at the top left, in its own colours (behind the player it read as a random shape) */
      const tlogo = p => { const t = byAbbr[p.team] || {}; return t.logo ? `<span class="llg27">${U.imgSized(t.logo, 128, 128, '', "this.parentNode.remove()")}</span>` : ''; };
      h += `<a class="l1x27" href="${U.href.player(lk, a.p.id)}" style="${vars(a.p)}">${back(a.p)}${cut(a.p, 500, 364)}<span class="lsh27"></span><span class="lt27"><i>1</i>${tlogo(a.p)}${esc(label)}</span><span class="lf27"><strong>${one(a.v)}</strong><b>${esc(a.p.n)}</b><small>${sub(a.p)}</small></span></a>`;
      if (rows.length > 1) h += `<div class="l2x27">${rows.slice(1, 3).map((x, i) => `<a href="${U.href.player(lk, x.p.id)}" style="${vars(x.p)}">${back(x.p)}${cut(x.p, 500, 364)}<span class="lsh27"></span><span class="lt27 sm"><i>${i + 2}</i>${tlogo(x.p)}</span><span class="l2f27"><strong>${one(x.v)}</strong><b>${esc(x.p.sn || x.p.n)}</b><small>${sub(x.p)}</small></span></a>`).join('')}</div>`;
      h += `<div class="lr27">${rows.slice(3).map((x, i) => { const c = colorOf(x.p); return `<a href="${U.href.player(lk, x.p.id)}"><span>${i + 4}</span><span class="fc27" style="background:linear-gradient(160deg,${U.mixTo(c, 255, .12)},${U.mixTo(c, 0, .45)})">${face(x.p)}</span><span class="tx27"><b>${esc(x.p.n)}<small>${sub(x.p)}</small></b><i><s style="width:${Math.max(4, Math.round(x.v / (a.v || 1) * 100))}%;background:${U.lumOf(c) < .06 ? U.mixTo(c, 255, .45) : c}"></s></i></span><strong>${one(x.v)}</strong></a>`; }).join('')}</div>`;
    }
    const note = lg.lastSeason ? `<p class="ln27n">${esc(lg.label)} season. The new season's numbers take over once it has games.</p>` : `<p class="ln27n">Per game, ${esc(lg.label || '')}. A player needs half of the games played to be ranked.</p>`;
    const html = pills + cats + h + note, hh = hash(html); if (pg.dataset.h !== hh) { const sx = pg.querySelector('.sx27'), x0 = sx ? sx.scrollLeft : 0; pg.innerHTML = html; pg.dataset.h = hh; const s2 = pg.querySelector('.sx27'); if (s2) { s2.scrollLeft = x0; const onb = s2.querySelector('.on'); if (onb && (onb.offsetLeft + onb.offsetWidth > s2.scrollLeft + s2.clientWidth || onb.offsetLeft < s2.scrollLeft)) s2.scrollLeft = Math.max(0, onb.offsetLeft - 18); } }
  }
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
    const hero = `<a class="r1x27" href="${href(a)}"><span class="rn27" aria-hidden="true">${a.rank || 1}</span><span class="rsw27"></span><span class="lsh27"></span>${a.img ? `<span class="rpx27"><img src="${esc(a.img)}" alt="" onerror="this.parentNode.remove()"></span>` : ''}<span class="lt27">${a.rank || 1} \u00b7 Class of ${esc(cls)}</span><span class="rf27"><b>${esc(a.n)}</b><span class="rh27">${esc([a.hs, a.home].filter(Boolean).join(' \u00b7 '))}</span><span class="rc27">${[a.pos, a.ht, a.wt ? a.wt + ' lb' : ''].filter(Boolean).map(x => `<i>${esc(x)}</i>`).join('')}</span><span class="rw27">${where(a, true)}</span></span></a>`;
    const row = r => `<a href="${href(r)}"><span>${r.rank || ''}</span><span class="fc27 rp27">${pic(r, 0, 0, '')}</span><span class="tx27"><b>${esc(r.n)}</b><small>${esc([r.pos, r.ht, r.hs].filter(Boolean).join(' \u00b7 '))}</small></span>${where(r, false)}</a>`;
    const rest = list.slice(1), N = 9;
    const html = `<div class="pl27">${classes.map(c => `<button data-ld="cls" data-v="${esc(c)}" class="${c === cls ? 'on' : ''}" aria-pressed="${c === cls}">Class of ${esc(c)}</button>`).join('')}</div>${hero}<h2 class="rh2x27">Top of the class</h2><div class="lr27 rr27x">${rest.slice(0, N).map(row).join('')}${rest.length > N ? `<div class="mo27" hidden>${rest.slice(N).map(row).join('')}</div><button class="mb27" data-a27="more">Show all ${list.length}</button>` : ''}</div><p class="ln27n">${g === 'girls' ? 'Girls' : 'Boys'} high-school class of ${esc(cls)}, ranked by PrepRanks.</p>`;
    const hh = hash(html); if (pg.dataset.h !== hh) { pg.innerHTML = html; pg.dataset.h = hh; }
  }
  { const st0 = V.stats; V.stats = (lk, ...a) => on() ? stats27(lk) : st0(lk, ...a); }

  /* ---------- You (v486): who you are at the top, then one thing per tab: Teams, Players, Saved, Liked, Picks. The top is
     the same poster as a player's or team's page, in your top team's colours, with your photo in the ring. Settings sits
     behind the menu button. Your name and photos stay on this phone. ---------- */
  const me = { photo: '', header: '', ready: false };
  const idb = { db: null,
    open() { return this.db || (this.db = new Promise((res, rej) => { try { const r = indexedDB.open('rivl-me', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } })); },
    async get(k) { try { const d = await this.open(); return await new Promise(res => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result || ''); q.onerror = () => res(''); }); } catch (e) { return ''; } },
    async set(k, v) { try { const d = await this.open(); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); if (v) t.objectStore('kv').put(v, k); else t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return false; } } };
  const meLoad = idb.get('photo').then(async p => { me.photo = p || ''; me.header = (await idb.get('header')) || ''; me.ready = true; if (root.dataset.page === 'settings' && $main.querySelector('#you27')) you27(); });
  const YT = [['teams', 'Teams'], ['players', 'Players'], ['saved', 'Saved'], ['liked', 'Liked'], ['picks', 'Picks']];
  const followedTeams = outs => ORDER.flatMap(lk => { const o = outs.find(x => x.lk === lk); const ids = (favs.all()[lk] || []).map(String); return ids.map(id => { const t = (o && (o.myTeams || []).find(x => String(x.id) === id)) || (o && o.tIdx && o.tIdx[id]) || null; return t ? { lk, o, t: Object.assign({ id }, t) } : { lk, o, t: { id, short: 'Team', name: 'Team', abbr: '', color: '', logo: '' } }; }); });
  const topTeam = list => { const k = store.get('v5:topteam', ''); return list.find(x => `${x.lk}:${x.t.id}` === k) || list[0] || null; };
  const chev = '<svg class="cv" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const yTeamCard = (x, top) => { const { o, t, lk } = x; const live = (S.today[lk] || []).find(g => isLive(g) && (String(g.home.id) === String(t.id) || String(g.away.id) === String(t.id)));
    const vs = g => { const home = String(g.home.id) === String(t.id); return `${home ? 'vs' : 'at'} ${(home ? g.away : g.home).abbr}`; }; let nxt = '';
    if (live) { const home = String(live.home.id) === String(t.id); const us = home ? live.home : live.away, th = home ? live.away : live.home; nxt = `<em><i></i>Live · ${esc(String(us.score ?? ''))}-${esc(String(th.score ?? ''))}</em>`; }
    else if (t.nx) nxt = `<em>${esc(noTz(tipOf(t.nx)))} ${esc(vs(t.nx))}</em>`; else if (t.next && t.next.state !== 'post') nxt = `<em>${esc(relDay(ymd(t.next)))} ${esc(vs(t.next))}</em>`;
    const line = [t.rec, t.rank ? `No. ${t.rank}` : shortStanding(t.standing)].filter(Boolean).join(' · ');
    return `<a class="tc27" href="${U.href.team(lk, t.id)}" style="${cardVars(t.color)}">${mark27(t.logo)}${top ? '<i class="tp27" title="Your top team">★</i>' : ''}<span class="lg27">${t.logo ? U.imgSized(t.logo, 200, 200, '', "this.remove()") : `<b>${esc(String(t.abbr || '').slice(0, 4))}</b>`}</span><span class="pt27"><b>${esc(t.short || t.name)}</b>${line ? `<small>${esc(line)}</small>` : ''}${nxt}</span></a>`; };
  const yPlayerCard = (p, outs, lines) => { const L = LEAGUES[p.lk]; const o = outs.find(z => z.lk === p.lk), x = lines.get(`${p.lk}:${p.id}`);
    const tm = (x && x.us) || (o && o.tIdx && p.teamId && o.tIdx[String(p.teamId)]) || null, color = tm ? U.teamColor(tm, L) : U.playerColor(p, L);
    const nm0 = p.short || p.name || '', nm = nm0.length > 17 ? V.lastName(p.name || nm0) : nm0;
    const line = x && !x.dnp ? `${x.pts} pts · ${x.reb} reb · ${x.ast} ast` : x ? x.dnp : (tm && (tm.short || tm.name)) || p.team || L.short;
    return `<a class="pc27" href="${U.href.player(p.lk, p.id)}" style="${cardVars(color)}" aria-label="${esc(p.name || nm)}">${mark27(tm && tm.logo)}${p.img ? `<span class="ph27">${U.imgSized(p.img, 600, 436, '', 'HW.v5.rv27.miss(this)')}</span>` : `<span class="ph27 no27">${I.me}</span>`}<span class="pt27"><b${nm.length > 14 ? ' class="lg27n"' : ''}>${esc(nm)}</b><small class="n">${esc(String(line))}</small></span></a>`; };
  /* a list that mixes leagues is split by league, and each league can be closed */
  const yGroups = (tab, groups) => { const fold = (store.get('v5:youfold', {}) || {})[tab] || [], multi = groups.length > 1;
    return groups.map(g => { const shut = multi && fold.includes(g.lk);
      return (multi ? `<button class="gh27" data-you="fold" data-tab="${tab}" data-lk="${g.lk}" aria-expanded="${!shut}"><b>${esc(LEAGUES[g.lk].short || LEAGUES[g.lk].label)}</b><span>${g.cards.length}</span>${shut ? `<span class="stk27">${g.thumbs.slice(0, 4).join('')}</span>` : ''}${chev}</button>` : '') + (shut ? '' : `<div class="yg27">${g.cards.join('')}</div>`); }).join(''); };
  const yClipGrid = (its, kind) => its.length ? `<p class="yn27">${its.length} clip${its.length === 1 ? '' : 's'}</p><div class="cg27">${its.map(it => `<button data-you="clip" data-kind="${kind}" data-id="${esc(it.id)}" aria-label="${esc(it.title)}">${it.thumb ? `<img src="${esc(up916(it.thumb))}" data-o="${esc(it.thumb)}" alt="" loading="lazy" onerror="if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute('data-o')}else this.remove()">` : ''}<b>${esc(it.title)}</b></button>`).join('')}</div>` : '';
  const yEmpty = (t, b, link, label) => `<div class="em27"><b>${t}</b><p>${b}</p>${link ? `<a href="${link}">${label}</a>` : ''}</div>`;
  function yPicks(outs) {
    const P = settle(outs), all = Object.entries(P).map(([k, p]) => Object.assign({ k }, p)).sort((a, b) => new Date(b.date) - new Date(a.date));
    let w = 0, l = 0, rw = 0, rl = 0; all.forEach(p => { if (p.res === 'w') w++; else if (p.res === 'l') l++; if (p.res === 'w' || p.res === 'l') { if (p.rv === 'w') rw++; else if (p.rv === 'l') rl++; } });
    let streak = ''; { const done = all.filter(p => p.res === 'w' || p.res === 'l'); if (done.length) { let n = 0; for (const p of done) { if (p.res === done[0].res) n++; else break; } streak = `${done[0].res === 'w' ? 'W' : 'L'}${n}`; } }
    const today = picksHtml(outs, P);
    if (!all.length) return (today || '') + (today ? '' : yEmpty('No picks yet', 'Pick a side before a game tips off, on Home or right here when games are on. RIVL shows its own projection once you have picked.'));
    const diff = (w - l) - (rw - rl), sent = rw + rl ? (diff === 0 ? `Level with RIVL on the same ${rw + rl} game${rw + rl === 1 ? '' : 's'}.` : `${Math.abs(diff) / 2 === 1 ? 'One game' : (Math.abs(diff) / 2) + ' games'} ${diff > 0 ? 'up on' : 'behind'} RIVL on the same ${rw + rl} game${rw + rl === 1 ? '' : 's'}.`) : '';
    const rec = w + l ? `<section class="ldc27 yr27"><div class="big"><b>${w}-${l}</b><span>Your picks</span></div><div class="rs"><div class="tri"><span><b>${rw + rl ? `${rw}-${rl}` : '–'}</b><small>RIVL</small></span><span><b>${Math.round(w / (w + l) * 100)}%</b><small>Right</small></span><span><b>${streak || '–'}</b><small>Streak</small></span></div>${sent ? `<p>${sent}</p>` : ''}</div></section>` : '';
    const days = new Map(); all.forEach(p => { const d = HW.ymdOf(p.date); if (!days.has(d)) days.set(d, []); days.get(d).push(p); });
    const row = p => { const L = LEAGUES[p.lk], t = X.teamOf(p.lk, p.tid) || { abbr: (p.tn || '').slice(0, 3).toUpperCase(), logo: '' }, g = gameOf(p.k);
      const homeN = p.side === 'home' ? p.tn : p.on, awayN = p.side === 'home' ? p.on : p.tn, rivlN = p.ph == null ? '' : (p.ph >= .5 ? homeN : awayN);
      let line, mk = '<i class="mk27"></i>';
      if (p.res === 'w' || p.res === 'l') { const mine = p.fs ? (p.side === 'home' ? p.fs[1] : p.fs[0]) : '', th = p.fs ? (p.side === 'home' ? p.fs[0] : p.fs[1]) : '';
        line = `${p.res === 'w' ? 'Won' : 'Lost'}${p.fs ? ` ${mine}-${th}` : ''} ${p.ha} ${esc(p.on)}${rivlN ? ` · ${rivlN === p.tn ? 'RIVL too' : `RIVL had ${esc(rivlN)}`}` : ''}`; mk = p.res === 'w' ? `<i class="mk27 w" aria-label="Right">${I.check}</i>` : `<i class="mk27 l" aria-label="Wrong"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></i>`; }
      else if (p.res === 'x') line = `Not played · ${p.ha} ${esc(p.on)}`;
      else if (g && isLive(g)) { const us = p.side === 'home' ? g.home : g.away, th = p.side === 'home' ? g.away : g.home; line = `<u></u>${esc(g.detail || 'Live')}, ${+us.score > +th.score ? 'up' : +us.score < +th.score ? 'down' : 'tied'} ${us.score}-${th.score}${rivlN ? ` · RIVL has ${esc(rivlN)} ${pctOf(p.ph)}%` : ''}`; }
      else line = `${esc(noTz(tipOf({ date: p.date })))} ${p.ha} ${esc(p.on)}${rivlN ? ` · RIVL has ${esc(rivlN)} ${pctOf(p.ph)}%` : ''}`;
      return `<a class="pr27" href="${U.href.game(p.lk, p.id)}">${disc(t, 32)}<span><b>${esc(p.tn)}</b><small>${line}</small></span>${mk}</a>`; };
    const hist = [...days.entries()].map(([d, ps]) => { const done = ps.filter(p => p.res === 'w' || p.res === 'l'), right = done.filter(p => p.res === 'w').length;
      return `<div class="pd27"><b>${esc(relDay(d))}</b>${done.length ? `<span>${right} of ${done.length}</span>` : ''}</div>${ps.map(row).join('')}`; }).join('');
    return rec + (today || '') + hist;
  }
  function yBody(tab, outs) {
    const lines = new Map(); outs.forEach(o => (o.lines || []).forEach(x => lines.set(`${o.lk}:${x.p.id}`, x)));
    if (tab === 'teams') { const list = followedTeams(outs), top = topTeam(list); if (!list.length) return yEmpty('No teams yet', 'Follow a team and its games, news and stories show up on Home.', '#settings/following', 'Add a team');
      return yGroups('teams', ORDER.map(lk => ({ lk, items: list.filter(x => x.lk === lk) })).filter(g => g.items.length).map(g => ({ lk: g.lk, cards: g.items.map(x => yTeamCard(x, x === top)), thumbs: g.items.map(x => disc(x.t, 24)) }))); }
    if (tab === 'players') { const all = V.fplayers.all().filter(p => LEAGUES[p.lk]); if (!all.length) return yEmpty('No players yet', 'Follow a player and their lines, clips and stories show up on Home.', '#settings/following', 'Add a player');
      return yGroups('players', ORDER.map(lk => ({ lk, items: all.filter(p => p.lk === lk) })).filter(g => g.items.length).map(g => ({ lk: g.lk, cards: g.items.map(p => yPlayerCard(p, outs, lines)), thumbs: g.items.map(p => `<span class="tf27">${p.img ? U.imgSized(p.img, 160, 116, '', 'this.remove()') : ''}</span>`) }))); }
    if (tab === 'saved') return yClipGrid(X.savedItems(), 'saved') || yEmpty('Nothing saved yet', 'Tap Save on a clip and it is kept here.');
    if (tab === 'liked') return yClipGrid(X.stLikedItems(), 'liked') || yEmpty('No liked clips yet', 'Tap the heart on a clip and it shows up here. Clips liked before this update are counted but not listed.');
    return yPicks(outs);
  }
  /* the name sits beside the photo, so it wraps to two lines and is sized by its longest word */
  const nmCls = n => { const w = Math.max(...String(n).split(/\s+/).map(x => x.length)); return w <= 4 ? '' : w <= 6 ? 'n2' : w <= 8 ? 'n3' : w <= 10 ? 'n4' : 'n5'; };
  let youEdit = false;
  async function you27() {
    if (!me.ready) await Promise.race([meLoad, sleep(600)]);
    const srcs = ORDER.map(X.feedSource); if (!srcs.some(s => s.out)) await Promise.race([Promise.all(srcs.map(s => s.ready)), sleep(2500)]);
    if (root.dataset.page !== 'settings') return;
    const outs = outsNow(), list = followedTeams(outs), top = topTeam(list), name = String(store.get('v5:name', '') || '').trim();
    const c = top ? tone(U.teamColor(top.t, LEAGUES[top.lk])) : '#2a3350'; let al = top ? (U.teamAlt({ id: top.t.id, abbr: top.t.abbr, alt: top.t.alt }, LEAGUES[top.lk]) || '') : ''; if (!al || Math.abs(U.lumOf(al) - U.lumOf(c)) < .08) al = '#ffffff';
    const own = store.get('v5:header', 'team') === 'photo' && me.header;
    const vars = `--a:${c};--ad:${U.mixTo(c, 0, .58)};--a2:${al};--a3:${U.mixTo(c, 255, .28)}`;
    const letters = top && top.t.abbr ? `${top.t.abbr} ${top.t.abbr}` : '';
    const nLikes = X.stLikes().length, nPl = V.fplayers.all().length;
    let tab = store.get('v5:youtab', 'teams'); if (!YT.some(t => t[0] === tab)) tab = 'teams';
    const face = me.photo ? `<img src="${me.photo}" alt="">` : `<b>${esc((name || 'You').charAt(0).toUpperCase())}</b>`;
    const head = `<header class="yh27" style="${vars}"><div class="bn27${own ? ' ph' : ''}"${own ? ` style="background-image:url(${me.header})"` : ''}><u>${own ? '' : esc(letters)}</u><span class="hs27"></span><span class="hg27"></span><span class="hr27"></span><i></i></div><a class="ym27" href="#settings/menu" aria-label="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></a><span class="yp27f">${face}</span><div class="ynm27"><h1 class="${nmCls(name || 'You')}">${esc(name || 'You')}</h1><p>${top ? `Top team · <b>${esc(top.t.short || top.t.name)}</b>` : 'No top team yet'}</p></div><button class="ye27" data-you="edit">Edit profile</button></header>`;
    const counts = `<div class="yc27"><div><b>${list.length}</b><span>Teams</span></div><div><b>${nPl}</b><span>Players</span></div><div><b>${nLikes}</b><span>Likes</span></div></div><div class="ya27"><a href="#settings/following">Add a team</a><a href="#settings/following">Add a player</a></div>`;
    const tabs = `<nav class="ytb27" aria-label="Your things">${YT.map(([k, l]) => `<button data-you="tab" data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-pressed="${k === tab}">${l}</button>`).join('')}</nav>`;
    /* each part is repainted only when it changed (v487): tapping a tab or closing a league must not redraw the top, or your
       name and photo play their entrance again. The entrance runs once per visit; .once27 switches it off after that. */
    let pg = $main.querySelector('#you27'); if (!pg) { $main.innerHTML = `<div id="you27" class="h27 yp27"></div>`; pg = $main.querySelector('#you27'); setTimeout(() => pg.classList.add('once27'), 1300); }
    const mode = youEdit ? 'edit' : 'view';
    if (youEdit) { const html = yEditHtml(name, list, top, vars, own), h = hash(html); if (pg.dataset.m !== mode || pg.dataset.h !== h) { pg.innerHTML = html; pg.dataset.h = h; } pg.dataset.m = mode; }
    else {
      if (pg.dataset.m !== mode) { pg.innerHTML = '<div id="yhd27"></div><div id="ycn27"></div><div id="ytb27"></div><div id="yb27"></div>'; pg.dataset.m = mode; pg.dataset.h = ''; }
      const put = (id, html) => { const el = pg.querySelector('#' + id), h = hash(html); if (el && el.dataset.h !== h) { el.innerHTML = html; el.dataset.h = h; } };
      put('yhd27', head); put('ycn27', counts); put('ytb27', tabs); const bd = pg.querySelector('#yb27'); bd.dataset.tab = tab; put('yb27', yBody(tab, outs));
    }
    V.refresh = () => { if (!youEdit) you27(); }; V.refresh.every = 60000;
  }
  function yEditHtml(name, list, top, vars, own) {
    const hdr = store.get('v5:header', 'team') === 'photo' && me.header ? 'photo' : 'team';
    return `<div class="yed27"><div class="yeb27"><button data-you="cancel">Cancel</button><b>Edit profile</b><button data-you="save" class="sv">Save</button></div>
      <div class="yh27 sm" style="${vars}"><div class="bn27${own ? ' ph' : ''}"${own ? ` style="background-image:url(${me.header})"` : ''}><u></u><span class="hs27"></span><i></i></div><button class="cam27 c1" data-you="pickh" aria-label="Change header">${CAM}</button><span class="yp27f">${me.photo ? `<img src="${me.photo}" alt="">` : `<b>${esc((name || 'You').charAt(0).toUpperCase())}</b>`}<button class="cam27" data-you="pickp" aria-label="Change profile photo">${CAM}</button></span></div>
      <label class="yf27"><span>Name</span><input id="yname27" type="text" maxlength="24" autocomplete="given-name" value="${esc(name)}" placeholder="Your name"></label>
      <label class="yf27"><span>Top team</span><select id="ytop27">${list.length ? list.map(x => `<option value="${esc(x.lk + ':' + x.t.id)}"${x === top ? ' selected' : ''}>${esc(x.t.name || x.t.short)} (${esc(LEAGUES[x.lk].short || x.lk)})</option>`).join('') : '<option value="">Follow a team first</option>'}</select></label>
      <div class="yf27"><span>Header</span><div class="yhc27"><button data-you="hdr" data-v="team" class="${hdr === 'team' ? 'on' : ''}" aria-pressed="${hdr === 'team'}">Top team colors</button><button data-you="hdr" data-v="photo" class="${hdr === 'photo' ? 'on' : ''}" aria-pressed="${hdr === 'photo'}">Your own photo</button></div></div>
      ${me.photo ? '<button class="yrm27" data-you="rmphoto">Remove profile photo</button>' : ''}
      <p class="yno27">Your header follows your top team until you add a photo. Your name and photos stay on this phone.</p>
      <input type="file" accept="image/*" id="yfile27" hidden></div>`;
  }
  const CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.500A2 2 0 0 1 6 6.500h1.600l1.300-2h6.200l1.300 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.500" r="3.400"/></svg>';
  /* Move and zoom (v488): a picked photo opens here first, so you place it yourself. The frame is the round profile photo or
     the header band; drag to move, pinch or use the slider to zoom. The untouched photo is kept on the phone beside the cut
     one, so tapping the camera later reopens it exactly where you left it. */
  const CROP = { photo: { out: [400, 400], round: true }, header: { out: [1236, 888], round: false } };
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image')); im.src = src; });
  const fitOrig = async file => { const url = URL.createObjectURL(file); try { const im = await loadImg(url), k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .9); } finally { URL.revokeObjectURL(url); } };
  function cropOpen(kind, orig, st) { return new Promise(async done => {
    let im; try { im = await loadImg(orig); } catch (e) { V.toast('That file could not be read as a photo.'); return done(null); }
    const cf = CROP[kind], vw = Math.min(window.innerWidth, 640), fw = cf.round ? Math.min(vw - 48, 340) : vw, fh = cf.round ? fw : Math.round(fw * 296 / 412);
    const iw = im.naturalWidth, ih = im.naturalHeight, s0 = Math.max(fw / iw, fh / ih), cl = v => Math.min(4, Math.max(1, v));
    let z = cl((st && +st.z) || 1), x = ((st && +st.x) || 0) * fw, y = ((st && +st.y) || 0) * fh;
    const el = document.createElement('div'); el.className = 'crop27' + (cf.round ? ' rd' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', cf.round ? 'Place your profile photo' : 'Place your header photo');
    el.innerHTML = `<div class="cb27"><button data-c="x">Cancel</button><b>Move and zoom</b><button data-c="ok" class="sv">Done</button></div><div class="cs27"><img alt="" draggable="false"><span class="cf27" style="width:${fw}px;height:${fh}px"></span></div><div class="cz27"><input type="range" min="1" max="4" step="0.01" aria-label="Zoom"><button data-c="new">Choose a different photo</button></div>`;
    const pic = el.querySelector('img'), stage = el.querySelector('.cs27'), rng = el.querySelector('input'); pic.src = orig;
    const paint = () => { const s = s0 * z, mx = Math.max(0, (iw * s - fw) / 2), my = Math.max(0, (ih * s - fh) / 2); x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y)); pic.style.width = iw * s + 'px'; pic.style.height = ih * s + 'px'; pic.style.transform = `translate3d(calc(-50% + ${x}px),calc(-50% + ${y}px),0)`; rng.value = z; };
    const zoom = nz => { nz = cl(nz); x *= nz / z; y *= nz / z; z = nz; };
    const pts = new Map(); let d0 = 0, z0 = 1; const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    stage.addEventListener('pointerdown', e => { try { stage.setPointerCapture(e.pointerId); } catch (er) {} pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { d0 = gap(); z0 = z; } });
    stage.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { x += dx; y += dy; } else if (pts.size === 2) { if (d0 > 0) zoom(z0 * gap() / d0); x += dx / 2; y += dy / 2; } paint(); });
    const up = e => { pts.delete(e.pointerId); d0 = 0; }; stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', e => { e.preventDefault(); zoom(z * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); paint(); }, { passive: false });
    rng.addEventListener('input', () => { zoom(+rng.value); paint(); });
    const close = r => { window.removeEventListener('hashchange', gone); el.remove(); done(r); }, gone = () => close(null); window.addEventListener('hashchange', gone);
    el.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; const a = b.dataset.c;
      if (a === 'x') return close(null);
      if (a === 'new') { const f = $main.querySelector('#yfile27'); yPickFor = kind; if (f) f.click(); return close(null); }
      try { const s = s0 * z, sw = fw / s, sh = fh / s, c = document.createElement('canvas'); c.width = cf.out[0]; c.height = cf.out[1]; c.getContext('2d').drawImage(im, iw / 2 - x / s - sw / 2, ih / 2 - y / s - sh / 2, sw, sh, 0, 0, c.width, c.height); close({ data: c.toDataURL('image/jpeg', .88), st: { z, x: x / fw, y: y / fh } }); }
      catch (er) { V.toast('That photo could not be saved.'); close(null); } });
    document.body.appendChild(el); paint();
  }); }
  const reEdit = async () => { const nm = $main.querySelector('#yname27'), tp = $main.querySelector('#ytop27'), kn = nm ? nm.value : null, kt = tp ? tp.value : ''; await you27(); const n2 = $main.querySelector('#yname27'), t2 = $main.querySelector('#ytop27'); if (n2 && kn != null) n2.value = kn; if (t2 && kt) t2.value = kt; };
  async function placePhoto(kind, orig, st) { const r = await cropOpen(kind, orig, st); if (!r) return;
    if (!(await idb.set(kind, r.data))) return V.toast('Could not keep that photo on this phone.');
    await idb.set(kind + '0', orig); await idb.set(kind + 'c', r.st); me[kind] = r.data; if (kind === 'header') store.set('v5:header', 'photo'); if ($main.querySelector('#you27')) await reEdit(); }
  const pickPhoto = async kind => { yPickFor = kind; const orig = await idb.get(kind + '0'); if (orig && me[kind]) return placePhoto(kind, orig, await idb.get(kind + 'c')); const f = $main.querySelector('#yfile27'); if (f) f.click(); };
  let yPickFor = '';
  $main.addEventListener('change', async e => { if (e.target.id !== 'yfile27') return; const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; const kind = yPickFor === 'header' ? 'header' : 'photo';
    let orig = ''; try { orig = await fitOrig(f); } catch (er) { return V.toast('That file could not be read as a photo.'); } placePhoto(kind, orig, null); });
  $main.addEventListener('click', async e => { const b = e.target.closest('[data-you]'); if (!b || !b.closest('#you27')) return; const a = b.dataset.you; e.preventDefault();
    if (a === 'tab') { store.set('v5:youtab', b.dataset.tab); return you27(); }
    if (a === 'fold') { const f = store.get('v5:youfold', {}) || {}, t = b.dataset.tab, l = new Set(f[t] || []); if (l.has(b.dataset.lk)) l.delete(b.dataset.lk); else l.add(b.dataset.lk); f[t] = [...l]; store.set('v5:youfold', f); return you27(); }
    if (a === 'clip') { const its = b.dataset.kind === 'liked' ? X.stLikedItems() : X.savedItems(); if (!its.length || document.querySelector('.story')) return; const nm = b.dataset.kind === 'liked' ? 'Liked' : 'Saved';
      const subs = [{ key: 'w:you', lk: 'all', kind: 'watch', id: 'w:you', name: nm, full: nm, color: '#15171a', its, un: true, last: Date.now() }];
      return V.storyOpen('w:you', b.dataset.id, { watch: true, auto: wAuto(), onHold: wSheet, subs, chrome(el) { el.__subs = subs; wChrome(el); el.classList.add('one27'); }, onItem: (el, it, x, si) => { wItem(el, it, x, si); store.set('v5:wtab', store.get('v5:wtab0', 'w:fy')); }, onSlide: wInd, onClose() { paintBar(); you27(); } }); }
    if (a === 'edit') { youEdit = true; window.scrollTo(0, 0); return you27(); }
    if (a === 'cancel') { youEdit = false; return you27(); }
    if (a === 'save') { const nm = $main.querySelector('#yname27'), tp = $main.querySelector('#ytop27'); if (nm) store.set('v5:name', nm.value.trim().slice(0, 24)); if (tp && tp.value) store.set('v5:topteam', tp.value); youEdit = false; V.toast('Saved'); return you27(); }
    if (a === 'pickp') return pickPhoto('photo');
    if (a === 'pickh') return pickPhoto('header');
    if (a === 'hdr') { if (b.dataset.v === 'photo' && !me.header) return pickPhoto('header'); store.set('v5:header', b.dataset.v); return reEdit(); }
    if (a === 'rmphoto') { await idb.set('photo', ''); await idb.set('photo0', ''); await idb.set('photoc', ''); me.photo = ''; return reEdit(); }
  });
  { const st0 = V.settings; V.settings = (cat = '', ...a) => { if (on() && !cat) { return you27(); } youEdit = false; return st0(cat === 'menu' ? '' : cat, ...a); }; }

  /* ---------- Search (v492). The app's own search still does the finding; this gives it the new top (the field with
     Cancel beside it), four Browse tiles, and a short list of questions in place of the wall of chips. ---------- */
  const QI = { rec: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.500 14.600 9l6 .700-4.500 4.100 1.300 5.900L12 16.700 6.600 19.700l1.300-5.900L3.400 9.700l6-.700z"/></svg>',
    rook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18 10 12l4 4 6-8M15 8h5v5"/></svg>',
    inj: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/><rect x="3.500" y="3.500" width="17" height="17" rx="4.500"/></svg>',
    cmp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14M4 9l4-4 4 4M12 15l4 4 4-4"/></svg>',
    ask: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200"/></svg>' };
  function searchDecorate() {
    if (!on() || root.dataset.page !== 'search') return; const pg = $main.querySelector('.xpage'); if (!pg || pg.classList.contains('q27')) return; const box = pg.querySelector('.xbox'), br = pg.querySelector('#xbrowse'); if (!box || !br) return;
    pg.classList.add('q27', 'h27');
    { const inp = box.querySelector('input'); if (inp) inp.placeholder = 'Players, teams, questions'; }
    const inp0 = box.querySelector('input'), had = document.activeElement === inp0;   // moving the field drops the cursor; put it back
    const top = document.createElement('div'); top.className = 'qtop27'; box.before(top); top.appendChild(box); if (had && inp0) { try { inp0.focus({ preventScroll: true }); } catch (e) {} } top.insertAdjacentHTML('beforeend', '<button class="qcx27" data-q27="cancel">Cancel</button>');
    const pl = V.fplayers.all().filter(p => LEAGUES[p.lk]), a = pl[0], b = pl.find(p => a && p.lk === a.lk && p.id !== a.id), cmp = a && b ? `${a.name} vs ${b.name}` : 'Shai vs Luka';
    const tiles = `<div class="sec qs27"><h2>Browse</h2></div><div class="qtl27"><button class="qt27 r" data-q27="recruits">${QI.rec}<b>Top recruits</b><small>The high school classes</small></button><button class="qt27 k" data-q27="rookies">${QI.rook}<b>Rookies</b><small>This year's class, ranked</small></button><button class="qt27 i" data-xq="Who is hurt on my teams">${QI.inj}<b>Injuries</b><small>Who is out on your teams</small></button><button class="qt27 c" data-xq="${esc(cmp)}">${QI.cmp}<b>Compare</b><small>Two players, side by side</small></button></div>`;
    const tn = br.querySelector('#xtonight'); if (tn) tn.insertAdjacentHTML('beforebegin', tiles); else br.insertAdjacentHTML('afterbegin', tiles);
    const qs = [...br.querySelectorAll('.xtryg')].map(g => g.querySelector('[data-xq]')).filter(Boolean).slice(0, 5).map(c => c.dataset.xq);
    if (qs.length) br.insertAdjacentHTML('beforeend', `<div class="qal27">${qs.map(t => `<button class="qa27" data-xq="${esc(t)}">${QI.ask}<span>${esc(t)}</span></button>`).join('')}</div>`);
    /* the search stats (this phone only) open from a long press on the magnifier, since the title they hung on is gone */
    const mg = box.querySelector('svg'), h1 = pg.querySelector('.xtitle'); if (mg && h1) { mg.addEventListener('pointerdown', () => h1.dispatchEvent(new Event('pointerdown'))); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => mg.addEventListener(ev, () => h1.dispatchEvent(new Event(ev)))); }
  }
  $main.addEventListener('click', e => { const b = e.target.closest('[data-q27]'); if (!b || !b.closest('.xpage')) return; e.preventDefault(); const k = b.dataset.q27;
    if (k === 'cancel') { store.set('v5:xq', ''); if (history.length > 1) history.back(); else location.hash = '#home'; return; }
    if (k === 'recruits') { store.set('v5:lk', 'ncaam'); store.set('v5:ldrec', true); if (V.applyAccent) V.applyAccent(); location.hash = '#stats'; return; }
    if (k === 'rookies') { store.set('v5:lk', 'nba'); store.set('v5:ldrec', false); const st = store.get('v5:ld27', {}) || {}; st.who = 'rookies'; store.set('v5:ld27', st); if (V.applyAccent) V.applyAccent(); location.hash = '#stats'; return; } });
  new MutationObserver(() => searchDecorate()).observe($main, { childList: true });
  document.addEventListener('rivl:rendered', searchDecorate);

  /* ---------- the game page below its top (v478). The top stays as it is (Ray's ruling). Below it the page already had the
     board's parts (line score, leaders, win chance, team stats), so this only puts the game's clips first as a row of
     upright cards that open the full-screen player, and turns the tab row into the same pill switch as Scores. ---------- */
  let gcAt = 0, gcT = 0;
  /* Game header, Glow (v493, Ray's pick D): the colours and the win chance are handed to the page as variables; the look is CSS */
  function gameGlow() {
    if (!on() || root.dataset.page !== 'game') return; const pg = $main.querySelector('#gpage.g2'); if (!pg) return;
    const col = a => { const m = a && /#team\/([a-z]+)\/([^/]+)/.exec(a.getAttribute('href') || ''), t = m && X.teamOf(m[1], m[2]); return t ? glowC(t) : ''; };
    const ds = pg.querySelectorAll('#ghead .g2ds'), bg = pg.querySelector('.ghbg'), put = (k, v) => { if (v && pg.style.getPropertyValue(k) !== v) pg.style.setProperty(k, v); };
    put('--gla', col(ds[0]) || (bg && glowC({ color: bg.style.getPropertyValue('--ga') })) || ''); put('--glh', col(ds[1]) || (bg && glowC({ color: bg.style.getPropertyValue('--gh') })) || '');
    if (bg) put('--sh', bg.style.getPropertyValue('--sh'));
    const f = pg.querySelector('#ghead .g2df b'), n = f && /(\d+)\s*%/.exec(f.textContent || ''); if (n) put('--wp', n[1] + '%');
  }
  { let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; gameGlow(); }); }).observe($main, { childList: true, subtree: true }); document.addEventListener('rivl:rendered', gameGlow); document.addEventListener('rivl:polled', gameGlow); }
  function gameDecorate() {
    if (!on() || root.dataset.page !== 'game') return; const now = Date.now(); if (now - gcAt < 300) { clearTimeout(gcT); gcT = setTimeout(gameDecorate, 320); return; } gcAt = now;
    const m = /^#game\/([a-z]+)\/([^/?]+)/.exec(location.hash || ''); const panel = $main.querySelector('#gbody .gpanel'); if (!m || !panel) return;
    const its = X.gameClips(m[2]); const have = panel.querySelector('.gc27');
    if (its.length < 2) { if (have) have.remove(); panel.classList.remove('gcon27'); return; }
    const html = `<div class="sec"><h2>Clips from this game</h2><span class="cnt27">${its.length}</span></div><div class="rl27 cv27">${its.map(it => `<button class="cl27" data-gclip="${esc(it.id)}" data-gid="${esc(m[2])}" aria-label="${esc(it.title)}">${it.thumb ? `<img src="${esc(up916(it.thumb))}" data-o="${esc(it.thumb)}" alt="" loading="lazy" onerror="if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute('data-o')}else this.remove()">` : ''}<i class="pl">${I.play}</i><b>${esc(it.title)}</b></button>`).join('')}</div>`, h = hash(html);
    if (have && have.dataset.h === h && have === panel.firstElementChild) return;
    const el = have || document.createElement('div'); el.className = 'gc27 h27'; el.dataset.h = h; el.innerHTML = html; if (el !== panel.firstElementChild) panel.insertBefore(el, panel.firstChild); panel.classList.add('gcon27');
  }
  /* v480: once the tab row pins under the game's top bar, the bar's colour runs on behind it, so the score and the tabs read
     as one header. Before, the pinned row sat on a plain black band with the cards sliding under a hard edge. */
  let pinRaf = 0;
  const gamePin = () => { pinRaf = 0; if (root.dataset.page !== 'game') return; const pg = $main.querySelector('#gpage.g2'); if (!pg) return; const tb = pg.querySelector('#gtabs'), bar = pg.querySelector('.g2fx'); if (!tb || !bar) return;
    const pin = on() && window.scrollY > 4 && tb.getBoundingClientRect().top <= bar.offsetHeight + 1; if (pin) pg.style.setProperty('--tb27h', tb.offsetHeight + 'px'); if (pg.classList.contains('pin27') !== pin) pg.classList.toggle('pin27', pin); };
  window.addEventListener('scroll', () => { if (!pinRaf && root.dataset.page === 'game') pinRaf = requestAnimationFrame(gamePin); }, { passive: true });
  document.addEventListener('rivl:rendered', () => setTimeout(() => { gameDecorate(); gamePin(); }, 0)); document.addEventListener('rivl:polled', () => setTimeout(() => { gameDecorate(); gamePin(); }, 0));
  new MutationObserver(() => { if (root.dataset.page === 'game' && on()) gameDecorate(); }).observe($main, { childList: true, subtree: true });
  $main.addEventListener('click', e => { const b = e.target.closest('[data-gclip]'); if (!b) return; e.preventDefault(); const its = X.gameClips(b.dataset.gid); if (!its.length || document.querySelector('.story')) return;
    const subs = [{ key: 'w:game', lk: 'all', kind: 'watch', id: 'w:game', name: 'This game', full: 'This game', color: '#15171a', its, un: true, last: Date.now() }];
    V.storyOpen('w:game', b.dataset.gclip, { watch: true, auto: wAuto(), onHold: wSheet, subs, chrome(el) { el.__subs = subs; wChrome(el); el.classList.add('one27'); }, onItem: (el, it, x, si) => { wItem(el, it, x, si); store.set('v5:wtab', store.get('v5:wtab0', 'w:fy')); }, onSlide: wInd, onClose() { paintBar(); } }); });

  /* ---------- player and team pages (v482): the profile pattern Ray chose. A band of the team's colour with the number or
     the team's letters running through it, the photo on its edge with the story ring (bright when there is something new,
     gray when watched, none when there is no story; a tap plays it), the name with one Follow button, then the page's own
     cards. The page itself is still built by the app; this dresses its top and adds the ring and the lead card. ---------- */
  let pfAt = 0, pfT = 0;
  const pfRoute = () => { const m = /^#(player|team)\/([a-z]+)\/([^/?]+)/.exec(location.hash || ''); return m ? { kind: m[1], lk: m[2], id: m[3] } : null; };
  function profDecorate() {
    if (!on()) return; const pg = root.dataset.page; if (pg !== 'player' && pg !== 'team') return;
    const now = Date.now(); if (now - pfAt < 250) { clearTimeout(pfT); pfT = setTimeout(profDecorate, 270); return; } pfAt = now;
    const r = pfRoute(), hd = $main.querySelector('.approf header.aph'); if (!r || !hd) return; const L = LEAGUES[r.lk]; if (!L) return;
    { const ap = hd.closest('.approf'), fx = ap.querySelector('.apfx') || hd; ['--a', '--ad'].forEach(k => { const v = fx.style.getPropertyValue(k) || hd.style.getPropertyValue(k); if (v && ap.style.getPropertyValue(k + '27') !== v) ap.style.setProperty(k + '27', v); }); }   // the small top bar's own colours, so the pinned tab row matches it exactly
    /* the band */
    let bn = hd.querySelector('.bn27'); if (!bn) { bn = document.createElement('div'); bn.className = 'bn27'; bn.setAttribute('aria-hidden', 'true'); bn.innerHTML = '<u></u><span class="hs27"></span><span class="hg27"></span><span class="hp27"></span><span class="hr27"></span><i></i>'; hd.insertBefore(bn, hd.firstChild); }
    const setBand = t => { const u = bn.firstChild; t = String(t || '').trim(); const txt = t ? `${t} ${t}` : ''; if (u.textContent !== txt) u.textContent = txt; };
    /* v485: the name set like a poster: the first name (or the city) small over the last name (or the team's name) large */
    const h1 = hd.querySelector('.apnm h1');
    const setName = (small, big) => { if (!h1 || h1.dataset.n27 === big) return; h1.dataset.n27 = big; h1.innerHTML = `${small ? `<small>${esc(small)}</small>` : ''}${esc(big)}`; const n = big.length; h1.classList.remove('n2', 'n3', 'n4'); if (n > 15) h1.classList.add('n4'); else if (n > 11) h1.classList.add('n3'); else if (n > 8) h1.classList.add('n2'); };
    { const img = hd.querySelector('.apface img, .apcrest img'); if (img && img.dataset.o) { img.src = img.dataset.o; img.removeAttribute('data-o'); } }   // the full-size photo or logo
    if (r.kind === 'team') { const t = X.teamOf(r.lk, r.id); if (t && t.abbr) setBand(t.abbr);
      if (bn.dataset.id !== r.id) { bn.dataset.id = r.id; V.teamsIndex(L).then(idx => { const x = idx && idx[String(r.id)]; if (!x || bn.dataset.id !== r.id || !document.body.contains(bn)) return; if (x.abbr) setBand(x.abbr);
          const full = (h1 && (h1.dataset.full || (h1.dataset.full = h1.textContent.trim()))) || x.name || '', loc = x.loc || ''; if (loc && full.toLowerCase().startsWith(loc.toLowerCase() + ' ')) setName(loc, full.slice(loc.length + 1)); }, () => {}); } }
    else { if (h1 && !h1.dataset.n27) { const full = h1.textContent.trim(), ps = full.split(/\s+/); if (ps.length > 1) setName(ps[0], ps.slice(1).join(' ')); else setName('', full); } }
    if (r.kind === 'player' && bn.dataset.id !== r.id) { bn.dataset.id = r.id; setBand(''); X.athlete(L, r.id).then(b => { const p = b && (b.athlete || b); if (p && p.jersey != null && p.jersey !== '' && bn.dataset.id === r.id) setBand(p.jersey); }, () => {}); }
    /* the story ring */
    const av = hd.querySelector('.apface,.apcrest'), key = `${r.lk}:${r.kind === 'team' ? 't' : 'p'}${r.id}`, sub = X.storySubjects().find(x => x.key === key);
    if (av) { const st = sub ? (sub.un ? 'new' : 'seen') : ''; if (bn.dataset.ring !== st) bn.dataset.ring = st; { let rb = bn.querySelector('.hrb27'); if (st && !rb) { rb = document.createElement('button'); rb.className = 'hrb27'; rb.setAttribute('aria-label', 'Play the story'); bn.appendChild(rb); } if (rb) { if (st) rb.dataset.pstory = key; else rb.remove(); } } if (av.dataset.ring !== st) { av.dataset.ring = st; av.classList.toggle('rg27', !!st); av.classList.toggle('new', st === 'new'); if (st) { av.setAttribute('role', 'button'); av.setAttribute('aria-label', 'Play the story'); av.dataset.pstory = key; } else { av.removeAttribute('role'); av.removeAttribute('aria-label'); delete av.dataset.pstory; } } }
    /* v483 the Roster tab: each player is a card you can see the person on (two to a row, grouped by position as before).
       The page's own rows are kept and reshaped: number at the top left, first name small, last name bold, the photo
       swapped for the full-size one. */
    if (r.kind === 'team') $main.querySelectorAll('.tpanel[data-pg="roster"] .agl .aglp:not([data-r27])').forEach(a => { a.dataset.r27 = '1';
      const t = a.querySelector('.t'), nm = t && t.querySelector('b'), sub = t && t.querySelector('span'), img = a.querySelector('.hs img'); if (!nm) return;
      const full = nm.textContent.trim(), parts = full.split(/\s+/), first = parts.length > 1 ? parts[0] : '', last = parts.slice(first ? 1 : 0).join(' ');
      nm.innerHTML = `${first ? `<small>${esc(first)}</small>` : ''}${esc(last)}`;
      if (sub) { const m = /#\s*(\w+)/.exec(sub.textContent); sub.textContent = sub.textContent.split('\u00b7')[0].trim(); if (m) a.insertAdjacentHTML('afterbegin', `<u class="jn27" aria-hidden="true">${esc(m[1])}</u>`); }
      if (img && img.dataset.o) { img.src = img.dataset.o; img.removeAttribute('data-o'); } });
    /* the lead card (players): the rating in a ring that fills, three numbers, the one-line summary */
    if (r.kind === 'player') { const prc = $main.querySelector('.prate2 .prc'); if (prc && !prc.previousElementSibling) {
        const rt = prc.querySelector('.rtb'), sum = prc.querySelector('.prs'), val = lab => { const c = [...$main.querySelectorAll('.pgp:first-child .card div, .pgp:first-child .card td')].find(d => d.children.length === 2 && d.lastElementChild.textContent.trim() === lab && /^[\d.]+$/.test(d.firstElementChild.textContent.trim())); return c ? c.firstElementChild.textContent.trim() : ''; };
        const v = rt ? parseInt(rt.textContent, 10) : NaN, tri = [['Points', val('Points')], ['Rebounds', val('Rebounds')], ['Assists', val('Assists')]].filter(x => x[1]);
        if (isFinite(v) && tri.length) { const el = document.createElement('section'); el.className = 'ldc27';
          el.innerHTML = `<div class="rg"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27"/><circle class="f" cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="${Math.max(0, Math.min(100, v))} 100"/></svg><b>${v}</b><span>RIVL rating</span></div><div class="rs"><div class="tri">${tri.map(x => `<span><b>${esc(x[1])}</b><small>${x[0]}</small></span>`).join('')}</div>${sum ? `<p>${esc(sum.textContent)}</p>` : ''}</div>`;
          prc.parentNode.insertBefore(el, prc); prc.classList.add('hid27'); } } }
  }
  /* once the tab row pins under the small top bar it takes the bar's colour, as on the game page */
  let ppRaf = 0;
  const profPin = () => { ppRaf = 0; const pg = root.dataset.page; if (pg !== 'player' && pg !== 'team') return; const ap = $main.querySelector('.approf'), tb = ap && ap.querySelector('.aptabs'), fx = ap && ap.querySelector('.apfx'); if (!tb || !fx) return;
    const pin = on() && window.scrollY > 4 && tb.getBoundingClientRect().top <= fx.offsetHeight + 1; if (pin && !fx.classList.contains('on')) fx.classList.add('on'); if (ap.classList.contains('pin27') !== pin) ap.classList.toggle('pin27', pin); };
  window.addEventListener('scroll', () => { const pg = root.dataset.page; if (!ppRaf && (pg === 'player' || pg === 'team')) ppRaf = requestAnimationFrame(profPin); }, { passive: true });
  document.addEventListener('rivl:rendered', () => setTimeout(() => { profDecorate(); profPin(); }, 0)); document.addEventListener('rivl:polled', () => setTimeout(profDecorate, 0));
  new MutationObserver(() => { const pg = root.dataset.page; if ((pg === 'player' || pg === 'team') && on()) profDecorate(); }).observe($main, { childList: true, subtree: true });
  $main.addEventListener('click', e => { const a = e.target.closest('[data-pstory]'); if (!a || !on()) return; e.preventDefault(); stDirty = true; V.storyOpen(a.dataset.pstory); });

  /* ---------- Watch: one clip to a screen, Following / For you / Top plays ---------- */
  const WI = {
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.500 4.500 21 11.500l-7.500 7v-4.300C8.300 14.200 5 15.800 3 19.500c.300-5.600 3.600-10.300 10.500-10.800z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.500 4 4 8-9"/></svg>' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /* ---------- Watch: the options sheet and the first-time guide (v491). Holding the middle of a clip brings the sheet up
     from the bottom: speed, auto scroll, clear display, not interested. The guide shows once, the first time Watch opens,
     and is always one tap away in the sheet. ---------- */
  const wAuto = () => !!store.get('v5:wauto', false);
  const SI = { speed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.500 17a8.500 8.500 0 1 1 15 0M12 13.500l4-5"/><circle cx="12" cy="13.500" r="1.300" fill="currentColor"/></svg>',
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6.500 11 12 5.500 17.500 11M5 20h14"/></svg>',
    clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/></svg>',
    no: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.500"/><path d="m6.200 6.200 11.600 11.600"/></svg>',
    tips: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.500"/><path d="M9.700 9.600a2.400 2.400 0 1 1 3.500 2.100c-.800.500-1.200 1-1.200 1.900M12 16.700v.1"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    side: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>',
    tap: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.200"/><circle cx="12" cy="12" r="8.500" opacity=".5"/></svg>',
    fast: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6v12l8.500-6zM12.500 6v12L21 12z" fill="currentColor" stroke="none"/></svg>',
    line: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18"/><circle cx="14" cy="12" r="3" fill="currentColor"/></svg>',
    hold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14M5 15h14M5 12h14" opacity=".55"/><rect x="3" y="5" width="18" height="14" rx="3"/></svg>' };
  const wShut = el => { const sh = el.querySelector('.wsh27'); if (!sh) return; sh.classList.remove('in'); setTimeout(() => sh.remove(), 220); };
  function wSheet(el, it) {
    if (!el || !it || el.querySelector('.wsh27,.wtp27')) return; const r = el.__w.rate, vid = it.kind === 'vid';
    const sp = [.5, 1, 1.5, 2].map(v => `<button data-wsh="rate" data-v="${v}" class="${v === r ? 'on' : ''}" aria-pressed="${v === r}">${v}x</button>`).join('');
    el.insertAdjacentHTML('beforeend', `<div class="wsh27" data-w27 role="dialog" aria-label="Clip options"><div class="wshb27" data-wsh="x"></div><div class="wshp27"><i class="wshg27"></i>
      ${vid ? `<div class="wshr27">${SI.speed}<span><b>Speed</b></span><div class="wsp27">${sp}</div></div>` : ''}
      <button class="wshr27" data-wsh="auto" role="switch" aria-checked="${el.__w.auto}">${SI.auto}<span><b>Auto scroll</b><small>Go to the next clip when one ends</small></span><i class="wsw27"></i></button>
      <button class="wshr27" data-wsh="clear">${SI.clear}<span><b>Clear display</b><small>Hide the buttons and text</small></span></button>
      ${vid ? `<button class="wshr27" data-wsh="no">${SI.no}<span><b>Not interested</b><small>Show fewer clips like this</small></span></button>` : ''}
      <button class="wshr27" data-wsh="tips">${SI.tips}<span><b>How Watch works</b></span></button></div></div>`);
    const sh = el.querySelector('.wsh27'); requestAnimationFrame(() => sh.classList.add('in'));
    let fresh = false; sh.addEventListener('pointerdown', () => { fresh = true; }, true);   // the finger that opened the sheet is still down; its release must not count as a tap on the backdrop
    sh.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-wsh]'); if (!b || !fresh) return; e.preventDefault(); const a = b.dataset.wsh;
      if (a === 'x') return wShut(el);
      if (a === 'rate') { el.__w.setRate(+b.dataset.v); if (el.__w.paused) el.__w.resume(); return wShut(el); }
      if (a === 'auto') { const on = !el.__w.auto; el.__w.setAuto(on); store.set('v5:wauto', on); b.setAttribute('aria-checked', on); return; }
      if (a === 'clear') { el.classList.add('wcl27'); return wShut(el); }
      if (a === 'no') { if (X.stLearn) X.stLearn(it, -3); V.toast('Got it. Fewer clips like that.'); wShut(el); return el.__w.next(); }
      if (a === 'tips') { wShut(el); return wTips(el, true); } });
  }
  const TIPS = [['up', 'Swipe up for the next clip'], ['side', 'Swipe sideways to change lists'], ['tap', 'Tap to pause or play'], ['fast', 'Hold either side to play at 2x speed'], ['hold', 'Hold the middle for speed, auto scroll and more'], ['line', 'Drag the white line to move through the clip']];
  function wTips(el, asked) {
    if (!el || el.querySelector('.wtp27') || (!asked && store.get('v5:wtips27', false))) return;
    el.insertAdjacentHTML('beforeend', `<div class="wtp27" data-w27 role="dialog" aria-label="How Watch works"><div><h2>How Watch works</h2><ul>${TIPS.filter(t => t[0] !== 'side' || !el.classList.contains('one27')).map(t => `<li>${SI[t[0]]}<span>${t[1]}</span></li>`).join('')}</ul><button data-wtp>Got it</button></div></div>`);
    const tp = el.querySelector('.wtp27'); requestAnimationFrame(() => tp.classList.add('in'));
    tp.addEventListener('click', e => { e.stopPropagation(); if (!e.target.closest('[data-wtp]')) return; e.preventDefault(); store.set('v5:wtips27', true); tp.classList.remove('in'); setTimeout(() => tp.remove(), 200); });
  }
  function wChrome(el) {
    el.style.bottom = `${$bar ? $bar.offsetHeight : 0}px`;
    const subs = el.__subs || [], act = el.querySelector('.stact');   // the tabs and search sit over the clips and stay put while a clip slides
    el.insertAdjacentHTML('beforeend', `<div class="wt27" data-w27 role="tablist" aria-label="Watch">${subs.map((x, i) => `<button data-wtab="${i}" role="tab">${esc(x.name)}</button>`).join('')}<i class="wi27"></i></div><a class="ws27" data-w27 href="#search" aria-label="Search">${I.search}</a>`);
    act.insertAdjacentHTML('afterbegin', `<span class="wa27" data-w27 hidden></span>`);
    act.insertAdjacentHTML('beforeend', `<button data-w27 data-wact="share" aria-label="Share">${WI.share}</button>`);
    el.querySelector('.stpane').insertAdjacentHTML('beforeend', `<div class="wpl27" aria-hidden="true">${I.play}</div>`);
    el.insertAdjacentHTML('beforeend', `<button class="wcx27" data-w27 data-wcx aria-label="Show the buttons and text">${SI.clear}<span>Show</span></button>`);
    el.querySelector('[data-wcx]').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); el.classList.remove('wcl27'); });
    setTimeout(() => { if (document.body.contains(el)) wTips(el); }, 900);
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
  /* Watch keeps your place (v490): leave for Scores or Home, or put the app in the background, and the clip you were on is
     the one that is there when you come back. It lasts until the app is closed (memory first, then the session store in
     case the page was reloaded underneath). */
  let wLast = null;
  const wLastGet = () => { if (wLast) return wLast; try { const j = JSON.parse(sessionStorage.getItem('rivl:wlast') || 'null'); return j && j.id ? { key: j.key, it: { id: j.id } } : null; } catch (e) { return null; } };
  function wItem(el, it, x, si) {
    store.set('v5:wtab', x.key); if (x.key !== 'w:game') store.set('v5:wtab0', x.key);
    if (/^w:(fy|fol|top)$/.test(x.key)) { wLast = { key: x.key, it }; try { sessionStorage.setItem('rivl:wlast', JSON.stringify({ key: x.key, id: it.id })); } catch (e) {} }
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
    let back = null; if (!startId) { const l = wLastGet(), sub = l && subs.find(x => x.key === l.key); if (sub) { if (!sub.its.some(i => i.id === l.it.id) && l.it.url) sub.its.unshift(l.it); if (sub.its.some(i => i.id === l.it.id)) back = { key: sub.key, id: l.it.id }; } }
    let key = store.get('v5:wtab', 'w:fy'); if (startId) { const has = subs.find(x => x.key === 'w:fy' && x.its.some(i => i.id === startId)) || subs.find(x => x.its.some(i => i.id === startId)); if (has) key = has.key; else startId = ''; }
    if (!subs.some(x => x.key === key)) key = (subs.find(x => x.key === 'w:fy') || subs[0]).key;
    if (back) { key = back.key; startId = back.id; }
    stDirty = true;
    V.storyOpen(key, startId, { watch: true, auto: wAuto(), onHold: wSheet, subs, chrome(el) { el.__subs = subs; wChrome(el); paintBar(); }, onItem: wItem, onSlide: wInd, onClose() { paintBar(); } });
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
    return `<button class="sc27${plain ? ` k-${x.kind}${art ? ' art' : ''}` : x.kind === 'player' && x.hs ? ' pl27' : ' tm27'}" data-s27="story" data-key="${esc(x.key)}" aria-label="${esc(x.full || x.name)} story"><span style="${plain ? '--c:#3a3f4b;--c1:#4b515d;--c2:#15171a' : cardVars(x.color)}">${pic}<small>${x.kind === 'feed' ? SPARK : ''}${esc(name)}</small></span></button>`; };
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
