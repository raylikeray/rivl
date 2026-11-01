/* RECRUIT: a high-school prospect's own page, in the same hero layout as a player's. Basketball only: rank, position,
   size, school, class, where they're committed (or the schools in the running), what the recruiting services say, and
   the latest stories. Opens from the Stats recruits list and from Search. Route: #recruit/<boys|girls>/<class>/<slug> */
(function () {
  'use strict';
  const V = HW.v5, _ = V._, esc = HW.esc, LEAGUES = HW.LEAGUES;
  const slugOf = r => String(r.slug || r.n || '').split('/').pop().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const href = (g, cls, r) => `#recruit/${g}/${cls}/${slugOf(r)}`;
  const nn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const lkOf = g => g === 'girls' ? 'ncaaw' : 'ncaam';
  /* the college a recruit committed to, found in the app's team list by name ("Indiana Hoosiers", "Kentucky") */
  async function schoolOf(name, lk) {
    if (!name) return null; const idx = await V.teamsIndex(LEAGUES[lk]).catch(() => ({})); const want = nn(name), first = want.split(' ')[0];
    const all = Object.values(idx || {});
    return all.find(t => nn(t.name) === want) || all.find(t => nn(t.short) === want) || all.find(t => nn(t.loc) === want) || all.find(t => nn(t.name).startsWith(want)) || all.find(t => nn(t.short) === first || nn(t.loc) === first) || null;
  }
  async function recruitV(g, cls, slug) {
    const $main = document.getElementById('main'), lk = lkOf(g), L = LEAGUES[lk];
    $main.innerHTML = _.skeleton(1, 'card') + _.skeleton(3, 'row');
    const REC = await HW.hub.recruits().catch(() => null); const list = REC && REC[g] && REC[g][cls] || [];
    const r = list.find(x => slugOf(x) === slug); if (!r) { $main.innerHTML = _.empty('Recruit not found'); return; }
    const school = await schoolOf(r.commitTo, lk);
    const color = school ? _.teamColor({ id: school.id, abbr: school.abbr }, L) : '#1F2A44';
    const c2 = school ? (_.teamAlt({ id: school.id, abbr: school.abbr, alt: school.alt }, L) || color) : '#C9CED8';
    const hide = 'onerror="this.remove()"';
    const sub = [r.rank ? `No. ${r.rank}` : '', r.pos, `Class of ${cls}`].filter(Boolean).map(esc).join(' · ');
    const inner = `<div class="plh rch">${school && school.logo ? `<img class="plwm" src="${esc(school.logo)}" alt="" ${hide}>` : ''}${r.img ? `<img class="plshot rcshot" src="${esc(r.img)}" alt="" decoding="async" ${hide}>` : `<b class="plini">${esc((r.n || '').split(' ').map(w => w[0]).join('').slice(0, 2))}</b>`}<div class="pltx"><h1>${esc(r.n)}</h1><p>${sub}</p><div class="plact">${school ? `<a class="plteam rcteam" href="${_.href.team(lk, school.id)}">${school.logo ? `<img src="${esc(school.logo)}" alt="" ${hide}>` : ''}Committed to ${esc(school.short || school.name)}</a>` : `<span class="rcun">${esc(r.commitTo ? `Committed to ${r.commitTo}` : (r.status || 'Uncommitted'))}</span>`}</div></div></div>`;
    const bar = `<a class="gxib" href="#stats" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a><div class="gxmid2"><div class="gxctr" id="gxmini"><span class="gxmn plmn">${_.headshot(r.img || '', color, 40, r.n)}<span><b>${esc(r.n)}</b><small>${esc(r.hs || '')}</small></span></span></div></div><span class="gxib ghost" aria-hidden="true"></span>`;
    const facts = [['Rank', r.rank ? `No. ${r.rank}` : ''], ['Position', r.pos], ['Height', r.ht], ['Weight', r.wt ? `${r.wt} lbs` : ''], ['Class', `${cls}`], ['At position', r.posRank ? `No. ${r.posRank}` : '']].filter(f => f[1]);
    const factsT = `<div class="gxplate plfacts">${facts.map(([k, v]) => `<div><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
    const where = `<div class="gxplate rcwhere">${r.hs ? `<div><span>High school</span><b>${esc(r.hs)}</b></div>` : ''}${r.home ? `<div><span>Hometown</span><b>${esc(r.home)}</b></div>` : ''}</div>`;
    const commit = school ? `${_.sec('Commitment')}<a class="gxplate rccommit" href="${_.href.team(lk, school.id)}" style="${_.tcv(color)}">${school.logo ? `<img src="${esc(school.logo)}" alt="" ${hide}>` : ''}<span><b>${esc(school.name || school.short)}</b><em>${r.commitSince ? `Committed ${esc(r.commitSince)}` : 'Committed'}${r.flip ? ' · flipped' : ''}</em></span>${_.chev}</a>`
      : r.commitTo ? `${_.sec('Commitment')}<div class="gxplate rctop"><span>${esc(r.commitTo)}</span><span>${esc(r.commitSince ? `since ${r.commitSince}` : 'Committed')}</span></div>` : (r.top && r.top.length ? `${_.sec('Schools in the running', r.status || '')}<div class="gxplate rctop">${r.top.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : `${_.sec('Commitment')}<div class="gxplate rctop"><span>${esc(r.status || 'Uncommitted')}</span></div>`);
    const svc = r.svc ? Object.entries(r.svc).filter(([, v]) => v && (v.rating || v.rank)) : [];
    const services = svc.length ? `${_.sec('What the services say', r.cons ? `${r.cons} ratings blended` : '')}<div class="gxplate rcsvc">${svc.map(([k, v]) => `<div><span>${esc(k)}</span><b>${v.rating != null ? esc(String(v.rating)) : '—'}</b><em>${v.rank ? `No. ${esc(String(v.rank))}` : 'rating'}</em></div>`).join('')}${r.score != null ? `<div class="all"><span>PrepRanks</span><b>${esc(String(r.score))}</b><em>${esc(r.tier || 'score')}</em></div>` : ''}</div>` : '';
    const stories = (r.ph || []).slice(0, 8);
    const news = stories.length ? `<div class="gxplate rcnews">${stories.map(x => `<a class="rcst" href="${esc(x.u)}" target="_blank" rel="noopener"><b>${esc(x.t)}</b><em>${esc(x.d ? new Date(x.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')} · PrepHoops</em>${x.s ? `<p>${esc(String(x.s).slice(0, 220))}${String(x.s).length > 220 ? '…' : ''}</p>` : ''}</a>`).join('')}</div>` : _.empty('No stories yet', '<p style="margin:6px 0 0">PrepHoops has not written this one up yet.</p>');
    const src = `<p class="rcsrc">Rankings from <a href="https://prepranks.com${esc(r.slug || '')}" target="_blank" rel="noopener">PrepRanks</a>, a blend of the major recruiting services. Stories from PrepHoops.</p>`;
    const cmpRows = list.filter(x => x !== r).slice(0, 5);
    const others = cmpRows.length ? `${_.sec(`More in the class of ${cls}`, '', `<a href="#stats">All ${list.length}</a>`)}<div class="gxplate rcothers">${cmpRows.map(x => `<a class="strow strec" href="${href(g, cls, x)}"><span class="strk">${x.rank || ''}</span>${_.headshot(x.img || '', '#5B6B8C', 40, x.n)}<span class="stwho"><b>${esc(x.n)}</b><em>${esc([x.pos, x.ht, x.hs].filter(Boolean).join(' · '))}</em></span><span class="strc${x.commitTo ? ' on' : ''}">${esc(x.commitTo || 'Uncommitted')}</span></a>`).join('')}</div>` : '';
    V._.heroShell({ cls: 'plpage rcpage', color, c2, inner, bar, act: 'rtab', attr: 'data-rtab-panel', tab: 'summary', tabs: [['summary', 'Overview'], ['news', 'News']], panels: { summary: factsT + where + commit + services + others + src, news: news } });
    if (!V._rtabL) { V._rtabL = e => { const b = e.target.closest('[data-act="rtab"]'); if (!b) return; e.preventDefault(); const k = b.dataset.tab; $main.querySelectorAll('[data-act="rtab"]').forEach(x => { const on = x.dataset.tab === k; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); $main.querySelectorAll('[data-rtab-panel]').forEach(p => { p.hidden = p.dataset.rtabPanel !== k; }); }; document.addEventListener('click', V._rtabL); }
    document.title = `${r.n} · RIVL`;
  }
  V.recruit = recruitV; V.recruitHref = href;
})();
