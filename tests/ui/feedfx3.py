"""Feed v2 fixture: older days of finals (for continuous scroll), a 42-point night and a triple-double, a one-point
finish, real photos on stories, and RIVL's record file. Builds on feedfx."""
import copy, datetime, json, fixtures, feedfx
_h = fixtures.handle
def news(u):
    out = feedfx.news(u)
    for a in out['articles']:
        if a['id'] == 9002: a['images'] = [{'url': 'http://localhost:8777/rivl/img/_wide.jpg', 'width': 1200, 'height': 675}]
        if a['id'] == 9001: a['images'] = [{'url': 'http://localhost:8777/rivl/img/_wide.jpg', 'width': 1296, 'height': 729}]
        if a['id'] == 9003: a['images'] = [{'url': 'http://localhost:8777/rivl/img/_sq.png', 'width': 150, 'height': 150}]
    if '/nba/' in u:
        for d in range(1, 12):
            out['articles'].append({'id': 9500 + d, 'type': 'Story', 'headline': f'Knicks notebook, day {d}: what the film shows', 'description': 'Rotations, minutes and the matchups that swung it.', 'published': feedfx.iso(10 + d * 11), 'categories': [feedfx.cat_team('18')], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/n%d' % d}}})
        out['articles'].append({'id': 9601, 'type': 'Story', 'headline': 'NBA power rankings: week two', 'description': 'x', 'published': feedfx.iso(4), 'categories': [], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/pr'}}})
        out['articles'].append({'id': 9602, 'type': 'Story', 'headline': 'Thunder power rankings mailbag', 'description': 'x', 'published': feedfx.iso(6), 'categories': [feedfx.cat_team('25')], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/pr2'}}})
    return out
def lead(cat, v, aid, nm):
    return {'name': cat, 'displayName': cat.title(), 'leaders': [{'displayValue': str(v), 'value': v, 'athlete': {'id': aid, 'displayName': nm, 'shortName': nm[0] + '. ' + nm.split()[-1], 'headshot': ''}}]}
def handle(url, today):
    if '/news' in url: return news(url)
    out = _h(url, today)
    if '/scoreboard' in url and '/nba/' in url and 'dates=' in url and isinstance(out, dict):
        d = url.split('dates=')[1][:8]; t0 = datetime.date.fromisoformat(today)
        back = (t0 - datetime.date(int(d[:4]), int(d[4:6]), int(d[6:]))).days
        if d == CT().strftime('%Y%m%d') and 'events' in out:
            e = copy.deepcopy([e for e in _h(url.replace(d, today.replace('-', '')), today)['events'] if e['id'] == '404'][0]); e['id'] = '4999'
            e['date'] = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=2)).strftime('%Y-%m-%dT%H:%MZ')
            cs = e['competitions'][0]['competitors']; cs[0]['team'] = fixtures.team_obj('4'); cs[1]['team'] = fixtures.team_obj('11')
            for x in cs: x['score'] = ''; x['leaders'] = []
            e['competitions'][0]['date'] = e['date']; e['competitions'][0]['status']['type'].update({'state': 'pre', 'completed': False, 'name': 'STATUS_SCHEDULED', 'detail': 'Scheduled', 'shortDetail': 'Scheduled'})
            out = dict(out); out['events'] = list(out['events']) + [e]
        back = (CT() - datetime.date(int(d[:4]), int(d[4:6]), int(d[6:]))).days
        if back >= 2:
            base = copy.deepcopy([e for e in _h(url.replace(d, today.replace('-', '')), today)['events'] if e['id'] == '404'][0])
            evs = []
            for n, (a, b, sa, sb_, ld) in enumerate([('25', '7', 121, 115, None), ('2', '4', 99, 98, ('pts', 42, '1966', 'Jayson Tatum')), ('20', '11', 111, 104, ('tri', 0, '4065648', 'Jalen Duren'))]):
                e = copy.deepcopy(base); e['id'] = f'{300 + back * 10 + n}'; e['date'] = f"{d[:4]}-{d[4:6]}-{d[6:]}T23:30Z"
                cs = e['competitions'][0]['competitors']
                cs[0]['team'] = fixtures.team_obj(a); cs[0]['score'] = str(sa); cs[1]['team'] = fixtures.team_obj(b); cs[1]['score'] = str(sb_)
                for x in cs: x['leaders'] = []
                if ld and ld[0] == 'pts': cs[0]['leaders'] = [lead('points', 42, ld[2], ld[3]), lead('rebounds', 8, ld[2], ld[3])]
                if ld and ld[0] == 'tri': cs[0]['leaders'] = [lead('points', 18, ld[2], ld[3]), lead('rebounds', 14, ld[2], ld[3]), lead('assists', 11, ld[2], ld[3])]
                st = e['competitions'][0]['status']['type']; st['detail'] = st['shortDetail'] = 'Final'
                evs.append(e)
            out = {'events': evs, 'leagues': out.get('leagues', [])}
    return out
fixtures.handle = handle
from zoneinfo import ZoneInfo
CT = lambda: datetime.datetime.now(ZoneInfo('America/Chicago')).date()
def record_json(today):
    y = (CT() - datetime.timedelta(days=1)).isoformat()
    g = [{'id': str(i), 'date': y, 'h': 'A', 'a': 'B', 'hid': '1', 'aid': '2', 'hs': 100 + (i % 3), 'as': 101, 'p': 0.6 if i % 2 else 0.4} for i in range(9)]
    return json.dumps({'generated': datetime.datetime.now(datetime.UTC).isoformat(), 'games': g})
