/* One place the app reads its big data from: data/leaders.json (every player in every league, rookies tagged, last
   season alongside) and data/recruits.json, both built by the repo's own jobs every few hours. Search, Stats and the
   rating all read these instead of each paging through ESPN on the phone. Kept in memory for the visit; the service
   worker keeps a copy for a warm start. */
(function () {
  'use strict';
  const mem = {};
  const slot = () => Math.floor(Date.now() / (30 * 60000));   // a new copy at most every half hour
  function file(name) {
    const k = name + ':' + slot(); if (mem[k]) return mem[k];
    const url = `data/${name}?v=${slot()}`;   // this app's own data folder (HW.DATA points at the old Tipoff jobs)
    mem[k] = (HW.jSoft ? HW.jSoft(url, 30 * 60000) : fetch(url).then(r => r.ok ? r.json() : null)).catch(() => null);
    return mem[k];
  }
  async function leaders() { return (await file('leaders.json')) || null; }
  async function league(L) { const d = await leaders(); return d && d.leagues && d.leagues[L.key || L] || null; }
  async function recruits() { return (await file('recruits.json')) || null; }
  /* every player in one list, each tagged with its league, for search */
  async function everyone() {
    const d = await leaders(); if (!d || !d.leagues) return [];
    const out = []; Object.entries(d.leagues).forEach(([lk, v]) => (v.players || []).forEach(p => out.push({ ...p, lk, season: v.label, lastSeason: !!v.lastSeason })));
    return out;
  }
  HW.hub = { file, leaders, league, recruits, everyone };
})();
