// Probe 3: the six channels in doubt. For each candidate: title, id, subscriber line, and the three newest uploads
// with their age texts, so the official channel is unmistakable.
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
async function get(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } }); if (r.ok) return r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1200 * (i + 1))); } return null; }
function initialData(html) { const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html || ''); if (!m) return null; try { return JSON.parse(m[1]); } catch (e) { return null; } }
function findAll(d, key) { const out = []; const walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; } if (n[key]) out.push(n[key]); Object.values(n).forEach(walk); }; walk(d); return out; }
function texts(n, out = []) { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach(x => texts(x, out)); return out; } if (typeof n.content === 'string') out.push(n.content); if (typeof n.simpleText === 'string') out.push(n.simpleText); Object.values(n).forEach(x => { if (x && typeof x === 'object') texts(x, out); }); return out; }
function vids(d) {
  return findAll(d, 'lockupViewModel').map(l => { const md = (((l.metadata || {}).lockupMetadataViewModel) || {});
    const title = ((md.title || {}).content) || '';
    const rows = texts(((md.metadata || {}).contentMetadataViewModel) || {});
    const ago = rows.find(t => /ago$/.test(t)) || rows.find(t => /^(Streamed|Scheduled)/.test(t)) || '';
    const len = (texts(l.contentImage || {}).find(t => /^\d+:\d{2}(:\d{2})?$/.test(t))) || '';
    return { id: l.contentId, title, ago, len }; }).filter(v => v.id && v.title);
}
const CAND = {
  'nba|Golden State Warriors': ['@warriors', '@GoldenStateWarriors', '@GSWarriors', 'channel/UCUi2obAF-jE0gXtGFhzQDrQ'],
  'nba|Miami Heat': ['@MiamiHEAT', '@heat', '@TheMiamiHeat', 'channel/UCi_KCPXC28s0LP1le0d_jvA'],
  'nba|Houston Rockets': ['@rockets', '@houstonrockets', 'channel/UChdTjGHWrl-scbthhYSGB3g'],
  'nba|Los Angeles Lakers': ['@Lakers', 'channel/UCXFArKhxvvccjoGZqqDJpbQ'],
  'nba|Boston Celtics': ['@celtics', 'channel/UCe4NAy5uDRk44tB-c6fYyDg'],
  'wnba|Golden State Valkyries': ['@valkyries', '@goldenstatevalkyries', '@GSValkyries', 'channel/UCSJRoRdznOH4VgmNhxof7Dw'],
  'wnba|Seattle Storm': ['@seattlestorm', '@SeattleStormOfficial', 'channel/UC8NTLY0hX2Mb0wdjxGhSITA']
};
const out = {};
for (const [team, cands] of Object.entries(CAND)) {
  out[team] = [];
  for (const c of cands) {
    const html = await get(`https://www.youtube.com/${c.replace(/^@/, '@')}/videos`); await new Promise(r => setTimeout(r, 350));
    const d = initialData(html); if (!d) { out[team].push({ c, miss: 1 }); continue; }
    const meta = findAll(d, 'channelMetadataRenderer')[0] || {};
    const all = texts(d); const subs = all.find(t => /subscribers$/.test(t)) || '';
    const verified = (html || '').includes('BADGE_STYLE_TYPE_VERIFIED') || (html || '').includes('CHECK_CIRCLE_FILLED') ? 1 : 0;
    const v = vids(d).slice(0, 3);
    out[team].push({ c, title: meta.title || '', id: meta.externalId || '', subs, verified, latest: v });
    console.log(team, c, '->', meta.title, subs, 'verified', verified, 'n', v.length, v[0] && v[0].title.slice(0, 60), v[0] && v[0].ago);
  }
}
writeFileSync('pcl/doubt.json', JSON.stringify(out, null, 1));
console.log('done');
