// Probe 8: how deep do Unrivaled's own pages go? Player page, a played game's box score, a club's stats tab.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('pcl/unr', { recursive: true });
const B = 'https://www.unrivaled.basketball';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const get = async p => { for (let i = 0; i < 3; i++) { try { const r = await fetch(B + p, { headers: { 'user-agent': UA } }); if (r.ok) return r.text(); if (r.status === 404) return ''; } catch (e) {} await new Promise(r => setTimeout(r, 1200)); } return ''; };
const flight = html => { const parts = []; const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g; let m; while ((m = re.exec(html))) { try { parts.push(JSON.parse('"' + m[1] + '"')); } catch (e) {} } return parts.join(''); };
const out = {};
for (const [k, p] of Object.entries({ player: '/player/alyssa-thomas-0ehynljdh7k1', player2: '/player/brittney-sykes-5r0ujro9gsjp', box: '/game/9r3c2rtv1a4b/box-score', game: '/game/9r3c2rtv1a4b', gameNext: '/game/adp89x8e4pe4', clubStats: '/laces/stats', clubSched: '/laces/schedule', clubRoster: '/laces/roster', bracket: '/bracket', oneonone: '/1v1', playoffs: '/playoffs' })) {
  const h = await get(p); const t = flight(h);
  const strs = []; const re = /"children":"([^"$]{1,80})"/g; let m; while ((m = re.exec(t))) strs.push(m[1]);
  const title = (/<title>(.*?)<\/title>/.exec(h) || [])[1] || '';
  const blobs = []; const jr = /\{"(?:player|game|boxScore|stats|team|players|seasons)":/g; let j; while ((j = jr.exec(t)) && blobs.length < 3) blobs.push(t.slice(j.index, j.index + 1500));
  out[k] = { path: p, len: h.length, title, n: strs.length, strs: strs.slice(0, 400), blobs };
  console.log(k, h.length, title, strs.length);
  await new Promise(r => setTimeout(r, 500));
}
writeFileSync('pcl/unr/depth.json', JSON.stringify(out, null, 1)); console.log('done');
