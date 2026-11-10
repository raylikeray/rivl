// Probe 12: how much video each game really carries, how it is tagged (team / athlete), and whether any
// feed lists clips by game, team or player. Read-only, results to pcl/st12.json.
import { writeFileSync } from 'node:fs';
const out = { at: new Date().toISOString(), leagues: {}, tries: {}, nba: {} };
const J = async (u, h) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000); const r = await fetch(u, { headers: h || {}, signal: c.signal }); clearTimeout(t); const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch (e) {} return { s: r.status, j, n: tx.length }; } catch (e) { return { s: 0, e: String(e).slice(0, 80) }; } };
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball';
const LG = { nba: 'nba', wnba: 'wnba', ncaam: 'mens-college-basketball', ncaaw: 'womens-college-basketball' };
const day = n => { const d = new Date(Date.now() - n * 864e5); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const cats = v => (v.categories || []).map(c => ({ t: c.type, id: c.teamId || c.athleteId || c.eventId || c.leagueId || c.id, d: c.description })).filter(c => ['team', 'athlete', 'event'].includes(c.t));

for (const [lk, slug] of Object.entries(LG)) {
  const L = out.leagues[lk] = { games: [], perGame: [], vids: [] };
  for (const n of [1, 2, 3]) {
    const sb = await J(`${SITE}/${slug}/scoreboard?dates=${day(n)}${lk.startsWith('ncaa') ? '&groups=50&limit=200' : ''}`);
    const evs = ((sb.j && sb.j.events) || []).filter(e => e.status && e.status.type && e.status.type.completed);
    // the biggest games first: ranked teams, then anything
    const rank = e => Math.min(...e.competitions[0].competitors.map(c => (c.curatedRank && c.curatedRank.current) || 99));
    evs.sort((a, b) => rank(a) - rank(b));
    L.games.push({ day: day(n), finals: evs.length });
    for (const e of evs.slice(0, lk.startsWith('ncaa') ? 14 : 8)) {
      const s = await J(`${SITE}/${slug}/summary?event=${e.id}`); if (!s.j) continue;
      const comp = e.competitions[0].competitors.map(c => ({ id: c.team.id, n: c.team.shortDisplayName, sc: c.score, rk: (c.curatedRank && c.curatedRank.current) || 99 }));
      const vs = s.j.videos || [];
      const ros = {}; for (const t of (s.j.boxscore && s.j.boxscore.players) || []) for (const st of t.statistics || []) for (const a of st.athletes || []) ros[a.athlete.id] = t.team.id;
      const plays = s.j.plays || [];
      L.perGame.push({ ev: e.id, t: comp.map(c => `${c.rk < 26 ? '#' + c.rk + ' ' : ''}${c.n} ${c.sc}`).join(' / '), vids: vs.length, plays: plays.length, playKeys: plays[0] ? Object.keys(plays[0]).join(',') : '', hasWP: !!(s.j.winprobability && s.j.winprobability.length), article: !!(s.j.article && s.j.article.headline), sumKeys: L.perGame.length ? undefined : Object.keys(s.j).join(',') });
      for (const v of vs) { const c = cats(v); const ath = c.filter(x => x.t === 'athlete').map(x => String(x.id)); const tm = c.filter(x => x.t === 'team').map(x => String(x.id));
        L.vids.push({ ev: e.id, id: v.id, h: v.headline, dur: v.duration, tm, ath, athTeams: ath.map(a => ros[a] || '?'), gameTeams: comp.map(c => c.id), src: !!(v.links && v.links.source && v.links.source.href), keys: L.vids.length ? undefined : Object.keys(v).join(','), time: v.originalPublishDate || v.lastModified }); }
    }
  }
}

// Does anything list clips by game / team / player?
const nbaEv = (out.leagues.nba.perGame[0] || {}).ev, wEv = (out.leagues.ncaaw.perGame[0] || {}).ev;
const T = async (name, u, pick) => { const r = await J(u); out.tries[name] = { u, s: r.s, n: r.n, keys: r.j && typeof r.j === 'object' ? Object.keys(r.j).slice(0, 14).join(',') : undefined, x: r.j && pick ? (() => { try { return pick(r.j); } catch (e) { return 'pick failed'; } })() : undefined }; };
const media = j => { const a = (j.articles || j.feed || []); return { total: a.length, media: a.filter(x => x.type === 'Media').length, sample: a.filter(x => x.type === 'Media').slice(0, 6).map(x => x.headline) }; };
await T('videos?event nba', `${SITE}/nba/videos?event=${nbaEv}`);
await T('core clips ?event', `https://content.core.api.espn.com/v1/video/clips?event=${nbaEv}&limit=50`, j => ({ n: (j.videos || []).length, h: (j.videos || []).slice(0, 8).map(v => v.headline) }));
await T('core clips ?sport nba', `https://content.core.api.espn.com/v1/video/clips?sport=basketball&league=nba&limit=50`, j => ({ n: (j.videos || []).length, h: (j.videos || []).slice(0, 8).map(v => v.headline) }));
await T('core events/videos', `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${nbaEv}/competitions/${nbaEv}/videos?limit=100`, j => ({ count: j.count, n: (j.items || []).length, first: JSON.stringify((j.items || [])[0] || {}).slice(0, 300) }));
await T('core plays nba', `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${nbaEv}/competitions/${nbaEv}/plays?limit=5`, j => ({ count: j.count, keys: Object.keys((j.items || [])[0] || {}).join(',') }));
await T('core events/videos ncaaw', `https://sports.core.api.espn.com/v2/sports/basketball/leagues/womens-college-basketball/events/${wEv}/competitions/${wEv}/videos?limit=100`, j => ({ count: j.count, n: (j.items || []).length }));
await T('news ncaaw limit100', `${SITE}/womens-college-basketball/news?limit=100`, media);
await T('news ncaam limit100', `${SITE}/mens-college-basketball/news?limit=100`, media);
await T('news ncaaw team SC', `${SITE}/womens-college-basketball/news?team=2579&limit=50`, media);
await T('news ncaaw team USC', `${SITE}/womens-college-basketball/news?team=30&limit=50`, media);
await T('search juju', `https://site.web.api.espn.com/apis/common/v3/search?query=juju%20watkins&limit=5`, j => (j.items || j.results || []).slice(0, 4).map(x => ({ id: x.id, n: x.displayName, t: x.type, lg: x.league })));
await T('search v2 video', `https://site.web.api.espn.com/apis/search/v2?query=juju%20watkins&limit=20&type=video`, j => (j.results || []).map(r => ({ t: r.type, n: (r.contents || []).length, h: (r.contents || []).slice(0, 6).map(c => c.displayName || c.headline) })));
await T('search v2 clips', `https://site.web.api.espn.com/apis/search/v2?query=south%20carolina%20gamecocks%20highlights&limit=20`, j => (j.results || []).map(r => ({ t: r.type, n: (r.contents || []).length, h: (r.contents || []).slice(0, 6).map(c => c.displayName || c.headline) })));
// a star's own page feeds (first NBA athlete tagged in a clip)
const anyAth = (out.leagues.nba.vids.find(v => v.ath.length) || { ath: [] }).ath[0];
if (anyAth) { await T('news athlete nba', `${SITE}/nba/news?athlete=${anyAth}&limit=50`, media);
  await T('athlete overview', `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${anyAth}/overview`, j => ({ keys: Object.keys(j).join(','), news: (j.news || []).length, vids: (j.videos || []).length }));
  await T('core clips ?athlete', `https://content.core.api.espn.com/v1/video/clips?athlete=${anyAth}&limit=50`, j => ({ n: (j.videos || []).length })); }
// one clip in full, to see what else it carries (play id, clock, keywords)
const one = out.leagues.nba.vids[1] || out.leagues.nba.vids[0];
if (one) { const r = await J(`https://content.core.api.espn.com/v1/video/clips/${one.id}`); const v = r.j && r.j.videos && r.j.videos[0]; out.tries.clipFull = { s: r.s, keys: v ? Object.keys(v).join(',') : '', kw: v && v.keywords, cats: v && cats(v), tr: v && v.tracking, links: v && Object.keys(v.links || {}).join(','), src: v && v.links && Object.keys(v.links.source || {}).join(','), hls: v && v.links && v.links.source && v.links.source.HLS ? Object.keys(v.links.source.HLS).join(',') : '', mezz: v && v.links && v.links.source && v.links.source.mezzanine ? 'y' : '', desc: v && v.description, gameId: v && v.gameId, playId: v && (v.playId || v.play) }; }

// NBA's own feeds: per-play video exists on nba.com. Is any of it reachable from here?
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', Referer: 'https://www.nba.com/', Origin: 'https://www.nba.com', 'x-nba-stats-origin': 'stats', 'x-nba-stats-token': 'true', Accept: 'application/json, text/plain, */*' };
const sb = await J('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json', H);
const gms = (sb.j && sb.j.scoreboard && sb.j.scoreboard.games) || [];
out.nba.scoreboard = { s: sb.s, date: sb.j && sb.j.scoreboard && sb.j.scoreboard.gameDate, games: gms.map(g => `${g.gameId} ${g.awayTeam.teamTricode}@${g.homeTeam.teamTricode} ${g.gameStatusText}`) };
const sch = await J('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json', H);
let gid = null; try { const dates = sch.j.leagueSchedule.gameDates; const done = []; for (const d of dates) for (const g of d.games) if (g.gameStatus === 3) done.push(g); gid = done.length ? done[done.length - 1].gameId : null; out.nba.schedule = { s: sch.s, done: done.length, last: gid }; } catch (e) { out.nba.schedule = { s: sch.s, e: String(e).slice(0, 80) }; }
if (gid) {
  const pbp = await J(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gid}.json`, H);
  const acts = (pbp.j && pbp.j.game && pbp.j.game.actions) || [];
  out.nba.pbp = { s: pbp.s, actions: acts.length, keys: acts[5] ? Object.keys(acts[5]).join(',') : '', made: acts.filter(a => a.shotResult === 'Made').length, sample: acts.filter(a => a.shotResult === 'Made').slice(0, 2).map(a => ({ n: a.actionNumber, d: a.description, p: a.personId, t: a.teamTricode })) };
  const a = acts.find(x => x.shotResult === 'Made');
  if (a) {
    const v1 = await J(`https://stats.nba.com/stats/videoeventsasset?GameEventID=${a.actionNumber}&GameID=${gid}`, H);
    out.nba.videoeventsasset = { s: v1.s, e: v1.e, n: v1.n, body: v1.j ? JSON.stringify(v1.j).slice(0, 600) : undefined };
    const v2 = await J(`https://stats.nba.com/stats/videoevents?GameEventID=${a.actionNumber}&GameID=${gid}`, H);
    out.nba.videoevents = { s: v2.s, e: v2.e, n: v2.n, body: v2.j ? JSON.stringify(v2.j).slice(0, 600) : undefined };
  }
  for (const [k, u] of Object.entries({
    contentGame: `https://content-api-prod.nba.com/public/1/leagues/nba/content?games=${gid}&types=video&count=50`,
    contentVideo: `https://content-api-prod.nba.com/public/1/leagues/nba/content?types=video&count=20`,
    gameVideo: `https://content-api-prod.nba.com/public/1/leagues/nba/game/${gid}/content`,
    wpVideo: `https://www.nba.com/wp-json/api/v1/video?game=${gid}`,
    nextData: `https://www.nba.com/game/${gid}/play-by-play` })) { const r = await J(u, H); out.nba[k] = { s: r.s, e: r.e, n: r.n, keys: r.j && typeof r.j === 'object' ? Object.keys(r.j).slice(0, 12).join(',') : undefined, head: r.j ? JSON.stringify(r.j).slice(0, 400) : undefined }; }
}
writeFileSync('pcl/st12.json', JSON.stringify(out));
console.log('done', Object.fromEntries(Object.entries(out.leagues).map(([k, v]) => [k, v.vids.length])));
