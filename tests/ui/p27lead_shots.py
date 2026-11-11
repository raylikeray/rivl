import os, sys, json, re
os.makedirs('audit', exist_ok=True)
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
tag = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['light', 'dark']:
        ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#players'); pg.wait_for_timeout(2500); pg.tap('#lgtabs .lgt >> nth=1'); pg.wait_for_timeout(3000)
        if scheme == 'light' and tag == 'a':
            s = pg.evaluate("document.querySelector('#main').innerHTML"); s = re.sub(r'<svg.*?</svg>', '<svg/>', s, flags=re.S); s = re.sub(r'(src|data-snap|onerror|data-o|style)="[^"]*"', '', s)
            i = s.find('Leaders'); print(len(s)); print(s[:900]); print('....'); print(s[max(0, i - 500):i + 2300])
        try: pg.evaluate("(() => { const h = [...document.querySelectorAll('#main h2')].find(x => /Leaders/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -260); })()")
        except Exception as ex: print(ex)
        pg.wait_for_timeout(500); pg.screenshot(path=f'audit/bug-{tag}-{scheme}-players.png')
        pg.goto('http://localhost:8777/rivl/#settings/following'); pg.wait_for_timeout(2500); pg.evaluate("(() => { const h = [...document.querySelectorAll('#main h2')].find(x => /Players/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); })()"); pg.wait_for_timeout(400); pg.screenshot(path=f'audit/bug-{tag}-{scheme}-following.png'); print(scheme, 'strip behind the clock', pg.evaluate("document.querySelector('meta[name=theme-color]').content"))
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
fs = [f'audit/bug-{tag}-light-players.png', f'audit/bug-{tag}-dark-players.png', f'audit/bug-{tag}-dark-following.png', f'audit/bug-{tag}-light-following.png']
o = Image.new('RGB', (392 * 4, 832), '#777')
for i, f in enumerate(fs): o.paste(Image.open(f).convert('RGB').resize((384, 832)), (i * 392, 0))
o.save(f'audit/s-bug-{tag}.png')
