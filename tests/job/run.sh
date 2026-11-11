#!/bin/sh
# Dry-runs the clip job (scripts/stories.mjs) against made-up games. Nothing touches the real data folder.
# Usage: sh tests/job/run.sh            (from the repo root)
set -e
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd); tmp=$(mktemp -d)
mkdir -p "$tmp/scripts" && cp "$root/scripts/stories.mjs" "$root/scripts/night.mjs" "$tmp/scripts/" && cp "$here"/run*.mjs "$here"/night*.mjs "$tmp/"
cd "$tmp"
echo "== plays, kinds, longer videos (expect: 5 kinds, 1 clutch, 5 longer)"; node run2.mjs | grep -E "^(feed|more|library) "
rm -rf data; echo "== game winner, then aging into the library"; node run3.mjs | grep -E "^(feed|more|library) "
rm -rf data; echo "== a ten-day-old game on a normal run (expect nothing kept)"; node run4.mjs | grep -E "^(feed|more|library) "
rm -rf data; echo "== the same game on a library fill (expect 5 plays, 3 longer)"; BACKFILL=28 node run4.mjs | grep -E "^(feed|more|library) "
rm -rf data; echo "== the nightly job: seven nights (expect a run of 7, 2 triple-doubles, a season-high 44, 7 wins in a row, tally 7)"; BACKFILL=9 node night1.mjs | grep -E "^(check|note|earlier|night) "
echo "== the same again (expect asked 0 and the same counts)"; BACKFILL=9 RUN=2 node night1.mjs | grep -E "^(check|night) "
rm -rf "$tmp"
