/* STATS: the league's leaders, the MLS way. Players, Teams and Rookies along the top; a card per category with the
   leader large in his team's colour and the next two under him; "View all" opens the full board with every category one
   tap away. Everything comes from the app's data file (one download for the league), so the screen is instant. */
(function () {
  'use strict';
  const V = HW.v5, _ = V._, esc = HW.esc, store = HW.store, LEAGUES = HW.LEAGUES, ORDER = HW.ORDER;
  const J = (n, f) => HW.perf ? HW.perf.job(n, f) : f();
  const one = v => v == null || isNaN(v) ? '-' : (Math.round(v * 10) / 10).toFixed(1);
  const pct = v => v == null || isNaN(v) ? '-' : (+v).toFixed(1);
  /* per-game categories need real games; percentages need real attempts. The bars follow the NBA's own idea (a share of
     the games, a floor of attempts), scaled to how far into the season we are */
  const CATS = [
    ['pts', 'Points', 'PPG', s => s.pts], ['reb', 'Rebounds', 'RPG', s => s.reb], ['ast', 'Assists', 'APG', s => s.ast],
    ['stl', 'Steals', 'SPG', s => s.stl], ['blk', 'Blocks', 'BPG', s => s.blk], ['tpm', 'Threes made', '3PM', s => s.tpm],
    ['fg', 'Field goal %', 'FG%', s => s.fg, s => (s.fgm || 0) * (s.gp || 0) >= 3 * Math.max(1, s.__g)], ['tp', '3-point %', '3P%', s => s.tp, s => (s.tpm || 0) * (s.gp || 0) >= 1 * Math.max(1, s.__g)],
    ['ft', 'Free throw %', 'FT%', s => s.ft, s => (s.ftm || 0) * (s.gp || 0) >= 1.2 * Math.max(1, s.__g)], ['min', 'Minutes', 'MPG', s => s.min], ['dd', 'Double-doubles', 'DD', s => s.dd], ['rating', 'RIVL rating', 'OVR', null]];
  const ROOK = ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm', 'fg', 'min', 'rating'];
  const TCATS = [['ppg', 'Points scored', 'PPG', 1], ['opp', 'Fewest allowed', 'OPP', -1], ['diff', 'Point margin', '+/-', 1], ['wp', 'Win %', 'PCT', 1], ['ortg', 'Offensive rating', 'ORTG', 1], ['drtg', 'Defensive rating', 'DRTG', -1], ['pace', 'Pace', 'PACE', 1]];

  async function statsV(lk) {
    const L = LEAGUES[lk], $main = document.getElementById('main');
    const tab0 = store.get('v5:sttab', 'players'), board0 = '';
    // the title and tabs paint at once, so the screen is never blank while the numbers load
    { const up = $main.querySelector('.stpage'); if (!up || up.dataset.lk !== lk) $main.innerHTML = `<div class="stpage" data-lk="${lk}"><div class="page-h"><h1>Stats</h1><p>${esc(L.label)}</p></div>${(_.skeleton(1, 'card') + _.skeleton(3, 'card')).replace(/<!--skel-->/g, '')}</div>`; }   // the league's stats already up stay up while fresh numbers load
    let [lg, idx, st0, TS] = await Promise.all([HW.hub.league(L).catch(() => null), V.teamsIndex(L).catch(() => ({})), HW.standings(L).catch(() => null), HW.teamStats ? HW.teamStats(L).catch(() => null) : null]);
    /* team numbers come from the same season as the player numbers: when the league is showing last season (college before
       its games start), the team boards read last season's final standings, not this season's 0-0 table */
    const played = x => x && Object.values(x.byId || {}).some(r => r.w + r.l > 0);
    let st = st0; if (lg && (lg.lastSeason || !played(st0))) { const prev = await HW.standings(L, lg.lastSeason ? lg.year : HW.seasonYear() - 1).catch(() => null); if (played(prev)) st = prev; }
    // v401: college keeps its Recruits tab even when the feed has no player numbers yet
    const noNums = !lg || !lg.players || !lg.players.length;
    const REC0 = noNums && lk.startsWith('ncaa') ? await HW.hub.recruits().catch(() => null) : null;
    if (noNums && REC0 && REC0[lk === 'ncaaw' ? 'girls' : 'boys']) lg = { label: L.label, players: [], noNums: true };
    else if (noNums) { $main.innerHTML = _.empty('No stats yet', '<p style="margin:6px 0 0">The league\'s numbers will show here once its season has games.</p>'); return; }
    const byAbbr = {}; Object.values(idx || {}).forEach(t => { if (t && t.abbr) byAbbr[t.abbr] = t; });
    const maxG = Math.max(1, ...lg.players.map(p => (p.s || {}).gp || 0));
    const qual = p => { const s = p.s || {}; return (s.gp || 0) >= Math.max(1, Math.ceil(maxG * .5)) && (s.min || 0) >= (lk.startsWith('ncaa') ? 10 : 12); };
    let R = HW.rating.leagueNow ? HW.rating.leagueNow(L) : null; const getR = () => R ? Promise.resolve(R) : HW.rating.league(L).then(r => (R = r)).catch(() => null);   // a league rated earlier paints with its rating at once
    const REC = lk.startsWith('ncaa') ? await HW.hub.recruits().catch(() => null) : null, recG = lk === 'ncaaw' ? 'girls' : 'boys';   // high-school recruits live under college only: boys on NCAA M, girls on NCAA W
    const recCls = REC && REC[recG] ? Object.keys(REC[recG]).filter(k => (REC[recG][k] || []).length).sort() : [];
    let rcls = store.get('v5:strcls', recCls[0] || '');
    if (!recCls.includes(rcls)) rcls = recCls[0] || '';
    const tabs = (lg.noNums ? [] : [['players', 'Players'], ['teams', 'Teams']]).concat(lg.players.some(p => p.rookie) ? [['rookies', 'Rookies']] : []).concat(recCls.length ? [['recruits', 'Recruits']] : []);
    let tab = tabs.some(t => t[0] === tab0) ? tab0 : tabs[0][0], board = board0;
    const note = lg.noNums ? `<p class="stnote">Player and team numbers show here once the feed has them.</p>` : lg.lastSeason ? `<p class="stnote">${esc(lg.label)} season. The new season's numbers take over once it has games.</p>` : '';

    const face = (p, size) => _.headshot(p.img, _.teamColor({ abbr: p.team, id: (byAbbr[p.team] || {}).id }, L), size, p.n);
    const tLogo = (t, size) => t && t.logo ? `<img src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" style="width:${size}px;height:${size}px;object-fit:contain">` : '';
    function list(key, rookies) {
      if (key === 'rating') {
        if (!R) return null;
        return lg.players.filter(p => (!rookies || p.rookie) && R.byId[String(p.id)]).map(p => ({ p, v: R.byId[String(p.id)].ovr, q: R.byId[String(p.id)].qualified })).filter(x => x.q).sort((a, b) => b.v - a.v);
      }
      const c = CATS.find(c => c[0] === key);
      return lg.players.filter(p => (!rookies || p.rookie) && qual(p)).map(p => { const s = { ...(p.s || {}), __g: maxG }; return { p, v: c[3](s), ok: c[4] ? c[4](s) : true }; }).filter(x => x.v != null && x.ok).sort((a, b) => b.v - a.v);
    }
    const fmt = (key, v) => key === 'rating' || key === 'dd' ? String(Math.round(v)) : ['fg', 'tp', 'ft'].includes(key) ? pct(v) : one(v);
    function pcard(key, rookies) {
      const c = CATS.find(c => c[0] === key), rows = list(key, rookies);
      if (!rows) return `<div class="gxplate stcard" data-cat="${key}"><div class="sth"><b>${esc(c[1])}</b></div><div class="stload">${_.skeleton(1, 'row').replace('<!--skel-->', '')}</div></div>`;
      if (!rows.length) return '';
      const top = rows[0], t = byAbbr[top.p.team] || {}, col = _.teamColor({ abbr: top.p.team, id: t.id }, L);
      return `<div class="gxplate stcard" data-cat="${key}"><button class="sth" data-stb="${key}"><b>${esc(c[1])}</b><span>View all ${_.chev}</span></button>
        <a class="sthero" href="${_.href.player(lk, top.p.id)}" style="${_.tcv(col)}">${t.logo ? `<img class="stwm" src="${esc(t.logo)}" alt="" loading="lazy">` : ''}${top.p.img ? `<img class="stshot" src="${esc(top.p.img)}" alt="" loading="lazy">` : ''}<span class="strk">1</span><span class="stwho"><b>${esc(top.p.n)}</b><em>${esc(t.short || top.p.teamName || top.p.team)}</em></span><span class="stv">${fmt(key, top.v)}<i>${esc(c[2])}</i></span></a>
        ${rows.slice(1, 3).map((x, i) => srow(x, i + 2, key)).join('')}</div>`;
    }
    function srow(x, n, key) { const t = byAbbr[x.p.team] || {};
      return `<a class="strow" href="${_.href.player(lk, x.p.id)}"><span class="strk">${n}</span>${face(x.p, 40)}<span class="stwho"><b>${esc(x.p.n)}</b><em>${esc(t.short || x.p.teamName || x.p.team)}${x.p.rookie && tab !== 'rookies' ? ' · Rookie' : ''}</em></span><b class="stv">${fmt(key, x.v)}</b></a>`; }

    function teamRows(key) {
      const rows = Object.values(st && st.byId || {}).map(r => { const t = idx[r.id] || {}; const ts = TS && TS.teams && TS.teams[String(r.id)] || {};
        const rec = (r.ovr || '').split('-').map(Number), W = rec.length === 2 && !isNaN(rec[0]) ? rec[0] : r.w, Lo = rec.length === 2 && !isNaN(rec[1]) ? rec[1] : r.l;
        const v = key === 'wp' ? (W + Lo ? W / (W + Lo) : null) : key === 'diff' && r.ppg != null && r.opp != null ? r.ppg - r.opp : key === 'ortg' || key === 'drtg' || key === 'pace' ? ts[key] : r[key];
        if (!(r.w + r.l > 0)) return { v: null }; return { r: { ...r, w: W, l: Lo }, t: { ...t, id: r.id, logo: r.logo || t.logo, name: t.name || r.name, short: t.short || r.short }, v: v == null ? null : +v }; }).filter(x => x.v != null && !isNaN(x.v));
      const dir = (TCATS.find(c => c[0] === key) || [])[3] || 1; return rows.sort((a, b) => dir * (b.v - a.v) || (b.r.w - b.r.l) - (a.r.w - a.r.l));
    }
    const tfmt = (key, v) => key === 'wp' ? v.toFixed(3).replace(/^0/, '') : key === 'diff' ? HW.sign(+v.toFixed(1)) : one(v);
    function tcard(key) {
      const c = TCATS.find(c => c[0] === key), rows = teamRows(key); if (!rows.length) return '';
      const top = rows[0], col = _.teamColor({ id: top.t.id, abbr: top.t.abbr }, L);
      return `<div class="gxplate stcard" data-cat="${key}"><button class="sth" data-stb="${key}"><b>${esc(c[1])}</b><span>View all ${_.chev}</span></button>
        <a class="sthero team" href="${_.href.team(lk, top.t.id)}" style="${_.tcv(col)}">${top.t.logo ? `<img class="stwm" src="${esc(top.t.logo)}" alt="" loading="lazy"><img class="stcrest" src="${esc(top.t.logo)}" alt="" loading="lazy">` : ''}<span class="strk">1</span><span class="stwho"><b>${esc(top.t.short || top.t.name)}</b><em>${top.r.w}-${top.r.l}</em></span><span class="stv">${tfmt(key, top.v)}<i>${esc(c[2])}</i></span></a>
        ${rows.slice(1, 3).map((x, i) => `<a class="strow" href="${_.href.team(lk, x.t.id)}"><span class="strk">${i + 2}</span>${tLogo(x.t, 34)}<span class="stwho"><b>${esc(x.t.short || x.t.name)}</b><em>${x.r.w}-${x.r.l}</em></span><b class="stv">${tfmt(key, x.v)}</b></a>`).join('')}</div>`;
    }

    function boardHTML() {
      const isT = tab === 'teams', cats = isT ? TCATS.filter(c => teamRows(c[0]).length) : (tab === 'rookies' ? CATS.filter(c => ROOK.includes(c[0])) : CATS);
      const key = cats.some(c => c[0] === board) ? board : cats[0][0], c = cats.find(c => c[0] === key);
      const rows = isT ? teamRows(key) : list(key, tab === 'rookies');
      const pills = `<div class="chips stpills">${cats.map(c => `<button class="chip${c[0] === key ? ' on' : ''}" data-stb="${c[0]}" aria-pressed="${c[0] === key}">${esc(c[1])}</button>`).join('')}</div>`;
      const body = !rows ? _.skeleton(8, 'row').replace('<!--skel-->', '') : !rows.length ? _.empty('No one qualifies yet') : `<div class="gxplate stboard">${rows.slice(0, isT ? 400 : 100).map((x, i) => isT
        ? `<a class="strow" href="${_.href.team(lk, x.t.id)}"><span class="strk">${i + 1}</span>${tLogo(x.t, 34)}<span class="stwho"><b>${esc(x.t.short || x.t.name)}</b><em>${x.r.w}-${x.r.l}</em></span><b class="stv">${tfmt(key, x.v)}</b></a>`
        : srow(x, i + 1, key)).join('')}</div>`;
      return `<div class="stbar"><button class="gxib stback" data-act="stback" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></button><h1>${esc(c[1])}</h1></div>${pills}${note}${body}
        ${!isT && rows && rows.length > 1 ? `<button class="stcmp" data-xq="${esc(rows.slice(0, 3).map(x => x.p.n).join(' vs '))}">Compare the top three</button>` : ''}`;
    }
    /* high-school recruits: basketball only (rank, position, size, school, commitment); tapping one opens the search card */
    function recHTML(bare) {
      const list = (REC[recG][rcls] || []).slice().sort((a, b) => (a.rank || 999) - (b.rank || 999));
      const pills = `<div class="stseg fit" role="tablist">${recCls.map(c => `<button class="${c === rcls ? 'on' : ''}" data-rcls="${esc(c)}" aria-pressed="${c === rcls}">Class of ${esc(c)}</button>`).join('')}</div>`;
      const row = r => `<a class="gr strec" href="${V.recruitHref ? V.recruitHref(recG, rcls, r) : '#search'}"><span class="strk">${r.rank || ''}</span>${_.headshot(r.img || '', '#5B6B8C', 40, r.n)}<span class="stwho"><b>${esc(r.n)}</b><em>${esc([r.pos, r.ht, r.hs].filter(Boolean).join(' · '))}</em></span><span class="strc${r.commitTo ? ' on' : ''}">${esc(r.commitTo ? r.commitTo.replace(/\s+(Hoosiers|Wildcats|Bears|Tigers|Bulldogs|Blue Devils|Tar Heels|Jayhawks|Spartans|Wolverines|Buckeyes|Huskies|Longhorns|Gators|Seminoles|Volunteers|Razorbacks|Crimson Tide|Trojans|Bruins|Ducks|Cardinals|Cougars|Mountaineers|Hurricanes|Gamecocks|Fighting Irish|Golden Eagles|Commodores|Rebels|Aggies|Sooners|Cyclones|Hawkeyes|Badgers|Boilermakers|Fighting Illini|Cornhuskers|Terrapins|Scarlet Knights|Nittany Lions|Orange|Yellow Jackets|Demon Deacons|Cavaliers|Hokies|Wolfpack|Panthers|Red Raiders|Horned Frogs|Mustangs|Buffaloes|Utes|Sun Devils|Wildcats)$/, '') : 'Uncommitted')}</span></a>`;
      if (bare) return `${pills}<div class="gl stboard">${list.map(row).join('')}</div><p class="stnote">Rankings from PrepRanks, a blend of the major recruiting services.</p>`;
      return `<div class="page-h"><h1>Recruits</h1><p>Top high school ${recG === 'girls' ? 'girls' : 'boys'}, ranked</p></div>${segHTML()}${pills}<div class="gl stboard">${list.map(row).join('')}</div><p class="stnote">Rankings from PrepRanks, a blend of the major recruiting services.</p>`;
    }
    const segHTML = () => `<div class="stseg" role="tablist">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-stt="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`;
    const tabsHTML = () => `<div class="gxtabs sttabs" role="tablist">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-stt="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`;
    /* the sheet (Ray's pick, Sheet A): one table, every number side by side; tap a column head to rank the whole table
       by it. The player column stays put while the numbers scroll sideways. */
    const PCOLS = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['tpm', '3PM'], ['stl', 'STL'], ['blk', 'BLK'], ['fg', 'FG%'], ['tp', '3P%'], ['ft', 'FT%'], ['min', 'MIN'], ['rating', 'RIVL']];
    const TCOLS = [['ppg', 'PTS'], ['opp', 'OPP'], ['diff', '+/-'], ['wp', 'PCT'], ['ortg', 'ORTG'], ['drtg', 'DRTG'], ['pace', 'PACE']];
    function sheetHTML(tab) {
      const isT = tab === 'teams', rookies = tab === 'rookies';
      const cols = isT ? TCOLS.filter(([k]) => teamRows(k).length) : PCOLS.filter(([k]) => k !== 'rating' || R);
      let sk = store.get(`v5:stsort:${lk}:${isT ? 't' : 'p'}`, isT ? 'ppg' : 'pts'); if (!cols.some(([k]) => k === sk)) sk = cols[0][0];
      const head = `<thead><tr><th class="spc">${isT ? 'Team' : rookies ? 'Rookie' : 'Player'}</th>${cols.map(([k, l]) => `<th class="${k === sk ? 'on' : ''}"><button data-sts="${k}" aria-sort="${k === sk ? 'descending' : 'none'}">${l}${k === sk ? ' <i>▾</i>' : ''}</button></th>`).join('')}</tr></thead>`;
      let body = '', n = 0;
      if (isT) {
        const order = teamRows(sk); n = order.length;
        const val = {}; cols.forEach(([k]) => { val[k] = {}; teamRows(k).forEach(x => { val[k][x.t.id] = x.v; }); });
        body = order.map((x, i) => `<tr><td class="spc"><a href="${_.href.team(lk, x.t.id)}"><span class="rk">${i + 1}</span>${tLogo(x.t, 24)}<b>${esc(x.t.short || x.t.name)}</b><small>${x.r.w}-${x.r.l}</small></a></td>${cols.map(([k]) => `<td class="${k === sk ? 'on' : ''}">${val[k][x.t.id] == null ? '–' : tfmt(k, val[k][x.t.id])}</td>`).join('')}</tr>`).join('');
      } else {
        const order = list(sk, rookies) || []; n = order.length;
        const cell = (p, k) => { if (k === 'rating') { const r = R && R.byId[String(p.id)]; return r && r.qualified ? String(Math.round(r.ovr)) : '–'; } const c = CATS.find(c => c[0] === k); const s0 = { ...(p.s || {}), __g: maxG }; const v = c[3](s0); return v == null || (c[4] && !c[4](s0)) ? '–' : fmt(k, v); };
        body = order.slice(0, 100).map((x, i) => { const t = byAbbr[x.p.team] || {}; return `<tr><td class="spc"><a href="${_.href.player(lk, x.p.id)}"><span class="rk">${i + 1}</span>${face(x.p, 26)}<b>${esc(lastNm(x.p.n))}</b><small>${esc(x.p.team || t.abbr || '')}</small></a></td>${cols.map(([k]) => `<td class="${k === sk ? 'on' : ''}">${cell(x.p, k)}</td>`).join('')}</tr>`; }).join('');
      }
      const cap = isT ? `Every team by ${esc((TCATS.find(c => c[0] === sk) || [])[1] || '').toLowerCase()}.` : `${n > 100 ? 'Top 100' : n} qualified ${rookies ? 'rookies' : 'players'} by ${esc((CATS.find(c => c[0] === sk) || [])[1] || '').toLowerCase()}. Percentages need enough attempts to count.`;
      return n ? `<div class="sheet2"><div class="shw"><table class="sht">${head}<tbody>${body}</tbody></table></div></div><p class="stnote">${cap} Tap a column to rank by it.</p>` : _.empty('No one qualifies yet');
    }
    const panelHTML = k => k === 'recruits' ? recHTML(true) : sheetHTML(k);   // v400: each tab its own panel, side by side
    const lastNm = n => { const p = String(n || '').split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };
    function homeHTML() {
      if (true) { const seg = `<div class="stseg" role="tablist">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}" data-stt="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`; return `<div class="page-h"><h1>Stats</h1><p>${esc(lg.label || '')}${lg.lastSeason ? ', last season' : ''}</p></div>${tabs.length > 1 ? seg : ''}${note}<div class="stpanels">${tabs.map(([k]) => `<div data-pg="${k}">${panelHTML(k)}</div>`).join('')}</div>`; }
      const seg = `<div class="gxtabs sttabs" role="tablist">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-stt="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`;
      const body = tab === 'teams' ? TCATS.map(c => tcard(c[0])).join('') || _.empty('No team numbers yet')
        : (tab === 'rookies' ? ROOK : CATS.map(c => c[0])).map(k => pcard(k, tab === 'rookies')).join('');
      const extra = tab === 'rookies' ? (() => { const top = list('pts', true).slice(0, 3); return top.length > 1 ? `<button class="stcmp" data-xq="${esc(top.map(x => x.p.n).join(' vs '))}">Compare the top rookies</button>` : ''; })() : '';
      return `<div class="page-h"><h1>Stats</h1><p>${esc(lg.label || '')}${lg.lastSeason ? ', last season' : ''}</p></div>${seg}${note}${extra}${body}`;
    }
    const paint = () => J('stats:paint', () => paint0()); const paint0 = () => { const up0 = $main.querySelector('.stpage'); if (!board && up0 && up0.dataset.lk === lk && up0.querySelector('.stpanels.pgr')) { up0.querySelectorAll('.stpanels > [data-pg]').forEach(el => { const h = panelHTML(el.dataset.pg); if (el._h !== h) { if (_.patch) _.patch(el, h); else el.innerHTML = h; el._h = h; } }); return; } if (board) { paint1(); return; } $main.innerHTML = `<div class="stpage" data-lk="${lk}">${homeHTML()}</div>`; { const tb = $main.querySelector('.stseg'), sp = $main.querySelector('.stpanels'); if (tb && sp) { const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--apb')) || 56; sp.querySelectorAll('[data-pg]').forEach(el => { el._h = panelHTML(el.dataset.pg); }); V._stpg = _.pager(tb, { tabs: tb, strip: sp, start: tab, stickTop: bar, thumb: true, onShow: k => { tab = k; store.set('v5:sttab', k); } }); if (!V._stpg) sp.querySelectorAll('[data-pg]').forEach(el => { el.hidden = el.dataset.pg !== tab; }); } } };
    const paint1 = () => { const html = `<div class="stpage" data-lk="${lk}">${board ? boardHTML() : homeHTML()}</div>`; const up = $main.querySelector('.stpage'); if (up && up.dataset.lk === lk && _.patch) _.patch(up, html.slice(html.indexOf('>') + 1, -6)); else $main.innerHTML = html; };
    paint();
    // the RIVL rating board needs the whole league worked out; it fills in when ready
    getR().then(() => { if (document.querySelector('.stpage') && (board === 'rating' || !board)) { const y = window.scrollY; paint(); window.scrollTo(0, y); } });
    // the league tab tapped again: out of a board, back to the cards
    if (document._stRetap) document.removeEventListener('rivl:retap', document._stRetap);
    document.addEventListener('rivl:retap', document._stRetap = () => { if (!$main.querySelector('.stpage') || !board) return; board = ''; store.set('v5:stboard:' + lk, ''); paint(); });
    if ($main._stClick) $main.removeEventListener('click', $main._stClick);
    $main.addEventListener('click', $main._stClick = e => {
      if (!$main.querySelector('.stpage')) return;
      const rc = e.target.closest('[data-rcls]'); if (rc) { rcls = rc.dataset.rcls; store.set('v5:strcls', rcls); paint(); return; }
      const so = e.target.closest('[data-sts]'); if (so) { const isT = tab === 'teams'; store.set(`v5:stsort:${lk}:${isT ? 't' : 'p'}`, so.dataset.sts); const shw = () => $main.querySelector(`.stpanels > [data-pg="${tab}"] .shw`) || $main.querySelector('.shw'); const w = shw(); const x = w ? w.scrollLeft : 0; paint(); const w2 = shw(); if (w2) w2.scrollLeft = x; return; }
      const t = e.target.closest('[data-stt]'); if (t) { tab = t.dataset.stt; store.set('v5:sttab', tab); paint(); return; }
      const b = e.target.closest('[data-stb]'); if (b) { e.preventDefault(); const was = !!board; board = b.dataset.stb; store.set('v5:stboard:' + lk, board); paint(); if (!was) window.scrollTo(0, 0); return; }
      if (e.target.closest('[data-act="stback"]')) { board = ''; store.set('v5:stboard:' + lk, ''); paint(); window.scrollTo(0, 0); return; }
      const c = e.target.closest('.stcmp[data-xq]'); if (c) { store.set('v5:xq', c.dataset.xq); store.set('v5:xf', 'all'); location.hash = '#search'; }
    });
    document.title = `Stats · ${L.label} · RIVL`;
  }
  V.stats = statsV;
})();
