import sys,json,datetime; sys.path.insert(0,'.')
import srv, fixtures
from playwright.sync_api import sync_playwright
today=datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%d'); errs=[]
def espn(route, request):
    u=request.url
    if 'espncdn.com' in u: return route.fulfill(status=200, content_type='image/png', body=open('fake_hs.png' if 'headshots' in u else 'fake_crest.png','rb').read())
    if 'espn.com' not in u: return route.abort()
    route.fulfill(status=200, content_type='application/json', body=json.dumps(fixtures.handle(u,today)), headers={'access-control-allow-origin':'*'})
scheme=sys.argv[1]; w=int(sys.argv[2])
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':w,'height':844},device_scale_factor=2,color_scheme=scheme,service_workers='block')
    ctx.add_init_script("localStorage.setItem('hw:favs',JSON.stringify({nba:['25']}));localStorage.setItem('hw:v5:onboarded','true')")
    pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.route('**/*',lambda r,q: espn(r,q) if any(k in q.url for k in ['espn','googleapis','gstatic','workers.dev']) else r.continue_())
    pg.goto('http://localhost:8777/rivl/#team/nba/25'); pg.wait_for_timeout(3000)
    pg.screenshot(path=f'tt-{scheme}-{w}-a.png')
    pg.mouse.wheel(0,700); pg.wait_for_timeout(500); pg.screenshot(path=f'tt-{scheme}-{w}-b.png')
    for t in ['schedule','roster','stats']:
        pg.click(f'#ttabs [data-tab="{t}"]'); pg.wait_for_timeout(450); pg.screenshot(path=f'tt-{scheme}-{w}-{t}.png')
        print(t, pg.evaluate("window.scrollY"), pg.evaluate("document.documentElement.scrollWidth"))
    b.close()
print(errs)
