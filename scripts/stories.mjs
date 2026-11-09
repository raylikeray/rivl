// Builds data/stories.json: the video posts ESPN's news feeds carry (highlights, single plays, interviews, show
// segments), each tagged with the teams and players in it and resolved to its plain video file, so a story bubble can
// play it at once with no ads. The feeds list a post without its file; the clip service hands back the file for an id.
// Posts older than 72 hours fall off; ids resolved on earlier runs are reused instead of asked for again.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball';
const LG = { nba: 'nba', wnba: 'wnba', ncaam: 'mens-college-basketball', ncaaw: 'womens-college-basketball' };
const KEEP = 72 * 36e5, now = Date.now();
const get = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (r.ok) return r.json(); if (r.status === 404) return null; } catch (e) {} await new Promise(r => setTimeout(r, 900 * (i + 1))); } return null; };
const old = existsSync('data/stories.json') ? JSON.parse(readFileSync('data/stories.json', 'utf8')) : { items: [] };
const known = new Map((old.items || []).map(x => [x.lk + ':' + x.id, x]));
const posts = new Map();
const take = (lk, a) => {
  if (!a || a.type !== 'Media' || !a.id || !a.published) return; const ts = Date.parse(a.published); if (!(now - ts < KEEP)) return;
  const k = lk + ':' + a.id; const cats = a.categories || [];
  const teams = cats.filter(c => c.type === 'team').map(c => String(c.teamId || (c.team && c.team.id) || '')).filter(Boolean);
  const aths = cats.filter(c => c.type === 'athlete').map(c => String(c.athleteId || (c.athlete && c.athlete.id) || '')).filter(Boolean);
  const p = posts.get(k) || { lk, id: String(a.id), title: String(a.headline || '').trim(), ts: new Date(ts).toISOString(), teams: [], aths: [], thumb: ((a.images || [])[0] || {}).url || '' };
  p.teams = [...new Set([...p.teams, ...teams])]; p.aths = [...new Set([...p.aths, ...aths])]; posts.set(k, p);
};
for (const [lk, path] of Object.entries(LG)) {
  const feeds = [`${SITE}/${path}/news?limit=100`];
  if (lk === 'nba' || lk === 'wnba') {
    const td = await get(`${SITE}/${path}/teams?limit=60`);
    ((((((td || {}).sports || [])[0] || {}).leagues || [])[0] || {}).teams || []).forEach(x => feeds.push(`${SITE}/${path}/news?team=${x.team.id}&limit=40`));
  }
  for (let i = 0; i < feeds.length; i += 6) { const rs = await Promise.all(feeds.slice(i, i + 6).map(get)); rs.forEach(d => ((d || {}).articles || []).forEach(a => take(lk, a))); }
  console.log(lk, 'feeds', feeds.length, 'posts so far', posts.size);
}
const list = [...posts.values()]; const out = []; let asked = 0;
for (let i = 0; i < list.length; i += 6) {
  await Promise.all(list.slice(i, i + 6).map(async p => {
    const k = p.lk + ':' + p.id; const prev = known.get(k);
    if (prev && prev.url) { out.push({ ...prev, ...p, url: prev.url, dur: prev.dur, thumb: p.thumb || prev.thumb }); return; }
    asked++; const d = await get(`https://content.core.api.espn.com/v1/video/clips/${p.id}`); const v = ((d || {}).videos || [])[0]; if (!v) return;
    const s = ((v.links || {}).source) || {};
    const url = (s.mp4 && s.mp4.href) || (s.HD && s.HD.href) || s.href || (s.full && s.full.href) || '';
    if (!/^https:\/\/[^"]+\.mp4/.test(url) || v.premium) return;
    out.push({ ...p, url, dur: Math.round(+v.duration || 0), thumb: p.thumb || v.thumbnail || '' });
  }));
}
// a post whose feed rolled past it this run stays until it ages out
(old.items || []).forEach(x => { if (!out.some(y => y.lk === x.lk && y.id === x.id) && now - Date.parse(x.ts) < KEEP) out.push(x); });
out.sort((a, b) => b.ts.localeCompare(a.ts));
if (!out.length && (old.items || []).length) { console.log('nothing resolved; keeping the last file'); process.exit(0); }
writeFileSync('data/stories.json', JSON.stringify({ updated: new Date().toISOString(), items: out }));
console.log('stories', out.length, 'resolved now', asked, out.slice(0, 4).map(x => `${x.lk} ${x.title} [${x.aths.length}a ${x.teams.length}t]`));
