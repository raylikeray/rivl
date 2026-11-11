/* RIVL: The Daily (v514). Three one-minute games, new every day, the same for everyone that day.
   Mystery line: a real stat line from the last finished night, no name. Six guesses; every miss opens a clue.
   More or less: two players, one stat, who averages more. Ten rounds.
   Blind pick: two teams' numbers from one game, no names. Which team won. Up to five rounds.
   Everything is built on the phone from two files the app already has: data/night.json (the last nights' box scores)
   and data/leaders.json (the season's averages). No server, no account, no AI. The day's puzzle is drawn with a seed
   made from the date, and frozen on the phone the first time it is opened, so it does not change under a game in play.
   It keeps a history and best scores. It does not keep a chain you are punished for breaking.
   Loaded on demand: Home only knows today's progress, which it reads from the store. */
(() => {
  'use strict';
  const { LEAGUES, store, esc, todayCT } = HW;
  const V = HW.v5, U = V._;
  const $main = document.getElementById('main');
  const KEY = 'v5:daily27', MOTION = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAMES = { mystery: 'Mystery line', more: 'More or less', blind: 'Blind pick' };
  const STATS = [['pts', 'points'], ['reb', 'rebounds'], ['ast', 'assists'], ['stl', 'steals'], ['blk', 'blocks'], ['tpm', 'threes']];
  const I = {
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>',
    no: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    dn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    who: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7.500"/><path d="M5 41c1-11 7-16 15-16s14 5 15 16z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.500 8 12 3.500 16.500 8M5 13v5.500A1.500 1.500 0 0 0 6.500 20h11a1.500 1.500 0 0 0 1.500-1.500V13"/></svg>',
    g: { mystery: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 24c0-6 4-10 9.500-10S42 17.500 42 23c0 8-9.500 8-9.500 16M32.500 48v1"/></svg>', more: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 46V18M12 28l10-10 10 10M42 18v28M32 36l10 10 10-10"/></svg>', blind: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 32s9-15 24-15 24 15 24 15-9 15-24 15S8 32 8 32z"/><path d="M14 50 50 14"/></svg>' } };

  /* ---------- the day's draw ---------- */
  const seedOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const shuffle = (a, r) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, '').trim();
  const posOf = p => { p = String(p || '').toUpperCase(); return /^C$|^C-F$|^F-C$/.test(p) ? 'Center' : /G/.test(p) && !/F/.test(p) ? 'Guard' : /F/.test(p) && !/G/.test(p) ? 'Forward' : p ? 'Guard-forward' : ''; };
  const one = v => (Math.round(v * 10) / 10).toFixed(1);
  const all = () => store.get(KEY, {}) || {};
  const day = () => all()[todayCT()] || null;
  const save = d => { const a = all(); a[todayCT()] = d; const ks = Object.keys(a).sort(); ks.slice(0, -90).forEach(k => delete a[k]); ks.slice(0, -1).forEach(k => { if (a[k]) delete a[k].pz; }); store.set(KEY, a); };   // 90 days of results; only today keeps its puzzle

  let DATA = null;
  async function load() {
    if (DATA) return DATA;
    const [nt, lg, idx] = await Promise.all([HW.hub.file('night.json').catch(() => null), HW.hub.league('nba').catch(() => null), V.teamsIndex(LEAGUES.nba).catch(() => ({}))]);
    const byAbbr = {}; Object.values(idx || {}).forEach(t => { if (t && t.abbr) byAbbr[t.abbr] = t; });
    const players = ((lg && lg.players) || []).filter(p => p && p.n && p.s);
    return (DATA = { nt, lg, players, byId: new Map(players.map(p => [String(p.id), p])), byAbbr });
  }
  /* the last finished night that has what a game needs, newest first; the NBA when it is playing, then the others */
  const nightFor = (nt, test) => { for (const lk of ['nba', 'wnba', 'ncaam', 'ncaaw']) { const D = (((nt || {}).lg || {})[lk] || {}).days || []; const d = D.find(x => x.done && test(x)); if (d) return { lk, d }; } return null; };
  function draw(D) {
    const date = todayCT(), pz = { v: 1 };
    // ---- Mystery line: one of the night's five best lines, from a player the list of guesses holds
    { const r = rng(seedOf(date + ':mystery')), N = nightFor(D.nt, x => (x.top || []).some(l => D.byId.has(String(l.id))));
      if (N && N.lk === 'nba') { const c = N.d.top.filter(l => D.byId.has(String(l.id))), l = c[Math.floor(r() * c.length)]; pz.m = { kind: 'night', d: N.d.d, l }; }
      else { const c = [...D.players].filter(p => (p.s.gp || 0) >= 3).sort((a, b) => (b.s.pts || 0) - (a.s.pts || 0)).slice(0, 40); if (c.length) { const p = c[Math.floor(r() * c.length)]; pz.m = { kind: 'season', l: { id: String(p.id), n: p.n, tm: p.team, pos: p.pos, pts: one(p.s.pts || 0), reb: one(p.s.reb || 0), ast: one(p.s.ast || 0), stl: one(p.s.stl || 0), blk: one(p.s.blk || 0), tpm: one(p.s.tpm || 0), hs: p.img || '' } }; } } }
    // ---- More or less: ten pairs, a different stat each time round, two players close enough to argue about
    { const r = rng(seedOf(date + ':more')), maxG = Math.max(1, ...D.players.map(p => p.s.gp || 0)), pool = D.players.filter(p => (p.s.gp || 0) >= Math.max(2, maxG * .6) && (p.s.min || 0) >= 20);
      const used = new Set(), rounds = [], order = shuffle(STATS, r);
      for (let i = 0; i < 10 && pool.length > 20; i++) { const [k, w] = order[i % order.length], top = [...pool].filter(p => p.s[k] != null).sort((a, b) => b.s[k] - a.s[k]).slice(0, 60).filter(p => !used.has(p.id));
        for (let tries = 0; tries < 40; tries++) { const a = top[Math.floor(r() * top.length)], b = top[Math.floor(r() * top.length)]; if (!a || !b || a === b) continue; const va = +one(a.s[k]), vb = +one(b.s[k]), gap = Math.abs(va - vb) / Math.max(va, vb, .1);
          if (va === vb || gap > .3 || gap < .03) continue; used.add(a.id); used.add(b.id); rounds.push({ k, w, a: String(a.id), b: String(b.id), va, vb }); break; } }
      if (rounds.length >= 5) pz.ml = rounds; }
    // ---- Blind pick: up to five of the night's games, the sides shown in a drawn order
    { const r = rng(seedOf(date + ':blind')), N = nightFor(D.nt, x => (x.bp || []).length > 0);
      if (N) pz.bp = { lk: N.lk, d: N.d.d, g: shuffle(N.d.bp, r).slice(0, 5).map(g => ({ e: g.e, flip: r() < .5 ? 1 : 0, h: g.h, a: g.a, bh: g.bh, ba: g.ba })) }; }
    return pz;
  }
  async function today() {
    const D = await load(); let d = day();
    if (!d || !d.pz) { d = Object.assign({}, d, { pz: draw(D) }); save(d); }
    else { /* a game that could not be drawn earlier (the night's file had not arrived, or the phone was offline) is drawn now, as long as it has not been started */
      const begun = k => !!(d[k] && (d[k].g || d[k].a || []).length), weak = k => !d.pz[k] || (k === 'm' && d.pz.m.kind === 'season');
      if (['m', 'ml', 'bp'].some(k => weak(k) && !begun(k))) { const f = draw(D); let ch = false; ['m', 'ml', 'bp'].forEach(k => { if (weak(k) && !begun(k) && f[k] && (!d.pz[k] || f[k].kind === 'night')) { d.pz[k] = f[k]; ch = true; } }); if (ch) save(d); } }
    return { D, d };
  }

  /* ---------- Home's banner and the numbers under the games: read from the store, no data needed ---------- */
  const whenOf = d => { if (!d) return 'last night'; const y = HW.addDays ? HW.addDays(todayCT(), -1) : ''; return d === y ? 'last night' : 'on ' + new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }); };
  const scoreOf = (d, g) => { const s = d && d[g]; if (!s || !s.done) return null; return g === 'm' ? (s.won ? `${s.g.length}/6` : 'X/6') : `${s.a.filter(Boolean).length}/${s.a.length}`; };
  const progress = () => { const d = day(); return ['m', 'ml', 'bp'].map(g => !!(d && d[g] && d[g].done)); };
  function shareText() {
    const d = day() || {}, dt = new Date(todayCT() + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), L = [`RIVL Daily, ${dt}`];
    if (d.m && d.m.done) L.push(`Mystery line ${scoreOf(d, 'm')} ${d.m.g.map((_, i) => d.m.won && i === d.m.g.length - 1 ? '\u{1F7E9}' : '\u{1F7E5}').join('')}`);
    if (d.ml && d.ml.done) L.push(`More or less ${scoreOf(d, 'ml')}`);
    if (d.bp && d.bp.done) L.push(`Blind pick ${scoreOf(d, 'bp')}`);
    L.push(`${location.origin}${location.pathname}#daily`); return L.join('\n');
  }
  function share() { const text = shareText();
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => V.toast('Copied. Paste it anywhere.'), () => V.toast('Could not copy the result')); else V.toast('Sharing is not available here'); }
  function record() { const a = all(), ds = Object.values(a), played = ds.filter(d => d && ['m', 'ml', 'bp'].some(g => d[g] && d[g].done));
    const ms = played.filter(d => d.m && d.m.done), won = ms.filter(d => d.m.won), best = g => Math.max(0, ...played.filter(d => d[g] && d[g].done).map(d => d[g].a.filter(Boolean).length));
    return { days: played.length, mPlayed: ms.length, mWon: won.length, mAvg: won.length ? one(won.reduce((s, d) => s + d.m.g.length, 0) / won.length) : '', ml: best('ml'), bp: best('bp') }; }

  /* ---------- the hub ---------- */
  const tile = (g, key, sub, d, ready) => { const sc = scoreOf(d, key), on = d && d[key] && !d[key].done && ((d[key].g || d[key].a || []).length > 0);
    return `<${ready ? `a href="#daily/${g}"` : 'div'} class="dyc27 dy-${g}${sc ? ' done' : ''}${ready ? '' : ' off'}"><i class="dyb27 a"></i><i class="dyb27 b"></i><span class="dyi27">${I.g[g]}</span><span class="dyt27"><b>${NAMES[g]}</b><small>${esc(ready ? sub : 'Back when games are played')}</small></span>${sc ? `<span class="dys27"><b>${esc(sc)}</b><small>Done</small></span>` : ready ? `<span class="dyg27">${on ? 'Resume' : 'Play'}${I.chev}</span>` : ''}</${ready ? 'a' : 'div'}>`; };
  async function hub() {
    $main.innerHTML = `<div id="dy27" class="h27 dyp27"><div class="sk27"></div><div class="sk27"></div><div class="sk27"></div></div>`;
    const { d } = await today(); const pg = $main.querySelector('#dy27'); if (!pg) return;
    const pz = d.pz || {}, done = progress(), n = done.filter(Boolean).length, R = record(), dt = new Date(todayCT() + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const avail = [!!pz.m, !!pz.ml, !!pz.bp], total = avail.filter(Boolean).length, allDone = total > 0 && avail.every((a, i) => !a || done[i]);
    pg.innerHTML = `<p class="dyd27">${esc(dt)}</p><p class="dyl27">${allDone ? 'All done. New games tomorrow.' : 'Three quick games. New every day.'}</p>
      ${tile('mystery', 'm', pz.m && pz.m.kind === 'season' ? 'A season line with no name. Six guesses.' : `A real line from ${whenOf(pz.m && pz.m.d).replace(/^on /, '')}, no name. Six guesses.`, d, avail[0])}
      ${tile('more', 'ml', 'Two players, one stat. Who averages more?', d, avail[1])}
      ${tile('blind', 'bp', 'Two teams, no names. Which one won?', d, avail[2])}
      ${n ? `<button class="dysh27" data-dy="share">${I.share}<span>Share today's result</span></button>` : ''}
      ${R.days ? `<div class="sec dyh27"><h2>Your record</h2></div><div class="dyr27"><div><b>${R.days}</b><span>${R.days === 1 ? 'Day played' : 'Days played'}</span></div><div><b>${R.mPlayed ? `${R.mWon}/${R.mPlayed}` : '0'}</b><span>Mystery lines solved${R.mAvg ? `. ${R.mAvg} guesses on average.` : ''}</span></div><div><b>${R.ml || 0}/10</b><span>Best More or less</span></div><div><b>${R.bp || 0}</b><span>Most right in a Blind pick</span></div></div>` : ''}`;
  }

  /* ---------- pieces the games share ---------- */
  const face = (p, cls = '') => p && p.img ? U.imgSized(p.img, 350, 254, `class="${cls}"`, 'this.remove()') : '';
  const colorOf = (D, abbr) => { const t = D.byAbbr[abbr]; let c = (t && U.teamColor({ abbr, id: t.id, color: t.color }, LEAGUES.nba)) || '#33507a';   /* a team the index does not know gets a plain blue, not black */ const l = U.lumOf(c); return l < .1 ? U.mixTo(c, 255, .34) : l > .6 ? U.mixTo(c, 0, .3) : c; };
  const dots = (n, at, res) => `<div class="dyo27" aria-label="Round ${Math.min(at + 1, n)} of ${n}">${Array.from({ length: n }, (_, i) => `<i class="${i < res.length ? (res[i] ? 'ok' : 'no') : i === at ? 'on' : ''}"></i>`).join('')}</div>`;
  const endCard = (score, line, next) => `<div class="dye27"><b>${esc(score)}</b><p>${esc(line)}</p><button class="dysh27" data-dy="share">${I.share}<span>Share today's result</span></button>${next ? `<a class="dyn27" data-dy="go" href="#daily/${next}">Next: ${NAMES[next]}${I.chev}</a>` : `<a class="dyn27" data-dy="hub" href="#daily">Back to The Daily${I.chev}</a>`}</div>`;
  const nextOf = (d, cur) => ['mystery', 'more', 'blind'].find(g => g !== cur && d.pz[{ mystery: 'm', more: 'ml', blind: 'bp' }[g]] && !(d[{ mystery: 'm', more: 'ml', blind: 'bp' }[g]] || {}).done) || '';
  const countUp = (el, to, dec = 1) => { if (!el) return; if (!MOTION()) { el.textContent = to.toFixed(dec); return; } const t0 = performance.now(), run = t => { const f = Math.min(1, (t - t0) / 520), e = 1 - Math.pow(1 - f, 3); el.textContent = (to * e).toFixed(dec); if (f < 1) requestAnimationFrame(run); }; requestAnimationFrame(run); };

  /* ---------- Mystery line ---------- */
  async function mystery() {
    $main.innerHTML = `<div id="dy27" class="h27 dyp27 dyg-m"><div class="sk27"></div><div class="sk27"></div></div>`;
    const { D, d } = await today(); const pg = $main.querySelector('#dy27'); if (!pg) return; const M = d.pz.m; if (!M) { location.hash = '#daily'; return; }
    const L = M.l, ans = D.byId.get(String(L.id)) || { id: L.id, n: L.n, team: L.tm, pos: L.pos, img: L.hs, s: {} }, team = D.byAbbr[L.tm] || D.byAbbr[ans.team] || null, opp = D.byAbbr[L.op] || null;
    const S = d.m = d.m || { g: [], done: 0, won: 0 };
    const clues = [posOf(L.pos || ans.pos), M.kind === 'night' && L.sc ? `${L.w ? 'Won' : 'Lost'} ${L.sc}` : '', M.kind === 'night' && L.op ? `Played ${opp ? 'the ' + opp.short : L.op}` : '', team ? `Plays for the ${team.short}` : L.tm ? `Plays for ${L.tm}` : '', `Initials ${String(L.n).split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0].toUpperCase() + '.').slice(0, 3).join(' ')}`].filter(Boolean);
    const paint = () => { const misses = S.g.length - (S.won ? 1 : 0), open = S.done ? clues.length : Math.min(clues.length, misses);
      const tiles = [['PTS', L.pts], ['REB', L.reb], ['AST', L.ast], ['STL', L.stl], ['BLK', L.blk], ['3PM', L.tpm]].map(([k, v]) => `<s><b>${esc(String(v))}</b><em>${k}</em></s>`).join('');
      const rows = S.g.map((id, i) => { const p = D.byId.get(String(id)) || { n: '?' }, hit = String(id) === String(L.id), tm = p.team === (ans.team || L.tm), ps = posOf(p.pos) === posOf(ans.pos || L.pos), more = (ans.s.pts || 0) - ((p.s || {}).pts || 0);
        return `<div class="dyq27${hit ? ' hit' : ''}"><i>${i + 1}</i><b>${esc(p.n)}</b>${hit ? `<span class="ok">${I.ok}</span>` : `<span class="${tm ? 'ok' : 'no'}">Team${tm ? I.ok : I.no}</span><span class="${ps ? 'ok' : 'no'}">Pos${ps ? I.ok : I.no}</span>${ans.s.pts != null && (p.s || {}).pts != null && Math.abs(more) >= .05 ? `<span class="ar">PPG${more > 0 ? I.up : I.dn}</span>` : ''}`}</div>`; }).join('');
      const col = colorOf(D, ans.team || L.tm);
      pg.innerHTML = `<div class="dym27${S.done ? ' out' : ''}"${S.done ? ` style="--c:${col}"` : ''}><i class="dyb27 a"></i><i class="dyb27 b"></i>
          <div class="dyw27">${S.done ? `<span class="dyf27">${face(ans)}</span><span><b>${esc(L.n)}</b><small>${esc([team ? team.short : L.tm, posOf(L.pos || ans.pos)].filter(Boolean).join(' · '))}</small></span>` : `<span class="dyf27 q">${I.who}</span><span><b>${M.kind === 'night' ? `Who had this line ${whenOf(M.d)}?` : 'Whose season is this?'}</b><small>${M.kind === 'night' ? (L.min ? `In ${esc(String(L.min))} minutes` : 'From the last night of games') : 'Per game, this season'}</small></span>`}</div>
          <div class="dyx27">${tiles}</div></div>
        ${clues.slice(0, open).length ? `<div class="dyk27">${clues.slice(0, open).map((c, i) => `<span${i === open - 1 && !S.done ? ' class="new"' : ''}>${esc(c)}</span>`).join('')}</div>` : ''}
        ${S.done ? endCard(S.won ? `Solved in ${S.g.length}` : 'Not this time', S.won ? (S.g.length === 1 ? 'First guess.' : `${S.g.length} of 6 guesses.`) : `It was ${L.n}.`, nextOf(d, 'mystery'))
          : `<div class="dyin27"><input id="dyinp27" type="text" inputmode="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Guess a player" aria-label="Guess a player"><div class="dysg27" id="dysg27" hidden></div></div><p class="dyhint27">Guess ${S.g.length + 1} of 6. ${open < clues.length ? 'A miss opens a clue.' : 'Every clue is open.'}</p>`}
        ${rows ? `<div class="dygs27">${rows}</div>` : ''}${!S.done && S.g.length ? `<p class="dyhint27 k">Team and Pos: right or wrong. PPG arrow: the answer averages more or fewer points than your guess.</p>` : ''}`;
      const inp = pg.querySelector('#dyinp27'), sg = pg.querySelector('#dysg27'); if (!inp) return;
      const guess = id => { if (S.done || S.g.includes(id)) return; S.g.push(id); if (id === String(L.id)) { S.done = 1; S.won = 1; } else if (S.g.length >= 6) S.done = 1; save(d); paint(); if (S.done) window.scrollTo({ top: 0, behavior: MOTION() ? 'smooth' : 'auto' }); };
      inp.addEventListener('input', () => { const q = nrm(inp.value); if (q.length < 2) { sg.hidden = true; sg.innerHTML = ''; return; }
        const hits = D.players.filter(p => !S.g.includes(String(p.id)) && nrm(p.n).split(' ').some(w => w.startsWith(q)) || nrm(p.n).startsWith(q)).filter(p => !S.g.includes(String(p.id))).sort((a, b) => (b.s.pts || 0) - (a.s.pts || 0)).slice(0, 6);
        sg.hidden = !hits.length; sg.innerHTML = hits.map(p => `<button data-dy="guess" data-id="${esc(String(p.id))}"><span>${face(p)}</span><b>${esc(p.n)}</b><small>${esc(p.team || '')}</small></button>`).join(''); });
      sg.addEventListener('click', e => { const b = e.target.closest('[data-dy="guess"]'); if (!b) return; e.preventDefault(); guess(b.dataset.id); });
    };
    paint();
  }

  /* ---------- More or less ---------- */
  async function more() {
    $main.innerHTML = `<div id="dy27" class="h27 dyp27 dyg-o"><div class="sk27"></div><div class="sk27"></div></div>`;
    const { D, d } = await today(); const pg = $main.querySelector('#dy27'); if (!pg) return; const R = d.pz.ml; if (!R) { location.hash = '#daily'; return; }
    const S = d.ml = d.ml || { a: [], done: 0 }; let busy = false;
    const paint = () => { const i = S.a.length;
      if (S.done || i >= R.length) { S.done = 1; save(d); const n = S.a.filter(Boolean).length; pg.innerHTML = dots(R.length, R.length, S.a) + endCard(`${n}/${R.length}`, n === R.length ? 'Every one.' : n >= R.length * .7 ? 'You know your numbers.' : 'Closer than they look.', nextOf(d, 'more')); return; }
      const r = R[i], card = (id, side) => { const p = D.byId.get(id) || { n: '?', team: '' }, t = D.byAbbr[p.team]; return `<button class="dyv27" data-dy="pick" data-side="${side}" style="--c:${colorOf(D, p.team)}"><i class="dyb27 a"></i>${face(p, 'ph')}<span><b>${esc(p.n)}</b><small>${esc(t ? t.short : p.team || '')}</small><em hidden></em></span><u></u></button>`; };
      pg.innerHTML = `${dots(R.length, i, S.a)}<h2 class="dyh2">Who averages more <b>${esc(r.w)}</b>?</h2>${card(r.a, 'a')}<div class="dyor27">or</div>${card(r.b, 'b')}<p class="dyhint27">Per game, this season.</p>`; busy = false; };
    pg.addEventListener('click', e => { const b = e.target.closest('[data-dy="pick"]'); if (!b || busy || S.done) return; e.preventDefault(); busy = true;
      const r = R[S.a.length], right = (r.va > r.vb ? 'a' : 'b') === b.dataset.side; S.a.push(right ? 1 : 0); save(d);
      pg.querySelectorAll('.dyv27').forEach(c => { const v = c.dataset.side === 'a' ? r.va : r.vb, em = c.querySelector('em'); em.hidden = false; countUp(em, v); c.classList.add('shown', (c.dataset.side === 'a') === (r.va > r.vb) ? 'top' : 'low'); if (c === b) { c.classList.add(right ? 'ok' : 'no'); c.querySelector('u').innerHTML = right ? I.ok : I.no; } });
      setTimeout(() => { if (document.body.contains(pg)) paint(); }, MOTION() ? 1500 : 900); });
    paint();
  }

  /* ---------- Blind pick ---------- */
  async function blind() {
    $main.innerHTML = `<div id="dy27" class="h27 dyp27 dyg-b"><div class="sk27"></div><div class="sk27"></div></div>`;
    const { d } = await today(); const pg = $main.querySelector('#dy27'); if (!pg) return; const B = d.pz.bp; if (!B) { location.hash = '#daily'; return; }
    const G = B.g, L = LEAGUES[B.lk] || LEAGUES.nba, idx = await V.teamsIndex(L).catch(() => ({})), S = d.bp = d.bp || { a: [], done: 0 }; let shown = false;
    const pct = (m, a) => a ? (m / a * 100).toFixed(1) : '0.0';
    const rowsOf = t => [['FG%', pct(t[0], t[1])], ['3P%', pct(t[2], t[3])], ['FT%', pct(t[4], t[5])], ['Rebounds', t[6]], ['Assists', t[7]], ['Steals', t[8]], ['Blocks', t[9]], ['Turnovers', t[10]]];
    const paint = () => { const i = S.a.length - (shown ? 1 : 0);
      if (!shown && (S.done || i >= G.length)) { S.done = 1; save(d); const n = S.a.filter(Boolean).length; pg.innerHTML = dots(G.length, G.length, S.a) + endCard(`${n}/${G.length}`, n === G.length ? 'Every one.' : n >= G.length * .6 ? 'Good eye.' : 'The numbers do not always tell.', nextOf(d, 'blind')); return; }
      const g = G[i], one_ = g.flip ? g.a : g.h, two = g.flip ? g.h : g.a, r1 = rowsOf(g.flip ? g.ba : g.bh), r2 = rowsOf(g.flip ? g.bh : g.ba), won1 = one_.sc > two.sc;
      const head = (t, n, win) => { const tm = idx[String(t.id)] || null; return shown ? `<div class="dybt27${win ? ' win' : ''}">${tm && tm.logo ? U.imgSized(tm.logo, 96, 96) : ''}<b>${esc((tm && tm.short) || t.nm || t.ab)}</b><em>${esc(String(t.sc))}</em></div>` : `<div class="dybt27 q"><i>${n}</i><b>Team ${n}</b></div>`; };
      const body = r1.map((r, k) => { const lowGood = r[0] === 'Turnovers', a = +r[1], b = +r2[k][1], ba = a !== b && ((a > b) !== lowGood), bb = a !== b && !ba; return `<div class="dybr27"><b class="${ba ? 'hi' : ''}">${esc(String(r[1]))}</b><span>${r[0]}</span><b class="${bb ? 'hi' : ''}">${esc(String(r2[k][1]))}</b></div>`; }).join('');
      pg.innerHTML = `${dots(G.length, i, shown ? S.a : S.a)}<h2 class="dyh2">Which team <b>won</b>?</h2><div class="dybx27${shown ? ' shown' : ''}"><div class="dybh27">${head(one_, 1, won1)}${head(two, 2, !won1)}</div>${body}</div>
        ${shown ? `<p class="dyres27 ${S.a[i] ? 'ok' : 'no'}">${S.a[i] ? I.ok : I.no}<span>${S.a[i] ? 'Right.' : 'Not this one.'}</span></p><button class="dyn27" data-dy="next">${i + 1 >= G.length ? 'See your score' : 'Next game'}${I.chev}</button>` : `<div class="dybp27"><button data-dy="won" data-n="1">Team 1 won</button><button data-dy="won" data-n="2">Team 2 won</button></div><p class="dyhint27">One real game from ${esc(whenOf(B.d).replace(/^on /, ''))}. The better number in each row is brighter.</p>`}`; };
    pg.addEventListener('click', e => { const b = e.target.closest('[data-dy]'); if (!b) return; const a = b.dataset.dy;
      if (a === 'won' && !shown) { e.preventDefault(); const g = G[S.a.length], one_ = g.flip ? g.a : g.h, two = g.flip ? g.h : g.a, won1 = one_.sc > two.sc; S.a.push((b.dataset.n === '1') === won1 ? 1 : 0); save(d); shown = true; paint(); }
      else if (a === 'next' && shown) { e.preventDefault(); shown = false; paint(); window.scrollTo(0, 0); } });
    paint();
  }

  $main.addEventListener('click', e => { const b = e.target.closest('[data-dy="share"]'); if (!b) return; e.preventDefault(); share(); });
  /* One step back from any game is the list of games, and one more is where you came from: the next game takes the
     place of the one just finished in the phone's history, and the way back to the list is a step back, not a new page. */
  $main.addEventListener('click', e => { const a = e.target.closest('a[data-dy="go"],a[data-dy="hub"]'); if (!a) return; e.preventDefault();
    if (a.dataset.dy === 'go') location.replace(a.getAttribute('href')); else if (history.length > 1) history.back(); else location.replace('#daily'); });
  V.daily27 = { open: g => g === 'mystery' ? mystery() : g === 'more' ? more() : g === 'blind' ? blind() : hub(), progress, scoreOf: () => { const d = day(); return ['m', 'ml', 'bp'].map(g => scoreOf(d, g)); }, shareText, NAMES };
})();
