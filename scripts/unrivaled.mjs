// Builds data/unrivaled.json from Unrivaled's public schedule page (the women's 3-on-3 league that plays in the WNBA
// offseason). The page is a Next.js app whose data rides along in the HTML as React "flight" lines; this reads those
// lines, finds each game (a link to /game/<id>) under its date and arena, and keeps the words and numbers shown for it:
// the tip time, the teams once they're set, and the score once it's played. Runs a few times a day; one page per run.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const B = 'https://www.unrivaled.basketball';
async function page(path) {
  for (let i = 0; i < 3; i++) { try { const r = await fetch(B + path, { headers: { 'user-agent': 'RIVL personal app (schedule reader)' } }); if (r.ok) return r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  return null;
}
// the flight payload: self.__next_f.push([1,"..."]) chunks joined, then "id:json" lines
function flight(html) {
  const parts = []; const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g; let m;
  while ((m = re.exec(html))) { try { parts.push(JSON.parse('"' + m[1] + '"')); } catch (e) {} }
  const text = parts.join(''), rows = {};
  for (const line of text.split('\n')) { const k = line.indexOf(':'); if (k < 1 || k > 6) continue; const id = line.slice(0, k), body = line.slice(k + 1);
    if (!/^[0-9a-f]+$/.test(id)) continue; if (body[0] !== '[' && body[0] !== '{') continue; try { rows[id] = JSON.parse(body); } catch (e) {} }
  return rows;
}
function build(html) {
  const rows = flight(html);
  const deref = v => (typeof v === 'string' && /^\$L?[0-9a-f]+$/.test(v) && rows[v.replace(/^\$L?/, '')] !== undefined) ? rows[v.replace(/^\$L?/, '')] : v;
  // every piece of text and every image's alt under a node, in order
  const words = (n, out = [], seen = new Set()) => { n = deref(n);
    if (n == null || n === false) return out; if (typeof n === 'string') { if (!n.startsWith('$')) out.push(n); return out; } if (typeof n === 'number') { out.push(String(n)); return out; }
    if (typeof n !== 'object' || seen.has(n)) return out; seen.add(n);
    if (Array.isArray(n)) { if (n[0] === '$' && n.length >= 4 && n[3] && typeof n[3] === 'object') { const p = n[3]; if (p.alt) out.push('@' + p.alt); if (p.src && /teams\//.test(p.src)) out.push('#' + p.src); words(p.children, out, seen); return out; } n.forEach(x => words(x, out, seen)); return out; }
    if (n.children !== undefined) words(n.children, out, seen); return out; };
  // clubs (name, slug, logo) from the team filter on the page
  const clubs = {}; const scanClubs = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n.teams) && n.teams[0] && n.teams[0].slug) n.teams.forEach(t => { clubs[t.name] = { name: t.name, slug: t.slug, logo: t.logo ? `${B}/${String(t.logo).replace(/^\//, '')}` : null }; }); (Array.isArray(n) ? n : Object.values(n)).forEach(scanClubs); };
  Object.values(rows).forEach(scanClubs);
  const games = [], seenG = new Set();
  const DATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{2}, \d{4}$/;
  // walk with context: the latest date heading and arena seen above a game
  const walk = (n, ctx, seen = new Set()) => { n = deref(n); if (!n || typeof n !== 'object' || seen.has(n)) return; seen.add(n);
    if (Array.isArray(n) && n[0] === '$' && n[3] && typeof n[3] === 'object') {
      const p = n[3];
      if (typeof p.href === 'string' && /^\/game\/[a-z0-9]+$/.test(p.href)) { const id = p.href.split('/').pop(); if (!seenG.has(id)) { seenG.add(id); games.push({ id, ...ctx.cur, w: words(p.children) }); } return; }
      // a date block: its first text is the date, then arena and city
      const w = words(p.children).slice(0, 8); const di = w.findIndex(x => DATE.test(x));
      if (di === 0 && (w[1] || ctx.cur.date !== w[0])) { ctx.cur = { date: w[0], arena: w[1] || '', city: [w[2], w[3], w[4]].filter(x => x && x !== ', ').join(', ').replace(/, ,/g, ',') }; }
      walk(p.children, ctx, seen); return; }
    (Array.isArray(n) ? n : Object.values(n)).forEach(x => walk(x, ctx, seen)); };
  const ctx = { cur: {} }; Object.keys(rows).sort((a, b) => parseInt(a, 16) - parseInt(b, 16)).forEach(k => walk(rows[k], ctx));
  const names = Object.keys(clubs);
  return { clubs: Object.values(clubs), games: games.map(g => {
    const w = g.w.filter(x => x.trim() && x !== ' '); const time = (w.find(x => /^\d{1,2}:\d{2} (AM|PM)$/.test(x)) || '');
    const teams = []; w.forEach(x => { const nm = names.find(n => x === n || x === '@' + n + ' logo' || x === '@' + n); if (nm && !teams.includes(nm)) teams.push(nm); });
    const nums = w.filter(x => /^\d{1,3}$/.test(x)).map(Number);
    const tv = w.filter(x => /^@.* logo$/.test(x) && !names.some(n => x.startsWith('@' + n))).map(x => x.slice(1, -5));
    const kind = w.find(x => /Season|Playoff|Semifinal|Final|Championship|1-on-1|Tournament/i.test(x)) || '';
    const final = w.some(x => /^Final$/i.test(x));
    return { id: g.id, date: g.date || '', arena: g.arena || '', city: g.city || '', time, tz: 'ET', teams, score: final && nums.length >= 2 ? nums.slice(-2) : null, final, tv, kind };
  }) };
}
const html = await page('/schedule');
if (!html) { console.log('schedule page did not answer; keeping the last file'); process.exit(0); }
const d = build(html);
const out = { updated: new Date().toISOString(), source: 'Unrivaled', url: B + '/schedule', ...d };
if (!out.games.length) { console.log('no games found; keeping the last file'); process.exit(0); }
writeFileSync('data/unrivaled.json', JSON.stringify(out));
console.log('games', out.games.length, 'clubs', out.clubs.length); console.log(JSON.stringify(out.games.slice(0, 4), null, 1)); console.log(JSON.stringify(out.games.slice(-2), null, 1));
