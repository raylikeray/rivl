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
const CM_KEEP = 5 * 864e5;   // how long a clip's play link is kept
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
    out.push({ ...p, url, dur: Math.round(+v.duration || 0), thumb: p.thumb || v.thumbnail || '', k: String((v.tracking || {}).coverageType || '') });
  }));
}
// a post whose feed rolled past it this run stays until it ages out
(old.items || []).forEach(x => { if (!out.some(y => y.lk === x.lk && y.id === x.id) && now - Date.parse(x.ts) < KEEP) out.push(x); });
out.sort((a, b) => b.ts.localeCompare(a.ts));
if (!out.length && (old.items || []).length) { console.log('nothing resolved; keeping the last file'); process.exit(0); }

/* The clip map. A game's own list of clips says nothing about who is in each one. The clip service does: the player,
   and the exact play it shows. One entry per clip: { e: game, p: play id, a: [player ids], t: type, ts }. The app uses
   it to keep a team's story to that team's plays and to print the quarter, clock and score under each one.
   Games are swept for three days; a game that ended more than 10 hours ago and was already swept is left alone. */
const cm = { ...(old.cm || {}) }, swept = { ...(old.swept || {}) };
const ymd = n => new Date(now - n * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
let cmAsked = 0, gamesAsked = 0;
for (const [lk, path] of Object.entries(LG)) {
  const evs = new Map();
  for (const n of [0, 1, 2]) { const d = await get(`${SITE}/${path}/scoreboard?dates=${ymd(n)}${lk.startsWith('ncaa') ? '&groups=50&limit=400' : ''}`);
    ((d || {}).events || []).forEach(e => { const st = ((e.status || {}).type || {}); if (st.state === 'pre') return; evs.set(String(e.id), { id: String(e.id), done: !!st.completed, t: Date.parse(e.date) || now }); }); }
  const todo = [...evs.values()].filter(e => !(swept[e.id] && e.done && swept[e.id] - e.t > 12.5 * 36e5));
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async e => {
      gamesAsked++; const d = await get(`${SITE}/${path}/videos?event=${e.id}`); if (!d) return; swept[e.id] = now;
      for (const v of d.videos || []) { const id = String(v.id || ''); if (!id || cm[id]) continue;
        cmAsked++; const f = await get(`https://content.core.api.espn.com/v1/video/clips/${id}`); const c = ((f || {}).videos || [])[0]; if (!c) continue;
        const a = (c.categories || []).filter(x => x.type === 'athlete').map(x => String(x.athleteId || '')).filter(Boolean);
        const pl = ((c.plays || [])[0] || {}).id;
        cm[id] = { e: e.id, p: pl != null ? String(pl) : '', a, t: String((c.tracking || {}).coverageType || ''), ts: Date.parse(c.originalPublishDate || '') || now }; }
    }));
  }
  console.log(lk, 'games', evs.size, 'asked', todo.length);
}
for (const [id, c] of Object.entries(cm)) if (!(now - c.ts < CM_KEEP)) delete cm[id];
for (const [id, t] of Object.entries(swept)) if (!(now - t < 4 * 864e5)) delete swept[id];
writeFileSync('data/stories.json', JSON.stringify({ updated: new Date().toISOString(), items: out, cm, swept }));
console.log('clip map', Object.keys(cm).length, 'games asked', gamesAsked, 'clips asked', cmAsked);
console.log('stories', out.length, 'resolved now', asked, out.slice(0, 4).map(x => `${x.lk} ${x.title} [${x.aths.length}a ${x.teams.length}t]`));
