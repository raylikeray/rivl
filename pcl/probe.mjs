// Probe 4: find the Rockets' and Valkyries' real channels from their recent uploads, then run the finished
// clips job end to end and keep its output, so the app ships with a real data/clips.json.
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
async function get(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } }); if (r.ok) return r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1200 * (i + 1))); } return null; }
function initialData(html) { const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html || ''); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } }
function findAll(d, key) { const out = []; const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; } if (n[key]) out.push(n[key]); Object.values(n).forEach(walk); }; walk(d); return out; }
const out = {};
for (const q of ['Houston Rockets highlights', 'Golden State Valkyries highlights']) {
  const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`);
  const d = initialData(html);
  const owners = [];
  findAll(d, 'videoRenderer').slice(0, 10).forEach(v => {
    const o = ((((v.ownerText || {}).runs || [])[0]) || {});
    const ch = ((((o.navigationEndpoint || {}).browseEndpoint) || {}).browseId) || '';
    const t = (v.title && (v.title.runs || []).map(r => r.text).join('')) || '';
    const badge = JSON.stringify(v.ownerBadges || '').includes('VERIFIED');
    owners.push({ owner: o.text || '', ch, badge, title: t.slice(0, 70), ago: (v.publishedTimeText || {}).simpleText || '' });
  });
  out[q] = owners; console.log(q, JSON.stringify(owners.slice(0, 6), null, 1));
}
writeFileSync('pcl/owners.json', JSON.stringify(out, null, 1));
// run the real job from the repo root so data/clips.json lands where the app reads it
try { console.log(execSync('node pcl/clips.mjs', { cwd: '.', encoding: 'utf8', stdio: 'pipe' })); } catch (e) { console.log('clips job failed', String(e.stdout || '') + String(e.stderr || e)); }
