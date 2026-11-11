"""A whole NCAA tournament as ESPN-shaped scoreboard events, for building RIVL's bracket against.

MODE picks how far it has been played:
  'field'  - the 64 are set, nothing tipped off yet (what Selection Sunday looks like)
  'part'   - the first weekend is done, the Sweet 16 is next
  'done'   - every game final, a champion crowned
"""
MODE = 'done'
YEAR = 2026

# seed: (id, abbr, school, nickname, colour)  — a plausible field, real schools so the design reads true
REGIONS = {
    'East': [
        (2001, 'DUKE', 'Duke', 'Blue Devils', '001A57'), (2002, 'ALA', 'Alabama', 'Crimson Tide', '9E1B32'),
        (2003, 'WISC', 'Wisconsin', 'Badgers', 'C5050C'), (2004, 'ARIZ', 'Arizona', 'Wildcats', '0C234B'),
        (2005, 'ORE', 'Oregon', 'Ducks', '154733'), (2006, 'BYU', 'BYU', 'Cougars', '002E5D'),
        (2007, 'SMC', "Saint Mary's", 'Gaels', '06315B'), (2008, 'MISS', 'Mississippi', 'Rebels', 'CE1126'),
        (2009, 'BAY', 'Baylor', 'Bears', '154734'), (2010, 'VAN', 'Vanderbilt', 'Commodores', '866D4B'),
        (2011, 'VCU', 'VCU', 'Rams', 'FDBB30'), (2012, 'LIB', 'Liberty', 'Flames', '0A254E'),
        (2013, 'AKR', 'Akron', 'Zips', '041E42'), (2014, 'MONT', 'Montana', 'Grizzlies', '6B0F24'),
        (2015, 'ROB', 'Robert Morris', 'Colonials', '14234B'), (2016, 'MSM', "Mount St. Mary's", 'Mountaineers', '004990'),
    ],
    'West': [
        (2017, 'FLA', 'Florida', 'Gators', '0021A5'), (2018, 'STJ', "St. John's", 'Red Storm', 'BA0C2F'),
        (2019, 'TTU', 'Texas Tech', 'Red Raiders', 'CC0000'), (2020, 'MD', 'Maryland', 'Terrapins', 'E03A3E'),
        (2021, 'MEM', 'Memphis', 'Tigers', '003087'), (2022, 'MIZ', 'Missouri', 'Tigers', 'F1B82D'),
        (2023, 'KAN', 'Kansas', 'Jayhawks', '0051BA'), (2024, 'UCONN', 'UConn', 'Huskies', '000E2F'),
        (2025, 'OKLA', 'Oklahoma', 'Sooners', '841617'), (2026, 'ARK', 'Arkansas', 'Razorbacks', '9D2235'),
        (2027, 'DRKE', 'Drake', 'Bulldogs', '004477'), (2028, 'CLSN', 'Colorado St', 'Rams', '1E4D2B'),
        (2029, 'GCU', 'Grand Canyon', 'Antelopes', '522398'), (2030, 'UNCW', 'UNC Wilmington', 'Seahawks', '046A38'),
        (2031, 'OMA', 'Omaha', 'Mavericks', '000000'), (2032, 'NORF', 'Norfolk St', 'Spartans', '007A33'),
    ],
    'South': [
        (2033, 'AUB', 'Auburn', 'Tigers', '0C2340'), (2034, 'MSU', 'Michigan St', 'Spartans', '18453B'),
        (2035, 'IAST', 'Iowa St', 'Cyclones', 'C8102E'), (2036, 'TAMU', 'Texas A&M', 'Aggies', '500000'),
        (2037, 'MICH', 'Michigan', 'Wolverines', '00274C'), (2038, 'MISS', 'Ole Miss', 'Rebels', '14213D'),
        (2039, 'MARQ', 'Marquette', 'Golden Eagles', '003366'), (2040, 'LOU', 'Louisville', 'Cardinals', 'AD0000'),
        (2041, 'CREI', 'Creighton', 'Bluejays', '00519B'), (2042, 'NMSU', 'New Mexico', 'Lobos', 'BA0C2F'),
        (2043, 'SDSU', 'San Diego St', 'Aztecs', 'A6192E'), (2044, 'UCSD', 'UC San Diego', 'Tritons', '00629B'),
        (2045, 'YALE', 'Yale', 'Bulldogs', '00356B'), (2046, 'LIP', 'Lipscomb', 'Bisons', '3A1A5A'),
        (2047, 'BRY', 'Bryant', 'Bulldogs', '000000'), (2048, 'ALST', 'Alabama St', 'Hornets', 'B5A36A'),
    ],
    'Midwest': [
        (2049, 'HOU', 'Houston', 'Cougars', 'C8102E'), (2050, 'TENN', 'Tennessee', 'Volunteers', 'FF8200'),
        (2051, 'KY', 'Kentucky', 'Wildcats', '0033A0'), (2052, 'PUR', 'Purdue', 'Boilermakers', 'CEB888'),
        (2053, 'CLEM', 'Clemson', 'Tigers', 'F56600'), (2054, 'ILL', 'Illinois', 'Fighting Illini', '13294B'),
        (2055, 'UCLA', 'UCLA', 'Bruins', '2D68C4'), (2056, 'GONZ', 'Gonzaga', 'Bulldogs', '041E42'),
        (2057, 'GA', 'Georgia', 'Bulldogs', 'BA0C2F'), (2058, 'UTST', 'Utah St', 'Aggies', '00263A'),
        (2059, 'TXAM', 'Texas', 'Longhorns', 'BF5700'), (2060, 'MCN', 'McNeese', 'Cowboys', '00539B'),
        (2061, 'HIGH', 'High Point', 'Panthers', '4F2683'), (2062, 'TRY', 'Troy', 'Trojans', '8A2432'),
        (2063, 'WOF', 'Wofford', 'Terriers', 'A28D5B'), (2064, 'SIU', 'SIU Edwardsville', 'Cougars', 'A7232E'),
    ],
}
# the Final Four pairings for this year
SEMIS = [('East', 'West'), ('South', 'Midwest')]
PAIRS = [(1, 16), (8, 9), (5, 12), (4, 13), (6, 11), (3, 14), (7, 10), (2, 15)]
# who actually wins, by seed, so the results are plausible instead of random
R64_WIN = {'East': [1, 8, 5, 4, 11, 3, 7, 2], 'West': [1, 9, 12, 4, 6, 3, 10, 2],
           'South': [1, 8, 5, 13, 6, 3, 7, 2], 'Midwest': [1, 8, 5, 4, 6, 14, 7, 2]}
R32_WIN = {'East': [1, 4, 3, 2], 'West': [1, 4, 3, 2], 'South': [1, 5, 6, 2], 'Midwest': [1, 4, 6, 2]}
S16_WIN = {'East': [1, 2], 'West': [1, 3], 'South': [1, 2], 'Midwest': [1, 6]}
E8_WIN = {'East': 1, 'West': 1, 'South': 1, 'Midwest': 1}
FF_WIN = ['West', 'Midwest']
TITLE_WIN = 'West'

ROUNDS = [('1st Round', 0), ('2nd Round', 2), ('Sweet 16', 5), ('Elite 8', 7)]
PLAYED = {'field': 0, 'part': 2, 'done': 4}


def _t(region, seed):
    tid, abbr, school, nick, color = REGIONS[region][seed - 1]
    return {'id': str(tid), 'abbreviation': abbr, 'displayName': f'{school} {nick}', 'shortDisplayName': school,
            'name': nick, 'location': school, 'color': color, 'alternateColor': 'ffffff',
            'logos': [{'href': f'https://a.espncdn.com/i/teamlogos/ncaa/500/{tid}.png'}]}


def _ev(eid, date, note, a, b, aseed, bseed, winner, played, sa=None, sb=None):
    def side(team, seed, home, score, win):
        c = {'id': team['id'], 'homeAway': home, 'team': team, 'curatedRank': {'current': seed},
             'records': [{'summary': f'{30 - seed}-{seed + 2}'}]}
        if played:
            c['score'] = str(score)
            c['winner'] = win
        return c
    st = ({'state': 'post', 'completed': True, 'name': 'STATUS_FINAL', 'description': 'Final', 'shortDetail': 'Final'}
          if played else {'state': 'pre', 'completed': False, 'name': 'STATUS_SCHEDULED', 'description': 'Scheduled',
                          'shortDetail': date[5:10]})
    return {'id': str(eid), 'date': f'{date}T21:00Z', 'season': {'slug': 'post-season', 'year': YEAR},
            'status': {'type': st, 'period': 2 if played else 0, 'displayClock': '0:00'},
            'competitions': [{'id': str(eid), 'date': f'{date}T21:00Z', 'neutralSite': True,
                              'status': {'type': st, 'period': 2 if played else 0, 'displayClock': '0:00'},
                              'notes': [{'headline': note}],
                              'venue': {'fullName': 'Neutral Court', 'address': {'city': 'Indianapolis', 'state': 'IN'}},
                              'competitors': [side(a, aseed, 'home', sa, winner == 'a'),
                                              side(b, bseed, 'away', sb, winner == 'b')]}]}


WREG = {'East': 'Regional 1 in Albany', 'West': 'Regional 2 in Albany', 'South': 'Regional 3 in Portland', 'Midwest': 'Regional 4 in Portland'}

def events(women=False):
    """every game of the tournament, as far as MODE says it has been played"""
    out = []
    depth = PLAYED[MODE]
    eid = 900000
    champ = "NCAA Women's Championship" if women else "Men's Basketball Championship"
    RN = (lambda r: WREG[r]) if women else (lambda r: f'{r} Region')
    alive = {}   # region -> seeds still in
    for region in REGIONS:
        alive[region] = [s for s in range(1, 17)]
    # --- round of 64 ---
    survivors = {}
    for region in REGIONS:
        won = []
        for i, (hi, lo) in enumerate(PAIRS):
            eid += 1
            w = R64_WIN[region][i]
            played = depth >= 1
            sa, sb = (78, 65) if w == hi else (65, 78)
            out.append(_ev(eid, f'{YEAR}-03-19' if i % 2 == 0 else f'{YEAR}-03-20',
                           f'{champ} - {RN(region)} - 1st Round', _t(region, hi), _t(region, lo), hi, lo,
                           'a' if w == hi else 'b', played, sa, sb))
            won.append(w)
        survivors[region] = won
    if depth >= 2:
        # --- round of 32 ---
        s32 = {}
        for region in REGIONS:
            won = []
            for i in range(4):
                a, b = survivors[region][i * 2], survivors[region][i * 2 + 1]
                eid += 1
                w = R32_WIN[region][i]
                sa, sb = (71, 68) if w == a else (68, 71)
                out.append(_ev(eid, f'{YEAR}-03-21' if i % 2 == 0 else f'{YEAR}-03-22',
                               f'{champ} - {RN(region)} - 2nd Round', _t(region, a), _t(region, b), a, b,
                               'a' if w == a else 'b', True, sa, sb))
                won.append(w)
            s32[region] = won
        survivors = s32
    if depth >= 3:
        s16 = {}
        for region in REGIONS:
            won = []
            for i in range(2):
                a, b = survivors[region][i * 2], survivors[region][i * 2 + 1]
                eid += 1
                w = S16_WIN[region][i]
                sa, sb = (74, 69) if w == a else (69, 74)
                out.append(_ev(eid, f'{YEAR}-03-26' if i == 0 else f'{YEAR}-03-27',
                               f'{champ} - {RN(region)} - Sweet 16', _t(region, a), _t(region, b), a, b,
                               'a' if w == a else 'b', True, sa, sb))
                won.append(w)
            s16[region] = won
        survivors = s16
    if depth >= 4:
        e8 = {}
        for region in REGIONS:
            a, b = survivors[region]
            eid += 1
            w = E8_WIN[region]
            sa, sb = (80, 72) if w == a else (72, 80)
            out.append(_ev(eid, f'{YEAR}-03-29', f'{champ} - {RN(region)} - Elite 8',
                           _t(region, a), _t(region, b), a, b, 'a' if w == a else 'b', True, sa, sb))
            e8[region] = w
        # --- Final Four ---
        finalists = []
        for i, (ra, rb) in enumerate(SEMIS):
            eid += 1
            w = FF_WIN[i]
            a, b = _t(ra, e8[ra]), _t(rb, e8[rb])
            sa, sb = (77, 70) if w == ra else (70, 77)
            out.append(_ev(eid, f'{YEAR}-04-04', f'{champ} - Final Four Semifinal', a, b, e8[ra], e8[rb],
                           'a' if w == ra else 'b', True, sa, sb))
            finalists.append(w)
        eid += 1
        ra, rb = finalists
        a, b = _t(ra, e8[ra]), _t(rb, e8[rb])
        sa, sb = (69, 65) if TITLE_WIN == ra else (65, 69)
        out.append(_ev(eid, f'{YEAR}-04-06', f'{champ} - National Championship', a, b, e8[ra], e8[rb],
                       'a' if TITLE_WIN == ra else 'b', True, sa, sb))
    return out



# ---------------- the NBA playoffs, the way the real feed files them ----------------
PRO_YEAR = 2026
CONF = {
  'East': [(3001,'CLE','Cavaliers','860038',64),(3002,'BOS','Celtics','007A33',61),(3003,'NY','Knicks','F58426',51),(3004,'IND','Pacers','FDBB30',50),
           (3005,'MIL','Bucks','00471B',48),(3006,'DET','Pistons','C8102E',44),(3007,'ORL','Magic','0077C0',41),(3008,'MIA','Heat','98002E',37)],
  'West': [(3009,'OKC','Thunder','007AC1',68),(3010,'HOU','Rockets','CE1141',52),(3011,'LAL','Lakers','552583',50),(3012,'DEN','Nuggets','0E2240',50),
           (3013,'LAC','Clippers','C8102E',50),(3014,'MIN','Timberwolves','236192',49),(3015,'GS','Warriors','FDB927',48),(3016,'MEM','Grizzlies','5D76A9',48)],
}
P8 = [(1,8),(4,5),(3,6),(2,7)]
# winners by seed, and games each series took
PRO_R1 = {'East': [(1,4),(4,5),(3,6),(2,5)], 'West': [(1,4),(5,7),(6,6),(7,7)]}
PRO_R2 = {'East': [(4,5),(3,6)], 'West': [(1,7),(6,5)]}
PRO_R3 = {'East': (4,6), 'West': (1,5)}
PRO_FIN = ('West', 7)

def _pt(conf, seed):
    tid, ab, nick, col, w = CONF[conf][seed-1]
    return {'id': str(tid), 'abbreviation': ab, 'displayName': nick, 'shortDisplayName': nick, 'name': nick, 'location': nick,
            'color': col, 'alternateColor': 'ffffff', 'logos': [{'href': f'https://a.espncdn.com/i/teamlogos/nba/500/{ab.lower()}.png'}]}

def pro_standings():
    def entry(conf, seed):
        tid, ab, nick, col, w = CONF[conf][seed-1]
        return {'team': {'id': str(tid), 'abbreviation': ab, 'displayName': nick, 'shortDisplayName': nick, 'color': col},
                'stats': [{'name': 'wins', 'value': w}, {'name': 'losses', 'value': 82 - w}, {'name': 'playoffSeed', 'value': seed}]}
    return {'children': [{'name': f'{c}ern Conference', 'abbreviation': c[0], 'standings': {'entries': [entry(c, s) for s in range(1, 9)]}} for c in CONF]}

def pro_events():
    out = []; eid = 800000
    def series(note_base, ta, tb, sa, sb, winner_is_a, n, start_day):
        nonlocal eid
        need = 4; wa = wb = 0
        for g in range(1, n + 1):
            eid += 1
            # the winner takes the last game; the rest alternate
            remaining = n - g
            if winner_is_a: a_wins = (wa < need - 1 and (remaining >= need - 1 - wa or g % 2 == 1)) or g == n
            else: a_wins = not ((wb < need - 1 and (remaining >= need - 1 - wb or g % 2 == 1)) or g == n)
            if a_wins: wa += 1
            else: wb += 1
            home, away = (ta, tb) if g in (1, 2, 5, 7) else (tb, ta)
            hs, as_ = (110, 100) if (home is ta) == a_wins else (100, 110)
            day = start_day + (g - 1) * 2
            m, d = (4, day) if day <= 30 else ((5, day - 30) if day <= 61 else (6, day - 61))
            date = f'{PRO_YEAR}-{m:02d}-{d:02d}'
            hw = wa if home is ta else wb; aw = wb if home is ta else wa
            c = lambda t, ha, sc, win: {'id': t['id'], 'homeAway': ha, 'team': t, 'score': str(sc), 'winner': win, 'records': [{'summary': '50-32'}]}
            st = {'state': 'post', 'completed': True, 'name': 'STATUS_FINAL', 'description': 'Final', 'shortDetail': 'Final'}
            out.append({'id': str(eid), 'date': f'{date}T23:30Z', 'season': {'slug': 'post-season', 'year': PRO_YEAR, 'type': 3},
              'status': {'type': st, 'period': 4}, 'competitions': [{'id': str(eid), 'date': f'{date}T23:30Z', 'status': {'type': st, 'period': 4},
                'notes': [{'headline': f'{note_base} - Game {g}'}],
                'series': {'type': 'playoff', 'title': 'Playoff Series', 'summary': '', 'completed': max(wa, wb) >= need, 'totalCompetitions': 7,
                           'competitors': [{'id': home['id'], 'wins': hw}, {'id': away['id'], 'wins': aw}]},
                'competitors': [c(home, 'home', hs, hs > as_), c(away, 'away', as_, as_ > hs)]}]})
            if max(wa, wb) >= need: break
        return ta if wa > wb else tb
    champs = {}
    for conf in CONF:
        r1 = []
        for i, (hi, lo) in enumerate(P8):
            ws, n = PRO_R1[conf][i]
            r1.append((series(f'{conf} 1st Round', _pt(conf, hi), _pt(conf, lo), hi, lo, ws == hi, n, 19 + i), ws))
        r2 = []
        for i in range(2):
            (ta, sa), (tb, sb) = r1[i*2], r1[i*2+1]
            ws, n = PRO_R2[conf][i]
            hi_first = sa < sb
            A, B, SA, SB = (ta, tb, sa, sb) if hi_first else (tb, ta, sb, sa)
            r2.append((series(f'{conf} Semifinals', A, B, SA, SB, ws == SA, n, 36 + i), ws))
        (ta, sa), (tb, sb) = r2
        ws, n = PRO_R3[conf]
        A, B, SA, SB = (ta, tb, sa, sb) if sa < sb else (tb, ta, sb, sa)
        champs[conf] = (series(f'{conf} Finals', A, B, SA, SB, ws == SA, n, 50), ws)
    (te, se), (tw, sw) = champs['East'], champs['West']
    series('NBA Finals', tw, te, sw, se, PRO_FIN[0] == 'West', PRO_FIN[1], 66)
    return out

def handle(url):
    """the tournament's scoreboard and the playoff field, when the app asks the way it does against the real feed"""
    import re
    m = re.search(r'dates=(\d{6})(?!\d)', url)
    if '/nba/standings' in url and f'season={PRO_YEAR}' in url: return pro_standings()
    if '/scoreboard' in url and '/nba/' in url and m and m.group(1)[:4] == str(PRO_YEAR) and m.group(1)[4:] in ('04', '05', '06'):
        return {'events': [e for e in pro_events() if e['date'][:7].replace('-', '') == m.group(1)]}
    if '/wnba/standings' in url and f'season={PRO_YEAR}' in url:
        st = pro_standings(); return {'children': [st['children'][1]]}
    if '/scoreboard' in url and '/wnba/' in url and m and m.group(1)[:4] == str(PRO_YEAR) and m.group(1)[4:] in ('09', '10'):
        import copy
        out = []
        for e in pro_events():
            e = copy.deepcopy(e); c = e['competitions'][0]; n = c['notes'][0]['headline']
            if not n.startswith('West'): continue
            n = n.replace('West 1st Round', 'First Round').replace('West Semifinals', 'WNBA Semifinals').replace('West Finals', 'WNBA Finals')
            c['notes'][0]['headline'] = n
            import datetime as _d
            dt = _d.date(int(e['date'][:4]), int(e['date'][5:7]), int(e['date'][8:10])) + _d.timedelta(days=148)
            e['date'] = dt.isoformat() + e['date'][10:]
            if e['date'][:7].replace('-', '') == m.group(1): out.append(e)
        return {'events': out}
    if '/scoreboard' not in url or 'college-basketball' not in url: return None
    if re.search(r'dates=\d{8}-\d{8}', url): return {'code': 400, 'message': 'Failed to get events endpoint.'}
    if not m or m.group(1)[:4] != str(YEAR) or m.group(1)[4:] not in ('03', '04'): return None
    women = 'womens-college-basketball' in url
    return {'events': [e for e in events(women) if e['date'][:7].replace('-', '') == m.group(1)]}
