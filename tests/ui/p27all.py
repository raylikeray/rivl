# v515: a short story row with an All card, the Following sheet, the order by what you open most, the ring in Search
import sys, json, re
exec(open('p27w_r.py').read().split("ST = \"(() =>")[0])
W, H = 384, 832
LD = json.load(open('../../data/leaders.json'))['leagues']['nba']['players']
MORE = [dict(lk='nba', id=str(p['id']), name=p['n'], short=p.get('sn') or p['n'], img=p.get('img') or '', team=p.get('team') or '', pos=p.get('pos') or '') for p in sorted(LD, key=lambda p: -(p['s'].get('pts') or 0))[:14] if str(p['id']) not in [str(x['id']) for x in PLS]]
MANY = "localStorage.setItem('hw:v5:players'," + json.dumps(json.dumps(PLS + MORE)) + ");localStorage.setItem('hw:v5:last27', String(Date.now()));"
ROW = "[...document.querySelectorAll('.st27 .sc27')].map(b => b.dataset.key.replace('nba:', '') + (b.classList.contains('seen') ? '*' : ''))"
def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        for scheme in ['dark', 'light']:
            ctx = b.new_context(viewport={'width': W, 'height': H}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(eval(init) + PL + FLAG + MANY); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and E.append('c:' + m.text[:200])); pg.route('**/*', rt)
            pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(14000)
            row = pg.evaluate(ROW); print(scheme, 'row', len(row), row)
            print(' every story', pg.evaluate("HW.v5.x27.storySubjects().map(x => x.key.replace('nba:', '') + (x.un ? '' : '*'))"))
            print(' All card', pg.evaluate("(() => { const c = document.querySelector('.sc27.k-more'); if (!c) return null; const r = c.getBoundingClientRect(); return [c.textContent.trim(), c.getAttribute('aria-label'), c.querySelectorAll('.sm27 i').length, c.classList.contains('seen'), Math.round(r.width), Math.round(r.height), c === c.parentNode.lastElementChild]; })()"))
            pg.evaluate("document.querySelector('.st27').scrollLeft = 99999"); pg.wait_for_timeout(1500); pg.screenshot(path=f'all-row-{scheme}.png', clip={'x': 0, 'y': 0, 'width': W, 'height': 420})
            pg.tap('.sc27.k-more'); pg.wait_for_timeout(900)
            print(' sheet', pg.evaluate("(() => { const s = document.querySelector('.fa27'); if (!s) return null; const p = s.querySelector('.fap27').getBoundingClientRect(); return [s.querySelector('h2').textContent, s.querySelector('.fah27 p').textContent, [...s.querySelectorAll('section')].map(x => x.querySelector('h3').textContent + ':' + x.querySelectorAll('.fcl27').length), s.querySelectorAll('.fcl27.new').length, s.querySelectorAll('.fcl27.seen').length, s.querySelectorAll('.fcl27:not(.new):not(.seen)').length, Math.round(p.top), Math.round(p.bottom), getComputedStyle(document.body).overflow]; })()"))
            print('  cells', pg.evaluate("[...document.querySelectorAll('.fa27 .fcl27')].slice(0, 6).map(c => { const r = c.getBoundingClientRect(), f = c.querySelector('.fr27').getBoundingClientRect(); return [c.textContent, c.dataset.fa, Math.round(r.width), Math.round(f.width)]; })"))
            pg.wait_for_timeout(1200); pg.screenshot(path=f'all-sheet-{scheme}.png')
            pg.evaluate("document.querySelector('.fal27').scrollTop = 600"); pg.wait_for_timeout(700); pg.screenshot(path=f'all-sheet2-{scheme}.png'); pg.evaluate("document.querySelector('.fal27').scrollTop = 0")
            if scheme == 'dark':
                pg.fill('.fas27 input', 'kn'); pg.wait_for_timeout(300); print(' typed kn', pg.evaluate("[[...document.querySelectorAll('.fa27 .fcl27')].filter(c => !c.hidden).map(c => c.textContent), [...document.querySelectorAll('.fa27 section')].filter(s => !s.hidden).length]"))
                pg.fill('.fas27 input', 'zzz'); pg.wait_for_timeout(300); print(' typed zzz', pg.evaluate("[document.querySelectorAll('.fa27 .fcl27:not([hidden])').length, !document.querySelector('.fae27').hidden]")); pg.fill('.fas27 input', ''); pg.wait_for_timeout(300)
                # a ringed cell plays its story; Back from the story is Home, not the sheet
                key = pg.evaluate("document.querySelector('.fa27 .fcl27.team.new, .fa27 .fcl27.team.seen').dataset.key"); pg.tap(f'.fa27 .fcl27[data-key="{key}"]'); pg.wait_for_timeout(1800)
                print(' ringed cell', key, '->', pg.evaluate("[!!document.querySelector('.fa27'), !!document.querySelector('.story'), (document.querySelector('.story .sthd') || {}).textContent]")); pg.go_back(); pg.wait_for_timeout(1200); print('  back', pg.evaluate("[location.hash, !!document.querySelector('.story'), !!document.querySelector('.fa27'), getComputedStyle(document.body).overflow]"))
                # a cell with no ring opens the page
                pg.wait_for_timeout(1500); pg.evaluate("document.querySelector('.st27').scrollLeft = 99999"); pg.wait_for_timeout(400); pg.tap('.sc27.k-more'); pg.wait_for_timeout(800); k2 = pg.evaluate("document.querySelector('.fa27 .fcl27:not(.new):not(.seen)').dataset.to"); pg.evaluate("document.querySelector('.fa27 .fcl27:not(.new):not(.seen)').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300); pg.tap('.fa27 .fcl27:not(.new):not(.seen)'); pg.wait_for_timeout(2000)
                print(' no ring ->', pg.evaluate("[location.hash, !!document.querySelector('.fa27')]"), k2); pg.go_back(); pg.wait_for_timeout(2500); print('  back', pg.evaluate("[location.hash, !!document.querySelector('.fa27')]"))
                # the phone's Back closes the sheet; so does the X
                pg.evaluate("document.querySelector('.st27').scrollLeft = 99999"); pg.wait_for_timeout(400); pg.tap('.sc27.k-more'); pg.wait_for_timeout(700); pg.go_back(); pg.wait_for_timeout(700); print(' Back closes', pg.evaluate("[location.hash, !!document.querySelector('.fa27')]"))
                pg.tap('.sc27.k-more'); pg.wait_for_timeout(700); pg.tap('.fah27 button'); pg.wait_for_timeout(700); print(' X closes', pg.evaluate("[location.hash, !!document.querySelector('.fa27')]"))
                # the story opened most comes first among the new ones
                before = pg.evaluate(ROW); tgt = [k for k in before if re.match(r't\d+$', k)][-1]
                pg.evaluate(f"localStorage.setItem('hw:v5:stopen27', JSON.stringify({{'nba:{tgt}': [4, Date.now()]}}))"); pg.reload(); pg.wait_for_timeout(14000); after = pg.evaluate(ROW)
                print(' opened most:', tgt, 'was at', before.index(tgt), 'now at', after.index(tgt), after[:5])
                print(' a count fades', pg.evaluate(f"(() => {{ localStorage.setItem('hw:v5:stopen27', JSON.stringify({{'nba:{tgt}': [4, Date.now() - 28 * 864e5]}})); return 1; }})()"), 'four opens, four weeks ago, are worth one now')
                # Search: the crest wears the ring and plays the story; the name still opens the page
                pg.goto('http://localhost:8777/rivl/#search'); pg.wait_for_timeout(2500); pg.fill('#xq', 'shai'); pg.wait_for_timeout(4000)
                print(' search ring', pg.evaluate("(() => { const w = document.querySelector('a.xwho .srg27'); if (!w) return [null, [...document.querySelectorAll('a.xwho')].map(a => a.getAttribute('href'))]; const r = w.getBoundingClientRect(); return [w.dataset.sstory, w.classList.contains('new'), Math.round(r.width), w.parentNode.getAttribute('href'), getComputedStyle(w.firstElementChild).backgroundColor]; })()")); pg.screenshot(path=f'all-search-{scheme}.png', clip={'x': 0, 'y': 0, 'width': W, 'height': 330})
                pg.tap('a.xwho .srg27'); pg.wait_for_timeout(1800); print('  crest tapped', pg.evaluate("[location.hash, !!document.querySelector('.story'), (document.querySelector('.story .sthd') || {}).textContent]")); pg.go_back(); pg.wait_for_timeout(1200)
                pg.tap('a.xwho b'); pg.wait_for_timeout(1800); print('  name tapped', pg.evaluate("location.hash"))
            ctx.close()
        # a few follows: the row is as it was, with no All card
        ctx = b.new_context(viewport={'width': W, 'height': H}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True)
        ctx.add_init_script(eval(init) + PL + FLAG + "localStorage.setItem('hw:favs',JSON.stringify({nba:['25','18','20']}));localStorage.setItem('hw:v5:players','[]');localStorage.setItem('hw:v5:last27', String(Date.now()));"); pg = ctx.new_page(); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(12000); print('three follows', pg.evaluate(ROW)); ctx.close()
        b.close()
    print('errs', E)
main()
