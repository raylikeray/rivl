/* RIVL worker — one Cloudflare Worker, no dependencies. Two jobs:
   1. /espn/*   a caching proxy in front of ESPN's public feeds, so the app never sees a throttle and loads faster
   2. /sync     your follows and settings behind a short code, so a second device can pick them up
   Push alerts were removed (they ran a cron every minute). There is no scheduled handler any more: delete the Cron Trigger
   in the Cloudflare dashboard and this worker only works when the app asks it something.
   Bindings: KV (KV namespace). Variables: ALLOWED_ORIGINS (comma list). */
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
/* The subscribers live in ONE key, read once a minute. The old way — a KV list plus one get per subscriber on every
   cron tick — spent 1,440 list operations a day against a free-tier cap of 1,000, before any alert had been sent.
   The index is rewritten only when someone subscribes or unsubscribes, or a push endpoint is found dead; and on the
   first run after this change it is built once from the old per-subscriber keys. */

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url); const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname.startsWith('/espn/')) return proxy(req, env, h);
    if (url.pathname === '/sync') return sync(req, env, h);
    if (url.pathname === '/health') return json({ ok: true }, 200, h);
    return json({ error: 'not found' }, 404, h);
  }
};
