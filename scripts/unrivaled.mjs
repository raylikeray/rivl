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

const sh = await page('/schedule'); const ph = await page('/players');
if (!sh) { console.log('schedule page did not answer; keeping the last file'); process.exit(0); }
const S = schedule(sh); const P = ph ? players(ph) : { list: [], logos: {} };
Object.entries(P.logos || {}).forEach(([n, l]) => { (S.clubs[n] = S.clubs[n] || { name: n, slug: n.toLowerCase().replace(/\s+/g, '-') }).logo = l; });
const clubs = Object.values(S.clubs).map(c => ({ ...c, players: P.list.filter(p => p.club === c.name).map(({ club, ...p }) => p) }));
const pool = P.list.filter(p => !S.clubs[p.club]).map(({ club, ...p }) => p);
const out = { updated: new Date().toISOString(), source: 'Unrivaled', url: B + '/schedule', season: (/night-(\d{4})/.exec(JSON.stringify(S.games[0] || {})) || [])[1] || '', clubs, pool, games: S.games };
const ok = out.games.filter(g => g.ymd).length;
if (!ok) { console.log('no dated games found; keeping the last file'); process.exit(0); }
writeFileSync('data/unrivaled.json', JSON.stringify(out));
console.log('games', out.games.length, 'dated', ok, 'with teams', out.games.filter(g => g.teams.length === 2).length, 'with time', out.games.filter(g => g.time).length, 'clubs', clubs.length, 'players', P.list.length);
console.log(JSON.stringify(out.games.slice(0, 2), null, 1)); console.log(JSON.stringify(clubs[0] && { ...clubs[0], players: clubs[0].players.slice(0, 2) }, null, 1));
