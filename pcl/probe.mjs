// Probe 10: raw shapes for the Unrivaled build. Player page flight data, player hrefs, ESPN search + stats.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('pcl/u10', { recursive: true });
const B = 'https://www.unrivaled.basketball';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const get = async u => { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: '*/*' } }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: String(e) }; } };
const flight = html => { const parts = []; const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g; let m; while ((m = re.exec(html))) { try { parts.push(JSON.parse('"' + m[1] + '"')); } catch (e) {} } return parts.join(''); };
const pl = await get(B + '/player/alyssa-thomas-0ehynljdh7k1'); const ft = flight(pl.t);
writeFileSync('pcl/u10/player-flight.txt', ft);
const i = ft.indexOf('Box Scores'); console.log('player flight', ft.length, 'box idx', i);
// find json-ish stat objects
const keys = [...new Set((ft.match(/"[a-zA-Z]{2,30}":/g) || []))].slice(0, 300); writeFileSync('pcl/u10/player-keys.txt', keys.join('\n'));
const ps = await get(B + '/players'); const hrefs = [...new Set((ps.t.match(/\/player\/[a-z0-9-]+/g) || []))]; writeFileSync('pcl/u10/player-hrefs.txt', hrefs.join('\n')); console.log('player hrefs', hrefs.length);
const fp = flight(ps.t); const k2 = fp.indexOf('{"players":['); writeFileSync('pcl/u10/players-head.txt', fp.slice(k2, k2 + 4000));
const gm = await get(B + '/game/9r3c2rtv1a4b/box-score'); writeFileSync('pcl/u10/box-flight.txt', flight(gm.t));
for (const q of ['Kelsey Plum', 'Olivia Miles', 'Temi Fagbenle']) {
  const r = await get(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=5&type=player`); writeFileSync(`pcl/u10/search-${q.split(' ')[1]}.json`, r.t.slice(0, 20000)); console.log('search', q, r.s, r.t.length);
}
const st = await get('https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/athletes/2987869/stats'); writeFileSync('pcl/u10/plum-stats.json', st.t.slice(0, 60000)); console.log('stats', st.s, st.t.length);
console.log('done');
