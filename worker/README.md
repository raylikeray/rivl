# The RIVL worker

One Cloudflare Worker (free plan), no dependencies. It does three things:

1. **Proxy** — `GET /espn/...` fetches ESPN's public feeds through Cloudflare's cache, so the app is faster and never sees a throttle.
2. **Sync** — `POST /sync` stores your follows and settings behind a six-character code; `GET /sync?code=` returns them.
3. **Alerts** — a cron runs once a minute and sends web-push notifications for your teams and players: tip-off, close games, finals, injury changes, and breaking news (ESPN's news posts about your teams and players, checked every five minutes).

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

## What the cron actually asks ESPN
The cron fires every minute, but it only works when there is something to see. Once an hour each league builds a plan from one
scoreboard read: the windows when a followed team is playing (from 25 minutes before tip, through the game), and whether the
league has any games today at all. Then:

- **games** — only inside a window. A night your teams are off costs nothing.
- **injuries** — every 15 minutes, but only from six hours before a followed tip until the game ends.
- **breaking news** — every 5 minutes while the league is playing today and it is between 7am and 1am Central; every 30 minutes
  otherwise, so a league out of season is not asked twelve times an hour.

A day with one NBA game, following teams in all four leagues: **about 740 requests**, against roughly 7,300 before this.
Alerts are unchanged — every one of them happens inside a window by definition.

`simday.mjs` counts a whole simulated day through the real `scheduled()`; `simcheck.mjs` asserts the alerts still land
(`cp worker.js worker.mjs && node simcheck.mjs`).

## Free-plan budget
The KV free tier is 100,000 reads a day but only **1,000 writes, 1,000 deletes and 1,000 lists**, and the cron fires 1,440
times a day — so anything the cron does per tick other than a read is over budget on its own. Two earlier versions tripped
Cloudflare's "nearing the daily cap" mail this way: a `list` of subscribers every minute (1,440 lists), and the live score
rewritten into KV every minute of every followed game (hundreds of writes for a value nothing read back).

What the worker does now, measured by `simday.mjs` over a simulated day: **1 list** (a one-time migration into the
`subs:all` index), **~100 writes** (the watch plan, one per league per hour, plus one mark per game seen live and one per
alert sent), and ~7,000 reads. If that mail arrives again, run `cp worker.js worker.mjs && node simday.mjs` and look at the
last line before guessing. The app itself never touches KV — the `/espn/*` proxy uses Cloudflare's edge cache — so a KV
429 stops alerts and Sync, not scores.

## Endpoints
- `GET /health` → `{ ok, publicKey }`
- `GET /espn/site/...`, `/espn/v2/...`, `/espn/web/...`, `/espn/core/...`, `/espn/now/...` → the ESPN feed, cached 15 s (scoreboards, summaries) to 15 min (rosters, bios)
- `POST /sync` `{ code?, data }` → `{ ok, code }`; `GET /sync?code=ABC123` → `{ ok, data }`
- `POST /subscribe` `{ sub, teams: ["nba:25"], players: ["nba:4593803"], prefs: { pre, close, final, inj } }`
- `POST /unsubscribe` `{ endpoint }`
- `POST /test` `{ endpoint }` → sends a test notification
