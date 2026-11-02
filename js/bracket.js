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
  async function range(L, a, b, extra = '') {
    const params = String(L.sbParams || '').replace(/&limit=\d+/, '');
    const url = `${API(L)}/scoreboard?dates=${compact(a)}-${compact(b)}${params}${extra}&limit=1000`;
    if (mem[url]) return mem[url];
    const p = jSoft(url, a > todayCT() || b < addDays(todayCT(), -2) ? 6 * 3600000 : 300000).then(d => (d && d.events || []).map(e => { try { return parseEvent(e, L); } catch { return null; } }).filter(Boolean)).catch(() => []);
    mem[url] = p; return p;
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
      out.push({ key: `po${yr}`, label: `${yr} Playoffs`, kind: 'series', from: `${yr}-${s0}`, to: `${yr}-${s1}`, extra: '&seasontype=3', match: n => !/play-?in/i.test(n), fallback: { key: `po${yr - 1}`, label: `${yr - 1} Playoffs`, from: `${yr - 1}-${s0}`, to: `${yr - 1}-${s1}` } });
    }
    if (L.key === 'ncaam' || L.key === 'ncaaw') {
      // the holiday events around now: any tournament with its games named in the feed
      const games = await range(L, addDays(t, -14), addDays(t, 21));
      const by = {};
      games.forEach(g => { const n = nameOf(g.note); if (!n || /basketball championship|conference|^game\s*\d|regular season/i.test(n) || !/\s-\s/.test(g.note || '')) return; (by[n] = by[n] || []).push(g); });
      Object.entries(by).filter(([, gs]) => gs.length >= 3).sort((a, b) => a[1].map(g => g.date).sort()[0] < b[1].map(g => g.date).sort()[0] ? -1 : 1)
        .forEach(([n]) => out.push({ key: 'h:' + n, label: n, kind: 'games', from: addDays(t, -14), to: addDays(t, 21), extra: '', match: x => nameOf(x) === n }));
      const yr = md >= '03-15' ? y : y - 1;
      out.push({ key: `nc${yr}`, label: `${yr} NCAA Tournament`, kind: 'games', from: `${yr}-03-15`, to: `${yr}-04-10`, extra: '&seasontype=3', match: n => /basketball championship/i.test(n) && !/first four/i.test(n), regions: true });
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
  HW.bracket = { list, view };
})();
