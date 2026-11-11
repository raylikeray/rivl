import os; os.makedirs('audit', exist_ok=True)
import sys, json, re, time
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
PAGES = [('home', '#home'), ('game', '#game/nba/401909952'), ('team', '#team/nba/25'), ('player', '#player/nba/4278073'), ('standings', '#standings'), ('stats', '#stats'), ('search', '#search'), ('record', '#record')]
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['light', 'dark']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
        for k, h in PAGES:
            pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(3200); pg.screenshot(path=f'audit/c-{scheme}-{k}.png', full_page=True)
            if k == 'game' and scheme == 'light':
                pg.tap('#gtabs .chip >> text=Box'); pg.wait_for_timeout(1200); pg.screenshot(path='audit/c-light-box.png')
                # tap just above a column head: the larger touch area should sort
                bb = pg.evaluate("(() => { const b = [...document.querySelectorAll('.gpanel:not([hidden]) th > button')].find(x => x.textContent.trim() === 'PTS' && x.offsetParent); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top, r.height, b.closest('th').className]; })()")
                pg.touchscreen.tap(bb[0], bb[1] - 7); pg.wait_for_timeout(600)
                print('tap 7px above PTS sorts:', bb[3], '->', pg.evaluate("(() => { const b = [...document.querySelectorAll('.gpanel:not([hidden]) th > button')].find(x => x.textContent.trim() === 'PTS' && x.offsetParent); return b.closest('th').className + ' | first row ' + b.closest('table').querySelector('tbody tr').innerText.replace(/\\s+/g, ' ').slice(0, 40); })()"))
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image, ImageDraw
def sheet(scheme, ks, out, H=1500, sc=0.6):
    ims = []
    for k in ks:
        im = Image.open(f'audit/c-{scheme}-{k}.png').convert('RGB'); im = im.crop((0, 0, im.width, min(H, im.height))); ims.append((k, im.resize((int(im.width * sc), int(im.height * sc)))))
    W = sum(i.width for _, i in ims) + 8 * len(ims); o = Image.new('RGB', (W, int(H * sc) + 18), '#555'); d = ImageDraw.Draw(o); x = 0
    for k, i in ims: o.paste(i, (x, 18)); d.text((x + 4, 3), k, fill='#fff'); x += i.width + 8
    o.save(out)
sheet('light', ['game', 'box', 'team', 'player', 'standings'], 'audit/s-c-light.png'); sheet('dark', ['game', 'team', 'player', 'stats', 'record'], 'audit/s-c-dark.png')
