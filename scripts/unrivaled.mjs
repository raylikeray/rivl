// Builds data/unrivaled.json from Unrivaled's public site (the women's 3-on-3 league that plays in the WNBA offseason).
// The pages are a Next.js app whose data rides along in the HTML as React "flight" lines. From /schedule this reads each
// night (an <article id="night-YYYY-MM-DD">: the date, the stop's name, arena, city and TV) and the games under it (the two
// clubs, the tip time in Eastern, the score once it's final). From /players it reads every club's roster with headshots.
// v436: rewritten for the 2027 site (the old reader found the game links but no dates, teams or times any more).
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const B = 'https://www.unrivaled.basketball';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function page(path) {
  if (process.env.UNR_DIR) { const f = `${process.env.UNR_DIR}/${path.replace(/^\//, '') || 'index'}.html`; return existsSync(f) ? readFileSync(f, 'utf8') : null; }   // offline test
  for (let i = 0; i < 3; i++) { try { const r = await fetch(B + path, { headers: { 'user-agent': UA } }); if (r.ok) return r.text(); } catch (e) {} await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  return null;
}
function flightText(html) {
  const parts = []; const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g; let m;
  while ((m = re.exec(html))) { try { parts.push(JSON.parse('"' + m[1] + '"')); } catch (e) {} }
  return parts.join('');
}
function flightRows(text) {
  const rows = {};
  for (const line of text.split('\n')) { const k = line.indexOf(':'); if (k < 1 || k > 6) continue; const id = line.slice(0, k), body = line.slice(k + 1);
    if (!/^[0-9a-f]+$/.test(id)) continue; if (body[0] !== '[' && body[0] !== '{') continue; try { rows[id] = JSON.parse(body); } catch (e) {} }
  return rows;
}
const isEl = n => Array.isArray(n) && n[0] === '$' && n.length >= 4 && n[3] && typeof n[3] === 'object';
const cls = n => isEl(n) ? String(n[3].className || '') : '';
function tools(rows) {
  const deref = v => (typeof v === 'string' && /^\$L?[0-9a-f]+$/.test(v) && rows[v.replace(/^\$L?/, '')] !== undefined) ? rows[v.replace(/^\$L?/, '')] : v;
  const kids = n => { n = deref(n); if (isEl(n)) return [deref(n[3].children)]; if (Array.isArray(n)) return n.map(deref); return []; };
  const text = (n, out = []) => { n = deref(n); if (n == null || n === false) return out; if (typeof n === 'string') { if (!n.startsWith('$')) out.push(n); return out; } if (typeof n === 'number') { out.push(String(n)); return out; }
    if (isEl(n)) { if (n[1] === 'img' || /\$L/.test(String(n[1]))) { if (n[3].alt) out.push('@' + n[3].alt); } text(n[3].children, out); return out; } if (Array.isArray(n)) n.forEach(x => text(x, out)); return out; };
  const find = (n, pred, out = [], seen = new Set()) => { n = deref(n); if (!n || typeof n !== 'object' || seen.has(n)) return out; seen.add(n);
    if (isEl(n) && pred(n)) { out.push(n); return out; } kids(n).forEach(x => find(x, pred, out, seen)); if (!isEl(n) && !Array.isArray(n)) Object.values(n).forEach(x => find(x, pred, out, seen)); return out; };
  return { deref, text, find };
}
// the venue's local tip time (the page shows it as "7:00 PM PT") to a UTC instant, daylight time included
const TZ = { ET: 'America/New_York', CT: 'America/Chicago', MT: 'America/Denver', PT: 'America/Los_Angeles' };
function utcOf(ymd, h, m, tz) {
  const guess = new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess).reduce((o, x) => (o[x.type] = x.value, o), {});
  const off = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - guess.getTime(); return new Date(guess.getTime() - off).toISOString();
}
function schedule(html) {
  const rows = flightRows(flightText(html)); const { text, find } = tools(rows);
  // clubs from the team filter
  const clubs = {}; const scan = (n, seen = new Set()) => { if (!n || typeof n !== 'object' || seen.has(n)) return; seen.add(n); if (Array.isArray(n.teams) && n.teams[0] && n.teams[0].slug) n.teams.forEach(t => { if (t.name) clubs[t.name] = { name: t.name, slug: t.slug }; }); (Array.isArray(n) ? n : Object.values(n)).forEach(x => scan(x, seen)); };
  Object.values(rows).forEach(r => scan(r));
  const nights = []; Object.keys(rows).sort((a, b) => parseInt(a, 16) - parseInt(b, 16)).forEach(k => find(rows[k], n => n[1] === 'article' && /^night-\d{4}-\d{2}-\d{2}/.test(String(n[3].id || '')), nights));
  const seenN = new Set(), games = [];
  for (const a of nights) {
    const nid = String(a[3].id); if (seenN.has(nid)) continue; seenN.add(nid);
    const ymd = nid.slice(6, 16);
    const one = (re) => { const e = find(a, n => re.test(cls(n)))[0]; return e ? text(e).filter(x => x.trim()) : []; };
    const name = one(/styles_name__/).join(' ').trim(); const kicker = one(/styles_kicker__/).join(' ').trim();
    const venue = find(a, n => /styles_venue__/.test(cls(n)))[0]; const vw = venue ? text(venue).filter(x => x.trim() && x.trim() !== ',') : [];
    let arena = (one(/styles_venuePlace__/)[0] || vw[0] || '').trim(); let city = vw.filter(x => x !== arena).map(x => x.trim()).filter(Boolean).join(', ').replace(/,\s*,/g, ',');
    if (!kicker && /,\s*[A-Z]{2}$/.test(arena) && !city) { city = arena; arena = name; }   // a home night in Miami: the title is the arena, the place line is the city
    const marks = find(a, n => /styles_marks__/.test(cls(n)))[0]; const tv = marks ? text(marks).filter(x => x.startsWith('@')).map(x => x.slice(1)) : [];
    const gs = find(a, n => /styles_game__/.test(cls(n)) && !/styles_gameLink__/.test(cls(n)));
    for (const g of gs) {
      const link = find(g, n => typeof n[3].href === 'string' && /^\/game\/[a-z0-9]+$/.test(n[3].href))[0]; const id = link ? link[3].href.split('/').pop() : String(g[2] || '');
      const teams = find(g, n => /styles_teamName__/.test(cls(n))).map(n => text(n).join('').trim()).filter(Boolean);
      const et = find(g, n => /styles_venueTime__/.test(cls(n)))[0]; const etw = et ? text(et).join(' ') : '';
      const tmm = /(\d{1,2}):(\d{2})\s*([AP]M)\s*(ET|CT|MT|PT)\b/i.exec(etw); const tm = tmm ? `${tmm[1]}:${tmm[2]} ${tmm[3].toUpperCase()}` : '';
      const at = tmm ? utcOf(ymd, (+tmm[1] % 12) + (/PM/i.test(tmm[3]) ? 12 : 0), +tmm[2], TZ[tmm[4].toUpperCase()]) : '';
      const mid = find(g, n => /styles_mid__/.test(cls(n)))[0]; const mw = mid ? text(mid).map(x => x.trim()).filter(Boolean) : [];
      const final = mw.some(x => /^final/i.test(x)); const nums = find(g, n => /styles_score/i.test(cls(n))).map(n => text(n).join('').trim()).filter(x => /^\d{1,3}$/.test(x)).map(Number);
      const score = final ? (nums.length >= 2 ? nums.slice(0, 2) : mw.filter(x => /^\d{1,3}$/.test(x)).map(Number).slice(0, 2)) : null;
      games.push({ id, ymd, at, night: nid, name, kicker, arena, city, time: tm, tz: tmm ? tmm[4].toUpperCase() : '', teams: teams.slice(0, 2), score: score && score.length === 2 ? score : null, final, tv });
    }
  }
  return { clubs, games };
}
function players(html) {
  const t = flightText(html); const i = t.indexOf('{"players":['); if (i < 0) return { list: [], base: '' };
  let d; try { d = JSON.parse(t.slice(i, i + scanEnd(t, i))); } catch (e) { return { list: [], base: '' }; }
  const base = String(d.prefixUrl || '').replace(/\/?$/, '/');
  const list = (d.players || []).map(p => ({ id: p.id, name: `${p.firstName || ''} ${p.lastName || ''}`.trim(), last: p.lastName || '', pos: p.position || '', ht: p.height || '', no: p.jerseyNumber, club: p.team && p.team.name || '', img: p.headshot ? base + String(p.headshot).replace(/^\//, '') : null }));
  const logos = {}; (d.players || []).forEach(p => { if (p.team && p.team.logo && p.team.kind === 'club') logos[p.team.name] = base + String(p.team.logo).replace(/^\//, ''); });
  return { list, base, logos };
}
function scanEnd(s, i) { let depth = 0, q = false; for (let j = i; j < s.length; j++) { const c = s[j]; if (q) { if (c === '\\') j++; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') { depth--; if (!depth) return j - i + 1; } } return s.length - i; }

// ---------- v443: depth. Club colors, every player's 2026 Unrivaled line and game log, her WNBA 2026 line for newcomers,
// box scores of played games, and from those a RIVL rating per player, a power per club and a win chance per game.
const COLOR = { Breeze: '#4a2f63', Hive: '#e2ad16', Laces: '#4f9f88', 'Lunar Owls': '#32307c', Mist: '#0d4a6b', Phantom: '#1c1c20', Rose: '#184c48', Vinyl: '#7a0030' };
const tables = html => {   // every <tr> in a page's flight data, as arrays of cell texts; links kept as "#/path"
  const rows = flightRows(flightText(html)); const { text, find } = tools(rows); const out = []; const seen = new Set();
  const txt = (n, acc = []) => { const v = tools(rows).deref(n); if (v == null || v === false) return acc; if (typeof v === 'string') { if (!v.startsWith('$')) acc.push(v); return acc; } if (typeof v === 'number') { acc.push(String(v)); return acc; }
    if (isEl(v)) { if (typeof v[3].href === 'string') acc.push('#' + v[3].href); txt(v[3].children, acc); return acc; } if (Array.isArray(v)) v.forEach(x => txt(x, acc)); return acc; };
  Object.keys(rows).forEach(k => find(rows[k], n => n[1] === 'tr').forEach(tr => { const cells = find(tr, n => n[1] === 'td' || n[1] === 'th').map(c => txt(c)); const key = JSON.stringify(cells); if (!seen.has(key)) { seen.add(key); out.push(cells); } }));
  return out;
};
const num = x => { const v = parseFloat(String(x).replace(/[^\d.-]/g, '')); return isNaN(v) ? 0 : v; };
const pair = x => { const m = /(\d+)\s*-\s*(\d+)/.exec(String(x)); return m ? [+m[1], +m[2]] : [0, 0]; };
// a line from cells after the first: MIN PTS FG 3PT FT REB OREB DREB AST STL BLK TO PF (+/-)
const lineOf = c => { const [fgm, fga] = pair(c[2]), [tpm, tpa] = pair(c[3]), [ftm, fta] = pair(c[4]);
  return { min: num(c[0]), pts: num(c[1]), fgm, fga, tpm, tpa, ftm, fta, reb: num(c[5]), oreb: num(c[6]), dreb: num(c[7]), ast: num(c[8]), stl: num(c[9]), blk: num(c[10]), tov: num(c[11]), pf: num(c[12]), pm: c[13] != null && c[13] !== '' ? num(c[13]) : null }; };
const gmsc = l => l.pts + .4 * l.fgm - .7 * l.fga - .4 * (l.fta - l.ftm) + .7 * l.oreb + .3 * l.dreb + l.stl + .7 * l.ast + .7 * l.blk - .4 * l.pf - l.tov;
const sumL = ls => { const t = { gp: ls.length, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }; ls.forEach(l => Object.keys(t).forEach(k => { if (k !== 'gp') t[k] += l[k] || 0; })); return t; };
const avg = t => t && t.gp ? { gp: t.gp, min: +(t.min / t.gp).toFixed(1), pts: +(t.pts / t.gp).toFixed(1), reb: +(t.reb / t.gp).toFixed(1), ast: +(t.ast / t.gp).toFixed(1), stl: +(t.stl / t.gp).toFixed(1), blk: +(t.blk / t.gp).toFixed(1), fg: t.fga ? +(100 * t.fgm / t.fga).toFixed(1) : null, tp: t.tpa ? +(100 * t.tpm / t.tpa).toFixed(1) : null, tpm: +(t.tpm / t.gp).toFixed(1) } : null;
const UA2 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const jget = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: { 'user-agent': UA2 } }); if (r.ok) return r.json(); if (r.status === 404) return null; } catch (e) {} await new Promise(r => setTimeout(r, 900 * (i + 1))); } return null; };
const plain = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const sh = await page('/schedule'); const ph = await page('/players');
if (!sh) { console.log('schedule page did not answer; keeping the last file'); process.exit(0); }
const S = schedule(sh); const P = ph ? players(ph) : { list: [], logos: {} };
const prev = existsSync('data/unrivaled.json') ? JSON.parse(readFileSync('data/unrivaled.json', 'utf8')) : {};
const prevP = {}; [...(prev.clubs || []).flatMap(c => c.players || []), ...(prev.pool || [])].forEach(p => { prevP[p.id] = p; });
const prevBox = prev.boxes || {};
Object.entries(P.logos || {}).forEach(([n, l]) => { (S.clubs[n] = S.clubs[n] || { name: n, slug: n.toLowerCase().replace(/\s+/g, '-') }).logo = l; });
const hrefs = {}; (ph || '').replace(/\/player\/([a-z0-9-]+)/g, (m, h) => { hrefs[h.split('-').pop()] = h; return m; });
const all = P.list;
// 2026 Unrivaled game log off each player's page, once (it stays put after the season)
for (const p of all) {
  const was = prevP[p.id]; if (was && was.u26) { p.u26 = was.u26; p.log26 = was.log26 || []; } else if (hrefs[p.id] && !process.env.UNR_DIR) {
    const h = await page('/player/' + hrefs[p.id]); const rows = h ? tables(h).filter(r => r[0] && r[0].some(x => /^#\/game\//.test(x)) && r.length >= 14) : [];
    const lines = rows.map(r => { const l = lineOf(r.slice(2).map(c => c.join(' '))); const teams = r[1].filter(x => /^#\/[a-z-]+$/.test(x)).map(x => x.slice(2)); return { ...l, d: r[0].filter(x => !x.startsWith('#')).join(' ').trim(), g: (r[0].find(x => /^#\/game\//.test(x)) || '').slice(7), at: teams[0] || '', ht: teams[1] || '' }; });
    p.u26 = sumL(lines); p.log26 = lines.map(l => ({ d: l.d, at: l.at, ht: l.ht, min: l.min, pts: l.pts, reb: l.reb, ast: l.ast, fg: `${l.fgm}-${l.fga}`, tp: `${l.tpm}-${l.tpa}` })); p.u26.gs = +lines.reduce((a, l) => a + gmsc(l), 0).toFixed(1);
    await new Promise(r => setTimeout(r, 250));
  }
  p.href = hrefs[p.id] || '';
}
// WNBA 2026 line and ESPN id, once. A rookie's page answers with her college season, also labeled 2026; the team on the row tells them apart
const wt = await jget('https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams?limit=40');
const WNBA_T = new Set(((((((wt || {}).sports || [])[0] || {}).leagues || [])[0] || {}).teams || []).map(x => String(x.team.id)));
for (const p of all) {
  const was = prevP[p.id]; if (was && was.espn !== undefined && (!was.w26 || was.w26.tid)) { p.espn = was.espn; p.w26 = was.w26; continue; }
  p.espn = ''; p.w26 = null; if (process.env.UNR_DIR) continue;
  const sr = await jget(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(plain(p.name))}&limit=5&type=player`);
  const hit = ((((sr || {}).results || []).find(r => r.type === 'player') || {}).contents || []).find(c => /l:59~a:\d+/.test(c.uid || ''));
  if (!hit) continue; p.espn = /a:(\d+)/.exec(hit.uid)[1];
  const st = await jget(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/athletes/${p.espn}/stats`);
  // a rookie's stats page answers with her college numbers; the league filter says which it is
  const cat = ((st || {}).categories || []).find(c => c.name === 'averages'); const row = cat && (cat.statistics || []).filter(x => x.season && x.season.year <= 2026 && x.season.year >= 2025).slice(-1)[0];
  if (row) { const L = cat.labels; const g = k => row.stats[L.indexOf(k)]; const [fgm, fga] = String(g('FG')).split('-').map(Number), [ftm, fta] = String(g('FT')).split('-').map(Number), [tpm] = String(g('3PT')).split('-').map(Number);
    const l = { min: num(g('MIN')), pts: num(g('PTS')), fgm, fga, ftm, fta, tpm, oreb: num(g('OR')), dreb: num(g('DR')), reb: num(g('REB')), ast: num(g('AST')), stl: num(g('STL')), blk: num(g('BLK')), tov: num(g('TO')), pf: num(g('PF')) };
    p.w26 = { tid: String(row.teamId || ''), lg: !WNBA_T.size || WNBA_T.has(String(row.teamId)) ? 'wnba' : 'ncaaw', year: row.season.year, gp: num(g('GP')), min: l.min, pts: l.pts, reb: l.reb, ast: l.ast, pm: l.min ? +(gmsc(l) / l.min).toFixed(4) : 0 }; }
  await new Promise(r => setTimeout(r, 200));
}
// box scores of finished games (kept; a final never changes)
const boxes = {};
for (const g of S.games) {
  if (!g.final) continue; if (prevBox[g.id]) { boxes[g.id] = prevBox[g.id]; continue; } if (process.env.UNR_DIR) continue;
  const h = await page(`/game/${g.id}/box-score`); if (!h) continue;
  const rows = tables(h).filter(r => r[0] && r[0].some(x => /^#\/player\//.test(x)));
  boxes[g.id] = rows.map(r => ({ id: (r[0].find(x => /^#\/player\//.test(x)) || '').split('-').pop(), st: r[0].includes('S') ? 1 : 0, ...lineOf(r.slice(1).map(c => c.join(' '))) }));
  await new Promise(r => setTimeout(r, 250));
}
// ratings: game score per minute, 2027 minutes weigh double; a newcomer's WNBA rate is scaled by how returners' rates compare
const both = all.filter(p => p.u26 && p.u26.min >= 40 && p.w26 && p.w26.lg === 'wnba' && p.w26.pm > 0).map(p => (p.u26.gs / p.u26.min) / p.w26.pm).sort((a, b) => a - b);
const scale = both.length >= 5 ? both[Math.floor(both.length / 2)] : 1.25;
const lines27 = {}; Object.values(boxes).forEach(b => b.forEach(l => { (lines27[l.id] = lines27[l.id] || []).push(l); }));
all.forEach(p => {
  const t27 = lines27[p.id] ? sumL(lines27[p.id]) : null; const g27 = lines27[p.id] ? lines27[p.id].reduce((a, l) => a + gmsc(l), 0) : 0;
  let min = 0, gs = 0; if (p.u26 && p.u26.min) { min += p.u26.min; gs += p.u26.gs; } if (t27 && t27.min) { min += 2 * t27.min; gs += 2 * g27; }
  p.src = min >= 30 ? 'unr' : p.w26 && p.w26.pm ? p.w26.lg : 'none';
  p.rate = min >= 30 ? gs / min : p.w26 && p.w26.pm ? p.w26.pm * scale * (p.w26.lg === 'wnba' ? 1 : .72) : null;   // college rates run hot against pros
  p.a26 = avg(p.u26); p.a27 = avg(t27);
});
const known = all.filter(p => p.rate != null).map(p => p.rate); const mean = known.reduce((a, b) => a + b, 0) / (known.length || 1);
const sd = Math.sqrt(known.reduce((a, b) => a + (b - mean) ** 2, 0) / (known.length || 1)) || 1; const floor = [...known].sort((a, b) => a - b)[Math.floor(known.length * .1)] || mean;
all.forEach(p => { p.rating = Math.max(60, Math.min(97, Math.round(80 + 7 * ((p.rate != null ? p.rate : floor) - mean) / sd))); });
const W6 = [.26, .22, .18, .14, .11, .09];
const clubs = Object.values(S.clubs).map(c => { const ps = all.filter(p => p.club === c.name).sort((a, b) => b.rating - a.rating);
  return { ...c, color: COLOR[c.name] || '#555', base: +(80 + 2.4 * (ps.slice(0, 6).reduce((a, p, i) => a + p.rating * W6[i], 0) - 82)).toFixed(2), players: ps.map(({ club, rate, ...p }) => p) }; });
const winP = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 25));
const pw = {}; clubs.forEach(c => { pw[c.name] = c.base; });
[...S.games].filter(g => g.final && g.score && g.teams.length === 2).sort((a, b) => (a.at || a.ymd).localeCompare(b.at || b.ymd)).forEach(g => {
  const [a, b] = g.teams; const p = winP(pw[a], pw[b]); const r = g.score[0] > g.score[1] ? 1 : 0; pw[a] += 3 * (r - p); pw[b] -= 3 * (r - p); });
clubs.forEach(c => { c.power = +pw[c.name].toFixed(1); }); [...clubs].sort((a, b) => b.power - a.power).forEach((c, i) => { c.rank = i + 1; });
S.games.forEach(g => { if (g.teams.length === 2 && pw[g.teams[0]] != null && pw[g.teams[1]] != null && !g.final) g.p0 = +winP(pw[g.teams[0]], pw[g.teams[1]]).toFixed(3); });
const pool = all.filter(p => !S.clubs[p.club]).map(({ club, rate, ...p }) => p);
const out = { updated: new Date().toISOString(), source: 'Unrivaled', url: B + '/schedule', season: (/night-(\d{4})/.exec(JSON.stringify(S.games[0] || {})) || [])[1] || '', scale: +scale.toFixed(3), clubs, pool, games: S.games, boxes };
const ok = out.games.filter(g => g.ymd).length;
if (!ok) { console.log('no dated games found; keeping the last file'); process.exit(0); }
writeFileSync('data/unrivaled.json', JSON.stringify(out));
console.log('games', out.games.length, 'final', Object.keys(boxes).length, 'clubs', clubs.length, 'players', all.length, 'scale', scale.toFixed(3), 'src', JSON.stringify(all.reduce((o, p) => (o[p.src] = (o[p.src] || 0) + 1, o), {})));
console.log(clubs.map(c => `${c.rank}. ${c.name} ${c.power}`).join(' | '));
console.log(all.sort((a, b) => b.rating - a.rating).slice(0, 12).map(p => `${p.name} ${p.rating} (${p.src})`).join(', '));
