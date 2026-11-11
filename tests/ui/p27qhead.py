# v512: the top of the player answer in Search (photo, name, arrow) opens the player's page
import sys, json, re
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        for scheme in ['dark', 'light']:
            ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
            pg.goto('http://localhost:8777/rivl/#search'); pg.wait_for_timeout(4000)
            pg.fill('#xq', 'shai'); pg.wait_for_timeout(4000)
            print(scheme, pg.evaluate("(() => { const c = document.querySelector('.xpfull'); if (!c) return ['no full card', document.querySelector('#main').textContent.slice(0, 200)]; const h = c.querySelector(':scope > .xwho'), r = h.getBoundingClientRect(); return [h.tagName, h.getAttribute('href'), Math.round(r.width), Math.round(r.height), !!h.querySelector('.chev'), c.querySelectorAll('a').length, h.textContent.slice(0, 40)]; })()"))
            pg.screenshot(path=f'p27qhead-{scheme}.png')
            if scheme == 'dark':
                r = pg.evaluate("(() => { const r = document.querySelector('.xpfull > .xwho .chev').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
                pg.touchscreen.tap(r[0], r[1]); pg.wait_for_timeout(1800); print(' arrow tapped ->', pg.evaluate("[location.hash, document.documentElement.dataset.page]"))
                pg.go_back(); pg.wait_for_timeout(2500); pg.fill('#xq', 'shai'); pg.wait_for_timeout(3500)
                r = pg.evaluate("(() => { const r = document.querySelector('.xpfull > .xwho b').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; })()")
                pg.touchscreen.tap(r[0], r[1]); pg.wait_for_timeout(1800); print(' name tapped ->', pg.evaluate("[location.hash, document.documentElement.dataset.page]"))
            ctx.close()
        b.close()
    print('errs', E)
main()
