// Pulls PrepRanks basketball rankings for RIVL (personal use, with PrepRanks' permission).
// Runs on GitHub Actions once a day and writes data/recruits.json, which the app reads.
// Polite: a handful of pages per day, identified user agent, no images copied.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });

const UA = 'RIVL personal app (non-commercial, used with PrepRanks permission)';
const YEARS = [2027, 2028, 2029];
const SPORTS = { boys: 'basketball', girls: 'womens-basketball' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debug = {};

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.text();
}
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// 1) Next.js pages carry their data as JSON; find recruit-like objects anywhere in it.
function fromNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data; try { data = JSON.parse(m[1]); } catch { return null; }
  const out = [];
  const seen = new Set();
  (function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 14) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
    const name = o.fullName || o.name || (o.firstName && o.lastName ? o.firstName + ' ' + o.lastName : null);
    const rank = o.nationalRank ?? o.rank ?? o.overallRank ?? o.prepRanksRank ?? o.consensusRank;
    if (typeof name === 'string' && rank != null && !seen.has(name)) { seen.add(name); out.push(o); }
    Object.values(o).forEach(v => walk(v, depth + 1));
  })(data.props || data, 0);
  debug.nextKeys = debug.nextKeys || (out[0] ? Object.keys(out[0]) : Object.keys(data.props?.pageProps || {}));
  return out;
}
function pick(o, keys) { for (const k of keys) { const v = k.split('.').reduce((a, p) => (a == null ? a : a[p]), o); if (v != null && v !== '') return v; } return null; }
function normNext(o) {
  return {
    n: pick(o, ['fullName', 'name']) || [o.firstName, o.lastName].filter(Boolean).join(' '),
    rank: Number(pick(o, ['nationalRank', 'rank', 'overallRank', 'prepRanksRank'])) || null,
    cons: Number(pick(o, ['consensusRank', 'consensus.rank'])) || null,
    score: pick(o, ['prepRanksScore', 'score', 'rating', 'compositeScore']),
    pos: pick(o, ['position', 'positionAbbreviation', 'pos', 'position.abbr']),
    ht: pick(o, ['height', 'heightFormatted']), wt: pick(o, ['weight']),
    hs: pick(o, ['highSchool', 'highSchoolName', 'school', 'highSchool.name', 'school.name']),
    home: pick(o, ['hometown', 'city', 'location']) ,
    st: pick(o, ['state', 'stateAbbreviation', 'highSchool.state']),
    commit: pick(o, ['committedTo', 'commitment', 'committedSchool', 'commit.name', 'committedTo.name']),
    tier: pick(o, ['tier', 'tierLabel']),
    slug: pick(o, ['slug', 'url', 'path'])
  };
}
// 2) Fallback: read recruit links and the text around them.
function fromHtml(html, sport, year) {
  const out = []; const re = new RegExp('<a[^>]+href="(/' + sport + '/recruits/([a-z0-9-]+)-(' + year + '))/?"[^>]*>([\\s\\S]*?)</a>', 'g');
  let m; const seen = new Set();
  while ((m = re.exec(html))) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    const text = clean(m[4]);
    const after = clean(html.slice(re.lastIndex, re.lastIndex + 600));
    const before = clean(html.slice(Math.max(0, m.index - 300), m.index));
    const rank = (before.match(/(\d{1,3})\s*$/) || [])[1];
    out.push({ n: text || m[2].replace(/-/g, ' '), rank: rank ? +rank : null, slug: m[1], ctx: after.slice(0, 160) });
  }
  return out;
}
const result = { updated: new Date().toISOString(), source: 'PrepRanks', url: 'https://prepranks.com', boys: {}, girls: {} };
for (const [g, sport] of Object.entries(SPORTS)) {
  for (const y of YEARS) {
    const url = `https://prepranks.com/${sport}/recruits/year/${y}`;
    try {
      const html = await get(url);
      debug[g + y] = { bytes: html.length, hasNext: html.includes('__NEXT_DATA__'), head: html.slice(0, 400).replace(/\s+/g, ' ') };
      let list = fromNextData(html);
      list = list && list.length ? list.map(normNext) : fromHtml(html, sport, y);
      list = list.filter(r => r.n).sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 150);
      result[g][y] = list;
      debug[g + y].count = list.length; debug[g + y].sample = list.slice(0, 3);
    } catch (e) { debug[g + y] = { error: String(e) }; }
    await sleep(1500);
  }
}
writeFileSync('data/recruits.json', JSON.stringify(result));
writeFileSync('data/prepranks-debug.json', JSON.stringify(debug, null, 1));
console.log(JSON.stringify(debug, null, 1).slice(0, 4000));
