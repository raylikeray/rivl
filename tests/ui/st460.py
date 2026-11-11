exec(open("st459.py").read().split("\nE = []; shots = []")[0])
ms = lambda h: int((NOW - _dt.timedelta(hours=h)).timestamp() * 1000)
F = lambda i, t, a, w=None, h=10, tm=["25", "7"], lk="nba": dict({"id": str(97000 + i), "lk": lk, "e": "1", "ts": ms(h), "t": t, "u": f"wsc/2026/1110/{U(i)}", "d": 4, "a": a, "tm": tm}, **({"w": w} if w is not None else {}))
FEED = {"updated": iso(0), "items": [F(1, "Random Guy hits the triple", ["111"], .01, 30, ["1", "2"]), F(2, "Shai Gilgeous-Alexander gets up for the slam", [SGA], .02, 12), F(3, "Big Swing drains the game-winner at the buzzer", ["222"], .55, 11, ["3", "4"]),
  F(4, "Other Player throws down the hammer", ["333"], .03, 9, ["5", "6"]), F(5, "Jamal Murray gets the and-1 to fall", [MUR], .04, 10), F(6, "Old Clip from three days ago", ["444"], .5, 70), F(7, "College Player nails the 3", ["555"], .2, 5, ["9", "8"], "ncaaw"), F(8, "Another Guy denies it with block", ["666"], 0, 4, ["5", "6"])]}
_rt = rt
def rt(r, q):
    if 'feed.json' in q.url: return r.fulfill(status=200, content_type='application/json', body=_json.dumps(FEED))
    return _rt(r, q)
E = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for scheme, w, h in [('dark', 412, 900), ('light', 360, 740)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True)
        ctx.add_init_script(eval(init) + PL + "localStorage.setItem('hw:v5:rv27','false');"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:300])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(5600)
        print(scheme, 'bubbles', pg.evaluate("[...document.querySelectorAll('.sbub')].map(b => b.dataset.key + ':' + b.querySelector('small').textContent)"))
        pg.evaluate("document.querySelector('.sbubs').scrollLeft = 9999"); pg.wait_for_timeout(200); pg.screenshot(path=f's460-row-{scheme}.png', clip={'x': 0, 'y': 0, 'width': w, 'height': 270})
        if scheme == 'light': ctx.close(); continue
        pg.click('.sbub[data-key="all:feed"]'); pg.wait_for_timeout(900)
        S = "document.querySelector('.story').__st"
        print('feed items'); [print('   ', x) for x in pg.evaluate(S + ".items")]
        print('kind', pg.evaluate(S + ".kind"), 'ii', pg.evaluate(S + ".ii"))
        # 1. leave the first clip at once with a flick up: counts against; 2. let the second run to the end: counts for
        pg.mouse.move(200, 600); pg.mouse.down()
        for y in range(600, 440, -20): pg.mouse.move(202, y); pg.wait_for_timeout(12)
        pg.mouse.up(); pg.wait_for_timeout(300); print('after flick ii', pg.evaluate(S + ".ii"), 'title', pg.evaluate("document.querySelector('.story .stcap b').textContent")); pg.screenshot(path='s460-feed.png')
        print('taste after skip', pg.evaluate("localStorage.getItem('hw:v5:taste')"))
        pg.wait_for_timeout(4600); print('after auto ii', pg.evaluate(S + ".ii")); print('taste after finish', pg.evaluate("localStorage.getItem('hw:v5:taste')"))
        pg.click('.story .stx'); pg.wait_for_timeout(700)
        print('reopen bubbles', pg.evaluate("[...document.querySelectorAll('.sbub')].map(b => b.dataset.key).filter(k => /feed/.test(k))"))
        pg.click('.sbub[data-key="all:feed"]'); pg.wait_for_timeout(800); print('second visit'); [print('   ', x) for x in pg.evaluate(S + ".items")]
        ctx.close()
    b.close()
print('errs', E)
