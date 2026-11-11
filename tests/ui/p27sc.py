import sys, json, re
w = open('p27w.py').read(); exec(w.rsplit("\nwith sync_playwright() as p:", 1)[0])
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and E.append('c:' + m.text[:200])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#scores'); pg.wait_for_timeout(4500)
        print(scheme, pg.evaluate("[!!document.querySelector('#sc27'), document.querySelectorAll('.g27').length, !!document.querySelector('.hero27'), [...document.querySelectorAll('.sl27')].map(x => x.textContent), document.querySelector('#mn27').textContent, document.querySelector('.wp27 a.on').textContent, document.querySelector('#wk27').scrollLeft, document.documentElement.scrollWidth]"))
        pg.screenshot(path=f'p27sc-{scheme}.png'); pg.evaluate('window.scrollTo(0, 500)'); pg.wait_for_timeout(300); pg.screenshot(path=f'p27sc-{scheme}2.png'); pg.evaluate('window.scrollTo(0, 0)')
        if scheme == 'dark':
            print(' rows', pg.evaluate("[...document.querySelectorAll('.g27')].slice(0,4).map(x => x.textContent.replace(/\\s+/g,' ').slice(0,60))"))
            nxt = pg.evaluate("(() => { const a = [...document.querySelectorAll('.wp27 a')]; const i = a.findIndex(x => x.classList.contains('on')); return a[i + 1].dataset.ymd; })()")
            pg.tap(f'.wp27 a[data-ymd="{nxt}"]'); pg.wait_for_timeout(1800)
            print(' next day', pg.evaluate("[document.querySelector('.wp27 a.on').dataset.ymd, document.querySelector('#mn27').textContent, document.querySelectorAll('.g27').length, (document.querySelector('.em27')||{}).textContent, location.hash]"), nxt)
            pg.screenshot(path='p27sc-next.png')
            pg.tap('#seg27 [data-s27="standings"]'); pg.wait_for_timeout(2000); print(' standings', pg.evaluate("[location.hash, !document.querySelector('#sh27').hidden, document.querySelector('#seg27 a.on').textContent]")); pg.screenshot(path='p27sc-st.png')
            pg.tap('#seg27 [data-s27="scores"]'); pg.wait_for_timeout(1500); pg.tap('.hero27'); pg.wait_for_timeout(1500); print(' game', pg.evaluate("location.hash")); pg.go_back(); pg.wait_for_timeout(1500); print(' back', pg.evaluate("[location.hash, !!document.querySelector('#sc27')]"))
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f) for f in ['p27sc-dark.png', 'p27sc-dark2.png', 'p27sc-light.png', 'p27sc-next.png']]
H = min(max(i.height for i in ims), 2600); o = Image.new('RGB', (sum(i.width for i in ims) + 30, H), '#444'); x = 0
for i in ims: o.paste(i.crop((0, 0, i.width, min(i.height, H))), (x, 0)); x += i.width + 10
o = o.resize((o.width // 2, o.height // 2)); o.save('p27sc.png'); print(o.size)
