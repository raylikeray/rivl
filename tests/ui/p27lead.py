import os, sys, json, re
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 384, 'height': 832}, service_workers='block', color_scheme='light', is_mobile=True, has_touch=True)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#players'); pg.wait_for_timeout(2500); pg.tap('#lgtabs .lgt >> nth=1'); pg.wait_for_timeout(3000)
    print(pg.evaluate("""(() => { const rows = [...document.querySelectorAll('.leaders .row.prow')].slice(0, 8); const R = e => e.getBoundingClientRect(); const base = e => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return [Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10, Math.round(b.bottom * 10) / 10]; };
      const sec = document.querySelector('.leaders .sec'), more = sec.querySelector('button'), chips = document.querySelector('.leaders .chips');
      return { moreBottom: R(more).bottom, chipsTop: R(chips).top, secLines: R(sec.querySelector('h2')).height, rows: rows.map(r => { const n = r.querySelector('.r b'), u = r.querySelector('.r span'), nm = r.querySelector('.t b'), sb = r.querySelector('.t span'); return [n.textContent, base(n).slice(0, 2).join('-'), 'unit right ' + base(u)[1], 'name/number bottoms ' + base(nm)[2] + '/' + base(n)[2], 'sub/unit bottoms ' + base(sb)[2] + '/' + base(u)[2]]; }) }; })()"""))
    b.close()
