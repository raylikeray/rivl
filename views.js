/* RIVL v5 — views. Pure render functions over the data layer in js/core.js. Each view returns a promise that
   resolves once the screen is painted; app.js owns routing, polling and delegated clicks. */
(() => {
  'use strict';
  /* ---------- team colours ----------
     A disc's tint must never depend on tonight's feed. Every feed that carries a team colour (scoreboards, schedules,
     rosters, team pages, game summaries) teaches it to a small map kept on the device, and discs resolve their colour
     from that map at paint time — by team id, or by abbreviation/name for a followed player's team. */
  const UNK = '#55606e';   // what core.js's hx() hands back when a feed has no colour (schedules, some summaries)
  const NONE = '#2A2D33';  // the old "no colour" placeholder some stored follows still carry
  const BAD = c => { const s = String(c || '').toLowerCase(); return !s || s === NONE.toLowerCase() || s === UNK; };
  const learned = {}; let saveT = null;
  const pool = lk => learned[lk] || (learned[lk] = HW.store.get(`v5:colors:${lk}`, {}) || {});
  const learn = (L, t) => {
    if (!L || !t || t.id == null || t.id === '') return;
    const c = t.color ? HW.hx(t.color) : ''; if (BAD(c)) return;
    const alt = t.alt ? HW.hx(t.alt) : (t.alternateColor ? HW.hx(t.alternateColor) : ''); const a = BAD(alt) ? '' : alt;
    const P = pool(L.key), k = String(t.id), was = P[k] || {};
    const next = { color: c, alt: a || was.alt || '', abbr: t.abbr || t.abbreviation || was.abbr || '', short: t.short || t.shortDisplayName || was.short || '', name: t.name || t.displayName || was.name || '', logo: (typeof t.logo === 'string' && t.logo) || (t.logos && t.logos[0] && t.logos[0].href) || was.logo || '' };
    if (['color', 'alt', 'abbr', 'short', 'name', 'logo'].every(f => was[f] === next[f])) return;
    P[k] = next; clearTimeout(saveT); saveT = setTimeout(() => HW.store.set(`v5:colors:${L.key}`, P), 600);
  };
  const learnGames = (L, gs) => { (Array.isArray(gs) ? gs : []).forEach(g => { if (g) { learn(L, g.home); learn(L, g.away); } }); };
  { const sb = HW.scoreboard, pe = HW.parseEvent;   // every scoreboard and every parsed event teaches as it passes
    HW.scoreboard = async (L, ...a) => { const g = await sb(L, ...a); learnGames(L, g); return g; };
    HW.parseEvent = (e, L) => { const g = pe(e, L); if (g) { learn(L, g.home); learn(L, g.away); } return g; }; }
  const { LEAGUES, ORDER, esc, j, jSoft, todayCT, addDays, dayLabel, relDay, tip, tipOf, dateShort, ago, pct, ordinal, hx, store, API, WEB, finalWord, isDone,
    favs, parseEvent, isLive, isFav, interest, scoreboard, standings, injuries, forecast, seriesForecast, forecastCtx, leaguePlayers, S } = HW;
  const $main = document.getElementById('main');

  /* ---------- small helpers ---------- */
  const H = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? vals[i] : ''), '');
  const dark = c => c && HW.darkOf(c, c) || '#1d2633';
  const teamIdx = {};   // every team in a league, keyed by id, once the list has loaded
  const sameTeam = (x, k) => !!k && [x.abbr, x.short, x.name].some(v => v && String(v).toLowerCase() === k);
  /* the entry for a team: the league list by id, then the learned map by id, then either by abbreviation or name */
  const teamEntry = (t, L) => {
    if (!t || !L) return null; const k = String(t.id || ''); const ix = teamIdx[L.key] || {}, P = pool(L.key);
    if (k) { if (ix[k] && !BAD(ix[k].color)) return ix[k]; if (P[k]) return P[k]; }
    const key = String(t.abbr || t.team || t.short || '').toLowerCase(); if (!key) return null;
    return Object.values(ix).find(x => !BAD(x.color) && sameTeam(x, key)) || Object.values(P).find(x => sameTeam(x, key)) || null;
  };
  const teamColor = (t, L) => { const c = t && t.color ? hx(t.color) : ''; if (c && !BAD(c)) return c; const e = teamEntry(t, L); return (e && !BAD(e.color) && e.color) || c || NONE; };
  const teamAlt = (t, L) => { const a = t && t.alt ? hx(t.alt) : ''; if (a && !BAD(a)) return a; const e = teamEntry(t, L); return e && e.alt && !BAD(e.alt) ? e.alt : ''; };
  /* a followed player's colour: the one stored with the follow when it is real, else their team's */
  const playerColor = (p, L) => { if (!p) return NONE; if (p.color && !BAD(p.color)) return hx(p.color); return teamColor({ id: p.teamId, abbr: p.team }, L); };
  /* team colour on the two grounds: lifted toward white on black, deepened toward black on white */
  const rgbOf = c => { const s = String(c || ''); const m = s.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/); if (m) return [+m[1], +m[2], +m[3]]; const h = s.replace('#', ''); return h.length >= 6 ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : null; };   // hex or an rgb() a lift produced
  const lumOf = c => { const v = rgbOf(c); return v ? (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 : .5; };
  const mixTo = (c, to, k) => { const v = rgbOf(c); if (!v) return c; const m = x => Math.round(x + (to - x) * k); return `rgb(${m(v[0])},${m(v[1])},${m(v[2])})`; };
  /* a colour for a number on the page: the team's hue at full saturation, lifted or deepened only as far as it must be to read.
     The old lift mixed toward white and came out pastel; this keeps the colour. */
  const hslOf = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn; const sat = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, sat, l]; };
  const rgbFromHsl = ([h, sat, l]) => { const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; if (!sat) { const v = Math.round(l * 255); return `rgb(${v},${v},${v})`; } const q = l < .5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q; return `rgb(${Math.round(f(pp, q, h + 1 / 3) * 255)},${Math.round(f(pp, q, h) * 255)},${Math.round(f(pp, q, h - 1 / 3) * 255)})`; };
  const V_vivid = (c, onDark = true) => { const v = rgbOf(c); if (!v) return c; let [h, sat, l] = hslOf(v); if (sat < .12) return onDark ? '#FFFFFF' : '#0A0B0E'; sat = Math.max(sat, .78); l = onDark ? Math.min(Math.max(l, .56), .66) : Math.min(Math.max(l, .30), .40); return rgbFromHsl([h, sat, l]); };
  const V_lift = c => { const l = lumOf(c); return l > 0.45 ? c : mixTo(c, 255, l < 0.15 ? 0.6 : 0.4); };
  const V_deep = c => { const l = lumOf(c); return l < 0.5 ? c : mixTo(c, 0, l > 0.75 ? 0.5 : 0.32); };
  /* teams whose signature colour is their secondary: their score takes that one so the Lakers read gold, not Jazz purple */
  const SIG_ALT = { nba: { LAL: 1, IND: 1, DEN: 1, MIN: 1 }, wnba: { LA: 1, LAS: 1 } };
  const scoreColor = (L, t) => { const alt = teamAlt(t, L); return alt && SIG_ALT[L.key] && SIG_ALT[L.key][t.abbr] ? alt : teamColor(t, L); };
  /* a page that belongs to a team or a player takes that team's colour: the wash at the top, the status bar and a faint tint of the
     ground all follow it, so the page reads as theirs; league screens clear it and go back to the accent */
  const tint = c => { const root = document.documentElement; if (c && !BAD(c)) { root.style.setProperty('--tint', hx(c)); root.setAttribute('data-tint', '1'); } else { root.style.removeProperty('--tint'); root.removeAttribute('data-tint'); } if (HW.v5.applyTheme) HW.v5.applyTheme(); };
  /* a team colour on an element: --tc raw (tints, rings), --tf-d/--tf-l the readable fill for black and white backgrounds — the
     stylesheet maps --tf to the one in use, so a black Spurs bar reads on black and a white one on white */
  const tcv = c => `--tc:${esc(c)};--tf-d:${esc(V_lift(c))};--tf-l:${esc(V_deep(c))}`;
  /* two teams' colours for one chart or tracker: when the two are near each other (Thunder and Mavericks are both blue), one
     side takes its other colour, whichever of the two alternates stands furthest from the first side's colour */
  const rgbDist = (a, b) => { const x = rgbOf(a), y = rgbOf(b); return x && y ? Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) : 999; };
  const pairColors = (L, away, home) => {
    let ca = scoreColor(L, away), ch = scoreColor(L, home);
    if (rgbDist(ca, ch) >= 92) return [ca, ch];
    const options = [[ca, teamAlt(home, L)], [teamAlt(away, L), ch]].filter(([x, y]) => x && y && !BAD(x) && !BAD(y)).map(([x, y]) => [x, y, rgbDist(x, y)]).sort((x, y) => y[2] - x[2]);
    return options.length && options[0][2] > rgbDist(ca, ch) ? [options[0][0], options[0][1]] : [ca, ch];
  };
  /* the hero's second panel: the team's other colour, left as it is unless it is close to white */
  const V_panel = c => { const l = lumOf(c); return l > .84 ? mixTo(c, 0, .42) : c; };
  const scVars = (t, L) => { const c = L ? scoreColor(L, t) : teamColor(t); return `${tcv(c)};--tcd:${esc(V_vivid(c, true))};--tcl:${esc(V_vivid(c, false))}`; };
  const href = { player: (lk, id) => `#player/${lk}/${id}`, team: (lk, id) => `#team/${lk}/${id}`, game: (lk, id) => `#game/${lk}/${id}` };
  const hide = `onerror="this.style.visibility='hidden'"`;
  /* ESPN's art at the size it is drawn: the CDN's combiner scales a logo or headshot on the fly, so a 46px disc doesn't
     pull the 500px original. If the combiner ever refuses, the image falls back to the original it was made from. */
  const sized = (src, w, h) => { const m = /^https:\/\/a\.espncdn\.com(\/i\/[^?]+\.png)(?:\?.*)?$/i.exec(String(src || '')); return m ? `https://a.espncdn.com/combiner/i?img=${m[1]}&w=${w}&h=${h}` : src || ''; };
  const fallback = then => `onerror="if(this.dataset.o){this.src=this.dataset.o;this.removeAttribute('data-o')}else{${then}}"`;
  // `extra` is written before loading="lazy" so a caller can pass loading="eager": with a duplicate attribute the first wins
  const imgSized = (src, w, h, extra = '', then = "this.style.visibility='hidden'") => { const u = sized(src, w, h); return `<img src="${esc(u)}"${u !== src ? ` data-o="${esc(src)}"` : ''} alt="" ${extra} loading="lazy" ${fallback(then)}>`; };
  /* a logo disc; with a team colour it takes a tint and a ring in that colour */
  const LOGO_PX = { s: 96, m: 128, '': 128, l: 192, hero: 256 };
  const logo = (src, size = '', color = '') => { const c = BAD(color) ? '' : hx(color); const px = LOGO_PX[size] || 128; return `<span class="logo ${size === 'hero' ? '' : size}${c ? ' tint' : ''}"${c ? ` style="${tcv(c)}"` : ''}>${imgSized(src, px, px)}</span>`; };
  /* a player's id from whatever the feed gave us: the id field, the uid, the headshot file name or a link */
  const athId = a => { if (!a) return ''; if (a.id != null && a.id !== '') return String(a.id); let m = String(a.uid || '').match(/~a:(\d+)/); if (m) return m[1]; const hs = typeof a.headshot === 'string' ? a.headshot : a.headshot && a.headshot.href || ''; m = hs.match(/\/(\d+)\.png/); if (m) return m[1]; m = (a.links || []).map(l => l && l.href || '').join(' ').match(/\/id\/(\d+)/); return m ? m[1] : ''; };
  const hsUrl = a => { const h = a && a.headshot; return typeof h === 'string' ? h : h && h.href || ''; };
  const initials = name => String(name || '').replace(/[^A-Za-z\s'-]/g, '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  /* headshot disc: the photo when the feed has one, the player's initials on the team colour when it doesn't */
  const headshot = (src, color, size = 64, name = '') => `<span class="hs${src ? '' : ' noimg'}${BAD(color) ? ' plain' : ''}" style="${BAD(color) ? '' : `${tcv(hx(color))};`}width:${size}px;height:${size}px;font-size:${Math.round(size * .34)}px"><i>${esc(initials(name))}</i>${src ? imgSized(src, size >= 56 ? 254 : 160, size >= 56 ? 185 : 116, '', "this.parentNode.classList.add('noimg');this.remove()") : ''}</span>`;
  /* what a return date means: ESPN pencils in the next season's opener for anyone out for the year */
  const statusWord = s => String(s || '').replace(/\bDay-To-Day\b/i, 'Day to day').replace(/\bGame Time Decision\b/i, 'Game-time decision').replace(/\bOut For Season\b/i, 'Out for season');
  const retInfo = (L, iso) => { if (!iso) return null; const d = new Date(iso); if (isNaN(d)) return null; const exact = dayUTC(iso); const ss = String(L && L.seasonStart || '2026-10-01').slice(5); const now = new Date(); let next = new Date(`${now.getUTCFullYear()}-${ss}T00:00:00Z`); if (next - now < 30 * 864e5) next = new Date(`${now.getUTCFullYear() + 1}-${ss}T00:00:00Z`); const far = d >= next - 14 * 864e5; if (far) return { short: 'no return date this season', long: `Not before next season (ESPN lists ${exact})`, far: true }; if (d < now - 36e5 * 36) return { short: `no new date (was ${exact})`, long: `Was ${exact}; no new date yet`, far: false, past: true }; return { short: `back around ${exact}`, long: exact, far: false }; };
  /* what Home shows: every section on by default */
  const PREF_KEYS = ['wire', 'brief', 'live', 'teams', 'players', 'injuries', 'news', 'forecast'];
  const prefs = { all() { const d = {}; PREF_KEYS.forEach(k => d[k] = true); return Object.assign(d, store.get('v5:prefs', {}) || {}); }, get(k) { return this.all()[k] !== false; }, set(k, v) { const a = store.get('v5:prefs', {}) || {}; a[k] = !!v; store.set('v5:prefs', a); } };
  const chev = `<span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></span>`;
  const sec = (title, small, action) => `<div class="sec"><h2>${esc(title)}${small ? `<small>${esc(small)}</small>` : ''}</h2>${action || ''}</div>`;
  const empty = (title, body, cta) => `<div class="empty"><b>${esc(title)}</b>${body || ''}${cta || ''}</div>`;
  /* the placeholder while a screen loads: an outline of what is coming — a disc and two lines per row, two discs and a score line for a
     card — faint and breathing, never slabs. The marker lets the screen keep what it has while the next one loads. */
  const skeleton = (n = 3, kind = 'row') => '<!--skel-->' + Array.from({ length: n }, (_, i) => kind === 'card' ? `<div class="skel card"><i></i><b></b><i></i></div>` : `<div class="skel row"><i></i><b style="width:${[58, 44, 66, 50, 38, 62][i % 6]}%"></b><b style="width:${[34, 26, 40, 30, 22, 36][i % 6]}%"></b></div>`).join('');
  const recOf = t => t && t.rec ? t.rec : '';
  /* group names the way people say them: "Eastern Conference" is the East, "Southeast Division" is the Southeast,
     and a college conference loses the word Conference (the two everyone abbreviates get their initials) */
  const CONF_SHORT = { 'Atlantic Coast': 'ACC', 'Southeastern': 'SEC', 'American Athletic': 'American', 'Western Athletic': 'WAC', 'Mid-American': 'MAC', 'Mid-Eastern Athletic': 'MEAC', 'Southwestern Athletic': 'SWAC', 'Atlantic Sun': 'ASUN', 'Coastal Athletic Association': 'CAA' };
  const confName = (name, abbr) => { const n = String(name || ''); let m = n.match(/^(East|West)(ern)? Conference$/i); if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(); m = n.match(/^(\w+) Division$/i); if (m) return m[1]; if (/ Conference$/i.test(n)) { const base = n.replace(/ Conference$/i, ''); return CONF_SHORT[base] || base; } if (CONF_SHORT[n]) return CONF_SHORT[n]; if (abbr && String(abbr).length > 3) return String(abbr); return n || String(abbr || ''); };
  const dayUTC = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const standingLine = (r, L) => !r ? '' : L.standingsMode === 'conferences' ? `${r.w}-${r.l}` : `${r.w}-${r.l}, ${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}`;
  const starSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`;
  const starLine = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`;
  const tvLabel = g => (g.tv && g.tv.label) || '';
  const safeF = (L, g, ctx) => { try { return ctx ? forecast(L, g, ctx) : null; } catch { return null; } };

  /* followed players: a small snapshot per player so the rail paints before any fetch */
  const fplayers = {
    all() { return store.get('v5:players', []) || []; },
    has(lk, id) { return this.all().some(p => p.lk === lk && p.id === String(id)); },
    toggle(p) { const a = this.all(); const i = a.findIndex(x => x.lk === p.lk && x.id === String(p.id)); if (i >= 0) a.splice(i, 1); else a.push({ ...p, id: String(p.id) }); store.set('v5:players', a); return i < 0; },
    /* a follow is a snapshot taken the day it was made; the player's page and the league list bring it up to date (a trade, a new photo) */
    /* the order you keep them in, per league; the other leagues' players stay where they are */
    reorder(lk, ids) { const a = this.all(); const mine = a.filter(p => p.lk === lk); const byId = Object.fromEntries(mine.map(p => [p.id, p])); const want = ids.map(String).filter(id => byId[id]).map(id => byId[id]); const rest = mine.filter(p => !ids.map(String).includes(p.id)); const ordered = [...want, ...rest]; let i = 0; store.set('v5:players', a.map(p => p.lk === lk ? ordered[i++] : p)); },
    update(lk, id, patch) { const a = this.all(); const i = a.findIndex(x => x.lk === lk && x.id === String(id)); if (i < 0) return false; const cur = a[i]; const next = { ...cur }; let changed = false; Object.entries(patch).forEach(([k, v]) => { if (v != null && v !== '' && v !== cur[k]) { next[k] = v; changed = true; } }); if (changed) { a[i] = next; store.set('v5:players', a); } return changed; }
  };

  /* ---------- game cards ---------- */
  function statusLine(L, g, timeOnly) {
    if (g.state === 'in') return `<span class="live">${esc(g.detail || 'Live')}</span>`;
    if (timeOnly && g.state === 'pre') return `<span>${esc(tipOf(g))}</span>`;
    if (g.state === 'post') return `<span${g.off ? ' class="off"' : ''}>${esc(finalWord(g))}</span>`;
    return `<span>${esc(relDay(HW.ymdOf(g.date)))}, ${esc(tipOf(g))}</span>`;
  }
  function forecastRow(L, g, f) {
    if (!f || g.off) return '';
    const homeFav = f.pHome >= .5; const p = homeFav ? f.pHome : 1 - f.pHome; const fav = homeFav ? g.home : g.away;
    const note = g.state === 'post' ? '' : f.soH ? `${esc(f.soH.name)} out` : f.soA ? `${esc(f.soA.name)} out` : (f.restH && !f.restA) ? `${esc(g.home.short)} on a back-to-back` : (f.restA && !f.restH) ? `${esc(g.away.short)} on a back-to-back` : '';
    const label = g.state === 'post' ? `Had ${esc(fav.short)} ${pct(p)}` : `${esc(fav.short)} ${pct(p)}`;
    const proj = g.state === 'pre' && f.proj ? `${esc(g.away.abbr)} ${f.proj.away}–${f.proj.home} ${esc(g.home.abbr)}` : '';
    const small = [note, proj].filter(Boolean).join(' · ');
    return `<div class="fc"><div class="bar"><i style="width:${(f.pHome * 100).toFixed(1)}%;${tcv(teamColor(g.home, L))}"></i><i style="width:${((1 - f.pHome) * 100).toFixed(1)}%;${tcv(teamColor(g.away, L))}"></i></div><b>${label}${small ? `<small>${small}</small>` : ''}</b></div>`;
  }
  /* one team's line on a card: the side that is ahead (leading live, or the winner) gets its score in the team colour */
  /* 'NBA Cup - Semifinals' → 'NBA Cup Semifinals': the feed's note on a game whose teams aren't set */
  const noteWord = g => String(g.note || '').replace(/\s+-\s+/g, ' ').trim();
  /* The playoff line, everywhere a game appears: "WNBA Finals · Game 7 · Series tied 3-3". The round and game come from
     the event's own headline, the standing from the feed's series summary, verbatim — so it reads "GS leads series 3-2"
     exactly as ESPN writes it, and afterwards "GS wins series 4-3". Nothing is shown for a game that has no series. */
  const seriesParts = g => {
    const s = g.series; const n = noteWord(g);
    if (!s && !/game\s*\d|final|semi|quarter|round|playoff|tournament|championship|play-in/i.test(n)) return [];
    const head = n ? n.replace(/\s+Game\s+(\d+)/i, ' · Game $1') : [s && s.title, s && s.game ? `Game ${s.game}` : ''].filter(Boolean).join(' · ');
    return [head, s && s.summary].filter(Boolean);
  };
  const seriesLine = g => seriesParts(g).join(' · ');
  /* RIVL's pick for the series, when Win chances are on and the series is still open: "Valkyries 56% to take the series".
     Built from the game model — this game as forecast, the rest from team strength at the buildings the format sends them to. */
  const seriesPick = (L, g, f, ctx) => { try { if (!prefs.get('forecast') || !f || !ctx) return null; const sf = seriesForecast(L, g, f, ctx); if (!sf) return null; const home = sf.pHome >= .5; return { team: home ? g.home : g.away, p: home ? sf.pHome : 1 - sf.pHome, sf }; } catch { return null; } };
  const seriesPickText = pk => pk ? `${pk.team.short} ${pct(pk.p)} to take the series` : '';
  // the same, fit for a chip: "Finals G7", "Semis G3"
  const seriesShort = g => {
    const s = g.series; const n = noteWord(g); if (!s && !n) return ''; if (!s && !/game\s*\d|final|semi|quarter|round|playoff|tournament|championship|play-in/i.test(n)) return '';
    const round = (s && s.title) || n.replace(/\s*·?\s*Game\s*\d+.*$/i, '');
    const r = round.replace(/^(NBA|WNBA|NCAA)\s+/i, '').replace(/Semifinals?/i, 'Semis').replace(/Quarterfinals?/i, 'Quarters').replace(/First Round/i, 'Rd 1').replace(/Conference /i, '');
    const gm = (s && s.game) || +((n.match(/game\s*(\d+)/i) || [])[1] || 0);
    return [r, gm ? `G${gm}` : ''].filter(Boolean).join(' ');
  };
  function side(L, g, t, other) {
    if (t.tbd) return `<div class="side tbd"><span class="logo tbd"></span><span class="nm"><b>To be decided</b><span>${esc(noteWord(g))}</span></span></div>`;
    const has = g.state !== 'pre' && t.score != null && other.score != null;
    const lo = has && t.score < other.score, lead = has && t.score > other.score;
    const sc = g.state === 'pre' ? '' : `<span class="sc${lead ? ' on' : ''}${lead && g.state === 'post' ? ' won' : ''}">${t.score == null ? '' : t.score}</span>`;
    // the scoring leader, once the game is on: the scoreboard carries each side's leaders
    const top = g.state !== 'pre' && !g.off ? topScorer(t) : '';
    return `<div class="side${lo ? ' lo' : ''}" data-tid="${esc(t.id)}" style="${scVars(t, L)}">${logo(t.logo, '', teamColor(t, L))}<span class="nm"><b>${t.rank ? `<i>${t.rank}</i>` : ''}${esc(t.short || t.name)}</b><span>${esc(recOf(t))}${top ? `<em class="lead">${esc(top)}</em>` : ''}</span></span>${sc}</div>`;
  }
  /* "Jokic 28 pts" from a side's scoreboard leaders (points first; nothing if the feed has none yet) */
  const topScorer = t => { const L1 = (t.leaders || []).find(l => /^points$/i.test(l.name || '') || /points/i.test(l.displayName || '')); const a = L1 && L1.leaders && L1.leaders[0]; if (!a || !a.athlete || a.displayValue == null || a.displayValue === '') return ''; const v = parseFloat(a.displayValue); if (!isFinite(v) || v <= 0) return ''; return `${lastName(a.athlete.displayName || a.athlete.shortName || '')} ${Math.round(v)} pts`; };
  function gameCard(L, g, ctx, withForecast = true, timeOnly = false) {
    if (g.tbd) return `<a class="game tbd" href="${href.game(L.key, g.id)}" data-gid="${esc(g.id)}"><div class="side tbd"><span class="logo tbd"></span><span class="nm"><b>Teams to be decided</b><span>${esc(noteWord(g) || 'Matchup not set yet')}</span></span></div><div class="status">${statusLine(L, g, timeOnly)}<span class="ln"></span><span class="tv">${esc(tvLabel(g) || g.venue || '')}</span></div></a>`;
    const f = withForecast && prefs.get('forecast') && !g.tbd ? safeF(L, g, ctx) : null;
    // the band's series pick stands even where the per-game row is off (Scores), so it computes its own forecast when needed
    const ps = seriesLine(g); const pk = ps && prefs.get('forecast') && !g.tbd ? seriesPickText(seriesPick(L, g, f || safeF(L, g, ctx), ctx)) : '';
    return `<a class="game${ps ? ' po' : ''}" href="${href.game(L.key, g.id)}" data-gid="${esc(g.id)}">
      ${ps ? `<div class="pstrip"><span>${esc(ps)}</span>${pk ? `<b>${esc(pk)}</b>` : ''}</div>` : ''}
      ${side(L, g, g.away, g.home)}
      <div class="status">${statusLine(L, g, timeOnly)}<span class="ln"></span><span class="tv">${esc(tvLabel(g) || g.venue || '')}</span></div>
      ${side(L, g, g.home, g.away)}
      ${forecastRow(L, g, f)}</a>`;
  }
  /* the hero: on Home it is one link to the game; on the game page each team is a link to its own page */
  function heroCard(L, g, ctx, { page = false } = {}) {
    const f = prefs.get('forecast') && !g.tbd ? safeF(L, g, ctx) : null;
    const a = teamColor(g.away, L), b = teamColor(g.home, L);
    const fav = f ? (f.pHome >= .5 ? g.home : g.away) : null; const p = f ? Math.max(f.pHome, 1 - f.pHome) : 0;
    const favC = fav ? V_lift(teamColor(fav, L)) : '#fff';   // the bar wears the favourite's own colour — the one its panel above is painted in — lifted so it reads on the dark strip
    const tm = t => t.tbd ? `<div class="tm"><span class="logo tbd"></span><b>TBD</b><span>${esc(noteWord(g))}</span></div>` : page ? `<a class="tm" href="${href.team(L.key, t.id)}" aria-label="${esc(t.name || t.short)} team page">${logo(t.logo, 'hero')}<b>${esc(t.short || t.name)}</b><span>${esc(recOf(t))}</span></a>` : `<div class="tm">${logo(t.logo, 'hero')}<b>${esc(t.short || t.name)}</b><span>${esc(recOf(t))}</span></div>`;
    const inner = `<div class="in">
      <div class="vs">${tm(g.away)}<div class="mid"><span class="st${g.state === 'in' ? ' on' : ''}">${esc(g.state === 'in' ? g.detail : g.state === 'post' ? finalWord(g) : tipOf(g))}</span>${g.off || g.state === 'pre' || g.home.score == null || g.away.score == null ? '' : `<div class="sc">${g.away.score}<i>–</i>${g.home.score}</div>`}<span class="tv">${esc(tvLabel(g) || g.venue || '')}</span></div>${tm(g.home)}</div>
      ${f && !g.off ? `<div class="fc${f.pHome >= .5 ? ' home' : ''}"><div class="bar"><i style="width:${(p * 100).toFixed(1)}%;background:${esc(favC)}"></i></div><b>${g.state === 'post' ? 'Had ' : ''}${esc(fav.short)} ${pct(p)}${g.state === 'pre' && f.proj ? `<small>${esc(g.away.abbr)} ${f.proj.away}–${f.proj.home} ${esc(g.home.abbr)}</small>` : ''}</b></div>` : ''}
    </div>`;
    return page ? `<div class="hero page" data-gid="${esc(g.id)}" style="--a:${esc(a)};--b:${esc(b)}">${inner}</div>`
      : `<a class="hero" href="${href.game(L.key, g.id)}" data-gid="${esc(g.id)}" style="--a:${esc(a)};--b:${esc(b)}">${inner}</a>`;
  }

  /* ---------- team info: logo/colour from the league list, record from standings, next game from the schedule ----------
     (the bare /teams/{id} endpoint is used only as an extra; the row renders without it) ---------- */
  async function teamInfo(L, id, pre) {
    id = String(id);
    const [idx, st, sched] = await Promise.all([pre && pre.idx ? pre.idx : teamsIndex(L), pre && pre.st !== undefined ? pre.st : standings(L).catch(() => null), jSoft(`${API(L)}/teams/${id}/schedule`, 300000)]);
    const r = st && st.byId && st.byId[id];
    // the bare team record is one more request per team; it is only worth it when the standings or the schedule came up empty
    const extra = (!r || !sched || !(idx[id] || r)) ? await jSoft(`${API(L)}/teams/${id}`, 600000) : null; const x = extra && extra.team;
    if (sched && sched.team) learn(L, { id, ...sched.team }); if (x) learn(L, { id, ...x });
    const t = idx[id] || (r ? { id: r.id, abbr: r.abbr, name: r.name, short: r.short, loc: r.loc, color: '', logo: r.logo } : {});
    if (!t.id && !x) return { id, abbr: '', name: 'Team', short: 'Team', color: '', logo: '', rec: '', standing: 'Feed is slow, pull to refresh', row: null, next: null, last: null };
    const evs = (sched && sched.events || []).map(e => { try { return parseEvent(e, L); } catch { return null; } }).filter(Boolean);
    const next = evs.find(g => g.state !== 'post') || (x && x.nextEvent && x.nextEvent[0] ? (() => { try { return parseEvent(x.nextEvent[0], L); } catch { return null; } })() : null);
    const last = evs.filter(isDone).slice(-1)[0] || null;
    const recItem = x && x.record && x.record.items && (x.record.items.find(i => i.type === 'total') || x.record.items[0]);
    return { id, abbr: t.abbr || (x && x.abbreviation), name: t.name || (x && x.displayName), short: t.short || (x && x.shortDisplayName), loc: t.loc, color: teamColor({ id, color: t.color || (x && x.color) || '' }, L), alt: teamAlt({ id, alt: t.alt || (x && x.alternateColor) || '' }, L),
      logo: t.logo || (x && x.logos && x.logos[0] && x.logos[0].href) || HW.logoUrl(L, t.abbr || (x && x.abbreviation)),
      rec: r ? `${r.w}-${r.l}` : (recItem && recItem.summary) || '', standing: r && L.standingsMode !== 'conferences' ? `${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}` : (x && x.standingSummary) || '', row: r, next, last };
  }

  /* every team in the league, keyed by id: colour and logo for discs and rails */
  async function teamsIndex(L) {
    if (teamIdx[L.key]) return teamIdx[L.key];
    // a copy kept on the device from the last good fetch: colours and logos never depend on tonight's feed
    const kept = store.get(`v5:teams:${L.key}`, null);
    if (kept && kept.t && Date.now() - kept.t < 7 * 864e5 && kept.idx && Object.keys(kept.idx).length) { teamIdx[L.key] = kept.idx; if (Date.now() - kept.t > 864e5) refreshTeams(L); return kept.idx; }
    const idx = await fetchTeams(L);
    if (idx) { teamIdx[L.key] = idx; store.set(`v5:teams:${L.key}`, { t: Date.now(), idx }); return idx; }
    if (kept && kept.idx) { teamIdx[L.key] = kept.idx; return kept.idx; }   // stale is better than colourless
    const out = {};   // nothing at all: names and logos from the standings, colours when the list comes back
    const st = await standings(L).catch(() => null);
    if (st && st.byId) Object.values(st.byId).forEach(r => { const ln = pool(L.key)[String(r.id)] || {}; out[r.id] = { id: r.id, abbr: r.abbr, name: r.name, short: r.short, loc: r.loc, color: ln.color || '', alt: ln.alt || '', logo: r.logo || ln.logo }; });
    return out;
  }
  async function fetchTeams(L) {
    let d = await jSoft(`${API(L)}/teams?limit=500`, 3600000);
    if (!d) d = await jSoft(`${API(L)}/teams?limit=500`, 0);   // one retry: the feed drops bursts of requests on busy nights
    const list = d && d.sports && d.sports[0] && d.sports[0].leagues && d.sports[0].leagues[0] && d.sports[0].leagues[0].teams || [];
    if (!list.length) return null;
    const idx = {}; list.forEach(x => { const t = x.team || x; idx[String(t.id)] = { id: String(t.id), abbr: t.abbreviation, name: t.displayName, short: t.shortDisplayName || t.name, loc: t.location, color: t.color ? hx(t.color) : '', alt: t.alternateColor ? hx(t.alternateColor) : '', logo: t.logos && t.logos[0] && t.logos[0].href }; });
    return idx;
  }
  async function refreshTeams(L) { const idx = await fetchTeams(L).catch(() => null); if (idx) { teamIdx[L.key] = idx; store.set(`v5:teams:${L.key}`, { t: Date.now(), idx }); } }

  /* ================= HOME: your teams, your players, nothing else =================
     Home is a pipeline. The first paint needs only what is already on hand or one round trip away (today's and last
     night's scoreboards, standings, the forecast context); schedules, box scores and news fill their sections in a
     moment later. Each section is patched in place by a content hash, so later data and the quiet refresh that runs
     while the app is open never repaint what hasn't changed, and never move the page under your thumb. */
  const rankGame = g => (isFav(g) ? 1000 : 0) + (g.tv.national.length ? 100 : 0) + interest(g) / 1000;
  const hashOf = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const SECS = ['wire', 'live', 'tonight', 'last', 'teams', 'players', 'injuries', 'news'];   // the wire first when it has something, then a game on now
  let homeToken = 0;
  async function home(lk) {
    const L = LEAGUES[lk]; const today = todayCT(); const token = ++homeToken;
    const mine = favs.all()[lk] || [];
    const fp = fplayers.all().filter(p => p.lk === lk);
    if (!mine.length && !fp.length) {
      $main.innerHTML = `<div class="page-h"><h1>Make it yours</h1><p>Home shows only the teams and players you follow.</p></div>` + empty('Nothing followed yet', '<p style="margin:6px 0 0">Pick a few teams and players and this screen fills with their games, lines, injuries and news.</p>', `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><a class="btn" href="#teams">Choose teams</a><a class="btn ghost" href="#players">Find players</a></div>`);
      return;
    }
    $main.innerHTML = skeleton(1, 'card') + skeleton(4, 'row');
    const P = prefs.all(); const yday = addDays(today, -1);
    const alive = () => { if (token !== homeToken) return false; const r = HW.v5.route && HW.v5.route(); return !r || (r.name === 'home' && r.lk === lk); };   // still the screen being shown, even while the old one is kept on screen during the load
    const secs = {}; let painted = false;
    const wrap = (k, quiet) => `<section class="hsec${quiet ? ' quiet' : ''}" data-sec="${k}" data-h="${hashOf(secs[k])}">${secs[k]}</section>`;
    // two columns on a wide screen (the games and your people on the left, injuries and news on the right); one stack on a phone
    const SIDE = new Set(['injuries', 'news']);
    const col = k => $main.querySelector(SIDE.has(k) ? '.hcol.side' : '.hcol.main') || $main;
    const paint = (quiet = false) => {
      if (!alive()) return;
      if (!painted) {
        painted = true;
        const colHtml = side => SECS.filter(k => SIDE.has(k) === side && secs[k]).map(k => wrap(k, false)).join('');
        $main.innerHTML = SECS.some(k => secs[k]) ? `<div class="hcols"><div class="hcol main">${colHtml(false)}</div><div class="hcol side">${colHtml(true)}</div></div>` : empty('Everything is switched off', '<p style="margin:6px 0 0">Turn some sections back on and Home fills up again.</p>', `<a class="btn" href="#settings">Settings</a>`);
        return;
      }
      if (!$main.querySelector('.hcols')) { painted = false; return paint(quiet); }   // the empty state is on screen and something arrived
      SECS.forEach(k => {
        const cur = $main.querySelector(`section[data-sec="${k}"]`);
        if (!secs[k]) { if (cur) cur.remove(); return; }
        if (cur) { if (cur.dataset.h !== hashOf(secs[k])) cur.outerHTML = wrap(k, quiet); return; }
        const after = SECS.slice(SECS.indexOf(k) + 1).filter(j => SIDE.has(j) === SIDE.has(k)).map(j => $main.querySelector(`section[data-sec="${j}"]`)).find(Boolean);
        if (after) after.insertAdjacentHTML('beforebegin', wrap(k, quiet)); else col(k).insertAdjacentHTML('beforeend', wrap(k, quiet));
      });
    };

    // ----- what everything is built from -----
    const S0 = { games: [], last: [], ctx: null, st: null, tIdx: {}, teams: null, sums: {}, news: null, inj: null };
    const favTeam = t => mine.includes(String(t.id));
    const teamOf = p => { const k = String(p.team || '').toLowerCase(); return t => (p.teamId && String(t.id) === String(p.teamId)) || (k && [t.abbr, t.short, t.name].some(x => String(x || '').toLowerCase() === k)); };
    const chipOf = g => { const sc = g.off ? `<span>${esc(g.off)}</span>` : g.state === 'pre' ? `<span>${esc(tipOf(g))}</span>` : g.state === 'in' ? `<span class="on">${g.away.score}–${g.home.score} · ${esc(g.detail)}</span>` : `<span>${g.away.score}–${g.home.score} · ${esc(finalWord(g))}</span>`; return `<a class="bchip" href="${href.game(lk, g.id)}">${logo(g.away.logo, 's', teamColor(g.away, L))}<b>${esc(g.away.abbr || g.away.short)}</b><i>${g.neutral ? 'vs' : 'at'}</i>${logo(g.home.logo, 's', teamColor(g.home, L))}<b>${esc(g.home.abbr || g.home.short)}</b>${sc}${seriesShort(g) ? `<em class="po">${esc(seriesShort(g))}</em>` : ''}</a>`; };
    const dayWord = (ymd, long) => { const rd = relDay(ymd); return rd === 'Tomorrow' || rd === 'Tonight' ? rd : dayLabel(ymd, { weekday: long ? 'long' : 'short' }); };
    const nextChip = g => `<a class="bchip next" href="${href.game(lk, g.id)}"><em>${esc(dayWord(HW.ymdOf(g.date)))}</em>${logo(g.away.logo, 's', teamColor(g.away, L))}<b>${esc(g.away.abbr || g.away.short)}</b><i>${g.neutral ? 'vs' : 'at'}</i>${logo(g.home.logo, 's', teamColor(g.home, L))}<b>${esc(g.home.abbr || g.home.short)}</b><span>${esc(tipOf(g))}</span></a>`;
    const basicTeam = id => { const t = S0.tIdx[id]; const r = S0.st && S0.st.byId && S0.st.byId[id]; if (!t && !r) return null; return { id, abbr: t ? t.abbr : r.abbr, name: t ? t.name : r.name, short: t ? t.short : r.short, loc: t ? t.loc : r.loc, color: teamColor({ id, color: t && t.color }, L), logo: (t && t.logo) || (r && r.logo) || '', rec: r ? `${r.w}-${r.l}` : '', standing: r && L.standingsMode !== 'conferences' ? `${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}` : '', row: r || null, next: null, last: null }; };
    const teamList = () => S0.teams ? S0.teams.filter(Boolean) : mine.map(basicTeam).filter(Boolean);

    const build = () => {
      const { games, last, ctx } = S0; const teams = teamList();
      const byTeam = new Map(); games.forEach(g => { byTeam.set(g.home.id, g); byTeam.set(g.away.id, g); });
      // tonight: your games, or the next ones on the calendar once the schedules are in
      const liveMine = games.filter(g => isLive(g) && isFav(g));
      if (P.brief && mine.length && !(P.live && liveMine.length && games.filter(isFav).length === liveMine.length)) {   // when every game of yours is on now, the hero says it all
        const tonight = games.filter(g => isFav(g) && !(P.live && isLive(g))).sort((a, b) => rankGame(b) - rankGame(a) || new Date(a.date) - new Date(b.date));
        let body = '', note = '', title = 'Tonight';
        if (tonight.length) { note = `${tonight.length} ${P.live && liveMine.length ? 'more ' : ''}game${tonight.length === 1 ? '' : 's'} for your teams`; body = `<div class="brief-row">${tonight.map(chipOf).join('')}</div>`; }
        else {
          // nothing tonight: the block is the next games instead, headed by when they are, so a chip never sits under "no games"
          const seen = new Set(); const next = teams.map(t => t.next).filter(g => g && g.state === 'pre' && !seen.has(g.id) && seen.add(g.id)).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);
          if (next.length) { const d0 = HW.ymdOf(next[0].date); const w = dayWord(d0, true); title = 'Next up'; note = `${esc(w === 'Tonight' ? 'later tonight' : w === 'Tomorrow' ? 'tomorrow' : w)} · nothing tonight`; body = `<div class="brief-row">${next.map(nextChip).join('')}</div>`; }
          else note = S0.teams ? 'no games for your teams' : 'no games tonight';
        }
        secs.tonight = `<div class="brief"><div class="brief-h"><b>${title}</b><span>${note}</span></div>${body}</div>`;
      } else delete secs.tonight;
      // last night: results, then your players' lines once the box scores are in
      const pGames = fp.map(p => { const is = teamOf(p); const g = last.find(g => isDone(g) && (is(g.home) || is(g.away))); return g ? { p, g } : null; }).filter(Boolean);
      const lines = pGames.map(({ p, g }) => { const d = S0.sums[g.id]; const bx = d && d.boxscore && d.boxscore.players || []; for (const side of bx) { const st = side.statistics && side.statistics[0]; if (!st) continue; const labels = st.labels || st.names || []; const a = (st.athletes || []).find(x => x.athlete && String(x.athlete.id) === p.id); if (!a) continue; if (a.didNotPlay || !a.stats || !a.stats.length) return { p, g, dnp: a.reason || 'Did not play' }; const get = l => { const i = labels.indexOf(l); return i >= 0 ? a.stats[i] : ''; }; const is = teamOf(p); const us = is(g.home) ? g.home : g.away, them = is(g.home) ? g.away : g.home; return { p, g, pts: get('PTS'), reb: get('REB'), ast: get('AST'), min: get('MIN'), won: us.score > them.score, us, them }; } return null; }).filter(Boolean);
      const lineBy = {}; lines.forEach(x => { lineBy[x.p.id] = x; });
      if (P.brief) {
        const mineLast = last.filter(g => isDone(g) && isFav(g));
        if (mineLast.length || lines.length) {
          const res = mineLast.map(g => { const us = favTeam(g.home) ? g.home : g.away, them = us === g.home ? g.away : g.home; const won = us.score > them.score; return `<a class="bchip res" href="${href.game(lk, g.id)}">${logo(us.logo, 's', teamColor(us, L))}<b class="${won ? 'w' : 'l'}">${won ? 'W' : 'L'}</b><span>${us.score}–${them.score} ${us === g.home ? 'vs' : 'at'} ${esc(them.abbr || them.short)}</span></a>`; });
          const rows = lines.map(x => `<a class="row" href="${href.game(lk, x.g.id)}/p/${esc(String(x.p.id))}">${headshot(x.p.img, x.us ? teamColor(x.us, L) : playerColor(x.p, L), 44, x.p.name)}<span class="t"><b>${esc(x.p.short || x.p.name)}</b><span>${x.dnp ? esc(x.dnp) : `${esc(x.pts)} pts, ${esc(x.reb)} reb, ${esc(x.ast)} ast in a ${x.won ? 'win' : 'loss'} ${x.us === x.g.home ? 'vs' : 'at'} ${esc(x.them.short)}`}</span></span>${x.dnp ? '' : `<span class="r"><b>${esc(x.pts)}</b><span>pts</span></span>`}</a>`);
          secs.last = `<div class="brief"><div class="brief-h"><b>Last night</b><span>${esc(dayLabel(yday, { weekday: 'long' }))}</span></div>${res.length ? `<div class="brief-row">${res.join('')}</div>` : ''}${rows.length ? `<div class="rows brief-rows">${rows.join('')}</div>` : ''}</div>`;
        } else delete secs.last;
      }
      // your teams playing right now: the hero
      const live = games.filter(g => isLive(g) && isFav(g)).sort((a, b) => rankGame(b) - rankGame(a));
      if (live.length && P.live) secs.live = sec('Live now') + `<div class="heroes">${live.map(g => heroCard(L, g, ctx)).join('')}</div>`; else delete secs.live;
      // my teams: record, what's next or how it's going, win chance
      if (P.teams) {
        const rows = teams.map(t => {
          const g = byTeam.get(t.id) || t.next || t.last; const f = g ? safeF(L, g, ctx) : null;
          const us = g ? (g.home.id === t.id ? g.home : g.away) : null, them = g ? (g.home.id === t.id ? g.away : g.home) : null;
          let line = t.standing || (S0.teams ? 'No game scheduled' : ''), right = '';
          if (g) {
            const home = g.home.id === t.id; const vs = `${home ? 'vs' : 'at'} ${esc(them.short)}`;
            if (g.state === 'in') { const lead = us.score - them.score; line = `${lead > 0 ? `Leading ${esc(them.short)} by ${lead}` : lead < 0 ? `Trailing ${esc(them.short)} by ${-lead}` : `Tied with ${esc(them.short)}`}, ${esc(g.detail)}`; }
            else if (g.off) line = `${esc(g.off)} ${vs}`;
            else if (g.state === 'post') line = `${us.score > them.score ? 'Won' : 'Lost'} ${esc(String(us.score))}-${esc(String(them.score))} ${vs}`;
            else line = `<em>${esc(relDay(HW.ymdOf(g.date)))} ${vs}, ${esc(tipOf(g))}</em>${tvLabel(g) ? `<i class="tvt">${esc(tvLabel(g))}</i>` : ''}`;
            if (f && g.state !== 'post') { const p = home ? f.pHome : 1 - f.pHome; right = `<span class="r"><b>${pct(p)}</b><span>to win</span></span>`; }
            else if (g.state === 'post' && !g.off) right = `<span class="r"><b class="${us.score > them.score ? 'res w' : 'res l'}" style="font-size:22px">${us.score > them.score ? 'W' : 'L'}</b></span>`;
          }
          const to = g ? href.game(lk, g.id) : href.team(lk, t.id);
          return `<div class="row prow teamrow"><a class="go" href="${href.team(lk, t.id)}" aria-label="${esc(t.name || t.short)} team page">${logo(t.logo, '', teamColor(t, L))}</a><a class="t2" href="${to}"><span class="t"><b>${esc(t.short)}<small>${esc(t.rec)}</small></b><span class="${line.includes('<em>') ? 'sub2' : ''}">${line || '&nbsp;'}</span></span>${right || chev}</a></div>`;
        });
        secs.teams = sec('My teams', '', `<a href="#teams">Edit</a>`) + (rows.length ? `<div class="rows">${rows.join('')}</div>` : mine.length ? skeleton(mine.length, 'row') : empty('No teams yet', '', `<a class="btn" href="#teams">Choose teams</a>`));
      } else delete secs.teams;
      // my players
      if (P.players) {
        const ppgOf = p => { const r = ctx && ctx.ppg && ctx.ppg[(p.name || '').toLowerCase()]; return r && r.pts != null ? `${(+r.pts).toFixed(1)} ppg` : ''; };
        secs.players = sec('My players', '', `<a href="#players">${fp.length ? 'Edit' : 'Find players'}</a>`) + (fp.length
          ? `<div class="rail">${fp.map(p => { const is = teamOf(p); const g = games.find(g => is(g.home) || is(g.away)); const us = g ? (is(g.home) ? g.home : g.away) : null, them = g ? (is(g.home) ? g.away : g.home) : null;
            // under the average: the game tonight, short (on now, the tip, or the result); last night's line lives in the Last night block above
            const now = g && !g.off ? (g.state === 'in' ? `<i class="on">${us.score}–${them.score}</i> ${esc(g.detail)}` : g.state === 'post' ? `${us.score > them.score ? 'W' : 'L'} ${us.score}–${them.score}` : `${esc(tipOf(g))} ${g.neutral ? 'vs' : is(g.home) ? 'vs' : 'at'} ${esc(them.abbr)}`) : '';
            return `<a class="pl" href="${href.player(lk, p.id)}" style="${tcv(playerColor(p, L))}">${headshot(p.img, playerColor(p, L), 64, p.name)}<b>${esc(p.short || p.name)}</b><span>${esc(ppgOf(p) || p.team || '')}</span>${now ? `<em class="nx">${now}</em>` : ''}</a>`; }).join('')}</div>`
          : empty('Follow the players you watch', '<p style="margin:6px 0 0">They show up here with their scoring line, and their profile is one tap away.</p>', `<a class="btn" href="#players">Find players</a>`));
      } else delete secs.players;
      // injuries: one list grouped by team. Your teams show every report, with your players marked; a team you don't
      // follow appears only for the players you follow on it. Rows are keyed by the report, so two reports on one player never collide.
      const inj = S0.inj;
      if (inj && P.injuries) {
        S.injuries = S.injuries || {};
        const pById = new Map(fp.map(p => [p.id, p]));
        const row = (x, i, t, p) => { const a = x.athlete || {}; const id = athId(a) || (p && p.id) || ''; const key = `h:${t.id}:${id}:${x.id || i}`; S.injuries[key] = { x, id, team: t }; const st = x.status || ''; const cls = /out/i.test(st) ? 'out' : /day|quest|doubt/i.test(st) ? 'q' : /prob|avail/i.test(st) ? 'ok' : ''; const det = x.details || {}; const ret = retInfo(L, det.returnDate); const why = [det.type || det.detail, ret ? ret.short : ''].filter(Boolean).join(', '); const name = a.displayName || (p && p.name) || ''; return `<button class="row${p ? ' fav' : ''}" data-act="injury" data-key="${esc(key)}">${headshot(hsUrl(a) || (p && p.img) || '', teamColor(t, L), 44, name)}<span class="t"><b>${esc(name)}${p ? `<i class="fstar" title="You follow them">${starSvg}</i>` : ''}</b><span>${esc(why || (x.shortComment || '').slice(0, 80))}</span></span><span class="tag ${cls}">${esc(statusWord(st))}</span></button>`; };
        const groups = [];
        teams.forEach(t => { const b = inj.byTeam[t.id]; if (b && b.list.length) groups.push({ t, rows: b.list.map((x, i) => ({ x, i, p: pById.get(athId(x.athlete)) || null })) }); });
        const have = new Set(groups.map(g => g.t.id));
        if (fp.length) (inj.teams || []).forEach(tt => { const tid = String(tt.id || ''); if (!tid || have.has(tid)) return; const rows = (tt.injuries || []).map((x, i) => ({ x, i, p: pById.get(athId(x.athlete)) || null })).filter(r => r.p); if (!rows.length) return; const ti = S0.tIdx[tid] || {}; groups.push({ t: { id: tid, short: ti.short || tt.displayName || rows[0].p.team || '', logo: ti.logo || '', color: ti.color || playerColor(rows[0].p, L) }, rows, only: true }); });
        const folds = store.get('v5:injcol', {}) || {};
        const blocks = groups.map(({ t, rows, only }) => `<div class="injgrp"><button class="injhd" data-act="injcol" data-id="${esc(t.id)}" aria-expanded="${!folds[t.id]}" style="${tcv(teamColor(t, L))}"><i class="bar"></i>${logo(t.logo, 's')}<b>${esc(t.short)}</b><span class="n">${only ? 'your players' : `${rows.length} listed`}</span>${chev}</button>${foldWrap(`<div class="injbody">${rows.map(({ x, i, p }) => row(x, i, t, p)).join('')}</div>`, !!folds[t.id])}</div>`);
        if (blocks.length) secs.injuries = sec('Injuries', 'your teams and players') + `<div class="rows">${blocks.join('')}</div>`; else delete secs.injuries;
      } else delete secs.injuries;
      // news about my teams and players: ESPN tags every story with the teams and athletes it covers; full names are the fallback
      const news = S0.news;
      const tIds = new Set(mine.map(String)), pIds = new Set(fp.map(p => p.id));
      const tagged = a => (a.categories || []).some(c => (c.type === 'team' && tIds.has(String(c.teamId || (c.team && c.team.id) || ''))) || (c.type === 'athlete' && pIds.has(String(c.athleteId || (c.athlete && c.athlete.id) || ''))));
      // the wire: ESPN's news posts about your teams and players from the last eight hours, newest first, until dismissed
      if (P.wire && news && news.articles) {
        const seen = new Set(store.get('v5:wire:seen', []) || []); const cutoff = Date.now() - 8 * 3600000;
        const items = news.articles.filter(a => HW.readable(a) && HW.isWire(a) && tagged(a) && !seen.has(String(a.id)) && a.published && new Date(a.published) > cutoff).sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 3);
        if (items.length) {
          const who = a => { const t = HW.wireTeams(a).map(id => (S0.tIdx[id] || {}).short).filter(Boolean); const p = (a.categories || []).filter(c => c.type === 'athlete' && pIds.has(String(c.athleteId || (c.athlete && c.athlete.id) || ''))).map(c => c.description).filter(Boolean); return [...new Set([...p, ...t])].slice(0, 2).join(' · '); };
          secs.wire = `<div class="wire"><div class="wh"><i class="dot"></i><b>Breaking</b><span>${esc(ago(items[0].published))}</span><button class="x" data-act="wire-x" data-ids="${esc(items.map(a => a.id).join(','))}" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>${items.map(a => { (S.news = S.news || {})[String(a.id)] = a; return `<a class="wr" href="#article/${lk}/${esc(String(a.id))}"><b>${esc(a.headline)}</b><span>${esc([who(a), items.length > 1 ? ago(a.published) : ''].filter(Boolean).join(' · '))}</span></a>`; }).join('')}</div>`;
        } else delete secs.wire;
      } else delete secs.wire;
      if (P.news && news) {
        const tNames = teams.flatMap(t => [t.name, t.short, t.loc]).filter(n => n && n.length > 3);
        const pNames = fp.map(p => p.name).filter(n => n && n.length > 3);
        const named = a => { const txt = `${a.headline || ''} ${a.description || ''}`; return pNames.some(n => txt.includes(n)) || tNames.some(n => txt.includes(n)); };
        // yours first; when the feed has little or nothing on your teams and players, the league's own stories fill the column
        const all = (news.articles || []).filter(HW.readable);
        const mineA = all.filter(a => tagged(a) || named(a)).slice(0, 6);
        const rest = mineA.length < 3 ? all.filter(a => !mineA.includes(a)).slice(0, 6 - mineA.length) : [];
        const arts = mineA.concat(rest);
        if (arts.length) secs.news = sec('News', mineA.length && !rest.length ? 'your teams and players' : mineA.length ? 'yours first, then the league' : 'around the league') + `<div class="rows">${arts.map(a => HW.v5.newsRow(lk, a)).join('')}</div>`; else delete secs.news;
      } else delete secs.news;
    };

    // ----- phase 1: one round trip, then paint -----
    const [tIdx, games, last, ctx, st] = await Promise.all([
      teamsIndex(L),
      S.today[lk] && S.today[lk].length ? S.today[lk] : scoreboard(L, today).catch(() => []),
      scoreboard(L, yday, 600000).catch(() => []),
      forecastCtx(L, today).catch(() => null),
      standings(L).catch(() => null)
    ]);
    if (!alive()) return;
    Object.assign(S0, { tIdx, games, last, ctx, st, inj: ctx && ctx.inj ? ctx.inj : null });
    S.today[lk] = games;
    build(); paint();

    // ----- phase 2: schedules, box scores, news — each patches its section as it lands -----
    const later = [];
    if (mine.length) later.push((async () => { const teams = await Promise.all(mine.map(id => teamInfo(L, id, { idx: tIdx, st }).catch(() => null))); if (!alive()) return; S0.teams = teams; build(); paint(); })());
    if (P.brief && fp.length) later.push((async () => {
      const ids = [...new Set(fp.map(p => { const is = teamOf(p); const g = last.find(g => isDone(g) && (is(g.home) || is(g.away))); return g ? g.id : null; }).filter(Boolean))];
      await Promise.all(ids.map(async id => { S0.sums[id] = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, 3600000); }));
      if (!alive()) return; build(); paint();
    })());
    if (P.news || P.wire) later.push((async () => { S0.news = await jSoft(`${API(L)}/news?limit=25`, 600000); if (!alive()) return; build(); paint(); })());
    if (!S0.inj && mine.length && P.injuries) later.push((async () => { S0.inj = await injuries(L).catch(() => null); if (!alive()) return; build(); paint(); })());
    Promise.all(later).catch(() => { });

    // ----- while the app sits on Home: scores every pass, the rest every few minutes, patched quietly -----
    let quietAt = Date.now();
    HW.v5.refresh = async () => {
      if (!alive()) return;
      S0.games = S.today[lk] || S0.games;
      const due = Date.now() - quietAt > 180000;
      if (due) {
        quietAt = Date.now();
        try { for (const k of [...HW.cache.keys()]) if (/\/injuries|\/news\?|\/summary\?event=/.test(k) && k.includes(L.path)) HW.cache.delete(k); } catch { }
        const [last2, inj2, news2] = await Promise.all([scoreboard(L, yday, 0).catch(() => null), mine.length && P.injuries ? injuries(L).catch(() => null) : null, P.news || P.wire ? jSoft(`${API(L)}/news?limit=25`, 0) : null]);
        if (!alive()) return;
        if (last2) S0.last = last2; if (inj2) S0.inj = inj2; if (news2) S0.news = news2;
        if (fp.length) { const ids = [...new Set(fp.map(p => { const is = teamOf(p); const g = S0.last.find(g => isDone(g) && (is(g.home) || is(g.away))); return g ? g.id : null; }).filter(Boolean))]; await Promise.all(ids.map(async id => { const d = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, 0); if (d) S0.sums[id] = d; })); }
        if (!alive()) return;
      }
      build(); paint(true);
    };
    HW.v5.refresh.every = 90000;
  }

  /* ================= SCORES: every game, compact ================= */
  async function scores(lk) {
    const L = LEAGUES[lk]; const today = todayCT();
    let ymd = store.get('v5:date', today); if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || Math.abs(new Date(ymd) - new Date(today)) > 200 * 864e5) ymd = today;
    const far = Math.abs(new Date(ymd) - new Date(today)) > 4 * 864e5; const center = far ? ymd : today;
    const mineOnly = !!store.get('v5:scmine', false) && (favs.all()[lk] || []).length > 0;
    const days = Array.from({ length: 9 }, (_, i) => addDays(center, i - 4));
    const dayBtn = (d, lab) => `<button class="day${d === ymd ? ' on' : ''}" data-act="date" data-ymd="${d}" aria-pressed="${d === ymd}"><em>${esc(lab)}</em><b>${d.slice(8) === '01' && lab !== 'Today' ? esc(dayLabel(d, { month: 'short' })) + ' ' : ''}${+d.slice(8)}</b></button>`;
    const calPill = `<div class="calrow"><span id="phase"></span><button class="chip cal" data-act="calendar" data-ymd="${esc(ymd)}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>${esc(dayLabel(ymd, { month: 'long', year: 'numeric' }))}<svg class="dn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>${(favs.all()[lk] || []).length ? `<button class="chip mine${mineOnly ? ' on' : ''}" data-act="scmine" aria-pressed="${mineOnly}">${starSvg}Mine</button>` : '<span></span>'}</div>`;
    const strip = calPill + `<div class="dates" id="dates">${far ? dayBtn(today, 'Today') + '<span class="gap"></span>' : ''}${days.map(d => dayBtn(d, d === today ? 'Today' : dayLabel(d, { weekday: 'short' }))).join('')}</div>`;
    const head = strip;
    /* the page is two parts: the date strip, which only moves its highlight from one day to the next (and is rebuilt when
       the window of days shifts), and the list below it, which swaps. A day change never repaints the strip or the screen. */
    const page0 = $main.querySelector('#scpage');
    const inPlace = page0 && page0.dataset.lk === lk;
    const hashOf = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    const paint = body => {
      const page = $main.querySelector('#scpage');
      if (page && page.dataset.lk === lk) {
        const hd = page.querySelector('#schead'); const hh = hashOf(head);
        if (hd.dataset.h !== hh) {
          const dates = hd.querySelector('#dates'); const same = dates && [...dates.querySelectorAll('.day')].map(b => b.dataset.ymd).join() === (far ? [today, ...days] : days).join();
          if (same) {   // the same window of days: move the highlight, and refresh the small row above it (month, Mine) in place
            dates.querySelectorAll('.day').forEach(b => { const on = b.dataset.ymd === ymd; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
            const cr = hd.querySelector('.calrow'); if (cr) { const tmp = document.createElement('div'); tmp.innerHTML = calPill; cr.replaceWith(tmp.firstElementChild); }
          } else hd.innerHTML = head;
          hd.dataset.h = hh;
        }
        const bd = page.querySelector('#scbody'); const bh = hashOf(body); if (bd.dataset.h !== bh) { const dayChanged = bd.dataset.d !== ymd; bd.innerHTML = body; bd.dataset.h = bh; bd.dataset.d = ymd; if (dayChanged && HW.v5.soft) HW.v5.soft(bd); }
        if (HW.v5.busy) HW.v5.busy(false);
      } else $main.innerHTML = `<div id="scpage" data-lk="${lk}"><div id="schead" data-h="${hashOf(head)}">${head}</div><div id="scbody">${body}</div></div>`;
    };
    if (inPlace) { paint($main.querySelector("#scbody").innerHTML); if (HW.v5.busy) HW.v5.busy(true); } else $main.innerHTML = `<div id="scpage" data-lk="${lk}"><div id="schead" data-h="${hashOf(head)}">${head}</div><div id="scbody">${skeleton(4, 'card')}</div></div>`;
    const [games, ctx, meta] = await Promise.all([ymd === today && S.today[lk] && S.today[lk].length ? S.today[lk] : scoreboard(L, ymd).catch(() => null), forecastCtx(L, ymd).catch(() => null), sbMeta(L, ymd)]);
    if (ymd === today && games) S.today[lk] = games;
    const el = $main.querySelector('#dates .on'); if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' });
    todayPill(ymd !== today, today);
    const phase = ''; const phaseTag = meta.phase ? `<span class="phase">${esc(meta.phase)}</span>` : '';
    const setPhase = () => { const el = $main.querySelector('#phase'); if (el) el.innerHTML = phaseTag; };
    if (!games) { paint(phase + empty("Couldn't load the scoreboard", '<p style="margin:6px 0 0">The feed didn\'t answer. It usually comes back within a minute.</p>')); setPhase(); return; }
    if (!games.length) {
      // say when the next games are, and let the strip jump there; the season's calendar comes with the scoreboard
      const next = meta.cal.find(d => d > ymd), last = meta.cal.filter(d => d < ymd).slice(-1)[0];
      const when = next ? (next === addDays(today, 1) ? 'tomorrow' : next === today ? 'today' : `on ${dayLabel(next, { weekday: 'long', month: 'short', day: 'numeric' })}`) : '';
      const body = next ? `<p style="margin:6px 0 0">Next ${esc(L.label)} games are ${esc(when)}.</p>` : meta.cal.length ? `<p style="margin:6px 0 0">The season is over${last ? `; the last games were ${esc(dayLabel(last, { month: 'long', day: 'numeric' }))}` : ''}. Next season shows here once the schedule is posted.</p>` : '';
      paint(phase + empty(`No ${L.label} games ${ymd === today ? 'today' : 'on ' + dayLabel(ymd, { weekday: 'long', month: 'short', day: 'numeric' })}`, body, next ? `<button class="btn" data-act="date" data-ymd="${esc(next)}">Jump to ${esc(dayLabel(next, { weekday: 'short', month: 'short', day: 'numeric' }))}</button>` : ''));
      setPhase(); return;
    }
    const shown = mineOnly ? games.filter(g => isFav(g) || g.tbd) : games;   // your teams always sort first; Mine hides the rest (a game whose teams aren't set yet stays: it could be yours)
    const by = st => shown.filter(g => g.state === st && !g.off).sort((a, b) => rankGame(b) - rankGame(a) || new Date(a.date) - new Date(b.date));
    const live = by('in'), pre = by('pre'), post = by('post'), off = shown.filter(g => g.off);
    const block = (title, list) => list.length ? sec(title, `${list.length}`) + `<div class="games">${list.map(g => gameCard(L, g, ctx, false, true)).join('')}</div>` : '';
    const none = mineOnly && !shown.length ? empty(`None of your teams play ${ymd === today ? 'today' : dayLabel(ymd, { weekday: 'long', month: 'short', day: 'numeric' })}`, `<p style="margin:6px 0 0">${games.length} game${games.length === 1 ? '' : 's'} on the slate.</p>`, `<button class="btn ghost" data-act="scmine">Show all</button>`) : '';
    paint(phase + none + block('Live', live) + block(ymd === today ? 'Upcoming' : 'Scheduled', pre) + block('Final', post) + block('Not played', off));
    setPhase();
    const el2 = $main.querySelector('#dates .on'); if (el2) el2.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  /* a pill that stays put above the tab bar while another day is shown: one tap back to today, wherever the strip is scrolled */
  function todayPill(show, today) {
    let el = document.getElementById('todayfab');
    if (!show) { if (el) { el.classList.remove('in'); setTimeout(() => { if (el && !el.classList.contains('in')) el.remove(); }, 220); } return; }
    if (!el) { el = document.createElement('button'); el.id = 'todayfab'; el.className = 'todayfab'; el.dataset.act = 'date'; el.setAttribute('aria-label', 'Back to today'); el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15.5" r="1.6" fill="currentColor" stroke="none"/></svg>Today`; document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in')); }
    else el.classList.add('in');
    el.dataset.ymd = today;
  }
  /* a month of games at a glance. Your teams' days come from their schedules (one small request each, usually
     already cached by Home). Game counts come from the league's whole month in one request (a week at a time for
     college, which can have a hundred games a day) on a longer leash than the usual fetch; if that fails the
     league's calendar still says which days have games. */
  const monthCache = {};
  const fetchJson = async (url, ms) => { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms); try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); } };
  async function monthGames(L, ym) {
    const key = `${L.key}:${ym}`; if (monthCache[key] && Date.now() - monthCache[key].t < 1800000) return monthCache[key].v;
    const [y, m] = ym.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mine = (favs.all()[L.key] || []).map(String); const mineSet = new Set(mine);
    const days = {};
    const mark = (ymd, f) => { if (!ymd || ymd.slice(0, 7) !== ym) return; const d = days[ymd] || (days[ymd] = { n: 0, mine: false, has: false }); f(d); };
    const dayOf = e => { try { return HW.ymdOf(e.date); } catch { return ''; } };
    const d0 = `${ym}-01`, d1 = `${ym}-${String(last).padStart(2, '0')}`;
    const spans = /^ncaa/.test(L.key) ? Array.from({ length: Math.ceil(last / 7) }, (_, i) => [`${ym}-${String(i * 7 + 1).padStart(2, '0')}`, `${ym}-${String(Math.min(last, i * 7 + 7)).padStart(2, '0')}`]) : [[d0, d1]];
    const params = L.sbParams.replace(/&limit=\d+/, '');
    const weeks = Array.from({ length: Math.ceil(last / 7) }, (_, i) => [`${ym}-${String(i * 7 + 1).padStart(2, '0')}`, `${ym}-${String(Math.min(last, i * 7 + 7)).padStart(2, '0')}`]);
    const span = ([a, b], lim) => fetchJson(`${API(L)}/scoreboard?dates=${HW.compact(addDays(a, -1))}-${HW.compact(addDays(b, 1))}${params}&limit=${lim}`, 30000);
    const ok = pg => pg && Array.isArray(pg.events);
    let [scheds, pages] = await Promise.all([
      Promise.all(mine.map(id => jSoft(`${API(L)}/teams/${id}/schedule`, 300000))),
      Promise.all(spans.map(sp => span(sp, 1000)))
    ]);
    if (!pages.every(ok) && spans.length === 1) pages = await Promise.all(weeks.map(w => span(w, 400)));   // the month was too much in one go: a week at a time
    scheds.forEach(sc => (sc && sc.events || []).forEach(e => mark(dayOf(e), d => { d.mine = true; d.has = true; })));
    const counted = pages.length > 0 && pages.every(ok); let truncated = false;
    pages.forEach(pg => { const evs = pg && pg.events || []; if (evs.length >= 1000) truncated = true; evs.forEach(e => mark(dayOf(e), d => { d.n++; d.has = true; const comp = e.competitions && e.competitions[0]; if (comp && (comp.competitors || []).some(c => c.team && mineSet.has(String(c.team.id)))) d.mine = true; })); });
    if (!counted) { const meta = await sbMeta(L, todayCT()).catch(() => ({ cal: [] })); (meta.cal || []).forEach(d => mark(d, x => { x.has = true; })); }
    const v = { days, counted, truncated };
    if (counted || Object.keys(days).length) monthCache[key] = { t: Date.now(), v };
    return v;
  }
  /* what else the scoreboard says: the league's game-day calendar and the part of the season it is (regular season, playoffs) */
  async function sbMeta(L, ymd) {
    const t = todayCT(); const d = await jSoft(`${API(L)}/scoreboard?dates=${HW.compact(ymd)}${L.sbParams}`, ymd === t ? 25000 : (ymd < t ? 3600000 : 300000));
    const lg = d && d.leagues && d.leagues[0] || {};
    const cal = (lg.calendar || []).map(x => typeof x === 'string' ? x : x && (x.startDate || x.date) || '').filter(Boolean).map(x => String(x).slice(0, 10)).sort();
    const name = lg.season && lg.season.type && lg.season.type.name || '';
    const phase = /post/i.test(name) ? 'Playoffs' : /pre/i.test(name) ? 'Preseason' : /off/i.test(name) ? 'Off-season' : '';
    return { cal, phase };
  }

  /* ================= PLAYER ================= */
  async function player(lk, id) {
    const L = LEAGUES[lk]; if (!L || !id) { $main.innerHTML = empty('Player not found'); return; }
    $main.innerHTML = `<div class="topbar"><a class="ib" href="#home" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a></div>` + skeleton(1, 'card') + skeleton(6, 'row');
    const bioUrl = `${WEB(L)}/athletes/${id}`;
    const coreUrl = `${HW.ESPN.core}sports/basketball/leagues/${L.path.split('/')[1]}/athletes/${id}`;
    // two sources for the bio: the site feed (team, headshot, injuries) and the core record (birthplace, hand, class, debut), merged field by field
    let [bio, ov, gl, career, core] = await Promise.all([jSoft(bioUrl, 3600000), jSoft(`${WEB(L)}/athletes/${id}/overview`, 600000), jSoft(`${WEB(L)}/athletes/${id}/gamelog`, 600000), jSoft(`${WEB(L)}/athletes/${id}/stats`, 3600000), jSoft(coreUrl, 3600000)]);
    if (!bio) bio = await jSoft(bioUrl, 0);   // one retry: the bio endpoint drops requests now and then
    let a = bio && (bio.athlete || bio);
    if (!a || !a.displayName) {   // second source: the core API, then at least a name and headshot from the league list
      if (!core) core = await jSoft(coreUrl, 0);
      if (core && core.displayName) a = { ...core, team: core.team && core.team.$ref ? null : core.team, headshot: core.headshot, position: core.position && core.position.$ref ? null : core.position, college: core.college && core.college.$ref ? null : core.college, injuries: [] };
      else { const lp0 = await leaguePlayers(L).catch(() => null); const p = lp0 && lp0.rows.find(x => x.id === String(id)); if (p) a = { id, displayName: p.name, shortName: p.short, headshot: p.img ? { href: p.img } : null, position: { displayName: p.pos }, team: { id: p.teamId } }; }
    }
    if (!a || !a.displayName) { $main.innerHTML = `<div class="topbar"><a class="ib" href="#home" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a></div>` + empty("Couldn't load this player", '<p style="margin:6px 0 0">The feed didn\'t answer for this player. <a href="#" data-act="reload">Try again</a>.</p>'); return; }
    if (core && core.displayName) {   // fill what the site feed left blank from the core record (never a $ref, those are links not values)
      const plain = v => v && typeof v === 'object' && v.$ref ? null : v;
      ['fullName', 'firstName', 'lastName', 'dateOfBirth', 'age', 'displayHeight', 'displayWeight', 'birthPlace', 'hand', 'experience', 'debutYear', 'draft', 'status', 'citizenship', 'jersey', 'displayDraft', 'highSchool'].forEach(k => { const v = plain(core[k]); if (v != null && v !== '' && (a[k] == null || a[k] === '' || (typeof a[k] === 'object' && !Object.keys(a[k]).length))) a[k] = v; });
      if (!a.injuries || !a.injuries.length) a.injuries = (core.injuries || []).filter(x => x && !x.$ref && x.status);
    }
    if (a.team && a.team.color) learn(L, { id: a.team.id, ...a.team });
    if (a.team && !a.team.color) { const idx0 = await teamsIndex(L); const t0 = idx0[String(a.team.id)] || teamEntry({ id: a.team.id, abbr: a.team.abbreviation }, L); if (t0) a.team = { ...a.team, ...{ color: (t0.color || '').replace('#', ''), alternateColor: a.team.alternateColor || (t0.alt || '').replace('#', ''), displayName: a.team.displayName || t0.name, shortDisplayName: a.team.shortDisplayName || t0.short, logos: a.team.logos || [{ href: t0.logo }], abbreviation: a.team.abbreviation || t0.abbr } }; }
    const tm = a.team || {}; const color = teamColor({ id: tm.id, abbr: tm.abbreviation, color: tm.color }, L); tint(color);
    if (fplayers.has(lk, id)) fplayers.update(lk, id, { name: a.displayName, short: a.shortName, img: a.headshot && a.headshot.href, team: tm.abbreviation, teamId: tm.id ? String(tm.id) : '', color: BAD(color) ? '' : color }); const alt = teamAlt({ id: tm.id, abbr: tm.abbreviation, alt: tm.alternateColor }, L) || hx(tm.alternateColor);
    const teamLogo = tm.logos && tm.logos[0] && tm.logos[0].href;
    const college = /^ncaa/.test(lk);
    const st = ov && ov.statistics; const labels = st && st.labels || [];
    const split = st && st.splits && (st.splits.find(s => /regular/i.test(s.displayName)) || st.splits[0]);
    const val = l => { const i = labels.indexOf(l); return split && i >= 0 ? split.stats[i] : ''; };
    const cat = career && career.categories && (career.categories.find(c => /average/i.test(c.name)) || career.categories[0]);
    const cl = cat && (cat.labels || cat.names) || []; const ci = l => cl.indexOf(l);
    const cur = cat && cat.statistics && cat.statistics.length ? cat.statistics[cat.statistics.length - 1] : null;   // the latest season on record
    const following = fplayers.has(lk, id);
    const injury = a.injuries && a.injuries.find(x => x && !x.$ref && x.status) || null;
    const subLine = [a.position && a.position.displayName, a.jersey ? `No. ${a.jersey}` : ''].filter(Boolean).map(esc).join(' · ');
    const country = a.citizenship || (a.birthPlace && a.birthPlace.country && !/^(USA|United States)$/i.test(a.birthPlace.country) ? a.birthPlace.country : '');
    const hometown = a.birthPlace ? [a.birthPlace.city, a.birthPlace.state || (country ? '' : a.birthPlace.country)].filter(Boolean).join(', ') : '';
    const classWord = college && a.experience && (a.experience.displayValue || ({ 1: 'Freshman', 2: 'Sophomore', 3: 'Junior', 4: 'Senior' })[a.experience.years]) || '';
    const classIdx = { freshman: 1, sophomore: 2, junior: 3, senior: 4 }[String(classWord).toLowerCase().replace(/^redshirt\s+/, '')] || 0;
    const gradYear = classIdx ? HW.seasonYear() + (4 - classIdx) : 0;
    const facts = [a.displayHeight, a.displayWeight, college ? classWord : (a.age ? `Age ${a.age}` : ''), country, !college && a.college && a.college.name, hometown].filter(Boolean);
    const snap = { lk, id: String(id), name: a.displayName, short: a.shortName || a.displayName, img: a.headshot && a.headshot.href, team: tm.abbreviation || '', teamId: tm.id ? String(tm.id) : '', color: BAD(color) ? '' : color };
    const tlogo = teamLogo || tm.logo || '';
    const hero = `<div class="ehero" style="--a:${esc(color)}">
      ${tlogo ? `<img class="tlg" src="${esc(tlogo)}" alt="" ${hide}>` : ''}<div class="wm">${esc(a.jersey || '')}</div>
      <div class="in">${tm.id ? `<a class="tchip" href="${href.team(lk, tm.id)}">${tlogo ? `<img src="${esc(tlogo)}" alt="" ${hide}>` : ''}<b>${esc(tm.shortDisplayName || tm.name || tm.displayName)}</b></a>` : ''}${subLine ? `<div class="sub">${subLine}</div>` : ''}<h1>${esc(a.firstName || '')}<br>${esc(a.lastName || a.displayName)}</h1>
        <div class="facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</div>
        <div class="acts"><button class="${following ? 'on' : ''}" data-act="follow-player" data-snap='${esc(JSON.stringify(snap))}' aria-pressed="${following}">${following ? starSvg : starLine}${following ? 'Following' : 'Follow'}</button></div>
      </div>
      <div class="shot">${a.headshot && a.headshot.href ? `<img src="${esc(a.headshot.href)}" alt="" ${hide}>` : ''}</div>
    </div>`;
    let injStrip = '';
    if (injury) {
      S.injuries = S.injuries || {}; const key = `p:${id}:${injury.id || 0}`; S.injuries[key] = { x: { ...injury, athlete: { id: String(id), displayName: a.displayName, headshot: a.headshot && a.headshot.href, position: a.position } }, id: String(id), team: { id: tm.id, short: tm.shortDisplayName || tm.name || '', color } };
      const st0 = injury.status || ''; const cls = /out/i.test(st0) ? 'out' : /day|quest|doubt/i.test(st0) ? 'q' : 'ok'; const det = injury.details || {}; const ret = retInfo(L, det.returnDate);
      injStrip = `<button class="injstrip ${cls}" data-act="injury" data-key="${esc(key)}"><span class="tag ${cls}">${esc(statusWord(st0))}</span><span class="t"><b>${esc(det.type || det.detail || 'Injury')}${det.detail && det.detail !== det.type ? `, ${esc(det.detail.toLowerCase())}` : ''}</b><span>${ret ? (ret.far ? 'No return date this season' : `Expected back around ${esc(ret.long)}`) : esc((injury.shortComment || injury.longComment || 'Tap for the note').slice(0, 70))}</span></span>${chev}</button>`;
    }
    // the game log: regular-season games, newest first
    let evRows = [];
    if (gl && gl.events && gl.seasonTypes) { const types = gl.seasonTypes.filter(t => /regular/i.test(t.displayName || '')).length ? gl.seasonTypes.filter(t => /regular/i.test(t.displayName || '')) : gl.seasonTypes; types.forEach(stp => (stp.categories || []).forEach(c => (c.events || []).forEach(e => { const meta = gl.events[e.eventId]; if (meta) evRows.push({ meta, stats: e.stats || [], id: e.eventId }); }))); evRows.sort((x, y) => new Date(y.meta.gameDate) - new Date(x.meta.gameDate)); }
    const gLabels = gl && gl.labels || [];
    const gi = l => gLabels.indexOf(l);
    const made = (r, l) => { const i = gi(l); const v = i >= 0 ? String(r.stats[i] || '') : ''; const m = v.match(/^(\d+)-(\d+)$/); return m ? [+m[1], +m[2]] : [0, 0]; };

    /* season averages: every per-game number the feed gives, and a ring for how the big ones break down.
       This season's split when it has games; otherwise the latest season on record, labelled as such. */
    const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const liveSeason = !!(split && num(val('GP')));
    const stat = l => liveSeason ? num(val(l)) : (cur && ci(l) >= 0 ? num(cur.stats[ci(l)]) : null);
    const crow = l => cur && ci(l) >= 0 ? num(cur.stats[ci(l)]) : null;
    const seasonName = liveSeason ? (split.displayName || 'This season') : cur && cur.season ? `${cur.season.displayName || cur.season.year} season` : '';
    const fmt = (v, l) => v == null ? '—' : /%/.test(l) ? v.toFixed(1) : (Number.isInteger(v) && /^(GP|GS)$/.test(l) ? String(v) : v.toFixed(1));
    const G = [['PTS', 'Points'], ['REB', 'Rebounds'], ['AST', 'Assists'], ['STL', 'Steals'], ['BLK', 'Blocks'], ['TO', 'Turnovers'], ['MIN', 'Minutes'], ['FG%', 'Field goal %'], ['3P%', 'Three %'], ['FT%', 'Free throw %'], ['PF', 'Fouls'], ['GP', 'Games']];
    const grid = G.map(([k, l]) => ({ k, l, v: stat(k) })).filter(x => x.v != null);
    const ring = (segs, center, label, title) => {
      const live = segs.filter(x => x.v > 0); const total = live.reduce((a, x) => a + x.v, 0); const R = 54, C = 2 * Math.PI * R, gap = live.length > 1 ? 17 : 0; let off = 0;
      // every slice at least a short dash (a 4% share is a mark, not a hair); the biggest slice gives up the difference
      const MIN = 12; const shares = live.map(x => x.v / total * C); const lens = shares.map(sh => Math.max(MIN, sh - gap)); const over = lens.reduce((a, b) => a + b, 0) + gap * live.length - C; if (over > 0) { const big = lens.indexOf(Math.max(...lens)); lens[big] = Math.max(MIN, lens[big] - over); }
      const arcs = live.map((x, i) => { const len = lens[i]; const a = `<circle cx="70" cy="70" r="${R}" style="stroke:${x.c}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-(off + (gap ? gap / 2 : 0))).toFixed(1)}"/>`; off += len + gap; return a; }).join('');
      return `<div class="ring" style="${toneVars}"><svg width="150" height="150" viewBox="0 0 140 140" role="img" aria-label="${esc(title)}"><g fill="none" transform="rotate(-90 70 70)">${arcs}</g><text x="70" y="73" text-anchor="middle" fill="var(--ink)" style="font:800 34px var(--num)">${esc(center)}</text><text x="70" y="91" text-anchor="middle" fill="var(--ink-3)" style="font:700 11px var(--ui);letter-spacing:.06em">${esc(label)}</text></svg><div class="key">${segs.map(x => `<div><i style="background:${x.c}"></i><span>${esc(x.l)}</span><b>${x.v == null ? '—' : x.v.toFixed(1)}</b><em>${total && x.v > 0 ? Math.round(x.v / total * 100) + '%' : ''}</em></div>`).join('')}</div></div>`;
    };
    // three tints of the team colour that read on both grounds (set per theme in CSS from these variables)
    const toneVars = `--c1d:${esc(V_lift(color))};--c1l:${esc(V_deep(color))};--c2d:${esc(mixTo(V_lift(color), 255, .38))};--c3d:${esc(mixTo(V_lift(color), 255, .68))};--c2l:${esc(mixTo(V_deep(color), 255, .42))};--c3l:${esc(mixTo(V_deep(color), 255, .72))}`;   // the first tone is the colour as it reads on the ground (a black team lifts on black)
    const tones = [{ c: 'var(--c1)' }, { c: 'var(--c2)' }, { c: 'var(--c3)' }];
    const views = [];
    // points: twos, threes and free throws per game, from the game log when it has games
    if (evRows.length && gi('FG') >= 0 && gi('3PT') >= 0 && gi('FT') >= 0) {
      const n = evRows.length; let fg = 0, tp = 0, ft = 0; evRows.forEach(r => { fg += made(r, 'FG')[0]; tp += made(r, '3PT')[0]; ft += made(r, 'FT')[0]; });
      const twos = (fg - tp) * 2 / n, threes = tp * 3 / n, fts = ft / n;
      views.push(['pts', 'Points', ring([{ l: 'Twos', v: twos, ...tones[0] }, { l: 'Threes', v: threes, ...tones[1] }, { l: 'Free throws', v: fts, ...tones[2] }], (twos + threes + fts).toFixed(1), 'PPG', 'points a game')]);
    } else if (stat('PTS') != null) views.push(['pts', 'Points', ring([{ l: 'Points', v: stat('PTS'), ...tones[0] }], stat('PTS').toFixed(1), 'PPG', 'points a game')]);
    if (crow('OR') != null && crow('DR') != null && (crow('OR') + crow('DR')) > 0) views.push(['reb', 'Rebounds', ring([{ l: 'Defensive', v: crow('DR'), ...tones[0] }, { l: 'Offensive', v: crow('OR'), ...tones[1] }], (crow('OR') + crow('DR')).toFixed(1), 'RPG', 'rebounds a game')]);
    else if (stat('REB') != null) views.push(['reb', 'Rebounds', ring([{ l: 'Rebounds', v: stat('REB'), ...tones[0] }], stat('REB').toFixed(1), 'RPG', 'rebounds a game')]);
    if (stat('AST') != null) views.push(['ast', 'Assists', ring([{ l: 'Assists', v: stat('AST'), ...tones[0] }, { l: 'Turnovers', v: stat('TO'), ...tones[2] }], stat('AST').toFixed(1), 'APG', 'assists a game') + (stat('TO') ? `<p class="ringnote">${(stat('AST') / stat('TO')).toFixed(1)} assists for every turnover</p>` : '')]);
    if (stat('STL') != null || stat('BLK') != null) views.push(['def', 'Defense', ring([{ l: 'Steals', v: stat('STL') || 0, ...tones[0] }, { l: 'Blocks', v: stat('BLK') || 0, ...tones[1] }], ((stat('STL') || 0) + (stat('BLK') || 0)).toFixed(1), 'STL + BLK', 'steals and blocks a game')]);
    if (stat('FG%') != null) {
      const bar = (l, v, sub) => `<div><span>${l}</span><em><i style="width:${Math.max(0, Math.min(100, v || 0))}%"></i></em><b>${v == null ? '—' : v.toFixed(1)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
      const att = (k) => { const v = crow(k); return v; };
      views.push(['sh', 'Shooting', `<div class="bars" style="${tcv(color)}">${bar('Field goals', stat('FG%'), crow('FG') != null ? '' : '')}${bar('Threes', stat('3P%'))}${bar('Free throws', stat('FT%'))}</div>` + (cur && ci('FG') >= 0 ? `<p class="ringnote">Per game: ${esc(String(cur.stats[ci('FG')]))} FG, ${esc(String(cur.stats[ci('3PT')] || ''))} 3PT, ${esc(String(cur.stats[ci('FT')] || ''))} FT (made-attempted)</p>` : '')]);
    }
    const avgCard = (views.length || grid.length) ? `<section class="card avg"><div class="card-h"><h2>Season averages</h2><small>${esc(seasonName)}</small></div>
      ${views.length ? `<div class="chips" role="tablist">${views.map(([k, l], i) => `<button class="chip${i === 0 ? ' on' : ''}" role="tab" data-act="mix" data-mix="${k}" aria-selected="${i === 0}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>${views.map(([k, , html], i) => `<div data-mix-panel="${k}"${i === 0 ? '' : ' hidden'}>${html}</div>`).join('')}` : ''}
      ${grid.length ? `<div class="sgrid">${grid.map(x => `<div><b>${esc(fmt(x.v, x.k))}</b><span>${esc(x.l)}</span></div>`).join('')}</div>` : ''}
      <div class="card-f"><button data-act="ptab" data-tab="stats">All stats, game log and career</button></div></section>` : '';

    // next game for the team
    let next = '';
    if (tm.id) { const t = await teamInfo(L, tm.id); if (t && t.next) { const ctx = await forecastCtx(L, todayCT()).catch(() => null); next = sec('Next up') + `<div class="games">${gameCard(L, t.next, ctx)}</div>`; } }

    // game log
    let log = '';
    if (evRows.length) {
      const cols = ['MIN', 'PTS', 'REB', 'AST'].filter(l => gi(l) >= 0);
      log = sec('Last five', '', `<button data-act="ptab" data-tab="stats">Full log</button>`) + `<div class="tw"><table class="tbl"><thead><tr><th>Game</th>${cols.map(c => `<th>${c === 'MIN' ? 'Min' : c[0] + c.slice(1).toLowerCase()}</th>`).join('')}<th>Result</th></tr></thead><tbody>${evRows.slice(0, 5).map(r => { const m = r.meta; const op = m.opponent || {}; return `<tr class="click" data-href="${href.game(lk, r.id)}"><td><span class="opp"><em>${esc(dateShort(m.gameDate))}</em>${logo(op.logo, 's', teamColor({ id: op.id }, L))}${esc(m.atVs || '')} ${esc(op.abbreviation || '')}</span></td>${cols.map(c => `<td>${c === 'PTS' ? `<b>${esc(r.stats[gi(c)])}</b>` : esc(r.stats[gi(c)])}</td>`).join('')}<td><span class="res ${m.gameResult === 'W' ? 'w' : 'l'}">${esc(m.gameResult || '')}</span> <span class="mut">${esc(m.score || '')}</span></td></tr>`; }).join('')}</tbody></table></div>`;
    }

    // latest stories and clips
    const items = ov && ov.news ? ov.news.filter(n => n.headline) : [];
    const isClip = n => (n.video || n.videos || []).length && (/media|video/i.test(n.type || '') || !n.description);
    const clips = items.filter(isClip).slice(0, 10), stories = items.filter(n => !isClip(n) && HW.readable(n)).slice(0, 6);
    clips.forEach(n => (n.video || n.videos || []).forEach(v => { if (v && v.id != null) S.videos[String(v.id)] = v; }));
    const moments = clips.length ? sec('Top moments') + `<div class="media">${clips.map(n => { const v = (n.video || n.videos)[0]; const im = (n.images && n.images[0] && n.images[0].url) || v.thumbnail; return `<button class="clip" data-act="play" data-vid="${esc(String(v.id))}"><div class="th">${im ? `<img src="${esc(im)}" alt="" loading="lazy">` : ''}<i><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg></i>${v.duration ? `<em>${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}</em>` : ''}</div><b>${esc(n.headline)}</b><span>${esc(n.published ? ago(n.published) : '')}</span></button>`; }).join('')}</div>` : '';
    const latest = moments + (stories.length ? sec('Stories') + `<div class="rows">${stories.map(n => HW.v5.newsRow(lk, n)).join('')}</div>` : '');

    // career, by season
    let careerT = '';
    if (cat && cat.statistics && cat.statistics.length) {
      const want = [['GP', 'GP'], ['PTS', 'PPG'], ['REB', 'RPG'], ['AST', 'APG'], ['FG%', 'FG%']].filter(([k]) => ci(k) >= 0);
      const rows = cat.statistics.slice().reverse();
      careerT = sec('Career', 'per game') + `<div class="tw"><table class="tbl"><thead><tr><th>Season</th>${want.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === 0 ? ' class="hi"' : ''}><td>${esc(r.season && (r.season.displayName || r.season.year) || '')} <span class="mut" style="color:var(--ink-3)">${esc((r.teamSlug || '').toUpperCase().slice(0, 3))}</span></td>${want.map(([k]) => `<td>${k === 'PTS' ? `<b>${esc(r.stats[ci(k)])}</b>` : esc(r.stats[ci(k)])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    // about: everything the two feeds say about the person, one row each
    const born = a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
    const exp = a.experience || {}; const seasons = !college && exp.years != null ? (exp.years === 0 ? 'Rookie' : `${ordinal(exp.years + 1)} season`) : (!college && exp.displayValue) || '';
    const about = [
      ['Full name', a.fullName && a.fullName !== a.displayName ? a.fullName : ''],
      ['Born', [born, a.age ? `age ${a.age}` : ''].filter(Boolean).join(', ')],
      ['Hometown', hometown],
      ['Country', country || (a.birthPlace && a.birthPlace.country) || ''],
      ['Height', a.displayHeight || ''], ['Weight', a.displayWeight || ''],
      ['Position', a.position && a.position.displayName || ''],
      ['Jersey', a.jersey ? `No. ${a.jersey}` : ''],
      ['Shoots', a.hand && (a.hand.displayValue || a.hand.type) ? `${a.hand.displayValue || a.hand.type}-handed`.replace(/^(\w)/, c => c.toUpperCase()) : ''],
      ['Class', college && classWord ? `${classWord}, ${HW.seasonYear() - 1}-${String(HW.seasonYear()).slice(2)}${gradYear ? ` (class of ${gradYear} on a four-year track)` : ''}` : ''],
      ['Drafted', a.displayDraft || (a.draft && a.draft.displayText) || (a.draft && a.draft.year ? `${a.draft.year}, round ${a.draft.round}, pick ${a.draft.selection}` : '') || ''],
      ['Debut', a.debutYear ? String(a.debutYear) : ''],
      ['Experience', seasons],
      ['College', !college && a.college && a.college.name || ''],
      ['High school', a.highSchool && (a.highSchool.name || a.highSchool) || ''],
      ['Status', a.status && a.status.name || '']
    ].filter(([, v]) => v);
    const aboutT = about.length ? sec('About') + `<table class="tbl kv"><tbody>${about.map(([k, v]) => `<tr><td>${k}</td><td>${esc(String(v))}</td></tr>`).join('')}</tbody></table>` : '';

    // season splits: every column the feed gives, per split (regular season, postseason)
    const splitsT = st && st.splits && st.splits.length && labels.length ? sec('Season averages') + `<div class="tw"><table class="tbl"><thead><tr><th>Split</th>${labels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${st.splits.map(sp => `<tr><td class="l">${esc(sp.displayName)}</td>${sp.stats.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
    // splits worked from the game log: where they played, how it went, the last ten, and each opponent
    let cutsT = '';
    if (evRows.length >= 2 && gi('PTS') >= 0) {
      const num = (r, l) => { const i = gi(l); const x = i >= 0 ? parseFloat(r.stats[i]) : NaN; return isFinite(x) ? x : 0; };
      const agg = rows => { const n = rows.length; if (!n) return null; const s = l => rows.reduce((t, r) => t + num(r, l), 0) / n; const fg = rows.reduce((t, r) => { const [m, at] = made(r, 'FG'); return [t[0] + m, t[1] + at]; }, [0, 0]); const tp = rows.reduce((t, r) => { const [m, at] = made(r, '3PT'); return [t[0] + m, t[1] + at]; }, [0, 0]); return { n, pts: s('PTS'), reb: s('REB'), ast: s('AST'), min: gi('MIN') >= 0 ? s('MIN') : null, fg: fg[1] ? fg[0] / fg[1] * 100 : null, tp: tp[1] ? tp[0] / tp[1] * 100 : null }; };
      const road = r => /^(@|at)$/i.test(String(r.meta.atVs || '').trim());
      const cuts = [['All games', evRows], ['Home', evRows.filter(r => !road(r))], ['Road', evRows.filter(road)], ['Last 10', evRows.slice(0, 10)], ['In wins', evRows.filter(r => r.meta.gameResult === 'W')], ['In losses', evRows.filter(r => r.meta.gameResult === 'L')]].map(([k, rows]) => [k, agg(rows)]).filter(([, x]) => x);
      const byOpp = {}; evRows.forEach(r => { const k = r.meta.opponent && r.meta.opponent.abbreviation; if (k) (byOpp[k] = byOpp[k] || []).push(r); });
      const opps = Object.entries(byOpp).sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0])).map(([k, rows]) => [`vs ${k}`, agg(rows)]);
      const f1 = x => x == null ? '—' : x.toFixed(1), f0 = x => x == null ? '—' : x.toFixed(1);
      const row = ([k, x], hi) => `<tr${hi ? ' class="hi"' : ''}><td class="l">${esc(k)}</td><td>${x.n}</td><td><b>${f1(x.pts)}</b></td><td>${f1(x.reb)}</td><td>${f1(x.ast)}</td>${x.min != null ? `<td>${f1(x.min)}</td>` : ''}<td>${f0(x.fg)}</td><td>${f0(x.tp)}</td></tr>`;
      const head = `<thead><tr><th>Split</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th>${cuts[0][1].min != null ? '<th>MIN</th>' : ''}<th>FG%</th><th>3P%</th></tr></thead>`;
      cutsT = sec('Splits', 'this season, per game') + `<div class="tw"><table class="tbl">${head}<tbody>${cuts.map((c, i) => row(c, i === 0)).join('')}</tbody></table></div>` + (opps.length > 1 ? sec('By opponent', `${opps.length} teams`) + `<div class="tw"><table class="tbl">${head}<tbody>${opps.map(c => row(c)).join('')}</tbody></table></div>` : '');
    }
    const fullLog = evRows.length ? sec('Game log', `${evRows.length} games`) + `<div class="tw"><table class="tbl"><thead><tr><th>Game</th>${gLabels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${evRows.map(r => { const m = r.meta; const op = m.opponent || {}; return `<tr class="click" data-href="${href.game(lk, r.id)}"><td><span class="opp"><em>${esc(dateShort(m.gameDate))}</em>${esc(m.atVs || '')} ${esc(op.abbreviation || '')} <span class="res ${m.gameResult === 'W' ? 'w' : 'l'}">${esc(m.gameResult || '')}</span></span></td>${r.stats.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>` : '';
    const injT = injury ? (() => { const det = injury.details || {}; const ret = retInfo(L, det.returnDate); const what = [det.type, det.detail && det.detail !== det.type ? det.detail : '', det.side && det.side !== 'Not Specified' ? det.side.toLowerCase() : '', det.location && det.location !== det.type ? det.location : ''].filter(Boolean).join(', '); return `<table class="tbl kv"><tbody><tr><td>Status</td><td><span class="tag ${/out/i.test(injury.status) ? 'out' : 'q'}">${esc(statusWord(injury.status))}</span></td></tr>${what ? `<tr><td>Injury</td><td>${esc(what)}</td></tr>` : ''}${injury.date ? `<tr><td>Reported</td><td>${esc(new Date(injury.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: HW.TZ }))}</td></tr>` : ''}${ret ? `<tr><td>Expected back</td><td>${esc(ret.long)}</td></tr>` : ''}${injury.longComment || injury.shortComment ? `<tr class="note"><td colspan="2">${esc(injury.longComment || injury.shortComment)}</td></tr>` : ''}</tbody></table>`; })() : '';
    const panels = {
      summary: avgCard + next + log + moments,
      stats: (splitsT + cutsT + (evRows.length && L.sport === 'basketball' ? sec('Shot chart', `last ${Math.min(5, evRows.length)} game${Math.min(5, evRows.length) === 1 ? '' : 's'}`) + `<div class="pshots"><div class="rows"><button class="row" data-act="pshots" data-lk="${lk}" data-pid="${esc(String(id))}" data-name="${esc(a.displayName || '')}" data-color="${esc(color)}" data-games="${esc(evRows.slice(0, 5).map(r => r.id).join(','))}"><span class="t"><b>Show the shot chart</b><span class="wrap">Every attempt from the last ${Math.min(5, evRows.length)} games, on the court</span></span>${chev}</button></div></div>` : '') + fullLog + careerT) || empty('No stats yet', '<p style="margin:6px 0 0">Stats start with the first game of the season.</p>'),
      bio: (injury ? sec('Injury') + injT : '') + (aboutT || sec('About') + empty('Nothing on file', '<p style="margin:6px 0 0">The feed has no bio for this player yet.</p>')),
      news: (moments + (stories.length ? sec('Stories') + `<div class="rows">${stories.map(n => HW.v5.newsRow(lk, n)).join('')}</div>` : '')) || empty('Nothing recent', '<p style="margin:6px 0 0">No stories or clips on this player in the feed right now.</p>')
    };
    const ptab = 'summary';   // every player opens on Summary
    const ptabs = `<div class="chips ptabs" role="tablist" style="padding-top:14px">${[['summary', 'Summary'], ['stats', 'Stats'], ['bio', 'Bio'], ['news', 'News']].map(([k, l]) => `<button class="chip${k === ptab ? ' on' : ''}" role="tab" data-act="ptab" data-tab="${k}" aria-selected="${k === ptab}" aria-pressed="${k === ptab}">${l}</button>`).join('')}</div>`;
    $main.innerHTML = `<div class="topbar"><a class="ib" href="#home" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><span class="ttl">${esc(a.displayName || '')}</span><div class="sp"><button class="ib" data-act="share" data-title="${esc(a.displayName)}" data-card='${esc(JSON.stringify({ kind: 'player', name: a.displayName, sub: [tm.shortDisplayName || tm.name || '', (a.position && a.position.displayName || '').toLowerCase(), a.jersey ? `No. ${a.jersey}` : ''].filter(Boolean).join(' · '), color, img: a.headshot && a.headshot.href || '', jersey: a.jersey || '', line: [['PTS', 'PPG'], ['REB', 'RPG'], ['AST', 'APG']].map(([k, l]) => [stat(k) == null ? '—' : stat(k).toFixed(1), l]), note: seasonName, date: dayLabel(todayCT(), { month: 'long', day: 'numeric', year: 'numeric' }), title: a.displayName, text: `${a.displayName}: ${['PTS', 'REB', 'AST'].map(k => stat(k) == null ? '' : `${stat(k).toFixed(1)} ${k.toLowerCase()}`).filter(Boolean).join(', ')} · ${seasonName}`, file: a.displayName }))}' aria-label="Share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></button></div></div><div class="lb-slot"></div>` + hero + injStrip + ptabs + Object.entries(panels).map(([k, html]) => `<div data-ptab-panel="${k}"${k === ptab ? '' : ' hidden'}>${html}</div>`).join('');
    if (HW.v5._ptabL) $main.removeEventListener('click', HW.v5._ptabL);
    HW.v5._ptabL = e => { const b = e.target.closest('[data-act="ptab"]'); if (!b) return; e.preventDefault(); const k = b.dataset.tab; $main.querySelectorAll('[data-act="ptab"]').forEach(x => { const on = x.dataset.tab === k; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-selected', String(on)); }); $main.querySelectorAll('[data-ptab-panel]').forEach(p => { const on = p.dataset.ptabPanel === k; if (on && p.hidden && HW.v5.soft) { p.hidden = false; HW.v5.soft(p); } else p.hidden = !on; }); };
    $main.addEventListener('click', HW.v5._ptabL);
    document.title = `${a.displayName} · RIVL`;
  }


  /* ================= PLAYERS: picked from the rosters of the teams you follow =================
     ESPN's season leaders are the wrong list for this (stale for college before tip-off, and nobody wants 360 schools of
     names), so the picker starts from your teams' rosters, lets you pull in any other team's roster by name, and for
     the pros adds the league's top scorers underneath. Setup and the Players tab share it. */
  const POS = { G: 'Guard', F: 'Forward', C: 'Center', 'G-F': 'Guard/forward', 'F-G': 'Forward/guard', 'F-C': 'Forward/center', 'C-F': 'Center/forward', PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward' };
  const posWord = p => POS[p] || p || '';
  async function rosterOf(L, id, idx) {
    id = String(id);
    const d = await jSoft(`${API(L)}/teams/${id}/roster`, 900000); if (!d || !d.athletes) return null;
    const t = d.team || {}, tt = idx[id] || {};
    learn(L, { id, ...t }); const abbr = t.abbreviation || tt.abbr || ''; const color = teamColor({ id, abbr, color: t.color || tt.color || '' }, L);
    const team = { id, short: t.shortDisplayName || tt.short || t.name || '', name: t.displayName || tt.name || '', color, abbr, logo: tt.logo || (t.logos && t.logos[0] && t.logos[0].href) || '' };
    const players = (d.athletes || []).flatMap(a => a.items ? a.items : [a]).filter(a => a && a.id).map(a => ({ lk: L.key, id: String(a.id), name: a.displayName, short: a.shortName || a.displayName, img: hsUrl(a), team: abbr, teamId: id, color, pos: a.position && a.position.abbreviation || '', jersey: a.jersey || '' }));
    return { team, players };
  }
  /* a player row: in setup the whole row is the follow toggle; on the Players tab the row opens the profile and the star follows */
  /* rows you can put in your own order: drag a row by its grip (touch or mouse), or tap the arrows; when the pointer lets go,
     the order read off the list goes to onChange(ids). The container is wired once. */
  const gripSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>`;
  const orderTools = `<span class="ord"><button class="mv" data-mv="up" aria-label="Move up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg></button><button class="mv" data-mv="down" aria-label="Move down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6 6 6-6"/></svg></button><span class="grip" aria-label="Drag to reorder">${gripSvg}</span></span>`;
  /* a head that folds its body: the body is wrapped in a track that eases from 1fr to 0fr, so closing is as smooth as opening */
  const foldWrap = (bodyHtml, closed) => `<div class="fold${closed ? ' closed' : ''}">${bodyHtml}</div>`;
  function foldToggle(head, open) {
    const fold = head.nextElementSibling; if (!fold || !fold.classList.contains('fold')) return;
    head.setAttribute('aria-expanded', String(open)); fold.classList.toggle('closed', !open);
    if (open) { fold.classList.add('opening'); setTimeout(() => fold.classList.remove('opening'), 500); fold.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }); }
  }
  function dragOrder(list, onChange) {
    if (!list || list.dataset.drag) return; list.dataset.drag = '1';
    const ids = () => [...list.querySelectorAll('[data-oid]')].map(r => r.dataset.oid);
    list.addEventListener('click', e => {
      const b = e.target.closest('.mv'); if (!b) return; e.preventDefault(); e.stopPropagation();
      const row = b.closest('[data-oid]'); const sib = b.dataset.mv === 'up' ? row.previousElementSibling : row.nextElementSibling; if (!sib || !sib.dataset.oid) return;
      if (b.dataset.mv === 'up') sib.before(row); else sib.after(row); row.classList.add('moved'); setTimeout(() => row.classList.remove('moved'), 320); onChange(ids());
    });
    let row = null, y0 = 0, dy = 0;
    list.addEventListener('pointerdown', e => {
      const g = e.target.closest('.grip'); if (!g) return; row = g.closest('[data-oid]'); if (!row) return;
      e.preventDefault(); g.setPointerCapture(e.pointerId); y0 = e.clientY; dy = 0; row.classList.add('lift'); list.classList.add('dragging');
    });
    list.addEventListener('pointermove', e => {
      if (!row) return; dy = e.clientY - y0; row.style.transform = `translateY(${dy}px)`;
      const r = row.getBoundingClientRect(); const mid = r.top + r.height / 2;
      const prev = row.previousElementSibling, next = row.nextElementSibling;
      if (prev && prev.dataset.oid && mid < prev.getBoundingClientRect().top + prev.getBoundingClientRect().height / 2) { prev.before(row); y0 += -(prev.getBoundingClientRect().height); row.style.transform = `translateY(${e.clientY - y0}px)`; }
      else if (next && next.dataset.oid && mid > next.getBoundingClientRect().top + next.getBoundingClientRect().height / 2) { next.after(row); y0 += next.getBoundingClientRect().height; row.style.transform = `translateY(${e.clientY - y0}px)`; }
    });
    const drop = () => { if (!row) return; row.style.transform = ''; row.classList.remove('lift'); list.classList.remove('dragging'); row = null; onChange(ids()); };
    list.addEventListener('pointerup', drop); list.addEventListener('pointercancel', drop);
  }
  function playerRow(p, { sub, on, select = false, right = '', rank = 0, order = false } = {}) {
    const snap = { lk: p.lk, id: p.id, name: p.name, short: p.short || p.name, img: p.img || '', team: p.team || '', teamId: p.teamId ? String(p.teamId) : '', color: BAD(p.color) ? '' : hx(p.color) };
    const star = `<span class="star${on ? ' on' : ''}">${on ? starSvg : starLine}</span>`;
    const pc = playerColor(p, LEAGUES[p.lk]);
    const rk = rank ? `<span class="lrk">${rank}</span>` : '';
    // the row carries the player's team colour so a followed row can be marked in it rather than in one white outline for everyone
    if (select) return `<button class="row prow sel${on ? ' on' : ''}" style="${tcv(pc)}" data-act="follow-player" data-snap='${esc(JSON.stringify(snap))}' aria-pressed="${on}">${rk}${headshot(p.img, pc, 46, p.name)}<span class="t"><b>${esc(p.name)}</b><span>${esc(sub || '')}</span></span>${right}${star}</button>`;
    if (order) return `<div class="row prow ordrow" data-oid="${esc(p.id)}"><span class="go">${headshot(p.img, pc, 46, p.name)}</span><span class="t"><b>${esc(p.name)}</b><span>${esc(sub || '')}</span></span>${orderTools}</div>`;
    return `<div class="row prow"><a class="go" href="${href.player(p.lk, p.id)}" aria-label="${esc(p.name)}">${rk}${headshot(p.img, pc, 46, p.name)}</a><a class="t" href="${href.player(p.lk, p.id)}"><b>${esc(p.name)}</b><span>${esc(sub || '')}</span></a>${right}<button class="star${on ? ' on' : ''}" data-act="follow-player" data-snap='${esc(JSON.stringify(snap))}' aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(p.name)}">${on ? starSvg : starLine}</button></div>`;
  }
  const lastName = n => { const w = String(n || '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '').trim().split(/\s+/); return w[w.length - 1] || ''; };
  async function playerPicker(el, L, { following = false, leaders = true, select = false } = {}) {
    const lk = L.key, pro = !/^ncaa/.test(lk);
    el.classList.add('pp');
    el.innerHTML = `<div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input type="search" placeholder="Search players or teams" autocomplete="off" aria-label="Search players"></div><div class="pp-list">${skeleton(6, 'row')}</div>`;
    const inp = el.querySelector('input'), list = el.querySelector('.pp-list');
    const idx = await teamsIndex(L);
    const mine = favs.all()[lk] || [];
    const [lp, rosters] = await Promise.all([leaders ? leaguePlayers(L).catch(() => null) : null, Promise.all(mine.map(id => rosterOf(L, id, idx).catch(() => null)))]);
    if (lp) fplayers.all().filter(p => p.lk === lk).forEach(p => { const r = lp.rows.find(x => x.id === p.id); if (r) { const c = teamColor({ id: r.teamId, abbr: r.team }, L); fplayers.update(lk, p.id, { name: r.name, short: r.short, img: r.img, team: r.team, teamId: r.teamId, color: BAD(c) ? null : c }); } });   // follows catch up with trades and new photos
    const ppg = {}; if (lp) lp.rows.forEach(r => { ppg[r.id] = r; });
    const line = p => { const r = ppg[p.id]; return r && r.gp ? `${r.pts.toFixed(1)} ppg` : ''; };
    const byLine = (a, b) => ((ppg[b.id] || {}).pts || 0) - ((ppg[a.id] || {}).pts || 0) || lastName(a.name).localeCompare(lastName(b.name)) || (a.name || '').localeCompare(b.name || '');
    const sections = rosters.filter(Boolean).map(r => ({ key: r.team.id, team: r.team, rows: r.players.slice().sort(byLine), open: false }));
    const missing = mine.filter((id, i) => !rosters[i]);
    const shown = () => new Set(sections.flatMap(s => s.rows.map(p => p.id)));
    const paint = (only) => {   // only === 'leaders': swap just the leaders block, the rest of the list stays as it is
      const q = inp.value.trim().toLowerCase();
      const fset = new Set(fplayers.all().filter(p => p.lk === lk).map(p => p.id));
      const rowOf = (p, s) => playerRow(p, { sub: [posWord(p.pos), p.jersey ? `No. ${p.jersey}` : '', line(p)].filter(Boolean).join(', '), on: fset.has(p.id), select });
      const parts = [];
      /* Every per-game number on this screen — the roster lines as well as the leaders — comes from one feed, and before a
         season tips off that feed is still serving the last completed one. So a college list in October is last season's,
         and a player drafted in June is still listed with the school he left. Say so once, at the top, rather than letting
         old averages read as this season's. The season name is the feed's own. */
      if (!q && lp && lp.stale && lp.label) parts.push(`<p class="legend lastyear">These are <b>${esc(lp.label)}</b> numbers — the new season hasn't started, so the feed is still on last season. Anyone drafted or transferred since is listed with the team he played for then.</p>`);
      if (q) {
        const teams = Object.values(idx).filter(t => `${t.name} ${t.short} ${t.abbr}`.toLowerCase().includes(q) && !sections.some(s => s.key === t.id)).sort((a, b) => (a.short || '').localeCompare(b.short || '')).slice(0, 5);
        if (teams.length) parts.push(sec('Teams', 'tap to see the roster') + `<div class="tgrp plain"><div class="rows">${teams.map(t => `<button class="row" data-pp="browse" data-id="${esc(t.id)}">${logo(t.logo)}<span class="t"><b>${esc(t.name)}</b><span>Show the roster</span></span>${chev}</button>`).join('')}</div></div>`);
      }
      if (following && !q) { const fl = fplayers.all().filter(p => p.lk === lk); if (fl.length) parts.push(sec('Following', `${fl.length}`, fl.length > 1 ? `<button data-pp="order" aria-pressed="${!!paint.order}">${paint.order ? 'Done' : 'Reorder'}</button>` : '') + `<div class="tgrp plain"><div class="rows${paint.order ? ' ordering' : ''}" data-order="players">${fl.map(p => playerRow(p, { sub: p.team || '', on: true, select, order: !!paint.order })).join('')}</div></div>`); }
      sections.forEach(s => {
        const rows = q ? s.rows.filter(p => `${p.name} ${s.team.name} ${s.team.abbr}`.toLowerCase().includes(q)) : s.rows; if (!rows.length) return;
        const folded = !q && !!(store.get('v5:ppcol', {}) || {})[s.key];   // a search always opens every team
        const picked = rows.filter(p => fset.has(p.id)).length;
        /* one card per team: the band at the top carries the team's colour and folds the roster, the roster is a column of
           hairline rows inside the same plate — a header over its contents, not a stack of look-alike pills */
        parts.push(`<section class="tgrp" style="${tcv(teamColor(s.team, L))}"><button class="thead pp-team" data-pp="fold" data-id="${esc(s.key)}" aria-expanded="${!folded}">${logo(s.team.logo, 's')}<b>${esc(s.team.short)}</b><span class="n">${rows.length}</span>${picked ? `<em class="pk">${picked} picked</em>` : ''}${chev}</button>${foldWrap(`<div class="rows">${rows.map(p => rowOf(p, s)).join('')}</div>`, folded)}</section>`);
      });
      if (lp && leaders) {
        // league leaders, per game, by category; a search keeps the whole list and filters it by name
        const CATS = [['pts', 'Points', 'ppg'], ['reb', 'Rebounds', 'rpg'], ['ast', 'Assists', 'apg'], ['tpm', 'Threes', '3PM'], ['stl', 'Steals', 'spg'], ['blk', 'Blocks', 'bpg']];
        const cat = CATS.find(([k]) => k === paint.lcat) ? paint.lcat : 'pts'; const unit = CATS.find(([k]) => k === cat)[2];
        const have = q ? new Set() : shown();
        const top = lp.rows.filter(p => !have.has(p.id) && p.gp >= 3 && (!q || `${p.name} ${p.team}`.toLowerCase().includes(q))).sort((a, b) => (b[cat] || 0) - (a[cat] || 0) || b.pts - a.pts);
        const cut = q || paint.topOpen ? Math.min(top.length, 100) : Math.min(top.length, 15);
        const chips = q ? '' : `<div class="chips lchips">${CATS.map(([k, l]) => `<button class="chip${k === cat ? ' on' : ''}" data-pp="lcat" data-cat="${k}" aria-pressed="${k === cat}">${l}</button>`).join('')}</div>`;
        // the subtitle names the season when it is not the one under way, so the list never reads as this year's form
        if (top.length) parts.push(`<div class="leaders">` + sec(q ? 'Around the league' : 'Leaders', q ? '' : (lp.stale && lp.label ? `${esc(lp.label)}, per game` : 'per game, three games or more'), cut < top.length ? `<button data-pp="top">More</button>` : '') + chips + `<div class="tgrp plain"><div class="rows">${top.slice(0, cut).map((p, i) => { const t = idx[p.teamId] || {}; const v = p[cat] || 0; return playerRow({ ...p, lk, color: t.color || '', teamId: p.teamId, team: t.short || p.team }, { sub: [t.short || p.team, posWord(p.pos).toLowerCase()].filter(Boolean).join(', '), on: fset.has(p.id), select, right: `<span class="r"><b>${v.toFixed(1)}</b><span>${unit}</span></span>`, rank: q ? 0 : i + 1 }); }).join('')}</div></div></div>`);
      }
      if (!parts.length) parts.push(q ? empty('No one matches', '<p style="margin:6px 0 0">Try a last name, or a team to see its whole roster.</p>')
        : mine.length ? empty("Couldn't load your teams' rosters", '<p style="margin:6px 0 0">The feed didn\'t answer. Search a team to try again.</p>')
        : empty(pro ? 'Follow a team first' : 'Players come from the teams you follow', `<p style="margin:6px 0 0">${pro ? 'Your teams\' rosters show here, with the league\'s top scorers below.' : 'Follow a school and its roster shows here, or search any school above.'}</p>`));
      if (missing.length && !q) parts.push(`<p class="foot">${missing.length} of your teams didn't answer; search for the team to load its roster.</p>`);
      if (only === 'leaders') { const cur = list.querySelector('.leaders'); const next = parts.find(h => h.startsWith('<div class="leaders">')); if (cur && next) { cur.outerHTML = next; const rows = list.querySelector('.leaders .rows'); if (rows) { rows.classList.add('opening'); setTimeout(() => rows.classList.remove('opening'), 500); } return; } }
      list.innerHTML = parts.join('');
      const ol = list.querySelector('[data-order="players"].ordering'); if (ol) dragOrder(ol, ids => { fplayers.reorder(lk, ids); document.dispatchEvent(new CustomEvent('rivl:follow', { detail: { reorder: true } })); });
    };
    paint();
    let t = null; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(paint, 120); });
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-pp]'); if (!b) return; e.preventDefault();
      if (b.dataset.pp === 'top') { paint.topOpen = true; paint('leaders'); }
      else if (b.dataset.pp === 'order') { paint.order = !paint.order; paint(); }
      else if (b.dataset.pp === 'lcat') {
        const was = list.querySelector('.lchips'); const sl = was ? was.scrollLeft : 0;   // the row is rebuilt; it must not jump back to the start
        paint.lcat = b.dataset.cat; paint.topOpen = false; paint('leaders');
        const y = list.querySelector('.lchips'); if (y) { y.scrollLeft = sl; const on = y.querySelector('.chip.on'); if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' }); if (y.getBoundingClientRect().top < 60) y.scrollIntoView({ block: 'start' }); }
      }
      else if (b.dataset.pp === 'fold') { const f = store.get('v5:ppcol', {}) || {}; const k = b.dataset.id; if (f[k]) delete f[k]; else f[k] = 1; store.set('v5:ppcol', f); foldToggle(b, !f[k]); }
      else if (b.dataset.pp === 'browse') { b.querySelector('.t span').textContent = 'Loading…'; const r = await rosterOf(L, b.dataset.id, idx).catch(() => null); if (r) { sections.push({ key: r.team.id, team: r.team, rows: r.players.slice().sort(byLine), open: true }); inp.value = ''; } paint(); }
    });
    const sync = (e) => { if (!el.isConnected) { document.removeEventListener('rivl:follow', sync); return; } if (e && e.detail && e.detail.reorder) return;
      const fs = new Set(fplayers.all().filter(p => p.lk === lk).map(p => p.id)); el.querySelectorAll('.thead.pp-team').forEach(h => { const body = h.nextElementSibling; const n = body ? [...body.querySelectorAll('[data-act="follow-player"]')].filter(b => { try { return fs.has(JSON.parse(b.dataset.snap).id); } catch { return false; } }).length : 0; let em = h.querySelector('em.pk'); if (n && !em) { em = document.createElement('em'); em.className = 'pk'; h.insertBefore(em, h.querySelector('.chev')); } if (em) { if (n) em.textContent = `${n} picked`; else em.remove(); } }); const fset = new Set(fplayers.all().filter(p => p.lk === lk).map(p => p.id)); el.querySelectorAll('[data-act="follow-player"]').forEach(b => { let id = ''; try { id = JSON.parse(b.dataset.snap).id; } catch { } const on = fset.has(String(id)), was = b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); const st = b.classList.contains('star') ? b : b.querySelector('.star'); if (st) { st.classList.toggle('on', on); st.innerHTML = on ? starSvg : starLine; if (on && !was) { st.classList.add('pop'); setTimeout(() => st.classList.remove('pop'), 450); } } }); if (following && !inp.value) paint(); };
    document.addEventListener('rivl:follow', sync);
  }
  async function players(lk) {
    const L = LEAGUES[lk];
    $main.innerHTML = `<div class="page-h"><h1>Players</h1><p>From the teams you follow. Search any team to see its roster.</p></div><div id="ppick"></div>`;
    await playerPicker($main.querySelector('#ppick'), L, { following: true, leaders: true });
  }

  HW.v5 = Object.assign(HW.v5 || {}, { home, scores, todayPill, player, players, playerPicker, rosterOf, monthGames, lastName, fplayers, prefs, teamInfo, teamsIndex, gameCard, heroCard,
    _: { h: H, logo, headshot, chev, sec, empty, skeleton, href, safeF, gameCard, heroCard, teamInfo, teamsIndex, fplayers, prefs, starSvg, starLine, tvLabel, teamColor, teamAlt, playerColor, tcv, tint, V_lift, V_deep, V_panel, V_vivid, pairColors, dragOrder, orderTools, foldToggle, learn, statusWord, seriesLine, seriesShort, seriesPick, seriesPickText, confName, dayUTC, athId, hsUrl, initials, retInfo, scVars, scoreColor, lift: V_lift, deep: V_deep, sized, imgSized } });
})();
