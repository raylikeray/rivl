# v512: Catch up, the story that leads Home after time away, and the recap card
import sys, json, re
exec(open('p27w_r.py').read().split("ST = \"(() =>")[0])
W, H = 384, 832
# the stand-in box score has no photos; give its players the drawn stand-in so the recap card shows a cutout
_rtc = rt
def rt(r, q):
    if '/summary' in q.url:
        got = {}
        class R:
            def fulfill(self, **kw): got.update(kw)
            def __getattr__(self, n): return getattr(r, n)
        _rtc(R(), q)
        try:
            d = json.loads(got.get('body') or '{}')
            for side in (d.get('boxscore') or {}).get('players') or []:
                for st in side.get('statistics') or []:
                    for a in st.get('athletes') or []:
                        at = a.get('athlete') or {}
                        if at.get('id') and not (at.get('headshot') or {}).get('href'): at['headshot'] = {'href': HS('nba', at['id'])}
            got['body'] = json.dumps(d)
        except Exception as e: pass
        return r.fulfill(**got) if got else None
    return _rtc(r, q)
def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for scheme in ['dark', 'light']:
            ctx = b.new_context(viewport={'width': W, 'height': H}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and E.append('c:' + m.text[:200])); pg.route('**/*', rt)
            pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(8500)
            print(scheme, 'mark', pg.evaluate("[JSON.parse(localStorage.getItem('hw:v5:catch27') || 'null') && Math.round((Date.now() - JSON.parse(localStorage.getItem('hw:v5:catch27')).since) / 36e5), !!localStorage.getItem('hw:v5:last27')]"))
            row = pg.evaluate("[...document.querySelectorAll('.sc27')].map(b => b.dataset.key + (b.classList.contains('seen') ? '*' : ''))"); print(' row', row[:5])
            sub = pg.evaluate("(() => { const s = HW.v5.x27.storySubjects()[0]; return [s.key, s.un, s.its.map(i => i.kind + (i.kind === 'vid' ? ':' + (i.vk || i.ck) : '') + (i.star ? ':' + i.star.name : ''))]; })()"); print(' story', sub)
            pg.screenshot(path=f'catch-home-{scheme}.png', clip={'x': 0, 'y': 0, 'width': W, 'height': 420})
            pg.tap('.sc27[data-key="all:catch"]'); pg.wait_for_timeout(1500)
            kinds = pg.evaluate("document.querySelector('.story').__st.items.map(x => x.split(' | ')[0])"); print(' open', pg.evaluate("document.querySelector('.story .sthd').textContent.trim().slice(0, 30)"), kinds)
            def at(n): pg.evaluate(f"document.querySelector('.story').__st.go({n})"); pg.wait_for_timeout(900)
            for kd in ['recap', 'line', 'notes', 'caught']:
                if kd in kinds:
                    at(kinds.index(kd)); print('  ' + kd, pg.evaluate("(() => { const c = document.querySelector('.story .stcd'), r = [...c.children].map(e => { const b = e.getBoundingClientRect(); return [(e.getAttribute('class') || e.tagName).split(' ')[0], Math.round(b.top), Math.round(b.bottom)]; }); return [c.textContent.replace(/\\s+/g, ' ').slice(0, 160), r, [...c.querySelectorAll('a')].map(a => a.getAttribute('href'))]; })()"))
                    pg.screenshot(path=f'catch-{kd}-{scheme}.png')
            if scheme == 'dark':
                at(kinds.index('recap')); pg.tap('.story .stgm'); pg.wait_for_timeout(1600); print(' recap -> game', pg.evaluate("location.hash")); pg.go_back(); pg.wait_for_timeout(1500)
                # watched to the end: the card is marked seen and leaves the front
                pg.evaluate("(() => { const s = HW.v5.x27.storySubjects()[0], m = JSON.parse(localStorage.getItem('hw:v5:storyseen') || '{}'); m[s.key] = s.its.map(i => i.id); localStorage.setItem('hw:v5:storyseen', JSON.stringify(m)); })()")
                pg.reload(); pg.wait_for_timeout(9000); print(' after watching, reload', pg.evaluate("[...document.querySelectorAll('.sc27')].map(b => b.dataset.key + (b.classList.contains('seen') ? '*' : '')).filter(k => /catch|feed/.test(k))"))
                # hide scores: no Catch up
                pg.evaluate("localStorage.setItem('hw:v5:hide27','true')"); pg.reload(); pg.wait_for_timeout(8500); print(' scores hidden -> no story', pg.evaluate("!HW.v5.x27.storySubjects().some(s => s.key === 'all:catch')")); pg.evaluate("localStorage.setItem('hw:v5:hide27','false')")
                # a short absence makes no new one; a long one does
                pg.evaluate("localStorage.removeItem('hw:v5:catch27'); localStorage.setItem('hw:v5:last27', String(Date.now() - 2 * 36e5)); document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(1500); print(' two hours away', pg.evaluate("localStorage.getItem('hw:v5:catch27')"), pg.evaluate("!HW.v5.x27.storySubjects().some(s => s.key === 'all:catch')"))
                pg.evaluate("localStorage.setItem('hw:v5:last27', String(Date.now() - 14 * 36e5)); document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(2500); print(' row after coming back', pg.evaluate("[...document.querySelectorAll('.sc27')].map(b => b.dataset.key).slice(0, 2)")); print(' fourteen hours away', pg.evaluate("(() => { const c = JSON.parse(localStorage.getItem('hw:v5:catch27') || 'null'); return c && Math.round((Date.now() - c.since) / 36e5); })()"), pg.evaluate("(HW.v5.x27.storySubjects()[0] || {}).key"))
                # legacy design: not made
                pg.evaluate("localStorage.setItem('hw:v5:rv27','false')"); pg.reload(); pg.wait_for_timeout(7000); print(' legacy: no story', pg.evaluate("!HW.v5.x27.storySubjects().some(s => s.key === 'all:catch')"))
            ctx.close()
        b.close()
    print('errs', E)
main()
