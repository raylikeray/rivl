import sys, json, re, time, collections
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
def run(b, flag, label):
    ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='dark', is_mobile=True, has_touch=True, device_scale_factor=1)
    ctx.add_init_script(eval(init) + PL + flag); pg = ctx.new_page(); reqs = []
    pg.on('request', lambda r: reqs.append((r.url, r.resource_type))); pg.route('**/*', rt)
    cdp = ctx.new_cdp_session(pg); cdp.send('Performance.enable'); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    t = time.time(); pg.goto('http://localhost:8777/rivl/#home', wait_until='commit')
    sel = '.sc27, .sbub, .feed .fp'
    try: pg.wait_for_selector(sel, timeout=20000); t1 = time.time() - t
    except Exception: t1 = -1
    pg.wait_for_timeout(5000)
    m = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
    kinds = collections.Counter(); hosts = collections.Counter()
    for u, ty in reqs:
        h = re.sub(r'^https?://', '', u).split('/')[0]; hosts[h] += 1
        k = 'own code' if 'localhost' in h and re.search(r'\.(js|css|html)(\?|$)', u) else 'own data' if 'localhost' in h and '/data/' in u else 'pictures' if ty == 'image' else 'feeds' if 'espn' in h or 'workers.dev' in h else 'font' if 'font' in h or ty == 'font' else ty
        kinds[k] += 1
    feeds = collections.Counter(re.sub(r'\d{5,}', 'N', re.sub(r'\?.*', '', u.split('espn.com')[-1]))[:70] for u, ty in reqs if 'espn.com' in u and ty != 'image')
    print(label, '| first content %.1fs at 4x slow CPU | script %.1fs layout %.2fs style %.2fs task %.1fs | heap %.0f MB | nodes %d' % (t1, m['ScriptDuration'], m['LayoutDuration'], m['RecalcStyleDuration'], m['TaskDuration'], m['JSHeapUsedSize'] / 1e6, m['Nodes']))
    print('   requests', len(reqs), dict(kinds)); print('   hosts', hosts.most_common(6)); print('   feeds', feeds.most_common(14))
    ctx.close()
with sync_playwright() as p:
    b = p.chromium.launch()
    run(b, FLAG, 'NEW'); run(b, FLAG.replace("localStorage.setItem('hw:v5:rv27','true');", ''), 'OLD')
    b.close()
