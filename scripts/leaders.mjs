// Builds data/leaders.json for RIVL from ESPN's public stats feed.
// NBA: current season, every player, rookies tagged from the 2026 draft, award watch.
// WNBA: the season just played. College men and women: last season's stats,
// keeping only players who are on a roster this season (graduates drop out).
// When a league's new season has games, it switches to the new season by itself.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function J(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': 'RIVL personal app' } }); if (r.ok) return r.json(); if (r.status === 404) return null; } catch (e) {}
    await sleep(800 * (i + 1));
  }
  return null;
}
const SLUG = { nba: 'nba', wnba: 'wnba', ncaam: 'mens-college-basketball', ncaaw: 'womens-college-basketball' };
const BY = (L, season, sort, page, limit, qual) => `https://site.web.api.espn.com/apis/common/v3/sports/basketball/${SLUG[L]}/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=${qual}&page=${page}&limit=${limit}&sort=${sort}:desc&season=${season}&seasontype=2`;

function flatten(j) {
  const defs = {}; (j.categories || []).forEach(c => { defs[c.name] = c.names; });
  return (j.athletes || []).map(a => {
    const s = {}; (a.categories || []).forEach(c => { const names = defs[c.name] || []; (c.values || []).forEach((v, i) => { if (names[i] && s[names[i]] == null) s[names[i]] = v; }); });
    const at = a.athlete;
    return { id: at.id, n: at.displayName, sn: at.shortName, pos: at.position?.abbreviation, team: at.teamShortName || at.teams?.[0]?.abbreviation, teamId: at.teamId, teamName: at.teamName,
      age: at.age, img: at.headshot?.href || null, s: {
        gp: s.gamesPlayed, min: s.avgMinutes, pts: s.avgPoints, reb: s.avgRebounds, ast: s.avgAssists, stl: s.avgSteals, blk: s.avgBlocks, to: s.avgTurnovers,
        fgm: s.avgFieldGoalsMade, fga: s.avgFieldGoalsAttempted, fg: s.fieldGoalPct, tpm: s.avgThreePointFieldGoalsMade, tpa: s.avgThreePointFieldGoalsAttempted, tp: s.threePointFieldGoalPct,
        ftm: s.avgFreeThrowsMade, fta: s.avgFreeThrowsAttempted, ft: s.freeThrowPct, pf: s.avgFouls, dd: s.doubleDouble, td: s.tripleDouble,
        oreb: s.avgOffensiveRebounds, dreb: s.avgDefensiveRebounds, gs: s.gamesStarted } };
  });
}
async function pull(L, season, sorts, perSort, qual) {
  const map = new Map(); let meta = null;
  for (const sort of sorts) {
    for (let page = 1; page <= Math.ceil(perSort / 100); page++) {
      const j = await J(BY(L, season, sort, page, 100, qual)); if (!j) break;
      meta = meta || { season: j.requestedSeason?.displayName, year: j.requestedSeason?.year, total: j.pagination?.count };
      flatten(j).forEach(p => { if (!map.has(p.id)) map.set(p.id, p); });
      if (page >= (j.pagination?.pages || 1)) break;
      await sleep(250);
    }
  }
  return { meta, players: [...map.values()] };
}
const SORTS = ['offensive.avgPoints', 'general.avgRebounds', 'offensive.avgAssists', 'defensive.avgSteals', 'defensive.avgBlocks', 'offensive.avgThreePointFieldGoalsMade', 'offensive.fieldGoalPct', 'offensive.threePointFieldGoalPct', 'offensive.freeThrowPct', 'general.avgMinutes'];
const now = new Date(), Y = now.getUTCFullYear();
const out = { updated: now.toISOString(), source: 'ESPN', leagues: {} };

// a league is "in season" for year X when the X feed has games played
async function pickSeason(L, cand) { for (const y of cand) { const j = await J(BY(L, y, 'offensive.avgPoints', 1, 5, false)); const p = j && flatten(j); if (p && p.length && p[0].s.gp > 0) return y; } return cand[cand.length - 1]; }

// ---------- NBA ----------
{
  const season = await pickSeason('nba', [Y + 1, Y]);
  const all = await pull('nba', season, ['offensive.avgPoints'], 600, false);
  const prev = await pull('nba', season - 1, ['offensive.avgPoints'], 600, false);
  // rookies: the draft class that came into this season
  const draft = await J(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${season - 1}/draft/rounds?lang=en&region=us`);
  const picks = []; for (const rd of draft?.items || []) for (const pk of rd.picks || []) picks.push(pk);
  const rook = new Map();
  for (const pk of picks) { const a = pk.athlete?.$ref ? await J(pk.athlete.$ref.replace('http:', 'https:')) : null; if (a) rook.set(a.displayName, { pick: pk.overall, round: pk.round }); await sleep(120); }
  const prevPts = new Map(prev.players.map(p => [p.id, p.s]));
  all.players.forEach(p => { const r = rook.get(p.n); if (r) { p.rookie = true; p.pick = r.pick; } const ps = prevPts.get(p.id); if (ps) p.prev = { ...ps }; });
  // team records for the award index
  const st = await J('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');
  const win = {}; (function walk(o) { if (!o || typeof o !== 'object') return; if (o.team && o.stats) { const w = o.stats.find(x => x.name === 'winPercent'); if (w) win[o.team.abbreviation] = w.value; } Object.values(o).forEach(walk); })(st);
  out.leagues.nba = { label: all.meta?.season, year: season, final: false, players: all.players, win, rookieCount: rook.size };
}
// ---------- WNBA ----------
{
  const season = await pickSeason('wnba', [Y + 1, Y]);
  const all = await pull('wnba', season, SORTS, 200, false);
  const prevW = await pull('wnba', season - 1, ['offensive.avgPoints'], 300, false); const pw = new Map(prevW.players.map(p => [p.id, p.s]));
  all.players.forEach(p => { const ps = pw.get(p.id); if (ps) p.prev = { ...ps }; });
  out.leagues.wnba = { label: String(season), year: season, final: season === Y && now.getUTCMonth() >= 9, players: all.players };
}
// ---------- College: last season, current rosters only ----------
for (const L of ['ncaam', 'ncaaw']) {
  const cur = await pickSeason(L, [Y + 1]);
  /* the new season counts as live only when it really has its own games: ESPN answers a not-yet-started season with last
     season's numbers, so the two are compared, and a top line that matches last season player for player is last season */
  const top = async y => { const j = await J(BY(L, y, 'offensive.avgPoints', 1, 10, false)); return j ? flatten(j).map(p => `${p.id}:${p.s.gp}:${p.s.pts}`) : []; };
  const [tNew, tOld] = await Promise.all([top(Y + 1), top(Y)]);
  const live = tNew.length > 0 && tNew.filter(x => tOld.includes(x)).length < 3;
  console.log(L, 'new season live?', live, tNew.slice(0, 3), tOld.slice(0, 3));
  if (live) {
    /* the first week of a season, ESPN's "qualified" list can be empty (men's had 0 the morning after opening night), so
       when it is thin the whole list is read instead; the app applies its own games and minutes bars */
    let all = await pull(L, Y + 1, SORTS, 300, true);
    if (all.players.length < 150) { const loose = await pull(L, Y + 1, SORTS, 300, false); console.log(L, 'qualified', all.players.length, 'all', loose.players.length); if (loose.players.length > all.players.length) all = loose; }
    if (all.players.length) { out.leagues[L] = { label: `${Y}-${String(Y + 1).slice(2)}`, year: Y + 1, final: false, players: all.players }; continue; }
    console.log(L, 'new season has no players yet, keeping last season');
  }
  const last = await pull(L, Y, SORTS, 300, true);
  const keep = [];
  const ids = last.players.map(p => p.id);
  for (let i = 0; i < ids.length; i += 8) {
    const chunk = last.players.slice(i, i + 8);
    const res = await Promise.all(chunk.map(p => J(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/${SLUG[L]}/seasons/${Y + 1}/athletes/${p.id}?lang=en&region=us`, 2)));
    res.forEach((a, k) => { const p = chunk[k];
      if (a && a.team?.$ref && a.active !== false) { const tid = (a.team.$ref.match(/teams\/(\d+)/) || [])[1]; p.nowTeamId = tid; p.moved = tid && tid !== p.teamId; p.cls = a.experience?.displayValue || a.experience?.abbreviation || null; keep.push(p); } });
    await sleep(200);
  }
  // names for teams players transferred to
  const tids = [...new Set(keep.filter(p => p.moved).map(p => p.nowTeamId))];
  const tn = {}; for (const t of tids) { const j = await J(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/${SLUG[L]}/seasons/${Y + 1}/teams/${t}?lang=en&region=us`, 2); if (j) tn[t] = { ab: j.abbreviation, name: j.shortDisplayName || j.displayName }; await sleep(100); }
  keep.forEach(p => { if (p.moved && tn[p.nowTeamId]) { p.from = p.team; p.team = tn[p.nowTeamId].ab; p.teamName = tn[p.nowTeamId].name; } });
  out.leagues[L] = { label: `${Y - 1}-${String(Y).slice(2)}`, year: Y, final: true, lastSeason: true, players: keep, dropped: last.players.length - keep.length };
}
// HD photos: ESPN's cut-outs top out at 600px, the leagues' own are 1040px. Wikidata links ESPN's NBA ids to NBA.com ids;
// for the WNBA it lists WNBA.com ids by name. The app swaps in the sharper photo where one exists.
async function sparql(q) { try { const r = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { headers: { accept: 'application/sparql-results+json', 'user-agent': 'RIVL personal app (raylikeray.github.io/rivl)' } }); if (!r.ok) return []; return (await r.json()).results.bindings; } catch (e) { return []; } }
{
  const nb = await sparql('SELECT ?e ?n WHERE { ?x wdt:P3685 ?e ; wdt:P3647 ?n . }');
  const nmap = new Map(nb.map(b => [b.e.value, b.n.value])); let hit = 0;
  (out.leagues.nba?.players || []).forEach(p => { const h = nmap.get(String(p.id)); if (h && /^\d+$/.test(h)) { p.hd = h; hit++; } });
  const wb = await sparql('SELECT ?w ?l WHERE { ?x wdt:P3588 ?w ; rdfs:label ?l . FILTER(LANG(?l)="en") }');
  const nn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const wmap = new Map(); wb.forEach(b => { if (/^\d+$/.test(b.w.value)) wmap.set(nn(b.l.value), b.w.value); }); let whit = 0;
  (out.leagues.wnba?.players || []).forEach(p => { const h = wmap.get(nn(p.n)); if (h) { p.hd = h; whit++; } });
  console.log('hd photos', 'nba', hit, 'wnba', whit);
}
// a college player who is now on an NBA or WNBA roster is a pro: drop them from college (men's against the NBA, women's against
// the WNBA), and remember where they went so the app can send an old college link to the pro page
{
  const nn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  for (const [cl, pro] of [['ncaam', 'nba'], ['ncaaw', 'wnba']]) {
    const C = out.leagues[cl], P = out.leagues[pro]; if (!C || !P) continue;
    const pros = new Map(P.players.map(p => [nn(p.n), p]));
    const gone = []; C.players = C.players.filter(p => { const q = pros.get(nn(p.n)); if (q) { gone.push({ id: p.id, n: p.n, to: pro, pid: q.id, team: q.team }); return false; } return true; });
    C.turnedPro = gone; console.log(cl, 'turned pro', gone.length);
  }
}
// keep the file light: drop college players with too few games, round numbers
for (const [L, v] of Object.entries(out.leagues)) {
  const max = Math.max(1, ...v.players.map(p => p.s.gp || 0));
  if (L === 'ncaam' || L === 'ncaaw') v.players = v.players.filter(p => (p.s.gp || 0) >= Math.round(max * 0.5));
  v.players.forEach(p => { for (const k in p.s) if (typeof p.s[k] === 'number') p.s[k] = Math.round(p.s[k] * 10) / 10; if (p.prev) for (const k in p.prev) if (typeof p.prev[k] === 'number') p.prev[k] = Math.round(p.prev[k] * 10) / 10; delete p.teamId; delete p.nowTeamId; delete p.moved; for (const o of [p.s, p.prev]) if (o) for (const k in o) if (o[k] == null) delete o[k]; });
}
writeFileSync('data/leaders.json', JSON.stringify(out));
for (const [L, v] of Object.entries(out.leagues)) console.log(L, v.label, v.players.length, 'rookies:', v.players.filter(p => p.rookie).length, 'dropped:', v.dropped || 0);
