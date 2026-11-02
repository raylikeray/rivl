/* RECRUIT: a high-school prospect's own page, drawn the way every other entity page in this app is drawn — the same
   hero, the same cards, the same pills. Basketball only: rank, position, size, school, class, where they are committed
   (or the schools still in the running) and what the recruiting services say.

   These are minors, so the page reads from the nightly rankings file and nothing else. No lookups of any kind, nothing
   about their lives away from basketball, and no links off to another site.

   Route: #recruit/<boys|girls>/<class>/<slug> */
(function () {
  'use strict';
  const V = HW.v5, _ = V._, esc = HW.esc, LEAGUES = HW.LEAGUES;
  const slugOf = r => String(r.slug || r.n || '').split('/').pop().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const href = (g, cls, r) => `#recruit/${g}/${cls}/${slugOf(r)}`;
  const nn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const lkOf = g => g === 'girls' ? 'ncaaw' : 'ncaam';
  const hide = 'onerror="this.remove()"';

  /* the college a recruit committed to, found in the app's own team list by name ("Indiana Hoosiers", "Kentucky") */
  async function schoolOf(name, lk) {
    if (!name) return null;
    const idx = await V.teamsIndex(LEAGUES[lk]).catch(() => ({}));
    const want = nn(name), all = Object.values(idx || {});
    return all.find(t => nn(t.name) === want) || all.find(t => nn(t.short) === want) || all.find(t => nn(t.loc) === want)
      || all.find(t => nn(t.name).startsWith(want)) || null;
  }

  async function recruitV(g, cls, slug) {
    const $main = document.getElementById('main'), lk = lkOf(g), L = LEAGUES[lk];
    const back = `<div class="topbar"><a class="ib" href="#stats" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg></a></div>`;
    if (!$main.querySelector('.rcpage')) $main.innerHTML = back + _.skeleton(1, 'card') + _.skeleton(3, 'row');

    const REC = await HW.hub.recruits().catch(() => null);
    const list = REC && REC[g] && REC[g][cls] || [];
    const r = list.find(x => slugOf(x) === slug);
    if (!r) { $main.innerHTML = back + _.empty('Recruit not found', '<p style="margin:6px 0 0">The rankings change every week; this prospect may have moved to another class.</p>', `<a class="btn" href="#stats">All recruits</a>`); return; }

    const school = await schoolOf(r.commitTo, lk);
    const color = school ? _.teamColor({ id: school.id, abbr: school.abbr }, L) : '#2A3350';
    const first = (r.n || '').split(' ')[0], rest = (r.n || '').split(' ').slice(1).join(' ');
    const facts = [r.ht, r.wt ? `${r.wt} lbs` : '', r.hs, r.home].filter(Boolean);
    const sub = [r.pos, `Class of ${cls}`].filter(Boolean).map(esc).join(' · ');

    const hero = `<div class="ehero rchero" style="--a:${esc(color)}">
      ${school && school.logo ? `<img class="tlg" src="${esc(school.logo)}" alt="" ${hide}>` : ''}<div class="wm">${r.rank || ''}</div>
      ${r.img ? `<span class="shot"><img src="${esc(r.img)}" alt="" decoding="async" ${hide}></span>` : ''}
      <div class="in">${school ? `<a class="tchip" href="${_.href.team(lk, school.id)}">${school.logo ? `<img src="${esc(school.logo)}" alt="" ${hide}>` : ''}<b>${esc(school.short || school.name)}</b></a>` : ''}
        ${sub ? `<div class="sub">${sub}</div>` : ''}<h1>${esc(first)}${rest ? `<br>${esc(rest)}` : ''}</h1>
        <div class="facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</div></div></div>`;

    /* the numbers people look for first: where this prospect ranks, nationally and at the position */
    const nums = [['Rank', r.rank ? `No. ${r.rank}` : ''], ['At position', r.posRank ? `No. ${r.posRank}` : ''], ['Position', r.pos], ['Height', r.ht], ['Weight', r.wt ? `${r.wt} lbs` : ''], ['Class', cls]].filter(f => f[1]);
    /* the grid is three across, so a prospect missing a weight gets blank cells rather than a hole in the sheet */
    const blanks = nums.length % 3 ? 3 - nums.length % 3 : 0;
    const numsCard = nums.length ? `<section class="card"><div class="card-h"><h2>The prospect</h2>${r.tier ? `<small>${esc(String(r.tier).toLowerCase())}</small>` : ''}</div>
      <div class="rcgrid">${nums.map(([k, v]) => `<div><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`).join('')}${'<div class="rcblank"></div>'.repeat(blanks)}</div></section>` : '';

    const where = r.hs || r.home || r.club ? `<section class="card"><div class="card-h"><h2>Where they play</h2></div>
      <div class="rcrows">${[['High school', r.hs], ['Hometown', r.home], ['Club', r.club]].filter(f => f[1]).map(([k, v]) => `<div class="rcr"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></section>` : '';

    /* committed: the school's own card, which opens its team page. Otherwise the schools still in it. */
    const commit = school
      ? `<section class="card"><div class="card-h"><h2>Commitment</h2>${r.flip ? '<small>flipped</small>' : ''}</div>
         <a class="rccommit" href="${_.href.team(lk, school.id)}" style="--a:${esc(color)}">${school.logo ? `<img src="${esc(school.logo)}" alt="" ${hide}>` : ''}<span><b>${esc(school.name || school.short)}</b><em>${esc(r.commitSince ? `Committed ${r.commitSince}` : 'Committed')}</em></span>${_.chev}</a></section>`
      : r.commitTo
        ? `<section class="card"><div class="card-h"><h2>Commitment</h2></div><div class="rcrows"><div class="rcr"><span>${esc(r.commitSince ? `Since ${r.commitSince}` : 'Committed to')}</span><b>${esc(r.commitTo)}</b></div></div></section>`
        : (r.top && r.top.length
          ? `<section class="card"><div class="card-h"><h2>Schools in the running</h2>${r.status ? `<small>${esc(String(r.status).toLowerCase())}</small>` : ''}</div>
             <div class="rctop">${r.top.map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div></section>`
          : `<section class="card"><div class="card-h"><h2>Commitment</h2></div><div class="rcrows"><div class="rcr"><span>Status</span><b>${esc(r.status || 'Uncommitted')}</b></div></div></section>`);

    /* each service separately, so a prospect the services disagree on reads as one */
    const svc = r.svc ? Object.entries(r.svc).filter(([, v]) => v && (v.rating != null || v.rank != null)) : [];
    const services = svc.length ? `<section class="card"><div class="card-h"><h2>What the services say</h2>${r.cons ? `<small>${r.cons} ratings blended</small>` : ''}</div>
      <div class="rcsvc">${svc.map(([k, v]) => `<div><span>${esc(k)}</span><b>${v.rating != null ? esc(String(v.rating)) : '-'}</b><em>${v.rank != null ? `No. ${esc(String(v.rank))}` : 'unranked'}</em></div>`).join('')}</div></section>` : '';

    const others = list.filter(x => x !== r).slice(0, 5);
    const more = others.length ? _.sec(`More in the class of ${cls}`, '', `<a href="#stats">All ${list.length}</a>`)
      + `<div class="stboard">${others.map(x => `<a class="strow strec" href="${href(g, cls, x)}"><span class="strk">${x.rank || ''}</span>${_.headshot(x.img || '', '#5B6B8C', 40, x.n)}<span class="stwho"><b>${esc(x.n)}</b><em>${esc([x.pos, x.ht, x.hs].filter(Boolean).join(' · '))}</em></span><span class="strc${x.commitTo ? ' on' : ''}">${esc(x.commitTo || 'Uncommitted')}</span></a>`).join('')}</div>` : '';

    $main.innerHTML = `<div class="rcpage">${back}${hero}${numsCard}${where}${commit}${services}${more}<p class="legend rcsrc">Rankings from PrepRanks, a blend of the major recruiting services.</p></div>`;
    document.title = `${r.n} · RIVL`;
  }

  V.recruit = recruitV; V.recruitHref = href;
})();
