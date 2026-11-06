/* RIVL player rating
   ------------------------------------------------------------------------------------------------------------------
   One number on NBA 2K's 40-99 scale and six traits shown as percentiles, all computed from the box score. No name
   value, no contract, no hand-tuned bumps: change a player's stats and only his rating moves.

   1. RATES, NOT TOTALS. Every counting stat becomes a per-36-minute rate, so a starter and a reserve are judged on what
      they do with the floor time they get. Volume still counts, separately, where it matters (points and a game score
      per game, minutes per game as the coach's own vote).

   2. SHRINKAGE (empirical Bayes). A small sample says little, so every rate is pulled toward what we already believe:
         estimate = (this season x minutes + last season x w x last minutes + position average x K) / (minutes + w x last minutes + K)
      K is how much evidence a stat needs before it speaks for itself. Shooting percentages are shrunk on attempts, not
      minutes, with the slow-to-settle ones held hardest (3P% on 650 attempts, FT% on 200, true shooting on 450, close to where research finds each one starts to mean something). w fades
      last season out as this one fills in. A rookie or an early-season hot streak lands near the position norm until
      the minutes back it up.

   3. COMPARED TO HIS POSITION. Guards, forwards and centers are three pools, so a point guard isn't marked down for not
      rebounding like a center. Each feature becomes a z-score inside its pool (clipped at +-3.5 so one freak stat can't
      run away with a trait), and each trait is a weighted blend of its features.

   4. TRAIT PERCENTILES are the share of qualified players at his position he beats on that trait (ties split), 1 to 99.

   5. OVERALL weights the traits by what goes with winning: impact most, then scoring and playmaking, then shooting,
      defense and rebounding, plus the minutes his coach trusts him with. Impact is judged league-wide, not by position.

   6. THE 2K SCALE. The overall composite is ranked against every qualified player and mapped onto 2K's spread: the
      median regular is a 74, the top 15% start at 82, the top 3% at 90. Above the 99th percentile the number follows
      the real gap to the league's best, so the best player is a 99 and a clear second is not.

   Defense is the weakest trait any box-score system can give (steals, blocks, defensive boards, fouls, and the team's
   defense while he plays). It is labelled that way where it is shown. */
(function () {
  'use strict';
  const POS = p => { p = String(p || '').toUpperCase(); if (/^(C|F-C|C-F)$/.test(p)) return 'C'; if (/^(PG|SG|G)$/.test(p)) return 'G'; if (/^(SF|PF|F|G-F|F-G)$/.test(p)) return 'F'; return 'F'; };
  const POS_WORD = { G: 'guards', F: 'forwards', C: 'centers' };
  const K = { pts: 300, ast: 300, reb: 250, oreb: 350, dreb: 250, stl: 700, blk: 500, tov: 400, pf: 400, tsa: 300, tpa: 350, gms: 400 };
  const KA = { ts: 450, tp: 650, ft: 200 };
  const CAP = 3.5;
  const TRAITS = [
    ['scoring', 'Scoring', [['ppg', .45], ['pts36', .20], ['added36', .35]]],
    ['shooting', 'Shooting', [['ts', .40], ['tp', .25], ['tpa36', .15], ['ft', .20]]],
    ['playmaking', 'Playmaking', [['ast36', .50], ['apg', .20], ['atov', .30]]],
    ['rebounding', 'Rebounding', [['oreb36', .35], ['dreb36', .45], ['rpg', .20]]],
    ['defense', 'Defense', [['stl36', .32], ['blk36', .30], ['dreb36', .10], ['pf36', -.08], ['tdef', .20]]],
    ['impact', 'Impact', [['gms36', .50], ['gmspg', .25], ['tnet', .25]]]
  ];
  const OVERALL = { impact: .30, scoring: .17, playmaking: .13, shooting: .11, defense: .10, rebounding: .07, role: .12 };
  const MAP = [[0, 58], [.10, 64], [.30, 70], [.50, 74], [.70, 78], [.85, 82], [.93, 86], [.97, 90], [.99, 94]];

  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  const mean = (a, w) => { let s = 0, t = 0; a.forEach((x, i) => { const ww = w ? w[i] : 1; s += x * ww; t += ww; }); return t ? s / t : 0; };
  const sd = (a, m) => { if (a.length < 2) return 1; const v = a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1); return Math.sqrt(v) || 1; };
  const clip = z => Math.max(-CAP, Math.min(CAP, z));

  /* totals for one season's row: per-game values times games, with the gaps in the feed filled sensibly */
  function totals(r) {
    if (!r || !(r.gp > 0) || !(r.min > 0)) return null;
    const g = r.gp, m = r.min * g;
    const fga = num(r.fga) ?? 0, fta = num(r.fta) ?? 0;
    const ftm = num(r.ftm) ?? (fta * (r.ft > 1 ? r.ft / 100 : r.ft || 0));
    const tpm = num(r.tpm) ?? 0;
    const tpa = num(r.tpa) ?? (r.tp > 0 ? tpm / (r.tp > 1 ? r.tp / 100 : r.tp) : 0);
    const fgm = num(r.fgm) ?? (fga * (r.fg > 1 ? r.fg / 100 : r.fg || 0));
    let oreb = num(r.oreb), dreb = num(r.dreb); const split = oreb == null || dreb == null;
    if (split) { const share = { G: .12, F: .22, C: .30 }[POS(r.pos)]; oreb = r.reb * share; dreb = r.reb - oreb; }
    return { g, m, mpg: r.min, pts: r.pts * g, ast: r.ast * g, reb: r.reb * g, oreb: oreb * g, dreb: dreb * g, stl: r.stl * g, blk: r.blk * g, tov: r.tov * g,
      pf: (num(r.pf) ?? 2.2 * r.min / 36) * g, fga: fga * g, fta: fta * g, ftm: ftm * g, fgm: fgm * g, tpm: tpm * g, tpa: tpa * g, split, pfKnown: num(r.pf) != null };
  }

  function compute(rows, prevRows, opts = {}) {
    const teams = opts.teams || {};
    const prevBy = {}; (prevRows || []).forEach(r => { prevBy[r.id] = r; });
    const P = rows.map(r => ({ r, t: totals(r), pos: POS(r.pos), pt: totals(prevBy[r.id]) })).filter(x => x.t);
    if (!P.length) return { byId: {}, n: 0 };

    // league shooting baselines and team games (for the share of minutes)
    const sum = k => P.reduce((s, x) => s + x.t[k], 0);
    const tsa = x => x.fga + .44 * x.fta;
    const lgTS = sum('pts') / (2 * (sum('fga') + .44 * sum('fta')) || 1), lg3 = sum('tpm') / (sum('tpa') || 1), lgFT = sum('ftm') / (sum('fta') || 1);
    let prTS = lgTS, pr3 = lg3, prFT = lgFT;   // shooting priors, set to the bench's once the pool is known
    const teamG = {}; P.forEach(x => { teamG[x.r.teamId] = Math.max(teamG[x.r.teamId] || 0, x.t.g); });

    // the qualified pool: real minutes in real games. Early on the bar is lower.
    const maxG = Math.max(...P.map(x => x.t.g));
    const qual = x => x.t.g >= Math.max(1, Math.round(maxG * .35)) && x.t.mpg >= 12;
    let pool = P.filter(qual); if (pool.length < 30) pool = P.slice().sort((a, b) => b.t.m - a.t.m).slice(0, Math.min(P.length, 60));

    // the position average per-36 rate of each counting stat, minutes-weighted, from the pool
    /* the prior is what a bench player at his position produces (the pool's lower half by minutes), not the average starter:
       players who barely play are usually below average, so an unproven player starts there and has to earn his way up */
    const byM = P.map(x => x.t.m).sort((a, b) => a - b), cutM = byM[Math.floor(byM.length * .4)];
    const bench = P.filter(x => x.t.m <= cutM && x.t.m >= 60);   // the league's lightest-used 40%, past a handful of minutes
    const posMean = {}; ['G', 'F', 'C'].forEach(p => { const ps = bench.filter(x => x.pos === p); const src = ps.length >= 5 ? ps : bench.length >= 5 ? bench : pool; const M = src.reduce((s, x) => s + x.t.m, 0) || 1;
      posMean[p] = {}; ['pts', 'ast', 'reb', 'oreb', 'dreb', 'stl', 'blk', 'tov', 'pf', 'fga', 'fta', 'tpa'].forEach(k => { posMean[p][k] = src.reduce((s, x) => s + x.t[k], 0) / M * 36; });
      posMean[p].tsa = posMean[p].fga + .44 * posMean[p].fta; posMean[p].gms = mean(src.map(x => gmsc(x.t) / x.t.m * 36), src.map(x => x.t.m)); });

    { const bs = k => bench.reduce((a, x) => a + x.t[k], 0); const tsaB = bs('fga') + .44 * bs('fta');
      if (tsaB > 0) prTS = bs('pts') / (2 * tsaB); if (bs('tpa') > 0) pr3 = bs('tpm') / bs('tpa'); if (bs('fta') > 0) prFT = bs('ftm') / bs('fta'); }
    function gmsc(t) { return t.pts + .4 * t.fgm - .7 * t.fga - .4 * (t.fta - t.ftm) + .7 * t.oreb + .3 * t.dreb + t.stl + .7 * t.ast + .7 * t.blk - .4 * t.pf - t.tov; }

    // shrink one rate: this season, last season faded, the position mean
    const wLast = m => .6 * 1500 / (1500 + m);
    function rate(x, k, val) {   // val(t) gives the season total of the stat
      const t = x.t, pt = x.pt, w = pt ? wLast(t.m) : 0, mPrev = pt ? pt.m : 0;
      const prior = k === 'gms' ? posMean[x.pos].gms : k === 'tsa' ? posMean[x.pos].tsa : posMean[x.pos][k];
      const num_ = (val ? val(t) : t[k]) / 36 * 36 + (pt ? w * (val ? val(pt) : pt[k]) : 0) + K[k] * prior / 36;
      return num_ / (t.m + w * mPrev + K[k]) * 36;
    }
    function pct(x, made, att, k, prior) {
      const t = x.t, pt = x.pt, w = pt ? wLast(t.m) : 0;
      return (t[made] + (pt ? w * pt[made] : 0) + KA[k] * prior) / (t[att] + (pt ? w * pt[att] : 0) + KA[k]);
    }
    const teamOf = id => teams[String(id)] || null;

    // features
    P.forEach(x => {
      const t = x.t, f = {};
      const ts = (() => { const tp = x.pt, w = tp ? wLast(t.m) : 0; const ptsS = t.pts + (tp ? w * tp.pts : 0), att = tsa(t) + (tp ? w * tsa(tp) : 0); return (ptsS + KA.ts * 2 * prTS) / (2 * (att + KA.ts)); })();
      f.ts = ts; f.tp = pct(x, 'tpm', 'tpa', 'tp', pr3); f.ft = pct(x, 'ftm', 'fta', 'ft', prFT);
      ['pts', 'ast', 'reb', 'oreb', 'dreb', 'stl', 'blk', 'tov', 'pf', 'tpa'].forEach(k => { f[k + '36'] = rate(x, k); });
      const tsa36 = rate(x, 'tsa', tsa);
      f.added36 = tsa36 * 2 * (ts - lgTS);
      f.ppg = f.pts36 * t.mpg / 36; f.apg = f.ast36 * t.mpg / 36; f.rpg = f.reb36 * t.mpg / 36;
      f.atov = (f.ast36 + 1) / (f.tov36 + 1);
      f.gms36 = rate(x, 'gms', gmsc); f.gmspg = f.gms36 * t.mpg / 36;
      const tm = teamOf(x.r.teamId), share = Math.min(1, t.m / Math.max(1, (teamG[x.r.teamId] || t.g) * 48));
      f.tnet = tm && num(tm.net) != null ? tm.net * share : 0; f.tdef = tm && num(tm.drtg) != null ? -(tm.drtg - 110) * share : 0;
      f.role = t.mpg; x.f = f;
    });
    const hasTeam = Object.keys(teams).length > 0;

    // z-scores: by position for the traits, league-wide for impact and role
    const stat = {}; const keyOf = (feat, p) => feat + ':' + p;
    const featsAll = new Set(); TRAITS.forEach(([, , fs]) => fs.forEach(([k]) => featsAll.add(k))); featsAll.add('role');
    const wide = new Set(['gms36', 'gmspg', 'tnet', 'role']);
    featsAll.forEach(k => { ['G', 'F', 'C', '*'].forEach(p => { const src = p === '*' ? pool : pool.filter(x => x.pos === p); const s = src.length >= 8 ? src : pool; const a = s.map(x => x.f[k]); const m = mean(a); stat[keyOf(k, p)] = { m, s: sd(a, m) }; }); });
    const z = (x, k) => { const st = stat[keyOf(k, wide.has(k) ? '*' : x.pos)]; return clip((x.f[k] - st.m) / st.s); };
    P.forEach(x => {
      x.tr = {};
      TRAITS.forEach(([key, , fs]) => { let s = 0, w = 0; fs.forEach(([k, wt]) => { if (!hasTeam && (k === 'tnet' || k === 'tdef')) return; s += wt * z(x, k); w += Math.abs(wt); }); x.tr[key] = s / (w || 1); });
      x.comp = Object.entries(OVERALL).reduce((s, [k, w]) => s + w * (k === 'role' ? z(x, 'role') : x.tr[k]), 0);
    });

    // percentiles inside the position pool, and the overall on the 2K scale
    const rankIn = (v, arr) => { let lo = 0, eq = 0; arr.forEach(a => { if (a < v - 1e-9) lo++; else if (Math.abs(a - v) <= 1e-9) eq++; }); return (lo + eq / 2) / (arr.length || 1); };
    const trArr = {}; ['G', 'F', 'C'].forEach(p => { const src = pool.filter(x => x.pos === p); const s = src.length >= 8 ? src : pool; TRAITS.forEach(([key]) => { trArr[key + ':' + p] = s.map(x => x.tr[key]); }); });
    const compArr = pool.map(x => x.comp).sort((a, b) => a - b);
    const q = p => compArr[Math.min(compArr.length - 1, Math.max(0, Math.round(p * (compArr.length - 1))))];
    const z99 = q(.99), zTop = compArr[compArr.length - 1];
    const scale = c => {
      if (c >= z99) return Math.min(99, 94 + 5 * (zTop > z99 ? (c - z99) / (zTop - z99) : 1));
      const p = rankIn(c, compArr);
      for (let i = MAP.length - 1; i >= 0; i--) if (p >= MAP[i][0]) { const [p0, r0] = MAP[i], [p1, r1] = MAP[i + 1] || [.99, 94]; return r0 + (r1 - r0) * (p - p0) / ((p1 - p0) || 1); }
      return 58;
    };

    const byId = {};
    P.forEach(x => {
      /* defense is the least reliable trait a box score gives, so its percentile is pulled 15% of the way back to the
         middle: it can still say "good" or "poor", but not "best in the league" on steals and rebounds alone */
      const REL = { defense: .85 };
      const traits = TRAITS.map(([key, label]) => { const raw = 100 * rankIn(x.tr[key], trArr[key + ':' + x.pos]); const p = 50 + (raw - 50) * (REL[key] || 1); return { key, label, pct: Math.max(1, Math.min(99, Math.round(p))), z: x.tr[key] }; });
      const ovr = Math.max(40, Math.min(99, Math.round(scale(x.comp))));
      byId[x.r.id] = { id: x.r.id, ovr, pos: x.pos, posWord: POS_WORD[x.pos], traits, f: x.f, t: x.t, raw: x.r, lg: { ts: lgTS, tp: lg3, ft: lgFT }, sample: x.t.m, early: x.t.m < 250 && !x.pt, qualified: pool.includes(x), lastSeason: !!x.pt, estReb: x.t.split };
    });
    return { byId, n: pool.length, lg: { ts: lgTS, tp: lg3, ft: lgFT } };
  }

  /* what the numbers behind each trait are, in words */
  function detail(R, key) {
    const f = R.f, r = R.raw, one = v => (Math.round(v * 10) / 10).toFixed(1), pc = v => `${(v * 100).toFixed(1)}%`;
    const tr = R.traits.find(t => t.key === key); const tail = `Better than ${tr.pct}% of ${R.posWord}.`;
    const t = R.t;
    switch (key) {
      case 'scoring': return `${one(r.pts)} points a game, ${one(t.pts / t.m * 36)} per 36 minutes, ${f.added36 >= 0 ? `${one(f.added36)} more` : `${one(-f.added36)} fewer`} per 36 than an average shooter would score on the same shots. ${tail}`;
      case 'shooting': return `${pc(t.pts / (2 * (t.fga + .44 * t.fta) || 1))} true shooting${t.tpa ? `, ${pc(t.tpm / t.tpa)} from three on ${one(t.tpa / t.g)} a game` : ''}${t.fta ? `, ${pc(t.ftm / t.fta)} at the line` : ''}. ${tail}`;
      case 'playmaking': return `${one(r.ast)} assists a game, ${one(t.ast / t.m * 36)} per 36, ${(t.tov ? t.ast / t.tov : t.ast).toFixed(1)} assists for every turnover. ${tail}`;
      case 'rebounding': return `${one(r.reb)} rebounds a game${R.estReb ? '' : `, ${one(t.oreb / t.g)} on the offensive glass`}, ${one(t.reb / t.m * 36)} per 36. ${tail}`;
      case 'defense': return `${one(r.stl)} steals and ${one(r.blk)} blocks a game, ${one((t.stl + t.blk) / t.m * 36)} combined per 36. Box scores show defense least well of all six. ${tail}`;
      case 'impact': return `A game score of ${one(gmscPer(t))} a night, built from every line in the box score, with his team's results while he plays. ${tail}`;
    }
    return tail;
  }
  function gmscPer(t) { return (t.pts + .4 * t.fgm - .7 * t.fga - .4 * (t.fta - t.ftm) + .7 * t.oreb + .3 * t.dreb + t.stl + .7 * t.ast + .7 * t.blk - .4 * t.pf - t.tov) / t.g; }

  /* one line on the player: his best two traits and his weakest */
  function summary(R) {
    const s = R.traits.slice().sort((a, b) => b.pct - a.pct); const top = s.filter(t => t.pct >= 80).slice(0, 2), low = s[s.length - 1];
    const word = p => p >= 95 ? 'elite' : p >= 85 ? 'standout' : 'strong';
    const parts = top.map(t => `${word(t.pct)} ${t.label.toLowerCase()}`);
    const lead = parts.length ? parts.join(' and ') : `${s[0].label.toLowerCase()} is his best trait`;
    return `${lead.charAt(0).toUpperCase() + lead.slice(1)}${low.pct <= 35 ? `; ${low.label.toLowerCase()} is the gap` : ''}.`;
  }

  const memo = {};
  async function league(L) { if (!L || L.sport !== 'basketball') return null; await get(L, '__'); return memo[L.key] ? memo[L.key].p : null; }
  async function get(L, id) {
    if (!L || L.sport !== 'basketball') return null;
    const k = L.key; if (!memo[k] || Date.now() - memo[k].t > 30 * 60000) memo[k] = { t: Date.now(), p: (async () => {
      /* first choice: the app's own data file, one download for the whole league with last season alongside */
      const lg = HW.hub ? await HW.hub.league(L).catch(() => null) : null;
      if (lg && lg.players && lg.players.length > 30 && (lg.lastSeason || lg.players.some(p => p.prev && p.prev.fga != null))) {   // only once the file carries last season's full lines
        const row = (p, s) => ({ id: String(p.id), name: p.n, pos: p.pos, teamId: p.team, gp: s.gp || 0, min: s.min || 0, pts: s.pts || 0, reb: s.reb || 0, ast: s.ast || 0, stl: s.stl || 0, blk: s.blk || 0, tov: s.to || 0,
          fga: s.fga, fta: s.fta, fgm: s.fgm, ftm: s.ftm, tpm: s.tpm, tpa: s.tpa, pf: s.pf, oreb: s.oreb, dreb: s.dreb, fg: s.fg, tp: s.tp, ft: s.ft });
        const rows = lg.players.map(p => row(p, p.s || {}));
        const prev = lg.players.filter(p => p.prev && p.prev.fga != null && p.prev.min > 0).map(p => row(p, p.prev));
        let teams = {};
        const TS = HW.teamStats ? await HW.teamStats(L).catch(() => null) : null;
        if (TS && TS.teams && HW.v5 && HW.v5.teamsIndex) { const idx = await HW.v5.teamsIndex(L).catch(() => ({})); Object.entries(TS.teams).forEach(([tid, v]) => { const t = idx[tid]; if (t && t.abbr) teams[t.abbr] = v; }); }
        return { ...compute(rows, prev.length ? prev : null, { teams }), label: lg.label, stale: !!lg.lastSeason };
      }
      const cur = await HW.leaguePlayers(L); if (!cur || !cur.rows.length) return null;
      const prevYear = (cur.year || HW.seasonYear()) - 1;
      const [prev, TS] = await Promise.all([HW.leaguePlayers(L, prevYear).catch(() => null), HW.teamStats ? HW.teamStats(L).catch(() => null) : null]);
      return { ...compute(cur.rows, prev && prev.rows, { teams: TS && TS.teams }), label: cur.label, stale: cur.stale };
    })().catch(() => null) };
    const res = await memo[k].p; const R = res && res.byId[String(id)] ? { ...res.byId[String(id)], season: res.label, stale: res.stale } : null; if (R) last[k + ':' + id] = R; return R;
  }
  /* the rating already worked out this visit, so a refresh can draw the cards straight away instead of after a beat */
  const last = {}; const cached = (L, id) => L && last[L.key + ':' + id] || null;

  /* ---------- the two cards on the player page ---------- */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const tier = o => o >= 90 ? 't5' : o >= 80 ? 't4' : o >= 70 ? 't3' : o >= 60 ? 't2' : 't1';
  function hexSVG(R, sel) {
    const W = 384, H = 318, cx = W / 2, cy = H / 2 + 4, Rr = 96, uid = 'hx' + R.id;
    const ang = i => (-90 + i * 60) * Math.PI / 180, P = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))], f = n => n.toFixed(1);
    const ring = k => [0, 1, 2, 3, 4, 5].map(i => P(i, Rr * k).map(f).join(',')).join(' ');
    const wedge = (i, r) => { const a = P(i, r), b = P(i + 1, r); return `M${cx},${cy}L${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}Z`; };
    const grid = cls => [.33, .66].map(k => `<polygon class="${cls} d" points="${ring(k)}"/>`).join('') + [0, 1, 2, 3, 4, 5].map(i => `<line class="${cls}" x1="${cx}" y1="${cy}" x2="${f(P(i, Rr)[0])}" y2="${f(P(i, Rr)[1])}"/>`).join('');
    const wr = R.traits.map(t => Rr * Math.max(.03, t.pct / 100));
    let s = `<svg class="hexsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Six traits compared to other ${R.posWord}"><defs><clipPath id="${uid}">${R.traits.map((t, i) => `<path d="${wedge(i, wr[i])}"/>`).join('')}</clipPath></defs>`;
    // under the colour: the full hexagon, its rings and spokes, so an empty trait still shows its slice
    s += `<polygon class="hxbg" points="${ring(1)}"/>` + grid('hxr');
    R.traits.forEach((t, i) => { s += `<path class="hxw${t.key === sel ? ' on' : ''}" data-hex="${t.key}" style="--d:${i * 45}ms" d="${wedge(i, wr[i])}"/>`; });
    // over the colour, as FotMob does: the same rings and spokes in light dashes, only where a trait is filled in
    s += `<g class="hxover" clip-path="url(#${uid})">${grid('hxo')}</g><polygon class="hxedge" points="${ring(1)}"/>`;
    R.traits.forEach((t, i) => { const A = P(i, Rr + 30), B = P(i + 1, Rr + 30); s += `<path class="hxt" data-hex="${t.key}" d="M${cx},${cy}L${f(A[0])},${f(A[1])}L${f(B[0])},${f(B[1])}Z"/>`; });
    R.traits.forEach((t, i) => { const m = (ang(i) + ang(i + 1)) / 2, c = Math.cos(m); let x = cx + (Rr + 22) * c, anc = c > .3 ? 'start' : c < -.3 ? 'end' : 'middle'; const y = cy + (Rr + 30) * Math.sin(m) - 4;
      if (Math.abs(c) > .9) { anc = c > 0 ? 'start' : 'end'; x = cx + (Rr + 14) * (c > 0 ? 1 : -1); }   // the side labels sit just off the hexagon's corners, not at the card's edges
      s += `<g class="hxl${t.key === sel ? ' on' : ''}" data-hex="${t.key}"><text x="${f(x)}" y="${f(y)}" text-anchor="${anc}" class="hxn">${t.label}</text><text x="${f(x)}" y="${f(y + 19)}" text-anchor="${anc}" class="hxp">${t.pct}%</text></g>`; });
    return s + '</svg>';
  }
  const detHead = t => `<div class="hxdh"><b>${esc(t.label)}</b><em>${t.pct}<small>%</small></em></div>`;
  function cards(R, opts = {}) {
    const best = R.traits.slice().sort((a, b) => b.pct - a.pct)[0].key;
    const g = R.raw, season = R.season ? esc(String(R.season).replace(/ Regular Season$/i, '')) : 'This season';
    const early = R.early ? `<p class="hxnote">Early estimate: ${Math.round(R.sample)} minutes played so far, so this leans on what a typical bench player does and firms up as he plays.</p>` : '';
    return `<div class="gxplate rtcard"><div class="rth"><span class="rtl">${esc(opts.league || 'NBA')}</span><b>${season}</b></div><div class="rtrow"><div><b>${g.gp}</b><span>Games</span></div><div><b>${(Math.round(g.pts * 10) / 10).toFixed(1)}</b><span>Points</span></div><div><b class="rtb ${tier(R.ovr)}">${R.ovr}</b><span>RIVL rating</span></div></div><p class="rtsum">${esc(summary(R))}</p></div>`
      + `<div class="gxplate hxcard" data-rid="${esc(R.id)}"><div class="hxh"><b>Player traits</b><span>Compared to other ${R.posWord}<button class="hxq" data-act="rthow" aria-label="How the rating works">?</button></span></div>${hexSVG(R, best)}<div class="hxdet" aria-live="polite">${detHead(R.traits.find(t => t.key === best))}<span>${esc(detail(R, best))}</span></div>${early}</div>`;
  }
  const live = {};   // the rating behind each card on screen, for the taps
  function mount(el, R, opts) { live[R.id] = R; el.innerHTML = cards(R, opts); }
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    const h = e.target.closest && e.target.closest('[data-hex]'); if (h) { const card = h.closest('.hxcard'); const R = card && live[card.dataset.rid]; if (!R) return; const k = h.dataset.hex, t = R.traits.find(x => x.key === k);
      card.querySelectorAll('.hxw,.hxl').forEach(x => x.classList.toggle('on', x.dataset.hex === k));
      const d = card.querySelector('.hxdet'); d.innerHTML = `${detHead(t)}<span>${esc(detail(R, k))}</span>`; return; }
    const how = e.target.closest && e.target.closest('[data-act="rthow"]'); if (how) { e.preventDefault(); const card = how.closest('.hxcard'); let p = card.querySelector('.hxexp'); if (p) { p.remove(); how.classList.remove('on'); return; }
      card.insertAdjacentHTML('beforeend', `<div class="hxexp"><p><b>Built only from his stats.</b> Every stat is turned into a rate per 36 minutes and compared with players at his position. Six traits come from those rates, and the percentage is the share of ${R.posWord} he beats.</p><p><b>Small samples are held back.</b> A few hot games barely move a player until the minutes back them up. Last season counts too, fading out as this season fills in.</p><p><b>The overall</b> weights impact most, then scoring, playmaking, shooting, defense and rebounding, plus the minutes his coach gives him, and is placed on the 2K scale: a 74 is a typical rotation player, 82 is the top 15%, 90 the top 3%, and the league's best is a 99.</p><p><b>Defense is the hardest to measure</b> from a box score: steals, blocks, defensive rebounds, fouls and his team's defense while he plays.</p><p>Tap any trait on the chart for the numbers behind it.</p></div>`); how.classList.add('on'); }
  });

  const done = {}; const leagueNow = L => L && done[L.key] || null;   // a league already worked out, with no wait
  const leagueKeep = async L => { const r = await league(L); if (r && L) done[L.key] = r; return r; };
  HW.rating = { compute, detail, summary, get, league: leagueKeep, leagueNow, cached, cards, mount, POS, TRAITS };
})();
