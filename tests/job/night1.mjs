// Dry run of scripts/night.mjs: seven made-up NBA nights. One player scores 30 or more every night (a run), has a
// triple-double twice, and sets a season high on the last night; his team wins all seven; a rookie plays. Run twice to
// show a second run reads nothing again and counts nothing twice.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const now = Date.now(), DAYS = 7;
const tip = n => new Date(now - n * 864e5 - 20 * 36e5).toISOString();     // n nights ago, long finished
const ET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const evs = []; for (let n = DAYS; n >= 1; n--) evs.push({ id: String(700 + n), n, date: tip(n) });
mkdirSync('data', { recursive: true }); writeFileSync('data/leaders.json', JSON.stringify({ leagues: { nba: { players: [{ id: '9', rookie: true }] } } }));
const L = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF'];
const row = (id, name, pts, reb, ast, extra = {}) => ({ athlete: { id, displayName: name, headshot: { href: `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png` } }, stats: ['34', String(pts), `${Math.round(pts / 2.5)}-${Math.round(pts / 1.3)}`, '3-7', '6-7', String(reb), String(ast), '2', '1', '1', '1', String(Math.max(0, reb - 1)), '2'], ...extra });
const summary = id => { const n = +id - 700, star = [31, 33, 30, 36, 32, 30, 44][DAYS - n], td = n === 5 || n === 2;
  const plays = []; let h = 0, a = 0; for (let i = 0; i < 40; i++) { if (i % 3) h += 2; else a += 3; plays.push({ id: String(i), homeScore: h, awayScore: a }); }
  return { plays, winprobability: plays.map((p, i) => ({ homeWinPercentage: i % 2 ? .6 : .4, playId: p.id })),
    header: { competitions: [{ competitors: [{ homeAway: 'home', score: '112', linescores: [{}, {}, {}, {}, ...(n === 3 ? [{}] : [])], team: { id: '25', abbreviation: 'OKC', name: 'Thunder', shortDisplayName: 'Thunder' } }, { homeAway: 'away', score: '104', linescores: [{}, {}, {}, {}], team: { id: '7', abbreviation: 'DEN', name: 'Nuggets', shortDisplayName: 'Nuggets' } }] }] },
    boxscore: { players: [{ team: { id: '25' }, statistics: [{ labels: L, athletes: [row('1', 'Star Player', star, td ? 12 : 6, td ? 11 : 5), row('9', 'New Kid', 14, 4, 3), { athlete: { id: '5', displayName: 'Sat Out' }, didNotPlay: true, stats: [] }] }] },
      { team: { id: '7' }, statistics: [{ labels: L, athletes: [row('2', 'Other Guy', 22, 21, 2)] }] }] } }; };
globalThis.fetch = async u => { u = String(u); let j = null;
  if (u.includes('/nba/scoreboard')) { const d = /dates=(\d{8})/.exec(u)[1]; j = { events: evs.filter(e => ET.format(new Date(e.date)).replace(/-/g, '') === d).map(e => ({ id: e.id, date: e.date, status: { type: { completed: true, state: 'post', name: 'STATUS_FINAL' } } })) }; }
  else if (u.includes('/scoreboard')) j = { events: [] };
  else if (u.includes('/nba/summary?event=')) j = summary(u.split('event=')[1]);
  return { ok: !!j, status: j ? 200 : 404, json: async () => j, text: async () => JSON.stringify(j) }; };
await import('./scripts/night.mjs?run=' + (process.env.RUN || 1));
const o = JSON.parse(readFileSync('data/night.json', 'utf8')), st = JSON.parse(readFileSync('data/night-state.json', 'utf8')), N = o.lg.nba, d0 = N.days.find(d => d.done);
console.log('check nights', N.days.length, 'done', N.days.filter(d => d.done).length, 'star', JSON.stringify(st.lg.nba.p['1']), 'team run', st.lg.nba.t['25'], st.lg.nba.t['7']);
console.log('check latest', d0.d, 'player', d0.pon.n, d0.pon.gs, 'rookie', d0.ron && d0.ron.n, 'game', d0.gon.e, 'lc', d0.gon.lc, 'tally', JSON.stringify(N.tally));
d0.notes.forEach(n => console.log('note', n.k, n.v, n.t));
N.days.filter(d => d !== d0).forEach(d => console.log('earlier', d.d, d.notes.map(n => n.k).join(',')));
