# v514: The Daily. The hub, each game played through, the result kept and shared, Home's strip.
import sys, json, re, datetime as _d
from zoneinfo import ZoneInfo
exec(open('p27w_r.py').read().split("ST = \"(() =>")[0])
W, H = 384, 832
YD = (_d.datetime.now(ZoneInfo('America/New_York')) - _d.timedelta(days=1)).strftime('%Y-%m-%d')
LD = json.load(open('../../data/leaders.json'))['leagues']['nba']['players']
tops = sorted([p for p in LD if (p['s'].get('gp') or 0) >= 3], key=lambda p: -(p['s'].get('pts') or 0))[:5]
line = lambda p, i: dict(id=str(p['id']), n=p['n'], tid='25', tm=p['team'], e='399', gs=40 - i, pts=41 - i * 3, reb=9 + i, ast=7, stl=2, blk=1, tpm=4, min=36, pos=p.get('pos') or 'G', op='DEN', w=1, sc='118-109', hs=p.get('img') or '', rk=0)
bx = lambda a, b: [a, 88, b, 34, 18, 22, 44, 25, 7, 5, 13]
gm = lambda e, h, a, hs, as_: dict(e=e, h=dict(id=h[0], ab=h[1], nm=h[2], sc=hs), a=dict(id=a[0], ab=a[1], nm=a[2], sc=as_), bh=bx(44, 13) if hs > as_ else bx(38, 9), ba=bx(38, 9) if hs > as_ else bx(44, 13))
T = {'25': ('25', 'OKC', 'Thunder'), '7': ('7', 'DEN', 'Nuggets'), '18': ('18', 'NY', 'Knicks'), '4': ('4', 'CHI', 'Bulls'), '2': ('2', 'BOS', 'Celtics'), '20': ('20', 'PHI', '76ers')}
NIGHT = {'updated': 'x', 'lg': {'nba': {'days': [{'d': YD, 'done': True, 'games': ['399'], 'pon': line(tops[0], 0), 'ron': None, 'gon': None, 'top': [line(p, i) for i, p in enumerate(tops)], 'notes': [],
  'bp': [gm('399', T['25'], T['7'], 118, 109), gm('398', T['4'], T['18'], 101, 110), gm('397', T['2'], T['20'], 123, 101)]}], 'tally': []}}}
_rtd = rt
def rt(r, q):
    if 'night.json' in q.url: return r.fulfill(status=200, content_type='application/json', body=json.dumps(NIGHT))
    return _rtd(r, q)
def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        for scheme in ['dark', 'light']:
            ctx = b.new_context(viewport={'width': W, 'height': H}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(eval(init) + PL + FLAG + "localStorage.setItem('hw:v5:last27', String(Date.now()));"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and E.append('c:' + m.text[:200])); pg.route('**/*', rt)
            pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(7000)
            print(scheme, 'home strip', pg.evaluate("(() => { const a = document.querySelector('.dyhm27'); if (!a) return null; const r = a.getBoundingClientRect(); return [a.textContent.trim(), Math.round(r.top), Math.round(r.height), a.parentNode.previousElementSibling && a.parentNode.previousElementSibling.className.slice(0, 20)]; })()"))
            pg.screenshot(path=f'daily-home-{scheme}.png', clip={'x': 0, 'y': 0, 'width': W, 'height': 560})
            pg.tap('.dyhm27'); pg.wait_for_timeout(2500)
            print(' hub', pg.evaluate("[location.hash, document.querySelector('#sht27').textContent, !document.querySelector('#shb27').hidden, document.querySelector('#tb27 a.on').dataset.t27, [...document.querySelectorAll('.dyc27')].map(c => c.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70)), !!document.querySelector('.dysh27')]"))
            pz = pg.evaluate("(() => { const d = JSON.parse(localStorage.getItem('hw:v5:daily27'))[HW.todayCT()].pz; return [d.m.kind, d.m.l.n, d.m.l.id, d.ml.length, d.ml.map(r => r.k).join(','), d.bp.g.length, d.bp.g.map(g => g.e + (g.flip ? 'f' : '')).join(',')]; })()"); print(' puzzle', pz)
            pg.screenshot(path=f'daily-hub-{scheme}.png')
            # ---- Mystery line: two misses, then the answer
            pg.tap('.dy-mystery'); pg.wait_for_timeout(1500); print(' mystery', pg.evaluate("[location.hash, document.querySelector('#sht27').textContent, document.querySelector('.dyw27').textContent.trim().slice(0, 60), [...document.querySelectorAll('.dyx27 s')].map(s => s.textContent), document.querySelectorAll('.dyk27 span').length]"))
            leak = pg.evaluate(f"document.querySelector('#dy27').innerHTML.includes({json.dumps(pz[1])}) || document.querySelector('#dy27').innerHTML.includes('--c:')"); print('  answer or its colour in the page before solving:', leak)
            wrong = [p for p in LD if str(p['id']) != pz[2] and (p['s'].get('pts') or 0) > 15][:2]
            for k, w in enumerate(wrong):
                pg.fill('#dyinp27', w['n'].split(' ')[-1][:5]); pg.wait_for_timeout(350)
                if k == 0: pg.screenshot(path=f'daily-m-type-{scheme}.png')
                pg.tap(f'.dysg27 button[data-id="{w["id"]}"]'); pg.wait_for_timeout(450)
                print('  miss', k + 1, pg.evaluate("[[...document.querySelectorAll('.dyk27 span')].map(s => s.textContent), [...document.querySelectorAll('.dyq27')].map(r => r.textContent.replace(/\\s+/g, ' ')), document.querySelector('.dyhint27').textContent]"))
            pg.screenshot(path=f'daily-m-mid-{scheme}.png')
            pg.fill('#dyinp27', pz[1].split(' ')[0][:4]); pg.wait_for_timeout(350); pg.tap(f'.dysg27 button[data-id="{pz[2]}"]'); pg.wait_for_timeout(900)
            print('  solved', pg.evaluate("[document.querySelector('.dye27').textContent.replace(/\\s+/g, ' ').trim(), document.querySelector('.dyw27').textContent.trim().slice(0, 40), !!document.querySelector('.dyf27 img'), [...document.querySelectorAll('.dyk27 span')].length, !!document.querySelector('#dyinp27')]")); pg.screenshot(path=f'daily-m-end-{scheme}.png')
            # ---- More or less: the first right, the second wrong, the rest right
            pg.tap('.dye27 .dyn27'); pg.wait_for_timeout(1500); print(' more', pg.evaluate("[location.hash, document.querySelector('#sht27').textContent, document.querySelector('.dyh2').textContent, [...document.querySelectorAll('.dyv27 b')].map(b => b.textContent)]")); pg.screenshot(path=f'daily-o-{scheme}.png')
            rounds = pg.evaluate("JSON.parse(localStorage.getItem('hw:v5:daily27'))[HW.todayCT()].pz.ml")
            for i, r in enumerate(rounds):
                right = 'a' if r['va'] > r['vb'] else 'b'; pick = right if i != 1 else ('b' if right == 'a' else 'a')
                pg.tap(f'.dyv27[data-side="{pick}"]'); pg.wait_for_timeout(700)
                if i == 1: print('  wrong pick', pg.evaluate("[...document.querySelectorAll('.dyv27')].map(c => [c.className.replace('dyv27 ', ''), c.querySelector('em').textContent])")); pg.screenshot(path=f'daily-o-pick-{scheme}.png')
                pg.wait_for_timeout(1100)
            print('  end', pg.evaluate("document.querySelector('.dye27').textContent.replace(/\\s+/g, ' ').trim()"), pg.evaluate("[...document.querySelectorAll('.dyo27 i')].map(i => i.className).join(',')"))
            # ---- Blind pick
            pg.tap('.dye27 .dyn27'); pg.wait_for_timeout(1500); print(' blind', pg.evaluate("[location.hash, document.querySelector('.dyh2').textContent, [...document.querySelectorAll('.dybt27')].map(t => t.textContent), [...document.querySelectorAll('.dybr27')].map(r => r.textContent).slice(0, 3)]")); pg.screenshot(path=f'daily-b-{scheme}.png')
            games = pg.evaluate("JSON.parse(localStorage.getItem('hw:v5:daily27'))[HW.todayCT()].pz.bp.g")
            for i, g in enumerate(games):
                one = g['a'] if g['flip'] else g['h']; two = g['h'] if g['flip'] else g['a']; right = '1' if one['sc'] > two['sc'] else '2'; pick = right if i != 0 else ('2' if right == '1' else '1')
                pg.tap(f'.dybp27 button[data-n="{pick}"]'); pg.wait_for_timeout(500)
                if i == 0: print('  shown', pg.evaluate("[[...document.querySelectorAll('.dybt27')].map(t => t.textContent + (t.classList.contains('win') ? '*' : '')), document.querySelector('.dyres27').textContent]")); pg.screenshot(path=f'daily-b-shown-{scheme}.png')
                pg.tap('.dyn27[data-dy="next"]'); pg.wait_for_timeout(500)
            print('  end', pg.evaluate("document.querySelector('.dye27').textContent.replace(/\\s+/g, ' ').trim()"))
            pg.tap('.dye27 a.dyn27'); pg.wait_for_timeout(1500)
            print(' hub after', pg.evaluate("[location.hash, document.querySelector('.dyl27').textContent, [...document.querySelectorAll('.dys27')].map(s => s.textContent), [...document.querySelectorAll('.dyr27 div')].map(d => d.textContent)]")); pg.screenshot(path=f'daily-hub2-{scheme}.png')
            print(' share text', json.dumps(pg.evaluate("HW.v5.daily27.shareText()")))
            if scheme == 'dark':
                pg.reload(); pg.wait_for_timeout(3500); print(' after a reload', pg.evaluate("[location.hash, [...document.querySelectorAll('.dys27 b')].map(s => s.textContent)]"))
                pg.tap('#shb27'); pg.wait_for_timeout(2500); print(' one step back from the list is Home', pg.evaluate("[location.hash, (document.querySelector('.dyhm27') || {}).textContent]"))
            ctx.close()
        b.close()
    print('errs', E)
main()
