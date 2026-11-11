# v511: out of Watch to the game and back, more of one player or team, a game's highlights card, hide scores, story exits
import sys, json, re
src = open('p27w_r.py').read()
exec(src.split("ST = \"(() =>")[0])
ST = "(() => { const e = document.querySelector('.story'); if (!e) return null; const w = e.__w; return [w.si, w.sub.key, w.item && w.item.id, w.paused, e.className, w.sub.its.length]; })()"
W, H = 384, 832
def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for scheme in ['dark', 'light']:
            ctx = b.new_context(viewport={'width': W, 'height': H}, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(eval(init) + PL + FLAG + "localStorage.setItem('hw:v5:wtips27','true');"); pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and 'Failed to load' not in m.text and E.append('c:' + m.text[:200])); pg.route('**/*', rt)
            pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(5000); cdp = ctx.new_cdp_session(pg)
            pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(1600)
            # find a play with a game and a player, a few clips in
            k = pg.evaluate("(() => { const w = document.querySelector('.story'), l = w.__w.sub.its; return l.findIndex((i, n) => n > 2 && i.gid && i.vk === 'play' && (i.aths || []).length && HW.v5.x27.watchOf({ lk: i.L.key, ath: i.aths[0], name: 'x y' }).length > 3); })()")
            pg.evaluate(f"document.querySelector('.story').__st.go({k})"); pg.wait_for_timeout(900)
            s0 = pg.evaluate(ST); it = pg.evaluate("(() => { const i = document.querySelector('.story').__w.item; return [i.L.key, i.gid, i.aths[0], (i.tms || [])[0] || '']; })()")
            gb = pg.evaluate("(() => { const g = document.querySelector('.stact [data-wact=game]'), r = g.getBoundingClientRect(); return [g.hidden, g.dataset.to, Math.round(r.width), Math.round(r.height), getComputedStyle(g, ':after').content, [...document.querySelectorAll('.stact > button')].filter(x => !x.hidden).map(x => x.dataset.stb || x.dataset.wact)]; })()")
            print(scheme, 'clip', s0[:3], it, 'game button', gb)
            pg.wait_for_timeout(500); pg.screenshot(path=f'v511-watch-{scheme}.png')
            # --- more of this player
            pg.tap('.wn27 a[data-wof="p"]'); pg.wait_for_timeout(1100)
            s1 = pg.evaluate(ST); chk = pg.evaluate(f"(() => {{ const e = document.querySelector('.story'), x = e.__w.sub; return [x.key, x.name, x.its.length, x.its.every(i => (i.aths || []).map(String).includes('{it[2]}')), x.back, x.backId, !document.querySelector('.wo27').hidden, document.querySelector('.wo27 b').textContent, getComputedStyle(document.querySelector('.wt27')).visibility, e.__subs.length, x.its[x.its.length - 1].id === '{s0[2]}' || !x.its.some(i => i.id === '{s0[2]}')]; }})()")
            print(' name tapped -> only his clips', s1[:3], chk)
            pg.wait_for_timeout(400); pg.screenshot(path=f'v511-of-{scheme}.png')
            if scheme == 'dark':
                drag(cdp, pg, 200, 600, 200, 300); pg.wait_for_timeout(900); s1b = pg.evaluate(ST); print(' pull up inside his list', s1b[:3], s1b[2] != s1[2])
                # the name again, inside his own list, is his page
                print(' name link inside own list', pg.evaluate("document.querySelector('.wn27 a[data-wof=p]') && document.querySelector('.wn27 a[data-wof=p]').getAttribute('href')"))
                # swipe right goes back to the clip left behind
                drag(cdp, pg, 80, 450, 330, 450); pg.wait_for_timeout(900); s2 = pg.evaluate(ST); print(' swipe right -> back on the clip', s2[:3], s2[2] == s0[2] and s2[1] == s0[1], 'lists', pg.evaluate("document.querySelector('.story').__subs.map(x => x.key)"), 'header gone', pg.evaluate("[document.querySelector('.wo27').hidden, getComputedStyle(document.querySelector('.wt27')).visibility, localStorage.getItem('hw:v5:wtab')]"))
                # team, then the arrow
                pg.tap('.wn27 a[data-wof="t"]'); pg.wait_for_timeout(1100); s3 = pg.evaluate(ST)
                print(' team tapped', s3[:2], pg.evaluate("(() => { const x = document.querySelector('.story').__w.sub; return [x.name, x.its.length, x.its.every(i => (i.tms || []).map(String).includes(String(x.q.team)))]; })()"))
                # a player inside the team list replaces it, and the way back still goes to the first clip
                pg.tap('.wn27 a[data-wof="p"]'); pg.wait_for_timeout(900); s4 = pg.evaluate(ST); print(' player from inside the team list', s4[:2], pg.evaluate("(() => { const e = document.querySelector('.story'), x = e.__w.sub; return [x.name, x.back, x.backId, e.__subs.map(y => y.key)]; })()"))
                pg.tap('.wo27 [data-wofx]'); pg.wait_for_timeout(900); s5 = pg.evaluate(ST); print(' arrow -> back on the clip', s5[:3], s5[2] == s0[2])
                # tapping the name inside its own list leaves for the page
                pg.tap('.wn27 a[data-wof="p"]'); pg.wait_for_timeout(1000); pg.tap('.wn27 a[data-wof="p"]'); pg.wait_for_timeout(1500); print(' name inside own list -> page', pg.evaluate("[location.hash, !!document.querySelector('.story')]"))
                pg.go_back(); pg.wait_for_timeout(2200); print(' back -> Watch again, on the clip', pg.evaluate("location.hash"), (pg.evaluate(ST) or [])[:3])
                # --- the game and back
                pg.tap('.stact [data-wact="game"]'); pg.wait_for_timeout(1800); print(' game button ->', pg.evaluate("[location.hash, !!document.querySelector('.story'), document.documentElement.dataset.page]"), 'expected', f'#game/{it[0]}/{it[1]}')
                pg.go_back(); pg.wait_for_timeout(2400); s6 = pg.evaluate(ST); print(' back -> Watch on the same clip', pg.evaluate("location.hash"), (s6 or [])[:3], bool(s6) and s6[2] == s0[2])
                pg.go_back(); pg.wait_for_timeout(1200); print(' back again closes Watch', pg.evaluate("[location.hash, !!document.querySelector('.story')]"))
                pg.evaluate("location.hash = '#scores'"); pg.wait_for_timeout(1200); pg.go_back(); pg.wait_for_timeout(1500); print(' no second reopen', pg.evaluate("[location.hash, !!document.querySelector('.story')]"))
                # leaving by the bottom bar is not marked
                pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(3500); pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(1500); pg.tap('#tb27 [data-t27="scores"]'); pg.wait_for_timeout(1500); pg.go_back(); pg.wait_for_timeout(1500); print(' bar then back: no Watch', pg.evaluate("[location.hash, !!document.querySelector('.story')]"))
            # --- a game's page: the highlights card
            g = pg.evaluate("(() => { const X = HW.v5.x27; X.watchWarm(); const d = X.watchSubs().flatMap(x => x.its).find(i => i.vk === 'reel' && i.gid && i.L.key === 'nba' && X.gameClips(i.gid).length > 3); return d ? [d.L.key, d.gid, X.gameClips(d.gid).map(i => i.vk)] : null; })()")
            print(' reel game', g and [g[0], g[1], len(g[2]), g[2][:3]])
            pg.goto(f'http://localhost:8777/rivl/#game/{g[0]}/{g[1]}'); pg.wait_for_timeout(6000)
            print(' card', pg.evaluate("(() => { const c = document.querySelector('.ghl27'); if (!c) return null; const r = c.getBoundingClientRect(), p = c.closest('.gpanel'); return [Math.round(r.left), Math.round(r.width), Math.round(r.height), c.textContent, c.getAttribute('aria-label'), c.parentNode === p.firstElementChild, document.querySelectorAll('.gc27 .cl27').length, (document.querySelector('.gc27 .cnt27') || {}).textContent]; })()"))
            pg.evaluate("document.querySelector('.ghl27').scrollIntoView({block:'center'})"); pg.wait_for_timeout(500); pg.screenshot(path=f'v511-game-{scheme}.png')
            if scheme == 'dark':
                pg.tap('.ghl27'); pg.wait_for_timeout(1500); s7 = pg.evaluate(ST); print(' card opens the reel', s7[:3], pg.evaluate("(() => { const e = document.querySelector('.story'); return [e.__w.item.vk, e.classList.contains('one27'), document.querySelector('.stact [data-wact=game]').hidden]; })()"))
                pg.go_back(); pg.wait_for_timeout(1000); print(' back -> the game page', pg.evaluate("[location.hash.slice(0, 10), !!document.querySelector('.story')]"))
            # --- hide scores
            pg.goto('http://localhost:8777/rivl/#scores'); pg.wait_for_timeout(4500)
            SC = "(() => { const t = s => [...document.querySelectorAll(s)].map(x => x.textContent.replace(/\\s+/g, ' ').trim().slice(0, 44)); const e = document.querySelector('#she27'); return { eye: [e.hidden, e.getAttribute('aria-pressed'), e.getAttribute('aria-label'), e.classList.contains('on')], note: !!document.querySelector('.shn27'), nums: document.querySelectorAll('.g27 b.n').length, lo: document.querySelectorAll('.g27 .lo').length, hero: (document.querySelector('.hero27 .gsc27') || {}).textContent, foot: (document.querySelector('.hero27 .gft27') || {}).textContent, rows: t('.g27').slice(0, 3), secs: t('.sl27') }; })()"
            a0 = pg.evaluate(SC); print(' scores showing', a0); pg.screenshot(path=f'v511-sc0-{scheme}.png')
            pg.tap('#she27'); pg.wait_for_timeout(900); a1 = pg.evaluate(SC); print(' eye tapped', a1); pg.wait_for_timeout(2600); pg.screenshot(path=f'v511-sc1-{scheme}.png')
            digits = pg.evaluate("[...document.querySelectorAll('#scb27 .g27, #scb27 .hero27')].filter(a => /lv|Final|Live/.test(a.className + a.textContent)).map(a => a.textContent).filter(t => /Final|Live/.test(t) && /\\d{2,3}/.test(t.replace(/\\d+:\\d+/g, ''))).length")
            print(' started games still showing a number', digits, 'stored', pg.evaluate("localStorage.getItem('hw:v5:hide27')"))
            if scheme == 'dark':
                pg.tap('#seg27 [data-s27="standings"]'); pg.wait_for_timeout(1500); print(' standings: eye', pg.evaluate("document.querySelector('#she27').hidden")); pg.tap('#seg27 [data-s27="scores"]'); pg.wait_for_timeout(1500)
                pg.reload(); pg.wait_for_timeout(4500); print(' after a reload still hidden', pg.evaluate(SC)['nums'], pg.evaluate(SC)['eye'])
                pg.tap('.shn27 button'); pg.wait_for_timeout(900); a2 = pg.evaluate(SC); print(' Show tapped', a2['eye'], a2['note'], a2['nums'] == a0['nums'])
            pg.evaluate("(() => { const f = [...document.querySelectorAll('.sl27')].find(x => /Final/.test(x.textContent)); if (f) f.scrollIntoView({block:'start'}); window.scrollBy(0, -80); })()"); pg.wait_for_timeout(2800); pg.screenshot(path=f'v511-sc2-{scheme}.png')
            # --- a way out of a story
            pg.evaluate("localStorage.setItem('hw:v5:hide27','false')"); pg.goto('http://localhost:8777/rivl/#home'); pg.reload(); pg.wait_for_timeout(6500)
            key = pg.evaluate("(() => { const s = HW.v5.x27.storySubjects().find(x => x.kind === 'team' && x.its.some(i => i.kind === 'final') && x.its.some(i => i.kind === 'vid' && i.gid)); return s ? s.key : null; })()"); print(' story', key)
            pg.evaluate(f"HW.v5.storyOpen('{key}')"); pg.wait_for_timeout(1300)
            kinds = pg.evaluate("document.querySelector('.story').__st.items.map(x => x.split(' | ')[0])"); print(' kinds', kinds)
            def at(n):
                pg.evaluate(f"document.querySelector('.story').__st.go({n})"); pg.wait_for_timeout(500)
                return pg.evaluate("(() => { const a = document.querySelector('.story .stgm'); if (!a) return null; const r = a.getBoundingClientRect(); return [a.getAttribute('href'), a.textContent, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === a || a.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))]; })()")
            iv = next(i for i, k in enumerate(kinds) if k not in ('final', 'swing', 'tops', 'line', 'caught')); print('  clip', at(iv)); pg.screenshot(path=f'v511-st-vid-{scheme}.png')
            for kd in ['final', 'swing', 'tops', 'caught']:
                if kd in kinds: print('  ' + kd, at(kinds.index(kd)) if kd != 'caught' else (at(kinds.index(kd)), pg.evaluate("[...document.querySelectorAll('.story .stnx a')].map(a => a.getAttribute('href'))"))); pg.screenshot(path=f'v511-st-{kd}-{scheme}.png')
            if scheme == 'dark':
                n = kinds.index('final'); want = at(n)[0]; pg.tap('.story .stgm'); pg.wait_for_timeout(1800); print(' Go to game ->', pg.evaluate("[location.hash, !!document.querySelector('.story')]"), want); pg.go_back(); pg.wait_for_timeout(1500); print(' back', pg.evaluate("[location.hash, !!document.querySelector('.story')]"))
                # Watch has no pill: the rail button does that job
                pg.tap('#tb27 [data-t27="watch"]'); pg.wait_for_timeout(1500); print(' no pill in Watch', pg.evaluate("!document.querySelector('.story .stgm')"))
            ctx.close()
        b.close()
    print('errs', E)
main()
