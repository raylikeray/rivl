/* RIVL v5 — league configuration (basketball only). Mirrors js/config.js; the nightly job still reads that one. */
(function (root) {
  'use strict';
  /* Per league:
     sport        basketball | football | baseball   (box scores, clocks, wording and the model's spread follow the sport)
     path         ESPN path under /sports/
     weekly       true for football: the "today" slate is the current week's games
     diffIsTotal  standings "differential" is a season total (NFL, MLB) rather than a per-game average (NBA)
     sd           spread of the margin in points/runs; hca home advantage; b2b rest penalty (played yesterday); k Elo speed; eloPerPoint Elo per point of margin
     tuneAt       games on record before the nightly self-tuning starts
     verb         what the start of a game is called */
  const LEAGUES = {
    nba: {
      key: 'nba', tuneAt: 60, sport: 'basketball', path: 'basketball/nba', logo: 'nba', label: 'NBA', short: 'NBA', tag: 'NBA', noun: 'NBA',
      sbParams: '&limit=50', standingsMode: 'conference', hasRankings: false, hasInjuries: true, hasTransactions: true,
      minutes: 48, periods: 4, sd: 12, hca: 2.4, b2b: 1.8, k: 20, eloPerPoint: 28,
      seasonStart: '2026-10-20', playoffLine: [6, 10], verb: 'tips', favs: [], home: null
    },
    wnba: {
      key: 'wnba', tuneAt: 40, sport: 'basketball', path: 'basketball/wnba', logo: 'wnba', label: 'WNBA', short: 'WNBA', tag: 'WNBA', noun: 'WNBA',
      sbParams: '&limit=50', standingsMode: 'league', hasRankings: false, hasInjuries: true, hasTransactions: true,
      minutes: 40, periods: 4, sd: 11, hca: 2.0, b2b: 1.5, k: 22, eloPerPoint: 26,
      seasonStart: '2026-05-01', playoffLine: [8], verb: 'tips', favs: [], home: null, offseason: 'The WNBA is in its off-season; the schedule returns in May.'
    },
    ncaam: {
      key: 'ncaam', tuneAt: 150, sport: 'basketball', path: 'basketball/mens-college-basketball', logo: 'ncaa', label: 'NCAA M', short: 'NCAA M', tag: 'NCAAM', noun: "men's college basketball",
      sbParams: '&groups=50&limit=400', standingsMode: 'conferences', standingsGroup: 50, hasRankings: true, hasInjuries: false, hasTransactions: false,
      minutes: 40, periods: 2, sd: 11, hca: 3.2, b2b: 0.8, k: 24, eloPerPoint: 26,
      seasonStart: '2026-11-01', playoffLine: [], verb: 'tips', favs: [], home: null
    },
    ncaaw: {
      key: 'ncaaw', tuneAt: 150, sport: 'basketball', path: 'basketball/womens-college-basketball', logo: 'ncaa', label: 'NCAA W', short: 'NCAA W', tag: 'NCAAW', noun: "women's college basketball",
      sbParams: '&groups=50&limit=400', standingsMode: 'conferences', standingsGroup: 50, hasRankings: true, hasInjuries: false, hasTransactions: false,
      minutes: 40, periods: 4, sd: 12, hca: 3.4, b2b: 0.8, k: 24, eloPerPoint: 26,
      seasonStart: '2026-11-01', playoffLine: [], verb: 'tips', favs: [], home: null
    },
  };
  const SPORTS = [
    { key: 'basketball', label: 'Basketball', leagues: ['nba', 'wnba', 'ncaam', 'ncaaw'] }
  ];
  const ORDER = SPORTS.flatMap(s => s.leagues);
  // The RIVL worker (worker/worker.js on Cloudflare): ESPN cache proxy, follows sync and push alerts.
  // WORKER stays empty until it is deployed; the app then talks to ESPN directly and offers no alerts or sync.
  const WORKER = 'https://rivl.ray-marshall300.workers.dev';
  const PUSH = { url: WORKER, key: 'BNkWE-DFMABpLNkt2Juu-p0pxlD02CMiqI_0_AxwVv3_Q2P5UHWTdFqRcrNzfZFd1EZq0F_UDuBG-JxJ44je6Rs' };
  // ESPN's own bases: what the app reads when there is no worker, and what a proxied call falls back to if the worker ever fails
  const DIRECT = {
    site: 'https://site.api.espn.com/apis/site/v2/sports/',
    v2: 'https://site.api.espn.com/apis/v2/sports/',
    web: 'https://site.web.api.espn.com/apis/common/v3/sports/',
    core: 'https://sports.core.api.espn.com/v2/',
    now: 'https://now.core.api.espn.com/v1/'
  };
  const ESPN = WORKER ? {
    site: WORKER + '/espn/site/', v2: WORKER + '/espn/v2/', web: WORKER + '/espn/web/', core: WORKER + '/espn/core/', now: WORKER + '/espn/now/'
  } : DIRECT;
  /* Tip times are the time on the viewer's own clock, not Central for everyone. Within the United States this changes only
     the clock face — every game starts and ends inside one calendar day in every US zone, so which day a game belongs to
     does not move. Central is the fallback when the device will not say. */
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'; } catch (e) { return 'America/Chicago'; } })();
  const out = { LEAGUES, SPORTS, ORDER, ESPN, DIRECT, PUSH, WORKER, TZ, SITE: 'RIVL', DATA: '/tipoff/data/' };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.HW = Object.assign(root.HW || {}, out);
})(typeof globalThis !== 'undefined' ? globalThis : this);
