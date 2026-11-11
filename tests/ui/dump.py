import os, sys, json, re
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.route('**/*', rt)
    for h in sys.argv[1:]:
        pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(2500); s = pg.evaluate("document.querySelector('#main').innerHTML")
        s = re.sub(r'<svg.*?</svg>', '<svg/>', s, flags=re.S); s = re.sub(r'src="[^"]*"', '', s); s = re.sub(r'(data-snap|onerror|data-o|style)="[^"]*"', '', s); print('=====', h, len(s)); print(s[:1700])
    b.close()
