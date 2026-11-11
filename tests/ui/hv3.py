exec(open('tt.py').read().split("scheme=sys.argv")[0])
import sys, datetime, feedfx3
theme = sys.argv[1] if len(sys.argv) > 1 else 'light'
today = datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%d')
def rt(r, q):
    if 'record.json' in q.url: return r.fulfill(status=200, content_type='application/json', body=feedfx3.record_json(today))
    return espn(r, q) if any(k in q.url for k in ['espn', 'googleapis', 'gstatic', 'workers.dev']) else r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block', color_scheme=theme, is_mobile=True, has_touch=True)
    ctx.add_init_script("localStorage.setItem('hw:v5:onboarded','true');localStorage.setItem('hw:v5:install','x');localStorage.setItem('hw:v5:lk','\"nba\"');localStorage.setItem('hw:favs',JSON.stringify({nba:['25','18','20']}));")
    pg = ctx.new_page(); E = []
    pg.on('pageerror', lambda e: E.append(str(e)[:300]))
    pg.on('console', lambda m: E.append('console: ' + m.text[:200]) if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(4000)
    cnt = lambda: pg.evaluate("[document.querySelectorAll('.hfeed section[data-sec=river] .fp').length, !!document.querySelector('.hfeed [data-more]'), !!document.querySelector('.hend'), [...document.querySelectorAll('.hfeed .fh span')].map(x=>x.textContent).join(',').slice(0,400)]")
    print('first', cnt())
    for i in range(8):
        pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(1300)
        print('scroll', i, cnt()[:3])
    pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(400)
    pg.screenshot(path=f'v425-home-{theme}.png', full_page=True)
    print('buttons', pg.evaluate("[...document.querySelectorAll('.hfeed .cliptog,.hfeed .fmorebtn')].length"), 'errors', E[:5])
    b.close()
