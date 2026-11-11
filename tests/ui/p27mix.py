import sys, json, re, time
exec(open('p27w.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
def main():
    global FEED
    R = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(sys.argv[0])), '..', '..', 'data') + '/'
    feed = json.load(open(R + 'feed.json')); st = json.load(open(R + 'stories.json'))
    now = int(time.time() * 1000); shift = now - max(i['ts'] for i in feed['items'])
    KP = [('block', r'\bblock|\bswat|reject|\bdenie|\bstuff'), ('dunk', r'\bdunk|\bslam|\bjam\b|poster|alley-oop|\blob\b|flush|hammer|rocks the rim|throws down'), ('three', r'trey|3-pointer|three|from deep|triple|behind the arc|\b3\b|3-point'), ('layup', r'layup|finish|plus the foul|scoop|reverse|putback')]
    for n, i in enumerate(feed['items']):
        i['ts'] += shift
        for k, p in KP:
            if re.search(p, i['t'].lower()): i['pk'] = k; break
        if n % 23 == 0: i['cl'] = 1
    MED = re.compile(r'/espn/media/16x9/((?:wsc/)?\d{4}/\d{4}/([^/]+))/\2\.mp4')
    def vk(t, title, url, d):
        if re.search(r'(game|full) highlights\s*$', title, re.I) or t == 'Final Game Highlight': return 'reel'
        if re.search('interview|press|sound', t, re.I) or re.search('_interview_', url, re.I): return 'talk'
        if re.search('analysis', t, re.I): return 'show'
        if re.search('feature', t, re.I): return 'feat'
        if re.search('highlight|oneplay', t, re.I) and d >= 45: return 'recap'
        return ''
    more = []
    for p in st['items']:
        m = MED.search(p['url']); k = vk(p.get('k') or '', p['title'], p['url'], p['dur'])
        if not m or not k or p['dur'] < 30: continue
        more.append({'id': p['id'], 'lk': p['lk'], 'ts': now - 3600000 * (len(more) % 60), 't': p['title'], 'u': m.group(1), 'd': p['dur'], 'a': p['aths'][:6], 'tm': p['teams'], 'k': k})
    FEED = {'updated': 'x', 'items': feed['items'], 'more': more}
    print('plays', len(feed['items']), 'more', len(more), {k: sum(1 for x in more if x['k'] == k) for k in ['reel', 'talk', 'show', 'recap', 'feat']})
    FAV = "localStorage.setItem('hw:v5:wtips27','true');" + ("localStorage.setItem('hw:favs','{}');localStorage.setItem('hw:v5:players','[]');" if len(sys.argv) > 1 else '')
    LIST = """(() => { const s = document.querySelector('.story').__subs.find(x => x.key === 'w:fy'); return s.its.map(it => [it.vk || it.ck, it.vk === 'play' ? (it.pk || 'play') : (it.vk || it.ck), (it.L || {}).key, it.vk === 'reel' ? '' : (it.aths || [])[0] || '', it.gid || '', it.title.slice(0, 44), it.dur, it.cl || 0]); })()"""
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for scheme in ['dark', 'light']:
            ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(eval(init) + PL + FLAG + FAV); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
            pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(5000); cdp = ctx.new_cdp_session(pg)
            pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(2000)
            if scheme == 'dark':
                L = pg.evaluate(LIST); json.dump(L, open('p27mix.json', 'w')); n = len(L); print('for you', n)
                for i, x in enumerate(L[:36]): print('%2d %-5s %-7s %-6s %-9s %3ds %s%s' % (i + 1, x[0], x[1], x[2], x[3][-8:], x[6], x[5], '  [clutch]' if x[7] else ''))
                U = [x for x in L]   # all unwatched on a fresh phone
                v = dict(kind3=0, player5=0, game3=0, dunk9=0, long_gap=[], lgap=0)
                for i in range(len(U)):
                    if i >= 2 and U[i][1] == U[i-1][1] == U[i-2][1]: v['kind3'] += 1
                    if U[i][3] and any(U[j][3] == U[i][3] for j in range(max(0, i - 5), i)): v['player5'] += 1
                    if i >= 2 and U[i][4] and U[i][4] == U[i-1][4] == U[i-2][4]: v['game3'] += 1
                    if U[i][1] == 'dunk' and sum(1 for j in range(max(0, i - 8), i) if U[j][1] == 'dunk') >= 3: v['dunk9'] += 1
                first200 = U[:200]; kinds = {}
                for x in first200: kinds[x[1]] = kinds.get(x[1], 0) + 1
                lg = {}
                for x in first200: lg[x[2]] = lg.get(x[2], 0) + 1
                print('rule breaks over the whole list', {k: v[k] for k in ['kind3', 'player5', 'game3', 'dunk9']}, '| first 200 kinds', kinds, '| leagues', lg)
                print('where the breaks sit:', [i for i in range(2, len(U)) if U[i][1] == U[i-1][1] == U[i-2][1]][:8])
            # walk to one of each kind and shoot it
            for want in (['dunk', 'reel', 'talk', 'show'] if scheme == 'dark' else ['three', 'reel', 'talk']):
                ok = pg.evaluate("""(k) => { const e = document.querySelector('.story'), w = e.__w, its = w.sub.its; const i = its.findIndex(it => (it.vk === 'play' ? it.pk : it.vk) === k); if (i < 0) return -1; e.__st.go(i); return i; }""", want)
                pg.wait_for_timeout(1500)
                info = pg.evaluate("(() => { const e = document.querySelector('.story'), k = e.querySelector('.wkd27'), v = e.querySelector('video.on'), a = e.querySelector('.wa27'); return [k && k.innerText.replace(/\\n/g,' '), v && v.videoWidth + 'x' + v.videoHeight, a && !a.hidden, e.querySelector('.stcap').innerText.replace(/\\n/g,' | ').slice(0, 120)]; })()")
                print(scheme, want, 'at', ok, info); pg.screenshot(path=f'p27mix-{scheme}-{want}.png')
            ctx.close()
        b.close()
    print('errs', E)
    from PIL import Image
    fs = ['p27mix-dark-dunk.png', 'p27mix-dark-reel.png', 'p27mix-dark-talk.png', 'p27mix-dark-show.png', 'p27mix-light-three.png', 'p27mix-light-talk.png']
    ims = [Image.open(f) for f in fs]; w = 412; o = Image.new('RGB', ((w + 8) * len(ims), 915), '#333')
    for i, im in enumerate(ims): o.paste(im.resize((w, 915)), (i * (w + 8), 0))
    o.save('p27mix.png'); print(o.size)
    
main()