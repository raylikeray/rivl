import os; os.makedirs('audit', exist_ok=True)
import sys, json, re, time
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
_rt4 = rt
DOWN = [False]
def rt(r, q):
    if DOWN[0] and ('espn' in q.url or 'workers.dev' in q.url): return r.abort()
    return _rt4(r, q)
with sync_playwright() as p:
    b = p.chromium.launch()
    # 1. the feeds are down
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=1)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); E2 = []; pg.on('pageerror', lambda e: E2.append(str(e)[:160])); pg.route('**/*', rt); DOWN[0] = True
    for k, h in [('home', '#home'), ('scores', '#scores'), ('game', '#game/nba/401909952'), ('team', '#team/nba/25')]:
        pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(9000); pg.screenshot(path=f'audit/down-{k}.png')
        print('feeds down', k, '|', pg.evaluate("(document.querySelector('#main').innerText || '').replace(/\\s+/g, ' ').slice(0, 260)"))
    print('errors while down', E2[:4]); ctx.close(); DOWN[0] = False
    # 2. a brand new visitor
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page(); pg.route('**/*', rt); pg.goto('http://localhost:8777/rivl/'); pg.wait_for_timeout(4000); pg.screenshot(path='audit/new-1.png')
    print('new visitor sees |', pg.evaluate("document.body.innerText.replace(/\\s+/g, ' ').slice(0, 400)"))
    print('buttons', pg.evaluate("[...document.querySelectorAll('button, a[href]')].filter(e => e.offsetParent).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 24)).filter(Boolean).slice(0, 14)"))
    print('preview flag for a new visitor', pg.evaluate("localStorage.getItem('hw:v5:rv27')"), 'html class', pg.evaluate("document.documentElement.className"))
    ctx.close(); b.close()
