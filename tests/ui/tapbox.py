import os; os.makedirs('audit', exist_ok=True)
import sys, json, re, time
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
ORD = "(() => { const b = [...document.querySelectorAll('th > button')].find(x => x.textContent.trim() === 'PTS' && x.offsetParent); const t = b.closest('table'); return [...t.querySelectorAll('tbody tr')].slice(0, 6).map(r => r.innerText.replace(/\\s+/g, ' ').slice(0, 14)).join(' | '); })()"
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='light', is_mobile=True, has_touch=True, device_scale_factor=1)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#game/nba/401909952'); pg.wait_for_timeout(3200); pg.tap('#gtabs .chip >> text=Box'); pg.wait_for_timeout(1200)
    print('before', pg.evaluate(ORD))
    for dy, lab in [(-8, '8px above'), (0, 'on it'), (28, '8px below')]:
        bb = pg.evaluate("(() => { const b = [...document.querySelectorAll('th > button')].find(x => x.textContent.trim() === 'PTS' && x.offsetParent); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top, r.height, document.elementFromPoint(r.left + r.width / 2, r.top - 8).tagName, document.elementFromPoint(r.left + r.width / 2, r.bottom + 7).tagName + '.' + document.elementFromPoint(r.left + r.width / 2, r.bottom + 7).className]; })()")
        pg.touchscreen.tap(bb[0], bb[1] + dy); pg.wait_for_timeout(500); print(lab, bb[3:], '->', pg.evaluate(ORD))
    pg.screenshot(path='audit/c-light-box.png'); b.close()
