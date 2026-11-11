exec(open('h432.py').read().split("E = []")[0])
import json as _json, datetime as _dt, re, os, sys
from PIL import Image
NOW = _dt.datetime.now(_dt.UTC)
iso = lambda h: (NOW - _dt.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%SZ')
U = lambda n: f'0000000{n}-aaaa-bbbb-cccc-00000000000{n}'
MP4 = lambda n: f'https://espnmedia-cdn.akamaized.net/espn/media/16x9/wsc/2026/1110/{U(n)}/{U(n)}.mp4'
IMG = lambda n: f'https://espnmedia-cdn.akamaized.net/espn/media/common/wsc/2026/1110/{U(n)}/{U(n)}.jpg'
SGA, CHET, JOK, MUR = '4278073', '4433255', '3112335', '3936299'
def vid(i, n, h, hrs, typ='OnePlay', dur=4): return {"id": i, "headline": h, "duration": dur, "thumbnail": IMG(n), "originalPublishDate": iso(hrs), "tracking": {"coverageType": typ}, "links": {"source": {"href": MP4(n)}}}
def summ(gid):
    vids = [vid(91006, 6, "Denver Nuggets vs. Oklahoma City Thunder: Game Highlights", 9.0, 'Final Game Highlight', 72),
            vid(91004, 4, "Gilgeous-Alexander with the step-back dagger", 10.1),
            vid(91001, 1, "Shai Gilgeous-Alexander knocks down the 3-point shot", 11.5),
            vid(91002, 2, "Nikola Jokic throws down the hammer", 11.3),
            vid(91003, 3, "Chet Holmgren denies Denver Nuggets with block", 11.0),
            vid(91005, 5, "Jamal Murray gets the and-1 to fall", 10.6),
            vid(91007, 7, "Mark Daigneault on closing it out", 8.8, 'Interview', 40)]
    ath = lambda i, n, st: {"athlete": {"id": i, "displayName": n, "headshot": {"href": ""}}, "stats": st}
    box = {"players": [{"team": {"id": "25"}, "statistics": [{"labels": ["MIN", "PTS", "REB", "AST", "3PT"], "athletes": [ath(SGA, "Shai Gilgeous-Alexander", ["36", "38", "6", "9", "4-7"]), ath(CHET, "Chet Holmgren", ["30", "18", "11", "2", "1-3"])]}]},
                       {"team": {"id": "7"}, "statistics": [{"labels": ["MIN", "PTS", "REB", "AST", "3PT"], "athletes": [ath(JOK, "Nikola Jokic", ["37", "40", "14", "9", "2-4"]), ath(MUR, "Jamal Murray", ["35", "22", "3", "6", "3-8"])]}]}]}
    P = lambda i, per, ck, hs, as_, tid, sc=True: {"id": i, "period": {"number": per, "displayValue": f"{per}{['st','nd','rd','th'][per-1]} Quarter"}, "clock": {"displayValue": ck}, "homeScore": hs, "awayScore": as_, "scoringPlay": sc, "team": {"id": tid}}
    plays = [P("p1", 1, "11:40", 0, 2, "7"), P("p20", 1, "8:12", 12, 9, "25"), P("p50", 2, "4:12", 38, 35, "7", False), P("p98", 4, "0:21.0", 116, 117, "7"), P("p99", 4, "0:04.2", 118, 117, "25"), P("p100", 4, "0:00.0", 118, 117, "7", False)]
    import random; random.seed(7); h = a = 0; n = 0; wp = [{"homeWinPercentage": .55, "playId": "p1"}]
    seq = [("7", 2)] * 1 + [("25", 3), ("25", 2), ("7", 2), ("25", 2), ("25", 3), ("25", 2), ("25", 2), ("25", 3), ("7", 3), ("7", 2), ("7", 2), ("7", 3), ("7", 2), ("25", 2)] * 3
    extra = []
    for k, (tid, pts) in enumerate(seq):
        if tid == "25": h += pts
        else: a += pts
        per = min(4, 1 + k * 4 // len(seq)); pid = f"x{k}"
        extra.append({"id": pid, "text": "Chet Holmgren makes dunk", "period": {"number": per, "displayValue": f"{per}{['st','nd','rd','th'][per-1]} Quarter"}, "clock": {"displayValue": f"{11 - (k % 11)}:0{k % 6}"}, "homeScore": h, "awayScore": a, "scoringPlay": True, "team": {"id": tid}})
        wp.append({"homeWinPercentage": max(.03, min(.97, .5 + (h - a) / 40 + random.uniform(-.03, .03))), "playId": pid})
    last = [P("p98", 4, "0:21.0", h, a + (h - a) + 1, "7"), P("p99", 4, "0:04.2", h + 3, a + (h - a) + 1, "25"), P("p100", 4, "0:00.0", h + 3, a + (h - a) + 1, "7", False)]
    last[1]["text"] = "Shai Gilgeous-Alexander makes 27-foot three point step back jumpshot"
    wp += [{"homeWinPercentage": .29, "playId": "p98"}, {"homeWinPercentage": .93, "playId": "p99"}, {"homeWinPercentage": 1, "playId": "p100"}]
    plays = [P("p1", 1, "11:40", 0, 0, "7", False), P("p20", 1, "8:12", 12, 9, "25", False), P("p50", 2, "4:12", 38, 35, "7", False)] + extra + last
    hdr = {"competitions": [{"competitors": [{"team": {"id": "25"}, "linescores": [{"displayValue": "31"}, {"displayValue": "27"}, {"displayValue": "30"}, {"displayValue": "30"}]}, {"team": {"id": "7"}, "linescores": [{"displayValue": "28"}, {"displayValue": "29"}, {"displayValue": "24"}, {"displayValue": "28"}]}]}]}
    return {"videos": vids, "boxscore": box, "plays": plays, "header": hdr, "winprobability": wp}
STORIES = {"updated": iso(0), "items": [
  {"lk": "nba", "id": "7001", "title": "Shai Gilgeous-Alexander on the win: we stayed together", "ts": iso(5), "teams": ["25"], "aths": [SGA], "url": MP4(8), "dur": 4, "thumb": "", "k": "Interview"},
  {"lk": "nba", "id": "7004", "title": "Nikola Jokic drops 40 on the Thunder", "ts": iso(6), "teams": ["25", "7"], "aths": [JOK], "url": MP4(9), "dur": 4, "thumb": "", "k": "OnePlay"},
  {"lk": "nba", "id": "7005", "title": "Jamal Murray hits the triple", "ts": iso(7), "teams": ["25", "7"], "aths": [], "url": MP4(9), "dur": 4, "thumb": "", "k": "OnePlay"},
  {"lk": "nba", "id": "7006", "title": "Somebody Else rocks the rim", "ts": iso(7.5), "teams": ["25"], "aths": ["999"], "url": MP4(9), "dur": 4, "thumb": "", "k": "OnePlay"}],
  "top": [{"lk": "nba", "id": str(96000 + i), "e": "1", "gt": int((NOW - _dt.timedelta(hours=12)).timestamp() * 1000), "ts": int((NOW - _dt.timedelta(hours=10 - i)).timestamp() * 1000), "w": w, "title": t, "url": MP4(i + 1), "thumb": IMG(i + 1), "dur": 4, "a": [], "per": "Q4", "ck": "0:0%d.2" % (4 + i), "hs": 118 - i, "as": 117 - i, "h": {"id": "25", "ab": "OKC", "nm": "Thunder", "sc": "118"}, "aw": {"id": "7", "ab": "DEN", "nm": "Nuggets", "sc": "109"}} for i, (w, t) in enumerate([(.64, "Gilgeous-Alexander with the step-back dagger"), (-.31, "Jamal Murray ties it from the corner"), (.12, "Chet Holmgren denies Denver Nuggets with block"), (.22, "Jalen Williams gets the and-1 to fall")])],
  "cm": {"91001": {"e": "1", "p": "p20", "a": [SGA], "t": "OnePlay", "ts": 1}, "91004": {"e": "1", "p": "p99", "a": [SGA], "t": "OnePlay", "ts": 1}, "91003": {"e": "1", "p": "p50", "a": [CHET], "t": "OnePlay", "ts": 1}}}
SEARCH = {"results": [{"type": "clips", "contents": [
  {"id": "88001", "displayName": "Shai Gilgeous-Alexander gets the and-1 to fall", "date": iso(80), "duration": 4000, "image": {"default": IMG(1)}},
  {"id": "88002", "displayName": "Chet Holmgren finds Shai Gilgeous-Alexander for the slam", "date": iso(100), "duration": 4000, "image": {"default": IMG(2)}},
  {"id": "88003", "displayName": "Stephen A. on the Thunder", "date": iso(30), "duration": 4000, "image": {"default": IMG(3)}},
  {"id": "88004", "displayName": "Shai Gilgeous-Alexander old clip", "date": iso(24 * 9), "duration": 4000, "image": {"default": IMG(4)}},
  {"id": "88005", "displayName": "Shai Gilgeous-Alexander studio clip", "date": iso(20), "duration": 4000, "image": {"default": "https://espnmedia-cdn.akamaized.net/espn/media/common/2026/1110/ss_1/ss_1.jpg"}}]}]}
VB = open('test.mp4','rb').read(); VV = open('vert.mp4','rb').read()
REQ = []; BADHLS = [False]
def rt(r, q):
    u = q.url
    if 'dssott.com' in u:
        if BADHLS[0]: return r.fulfill(status=404, body='')
        f = 'hls457/' + u.split('/')[-1].split('?')[0]; REQ.append(u[-40:])
        return r.fulfill(status=200, headers={'Content-Type': 'application/x-mpegURL' if f.endswith('.m3u8') else 'video/mp2t', 'Access-Control-Allow-Origin': '*'}, body=open(f, 'rb').read()) if os.path.exists(f) else r.fulfill(status=404, body='')
    if u.endswith('.mp4'):
        B = VB; REQ.append(u[-60:]); rg = q.headers.get('range')
        if rg:
            a, _, b2 = rg.replace('bytes=', '').partition('-'); a = int(a or 0); b2 = int(b2) if b2 else len(B) - 1
            return r.fulfill(status=206, headers={'Content-Type': 'video/mp4', 'Content-Range': f'bytes {a}-{b2}/{len(B)}', 'Accept-Ranges': 'bytes', 'Content-Length': str(b2 - a + 1)}, body=B[a:b2 + 1])
        return r.fulfill(status=200, headers={'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes'}, body=B)
    if 'stories.json' in u: return r.fulfill(status=200, content_type='application/json', body=_json.dumps(STORIES))
    if 'search/v2' in u: return r.fulfill(status=200, content_type='application/json', body=_json.dumps(SEARCH))
    if 'summary?event=' in u: return r.fulfill(status=200, content_type='application/json', body=_json.dumps(summ(0)))
    if 'akamaized' in u and u.endswith('.jpg'): return r.fulfill(status=200, content_type='image/jpeg', body=open('wide.jpg','rb').read())
    if 'espncdn.com' in u and 'teamlogos' in u:
        m = re.search(r'/nba/500/(\w+)\.png', u)
        if m and os.path.exists(f'pn/{m.group(1)}.png'): return r.fulfill(status=200, content_type='image/png', body=open(f'pn/{m.group(1)}.png','rb').read())
    if 'localhost' in u: return r.continue_()
    return espn(r, q) if any(k in u for k in ['espn', 'googleapis', 'gstatic', 'workers.dev']) else r.continue_()
PL = "localStorage.setItem('hw:v5:players',JSON.stringify([{lk:'nba',id:'4278073',name:'Shai Gilgeous-Alexander',short:'S. Gilgeous-Alexander',team:'OKC',teamId:'25'}]));"
FAKEHLS = ''; NOHLS = "const _c = HTMLMediaElement.prototype.canPlayType; HTMLMediaElement.prototype.canPlayType = function (t) { return /mpegurl/i.test(t) ? '' : _c.call(this, t); };"
LIST = "(() => { const s = document.querySelector('.story').__st; return null; })()"
E = []; shots = []
def run(b, w, h, scheme, hls, tag):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, service_workers='block', color_scheme=scheme, is_mobile=True, has_touch=True)
    ctx.add_init_script(eval(init) + PL + "localStorage.setItem('hw:v5:rv27','false');" + ('' if hls else NOHLS))
    pg = ctx.new_page(); pg.on('pageerror', lambda e: E.append(str(e)[:300])); pg.route('**/*', rt)
    pg.goto('http://localhost:8777/rivl/#home'); pg.wait_for_timeout(5200)
    out = {}
    pg.screenshot(path=f's459-row-{scheme}-{w}.png', clip={'x': 0, 'y': 0, 'width': w, 'height': 260}); print('bubbles', pg.evaluate("[...document.querySelectorAll('.sbub')].map(b => b.dataset.key + ':' + b.querySelector('small').textContent + '/' + b.querySelector('.ring').textContent)"))
    for key in ['nba:top', 'nba:t25']:
        if not pg.query_selector(f'.sbub[data-key="{key}"]'): out[key] = 'no bubble'; continue
        pg.click(f'.sbub[data-key="{key}"]'); pg.wait_for_timeout(900)
        its = pg.evaluate("document.querySelector('.story').__st.items"); rows = list(its)
        for (k2, i) in sorted(tag or []):
            if k2 != key or i >= len(its): continue
            pg.evaluate(f"document.querySelector('.story').__st.go({i})"); pg.wait_for_timeout(900)
            rows.append('  shot %d: ' % i + pg.evaluate("(() => { const s = document.querySelector('.story'); const v = s.querySelector('video.on'), vw = s.querySelector('.stvdw'); const r = v.getBoundingClientRect(); return [vw.classList.contains('vert') ? 'VERT' : 'wide', v.videoWidth + 'x' + v.videoHeight, Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top), v.currentSrc.slice(-28), v.paused, v.error && v.error.message].join(' ~ '); })()"))
            f = f's459-{w}-{scheme}-{key[-3:]}-{i}.png'; pg.screenshot(path=f); shots.append(f)
        out[key] = rows
        pg.click('.story .stx'); pg.wait_for_timeout(700)
    ctx.close(); return out
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    o = run(b, 412, 900, 'dark', True, {('nba:top', 0), ('nba:top', 1)})
    pg0 = None
    for k, v in o.items():
        print('==', k)
        for x in (v if isinstance(v, list) else [v]): print('   ', x)
    b.close()
print('errs', E)
ims = [Image.open(f) for f in shots]; H = 800
o = Image.new('RGB', (sum(int(i.width * H / i.height) for i in ims) + 10 * len(ims), H), '#777'); x = 0
for i in ims: i = i.resize((int(i.width * H / i.height), H)); o.paste(i, (x, 0)); x += i.width + 10
o.save('s459.png'); print(o.size, shots)
