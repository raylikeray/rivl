// probe 17: one finished NBA game's summary, whole, for the game page's test fixture
import { writeFileSync } from 'fs';
const get = async u => { try { const r = await fetch(u, { headers: { accept: 'application/json' } }); return r.ok ? r.json() : null; } catch { return null; } };
const S = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const d = new Date(); const ymd = n => { const t = new Date(d.getTime() - n * 864e5); return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}`; };
let pick = null, sbEv = null;
for (const n of [1, 2, 0, 3]) { const sb = await get(`${S}/scoreboard?dates=${ymd(n)}`); const fin = ((sb || {}).events || []).filter(e => (((e.status || {}).type) || {}).completed); if (fin.length) { sbEv = fin[0]; pick = fin[0].id; break; } }
const out = { at: new Date().toISOString(), id: pick };
if (pick) { const s = await get(`${S}/summary?event=${pick}`); if (s) { writeFileSync('pcl/gsum.json', JSON.stringify(s)); out.keys = Object.keys(s); out.plays = (s.plays || []).length; out.wp = (s.winprobability || []).length; out.vids = (s.videos || []).length; } writeFileSync('pcl/gsb.json', JSON.stringify(sbEv)); }
writeFileSync('pcl/st17.json', JSON.stringify(out, null, 1)); console.log(out);
