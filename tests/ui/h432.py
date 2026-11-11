exec(open('tt.py').read().split("scheme=sys.argv")[0])
import sys, datetime, feedfx3
today = datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%d')
def rt(r, q):
    if '_wide.jpg' in q.url: return r.fulfill(status=200, content_type='image/jpeg', body=open('wide.jpg','rb').read())
    if '_sq.png' in q.url: return r.fulfill(status=200, content_type='image/png', body=open('sq.png','rb').read())
    if 'record.json' in q.url: return r.fulfill(status=200, content_type='application/json', body=feedfx3.record_json(today))
    if 'espncdn.com' in q.url and 'teamlogos' in q.url:
        import re, os
        m = re.search(r'/nba/500/(\w+)\.png', q.url)
        if m and os.path.exists(f'pn/{m.group(1)}.png'): return r.fulfill(status=200, content_type='image/png', body=open(f'pn/{m.group(1)}.png','rb').read())
    return espn(r, q) if any(k in q.url for k in ['espn', 'googleapis', 'gstatic', 'workers.dev']) else r.continue_()
src = open('hv3.py').read(); init = src[src.index('ctx.add_init_script(')+len('ctx.add_init_script('):]; init = init[:init.index('\n')].rstrip(')')
E = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 900}, device_scale_factor=2, service_workers='block', color_scheme=theme, is_mobile=True, has_touch=True)
        ctx.add_init_script(eval(init))
        pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:300])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(4500)
        pg.screenshot(path=f'h432-{theme}.png')
        print(theme, pg.evaluate("[!!document.querySelector('.fh2'), document.querySelectorAll('.hwire .fp').length, getComputedStyle(document.querySelector('.hdr')).backgroundColor, document.documentElement.dataset.htab]"))
        pg.evaluate("window.scrollTo(0,500)"); pg.wait_for_timeout(700); pg.screenshot(path=f'h432s-{theme}.png')
        pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(300)
        pg.click('.lgt:nth-child(2)'); pg.wait_for_timeout(3000); pg.screenshot(path=f'h432n-{theme}.png')
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
for t in ['dark','light']:
    ims=[Image.open(f'{n}-{t}.png') for n in ['h432','h432s','h432n']]
    o=Image.new('RGB',(sum(i.width for i in ims)+20,ims[0].height),'#777'); x=0
    for i in ims: o.paste(i,(x,0)); x+=i.width+10
    o.resize((o.width//2,o.height//2)).save(f'h432all-{t}.png')
