// Probe 5: do ESPN's own feeds carry playable highlight clips? Reads yesterday's NBA scoreboard, two game
// summaries and a team news feed, dumps every video entry's links, and HEAD-checks the mp4s.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const j = async u => { try { const r = await fetch(u, { headers: { 'user-agent': UA } }); return r.ok ? r.json() : null; } catch (e) { return null; } };
const S = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const SW = 'https://site.api.espn.com/apis/site/v2/sports/womens-college-basketball';
const out = { sum: [], news: [], heads: [], college: [] };
function pickVideos(o, path = '') {
  const vids = [];
  const walk = (n, p) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(x => walk(x, p)); return; }
    if (n.headline && (n.links || n.source) && (n.duration !== undefined || n.thumbnail)) {
      const L = n.links || {}; const src = L.source || {};
      vids.push({ at: p, headline: n.headline, duration: n.duration, thumb: (n.thumbnail || '').slice(0, 90), premium: n.premium,
        mp4: (src.mp4 && (src.mp4.href || src.mp4)) || '', hd: (src.HD && src.HD.href) || '', full: (src.full && src.full.href) || '', href: src.href || '', mezz: (src.mezzanine && src.mezzanine.href) || '' });
      return; }
    Object.entries(n).forEach(([k, v]) => walk(v, p + '.' + k)); };
  walk(o, path); return vids;
}
const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10).replace(/-/g, '');
const sb = await j(`${S}/scoreboard?dates=${y}`);
const evs = ((sb || {}).events || []).slice(0, 2);
for (const e of evs) {
  const sum = await j(`${S}/summary?event=${e.id}`);
  const vids = pickVideos((sum || {}).videos, 'videos');
  out.sum.push({ id: e.id, name: e.shortName, n: vids.length, vids: vids.slice(0, 4) });
  console.log('summary', e.shortName, 'videos', vids.length);
}
const nw = await j(`${S}/news?team=13&limit=12`);
for (const a of (nw || {}).articles || []) {
  const vids = pickVideos(a.video || [], 'article.video');
  if (vids.length) out.news.push({ type: a.type, head: (a.headline || '').slice(0, 60), published: a.published, vids: vids.slice(0, 2) });
}
console.log('news video articles', out.news.length);
// college check: one recent women's game
const csb = await j(`${SW}/scoreboard?dates=${y}&groups=50&limit=5`);
const ce = ((csb || {}).events || [])[0];
if (ce) { const cs = await j(`${SW}/summary?event=${ce.id}`); const cv = pickVideos((cs || {}).videos, 'videos'); out.college.push({ name: ce.shortName, n: cv.length, vids: cv.slice(0, 2) }); console.log('college', ce.shortName, 'videos', cv.length); }
// HEAD the first few mp4-ish urls found
const urls = [];
[...out.sum.flatMap(s => s.vids), ...out.news.flatMap(n => n.vids), ...out.college.flatMap(c => c.vids)].forEach(v => { ['mp4', 'hd', 'full', 'href', 'mezz'].forEach(k => { if (v[k] && urls.length < 6 && !urls.some(u => u.u === v[k])) urls.push({ k, u: v[k] }); }); });
for (const { k, u } of urls) {
  try { const r = await fetch(u, { method: 'HEAD', headers: { 'user-agent': UA } });
    out.heads.push({ k, u: u.slice(0, 110), status: r.status, type: r.headers.get('content-type'), len: r.headers.get('content-length') });
    console.log('HEAD', k, r.status, r.headers.get('content-type'), r.headers.get('content-length'), u.slice(0, 90));
  } catch (e) { out.heads.push({ k, u: u.slice(0, 110), err: String(e).slice(0, 80) }); }
}
writeFileSync('pcl/espnvid.json', JSON.stringify(out, null, 1));
console.log('done');
