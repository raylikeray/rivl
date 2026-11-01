# The RIVL worker

One Cloudflare Worker (free plan), no dependencies. It does two things:

1. **Proxy** — `GET /espn/...` fetches ESPN's public feeds through Cloudflare's cache, so the app is faster and never sees a throttle.
2. **Sync** — `POST /sync` stores your follows and settings behind a six-character code; `GET /sync?code=` returns them.

## Setup (about ten minutes, all on cloudflare.com)

1. **Account.** cloudflare.com → Sign up (free). No domain needed.
2. **Worker.** Workers & Pages → Create → Create Worker → name it `rivl` → Deploy. Then Edit code: delete the sample, paste the whole of `worker.js`, Deploy.
3. **KV.** Storage & Databases → KV → Create namespace → name `rivl`. Back in the worker: Settings → Bindings → Add → KV namespace → variable name `KV`, namespace `rivl`.
4. **Variables.** Worker → Settings → Variables and Secrets → add:
   - `ALLOWED_ORIGINS` = `https://raylikeray.github.io`
5. **No cron.** If a Cron Trigger exists from before (Worker → Settings → Triggers), delete it: alerts were removed and the trigger only costs requests.
6. **Tell the app.** Put the worker URL into `config.js` → `WORKER`. From then on the app reads ESPN through the proxy and Settings gains Sync.
