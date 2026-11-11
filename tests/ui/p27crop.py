s = open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0]; exec(s)
shots = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=1)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#settings'); pg.wait_for_timeout(5000)
    def shot(n): f = f'p27crop-{n}.png'; pg.screenshot(path=f); shots.append(f)
    T = "(() => { const i = document.querySelector('.crop27 img'); return i ? [Math.round(i.offsetWidth), Math.round(i.offsetHeight), i.style.transform, document.querySelector('.crop27 input').value] : null; })()"
    pg.tap('[data-you="edit"]'); pg.wait_for_timeout(400); pg.fill('#yname27', 'Ray Marshall')
    pg.tap('[data-you="pickp"]'); pg.wait_for_timeout(300); print('no orig, overlay?', pg.evaluate("!!document.querySelector('.crop27')"))
    pg.set_input_files('#yfile27', 'me-photo.jpg'); pg.wait_for_timeout(900); print('open', pg.evaluate(T)); shot('p1')
    pg.mouse.move(206, 450); pg.mouse.down(); pg.mouse.move(206, 520, steps=5); pg.mouse.up(); print('drag', pg.evaluate(T))
    pg.evaluate("(() => { const r = document.querySelector('.crop27 input'); r.value = 2; r.dispatchEvent(new Event('input', { bubbles: true })); })()"); pg.mouse.move(206, 450); pg.mouse.down(); pg.mouse.move(120, 300, steps=5); pg.mouse.up(); print('zoom+drag', pg.evaluate(T)); shot('p2')
    pg.mouse.move(206, 450); pg.mouse.down(); pg.mouse.move(2000, 2000, steps=3); pg.mouse.up(); print('clamped', pg.evaluate(T))
    pg.tap('.crop27 [data-c="ok"]'); pg.wait_for_timeout(700); print('saved', pg.evaluate("[!!document.querySelector('.crop27'), document.querySelector('#yname27').value, !!document.querySelector('.yh27.sm .yp27f img')]")); shot('p3')
    pg.tap('[data-you="pickp"]'); pg.wait_for_timeout(700); print('reopen', pg.evaluate(T)); pg.tap('.crop27 [data-c="x"]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-you=hdr][data-v=photo]').click()"); pg.wait_for_timeout(300); pg.set_input_files('#yfile27', 'me-header.jpg'); pg.wait_for_timeout(900); print('hdr open', pg.evaluate(T)); 
    pg.evaluate("(() => { const r = document.querySelector('.crop27 input'); r.value = 1.6; r.dispatchEvent(new Event('input', { bubbles: true })); })()"); shot('h1')
    pg.tap('.crop27 [data-c="ok"]'); pg.wait_for_timeout(700); shot('h2'); pg.tap('[data-you="save"]'); pg.wait_for_timeout(700); shot('h3')
    print('idb', pg.evaluate("new Promise(r => { const q = indexedDB.open('rivl-me', 1); q.onsuccess = () => { const s = q.result.transaction('kv').objectStore('kv'), k = s.getAllKeys(); k.onsuccess = () => { const v = s.getAll(); v.onsuccess = () => r(k.result.map((x, i) => x + ':' + (typeof v.result[i] === 'string' ? v.result[i].length : JSON.stringify(v.result[i])))); }; }; })"))
    ctx.close(); b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f) for f in shots]
o = Image.new('RGB', (422 * len(ims), 915), '#444')
for i, im in enumerate(ims): o.paste(im, (i * 422, 0))
o.save('p27crop.png'); print(o.size)
