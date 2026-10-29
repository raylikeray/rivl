/* RIVL — the rest of the season, played out thousands of times.
   The schedule comes from data/<league>/schedule.json (written nightly by the tipoff job: every game of the season, compact)
   and, when that file is missing or stale, from ESPN's scoreboard a month at a time for the games still to come. Each
   remaining game is decided by RIVL's own forecast (the rating gap and home court through the same spread and calibration
   the game pages use); the finished games are the standings as they are. Ties within a simulation go to the head-to-head
   record where it is known, then to a coin. */
(() => {
  'use strict';
  const HW = window.HW;
  const { LEAGUES, jSoft, todayCT, addDays, compact, store, API, Phi } = HW;
  const DAY = () => todayCT();
  const SEASON_END = { nba: '-04-20', wnba: '-09-20' };   // the last day a regular-season game could be on
  const seasonEnd = L => { const y = +L.seasonStart.slice(0, 4); return (L.key === 'nba' ? y + 1 : y) + SEASON_END[L.key]; };
  const mem = {};

  /* ---------- the schedule ---------- */
  function compactEvent(e) {
    const c = e.competitions && e.competitions[0]; if (!c) return null;
    const home = (c.competitors || []).find(x => x.homeAway === 'home'), away = (c.competitors || []).find(x => x.homeAway === 'away');
    if (!home || !away || !home.team || !away.team) return null;
    const st = (c.status || e.status || {}).type || {}; const sc = x => x.score != null && x.score !== '' ? +(typeof x.score === 'object' ? x.score.displayValue : x.score) : null;
    const note = c.notes && c.notes[0] && c.notes[0].headline || '';
    return { id: String(e.id), d: HW.ymdOf(e.date), h: String(home.team.id), a: String(away.team.id), hs: sc(home), as: sc(away), st: st.state || 'pre', n: c.neutralSite ? 1 : 0, t: e.season && e.season.type != null ? +e.season.type : 2, x: /championship/i.test(note) && /cup|tournament/i.test(note) ? 1 : 0 };
  }
  /* the nightly file: used when it covers this season and is less than two days old */
  async function published(L) {
    const d = await jSoft(`${HW.DATA || 'data/'}${L.key}/schedule.json?d=${DAY()}`, 1800000);
    if (!d || !Array.isArray(d.games) || d.season !== L.seasonStart) return null;
    const age = d.generated ? (Date.now() - new Date(d.generated)) / 864e5 : 99; if (age > 2.5) return null;
    return { games: d.games, source: 'nightly', generated: d.generated };
  }
  /* the fallback: the games still to come, a month at a time (a week at a time when a month is too much for the feed) */
  async function fromFeed(L, onProgress) {
    const today = DAY(), end = seasonEnd(L); if (today > end) return { games: [], source: 'feed' };
    const months = []; let d = today; while (d <= end) { const m = d.slice(0, 7); const [y, mo] = m.split('-').map(Number); const last = new Date(Date.UTC(y, mo, 0)).getUTCDate(); months.push([d, `${m}-${String(last).padStart(2, '0')}` > end ? end : `${m}-${String(last).padStart(2, '0')}`]); d = addDays(`${m}-${String(last).padStart(2, '0')}`, 1); }
    const params = L.sbParams.replace(/&limit=\d+/, '');
    const span = ([a, b], lim) => jSoft(`${API(L)}/scoreboard?dates=${compact(a)}-${compact(b)}${params}&limit=${lim}`, 3600000);
    const games = []; let i = 0;
    for (const m of months) {
      let pg = await span(m, 1000);
      if (!pg || !Array.isArray(pg.events) || pg.events.length >= 1000) {   // too much in one go: week by week
        const evs = []; let a = m[0]; while (a <= m[1]) { const b = addDays(a, 6) > m[1] ? m[1] : addDays(a, 6); const w = await span([a, b], 400); if (w && Array.isArray(w.events)) evs.push(...w.events); a = addDays(b, 1); }
        pg = { events: evs };
      }
      (pg.events || []).forEach(e => { const g = compactEvent(e); if (g) games.push(g); });
      i++; if (onProgress) onProgress(i / months.length);
    }
    const seen = new Set(); return { games: games.filter(g => !seen.has(g.id) && seen.add(g.id)), source: 'feed' };
  }
  async function schedule(L, { onProgress, feed = true } = {}) {
    const key = `${L.key}:${DAY()}`; if (mem[key]) return mem[key];
    let out = await published(L);
    if (!out) { const cached = store.get(`v5:sched:${L.key}`, null); if (cached && cached.day === DAY() && Array.isArray(cached.games)) out = { games: cached.games, source: cached.source || 'feed' }; }
    if (!out && !feed) return null;   // nothing cheap on hand; the caller decides whether to go to the feed
    if (!out) { out = await fromFeed(L, onProgress); try { store.set(`v5:sched:${L.key}`, { day: DAY(), games: out.games, source: out.source }); } catch { } }
    mem[key] = out; return out;
  }
  const ready = L => !!mem[`${L.key}:${DAY()}`];
  /* the simulation for a league, run once a day and kept */
  const simMem = {};
  async function season(L, opts = {}) {
    const key = `${L.key}:${DAY()}`; if (simMem[key]) return simMem[key];
    const sched = await schedule(L, opts); if (!sched) return null;
    const ctx = await HW.forecastCtx(L, DAY()).catch(() => null); if (!ctx || !ctx.cur) return null;
    const live = {}; (HW.S.today[L.key] || []).forEach(g => { if (g.state === 'in') { try { live[g.id] = HW.forecast(L, g, ctx).pHome; } catch { } } });
    const sim = simulate(L, ctx, sched, { live }); if (!sim) return null;
    const rest = restOf(L, ctx, sched);
    const v = { sim, rest, sched, ctx, byId: Object.fromEntries(sim.teams.map(t => [t.id, t])) };
    simMem[key] = v; return v;
  }

  /* ---------- the simulation ---------- */
  /* pregame chance for the home side from the ratings alone: the same spread and calibration the forecast uses */
  function pHomeOf(L, ctx, h, a, neutral) {
    const H = HW.strength(L, h, ctx), A = HW.strength(L, a, ctx); const P = HW.paramsOf(L, ctx);
    return HW.calibrate(Phi(((H.rating - A.rating) + (neutral ? 0 : P.hca)) / P.sd), P.calib);
  }
  const SEASON_GAMES = { nba: 82, wnba: 44 };
  /* a normal draw (Box–Muller) */
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  function simulate(L, ctx, sched, { n = 2000, today = DAY(), live = {} } = {}) {
    const cur = ctx && ctx.cur; if (!cur || !cur.byId) return null;
    const teams = Object.values(cur.byId).filter(r => r.id); const ids = teams.map(r => r.id); const ix = new Map(ids.map((id, i) => [id, i])); const T = ids.length;
    // each team's rating, and how sure it is: early in the season a rating is a guess with a few points of give, so every
    // run of the season draws its own version of each team around it (about 3 points after 5 games, half that by midseason)
    const P = HW.paramsOf(L, ctx); const rat = new Float64Array(T), give = new Float64Array(T);
    teams.forEach((r, i) => { const st = HW.strength(L, r.id, ctx); rat[i] = st.rating; const gp = (r.w || 0) + (r.l || 0); give[i] = 3.4 * Math.sqrt(8 / (gp + 8)); });
    const pOf = (hi, ai, neutral, off) => HW.calibrate(Phi(((rat[hi] + off[hi]) - (rat[ai] + off[ai]) + (neutral ? 0 : P.hca)) / P.sd), P.calib);
    const regular = sched.games.filter(g => g.t === 2 && !g.x && ix.has(g.h) && ix.has(g.a) && !(g.st === 'post' && (g.hs == null || g.as == null)));   // a postponed game (post, no score) comes back on its new date
    // head-to-head so far, from the finished games the schedule carries
    const h2h = new Int16Array(T * T); regular.filter(g => g.st === 'post' && g.hs != null && g.as != null).forEach(g => { const hi = ix.get(g.h), ai = ix.get(g.a); if (g.hs > g.as) h2h[hi * T + ai]++; else h2h[ai * T + hi]++; });
    const known = regular.some(g => g.st === 'post');
    // what is left: games not final, decided by the forecast (a game in progress by its live chance when the caller has one)
    const left = regular.filter(g => g.st !== 'post' && g.d >= addDays(today, -1)).map(g => ({ hi: ix.get(g.h), ai: ix.get(g.a), n: !!g.n, p: live[g.id] != null ? live[g.id] : null }));
    const remaining = new Array(T).fill(0); left.forEach(g => { remaining[g.hi]++; remaining[g.ai]++; });
    // the format: conferences with a play-in (NBA) or one league table (WNBA)
    const conf = L.standingsMode === 'conference'; const cut = L.playoffLine || []; const top = cut[0] || 0, playIn = cut.length === 2 ? cut[1] : 0;
    const groups = conf ? [...new Set(teams.map(r => r.group))].map(gname => teams.filter(r => r.group === gname).map(r => ix.get(r.id))) : [ids.map((_, i) => i)];
    const out = teams.map(r => ({ id: r.id, w: 0, top: 0, playin: 0, playoffs: 0, first: 0, seeds: new Array(Math.max(16, T)).fill(0), remaining: remaining[ix.get(r.id)] }));
    const w0 = teams.map(r => r.w || 0), l0 = teams.map(r => r.l || 0);
    const wins = new Float64Array(T), hh = new Int16Array(T * T), off = new Float64Array(T), rnd = Math.random;
    const cmp = (x, y) => wins[y] - wins[x] || (hh[y * T + x] - hh[x * T + y]) || (rnd() < .5 ? -1 : 1);
    for (let s = 0; s < n; s++) {
      wins.set(w0); hh.set(h2h); for (let i = 0; i < T; i++) off[i] = gauss() * give[i];
      for (let k = 0; k < left.length; k++) { const g = left[k]; const p = g.p != null ? g.p : pOf(g.hi, g.ai, g.n, off); if (rnd() < p) { wins[g.hi]++; hh[g.hi * T + g.ai]++; } else { wins[g.ai]++; hh[g.ai * T + g.hi]++; } }
      for (let i = 0; i < T; i++) out[i].w += wins[i];
      groups.forEach(gr => {
        const order = gr.slice().sort(cmp);
        order.forEach((ti, pos) => { const o = out[ti]; o.seeds[pos]++; if (pos === 0) o.first++; if (top && pos < top) { o.top++; o.playoffs++; } else if (playIn && pos < playIn) { o.playin++; } });
        if (playIn && order.length >= playIn) {   // the play-in: 7 hosts 8 for the 7 seed; 9 hosts 10, the winner visits the 7–8 loser for the 8 seed
          const [s7, s8, s9, s10] = [order[top], order[top + 1], order[top + 2], order[top + 3]];
          const win = (h, a) => rnd() < pOf(h, a, false, off) ? h : a;
          const w78 = win(s7, s8), l78 = w78 === s7 ? s8 : s7; const w910 = win(s9, s10); const w8 = win(l78, w910);
          out[w78].playoffs++; out[w8].playoffs++;
        }
      });
    }
    // games the schedule doesn't carry yet (the NBA Cup's knockout and make-up dates land in December) are projected at the team's own pace
    const full = SEASON_GAMES[L.key] || 0;
    const games = w0.map((w, i) => w + l0[i] + remaining[i]);
    return { n, left: left.length, known, teams: out.map((o, i) => { const w = o.w / n; const g = games[i]; const wF = full > g && g ? w * full / g : w; const gF = full > g ? full : g; return { id: o.id, w: wF, l: gF - wF, games: gF, scheduled: g, remaining: o.remaining, top: o.top / n, playin: o.playin / n, playoffs: o.playoffs / n, first: o.first / n, seeds: o.seeds.map(v => v / n) }; }) };
  }
  /* what is left for each team: how many games, how many at home, and how strong the opponents are (rating, home-court adjusted) */
  function restOf(L, ctx, sched, today = DAY()) {
    const cur = ctx && ctx.cur; if (!cur || !cur.byId) return {};
    const left = sched.games.filter(g => g.t === 2 && !g.x && g.st !== 'post' && g.d >= addDays(today, -1) && cur.byId[g.h] && cur.byId[g.a]);
    const P = HW.paramsOf(L, ctx); const r = id => HW.strength(L, id, ctx).rating;
    const out = {}; const add = (id, opp, home, neutral) => { const o = out[id] || (out[id] = { n: 0, home: 0, sum: 0, h2h: {} }); o.n++; if (home) o.home++; o.sum += r(opp) + (neutral ? 0 : home ? -P.hca : P.hca); };
    left.forEach(g => { add(g.h, g.a, true, !!g.n); add(g.a, g.h, false, !!g.n); });
    Object.values(out).forEach(o => { o.opp = o.n ? o.sum / o.n : 0; });
    return out;
  }
  /* head-to-head between two teams this season, from the finished games the schedule carries (null when it carries none) */
  function h2hOf(sched, a, b) {
    const games = sched.games.filter(g => g.t === 2 && !g.x && g.st === 'post' && g.hs != null && g.as != null && ((g.h === a && g.a === b) || (g.h === b && g.a === a)));
    if (!sched.games.some(g => g.st === 'post')) return null;
    let wa = 0, wb = 0; games.forEach(g => { const aWon = (g.h === a && g.hs > g.as) || (g.a === a && g.as > g.hs); if (aWon) wa++; else wb++; });
    return { wa, wb, played: games.length };
  }
  HW.sim = { schedule, simulate, restOf, h2hOf, seasonEnd, season, ready };
})();
