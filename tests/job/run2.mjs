const now = Date.now(); const iso = h => new Date(now - h * 36e5).toISOString();
const U = n => `0000000${n}-aaaa-bbbb-cccc-00000000000${n}`;
const vid = (id, n, h, dur = 18) => ({ id, headline: h, duration: dur, thumbnail: '', links: { source: { href: `https://espnmedia-cdn.akamaized.net/espn/media/16x9/wsc/2026/1110/${U(n)}/${U(n)}.mp4` } } });
const dm = (id, name, h, dur) => ({ id, headline: h, duration: dur, thumbnail: '', links: { source: { href: `https://espnmedia-cdn.akamaized.net/espn/media/16x9/2026/1110/${name}/${name}.mp4` } } });
const plays = [], wp = []; let h = 0, a = 0;
const T = { 40: ['Running Dunk Shot', 'A makes 1-foot running dunk (Z assists)', 2, true], 55: ['Pullup Jump Shot', 'B blocks C \'s 26-foot three point pullup jump shot', 0, false], 58: ['Jump Shot', 'D makes 25-foot three point jumper', 3, true], 30: ['Bad Pass\nTurnover', 'E bad pass\nturnover (F steals)', 0, false], 20: ['Driving Layup Shot', 'G makes driving layup', 2, true] };
for (let i = 0; i < 60; i++) { if (i % 2) h += 2; else a += 2; const t = T[i] || ['Jump Shot', 'x misses', 0, false];
  plays.push({ id: String(1000 + i), type: { text: t[0] }, text: t[1], scoreValue: t[2], scoringPlay: t[3], period: { number: i >= 56 ? 4 : 1 + (i >> 4), displayValue: 'Q' }, clock: { displayValue: i >= 56 ? '0:4' + (i % 6) : '5:0' + (i % 6) }, homeScore: h, awayScore: a }); wp.push({ homeWinPercentage: i === 40 ? .8 : i === 55 ? .2 : .5, playId: String(1000 + i) }); }
const PL = { 1: '1040', 2: '1055', 5: '1058', 6: '1030', 7: '1020' }, TY = { 3: 'Final Game Highlight', 8: 'Interview', 9: 'Highlight', 20: 'Analysis', 21: 'Interview', 22: 'Mystery' };
globalThis.fetch = async u => { u = String(u); let j = null;
  if (u.includes('/scoreboard')) j = u.includes('/nba/') ? { events: [{ id: '900', date: iso(14), status: { type: { state: 'post', completed: true } }, competitions: [{ competitors: [{ team: { id: '25', abbreviation: 'OKC' } }, { team: { id: '7', abbreviation: 'DEN' } }] }] }] } : { events: [] };
  else if (u.includes('/videos?event=900')) j = { videos: [vid(1, 1, 'A throws it down'), vid(2, 2, 'B denies C'), vid(5, 5, 'D from deep'), vid(6, 6, 'F picks it off'), vid(7, 7, 'G finishes'), vid(3, 3, 'X vs Y: Game Highlights', 75), dm(8, 'dm_261110_coach', 'Coach on the win', 95), dm(9, 'dm_261110_recap', 'A balls out with 30', 77)] };
  else if (u.includes('/video/clips/')) { const id = u.split('/').pop(); j = { videos: [{ id, duration: id === '20' ? 124 : id === '21' ? 90 : id === '22' ? 60 : 18, originalPublishDate: iso(13), tracking: { coverageType: TY[id] || 'OnePlay' }, categories: [{ type: 'athlete', athleteId: 77 }], plays: PL[id] ? [{ id: PL[id] }] : [], links: { source: { href: `https://espnmedia-cdn.akamaized.net/espn/media/16x9/2026/1110/ss_${id}/ss_${id}.mp4` } } }] }; }
  else if (u.includes('/summary?event=900')) j = { plays, winprobability: wp, header: { competitions: [{ competitors: [{ homeAway: 'home', score: '60', team: { id: '25', abbreviation: 'OKC', shortDisplayName: 'Thunder' } }, { homeAway: 'away', score: '60', team: { id: '7', abbreviation: 'DEN', shortDisplayName: 'Nuggets' } }] }] } };
  else if (u.includes('/teams')) j = { sports: [{ leagues: [{ teams: [] }] }] };
  else if (u.includes('/nba/news')) j = { articles: [20, 21, 22].map(id => ({ type: 'Media', id, published: iso(2), headline: id === 20 ? 'Analyst reacts' : id === 21 ? 'Player talks' : 'Unknown thing', categories: [{ type: 'team', teamId: 25 }] })) };
  else if (u.includes('/news')) j = { articles: [] };
  return { ok: !!j, status: j ? 200 : 404, json: async () => j, text: async () => JSON.stringify(j) }; };
await import('./scripts/stories.mjs');
