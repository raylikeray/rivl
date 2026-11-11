// Builds data/night.json: what the box scores say about each night, in every league.
//   Streaks and firsts: 30 or more in N straight games, a season high, a triple-double and how many that makes, a
//   double-double streak, a team's run of wins or losses. Each is a plain sentence counted from the games themselves.
//   Nightly honors: Player of the Night and Rookie of the Night by game score, Thriller of the Night by how close it finished and how often the
//   lead and the win chance changed hands. The app adds Play of the Night (from the clip file) and Upset of the Night (from
//   RIVL's own record of its projections), which this job has no part in.
// Thriller of the Night needs a finish within five points or overtime; a night without one names none.
// Nothing is carried in from anywhere but the feed's scoreboards and box scores. A career high or a career total is
// not claimed, because the job only knows this season: it has read every game since opening night, kept in
// data/night-state.json (the job's own notebook; the app never loads it).
// Game score is John Hollinger's public formula:
//   PTS + 0.4 FGM - 0.7 FGA - 0.4 (FTA - FTM) + 0.7 OREB + 0.3 DREB + STL + 0.7 AST + 0.7 BLK - 0.4 PF - TO
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball';
const LG = { nba: 'nba', wnba: 'wnba', ncaam: 'mens-college-basketball', ncaaw: 'womens-college-basketball' };
const now = Date.now();
const FIRST = !existsSync('data/night-state.json');
const BACK = FIRST ? 30 : Math.max(2, Math.min(10, +process.env.BACKFILL || 2));   // days of games to read. The first run reads back 30 days, in order, so runs of games are counted from opening night
const KEEP_DAYS = 4;                                                  // nights kept in the app's file
const get = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (r.ok) return r.json(); if (r.status === 404) return null; } catch (e) {} await new Promise(r => setTimeout(r, 900 * (i + 1))); } return null; };
const readJ = (p, d) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d; } catch (e) { return d; } };
const state = readJ('data/night-state.json', { v: 1, lg: {} });
const leaders = readJ('data/leaders.json', { leagues: {} });
const ET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayOf = t => ET.format(new Date(t));                             // a game belongs to the night it tipped off, Eastern time
const ymd = n => new Date(now - n * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
const today = dayOf(now), cutoff = dayOf(now - KEEP_DAYS * 864e5);
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const pair = v => { const m = /^(\d+)-(\d+)$/.exec(String(v || '')); return m ? [+m[1], +m[2]] : [0, 0]; };
const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
// what counts as a hot night, and how long a run has to be before it is worth a line
const RULES = { nba: { hot: 30, hotRun: 3, high: 30, big: 40 }, wnba: { hot: 20, hotRun: 4, high: 25, big: 35 }, ncaam: { hot: 20, hotRun: 5, high: 28, big: 35 }, ncaaw: { hot: 20, hotRun: 5, high: 28, big: 35 } };
// a player's season in the notebook: games, highs, runs in progress, triple-doubles
const P0 = () => ({ g: 0, hp: 0, hr: 0, ha: 0, sh: 0, sd: 0, td: 0 });
// The notebook is kept small, because every run that changes it is a commit. A player is a short list of numbers. A
// college player is only written down once he has scored 15 or had a double-double: a season high has to be 28 or more
// to be said at all, so nothing a forgotten player did earlier could have been his high. Game ids are kept for 12 days,
// and after the first fill a run never reads further back than 10, so no game is counted twice.
const PK = ['g', 'hp', 'hr', 'ha', 'sh', 'sd', 'td'];
const unpack = o => { const m = {}; Object.entries(o || {}).forEach(([id, v]) => { m[id] = Array.isArray(v) ? Object.fromEntries(PK.map((k, i) => [k, v[i] || 0])) : v; }); return m; };
const pack = (m, pro) => { const o = {}; Object.entries(m).forEach(([id, p]) => { if (pro || p.hp >= 15 || p.sd > 0 || p.td > 0) o[id] = PK.map(k => p[k] || 0); }); return o; };

const out = { updated: new Date(now).toISOString(), lg: {} };
const was = readJ('data/night.json', null);
let asked = 0, read = 0;
for (const [lk, path] of Object.entries(LG)) {
  const R = RULES[lk], pro = lk === 'nba' || lk === 'wnba';
  const S = state.lg[lk] = state.lg[lk] || { done: {}, p: {}, t: {}, days: {}, award: {}, tally: {}, last: 0 };
  // a new season starts the notebook over: nothing read for four months means the last one is finished
  if (S.last && now - S.last > 120 * 864e5) Object.assign(S, { done: {}, p: {}, t: {}, days: {}, award: {}, tally: {} });
  S.p = unpack(S.p);
  const rookies = new Set((((leaders.leagues || {})[lk] || {}).players || []).filter(p => p.rookie).map(p => String(p.id)));
  const evs = new Map(), open = new Set();                             // open: nights with a game still to finish
  for (let n = BACK; n >= 0; n--) { const d = await get(`${SITE}/${path}/scoreboard?dates=${ymd(n)}${pro ? '' : '&groups=50&limit=400'}`);
    ((d || {}).events || []).forEach(e => { const st = ((e.status || {}).type || {}), t = Date.parse(e.date) || now, day = dayOf(t);
      if (/postponed|canceled|cancelled|forfeit/i.test(String(st.name || '') + ' ' + String(st.description || ''))) return;
      if (!st.completed) { open.add(day); return; }
      evs.set(String(e.id), { id: String(e.id), t, day }); }); }
  const todo = [...evs.values()].filter(e => !S.done[e.id]).sort((a, b) => a.t - b.t);
  const past = {};                                                      // older nights read on this run (a first fill): only their best line is needed, for the season's count
  for (let i = 0; i < todo.length; i += 8) {
    const got = await Promise.all(todo.slice(i, i + 8).map(async e => { asked++; return [e, await get(`${SITE}/${path}/summary?event=${e.id}`)]; }));
    for (const [e, s] of got) {                                         // in tip-off order, so a run of games counts the right way
      const comp = (((s || {}).header || {}).competitions || [])[0], cs = (comp && comp.competitors) || [], box = ((s || {}).boxscore || {}).players || [];
      const H = cs.find(c => c.homeAway === 'home'), A = cs.find(c => c.homeAway === 'away');
      if (!s || !H || !A || !box.length) continue;                      // not ready yet: asked again next run
      read++; S.done[e.id] = e.t; S.last = Math.max(S.last || 0, e.t);
      const side = c => ({ id: String(c.team.id), ab: c.team.abbreviation || '', nm: pro ? (c.team.name || c.team.shortDisplayName || '') : (c.team.shortDisplayName || c.team.location || c.team.name || ''), sc: num(c.score) });
      const h = side(H), a = side(A), fresh = e.day >= cutoff;
      const D = fresh ? (S.days[e.day] = S.days[e.day] || { lines: [], games: [], notes: [] }) : null;
      const note = (k, t, v, x) => { if (D) D.notes.push(Object.assign({ k, t, v: Math.round(v), e: e.id, at: e.t }, x)); };
      // ---- the game: how many times the lead changed, how far the win chance travelled, overtime, the margin
      let lc = 0, lead = 0; ((s.plays || [])).forEach(q => { if (q.homeScore == null || q.awayScore == null) return; const sg = Math.sign(q.homeScore - q.awayScore); if (sg && lead && sg !== lead) lc++; if (sg) lead = sg; });
      const wp = (s.winprobability || []).map(x => x.homeWinPercentage).filter(x => x != null); let ex = 0; for (let k = 1; k < wp.length; k++) ex += Math.abs(wp[k] - wp[k - 1]);
      const periods = Math.max(((H.linescores || []).length), ((A.linescores || []).length)), ot = Math.max(0, periods - (lk === 'ncaam' ? 2 : 4)), mg = Math.abs(h.sc - a.sc);
      if (D) D.games.push({ e: e.id, h, a, lc, ot, mg, ex: +ex.toFixed(2), x: +(ot * 8 + (6 - Math.min(mg, 6)) * 2 + Math.min(lc, 20) * .5 + ex * 2).toFixed(1) });
      // ---- each team's run of wins or losses
      [[h, a], [a, h]].forEach(([us, them]) => { const won = us.sc > them.sc, was = S.t[us.id] || 0, run = won ? (was > 0 ? was + 1 : 1) : (was < 0 ? was - 1 : -1); S.t[us.id] = run;
        const name = pro ? `The ${us.nm} have` : `${us.nm} has`;
        if (run >= 5) note('win', `${name} won ${run} in a row.`, 30 + run * 3, { tid: us.id }); else if (run <= -6) note('loss', `${name} lost ${-run} in a row.`, 20 - run * 2, { tid: us.id }); });
      // ---- each player's line, and each side's totals added up from them (for The Daily's Blind pick: shooting and counting numbers with no names)
      const tot = { [h.id]: new Array(11).fill(0), [a.id]: new Array(11).fill(0) };
      box.forEach(sd => { const tid = String((sd.team || {}).id || ''), st = (sd.statistics || [])[0]; if (!st) return; const lb = st.labels || st.names || [], ix = l => lb.indexOf(l);
        (st.athletes || []).forEach(at => { const A2 = at.athlete || {}, id = String(A2.id || ''); if (!id || at.didNotPlay || !(at.stats || []).length) return; const g = l => { const k = ix(l); return k >= 0 ? at.stats[k] : ''; };
          const min = num(g('MIN')); if (!(min > 0)) return;
          const pts = num(g('PTS')), reb = num(g('REB')), ast = num(g('AST')), stl = num(g('STL')), blk = num(g('BLK')), to = num(g('TO')), pf = num(g('PF')), oreb = num(g('OREB')), dreb = ix('DREB') >= 0 ? num(g('DREB')) : Math.max(0, reb - oreb);
          const [fgm, fga] = pair(g('FG')), [tpm, tpa] = pair(g('3PT')), [ftm, fta] = pair(g('FT'));
          if (tot[tid]) [fgm, fga, tpm, tpa, ftm, fta, reb, ast, stl, blk, to].forEach((v, k) => { tot[tid][k] += v; });
          const gs = +(pts + .4 * fgm - .7 * fga - .4 * (fta - ftm) + .7 * oreb + .3 * dreb + stl + .7 * ast + .7 * blk - .4 * pf - to).toFixed(1);
          const name = A2.displayName || A2.shortName || ''; if (!name) return;
          const p = S.p[id] = S.p[id] || P0(), tens = [pts, reb, ast, stl, blk].filter(v => v >= 10).length, who = { p: id, tid };
          const wasHigh = p.hp; p.g++; p.sh = pts >= R.hot ? p.sh + 1 : 0; p.sd = tens >= 2 ? p.sd + 1 : 0; if (tens >= 3) p.td++;
          let said = false;
          if (tens >= 3) { const parts = [[pts, 'points'], [reb, 'rebounds'], [ast, 'assists'], [stl, 'steals'], [blk, 'blocks']].filter(v => v[0] >= 10).map(v => `${v[0]} ${v[1]}`);
            note('td', `${name} had a triple-double: ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}. ${p.td === 1 ? 'The first of the season.' : `That makes ${p.td} this season.`}`, 70 + p.td, who); said = true; }
          if (p.sh >= R.hotRun) { note('hot', `${name} has scored ${R.hot} or more in ${p.sh} straight games.`, 50 + p.sh * 5, who); said = true; }
          if (pts > wasHigh && p.g >= 5 && pts >= R.high) { note('high', `${name} scored a season-high ${pts}.`, 20 + pts, who); said = true; }
          else if (pts >= R.big && !said) note('big', `${name} scored ${pts}.`, 15 + pts, who);
          if (pts >= 20 && reb >= 20) note('2020', `${name} had ${pts} points and ${reb} rebounds.`, 40 + reb, who);
          if (p.sd >= 6 && p.sd % 2 === 0) note('dd', `${name} has a double-double in ${p.sd} straight games.`, 30 + p.sd * 2, who);
          p.hp = Math.max(p.hp, pts); p.hr = Math.max(p.hr, reb); p.ha = Math.max(p.ha, ast);
          if (!D && (!past[e.day] || gs > past[e.day].gs)) past[e.day] = { id, n: name, tm: tid === h.id ? h.ab : a.ab, gs };
          const us = tid === h.id ? h : a, them = tid === h.id ? a : h;
          if (D) D.lines.push({ id, n: name, tid, tm: us.ab, e: e.id, gs, pts, reb, ast, stl, blk, tpm, min: Math.round(min), pos: (A2.position && A2.position.abbreviation) || '', op: them.ab, w: us.sc > them.sc ? 1 : 0, sc: `${us.sc}-${them.sc}`, hs: (A2.headshot && A2.headshot.href) || '', rk: rookies.has(id) ? 1 : 0 }); }); });
      if (D) { const G = D.games[D.games.length - 1]; if (G && G.e === e.id && tot[h.id][1] > 0 && tot[a.id][1] > 0) { G.bh = tot[h.id]; G.ba = tot[a.id]; } }
    }
  }
  const award = (d, l) => { if (S.award[d]) return; S.award[d] = l.id; const t = S.tally[l.id] = S.tally[l.id] || { n: l.n, tm: l.tm, c: 0 }; t.c++; t.n = l.n; t.tm = l.tm; };
  Object.keys(past).sort().forEach(d => { if (!open.has(d) && d < today) award(d, past[d]); });
  // ---- each night in hand: keep its best lines, name its honors once every game of that night is final
  Object.keys(S.days).forEach(d => { if (d < cutoff) delete S.days[d]; });
  const days = Object.keys(S.days).sort().reverse().map(d => { const D = S.days[d];
    D.lines.sort((x, y) => y.gs - x.gs); const rook = D.lines.filter(l => l.rk).slice(0, 3); D.lines = [...D.lines.slice(0, 12), ...rook.filter(r => !D.lines.slice(0, 12).includes(r))];
    D.notes.sort((x, y) => y.v - x.v); D.notes = D.notes.slice(0, 40);
    const done = !open.has(d) && d < today && D.games.length > 0, pon = D.lines[0] || null, ron = D.lines.find(l => l.rk) || null, gon = [...D.games].filter(g => g.ot || g.mg <= 5).sort((x, y) => y.x - x.x)[0] || null;   // no close finish, no thriller
    if (done && pon) award(d, pon);
    const bp = done ? [...D.games].filter(g => g.bh && g.ba).sort((x, y) => y.x - x.x).slice(0, 8).map(({ e, h, a, bh, ba }) => ({ e, h, a, bh, ba })) : [];   // eight games' team totals: fgm, fga, 3pm, 3pa, ftm, fta, reb, ast, stl, blk, to
    return { d, done, games: D.games.map(g => g.e), bp, pon: done ? pon : null, ron: done && ron && (!pon || ron.id !== pon.id) ? ron : null, gon: done ? gon : null, top: done ? D.lines.slice(0, 5) : [], notes: D.notes.slice(0, pro ? 14 : 24).map(({ k, t, v, e, at, p, tid }) => ({ k, t, v, e, at, p, tid })) }; });
  Object.keys(S.award).forEach(d => { if (d < dayOf(now - 300 * 864e5)) delete S.award[d]; });
  Object.keys(S.done).forEach(id => { if (now - S.done[id] > 12 * 864e5) delete S.done[id]; });
  S.p = pack(S.p, pro);
  const tally = Object.entries(S.tally).map(([id, t]) => ({ id, n: t.n, tm: t.tm, c: t.c })).sort((x, y) => y.c - x.c || x.n.localeCompare(y.n)).slice(0, 8);
  out.lg[lk] = { days, tally };
  console.log(lk, 'games in window', evs.size, 'new', todo.length, 'players', Object.keys(S.p).length, 'nights', days.map(d => `${d.d}${d.done ? '' : '*'}:${d.notes.length}`).join(' '));
}
writeFileSync('data/night-state.json', JSON.stringify(state));
// the app's file is only written when what it says has changed, so a quiet afternoon is not a commit
if (!was || JSON.stringify(was.lg) !== JSON.stringify(out.lg)) writeFileSync('data/night.json', JSON.stringify(out));
console.log('night asked', asked, 'read', read, 'bytes', JSON.stringify(out).length, 'notebook', JSON.stringify(state).length);
Object.entries(out.lg).forEach(([lk, L]) => { const d = L.days.find(x => x.done); if (d) console.log(' ', lk, d.d, 'player', d.pon && `${d.pon.n} ${d.pon.gs}`, '| rookie', d.ron && d.ron.n, '| game', d.gon && `${d.gon.a.ab} ${d.gon.a.sc} ${d.gon.h.ab} ${d.gon.h.sc} lc${d.gon.lc}`, '|', d.notes.slice(0, 3).map(n => n.t).join(' ')); });
