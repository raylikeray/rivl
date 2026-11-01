// one-off check of the search topic answers against live Wikipedia (not part of the app)
import { readFileSync } from 'node:fs';
const src = readFileSync('js/ask.js', 'utf8');
const grab = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const code = [grab('  const norm = s =>', '  function lev('), grab('  const splitWiki =', '  function bestPara('), grab('  const TOPICS = [', '  async function wdPeople(')].join('\n');
const esc = s => String(s); const HW = {}; const WAPI = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&';
const jget = u => fetch(u, { headers: { 'user-agent': 'RIVL test' } }).then(r => r.json());
const f = new Function('esc', 'jget', 'WAPI', code + '\nreturn { norm, topicOf, articleOf, topicSentences, hiNeed };');
const T = f(esc, jget, WAPI);
const Q = [['Stephen Curry', 'nba', 'steph curry kids'], ['LeBron James', 'nba', 'lebron wife'], ['Caitlin Clark', 'wnba', 'caitlin clark boyfriend'], ['Kevin Durant', 'nba', 'kd shoes'], ['Giannis Antetokounmpo', 'nba', 'giannis brothers'], ['Nikola Jokic', 'nba', 'jokic awards'], ["A'ja Wilson", 'wnba', 'aja wilson parents']];
for (const [name, lk, q] of Q) {
  const t = T.topicOf(q); const art = await T.articleOf(name, lk);
  console.log('\n=== ' + q + ' → ' + (t && t.k) + ' · article: ' + (art && art.title));
  if (t && art) T.topicSentences(art.text, t, name).forEach(x => console.log(' [' + x.sec + '] ' + x.s));
}
