// One-shot probe: resolve each NBA/WNBA team's official YouTube channel via the search page,
// then dump the structure of one channel's /videos and /shorts tabs so the real parser can be written.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('pcl', { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
async function get(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } }); if (r.ok) return r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1200 * (i + 1))); } return null; }
function initialData(html) { const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html || ''); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } }
function findAll(d, key) { const out = []; const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; } if (n[key]) out.push(n[key]); Object.values(n).forEach(walk); }; walk(d); return out; }

const NBA = ['Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers', 'LA Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards'];
const WNBA = ['Atlanta Dream', 'Chicago Sky', 'Connecticut Sun', 'Dallas Wings', 'Golden State Valkyries', 'Indiana Fever', 'Las Vegas Aces', 'Los Angeles Sparks', 'Minnesota Lynx', 'New York Liberty', 'Phoenix Mercury', 'Portland Fire', 'Seattle Storm', 'Toronto Tempo', 'Washington Mystics'];

const res = { nba: {}, wnba: {} };
async function resolve(lk, name) {
  const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(name)}&sp=EgIQAg%253D%253D`);
  const chans = findAll(initialData(html), 'channelRenderer').slice(0, 3).map(c => ({
    id: c.channelId,
    title: (c.title && c.title.simpleText) || '',
    handle: (((c.subscriberCountText || {}).simpleText) || ''),   // on new layouts this line holds the @handle
    subs: (((c.videoCountText || {}).simpleText) || ((c.videoCountText || {}).runs || []).map(r => r.text).join('')),
    badge: JSON.stringify(c.ownerBadges || '').includes('VERIFIED') ? 'verified' : ''
  }));
  res[lk][name] = chans;
  console.log(lk, name, '->', chans[0] && chans[0].title, chans[0] && chans[0].id, chans[0] && chans[0].badge);
  await new Promise(r => setTimeout(r, 400));
}
for (const n of NBA) await resolve('nba', n);
for (const n of WNBA) await resolve('wnba', n);
writeFileSync('pcl/channels.json', JSON.stringify(res, null, 1));

// structure samples from one strong channel (Lakers) and one WNBA channel
const sample = {};
const lal = (res.nba['Los Angeles Lakers'] || [])[0];
const fev = (res.wnba['Indiana Fever'] || [])[0];
for (const [tag, ch] of [['lal', lal], ['fever', fev]]) {
  if (!ch) continue;
  for (const tab of ['videos', 'shorts']) {
    const html = await get(`https://www.youtube.com/channel/${ch.id}/${tab}`);
    const d = initialData(html);
    const vids = findAll(d, 'videoRenderer').slice(0, 3).map(v => ({ id: v.videoId, title: (v.title && (v.title.runs || []).map(r => r.text).join('')) || (v.title || {}).simpleText, ago: (v.publishedTimeText || {}).simpleText, len: (v.lengthText || {}).simpleText }));
    const lock = findAll(d, 'shortsLockupViewModel').slice(0, 2);
    const reel = findAll(d, 'reelItemRenderer').slice(0, 2).map(v => ({ id: v.videoId, head: (v.headline || {}).simpleText }));
    sample[`${tag}-${tab}`] = { videoRenderer: vids, nVideo: findAll(d, 'videoRenderer').length, shortsLockup: lock, nLock: findAll(d, 'shortsLockupViewModel').length, reel, nReel: findAll(d, 'reelItemRenderer').length };
    console.log(tag, tab, 'videoRenderer', sample[`${tag}-${tab}`].nVideo, 'lockup', sample[`${tag}-${tab}`].nLock, 'reel', sample[`${tag}-${tab}`].nReel);
  }
}
writeFileSync('pcl/samples.json', JSON.stringify(sample, null, 1));
console.log('done');
