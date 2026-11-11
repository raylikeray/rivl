import sys, json, re, time
exec(open('p27w.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
_rt_lib = rt
OLD = {}
def rt(r, q):
    if 'feed-old.json' in q.url: return r.fulfill(status=200, content_type='application/json', body=json.dumps(OLD)) if OLD else r.fulfill(status=404, body='')
    return _rt_lib(r, q)
def main():
    global FEED, OLD
    R = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(sys.argv[0])), '..', '..', 'data') + '/'
    feed = json.load(open(R + 'feed.json')); now = int(time.time() * 1000); shift = now - max(i['ts'] for i in feed['items'])
    for k in ['items', 'more']:
        for i in feed[k]: i['ts'] += shift
    FEED = feed
    mode = sys.argv[1] if len(sys.argv) > 1 else 'lib'
    if mode.startswith('real'):
        OLD = json.load(open(R + 'feed-old.json')); print('real library', len(OLD['items']), len(OLD['more']), len(OLD['best']))
    elif not mode.startswith('nolib'):
        olds, oldm = [], []
        for day in range(3, 27):
            for n, i in enumerate(feed['items']):
                if n % 2 == day % 2: olds.append(dict(i, id=i['id'] + 'd%d' % day, ts=i['ts'] - day * 86400000, u=i['u']))
            for n, i in enumerate(feed['more']):
                if n % 4 == day % 4: oldm.append(dict(i, id=i['id'] + 'd%d' % day, ts=i['ts'] - (day + 2) * 86400000))
        best = [dict(i, id=i['id'] + 'b', ts=i['ts'] - 60 * 86400000, w=.31 - n * .01, gw=1 if n < 2 else 0) for n, i in enumerate(feed['items'][:20])]
        OLD = {'updated': 'x', 'items': olds, 'more': oldm, 'best': best}
        print('library plays', len(olds), 'longer', len(oldm), 'best', len(best), 'bytes', len(json.dumps(OLD)))
    FAV = "localStorage.setItem('hw:v5:wtips27','true');" + ("localStorage.setItem('hw:favs','{}');localStorage.setItem('hw:v5:players','[]');" if mode.endswith('all') else '')
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=2)
        ctx.add_init_script(eval(init) + PL + FLAG + FAV); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(9000)
        print('ready before tap', pg.evaluate("[HW.v5.x27.watchReady(), ['nba','wnba','ncaam','ncaaw'].map(k => !!HW.v5.x27.feedSource(k).out)]"))
        pg.evaluate("(() => { const o = HW.v5.storyOpen; window.__so = 0; HW.v5.storyOpen = function () { const t = performance.now(); const r = o.apply(this, arguments); window.__so = performance.now() - t; return r; }; })()")
        t0 = time.time(); pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_selector('.story', timeout=8000); t1 = time.time(); pg.wait_for_timeout(1500)
        print('opened in %.2fs' % (t1 - t0), 'label on clip:', pg.evaluate("!!document.querySelector('.wkd27')"))
        print('storyOpen ms', pg.evaluate('Math.round(window.__so)'))
        print('lists', pg.evaluate("document.querySelector('.story').__subs.map(x => [x.name, x.its.length])"))
        print('build time ms', pg.evaluate("(() => { const t = performance.now(); HW.v5.x27.watchSubs(); return Math.round(performance.now() - t); })()"))
        info = pg.evaluate("""(() => { const S = document.querySelector('.story').__subs, now = Date.now(); const age = it => Math.round((now - it.ts) / 864e5);
          const fy = S.find(x => x.key === 'w:fy').its, fol = S.find(x => x.key === 'w:fol').its, top = S.find(x => x.key === 'w:top').its;
          const row = it => [age(it) + 'd', it.vk || it.ck, (it.L || {}).key, it.title.slice(0, 38), +(it.w || 0).toFixed(2), it.gw || 0];
          return { fyAges: [0, 50, 100, 200, 300, 500, 1000, 2000].filter(i => i < fy.length).map(i => i + ':' + age(fy[i]) + 'd'), fyFirst: fy.slice(0, 6).map(row), fol: fol.slice(0, 30).map(row).filter((x, i) => i % 3 === 0), folMine: fol.filter(it => it.sk || 1).length, top: top.slice(0, 16).map(row).filter((x, i) => i % 2 === 0),
            ids: new Set(fy.map(i => i.id)).size === fy.length }; })()""")
        for k, v in info.items(): print(k, json.dumps(v)[:1500])
        pg.screenshot(path='p27lib.png'); ctx.close(); b.close()
    print('errs', E)
main()
