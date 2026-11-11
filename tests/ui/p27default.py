# v510: the 2027 design is the default; Settings has a Legacy design switch as the way back
import os, sys, json, re
os.makedirs('audit', exist_ok=True)
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
NOFLAG = FLAG.replace("localStorage.setItem('hw:v5:rv27','true');", '')
ST = "[document.documentElement.classList.contains('rv27'), !document.getElementById('tb27').hidden, localStorage.getItem('hw:v5:rv27'), getComputedStyle(document.querySelector('#tabs') || document.body).display]"
with sync_playwright() as p:
    b = p.chromium.launch()
    # 1. someone who already uses the app and never touched the switch
    ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(eval(init) + PL + NOFLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(3000); print('no choice stored -> [new design, new bar, stored, old tabs]', pg.evaluate(ST)); pg.screenshot(path='audit/def-home.png')
    pg.goto('http://localhost:8777/rivl/#settings/menu'); pg.wait_for_timeout(1500)
    print('settings rows', pg.evaluate("[...document.querySelectorAll('.set380 .gm b')].map(x => x.textContent)"), 'legacy switch', pg.evaluate("document.querySelector('[data-act=rv27]').getAttribute('aria-checked')"))
    pg.evaluate("document.querySelector('[data-act=rv27]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300); pg.screenshot(path='audit/def-settings.png')
    pg.tap('[data-act="rv27"]'); pg.wait_for_timeout(900); print('legacy on ->', pg.evaluate(ST), 'switch', pg.evaluate("document.querySelector('[data-act=rv27]').getAttribute('aria-checked')"), 'toast', pg.evaluate("(document.querySelector('.toast') || {}).textContent"))
    b.close()
    # 2. the choice survives a restart, and the switch brings the new design back
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(eval(init) + PL + NOFLAG + "if (!sessionStorage.getItem('once')) { sessionStorage.setItem('once', '1'); localStorage.setItem('hw:v5:rv27', 'false'); }"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(3000); print('legacy stored, fresh start ->', pg.evaluate(ST)); pg.screenshot(path='audit/def-legacy-home.png')
    pg.goto('http://localhost:8777/rivl/#settings/menu'); pg.wait_for_timeout(1500); print('legacy settings: switch', pg.evaluate("document.querySelector('[data-act=rv27]').getAttribute('aria-checked')")); pg.evaluate("document.querySelector('[data-act=rv27]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300); pg.screenshot(path='audit/def-legacy-settings.png')
    pg.tap('[data-act="rv27"]'); pg.wait_for_timeout(900); print('legacy off ->', pg.evaluate(ST), 'toast', pg.evaluate("(document.querySelector('.toast') || {}).textContent"))
    pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(2500); print('home again ->', pg.evaluate(ST))
    ctx.close()
    # 3. a brand new visitor: first-run screens, then the new design
    ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/'); pg.wait_for_timeout(3500); print('new visitor', pg.evaluate("[document.documentElement.classList.contains('rv27'), document.body.innerText.replace(/\\s+/g,' ').slice(0, 60)]")); pg.screenshot(path='audit/def-new1.png')
    pg.tap('text=Pick my teams'); pg.wait_for_timeout(2000)
    for i in range(8):
        btn = pg.evaluate("(() => { const b = [...document.querySelectorAll('button, a')].filter(e => e.offsetParent && /^(Next|Done|Finish|Skip|Start|Continue|Go)/i.test((e.innerText || '').trim())); return b.length ? b[b.length - 1].innerText.trim() : ''; })()")
        if not btn: break
        if i == 0: pg.tap('.onb-row >> nth=0') if pg.query_selector('.onb-row') else None
        pg.evaluate("(() => { const b = [...document.querySelectorAll('button, a')].filter(e => e.offsetParent && /^(Next|Done|Finish|Skip|Start|Continue|Go)/i.test((e.innerText || '').trim())); b[b.length - 1].click(); })()"); pg.wait_for_timeout(1500)
    pg.wait_for_timeout(2500); print('after first run -> [new design, new bar, stored]', pg.evaluate(ST)[:3], 'hash', pg.evaluate('location.hash'), '| first words:', pg.evaluate("(document.querySelector('#main').innerText || '').replace(/\\s+/g,' ').slice(0, 80)")); pg.screenshot(path='audit/def-new2.png')
    ctx.close()
    # 4. the Watch shortcut on the home-screen icon
    ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(eval(init) + PL + NOFLAG + "localStorage.setItem('hw:v5:wtips27','true');"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:200])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#watch'); pg.wait_for_timeout(5000); print('Watch shortcut opens Watch:', pg.evaluate("!!document.querySelector('.story.w27v')"), pg.evaluate('location.hash'))
    b.close()
print('errs', E)
from PIL import Image
fs = ['audit/def-home.png', 'audit/def-settings.png', 'audit/def-legacy-settings.png', 'audit/def-legacy-home.png', 'audit/def-new2.png']; ims = [Image.open(f).convert('RGB').resize((307, 666)) for f in fs]
o = Image.new('RGB', (315 * len(ims), 666), '#777')
for i, im in enumerate(ims): o.paste(im, (i * 315, 0))
o.save('audit/s-default.png')
