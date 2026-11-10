/* v443: Unrivaled, with depth. Ray's pick, Court: the league is three on three, so its pages are built on the floor.
   The hub ranks the eight clubs, puts the next night's two threes face to face and carries standings, leaders and the
   tour. A club has its own page (its best three on a half court, the rest of the six, the schedule with a win chance on
   every game), every game has a preview that turns into the box score, and every player has a profile.
   All of it reads data/unrivaled.json, built by the Unrivaled job from the league's own site plus each newcomer's WNBA
   season. Ratings, power and win chance are RIVL's projection (game score per minute; 2027 games count double). */
(function () {
  const V = HW.v5, _ = V._, { esc, store, todayCT, dayLabel } = HW;
  const $main = document.getElementById('main');
  let D = null, DAt = 0;
  const load = async () => { if (D && Date.now() - DAt < 5 * 60000) return D; const d = HW.hub ? await HW.hub.file('unrivaled.json').catch(() => null) : null; if (d && d.clubs) { D = d; DAt = Date.now(); } return D; };
  const favs = () => store.get('v5:unrfav', []) || [];
  const isFav = n => favs().includes(n);

  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>',
    star: on => `<svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`,
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8.5 21h7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
  };
  const COURT = '<svg class="ucrt" viewBox="0 0 380 300" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="1" width="378" height="298" rx="18"/><path d="M190 1v298"/><circle cx="190" cy="150" r="34"/><path d="M1 96h62v108H1M379 96h-62v108h62"/><path d="M63 118a32 32 0 0 1 0 64M317 118a32 32 0 0 0 0 64"/><path d="M1 44c96 12 120 62 120 106s-24 94-120 106M379 44c-96 12-120 62-120 106s24 94 120 106"/></svg>';
  const HALF = '<svg class="ucrt" viewBox="0 0 380 300" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 300V19a18 18 0 0 1 18-18h342a18 18 0 0 1 18 18v281"/><path d="M132 300V178h116v122"/><path d="M144 178a46 46 0 0 1 92 0"/><path d="M34 300v-78c0-74 70-124 156-124s156 50 156 124v78"/><circle cx="190" cy="272" r="9"/><path d="M168 286h44"/><path d="M150 1a40 40 0 0 0 80 0"/></svg>';

  // ---------- data helpers
  const clubs = d => d.clubs || [];
  const club = (d, name) => clubs(d).find(c => c.name === name || c.slug === name);
  const people = d => [...clubs(d).flatMap(c => (c.players || []).map(p => ({ ...p, club: c.name }))), ...(d.pool || []).map(p => ({ ...p, club: '' }))];
  const person = (d, id) => people(d).find(p => p.id === id);
  const last = p => p.last || String(p.name || '').split(' ').slice(-1)[0];
  const hrefC = c => `#unr/club/${c.slug}`, hrefG = g => `#unr/game/${g.id}`, hrefP = p => `#unr/player/${p.id}`;
  const lgo = (c, s) => c && c.logo ? `<img class="ulg" src="${esc(c.logo)}" alt="" width="${s}" height="${s}" style="width:${s}px;height:${s}px" loading="lazy" onerror="this.remove()">` : '';
  const face = (p, c, s) => _.headshot(p.img || '', c ? c.color : '', s, p.name);
  const when = g => { if (g.at) { try { return new Date(g.at).toLocaleTimeString('en-US', { timeZone: HW.TZ, hour: 'numeric', minute: '2-digit' }); } catch (e) {} } return g.time || 'Time TBA'; };
  const dayOf = g => dayLabel(g.ymd, { weekday: 'short', month: 'short', day: 'numeric' });
  const two = g => g.teams && g.teams.length === 2;
  const pct = x => Math.round(x * 100);
  const fav = (d, g) => { if (!two(g) || g.p0 == null) return null; const a = g.p0 >= .5; return { c: club(d, g.teams[a ? 0 : 1]), p: pct(a ? g.p0 : 1 - g.p0) }; };
  const games = d => [...(d.games || [])].filter(g => g.ymd).sort((a, b) => ((a.at || a.ymd + 'T23') < (b.at || b.ymd + 'T23') ? -1 : 1));
  const played = d => games(d).filter(g => g.final && g.score && two(g));
  const ahead = d => { const t = todayCT(); return games(d).filter(g => !g.final && g.ymd >= t); };
  // the three on the floor: a guard, a wing and a big, the best of each; short a position, the next best fills in
  const three = c => { const ps = [...(c.players || [])].sort((a, b) => b.rating - a.rating); const out = []; const take = re => { const p = ps.find(x => re.test(x.pos || '') && !out.includes(x)); if (p) out.push(p); };
    take(/G/); take(/W/); take(/F|C/); ps.forEach(p => { if (out.length < 3 && !out.includes(p)) out.push(p); }); return out.slice(0, 3); };
  const top3 = c => [...(c.players || [])].sort((a, b) => b.rating - a.rating).slice(0, 3);
  function table(d) {
    const T = {}; clubs(d).forEach(c => { T[c.name] = { c, w: 0, l: 0, pf: 0, pa: 0, res: [] }; });
    played(d).forEach(g => { const [a, b] = g.teams, [x, y] = g.score; if (!T[a] || !T[b]) return; T[a].pf += x; T[a].pa += y; T[b].pf += y; T[b].pa += x;
      if (x > y) { T[a].w++; T[b].l++; T[a].res.push('W'); T[b].res.push('L'); } else { T[b].w++; T[a].l++; T[b].res.push('W'); T[a].res.push('L'); } });
    const rows = Object.values(T).sort((a, b) => (b.w - b.l) - (a.w - a.l) || (b.pf - b.pa) - (a.pf - a.pa));
    const top = rows[0] || { w: 0, l: 0 };
    rows.forEach(r => { r.gb = ((top.w - r.w) + (r.l - top.l)) / 2; const s = r.res.slice().reverse(); let n = 0; while (n < s.length && s[n] === s[0]) n++; r.strk = s.length ? s[0] + n : ''; });
    return rows;
  }
  const rec = (d, name) => { const r = table(d).find(x => x.c.name === name); return r && (r.w || r.l) ? `${r.w}-${r.l}` : ''; };
  const tok = (p, c, x, y, s, sub) => `<a class="utok" href="${hrefP(p)}" style="left:${x}%;top:${y}%"><span class="uw">${face(p, c, s)}<em>${p.rating}</em></span><b>${esc(last(p))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</a>`;
  const dial = (p, c, c2) => `<span class="udial"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="40" fill="none" stroke="${c2.color}" stroke-width="7"/><circle cx="46" cy="46" r="40" fill="none" stroke="${c.color}" stroke-width="7" stroke-dasharray="${(p / 100 * 251.3).toFixed(1)} 252" stroke-linecap="butt"/></svg><span><b>${p}%</b><small>${esc(c.name)}</small></span></span>`;
  const sec = (t, s, more) => `<div class="usec"><h2>${esc(t)}</h2>${s ? `<small>${esc(s)}</small>` : ''}${more || ''}</div>`;
  const note = '<p class="unote2">Ratings, power and win chance are RIVL projections from 2026 play (Unrivaled first, then WNBA or college for newcomers). Results move them as the season goes.</p>';

  // a game on the floor: the two threes facing each other, the win chance (or the final) at center court
  function floor(d, g, opts = {}) {
    const a = club(d, g.teams[0]), b = club(d, g.teams[1]); if (!a || !b) return '';
    const ta = three(a), tb = three(b); const s = opts.big ? 44 : 36;
    const spots = opts.big ? [[14, 34], [24, 58], [14, 82]] : [[11, 36], [25, 62], [11, 86]];
    const fin = g.final && g.score;
    const mid = fin ? `<span class="ufin"><b>${g.score[0]}<i>-</i>${g.score[1]}</b><small>Final</small></span>` : g.p0 != null ? dial(pct(g.p0 >= .5 ? g.p0 : 1 - g.p0), g.p0 >= .5 ? a : b, g.p0 >= .5 ? b : a)   /* v450: the same dial on the hub and the game page */ : '';
    return `<div class="ufl${opts.big ? ' big' : ''}" style="--ca:${a.color};--cb:${b.color}">${COURT}${opts.head || ''}`
      + ta.map((p, i) => tok(p, a, spots[i][0], spots[i][1], s)).join('') + tb.map((p, i) => tok(p, b, 100 - spots[i][0], spots[i][1], s)).join('') + mid + '</div>';
  }
  const gameRow = (d, g) => { const a = club(d, g.teams[0]), b = club(d, g.teams[1]); const f = fav(d, g); const fin = g.final && g.score;
    if (!two(g) || !a || !b) return `<div class="ugr"><span class="tbd">Matchup to be set</span><span class="t">${esc(when(g))}</span></div>`;
    const w0 = fin && g.score[0] > g.score[1];
    return `<a class="ugr" href="${hrefG(g)}">${lgo(a, 24)}<b class="${fin && !w0 ? 'lo' : ''}">${esc(a.name)}</b>${fin ? `<em class="${w0 ? '' : 'lo'}">${g.score[0]}</em>` : '<i>vs</i>'}${lgo(b, 24)}<b class="${fin && w0 ? 'lo' : ''}">${esc(b.name)}</b>${fin ? `<em class="${w0 ? 'lo' : ''}">${g.score[1]}</em>` : ''}`
      + `<span class="t">${fin ? 'Final' : esc(when(g))}${!fin && f ? `<small>${esc(f.c.name)} ${f.p}%</small>` : ''}</span></a>`; };

  // ---------- the hub (the Unrivaled view of the WNBA tab)
  async function hub() {
    const d = await load(); if (!d || !d.games || !d.games.length) return _.empty('No Unrivaled schedule yet', '<p style="margin:6px 0 0">It shows here once the league posts it.</p>');
    const t = todayCT(); const nxt = ahead(d); const done = played(d);
    // spotlight: today's night if there is one, else the next; a followed club's game first
    const night = nxt.length ? nxt.filter(g => g.ymd === nxt[0].ymd) : []; const tonight = games(d).filter(g => g.ymd === t);
    const pool = (tonight.length ? tonight : night).filter(two); const mine = favs();
    const spot = pool.find(g => g.teams.some(n => mine.includes(n))) || pool.slice().sort((x, y) => Math.abs((x.p0 ?? .5) - .5) - Math.abs((y.p0 ?? .5) - .5))[0];
    const first = games(d)[0]; const opening = spot && first && spot.ymd === first.ymd;
    const days = Math.round((new Date(spot ? spot.ymd + 'T12:00:00Z' : 0) - new Date(t + 'T12:00:00Z')) / 864e5);
    const kick = spot ? (opening ? 'Opening night' : spot.ymd === t ? 'Tonight' : days === 1 ? 'Tomorrow' : dayLabel(spot.ymd, { weekday: 'long' })) : '';
    const spotH = spot ? `<a class="uspot" href="${hrefG(spot)}">${floor(d, spot, { head: `<span class="uk">${esc(spot.kicker ? spot.name.replace(/ is Unrivaled$/, '') : (spot.city || '').replace(/,.*$/, ''))}</span><span class="ucd">${esc(dayOf(spot))} · ${esc(when(spot))}</span>` })}</a>` : '';
    const rest = (tonight.length ? tonight : night).filter(g => g !== spot);
    const restH = rest.length ? `<div class="ucard ugl">${rest.map(g => gameRow(d, g)).join('')}</div>` : '';
    // the board: eight clubs by power
    const board = [...clubs(d)].sort((a, b) => a.rank - b.rank).map(c => `<a class="utile" href="${hrefC(c)}" style="--cc:${c.color}"><u>${c.rank}</u><em>${Math.round(c.power)}</em>${lgo(c, 42)}<b>${esc(c.name)}</b>${isFav(c.name) ? `<i class="ufv">${ICON.star(true)}</i>` : ''}${rec(d, c.name) ? `<small>${rec(d, c.name)}</small>` : ''}</a>`).join('');
    // standings, once a game is in
    const T = table(d); const st = done.length ? sec('Standings', `${done.length} game${done.length === 1 ? '' : 's'} played`) + `<div class="ucard ust"><div class="usth"><span></span><span>W-L</span><span>GB</span><span>PF</span><span>PA</span><span>Strk</span></div>${T.map((r, i) => `<a class="ustr" href="${hrefC(r.c)}"><span class="n">${i + 1}</span>${lgo(r.c, 24)}<b>${esc(r.c.name)}</b><span>${r.w}-${r.l}</span><span>${r.gb ? r.gb.toFixed(1).replace(/\.0$/, '') : '–'}</span><span>${r.pf}</span><span>${r.pa}</span><span>${r.strk}</span></a>`).join('')}</div>` : '';
    // leaders: this season once games are in, else last season's Unrivaled numbers
    const ppl = people(d); const cur = ppl.some(p => p.a27 && p.a27.gp); const yr = cur ? 'a27' : 'a26'; const minGp = cur ? 1 : 5;
    const lead = (k, lab) => { const xs = ppl.filter(p => p[yr] && p[yr].gp >= minGp && p[yr][k] != null).sort((a, b) => b[yr][k] - a[yr][k]).slice(0, 3); if (!xs.length) return '';
      const c0 = club(d, xs[0].club); return `<div class="uld"><span class="uk2">${lab}</span><a class="ul1" href="${hrefP(xs[0])}">${face(xs[0], c0, 34)}<span class="nm">${esc(last(xs[0]))}<small>${esc(xs[0].club || 'Pool')}</small></span><b>${xs[0][yr][k]}</b></a>${xs.slice(1).map(p => `<a class="o" href="${hrefP(p)}"><span>${esc(last(p))}</span><b>${p[yr][k]}</b></a>`).join('')}</div>`; };
    const lds = [lead('pts', 'Points'), lead('reb', 'Rebounds'), lead('ast', 'Assists'), lead('tpm', '3-pointers')].filter(Boolean).join('');
    // the tour: every stop away from Miami
    const stops = {}; games(d).filter(g => g.kicker).forEach(g => { (stops[g.night] = stops[g.night] || []).push(g); });
    const tour = Object.values(stops).map(gs => { const g = gs[0]; return `<div class="ustop"><div class="h"><span class="dt"><b>${esc(dayLabel(g.ymd, { month: 'short', day: 'numeric' }))}</b>${esc(dayLabel(g.ymd, { weekday: 'short' }))}</span><span><b>${esc(g.name.replace(/ is Unrivaled$/, ''))}</b><small>${esc([g.arena, g.city].filter(Boolean).join(' · '))}</small></span></div>${gs.map(x => gameRow(d, x)).join('')}</div>`; }).join('');
    // the full schedule by month, and results
    const byM = {}; nxt.filter(g => !tonight.includes(g) && !night.includes(g)).forEach(g => { const k = dayLabel(g.ymd, { month: 'long', year: 'numeric' }); (byM[k] = byM[k] || {}); (byM[k][g.ymd + g.night] = byM[k][g.ymd + g.night] || []).push(g); });
    const dayCard = gs => { const g = gs[0]; return `<div class="ucard uday"><div class="h"><b>${esc(dayOf(g))}${g.kicker ? ` · ${esc(g.name.replace(/ is Unrivaled$/, ''))}` : ''}</b><small>${esc([g.arena, g.city].filter(Boolean).join(' · '))}</small></div>${gs.map(x => gameRow(d, x)).join('')}${(g.tv || []).length ? `<div class="utv">${g.tv.map(x => `<em>${esc(x)}</em>`).join('')}</div>` : ''}</div>`; };
    const sched = Object.entries(byM).map(([m, o]) => sec(m, `${Object.keys(o).length} game days`) + Object.values(o).map(dayCard).join('')).join('');
    const resN = {}; done.slice().reverse().forEach(g => { (resN[g.ymd + g.night] = resN[g.ymd + g.night] || []).push(g); });
    const results = done.length ? sec('Results', 'newest first') + Object.values(resN).slice(0, 10).map(dayCard).join('') : '';
    return `<div class="uhub">`
      + (spotH ? sec(kick === 'Opening night' ? 'Opening night' : kick === 'Tonight' ? 'Tonight' : 'Next up', spot && kick !== 'Opening night' && kick !== 'Tonight' ? kick : '') + spotH + restH : '')
      + sec('Clubs', 'ranked by RIVL power') + `<div class="ugrid">${board}</div>`
      + st + (lds ? sec('Leaders', cur ? 'this season' : '2026 season') + `<div class="ulds">${lds}</div>` : '')
      + (tour ? sec('The tour', `${Object.keys(stops).length} stops`) + `<div class="ucard utour">${tour}</div>` : '')
      + sched + results + note + '</div>';
  }

  const top = (title, star) => `<div class="topbar utop"><a class="ib" href="#scores" data-act="back" aria-label="Back">${ICON.back}</a><b class="ut">${esc(title || '')}</b>${star || ''}</div>`;

  // ---------- a club
  async function clubPage(d, slug) {
    const c = club(d, slug); if (!c) return null;
    const ps = [...(c.players || [])].sort((a, b) => b.rating - a.rating); const t3 = ps.slice(0, 3), rest = ps.slice(3);
    const r = rec(d, c.name); const T = table(d).find(x => x.c.name === c.name);
    const mine = games(d).filter(g => g.teams.includes(c.name)); const up = mine.filter(g => !g.final && g.ymd >= todayCT()); const nx = up[0];
    const vsOf = g => club(d, g.teams[0] === c.name ? g.teams[1] : g.teams[0]);
    const pOf = g => g.p0 == null ? null : pct(g.teams[0] === c.name ? g.p0 : 1 - g.p0);
    const hero = `<div class="ufl3" style="--cc:${c.color}">${HALF}<div class="hd">${lgo(c, 54)}<div><h1>${esc(c.name)}</h1><small>${r ? `${r} this season` : `${ps.length} players · season starts ${esc(dayLabel(games(d)[0].ymd, { month: 'short', day: 'numeric' }))}`}</small></div><span class="pw"><b>${Math.round(c.power)}</b><small>Power · ${c.rank}${['', 'st', 'nd', 'rd'][c.rank] || 'th'}</small></span></div>`
      + tok(t3[0], c, 50, 46, 60, [t3[0].pos, t3[0].ht].filter(Boolean).join(' · ')) + (t3[1] ? tok(t3[1], c, 22, 72, 60, [t3[1].pos, t3[1].ht].filter(Boolean).join(' · ')) : '') + (t3[2] ? tok(t3[2], c, 78, 72, 60, [t3[2].pos, t3[2].ht].filter(Boolean).join(' · ')) : '') + '</div>';
    const bench = rest.length ? `<div class="ubnl">Best three on the floor · the rest of the six</div><div class="ubn">${rest.map(p => `<a href="${hrefP(p)}"><em>${p.rating}</em>${face(p, c, 44)}<b>${esc(last(p))}</b><small>${esc([p.pos, p.ht].filter(Boolean).join(' · '))}</small></a>`).join('')}</div>` : '';
    const nxH = nx ? `<a class="ucard unx2" href="${hrefG(nx)}">${lgo(vsOf(nx), 34)}<span>vs ${esc(vsOf(nx) ? vsOf(nx).name : 'TBA')}<small>${esc(dayOf(nx))} · ${esc(nx.city || nx.arena || '')} · ${esc(when(nx))}</small></span>${pOf(nx) != null ? `<span class="wc" style="color:${pOf(nx) >= 50 ? c.color : 'var(--ink-2)'}">${pOf(nx)}%<small>to win</small></span>` : ''}</a>` : '';
    const stats = T && (T.w || T.l) ? `<div class="ucard ust3"><div><b>${(T.pf / (T.w + T.l)).toFixed(1)}</b><small>Points a game</small></div><div><b>${(T.pa / (T.w + T.l)).toFixed(1)}</b><small>Allowed</small></div><div><b>${T.pf - T.pa > 0 ? '+' : ''}${T.pf - T.pa}</b><small>Margin</small></div></div>` : '';
    const sch = mine.map(g => { const o = vsOf(g); const fin = g.final && g.score; const us = fin ? g.score[g.teams[0] === c.name ? 0 : 1] : 0, them = fin ? g.score[g.teams[0] === c.name ? 1 : 0] : 0; const p = pOf(g);
      return `<a class="usr" href="${hrefG(g)}"><span class="d">${esc(dayLabel(g.ymd, { weekday: 'short' }))}<b>${esc(dayLabel(g.ymd, { month: 'short', day: 'numeric' }))}</b></span>${lgo(o, 28)}<span class="m">vs ${esc(o ? o.name : 'TBA')}<small>${esc([g.city, fin ? '' : when(g)].filter(Boolean).join(' · '))}</small></span>${fin ? `<span class="wl ${us > them ? 'w' : 'l'}">${us > them ? 'W' : 'L'} ${us}-${them}</span>` : p != null ? `<span class="wc${p >= 50 ? ' up' : ''}">${p}%</span>` : ''}</a>`; }).join('');
    const star = `<button class="ib ufav${isFav(c.name) ? ' on' : ''}" data-act="unrfav" data-name="${esc(c.name)}" aria-pressed="${isFav(c.name)}" aria-label="Follow ${esc(c.name)}">${ICON.star(isFav(c.name))}</button>`;
    return top('', star) + `<div class="upage">${hero}${bench}${nxH}${stats}${sec('Schedule', 'win chance by RIVL')}<div class="ucard">${sch}</div>${note}</div>`;
  }

  // ---------- a game
  function gamePage(d, id) {
    const g = (d.games || []).find(x => x.id === id); if (!g) return null;
    const a = club(d, g.teams[0]), b = club(d, g.teams[1]);
    if (!a || !b) return top(dayOf(g)) + `<div class="upage">${_.empty('Matchup to be set', '<p style="margin:6px 0 0">The league names the clubs for this game closer to the date.</p>')}</div>`;
    const fin = g.final && g.score;
    const head = `<a class="uth l" href="${hrefC(a)}">${lgo(a, 40)}<span>${esc(a.name)}<small>${fin ? '' : `Power ${Math.round(a.power)}`}${rec(d, a.name) ? `${fin ? '' : ' · '}${rec(d, a.name)}` : ''}</small></span></a><a class="uth r" href="${hrefC(b)}"><span>${esc(b.name)}<small>${fin ? '' : `Power ${Math.round(b.power)}`}${rec(d, b.name) ? `${fin ? '' : ' · '}${rec(d, b.name)}` : ''}</small></span>${lgo(b, 40)}</a><span class="uwh">${esc(dayOf(g))}${fin ? '' : ` · ${esc(when(g))}`} · ${esc(g.arena || '')}</span>`;
    let body = '';
    if (fin) {
      const bx = (d.boxes || {})[g.id] || []; const ppl = people(d);
      const side = c => { const ids = new Set((c.players || []).map(p => p.id)); const rows = bx.filter(l => ids.has(l.id) || (!ppl.find(p => p.id === l.id) ? false : ppl.find(p => p.id === l.id).club === c.name));
        const pick = rows.length ? rows : []; if (!pick.length) return '';
        return `<div class="ucard ubx"><div class="bh">${lgo(c, 22)}<b>${esc(c.name)}</b><span>MIN</span><span>PTS</span><span>REB</span><span>AST</span><span>FG</span></div>${pick.map(l => { const p = ppl.find(x => x.id === l.id) || { name: 'Player', id: l.id }; return `<a class="br" href="${p.club !== undefined ? hrefP(p) : '#'}"><b>${esc(last(p))}${l.st ? '' : '<i>Bench</i>'}</b><span>${Math.round(l.min)}</span><span class="pt">${l.pts}</span><span>${l.reb}</span><span>${l.ast}</span><span>${l.fgm}-${l.fga}</span></a>`; }).join('')}</div>`; };
      body = sec('Box score') + (side(a) + side(b) || '<p class="unote2">The box score lands a few minutes after the final.</p>');
    } else {
      const ta = three(a), tb = three(b); const pos = ['Guard', 'Wing', 'Big'];
      body = sec('Matchups', 'RIVL ratings') + `<div class="ucard umu">${[0, 1, 2].map(i => { const x = ta[i], y = tb[i]; if (!x || !y) return '';
        return `<div class="mur"><a class="s" href="${hrefP(x)}">${face(x, a, 32)}<span class="nm">${esc(last(x))}<small>${esc(x.ht || x.pos || '')}</small></span></a><span class="p"><b class="${x.rating >= y.rating ? '' : 'dim'}">${x.rating}</b><i>${pos[i]}</i><b class="${y.rating >= x.rating ? '' : 'dim'}">${y.rating}</b></span><a class="s r" href="${hrefP(y)}">${face(y, b, 32)}<span class="nm">${esc(last(y))}<small>${esc(y.ht || y.pos || '')}</small></span></a></div>`; }).join('')}</div>`;
    }
    const info = `<div class="ucard uinf"><div>${ICON.pin}<span>${esc(g.arena || 'Arena TBA')}<small>${esc([g.kicker ? g.name : '', g.city].filter(Boolean).join(' · '))}</small></span></div>${(g.tv || []).length ? `<div>${ICON.tv}<span>${esc(g.tv.join(', '))}</span></div>` : ''}</div>`;
    return top(`${a.name} vs ${b.name}`) + `<div class="upage">${floor(d, g, { big: true, head })}${body}${info}${fin ? '' : note}</div>`;
  }

  // ---------- a player
  function playerPage(d, id) {
    const p = person(d, id); if (!p) return null; const c = club(d, p.club);
    const tiles = (a, lab) => a && a.gp ? sec(lab, `${a.gp} game${a.gp === 1 ? '' : 's'}`) + `<div class="ucard utl">${[['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['fg', 'FG%'], ['tpm', '3PM'], ['min', 'MIN']].map(([k, l]) => `<div><b>${a[k] == null ? '–' : a[k]}</b><small>${l}</small></div>`).join('')}</div>` : '';
    const src = { unr: 'Rated from her Unrivaled games', wnba: 'Rated from her 2026 WNBA season', ncaaw: 'Rated from her last college season', none: 'New to the league; rated at the floor until she plays' }[p.src] || '';
    // this season's games from the box scores
    const mine = []; Object.entries(d.boxes || {}).forEach(([gid, bx]) => { const l = bx.find(x => x.id === p.id); const g = (d.games || []).find(x => x.id === gid); if (l && g) mine.push({ g, l }); });
    mine.sort((x, y) => (y.g.at || y.g.ymd).localeCompare(x.g.at || x.g.ymd));
    const log27 = mine.length ? sec('Game log', 'this season') + `<div class="ucard ulog"><div class="lh"><span>Game</span><span>MIN</span><span>PTS</span><span>REB</span><span>AST</span><span>FG</span></div>${mine.map(({ g, l }) => { const o = club(d, g.teams[0] === p.club ? g.teams[1] : g.teams[0]); return `<a class="lr" href="${hrefG(g)}"><span>${esc(dayLabel(g.ymd, { month: 'short', day: 'numeric' }))} ${lgo(o, 18)}</span><span>${Math.round(l.min)}</span><span class="pt">${l.pts}</span><span>${l.reb}</span><span>${l.ast}</span><span>${l.fgm}-${l.fga}</span></a>`; }).join('')}</div>` : '';
    const nm = s => { const x = clubs(d).find(k => k.slug === s); return x ? x.name : s.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()); };
    const log26 = (p.log26 || []).length ? sec('2026 Unrivaled', 'game by game') + `<div class="ucard ulog"><div class="lh"><span>Game</span><span>MIN</span><span>PTS</span><span>REB</span><span>AST</span><span>FG</span></div>${p.log26.map(l => `<div class="lr"><span>${esc(l.d.replace(/, 2026$/, ''))} <i>${esc(nm(l.at))} at ${esc(nm(l.ht))}</i></span><span>${Math.round(l.min)}</span><span class="pt">${l.pts}</span><span>${l.reb}</span><span>${l.ast}</span><span>${esc(l.fg)}</span></div>`).join('')}</div>` : '';
    const w = p.w26 ? sec(p.w26.lg === 'ncaaw' ? `${p.w26.year - 1}-${String(p.w26.year).slice(2)} college` : `${p.w26.year} WNBA`, `${p.w26.gp} games`) + `<div class="ucard utl">${[['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['min', 'MIN']].map(([k, l]) => `<div><b>${p.w26[k]}</b><small>${l}</small></div>`).join('')}</div>` : '';
    const hero = `<div class="uph" style="--cc:${c ? c.color : '#555'}">${HALF}${face(p, c, 108)}<div class="tx"><h1>${esc(p.name)}</h1><small>${esc([p.pos === 'G' ? 'Guard' : p.pos === 'W' ? 'Wing' : p.pos === 'F' ? 'Forward' : p.pos, p.ht].filter(Boolean).join(' · '))}</small>${c ? `<a class="uclub" href="${hrefC(c)}">${lgo(c, 20)}${esc(c.name)}</a>` : ''}</div><span class="rt"><b>${p.rating}</b><small>RIVL rating</small></span></div><p class="usrc">${esc(src)}</p>`;
    const link = p.espn ? `<a class="ucard ulink" href="#player/wnba/${esc(p.espn)}"><span>Her WNBA profile<small>Career, stats and news</small></span>${ICON.chev}</a>` : '';
    return top(p.name) + `<div class="upage">${hero}${link}${tiles(p.a27, 'This season')}${log27}${tiles(p.a26, '2026 Unrivaled')}${w}${log26}</div>`;
  }

  async function screen(kind, id) {
    $main.innerHTML = `<div class="topbar"><a class="ib" href="#scores" data-act="back" aria-label="Back">${ICON.back}</a></div>` + _.skeleton(1, 'card') + _.skeleton(4, 'row');
    const d = await load();
    const html = d ? (kind === 'club' ? await clubPage(d, id) : kind === 'game' ? gamePage(d, id) : playerPage(d, id)) : null;
    $main.innerHTML = html || (top('') + _.empty('Not found', '<p style="margin:6px 0 0">This page may have moved with the new season.</p>', '<a class="btn" href="#scores">Unrivaled</a>'));
    const c = d && kind === 'club' ? club(d, id) : d && kind === 'player' ? club(d, (person(d, id) || {}).club) : null;
    document.title = `${kind === 'club' && c ? c.name : kind === 'player' && d && person(d, id) ? person(d, id).name : 'Unrivaled'} · RIVL`;
    window.scrollTo(0, 0);
  }
  // the Unrivaled view is the WNBA tab's default from January through March, unless chosen otherwise in the last month
  const auto = () => { const m = +todayCT().slice(5, 7); return m >= 1 && m <= 3; };
  const unrOn = () => { const v = store.get('v5:scunr2', null); return v && Date.now() - v.t < 30 * 864e5 ? !!v.on : auto(); };
  const setUnr = on => store.set('v5:scunr2', { on: !!on, t: Date.now() });
  // a followed club's next game, for the Home card
  async function nextMine() { const d = await load(); if (!d) return null; const m = favs(); if (!m.length) return null; const g = ahead(d).find(x => x.teams.some(n => m.includes(n))); return g ? { d, g, row: gameRow(d, g) } : null; }
  V.unr = screen; V.unrHub = hub; V.unrOn = unrOn; V.unrSet = setUnr; V.unrNext = nextMine;
  V.unrFav = name => { const f = favs(); const on = !f.includes(name); store.set('v5:unrfav', on ? [...f, name] : f.filter(x => x !== name)); return on; };
})();
