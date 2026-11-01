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
  /* HD photos: the leagues' own 1040px cut-outs, for players the data file links to them (NBA, WNBA). Any big face on
     screen (the player page, roster cards, stat leaders, profile cards) is upgraded once the sharp copy has loaded, so the
     swap is invisible: same framing, just crisper. If the league's photo fails, ESPN's stays. */
  let HD = null;
  async function hdMap() { if (HD) return HD; const d = await leaders(); HD = { nba: {}, wnba: {} }; if (d && d.leagues) ['nba', 'wnba'].forEach(k => ((d.leagues[k] || {}).players || []).forEach(p => { if (p.hd) HD[k][String(p.id)] = p.hd; })); return HD; }
  const hdUrl = (lk, id) => `https://cdn.${lk}.com/headshots/${lk}/latest/1040x760/${id}.png`;
  async function upgrade(img) {
    if (!img || img.dataset.hd) return; const src = decodeURIComponent(img.currentSrc || img.src || ''); const m = /headshots\/(nba|wnba)\/players\/full\/(\d+)\.png/.exec(src); if (!m) return;
    img.dataset.hd = '1'; const map = await hdMap(); const id = map[m[1]] && map[m[1]][m[2]]; if (!id) return;
    const pre = new Image(); pre.decoding = 'async'; pre.onload = () => { if (pre.naturalWidth > 700 && img.isConnected) { img.removeAttribute('srcset'); img.removeAttribute('data-o'); img.src = pre.src; } }; pre.src = hdUrl(m[1], id);
  }
  const BIG = '.plshot,.rhs,.stshot,.pfshot,.sthero img.stshot';
  const scan = root => (root.querySelectorAll ? root.querySelectorAll(BIG) : []).forEach(upgrade);
  if (typeof document !== 'undefined') { const run = () => scan(document); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches(BIG)) upgrade(n); scan(n); } }))).observe(document.documentElement, { childList: true, subtree: true }); setTimeout(run, 500); }
  HW.hub = { file, leaders, league, recruits, everyone, hdMap };
})();
