import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data/fx', { recursive: true });
const j = async u => { const r = await fetch(u); return r.ok ? r.json() : null; };
const sb = await j('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261030&limit=50');
writeFileSync('data/fx/sb.json', JSON.stringify(sb));
const ev = (sb?.events || []).find(e => e.status?.type?.completed) || (sb?.events || [])[0];
const sum = await j(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${ev.id}`);
writeFileSync('data/fx/sum.json', JSON.stringify(sum)); writeFileSync('data/fx/id.txt', ev.id);
