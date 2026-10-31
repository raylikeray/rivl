import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const out = {};
const urls = {
  byath: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=5&sort=offensive.avgPoints:desc&season=2027&seasontype=2',
  byathRook: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&page=1&limit=50&sort=offensive.avgPoints:desc&season=2027&seasontype=2',
  wnba: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=3&sort=offensive.avgPoints:desc&season=2026&seasontype=2',
  ncaam: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=3&sort=offensive.avgPoints:desc&season=2026&seasontype=2',
  coreAth: 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2027/athletes?limit=3',
  coreLeaders: 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/types/2/leaders?limit=3'
};
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u); const t = await r.text(); out[k] = { status: r.status, len: t.length };
    try { const j = JSON.parse(t); const top = {}; for (const kk of Object.keys(j)) if (kk !== 'athletes') top[kk] = j[kk];
      out[k].top = JSON.stringify(top).slice(0, 5000);
      if (j.athletes) { const a = JSON.parse(JSON.stringify(j.athletes[0])); if (a.athlete) { delete a.athlete.links; delete a.athlete.teams; } out[k].ath = JSON.stringify(a).slice(0, 5000);
        out[k].debut = j.athletes.map(x => [x.athlete.displayName, x.athlete.debutYear, x.athlete.experience && x.athlete.experience.years]); } } catch (e) { out[k].raw = t.slice(0, 1500); } }
  catch (e) { out[k] = { error: String(e) }; }
}
writeFileSync('data/leaders-probe.json', JSON.stringify(out, null, 1));
