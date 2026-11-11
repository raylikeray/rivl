"""Richer Home fixture: recent news (tagged and league-wide wire), yesterday's finals for followed teams."""
import copy, datetime, fixtures
_handle = fixtures.handle
def iso(h): return (datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%SZ')
def cat_team(tid): return {'type': 'team', 'teamId': tid, 'description': 'team'}
def news(u):
    if '/nba/' in u: return {'articles': [
        {'id': 9001, 'type': 'HeadlineNews', 'headline': 'Thunder sign veteran guard to a one-year deal', 'description': 'OKC adds depth.', 'published': iso(0.4), 'categories': [cat_team('25'), {'type': 'topic', 'description': 'News'}], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/a'}}},
        {'id': 9002, 'type': 'Story', 'headline': "How the Knicks' bench won the fourth quarter", 'description': 'A deep look.', 'published': iso(3), 'categories': [cat_team('18')], 'images': [{'url': 'https://a.espncdn.com/x.jpg'}], 'links': {'web': {'href': 'https://www.espn.com/b'}}},
        {'id': 9003, 'type': 'HeadlineNews', 'headline': 'Celtics star out two weeks with a calf strain', 'description': 'League news.', 'published': iso(5), 'categories': [cat_team('2'), {'type': 'topic', 'description': 'News'}], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/c'}}},
        {'id': 9004, 'type': 'Story', 'headline': 'Power rankings: week two', 'description': 'Filler.', 'published': iso(9), 'categories': [], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/d'}}},
    ]}
    if '/mens-college' in u: return {'articles': [
        {'id': 9101, 'type': 'Story', 'headline': 'Inside the top-ranked freshman class in the country', 'description': 'College.', 'published': iso(1.5), 'categories': [], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/e'}}},
        {'id': 9102, 'type': 'HeadlineNews', 'headline': 'Coach suspended three games by the conference', 'description': 'College news.', 'published': iso(2.2), 'categories': [{'type': 'topic', 'description': 'News'}], 'images': [], 'links': {'web': {'href': 'https://www.espn.com/f'}}},
    ]}
    return {'articles': []}
def handle(url, today):
    out = _handle(url, today)
    if '/news' in url: return news(url)
    if '/scoreboard' in url and '/nba/' in url and 'dates=' in url:
        d = url.split('dates=')[1][:8]
        y = (datetime.date.fromisoformat(today) - datetime.timedelta(days=1)).strftime('%Y%m%d')
        if d == y and isinstance(out, dict):
            src = copy.deepcopy([e for e in _handle(url.replace(d, today.replace('-', '')), today)['events'] if e['id'] == '404'][0])
            src['id'] = '399'; src['date'] = f"{y[:4]}-{y[4:6]}-{y[6:]}T23:30Z"
            for x in src['competitions'][0]['competitors']:
                if x['team']['id'] == '2': x['team'] = fixtures.team_obj('25'); x['score'] = '118'
                else: x['team'] = fixtures.team_obj('7'); x['score'] = '109'
            src2 = copy.deepcopy(src); src2['id'] = '398'
            for x in src2['competitions'][0]['competitors']:
                if x['team']['id'] == '25': x['team'] = fixtures.team_obj('18'); x['score'] = '99'
                else: x['team'] = fixtures.team_obj('20'); x['score'] = '104'
            out = {'events': [src, src2], 'leagues': out.get('leagues', [])}
    return out
fixtures.handle = handle
