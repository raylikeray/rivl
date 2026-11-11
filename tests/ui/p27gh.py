import json, copy
w = open('p27w.py').read(); exec(w.rsplit("\nwith sync_playwright() as p:", 1)[0])
_r3 = rt; GS = open('gsum.json').read()
def rt(r, q):
    if 'summary?event=401909952' in q.url: return r.fulfill(status=200, content_type='application/json', body=GS)
    return _r3(r, q)
shots = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#game/nba/401909952'); pg.wait_for_timeout(5000)
        if scheme == 'dark': print(pg.evaluate("(() => { const g = document.querySelector('#gpage'); return [g.style.cssText, [...document.querySelectorAll('#ghead .g2ds')].map(a => a.getAttribute('href')), document.querySelector('#ghead .g2dc').className, (document.querySelector('#ghead .g2df') || {}).innerText]; })()"))
        f = f'p27gh-{scheme}.png'; pg.screenshot(path=f); shots.append(f)
        if scheme == 'dark':
            pg.evaluate("window.scrollTo(0, 500)"); pg.wait_for_timeout(700); f = 'p27gh-pinned.png'; pg.screenshot(path=f); shots.append(f); pg.evaluate("window.scrollTo(0, 0)")
            ids = pg.evaluate("[...document.querySelectorAll('#g2strip a.g2gp')].map(a => a.getAttribute('href'))"); print(ids[:4])
            for hsh in ids[:2]:
                pg.goto('http://localhost:8777/rivl/' + hsh); pg.wait_for_timeout(3500); print(hsh, pg.evaluate("[(document.querySelector('#ghead .g2dc') || {}).className, (document.querySelector('#ghead') || {}).innerText && document.querySelector('#ghead').innerText.replace(/\\n+/g, ' | ').slice(0, 90)]")); f = 'p27gh-%s.png' % hsh.split('/')[-1]; pg.screenshot(path=f); shots.append(f)
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f).crop((0, 0, 412, 620)) for f in shots]
o = Image.new('RGB', (422 * len(ims), 620), '#444')
for i, im in enumerate(ims): o.paste(im, (i * 422, 0))
o.save('p27gh.png'); print(o.size)
