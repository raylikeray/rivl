/* Run: cp worker.js worker.mjs && node simcheck.mjs — the worker's own scheduled() driven minute by minute. */
const RealDate = Date; let NOW = 0;
globalThis.Date = class extends RealDate { constructor(...a) { if (!a.length) super(NOW); else super(...a); } static now() { return NOW; } };
Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
const TIP = RealDate.parse('2026-10-30T00:00:00Z');   // 7:00 PM CT
const game = (id, tid, date) => ({ id, date, status: { type: { state: 'pre' } }, competitions: [{ status: { type: { state: 'pre' } }, competitors: [
  { homeAway: 'home', team: { id: tid, abbreviation: 'H' }, score: '' }, { homeAway: 'away', team: { id: '999', abbreviation: 'A' }, score: '' }] }] });
let SLATE = { nba: { events: [game('401', '25', new RealDate(TIP).toISOString())] }, wnba: { events: [] }, ncaam: { events: [] }, ncaaw: { events: [] } };
const KVmap = new Map();
const env = { SELF_URL: 'https://w.example', CRON_TOKEN: 'x', KV: {
  async list({ prefix }) { return { keys: [...KVmap.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; },
  async get(k, t) { const v = KVmap.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); },
  async put(k, v) { KVmap.set(k, v); }, async delete(k) { KVmap.delete(k); } } };
const setSubs = teams => KVmap.set('sub:me', JSON.stringify({ sub: { endpoint: 'https://push/x' }, teams, players: [], prefs: {} }));
setSubs(['nba:25', 'wnba:3', 'ncaam:2', 'ncaaw:4']);
let fired = [], espn = 0;
globalThis.fetch = async (u) => {
  const url = String(u);
  if (url.startsWith('https://w.example/run')) { const p = new URL(url).searchParams; fired.push(p.get('lk') + ':' + p.get('what')); return { ok: true, json: async () => ({}) }; }
  espn++;
  if (url.includes('/scoreboard')) { const lk = url.includes('/nba/') ? 'nba' : url.includes('/wnba/') ? 'wnba' : url.includes('mens-college') && !url.includes('womens') ? 'ncaam' : 'ncaaw'; return { ok: true, json: async () => SLATE[lk] }; }
  return { ok: true, json: async () => ({}) };
};
const mod = (await import('./worker.mjs')).default;
const at = async (ms) => { fired = []; NOW = ms; await mod.scheduled({}, env, { waitUntil: p => p }); return fired; };
const ok = (c, m) => console.log((c ? '  PASS  ' : '  FAIL  ') + m);

console.log('alerts still reach their moment');
ok((await at(TIP - 20 * 60000)).includes('nba:games'), 'tip-off alert window (20 min before) — games polled');
ok((await at(TIP + 30 * 60000)).includes('nba:games'), 'during the game — games polled');
ok((await at(TIP + 2 * 3600000)).includes('nba:games'), 'two hours in (close game / final) — games polled');
ok(!(await at(TIP - 3 * 3600000)).includes('nba:games'), 'three hours before tip — quiet');
ok(!(await at(TIP + 5 * 3600000)).includes('nba:games'), 'five hours after tip — quiet');
console.log('leagues that are not playing');
ok(!(await at(TIP)).some(x => x.startsWith('wnba:games')), 'WNBA has no games today — never polled for games');
console.log('injuries');
ok((await at(TIP - 4 * 3600000 + 3 * 60000)).includes('nba:injuries'), 'four hours before tip — injuries checked');
ok(!(await at(TIP - 10 * 3600000 + 3 * 60000)).includes('nba:injuries'), 'ten hours before tip — not checked');
console.log('breaking news');
ok((await at(RealDate.parse('2026-10-29T19:01:00Z'))).includes('nba:wire'), 'NBA in season, 2pm CT — wire every 5 min');
ok(!(await at(RealDate.parse('2026-10-29T19:06:00Z'))).includes('wnba:wire'), 'WNBA out of season — skipped at minute 6 (5-min cadence only)');
ok((await at(RealDate.parse('2026-10-29T19:06:00Z'))).includes('nba:wire'), 'NBA in season — read at minute 6');
ok((await at(RealDate.parse('2026-10-29T19:31:00Z'))).includes('wnba:wire'), 'WNBA still read on the half hour');
ok(!(await at(RealDate.parse('2026-10-29T09:06:00Z'))).includes('nba:wire'), '4am CT — no 5-minute wire');
console.log('following a new team takes effect at once');
KVmap.delete('plan:nba:' + new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new RealDate(TIP)));
setSubs(['nba:25', 'nba:7']); SLATE.nba.events.push(game('402', '7', new RealDate(TIP + 6 * 3600000).toISOString()));
await at(TIP + 5 * 3600000);                      // outside the first game's window
ok((await at(TIP + 6 * 3600000 - 10 * 60000)).includes('nba:games'), 'a newly followed team\'s game is watched without waiting out the hour');
