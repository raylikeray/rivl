// Probe 16: how sharp can a clip be? For a spread of clips: the size of the wide file, every level in the wide
// stream and the upright stream, every video address the clip's own record lists, and whether an upright file
// exists beside the wide one. Numbers and addresses only.
import { writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const p13 = JSON.parse(readFileSync('pcl/st13.json', 'utf8'));
const out = { at: new Date().toISOString(), ff: '', clips: [] };
const sh = c => { try { return String(execSync(c, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 1 << 26 })); } catch (e) { return ''; } };
if (!sh('ffprobe -version')) { sh('sudo apt-get update -qq'); sh('sudo apt-get install -y -qq ffmpeg'); }
out.ff = (sh('ffprobe -version') || 'none').split('\n')[0];
const T = async (u, opt) => { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000); const r = await fetch(u, Object.assign({ signal: c.signal }, opt || {})); clearTimeout(t); return r; } catch (e) { return null; } };
const probe = u => { const tx = sh(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,avg_frame_rate,bit_rate:format=bit_rate,duration -of json "${u}"`); try { const j = JSON.parse(tx); const s = (j.streams || [])[0] || {}; return { codec: s.codec_name, w: s.width, h: s.height, fps: s.avg_frame_rate, vbr: +s.bit_rate || null, br: +(j.format || {}).bit_rate || null, dur: +(j.format || {}).duration || null }; } catch (e) { return null; } };
const ladder = async u => { const r = await T(u); if (!r || !r.ok) return { s: r ? r.status : 0 }; const tx = await r.text(); const L = tx.split('\n'); const vs = [];
  L.forEach((l, i) => { if (l.startsWith('#EXT-X-STREAM-INF')) vs.push({ bw: +(/[:,]BANDWIDTH=(\d+)/.exec(l) || [])[1], res: (/RESOLUTION=(\d+x\d+)/.exec(l) || [])[1], fps: (/FRAME-RATE=([\d.]+)/.exec(l) || [])[1], codecs: (/CODECS="([^"]+)"/.exec(l) || [])[1], uri: (L[i + 1] || '').trim() }); });
  return { s: r.status, acao: r.headers.get('access-control-allow-origin'), vs }; };
const flat = (o, pre, acc) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) flat(o[k], pre ? pre + '.' + k : k, acc); else if (typeof o === 'string' && /^https?:/.test(o) && /\.(mp4|m3u8|mov|f4m|smil)|playlist|media/i.test(o)) acc[pre] = o; return acc; };
const want = p13.clips.filter(c => c.mp4);
const picks = [...want.filter(c => c.lk === 'nba' && c.dur < 30).slice(0, 4), ...want.filter(c => c.lk === 'ncaam').slice(0, 2), ...want.filter(c => c.lk === 'ncaaw').slice(0, 2), ...want.filter(c => /Highlight/i.test(c.type || '')).slice(0, 1)];
for (const c of picks) {
  const row = { id: c.id, lk: c.lk, h: String(c.h).slice(0, 50), dur: c.dur, ratio: c.ratio };
  let v9; try { v9 = JSON.parse(c.v916).href; } catch (e) { v9 = c.v916 || ''; }
  row.wideFile = probe(c.mp4);
  { const r = await T(c.mp4, { method: 'HEAD' }); row.wideHead = r ? { s: r.status, mb: Math.round((+r.headers.get('content-length') || 0) / 1e5) / 10, acao: r.headers.get('access-control-allow-origin'), ranges: r.headers.get('accept-ranges') } : null; }
  if (c.hlsHref) row.wideStream = await ladder(c.hlsHref);
  if (v9) row.upStream = await ladder(v9);
  // is there an upright file, or a bigger wide one, beside the one the app knows?
  const m = /\/media\/16x9\/(.+)\/([^/]+)\.mp4$/.exec(c.mp4); row.tries = {};
  if (m) { const base = 'https://espnmedia-cdn.akamaized.net/espn/media';
    const cand = { up_mp4: `${base}/9x16/${m[1]}/${m[2]}.mp4`, up_1080: `${base}/9x16/${m[1]}/${m[2]}_1080.mp4`, wide_1080p: `${base}/16x9/${m[1]}/${m[2]}_1080p30_5596k.mp4`, wide_720p: `${base}/16x9/${m[1]}/${m[2]}_720p30_2896k.mp4`, common_mp4: `${base}/common/${m[1]}/${m[2]}.mp4`, sq_mp4: `${base}/1x1/${m[1]}/${m[2]}.mp4`, v4x5: `${base}/4x5/${m[1]}/${m[2]}.mp4`,
      hls_1x1: `https://cmp-espn.media.dssott.com/opp/hls/espn/1x1/${m[1]}/${m[2]}/playlist.m3u8`, hls_4x5: `https://cmp-espn.media.dssott.com/opp/hls/espn/4x5/${m[1]}/${m[2]}/playlist.m3u8`, hls_16x9: `https://cmp-espn.media.dssott.com/opp/hls/espn/16x9/${m[1]}/${m[2]}/playlist.m3u8` };
    for (const k of Object.keys(cand)) { const r = await T(cand[k], { method: 'HEAD' }); row.tries[k] = r ? r.status : 0; if (r && r.ok && /mp4$/.test(cand[k])) row.tries[k + '_size'] = probe(cand[k]); if (r && r.ok && /m3u8$/.test(cand[k])) row.tries[k + '_levels'] = ((await ladder(cand[k])).vs || []).map(v => v.res + '@' + v.bw).join(' '); } }
  // every video address the clip's own record carries
  for (const u of [`https://content.core.api.espn.com/v1/video/clips/${c.id}`, `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news/${c.id}`]) { const r = await T(u); if (!r || !r.ok) { row['rec' + (u.includes('content.core') ? '' : '2')] = r ? r.status : 0; continue; } let j = null; try { j = await r.json(); } catch (e) {}
    const acc = flat(j, '', {}); const short = {}; Object.keys(acc).forEach(k => { if (/links|source|HLS|HD|mezz|video|stream/i.test(k)) short[k.replace(/^videos\.0\./, '')] = acc[k].replace(/^https?:\/\//, '').slice(0, 150); }); row[u.includes('content.core') ? 'rec' : 'rec2'] = short; }
  // the sharpest level of the wide stream, measured (not just what the list says)
  if (row.wideStream && row.wideStream.vs && row.wideStream.vs.length) { const top = [...row.wideStream.vs].sort((a, b) => b.bw - a.bw)[0]; row.wideTop = probe(new URL(top.uri, c.hlsHref).href); }
  if (row.upStream && row.upStream.vs && row.upStream.vs.length) { const top = [...row.upStream.vs].sort((a, b) => b.bw - a.bw)[0]; row.upTop = probe(new URL(top.uri, v9).href); }
  out.clips.push(row); console.log(row.id, JSON.stringify(row.wideFile), row.wideStream && row.wideStream.vs && row.wideStream.vs.map(v => v.res).join(','));
}
writeFileSync('pcl/st16.json', JSON.stringify(out, null, 1)); console.log('done', out.clips.length);
