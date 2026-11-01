/* RIVL v5 — the rest of the screens: standings, teams, team, game, article reader, search.
   Loaded after views.js; shares its helpers through HW.v5. */
(() => {
  const J = (n, f) => HW.perf ? HW.perf.job(n, f) : f();
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
    { const pg = $main.querySelector('#stpage'); if (!pg || pg.dataset.lk !== lk) $main.innerHTML = skeleton(10, 'row'); }   // the league's table already up stays up while fresh numbers load
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
    /* On a phone the table has to fit without sideways scrolling: seven stat columns pushed GB under the card's rounded
       edge and left it cut mid-glyph, and once a tiebreak note widened the pinned team column to the full screen, the
       scrolling cells slid under it and nothing could be read. The phone shows the four that matter; the wide screen
       shows all seven. */
    const narrow = window.matchMedia && matchMedia('(max-width:1039px)').matches;
    const cols = conf ? (narrow ? ['Conf', 'W', 'L', 'Strk'] : ['Conf', 'W', 'L', 'Diff', 'Strk']) : (narrow ? ['W', 'L', 'Pct', 'GB'] : ['W', 'L', 'Pct', 'GB', 'Diff', 'L10', 'Strk']);
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
    const trs = rows.map((r, i) => { const gl = [gbLine(r, i), tieNote(r, i)].filter(Boolean).join(' · '); const tc = teamColor({ id: r.id, abbr: r.abbr }, L); return `<tr class="click${favs.has(lk, r.id) ? ' me' : ''}${cuts.includes(i + 1) ? ' cut' : ''}" data-href="${href.team(lk, r.id)}" style="${tcv(tc)}"><td><span class="tm"><span class="rk">${r.pos}</span>${logo(r.logo, 's', tc)}<span class="nm"><a href="${href.team(lk, r.id)}">${rk && rk[r.id] ? `<i class="ap">${rk[r.id]}</i>` : ''}${esc(r.short || r.name)}</a>${clinchTag(r)}${gl ? `<small>${esc(gl)}</small>` : ''}</span></span></td>${cols.map(c => `<td>${cell(r, c)}</td>`).join('')}</tr>`; }).join('');
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
    const table = ([name, abbrs]) => { const order = abbrs.slice().sort(cmp); return sec(name) + `<div class="tw"><table class="tbl stand cup"><thead><tr><th>${esc(name.split(' ')[0])}</th><th>W-L</th><th>Diff</th><th>PF</th></tr></thead><tbody>${order.map((a, i) => { const r = byAbbr[a]; const R = get(a); const nx = nextOf(a); const tc = r ? teamColor({ id: r.id, abbr: r.abbr }, L) : ''; return `<tr class="click${r && favs.has(lk, r.id) ? ' me' : ''}${i === 0 ? ' cut' : ''}"${r ? ` data-href="${href.team(lk, r.id)}"` : ''}${tc ? ` style="${tcv(tc)}"` : ''}><td><span class="tm"><span class="rk">${i + 1}</span>${r ? logo(r.logo, 's', tc) : ''}<span class="nm">${r ? `<a href="${href.team(lk, r.id)}">${esc(r.short || r.name)}</a>` : esc(a)}${nx ? `<small>${esc(nx)}</small>` : ''}</span></span></td><td>${R.w}-${R.l}</td><td><span class="${R.pf - R.pa > 0 ? 'pos' : R.pf - R.pa < 0 ? 'neg' : ''}">${R.w + R.l ? sg(R.pf - R.pa) : '–'}</span></td><td>${R.pf || '–'}</td></tr>`; }).join('')}</tbody></table></div>`; };
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
    const table = `<div class="tw"><table class="tbl stand odds tstat"><thead><tr><th>${esc(L.label)}</th>${cols.map(([h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(({ r, t }, i) => { const tc = teamColor({ id: r.id, abbr: r.abbr }, L); return `<tr class="click${favs.has(lk, r.id) ? ' me' : ''}" data-href="${href.team(lk, r.id)}" style="${tcv(tc)}"><td><span class="tm"><span class="rk">${i + 1}</span>${logo(r.logo, 's', tc)}<span class="nm"><a href="${href.team(lk, r.id)}">${esc(r.short || r.name)}</a><small>${r.w}-${r.l}</small></span></span></td>${cols.map(([, f]) => `<td>${f(t)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
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
  const stPaint = (items, tab, body) => J('standings:paint', () => stPaint0(items, tab, body));
  function stPaint0(items, tab, body) {
    const page = $main.querySelector('#stpage');
    if (page && page.dataset.lk === (V.route && V.route() || {}).lk) {
      const have = [...page.querySelectorAll('#stchips .chip')].map(c => c.dataset.tab).join();
      if (have !== items.map(([k]) => k).join()) page.querySelector('#stchips').innerHTML = chips(items, tab, 'stab', 'tab');
      else page.querySelectorAll('#stchips .chip').forEach(c => { const on = c.dataset.tab === tab; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); c.setAttribute('aria-selected', String(on)); });
      const sb = page.querySelector('#stbody'); if (V._.patch) V._.patch(sb, body); else sb.innerHTML = body; if (V.soft) V.soft(sb);
    } else $main.innerHTML = `<div id="stpage" data-lk="${esc((V.route && V.route() || {}).lk || '')}"><div id="stchips">${chips(items, tab, 'stab', 'tab')}</div><div id="stbody">${body}</div></div>`;
    const on = $main.querySelector('#stchips .chip.on'); if (on) V._.centerX(on);
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
        el.innerHTML = sec('Following', `${mine.length}`, mine.length > 1 ? `<button data-act="torder" aria-pressed="${ordering}">${ordering ? 'Done' : 'Reorder'}</button>` : '') + `<div class="rows${ordering ? ' ordering' : ''}" data-order="teams">${mine.map(r => { const g = byTeam.get(String(r.id)); const today = g ? todayLine(g, r) : ''; const body = `<span class="t"><b>${esc(r.name || r.short)}</b><span>${esc(standingLine(r, L) || '')}${today ? `<em class="today">${today}</em>` : ''}</span></span>`; return ordering ? `<div class="row prow ordrow" data-oid="${esc(r.id)}" style="${tcv(teamColor({ id: r.id, abbr: r.abbr }, L))}"><span class="go">${logo(r.logo, '', teamColor({ id: r.id, abbr: r.abbr }, L))}</span>${body}${V._.orderTools}</div>` : `<div class="row prow${g && g.state === 'in' ? ' now' : ''}" style="${tcv(teamColor({ id: r.id, abbr: r.abbr }, L))}"><a class="go" href="${href.team(lk, r.id)}" aria-label="${esc(r.name)}">${logo(r.logo, '', teamColor({ id: r.id, abbr: r.abbr }, L))}</a><a class="t" href="${href.team(lk, r.id)}">${body.replace(/^<span class="t">|<\/span>$/g, '')}</a><button class="star on" data-act="fav" data-lk="${lk}" data-id="${esc(r.id)}" aria-pressed="true" aria-label="Unfollow ${esc(r.name)}">${starSvg}</button></div>`; }).join('')}</div>`;
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
        return `<button class="thead conf" data-act="tfold" data-key="${esc(g.full)}" aria-expanded="${!folded}"><i class="bar"></i><b>${esc(g.name)}</b><span class="n">${rows.length}</span>${chev}</button><div class="fold${folded ? ' closed' : ''}"><div class="rows">${rows.map(r => { const on = favs.has(lk, r.id); const g = byTeam.get(String(r.id)); const today = g ? todayLine(g, r) : ''; return `<div class="row prow${g && g.state === 'in' ? ' now' : ''}" style="${tcv(teamColor({ id: r.id, abbr: r.abbr }, L))}"><a class="go" href="${href.team(lk, r.id)}" aria-label="${esc(r.name)}">${logo(r.logo, '', teamColor({ id: r.id, abbr: r.abbr }, L))}</a><a class="t" href="${href.team(lk, r.id)}"><b>${esc(r.name || r.short)}</b><span>${esc(standingLine(r, L) || '')}${today ? `<em class="today">${today}</em>` : ''}</span></a><button class="star${on ? ' on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(r.name)}">${on ? starSvg : starLine}</button></div>`; }).join('')}</div></div>`;
      }).filter(Boolean).join('');
      const el = $main.querySelector('#tlist'); if (el) el.innerHTML = blocks || empty(tab === 'following' ? 'No followed teams yet' : 'No team matches', tab === 'following' ? '<p style="margin:6px 0 0">Tap the star on any team to follow it.</p>' : '');
    };
    $main.innerHTML = `<div class="stbar edbar"><a class="gxib stback" href="#home" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><h1>Teams</h1></div><div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="tq" type="search" placeholder="Search teams" value="${esc(q0)}" autocomplete="off" aria-label="Search teams"></div>` + chips([['all', 'All'], ['following', 'Following']], tab0, 'ttab', 'tab') + `<div id="tlist"></div>`;
    paint();
    const inp = $main.querySelector('#tq'); let t = null;
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { store.set('v5:tq', inp.value); paint(); }, 120); });
    /* $main outlives this screen, so handlers added here on every visit used to pile up: the second visit had two fold
       handlers that undid each other, which is why East and West would not open or close. One handler, swapped per visit. */
    if ($main._tvClick) $main.removeEventListener('click', $main._tvClick);
    if ($main._tvFav) $main.removeEventListener('rivl:fav', $main._tvFav);
    $main._tvClick = e => {
      if (!$main.querySelector('#tlist')) return;
      let b = e.target.closest('[data-act="ttab"]');
      if (b) { store.set('v5:ttab', b.dataset.tab); $main.querySelectorAll('[data-act="ttab"]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); paint(); return; }
      b = e.target.closest('[data-act="torder"]'); if (b) { e.preventDefault(); ordering = !ordering; paint(); return; }
      b = e.target.closest('[data-act="tfold"]'); if (b) { e.preventDefault(); const f = store.get('v5:tcol:' + lk, {}) || {}; const k = b.dataset.key; if (f[k]) delete f[k]; else f[k] = 1; store.set('v5:tcol:' + lk, f); V._.foldToggle(b, !f[k]); }
    };
    $main._tvFav = paint;
    $main.addEventListener('click', $main._tvClick);
    $main.addEventListener('rivl:fav', $main._tvFav);
    const onPoll = () => { if (!$main.querySelector('#tlist')) { document.removeEventListener('rivl:polled', onPoll); return; } byTeam.clear(); (S.today[lk] || []).forEach(g => { byTeam.set(g.home.id, g); byTeam.set(g.away.id, g); }); if ((S.today[lk] || []).some(isLive)) paint(); };
    document.addEventListener('rivl:polled', onPoll);
  }

  /* ================= TEAM ================= */
  async function teamV(lk, id) {
    const L = LEAGUES[lk]; if (!L || !id) { $main.innerHTML = empty('Team not found'); return; }
    if (!$main.querySelector(`#gpage[data-pid="team:${CSS.escape(String(id))}"]`)) {
      /* the page opens at once with what is already known about the team (name, crest, colour, from the league list), the
         numbers filling in underneath; only a team the app has never listed starts from a bare skeleton */
      const kn = V._.teamNow && V._.teamNow(L, id);
      if (kn && (kn.short || kn.name)) {
        const tid = String(id), tname = kn.short || kn.name; const color = teamColor({ id: tid, abbr: kn.abbr, color: kn.color }, L); V._.tint(color);
        const alt = V._.teamAlt ? V._.teamAlt({ id: tid, abbr: kn.abbr, alt: kn.alt }, L) : ''; const c2 = alt && alt.toLowerCase() !== String(color).toLowerCase() ? alt : V._.deep(color);
        const lg = kn.logo || HW.logoUrl(L, kn.abbr); const on = favs.has(lk, id);
        const inner = `<div class="tmhead">${V._.imgSized(lg, 160, 160, 'class="tmcrest"')}<div><p class="tmlg">${esc(L.label)}</p><h1>${esc(tname)}</h1><p class="tmsen"></p><button class="flw${on ? ' on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(tid)}" data-name="${esc(tname)}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(tname)}">${window.RIVL_flw ? window.RIVL_flw(on, 'team') : (on ? 'Following' : 'Follow team')}</button></div></div>`;
        const bar = `<a class="gxib" href="#teams" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><div class="gxmid2"><div class="gxctr" id="gxmini"><span class="gxmn">${lg ? V._.imgSized(lg, 64, 64, 'class="tmmini"') : ''}<b>${esc(tname)}</b></span></div></div><span class="gxib ghost" aria-hidden="true"></span>`;
        const tkey = `tm:${lk}:${tid}`; let ttab = (() => { try { return localStorage.getItem(tkey) || 'overview'; } catch { return 'overview'; } })(); if (!['overview', 'schedule', 'roster', 'stats'].includes(ttab)) ttab = 'overview';
        const sk = skeleton(1, 'card') + skeleton(4, 'row');
        V._.heroShell({ pid: `team:${tid}`, cls: '', color, c2, inner, bar, act: 'ttab', attr: 'data-tp', tab: ttab, tabs: [['overview', 'Overview'], ['schedule', 'Schedule'], ['roster', 'Roster'], ['stats', 'Stats']], panels: { overview: sk, schedule: sk, roster: sk, stats: sk } });
      } else $main.innerHTML = topbar('') + skeleton(1, 'card') + skeleton(6, 'row');
    }
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
    const splits = r ? [['Home', r.home, 'HOME'], ['Road', r.road, 'ROAD'], ['Last 10', r.l10, 'LAST 10'], ['Streak', r.strk, 'STREAK'], [L.standingsMode === 'conferences' ? 'In conf' : 'vs conf', r.conf, 'CONF']].filter(([, x, k]) => x && !shown.has(k)) : [];
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
    /* ---- v7's team page: the team's colour pinned behind a short head; the page slides up over it in four tabs ---- */
    const tid = String(id), tname = t0.shortDisplayName || t0.name || t0.displayName || '';
    const alt = V._.teamAlt ? V._.teamAlt({ id: tid, abbr: t0.abbreviation, color: t0.color, alt: t0.alternateColor }, L) : '';
    const c2 = alt && alt.toLowerCase() !== String(color).toLowerCase() ? alt : V._.deep(color);
    const sentence = r ? `The ${esc(t0.name || tname)} ${/s$/i.test(t0.name || '') ? 'are' : 'is'} ${r.w}-${r.l}${L.standingsMode !== 'conferences' && r.pos ? `, ${ordinal(r.pos)} in the ${esc(confName(r.group, r.groupAbbr))}` : r.group ? `, ${esc(r.group)}` : ''}.` : esc(t0.standingSummary || '');
    const star = on ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`;
    const crSm = src => `<span class="gxcr">${src ? V._.imgSized(src, 96, 96) : ''}</span>`;
    const opp = g => { const home = g.home.id === tid; return { home, me: home ? g.home : g.away, op: home ? g.away : g.home }; };
    const when = g => { const d = ymdOf(g.date), t = todayCT(); const n = Math.round((new Date(d + 'T12:00:00Z') - new Date(t + 'T12:00:00Z')) / 864e5); if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday'; if (Math.abs(n) < 7) return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }); return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
    /* a game, as v7's plate: both crests and names, the scores, the clock or the time between them */
    const gamePlate = (g) => { if (!g) return ''; const f = safeF(L, g, ctx); const pre = g.state === 'pre' || g.away.score == null; const aL = +g.away.score > +g.home.score, hL = +g.home.score > +g.away.score;
      const mid = g.state === 'in' ? `<span class="tpill on"><i></i>${esc(gxDet(g, L))}</span>` : g.state === 'post' ? `<span class="tpill">${esc(finalWord(g))}</span>` : `<span class="tpill">${esc(tipOf(g))}</span>`;
      const pr = f && !g.off && g.state !== 'post' ? `<small>${esc((f.pHome >= .5 ? g.home : g.away).abbr)} ${pct(Math.max(f.pHome, 1 - f.pHome))}</small>` : '';
      const side = (t, lead) => `<span class="ts"><span class="tl">${t.logo ? V._.imgSized(t.logo, 128, 128) : ''}</span><em>${esc(t.short)}</em></span>`;
      const sc = (t, lead) => pre ? `<b class="sc rec">${esc(t.rec || '')}</b>` : `<b class="sc${lead ? '' : ' tr'}">${t.score}</b>`;
      return `<a class="gxplate tgm" href="${href.game(lk, g.id)}">${side(g.away)}${sc(g.away, aL)}<span class="mid">${mid}${pr}</span>${sc(g.home, hL)}${side(g.home)}</a>`; };
    const doneG = evs.filter(isDone), lastG = doneG[doneG.length - 1];
    const today = next && (next.state === 'in' || ymdOf(next.date) === todayCT()) ? next : null;
    const nextUp = !today && next ? next : null;
    // players: by scoring, as rows
    const posWord2 = p => ({ G: 'Guard', F: 'Forward', C: 'Center', 'G-F': 'Guard', 'F-G': 'Forward', 'F-C': 'Forward', 'C-F': 'Center', PG: 'Guard', SG: 'Guard', SF: 'Forward', PF: 'Forward' }[p] || '');
    const pRow = a => { const p = ppg[a.id]; const pos = a.position && a.position.abbreviation; return `<a class="frow" href="${href.player(lk, a.id)}"><span class="fface">${headshot(hsUrl(a), color, 44, a.displayName)}</span><span class="nm"><b>${esc(a.displayName)}</b><small>${esc([posWord(pos), a.jersey ? `No. ${a.jersey}` : ''].filter(Boolean).join(' · '))}</small></span><span class="fs">${p && p.pts != null ? `<span class="sl"><b>${(+p.pts).toFixed(1)}</b></span><em>ppg</em>` : ''}</span></a>`; };
    /* roster cards, after the MLS app: a tall card in the team's colour with the crest faint behind the player's photo,
       the name and position over a dark fade at the bottom, scoring and any injury in small tags at the top. */
    const ilBy = {}; il.forEach(x => { const aid = athId(x.athlete || {}); if (aid) ilBy[aid] = x.status || ''; });
    const altC = V._.teamAlt({ id: String(id), alt: t0.alternateColor }, L) || color;
    const rCard = a => { const p = ppg[a.id]; const pos = posWord(a.position && a.position.abbreviation); const hs = hsUrl(a); const ij = ilBy[String(a.id)]; const ijc = ij ? (/out/i.test(ij) ? 'out' : 'q') : '';
      const nm = a.shortName || ((n => n.length > 1 ? `${n[0][0]}. ${n.slice(1).join(' ')}` : n.join(' '))((a.displayName || '').split(/\s+/))); const ini = (a.displayName || '').split(/\s+/).map(w => w[0] || '').slice(0, 2).join('');
      return `<a class="rcard" href="${href.player(lk, a.id)}" style="--rc:${esc(color)};--rc2:${esc(altC)}">${lg ? `<img class="rwm" src="${esc(lg)}" alt="" loading="lazy" decoding="async">` : ''}${hs ? `<img class="rhs" src="${esc(hs)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : `<b class="rini">${esc(ini)}</b>`}<span class="rtop">${p && p.pts != null ? `<i class="rppg">${(+p.pts).toFixed(1)}<small>PPG</small></i>` : '<i></i>'}${ij ? `<i class="rij ${ijc}"><u></u>${esc(V._.statusWord(ij) || 'Inj')}</i>` : ''}</span><span class="rtx"><b>${esc(nm)}</b><small>${esc([pos, a.jersey ? `#${a.jersey}` : ''].filter(Boolean).join(' · '))}</small></span></a>`; };
    const rRail = l => `<div class="rrail">${l.map(rCard).join('')}</div>`;
    const groups = [['Guard', 'Guards'], ['Forward', 'Forwards'], ['Center', 'Centers'], ['', 'Others']].map(([k, h]) => [h, sorted.filter(a => (posWord2(a.position && a.position.abbreviation) || '') === k)]).filter(([, l]) => l.length);
    // schedule rows: when, vs or at, the crest and name, then the time, the clock or the result
    const sch = (g, abs) => { const { home, me, op } = opp(g); const res = isDone(g) ? `<b class="${+me.score > +op.score ? 'w' : 'l'}">${+me.score > +op.score ? 'W' : 'L'} ${me.score}-${op.score}</b>` : g.off ? `<b class="dim">${esc(g.off)}</b>` : g.state === 'in' ? `<span class="tpill on sm"><i></i>${esc(gxDet(g, L))}</span>` : `<b>${esc(String(tipOf(g)).replace(/\s+(CT|ET|PT|MT|CST|CDT)$/, ''))}</b>`;
      return `<a class="tsr" href="${href.game(lk, g.id)}"><span class="d">${esc(abs ? dayLabel(ymdOf(g.date), { month: 'short', day: 'numeric' }) : when(g))}</span><span class="va">${home ? 'vs' : 'at'}</span><span class="tcr">${op.logo ? V._.imgSized(op.logo, 96, 96) : ''}</span><span class="o">${esc(op.short)}</span><span class="r">${res}</span></a>`; };
    const upAll = evs.filter(g => !isDone(g)), doneAll = doneG.slice().reverse();
    const plateList = (list, n, key, abs) => list.length ? `<div class="gxplate tsch${list.length > n ? '' : ' all'}" data-k="${key}">${list.map((g, i) => `<div class="tsx${i >= n ? ' more' : ''}">${sch(g, abs)}</div>`).join('')}${list.length > n ? `<button class="tmore" data-act="tmore">Show all ${list.length}</button>` : ''}</div>` : '';
    const injRows = il.length ? `<div class="gp frows">${il.map((x, i) => { const a = x.athlete || {}; const aid = athId(a); const key = `t:${id}:${aid}:${x.id || i}`; const stt = x.status || ''; const cls = /out/i.test(stt) ? 'out' : /day|quest|doubt/i.test(stt) ? 'q' : 'ok'; const det = x.details || {}; const ret = V._.retInfo(L, det.returnDate); const part = [det.side && det.side !== 'Not Specified' ? det.side : '', det.location || det.type || ''].filter(Boolean).join(' '); const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
        return `<button class="frow ijrow" data-act="injury" data-key="${esc(key)}"><span class="fface">${headshot(hsUrl(a), color, 42, a.displayName)}</span><span class="nm"><b>${esc(a.displayName || '')}</b><small>${esc(part || det.detail || '')}</small></span><span class="fs"><span class="tag ${cls}">${esc(V._.statusWord(stt) || 'Listed')}</span><em>${esc(cap(ret ? ret.short : (x.shortComment || '')))}</em></span></button>`; }).join('')}</div>` : '';
    il.forEach((x, i) => { const aid = athId(x.athlete || {}); S.injuries[`t:${id}:${aid}:${x.id || i}`] = { x, id: aid, team: { id: tid, short: tname, color, logo: lg } }; });
    const seasonGrid = r ? `<div class="tkv">${[['Record', `${r.w}-${r.l}`], ['Standing', L.standingsMode !== 'conferences' && r.pos ? `${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}` : (r.group || t0.standingSummary || '')], ['Points per game', r.ppg != null ? (+r.ppg).toFixed(1) : ''], ['Points allowed', r.opp != null ? (+r.opp).toFixed(1) : ''], ['Net per game', r.diff != null ? sign(+r.diff) : ''], ['Last 10', r.l10], ['Home', r.home], ['Road', r.road], ['Streak', r.strk], [L.standingsMode === 'conferences' ? 'In conference' : 'vs conference', r.conf]].filter(([, v]) => v).map(([k, v]) => `<div class="tkr"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('')}</div>` : '';
    /* past seasons: three chips that load that year's results into the same list. ESPN names a season by the year it ends
       (2025-26 is 2026); a season that has not started yet is not offered. */
    const endYear = (() => { const sy = sched && sched.events && sched.events[0] && sched.events[0].season && +sched.events[0].season.year; if (sy) return sy; const d0 = evs[0] && evs[0].date ? new Date(evs[0].date) : new Date(); const y = d0.getFullYear(); return lk === 'wnba' ? y : (d0.getMonth() >= 6 ? y + 1 : y); })();
    const seasonWord = y => lk === 'wnba' ? String(y) : `${y - 1}-${String(y).slice(2)}`;
    const pastSeasons = `${sec('Past seasons', 'results')}<div class="gxplate tpast" data-lk="${lk}" data-id="${esc(tid)}"><div class="xsorts tpastc">${[1, 2, 3].map(n => `<button class="chip" data-act="tpast" data-season="${endYear - n}">${seasonWord(endYear - n)}</button>`).join('')}</div><div class="tpastb"></div></div>`;
    const tabsT = [['overview', 'Overview'], ['schedule', 'Schedule'], ['roster', 'Roster'], ['stats', 'Stats']];
    const tkey = `tm:${lk}:${tid}`; let ttab = (() => { try { return localStorage.getItem(tkey) || 'overview'; } catch { return 'overview'; } })();
    const panels = {
      overview: (today ? sec(today.state === 'in' ? 'Live now' : 'Today') + gamePlate(today) : nextUp ? sec('Next up', esc(when(nextUp))) + gamePlate(nextUp) : '')
        + (lastG ? sec('Last game', esc(when(lastG))) + gamePlate(lastG) : '')
        + (form ? `<div class="tform">${form}</div>` : '')
        + (sorted.length ? sec('Players', '', `<button data-act="ttab" data-tab="roster">Full roster</button>`) + rRail(sorted.slice(0, 8)) : '')
        + (injRows ? sec('Injuries') + injRows : '')
        + (newsHtml ? newsHtml.replace('<div class="rows">', '<div class="rows gxrows">') : ''),
      schedule: ((upAll.length ? sec('Coming up', `${upAll.length} to play`) + plateList(upAll, 6, 'up') : '') + (doneAll.length ? sec('Results', r ? `${r.w}-${r.l}, newest first` : 'newest first') + plateList(doneAll, 6, 'done') : '') || empty('No games listed')) + pastSeasons,
      roster: groups.length ? groups.map(([h, l]) => sec(h, String(l.length)) + rRail(l)).join('') + `<p class="legend tleg">Points per game this season, from ESPN.</p>` : empty('No roster listed'),
      stats: ((seasonGrid ? sec('Season') + `<div class="gxplate tseason">${seasonGrid}</div>` : '') + outlook + (statsHtml ? `<div class="tstats">${statsHtml}</div>` : '')) || empty('No season numbers yet', '<p style="margin:6px 0 0">They show up once the team has played.</p>')
    };
    if (!panels[ttab]) ttab = 'overview';
    const inner = `<div class="tmhead">${V._.imgSized(lg, 160, 160, 'class="tmcrest"')}<div><p class="tmlg">${esc(L.label)}${rank ? ` · No. ${rank}` : ''}</p><h1>${esc(tname)}</h1><p class="tmsen">${sentence}</p><button class="flw${on ? ' on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(tid)}" data-name="${esc(tname)}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(tname)}">${window.RIVL_flw ? window.RIVL_flw(on, 'team') : (on ? 'Following' : 'Follow team')}</button></div></div>`;
    const bar = `<a class="gxib" href="#teams" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><div class="gxmid2"><div class="gxctr" id="gxmini"><span class="gxmn">${lg ? V._.imgSized(lg, 64, 64, 'class="tmmini"') : ''}<b>${esc(tname)}</b></span></div></div><span class="gxib ghost" aria-hidden="true"></span>`;
    V._.heroShell({ pid: `team:${tid}`, cls: '', color, c2, inner, bar, act: 'ttab', attr: 'data-tp', tab: ttab, tabs: tabsT, panels });
    document.title = `${t0.displayName} · RIVL`;
    if (V._ttabL) $main.removeEventListener('click', V._ttabL);
    const loadPast = async b => {
      const box = b.closest('.tpast'), out = box.querySelector('.tpastb'), yr = b.dataset.season; box.querySelectorAll('.chip').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      out.innerHTML = skeleton(4, 'row');
      const d = await jSoft(`${API(L)}/teams/${id}/schedule?season=${yr}`, 3600000).catch(() => null);
      const past = (d && d.events || []).map(e => { try { return parseEvent(e, L); } catch { return null; } }).filter(g => g && isDone(g)).reverse();
      if (!past.length) { out.innerHTML = empty('No results for that season'); return; }
      let w = 0, l = 0; past.forEach(g => { const { me, op } = opp(g); if (+me.score > +op.score) w++; else l++; });
      out.innerHTML = `<p class="tpasth"><b>${w}-${l}</b> in ${esc(seasonWord(+yr))} · newest first</p>` + plateList(past, 8, 'past' + yr, true);
    };
    V._ttabL = e => { const b = e.target.closest('[data-act="ttab"],[data-act="tmore"],[data-act="tpast"]'); if (!b || !$main.querySelector('.tmpage')) return; e.preventDefault();
      if (b.dataset.act === 'tmore') { const p = b.closest('.tsch'); p.classList.add('all'); b.remove(); return; }
      if (b.dataset.act === 'tpast') { loadPast(b); return; }
      const k = b.dataset.tab; try { localStorage.setItem(tkey, k); } catch { }
      $main.querySelectorAll('#gtabs .chip').forEach(x => { const o = x.dataset.tab === k; x.classList.toggle('on', o); x.setAttribute('aria-pressed', String(o)); });
      $main.querySelectorAll('#tbody > [data-tp]').forEach(x => { x.hidden = x.dataset.tp !== k; });
      const box = document.getElementById('gxscroll'), sp = box && box.querySelector('.gxspace'); if (sp && box.scrollTop > sp.offsetHeight) box.scrollTop = sp.offsetHeight; };
    $main.addEventListener('click', V._ttabL);
    if (simOk) outlookFill(L, tid, r, { feed: HW.sim.ready(L) });
    V.refresh = today && today.state === 'in' ? async () => { const g2 = await liveOf(today, 15000); const host = $main.querySelector('[data-tp="overview"] .tgm'); if (!host || !g2) return; const h = gamePlate(g2); if (host.outerHTML !== h) host.outerHTML = h; if (g2.state === 'post') V.refresh = null; } : null;
  }
  /* the shared hero page (team and player): fixed page, moving colour hero, a clear bar on top, a sheet that scrolls up
     over the hero with sticky tabs */
  V._.heroShell = ({ cls, color, c2, inner, bar, act, attr, tab, tabs, panels, pid, keepY }) => {
    /* the same page already up (a refresh, a follow, numbers arriving): everything is patched where it stands, at the same
       scroll and on the same tab, so nothing blinks out and back */
    const cur = pid && $main.querySelector(`#gpage[data-pid="${CSS.escape(String(pid))}"]`);
    if (cur && cur.querySelector('#gxin') && cur.querySelector('#tbody')) {
      const hero = cur.querySelector('#gxhero'), vars = `--aw:${color};--ha:${c2 || color};--t2:${c2 || color}`;
      if (hero.getAttribute('style') !== vars) hero.setAttribute('style', vars);
      const want = `gx solo ${soloLayer(c2).cls}`; if (hero.className !== want) hero.className = want;
      gxPatch(cur.querySelector('#gxin'), inner); gxPatch(cur.querySelector('#gxbar'), bar);
      const onTab = (cur.querySelector('#gtabs .chip.on') || {}).dataset; if (onTab && onTab.tab && tabs.some(([k]) => k === onTab.tab)) tab = onTab.tab;
      gxPatch(cur.querySelector('#gtabs'), `<div class="gxtabs" role="tablist">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-act="${act}" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`);
      const body = cur.querySelector('#tbody'); const keepEls = new Set();
      tabs.forEach(([k]) => { let el = body.querySelector(`:scope > [${attr}="${k}"]`); if (!el) { el = document.createElement('div'); el.setAttribute(attr, k); body.appendChild(el); } keepEls.add(el); gxPatch(el, panels[k] || ''); el.hidden = k !== tab; });
      [...body.children].forEach(el => { if (!keepEls.has(el)) el.remove(); });
      gxFit(); if (gxScroll.run) gxScroll.run();
      return;
    }
    $main.innerHTML = `<div id="gpage" class="gxpage tmpage ${cls || ''}"${pid ? ` data-pid="${esc(pid)}"` : ''}><section class="gx solo ${soloLayer(c2).cls}" id="gxhero" style="--aw:${esc(color)};--ha:${esc(c2 || color)};--t2:${esc(c2 || color)}">${LOBES}${soloLayer(c2).html}<div class="gxin" id="gxin">${inner}</div></section>`
      + `<div class="gxbar" id="gxbar">${bar}</div>`
      + `<div class="gxscroll" id="gxscroll"><div class="gxspace"></div><div class="gxsheet"><div id="gtabs" class="gxtabw"><div class="gxtabs" role="tablist">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-act="${act}" data-tab="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div></div>`
      + `<div id="tbody">${tabs.map(([k]) => `<div ${attr}="${k}"${k === tab ? '' : ' hidden'}>${panels[k] || ''}</div>`).join('')}</div></div></div></div>`;
    gxFit(); if (keepY) { const b = document.getElementById('gxscroll'); if (b) b.scrollTop = keepY; } gxScroll(); if (gxScroll.run) gxScroll.run();
  };
  /* the hero sits under the scroll box (the sheet scrolls up over it), so a tap on the hero lands on the box's empty top.
     Pass it through to whatever is drawn there: the Follow pill, the team crest link. */
  if (!V._heroTap) { V._heroTap = true; document.addEventListener('click', e => {
    const sp = e.target.closest && e.target.closest('#gxscroll .gxspace'); if (!sp) return;
    const under = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.closest && el.closest('#gxhero') && el.closest('a,button'));
    const hit = under && under.closest('a,button'); if (hit) { e.preventDefault(); e.stopPropagation(); hit.click(); }
  }, true); }
  /* the injury pill on a player's photo jumps down to the injury card */
  if (!V._plInj) { V._plInj = true; document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-act="pl-inj"]'); if (!b) return;
    const card = document.getElementById('injury'), box = document.getElementById('gxscroll'); if (!card) return;
    if (box && box.scrollHeight > box.clientHeight + 4) box.scrollTo({ top: box.scrollTop + card.getBoundingClientRect().top - 140, behavior: 'smooth' });
    else window.scrollTo({ top: window.scrollY + card.getBoundingClientRect().top - 140, behavior: 'smooth' });
  }); }
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
    /* the right article: the name alone first; when that is missing or a "may refer to" list, search Wikipedia for the
       name with its city and take the first real article (Palazzo dello Sport, Rome is PalaLottomatica) */
    let wp = await HW.wikiPage(ven.fullName).catch(() => null);
    if (!wp) { const city = ven.address && ven.address.city || ''; const d = await HW.jSoft(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=5&srsearch=${encodeURIComponent(`${ven.fullName} ${city} arena`)}`, 7 * 864e5).catch(() => null);
      for (const h of (d && d.query && d.query.search || [])) { const p = await HW.wikiPage(h.title).catch(() => null); if (p && p.extract && (!city || p.extract.toLowerCase().includes(city.toLowerCase()) || p.title.toLowerCase().includes(city.toLowerCase()))) { wp = p; break; } } }
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
  /* ================= v8 GAME HEAD =================
     The two teams' colours move behind the score on a near-black base; the side that leads takes more of the screen.
     The hero is pinned; the page slides up over it. A clear bar at the top carries back and share; as the page rises the
     big score fades away and a compact score fades in inside the bar. The bar holds an in-step copy of the moving colour
     (with the two rounded corners cut out of it) so whatever slides beneath it is hidden. */
  /* v7's single-team colour: tones of the team colour drifting, and the second colour as a glow that travels (or, when the
     second colour is white or gray, a slow satin sheen instead) */
  const soloLayer = c2 => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c2 || '')); let light = true; if (m) { const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); light = l > .8 || sat < .12; } return { cls: light ? 'sheen' : 'accent', html: '<span class="sb"></span>' }; };
  const LOBES = '<span class="w"><i></i><i></i><i></i><i></i></span><span class="veil"></span>';
  function gxColors(L, g) { const [ca, ch] = V._.pairColors(L, g.away, g.home); return { ca, ch, la: V._.lift(ca), lh: V._.lift(ch) }; }
  function gxLead(g) { const a = +g.away.score, h = +g.home.score; if (!isFinite(a) || !isFinite(h) || g.state === 'pre') return ''; const sh = Math.max(.3, Math.min(.7, .5 + (a - h) / 40)); return `;--split:${Math.round(sh * 100)}%;--sa:${(.82 + sh * .5).toFixed(2)};--sh:${(.82 + (1 - sh) * .5).toFixed(2)}`; }
  /* the clock as v7 wrote it: "4th 6:12", "2nd 0:45", "Halftime", "End of 3rd", "OT 2:11" (college: "2nd half 6:12") */
  function gxDet(g, L) {
    const per = +g.period || 0, d = String(g.detail || ''), st = String(g.status || ''); if (!per) return d || 'Live';
    if (/HALFTIME/.test(st) || /^half/i.test(d)) return 'Halftime';
    const reg = L && L.periods === 2 ? 2 : 4; const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
    const name = per <= reg ? (reg === 2 ? `${ord(per)} half` : ord(per)) : (per - reg > 1 ? `${per - reg}OT` : 'OT');
    if (/END_PERIOD/.test(st) || /^end/i.test(d)) return `End of ${name}`;
    const clk = String(g.clock || '').trim(); return clk && !/^0{1,2}(?::00)?(?:\.0)?$/.test(clk) ? `${name} ${clk}` : name;
  }
  function gxClock(g, L) { return g.state === 'in' ? `<span class="gxst on"><i></i>${esc(gxDet(g, L))}</span>` : g.state === 'post' ? `<span class="gxst">${esc(finalWord(g))}</span>` : `<span class="gxst">${esc(tipOf(g))}</span>`; }
  /* the crest on its own, no disc: ESPN's dark-mode art first (it reads on colour), the plain art if a team has none */
  const gxL = src => `<span class="logo s">${src ? V._.imgSized(src, 96, 96, 'loading="eager" decoding="sync"') : ''}</span>`;
  const gxCr = (src, cls = '') => `<span class="gxcr${cls ? ' ' + cls : ''}">${src ? V._.imgSized(src, 96, 96) : ''}</span>`;
  function gxLogo(src) {
    return `<span class="gxlg">${src ? V._.imgSized(src, 256, 256, 'loading="eager" decoding="sync"') : ''}</span>`;
  }

  /* the whole court, the way v7 drew it: wood floor, the visitors' shots at the left basket, the home team's at the right,
     makes as dots, misses as crosses, the home crest at centre court. Feet throughout (94 by 50). */
  function gxCourt(L, list, ca, ch, homeLogo) {
    const nba = L.key === 'nba'; const arcR = nba ? 23.75 : 22.15, cx = nba ? 3 : 25 - 21.65, laneW = L.key.startsWith('ncaa') ? 12 : 16;
    const cy = Math.sqrt(arcR * arcR - (25 - cx) ** 2) + HOOP.y;
    const half = `<rect x="0" y="${25 - laneW / 2}" width="19" height="${laneW}"/><path d="M19 19a6 6 0 0 1 0 12"/><path d="M19 19a6 6 0 0 0 0 12" stroke-dasharray=".7 .7"/>`
      + `<path d="M${HOOP.y} 21a4 4 0 0 1 0 8"/><path d="M4 22v6" stroke-width=".5"/><circle cx="${HOOP.y}" cy="25" r=".75"/>`
      + `<path d="M0 ${cx}H${cy.toFixed(2)}A${arcR} ${arcR} 0 0 1 ${cy.toFixed(2)} ${50 - cx}H0"/>`;
    const ink = 'rgba(86,50,16,.55)';
    const dots = list.map(s => {
      const home = s.side === 'home'; const fx = Math.min(47, Math.max(0, s.y)), fy = Math.min(50, Math.max(0, s.x));
      const x = home ? 94 - fx : fx, y = home ? 50 - fy : fy, col = home ? ch : ca;
      if (s.made) return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.05" fill="${esc(col)}" stroke="rgba(18,10,2,.7)" stroke-width=".3"><title>${esc(s.text || '')}</title></circle>`;
      const d = .8, pth = `M${(x - d).toFixed(2)} ${(y - d).toFixed(2)}l${d * 2} ${d * 2}M${(x + d).toFixed(2)} ${(y - d).toFixed(2)}l-${d * 2} ${d * 2}`;
      return `<g><title>${esc(s.text || '')}</title><path d="${pth}" stroke="rgba(28,14,2,.62)" stroke-width=".85" stroke-linecap="round" fill="none"/><path d="${pth}" stroke="${esc(col)}" stroke-width=".45" stroke-linecap="round" fill="none"/></g>`;
    }).join('');
    return `<div class="gxcourt">${homeLogo ? `<img class="mid" src="${esc(homeLogo)}" alt="" onerror="this.remove()">` : ''}<svg viewBox="-.6 -.6 95.2 51.2" role="img" aria-label="Shot chart">`
      + `<g stroke="${ink}" fill="none" stroke-width=".35" stroke-linecap="round"><rect x="0" y="0" width="94" height="50"/><path d="M47 0v50"/><circle cx="47" cy="25" r="6"/>`
      + `<g>${half}</g><g transform="matrix(-1 0 0 1 94 0)">${half}</g></g>${dots}</svg></div>`;
  }
  function gxInner(L, lk, g, f, venue) {
    const pre = g.state === 'pre' || g.away.score == null || g.home.score == null, aL = +g.away.score > +g.home.score, hL = +g.home.score > +g.away.score;
    const side = t => `<a class="gxside" href="${href.team(lk, t.id)}" aria-label="${esc(t.name || t.short)} team page">${gxLogo(t.logo)}<b>${esc(t.short || t.name)}</b><em>${esc(t.rec || '')}</em></a>`;
    const sc = (t, lead) => pre ? '<span class="gxsc"></span>' : `<span class="gxsc num ${lead ? 'ld' : 'tr'}">${t.score}</span>`;
    let bar = '';
    if (f && !g.off) { const c = gxColors(L, g); const pa = Math.round((1 - f.pHome) * 100); bar = `<div class="gxwp"><div class="bar"><i style="width:${pa}%;background:${esc(c.la)}"></i><i style="width:${100 - pa}%;background:${esc(c.lh)}"></i></div><div class="cap"><span>${esc(g.away.abbr)} ${pa}%</span><span>${g.state === 'post' ? 'Pregame prediction' : 'Prediction'}</span><span>${esc(g.home.abbr)} ${100 - pa}%</span></div></div>`; }
    return `<p class="gxleague">${esc([L.label, venue].filter(Boolean).join(' · '))}</p>
      <div class="gxsc3">${sc(g.away, aL)}<span class="gxmid">${gxClock(g, L)}</span>${sc(g.home, hL)}${side(g.away)}<span></span>${side(g.home)}</div>${bar}`;
  }
  /* the day's other games, as small glass pills between Back and Share; this game is the lit one */
  function gxStrip(L, g, day) {
    const list = (day || []).filter(x => x && x.away && x.home && !x.tbd); if (list.length < 2) return '';
    return list.map(x => {
      if (String(x.id) === String(g.id)) return `<span class="gxp cur">${logo(x.away.logo, 's')}<i>@</i>${logo(x.home.logo, 's')}</span>`;
      const sc = x.away.score != null && x.home.score != null && x.state !== 'pre';
      const mid = x.state === 'in' ? `<b class="num">${x.away.score}–${x.home.score}</b><em class="lv">${esc(gxDet(x, L))}</em>` : sc ? `<b class="num">${x.away.score}–${x.home.score}</b><em>${esc(finalWord(x))}</em>` : `<em>${esc(tipOf(x))}</em>`;
      return `<a class="gxp" href="${href.game(L.key, x.id)}">${logo(x.away.logo, 's')}<span>${mid}</span>${logo(x.home.logo, 's')}</a>`;
    }).join('');
  }
  function gxBar(L, g, title, card, strip) {
    const pre = g.state === 'pre' || g.away.score == null;
    const mini = pre ? `<span class="gxmn">${logo(g.away.logo, 's')}<b>${esc(g.away.abbr)}</b><i>at</i><b>${esc(g.home.abbr)}</b>${logo(g.home.logo, 's')}</span>`
      : `<span class="gxmn">${logo(g.away.logo, 's')}<b class="num${+g.away.score >= +g.home.score ? '' : ' tr'}">${g.away.score}</b>${gxClock(g, L)}<b class="num${+g.home.score >= +g.away.score ? '' : ' tr'}">${g.home.score}</b>${logo(g.home.logo, 's')}</span>`;
    const back = `<a class="gxib" href="#scores" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a>`;
    const share = `<button class="gxib" data-act="share" data-title="${esc(title.replace(/<[^>]+>/g, ''))}"${card ? ` data-card='${esc(JSON.stringify(card))}'` : ''} aria-label="Share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></button>`;
    return `${back}<div class="gxmid2">${strip ? `<div class="gxstrip" id="gxstrip">${strip}</div>` : ''}<div class="gxctr" id="gxmini">${mini}</div></div>${share}`;
  }
  /* the page is fixed: the hero never moves, and everything under the bar scrolls in its own box (#gxscroll). The box is cut
     to a rounded top, so the sheet stops under the bar and the colour shows through its corners; nothing needs a copy of the
     hero or a mask, and nothing is moved by script while you scroll. */
  function gxFit() {
    /* the hero's height is set in CSS, so nothing here moves the page; this only reads how far the sheet travels before the
       tabs pin, for the fades */
    const sp = document.querySelector('#gpage .gxspace'); gxFit.span = Math.max(80, sp ? sp.offsetHeight : 240);
  }
  /* a page put back as it stood (the arrow, the phone's back swipe): its hero and scroll box are wired up again */
  V._.gxAttach = () => { try { gxFit(); } catch { } gxScroll(); if (gxScroll.run) gxScroll.run(); };
  function gxScroll() {
    const box = document.getElementById('gxscroll'); if (!box) return;
    if (gxScroll.box === box) return; gxScroll.box = box;
    const set = (el, k, v) => { if (el && el.style[k] !== v) el.style[k] = v; };
    const run = () => {
      const hero = document.getElementById('gxhero'); if (!hero || !document.body.contains(box)) { document.documentElement.classList.remove('gxon'); gxScroll.box = null; gxScroll.run = null; return; }
      document.documentElement.classList.add('gxon');
      const p = Math.min(1, Math.max(0, box.scrollTop / (gxFit.span || 300)));
      const fade = document.querySelector('#gpage.plpage .pltx') || document.getElementById('gxin'), strip = document.getElementById('gxstrip'), mini = document.getElementById('gxmini');
      const f = Math.min(1, p / .6); set(fade, 'opacity', (1 - f).toFixed(3)); set(fade, 'transform', `translateY(${(-18 * f).toFixed(1)}px) scale(${(1 - .06 * f).toFixed(3)})`);
      const so = Math.max(0, 1 - p / .35); set(strip, 'opacity', so.toFixed(3)); set(strip, 'pointerEvents', so < .2 ? 'none' : '');
      const c = Math.min(1, Math.max(0, (p - .45) / .4)); set(mini, 'opacity', c.toFixed(3)); set(mini, 'transform', `translateY(${(8 * (1 - c)).toFixed(1)}px)`); set(mini, 'pointerEvents', c > .5 ? '' : 'none');
    };
    box.addEventListener('scroll', run, { passive: true }); gxScroll.run = run; run();
    /* a tap on the clear part of the box, over the hero, goes to whatever sits under it (a crest opens its team) */
    box.addEventListener('click', e => { if (!e.target.closest('.gxspace')) return; const a = document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest && x.closest('#gxhero a[href]')).find(Boolean); if (a) { e.preventDefault(); location.hash = a.getAttribute('href').replace(/^#/, ''); } });
  }
  /* switching tabs while deep in the page: come back up so the tabs sit just under the bar */
  function gxPin() { const box = document.getElementById('gxscroll'), sp = box && box.querySelector('.gxspace'); if (sp && box.scrollTop > sp.offsetHeight) box.scrollTop = sp.offsetHeight; }
  /* a filter inside a tab changes only what it filters: the controls keep their buttons (so nothing redraws under a finger) and
     the part below them is swapped. Returns false when the controls differ, so the caller swaps the whole body. */
  function gxMorph(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b.cloneNode(true)); return; }
    if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    if (a.nodeType !== 1) return;
    /* the same picture (by file name: phi.png, 3059318.png) keeps its element as is, even after it fell back to another copy */
    const pic = u => { const m = /([\w-]+)\.(?:png|jpe?g|webp|svg)/i.exec(String(u || '')); return m ? m[1] : u; };
    const sameImg = a.nodeName === 'IMG' && pic(a.getAttribute('src')) === pic(b.getAttribute('src'));
    for (const at of [...a.attributes]) if (!b.hasAttribute(at.name) && at.name !== 'style' && at.name !== 'hidden' && !(sameImg && (at.name === 'data-o' || at.name === 'class'))) a.removeAttribute(at.name);
    for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) { if (sameImg && (at.name === 'src' || at.name === 'data-o' || at.name === 'onerror' || at.name === 'class')) continue; a.setAttribute(at.name, at.value); }
    const ak = [...a.childNodes], bk = [...b.childNodes];
    for (let i = 0; i < bk.length; i++) { if (i < ak.length) gxMorph(ak[i], bk[i]); else a.appendChild(bk[i].cloneNode(true)); }
    for (let i = bk.length; i < ak.length; i++) ak[i].remove();
  }
  /* patch only the inside of el (el's own attributes, like the fades' inline styles, are left alone) */
  function gxPatch(el, html) { const t = document.createElement('div'); t.innerHTML = html; const ak = [...el.childNodes], bk = [...t.childNodes];
    for (let i = 0; i < bk.length; i++) { if (i < ak.length) gxMorph(ak[i], bk[i]); else el.appendChild(bk[i]); } for (let i = bk.length; i < ak.length; i++) ak[i].remove(); }
  function gxSwapOut(bodyEl, html) {
    const ctl = bodyEl.querySelector(':scope > .gxctl'); if (!ctl) return false;
    const t = document.createElement('div'); t.innerHTML = html; const nctl = t.querySelector(':scope > .gxctl'), nout = t.querySelector(':scope > .gxout'); if (!nctl || !nout) return false;
    const key = el => [...el.querySelectorAll('button')].map(b => `${b.dataset.act}|${b.dataset.team || b.dataset.q || b.dataset.v || b.dataset.pid || ''}`).join(',');
    if (key(ctl) !== key(nctl)) return false;
    const nb = [...nctl.querySelectorAll('button')]; ctl.querySelectorAll('button').forEach((b, i) => { const on = nb[i].getAttribute('aria-pressed'); if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on); const c = nb[i].className; if (b.className !== c) b.className = c; });
    const out = bodyEl.querySelector(':scope > .gxout'); if (out) out.innerHTML = nout.innerHTML; else bodyEl.appendChild(nout);
    return true;
  }

  function gxPulse(side) { const h = document.getElementById('gxhero'); if (!h) return; let z = h.querySelector(':scope > .pz'); if (!z) { z = document.createElement('span'); h.insertBefore(z, h.querySelector(':scope > .veil')); } z.className = 'pz ' + (side === 'away' ? 'pa' : 'ph'); void z.offsetWidth; z.classList.add('go'); }
  /* a play, as a card on a timeline: the team's colour, the player's face and number, what happened, and the score after it */
  function playCard(L, lk, g, p, ppl) {
    const id = p.team && String(p.team.id); const t = id === g.home.id ? g.home : id === g.away.id ? g.away : null;
    const c = t ? V._.teamColor(t, L) : '#6E7582';
    const sv = +p.scoreValue || 0; const typ = p.type && p.type.text || '';
    const title = p.scoringPlay ? (sv === 3 ? '3-pointer' : sv === 1 ? 'Free throw' : /dunk/i.test(typ) ? 'Dunk' : /layup/i.test(typ) ? 'Layup' : /hook/i.test(typ) ? 'Hook shot' : 'Basket')
      : /timeout/i.test(typ) ? 'Timeout' : /foul/i.test(typ) ? 'Foul' : /turnover/i.test(typ) ? 'Turnover' : /rebound/i.test(typ) ? 'Rebound' : /block/i.test(typ) ? 'Block' : /steal/i.test(typ) ? 'Steal' : /substitution/i.test(typ) ? 'Substitution' : /end/i.test(typ) ? 'End of period' : /miss/i.test(String(p.text || '')) ? 'Miss' : (typ || 'Play');
    const pa = (p.participants || [])[0]; const aid = pa && pa.athlete && String(pa.athlete.id); const who = aid && ppl[aid];
    const face = who ? `<a class="pcf" href="${href.player(lk, aid)}">${headshot(who.hs, c, 48, who.name)}${who.jersey ? `<i style="background:${esc(c)}">${esc(who.jersey)}</i>` : ''}</a>` : '';
    const clock = `${p.period && p.period.number ? (p.period.number <= L.periods ? (L.periods === 2 ? `H${p.period.number}` : `Q${p.period.number}`) : 'OT') : ''} ${p.clock && p.clock.displayValue || ''}`.trim();
    return `<div class="gpl${p.scoringPlay ? ' sc' : ''}" style="--pc:${esc(c)};--pcl:${esc(V._.lift(c))}"><div class="pld"><span class="dot"><i></i></span><em>${esc(clock)}</em></div>
      <div class="plc"><div class="plhd"><b>${esc(title)}</b>${t ? logo(t.logo, 's') : ''}</div><div class="plb">${face}<p>${esc(p.text || '')}</p></div>
      ${p.awayScore != null ? `<div class="plf"><span>${esc(g.away.abbr)} ${p.awayScore}</span><span>${esc(g.home.abbr)} ${p.homeScore}</span></div>` : ''}</div></div>`;
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
    /* the same marks as the game page: a filled circle for a make, an X for a miss, each with a dark edge so they read on any colour */
    const dots = shots.map(s => { const c = colorOf ? colorOf(s) : 'var(--ink)'; const xn = Math.min(50, Math.max(0, s.x)), yn = Y(Math.min(47, Math.max(0, s.y))); const x = xn.toFixed(2), y = yn.toFixed(2);
      if (s.made) return `<circle class="mk" cx="${x}" cy="${y}" r="${dot}" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width=".25"><title>${esc(s.text)}</title></circle>`;
      const d = dot * .85, pth = `M${(xn - d).toFixed(2)} ${(yn - d).toFixed(2)}l${(d * 2).toFixed(2)} ${(d * 2).toFixed(2)}M${(xn + d).toFixed(2)} ${(yn - d).toFixed(2)}l-${(d * 2).toFixed(2)} ${(d * 2).toFixed(2)}`;
      return `<g class="ms"><title>${esc(s.text)}</title><path d="${pth}" stroke="rgba(0,0,0,.5)" stroke-width=".8" stroke-linecap="round" fill="none"/><path d="${pth}" stroke="${c}" stroke-width=".42" stroke-linecap="round" fill="none"/></g>`; }).join('');
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
    if (!$main.querySelector(`#gpage[data-gid="${CSS.escape(String(id))}"] #gxhero`)) $main.innerHTML = topbar('', '#scores') + skeleton(1, 'card') + skeleton(6, 'row');   // the same game already up stays up through a refresh
    const mem = (() => { try { const m = JSON.parse(localStorage.getItem('gx:' + id) || sessionStorage.getItem('gx:' + id) || 'null') || {}; return m.at && Date.now() - m.at > 12 * 3600000 ? {} : m; } catch { return {}; } })();
    let ctx = null, sched, tab = focus ? 'box' : (mem.tab || 'summary');   // every game opens on Summary — or on the box score, led by one player, when opened from his line
    const pv = Object.assign({ q: 'all', scoring: true, n: 30 }, mem.pv || {});   // the plays tab's period and scoring-only filters
    const sv = Object.assign({ team: 'both', pid: '', q: 0 }, mem.sv || {});   // the shots tab's team and player filters
    const bv = Object.assign({ col: '', dir: 'desc', side: 'home' }, mem.bv || {});   // the box score's sort column and which team is open
    const pf = Object.assign({ pid: '' }, mem.pf || {});
    /* everything you chose on this game, kept for this visit: a refresh lands exactly where you were */
    const save = () => { try { const box = document.getElementById('gxscroll'); const v = JSON.stringify({ tab, pv, sv, bv, pf, y: box ? Math.round(box.scrollTop) : (mem.y || 0), at: Date.now() }); localStorage.setItem('gx:' + id, v); sessionStorage.setItem('gx:' + id, v); } catch { } };   // the plays tab's player filter
    const paint = async (ttl, local) => {
      const d = local && paint.d ? paint.d : await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, ttl); if (d) paint.d = d;
      const hc = d && d.header && d.header.competitions && d.header.competitions[0];
      if (!hc) { $main.innerHTML = topbar('Game', '#scores') + empty("Couldn't load this game", '<p style="margin:6px 0 0">The feed didn\'t answer. Pull down to try again.</p>'); return null; }
      const ev = { id, competitions: [{ ...hc, venue: d.gameInfo && d.gameInfo.venue, status: hc.status, broadcasts: hc.broadcasts, geoBroadcasts: hc.geoBroadcasts }], date: hc.date, status: hc.status, season: d.header.season, pickcenter: d.pickcenter };   // the summary keeps the market line in pickcenter, not on the competition
      const g = parseEvent(ev, L); if (!g.date || isNaN(new Date(g.date))) g.date = new Date().toISOString();
      /* the status clock has been seen stuck (0.0 with minutes left in the quarter). The play-by-play carries its own clock
         on every play: when the game is in progress and the latest play is in the same period with time on it, that is
         the clock shown. Only ever the feed's own numbers. */
      if (g.state === 'in' && !/HALFTIME|END_PERIOD/.test(g.status || '')) {
        const lp = (d.plays || []).slice(-1)[0]; const pp = lp && lp.period && lp.period.number; const pc = lp && lp.clock && lp.clock.displayValue;
        if (pp && pc && pp >= (g.period || 0) && !/^0{1,2}(?::00)?(?:\.0)?$/.test(pc)) { const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`; const reg = L.periods === 2 ? 2 : 4; g.detail = HW.prettyDetail(pp > reg ? `${pc} - ${pp - reg > 1 ? pp - reg : ''}OT` : `${pc} - ${ord(pp)}`, L, g.status); g.period = pp; g.clock = pc; }
      }
      /* the series and the headline ("WNBA Finals - Game 7") are on the day's scoreboard for certain; the summary's header
         may or may not carry them. When this page's own feed lacks them, take them from the scoreboard entry for the
         same game — the same feed, the same facts, never a guess */
      if (!g.series && !g.note && !local) { try { const d = await HW.scoreboard(L, ymdOf(g.date), 60000); const sb = (d || []).find(x => x.id === g.id); if (sb) { if (sb.series) g.series = sb.series; if (sb.note) g.note = sb.note; } } catch { } }
      if (!ctx) ctx = await forecastCtx(L, ymdOf(g.date)).catch(() => null);
      if (sched === undefined) sched = HW.sim && (lk === 'nba' || lk === 'wnba') ? await HW.sim.schedule(L, { feed: false }).catch(() => null) : null;
      const f = safeF(L, g, ctx);
      const title = g.tbd ? esc(String(g.note || '').replace(/\s+-\s+/g, ' ') || 'Teams to be decided') : `${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}`;
      if (!g.tbd) V._.tint(V._.scoreColor(L, f && f.pHome < .5 ? g.away : g.home));   // the page leans the favourite's way, the home side's when there is no call
      /* The series, as a centred caption under the hero — not in the hero's middle column (no room) and not a plate of its
         own (it read as two stray fragments). The pick appears only when it says something the game bar does not: in a
         deciding game the series rides on this one result and the two numbers are the same, so it is left out. */
      const pk = ctx ? V._.seriesPick(L, g, V._.safeF(L, g, ctx), ctx) : null;
      const decider = !!(g.series && g.series.total && g.series.hw != null && g.series.aw != null && g.series.hw + g.series.aw + 1 >= g.series.total);
      const spick = pk && !decider ? V._.seriesPickText(pk) : '';
      const hero = heroCard(L, g, ctx, { page: true }) + (V._.seriesLine(g) ? `<p class="sline"><span>${esc(V._.seriesLine(g))}</span>${spick ? `<b>${esc(spick)}</b>` : ''}</p>` : '');
      const shots = g.state === 'pre' ? [] : shotsOf(d.plays, g); const shotsOk = shots.length > 0 && shotsTrusted(shots);
      const tabList = [['summary', 'Summary'], ['box', 'Box score'], ['plays', 'Plays'], ['shots', 'Shots'], ['stats', 'Team stats']].filter(([k]) => (g.state !== 'pre' || k === 'summary' || k === 'stats') && (k !== 'shots' || shotsOk));
      if (!tabList.some(([k]) => k === tab)) tab = 'summary';
      const tabs = `<div class="gxtabs" role="tablist">${tabList.filter(([k]) => k !== 'stats').map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" role="tab" data-act="gtab" data-tab="${esc(k)}" aria-selected="${k === tab}" aria-pressed="${k === tab}">${esc(l)}</button>`).join('')}</div>`; const tabKey = tabList.map(([k]) => k).join();
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
      const ppl = {}; bx.forEach(side => { const st0 = side.statistics && side.statistics[0]; (st0 && st0.athletes || []).forEach(a => { if (a.athlete) ppl[String(a.athlete.id)] = { name: a.athlete.displayName || '', hs: hsUrl(a.athlete), jersey: a.athlete.jersey || '' }; }); });
      // scoring runs: consecutive points by one side, called out at 8-0 and up
      const runs = new Map(); if (plays.length) { let ph = +plays[0].homeScore || 0, pa = +plays[0].awayScore || 0, team = '', pts = 0, from = 0; plays.forEach((p, i) => { if (!i) return; const h = +p.homeScore || 0, a = +p.awayScore || 0; const dh = h - ph, da = a - pa; ph = h; pa = a; if (dh > 4 || da > 4 || dh < 0 || da < 0) { team = ''; pts = 0; return; }   /* a gap in the feed, not a run */ const who = dh > 0 ? 'home' : da > 0 ? 'away' : ''; if (!who) return; const v = dh > 0 ? dh : da; if (who === team) { pts += v; } else { if (team && pts >= 8) runs.set(from, { team, pts }); team = who; pts = v; } from = i; }); if (team && pts >= 8) runs.set(from, { team, pts }); }
      const runMark = i => { const r = runs.get(i); if (!r) return ''; const t = r.team === 'home' ? g.home : g.away; return `<div class="runmark" style="${tcv(V._.teamColor(t))}"><b>${r.pts}–0</b> ${esc(t.short)} run</div>`; };
      const sideOf = p => { const id = p.team && String(p.team.id); return id === g.home.id ? g.home : id === g.away.id ? g.away : null; };
      const playRow = (p, i) => { const t = p.scoringPlay ? sideOf(p) : null; return `${runMark(i)}<div class="row play${p.scoringPlay ? ' score' : ''}"${t ? ` style="${tcv(V._.teamColor(t, L))}"` : ''}><span class="q">${esc(p.period && p.period.displayValue ? p.period.displayValue.replace('Quarter', 'Q').replace(/(\d)(st|nd|rd|th) Q/, 'Q$1') : '')} ${esc(p.clock && p.clock.displayValue || '')}</span><span class="t"><b class="wrap">${esc(p.text || '')}</b><span>${p.awayScore != null ? `${esc(g.away.abbr)} ${p.awayScore}, ${esc(g.home.abbr)} ${p.homeScore}` : ''}</span></span>${p.scoringPlay ? `<span class="tag ok pts">+${esc(p.scoreValue || '')}</span>` : ''}</div>`; };
      // the line score, quarter by quarter
      const lsOf = side => { const c = (hc.competitors || []).find(x => x.team && String(x.team.id) === side.id); return (c && c.linescores || []).map(l => l.displayValue ?? l.value ?? ''); };
      const lsA = lsOf(g.away), lsH = lsOf(g.home); const nq = Math.max(lsA.length, lsH.length);
      const lineScore = g.state !== 'pre' && nq ? `<div class="gxplate"><table class="gxls"><thead><tr><th></th>${Array.from({ length: nq }, (_, i) => `<th>${i < (L.periods || 4) ? i + 1 : `OT${i - (L.periods || 4) + 1 > 1 ? i - (L.periods || 4) + 1 : ''}`}</th>`).join('')}<th>T</th></tr></thead><tbody>${[[g.away, lsA], [g.home, lsH]].map(([t, ls]) => `<tr><td><a class="tm" href="${href.team(lk, t.id)}">${gxCr(t.logo)}${esc(t.abbr)}</a></td>${Array.from({ length: nq }, (_, i) => `<td>${esc(String(ls[i] ?? ''))}</td>`).join('')}<td>${t.score ?? ''}</td></tr>`).join('')}</tbody></table></div>` : '';
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
      const clips = vids.length ? sec('Highlights', vids.length > 1 ? `${vids.length} clips` : '') + `<div class="gxclips">${vids.map((v, k) => `<button class="gxclip" data-act="play" data-vid="${esc(String(v.id))}" style="--c1:${esc(V._.teamColor(k % 2 ? g.home : g.away, L))}"><span class="im">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="pl"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg></span>${v.duration ? `<span class="du">${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}</span>` : ''}</span><p>${esc(v.headline || v.title || '')}</p></button>`).join('')}</div>` : '';
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
      const lu = g.state !== 'pre' && plays.length ? (paint.lu && paint.lu.d === d ? paint.lu.v : (paint.lu = { d, v: lineupsOf(d, g, L) }).v) : null;
      const ptsOf = (side, id) => { const st = statOf(boxOf(side), 'PTS'); const a = st && (st.s.athletes || []).find(x => String(x.athlete.id) === id); return a && a.stats ? a.stats[st.i] : ''; };
      const floor = g.state === 'in' && lu && lu.on ? sec('On the floor', `as of ${g.detail}`) + `<div class="gxplate gxfloor">${[['away', g.away], ['home', g.home]].map(([side, t]) => `<div class="fl"><div class="fh">${gxCr(t.logo)}<b>${esc(t.short)}</b></div><div class="fr">${lu.on[side].map(id => { const n = lu.names[id] || {}; const pts = ptsOf(t, id); return `<a href="${href.player(lk, id)}">${headshot(n.hs || '', V._.teamColor(t, L), 44, n.name || '')}<b>${esc(V.lastName(n.name || n.short || ''))}</b><span>${pts !== '' ? `${esc(pts)} pts` : ''}</span></a>`; }).join('')}</div></div>`).join('')}</div>` : '';
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
        if (played.length || ahead.length) series = sec('Season series', played.length ? lead : 'First meeting this season') + (rows ? `<div class="rows gxrows">${rows}</div>` : '') + next;
      }
      // the injury report for both sides, before tip; each row opens the report
      let report = '';
      if (g.state === 'pre' && ctx && ctx.inj) {
        S.injuries = S.injuries || {};
        const side = t => { const il = ctx.inj.byTeam[t.id] && ctx.inj.byTeam[t.id].list || []; if (!il.length) return ''; const tc = V._.teamColor(t, L); const rows = il.map((x, i) => { const a = x.athlete || {}; const aid = athId(a); const key = `g:${t.id}:${aid}:${x.id || i}`; S.injuries[key] = { x, id: aid, team: { id: t.id, short: t.short, color: tc } }; const stt = x.status || ''; const cls = /out/i.test(stt) ? 'out' : /day|quest|doubt/i.test(stt) ? 'q' : 'ok'; const det = x.details || {}; const ret = retInfo(L, det.returnDate); const why = [det.type || det.detail, ret ? ret.short : ''].filter(Boolean).join(', '); return `<button class="row" data-act="injury" data-key="${esc(key)}">${headshot(hsUrl(a), tc, 44, a.displayName)}<span class="t"><b>${esc(a.displayName || '')}</b><span>${esc(why || (x.shortComment || '').slice(0, 80))}</span></span><span class="tag ${cls}">${esc(statusWord(stt))}</span></button>`; }).join(''); return `<div class="injgrp"><button class="injhd" data-act="injcol" data-id="g:${esc(t.id)}" aria-expanded="true" style="${tcv(tc)}"><i class="bar"></i>${logo(t.logo, 's')}<b>${esc(t.short)}</b><span class="n">${il.length} listed</span>${chev}</button><div class="fold"><div class="injbody">${rows}</div></div></div>`; };
        const both = side(g.away) + side(g.home);
        report = sec('Injury report') + (both ? `<div class="rows injrep gxrows">${both}</div>` : `<p class="legend">Nobody listed on either side.</p>`);
      }
      let body = '';
      if (tab === 'summary') {
        /* v7's order: the clips, the line score, the game leaders, the team stats; then everything the working app knows */
        const sp = V._.seriesLine(g) ? V._.seriesLine(g).split(' · ') : [];
        if (!g.tbd && sp.length) { const st = sp.length > 1 ? sp.pop() : ''; body += `<div class="gxser"><b>${esc(sp.join(', '))}</b>${st ? `<span>${esc(st)}</span>` : ''}${spick ? `<em>${esc(spick)}</em>` : ''}</div>`; }
        if (clips) body += clips;
        if (lineScore) body += sec('Line score') + lineScore;
        if (floor) body += floor;
        /* game leaders, as v7 drew them: each side's best in points, rebounds and assists, the better number dark */
        const leadOf = (side, lab) => { const p = boxOf(side); const st = statOf(p, lab); if (!st) return null; const ath = (st.s.athletes || []).filter(x => x.stats && x.stats.length && !x.didNotPlay); if (!ath.length) return null; const best = ath.slice().sort((x, y) => (+y.stats[st.i] || 0) - (+x.stats[st.i] || 0))[0]; return { a: best.athlete, v: +best.stats[st.i] || 0 }; };
        const sideOf = team => String(team && team.id) === g.home.id ? g.home : String(team && team.id) === g.away.id ? g.away : (team && team.abbreviation === g.home.abbr ? g.home : g.away);
        if (g.state !== 'pre') {
          const cats = [['PTS', 'Points'], ['REB', 'Rebounds'], ['AST', 'Assists']].map(([k, n]) => [leadOf(g.away, k), leadOf(g.home, k), n]).filter(([x, y]) => x && y);
          const who = (x, t, right, lo) => { const c = V._.teamColor(t, L); const nm = x.a.shortName || x.a.displayName || ''; const face = headshot(hsUrl(x.a), c, 44, x.a.displayName); return `<a class="p${right ? ' r' : ''}" href="${href.player(lk, x.a.id)}">${right ? '' : face}<span class="t"><b class="num${lo ? ' lo' : ''}">${x.v}</b><em>${esc(nm)}</em></span>${right ? face : ''}</a>`; };
          if (cats.length) body += sec('Game leaders') + `<div class="glplate"><div class="glhd"><span class="s">${gxCr(g.away.logo)}<b>${esc(g.away.abbr)}</b></span><span></span><span class="s r"><b>${esc(g.home.abbr)}</b>${gxCr(g.home.logo)}</span></div>`
            + cats.map(([x, y, n]) => { const aw = x.v > y.v, hw = y.v > x.v; return `<div class="glrow">${who(x, g.away, false, hw)}<span class="lab">${n}</span>${who(y, g.home, true, aw)}</div>`; }).join('') + '</div>';
        } else if (d.leaders && d.leaders.length) {
          const items = []; d.leaders.forEach(t => (t.leaders || []).slice(0, 3).forEach(cat => { const Ld = cat.leaders && cat.leaders[0]; if (Ld) items.push({ side: sideOf(t.team), cat, Ld }); }));
          const rowsOf = side => items.filter(x => x.side === side).slice(0, 3).map(x => `<a class="row" href="${href.player(lk, x.Ld.athlete.id)}">${headshot(hsUrl(x.Ld.athlete), V._.teamColor(side, L), 40, x.Ld.athlete.displayName)}<span class="t"><b>${esc(x.Ld.athlete.displayName || '')}</b><span>${esc(x.cat.shortDisplayName || x.cat.displayName || '')}</span></span><b class="num">${esc((x.Ld.displayValue || '').split(' ')[0])}</b></a>`).join('');
          const both = rowsOf(g.away) + rowsOf(g.home); if (both) body += sec('Season leaders') + `<div class="rows">${both}</div>`;
        }
        if (ta && th && g.state !== 'pre') {
          const [ca, ch] = V._.pairColors(L, g.away, g.home);
          const rows = WANT.filter(n => n !== 'largestLead').map(n => { const a = get(ta, n), h = get(th, n); if (!a || !h) return ''; const av = parseFloat(String(a.displayValue).split('-')[0]) || 0, hv = parseFloat(String(h.displayValue).split('-')[0]) || 0; const tot = (av + hv) || 1; const lowGood = !!LOW[n]; const aw = av === hv || (lowGood ? av < hv : av > hv), hw = av === hv || (lowGood ? hv < av : hv > av); const pctS = /Pct$/.test(n) ? '%' : ''; const show = x => esc(String(x.displayValue)) + (pctS && !String(x.displayValue).includes('%') ? '%' : '');
            return `<div class="gxcmp"><div class="tp"><b class="${aw ? 'w' : 'l'}">${show(a)}</b><span>${esc(NICE[n] === 'Threes' ? '3-pointers' : (NICE[n] || a.label || n))}</span><b class="${hw ? 'w' : 'l'}">${show(h)}</b></div><div class="tk"><div><i style="width:${(av / tot * 100).toFixed(1)}%;background:${esc(V._.lift(ca))}"></i></div><div><i style="width:${(hv / tot * 100).toFixed(1)}%;background:${esc(V._.lift(ch))}"></i></div></div></div>`; }).filter(Boolean).slice(0, 8).join('');
          if (rows) body += sec('Team stats') + `<div class="gxplate">${rows}</div>`;
        }
        if (starters) body += starters;
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
          if (g.state === 'in') lines.push(['Score and time', `${esc((g.home.score > g.away.score ? g.home : g.away).short)} up ${Math.abs(g.home.score - g.away.score)}, ${esc(gxDet(g, L))}`]);
          lines.push(['Home court', g.neutral ? 'Neutral floor' : `${esc(g.home.short)} +${f.hca.toFixed(1)}`]);
          const byLine = m => `${esc((m >= 0 ? g.home : g.away).short)} by ${Math.abs(m).toFixed(1)}`;
          if (f.mkt != null) { lines.push(['Market line', `${byLine(f.mkt)}${f.odds && f.odds.total ? ` · total ${f.odds.total}` : ''}`]); lines.push(['RIVL alone', byLine(f.own)]); }
          lines.push([g.state === 'pre' ? 'Projected margin' : 'Pregame margin', byLine(f.margin)]);
          if (f.proj) lines.push([g.state === 'pre' ? 'Projected score' : 'Pregame projection', `${esc(g.away.abbr)} ${f.proj.away} · ${esc(g.home.abbr)} ${f.proj.home}`]);
          lines.push([g.state === 'pre' ? 'Win chance' : 'Pregame chance', `${esc(fav.short)} ${pct(p)}`]);
          const ratingNote = (f.source === 'elo' ? 'RIVL\'s rating is an Elo built from scoring margin, rebuilt every night.' : 'RIVL\'s rating is this season\'s scoring margin blended with last season\'s, weighted by games played.') + (f.soH || f.soA ? ' A missing player costs what he produces above his team\'s own bench, scaled by his minutes; a ? marks a status short of out, counted in part.' : '');
          const note = (f.mkt != null ? `The forecast starts from the market line and lets RIVL's rating, rest and injuries pull it (${Math.round((1 - f.w) * 100)}% RIVL). ` : '') + ratingNote + ` <a href="#record">How the calls have done</a>`;
          body += sec(g.state === 'post' ? `Had ${esc(fav.short)} ${pct(p)}` : `Why ${esc(fav.short)} ${pct(p)}`) + `<div class="gxplate gxwhy">${grid}</div><div class="gxplate gxkv">${lines.map(([k, v]) => `<div class="kvr"><span>${k}</span><b>${v}</b></div>`).join('')}</div><p class="why-n">${note}</p>`;
        }
        if (report) body += report;
        if (plays.length && g.state !== 'pre') body += sec(g.state === 'in' ? 'Last plays' : 'Final plays', '', `<button data-act="gtab" data-tab="plays">All plays</button>`) + `<div class="gpls">${plays.map((p, i) => [p, i]).slice(-5).reverse().map(([p, i]) => runMark(i) + playCard(L, lk, g, p, ppl)).join('')}</div>`;
        if (series) body += series;
        if (g.state !== 'post') { const ws = watchFor(g, L); const list = ws.length ? ws.map(w => `<a class="row" href="${esc(w.href)}" target="_blank" rel="noopener"><span class="t"><b>${esc(w.label || w.short)}</b><span>${esc(typeof w.bundle === 'string' ? `Through ${w.bundle}` : tvLabel(g) ? `Live on ${tvLabel(g)}` : 'Opens in the app')}</span></span>${chev}</a>`).join('') : (tvLabel(g) ? `<div class="row"><span class="t"><b>${esc(tvLabel(g))}</b><span><a href="#settings/watch">Pick your services</a> to get a direct link here.</span></span></div>` : ''); if (list) body += sec('Where to watch') + `<div class="rows gxrows">${list}</div>`; }
        if (gi) body += gi;
      } else if (tab === 'box') {
        // tap a column to sort by it (most first, again for least); minutes is the order the feed gives
        const numOf = v => { const t = String(v ?? '').trim(); if (!t) return -Infinity; const m = /^([+-]?\d+(?:\.\d+)?)/.exec(t.replace(/^\+/, '')); return m ? parseFloat(m[1]) * (t.startsWith('-') && !t.startsWith('--') ? 1 : 1) : -Infinity; };
        const table = side => { const p = boxOf(side); const st0 = p && p.statistics && p.statistics[0]; if (!st0) return ''; const labels = st0.labels || []; const ath = st0.athletes || []; const rowOf = a => { const sn = a.athlete.shortName || a.athlete.displayName || ''; const nm = `<a href="${href.player(lk, a.athlete.id)}">${esc(sn.length > 15 ? V.lastName(a.athlete.displayName || sn) : sn)}</a>`; if (a.didNotPlay || !a.stats || !a.stats.length) return `<tr><td class="l">${nm}</td><td class="l mut" colspan="${labels.length}">${esc(a.reason || 'Did not play')}</td></tr>`; return `<tr${focus && String(a.athlete.id) === String(focus) ? ` class="hl" style="${tcv(V._.teamColor(side, L))}"` : ''}><td class="l">${nm}</td>${a.stats.map((v, i) => `<td${labels[i] === bv.col ? ' class="sorted"' : ''}>${esc(v)}</td>`).join('')}</tr>`; }; const mi = labels.indexOf('MIN'); const mins = a => mi >= 0 && a.stats && a.stats[mi] ? parseFloat(String(a.stats[mi]).replace(':', '.')) || 0 : 0; const played = a => !(a.didNotPlay || !a.stats || !a.stats.length || (mi >= 0 && !mins(a))); const ci = labels.indexOf(bv.col); const byCol = (x, y) => { if (ci < 0 || !x.stats || !y.stats) return mins(y) - mins(x); const d = numOf(y.stats[ci]) - numOf(x.stats[ci]); return (bv.dir === 'asc' ? -d : d) || mins(y) - mins(x); }; const st = ath.filter(a => a.starter).sort(byCol), bn = ath.filter(a => !a.starter && played(a)).sort(byCol), dnp = ath.filter(a => !a.starter && !played(a)); const tot = st0.totals && st0.totals.length ? `<tr class="tot"><td class="l">Team</td>${st0.totals.map(v => `<td><b>${esc(v)}</b></td>`).join('')}</tr>` : ''; const th = l => `<th${l === bv.col ? ' class="sorted"' : ''}><button data-act="bsort" data-col="${esc(l)}" aria-sort="${l === bv.col ? (bv.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">${esc(l)}${l === bv.col ? (bv.dir === 'asc' ? ' ▴' : ' ▾') : ''}</button></th>`; const hd = (name, first) => `<tr class="bxh"><th class="l">${name}</th>${labels.map(first ? th : l => `<th>${esc(l)}</th>`).join('')}</tr>`; return `<div class="tw"><table class="tbl box bx7"><tbody>${hd(st.length ? 'Starters' : 'Players', true)}${st.map(rowOf).join('')}${bn.length ? hd('Bench') + bn.map(rowOf).join('') : ''}${dnp.length ? `<tr class="bxh"><th class="l">Did not play</th><th colspan="${labels.length}"></th></tr>${dnp.map(a => `<tr class="dnp"><td class="l"><a href="${href.player(lk, a.athlete.id)}">${esc(a.athlete.shortName || a.athlete.displayName)}</a></td><td class="l mut" colspan="${labels.length}">${esc(a.reason || 'Did not play')}</td></tr>`).join('')}` : ''}${tot}</tbody></table></div>`; };
        let lead = '';
        if (focus) {
          for (const side of [g.away, g.home]) { const p = boxOf(side); const st0 = p && p.statistics && p.statistics[0]; const a = st0 && (st0.athletes || []).find(x => String(x.athlete.id) === String(focus)); if (!a) continue;
            const labels = st0.labels || [], descs = st0.descriptions || []; const get = l => { const k = labels.indexOf(l); return k >= 0 && a.stats ? a.stats[k] : ''; }; const tc = V._.teamColor(side, L);
            const big = [['PTS', 'Points'], ['REB', 'Rebounds'], ['AST', 'Assists']].map(([k, n]) => `<div><b>${esc(get(k) || '0')}</b><span>${n}</span></div>`).join('');
            /* the rest as a key–value list in two columns — shooting, minutes and plus/minus down the left, rebounds, defence
               and fouls down the right — labels on the left of each column, values right-aligned, a percentage beside each
               made-attempted line. The feed's own labels ("Field Goals Made/Attempted") were too long to scan. */
            const NAME = { MIN: 'Minutes', FG: 'Field goals', '3PT': 'Threes', FT: 'Free throws', OREB: 'Off. rebounds', DREB: 'Def. rebounds', STL: 'Steals', BLK: 'Blocks', TO: 'Turnovers', PF: 'Fouls', '+/-': 'Plus/minus' };
            const LEFT = ['FG', '3PT', 'FT', 'MIN', '+/-'], RIGHT = ['OREB', 'DREB', 'STL', 'BLK', 'TO', 'PF'];
            const pctOf = v => { const m = /^(\d+)-(\d+)$/.exec(String(v || '').trim()); return m && +m[2] > 0 ? `<em>${Math.round(100 * m[1] / m[2])}%</em>` : ''; };
            const kv = l => { const v = get(l); if (v === '' || v == null) return ''; return `<div class="kv"><span>${esc(NAME[l] || descs[labels.indexOf(l)] || l)}</span><b>${esc(v)}${/^(FG|3PT|FT)$/.test(l) ? pctOf(v) : ''}</b></div>`; };
            const extra = labels.filter(l => !['PTS', 'REB', 'AST'].includes(l) && !LEFT.includes(l) && !RIGHT.includes(l));
            const rest = a.stats && a.stats.length ? `<div class="col">${LEFT.map(kv).join('')}</div><div class="col">${RIGHT.concat(extra).map(kv).join('')}</div>` : '';
            const pos = a.athlete.position && (a.athlete.position.abbreviation || a.athlete.position.name) || '';
            lead = `<div class="pfocus" style="${tcv(tc)}"><a class="who" href="${href.player(lk, a.athlete.id)}">${headshot(hsUrl(a.athlete), tc, 56, a.athlete.displayName)}<span class="t"><b>${esc(a.athlete.displayName || a.athlete.shortName || '')}</b><span>${esc([side.short, pos, a.athlete.jersey ? `No. ${a.athlete.jersey}` : ''].filter(Boolean).join(' · '))}${a.starter ? ' · Started' : ''}</span></span>${chev}</a>${a.didNotPlay || !a.stats || !a.stats.length ? `<p class="legend">${esc(a.reason || 'Did not play')}</p>` : `<div class="stats three">${big}</div><div class="pdet">${rest}</div>`}</div>`;
            break; }
        }
        const bsw = `<div class="gxtsw">${[['away', g.away], ['home', g.home]].map(([k, t]) => `<button data-act="bside" data-team="${k}" aria-pressed="${bv.side === k}">${gxL(t.logo)}<b>${esc(t.abbr)}</b></button>`).join('')}</div>`;
        const bt = table(bv.side === 'away' ? g.away : g.home);
        body = lead + `<div class="gxctl bxtop">${bsw}</div><div class="gxout">` + (bt ? `<div class="bxcard">${bt}</div>` : empty('No box score yet')) + unitsT + '</div>';
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
          const pid = '';   // the player filter chips are gone; plays always show everyone
          const filt = plays.map((p, i) => [p, i]).filter(([p]) => (pick === 'all' || (p.period && p.period.number) === pick) && (!pv.scoring || p.scoringPlay) && (!pid || involves(p, pid)));
          const ctl = `<div class="gxseg"><button data-act="pscoring" data-v="1" aria-pressed="${!!pv.scoring}">Key plays</button><button data-act="pscoring" data-v="0" aria-pressed="${!pv.scoring}">All plays</button></div>`
            + `<div class="gxseg q"><button data-act="pq" data-q="all" aria-pressed="${pick === 'all'}">All</button>${periods.map(n => `<button data-act="pq" data-q="${n}" aria-pressed="${pick === n}">${pname(n)}</button>`).join('')}</div>`
            ;
          const more = filt.length > pv.n; const groups = []; filt.reverse().slice(0, pv.n).forEach(([p, i]) => { const k = p.period && p.period.number; const grp = groups[groups.length - 1]; if (!grp || grp.k !== k) groups.push({ k, label: p.period && p.period.displayValue || '', list: [[p, i]] }); else grp.list.push([p, i]); });
          const nRuns = [...runs.keys()].filter(i => filt.some(([, j]) => j === i)).length;
          body = `<div class="gxctl">${ctl}</div>` + '<div class="gxout">' + (groups.length ? groups.map(gr => sec(gr.label.replace(/(\d)(st|nd|rd|th) Quarter/, 'Quarter $1'), pick === 'all' && nRuns && gr === groups[0] ? `${runs.size} run${runs.size === 1 ? '' : 's'} of 8–0 or more marked` : '') + `<div class="gpls">${gr.list.map(([p, i]) => runMark(i) + playCard(L, lk, g, p, ppl)).join('')}</div>`).join('') : empty(pid ? `Nothing for ${esc(V.lastName(pname2[pid]))} in that span` : 'No scoring plays in that span')) + (more ? `<button class="gxmore" data-act="pmore">Show more plays</button>` : '') + '</div>';
        }
      } else if (tab === 'shots') {
        const teamOf = s => s.side === 'home' ? g.home : g.away;
        const pick = sv.team === 'home' || sv.team === 'away' ? sv.team : 'both';
        const pool = shots.filter(s => (pick === 'both' || s.side === pick) && (!sv.q || s.period === sv.q));
        const sper = [...new Set(shots.map(s => s.period).filter(n => n != null))].sort((a, b) => a - b);
        const spn = n => n <= L.periods ? (L.periods === 2 ? (n === 1 ? '1st half' : '2nd half') : `Q${n}`) : (n - L.periods > 1 ? `OT${n - L.periods}` : 'OT');
        const qseg = `<div class="gxseg q"><button data-act="sv-q" data-q="0" aria-pressed="${!sv.q}">All</button>${sper.map(n => `<button data-act="sv-q" data-q="${n}" aria-pressed="${sv.q === n}">${spn(n)}</button>`).join('')}</div>`;
        const tally = side => { const l = pool.filter(s => s.side === side); return `${l.filter(s => s.made).length}-${l.length}`; };
        // players with attempts on the chosen side, most attempts first
        const byP = new Map(); pool.forEach(s => { const k = s.pid || s.name; if (!k) return; const e = byP.get(k) || { k, name: s.name, n: 0, m: 0 }; e.n++; if (s.made) e.m++; byP.set(k, e); });
        const players = [...byP.values()].sort((a, b) => b.n - a.n).slice(0, 10);
        const who = sv.pid && byP.has(sv.pid) ? sv.pid : '';
        const list = who ? pool.filter(s => (s.pid || s.name) === who) : pool;
        const sides = pick === 'both' ? [{ head: g.away.abbr, filter: s => s.side === 'away' }, { head: g.home.abbr, filter: s => s.side === 'home' }] : [{ head: who ? V.lastName(byP.get(who).name) : teamOf({ side: pick }).abbr }];
        const pair = V._.pairColors(L, g.away, g.home); const cv = [['a', pair[0]], ['h', pair[1]]].map(([k, c]) => `--c${k}-d:${esc(V._.lift(c))};--c${k}-l:${esc(V._.deep(c))}`).join(';');
        const tsw = `<div class="gxtsw">${[['both', null], ['away', g.away], ['home', g.home]].map(([k, t]) => `<button data-act="sv-team" data-team="${k}" aria-pressed="${pick === k}">${t ? `${gxL(t.logo)}<b>${esc(t.abbr)}</b>` : '<b>Both</b>'}</button>`).join('')}</div>`;
        const key = (col) => `<span class="kk"><i style="background:${esc(col)}"></i>Made</span><span class="kk"><em style="color:${esc(col)}">✕</em>Missed</span>`;
        const shleg2 = `<div class="gxshleg">${pick !== 'home' ? `<div><b>${logo(g.away.logo, 's')}${esc(g.away.abbr)} ${tally('away')}</b><span>${key(pair[0])}</span></div>` : '<div></div>'}${pick !== 'away' ? `<div class="r"><b>${esc(g.home.abbr)} ${tally('home')}${logo(g.home.logo, 's')}</b><span>${key(pair[1])}</span></div>` : ''}</div>`;
        body = `<div class="gxctl">${tsw}</div><div class="gxout"><div class="gxcw">${gxCourt(L, list, pair[0], pair[1], g.home.logo)}</div>` + shleg2 + qseg + sec('By zone', `${list.length} shot${list.length === 1 ? '' : 's'}${g.state === 'in' ? ' so far' : ''}`) + zoneRows(list, sides) + `<p class="legend">Every field-goal attempt, where it was taken from. Free throws aren't on the chart.</p></div>`;
      } else if (tab === 'stats') {
        const rows = ta && th ? cmpRows(flat(ta).map(x => x.name).filter(n => get(th, n))) : '';
        body = rows ? `<div class="cmp" style="padding-top:6px">${cmpHead}${rows}</div>` : empty(g.state === 'pre' ? 'Stats arrive at tip-off' : 'No team stats yet');
      }
      const scrollY = window.scrollY;
      const side = t => ({ short: t.short, abbr: t.abbr, logo: t.logo, color: V._.teamColor(t), score: t.score, rec: t.rec || '' });
      const card = g.state === 'pre' ? null : { kind: 'game', away: side(g.away), home: side(g.home), status: g.state === 'post' ? finalWord(g) : g.detail, sub: tvLabel(g) || (d.gameInfo && d.gameInfo.venue && d.gameInfo.venue.fullName) || '', date: dayLabel(ymdOf(g.date), { weekday: 'long', month: 'long', day: 'numeric' }), note: f && prefs.get('forecast') ? `RIVL had ${(f.pHome >= .5 ? g.home : g.away).short} ${pct(Math.max(f.pHome, 1 - f.pHome))}` : '', title: `${g.away.short} ${g.away.score ?? ''}, ${g.home.short} ${g.home.score ?? ''}`, text: `${g.away.short} ${g.away.score ?? ''}, ${g.home.short} ${g.home.score ?? ''} · ${g.state === 'post' ? finalWord(g) : g.detail}`, file: `${g.away.abbr}-${g.home.abbr}-${ymdOf(g.date)}` };
      // the page is three parts: the head (bar + hero) changes only when the score does, the chips only toggle, the body swaps
      const venue = d.gameInfo && d.gameInfo.venue ? [d.gameInfo.venue.fullName, d.gameInfo.venue.address && d.gameInfo.venue.address.city].filter(Boolean).join(', ') : '';
      if (!g.tbd) {
        const c = gxColors(L, g); const vars = `--aw:${esc(c.ca)};--ha:${esc(c.ch)}${gxLead(g)}`;
        const inner = gxInner(L, lk, g, f, venue);
        const day = local && paint.day ? paint.day : await scoreboard(L, ymdOf(g.date), g.state === 'in' ? 15000 : 60000).catch(() => null); if (day) paint.day = day;
        const barHtml = gxBar(L, g, title, card, gxStrip(L, g, day)), page = $main.querySelector('#gpage');
        if (page && page.dataset.gid === String(id) && page.querySelector('#gxhero')) {
          const hero = page.querySelector('#gxhero'), bar = page.querySelector('#gxbar');
          if (hero.dataset.v !== vars) { hero.setAttribute('style', vars); hero.dataset.v = vars; }
          page.classList.toggle('nowp', !(f && !g.off));
          const inn = page.querySelector('#gxin'); const ih = hashOf(inner); if (inn.dataset.h !== ih) { gxPatch(inn, inner); inn.dataset.h = ih; }
          const bh = hashOf(barHtml); if (bar.dataset.h !== bh) { gxPatch(bar, barHtml); bar.dataset.h = bh; }
          const tabsEl = page.querySelector('#gtabs'); if (tabsEl.dataset.k !== tabKey) { tabsEl.innerHTML = tabs; tabsEl.dataset.k = tabKey; }
          else tabsEl.querySelectorAll('.chip').forEach(x => { const on = x.dataset.tab === tab; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-selected', String(on)); });
          const bodyEl = page.querySelector('#gbody'); const bhh = hashOf(body); const tabChanged = bodyEl.dataset.tab !== tab;
          let pan = bodyEl.querySelector(`:scope > [data-p="${tab}"]`);
          if (!pan) { pan = document.createElement('div'); pan.dataset.p = tab; bodyEl.appendChild(pan); }
          if (pan.dataset.h !== bhh) { if (pan.firstChild) gxPatch(pan, body); else pan.innerHTML = body; pan.dataset.h = bhh; }
          if (tabChanged) { bodyEl.querySelectorAll(':scope > [data-p]').forEach(x => { x.hidden = x !== pan; }); bodyEl.dataset.tab = tab; gxPin(); }
          if (!local) gxFit(); if (gxScroll.run) gxScroll.run();
        } else {
          $main.innerHTML = `<div id="gpage" class="gxpage${f && !g.off ? '' : ' nowp'}" data-gid="${esc(String(id))}">`
            + `<section class="gx" id="gxhero" data-v="${esc(vars)}" style="${vars}">${LOBES}<div class="gxin" id="gxin" data-h="${hashOf(inner)}">${inner}</div></section>`
            + `<div class="gxbar" id="gxbar" data-h="${hashOf(barHtml)}">${barHtml}</div>`
            + `<div class="gxscroll" id="gxscroll"><div class="gxspace"></div><div class="gxsheet"><div id="gtabs" class="gxtabw" data-k="${tabKey}">${tabs}</div><div id="gbody" data-tab="${tab}"><div data-p="${tab}" data-h="${hashOf(body)}">${body}</div></div></div></div></div>`;
          gxFit(); gxScroll(); if (gxScroll.run) gxScroll.run();
          { const box = document.getElementById('gxscroll'); if (mem.y && !focus) { box.scrollTop = mem.y; requestAnimationFrame(() => { box.scrollTop = mem.y; if (gxScroll.run) gxScroll.run(); }); }
            let tm = 0; box.addEventListener('scroll', () => { clearTimeout(tm); tm = setTimeout(save, 150); }, { passive: true }); }
          requestAnimationFrame(() => { gxFit(); const st = document.getElementById('gxstrip'), cur = st && st.querySelector('.cur'); if (cur) st.scrollLeft = cur.offsetLeft - (st.clientWidth - cur.offsetWidth) / 2; });
        }
        /* a basket lands: the scorer's colour flashes forward */
        if (gameV.last && gameV.last.id === g.id && g.state === 'in') { if (+g.home.score > gameV.last.h) gxPulse('home'); else if (+g.away.score > gameV.last.a) gxPulse('away'); }
        gameV.last = { id: g.id, a: +g.away.score || 0, h: +g.home.score || 0 };
        document.title = `${g.away.short} at ${g.home.short} · RIVL`;
        return g;
      }
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
    V._gtabL = e => { const b = e.target.closest('[data-act="gtab"],[data-act="pq"],[data-act="pscoring"],[data-act="sv-team"],[data-act="sv-pid"],[data-act="sv-q"],[data-act="bsort"],[data-act="pf"],[data-act="bside"],[data-act="pmore"]'); if (!b) return; const a = b.dataset.act; if (a === 'pq' || a === 'pscoring' || a === 'pf') pv.n = 30; if (a === 'pmore') pv.n += 40; else if (a === 'bside') bv.side = b.dataset.team; else if (a === 'gtab') tab = b.dataset.tab; else if (a === 'pq') pv.q = b.dataset.q === 'all' ? 'all' : +b.dataset.q; else if (a === 'pscoring') pv.scoring = b.dataset.v != null ? b.dataset.v === '1' : !pv.scoring; else if (a === 'sv-team') { sv.team = b.dataset.team; sv.pid = ''; } else if (a === 'sv-pid') sv.pid = b.dataset.pid; else if (a === 'sv-q') sv.q = +b.dataset.q || 0; else if (a === 'bsort') { const c = b.dataset.col; if (bv.col === c) { if (bv.dir === 'desc') bv.dir = 'asc'; else { bv.col = ''; bv.dir = 'desc'; } } else { bv.col = c; bv.dir = 'desc'; } } else if (a === 'pf') pf.pid = b.dataset.pid === pf.pid ? '' : b.dataset.pid; save();
      /* show the choice now; draw the rest on the next frame from what is already loaded */
      const grp = b.parentElement; if (grp && (grp.classList.contains('gxseg') || grp.classList.contains('gxtsw'))) grp.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      requestAnimationFrame(() => setTimeout(() => paint(undefined, true), 0)); };
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
    box.innerHTML = `<div class="chart" style="--ca-d:${esc(V._.lift(c))};--ca-l:${esc(V._.deep(c))}">${courtSvg(L, shots, { colorOf: () => 'var(--ca)' })}<div class="clegend"><span><i style="background:var(--ca)"></i>Made</span><span><em class="missx" style="color:var(--ca)">✕</em>Missed</span></div></div>` + zoneRows(shots, [{ head: `${games} game${games === 1 ? '' : 's'}` }]) + `<p class="legend">Every field-goal attempt over the last ${games} game${games === 1 ? '' : 's'} with play-by-play, where it was taken from.</p>`;
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
        if (n.tagName === 'A') { const u = n.getAttribute('href') || ''; const here = inApp(u, idxs); if (here) n.setAttribute('href', here); else n.replaceWith(...n.childNodes); }   // a link goes somewhere in RIVL — a player, a team, a game, another story — or it is plain text; nothing leads out
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
    if (!a) { $main.innerHTML = topbar('Story', '#home') + empty("Couldn't load this story", `<p style="margin:6px 0 0">The feed didn't answer. <a href="#" data-act="reload">Try again</a>.</p>`); return; }
    // team links in ESPN stories use the abbreviation, so load the index for any league the story links to
    const raw = h && h.story || '';
    const idxs = {}; await Promise.all([...new Set([...raw.matchAll(/espn\.com\/(nba|wnba|mens-college-basketball|womens-college-basketball)\/team\/_\/name\//gi)].map(x => LG[x[1].toLowerCase()]))].map(async k => { idxs[k] = await teamsIndex(LEAGUES[k]).catch(() => ({})); }));
    const story = raw ? clean(raw, idxs) : '';
    const vids = (h && (h.video || h.videos) || cached && (cached.video || cached.videos) || []).filter(v => v && v.links); vids.forEach(v => { if (v.id != null) S.videos[String(v.id)] = v; });
    const clips = vids.length ? sec('Clips') + `<div class="media">${vids.map(v => `<button class="clip" data-act="play" data-vid="${esc(String(v.id))}"><div class="th">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy">` : ''}<i><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg></i>${v.duration ? `<em>${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}</em>` : ''}</div><b>${esc(v.headline || v.title || '')}</b></button>`).join('')}</div>` : '';
    const premium = !story || (h && h.premium);
    const bodyHtml = story ? `<div class="body">${story}</div>` : `<p class="dek">${esc(a.description || cached && cached.description || '')}</p>`;
    // the whole story is here, so nothing points back to ESPN; only a paywalled or summary-only piece gets a way out
    const tail = premium ? `<div class="empty" style="margin-top:18px"><b>That's all the feed shares of this one</b><p style="margin:6px 0 0">The rest is behind a paywall.</p></div>` : '';
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
    if ($main._srClick) $main.removeEventListener('click', $main._srClick);
    $main.addEventListener('click', $main._srClick = e => {
      if (!document.body.contains(inp)) return;
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
  /* the photo editor: drag to move, pinch or the slider to zoom, inside a frame of the given shape (a circle for your
     photo with a preview of the icon, a 3:1 strip for your header); Save hands back exactly what's in the frame */
  function cropImage(file, o, done) {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const W = Math.min(320, window.innerWidth - 56), H = Math.round(W * o.h / o.w); let z = 1, x = 0, y = 0; const base = Math.max(W / img.width, H / img.height);
      const ov = document.createElement('div'); ov.className = 'pcrop';
      ov.innerHTML = `<div class="pcbox"><div class="pch"><button data-pc="no">Cancel</button><b>${o.title}</b><button data-pc="ok" class="on">Save</button></div>
        <div class="pcstage${o.round ? ' round' : ''}" style="width:${W}px;height:${H}px"><img src="${url}" alt="" draggable="false"><i class="pcring"></i></div>
        <input class="pczoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">
        ${o.round ? `<div class="pcprev"><span class="pcav"><img src="${url}" alt=""></span><span>How it looks at the top of the app</span></div>` : '<p class="pcnote">Drag to choose what shows across the top of your profile</p>'}</div>`;
      document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('in'));
      const st = ov.querySelector('.pcstage'), im = st.querySelector('img'), pv = ov.querySelector('.pcav img'), zr = ov.querySelector('.pczoom');
      const dims = () => [img.width * base * z, img.height * base * z];
      const draw = () => { const [w, h] = dims(); x = Math.min(0, Math.max(W - w, x)); y = Math.min(0, Math.max(H - h, y)); im.style.cssText = `width:${w}px;height:${h}px;transform:translate(${x}px,${y}px)`; if (pv) { const k = 40 / W; pv.style.cssText = `width:${w * k}px;height:${h * k}px;transform:translate(${x * k}px,${y * k}px)`; } };
      const zoomTo = (nz, cx = W / 2, cy = H / 2) => { nz = Math.min(4, Math.max(1, nz)); x = cx - (cx - x) * nz / z; y = cy - (cy - y) * nz / z; z = nz; zr.value = z; draw(); };
      { const [w, h] = dims(); x = (W - w) / 2; y = (H - h) / 2; } draw();
      const pts = new Map(); let last = null, pinch = null;
      st.addEventListener('pointerdown', e => { st.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z }; } });
      st.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()], r = st.getBoundingClientRect(); zoomTo(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); return; }
        if (pts.size === 1 && last) { x += e.clientX - last[0]; y += e.clientY - last[1]; last = [e.clientX, e.clientY]; draw(); } });
      const up = e => { pts.delete(e.pointerId); pinch = null; last = pts.size ? [...pts.values()][0] : null; };
      st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
      st.addEventListener('wheel', e => { e.preventDefault(); const r = st.getBoundingClientRect(); zoomTo(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      zr.addEventListener('input', () => zoomTo(+zr.value));
      const close = () => { ov.classList.remove('in'); setTimeout(() => { ov.remove(); URL.revokeObjectURL(url); }, 260); };
      ov.addEventListener('click', e => { const b = e.target.closest('[data-pc]'); if (!b) return;
        if (b.dataset.pc === 'ok') { const ow = o.out, oh = Math.round(o.out * o.h / o.w), c = document.createElement('canvas'); c.width = ow; c.height = oh; const sc = ow / W; const [w, h] = dims(); c.getContext('2d').drawImage(img, x * sc, y * sc, w * sc, h * sc);
          let data = ''; try { data = c.toDataURL('image/jpeg', o.round ? .88 : .8); } catch (err) { } close(); if (data) { try { done(data); } catch (err) { } } }
        else close(); });
    };
    img.src = url;
  }
  async function settingsV(cat = '') {
    const P = prefs.all(); const theme = store.get('v5:theme', 'system'); const accent = store.get('v5:accent', 'mono');
    const F = favs.all(); const fp = fplayers.all();
    const here = SETTINGS.find(([k]) => k === cat);
    const bar = (title, backTo) => `<div class="topbar"><a class="ib" href="${backTo}" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><span class="ttl">${esc(title)}</span></div>`;
    const nTeams = ORDER.reduce((n, k) => n + (F[k] || []).length, 0);
    const standalone = V.standalone ? V.standalone() : false;

    if (!here && cat !== 'profile') {   // the index, v7 style: a profile card, then Following and App groups
      const nSvc = HW.myServices().length;
      const name = store.get('v5:name', '') || '';
      let fav = ''; { const J = store.get('v5:jersey', null); if (J && J.k && LEAGUES[J.k]) { const idx = await teamsIndex(LEAGUES[J.k]).catch(() => ({})); const t = idx[String(J.id)]; if (t) fav = t.name || t.short; } }
      const SICO = { teams: ICONS.following, players: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2 .7 3.5 2.4 3.5 5.3"/></svg>',
        display: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>' };
      const sum = { home: `${PREFS.filter(([k]) => P[k] !== false).length} of ${PREFS.length} sections on`, sync: V.sync && V.sync.available() ? (V.sync.code() ? `Code ${V.sync.code()}` : 'Not backed up') : 'Needs the RIVL server', app: standalone ? 'Installed' : 'Add to home screen' };
      const row = (href, ico, t, sub) => `<a class="srow" href="${href}"><span class="sico">${ico}</span><span class="t"><b>${esc(t)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>${chev}</a>`;
      $main.innerHTML = bar('Settings', '#home') + `<div class="setv7">
        <a class="sprof" href="#settings/profile"><span class="sav avbtn">${window.RIVL_avatar ? window.RIVL_avatar() : esc((name || 'You').trim().charAt(0).toUpperCase())}</span><span class="t"><b>${esc(name || 'Add your name')}</b><span>${fav ? `Jersey: ${esc(fav)}` : 'Your profile and jersey'}</span></span>${chev}</a>
        <h2 class="sgh">Following</h2><div class="sgrp">${row('#teams', SICO.teams, 'Teams', `${nTeams} team${nTeams === 1 ? '' : 's'}`)}${row('#players', SICO.players, 'Players', `${fp.length} player${fp.length === 1 ? '' : 's'}`)}</div>
        <h2 class="sgh">App</h2><div class="sgrp">${row('#settings/home', SICO.display, 'Display', `Following page: ${sum.home}`)}${row('#settings/watch', ICONS.watch, 'Where you watch', nSvc ? `${nSvc} service${nSvc === 1 ? '' : 's'}` : 'None picked yet')}${row('#settings/sync', ICONS.sync, 'Sync', sum.sync)}${row('#settings/app', ICONS.app, 'App', sum.app)}${row('#settings/about', ICONS.about, 'About and sources', 'Where the numbers come from')}</div></div>`;
      return;
    }
    if (cat === 'profile') {
      /* the profile: your jersey (your name across the back, your number, your team's colours) on that team's moving colour,
         which fades down into the page. You pick the jersey's team from the teams you follow; nothing is assumed. */
      const name = store.get('v5:name', '') || '';
      const J = store.get('v5:jersey', null) || {};
      const lks = ORDER.filter(k => (F[k] || []).length || fp.some(p => p.lk === k));
      const idxs = {}; await Promise.all(lks.map(async k => { idxs[k] = await teamsIndex(LEAGUES[k]).catch(() => ({})); }));
      const teams = lks.flatMap(k => (F[k] || []).map(id => ({ k, t: idxs[k][String(id)] })).filter(x => x.t));
      const pick = teams.find(x => x.k === J.k && String(x.t.id) === String(J.id)) || null;
      const num = String(J.num == null || J.num === '' ? '1' : J.num).slice(0, 2);
      const lum = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return .5; const n = parseInt(m[1], 16); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(n >> 16 & 255) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255); };
      const main = pick ? teamColor({ id: pick.t.id, abbr: pick.t.abbr }, LEAGUES[pick.k]) : '#3A3D44';
      let trim = pick ? (V._.teamAlt({ id: pick.t.id, abbr: pick.t.abbr, alt: pick.t.alt }, LEAGUES[pick.k]) || '') : '#9AA0AA';
      if (!trim || trim.toLowerCase() === String(main).toLowerCase()) trim = lum(main) > .5 ? '#0A0B0E' : '#FFFFFF';
      const ink = lum(main) > .45 ? '#0A0B0E' : '#FFFFFF';
      store.set('v5:jlook', { main, trim, ink, num }); if (window.RIVL_paintAv) window.RIVL_paintAv();
      const photo = store.get('v5:avatar', '');
      const back = (name || 'YOU').toUpperCase().slice(0, 12), fs = back.length > 9 ? 9 : back.length > 6 ? 11 : 13;
      const jersey = `<svg class="pfjer" viewBox="0 0 120 140" role="img" aria-label="Your jersey"><defs>
          <linearGradient id="jsh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
          <linearGradient id="jhi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <path id="jarc" d="M28 40 Q60 30 92 40"/></defs>
        <path d="M30 6C38 4 42 3 46 3C50 10 70 10 74 3C78 3 82 4 90 6L92 9C93 27 100 36 113 40V131C113 135.5 110.5 138 106 138H14C9.5 138 7 135.5 7 131V40C20 36 27 27 28 9Z" fill="${esc(main)}"/>
        <path d="M30 6C38 4 42 3 46 3C50 10 70 10 74 3C78 3 82 4 90 6L92 9C93 27 100 36 113 40V131C113 135.5 110.5 138 106 138H14C9.5 138 7 135.5 7 131V40C20 36 27 27 28 9Z" fill="url(#jsh)"/>
        <path d="M30 6C38 4 42 3 46 3C50 10 70 10 74 3C78 3 82 4 90 6L92 9C93 27 100 36 113 40V131C113 135.5 110.5 138 106 138H14C9.5 138 7 135.5 7 131V40C20 36 27 27 28 9Z" fill="url(#jhi)"/>
        <path d="M46 3C50 10 70 10 74 3M28 9C27 27 20 36 7 40M92 9C93 27 100 36 113 40" fill="none" stroke="${esc(trim)}" stroke-width="3.2" stroke-linecap="round"/>
        <text font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="${fs}" letter-spacing="1.2" fill="${ink}" text-anchor="middle"><textPath href="#jarc" startOffset="50%">${esc(back)}</textPath></text>
        <text x="60" y="${num.length > 1 ? 104 : 106}" font-family="Inter,system-ui,sans-serif" font-weight="900" font-size="${num.length > 1 ? 50 : 56}" fill="${ink}" stroke="${esc(trim)}" stroke-width="2.4" paint-order="stroke" text-anchor="middle" letter-spacing="-2">${esc(num)}</text>
      </svg>`;
      /* your teams and players as small cards in the style of the roster cards: the team's colour, its crest large and
         faint behind, and the crest or the player's cut-out photo in front with the name across the bottom */
      const crest = x => { const c = teamColor({ id: x.t.id, abbr: x.t.abbr }, LEAGUES[x.k]); return `<a class="pfcr pfcard" href="${href.team(x.k, x.t.id)}" aria-label="${esc(x.t.name)}" style="--rc:${esc(c)}">${x.t.logo ? `<img class="pfwm" src="${esc(x.t.logo)}" alt="" loading="lazy"><img class="pflogo" src="${esc(x.t.logo)}" alt="" loading="lazy">` : ''}<span>${esc(x.t.short || x.t.abbr || '')}</span></a>`; };
      const face = p => { const c = playerColor(p, LEAGUES[p.lk]); return `<a class="pfpl pfcard" href="${href.player(p.lk, p.id)}" style="--rc:${esc(c)}">${p.img ? `<img class="pfshot" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()">` : `<b class="pfini">${esc((p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2))}</b>`}<span>${esc(p.short || p.name || '')}</span></a>`; };
      const choose = x => `<button class="pfpick${pick === x ? ' on' : ''}" data-jk="${x.k}" data-jid="${esc(x.t.id)}">${x.t.logo ? `<img src="${esc(x.t.logo)}" alt="" loading="lazy">` : ''}<span>${esc(x.t.short || x.t.name)}</span><em>${esc(LEAGUES[x.k].label)}</em></button>`;
      /* the jersey picker is split by league (NBA, WNBA, College) so you scroll a short list from the top */
      const grpOf = k => k.startsWith('ncaa') ? 'college' : k;
      const JG = [['nba', 'NBA'], ['wnba', 'WNBA'], ['college', 'College']].filter(([g]) => teams.some(x => grpOf(x.k) === g));
      const jg0 = pick ? grpOf(pick.k) : (JG[0] || [''])[0];
      /* X-style profile: your header picture across the top (or your team's colours with its crest), your photo
         overlapping it in a team-colour ring, your name and team, your counts, then your teams and players. "Edit profile"
         opens a sheet to change the header, the photo, the name and number, and the jersey team. */
      const banner = store.get('v5:banner', ''), tlogo = pick && pick.t.logo || '';
      /* a very dark team colour (navy, black) is lifted in lightness, keeping its hue, so the moving header glows like a team page's */
      const vivid = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return c; const n = parseInt(m[1], 16); let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, sa = 0, l = (mx + mn) / 2; const d = mx - mn;
        if (d) { sa = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
        if (l >= .3) return c; l = .34; sa = sa < .05 ? 0 : Math.max(sa, .55); return `hsl(${Math.round(h)} ${Math.round(sa * 100)}% ${Math.round(l * 100)}%)`; };
      const avHTML = photo ? `<img src="${esc(photo)}" alt="Your photo">` : `<span class="xpini" style="background:${esc(main)};color:${esc(ink)}">${esc((name || '').trim().charAt(0).toUpperCase() || '+')}</span>`;
      const banHTML = banner ? `<img class="xpbimg" src="${esc(banner)}" alt="">` : (() => { /* exactly a team page's header: the same moving colour layers, the same two colours, and the crest floating at the right */
        const alt2 = pick ? (V._.teamAlt({ id: pick.t.id, abbr: pick.t.abbr, alt: pick.t.alt }, LEAGUES[pick.k]) || '') : ''; const c2 = alt2 && alt2.toLowerCase() !== String(main).toLowerCase() ? alt2 : V._.deep(main); const sl = soloLayer(c2);
        return `<div class="tmpage xptm"><section class="gx solo ${sl.cls}" style="--aw:${esc(main)};--ha:${esc(c2)};--t2:${esc(c2)}">${LOBES}${sl.html}${tlogo ? `<img class="tmcrest xpcrest" src="${esc(tlogo)}" alt="">` : ''}</section></div>`; })();   // your team's colour moving, the way a team page's header does
      const cam = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
      $main.innerHTML = `<div class="pfpage xprof" style="--pc:${esc(main)};--pc2:${esc(trim)}">
        <div class="xpban">${banHTML}<a class="xpback" href="#home" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a></div>
        <div class="xprow"><span class="xpav">${avHTML}</span><button class="xpedit" data-act="xpopen">Edit profile</button></div>
        <div class="xpid"><h1>${esc(name || 'Your name')}</h1><p class="xpteam">${pick ? `${tlogo ? `<img src="${esc(tlogo)}" alt="">` : ''}${esc(pick.t.name || pick.t.short)}${num ? ` · #${esc(num)}` : ''}` : 'Pick your team in Edit profile'}</p>
          <p class="xpst"><a href="#teams"><b>${teams.length}</b> Teams</a><a href="#players"><b>${fp.length}</b> Players</a></p></div>
        <div class="pfsec"><h2>Your teams</h2><a href="#teams">Edit</a></div>${teams.length ? `<div class="pfrail">${teams.map(crest).join('')}</div>` : `<a class="pfcta" href="#teams"><span class="t"><b>Pick your teams</b><span>They lead Following and get your updates</span></span>${chev}</a>`}
        <div class="pfsec"><h2>Your players</h2><a href="#players">Edit</a></div>${fp.length ? `<div class="pfrail">${fp.map(face).join('')}</div>` : `<a class="pfcta" href="#players"><span class="t"><b>Follow some players</b><span>Their lines show up on Following</span></span>${chev}</a>`}
      </div>`;
      /* the editor sheet */
      const openEdit = () => {
        const ov = document.createElement('div'); ov.className = 'xpsheet';
        const sheet = () => { const ph = store.get('v5:avatar', ''), bn = store.get('v5:banner', '');
          return `<div class="xpsbox"><div class="pch"><button data-xp="no">Cancel</button><b>Edit profile</b><button data-xp="ok" class="on">Save</button></div><div class="xpsbody">
            <div class="xpsban">${bn ? `<img src="${esc(bn)}" alt="">` : `<span class="xpbdef"></span>`}<label class="xpcam">${cam}<input type="file" accept="image/*" data-up="banner" hidden></label>${bn ? '<button class="xpx" data-xp="nobanner" aria-label="Remove header">×</button>' : ''}</div>
            <div class="xpsav"><span class="xpav">${ph ? `<img src="${esc(ph)}" alt="">` : `<span class="xpini" style="background:${esc(main)};color:${esc(ink)}">${esc((name || '').trim().charAt(0).toUpperCase() || '+')}</span>`}</span><label class="xpcam sm">${cam}<input type="file" accept="image/*" data-up="avatar" hidden></label></div>
            ${ph ? '<button class="xplink" data-xp="nophoto">Remove photo</button>' : ''}
            <label class="xpf"><span>Name</span><input id="xpname" type="text" maxlength="12" autocomplete="given-name" autocapitalize="words" value="${esc(store.get('v5:name', '') || '')}"></label>
            <label class="xpf"><span>Jersey number</span><input id="xpnum" type="text" inputmode="numeric" maxlength="2" value="${esc(num)}"></label>
            <div class="xpf"><span>Your team</span>${teams.length ? `<div class="chips pfjtabs">${JG.map(([g, l]) => `<button class="chip${g === jg0 ? ' on' : ''}" data-jg="${g}" aria-pressed="${g === jg0}">${l}</button>`).join('')}</div>${JG.map(([g]) => `<div class="pfpicks" data-jgp="${g}"${g === jg0 ? '' : ' hidden'}>${teams.filter(x => grpOf(x.k) === g).map(choose).join('')}</div>`).join('')}` : '<p class="xpnote">Follow a team first; then its colours can be yours.</p>'}</div>
          </div></div>`; };
        ov.innerHTML = sheet(); document.body.appendChild(ov); document.documentElement.classList.add('sheet-open'); requestAnimationFrame(() => ov.classList.add('in'));
        let jk = J.k, jid = J.id;
        const close = done => { ov.classList.remove('in'); document.documentElement.classList.remove('sheet-open'); setTimeout(() => ov.remove(), 280); if (done) settingsV('profile'); };
        const keepFields = () => ({ n: (ov.querySelector('#xpname') || {}).value, u: (ov.querySelector('#xpnum') || {}).value });
        const repaint = () => { const k = keepFields(); ov.innerHTML = sheet(); ov.querySelector('#xpname').value = k.n || ''; ov.querySelector('#xpnum').value = k.u || ''; mark(); };
        const mark = () => ov.querySelectorAll('[data-jk]').forEach(b => b.classList.toggle('on', b.dataset.jk === jk && String(b.dataset.jid) === String(jid)));
        ov.addEventListener('click', e => { const b = e.target.closest('[data-xp],[data-jk],[data-jg]'); if (!b) { if (e.target === ov) close(); return; } e.preventDefault();
          if (b.dataset.jg) { const g = b.dataset.jg; ov.querySelectorAll('[data-jg]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); ov.querySelectorAll('[data-jgp]').forEach(x => { x.hidden = x.dataset.jgp !== g; }); return; }
          if (b.dataset.jk) { jk = b.dataset.jk; jid = b.dataset.jid; mark(); return; }
          const a = b.dataset.xp;
          if (a === 'no') close();
          else if (a === 'nobanner') { store.set('v5:banner', ''); repaint(); }
          else if (a === 'nophoto') { store.set('v5:avatar', ''); if (window.RIVL_paintAv) window.RIVL_paintAv(); repaint(); }
          else if (a === 'ok') { store.set('v5:name', (ov.querySelector('#xpname').value || '').trim()); store.set('v5:jersey', { ...(store.get('v5:jersey', null) || {}), num: (ov.querySelector('#xpnum').value || '').replace(/\D/g, '').slice(0, 2), k: jk, id: jid }); close(true); }
        });
        ov.addEventListener('change', e => { const inp = e.target.closest('[data-up]'); if (!inp) return; const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return; const ban = inp.dataset.up === 'banner';
          cropImage(f, ban ? { w: 3, h: 1, out: 1200, round: false, title: 'Move and scale your header' } : { w: 1, h: 1, out: 192, round: true, title: 'Move and scale your photo' }, data => { store.set(ban ? 'v5:banner' : 'v5:avatar', data); if (!ban && window.RIVL_paintAv) window.RIVL_paintAv(); repaint(); }); });
        mark();
      };
      $main.querySelector('[data-act="xpopen"]').addEventListener('click', e => { e.preventDefault(); openEdit(); });
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
    } else if (cat === 'sync') {
      body = sec('Sync') + (V.sync && V.sync.available() ? `<div class="rows"><button class="row" data-act="sync-up"><span class="t"><b>${V.sync.code() ? `Back up to code ${esc(V.sync.code())}` : 'Back up to a code'}</b><span class="wrap">Your teams, players and settings, so another device can pick them up</span></span>${chev}</button></div><div class="search" style="margin-top:6px"><input id="syncCode" type="text" placeholder="Enter a code from another device" autocomplete="off" autocapitalize="characters" maxlength="6" aria-label="Sync code"></div><div class="rows"><button class="row" data-act="sync-down"><span class="t"><b>Restore from that code</b><span class="wrap">Replaces what's followed on this device</span></span>${chev}</button></div>` : empty('Sync needs the RIVL server', '<p style="margin:6px 0 0">Carry your teams and players to another phone or laptop with a six-character code.</p>'));
    } else if (cat === 'app') {
      body = sec('App') + `<div class="rows">${standalone ? '' : `<button class="row" data-act="install"><span class="t"><b>Add to home screen</b><span class="wrap">Opens full screen like an app, your teams first</span></span>${chev}</button>`}<button class="row" data-act="onb-restart"><span class="t"><b>Run setup again</b><span class="wrap">Pick teams and players from the start</span></span>${chev}</button><button class="row" data-act="perfopen"><span class="t"><b>Performance log</b><span class="wrap">Stays on this phone. Copy it to send to Claude</span></span>${chev}</button></div>`;
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
    /* What RIVL showed: the line pulled by its own pregame margin (the nightly keeps that margin with each call). Scored from the
       line as the app saw it that morning (`line0`) when the nightly kept one, else from the closing line, which knew more — so
       the number here is the conservative reading. The line's weight follows the app: 0.9 until both sides have played eight
       games, the tuned weight after; each side's games played come with the call, or are counted back from the record. */
    const params = await HW.params(L).catch(() => null); const w0 = params && params.mkt != null ? params.mkt : 0.6;
    const spreadOf = (g, ln) => { const m = String(ln || '').match(/^([A-Z]{2,5})\s*([+-]?\d+(?:\.\d+)?)$/i); if (!m) return /^(EVEN|PK)$/i.test(String(ln || '').trim()) ? 0 : null; const pts = Math.abs(parseFloat(m[2])); return m[1].toUpperCase() === String(g.h || '').toUpperCase() ? pts : -pts; };
    const gpBefore = {}; { const seen = {}; games.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id))).forEach(g => { gpBefore[g.id] = [seen[g.hid] || 0, seen[g.aid] || 0]; seen[g.hid] = (seen[g.hid] || 0) + 1; seen[g.aid] = (seen[g.aid] || 0) + 1; }); }
    const wOf = g => { const gh = g.gh != null ? g.gh : (gpBefore[g.id] || [0, 0])[0], ga = g.ga != null ? g.ga : (gpBefore[g.id] || [0, 0])[1]; return gh < HW.EARLY_GP || ga < HW.EARLY_GP ? HW.EARLY_W : w0; };
    const blendP = g => { const mk = spreadOf(g, g.line0 || g.line); if (mk == null || g.m == null) return null; const w = wOf(g); return HW.calibrate(HW.Phi((w * mk + (1 - w) * g.m) / sd), params && params.calib ? params.calib : null); };
    const anyBlend = games.some(g => blendP(g) != null); const anyMorning = games.some(g => g.line0);
    const cols = anyBlend ? [['RIVL', blendP], ['Ratings', g => g.p], ['ESPN', g => g.ep != null ? g.ep : null], ['Line', lineP]] : [['Ratings', g => g.p], ['ESPN', g => g.ep != null ? g.ep : null], ['Line', lineP]];
    const since = days => { const cut = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); return games.filter(g => g.date >= cut); };
    const spans = [['Season', games], ['Last 30 days', since(30)], ['Last 7 days', since(7)]];
    const fmt = x => x == null ? '—' : x.toFixed(3);
    const pctf = x => x == null ? '—' : Math.round(x * 100) + '%';
    const table = (title, rows) => { const sc = cols.map(([k, f]) => [k, score(rows, f)]); const best = sc.filter(([, x]) => x).sort((a, b) => a[1].brier - b[1].brier)[0]; return sec(title, `${rows.length} game${rows.length === 1 ? '' : 's'}`) + `<div class="why"><div class="why-h why3 why-n${cols.length}"><span></span>${sc.map(([k]) => `<span class="wt"><b>${k}</b></span>`).join('')}</div><div class="why-r why3 why-n${cols.length}"><span>Brier score</span>${sc.map(([k, x]) => `<b class="${best && best[0] === k ? 'up' : ''}">${fmt(x && x.brier)}</b>`).join('')}</div><div class="why-r why3 why-n${cols.length}"><span>Right side</span>${sc.map(([k, x]) => `<b class="${best && best[0] === k ? 'up' : ''}">${pctf(x && x.hit)}</b>`).join('')}</div><div class="why-r why3 why-n${cols.length}"><span>Scored</span>${sc.map(([, x]) => `<b>${x ? x.n : '—'}</b>`).join('')}</div></div>`; };
    const recent = games.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12);
    const list = sec('Latest calls') + `<div class="rows">${recent.map(g => { const homeWon = g.hs > g.as; const shown = blendP(g) != null ? blendP(g) : g.p; const pick = shown >= .5 ? g.h : g.a; const hit = (shown >= .5) === homeWon; const conf = Math.round(Math.max(shown, 1 - shown) * 100); return `<a class="row" href="${href.game(lk, g.id)}"><span class="t"><b>${esc(g.a)} ${g.as} at ${esc(g.h)} ${g.hs}</b><span>${esc(dayLabel(g.date, { weekday: 'short', month: 'short', day: 'numeric' }))} · RIVL had ${esc(pick)} ${conf}%${g.line ? ` · line ${esc(g.line)}` : ''}</span></span><span class="res ${hit ? 'w' : 'l'}">${hit ? 'Hit' : 'Miss'}</span></a>`; }).join('')}</div>`;
    $main.innerHTML = topbar('Record', '#settings/about', '', null, false) + lkChips + spans.map(([t, rows]) => rows.length ? table(t, rows) : '').join('') + list +
      `<p class="legend">Brier score is the squared error of the chance given to the home team, averaged: 0 is perfect, 0.25 is a coin flip, lower is better. ${anyBlend ? `RIVL is the number the game pages showed: the line pulled by RIVL's own pregame margin${anyMorning ? ', scored from the line as it stood that morning where the nightly kept it, the closing line otherwise' : ', scored from the closing line, which knew more than the morning one the app had'}. Ratings is the margin from the ratings alone, with no line. ` : ''}Line is the closing line's own chance on the same curve the model uses; nobody beats it for long, and it is the bar. ESPN's is their published pregame number. Every call is the one made before tip-off and never revised. The injury adjustment isn't scored: the lists aren't kept game by game.</p>`;
  }

  Object.assign(V, { record: recordV, standings: standingsV, teams: teamsV, team: teamV, game: gameV, venue: venueV, article: articleV, search: searchV, settings: settingsV });
})();
