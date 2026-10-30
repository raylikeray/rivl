/* Run: cp worker.js worker.mjs && node simday.mjs — the worker's own scheduled() driven minute by minute. */
/* Drive the worker's real scheduled() minute by minute through a day and count what reaches ESPN. */
const RealDate = Date;
let NOW = 0;
globalThis.Date = class extends RealDate {
  constructor(...a) { if (!a.length) super(NOW); else super(...a); }
  static now() { return NOW; }
};
Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;

// one NBA game tonight at 7:00 PM CT, nothing in the other three leagues
const DAY = RealDate.parse('2026-10-29T05:00:00Z');            // midnight CT
const TIP = RealDate.parse('2026-10-30T00:00:00Z');            // 7:00 PM CT
const SLATE = {
  nba:  { events: [{ id: '401', date: new RealDate(TIP).toISOString(), status: { type: { state: 'pre' } },
          competitions: [{ status: { type: { state: 'pre' } }, competitors: [
            { homeAway: 'home', team: { id: '25', abbreviation: 'OKC' }, score: '' },
            { homeAway: 'away', team: { id: '7', abbreviation: 'DEN' }, score: '' }] }] }] },
  wnba: { events: [] }, ncaam: { events: [] }, ncaaw: { events: [] }
};
const counts = { espn: 0, run: {}, plan: 0, kv: { list: 0, get: 0, put: 0, delete: 0 } };
const KVmap = new Map();
const env = {
  SELF_URL: 'https://w.example', CRON_TOKEN: 'x',
  KV: {   // every operation is counted: the free tier allows 1,000 lists, 1,000 writes and 1,000 deletes a day
    async list({ prefix }) { counts.kv.list++; return { keys: [...KVmap.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
    async get(k, t) { counts.kv.get++; const v = KVmap.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); },
    async put(k, v) { counts.kv.put++; KVmap.set(k, v); },
    async delete(k) { counts.kv.delete++; KVmap.delete(k); }
  }
};
// one subscriber following a team in all four leagues
KVmap.set('sub:me', JSON.stringify({ sub: { endpoint: 'https://push/x' }, teams: ['nba:25', 'wnba:3', 'ncaam:2', 'ncaaw:4'], players: [], prefs: {} }));

globalThis.fetch = async (u) => {
  const url = String(u);
  if (url.startsWith('https://w.example/run')) {           // the cron calling itself: count the kind of work asked for
    const what = new URL(url).searchParams.get('what'); counts.run[what] = (counts.run[what] || 0) + 1;
    return { ok: true, json: async () => ({}) };
  }
  counts.espn++;                                            // anything else is a real request at ESPN
  if (url.includes('/scoreboard')) { counts.plan++; const lk = Object.keys(SLATE).find(k => url.includes('/' + ({nba:'nba',wnba:'wnba',ncaam:'mens-college-basketball',ncaaw:'womens-college-basketball'})[k] + '/')) || 'nba'; return { ok: true, json: async () => SLATE[lk] }; }
  return { ok: true, json: async () => ({}) };
};
const mod = (await import('./worker.mjs')).default;
for (let m = 0; m < 1440; m++) {
  NOW = DAY + m * 60000;
  await mod.scheduled({}, env, { waitUntil: p => p });
}
const runTotal = Object.values(counts.run).reduce((a, b) => a + b, 0);
console.log('plan reads (real ESPN):', counts.plan);
console.log('work dispatched       :', counts.run, '= ' + runTotal);
console.log('ESPN requests for a day with one NBA game:');
console.log('   plan', counts.plan, '+ games', counts.run.games || 0, '+ injuries', counts.run.injuries || 0, '+ wire', counts.run.wire || 0,
            '=', counts.plan + runTotal);
console.log('KV operations by the cron loop itself (the /run work is on top):', counts.kv);
