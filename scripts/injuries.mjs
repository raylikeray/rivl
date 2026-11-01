// Keeps data/injuries.json: a running log of the NBA and WNBA injury reports (ESPN publishes only what is current, so the
// app records it a few times a day and keeps what it has seen). For every listed injury: who, which team, what, the
// status now and every status change with its date, when it first appeared, when it was last seen, and when it dropped
// off the report (cleared). Entries stay for 400 days, so a season's worth can be counted, sorted and compared.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const athId = a => String(a.id || (String(a.uid || '').match(/a:(\d+)/) || [])[1] || ((a.links || []).map(l => (String(l.href || '').match(/\/id\/(\d+)/) || [])[1]).find(Boolean)) || (String(a.$ref || '').match(/athletes\/(\d+)/) || [])[1] || '');
async function J(url, tries = 3) { for (let i = 0; i < tries; i++) { try { const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (RIVL personal app)' }, signal: AbortSignal.timeout(20000) }); console.log('GET', url.slice(-30), r.status); if (r.ok) return r.json(); if (r.status === 404) return null; } catch (e) { console.log('fetch failed', e.message); } await sleep(800 * (i + 1)); } return null; }
const LEAGUES = { nba: 'nba', wnba: 'wnba' };
const FILE = 'data/injuries.json';
const old = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { leagues: {} };
const now = new Date().toISOString(), today = now.slice(0, 10);
const out = { updated: now, source: 'ESPN injury reports, recorded by RIVL every few hours', leagues: {} };
const severity = s => /out for season|season/i.test(s) ? 5 : /^out$/i.test(s) ? 4 : /doubt/i.test(s) ? 3 : /quest|game.?time|day.?to.?day/i.test(s) ? 2 : /prob/i.test(s) ? 1 : 0;
for (const [lk, path] of Object.entries(LEAGUES)) {
  const prev = (old.leagues && old.leagues[lk] && old.leagues[lk].all) || {};
  const d = await J(`https://site.api.espn.com/apis/site/v2/sports/basketball/${path}/injuries`);
  console.log(lk, 'feed teams', d && d.injuries ? d.injuries.length : 'none', d && d.injuries && d.injuries[0] ? JSON.stringify(d.injuries[0]).slice(0, 300) : '');
  if (!d || !d.injuries) { out.leagues[lk] = old.leagues && old.leagues[lk] || { all: prev, current: [] }; console.log(lk, 'feed did not answer; kept'); continue; }
  const all = { ...prev }, current = []; let skipped = 0;
  for (const t of d.injuries) {
    const team = { id: String(t.id || ''), name: t.displayName || '', abbr: '' };
    for (const x of t.injuries || []) {
      const a = x.athlete || {}; const pid = athId(a); if (!pid) { if (!skipped++) console.log('no id', JSON.stringify(a).slice(0, 300)); continue; }
      const det = x.details || {}; const status = x.status || ''; const what = [det.side && det.side !== 'Not Specified' ? det.side : '', det.type || det.detail || ''].filter(Boolean).join(' ').trim();
      const key = `${pid}:${(det.type || det.detail || x.type?.description || 'injury').toLowerCase().replace(/[^a-z]+/g, '-')}`;
      const seenBefore = all[key];
      const e = seenBefore || { key, pid, name: a.displayName || '', pos: a.position?.abbreviation || '', team, first: (x.date || now).slice(0, 10), log: [] };
      e.team = { ...team, abbr: a.team?.abbreviation || e.team.abbr || '' }; e.name = a.displayName || e.name; e.pos = a.position?.abbreviation || e.pos;
      e.status = status; e.what = what || e.what || ''; e.detail = det.detail || e.detail || ''; e.sev = severity(status);
      e.ret = det.returnDate ? String(det.returnDate).slice(0, 10) : (e.ret || ''); e.fantasy = det.fantasyStatus?.description || e.fantasy || '';
      e.note = x.shortComment || e.note || ''; e.long = x.longComment || e.long || ''; e.reported = (x.date || e.reported || now).slice(0, 10);
      e.last = today; delete e.cleared;
      const lastLog = e.log[e.log.length - 1]; if (!lastLog || lastLog.s !== status) e.log.push({ d: today, s: status });
      all[key] = e; current.push(key);
    }
  }
  // anything that was on the report and is not any more: cleared (back, or dropped from the list) as of today
  for (const [k, e] of Object.entries(all)) { if (!current.includes(k) && !e.cleared) { e.cleared = today; e.log.push({ d: today, s: 'Cleared' }); } }
  // keep 400 days
  const cut = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  for (const [k, e] of Object.entries(all)) if ((e.cleared || e.last) < cut) delete all[k];
  out.leagues[lk] = { all, current, count: current.length };
  console.log(lk, 'current', current.length, 'all', Object.keys(all).length);
  await sleep(300);
}
writeFileSync(FILE, JSON.stringify(out));
