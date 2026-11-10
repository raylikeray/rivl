// Probe 15: the full list of renditions inside the upright stream, for a spread of clips, and how the pieces are served.
import { writeFileSync, readFileSync } from 'node:fs';
const p13 = JSON.parse(readFileSync('pcl/st13.json', 'utf8')); const out = [];
const pick = [...p13.clips.filter(c => c.v916 && c.lk === 'nba').slice(0, 4), ...p13.clips.filter(c => c.v916 && c.lk === 'ncaaw').slice(0, 3), ...p13.clips.filter(c => c.v916 && c.lk === 'ncaam').slice(0, 3)];
for (const c of pick) { let u; try { u = JSON.parse(c.v916).href; } catch (e) { u = c.v916; }
  const r = await fetch(u); const tx = await r.text(); const L = tx.split('\n'); const vs = [];
  L.forEach((l, i) => { if (l.startsWith('#EXT-X-STREAM-INF')) vs.push({ bw: +(/BANDWIDTH=(\d+)/.exec(l) || [])[1], avg: +(/AVERAGE-BANDWIDTH=(\d+)/.exec(l) || [])[1], res: (/RESOLUTION=(\d+x\d+)/.exec(l) || [])[1], fps: (/FRAME-RATE=([\d.]+)/.exec(l) || [])[1], uri: L[i + 1] }); });
  const row = { h: c.h.slice(0, 40), dur: c.dur, cc: r.headers.get('cache-control'), vs };
  const best = vs[vs.length - 1]; if (best) { const cu = new URL(best.uri, u).href; const cr = await fetch(cu); const ct = await cr.text(); const segs = ct.split('\n').filter(l => l && !l.startsWith('#')); row.child = { cc: cr.headers.get('cache-control'), acao: cr.headers.get('access-control-allow-origin'), n: segs.length, durs: ct.split('\n').filter(l => l.startsWith('#EXTINF')).map(l => l.slice(8, 13)).join(' ') };
    const sr = await fetch(new URL(segs[0], cu).href); const b = await sr.arrayBuffer(); row.seg0 = { s: sr.status, kb: Math.round(b.byteLength / 1024), cc: sr.headers.get('cache-control'), acao: sr.headers.get('access-control-allow-origin'), type: sr.headers.get('content-type') }; }
  out.push(row); }
writeFileSync('pcl/st15.json', JSON.stringify(out)); console.log('done', out.length);
