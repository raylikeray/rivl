// Builds data/plays.json: the leagues' own "Top 10 Plays of the Night" (and the weekly roundup) from their official
// YouTube channels, newest first. YouTube's channel feed answers 404 to servers, so this reads the channel's own search
// page, where the list rides along as ytInitialData. Each video is checked with YouTube's oEmbed: one the owner won't let
// play on other sites is dropped, so whatever the app shows plays inside it.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const SRC = [
  { lk: 'nba', handle: 'NBA', q: 'top 10 plays of the night' },
  { lk: 'nba', handle: 'NBA', q: 'top plays of week' },
  { lk: 'wnba', handle: 'WNBA', q: 'top plays of the night' },
  { lk: 'ncaam', handle: 'marchmadness', q: 'top plays' },
  { lk: 'ncaaw', handle: 'NCAAW', q: 'top plays' }
];
const NIGHT = /top\s*(\d+)\s*plays\s*of\s*the\s*night/i, WEEK = /(top\s*\d*\s*plays\s*of\s*(the\s*)?week|plays of week \d+)/i;
async function get(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } }); if (r.ok) return r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1200 * (i + 1))); } return null; }
function initialData(html) { const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html || ''); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } }
function videos(d) {
  const out = []; const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; }
    const v = n.videoRenderer; if (v && v.videoId) { const t = (v.title && (v.title.runs || []).map(r => r.text).join('')) || (v.title && v.title.simpleText) || ''; out.push({ id: v.videoId, title: t, ago: (v.publishedTimeText || {}).simpleText || '', len: (v.lengthText || {}).simpleText || '' }); return; }
    Object.values(n).forEach(walk); };
  walk(d); return out;
}
const MONTHS = 'january february march april may june july august september october november december'.split(' ');
function dateOf(v, now) {
  const m = /([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(v.title); if (m && MONTHS.includes(m[1].toLowerCase())) return `${m[3]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const a = /(\d+)\s*(h|hour|d|day|w|week|mo|month|y|year)/i.exec(v.ago); if (!a) return '';
  const n = +a[1], u = a[2].toLowerCase(); const ms = u.startsWith('h') ? 36e5 : u.startsWith('d') ? 864e5 : u.startsWith('w') ? 7 * 864e5 : u.startsWith('mo') ? 30 * 864e5 : 365 * 864e5;
  return new Date(now - n * ms).toISOString().slice(0, 10);
}
async function embeddable(id) { try { const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, { headers: { 'user-agent': UA } }); return r.ok; } catch (e) { return true; } }

const now = Date.now(); const seen = new Set(); const items = [];
for (const s of SRC) {
  const html = await get(`https://www.youtube.com/@${s.handle}/search?query=${encodeURIComponent(s.q)}`);
  const list = videos(initialData(html)); let n = 0;
  for (const v of list) {
    if (seen.has(v.id)) continue;
    const night = NIGHT.exec(v.title), week = WEEK.test(v.title);
    if (!night && !week) continue;
    const d = dateOf(v, now); if (!d) continue;
    if (now - Date.parse(d + 'T12:00:00Z') > 21 * 864e5) continue;   // three weeks back is plenty
    seen.add(v.id); items.push({ lk: s.lk, id: v.id, title: v.title.trim(), date: d, kind: week ? 'week' : 'night', top: night ? +night[1] : null, len: v.len }); n++;
  }
  console.log(s.handle, s.q, 'found', list.length, 'kept', n);
}
const keep = [];
for (const it of items.sort((a, b) => b.date.localeCompare(a.date))) { if (await embeddable(it.id)) keep.push(it); else console.log('not embeddable', it.id, it.title); }
const old = existsSync('data/plays.json') ? JSON.parse(readFileSync('data/plays.json', 'utf8')) : null;
if (!keep.length && old && old.items && old.items.length) { console.log('nothing found this run; keeping the last file'); process.exit(0); }
writeFileSync('data/plays.json', JSON.stringify({ updated: new Date().toISOString(), items: keep }));
console.log('plays', keep.length, keep.slice(0, 3));
