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
  /* ordinary words that are also bits of names ("east", "night", "thunder", "west", "mean"): they never match a name on their
     own inside a longer question, only as part of a whole name ("tatum west") or when the whole query is that one word */
  const COMMON = new Set(('last night east west north south mean means date return most best top game games score shot shots chart missed made make take took many much does what when where who how why injury injured injuries out tonight today yesterday tomorrow season year team teams player players by with without vs and the on in of for report list all order severe sort sorted rank ranked standings standing first second third place seed leaders leader leads lead points rebounds assists steals blocks threes three percent percentage average averages per field goal goals free throw throws minutes turnovers rookie rookies college high school class prospect recruit recruits predict prediction chance odds win forecast if not hurt playing play played plays day days week month back soon soonest newest latest recent longest oldest mild minor least less more than over under between compare versus against home road away record wins losses loss streak next upcoming schedule coach coaches roster draft drafted pick height tall weight age old born from hometown kids wife husband children son daughter salary contract shoes awards mvp nickname key legend glossary define explain tell show give list me my mine our your their his her it its this that these those about near far big small long short new old good bad better best worst great').split(' '));
  function findAll(ents, q) {
    const toks = norm(q).split(' ').filter(Boolean), hits = [], used = {};
    const alone = toks.length === 1;
    for (let n = 3; n >= 2; n--) for (let i = 0; i + n <= toks.length; i++) { if ([...Array(n).keys()].some(k => used[i + k])) continue; const ph = toks.slice(i, i + n).join(' ');
      const e = ents.find(e => e.al.includes(ph)); if (e && !hits.some(h => h.e === e)) { hits.push({ e, pos: i, score: 4 + n }); for (let k = 0; k < n; k++) used[i + k] = 1; } }
    toks.forEach((tok, i) => {
      if (used[i] || STOP.has(tok) || (!alone && COMMON.has(tok))) return;
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
    /* a typo match is only trusted next to something spelled right: in a sentence with no exact or started name anywhere
       ("testing if this works correctly"), a word that merely resembles a name is not that name */
    if (toks.length >= 3 && !hits.some(h => h.score >= 2)) hits.length = 0;
    return { ps: hits.filter(h => h.e.type === 'p').map(h => h.e), ts: hits.filter(h => h.e.type === 't').map(h => h.e), rs: hits.filter(h => h.e.type === 'r').map(h => h.e), nq: ' ' + norm(q) + ' ', hits };
  }
  /* who you follow ranks first among equal matches: "jalen" means your Jalen before the league's */
  const followed = e => { try { if (e.type === 't') return HW.favs.has(e.lk, e.id); if (e.type === 'p') return !!(V.fplayers && V.fplayers.all().some(p => String(p.id) === e.id)); } catch { } return false; };
  function suggest(ents, q, filter) {
    const nq = norm(q); if (!nq) return []; const last = nq.split(' ').pop(), out = []; const lastOk = nq.split(' ').length === 1 || !COMMON.has(last);
    const ok = e => filter === 'all' || (filter === 'players' && e.type === 'p') || (filter === 'teams' && e.type === 't') || (filter === 'rookies' && e.type === 'p' && e.p.rookie) || (filter === 'college' && (e.lk === 'ncaam' || e.lk === 'ncaaw') && e.type !== 'r') || (filter === 'recruits' && e.type === 'r');
    for (const e of ents) { if (!ok(e)) continue; let sc = 0;
      for (const a of e.al) { if (a.startsWith(nq)) sc = Math.max(sc, 3); if (lastOk) for (const w of a.split(' ')) {
        if (w.startsWith(last)) sc = Math.max(sc, 2); else if (last.length >= 4 && lev(last, w) <= (last.length >= 7 ? 2 : 1)) sc = Math.max(sc, 1); } }
      if (sc < 2 && nq.split(' ').length >= 3) sc = 0;   // typo-only matches are for short searches, not sentences
      if (sc) out.push({ e, sc: sc + (e.type === 'p' ? Math.min(.4, ((e.p.s || {}).pts || 0) / 80) + (e.lk === 'nba' ? .2 : 0) : e.type === 't' ? (e.lk === 'nba' ? .3 : .1) : 0) + (followed(e) ? .8 : 0) }); }
    // every name the query spells out comes first (all of them in "A vs B vs C"), then what the last word is starting to spell
    const named = findAll(ents, q).hits.map(h => h.e).filter(ok);
    return [...named, ...out.sort((a, b) => b.sc - a.sc).map(x => x.e).filter(e => !named.includes(e))].slice(0, 8);
  }

  /* ---------- small pieces ---------- */
  const L_ = lk => LEAGUES[lk];
  const pColor = e => _.teamColor(e.team ? { id: e.team.id, abbr: e.team.abbr } : { abbr: e.p && e.p.team }, L_(e.lk));
  const pHref = e => _.href.player(e.lk, e.id), tHref = e => _.href.team(e.lk, e.id);
  const face = (e, size) => _.headshot(e.p && e.p.img, pColor(e), size, e.name);
  const crest = (t, size) => t && t.logo ? `<img class="xlogo" src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" style="width:${size}px;height:${size}px">` : '';
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const one = v => v == null || isNaN(v) ? '-' : (Math.round(v * 10) / 10).toFixed(1);
  const statsOf = p => { const s = p.s || {}; return s.gp > 0 ? { s, label: '' } : p.prev && p.prev.gp ? { s: p.prev, label: 'last season' } : { s, label: '' }; };
  function who(e, sub) { return `<a class="xwho" href="${pHref(e)}">${face(e, 48)}<span><b>${esc(e.name)}</b><em>${esc(sub || [e.team ? e.team.short || e.team.name : e.p.teamName, e.p.pos, LNAME(e.lk)].filter(Boolean).join(' · '))}</em></span>${_.chev}</a>`; }
  function twho(e, sub) { return `<a class="xwho" href="${tHref(e)}">${crest(e.t, 44)}<span><b>${esc(e.t.name || e.t.short)}</b><em>${esc(sub || LNAME(e.lk))}</em></span>${_.chev}</a>`; }
  const card = (head, line, facts, note, src) => `<div class="xans">${head}${line ? `<p class="xline">${line}</p>` : ''}${facts && facts.length ? `<div class="xfacts">${facts.filter(f => f[1] != null && f[1] !== '').map(f => `<div><span>${esc(f[0])}</span><b>${esc(String(f[1]))}</b></div>`).join('')}</div>` : ''}${note ? `<p class="xnote">${note}</p>` : ''}${src ? `<p class="xsrc">${esc(src)}</p>` : ''}</div>`;
  const NOPE = 'RIVL doesn\'t have that.';
  async function bio(e) { const L = L_(e.lk); const d = await HW.jSoft(`${HW.WEB(L)}/athletes/${e.id}`, 3600000).catch(() => null); return d && (d.athlete || d) || null; }
  const statLine = (p, lk) => { const { s, label } = statsOf(p); return `${one(s.pts)} points, ${one(s.reb)} rebounds and ${one(s.ast)} assists a game${label ? ` ${label}` : (lk === 'ncaam' || lk === 'ncaaw') && p.lastSeason ? ' last season' : ''}`; };

  /* ---------- answers from the app's own data ---------- */
  async function answer(I, q) {
    const f = findAll(I.ents, q), nq = f.nq, has = re => re.test(nq);
    // the wider question engine (injuries, games, leaders, standings, what-ifs) gets the first look
    if (V.ask2) { try { const r2 = await V.ask2(I, q, f, has); if (r2) return { ...r2, f }; } catch (e) { console.error(e); } }
    /* "top high school players", "best recruits", "class of 2028 girls": the recruit rankings, basketball only */
    if (!f.rs.length && has(/high ?school|\bhs\b|recruit|prospect|class of 20\d\d|prep /)) {
      const girls = has(/girl|women|woman|wbb|female/), cm = nq.match(/20(\d\d)/), g = girls ? 'girls' : 'boys';
      const rs = I.ents.filter(e => e.type === 'r' && e.r.g === g); const classes = [...new Set(rs.map(e => e.r.cls))].sort();
      const cls = cm && classes.includes('20' + cm[1]) ? '20' + cm[1] : classes[0];
      const top = rs.filter(e => e.r.cls === cls).sort((a, b) => (a.r.rank || 999) - (b.r.rank || 999)).slice(0, 10);
      if (top.length) return { html: `<div class="xans"><span class="xk">Top ${girls ? 'girls' : 'boys'} recruits · Class of ${esc(cls)}</span><div class="xrecs">${top.map(e => `<a class="strow strec" href="${V.recruitHref ? V.recruitHref(e.r.g, e.r.cls, e.r) : '#search'}"><span class="strk">${e.r.rank || ''}</span>${_.headshot(e.r.img || '', '#5B6B8C', 40, e.name)}<span class="stwho"><b>${esc(e.name)}</b><em>${esc([e.r.pos, e.r.ht, e.r.hs].filter(Boolean).join(' · '))}</em></span><span class="strc${e.r.commitTo ? ' on' : ''}">${esc(e.r.commitTo || 'Uncommitted')}</span></a>`).join('')}</div>${page('All recruits', 'Every class, boys and girls, in Stats', '#stats')}<p class="xsrc">Rankings: PrepRanks</p></div>`, kind: 'intent', f, rec: g };
    }
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
    return { ...(await teamAns(f.ts[0], has, I)), f };
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
      if (which === 4) { return { html: a.age ? card(who(e), `${esc(e.name)} is ${a.age}.`, [['Born', a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '']], '', src) : card(who(e), NOPE, [], 'None of RIVL\'s sources list a birth date, so it won\'t guess.'), kind: 'intent' }; }
      if (which === 5) { return { html: card(who(e), `${esc(e.name)} is ${esc(a.displayHeight || '?')}${a.displayWeight ? `, ${esc(a.displayWeight)}` : ''}.`, [['Height', a.displayHeight], ['Weight', a.displayWeight], ['Position', a.position && a.position.displayName]], '', src), kind: 'intent' }; }
    }
    if (PERSONAL.test(nq)) return { html: await playerFull(e).catch(() => playerCard(e)), kind: 'web', newsDone: true };
    return { html: await playerFull(e).catch(() => playerCard(e)), kind: 'generic', newsDone: true };
  }
  function playerCard(e) {
    const p = e.p, { s, label } = statsOf(p), col = pColor(e);
    return `<a class="xans xlink xpl" href="${pHref(e)}" style="${_.tcv(col)}">${who(e).replace(/^<a class="xwho" href="[^"]*">/, '<span class="xwho">').replace(/<\/a>$/, '</span>')}
      <span class="xtrio">${[['PTS', s.pts], ['REB', s.reb], ['AST', s.ast], ['FG%', s.fg]].map(([k, v]) => `<span><b>${one(v)}</b><i>${k}</i></span>`).join('')}</span>
      <span class="xsub">${esc(p.rookie ? `Rookie${p.pick ? `, ${ord(p.pick)} pick` : ''} · ` : '')}${s.gp || 0} games${label ? `, ${label}` : (e.lk.startsWith('ncaa') && p.lastSeason ? ', last season' : '')}</span></a>`;
  }

  /* the full player answer: the stat line, then everything people look up about a player on one card: status (hurt or
     available), the next game, the RIVL rating, who they are (age, height, from, drafted, college), and the latest headlines */
  async function playerFull(e) {
    const p = e.p, L = L_(e.lk), tm = e.team;
    const [inj, a, info, nw] = await Promise.all([HW.injuries(L).catch(() => null), bio(e).catch(() => null), tm ? V.teamInfo(L, tm.id).catch(() => null) : null, HW.jSoft(`${HW.API(L)}/news?limit=50`, 600000).catch(() => null)]);
    let x = null; if (inj && inj.byTeam) Object.values(inj.byTeam).forEach(t => (t.list || []).forEach(i => { if (String((i.athlete || {}).id || _.athId(i.athlete || {})) === e.id) x = i; }));
    const det = x && x.details || {}, part = x ? [det.side && det.side !== 'Not Specified' ? det.side : '', det.location || det.type || ''].filter(Boolean).join(' ') : '';
    const ret = x ? _.retInfo(L, det.returnDate) : null;
    const status = x ? `<div class="xst hurt"><i class="${/out/i.test(x.status) ? 'out' : 'q'}"></i><b>${esc(_.statusWord(x.status) || x.status)}</b><span>${esc(part)}${ret ? ` · ${esc(ret.far ? 'out for the season' : 'back around ' + (ret.short || '').replace(/^back around /, ''))}` : ''}</span></div>` : `<div class="xst ok"><i></i><b>Available</b><span>not on the injury report</span></div>`;
    const nx = info && info.next; const game = nx ? (() => { const home = nx.home.id === tm.id, op = home ? nx.away : nx.home; return `<a class="xgl" href="${_.href.game(e.lk, nx.id)}"><span>Next</span>${crest(op, 22)}<em>${home ? 'vs' : 'at'} ${esc(op.short || op.name)}</em><b>${esc(HW.relDay ? HW.relDay(HW.ymdOf(nx.date)) : '')}, ${esc(HW.tipOf ? HW.tipOf(nx) : '')}</b>${_.chev}</a>`; })() : '';
    const R = HW.rating && HW.rating.cached ? HW.rating.cached(L, e.id) : null;
    const facts = a ? [['Age', a.age], ['Height', a.displayHeight], ['Weight', a.displayWeight], ['From', a.birthPlace && [a.birthPlace.city, a.birthPlace.state || a.birthPlace.country].filter(Boolean).join(', ')], ['College', a.college && a.college.name], ['Drafted', a.draft && a.draft.year ? `${a.draft.year}, ${a.draft.selection ? ord(a.draft.selection) + ' pick' : 'round ' + (a.draft.round || '?')}` : ''], ['Experience', a.experience && a.experience.displayValue]].filter(f => f[1]) : [];
    const factsH = facts.length ? `<div class="xfacts">${facts.map(f => `<div><span>${esc(f[0])}</span><b>${esc(String(f[1]))}</b></div>`).join('')}</div>` : '';
    const last = norm(e.name).split(' ').slice(-1)[0]; const items = (nw && nw.articles || []).filter(ar => norm((ar.headline || '') + ' ' + (ar.description || '')).includes(last)).slice(0, 2);
    const newsH = items.length ? `<div class="xnewsb"><span class="xk2">Latest</span>${items.map(ar => `<div class="xnews">${ar.images && ar.images[0] ? `<img src="${esc(ar.images[0].url)}" alt="" loading="lazy">` : ''}<span><b>${esc(ar.headline)}</b><em>${esc(HW.ago ? HW.ago(ar.published) : '')}</em></span></div>`).join('')}</div>` : '';
    const rate = R ? `<div class="xrate"><b class="rtb ${R.ovr >= 90 ? 't5' : R.ovr >= 80 ? 't4' : R.ovr >= 70 ? 't3' : R.ovr >= 60 ? 't2' : 't1'}">${R.ovr}</b><span><b>RIVL rating</b><em>${esc(HW.rating.summary(R))}</em></span></div>` : '';
    return playerCard(e).replace(/<\/a>$/, '') .replace(/^<a class="xans xlink xpl"/, '<div class="xans xpl xpfull"') + status + game + rate + factsH + newsH + `<a class="xgo2" href="${pHref(e)}">Full profile, stats and game log ${_.chev}</a></div>`;
  }
  async function teamAns(e, has, I) {
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
    /* The team answer: everything about the team on one card, and when a school has a men's and a women's team, one card
       for the school with both, so a search for "UConn" never shows the same crest three times. Each team: where it stands
       (or, before the season, last season's record), the next game, the last result, the top scorers, who's hurt, and the
       latest headlines. The card is the way in; there is no second "Team page" link. */
    const twin = (I ? I.ents : []).filter(x => x.type === 't' && x !== e && norm(x.t.name || '') === norm(t.name || '') && x.lk.startsWith('ncaa') === e.lk.startsWith('ncaa') && x.lk !== e.lk);
    const list = [e, ...twin].sort((x, y) => (x.lk === 'ncaam' ? 0 : 1) - (y.lk === 'ncaam' ? 0 : 1));
    const blocks = await Promise.all(list.map(x => teamBlock(x, has, list.length > 1).catch(() => '')));
    const head = list.length > 1 ? `<div class="xschool">${crest(t, 48)}<span><b>${esc(t.name || t.short)}</b><em>Men's and women's basketball</em></span></div>` : '';
    return { html: `<div class="xans xteam">${head}${blocks.join('')}</div>`, kind: has(/ standing| rank| seed| record| place/) ? 'intent' : 'generic', shown: list, newsDone: true };
  }
  /* one team's block: the facts people look up, in order of how often they're asked for */
  async function teamBlock(e, has, twinned) {
    const L = L_(e.lk), t = e.t, lk = e.lk; const yr = HW.seasonYear ? HW.seasonYear() : new Date().getFullYear();
    const [st, info, prev, lg, inj, nw] = await Promise.all([HW.standings(L).catch(() => null), V.teamInfo(L, e.id).catch(() => null), HW.standings(L, yr - 1).catch(() => null), HW.hub.league(L).catch(() => null), HW.injuries(L).catch(() => null), HW.jSoft(`${HW.API(L)}/news?limit=50`, 600000).catch(() => null)]);
    const row = st && st.byId && st.byId[e.id], played = row && row.w + row.l > 0, pr = prev && prev.byId && prev.byId[e.id];
    const nm = t.name || t.short, are = /s$/i.test(nm) ? 'are' : 'is';
    const rankOf = g => g && (g.home.id === e.id ? g.home.rank : g.away.rank);
    const rank = rankOf(info && info.next) || rankOf(info && info.last) || null;
    // the one-line summary
    let line;
    if (played) line = `${rank ? `No. ${rank} ` : ''}${esc(nm)} ${are} <b>${row.w}-${row.l}</b>${row.pos && L.standingsMode !== 'conferences' ? `, ${ord(row.pos)} in the ${esc(_.confName(row.group, row.groupAbbr))}` : row.group ? `, ${esc(row.group)}` : ''}${row.strk && row.strk !== '-' ? ` · ${esc(row.strk)}` : ''}`;
    else line = `${rank ? `No. ${rank} in the preseason poll. ` : ''}The season hasn't started${pr && pr.w + pr.l > 0 ? `; last season ${esc(nm)} went <b>${pr.w}-${pr.l}</b>${pr.pos && L.standingsMode !== 'conferences' ? `, ${ord(pr.pos)} in the ${esc(_.confName(pr.group, pr.groupAbbr))}` : ''}` : ''}.`;
    // next and last
    const gline = (g, label) => { if (!g) return ''; const home = g.home.id === e.id, op = home ? g.away : g.home, done = g.state === 'post'; const us = home ? g.home : g.away;
      const res = done ? `<b class="${+us.score > +op.score ? 'w' : 'l'}">${+us.score > +op.score ? 'W' : 'L'} ${us.score}–${op.score}</b>` : `<b>${esc(HW.relDay ? HW.relDay(HW.ymdOf(g.date)) : '')}, ${esc(HW.tipOf ? HW.tipOf(g) : '')}</b>`;
      return `<a class="xgl" href="${_.href.game(lk, g.id)}"><span>${label}</span>${crest(op, 22)}<em>${home ? 'vs' : 'at'} ${op.rank ? `No. ${op.rank} ` : ''}${esc(op.short || op.name)}</em>${res}${_.chev}</a>`; };
    const games = (info ? gline(info.next, 'Next') + gline(info.last, 'Last') : '');
    // top scorers from the app's data file (this season, or last season's numbers before the first game)
    const ab = (t.abbr || '').toUpperCase(); const ps = lg && lg.players ? lg.players.filter(p => String(p.team || '').toUpperCase() === ab && p.s && p.s.pts != null).sort((x, y) => y.s.pts - x.s.pts).slice(0, 3) : [];
    const tops = ps.length ? `<div class="xtops"><span class="xk2">Top scorers${lg.lastSeason ? ' (last season)' : ''}</span>${ps.map(p => `<a class="xtp" href="${_.href.player(lk, p.id)}">${_.headshot(p.img, _.teamColor(t, L), 34, p.n)}<span><b>${esc(p.n)}</b><em>${esc(p.pos || '')}</em></span><i>${one(p.s.pts)}<small>PPG</small></i></a>`).join('')}</div>` : '';
    // injuries
    const il = inj && inj.byTeam && inj.byTeam[String(e.id)] && inj.byTeam[String(e.id)].list || [];
    const hurt = il.length ? `<div class="xhurt"><span class="xk2">Injuries</span>${il.slice(0, 4).map(x => { const a = x.athlete || {}; const det = x.details || {}; const st2 = _.statusWord(x.status) || x.status || ''; return `<span class="xhr"><b>${esc(a.displayName || '')}</b><em>${esc([det.type || det.detail, st2].filter(Boolean).join(' · '))}</em></span>`; }).join('')}${il.length > 4 ? `<span class="xhr dim">and ${il.length - 4} more</span>` : ''}</div>` : '';
    // headlines
    const keys = [norm(t.short), norm(t.name)].filter(Boolean); const items = (nw && nw.articles || []).filter(a => { const tx = norm((a.headline || '') + ' ' + (a.description || '')); return keys.some(k => k && tx.includes(k)); }).slice(0, 2);
    const newsH = items.length ? `<div class="xnewsb"><span class="xk2">Latest</span>${items.map(a => `<div class="xnews">${a.images && a.images[0] ? `<img src="${esc(a.images[0].url)}" alt="" loading="lazy">` : ''}<span><b>${esc(a.headline)}</b><em>${esc(HW.ago ? HW.ago(a.published) : '')}</em></span></div>`).join('')}</div>` : '';
    const sub = lk === 'ncaaw' ? "Women's basketball" : lk === 'ncaam' ? "Men's basketball" : LNAME(lk);
    // inside a school card the team's own line is a slim label; alone it carries the crest
    const headH = twinned ? `<a class="xtbh" href="${tHref(e)}"><b>${esc(sub)}</b><em>${esc(LNAME(lk))}</em>${_.chev}</a>` : `<a class="xwho" href="${tHref(e)}">${crest(t, 44)}<span><b>${esc(nm)}</b><em>${esc(sub)}${lk.startsWith('ncaa') ? ' · ' + esc(LNAME(lk)) : ''}</em></span>${_.chev}</a>`;
    return `<div class="xtb">${headH}<p class="xline">${line}</p>${games}${tops}${hurt}${newsH}<a class="xgo2" href="${tHref(e)}">Schedule, roster and stats ${_.chev}</a></div>`;
  }

  function recruitCard(e) {
    const r = e.r;
    return card(`<div class="xwho">${_.headshot(r.img || '', '#5B6B8C', 52, r.n)}<span><b>${esc(r.n)}</b><em>${esc([r.rank ? `No. ${r.rank}` : '', `Class of ${r.cls}`, r.pos, r.ht].filter(Boolean).join(' · '))}</em></span></div>`,
      r.commitTo ? `Committed to <b>${esc(r.commitTo)}</b>${r.commitSince ? ` since ${esc(r.commitSince)}` : ''}.` : `${esc(r.status || 'Uncommitted')}${r.top && r.top.length ? `. Top schools: ${esc(r.top.join(', '))}.` : '.'}`,
      [['National rank', r.rank], ['Position', [r.pos, r.posRank ? `No. ${r.posRank} at the position` : ''].filter(Boolean).join(', ')], ['High school', r.hs], ['Hometown', r.home], ['Size', [r.ht, r.wt ? r.wt + ' lbs' : ''].filter(Boolean).join(', ')]],
      '', 'PrepRanks') + `<a class="xgo2" href="${V.recruitHref ? V.recruitHref(r.g, r.cls, r) : '#search'}">Full profile ${_.chev}</a>`;
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
      + `<p class="xsrc">ESPN stats, through RIVL's data file</p></div>`;
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
    if (!r.rows.length) return `<div class="xans xweb"><span class="xk">Wikidata</span><p class="xline dim">No public record lists ${esc(topic.toLowerCase())} for ${esc(r.name)}. RIVL won't guess.</p></div>`;
    const g = {}; r.rows.forEach(x => { (g[x.p] = g[x.p] || []).push(x); });
    return `<div class="xans xweb"><span class="xk">Wikidata · ${esc(r.name)}</span>${Object.keys(g).map(P => `<div class="xfg"><span>${esc(PLBL[P] || P)}</span><div>${g[P].map(x => `<i>${esc(x.text)}${x.when ? ` <em>${esc(x.when)}</em>` : ''}</i>`).join('')}</div></div>`).join('')}<p class="xsrc">Wikidata, the open database behind Wikipedia (CC0)</p></div>`;
  }
  const splitWiki = text => { const out = []; let sec = ''; String(text).split('\n').forEach(l => { const m = l.match(/^=+\s*(.+?)\s*=+$/); if (m) { sec = m[1]; return; } if (l.trim().length > 40) out.push({ sec, p: l.trim() }); }); return out; };
  function bestPara(text, terms) {
    if (!text || !terms.length) return null;
    const paras = splitWiki(text), stems = terms.map(t => t.replace(/(s|es|ed|ing)$/, '')), personal = terms.some(t => PERSONAL.test(t)); let best = null;
    paras.forEach(x => { const low = x.p.toLowerCase(); let sc = 0;
      stems.forEach(st => { const m = low.match(new RegExp('\\b' + st.replace(/[^a-z0-9]/g, '') + '(s|es|ed|ing|d)?\\b', 'g')); if (m) sc += 2 + Math.min(m.length, 3); });
      if (personal && /personal life|family|early life/i.test(x.sec)) sc += 3; if (stems.some(st => x.sec.toLowerCase().includes(st))) sc += 3; if (!stems.some(st => new RegExp('\\b' + st.replace(/[^a-z0-9]/g, '') + '(s|es|ed|ing|d)?\\b').test(low))) sc /= 4;
      if (sc > 0 && (!best || sc > best.sc)) best = { sc, sec: x.sec, p: x.p }; });
    if (!best) return null;
    const sents = best.p.match(/[^.!?]+[.!?]+(\s|$)/g) || [best.p], keep = []; sents.forEach((s, i) => { if (stems.some(st => new RegExp('\\b' + st.replace(/[^a-z0-9]/g, '') + '(s|es|ed|ing|d)?\\b').test(s.toLowerCase()))) keep.push(i); });
    const idx = keep.length ? keep : [0], from = idx[0], to = Math.min(sents.length - 1, idx[idx.length - 1] + (idx.length === 1 ? 1 : 0));
    let html = esc(sents.slice(from, to + 1).join(' ').trim()); stems.forEach(st => { html = html.replace(new RegExp('(\\b' + st.replace(/[^a-z0-9]/g, '') + '(s|es|ed|ing|d)?\\b)', 'gi'), '<b>$1</b>'); });
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
  /* ---------- questions about a person's life: one topic per question, answered from the right part of the article ----------
     Each topic names the words that must appear in a sentence for it to count (whole words only, so "children" never
     matches "childlike fans"), the sections of the article it lives in, and the Wikidata fields that hold it exactly.
     The card shows those sentences, in the article's order, plus any named people with their ages. Nothing is written by
     the app; when the article doesn't say, the card says so. */
  const TOPICS = [
    { k: 'children', t: 'Children', re: /\b(kids?|children|child|sons?|daughters?|baby|babies)\b/, need: /\b(sons?|daughters?|children|child|kids?|baby|babies)\b/i, sec: /personal life|family/i, ps: ['P40', 'P1971'] },
    { k: 'spouse', t: 'Marriage', re: /\b(wife|husband|married|spouse|marry|wedding)\b/, need: /\b(married|marry|marriage|wife|husband|spouse|wed|wedding)\b/i, sec: /personal life/i, ps: ['P26'] },
    { k: 'partner', t: 'Relationship', re: /\b(dating|girlfriend|boyfriend|partner|engaged|fiance|fiancee|relationship)\b/, need: /\b(dating|dated|girlfriend|boyfriend|partner|engaged|engagement|fianc[eé]e?|relationship|married)\b/i, sec: /personal life/i, ps: ['P451', 'P26'] },
    { k: 'parents', t: 'Parents', re: /\b(parents?|father|dad|mother|mom)\b/, need: /\b(father|mother|parents?|dad|mom)\b/i, sec: /early life|personal life|family|background/i, ps: ['P22', 'P25'] },
    { k: 'siblings', t: 'Siblings', re: /\b(brothers?|sisters?|siblings?)\b/, need: /\b(brothers?|sisters?|siblings?)\b/i, sec: /early life|personal life|family/i, ps: ['P3373'] },
    { k: 'money', t: 'Contract', re: /\b(salary|contract|worth|paid|earn|earns|earnings|money|extension|max deal)\b/, need: /\b(contract|salary|extension|million|billion|net worth|signed|max)\b/i, sec: /contract|free agency|career|personal|business/i, ps: [] },
    { k: 'shoes', t: 'Shoes and sponsors', re: /\b(shoe|shoes|sneaker|sneakers|nike|adidas|puma|under armour|jordan brand|endorse\w*|sponsor\w*|brand)\b/, need: /\b(shoes?|sneakers?|nike|adidas|puma|under armour|jordan brand|endorse\w*|sponsor\w*|signature)\b/i, sec: /endorse|business|sponsor|represent|shoe/i, ps: [] },
    { k: 'faith', t: 'Faith', re: /\b(religion|religious|christian|faith|muslim|god|church)\b/, need: /\b(christian\w*|faith|religio\w*|muslim|islam|god|church|jesus)\b/i, sec: /personal/i, ps: [] },
    { k: 'awards', t: 'Awards', re: /\b(awards?|honou?rs|accolades|mvp|all ?star|championships?|rings?|titles?|trophies)\b/, need: /\b(mvp|most valuable|all-stars?|all-nba|champion\w*|awards?|titles?|finals|rookie of the year)\b/i, sec: /awards|honou?rs|accomplishments|achievements|career/i, ps: ['P166'] },
    { k: 'nickname', t: 'Nickname', re: /\b(nickname|nicknamed|called|known as)\b/, need: /\b(nicknamed?|known as|dubbed)\b/i, sec: /.*/, ps: ['P1449'] },
    { k: 'pets', t: 'Pets', re: /\b(dogs?|pets?|cats?|puppy)\b/, need: /\b(dogs?|pets?|cats?|puppy|puppies)\b/i, sec: /personal/i, ps: [] },
    { k: 'tattoo', t: 'Tattoos', re: /\b(tattoos?|ink)\b/, need: /\b(tattoos?|tattooed)\b/i, sec: /personal/i, ps: [] },
    { k: 'charity', t: 'Charity', re: /\b(charity|foundation|donat\w*|philanthrop\w*|gives back)\b/, need: /\b(charit\w*|foundation|donat\w*|philanthrop\w*)\b/i, sec: /philanthrop|personal|off the court|activism/i, ps: [] },
    { k: 'school', t: 'School', re: /\b(degree|graduated?|major|studied)\b/, need: /\b(degree|graduat\w*|major\w*|studied|university|college)\b/i, sec: /early life|college|personal/i, ps: [] }];
  const topicOf = q => { const n = ' ' + norm(q) + ' '; return TOPICS.find(t => t.re.test(n)) || null; };
  /* the person's own article: the exact name if it's a page about a basketball player, else a search for name + basketball */
  async function articleOf(name, lk) {
    const sport = lk === 'wnba' || lk === 'ncaaw' ? "women's basketball" : 'basketball';
    const d = await jget(WAPI + 'action=query&list=search&srlimit=6&srprop=snippet&srsearch=' + encodeURIComponent(`${name} ${sport}`), 864e5); const hits = d && d.query && d.query.search || [];
    const nn = norm(name); const pick = hits.find(h => norm(h.title) === nn) || hits.find(h => norm(h.title).startsWith(nn)) || hits.find(h => /basketball/i.test(h.snippet) && norm(h.title).includes(nn.split(' ').slice(-1)[0])) || null;
    if (!pick) return null;
    const x = await jget(WAPI + 'action=query&prop=extracts|pageprops&ppprop=wikibase_item&explaintext=1&exsectionformat=wiki&redirects=1&titles=' + encodeURIComponent(pick.title), 864e5);
    const pg = x && x.query && x.query.pages[Object.keys(x.query.pages)[0]]; if (!pg || !pg.extract) return null;
    return { title: pg.title, text: pg.extract, qid: pg.pageprops && pg.pageprops.wikibase_item };
  }
  /* sentences that answer the topic: must hold one of its words; ones in the topic's own section first; kept in order */
  function topicSentences(text, T, name) {
    const last = norm(name).split(' ').slice(-1)[0]; const out = [];
    splitWiki(text).forEach((x, pi) => { if (/^(see also|references|external links|notes|further reading|statistics)$/i.test(x.sec)) return;
      const sents = x.p.match(/[^.!?]+(?:[.!?]+["”)]?)(?:\s|$)/g) || [x.p];
      sents.forEach((s0, si) => { let s = s0.trim(); if (s.length < 25 || !T.need.test(s)) return; const inSec = T.sec.test(x.sec); let sc = 4; if (inSec) sc += 5; if (new RegExp('\\b(' + last + '|he|she|his|her)\\b', 'i').test(s)) sc += 1; if (/\b(19|20)\d\d\b/.test(s)) sc += 1;
        // "They have two daughters…" needs the sentence before it to say who "they" are
        if (/^(they|these|this|it|the couple)\b/i.test(s) && si > 0) s = sents[si - 1].trim() + ' ' + s;
        out.push({ sc, pi, si, sec: x.sec, s, inSec }); }); });
    // the topic's own section wins outright: a stray "his son" in a draft-night story never outranks Personal life
    const pool = out.some(x => x.inSec) ? out.filter(x => x.inSec) : out;
    return pool.sort((a, b) => b.sc - a.sc).slice(0, 4).sort((a, b) => a.pi - b.pi || a.si - b.si);
  }
  const hiNeed = (s, T) => esc(s).replace(new RegExp(T.need.source, 'gi'), m => `<b>${m}</b>`);
  async function wdPeople(qid, props) {
    if (!qid || !props.length) return [];
    const d = await jget(WD + 'action=wbgetentities&props=claims&ids=' + qid); const cl = d && d.entities && d.entities[qid] && d.entities[qid].claims || {}; const rows = [], ids = [];
    props.forEach(P => (cl[P] || []).forEach(c => { const dv = c.mainsnak && c.mainsnak.datavalue; if (!dv) return; if (dv.type === 'wikibase-entityid') { rows.push({ p: P, id: dv.value.id }); ids.push(dv.value.id); } else if (dv.type === 'quantity') rows.push({ p: P, text: String(+dv.value.amount) }); else if (dv.type === 'monolingualtext') rows.push({ p: P, text: dv.value.text }); }));
    if (ids.length) { const e = await jget(WD + 'action=wbgetentities&props=labels|claims&languages=en&ids=' + [...new Set(ids)].slice(0, 30).join('|'));
      rows.forEach(r => { if (!r.id) return; const en = e && e.entities && e.entities[r.id]; r.text = en && en.labels && en.labels.en ? en.labels.en.value : '';
        const b = en && en.claims && en.claims.P569 && en.claims.P569[0].mainsnak.datavalue; if (b) { const t = b.value.time; const y = +t.slice(1, 5), m = +t.slice(6, 8) || 1, dd = +t.slice(9, 11) || 1; const now = new Date(); let age = now.getFullYear() - y; if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < dd)) age--; r.born = y; r.age = age; } }); }
    return rows.filter(r => r.text);
  }
  /* "two daughters (born July 2012 and July 2015) and two sons (born July 2018 and May 2024)" → one chip per child with an age */
  const MONTHS = 'january february march april may june july august september october november december'.split(' ');
  function bornFrom(text) {
    const out = [], re = /\b(daughters?|sons?)\s*\(born ([^)]+)\)/gi; let m;
    while ((m = re.exec(text))) { const kind = /daughter/i.test(m[1]) ? 'Daughter' : 'Son';
      m[2].split(/,|\band\b/).map(x => x.trim()).filter(Boolean).forEach(d => { const y = (d.match(/\b(19|20)\d\d\b/) || [])[0]; if (!y) return; const mo = MONTHS.findIndex(n => d.toLowerCase().includes(n)); const now = new Date();
        let age = now.getFullYear() - +y; if (mo >= 0 && now.getMonth() < mo) age--; out.push({ id: 'k' + out.length, text: kind, age: Math.max(0, age), born: +y, bornText: d }); }); }
    return out;
  }
  async function topicCard(e, T) {
    const name = e.name, art = await articleOf(name, e.lk); if (!art) return `<div class="xans xweb"><span class="xk">${esc(T.t)}</span><p class="xline dim">No Wikipedia article was found for ${esc(name)}, so RIVL can't answer that one.</p></div>`;
    const [sents, ppl] = await Promise.all([Promise.resolve(topicSentences(art.text, T, name)), wdPeople(art.qid, T.ps).catch(() => [])]);
    const named = ppl.filter(r => r.id && r.p !== 'P1971'), count = ppl.find(r => r.p === 'P1971');
    if (T.k === 'children' && !named.length) bornFrom(sents.map(x => x.s).join(' ')).forEach(k => named.push(k));
    const chips = named.length ? `<div class="xppl">${named.map(r => `<span><b>${esc(r.text)}</b>${r.age != null ? `<em>${r.age} years old · born ${esc(String(r.bornText || r.born))}</em>` : ''}</span>`).join('')}</div>` : '';
    const list = sents.length ? `<ul class="xsents">${sents.map(x => `<li>${hiNeed(x.s, T)}</li>`).join('')}</ul>` : '';
    const sec = sents.length ? [...new Set(sents.map(x => x.sec).filter(Boolean))][0] : '';
    const body = list || chips ? chips + list : `<p class="xline dim">${esc(art.title)}'s Wikipedia article doesn't cover ${esc(T.t.toLowerCase())}${count ? `; Wikidata lists ${esc(count.text)} children` : ''}. RIVL won't guess.</p>`;
    const extra = !named.length && count && list ? `<p class="xsrc">Wikidata lists ${esc(count.text)}${T.k === 'children' ? ' children' : ''}; the article may be newer.</p>` : '';
    return `<div class="xans xweb xtopic"><span class="xk">${esc(T.t)} · ${esc(name)}</span>${body}${extra}<p class="xsrc">From Wikipedia, “${esc(art.title)}”${sec ? `, ${esc(sec)}` : ''} (CC BY-SA 4.0)</p></div>`;
  }
  async function news(f) {
    const e = f.ps[0] || f.ts[0]; if (!e) return ''; const L = L_(e.lk);
    const d = await HW.jSoft(`${HW.API(L)}/news?limit=50`, 600000).catch(() => null); const keys = e.type === 'p' ? [norm(e.name).split(' ').slice(-1)[0]] : [norm(e.t.short), norm(e.t.name)];
    const items = (d && d.articles || []).filter(a => { const t = norm((a.headline || '') + ' ' + (a.description || '')); return keys.some(k => k && t.includes(k)); }).slice(0, 3);
    if (!items.length) return '';
    return `<div class="xans xweb"><span class="xk">Latest from ESPN</span>${items.map(a => `<div class="xnews">${a.images && a.images[0] ? `<img src="${esc(a.images[0].url)}" alt="" loading="lazy">` : ''}<span><b>${esc(a.headline)}</b><em>${esc(HW.ago ? HW.ago(a.published) : '')}${a.description ? ' · ' + esc(a.description) : ''}</em></span></div>`).join('')}<p class="xsrc">ESPN headlines</p></div>`;
  }

  /* ---------- the screen ---------- */
  /* what people can ask, by kind, so nobody has to guess what the box understands */
  const TRY = [['Injuries', ['Who is hurt on the Celtics', 'Most severe injuries in the NBA', 'Who returns soonest', 'What does day to day mean']],
    ['Last night', ["Curry's shot chart last night", 'How many shots did Shai take', 'Thunder box score last night', 'Who scored the most last night']],
    ['What if', ['Lakers without LeBron tonight', 'What if Haliburton played'], ],
    ['Players and teams', ['Shai vs Luka', 'Wemby height', 'Thunder schedule', 'Who coaches the Knicks', 'UConn vs South Carolina']],
    ['Recruits', ['Top high school player', 'Where is AJ Dybantsa from', 'Flagg vs Acuff vs Harper']]];
  const FILTERS = [['all', 'All'], ['players', 'Players'], ['teams', 'Teams'], ['rookies', 'Rookies'], ['college', 'College'], ['recruits', 'Recruits']];
  let SEQ = 0;
  function rowOf(e) {
    if (e.type === 'p') return `<a class="xrow" href="${pHref(e)}">${face(e, 42)}<span><b>${esc(e.name)}</b><em>${esc([e.team ? e.team.short || e.team.name : e.p.teamName, e.p.rookie ? 'Rookie' : e.p.pos, LNAME(e.lk)].filter(Boolean).join(' · '))}</em></span>${_.chev}</a>`;
    if (e.type === 't') return `<a class="xrow" href="${tHref(e)}">${crest(e.t, 38)}<span><b>${esc(e.t.name || e.t.short)}</b><em>${esc(LNAME(e.lk))} · Team</em></span>${_.chev}</a>`;
    return `<a class="xrow" href="${V.recruitHref ? V.recruitHref(e.r.g, e.r.cls, e.r) : '#search'}">${_.headshot(e.r.img || "", "#5B6B8C", 42, e.name)}<span><b>${esc(e.name)}</b><em>${esc([e.r.rank ? `No. ${e.r.rank}` : '', `Class of ${e.r.cls}`, e.r.pos, e.r.commitTo ? 'Committed: ' + e.r.commitTo : e.r.status].filter(Boolean).join(' · '))}</em></span>${_.chev}</a>`;
  }
  async function run(q, filter) {
    const my = ++SEQ, res = document.getElementById('xres'), web = document.getElementById('xwebb'), br = document.getElementById('xbrowse'); if (!res) return;
    const nq = norm(q); if (br) br.hidden = !!nq; document.querySelector('.xclr') && (document.querySelector('.xclr').hidden = !q);
    if (!nq) { res.innerHTML = ''; if (web) web.innerHTML = ''; return; }
    const I = await index(); if (my !== SEQ) return;
    const sug = suggest(I.ents, q, filter);
    let A = { html: '', kind: 'none', f: findAll(I.ents, q) };
    if (filter === 'all') { res.innerHTML = sug.length ? `<div class="xlist">${sug.slice(0, 5).map(rowOf).join('')}</div>` : ''; const A2 = await answer(I, q).catch(() => null); if (A2) A = { f: A.f, ...A2 }; if (my !== SEQ) return; }
    const onlyName = A.f.hits.length === 1 && nq.split(' ').every(w => !STOP.has(w));
    // never list again what the answer already shows (the team itself, its men's or women's twin)
    const shownSet = new Set([...(A.shown || []), ...(A.html ? A.f.hits.map(h => h.e) : [])]);
    const rest = (onlyName || A.html ? sug.filter(e => !shownSet.has(e)) : sug);
    /* a corrected spelling is said out loud: the top row came from a typo match, not from the letters typed */
    const last = nq.split(' ').pop(); const top = sug[0]; const h0 = A.f.hits[0];
    const typed = e => e.al.some(a => a.startsWith(nq) || a === nq || a.split(' ').some(w => w.startsWith(last)));
    const fixed = h0 && A.f.hits.length === 1 && h0.score < 2 ? h0.e : (!A.f.hits.length && top && nq.split(' ').length <= 2 && !typed(top) ? top : null);
    const dym = fixed ? `<p class="xdym">Showing <b>${esc(fixed.name)}</b></p>` : '';
    res.innerHTML = dym + (A.html || '') + (rest.length && (filter !== 'all' || onlyName || !A.html) ? `${A.html ? '<p class="xmore">More matches</p>' : ''}<div class="xlist">${rest.map(rowOf).join('')}</div>` : '')
      || (A.kind === 'web' ? '' : noResults(I, q));
    XS.result(q, !!(res.querySelector('.xnone')));
    enrich(res);
    // past the app's own data: only when the question asks something the app's cards didn't answer
    if (!web) return; web.innerHTML = '';
    const isRecruit = A.f.rs.length && !A.f.ps.length && !A.f.ts.length;
    const W = webTerms(A.f, q); const asksMore = A.kind === 'web' || (A.kind === 'none' && nq.split(' ').length >= 2) || (A.kind === 'generic' && W.terms.length > 0);
    if (isRecruit || !asksMore || filter !== 'all' || A.newsDone) return;
    if (PERSONAL.test(nq) && A.f.ps.some(e => e.lk.startsWith('ncaa') && e.p.cls && /fr|freshman/i.test(e.p.cls))) { /* college players are adults; only high-school recruits are kept out */ }
    web.innerHTML = '<div class="xans xweb xload"><span class="xk">Looking it up</span><i></i><i></i><i></i></div>';
    const T = topicOf(q), pe = W.e && W.e.type === 'p' ? W.e : null;
    if (T && pe) { const parts = await Promise.all([topicCard(pe, T).catch(() => ''), news(A.f).catch(() => '')]); if (my !== SEQ) return;
      web.innerHTML = parts.join('') || `<div class="xans xweb"><span class="xk">Nothing found</span><p class="xline dim">No public source answers that yet.</p></div>`; return; }
    const want = wantFacts(q), title = pe ? pe.name : '';
    const parts = await Promise.all([want && title ? wdFacts(title, want.ps).then(r => r ? factCard(r, want.t) : '').catch(() => '') : '', wiki(q, W).catch(() => ''), news(A.f).catch(() => '')]);
    if (my !== SEQ) return;
    const html = parts.join('');
    web.innerHTML = html || (A.html ? '' : `<div class="xans xweb"><span class="xk">Nothing found</span><p class="xline dim">No public source answers that yet. Try different words, or a player or team name.</p></div>`);
  }

  /* nothing matched: the closest names at a wider typo distance, then questions that work, so the screen is never a dead end */
  function noResults(I, q) {
    const nq = norm(q), toks = nq.split(' ').filter(t => t.length >= 3 && !STOP.has(t) && !COMMON.has(t));
    const near = []; if (toks.length) for (const e of I.ents) { let d = 9; for (const a of e.al) for (const w of a.split(' ')) for (const t of toks) { if (Math.abs(w.length - t.length) <= 3) d = Math.min(d, lev(t, w)); } if (d <= (toks.length >= 3 ? 1 : 3)) near.push({ e, d, pop: (e.p && e.p.s && e.p.s.pts) || 0 }); }
    near.sort((a, b) => a.d - b.d || b.pop - a.pop); const rows = near.slice(0, 3).map(x => x.e);
    const chips = TRY.flatMap(([, qs]) => qs).slice(0, 6);
    return `<div class="xnone"><b>Nothing found for “${esc(q.trim())}”</b>${rows.length ? `<p>Did you mean</p><div class="xlist">${rows.map(rowOf).join('')}</div>` : '<p>Try a player, a team, a school, or a question.</p>'}<div class="xtry xtry2">${chips.map(t => `<button class="chip" data-xq="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
  }
  /* the rows carry their own facts: a team's game tonight or live score, a player's scoring and injury tag */
  async function enrich(res) {
    const rows = [...res.querySelectorAll('.xlist a.xrow[href^="#team/"], .xlist a.xrow[href^="#player/"]')].slice(0, 8); if (!rows.length) return;
    const my = SEQ, today = HW.todayCT(); const inj = {};
    await Promise.all(rows.map(async a => {
      const m = a.getAttribute('href').match(/^#(team|player)\/(\w+)\/([^/]+)/); if (!m) return; const [, kind, lk, id] = m; const L = LEAGUES[lk]; if (!L) return;
      let txt = '', cls = '';
      if (kind === 'team') { const day = await HW.scoreboard(L, today, 60000).catch(() => []); const g = (day || []).find(g => g.home.id === id || g.away.id === id); if (!g) return;
        const us = g.home.id === id ? g.home : g.away, them = us === g.home ? g.away : g.home;
        if (g.state === 'in') { txt = `${us.score}-${them.score} ${esc(String(g.detail || 'Live'))}`; cls = 'live'; } else if (g.state === 'post') txt = `${+us.score > +them.score ? 'W' : 'L'} ${us.score}-${them.score} ${us === g.home ? 'vs' : 'at'} ${esc(them.abbr || them.short)}`; else if (!g.off) txt = `${us === g.home ? 'vs' : 'at'} ${esc(them.abbr || them.short)} ${esc(new Date(g.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}`; }
      else { if (!L.hasInjuries) return; const d = inj[lk] || (inj[lk] = await HW.injuries(L).catch(() => null)); if (!d || !d.byTeam) return;
        let st = ''; Object.values(d.byTeam).some(t => (t.list || []).some(x => { if (String((x.athlete || {}).id || _.athId(x.athlete || {})) === id) { st = x.status || ''; return true; } })); if (!st || /active/i.test(st)) return;
        txt = _.statusWord(st) || st; cls = /out/i.test(st) ? 'tag out' : 'tag q'; }
      if (my !== SEQ || !txt || !document.body.contains(a)) return;
      let em = a.querySelector('.xrt'); if (!em) { em = document.createElement('em'); em.className = 'xrt'; a.insertBefore(em, a.lastElementChild); }
      em.className = 'xrt ' + cls; em.innerHTML = txt;
    }));
  }
  /* the empty screen on a game night: your teams playing today, as one-tap questions */
  async function tonightChips() {
    const box = document.getElementById('xtonight'); if (!box) return; const today = HW.todayCT(); const chips = [];
    for (const lk of ['nba', 'wnba', 'ncaam', 'ncaaw']) { const L = LEAGUES[lk]; if (!L) continue; const day = await HW.scoreboard(L, today, 120000).catch(() => []); if (!document.getElementById('xtonight')) return;
      (day || []).forEach(g => { ['home', 'away'].forEach(side => { const t = g[side]; if (!HW.favs.has(lk, t.id) || chips.some(c => c.id === t.id)) return; chips.push({ id: t.id, live: g.state === 'in', done: g.state === 'post', q: `${t.short || t.name} ${g.state === 'post' ? 'last game' : 'tonight'}`, label: `${t.short || t.name}${g.state === 'in' ? ' · live' : g.state === 'post' ? ' · final' : ''}` }); }); }); }
    if (!chips.length) { box.innerHTML = ''; return; }
    chips.sort((a, b) => (b.live - a.live) || (a.done - b.done));
    box.innerHTML = `<div class="sec"><h2>${chips.some(c => c.live) ? 'On now' : 'Your teams today'}</h2></div><div class="xtry">${chips.slice(0, 6).map(c => `<button class="chip${c.live ? ' xlive' : ''}" data-xq="${esc(c.q)}">${c.live ? '<i></i>' : ''}${esc(c.label)}</button>`).join('')}</div>`;
  }
  /* speak a search: the phone's own recognizer, when it has one (Chrome on Android; Safari partly) */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  function listen(inp, done) {
    if (!SR) return; const r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 1; const btn = document.querySelector('.xmic'); if (btn) btn.classList.add('on'); inp.placeholder = 'Listening…';
    const stop = () => { if (btn) btn.classList.remove('on'); inp.placeholder = 'Players, teams, schools, questions'; };
    r.onresult = ev => { const t = [...ev.results].map(x => x[0].transcript).join(' ').trim(); inp.value = t; if (ev.results[ev.results.length - 1].isFinal) { stop(); done(t); } };
    r.onerror = stop; r.onend = stop; try { r.start(); } catch { stop(); }
  }
  /* search stats, on this phone only: how often nothing is found, where taps land, how often a search is rewritten.
     Counts, never the words typed; nothing leaves the device. Long-press the Search title to read them. */
  const XS = (() => {
    const K = 'v5:xstats'; const get = () => store.get(K, null) || { searches: 0, zero: 0, taps: { 1: 0, 2: 0, 3: 0, more: 0, answer: 0 }, rewrites: 0, ttSum: 0, ttN: 0, since: HW.todayCT() };
    let cur = '', t0 = 0, lastAt = 0, tapped = false, counted = '';
    return {
      key(v) { if (!t0 && norm(v)) t0 = Date.now(); },
      result(q, zero) { const nq = norm(q); if (!nq || nq === counted) return; const S = get(); S.searches++; if (zero) S.zero++; if (counted && lastAt && Date.now() - lastAt < 30000 && !tapped) S.rewrites++; counted = nq; lastAt = Date.now(); tapped = false; store.set(K, S); cur = nq; },
      tap(el) { const S = get(); tapped = true; if (t0) { S.ttSum += Date.now() - t0; S.ttN++; t0 = 0; } const row = el.closest('.xlist a.xrow'); if (row) { const i = [...row.parentElement.children].indexOf(row) + 1; S.taps[i <= 3 ? i : 'more']++; } else S.taps.answer++; store.set(K, S); },
      text() { const S = get(); const tt = S.ttN ? (S.ttSum / S.ttN / 1000).toFixed(1) + 's' : '–'; const pc = n => S.searches ? Math.round(n / S.searches * 100) + '%' : '–'; const rt = S.taps[1] + S.taps[2] + S.taps[3] + S.taps.more;
        return `Search stats since ${S.since}\nSearches: ${S.searches}\nNothing found: ${S.zero} (${pc(S.zero)})\nRewritten within 30s: ${S.rewrites} (${pc(S.rewrites)})\nTaps on row 1 / 2 / 3 / lower: ${S.taps[1]} / ${S.taps[2]} / ${S.taps[3]} / ${S.taps.more}${rt ? ` (row 1 = ${Math.round(S.taps[1] / rt * 100)}% of row taps)` : ''}\nTaps on an answer card: ${S.taps.answer}\nFirst key to first tap: ${tt}`; },
      reset() { store.set(K, null); }
    };
  })();
  async function searchV() {
    const $main = document.getElementById('main');
    const q0 = store.get('v5:xq', '') || '', f0 = 'all';
    const recent = (store.get('v5:xrecent', []) || []).slice(0, 6);
    $main.innerHTML = `<div class="xpage"><h1 class="xtitle">Search</h1>
      <label class="xbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="xq" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Players, teams, schools, questions" value="${esc(q0)}" aria-label="Search">${SR ? `<button class="xmic" data-act="xmic" aria-label="Speak your search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}<button class="xclr" data-act="xclear" aria-label="Clear"${q0 ? '' : ' hidden'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></label>
      <div id="xres"></div><div id="xwebb"></div>
      <div id="xbrowse"${q0 ? ' hidden' : ''}>${recent.length ? `<div class="sec"><h2>Recent</h2><button data-act="xrclear">Clear</button></div><div class="xlist">${recent.map(r => `<div class="xrow xrq"><button class="xrqb" data-xq="${esc(r)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg><span><b>${esc(r)}</b></span></button><button class="xrdel" data-act="xrdel" data-q="${esc(r)}" aria-label="Remove ${esc(r)} from recent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`).join('')}</div>` : ''}
        <div id="xtonight"></div>
        <div class="sec"><h2>Try asking</h2></div>${TRY.map(([h, qs]) => `<div class="xtryg"><p class="xtryh">${esc(h)}</p><div class="xtry">${qs.map(t => `<button class="chip" data-xq="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`).join('')}
        <p class="xfoot">Answers come from RIVL's own data first, then Wikidata, Wikipedia and ESPN. Every card names its source, and when no source has the answer it says so.</p></div></div>`;
    const inp = $main.querySelector('#xq'); let t = null, filter = f0;
    const go = v => { store.set('v5:xq', v); clearTimeout(t); t = setTimeout(() => run(v, filter), 140); };
    const remember = v => { v = String(v || '').trim(); if (v.length < 2) return; const a = (store.get('v5:xrecent', []) || []).filter(x => x.toLowerCase() !== v.toLowerCase()); a.unshift(v); store.set('v5:xrecent', a.slice(0, 8)); };
    /* the five name rows come with the keystroke itself when the index is ready; only the answer and the web wait for the pause */
    inp.addEventListener('input', () => { const v = inp.value; if (IDX && norm(v)) { const res = document.getElementById('xres'), br = document.getElementById('xbrowse'); if (br) br.hidden = true; const sug = suggest(IDX.ents, v, filter).slice(0, 5); if (res && sug.length) res.innerHTML = `<div class="xlist">${sug.map(rowOf).join('')}</div>`; } XS.key(v); go(v); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { remember(inp.value); inp.blur(); } });
    if (!q0 && !searchV.noFocus) { try { inp.focus({ preventScroll: true }); } catch { } }   // the Search tab opens ready to type
    searchV.noFocus = false;
    tonightChips();
    if ($main._xClick) $main.removeEventListener('click', $main._xClick);
    $main.addEventListener('click', $main._xClick = e => {
      if (!document.getElementById('xq')) return;
      const qb = e.target.closest('[data-xq]'); if (qb) { e.preventDefault(); inp.value = qb.dataset.xq; remember(inp.value); go(inp.value); return; }
      const fb = e.target.closest('[data-xf]'); if (fb) { filter = fb.dataset.xf; store.set('v5:xf', filter); $main.querySelectorAll('[data-xf]').forEach(b => { const on = b === fb; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); run(inp.value, filter); return; }
      if (e.target.closest('[data-act="xclear"]')) { e.preventDefault(); inp.value = ''; store.set('v5:xq', ''); run('', filter); inp.focus(); return; }
      if (e.target.closest('[data-act="xrclear"]')) { e.preventDefault(); store.set('v5:xrecent', []); searchV.noFocus = true; searchV(); return; }
      const rd = e.target.closest('[data-act="xrdel"]'); if (rd) { e.preventDefault(); store.set('v5:xrecent', (store.get('v5:xrecent', []) || []).filter(x => x !== rd.dataset.q)); rd.closest('.xrq').remove(); if (!$main.querySelector('.xrq')) { const sec = $main.querySelector('#xbrowse .sec'); if (sec && /Recent/.test(sec.textContent)) sec.remove(); } return; }
      if (e.target.closest('[data-act="xmic"]')) { e.preventDefault(); listen(inp, v => { inp.value = v; remember(v); go(v); }); return; }
      const hit = e.target.closest('a.xrow, a.xans, a.xwho, a.xgo, a.xinj, a.xtp, .xans a'); if (hit && inp.value) { remember(inp.value); XS.tap(hit); }
    });
    { const h1 = $main.querySelector('.xtitle'); let pt = 0; const show = () => { let c = $main.querySelector('.xstats'); if (c) { c.remove(); return; } c = document.createElement('div'); c.className = 'xans xstats'; c.innerHTML = `<span class="xk">Search stats · this phone only</span><pre>${esc(XS.text())}</pre><div class="xsorts"><button class="chip" data-act="xscopy">Copy</button><button class="chip" data-act="xsreset">Reset</button></div>`; h1.after(c); };
      h1.addEventListener('pointerdown', () => { pt = setTimeout(show, 650); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => h1.addEventListener(ev, () => clearTimeout(pt)));
      $main.addEventListener('click', e => { if (e.target.closest('[data-act="xscopy"]')) { try { navigator.clipboard.writeText(XS.text()); } catch { } V.toast && V.toast("Copied"); } if (e.target.closest('[data-act="xsreset"]')) { XS.reset(); const c = $main.querySelector('.xstats pre'); if (c) c.textContent = XS.text(); } }); }
    if (q0) run(q0, filter); else index().then(() => { if (IDX && inp.value && document.body.contains(inp)) run(inp.value, filter); });   // build the index while the person starts typing
    document.title = 'Search · RIVL';
  }

  HW.ask = { index, findAll, suggest, answer, norm, lev, cmpPlayers };
  V.search = searchV;
  V._ask = { norm, card, twho, who, crest, face, page, pHref, tHref, LNAME, L_, one, ord, statsOf, NOPE, rowOf, lev };
})();
