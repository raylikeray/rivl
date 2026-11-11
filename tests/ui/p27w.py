import sys, json, re
src = open('p27g.py').read()
exec(src.split("with sync_playwright() as p:")[0])
_rtw = rt
def rt(r, q):
    u = q.url
    if re.search(r'/athletes/\d+$', u): return r.fulfill(status=200, content_type='application/json', body=json.dumps({'athlete': {'displayName': 'Jordan Reyes', 'shortName': 'J. Reyes', 'team': {'id': '18', 'abbreviation': 'NY', 'shortDisplayName': 'Knicks', 'color': '1d428a'}, 'headshot': {'href': HS('nba', 99)}}}))
    return _rtw(r, q)
def drag(cdp, pg, x0, y0, x1, y1, n=8, ms=16):
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
    for i in range(1, n + 1):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / n, 'y': y0 + (y1 - y0) * i / n}]}); pg.wait_for_timeout(ms)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
ST = "(() => { const e = document.querySelector('.story'); if (!e) return null; const w = e.__w; return [w.si, w.sub.key, w.item && w.item.id, w.paused, e.className, w.sub.its.length]; })()"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and E.append('c:' + m.text[:200])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(5000); cdp = ctx.new_cdp_session(pg)
        pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(1600)
        s0 = pg.evaluate(ST); print(scheme, 'open', s0)
        print(' bar', pg.evaluate("[document.querySelector('#tb27 a.on').dataset.t27, document.querySelector('.story').getBoundingClientRect().bottom, document.querySelector('#tb27').getBoundingClientRect().top, getComputedStyle(document.querySelector('#tb27')).backgroundColor]"))
        print(' tabs', pg.evaluate("[...document.querySelectorAll('.wt27 button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : ''))"), 'lists', pg.evaluate("document.querySelector('.story').__subs.map(x => x.its.length)"))
        print(' video', pg.evaluate("(() => { const v = document.querySelector('.story video.on'); return [v.videoWidth + 'x' + v.videoHeight, v.paused, (v.dataset.u || '').split('/').pop().slice(-14)]; })()"))
        pg.wait_for_timeout(600); pg.screenshot(path=f'p27w-{scheme}.png')
        if scheme == 'dark':
            d0 = pg.evaluate("document.querySelector('.story video.on').duration"); pg.wait_for_timeout(int(d0 * 1000) + 1200); sL = pg.evaluate(ST); print(' clip ended -> same clip, playing again', sL[2] == s0[2], pg.evaluate("(() => { const v = document.querySelector('.story video.on'); return [v.loop, v.paused, +v.currentTime.toFixed(1), +v.duration.toFixed(1)]; })()"))
            drag(cdp, pg, 200, 600, 200, 300); pg.wait_for_timeout(900); s1 = pg.evaluate(ST); print(' pulled up -> next', s1[2] != s0[2], s1[:4])
            drag(cdp, pg, 200, 300, 200, 600); pg.wait_for_timeout(900); s2 = pg.evaluate(ST); print(' pulled down -> back', s2[2] == s0[2])
            drag(cdp, pg, 200, 300, 200, 600); pg.wait_for_timeout(900); print(' pulled down at the first clip stays', pg.evaluate(ST)[2] == s0[2], 'still open', pg.evaluate("!!document.querySelector('.story')"))
            drag(cdp, pg, 200, 600, 200, 560); pg.wait_for_timeout(600); print(' short pull stays', pg.evaluate(ST)[2] == s0[2], pg.evaluate("document.querySelector('.stpane').style.transform"))
            # mid-drag picture
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 200, 'y': 600}]})
            for i in range(1, 7): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 200, 'y': 600 - i * 40}]}); pg.wait_for_timeout(16)
            pg.screenshot(path='p27w-drag.png'); cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); pg.wait_for_timeout(900)
            pg.tap('.stpane', position={'x': 150, 'y': 400}); pg.wait_for_timeout(400); print(' tap pauses', pg.evaluate(ST)[3:5], pg.evaluate("document.querySelector('.story video.on').paused")); pg.screenshot(path='p27w-pause.png')
            pg.tap('.stpane', position={'x': 150, 'y': 400}); pg.wait_for_timeout(400); print(' tap plays', pg.evaluate(ST)[3], pg.evaluate("document.querySelector('.story video.on').paused"))
            IND = "(() => { const i = document.querySelector('.wi27'), r = i.getBoundingClientRect(), b = document.querySelector('.wt27 button.on').getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(b.left + b.width / 2), document.querySelector('.wt27 button.on').textContent]; })()"
            print(' underline at open', pg.evaluate(IND))
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 330, 'y': 450}]})
            for i in range(1, 7): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 330 - i * 30, 'y': 450}]}); pg.wait_for_timeout(16)
            print(' mid swipe', pg.evaluate("[document.querySelector('.stpane').style.transform, document.querySelector('.wpeek27').style.transform, document.querySelector('.wi27').style.transform]")); pg.screenshot(path='p27w-hdrag.png')
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); pg.wait_for_timeout(120); print(' sliding', pg.evaluate("document.querySelector('.story').__st.busy"))
            pg.wait_for_timeout(700); print(' swipe left -> next tab', pg.evaluate(ST)[:2], pg.evaluate(IND), pg.evaluate("[document.querySelector('.stpane').style.transform, document.querySelector('.wpeek27').style.display]"))
            drag(cdp, pg, 200, 450, 170, 450, n=4, ms=60); pg.wait_for_timeout(500); print(' short sideways pull stays', pg.evaluate(ST)[:2], pg.evaluate(IND))
            drag(cdp, pg, 320, 450, 120, 450); pg.wait_for_timeout(700); print(' swipe left on the last tab stays', pg.evaluate(ST)[:2])
            pg.tap('.wt27 button:nth-child(1)'); pg.wait_for_timeout(150); print(' underline on its way', pg.evaluate(IND)); pg.wait_for_timeout(650); print(' tap Following (two tabs over)', pg.evaluate(ST)[:2], pg.evaluate(IND), pg.evaluate("localStorage.getItem('hw:v5:wtab')"))
            pg.tap('.stact [data-stb="like"]'); pg.wait_for_timeout(300); print(' like', pg.evaluate("document.querySelector('.stact [data-stb=like]').classList.contains('on')"))
            print(' who', pg.evaluate("(() => { const w = document.querySelector('.wa27'), n = document.querySelector('.wn27'); return [w && !w.hidden, !!(w && w.querySelector('[data-wact=follow]')), n && n.textContent]; })()"))
            if pg.query_selector('.wa27 [data-wact="follow"]'):
                pg.tap('.wa27 [data-wact="follow"]'); pg.wait_for_timeout(500); print(' follow ->', pg.evaluate("JSON.parse(localStorage.getItem('hw:v5:players')).map(p => p.name)"))
            # loop at the end
            pg.evaluate("(() => { const w = document.querySelector('.story').__st; w.last(); })()"); pg.wait_for_timeout(500); last = pg.evaluate(ST)[2]
            drag(cdp, pg, 200, 600, 200, 300); pg.wait_for_timeout(900); print(' past the end starts over', pg.evaluate(ST)[2] != last, pg.evaluate("document.querySelector('.story').__st.ii"))
            # another tab from the bar
            pg.tap('#tb27 [data-t27="scores"]'); pg.wait_for_timeout(1500); print(' scores from watch', pg.evaluate("[location.hash, !!document.querySelector('.story'), document.querySelector('#tb27 a.on').dataset.t27, document.documentElement.className.includes('w27on')]"))
            pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(1500); pg.go_back(); pg.wait_for_timeout(900); print(' back closes', pg.evaluate("[location.hash, !!document.querySelector('.story')]"))
            pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(1500); pg.tap('.ws27'); pg.wait_for_timeout(1200); print(' search', pg.evaluate("[location.hash, !!document.querySelector('.story')]"))
        ctx.close()
    # a shared link
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(4000); pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(1500)
    tid = pg.evaluate("document.querySelector('.story').__w.sub.its[6].id"); ctx.close()
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#watch/' + tid); pg.wait_for_timeout(6000); print('shared link', pg.evaluate("[location.hash, !!document.querySelector('.story.w27v')]"), pg.evaluate(ST)[2] == tid if pg.evaluate("!!document.querySelector('.story')") else None)
    b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f) for f in ['p27w-dark.png', 'p27w-hdrag.png', 'p27w-drag.png', 'p27w-light.png']]
o = Image.new('RGB', (sum(i.width for i in ims) + 30, ims[0].height), '#444'); x = 0
for i in ims: o.paste(i, (x, 0)); x += i.width + 10
o = o.resize((o.width // 2, o.height // 2)); o.save('p27w.png'); print(o.size)
