// Builds data/clips.json: each team's recent uploads from the team's own official YouTube channel, for the story
// bubbles on Home. Channel feeds answer 404 to servers, so this reads each channel's /videos tab, where the list rides
// along as ytInitialData (the 2026 layout carries videos as lockupViewModel entries). Channel ids were resolved and
// verified by hand against each channel's own page (probe branches, Nov 2026). Each new video is checked with YouTube's
// oEmbed so whatever the app shows plays inside it; results carry over run to run so old clips aren't rechecked.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const MAP = {
  nba: {
    'Atlanta Hawks': 'UCpfcwELvR1wtcRJ0UxNXHYw', 'Boston Celtics': 'UCMfT9dr6xC_RIWoA9hI0meQ', 'Brooklyn Nets': 'UCTenKHt0h3VjdMvRWP6Lbvw',
    'Charlotte Hornets': 'UCPhFI5lIFnSggz7HgY9UuuQ', 'Chicago Bulls': 'UCvZi1jVVZ2yq0k5kkjzmuGw', 'Cleveland Cavaliers': 'UCOdS-I1sYkKWhtTjMUWP_TA',
    'Dallas Mavericks': 'UCZywaCS_y9YOSSAC9z3dIeg', 'Denver Nuggets': 'UCl8hzdP5wVlhuzNG3WCJa1w', 'Detroit Pistons': 'UCtcSBo9EzOtXHxiPhU6RN8A',
    'Golden State Warriors': 'UCeYc_OjHs3QNxIjti2whKzg', 'Houston Rockets': '', 'Indiana Pacers': 'UCUQDCnAwU-35cOo8WCzg6zA',
    'LA Clippers': 'UCoK6pw3iIVF9WAWnQd3hj-g', 'Los Angeles Lakers': 'UC8CSt-oVqy8pUAoKSApTxQw', 'Memphis Grizzlies': 'UCCK5EpWKYrAmILfaZThCV-Q',
    'Miami Heat': 'UC8bZbiKoPNRi3taABIaFeBw', 'Milwaukee Bucks': 'UCRZDEVva3Z8h_Q0VetTgDUA', 'Minnesota Timberwolves': 'UCXWDN5NKVFgnPt25CMh98Cg',
    'New Orleans Pelicans': 'UCHvG7tf62PwI04ZRfoptRSw', 'New York Knicks': 'UC0hb8f0OXHEzDrJDUq-YVVw', 'Oklahoma City Thunder': 'UCpXdQhy6kb5CTD8hKlmOL3w',
    'Orlando Magic': 'UCxHFH-yfbhUrsWY4prPx3oQ', 'Philadelphia 76ers': 'UC5qJUyng_ezl0TVjVJFqtfQ', 'Phoenix Suns': 'UCLxlWVVHz2a8SdCfxzVXzQw',
    'Portland Trail Blazers': 'UCXk66yyzXo7-2M1BMqLhltQ', 'Sacramento Kings': 'UCSgFigczGdNMilV1K23JgUQ', 'San Antonio Spurs': 'UCEZHE-0CoHqeL1LGFa2EmQw',
    'Toronto Raptors': 'UCYBFE432C2AmNRDGEXE4uVg', 'Utah Jazz': 'UCv9iSdeI9IzWfV8yTDsMYWA', 'Washington Wizards': 'UChvzoBPvORuNGtHTMzjUsIQ'
  },
  wnba: {
    'Atlanta Dream': 'UCRNuFQZsMUcmp0o9sVxzaaQ', 'Chicago Sky': 'UClV7t67vIenYud872co7Z2Q', 'Connecticut Sun': 'UCdv3UUxlSXgkrWU_IGT8cKw',
    'Dallas Wings': 'UCp_qKS__cK3lqbS1B189K4w', 'Golden State Valkyries': 'UCtEb1qwyeIpdfx0kwulH74A', 'Indiana Fever': 'UC2FefohmBAtGBvZ8QHiy30A',
    'Las Vegas Aces': 'UCHRbuUvu9pVUQT6Fv9DGy_Q', 'Los Angeles Sparks': 'UCxhSLhRmf_3JDuOF4ezqMKQ', 'Minnesota Lynx': 'UC3rZAG71b0xSrWdn6NCvbkQ',
    'New York Liberty': 'UCWSENPwIesalIOfEdwTGZlw', 'Phoenix Mercury': 'UCcjwUjOqddcuhf813plJJPg', 'Portland Fire': 'UChRPulEHWRKS8RC0OcGrEqw',
    'Seattle Storm': 'UCv4xLXLA_aElluuaTWXN1jA', 'Toronto Tempo': 'UCz0TK83I5Lv69Ou0zxb0EpQ', 'Washington Mystics': 'UCRha9IKwKJc3i4fZdstGsvQ'
  }
};
const ESPN = { nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba', wnba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba' };

async function get(url, json) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } }); if (r.ok) return json ? r.json() : r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1200 * (i + 1))); } return null; }
function initialData(html) { const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html || ''); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } }
function findAll(d, key) { const out = []; const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; } if (n[key]) out.push(n[key]); Object.values(n).forEach(walk); }; walk(d); return out; }
function texts(n, out = []) { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach(x => texts(x, out)); return out; } if (typeof n.content === 'string') out.push(n.content); if (typeof n.simpleText === 'string') out.push(n.simpleText); Object.values(n).forEach(x => { if (x && typeof x === 'object') texts(x, out); }); return out; }
function channelVideos(d) {
  return findAll(d, 'lockupViewModel').map(l => {
    const md = ((l.metadata || {}).lockupMetadataViewModel) || {};
    const title = ((md.title || {}).content) || '';
    const rows = texts((md.metadata || {}).contentMetadataViewModel || {});
    const ago = rows.find(t => /\bago$/.test(t)) || '';
    const len = texts(l.contentImage || {}).find(t => /^\d+:\d{2}(:\d{2})?$/.test(t)) || '';
    return { id: l.contentId, title: title.trim(), ago, len };
  }).filter(v => v.id && v.title && v.ago);
}
// "16h ago", "2d ago", "3w ago", "45m ago", "2mo ago", also the written-out forms
function dateOf(ago, now) {
  const m = /(\d+)\s*(second|minute|hour|day|week|month|year|mo|[smhdwy])/i.exec(ago); if (!m) return '';
  const n = +m[1]; let u = m[2].toLowerCase(); if (u === 'mo') u = 'month';
  const ms = { s: 1e3, second: 1e3, m: 6e4, minute: 6e4, h: 36e5, hour: 36e5, d: 864e5, day: 864e5, w: 7 * 864e5, week: 7 * 864e5, month: 30 * 864e5, y: 365 * 864e5, year: 365 * 864e5 }[u];
  return ms ? new Date(now - n * ms).toISOString().slice(0, 10) : '';
}
async function embeddable(id) { try { const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, { headers: { 'user-agent': UA } }); return r.ok; } catch (e) { return true; } }

const now = Date.now();
const old = existsSync('data/clips.json') ? JSON.parse(readFileSync('data/clips.json', 'utf8')) : null;
const known = new Set(); (old && Object.values(old.teams || {}) || []).forEach(t => (t.clips || []).forEach(c => known.add(c.id)));
const teams = {}; let pages = 0, kept = 0;
for (const lk of Object.keys(MAP)) {
  const td = await get(`${ESPN[lk]}/teams?limit=60`, 1);
  const list = (((((td || {}).sports || [])[0] || {}).leagues || [])[0] || {}).teams || [];
  const idOf = {}; list.forEach(x => { const t = x.team || {}; idOf[t.displayName] = String(t.id); });
  for (const [name, ch] of Object.entries(MAP[lk])) {
    if (!ch) continue;
    const tid = idOf[name]; if (!tid) { console.log(lk, name, 'no ESPN id'); continue; }
    const key = `${lk}:${tid}`;
    const html = await get(`https://www.youtube.com/channel/${ch}/videos`); pages++;
    await new Promise(r => setTimeout(r, 300));
    const vids = channelVideos(initialData(html));
    if (!vids.length) { if (old && old.teams && old.teams[key]) teams[key] = old.teams[key]; console.log(lk, name, 'no videos read' + (teams[key] ? ', kept last' : '')); continue; }
    const fresh = [];
    for (const v of vids) {
      if (fresh.length >= 6) break;
      const date = dateOf(v.ago, now); if (!date || now - Date.parse(date + 'T12:00:00Z') > 10 * 864e5) continue;
      if (!known.has(v.id) && !(await embeddable(v.id))) { console.log('not embeddable', v.id, v.title.slice(0, 50)); continue; }
      fresh.push({ id: v.id, title: v.title, date, len: v.len });
    }
    if (fresh.length) { teams[key] = { n: name, clips: fresh }; kept += fresh.length; }
    else if (old && old.teams && old.teams[key]) { const kd = (old.teams[key].clips || []).filter(c => now - Date.parse(c.date + 'T12:00:00Z') <= 10 * 864e5); if (kd.length) teams[key] = { n: name, clips: kd }; }
  }
}
if (!Object.keys(teams).length && old && Object.keys(old.teams || {}).length) { console.log('nothing read this run; keeping the last file'); process.exit(0); }
writeFileSync('data/clips.json', JSON.stringify({ updated: new Date().toISOString(), teams }));
console.log('clips: teams', Object.keys(teams).length, 'clips', kept, 'pages', pages);
