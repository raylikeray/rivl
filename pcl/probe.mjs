// Probe 14: does the vertical cut follow the play? For a handful of clips, line each vertical frame up
// against the wide frame of the same moment and record where the window sits. A fixed crop gives one number,
// a cut that follows the action gives a moving one. Numbers only, no pictures kept.
// Also: what the game summary's own video entry carries, and whether the stream address can be built from a thumbnail.
import { writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
const p13 = JSON.parse(readFileSync('pcl/st13.json', 'utf8'));
const out = { at: new Date().toISOString(), crop: [], summary: {}, derive: [], ff: '' };
const R = async (u, h) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000); const r = await fetch(u, { headers: h || {}, signal: c.signal }); clearTimeout(t); const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch (e) {} return { s: r.status, j, tx, hd: Object.fromEntries(r.headers) }; } catch (e) { return { s: 0, e: String(e).slice(0, 80) }; } };
const sh = c => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000, maxBuffer: 1 << 28 }); } catch (e) { return null; } };
if (!sh('ffmpeg -version')) { sh('sudo apt-get update -qq'); sh('sudo apt-get install -y -qq ffmpeg'); }
out.ff = String(sh('ffmpeg -version') || 'none').split('\n')[0];

const W = 320, H = 180, w = 102, T = '/tmp/crop'; mkdirSync(T, { recursive: true });
const grab = (u, ww, f) => { rmSync(f, { force: true }); sh(`ffmpeg -loglevel error -y -t 40 -i "${u}" -an -vf "fps=2,scale=${ww}:${H},format=gray" -f rawvideo ${f}`); try { return readFileSync(f); } catch (e) { return null; } };
const want = p13.clips.filter(c => c.v916 && c.mp4);
const picks = [...want.filter(c => c.lk === 'nba' && c.type === 'OnePlay' && c.dur < 30).slice(0, 5), ...want.filter(c => c.lk === 'ncaaw' && c.type === 'OnePlay' && c.dur < 30).slice(0, 3), ...want.filter(c => c.lk === 'ncaam' && c.type === 'OnePlay').slice(0, 2), ...want.filter(c => c.type === 'Final Game Highlight').slice(0, 2)];
for (const c of picks) {
  let v; try { v = JSON.parse(c.v916).href; } catch (e) { v = c.v916; }
  const a = grab(c.mp4, W, `${T}/a.raw`), b = grab(v, w, `${T}/b.raw`);
  if (!a || !b || !a.length || !b.length) { out.crop.push({ id: c.id, h: c.h, fail: [a && a.length, b && b.length] }); continue; }
  const na = Math.floor(a.length / (W * H)), nb = Math.floor(b.length / (w * H)), n = Math.min(na, nb), xs = [], q = [];
  for (let i = 0; i < n; i++) { let best = 1e18, bx = 0, second = 1e18;
    for (let x = 0; x <= W - w; x += 2) { let s = 0; for (let y = 4; y < H - 4; y += 3) { const ra = (i * H + y) * W + x, rb = (i * H + y) * w; for (let k = 2; k < w - 2; k += 3) s += Math.abs(a[ra + k] - b[rb + k]); } if (s < best) { second = best; best = s; bx = x; } else if (s < second) second = s; }
    xs.push(Math.round(bx / (W - w) * 100)); q.push(Math.round(best / ((H - 8) / 3 * (w - 4) / 3))); }
  const good = xs.filter((_, i) => q[i] < 14); const mn = Math.min(...good), mx = Math.max(...good);
  out.crop.push({ id: c.id, lk: c.lk, h: c.h, dur: c.dur, frames: [na, nb], pos: xs.join(' '), err: q.join(' '), matched: good.length, range: good.length ? [mn, mx] : null });
}

// what the game summary's own entry looks like (the app reads this one)
for (const [lk, slug, ev] of [['nba', 'nba', '401909954'], ['ncaaw', 'womens-college-basketball', '401906089']]) {
  const r = await R(`https://site.api.espn.com/apis/site/v2/sports/basketball/${slug}/summary?event=${ev}`); const v = r.j && r.j.videos && r.j.videos[1] || r.j && r.j.videos && r.j.videos[0];
  out.summary[lk] = v ? { links: JSON.stringify(v.links).slice(0, 1500), thumb: v.thumbnail, tracking: v.tracking, n: r.j.videos.length, order: r.j.videos.map(x => `${x.originalPublishDate}|${x.headline.slice(0, 40)}`), wp: (r.j.winprobability || []).slice(0, 2), wpN: (r.j.winprobability || []).length, play: (r.j.plays || []).find(p => p.scoringPlay) } : { s: r.s }; }

// can the phone build the stream address from a search result's thumbnail?
for (const q of ['juju watkins', 'aj dybantsa', 'anthony edwards']) {
  const r = await R(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&limit=30&type=clips`); const cl = ((r.j && r.j.results) || []).find(x => x.type === 'clips') || { contents: [] };
  for (const c of cl.contents.slice(0, 7)) { const img = (c.image && c.image.default) || ''; const m = img.match(/\/media\/common\/(wsc\/)?(\d{4})\/(\d{4})\/([^/]+)\//);
    const row = { q, id: c.id, h: c.displayName, d: (c.date || '').slice(0, 10), img: img.slice(40, 130), wsc: !!(m && m[1]) };
    if (m) { const base = `${m[1] || ''}${m[2]}/${m[3]}/${m[4]}/${m[4]}`; const v = await R(`https://cmp-espn.media.dssott.com/opp/hls/espn/9x16/${base}/playlist.m3u8`); const hw = await R(`https://cmp-espn.media.dssott.com/opp/hls/espn/${base}/playlist.m3u8`);
      let mp = 0; try { const c2 = new AbortController(); setTimeout(() => c2.abort(), 10000); const h = await fetch(`https://espnmedia-cdn.akamaized.net/espn/media/16x9/${m[1] || ''}${m[2]}/${m[3]}/${m[4]}/${m[4]}.mp4`, { method: 'HEAD', signal: c2.signal }); mp = h.status; } catch (e) {}
      row.v916 = v.s; row.wide = hw.s; row.mp4 = mp; }
    const full = await R(`https://content.core.api.espn.com/v1/video/clips/${c.id}`); const fv = full.j && full.j.videos && full.j.videos[0];
    if (fv) { row.real916 = !!(fv.links.source.HLS && fv.links.source.HLS['9x16']); row.realMp4 = (fv.links.source.href || '').slice(36, 120); row.type = fv.tracking && fv.tracking.coverageType; row.ratio = fv.videoRatio; }
    out.derive.push(row); } }
writeFileSync('pcl/st14.json', JSON.stringify(out));
console.log('done', out.ff, out.crop.map(c => c.range));
