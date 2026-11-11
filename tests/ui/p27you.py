import sys, json
s = open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0]; exec(s)
shots = []
SEED = """(() => { try { const f = JSON.parse(localStorage.getItem('hw:v5:likes') || '[]'); } catch (e) {} localStorage.setItem('hw:v5:name', JSON.stringify('Ray')); })();"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=1)
        ctx.add_init_script(eval(init) + PL + FLAG + SEED); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(5000)
        print('seed', pg.evaluate("""(() => { const X = HW.v5.x27, subs = X.watchSubs(), its = (subs.find(s => s.its.length > 6) || subs[0]).its; its.slice(0, 7).forEach(it => X.stLike(it)); its.slice(3, 8).forEach(it => X.stSave(it));
          const d = n => new Date(Date.now() - n * 864e5).toISOString(); const P = JSON.parse(localStorage.getItem('hw:v5:mypicks') || '{}');
          Object.assign(P, { 'nba:x1': { lk: 'nba', id: 'x1', side: 'home', tid: '25', tn: 'Thunder', on: 'Lakers', ha: 'vs', ph: .71, date: d(1), t: 1, res: 'w', rv: 'w', fs: [101, 112] }, 'nba:x2': { lk: 'nba', id: 'x2', side: 'away', tid: '18', tn: 'Knicks', on: 'Celtics', ha: 'at', ph: .62, date: d(1), t: 2, res: 'l', rv: 'w', fs: [98, 104] }, 'nba:x3': { lk: 'nba', id: 'x3', side: 'home', tid: '20', tn: '76ers', on: 'Bulls', ha: 'vs', ph: .45, date: d(2), t: 3, res: 'w', rv: 'l', fs: [99, 108] }, 'nba:x4': { lk: 'nba', id: 'x4', side: 'home', tid: '7', tn: 'Nuggets', on: 'Pacers', ha: 'vs', ph: .66, date: d(2), t: 4, res: 'w', rv: 'w', fs: [110, 121] } });
          localStorage.setItem('hw:v5:mypicks', JSON.stringify(P)); const pl = JSON.parse(localStorage.getItem('hw:v5:players')); pl.push({ lk: 'wnba', id: '4433403', name: 'Caitlin Clark', short: 'C. Clark', team: 'Fever', img: '' }); localStorage.setItem('hw:v5:players', JSON.stringify(pl));
          return [X.stLikes().length, X.stLikedItems().length, X.savedItems().length, pl.length]; })()"""))
        pg.goto('http://localhost:8777/rivl/#settings'); pg.wait_for_timeout(3000)
        if scheme == 'dark': print(pg.evaluate("[!!document.querySelector('#you27'), Object.keys(localStorage).filter(k => /favs|players|mypicks|likes|saved|likedx/.test(k)).map(k => k + ':' + localStorage.getItem(k).length)]"))
        for t in (['teams', 'players', 'saved', 'liked', 'picks'] if scheme == 'dark' else ['teams', 'picks']):
            pg.tap(f'.ytb27 [data-tab="{t}"]'); pg.wait_for_timeout(900); f = f'p27you-{scheme}-{t}.png'; pg.screenshot(path=f, full_page=True); shots.append(f)
        pg.evaluate("window.scrollTo(0,0)"); pg.tap('[data-you="edit"]'); pg.wait_for_timeout(700); f = f'p27you-{scheme}-edit.png'; pg.screenshot(path=f); shots.append(f)
        if scheme == 'dark':
            pg.set_input_files('#yfile27', 'me-photo.jpg'); pg.wait_for_timeout(900); pg.evaluate("document.querySelector('[data-you=hdr][data-v=photo]').click()"); pg.wait_for_timeout(300); pg.set_input_files('#yfile27', 'me-header.jpg'); pg.wait_for_timeout(900); f = 'p27you-edit2.png'; pg.screenshot(path=f); shots.append(f)
            pg.fill('#yname27', 'Ray M'); pg.tap('[data-you="save"]'); pg.wait_for_timeout(600); print('name', pg.evaluate("[document.querySelector('.ynm27 h1').textContent, localStorage.getItem('hw:v5:name')]"))
            f = 'p27you-photo.png'; pg.screenshot(path=f); shots.append(f)
            pg.tap('.ytb27 [data-tab="liked"]'); pg.wait_for_timeout(500); pg.tap('.cg27 button:nth-child(2)'); pg.wait_for_timeout(1500); print('clip', pg.evaluate("(() => { const e = document.querySelector('.story'); return e ? [e.className, e.__w && e.__w.sub.key, e.__w && e.__w.sub.its.length] : null; })()")); pg.go_back(); pg.wait_for_timeout(700); print('closed', pg.evaluate("[!!document.querySelector('.story'), location.hash, !!document.querySelector('#you27')]"))
            pg.tap('.ytb27 [data-tab="players"]'); pg.wait_for_timeout(400); pg.tap('.gh27[data-lk="nba"]'); pg.wait_for_timeout(400); f = 'p27you-fold.png'; pg.screenshot(path=f); shots.append(f); pg.tap('.gh27[data-lk="nba"]'); pg.wait_for_timeout(300)
            pg.evaluate("window.scrollTo(0,0)"); pg.tap('.ym27'); pg.wait_for_timeout(900); print('menu', pg.evaluate("[location.hash, !!document.querySelector('#you27'), document.querySelector('#main').innerText.slice(0, 80)]")); f = 'p27you-menu.png'; pg.screenshot(path=f); shots.append(f)
        ctx.close()
    b.close()
print('errs', E)
from PIL import Image
ims = [Image.open(f) for f in shots]
H = min(1900, max(i.height for i in ims)); o = Image.new('RGB', (sum(i.width for i in ims) + 10 * len(ims), H), '#444'); x = 0
for i in ims: o.paste(i.crop((0, 0, i.width, min(H, i.height))), (x, 0)); x += i.width + 10
o.save('p27you.png'); print(o.size)
