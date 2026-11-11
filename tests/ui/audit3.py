import sys, json, re, time
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
def run(b, flag, label):
    for rate in (1, 4):
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + flag + "window.__t0 = performance.now(); window.__marks = {}; new MutationObserver(() => { const m = document.querySelector('#main'); if (!m) return; const t = Math.round(performance.now()); const n = (m.innerText || '').length; if (n > 60 && !__marks.text) __marks.text = t; if (document.querySelector('.sc27, .sbub') && !__marks.stories) __marks.stories = t; if (document.querySelector('.feed .fp, .nf27, .f27') && !__marks.feed) __marks.feed = t; if (n > 600 && !__marks.full) __marks.full = t; }).observe(document, { childList: true, subtree: true });")
        pg = ctx.new_page(); pg.route('**/*', rt); cdp = ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(7000)
        print(label, 'cpu x%d' % rate, pg.evaluate('window.__marks'), 'skeleton classes', pg.evaluate("[...new Set([...document.querySelectorAll('#main [class*=skel], #main .sk')].map(e => e.className))].slice(0,3)"))
        ctx.close()
with sync_playwright() as p:
    b = p.chromium.launch()
    run(b, FLAG, 'NEW'); run(b, FLAG.replace("localStorage.setItem('hw:v5:rv27','true');", "localStorage.setItem('hw:v5:rv27','false');"), 'OLD'); b.close()
