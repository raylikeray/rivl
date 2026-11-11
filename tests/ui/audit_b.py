import os; os.makedirs('audit', exist_ok=True)
import sys, json, re, time
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
CHK = r"""(() => { const W = innerWidth, out = {};
  const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < document.documentElement.scrollHeight; };
  const nm = e => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : e.tagName.toLowerCase()) + (e.id ? '#' + e.id : '');
  const scroller = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip')) return true; } return false; };
  out.dom = document.querySelectorAll('*').length; out.h = document.documentElement.scrollHeight;
  out.overflowX = document.documentElement.scrollWidth - W;
  const wide = []; document.querySelectorAll('#main *, #tb27 *').forEach(e => { if (!vis(e)) return; const b = e.getBoundingClientRect(); if (b.right > W + 1 && !scroller(e) && getComputedStyle(e).position !== 'fixed') wide.push(nm(e) + ' +' + Math.round(b.right - W)); }); out.wide = [...new Set(wide)].slice(0, 6);
  const small = {}; let taps = 0; document.querySelectorAll('a[href], button, [role=button], [data-act], input, select').forEach(e => { if (!vis(e) || e.closest('[hidden]')) return; taps++; const b = e.getBoundingClientRect(); if (b.width < 40 || b.height < 40) { if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') return; const k = nm(e) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height); small[k] = (small[k] || 0) + 1; } });
  out.taps = taps; out.smallTaps = Object.values(small).reduce((a, b) => a + b, 0); out.smallTapEx = Object.entries(small).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0] + ' x' + x[1]);
  const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
  const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = e => { let layers = []; for (let p = e; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= .99) break; } }
    let base = getComputedStyle(document.documentElement).colorScheme.includes('dark') || matchMedia('(prefers-color-scheme: dark)').matches ? [0, 0, 0] : [255, 255, 255]; for (let i = layers.length - 1; i >= 0; i--) base = base.map((v, k) => v * (1 - layers[i].a) + layers[i].c[k] * layers[i].a); return base; };
  const tiny = {}, low = {}; let texts = 0; const tw = document.createTreeWalker(document.querySelector('#main') || document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const t = n.textContent.trim(); if (t.length < 2) continue; const e = n.parentElement; if (!e || !vis(e) || e.closest('[hidden],svg,script,style')) continue; texts++; const cs = getComputedStyle(e), fs = parseFloat(cs.fontSize);
    if (fs < 11.5) { const k = nm(e) + ' ' + fs + 'px'; tiny[k] = (tiny[k] || 0) + 1; }
    const fg = rgb(cs.color), bg = bgOf(e); if (!fg || !bg) continue; const f = fg.c.map((v, k) => v * fg.a + bg[k] * (1 - fg.a)); const L1 = lum(f), L2 = lum(bg), r = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const need = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
    if (r < need) { const k = nm(e) + ' ' + r.toFixed(1) + ' "' + t.slice(0, 18) + '"'; low[k] = (low[k] || 0) + 1; } }
  out.texts = texts; out.tiny = Object.values(tiny).reduce((a, b) => a + b, 0); out.tinyEx = Object.entries(tiny).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0] + ' x' + x[1]);
  out.lowC = Object.values(low).reduce((a, b) => a + b, 0); out.lowEx = Object.entries(low).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0] + ' x' + x[1]);
  out.noAlt = [...document.querySelectorAll('#main img')].filter(i => vis(i) && !i.hasAttribute('alt')).length;
  out.noName = [...new Set([...document.querySelectorAll('a[href], button')].filter(e => vis(e) && !e.closest('[hidden]') && !(e.innerText || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title') && !e.querySelector('img[alt]:not([alt=""])')).map(nm))].slice(0, 8);
  out.h1 = document.querySelectorAll('h1').length; out.focusOff = 0;
  return out; })()"""
HIT = r"""(async () => { const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const nm = e => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : e.tagName.toLowerCase()) + (e.parentElement && typeof e.parentElement.className === 'string' ? ' in .' + e.parentElement.className.trim().split(/\s+/)[0] : '');
  const els = [...document.querySelectorAll('a[href], button, [role=button], [data-act], input, select')].filter(e => vis(e) && !e.closest('[hidden]') && !e.classList.contains('skip') && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline'));
  const small = {}; let n = 0;
  for (const e of els) { let b = e.getBoundingClientRect(); if (b.width >= 40 && b.height >= 40) continue; e.scrollIntoView({ block: 'center', inline: 'center' }); b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const hit = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); }; if (!hit(cx, cy)) continue;   // covered by something else just now
    const ext = (dx, dy, from) => { let k = 0; for (let i = 1; i <= 14; i++) { if (hit(dx ? from + dx * i : cx, dy ? from + dy * i : cy)) k = i; else break; } return k; };
    const w = b.width + ext(-1, 0, b.left + .5) + ext(1, 0, b.right - .5), h = b.height + ext(0, -1, b.top + .5) + ext(0, 1, b.bottom - .5);
    if (w < 40 || h < 40) { n++; const k = nm(e) + ' ' + Math.round(w) + 'x' + Math.round(h) + ' (drawn ' + Math.round(b.width) + 'x' + Math.round(b.height) + ')'; small[k] = (small[k] || 0) + 1; } }
  window.scrollTo(0, 0); return { n, ex: Object.entries(small).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0] + ' x' + x[1]) }; })()"""
PAGES = [('home', '#home'), ('scores', '#scores'), ('game', '#game/nba/401909952'), ('team', '#team/nba/25'), ('player', '#player/nba/4278073'), ('stats', '#stats'), ('standings', '#standings'), ('search', '#search'), ('you', '#settings'), ('settings', '#settings/menu'), ('teams', '#teams'), ('players', '#players'), ('record', '#record')]
RES = {}
def crawl(b, name, scheme, flag, cover=False):
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
    ctx.add_init_script(eval(init) + PL + flag + "localStorage.setItem('hw:v5:wtips27','true');"); pg = ctx.new_page(); errs = []; reqs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and errs.append('c:' + m.text[:160])); pg.on('request', lambda r: reqs.append(r.url)); pg.route('**/*', rt)
    cdp = ctx.new_cdp_session(pg); sheets = {}
    if cover:
        cdp.on('CSS.styleSheetAdded', lambda e: sheets.__setitem__(e['header']['styleSheetId'], (e['header'].get('sourceURL', ''), e['header'].get('length', 0))))
        cdp.send('DOM.enable'); cdp.send('CSS.enable'); cdp.send('CSS.startRuleUsageTracking'); cdp.send('Profiler.enable'); cdp.send('Profiler.startPreciseCoverage', {'callCount': False, 'detailed': False})
    out = {}
    for key, h in PAGES:
        n0 = len(reqs); t = time.time(); pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(3500 if key in ('home', 'game') else 2600)
        try: m = pg.evaluate(CHK)
        except Exception as ex: m = {'err': str(ex)[:200]}
        try: m['hit'] = pg.evaluate(HIT)
        except Exception as ex: m['hit'] = {'n': -1, 'ex': [str(ex)[:120]]}
        m['reqs'] = len(reqs) - n0; m['errs'] = errs[:]; errs.clear(); m['page'] = pg.evaluate("document.documentElement.dataset.page || ''"); out[key] = m
        try: pg.screenshot(path=f'audit/b-{name}-{key}.png', full_page=True)
        except Exception as ex: print('shot failed', key, str(ex)[:80])
    if cover:
        # touch Watch, a story and search results too, so the usage numbers are fair
        try:
            pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(2500); pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(2500); pg.go_back(); pg.wait_for_timeout(800)
            pg.goto('http://localhost:8777/rivl/#search'); pg.wait_for_timeout(1500); pg.fill('#xq', 'who leads the nba in scoring'); pg.wait_for_timeout(3000)
        except Exception as ex: print('extra walk', str(ex)[:120])
        ru = cdp.send('CSS.stopRuleUsageTracking')['ruleUsage']; used = {}
        for r in ru:
            if r['used']: used[r['styleSheetId']] = used.get(r['styleSheetId'], 0) + (r['endOffset'] - r['startOffset'])
        cssu = {}
        for sid, (url, ln) in sheets.items():
            if 'localhost' in url: cssu[url.split('/')[-1].split('?')[0]] = [used.get(sid, 0), ln]
        cov = cdp.send('Profiler.takePreciseCoverage')['result']; jsu = {}
        for s in cov:
            if 'localhost:8777/rivl' not in s['url'] or not s['url'].split('?')[0].endswith('.js'): continue
            total = max(r['endOffset'] for f in s['functions'] for r in f['ranges']); dead = []
            for f in s['functions']:
                r = f['ranges'][0]
                if r['count'] == 0: dead.append((r['startOffset'], r['endOffset']))
            dead.sort(); un = 0; end = -1
            for a, e in dead:
                if a >= end: un += e - a; end = e
                elif e > end: un += e - end; end = e
            jsu[s['url'].split('/rivl/')[1].split('?')[0]] = [total - un, total]
        out['_css'] = cssu; out['_js'] = jsu
    ctx.close(); return out
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    RES['new-dark'] = crawl(b, 'nd', 'dark', FLAG)
    RES['new-light'] = crawl(b, 'nl', 'light', FLAG)
    RES['old-dark'] = crawl(b, 'od', 'dark', FLAG.replace("localStorage.setItem('hw:v5:rv27','true');", '')) if 'old' in sys.argv else {}
    b.close()
json.dump(RES, open('audit/res2.json', 'w'), indent=1)
for mode, o in RES.items():
    print('==', mode)
    for k, m in o.items():
        if k.startswith('_'): print(' ', k, m); continue
        print('  %-9s page=%-8s dom %5s h %5s reqs %3s | overflow %s %s | small taps %s/%s, by touch area %s | tiny text %s/%s | low contrast %s | no alt %s | no name %s | errs %s' % (k, m.get('page'), m.get('dom'), m.get('h'), m.get('reqs'), m.get('overflowX'), m.get('wide'), m.get('smallTaps'), m.get('taps'), (m.get('hit') or {}).get('n'), m.get('tiny'), m.get('texts'), m.get('lowC'), m.get('noAlt'), len(m.get('noName', [])), len(m.get('errs', []))) if 'err' not in m else '  %s ERR %s' % (k, m['err']))
