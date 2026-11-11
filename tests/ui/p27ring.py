w = open('p27w.py').read(); exec(w.rsplit("\nwith sync_playwright() as p:", 1)[0])
shots = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for scheme in ['light', 'dark']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + FLAG + "localStorage.setItem('hw:v5:wtips27','true');"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(4500)
        pg.goto('http://localhost:8777/rivl/#player/nba/4278073'); pg.wait_for_timeout(4500)
        R = "(() => { const bn = document.querySelector('.bn27'), av = document.querySelector('.apface'), rb = bn && bn.querySelector('.hrb27'); return [bn && bn.dataset.ring, av && av.dataset.pstory, !!rb, rb && rb.dataset.pstory, bn && getComputedStyle(bn.querySelector('.hr27')).backgroundImage.slice(0, 40)]; })()"
        print(scheme, pg.evaluate(R)); f = f'p27ring-{scheme}-new.png'; pg.screenshot(path=f); shots.append(f)
        if scheme == 'light':
            pg.tap('.hrb27', position={'x': 14, 'y': 110}); pg.wait_for_timeout(1500); print(' ring tap opens story', pg.evaluate("(() => { const e = document.querySelector('.story'); return e ? e.className : null; })()"))
            for i in range(14): pg.mouse.click(380, 400); pg.wait_for_timeout(250)
            pg.wait_for_timeout(800); print(' after watching', pg.evaluate("!!document.querySelector('.story')"), pg.evaluate(R)[:1])
            if pg.evaluate("!!document.querySelector('.story')"): pg.go_back(); pg.wait_for_timeout(800)
            pg.wait_for_timeout(600); print(' ring now', pg.evaluate(R)); f = 'p27ring-light-seen.png'; pg.screenshot(path=f); shots.append(f)
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f).crop((0, 0, 412, 440)) for f in shots]
o = Image.new('RGB', (422 * len(ims), 440), '#444')
for i, im in enumerate(ims): o.paste(im, (i * 422, 0))
o.save('p27ring.png')
