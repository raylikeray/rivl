// Probe 7: how does a news "Media" post resolve to its video file? Dump raw Media items and chase their ids.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const get = async u => { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json,*/*' } }); const t = await r.text(); try { return { status: r.status, json: JSON.parse(t) }; } catch (e) { return { status: r.status, text: t.slice(0, 400) }; } } catch (e) { return { err: String(e).slice(0, 120) }; } };
const out = {};
const nw = await get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50');
const arts = ((nw.json || {}).articles) || [];
const media = arts.filter(a => a.type === 'Media');
out.mediaCount = media.length; out.allTypes = arts.map(a => a.type);
out.mediaRaw = media.slice(0, 2).map(a => JSON.stringify(a).slice(0, 3000));
out.mediaHeads = media.map(a => ({ head: (a.headline || '').slice(0, 80), pub: (a.published || '').slice(0, 16), cats: (a.categories || []).map(c => `${c.type}:${c.description || ''}`).slice(0, 6), web: ((a.links || {}).web || {}).href || '', api: JSON.stringify((a.links || {}).api || {}).slice(0, 200), dataSourceIdentifier: a.dataSourceIdentifier, id: a.id }));
console.log('media posts', media.length, 'of', arts.length);
media.slice(0, 6).forEach(m => console.log('  ', (m.headline || '').slice(0, 70), '|', ((m.links || {}).web || {}).href));
// chase: the web link id, the core video clips API, the site news detail
const first = media[0];
if (first) {
  const web = ((first.links || {}).web || {}).href || '';
  const vid = (/\/id\/(\d+)/.exec(web) || [])[1] || String(first.id || '');
  out.chase = {};
  for (const u of [
    `https://content.core.api.espn.com/v1/video/clips/${vid}`,
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news/${first.id}`,
    `https://site.web.api.espn.com/apis/v2/video/clips/${vid}`,
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50&enable=video`,
    ...(((first.links || {}).api || {}).self && ((first.links || {}).api || {}).self.href ? [((first.links || {}).api || {}).self.href] : [])
  ]) { const r = await get(u); const j = r.json || {}; const s = JSON.stringify(j); const mp4 = (s.match(/https?:[^"]+?\.mp4[^"]*/) || [])[0] || ''; out.chase[u] = { status: r.status, keys: Object.keys(j).slice(0, 10), mp4: mp4.slice(0, 120), snippet: s.slice(0, 500) }; console.log('chase', u.slice(8, 90), r.status, Object.keys(j).slice(0, 5), mp4 ? 'MP4 FOUND' : ''); }
}
// athlete feed: how much is Media, and what kinds
const an = await get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?athlete=1966&limit=50');
const aa = ((an.json || {}).articles) || [];
out.athleteFeed = { n: aa.length, media: aa.filter(a => a.type === 'Media').length, heads: aa.filter(a => a.type === 'Media').slice(0, 10).map(a => `${(a.published || '').slice(0, 10)} ${(a.headline || '').slice(0, 70)}`) };
console.log('athlete 1966 feed', out.athleteFeed.n, 'media', out.athleteFeed.media); out.athleteFeed.heads.forEach(h => console.log('   ', h));
const tn = await get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?team=13&limit=50');
const ta = ((tn.json || {}).articles) || [];
out.teamFeed = { n: ta.length, media: ta.filter(a => a.type === 'Media').length, heads: ta.filter(a => a.type === 'Media').slice(0, 10).map(a => `${(a.published || '').slice(0, 10)} ${(a.headline || '').slice(0, 70)}`) };
console.log('team 13 feed', out.teamFeed.n, 'media', out.teamFeed.media); out.teamFeed.heads.forEach(h => console.log('   ', h));
writeFileSync('pcl/media.json', JSON.stringify(out, null, 1)); console.log('done');
