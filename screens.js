/* RIVL v5 — the rest of the screens: standings, teams, team, game, article reader, search.
   Loaded after views.js; shares its helpers through HW.v5. */
(() => {
  'use strict';
  const { LEAGUES, ORDER, esc, j, jSoft, todayCT, addDays, dayLabel, relDay, tip, dateShort, ago, pct, ordinal, sign, hx, store, API, WEB,
    favs, parseEvent, isLive, isFav, interest, scoreboard, standings, rankings, injuries, forecast, forecastCtx, leaguePlayers, watchFor, S, ymdOf } = HW;
  const V = HW.v5;
  const { h: H, logo, headshot, chev, sec, empty, skeleton, href, safeF, gameCard, heroCard, teamInfo, teamsIndex, fplayers, prefs, starSvg, starLine, tvLabel, confName, dayUTC, athId, hsUrl, retInfo, teamColor, playerColor, learn, statusWord } = V._;
  /* a story's tags: ESPN marks each article with the teams and athletes it is about */
  const cats = a => a && a.categories || [];
  const taggedTeam = (a, id) => cats(a).some(c => c.type === 'team' && String(c.teamId || (c.team && c.team.id) || '') === String(id));
  const $main = document.getElementById('main');
  S.news = S.news || {}; S.videos = S.videos || {};
  const hide = `onerror="this.style.visibility='hidden'"`;
  const topbar = (title, backHref = '#home', extra = '', card = null, share = true) => `<div class="topbar"><a class="ib" href="${backHref}" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><span class="ttl">${title}</span><div class="sp">${extra}${share === false ? '' : `<button class="ib" data-act="share" data-title="${esc(title.replace(/<[^>]+>/g, ''))}"${card ? ` data-card='${esc(JSON.stringify(card))}'` : ''} aria-label="Share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></button>`}</div></div>`;
  const chips = (items, on, act, key) => `<div class="chips" role="tablist">${items.map(([k, l]) => `<button class="chip${k === on ? ' on' : ''}" data-act="${act}" data-${key}="${esc(k)}" aria-pressed="${k === on}">${esc(l)}</button>`).join('')}</div>`;
  const standingLine = (r, L) => !r ? '' : L.standingsMode === 'conferences' ? `${r.w}-${r.l}${r.conf ? `, ${r.conf} in the ${confName(r.group, r.groupAbbr)}` : ''}` : `${r.w}-${r.l}, ${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}`;

  /* news items, shared by every list: cache the object so the reader can open it without a second list fetch */
  function newsRow(lk, a, { thumb = true } = {}) {
    const id = String(a.id || (a.links && a.links.api && a.links.api.news && a.links.api.news.href || '').split('/').pop() || '');
    if (id) S.news[id] = a;
    const vids = (a.video || a.videos || []).filter(v => v && v.links); vids.forEach(v => { if (v.id != null) S.videos[String(v.id)] = v; });
    const im = a.images && a.images[0] && a.images[0].url;
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
    if (!items.some(([k]) => k === tab)) tab = items[0][0];
    if (tab === 'picture') {
      // the bracket as the table stands today: play-in pairs, then the first round, per conference
      const cut = L.playoffLine; const playIn = cut.length === 2;
      const tm = (r, seed, fr, sd) => r ? `<a class="bt ${sd}" href="${href.team(lk, r.id)}" style="--tc:${esc(teamColor({ id: r.id, abbr: r.abbr }, L))}"><i>${seed}</i>${logo(r.logo, 's', teamColor({ id: r.id, abbr: r.abbr }, L))}<span class="tx"><b>${esc(r.short || r.name)}</b><span>${r.w}-${r.l}</span></span></a>` : `<span class="bt tbd ${sd}"><i>${seed}</i><span class="tx"><b>${fr && playIn && seed > cut[0] ? 'Play-in winner' : 'TBD'}</b></span></span>`;
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
      $main.innerHTML = chips(items, tab, 'stab', 'tab') + (conf || groups.length > 1 ? groups.map(block).join('') : block({ rows: groups.flatMap(g => g.rows).sort((a, b) => (b.w - b.l) - (a.w - a.l) || (b.pct || 0) - (a.pct || 0) || (b.diff || 0) - (a.diff || 0)), name: L.label })) + legend;
      const on0 = $main.querySelector('.chip.on'); if (on0) on0.scrollIntoView({ inline: 'center', block: 'nearest' });
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
    const tieNote = (r, i) => { if (tab === 'league') return ''; const same = x => x && x.w === r.w && x.l === r.l; for (const c of cuts) { if (i === c - 1 && same(rows[c])) return c === cuts[0] ? `tied for the ${c} seed` : 'tied for the last play-in spot'; } return ''; };
    const trs = rows.map((r, i) => { const gl = [gbLine(r, i), tieNote(r, i)].filter(Boolean).join(' · '); return `<tr class="click${favs.has(lk, r.id) ? ' me' : ''}${cuts.includes(i + 1) ? ' cut' : ''}" data-href="${href.team(lk, r.id)}"><td><span class="tm"><span class="rk">${r.pos}</span>${logo(r.logo, 's', teamColor({ id: r.id, abbr: r.abbr }, L))}<span class="nm"><a href="${href.team(lk, r.id)}">${rk && rk[r.id] ? `<i class="ap">${rk[r.id]}</i>` : ''}${esc(r.short || r.name)}</a>${clinchTag(r)}${gl ? `<small>${esc(gl)}</small>` : ''}</span></span></td>${cols.map(c => `<td>${cell(r, c)}</td>`).join('')}</tr>`; }).join('');
    const legend = tab === 'league' ? '' : cuts.length === 2 ? `<p class="legend">Top ${cuts[0]} go straight to the playoffs; ${cuts[0] + 1} through ${cuts[1]} play in. Games back count the ${cuts[0]} seed and the last play-in spot. Your teams are marked.</p>` : cuts.length === 1 ? `<p class="legend">Top ${cuts[0]} make the playoffs. Your teams are marked.</p>` : '<p class="legend">Your teams are marked.</p>';
    $main.innerHTML = chips(items, tab, 'stab', 'tab') + `<div class="tw"><table class="tbl stand"><thead><tr><th>${esc(title)}</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table></div>` + legend;
    const on = $main.querySelector('.chip.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /* ================= TEAMS ================= */
  async function teamsV(lk) {
    const L = LEAGUES[lk];
    $main.innerHTML = skeleton(10, 'row');
    const [st, idx] = await Promise.all([standings(L).catch(() => null), teamsIndex(L)]);
    const q0 = store.get('v5:tq', '') || '', tab0 = store.get('v5:ttab', 'all');
    const groups = st && st.groups.length ? st.groups.map(g => ({ name: confName(g.name, g.abbr), full: g.name, rows: g.rows.map(r => ({ ...r, logo: r.logo || (idx[r.id] || {}).logo })) })) : [{ name: L.label, full: L.label, rows: Object.values(idx).map(t => ({ id: t.id, short: t.short, name: t.name, logo: t.logo })) }];
    const paint = () => {
      const q = (store.get('v5:tq', '') || '').trim().toLowerCase(), tab = store.get('v5:ttab', 'all');
      const blocks = groups.map(g => {
        let rows = g.rows.slice().sort((a, b) => (a.name || a.short).localeCompare(b.name || b.short));
        if (tab === 'following') rows = rows.filter(r => favs.has(lk, r.id));
        if (q) rows = rows.filter(r => `${r.name} ${r.short} ${r.abbr || ''}`.toLowerCase().includes(q));
        if (!rows.length) return '';
        return sec(g.name, '') + `<div class="rows">${rows.map(r => { const on = favs.has(lk, r.id); return `<div class="row prow"><a class="go" href="${href.team(lk, r.id)}" aria-label="${esc(r.name)}">${logo(r.logo, '', teamColor({ id: r.id, abbr: r.abbr }, L))}</a><a class="t" href="${href.team(lk, r.id)}"><b>${esc(r.name || r.short)}</b><span>${esc(standingLine(r, L) || '')}</span></a><button class="star${on ? ' on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(r.name)}">${on ? starSvg : starLine}</button></div>`; }).join('')}</div>`;
      }).filter(Boolean).join('');
      const el = $main.querySelector('#tlist'); if (el) el.innerHTML = blocks || empty(tab === 'following' ? 'No followed teams yet' : 'No team matches', tab === 'following' ? '<p style="margin:6px 0 0">Tap the star on any team to follow it.</p>' : '');
    };
    $main.innerHTML = `<div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="tq" type="search" placeholder="Search teams" value="${esc(q0)}" autocomplete="off" aria-label="Search teams"></div>` + chips([['all', 'All'], ['following', 'Following']], tab0, 'ttab', 'tab') + `<div id="tlist"></div>`;
    paint();
    const inp = $main.querySelector('#tq'); let t = null;
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { store.set('v5:tq', inp.value); paint(); }, 120); });
    $main.addEventListener('click', e => { const b = e.target.closest('[data-act="ttab"]'); if (!b) return; store.set('v5:ttab', b.dataset.tab); $main.querySelectorAll('[data-act="ttab"]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); paint(); });
    $main.addEventListener('rivl:fav', paint);
  }

  /* ================= TEAM ================= */
  async function teamV(lk, id) {
    const L = LEAGUES[lk]; if (!L || !id) { $main.innerHTML = empty('Team not found'); return; }
    $main.innerHTML = topbar('') + skeleton(1, 'card') + skeleton(6, 'row');
    const [roster, sched, st, inj, lp, news, R] = await Promise.all([jSoft(`${API(L)}/teams/${id}/roster`, 900000), jSoft(`${API(L)}/teams/${id}/schedule`, 300000), standings(L).catch(() => null), injuries(L), L.sport === 'basketball' ? leaguePlayers(L).catch(() => null) : null, jSoft(`${API(L)}/news?limit=10&team=${id}`, 600000), rankings(L), teamsIndex(L).catch(() => null)]);
    const t0 = (roster && roster.team) || (sched && sched.team);
    if (!t0) { $main.innerHTML = topbar('Team') + empty("Couldn't load this team", '<p style="margin:6px 0 0">The feed didn\'t answer. Pull down to try again.</p>'); return; }
    learn(L, { id: String(id), ...t0 }); const color = teamColor({ id: String(id), abbr: t0.abbreviation, color: t0.color }, L);
    const lg = t0.logo || (t0.logos && t0.logos[0] && t0.logos[0].href) || HW.logoUrl(L, t0.abbreviation);
    const r = st && st.byId[String(id)];
    const rank = R && (R.ranks.find(x => x.team.id === String(id)) || {}).rank;
    const on = favs.has(lk, id);
    const evs = (sched && sched.events || []).map(e => { try { return parseEvent(e, L); } catch { return null; } }).filter(Boolean);
    const next = evs.find(g => g.state !== 'post');
    const ctx = next ? await forecastCtx(L, ymdOf(next.date)).catch(() => null) : null;
    const facts = [r ? `${r.w}-${r.l}` : (t0.recordSummary || ''), rank ? `Ranked No. ${rank}` : '', r && L.standingsMode !== 'conferences' ? `${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}` : (t0.standingSummary || ''), r && r.strk ? (/^W/.test(r.strk) ? `Won ${r.strk.slice(1)} straight` : `Lost ${r.strk.slice(1)} straight`) : ''].filter(Boolean);
    const hero = `<div class="ehero team" style="--a:${esc(color)}"><div class="wm">${esc(t0.abbreviation || '')}</div><img class="biglogo" src="${esc(lg)}" alt="" ${hide}>
      <div class="in"><div class="sub">${esc(r && r.group && L.standingsMode === 'conferences' ? r.group : (t0.standingSummary && /Division/.test(t0.standingSummary) ? '' : L.label))}</div><h1 class="${(() => { const w = Math.max(...`${t0.location || ''} ${t0.name || t0.displayName || ''}`.split(/\s+/).map(x => x.length)); return w > 10 ? 'xlong' : w > 7 ? 'long' : ''; })()}">${esc(t0.location || '')}<br>${esc(t0.name || t0.displayName)}</h1>
        <div class="facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</div>
        <div class="acts"><button class="${on ? 'on' : ''}" data-act="fav" data-lk="${lk}" data-id="${esc(id)}" data-name="${esc(t0.shortDisplayName || t0.name)}" aria-pressed="${on}">${on ? starSvg : starLine}${on ? 'Following' : 'Follow'}</button></div>
      </div></div>`;
    const strip = r ? `<div class="stats four"><div><b>${r.ppg != null ? (+r.ppg).toFixed(1) : '—'}</b><span>PPG</span></div><div><b>${r.opp != null ? (+r.opp).toFixed(1) : '—'}</b><span>OPP</span></div><div><b>${r.diff != null ? sign(+r.diff) : '—'}</b><span>NET</span></div><div><b>${esc(L.standingsMode === 'conferences' ? (r.conf || '—') : (r.l10 || r.home || '—'))}</b><span>${L.standingsMode === 'conferences' ? 'CONF' : r.l10 ? 'LAST 10' : 'HOME'}</span></div></div>` : '';
    // form: the last five results as pips, newest on the right; splits from the standings row
    const last5 = evs.filter(g => g.state === 'post').slice(-5);
    const form = last5.length ? `<div class="form"><span>Last ${last5.length}</span>${last5.map(g => { const us = g.home.id === String(id) ? g.home : g.away, them = us === g.home ? g.away : g.home; const w = us.score > them.score; return `<a class="pip ${w ? 'w' : 'l'}" href="${href.game(lk, g.id)}" title="${esc(`${w ? 'W' : 'L'} ${us.score}-${them.score} ${us === g.home ? 'vs' : 'at'} ${them.short}`)}"><b>${w ? 'W' : 'L'}</b><i>${esc(them.abbr || '')}</i></a>`; }).join('')}</div>` : '';
    const splits = r ? [['Home', r.home], ['Road', r.road], ['Last 10', r.l10], ['Streak', r.strk], [L.standingsMode === 'conferences' ? 'In conference' : 'vs conference', r.conf]].filter(([, x]) => x) : [];
    const splitsHtml = splits.length ? `<div class="stats splits" style="grid-template-columns:repeat(${Math.min(splits.length, 5)},1fr)">${splits.map(([k, x]) => `<div><b>${esc(x)}</b><span>${esc(k.toUpperCase())}</span></div>`).join('')}</div>` : '';
    const nextHtml = form + splitsHtml + (next ? sec(next.state === 'in' ? 'Live now' : 'Next up') + `<div class="games">${gameCard(L, next, ctx)}</div>` : '');
    // roster, by scoring when we have it
    const ath = (roster && roster.athletes || []).flatMap(a => a.items ? a.items : [a]);
    const ppg = {}; if (lp) lp.rows.forEach(p => { if (p.teamId === String(id)) ppg[p.id] = p; });
    const sorted = ath.slice().sort((a, b) => ((ppg[b.id] || {}).pts || 0) - ((ppg[a.id] || {}).pts || 0) || (a.displayName || '').localeCompare(b.displayName || ''));
    const posWord = p => ({ G: 'Guard', F: 'Forward', C: 'Center', 'G-F': 'Guard/forward', 'F-G': 'Forward/guard', 'F-C': 'Forward/center', 'C-F': 'Center/forward', PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward' }[p] || p || '');
    const rRow = (a, extra) => { const p = ppg[a.id]; const injd = a.injuries && a.injuries[0]; return `<a class="row${extra ? ' more' : ''}" href="${href.player(lk, a.id)}"${extra ? ' hidden data-more="roster"' : ''}>${headshot(hsUrl(a), color, 46, a.displayName)}<span class="t"><b>${esc(a.displayName)}</b><span>${esc([posWord(a.position && a.position.abbreviation), a.jersey ? `No. ${a.jersey}` : ''].filter(Boolean).join(', '))}${injd ? `<span class="tag ${/out/i.test(injd.status) ? 'out' : 'q'}">${esc(injd.status)}</span>` : ''}</span></span>${p ? `<span class="r"><b>${p.pts.toFixed(1)}</b><span>ppg</span></span>` : chev}</a>`; };
    const rosterHtml = sorted.length ? sec('Roster', `${sorted.length}`, sorted.length > 6 ? `<button data-act="expand" data-more="roster">Everyone</button>` : '') + `<div class="rows">${sorted.slice(0, 6).map(a => rRow(a, false)).join('')}${sorted.slice(6).map(a => rRow(a, true)).join('')}</div>` : '';
    // schedule: next five and last five, expandable to the season
    const sRow = (g, extra) => { const homeSide = g.home.id === String(id); const me = homeSide ? g.home : g.away, op = homeSide ? g.away : g.home; const d = new Date(g.date); const res = g.state === 'post' ? `<span class="res ${me.score > op.score ? 'w' : 'l'}" style="font-size:15px">${me.score > op.score ? 'W' : 'L'} ${me.score}-${op.score}</span>` : g.state === 'in' ? `<span class="live">${esc(g.detail)}</span>` : chev; return `<a class="row" href="${href.game(lk, g.id)}"${extra ? ' hidden data-more="sched"' : ''}><span class="d">${esc(d.toLocaleDateString('en-US', { month: 'short', timeZone: HW.TZ }))}<b>${esc(d.toLocaleDateString('en-US', { day: 'numeric', timeZone: HW.TZ }))}</b></span>${logo(op.logo, 'm', V._.teamColor(op, L))}<span class="t"><b>${g.neutral ? 'vs' : homeSide ? 'vs' : 'at'} ${esc(op.short)}</b><span>${g.state === 'post' ? 'Final' : g.state === 'in' ? 'Live' : esc([tip(g.date), tvLabel(g)].filter(Boolean).join(', '))}</span></span>${res}</a>`; };
    const done = evs.filter(g => g.state === 'post'), up = evs.filter(g => g.state !== 'post');
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
    const arts = news && news.articles ? news.articles.filter(a => a.headline && (about(a) || (!college && !cats(a).length))).slice(0, 6) : [];
    const newsHtml = arts.length ? sec('News') + `<div class="rows">${arts.map(a => newsRow(lk, a)).join('')}</div>` : '';
    $main.innerHTML = topbar(esc(t0.shortDisplayName || t0.name || t0.displayName || ''), '#teams') + hero + strip + nextHtml + rosterHtml + schedHtml + injHtml + newsHtml;
    document.title = `${t0.displayName} · RIVL`;
  }

  /* ================= GAME ================= */
  const WANT = ['fieldGoalPct', 'threePointFieldGoalPct', 'freeThrowPct', 'totalRebounds', 'assists', 'turnovers', 'steals', 'blocks', 'pointsInPaint', 'fastBreakPoints', 'largestLead'];
  const LOW = { turnovers: 1 };
  const NICE = { fieldGoalPct: 'Field goals', threePointFieldGoalPct: 'Threes', freeThrowPct: 'Free throws', totalRebounds: 'Rebounds', assists: 'Assists', turnovers: 'Turnovers', steals: 'Steals', blocks: 'Blocks', pointsInPaint: 'Points in the paint', fastBreakPoints: 'Fast-break points', largestLead: 'Largest lead' };
  async function gameV(lk, id) {
    const L = LEAGUES[lk]; if (!L || !id) { $main.innerHTML = empty('Game not found'); return; }
    $main.innerHTML = topbar('', '#scores') + skeleton(1, 'card') + skeleton(6, 'row');
    let ctx = null, tab = 'summary';   // every game opens on Summary
    const pv = { q: 'all', scoring: false };   // the plays tab's period and scoring-only filters
    const paint = async (ttl) => {
      const d = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, ttl);
      const hc = d && d.header && d.header.competitions && d.header.competitions[0];
      if (!hc) { $main.innerHTML = topbar('Game', '#scores') + empty("Couldn't load this game", '<p style="margin:6px 0 0">The feed didn\'t answer. Pull down to try again.</p>'); return null; }
      const ev = { id, competitions: [{ ...hc, venue: d.gameInfo && d.gameInfo.venue, status: hc.status, broadcasts: hc.broadcasts, geoBroadcasts: hc.geoBroadcasts }], date: hc.date, status: hc.status, season: d.header.season };
      const g = parseEvent(ev, L); if (!g.date || isNaN(new Date(g.date))) g.date = new Date().toISOString();
      if (!ctx) ctx = await forecastCtx(L, ymdOf(g.date)).catch(() => null);
      const f = safeF(L, g, ctx);
      const title = `${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}`;
      const hero = heroCard(L, g, ctx, { page: true });
      const tabs = chips([['summary', 'Summary'], ['box', 'Box score'], ['plays', 'Plays'], ['stats', 'Team stats']].filter(([k]) => g.state !== 'pre' || k === 'summary' || k === 'stats'), tab, 'gtab', 'tab');
      // box score helpers
      const bx = d.boxscore && d.boxscore.players || [];
      const boxOf = side => bx.find(x => String(x.team.id) === side.id);
      const statOf = (p, label) => { const s = p && p.statistics && p.statistics[0]; if (!s) return null; const i = (s.labels || s.names || []).indexOf(label); return i < 0 ? null : { i, s }; };
      const topFor = side => { const p = boxOf(side); const st = statOf(p, 'PTS'); if (!st) return null; const ath = (st.s.athletes || []).filter(a => a.stats && a.stats.length && !a.didNotPlay); if (!ath.length) return null; const best = ath.slice().sort((a, b) => (+b.stats[st.i] || 0) - (+a.stats[st.i] || 0))[0]; const get = l => { const k = (st.s.labels || []).indexOf(l); return k >= 0 ? best.stats[k] : ''; }; return { a: best.athlete, pts: get('PTS'), reb: get('REB'), ast: get('AST') }; };
      const tms = d.boxscore && d.boxscore.teams || [];
      const ta = tms.find(t => String(t.team.id) === g.away.id), th = tms.find(t => String(t.team.id) === g.home.id);
      const flat = t => (t && t.statistics || []).flatMap(x => x && x.displayValue != null ? [x] : (x && (x.stats || x.statistics) || []));
      const get = (t, n) => flat(t).find(x => x.name === n);
      const cmpRows = (names) => names.map(n => { const a = get(ta, n), h = get(th, n); if (!a || !h) return ''; const av = parseFloat(String(a.displayValue).split('-')[0]) || 0, hv = parseFloat(String(h.displayValue).split('-')[0]) || 0; const mx = Math.max(av, hv) || 1; const lowGood = !!LOW[n]; const aw = lowGood ? av <= hv : av >= hv, hw = lowGood ? hv <= av : hv >= av; return `<div><span class="lab">${esc(NICE[n] || a.label || n)}</span><b class="${aw ? 'lead' : ''}">${esc(a.displayValue)}</b><em class="l"><i style="width:${av / mx * 100}%;background:${esc(V._.teamColor(g.away))}"></i></em><em class="r"><i style="width:${hv / mx * 100}%;background:${esc(V._.teamColor(g.home))}"></i></em><b class="${hw ? 'lead' : ''}">${esc(h.displayValue)}</b></div>`; }).join('');
      const plays = (d.plays || []);
      // scoring runs: consecutive points by one side, called out at 8-0 and up
      const runs = new Map(); if (plays.length) { let ph = +plays[0].homeScore || 0, pa = +plays[0].awayScore || 0, team = '', pts = 0, from = 0; plays.forEach((p, i) => { if (!i) return; const h = +p.homeScore || 0, a = +p.awayScore || 0; const dh = h - ph, da = a - pa; ph = h; pa = a; if (dh > 4 || da > 4 || dh < 0 || da < 0) { team = ''; pts = 0; return; }   /* a gap in the feed, not a run */ const who = dh > 0 ? 'home' : da > 0 ? 'away' : ''; if (!who) return; const v = dh > 0 ? dh : da; if (who === team) { pts += v; } else { if (team && pts >= 8) runs.set(from, { team, pts }); team = who; pts = v; } from = i; }); if (team && pts >= 8) runs.set(from, { team, pts }); }
      const runMark = i => { const r = runs.get(i); if (!r) return ''; const t = r.team === 'home' ? g.home : g.away; return `<div class="runmark" style="--tc:${esc(V._.teamColor(t))}"><b>${r.pts}–0</b> ${esc(t.short)} run</div>`; };
      const sideOf = p => { const id = p.team && String(p.team.id); return id === g.home.id ? g.home : id === g.away.id ? g.away : null; };
      const playRow = (p, i) => { const t = p.scoringPlay ? sideOf(p) : null; return `${runMark(i)}<div class="row play${p.scoringPlay ? ' score' : ''}"${t ? ` style="--tc:${esc(V._.teamColor(t, L))}"` : ''}><span class="q">${esc(p.period && p.period.displayValue ? p.period.displayValue.replace('Quarter', 'Q').replace(/(\d)(st|nd|rd|th) Q/, 'Q$1') : '')} ${esc(p.clock && p.clock.displayValue || '')}</span><span class="t"><b class="wrap">${esc(p.text || '')}</b><span>${p.awayScore != null ? `${esc(g.away.abbr)} ${p.awayScore}, ${esc(g.home.abbr)} ${p.homeScore}` : ''}</span></span>${p.scoringPlay ? `<span class="tag ok pts">+${esc(p.scoreValue || '')}</span>` : ''}</div>`; };
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
        const mid = Y(.5); const ch = V._.teamColor(g.home), ca = V._.teamColor(g.away);
        const lastP = wpAll[n - 1].homeWinPercentage; const lead = lastP >= .5 ? g.home : g.away;
        tracker = sec('Lead tracker', g.state === 'in' ? `${esc(lead.short)} ${Math.round(Math.max(lastP, 1 - lastP) * 100)}% right now` : `ESPN's win probability through the game`) + `<div class="tracker"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Win probability through the game"><defs><clipPath id="ct"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath><clipPath id="cb"><rect x="0" y="${mid}" width="${W}" height="${Hh - mid}"/></clipPath></defs><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="var(--line-2)" stroke-dasharray="3 4"/><polygon points="${pad},${mid} ${pts.join(' ')} ${X(n - 1).toFixed(1)},${mid}" fill="${ch}" opacity=".28" clip-path="url(#ct)"/><polygon points="${pad},${mid} ${pts.join(' ')} ${X(n - 1).toFixed(1)},${mid}" fill="${ca}" opacity=".28" clip-path="url(#cb)"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${X(n - 1).toFixed(1)}" cy="${Y(lastP).toFixed(1)}" r="3.5" fill="var(--ink)"/></svg><div class="tk"><span><i style="background:${ch}"></i>${esc(g.home.abbr)} ahead</span><span><i style="background:${ca}"></i>${esc(g.away.abbr)} ahead</span></div></div>`;
      }
      let body = '';
      if (tab === 'summary') {
        body += lineScore;
        const tp = g.state !== 'pre' ? [topFor(g.away), topFor(g.home)] : [null, null];
        if (tp[0] || tp[1]) body += sec(g.state === 'post' ? 'Top performers' : 'Leading the way') + `<div class="perf">${tp.map((x, i) => x ? `<a href="${href.player(lk, x.a.id)}">${headshot(hsUrl(x.a), V._.teamColor(i ? g.home : g.away), 56, x.a.displayName || x.a.shortName)}<b>${esc(x.a.shortName || x.a.displayName)}</b><span class="line">${esc(x.pts)}</span><span>pts, ${esc(x.ast)} ast, ${esc(x.reb)} reb</span></a>` : '<div></div>').join('')}</div>`;
        else if (d.leaders && d.leaders.length) { const items = []; d.leaders.forEach(t => (t.leaders || []).slice(0, 1).forEach(cat => { const Ld = cat.leaders && cat.leaders[0]; if (Ld) items.push({ team: t.team, cat, Ld }); })); if (items.length) body += sec('Season leaders') + `<div class="perf">${items.map(({ team, cat, Ld }) => `<a href="${href.player(lk, Ld.athlete.id)}">${headshot(hsUrl(Ld.athlete), hx(team.color), 56, Ld.athlete.displayName || Ld.athlete.shortName)}<b>${esc(Ld.athlete.shortName || Ld.athlete.displayName)}</b><span class="line">${esc((Ld.displayValue || '').split(' ')[0])}</span><span>${esc(cat.displayName.toLowerCase())}</span></a>`).join('')}</div>`; }
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
          const push = (label, av, hv, better) => rows.push({ label, av, hv, better: better || 0 });
          push('RIVL rating', sg(f.A.rating), sg(f.H.rating), cmp(f.A.rating, f.H.rating));
          if (ra.w != null || rh.w != null) push('Record', ra.w != null ? `${ra.w}-${ra.l}` : '—', rh.w != null ? `${rh.w}-${rh.l}` : '—', cmp(pctOf(`${ra.w}-${ra.l}`), pctOf(`${rh.w}-${rh.l}`)));
          if (ra.diff != null || rh.diff != null) push('Scoring margin', sg(ra.diff), sg(rh.diff), cmp(ra.diff, rh.diff));
          if (ra.l10 || rh.l10) push('Last 10', ra.l10 || '—', rh.l10 || '—', cmp(pctOf(ra.l10), pctOf(rh.l10)));
          if (!g.neutral && (ra.road || rh.home)) push('Road / home', ra.road || '—', rh.home || '—', cmp(pctOf(ra.road), pctOf(rh.home)));
          if (ra.strk || rh.strk) push('Streak', ra.strk || '—', rh.strk || '—', cmp(strkN(ra.strk), strkN(rh.strk)));
          if (f.restH || f.restA) push('Rest', f.restA ? 'Back-to-back' : 'Rested', f.restH ? 'Back-to-back' : 'Rested', cmp(f.restA ? 0 : 1, f.restH ? 0 : 1));
          if (f.soH || f.soA) push('Out', f.soA ? esc(f.soA.name) : 'Full strength', f.soH ? esc(f.soH.name) : 'Full strength', cmp(f.soA ? f.soA.pts : 0, f.soH ? f.soH.pts : 0));
          const head = t => `<span class="wt" style="--tc:${esc(V._.teamColor(t, L))}">${logo(t.logo, 's', V._.teamColor(t, L))}<b>${esc(t.abbr || t.short)}</b></span>`;
          const grid = `<div class="why"><div class="why-h"><span></span>${head(g.away)}${head(g.home)}</div>${rows.map(r => `<div class="why-r"><span>${r.label}</span><b class="${r.better < 0 ? 'up' : ''}">${r.av}</b><b class="${r.better > 0 ? 'up' : ''}">${r.hv}</b></div>`).join('')}</div>`;
          const lines = [];
          if (g.state === 'in') lines.push(['Score and time', `${esc((g.home.score > g.away.score ? g.home : g.away).short)} up ${Math.abs(g.home.score - g.away.score)}, ${esc(g.detail)}`]);
          lines.push(['Home court', g.neutral ? 'Neutral floor' : `${esc(g.home.short)} +${f.hca.toFixed(1)}`]);
          lines.push([g.state === 'pre' ? 'Projected margin' : 'Pregame margin', `${esc((f.margin >= 0 ? g.home : g.away).short)} by ${Math.abs(f.margin).toFixed(1)}`]);
          lines.push([g.state === 'pre' ? 'Win chance' : 'Pregame chance', `${esc(fav.short)} ${pct(p)}`]);
          const note = f.source === 'elo' ? 'RIVL\'s rating is an Elo built from scoring margin, rebuilt every night.' : 'RIVL\'s rating is this season\'s scoring margin blended with last season\'s, weighted by games played.';
          body += sec(g.state === 'post' ? `Had ${esc(fav.short)} ${pct(p)}` : `Why ${esc(fav.short)} ${pct(p)}`) + grid + `<table class="tbl kv why-kv"><tbody>${lines.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table><p class="why-n">${note}</p>`;
        }
        if (ta && th && g.state !== 'pre') { const rows = cmpRows(WANT.slice(0, 6)); if (rows) body += sec('Team stats', '', `<button data-act="gtab" data-tab="stats">All</button>`) + `<div class="cmp">${rows}</div>`; }
        if (plays.length && g.state !== 'pre') body += sec(g.state === 'in' ? 'Last plays' : 'Final plays', '', `<button data-act="gtab" data-tab="plays">All plays</button>`) + `<div class="rows plays">${plays.map((p, i) => [p, i]).slice(-5).reverse().map(([p, i]) => playRow(p, i)).join('')}</div>`;
        if (g.state !== 'post') { const ws = watchFor(g, L); const list = ws.length ? ws.map(w => `<a class="row" href="${esc(w.href)}" target="_blank" rel="noopener"><span class="t"><b>${esc(w.label || w.short)}</b><span>${esc(w.bundle ? `Through ${w.bundle}` : tvLabel(g) || 'Opens in the app')}</span></span>${chev}</a>`).join('') : (tvLabel(g) ? `<div class="row"><span class="t"><b>${esc(tvLabel(g))}</b><span>Pick your services on the old site\'s updates screen to get a direct link here.</span></span></div>` : ''); if (list) body += sec('Where to watch') + `<div class="rows">${list}</div>`; }
        if (d.gameInfo && d.gameInfo.venue) body += `<p class="foot">${esc(d.gameInfo.venue.fullName || '')}${d.gameInfo.venue.address ? `, ${esc([d.gameInfo.venue.address.city, d.gameInfo.venue.address.state].filter(Boolean).join(', '))}` : ''}${d.gameInfo.attendance ? ` · ${d.gameInfo.attendance.toLocaleString()} attendance`.replace(' · ', ', ') : ''}</p>`;
      } else if (tab === 'box') {
        const table = side => { const p = boxOf(side); const s = p && p.statistics && p.statistics[0]; if (!s) return ''; const labels = s.labels || []; const ath = s.athletes || []; const rowOf = a => { const sn = a.athlete.shortName || a.athlete.displayName || ''; const nm = `<a href="${href.player(lk, a.athlete.id)}">${esc(sn.length > 15 ? V.lastName(a.athlete.displayName || sn) : sn)}</a>`; if (a.didNotPlay || !a.stats || !a.stats.length) return `<tr><td class="l">${nm}</td><td class="l mut" colspan="${labels.length}">${esc(a.reason || 'Did not play')}</td></tr>`; return `<tr><td class="l">${nm}</td>${a.stats.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`; }; const mi = labels.indexOf('MIN'); const mins = a => mi >= 0 && a.stats && a.stats[mi] ? parseFloat(String(a.stats[mi]).replace(':', '.')) || 0 : 0; const played = a => !(a.didNotPlay || !a.stats || !a.stats.length || (mi >= 0 && !mins(a))); const byMin = (x, y) => mins(y) - mins(x); const st = ath.filter(a => a.starter).sort(byMin), bn = ath.filter(a => !a.starter && played(a)).sort(byMin), dnp = ath.filter(a => !a.starter && !played(a)); const tot = s.totals && s.totals.length ? `<tr class="tot"><td class="l">Team</td>${s.totals.map(v => `<td><b>${esc(v)}</b></td>`).join('')}</tr>` : ''; return sec(side.short) + `<div class="tw"><table class="tbl box"><thead><tr><th>Player</th>${labels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${st.length ? `<tr class="sub"><td colspan="${labels.length + 1}">Starters</td></tr>${st.map(rowOf).join('')}` : ''}${bn.length ? `<tr class="sub"><td colspan="${labels.length + 1}">Bench</td></tr>${bn.map(rowOf).join('')}` : ''}${dnp.length ? `<tr class="sub"><td colspan="${labels.length + 1}">Did not play</td></tr>${dnp.map(a => `<tr class="dnp"><td class="l"><a href="${href.player(lk, a.athlete.id)}">${esc(a.athlete.shortName || a.athlete.displayName)}</a></td><td class="l mut" colspan="${labels.length}">${esc(a.reason || (a.didNotPlay ? 'Did not play' : 'Did not play'))}</td></tr>`).join('')}` : ''}${tot}</tbody></table></div>`; };
        body = (table(g.away) + table(g.home)) || empty('No box score yet');
      } else if (tab === 'plays') {
        if (!plays.length) body = empty('No plays yet');
        else {
          const periods = [...new Set(plays.map(p => p.period && p.period.number).filter(n => n != null))];
          const pname = n => n <= L.periods ? (L.periods === 2 ? (n === 1 ? '1st half' : '2nd half') : `Q${n}`) : (n - L.periods > 1 ? `OT${n - L.periods}` : 'OT');
          const pick = pv.q !== 'all' && periods.includes(pv.q) ? pv.q : 'all';
          const filt = plays.map((p, i) => [p, i]).filter(([p]) => (pick === 'all' || (p.period && p.period.number) === pick) && (!pv.scoring || p.scoringPlay));
          const ctl = `<div class="chips pchips"><button class="chip${pick === 'all' ? ' on' : ''}" data-act="pq" data-q="all" aria-pressed="${pick === 'all'}">All</button>${periods.map(n => `<button class="chip${pick === n ? ' on' : ''}" data-act="pq" data-q="${n}" aria-pressed="${pick === n}">${pname(n)}</button>`).join('')}<button class="chip tog${pv.scoring ? ' on' : ''}" data-act="pscoring" aria-pressed="${!!pv.scoring}">Scoring only</button></div>`;
          const groups = []; filt.reverse().forEach(([p, i]) => { const k = p.period && p.period.number; const grp = groups[groups.length - 1]; if (!grp || grp.k !== k) groups.push({ k, label: p.period && p.period.displayValue || '', list: [[p, i]] }); else grp.list.push([p, i]); });
          const nRuns = [...runs.keys()].filter(i => filt.some(([, j]) => j === i)).length;
          body = lineScore + ctl + (groups.length ? groups.map(gr => sec(gr.label.replace(/(\d)(st|nd|rd|th) Quarter/, 'Quarter $1'), pick === 'all' && nRuns && gr === groups[0] ? `${runs.size} run${runs.size === 1 ? '' : 's'} of 8–0 or more marked` : '') + `<div class="rows plays">${gr.list.map(([p, i]) => playRow(p, i)).join('')}</div>`).join('') : empty('No scoring plays in that span'));
        }
      } else if (tab === 'stats') {
        const rows = ta && th ? cmpRows(flat(ta).map(x => x.name).filter(n => get(th, n))) : '';
        body = rows ? `<div class="cmp" style="padding-top:6px">${rows}</div>` : empty(g.state === 'pre' ? 'Stats arrive at tip-off' : 'No team stats yet');
      }
      const scrollY = window.scrollY;
      const side = t => ({ short: t.short, abbr: t.abbr, logo: t.logo, color: V._.teamColor(t), score: t.score, rec: t.rec || '' });
      const card = g.state === 'pre' ? null : { kind: 'game', away: side(g.away), home: side(g.home), status: g.state === 'post' ? 'Final' : g.detail, sub: tvLabel(g) || (d.gameInfo && d.gameInfo.venue && d.gameInfo.venue.fullName) || '', date: dayLabel(ymdOf(g.date), { weekday: 'long', month: 'long', day: 'numeric' }), note: f && prefs.get('forecast') ? `RIVL had ${(f.pHome >= .5 ? g.home : g.away).short} ${pct(Math.max(f.pHome, 1 - f.pHome))}` : '', title: `${g.away.short} ${g.away.score ?? ''}, ${g.home.short} ${g.home.score ?? ''}`, text: `${g.away.short} ${g.away.score ?? ''}, ${g.home.short} ${g.home.score ?? ''} · ${g.state === 'post' ? 'Final' : g.detail}`, file: `${g.away.abbr}-${g.home.abbr}-${ymdOf(g.date)}` };
      $main.innerHTML = topbar(title, '#scores', '', card) + hero + tabs + body;
      if (ttl) window.scrollTo(0, scrollY);
      document.title = `${g.away.short} at ${g.home.short} · RIVL`;
      return g;
    };
    const g = await paint();
    V.refresh = async () => { if (!g || g.state === 'post') return; await paint(15000); };
    if (V._gtabL) $main.removeEventListener('click', V._gtabL);
    V._gtabL = e => { const b = e.target.closest('[data-act="gtab"],[data-act="pq"],[data-act="pscoring"]'); if (!b) return; const a = b.dataset.act; if (a === 'gtab') tab = b.dataset.tab; else if (a === 'pq') pv.q = b.dataset.q === 'all' ? 'all' : +b.dataset.q; else pv.scoring = !pv.scoring; paint(); };
    $main.addEventListener('click', V._gtabL);
  }

  /* ================= ARTICLE READER ================= */
  const ALLOW = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'STRONG', 'B', 'EM', 'I', 'A', 'BR', 'FIGURE', 'FIGCAPTION', 'IMG']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'ASIDE', 'NAV', 'FORM', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'SVG', 'BUTTON', 'INPUT']);
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
        if (!ALLOW.has(n.tagName)) { n.replaceWith(...n.childNodes); return; }
        [...n.attributes].forEach(a => { if (!((n.tagName === 'A' && a.name === 'href') || (n.tagName === 'IMG' && a.name === 'src'))) n.removeAttribute(a.name); });
        if (n.tagName === 'A') { const u = n.getAttribute('href') || ''; const here = inApp(u, idxs); if (here) n.setAttribute('href', here); else if (!/^https?:/i.test(u)) n.replaceWith(...n.childNodes); else { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener'); } }
        if (n.tagName === 'IMG') { const u = n.getAttribute('src') || ''; if (!/^https:/i.test(u)) n.remove(); else { n.setAttribute('loading', 'lazy'); n.setAttribute('alt', ''); } }
      });
    };
    walk(root);
    return root.innerHTML.trim();
  }
  async function articleV(lk, id) {
    const cached = S.news[id] || null;
    const webOf = a => a && a.links && a.links.web && a.links.web.href || `https://www.espn.com/${LEAGUES[lk].path.split('/')[1]}/story/_/id/${id}`;
    const head = (a) => { const im = a && a.images && a.images[0]; return `<article class="reader">${im && im.url ? `<img class="lead" src="${esc(im.url)}" alt="${esc(im.caption || '')}" onerror="this.remove()">` : ''}<h1>${esc(a && a.headline || '')}</h1><p class="by">${esc([a && a.byline, a && a.published ? new Date(a.published).toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: HW.TZ }) : ''].filter(Boolean).join(', '))}</p>`; };
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
    ['alerts', 'Alerts', 'Tip-off, close games, finals, injuries'],
    ['sync', 'Sync', 'Carry your follows to another device'],
    ['app', 'App', 'Home screen, setup'],
    ['about', 'About', 'What RIVL is and where the numbers come from']
  ];
  const ICONS = {
    following: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/></svg>',
    look: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
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
      const summary = { following: `${nTeams} team${nTeams === 1 ? '' : 's'} · ${fp.length} player${fp.length === 1 ? '' : 's'}`, home: `${PREFS.filter(([k]) => P[k] !== false).length} of ${PREFS.length} sections on`, look: `${({ system: 'Match my phone', dark: 'Dark', light: 'Light' })[theme] || 'Match my phone'} · ${accent === 'team' ? "team colour" : 'black and white'}`, alerts: V.alerts && V.alerts.available() ? (V.alerts.on() ? 'On' : 'Off') : 'Needs the RIVL server', sync: V.sync && V.sync.available() ? (V.sync.code() ? `Code ${V.sync.code()}` : 'Not backed up') : 'Needs the RIVL server', app: standalone ? 'Installed' : 'Add to home screen', about: '' };
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
        const band = (key, list) => { const p0 = list[0]; const t = idxs[k][String(p0.teamId)] || Object.values(idxs[k]).find(x => [x.abbr, x.short, x.name].some(v => v && String(v).toLowerCase() === String(p0.team || '').toLowerCase())) || null; const name = t ? (t.name || t.short) : (p0.team || 'Team'); return `<div class="thead" style="--tc:${esc(t ? teamColor(t, LEAGUES[k]) : playerColor(p0, LEAGUES[k]))}"><i class="bar"></i>${t && t.logo ? logo(t.logo, 's') : ''}<b>${esc(name)}</b><span class="n">${list.length}</span></div>${list.map(playerRow).join('')}`; };
        return `<div class="sub">${esc(LEAGUES[k].label)}<span>${mine.length}</span></div>${[...groups.entries()].map(([key, list]) => band(key, list)).join('')}`;
      }).join('');
      body = sec('Teams', `${nTeams}`, `<a href="#teams">Add</a>`) + (nTeams ? `<div class="rows">${teamsHtml}</div>` : empty('No teams yet', '', `<a class="btn" href="#teams">Choose teams</a>`)) +
        sec('Players', `${fp.length}`, `<a href="#players">Add</a>`) + (fp.length ? `<div class="rows">${playersHtml}</div>` : empty('No players yet', '', `<a class="btn" href="#players">Find players</a>`));
    } else if (cat === 'home') {
      body = sec('Home shows') + `<div class="rows">${PREFS.map(([k, t, b]) => sw(k, P[k] !== false, t, b)).join('')}</div>` +
        sec('Game cards') + `<div class="rows">${sw('forecast', P.forecast !== false, 'Win chances', "RIVL's own estimate on each game card and game page")}</div>`;
    } else if (cat === 'look') {
      body = sec('Theme') + `<div class="chips" role="radiogroup" aria-label="Theme">${[['system', 'Match my phone'], ['dark', 'Dark'], ['light', 'Light']].map(([k, l]) => `<button class="chip${theme === k ? ' on' : ''}" data-act="theme" data-theme="${k}" role="radio" aria-checked="${theme === k}">${l}</button>`).join('')}</div>` +
        sec('Accent') + `<div class="chips" role="radiogroup" aria-label="Accent">${[['mono', 'Black and white'], ['team', "My team's colour"]].map(([k, l]) => `<button class="chip${accent === k ? ' on' : ''}" data-act="accent" data-accent="${k}" role="radio" aria-checked="${accent === k}">${l}</button>`).join('')}</div><p class="legend">The accent colours the switcher, the selected chips and the tab bar after the first team you follow.</p>`;
    } else if (cat === 'alerts') {
      body = (V.alerts && V.alerts.available() ? sec('Alerts') + `<div class="rows">${sw('alerts', V.alerts.on(), 'Alerts for my teams and players', 'Tip-off, close games, finals and injury changes; nothing else')}${V.alerts.on() ? [['pre', 'Tip-off', '20 minutes before your teams play'], ['close', 'Close games', 'Within 5 in the last 3 minutes'], ['final', 'Finals', 'The score when it ends'], ['inj', 'Injuries', 'Status changes for your players, and anyone newly out on your teams']].map(([k, t, b]) => `<button class="row sw" data-act="alert-pref" data-pref="${k}" role="switch" aria-checked="${V.alerts.prefs()[k] !== false}"><span class="t"><b>${esc(t)}</b><span class="wrap">${esc(b)}</span></span><span class="switch"></span></button>`).join('') + `<button class="row" data-act="alert-test"><span class="t"><b>Send a test alert</b></span>${chev}</button>` : ''}</div>` : sec('Alerts') + empty('Alerts need the RIVL server', '<p style="margin:6px 0 0">Tip-off, close games, finals and injury changes for your teams and players. Available once the server is deployed.</p>'));
    } else if (cat === 'sync') {
      body = sec('Sync') + (V.sync && V.sync.available() ? `<div class="rows"><button class="row" data-act="sync-up"><span class="t"><b>${V.sync.code() ? `Back up to code ${esc(V.sync.code())}` : 'Back up to a code'}</b><span class="wrap">Your teams, players and settings, so another device can pick them up</span></span>${chev}</button></div><div class="search" style="margin-top:6px"><input id="syncCode" type="text" placeholder="Enter a code from another device" autocomplete="off" autocapitalize="characters" maxlength="6" aria-label="Sync code"></div><div class="rows"><button class="row" data-act="sync-down"><span class="t"><b>Restore from that code</b><span class="wrap">Replaces what's followed on this device</span></span>${chev}</button></div>` : empty('Sync needs the RIVL server', '<p style="margin:6px 0 0">Carry your teams and players to another phone or laptop with a six-character code.</p>'));
    } else if (cat === 'app') {
      body = sec('App') + `<div class="rows">${standalone ? '' : `<button class="row" data-act="install"><span class="t"><b>Add to home screen</b><span class="wrap">Opens full screen like an app, your teams first</span></span>${chev}</button>`}<button class="row" data-act="onb-restart"><span class="t"><b>Run setup again</b><span class="wrap">Pick teams and players from the start</span></span>${chev}</button></div>`;
    } else if (cat === 'about') {
      body = sec('About') + `<p class="foot about">RIVL is a personal fan project. Team names and logos belong to the leagues and their teams. Scores, stats and injury reports come from the leagues' public feeds. Win chances are RIVL's own estimate, not betting advice. All times Central.</p>`;
    }
    $main.innerHTML = bar(here[1], '#settings') + body;
    if (V._settingsL) { $main.removeEventListener('rivl:fav', V._settingsL); $main.removeEventListener('rivl:follow', V._settingsL); }
    V._settingsL = () => { if ((location.hash || '').startsWith('#settings')) settingsV(cat); };
    $main.addEventListener('rivl:fav', V._settingsL); $main.addEventListener('rivl:follow', V._settingsL);
  }

  Object.assign(V, { standings: standingsV, teams: teamsV, team: teamV, game: gameV, article: articleV, search: searchV, settings: settingsV });
})();
