import sys, json, re, copy
w = open('p27w.py').read(); exec(w.rsplit("\nwith sync_playwright() as p:", 1)[0])
_r3 = rt; GS = open('gsum.json').read()
def rt(r, q):
    if 'summary?event=401909952' in q.url: return r.fulfill(status=200, content_type='application/json', body=GS)
    return _r3(r, q)
JS = """(() => { window.scrollTo(0, 1e7); return new Promise(r => setTimeout(() => { const tb = document.querySelector('#tb27'); const top = tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect().top : innerHeight;
  let low = 0, who = ''; document.querySelectorAll('#main *').forEach(e => { const cs = getComputedStyle(e); if (cs.position === 'fixed' || cs.visibility === 'hidden' || !e.offsetParent) return; if (e.closest('.tpanel:not(.on),.gpanel[hidden]')) return; const b = e.getBoundingClientRect(); if (!b.width || !b.height) return; const leaf = !e.children.length || e.matches('tr,td,a,button'); if (leaf && b.bottom > low && b.left < innerWidth && b.right > 0) { low = b.bottom; who = e.tagName + '.' + String(e.className).slice(0, 30) + ' ' + (e.textContent || '').trim().slice(0, 24); } });
  r([Math.round(top), Math.round(low), Math.round(top - low), who]); }, 500)); })()"""
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=1)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
    for h in sys.argv[1:] or ['#game/nba/401909952', '#scores', '#standings', '#stats', '#team/nba/25', '#settings', '#settings/menu', '#settings/following', '#search', '#home']:
        pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(5000)
        if h.startswith('#game'):
            n = pg.evaluate("document.querySelectorAll('#gtabs .chip').length")
            for i in range(n):
                pg.evaluate("window.scrollTo(0,0)"); pg.tap(f'#gtabs .chip:nth-child({i + 1})'); pg.wait_for_timeout(900); print(h, i, pg.evaluate(JS))
                if i == 1: pg.screenshot(path='p27bt-box.png')
        else: print(h, pg.evaluate(JS))
    ctx.close(); b.close()
print('errs', E)
