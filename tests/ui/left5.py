import os, sys, json, re, time
os.makedirs('audit', exist_ok=True)
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
PAGES = [('settings', '#settings/menu'), ('teams', '#teams'), ('players', '#players'), ('record', '#record'), ('following', '#settings/following'), ('about', '#settings/about'), ('homeset', '#settings/home'), ('watchset', '#settings/watch'), ('app', '#settings/app'), ('you', '#settings')]
tag = sys.argv[1] if len(sys.argv) > 1 else 'a'
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
        for k, h in PAGES:
            pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(3000); pg.screenshot(path=f'audit/{tag}-{scheme}-{k}.png', full_page=True)
            if scheme == 'dark' and tag == 'a': open(f'audit/{k}.html', 'w').write(pg.evaluate("document.querySelector('#main').innerHTML"))
        ctx.close()
        # a brand new visitor, with the new design switched on
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script("localStorage.setItem('hw:v5:rv27','true');"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/'); pg.wait_for_timeout(3500); pg.screenshot(path=f'audit/{tag}-{scheme}-onb1.png')
        if scheme == 'dark' and tag == 'a': open('audit/onb1.html', 'w').write(pg.evaluate("document.body.innerHTML")[:60000])
        try:
            pg.tap('text=Pick my teams'); pg.wait_for_timeout(2500); pg.screenshot(path=f'audit/{tag}-{scheme}-onb2.png')
            if scheme == 'dark' and tag == 'a': open('audit/onb2.html', 'w').write(pg.evaluate("document.body.innerHTML")[:90000])
        except Exception as ex: print('onb2', str(ex)[:120])
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image, ImageDraw
for scheme in ['dark', 'light']:
    ks = ['settings', 'teams', 'players', 'record', 'following', 'about', 'homeset', 'watchset', 'app', 'you'] if tag != 'a' else ['settings', 'teams', 'players', 'record', 'onb1', 'onb2']; ims = []
    for k in ks:
        try: im = Image.open(f'audit/{tag}-{scheme}-{k}.png').convert('RGB')
        except Exception: continue
        im = im.crop((0, 0, im.width, min(1500, im.height))); ims.append((k, im.resize((int(im.width * .62), int(im.height * .62)))))
    W = sum(i.width for _, i in ims) + 8 * len(ims); o = Image.new('RGB', (W, 948), '#555'); d = ImageDraw.Draw(o); x = 0
    for k, i in ims: o.paste(i, (x, 18)); d.text((x + 4, 3), k, fill='#fff'); x += i.width + 8
    o.save(f'audit/s-{tag}-{scheme}.png')
