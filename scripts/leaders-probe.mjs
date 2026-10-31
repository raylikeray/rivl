import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const out = {};
const urls = {
  byath: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=5&sort=offensive.avgPoints:desc&season=2027&seasontype=2',
  byathRook: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&page=1&limit=5&sort=offensive.avgPoints:desc&season=2027&seasontype=2&experience=0',
  wnba: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=3&sort=offensive.avgPoints:desc&season=2026&seasontype=2',
  ncaam: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=3&sort=offensive.avgPoints:desc&season=2026&seasontype=2',
  coreAth: 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2027/athletes?limit=3',
  coreLeaders: 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/types/2/leaders?limit=3'
};
for (const [k, u] of Object.entries(urls)) {
  try { const r = await fetch(u); const t = await r.text(); out[k] = { status: r.status, cors: r.headers.get('access-control-allow-origin'), len: t.length, body: t.slice(0, 6000) }; }
  catch (e) { out[k] = { error: String(e) }; }
}
writeFileSync('data/leaders-probe.json', JSON.stringify(out, null, 1));
