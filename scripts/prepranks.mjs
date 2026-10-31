// Pulls PrepRanks basketball rankings for RIVL (personal use, with PrepRanks' permission).
// Runs on GitHub Actions once a day and writes data/recruits.json, which the app reads.
// Polite: a handful of pages per day, identified user agent, no images copied.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });

const UA = 'RIVL personal app (non-commercial, used with PrepRanks permission)';
const YEARS = [2027, 2028];
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
function detail(html, base) {
  const img = (html.match(new RegExp('<img[^>]+alt="' + base.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"]*"[^>]*>', 'i')) || [])[0] || '';
  const src = (img.match(/src="([^"]+)"/) || [])[1] || null;
  const t = clean(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' '));
  const m = re => (t.match(re) || [])[1] || null;
  const svc = {};
  for (const name of ['ON3', '247', 'Rivals', 'ESPN']) {
    const r = t.match(new RegExp('\\b' + name + ' (#\\s*\\d+|—) ([\\d.]+|—)'));
    if (r) svc[name] = { rank: r[1] === '—' ? null : +r[1].replace(/\D/g, ''), rating: r[2] === '—' ? null : +r[2] };
  }
  const cm = t.match(/● (Committed|Signed|Enrolled) (FLIP WATCH )?(.+?) since (\w+ \d{4})/);
  const title = x => x.replace(/\b\w/g, c => c.toUpperCase());
  const status = cm ? cm[1] : m(/(Uncommitted)(?= Top schools| Composite)/);
  const commitTo = cm ? title(cm[3].trim()) : null, commitSince = cm ? cm[4] : null, flip = !!(cm && cm[2]);
  return {
    ...base,
    pos: m(/POSITION (\S+)/) || base.pos,
    ht: m(/HT \/ WT (\d+'\d+")/) || m(/HT (\d+'\d+")/),
    wt: (m(/· ([\d.]+) lbs/) || '').replace(/\.00$/, '') || null,
    home: m(/HOMETOWN i (.+?) SCHOOL /),
    hs: m(/ SCHOOL (.+?) (?:[A-Z]{3,}(?: [A-Z]{2,})* )?MVI /) || m(/ SCHOOL (.+?) (?:REGION|PR SCORE)/),
    tier: m(/ ([A-Z]{3,}(?: [A-Z]{2,})*) MVI /),
    score: +(m(/PR SCORE ([\d.]+) \/ 100/) || 0) || null,
    rank: +(m(/# (\d+) National/) || 0) || base.rank,
    cons: +(m(/Consensus # (\d+)/) || 0) || null,
    posRank: m(/Consensus # \d+ · \S+ # (\d+)/),
    status,
    top: (m(/Top schools: (.+?) Composite/) || '').split(' · ').map(x => x.trim()).filter(Boolean),
    commitTo, commitSince, flip,
    svc, img: src,
    _st: status ? undefined : (t.match(/National Consensus[\s\S]{0,220}/) || [''])[0]
  };
}
const result = { updated: new Date().toISOString(), source: 'PrepRanks', url: 'https://prepranks.com', boys: {}, girls: {} };
for (const [g, sport] of Object.entries(SPORTS)) {
  for (const y of YEARS) {
    const url = `https://prepranks.com/${sport}/recruits/year/${y}`;
    try {
      const html = await get(url);
      debug[g + y] = { bytes: html.length };

      let list = fromNextData(html);
      list = list && list.length ? list.map(normNext) : fromHtml(html, sport, y);
      list = list.filter(r => r.n).sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 150);
      list.forEach((r, i) => { if (!r.rank) r.rank = i + 1; });
      for (let i = 0; i < Math.min(list.length, 60); i++) {
        try { list[i] = detail(await get('https://prepranks.com' + list[i].slug), list[i]); } catch (e) { list[i].err = String(e); }
        await sleep(900);
      }
      list.forEach(r => { delete r.ctx; });
      list.sort((a, b) => (a.rank || 999) - (b.rank || 999));
      result[g][y] = list;
      debug[g + y].count = list.length; debug[g + y].sample = list.slice(0, 2);
    } catch (e) { debug[g + y] = { error: String(e) }; }
    await sleep(1500);
  }
}
try { const s1 = (result.boys[2027] || [])[0]; if (s1) { const h = await get('https://prepranks.com' + s1.slug); debug.detailText = clean(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')).slice(0, 6000); } } catch (e) { debug.detailErr = String(e); }
debug.noStatus = [];
for (const g of ['boys', 'girls']) for (const y of Object.keys(result[g])) result[g][y].forEach(r => { if (r._st && debug.noStatus.length < 12) debug.noStatus.push(r.n + ' :: ' + r._st); delete r._st; });
writeFileSync('data/recruits.json', JSON.stringify(result));
writeFileSync('data/prepranks-debug.json', JSON.stringify(debug, null, 1));
console.log(JSON.stringify(debug, null, 1).slice(0, 4000));
