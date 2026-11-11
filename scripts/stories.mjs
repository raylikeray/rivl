// Builds data/stories.json: the video posts ESPN's news feeds carry (highlights, single plays, interviews, show
// segments), each tagged with the teams and players in it and resolved to its plain video file, so a story bubble can
// play it at once with no ads. The feeds list a post without its file; the clip service hands back the file for an id.
// Posts older than 72 hours fall off; ids resolved on earlier runs are reused instead of asked for again.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball';
const LG = { nba: 'nba', wnba: 'wnba', ncaam: 'mens-college-basketball', ncaaw: 'womens-college-basketball' };
const KEEP = 72 * 36e5, now = Date.now();
const CM_KEEP = 5 * 864e5;   // how long a clip's play link is kept
const get = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (r.ok) return r.json(); if (r.status === 404) return null; } catch (e) {} await new Promise(r => setTimeout(r, 900 * (i + 1))); } return null; };
// the same, as text: college play ids run to 18 digits, more than a number can hold exactly, so they are read off the page as written
const getRaw = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (r.ok) return r.text(); if (r.status === 404) return ''; } catch (e) {} await new Promise(r => setTimeout(r, 900 * (i + 1))); } return ''; };
const old = existsSync('data/stories.json') ? JSON.parse(readFileSync('data/stories.json', 'utf8')) : { items: [] };
const known = new Map((old.items || []).map(x => [x.lk + ':' + x.id, x]));
const posts = new Map();
const take = (lk, a) => {
  if (!a || a.type !== 'Media' || !a.id || !a.published) return; const ts = Date.parse(a.published); if (!(now - ts < KEEP)) return;
  const k = lk + ':' + a.id; const cats = a.categories || [];
  const teams = cats.filter(c => c.type === 'team').map(c => String(c.teamId || (c.team && c.team.id) || '')).filter(Boolean);
  const aths = cats.filter(c => c.type === 'athlete').map(c => String(c.athleteId || (c.athlete && c.athlete.id) || '')).filter(Boolean);
  const p = posts.get(k) || { lk, id: String(a.id), title: String(a.headline || '').trim(), ts: new Date(ts).toISOString(), teams: [], aths: [], thumb: ((a.images || [])[0] || {}).url || '' };
  p.teams = [...new Set([...p.teams, ...teams])]; p.aths = [...new Set([...p.aths, ...aths])]; posts.set(k, p);
};
for (const [lk, path] of Object.entries(LG)) {
  const feeds = [`${SITE}/${path}/news?limit=100`];
  if (lk === 'nba' || lk === 'wnba') {
    const td = await get(`${SITE}/${path}/teams?limit=60`);
    ((((((td || {}).sports || [])[0] || {}).leagues || [])[0] || {}).teams || []).forEach(x => feeds.push(`${SITE}/${path}/news?team=${x.team.id}&limit=40`));
  }
  for (let i = 0; i < feeds.length; i += 6) { const rs = await Promise.all(feeds.slice(i, i + 6).map(get)); rs.forEach(d => ((d || {}).articles || []).forEach(a => take(lk, a))); }
  console.log(lk, 'feeds', feeds.length, 'posts so far', posts.size);
}
const list = [...posts.values()]; const out = []; let asked = 0;
for (let i = 0; i < list.length; i += 6) {
  await Promise.all(list.slice(i, i + 6).map(async p => {
    const k = p.lk + ':' + p.id; const prev = known.get(k);
    if (prev && prev.url && prev.k != null) { out.push({ ...prev, ...p, url: prev.url, dur: prev.dur, thumb: p.thumb || prev.thumb }); return; }   // one saved before clip types were kept is asked for again, once
    asked++; const d = await get(`https://content.core.api.espn.com/v1/video/clips/${p.id}`); const v = ((d || {}).videos || [])[0]; if (!v) return;
    const s = ((v.links || {}).source) || {};
    const url = (s.mp4 && s.mp4.href) || (s.HD && s.HD.href) || s.href || (s.full && s.full.href) || '';
    if (!/^https:\/\/[^"]+\.mp4/.test(url) || v.premium) return;
    out.push({ ...p, url, dur: Math.round(+v.duration || 0), thumb: p.thumb || v.thumbnail || '', k: String((v.tracking || {}).coverageType || '') });
  }));
}
// a post whose feed rolled past it this run stays until it ages out
(old.items || []).forEach(x => { if (!out.some(y => y.lk === x.lk && y.id === x.id) && now - Date.parse(x.ts) < KEEP) out.push(x); });
out.sort((a, b) => b.ts.localeCompare(a.ts));
if (!out.length && (old.items || []).length) { console.log('nothing resolved; keeping the last file'); process.exit(0); }

/* The clip map. A game's own list of clips says nothing about who is in each one. The clip service does: the player,
   and the exact play it shows. One entry per clip: { e: game, p: play id, a: [player ids], t: type, ts }. The app uses
   it to keep a team's story to that team's plays and to print the quarter, clock and score under each one.
   Games are swept for three days; a game that ended more than 10 hours ago and was already swept is left alone. */
const VER = 2, fresh = old.ver !== VER;   // a file from before play ids were read exactly: sweep its games again and re-read the long ids
const cm = { ...(old.cm || {}) }, swept = fresh ? {} : { ...(old.swept || {}) };
/* The biggest plays. For a finished game, each single-play clip is weighed by how far its play moved the win chance
   (the feed's own line, read at that play and the one before). The few biggest per game are kept with everything a
   phone needs to play them: file, title, and the clock and score at the play. 'wp' remembers which games were weighed. */
/* The feed. Every single-play clip from the last two days, in a form small enough to ship them all: the folder its
   files live in (both the wide file and the upright stream follow from it), its title, players, game and the two teams.
   The app ranks these on the phone for the For you ring. Kept in its own file. */
const FEED_KEEP = 48 * 36e5; const oldFeed = existsSync('data/feed.json') ? JSON.parse(readFileSync('data/feed.json', 'utf8')) : { items: [] };
const feed = new Map((oldFeed.items || []).filter(x => now - x.ts < FEED_KEEP).map(x => [x.id, x]));
const WSC = /\/espn\/media\/16x9\/(wsc\/\d{4}\/\d{4}\/[0-9a-f-]{36})\//;
/* v503 the longer videos, for Watch: game reels, interviews, analyst segments, player recaps and features. Same compact
   form as a play (the folder its files live in), plus k, the kind. Kept four days, in their own list ('more') so an app
   from before this still reads 'items' as plays only. A video whose kind the service did not say and the title does not
   show is left out: Watch labels every clip, and a label is never guessed. */
const MORE_KEEP = 96 * 36e5, MED = /\/espn\/media\/16x9\/((?:wsc\/)?\d{4}\/\d{4}\/([^\/]+))\/\2\.mp4/;
const firstMore = !oldFeed.more;   // the first run with this list sweeps the last three days of games again, once, for their reels
const more = new Map((oldFeed.more || []).filter(x => now - x.ts < MORE_KEEP).map(x => [x.id, x]));
const vkOf = (type, title, url, dur) => /(game|full) highlights\s*$/i.test(title) || type === 'Final Game Highlight' ? 'reel' : /interview|press|sound/i.test(type) || /_interview_/i.test(url) ? 'talk'
  : /analysis/i.test(type) ? 'show' : /feature/i.test(type) ? 'feat' : /highlight|oneplay/i.test(type) && dur >= 45 ? 'recap' : '';
const addMore = (lk, id, ts, title, url, dur, a, tm, type, e, thumb) => { if (feed.has(id) || !title || !(now - ts < MORE_KEEP) || !(dur >= 30)) return; const m = MED.exec(url || ''), k = vkOf(String(type || ''), title, url || '', dur); if (!m || !k) return;
  const it = { id, lk, ts, t: title, u: m[1], d: dur, a: (a || []).slice(0, 6), tm: tm || [], k }; if (e) it.e = e;
  if (thumb && /^https:\/\//.test(thumb) && thumb !== `https://espnmedia-cdn.akamaized.net/espn/media/common/${m[1]}/${m[2]}.jpg`) it.th = thumb;   /* the picture is not always where the file's name says */
  const was = more.get(id); if (was && was.e && !it.e) it.e = was.e; if (was && was.th && !it.th) it.th = was.th; more.set(id, it); };
/* v503 what kind of play a clip shows, read from the play record (not from the words in its title): the kind, whether it
   was assisted, and whether it came in the last two minutes of the last period or overtime with the score within five. */
const REG = { nba: 4, wnba: 4, ncaaw: 4, ncaam: 2 };
const secs = s => { const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(s || '').trim()); return m ? (+m[1] || 0) * 60 + +m[2] : 1e9; };
const pkOf = q => { const ty = String((q.type || {}).text || ''), tx = String(q.text || ''), both = ty + ' ' + tx;
  if (/\bblocks?\b/i.test(tx)) return 'block'; if (/\bsteals?\b/i.test(tx)) return 'steal'; if (!q.scoringPlay) return '';
  return /dunk/i.test(both) ? 'dunk' : +q.scoreValue === 3 || /three point/i.test(both) ? 'three' : /lay-?up|finger roll|tip|putback/i.test(ty) ? 'layup' : /free throw/i.test(ty) ? 'ft' : /jump|hook|float|fade|bank|shot/i.test(ty) ? 'jumper' : ''; };
const readKind = (lk, c, q) => { if (!q) return; const k = pkOf(q); if (k) c.pk = k; if (/assist/i.test(String(q.text || ''))) c.as = 1;
  if (q.homeScore != null && q.awayScore != null && +(q.period || {}).number >= (REG[lk] || 4) && secs((q.clock || {}).displayValue) <= 120 && Math.abs(q.homeScore - q.awayScore) <= 5) c.cl = 1; };
/* A clip the video service left without a player (it happens most with rookies): if the title opens with the full name of
   a player in data/leaders.json for that league, and that player's team is one of the two in the game, the clip is his.
   One match only; two players who fit, or none, and the clip stays untagged. Marked an: 1 so it can be told apart. */
const LEAD = existsSync('data/leaders.json') ? JSON.parse(readFileSync('data/leaders.json', 'utf8')) : { leagues: {} };
const EVT = new Map();   // game id -> the two teams' short codes, for the games seen this run
const named = (lk, title, e) => { const ps = ((LEAD.leagues || {})[lk] || {}).players || []; const ta = (EVT.get(String(e)) || []).map(x => x.toUpperCase());
  if (!ta.length) return [];
  const hit = ps.filter(p => p.n && p.n.length > 5 && title.startsWith(p.n) && !/[\p{L}\p{N}]/u.test(title.charAt(p.n.length)) && ta.includes(String(p.team || '').toUpperCase()));
  return hit.length === 1 ? [String(hit[0].id)] : []; };
const wpDone = fresh ? {} : { ...(old.wp || {}) }; let cand = (old.top || []).filter(c => now - c.gt < 40 * 36e5);
const perLbl = p => { const d = String((p.period || {}).displayValue || ''), n = +(p.period || {}).number || 0; return /quarter/i.test(d) ? `Q${n}` : /half/i.test(d) ? (n === 1 ? '1st half' : '2nd half') : d.replace(/overtime/i, 'OT'); };
const weigh = async (lk, path, e, vids) => {
  const ones = vids.filter(v => { const c = cm[String(v.id)]; return c && c.t === 'OnePlay' && c.p && (+v.duration || 0) < 45; });
  if (wpDone[e.id] && wpDone[e.id].n === ones.length && wpDone[e.id].k) return; wpDone[e.id] = { n: ones.length, t: e.t, k: 1 }; if (!ones.length) return;
  const s = await get(`${SITE}/${path}/summary?event=${e.id}`); if (!s) { delete wpDone[e.id]; return; }
  const wp = (s.winprobability || []).filter(x => x.homeWinPercentage != null); const at = new Map(wp.map((x, i) => [String(x.playId), i])); const plays = new Map((s.plays || []).map(q => [String(q.id), q]));
  for (const v of ones) { const c = cm[String(v.id)]; readKind(lk, c, plays.get(c.p)); }
  const comp = (((s.header || {}).competitions || [])[0] || {}).competitors || []; const side = ha => { const c = comp.find(x => x.homeAway === ha) || {}; const tm = c.team || {}; return { id: String(tm.id || ''), ab: tm.abbreviation || '', nm: tm.shortDisplayName || tm.name || tm.displayName || '', sc: c.score != null ? String(c.score) : '' }; };
  const H = side('home'), A = side('away'); if (!H.id || !A.id || wp.length < 20) return;
  const mine = [];
  for (const v of ones) { const c = cm[String(v.id)], i = at.get(c.p), q = plays.get(c.p); if (!i || !q || q.homeScore == null) continue;   // i === 0 has no play before it
    const w = wp[i].homeWinPercentage - wp[i - 1].homeWinPercentage; c.w = Math.round(w * 1000) / 1000; const url = (((v.links || {}).source) || {}).href || '';
    if (Math.abs(w) < .03 || !/^https:\/\/[^"]+\.mp4/.test(url)) continue;
    mine.push({ lk, id: String(v.id), e: e.id, gt: e.t, ts: c.ts, w: c.w, title: String(v.headline || '').trim(), url, thumb: v.thumbnail || '', dur: Math.round(+v.duration || 0), a: c.a, per: perLbl(q), ck: String((q.clock || {}).displayValue || ''), hs: q.homeScore, as: q.awayScore, h: H, aw: A }); }
  mine.sort((x, y) => Math.abs(y.w) - Math.abs(x.w)); cand = cand.filter(c => c.e !== e.id).concat(mine.slice(0, 3));
};
const ymd = n => new Date(now - n * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
let cmAsked = 0, gamesAsked = 0;
for (const [lk, path] of Object.entries(LG)) {
  const evs = new Map();
  for (const n of [0, 1, 2]) { const d = await get(`${SITE}/${path}/scoreboard?dates=${ymd(n)}${lk.startsWith('ncaa') ? '&groups=50&limit=400' : ''}`);
    ((d || {}).events || []).forEach(e => { const st = ((e.status || {}).type || {}); if (st.state === 'pre') return; const cs = (((e.competitions || [])[0] || {}).competitors) || []; EVT.set(String(e.id), cs.map(c => String((c.team || {}).abbreviation || '')).filter(Boolean)); evs.set(String(e.id), { id: String(e.id), done: !!st.completed, t: Date.parse(e.date) || now, tm: cs.map(c => String((c.team || {}).id || '')).filter(Boolean) }); }); }
  const todo = [...evs.values()].filter(e => !(swept[e.id] && e.done && swept[e.id] - e.t > 12.5 * 36e5) || (e.done && !wpDone[e.id] && now - e.t < 36 * 36e5) || (e.done && wpDone[e.id] && !wpDone[e.id].k && now - e.t < 50 * 36e5) || firstMore);
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async e => {
      gamesAsked++; const d = await get(`${SITE}/${path}/videos?event=${e.id}`); if (!d) return; swept[e.id] = now;
      for (const v of d.videos || []) { const id = String(v.id || ''); if (!id || (cm[id] && !(cm[id].p.length > 15 && cm[id].v !== VER))) continue;
        cmAsked++; const raw = await getRaw(`https://content.core.api.espn.com/v1/video/clips/${id}`); let f = null; try { f = JSON.parse(raw); } catch (er) {} const c = ((f || {}).videos || [])[0]; if (!c) continue;
        const a = (c.categories || []).filter(x => x.type === 'athlete').map(x => String(x.athleteId || '')).filter(Boolean);
        const pl = (/"plays"\s*:\s*\[\s*\{\s*"id"\s*:\s*"?(\d+)/.exec(raw) || [])[1];
        cm[id] = { v: VER, e: e.id, p: pl || '', a, t: String((c.tracking || {}).coverageType || ''), ts: Date.parse(c.originalPublishDate || '') || now }; }
      if (e.done) { try { await weigh(lk, path, e, d.videos || []); } catch (er) { console.log('weigh failed', e.id, String(er).slice(0, 80)); } }
      for (const v of d.videos || []) { const id = String(v.id || ''), c = cm[id]; if (!c || c.t !== 'OnePlay' || !((+v.duration || 0) < 45) || !(now - c.ts < FEED_KEEP)) continue;
        const m = WSC.exec((((v.links || {}).source) || {}).href || ''); const title = String(v.headline || '').trim(); if (!m || !title) continue;
        const it = { id, lk, e: e.id, ts: c.ts, t: title, u: m[1], d: Math.round(+v.duration || 0), a: c.a, tm: e.tm }; if (c.w != null) it.w = c.w; if (c.pk) it.pk = c.pk; if (c.as) it.as = 1; if (c.cl) it.cl = 1; feed.set(id, it); }
      for (const v of d.videos || []) { const id = String(v.id || ''), c = cm[id], dur = Math.round(+v.duration || 0); if (!c || (c.t === 'OnePlay' && dur < 45)) continue;
        addMore(lk, id, c.ts, String(v.headline || '').trim(), (((v.links || {}).source) || {}).href || '', dur, c.a, e.tm, c.t, e.id, String(v.thumbnail || '')); }
    }));
  }
  console.log(lk, 'games', evs.size, 'asked', todo.length);
}
for (const [id, c] of Object.entries(cm)) if (!(now - c.ts < CM_KEEP)) delete cm[id];
for (const [id, t] of Object.entries(swept)) if (!(now - t < 4 * 864e5)) delete swept[id];
for (const [id, x] of Object.entries(wpDone)) if (!(now - x.t < 4 * 864e5)) delete wpDone[id];
// the list the app shows: per league, the 14 biggest from games that tipped in the last 40 hours
const top = []; for (const lk of Object.keys(LG)) top.push(...cand.filter(c => c.lk === lk).sort((x, y) => Math.abs(y.w) - Math.abs(x.w)).slice(0, 14));
writeFileSync('data/stories.json', JSON.stringify({ ver: VER, updated: new Date().toISOString(), items: out, cm, swept, wp: wpDone, top }));
let namedNow = 0; for (const it of feed.values()) { if ((it.a || []).length) continue; const a = named(it.lk, it.t || '', it.e); if (a.length) { it.a = a; it.an = 1; namedNow++; } }
console.log('players read from titles', namedNow);
for (const p of out) addMore(p.lk, String(p.id), Date.parse(p.ts) || now, p.title, p.url, p.dur, p.aths, p.teams, p.k || '', '', p.thumb || '');
for (const id of more.keys()) if (feed.has(id)) more.delete(id);
writeFileSync('data/feed.json', JSON.stringify({ updated: new Date().toISOString(), items: [...feed.values()].sort((a, b) => b.ts - a.ts), more: [...more.values()].sort((a, b) => b.ts - a.ts) }));
const tally = l => { const o = {}; l.forEach(x => { o[x] = (o[x] || 0) + 1; }); return JSON.stringify(o); };
console.log('feed', feed.size, 'kinds', tally([...feed.values()].map(x => x.pk || '?')), 'clutch', [...feed.values()].filter(x => x.cl).length);
console.log('more', more.size, tally([...more.values()].map(x => x.lk + ':' + x.k)));
console.log('top plays', top.length, top.slice(0, 3).map(c => `${c.lk} ${c.w} ${c.title}`));
console.log('clip map', Object.keys(cm).length, 'games asked', gamesAsked, 'clips asked', cmAsked);
console.log('stories', out.length, 'resolved now', asked, out.slice(0, 4).map(x => `${x.lk} ${x.title} [${x.aths.length}a ${x.teams.length}t]`));
