# v513: streaks and firsts in Home's feed, nightly honors leading the league's story, and the lines in Catch up
import sys, json, re, datetime as _d
from zoneinfo import ZoneInfo
exec(open('p27w_r.py').read().split("ST = \"(() =>")[0])
W, H = 384, 832
ET = ZoneInfo('America/New_York'); nowET = _d.datetime.now(ET); YD = (nowET - _d.timedelta(days=1)).strftime('%Y-%m-%d')
at = int((_d.datetime.now(_d.timezone.utc) - _d.timedelta(hours=14)).timestamp() * 1000)
SGA_, MUR_ = '4278073', '3936299'
line = lambda i, n, tid, tm, gs, pts, reb, ast, rk=0: dict(id=i, n=n, tid=tid, tm=tm, e='399', gs=gs, pts=pts, reb=reb, ast=ast, stl=2, blk=1, tpm=3, hs=HS('nba', i), rk=rk)
NIGHT = {'updated': 'x', 'lg': {'nba': {'days': [{'d': YD, 'done': True, 'games': ['399', '1'],
  'pon': line(SGA_, 'Shai Gilgeous-Alexander', '25', 'OKC', 38.4, 44, 6, 9), 'ron': line('777', 'Cooper Stand-In', '7', 'DEN', 19.2, 21, 8, 4, 1),
  'gon': {'e': '399', 'h': {'id': '25', 'ab': 'OKC', 'nm': 'Thunder', 'sc': 118}, 'a': {'id': '7', 'ab': 'DEN', 'nm': 'Nuggets', 'sc': 109}, 'lc': 14, 'ot': 1, 'mg': 9, 'x': 30},
  'top': [], 'notes': [
    {'k': 'hot', 't': 'Shai Gilgeous-Alexander has scored 30 or more in 8 straight games.', 'v': 90, 'e': '1', 'at': at, 'p': SGA_, 'tid': '25'},
    {'k': 'td', 't': 'Jamal Murray had a triple-double: 22 points, 11 rebounds and 10 assists. The first of the season.', 'v': 71, 'e': '399', 'at': at, 'p': MUR_, 'tid': '7'},
    {'k': 'win', 't': 'The Thunder have won 8 in a row.', 'v': 54, 'e': '399', 'at': at, 'tid': '25'},
    {'k': 'high', 't': 'Somebody Else scored a season-high 41.', 'v': 61, 'e': '555', 'at': at, 'p': '999', 'tid': '2'},
    {'k': 'loss', 't': 'The Wizards have lost 9 in a row.', 'v': 38, 'e': '556', 'at': at, 'tid': '27'}]}],
  'tally': [{'id': SGA_, 'n': 'Shai Gilgeous-Alexander', 'tm': 'OKC', 'c': 4}, {'id': '3945274', 'n': 'Luka Doncic', 'tm': 'LAL', 'c': 3}, {'id': '3112335', 'n': 'Nikola Jokic', 'tm': 'DEN', 'c': 2}]}}}
REC = {'generated': 'x', 'games': [{'id': '398', 'date': YD, 'h': 'CHI', 'a': 'NY', 'hid': '4', 'aid': '18', 'hs': 101, 'as': 110, 'p': 0.74}, {'id': '399', 'date': YD, 'h': 'OKC', 'a': 'DEN', 'hid': '25', 'aid': '7', 'hs': 118, 'as': 109, 'p': 0.7}]}
_rtn = rt
def rt(r, q):
    if 'night.json' in q.url: return r.fulfill(status=200, content_type='application/json', body=json.dumps(NIGHT))
    if '/nba/record.json' in q.url: return r.fulfill(status=200, content_type='application/json', body=json.dumps(REC))
    return _rtn(r, q)
def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for scheme in ['dark', 'light']:
            ctx = b.new_context(viewport={'width': W, 'height': H}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and E.append('c:' + m.text[:200])); pg.route('**/*', rt)
            pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(9000)
            posts = pg.evaluate("[...document.querySelectorAll('.hfeed .fp')].map(p => [(p.querySelector('.fh') || {}).textContent, (p.querySelector('.fhl') || p.querySelector('.ft') || {}).textContent, p.tagName, p.getAttribute('href') || p.dataset.gclip || p.dataset.key || '', !!p.querySelector('.fth img')]).filter(x => /Streak|Season high|Triple|Player of the Night|Big night/.test(x[0] || ''))")
            print(scheme, 'feed posts'); [print('   ', x) for x in posts]
            ring = pg.evaluate("(() => { const s = HW.v5.x27.storySubjects().find(x => x.key === 'nba:top'); return s ? [s.name, s.full, s.un, s.its.map(i => i.kind === 'vid' ? 'vid' + (i.pon ? ':pon' : i.rank ? ':' + i.rank : '') : i.kind + (i.lab ? ':' + i.lab : ''))] : null; })()"); print(' ring', ring)
            print(' row card', pg.evaluate("(() => { const c = document.querySelector('.sc27[data-key=\"nba:top\"]'); return c ? c.textContent.trim() : null; })()"))
            cu = pg.evaluate("(() => { const s = HW.v5.x27.storySubjects().find(x => x.key === 'all:catch'); const y = s && s.its.find(i => i.kind === 'say'); return y ? y.rows.map(r => r.t) : null; })()"); print(' catch up lines', cu)
            el = pg.query_selector('.hfeed .fp[data-gclip]')
            if el: el.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0, -160)"); pg.wait_for_timeout(600); pg.screenshot(path=f'night-feed-{scheme}.png')
            el2 = pg.query_selector('.hfeed .fp[data-key="nba:top"]')
            if el2: el2.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0, -200)"); pg.wait_for_timeout(600); pg.screenshot(path=f'night-feed2-{scheme}.png')
            pg.evaluate("window.scrollTo(0, 0)"); pg.evaluate("HW.v5.storyOpen('nba:top')"); pg.wait_for_timeout(1400)
            kinds = pg.evaluate("document.querySelector('.story').__st.items.map(x => x.split(' | ')[0])"); print(' open', pg.evaluate("document.querySelector('.story .sthd').textContent.trim().slice(0, 30)"), kinds)
            seen = {}
            for i, kd in enumerate(kinds):
                if kd in ('honor', 'gon', 'upset', 'say'):
                    n = seen.get(kd, 0); seen[kd] = n + 1
                    pg.evaluate(f"document.querySelector('.story').__st.go({i})"); pg.wait_for_timeout(900)
                    print('  ' + kd, pg.evaluate("(() => { const c = document.querySelector('.story .stcd'); const b = [...c.children].map(e => Math.round(e.getBoundingClientRect().bottom)); return [c.textContent.replace(/\\s+/g, ' ').slice(0, 170), Math.max(...b), [...c.querySelectorAll('a')].map(a => a.getAttribute('href')).slice(0, 3)]; })()"))
                    pg.screenshot(path=f'night-{kd}{n}-{scheme}.png')
            i1 = kinds.index('play') if 'play' in kinds else -1
            if i1 >= 0: pg.evaluate(f"document.querySelector('.story').__st.go({i1})"); pg.wait_for_timeout(700); print('  first clip meta', pg.evaluate("(document.querySelector('.story .stmeta') || {}).textContent"))
            if scheme == 'dark':
                pg.go_back(); pg.wait_for_timeout(1200)
                el = pg.query_selector('.hfeed .fp[data-gclip]'); el.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0, -160)"); pg.wait_for_timeout(500); el.tap(); pg.wait_for_timeout(1600)
                print(' line with a clip plays it', pg.evaluate("(() => { const e = document.querySelector('.story'); return e ? [e.__w.sub.key, e.__w.item.title, !document.querySelector('.stact [data-wact=game]').hidden] : null; })()")); pg.go_back(); pg.wait_for_timeout(1200)
                el2 = pg.query_selector('.hfeed .fp[data-key="nba:top"]'); el2.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0, -200)"); pg.wait_for_timeout(500); el2.tap(); pg.wait_for_timeout(1500)
                print(' Player of the Night post opens the story', pg.evaluate("(() => { const e = document.querySelector('.story'); return e ? e.querySelector('.sthd').textContent.trim().slice(0, 20) : null; })()"))
            ctx.close()
        b.close()
    print('errs', E)
main()
