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
  /* v402: a thin light edge on a logo when its colour is the panel's own (TCU purple on TCU purple) */
  const panelLogo = (src, px, extra = '') => imgSized(src, px, px, extra);   // v403: the team's own logo; ESPN's dark-ground versions are often plain white
  const nearPanel = (t, panel, L) => rgbDist(teamColor(t, L), panel) < 120;
  // `extra` is written before loading="lazy" so a caller can pass loading="eager": with a duplicate attribute the first wins
  const imgSized = (src, w, h, extra = '', then = "this.style.visibility='hidden'") => { const u = sized(src, w, h); return `<img src="${esc(u)}"${u !== src ? ` data-o="${esc(src)}"` : ''} alt="" ${extra} loading="lazy" ${fallback(then)}>`; };
  /* a logo disc; with a team colour it takes a tint and a ring in that colour */
  const LOGO_PX = { s: 96, m: 128, '': 128, l: 192, hero: 256 };
  /* v405: a team with no logo (or one that fails to load) gets its letters in a plain disc instead of a hole; a logo
     drawn in a very dark colour gets a thin light edge on the dark theme so it doesn't sink into the background */
  const monoOf = a => { const t = String(a || '').slice(0, 4); return `<i class="smono${t.length > 3 ? ' l4' : ''}">${esc(t)}</i>`; };
  const monoSwap = a => { const t = String(a || '').replace(/[^A-Za-z0-9&]/g, '').slice(0, 4); return `var i=document.createElement('i');i.className='smono${t.length > 3 ? ' l4' : ''}';i.textContent='${esc(t)}';this.replaceWith(i)`; };
  const lowC = c => !BAD(c) && lumOf(hx(c)) < .13;
  const logo = (src, size = '', color = '') => { const c = BAD(color) ? '' : hx(color); const px = LOGO_PX[size] || 128; return `<span class="logo ${size === 'hero' ? '' : size}${c ? ' tint' : ''}${c && lowC(c) ? ' lowc' : ''}"${c ? ` style="${tcv(c)}"` : ''}>${imgSized(src, px, px)}</span>`; };
  /* a player's id from whatever the feed gave us: the id field, the uid, the headshot file name or a link */
  const athId = a => { if (!a) return ''; if (a.id != null && a.id !== '') return String(a.id); let m = String(a.uid || '').match(/~a:(\d+)/); if (m) return m[1]; const hs = typeof a.headshot === 'string' ? a.headshot : a.headshot && a.headshot.href || ''; m = hs.match(/\/(\d+)\.png/); if (m) return m[1]; m = (a.links || []).map(l => l && l.href || '').join(' ').match(/\/id\/(\d+)/); return m ? m[1] : ''; };
  /* v436: ESPN's headshot for a player id, for posts that only have the id (a player just off the report) */
  const idHs = (L, id) => id && L && L.path ? `https://a.espncdn.com/i/headshots/${L.path.split('/').pop()}/players/full/${id}.png` : '';
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
  const confName = (name, abbr) => { const n = String(name || ''); let m = n.match(/^(East|West)(ern)? Conference$/i); if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(); m = n.match(/^(\w+) Division$/i); if (m) return m[1]; if (/ Conference$/i.test(n)) { const base = n.replace(/ Conference$/i, ''); return CONF_SHORT[base] || base; } if (CONF_SHORT[n]) return CONF_SHORT[n]; if (abbr && String(abbr).length > 3 && String(abbr) === String(abbr).toUpperCase()) return String(abbr); return n || String(abbr || ''); };   // v418: ESPN's lowercase shorthand ('summ') never shows
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
  /* v438: the Rail. One game is three columns: where it stands on the left (the quarter and clock in red, the tip
     time, or Final), the two teams stacked in the middle with their crests and full names, and the scores on the right.
     Before tip the favourite carries a small chance chip on its own line and the bell sits where the scores will be.
     A final dims the loser and points a small arrow at the winner's score. */
  function scoreRow(L, g, ctx) {
    scoreRow.ctx = scoreRow.ctx || {}; if (ctx) scoreRow.ctx[L.key] = ctx; else ctx = scoreRow.ctx[L.key] || null;
    const live = g.state === 'in', fin = g.state === 'post' && !g.off, pre = !live && !fin;
    const a = +g.away.score, h = +g.home.score, has = (live || fin) && g.away.score != null && g.home.score != null;
    const stale = pre && !g.off && g.timeValid !== false && g.date && Date.now() - new Date(g.date).getTime() > 15 * 60000 && Date.now() - new Date(g.date).getTime() < 5 * 3600000;
    const f = pre && !g.off && !stale && prefs.get('forecast') ? safeF(L, g, ctx) : null;
    const fav = f && Number.isFinite(f.pHome) ? (f.pHome >= .5 ? 'home' : 'away') : null; const fp = fav ? pct(Math.max(f.pHome, 1 - f.pHome)) : '';
    const tipT = String(tipOf(g)).replace(/\s+(CT|ET|PT|MT|CST|CDT|EST|EDT|PST|PDT|MST|MDT)$/, '');
    const canBell = pre && !stale && !g.off && g.timeValid !== false && g.date && new Date(g.date).getTime() > Date.now() && !g.away.tbd && !g.home.tbd;
    const bset = canBell && HW.alerts ? HW.alerts.get(g.id) : null;
    const bell = canBell ? `<button class="sbell${bset != null ? ' on' : ''}" data-act="bell" data-lk="${esc(L.key)}" data-gid="${esc(g.id)}" data-t="${esc(g.date)}" data-ttl="${esc(`${g.away.short || g.away.abbr || ''} at ${g.home.short || g.home.abbr || ''}`)}" data-loc="${esc([g.venue, g.city].filter(Boolean).join(', '))}" data-tv="${esc(tvLabel(g))}" aria-label="${bset != null ? 'Reminder set' : 'Remind me'}"><svg viewBox="0 0 24 24" fill="${bset != null ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/></svg></button>` : '';
    // the left column
    let c1 = '', c2 = '', lvC = false;
    if (g.off) { c1 = g.off; }
    else if (live) { lvC = true; const ck = HW.clockOf(g, L); const m = /^(.*\S)\s+(\d{1,2}:\d{2}(?:\.\d)?|\d{1,2}\.\d)$/.exec(ck); if (/^halftime$/i.test(ck)) c1 = 'Half'; else if (/^end of /i.test(ck)) { c1 = 'End'; c2 = ck.replace(/^end of /i, ''); } else if (m) { c1 = m[1]; c2 = m[2]; } else c1 = ck; }
    else if (fin) { const fw = finalWord(g); const m = /^Final\W*(.+)$/i.exec(fw); if (m) { c1 = 'Final'; c2 = m[1]; } else c1 = fw; }
    else if (stale) { c1 = 'Under way'; c2 = 'No score'; }
    else { const m = /^(\d{1,2}:\d{2})\s*([AP]M)$/i.exec(tipT); if (m) { c1 = m[1]; c2 = m[2].toUpperCase(); } else c1 = tipT || 'TBD'; }
    const star = `<i class="sstar" aria-label="Following"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg></i>`;
    const loA = fin && has && a < h, loH = fin && has && h < a;
    // v445 (Ray's pick, Score first): the points lead each team line, right beside the clock
    const line = (t, side, lo, won) => `<span class="rr${lo ? ' lo' : ''}">${has ? `<b class="rsc">${esc(String(t.score))}</b>` : ''}<span class="scr${lowC(teamColor(t, L)) ? ' lowc' : ''}">${t.logo ? imgSized(t.logo, 72, 72, 'alt=""', monoSwap(t.abbr)) : monoOf(t.abbr)}</span><b class="rn">${esc(t.short || t.abbr || '')}</b>${HW.favs.has(L.key, t.id) ? star : ''}${fav === side ? `<em class="rfv" title="RIVL's chance to win">${esc(fp)}</em>` : ''}${won ? '<svg class="rw" viewBox="0 0 8 12" aria-label="Won"><path d="M8 0v12L1.5 6z"/></svg>' : ''}</span>`;
    const arrow = '<svg class="rw" viewBox="0 0 8 12" aria-label="Won"><path d="M8 0v12L1.5 6z"/></svg>';
    const num = (t, lo, won) => `<b class="rsc${lo ? ' lo' : ''}">${esc(String(t.score))}${won ? arrow : ''}</b>`;
    const right = has ? '<span class="rs"></span>' : canBell ? `<span class="rs rb">${bell}</span>` : '<span class="rs"></span>';
    const key = [g.state, g.away.score, g.home.score, g.detail, g.off || '', bset == null ? '' : bset].join('|');
    return `<a class="srow rl${live ? ' on' : ''}" href="${href.game(L.key, g.id)}" data-gid="${esc(g.id)}" data-k="${esc(key)}"><span class="rt${lvC ? ' lv' : ''}${stale ? ' st' : ''}"><b>${esc(c1)}</b>${c2 ? `<small>${esc(c2)}</small>` : ''}</span><span class="rtm${has ? ' rtsc' : ''}">${line(g.away, 'away', loA, fin && has && a > h)}${line(g.home, 'home', loH, fin && has && h > a)}</span>${right}</a>`;
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
    const panels = [...strip.children]; const keys = panels.map(p => p.dataset.pg);
    // v407: a panel may name the tab it belongs to (data-pgtab), so two pages can share one button
    const btns = panels.map(p => tabs.querySelector(`[data-tab="${p.dataset.pgtab || p.dataset.pg}"]`));
    const uniq = [...new Set(btns)];
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
    // v413: the strip's own padding counts too, or a padded strip trims the bottom of its last card (Game info, 12px)
    const padY = () => { const cs = getComputedStyle(strip); return (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (cs.boxSizing === 'border-box' ? (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0) : 0); };
    const fit = (wide) => { const pad = getComputedStyle(strip).boxSizing === 'border-box' ? padY() : 0; const a = panels[cur].offsetHeight + pad; const need = wide ? Math.max(a, window.scrollY + innerHeight - top0() + pad) : a; strip.style.height = need + 'px'; };
    const inkTo = (x) => { const i = Math.floor(x), f = x - i; const a = btns[Math.max(0, Math.min(i, btns.length - 1))], b = btns[Math.max(0, Math.min(i + 1, btns.length - 1))];
      const L = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * f, Wd = a.offsetWidth + (b.offsetWidth - a.offsetWidth) * f; ink.style.transform = `translateX(${L + Wd * (1 - inkW) / 2}px)`; ink.style.width = Wd * inkW + 'px';
      const near = Math.round(x); uniq.forEach(bt => { const idxs = btns.map((x2, j) => x2 === bt ? j : -1).filter(j => j >= 0);
        const on = idxs.includes(near); if (bt.classList.contains('on') !== on) { bt.classList.toggle('on', on); bt.setAttribute('aria-selected', String(on)); bt.setAttribute('aria-pressed', String(on)); }
        bt.style.opacity = String(.55 + .45 * Math.max(0, ...idxs.map(j => 1 - Math.abs(x - j)))); }); };
    const land = (i) => { if (i === cur) { fit(false); return; } ys[cur] = window.scrollY; const y = yFor(i); cur = i; panels.forEach(p => { p.style.transform = ''; }); fit(false); window.scrollTo(0, y); place();
      if (!seen.has(i)) { seen.add(i); if (HW.v5.soft) HW.v5.soft(panels[i]); } if (onShow) onShow(keys[i]);
      // a tab row wider than the screen keeps the current tab in view (v408)
      const bt = btns[i], row = bt && bt.parentElement; if (row && row.scrollWidth > row.clientWidth + 2) { const x = bt.offsetLeft - (row.clientWidth - bt.offsetWidth) / 2; row.scrollTo({ left: Math.max(0, x), behavior: reduce ? 'auto' : 'smooth' }); } };
    let t = 0, moving = false, down = false;
    // v400: never settle while a finger is still on the glass (a pause mid-swipe is not the end of it)
    const settle = () => { clearTimeout(t); t = setTimeout(() => { if (down) return; const i = Math.round(strip.scrollLeft / W()); if (Math.abs(strip.scrollLeft - i * W()) > 1) { strip.scrollTo({ left: i * W(), behavior: reduce ? 'auto' : 'smooth' }); return; } moving = false; land(i); }, 120); };
    strip.addEventListener('touchstart', () => { down = true; }, { passive: true });
    const up = () => { down = false; if (moving) settle(); };
    strip.addEventListener('touchend', up, { passive: true }); strip.addEventListener('touchcancel', up, { passive: true });
    strip.addEventListener('scroll', () => { const x = strip.scrollLeft / W(); inkTo(x); if (!moving) { moving = true; place(); fit(true); } settle(); }, { passive: true });
    window.addEventListener('scroll', () => { if (strip.isConnected) place(); }, { passive: true });
    /* v413: a sideways table inside a panel. A swipe that starts on its frozen first column (the names) turns the page;
       a swipe on the numbers scrolls the table, and once the table is already at its edge, a swipe that pushes past that
       edge turns the page instead of doing nothing. The page is then carried by the finger and let go with the same
       snap a normal swipe gets. */
    const scrollerIn = el => { for (let x = el; x && x !== strip; x = x.parentElement) { if (x.scrollWidth > x.clientWidth + 1) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll') return x; } } return null; };
    const onFrozen = (el, sc) => { for (let x = el; x && x !== sc; x = x.parentElement) if (getComputedStyle(x).position === 'sticky') return true; return false; };
    let hand = null;
    strip.addEventListener('touchstart', e => { if (e.touches.length !== 1) { hand = null; return; } const t = e.touches[0]; const sc = scrollerIn(e.target);
      hand = sc ? { sc, frozen: onFrozen(e.target, sc), x: t.clientX, y: t.clientY, sl: strip.scrollLeft, on: false, decided: false, last: t.clientX, lt: performance.now(), v: 0 } : null; }, { passive: true });
    strip.addEventListener('touchmove', e => { if (!hand) return; const t = e.touches[0]; const dx = t.clientX - hand.x, dy = t.clientY - hand.y;
      if (!hand.decided) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; hand.decided = true;
        if (Math.abs(dy) > Math.abs(dx)) { hand = null; return; }
        const sc = hand.sc, atL = sc.scrollLeft <= 1, atR = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 1;
        hand.on = hand.frozen || (dx > 0 && atL) || (dx < 0 && atR);
        if (hand.on) { strip.style.scrollSnapType = 'none'; } else { hand = null; return; } }
      if (!hand.on) return;
      e.preventDefault();
      const now = performance.now(); hand.v = (t.clientX - hand.last) / Math.max(1, now - hand.lt); hand.last = t.clientX; hand.lt = now;
      strip.scrollLeft = Math.max(0, Math.min(strip.scrollWidth - W(), hand.sl - dx)); }, { passive: false });
    const handEnd = () => { if (!hand || !hand.on) { hand = null; return; } const { sl, v } = hand; hand = null;
      const from = Math.round(sl / W()); const moved = (strip.scrollLeft - sl) / W(); let to = from;
      if (moved > .35 || (moved > .05 && v < -.25)) to = from + 1; else if (moved < -.35 || (moved < -.05 && v > .25)) to = from - 1;   // past a third, or a quick flick, turns the page
      to = Math.max(0, Math.min(panels.length - 1, to));
      strip.scrollTo({ left: to * W(), behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(() => { strip.style.scrollSnapType = ''; }, reduce ? 0 : 420); };
    strip.addEventListener('touchend', handEnd, { passive: true }); strip.addEventListener('touchcancel', handEnd, { passive: true });
    uniq.forEach(b => b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation();
      const idxs = btns.map((x2, j) => x2 === b ? j : -1).filter(j => j >= 0);
      if (idxs.includes(cur) && Math.abs(strip.scrollLeft - cur * W()) < 2) { if (window.scrollY > stick()) window.scrollTo({ top: stick(), behavior: reduce ? 'auto' : 'smooth' }); return; }
      place(); fit(true); strip.scrollTo({ left: idxs[0] * W(), behavior: reduce ? 'auto' : 'smooth' }); }, true));
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
  /* ===== v423: Home is one Following feed across every league, with a tab per league (Ray's pick: A's flat timeline,
     the inline "Since last night", X's tabs). Each league's data is a source, loaded once and kept for a few minutes;
     the Following tab merges every source, a league tab shows its own. Order: live games, breaking, tonight's strip,
     since last night, then the river (injury changes, standings moves, news) newest first, leagues mixed on time alone. ===== */
  const feedSrc = {};
  const HTABS = ['following', ...ORDER];
  const followsIn = lk => (favs.all()[lk] || []).length > 0 || fplayers.all().some(p => p.lk === lk);
  function feedSource(lk) {
    const today = todayCT(); let s = feedSrc[lk];
    if (s && s.day === today && Date.now() - s.at < 10 * 60000 && s.sig === JSON.stringify([favs.all()[lk] || [], fplayers.all().filter(p => p.lk === lk).map(p => p.id), prefs.all()])) return s;
    s = feedSrc[lk] = { lk, day: today, at: Date.now(), sig: JSON.stringify([favs.all()[lk] || [], fplayers.all().filter(p => p.lk === lk).map(p => p.id), prefs.all()]), out: null, subs: new Set(), refresh: null };
    s.ready = loadFeed(s).catch(err => { console.error(err); s.failed = true; s.subs.forEach(f => f()); });
    return s;
  }
  async function loadFeed(s) {
    const lk = s.lk; const L = LEAGUES[lk]; const today = todayCT();
    const mine = favs.all()[lk] || [];
    const fp = fplayers.all().filter(p => p.lk === lk);
    const P = prefs.all(); const yday = addDays(today, -1);
    const dead = () => feedSrc[lk] !== s;
    const S0 = { games: [], last: [], ctx: null, st: null, tIdx: {}, teams: null, sums: {}, news: null, inj: null, older: {}, rec: null };
    s.depth = 0;   // v425: how many days before yesterday the river has reached (continuous scroll reaches back about a week)
    const favTeam = t => mine.includes(String(t.id));
    const teamOf = p => { const k = String(p.team || '').toLowerCase(); return t => (p.teamId && String(t.id) === String(p.teamId)) || (k && [t.abbr, t.short, t.name].some(x => String(x || '').toLowerCase() === k)); };
    const basicTeam = id => { const t = S0.tIdx[id]; const r = S0.st && S0.st.byId && S0.st.byId[id]; if (!t && !r) return null; return { id, abbr: t ? t.abbr : r.abbr, name: t ? t.name : r.name, short: t ? t.short : r.short, loc: t ? t.loc : r.loc, color: teamColor({ id, color: t && t.color }, L), logo: (t && t.logo) || (r && r.logo) || '', rec: r ? `${r.w}-${r.l}` : '', standing: r && L.standingsMode !== 'conferences' ? `${ordinal(r.pos)} in the ${confName(r.group, r.groupAbbr)}` : '', row: r || null, next: null, last: null }; };
    const teamList = () => S0.teams ? S0.teams.filter(Boolean) : mine.map(basicTeam).filter(Boolean);
    const build = () => {
      if (dead()) return;
      const { games, last, ctx } = S0; const teams = teamList();
      const DAY = 864e5, now = Date.now();
      const offS = !games.length && !!S0.teams && teams.length > 0 && teams.every(t => (!t.next || new Date(t.next.date) - now > 21 * DAY) && (!t.last || now - new Date(t.last.date) > 3 * DAY));
      // Unrivaled leads the WNBA's Home once its season is over
      const unr = lk === 'wnba' && S0.unr && (offS || !S0.teams && !games.length) ? S0.unr : '';
      const pGames = fp.map(p => { const is = teamOf(p); const g = last.find(g => isDone(g) && (is(g.home) || is(g.away))); return g ? { p, g } : null; }).filter(Boolean);
      const lines = pGames.map(({ p, g }) => { const d = S0.sums[g.id]; const bx = d && d.boxscore && d.boxscore.players || []; for (const side of bx) { const st = side.statistics && side.statistics[0]; if (!st) continue; const labels = st.labels || st.names || []; const a = (st.athletes || []).find(x => x.athlete && String(x.athlete.id) === p.id); if (!a) continue; if (a.didNotPlay || !a.stats || !a.stats.length) return { p, g, dnp: a.reason || 'Did not play' }; const get = l => { const i = labels.indexOf(l); return i >= 0 ? a.stats[i] : ''; }; const is = teamOf(p); const us = is(g.home) ? g.home : g.away, them = is(g.home) ? g.away : g.home; return { p, g, pts: get('PTS'), reb: get('REB'), ast: get('AST'), min: get('MIN'), won: us.score > them.score, us, them }; } return null; }).filter(Boolean);
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
          S0.wireItems = items; S0.wireWho = who;   // v391: breaking stories are pinned posts at the top of the feed
        } else { S0.wireItems = []; }
      } else { S0.wireItems = []; }
      const NOW = Date.now(); const posts = []; const wireIds = new Set((S0.wireItems || []).map(a => String(a.id)));
      const when = ts => { const d = (NOW - ts) / 6e4; if (d < -1) { const m = -d; return m < 60 ? `in ${Math.round(m)}m` : `in ${Math.round(m / 60)}h`; } if (d < 1) return 'now'; if (d < 60) return `${Math.round(d)}m`; if (d < 1440) return `${Math.round(d / 60)}h`; return `${Math.round(d / 1440)}d`; };
      const crest = t => logo(t.logo, '', teamColor(t, L));
      /* v393: the feed is ordered by what matters, not by clock. Tiers: 0 breaking · 1 live · 2 results (your players'
         lines under their game) · 3 today's games · 4 injury CHANGES · 5 standings moves · 6 news. Within a tier, newest
         first (today's games: soonest first). ESPN re-stamps its whole injury report overnight, so the report's own dates
         can't say what's new: the phone keeps a log of each player's last status and posts only when it changes. */
      let tier = 9;
      const post = (k, to, av, who, kind, body, extra = '', act = '', lab = '', cls = '') => posts.push({ tier, k, html: `<${to ? `a href="${to}"` : `button${act}`} class="fp${cls ? ' ' + cls : ''}"${kvOf(av)}>${`<span class="fav">${av}</span>`}<span class="fb"><span class="fh"><b>${who}</b>${kind ? `<span>${kind}</span>` : ''}<time>${lab || when(k)}</time></span><span class="ft">${body}</span>${extra}</span></${to ? 'a' : 'button'}>` });
      const leadOf = (t, name) => { const l = (t.leaders || []).find(x => new RegExp(name, 'i').test(x.name || '')); const a = l && l.leaders && l.leaders[0]; return a && a.athlete ? { n: a.athlete.shortName || a.athlete.displayName || '', v: a.displayValue || a.value } : null; };
      const strip = (g) => { const cells = [[g.away, 'points'], [g.home, 'points'], [+g.home.score >= +g.away.score ? g.home : g.away, 'rebounds']].map(([t, k]) => { const x = leadOf(t, k); return x ? `<span><b>${esc(String(x.v).replace(/\s.*$/, ''))}</b><small>${esc(`${lastName(x.n)} · ${k === 'points' ? 'PTS' : 'REB'}`)}</small></span>` : ''; }).filter(Boolean); return cells.length ? `<span class="fx">${cells.join('')}</span>` : ''; };
      const endTs = g => Math.min(new Date(g.date).getTime() + 2.4 * 36e5, NOW - 6e4);
      const outsOf = t => { const b = S0.inj && S0.inj.byTeam[t.id]; return (b && b.list || []).filter(x => /out|suspen/i.test(x.status || '')).map(x => lastName((x.athlete || {}).displayName || '')).filter(Boolean); };
      const without = (t) => { const o = outsOf(t); return o.length ? `${esc(t.short)} without ${esc(o.length > 2 ? `${o.slice(0, 2).join(', ')} and ${o.length - 2} more` : o.join(' and '))}.` : ''; };
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
        Object.entries(log).forEach(([id, e]) => { if (id !== '__seeded' && ((e.s === 'cleared' && NOW - e.at > 7 * 864e5) || (!teams.some(t => t.id === e.team) && NOW - (e.at || 0) > 7 * 864e5))) { delete log[id]; dirty = true; } });   // v421: unfollowed teams' entries go too
        if (dirty) { log.__seeded = true; store.set(LOGK, log); }
        // what posts: anything whose status changed in the last 48 hours, rest days only for players you follow
        const recent = Object.entries(log).filter(([id, e]) => id !== '__seeded' && e.at && NOW - e.at < 48 * 36e5);
        const rows = recent.map(([id, e]) => {
          const c = cur[id]; const p = pById.get(id) || null; const t = c ? c.t : (teams.find(x => x.id === e.team) || {}); const nm = e.nm || (p && p.name) || '';
          if (!c) return { k: e.at, imp: 1, html: () => post(e.at, href.player(lk, id), headshot((p && p.img) || idHs(L, id), teamColor(t, L), 40, nm), esc(t.short || ''), 'Injury', `<b>${esc(nm)}</b> is off the injury report.`, '', '', '', 'finj') };
          const x = c.x; const det = x.details || {}; const rest = /rest/i.test(`${det.type || ''} ${det.detail || ''} ${x.shortComment || ''}`); if (rest && !p) return null;
          const key = `h:${t.id}:${id}:${x.id || c.i}`; S.injuries = S.injuries || {}; S.injuries[key] = { x, id, team: t };
          const st = statusWord(x.status || ''); const ret = retInfo(L, det.returnDate); const part = (det.type || det.location || det.detail || '').toLowerCase(); const out = /out/i.test(st);
          const txt = out ? `<b>${esc(nm)}</b> is out${part && !rest ? ` with ${/^[aeiou]/.test(part) ? 'an' : 'a'} ${esc(part)} injury` : ''}${ret && !ret.past ? (ret.far ? ' for the season.' : `, back around ${esc(ret.long)}.`) : '.'}` : `<b>${esc(nm)}</b> is ${esc(st.toLowerCase())}${part ? ` (${esc(part)})` : ''}.`;
          return { k: e.at, imp: c.s === 'season' ? 4 : c.s === 'out' ? 3 : c.s === 'doubtful' ? 2 : 1, html: () => post(e.at, '', headshot(hsUrl(c.a) || (p && p.img) || idHs(L, id), teamColor(t, L), 40, nm), esc(t.short), 'Injury', txt, '', ` data-act="injury" data-key="${esc(key)}"`, '', 'finj') };
        }).filter(Boolean).sort((a, b) => (b.imp - a.imp) || (b.k - a.k));
        rows.forEach(r => r.html());
        if (false) { const n0 = posts.length; rows.slice(5).forEach(r => r.html()); posts.slice(n0).forEach(pp => { pp.html = pp.html.replace('class="fp finj"', 'class="fp finj fmore" hidden'); });
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
          const up = b < a; const cf = esc(confName(r.group, r.groupAbbr)); post(NOW - 864e5 / 2, href.team(lk, t.id), crest(t), esc(t.short), 'Standings', b === 1 && up ? `Take over <b>1st in the ${cf}</b>. ${esc(`${r.w}-${r.l}`)}.` : `${up ? 'Up' : 'Down'} to <b>${ordinal(b)} in the ${cf}</b>, from ${ordinal(a)}. ${esc(`${r.w}-${r.l}`)}.`, '', '', 'today'); });
      }
      // 6 · news: yours for the week (the scroll reaches back), the league's fill for two days, the big stories for a day
      tier = 6;
      const LIST = /power rankings?|rankings?:|takeaways|winners and losers|grades|things (we|to) (learned|know|watch)|best bets|picks|predictions|biggest questions|ranking every|top \d+/i;
      if (P.news && S0.news) {
        const age = a => a.published ? NOW - new Date(a.published).getTime() : 864e5;
        const all = (S0.news.articles || []).filter(HW.readable).filter(a => age(a) < 7 * 864e5); const mineA = all.filter(a => tagged(a));
        const fresh2 = all.filter(a => age(a) < 2 * 864e5 && !mineA.includes(a));
        const fill = mineA.filter(a => age(a) < 2 * 864e5).length >= 3 ? [] : fresh2.slice(0, 3 - mineA.filter(a => age(a) < 2 * 864e5).length);
        const big = fresh2.filter(a => HW.isWire(a) && age(a) < 864e5).slice(0, 2);
        const fillIds = new Set(fill.map(a => String(a.id))), bigIds = new Set(big.map(a => String(a.id)));
        const listDays = new Set();   // one listicle (power rankings and the like) a day
        const arts = [...new Set([...mineA, ...fill, ...big])].filter(a => !wireIds.has(String(a.id))).filter(a => { if (!LIST.test(a.headline || '')) return true; const d = HW.ymdOf(a.published || new Date().toISOString()); if (listDays.has(d)) return false; listDays.add(d); return true; });
        arts.forEach(a => { const r = HW.v5.newsRow(lk, a); const hrefM = /^<a class="row" href="([^"]+)"/.exec(r); const vid = /data-vid="([^"]+)"/.exec(r);
          const tid = (a.categories || []).map(c => c.type === 'team' ? String(c.teamId || (c.team && c.team.id) || '') : '').find(id => id && S0.tIdx[id]); const tm = tid ? S0.tIdx[tid] : null;
          const av = tm ? crest(tm) : `<span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4.5" width="16" height="15" rx="2.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg></span>`;
          // a real photo is wide and big; a square or small image is a logo and never runs
          const ph = (a.images || []).filter(x => x && x.url && (+x.width || 0) >= 400 && (+x.height || 1) > 0 && (+x.width / (+x.height || 1)) >= 1.3).sort((x, y) => (+y.width || 0) - (+x.width || 0))[0];
          const ts = a.published ? new Date(a.published).getTime() : NOW - 864e5; const n0 = posts.length;
          const who = esc(tm ? tm.short : L.label); const desc = a.description && a.description !== a.headline ? `<span class="fd">${esc(a.description)}</span>` : '';
          if (vid) { const im = /<img[^>]+src="([^"]+)"/.exec(r); post(ts, '', av, who, 'Video', esc(a.headline), im ? `<span class="fimg"><img src="${im[1]}" alt="" loading="lazy" onerror="this.parentNode.remove()"><i class="play"></i></span>` : '', ` data-act="play" data-vid="${vid[1]}"`); }
          else post(ts, hrefM ? hrefM[1] : '', av, who, 'News', `<span class="fhl">${esc(a.headline)}</span>${desc}`, ph ? `<span class="fth"><img src="${esc(ph.url)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></span>` : '', '', '', 'fnw' + (ph ? ' hth' : ''));
          posts.slice(n0).forEach(pp => { pp.t = 'news'; pp.fill = fillIds.has(String(a.id)) && !mineA.includes(a); pp.big = bigIds.has(String(a.id)) && !mineA.includes(a);
            if (ph && !vid && age(a) < 864e5) pp.hero = pp.html.replace('class="fp fnw hth"', 'class="fp fnw fhero"').replace(/<span class="fth">(<img[^>]+>)<\/span>/, '<span class="fimg">$1</span>'); }); });
      }
      /* 7 · the games: your older finals (the scroll reaches back), the league's games worth a look (upsets, a top-10
         meeting, overtime, a one-possession finish), the big nights, and your teams' streaks */
      tier = 7;
      const pastG = [...last, ...games.filter(g => HW.ymdOf(g.date) === today), ...Object.values(S0.older).flat()].filter((g, i, arr) => isDone(g) && !g.off && arr.findIndex(x => x.id === g.id) === i);
      const byDay = {}; pastG.forEach(g => { (byDay[HW.ymdOf(g.date)] = byDay[HW.ymdOf(g.date)] || []).push(g); });
      const fpIds = new Set(fp.map(p => String(p.id)));
      const scoreTxt = (w, l) => `${esc(String(w.score))}-${esc(String(l.score))}`;
      const rk = t => t.rank ? `No. ${t.rank} ` : '';
      Object.entries(byDay).forEach(([day, list]) => {
        const recent = day >= yday;   // the last two days are Since last night's; older finals of yours post in the river
        list.forEach(g => { if (recent || !isFav(g) || !P.brief) return; const us = favTeam(g.home) ? g.home : g.away, them = us === g.home ? g.away : g.home; const won = +us.score > +them.score;
          post(endTs(g), href.game(lk, g.id), crest(us), esc(us.short), 'Final', `${won ? 'Beat' : 'Lost to'} ${esc(them.short)}, <b>${won ? scoreTxt(us, them) : scoreTxt(us, them)}</b>${/OT/.test(finalWord(g)) ? ` in ${esc(finalWord(g).replace(/^Final\/?\s*/i, '') || 'OT')}` : ''}.`, strip(g)); posts[posts.length - 1].t = 'game'; });
        if (!P.news) return;
        // the league's games worth a look (never yours: those are above)
        const others = list.filter(g => !isFav(g)); let nUp = 0, nClose = 0;
        others.map(g => { const w = +g.home.score > +g.away.score ? g.home : g.away, l = w === g.home ? g.away : g.home; const m = +w.score - +l.score; const ot = /OT/.test(finalWord(g));
          const upset = L.hasRankings && l.rank && (!w.rank || w.rank > l.rank + 4); const top = L.hasRankings && w.rank && l.rank && w.rank <= 10 && l.rank <= 10;
          return { g, w, l, m, ot, upset, top, close: m <= 3 || ot }; })
          .filter(x => x.upset || x.top || x.close).sort((a, b) => (b.upset - a.upset) || (b.top - a.top) || (a.m - b.m))
          .forEach(x => { const { g, w, l } = x; let txt;
            if ((x.upset || x.top) && nUp < 2) { nUp++; txt = x.upset ? `${w.rank ? `No. ${w.rank}` : 'Unranked'} ${esc(w.short)} ${x.m <= 3 ? 'edge' : 'knock off'} No. ${l.rank} ${esc(l.short)}, <b>${scoreTxt(w, l)}</b>.` : `${rk(w)}${esc(w.short)} beat ${rk(l)}${esc(l.short)}, <b>${scoreTxt(w, l)}</b>.`; }
            else if (x.close && !x.upset && !x.top && nClose < 2) { nClose++; txt = x.ot ? `${rk(w)}${esc(w.short)} beat ${rk(l)}${esc(l.short)} in ${esc(finalWord(g).replace(/^Final\/?\s*/i, '') || 'OT')}, <b>${scoreTxt(w, l)}</b>.` : `${rk(w)}${esc(w.short)} ${x.m === 1 ? 'edge' : 'hold off'} ${rk(l)}${esc(l.short)} by ${x.m}, <b>${scoreTxt(w, l)}</b>.`; }
            if (!txt) return; post(endTs(g), href.game(lk, g.id), crest(w), esc(w.short), x.upset ? 'Upset' : 'Final', txt, strip(g)); const pp = posts[posts.length - 1]; pp.t = 'game'; pp.big = true; pp.fill = true; });
        // big nights, from each side's leaders: 40 points (35 in college), 20 boards, 15 assists, or 10 or more in all three
        const PTS = L.standingsMode === 'conferences' ? 35 : 40; const nights = [];
        list.forEach(g => [g.home, g.away].forEach(t => { const by = {}; (t.leaders || []).forEach(c => { const a = c.leaders && c.leaders[0]; if (!a || !a.athlete) return; const nm = (c.name || '').toLowerCase(); const k = /point/.test(nm) && !/per/.test(nm) ? 'pts' : /rebound/.test(nm) && !/per/.test(nm) ? 'reb' : /assist/.test(nm) && !/per/.test(nm) ? 'ast' : ''; if (!k) return; const id = athId(a.athlete); (by[id] = by[id] || { a: a.athlete, s: {} }).s[k] = +(a.value ?? parseFloat(a.displayValue)); });
          Object.entries(by).forEach(([id, x]) => { const st = x.s; const tri = st.pts >= 10 && st.reb >= 10 && st.ast >= 10; const score = (st.pts >= PTS ? st.pts : 0) + (st.reb >= 20 ? st.reb * 2 : 0) + (st.ast >= 15 ? st.ast * 2 : 0) + (tri ? 60 : 0); if (!score) return; nights.push({ g, t, id, a: x.a, st, tri, score, mine: fpIds.has(id) }); }); }));
        nights.filter(x => !(recent && x.mine)).sort((a, b) => (b.mine - a.mine) || (b.score - a.score)).filter((x, i, arr) => x.mine || arr.filter(y => !y.mine).indexOf(x) < 3).forEach(x => {
          const { g, t, a, st } = x; const them = t === g.home ? g.away : g.home; const won = +t.score > +them.score;
          const chips = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST']].filter(([k]) => Number.isFinite(st[k])).map(([k, l]) => `<s>${esc(String(st[k]))}<em>${l}</em></s>`).join('');
          post(endTs(g), `${href.game(lk, g.id)}/p/${esc(athId(a))}`, headshot(hsUrl(a), teamColor(t, L), 40, a.displayName || ''), esc(a.shortName || a.displayName || ''), x.tri ? 'Triple-double' : 'Big night', `<span class="fchips">${chips}</span><span class="ffin">${esc(t.short)} ${won ? 'beat' : 'lost to'} ${esc(them.short)}, ${esc(String(t.score))}-${esc(String(them.score))}</span>`, '', '', '', 'fperf');
          const pp = posts[posts.length - 1]; pp.t = 'perf'; if (!x.mine) { pp.big = true; pp.fill = true; } });
      });
      // streaks: five or more either way, posted at the end of the latest game
      if (P.teams && S0.st && S0.st.byId) teams.forEach(t => { const r = S0.st.byId[t.id]; const m = r && /^([WL])\s*(\d+)$/i.exec(String(r.strk || '').trim()); if (!m || +m[2] < 5) return;
        const g = pastG.filter(g => favTeam(g.home) && g.home.id === String(t.id) || favTeam(g.away) && g.away.id === String(t.id)).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        post(g ? endTs(g) : NOW - 864e5 / 2, href.team(lk, t.id), crest(t), esc(t.short), 'Streak', /w/i.test(m[1]) ? `<b>${m[2]} straight wins.</b> ${esc(`${r.w}-${r.l}`)}.` : `<b>${m[2]} straight losses.</b> ${esc(`${r.w}-${r.l}`)}.`); posts[posts.length - 1].t = 'x'; });
      /* 8 · RIVL's own voice: the game of the night in the afternoon, how the calls went in the morning */
      tier = 8;
      const RV = `<span class="frv"><img src="img/apple-touch-icon.png" alt=""></span>`;
      const at = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.getTime(); };
      if (prefs.get('forecast') && ctx && NOW >= at(11)) {
        const cand = games.filter(g => g.state === 'pre' && !g.off && HW.ymdOf(g.date) === today && new Date(g.date).getTime() > NOW).map(g => ({ g, f: safeF(L, g, ctx) })).filter(x => x.f && Number.isFinite(x.f.pHome)).sort((a, b) => rankGame(b.g) - rankGame(a.g)).slice(0, 6);
        const best = cand.sort((a, b) => Math.abs(a.f.pHome - .5) - Math.abs(b.f.pHome - .5))[0];
        if (best) { const { g, f } = best; const favT = f.pHome >= .5 ? g.home : g.away; const pc = Math.round(Math.max(f.pHome, 1 - f.pHome) * 100); const tip = esc(String(tipOf(g)).replace(/\s+(CT|ET|PT|MT|CST|CDT|EST|EDT|PST|PDT|MST|MDT)$/, ''));
          post(Math.min(at(12), NOW - 6e4), href.game(lk, g.id), RV, 'RIVL', 'Game of the night', `<b>${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}</b>, ${tip}. ${pc <= 52 ? 'A coin flip' : `${esc(favT.short)} at ${pc}%`}${cand.length >= 3 && pc <= 60 ? ', the closest call of the night' : ''}.`, '', '', '', 'frivl'); const pp = posts[posts.length - 1]; pp.t = 'rivl'; pp.rivl = true; }
      }
      const rg = S0.rec && Array.isArray(S0.rec.games) ? S0.rec.games.filter(x => x.date === yday && Number.isFinite(+x.hs) && Number.isFinite(+x.as) && Number.isFinite(+x.p) && +x.hs !== +x.as) : [];
      if (rg.length >= 4 && NOW >= at(7)) { const hit = rg.filter(x => (+x.p >= .5) === (+x.hs > +x.as)).length;
        post(Math.min(at(8), NOW - 6e4), '#record', RV, 'RIVL', 'The calls', `RIVL went <b>${hit} of ${rg.length}</b> on yesterday's ${esc(L.label)} calls.`, '', '', '', 'frivl'); const pp = posts[posts.length - 1]; pp.t = 'rivl'; pp.rivl = true; }
      // 0 · breaking, pinned above everything (v391, Ray's pick A)
      tier = 0;
      (S0.wireItems || []).forEach((a, i) => {
        const tid = HW.wireTeams ? HW.wireTeams(a).find(id => S0.tIdx[id]) : null; const tm = tid ? S0.tIdx[tid] : null;
        const av = tm ? crest(tm) : `<span class="fic brk"><i></i></span>`; const ts = a.published ? new Date(a.published).getTime() : NOW;
        posts.push({ tier: 0, k: ts - i, html: `<div class="fp fbrk"${kvOf(av)}><a class="fpa" href="#article/${lk}/${esc(String(a.id))}" aria-label="${esc(a.headline)}"></a><span class="fav">${av}</span><span class="fb"><span class="fh"><span class="fbk"><i></i>Breaking</span>${tm ? `<span>${esc(tm.short)}</span>` : ''}<time>${when(ts)}</time><button class="fx2" data-act="wire-x" data-ids="${esc(String(a.id))}" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></span><span class="ft"><b>${esc(a.headline)}</b></span></span></div>` }); });
      /* the live games, the strip and since last night, from the scoreboards */
      const NOWD = new Date(); const isToday = g => HW.ymdOf(g.date) === today;
      const margin = g => Math.abs((+g.home.score || 0) - (+g.away.score || 0));
      const liveAll = games.filter(isLive).sort((a, b) => (isFav(b) - isFav(a)) || margin(a) - margin(b) || rankGame(b) - rankGame(a));
      const preAll = games.filter(g => g.state === 'pre' && !g.off && isToday(g)).sort((a, b) => new Date(a.date) - new Date(b.date) || rankGame(b) - rankGame(a));
      const slateStarted = games.some(g => isToday(g) && !g.off && (g.state !== 'pre' || new Date(g.date) <= NOWD));
      const digest = [];
      if (P.brief || P.players) {
        const fin = games.concat(last).filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i).filter(g => isDone(g) && !g.off && isFav(g) && (isToday(g) || (HW.ymdOf(g.date) === yday && !slateStarted)));
        const linesBy = {}; lines.forEach(x => { (linesBy[x.g.id] = linesBy[x.g.id] || []).push(x); });
        fin.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(g => {
          const y = HW.ymdOf(g.date) === yday; const k = new Date(g.date).getTime();
          if (P.brief) { const us = favTeam(g.home) ? g.home : g.away, them = us === g.home ? g.away : g.home; const won = +us.score > +them.score; const ot = /OT/.test(finalWord(g)) ? ` in ${esc(finalWord(g).replace(/^Final\/?\s*/i, '') || 'OT')}` : '';
            digest.push({ k, y, html: `<a class="fp fdg" href="${href.game(lk, g.id)}"${kvOf(crest(us))}><span class="fav">${crest(us)}</span><span class="fb"><span class="fh"><b>${esc(us.short)}</b><span>Final</span><time>${when(endTs(g))}</time></span><span class="ft"><b>${esc(us.short)}</b> ${won ? 'beat' : 'lost to'} ${esc(them.short)}, <b class="${won ? 'wl-w' : 'wl-l'}">${esc(String(us.score))}-${esc(String(them.score))}</b>${ot}</span></span></a>` }); }
          if (P.players) (linesBy[g.id] || []).forEach((x, i) => { const hs = headshot(x.p.img, x.us ? teamColor(x.us, L) : playerColor(x.p, L), 30, x.p.name); digest.push({ k: k - 1 - i, y, pl: 1, html: `<a class="fp fdg" href="${href.game(lk, x.g.id)}/p/${esc(String(x.p.id))}"${kvOf(hs)}><span class="fav">${hs}</span><span class="fb"><span class="fh"><b>${esc(x.p.short || x.p.name)}</b><span>${x.dnp ? 'Did not play' : 'Stat line'}</span><time>${when(endTs(g))}</time></span><span class="ft">${x.dnp ? `<b>${esc(x.p.short || x.p.name)}</b> ${esc(x.dnp.toLowerCase())}` : `<b>${esc(String(x.pts))}</b> pts, <b>${esc(String(x.reb))}</b> reb, <b>${esc(String(x.ast))}</b> ast${x.us ? ` for the ${esc(x.us.short)}` : ''}`}</span></span></a>` }); });
        });
      }
      /* v431 Pulse: the finished games in hand (for settling picks), your teams in this league with their standing and
         streak, and last night's finals (yours; a league tab with none of yours gets the league's closest few) */
      const doneAll = pastG.concat(games.filter(g => isDone(g) && !g.off)).filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);
      const myTeams = mine.map(id => { const t = basicTeam(String(id)); if (!t) return null; const r = t.row || {}; const live = games.find(g => isLive(g) && (String(g.home.id) === t.id || String(g.away.id) === t.id));
        const nx = games.find(g => g.state === 'pre' && !g.off && (String(g.home.id) === t.id || String(g.away.id) === t.id));
        return Object.assign(t, { strk: /^[WL]\d+$/.test(r.strk || '') ? r.strk : '', rank: (() => { const g = games.concat(last).find(x => String(x.home.id) === t.id || String(x.away.id) === t.id); const sd = g && (String(g.home.id) === t.id ? g.home : g.away); return sd && sd.rank && sd.rank < 26 ? sd.rank : 0; })(), live, nx }); }).filter(Boolean);
      const finY = games.concat(last).filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i).filter(g => isDone(g) && !g.off && (isToday(g) || (HW.ymdOf(g.date) === yday && !slateStarted)));
      const lastF = finY.filter(isFav).sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastL = finY.filter(g => !isFav(g)).sort((a, b) => Math.abs(+a.home.score - +a.away.score) - Math.abs(+b.home.score - +b.away.score)).slice(0, 4);
      s.out = { L, lk, ctx, follows: mine.length > 0 || fp.length > 0, offS, unr, liveAll, preAll, digest, doneAll, myTeams, lastF, lastL, todayAll: games.filter(g => isToday(g) && !g.off),
        wire: posts.filter(p => p.tier === 0), river: posts.filter(p => p.tier >= 4), deep: s.depth < 7 };
      s.at = Date.now();
      s.subs.forEach(f => f());
    };
    // ----- phase 1: one round trip, then paint -----
    let [tIdx, games, last, ctx, st] = await Promise.all([
      teamsIndex(L),
      S.today[lk] && S.today[lk].length ? S.today[lk] : scoreboard(L, today).catch(() => []),
      scoreboard(L, yday, 600000).catch(() => []),
      forecastCtx(L, today).catch(() => null),
      standings(L).catch(() => null)
    ]);
    if (dead()) return;
    /* out of season the feed answers a date with no games by sending the last games it has (weeks old): only games on the
       day asked for are kept, so last season's final never sits under Tonight or Last night */
    const onDay = (list, d0, d1) => (list || []).filter(g => { const y = HW.ymdOf(g.date); return y >= d0 && y <= d1; });
    games = onDay(games, yday, addDays(today, 1)); last = onDay(last, yday, yday);
    Object.assign(S0, { tIdx, games, last, ctx, st, inj: ctx && ctx.inj ? ctx.inj : null });
    S.today[lk] = games;
    build();

    // ----- phase 2: schedules, box scores, news — each patches its section as it lands -----
    const later = [];
    if (mine.length) later.push((async () => { const teams = await Promise.all(mine.map(id => teamInfo(L, id, { idx: tIdx, st }).catch(() => null))); if (dead()) return; S0.teams = teams; build(); })());
    if (P.brief && fp.length) later.push((async () => {
      const ids = [...new Set(fp.map(p => { const is = teamOf(p); const g = last.find(g => isDone(g) && (is(g.home) || is(g.away))); return g ? g.id : null; }).filter(Boolean))];
      await Promise.all(ids.map(async id => { S0.sums[id] = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, 3600000); }));
      if (dead()) return; build();
    })());
    if (P.news || P.wire) later.push((async () => { S0.news = await jSoft(`${API(L)}/news?limit=50`, 600000); if (dead()) return; build(); })());
    if (lk === 'wnba' && HW.hub) later.push((async () => { S0.unr = await unrivaledCard(true).catch(() => ''); if (dead() || !S0.unr) return; build(); })());
    if (P.brief && fp.length && !games.length) later.push((async () => { S0.lp = await leaguePlayers(L).catch(() => null); if (dead()) return; build(); })());
    if (!S0.inj && mine.length && P.injuries) later.push((async () => { S0.inj = await injuries(L).catch(() => null); if (dead()) return; build(); })());
    later.push((async () => { S0.rec = HW.record ? await HW.record(L).catch(() => null) : null; if (dead()) return; build(); })());
    Promise.all(later).catch(() => { });

    // ----- while the app sits on Home: scores every pass, the rest every few minutes, patched quietly -----
    let quietAt = Date.now();
    s.refresh = async () => {
      if (dead()) return;
      S0.games = S.today[lk] ? S.today[lk].filter(g => { const y = HW.ymdOf(g.date); return y >= yday && y <= addDays(today, 1); }) : S0.games;
      const due = Date.now() - quietAt > 180000;
      if (due) {
        quietAt = Date.now();
        try { for (const k of [...HW.cache.keys()]) if (/\/injuries|\/news\?|\/summary\?event=/.test(k) && k.includes(L.path)) HW.cache.delete(k); } catch { }
        const [last2, inj2, news2] = await Promise.all([scoreboard(L, yday, 0).catch(() => null), mine.length && P.injuries ? injuries(L).catch(() => null) : null, P.news || P.wire ? jSoft(`${API(L)}/news?limit=50`, 0) : null]);
        if (dead()) return;
        if (last2) S0.last = last2.filter(g => HW.ymdOf(g.date) === yday); if (inj2) S0.inj = inj2; if (news2) S0.news = news2;
        if (fp.length) { const ids = [...new Set(fp.map(p => { const is = teamOf(p); const g = S0.last.find(g => isDone(g) && (is(g.home) || is(g.away))); return g ? g.id : null; }).filter(Boolean))]; await Promise.all(ids.map(async id => { const d = await jSoft(`${API(L)}/summary?event=${encodeURIComponent(id)}`, 0); if (d) S0.sums[id] = d; })); }
        if (dead()) return;
      }
      build();
    };
    /* v425: continuous scroll reaches back a day at a time, about a week deep */
    s.older = async () => {
      if (dead() || s.depth >= 7) return false;
      const n = s.depth + 1; const day = addDays(today, -1 - n);
      const gs = await scoreboard(L, day, 3600000).catch(() => []); if (dead()) return false;
      S0.older[day] = onDay(gs, day, day); s.depth = n; build(); return true;
    };
  }
  const tagLg = (html, L) => html.includes(`<b>${esc(L.label)}</b>`) ? html : html.replace('<time>', `<i class="flg">${esc(L.label)}</i><time>`);
  const homeSkel = () => skeleton(1, 'card') + skeleton(5, 'row');
  /* ===== v432 Ink: Home reads like a front page =====
     a one-line ticker of your games today, the date set large, the day's lead story with its photo, then one stream:
     breaking, last night, your players' lines, injuries, news and RIVL's posts. Every item opens with a small crest and a
     kicker in its team's colour; the rest of the page is black and white type. */
  const kvOf = av => { const d = /--tf-d:([^;"]+)/.exec(av || ''), l = /--tf-l:([^;"]+)/.exec(av || ''); return d && l ? ` style="--kd:${d[1]};--kl:${l[1]}"` : ''; };
  const clk = g => { const d = String(g.detail || ''); let m;
    if (/half ?time/i.test(d)) return 'Half';
    if ((m = /(\d)(?:st|nd|rd|th)\s+(?:Qtr|Quarter)/i.exec(d))) return `Q${m[1]}`;
    if ((m = /(\d)(?:st|nd)\s+Half/i.exec(d))) return `H${m[1]}`;
    if (/OT/i.test(d)) return esc(d.replace(/.*?(\d*OT).*/i, '$1'));
    if (/end/i.test(d)) return esc(d.replace(/^End (of )?(the )?/i, 'End ').replace(/(\d)(st|nd|rd|th) (Qtr|Quarter)/i, 'Q$1'));
    return esc(d); };
  const winSide = g => +g.home.score > +g.away.score ? 'h' : +g.away.score > +g.home.score ? 'a' : '';
  function tickItem(L, g, fol) {
    const lv = isLive(g), w = isDone(g) ? winSide(g) : ''; const ab = t => esc(t.abbr || t.short || '');
    const sd = (t, k) => `<span class="${w && w !== k ? 'lo' : ''}">${ab(t)} <b>${esc(String(t.score ?? ''))}</b></span>`;
    return `<a class="itk" href="${href.game(L.key, g.id)}">${sd(g.away, 'a')}${sd(g.home, 'h')}${lv ? `<i class="on">${clk(g)}</i>` : `<i>${isDone(g) ? 'F' : ''}</i>`}${fol ? '' : ''}</a>`;
  }
  const dayMark = () => { const d = new Date(); const z = HW.TZ || 'America/Chicago'; return `<div class="idate"><span>${esc(d.toLocaleDateString('en-US', { weekday: 'long', timeZone: z }))}</span><b>${esc(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: z }))}</b></div>`; };
  /* v437: Top 10 plays, from data/plays.json (the leagues' official YouTube channels, built by the repo's Plays job).
     The newest night's video for the leagues on this tab, while it's no older than two days. Tapping it swaps the picture
     for YouTube's own player in place, so it plays inside RIVL. */
  let playsD = null, playsAt = 0, homeRepaint = null;
  const playsLoad = () => { if (Date.now() - playsAt < 30 * 60000 || !HW.hub) return; playsAt = Date.now(); HW.hub.file('plays.json').then(d => { if (d && d.items) { playsD = d; if (homeRepaint) homeRepaint(); } }).catch(() => {}); };
  const playsCard = lks => {
    playsLoad(); if (!playsD || !lks.length) return '';
    const cut = addDays(todayCT(), -2);
    const it = playsD.items.filter(x => lks.includes(x.lk) && x.kind === 'night' && x.date >= cut).sort((a, b) => b.date.localeCompare(a.date))[0]; if (!it) return '';
    const L = LEAGUES[it.lk]; const day = dayLabel(it.date, { weekday: 'long', month: 'short', day: 'numeric' });
    const head = `Top ${it.top || 10} plays of the night`;
    return `<div class="feed hfl"><div class="fp fnw fhero fplay"><span class="fav"><span class="fic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.8c0-1 1.1-1.6 2-1.1l8.9 5.9c.8.5.8 1.7 0 2.2L10 18.7c-.9.5-2-.1-2-1.1z"/></svg></span></span><span class="fb"><span class="fh"><b>${esc(L.label)}</b><span>Plays</span><time>${esc(dayLabel(it.date, { weekday: 'short' }))}</time></span><span class="ft"><span class="fhl">${esc(head)}</span></span><button class="fyt" data-act="yt" data-yt="${esc(it.id)}" aria-label="Play ${esc(head)}"><img src="https://i.ytimg.com/vi/${esc(it.id)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()"><i class="play"></i>${it.len ? `<em>${esc(it.len)}</em>` : ''}</button><span class="fd">${esc(day)} · from the ${esc(L.label)}'s channel</span></span></div></div>`;
  };
  /* v442: stories, like the apps people already live in. Every team AND player you follow gets a bubble while there's
     something from the last 48 hours: the final, a player's stat line, the game's own clips (every bucket and block the
     feed cuts), and the video posts the news feeds tag them in (highlights, interviews, show segments; data/stories.json,
     built by the Stories job). All of it is plain video files: no ads, starts on the tap. Oldest to newest, opening on
     the first thing not yet seen; the ring stays lit until everything in it has been. */
  const ST_WIN = 48 * 36e5;
  let storiesD = null, storiesAt = 0;
  const storiesLoad = () => { if (Date.now() - storiesAt < 20 * 60000 || !HW.hub) return; storiesAt = Date.now(); HW.hub.file('stories.json').then(d => { if (d && d.items) { storiesD = d; if (homeRepaint && !stEl) homeRepaint(); } }).catch(() => {}); };
  const stSeen = () => store.get('v5:storyseen', {}) || {};
  const stMark = (key, id) => { const s = stSeen(); if ((s[key] || []).includes(id)) return; s[key] = [...(s[key] || []), id].slice(-80); store.set('v5:storyseen', s); };
  const gEnd = g => Math.min(new Date(g.date).getTime() + 2.4 * 36e5, Date.now() - 6e4);
  const SUMS = {};
  const sumGet = (L, g) => { const k = L.key + ':' + g.id; if (SUMS[k]) return SUMS[k]; SUMS[k] = { st: 'load' };
    jSoft(`${API(L)}/summary?event=${g.id}`).then(d => { SUMS[k] = d ? { st: 'ok', d } : { st: 'fail' }; if (homeRepaint && !stEl) homeRepaint(); }).catch(() => { SUMS[k] = { st: 'fail' }; }); return SUMS[k]; };
  const vidUrl = v => { const s = ((v || {}).links || {}).source || {}; return (s.mp4 && s.mp4.href) || (s.HD && s.HD.href) || s.href || (s.full && s.full.href) || ''; };
  const gameVids = (d, g, L) => ((d && d.videos) || []).map((v, i) => { const url = vidUrl(v); if (!url || !v.headline || v.premium) return null;
    const ts = Date.parse(v.originalPublishDate || v.lastModified || '') || (gEnd(g) + 6e4 + i * 1000);
    const aths = (v.categories || []).filter(c => c.type === 'athlete').map(c => String(c.athleteId || (c.athlete && c.athlete.id) || ''));
    return { kind: 'vid', id: 'v' + (v.id || url.slice(-24)), ts, url, title: String(v.headline), dur: +v.duration || 30, thumb: String(v.thumbnail || ''), aths, sub: `${g.away.short} at ${g.home.short}`, L }; }).filter(Boolean);
  const postItem = (p, L) => ({ kind: 'vid', id: 'v' + p.id, ts: Date.parse(p.ts), url: p.url, title: p.title, dur: p.dur || 30, thumb: p.thumb || '', aths: p.aths || [], sub: '', L });
  function lineOf(d, pid) {
    for (const side of ((d && d.boxscore && d.boxscore.players) || [])) { const st = side.statistics && side.statistics[0]; if (!st) continue; const lb = st.labels || st.names || [];
      const a = (st.athletes || []).find(x => x.athlete && String(x.athlete.id) === pid); if (!a) continue; if (a.didNotPlay || !a.stats || !a.stats.length) return null;
      const get = l => { const i = lb.indexOf(l); return i >= 0 ? a.stats[i] : ''; }; const tp = String(get('3PT') || '').split('-')[0];
      return { pts: get('PTS'), reb: get('REB'), ast: get('AST'), tpm: tp, min: get('MIN'), teamId: String((side.team || {}).id || ''), hs: hsUrl(a.athlete) }; }
    return null;
  }
  const nameHit = (title, nm) => { const last = String(nm || '').trim().split(/\s+/).slice(-1)[0] || ''; return last.length >= 4 && new RegExp(`(^|[^\\w])${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w])`, 'i').test(title); };
  function storySubjects() {
    storiesLoad(); const now = Date.now(); const subs = []; const posts = (storiesD && storiesD.items) || []; const seen = stSeen();
    ORDER.forEach(lk => {
      const s = feedSrc[lk]; const o = s && s.out; if (!o) return; const L = o.L;
      const games = [...(o.lastF || []), ...(o.doneAll || [])].filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i).filter(g => isDone(g) && !g.off && now - gEnd(g) < ST_WIN);
      const lp = posts.filter(p => p.lk === lk && p.url && now - Date.parse(p.ts) < ST_WIN);
      const finish = (sub, its) => { const m = new Map(); its.forEach(x => { if (!m.has(x.id)) m.set(x.id, x); }); sub.its = [...m.values()].sort((a, b) => a.ts - b.ts); if (!sub.its.length) return;
        const sn = new Set(seen[sub.key] || []); sub.un = sub.its.some(x => !sn.has(x.id)); sub.last = sub.its[sub.its.length - 1].ts; subs.push(sub); };
      (o.myTeams || []).forEach(t => { const tid = String(t.id); const its = [];
        games.filter(g => String(g.home.id) === tid || String(g.away.id) === tid).forEach(g => { its.push({ kind: 'final', id: 'g' + g.id, ts: gEnd(g), g, L, tid }); const S = sumGet(L, g); if (S.st === 'ok') its.push(...gameVids(S.d, g, L)); });
        lp.filter(p => (p.teams || []).includes(tid)).forEach(p => its.push(postItem(p, L)));
        finish({ key: `${lk}:t${tid}`, lk, kind: 'team', id: tid, name: t.short, color: t.color, logo: t.logo, abbr: t.abbr }, its); });
      fplayers.all().filter(p => p.lk === lk).forEach(p => { const pid = String(p.id); const its = []; let color = playerColor(p, L), hs = p.img || '';
        const k = String(p.team || '').toLowerCase(); const is = t => (p.teamId && String(t.id) === String(p.teamId)) || (k && [t.abbr, t.short, t.name].some(x => String(x || '').toLowerCase() === k));
        games.filter(g => is(g.home) || is(g.away)).forEach(g => { const S = sumGet(L, g); if (S.st !== 'ok') return; const ln = lineOf(S.d, pid);
          if (ln) { const us = String(g.home.id) === ln.teamId ? g.home : g.away; color = teamColor(us, L); hs = hs || ln.hs; its.push({ kind: 'line', id: 'l' + g.id, ts: gEnd(g) + 1, g, L, ln }); }
          gameVids(S.d, g, L).filter(v => v.aths.includes(pid) || nameHit(v.title, p.name)).forEach(v => its.push(v)); });
        lp.filter(x => (x.aths || []).includes(pid)).forEach(x => its.push(postItem(x, L)));
        finish({ key: `${lk}:p${pid}`, lk, kind: 'player', id: pid, name: p.short || lastName(p.name || ''), full: p.name || '', color, hs }, its); });
    });
    return subs.sort((a, b) => (b.un - a.un) || (b.last - a.last));
  }
  const stAvatar = (x, size) => x.kind === 'player' ? headshot(x.hs, x.color, size, x.full || x.name) : x.logo ? imgSized(x.logo, size * 2, size * 2) : `<b>${esc(x.abbr || '')}</b>`;
  function bubbles() {
    const subs = storySubjects(); if (!subs.length) return '';
    return `<div class="sbubs">${subs.map(x => `<button class="sbub${x.un ? '' : ' seen'}${x.kind === 'player' ? ' pl' : ''}" data-act="story" data-key="${esc(x.key)}" aria-label="${esc(x.full || x.name)} story"><span class="ring"><span>${stAvatar(x, x.kind === 'player' ? 52 : 30)}</span></span><small>${esc(x.name)}</small></button>`).join('')}</div>`;
  }

  /* the viewer. One stage over the page; the story grows out of the bubble you tapped and shrinks back into it.
     Tap right/left to step, hold to pause, drag down to put it away (it follows the finger), swipe across to turn
     to the next one on a cube. One <video> plays everything, started by the opening tap so sound is on. */
  let stEl = null, stPop = null;
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.2,.9,.25,1)';
  function storyOpen(key) {
    if (stEl) return;
    const subs = storySubjects(); let si = subs.findIndex(x => x.key === key); if (si < 0) return;
    const W = innerWidth, H = innerHeight, HYP = Math.ceil(Math.hypot(W, H) / 2) + 4;
    const el = document.createElement('div'); el.className = 'story';
    el.innerHTML = `<div class="stdim"></div><div class="stpane"><div class="stbg"></div><div class="stblur"></div><div class="stmedia"><div class="stvdw" hidden><video playsinline preload="auto"></video></div><div class="stcard" hidden></div></div><div class="stchrome"><div class="stsegs"></div><div class="sthd"></div><div class="stcap"></div></div></div>`;
    document.body.appendChild(el); stEl = el; document.documentElement.classList.add('stlock');
    const pane = el.querySelector('.stpane'), dim = el.querySelector('.stdim'), vd = el.querySelector('video');
    try { history.pushState({ story: 1 }, '', location.href); } catch (e) {}
    let ii = 0, t0 = 0, paused = false, pausedAt = 0, raf = 0, busy = false, closed = false;
    const sub = () => subs[si]; const item = () => sub() && sub().its[ii];
    const bubbleOf = k => { const b = [...document.querySelectorAll('.sbub')].find(x => x.dataset.key === k); if (!b) return null; const r = b.querySelector('.ring').getBoundingClientRect(); return r.bottom > 0 && r.top < H ? r : null; };
    const shrunk = r => ({ transform: `translate(${r.left + r.width / 2 - W / 2}px,${r.top + r.height / 2 - H / 2}px) scale(${r.width / W})`, clipPath: `circle(${W / 2}px at 50% 50%)`, opacity: .6 });
    const open = { transform: 'translate(0,0) scale(1)', clipPath: `circle(${HYP}px at 50% 50%)`, opacity: 1 };
    // ---- playback clock: cards run 6s, videos run on their own frames
    const CARD = 6000;
    const segs = () => { const x = sub(); pane.querySelector('.stsegs').innerHTML = x.its.map((_, j) => `<i class="${j < ii ? 'done' : ''}"><b></b></i>`).join(''); };
    const bar = f => { const b = pane.querySelectorAll('.stsegs i')[ii]; if (b) b.firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`; };
    const tick = () => { raf = requestAnimationFrame(tick); const it = item(); if (!it || paused || busy) return;
      if (it.kind === 'vid') { const d = vd.duration || it.dur; if (d) bar(vd.currentTime / d); }
      else { const f = (performance.now() - t0) / CARD; bar(f); if (f >= 1) step(1); } };
    const pause = () => { if (paused) return; paused = true; pausedAt = performance.now(); try { vd.pause(); } catch (e) {} el.classList.add('held'); };
    const resume = () => { if (!paused) return; paused = false; t0 += performance.now() - pausedAt; el.classList.remove('held'); const it = item(); if (it && it.kind === 'vid') { const p = vd.play(); if (p && p.catch) p.catch(() => {}); } };
    const head = () => { const x = sub(), it = item(); pane.querySelector('.sthd').innerHTML = `<span class="ring"><span>${stAvatar(x, x.kind === 'player' ? 34 : 22)}</span></span><span class="who"><b>${esc(x.full || x.name)}</b><small>${esc(ago(new Date(it.ts).toISOString()).replace(/ ago$/, ''))}</small></span><button class="stx" data-stx aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`; };
    const render = () => {
      const x = sub(), it = item(); stMark(x.key, it.id); head(); segs(); t0 = performance.now();
      const card = pane.querySelector('.stcard'), vw = pane.querySelector('.stvdw'), cap = pane.querySelector('.stcap'), bg = pane.querySelector('.stbg'), bl = pane.querySelector('.stblur');
      if (it.kind === 'vid') {
        bg.style.background = `linear-gradient(170deg,#050506 30%,${x.color} 190%)`; bl.style.backgroundImage = it.thumb ? `url("${it.thumb}")` : 'none';
        card.hidden = true; vw.hidden = false;
        try { vd.poster = it.thumb || ''; if (vd.dataset.u !== it.url) { vd.dataset.u = it.url; vd.src = it.url; } else vd.currentTime = 0; if (!paused) { const p = vd.play(); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
        cap.innerHTML = `<b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}`; cap.hidden = false;
      } else {
        try { vd.pause(); } catch (e) {} vw.hidden = true; bl.style.backgroundImage = 'none'; cap.hidden = true; card.hidden = false;
        const g = it.g, L = it.L;
        if (it.kind === 'final') { const home = String(g.home.id) === it.tid; const us = home ? g.home : g.away, them = home ? g.away : g.home; const won = +us.score > +them.score;
          bg.style.background = `linear-gradient(160deg,${teamColor(them, L)} -30%,#0a0a0c 44%,${teamColor(us, L)} 160%)`;
          card.innerHTML = `<span class="fin">Final · ${esc(won ? us.short : them.short)} win</span><div class="srw">${us.logo ? imgSized(us.logo, 128, 128) : ''}<b class="${won ? '' : 'lo'}">${esc(String(us.score))}</b><b class="${won ? 'lo' : ''}">${esc(String(them.score))}</b>${them.logo ? imgSized(them.logo, 128, 128) : ''}</div><div class="tms"><span>${esc(us.short)}</span><span>${esc(them.short)}</span></div>`;
        } else { const ln = it.ln; const us = String(g.home.id) === ln.teamId ? g.home : g.away, them = us === g.home ? g.away : g.home; const won = +us.score > +them.score;
          bg.style.background = `linear-gradient(165deg,#0a0a0c 35%,${x.color} 150%)`;
          const chips = [[ln.pts, 'PTS'], [ln.reb, 'REB'], [ln.ast, 'AST'], [+ln.tpm > 0 ? ln.tpm : '', '3PM']].filter(c => c[0] !== '' && c[0] != null).map(c => `<s>${esc(String(c[0]))}<em>${c[1]}</em></s>`).join('');
          card.innerHTML = `<span class="lnhs">${headshot(x.hs, x.color, 132, x.full || x.name)}</span><b class="lnnm">${esc(x.full || x.name)}</b><span class="lnres"><i class="${won ? 'w' : 'l'}">${won ? 'W' : 'L'}</i>${esc(String(us.score))}-${esc(String(them.score))} ${us === g.home ? 'vs' : 'at'} ${esc(them.short)}</span><span class="lnch">${chips}</span>`; }
      }
      const m = pane.querySelector('.stmedia'); if (!RM()) m.animate([{ opacity: .35, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
    };
    const step = d => { const x = sub(); if (!x || busy) return; const n = ii + d;
      if (n >= x.its.length) { if (si < subs.length - 1) return turn(1); return close(); }
      if (n < 0) { if (si > 0) return turn(-1); ii = 0; return render(); }
      ii = n; render(); };
    // ---- the cube: the page you're leaving keeps its last frame and turns away as the next one turns in
    const turn = dir => { if (busy) return; const nsi = si + dir; if (nsi < 0 || nsi >= subs.length) return close();
      busy = true; const ghost = pane.cloneNode(true); ghost.classList.add('ghost');
      const gv = ghost.querySelector('video'); if (gv) { const c = document.createElement('canvas'); c.width = vd.videoWidth || 1; c.height = vd.videoHeight || 1; try { c.getContext('2d').drawImage(vd, 0, 0); } catch (e) {} c.className = 'stframe'; gv.replaceWith(c); }
      el.insertBefore(ghost, pane); si = nsi; const sn = new Set(stSeen()[sub().key] || []); ii = Math.max(0, sub().its.findIndex(y => !sn.has(y.id))); render();
      if (RM()) { ghost.remove(); busy = false; return; }
      const z = `${-W / 2}px`; ghost.style.transformOrigin = pane.style.transformOrigin = `50% 50% ${z}`;
      const o = { duration: 440, easing: 'cubic-bezier(.3,.75,.3,1)' };
      ghost.animate([{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: `rotateY(${-90 * dir}deg)`, filter: 'brightness(.45)' }], o);
      pane.animate([{ transform: `rotateY(${90 * dir}deg)`, filter: 'brightness(.45)' }, { transform: 'rotateY(0deg)', filter: 'brightness(1)' }], o).finished.then(() => { ghost.remove(); pane.style.transformOrigin = ''; busy = false; t0 = performance.now(); }); };
    // ---- close: back into the bubble it came from (or a soft drop when the bubble is off screen)
    function close(fromPop, from) {
      if (closed) return; closed = true; busy = true; cancelAnimationFrame(raf); try { vd.pause(); } catch (e) {}
      if (stPop) { removeEventListener('popstate', stPop); stPop = null; }
      if (!fromPop) { try { history.back(); } catch (e) {} }
      const r = bubbleOf(sub().key); const start = from || open;
      const end = r ? shrunk(r) : { transform: 'translate(0,60px) scale(.9)', clipPath: `circle(${HYP}px at 50% 50%)`, opacity: 0 };
      const fin = () => { try { vd.removeAttribute('src'); vd.load(); } catch (e) {} el.remove(); stEl = null; document.documentElement.classList.remove('stlock'); if (homeRepaint) homeRepaint(); };
      if (RM()) return fin();
      dim.animate([{ opacity: getComputedStyle(dim).opacity }, { opacity: 0 }], { duration: 300, easing: EASE, fill: 'forwards' });
      pane.animate([start, end], { duration: r ? 340 : 240, easing: EASE, fill: 'forwards' }).finished.then(fin, fin);
    }
    stPop = () => close(true); addEventListener('popstate', stPop);
    // ---- gestures
    let px = 0, py = 0, pt = 0, mode = '', hold = 0, held = false, lastY = 0, lastT = 0, vy = 0;
    el.addEventListener('pointerdown', e => { if (busy || e.target.closest('[data-stx]')) return; px = e.clientX; py = e.clientY; pt = lastT = performance.now(); lastY = py; mode = ''; held = false; vy = 0;
      try { el.setPointerCapture(e.pointerId); } catch (er) {} clearTimeout(hold); hold = setTimeout(() => { held = true; pause(); }, 190); });
    el.addEventListener('pointermove', e => { if (!pt || busy) return; const dx = e.clientX - px, dy = e.clientY - py;
      if (!mode) { if (dy > 12 && dy > Math.abs(dx)) { mode = 'y'; clearTimeout(hold); pause(); } else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { mode = 'x'; clearTimeout(hold); pause(); } }
      const now = performance.now(); vy = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
      if (mode === 'y') { const d = Math.max(0, dy); pane.style.transform = `translate(${dx * .4}px,${d}px) scale(${1 - Math.min(d, 700) / 1700})`; pane.style.borderRadius = `${Math.min(d / 4, 28)}px`; dim.style.opacity = String(Math.max(0, 1 - d / 650)); }
      if (mode === 'x') { pane.style.transformOrigin = `50% 50% ${-W / 2}px`; pane.style.transform = `rotateY(${Math.max(-35, Math.min(35, dx / W * 70))}deg)`; } });
    const up = e => { if (!pt) return; clearTimeout(hold); const dx = e.clientX - px, dy = e.clientY - py; const m = mode; pt = 0; mode = '';
      if (m === 'y') { const d = Math.max(0, dy); const cur = { transform: pane.style.transform, clipPath: `circle(${HYP}px at 50% 50%)`, opacity: 1 };
        if (d > 110 || vy > .55) { pane.style.borderRadius = ''; return close(false, cur); }
        pane.animate([{ transform: pane.style.transform }, { transform: 'none' }], { duration: 260, easing: EASE }); dim.animate([{ opacity: dim.style.opacity }, { opacity: 1 }], { duration: 260, easing: EASE });
        pane.style.transform = ''; pane.style.borderRadius = ''; dim.style.opacity = ''; resume(); return; }
      if (m === 'x') { const cur = pane.style.transform; pane.style.transform = '';
        if (Math.abs(dx) > 70) { resume(); return turn(dx < 0 ? 1 : -1); }
        pane.animate([{ transform: cur }, { transform: 'rotateY(0deg)' }], { duration: 240, easing: EASE }).finished.then(() => { pane.style.transformOrigin = ''; }); resume(); return; }
      if (held) { held = false; resume(); return; }
      if (e.target.closest('[data-stx]')) return;
      resume(); step(e.clientX < W * .3 ? -1 : 1); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', e => { pt = 0; mode = ''; pane.style.transform = ''; dim.style.opacity = ''; resume(); });
    el.addEventListener('click', e => { if (e.target.closest('[data-stx]')) { e.preventDefault(); close(); } });
    vd.addEventListener('ended', () => { if (!busy && !paused) step(1); });
    vd.addEventListener('error', () => { const it = item(); if (it && it.kind === 'vid' && !busy) step(1); });
    // ---- in: grow out of the bubble
    const sn = new Set(stSeen()[sub().key] || []); ii = Math.max(0, sub().its.findIndex(y => !sn.has(y.id)));
    const r0 = bubbleOf(key); render(); raf = requestAnimationFrame(tick);
    el.__st = { get busy() { return busy; }, get ii() { return ii; }, get paused() { return paused; }, get si() { return si; }, get names() { return subs.map(x => x.name); } };   // read by the test harness
    if (!RM()) { busy = true; dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE });
      pane.animate([r0 ? shrunk(r0) : { transform: 'translate(0,40px) scale(.94)', clipPath: `circle(${HYP}px at 50% 50%)`, opacity: 0 }, open], { duration: 360, easing: EASE }).finished.then(() => { busy = false; t0 = performance.now(); }); }
  }
  const homeShown = {};   // v425: how far down each Home tab has scrolled into the river, so a return lands where it was
  async function home(tab) {
    if (!HTABS.includes(tab)) tab = 'following';
    const token = ++homeToken; const today = todayCT();
    const alive = () => { if (token !== homeToken) return false; const r = HW.v5.route && HW.v5.route(); return !r || (r.name === 'home' && r.args[0] === tab); };
    const anyFollow = ORDER.some(followsIn);
    if (tab === 'following' && !anyFollow) {
      $main.innerHTML = `<div class="hfeed"><div class="page-h"><h1>Make it yours</h1><p>Following shows the teams and players you follow, from every league in one feed.</p></div>` + empty('Nothing followed yet', '<p style="margin:6px 0 0">Pick a few teams and players and this tab fills with their games, lines, injuries and news.</p>', `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><a class="btn" href="#teams">Choose teams</a><a class="btn ghost" href="#players">Find players</a></div>`) + '</div>';
      return;
    }
    const leagues = tab === 'following' ? ORDER : [tab];
    const srcs = leagues.map(feedSource);
    const P = prefs.all();
    const secs = {}; const ORD = ['bub', 'unr', 'tick', 'date', 'lead', 'plays', 'wire', 'digest', 'river'];
    let painted = false;
    const wrap = k => `<section class="hsec2" data-sec="${k}" data-h="${hashOf(secs[k])}">${secs[k]}</section>`;
    const compose = () => {
      const outs = srcs.map(s => s.out).filter(Boolean); const NOW0 = Date.now();
      const fol = tab === 'following';
      ORD.forEach(k => delete secs[k]);
      const one = !fol ? outs[0] : null;
      if (one && one.unr) secs.unr = one.unr;
      // v440: team story bubbles, Following only
      if (fol) { const bb = bubbles(); if (bb) secs.bub = bb; }
      // the ticker: your games today (a league tab shows its day), live first, then finals
      if (P.live) {
        const rows = []; outs.forEach(o => (o.todayAll || []).filter(g => (!fol || isFav(g)) && (isLive(g) || isDone(g))).forEach(g => rows.push({ o, g })));
        rows.sort((x, y) => (isLive(y.g) - isLive(x.g)) || (isFav(y.g) - isFav(x.g)) || new Date(y.g.date) - new Date(x.g.date));
        if (rows.length) secs.tick = `<div class="itick">${rows.slice(0, 16).map(({ o, g }) => tickItem(o.L, g, fol)).join('')}</div>`;
      }
      secs.date = dayMark();
      // v437: the league's own Top 10 plays of the night, once a day, under the lead story; it plays right in the card
      { const pd = playsCard(fol ? ORDER.filter(followsIn) : leagues); if (pd) secs.plays = pd; }
      // breaking, pinned
      const wire = outs.flatMap(o => o.wire.map(p => ({ k: p.k, html: fol ? tagLg(p.html, o.L) : p.html }))).sort((a, b) => b.k - a.k);
      if (wire.length) secs.wire = `<div class="feed hfl">${wire.map(p => p.html).join('')}</div>`;
      // since last night: your results and your players' lines, as items
      const dg = outs.flatMap(o => o.digest.map(d => ({ k: d.k, y: d.y, html: fol ? tagLg(d.html, o.L) : d.html }))).sort((a, b) => b.k - a.k);
      if (dg.length) { const y = dg.some(d => d.y); secs.digest = `<div class="irule">${y ? 'Since last night' : 'Earlier today'}</div><div class="feed hfl">${dg.map(d => d.html).join('')}</div>`; }
      // the river: everything else, newest first, leagues mixed. Following carries everything about what you follow,
      // and from the rest of a league only its big moments (and those only for leagues you follow something in)
      let river = outs.flatMap(o => o.river.filter(p => !fol || (o.follows ? (!p.fill || p.big) : (p.big && p.t === 'news'))).map(p => ({ k: p.k, t: p.t || 'x', html: fol ? tagLg(p.html, o.L) : p.html, hero: p.hero ? (fol ? tagLg(p.hero, o.L) : p.hero) : '' }))).sort((a, b) => b.k - a.k);
      // never three stories in a row when something else from the same few hours can sit between them
      { const out = [], rest = river.slice(); while (rest.length) { const x = rest.shift(); const n = out.length;
          if (x.t === 'news' && n >= 2 && out[n - 1].t === 'news' && out[n - 2].t === 'news') { const j2 = rest.findIndex(y => y.t !== 'news' && x.k - y.k <= 6 * 36e5); if (j2 >= 0) { out.push(rest.splice(j2, 1)[0]); rest.unshift(x); continue; } }
          out.push(x); } river = out; }
      // one big picture a day: the newest big story with a real photo
      const hi = river.findIndex(p => p.hero && NOW0 - p.k < 864e5); if (hi >= 0) { secs.lead = `<div class="feed hfl">${river[hi].hero}</div>`; river.splice(hi, 1); }
      secs.riverAll = river;
      const deep = outs.some(o => o.deep);
      const shown = Math.min(river.length, homeShown[tab] || 15);
      if (river.length) secs.river = `${secs.digest || secs.wire ? '<div class="irule">Latest</div>' : ''}<div class="feed hfl" data-n="${shown}" data-h0="${hashOf(river.slice(0, shown).map(p => p.html).join(''))}">${river.slice(0, shown).map(p => p.html).join('')}${shown < river.length || deep ? '<div class="hmore" data-more><i></i><i></i><i></i></div>' : '<div class="hend">You’re caught up</div>'}</div>`;
    };
    homeRepaint = () => paint();
    const paint = () => {
      if (!alive()) return;
      compose();
      const ready = srcs.every(s => s.out || s.failed); const some = srcs.some(s => s.out);
      if (!some) { if (!painted) $main.innerHTML = homeSkel(); return; }
      const has = ORD.some(k => secs[k] && k !== 'date');
      if (!painted || !$main.querySelector('.hfeed')) {
        painted = true;
        const quiet = `<div class="hquiet"><b>${tab === 'following' ? 'Quiet for now' : `Nothing in ${esc(LEAGUES[tab].label)} yet`}</b><span>${tab === 'following' || followsIn(tab) ? 'Games, results, injury changes and news about your teams and players land here as they happen.' : `Follow ${esc(LEAGUES[tab].label)} teams and players and their games and news land here.`}</span>${tab !== 'following' && !followsIn(tab) ? '<a class="btn" href="#teams">Choose teams</a>' : ''}</div>`;
        $main.innerHTML = `<div class="hfeed" data-tab="${tab}">${has ? ORD.filter(k => secs[k]).map(wrap).join('') : ready ? quiet : homeSkel()}</div>`;
        if (!has && !ready) painted = false;
        watchMore(); return;
      }
      const root = $main.querySelector('.hfeed');
      if (!has) { if (ready && !root.querySelector('.hquiet')) { painted = false; paint(); } return; }
      if (root.querySelector('.hquiet,.skel')) { painted = false; return paint(); }
      ORD.forEach(k => {
        const cur = root.querySelector(`section[data-sec="${k}"]`);
        if (!secs[k]) { if (cur) cur.remove(); return; }
        if (cur && k === 'river' && cur.dataset.h !== hashOf(secs[k])) {   // the river grows at the bottom: when what's there is unchanged, only the new rows go in
          const f = cur.querySelector('.feed.hfl'); const n = f ? +f.dataset.n : 0; const all = secs.riverAll || []; const shown = Math.min(all.length, homeShown[tab] || 15);
          if (f && n && shown >= n && f.dataset.h0 === hashOf(all.slice(0, n).map(p => p.html).join(''))) {
            const tail = f.querySelector(':scope > .hmore,:scope > .hend'); const add = all.slice(n, shown).map(p => p.html).join('');
            if (tail) tail.insertAdjacentHTML('beforebegin', add); else f.insertAdjacentHTML('beforeend', add);
            const end = shown < all.length || outsDeep() ? '<div class="hmore" data-more><i></i><i></i><i></i></div>' : '<div class="hend">You\u2019re caught up</div>';
            if (tail) tail.outerHTML = end; else f.insertAdjacentHTML('beforeend', end);
            f.dataset.n = shown; f.dataset.h0 = hashOf(all.slice(0, shown).map(p => p.html).join('')); cur.dataset.h = hashOf(secs[k]); return;
          }
        }
        if (cur) { if (cur.dataset.h !== hashOf(secs[k])) { const open = [...cur.querySelectorAll('.lclip')].map(x => x.classList.contains('open')); const sl = (cur.querySelector('.itick') || {}).scrollLeft || 0;
          cur.insertAdjacentHTML('afterend', wrap(k)); const nu = cur.nextElementSibling; cur.remove();
          [...nu.querySelectorAll('.lclip')].forEach((x, i) => { if (!open[i]) return; x.classList.add('open'); const b = x.querySelector(':scope > .cliptog'); if (b) { b.setAttribute('aria-expanded', 'true'); b.textContent = 'Show less'; } });
          const st = nu.querySelector('.itick'); if (st && sl) st.scrollLeft = sl; } return; }
        const after = ORD.slice(ORD.indexOf(k) + 1).map(j => root.querySelector(`section[data-sec="${j}"]`)).find(Boolean);
        if (after) after.insertAdjacentHTML('beforebegin', wrap(k)); else root.insertAdjacentHTML('beforeend', wrap(k));
      });
      watchMore();
    };
    /* continuous scroll: when the bottom of the river comes near, the next rows go in; when the days in hand run out,
       every source reaches back one more day, up to about a week */
    const outsDeep = () => srcs.some(s => s.out && s.out.deep);
    let io = null, loadingMore = false;
    const more = async () => {
      if (loadingMore || !alive()) return; loadingMore = true;
      try {
        const all = secs.riverAll || []; const shown = Math.min(all.length, homeShown[tab] || 15);
        if (all.length - shown < 15 && outsDeep()) await Promise.all(srcs.map(s => s.older ? s.older().catch(() => false) : false));
        homeShown[tab] = shown + 15; if (alive()) paint();
      } finally { loadingMore = false; }
      requestAnimationFrame(() => { const m = $main.querySelector('.hfeed [data-more]'); if (m && m.getBoundingClientRect().top < innerHeight + 600) more(); });
    };
    function watchMore() {
      if (!('IntersectionObserver' in window)) return;
      if (!io) io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { rootMargin: '0px 0px 900px 0px' });
      io.disconnect(); const m = $main.querySelector('.hfeed [data-more]'); if (m) io.observe(m);
    }
    let raf = 0; const sched = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
    srcs.forEach(s => s.subs.add(sched));
    const unsub = () => srcs.forEach(s => s.subs.delete(sched));
    if (srcs.some(s => s.out)) paint(); else $main.innerHTML = homeSkel();
    HW.v5.refresh = async () => { if (!alive()) { unsub(); return; } await Promise.all(srcs.map(s => s.refresh ? s.refresh().catch(() => { }) : null)); };
    HW.v5.refresh.every = 90000;
    await Promise.race([Promise.all(srcs.map(s => s.ready)), new Promise(r => setTimeout(r, 6000))]);
    if (!alive()) { unsub(); if (io) io.disconnect(); return; }
    paint();
  }

  /* ================= SCORES: every game, compact ================= */
  /* Unrivaled, the 3-on-3 league WNBA players play in their offseason: its schedule from data/unrivaled.json, read off
     the league's own site by a job every few hours. Times come in Eastern and show on the viewer's own clock. Teams fill in once the
     league sets the matchups. */
  const unrDays = d => {
    const toYmd = x => { const t = new Date(String(x).replace(/^\w+,\s*/, '') + ' 12:00'); return isNaN(t) ? '' : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
    // v436: the 2027 file names each night (a tour stop, or a home night in Miami); two stops can share a date
    const days = {}; (d.games || []).forEach(g => { const y = g.ymd || toYmd(g.date); if (!y) return; const k = y + '|' + (g.night || g.arena || ''); (days[k] = days[k] || { y, arena: g.arena, city: g.city, name: g.kicker ? g.name : '', games: [] }).games.push(g); });
    return Object.values(days).sort((a, b) => a.y < b.y ? -1 : a.y > b.y ? 1 : (a.games[0].at || '') < (b.games[0].at || '') ? -1 : 1);
  };
  /* v413: Unrivaled's times come in Eastern; they show on the viewer's own clock (it used to subtract an hour for Central) */
  const zoneMin = (tz, d) => { try { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - d.getTime()) / 60000; } catch { return 0; } };
  const unrCT = (tm, ymd) => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(tm || ''); if (!m) return tm || '';
    const h = (+m[1] % 12) + (/PM/i.test(m[3]) ? 12 : 0); const day = ymd || todayCT();
    const guess = new Date(`${day}T${String(h).padStart(2, '0')}:${m[2]}:00Z`); const utc = new Date(guess.getTime() - zoneMin('America/New_York', guess) * 60000);
    try { return utc.toLocaleTimeString('en-US', { timeZone: HW.TZ, hour: 'numeric', minute: '2-digit' }); } catch { return tm; } };
  const unrTime = (g, ymd) => { if (g.at) { try { return new Date(g.at).toLocaleTimeString('en-US', { timeZone: HW.TZ, hour: 'numeric', minute: '2-digit' }); } catch { } } return unrCT(g.time, ymd); };
  const unrLogo = (d, name) => { const c = (d.clubs || []).find(x => x.name === name); return c && c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ''; };
  async function unrivaledCard() {
    const d = HW.hub ? await HW.hub.file('unrivaled.json').catch(() => null) : null; if (!d || !d.games || !d.games.length) return '';
    const today = todayCT(); const list = unrDays(d); const ahead = list.filter(x => x.y >= today); const nx = ahead[0]; if (!nx) return '';
    const n = Math.round((new Date(nx.y + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 864e5);
    const tv = [...new Set(nx.games.flatMap(g => g.tv || []))];
    const games = nx.games.map(g => `<a class="ung" href="#unr/game/${esc(g.id)}">${g.teams && g.teams.length === 2 ? `<span class="unt">${unrLogo(d, g.teams[0])}<b>${esc(g.teams[0])}</b></span><i>vs</i><span class="unt">${unrLogo(d, g.teams[1])}<b>${esc(g.teams[1])}</b></span>` : '<span class="unt tbd"><b>Teams to be set</b></span>'}<em>${esc(unrTime(g, nx.y))}</em></a>`).join('');
    // v443: a followed club's next game leads the card
    const mine = HW.v5.unrNext ? await HW.v5.unrNext().catch(() => null) : null;
    const mineH = mine && !nx.games.includes(mine.g) ? `<div class="unx"><div class="unh"><b>Your club · ${esc(dayLabel(mine.g.ymd, { weekday: 'short', month: 'short', day: 'numeric' }))}</b></div>${mine.row}</div>` : '';
    return `<div class="unrv"><div class="brief-h"><b>Unrivaled</b><span>${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`}</span></div><p class="unote">The 3-on-3 league where WNBA stars play in the offseason.</p>` + mineH
      + `<div class="unx"><div class="unh"><b>${esc(dayLabel(nx.y, { weekday: 'long', month: 'long', day: 'numeric' }))}</b><span>${esc([nx.arena, nx.city].filter(Boolean).join(' · '))}</span></div>${games}${tv.length ? `<div class="untv">${tv.map(x => `<em>${esc(x)}</em>`).join('')}</div>` : ''}</div>`
      + `<button class="btn ghost unbtn" data-act="scmode" data-mode="unrivaled">See the full schedule · ${ahead.reduce((a, x) => a + x.games.length, 0)} games</button></div>`;
  }
  async function unrivaledList() {
    if (HW.v5.unrHub) return HW.v5.unrHub();   // v443: the Court hub (js/unr.js)
    const d = HW.hub ? await HW.hub.file('unrivaled.json').catch(() => null) : null;
    if (!d || !d.games || !d.games.length) return empty('No Unrivaled schedule yet', '<p style="margin:6px 0 0">It shows here once the league posts it.</p>');
    const today = todayCT(); const list = unrDays(d); const ahead = list.filter(x => x.y >= today), done = list.filter(x => x.y < today).reverse();
    const dayCard = x => `<div class="unx"><div class="unh"><b>${esc(dayLabel(x.y, { weekday: 'short', month: 'short', day: 'numeric' }))}${x.name ? ` · ${esc(x.name.replace(/ is Unrivaled$/, ''))}` : ''}</b><span>${esc([x.arena, x.city].filter(Boolean).join(' · '))}</span></div>${x.games.map(g => `<div class="ung">${g.teams && g.teams.length === 2 ? `<span class="unt">${unrLogo(d, g.teams[0])}<b>${esc(g.teams[0])}</b></span><i>vs</i><span class="unt">${unrLogo(d, g.teams[1])}<b>${esc(g.teams[1])}</b></span>` : '<span class="unt tbd"><b>Teams to be set</b></span>'}<em>${g.score ? `<b>${esc(String(g.score[0]))}-${esc(String(g.score[1]))}</b>` : esc(unrTime(g, x.y))}</em></div>`).join('')}${(x.games[0] && x.games[0].tv || []).length ? `<div class="untv">${x.games[0].tv.map(t => `<em>${esc(t)}</em>`).join('')}</div>` : ''}</div>`;
    const byMonth = {}; ahead.forEach(x => { const k = dayLabel(x.y, { month: 'long', year: 'numeric' }); (byMonth[k] = byMonth[k] || []).push(x); });
    /* v436: the eight clubs and their rosters, headshots from the league's own site */
    const clubs = (d.clubs || []).filter(c => c.players && c.players.length);
    const face = p => `<span class="unp">${headshot(p.img || '', '', 52, p.name)}<b>${esc(p.last || p.name)}</b><small>${esc([p.pos, p.ht].filter(Boolean).join(' · '))}</small></span>`;
    const rail = clubs.length ? sec('Clubs', `${clubs.length} teams · ${clubs.reduce((a, c) => a + c.players.length, 0)} players`) + `<div class="unclubs">${clubs.map(c => `<div class="uncl"><div class="unclh">${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${esc(c.name)}</b></div><div class="unps">${c.players.map(face).join('')}</div></div>`).join('')}</div>` : '';
    return `<p class="unote" style="margin-top:4px">The 3-on-3 league where WNBA stars play in the offseason. ${ahead.length ? `${ahead.reduce((a, x) => a + x.games.length, 0)} games to come.` : ''}</p>` + rail
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
    const unrMode = lk === 'wnba' && (HW.v5.unrOn ? HW.v5.unrOn() : !!store.get('v5:scunr', false));   // v443: on by itself Jan to Mar
    const modes = lk === 'wnba' ? `<div class="chips scmode" role="tablist">${[['wnba', 'WNBA'], ['unrivaled', 'Unrivaled']].map(([k, l]) => `<button class="chip${(k === 'unrivaled') === unrMode ? ' on' : ''}" role="tab" data-act="scmode" data-mode="${k}" aria-pressed="${(k === 'unrivaled') === unrMode}">${l}</button>`).join('')}</div>` : '';
    if (unrMode) { HW.v5.refresh = null; const h = await unrivaledList(); if (HW.v5.unrOn ? HW.v5.unrOn() : store.get('v5:scunr', false)) $main.innerHTML = `<div id="unrpage">${modes}<div class="unrbody">${h}</div></div>`; return; }
    const head = modes + strip;
    /* the page is two parts: the date strip, which only moves its highlight from one day to the next (and is rebuilt when
       the window of days shifts), and the list below it, which swaps. A day change never repaints the strip or the screen. */
    const page0 = $main.querySelector('#scpage');
    const inPlace = page0 && page0.dataset.lk === lk;
    const hashOf = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    const paint = body => {
      if (lk === 'wnba' && (HW.v5.unrOn ? HW.v5.unrOn() : store.get('v5:scunr', false))) return;   // switched to Unrivaled while this day was loading
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
    /* v438: three plain sections by where the game stands: Live, then what's still to come, then Final. Your teams
       aren't a section of their own any more; they lead inside each one and carry a star. */
    const staleG = g => g.state !== 'in' && g.state !== 'post' && !g.off && g.timeValid !== false && g.date && Date.now() - new Date(g.date).getTime() > 15 * 60000 && Date.now() - new Date(g.date).getTime() < 5 * 3600000;
    const mineFirst = (x, y) => isFav(y) - isFav(x);
    const live = games.filter(g => (isLive(g) || staleG(g)) && !g.off).sort((a, b) => mineFirst(a, b) || rankGame(b) - rankGame(a));
    const done = games.filter(g => !live.includes(g) && (g.state === 'post' || g.off)).sort((a, b) => mineFirst(a, b) || new Date(b.date) - new Date(a.date));
    const ahead = games.filter(g => !live.includes(g) && !done.includes(g)).sort((a, b) => new Date(a.date) - new Date(b.date) || mineFirst(a, b) || rankGame(b) - rankGame(a));
    const row = g => g.tbd ? `<div class="games">${gameCard(L, g, ctx, false, true)}</div>` : scoreRow(L, g, ctx);
    const block = (title, list, n = 6, cls = '') => list.length ? `<div class="dpsec rlsec${cls}"><b>${title}</b><span>${list.length}</span></div>` + clip(list.map(row), 'srows rlrows', n, 'games') : '';
    const aheadT = ymd === today ? (ahead.every(g => new Date(g.date).getHours() >= 16) ? 'Tonight' : 'Later today') : ymd > today ? 'Scheduled' : 'Not played';
    paint(phase + block('<i class="dot"></i>Live', live, 10, ' lv') + block(aheadT, ahead, 12) + block('Final', done, 10));
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
    const params = L.sbParams.replace(/&limit=\d+/, '');
    /* v408: ESPN no longer answers a start-end range. The pros fit in one month request (dates=202511); a college month
       is too big for it, so college asks one day at a time. */
    const ok = pg => pg && Array.isArray(pg.events);
    const dayList = Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
    const reqs = /^ncaa/.test(L.key) ? dayList.map(d => fetchJson(`${API(L)}/scoreboard?dates=${HW.compact(d)}${params}&limit=400`, 30000))
      : [fetchJson(`${API(L)}/scoreboard?dates=${ym.replace('-', '')}${params}&limit=1000`, 30000)];
    let [scheds, pages] = await Promise.all([
      Promise.all(mine.map(id => jSoft(`${API(L)}/teams/${id}/schedule`, 300000))),
      Promise.all(reqs)
    ]);
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
    if (gl && gl.events && gl.seasonTypes) { const types = gl.seasonTypes.filter(t => /regular/i.test(t.displayName || '')).length ? gl.seasonTypes.filter(t => /regular/i.test(t.displayName || '')) : gl.seasonTypes; types.forEach(stp => (stp.categories || []).forEach(c => (c.events || []).forEach(e => { const meta = gl.events[e.eventId]; if (meta && !/all-star|rising stars/i.test(meta.eventNote || '')) evRows.push({ meta, stats: e.stats || [], id: e.eventId }); }))); evRows.sort((x, y) => new Date(y.meta.gameDate) - new Date(x.meta.gameDate)); }
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

    // career, by season (v437): a card of lifetime numbers, then the season table with a Per game / Totals switch and a
    // Career row from ESPN's own career line (so a season split by a trade isn't counted twice)
    let careerT = '';
    const catOf = re => career && career.categories && career.categories.find(c => re.test(c.name || ''));
    const avgC = cat, totC = catOf(/^totals$/i);
    if (avgC && avgC.statistics && avgC.statistics.length) {
      const al = avgC.labels || [], tl = (totC && totC.labels) || [];
      const ai = k => al.indexOf(k), ti = k => tl.indexOf(k);
      const aCar = avgC.totals || [], tCar = (totC && totC.totals) || [];
      const num = x => { const n = parseFloat(String(x || '').replace(/,/g, '')); return isNaN(n) ? null : n; };
      const big = n => n == null ? '' : Math.round(n).toLocaleString('en-US');
      const tv = k => ti(k) >= 0 ? num(tCar[ti(k)]) : null;
      const gp = ai('GP') >= 0 ? num(aCar[ai('GP')]) : null;
      const seasonsN = new Set(avgC.statistics.map(r => r.season && r.season.year)).size;
      // where they played, in order: "Dallas 2018-22 · New York since 2022"
      const TM = career.teams || {}; const runs = [];
      avgC.statistics.forEach(r => { const y = r.season && r.season.year; const slug = r.teamSlug || ''; const last = runs[runs.length - 1]; if (last && last.slug === slug) last.to = y; else runs.push({ slug, from: y, to: y }); });
      const place = s => { const t = TM[s] || {}; return t.location || t.shortDisplayName || (s ? s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : ''); };
      const yr = y => String(y).slice(-2);
      const thisYr = (avgC.statistics[avgC.statistics.length - 1].season || {}).year;
      const hist = runs.filter(r => r.slug).map((r, k) => { const isNow = k === runs.length - 1 && r.to === thisYr && runs.length > 1; return isNow ? `${place(r.slug)} since ${r.from - 1}` : `${place(r.slug)} ${r.from - 1}-${yr(r.to)}`; }).join(' · ');
      const cells = [['Points', big(tv('PTS'))], ['Assists', big(tv('AST'))], ['Rebounds', big(tv('REB'))], ['Steals', big(tv('STL'))], ['Blocks', big(tv('BLK'))], [college ? 'PPG' : 'PPG', ai('PTS') >= 0 && aCar[ai('PTS')] ? String(aCar[ai('PTS')]) : '']].filter(([, x]) => x !== '');
      const pct = [['FG', 'FG%'], ['3PT', '3P%'], ['FT', 'FT%']].map(([l, k]) => ai(k) >= 0 && aCar[ai(k)] ? `<span>${l} <b>${esc(String(aCar[ai(k)]))}%</b></span>` : '').join('');
      const careerCard = cells.length >= 3 ? `<div class="pcar"><div class="pcarg">${cells.map(([l, x]) => `<div><b>${esc(x)}</b><small>${esc(l)}</small></div>`).join('')}</div>${pct ? `<div class="pcarp">${pct}</div>` : ''}${hist && runs.length > 1 ? `<div class="pcarh">${esc(hist)}</div>` : ''}</div>` : '';
      // the season table: the same seasons as per-game averages or as totals
      const AV = [['GP', 'GP'], ['PTS', 'PTS'], ['REB', 'REB'], ['AST', 'AST'], ['STL', 'STL'], ['BLK', 'BLK'], ['FG%', 'FG%'], ['3P%', '3P%'], ['FT%', 'FT%']].filter(([k]) => ai(k) >= 0);
      const TT = [['GP', 'GP', 'a'], ['PTS', 'PTS', 't'], ['REB', 'REB', 't'], ['AST', 'AST', 't'], ['STL', 'STL', 't'], ['BLK', 'BLK', 't'], ['3PT', '3PM', 't3'], ['FG%', 'FG%', 'a'], ['3P%', '3P%', 'a'], ['FT%', 'FT%', 'a']].filter(([k, , s]) => s === 'a' ? ai(k) >= 0 : ti(k) >= 0);
      const totRows = totC && totC.statistics || [];
      const totOf = (r, idx) => totRows[idx] && (totRows[idx].season || {}).year === (r.season || {}).year && totRows[idx].teamSlug === r.teamSlug ? totRows[idx] : totRows.find(x => (x.season || {}).year === (r.season || {}).year && x.teamSlug === r.teamSlug);
      const rowsA = avgC.statistics.map((r, idx) => ({ r, t: totOf(r, idx) })).reverse();
      const fmtT = (k, s, r, t) => { if (s === 'a') return esc(r.stats[ai(k)] || ''); if (!t) return '–'; const x = t.stats[ti(k)]; if (s === 't3') return esc(String(x || '').split('-')[0] || '–'); const n = num(x); return n == null ? esc(x || '') : Math.round(n).toLocaleString('en-US'); };
      const seasonCell = r => `<td>${esc(r.season && (r.season.displayName || r.season.year) || '')} <span class="mut" style="color:var(--ink-3)">${esc(((TM[r.teamSlug] || {}).abbreviation || (r.teamSlug || '').slice(0, 3)).toUpperCase())}</span></td>`;
      const avgT = `<table class="tbl pcart"><thead><tr><th>Season</th>${AV.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rowsA.map(({ r }, n) => `<tr${n === 0 ? ' class="hi"' : ''}>${seasonCell(r)}${AV.map(([k]) => `<td>${k === 'PTS' ? `<b>${esc(r.stats[ai(k)])}</b>` : esc(r.stats[ai(k)])}</td>`).join('')}</tr>`).join('')}${aCar.length ? `<tr class="pcarr"><td>Career</td>${AV.map(([k]) => `<td>${esc(aCar[ai(k)] || '')}</td>`).join('')}</tr>` : ''}</tbody></table>`;
      const totT = totC ? `<table class="tbl pcart"><thead><tr><th>Season</th>${TT.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rowsA.map(({ r, t }, n) => `<tr${n === 0 ? ' class="hi"' : ''}>${seasonCell(r)}${TT.map(([k, , s]) => `<td>${k === 'PTS' ? `<b>${fmtT(k, s, r, t)}</b>` : fmtT(k, s, r, t)}</td>`).join('')}</tr>`).join('')}<tr class="pcarr"><td>Career</td>${TT.map(([k, , s]) => { if (s === 'a') return `<td>${esc(aCar[ai(k)] || '')}</td>`; const x = tCar[ti(k)]; if (s === 't3') return `<td>${esc(String(x || '').split('-')[0] || '')}</td>`; const n = num(x); return `<td>${n == null ? esc(x || '') : Math.round(n).toLocaleString('en-US')}</td>`; }).join('')}</tr></tbody></table>` : '';
      const mode = store.get('v5:pcarm', 'avg') === 'tot' && totT ? 'tot' : 'avg';
      const tog = totT ? `<div class="pcartog" role="tablist"><button data-act="pcarm" data-m="avg" class="${mode === 'avg' ? 'on' : ''}">Per game</button><button data-act="pcarm" data-m="tot" class="${mode === 'tot' ? 'on' : ''}">Totals</button></div>` : '';
      careerT = `<div class="sec pcarsec"><h2>Career${gp ? `<small>${seasonsN} season${seasonsN === 1 ? '' : 's'} · ${Math.round(gp).toLocaleString('en-US')} games</small>` : ''}</h2></div>` + careerCard
        + `<div class="sec pcarsec"><h2>By season</h2>${tog}</div><div class="pcarw" data-m="${mode}"><div class="tw pcar-avg">${avgT}</div>${totT ? `<div class="tw pcar-tot">${totT}</div>` : ''}</div>`;
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
      stats: (careerT + splitsT + cutsT + (evRows.length && L.sport === 'basketball' ? sec('Shot chart', `last ${Math.min(5, evRows.length)} game${Math.min(5, evRows.length) === 1 ? '' : 's'}`) + `<div class="pshots"><div class="rows"><button class="row" data-act="pshots" data-lk="${lk}" data-pid="${esc(String(id))}" data-name="${esc(a.displayName || '')}" data-color="${esc(color)}" data-games="${esc(evRows.slice(0, 5).map(r => r.id).join(','))}"><span class="t"><b>Show the shot chart</b><span class="wrap">Every attempt from the last ${Math.min(5, evRows.length)} games, on the court</span></span>${chev}</button></div></div>` : '') + fullLog) || empty('No stats yet', '<p style="margin:6px 0 0">Stats start with the first game of the season.</p>'),
      bio: (injury ? sec('Injury') + injT : '') + (aboutT || sec('About') + empty('Nothing on file', '<p style="margin:6px 0 0">The feed has no bio for this player yet.</p>')),
      news: (moments + (stories.length ? sec('Stories') + `<div class="rows">${stories.map(n => HW.v5.newsRow(lk, n)).join('')}</div>` : '')) || empty('Nothing recent', '<p style="margin:6px 0 0">No stories or clips on this player in the feed right now.</p>')
    };
    const ptab = 'summary';   // every player opens on Overview
    const ptabs = `<div class="chips ptabs" role="tablist" style="padding-top:14px">${[['summary', 'Overview'], ['stats', 'Stats'], ['bio', 'Bio'], ['news', 'News']].map(([k, l]) => `<button class="chip${k === ptab ? ' on' : ''}" role="tab" data-act="ptab" data-tab="${k}" aria-selected="${k === ptab}" aria-pressed="${k === ptab}">${l}</button>`).join('')}</div>`;
    const pSub = `${tm.id ? `<a href="${href.team(lk, tm.id)}">${esc(tm.shortDisplayName || tm.name || '')}</a>` : ''}${[a.jersey ? `#${a.jersey}` : '', posWordP].filter(Boolean).map(x => ` · ${esc(x)}`).join('')}`.replace(/^ · /, '');
    const pHead = apHead({ color, alt: teamAlt({ id: tm.id, abbr: tm.abbreviation, alt: tm.alternateColor }, L), name: a.displayName || '', sub: pSub, img: a.headshot && a.headshot.href, face: true, back: '#home', star: { on: following, attrs: `data-act="follow-player" data-snap='${esc(JSON.stringify(snap))}'` }, share: a.displayName || '', badge: L.sport === 'basketball' && HW.rating ? `<span class="aprt" data-pid="${esc(String(id))}"></span>` : '' });
    $main.innerHTML = `<div class="approf">` + pHead + `<div class="lb-slot"></div><div class="aptabs">${ptabs}</div><div class="pgstrip">` + Object.entries(panels).map(([k, html]) => `<div data-ptab-panel="${k}" data-pg="${k}"${k === ptab ? '' : ' hidden'}>${html}</div>`).join('') + `</div></div>`;
    if (HW.v5._ptabL) $main.removeEventListener('click', HW.v5._ptabL);
    HW.v5._ptabL = e => { const b = e.target.closest('[data-act="ptab"]'); if (!b) return; e.preventDefault(); const k = b.dataset.tab; if (HW.v5._pg && $main.querySelector('.pgr')) { HW.v5._pg.go(k); const tb = $main.querySelector('.aptabs'); if (tb && !b.closest('.aptabs')) window.scrollTo({ top: Math.max(0, window.scrollY + tb.getBoundingClientRect().top - 56), behavior: 'smooth' }); return; } $main.querySelectorAll('[data-act="ptab"]').forEach(x => { const on = x.dataset.tab === k; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-selected', String(on)); }); $main.querySelectorAll('[data-ptab-panel]').forEach(p => { const on = p.dataset.ptabPanel === k; if (on && p.hidden && HW.v5.soft) { p.hidden = false; HW.v5.soft(p); } else p.hidden = !on; }); const tb = $main.querySelector('.aptabs'); if (tb) { const y = tb.getBoundingClientRect().top; if (y < 60 || !b.closest('.aptabs')) window.scrollTo(0, Math.max(0, window.scrollY + y - 56)); } };
    $main.addEventListener('click', HW.v5._ptabL);
    { const tb = $main.querySelector('.aptabs'), sp = $main.querySelector('.pgstrip'); const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--apb')) || 56; HW.v5._pg = pager(tb, { tabs: tb, strip: sp, start: ptab, stickTop: bar, onShow: k => store.set('v5:ptab', k) }); }
    document.title = `${a.displayName} · RIVL`;
    /* the RIVL rating: one number on the 40-99 scale with a line on what stands out, then the six traits as bars, each the
       share of players at his position he beats; a tap on a trait opens the numbers behind it */
    if (L.sport === 'basketball' && HW.rating) {
      const fill = R => { const bd = R && $main.querySelector(`.aprt[data-pid="${CSS.escape(String(id))}"]`); if (bd && bd.dataset.v !== String(R.ovr)) { bd.dataset.v = String(R.ovr); bd.innerHTML = `<b>${R.ovr}</b>RIVL rating`; bd.className = `aprt on ${R.ovr >= 90 ? 't5' : R.ovr >= 80 ? 't4' : R.ovr >= 70 ? 't3' : R.ovr >= 60 ? 't2' : 't1'}`; bd.title = 'RIVL rating'; }
        const el = $main.querySelector(`.prate2[data-pid="${CSS.escape(String(id))}"]`); if (!el || !R) return; const key = String(R.ovr) + R.traits.map(t => t.pct).join(); if (el.dataset.k === key) return; el.dataset.k = key;
        const tier = o => o >= 90 ? 't5' : o >= 80 ? 't4' : o >= 70 ? 't3' : o >= 60 ? 't2' : 't1'; const g = Object.assign({}, R.raw || {});
        /* v426: the rating's numbers come from the data file, rebuilt a few times a day; this page's own game log comes
           straight from the feed. When the log is ahead (a game since the file was built), the card shows the log's count and average */
        if (evRows.length > (g.gp || 0) && gi('PTS') >= 0) { const pv = evRows.map(r => parseFloat(r.stats[gi('PTS')])).filter(Number.isFinite); if (pv.length === evRows.length) { g.gp = evRows.length; g.pts = pv.reduce((t, x) => t + x, 0) / pv.length; } }
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
  /* v428 Glass: the head is an aurora in the team's own colours (the deep primary as the ground, the alternate colour and a lifted
     primary as two soft lights, a darker pool low down) under film grain. The crest sits on a frosted tile, or the face in a ring,
     centred over the name; up to three glass tiles carry the numbers that matter. alt picks the second light; a missing,
     white or near-black alternate falls back to the lifted primary so every team gets two lights of its own hue. */
  const glassVars = (c, alt) => {
    let d = c; for (let k = 0; k < 8 && lumOf(d) > .2; k++) d = mixTo(d, 0, .2);
    const lift = V_vivid(c, true);
    const a2 = alt && !BAD(alt) && lumOf(alt) > .12 && lumOf(alt) < .92 && rgbDist(alt, c) > 60 ? alt : lift;
    return `--a:${esc(c)};--ad:${esc(d)};--a2:${esc(a2)};--a3:${esc(lift)}`;
  };
  function apHead({ color, name, sub, img, face = false, back = '#home', star, share, badge = '', kicker = '', alt = '', tiles = [] }) {
    const c = BAD(color) ? '#3A3D44' : color; let d = c; for (let k = 0; k < 8 && lumOf(d) > .22; k++) d = mixTo(d, 0, .18);
    const pic = img ? (face ? `<span class="apface"><img src="${esc(img)}" alt="" loading="eager" onerror="this.remove()"></span>` : `<span class="apcrest">${imgSized(img, 200, 200, 'alt=""')}</span>`) : '';
    const tl = tiles.filter(t => t && t.v);
    const tilesH = tl.length ? `<div class="aptl">${tl.map(t => `<div><b>${esc(t.v)}</b><span>${esc(t.l)}</span></div>`).join('')}</div>` : '';
    return `<header class="aph glass${face ? ' apf' : ''}" style="${glassVars(c, alt)}"><i class="apau" aria-hidden="true"></i><i class="apgr" aria-hidden="true"></i><div class="aptop"><a class="apb" href="${back}" data-act="back" aria-label="Back">${apIcons.back}</a><span class="apsp"></span>${star ? `<button class="apb star${star.on ? ' on' : ''}" ${star.attrs} aria-pressed="${star.on}" aria-label="${star.on ? 'Unfollow' : 'Follow'}">${star.on ? apIcons.starOn : apIcons.starOff}</button>` : ''}${share ? `<button class="apb" data-act="share" data-title="${esc(share)}" aria-label="Share">${apIcons.share}</button>` : ''}</div>`
      + `<div class="apid">${pic}<div class="apnm">${kicker ? `<em>${kicker}</em>` : ''}<h1 class="${String(name).length > 18 ? 'long' : ''}">${esc(name)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${badge}</div>${tilesH}</header>`
      + apBar(c, d, name, img, face, back, star);
  }
  function apBar(c, d, name, img, face, back, star) {
    const starB = star ? `<button class="apb sm star${star.on ? ' on' : ''}" ${star.attrs} aria-pressed="${star.on}" tabindex="-1" aria-hidden="true">${star.on ? apIcons.starOn : apIcons.starOff}</button>` : '';
    return `<div class="apfx" style="--a:${esc(c)};--ad:${esc(d)}" aria-hidden="true"><a class="apb" href="${back}" data-act="back" aria-label="Back" tabindex="-1">${apIcons.back}</a>${img ? (face ? `<span class="apface s"><img src="${esc(img)}" alt="" onerror="this.remove()"></span>` : `<span class="apcrest s">${imgSized(img, 64, 64, 'alt=""')}</span>`) : ''}<b>${esc(name)}</b><span class="apsp"></span>${starB}</div>`;
  }
  // the slim bar shows once the head has scrolled away
  { let raf = 0; const run = () => { raf = 0; const h = document.querySelector('#main .aph'), fx = document.querySelector('#main .apfx'); if (!h || !fx) return; const on = h.getBoundingClientRect().bottom <= fx.offsetHeight + 1; if (fx.classList.contains('on') !== on) fx.classList.toggle('on', on); };   // v412: the bar takes over the moment the header no longer covers its space
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(run); }, { passive: true }); document.addEventListener('rivl:rendered', run); }
  HW.v5 = Object.assign(HW.v5 || {}, { feedSrc, initDecks, unrivaledCard, unrivaledList, home, scores, todayPill, player, players, playerPicker, rosterOf, monthGames, lastName, fplayers, prefs, teamInfo, teamsIndex, gameCard, heroCard, storyOpen,
    _: { pager, duelPair, panelLogo, nearPanel, duelCard, duelBlock, deepen, h: H, logo, headshot, chev, sec, empty, skeleton, href, safeF, gameCard, heroCard, teamInfo, teamsIndex, fplayers, prefs, starSvg, starLine, tvLabel, teamColor, teamAlt, playerColor, tcv, distinctPalette, tint, V_lift, V_deep, V_panel, V_vivid, pairColors, dragOrder, orderTools, foldToggle, learn, statusWord, seriesLine, seriesShort, seriesPick, seriesPickText, confName, dayUTC, athId, hsUrl, initials, retInfo, scVars, scoreColor, lift: V_lift, deep: V_deep, sized, imgSized, tagWord, scoreRow, mixTo, lumOf, rgbDist, clip, injRow, apHead, apIcons } });
})();
