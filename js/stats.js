/* STATS: the league's leaders, the MLS way. Players, Teams and Rookies along the top; a card per category with the
   leader large in his team's colour and the next two under him; "View all" opens the full board with every category one
   tap away. Everything comes from the app's data file (one download for the league), so the screen is instant. */
(function () {
  'use strict';
  const V = HW.v5, _ = V._, esc = HW.esc, store = HW.store, LEAGUES = HW.LEAGUES, ORDER = HW.ORDER;
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
    const tab0 = store.get('v5:sttab', 'players'), board0 = store.get('v5:stboard:' + lk, '');
    $main.innerHTML = _.skeleton(1, 'card') + _.skeleton(3, 'card');
    const [lg, idx, st, TS] = await Promise.all([HW.hub.league(L).catch(() => null), V.teamsIndex(L).catch(() => ({})), HW.standings(L).catch(() => null), HW.teamStats ? HW.teamStats(L).catch(() => null) : null]);
    if (!lg || !lg.players || !lg.players.length) { $main.innerHTML = _.empty('No stats yet', '<p style="margin:6px 0 0">The league\'s numbers will show here once its season has games.</p>'); return; }
    const byAbbr = {}; Object.values(idx || {}).forEach(t => { if (t && t.abbr) byAbbr[t.abbr] = t; });
    const maxG = Math.max(1, ...lg.players.map(p => (p.s || {}).gp || 0));
    const qual = p => { const s = p.s || {}; return (s.gp || 0) >= Math.max(1, Math.ceil(maxG * .5)) && (s.min || 0) >= (lk.startsWith('ncaa') ? 10 : 12); };
    let R = null; const getR = () => R ? Promise.resolve(R) : HW.rating.league(L).then(r => (R = r)).catch(() => null);
    const tabs = [['players', 'Players'], ['teams', 'Teams']].concat(lg.players.some(p => p.rookie) ? [['rookies', 'Rookies']] : []);
    let tab = tabs.some(t => t[0] === tab0) ? tab0 : 'players', board = board0;
    const note = lg.lastSeason ? `<p class="stnote">${esc(lg.label)} season. The new season's numbers take over once it has games.</p>` : '';

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
        const v = key === 'wp' ? (r.w + r.l ? r.w / (r.w + r.l) : null) : key === 'ortg' || key === 'drtg' || key === 'pace' ? ts[key] : r[key];
        return { r, t: { ...t, id: r.id, logo: r.logo || t.logo, name: t.name || r.name, short: t.short || r.short }, v: v == null ? null : +v }; }).filter(x => x.v != null && !isNaN(x.v));
      const dir = (TCATS.find(c => c[0] === key) || [])[3] || 1; return rows.sort((a, b) => dir * (b.v - a.v));
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
    function homeHTML() {
      const seg = `<div class="gxtabs sttabs" role="tablist">${tabs.map(([k, l]) => `<button class="chip${k === tab ? ' on' : ''}" data-stt="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>`;
      const body = tab === 'teams' ? TCATS.map(c => tcard(c[0])).join('') || _.empty('No team numbers yet')
        : (tab === 'rookies' ? ROOK : CATS.map(c => c[0])).map(k => pcard(k, tab === 'rookies')).join('');
      const extra = tab === 'rookies' ? (() => { const top = list('pts', true).slice(0, 3); return top.length > 1 ? `<button class="stcmp" data-xq="${esc(top.map(x => x.p.n).join(' vs '))}">Compare the top rookies</button>` : ''; })() : '';
      return `<div class="page-h"><h1>Stats</h1><p>${esc(lg.label || '')}${lg.lastSeason ? ', last season' : ''}</p></div>${seg}${note}${extra}${body}`;
    }
    const paint = () => { $main.innerHTML = `<div class="stpage">${board ? boardHTML() : homeHTML()}</div>`; };
    paint();
    // the RIVL rating board needs the whole league worked out; it fills in when ready
    getR().then(() => { if (document.querySelector('.stpage') && (board === 'rating' || !board)) { const y = window.scrollY; paint(); window.scrollTo(0, y); } });
    if ($main._stClick) $main.removeEventListener('click', $main._stClick);
    $main.addEventListener('click', $main._stClick = e => {
      if (!$main.querySelector('.stpage')) return;
      const t = e.target.closest('[data-stt]'); if (t) { tab = t.dataset.stt; store.set('v5:sttab', tab); paint(); return; }
      const b = e.target.closest('[data-stb]'); if (b) { e.preventDefault(); const was = !!board; board = b.dataset.stb; store.set('v5:stboard:' + lk, board); paint(); if (!was) window.scrollTo(0, 0); return; }
      if (e.target.closest('[data-act="stback"]')) { board = ''; store.set('v5:stboard:' + lk, ''); paint(); window.scrollTo(0, 0); return; }
      const c = e.target.closest('.stcmp[data-xq]'); if (c) { store.set('v5:xq', c.dataset.xq); store.set('v5:xf', 'all'); location.hash = '#search'; }
    });
    document.title = `Stats · ${L.label} · MSHQ`;
  }
  V.stats = statsV;
})();
