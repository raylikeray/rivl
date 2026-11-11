import sys, json, re, time, collections
exec(open('p27bt.py').read().rsplit("\nwith sync_playwright() as p:", 1)[0])
D = r"""(() => { const vis = e => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const path = e => { const one = x => x.tagName.toLowerCase() + (x.id ? '#' + x.id : '') + (typeof x.className === 'string' && x.className.trim() ? '.' + x.className.trim().split(/\s+/).join('.') : ''); return [e.parentElement && e.parentElement.parentElement ? one(e.parentElement.parentElement) : '', e.parentElement ? one(e.parentElement) : '', one(e)].join(' > '); };
  const taps = {}, tiny = {};
  document.querySelectorAll('a[href], button, [role=button], [data-act], input, select').forEach(e => { if (!vis(e) || e.closest('[hidden]') || e.classList.contains('skip')) return; const b = e.getBoundingClientRect(); if (b.width >= 40 && b.height >= 40) return; if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') return;
    const cs = getComputedStyle(e), k = path(e) + ' | ' + Math.round(b.width) + 'x' + Math.round(b.height) + ' | pos ' + cs.position + ' | before ' + (getComputedStyle(e, '::before').content !== 'none') + ' after ' + (getComputedStyle(e, '::after').content !== 'none') + ' | bg ' + (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none') + ' | ovf ' + cs.overflow; taps[k] = (taps[k] || 0) + 1; });
  const tw = document.createTreeWalker(document.querySelector('#main') || document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const t = n.textContent.trim(); if (t.length < 2) continue; const e = n.parentElement; if (!e || !vis(e) || e.closest('[hidden],svg')) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 11.5) { const k = path(e) + ' | ' + fs + 'px | "' + t.slice(0, 16) + '"'; tiny[k] = (tiny[k] || 0) + 1; } }
  return { taps, tiny }; })()"""
PAGES = [('home', '#home'), ('scores', '#scores'), ('game', '#game/nba/401909952'), ('team', '#team/nba/25'), ('player', '#player/nba/4278073'), ('stats', '#stats'), ('standings', '#standings'), ('search', '#search'), ('you', '#settings'), ('settings', '#settings/menu'), ('teams', '#teams'), ('players', '#players'), ('record', '#record')]
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 412, 'height': 915}, service_workers='block', color_scheme='light', is_mobile=True, has_touch=True, device_scale_factor=1)
    ctx.add_init_script(eval(init) + PL + FLAG); pg = ctx.new_page(); urls = []; pg.on('request', lambda r: urls.append(r.url)); pg.route('**/*', rt)
    T = collections.Counter(); Y = collections.Counter(); where = collections.defaultdict(set)
    for k, h in PAGES:
        n0 = len(urls); pg.goto('http://localhost:8777/rivl/' + h); pg.wait_for_timeout(3300); r = pg.evaluate(D)
        for s, n in r['taps'].items(): T[s] += n; where[s].add(k)
        for s, n in r['tiny'].items(): s2 = re.sub(r' \| "[^"]*"$', '', s); Y[s2] += n; where[s2].add(k); where[s2 + '#eg'] = s.split('"')[-2]
        if k == 'home':
            c = collections.Counter(u for u in urls[n0:] if 'espn.com' in u and '/i/' not in u); print('HOME repeat feed calls:'); [print('   x%d %s' % (n, u.split('espn.com')[1][:150])) for u, n in c.most_common(40) if n > 1]
            c2 = collections.Counter(re.sub(r'[?&](dates|_)=[^&]*', '', u.split('espn.com')[1])[:110] for u in urls[n0:] if 'espn.com' in u and '/i/' not in u); print('HOME by address (dates dropped):'); [print('   x%d %s' % (n, u)) for u, n in c2.most_common(16)]
    print('TAPS'); [print('  x%-3d %s  [%s]' % (n, s, ','.join(sorted(where[s])))) for s, n in T.most_common(60)]
    print('TINY'); [print('  x%-3d %s  eg "%s" [%s]' % (n, s, where[s + '#eg'], ','.join(sorted(where[s])))) for s, n in Y.most_common(40)]
    b.close()
