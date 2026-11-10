// Probe 13: what the full clip record carries (play link, vertical version, clip type), search by player,
// browser access, and what NBA's own game video list holds. Read-only, results to pcl/st13.json.
import { writeFileSync, readFileSync } from 'node:fs';
const p12 = JSON.parse(readFileSync('pcl/st12.json', 'utf8'));
const out = { at: new Date().toISOString(), clips: [], types: {}, search: {}, cors: {}, nba: {}, hls: {} };
const R = async (u, h) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000); const r = await fetch(u, { headers: h || {}, signal: c.signal }); clearTimeout(t); const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch (e) {} return { s: r.status, j, tx, n: tx.length, hd: Object.fromEntries(r.headers) }; } catch (e) { return { s: 0, e: String(e).slice(0, 80) }; } };
const clip = async id => { const r = await R(`https://content.core.api.espn.com/v1/video/clips/${id}`); return r.j && r.j.videos && r.j.videos[0]; };

// 1. full records for a spread of clips: two NBA games, the South Carolina game, a men's college game
const pick = [];
const byEv = (lk, ev, n) => p12.leagues[lk].vids.filter(v => String(v.ev) === String(ev)).slice(0, n).forEach(v => pick.push([lk, v.id]));
byEv('nba', '401909954', 20); byEv('nba', '401909952', 6); byEv('ncaaw', '401906089', 5); byEv('ncaaw', '401918841', 3); byEv('ncaam', '401906865', 6);
p12.leagues.ncaaw.vids.filter(v => /Game Highlights/.test(v.h)).slice(0, 3).forEach(v => pick.push(['ncaaw', v.id]));
let first = true;
for (const [lk, id] of pick) { const v = await clip(id); if (!v) { out.clips.push({ lk, id, miss: 1 }); continue; }
  const src = (v.links && v.links.source) || {}, hls = src.HLS || {};
  const ct = v.tracking && v.tracking.coverageType; out.types[ct] = (out.types[ct] || 0) + 1;
  out.clips.push({ lk, id, h: v.headline, dur: v.duration, ratio: v.videoRatio, type: ct, gameId: v.gameId, plays: v.plays, ath: (v.categories || []).filter(c => c.type === 'athlete').map(c => `${c.athleteId}:${c.description}`), teams: (v.categories || []).filter(c => c.type === 'team').map(c => c.teamId),
    v916: hls['9x16'] ? (typeof hls['9x16'] === 'string' ? hls['9x16'] : JSON.stringify(hls['9x16'])).slice(0, 220) : null, mp4: src.href, hd: src.HD && src.HD.href, full: src.full && src.full.href, hlsHref: hls.href, premium: v.premium, geo: v.geoRestrictions && JSON.stringify(v.geoRestrictions).slice(0, 120), time: v.originalPublishDate });
  if (first) { first = false; out.sample = { source: JSON.stringify(src).slice(0, 1800), plays: JSON.stringify(v.plays).slice(0, 600), posters: JSON.stringify(v.posterImages || {}).slice(0, 500), images: JSON.stringify(v.images || []).slice(0, 400) }; } }

// 2. the vertical version: does it answer, and what is inside the playlist?
const one = out.clips.find(c => c.v916);
if (one) { let u = one.v916; try { const o = JSON.parse(u); u = o.href || Object.values(o)[0]; } catch (e) {}
  const r = await R(u); out.hls = { u, s: r.s, type: r.hd && r.hd['content-type'], acao: r.hd && r.hd['access-control-allow-origin'], body: (r.tx || '').slice(0, 900) };
  const m = (r.tx || '').split('\n').find(l => l && !l.startsWith('#')); if (m) { const u2 = new URL(m, u).href; const r2 = await R(u2); out.hls.child = { u: u2, s: r2.s, body: (r2.tx || '').slice(0, 500) }; } }

// 3. does the clip service answer a browser on another site? (lets the app look clips up itself)
for (const [k, u] of Object.entries({ clip: `https://content.core.api.espn.com/v1/video/clips/${pick[0][1]}`, search: 'https://site.web.api.espn.com/apis/search/v2?query=juju%20watkins&limit=10', videosEvent: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/videos?event=401909954' })) {
  const r = await R(u, { Origin: 'https://raylikeray.github.io' }); out.cors[k] = { s: r.s, acao: r.hd && r.hd['access-control-allow-origin'], n: r.n }; }
const ve = await R('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/videos?event=401909954'); out.videosEvent = { n: ((ve.j && ve.j.videos) || []).length, keys: ve.j && ve.j.videos && ve.j.videos[0] ? Object.keys(ve.j.videos[0]).join(',') : '', hasCats: !!(ve.j && ve.j.videos && ve.j.videos[0] && ve.j.videos[0].categories) };

// 4. search by player name: how many clips, how fresh, what fields
for (const q of ['juju watkins', 'joyce edwards', 'aj dybantsa', 'anthony edwards', 'paige bueckers', 'south carolina gamecocks women']) {
  const r = await R(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=30`);
  const res = (r.j && r.j.results) || []; const cl = res.find(x => x.type === 'clips') || res.find(x => /video|clip/.test(x.type || '')) || { contents: [] };
  out.search[q] = { s: r.s, types: res.map(x => `${x.type}:${(x.contents || []).length}/${x.totalFound}`), keys: cl.contents[0] ? Object.keys(cl.contents[0]).join(',') : '', first: cl.contents[0] ? JSON.stringify(cl.contents[0]).slice(0, 700) : '', items: cl.contents.slice(0, 30).map(c => ({ id: c.id, h: c.displayName || c.headline, d: c.date || c.published, sub: c.subtitle || c.description })) };
  const pl = res.find(x => x.type === 'player'); if (pl && pl.contents[0]) out.search[q].player = { id: pl.contents[0].id, uid: pl.contents[0].uid, n: pl.contents[0].displayName, sub: pl.contents[0].subtitle, link: pl.contents[0].link && pl.contents[0].link.web }; }
// search pages 2+: is there paging and a date sort?
{ const r = await R('https://site.web.api.espn.com/apis/search/v2?query=juju%20watkins&limit=50&type=clips'); out.search.typed = { s: r.s, keys: r.j ? Object.keys(r.j).join(',') : '', types: ((r.j && r.j.results) || []).map(x => `${x.type}:${(x.contents || []).length}/${x.totalFound}`) };
  const r2 = await R('https://site.web.api.espn.com/apis/search/v2?query=juju%20watkins&limit=50&mode=prefix&content=clips&sort=date'); out.search.typed2 = { s: r2.s, types: ((r2.j && r2.j.results) || []).map(x => `${x.type}:${(x.contents || []).length}/${x.totalFound}`) }; }
// athlete news feeds for two college women (ids from search)
for (const q of ['juju watkins', 'joyce edwards']) { const p = out.search[q] && out.search[q].player; if (!p) continue; const id = String(p.uid || '').split('~a:')[1] || p.id;
  const r = await R(`https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/news?athlete=${id}&limit=50`); const a = (r.j && r.j.articles) || [];
  out.search[q].news = { id, s: r.s, total: a.length, media: a.filter(x => x.type === 'Media').map(x => ({ h: x.headline, d: x.published, id: x.dataSourceIdentifier || x.id })) }; }

// 5. NBA's own list of videos for one game
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', Referer: 'https://www.nba.com/', Origin: 'https://www.nba.com', Accept: 'application/json, text/plain, */*' };
for (const gid of ['0022600210', '0022600205']) { const r = await R(`https://content-api-prod.nba.com/public/1/leagues/nba/content?games=${gid}&types=video&count=100`, H);
  const it = (r.j && r.j.results && r.j.results.items) || [];
  out.nba[gid] = { s: r.s, acao: r.hd && r.hd['access-control-allow-origin'], count: it.length, keys: it[0] ? Object.keys(it[0]).join(',') : '', first: it[0] ? JSON.stringify(it[0]).slice(0, 2600) : '', titles: it.map(x => `${x.title} | ${x.videoDuration || x.duration || (x.fields && x.fields.duration) || ''} | ${(x.taxonomy && x.taxonomy.players ? Object.values(x.taxonomy.players).join(',') : '')} | ${(x.taxonomy && x.taxonomy.teams ? Object.keys(x.taxonomy.teams).join(',') : '')}`) }; }
writeFileSync('pcl/st13.json', JSON.stringify(out));
console.log('done', out.clips.length, out.types);
