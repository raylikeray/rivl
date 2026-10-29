# The RIVL worker

One Cloudflare Worker (free plan), no dependencies. It does three things:

1. **Proxy** — `GET /espn/...` fetches ESPN's public feeds through Cloudflare's cache, so the app is faster and never sees a throttle.
2. **Sync** — `POST /sync` stores your follows and settings behind a six-character code; `GET /sync?code=` returns them.
3. **Alerts** — a cron runs once a minute and sends web-push notifications for your teams and players: tip-off, close games, finals, injury changes.

## Setup (about ten minutes, all on cloudflare.com)

1. **Account.** cloudflare.com → Sign up (free). No domain needed.
2. **Worker.** Workers & Pages → Create → Create Worker → name it `rivl` → Deploy. Then Edit code: delete the sample, paste the whole of `worker.js`, Deploy.
3. **KV.** Storage & Databases → KV → Create namespace → name `rivl`. Back in the worker: Settings → Bindings → Add → KV namespace → variable name `KV`, namespace `rivl`.
4. **Variables.** Worker → Settings → Variables and Secrets → add:
   - `VAPID_PUBLIC` = the key in `config.js` (`PUSH.key`)
   - `VAPID_PRIVATE_JWK` = the private key JSON (sent separately; add it as a **Secret**)
   - `VAPID_SUBJECT` = `mailto:your@email`
   - `ALLOWED_ORIGINS` = `https://raylikeray.github.io`
   - `SELF_URL` = the worker's own URL, e.g. `https://rivl.<your-subdomain>.workers.dev`
   - `CRON_TOKEN` = any random word
5. **Cron.** Worker → Settings → Triggers → Cron Triggers → Add → `* * * * *` (every minute).
6. **Tell the app.** Put the worker URL into `config.js` → `WORKER`. From then on the app reads ESPN through the proxy, Settings gains Alerts and Sync, and alerts work with RIVL closed (iPhone: from the home-screen app).

## Free-plan budget
Every minute the cron fans out one request per league that has subscribers. Injuries are checked every 15 minutes. KV writes happen only when something is sent or changes — far below the free limits for a handful of people.

## Endpoints
- `GET /health` → `{ ok, publicKey }`
- `GET /espn/site/...`, `/espn/v2/...`, `/espn/web/...`, `/espn/core/...`, `/espn/now/...` → the ESPN feed, cached 15 s (scoreboards, summaries) to 15 min (rosters, bios)
- `POST /sync` `{ code?, data }` → `{ ok, code }`; `GET /sync?code=ABC123` → `{ ok, data }`
- `POST /subscribe` `{ sub, teams: ["nba:25"], players: ["nba:4593803"], prefs: { pre, close, final, inj } }`
- `POST /unsubscribe` `{ endpoint }`
- `POST /test` `{ endpoint }` → sends a test notification
