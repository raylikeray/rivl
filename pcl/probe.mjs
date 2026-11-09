// Probe 2: settle the final team -> channel map (verified against each channel's own page), and dump the
// new lockupViewModel structures the /videos and /shorts tabs use now, plus a short's watch page for its date.
import { writeFileSync, readFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
async function get(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } }); if (r.ok) return r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1200 * (i + 1))); } return null; }
function initialData(html) { const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html || ''); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } }
function findAll(d, key) { const out = []; const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; } if (n[key]) out.push(n[key]); Object.values(n).forEach(walk); }; walk(d); return out; }
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ok = (title, full, nick, verified) => norm(title).includes(norm(full)) || (verified && norm(title).includes(norm(nick)));

const prev = JSON.parse(readFileSync('pcl/channels.json', 'utf8'));
const HANDLES = {
  'Houston Rockets': ['HoustonRockets', 'rockets'], 'Philadelphia 76ers': ['sixers', 'Philadelphia76ers'],
  'Golden State Warriors': ['warriors', 'GoldenStateWarriors'], 'Miami Heat': ['MiamiHeat', 'MiamiHEAT'],
  'Golden State Valkyries': ['valkyries', 'GSValkyries', 'goldenstatevalkyries'], 'Boston Celtics': ['celtics'],
  'Los Angeles Lakers': ['Lakers', 'losangeleslakers'], 'Seattle Storm': ['seattlestorm', 'TheSeattleStorm']
};
const nickOf = n => n.split(' ').slice(-1)[0] === 'Blazers' ? 'Trail Blazers' : n.split(' ').slice(-1)[0];

const map = {}, probs = [], samples = {};
async function checkPage(url) {
  const html = await get(url); const d = initialData(html); if (!d) return null;
  const meta = findAll(d, 'channelMetadataRenderer')[0] || {};
  const locks = findAll(d, 'lockupViewModel'); const shorts = findAll(d, 'shortsLockupViewModel');
  return { title: meta.title || '', id: meta.externalId || '', n: locks.length, nS: shorts.length, locks, d };
}
for (const lk of ['nba', 'wnba']) {
  for (const [name, cands] of Object.entries(prev[lk])) {
    const nick = nickOf(name);
    let hit = null;
    // candidates from the search probe first, cleanest match wins
    for (const c of cands || []) { if (c && c.id && ok(c.title, name, nick, c.badge === 'verified')) { hit = { id: c.id.trim(), via: 'search', t: c.title }; break; } }
    const tries = [];
    if (hit) tries.push(`https://www.youtube.com/channel/${hit.id}/videos`);
    for (const h of HANDLES[name] || []) tries.push(`https://www.youtube.com/@${h}/videos`);
    tries.push(`https://www.youtube.com/@${norm(name)}/videos`, `https://www.youtube.com/@${norm(nick)}/videos`);
    let done = false;
    for (const u of tries) {
      const p = await checkPage(u); await new Promise(r => setTimeout(r, 350));
      if (!p || !p.id) continue;
      if (!ok(p.title, name, nick, true)) { continue; }
      map[`${lk}|${name}`] = { id: p.id, title: p.title, videos: p.n, shorts: p.nS, via: u.includes('/channel/') ? 'search' : 'handle' };
      console.log(lk, name, '->', p.title, p.id, 'videos', p.n);
      if (!samples.lock && p.locks.length) samples.lock = p.locks.slice(0, 2);
      done = true; break;
    }
    if (!done) { probs.push(`${lk}|${name}`); console.log(lk, name, 'UNRESOLVED'); }
  }
}
writeFileSync('pcl/map.json', JSON.stringify({ map, probs }, null, 1));

// structure deep-dive on one strong channel: Fever videos + shorts, and one short watch page for its date
const fv = await checkPage('https://www.youtube.com/channel/UC2FefohmBAtGBvZ8QHiy30A/videos');
if (fv) samples.feverVideos = fv.locks.slice(0, 2);
const sh = await get('https://www.youtube.com/channel/UC2FefohmBAtGBvZ8QHiy30A/shorts');
const shd = initialData(sh); const sls = findAll(shd, 'shortsLockupViewModel');
samples.feverShort = sls[0] || null;
const sid = sls.length ? ((sls[0].onTap || {}).innertubeCommand || {}).reelWatchEndpoint?.videoId || String(sls[0].entityId || '').replace('shorts-shelf-item-', '') : 'cdwYGfq9MTw';
const w = await get(`https://www.youtube.com/watch?v=${sid}`);
samples.shortWatch = { id: sid, uploadDate: (/"uploadDate":"([^"]+)"/.exec(w || '') || [])[1] || '', publishDate: (/"publishDate":"([^"]+)"/.exec(w || '') || [])[1] || '' };
const oe = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + sid)}&format=json`, { headers: { 'user-agent': UA } });
samples.shortOembed = oe.status;
writeFileSync('pcl/samples2.json', JSON.stringify(samples, null, 1));
console.log('done. unresolved:', probs.join(', ') || 'none');
