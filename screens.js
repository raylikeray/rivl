/* RIVL v5 — the rest of the screens: standings, teams, team, game, article reader, search.
   Loaded after views.js; shares its helpers through HW.v5. */
(() => {
  'use strict';
  const { LEAGUES, ORDER, esc, j, jSoft, todayCT, addDays, dayLabel, relDay, tip, tipOf, dateShort, ago, pct, ordinal, sign, hx, store, API, WEB,
    favs, parseEvent, isLive, isDone, finalWord, isFav, interest, scoreboard, standings, rankings, injuries, forecast, forecastCtx, leaguePlayers, watchFor, S, ymdOf } = HW;
  const V = HW.v5;
  const { h: H, logo, headshot, chev, sec, empty, skeleton, href, safeF, gameCard, heroCard, teamInfo, teamsIndex, fplayers, prefs, starSvg, starLine, tvLabel, confName, dayUTC, athId, hsUrl, retInfo, teamColor, playerColor, tcv, learn, statusWord } = V._;
  /* a story's tags: ESPN marks each article with the teams and athletes it is about */
  const cats = a => a && a.categories || [];
  const taggedTeam = (a, id) => cats(a).some(c => c.type === 'team' && String(c.teamId || (c.team && c.team.id) || '') === String(id));
  const $main = document.getElementById('main');
  S.news = S.news || {}; S.videos = S.videos || {};
  const hide = `onerror="this.style.visibility='hidden'"`;
  const hashOf = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const topbar = (title, backHref = '#home', extra = '', card = null, share = true) => `<div class="topbar"><a class="ib" href="${backHref}" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><span class="ttl">${title}</span><div class="sp">${extra}${share === false ? '' : `<button class="ib" data-act="share" data-title="${esc(title.replace(/<[^>]+>/g, ''))}"${card ? ` data-card='${esc(JSON.stringify(card))}'` : ''} aria-label="Share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></button>`}</div></div><div class="lb-slot"></div>`;
  const chips = (items, on, act, key) => `<div class="chips" role="tablist">${items.map(([k, l]) => `<button class="chip${k === on ? ' on' : ''}" role="tab" data-act="${act}" data-${key}="${esc(k)}" aria-selected="${k === on}" aria-pressed="${k === on}">${esc(l)}</button>`).join('')}</div>`;
  const standingLine = (r, L) => !r ? '' : L.standingsMode === 'conferences' ? `${r.w}-${r.l}${r.conf ? `, ${r.conf} in the ${confName(r.group, r.groupAbbr)}` : ''}` : `${r.w}-${r.l}, ${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}`;

  /* news items, shared by every list: cache the object so the reader can open it without a second list fetch */
  function newsRow(lk, a, { thumb = true } = {}) {
    const id = String(a.id || (a.links && a.links.api && a.links.api.news && a.links.api.news.href || '').split('/').pop() || '');
    if (id) S.news[id] = a;
    const vids = (a.video || a.videos || []).filter(v => v && v.links); vids.forEach(v => { if (v.id != null) S.videos[String(v.id)] = v; });
    const ims = (a.images || []).filter(x => x && x.url); const im = (ims.slice().sort((x, y) => (Math.abs((x.width / x.height || 16 / 9) - 16 / 9) - Math.abs((y.width / y.height || 16 / 9) - 16 / 9)) || ((y.width || 0) - (x.width || 0)))[0] || {}).url;   // the one shaped closest to 16:9, the largest of those
    const isVideo = vids.length && (/media|video/i.test(a.type || '') || !a.description);
    const meta = [a.byline, a.published ? ago(a.published) : ''].filter(Boolean).join(', ');
    if (isVideo) return `<button class="row" data-act="play" data-vid="${esc(String(vids[0].id))}">${thumb ? `<span class="thumb vid">${im ? `<img src="${esc(im)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i></i></span>` : ''}<span class="t"><b class="wrap">${esc(a.headline)}</b><span>${esc(meta || 'Video')}</span></span></button>`;
    return `<a class="row" href="${id ? `#article/${lk}/${id}` : esc(a.links && a.links.web && a.links.web.href || '#')}">${thumb && im ? `<img class="thumb" src="${esc(im)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}<span class="t"><b class="wrap">${esc(a.headline)}</b><span>${esc(meta)}</span></span></a>`;
  }
  V.newsRow = newsRow;

  /* ================= STANDINGS ================= */
  async function standingsV(lk) {
    const L = LEAGUES[lk];
    $main.innerHTML = skeleton(10, 'row');
    const [st, R, idx] = await Promise.all([standings(L).catch(() => null), rankings(L), teamsIndex(L).catch(() => ({}))]);
    if (!st || !st.groups.length) { $main.innerHTML = empty('Standings unavailable', '<p style="margin:6px 0 0">The feed didn\'t answer. It usually comes back within a minute.</p>'); return; }
    const conf = L.standingsMode === 'conferences';
    const groups = st.groups;
    let tab = store.get('v5:stab:' + lk, groups[0].abbr || groups[0].name);
    const items = conf ? groups.map(g => [g.abbr || g.name, confName(g.name, g.abbr)]) : [...groups.map(g => [g.abbr || g.name, confName(g.name, g.abbr)]), ['league', 'League']];
    if ((L.playoffLine || []).length) items.push(['picture', 'Picture']);
    // the odds chip: NBA and WNBA, while regular-season games remain (the nightly schedule says; without it the chip stays)
    const sched0 = HW.sim && (lk === 'nba' || lk === 'wnba') ? await HW.sim.schedule(L, { feed: false }).catch(() => null) : null;
    const simOk = HW.sim && (L.playoffLine || []).length && (lk === 'nba' || lk === 'wnba') && (!sched0 || sched0.games.some(g => g.t === 2 && !g.x && g.st !== 'post'));
    if (simOk) items.push(['odds', 'Odds']);
    const TS = await HW.teamStats(L).catch(() => null);
    if (TS) items.push(['stats', 'Stats']);
    // the NBA Cup, while it's on: from the week before group play to a couple of days after the final
    const cupGames = lk === 'nba' && sched0 ? sched0.games.filter(g => g.cup) : [];
    const cupOn = cupGames.length && todayCT() >= addDays(cupGames.map(g => g.d).sort()[0], -7) && todayCT() <= addDays(cupGames.map(g => g.d).sort().pop(), 2);
    if (cupOn) items.push(['cup', 'Cup']);
    if (!items.some(([k]) => k === tab)) tab = items[0][0];
    if (tab === 'odds') { await oddsTab(L, items, tab, st); return; }
    if (tab === 'stats') { statsTab(L, items, tab, st, TS); return; }
    if (tab === 'cup') { cupTab(L, items, tab, st, cupGames, idx); return; }
    if (tab === 'picture') {
      // the bracket as the table stands today: play-in pairs, then the first round, per conference
      const cut = L.playoffLine; const playIn = cut.length === 2;
      const tm = (r, seed, fr, sd) => r ? `<a class="bt ${sd}${favs.has(lk, r.id) ? ' me' : ''}" href="${href.team(lk, r.id)}" style="${tcv(teamColor({ id: r.id, abbr: r.abbr }, L))}"><i>${seed}</i>${logo(r.logo, 's', teamColor({ id: r.id, abbr: r.abbr }, L))}<span class="tx"><b>${esc(r.short || r.name)}</b><span>${r.w}-${r.l}</span></span></a>` : `<span class="bt tbd ${sd}"><i>${seed}</i><span class="tx"><b>${fr && playIn && seed > cut[0] ? 'Play-in winner' : 'TBD'}</b></span></span>`;
      const mu = (a, sa, b, sb, note, fr) => `<div class="mu${favs.has(lk, (a || {}).id) || favs.has(lk, (b || {}).id) ? ' me' : ''}">${tm(a, sa, fr, 'l')}<em>vs</em>${tm(b, sb, fr, 'r')}${note ? `<small>${note}</small>` : ''}</div>`;
      const block = g => {
        const r = g.rows; const top = cut[0];
        const first = top === 6 || top === 8 ? [[1, 8], [4, 5], [3, 6], [2, 7]] : [[1, top], [2, top - 1], [3, top - 2], [4, top - 3]];
        const seedOf = n => n <= top ? r[n - 1] : null;
        const fr = first.map(([x, y]) => mu(seedOf(x), x, seedOf(y), y, '', true));
        const pi = playIn ? [mu(r[6], 7, r[7], 8, 'winner is the 7 seed'), mu(r[8], 9, r[9], 10, 'winner plays the 7–8 loser for the 8 seed')] : [];
        return (conf || groups.length > 1 ? sec(confName(g.name, g.abbr)) : '') + (pi.length ? `<h3 class="bh">Play-in</h3><div class="bracket">${pi.join('')}</div>` : '') + `<h3 class="bh">First round</h3><div class="bracket">${fr.join('')}</div>`;
      };
      const legend = `<p class="legend">If the season ended today. ${playIn ? `Seeds 1–${cut[0]} are in; ${cut[0] + 1} through ${cut[1]} play in for the last two spots.` : `The top ${cut[0]} make the playoffs.`} Your teams are marked.</p>`;
      stPaint(items, tab, (conf || groups.length > 1 ? groups.map(block).join('') : block({ rows: groups.flatMap(g => g.rows).sort((a, b) => (b.w - b.l) - (a.w - a.l) || (b.pct || 0) - (a.pct || 0) || (b.diff || 0) - (a.diff || 0)), name: L.label })) + legend);
      return;
    }
    let rows, title;
    if (tab === 'league') { rows = groups.flatMap(g => g.rows).sort((a, b) => (b.w - b.l) - (a.w - a.l) || (b.pct || 0) - (a.pct || 0) || (b.diff || 0) - (a.diff || 0)).map((r, i) => ({ ...r, pos: i + 1 })); title = L.label; }
    else { const g = groups.find(x => (x.abbr || x.name) === tab); rows = g.rows; title = g.name; }
    const cuts = tab === 'league' ? [] : (L.playoffLine || []);
    const rk = R ? Object.fromEntries(R.ranks.map(r => [r.team.id, r.rank])) : null;
    const cols = conf ? ['Conf', 'W', 'L', 'Diff', 'Strk'] : ['W', 'L', 'Pct', 'GB', 'Diff', 'L10', 'Strk'];
    const cell = (r, c) => c === 'W' ? r.w : c === 'L' ? r.l : c === 'Pct' ? esc(r.pct || '') : c === 'GB' ? esc(r.gb === '0' || !r.gb ? '–' : r.gb) : c === 'Conf' ? esc(r.conf || '') : c === 'Diff' ? (r.diff == null ? '–' : `<span class="${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${sign(+r.diff)}</span>`) : c === 'L10' ? esc(r.l10 || '–') : `<span class="res ${/^W/.test(r.strk || '') ? 'w' : 'l'}">${esc(r.strk || '')}</span>`;
    // the playoff picture: games back of the last guaranteed spot and of the play-in, and ESPN's clinch marks
    const CL = { x: 'Clinched playoffs', y: 'Clinched division', z: 'Clinched conference', w: 'Clinched home court', p: 'Clinched play-in', e: 'Eliminated', o: 'Eliminated' };
    const back = (r, ref) => ref ? ((ref.w - ref.l) - (r.w - r.l)) / 2 : null;
    const fmtGb = n => n % 1 ? n.toFixed(1) : String(n);
    const gbLine = (r, i) => { if (tab === 'league' || cuts.length < 1) return ''; const c1 = cuts[0], c2 = cuts[1]; if (c2 && i >= c2) { const b = back(r, rows[c2 - 1]); return b != null && b > 0 ? `${fmtGb(b)} back of the play-in` : b === 0 ? 'Tied for the last play-in spot' : ''; } if (i >= c1) { const b = back(r, rows[c1 - 1]); return b != null && b > 0 ? `${fmtGb(b)} back of the ${c1} seed` : b === 0 ? `Tied for the ${c1} seed` : ''; } return ''; };
    const clinchTag = r => { const k = String(r.clinch || '').toLowerCase(); if (!k) return ''; const t = CL[k] || CL[k[0]] || r.clinch; const bad = /elim|^e|^o/.test(k); return `<span class="tag ${bad ? 'out' : 'ok'} cl" title="${esc(t)}">${esc(bad ? 'Out' : 'Clinched')}</span>`; };
    // ties at a cut line: who holds the head-to-head, from the season's results when the nightly schedule has them
    const sched = sched0;
    const h2hNote = (r, o) => { if (!sched) return ''; const h = HW.sim.h2hOf(sched, r.id, o.id); if (!h || !h.played) return ''; return h.wa > h.wb ? `${esc(r.abbr)} holds the tiebreak ${h.wa}-${h.wb}` : h.wa < h.wb ? `${esc(o.abbr)} holds the tiebreak ${h.wb}-${h.wa}` : `${h.wa}-${h.wb} head-to-head`; };
    const tieNote = (r, i) => { if (tab === 'league') return ''; const same = x => x && x.w === r.w && x.l === r.l; for (const c of cuts) { if (i === c - 1 && same(rows[c])) return [c === cuts[0] ? `tied for the ${c} seed` : 'tied for the last play-in spot', h2hNote(r, rows[c])].filter(Boolean).join(', '); if (i === c && same(rows[c - 1])) return h2hNote(r, rows[c - 1]); } return ''; };
    const trs = rows.map((r, i) => { const gl = [gbLine(r, i), tieNote(r, i)].filter(Boolean).join(' · '); return `<tr class="click${favs.has(lk, r.id) ? ' me' : ''}${cuts.includes(i + 1) ? ' cut' : ''}" data-href="${href.team(lk, r.id)}"><td><span class="tm"><span class="rk">${r.pos}</span>${logo(r.logo, 's', teamColor({ id: r.id, abbr: r.abbr }, L))}<span class="nm"><a href="${href.team(lk, r.id)}">${rk && rk[r.id] ? `<i class="ap">${rk[r.id]}</i>` : ''}${esc(r.short || r.name)}</a>${clinchTag(r)}${gl ? `<small>${esc(gl)}</small>` : ''}</span></span></td>${cols.map(c => `<td>${cell(r, c)}</td>`).join('')}</tr>`; }).join('');
    const legend = tab === 'league' ? '' : cuts.length === 2 ? `<p class="legend">Top ${cuts[0]} go straight to the playoffs; ${cuts[0] + 1} through ${cuts[1]} play in. Games back count the ${cuts[0]} seed and the last play-in spot. Your teams are marked.</p>` : cuts.length === 1 ? `<p class="legend">Top ${cuts[0]} make the playoffs. Your teams are marked.</p>` : '<p class="legend">Your teams are marked.</p>';
    stPaint(items, tab, `<div class="tw"><table class="tbl stand"><thead><tr><th>${esc(title)}</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table></div>` + legend);
  }
  /* the NBA Cup: group standings built from the group-play results in the nightly schedule, then the knockout games.
     The groups are the NBA's own draw for 2026 (nba.com, July 2026); the schedule's group games are checked against it. */
  const CUP_2026 = { season: '2026-10-20', groups: [['East Group A', ['DET', 'TOR', 'ORL', 'MIL', 'BKN']], ['East Group B', ['NY', 'CLE', 'PHI', 'MIA', 'IND']], ['East Group C', ['BOS', 'ATL', 'CHA', 'CHI', 'WSH']], ['West Group A', ['DEN', 'HOU', 'PHX', 'DAL', 'UTAH']], ['West Group B', ['OKC', 'MIN', 'LAC', 'NO', 'MEM']], ['West Group C', ['SA', 'LAL', 'POR', 'GS', 'SAC']]] };
  function cupTab(L, items, tab, st, cupGames, idx = {}) {
    const lk = L.key; const rows = st.groups.flatMap(g => g.rows).concat(Object.values(idx).filter(t => t.abbr && !st.groups.some(g => g.rows.some(r => r.id === String(t.id)))).map(t => ({ id: String(t.id), abbr: t.abbr, short: t.short || t.name, name: t.name, logo: t.logo })));
    const byAbbr = {}; rows.forEach(r => { byAbbr[String(r.abbr).toUpperCase()] = r; });
    const abbrOf = id => { const r = rows.find(x => x.id === id); return r ? String(r.abbr).toUpperCase() : ''; };
    const play = cupGames.filter(g => /group/i.test(g.cup)); const done = play.filter(g => g.st === 'post' && g.hs != null && g.as != null);
    // the draw, checked against the schedule: a group game between teams the draw puts in different groups means the draw is wrong for this season
    const groupOf = {}; CUP_2026.groups.forEach(([name, abbrs]) => abbrs.forEach(a => groupOf[a] = name));
    const mismatch = L.seasonStart !== CUP_2026.season || play.some(g => { const h = abbrOf(g.h), a = abbrOf(g.a); return h && a && groupOf[h] && groupOf[a] && groupOf[h] !== groupOf[a]; });
    if (mismatch) { stPaint(items, tab, empty('Cup groups not on file', '<p style="margin:6px 0 0">The schedule\'s group games don\'t match the draw this app knows. Nothing is shown rather than the wrong groups.</p>')); return; }
    const rec = {}; const get = a => rec[a] || (rec[a] = { w: 0, l: 0, pf: 0, pa: 0, beat: new Set() });
    done.forEach(g => { const h = abbrOf(g.h), a = abbrOf(g.a); if (!h || !a) return; const H = get(h), A = get(a); H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs; if (g.hs > g.as) { H.w++; A.l++; H.beat.add(a); } else { A.w++; H.l++; A.beat.add(h); } });
    const nextOf = a => { const r = byAbbr[a]; if (!r) return ''; const g = play.filter(x => !(x.st === 'post' && x.hs != null) && (x.h === r.id || x.a === r.id)).sort((x, y) => x.d.localeCompare(y.d))[0]; if (!g) return ''; const home = g.h === r.id; return `${dayLabel(g.d, { month: 'short', day: 'numeric' })} ${home ? 'vs' : 'at'} ${abbrOf(home ? g.a : g.h)}`; };
    const cmp = (x, y) => { const X = get(x), Y = get(y); return (Y.w - Y.l) - (X.w - X.l) || (X.beat.has(y) ? -1 : Y.beat.has(x) ? 1 : 0) || (Y.pf - Y.pa) - (X.pf - X.pa) || Y.pf - X.pf || x.localeCompare(y); };
    const sg = n => n > 0 ? `+${n}` : String(n);
    const table = ([name, abbrs]) => { const order = abbrs.slice().sort(cmp); return sec(name) + `<div class="tw"><table class="tbl stand cup"><thead><tr><th>${esc(name.split(' ')[0])}</th><th>W-L</th><th>Diff</th><th>PF</th></tr></thead><tbody>${order.map((a, i) => { const r = byAbbr[a]; const R = get(a); const nx = nextOf(a); return `<tr class="click${r && favs.has(lk, r.id) ? ' me' : ''}${i === 0 ? ' cut' : ''}"${r ? ` data-href="${href.team(lk, r.id)}"` : ''}><td><span class="tm"><span class="rk">${i + 1}</span>${r ? logo(r.logo, 's', teamColor({ id: r.id, abbr: r.abbr }, L)) : ''}<span class="nm">${r ? `<a href="${href.team(lk, r.id)}">${esc(r.short || r.name)}</a>` : esc(a)}${nx ? `<small>${esc(nx)}</small>` : ''}</span></span></td><td>${R.w}-${R.l}</td><td><span class="${R.pf - R.pa > 0 ? 'pos' : R.pf - R.pa < 0 ? 'neg' : ''}">${R.w + R.l ? sg(R.pf - R.pa) : '–'}</span></td><td>${R.pf || '–'}</td></tr>`; }).join('')}</tbody></table></div>`; };
    // the wild card: the best second-place team in each conference, by the same order
    const wild = ['East', 'West'].map(conf => { const seconds = CUP_2026.groups.filter(([n]) => n.startsWith(conf)).map(([, abbrs]) => abbrs.slice().sort(cmp)[1]); const best = seconds.sort(cmp)[0]; const r = byAbbr[best]; return best && done.length ? `<p class="legend">${conf} wild card as it stands: ${r ? esc(r.short || r.name) : esc(best)} (${get(best).w}-${get(best).l}, ${sg(get(best).pf - get(best).pa)}).</p>` : ''; }).join('');
    const ko = cupGames.filter(g => !/group/i.test(g.cup)).sort((x, y) => x.d.localeCompare(y.d));
    const koHtml = ko.length ? sec('Knockout rounds') + `<div class="rows">${ko.map(g => { const h = rows.find(x => x.id === g.h), a = rows.find(x => x.id === g.a); const label = g.cup.replace(/^NBA Cup[ -]*/i, '').replace(/^- /, ''); const who = h && a ? `${esc(a.short)} at ${esc(h.short)}` : 'Teams to be decided'; const res = g.st === 'post' && g.hs != null ? `${esc(a.abbr)} ${g.as}, ${esc(h.abbr)} ${g.hs}` : dayLabel(g.d, { weekday: 'short', month: 'short', day: 'numeric' }); return h && a ? `<a class="row" href="${href.game(lk, g.id)}"><span class="t"><b>${who}</b><span>${esc(label)} · ${res}</span></span>${chev}</a>` : `<div class="row"><span class="t"><b>${esc(label)}</b><span>${who} · ${esc(res)}</span></span></div>`; }).join('')}</div>` : '';
    const legend = `<p class="legend">Group play: ${play.length ? `${done.length} of ${play.length} games played` : 'not started'}. Each group's winner and the best second-place team in each conference go to the knockout rounds. Ties break on head-to-head, then point differential in group play, then points scored; the NBA's later tiebreaks aren't applied here.</p>`;
    stPaint(items, tab, CUP_2026.groups.map(table).join('') + wild + koHtml + legend);
  }
  /* every team's ratings and four factors, one league table, best net rating first */
  function statsTab(L, items, tab, st, TS) {
    const lk = L.key; const rows = st.groups.flatMap(g => g.rows).map(r => ({ r, t: TS.teams[r.id] })).filter(x => x.t).sort((a, b) => (b.t.net ?? -99) - (a.t.net ?? -99));
    const f1 = v => v == null ? '—' : (+v).toFixed(1); const sg1 = v => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1); const pc = v => v == null ? '—' : (v * 100).toFixed(1);
    const cols = [['Off', t => f1(t.ortg)], ['Def', t => f1(t.drtg)], ['Net', t => `<span class="${t.net > 0 ? 'pos' : t.net < 0 ? 'neg' : ''}">${sg1(t.net)}</span>`], ['Pace', t => f1(t.pace)], ['eFG%', t => pc(t.efg)], ['TOV%', t => pc(t.tovr)], ['ORB%', t => pc(t.orbr)], ['FTr', t => pc(t.ftr)]];
    const table = `<div class="tw"><table class="tbl stand odds tstat"><thead><tr><th>${esc(L.label)}</th>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(({ r, t }, i) => `<tr class="click${favs.has(lk, r.id) ? ' me' : ''}" data-href="${href.team(lk, r.id)}"><td><span class="tm"><span class="rk">${i + 1}</span>${logo(r.logo, 's', teamColor({ id: r.id, abbr: r.abbr }, L))}<span class="nm"><a href="${href.team(lk, r.id)}">${esc(r.short || r.name)}</a><small>${r.w}-${r.l}</small></span></span></td>${cols.map(([, f]) => `<td>${f(t)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const legend = `<p class="legend">Off and Def: points scored and allowed per 100 possessions; Net is the gap. Pace: possessions per game. eFG% counts a three as one and a half makes; TOV% is turnovers per possession; ORB% the share of their own misses they rebound; FTr free throws attempted per shot. From each team's season totals, updated nightly.</p>`;
    stPaint(items, tab, table + legend);
  }
  /* the odds: the rest of the season played out from today's ratings, per conference */
  async function oddsTab(L, items, tab, st) {
    const lk = L.key; const conf = L.standingsMode === 'conference'; const cut = L.playoffLine || []; const playIn = cut.length === 2;
    // today's simulation runs once and is kept; until it has, a note counts the work up (the schedule read, then the runs)
    if (!HW.sim.have(L)) stPaint(items, tab, `<div class="simwait"><div class="skel row"></div><p class="legend" id="simnote">${HW.sim.ready(L) ? 'Playing out the season…' : 'Reading the rest of the schedule…'}</p></div>`);
    const note = document.getElementById('simnote');
    const v = await HW.sim.season(L, { onProgress: (f, stage) => { if (note) note.textContent = `${stage === 'sim' ? 'Playing out the season' : 'Reading the rest of the schedule'}… ${Math.round(f * 100)}%`; } }).catch(() => null);
    if ((V.route() || {}).name !== 'standings' || store.get('v5:stab:' + lk) !== 'odds') return;   // they moved on while it loaded
    if (!v) { stPaint(items, tab, empty('No odds yet', '<p style="margin:6px 0 0">The season schedule couldn\'t be read. Try again in a moment.</p>')); return; }
    const { sim, rest, sched } = v;
    const pc = p => p >= .995 ? '>99%' : p < .005 ? (p > 0 ? '<1%' : '—') : `${Math.round(p * 100)}%`;
    const cls = p => p >= .995 ? 'sure' : p < .005 ? 'none' : p >= .5 ? 'likely' : '';
    const groups = conf ? st.groups : [{ name: L.label, abbr: L.short, rows: st.groups.flatMap(g => g.rows) }];
    const cols = playIn ? [['Proj.', 'proj'], ['Playoffs', 'playoffs'], ['Top ' + cut[0], 'top'], ['Play-in', 'playin'], ['Left', 'left']] : [['Proj.', 'proj'], ['Playoffs', 'playoffs'], ['No. 1', 'first'], ['Left', 'left']];
    const cell = (t, r, k) => { if (k === 'proj') return `<b>${Math.round(t.w)}-${Math.round(t.l)}</b>`; if (k === 'left') { const o = rest[r.id]; if (!o || !o.n) return '<span class="mut">—</span>'; return `<span class="${o.opp > 1 ? 'hard' : o.opp < -1 ? 'easy' : ''}">${o.n}<small>${o.opp > 0 ? '+' : o.opp < 0 ? '−' : ''}${Math.abs(o.opp).toFixed(1)}</small></span>`; } return `<span class="od ${cls(t[k])}">${pc(t[k])}</span>`; };
    const table = g => { const rows = g.rows.map(r => ({ r, t: v.byId[r.id] })).filter(x => x.t).sort((a, b) => b.t.playoffs - a.t.playoffs || b.t.top - a.t.top || b.t.w - a.t.w); return (conf ? sec(confName(g.name, g.abbr)) : '') + `<div class="tw"><table class="tbl stand odds"><thead><tr><th>${esc(conf ? '' : L.label)}</th>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(({ r, t }, i) => `<tr class="click${favs.has(lk, r.id) ? ' me' : ''}${cut.includes(i + 1) ? ' cut' : ''}" data-href="${href.team(lk, r.id)}"><td><span class="tm"><span class="rk">${i + 1}</span>${logo(r.logo, 's', teamColor({ id: r.id, abbr: r.abbr }, L))}<span class="nm"><a href="${href.team(lk, r.id)}">${esc(r.short || r.name)}</a><small>${r.w}-${r.l} now</small></span></span></td>${cols.map(([, k]) => `<td>${cell(t, r, k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; };
    const legend = `<p class="legend">The rest of the season played out ${sim.n.toLocaleString()} times from today's ratings — each run with every team's rating given a few points of give, more this early in the season — with the finished games as they stand${sim.known ? ' and ties going to the head-to-head record' : ''}.${(sim.teams[0] || {}).scheduled < (sim.teams[0] || {}).games ? ` Records are projected to ${sim.teams[0].games} games; the schedule doesn't carry every date yet.` : ''} ${playIn ? `Playoffs counts a top-${cut[0]} finish or coming through the play-in.` : `The top ${cut[0]} make the playoffs.`} Left: games to play, and how strong the opponents are — points better than an average team, with home court counted; above +1 is a hard run, below −1 an easy one.${sched.source === 'feed' ? ' The schedule was read from the feed today; the nightly copy wasn\'t available.' : ''}</p>`;
    stPaint(items, tab, groups.map(table).join('') + legend);
  }
  /* standings: the chips stay put and only toggle; the table below them swaps */
  function stPaint(items, tab, body) {
    const page = $main.querySelector('#stpage');
    if (page && page.dataset.lk === (V.route && V.route() || {}).lk) {
      const have = [...page.querySelectorAll('#stchips .chip')].map(c => c.dataset.tab).join();
      if (have !== items.map(([k]) => k).join()) page.querySelector('#stchips').innerHTML = chips(items, tab, 'stab', 'tab');
      else page.querySelectorAll('#stchips .chip').forEach(c => { const on = c.dataset.tab === tab; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); c.setAttribute('aria-selected', String(on)); });
      const sb = page.querySelector('#stbody'); sb.innerHTML = body; if (V.soft) V.soft(sb);
    } else $main.innerHTML = `<div id="stpage" data-lk="${esc((V.route && V.route() || {}).lk || '')}"><div id="stchips">${chips(items, tab, 'stab', 'tab')}</div><div id="stbody">${body}</div></div>`;
    const on = $main.querySelector('#stchips .chip.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /* ================= TEAMS ================= */
  async function teamsV(lk) {
    const L = LEAGUES[lk];
    $main.innerHTML = skeleton(10, 'row');
    const [st, idx] = await Promise.all([standings(L).catch(() => null), teamsIndex(L)]);
    const q0 = store.get('v5:tq', '') || '', tab0 = store.get('v5:ttab', 'all');
    const groups = st && st.groups.length ? st.groups.map(g => ({ name: confName(g.name, g.abbr), full: g.name, rows: g.rows.map(r => ({ ...r, logo: r.logo || (idx[r.id] || {}).logo })) })) : [{ name: L.label, full: L.label, rows: Object.values(idx).map(t => ({ id: t.id, short: t.short, name: t.name, logo: t.logo })) }];
    // today's game for each team, from the slate already in hand: on now, the result, or the tip
    const byTeam = new Map(); (S.today[lk] || []).forEach(g => { byTeam.set(g.home.id, g); byTeam.set(g.away.id, g); });
    const todayLine = (g, r) => { const home = g.home.id === String(r.id); const us = home ? g.home : g.away, them = home ? g.away : g.home; const vs = `${g.neutral ? 'vs' : home ? 'vs' : 'at'} ${esc(them.abbr || them.short)}`; if (g.off) return `${esc(g.off)} ${vs}`; if (g.state === 'in') return `<i class="dot"></i>${us.score}–${them.score} ${vs}, ${esc(g.detail)}`; if (g.state === 'post') return `${us.score > them.score ? 'W' : 'L'} ${us.score}–${them.score} ${vs}`; return `${esc(tipOf(g))} ${vs}`; };
    let ordering = false;
    const paint = () => {
      const q = (store.get('v5:tq', '') || '').trim().toLowerCase(), tab = store.get('v5:ttab', 'all');
      if (tab === 'following' && !q) {   // your teams in your own order, with a way to change it
        const all = groups.flatMap(g => g.rows); const mine = (favs.all()[lk] || []).map(id => all.find(r => String(r.id) === String(id))).filter(Boolean);
        const el = $main.querySelector('#tlist'); if (!el) return;
        if (!mine.length) { el.innerHTML = empty('No followed teams yet', '<p style="margin:6px 0 0">Tap the star on any team to follow it.</p>'); return; }
        el.innerHTML = sec('Following', `${mine.length}`, mine.length > 1 ? `<button data-act="torder" aria-pressed="${ordering}">${ordering ? 'Done' : 'Reorder'}</button>` : '') + `<div class="rows${ordering ? ' ordering' : ''}" data-order="teams">${mine.map(r => { const g = byTeam.get(String(r.id)); const today = g ? todayLine(g, r) : ''; const body = `<span class="t"><b>${esc(r.name || r.short)}</b><span>${esc(standingLine(r, L) || '')}${today ? `<em class="today">${today}</em>` : ''}</span></span>`; return ordering ? `<div class="row prow ordrow" data-oid="${esc(r.id)}"><span class="go">${logo(r.logo, '', teamColor({ id: r.id, abbr: r.abbr }, L))}</span>${body}${V._.orderTools}</div>` : `<div class="row prow${g && g.state === 'in' ? ' now' : ''}"><a class="go" href="${href.team(lk, r.id)}" aria-label="${esc(r.name)}">${logo(r.logo, '', teamColor({ id: r.id, abbr: r.abbr }, L))}</a><a class="t" href="${href.team(lk, r.id)}">${body.replace(/^<span class="t">|<\/span>$/g, '')}</a><button class="star on" data-act="fav" data-lk="${lk}" data-id="${esc(r.id)}" aria-pressed="true" aria-label="Unfollow ${esc(r.name)}">${starSvg}</button></div>`; }).join('')}</div>`;
        const ol = el.querySelector('[data-order="teams"].ordering'); if (ol) V._.dragOrder(ol, ids => favs.reorder(lk, ids));
        return;
      }
      const blocks = groups.map(g => {
        let rows = g.rows.slice().sort((a, b) => (a.name || a.short).localeCompare(b.name || b.short));
        if (tab === 'following') rows = rows.filter(r => favs.has(lk, r.id));
        if (q) rows = rows.filter(r => `${r.name} ${r.short} ${r.abbr || ''}`.toLowerCase().includes(q));
        if (!rows.length) return '';
        // a conference is a head you can fold, like a roster or an injury list; a search opens everything
        const folded = !q && !!(store.get('v5:tcol:' + lk, {}) || {})[g.full];
        return `<button class="thead conf" data-act="tfold" data-key="${esc(g.full)}" aria-expanded="${!folded}"><i class="bar"></i><b>${esc(g.name)}</b><span class="n">${rows.length}</span>${chev}</button><div class="fold${folded ? ' closed' : ''}"><div class="rows">${rows.map(r => { const on = favs.has(lk, r.id); const g = byTeam.get(String(r.id)); const today = g ? todayLine(g, r) : ''; return `<div class="row prow${g && g.state === 'in' ? ' now' : ''}"><a class="go" href="${href.team(lk, r.id)}" aria-label="${esc(r.name)}">${logo(r.logo, '', teamColor({ id: r.id, abbr: r.abbr }, L))}</a><a class="t" href="${href.team(lk, r.id)}"><b>${esc(r.name || r.short)}</b><span>${esc(standingLine(r, L) || '')}${today ? `<em class="today">${today}</em>` : ''}</span></a><button class="star${on ? ' on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(r.name)}">${on ? starSvg : starLine}</button></div>`; }).join('')}</div></div>`;
      }).filter(Boolean).join('');
      const el = $main.querySelector('#tlist'); if (el) el.innerHTML = blocks || empty(tab === 'following' ? 'No followed teams yet' : 'No team matches', tab === 'following' ? '<p style="margin:6px 0 0">Tap the star on any team to follow it.</p>' : '');
    };
    $main.innerHTML = `<div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="tq" type="search" placeholder="Search teams" value="${esc(q0)}" autocomplete="off" aria-label="Search teams"></div>` + chips([['all', 'All'], ['following', 'Following']], tab0, 'ttab', 'tab') + `<div id="tlist"></div>`;
    paint();
    const inp = $main.querySelector('#tq'); let t = null;
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { store.set('v5:tq', inp.value); paint(); }, 120); });
    $main.addEventListener('click', e => { const b = e.target.closest('[data-act="ttab"]'); if (!b) return; store.set('v5:ttab', b.dataset.tab); $main.querySelectorAll('[data-act="ttab"]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); paint(); });
    $main.addEventListener('rivl:fav', paint);
    $main.addEventListener('click', e => { const b = e.target.closest('[data-act="torder"]'); if (!b) return; e.preventDefault(); ordering = !ordering; paint(); });
    $main.addEventListener('click', e => { const b = e.target.closest('[data-act="tfold"]'); if (!b) return; e.preventDefault(); const f = store.get('v5:tcol:' + lk, {}) || {}; const k = b.dataset.key; if (f[k]) delete f[k]; else f[k] = 1; store.set('v5:tcol:' + lk, f); V._.foldToggle(b, !f[k]); });
    const onPoll = () => { if (!$main.querySelector('#tlist')) { document.removeEventListener('rivl:polled', onPoll); return; } byTeam.clear(); (S.today[lk] || []).forEach(g => { byTeam.set(g.home.id, g); byTeam.set(g.away.id, g); }); if ((S.today[lk] || []).some(isLive)) paint(); };
    document.addEventListener('rivl:polled', onPoll);
  }

  /* ================= TEAM ================= */
  async function teamV(lk, id) {
    const L = LEAGUES[lk]; if (!L || !id) { $main.innerHTML = empty('Team not found'); return; }
    $main.innerHTML = topbar('') + skeleton(1, 'card') + skeleton(6, 'row');
    const [roster, sched, st, inj, lp, news, R] = await Promise.all([jSoft(`${API(L)}/teams/${id}/roster`, 900000), jSoft(`${API(L)}/teams/${id}/schedule`, 300000), standings(L).catch(() => null), injuries(L), L.sport === 'basketball' ? leaguePlayers(L).catch(() => null) : null, jSoft(`${API(L)}/news?limit=10&team=${id}`, 600000), rankings(L), teamsIndex(L).catch(() => null)]);
    const t0 = (roster && roster.team) || (sched && sched.team);
    if (!t0) { $main.innerHTML = topbar('Team') + empty("Couldn't load this team", '<p style="margin:6px 0 0">The feed didn\'t answer. Pull down to try again.</p>'); return; }
    learn(L, { id: String(id), ...t0 }); const color = teamColor({ id: String(id), abbr: t0.abbreviation, color: t0.color }, L); V._.tint(color);
    const lg = t0.logo || (t0.logos && t0.logos[0] && t0.logos[0].href) || HW.logoUrl(L, t0.abbreviation);
    const r = st && st.byId[String(id)];
    const rank = R && (R.ranks.find(x => x.team.id === String(id)) || {}).rank;
    const on = favs.has(lk, id);
    const evs = (sched && sched.events || []).map(e => { try { return parseEvent(e, L); } catch { return null; } }).filter(Boolean);
    let next = evs.find(g => g.state !== 'post');
    /* the schedule feed carries no score while a game is on; the day's scoreboard does, with the records and the leaders, so a live
       game is taken from there — and the card is repainted on each poll while it plays */
    const liveOf = async (g, ttl) => { if (!g || g.state !== 'in') return g; const day = await scoreboard(L, ymdOf(g.date), ttl).catch(() => null); const sb = (day || []).find(x => x.id === g.id); return sb || g; };
    next = await liveOf(next);
    const ctx = next ? await forecastCtx(L, ymdOf(next.date)).catch(() => null) : null;
    const facts = [r ? `${r.w}-${r.l}` : (t0.recordSummary || ''), rank ? `Ranked No. ${rank}` : '', r && L.standingsMode !== 'conferences' ? `${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}` : (t0.standingSummary || ''), r && r.strk ? (/^W/.test(r.strk) ? `Won ${r.strk.slice(1)} straight` : `Lost ${r.strk.slice(1)} straight`) : ''].filter(Boolean);
    const hero = `<div class="ehero team" style="--a:${esc(color)}"><div class="wm">${esc(t0.abbreviation || '')}</div>${V._.imgSized(lg, 256, 256, 'class="biglogo"')}
      <div class="in"><div class="sub">${esc(r && r.group && L.standingsMode === 'conferences' ? r.group : (t0.standingSummary && /Division/.test(t0.standingSummary) ? '' : L.label))}</div><h1 class="${(() => { const w = Math.max(...`${t0.location || ''} ${t0.name || t0.displayName || ''}`.split(/\s+/).map(x => x.length)); return w > 10 ? 'xlong' : w > 7 ? 'long' : ''; })()}">${esc(t0.location || '')}<br>${esc(t0.name || t0.displayName)}</h1>
        <div class="facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</div>
        <div class="acts"><button class="${on ? 'on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(id)}" data-name="${esc(t0.shortDisplayName || t0.name)}" aria-pressed="${on}">${on ? starSvg : starLine}${on ? 'Following' : 'Follow'}</button></div>
      </div></div>`;
    // four tiles: scoring, allowed, net, and whichever split the standings carry (conference record, last ten, home, road, streak)
    const fourth = L.standingsMode === 'conferences' ? [['CONF', r && r.conf]] : [['LAST 10', r && r.l10], ['HOME', r && r.home], ['ROAD', r && r.road], ['STREAK', r && r.strk]];
    const tile4 = fourth.find(([, v]) => v) || null;
    const tiles = r ? [[r.ppg != null ? (+r.ppg).toFixed(1) : null, 'PPG'], [r.opp != null ? (+r.opp).toFixed(1) : null, 'OPP'], [r.diff != null ? sign(+r.diff) : null, 'NET'], tile4 ? [tile4[1], tile4[0]] : null].filter(t => t && t[0] != null) : [];
    const strip = tiles.length ? `<div class="stats four" style="grid-template-columns:repeat(${tiles.length},1fr)">${tiles.map(([v, k]) => `<div><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join('')}</div>` : '';
    // form: the last five results as pips, newest on the right; splits from the standings row
    const last5 = evs.filter(isDone).slice(-5);
    const form = last5.length ? `<div class="form"><span>Last ${last5.length}</span>${last5.map(g => { const us = g.home.id === String(id) ? g.home : g.away, them = us === g.home ? g.away : g.home; const w = us.score > them.score; return `<a class="pip ${w ? 'w' : 'l'}" href="${href.game(lk, g.id)}" title="${esc(`${w ? 'W' : 'L'} ${us.score}-${them.score} ${us === g.home ? 'vs' : 'at'} ${them.short}`)}"><b>${w ? 'W' : 'L'}</b><i>${esc(them.abbr || '')}</i></a>`; }).join('')}</div>` : '';
    const shown = new Set(tiles.map(([, k]) => k));
    const splits = r ? [['Home', r.home, 'HOME'], ['Road', r.road, 'ROAD'], ['Last 10', r.l10, 'LAST 10'], ['Streak', r.strk, 'STREAK'], [L.standingsMode === 'conferences' ? 'In conference' : 'vs conference', r.conf, 'CONF']].filter(([, x, k]) => x && !shown.has(k)) : [];
    const splitsHtml = splits.length ? `<div class="stats splits" style="grid-template-columns:repeat(${Math.min(splits.length, 5)},1fr)">${splits.map(([k, x]) => `<div><b>${esc(x)}</b><span>${esc(k.toUpperCase())}</span></div>`).join('')}</div>` : '';
    const nextHtml = form + splitsHtml + (next ? sec(next.state === 'in' ? 'Live now' : 'Next up') + `<div class="games">${gameCard(L, next, ctx)}</div>` : '');
    // roster, by scoring when we have it
    const ath = (roster && roster.athletes || []).flatMap(a => a.items ? a.items : [a]);
    const ppg = {}; if (lp) lp.rows.forEach(p => { if (p.teamId === String(id)) ppg[p.id] = p; });
    const sorted = ath.slice().sort((a, b) => ((ppg[b.id] || {}).pts || 0) - ((ppg[a.id] || {}).pts || 0) || (a.displayName || '').localeCompare(b.displayName || ''));
    const posWord = p => ({ G: 'Guard', F: 'Forward', C: 'Center', 'G-F': 'Guard/forward', 'F-G': 'Forward/guard', 'F-C': 'Forward/center', 'C-F': 'Center/forward', PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward' }[p] || p || '');
    const rRow = (a, extra) => { const p = ppg[a.id]; const injd = a.injuries && a.injuries[0]; return `<a class="row${extra ? ' more' : ''}" href="${href.player(lk, a.id)}"${extra ? ' hidden data-more="roster"' : ''}>${headshot(hsUrl(a), color, 46, a.displayName)}<span class="t"><b>${esc(a.displayName)}</b><span>${esc([posWord(a.position && a.position.abbreviation), a.jersey ? `No. ${a.jersey}` : ''].filter(Boolean).join(', '))}${injd ? `<span class="tag ${/out/i.test(injd.status) ? 'out' : 'q'}">${esc(statusWord(injd.status))}</span>` : ''}</span></span>${p ? `<span class="r"><b>${p.pts.toFixed(1)}</b><span>ppg</span></span>` : chev}</a>`; };
    const rosterHtml = sorted.length ? sec('Roster', `${sorted.length}`, sorted.length > 6 ? `<button data-act="expand" data-more="roster">Everyone</button>` : '') + `<div class="rows">${sorted.slice(0, 6).map(a => rRow(a, false)).join('')}${sorted.slice(6).map(a => rRow(a, true)).join('')}</div>` : '';
    // schedule: next five and last five, expandable to the season
    const sRow = (g, extra) => { const homeSide = g.home.id === String(id); const me = homeSide ? g.home : g.away, op = homeSide ? g.away : g.home; const d = new Date(g.date); const res = isDone(g) ? `<span class="res ${me.score > op.score ? 'w' : 'l'}" style="font-size:15px">${me.score > op.score ? 'W' : 'L'} ${me.score}-${op.score}</span>` : g.off ? `<span class="tag">${esc(g.off)}</span>` : g.state === 'in' ? `<span class="live">${esc(g.detail)}</span>` : chev; return `<a class="row" href="${href.game(lk, g.id)}"${extra ? ' hidden data-more="sched"' : ''}><span class="d">${esc(d.toLocaleDateString('en-US', { month: 'short', timeZone: HW.TZ }))}<b>${esc(d.toLocaleDateString('en-US', { day: 'numeric', timeZone: HW.TZ }))}</b></span>${logo(op.logo, 'm', V._.teamColor(op, L))}<span class="t"><b>${g.neutral ? 'vs' : homeSide ? 'vs' : 'at'} ${esc(op.short)}</b><span>${g.off ? esc(g.off) : g.state === 'post' ? esc(finalWord(g)) : g.state === 'in' ? 'Live' : esc([tipOf(g), tvLabel(g)].filter(Boolean).join(', '))}</span></span>${res}</a>`; };
    const done = evs.filter(isDone), up = evs.filter(g => !isDone(g));
    const recent = done.slice(-3).reverse(), soon = up.slice(0, 4); const restUp = up.slice(4), restDone = done.slice(0, -3).reverse();
    const schedHtml = evs.length ? sec('Schedule', `${evs.length} games`, (restUp.length || restDone.length) ? `<button data-act="expand" data-more="sched">Full season</button>` : '') + `<div class="rows sched">${up.length ? `<div class="sub">Up next<span>${up.length} to play</span></div>` : ''}${soon.map(g => sRow(g, false)).join('')}${restUp.map(g => sRow(g, true)).join('')}${done.length ? `<div class="sub res">Results<span>${done.filter(g => (g.home.id === String(id) ? g.home : g.away).score > (g.home.id === String(id) ? g.away : g.home).score).length}-${done.filter(g => (g.home.id === String(id) ? g.home : g.away).score < (g.home.id === String(id) ? g.away : g.home).score).length}, newest first</span></div>` : ''}${recent.map(g => sRow(g, false)).join('')}${restDone.map(g => sRow(g, true)).join('')}</div>` : '';
    // injuries, news
    const il = inj && inj.byTeam[String(id)] && inj.byTeam[String(id)].list || [];
    S.injuries = S.injuries || {};
    const injHtml = il.length ? sec('Injuries') + `<div class="rows">${il.map((x, i) => { const a = x.athlete || {}; const aid = athId(a); const key = `t:${id}:${aid}:${x.id || i}`; S.injuries[key] = { x, id: aid, team: { id: String(id), short: t0.shortDisplayName || t0.name, color } }; const stt = x.status || ''; const cls = /out/i.test(stt) ? 'out' : /day|quest|doubt/i.test(stt) ? 'q' : 'ok'; const det = x.details || {}; const ret = retInfo(L, det.returnDate); const why = [det.type || det.detail, ret ? ret.short : ''].filter(Boolean).join(', '); return `<button class="row" data-act="injury" data-key="${esc(key)}">${headshot(hsUrl(a), color, 44, a.displayName)}<span class="t"><b>${esc(a.displayName || '')}</b><span>${esc(why || (x.shortComment || '').slice(0, 80))}</span></span><span class="tag ${cls}">${esc(statusWord(stt))}</span></button>`; }).join('')}</div>` : '';
    // news about this team only: ESPN's team tag first, the team's own name as the fallback; college feeds are league-wide, so nothing shows unless it matches
    const college = /^ncaa/.test(lk);
    const tn = [t0.displayName, t0.location, t0.shortDisplayName, college ? '' : t0.name].filter(n => n && n.length > 3);
    const about = a => taggedTeam(a, id) || tn.some(n => `${a.headline || ''} ${a.description || ''}`.includes(n));
    const arts = news && news.articles ? news.articles.filter(a => HW.readable(a) && (about(a) || (!college && !cats(a).length))).slice(0, 6) : [];
    const newsHtml = arts.length ? sec('News') + `<div class="rows">${arts.map(a => newsRow(lk, a)).join('')}</div>` : '';
    // the season outlook: playoff odds and a projected record when the simulation is cheap to have (nightly schedule, or already run today)
    const simOk = HW.sim && (L.playoffLine || []).length && (lk === 'nba' || lk === 'wnba') && r;
    const TS = await HW.teamStats(L).catch(() => null); const ts = TS && TS.teams[String(id)];
    const ord = n => n ? ordinal(n) : '';
    const pctS = v => v == null ? '—' : `${(v * 100).toFixed(1)}%`; const f1 = v => v == null ? '—' : (+v).toFixed(1); const sg1 = v => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
    const rk = k => ts && ts.rank && ts.rank[k] ? `<i class="rk ${ts.rank[k] <= 5 ? 'hi' : ts.rank[k] > TS.n - 5 ? 'lo' : ''}">${ord(ts.rank[k])}</i>` : '';
    const statsHtml = ts ? sec('Team stats', `ranked among ${TS.n}`) + `<div class="stats four tsg"><div><b>${f1(ts.ortg)}</b><span>OFF RTG</span>${rk('ortg')}</div><div><b>${f1(ts.drtg)}</b><span>DEF RTG</span>${rk('drtg')}</div><div><b>${sg1(ts.net)}</b><span>NET</span>${rk('net')}</div><div><b>${f1(ts.pace)}</b><span>PACE</span>${rk('pace')}</div></div>` +
      `<table class="tbl ff"><thead><tr><th>Four factors</th><th>Offense</th><th>Defense</th></tr></thead><tbody>${[['Effective FG%', 'efg', 'oefg', pctS], ['Turnover rate', 'tovr', 'otovr', pctS], ['Rebounding', 'orbr', 'drbr', pctS], ['Free-throw rate', 'ftr', 'oftr', pctS]].map(([lab, a, b, fmt]) => `<tr><td>${lab}</td><td><b>${fmt(ts[a])}</b>${rk(a)}</td><td><b>${fmt(ts[b])}</b>${rk(b)}</td></tr>`).join('')}</tbody></table><p class="legend">Ratings are points per 100 possessions scored and allowed; pace is possessions per game. The four factors: shooting (effective field-goal %), turnovers per possession, offensive rebounds taken (and defensive rebounds kept), free throws attempted per shot. Ranks are among the league: 1st is best on each line.</p>` : '';
    const outlook = simOk ? `<div class="outlook" data-lk="${lk}" data-id="${esc(String(id))}">${HW.sim.ready(L) ? '' : `<div class="rows"><button class="row" data-act="outlook"><span class="t"><b>Season outlook</b><span class="wrap">Playoff odds and a projected record, from the rest of the schedule</span></span>${chev}</button></div>`}</div>` : '';
    $main.innerHTML = topbar(esc(t0.shortDisplayName || t0.name || t0.displayName || ''), '#teams') + hero + strip + `<div class="tcols"><div class="tcol main">${nextHtml + outlook + statsHtml + rosterHtml + schedHtml}</div><div class="tcol side">${injHtml + newsHtml}</div></div>`;
    document.title = `${t0.displayName} · RIVL`;
    if (simOk) outlookFill(L, String(id), r, { feed: HW.sim.ready(L) });   // fills in from the nightly file when there is one; otherwise the row above offers it
    V.refresh = next && next.state === 'in' ? async () => { const g2 = await liveOf(next, 15000); const host = $main.querySelector('.tcol.main .games'); if (!host || !g2) return; const h = gameCard(L, g2, ctx); if (host.dataset.h !== hashOf(h)) { host.innerHTML = h; host.dataset.h = hashOf(h); } if (g2.state === 'post') V.refresh = null; } : null;
  }
  /* a team's line from the simulation: odds, projected record, the run left */
  async function outlookFill(L, id, r, { feed = false } = {}) {
    const box = $main.querySelector(`.outlook[data-lk="${L.key}"][data-id="${id}"]`); if (!box) return;
    const v = await HW.sim.season(L, { feed }).catch(() => null);
    const box2 = $main.querySelector(`.outlook[data-lk="${L.key}"][data-id="${id}"]`); if (!box2 || !v) return;
    if (!v.sim.left) { box2.innerHTML = ''; return; }   // nothing left to play: the standings are the season
    const t = v.byId[id]; if (!t) return; r = r || (v.ctx && v.ctx.cur && v.ctx.cur.byId[id]) || {};
    const cut = L.playoffLine || []; const playIn = cut.length === 2; const o = v.rest[id] || { n: 0, opp: 0 };
    const pc = p => p >= .995 ? '>99%' : p < .005 ? (p > 0 ? '<1%' : '0%') : `${Math.round(p * 100)}%`;
    const ordinalSeed = () => { let best = 0; t.seeds.forEach((p, i) => { if (p > t.seeds[best]) best = i; }); return best + 1; };
    const runWord = o.n ? (o.opp > 1 ? 'a hard run' : o.opp < -1 ? 'a soft run' : 'an average run') : '';
    box2.innerHTML = sec('Season outlook') + `<div class="stats four outl"><div><b>${pc(t.playoffs)}</b><span>PLAYOFFS</span></div>${playIn ? `<div><b>${pc(t.top)}</b><span>TOP ${cut[0]}</span></div>` : `<div><b>${pc(t.first)}</b><span>NO. 1</span></div>`}<div><b>${Math.round(t.w)}-${Math.round(t.l)}</b><span>PROJECTED</span></div><div><b>${o.n}</b><span>LEFT</span></div></div><p class="legend">Most likely finish: ${ordinal(ordinalSeed())} in the ${esc(confName(r.group, r.groupAbbr))}${playIn ? ` · play-in ${pc(t.playin)}` : ''}. ${o.n ? `${runWord[0].toUpperCase()}${runWord.slice(1)} left: opponents ${o.opp > 0 ? '+' : o.opp < 0 ? '−' : ''}${Math.abs(o.opp).toFixed(1)} against an average team with home court counted, ${o.home} of ${o.n} at home.` : ''} <a href="#standings" data-act="stab-odds">All the odds</a></p>`;
  }

  V.outlookFill = outlookFill;

  /* ================= VENUE =================
     Everything the game's summary carries about the building: its photo, where it is, how many it holds, whether it is indoors,
     who plays there — and the game it was opened from. */
  async function venueV(lk, gid) {
    const L = LEAGUES[lk]; if (!L || !gid) { $main.innerHTML = empty('Venue not found'); return; }
    $main.innerHTML = topbar('', `#game/${lk}/${gid}`) + skeleton(1, 'card') + skeleton(3, 'row');
    const d = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(gid)}`, 3600000);
    const ven = d && d.gameInfo && d.gameInfo.venue; const hc = d && d.header && d.header.competitions && d.header.competitions[0];
    if (!ven || !hc) { $main.innerHTML = topbar('Venue', `#game/${lk}/${gid}`) + empty("Nothing on this venue", '<p style="margin:6px 0 0">The feed carries no details for it.</p>'); return; }
    const g = parseEvent({ id: gid, competitions: [{ ...hc, venue: ven, status: hc.status }], date: hc.date, status: hc.status }, L);
    const im0 = (ven.images || []).filter(x => x && x.href).sort((x, y) => (y.width || 0) - (x.width || 0))[0];
    const where = ven.address ? [ven.address.city, ven.address.state, ven.address.country && !/^(USA|United States)$/i.test(ven.address.country) ? ven.address.country : ''].filter(Boolean).join(', ') : '';
    const homeT = !g.neutral && g.home && g.home.id ? g.home : null; const hc0 = homeT ? V._.teamColor(homeT, L) : '';
    const factsOf = (cap, opened) => [where, cap ? `Holds ${(+cap).toLocaleString()}` : '', opened ? `Opened ${opened}` : '', ven.indoor === true ? 'Indoor' : ven.indoor === false ? 'Outdoor' : ''].filter(Boolean);
    const factsHtml = f => f.map(x => `<span>${esc(x)}</span>`).join('');
    const im0h = im0 ? { href: im0.href, alt: im0.alt || '' } : null;
    const hero = `<div class="vhero${im0h ? ' pic' : ''}" data-gid="${esc(String(gid))}" style="${homeT ? `--a:${esc(hc0)}` : ''}">${im0h ? `<img src="${esc(im0h.href)}" alt="${esc(im0h.alt || ven.fullName || '')}" onerror="this.parentNode.classList.remove('pic');this.remove()">` : ''}<div class="in"><div class="sub">Venue</div><h1>${esc(ven.fullName || '')}</h1><div class="facts">${factsHtml(factsOf(ven.capacity, 0))}</div></div></div>`;
    const when = g.date ? dayLabel(ymdOf(g.date), { weekday: 'long', month: 'long', day: 'numeric' }) : '';
    const rows = [
      homeT ? `<a class="row" href="${href.team(lk, homeT.id)}">${logo(homeT.logo, '', hc0)}<span class="t"><b>Home of the ${esc(homeT.short || homeT.name)}</b><span>${esc(homeT.name || '')}</span></span>${chev}</a>` : '',
      `<a class="row" href="${href.game(lk, gid)}"><span class="t"><b>${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}</b><span>${esc([when, g.state === 'pre' ? tipOf(g) : g.state === 'in' ? g.detail : finalWord(g)].filter(Boolean).join(' · '))}</span></span>${chev}</a>`
    ].filter(Boolean).join('');
    /* The screen goes up on ESPN's data alone. Waiting for Wikipedia's article and then Wikidata's claims before painting
       anything meant three round trips of skeleton; they now arrive into a finished page. */
    $main.innerHTML = topbar(esc(ven.fullName || 'Venue'), `#game/${lk}/${gid}`) + hero + `<div class="rows">${rows}</div>`;
    document.title = `${ven.fullName || 'Venue'} · RIVL`;
    vheroShow($main.querySelector('.vhero img'));
    if (!ven.fullName) return;
    // ESPN names the building; Wikipedia has the photo and the detail
    const wp = await HW.wikiPage(ven.fullName).catch(() => null);
    const live = () => { const h = $main.querySelector('.vhero'); return h && h.dataset.gid === String(gid) ? h : null; };   // still the same venue on screen
    if (!wp || !live()) return;
    const wf = wp.id ? await HW.wikiFacts(wp.id).catch(() => ({})) : {};
    const host = live(); if (!host) return;
    const fe = host.querySelector('.facts'); const facts = factsOf(ven.capacity || wf.capacity || 0, wf.opened);
    if (fe) { const html = factsHtml(facts); if (fe.innerHTML !== html) fe.innerHTML = html; }
    if (!im0h && wp.img) {
      const img = document.createElement('img'); img.alt = wp.title || ven.fullName || '';
      img.onerror = () => { host.classList.remove('pic'); img.remove(); };
      host.classList.add('pic'); host.insertBefore(img, host.firstChild); img.src = wp.img; vheroShow(img);
    }
    if (wp.extract && !$main.querySelector('.vabout')) $main.insertAdjacentHTML('beforeend', sec('About') + `<div class="vabout"><p>${esc(wp.extract.split(/(?<=\.)\s+/).slice(0, 4).join(' '))}</p><a class="src" href="${esc(wp.url)}" target="_blank" rel="noopener">Wikipedia<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17 17 7M9 7h8v8"/></svg></a></div>`);
  }
  /* A photo appears whole or not at all. Left to itself a baseline JPEG paints in bands down the screen as it streams, which
     is what Ray saw; the hero holds its team-colour gradient until the image has decoded, then the two cross. */
  function vheroShow(img) {
    if (!img) return;
    const on = () => { const h = img.parentNode; if (h) h.classList.add('ready'); };
    const fall = () => { if (img.complete && img.naturalWidth) on(); else img.addEventListener('load', on, { once: true }); };
    if (img.decode) img.decode().then(on, fall); else fall();
  }

  /* ================= GAME ================= */
  const WANT = ['fieldGoalPct', 'threePointFieldGoalPct', 'freeThrowPct', 'totalRebounds', 'assists', 'turnovers', 'steals', 'blocks', 'pointsInPaint', 'fastBreakPoints', 'largestLead'];
  const LOW = { turnovers: 1 };
  const NICE = { fieldGoalPct: 'Field goals', threePointFieldGoalPct: 'Threes', freeThrowPct: 'Free throws', totalRebounds: 'Rebounds', assists: 'Assists', turnovers: 'Turnovers', steals: 'Steals', blocks: 'Blocks', pointsInPaint: 'Points in the paint', fastBreakPoints: 'Fast-break points', largestLead: 'Largest lead' };
  /* ================= SHOTS AND LINEUPS, worked from the play-by-play =================
     ESPN marks every field-goal attempt with a court coordinate: x across the floor (0–50 ft), y up the floor from the
     baseline (0–94 ft), the hoop 5.25 ft off the baseline. Each half is folded onto one so every shot reads toward the same
     basket. The chart is only shown when the distances the feed writes into the play text ("26-foot") agree with the
     coordinates: a chart that put shots in the wrong place would be worse than none. */
  const HOOP = { x: 25, y: 5.25 };
  const normName = n => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
  function shotsOf(plays, g) {
    const out = [];
    (plays || []).forEach((p, i) => {
      const txt = String(p.text || ''); const c = p.coordinate;
      if (!p.shootingPlay || !c || !isFinite(+c.x) || !isFinite(+c.y)) return;
      if (/free throw/i.test(txt) || (p.type && /free throw/i.test(p.type.text || ''))) return;
      let x = +c.x, y = +c.y; if (y > 47) { x = 50 - x; y = 94 - y; }
      const made = !!p.scoringPlay || /\bmakes\b/i.test(txt);
      const three = +p.scoreValue === 3 || /three point/i.test(txt);
      const tid = p.team && String(p.team.id); const side = tid === g.home.id ? 'home' : tid === g.away.id ? 'away' : '';
      const who = /^(.+?)\s+(makes|misses)\b/i.exec(txt); const pid = p.participants && p.participants[0] && p.participants[0].athlete && String(p.participants[0].athlete.id) || '';
      const dm = /(\d+)-foot/i.exec(txt);
      out.push({ i, x, y, made, three, side, pid, name: who ? who[1] : '', text: txt, period: p.period && p.period.number, clock: p.clock && p.clock.displayValue || '', dist: Math.hypot(x - HOOP.x, y - HOOP.y), said: dm ? +dm[1] : null });
    });
    return out;
  }
  /* true when the coordinates and the written distances tell the same story (or nothing is written to check against) */
  function shotsTrusted(shots) {
    const known = shots.filter(s => s.said != null); if (known.length < 3) return true;
    const errs = known.map(s => Math.abs(s.dist - s.said)).sort((a, b) => a - b);
    return errs[Math.floor(errs.length / 2)] <= 4;
  }
  const zoneOf = s => s.three ? 'three' : s.dist <= 4 ? 'rim' : (Math.abs(s.x - 25) <= 8 && s.y <= 19) ? 'paint' : 'mid';
  const ZONES = [['rim', 'At the rim'], ['paint', 'In the paint'], ['mid', 'Mid-range'], ['three', 'Threes']];
  /* the half court, in feet; the three-point line and lane follow the league's rules */
  function courtSvg(L, shots, { colorOf, dot = 0.85 } = {}) {
    const nba = L.key === 'nba'; const arcR = nba ? 23.75 : 22.15, cornerX = nba ? 3 : 25 - 21.65, laneW = L.key.startsWith('ncaa') ? 12 : 16;
    const cy = Math.sqrt(arcR * arcR - (25 - cornerX) ** 2) + HOOP.y;   // where the corner leg meets the arc
    const Y = y => 47 - y;   // the baseline sits at the bottom of the picture
    const lines = [
      `<rect x="0" y="0" width="50" height="47" fill="none"/>`,
      `<rect x="${25 - laneW / 2}" y="${Y(19)}" width="${laneW}" height="19"/>`,
      `<path d="M${25 - 6} ${Y(19)} A6 6 0 0 1 ${25 + 6} ${Y(19)}"/>`,
      `<path d="M${25 - 6} ${Y(19)} A6 6 0 0 0 ${25 + 6} ${Y(19)}" stroke-dasharray=".6 .6"/>`,
      `<path d="M${25 - 4} ${Y(5.25)} A4 4 0 0 1 ${25 + 4} ${Y(5.25)}"/>`,
      `<line x1="22" y1="${Y(4)}" x2="28" y2="${Y(4)}" stroke-width=".45"/>`,
      `<circle cx="25" cy="${Y(5.25)}" r=".75"/>`,
      `<path d="M${cornerX} ${Y(0)} V${Y(cy)} A${arcR} ${arcR} 0 0 1 ${50 - cornerX} ${Y(cy)} V${Y(0)}"/>`,
      `<path d="M${25 - 6} ${Y(47)} A6 6 0 0 0 ${25 + 6} ${Y(47)}"/>`
    ].join('');
    const dots = shots.map(s => { const c = colorOf ? colorOf(s) : 'var(--ink)'; const x = Math.min(50, Math.max(0, s.x)).toFixed(2), y = Y(Math.min(47, Math.max(0, s.y))).toFixed(2); return s.made ? `<circle class="mk" cx="${x}" cy="${y}" r="${dot}" fill="${c}"><title>${esc(s.text)}</title></circle>` : `<circle class="ms" cx="${x}" cy="${y}" r="${dot * .9}" fill="none" stroke="${c}" stroke-width=".4"><title>${esc(s.text)}</title></circle>`; }).join('');
    return `<svg class="court" viewBox="-.5 -.5 51 48" role="img" aria-label="Shot chart"><g fill="none" stroke="var(--line-2)" stroke-width=".3" stroke-linecap="round">${lines}</g><g>${dots}</g></svg>`;
  }
  function zoneRows(shots, sides) {
    const agg = list => { const z = {}; ZONES.forEach(([k]) => z[k] = [0, 0]); list.forEach(s => { const k = zoneOf(s); z[k][1]++; if (s.made) z[k][0]++; }); return z; };
    const cell = ([m, a]) => a ? `<b>${m}-${a}</b><span>${Math.round(m / a * 100)}%</span>` : '<span>—</span>';
    const cols = sides.map(sd => agg(shots.filter(s => !sd.filter || sd.filter(s))));
    return `<div class="zones"><div class="zh"><span></span>${sides.map(sd => `<span>${sd.head}</span>`).join('')}</div>${ZONES.map(([k, label]) => `<div class="zr"><span>${label}</span>${cols.map(z => `<em>${cell(z[k])}</em>`).join('')}</div>`).join('')}<div class="zr tot"><span>All shots</span>${cols.map(z => { const t = Object.values(z).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]); return `<em>${cell(t)}</em>`; }).join('')}</div></div>`;
  }
  V.shotChart = { shotsOf, shotsTrusted, courtSvg, zoneRows, zoneOf };
  /* who is on the floor, and every five-man unit's minutes and plus-minus: the starters from the box score, then every
     substitution in the play-by-play. If a single substitution can't be read cleanly nothing is shown. */
  function lineupsOf(d, g, L) {
    const bx = d.boxscore && d.boxscore.players || []; const names = {}; const start = { home: [], away: [] }; const byName = { home: new Map(), away: new Map() }; const byLast = { home: new Map(), away: new Map() };
    ['away', 'home'].forEach(side => { const t = g[side]; const p = bx.find(x => x.team && String(x.team.id) === t.id); const st = p && p.statistics && p.statistics[0]; (st && st.athletes || []).forEach(a => { const id = String(a.athlete.id); const nm = a.athlete.displayName || a.athlete.shortName || ''; names[id] = { name: nm, short: V.lastName(nm), side, hs: hsUrl(a.athlete), ath: a }; byName[side].set(normName(nm), id); const ln = normName(nm).split(' ').pop(); byLast[side].set(ln, byLast[side].has(ln) ? null : id); if (a.starter) start[side].push(id); }); });
    if (start.home.length !== 5 || start.away.length !== 5) return null;
    const perLen = (L.periods === 2 ? 20 : 12) * 60, otLen = 300;
    const secsLeft = c => { const v = String(c || '0:00'); if (v.includes(':')) { const [m, sx] = v.split(':'); return (+m || 0) * 60 + (parseFloat(sx) || 0); } return parseFloat(v) || 0; };
    const elapsed = p => { const n = p.period && p.period.number || 1; const before = n <= L.periods ? (n - 1) * perLen : L.periods * perLen + (n - L.periods - 1) * otLen; const len = n <= L.periods ? perLen : otLen; return before + (len - secsLeft(p.clock && p.clock.displayValue)); };
    const on = { home: start.home.slice(), away: start.away.slice() }; const units = new Map(); let t0 = 0, h0 = 0, a0 = 0, bad = '';
    const accrue = (t, h, a) => { const dt = Math.max(0, t - t0); ['home', 'away'].forEach(side => { const key = side + ':' + on[side].slice().sort().join(','); const u = units.get(key) || { ids: on[side].slice(), side, secs: 0, pm: 0 }; u.secs += dt; u.pm += side === 'home' ? (h - h0) - (a - a0) : (a - a0) - (h - h0); units.set(key, u); }); t0 = t; h0 = h; a0 = a; };
    const find = (nm, side) => { const k = normName(nm); if (byName[side].has(k)) return byName[side].get(k); const ln = k.split(' ').pop(); return byLast[side].get(ln) || null; };
    const plays = d.plays || [];
    for (const p of plays) {
      const txt = String(p.text || '');
      const isSub = (p.type && /substitution/i.test(p.type.text || '')) || /enters the game for/i.test(txt);
      if (!isSub) continue;
      accrue(elapsed(p), +p.homeScore || h0, +p.awayScore || a0);
      const tid = p.team && String(p.team.id); const side = tid === g.home.id ? 'home' : tid === g.away.id ? 'away' : '';
      if (!side) { bad = 'no team on a substitution'; break; }
      const m = /^(.+?) enters the game for (.+?)\.?$/i.exec(txt.trim());
      let inId = m ? find(m[1], side) : null, outId = m ? find(m[2], side) : null;
      const ps = (p.participants || []).map(x => x && x.athlete && String(x.athlete.id)).filter(Boolean);
      if ((!inId || !outId) && ps.length >= 2) { const [p1, p2] = ps; if (on[side].includes(p2) && !on[side].includes(p1)) { inId = p1; outId = p2; } else if (on[side].includes(p1) && !on[side].includes(p2)) { inId = p2; outId = p1; } }
      if (!inId || !outId || !on[side].includes(outId) || on[side].includes(inId)) { bad = `couldn't read: ${txt}`; break; }
      on[side] = on[side].map(id => id === outId ? inId : id);
    }
    if (bad) return { bad };
    if (plays.length) { const last = plays[plays.length - 1]; accrue(elapsed(last), +last.homeScore || h0, +last.awayScore || a0); }
    return { on, units: [...units.values()], names, at: plays.length ? elapsed(plays[plays.length - 1]) : 0 };
  }

  async function gameV(lk, id, focus = '') {
    const L = LEAGUES[lk]; if (!L || !id) { $main.innerHTML = empty('Game not found'); return; }
    $main.innerHTML = topbar('', '#scores') + skeleton(1, 'card') + skeleton(6, 'row');
    let ctx = null, sched, tab = focus ? 'box' : 'summary';   // every game opens on Summary — or on the box score, led by one player, when opened from his line
    const pv = { q: 'all', scoring: false };   // the plays tab's period and scoring-only filters
    const sv = { team: 'both', pid: '' };   // the shots tab's team and player filters
    const bv = { col: '', dir: 'desc' };   // the box score's sort column
    const pf = { pid: '' };   // the plays tab's player filter
    const paint = async (ttl) => {
      const d = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, ttl);
      const hc = d && d.header && d.header.competitions && d.header.competitions[0];
      if (!hc) { $main.innerHTML = topbar('Game', '#scores') + empty("Couldn't load this game", '<p style="margin:6px 0 0">The feed didn\'t answer. Pull down to try again.</p>'); return null; }
      const ev = { id, competitions: [{ ...hc, venue: d.gameInfo && d.gameInfo.venue, status: hc.status, broadcasts: hc.broadcasts, geoBroadcasts: hc.geoBroadcasts }], date: hc.date, status: hc.status, season: d.header.season, pickcenter: d.pickcenter };   // the summary keeps the market line in pickcenter, not on the competition
      const g = parseEvent(ev, L); if (!g.date || isNaN(new Date(g.date))) g.date = new Date().toISOString();
      if (!ctx) ctx = await forecastCtx(L, ymdOf(g.date)).catch(() => null);
      if (sched === undefined) sched = HW.sim && (lk === 'nba' || lk === 'wnba') ? await HW.sim.schedule(L, { feed: false }).catch(() => null) : null;
      const f = safeF(L, g, ctx);
      const title = g.tbd ? esc(String(g.note || '').replace(/\s+-\s+/g, ' ') || 'Teams to be decided') : `${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}`;
      if (!g.tbd) V._.tint(V._.scoreColor(L, f && f.pHome < .5 ? g.away : g.home));   // the page leans the favourite's way, the home side's when there is no call
      const hero = heroCard(L, g, ctx, { page: true });
      const shots = g.state === 'pre' ? [] : shotsOf(d.plays, g); const shotsOk = shots.length > 0 && shotsTrusted(shots);
      const tabList = [['summary', 'Summary'], ['box', 'Box score'], ['plays', 'Plays'], ['shots', 'Shots'], ['stats', 'Team stats']].filter(([k]) => (g.state !== 'pre' || k === 'summary' || k === 'stats') && (k !== 'shots' || shotsOk));
      if (!tabList.some(([k]) => k === tab)) tab = 'summary';
      const tabs = chips(tabList, tab, 'gtab', 'tab'); const tabKey = tabList.map(([k]) => k).join();
      // box score helpers
      const bx = d.boxscore && d.boxscore.players || [];
      const boxOf = side => bx.find(x => String(x.team.id) === side.id);
      const statOf = (p, label) => { const s = p && p.statistics && p.statistics[0]; if (!s) return null; const i = (s.labels || s.names || []).indexOf(label); return i < 0 ? null : { i, s }; };
      const topFor = side => { const p = boxOf(side); const st = statOf(p, 'PTS'); if (!st) return null; const ath = (st.s.athletes || []).filter(a => a.stats && a.stats.length && !a.didNotPlay); if (!ath.length) return null; const best = ath.slice().sort((a, b) => (+b.stats[st.i] || 0) - (+a.stats[st.i] || 0))[0]; const get = l => { const k = (st.s.labels || []).indexOf(l); return k >= 0 ? best.stats[k] : ''; }; return { a: best.athlete, pts: get('PTS'), reb: get('REB'), ast: get('AST') }; };
      const tms = d.boxscore && d.boxscore.teams || [];
      const ta = tms.find(t => String(t.team.id) === g.away.id), th = tms.find(t => String(t.team.id) === g.home.id);
      const flat = t => (t && t.statistics || []).flatMap(x => x && x.displayValue != null ? [x] : (x && (x.stats || x.statistics) || []));
      const get = (t, n) => flat(t).find(x => x.name === n);
      const cmpHead = `<div class="cmph"><a class="tm" href="${href.team(lk, g.away.id)}">${logo(g.away.logo, 's', V._.teamColor(g.away, L))}<b>${esc(g.away.abbr)}</b></a><a class="tm r" href="${href.team(lk, g.home.id)}"><b>${esc(g.home.abbr)}</b>${logo(g.home.logo, 's', V._.teamColor(g.home, L))}</a></div>`;
      const cmpRows = (names) => names.map(n => { const a = get(ta, n), h = get(th, n); if (!a || !h) return ''; const av = parseFloat(String(a.displayValue).split('-')[0]) || 0, hv = parseFloat(String(h.displayValue).split('-')[0]) || 0; const mx = Math.max(av, hv) || 1; const lowGood = !!LOW[n]; const aw = lowGood ? av <= hv : av >= hv, hw = lowGood ? hv <= av : hv >= av; return `<div><span class="lab">${esc(NICE[n] || a.label || n)}</span><b class="${aw ? 'lead' : ''}">${esc(a.displayValue)}</b><em class="l"><i style="width:${av / mx * 100}%;${tcv(V._.teamColor(g.away, L))}"></i></em><em class="r"><i style="width:${hv / mx * 100}%;${tcv(V._.teamColor(g.home, L))}"></i></em><b class="${hw ? 'lead' : ''}">${esc(h.displayValue)}</b></div>`; }).join('');
      const plays = (d.plays || []);
      // scoring runs: consecutive points by one side, called out at 8-0 and up
      const runs = new Map(); if (plays.length) { let ph = +plays[0].homeScore || 0, pa = +plays[0].awayScore || 0, team = '', pts = 0, from = 0; plays.forEach((p, i) => { if (!i) return; const h = +p.homeScore || 0, a = +p.awayScore || 0; const dh = h - ph, da = a - pa; ph = h; pa = a; if (dh > 4 || da > 4 || dh < 0 || da < 0) { team = ''; pts = 0; return; }   /* a gap in the feed, not a run */ const who = dh > 0 ? 'home' : da > 0 ? 'away' : ''; if (!who) return; const v = dh > 0 ? dh : da; if (who === team) { pts += v; } else { if (team && pts >= 8) runs.set(from, { team, pts }); team = who; pts = v; } from = i; }); if (team && pts >= 8) runs.set(from, { team, pts }); }
      const runMark = i => { const r = runs.get(i); if (!r) return ''; const t = r.team === 'home' ? g.home : g.away; return `<div class="runmark" style="${tcv(V._.teamColor(t))}"><b>${r.pts}–0</b> ${esc(t.short)} run</div>`; };
      const sideOf = p => { const id = p.team && String(p.team.id); return id === g.home.id ? g.home : id === g.away.id ? g.away : null; };
      const playRow = (p, i) => { const t = p.scoringPlay ? sideOf(p) : null; return `${runMark(i)}<div class="row play${p.scoringPlay ? ' score' : ''}"${t ? ` style="${tcv(V._.teamColor(t, L))}"` : ''}><span class="q">${esc(p.period && p.period.displayValue ? p.period.displayValue.replace('Quarter', 'Q').replace(/(\d)(st|nd|rd|th) Q/, 'Q$1') : '')} ${esc(p.clock && p.clock.displayValue || '')}</span><span class="t"><b class="wrap">${esc(p.text || '')}</b><span>${p.awayScore != null ? `${esc(g.away.abbr)} ${p.awayScore}, ${esc(g.home.abbr)} ${p.homeScore}` : ''}</span></span>${p.scoringPlay ? `<span class="tag ok pts">+${esc(p.scoreValue || '')}</span>` : ''}</div>`; };
      // the line score, quarter by quarter
      const lsOf = side => { const c = (hc.competitors || []).find(x => x.team && String(x.team.id) === side.id); return (c && c.linescores || []).map(l => l.displayValue ?? l.value ?? ''); };
      const lsA = lsOf(g.away), lsH = lsOf(g.home); const nq = Math.max(lsA.length, lsH.length);
      const lineScore = g.state !== 'pre' && nq ? `<div class="tw"><table class="tbl ls"><thead><tr><th></th>${Array.from({ length: nq }, (_, i) => `<th>${i < (L.periods || 4) ? i + 1 : `OT${i - (L.periods || 4) + 1 > 1 ? i - (L.periods || 4) + 1 : ''}`}</th>`).join('')}<th>T</th></tr></thead><tbody>${[[g.away, lsA], [g.home, lsH]].map(([t, ls]) => `<tr><td class="l">${logo(t.logo, 's', V._.teamColor(t, L))} ${esc(t.abbr)}</td>${Array.from({ length: nq }, (_, i) => `<td>${esc(String(ls[i] ?? ''))}</td>`).join('')}<td><b>${t.score ?? ''}</b></td></tr>`).join('')}</tbody></table></div>` : '';
      // the lead tracker: ESPN's win probability for the home side through the game
      const wpAll = (d.winprobability || []).filter(x => x.homeWinPercentage != null);
      let tracker = '';
      if (wpAll.length > 4 && g.state !== 'pre') {
        const W = 320, Hh = 110, pad = 4; const n = wpAll.length; const X = i => pad + i / (n - 1) * (W - pad * 2); const Y = p => pad + (1 - p) * (Hh - pad * 2);
        const pts = wpAll.map((x, i) => `${X(i).toFixed(1)},${Y(x.homeWinPercentage).toFixed(1)}`);
        const mid = Y(.5); const [ca, ch] = V._.pairColors(L, g.away, g.home);
        const lastP = wpAll[n - 1].homeWinPercentage; const lead = lastP >= .5 ? g.home : g.away;
        tracker = sec('Lead tracker', g.state === 'in' ? `${esc(lead.short)} ${Math.round(Math.max(lastP, 1 - lastP) * 100)}% right now` : `ESPN's win probability through the game`) + `<div class="tracker"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Win probability through the game"><defs><clipPath id="ct"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath><clipPath id="cb"><rect x="0" y="${mid}" width="${W}" height="${Hh - mid}"/></clipPath></defs><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="var(--line-2)" stroke-dasharray="3 4"/><polygon points="${pad},${mid} ${pts.join(' ')} ${X(n - 1).toFixed(1)},${mid}" fill="${ch}" opacity=".28" clip-path="url(#ct)"/><polygon points="${pad},${mid} ${pts.join(' ')} ${X(n - 1).toFixed(1)},${mid}" fill="${ca}" opacity=".28" clip-path="url(#cb)"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${X(n - 1).toFixed(1)}" cy="${Y(lastP).toFixed(1)}" r="3.5" fill="var(--ink)"/></svg><div class="tk"><span><i style="background:${ch}"></i>${esc(g.home.abbr)} ahead</span><span><i style="background:${ca}"></i>${esc(g.away.abbr)} ahead</span></div></div>`;
      }
      // highlights ESPN has cut for this game, in the same sheet the stories' clips use
      const vids = (d.videos || []).filter(v => v && v.links); vids.forEach(v => { if (v.id != null) S.videos[String(v.id)] = v; });
      const clips = vids.length ? sec('Highlights', vids.length > 1 ? `${vids.length} clips` : '') + `<div class="media">${vids.map(v => `<button class="clip" data-act="play" data-vid="${esc(String(v.id))}"><div class="th">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy">` : ''}<i><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg></i>${v.duration ? `<em>${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}</em>` : ''}</div><b>${esc(v.headline || v.title || '')}</b></button>`).join('')}</div>` : '';
      // the announced fives, once ESPN flags them (usually in the last half hour before tip); after tip the box score has them
      const rosterOf = side => { const r = (d.rosters || []).find(x => x.team && String(x.team.id) === side.id); return r && r.roster || []; };
      const fiveOf = side => rosterOf(side).filter(x => x.starter && x.athlete).slice(0, 5);
      const fives = g.state === 'pre' ? [fiveOf(g.away), fiveOf(g.home)] : [[], []];
      const starters = fives[0].length === 5 || fives[1].length === 5 ? sec('Starting fives') + `<div class="fives">${[[g.away, fives[0]], [g.home, fives[1]]].map(([t, five]) => five.length === 5 ? `<div class="five" style="${tcv(V._.teamColor(t, L))}"><div class="fh">${logo(t.logo, 's', V._.teamColor(t, L))}<b>${esc(t.short)}</b></div><div class="fr">${five.map(x => `<a href="${href.player(lk, x.athlete.id)}">${headshot(hsUrl(x.athlete), V._.teamColor(t, L), 48, x.athlete.displayName || '')}<b>${esc(V.lastName(x.athlete.displayName || x.athlete.shortName || ''))}</b><span>${esc(x.position && x.position.abbreviation || x.athlete.position && x.athlete.position.abbreviation || '')}</span></a>`).join('')}</div></div>` : '').join('')}</div>` : '';
      // the game's particulars: where, who's officiating, how many came, when it tips
      const giRows = [];   // [label, line, detail?] — a row with a detail opens on a tap
      const ven = d.gameInfo && d.gameInfo.venue;
      if (ven) { const where = ven.address ? [ven.address.city, ven.address.state].filter(Boolean).join(', ') : ''; giRows.push(['Venue', `${esc(ven.fullName || '')}${where ? `<small>${esc(where)}</small>` : ''}`, '', `#venue/${lk}/${esc(String(id))}`]); }
      if (g.state === 'pre' && g.date) giRows.push(['Tip-off', `${esc(dayLabel(ymdOf(g.date), { weekday: 'long', month: 'long', day: 'numeric' }))}<span>${esc(tipOf(g))}</span>`]);
      if (tvLabel(g)) giRows.push(['TV', esc(tvLabel(g))]);
      const offs = (d.gameInfo && d.gameInfo.officials || []).filter(o => o.fullName || o.displayName).sort((a, b) => (a.order || 0) - (b.order || 0));
      S.officials = S.officials || {};
      if (offs.length) { const crew = offs.map((o, i) => { const key = `${id}:${i}`; S.officials[key] = { o, crew: offs, g: { id, away: g.away, home: g.home, date: g.date, neutral: g.neutral }, lk }; return `<button class="off" data-act="official" data-key="${esc(key)}"><b>${esc(o.fullName || o.displayName)}</b>${o.position && (o.position.displayName || o.position.name) ? `<em>${esc(o.position.displayName || o.position.name)}</em>` : ''}</button>`; }).join(''); giRows.push([offs.length > 1 ? 'Officials' : 'Official', `<span class="offs">${crew}</span>`]); }
      if (d.gameInfo && d.gameInfo.attendance) giRows.push(['Attendance', d.gameInfo.attendance.toLocaleString()]);
      const gi = giRows.length ? sec('Game info') + `<div class="giplate"><div class="rows">${giRows.map(([k, v, det, link]) => link ? `<a class="row" href="${link}"><span class="t"><b>${k}</b><span>${v}</span></span>${chev}</a>` : `<div class="row"><span class="t"><b>${k}</b><span>${v}</span></span></div>`).join('')}</div></div>` : '';
      // who's on the floor now (live), and every five-man unit's minutes and margin
      const lu = g.state !== 'pre' && plays.length ? lineupsOf(d, g, L) : null;
      const ptsOf = (side, id) => { const st = statOf(boxOf(side), 'PTS'); const a = st && (st.s.athletes || []).find(x => String(x.athlete.id) === id); return a && a.stats ? a.stats[st.i] : ''; };
      const floor = g.state === 'in' && lu && lu.on ? sec('On the floor', `as of ${esc(g.detail)}`) + `<div class="fives">${[['away', g.away], ['home', g.home]].map(([side, t]) => `<div class="five" style="${tcv(V._.teamColor(t, L))}"><div class="fh">${logo(t.logo, 's', V._.teamColor(t, L))}<b>${esc(t.short)}</b></div><div class="fr">${lu.on[side].map(id => { const n = lu.names[id] || {}; const pts = ptsOf(t, id); return `<a href="${href.player(lk, id)}">${headshot(n.hs || '', V._.teamColor(t, L), 48, n.name || '')}<b>${esc(n.short || '')}</b><span>${pts !== '' ? `${esc(pts)} pts` : ''}</span></a>`; }).join('')}</div></div>`).join('')}</div>` : '';
      const unitsT = lu && lu.units && lu.units.length ? (() => { const mm = sx => `${Math.floor(sx / 60)}:${String(Math.round(sx % 60)).padStart(2, '0')}`; const table = (side, t) => { const rows = lu.units.filter(u => u.side === side && u.secs >= 60).sort((a, b) => b.secs - a.secs).slice(0, 6); if (!rows.length) return ''; return sec(`${esc(t.short)} units`, 'five-man groups, by minutes') + `<div class="rows units">${rows.map(u => { const onNow = g.state === 'in' && lu.on && u.ids.slice().sort().join() === lu.on[side].slice().sort().join(); return `<div class="row unit${onNow ? ' now' : ''}" style="${tcv(V._.teamColor(t, L))}"><span class="t"><b class="wrap">${u.ids.map(id => esc((lu.names[id] || {}).short || '')).join(' · ')}</b><span>${mm(u.secs)} min${onNow ? ' · on the floor now' : ''}</span></span><span class="pm ${u.pm > 0 ? 'up' : u.pm < 0 ? 'dn' : ''}">${u.pm > 0 ? '+' : u.pm < 0 ? '−' : ''}${Math.abs(u.pm)}</span></div>`; }).join('')}</div>`; }; return table('away', g.away) + table('home', g.home); })() : '';
      // the season series between the two, from the nightly schedule (pro leagues)
      let series = '';
      if (sched && sched.games) {
        const pair = sched.games.filter(x => x.t === 2 && !x.x && x.id !== String(id) && ((x.h === g.home.id && x.a === g.away.id) || (x.h === g.away.id && x.a === g.home.id)));
        const played = pair.filter(x => x.st === 'post' && x.hs != null && x.as != null).sort((a, b) => a.d.localeCompare(b.d)); const ahead = pair.filter(x => !(x.st === 'post' && x.hs != null)).sort((a, b) => a.d.localeCompare(b.d));
        const wins = { [g.home.id]: 0, [g.away.id]: 0 }; played.forEach(x => { wins[x.hs > x.as ? x.h : x.a]++; });
        const tOf = tid => tid === g.home.id ? g.home : g.away;
        const lead = wins[g.home.id] === wins[g.away.id] ? (played.length ? `Tied ${wins[g.home.id]}-${wins[g.away.id]}` : '') : `${esc(tOf(wins[g.home.id] > wins[g.away.id] ? g.home.id : g.away.id).short)} lead${played.length > 1 ? '' : 's'} ${Math.max(wins[g.home.id], wins[g.away.id])}-${Math.min(wins[g.home.id], wins[g.away.id])}`;
        const dOf = x => dayLabel(x.d, { month: 'short', day: 'numeric' });
        const rows = played.map(x => { const w = tOf(x.hs > x.as ? x.h : x.a), l = tOf(x.hs > x.as ? x.a : x.h); const ws = Math.max(x.hs, x.as), ls = Math.min(x.hs, x.as); return `<a class="row" href="${href.game(lk, x.id)}">${logo(w.logo, 's', V._.teamColor(w, L))}<span class="t"><b>${esc(w.short)} ${ws}, ${esc(l.short)} ${ls}</b><span>${esc(dOf(x))} · at ${esc(tOf(x.h).short)}</span></span>${chev}</a>`; }).join('');
        const next = ahead.length ? `<p class="legend">${ahead.length === 1 ? 'One more meeting' : `${ahead.length} more meetings`}: ${ahead.slice(0, 3).map(x => `${esc(dOf(x))} at ${esc(tOf(x.h).short)}`).join(', ')}${ahead.length > 3 ? `, and ${ahead.length - 3} more` : ''}.</p>` : '';
        if (played.length || ahead.length) series = sec('Season series', played.length ? lead : 'First meeting this season') + (rows ? `<div class="rows">${rows}</div>` : '') + next;
      }
      // the injury report for both sides, before tip; each row opens the report
      let report = '';
      if (g.state === 'pre' && ctx && ctx.inj) {
        S.injuries = S.injuries || {};
        const side = t => { const il = ctx.inj.byTeam[t.id] && ctx.inj.byTeam[t.id].list || []; if (!il.length) return ''; const tc = V._.teamColor(t, L); const rows = il.map((x, i) => { const a = x.athlete || {}; const aid = athId(a); const key = `g:${t.id}:${aid}:${x.id || i}`; S.injuries[key] = { x, id: aid, team: { id: t.id, short: t.short, color: tc } }; const stt = x.status || ''; const cls = /out/i.test(stt) ? 'out' : /day|quest|doubt/i.test(stt) ? 'q' : 'ok'; const det = x.details || {}; const ret = retInfo(L, det.returnDate); const why = [det.type || det.detail, ret ? ret.short : ''].filter(Boolean).join(', '); return `<button class="row" data-act="injury" data-key="${esc(key)}">${headshot(hsUrl(a), tc, 44, a.displayName)}<span class="t"><b>${esc(a.displayName || '')}</b><span>${esc(why || (x.shortComment || '').slice(0, 80))}</span></span><span class="tag ${cls}">${esc(statusWord(stt))}</span></button>`; }).join(''); return `<div class="injgrp"><button class="injhd" data-act="injcol" data-id="g:${esc(t.id)}" aria-expanded="true" style="${tcv(tc)}"><i class="bar"></i>${logo(t.logo, 's')}<b>${esc(t.short)}</b><span class="n">${il.length} listed</span>${chev}</button><div class="fold"><div class="injbody">${rows}</div></div></div>`; };
        const both = side(g.away) + side(g.home);
        report = sec('Injury report') + (both ? `<div class="rows injrep">${both}</div>` : `<p class="legend">Nobody listed on either side.</p>`);
      }
      let body = '';
      if (tab === 'summary') {
        body += lineScore;
        if (starters) body += starters;
        if (floor) body += floor;
        const tp = g.state !== 'pre' ? [topFor(g.away), topFor(g.home)] : [null, null];
        /* a player card: the team's colour as the ground, its logo as a watermark, the headshot crisp at the right, the jersey number
           and position from the feed (shown only when the feed carries them), and the line in big figures */
        const pcard = (ath, T, num, unit, chipsArr) => {
          const c = V._.teamColor(T, L); const img = hsUrl(ath); const pos = ath.position && (ath.position.abbreviation || ath.position.name) || '';
          const first = ath.firstName || (ath.displayName || '').split(' ')[0] || '', last = ath.lastName || V.lastName(ath.displayName || ath.shortName || '');
          return `<a class="pc" href="${href.player(lk, ath.id)}" style="--a:${esc(V._.V_lift(c))};--ad:${esc(V._.V_deep(c))}"><div class="shot">${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div><div class="in"><em>${esc([T.short || T.abbr, pos].filter(Boolean).join(' · '))}</em><b>${esc(first)}<br>${esc(last)}</b><span class="line">${esc(num)}${unit ? `<u>${esc(unit)}</u>` : ''}</span>${chipsArr && chipsArr.length ? `<span class="xs">${chipsArr.map(x => `<i>${esc(x)}</i>`).join('')}</span>` : ''}</div></a>`; };
        const sideOf = team => String(team && team.id) === g.home.id ? g.home : String(team && team.id) === g.away.id ? g.away : (team && team.abbreviation === g.home.abbr ? g.home : g.away);
        if (tp[0] || tp[1]) body += sec(g.state === 'post' ? 'Top performers' : 'Leading the way') + `<div class="perf">${tp.map((x, i) => x ? pcard(x.a, i ? g.home : g.away, x.pts, 'pts', [`${x.reb} reb`, `${x.ast} ast`]) : '<div></div>').join('')}</div>`;
        else if (d.leaders && d.leaders.length) { const items = []; d.leaders.forEach(t => (t.leaders || []).slice(0, 1).forEach(cat => { const Ld = cat.leaders && cat.leaders[0]; if (Ld) items.push({ team: t.team, cat, Ld }); })); if (items.length) body += sec('Season leaders') + `<div class="perf">${items.map(({ team, cat, Ld }) => pcard(Ld.athlete, sideOf(team), (Ld.displayValue || '').split(' ')[0], cat.shortDisplayName || cat.abbreviation || cat.displayName.toLowerCase(), [])).join('')}</div>`; }
        body += tracker;
        if (f && prefs.get('forecast')) {
          const fav = f.pHome >= .5 ? g.home : g.away; const p = Math.max(f.pHome, 1 - f.pHome);
          const gap = f.H.rating - f.A.rating; const lead = gap >= 0 ? g.home : g.away;
          const wp = (d.winprobability || []).filter(x => x.homeWinPercentage != null);
          // RIVL's own case, side by side: rating, this season's numbers, rest and who's out — then home court and the margin they add up to
          const R = (ctx && ctx.cur && ctx.cur.byId) || {}; const ra = R[g.away.id] || {}, rh = R[g.home.id] || {};
          const sg = x => x == null || !isFinite(x) ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1);
          const pctOf = r => { const m = /^(\d+)-(\d+)/.exec(String(r || '')); return m && (+m[1] + +m[2]) ? +m[1] / (+m[1] + +m[2]) : null; };
          const strkN = s => { const m = /^([WL])(\d+)$/.exec(String(s || '')); return m ? (m[1] === 'W' ? 1 : -1) * +m[2] : null; };
          const cmp = (x, y) => x == null || y == null || x === y ? 0 : x > y ? -1 : 1;   // -1: away better, 1: home better
          const rows = [];
          const push = (label, av, hv, better, cls = '') => rows.push({ label, av, hv, better: better || 0, cls });
          push('RIVL rating', sg(f.A.rating), sg(f.H.rating), cmp(f.A.rating, f.H.rating));
          if (ra.w != null || rh.w != null) push('Record', ra.w != null ? `${ra.w}-${ra.l}` : '—', rh.w != null ? `${rh.w}-${rh.l}` : '—', cmp(pctOf(`${ra.w}-${ra.l}`), pctOf(`${rh.w}-${rh.l}`)));
          if (ra.diff != null || rh.diff != null) push('Scoring margin', sg(ra.diff), sg(rh.diff), cmp(ra.diff, rh.diff));
          if (ra.l10 || rh.l10) push('Last 10', ra.l10 || '—', rh.l10 || '—', cmp(pctOf(ra.l10), pctOf(rh.l10)));
          if (!g.neutral && (ra.road || rh.home)) push('Road / home', ra.road || '—', rh.home || '—', cmp(pctOf(ra.road), pctOf(rh.home)));
          if (ra.strk || rh.strk) push('Streak', ra.strk || '—', rh.strk || '—', cmp(strkN(ra.strk), strkN(rh.strk)));
          if (f.restH || f.restA) push('Rest', f.restA ? 'Back-to-back' : 'Rested', f.restH ? 'Back-to-back' : 'Rested', cmp(f.restA ? 0 : 1, f.restH ? 0 : 1));
          const soCell = so => { if (!so) return 'Full strength'; const det = so.detail || []; const dups = a => new Set(a.filter((l, i) => a.indexOf(l) !== i)); const dup = dups(det.map(d => d.last)); const ini = d => `${d.name[0]}. ${d.last}`; const dup2 = dups(det.filter(d => dup.has(d.last)).map(ini)); const lab = d => !dup.has(d.last) ? d.last : dup2.has(ini(d)) ? d.name : ini(d); return `${det.map(d => `${esc(lab(d))}${d.w < 1 ? '<i>?</i>' : ''}`).join(', ') || esc(so.name)}<small>${so.pts.toFixed(1)}</small>`; };
          if (f.soH || f.soA) push('Missing', soCell(f.soA), soCell(f.soH), cmp(f.soA ? f.soA.pts : 0, f.soH ? f.soH.pts : 0), 'names');
          const head = t => `<span class="wt" style="${tcv(V._.teamColor(t, L))}">${logo(t.logo, 's', V._.teamColor(t, L))}<b>${esc(t.abbr || t.short)}</b></span>`;
          const grid = `<div class="why"><div class="why-h"><span></span>${head(g.away)}${head(g.home)}</div>${rows.map(r => `<div class="why-r"><span>${r.label}</span><b class="${r.better < 0 ? 'up' : ''} ${r.cls}">${r.av}</b><b class="${r.better > 0 ? 'up' : ''} ${r.cls}">${r.hv}</b></div>`).join('')}</div>`;
          const lines = [];
          if (g.state === 'in') lines.push(['Score and time', `${esc((g.home.score > g.away.score ? g.home : g.away).short)} up ${Math.abs(g.home.score - g.away.score)}, ${esc(g.detail)}`]);
          lines.push(['Home court', g.neutral ? 'Neutral floor' : `${esc(g.home.short)} +${f.hca.toFixed(1)}`]);
          const byLine = m => `${esc((m >= 0 ? g.home : g.away).short)} by ${Math.abs(m).toFixed(1)}`;
          if (f.mkt != null) { lines.push(['Market line', `${byLine(f.mkt)}${f.odds && f.odds.total ? ` · total ${f.odds.total}` : ''}`]); lines.push(['RIVL alone', byLine(f.own)]); }
          lines.push([g.state === 'pre' ? 'Projected margin' : 'Pregame margin', byLine(f.margin)]);
          if (f.proj) lines.push([g.state === 'pre' ? 'Projected score' : 'Pregame projection', `${esc(g.away.abbr)} ${f.proj.away} · ${esc(g.home.abbr)} ${f.proj.home}`]);
          lines.push([g.state === 'pre' ? 'Win chance' : 'Pregame chance', `${esc(fav.short)} ${pct(p)}`]);
          const ratingNote = (f.source === 'elo' ? 'RIVL\'s rating is an Elo built from scoring margin, rebuilt every night.' : 'RIVL\'s rating is this season\'s scoring margin blended with last season\'s, weighted by games played.') + (f.soH || f.soA ? ' A missing player costs what he produces above his team\'s own bench, scaled by his minutes; a ? marks a status short of out, counted in part.' : '');
          const note = (f.mkt != null ? `The forecast starts from the market line and lets RIVL's rating, rest and injuries pull it (${Math.round((1 - f.w) * 100)}% RIVL). ` : '') + ratingNote + ` <a href="#record">How the calls have done</a>`;
          body += sec(g.state === 'post' ? `Had ${esc(fav.short)} ${pct(p)}` : `Why ${esc(fav.short)} ${pct(p)}`) + grid + `<table class="tbl kv why-kv"><tbody>${lines.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table><p class="why-n">${note}</p>`;
        }
        if (ta && th && g.state !== 'pre') { const rows = cmpRows(WANT.slice(0, 6)); if (rows) body += sec('Team stats', '', `<button data-act="gtab" data-tab="stats">All</button>`) + `<div class="cmp">${cmpHead}${rows}</div>`; }
        if (report) body += report;
        if (plays.length && g.state !== 'pre') body += sec(g.state === 'in' ? 'Last plays' : 'Final plays', '', `<button data-act="gtab" data-tab="plays">All plays</button>`) + `<div class="rows plays">${plays.map((p, i) => [p, i]).slice(-5).reverse().map(([p, i]) => playRow(p, i)).join('')}</div>`;
        if (series) body += series;
        if (g.state !== 'post') { const ws = watchFor(g, L); const list = ws.length ? ws.map(w => `<a class="row" href="${esc(w.href)}" target="_blank" rel="noopener"><span class="t"><b>${esc(w.label || w.short)}</b><span>${esc(w.bundle ? `Through ${w.bundle}` : tvLabel(g) || 'Opens in the app')}</span></span>${chev}</a>`).join('') : (tvLabel(g) ? `<div class="row"><span class="t"><b>${esc(tvLabel(g))}</b><span><a href="#settings/watch">Pick your services</a> to get a direct link here.</span></span></div>` : ''); if (list) body += sec('Where to watch') + `<div class="rows">${list}</div>`; }
        if (clips) body += clips;
        if (gi) body += gi;
      } else if (tab === 'box') {
        // tap a column to sort by it (most first, again for least); minutes is the order the feed gives
        const numOf = v => { const t = String(v ?? '').trim(); if (!t) return -Infinity; const m = /^([+-]?\d+(?:\.\d+)?)/.exec(t.replace(/^\+/, '')); return m ? parseFloat(m[1]) * (t.startsWith('-') && !t.startsWith('--') ? 1 : 1) : -Infinity; };
        const table = side => { const p = boxOf(side); const st0 = p && p.statistics && p.statistics[0]; if (!st0) return ''; const labels = st0.labels || []; const ath = st0.athletes || []; const rowOf = a => { const sn = a.athlete.shortName || a.athlete.displayName || ''; const nm = `<a href="${href.player(lk, a.athlete.id)}">${esc(sn.length > 15 ? V.lastName(a.athlete.displayName || sn) : sn)}</a>`; if (a.didNotPlay || !a.stats || !a.stats.length) return `<tr><td class="l">${nm}</td><td class="l mut" colspan="${labels.length}">${esc(a.reason || 'Did not play')}</td></tr>`; return `<tr${focus && String(a.athlete.id) === String(focus) ? ` class="hl" style="${tcv(V._.teamColor(side, L))}"` : ''}><td class="l">${nm}</td>${a.stats.map((v, i) => `<td${labels[i] === bv.col ? ' class="sorted"' : ''}>${esc(v)}</td>`).join('')}</tr>`; }; const mi = labels.indexOf('MIN'); const mins = a => mi >= 0 && a.stats && a.stats[mi] ? parseFloat(String(a.stats[mi]).replace(':', '.')) || 0 : 0; const played = a => !(a.didNotPlay || !a.stats || !a.stats.length || (mi >= 0 && !mins(a))); const ci = labels.indexOf(bv.col); const byCol = (x, y) => { if (ci < 0 || !x.stats || !y.stats) return mins(y) - mins(x); const d = numOf(y.stats[ci]) - numOf(x.stats[ci]); return (bv.dir === 'asc' ? -d : d) || mins(y) - mins(x); }; const st = ath.filter(a => a.starter).sort(byCol), bn = ath.filter(a => !a.starter && played(a)).sort(byCol), dnp = ath.filter(a => !a.starter && !played(a)); const tot = st0.totals && st0.totals.length ? `<tr class="tot"><td class="l">Team</td>${st0.totals.map(v => `<td><b>${esc(v)}</b></td>`).join('')}</tr>` : ''; const th = l => `<th${l === bv.col ? ' class="sorted"' : ''}><button data-act="bsort" data-col="${esc(l)}" aria-sort="${l === bv.col ? (bv.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(l)}${l === bv.col ? (bv.dir === 'asc' ? ' ▴' : ' ▾') : ''}</button></th>`; return sec(side.short) + `<div class="tw"><table class="tbl box"><thead><tr><th>Player</th>${labels.map(th).join('')}</tr></thead><tbody>${st.length ? `<tr class="sub"><td colspan="${labels.length + 1}">Starters</td></tr>${st.map(rowOf).join('')}` : ''}${bn.length ? `<tr class="sub"><td colspan="${labels.length + 1}">Bench</td></tr>${bn.map(rowOf).join('')}` : ''}${dnp.length ? `<tr class="sub"><td colspan="${labels.length + 1}">Did not play</td></tr>${dnp.map(a => `<tr class="dnp"><td class="l"><a href="${href.player(lk, a.athlete.id)}">${esc(a.athlete.shortName || a.athlete.displayName)}</a></td><td class="l mut" colspan="${labels.length}">${esc(a.reason || 'Did not play')}</td></tr>`).join('')}` : ''}${tot}</tbody></table></div>`; };
        let lead = '';
        if (focus) {
          for (const side of [g.away, g.home]) { const p = boxOf(side); const st0 = p && p.statistics && p.statistics[0]; const a = st0 && (st0.athletes || []).find(x => String(x.athlete.id) === String(focus)); if (!a) continue;
            const labels = st0.labels || [], descs = st0.descriptions || []; const get = l => { const k = labels.indexOf(l); return k >= 0 && a.stats ? a.stats[k] : ''; }; const tc = V._.teamColor(side, L);
            const big = [['PTS', 'Points'], ['REB', 'Rebounds'], ['AST', 'Assists']].map(([k, n]) => `<div><b>${esc(get(k) || '0')}</b><span>${n}</span></div>`).join('');
            const rest = a.stats && a.stats.length ? labels.map((l, i) => ['PTS', 'REB', 'AST'].includes(l) ? '' : `<span><b>${esc(a.stats[i])}</b>${esc(descs[i] || l)}</span>`).filter(Boolean).join('') : '';
            const pos = a.athlete.position && (a.athlete.position.abbreviation || a.athlete.position.name) || '';
            lead = `<div class="pfocus" style="${tcv(tc)}"><a class="who" href="${href.player(lk, a.athlete.id)}">${headshot(hsUrl(a.athlete), tc, 56, a.athlete.displayName)}<span class="t"><b>${esc(a.athlete.displayName || a.athlete.shortName || '')}</b><span>${esc([side.short, pos, a.athlete.jersey ? `No. ${a.athlete.jersey}` : ''].filter(Boolean).join(' · '))}${a.starter ? ' · Started' : ''}</span></span>${chev}</a>${a.didNotPlay || !a.stats || !a.stats.length ? `<p class="legend">${esc(a.reason || 'Did not play')}</p>` : `<div class="stats three">${big}</div><div class="pline">${rest}</div>`}</div>`;
            break; }
        }
        body = lead + ((table(g.away) + table(g.home)) || empty('No box score yet')) + unitsT;
      } else if (tab === 'plays') {
        if (!plays.length) body = empty('No plays yet');
        else {
          const periods = [...new Set(plays.map(p => p.period && p.period.number).filter(n => n != null))];
          const pname = n => n <= L.periods ? (L.periods === 2 ? (n === 1 ? '1st half' : '2nd half') : `Q${n}`) : (n - L.periods > 1 ? `OT${n - L.periods}` : 'OT');
          const pick = pv.q !== 'all' && periods.includes(pv.q) ? pv.q : 'all';
          // a player filter: everyone the plays name, from the box score's names, most involved first
          const pname2 = {}; bx.forEach(side => { const st0 = side.statistics && side.statistics[0]; (st0 && st0.athletes || []).forEach(a => { if (a.athlete) pname2[String(a.athlete.id)] = a.athlete.displayName || a.athlete.shortName || ''; }); });
          const involves = (p, pid) => (p.participants || []).some(x => x && x.athlete && String(x.athlete.id) === pid) || (pname2[pid] && String(p.text || '').includes(pname2[pid]));
          const counts = {}; plays.forEach(p => { (p.participants || []).forEach(x => { const id = x && x.athlete && String(x.athlete.id); if (id && pname2[id]) counts[id] = (counts[id] || 0) + 1; }); });
          const who = Object.entries(counts).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 12);
          const pid = pf.pid && pname2[pf.pid] ? pf.pid : '';
          const filt = plays.map((p, i) => [p, i]).filter(([p]) => (pick === 'all' || (p.period && p.period.number) === pick) && (!pv.scoring || p.scoringPlay) && (!pid || involves(p, pid)));
          const ctl = `<div class="chips pchips"><button class="chip${pick === 'all' ? ' on' : ''}" data-act="pq" data-q="all" aria-pressed="${pick === 'all'}">All</button>${periods.map(n => `<button class="chip${pick === n ? ' on' : ''}" data-act="pq" data-q="${n}" aria-pressed="${pick === n}">${pname(n)}</button>`).join('')}<button class="chip tog${pv.scoring ? ' on' : ''}" data-act="pscoring" aria-pressed="${!!pv.scoring}">Scoring only</button></div>` +
            (who.length ? `<div class="chips pchips pfchips">${who.map(([id, n]) => `<button class="chip${pid === id ? ' on' : ''}" data-act="pf" data-pid="${esc(id)}" aria-pressed="${pid === id}">${esc(V.lastName(pname2[id]))} <small>${n}</small></button>`).join('')}</div>` : '');
          const groups = []; filt.reverse().forEach(([p, i]) => { const k = p.period && p.period.number; const grp = groups[groups.length - 1]; if (!grp || grp.k !== k) groups.push({ k, label: p.period && p.period.displayValue || '', list: [[p, i]] }); else grp.list.push([p, i]); });
          const nRuns = [...runs.keys()].filter(i => filt.some(([, j]) => j === i)).length;
          body = lineScore + ctl + (groups.length ? groups.map(gr => sec(gr.label.replace(/(\d)(st|nd|rd|th) Quarter/, 'Quarter $1'), pick === 'all' && nRuns && gr === groups[0] ? `${runs.size} run${runs.size === 1 ? '' : 's'} of 8–0 or more marked` : '') + `<div class="rows plays">${gr.list.map(([p, i]) => playRow(p, i)).join('')}</div>`).join('') : empty(pid ? `Nothing for ${esc(V.lastName(pname2[pid]))} in that span` : 'No scoring plays in that span'));
        }
      } else if (tab === 'shots') {
        const teamOf = s => s.side === 'home' ? g.home : g.away;
        const pick = sv.team === 'home' || sv.team === 'away' ? sv.team : 'both';
        const pool = shots.filter(s => pick === 'both' || s.side === pick);
        // players with attempts on the chosen side, most attempts first
        const byP = new Map(); pool.forEach(s => { const k = s.pid || s.name; if (!k) return; const e = byP.get(k) || { k, name: s.name, n: 0, m: 0 }; e.n++; if (s.made) e.m++; byP.set(k, e); });
        const players = [...byP.values()].sort((a, b) => b.n - a.n).slice(0, 10);
        const who = sv.pid && byP.has(sv.pid) ? sv.pid : '';
        const list = who ? pool.filter(s => (s.pid || s.name) === who) : pool;
        const teamChips = `<div class="chips pchips">${[['both', 'Both'], ['away', g.away.abbr], ['home', g.home.abbr]].map(([k, l]) => `<button class="chip${pick === k ? ' on' : ''}" data-act="sv-team" data-team="${k}" aria-pressed="${pick === k}">${esc(l)}</button>`).join('')}</div>`;
        const playerChips = players.length > 1 ? `<div class="chips pchips">${[['', 'Everyone'], ...players.map(e => [e.k, `${V.lastName(e.name)} ${e.m}-${e.n}`])].map(([k, l]) => `<button class="chip${who === k ? ' on' : ''}" data-act="sv-pid" data-pid="${esc(k)}" aria-pressed="${who === k}">${esc(l)}</button>`).join('')}</div>` : '';
        const legend = `<div class="clegend">${(pick === 'both' ? [['a', g.away], ['h', g.home]] : [[pick === 'home' ? 'h' : 'a', teamOf({ side: pick })]]).map(([k, t]) => `<span><i style="background:var(--c${k})"></i>${esc(t.abbr)} made</span><span><i class="miss" style="border-color:var(--c${k})"></i>missed</span>`).join('')}</div>`;
        const sides = pick === 'both' ? [{ head: g.away.abbr, filter: s => s.side === 'away' }, { head: g.home.abbr, filter: s => s.side === 'home' }] : [{ head: who ? V.lastName(byP.get(who).name) : teamOf({ side: pick }).abbr }];
        const pair = V._.pairColors(L, g.away, g.home); const cv = [['a', pair[0]], ['h', pair[1]]].map(([k, c]) => `--c${k}-d:${esc(V._.lift(c))};--c${k}-l:${esc(V._.deep(c))}`).join(';');
        body = teamChips + playerChips + `<div class="chart" style="${cv}">${courtSvg(L, list, { colorOf: s => s.side === 'home' ? 'var(--ch)' : 'var(--ca)' })}${legend}</div>` + sec('By zone', `${list.length} shot${list.length === 1 ? '' : 's'}${g.state === 'in' ? ' so far' : ''}`) + zoneRows(list, sides) + `<p class="legend">Every field-goal attempt, where it was taken from. Free throws aren't on the chart.</p>`;
      } else if (tab === 'stats') {
        const rows = ta && th ? cmpRows(flat(ta).map(x => x.name).filter(n => get(th, n))) : '';
        body = rows ? `<div class="cmp" style="padding-top:6px">${cmpHead}${rows}</div>` : empty(g.state === 'pre' ? 'Stats arrive at tip-off' : 'No team stats yet');
      }
      const scrollY = window.scrollY;
      const side = t => ({ short: t.short, abbr: t.abbr, logo: t.logo, color: V._.teamColor(t), score: t.score, rec: t.rec || '' });
      const card = g.state === 'pre' ? null : { kind: 'game', away: side(g.away), home: side(g.home), status: g.state === 'post' ? finalWord(g) : g.detail, sub: tvLabel(g) || (d.gameInfo && d.gameInfo.venue && d.gameInfo.venue.fullName) || '', date: dayLabel(ymdOf(g.date), { weekday: 'long', month: 'long', day: 'numeric' }), note: f && prefs.get('forecast') ? `RIVL had ${(f.pHome >= .5 ? g.home : g.away).short} ${pct(Math.max(f.pHome, 1 - f.pHome))}` : '', title: `${g.away.short} ${g.away.score ?? ''}, ${g.home.short} ${g.home.score ?? ''}`, text: `${g.away.short} ${g.away.score ?? ''}, ${g.home.short} ${g.home.score ?? ''} · ${g.state === 'post' ? finalWord(g) : g.detail}`, file: `${g.away.abbr}-${g.home.abbr}-${ymdOf(g.date)}` };
      // the page is three parts: the head (bar + hero) changes only when the score does, the chips only toggle, the body swaps
      const headHtml = topbar(title, '#scores', '', card) + hero, hh = hashOf(headHtml), page = $main.querySelector('#gpage');
      if (page && page.dataset.gid === String(id)) {
        const head = page.querySelector('#ghead'); if (head.dataset.h !== hh) { head.innerHTML = headHtml; head.dataset.h = hh; }
        const tabsEl = page.querySelector('#gtabs'); if (tabsEl.dataset.k !== tabKey) { tabsEl.innerHTML = tabs; tabsEl.dataset.k = tabKey; }
        else tabsEl.querySelectorAll('.chip').forEach(c => { const on = c.dataset.tab === tab; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); c.setAttribute('aria-selected', String(on)); });
        const bodyEl = page.querySelector('#gbody'); if (bodyEl.dataset.h !== hashOf(body) || bodyEl.dataset.tab !== tab) { const tabChanged = bodyEl.dataset.tab !== tab; bodyEl.innerHTML = body; if (tabChanged && V.soft) V.soft(bodyEl); bodyEl.dataset.h = hashOf(body); bodyEl.dataset.tab = tab; }
      } else $main.innerHTML = `<div id="gpage" data-gid="${esc(String(id))}"><div id="ghead" data-h="${hh}">${headHtml}</div><div id="gtabs" data-k="${tabKey}">${tabs}</div><div id="gbody" data-tab="${tab}" data-h="${hashOf(body)}">${body}</div></div>`;
      document.title = `${g.tbd ? 'Teams to be decided' : `${g.away.short} at ${g.home.short}`} · RIVL`;
      return g;
    };
    const g = await paint();
    V.refresh = async () => { if (!g || g.state === 'post') return; await paint(15000); };
    if (V._gtabL) $main.removeEventListener('click', V._gtabL);
    V._gtabL = e => { const b = e.target.closest('[data-act="gtab"],[data-act="pq"],[data-act="pscoring"],[data-act="sv-team"],[data-act="sv-pid"],[data-act="bsort"],[data-act="pf"]'); if (!b) return; const a = b.dataset.act; if (a === 'gtab') tab = b.dataset.tab; else if (a === 'pq') pv.q = b.dataset.q === 'all' ? 'all' : +b.dataset.q; else if (a === 'pscoring') pv.scoring = !pv.scoring; else if (a === 'sv-team') { sv.team = b.dataset.team; sv.pid = ''; } else if (a === 'sv-pid') sv.pid = b.dataset.pid; else if (a === 'bsort') { const c = b.dataset.col; if (bv.col === c) { if (bv.dir === 'desc') bv.dir = 'asc'; else { bv.col = ''; bv.dir = 'desc'; } } else { bv.col = c; bv.dir = 'desc'; } } else if (a === 'pf') pf.pid = b.dataset.pid === pf.pid ? '' : b.dataset.pid; paint(); };
    $main.addEventListener('click', V._gtabL);
  }

  /* a player's shot chart over their last games: fetched when asked for, since it is five game summaries */
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act="pshots"]'); if (!b) return; e.preventDefault();
    const box = b.closest('.pshots'); const L = LEAGUES[b.dataset.lk]; const ids = (b.dataset.games || '').split(',').filter(Boolean); const pid = b.dataset.pid, nm = normName(b.dataset.name);
    if (!L || !ids.length) return;
    box.innerHTML = skeleton(1, 'card');
    const sums = await Promise.all(ids.map(id => jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, 6 * 3600000).catch(() => null)));
    let shots = [], games = 0, untrusted = 0;
    sums.forEach(d => { const hc = d && d.header && d.header.competitions && d.header.competitions[0]; if (!hc) return; const g = parseEvent({ id: '0', competitions: [hc], date: hc.date, status: hc.status }, L); const all = shotsOf(d.plays, g); if (!all.length) return; if (!shotsTrusted(all)) { untrusted++; return; } games++; shots = shots.concat(all.filter(s => (pid && s.pid === pid) || (!s.pid && normName(s.name) === nm))); });
    if (!shots.length) { box.innerHTML = empty(untrusted ? 'Shot locations look off for these games' : 'No shot locations yet', `<p style="margin:6px 0 0">${untrusted ? 'The feed\'s coordinates didn\'t match the distances it wrote, so nothing is drawn.' : 'ESPN marks shot locations once the play-by-play is in.'}</p>`); return; }
    const c = b.dataset.color || '#55606e';
    box.innerHTML = `<div class="chart" style="--ca-d:${esc(V._.lift(c))};--ca-l:${esc(V._.deep(c))}">${courtSvg(L, shots, { colorOf: () => 'var(--ca)' })}<div class="clegend"><span><i style="background:var(--ca)"></i>made</span><span><i class="miss" style="border-color:var(--ca)"></i>missed</span></div></div>` + zoneRows(shots, [{ head: `${games} game${games === 1 ? '' : 's'}` }]) + `<p class="legend">Every field-goal attempt over the last ${games} game${games === 1 ? '' : 's'} with play-by-play, where it was taken from.</p>`;
  });

  /* ================= ARTICLE READER ================= */
  const ALLOW = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'STRONG', 'B', 'EM', 'I', 'A', 'BR', 'FIGURE', 'FIGCAPTION', 'IMG']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'ASIDE', 'NAV', 'FORM', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'SVG', 'BUTTON', 'INPUT']);
  const WRAPS = new Set(['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'TABLE', 'TR', 'TD', 'TH', 'DL', 'DT', 'DD', 'PRE', 'H1', 'H5', 'H6', 'CENTER', 'SUMMARY', 'DETAILS']);
  /* ESPN links inside a story that have a screen here: players, teams, games and other stories stay in the app */
  const LG = { nba: 'nba', wnba: 'wnba', 'mens-college-basketball': 'ncaam', 'womens-college-basketball': 'ncaaw' };
  const ESPN_LINK = /^https?:\/\/(?:www\.)?espn\.com\/(nba|wnba|mens-college-basketball|womens-college-basketball)\/(player|team|game|recap|boxscore|story)\/_\/(id|name|gameId)\/([A-Za-z0-9]+)/i;
  function inApp(u, idxs) {
    const m = String(u || '').match(ESPN_LINK); if (!m) return null;
    const lk = LG[m[1].toLowerCase()], kind = m[2].toLowerCase(), key = m[3].toLowerCase(), v = m[4];
    if (kind === 'player' && key === 'id') return href.player(lk, v);
    if (kind === 'team') { if (key === 'id') return href.team(lk, v); const idx = idxs[lk] || {}; const t = Object.values(idx).find(t => (t.abbr || '').toLowerCase() === v.toLowerCase()); return t ? href.team(lk, t.id) : null; }
    if ((kind === 'game' || kind === 'recap' || kind === 'boxscore') && key === 'gameid') return href.game(lk, v);
    if (kind === 'story' && key === 'id') return `#article/${lk}/${v}`;
    return null;
  }
  function clean(html, idxs = {}) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html'); const root = doc.body.firstChild;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType !== 1) return;
        if (DROP.has(n.tagName) || /inline-?video|video-?container|ad-|promo/i.test(n.className || '')) { n.remove(); return; }
        walk(n);
        if (!ALLOW.has(n.tagName)) { if (WRAPS.has(n.tagName)) n.replaceWith(doc.createElement('br'), ...n.childNodes, doc.createElement('br')); else n.replaceWith(...n.childNodes); return; }   // a block wrapper's edges are paragraph edges; tidy turns the breaks into paragraphs
        [...n.attributes].forEach(a => { if (!((n.tagName === 'A' && a.name === 'href') || (n.tagName === 'IMG' && a.name === 'src'))) n.removeAttribute(a.name); });
        if (n.tagName === 'A') { const u = n.getAttribute('href') || ''; const here = inApp(u, idxs); if (here) n.setAttribute('href', here); else if (!/^https?:/i.test(u)) n.replaceWith(...n.childNodes); else { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener'); } }
        if (n.tagName === 'IMG') { const u = n.getAttribute('src') || ''; if (!/^https:/i.test(u)) n.remove(); else { n.setAttribute('loading', 'lazy'); n.setAttribute('alt', ''); } }
      });
    };
    walk(root);
    tidy(root, doc);
    return root.innerHTML.trim();
  }
  /* paragraphs, evenly: a story that arrives as one run of text (the wire previews and recaps — newlines lost, section labels
     run together) is broken on its newlines and its labels; stray text between blocks gets a paragraph; a line break run
     inside a paragraph is a paragraph break; empty paragraphs go. Nothing is reworded — only where the breaks fall. */
  const BLOCKS = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'BLOCKQUOTE', 'FIGURE']);
  const blank = s => !String(s == null ? '' : s).replace(/[\s ]/g, '');
  const LABEL = /(?:^|\s)((?:BOTTOM LINE|TOP PERFORMERS?|LAST 10 GAMES|INJURIES|UP NEXT|NEXT GAMES?|NEXT UP|KEY STATS?|TAKEAWAYS?|THE TAKEAWAY|WHAT'S NEXT|BIG PICTURE|STAT OF THE GAME|POLL IMPLICATIONS|KEY MATCHUP)):\s+(?=\S)/g;
  function tidy(root, doc) {
    const P = (nodes) => { const p = doc.createElement('p'); nodes.forEach(n => p.appendChild(n)); return p; };
    // 1. one run of text, no blocks at all: its newlines are the paragraphs
    if (![...root.children].some(c => BLOCKS.has(c.tagName))) {
      const parts = root.textContent.split(/\n\s*\n|\r?\n/).map(s => s.trim()).filter(Boolean);
      root.innerHTML = ''; parts.forEach(s => { const p = doc.createElement('p'); p.textContent = s; root.appendChild(p); });
    }
    // 2. text and inline elements lying between blocks become a paragraph of their own
    let run = [];
    const flush = (before) => { if (run.some(n => n.nodeType === 1 || !blank(n.textContent))) root.insertBefore(P(run), before); else run.forEach(n => n.remove()); run = []; };
    [...root.childNodes].forEach(n => { if (n.nodeType === 1 && (BLOCKS.has(n.tagName) || n.tagName === 'IMG')) flush(n); else if (n.nodeType === 1 && n.tagName === 'BR') { flush(n); n.remove(); } else run.push(n); });
    flush(null);
    // 3. a run of line breaks inside a paragraph is a paragraph break
    [...root.querySelectorAll('p')].forEach(p => {
      if (!p.querySelector('br')) return;
      const groups = [[]]; [...p.childNodes].forEach(n => { if (n.nodeType === 1 && n.tagName === 'BR') { if (groups[groups.length - 1].length) groups.push([]); } else groups[groups.length - 1].push(n); });
      const ps = groups.filter(g => g.some(n => n.nodeType === 1 || !blank(n.textContent))).map(P);
      ps.forEach(q => p.before(q)); p.remove();
    });
    // 4. the wire's section labels (BOTTOM LINE, TOP PERFORMERS, …) head their own paragraphs
    [...root.querySelectorAll('p')].forEach(p => {
      if (p.children.length && [...p.children].some(c => c.tagName !== 'STRONG' && c.tagName !== 'B')) return;   // only plain text paragraphs (links and the like stay as they are)
      const text = p.textContent; LABEL.lastIndex = 0; if (!LABEL.test(text)) return;
      const out = []; let last = 0; LABEL.lastIndex = 0; let m;
      while ((m = LABEL.exec(text))) { const before = text.slice(last, m.index).trim(); if (before) out.push(['p', before]); out.push(['h', m[1]]); last = m.index + m[0].length; }
      const rest = text.slice(last).trim(); if (rest) out.push(['p', rest]);
      out.forEach(([k, s]) => { const el = doc.createElement(k === 'h' ? 'h3' : 'p'); if (k === 'h') { el.className = 'lab'; el.textContent = s.charAt(0) + s.slice(1).toLowerCase(); } else el.textContent = s; p.before(el); });
      p.remove();
    });
    // 5. empty paragraphs go
    [...root.querySelectorAll('p')].forEach(p => { if (blank(p.textContent) && !p.querySelector('img')) p.remove(); });
  }
  async function articleV(lk, id) {
    const cached = S.news[id] || null;
    const webOf = a => a && a.links && a.links.web && a.links.web.href || `https://www.espn.com/${LEAGUES[lk].path.split('/')[1]}/story/_/id/${id}`;
    const bigIm = a => (a && a.images || []).filter(x => x && x.url).sort((x, y) => (y.width || 0) - (x.width || 0))[0];   // the largest the story carries: the lead runs the full column
    const head = (a) => { const im = bigIm(a); return `<article class="reader">${im && im.url ? `<img class="lead" src="${esc(im.url)}" alt="${esc(im.caption || '')}" onerror="this.remove()">` : ''}<h1>${esc(a && a.headline || '')}</h1><p class="by">${esc([a && a.byline, a && a.published ? new Date(a.published).toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: HW.TZ }) : ''].filter(Boolean).join(', '))}</p>`; };
    $main.innerHTML = topbar('', '#home') + (cached ? head(cached) + `<p class="dek">${esc(cached.description || '')}</p>` + skeleton(6, 'row') + '</article>' : skeleton(8, 'row'));
    const viaProxy = u => HW.WORKER && /^https:\/\/now\.core\.api\.espn\.com\/v1\//.test(u) ? u.replace('https://now.core.api.espn.com/v1/', HW.ESPN.now) : u;
    const api = viaProxy(cached && cached.links && cached.links.api && cached.links.api.news && cached.links.api.news.href || `${HW.ESPN.now}sports/news/${encodeURIComponent(id)}`);
    const full = await jSoft(api, 3600000);
    const h = full && (full.headlines && full.headlines[0] || full.article || full);
    const a = h && h.headline ? h : cached;
    if (!a) { $main.innerHTML = topbar('Story', '#home') + empty("Couldn't load this story", `<p style="margin:6px 0 0">The feed didn't answer.</p>`, `<a class="btn" href="${esc(webOf(cached))}" target="_blank" rel="noopener">Open on ESPN</a>`); return; }
    // team links in ESPN stories use the abbreviation, so load the index for any league the story links to
    const raw = h && h.story || '';
    const idxs = {}; await Promise.all([...new Set([...raw.matchAll(/espn\.com\/(nba|wnba|mens-college-basketball|womens-college-basketball)\/team\/_\/name\//gi)].map(x => LG[x[1].toLowerCase()]))].map(async k => { idxs[k] = await teamsIndex(LEAGUES[k]).catch(() => ({})); }));
    const story = raw ? clean(raw, idxs) : '';
    const vids = (h && (h.video || h.videos) || cached && (cached.video || cached.videos) || []).filter(v => v && v.links); vids.forEach(v => { if (v.id != null) S.videos[String(v.id)] = v; });
    const clips = vids.length ? sec('Clips') + `<div class="media">${vids.map(v => `<button class="clip" data-act="play" data-vid="${esc(String(v.id))}"><div class="th">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy">` : ''}<i><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg></i>${v.duration ? `<em>${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}</em>` : ''}</div><b>${esc(v.headline || v.title || '')}</b></button>`).join('')}</div>` : '';
    const premium = !story || (h && h.premium);
    const bodyHtml = story ? `<div class="body">${story}</div>` : `<p class="dek">${esc(a.description || cached && cached.description || '')}</p>`;
    // the whole story is here, so nothing points back to ESPN; only a paywalled or summary-only piece gets a way out
    const tail = premium ? `<div class="empty" style="margin-top:18px"><b>${story ? 'This is an ESPN+ story' : 'Full story is on ESPN'}</b><p style="margin:6px 0 0">${story ? 'The rest is behind their paywall.' : 'ESPN only shares the summary for this one.'}</p><a class="btn" style="margin-top:12px" href="${esc(webOf(a))}" target="_blank" rel="noopener">Continue on ESPN</a></div>` : '';
    $main.innerHTML = topbar('Story', '#home', '') + head(a) + bodyHtml + '</article>' + clips + tail;
    document.title = `${a.headline} · RIVL`;
  }

  /* ================= SEARCH ================= */
  async function searchV() {
    let lk = store.get('v5:lk', 'nba'); if (!LEAGUES[lk]) lk = 'nba';
    const recents = () => store.get('v5:recent', []) || [];
    const remember = x => { const a = recents().filter(r => !(r.kind === x.kind && r.id === x.id && r.lk === x.lk)); a.unshift(x); store.set('v5:recent', a.slice(0, 8)); };
    $main.innerHTML = topbar('Search', '#home', '', null, false) + `<div class="search" style="margin-top:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="sq" type="search" placeholder="Players and teams" autocomplete="off" aria-label="Search"><button class="clr" data-act="sclear" aria-label="Clear" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="chips" id="slk">${ORDER.map(k => `<button class="chip${k === lk ? ' on' : ''}" data-slk="${k}" aria-pressed="${k === lk}">${esc(LEAGUES[k].label)}</button>`).join('')}</div><div id="sres"></div>`;
    const inp = $main.querySelector('#sq'); inp.focus();
    const data = {};
    const load = async k => { if (data[k]) return data[k]; const L = LEAGUES[k]; const [lp, idx] = await Promise.all([L.sport === 'basketball' ? leaguePlayers(L).catch(() => null) : null, teamsIndex(L).catch(() => ({}))]); data[k] = { lp, idx }; return data[k]; };
    const teamRow = (L, t) => `<a class="row" href="${href.team(L.key, t.id)}" data-rec='${esc(JSON.stringify({ kind: 'team', id: String(t.id), lk: L.key, name: t.name || t.short, logo: t.logo || '' }))}'>${logo(t.logo, '', teamColor(t, L))}<span class="t"><b>${esc(t.name || t.short)}</b><span>${esc(L.label)}</span></span>${chev}</a>`;
    const playerRow = (L, p, sub) => `<a class="row" href="${href.player(L.key, p.id)}" data-rec='${esc(JSON.stringify({ kind: 'player', id: String(p.id), lk: L.key, name: p.name, img: p.img || '', team: p.team || '', teamId: p.teamId || '' }))}'>${headshot(p.img, playerColor(p, L), 46, p.name)}<span class="t"><b>${esc(p.name)}</b><span>${esc(sub || '')}</span></span>${chev}</a>`;
    const paint = async () => {
      const L = LEAGUES[lk]; const q = inp.value.trim().toLowerCase(); const out = $main.querySelector('#sres'); const clr = $main.querySelector('.clr'); if (clr) clr.hidden = !q;
      if (!q) {   // nothing typed: what you follow and what you looked up lately
        const F = favs.all(); const idx = (await load(lk)).idx; if (inp.value.trim()) return;
        const mine = (F[lk] || []).map(id => idx[String(id)]).filter(Boolean);
        const fp = fplayers.all().filter(p => p.lk === lk);
        const rec = recents().filter(r => r.lk === lk);
        out.innerHTML = (rec.length ? sec('Recent', '', `<button data-act="srecent-clear">Clear</button>`) + `<div class="rows">${rec.map(r => r.kind === 'team' ? teamRow(L, { id: r.id, name: r.name, logo: r.logo || (idx[r.id] || {}).logo }) : playerRow(L, r, r.team)).join('')}</div>` : '')
          + (mine.length ? sec('Your teams') + `<div class="rows">${mine.map(t => teamRow(L, t)).join('')}</div>` : '')
          + (fp.length ? sec('Your players') + `<div class="rows">${fp.map(p => playerRow(L, p, p.team)).join('')}</div>` : '')
          || empty('Search the ' + L.label, '<p style="margin:6px 0 0">Type a player or a team. Switch leagues above.</p>');
        return;
      }
      out.innerHTML = skeleton(3, 'row');
      const { lp, idx } = await load(lk); if (inp.value.trim().toLowerCase() !== q) return;
      const teams = Object.values(idx).filter(t => `${t.name} ${t.abbr} ${t.short}`.toLowerCase().includes(q)).slice(0, 6);
      const players = lp ? lp.rows.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 15) : [];
      out.innerHTML = (teams.length ? sec('Teams', `${teams.length}`) + `<div class="rows">${teams.map(t => teamRow(L, t)).join('')}</div>` : '')
        + (players.length ? sec('Players', `${players.length}`) + `<div class="rows">${players.map(p => { const t = idx[p.teamId] || {}; return playerRow(L, { ...p, team: t.short || p.team }, [t.short || p.team, p.pts != null ? `${(+p.pts).toFixed(1)} ppg` : ''].filter(Boolean).join(' · ')); }).join('')}</div>` : '')
        || empty('No matches', `<p style="margin:6px 0 0">Nothing in the ${esc(L.label)} for "${esc(inp.value.trim())}". ${lp ? '' : 'The player list is still loading.'}</p>`);
    };
    let t = null; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(paint, 90); });
    $main.addEventListener('click', e => {
      const lkB = e.target.closest('[data-slk]'); if (lkB) { lk = lkB.dataset.slk; $main.querySelectorAll('[data-slk]').forEach(b => { const on = b.dataset.slk === lk; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); paint(); return; }
      if (e.target.closest('[data-act="sclear"]')) { inp.value = ''; inp.focus(); paint(); return; }
      if (e.target.closest('[data-act="srecent-clear"]')) { store.set('v5:recent', []); paint(); return; }
      const row = e.target.closest('a.row[data-rec]'); if (row) { try { remember(JSON.parse(row.dataset.rec)); } catch { } }
    });
    paint();
  }

  /* ================= SETTINGS: what you follow, what Home shows, how it looks ================= */
  const PREFS = [
    ['wire', 'Breaking', "ESPN's news posts about your teams and players — a surgery, a trade, a benching — at the top of Home for a few hours after they land"],
    ['brief', 'Tonight and last night', "Your teams' games in one line, and last night's results with your players' lines"],
    ['live', 'Live now', 'A big card when one of your teams is playing'],
    ['teams', 'My teams', 'Record, the game that matters and the chance to win'],
    ['players', 'My players', 'Scoring lines, one tap to the profile'],
    ['injuries', 'Injuries', 'Reports on your teams and players'],
    ['news', 'News', 'Stories about your teams and players']
  ];
  const sw = (k, on, title, body) => `<button class="row sw" data-act="pref" data-pref="${k}" role="switch" aria-checked="${on}"><span class="t"><b>${esc(title)}</b><span class="wrap">${esc(body)}</span></span><span class="switch"></span></button>`;
  /* Settings is an index of categories; each opens its own screen at #settings/<category>. */
  const SETTINGS = [
    ['following', 'Following', 'Your teams and players, by league'],
    ['home', 'Home', 'What the Home screen shows'],
    ['look', 'Appearance', 'Theme and accent'],
    ['watch', 'Where you watch', 'Your TV and streaming services, for the watch links'],
    ['alerts', 'Alerts', 'Tip-off, close games, finals, injuries, breaking news'],
    ['sync', 'Sync', 'Carry your follows to another device'],
    ['app', 'App', 'Home screen, setup'],
    ['about', 'About', 'What RIVL is and where the numbers come from']
  ];
  const ICONS = {
    following: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/></svg>',
    look: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
    watch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12.5" rx="2.5"/><path d="M8 21h8M12 17.5V21"/></svg>',
    alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/></svg>',
    sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14.5 4.6M4 12a8 8 0 0 1 14.5-4.6M18 3v5h-5M6 21v-5h5"/></svg>',
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 18h4"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
  };
  async function settingsV(cat = '') {
    const P = prefs.all(); const theme = store.get('v5:theme', 'system'); const accent = store.get('v5:accent', 'mono');
    const F = favs.all(); const fp = fplayers.all();
    const here = SETTINGS.find(([k]) => k === cat);
    const bar = (title, backTo) => `<div class="topbar"><a class="ib" href="${backTo}" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><span class="ttl">${esc(title)}</span></div>`;
    const nTeams = ORDER.reduce((n, k) => n + (F[k] || []).length, 0);
    const standalone = V.standalone ? V.standalone() : false;

    if (!here) {   // the index
      const nSvc = HW.myServices().length;
      const summary = { watch: nSvc ? `${nSvc} service${nSvc === 1 ? '' : 's'}` : 'None picked yet', following: `${nTeams} team${nTeams === 1 ? '' : 's'} · ${fp.length} player${fp.length === 1 ? '' : 's'}`, home: `${PREFS.filter(([k]) => P[k] !== false).length} of ${PREFS.length} sections on`, look: `${({ system: 'Match my phone', dark: 'Dark', light: 'Light' })[theme] || 'Match my phone'} · ${V.ACCENTS && V.ACCENTS[accent] ? V.ACCENTS[accent][1] : 'black and white'}`, alerts: V.alerts && V.alerts.available() ? (V.alerts.on() ? 'On' : 'Off') : 'Needs the RIVL server', sync: V.sync && V.sync.available() ? (V.sync.code() ? `Code ${V.sync.code()}` : 'Not backed up') : 'Needs the RIVL server', app: standalone ? 'Installed' : 'Add to home screen', about: '' };
      $main.innerHTML = bar('Settings', '#home') + `<div class="rows setidx">${SETTINGS.map(([k, t, b]) => `<a class="row" href="#settings/${k}"><span class="sico">${ICONS[k]}</span><span class="t"><b>${esc(t)}</b><span>${esc(summary[k] || b)}</span></span>${chev}</a>`).join('')}</div>`;
      return;
    }

    let body = '';
    if (cat === 'following') {
      $main.innerHTML = bar('Following', '#settings') + skeleton(6, 'row');
      const leagues = ORDER.filter(k => (F[k] || []).length || fp.some(p => p.lk === k));
      const idxs = {}, sts = {}; await Promise.all(leagues.map(async k => { [idxs[k], sts[k]] = await Promise.all([teamsIndex(LEAGUES[k]).catch(() => ({})), standings(LEAGUES[k]).catch(() => null)]); }));
      const teamRow = (k, t) => { const r = sts[k] && sts[k].byId && sts[k].byId[String(t.id)]; return `<div class="row prow"><a class="go" href="${href.team(k, t.id)}">${logo(t.logo, '', teamColor(t, LEAGUES[k]))}</a><a class="t" href="${href.team(k, t.id)}"><b>${esc(t.name || t.short)}</b><span>${esc(r ? standingLine(r, LEAGUES[k]) : LEAGUES[k].label)}</span></a><button class="star on" data-act="fav" data-lk="${k}" data-id="${esc(t.id)}" data-name="${esc(t.short || t.name)}" aria-pressed="true" aria-label="Unfollow ${esc(t.name || '')}">${starSvg}</button></div>`; };
      const playerRow = p => `<div class="row prow"><a class="go" href="${href.player(p.lk, p.id)}">${headshot(p.img, playerColor(p, LEAGUES[p.lk]), 46, p.name)}</a><a class="t" href="${href.player(p.lk, p.id)}"><b>${esc(p.name)}</b><span>${esc(p.team || '')}</span></a><button class="star on" data-act="follow-player" data-snap='${esc(JSON.stringify(p))}' aria-pressed="true" aria-label="Unfollow ${esc(p.name)}">${starSvg}</button></div>`;
      // teams: a sub-label per league. Players: a band per team, under the league
      const teamsHtml = leagues.map(k => { const list = (F[k] || []).map(id => idxs[k][String(id)] || { id: String(id), name: 'Team', logo: '' }); return list.length ? `<div class="sub">${esc(LEAGUES[k].label)}<span>${list.length}</span></div>${list.map(t => teamRow(k, t)).join('')}` : ''; }).join('');
      const playersHtml = leagues.map(k => {
        const mine = fp.filter(p => p.lk === k); if (!mine.length) return '';
        const groups = new Map(); mine.forEach(p => { const key = p.teamId || p.team || '?'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(p); });
        const band = (key, list) => { const p0 = list[0]; const t = idxs[k][String(p0.teamId)] || Object.values(idxs[k]).find(x => [x.abbr, x.short, x.name].some(v => v && String(v).toLowerCase() === String(p0.team || '').toLowerCase())) || null; const name = t ? (t.name || t.short) : (p0.team || 'Team'); return `<div class="thead" style="${tcv(t ? teamColor(t, LEAGUES[k]) : playerColor(p0, LEAGUES[k]))}"><i class="bar"></i>${t && t.logo ? logo(t.logo, 's') : ''}<b>${esc(name)}</b><span class="n">${list.length}</span></div>${list.map(playerRow).join('')}`; };
        return `<div class="sub">${esc(LEAGUES[k].label)}<span>${mine.length}</span></div>${[...groups.entries()].map(([key, list]) => band(key, list)).join('')}`;
      }).join('');
      body = sec('Teams', `${nTeams}`, `<a href="#teams">Add</a>`) + (nTeams ? `<div class="rows">${teamsHtml}</div>` : empty('No teams yet', '', `<a class="btn" href="#teams">Choose teams</a>`)) +
        sec('Players', `${fp.length}`, `<a href="#players">Add</a>`) + (fp.length ? `<div class="rows">${playersHtml}</div>` : empty('No players yet', '', `<a class="btn" href="#players">Find players</a>`));
    } else if (cat === 'home') {
      body = sec('Home shows') + `<div class="rows">${PREFS.map(([k, t, b]) => sw(k, P[k] !== false, t, b)).join('')}</div>` +
        sec('Game cards') + `<div class="rows">${sw('forecast', P.forecast !== false, 'Win chances', "RIVL's own estimate on each game card and game page")}</div>`;
    } else if (cat === 'look') {
      body = sec('Theme') + `<div class="chips" role="radiogroup" aria-label="Theme">${[['system', 'Match my phone'], ['dark', 'Dark'], ['light', 'Light']].map(([k, l]) => `<button class="chip${theme === k ? ' on' : ''}" data-act="theme" data-theme="${k}" role="radio" aria-checked="${theme === k}">${l}</button>`).join('')}</div>` +
        sec('Accent') + `<div class="chips" role="radiogroup" aria-label="Accent">${[['mono', 'Black and white']].map(([k, l]) => `<button class="chip${accent === k || !(V.ACCENTS && V.ACCENTS[accent]) ? ' on' : ''}" data-act="accent" data-accent="${k}" role="radio" aria-checked="${accent === k || !(V.ACCENTS && V.ACCENTS[accent])}">${l}</button>`).join('')}</div><div class="swatches" role="radiogroup" aria-label="Accent colour">${Object.entries(V.ACCENTS || {}).map(([k, [c, l]]) => `<button class="swatch${accent === k ? ' on' : ''}" data-act="accent" data-accent="${k}" role="radio" aria-checked="${accent === k}" style="--sw:${c}" aria-label="${esc(l)}"><i></i><span>${esc(l)}</span></button>`).join('')}</div><p class="legend">The accent runs through the whole app: the league switcher, selected chips, the tab bar, buttons and the glow behind the wordmark.</p>`;
    } else if (cat === 'watch') {
      const mine = HW.myServices();
      body = (HW.SERVICE_GROUPS || []).map(gr => sec(gr.label) + `<div class="chips wrapchips" role="group" aria-label="${esc(gr.label)}">${gr.ids.filter(id => HW.SERVICES[id] && !['nfl', 'youtube', 'mlb'].includes(id)).map(id => `<button class="chip${mine.includes(id) ? ' on' : ''}" data-act="watch" data-id="${id}" aria-pressed="${mine.includes(id)}">${esc(HW.SERVICES[id].label)}</button>`).join('')}</div>`).join('') +
        `<p class="legend">A game's "Where to watch" lists your services first, with a link straight into each one${HW.IS_ANDROID ? ' (the app, when it\'s installed)' : ''}. Nothing here is shared.</p>`;
    } else if (cat === 'alerts') {
      body = (V.alerts && V.alerts.available() ? sec('Alerts') + `<div class="rows"><button class="row sw" data-act="alerts" role="switch" aria-checked="${V.alerts.on()}"><span class="t"><b>Alerts for my teams and players</b><span class="wrap">Tip-off, close games, finals, injury changes and breaking news; nothing else</span></span><span class="switch"></span></button>${V.alerts.on() ? [['pre', 'Tip-off', '20 minutes before your teams play'], ['close', 'Close games', 'Within 5 in the last 3 minutes'], ['final', 'Finals', 'The score when it ends'], ['inj', 'Injuries', 'Status changes for your players, and anyone newly out on your teams'], ['news', 'Breaking news', "ESPN's news posts about your teams and players, as they land"]].map(([k, t, b]) => `<button class="row sw" data-act="alert-pref" data-pref="${k}" role="switch" aria-checked="${V.alerts.prefs()[k] !== false}"><span class="t"><b>${esc(t)}</b><span class="wrap">${esc(b)}</span></span><span class="switch"></span></button>`).join('') + `<button class="row" data-act="alert-test"><span class="t"><b>Send a test alert</b></span>${chev}</button>` : ''}</div>${!V.alerts.on() && V.alerts.why ? (V.alerts.why() ? `<p class="legend warn">${esc(V.alerts.why())}</p>` : '') : ''}` : sec('Alerts') + empty('Alerts need the RIVL server', '<p style="margin:6px 0 0">Tip-off, close games, finals, injury changes and breaking news for your teams and players. Available once the server is deployed.</p>'));
    } else if (cat === 'sync') {
      body = sec('Sync') + (V.sync && V.sync.available() ? `<div class="rows"><button class="row" data-act="sync-up"><span class="t"><b>${V.sync.code() ? `Back up to code ${esc(V.sync.code())}` : 'Back up to a code'}</b><span class="wrap">Your teams, players and settings, so another device can pick them up</span></span>${chev}</button></div><div class="search" style="margin-top:6px"><input id="syncCode" type="text" placeholder="Enter a code from another device" autocomplete="off" autocapitalize="characters" maxlength="6" aria-label="Sync code"></div><div class="rows"><button class="row" data-act="sync-down"><span class="t"><b>Restore from that code</b><span class="wrap">Replaces what's followed on this device</span></span>${chev}</button></div>` : empty('Sync needs the RIVL server', '<p style="margin:6px 0 0">Carry your teams and players to another phone or laptop with a six-character code.</p>'));
    } else if (cat === 'app') {
      body = sec('App') + `<div class="rows">${standalone ? '' : `<button class="row" data-act="install"><span class="t"><b>Add to home screen</b><span class="wrap">Opens full screen like an app, your teams first</span></span>${chev}</button>`}<button class="row" data-act="onb-restart"><span class="t"><b>Run setup again</b><span class="wrap">Pick teams and players from the start</span></span>${chev}</button></div>`;
    } else if (cat === 'about') {
      body = sec('Model') + `<div class="rows"><a class="row" href="#record"><span class="t"><b>How the calls have done</b><span class="wrap">Every pregame chance, scored against the result, next to ESPN and the market</span></span>${chev}</a></div>` + sec('About') + `<p class="foot about">RIVL is a personal fan project. Team names and logos belong to the leagues and their teams. Scores, stats and injury reports come from the leagues' public feeds. Win chances are RIVL's own estimate, not betting advice. All times Central.</p>`;
    }
    $main.innerHTML = bar(here[1], '#settings') + body;
    if (V._settingsL) { $main.removeEventListener('rivl:fav', V._settingsL); $main.removeEventListener('rivl:follow', V._settingsL); }
    V._settingsL = () => { if ((location.hash || '').startsWith('#settings')) settingsV(cat); };
    $main.addEventListener('rivl:fav', V._settingsL); $main.addEventListener('rivl:follow', V._settingsL);
  }


  /* ================= RECORD: how the calls have done, scored honestly against ESPN and the market ================= */
  async function recordV(lk) {
    const L = LEAGUES[lk] || LEAGUES.nba; lk = L.key;
    $main.innerHTML = topbar('Record', '#settings/about', '', null, false) + skeleton(6, 'row');
    const d = await HW.record(L).catch(() => null);
    const games = d && Array.isArray(d.games) ? d.games.filter(g => g.hs != null && g.as != null && g.p != null) : [];
    const lkChips = `<div class="chips" role="tablist">${ORDER.map(k => `<a class="chip${k === lk ? ' on' : ''}" role="tab" href="#record/${k}" aria-selected="${k === lk}" aria-pressed="${k === lk}">${esc(LEAGUES[k].label)}</a>`).join('')}</div>`;
    if (!games.length) { $main.innerHTML = topbar('Record', '#settings/about', '', null, false) + lkChips + empty('No scored games yet', `<p style="margin:6px 0 0">The nightly job scores every pregame call once the game is final. ${d ? 'Nothing is final for the ' + esc(L.label) + ' yet.' : 'The record file has not been published for the ' + esc(L.label) + '.'}</p>`); return; }
    // the market's own chance from its line, on the same curve as the model; ESPN's as published
    const sd = L.sd || 12;
    const lineP = g => { const m = String(g.line || '').match(/^([A-Z]{2,5})\s*([+-]?\d+(?:\.\d+)?)$/i); if (!m) return null; const pts = Math.abs(parseFloat(m[2])); const homeFav = m[1].toUpperCase() === String(g.h || '').toUpperCase(); return HW.Phi((homeFav ? pts : -pts) / sd); };
    const score = (rows, f) => { let n = 0, bs = 0, hit = 0; rows.forEach(g => { const p = f(g); if (p == null) return; const y = g.hs > g.as ? 1 : 0; n++; bs += (p - y) * (p - y); hit += ((p >= .5) === (y === 1)) ? 1 : 0; }); return n ? { n, brier: bs / n, hit: hit / n } : null; };
    // the blend the app actually shows: the market line pulled by RIVL's own pregame margin (the nightly keeps that margin with each call)
    const params = await HW.params(L).catch(() => null); const w = params && params.mkt != null ? params.mkt : 0.6;
    const spreadOf = g => { const m = String(g.line || '').match(/^([A-Z]{2,5})\s*([+-]?\d+(?:\.\d+)?)$/i); if (!m) return null; const pts = Math.abs(parseFloat(m[2])); return m[1].toUpperCase() === String(g.h || '').toUpperCase() ? pts : -pts; };
    const blendP = g => { const mk = spreadOf(g); if (mk == null || g.m == null) return null; return HW.calibrate(HW.Phi((w * mk + (1 - w) * g.m) / sd), params && params.calib ? params.calib : null); };
    const anyBlend = games.some(g => blendP(g) != null);
    const cols = anyBlend ? [['RIVL', g => g.p], ['Blend', blendP], ['ESPN', g => g.ep != null ? g.ep : null], ['Market', lineP]] : [['RIVL', g => g.p], ['ESPN', g => g.ep != null ? g.ep : null], ['Market', lineP]];
    const since = days => { const cut = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); return games.filter(g => g.date >= cut); };
    const spans = [['Season', games], ['Last 30 days', since(30)], ['Last 7 days', since(7)]];
    const fmt = x => x == null ? '—' : x.toFixed(3);
    const pctf = x => x == null ? '—' : Math.round(x * 100) + '%';
    const table = (title, rows) => { const sc = cols.map(([k, f]) => [k, score(rows, f)]); const best = sc.filter(([, x]) => x).sort((a, b) => a[1].brier - b[1].brier)[0]; return sec(title, `${rows.length} game${rows.length === 1 ? '' : 's'}`) + `<div class="why"><div class="why-h why3 why-n${cols.length}"><span></span>${sc.map(([k]) => `<span class="wt"><b>${k}</b></span>`).join('')}</div><div class="why-r why3 why-n${cols.length}"><span>Brier score</span>${sc.map(([k, x]) => `<b class="${best && best[0] === k ? 'up' : ''}">${fmt(x && x.brier)}</b>`).join('')}</div><div class="why-r why3 why-n${cols.length}"><span>Right side</span>${sc.map(([k, x]) => `<b class="${best && best[0] === k ? 'up' : ''}">${pctf(x && x.hit)}</b>`).join('')}</div><div class="why-r why3 why-n${cols.length}"><span>Scored</span>${sc.map(([, x]) => `<b>${x ? x.n : '—'}</b>`).join('')}</div></div>`; };
    const recent = games.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12);
    const list = sec('Latest calls') + `<div class="rows">${recent.map(g => { const homeWon = g.hs > g.as; const pick = g.p >= .5 ? g.h : g.a; const hit = (g.p >= .5) === homeWon; const conf = Math.round(Math.max(g.p, 1 - g.p) * 100); return `<a class="row" href="${href.game(lk, g.id)}"><span class="t"><b>${esc(g.a)} ${g.as} at ${esc(g.h)} ${g.hs}</b><span>${esc(dayLabel(g.date, { weekday: 'short', month: 'short', day: 'numeric' }))} · RIVL had ${esc(pick)} ${conf}%${g.line ? ` · line ${esc(g.line)}` : ''}</span></span><span class="res ${hit ? 'w' : 'l'}">${hit ? 'Hit' : 'Miss'}</span></a>`; }).join('')}</div>`;
    $main.innerHTML = topbar('Record', '#settings/about', '', null, false) + lkChips + spans.map(([t, rows]) => rows.length ? table(t, rows) : '').join('') + list +
      `<p class="legend">Brier score is the squared error of the chance given to the home team, averaged: 0 is perfect, 0.25 is a coin flip, lower is better. The market's chance is read off the closing line on the same curve the model uses. ${anyBlend ? 'Blend is what the game pages show: the line pulled by RIVL\'s own pregame margin, scored from the same two numbers. ' : ''}ESPN's is their published pregame number. Every call is the one made before tip-off and never revised. The injury adjustment isn't scored: the lists aren't kept game by game.</p>`;
  }

  Object.assign(V, { record: recordV, standings: standingsV, teams: teamsV, team: teamV, game: gameV, venue: venueV, article: articleV, search: searchV, settings: settingsV });
})();
