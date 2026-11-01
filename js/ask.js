/* SEARCH: Google inside the app.
   Type a name, a nickname, a misspelling or a question and the answer comes back as a card, never a link out, and with
   no AI service behind it (nothing is generated, so nothing costs a token or can be made up).

   1. Find the people and teams in the words. Every player in every league (the app's data file), every team, every
      ranked high-school recruit. Whole names, last names, nicknames, the start of a name still being typed, small typos.
   2. Read the question. A fixed set of question shapes, each tied to a field: age, height, high school, college, draft,
      hometown, injury, playing tonight, schedule, standing, roster, coach, stats.
   3. Compare when there are two or more: up to four players, or two teams, across leagues (per 40 minutes when the
      leagues differ, because a college game is shorter).
   4. Past the app's own data, in this order: Wikidata for exact facts (family, nickname, awards, teams, with dates),
      Wikipedia for the paragraph that answers the question, ESPN for the latest headlines. Every card names its source.
      When no source has it, the card says so instead of guessing. High-school recruits are minors: basketball only,
      never personal-life lookups. */
(function () {
  'use strict';
  const V = HW.v5, _ = V._, esc = HW.esc, store = HW.store, LEAGUES = HW.LEAGUES, ORDER = HW.ORDER;
  const LG = () => ORDER.filter(k => LEAGUES[k] && LEAGUES[k].sport === 'basketball');
  const LNAME = k => (LEAGUES[k] || {}).label || k.toUpperCase();
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function lev(a, b) { if (Math.abs(a.length - b.length) > 2) return 9; const d = []; for (let i = 0; i <= a.length; i++) d[i] = [i]; for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
  const NICK = { sga: 'shai gilgeous alexander', shai: 'shai gilgeous alexander', kd: 'kevin durant', bron: 'lebron james', steph: 'stephen curry', chef: 'stephen curry', wemby: 'victor wembanyama', 'greek freak': 'giannis antetokounmpo',
    joker: 'nikola jokic', ant: 'anthony edwards', 'ant man': 'anthony edwards', ad: 'anthony davis', pg: 'paul george', pg13: 'paul george', dame: 'damian lillard', spida: 'donovan mitchell', cp3: 'chris paul', book: 'devin booker', jjj: 'jaren jackson jr',
    juju: 'juju watkins', cc: 'caitlin clark', aja: 'aja wilson', paige: 'paige bueckers', flagg: 'cooper flagg', jdub: 'jalen williams', 'j dub': 'jalen williams', zion: 'zion williamson', ja: 'ja morant', trae: 'trae young', luka: 'luka doncic', giannis: 'giannis antetokounmpo', lebron: 'lebron james', jokic: 'nikola jokic' };
  const TEAMNICK = { mavs: 'mavericks', cavs: 'cavaliers', sixers: '76ers', dubs: 'warriors', wolves: 'timberwolves', blazers: 'trail blazers', okc: 'thunder', nola: 'pelicans', celts: 'celtics', knicks: 'knicks', heat: 'heat', zags: 'gonzaga', uconn: 'uconn', unc: 'north carolina', uk: 'kentucky', lsu: 'lsu' };
  const STOP = new Set('son sons daughter daughters kid kids child children dating girlfriend boyfriend partner family mother father mom dad parents brother sister worth salary contract nickname won win finals championship who vs versus v compare compared against and or with to the a an of is are was were how when where what whos which did does do in on at for from show me my stats stat statistics averages career season this year team teams players player roster many old age tall height weight college school high university go went graduate graduated attend attended drafted draft pick traded trade married wife husband spouse born hometown injury injured hurt status schedule next game games standings standing rank record seed play plays playing tonight today coach coaches coached better best leader leaders rookie rookies'.split(' '));
  const PERSONAL = /\b(son|sons|daughter|daughters|kid|kids|child|children|wife|husband|married|dating|girlfriend|boyfriend|partner|engaged|fiance|family|mother|father|mom|dad|parents|brother|sister|religion|worth|salary|contract|tattoo)\b/;

  /* ---------- the index: built once per visit from the app's data file, the team lists and the recruit list ---------- */
  let IDX = null, IDXP = null;
  async function index() {
    if (IDX) return IDX; if (IDXP) return IDXP;
    IDXP = (async () => {
      const ents = [], teamByAbbr = {};
      await Promise.all(LG().map(async lk => { const idx = await V.teamsIndex(LEAGUES[lk]).catch(() => ({}));
        Object.values(idx || {}).forEach(t => { if (!t || !t.name) return; teamByAbbr[lk + ':' + (t.abbr || '')] = t;
          const al = new Set([norm(t.name), norm(t.short), norm(t.abbr), norm(t.loc), norm((t.loc || '') + ' ' + (t.short || ''))].filter(Boolean));
          Object.entries(TEAMNICK).forEach(([k, v]) => { if (norm(t.short) === v || norm(t.name) === v) al.add(k); });
          ents.push({ type: 't', lk, id: String(t.id), name: t.name || t.short, t, al: [...al] }); }); }));
      const ppl = HW.hub ? await HW.hub.everyone().catch(() => []) : [];
      const nickOf = {}; Object.entries(NICK).forEach(([k, v]) => { (nickOf[v] = nickOf[v] || []).push(k); });
      ppl.forEach(p => { const n = norm(p.n); const al = [n, ...(nickOf[n] || [])]; ents.push({ type: 'p', lk: p.lk, id: String(p.id), name: p.n, p, al, team: teamByAbbr[p.lk + ':' + p.team] || null }); });
      const rec = HW.hub ? await HW.hub.recruits().catch(() => null) : null;
      if (rec) [['boys', 'ncaam'], ['girls', 'ncaaw']].forEach(([g, lk]) => Object.entries(rec[g] || {}).forEach(([cls, list]) => (list || []).forEach(r => { if (!r || !r.n) return;
        ents.push({ type: 'r', lk, id: (r.slug || r.n), name: r.n, r: { ...r, cls, g }, al: [norm(r.n)] }); })));
      IDX = { ents, teamByAbbr }; return IDX;
    })(); return IDXP;
  }

  /* each word finds its best match: a whole name, the start of the last word still being typed, a small typo */
  function findAll(ents, q) {
    const toks = norm(q).split(' ').filter(Boolean), hits = [], used = {};
    for (let n = 3; n >= 2; n--) for (let i = 0; i + n <= toks.length; i++) { if ([...Array(n).keys()].some(k => used[i + k])) continue; const ph = toks.slice(i, i + n).join(' ');
      const e = ents.find(e => e.al.includes(ph)); if (e && !hits.some(h => h.e === e)) { hits.push({ e, pos: i, score: 4 + n }); for (let k = 0; k < n; k++) used[i + k] = 1; } }
    toks.forEach((tok, i) => {
      if (used[i] || STOP.has(tok)) return;
      const last = i === toks.length - 1; let best = null;
      for (const e of ents) { let sc = 0;
        for (const a of e.al) { if (a === tok) { sc = Math.max(sc, 3); break; }
          for (const w of a.split(' ')) {
            if (w === tok) sc = Math.max(sc, 2.6);
            else if (tok.length >= 2 && w.startsWith(tok) && (last || tok.length >= 4)) sc = Math.max(sc, 2);
            else if (tok.length >= 4 && lev(tok, w) <= (tok.length >= 7 ? 2 : 1)) sc = Math.max(sc, 1.5);
            else if (last && tok.length >= 4 && w.length > tok.length && lev(tok, w.slice(0, tok.length)) <= 1) sc = Math.max(sc, 1.2); } }
        if (sc) { const pri = e.type === 'p' ? (e.lk === 'nba' ? .3 : e.lk === 'wnba' ? .2 : .1) + Math.min(.2, ((e.p.s || {}).pts || 0) / 150) : e.type === 't' ? (e.lk === 'nba' ? .25 : e.lk === 'wnba' ? .15 : 0) : -.1;
          const sc2 = sc + pri; if (!best || sc2 > best.score) best = { e, pos: i, score: sc2 }; } }
      if (best && !hits.some(h => h.e === best.e)) hits.push(best);
    });
    hits.sort((a, b) => a.pos - b.pos);
    return { ps: hits.filter(h => h.e.type === 'p').map(h => h.e), ts: hits.filter(h => h.e.type === 't').map(h => h.e), rs: hits.filter(h => h.e.type === 'r').map(h => h.e), nq: ' ' + norm(q) + ' ', hits };
  }
  function suggest(ents, q, filter) {
    const nq = norm(q); if (!nq) return []; const last = nq.split(' ').pop(), out = [];
    const ok = e => filter === 'all' || (filter === 'players' && e.type === 'p') || (filter === 'teams' && e.type === 't') || (filter === 'rookies' && e.type === 'p' && e.p.rookie) || (filter === 'college' && (e.lk === 'ncaam' || e.lk === 'ncaaw') && e.type !== 'r') || (filter === 'recruits' && e.type === 'r');
    for (const e of ents) { if (!ok(e)) continue; let sc = 0;
      for (const a of e.al) { if (a.startsWith(nq)) sc = Math.max(sc, 3); for (const w of a.split(' ')) {
        if (w.startsWith(last)) sc = Math.max(sc, 2); else if (last.length >= 4 && lev(last, w) <= (last.length >= 7 ? 2 : 1)) sc = Math.max(sc, 1); } }
      if (sc) out.push({ e, sc: sc + (e.type === 'p' ? Math.min(.4, ((e.p.s || {}).pts || 0) / 80) + (e.lk === 'nba' ? .2 : 0) : e.type === 't' ? (e.lk === 'nba' ? .3 : .1) : 0) }); }
    return out.sort((a, b) => b.sc - a.sc).slice(0, 8).map(x => x.e);
  }

  /* ---------- small pieces ---------- */
  const L_ = lk => LEAGUES[lk];
  const pColor = e => _.teamColor(e.team ? { id: e.team.id, abbr: e.team.abbr } : { abbr: e.p && e.p.team }, L_(e.lk));
  const pHref = e => _.href.player(e.lk, e.id), tHref = e => _.href.team(e.lk, e.id);
  const face = (e, size) => _.headshot(e.p && e.p.img, pColor(e), size, e.name);
  const crest = (t, size) => t && t.logo ? `<img class="xcr" src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" style="width:${size}px;height:${size}px">` : '';
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const one = v => v == null || isNaN(v) ? '-' : (Math.round(v * 10) / 10).toFixed(1);
  const statsOf = p => { const s = p.s || {}; return s.gp > 0 ? { s, label: '' } : p.prev && p.prev.gp ? { s: p.prev, label: 'last season' } : { s, label: '' }; };
  function who(e, sub) { return `<a class="xwho" href="${pHref(e)}">${face(e, 48)}<span><b>${esc(e.name)}</b><em>${esc(sub || [e.team ? e.team.short || e.team.name : e.p.teamName, e.p.pos, LNAME(e.lk)].filter(Boolean).join(' · '))}</em></span>${_.chev}</a>`; }
  function twho(e, sub) { return `<a class="xwho" href="${tHref(e)}">${crest(e.t, 44)}<span><b>${esc(e.t.name || e.t.short)}</b><em>${esc(sub || LNAME(e.lk))}</em></span>${_.chev}</a>`; }
  const card = (head, line, facts, note, src) => `<div class="xans">${head}${line ? `<p class="xline">${line}</p>` : ''}${facts && facts.length ? `<div class="xfacts">${facts.filter(f => f[1] != null && f[1] !== '').map(f => `<div><span>${esc(f[0])}</span><b>${esc(String(f[1]))}</b></div>`).join('')}</div>` : ''}${note ? `<p class="xnote">${note}</p>` : ''}${src ? `<p class="xsrc">${esc(src)}</p>` : ''}</div>`;
  const NOPE = 'MSHQ doesn\'t have that.';
  async function bio(e) { const L = L_(e.lk); const d = await HW.jSoft(`${HW.WEB(L)}/athletes/${e.id}`, 3600000).catch(() => null); return d && (d.athlete || d) || null; }
  const statLine = (p, lk) => { const { s, label } = statsOf(p); return `${one(s.pts)} points, ${one(s.reb)} rebounds and ${one(s.ast)} assists a game${label ? ` ${label}` : (lk === 'ncaam' || lk === 'ncaaw') && p.lastSeason ? ' last season' : ''}`; };

  /* ---------- answers from the app's own data ---------- */
  async function answer(I, q) {
    const f = findAll(I.ents, q), nq = f.nq, has = re => re.test(nq);
    if (!f.ps.length && !f.ts.length && !f.rs.length) {
      if (has(/ standing| table/)) return { html: page('Standings', 'Every table in your leagues', '#standings'), kind: 'page' };
      if (has(/ rookie/)) return { html: page('Rookie leaders', 'The new class, every category', '#stats'), kind: 'page' };
      if (has(/ leader| stat| top scor| most points/)) return { html: page('Stats', 'Leaders in every category, rookies, ratings', '#stats'), kind: 'page' };
      if (has(/ score| games| tonight| today| live/)) return { html: page('Scores', 'Every game, any day', '#scores'), kind: 'page' };
      return { html: '', kind: 'none', f };
    }
    if (f.ps.length >= 2) return { html: cmpPlayers(f.ps.slice(0, 4)), kind: 'intent', f };
    if (f.ts.length >= 2 && !f.ps.length) return { html: await cmpTeams(f.ts[0], f.ts[1]), kind: 'intent', f };
    if (f.rs.length && !f.ps.length && !f.ts.length) return { html: recruitCard(f.rs[0]), kind: 'recruit', f };
    if (f.ps.length === 1) return { ...(await playerAns(f.ps[0], has, nq)), f };
    return { ...(await teamAns(f.ts[0], has)), f };
  }
  const page = (t, s, href) => `<a class="xans xpage" href="${href}"><b>${esc(t)}</b><span>${esc(s)}</span>${_.chev}</a>`;

  async function playerAns(e, has, nq) {
    const p = e.p, L = L_(e.lk);
    if (has(/ injur| hurt| status| health| out /)) {
      const inj = await HW.injuries(L).catch(() => null); let x = null;
      if (inj && inj.byTeam) Object.values(inj.byTeam).forEach(t => (t.list || []).forEach(i => { if (String((i.athlete || {}).id || _.athId(i.athlete || {})) === e.id) x = i; }));
      if (!x) return { html: card(who(e), `${esc(e.name)} is not on the injury report.`, [['Status', 'Available']], '', 'League injury report, through ESPN'), kind: 'intent' };
      const det = x.details || {}, ret = _.retInfo(L, det.returnDate), part = [det.side && det.side !== 'Not Specified' ? det.side : '', det.location || det.type || ''].filter(Boolean).join(' ');
      return { html: card(who(e), `${esc(e.name)} is listed <b>${esc((_.statusWord(x.status) || x.status || 'out').toLowerCase())}</b>${part ? ` with a ${esc(part.toLowerCase())} injury` : ''}.`, [['Injury', part || det.detail], ['Back', ret ? ret.long || ret.short : 'No date given'], ['Updated', x.date ? new Date(x.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '']], x.longComment || x.shortComment ? esc(x.longComment || x.shortComment) : '', 'League injury report, through ESPN'), kind: 'intent' };
    }
    if (has(/ tonight| today| playing| next game| when .* play/)) {
      const tm = e.team; if (tm) { const sc = await HW.jSoft(`${HW.API(L)}/teams/${tm.id}/schedule`, 300000).catch(() => null); const evs = (sc && sc.events || []).map(ev => HW.parseEvent ? HW.parseEvent(ev, L) : null).filter(Boolean); const nx = evs.find(g => g.state !== 'post');
        if (nx) { const home = nx.home.id === tm.id, op = home ? nx.away : nx.home; return { html: card(who(e), `The ${esc(tm.short || tm.name)} play ${home ? 'the' : 'at'} ${esc(op.short)} ${esc(HW.relDay ? HW.relDay(HW.ymdOf(nx.date)) : '')} at ${esc(HW.tipOf ? HW.tipOf(nx) : '')}.`, [], '', 'ESPN schedule') + `<a class="xgo" href="${_.href.game(e.lk, nx.id)}">Open the game ${_.chev}</a>`, kind: 'intent' }; } }
    }
    const q = [/ draft| pick /, / high school| highschool| hs /, / college| university| graduat| attend| went to/, / born| from | hometown| where .* from/, / how old| age | birthday/, / how tall| height| weigh/];
    const which = q.findIndex(re => has(re));
    if (which >= 0) {
      const a = await bio(e); if (!a) return { html: card(who(e), NOPE, [], 'The player feed did not answer. Try again in a moment.'), kind: 'intent' };
      const src = 'ESPN player profile';
      if (which === 0) { const d = a.draft; const txt = d && d.year ? `${esc(e.name)} was drafted ${d.selection ? ord(d.selection) + ' overall' : ''}${d.round ? ` in round ${d.round}` : ''} in ${d.year}${d.team && (d.team.displayName || d.team.name) ? ` by the ${esc(d.team.displayName || d.team.name)}` : ''}.` : a.displayDraft ? esc(a.displayDraft) : e.lk.startsWith('ncaa') ? `${esc(e.name)} hasn't been drafted yet.` : `${esc(e.name)} went undrafted.`;
        return { html: card(who(e), txt, [['Year', d && d.year], ['Round', d && d.round], ['Pick', d && d.selection], ['College', a.college && a.college.name]], '', src), kind: 'intent' }; }
      if (which === 1) { const hs = a.highSchool && (a.highSchool.name || a.highSchool); return { html: hs ? card(who(e), `${esc(e.name)} went to ${esc(hs)}.`, [['High school', hs], ['Hometown', a.birthPlace && [a.birthPlace.city, a.birthPlace.state].filter(Boolean).join(', ')]], '', src) : null, kind: hs ? 'intent' : 'web' }; }
      if (which === 2) { const c = a.college && a.college.name; return { html: card(who(e), c ? `${esc(e.name)} ${e.lk.startsWith('ncaa') ? 'plays' : 'played'} college basketball at ${esc(c)}.` : `${esc(e.name)} did not play college basketball.`, [['College', c], ['Class', a.experience && a.experience.displayValue]], '', src), kind: 'intent' }; }
      if (which === 3) { const b = a.birthPlace; const s = b && [b.city, b.state, b.country && !/^(USA|United States)$/i.test(b.country) ? b.country : ''].filter(Boolean).join(', '); return { html: s ? card(who(e), `${esc(e.name)} is from ${esc(s)}.`, [['Born in', s], ['Born', a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '']], '', src) : null, kind: s ? 'intent' : 'web' }; }
      if (which === 4) { return { html: a.age ? card(who(e), `${esc(e.name)} is ${a.age}.`, [['Born', a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '']], '', src) : card(who(e), NOPE, [], 'None of MSHQ\'s sources list a birth date, so it won\'t guess.'), kind: 'intent' }; }
      if (which === 5) { return { html: card(who(e), `${esc(e.name)} is ${esc(a.displayHeight || '?')}${a.displayWeight ? `, ${esc(a.displayWeight)}` : ''}.`, [['Height', a.displayHeight], ['Weight', a.displayWeight], ['Position', a.position && a.position.displayName]], '', src), kind: 'intent' }; }
    }
    if (PERSONAL.test(nq)) return { html: playerCard(e), kind: 'web' };
    return { html: playerCard(e), kind: 'generic' };
  }
  function playerCard(e) {
    const p = e.p, { s, label } = statsOf(p), col = pColor(e);
    return `<a class="xans xlink xpl" href="${pHref(e)}" style="${_.tcv(col)}">${who(e).replace(/^<a class="xwho" href="[^"]*">/, '<span class="xwho">').replace(/<\/a>$/, '</span>')}
      <span class="xtrio">${[['PTS', s.pts], ['REB', s.reb], ['AST', s.ast], ['FG%', s.fg]].map(([k, v]) => `<span><b>${one(v)}</b><i>${k}</i></span>`).join('')}</span>
      <span class="xsub">${esc(p.rookie ? `Rookie${p.pick ? `, ${ord(p.pick)} pick` : ''} · ` : '')}${s.gp || 0} games${label ? `, ${label}` : (e.lk.startsWith('ncaa') && p.lastSeason ? ', last season' : '')}</span></a>`;
  }

  async function teamAns(e, has) {
    const L = L_(e.lk), t = e.t;
    if (has(/ schedule| next| upcoming| when do| when does| play next/)) {
      const sc = await HW.jSoft(`${HW.API(L)}/teams/${e.id}/schedule`, 300000).catch(() => null);
      const evs = (sc && sc.events || []).map(ev => HW.parseEvent ? HW.parseEvent(ev, L) : null).filter(Boolean).filter(g => g.state !== 'post').slice(0, 4);
      return { html: `<div class="xans">${twho(e, 'Schedule')}${evs.length ? `<div class="xsched">${evs.map(g => { const home = g.home.id === e.id, op = home ? g.away : g.home; return `<a href="${_.href.game(e.lk, g.id)}"><span>${esc(HW.relDay ? HW.relDay(HW.ymdOf(g.date)) : '')}</span><span>${home ? 'vs' : 'at'} ${crest(op, 20)} ${esc(op.short)}</span><b>${esc(HW.tipOf ? HW.tipOf(g) : '')}</b></a>`; }).join('')}</div>` : '<p class="xline">No games scheduled yet.</p>'}<p class="xsrc">ESPN schedule</p></div>`, kind: 'intent' };
    }
    if (has(/ roster| how many| players| coach/)) {
      const r = await HW.jSoft(`${HW.API(L)}/teams/${e.id}/roster`, 900000).catch(() => null);
      const n = r && r.athletes ? (Array.isArray(r.athletes[0] && r.athletes[0].items) ? r.athletes.reduce((s, g) => s + g.items.length, 0) : r.athletes.length) : 0;
      const co = r && r.coach && r.coach[0]; const coach = co ? `${co.firstName || ''} ${co.lastName || ''}`.trim() : '';
      const line = has(/ coach/) ? (coach ? `${esc(coach)} coaches ${esc(t.name)}.` : NOPE) : `${esc(t.name)} ${n ? `have ${n} players on the roster` : 'roster is not posted yet'}${e.lk === 'nba' && n ? ' (NBA teams carry up to 15, plus 3 two-way players)' : ''}.`;
      return { html: card(twho(e), line, [['Players', n || ''], ['Head coach', coach]], '', 'ESPN roster') + `<a class="xgo" href="${tHref(e)}">See the roster ${_.chev}</a>`, kind: 'intent' };
    }
    const st = await HW.standings(L).catch(() => null), row = st && st.byId[e.id];
    const line = row ? `The ${esc(t.short || t.name)} are ${row.w}-${row.l}${row.pos && L.standingsMode !== 'conferences' ? `, ${ord(row.pos)} in the ${esc(_.confName(row.group, row.groupAbbr))}` : ''}.` : `${esc(t.name)}.`;
    return { html: card(twho(e), line, row ? [['Record', `${row.w}-${row.l}`], ['Points', row.ppg != null ? one(row.ppg) : ''], ['Allowed', row.opp != null ? one(row.opp) : ''], ['Streak', row.strk]] : [], '', 'ESPN standings') + `<a class="xgo" href="${tHref(e)}">Team page ${_.chev}</a>`, kind: has(/ standing| rank| seed| record| place/) ? 'intent' : 'generic' };
  }

  function recruitCard(e) {
    const r = e.r;
    return card(`<div class="xwho"><span class="xrk">${r.rank ? '#' + r.rank : ''}</span><span><b>${esc(r.n)}</b><em>${esc([`Class of ${r.cls}`, r.pos, r.ht].filter(Boolean).join(' · '))}</em></span></div>`,
      r.commitTo ? `Committed to <b>${esc(r.commitTo)}</b>${r.commitSince ? ` since ${esc(r.commitSince)}` : ''}.` : `${esc(r.status || 'Uncommitted')}${r.top && r.top.length ? `. Top schools: ${esc(r.top.join(', '))}.` : '.'}`,
      [['National rank', r.rank], ['Position', [r.pos, r.posRank ? `No. ${r.posRank} at the position` : ''].filter(Boolean).join(', ')], ['High school', r.hs], ['Hometown', r.home], ['Size', [r.ht, r.wt ? r.wt + ' lbs' : ''].filter(Boolean).join(', ')]],
      'High-school players are minors: MSHQ shows their basketball only.', 'PrepRanks');
  }

  /* ---------- compare ---------- */
  function cmpPlayers(es) {
    const cross = es.some(e => e.lk !== es[0].lk), n = es.length;
    const sOf = e => statsOf(e.p).s;
    const v = (e, k) => { const s = sOf(e); let x = s[k]; if (x == null) return null; if (cross && ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm'].includes(k) && s.min > 0) x = x * 40 / s.min; return x; };
    const ts = e => { const s = sOf(e); const a = (s.fga || 0) + .44 * (s.fta || 0); return a > 0 ? 100 * s.pts / (2 * a) : null; };
    const rows = [['Points', 'pts'], ['Rebounds', 'reb'], ['Assists', 'ast'], ['Steals', 'stl'], ['Blocks', 'blk'], ['Threes made', 'tpm'], ['Field goal %', 'fg'], ['3-point %', 'tp'], ['Free throw %', 'ft'], ['True shooting %', ts], ['Minutes', 'min'], ['Games', 'gp']];
    const cols = `style="grid-template-columns:repeat(${n},1fr)"`;
    const lbl = cross ? 'Different leagues, so counting stats are per 40 minutes' : es.some(e => statsOf(e.p).label) ? 'Per game; last season where this one has not started' : 'This season, per game';
    return `<div class="xans xcmp"><div class="xch" ${cols}>${es.map(e => `<a href="${pHref(e)}" style="${_.tcv(pColor(e))}">${face(e, n > 3 ? 46 : n > 2 ? 54 : 64)}<b>${esc(e.name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '').split(' ').slice(-1)[0])}</b><em>${esc((e.team && (e.team.abbr || e.team.short)) || e.p.team)}${e.lk !== 'nba' ? ' · ' + esc(LNAME(e.lk)) : ''}</em></a>`).join('')}</div><p class="xnote xc">${lbl}</p>`
      + rows.map(([label, k]) => { const vals = es.map(e => typeof k === 'function' ? k(e) : v(e, k)); const nums = vals.filter(x => x != null); const best = k === 'min' || k === 'gp' ? null : nums.length ? Math.max(...nums) : null;
          return `<div class="xcr"><span>${label}</span><div ${cols}>${vals.map(x => `<b class="${x != null && best != null && Math.abs(x - best) < 1e-9 && nums.length > 1 ? 'w' : ''}">${x == null ? '-' : k === 'gp' ? Math.round(x) : one(x)}</b>`).join('')}</div></div>`; }).join('')
      + `<p class="xsrc">ESPN stats, through MSHQ's data file</p></div>`;
  }
  async function cmpTeams(a, b) {
    const same = a.lk === b.lk;
    const [sa, sb] = await Promise.all([HW.standings(L_(a.lk)).catch(() => null), same ? null : HW.standings(L_(b.lk)).catch(() => null)]);
    const ra = sa && sa.byId[a.id], rb = (same ? sa : sb) && (same ? sa : sb).byId[b.id];
    const f = (r, k) => r && r[k] != null ? +r[k] : null;
    const rows = [['Record', ra ? `${ra.w}-${ra.l}` : '-', rb ? `${rb.w}-${rb.l}` : '-', 0], ['Win %', ra && ra.w + ra.l ? (ra.w / (ra.w + ra.l)).toFixed(3).replace(/^0/, '') : '-', rb && rb.w + rb.l ? (rb.w / (rb.w + rb.l)).toFixed(3).replace(/^0/, '') : '-', 1, ra && ra.w / Math.max(1, ra.w + ra.l), rb && rb.w / Math.max(1, rb.w + rb.l)],
      ['Points', one(f(ra, 'ppg')), one(f(rb, 'ppg')), 1, f(ra, 'ppg'), f(rb, 'ppg')], ['Allowed', one(f(ra, 'opp')), one(f(rb, 'opp')), -1, f(ra, 'opp'), f(rb, 'opp')], ['Margin', f(ra, 'diff') != null ? HW.sign(f(ra, 'diff')) : '-', f(rb, 'diff') != null ? HW.sign(f(rb, 'diff')) : '-', 1, f(ra, 'diff'), f(rb, 'diff')]];
    let pr = '';
    if (same && f(ra, 'diff') != null && f(rb, 'diff') != null) { const pa = Math.round(100 / (1 + Math.exp(-(f(ra, 'diff') - f(rb, 'diff')) / 8)));
      pr = `<div class="xwp"><div class="bar"><i style="width:${pa}%;background:var(--ca)"></i><i style="width:${100 - pa}%;background:var(--cb)"></i></div><div class="cap"><span>${esc(a.t.abbr || '')} ${pa}%</span><span>Prediction, neutral floor</span><span>${esc(b.t.abbr || '')} ${100 - pa}%</span></div></div>`; }
    const ca = _.teamColor({ id: a.id, abbr: a.t.abbr }, L_(a.lk)), cb = _.teamColor({ id: b.id, abbr: b.t.abbr }, L_(b.lk));
    return `<div class="xans xcmp2" style="--ca:${esc(ca)};--cb:${esc(cb)}"><div class="xch2">${[a, b].map(e => `<a href="${tHref(e)}">${crest(e.t, 56)}<b>${esc(e.t.short || e.t.name)}</b><em>${esc(LNAME(e.lk))}</em></a>`).join('<span class="vs">vs</span>')}</div>${pr}`
      + rows.map(r => { const aw = r[3] && r[4] != null && r[5] != null && r[4] * r[3] > r[5] * r[3], bw = r[3] && r[4] != null && r[5] != null && r[5] * r[3] > r[4] * r[3];
          return `<div class="xcr2"><b class="${aw ? 'w' : ''}">${esc(String(r[1]))}</b><span>${r[0]}</span><b class="${bw ? 'w' : ''}">${esc(String(r[2]))}</b></div>`; }).join('')
      + (same ? '' : '<p class="xnote">Teams at different levels never play each other, so there is no prediction. Here are the numbers side by side.</p>') + '<p class="xsrc">ESPN standings</p></div>';
  }

  /* ---------- past the app's own data: Wikidata, Wikipedia, ESPN headlines ---------- */
  const WAPI = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&', WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*&';
  const jget = (u, ttl = 7 * 864e5) => HW.jSoft(u, ttl);
  const FACTS = [
    { re: /\b(son|sons|daughter|daughters|kid|kids|child|children)\b/, p: ['P40', 'P1971'], t: 'Children' }, { re: /\b(wife|husband|married|spouse)\b/, p: ['P26'], t: 'Spouse' },
    { re: /\b(dating|girlfriend|boyfriend|partner|engaged|fiance|fiancee|relationship)\b/, p: ['P451', 'P26'], t: 'Partner' }, { re: /\b(father|dad)\b/, p: ['P22'], t: 'Father' }, { re: /\b(mother|mom)\b/, p: ['P25'], t: 'Mother' },
    { re: /\b(parents?)\b/, p: ['P22', 'P25'], t: 'Parents' }, { re: /\b(brother|brothers|sister|sisters|sibling|siblings)\b/, p: ['P3373'], t: 'Siblings' }, { re: /\b(family|related|relatives?|cousin|uncle|aunt)\b/, p: ['P26', 'P40', 'P22', 'P25', 'P3373', 'P1038'], t: 'Family' },
    { re: /\b(nickname|called|known as)\b/, p: ['P1449'], t: 'Nickname' }, { re: /\b(awards?|honou?rs|accolades|mvp|all star|allstar)\b/, p: ['P166'], t: 'Awards' }, { re: /\b(teams|played for|career)\b/, p: ['P54'], t: 'Teams' }];
  const PLBL = { P40: 'Children', P1971: 'Number of children', P26: 'Spouse', P451: 'Partner', P22: 'Father', P25: 'Mother', P3373: 'Siblings', P1038: 'Relatives', P1449: 'Nickname', P166: 'Awards', P54: 'Teams' };
  const wantFacts = q => { const n = ' ' + norm(q) + ' ', ps = []; let t = null; FACTS.forEach(f => { if (f.re.test(n)) { f.p.forEach(x => { if (!ps.includes(x)) ps.push(x); }); t = t || f.t; } }); return ps.length ? { ps, t } : null; };
  async function wdFacts(title, props) {
    const x = await jget(WAPI + 'action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=' + encodeURIComponent(title)); const pg = x && x.query && x.query.pages[Object.keys(x.query.pages)[0]]; const q = pg && pg.pageprops && pg.pageprops.wikibase_item; if (!q) return null;
    const d = await jget(WD + 'action=wbgetentities&props=claims|labels&languages=en&ids=' + q); const cl = d && d.entities && d.entities[q].claims || {}; const rows = [], ids = [];
    props.forEach(P => (cl[P] || []).forEach(c => { const dv = c.mainsnak && c.mainsnak.datavalue; if (!dv) return; const v = dv.value, row = { p: P };
      if (dv.type === 'wikibase-entityid') { row.id = v.id; ids.push(v.id); } else if (dv.type === 'quantity') row.text = String(+v.amount); else if (dv.type === 'monolingualtext') row.text = v.text; else if (dv.type === 'string') row.text = v; else if (dv.type === 'time') row.text = v.time.slice(1, 11);
      const qf = c.qualifiers || {}, yr = k => { const t = qf[k] && qf[k][0].datavalue; return t ? t.value.time.slice(1, 5) : ''; }; const a = yr('P580'), b = yr('P582'); if (a || b) row.when = (a || '?') + (b ? '-' + b : (P === 'P26' || P === 'P451' ? '' : '-')); if (P === 'P166') { const pt = yr('P585'); if (pt) row.when = pt; }
      rows.push(row); }));
    if (ids.length) { const uniq = [...new Set(ids)].slice(0, 50); const e = await jget(WD + 'action=wbgetentities&props=labels&languages=en&ids=' + uniq.join('|')); rows.forEach(r => { if (r.id) { const en = e && e.entities && e.entities[r.id]; r.text = en && en.labels && en.labels.en ? en.labels.en.value : r.id; } }); }
    return { name: title, rows };
  }
  function factCard(r, topic) {
    if (!r.rows.length) return `<div class="xans xweb"><span class="xk">Wikidata</span><p class="xline dim">No public record lists ${esc(topic.toLowerCase())} for ${esc(r.name)}. MSHQ won't guess.</p></div>`;
    const g = {}; r.rows.forEach(x => { (g[x.p] = g[x.p] || []).push(x); });
    return `<div class="xans xweb"><span class="xk">Wikidata · ${esc(r.name)}</span>${Object.keys(g).map(P => `<div class="xfg"><span>${esc(PLBL[P] || P)}</span><div>${g[P].map(x => `<i>${esc(x.text)}${x.when ? ` <em>${esc(x.when)}</em>` : ''}</i>`).join('')}</div></div>`).join('')}<p class="xsrc">Wikidata, the open database behind Wikipedia (CC0)</p></div>`;
  }
  const splitWiki = text => { const out = []; let sec = ''; String(text).split('\n').forEach(l => { const m = l.match(/^=+\s*(.+?)\s*=+$/); if (m) { sec = m[1]; return; } if (l.trim().length > 40) out.push({ sec, p: l.trim() }); }); return out; };
  function bestPara(text, terms) {
    if (!text || !terms.length) return null;
    const paras = splitWiki(text), stems = terms.map(t => t.length > 5 ? t.slice(0, 5) : t), personal = terms.some(t => PERSONAL.test(t)); let best = null;
    paras.forEach(x => { const low = x.p.toLowerCase(); let sc = 0;
      stems.forEach(st => { const m = low.match(new RegExp('\\b' + st.replace(/[^a-z0-9]/g, ''), 'g')); if (m) sc += 2 + Math.min(m.length, 3); });
      if (personal && /personal life|family|early life/i.test(x.sec)) sc += 3; if (stems.some(st => x.sec.toLowerCase().includes(st))) sc += 3; if (!stems.some(st => low.includes(st))) sc /= 4;
      if (sc > 0 && (!best || sc > best.sc)) best = { sc, sec: x.sec, p: x.p }; });
    if (!best) return null;
    const sents = best.p.match(/[^.!?]+[.!?]+(\s|$)/g) || [best.p], keep = []; sents.forEach((s, i) => { if (stems.some(st => s.toLowerCase().includes(st))) keep.push(i); });
    const idx = keep.length ? keep : [0], from = idx[0], to = Math.min(sents.length - 1, idx[idx.length - 1] + (idx.length === 1 ? 1 : 0));
    let html = esc(sents.slice(from, to + 1).join(' ').trim()); stems.forEach(st => { html = html.replace(new RegExp('(\\b' + st.replace(/[^a-z0-9]/g, '') + '[a-z]*)', 'gi'), '<b>$1</b>'); });
    return { sec: best.sec, html };
  }
  const WSTOP = new Set([...STOP].filter(w => !/^(son|sons|daughter|daughters|kid|kids|child|children|dating|girlfriend|boyfriend|partner|family|mother|father|mom|dad|parents|brother|sister|worth|salary|contract|nickname|won|win|finals|championship|married|wife|husband|born|trade|traded|injury|draft|drafted|college|school|high)$/.test(w)).concat(['name', 'named', 'whats', 'tell', 'about', 'his', 'her', 'their', 'he', 'she', 'they', 'have', 'has', 'had', 'it', 'any', 'much']));
  function webTerms(f, q) {
    const nameW = new Set(); f.hits.forEach(h => h.e.al.forEach(a => a.split(' ').forEach(w => nameW.add(w))));
    const close = w => [...nameW].some(n => n.length >= 4 && (n.startsWith(w) || lev(w, n) <= (w.length >= 7 ? 2 : 1)));
    const terms = norm(q).split(' ').filter(w => w.length > 1 && !nameW.has(w) && !WSTOP.has(w) && !close(w));
    const e = f.ps[0] || f.ts[0]; const ent = !e ? '' : e.type === 'p' ? e.name : e.lk.startsWith('ncaa') ? `${e.t.name} ${e.lk === 'ncaaw' ? "women's" : "men's"} basketball` : e.t.name;
    if (/\bkids?\b|\bchildren\b|\bson\b|\bdaughter\b/.test(norm(q)) && !terms.includes('children')) terms.push('children');
    return { terms, ent, e };
  }
  async function wiki(q, W) {
    let query = (W.ent ? W.ent + ' ' : '') + W.terms.join(' '); if (!W.ent && !W.terms.length) query = q;
    const d = await jget(WAPI + 'action=query&list=search&srlimit=5&srprop=snippet&srsearch=' + encodeURIComponent(query), 864e5); const hits = d && d.query && d.query.search || []; if (!hits.length) return '';
    let pick = hits[0]; if (W.ent) { const en = W.ent.toLowerCase(); hits.forEach(h => { if (h.title.toLowerCase() === en) pick = h; }); }
    const x = await jget(WAPI + 'action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=' + encodeURIComponent(pick.title), 864e5); const pg = x && x.query && x.query.pages[Object.keys(x.query.pages)[0]];
    const best = bestPara(pg && pg.extract || '', W.terms); const clean = s => String(s || '').replace(/<span class="searchmatch">/g, '<b>').replace(/<\/span>/g, '</b>').replace(/<(?!\/?b>)[^>]+>/g, '');
    return `<div class="xans xweb"><span class="xk">Wikipedia${best && best.sec ? ' · ' + esc(best.sec) : ''}</span><p class="xline">${best ? best.html : clean(pick.snippet) + '…'}</p><p class="xsrc">From the article “${esc(pg ? pg.title : pick.title)}” (CC BY-SA 4.0)</p></div>`;
  }
  async function news(f) {
    const e = f.ps[0] || f.ts[0]; if (!e) return ''; const L = L_(e.lk);
    const d = await HW.jSoft(`${HW.API(L)}/news?limit=50`, 600000).catch(() => null); const keys = e.type === 'p' ? [norm(e.name).split(' ').slice(-1)[0]] : [norm(e.t.short), norm(e.t.name)];
    const items = (d && d.articles || []).filter(a => { const t = norm((a.headline || '') + ' ' + (a.description || '')); return keys.some(k => k && t.includes(k)); }).slice(0, 3);
    if (!items.length) return '';
    return `<div class="xans xweb"><span class="xk">Latest from ESPN</span>${items.map(a => `<div class="xnews">${a.images && a.images[0] ? `<img src="${esc(a.images[0].url)}" alt="" loading="lazy">` : ''}<span><b>${esc(a.headline)}</b><em>${esc(HW.ago ? HW.ago(a.published) : '')}${a.description ? ' · ' + esc(a.description) : ''}</em></span></div>`).join('')}<p class="xsrc">ESPN headlines</p></div>`;
  }

  /* ---------- the screen ---------- */
  const TRY = ['Shai vs Luka', 'When was Maxey drafted', 'Wemby height', 'Stephen Curry kids', 'Thunder schedule', 'UConn vs South Carolina', 'Where did Cooper Flagg go to high school', 'Flagg vs Acuff vs Harper', 'Who coaches the Knicks', 'Juju injury'];
  const FILTERS = [['all', 'All'], ['players', 'Players'], ['teams', 'Teams'], ['rookies', 'Rookies'], ['college', 'College'], ['recruits', 'Recruits']];
  let SEQ = 0;
  function rowOf(e) {
    if (e.type === 'p') return `<a class="xrow" href="${pHref(e)}">${face(e, 42)}<span><b>${esc(e.name)}</b><em>${esc([e.team ? e.team.short || e.team.name : e.p.teamName, e.p.rookie ? 'Rookie' : e.p.pos, LNAME(e.lk)].filter(Boolean).join(' · '))}</em></span>${_.chev}</a>`;
    if (e.type === 't') return `<a class="xrow" href="${tHref(e)}">${crest(e.t, 38)}<span><b>${esc(e.t.name || e.t.short)}</b><em>${esc(LNAME(e.lk))} · Team</em></span>${_.chev}</a>`;
    return `<a class="xrow" href="#search" data-xq="${esc(e.name)}"><span class="xrk sm">${e.r.rank ? '#' + e.r.rank : ''}</span><span><b>${esc(e.name)}</b><em>${esc([`Class of ${e.r.cls}`, e.r.pos, e.r.commitTo ? 'Committed: ' + e.r.commitTo : e.r.status].filter(Boolean).join(' · '))}</em></span>${_.chev}</a>`;
  }
  async function run(q, filter) {
    const my = ++SEQ, res = document.getElementById('xres'), web = document.getElementById('xwebb'), br = document.getElementById('xbrowse'); if (!res) return;
    const nq = norm(q); if (br) br.hidden = !!nq; document.querySelector('.xclr') && (document.querySelector('.xclr').hidden = !q);
    if (!nq) { res.innerHTML = ''; if (web) web.innerHTML = ''; return; }
    const I = await index(); if (my !== SEQ) return;
    const sug = suggest(I.ents, q, filter);
    let A = { html: '', kind: 'none', f: findAll(I.ents, q) };
    if (filter === 'all') { res.innerHTML = sug.length ? `<div class="xlist">${sug.slice(0, 5).map(rowOf).join('')}</div>` : ''; A = await answer(I, q).catch(() => A); if (my !== SEQ) return; }
    const onlyName = A.f.hits.length === 1 && nq.split(' ').every(w => !STOP.has(w));
    const rest = (onlyName ? sug.filter(e => !A.f.hits.some(h => h.e === e)) : sug);
    res.innerHTML = (A.html || '') + (rest.length && (filter !== 'all' || onlyName || !A.html) ? `${A.html ? '<p class="xmore">More matches</p>' : ''}<div class="xlist">${rest.map(rowOf).join('')}</div>` : '')
      || (A.kind === 'web' ? '' : `<div class="xnone"><b>Nothing found</b><p>Try a player, a team, a school, or a question like "Maxey drafted" or "Thunder schedule".</p></div>`);
    // past the app's own data: only when the question asks something the app's cards didn't answer
    if (!web) return; web.innerHTML = '';
    const isRecruit = A.f.rs.length && !A.f.ps.length && !A.f.ts.length;
    const W = webTerms(A.f, q); const asksMore = A.kind === 'web' || (A.kind === 'none' && nq.split(' ').length >= 2) || (A.kind === 'generic' && W.terms.length > 0);
    if (isRecruit || !asksMore || filter !== 'all') return;
    if (PERSONAL.test(nq) && A.f.ps.some(e => e.lk.startsWith('ncaa') && e.p.cls && /fr|freshman/i.test(e.p.cls))) { /* college players are adults; only high-school recruits are kept out */ }
    web.innerHTML = '<div class="xans xweb xload"><span class="xk">Looking it up</span><i></i><i></i><i></i></div>';
    const want = wantFacts(q), title = W.e && W.e.type === 'p' ? W.e.name : '';
    const parts = await Promise.all([want && title ? wdFacts(title, want.ps).then(r => r ? factCard(r, want.t) : '').catch(() => '') : '', wiki(q, W).catch(() => ''), news(A.f).catch(() => '')]);
    if (my !== SEQ) return;
    const html = parts.join('');
    web.innerHTML = html || `<div class="xans xweb"><span class="xk">Nothing found</span><p class="xline dim">No public source answers that yet. Try different words, or a player or team name.</p></div>`;
  }

  async function searchV() {
    const $main = document.getElementById('main');
    const q0 = store.get('v5:xq', '') || '', f0 = store.get('v5:xf', 'all') || 'all';
    const recent = (store.get('v5:xrecent', []) || []).slice(0, 6);
    $main.innerHTML = `<div class="xpage"><h1 class="xtitle">Search</h1>
      <label class="xbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="xq" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Players, teams, schools, questions" value="${esc(q0)}" aria-label="Search"><button class="xclr" data-act="xclear" aria-label="Clear"${q0 ? '' : ' hidden'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></label>
      <div class="xchips">${FILTERS.map(([k, l]) => `<button class="chip${k === f0 ? ' on' : ''}" data-xf="${k}" aria-pressed="${k === f0}">${l}</button>`).join('')}</div>
      <div id="xres"></div><div id="xwebb"></div>
      <div id="xbrowse"${q0 ? ' hidden' : ''}>${recent.length ? `<div class="sec"><h2>Recent</h2><button data-act="xrclear">Clear</button></div><div class="xlist">${recent.map(r => `<button class="xrow xrq" data-xq="${esc(r)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg><span><b>${esc(r)}</b></span></button>`).join('')}</div>` : ''}
        <div class="sec"><h2>Try asking</h2></div><div class="xtry">${TRY.map(t => `<button class="chip" data-xq="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <p class="xfoot">Answers come from MSHQ's own data first, then Wikidata, Wikipedia and ESPN. Every card names its source, and when no source has the answer it says so.</p></div></div>`;
    const inp = $main.querySelector('#xq'); let t = null, filter = f0;
    const go = v => { store.set('v5:xq', v); clearTimeout(t); t = setTimeout(() => run(v, filter), 140); };
    const remember = v => { v = String(v || '').trim(); if (v.length < 2) return; const a = (store.get('v5:xrecent', []) || []).filter(x => x.toLowerCase() !== v.toLowerCase()); a.unshift(v); store.set('v5:xrecent', a.slice(0, 8)); };
    inp.addEventListener('input', () => go(inp.value));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { remember(inp.value); inp.blur(); } });
    if ($main._xClick) $main.removeEventListener('click', $main._xClick);
    $main.addEventListener('click', $main._xClick = e => {
      if (!document.getElementById('xq')) return;
      const qb = e.target.closest('[data-xq]'); if (qb) { e.preventDefault(); inp.value = qb.dataset.xq; remember(inp.value); go(inp.value); return; }
      const fb = e.target.closest('[data-xf]'); if (fb) { filter = fb.dataset.xf; store.set('v5:xf', filter); $main.querySelectorAll('[data-xf]').forEach(b => { const on = b === fb; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); run(inp.value, filter); return; }
      if (e.target.closest('[data-act="xclear"]')) { e.preventDefault(); inp.value = ''; store.set('v5:xq', ''); run('', filter); inp.focus(); return; }
      if (e.target.closest('[data-act="xrclear"]')) { e.preventDefault(); store.set('v5:xrecent', []); searchV(); return; }
      if (e.target.closest('a.xrow, a.xans, a.xwho, a.xgo') && inp.value) remember(inp.value);
    });
    if (q0) run(q0, filter); else index();   // build the index while the person starts typing
    document.title = 'Search · MSHQ';
  }

  HW.ask = { index, findAll, suggest, answer, norm, lev, cmpPlayers };
  V.search = searchV;
})();
