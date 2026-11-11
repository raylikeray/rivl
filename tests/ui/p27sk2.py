w = open('p27w.py').read(); exec(w.rsplit("\nwith sync_playwright() as p:", 1)[0])
V = "(() => { const e = document.querySelector('.story'), v = e.querySelector('video.on'); return [Math.round(v.currentTime * 10) / 10, v.playbackRate, v.paused, v.loop, e.className.replace('story ', ''), e.__w.item.id, e.__w.rate, e.__w.auto, !!e.querySelector('.wsh27'), !!e.querySelector('.wtp27')]; })()"
def ts(cdp, x, y): cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
def tm(cdp, x, y): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]})
def te(cdp): cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
shots = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt); cdp = ctx.new_cdp_session(pg)
    def shot(n): f = f'p27sk2-{n}.png'; pg.screenshot(path=f); shots.append(f)
    pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(5000)
    pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(2200); print('open, guide shows', pg.evaluate(V)); shot('tips')
    pg.tap('.wtp27 [data-wtp]'); pg.wait_for_timeout(500); print('guide gone', pg.evaluate(V)[-1], pg.evaluate("localStorage.getItem('hw:v5:wtips27')"))
    y = 915 - pg.evaluate("document.querySelector('#tb27').offsetHeight") - 8
    ts(cdp, 60, y); pg.wait_for_timeout(120); tm(cdp, 300, y); pg.wait_for_timeout(200); shot('seek'); print('seek', pg.evaluate(V)[:5]); te(cdp); pg.wait_for_timeout(400)
    ts(cdp, 370, 300); pg.wait_for_timeout(500); print('hold right', pg.evaluate(V)[:5]); shot('2x'); te(cdp); pg.wait_for_timeout(300); print('released', pg.evaluate(V)[:5])
    ts(cdp, 206, 400); pg.wait_for_timeout(700); print('hold middle -> sheet', pg.evaluate(V)); te(cdp); pg.wait_for_timeout(400); print('  after release still open, playing', pg.evaluate(V)[1:3], pg.evaluate(V)[-2]); shot('sheet')
    pg.tap('.wsp27 [data-v="1.5"]'); pg.wait_for_timeout(500); print('1.5x picked', pg.evaluate(V))
    ts(cdp, 370, 300); pg.wait_for_timeout(500); te(cdp); pg.wait_for_timeout(300); print('  after a 2x hold, back to 1.5', pg.evaluate(V)[1])
    drag(cdp, pg, 200, 600, 200, 300); pg.wait_for_timeout(1200); print('next clip, speed back to 1', pg.evaluate(V)[:7])
    ts(cdp, 206, 400); pg.wait_for_timeout(700); te(cdp); pg.wait_for_timeout(300); pg.tap('[data-wsh="auto"]'); pg.wait_for_timeout(300); print('auto on', pg.evaluate(V)[3:8], pg.evaluate("localStorage.getItem('hw:v5:wauto')")); shot('auto'); pg.tap('.wshb27', position={'x': 200, 'y': 100}); pg.wait_for_timeout(500)
    i0 = pg.evaluate(V)[5]; pg.wait_for_timeout(5200); print('auto scroll moved on', pg.evaluate(V)[5] != i0, pg.evaluate(V)[:6])
    ts(cdp, 206, 400); pg.wait_for_timeout(700); te(cdp); pg.wait_for_timeout(300); pg.tap('[data-wsh="auto"]'); pg.wait_for_timeout(200); pg.tap('[data-wsh="clear"]'); pg.wait_for_timeout(500); print('clear', pg.evaluate(V)[4], pg.evaluate("getComputedStyle(document.querySelector('.stact')).opacity")); shot('clear')
    pg.tap('.wcx27'); pg.wait_for_timeout(300); print('shown again', pg.evaluate(V)[4])
    i1 = pg.evaluate(V)[5]; ts(cdp, 206, 400); pg.wait_for_timeout(700); te(cdp); pg.wait_for_timeout(300); pg.tap('[data-wsh="no"]'); pg.wait_for_timeout(900); print('not interested -> next', pg.evaluate(V)[5] != i1, pg.evaluate(V)[-2:])
    ts(cdp, 206, 400); pg.wait_for_timeout(700); te(cdp); pg.wait_for_timeout(300); pg.tap('[data-wsh="tips"]'); pg.wait_for_timeout(500); print('guide from sheet', pg.evaluate(V)[-2:]); pg.tap('.wtp27 [data-wtp]'); pg.wait_for_timeout(400)
    ts(cdp, 206, 400); pg.wait_for_timeout(60); te(cdp); pg.wait_for_timeout(300); print('tap pauses', pg.evaluate(V)[2:5])
    pg.tap('#tb27 [data-t27="home"]'); pg.wait_for_timeout(1200); pg.tap('.sc27'); pg.wait_for_timeout(1500); ts(cdp, 206, 400); pg.wait_for_timeout(600); print('story: hold still pauses', pg.evaluate("(() => { const e = document.querySelector('.story'); return e ? [e.className, !!e.querySelector('.wsh27')] : null; })()")); te(cdp)
    ctx.close(); b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f) for f in shots]
o = Image.new('RGB', (sum(i.width for i in ims) + 10 * len(ims), ims[0].height), '#444'); x = 0
for i in ims: o.paste(i, (x, 0)); x += i.width + 10
o = o.resize((o.width // 2, o.height // 2)); o.save('p27sk2.png'); print(o.size)
