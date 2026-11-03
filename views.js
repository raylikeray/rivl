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
  /* v386: a colour white type can sit on. Gold, sky blue and silver plates washed white names out (Michigan, Vanderbilt);
     a light colour is darkened, keeping its hue, until white reads on it. Dark colours pass through unchanged. */
  const deepen = c => { const v = rgbOf(c); if (!v) return c; const L0 = lumOf(c); if (L0 <= .3) return c; const f = Math.sqrt(.3 / L0) * .92; return '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x * f))).toString(16).padStart(2, '0')).join(''); };
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
  const tint = c => { const root = document.documentElement; if (c && !BAD(c)) { root.style.setProperty('--tint', hx(c)); root.style.setProperty('--tint-ink', lumOf(hx(c)) > .6 ? '#0A0B0E' : '#FFFFFF'); root.setAttribute('data-tint', '1'); } else { root.style.removeProperty('--tint'); root.style.removeProperty('--tint-ink'); root.removeAttribute('data-tint'); } if (HW.v5.applyTheme) HW.v5.applyTheme(); };   // --tint-ink: what reads on the tint (a gold or a silver wants dark text)
  /* a team colour on an element: --tc raw (tints, rings), --tf-d/--tf-l the readable fill for black and white backgrounds — the
     stylesheet maps --tf to the one in use, so a black Spurs bar reads on black and a white one on white */
  /* the colour behind a face: a team colour lifted until a dark head of hair reads on it — the Spurs' black deepened for light
     mode put a black disc behind a black-haired face, so a disc never goes below a mid tone whatever the theme */
  const V_disc = c => { const l = lumOf(c); return l < .12 ? mixTo(c, 255, .58) : l < .28 ? mixTo(c, 255, .34) : c; };
  /* the ground a team's colour paints (a chosen tile, a picker band): the colour itself, except that a near-black colour
     (Spurs, Nets) paints a flat black bar with no diagonal and nothing to set it off from a dark page — so a black team's
     ground is its second colour when that reads (the Spurs' silver), else a charcoal the diagonal can still shade */
  const V_ground = (c, alt) => { if (lumOf(c) >= .08) return c; const a = alt && !BAD(alt) ? hx(alt) : ''; const la = a ? lumOf(a) : -1; return la >= .22 && la <= .9 ? a : mixTo(c, 255, .2); };
  const inkOn = c => lumOf(c) > .6 ? '#0A0B0E' : '#FFFFFF';
  /* One colour per team that reads apart from every other team's, for the places where many teams sit together — the
     picker's bands, the setup tiles. Half the NBA is navy and a third is red, so the feed's primaries alone gave the Knicks,
     76ers, Pistons, Clippers and Pacers one blue. Teams are taken in a fixed order (by id, so the result never depends on
     which teams a person follows) and each takes the first of its own colours that stands at least `D` from every colour
     already taken: the primary, a deeper cut of it, a lighter cut, then the second colour. A team's page keeps its real
     colour. Computed once per league. */
  const palettes = {};
  const distinctPalette = (L, idx) => {
    if (palettes[L.key]) return palettes[L.key];
    const D = 46, taken = [], out = {};
    const ids = Object.keys(idx).sort((a, b) => +a - +b || a.localeCompare(b));
    ids.forEach(id => {
      const t = idx[id]; const c = teamColor(t, L); if (BAD(c)) return;
      const alt = t.alt && !BAD(t.alt) ? hx(t.alt) : '';
      // the team's own hue first in a deeper and a lighter cut, its second colour only after — a lighter Thunder blue keeps
      // the Thunder blue; their orange would not
      const cands = [V_ground(c, alt), mixTo(c, 0, .32), mixTo(c, 255, .3)]; if (alt && lumOf(alt) >= .1 && lumOf(alt) <= .9) cands.push(alt);
      const dist = x => taken.length ? Math.min(...taken.map(y => rgbDist(x, y))) : 999;
      let pick = cands.find(x => dist(x) >= D); if (!pick) pick = cands.slice().sort((a, b) => dist(b) - dist(a))[0];
      taken.push(pick); out[id] = pick;
    });
    return palettes[L.key] = out;
  };
  const tcv = (c, alt = '') => { const g = V_ground(c, alt); return `--tc:${esc(c)};--tf-d:${esc(V_lift(c))};--tf-l:${esc(V_deep(c))};--hd:${esc(V_disc(c))};--ti:${inkOn(c)};--tg:${esc(g)};--tgi:${inkOn(g)}`; };   // --ti: what reads on the raw colour; --tg/--tgi: the ground and what reads on it
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
  /* v402: on a team-colour panel, ESPN's logo made for dark grounds (falling back to the usual one), and a thin light
     edge when the logo's colour is the panel's own (TCU purple on TCU purple) */
  const darkLogo = src => String(src || '').replace(/(\/teamlogos\/[a-z]+\/)500\//i, '$1500-dark/');
  const panelLogo = (src, px, extra = '') => { const d = darkLogo(src); return d === String(src || '') ? imgSized(src, px, px, extra) : imgSized(d, px, px, extra, `this.onerror=null;this.src='${sized(src, px, px)}'`); };
  const nearPanel = (t, panel, L) => rgbDist(teamColor(t, L), panel) < 120;
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
  /* a long list shows its first five; the rest open under them with Show all, and Show less folds them back without the page
     jumping: the button stays under the finger */
  const clip = (items, cls = 'rows', n = 5, what = '') => { const list = Array.isArray(items) ? items : [items]; const html = list.join('');
    return list.length > n ? `<div class="${cls} lclip">${html}<button class="cliptog" data-act="clip" data-total="${list.length}" data-what="${esc(what)}" aria-expanded="false">Show all ${list.length}${what ? ' ' + esc(what) : ''}</button></div>` : `<div class="${cls}">${html}</div>`; };
  /* one injury as a row: the face with the team's crest on it, the name, the team and the injury, the status pill with
     when they're expected back under it */
  const injRow = (L, key, x, team, p) => { const a = x.athlete || {}; const st = x.status || ''; const cls = /out/i.test(st) ? 'out' : /day|quest|doubt/i.test(st) ? 'q' : /prob|avail/i.test(st) ? 'ok' : 'q';
    const det = x.details || {}; const ret = retInfo(L, det.returnDate); const part = [det.side && !/not specified/i.test(det.side) ? det.side : '', det.type || det.location || ''].filter(Boolean).join(' ') || det.detail || '';
    const name = a.displayName || (p && p.name) || ''; const back = ret ? ret.short : (x.shortComment ? '' : ''); const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
    return `<button class="ijr" data-act="injury" data-key="${esc(key)}"><span class="ijf">${headshot(hsUrl(a) || (p && p.img) || '', teamColor(team, L), 46, name)}</span><span class="ijn"><b>${esc(name)}</b><small>${esc([team.short || team.abbr, part].filter(Boolean).join(' · '))}</small></span><span class="ijs"><span class="tag ${cls}">${esc(tagWord(st) || 'Listed')}</span>${back ? `<em>${esc(cap(back))}</em>` : ''}</span></button>`; };
  const statusWord = s => String(s || '').replace(/\bDay-To-Day\b/i, 'Day to day').replace(/\bGame Time Decision\b/i, 'Game-time decision').replace(/\bOut For Season\b/i, 'Out for season');
  const tagWord = s => { const w = statusWord(s); return /^day to day$/i.test(w) ? 'DTD' : /^game-time decision$/i.test(w) ? 'GTD' : w; };   // the short word for a status pill
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
  /* a game as a row of the Scores list: each team's crest and name on its own side (a gold star on the crest when you
     follow it), its record beside it before tip and its score once it starts, and between them the time with RIVL's pick,
     the clock, or Final. Rows sit together in one card per section. */
  function scoreRow(L, g, ctx) {
    scoreRow.ctx = scoreRow.ctx || {}; if (ctx) scoreRow.ctx[L.key] = ctx; else ctx = scoreRow.ctx[L.key] || null;   // a live repaint comes without the context: the last one stands in so the pick never drops out
    const live = g.state === 'in', fin = g.state === 'post' && !g.off, pre = !live && !fin;
    const a = +g.away.score, h = +g.home.score, has = (live || fin) && g.away.score != null && g.home.score != null;
    const up = (x, y) => has && x > y, lo = (x, y) => fin && has && x < y;
    const star = `<i class="sstar" aria-label="Following"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg></i>`;
    const side = (t, l) => { const f = HW.favs.has(L.key, t.id); return `<span class="stm${l ? ' lo' : ''}"><span class="scr">${t.logo ? imgSized(t.logo, 112, 112, 'alt=""') : `<b class="sab">${esc(t.abbr || '')}</b>`}${f ? star : ''}</span><b class="snm">${esc(t.short || t.abbr || '')}</b><b class="sab2">${esc(t.abbr || t.short || '')}</b></span>`; };
    const num = (t, u, l) => pre || t.score == null ? `<span class="ssc rec">${esc(t.rec || '')}</span>` : `<span class="ssc${u ? ' up' : ''}${l ? ' lo' : ''}">${esc(String(t.score))}</span>`;
    const f = !fin && !g.off && prefs.get('forecast') ? safeF(L, g, ctx) : null;
    const pick = f && Number.isFinite(f.pHome) ? `<small>${esc((f.pHome >= .5 ? g.home : g.away).abbr || '')} ${pct(Math.max(f.pHome, 1 - f.pHome))}</small>` : '';
    const mid = g.off ? `<span class="sft">${esc(g.off)}</span>` : live ? `<span class="slv"><i></i>${esc(g.detail || 'Live')}</span>${pick}` : fin ? `<span class="sft">${esc(finalWord(g))}</span>` : `<b class="stt">${esc(String(tipOf(g)).replace(/\s+(CT|ET|PT|MT|CST|CDT)$/, ''))}</b>${pick}`;
    const key = [g.state, g.away.score, g.home.score, g.detail, g.off || ''].join('|');
    return `<a class="srow${live ? ' on' : ''}" href="${href.game(L.key, g.id)}" data-gid="${esc(g.id)}" data-k="${esc(key)}">${side(g.away, lo(a, h))}${num(g.away, up(a, h), lo(a, h))}<span class="smid">${mid}</span>${num(g.home, up(h, a), lo(h, a))}${side(g.home, lo(h, a))}</a>`;
  }
  /* v389: the duel card, one renderer for Home's deck and the team and player pages. Two deep planes of the teams'
     colours split on a seam that follows the score (RIVL's pick before tip), the clock or tip and TV on top, the score
     face to face, the lead or the pick in the middle, one line of context at the foot. */
  /* v402: one colour rule for the Home card and the game page, so a matchup looks the same on both */
  const duelColors = (g, L) => duelPair(g, L).map(deepen);
  const duelPair = (g, L) => {
    let a = teamColor(g.away, L), b = teamColor(g.home, L);
    if (rgbDist(a, b) < 110) { const ok = c => c && !BAD(c) && lumOf(c) >= .06 && lumOf(c) <= .6; const aa = teamAlt(g.away, L), ba = teamAlt(g.home, L); const opts = [[a, b, rgbDist(a, b)]]; if (ok(ba)) opts.push([a, ba, rgbDist(a, ba)]); if (ok(aa)) opts.push([aa, b, rgbDist(aa, b)]); [a, b] = opts.sort((x, y) => y[2] - x[2])[0]; }
    return [a, b];
  };
  function duelCard(L, g, ctx, { kicker = '', foot = '', tvTop = true } = {}) {
    const lk = L.key; const live = isLive(g), done = g.state === 'post' && !g.off, pre = !live && !done;
    const [ca, cb] = duelColors(g, L);
    const f = !g.off ? safeF(L, g, ctx) : null; const ph = f && Number.isFinite(f.pHome) ? Math.min(.99, Math.max(.01, f.pHome)) : null;
    const hasSc = (live || done) && g.away.score != null && g.home.score != null;
    const share = hasSc ? .5 + Math.max(-.3, Math.min(.3, (+g.home.score - +g.away.score) / 30)) : ph != null ? ph : .5;
    const seam = Math.min(74, Math.max(26, 50 - (share - .5) * 80));
    const tv = tvLabel(g);
    const k = kicker || (live ? `<i class="dot"></i>${esc(HW.clockOf(g, L))}` : done ? esc(finalWord(g)) : g.off ? esc(g.off) : `${esc(relDay(HW.ymdOf(g.date)))} · ${esc(tipOf(g))}`) + (tvTop && tv && !done ? ` · ${esc(tv)}` : '');
    const side = (t, o) => `<span class="dks"><span class="logo${nearPanel(t, t === g.away ? ca : cb, L) ? ' ol' : ''}">${panelLogo(t.logo, 128)}</span><b>${esc(t.abbr || t.short)}</b>${hasSc ? `<em class="sc${+t.score >= +o.score ? '' : ' lo'}">${esc(String(t.score))}</em>` : `<em>${esc(t.rec || '')}</em>`}</span>`;
    const fav = ph != null ? (ph >= .5 ? g.home : g.away) : null;
    const lead = hasSc && +g.home.score !== +g.away.score ? (+g.home.score > +g.away.score ? g.home : g.away) : null;
    const mid = hasSc ? `<span class="dkm"><b>${live ? 'Live' : 'Final'}</b>${lead ? `${esc(lead.abbr)} ${live ? 'by' : 'won by'} ${Math.abs(+g.home.score - +g.away.score)}` : 'Level'}</span>` : fav ? `<span class="dkm"><b>${esc(fav.abbr)} ${pct(Math.max(ph, 1 - ph))}</b>to win</span>` : `<span class="dkm"><b>${esc(tipOf(g))}</b></span>`;
    const ft = foot || (hasSc && ph != null ? `RIVL had ${esc((ph >= .5 ? g.home : g.away).abbr)} ${pct(Math.max(ph, 1 - ph))}` : '');
    return `<a class="dk${live ? ' live' : ''}" href="${href.game(lk, g.id)}" style="--ca:${esc(ca)};--cb:${esc(cb)};--seam:${seam.toFixed(1)}%"><span class="wm a">${esc(g.away.abbr || '')}</span><span class="wm h">${esc(g.home.abbr || '')}</span><span class="dkk">${k}</span><span class="dkg">${side(g.away, g.home)}${mid}${side(g.home, g.away)}</span>${ft ? `<span class="dkf">${ft}</span>` : ''}</a>`;
  }
  /* the duel card with a short grouped list under it for where and on what channel: the long lines that used to run off
     the old card live here, where they wrap */
  function duelBlock(L, g, ctx, id) {
    const where = [g.venue, g.city].filter(Boolean).join(', '); const tv = tvLabel(g);
    const rows = [where ? ['Where', where] : null, tv ? ['TV', tv] : null].filter(Boolean);
    return `<div class="sgcard dkhost" data-gid="${esc(String(g.id))}">${duelCard(L, g, ctx, { tvTop: false })}${rows.length && g.state !== 'post' ? `<div class="gl dkinfo">${rows.map(([k, v]) => `<div class="gr ni"><span class="gm"><span>${esc(k)}</span></span><span class="ge"><b>${esc(v)}</b></span></div>`).join('')}</div>` : ''}</div>`;
  }
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
  function nowCard(L, lk, g, ctx) {
    const a = g.away, h = g.home, live = isLive(g), fin = g.state === 'post', pre = !live && !fin;
    const as = +a.score || 0, hs = +h.score || 0; const f = pre && !g.off ? safeF(L, g, ctx) : null; const pH = f && f.pHome != null ? f.pHome : null;
    const lead = live || fin ? (as > hs ? a : hs > as ? h : null) : (pH == null ? null : pH >= .5 ? h : a);
    const stripe = lead ? teamColor(lead, L) : 'var(--line-2)';
    const tip = new Date(g.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const margin = Math.abs(as - hs);
    const head = g.off ? `${esc(a.short)} at ${esc(h.short)} · ${esc(g.off)}`
      : fin ? (lead ? `${esc(lead.short)} beat ${esc(lead === a ? h.short : a.short)}` : `${esc(a.short)} and ${esc(h.short)} tied`)
      : live ? (lead ? `${esc(lead.short)} lead by ${margin}` : `${esc(a.short)} and ${esc(h.short)} level`)
      : `${esc(a.short)} ${g.neutral ? 'vs' : 'at'} ${esc(h.short)}, ${esc(tip)}`;
    const st = fin ? finalWord(g) : live ? g.detail : g.off ? '' : relDay(HW.ymdOf(g.date)) === 'Tonight' ? 'Tonight' : dayLabel(HW.ymdOf(g.date), { weekday: 'long' });
    const tv = tvLabel(g); const fav = pH == null ? '' : `${esc((pH >= .5 ? h : a).abbr || (pH >= .5 ? h : a).short)} ${Math.round(Math.max(pH, 1 - pH) * 100)}%`;
    const right = fin && ctx ? (() => { const f0 = safeF(L, g, ctx); return f0 && f0.pHome != null ? `Had ${esc((f0.pHome >= .5 ? h : a).short)} ${Math.round(Math.max(f0.pHome, 1 - f0.pHome) * 100)}%` : ''; })() : pre ? fav : '';
    const sub = pre ? [g.venue && g.venue.name, tv].filter(Boolean).join(' · ') : [tv, g.venue && g.venue.name].filter(Boolean).join(' · ');
    const sc = pre ? `<span class="nsc rec"><b>${esc(a.rec || '')}</b><b>${esc(h.rec || '')}</b></span>` : `<span class="nsc"><b class="${as >= hs ? '' : 'lo'}">${as}</b><b class="${hs >= as ? '' : 'lo'}">${hs}</b></span>`;
    /* the game page's hero, shrunk (Ray's pick A): both teams' colours, crest and name either side, the score big in the middle */
    const ca = teamColor(a, L) || '#333', ch = teamColor(h, L) || '#333';
    const big = pre ? `<span class="nhs pre">${esc(tip)}</span>` : `<span class="nhs"><b class="${as >= hs ? '' : 'lo'}">${as}</b><b class="${hs >= as ? '' : 'lo'}">${hs}</b></span>`;
    const side = t => `<span class="nht">${logo(t.logo, '', teamColor(t, L))}<b>${esc(t.short)}</b></span>`;
    return `<a class="nowc nhero${live ? ' nlive' : ''}" href="${href.game(lk, g.id)}" style="--ca:${esc(ca)};--ch:${esc(ch)}">
      <span class="nhmid">${side(a)}<span class="nhc"><span class="nhclk">${live ? '<i class="dot"></i>' : ''}${esc(live ? HW.clockOf(g, L) : st)}</span>${big}${tv ? `<small>${esc(tv)}</small>` : ''}</span>${side(h)}</span></a>`;
  }
  function heroCard(L, g, ctx, { page = false } = {}) {
    const f = prefs.get('forecast') && !g.tbd ? safeF(L, g, ctx) : null;
    let a = teamColor(g.away, L), b = teamColor(g.home, L);
    /* two teams in near enough the same colour (Knicks and 76ers, both royal blue) would paint one card in one colour: one
       side takes its second colour instead, whichever swap leaves the two halves furthest apart. A second colour too pale
       or too dark to carry white type is not used. */
    if (rgbDist(a, b) < 110) {
      const ok = c => c && !BAD(c) && lumOf(c) >= .06 && lumOf(c) <= .6;
      const aa = teamAlt(g.away, L), ba = teamAlt(g.home, L);
      const opts = [[a, b, rgbDist(a, b)]]; if (ok(ba)) opts.push([a, ba, rgbDist(a, ba)]); if (ok(aa)) opts.push([aa, b, rgbDist(aa, b)]);
      [a, b] = opts.sort((x, y) => y[2] - x[2])[0];
    }
    const fav = f ? (f.pHome >= .5 ? g.home : g.away) : null; const p = f ? Math.max(f.pHome, 1 - f.pHome) : 0;
    const favC = fav ? V_lift(fav === g.home ? b : a) : '#fff';   // the bar wears the favourite's own colour — the one its panel above is painted in — lifted so it reads on the dark strip
    const tm = t => t.tbd ? `<div class="tm"><span class="logo tbd"></span><b>TBD</b><span>${esc(noteWord(g))}</span></div>` : page ? `<a class="tm" href="${href.team(L.key, t.id)}" aria-label="${esc(t.name || t.short)} team page">${logo(t.logo, 'hero')}<b>${esc(t.short || t.name)}</b><span>${esc(recOf(t))}</span></a>` : `<div class="tm">${logo(t.logo, 'hero')}<b>${esc(t.short || t.name)}</b><span>${esc(recOf(t))}</span></div>`;
    const inner = `<div class="in">
      <div class="vs">${tm(g.away)}<div class="mid"><span class="st${g.state === 'in' ? ' on' : ''}">${esc(g.state === 'in' ? g.detail : g.state === 'post' ? finalWord(g) : tipOf(g))}</span>${g.off || g.state === 'pre' || (g.state === 'post' && (g.home.score == null || g.away.score == null)) ? '' : `<div class="sc">${g.away.score ?? '–'}<i>–</i>${g.home.score ?? '–'}</div>`}<span class="tv">${esc(tvLabel(g) || g.venue || '')}</span></div>${tm(g.home)}</div>
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
  const SECS = ['wire', 'unrivaled', 'hi', 'feed'];   // the wire first when it has something, then a game on now
  /* Home's rows unfold in place; the deck's dots follow the card in view */
  document.addEventListener('click', e => { const b = e.target.closest('[data-act="hrow"]'); if (!b) return; e.preventDefault(); const w = b.closest('.hrw'); const k = b.dataset.k; const open = !w.classList.contains('open'); w.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); if (open) hOpen.add(k); else hOpen.delete(k); });
  /* v382: the deck loops. A copy of the last card sits before the first and a copy of the first after the last; landing on
     a copy jumps, without animation, to the real card it copies, so swiping left from game 1 lands on the last game. The
     card you were on is kept across repaints and visits. */
  document.addEventListener('click', e => { const b = e.target.closest('[data-act="injmore"]'); if (!b) return; e.preventDefault(); b.closest('.feed').querySelectorAll('.fmore').forEach(x => { x.hidden = false; x.classList.remove('fmore'); }); b.remove(); });
  /* ===== v399: the pager — Apple-style swiping between a page's tabs =====
     Every panel is built and laid side by side in one horizontal strip; the phone's own scrolling moves it (momentum,
     snap, 120 Hz), so nothing is rebuilt mid-swipe. The underline rides under the finger. Each panel keeps its own
     vertical place: while you swipe, a panel you're not on is shifted so it shows where you left it, and on landing
     the page scrolls to that place with the shift removed in the same frame, so nothing jumps.
     pager(root, { tabs, strip, key, onShow }) — tabs: the row of buttons with data-tab; strip: the element holding
     panels with data-pg="<tab>". */
  function pager(root, { tabs, strip, start, onShow, stickTop = 0, inkW = 1, thumb = false } = {}) {
    if (!tabs || !strip) return null;
    const panels = [...strip.children]; const keys = panels.map(p => p.dataset.pg); const btns = keys.map(k => tabs.querySelector(`[data-tab="${k}"]`));
    if (panels.length < 2 || btns.some(b => !b)) return null;
    strip.classList.add('pgr'); panels.forEach(p => { p.classList.add('pgp'); p.hidden = false; });
    tabs.classList.add('pgd'); const ink = document.createElement('i'); ink.className = thumb ? 'pgi pgthumb' : 'pgi'; (btns[0].parentElement).appendChild(ink);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cur = Math.max(0, keys.indexOf(start)); const ys = {}; const seen = new Set([cur]);
    const W = () => strip.clientWidth || 1;
    const top0 = () => strip.getBoundingClientRect().top + window.scrollY;   // where the panels start on the page
    const stick = () => Math.max(0, top0() - stickTop - (tabs.offsetHeight || 0));   // the scroll at which the tabs pin
    const yFor = i => ys[i] != null ? ys[i] : Math.min(window.scrollY, stick());
    const place = () => { const y = window.scrollY; panels.forEach((p, i) => { p.style.transform = i === cur ? '' : `translateY(${y - yFor(i)}px)`; }); };
    const fit = (wide) => { const a = panels[cur].offsetHeight; const need = wide ? Math.max(a, window.scrollY + innerHeight - top0()) : a; strip.style.height = need + 'px'; };
    const inkTo = (x) => { const i = Math.floor(x), f = x - i; const a = btns[Math.max(0, Math.min(i, btns.length - 1))], b = btns[Math.max(0, Math.min(i + 1, btns.length - 1))];
      const L = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f, Wd = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * f; ink.style.transform = `translateX(${L + Wd * (1 - inkW) / 2}px)`; ink.style.width = Wd * inkW + 'px';
      const near = Math.round(x); btns.forEach((bt, j) => { const on = j === near; if (bt.classList.contains('on') !== on) { bt.classList.toggle('on', on); bt.setAttribute('aria-selected', String(on)); bt.setAttribute('aria-pressed', String(on)); } bt.style.opacity = String(.55 + .45 * Math.max(0, 1 - Math.abs(x - j))); }); };
    const land = (i) => { if (i === cur) { fit(false); return; } ys[cur] = window.scrollY; const y = yFor(i); cur = i; panels.forEach(p => { p.style.transform = ''; }); fit(false); window.scrollTo(0, y); place();
      if (!seen.has(i)) { seen.add(i); if (HW.v5.soft) HW.v5.soft(panels[i]); } if (onShow) onShow(keys[i]); };
    let t = 0, moving = false, down = false;
    // v400: never settle while a finger is still on the glass (a pause mid-swipe is not the end of it)
    const settle = () => { clearTimeout(t); t = setTimeout(() => { if (down) return; const i = Math.round(strip.scrollLeft / W()); if (Math.abs(strip.scrollLeft - i * W()) > 1) { strip.scrollTo({ left: i * W(), behavior: reduce ? 'auto' : 'smooth' }); return; } moving = false; land(i); }, 120); };
    strip.addEventListener('touchstart', () => { down = true; }, { passive: true });
    const up = () => { down = false; if (moving) settle(); };
    strip.addEventListener('touchend', up, { passive: true }); strip.addEventListener('touchcancel', up, { passive: true });
    strip.addEventListener('scroll', () => { const x = strip.scrollLeft / W(); inkTo(x); if (!moving) { moving = true; place(); fit(true); } settle(); }, { passive: true });
    window.addEventListener('scroll', () => { if (strip.isConnected) place(); }, { passive: true });
    btns.forEach((b, i) => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (i === cur && Math.abs(strip.scrollLeft - i * W()) < 2) { if (window.scrollY > stick()) window.scrollTo({ top: stick(), behavior: reduce ? 'auto' : 'smooth' }); return; } place(); fit(true); strip.scrollTo({ left: i * W(), behavior: reduce ? 'auto' : 'smooth' }); }, true));
    const ro = new ResizeObserver(() => { if (!moving) fit(false); inkTo(strip.scrollLeft / W()); }); panels.forEach(p => ro.observe(p)); ro.observe(strip);
    requestAnimationFrame(() => { strip.scrollLeft = cur * W(); inkTo(cur); fit(false); place(); });
    return { go: k => { const i = keys.indexOf(k); if (i >= 0) strip.scrollTo({ left: i * W(), behavior: reduce ? 'auto' : 'smooth' }); }, get key() { return keys[cur]; } };
  }
  const deckPos = { key: '', i: 0 };
  const deckStep = d => { const c = d.querySelector('.dk'); return c ? c.offsetWidth + 10 : d.clientWidth; };
  const deckDots = (d, real) => { const dots = d.parentElement.querySelector('.dkdots'); if (!dots) return; if (dots.classList.contains('n')) { const s = dots.querySelector('span'); if (s.textContent !== String(real + 1)) s.textContent = real + 1; } else [...dots.children].forEach((x, j) => x.classList.toggle('on', j === real)); };
  const deckJump = (d, i) => { const snap = d.style.scrollSnapType; d.style.scrollSnapType = 'none'; d.scrollLeft = i * deckStep(d); requestAnimationFrame(() => { d.style.scrollSnapType = snap; }); };
  function initDecks(root) {
    (root || document).querySelectorAll('.dkdeck[data-n]:not([data-init])').forEach(d => {
      d.dataset.init = '1'; const n = +d.dataset.n; const loop = d.dataset.loop === '1';
      const i = d.dataset.key === deckPos.key ? Math.min(deckPos.i, n - 1) : 0;
      requestAnimationFrame(() => { deckJump(d, i + (loop ? 1 : 0)); deckDots(d, i); });
      let t = 0;
      d.addEventListener('scroll', () => {
        const raw = Math.round(d.scrollLeft / Math.max(1, deckStep(d)));
        const real = loop ? (raw - 1 + n) % n : Math.min(raw, n - 1);
        deckDots(d, real); deckPos.key = d.dataset.key; deckPos.i = real;
        clearTimeout(t);
        if (loop) t = setTimeout(() => { const r = Math.round(d.scrollLeft / Math.max(1, deckStep(d))); if (r === 0) deckJump(d, n); else if (r === n + 1) deckJump(d, 1); }, 110);
      }, { passive: true });
    });
  }
  // initDecks is exported with the rest below
  let homeToken = 0;
  const hOpen = new Set();   // the Home rows you have unfolded, kept while the app is open
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
    const SIDE = new Set();   // one column: the phone is the only screen
    const col = k => $main.querySelector(SIDE.has(k) ? '.hcol.side' : '.hcol.main') || $main;
    const paint = (quiet = false) => { paint0(quiet); initDecks($main); };
    const paint0 = (quiet = false) => {
      if (!alive()) return;
      if (!painted) {
        painted = true;
        const colHtml = side => SECS.filter(k => SIDE.has(k) === side && secs[k]).map(k => wrap(k, false)).join('');
        $main.innerHTML = SECS.some(k => secs[k]) ? `<div class="hcols"><div class="hcol main">${colHtml(false)}</div><div class="hcol side">${colHtml(true)}</div></div>` : empty('Everything is switched off', '<p style="margin:6px 0 0">Turn some sections back on and Home fills up again.</p>', `<a class="btn" href="#settings">Settings</a>`);
        return;
      }
      if (!$main.querySelector('.hcols')) { painted = false; return paint0(quiet); }   // the empty state is on screen and something arrived
      SECS.forEach(k => {
        const cur = $main.querySelector(`section[data-sec="${k}"]`);
        if (!secs[k]) { if (cur) cur.remove(); return; }
        if (cur) { if (cur.dataset.h !== hashOf(secs[k])) {
          // a quiet patch keeps what you opened: a list you expanded stays expanded
          const open = [...cur.querySelectorAll('.lclip')].map(x => x.classList.contains('open'));
          cur.insertAdjacentHTML('afterend', wrap(k, quiet)); const nu = cur.nextElementSibling; cur.remove();
          [...nu.querySelectorAll('.lclip')].forEach((x, i) => { if (!open[i]) return; x.classList.add('open'); const b = x.querySelector(':scope > .cliptog'); if (b) { b.setAttribute('aria-expanded', 'true'); b.textContent = 'Show less'; } });
        } return; }
        const after = SECS.slice(SECS.indexOf(k) + 1).filter(j => SIDE.has(j) === SIDE.has(k)).map(j => $main.querySelector(`section[data-sec="${j}"]`)).find(Boolean);
        if (after) after.insertAdjacentHTML('beforebegin', wrap(k, quiet)); else col(k).insertAdjacentHTML('beforeend', wrap(k, quiet));
      });
    };

    // ----- what everything is built from -----
    const S0 = { games: [], last: [], ctx: null, st: null, tIdx: {}, teams: null, sums: {}, news: null, inj: null };
    const favTeam = t => mine.includes(String(t.id));
    const teamOf = p => { const k = String(p.team || '').toLowerCase(); return t => (p.teamId && String(t.id) === String(p.teamId)) || (k && [t.abbr, t.short, t.name].some(x => String(x || '').toLowerCase() === k)); };
    const chipOf = g => { const sc = g.off ? `<span>${esc(g.off)}</span>` : g.state === 'pre' ? `<span>${esc(tipOf(g))}</span>` : g.state === 'in' ? `<span class="on">${g.away.score}–${g.home.score} · ${esc(g.detail)}</span>` : `<span>${g.away.score}–${g.home.score} · ${esc(finalWord(g))}</span>`; return `<a class="bchip" href="${href.game(lk, g.id)}">${logo(g.away.logo, 's', teamColor(g.away, L))}<b>${esc(g.away.abbr || g.away.short)}</b><i>${g.neutral ? 'vs' : 'at'}</i>${logo(g.home.logo, 's', teamColor(g.home, L))}<b>${esc(g.home.abbr || g.home.short)}</b>${sc}${seriesShort(g) ? `<em class="po">${esc(seriesShort(g))}</em>` : ''}</a>`; };
    // one game on a timeline: an open ring before the final, a check once it's over, both teams stacked with their
    // scores, the result or tip time on the right, and RIVL's pregame pick as a two-colour bar underneath
    const pickColors = g => {
      let a = teamColor(g.away, L), b = teamColor(g.home, L);
      if (rgbDist(a, b) < 110) {
        const ok = c => c && !BAD(c) && lumOf(c) >= .06 && lumOf(c) <= .6;
        const aa = teamAlt(g.away, L), ba = teamAlt(g.home, L);
        const opts = [[a, b, rgbDist(a, b)]]; if (ok(ba)) opts.push([a, ba, rgbDist(a, ba)]); if (ok(aa)) opts.push([aa, b, rgbDist(aa, b)]);
        [a, b] = opts.sort((x, y) => y[2] - x[2])[0];
      }
      return [a, b];
    };
    const rowOf = g => {
      const live = g.state === 'in', done = g.state === 'post' && !g.off, showSc = (live || done) && !g.off;
      const side = (t, which) => `<span class="gt ${which}">${logo(t.logo, 's', teamColor(t, L))}<b>${esc(t.abbr || t.short)}</b></span><span class="gsc ${which}">${showSc ? (t.score ?? '–') : ''}</span>`;
      const status = g.off ? esc(g.off) : live ? esc(g.detail) : done ? esc(finalWord(g)) : esc(tipOf(g));
      const mark = done ? `<i class="gmk ok" aria-label="Final"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12.5l4 4 8-9"/></svg></i>` : `<i class="gmk${live ? ' on' : ''}"></i>`;
      let bar = '';
      const f = !done && !g.off ? safeF(L, g, S0.ctx) : null;
      if (f && Number.isFinite(f.pHome)) {
        const ph = Math.min(.99, Math.max(.01, f.pHome)), pa = 1 - ph; const [ca, cb] = pickColors(g);
        const fav = ph >= .5 ? g.home : g.away, fp = Math.max(ph, pa);
        bar = `<span class="gpk"><span class="gbar"><i style="flex:${pa.toFixed(3)};${tcv(ca, teamAlt(g.away, L))}"></i><i style="flex:${ph.toFixed(3)};${tcv(cb, teamAlt(g.home, L))}"></i></span><b>${esc(fav.abbr || fav.short)} ${pct(fp)}</b></span>`;
      }
      return `<a class="grow${live ? ' on' : ''}${done ? ' done' : ''}${bar ? ' pk' : ''}" href="${href.game(lk, g.id)}">${mark}${side(g.away, 'away')}${side(g.home, 'home')}<span class="gst">${status}</span>${bar}${seriesShort(g) ? `<em class="po">${esc(seriesShort(g))}</em>` : ''}</a>`;
    };
    const dayWord = (ymd, long) => { const rd = relDay(ymd); return rd === 'Tomorrow' || rd === 'Tonight' ? rd : dayLabel(ymd, { weekday: long ? 'long' : 'short' }); };
    const nextChip = g => `<a class="bchip next" href="${href.game(lk, g.id)}"><em>${esc(dayWord(HW.ymdOf(g.date)))}</em>${logo(g.away.logo, 's', teamColor(g.away, L))}<b>${esc(g.away.abbr || g.away.short)}</b><i>${g.neutral ? 'vs' : 'at'}</i>${logo(g.home.logo, 's', teamColor(g.home, L))}<b>${esc(g.home.abbr || g.home.short)}</b><span>${esc(tipOf(g))}</span></a>`;
    const basicTeam = id => { const t = S0.tIdx[id]; const r = S0.st && S0.st.byId && S0.st.byId[id]; if (!t && !r) return null; return { id, abbr: t ? t.abbr : r.abbr, name: t ? t.name : r.name, short: t ? t.short : r.short, loc: t ? t.loc : r.loc, color: teamColor({ id, color: t && t.color }, L), logo: (t && t.logo) || (r && r.logo) || '', rec: r ? `${r.w}-${r.l}` : '', standing: r && L.standingsMode !== 'conferences' ? `${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}` : '', row: r || null, next: null, last: null }; };
    const teamList = () => S0.teams ? S0.teams.filter(Boolean) : mine.map(basicTeam).filter(Boolean);

    const build = () => {
      const { games, last, ctx } = S0; const teams = teamList();
      const byTeam = new Map(); games.forEach(g => { byTeam.set(g.home.id, g); byTeam.set(g.away.id, g); });
      /* the off-season: no games today, and every team you follow last played more than three days ago with nothing on the
         calendar for three weeks. Tonight goes, Last night becomes a short season recap, and team rows stop showing a
         result from weeks back. */
      const DAY = 864e5, now = Date.now();
      const offS = !games.length && !!S0.teams && teams.length > 0 && teams.every(t => (!t.next || new Date(t.next.date) - now > 21 * DAY) && (!t.last || now - new Date(t.last.date) > 3 * DAY));
      // Unrivaled leads the WNBA's Home once its season is over
      if (lk === 'wnba' && S0.unr && (offS || !S0.teams && !games.length)) secs.unrivaled = S0.unr; else delete secs.unrivaled;
      // tonight: your games, or the next ones on the calendar once the schedules are in
      const liveMine = games.filter(g => isLive(g) && isFav(g));
      if (P.brief && mine.length && !offS && !(P.live && liveMine.length && games.filter(isFav).length === liveMine.length)) {   // when every game of yours is on now, the hero says it all
        const tonight = games.filter(g => isFav(g) && !(P.live && isLive(g))).sort((a, b) => new Date(a.date) - new Date(b.date) || rankGame(b) - rankGame(a));   // a timeline: in the order they tip
        let body = '', note = '', title = 'Tonight';
        if (tonight.length) { note = `${tonight.length} ${P.live && liveMine.length ? 'more ' : ''}game${tonight.length === 1 ? '' : 's'} for your teams${tonight.every(g => g.state === 'post') ? ' · all final' : ''}`; body = clip(tonight.map(rowOf), 'glist'); }
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
      if (P.brief && offS) {
        /* the season recap: each team's final record and standing and how its season closed; your players' season lines */
        const season = (() => { const y = teams.map(t => t.last && t.last.date).filter(Boolean).sort().pop(); return y ? new Date(y).getFullYear() : ''; })();
        const trow = t => { const g = t.last; const us = g ? (g.home.id === t.id ? g.home : g.away) : null, them = g ? (g.home.id === t.id ? g.away : g.home) : null;
          const won = us && them && +us.score > +them.score; const lastW = g && us && them && us.score != null ? `${won ? 'W' : 'L'} ${us.score}-${them.score}` : '';
          return `<a class="row" href="${href.team(lk, t.id)}">${logo(t.logo, '', teamColor(t, L))}<span class="t"><b>${esc(t.short)}</b><span>${esc([t.rec ? `Finished ${t.rec}` : '', t.standing].filter(Boolean).join(', '))}</span></span>${g ? `<span class="r"><b class="res ${won ? 'w' : 'l'}" style="font-size:14px">${esc(lastW)}</b><span>${esc(`${g.home.id === t.id ? 'vs' : 'at'} ${them.abbr || them.short || ''}, ${dayLabel(HW.ymdOf(g.date), { month: 'short', day: 'numeric' })}`)}</span></span>` : ''}</a>`; };
        const pl = S0.lp && S0.lp.rows ? fp.map(p => S0.lp.rows.find(r => r.id === String(p.id))).filter(r => r && r.gp) : [];
        const prow = r => { const p = fp.find(x => String(x.id) === r.id) || {}; return `<a class="row" href="${href.player(lk, r.id)}">${headshot(r.img || p.img, playerColor(p, L), 44, r.name)}<span class="t"><b>${esc(p.short || r.short || r.name)}</b><span>${esc(`${r.pts.toFixed(1)} pts, ${r.reb.toFixed(1)} reb, ${r.ast.toFixed(1)} ast a game over ${r.gp} games`)}</span></span><span class="r"><b>${r.pts.toFixed(1)}</b><span>ppg</span></span></a>`; };
        secs.last = `<div class="brief"><div class="brief-h"><b>Season recap</b><span>${esc(`${season ? season + ' ' : ''}season is over`)}</span></div><div class="rows brief-rows">${teams.map(trow).join('')}${pl.map(prow).join('')}</div></div>`;
      } else if (P.brief) {
        const mineLast = last.filter(g => isDone(g) && isFav(g));
        if (mineLast.length || lines.length) {
          const res = mineLast.map(g => { const us = favTeam(g.home) ? g.home : g.away, them = us === g.home ? g.away : g.home; const won = us.score > them.score; return `<a class="bchip res" href="${href.game(lk, g.id)}">${logo(us.logo, 's', teamColor(us, L))}<b class="${won ? 'w' : 'l'}">${won ? 'W' : 'L'}</b><span>${us.score}–${them.score} ${us === g.home ? 'vs' : 'at'} ${esc(them.abbr || them.short)}</span></a>`; });
          const rows = lines.map(x => `<a class="row" href="${href.game(lk, x.g.id)}/p/${esc(String(x.p.id))}">${headshot(x.p.img, x.us ? teamColor(x.us, L) : playerColor(x.p, L), 44, x.p.name)}<span class="t"><b>${esc(x.p.short || x.p.name)}</b><span>${x.dnp ? esc(x.dnp) : `${esc(x.pts)} pts, ${esc(x.reb)} reb, ${esc(x.ast)} ast in a ${x.won ? 'win' : 'loss'} ${x.us === x.g.home ? 'vs' : 'at'} ${esc(x.them.short)}`}</span></span>${x.dnp ? '' : `<span class="r"><b>${esc(x.pts)}</b><span>pts</span></span>`}</a>`);
          secs.last = `<div class="brief"><div class="brief-h"><b>Last night</b><span>${esc(dayLabel(yday, { weekday: 'long' }))}</span></div>${res.length ? `<div class="brief-row">${res.join('')}</div>` : ''}${rows.length ? clip(rows, 'rows brief-rows', 5, 'players') : ''}</div>`;
        } else delete secs.last;
      }
      // your teams playing right now: the hero
      const live = games.filter(g => isLive(g) && isFav(g)).sort((a, b) => rankGame(b) - rankGame(a));
      if (live.length && P.live) secs.live = sec('Live now') + `<div class="heroes nheroes">${live.map(g => nowCard(L, lk, g, ctx)).join('')}</div>`; else delete secs.live;
      // my teams: record, what's next or how it's going, win chance
      if (P.teams) {
        const rows = teams.map(t => {
          const g0 = byTeam.get(t.id) || t.next || t.last; const g = offS && g0 === t.last ? null : g0; const f = g ? safeF(L, g, ctx) : null;
          const us = g ? (g.home.id === t.id ? g.home : g.away) : null, them = g ? (g.home.id === t.id ? g.away : g.home) : null;
          let line = offS ? `Season over${t.standing ? `, ${t.standing}` : ''}` : t.standing || (S0.teams ? 'No game scheduled' : ''), right = '';
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
        secs.teams = sec('My teams', '', `<a href="#teams">Edit</a>`) + (rows.length ? clip(rows, 'rows', 5, 'teams') : mine.length ? skeleton(mine.length, 'row') : empty('No teams yet', '', `<a class="btn" href="#teams">Choose teams</a>`));
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
        const row = (x, i, t, p) => { const a = x.athlete || {}; const id = athId(a) || (p && p.id) || ''; const key = `h:${t.id}:${id}:${x.id || i}`; S.injuries[key] = { x, id, team: t }; const st = x.status || ''; const cls = /out/i.test(st) ? 'out' : /day|quest|doubt/i.test(st) ? 'q' : /prob|avail/i.test(st) ? 'ok' : ''; const det = x.details || {}; const ret = retInfo(L, det.returnDate); const why = [det.type || det.detail, ret ? ret.short : ''].filter(Boolean).join(', '); const name = a.displayName || (p && p.name) || ''; return `<button class="row${p ? ' fav' : ''}" data-act="injury" data-key="${esc(key)}">${headshot(hsUrl(a) || (p && p.img) || '', teamColor(t, L), 44, name)}<span class="t"><b>${esc(name)}${p ? `<i class="fstar" title="You follow them">${starSvg}</i>` : ''}</b><span>${esc(why || (x.shortComment || '').slice(0, 80))}</span></span><span class="tag ${cls}">${esc(tagWord(st))}</span></button>`; };
        const groups = [];
        teams.forEach(t => { const b = inj.byTeam[t.id]; if (b && b.list.length) groups.push({ t, rows: b.list.map((x, i) => ({ x, i, p: pById.get(athId(x.athlete)) || null })) }); });
        const have = new Set(groups.map(g => g.t.id));
        if (fp.length) (inj.teams || []).forEach(tt => { const tid = String(tt.id || ''); if (!tid || have.has(tid)) return; const rows = (tt.injuries || []).map((x, i) => ({ x, i, p: pById.get(athId(x.athlete)) || null })).filter(r => r.p); if (!rows.length) return; const ti = S0.tIdx[tid] || {}; groups.push({ t: { id: tid, short: ti.short || tt.displayName || rows[0].p.team || '', logo: ti.logo || '', color: ti.color || playerColor(rows[0].p, L) }, rows, only: true }); });
        const flat = groups.flatMap(({ t, rows }) => rows.map(({ x, i, p }) => { const id = athId(x.athlete) || (p && p.id) || ''; const key = `h:${t.id}:${id}:${x.id || i}`; S.injuries[key] = { x, id, team: t }; return injRow(L, key, x, t, p); }));
        if (flat.length) secs.injuries = sec('Injuries', 'your teams and players') + clip(flat, 'ijl'); else delete secs.injuries;
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
          const more = items.slice(1);
          S0.wireItems = items; S0.wireWho = who; delete secs.wire;   // v391: breaking stories are pinned posts at the top of the feed
        } else { S0.wireItems = []; delete secs.wire; }
      } else { S0.wireItems = []; delete secs.wire; }
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

      /* ===== Home (v380): the feed. Under the greeting and the deck, one running timeline of everything that happened
         to your teams and players, newest first, in Apple's grouped card: a result, a player's line, an injury, a game
         about to tip, a story. Each post is the finished thing and opens what it is about. ===== */
      ['last', 'tonight', 'injuries', 'players', 'teams', 'news'].forEach(k => delete secs[k]);
      const NOW = Date.now(); const posts = []; const wireIds = new Set((S0.wireItems || []).map(a => String(a.id)));
      const when = ts => { const d = (NOW - ts) / 6e4; if (d < -1) { const m = -d; return m < 60 ? `in ${Math.round(m)}m` : `in ${Math.round(m / 60)}h`; } if (d < 1) return 'now'; if (d < 60) return `${Math.round(d)}m`; if (d < 1440) return `${Math.round(d / 60)}h`; return `${Math.round(d / 1440)}d`; };
      const crest = t => logo(t.logo, '', teamColor(t, L));
      /* v393: the feed is ordered by what matters, not by clock. Tiers: 0 breaking · 1 live · 2 results (your players'
         lines under their game) · 3 today's games · 4 injury CHANGES · 5 standings moves · 6 news. Within a tier, newest
         first (today's games: soonest first). ESPN re-stamps its whole injury report overnight, so the report's own dates
         can't say what's new: the phone keeps a log of each player's last status and posts only when it changes. */
      let tier = 9;
      const post = (k, to, av, who, kind, body, extra = '', act = '', lab = '', cls = '') => posts.push({ tier, k, html: `<${to ? `a href="${to}"` : `button${act}`} class="fp${cls ? ' ' + cls : ''}">${`<span class="fav">${av}</span>`}<span class="fb"><span class="fh"><b>${who}</b>${kind ? `<span>${kind}</span>` : ''}<time>${lab || when(k)}</time></span><span class="ft">${body}</span>${extra}</span></${to ? 'a' : 'button'}>` });
      const leadOf = (t, name) => { const l = (t.leaders || []).find(x => new RegExp(name, 'i').test(x.name || '')); const a = l && l.leaders && l.leaders[0]; return a && a.athlete ? { n: a.athlete.shortName || a.athlete.displayName || '', v: a.displayValue || a.value } : null; };
      const strip = (g) => { const cells = [[g.away, 'points'], [g.home, 'points'], [+g.home.score >= +g.away.score ? g.home : g.away, 'rebounds']].map(([t, k]) => { const x = leadOf(t, k); return x ? `<span><b>${esc(String(x.v).replace(/\s.*$/, ''))}</b><small>${esc(`${lastName(x.n)} · ${k === 'points' ? 'PTS' : 'REB'}`)}</small></span>` : ''; }).filter(Boolean); return cells.length ? `<span class="fx">${cells.join('')}</span>` : ''; };
      const endTs = g => Math.min(new Date(g.date).getTime() + 2.4 * 36e5, NOW - 6e4);
      const outsOf = t => { const b = S0.inj && S0.inj.byTeam[t.id]; return (b && b.list || []).filter(x => /out|suspen/i.test(x.status || '')).map(x => lastName((x.athlete || {}).displayName || '')).filter(Boolean); };
      const without = (t) => { const o = outsOf(t); return o.length ? `${esc(t.short)} without ${esc(o.length > 2 ? `${o.slice(0, 2).join(', ')} and ${o.length - 2} more` : o.join(' and '))}.` : ''; };
      // 1 · live
      tier = 1;
      if (P.teams) games.filter(g => isLive(g) && isFav(g)).forEach(g => { const us = favTeam(g.home) ? g.home : g.away, them = us === g.home ? g.away : g.home; const d = +us.score - +them.score;
        post(NOW, href.game(lk, g.id), crest(us), esc(us.short), `<i class="lvd"></i>Live · ${esc(HW.clockOf(g, L))}`, `${d > 0 ? `Up ${d} on` : d < 0 ? `Down ${-d} to` : 'Tied with'} ${esc(them.short)}, <b>${esc(String(us.score))}–${esc(String(them.score))}</b>.`, strip(g), '', 'now'); });
      // 2 · results, each with your players' lines from that game right under it
      tier = 2;
      const linesBy = {}; lines.forEach(x => { (linesBy[x.g.id] = linesBy[x.g.id] || []).push(x); });
      const lineLabel = x => { const big = !x.dnp && (+x.pts >= 30 || (+x.pts >= 10 && +x.reb >= 10 && +x.ast >= 10)); return { big, txt: x.dnp ? `${esc(x.dnp)} ${x.us === x.g.home ? 'against' : 'at'} ${esc(x.them.short)}.` : `<b>${esc(String(x.pts))} pts</b>, ${esc(String(x.reb))} reb, ${esc(String(x.ast))} ast in a ${x.won ? 'win' : 'loss'} ${x.us === x.g.home ? 'over' : 'at'} ${esc(x.them.short)}.` }; };
      const linePost = (x, k) => { const { big, txt } = lineLabel(x); post(k, `${href.game(lk, x.g.id)}/p/${esc(String(x.p.id))}`, headshot(x.p.img, x.us ? teamColor(x.us, L) : playerColor(x.p, L), 40, x.p.name), esc(x.p.short || x.p.name), big ? '<em class="fbig">Big night</em>' : esc(x.us ? x.us.abbr || '' : x.p.team || ''), txt, '', '', '', big ? 'fstand' : ''); };
      const shown = new Set();
      if (P.brief) games.concat(last).filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i).filter(g => isDone(g) && !g.off && isFav(g)).forEach(g => {
        const us = favTeam(g.home) ? g.home : g.away, them = us === g.home ? g.away : g.home; const won = +us.score > +them.score;
        const f = safeF(L, g, ctx); const ph = f && Number.isFinite(f.pHome) ? f.pHome : null; const pu = ph == null ? null : us === g.home ? ph : 1 - ph;
        const note = pu == null ? '' : (pu >= .5) === won ? ' RIVL called it.' : won ? ` An upset: RIVL gave them ${pct(pu)}.` : ` RIVL had them at ${pct(pu)}.`;
        const k = endTs(g);
        post(k, href.game(lk, g.id), crest(us), esc(us.short), esc(finalWord(g)), `${won ? 'Beat' : 'Lost to'} ${esc(them.short)} <b class="${won ? 'wl-w' : 'wl-l'}">${esc(String(us.score))}–${esc(String(them.score))}</b>.${esc(note)}`, strip(g));
        if (P.players) (linesBy[g.id] || []).forEach((x, i) => { linePost(x, k - 1 - i); shown.add(x); });
      });
      if (P.players) lines.filter(x => !shown.has(x)).forEach(x => linePost(x, endTs(x.g)));
      // 3 · today's games, soonest first, with who's sitting
      tier = 3;
      if (P.teams) games.filter(g => g.state === 'pre' && !g.off && isFav(g) && HW.ymdOf(g.date) === today).forEach(g => { const us = favTeam(g.home) ? g.home : g.away, them = us === g.home ? g.away : g.home; const t0 = new Date(g.date).getTime();
        const f = safeF(L, g, ctx); const pu = f && Number.isFinite(f.pHome) ? (us === g.home ? f.pHome : 1 - f.pHome) : null;
        const sit = [without(us), without(them)].filter(Boolean).join(' ');
        post(-t0, href.game(lk, g.id), crest(us), esc(us.short), +new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }).format(new Date(t0)) % 24 >= 17 ? 'Tonight' : 'Today', `Face ${esc(them.short)} ${us === g.home ? 'at home' : 'on the road'}${tvLabel(g) ? ` on ${esc(tvLabel(g))}` : ''}.${pu != null ? ` RIVL gives them <b>${pct(pu)}</b>.` : ''}${sit ? `<span class="fsit">${sit}</span>` : ''}`, '', '', esc(tipOf(g).replace(/\s*CT$/, ''))); });
      // 4 · injury changes, from the phone's own log
      tier = 4;
      if (P.injuries && S0.inj && (S0.inj.teams || []).length) {
        const LOGK = 'v5:injlog:' + lk; const log0 = store.get(LOGK, null); const seeded = !!(log0 && log0.__seeded); const log = Object.assign({}, log0 || {}); let dirty = !seeded;
        const pById = new Map(fp.map(p => [p.id, p])); const cur = {};
        const sKey = st => /out for season/i.test(st) ? 'season' : /out/i.test(st) ? 'out' : /doubt/i.test(st) ? 'doubtful' : /quest|game.?time/i.test(st) ? 'questionable' : /day/i.test(st) ? 'dtd' : /prob|avail/i.test(st) ? 'probable' : 'listed';
        teams.forEach(t => { const b = S0.inj.byTeam[t.id]; (b && b.list || []).forEach((x, i) => { const a = x.athlete || {}; const id = athId(a); if (!id) return; cur[id] = { x, i, t, a, s: sKey(x.status || '') }; }); });
        const changes = [];
        Object.entries(cur).forEach(([id, c]) => { const prev = log[id];
          if (!prev || prev.s !== c.s) { if (seeded) changes.push({ id, c, from: prev ? prev.s : '' }); log[id] = { s: c.s, at: seeded ? NOW : 0, team: c.t.id, nm: c.a.displayName || '' }; dirty = true; } });
        Object.entries(log).forEach(([id, e]) => { if (id === '__seeded' || cur[id] || e.s === 'cleared') return; if (!teams.some(t => t.id === e.team)) return; log[id] = { s: 'cleared', at: NOW, team: e.team, nm: e.nm }; dirty = true; });
        Object.entries(log).forEach(([id, e]) => { if (id !== '__seeded' && e.s === 'cleared' && NOW - e.at > 7 * 864e5) { delete log[id]; dirty = true; } });
        if (dirty) { log.__seeded = true; store.set(LOGK, log); }
        // what posts: anything whose status changed in the last 48 hours, rest days only for players you follow
        const recent = Object.entries(log).filter(([id, e]) => id !== '__seeded' && e.at && NOW - e.at < 48 * 36e5);
        const rows = recent.map(([id, e]) => {
          const c = cur[id]; const p = pById.get(id) || null; const t = c ? c.t : (teams.find(x => x.id === e.team) || {}); const nm = e.nm || (p && p.name) || '';
          if (!c) return { k: e.at, imp: 1, html: () => post(e.at, href.player(lk, id), headshot('', teamColor(t, L), 40, nm), esc(t.short || ''), 'Injury', `<b>${esc(nm)}</b> is off the injury report.`, '', '', '', 'finj') };
          const x = c.x; const det = x.details || {}; const rest = /rest/i.test(`${det.type || ''} ${det.detail || ''} ${x.shortComment || ''}`); if (rest && !p) return null;
          const key = `h:${t.id}:${id}:${x.id || c.i}`; S.injuries = S.injuries || {}; S.injuries[key] = { x, id, team: t };
          const st = statusWord(x.status || ''); const ret = retInfo(L, det.returnDate); const part = (det.type || det.location || det.detail || '').toLowerCase(); const out = /out/i.test(st);
          const txt = out ? `<b>${esc(nm)}</b> is out${part && !rest ? ` with ${/^[aeiou]/.test(part) ? 'an' : 'a'} ${esc(part)} injury` : ''}${ret && !ret.past ? (ret.far ? ' for the season.' : `, back around ${esc(ret.long)}.`) : '.'}` : `<b>${esc(nm)}</b> is ${esc(st.toLowerCase())}${part ? ` (${esc(part)})` : ''}.`;
          return { k: e.at, imp: c.s === 'season' ? 4 : c.s === 'out' ? 3 : c.s === 'doubtful' ? 2 : 1, html: () => post(e.at, '', headshot(hsUrl(c.a) || (p && p.img) || '', teamColor(t, L), 40, nm), esc(t.short), 'Injury', txt, '', ` data-act="injury" data-key="${esc(key)}"`, '', 'finj') };
        }).filter(Boolean).sort((a, b) => (b.imp - a.imp) || (b.k - a.k));
        rows.slice(0, 5).forEach(r => r.html());
        if (rows.length > 5) { const n0 = posts.length; rows.slice(5).forEach(r => r.html()); posts.slice(n0).forEach(pp => { pp.html = pp.html.replace('class="fp finj"', 'class="fp finj fmore" hidden'); });
          posts.push({ tier, k: -Infinity, html: `<button class="fp fmorebtn" data-act="injmore"><span class="fav"><span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></span><span class="fb"><span class="ft">${rows.length - 5} more injury update${rows.length - 5 === 1 ? '' : 's'}</span></span></button>` }); }
      }
      // 5 · standings moves since yesterday
      tier = 5;
      if (P.teams && S0.st && S0.st.byId && L.standingsMode !== 'conferences') {
        const SK = 'v5:stsnap:' + lk; let snap = store.get(SK, null) || { day: '', cur: {}, prev: {} };
        const now = {}; teams.forEach(t => { const r = S0.st.byId[t.id]; if (r && r.pos) now[t.id] = r.pos; });
        if (snap.day !== today) snap = { day: today, prev: snap.cur || {}, cur: now }; else snap.cur = Object.assign({}, snap.cur, now);
        store.set(SK, snap);
        teams.forEach(t => { const a = snap.prev[t.id], b = snap.cur[t.id]; const r = S0.st.byId[t.id]; if (!a || !b || a === b || !r) return;
          const up = b < a; post(NOW - 864e5 / 2, href.team(lk, t.id), crest(t), esc(t.short), 'Standings', `${up ? 'Climb' : 'Slip'} to <b>${ordinal(b)} in the ${esc(confName(r.group, r.groupAbbr))}</b>, ${up ? 'up' : 'down'} from ${ordinal(a)}. ${esc(`${r.w}-${r.l}`)}.`, '', '', 'today'); });
      }
      // 6 · news from the last two days
      tier = 6;
      if (P.news && S0.news) {
        const fresh = a => !a.published || NOW - new Date(a.published).getTime() < 2 * 864e5;
        const all = (S0.news.articles || []).filter(HW.readable).filter(fresh); const mineA = all.filter(a => tagged(a)); const arts = (mineA.length >= 3 ? mineA : mineA.concat(all.filter(a => !mineA.includes(a)).slice(0, 3 - mineA.length))).slice(0, 6);
        arts.filter(a => !wireIds.has(String(a.id))).forEach(a => { const r = HW.v5.newsRow(lk, a); const hrefM = /^<a class="row" href="([^"]+)"/.exec(r); const vid = /data-vid="([^"]+)"/.exec(r); const im = /<img[^>]+src="([^"]+)"/.exec(r);
          const tid = (a.categories || []).map(c => c.type === 'team' ? String(c.teamId || (c.team && c.team.id) || '') : '').find(id => id && S0.tIdx[id]); const tm = tid ? S0.tIdx[tid] : null;
          const av = tm ? crest(tm) : `<span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4.5" width="16" height="15" rx="2.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg></span>`;
          const extra = im ? `<span class="fimg"><img src="${im[1]}" alt="" loading="lazy" onerror="this.parentNode.remove()">${vid ? '<i class="play"></i>' : ''}</span>` : '';
          const ts = a.published ? new Date(a.published).getTime() : NOW - 864e5;
          if (vid) post(ts, '', av, esc(tm ? tm.short : L.label), 'Video', esc(a.headline), extra, ` data-act="play" data-vid="${vid[1]}"`);
          else post(ts, hrefM ? hrefM[1] : '', av, esc(tm ? tm.short : L.label), 'News', esc(a.headline), extra); });
      }
      // 0 · breaking, pinned above everything (v391, Ray's pick A)
      tier = 0;
      (S0.wireItems || []).forEach((a, i) => {
        const tid = HW.wireTeams ? HW.wireTeams(a).find(id => S0.tIdx[id]) : null; const tm = tid ? S0.tIdx[tid] : null;
        const av = tm ? crest(tm) : `<span class="fic brk"><i></i></span>`; const ts = a.published ? new Date(a.published).getTime() : NOW;
        posts.push({ tier: 0, k: ts - i, html: `<div class="fp fbrk"><a class="fpa" href="#article/${lk}/${esc(String(a.id))}" aria-label="${esc(a.headline)}"></a><span class="fav">${av}</span><span class="fb"><span class="fh"><span class="fbk"><i></i>Breaking</span>${tm ? `<span>${esc(tm.short)}</span>` : ''}<time>${when(ts)}</time><button class="fx2" data-act="wire-x" data-ids="${esc(String(a.id))}" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span><span class="ft"><b>${esc(a.headline)}</b></span></span></div>` }); });
      posts.sort((a, b) => (a.tier - b.tier) || (b.k - a.k));
      const items = posts.slice(0, 30).map(p => p.html);
      const SHOW = 15;
      if (items.length) secs.feed = `<div class="gl feed${items.length > SHOW ? ' lclip fclip' : ''}">${items.join('')}${items.length > SHOW ? `<button class="cliptog" data-act="clip" data-total="${items.length}" aria-expanded="false">Show ${items.length - SHOW} more</button>` : ''}</div>`;
      else if (!fp.length && !mine.length) delete secs.feed;
      else secs.feed = `<div class="gl"><div class="gr ni"><span class="gm wrap"><b>Quiet for now</b><span>Results, injury changes and news about your teams and players land here as they happen.</span></span></div></div>`;

      // the greeting and the deck
      delete secs.live;
      if (P.brief || P.live) {
        const hr = +new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }).format(new Date()) % 24;
        const hello = hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
        const ord = g => isLive(g) ? 0 : g.state === 'pre' ? 1 : 2;
        let deck = games.filter(g => HW.ymdOf(g.date) === today && isFav(g)).sort((a, b) => ord(a) - ord(b) || new Date(a.date) - new Date(b.date) || rankGame(b) - rankGame(a));
        let nextMode = false;
        if (!deck.length && !offS) { const seen = new Set(); deck = teams.map(t => t.next).filter(g => g && g.state === 'pre' && !seen.has(g.id) && seen.add(g.id)).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 6); nextMode = deck.length > 0; }
        const nLive = deck.filter(isLive).length;
        const sub = offS ? 'The season is over for your teams' : nextMode ? `Nothing tonight · next up ${esc(dayWord(HW.ymdOf(deck[0].date), true).replace('Tonight', 'later'))}` : deck.length ? `${nLive ? `${nLive} live now · ` : ''}${deck.length} game${deck.length === 1 ? '' : 's'} for your teams today${deck.length > 1 ? ' · swipe' : ''}` : (mine.length ? (S0.teams ? 'No games for your teams today' : '') : 'Follow a team to fill this screen');
        const outOf = t => { const b = S0.inj && S0.inj.byTeam[t.id]; const outs = (b && b.list || []).filter(x => /out|suspen/i.test(x.status || '')); const pts = outs.reduce((n, x) => { const e = ctx && ctx.ppg && ctx.ppg[String(x.athlete && x.athlete.displayName || '').toLowerCase()]; return n + (e && isFinite(e.pts) ? +e.pts : 0); }, 0); return { n: outs.length, pts }; };
        const card = (g, i) => {
          const live = isLive(g), done = g.state === 'post' && !g.off, pre = !live && !done;
          const [ca, cb] = pickColors(g);
          const f = !g.off ? safeF(L, g, ctx) : null; const ph = f && Number.isFinite(f.pHome) ? Math.min(.99, Math.max(.01, f.pHome)) : null;
          const hasSc = (live || done) && g.away.score != null && g.home.score != null;
          const share = hasSc ? .5 + Math.max(-.3, Math.min(.3, (+g.home.score - +g.away.score) / 30)) : ph != null ? ph : .5;
          const seam = Math.min(74, Math.max(26, 50 - (share - .5) * 80));
          const k = live ? `<i class="dot"></i>${esc(HW.clockOf(g, L))}` : done ? esc(finalWord(g)) : g.off ? esc(g.off) : `${nextMode || relDay(HW.ymdOf(g.date)) !== 'Tonight' ? esc(dayWord(HW.ymdOf(g.date), true)) + ' · ' : (i === deck.findIndex(x => x.state === 'pre') ? 'Up next · ' : '')}${esc(tipOf(g))}`;
          const tv = tvLabel(g);
          const side = (t, o) => `<span class="dks">${logo(t.logo, '', teamColor(t, L))}<b>${esc(t.abbr || t.short)}</b>${hasSc ? `<em class="sc${+t.score >= +o.score ? '' : ' lo'}">${esc(String(t.score))}</em>` : `<em>${esc(t.rec || '')}</em>`}</span>`;
          const fav = ph != null ? (ph >= .5 ? g.home : g.away) : null;
          const mid = live || done ? (hasSc ? `<span class="dkm"><b>${live ? 'Live' : 'Final'}</b>${(() => { const lead = +g.home.score === +g.away.score ? null : (+g.home.score > +g.away.score ? g.home : g.away); return lead ? `${esc(lead.abbr)} ${live ? 'by' : 'won by'} ${Math.abs(+g.home.score - +g.away.score)}` : 'Level'; })()}</span>` : '') : fav ? `<span class="dkm"><b>${esc(fav.abbr)} ${pct(Math.max(ph, 1 - ph))}</b>to win</span>` : `<span class="dkm"><b>${esc(tipOf(g))}</b></span>`;
          let foot = '';
          if (pre && S0.inj) { const A = outOf(g.away), H = outOf(g.home); const t = A.n > H.n || (A.n === H.n && A.pts > H.pts) ? g.away : g.home; const o = t === g.away ? A : H; if (o.n) foot = `${o.n} ${esc(t.short)} out${o.pts ? ` · ${o.pts.toFixed(1)} ppg sitting` : ''}`; }
          if (!foot && done && f && ph != null) { const pick = ph >= .5 ? g.home : g.away; foot = `RIVL had ${esc(pick.abbr)} ${pct(Math.max(ph, 1 - ph))}`; }
          if (!foot && tv) foot = esc(tv);
          return `<a class="dk${live ? ' live' : ''}" href="${href.game(lk, g.id)}" style="--ca:${esc(deepen(ca))};--cb:${esc(deepen(cb))};--seam:${seam.toFixed(1)}%"><span class="wm a">${esc(g.away.abbr || '')}</span><span class="wm h">${esc(g.home.abbr || '')}</span><span class="dkk">${k}${tv && !pre ? '' : tv && foot !== esc(tv) ? ` · ${esc(tv)}` : ''}</span><span class="dkg">${side(g.away, g.home)}${mid}${side(g.home, g.away)}</span>${foot ? `<span class="dkf">${foot}</span>` : ''}</a>`;
        };
        const dots = deck.length > 1 ? (deck.length <= 8 ? `<div class="dkdots" aria-hidden="true">${deck.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : `<div class="dkdots n" aria-hidden="true"><span>1</span> / ${deck.length}</div>`) : '';
        const skel = '';   // v390: no placeholder card. On a day with no games the grey slab just sat there; the deck appears when there is one to show
        secs.hi = `<div class="hhi"><h1>${hello}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${deck.length ? (() => { const cards = deck.map(card); const loop = cards.length > 1; const cl = h => h.replace('<a class="dk', '<a tabindex="-1" aria-hidden="true" class="dkc dk'); return `<div class="dkw"><div class="dkdeck" data-n="${cards.length}" data-loop="${loop ? 1 : 0}" data-key="${esc(lk + ':' + today)}">${loop ? cl(cards[cards.length - 1]) : ''}${cards.join('')}${loop ? cl(cards[0]) : ''}</div>${dots}</div>`; })() : skel}`;
      } else delete secs.hi;
    };

    // ----- phase 1: one round trip, then paint -----
    let [tIdx, games, last, ctx, st] = await Promise.all([
      teamsIndex(L),
      S.today[lk] && S.today[lk].length ? S.today[lk] : scoreboard(L, today).catch(() => []),
      scoreboard(L, yday, 600000).catch(() => []),
      forecastCtx(L, today).catch(() => null),
      standings(L).catch(() => null)
    ]);
    if (!alive()) return;
    /* out of season the feed answers a date with no games by sending the last games it has (weeks old): only games on the
       day asked for are kept, so last season's final never sits under Tonight or Last night */
    const onDay = (list, d0, d1) => (list || []).filter(g => { const y = HW.ymdOf(g.date); return y >= d0 && y <= d1; });
    games = onDay(games, yday, addDays(today, 1)); last = onDay(last, yday, yday);
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
    if (lk === 'wnba' && HW.hub) later.push((async () => { S0.unr = await unrivaledCard(true).catch(() => ''); if (!alive() || !S0.unr) return; build(); paint(); })());
    if (P.brief && fp.length && !games.length) later.push((async () => { S0.lp = await leaguePlayers(L).catch(() => null); if (!alive()) return; build(); paint(); })());
    if (!S0.inj && mine.length && P.injuries) later.push((async () => { S0.inj = await injuries(L).catch(() => null); if (!alive()) return; build(); paint(); })());
    Promise.all(later).catch(() => { });

    // ----- while the app sits on Home: scores every pass, the rest every few minutes, patched quietly -----
    let quietAt = Date.now();
    HW.v5.refresh = async () => {
      if (!alive()) return;
      S0.games = S.today[lk] ? S.today[lk].filter(g => { const y = HW.ymdOf(g.date); return y >= yday && y <= addDays(today, 1); }) : S0.games;
      const due = Date.now() - quietAt > 180000;
      if (due) {
        quietAt = Date.now();
        try { for (const k of [...HW.cache.keys()]) if (/\/injuries|\/news\?|\/summary\?event=/.test(k) && k.includes(L.path)) HW.cache.delete(k); } catch { }
        const [last2, inj2, news2] = await Promise.all([scoreboard(L, yday, 0).catch(() => null), mine.length && P.injuries ? injuries(L).catch(() => null) : null, P.news || P.wire ? jSoft(`${API(L)}/news?limit=25`, 0) : null]);
        if (!alive()) return;
        if (last2) S0.last = last2.filter(g => HW.ymdOf(g.date) === yday); if (inj2) S0.inj = inj2; if (news2) S0.news = news2;
        if (fp.length) { const ids = [...new Set(fp.map(p => { const is = teamOf(p); const g = S0.last.find(g => isDone(g) && (is(g.home) || is(g.away))); return g ? g.id : null; }).filter(Boolean))]; await Promise.all(ids.map(async id => { const d = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, 0); if (d) S0.sums[id] = d; })); }
        if (!alive()) return;
      }
      build(); paint(true);
    };
    HW.v5.refresh.every = 90000;
  }

  /* ================= SCORES: every game, compact ================= */
  /* Unrivaled, the 3-on-3 league WNBA players play in their offseason: its schedule from data/unrivaled.json, read off
     the league's own site by a job every few hours. Times come in Eastern and show in Central. Teams fill in once the
     league sets the matchups. */
  const unrDays = d => {
    const toYmd = x => { const t = new Date(String(x).replace(/^\w+,\s*/, '') + ' 12:00'); return isNaN(t) ? '' : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
    const days = {}; (d.games || []).forEach(g => { const y = toYmd(g.date); if (!y) return; const k = y + '|' + (g.arena || ''); (days[k] = days[k] || { y, arena: g.arena, city: g.city, games: [] }).games.push(g); });
    return Object.values(days).sort((a, b) => a.y < b.y ? -1 : a.y > b.y ? 1 : 0);
  };
  const unrCT = tm => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(tm || ''); if (!m) return tm || ''; let h = (+m[1] % 12) + (/PM/i.test(m[3]) ? 12 : 0) - 1; if (h < 0) h += 24; return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`; };
  const unrLogo = (d, name) => { const c = (d.clubs || []).find(x => x.name === name); return c && c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ''; };
  async function unrivaledCard() {
    const d = HW.hub ? await HW.hub.file('unrivaled.json').catch(() => null) : null; if (!d || !d.games || !d.games.length) return '';
    const today = todayCT(); const list = unrDays(d); const ahead = list.filter(x => x.y >= today); const nx = ahead[0]; if (!nx) return '';
    const n = Math.round((new Date(nx.y + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 864e5);
    const tv = [...new Set(nx.games.flatMap(g => g.tv || []))];
    const games = nx.games.map(g => `<div class="ung">${g.teams && g.teams.length === 2 ? `<span class="unt">${unrLogo(d, g.teams[0])}<b>${esc(g.teams[0])}</b></span><i>vs</i><span class="unt">${unrLogo(d, g.teams[1])}<b>${esc(g.teams[1])}</b></span>` : '<span class="unt tbd"><b>Teams to be set</b></span>'}<em>${esc(unrCT(g.time))} CT</em></div>`).join('');
    return `<div class="unrv"><div class="brief-h"><b>Unrivaled</b><span>${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`}</span></div><p class="unote">The 3-on-3 league where WNBA stars play in the offseason.</p>`
      + `<div class="unx"><div class="unh"><b>${esc(dayLabel(nx.y, { weekday: 'long', month: 'long', day: 'numeric' }))}</b><span>${esc([nx.arena, nx.city].filter(Boolean).join(' · '))}</span></div>${games}${tv.length ? `<div class="untv">${tv.map(x => `<em>${esc(x)}</em>`).join('')}</div>` : ''}</div>`
      + `<button class="btn ghost unbtn" data-act="scmode" data-mode="unrivaled">See the full schedule · ${ahead.reduce((a, x) => a + x.games.length, 0)} games</button></div>`;
  }
  async function unrivaledList() {
    const d = HW.hub ? await HW.hub.file('unrivaled.json').catch(() => null) : null;
    if (!d || !d.games || !d.games.length) return empty('No Unrivaled schedule yet', '<p style="margin:6px 0 0">It shows here once the league posts it.</p>');
    const today = todayCT(); const list = unrDays(d); const ahead = list.filter(x => x.y >= today), done = list.filter(x => x.y < today).reverse();
    const dayCard = x => `<div class="unx"><div class="unh"><b>${esc(dayLabel(x.y, { weekday: 'short', month: 'short', day: 'numeric' }))}</b><span>${esc([x.arena, x.city].filter(Boolean).join(' · '))}</span></div>${x.games.map(g => `<div class="ung">${g.teams && g.teams.length === 2 ? `<span class="unt">${unrLogo(d, g.teams[0])}<b>${esc(g.teams[0])}</b></span><i>vs</i><span class="unt">${unrLogo(d, g.teams[1])}<b>${esc(g.teams[1])}</b></span>` : '<span class="unt tbd"><b>Teams to be set</b></span>'}<em>${g.score ? `<b>${esc(String(g.score[0]))}-${esc(String(g.score[1]))}</b>` : `${esc(unrCT(g.time))} CT`}</em></div>`).join('')}${(x.games[0] && x.games[0].tv || []).length ? `<div class="untv">${x.games[0].tv.map(t => `<em>${esc(t)}</em>`).join('')}</div>` : ''}</div>`;
    const byMonth = {}; ahead.forEach(x => { const k = dayLabel(x.y, { month: 'long', year: 'numeric' }); (byMonth[k] = byMonth[k] || []).push(x); });
    return `<p class="unote" style="margin-top:4px">The 3-on-3 league where WNBA stars play in the offseason. ${ahead.length ? `${ahead.reduce((a, x) => a + x.games.length, 0)} games to come.` : ''}</p>`
      + Object.entries(byMonth).map(([m, xs]) => sec(m, `${xs.length} game days`) + `<div class="unrv">${xs.map(dayCard).join('')}</div>`).join('')
      + (done.length ? sec('Results', 'newest first') + `<div class="unrv">${done.slice(0, 12).map(dayCard).join('')}</div>` : '');
  }
  async function scores(lk) {
    const L = LEAGUES[lk]; const today = todayCT();
    let ymd = store.get('v5:date', today); if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || Math.abs(new Date(ymd) - new Date(today)) > 200 * 864e5) ymd = today;
    const far = Math.abs(new Date(ymd) - new Date(today)) > 4 * 864e5; const center = far ? ymd : today;
    const mineOnly = !!store.get('v5:scmine', false) && (favs.all()[lk] || []).length > 0;
    /* the day pager (Ray's pick, Calendar A): you are always on one day. Its name is the title; the arrows step a day
       either way; a tap on the title slides up the month, with your teams' days marked, to jump weeks or months ahead. */
    const rel = d => d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : d === addDays(today, -1) ? 'Yesterday' : dayLabel(d, { weekday: 'long' });
    const chevL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></svg>', chevR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6"/></svg>';
    const strip = `<div class="dpg" id="dates"><button class="dpa" data-act="date" data-ymd="${addDays(ymd, -1)}" aria-label="Previous day">${chevL}</button><button class="dpt" data-act="calendar" data-ymd="${esc(ymd)}" aria-haspopup="dialog" aria-label="Pick a day"><b>${esc(rel(ymd))}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg></b><span id="dpsub">${esc(dayLabel(ymd, { weekday: ymd === today || Math.abs(new Date(ymd) - new Date(today)) < 2 * 864e5 ? 'long' : undefined, month: 'long', day: 'numeric', year: ymd.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined }))}</span></button><button class="dpa" data-act="date" data-ymd="${addDays(ymd, 1)}" aria-label="Next day">${chevR}</button></div><div id="phase"></div>`;
    const unrMode = lk === 'wnba' && !!store.get('v5:scunr', false);
    const modes = lk === 'wnba' ? `<div class="chips scmode" role="tablist">${[['wnba', 'WNBA'], ['unrivaled', 'Unrivaled']].map(([k, l]) => `<button class="chip${(k === 'unrivaled') === unrMode ? ' on' : ''}" role="tab" data-act="scmode" data-mode="${k}" aria-pressed="${(k === 'unrivaled') === unrMode}">${l}</button>`).join('')}</div>` : '';
    if (unrMode) { HW.v5.refresh = null; const h = await unrivaledList(); if (store.get('v5:scunr', false)) $main.innerHTML = `<div id="unrpage">${modes}<div class="unrbody">${h}</div></div>`; return; }
    const head = modes + strip;
    /* the page is two parts: the date strip, which only moves its highlight from one day to the next (and is rebuilt when
       the window of days shifts), and the list below it, which swaps. A day change never repaints the strip or the screen. */
    const page0 = $main.querySelector('#scpage');
    const inPlace = page0 && page0.dataset.lk === lk;
    const hashOf = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    const paint = body => {
      if (lk === 'wnba' && store.get('v5:scunr', false)) return;   // switched to Unrivaled while this day was loading
      const page = $main.querySelector('#scpage');
      if (page && page.dataset.lk === lk) {
        const hd = page.querySelector('#schead'); const hh = hashOf(head);
        if (hd.dataset.h !== hh) {
          hd.innerHTML = head;
          hd.dataset.h = hh;
        }
        const bd = page.querySelector('#scbody'); const bh = hashOf(body); if (bd.dataset.h !== bh) { const dayChanged = bd.dataset.d !== ymd; bd.innerHTML = body; bd.dataset.h = bh; bd.dataset.d = ymd; if (dayChanged && HW.v5.soft) HW.v5.soft(bd); }
        if (HW.v5.busy) HW.v5.busy(false);
      } else $main.innerHTML = `<div id="scpage" data-lk="${lk}"><div id="schead" data-h="${hashOf(head)}">${head}</div><div id="scbody">${body}</div></div>`;
    };
    if (inPlace) { paint($main.querySelector("#scbody").innerHTML); if (HW.v5.busy) HW.v5.busy(true); } else $main.innerHTML = `<div id="scpage" data-lk="${lk}"><div id="schead" data-h="${hashOf(head)}">${head}</div><div id="scbody">${skeleton(4, 'card')}</div></div>`;
    const [games, ctx, meta] = await Promise.all([ymd === today && S.today[lk] && S.today[lk].length ? S.today[lk] : scoreboard(L, ymd).catch(() => null), forecastCtx(L, ymd).catch(() => null), sbMeta(L, ymd)]);
    if (ymd === today && games) S.today[lk] = games;
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
    // the slate: anything live first, then your teams' games, then the rest of the league (by tip time, finals after)
    const sub = $main.querySelector('#dpsub'); if (sub && !/games?$/.test(sub.textContent)) sub.textContent += ` · ${games.length} game${games.length === 1 ? '' : 's'}`;
    const tOrd = g => (g.state === 'post' || g.off ? 1 : 0);
    const byTip = (a, b) => tOrd(a) - tOrd(b) || new Date(a.date) - new Date(b.date) || rankGame(b) - rankGame(a);
    const live = games.filter(g => isLive(g) && !g.off).sort((a, b) => rankGame(b) - rankGame(a));
    const mineG = games.filter(g => !live.includes(g) && isFav(g)).sort(byTip);
    const rest = games.filter(g => !live.includes(g) && !mineG.includes(g)).sort(byTip);
    const row = g => g.tbd ? `<div class="games">${gameCard(L, g, ctx, false, true)}</div>` : scoreRow(L, g, ctx);
    const block = (title, list, n = 6) => list.length ? `<div class="dpsec"><b>${title}</b><span>${list.length}</span></div>` + clip(list.map(row), 'srows', n, 'games') : '';
    paint(phase + block('<i class="dot"></i>Live now', live, 8) + block('Your teams', mineG, 8) + block(mineG.length || live.length ? 'Around the league' : 'All games', rest, mineG.length ? 5 : 8));
    setPhase();
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
    /* the head (option A): a band in the team's colour with soft diagonal stripes, glass back, follow and share buttons,
       the player cut out on the right standing on the band's bottom edge, and on the left the team, number and position
       over the name, large */
    let dkc = BAD(color) ? '#2A2D33' : color; for (let k = 0; k < 8 && lumOf(dkc) > .2; k++) dkc = mixTo(dkc, 0, .2);
    const starOn = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`, starOff = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>`;
    const posWordP = a.position && (a.position.displayName || a.position.abbreviation) || '';
    const pband = `<header class="tband pband" style="--a:${esc(BAD(color) ? '#3A3D44' : color)};--ad:${esc(dkc)}"><div class="tbtop"><a class="tbib" href="#home" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a>`
      + `<div class="tbcap"><button class="star tbb${following ? ' on' : ''}" data-act="follow-player" data-snap='${esc(JSON.stringify(snap))}' aria-pressed="${following}" aria-label="${following ? 'Unfollow' : 'Follow'} ${esc(a.displayName || '')}">${following ? starOn : starOff}</button><button class="tbb" data-act="share" data-title="${esc(a.displayName || '')}" aria-label="Share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></button></div></div>`
      + `${a.headshot && a.headshot.href ? `<img class="pbshot" src="${esc(a.headshot.href)}" alt="" ${hide}>` : ''}`
      + `<div class="pbtx">${tm.id ? `<a class="pbteam" href="${href.team(lk, tm.id)}">${tlogo ? `<img src="${esc(tlogo)}" alt="" ${hide}>` : ''}<span>${esc([tm.shortDisplayName || tm.name || '', a.jersey ? `#${a.jersey}` : '', posWordP].filter(Boolean).join(' · '))}</span></a>` : `<span class="pbteam"><span>${esc([a.jersey ? `#${a.jersey}` : '', posWordP].filter(Boolean).join(' · '))}</span></span>`}<h1>${esc(a.firstName || '')}<br>${esc(a.lastName || a.displayName || '')}</h1></div></header><div class="lb-slot"></div>`;
    const vit = [[a.jersey ? `#${a.jersey}` : '', 'Jersey'], [a.position && a.position.abbreviation, 'Position'], [a.displayHeight ? a.displayHeight.replace(/\s/g, '') : '', 'Height'], [a.displayWeight, 'Weight'], [college ? classWord : (a.age ? String(a.age) : ''), college ? 'Class' : 'Age'], [tm.abbreviation, 'Team', tm.id ? href.team(lk, tm.id) : '']].filter(([v]) => v);
    const vitals = vit.length ? `<section class="card pvit">${vit.map(([v, l, h]) => h ? `<a href="${h}"><b>${esc(v)}</b><span class="lnk">${esc(l)} ›</span></a>` : `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</section>` : '';
    let injStrip = '';
    if (injury) {
      S.injuries = S.injuries || {}; const key = `p:${id}:${injury.id || 0}`; S.injuries[key] = { x: { ...injury, athlete: { id: String(id), displayName: a.displayName, headshot: a.headshot && a.headshot.href, position: a.position } }, id: String(id), team: { id: tm.id, short: tm.shortDisplayName || tm.name || '', color } };
      const st0 = injury.status || ''; const cls = /out/i.test(st0) ? 'out' : /day|quest|doubt/i.test(st0) ? 'q' : 'ok'; const det = injury.details || {}; const ret = retInfo(L, det.returnDate);
      injStrip = `<button class="injstrip ${cls}" data-act="injury" data-key="${esc(key)}"><span class="tag ${cls}">${esc(tagWord(st0))}</span><span class="t"><b>${esc(det.type || det.detail || 'Injury')}${det.detail && det.detail !== det.type ? `, ${esc(det.detail.toLowerCase())}` : ''}</b><span>${ret ? (ret.far ? 'No return date this season' : `Expected back around ${esc(ret.long)}`) : esc((injury.shortComment || injury.longComment || 'Tap for the note').slice(0, 70))}</span></span>${chev}</button>`;
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
    /* how a number breaks down, as one line: the total large, a bar split into its parts in tints of the team's colour,
       then each part with its share */
    const ring = (segs, center, label, title) => {
      const live = segs.filter(x => x.v > 0); const total = live.reduce((a, x) => a + x.v, 0);
      return `<div class="lbar" style="${toneVars}" role="img" aria-label="${esc(`${center} ${title}`)}"><div class="lbh"><b>${esc(center)}</b><span>${esc(label)}</span></div>`
        + `<div class="lbt">${live.map(x => `<i style="flex:${(x.v / total).toFixed(4)};background:${x.c}"></i>`).join('')}</div>`
        + `<div class="lbk">${segs.map(x => `<div><i style="background:${x.c}"></i><span>${esc(x.l)}</span><b>${x.v == null ? '—' : x.v.toFixed(1)}</b><em>${total && x.v > 0 ? Math.round(x.v / total * 100) + '%' : ''}</em></div>`).join('')}</div></div>`;
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
      ${''/* v380: the numbers alone, as a hairline grid; the category switch and the split bar are gone */}
      ${grid.length ? `<div class="sgrid">${grid.map(x => `<div><b>${esc(fmt(x.v, x.k))}</b><span>${esc(x.l)}</span></div>`).join('')}</div>` : ''}
      <div class="card-f"><button data-act="ptab" data-tab="stats">All stats, game log and career</button></div></section>` : '';

    // next game for the team
    let next = '';
    if (tm.id) { const t = await teamInfo(L, tm.id); if (t && t.next) { const ctx = await forecastCtx(L, todayCT()).catch(() => null); next = sec(isLive(t.next) ? 'Live now' : 'Next up') + duelBlock(L, t.next, ctx); } }

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
    const fullLog = evRows.length ? sec('Game log', `${evRows.length} games`) + `<div class="tw"><table class="tbl"><thead><tr><th>Game</th>${gLabels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody class="${evRows.length > 5 ? 'lclip' : ''}">${evRows.map(r => { const m = r.meta; const op = m.opponent || {}; return `<tr class="click" data-href="${href.game(lk, r.id)}"><td><span class="opp"><em>${esc(dateShort(m.gameDate))}</em>${esc(m.atVs || '')} ${esc(op.abbreviation || '')} <span class="res ${m.gameResult === 'W' ? 'w' : 'l'}">${esc(m.gameResult || '')}</span></span></td>${r.stats.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>${evRows.length > 5 ? `<button class="cliptog" data-act="clip" data-total="${evRows.length}" aria-expanded="false">Show all ${evRows.length} games</button>` : ''}` : '';
    const injT = injury ? (() => { const det = injury.details || {}; const ret = retInfo(L, det.returnDate); const what = [det.type, det.detail && det.detail !== det.type ? det.detail : '', det.side && det.side !== 'Not Specified' ? det.side.toLowerCase() : '', det.location && det.location !== det.type ? det.location : ''].filter(Boolean).join(', '); return `<table class="tbl kv"><tbody><tr><td>Status</td><td><span class="tag ${/out/i.test(injury.status) ? 'out' : 'q'}">${esc(tagWord(injury.status))}</span></td></tr>${what ? `<tr><td>Injury</td><td>${esc(what)}</td></tr>` : ''}${injury.date ? `<tr><td>Reported</td><td>${esc(new Date(injury.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: HW.TZ }))}</td></tr>` : ''}${ret ? `<tr><td>Expected back</td><td>${esc(ret.long)}</td></tr>` : ''}${injury.longComment || injury.shortComment ? `<tr class="note"><td colspan="2">${esc(injury.longComment || injury.shortComment)}</td></tr>` : ''}</tbody></table>`; })() : '';
    // the details as one grouped list (Apple profile): size, age or class, experience, where from, the team
    const detRows = [[a.displayHeight || a.displayWeight ? 'Height · Weight' : '', [a.displayHeight, a.displayWeight].filter(Boolean).join(' · ')], [college ? 'Class' : 'Age', college ? classWord : (a.age ? String(a.age) : '')], ['Experience', seasons], ['From', [hometown, country && !hometown.includes(country) ? country : ''].filter(Boolean).join(', ')], [!college && a.college && a.college.name ? 'College' : '', !college && a.college && a.college.name || '']].filter(([k, v]) => k && v);
    const details = detRows.length || tm.id ? `<h3 class="aph3">Details</h3><div class="agl">${detRows.map(([k, v]) => `<div class="aglr"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}${tm.id ? `<a class="aglr" href="${href.team(lk, tm.id)}"><span>Team</span><b>${tlogo ? `<img class="agll" src="${esc(tlogo)}" alt="" ${hide}>` : ''}${esc(tm.displayName || tm.shortDisplayName || tm.name || '')} ›</b></a>` : ''}</div>` : '';
    const panels = {
      summary: injStrip + (L.sport === 'basketball' && HW.rating ? `<div class="prate2" data-pid="${esc(String(id))}" style="${tcv(color)}"></div>` : '') + avgCard + next + log + details + moments,
      stats: (splitsT + cutsT + (evRows.length && L.sport === 'basketball' ? sec('Shot chart', `last ${Math.min(5, evRows.length)} game${Math.min(5, evRows.length) === 1 ? '' : 's'}`) + `<div class="pshots"><div class="rows"><button class="row" data-act="pshots" data-lk="${lk}" data-pid="${esc(String(id))}" data-name="${esc(a.displayName || '')}" data-color="${esc(color)}" data-games="${esc(evRows.slice(0, 5).map(r => r.id).join(','))}"><span class="t"><b>Show the shot chart</b><span class="wrap">Every attempt from the last ${Math.min(5, evRows.length)} games, on the court</span></span>${chev}</button></div></div>` : '') + fullLog + careerT) || empty('No stats yet', '<p style="margin:6px 0 0">Stats start with the first game of the season.</p>'),
      bio: (injury ? sec('Injury') + injT : '') + (aboutT || sec('About') + empty('Nothing on file', '<p style="margin:6px 0 0">The feed has no bio for this player yet.</p>')),
      news: (moments + (stories.length ? sec('Stories') + `<div class="rows">${stories.map(n => HW.v5.newsRow(lk, n)).join('')}</div>` : '')) || empty('Nothing recent', '<p style="margin:6px 0 0">No stories or clips on this player in the feed right now.</p>')
    };
    const ptab = 'summary';   // every player opens on Overview
    const ptabs = `<div class="chips ptabs" role="tablist" style="padding-top:14px">${[['summary', 'Overview'], ['stats', 'Stats'], ['bio', 'Bio'], ['news', 'News']].map(([k, l]) => `<button class="chip${k === ptab ? ' on' : ''}" role="tab" data-act="ptab" data-tab="${k}" aria-selected="${k === ptab}" aria-pressed="${k === ptab}">${l}</button>`).join('')}</div>`;
    const pSub = `${tm.id ? `<a href="${href.team(lk, tm.id)}">${esc(tm.shortDisplayName || tm.name || '')}</a>` : ''}${[a.jersey ? `#${a.jersey}` : '', posWordP].filter(Boolean).map(x => ` · ${esc(x)}`).join('')}`.replace(/^ · /, '');
    const pHead = apHead({ color, name: a.displayName || '', sub: pSub, img: a.headshot && a.headshot.href, face: true, back: '#home', star: { on: following, attrs: `data-act="follow-player" data-snap='${esc(JSON.stringify(snap))}'` }, share: a.displayName || '', badge: L.sport === 'basketball' && HW.rating ? `<span class="aprt" data-pid="${esc(String(id))}"></span>` : '' });
    $main.innerHTML = `<div class="approf">` + pHead + `<div class="lb-slot"></div><div class="aptabs">${ptabs}</div><div class="pgstrip">` + Object.entries(panels).map(([k, html]) => `<div data-ptab-panel="${k}" data-pg="${k}"${k === ptab ? '' : ' hidden'}>${html}</div>`).join('') + `</div></div>`;
    if (HW.v5._ptabL) $main.removeEventListener('click', HW.v5._ptabL);
    HW.v5._ptabL = e => { const b = e.target.closest('[data-act="ptab"]'); if (!b) return; e.preventDefault(); const k = b.dataset.tab; if (HW.v5._pg && $main.querySelector('.pgr')) { HW.v5._pg.go(k); const tb = $main.querySelector('.aptabs'); if (tb && !b.closest('.aptabs')) window.scrollTo({ top: Math.max(0, window.scrollY + tb.getBoundingClientRect().top - 56), behavior: 'smooth' }); return; } $main.querySelectorAll('[data-act="ptab"]').forEach(x => { const on = x.dataset.tab === k; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-selected', String(on)); }); $main.querySelectorAll('[data-ptab-panel]').forEach(p => { const on = p.dataset.ptabPanel === k; if (on && p.hidden && HW.v5.soft) { p.hidden = false; HW.v5.soft(p); } else p.hidden = !on; }); const tb = $main.querySelector('.aptabs'); if (tb) { const y = tb.getBoundingClientRect().top; if (y < 60 || !b.closest('.aptabs')) window.scrollTo(0, Math.max(0, window.scrollY + y - 56)); } };
    $main.addEventListener('click', HW.v5._ptabL);
    { const tb = $main.querySelector('.aptabs'), sp = $main.querySelector('.pgstrip'); const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--apb')) || 56; HW.v5._pg = pager(tb, { tabs: tb, strip: sp, start: ptab, stickTop: bar, onShow: k => store.set('v5:ptab', k) }); }
    document.title = `${a.displayName} · RIVL`;
    /* the RIVL rating: one number on the 40-99 scale with a line on what stands out, then the six traits as bars, each the
       share of players at his position he beats; a tap on a trait opens the numbers behind it */
    if (L.sport === 'basketball' && HW.rating) {
      const fill = R => { const bd = R && $main.querySelector(`.aprt[data-pid="${CSS.escape(String(id))}"]`); if (bd && bd.textContent !== String(R.ovr)) { bd.textContent = R.ovr; bd.className = `aprt on ${R.ovr >= 90 ? 't5' : R.ovr >= 80 ? 't4' : R.ovr >= 70 ? 't3' : R.ovr >= 60 ? 't2' : 't1'}`; bd.title = 'RIVL rating'; }
        const el = $main.querySelector(`.prate2[data-pid="${CSS.escape(String(id))}"]`); if (!el || !R) return; const key = String(R.ovr) + R.traits.map(t => t.pct).join(); if (el.dataset.k === key) return; el.dataset.k = key;
        const tier = o => o >= 90 ? 't5' : o >= 80 ? 't4' : o >= 70 ? 't3' : o >= 60 ? 't2' : 't1'; const g = R.raw || {};
        const season = R.season ? String(R.season).replace(/ Regular Season$/i, '') : seasonName.replace(/ Regular Season$/i, '');
        el.innerHTML = `<section class="card prc"><div class="prh"><span class="prl">${esc(L.short || L.label)}</span><b>${esc(season || 'This season')}</b></div>`
          + `<div class="prrow"><div><b>${esc(String(g.gp ?? '—'))}</b><span>Games</span></div><div><b>${g.pts != null ? (Math.round(g.pts * 10) / 10).toFixed(1) : '—'}</b><span>Points</span></div><div><b class="rtb ${tier(R.ovr)}">${R.ovr}</b><span>RIVL rating</span></div></div>`
          + `<p class="prs">${esc(HW.rating.summary(R))}</p>${R.early ? `<p class="prn">Early estimate: ${Math.round(R.sample)} minutes so far, so it leans on what a typical player at his position does until he plays more.</p>` : ''}</section>`
          + `<section class="card prt"><div class="prh"><b>Player traits</b><span>Compared to other ${esc(R.posWord)}</span></div>${R.traits.map(t => `<details class="trt"><summary><span class="trl">${esc(t.label)}</span><span class="trb"><i style="width:${t.pct}%"></i></span><b>${t.pct}</b></summary><p>${esc(HW.rating.detail(R, t.key))}</p></details>`).join('')}<p class="prn">Built only from the box score. Tap a trait for the numbers behind it.</p></section>`; };
      const R0 = HW.rating.cached && HW.rating.cached(L, id); if (R0) fill(R0);
      HW.rating.get(L, id).then(fill).catch(() => {});
    }
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
    const team = { id, short: t.shortDisplayName || tt.short || t.name || '', name: t.displayName || tt.name || '', color, alt: t.alternateColor ? hx(t.alternateColor) : (tt.alt || ''), abbr, logo: tt.logo || (t.logos && t.logos[0] && t.logos[0].href) || '' };
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
  /* Folding a roster moves everything under it. Left to itself the browser repaints every card below on every frame of the
     slide, and the textured plate of the folding card is re-blended at every new height — the hitch Ray saw. So the
     list is marked `folding` from the moment the band is pressed: that promotes the cards to their own layers before the
     slide starts, and the slide then only moves layers. The mark comes off once the fold has settled. */
  /* v113: no layer promotion for the slide after all. Lifting every card below onto its own layer measured well in software
     rendering, but on the phone the GPU had to raster those layers as the slide began and the tiles it hadn't finished showed
     as the page's white — the flash Ray saw. The slide now stays on the ordinary paint path and the paint is kept cheap
     instead: no grain on anything that moves (the bands, the roster block), layout contained to each card. */
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
    return `<div class="row prow" style="${tcv(pc)}"><a class="go" href="${href.player(p.lk, p.id)}" aria-label="${esc(p.name)}">${rk}${headshot(p.img, pc, 46, p.name)}</a><a class="t" href="${href.player(p.lk, p.id)}"><b>${esc(p.name)}</b><span>${esc(sub || '')}</span></a>${right}<button class="star${on ? ' on' : ''}" data-act="follow-player" data-snap='${esc(JSON.stringify(snap))}' aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(p.name)}">${on ? starSvg : starLine}</button></div>`;
  }
  /* the band's second line and the faces of the picked: the players a person chose stay visible when the roster is folded */
  const bandLine = (n, picked) => picked ? `<em>${picked} of ${n} picked</em>` : `${n} player${n === 1 ? '' : 's'}`;
  const faces = picked => { const show = picked.slice(0, 3); return show.length ? `<span class="faces" aria-hidden="true">${show.map(p => `<i><b>${esc(initials(p.short || p.name))}</b>${p.img ? imgSized(p.img, 80, 58, '', "this.remove()") : ''}</i>`).join('')}${picked.length > 3 ? `<u>+${picked.length - 3}</u>` : ''}</span>` : ''; };
  const lastName = n => { const w = String(n || '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '').trim().split(/\s+/); return w[w.length - 1] || ''; };
  async function playerPicker(el, L, { following = false, leaders = true, select = false } = {}) {
    const lk = L.key, pro = !/^ncaa/.test(lk);
    el.classList.add('pp');
    el.innerHTML = `<div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input type="search" placeholder="Search players or teams" autocomplete="off" aria-label="Search players"></div><div class="pp-list">${skeleton(6, 'row')}</div>`;
    const inp = el.querySelector('input'), list = el.querySelector('.pp-list');
    const idx = await teamsIndex(L); const pal = distinctPalette(L, idx);
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
      if (!q && lp && lp.stale && lp.label) parts.push(`<div class="legend lastyear"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><div><b>Last season's numbers</b><span>The new season hasn't started, so these are <em>${esc(lp.label)}</em> averages. Anyone drafted or transferred since is listed with the team they played for then.</span></div></div>`);
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
        parts.push(`<section class="tgrp" style="${tcv(pal[s.key] || teamColor(s.team, L), teamAlt(s.team, L))}"><button class="thead pp-team" data-pp="fold" data-id="${esc(s.key)}" aria-expanded="${!folded}">${logo(s.team.logo, 's')}<span class="tt"><b>${esc(s.team.short)}</b><small>${bandLine(rows.length, picked)}</small></span>${faces(rows.filter(p => fset.has(p.id)))}${chev}</button>${foldWrap(`<div class="rows">${rows.map(p => rowOf(p, s)).join('')}</div>`, folded)}</section>`);
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
      const fs = new Set(fplayers.all().filter(p => p.lk === lk).map(p => p.id)); el.querySelectorAll('.thead.pp-team').forEach(h => { const body = h.nextElementSibling; const all = body ? [...body.querySelectorAll('[data-act="follow-player"]')] : []; const picked = all.map(b => { try { return JSON.parse(b.dataset.snap); } catch { return null; } }).filter(x => x && fs.has(String(x.id))); const sm = h.querySelector('.tt small'); if (sm) sm.innerHTML = bandLine(all.length, picked.length); const old = h.querySelector('.faces'); const fresh = faces(picked); if (old) old.remove(); if (fresh) h.querySelector('.chev').insertAdjacentHTML('beforebegin', fresh); }); const fset = new Set(fplayers.all().filter(p => p.lk === lk).map(p => p.id)); el.querySelectorAll('[data-act="follow-player"]').forEach(b => { let id = ''; try { id = JSON.parse(b.dataset.snap).id; } catch { } const on = fset.has(String(id)), was = b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); const st = b.classList.contains('star') ? b : b.querySelector('.star'); if (st) { st.classList.toggle('on', on); st.innerHTML = on ? starSvg : starLine; if (on && !was) { st.classList.add('pop'); setTimeout(() => st.classList.remove('pop'), 450); } } }); if (following && !inp.value) paint(); };
    document.addEventListener('rivl:follow', sync);
  }
  async function players(lk) {
    const L = LEAGUES[lk];
    $main.innerHTML = `<div class="page-h"><h1>Players</h1><p>From the teams you follow. Search any team to see its roster.</p></div><div id="ppick"></div>`;
    await playerPicker($main.querySelector('#ppick'), L, { following: true, leaders: true });
  }

  /* ===== the Apple profile (v379, Ray's pick) — one head for team and player pages =====
     A band of the team's colour with a soft light wash, glass Back, Follow and Share; the crest (or the player's face)
     beside the name and one line under it. Scrolled past, a slim bar of the same colour slides in at the top with the
     name, and the tabs (plain words, underlined) stay pinned beneath it. */
  const apIcons = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    starOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>',
    starOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>'
  };
  function apHead({ color, name, sub, img, face = false, back = '#home', star, share, badge = '', kicker = '' }) {
    const c = BAD(color) ? '#3A3D44' : color; let d = c; for (let k = 0; k < 8 && lumOf(d) > .22; k++) d = mixTo(d, 0, .18);
    const pic = img ? (face ? `<span class="apface"><img src="${esc(img)}" alt="" loading="eager" onerror="this.remove()"></span>` : `<span class="apcrest">${imgSized(img, 160, 160, 'alt=""')}</span>`) : '';
    const starB = star ? `<button class="apb star${star.on ? ' on' : ''}" ${star.attrs} aria-pressed="${star.on}" aria-label="${star.on ? 'Unfollow' : 'Follow'}">${star.on ? apIcons.starOn : apIcons.starOff}</button>` : '';
    const shareB = share ? `<button class="apb" data-act="share" data-title="${esc(share)}" aria-label="Share">${apIcons.share}</button>` : '';
    return `<header class="aph" style="--a:${esc(c)};--ad:${esc(d)}"><div class="aptop"><a class="apb" href="${back}" data-act="back" aria-label="Back">${apIcons.back}</a><span class="apsp"></span>${starB}${shareB}</div>`
      + `<div class="apid">${pic}<div class="apnm">${kicker ? `<em>${kicker}</em>` : ''}<h1 class="${String(name).length > 16 ? 'long' : ''}">${esc(name)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${badge}</div></header>`
      + `<div class="apfx" style="--a:${esc(c)};--ad:${esc(d)}" aria-hidden="true"><a class="apb" href="${back}" data-act="back" aria-label="Back" tabindex="-1">${apIcons.back}</a>${img ? (face ? `<span class="apface s"><img src="${esc(img)}" alt="" onerror="this.remove()"></span>` : `<span class="apcrest s">${imgSized(img, 64, 64, 'alt=""')}</span>`) : ''}<b>${esc(name)}</b><span class="apsp"></span>${starB.replace('class="apb', 'class="apb sm').replace(/aria-label="[^"]*"/, 'tabindex="-1" aria-hidden="true"')}</div>`;
  }
  // the slim bar shows once the head has scrolled away
  { let raf = 0; const run = () => { raf = 0; const h = document.querySelector('#main .aph'), fx = document.querySelector('#main .apfx'); if (!h || !fx) return; const on = h.getBoundingClientRect().bottom < 64; if (fx.classList.contains('on') !== on) fx.classList.toggle('on', on); };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(run); }, { passive: true }); document.addEventListener('rivl:rendered', run); }
  HW.v5 = Object.assign(HW.v5 || {}, { initDecks, unrivaledCard, unrivaledList, home, scores, todayPill, player, players, playerPicker, rosterOf, monthGames, lastName, fplayers, prefs, teamInfo, teamsIndex, gameCard, heroCard,
    _: { pager, duelPair, panelLogo, nearPanel, duelCard, duelBlock, deepen, h: H, logo, headshot, chev, sec, empty, skeleton, href, safeF, gameCard, heroCard, teamInfo, teamsIndex, fplayers, prefs, starSvg, starLine, tvLabel, teamColor, teamAlt, playerColor, tcv, distinctPalette, tint, V_lift, V_deep, V_panel, V_vivid, pairColors, dragOrder, orderTools, foldToggle, learn, statusWord, seriesLine, seriesShort, seriesPick, seriesPickText, confName, dayUTC, athId, hsUrl, initials, retInfo, scVars, scoreColor, lift: V_lift, deep: V_deep, sized, imgSized, tagWord, scoreRow, mixTo, lumOf, rgbDist, clip, injRow, apHead, apIcons } });
})();
