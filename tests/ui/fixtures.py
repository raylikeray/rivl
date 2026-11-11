"""ESPN-shaped fixtures for a local smoke test of RIVL v5. Shapes follow js/core.js parsers."""
import json, datetime

TEAMS = {
  '25': dict(abbr='OKC', name='Oklahoma City Thunder', short='Thunder', loc='Oklahoma City', color='007ac1', alt='ef3b24', rec='4-0', standing='2nd in Western Conference'),
  '7':  dict(abbr='DEN', name='Denver Nuggets', short='Nuggets', loc='Denver', color='0e2240', alt='fec524', rec='1-2', standing='10th in Western Conference'),
  '18': dict(abbr='NY', name='New York Knicks', short='Knicks', loc='New York', color='1d428a', alt='f58426', rec='1-3', standing='13th in Eastern Conference'),
  '4':  dict(abbr='CHI', name='Chicago Bulls', short='Bulls', loc='Chicago', color='ce1141', alt='000000', rec='1-3', standing='11th in Eastern Conference'),
  '2':  dict(abbr='BOS', name='Boston Celtics', short='Celtics', loc='Boston', color='007a33', alt='ba9653', rec='3-1', standing='4th in Eastern Conference'),
  '20': dict(abbr='PHI', name='Philadelphia 76ers', short='76ers', loc='Philadelphia', color='006bb6', alt='ed174c', rec='3-1', standing='2nd in Eastern Conference'),
  '11': dict(abbr='IND', name='Indiana Pacers', short='Pacers', loc='Indiana', color='002d62', alt='fdbb30', rec='2-2', standing='9th in Eastern Conference'),
}
LOGO = lambda a: f'https://a.espncdn.com/i/teamlogos/nba/500/{a.lower()}.png'

def team_obj(tid):
    t = TEAMS[tid]
    return {'id': tid, 'abbreviation': t['abbr'], 'displayName': t['name'], 'shortDisplayName': t['short'], 'name': t['short'], 'location': t['loc'],
            'color': t['color'], 'alternateColor': t['alt'], 'logo': LOGO(t['abbr']), 'logos': [{'href': LOGO(t['abbr'])}]}

def competitor(tid, home, score):
    return {'homeAway': 'home' if home else 'away', 'team': team_obj(tid), 'score': str(score) if score is not None else '', 'records': [{'summary': TEAMS[tid]['rec']}]}

def event(eid, home, away, date, state, detail, hs, as_, tv='NBA TV', period=0, clock=''):
    return {'id': eid, 'date': date, 'competitions': [{'competitors': [competitor(home, True, hs), competitor(away, False, as_)],
             'status': {'type': {'state': state, 'shortDetail': detail, 'detail': detail, 'completed': state == 'post'}, 'period': period, 'displayClock': clock},
             'venue': {'fullName': 'Paycom Center', 'address': {'city': 'Oklahoma City', 'state': 'OK'}},
             'broadcasts': [{'market': 'national', 'names': [tv]}] if tv else [],
             'odds': [{'provider': {'name': 'ESPN BET'}, 'details': f"{TEAMS[home]['abbr']} -4.5", 'overUnder': 228.5, 'spread': -4.5, 'homeTeamOdds': {'favorite': True, 'moneyLine': -190}, 'awayTeamOdds': {'favorite': False, 'moneyLine': 160}}]}], 'status': {}}

def scoreboard(today):
    d = lambda h: f'{today}T{h:02d}:00Z'
    return {'events': [
        event('401', '25', '7', d(0), 'in', '4:12 - 3rd', 68, 61, 'NBA TV', 3, '4:12'),
        event('402', '4', '18', d(0), 'pre', '7:00 PM', None, None, 'League Pass'),
        event('403', '11', '20', d(23), 'pre', '6:00 PM', None, None, 'ESPN'),
        event('404', '2', '4', f'{today}T01:00Z', 'post', 'Final', 112, 104, ''),
    ]}

def team(tid, today):
    t = TEAMS[tid]
    o = team_obj(tid)
    o['record'] = {'items': [{'type': 'total', 'summary': t['rec']}]}
    o['standingSummary'] = t['standing']
    o['nextEvent'] = [event('499', '2', tid if tid != '2' else '4', f'{today}T23:30Z', 'pre', '6:30 PM', None, None, 'NBA Cup')] if tid != '25' else []
    return {'team': o}

def injuries():
    return {'injuries': [
        {'id': '18', 'displayName': 'New York Knicks', 'injuries': [{'status': 'Out', 'athlete': {'id': '64', 'displayName': 'Karl-Anthony Towns', 'position': {'abbreviation': 'C'}}, 'details': {'type': 'Calf', 'returnDate': '2026-11-20'}, 'shortComment': 'Out'}, {'status': 'Questionable', 'athlete': {'id': '65', 'displayName': 'OG Anunoby'}, 'details': {'type': 'Knee'}, 'shortComment': 'Game-time call'}, {'id': 'i1', 'status': 'Out', 'date': '2026-10-21T00:00Z', 'athlete': {'id': '3934672', 'displayName': 'Mitchell Robinson', 'headshot': 'https://a.espncdn.com/i/headshots/nba/players/full/3934672.png', 'position': {'abbreviation': 'C'}}, 'details': {'type': 'Ankle', 'detail': 'Sprain', 'side': 'Left', 'returnDate': '2026-11-12', 'fantasyStatus': {'description': 'Out'}}, 'shortComment': 'Out two weeks', 'longComment': 'Robinson rolled his left ankle late in the fourth quarter Monday and will be re-evaluated in two weeks, the team announced.'}]},
        {'id': '2', 'displayName': 'Boston Celtics', 'injuries': [{'status': 'Day-To-Day', 'athlete': {'id': '4065648', 'displayName': 'Jaylen Brown'}, 'details': {'type': 'Hamstring'}, 'shortComment': 'Questionable Friday'}]},
    ]}

def news():
    return {'articles': [
        {'headline': "Thunder's 4-0 start is built on the bench", 'byline': 'ESPN', 'published': '2026-10-28T20:00:00Z', 'images': [{'url': 'https://a.espncdn.com/x.jpg'}], 'links': {'web': {'href': 'https://www.espn.com/'}}},
        {'headline': 'Brunson on the 1-3 Knicks: "We\'re the Knicks, actually"', 'byline': 'NBA.com', 'published': '2026-10-28T17:00:00Z', 'images': [], 'links': {'web': {'href': 'https://www.nba.com/'}}},
    ]}

def players():
    names = [('3934672', 'Jalen Brunson', 'J. Brunson', '18', 22.8), ('64', 'Karl-Anthony Towns', 'K. Towns', '18', 24.6), ('65', 'OG Anunoby', 'O. Anunoby', '18', 15.1), ('3934673', 'Mitchell Robinson', 'M. Robinson', '18', 6.2), ('4278073', 'Shai Gilgeous-Alexander', 'S. Gilgeous-Alexander', '25', 31.5), ('3917376', 'Jaylen Brown', 'J. Brown', '2', 26.0), ('1966', 'LeBron James', 'L. James', '13', 19.7), ('4432166', 'Cade Cunningham', 'C. Cunningham', '8', 24.1)]
    cats = [{'name': 'general', 'names': ['gamesPlayed', 'avgMinutes']}, {'name': 'offensive', 'names': ['avgPoints', 'avgRebounds', 'avgAssists', 'avgFieldGoalsAttempted', 'avgFreeThrowsAttempted', 'fieldGoalPct', 'threePointFieldGoalPct', 'freeThrowPct', 'avgThreePointFieldGoalsMade']}]
    ath = []
    for pid, n, sn, tid, pts in names:
        ath.append({'athlete': {'id': pid, 'displayName': n, 'shortName': sn, 'teamShortName': TEAMS.get(tid, {}).get('abbr', 'LAL'), 'teamId': tid, 'position': {'abbreviation': 'G'}, 'headshot': {'href': f'https://a.espncdn.com/i/headshots/nba/players/full/{pid}.png'}},
                    'categories': [{'name': 'general', 'values': [4, 33.4]}, {'name': 'offensive', 'values': [pts, 2.8, 4.5, 18.0, 5.2, 46.1, 35.0, 84.6, 1.8]}]})
    return {'athletes': ath, 'categories': cats, 'pagination': {'pages': 1}, 'currentSeason': {'displayName': '2026-27'}}

def athlete():
    return {'athlete': {'id': '3934672', 'displayName': 'Jalen Brunson', 'firstName': 'Jalen', 'lastName': 'Brunson', 'shortName': 'J. Brunson', 'jersey': '11',
            'position': {'displayName': 'Guard', 'abbreviation': 'G'}, 'displayHeight': '6\' 2"', 'displayWeight': '190 lbs', 'age': 30, 'dateOfBirth': '1996-08-31T07:00Z',
            'birthPlace': {'city': 'New Brunswick', 'state': 'NJ'}, 'college': {'name': 'Villanova'}, 'displayDraft': '2018: Rd 2, Pk 33 (DAL)', 'experience': {'years': 8, 'displayValue': '9th Season'},
            'headshot': {'href': 'https://a.espncdn.com/i/headshots/nba/players/full/3934672.png'}, 'team': team_obj('18'), 'status': {'name': 'Active'}, 'injuries': []}}

def overview():
    return {'statistics': {'labels': ['GP', 'MIN', 'FG%', '3P%', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS'], 'splits': [{'displayName': 'Regular Season', 'stats': ['4', '33.4', '46.1', '35.0', '84.6', '2.8', '4.5', '0.3', '0.8', '2.0', '2.3', '22.8']}]},
            'news': [{'headline': 'Brunson kept it short in his postgame interview', 'type': 'Media', 'published': '2026-10-28T20:00:00Z', 'images': [{'url': 'https://a.espncdn.com/x.jpg'}], 'links': {'web': {'href': 'https://www.nba.com/'}}},
                     {'headline': "Why the Knicks' offense stalls when Brunson sits", 'type': 'Story', 'byline': 'ESPN', 'published': '2026-10-27T20:00:00Z', 'images': [], 'links': {'web': {'href': 'https://www.espn.com/'}}}]}

def gamelog():
    games = [('g1', '2026-10-27T23:30Z', '8', 'vs', 'W', '111-97', ['34', '9-18', '50.0', '2-6', '33.3', '3-3', '100', '1', '7', '0', '1', '2', '2', '23']),
             ('g2', '2026-10-25T23:30Z', '19', 'vs', 'L', '102-111', ['36', '11-22', '50.0', '3-7', '42.9', '3-4', '75.0', '3', '4', '0', '2', '1', '3', '28']),
             ('g3', '2026-10-23T23:30Z', '2', '@', 'L', '103-107', ['33', '7-19', '36.8', '1-5', '20.0', '4-4', '100', '2', '4', '0', '0', '3', '2', '19']),
             ('g4', '2026-10-20T23:30Z', '20', 'vs', 'L', '100-106', ['31', '8-17', '47.1', '2-4', '50.0', '3-3', '100', '5', '3', '1', '0', '2', '2', '21'])]
    opp = {'8': ('DET', 'Detroit Pistons'), '19': ('ORL', 'Orlando Magic'), '2': ('BOS', 'Boston Celtics'), '20': ('PHI', 'Philadelphia 76ers')}
    events = {g[0]: {'gameDate': g[1], 'opponent': {'id': g[2], 'abbreviation': opp[g[2]][0], 'displayName': opp[g[2]][1], 'logo': LOGO(opp[g[2]][0])}, 'atVs': g[3], 'gameResult': g[4], 'score': g[5]} for g in games}
    return {'labels': ['MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS'], 'events': events,
            'seasonTypes': [{'displayName': '2026-27 Regular Season', 'categories': [{'displayName': 'October', 'events': [{'eventId': g[0], 'stats': g[6]} for g in games]}]}]}

def stats():
    import os, json as _j
    _p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pw', 'brunson-stats.json')
    if os.path.exists(_p): return _j.load(open(_p))
    labels = ['GP', 'GS', 'MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'OR', 'DR', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS']
    rows = [('2022-23', '68', '24.0', '3.5', '6.2', '49.1'), ('2023-24', '77', '28.7', '3.6', '6.7', '47.9'), ('2024-25', '65', '26.0', '2.9', '7.3', '48.8'), ('2025-26', '74', '26.0', '3.3', '6.8', '48.8'), ('2026-27', '4', '22.8', '2.8', '4.5', '46.1')]
    stat = lambda r: [r[1], r[1], '33.4', '9.0-18.5', r[5], '2.0-5.5', '35.0', '4.5-5.3', '84.6', '0.5', '2.3', r[3], r[4], '0.2', '0.9', '2.0', '2.2', r[2]]
    return {'categories': [{'name': 'averages', 'displayName': 'Averages', 'labels': labels, 'statistics': [{'season': {'year': 2000 + int(r[0][:4][2:]), 'displayName': r[0]}, 'teamSlug': 'new-york-knicks', 'stats': stat(r)} for r in rows]}]}

def standings_v2():
    def entry(tid, w, l, seed):
        return {'team': team_obj(tid), 'stats': [{'name': 'wins', 'value': w}, {'name': 'losses', 'value': l}, {'name': 'playoffSeed', 'value': seed}, {'name': 'avgPointsFor', 'value': 112.0}, {'name': 'avgPointsAgainst', 'value': 110.0}, {'name': 'streak', 'displayValue': 'W1'}]}
    east = [('20', 3, 1, 2), ('2', 3, 1, 4), ('11', 2, 2, 9), ('4', 1, 3, 11), ('18', 1, 3, 13)]
    west = [('25', 4, 0, 2), ('7', 1, 2, 10)]
    return {'children': [{'name': 'Eastern Conference', 'abbreviation': 'E', 'standings': {'entries': [entry(*e) for e in east]}}, {'name': 'Western Conference', 'abbreviation': 'West', 'standings': {'entries': [entry(*e) for e in west]}}]}

def handle(url, today):
    u = url
    if '/scoreboard' in u: return scoreboard(today)
    if '/teams?' in u or u.endswith('/teams'):
        return {'sports': [{'leagues': [{'teams': [{'team': team_obj(t)} for t in TEAMS]}]}]}
    if '/teams/' in u:
        tid = u.split('/teams/')[1].split('/')[0].split('?')[0]
        return team(tid, today) if tid in TEAMS else {}
    if '/injuries' in u: return injuries()
    if '/news' in u: return news()
    if '/statistics/byathlete' in u: return players()
    if '/athletes/' in u:
        if u.endswith('/overview') or '/overview?' in u: return overview()
        if '/gamelog' in u: return gamelog()
        if '/stats' in u: return stats()
        return athlete()
    if '/standings' in u: return standings_v2()
    return {}

# ---- game summary, roster, schedule, article ----
def summary(today):
    ev = event('401', '25', '7', f'{today}T00:00Z', 'in', '4:12 - 3rd', 68, 61, 'NBA TV', 3, '4:12')
    comp = ev['competitions'][0]; comp['date'] = ev['date']
    comp['competitors'][0]['linescores'] = [{'displayValue': '28'}, {'displayValue': '24'}, {'displayValue': '16'}]
    comp['competitors'][1]['linescores'] = [{'displayValue': '22'}, {'displayValue': '25'}, {'displayValue': '14'}]
    labels = ['MIN', 'FG', '3PT', 'FT', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', '+/-', 'PTS']
    def ath(pid, nm, starter, stats):
        return {'athlete': {'id': pid, 'displayName': nm, 'shortName': nm.split(' ')[0][0] + '. ' + nm.split(' ')[-1], 'headshot': {'href': f'https://a.espncdn.com/i/headshots/nba/players/full/{pid}.png'}, 'position': {'abbreviation': 'G'}}, 'starter': starter, 'stats': stats}
    okc = [ath('4278073', 'Shai Gilgeous-Alexander', True, ['28', '9-16', '1-3', '5-5', '0', '3', '3', '6', '1', '0', '2', '1', '+9', '24']), ath('4594268', 'Jalen Williams', True, ['27', '6-12', '2-4', '2-2', '1', '4', '5', '3', '2', '1', '1', '2', '+6', '16']), ath('99', 'Bench Guy', False, ['12', '2-4', '0-1', '0-0', '0', '2', '2', '1', '0', '0', '0', '1', '-2', '4'])]
    den = [ath('3112335', 'Nikola Jokic', True, ['29', '8-14', '0-2', '4-4', '2', '8', '10', '7', '1', '1', '3', '2', '-7', '20']), ath('3936299', 'Jamal Murray', True, ['27', '5-13', '2-6', '2-2', '0', '2', '2', '4', '0', '0', '2', '1', '-5', '14'])]
    tstats = lambda vals: {'statistics': [{'name': n, 'displayValue': v, 'label': n} for n, v in vals]}
    okc_t = {'team': team_obj('25'), **tstats([('fieldGoalPct', '48.2'), ('threePointFieldGoalPct', '39.4'), ('freeThrowPct', '84.0'), ('totalRebounds', '28'), ('assists', '17'), ('turnovers', '6'), ('steals', '5'), ('blocks', '3'), ('pointsInPaint', '30'), ('fastBreakPoints', '12'), ('largestLead', '11'), ('fieldGoalsMade-fieldGoalsAttempted', '26-54'), ('threePointFieldGoalsMade-threePointFieldGoalsAttempted', '7-19'), ('freeThrowsMade-freeThrowsAttempted', '9-11'), ('offensiveRebounds', '4'), ('defensiveRebounds', '24')])}
    den_t = {'team': team_obj('7'), **tstats([('fieldGoalPct', '44.1'), ('threePointFieldGoalPct', '31.0'), ('freeThrowPct', '78.0'), ('totalRebounds', '31'), ('assists', '15'), ('turnovers', '10'), ('steals', '3'), ('blocks', '2'), ('pointsInPaint', '26'), ('fastBreakPoints', '8'), ('largestLead', '4'), ('fieldGoalsMade-fieldGoalsAttempted', '24-55'), ('threePointFieldGoalsMade-threePointFieldGoalsAttempted', '5-17'), ('freeThrowsMade-freeThrowsAttempted', '8-10'), ('offensiveRebounds', '6'), ('defensiveRebounds', '25')])}
    plays = [{'id': str(i), 'text': t, 'period': {'number': 3, 'displayValue': '3rd Quarter'}, 'clock': {'displayValue': c}, 'homeScore': hs, 'awayScore': as_, 'scoringPlay': sp, 'scoreValue': sv} for i, (t, c, hs, as_, sp, sv) in enumerate([
        ('Shai Gilgeous-Alexander makes driving layup', '5:02', 66, 61, True, 2), ('Jamal Murray misses 26-foot three point jumper', '4:40', 66, 61, False, 0), ('Jalen Williams defensive rebound', '4:38', 66, 61, False, 0), ('Shai Gilgeous-Alexander makes free throw 1 of 2', '4:12', 67, 61, True, 1), ('Shai Gilgeous-Alexander makes free throw 2 of 2', '4:12', 68, 61, True, 1)])]
    return {'header': {'competitions': [comp], 'season': {'year': 2027}}, 'gameInfo': {'venue': {'id': '2131', 'fullName': 'Paycom Center', 'address': {'city': 'Oklahoma City', 'state': 'OK'}, 'capacity': 18203, 'indoor': True, 'images': [{'href': 'https://a.espncdn.com/i/venues/nba/day/2131.jpg', 'width': 2000, 'height': 1125, 'alt': '', 'rel': ['full', 'day']}]}, 'attendance': 18203},
            'boxscore': {'players': [{'team': team_obj('25'), 'statistics': [{'labels': labels, 'athletes': okc, 'totals': ['240', '26-54', '7-19', '9-11', '4', '24', '28', '17', '5', '3', '6', '14', '', '68']}]}, {'team': team_obj('7'), 'statistics': [{'labels': labels, 'athletes': den, 'totals': ['240', '24-55', '5-17', '8-10', '6', '25', '31', '15', '3', '2', '10', '12', '', '61']}]}], 'teams': [okc_t, den_t]},
            'plays': plays, 'winprobability': [{'homeWinPercentage': 0.64}, {'homeWinPercentage': 0.81}], 'leaders': []}

def roster(tid):
    t = TEAMS[tid]
    ppl = [('4278073', 'Shai Gilgeous-Alexander', '2', 'G'), ('4594268', 'Jalen Williams', '8', 'F'), ('4397020', 'Chet Holmgren', '7', 'C'), ('4683749', 'Lu Dort', '5', 'G'), ('4397001', 'Isaiah Hartenstein', '55', 'C'), ('4683633', 'Cason Wallace', '22', 'G'), ('4871', 'Alex Caruso', '9', 'G'), ('4872', 'Aaron Wiggins', '21', 'G')]
    return {'team': {**team_obj(tid), 'recordSummary': t['rec'], 'standingSummary': t['standing']}, 'athletes': [{'id': i, 'displayName': n, 'jersey': j, 'position': {'abbreviation': p}, 'headshot': {'href': f'https://a.espncdn.com/i/headshots/nba/players/full/{i}.png'}, 'injuries': []} for i, n, j, p in ppl]}

def schedule(tid, today):
    import datetime as dt
    base = dt.datetime.strptime(today, '%Y-%m-%d')
    evs = []
    for k, (opp, d, state, hs, as_) in enumerate([('7', -6, 'post', 112, 104), ('4', -4, 'post', 98, 101), ('2', -2, 'post', 120, 110), ('7', 0, 'in', 68, 61), ('20', 2, 'pre', None, None), ('11', 4, 'pre', None, None), ('18', 7, 'pre', None, None)]):
        day = (base + dt.timedelta(days=d)).strftime('%Y-%m-%d')
        evs.append(event(f'5{k}', tid, opp, f'{day}T00:30Z', state, 'Final' if state == 'post' else ('4:12 - 3rd' if state == 'in' else '7:30 PM'), hs, as_, 'League Pass', 3 if state == 'in' else 0, '4:12' if state == 'in' else ''))
    return {'team': team_obj(tid), 'events': evs}

def article():
    return {'headlines': [{'headline': "Thunder's 4-0 start is built on the bench", 'byline': 'Tim MacMahon', 'published': '2026-10-28T20:00:00Z', 'description': 'A deep rotation is carrying Oklahoma City through October.',
            'images': [{'url': 'https://a.espncdn.com/x.jpg'}], 'links': {'web': {'href': 'https://www.espn.com/'}},
            'story': '<p>OKLAHOMA CITY -- The Thunder are 4-0, and the starters have barely broken a sweat.</p><h2>Depth, by the numbers</h2><p>The bench has outscored opponents by <strong>38 points</strong> in four games. <a href="https://www.espn.com/">Full box scores</a> tell the rest.</p><aside class="inline-video">junk</aside><script>alert(1)</script><ul><li>Cason Wallace: +21</li><li>Aaron Wiggins: +17</li></ul><blockquote>"We just play," Wallace said.</blockquote>',
            'video': [{'id': '7001', 'headline': 'SGA goes to work in the third', 'duration': 42, 'thumbnail': 'https://a.espncdn.com/t.jpg', 'links': {'web': {'href': 'https://www.espn.com/video/clip/_/id/7001'}, 'source': {'href': 'https://media.video-cdn.espn.com/motion/7001.mp4', 'mezzanine': {'href': 'https://media.video-cdn.espn.com/motion/7001_mez.mp4'}, 'HLS': {'href': 'https://media.video-cdn.espn.com/motion/7001/master.m3u8'}}}}]}]}

_old_handle = handle
def handle(url, today):
    u = url
    if '/summary' in u: return summary(today)
    if '/roster' in u: return roster(u.split('/teams/')[1].split('/')[0])
    if '/schedule' in u: return schedule(u.split('/teams/')[1].split('/')[0], today)
    if 'now.core.api.espn.com' in u: return article()
    return _old_handle(u, today)

# ---- round 4: ids that need deriving, two reports on one team, a far-out return date, tagged news, in-app story links, core bio ----
def injuries():
    return {'injuries': [
        {'id': '18', 'displayName': 'New York Knicks', 'injuries': [{'status': 'Out', 'athlete': {'id': '64', 'displayName': 'Karl-Anthony Towns', 'position': {'abbreviation': 'C'}}, 'details': {'type': 'Calf', 'returnDate': '2026-11-20'}, 'shortComment': 'Out'}, {'status': 'Questionable', 'athlete': {'id': '65', 'displayName': 'OG Anunoby'}, 'details': {'type': 'Knee'}, 'shortComment': 'Game-time call'}, {'id': 'i1', 'status': 'Out', 'date': '2026-10-21T00:00Z', 'athlete': {'id': '3934672', 'displayName': 'Mitchell Robinson', 'headshot': 'https://a.espncdn.com/i/headshots/nba/players/full/3934672.png', 'position': {'abbreviation': 'C'}}, 'details': {'type': 'Ankle', 'detail': 'Sprain', 'side': 'Left', 'returnDate': '2026-11-12', 'fantasyStatus': {'description': 'Out'}}, 'shortComment': 'Out two weeks', 'longComment': 'Robinson rolled his left ankle late in the fourth quarter Monday and will be re-evaluated in two weeks, the team announced.'}]},
        {'id': '2', 'displayName': 'Boston Celtics', 'injuries': [{'status': 'Day-To-Day', 'athlete': {'id': '4065648', 'displayName': 'Jaylen Brown'}, 'details': {'type': 'Hamstring'}, 'shortComment': 'Questionable Friday'}]},
        {'id': '25', 'displayName': 'Oklahoma City Thunder', 'injuries': [
            {'id': 'i7', 'status': 'Out', 'date': '2026-10-27T00:00Z', 'athlete': {'id': '4593803', 'displayName': 'Jalen Williams', 'headshot': 'https://a.espncdn.com/i/headshots/nba/players/full/4593803.png', 'position': {'abbreviation': 'G'}}, 'details': {'type': 'Leg', 'detail': 'Fracture', 'side': 'Left', 'returnDate': '2027-10-20', 'fantasyStatus': {'description': 'Out'}}, 'shortComment': 'Out indefinitely', 'longComment': 'Williams underwent surgery Wednesday to address a fractured left fibula and dislocated ankle and will be reevaluated before the end of the regular season, the team announced. This is a long note that should sit as a paragraph and not be pushed to the right with a wall of white space beside it.'},
            {'status': 'Day-To-Day', 'date': '2026-10-27T00:00Z', 'athlete': {'uid': 's:40~l:46~a:4431178', 'displayName': 'Jaylin Williams', 'headshot': 'https://a.espncdn.com/i/headshots/nba/players/full/4431178.png', 'position': {'abbreviation': 'F'}}, 'details': {'type': 'Knee', 'detail': 'Soreness', 'returnDate': '2026-10-30'}, 'shortComment': 'Questionable Thursday'}]},
    ]}

def news():
    return {'articles': [
        {'id': '46217189', 'headline': "Thunder's 4-0 start is built on the bench", 'description': 'A deep rotation is carrying Oklahoma City through October.', 'byline': 'ESPN', 'published': '2026-10-28T20:00:00Z', 'images': [{'url': 'https://a.espncdn.com/x.jpg'}], 'links': {'web': {'href': 'https://www.espn.com/'}}, 'categories': [{'type': 'team', 'teamId': 25}, {'type': 'league', 'leagueId': 46}]},
        {'id': '46217190', 'headline': 'Brunson on the 1-3 Knicks: "We\'re the Knicks, actually"', 'description': 'The captain is not worried.', 'byline': 'NBA.com', 'published': '2026-10-28T17:00:00Z', 'images': [], 'links': {'web': {'href': 'https://www.nba.com/'}}, 'categories': [{'type': 'athlete', 'athleteId': 3934672}, {'type': 'team', 'teamId': 18}]},
        {'id': '46217191', 'headline': 'Edwards drops 44 as Wolves roll', 'description': 'Minnesota is 3-1.', 'byline': 'ESPN', 'published': '2026-10-28T16:00:00Z', 'images': [], 'links': {'web': {'href': 'https://www.espn.com/'}}, 'categories': [{'type': 'athlete', 'athleteId': 4594268}, {'type': 'team', 'teamId': 16}]},
        {'id': '46217192', 'headline': 'Power rankings: Oklahoma City stays on top', 'description': 'Every team, ranked.', 'byline': 'ESPN', 'published': '2026-10-28T15:00:00Z', 'images': [], 'links': {'web': {'href': 'https://www.espn.com/'}}},
    ]}

def core():
    return {'id': '3934672', 'displayName': 'Jalen Brunson', 'fullName': 'Jalen Marquis Brunson', 'hand': {'type': 'right', 'displayValue': 'Right'}, 'debutYear': 2018, 'birthPlace': {'city': 'New Brunswick', 'state': 'NJ', 'country': 'USA'}, 'experience': {'years': 8}, 'draft': {'displayText': '2018: Rd 2, Pk 33 (DAL)'}, 'team': {'$ref': 'x'}, 'college': {'$ref': 'x'}, 'injuries': [{'$ref': 'x'}]}

def article():
    return {'headlines': [{'headline': "Thunder's 4-0 start is built on the bench", 'byline': 'Tim MacMahon', 'published': '2026-10-28T20:00:00Z', 'description': 'A deep rotation is carrying Oklahoma City through October.',
            'images': [{'url': 'https://a.espncdn.com/x.jpg'}], 'links': {'web': {'href': 'https://www.espn.com/'}},
            'story': '<p>OKLAHOMA CITY -- The <a href="https://www.espn.com/nba/team/_/name/okc/oklahoma-city-thunder">Oklahoma City Thunder</a> are 4-0, and <a href="https://www.espn.com/nba/player/_/id/4593803/jalen-williams">Jalen Williams</a> is out. <a href="https://www.espn.com/nba/game/_/gameId/401/thunder-nuggets">Tonight\'s game</a> and <a href="https://www.espn.com/nba/story/_/id/46217192/power-rankings">the power rankings</a> cover the rest; <a href="https://www.nba.com/stats">NBA.com</a> has the numbers.</p><h2>Depth, by the numbers</h2><p>The bench has outscored opponents by <strong>38 points</strong> in four games.</p><aside class="inline-video">junk</aside><script>alert(1)</script><ul><li>Cason Wallace: +21</li><li>Aaron Wiggins: +17</li></ul><blockquote>"We just play," Wallace said.</blockquote>',
            'video': [{'id': '7001', 'headline': 'SGA goes to work in the third', 'duration': 42, 'thumbnail': 'https://a.espncdn.com/t.jpg', 'links': {'web': {'href': 'https://www.espn.com/video/clip/_/id/7001'}, 'source': {'href': 'https://media.video-cdn.espn.com/motion/7001.mp4', 'mezzanine': {'href': 'https://media.video-cdn.espn.com/motion/7001_mez.mp4'}, 'HLS': {'href': 'https://media.video-cdn.espn.com/motion/7001/master.m3u8'}}}}]}]}

_handle3 = handle
def handle(url, today):
    u = url
    if 'sports.core.api.espn.com' in u and '/athletes/' in u: return core()
    if 'now.core.api.espn.com' in u: return article()
    if '/injuries' in u: return injuries()
    if '/news' in u: return news()
    return _handle3(u, today)

# ---- college: conferences, a Top 25, a long team list ----
CONFS = {'Big 12 Conference': ['Kansas Jayhawks', 'Houston Cougars', 'Baylor Bears', 'Iowa State Cyclones', 'Arizona Wildcats'],
         'Atlantic Coast Conference': ['Duke Blue Devils', 'North Carolina Tar Heels', 'Virginia Cavaliers', 'Louisville Cardinals'],
         'Southeastern Conference': ['Auburn Tigers', 'Alabama Crimson Tide', 'Tennessee Volunteers', 'Florida Gators', 'Kentucky Wildcats'],
         'Big East Conference': ['UConn Huskies', 'Marquette Golden Eagles', 'Creighton Bluejays']}
def cteam(i, full):
    loc, nick = full.rsplit(' ', 1) if full not in ('North Carolina Tar Heels', 'Alabama Crimson Tide', 'Duke Blue Devils', 'Iowa State Cyclones') else {'North Carolina Tar Heels': ('North Carolina', 'Tar Heels'), 'Alabama Crimson Tide': ('Alabama', 'Crimson Tide'), 'Duke Blue Devils': ('Duke', 'Blue Devils'), 'Iowa State Cyclones': ('Iowa State', 'Cyclones')}[full]
    return {'id': str(1000 + i), 'abbreviation': loc[:4].upper(), 'displayName': full, 'shortDisplayName': loc, 'name': nick, 'location': loc, 'nickname': loc, 'color': '0033a0', 'logos': [{'href': f'https://a.espncdn.com/i/teamlogos/ncaa/500/{1000+i}.png'}]}
CT = []; i = 0
for c, names in CONFS.items():
    for n in names: CT.append((c, cteam(i, n))); i += 1
def c_standings():
    def entry(t, k): return {'team': t, 'stats': [{'name': 'wins', 'value': 5 - k % 3}, {'name': 'losses', 'value': k % 3}, {'name': 'playoffSeed', 'value': k + 1}, {'name': 'streak', 'displayValue': 'W1'}]}
    return {'children': [{'name': c, 'abbreviation': c.split()[0], 'standings': {'entries': [entry(t, k) for k, (cc, t) in enumerate(CT) if cc == c]}} for c in CONFS]}
def c_rankings():
    return {'rankings': [{'name': 'AP Top 25', 'headline': 'Week 1', 'ranks': [{'current': r + 1, 'previous': r + 1, 'team': {**CT[k][1], 'name': CT[k][1]['name']}, 'recordSummary': '5-0'} for r, k in enumerate([0, 5, 9, 14, 1])]}]}
_handle4 = handle
def handle(url, today):
    u = url
    if 'college-basketball' in u:
        if '/standings' in u: return c_standings()
        if '/rankings' in u: return c_rankings()
        if '/teams?' in u or u.endswith('/teams'): return {'sports': [{'leagues': [{'teams': [{'team': t} for c, t in CT]}]}]}
        if '/scoreboard' in u: return {'events': []}
        if '/statistics/byathlete' in u: return {'athletes': [], 'categories': [], 'pagination': {'pages': 1}}
        return {}
    return _handle4(u, today)

def c_roster(tid):
    t = next((t for c, t in CT if t['id'] == tid), None)
    if not t: return {}
    first = ['Sarah', 'Paige', 'Azzi', 'KK', 'Ashlynn', 'Caroline', 'Ice', 'Jana', 'Morgan', 'Kaitlyn', 'Allie', 'Qadence']
    ath = [{'id': f'{tid}{k:02d}', 'displayName': f'{first[k]} {t["location"].split()[0]}son', 'shortName': f'{first[k][0]}. {t["location"].split()[0]}son', 'jersey': str(k + 1), 'position': {'abbreviation': ['G', 'F', 'C'][k % 3]}, 'headshot': {'href': f'https://a.espncdn.com/i/headshots/{tid}{k:02d}.png'} if k % 2 else None} for k in range(12)]
    return {'team': t, 'athletes': ath}
_handle5 = handle
def handle(url, today):
    u = url
    if 'college-basketball' in u and '/roster' in u: return c_roster(u.split('/teams/')[1].split('/')[0])
    return _handle5(u, today)

import datetime as _dt
def _cal(today, days):
    b = _dt.date.fromisoformat(today)
    return [(b + _dt.timedelta(days=d)).isoformat() + 'T07:00Z' for d in days]
_handle6 = handle
def handle(url, today):
    u = url
    if '/scoreboard' in u and 'wnba' in u:
        return {'events': [], 'leagues': [{'calendar': _cal(today, [-3, -1, 1, 3]), 'season': {'type': {'name': 'Postseason'}}}]}
    out = _handle6(u, today)
    if '/scoreboard' in u and isinstance(out, dict) and 'events' in out:
        out['leagues'] = [{'calendar': _cal(today, [-2, -1, 0, 1, 2]), 'season': {'type': {'name': 'Regular Season'}}}]
    return out

import re as _re
_handle7 = handle
def handle(url, today):
    u = url
    m = _re.search(r'dates=(\d{8})-(\d{8})', u)
    if '/scoreboard' in u and m and 'wnba' not in u:
        a = _dt.date.fromisoformat(f"{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:]}"); b = _dt.date.fromisoformat(f"{m.group(2)[:4]}-{m.group(2)[4:6]}-{m.group(2)[6:]}")
        evs = []; d = a; k = 0; ids = list(TEAMS)
        while d <= b:
            if d.day % 3 != 0:
                for g in range((d.day % 4) + 1):
                    h, aw = ids[(k + g) % len(ids)], ids[(k + g + 1) % len(ids)]
                    evs.append(event(f'9{d.day:02d}{g}', h, aw, d.isoformat() + 'T23:30Z', 'pre', '6:30 PM', None, None, ''))
            d += _dt.timedelta(days=1); k += 1
        return {'events': evs, 'leagues': [{'calendar': [], 'season': {'type': {'name': 'Regular Season'}}}]}
    return _handle7(u, today)

_handle8 = handle
def handle(url, today):
    out = _handle8(url, today)
    if '/roster' in url and isinstance(out, dict) and out.get('athletes'):
        out['athletes'][0]['injuries'] = [{'status': 'Out'}]
        if len(out['athletes']) > 2: out['athletes'][2]['injuries'] = [{'status': 'Day-To-Day'}]
    return out

# ---- v43: the summary mirrors ESPN's shape — market line in pickcenter, officials, highlights, rosters with starters, shot coordinates ----
_handle9 = handle
def _pick(home_abbr):
    return [{'provider': {'name': 'ESPN BET'}, 'details': f"{home_abbr} -4.5", 'overUnder': 228.5, 'spread': -4.5, 'homeTeamOdds': {'favorite': True, 'moneyLine': -190}, 'awayTeamOdds': {'favorite': False, 'moneyLine': 160}}]
def _officials():
    return [{'fullName': 'Scott Foster', 'displayName': 'S. Foster', 'position': {'name': 'Referee'}, 'order': 1}, {'fullName': 'Tony Brothers', 'displayName': 'T. Brothers', 'position': {'name': 'Referee'}, 'order': 2}, {'fullName': 'Ray Acosta', 'displayName': 'R. Acosta', 'position': {'name': 'Referee'}, 'order': 3}]
def _roster_entry(pid, nm, pos, starter):
    return {'athlete': {'id': pid, 'displayName': nm, 'shortName': nm.split(' ')[0][0] + '. ' + nm.split(' ')[-1], 'headshot': {'href': f'https://a.espncdn.com/i/headshots/nba/players/full/{pid}.png'}}, 'position': {'abbreviation': pos}, 'starter': starter, 'didNotPlay': False, 'active': True}
def _videos():
    return [{'id': 8001, 'headline': 'SGA weaves through three for the and-one', 'duration': 23, 'thumbnail': 'https://a.espncdn.com/t1.jpg', 'links': {'web': {'href': 'https://www.espn.com/video/clip/_/id/8001'}, 'source': {'href': 'https://media.video-cdn.espn.com/motion/8001.mp4', 'HLS': {'href': 'https://media.video-cdn.espn.com/motion/8001/master.m3u8'}}}},
            {'id': 8002, 'headline': 'Jokic finds Murray for the corner three', 'duration': 18, 'thumbnail': 'https://a.espncdn.com/t2.jpg', 'links': {'web': {'href': 'https://www.espn.com/video/clip/_/id/8002'}, 'source': {'href': 'https://media.video-cdn.espn.com/motion/8002.mp4'}}}]
def handle(url, today):
    out = _handle9(url, today)
    if '/summary' not in url or not isinstance(out, dict): return out
    comp = out['header']['competitions'][0]
    comp.pop('odds', None)
    eid = url.split('event=')[-1].split('&')[0]
    out['gameInfo']['officials'] = _officials()
    if eid == '402':   # a pre-game summary: CHI hosts NY tonight, fives announced, no box score or plays yet
        ev = event('402', '4', '18', f'{today}T23:00Z', 'pre', '7:00 PM', None, None, 'League Pass')
        c = ev['competitions'][0]; c['date'] = ev['date']; c.pop('odds', None)
        out['header']['competitions'] = [c]
        out['gameInfo'] = {'venue': {'fullName': 'United Center', 'address': {'city': 'Chicago', 'state': 'IL'}}, 'officials': _officials()}
        out['pickcenter'] = _pick('CHI')
        out['boxscore'] = {'players': [], 'teams': []}; out['plays'] = []; out['winprobability'] = []; out['videos'] = []
        chi = [('4', 'Josh Giddey', 'G', True), ('5', 'Coby White', 'G', True), ('6', 'Matas Buzelis', 'F', True), ('7', 'Patrick Williams', 'F', True), ('8', 'Nikola Vucevic', 'C', True), ('9', 'Ayo Dosunmu', 'G', False), ('10', 'Kevin Huerter', 'G', False)]
        ny = [('3934672', 'Jalen Brunson', 'G', True), ('4066648', 'Mikal Bridges', 'G', True), ('3135045', 'OG Anunoby', 'F', True), ('3064514', 'Karl-Anthony Towns', 'C', True), ('4396909', 'Josh Hart', 'F', True), ('11', 'Mitchell Robinson', 'C', False)]
        out['rosters'] = [{'homeAway': 'home', 'team': team_obj('4'), 'roster': [_roster_entry(*r) for r in chi]}, {'homeAway': 'away', 'team': team_obj('18'), 'roster': [_roster_entry(*r) for r in ny]}]
        return out
    out['pickcenter'] = _pick('OKC')
    out['videos'] = _videos()
    # shot coordinates on the live game's plays (ESPN's court: x across 0–50, y along 0–94, the basket near y≈5)
    shots = [(25, 6, 'Layup Shot', True), (12, 27, 'Jump Shot', False), (25, 7, 'Dunk Shot', True), (3, 8, 'Jump Shot', True), (47, 9, 'Jump Shot', False), (25, 30, 'Jump Shot', True), (38, 22, 'Jump Shot', True), (25, 5, 'Layup Shot', False)]
    i = 0
    for p in out['plays']:
        if 'misses' in p['text'] or 'makes' in p['text']:
            x, y, kind, made = shots[i % len(shots)]; i += 1
            p['coordinate'] = {'x': x, 'y': y}; p['shootingPlay'] = True; p['type'] = {'text': kind}
            p['team'] = team_obj('25') if 'Gilgeous' in p['text'] or 'Williams' in p['text'] else team_obj('7')
            p['participants'] = [{'athlete': {'id': '4278073' if 'Gilgeous' in p['text'] else '4594268' if 'Williams' in p['text'] else '3936299' if 'Murray' in p['text'] else '3112335'}}]
    return out

# ---- v44: a fuller live game — ten-man rotations, substitutions, and shots with coordinates on both halves ----
import math as _math, random as _random
_handle10 = handle
_OKC = [('4278073', 'Shai Gilgeous-Alexander', True), ('4594268', 'Jalen Williams', True), ('4397020', 'Chet Holmgren', True), ('4683749', 'Luguentz Dort', True), ('4397001', 'Isaiah Hartenstein', True), ('4683633', 'Cason Wallace', False), ('4871', 'Alex Caruso', False), ('4872', 'Aaron Wiggins', False)]
_DEN = [('3112335', 'Nikola Jokic', True), ('3936299', 'Jamal Murray', True), ('4066436', 'Michael Porter Jr.', True), ('3134908', 'Aaron Gordon', True), ('4431690', 'Christian Braun', True), ('4397244', 'Peyton Watson', False), ('3064290', 'Russell Westbrook', False)]
def _ath(pid, nm, starter, pts):
    return {'athlete': {'id': pid, 'displayName': nm, 'shortName': nm.split(' ')[0][0] + '. ' + nm.split(' ')[-1], 'headshot': {'href': f'https://a.espncdn.com/i/headshots/nba/players/full/{pid}.png'}, 'position': {'abbreviation': 'G'}}, 'starter': starter,
            'stats': ['24', '5-10', '1-3', '2-2', '1', '3', '4', '3', '1', '0', '1', '2', '+3', str(pts)]}
def _live_plays():
    rnd = _random.Random(7); plays = []; hs = as_ = 0; pid = 0
    okc_on = [p for p in _OKC if p[2]]; den_on = [p for p in _DEN if p[2]]
    def add(text, period, clock, scoring=False, sv=0, team=None, coord=None, kind=None, parts=None):
        nonlocal pid; pid += 1
        p = {'id': str(pid), 'text': text, 'period': {'number': period, 'displayValue': f'{period}{"st" if period == 1 else "nd" if period == 2 else "rd"} Quarter'}, 'clock': {'displayValue': clock}, 'homeScore': hs, 'awayScore': as_, 'scoringPlay': scoring, 'scoreValue': sv}
        if team: p['team'] = team_obj(team)
        if coord: p['coordinate'] = coord; p['shootingPlay'] = True; p['type'] = {'text': kind}
        if parts: p['participants'] = [{'athlete': {'id': x}} for x in parts]
        plays.append(p)
    spots = [(25, 6, 'layup'), (25, 7, 'dunk'), (3, 8, 'three'), (47, 10, 'three'), (25, 31, 'three'), (12, 27, 'three'), (38, 24, 'three'), (18, 16, 'jumper'), (32, 14, 'jumper'), (25, 20, 'jumper'), (8, 12, 'jumper'), (42, 15, 'jumper'), (21, 9, 'hook'), (29, 8, 'hook')]
    for period in (1, 2, 3):
        for k in range(14):
            secs = 720 - int(k * 50) - rnd.randint(0, 40); clock = f'{secs // 60}:{secs % 60:02d}'
            if period == 3 and secs < 252: break
            home = (k + period) % 2 == 0
            roster = okc_on if home else den_on
            shooter = roster[rnd.randrange(5)]
            x, y, kind = spots[(k * 3 + period) % len(spots)]
            if (k + period) % 3 == 0: x, y = 50 - x, 94 - y   # the other end of the floor
            fx, fy = (50 - x, 94 - y) if y > 47 else (x, y)
            dist = _math.hypot(fx - 25, fy - 5.25)
            made = rnd.random() < (0.62 if dist < 5 else 0.42 if kind != 'three' else 0.36)
            three = kind == 'three'
            verb = 'makes' if made else 'misses'
            desc = 'driving layup' if kind == 'layup' else 'dunk' if kind == 'dunk' else f'{round(dist)}-foot three point jumper' if three else f'{round(dist)}-foot {"hook shot" if kind == "hook" else "pullup jump shot"}'
            text = f'{shooter[1]} {verb} {desc}'
            if made:
                if home: hs += 3 if three else 2
                else: as_ += 3 if three else 2
            add(text, period, clock, made, (3 if three else 2) if made else 0, '25' if home else '7', {'x': x, 'y': y}, 'Jump Shot' if kind in ('jumper', 'three') else 'Layup Shot' if kind == 'layup' else 'Dunk Shot' if kind == 'dunk' else 'Hook Shot', [shooter[0]])
            if k in (4, 9):   # a substitution on each side
                bench = [p for p in (_OKC if home else _DEN) if p not in roster]
                if bench:
                    inn = bench[0]; out = roster[4]
                    add(f'{inn[1]} enters the game for {out[1]}', period, clock, team='25' if home else '7', parts=[inn[0], out[0]])
                    roster[4] = inn
                    p = plays[-1]; p['type'] = {'text': 'Substitution'}
    return plays, hs, as_
def handle(url, today):
    out = _handle10(url, today)
    if '/summary' not in url or not isinstance(out, dict) or url.split('event=')[-1].split('&')[0] != '401': return out
    plays, hs, as_ = _live_plays()
    out['plays'] = plays
    labels = ['MIN', 'FG', '3PT', 'FT', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', '+/-', 'PTS']
    out['boxscore']['players'] = [{'team': team_obj('25'), 'statistics': [{'labels': labels, 'athletes': [_ath(*p, 24 if i == 0 else 16 if i == 1 else 8) for i, p in enumerate(_OKC)], 'totals': ['240', '26-54', '7-19', '9-11', '4', '24', '28', '17', '5', '3', '6', '14', '', str(hs)]}]},
                                  {'team': team_obj('7'), 'statistics': [{'labels': labels, 'athletes': [_ath(*p, 20 if i == 0 else 14 if i == 1 else 6) for i, p in enumerate(_DEN)], 'totals': ['240', '24-55', '5-17', '8-10', '6', '25', '31', '15', '3', '2', '10', '12', '', str(as_)]}]}]
    for c in out['header']['competitions'][0]['competitors']:
        c['score'] = str(hs if c['homeAway'] == 'home' else as_)
    return out

# ---- v46: a full OKC rotation in the league player list, so the availability model has a bench to measure against ----
_handle11 = handle
def handle(url, today):
    out = _handle11(url, today)
    if 'statistics/byathlete' in url and isinstance(out, dict) and out.get('athletes'):
        rot = [('4593803', 'Jalen Williams', 32.1, 21.6, 5.3, 5.1, 1.4, 0.6, 2.4), ('4397020', 'Chet Holmgren', 29.4, 15.8, 8.0, 2.1, 0.8, 2.2, 1.6), ('4683749', 'Luguentz Dort', 27.0, 9.8, 3.9, 1.5, 1.1, 0.4, 0.9), ('4397001', 'Isaiah Hartenstein', 27.8, 11.2, 10.7, 3.8, 1.0, 1.1, 1.3),
               ('4683633', 'Cason Wallace', 25.5, 8.4, 3.4, 2.2, 1.6, 0.5, 0.8), ('4871', 'Alex Caruso', 20.1, 7.1, 2.9, 2.5, 1.5, 0.6, 1.0), ('4872', 'Aaron Wiggins', 18.6, 9.5, 3.2, 1.4, 0.6, 0.3, 0.7), ('4431178', 'Jaylin Williams', 14.2, 5.0, 4.1, 1.8, 0.4, 0.4, 0.6),
               ('4701', 'Isaiah Joe', 16.3, 8.1, 2.4, 1.1, 0.5, 0.2, 0.5), ('4702', 'Kenrich Williams', 12.9, 4.8, 3.1, 1.4, 0.4, 0.3, 0.6), ('4703', 'Ajay Mitchell', 11.0, 4.9, 1.7, 1.9, 0.4, 0.1, 0.8), ('4704', 'Dillon Jones', 8.5, 3.1, 2.0, 1.0, 0.3, 0.1, 0.5)]
        cats = out['categories']
        for pid, n, mins, pts, reb, ast, stl, blk, tov in rot:
            out['athletes'].append({'athlete': {'id': pid, 'displayName': n, 'shortName': n[0] + '. ' + n.split(' ')[-1], 'teamShortName': 'OKC', 'teamId': '25', 'position': {'abbreviation': 'G'}, 'headshot': {'href': f'https://a.espncdn.com/i/headshots/nba/players/full/{pid}.png'}},
                                    'categories': [{'name': 'general', 'values': [4, mins]}, {'name': 'offensive', 'values': [pts, reb, ast, 14.0, 3.0, 46.0, 35.0, 80.0, 1.2]}, {'name': 'defensive', 'values': [stl, blk, tov]}]})
        if not any(c['name'] == 'defensive' for c in cats): cats.append({'name': 'defensive', 'names': ['avgSteals', 'avgBlocks', 'avgTurnovers']})
    return out

# ---- v51: a postponed game on today's slate, and an overtime final ----
_handle12 = handle
def handle(url, today):
    out = _handle12(url, today)
    if '/scoreboard' in url and 'nba' in url and isinstance(out, dict) and 'events' in out and 'dates=' in url and '-' not in url.split('dates=')[1][:9]:
        d = url.split('dates=')[1][:8]
        if d == today.replace('-', ''):
            ev = event('405', '2', '4', f'{today}T23:30Z', 'post', 'Postponed', None, None, 'ESPN')
            ev['competitions'][0]['status'] = {'type': {'state': 'post', 'name': 'STATUS_POSTPONED', 'description': 'Postponed', 'shortDetail': 'Postponed', 'detail': 'Postponed', 'completed': False}}
            ev['competitions'][0].pop('odds', None)
            out['events'].append(ev)
            for e in out['events']:
                if e['id'] == '404':
                    e['competitions'][0]['status']['type']['shortDetail'] = 'Final/OT'; e['competitions'][0]['status']['type']['detail'] = 'Final/OT'
    return out

# ---- v53: scoreboard leaders on live and final games ----
_handle13 = handle
def _leaders(pid, nm, pts, reb, ast):
    L = lambda n, dn, v, pid, nm: {'name': n, 'displayName': dn, 'leaders': [{'displayValue': str(v), 'value': v, 'athlete': {'id': pid, 'displayName': nm, 'shortName': nm[0] + '. ' + nm.split(' ')[-1], 'headshot': f'https://a.espncdn.com/i/headshots/nba/players/full/{pid}.png'}}]}
    return [L('points', 'Points', pts, pid, nm), L('rebounds', 'Rebounds', reb, pid, nm), L('assists', 'Assists', ast, pid, nm)]
def handle(url, today):
    out = _handle13(url, today)
    if '/scoreboard' in url and isinstance(out, dict) and 'events' in out:
        for e in out['events']:
            st = e['competitions'][0]['status']['type']['state']
            if st == 'pre': continue
            for c in e['competitions'][0]['competitors']:
                tid = c['team']['id']
                who = {'25': ('4278073', 'Shai Gilgeous-Alexander', 24, 3, 6), '7': ('3112335', 'Nikola Jokic', 20, 10, 7), '2': ('3917376', 'Jaylen Brown', 31, 6, 4), '4': ('4', 'Josh Giddey', 22, 9, 8)}.get(tid)
                if who: c['leaders'] = _leaders(*who)
    return out

# ---- the NCAA tournament, ahead of every other rule ----
import tourney
_prev_handle = handle
def handle(url, today):
    t = tourney.handle(url)
    return t if t is not None else _prev_handle(url, today)

# ---- ESPN's real college standings (Nov 3, 2026), saved through a probe ----
import json as _json, os as _os
REAL_STAND = {}
for _k, _f in (('mens-college-basketball', 'stand/m.json'), ('womens-college-basketball', 'stand/w.json')):
    if _os.path.exists(_f): REAL_STAND[_k] = _json.load(open(_f))
_prev2 = handle
def handle(url, today):
    for k, v in REAL_STAND.items():
        if f'/{k}/standings' in url and 'season=' not in url: return v
    return _prev2(url, today)
