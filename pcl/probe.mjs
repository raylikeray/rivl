// Probe 11: a dozen college logos for a scores mock-up, found by team name so ids aren't guessed.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('pcl/cl', { recursive: true });
const j = await (await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500')).json();
const teams = j.sports[0].leagues[0].teams.map(x => x.team);
const want = { wagner: 'Wagner', uconn: 'UConn', grambling: 'Grambling', texas: 'Texas', radford: 'Radford', tennessee: 'Tennessee', unf: 'North Florida', miami: 'Miami', oakland: 'Oakland', alabama: 'Alabama', howard: 'Howard', penn: 'Pennsylvania', duke: 'Duke', kansas: 'Kansas' };
const meta = {};
for (const [k, n] of Object.entries(want)) {
  const t = teams.find(x => x.shortDisplayName === n || x.location === n); if (!t) { console.log('miss', n); continue; }
  const r = await fetch(`https://a.espncdn.com/i/teamlogos/ncaa/500/${t.id}.png`); if (r.ok) writeFileSync(`pcl/cl/${k}.png`, Buffer.from(await r.arrayBuffer()));
  meta[k] = { id: t.id, short: t.shortDisplayName, color: t.color, alt: t.alternateColor }; console.log(k, t.id, t.shortDisplayName, r.status);
}
writeFileSync('pcl/cl/meta.json', JSON.stringify(meta));
