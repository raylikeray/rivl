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
  /* College (and any player the leagues have no photo for): ESPN's 600px cut-out is the only picture there is. Blown up to
     fill a phone screen it goes soft, so it is redrawn at twice the size with a light sharpening pass before it is shown,
     which brings the edges back. Done once per photo, kept for the visit. */
  const sharp = {};
  function sharpen(src) {
    if (sharp[src]) return sharp[src];
    sharp[src] = new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
      im.onerror = () => res(''); im.onload = () => { try {
        const W = im.naturalWidth * 2, H = im.naturalHeight * 2, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, W, H);
        const d = x.getImageData(0, 0, W, H), a = d.data, out = new Uint8ClampedArray(a.length), k = .55;   // unsharp mask: pixel + k * (pixel - blur)
        for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const i = (y * W + xx) * 4; if (a[i + 3] < 8 || y === 0 || xx === 0 || y === H - 1 || xx === W - 1) { out[i] = a[i]; out[i + 1] = a[i + 1]; out[i + 2] = a[i + 2]; out[i + 3] = a[i + 3]; continue; }
          for (let ch = 0; ch < 3; ch++) { const j = i + ch; const blur = (a[j - W * 4 - 4] + a[j - W * 4] + a[j - W * 4 + 4] + a[j - 4] + a[j] + a[j + 4] + a[j + W * 4 - 4] + a[j + W * 4] + a[j + W * 4 + 4]) / 9; out[j] = a[j] + k * (a[j] - blur); } out[i + 3] = a[i + 3]; }
        d.data.set(out); x.putImageData(d, 0, 0); c.toBlob(b => res(b ? URL.createObjectURL(b) : ''), 'image/png');
      } catch (e) { res(''); } }; im.src = src; });
    return sharp[src];
  }
  async function upgrade(img) {
    if (!img || img.dataset.hd) return; const src = decodeURIComponent(img.currentSrc || img.src || ''); const m = /headshots\/([a-z-]+)\/players\/full\/(\d+)\.png/.exec(src); if (!m) return;
    img.dataset.hd = '1'; const map = await hdMap(); const id = map[m[1]] && map[m[1]][m[2]];
    if (id) { const pre = new Image(); pre.decoding = 'async'; pre.onload = () => { if (pre.naturalWidth > 700 && img.isConnected) { img.removeAttribute('srcset'); img.removeAttribute('data-o'); img.src = pre.src; } }; pre.src = hdUrl(m[1], id); return; }
    if (!img.matches('.plshot')) return;   // the sharpening pass is for the one big photo on a player page
    const u = await sharpen(src); if (u && img.isConnected) { img.removeAttribute('srcset'); img.removeAttribute('data-o'); img.src = u; }
  }
  const BIG = '.plshot,.rhs,.stshot,.pfshot,.sthero img.stshot';
  const scan = root => (root.querySelectorAll ? root.querySelectorAll(BIG) : []).forEach(upgrade);
  if (typeof document !== 'undefined') { const run = () => scan(document); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches(BIG)) upgrade(n); scan(n); } }))).observe(document.documentElement, { childList: true, subtree: true }); setTimeout(run, 500); }
  HW.hub = { file, leaders, league, recruits, everyone, hdMap };
})();
