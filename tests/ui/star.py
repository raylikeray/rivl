import os, sys, json, re
os.makedirs('audit', exist_ok=True)
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
M = """(sel) => { const out = []; [...document.querySelectorAll(sel)].slice(0, 3).forEach(s => { const R = e => { const b = e.getBoundingClientRect(); return [+(b.left).toFixed(1), +(b.top).toFixed(1), +(b.width).toFixed(1), +(b.height).toFixed(1)]; }; const cs = getComputedStyle(s), sv = s.querySelector('svg'), path = sv && sv.querySelector('path,polygon'), row = s.closest('.row'), card = s.closest('.rows, .fold, .tgrp');
  const b = s.getBoundingClientRect(), g = path ? path.getBoundingClientRect() : sv.getBoundingClientRect(), r = row.getBoundingClientRect(), c = card.getBoundingClientRect();
  out.push({ cls: s.className, btn: R(s), svg: R(sv), glyph: R(path || sv), bg: cs.backgroundColor, radius: cs.borderRadius, pad: cs.padding, display: cs.display, before: getComputedStyle(s, '::before').content + ' ' + getComputedStyle(s, '::before').backgroundColor + ' ' + getComputedStyle(s, '::before').width, svgbg: getComputedStyle(sv).backgroundColor + ' ' + getComputedStyle(sv).borderRadius + ' pad ' + getComputedStyle(sv).padding,
    circleOffCenter: (() => { const q = getComputedStyle(s, '::before'); return [+(parseFloat(q.left) + parseFloat(q.marginLeft) + parseFloat(q.width) / 2 - b.width / 2).toFixed(2), +(parseFloat(q.top) + parseFloat(q.marginTop) + parseFloat(q.height) / 2 - b.height / 2).toFixed(2)]; })(), circleRightGapToCard: (() => { const q = getComputedStyle(s, '::before'); return +(c.right - (b.left + parseFloat(q.left) + parseFloat(q.marginLeft) + parseFloat(q.width))).toFixed(1); })(), glyphOffCenter: [+((g.left + g.width / 2) - (b.left + b.width / 2)).toFixed(2), +((g.top + g.height / 2) - (b.top + b.height / 2)).toFixed(2)], rowOffCenter: +((b.top + b.height / 2) - (r.top + r.height / 2)).toFixed(2), rightGapToCard: +(c.right - b.right).toFixed(1), viewBox: sv.getAttribute('viewBox') }); }); return out; }"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=3)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#settings/following'); pg.wait_for_timeout(2500)
        if scheme == 'dark':
            for x in pg.evaluate(M, '#main .row .star')[:1]: print('following', {k: x[k] for k in ['btn', 'circleOffCenter', 'glyphOffCenter', 'rowOffCenter', 'circleRightGapToCard']})
            pg.goto('http://localhost:8777/rivl/#teams'); pg.wait_for_timeout(2000)
            for x in pg.evaluate(M, '#tlist .row .star')[:1]: print('teams', {k: x[k] for k in ['btn', 'circleOffCenter', 'glyphOffCenter', 'rowOffCenter', 'circleRightGapToCard']})
            pg.goto('http://localhost:8777/rivl/#settings/following'); pg.wait_for_timeout(2000)
            print('sec Add right', pg.evaluate("document.querySelector('#main .sec > a').getBoundingClientRect().right"), 'card right', pg.evaluate("document.querySelector('#main > .rows').getBoundingClientRect().right"))
            print('svg', pg.evaluate("document.querySelector('#main .row .star svg').outerHTML")[:400])
        pg.screenshot(path=f'audit/star-{scheme}-fol.png', clip={'x': 200, 'y': 120, 'width': 184, 'height': 240})
        pg.goto('http://localhost:8777/rivl/#players'); pg.wait_for_timeout(2500); pg.tap('#lgtabs .lgt >> nth=1'); pg.wait_for_timeout(2500)
        if scheme == 'dark':
            for x in pg.evaluate(M, '.leaders .row .star')[:1]: print('leaders', {k: x[k] for k in ['btn', 'circleOffCenter', 'glyphOffCenter', 'rowOffCenter', 'rightGapToCard']})
            pg.evaluate("location.hash = '#players'"); pg.tap('#lgtabs .lgt >> nth=0'); pg.wait_for_timeout(2500)
            for x in pg.evaluate(M, '#main .tgrp .row .star')[:1]: print('players, a roster', {k: x[k] for k in ['btn', 'circleOffCenter', 'glyphOffCenter', 'rowOffCenter', 'circleRightGapToCard']})
            pg.tap('#lgtabs .lgt >> nth=1'); pg.wait_for_timeout(2500)
        pg.evaluate("document.querySelector('.leaders .row').scrollIntoView({block:'start'}); window.scrollBy(0,-120)"); pg.wait_for_timeout(300); pg.screenshot(path=f'audit/star-{scheme}-lead.png', clip={'x': 200, 'y': 100, 'width': 184, 'height': 240})
        ctx.close()
    b.close()
from PIL import Image
fs = ['audit/star-dark-fol.png', 'audit/star-light-fol.png', 'audit/star-dark-lead.png', 'audit/star-light-lead.png']; ims = [Image.open(f).convert('RGB') for f in fs]
o = Image.new('RGB', (sum(i.width for i in ims) + 30, ims[0].height), '#f0f'); x = 0
for i in ims: o.paste(i, (x, 0)); x += i.width + 10
o.save('audit/s-star.png'); print(o.size)
