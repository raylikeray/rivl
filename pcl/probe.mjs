// Probe 6: what non-game video exists ad-free, and is it tagged to players/teams? League news feeds, athlete
// news/video endpoints, and the NBA's own content API.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const get = async (u, raw) => { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json,*/*' } }); const t = await r.text(); if (raw) return { status: r.status, text: t.slice(0, 600) }; try { return { status: r.status, json: JSON.parse(t) }; } catch (e) { return { status: r.status, text: t.slice(0, 300) }; } } catch (e) { return { err: String(e).slice(0, 120) }; } };
const out = {};
const vidsOf = a => (a.video || []).map(v => { const s = ((v.links || {}).source) || {}; return { head: (v.headline || '').slice(0, 70), dur: v.duration, url: (s.href || (s.mp4 && s.mp4.href) || '').slice(0, 60), kws: (v.keywords || []).slice(0, 6), cats: (v.categories || []).map(c => `${c.type}:${c.description || c.athleteId || c.teamId}`).slice(0, 6) }; });
const sumNews = (r, n) => { const arts = ((r.json || {}).articles) || []; const withV = arts.filter(a => (a.video || []).length);
  return { status: r.status, articles: arts.length, withVideo: withV.length, types: [...new Set(arts.map(a => a.type))],
    sample: withV.slice(0, n).map(a => ({ type: a.type, head: (a.headline || '').slice(0, 70), pub: (a.published || '').slice(0, 16), cats: (a.categories || []).map(c => `${c.type}:${c.description || c.athleteId || c.teamId}`).slice(0, 8), vids: vidsOf(a).slice(0, 2) })) }; };
out.nbaNews = sumNews(await get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50'), 12);
out.wnbaNews = sumNews(await get('https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/news?limit=30'), 4);
out.ncaamNews = sumNews(await get('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/news?limit=30'), 4);
out.teamNews13 = sumNews(await get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?team=13&limit=50'), 6);
console.log('nba news', out.nbaNews.articles, 'with video', out.nbaNews.withVideo, out.nbaNews.types);
console.log('team 13 news', out.teamNews13.articles, 'with video', out.teamNews13.withVideo);
// athlete-level candidates (Jalen Brunson 3934672, Luka 3945274)
out.athlete = {};
for (const u of [
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?athlete=3934672&limit=20',
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes/3934672/news?limit=20',
  'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/3934672/overview',
  'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/3934672/news?limit=20',
  'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/athletes/3934672/videos?limit=10',
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/videos?limit=10',
  'https://site.web.api.espn.com/apis/v2/sports/basketball/nba/videos?limit=10'
]) { const r = await get(u); const j = r.json || {}; out.athlete[u] = { status: r.status, keys: Object.keys(j).slice(0, 12), articles: (j.articles || []).length, withVideo: (j.articles || []).filter(a => (a.video || []).length).length, videos: (j.videos || []).length, sample: ((j.videos || j.articles || []).slice(0, 2)).map(a => (a.headline || '').slice(0, 60)) }; console.log(u.slice(30, 110), r.status, out.athlete[u].keys.slice(0, 6), 'arts', out.athlete[u].articles, 'v', out.athlete[u].withVideo || out.athlete[u].videos); }
// the NBA's own content API, as nba.com uses it
out.nba = {};
for (const u of [
  'https://content-api-prod.nba.com/public/1/endeavor/video-list?page=1&count=8&types=video',
  'https://content-api-prod.nba.com/public/1/endeavor/video-list?page=1&count=8&types=video&tags=team%2Flakers',
  'https://content-api-prod.nba.com/public/1/endeavor/video-list?page=1&count=8&types=video&tags=player%2Fluka-doncic'
]) { const r = await get(u); const j = r.json || {}; const items = (((j.results || {}).items) || j.items || []); out.nba[u] = { status: r.status, keys: Object.keys(j).slice(0, 8), n: items.length, sample: items.slice(0, 3).map(it => ({ title: (it.title || '').slice(0, 60), date: (it.date || it.publishedAt || '').slice(0, 16), url: (((it.video || {}).playbackUrl) || it.playbackUrl || (it.mediaItem || {}).url || JSON.stringify(it).match(/https?:[^"]+\.mp4[^"]*/)?.[0] || '').slice(0, 100), tags: (it.taxonomy && Object.keys(it.taxonomy)) || (it.tags || []).slice(0, 5) })) }; console.log('nba api', r.status, out.nba[u].n, JSON.stringify(out.nba[u].sample[0] || {}).slice(0, 200)); }
const mp4 = Object.values(out.nba).flatMap(x => x.sample.map(s => s.url)).find(u => /\.mp4/.test(u));
if (mp4) { try { const r = await fetch(mp4, { method: 'HEAD', headers: { 'user-agent': UA } }); out.nbaHead = { url: mp4.slice(0, 100), status: r.status, type: r.headers.get('content-type'), len: r.headers.get('content-length') }; console.log('nba mp4 HEAD', r.status, r.headers.get('content-type')); } catch (e) { out.nbaHead = { err: String(e).slice(0, 100) }; } }
writeFileSync('pcl/content.json', JSON.stringify(out, null, 1)); console.log('done');
