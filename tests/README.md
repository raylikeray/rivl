# RIVL tests

These are the checks run before each release. They were written during the 2027 redesign and saved here on 2026-11-10 so they are not lost.

## What is here
- `ui/`: the app opened in a test browser at phone size, with stand-in game data and drawn stand-in faces (no real photos). Each script prints what it checked and ends with `errs []` when nothing broke.
- `job/`: the clip job (`scripts/stories.mjs`) run against made-up games.

## Running the screen tests
They need Python 3 with Playwright (`pip install playwright pillow`, then `playwright install chromium`).

1. Serve the folder that holds this repo, with the repo folder named `rivl`:
   `cd <folder above the repo> && python3 -m http.server 8777`
2. From `tests/ui`, run a script: `python3 p27w_r.py`

| Script | What it covers |
|---|---|
| `p27w_r.py` | Watch: open, loop, pull up and down, pause, tabs, underline, like, follow, share link |
| `p27lib.py real` | Watch against the real clip library in `data/` (also `all`, `nolib`) |
| `p27real.py`, `p27mix.py` | The Watch order rules |
| `st460.py` | Home's For you ring and what it learns |
| `p27q.py` | Search |
| `p27you.py`, `p27crop.py` | The You page and the photo crop screen |
| `p27sub.py`, `left5.py` | Teams, Players, Record, Settings and its pages: title bar, back, league pills, stars, switches; screenshots of each |
| `p27sc.py`, `p27gh.py`, `p27ring.py` | Score cards, the game header, the profile ring |
| `audit.py`, `audit_b.py` | The audit: every page, light and dark, with counts for small tap targets, small text, faint text, missing names |
| `audit2.py`, `audit3.py` | Start-up timing on a slowed processor, and what Home asks for |
| `audit4.py` | The app with the score feeds cut off, and as a new visitor |
| `shots.py`, `tapbox.py` | Clean screenshots; the box score column heads' touch area |

Screenshots land in `tests/ui` and `tests/ui/audit` and are not committed.

## Running the job tests
`sh tests/job/run.sh` from the repo root. Needs Node 20 or newer.

## Helpers
`srv.py` starts the local server for you if none is running. `fixtures.py`, `feedfx.py`, `feedfx3.py` and `tourney.py` are the stand-in feeds.

## Not done yet
These do not run by themselves on each push. That is the next step.
