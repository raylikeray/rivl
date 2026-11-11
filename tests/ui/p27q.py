import sys
s = open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0]; exec(s)
QS = sys.argv[1:] or ['', 'luka', 'who leads the nba in scoring', 'zzzqqq']
shots = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + FLAG + "localStorage.setItem('hw:v5:xrecent', JSON.stringify(['Thunder injuries','Luka vs Shai','rookie leaders']));"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(4000)
        pg.tap('.sf27'); pg.wait_for_timeout(2500)
        for q in (QS if scheme == 'dark' else QS[:2]):
            if q: pg.fill('#xq', q); pg.wait_for_timeout(3500)
            f = 'p27q-%s-%s.png' % (scheme, (q or 'empty').replace(' ', '_')[:14]); pg.screenshot(path=f, full_page=True); shots.append(f)
            if scheme == 'dark': print(repr(q), pg.evaluate("[document.querySelector('#xres').innerText.slice(0, 160), document.querySelector('#xwebb').innerText.slice(0, 80)]"))
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f) for f in shots]
H = min(1500, max(i.height for i in ims)); o = Image.new('RGB', (sum(i.width for i in ims) + 10 * len(ims), H), '#444'); x = 0
for i in ims: o.paste(i.crop((0, 0, i.width, min(H, i.height))), (x, 0)); x += i.width + 10
o.save('p27q.png'); print(o.size)
