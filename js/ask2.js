/* SEARCH, part two: the questions past names and stat lines. Injuries (what the words mean, who is hurt, by team or by
   league, sorted by how bad, by when they're back, by when it happened, counted, with the app's own log of past reports),
   games (last night, tonight, a date: the score, the shooting, the box totals, the shot chart, a player's line),
   leaders, standings, schedules, team and player numbers, and what-ifs (a game's chances without a player, labeled as
   the estimate it is). Every card says where the numbers came from; when the app has no data for it, it says so. */
(function () {
  'use strict';
  const V = HW.v5, _ = V._, esc = HW.esc, store = HW.store, LEAGUES = HW.LEAGUES, ORDER = HW.ORDER;
  const K = () => V._ask;
  const one = v => v == null || isNaN(v) ? '-' : (Math.round(v * 10) / 10).toFixed(1);
  const pct1 = v => v == null || isNaN(v) ? '-' : `${(+v).toFixed(1)}%`;
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const dayWord = ymd => { const t = HW.todayCT(); return ymd === t ? 'tonight' : ymd === HW.addDays(t, -1) ? 'last night' : ymd === HW.addDays(t, 1) ? 'tomorrow' : HW.dayLabel(ymd, { weekday: 'long', month: 'short', day: 'numeric' }); };
  const niceDate = ymd => ymd ? HW.dayLabel(ymd, { month: 'short', day: 'numeric', ...(String(ymd).slice(0, 4) !== String(new Date().getFullYear()) ? { year: 'numeric' } : {}) }) : '';

  /* ---------- reading the question ---------- */
  const leagueIn = nq => /\bwnba\b/.test(nq) ? 'wnba' : /\bnba\b/.test(nq) ? 'nba' : /\b(ncaa ?w|womens college|college women|women s college)\b/.test(nq) ? 'ncaaw' : /\b(ncaa ?m|mens college|college men|college basketball|college|ncaa)\b/.test(nq) ? 'ncaam' : null;
  const curLk = () => { const k = store.get('v5:lk', 'nba'); return LEAGUES[k] ? k : 'nba'; };
  const MONTHS = 'january february march april may june july august september october november december'.split(' ');
  function whenIn(nq) {
    const t = HW.todayCT();
    if (/\b(last night|yesterday)\b/.test(nq)) return { ymd: HW.addDays(t, -1), word: 'last night' };
    if (/\b(tonight|today)\b/.test(nq)) return { ymd: t, word: 'tonight' };
    if (/\btomorrow\b/.test(nq)) return { ymd: HW.addDays(t, 1), word: 'tomorrow' };
    const m = nq.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/); if (m) { const mo = MONTHS.findIndex(x => x.startsWith(m[1].slice(0, 3))); const y = new Date().getFullYear(); const d = `${y}-${String(mo + 1).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; return { ymd: d > t ? `${y - 1}${d.slice(4)}` : d, word: `on ${HW.dayLabel(d, { month: 'short', day: 'numeric' })}` }; }
    if (/\b(last game|most recent|latest game|previous game)\b/.test(nq)) return { last: true, word: 'in their last game' };
    if (/\b(next game|upcoming)\b/.test(nq)) return { next: true, word: 'in their next game' };
    return null;
  }

  /* ---------- injuries ---------- */
  const GLOSS = [
    ['Out', 'out', 'Will not play. Out for the season means not again this year.'],
    ['Doubtful', 'q', 'Very unlikely to play.'],
    ['Quest', 'q', 'Questionable: a real chance either way, decided near tip-off.'],
    ['DTD', 'q', 'Day to day: a short-term issue, could be back any game.'],
    ['GTD', 'q', 'Game-time decision: decided right before the game.'],
    ['Probable', 'ok', 'Expected to play.'],
    ['Cleared', 'ok', 'Off the report and available.']];
  const statusCls = s => /out|season/i.test(s) ? 'out' : /doubt|quest|day|game.?time/i.test(s) ? 'q' : /prob|avail|clear/i.test(s) ? 'ok' : '';
  const sevOf = s => /season/i.test(s) ? 5 : /^out$/i.test(s) ? 4 : /doubt/i.test(s) ? 3 : /quest|game.?time/i.test(s) ? 2 : /day/i.test(s) ? 1.5 : /prob/i.test(s) ? 1 : 0;
  async function injuryLog() { return (await HW.hub.file('injuries.json').catch(() => null)) || null; }
  /* the current report, from ESPN live (fresh) with the log's dates folded in */
  async function injuryRows(lk, teamFilter) {
    const L = LEAGUES[lk]; if (!L || !L.hasInjuries) return { rows: [], none: 'no report' };
    const [inj, log, idx] = await Promise.all([HW.injuries(L).catch(() => null), injuryLog(), V.teamsIndex(L).catch(() => ({}))]);
    const all = log && log.leagues && log.leagues[lk] && log.leagues[lk].all || {};
    const rows = [];
    Object.entries(inj && inj.byTeam || {}).forEach(([tid, t]) => { const team = idx[tid] || { id: tid, name: t.name, short: t.name };
      if (teamFilter && !teamFilter(team)) return;
      (t.list || []).forEach((x, i) => { const a = x.athlete || {}; const pid = String(a.id || _.athId(a) || ''); const det = x.details || {}; const st = x.status || '';
        const what = [det.side && det.side !== 'Not Specified' ? det.side : '', det.type || det.detail || ''].filter(Boolean).join(' ');
        const key = Object.keys(all).find(k => k.startsWith(pid + ':')); const e = key ? all[key] : null;
        const ret = _.retInfo(L, det.returnDate);
        const rest = /\b(rest|personal|coach|suspen|illness|not injury|conditioning|paternity|bereave)/i.test([what, det.detail, x.shortComment].join(' ')) && !/\b(back|knee|ankle|hamstring|foot|hip|shoulder|wrist|hand|calf|quad|groin|concussion|fracture|surgery)\b/i.test(what);
        rows.push({ pid, name: a.displayName || '', pos: a.position && a.position.abbreviation || '', team, status: st, word: _.statusWord(st) || st, cls: statusCls(st), sev: rest ? .2 : sevOf(st), rest, what, note: x.shortComment || '', long: x.longComment || '',
          since: (e && e.first) || (x.date ? String(x.date).slice(0, 10) : ''), ret: det.returnDate ? String(det.returnDate).slice(0, 10) : '', retWord: ret ? (ret.far ? 'for the season' : ret.past ? 'date passed' : ret.short.replace(/^back around /, '')) : (/out/i.test(st) ? 'no date given' : ''), hs: _.hsUrl(a), x, key: `s:${tid}:${pid}:${x.id || i}` }); }); });
    return { rows, log, logSince: log && log.leagues && log.leagues[lk] ? Object.values(all).map(e => (e.log && e.log[0] && e.log[0].d) || e.last || '').filter(Boolean).sort()[0] : '' };
  }
  const injRow = (r, lk) => `<a class="xinj" href="${_.href.player(lk, r.pid)}" data-act="ijgo" data-ijopen="${esc(r.pid)}">${_.headshot(r.hs, _.teamColor(r.team, LEAGUES[lk]), 40, r.name)}<span class="nm"><b>${esc(r.name)}</b><em>${esc([r.team.short || r.team.name, r.what].filter(Boolean).join(' · '))}</em></span><span class="fs"><span class="tag ${r.cls}">${esc(r.word)}</span><em>${esc(r.retWord ? r.retWord.charAt(0).toUpperCase() + r.retWord.slice(1) : (r.since ? 'since ' + niceDate(r.since) : ''))}</em></span></a>`;
  function sortInj(rows, nq) {
    if (/\b(return|back|returning|soonest|come back)\b/.test(nq)) return { rows: rows.slice().sort((a, b) => (a.ret || '9999') < (b.ret || '9999') ? -1 : 1), how: 'soonest back first' };
    if (/\b(newest|latest|recent|new|just|this week|happened)\b/.test(nq)) return { rows: rows.slice().sort((a, b) => (b.since || '') < (a.since || '') ? -1 : 1), how: 'newest first' };
    if (/\b(longest|oldest|earliest)\b/.test(nq)) return { rows: rows.slice().sort((a, b) => (a.since || '9999') < (b.since || '9999') ? -1 : 1), how: 'longest out first' };
    if (/\b(least|mild|minor)\b/.test(nq)) return { rows: rows.slice().sort((a, b) => a.sev - b.sev), how: 'least severe first' };
    /* most severe: out before day to day, and within a status the longest absence first (a fracture with a March return
       ahead of a sore hip for one game); no date counts as a long one; rest and personal days last */
    const today = HW.todayCT(); const days = r => { if (!r.ret) return r.sev >= 4 ? 45 : 3; const d = Math.round((new Date(r.ret + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 864e5); return Math.max(0, d); };
    const bad = r => /season|fracture|surgery|torn|tear|acl|achilles|rupture/i.test([r.what, r.x && r.x.details && r.x.details.detail, r.note, r.long].join(' ')) ? 400 : 0;
    const score = r => (r.rest ? 0 : r.sev) * 1000 + Math.min(999, days(r) + bad(r));
    return { rows: rows.slice().sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name)), how: 'most severe first' };
  }
  const glossary = () => `<div class="xans"><span class="xk">What the injury words mean</span><div class="xgloss">${GLOSS.map(([w, c, d]) => `<div class="xgw"><span class="tag ${c}">${esc(w)}</span><p>${esc(d)}</p></div>`).join('')}</div><p class="xsrc">Statuses come from each league's official injury report, through ESPN.</p></div>`;
  async function injuryAnswer(f, nq, has) {
    /* search covers the whole app, not the league tab you happen to be on: with no league or team named, the NBA report
       is shown (college publishes none). Naming college still gets the note. */
    const team = f.ts[0] || null; const lk = team ? team.lk : (leagueIn(nq) || 'nba');
    const L = LEAGUES[lk]; const wantsGloss = /\b(mean|means|meaning|what is|whats|define|explain|glossary|key|legend)\b/.test(nq) || /^ ?(injur[a-z]*|dtd|quest|questionable|out|doubtful|probable|gtd|day to day) ?$/.test(nq);
    const wantsPast = /\b(last (year|season)|this (year|season)|all season|so far|history|have been|has had|had)\b/.test(nq);
    const mine = /\b(my|mine|your|our)\b/.test(nq);
    if (!L.hasInjuries) return { html: (wantsGloss ? glossary() : '') + `<div class="xans"><span class="xk">${esc(L.label)} injuries</span><p class="xline dim">${esc(L.label)} teams don't publish an official injury report, so RIVL has nothing to list for college. The NBA and WNBA do.</p></div>`, kind: 'intent' };
    const F = HW.favs.all(); const myIds = new Set((F[lk] || []).map(String));
    const filt = team ? (t => String(t.id) === String(team.id)) : mine ? (t => myIds.has(String(t.id))) : null;
    const { rows, log, logSince } = await injuryRows(lk, filt);
    const { rows: sorted, how } = sortInj(rows, nq);
    const title = team ? `${team.t.short || team.t.name} injuries` : mine ? `Injuries on your ${L.label} teams` : `${L.label} injury report`;
    const count = sorted.length, restN = sorted.filter(r => r.rest).length, outN = sorted.filter(r => !r.rest && r.sev >= 4).length, qN = sorted.filter(r => !r.rest && r.sev > 0 && r.sev < 4).length;
    let line = count ? `<b>${plural(count, 'player')}</b> listed${outN ? `, ${outN} out` : ''}${qN ? `, ${qN} day to day or questionable` : ''}${restN ? `, ${restN} resting or away` : ''}${sorted.length > 1 ? ` · ${how}` : ''}.` : (team ? `No ${esc(team.t.short || team.t.name)} players are on the injury report.` : mine ? 'No one on your teams is on the injury report.' : 'The report is empty right now.');
    // the season so far, from RIVL's own log
    let past = '';
    if (log && log.leagues && log.leagues[lk]) { const all = Object.values(log.leagues[lk].all || {}); const tf = team ? (e => String(e.team.id) === String(team.id)) : mine ? (e => myIds.has(String(e.team.id))) : null; const mineLog = tf ? all.filter(tf) : all;
      const cleared = mineLog.filter(e => e.cleared), season = mineLog.filter(e => e.first >= (L.seasonStart || '2026-10-01').slice(0, 10) || true);
      const byPl = new Set(season.map(e => e.pid)).size;
      past = `<div class="xpast"><span class="xk2">The season so far</span><p>RIVL has logged <b>${plural(season.length, 'injury listing')}</b> across <b>${plural(byPl, 'player')}</b> since ${esc(niceDate(logSince || log.updated.slice(0, 10)))}; ${cleared.length} have cleared.${wantsPast && /last (year|season)/.test(nq) ? ' The log starts there, so last season isn\'t in it.' : ''}</p>${cleared.length ? `<div class="xclr">${cleared.sort((a, b) => b.cleared.localeCompare(a.cleared)).slice(0, 5).map(e => `<span><b>${esc(e.name)}</b> ${esc(e.what || '')} · cleared ${esc(niceDate(e.cleared))}</span>`).join('')}</div>` : ''}</div>`; }
    else if (wantsPast) past = `<p class="xsrc">RIVL started keeping its own injury log today; past seasons aren't in it. Counts and dates build from here.</p>`;
    const list = sorted.length ? `<div class="xinjs">${sorted.slice(0, 40).map(r => injRow(r, lk)).join('')}${sorted.length > 40 ? `<p class="xsrc">and ${sorted.length - 40} more</p>` : ''}</div>` : '';
    const SORTK = { 'most severe': 'most severe first', 'returning soonest': 'soonest back first', 'newest': 'newest first', 'longest out': 'longest out first' };
    const sortChips = sorted.length > 2 ? `<div class="xsorts">${[['most severe', 'Most severe'], ['returning soonest', 'Back soonest'], ['newest', 'Newest'], ['longest out', 'Longest out']].map(([k, l]) => `<button class="chip${SORTK[k] === how ? ' on' : ''}" aria-pressed="${SORTK[k] === how}" data-xq="${esc((team ? team.name : (mine ? 'my ' : L.label + ' ')) + ' injuries ' + k)}">${l}</button>`).join('')}</div>` : '';
    const head = team ? K().twho(team, title) : `<span class="xk">${esc(title)}</span>`;
    return { html: (wantsGloss ? glossary() : '') + `<div class="xans xinjans">${head}<p class="xline">${line}</p>${sortChips}${list}${past}<p class="xsrc">Official injury report, through ESPN. Dates from RIVL's log.</p></div>`, kind: 'intent' };
  }

  /* ---------- games: find the one the question means, read its box ---------- */
  async function gameFor(L, teamId, when) {
    const info = await V.teamInfo(L, teamId).catch(() => null); if (!info) return null;
    const sc = await HW.jSoft(`${HW.API(L)}/teams/${teamId}/schedule`, 300000).catch(() => null);
    const evs = (sc && sc.events || []).map(ev => { try { return HW.parseEvent(ev, L); } catch { return null; } }).filter(Boolean);
    if (!when || when.last) return evs.filter(g => g.state === 'post').slice(-1)[0] || info.last || null;
    if (when.next) return evs.find(g => g.state !== 'post') || info.next || null;
    return evs.find(g => HW.ymdOf(g.date) === when.ymd) || null;
  }
  const summary = (L, gid) => HW.jSoft(`${HW.API(L)}/summary?event=${encodeURIComponent(gid)}`, 60000).catch(() => null);
  function teamTotals(d, g, side) {
    const tms = d && d.boxscore && d.boxscore.teams || []; const t = tms.find(x => String(x.team.id) === g[side].id); if (!t) return null;
    const flat = (t.statistics || []).flatMap(x => x && x.displayValue != null ? [x] : (x && (x.stats || x.statistics) || []));
    const get = re => { const s = flat.find(x => re.test(String(x.name || '') + ' ' + String(x.label || ''))); return s ? String(s.displayValue) : ''; };
    const split = v => { const m = /^(\d+)-(\d+)$/.exec(v || ''); return m ? [+m[1], +m[2]] : null; };
    const fg = split(get(/^fieldGoalsMade-fieldGoalsAttempted|^FG$/i)), tp = split(get(/^threePointFieldGoalsMade|^3PT$/i)), ft = split(get(/^freeThrowsMade|^FT$/i));
    return { fg, tp, ft, fgPct: get(/^fieldGoalPct|^FG%/i), tpPct: get(/^threePointFieldGoalPct|^3P%/i), ftPct: get(/^freeThrowPct|^FT%/i), reb: get(/^totalRebounds|^REB$/i), oreb: get(/^offensiveRebounds|^OREB/i), ast: get(/^assists|^AST$/i), to: get(/^turnovers|^TO$/i), stl: get(/^steals|^STL$/i), blk: get(/^blocks|^BLK$/i), pip: get(/pointsInPaint/i), fb: get(/fastBreak/i), bench: get(/benchPoints/i), lead: get(/largestLead/i) };
  }
  function playerLine(d, pid) {
    for (const side of (d && d.boxscore && d.boxscore.players || [])) { const st = side.statistics && side.statistics[0]; if (!st) continue; const labels = st.labels || st.names || [];
      const a = (st.athletes || []).find(x => x.athlete && String(x.athlete.id) === String(pid)); if (!a) continue; if (a.didNotPlay || !a.stats || !a.stats.length) return { dnp: a.reason || 'Did not play' };
      const get = l => { const i = labels.indexOf(l); return i >= 0 ? a.stats[i] : ''; }; const sp = v => { const m = /^(\d+)-(\d+)$/.exec(v || ''); return m ? [+m[1], +m[2]] : null; };
      return { min: get('MIN'), pts: +get('PTS') || 0, reb: +get('REB') || 0, ast: +get('AST') || 0, stl: +get('STL') || 0, blk: +get('BLK') || 0, to: +get('TO') || 0, pf: +get('PF') || 0, pm: get('+/-'), fg: sp(get('FG')), tp: sp(get('3PT')), ft: sp(get('FT')), starter: !!a.starter }; }
    return null;
  }
  const gameHead = (L, g, lk) => { const done = g.state === 'post'; return `<a class="xgame" href="${_.href.game(lk, g.id)}"><span class="xgt">${K().crest(g.away, 26)}<b>${esc(g.away.short)}</b></span><span class="xgs">${done || g.state === 'in' ? `<b>${g.away.score}–${g.home.score}</b><em>${esc(done ? 'Final' : g.detail || 'Live')}</em>` : `<b>${esc(HW.tipOf(g))}</b><em>${esc(dayWord(HW.ymdOf(g.date)))}</em>`}</span><span class="xgt r"><b>${esc(g.home.short)}</b>${K().crest(g.home, 26)}</span></a>`; };
  async function shotCard(L, lk, d, g, opt) {
    const SC = V.shotChart; if (!SC || !d || !d.plays) return '';
    let shots = SC.shotsOf(d.plays, g); if (!shots.length || !SC.shotsTrusted(shots)) return '';
    if (opt.pid) shots = shots.filter(s => String(s.pid) === String(opt.pid)); else if (opt.side) shots = shots.filter(s => s.side === opt.side);
    if (!shots.length) return '';
    const made = shots.filter(s => s.made).length, col = opt.color || _.teamColor(g[opt.side || 'home'], L);
    return `<div class="xshot" style="${_.tcv(col)}">${SC.courtSvg(L, shots, { colorOf: () => col })}<div class="clegend"><span><i style="background:${esc(col)}"></i>Made</span><span><em class="missx" style="color:${esc(col)}">✕</em>Missed</span></div>${SC.zoneRows(shots, [{ head: `${made}-${shots.length}` }])}</div>`;
  }
  async function teamGameAnswer(e, nq, when) {
    const L = LEAGUES[e.lk], lk = e.lk; const g = await gameFor(L, e.id, when); if (!g) return { html: K().card(K().twho(e), `No ${esc(e.t.short || e.t.name)} game ${esc(when ? when.word : 'found')}.`, [], '', 'ESPN schedule'), kind: 'intent' };
    const side = g.home.id === String(e.id) ? 'home' : 'away', us = g[side], them = g[side === 'home' ? 'away' : 'home'];
    if (g.state === 'pre') {
      const ctx = await HW.forecastCtx(L, HW.todayCT()).catch(() => null); const f = _.safeF(L, g, ctx); const p = f ? (side === 'home' ? f.pHome : 1 - f.pHome) : null;
      return { html: `<div class="xans">${K().twho(e, `${esc(dayWord(HW.ymdOf(g.date)))} ${side === 'home' ? 'vs' : 'at'} ${esc(them.short)}`)}${gameHead(L, g, lk)}<p class="xline">${esc(us.short)} ${side === 'home' ? 'host' : 'visit'} the ${esc(them.short)} ${esc(dayWord(HW.ymdOf(g.date)))} at ${esc(HW.tipOf(g))}${p != null ? `. RIVL gives ${esc(us.short)} a <b>${Math.round(p * 100)}%</b> chance` : ''}.</p><p class="xsrc">ESPN schedule${p != null ? ' · RIVL forecast' : ''}</p></div>`, kind: 'intent' };
    }
    const d = await summary(L, g.id); const T = teamTotals(d, g, side), O = teamTotals(d, g, side === 'home' ? 'away' : 'home');
    const won = +us.score > +them.score; const wantsShots = /\b(shot chart|shots|shooting|missed|misses|made|makes|field goal|fg|three|3)/.test(nq);
    const miss = T && T.fg ? T.fg[1] - T.fg[0] : null;
    const line = `${esc(us.short)} ${won ? 'beat' : 'lost to'} the ${esc(them.short)} <b>${us.score}–${them.score}</b> ${esc(dayWord(HW.ymdOf(g.date)))}${T && T.fg ? `, shooting <b>${T.fg[0]} of ${T.fg[1]}</b> (${esc(T.fgPct)}%)${miss != null ? `, ${miss} misses` : ''}` : ''}${T && T.tp ? `, ${T.tp[0]} of ${T.tp[1]} from three` : ''}.`;
    const facts = T ? [['Field goals', T.fg ? `${T.fg[0]}-${T.fg[1]}` : ''], ['Missed', miss != null ? String(miss) : ''], ['Threes', T.tp ? `${T.tp[0]}-${T.tp[1]}` : ''], ['Free throws', T.ft ? `${T.ft[0]}-${T.ft[1]}` : ''], ['Rebounds', T.reb], ['Assists', T.ast], ['Turnovers', T.to], ['Points in paint', T.pip], ['Fast break', T.fb], ['Bench', T.bench]].filter(x => x[1]) : [];
    const cmp = O && T ? `<div class="xcmp2"><div><span></span><b>${esc(us.abbr)}</b><b>${esc(them.abbr)}</b></div>${[['FG', T.fg && `${T.fg[0]}-${T.fg[1]}`, O.fg && `${O.fg[0]}-${O.fg[1]}`], ['3PT', T.tp && `${T.tp[0]}-${T.tp[1]}`, O.tp && `${O.tp[0]}-${O.tp[1]}`], ['FT', T.ft && `${T.ft[0]}-${T.ft[1]}`, O.ft && `${O.ft[0]}-${O.ft[1]}`], ['REB', T.reb, O.reb], ['AST', T.ast, O.ast], ['TO', T.to, O.to]].filter(r => r[1] && r[2]).map(r => `<div><span>${r[0]}</span><b>${esc(String(r[1]))}</b><b>${esc(String(r[2]))}</b></div>`).join('')}</div>` : '';
    const shots = wantsShots ? await shotCard(L, lk, d, g, { side }) : '';
    return { html: `<div class="xans xgm">${K().twho(e, `${esc(dayWord(HW.ymdOf(g.date)))} ${side === 'home' ? 'vs' : 'at'} ${esc(them.short)}`)}${gameHead(L, g, lk)}<p class="xline">${line}</p>${shots}${facts.length ? `<div class="xfacts">${facts.map(fct => `<div><span>${esc(fct[0])}</span><b>${esc(String(fct[1]))}</b></div>`).join('')}</div>` : ''}${cmp}<a class="xgo2" href="${_.href.game(lk, g.id)}">Box score, plays and shots ${_.chev}</a><p class="xsrc">ESPN box score</p></div>`, kind: 'intent' };
  }
  async function playerGameAnswer(e, nq, when) {
    const L = LEAGUES[e.lk], lk = e.lk, tm = e.team; if (!tm) return null;
    const g = await gameFor(L, tm.id, when); if (!g) return { html: K().card(K().who(e), `No ${esc(tm.short || tm.name)} game ${esc(when ? when.word : 'found')}.`, [], '', 'ESPN schedule'), kind: 'intent' };
    if (g.state === 'pre') return teamGameAnswer({ type: 't', lk, id: String(tm.id), t: tm, name: tm.name }, nq, when);
    const d = await summary(L, g.id); const pl = playerLine(d, e.id);
    const side = g.home.id === String(tm.id) ? 'home' : 'away', them = g[side === 'home' ? 'away' : 'home'], us = g[side];
    if (!pl) return { html: `<div class="xans">${K().who(e)}${gameHead(L, g, lk)}<p class="xline dim">No line for ${esc(e.name)} in that box score.</p></div>`, kind: 'intent' };
    if (pl.dnp) return { html: `<div class="xans">${K().who(e)}${gameHead(L, g, lk)}<p class="xline">${esc(e.name)} did not play ${esc(dayWord(HW.ymdOf(g.date)))} (${esc(pl.dnp)}).</p><p class="xsrc">ESPN box score</p></div>`, kind: 'intent' };
    const miss = pl.fg ? pl.fg[1] - pl.fg[0] : null; const wantsShots = /\b(shot chart|chart|where|shots|shooting)\b/.test(nq);
    const asksMiss = /\b(miss|missed|misses)\b/.test(nq), asksTake = /\b(take|took|attempt|attempts|shots)\b/.test(nq);
    let line = `${esc(e.name)} had <b>${pl.pts} points</b>, ${pl.reb} rebounds and ${pl.ast} assists in ${esc(pl.min)} minutes ${esc(dayWord(HW.ymdOf(g.date)))} ${side === 'home' ? 'vs' : 'at'} the ${esc(them.short)}`;
    if (pl.fg) line += `, shooting <b>${pl.fg[0]} of ${pl.fg[1]}</b>${miss != null ? ` (${miss} missed)` : ''}${pl.tp ? `, ${pl.tp[0]} of ${pl.tp[1]} from three` : ''}${pl.ft ? `, ${pl.ft[0]} of ${pl.ft[1]} at the line` : ''}`;
    line += '.';
    if (asksMiss && miss != null) line = `${esc(e.name)} missed <b>${miss}</b> of ${pl.fg[1]} shots ${esc(dayWord(HW.ymdOf(g.date)))}${pl.tp ? ` (${pl.tp[1] - pl.tp[0]} of ${pl.tp[1]} threes)` : ''}. ` + line;
    else if (asksTake && pl.fg) line = `${esc(e.name)} took <b>${pl.fg[1]}</b> shots ${esc(dayWord(HW.ymdOf(g.date)))} and made ${pl.fg[0]}. ` + line;
    const facts = [['Points', pl.pts], ['FG', pl.fg ? `${pl.fg[0]}-${pl.fg[1]}` : ''], ['Missed', miss], ['3PT', pl.tp ? `${pl.tp[0]}-${pl.tp[1]}` : ''], ['FT', pl.ft ? `${pl.ft[0]}-${pl.ft[1]}` : ''], ['Rebounds', pl.reb], ['Assists', pl.ast], ['Steals', pl.stl], ['Blocks', pl.blk], ['Turnovers', pl.to], ['Minutes', pl.min], ['+/-', pl.pm]].filter(x => x[1] !== '' && x[1] != null);
    const shots = wantsShots || asksMiss ? await shotCard(L, lk, d, g, { pid: e.id, color: K().L_ ? _.teamColor(us, L) : undefined }) : '';
    return { html: `<div class="xans xgm">${K().who(e)}${gameHead(L, g, lk)}<p class="xline">${line}</p>${shots}<div class="xfacts">${facts.map(fct => `<div><span>${esc(fct[0])}</span><b>${esc(String(fct[1]))}</b></div>`).join('')}</div><a class="xgo2" href="${_.href.game(lk, g.id)}/p/${esc(String(e.id))}">This game ${_.chev}</a><p class="xsrc">ESPN box score</p></div>`, kind: 'intent' };
  }

  /* ---------- leaders ---------- */
  const CATS = [[/\b(three|3 ?point|3pt|3s|threes|shooter)/, 'tpm', 'Threes made', '3PM'], [/\b(point|scor|ppg)/, 'pts', 'Points', 'PPG'], [/\b(rebound|board|rpg)/, 'reb', 'Rebounds', 'RPG'], [/\b(assist|apg|passer|playmak)/, 'ast', 'Assists', 'APG'], [/\b(steal|spg)/, 'stl', 'Steals', 'SPG'], [/\b(block|bpg|rim protect)/, 'blk', 'Blocks', 'BPG'], [/\b(field goal|fg|efficien)/, 'fg', 'Field goal %', 'FG%'], [/\b(free throw|ft)/, 'ft', 'Free throw %', 'FT%'], [/\b(minute|mpg)/, 'min', 'Minutes', 'MPG'], [/\b(turnover)/, 'to', 'Turnovers', 'TOPG'], [/\b(double double)/, 'dd', 'Double-doubles', '']];
  /* the best lines of one night: every game's leaders from that day's scoreboard, ranked across the league */
  async function nightLeadersAnswer(nq, f, when) {
    const lk = leagueIn(nq) || 'nba', L = LEAGUES[lk]; const games = await HW.scoreboard(L, when.ymd, 60000).catch(() => []);
    const done = (games || []).filter(g => g.state === 'post' || g.state === 'in'); if (!done.length) return null;
    const cat = CATS.find(c => c[0].test(nq)) || CATS[1]; const want = { pts: /points/i, reb: /rebounds/i, ast: /assists/i }[cat[1]] || /points/i; const label = { pts: 'Points', reb: 'Rebounds', ast: 'Assists' }[cat[1]] || 'Points';
    const rows = []; done.forEach(g => ['away', 'home'].forEach(side => { const t = g[side], o = g[side === 'home' ? 'away' : 'home']; const l = (t.leaders || []).find(x => want.test(x.name || x.displayName || '')); const a = l && l.leaders && l.leaders[0]; if (!a || !a.athlete) return; rows.push({ v: +a.value || parseFloat(a.displayValue) || 0, a: a.athlete, t, o, g, side }); }));
    if (!rows.length) return null; rows.sort((a, b) => b.v - a.v); const list = rows.slice(0, 10), top = list[0];
    const live = done.some(g => g.state === 'in');
    const line = `<b>${esc(top.a.displayName)}</b> had the most ${label.toLowerCase()} ${esc(when.word)} with <b>${top.v}</b> ${top.side === 'home' ? 'vs' : 'at'} ${esc(top.o.short)}${live ? ' (some games still on)' : ''}.`;
    return { html: `<div class="xans"><span class="xk">${esc(L.label)} · ${esc(label)} ${esc(when.word)}</span><p class="xline">${line}</p><div class="xtops">${list.map((x, i) => `<a class="xtp" href="${_.href.player(lk, x.a.id)}"><span class="strk">${i + 1}</span>${_.headshot(x.a.headshot || '', _.teamColor(x.t, L), 34, x.a.displayName)}<span><b>${esc(x.a.displayName)}</b><em>${esc(x.t.short)} ${x.side === 'home' ? 'vs' : 'at'} ${esc(x.o.short)} · ${x.g.state === 'in' ? 'live' : `${x.t.score}-${x.o.score}`}</em></span><b class="xv">${x.v}</b></a>`).join('')}</div><p class="xsrc">Each team's leader from ESPN's scoreboard for that day.</p></div>`, kind: 'intent' };
  }
  async function leadersAnswer(nq, f) {
    const lk = leagueIn(nq) || 'nba', L = LEAGUES[lk]; const lg = await HW.hub.league(L).catch(() => null); if (!lg || !lg.players) return null;
    const cat = CATS.find(c => c[0].test(nq)) || CATS[0]; const key = /\b(percent(age)?|%|pct)\b/.test(nq) && cat[1] === 'tpm' ? 'tp' : cat[1];
    const rookies = /\brookie/.test(nq); const maxG = Math.max(1, ...lg.players.map(p => (p.s || {}).gp || 0));
    const qual = p => { const s = p.s || {}; return (s.gp || 0) >= Math.max(1, Math.ceil(maxG * .5)) && (s.min || 0) >= (lk.startsWith('ncaa') ? 10 : 12) && (!rookies || p.rookie); };
    const list = lg.players.filter(qual).map(p => ({ p, v: (p.s || {})[key] })).filter(x => x.v != null && (key !== 'tp' || ((x.p.s.tpa || 0) >= 2))).sort((a, b) => b.v - a.v).slice(0, 10); if (!list.length) return null;
    const idx = await V.teamsIndex(L).catch(() => ({})); const byAbbr = {}; Object.values(idx || {}).forEach(t => { if (t && t.abbr) byAbbr[t.abbr] = t; });
    const fmt = v => key === 'dd' ? String(Math.round(v)) : ['fg', 'tp', 'ft'].includes(key) ? pct1(v) : one(v);
    const top = list[0]; const line = `<b>${esc(top.p.n)}</b> leads the ${esc(L.label)}${rookies ? ' rookies' : ''} with <b>${fmt(top.v)}</b> ${esc(cat[3] || cat[2].toLowerCase())}${lg.lastSeason ? ' (last season\'s numbers until the new season has games)' : ''}.`;
    return { html: `<div class="xans"><span class="xk">${esc(L.label)}${rookies ? ' rookie' : ''} leaders · ${esc(key === 'tp' ? 'Three-point %' : cat[2])}</span><p class="xline">${line}</p><div class="xtops">${list.map((x, i) => { const t = byAbbr[x.p.team] || {}; return `<a class="xtp" href="${_.href.player(lk, x.p.id)}"><span class="strk">${i + 1}</span>${_.headshot(x.p.img, _.teamColor({ abbr: x.p.team, id: t.id }, L), 34, x.p.n)}<span><b>${esc(x.p.n)}</b><em>${esc(t.short || x.p.teamName || x.p.team)}</em></span><i>${fmt(x.v)}</i></a>`; }).join('')}</div><a class="xgo2" href="#stats">All leaders in Stats ${_.chev}</a><p class="xsrc">ESPN stats, through RIVL's data file</p></div>`, kind: 'intent' };
  }

  /* ---------- standings ---------- */
  async function standingsAnswer(nq, f) {
    const team = f.ts[0] || null; const lk = team ? team.lk : (leagueIn(nq) || 'nba'), L = LEAGUES[lk];
    const st = await HW.standings(L).catch(() => null); if (!st || !st.byId) return null;
    const idx = await V.teamsIndex(L).catch(() => ({})); const rows = Object.values(st.byId).filter(r => r.w + r.l > 0 || true);
    const grpWord = (nq.match(/\b(east|west|eastern|western|atlantic|central|southeast|northwest|pacific|southwest|big east|big ten|big 12|sec|acc|big twelve)\b/) || [])[1];
    const inGrp = r => !grpWord || K().norm(r.group || '').includes(K().norm(grpWord).replace(/ern$/, '')) || K().norm(r.groupAbbr || '').includes(K().norm(grpWord));
    const list = rows.filter(inGrp).sort((a, b) => (a.pos || 99) - (b.pos || 99) || (b.w - b.l) - (a.w - a.l));
    if (!list.length) return null;
    const row = (r, i) => { const t = idx[String(r.id)] || {}; return `<a class="xtp" href="${_.href.team(lk, r.id)}"><span class="strk">${r.pos || i + 1}</span>${t.logo ? `<img class="xlogo" src="${esc(t.logo)}" alt="" width="30" height="30" style="width:30px;height:30px">` : ''}<span><b>${esc(t.short || r.short || r.name)}</b><em>${esc(r.group || '')}</em></span><i>${r.w}-${r.l}</i></a>`; };
    if (team) { const r = st.byId[String(team.id)]; if (!r) return null; const grp = rows.filter(x => x.group === r.group).sort((a, b) => (a.pos || 99) - (b.pos || 99)); const i = grp.findIndex(x => String(x.id) === String(team.id));
      return { html: `<div class="xans">${K().twho(team)}<p class="xline">The ${esc(team.t.name)} are <b>${r.w}-${r.l}</b>${r.pos ? `, ${ord(r.pos)} in the ${esc(r.group || L.label)}` : ''}${r.gb ? ` (${esc(String(r.gb))} back)` : ''}.</p><div class="xtops">${grp.slice(Math.max(0, i - 2), i + 3).map((x, k) => row(x, Math.max(0, i - 2) + k)).join('')}</div><a class="xgo2" href="#standings">Full standings ${_.chev}</a><p class="xsrc">ESPN standings</p></div>`, kind: 'intent' }; }
    const top = list[0], tt = idx[String(top.id)] || {};
    return { html: `<div class="xans"><span class="xk">${esc(L.label)} standings${grpWord ? ' · ' + esc(grpWord.charAt(0).toUpperCase() + grpWord.slice(1)) : ''}</span><p class="xline"><b>${esc(tt.short || top.name)}</b> ${top.w + top.l ? `lead at <b>${top.w}-${top.l}</b>` : 'are first'}${list[1] ? `, ahead of ${esc((idx[String(list[1].id)] || {}).short || list[1].name)}` : ''}.</p><div class="xtops">${list.slice(0, 10).map(row).join('')}</div><a class="xgo2" href="#standings">Full standings ${_.chev}</a><p class="xsrc">ESPN standings</p></div>`, kind: 'intent' };
  }

  /* ---------- a player's season numbers in a sentence ---------- */
  function playerStatAnswer(e, nq) {
    const cat = CATS.find(c => c[0].test(nq)); if (!cat) return null; const { s, label } = K().statsOf(e.p); const key = /\b(percent(age)?|%|pct)\b/.test(nq) && cat[1] === 'tpm' ? 'tp' : cat[1]; const v = s[key]; if (v == null) return null;
    const fmt = ['fg', 'tp', 'ft'].includes(key) ? pct1(v) : one(v);
    return { html: `<div class="xans">${K().who(e)}<p class="xline">${esc(e.name)} averages <b>${fmt}</b> ${esc(key === 'tp' ? 'from three' : (cat[3] || cat[2]).toLowerCase())}${label ? ` (${esc(label)})` : ' this season'} over ${s.gp || 0} games${s.min ? `, ${one(s.min)} minutes a game` : ''}.</p><div class="xfacts">${[['PTS', one(s.pts)], ['REB', one(s.reb)], ['AST', one(s.ast)], ['FG%', pct1(s.fg)], ['3P%', pct1(s.tp)], ['FT%', pct1(s.ft)]].map(x => `<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div><a class="xgo2" href="${K().pHref(e)}">Full stats ${_.chev}</a><p class="xsrc">ESPN stats, through RIVL's data file</p></div>`, kind: 'intent' };
  }

  /* ---------- what if: a game without (or with) a player, as an estimate ---------- */
  async function whatIfAnswer(e, nq) {
    const L = LEAGUES[e.lk], lk = e.lk, tm = e.team; if (!tm) return null;
    const [info, ctx, R, inj] = await Promise.all([V.teamInfo(L, tm.id).catch(() => null), HW.forecastCtx(L, HW.todayCT()).catch(() => null), HW.rating ? HW.rating.get(L, e.id).catch(() => null) : null, HW.injuries(L).catch(() => null)]);
    const g = info && info.next; if (!g) return { html: K().card(K().who(e), `The ${esc(tm.short)} have no game coming up to run that on.`, [], '', 'ESPN schedule'), kind: 'intent' };
    const f = _.safeF(L, g, ctx); if (!f) return null; const side = g.home.id === String(tm.id) ? 'home' : 'away', them = g[side === 'home' ? 'away' : 'home'];
    const base = side === 'home' ? f.pHome : 1 - f.pHome;
    let hurt = false; if (inj && inj.byTeam) Object.values(inj.byTeam).forEach(t => (t.list || []).forEach(x => { if (String((x.athlete || {}).id) === String(e.id) && /out|doubt/i.test(x.status || '')) hurt = true; }));
    const ovr = R ? R.ovr : 74, mins = R && R.raw ? (R.raw.min || 30) : 30;
    const swing = Math.max(.5, Math.min(9, (ovr - 70) * .3)) * Math.min(1, mins / 34);   // points of margin a game, on the 2K scale
    const k = lk.startsWith('ncaa') ? .11 : .13; const logit = p => Math.log(p / (1 - p)), sig = x => 1 / (1 + Math.exp(-x));
    const withHim = hurt ? sig(logit(base) + swing * k) : base, without = hurt ? base : sig(logit(base) - swing * k);
    const asksWithout = /\b(without|not play|doesn t play|misses|out|sits|hurt|injured)\b/.test(nq) && !/\b(wasn t|weren t|isn t|if he (was|were) (healthy|back)|played)\b/.test(nq);
    return { html: `<div class="xans">${K().who(e)}${gameHead(L, g, lk)}<p class="xline">${esc(tm.short)} ${side === 'home' ? 'vs' : 'at'} ${esc(them.short)} ${esc(dayWord(HW.ymdOf(g.date)))}: <b>${Math.round(withHim * 100)}%</b> with ${esc(e.name.split(' ').slice(-1)[0])}, <b>${Math.round(without * 100)}%</b> without${hurt ? ` (he's listed out, so RIVL's number today is the one without him)` : ''}.</p>
      <div class="xfacts"><div><span>With him</span><b>${Math.round(withHim * 100)}%</b></div><div><span>Without him</span><b>${Math.round(without * 100)}%</b></div><div><span>His swing</span><b>${one(swing)} pts</b></div><div><span>RIVL rating</span><b>${R ? R.ovr : '—'}</b></div></div>
      <p class="xnote">An estimate. RIVL's game forecast is team-based (results, margin, rest, home court); it doesn't model who plays. The swing here comes from his RIVL rating and minutes: a ${R ? R.ovr : 74}-rated player at ${Math.round(mins)} minutes is worth about ${one(swing)} points of margin, and ${one(swing)} points moves a ${lk.startsWith('ncaa') ? 'college' : 'pro'} game's chances by about ${Math.round(swing * k * 25)} points of probability near even.</p><p class="xsrc">RIVL forecast and rating, ESPN schedule and injury report</p></div>`, kind: 'intent' };
  }

  /* ---------- the dispatcher ---------- */
  V.ask2 = async function (I, q, f, has) {
    const nq = f.nq; const K0 = K(); if (!K0) return null;
    const when = whenIn(nq);
    const injQ = /\b(injur|hurt|dtd|day to day|questionable|quest|doubtful|probable|gtd|game time decision|out for|sidelined|miss(ing)? (the )?game|health|returns? (soonest|first|next)|returning|back soonest|comes? back|coming back)/.test(nq);
    const whatIf = (/\bwhat if\b/.test(nq) || /\bif\b.*\b(hurt|injured|out|healthy|plays?|played|playing|wasn t|weren t|isn t|was|were|without|sits|misses)\b/.test(nq) || /\bwithout\b/.test(nq)) && f.ps.length === 1 && /\b(predict|prediction|chance|chances|odds|win|forecast|tonight|game|line|spread)\b/.test(nq);
    if (whatIf) { const r = await whatIfAnswer(f.ps[0], nq); if (r) return r; }
    if (injQ && !(f.ps.length === 1 && !f.ts.length && !/\b(team|teams|report|list|all|most|every)\b/.test(nq))) return injuryAnswer(f, nq, has);
    // a game: a team or a player, and a time ("last night", "tonight", "last game", a date) or a game-stat word
    const gameQ = when || /\b(score|box score|shot chart|shots|missed|misses|made|field goals|fg|threes|rebounds|assists|turnovers|box)\b/.test(nq) && /\b(game|last|tonight|today|yesterday|vs|against|at)\b/.test(nq);
    if (gameQ && f.ps.length === 1 && !f.ts.length) { const r = await playerGameAnswer(f.ps[0], nq, when); if (r) return r; }
    if (gameQ && f.ts.length === 1 && !f.ps.length) { const r = await teamGameAnswer(f.ts[0], nq, when); if (r) return r; }
    if (f.ps.length === 1 && !f.ts.length && /\b(average|averages|averaging|per game|ppg|rpg|apg|how many|percent(age)?|%|pct|shooting|stats|numbers)\b/.test(nq) && !when) { const r = playerStatAnswer(f.ps[0], nq); if (r) return r; }
    if (!f.ps.length && !f.ts.length && when && when.ymd && /\b(lead|leader|leaders|led|top|best|most|highest|scored|dropped|had)\b/.test(nq)) { const r = await nightLeadersAnswer(nq, f, when); if (r) return r; }
    if (!f.ps.length && /\b(lead|leader|leaders|leads|top|best|most|highest|who has the most|who scores)\b/.test(nq) && CATS.some(c => c[0].test(nq))) { const r = await leadersAnswer(nq, f); if (r) return r; }
    if (/\b(standing|standings|first place|last place|seed|rank|ranked|record|where (are|is)|playoff picture|table|who s (first|leading))\b/.test(nq) && !f.ps.length && !/\b(recruit|high school|prospect)\b/.test(nq)) { const r = await standingsAnswer(nq, f); if (r) return r; }
    return null;
  };
})();
