s = open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0]; exec(s)
from PIL import Image
out = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ['dark', 'light']:
        ctx = b.new_context(viewport={'width': 384, 'height': 850}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=3)
        ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.route('**/*', rt)
        pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(8000)
        print(pg.evaluate("""(() => { const mk = (skin, hair, shirt) => { const c = document.createElement('canvas'); c.width = 350; c.height = 254; const g = c.getContext('2d'); g.fillStyle = shirt; g.beginPath(); g.moveTo(50, 254); g.quadraticCurveTo(60, 185, 175, 178); g.quadraticCurveTo(290, 185, 300, 254); g.fill(); g.fillStyle = skin; g.fillRect(155, 150, 40, 40); g.beginPath(); g.ellipse(175, 108, 46, 64, 0, 0, 7); g.fill(); g.fillStyle = hair; g.beginPath(); g.ellipse(175, 62, 48, 30, 0, 0, 7); g.fill(); return c.toDataURL(); };
          const cards = [...document.querySelectorAll('.sc27')]; [[1, '#8a5a3c', '#1b1b1b', '#e9eef7'], [2, '#e2b594', '#6b4a2a', '#f4f4f4']].forEach(([i, a, b2, c2]) => { const k = cards[i], sp = k.querySelector('span'); [...sp.children].forEach(x => { if (x.tagName !== 'SMALL') x.remove(); }); const w = document.createElement('span'); w.className = 'sp27'; w.innerHTML = '<img alt="">'; w.firstChild.src = mk(a, b2, c2); sp.insertBefore(w, sp.firstChild); k.classList.remove('tm27'); k.classList.add('pl27'); if (i === 2) k.classList.add('seen'); });
          return cards.slice(0, 5).map(c => c.className); })()"""))
        pg.wait_for_timeout(300); f = f'p27sr-{scheme}.png'; pg.screenshot(path=f, clip={'x': 0, 'y': 105, 'width': 384, 'height': 190}); pg.screenshot(path=f'p27sr-full-{scheme}.png'); out.append(Image.open(f))
        ctx.close()
    b.close()
print('errs', E)
o = Image.new('RGB', (out[0].width, out[0].height * 2 + 10), '#888'); o.paste(out[0], (0, 0)); o.paste(out[1], (0, out[0].height + 10)); o.save('p27sr.png')
