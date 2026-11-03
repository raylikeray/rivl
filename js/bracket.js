/* RIVL brackets
   ------------------------------------------------------------------------------------------------------------------
   A tournament drawn as a tree, built only from the games the feed has: the NBA and WNBA playoffs (series), the NCAA
   tournaments in March, and the college holiday events in November and December.

   How the tree is found: the last game of the tournament is the root. Each game's two teams came from the latest earlier
   game each of them WON in the same tournament, so consolation games (losers playing losers) never get threaded in. A
   playoff series is one node: the games between two teams in the same round, its wins from the feed.

   Before a tournament has started, the latest finished one is shown, labelled with its year. */
(function () {
  'use strict';
  const { LEAGUES, esc, jSoft, todayCT, addDays, compact, ymdOf, API, parseEvent, favs } = HW;
  const mem = {};

  /* ---------- fetching ---------- */
  /* v408: ESPN stopped answering a start-end date range ("Failed to get events endpoint"). It still answers a whole month
     (dates=202503), so a window is read month by month and trimmed back to its days. College asks for the full division
     (groups=100): the top-conference list fills its 400 with conference tournaments and never reaches the NCAA field. */
  const monthsOf = (a, b) => { const out = []; let y = +a.slice(0, 4), m = +a.slice(5, 7); const ye = +b.slice(0, 4), me = +b.slice(5, 7);
    while (y < ye || (y === ye && m <= me)) { out.push(`${y}${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };
  async function range(L, a, b, extra = '') {
    const base = String(L.sbParams || '').replace(/&limit=\d+/, '').replace(/&groups=50\b/, '&groups=100');
    const key = `${L.key}|${a}|${b}|${extra}`; if (mem[key]) return mem[key];
    const old = b < addDays(todayCT(), -2);
    const one = ym => { const url = `${API(L)}/scoreboard?dates=${ym}${base}${extra}&limit=400`;
      return jSoft(url, old ? 12 * 3600000 : a > todayCT() ? 6 * 3600000 : 300000).then(d => (d && d.events || []).map(e => { try { return parseEvent(e, L); } catch { return null; } }).filter(Boolean)).catch(() => []); };
    // a college window outside the postseason (the holiday events) is too big for a month request: a day at a time
    const daily = /^ncaa/.test(L.key) && !/seasontype=3/.test(extra);
    const oneDay = d => jSoft(`${API(L)}/scoreboard?dates=${compact(d)}${String(L.sbParams || '').replace(/&limit=\d+/, '')}${extra}&limit=400`, d < addDays(todayCT(), -1) ? 6 * 3600000 : 300000)
      .then(x => (x && x.events || []).map(e => { try { return parseEvent(e, L); } catch { return null; } }).filter(Boolean)).catch(() => []);
    const days = []; if (daily) { let d = a; while (d <= b) { days.push(d); d = addDays(d, 1); } }
    const p = Promise.all(daily ? days.map(oneDay) : monthsOf(a, b).map(one)).then(parts => { const seen = new Set();
      return parts.flat().filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); const d = ymdOf(g.date); return d >= addDays(a, -1) && d <= addDays(b, 1); }); });
    mem[key] = p; return p;
  }
  const roundOf = note => { const parts = String(note || '').split(/\s+-\s+/).filter(p => !/^game\s*\d+$/i.test(p) && !/\bregion(al)?\b/i.test(p)); return parts.length > 1 ? parts.slice(1).join(' · ') : parts[0] || ''; };
  const nameOf = note => String(note || '').split(/\s+-\s+/)[0].trim();

  /* the tournaments this league can show right now */
  async function list(L) {
    const t = todayCT(), y = +t.slice(0, 4), md = t.slice(5);
    const out = [];
    if (L.key === 'nba' || L.key === 'wnba') {
      const [s0, s1] = L.key === 'nba' ? ['04-10', '06-25'] : ['09-05', '10-25'];
      const yr = md >= s0 ? y : y - 1;
      // v407: this year's and the last two, so a finished bracket can still be looked back at
      for (let k = 0; k < 3; k++) { const Y = yr - k;
        out.push({ key: `po${Y}`, label: `${Y} Playoffs`, short: String(Y), pick: true, kind: 'series', from: `${Y}-${s0}`, to: `${Y}-${s1}`, extra: '&seasontype=3', match: n => !/play-?in/i.test(n), year: Y,
          fallback: k ? null : { key: `po${yr - 1}`, label: `${yr - 1} Playoffs`, from: `${yr - 1}-${s0}`, to: `${yr - 1}-${s1}` } }); }
    }
    if (L.key === 'ncaam' || L.key === 'ncaaw') {
      // the holiday events around now: any tournament with its games named in the feed
      const holiday = /^(11|12)-/.test(md);   // the November and December events
      const games = holiday ? await range(L, addDays(t, -3), addDays(t, 10)) : [];
      const by = {};
      games.forEach(g => { const n = nameOf(g.note); if (!n || /basketball championship|ncaa women'?s championship|\bnit\b|wbit|crown|conference|^game\s*\d|regular season/i.test(n) || !/\s-\s/.test(g.note || '')) return; (by[n] = by[n] || []).push(g); });
      Object.entries(by).filter(([, gs]) => gs.length >= 3).sort((a, b) => a[1].map(g => g.date).sort()[0] < b[1].map(g => g.date).sort()[0] ? -1 : 1)
        .forEach(([n]) => out.push({ key: 'h:' + n, label: n, kind: 'games', from: addDays(t, -3), to: addDays(t, 10), extra: '', match: x => nameOf(x) === n }));
      const yr = md >= '03-15' ? y : y - 1;
      for (let k = 0; k < 3; k++) { const Y = yr - k;
        out.push({ key: `nc${Y}`, label: `${Y} NCAA Tournament`, short: String(Y), kind: 'games', from: `${Y}-03-15`, to: `${Y}-04-10`, extra: '&seasontype=3', match: n => /basketball championship|ncaa women'?s championship/i.test(n) && !/first four/i.test(n), regions: true, pick: true, year: Y }); }
    }
    return out;
  }

  /* ---------- the tree ---------- */
  function nodesOf(T, games) {
    const gs = games.filter(g => T.match(g.note || '') && g.home && g.away && g.home.id && g.away.id).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (T.kind !== 'series') return gs.map(g => { const done = g.state === 'post' && !g.off && g.home.score != null && g.away.score != null; const w = done ? (+g.home.score > +g.away.score ? g.home.id : g.away.id) : null;
      return { id: g.id, date: g.date, last: g.date, round: roundOf(g.note), a: g.away, b: g.home, sa: g.away.score, sb: g.home.score, done, w, g, live: g.state === 'in' }; });
    // a series: the games between the same two teams in the same round
    const by = {}; gs.forEach(g => { const k = [g.home.id, g.away.id].sort().join('|') + '|' + roundOf(g.note).replace(/\s*·?\s*game\s*\d+.*/i, ''); (by[k] = by[k] || []).push(g); });
    return Object.values(by).map(list => { const g0 = list[0], gl = list[list.length - 1]; const s = gl.series || {}; const a = g0.home, b = g0.away;   // the higher seed hosts game 1: listed first
      const wins = t => list.filter(g => g.state === 'post' && !g.off && g.home.score != null && ((g.home.id === t.id && +g.home.score > +g.away.score) || (g.away.id === t.id && +g.away.score > +g.home.score))).length;
      const fw = t => s && (s.hw != null || s.aw != null) ? (gl.home.id === t.id ? s.hw : s.aw) : null;
      const wa = fw(a) ?? wins(a), wb = fw(b) ?? wins(b);
      const need = s.total ? Math.ceil(s.total / 2) : 4; const done = !!s.done || wa >= need || wb >= need;
      return { id: g0.id, date: g0.date, last: gl.date, round: roundOf(g0.note).replace(/\s*·?\s*game\s*\d+.*/i, ''), a, b, sa: wa, sb: wb, done, w: done ? (wa > wb ? a.id : b.id) : null, g: list.find(g => g.state !== 'post') || gl, live: list.some(g => g.state === 'in'), series: true }; });
  }
  function treeOf(nodes) {
    if (!nodes.length) return null;
    const sorted = nodes.slice().sort((x, y) => new Date(y.date) - new Date(x.date));
    const root = sorted.find(n => /championship|final/i.test(n.round) && !/semi|quarter|3rd|third|5th|7th|consol|place/i.test(n.round)) || sorted[0];
    const used = new Set([root.id]);
    const build = (n, depth) => { const node = { n, kids: [null, null] }; if (depth > 7) return node;
      [n.a, n.b].forEach((t, i) => { const prev = sorted.find(m => !used.has(m.id) && new Date(m.date) < new Date(n.date) && m.w === t.id && (m.a.id === t.id || m.b.id === t.id)); if (prev) { used.add(prev.id); node.kids[i] = build(prev, depth + 1); } });
      return node; };
    return build(root, 0);
  }
  const depth = t => !t ? 0 : 1 + Math.max(depth(t.kids[0]), depth(t.kids[1]));
  const levels = (t, d) => { const rows = [[t]]; for (let i = 1; i < d; i++) rows.push(rows[i - 1].flatMap(x => x ? x.kids : [null, null])); return rows; };

  /* ---------- drawing ---------- */
  const shield = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5 4.5 5v6.3c0 4.8 3.2 8.6 7.5 10.2 4.3-1.6 7.5-5.4 7.5-10.2V5z"/></svg>`;
  function box(L, x) {
    if (!x) return `<div class="bxb tbd"><span class="bxc"><i>${shield}</i><i>${shield}</i></span><span class="bxn"><b>TBD</b><b>TBD</b></span></div>`;
    const n = x.n; const mine = favs.has(L.key, n.a.id) || favs.has(L.key, n.b.id);
    const lose = t => n.done && n.w && n.w !== t.id;
    const cr = t => `<i>${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : shield}</i>`;
    const has = n.sa != null && n.sb != null && (n.done || n.live || n.series && (n.sa || n.sb));
    const foot = n.live ? `<em class="lv">${esc(n.g && n.g.detail || 'Live')}</em>` : n.done ? `<em>${n.series ? 'Final' : esc(HW.finalWord ? HW.finalWord(n.g) : 'Final')}</em>` : `<em>${esc(HW.dayLabel ? HW.dayLabel(ymdOf(n.g.date), { month: 'short', day: 'numeric' }) : '')}</em>`;
    return `<a class="bxb${mine ? ' mine' : ''}${n.live ? ' on' : ''}" href="#game/${L.key}/${esc(n.g.id)}"><span class="bxc">${cr(n.a)}${cr(n.b)}</span><span class="bxn"><b class="${lose(n.a) ? 'lo' : ''}">${esc(n.a.abbr || n.a.short || '')}</b><b class="${lose(n.b) ? 'lo' : ''}">${esc(n.b.abbr || n.b.short || '')}</b></span>${has ? `<span class="bxs"><b class="${lose(n.a) ? 'lo' : ''}">${esc(String(n.sa))}</b><i>-</i><b class="${lose(n.b) ? 'lo' : ''}">${esc(String(n.sb))}</b></span>` : ''}${foot}</a>`;
  }
  // a tree up to four games wide: rows from the widest down to its last game, joined by bracket lines
  function rows(L, t, d) {
    const lv = levels(t, d).reverse(); let h = '';
    lv.forEach((row, i) => {
      const w = row.length, span = 4 / w; const lab = (row.find(Boolean) || {}).n; h += `<p class="bxr">${esc(lab ? lab.round : '')}</p><div class="bxg">${row.map(x => `<div style="grid-column:span ${span}">${box(L, x)}</div>`).join('')}</div>`;
      if (i < lv.length - 1) h += `<div class="bxg bxl">${Array.from({ length: w / 2 }, () => `<i style="grid-column:span ${span * 2}"></i>`).join('')}</div>`;
    });
    return h;
  }
  function block(L, t) { const d = depth(t); if (d <= 3) return rows(L, t, d); return block(L, t.kids[0]) + `<div class="bxsep"></div>` + block(L, t.kids[1]) + `<div class="bxg bxl one"><i style="grid-column:span 4"></i></div><p class="bxr">${esc(t.n.round)}</p><div class="bxg"><div style="grid-column:2/span 2">${box(L, t)}</div></div>`; }
  function trophy(L, t) { const n = t && t.n; const w = n && n.done ? (n.w === n.a.id ? n.a : n.b) : null;
    return `<div class="bxt"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8h24v14a12 12 0 0 1-24 0z" fill="currentColor"/><path d="M20 12H10v4a10 10 0 0 0 10 10M44 12h10v4a10 10 0 0 1-10 10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M29 34h6v10h-6z" fill="currentColor"/><path d="M22 48h20v6H22z" fill="currentColor"/></svg>${w ? `<span class="bxw">${w.logo ? `<img src="${esc(w.logo)}" alt="">` : ''}<b>${esc(w.short || w.abbr || '')}</b></span>` : ''}<em>${w ? 'Champion' : 'Champion to be decided'}</em></div>`; }

  /* the bracket for a tournament; for the 64-team field, one region at a time */
  async function view(L, T, part) {
    let games = await range(L, T.from, T.to, T.extra); let nodes = nodesOf(T, games); let label = T.label;
    if (!nodes.length && T.fallback) { const F = { ...T, ...T.fallback }; games = await range(L, F.from, F.to, F.extra); nodes = nodesOf(F, games); label = F.label; }
    const t = treeOf(nodes); if (!t) return { label, html: '' };
    const d = depth(t);
    if (T.regions && d >= 6) {
      const e8 = levels(t, 3)[2].filter(Boolean);
      const regName = x => { const r = String(x.n.g.note || '').split(/\s+-\s+/).find(p => /region/i.test(p)); return r ? r.replace(/\s*region(al)?\s*/i, ' ').trim() : ''; };
      const parts = [['ff', 'Final Four'], ...e8.map((x, i) => ['r' + i, regName(x) || `Region ${i + 1}`])];
      const k = parts.some(([p]) => p === part) ? part : 'ff';
      const body = k === 'ff' ? rows(L, t, 3) + trophy(L, t) : block(L, e8[+k.slice(1)]);
      return { label, parts, part: k, html: body };
    }
    return { label, html: block(L, t) + trophy(L, t) };
  }

  /* ==================================================================================================================
     v407: THE FIELD — a tournament as a fixed set of slots, not a tree read back from results.

     A bracket people can fill in has to exist before a ball is thrown, so the field is built from the seeds: each region
     is 16 teams in the order the committee pairs them (1-16, 8-9, 5-12, ...), and every later slot is fed by two earlier
     ones. The real results and a person's picks are then two separate layers laid over the same slots, which is what
     lets the app say "you had Duke here, the game said Alabama".

     Slot ids are built from the bracket's own shape, never from a game id, so a pick made the day the field is announced
     still means something in the Elite 8 three weeks later.
       <region>-<round>-<i>    round 0 is that region's first round
       ff-0-0, ff-0-1          the national semifinals (a two-conference league has none)
       ff-1-0                  the final
     ================================================================================================================== */
  const SEEDS16 = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]];
  const SEEDS8 = [[1, 8], [4, 5], [3, 6], [2, 7]];
  const roundNames = n => n === 16 ? ['1st Round', '2nd Round', 'Sweet 16', 'Elite 8'] : ['1st Round', 'Semifinals', 'Conference Finals'];
  /* the region a game belongs to, in the feed's own words: "East Region" on the men's side, "Regional 2 in Albany" on the
     women's (shown as Albany 2), and for the pros the conference that opens the note ("East 1st Round - Game 3") */
  const regionOf = note => { const parts = String(note || '').split(/\s+-\s+/);
    const w = parts.map(x => /regional\s*(\d+)\s+in\s+(.+)/i.exec(x)).find(Boolean); if (w) return `${w[2].trim()} ${w[1]}`;
    const m = parts.find(x => /\bregion\b/i.test(x)); if (m) return m.replace(/\s*region\s*/i, '').trim();
    const c = /^(east|west)(?:ern)?(?:\s+conference)?\s+(1st round|first round|semifinals?|finals?)/i.exec(parts[0] || ''); if (c) return c[1][0].toUpperCase() + c[1].slice(1).toLowerCase();
    return ''; };
  const isFF = note => /final four|semifinal/i.test(note || '') && !/region/i.test(note || '');
  const isTitle = note => /national championship|championship game|\bfinals?\b/i.test(note || '') && !/region|semi|conference/i.test(note || '');

  /* the first round's games, grouped into regions, each with its teams by seed.
     College: four regions of 16, the seed on every team (curatedRank, which in March is the tournament seed).
     NBA: two conferences of 8 playing series; the feed carries no seeds, so they come from that season's standings
     (`seedMap`), and where a seed is missing it is the partner's: in the first round the seeds of a pair add up to 9.
     WNBA: one bracket of 8 seeded across the league; its semifinal winners meet in the final. */
  const isFirst = note => /\b(1st|first) round\b/i.test(note || '') && !/first four/i.test(note || '');
  function fieldFromGames(L, games, seedMap) {
    const pro = L.key === 'nba' || L.key === 'wnba';
    const first = games.filter(g => g.home && g.away && !g.home.tbd && !g.away.tbd && isFirst(g.note));
    const byReg = {};
    first.forEach(g => { const r = regionOf(g.note) || (pro ? L.label : ''); if (!r) return;
      const k = [g.home.id, g.away.id].sort().join('|');   // a series is one pairing, however many games it ran
      const list = byReg[r] = byReg[r] || []; if (!list.some(x => x.k === k)) list.push({ k, g }); });
    const names = Object.keys(byReg); if (!names.length) return null;
    const single = names.length === 1;
    const size = names.length >= 4 ? 16 : 8;
    const pairs = size === 16 ? SEEDS16 : SEEDS8;
    const seedFor = t => (t.rank >= 1 && t.rank <= size ? t.rank : null) || (seedMap && seedMap[String(t.id)]) || null;
    const regions = names.map(name => {
      const gs = byReg[name].map(x => x.g).sort((a, b) => new Date(a.date) - new Date(b.date));
      const seeded = {};
      gs.forEach(g => { let sa = seedFor(g.away), sh = seedFor(g.home);
        // the pros: a seed the standings did not give is the partner's complement (1 v 8, 4 v 5, ...)
        if (pro && size === 8) { if (sa && !sh) sh = 9 - sa; else if (sh && !sa) sa = 9 - sh;
          if (sa && sh && sa + sh !== 9) { const hi = Math.min(sa, sh); if (sa === hi) sh = 9 - hi; else sa = 9 - hi; } }
        if (sa && !seeded[sa]) seeded[sa] = g.away; if (sh && !seeded[sh]) seeded[sh] = g.home; });
      const haveSeeds = pairs.every(([x, y]) => seeded[x] && seeded[y]);
      const slots = [];
      const rounds = single ? ['1st Round', 'Semifinals'] : roundNames(size); const nR = rounds.length;
      for (let r = 0; r < nR; r++) {
        const n = pairs.length >> r;
        for (let i = 0; i < n; i++) slots.push({ id: `${name}-${r}-${i}`, reg: name, r, i, round: rounds[r], a: null, b: null, feed: r ? [`${name}-${r - 1}-${i * 2}`, `${name}-${r - 1}-${i * 2 + 1}`] : null });
      }
      pairs.forEach(([x, y], i) => { const s = slots[i];
        if (haveSeeds) { s.a = seeded[x]; s.b = seeded[y]; s.sa = x; s.sb = y; }
        else if (gs[i]) { const g = gs[i]; const ah = (seedFor(g.away) || 99) <= (seedFor(g.home) || 99); s.a = ah ? g.away : g.home; s.b = ah ? g.home : g.away; s.sa = seedFor(s.a); s.sb = seedFor(s.b); }
      });
      return { name, slots, size };
    }).filter(x => x.slots[0].a && x.slots[0].b);
    if (!regions.length || (regions.length < 2 && !single)) return null;
    const ff = [];
    if (regions.length === 4) { ff.push({ id: 'ff-0-0', reg: 'ff', r: 0, i: 0, round: 'Final Four', a: null, b: null, feed: [last(regions[0]), last(regions[1])] });
      ff.push({ id: 'ff-0-1', reg: 'ff', r: 0, i: 1, round: 'Final Four', a: null, b: null, feed: [last(regions[2]), last(regions[3])] });
      ff.push({ id: 'ff-1-0', reg: 'ff', r: 1, i: 0, round: 'Championship', a: null, b: null, feed: ['ff-0-0', 'ff-0-1'] }); }
    else if (single) { const R = regions[0]; const semis = R.slots.filter(s => s.r === 1).map(s => s.id);
      ff.push({ id: 'ff-1-0', reg: 'ff', r: 1, i: 0, round: 'Finals', a: null, b: null, feed: semis }); }
    else ff.push({ id: 'ff-1-0', reg: 'ff', r: 1, i: 0, round: 'Finals', a: null, b: null, feed: [last(regions[0]), last(regions[1])] });
    const all = regions.flatMap(r => r.slots).concat(ff);
    const byId = {}; all.forEach(s => { byId[s.id] = s; });
    return { lk: L.key, regions, ff, all, byId, size: regions[0].size, single, pro };
  }
  const last = reg => reg.slots[reg.slots.length - 1].id;

  /* the games as they were actually played, laid onto the slots: each slot learns its game, its winner, and (for a slot
     whose teams only exist once the round before is over) who actually turned up */
  function applyResults(F, games) {
    if (!F) return F;
    const pool = games.filter(g => g.home && g.away && !g.home.tbd && !g.away.tbd);
    const pairOf = (slot, g) => (sameT(g.home, slot.a) && sameT(g.away, slot.b)) || (sameT(g.home, slot.b) && sameT(g.away, slot.a));
    const take = (slot, within) => {
      const gs = pool.filter(g => within(g) && pairOf(slot, g)).sort((x, y) => new Date(x.date) - new Date(y.date)); if (!gs.length) return;
      const fin = g => g.state === 'post' && !g.off && g.home.score != null && g.away.score != null;
      const winOf = g => +g.home.score > +g.away.score ? g.home : g.away;
      if (!F.pro) { const g = gs[0]; slot.game = g; slot.live = g.state === 'in'; slot.final = fin(g); slot.won = slot.final ? winOf(g) : null; return; }
      // a series: wins counted from the games, or the feed's own count on its latest game; done when the feed says so
      const wa = gs.filter(g => fin(g) && sameT(winOf(g), slot.a)).length, wb = gs.filter(g => fin(g) && sameT(winOf(g), slot.b)).length;
      const lastG = gs[gs.length - 1], sr = lastG.series || {};
      const fa = sr.hw != null ? (sameT(lastG.home, slot.a) ? sr.hw : sr.aw) : null, fb = sr.hw != null ? (sameT(lastG.home, slot.b) ? sr.hw : sr.aw) : null;
      const A = Math.max(wa, fa || 0), Bw = Math.max(wb, fb || 0);
      const need = sr.total ? Math.ceil(sr.total / 2) : (F.lk === 'wnba' && slot.r === 0 ? 2 : 4);
      slot.series = { a: A, b: Bw, need, n: gs.length };
      slot.game = gs.find(g => g.state !== 'post') || lastG; slot.live = gs.some(g => g.state === 'in');
      const done = !!sr.done || A >= need || Bw >= need;
      slot.final = done; slot.won = done ? (A > Bw ? slot.a : slot.b) : null;
    };
    F.regions.forEach(reg => {
      reg.slots.forEach(s => {
        if (s.r > 0) { const [x, y] = s.feed.map(id => F.byId[id]); s.a = x && x.won; s.b = y && y.won; s.sa = seedOf(F, s.a); s.sb = seedOf(F, s.b); }
        if (!s.a || !s.b) return;
        take(s, g => F.pro ? !isTitleFor(F, g.note) : (regionOf(g.note) === reg.name));
      });
    });
    F.ff.forEach(s => { const [x, y] = s.feed.map(id => F.byId[id]); s.a = x && x.won; s.b = y && y.won; s.sa = seedOf(F, s.a); s.sb = seedOf(F, s.b);
      if (!s.a || !s.b) return; take(s, g => s.r === 1 ? isTitleFor(F, g.note) : isFF(g.note)); });
    return F;
  }
  const isTitleFor = (F, note) => F.pro ? /\b(nba|wnba) finals\b/i.test(note || '') : isTitle(note);
  const dp = c => (HW.v5 && HW.v5._ && HW.v5._.deepen) ? HW.v5._.deepen(c) : c;
  const sameT = (x, y) => x && y && String(x.id) === String(y.id);
  const seedOf = (F, t) => { if (!t) return null; const f = F.regions.flatMap(r => r.slots).find(s => s.r === 0 && (sameT(s.a, t) || sameT(s.b, t))); return !f ? null : sameT(f.a, t) ? f.sa : f.sb; };

  /* ---------- a person's own bracket ---------- */
  const pkey = (lk, key) => `v5:brkpicks:${lk}:${key}`;
  const picksOf = (lk, key) => { try { return HW.store.get(pkey(lk, key), null) || { p: {}, at: 0 }; } catch { return { p: {}, at: 0 }; } };
  const savePicks = (lk, key, v) => HW.store.set(pkey(lk, key), { ...v, at: Date.now() });
  const clearPicks = (lk, key) => HW.store.set(pkey(lk, key), { p: {}, at: 0 });

  /* who the person has in every slot, worked out from their picks alone: a pick in the first round carries all the way
     up until a later slot has no pick of its own */
  function mine(F, picks) {
    const p = (picks && picks.p) || {}; const out = {};
    const teams = {};   // slot id -> the two teams the person's own run put there
    const put = s => {
      let a = s.a, b = s.b;
      if (s.r > 0 || s.reg === 'ff') { const [x, y] = s.feed.map(id => out[id]); a = x || null; b = y || null; }
      teams[s.id] = [a, b];
      const pick = p[s.id]; out[s.id] = pick ? [a, b].find(t => t && String(t.id) === String(pick)) || null : null;
    };
    F.regions.forEach(reg => reg.slots.forEach(put));
    F.ff.forEach(put);
    return { win: out, teams };
  }
  /* the picks in the order they are asked for: a region at a time, round by round, then the Final Four */
  const order = F => F.regions.flatMap(r => r.slots.slice().sort((a, b) => a.r - b.r || a.i - b.i)).concat(F.ff.slice().sort((a, b) => a.r - b.r || a.i - b.i));

  /* the office-pool count: a round is worth double the one before it */
  function score(F, picks) {
    const m = mine(F, picks); const dead = deadOf(F); let pts = 0, right = 0, wrong = 0, open = 0, max = 0;
    const perRound = {};
    order(F).forEach(s => {
      const w = s.won, got = m.win[s.id];
      const nRR = F.regions[0].slots[F.regions[0].slots.length - 1].r + 1; const depth = s.reg === 'ff' ? nRR + (F.ff.some(x => x.r === 0) ? s.r : 0) : s.r;
      const val = 1 << depth;
      const row = perRound[s.round] = perRound[s.round] || { round: s.round, right: 0, of: 0, pts: 0 };
      if (!got) { if (w) { wrong++; row.of++; } else open++; return; }
      // a pick whose team has already gone home is lost even though its own game is still to come
      if (!w) { if (dead.has(String(got.id))) wrong++; else { open++; max += val; } return; }
      row.of++;
      if (sameT(w, got)) { pts += val; right++; row.right++; row.pts += val; max += val; } else wrong++;
    });
    return { pts, right, wrong, open, max, rounds: Object.values(perRound).filter(r => r.of) };
  }
  const filled = (F, picks) => order(F).filter(s => (picks.p || {})[s.id]).length;


  /* ---------- the chart: a region on one screen, the real bracket shape ----------
     Four columns, the first round down the left, each later game centred between the two it is fed by. Nothing scrolls
     sideways inside a region, so the whole run from the first round to the regional final is on the glass at once; the
     regions themselves are the pages you swipe between. */
  function teamRow(L, t, seed, o) {
    if (!t) return `<span class="bk2t gh"><i class="bk2s"></i><i class="bk2l"></i><b>${esc(o.wait || 'TBD')}</b></span>`;
    const c = HW.v5._.teamColor(t, L);
    return `<span class="bk2t${o.cls ? ' ' + o.cls : ''}"${o.pick ? ` data-pick="${esc(String(t.id))}"` : ''} style="--tc:${esc(c)}">`
      + `<i class="bk2s">${seed || ''}</i>`
      + `<i class="bk2l">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}</i>`
      + `<b>${esc(t.abbr || t.short || '')}</b>`
      + (o.sc != null ? `<em>${esc(String(o.sc))}</em>` : '')
      + (o.mark || '') + `</span>`;
  }
  const tick = `<svg class="bk2k" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.4 4.8 9.2 10 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function slotBox(L, F, s, M, dead) {
    const myW = M.win[s.id]; const [ma, mb] = M.teams[s.id] || [null, null];
    const a = s.a || ma, b = s.b || mb;
    const sa = s.sa != null ? s.sa : seedOf(F, a), sb = s.sb != null ? s.sb : seedOf(F, b);
    const row = (t, seed, other) => {
      if (!t) return teamRow(L, null, null, { wait: 'TBD' });
      const picked = myW && sameT(myW, t);
      const realW = s.won;
      const beat = realW && !sameT(realW, t);
      const bust = picked && (realW ? !sameT(realW, t) : dead && dead.has(String(t.id)));
      const cls = [picked ? 'pk' : '', bust ? 'bust' : '', beat ? 'out' : '', realW && sameT(realW, t) ? 'adv' : ''].filter(Boolean).join(' ');
      const sc = s.series ? (s.series.n ? (sameT(s.a, t) ? s.series.a : s.series.b) : null) : s.game && s.final ? (sameT(s.game.home, t) ? s.game.home.score : sameT(s.game.away, t) ? s.game.away.score : null) : null;
      return teamRow(L, t, seed, { cls, sc, pick: true, mark: picked ? tick : '' });
    };
    const open = a && b && !s.won;
    return `<div class="bk2b${s.live ? ' lv' : ''}${open ? ' open' : ''}" data-slot="${esc(s.id)}">${row(a, sa, b)}${row(b, sb, a)}</div>`;
  }

  /* a region reads two rounds at a time, the way the wall chart was mocked: the earlier round down the left at full
     size, each winner's box bridged into the later round on the right. The swipe carries on into the region's second
     half, then the next region. */
  function stagePanel(L, F, reg, M, stage, dead) {
    const r0 = stage * 2;
    const cols = [reg.slots.filter(s => s.r === r0), reg.slots.filter(s => s.r === r0 + 1)].filter(c => c.length);
    const n0 = cols[0].length;
    const head = `<div class="bk2h">${cols.map(c => `<span>${esc(c[0].round)}</span>`).join('')}</div>`;
    const grid = `<div class="bk2g" style="--n:${n0}">` + cols.map((c, r) => c.map((s, i) =>
      `<div class="bk2c" style="grid-column:${r + 1};grid-row:${i * (1 << r) + 1} / span ${1 << r}">${slotBox(L, F, s, M, dead)}</div>`).join('')).join('')
      + (cols.length > 1 ? cols[0].map((s, i) => i % 2 ? '' : `<i class="bk2j" style="grid-column:1;grid-row:${i + 1} / span 2"></i>`).join('') : '')
      + `</div>`;
    return head + grid;
  }

  function ffPanel(L, F, M, dead) {
    const semis = F.ff.filter(s => s.r === 0), fin = F.ff.find(s => s.r === 1);
    const champ = fin && (fin.won || M.win[fin.id]);
    const real = fin && fin.won;
    const body = (semis.length ? `<p class="bk2r">${esc(semis[0].round)}</p><div class="bk2ff">${semis.map(s => slotBox(L, F, s, M)).join('')}</div>` : '')
      + `<p class="bk2r">${esc(fin ? fin.round : '')}</p><div class="bk2ff one">${fin ? slotBox(L, F, fin, M, dead) : ''}</div>`;
    const hero = champ ? (() => { const d = dp(HW.v5._.teamColor(champ, L));
      return `<div class="bk2w" style="--ca:${esc(d)}"><span class="bk2wm">${esc(champ.abbr || '')}</span>`
        + `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8h24v14a12 12 0 0 1-24 0z" fill="currentColor"/><path d="M20 12H10v4a10 10 0 0 0 10 10M44 12h10v4a10 10 0 0 1-10 10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M29 34h6v10h-6zM22 48h20v6H22z" fill="currentColor"/></svg>`
        + `<b>${esc(champ.short || champ.name || '')}</b><span>${real ? 'Champions' : 'Your pick to win it all'}</span></div>`; })() : '';
    return hero + body;
  }

  const deadOf = F => { const d = new Set(); F.all.forEach(s => { if (s.final && s.game) { const l = +s.game.home.score > +s.game.away.score ? s.game.away : s.game.home; d.add(String(l.id)); } }); return d; };
  function chart(L, F, picks) {
    const M = mine(F, picks); const dead = deadOf(F);
    const tabs = F.regions.map(r => [r.name, r.name]).concat([['ff', F.regions.length === 4 ? 'Final Four' : 'Finals']]);
    const stages = F.regions[0].slots[F.regions[0].slots.length - 1].r >= 2 ? 2 : 1;
    const panels = F.regions.flatMap(r => Array.from({ length: stages }, (_, st) =>
      `<div data-pg="${esc(r.name)}·${st}" data-pgtab="${esc(r.name)}">${stagePanel(L, F, r, M, st, dead)}</div>`))
      .concat(`<div data-pg="ff" data-pgtab="ff">${ffPanel(L, F, M, dead)}</div>`).join('');
    return { tabs, html: `<div class="bk2strip">${panels}</div>` };
  }


  /* ==================================================================================================================
     THE GAUNTLET — picking the bracket one matchup at a time.

     The whole screen becomes the matchup, painted in the two teams' colours with the same diagonal seam as a game card.
     A tap on a side is the pick: it saves at once, and the next matchup slides in. The order is the bracket's own —
     a region at a time, round by round, then the Final Four — so by the time a second-round game asks for a pick, both
     of its teams are the person's own winners. Changing an early pick quietly clears any later pick it carried.
     ================================================================================================================== */
  function cleanse(F, picks) {
    const p = picks.p || {};
    for (let pass = 0; pass < 6; pass++) {
      const M = mine(F, picks); let dropped = false;
      order(F).forEach(s => { const pk = p[s.id]; if (!pk) return; const [a, b] = M.teams[s.id] || [];
        if (!(a && String(a.id) === String(pk)) && !(b && String(b.id) === String(pk))) { delete p[s.id]; dropped = true; } });
      if (!dropped) break;
    }
    return picks;
  }

  const crest = (t, L) => { const c = HW.v5._.teamColor(t, L);
    return `<span class="bkpc" style="--tc:${esc(c)}">${t.logo ? `<img src="${esc(t.logo)}" alt="" onerror="this.style.visibility='hidden'">` : `<b>${esc((t.abbr || '').slice(0, 4))}</b>`}</span>`; };

  function play(L, key, F) {
    if (!F) return;
    document.querySelectorAll('.bkov').forEach(x => x.remove());
    const lk = L.key; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let picks = cleanse(F, picksOf(lk, key));
    const Q = order(F); const total = Q.length;
    let idx = Q.findIndex(s => !(picks.p || {})[s.id]); if (idx < 0) idx = 0;
    const ov = document.createElement('div'); ov.className = 'bkov'; document.body.appendChild(ov);
    document.documentElement.classList.add('noscroll');
    const close = () => { ov.remove(); document.documentElement.classList.remove('noscroll'); if (HW.v5.render) HW.v5.render(); };

    const whereOf = s => { const sib = Q.filter(x => x.reg === s.reg && x.r === s.r); const at = sib.indexOf(s) + 1;
      const name = s.reg === 'ff' ? s.round : `${s.reg} · ${s.round}`;
      return sib.length > 1 ? `${name} <span>· ${at} of ${sib.length}</span>` : name; };

    const tickS = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6.5 5 9l5-6"/></svg>`;
    const sideHtml = (t, seed, cls, c) => !t ? '' :
      `<button class="bkside${cls ? ' ' + cls : ''}" data-side="${esc(String(t.id))}" style="--sc:${esc(c)}">${crest(t, L)}<span class="bknm"><b>${esc(t.short || t.name)}</b><span>${[seed ? `${seed} seed` : '', t.rec || ''].filter(Boolean).join(' · ')}</span><span class="bkadv">${tickS}ADVANCING</span></span></button>`;

    const paint = (dir) => {
      const M = mine(F, picks); const s = Q[idx];
      const [a, b] = M.teams[s.id] || []; if (!a || !b) { close(); return; }
      const sa = seedOf(F, a), sb = seedOf(F, b);
      const ca = dp(HW.v5._.teamColor(a, L)), cb = dp(HW.v5._.teamColor(b, L));
      const done = filled(F, picks);
      const nexts = Q.slice(idx + 1, idx + 4).map(x => { const [p1, p2] = M.teams[x.id] || []; if (!p1 || !p2) return '';
        return `<span><em>${seedOf(F, p1) || ''}</em> ${esc(p1.abbr)} <em>vs ${seedOf(F, p2) || ''}</em> ${esc(p2.abbr)}</span>`; }).filter(Boolean).join('');
      const myPick = (picks.p || {})[s.id]; const myA = myPick === String(a.id), myB = myPick === String(b.id);
      const sm0 = myA ? 64.2 : myB ? 28.2 : 46.2;   // a matchup already picked opens with the pick's colour holding more of the card
      ov.innerHTML = `<div class="bkovh"><button class="bkx" data-bko="x" aria-label="Close">✕</button><b>${whereOf(s)}</b><button class="bkx${idx ? '' : ' off'}" data-bko="back" aria-label="Previous matchup">‹</button></div>`
        + `<div class="pbar bkpb"><i style="width:${(done / total * 100).toFixed(1)}%"></i></div>`
        + `<div class="bkduel${dir ? ' in' : ''}" style="--ca:${esc(ca)};--cb:${esc(cb)};--sm:${sm0}%">`
        + `<span class="wm a">${esc(a.abbr || '')}</span><span class="wm h">${esc(b.abbr || '')}</span>`
        + `<p class="bkq">WHO ADVANCES?</p>${sideHtml(a, sa, myA ? 'arm' : myB ? 'dim' : '', ca)}<span class="bkvs">VS</span>${sideHtml(b, sb, myB ? 'arm' : myA ? 'dim' : '', cb)}`
        + `<p class="bktap">${myPick ? 'Tap or swipe to change it' : `Swipe · ← ${esc(a.abbr || '')} / ${esc(b.abbr || '')} → · or tap`}</p></div>`
        + (nexts ? `<p class="bknxt">NEXT UP</p><div class="bkups">${nexts}</div>` : '<p class="bknxt"></p>')
        + `<p class="bkfoot">Picks save as you go · close and finish later</p>`;
      if (dir && !reduce) requestAnimationFrame(() => { const d = ov.querySelector('.bkduel'); if (d) d.classList.remove('in'); });
    };

    const finish = () => {
      const M = mine(F, picks); const champ = M.win['ff-1-0'];
      const ffIds = F.ff.filter(x => x.r === 0).length ? F.ff.filter(x => x.r === 0).flatMap(x => M.teams[x.id] || []) : (M.teams['ff-1-0'] || []);
      const c = champ ? dp(HW.v5._.teamColor(champ, L)) : '#1b3f7a';
      const sc = score(F, picks);
      ov.innerHTML = `<div class="bkovh"><button class="bkx" data-bko="x" aria-label="Close">✕</button><b>Your bracket <span>· done</span></b><span class="bkx off"></span></div>`
        + `<div class="bkw bkwin" style="--ca:${esc(c)}"><span class="bkwm">${esc(champ ? champ.abbr : '')}</span>`
        + `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8h24v14a12 12 0 0 1-24 0z" fill="currentColor"/><path d="M20 12H10v4a10 10 0 0 0 10 10M44 12h10v4a10 10 0 0 1-10 10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M29 34h6v10h-6zM22 48h20v6H22z" fill="currentColor"/></svg>`
        + `<b>${esc(champ ? `${champ.short || champ.name} to win it all` : 'All picked')}</b><span>${filled(F, picks)} of ${total} picked${sc.of ? '' : ''}</span></div>`
        + (ffIds.length ? `<p class="bknxt">YOUR ${F.regions.length === 4 ? 'FINAL FOUR' : 'FINALISTS'}</p><div class="bkff4">${ffIds.filter(Boolean).map(t => `<span>${crest(t, L)}<b>${esc(t.abbr || t.short)}</b></span>`).join('')}</div>` : '')
        + `<button class="bkgo bkcta" data-bko="x"><b>See your full bracket</b><span>Right picks turn green as the real games go final</span></button>`;
    };

    let settling = false;
    const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(12); } catch { } };
    const choose = (side, wait, flew) => {
      if (settling || !side) return; settling = true;
      const s = Q[idx]; picks.p = picks.p || {}; picks.p[s.id] = side.dataset.side;
      cleanse(F, picks); savePicks(lk, key, picks); picks = picksOf(lk, key);
      if (!flew) {   // a tap: the chosen colour floods the card and the pill pops before the next card arrives
        const d = ov.querySelector('.bkduel');
        if (d) { const [ta, tb] = sidesOf(d); const top = side === ta; const ot = top ? tb : ta;
          d.classList.remove('drag'); side.classList.remove('dim'); side.classList.add('arm');
          if (ot) { ot.classList.remove('arm'); ot.style.opacity = '.38'; ot.style.filter = 'saturate(.6)'; ot.style.transform = 'scale(.96)'; }
          d.style.setProperty('--sm', top ? '86%' : '7%'); buzz(); }
      }
      setTimeout(() => { settling = false; if (idx + 1 >= total) { finish(); } else { idx++; paint('f'); } }, reduce ? 60 : (flew ? 230 : 330));
    };
    ov.addEventListener('click', e => {
      const x = e.target.closest('[data-bko]');
      if (x) { e.preventDefault(); if (x.dataset.bko === 'x') close(); else if (x.dataset.bko === 'back' && idx > 0 && !settling) { idx--; paint('b'); } return; }
      const side = e.target.closest('.bkside'); if (!side || drag && drag.moved) return;
      e.preventDefault(); choose(side, 240);
    });
    /* the deck swipe, the takeover: as the card rides the finger, the seam slides so the chosen team's colour claims
       the card, their side grows while the other greys out and shrinks, and at the point of no return their ADVANCING
       pill pops with a small buzz. Letting go past it floods the card and the pick is made; short of it, it springs back. */
    let drag = null;
    const sidesOf = d => d.querySelectorAll('.bkside');
    const TH = d => Math.max(96, d.clientWidth * .32);
    ov.addEventListener('touchstart', e => { const d = e.target.closest('.bkduel'); if (!d || settling) return;
      const [ta, tb] = sidesOf(d);
      drag = { d, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, moved: false, armed: false,
        sm0: d.style.getPropertyValue('--sm') || '46.2%', cls: [ta && ta.className, tb && tb.className] }; }, { passive: true });
    ov.addEventListener('touchmove', e => { if (!drag) return;
      const dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
      if (!drag.moved) { if (Math.abs(dx) < 8) { if (Math.abs(dy) > 16) drag = null; return; } drag.moved = true; drag.d.classList.add('drag'); }
      drag.dx = dx; const d = drag.d;
      d.style.transform = `translateX(${dx}px) rotate(${(dx / 28).toFixed(2)}deg)`;
      const p = Math.min(1, Math.abs(dx) / TH(d));
      d.style.setProperty('--sm', (46.2 + (dx < 0 ? 1 : -1) * 34 * p).toFixed(1) + '%');
      const [ta, tb] = sidesOf(d); if (!ta || !tb) return;
      const ch = dx < 0 ? ta : tb, ot = dx < 0 ? tb : ta;
      ch.style.opacity = ''; ch.style.filter = ''; ch.style.transform = `scale(${(1 + .04 * p).toFixed(3)})`; ch.classList.remove('dim');
      ot.style.opacity = String(1 - .62 * p); ot.style.filter = `saturate(${(1 - .45 * p).toFixed(2)})`; ot.style.transform = `scale(${(1 - .05 * p).toFixed(3)})`;
      const armed = p >= 1;
      if (armed !== drag.armed) { drag.armed = armed; ch.classList.toggle('arm', armed); ot.classList.remove('arm'); if (armed) buzz(); }
      if (!armed) { ta.classList.remove('arm'); tb.classList.remove('arm'); } }, { passive: true });
    const endDrag = () => { if (!drag) return; const { d, dx, moved, armed, sm0, cls } = drag; drag = null; if (!moved) return;
      const [ta, tb] = sidesOf(d);
      if (armed) {
        const side = dx < 0 ? ta : tb;
        d.classList.remove('drag');
        if (!reduce) { d.style.transform = `translateX(${(dx < 0 ? -1.2 : 1.2) * d.clientWidth}px) rotate(${dx < 0 ? -9 : 9}deg)`; d.style.opacity = '0';
          d.style.setProperty('--sm', dx < 0 ? '108%' : '-8%'); }
        choose(side, 230, true);
      } else {   // not far enough: everything glides back to where it was
        d.classList.remove('drag'); d.style.transform = ''; d.style.setProperty('--sm', sm0);
        [ta, tb].forEach((x, i) => { if (!x) return; x.style.opacity = ''; x.style.filter = ''; x.style.transform = ''; if (cls[i] != null) x.className = cls[i]; }); } };
    ov.addEventListener('touchend', endDrag, { passive: true });
    ov.addEventListener('touchcancel', endDrag, { passive: true });
    if (idx >= total || (filled(F, picks) >= total && idx === 0 && false)) finish(); else paint();
  }

  HW.bracket = { list, view, chart, play, cleanse, fieldFromGames, applyResults, picksOf, savePicks, clearPicks, mine, order, score, filled, range, regionOf, seedOf };
})();
