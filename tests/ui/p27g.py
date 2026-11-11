import sys, json
exec(open("st460.py").read().split("\nE = []\nwith sync_playwright")[0])
E = []
_rt5 = rt
def rt(r, q):
    u = q.url
    if 'headshots' in u: return r.fulfill(status=200, content_type='image/png', body=open('fake_bust_rect.png' if 'college' in u else 'fake_bust.png', 'rb').read())
    if '/media/9x16/' in u and u.endswith('.mp4'): return r.fulfill(status=200, headers={'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes'}, body=open('fake_up.mp4', 'rb').read())
    return _rt5(r, q)
HS = lambda lg, i: f"https://a.espncdn.com/i/headshots/{lg}/players/full/{i}.png"
PLS = [dict(lk='nba', id='4278073', name='Shai Gilgeous-Alexander', short='S. Gilgeous-Alexander', team='OKC', teamId='25', img=HS('nba', 4278073)), dict(lk='nba', id='3936299', name='Jamal Murray', short='J. Murray', team='DEN', teamId='7', img=HS('nba', 3936299))]
FLAG = "localStorage.setItem('hw:v5:rv27','true');localStorage.setItem('hw:v5:name','\"Ray\"');localStorage.setItem('hw:v5:players'," + json.dumps(json.dumps(PLS)) + ");localStorage.setItem('hw:favs',JSON.stringify({nba:['25','18','20','2','4','11','7']}));"
KEYS = "[...document.querySelectorAll('.sc27')].map(b => b.dataset.key.replace('nba:','') + (b.classList.contains('seen') ? '*' : ''))"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
        # no time away: this test is about the row's order, not Catch up
        ctx.add_init_script(eval(init) + PL + FLAG + "localStorage.setItem('hw:v5:last27', String(Date.now()));"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home')
        if scheme == 'dark':
            seq = []
            for t in [400, 500, 800, 1500, 3000, 7500]: pg.wait_for_timeout(t); seq.append(pg.evaluate(KEYS))
            for s in seq: print('  load', s)
            print('cache', len(json.loads(pg.evaluate("localStorage.getItem('hw:v5:st27')") or '[]')))
            pg.evaluate("document.querySelector('.st27').scrollLeft = 300"); pg.wait_for_timeout(200)
            # refresh the feed the way a pull does: the home tab tapped at the top
            pg.evaluate("HW.v5.refresh && HW.v5.refresh()"); a1 = []
            for t in [200, 600, 1500, 3000]: pg.wait_for_timeout(t); a1.append(pg.evaluate(KEYS) == seq[-1])
            print('same row through a refresh', a1, 'scroll kept', pg.evaluate("document.querySelector('.st27').scrollLeft"))
            pg.evaluate("document.querySelector('.st27').scrollLeft = 0"); pg.wait_for_timeout(1400); pg.tap('.sc27:nth-child(2)'); pg.wait_for_timeout(1300)
            n = pg.evaluate("""(() => { const k = document.querySelector('.sc27:nth-child(2)').dataset.key; const x = HW.v5.x27.storySubjects().find(y => y.key === k); const s = JSON.parse(localStorage.getItem('hw:v5:storyseen') || '{}'); s[k] = x.its.map(i => i.id); localStorage.setItem('hw:v5:storyseen', JSON.stringify(s)); return x.its.length; })()""")
            pg.screenshot(path='p27g-view-pl.png', clip={'x': 0, 'y': 0, 'width': 412, 'height': 120})
            print('watched all', n, 'of the first story; row while open unchanged', pg.evaluate(KEYS) == seq[-1]); pg.tap('.story .stx'); pg.wait_for_timeout(1200)
            after = pg.evaluate(KEYS); print('after closing', after); seq.append(after)
            # a finger on the row holds the order
            pg.reload(); pg.wait_for_timeout(350); print('reopen, first moment', pg.evaluate(KEYS) == seq[-1]); pg.wait_for_timeout(7500); print('reopen, settled', pg.evaluate(KEYS) == seq[-1], pg.evaluate(KEYS))
            tk = pg.evaluate("[...document.querySelectorAll('.sc27')].map(b => b.dataset.key).find(k => /:t\\d+$/.test(k))"); print('team key', tk)
            pg.evaluate(f"document.querySelector('.sc27[data-key=\"{tk}\"]').scrollIntoView({{inline:'center'}})"); pg.wait_for_timeout(1500); pg.tap(f'.sc27[data-key="{tk}"]'); pg.wait_for_timeout(1300)
            pg.screenshot(path='p27g-view-tm.png', clip={'x': 0, 'y': 0, 'width': 412, 'height': 120}); pg.tap('.story .stx'); pg.wait_for_timeout(900)
            pk = 'nba:p4278073'
            pg.evaluate(f"document.querySelector('.sc27[data-key=\"{pk}\"]').scrollIntoView({{inline:'center'}})"); pg.wait_for_timeout(1500); pg.tap(f'.sc27[data-key="{pk}"]'); pg.wait_for_timeout(1300)
            print('player ring', pg.evaluate("(() => { const r = document.querySelector('.story .sthd .ring'), h = r.querySelector('.hs'), i = h && h.querySelector('img'); const q = e => e ? [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)] : null; return [q(r), q(h), q(i), i && getComputedStyle(i).transform]; })()"))
            pg.screenshot(path='p27g-view-pl.png', clip={'x': 0, 'y': 0, 'width': 412, 'height': 120}); pg.tap('.story .stx'); pg.wait_for_timeout(900)
            for kk, nm in [('all:feed', 'fy'), ('nba:top', 'top')]:
                pg.evaluate(f"document.querySelector('.sc27[data-key=\"{kk}\"]').scrollIntoView({{inline:'center'}})"); pg.wait_for_timeout(1500); pg.tap(f'.sc27[data-key="{kk}"]'); pg.wait_for_timeout(1300)
                pg.screenshot(path=f'p27g-view-{nm}.png', clip={'x': 0, 'y': 0, 'width': 412, 'height': 120}); pg.tap('.story .stx'); pg.wait_for_timeout(900)
            pg.evaluate("document.querySelector('.st27').scrollLeft = 9999"); pg.wait_for_timeout(1500); pg.screenshot(path='p27g-end.png', clip={'x': 0, 'y': 120, 'width': 412, 'height': 160}); pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(200); pg.screenshot(path='p27g-end.png', clip={'x': 0, 'y': 0, 'width': 412, 'height': 300})
        else: pg.wait_for_timeout(6500)
        pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(300); pg.screenshot(path=f'p27g-{scheme}.png', clip={'x': 0, 'y': 0, 'width': 412, 'height': 330})
        if scheme == 'dark':
            pg.evaluate("document.querySelector('.st27').scrollLeft = 520"); pg.wait_for_timeout(300); pg.screenshot(path='p27g-dark2.png', clip={'x': 0, 'y': 0, 'width': 412, 'height': 330})
            pg.evaluate("document.querySelector('.x27-picks').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300); pg.screenshot(path='p27g-picks.png', clip={'x': 0, 'y': 200, 'width': 412, 'height': 520})
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f) for f in ['p27g-dark.png', 'p27g-dark2.png', 'p27g-light.png']]
o = Image.new('RGB', (ims[0].width, sum(i.height for i in ims) + 20), '#444'); y = 0
for i in ims: o.paste(i, (0, y)); y += i.height + 10
pk = Image.open('p27g-picks.png'); o2 = Image.new('RGB', (o.width + pk.width + 20, max(o.height, pk.height)), '#444'); o2.paste(o, (0, 0)); o2.paste(pk, (o.width + 20, 0)); o2.save('p27g.png'); print(o2.size)
