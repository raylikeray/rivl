/* RIVL worker — one Cloudflare Worker, no dependencies. Three jobs:
   1. /espn/*   a caching proxy in front of ESPN's public feeds, so the app never sees a throttle and loads faster
   2. /sync     your follows and settings behind a short code, so a second device can pick them up
   3. push      alerts for your teams and players: tip-off, close game, final, injury changes (cron, once a minute)
   Bindings: KV (KV namespace). Variables: VAPID_PUBLIC, VAPID_PRIVATE_JWK (secret), VAPID_SUBJECT (mailto:…),
   ALLOWED_ORIGINS (comma list), SELF_URL (this worker's URL), CRON_TOKEN (any word). */

const LEAGUES = {
  nba:   { verb: 'tips off', path: 'nba', label: 'NBA', sb: '&limit=50', reg: 4, injuries: true },
  wnba:  { verb: 'tips off', path: 'wnba', label: 'WNBA', sb: '&limit=50', reg: 4, injuries: true },
  ncaam: { verb: 'tips off', path: 'mens-college-basketball', label: 'NCAA M', sb: '&groups=50&limit=400', reg: 2, injuries: false },
  ncaaw: { verb: 'tips off', path: 'womens-college-basketball', label: 'NCAA W', sb: '&groups=50&limit=400', reg: 4, injuries: false }
};
const API = L => `https://site.api.espn.com/apis/site/v2/sports/basketball/${L.path}`;
const TZ = 'America/Chicago';

/* ---------- helpers ---------- */
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const concat = (...arrs) => { const n = arrs.reduce((s, a) => s + a.byteLength, 0); const out = new Uint8Array(n); let o = 0; arrs.forEach(a => { out.set(new Uint8Array(a), o); o += a.byteLength; }); return out; };
async function sha(s) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0, 24); }
const todayCT = () => { const d = new Date(); const h = +new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(d) % 24; const y = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); if (h >= 4) return y; const [Y, M, D] = y.split('-').map(Number); return new Date(Date.UTC(Y, M - 1, D - 1)).toISOString().slice(0, 10); };
const tipCT = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const cors = (env, req) => { const o = req.headers.get('Origin') || ''; const ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean); const allow = ok.includes(o) ? o : ok[0] || '*'; return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' }; };
const json = (o, status = 200, h = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...h } });

/* ---------- Web Push (RFC 8291 / 8188 / 8292) ---------- */
async function vapidJwt(env, audience) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:tipoff@example.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
async function encryptPayload(sub, text) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const record = concat(enc.encode(text), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
async function sendPush(env, sub, payload) {
  const url = new URL(sub.endpoint);
  const jwt = await vapidJwt(env, url.origin);
  const body = await encryptPayload(sub, JSON.stringify(payload));
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { 'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': String(payload.ttl || 3600), 'Urgency': payload.urgency || 'normal' }, body });
  return r.status;
}


/* ---------- ESPN parsing ---------- */
function parseGame(e) {
  const c = e.competitions[0]; const st = (c.status || e.status || {}); const t = st.type || {};
  const side = x => { const tm = x.team || {}; return { id: String(tm.id), abbr: tm.abbreviation || '', short: tm.shortDisplayName || tm.name || '', score: x.score != null && x.score !== '' ? +x.score : null }; };
  const comp = c.competitors || [];
  return { id: String(e.id), date: e.date, state: t.state || 'pre', detail: t.shortDetail || '', period: st.period || 0, clock: st.displayClock || '', home: side(comp.find(x => x.homeAway === 'home') || comp[0] || {}), away: side(comp.find(x => x.homeAway === 'away') || comp[1] || {}), tv: (c.broadcasts || []).flatMap(b => b.names || []).slice(0, 2).join(' · ') };
}
async function getJson(u) { const r = await fetch(u, { headers: { 'user-agent': 'rivl-worker' }, cf: { cacheTtl: 20 } }); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }

/* ---------- the proxy: ESPN's feeds through Cloudflare's cache, with CORS for the app ---------- */
const UPSTREAM = { site: 'https://site.api.espn.com/apis/site/v2/sports/', v2: 'https://site.api.espn.com/apis/v2/sports/', web: 'https://site.web.api.espn.com/apis/common/v3/sports/', core: 'https://sports.core.api.espn.com/v2/', now: 'https://now.core.api.espn.com/v1/' };
const ttlFor = p => /scoreboard|summary/.test(p) ? 15 : /injuries|news|standings|rankings/.test(p) ? 90 : /byathlete|gamelog|overview/.test(p) ? 300 : 900;
async function proxy(req, env, h) {
  const url = new URL(req.url); const m = url.pathname.match(/^\/espn\/(site|v2|web|core|now)\/(.*)$/); if (!m) return json({ error: 'not found' }, 404, h);
  const target = UPSTREAM[m[1]] + m[2] + url.search; const ttl = ttlFor(m[2]);
  const r = await fetch(target, { headers: { 'user-agent': 'rivl-proxy', 'accept': 'application/json' }, cf: { cacheTtl: ttl, cacheEverything: true } });
  const out = new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'cache-control': `public, max-age=${ttl}`, ...h } });
  return out;
}

/* ---------- sync: follows and settings behind a short code ---------- */
const codeOf = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; crypto.getRandomValues(new Uint8Array(6)).forEach(b => { s += A[b % A.length]; }); return s; };
async function sync(req, env, h) {
  if (req.method === 'POST') {
    let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
    const data = b.data; if (!data || typeof data !== 'object' || JSON.stringify(data).length > 60000) return json({ error: 'bad data' }, 400, h);
    const code = (b.code && /^[A-Z0-9]{6}$/.test(b.code)) ? b.code : codeOf();
    await env.KV.put('sync:' + code, JSON.stringify({ data, t: Date.now() }), { expirationTtl: 60 * 60 * 24 * 400 });
    return json({ ok: true, code }, 200, h);
  }
  const code = (new URL(req.url).searchParams.get('code') || '').toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return json({ error: 'bad code' }, 400, h);
  const v = await env.KV.get('sync:' + code, 'json'); if (!v) return json({ error: 'unknown code' }, 404, h);
  return json({ ok: true, data: v.data, t: v.t }, 200, h);
}

/* ---------- subscriptions ---------- */
async function loadSubs(env) {
  const subs = []; let cursor;
  do { const l = await env.KV.list({ prefix: 'sub:', cursor }); for (const k of l.keys) { const v = await env.KV.get(k.name, 'json'); if (v && v.sub) subs.push({ key: k.name, ...v }); } cursor = l.list_complete ? null : l.cursor; } while (cursor);
  return subs;
}
async function deliver(env, subs, matchKey, kind, payload, field = 'teams') {
  const targets = subs.filter(s => (s[field] || []).includes(matchKey) && (s.prefs || {})[kind] !== false);
  let n = 0;
  for (const s of targets) {
    try { const st = await sendPush(env, s.sub, payload); if (st === 404 || st === 410) await env.KV.delete(s.key); else if (st < 300) n++; } catch (e) { console.log('push failed', e.message); }
  }
  return n;
}
const sentKey = k => 'sent:' + k;
async function once(env, k, fn) { if (await env.KV.get(sentKey(k))) return false; await env.KV.put(sentKey(k), '1', { expirationTtl: 172800 }); await fn(); return true; }
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0]);

/* ---------- the minute check for one league: tip-off, close game, final ---------- */
async function runLeague(env, lk, subs) {
  const L = LEAGUES[lk]; if (!L) return;
  const teams = new Set(subs.flatMap(s => (s.teams || []).filter(t => t.startsWith(lk + ':')).map(t => t.slice(lk.length + 1))));
  if (!teams.size) return;
  const ymd = todayCT();
  let games; try { games = ((await getJson(`${API(L)}/scoreboard?dates=${ymd.replace(/-/g, '')}${L.sb}`)).events || []).map(parseGame); } catch (e) { console.log(lk, 'scoreboard', e.message); return; }
  const now = Date.now();
  for (const g of games) {
    const mineH = teams.has(g.home.id), mineA = teams.has(g.away.id); if (!mineH && !mineA) continue;
    const both = [mineH ? `${lk}:${g.home.id}` : null, mineA ? `${lk}:${g.away.id}` : null].filter(Boolean);
    const gk = `${lk}:${g.id}`; const url = `#game/${lk}/${g.id}`; const name = `${g.away.short} at ${g.home.short}`;
    const send = (kind, payload, dedupe) => once(env, dedupe, async () => { for (const tk of both) await deliver(env, subs, tk, kind, { ...payload, url, league: lk }); });
    const mins = (new Date(g.date) - now) / 60000;
    if (g.state === 'pre' && mins > 0 && mins <= 20) await send('pre', { title: `${name} ${L.verb} in ${Math.round(mins)} min`, body: `${tipCT(g.date)}${g.tv ? ' · ' + g.tv : ''}`, tag: `pre:${gk}` }, `pre:${gk}`);
    if (g.state === 'in') {
      const snap = await env.KV.get('st:' + gk, 'json') || {};
      const hs = g.home.score || 0, as = g.away.score || 0;
      const score = `${g.away.abbr} ${as}, ${g.home.abbr} ${hs}`;
      const last = g.period >= L.reg; const [mm] = String(g.clock || '0:00').split(':').map(Number);
      if (last && Math.abs(hs - as) <= 5 && (mm || 0) < 3) await send('close', { title: `Close one: ${score}`, body: `${g.detail} · ${name}`, tag: `game:${gk}`, renotify: true }, `close:${gk}:${g.period}`);
      const next = { period: g.period, hs, as, live: 1 };
      if (JSON.stringify(next) !== JSON.stringify(snap)) await env.KV.put('st:' + gk, JSON.stringify(next), { expirationTtl: 172800 });
    }
    if (g.state === 'post') {
      const snap = await env.KV.get('st:' + gk, 'json');
      if (snap && snap.live) { const w = (g.home.score || 0) > (g.away.score || 0) ? g.home : g.away, l = w === g.home ? g.away : g.home; await send('final', { title: `Final: ${w.short} ${w.score}, ${l.short} ${l.score}`, body: name, tag: `game:${gk}` }, `final:${gk}`); await env.KV.put('st:' + gk, JSON.stringify({ ...snap, live: 0 }), { expirationTtl: 172800 }); }
    }
  }
}

/* ---------- injuries: your teams (anyone newly out) and your players (any status change) ---------- */
async function runInjuries(env, lk, subs) {
  const L = LEAGUES[lk]; if (!L || !L.injuries) return;
  const teams = [...new Set(subs.flatMap(s => (s.teams || []).filter(t => t.startsWith(lk + ':')).map(t => t.slice(lk.length + 1))))];
  const players = [...new Set(subs.flatMap(s => (s.players || []).filter(t => t.startsWith(lk + ':')).map(t => t.slice(lk.length + 1))))];
  if (!teams.length && !players.length) return;
  let d; try { d = await getJson(`${API(L)}/injuries`); } catch (e) { console.log(lk, 'injuries', e.message); return; }
  const athId = a => a && (a.id || (String(a.uid || '').match(/~a:(\d+)/) || [])[1] || '') + '';
  const seen = {};
  for (const t of (d.injuries || [])) {
    const tid = String(t.id || ''); const team = (t.displayName || '').split(' ').pop();
    for (const x of (t.injuries || [])) {
      const a = x.athlete || {}; const pid = athId(a); if (!pid) continue;
      const rec = { n: a.displayName, s: x.status || '', d: x.details && (x.details.type || x.details.detail) || '', t: tid };
      seen[pid] = rec;
      if (players.includes(pid)) {
        const prev = await env.KV.get(`pinj:${lk}:${pid}`, 'json');
        if (prev && (prev.s !== rec.s || prev.d !== rec.d)) await deliver(env, subs, `${lk}:${pid}`, 'inj', { title: `${rec.n}: ${rec.s}`, body: `${rec.d || 'Injury report'}${prev.s !== rec.s ? ` (was ${prev.s})` : ''}`, tag: `inj:${pid}`, url: `#player/${lk}/${pid}`, league: lk }, 'players');
        if (!prev || prev.s !== rec.s || prev.d !== rec.d) await env.KV.put(`pinj:${lk}:${pid}`, JSON.stringify(rec));
      }
    }
    if (teams.includes(tid)) {
      const cur = {}; (t.injuries || []).forEach(x => { const pid = athId(x.athlete); if (pid && /out|suspen/i.test(x.status || '')) cur[pid] = { n: x.athlete.displayName, s: x.status, d: x.details && x.details.type || '' }; });
      const prev = await env.KV.get(`inj:${lk}:${tid}`, 'json');
      if (prev) {
        for (const [pid, x] of Object.entries(cur)) if (!prev[pid]) await deliver(env, subs, `${lk}:${tid}`, 'inj', { title: `${team}: ${x.n} out`, body: `${x.d || x.s}${x.d ? ' · ' + x.s : ''}`, tag: `inj:${pid}`, url: `#player/${lk}/${pid}`, league: lk });
        for (const [pid, x] of Object.entries(prev)) if (!cur[pid]) await deliver(env, subs, `${lk}:${tid}`, 'inj', { title: `${team}: ${x.n} off the injury report`, body: 'No longer listed out', tag: `inj:${pid}`, url: `#player/${lk}/${pid}`, league: lk });
      }
      if (JSON.stringify(cur) !== JSON.stringify(prev || null)) await env.KV.put(`inj:${lk}:${tid}`, JSON.stringify(cur));
    }
  }
  // a followed player who dropped off the report entirely is back
  for (const pid of players) { if (seen[pid]) continue; const prev = await env.KV.get(`pinj:${lk}:${pid}`, 'json'); if (prev) { await deliver(env, subs, `${lk}:${pid}`, 'inj', { title: `${prev.n} is off the injury report`, body: `Was ${prev.s}${prev.d ? ' · ' + prev.d : ''}`, tag: `inj:${pid}`, url: `#player/${lk}/${pid}`, league: lk }, 'players'); await env.KV.delete(`pinj:${lk}:${pid}`); } }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url); const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname.startsWith('/espn/')) return proxy(req, env, h);
    if (url.pathname === '/sync') return sync(req, env, h);
    if (url.pathname === '/health') return json({ ok: true, publicKey: env.VAPID_PUBLIC || '' }, 200, h);
    if (url.pathname === '/subscribe' && req.method === 'POST') {
      let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      if (!b.sub || !b.sub.endpoint || !b.sub.keys) return json({ error: 'no subscription' }, 400, h);
      const teams = (b.teams || []).filter(t => /^[a-z]+:\d+$/.test(t)).slice(0, 60); const players = (b.players || []).filter(t => /^[a-z]+:\d+$/.test(t)).slice(0, 60);
      const id = await sha(b.sub.endpoint);
      if (!teams.length && !players.length) { await env.KV.delete('sub:' + id); return json({ ok: true, teams: 0, players: 0 }, 200, h); }
      await env.KV.put('sub:' + id, JSON.stringify({ sub: b.sub, teams, players, prefs: b.prefs || {}, t: Date.now() }));
      return json({ ok: true, teams: teams.length, players: players.length }, 200, h);
    }
    if (url.pathname === '/unsubscribe' && req.method === 'POST') {
      let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      if (b.endpoint) await env.KV.delete('sub:' + await sha(b.endpoint));
      return json({ ok: true }, 200, h);
    }
    if (url.pathname === '/test' && req.method === 'POST') {
      let b; try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
      const v = await env.KV.get('sub:' + await sha(b.endpoint || ''), 'json'); if (!v) return json({ error: 'not subscribed' }, 404, h);
      const st = await sendPush(env, v.sub, { title: 'RIVL alerts are on', body: 'Tip-off, close games, finals and injury changes for your teams and players.', tag: 'welcome', url: '#home' });
      return json({ ok: st < 300, status: st }, 200, h);
    }
    if (url.pathname === '/run' && req.headers.get('x-rivl-cron') === (env.CRON_TOKEN || 'rivl')) {
      const lk = url.searchParams.get('lk'); const what = url.searchParams.get('what') || 'games';
      const subs = await loadSubs(env);
      if (what === 'games') await runLeague(env, lk, subs); else await runInjuries(env, lk, subs);
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404, h);
  },
  async scheduled(event, env, ctx) {
    const self = env.SELF_URL || ''; if (!self) { console.log('set SELF_URL'); return; }
    const minute = new Date().getUTCMinutes();
    const subs = await loadSubs(env);
    const leagues = [...new Set(subs.flatMap(s => [...(s.teams || []), ...(s.players || [])].map(t => t.split(':')[0])))].filter(lk => LEAGUES[lk]);
    const H = { headers: { 'x-rivl-cron': env.CRON_TOKEN || 'rivl' } };
    const calls = leagues.map(lk => fetch(`${self}/run?lk=${lk}&what=games`, H).catch(() => null));
    if (minute % 15 === 3) leagues.forEach(lk => calls.push(fetch(`${self}/run?lk=${lk}&what=injuries`, H).catch(() => null)));
    ctx.waitUntil(Promise.all(calls));
  }
};
