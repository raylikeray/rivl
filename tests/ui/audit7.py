import sys, json, re, time, collections
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
D = r"""(() => { const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const one = x => x.tagName.toLowerCase() + (typeof x.className === 'string' && x.className.trim() ? '.' + x.className.trim().split(/\s+/).join('.') : '');
  const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
  const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = e => { let layers = []; for (let p = e; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= .99) break; } } let base = [255, 255, 255]; for (let i = layers.length - 1; i >= 0; i--) base = base.map((v, k) => v * (1 - layers[i].a) + layers[i].c[k] * layers[i].a); return base; };
  const low = {}; const tw = document.createTreeWalker(document.querySelector('#main') || document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const t = n.textContent.trim(); if (t.length < 2) continue; const e = n.parentElement; if (!e || !vis(e) || e.closest('[hidden],svg')) continue; const cs = getComputedStyle(e), fs = parseFloat(cs.fontSize); const fg = rgb(cs.color), bg = bgOf(e); if (!fg || !bg) continue;
    const f = fg.c.map((v, k) => v * fg.a + bg[k] * (1 - fg.a)); const L1 = lum(f), L2 = lum(bg), r = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const need = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700) ? 3 : 4.5;
    if (r < need && r > 1.3) { const k = (e.parentElement ? one(e.parentElement) + ' > ' : '') + one(e) + ' | ' + r.toFixed(2) + ' | fg ' + cs.color + ' on ' + bg.map(Math.round).join(',') + ' | ' + fs + 'px'; low[k] = (low[k] || 0) + 1; low[k + '#'] = t.slice(0, 18); } }
  return low; })()"""
PAGES = [('home', '#home'), ('scores', '#scores'), ('game', '#game/nba/401909952'), ('team', '#team/nba/25'), ('player', '#player/nba/4278073'), ('stats', '#stats'), ('standings', '#standings'), ('search', '#search'), ('you', '#settings'), ('settings', '#settings/menu'), ('record', '#record')]
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['light', 'dark']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.route('**/*', rt); print('=====', scheme)
        for k, h in PAGES:
            pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(3300); r = pg.evaluate(D.replace('[255, 255, 255]', '[255, 255, 255]' if scheme == 'light' else '[0, 0, 0]'))
            for s, n in sorted(((s, n) for s, n in r.items() if not s.endswith('#')), key=lambda x: -x[1])[:9]: print('  %-8s x%-2d %s "%s"' % (k, n, s, r[s + '#']))
        ctx.close()
    b.close()
