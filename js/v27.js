/* RIVL 2027 preview (v462).
   Off unless Settings has "Try the new design" switched on, so the app everyone has is unchanged.
   Section 1 of the redesign: the four-tab bar, the search field, and Home. Watch, Scores and You open the screens the
   app has today until their own sections are built. Every fact on this screen comes from the feeds the app already
   reads; RIVL's own numbers are labeled "RIVL projection". */
(() => {
  'use strict';
  const { LEAGUES, ORDER, store, esc, S, isLive, isDone, isFav, favs, todayCT, tipOf, relDay, finalWord } = HW;
  const V = HW.v5, X = V.x27, U = V._;
  if (!X || !U) return;
  const root = document.documentElement, $main = document.getElementById('main');
  const $bar = document.getElementById('tb27'), $seg = document.getElementById('seg27');
  const on = () => !!store.get('v5:rv27', false);
  const MOTION = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = s => { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };
  const ymd = g => HW.ymdOf(g.date);
  const noTz = t => String(t).replace(/\s+(CT|ET|PT|MT|CST|CDT|EST|EDT|PST|PDT|MST|MDT)$/, '');
  const gameOf = k => { const i = k.indexOf(':'); return (S.today[k.slice(0, i)] || []).find(g => g.id === k.slice(i + 1)) || null; };

  /* ---------- colour: a team's colour as a surface white text can sit on ---------- */
  const tone = c => { let b = U.V_deep(c && !/^#?2A2D33$/i.test(c) ? c : '#3a3f4b'); if (U.lumOf(b) < .045) b = '#3a3f4b'; return b; };
  const grad = (c, deg = 160) => { const b = tone(c); return `linear-gradient(${deg}deg,${b},${U.mixTo(b, 0, .55)})`; };
  const disc = (t, px) => `<span class="cr27${t.logo ? '' : ' noimg'}" style="width:${px}px;height:${px}px;font-size:${Math.max(8, Math.round(px * .26))}px">${t.logo ? U.imgSized(t.logo, 96, 96, '', "this.parentNode.classList.add('noimg');this.remove()") : ''}<b>${esc(String(t.abbr || '').slice(0, 4))}</b></span>`;
  const face = (src, name, px) => `<span class="fc27" style="width:${px}px;height:${px}px;font-size:${Math.round(px * .36)}px"><b>${esc(U.initials(name))}</b>${src ? U.imgSized(src, 254, 185, '', 'this.remove()') : ''}</span>`;
  const I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.9 4.9 0 0 1 0-7 5 5 0 0 1 7 0l.4.4.4-.4a5 5 0 0 1 7 0 4.9 4.9 0 0 1 0 7z"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h10a1.5 1.5 0 0 1 1.500 1.500v15.500L12 16.400l-6.500 4.100V5A1.500 1.500 0 0 1 7 3.500z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200"/></svg>',
    me: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="16" r="7"/><path d="M6 41c1-10 7-15 14-15s13 5 14 15z"/></svg>',
    mark: '<svg class="mk27" viewBox="0 0 160 160" role="img" aria-label="RIVL"><rect width="160" height="160" rx="40" fill="#fff"/><g transform="translate(44 36) scale(0.713)" fill="#000"><path d="M0 0H88.800A11.200 11.200 0 0 1 100 11.200V50.500A11.200 11.200 0 0 1 88.800 61.700H62.300L0 25.610Z"/><path d="M0 47.020 100 104.960V123.410H0Z"/></g></svg>'
  };

  /* ---------- the shell: the four-tab bar, and Games / Standings / Leaders across the top of Scores ---------- */
  const SCORES = ['scores', 'standings', 'stats'];
  function paintBar() {
    const live = on(); root.classList.toggle('rv27', live); if ($bar) $bar.hidden = !live; if (!live) { if ($seg) $seg.hidden = true; return; }
    const pg = root.dataset.page || 'home'; const old = document.querySelector('#tabs .tab.on'); const owner = old ? old.dataset.tab : 'home';
    const cur = pg === 'settings' ? 'you' : SCORES.includes(owner) ? 'scores' : 'home';
    $bar.querySelectorAll('[data-t27]').forEach(a => { const is = a.dataset.t27 === cur; a.classList.toggle('on', is); if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const inScores = SCORES.includes(pg); $seg.hidden = !inScores;
    if (inScores) $seg.querySelectorAll('a').forEach(a => { const is = a.dataset.s27 === pg; a.classList.toggle('on', is); if (is) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  if ($bar) $bar.addEventListener('click', e => {
    const a = e.target.closest('[data-t27]'); if (!a) return; e.preventDefault(); const k = a.dataset.t27;
    if (k === 'watch') { watch(); return; }
    if (k === 'you') { if (root.dataset.page === 'settings' && location.hash === '#settings') window.scrollTo({ top: 0, behavior: MOTION() ? 'smooth' : 'auto' }); else location.hash = '#settings'; return; }
    const pg = root.dataset.page;
    if (k === 'scores' && (pg === 'standings' || pg === 'stats')) { location.hash = '#scores'; return; }
    const t = document.querySelector(`#tabs .tab[data-tab="${k}"]`); if (t) t.click();   // the bar the app has today keeps each tab's trail; this one drives it
  });
  document.addEventListener('rivl:rendered', paintBar);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="rv27"]'); if (!b) return; e.preventDefault();
    const next = b.getAttribute('aria-checked') !== 'true'; store.set('v5:rv27', next); b.setAttribute('aria-checked', String(next)); paintBar();
    V.toast(next ? 'New design is on. Tap Home to see it.' : 'Back to the current design.');
  });
  /* how sharp clips play: Auto (the full-size file on Wi-Fi), Sharpest (always), Data saver (never) */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="vq"]'); if (!b) return; e.preventDefault(); store.set('v5:vq', b.dataset.vq);
    b.parentNode.querySelectorAll('[data-act="vq"]').forEach(x => { const is = x === b; x.classList.toggle('on', is); x.setAttribute('aria-checked', String(is)); });
  });
  const vqRow = () => { const cur = store.get('v5:vq', 'auto');
    return `<div class="gl setlook"><div class="gr ni"><span class="sico" data-k="watch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9.500 4.500 2.500-4.500 2.500z" fill="currentColor"/></svg></span><span class="gm"><b>Clip quality</b></span><div class="segc fit" role="radiogroup" aria-label="Clip quality">${[['auto', 'Auto'], ['always', 'Sharpest'], ['never', 'Saver']].map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="vq" data-vq="${k}" role="radio" aria-checked="${cur === k}">${l}</button>`).join('')}</div></div></div><p class="vq27">Auto plays clips at full size on Wi-Fi and lighter on cellular. A full-size clip is about 20 MB.</p>`; };
  V.rv27 = { on, vq: vqRow, miss(el) { const p = el.parentNode; if (p) { p.className = 'ph27 no27'; p.innerHTML = I.me; } },
    row: () => `<div class="gl"><button class="gr ni sw" data-act="rv27" role="switch" aria-checked="${on()}"><span class="sico" data-k="look"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.500 13.900 9l5.600 1.900-5.600 1.900L12 18.300l-1.900-5.500L4.500 10.900 10.100 9z"/></svg></span><span class="gm wrap"><b>Try the new design</b><span>A preview of the 2027 look. Home and the bottom bar so far. Switch it off any time.</span></span><span class="switch"></span></button></div>` };

  /* Watch opens the clips the app has today: For you when there is one, otherwise the league's biggest plays */
  async function watch(startId, key) {
    const srcs = ORDER.map(X.feedSource);
    if (!srcs.some(s => s.out)) await Promise.race([Promise.all(srcs.map(s => s.ready)), new Promise(r => setTimeout(r, 4000))]);
    const subs = X.storySubjects();
    const s = (key && subs.find(x => x.key === key)) || subs.find(x => x.key === 'all:feed') || subs.find(x => x.kind === 'league') || subs.find(x => x.un) || subs[0];
    if (!s) { V.toast('No clips yet. Follow a team and its plays show up here.'); return; }
    V.storyOpen(s.key, startId);
  }

  /* ---------- words ---------- */
  const greet = () => { const h = new Date().getHours(); const w = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; const n = String(store.get('v5:name', '') || '').trim().slice(0, 24); return n ? `${w}, ${n}` : w; };
  const dateLine = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const NTH = ['', 'First', 'Second', 'Third', 'Fourth'];
  const clockLong = g => { const d = String(g.detail || 'Live'); let m;
    if ((m = d.match(/^(End )?Q([1-4])(?: (.+))?$/))) return `${m[1] ? 'End of the ' + NTH[m[2]].toLowerCase() : NTH[m[2]]} quarter${m[3] ? ' · ' + m[3] : ''}`;
    if ((m = d.match(/^(End )?([12])H(?: (.+))?$/))) return `${m[1] ? 'End of the ' + NTH[m[2]].toLowerCase() : NTH[m[2]]} half${m[3] ? ' · ' + m[3] : ''}`;
    if ((m = d.match(/^(End )?OT(\d*)(?: (.+))?$/))) return `${m[1] ? 'End of overtime' : 'Overtime'}${m[2] ? ' ' + m[2] : ''}${m[3] ? ' · ' + m[3] : ''}`;
    return d; };
  const shortStanding = s => String(s || '').replace(' in the ', ' in ');
  const dayWord = g => { const w = relDay(ymd(g)); return w === 'Tonight' ? 'Today' : w; };
  const pctOf = ph => Math.round(Math.max(ph, 1 - ph) * 100);
  const projOf = (L, g, ctx) => { if (!V.prefs.get('forecast') || !ctx) return null; const f = U.safeF(L, g, ctx); return f && f.pHome != null && isFinite(f.pHome) ? f.pHome : null; };

  /* ---------- the stage: what matters most right now, one slide each ---------- */
  const topTeam = () => { const t = store.get('v5:topteam', null); if (t && t.lk && t.id) return `${t.lk}:${t.id}`; const F = favs.all(); for (const lk of ORDER) if ((F[lk] || []).length) return `${lk}:${F[lk][0]}`; return ''; };
  function slidesOf(outs, subs) {
    const out = [], top = topTeam();
    const isTop = (lk, g) => top === `${lk}:${g.home.id}` || top === `${lk}:${g.away.id}`;
    outs.forEach(o => (S.today[o.lk] || []).filter(g => isLive(g) && !g.off && isFav(g) && g.home.score != null).forEach(g => out.push({ t: 'live', k: `live:${o.lk}:${g.id}`, g, L: o.L, o, top: isTop(o.lk, g) })));
    out.sort((a, b) => (b.top - a.top) || (Math.abs(+a.g.home.score - +a.g.away.score) - Math.abs(+b.g.home.score - +b.g.away.score)) || (new Date(a.g.date) - new Date(b.g.date)));
    subs.filter(x => x.kind === 'team' && x.un).forEach(x => { const fin = [...x.its].reverse().find(i => i.kind === 'final' && i.g && isDone(i.g)); if (fin && out.length < 3) out.push({ t: 'recap', k: `recap:${x.key}:${fin.g.id}`, x, g: fin.g, L: fin.L, clips: x.its.filter(i => i.kind === 'vid').length }); });
    const leagues = subs.filter(x => x.kind === 'league'); const plays = [];
    for (let i = 0; i < 3; i++) leagues.forEach(x => { if (x.its[i]) plays.push({ t: 'play', k: `play:${x.its[i].id}`, x, it: x.its[i] }); });
    plays.slice(0, Math.max(1, 5 - out.length)).forEach(p => out.push(p));
    return out.slice(0, 5);
  }
  const shade = '<span class="shd27"></span>';
  const duel = (L, g, live) => { const [ca, ch] = U.pairColors(L, g.away, g.home); const a = tone(ca), h = tone(ch);
    const lo = (x, y) => x.score != null && y.score != null && +x.score < +y.score ? ' lo27' : '';
    return { bg: `background:linear-gradient(100deg,${U.mixTo(a, 0, .45)} 0%,${a} 40%,${h} 60%,${U.mixTo(h, 0, .45)} 100%)`,
      blobs: live && MOTION() ? `<i class="bl27 b127" style="background:${esc(U.V_vivid(ca, true))}"></i><i class="bl27 b227" style="background:${a}"></i><i class="bl27 b327" style="background:${esc(U.V_vivid(ch, true))}"></i><i class="bl27 b427" style="background:${h}"></i>` : '',
      row: `<span class="lvr"><span class="lvx">${disc(g.away, 50)}<span class="lvs n"><span data-lv="as" class="${lo(g.away, g.home).trim()}">${esc(String(g.away.score ?? ''))}</span><span data-lv="hs" class="${lo(g.home, g.away).trim()}">${esc(String(g.home.score ?? ''))}</span></span>${disc(g.home, 50)}</span><span class="lvn"><b>${esc(g.away.short)}</b><b>${esc(g.home.short)}</b></span></span>` }; };
  const projBar = (g, ph) => { if (ph == null) return ''; const home = ph >= .5; const fav = home ? g.home : g.away;
    return `<span class="lvp"><span class="lvbar${home ? '' : ' aw27'}"><i data-lv="bar" style="width:${pctOf(ph)}%"></i></span><span class="lvl"><span>RIVL projection</span><b class="n" data-lv="pl">${esc(fav.short)} ${pctOf(ph)}%</b></span></span>`; };
  function slideHtml(s, likes, saved) {
    if (s.t === 'live') { const d = duel(s.L, s.g, true); const ph = projOf(s.L, s.g, s.o.ctx);
      return `<a class="sl27 lv27" href="${U.href.game(s.L.key, s.g.id)}" data-k="${esc(s.k)}" data-g27s="${s.L.key}:${esc(s.g.id)}" style="${d.bg}" aria-label="${esc(s.g.away.short)} at ${esc(s.g.home.short)}, live">${d.blobs}${shade}<span class="slb27"><span class="lvc"><i></i><span class="n" data-lv="clock">${esc(clockLong(s.g))}</span></span>${d.row}${projBar(s.g, ph)}</span></a>`; }
    if (s.t === 'recap') { const g = s.g, d = duel(s.L, g, false); const home = String(g.home.id) === String(s.x.id); const us = home ? g.home : g.away, them = home ? g.away : g.home; const won = +us.score > +them.score;
      return `<div class="sl27 rc27" data-k="${esc(s.k)}" style="${d.bg}">${shade}<div class="slb27"><span class="kk27">${esc(finalWord(g))} · ${esc(dayWord(g))}</span>${d.row}<h2 class="sm27">${esc(us.short)} ${won ? 'beat' : 'lost to'} ${/^(nba|wnba)$/.test(s.L.key) ? 'the ' : ''}${esc(them.short)}</h2><div class="ac27"><button class="wb27" data-s27="story" data-key="${esc(s.x.key)}">${I.play}Watch recap</button>${s.clips ? `<span class="cn27 n">${s.clips} clip${s.clips === 1 ? '' : 's'}</span>` : ''}</div></div></div>`; }
    if (s.t === 'play') { const it = s.it; const chips = [...String(it.tag || '').split(' · '), it.wc || ''].map(x => x.trim()).filter(Boolean);
      const lk = likes.includes(it.id), sv = saved.some(x => x.id === it.id);
      return `<div class="sl27 pl27" data-k="${esc(s.k)}">${it.thumb ? `<img class="bg27" src="${esc(it.thumb)}" alt="" onerror="this.remove()">` : ''}${shade}<div class="slb27"><span class="kk27">${it.rank === 1 ? 'Top play' : `No. ${it.rank} play`} · ${esc((it.L && it.L.short) || '')}</span><h2>${esc(it.title)}</h2>${chips.length ? `<div class="chips27 n">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}<div class="ac27"><button class="wb27" data-s27="clip" data-key="${esc(s.x.key)}" data-id="${esc(it.id)}">${I.play}Watch</button><button class="ib27${lk ? ' on' : ''}" data-s27="like" data-key="${esc(s.x.key)}" data-id="${esc(it.id)}" aria-label="Like" aria-pressed="${lk}">${I.like}</button><button class="ib27${sv ? ' on' : ''}" data-s27="save" data-key="${esc(s.x.key)}" data-id="${esc(it.id)}" aria-label="Save" aria-pressed="${sv}">${I.save}</button></div></div></div>`; }
    return `<div class="sl27 pn27" data-k="${esc(s.k)}">${shade}<div class="slb27"><span class="kk27">${esc(s.kk)}</span><h2>${esc(s.title)}</h2><div class="ac27"><a class="wb27" href="${s.to}">${esc(s.cta)}</a></div></div></div>`;
  }
  function stageHtml(slides, hasStories) {
    const likes = X.stLikes(), saved = X.stSaved();
    return `<div class="trk27">${slides.map(s => slideHtml(s, likes, saved)).join('')}</div>
<div class="top27"><div class="hi27"><div><small>${esc(dateLine())}</small><b>${esc(greet())}</b></div></div>
<div class="sr27">${I.mark}<a class="sf27" href="#search" role="search" aria-label="Search">${I.search}<span>Search teams, players, anything</span></a></div>
${slides.length > 1 ? `<div class="pg27" aria-hidden="true">${slides.map(() => '<span><i></i></span>').join('')}</div>` : ''}</div>`;
  }
  /* the stage turns on its own every seven seconds, stops under a finger, and waits while a story is open or it is off screen */
  let stageT = 0;
  function stageInit(sec, keepKey) {
    clearTimeout(stageT); const trk = sec.querySelector('.trk27'); if (!trk) return; const n = trk.children.length; const bars = [...sec.querySelectorAll('.pg27 span')];
    let i = Math.max(0, [...trk.children].findIndex(x => x.dataset.k === keepKey)), held = false;
    const mark = () => { bars.forEach((b, j) => { b.className = j < i ? 'done' : j === i ? 'on' : ''; if (j === i) { const f = b.firstChild; f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; } }); sec.dataset.cur = trk.children[i] ? trk.children[i].dataset.k : ''; };
    const arm = () => { clearTimeout(stageT); if (n < 2 || !MOTION()) return; stageT = setTimeout(() => { if (!document.body.contains(trk)) return; if (held || document.hidden || document.querySelector('.story') || window.scrollY > 380) { arm(); return; } const to = (i + 1) % n; trk.scrollTo({ left: to * trk.clientWidth, behavior: to ? 'smooth' : 'auto' }); }, 7000); };
    if (i) trk.scrollLeft = i * trk.clientWidth;
    let raf = 0; trk.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const j = Math.max(0, Math.min(n - 1, Math.round(trk.scrollLeft / Math.max(1, trk.clientWidth)))); if (j !== i) { i = j; mark(); arm(); } }); }, { passive: true });
    trk.addEventListener('touchstart', () => { held = true; }, { passive: true }); ['touchend', 'touchcancel'].forEach(ev => trk.addEventListener(ev, () => { held = false; arm(); }, { passive: true }));
    mark(); arm();
  }

  /* ---------- the sections under the stage ---------- */
  const head = (t, link, to, attr = '') => `<div class="sh27"><h2>${esc(t)}</h2>${link ? `<a href="${to}"${attr}>${link}</a>` : ''}</div>`;
  function storiesHtml(subs) {
    if (!subs.length) return '';
    return `<div class="rl27 st27">${subs.map(x => { const inner = x.kind === 'player' ? face(x.hs, x.full || x.name, 44) : x.kind === 'team' ? disc({ logo: x.logo, abbr: x.abbr }, 44) : `<em>${x.kind === 'feed' ? I.play : x.kind === 'saved' ? I.save : esc(x.abbr || '')}</em>`;
      return `<button class="sc27${x.un ? '' : ' seen'}" data-act="story" data-key="${esc(x.key)}" aria-label="${esc(x.full || x.name)} story"><span style="background:${grad(x.kind === 'league' || x.kind === 'feed' || x.kind === 'saved' ? '#3a3f4b' : x.color, 170)}">${inner}<small>${esc(x.kind === 'player' ? String(x.full || x.name).split(' ')[0] : x.name)}</small></span></button>`; }).join('')}</div>`;
  }
  const chipInner = g => g.state === 'in' ? `<i></i>${esc(g.away.abbr)} ${esc(String(g.away.score ?? ''))} · ${esc(String(g.home.score ?? ''))} ${esc(g.home.abbr)}<small>${esc(g.detail || 'Live')}</small>`
    : isDone(g) ? `${esc(g.away.abbr)} ${esc(String(g.away.score))} · ${esc(String(g.home.score))} ${esc(g.home.abbr)}<small>${esc(finalWord(g))}</small>`
    : `${esc(g.away.abbr)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.abbr)}<small>${esc(noTz(tipOf(g)))}</small>`;
  function todays() {
    const t = todayCT(); const rank = g => (isLive(g) ? 0 : g.state === 'pre' ? 2 : 4) + (isFav(g) ? 0 : 1);
    return ORDER.flatMap(lk => (S.today[lk] || []).filter(g => !g.off && !g.tbd && (isLive(g) || ymd(g) === t))).sort((a, b) => (rank(a) - rank(b)) || (new Date(a.date) - new Date(b.date)));
  }
  function tonightHtml() {
    const gs = todays().slice(0, 14); if (!gs.length) return '';
    const chip = (g, dup) => `<a class="tk27" href="${U.href.game(g.lk, g.id)}" data-g27="${g.lk}:${esc(g.id)}"${dup ? ' aria-hidden="true" tabindex="-1"' : ''}>${chipInner(g)}</a>`;
    const move = gs.length > 2 && MOTION();
    return head(new Date().getHours() < 16 ? 'Today' : 'Tonight', 'All scores', '#scores') + `<div class="tkw27${move ? ' mv27' : ''}"><div class="tkt27 n" style="--d:${gs.length * 7}s">${gs.map(g => chip(g, false)).join('')}${move ? gs.map(g => chip(g, true)).join('') : ''}</div></div>`;
  }
  /* Your players and Your teams are one kind of card: the photo or the logo is the card, the team's colour is the
     ground, the team's mark sits faint behind it, and the name and one line sit at the foot. */
  const cardVars = c => { const b = tone(c); return `--c:${b};--c1:${U.mixTo(b, 255, .2)};--c2:${U.mixTo(b, 0, .5)}`; };
  const mark27 = src => src ? `<span class="wm27">${U.imgSized(src, 300, 300, '', 'this.parentNode.remove()')}</span>` : '';
  function playersHtml(outs) {
    const all = V.fplayers.all(); if (!all.length) return '';
    const lines = new Map(); outs.forEach(o => (o.lines || []).forEach(x => lines.set(`${o.lk}:${x.p.id}`, x)));
    const cards = all.slice(0, 16).map(p => { const L = LEAGUES[p.lk]; if (!L) return null; const o = outs.find(z => z.lk === p.lk); const x = lines.get(`${p.lk}:${p.id}`);
      const tm = (x && x.us) || (o && o.tIdx && p.teamId && o.tIdx[String(p.teamId)]) || null; const color = tm ? U.teamColor(tm, L) : U.playerColor(p, L);
      const nm0 = p.short || p.name || ''; const nm = nm0.length > 17 ? V.lastName(p.name || nm0) : nm0;
      const line = x && !x.dnp ? `${x.pts} pts · ${x.reb} reb · ${x.ast} ast` : x ? x.dnp : (tm && (tm.short || tm.name)) || p.team || L.short;
      return { has: x && !x.dnp ? 0 : 1, html: `<a class="pc27" href="${x ? `${U.href.game(p.lk, x.g.id)}/p/${esc(String(p.id))}` : U.href.player(p.lk, p.id)}" style="${cardVars(color)}" aria-label="${esc(p.name || nm)}, ${esc(String(line))}">${mark27(tm && tm.logo)}${p.img ? `<span class="ph27">${U.imgSized(p.img, 600, 436, '', 'HW.v5.rv27.miss(this)')}</span>` : `<span class="ph27 no27">${I.me}</span>`}<span class="pt27"><b${nm.length > 14 ? ' class="lg27n"' : ''}>${esc(nm)}</b><small class="n">${esc(String(line))}</small></span></a>` }; }).filter(Boolean).sort((a, b) => a.has - b.has);
    return head('Your players', 'Edit', '#settings/following') + `<div class="rl27">${cards.map(c => c.html).join('')}</div>`;
  }
  function teamsHtml(outs) {
    const cards = outs.flatMap(o => (o.myTeams || []).map(t => { const live = (S.today[o.lk] || []).find(g => isLive(g) && (String(g.home.id) === t.id || String(g.away.id) === t.id));
      const vs = g => { const home = String(g.home.id) === t.id; return `${home ? 'vs' : 'at'} ${(home ? g.away : g.home).abbr}`; };
      let nxt = '', rank = 2;
      if (live) { const home = String(live.home.id) === t.id; const us = home ? live.home : live.away, th = home ? live.away : live.home; nxt = `<em><i></i>Live · ${esc(String(us.score ?? ''))}-${esc(String(th.score ?? ''))}</em>`; rank = 0; }
      else if (t.nx) { nxt = `<em>${esc(noTz(tipOf(t.nx)))} ${esc(vs(t.nx))}</em>`; rank = 1; }
      else if (t.next && t.next.state !== 'post') nxt = `<em>${esc(relDay(ymd(t.next)))} ${esc(vs(t.next))}</em>`;
      const line = [t.rec, t.rank ? `No. ${t.rank}` : shortStanding(t.standing)].filter(Boolean).join(' · ');
      return { rank, at: t.nx ? new Date(t.nx.date).getTime() : 0, html: `<a class="tc27" href="${U.href.team(o.lk, t.id)}" style="${cardVars(t.color)}">${mark27(t.logo)}<span class="lg27">${t.logo ? U.imgSized(t.logo, 200, 200, '', "this.outerHTML='<b>" + esc(String(t.abbr || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4)) + "</b>'") : `<b>${esc(String(t.abbr || '').slice(0, 4))}</b>`}</span><span class="pt27"><b>${esc(t.short || t.name)}</b>${line ? `<small>${esc(line)}</small>` : ''}${nxt}</span></a>` }; }));
    if (!cards.length) return '';
    cards.forEach((c, i) => { c.i = i; }); cards.sort((a, b) => (a.rank - b.rank) || (a.at - b.at) || (a.i - b.i));   // playing now, then tonight by tip, then the order you keep them in
    return head('Your teams', 'Edit', '#settings/following') + `<div class="rl27">${cards.map(c => c.html).join('')}</div>`;
  }
  function catchHtml(outs, subs) {
    const fin = outs.flatMap(o => (o.lastF || []).filter(isDone).map(g => ({ g, o }))).sort((a, b) => new Date(b.g.date) - new Date(a.g.date)); if (!fin.length) return '';
    const { g, o } = fin[0]; const L = o.L; const [ca, ch] = U.pairColors(L, g.away, g.home); const a = tone(ca), h = tone(ch);
    const hw = +g.home.score > +g.away.score; const win = hw ? g.home : g.away; const margin = Math.abs(+g.home.score - +g.away.score);
    const sub = subs.find(x => x.kind === 'team' && favs.has(o.lk, x.id) && (String(g.home.id) === String(x.id) || String(g.away.id) === String(x.id))); const clips = sub ? sub.its.filter(i => i.kind === 'vid').length : 0;
    const open = sub ? `button class="res27" data-s27="story" data-key="${esc(sub.key)}"` : `a class="res27" href="${U.href.game(o.lk, g.id)}"`;
    const card = `<${open} style="background:linear-gradient(100deg,${a} 0%,${U.mixTo(a, 0, .3)} 46%,${U.mixTo(h, 0, .3)} 54%,${h} 100%)"><span class="rt27"><span>${disc(g.away, 38)}<b class="n${hw ? ' lo27' : ''}">${esc(String(g.away.score))}</b></span><em>${esc(finalWord(g))}</em><span class="r27"><b class="n${hw ? '' : ' lo27'}">${esc(String(g.home.score))}</b>${disc(g.home, 38)}</span></span><span class="rf27"><span>${esc(win.short)} by ${margin}</span>${clips ? `<span>${I.play}Recap, ${clips} clip${clips === 1 ? '' : 's'}</span>` : '<span>Box score</span>'}</span></${sub ? 'button' : 'a'}>`;
    const rows = fin.slice(1, 5).map(({ g, o }) => resultRow(g, o.L)).join('');
    return head('Catch up', 'All results', '#scores') + card + (rows ? `<div class="rw27">${rows}</div>` : '');
  }
  const resultRow = (g, L) => { const hw = +g.home.score > +g.away.score; const w = hw ? g.home : g.away, l = hw ? g.away : g.home;
    return `<a class="rr27" href="${U.href.game(L.key, g.id)}">${disc(w, 28)}<span><b>${esc(w.short)} ${esc(String(w.score))}</b>, ${esc(l.short)} ${esc(String(l.score))}</span><small>${esc(finalWord(g))}</small></a>`; };
  function watchHtml(subs) {
    const feed = subs.find(x => x.key === 'all:feed') || subs.find(x => x.kind === 'league'); if (!feed) return '';
    const its = feed.its.filter(i => i.kind === 'vid').slice(0, 8); if (its.length < 2) return '';
    return head('Keep watching', 'Watch', '#home', ' data-s27="watch"') + `<div class="rl27">${its.map(it => `<button class="cl27" data-s27="clip" data-key="${esc(feed.key)}" data-id="${esc(it.id)}">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy" onerror="this.remove()">` : ''}${it.sub || it.rank ? `<i class="n">${esc(it.rank ? `No. ${it.rank}` : it.sub)}</i>` : ''}<b>${esc(it.title)}</b></button>`).join('')}</div>`;
  }

  /* Tonight's picks. A pick is made before the tip and cannot be changed after it. RIVL's side is the app's own
     projection at the moment of the pick, shown only once a side is chosen. Results are settled from final scores. */
  const PK = 'v5:mypicks';
  const picks = () => store.get(PK, {}) || {};
  function settle(outs) {
    const P = picks(); let ch = false;
    Object.values(P).forEach(p => { if (p.res) return; const g = gameOf(`${p.lk}:${p.id}`) || outs.flatMap(o => o.lk === p.lk ? (o.doneAll || []) : []).find(x => x.id === p.id); if (!g) return;
      if (g.off) { p.res = 'x'; ch = true; return; }
      if (!isDone(g) || +g.home.score === +g.away.score) return;
      const hw = +g.home.score > +g.away.score; p.res = (p.side === 'home') === hw ? 'w' : 'l'; p.rv = p.ph == null ? null : ((p.ph >= .5) === hw ? 'w' : 'l'); p.fs = [+g.away.score, +g.home.score]; ch = true; });
    const ks = Object.keys(P); if (ks.length > 400) { ks.sort((a, b) => (P[a].t || 0) - (P[b].t || 0)).slice(0, ks.length - 400).forEach(k => delete P[k]); ch = true; }
    if (ch) store.set(PK, P); return P;
  }
  function picksHtml(outs, P) {
    const t = todayCT(); const ctxOf = lk => { const o = outs.find(x => x.lk === lk); return o ? o.ctx : null; };
    const gs = todays().filter(g => (g.state === 'pre' && ymd(g) === t) || P[`${g.lk}:${g.id}`]);
    const list = [...gs.filter(isFav), ...gs.filter(g => !isFav(g))]; const show = list.filter((g, i) => i < 3 || P[`${g.lk}:${g.id}`]).slice(0, 6); if (!show.length) return '';
    let w = 0, l = 0, rw = 0, rl = 0; Object.values(P).forEach(p => { if (p.res === 'w') w++; else if (p.res === 'l') l++; if (p.rv === 'w') rw++; else if (p.rv === 'l') rl++; });
    const rec = w + l ? `<span>You ${w}-${l}${rw + rl ? ` · RIVL ${rw}-${rl}` : ''}</span>` : '';
    const card = g => { const L = LEAGUES[g.lk], k = `${g.lk}:${g.id}`, p = P[k], open = g.state === 'pre';
      const btn = (side, tm) => `<button data-pick27="${esc(k)}:${side}" class="${p ? (p.side === side ? 'on' : 'dim') : ''}"${open ? '' : ' disabled'} style="background:${grad(U.teamColor(tm, L))}" aria-pressed="${!!(p && p.side === side)}">${disc(tm, 34)}<span>${esc(tm.short)}</span>${p && p.side === side ? I.check : ''}</button>`;
      const when = open ? noTz(tipOf(g)) : isDone(g) ? `${finalWord(g)} · ${g.away.score}-${g.home.score}` : `${g.detail || 'Live'} · ${g.away.score ?? ''}-${g.home.score ?? ''}`;
      let foot = '<span>Pick a side to see RIVL\u2019s projection</span>';
      if (p) { const mine = p.side === 'home' ? g.home : g.away; const rf = p.ph == null ? null : (p.ph >= .5 ? g.home : g.away);
        const end = p.res === 'w' ? ' · Right' : p.res === 'l' ? ' · Wrong' : '';
        foot = `<span>Your pick: ${esc(mine.short)}${end}</span>${rf ? `<span>RIVL projection: <b class="n">${esc(rf.short)} ${pctOf(p.ph)}%</b></span>` : ''}`; }
      else if (!V.prefs.get('forecast') || !ctxOf(g.lk)) foot = '<span>Pick a side before the tip</span>';
      return `<div class="pk27"><span class="ph27"><b>${esc(g.away.short)} ${g.neutral ? 'vs' : 'at'} ${esc(g.home.short)}</b><span>${esc(when)}</span></span><div class="op27">${btn('away', g.away)}${btn('home', g.home)}</div><span class="pf27">${foot}</span></div>`; };
    return `<div class="sh27"><h2>${new Date().getHours() < 16 ? 'Today\u2019s picks' : 'Tonight\u2019s picks'}</h2>${rec}</div>` + show.map(card).join('');
  }
  function pick(key, side, outs) {
    const g = gameOf(key); if (!g) return false;
    if (g.state !== 'pre') { V.toast('Picks lock at the tip.'); return false; }
    const P = picks(); const o = outs.find(x => x.lk === g.lk); const tm = side === 'home' ? g.home : g.away;
    P[key] = { lk: g.lk, id: g.id, side, tid: String(tm.id), tn: tm.short, on: (side === 'home' ? g.away : g.home).short, ha: side === 'home' ? 'vs' : 'at', ph: o ? projOf(LEAGUES[g.lk], g, o.ctx) : null, date: g.date, t: Date.now() };
    store.set(PK, P); return true;
  }
  /* Around the league: results and streaks, read straight from the scoreboard and the standings */
  function leagueHtml(outs) {
    const rows = [];
    outs.forEach(o => (o.lastL || []).slice(0, o.follows ? 2 : 1).forEach(g => { if (isDone(g)) rows.push(resultRow(g, o.L)); }));
    outs.forEach(o => { const by = o.st && o.st.byId; if (!by) return; const best = Object.values(by).map(r => ({ r, m: /^([WL])(\d+)$/.exec(r.strk || '') })).filter(x => x.m && ((x.m[1] === 'W' && +x.m[2] >= 5) || (x.m[1] === 'L' && +x.m[2] >= 7))).sort((a, b) => +b.m[2] - +a.m[2])[0];
      if (best) rows.push(`<a class="rr27" href="${U.href.team(o.lk, best.r.id)}">${disc(best.r, 28)}<span><b>${esc(best.r.short || best.r.name)}</b> have ${best.m[1] === 'W' ? 'won' : 'lost'} ${best.m[2]} in a row</span><small class="n">${esc(best.r.strk)}</small></a>`); });
    if (!rows.length) return '';
    return head('Around the league', 'Standings', '#standings') + `<div class="rw27">${rows.slice(0, 6).join('')}</div>`;
  }
  const endHtml = (subs, any) => any ? `<div class="end27"><svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="currentColor" stroke-width="3.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="27" opacity=".35"/><path d="M20 33.500l8.500 8.500L45 24.500"/></svg><b>You\u2019re caught up</b>${subs.some(x => x.key === 'all:feed' || x.kind === 'league') ? `<button class="kw27" data-s27="watch">${I.play}Keep watching</button>` : ''}</div>` : '';
  const startHtml = () => `<div class="mk27s"><b>Make it yours</b><p>Follow a few teams and players and Home fills with their games, plays and results.</p><div><a class="kw27" href="#teams">Choose teams</a><a class="kw27 gh27" href="#players">Find players</a></div></div>`;

  /* ---------- Home ---------- */
  const ORD = ['stage', 'stories', 'tonight', 'start', 'players', 'teams', 'catch', 'watch', 'picks', 'league', 'end'];
  let token = 0, cur = null;
  async function home27() {
    const my = ++token; const alive = () => my === token && root.dataset.page === 'home' && on();
    const srcs = ORDER.map(X.feedSource); let painted = false, subs = [], outs = [];
    const paint = () => {
      if (!alive()) return;
      outs = srcs.map(s => s.out).filter(Boolean);
      if (!outs.length) { if (!painted && !srcs.every(s => s.failed)) { $main.innerHTML = '<!--skel--><div class="h27" data-noswipe><div class="stg27 sk27"></div></div>'; return; } }
      subs = outs.length ? X.storySubjects() : [];
      const follows = ORDER.some(lk => (favs.all()[lk] || []).length) || V.fplayers.all().length > 0;
      const P = settle(outs); let slides = slidesOf(outs, subs);
      if (!slides.length) { const nx = outs.flatMap(o => (o.myTeams || []).map(t => t.nx || (t.next && t.next.state === 'pre' ? t.next : null)).filter(Boolean)).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        slides = [!follows ? { t: 'plain', k: 'plain:start', kk: 'Welcome to RIVL', title: 'Follow your teams and this becomes their front page', cta: 'Choose teams', to: '#teams' }
          : nx ? { t: 'plain', k: `plain:${nx.id}`, kk: 'Next up', title: `${nx.away.short} ${nx.neutral ? 'vs' : 'at'} ${nx.home.short}, ${relDay(ymd(nx)).toLowerCase()} at ${noTz(tipOf(nx))}`, cta: 'See the game', to: U.href.game(nx.lk, nx.id) }
          : { t: 'plain', k: 'plain:quiet', kk: 'Quiet right now', title: 'No games or new plays from your teams yet', cta: 'All scores', to: '#scores' }]; }
      const stories = storiesHtml(subs);
      const html = { stage: stageHtml(slides, !!stories), stories, tonight: tonightHtml(), start: follows ? '' : startHtml(), players: playersHtml(outs), teams: teamsHtml(outs), catch: catchHtml(outs, subs), watch: watchHtml(subs), picks: picksHtml(outs, P), league: leagueHtml(outs) };
      html.end = endHtml(subs, follows && ['players', 'teams', 'catch', 'watch', 'picks'].some(k => html[k]));
      /* the stage and the ticker are rebuilt only when what they hold changes; scores and clocks inside them are set in place */
      const key = { stage: slides.map(s => s.k).join('|') + '|' + greet() + '|' + (stories ? 1 : 0), tonight: html.tonight ? todays().slice(0, 14).map(g => g.lk + g.id).join(',') : '' };
      const hOf = k => key[k] != null ? hash(key[k]) : hash(html[k]);
      const cls = k => k === 'stage' ? `stg27${stories ? '' : ' nost'}` : `s27 s27-${k}`;
      const wrap = k => `<section class="${cls(k)}" data-s="${k}" data-h="${hOf(k)}">${html[k]}</section>`;
      let h = $main.querySelector('.h27');
      if (!painted || !h || h.querySelector('.sk27')) { painted = true; $main.innerHTML = `<div class="h27" data-noswipe>${ORD.filter(k => html[k]).map(wrap).join('')}</div>`; h = $main.querySelector('.h27'); stageInit(h.querySelector('[data-s="stage"]'), ''); }
      else ORD.forEach((k, n) => { const el = h.querySelector(`:scope > [data-s="${k}"]`);
        if (!html[k]) { if (el) el.remove(); return; }
        if (el && el.dataset.h === hOf(k)) { if (k === 'stage') el.className = cls(k); return; }
        const keep = k === 'stage' && el ? el.dataset.cur : ''; const t = document.createElement('template'); t.innerHTML = wrap(k); const neu = t.content.firstElementChild;
        if (el) el.replaceWith(neu); else { const after = ORD.slice(n + 1).map(x => h.querySelector(`:scope > [data-s="${x}"]`)).find(Boolean); h.insertBefore(neu, after || null); }
        if (k === 'stage') stageInit(neu, keep); });
      liveSync();
      /* the clips that can be opened straight from Home have their levels read ahead, so a tap starts sharp */
      X.warm([...slides.filter(s => s.t === 'play').map(s => s.it), ...subs.filter(x => x.key === 'all:feed' || x.kind === 'league').flatMap(x => x.its.slice(0, 8))]);
    };
    let raf = 0; const sched = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
    cur = { alive, paint: sched, outs: () => outs, subs: () => subs };
    srcs.forEach(s => s.subs.add(sched)); X.onData(sched);
    const unsub = () => srcs.forEach(s => s.subs.delete(sched));
    V.refresh = async () => { if (!alive()) { unsub(); return; } await Promise.all(srcs.map(s => s.refresh ? s.refresh().catch(() => { }) : null)); };
    V.refresh.every = 90000;
    paint();
    await Promise.race([Promise.all(srcs.map(s => s.ready)), new Promise(r => setTimeout(r, 6000))]);
    if (alive() && !painted) { painted = true; paint(); }
  }
  /* live scores, clocks and the projection bar, set into what is already on screen */
  function liveSync() {
    const h = $main.querySelector('.h27'); if (!h || !cur) return; const outs = cur.outs();
    h.querySelectorAll('[data-g27s]').forEach(el => { const g = gameOf(el.dataset.g27s); if (!g) return; const set = (k, v) => { const x = el.querySelector(`[data-lv="${k}"]`); if (x && x.textContent !== v) x.textContent = v; return x; };
      set('clock', clockLong(g)); const a = set('as', String(g.away.score ?? '')), b = set('hs', String(g.home.score ?? '')); const d = (+g.home.score || 0) - (+g.away.score || 0);
      if (a) a.classList.toggle('lo27', d > 0); if (b) b.classList.toggle('lo27', d < 0);
      const o = outs.find(x => x.lk === g.lk); const ph = o ? projOf(LEAGUES[g.lk], g, o.ctx) : null; const bar = el.querySelector('[data-lv="bar"]');
      if (bar && ph != null) { bar.style.width = `${pctOf(ph)}%`; bar.parentNode.classList.toggle('aw27', ph < .5); set('pl', `${(ph >= .5 ? g.home : g.away).short} ${pctOf(ph)}%`); } });
    { const lk = X.stLikes(), sv = X.stSaved(); h.querySelectorAll('.stg27 [data-s27="like"],.stg27 [data-s27="save"]').forEach(b => { const is = b.dataset.s27 === 'like' ? lk.includes(b.dataset.id) : sv.some(x => x.id === b.dataset.id); b.classList.toggle('on', is); b.setAttribute('aria-pressed', String(is)); }); }
    h.querySelectorAll('.tk27[data-g27]').forEach(el => { const g = gameOf(el.dataset.g27); if (!g) return; const v = chipInner(g), k = hash(v); if (el.dataset.h !== k) { el.dataset.h = k; el.innerHTML = v; } el.classList.toggle('lv27', isLive(g)); });
  }
  document.addEventListener('rivl:polled', () => { if (cur && cur.alive()) { liveSync(); cur.paint(); } });
  $main.addEventListener('click', e => {
    const p = e.target.closest('[data-pick27]');
    if (p && cur && cur.alive()) { e.preventDefault(); const k = p.dataset.pick27; const i = k.lastIndexOf(':'); if (pick(k.slice(0, i), k.slice(i + 1), cur.outs())) cur.paint(); return; }
    const b = e.target.closest('[data-s27]'); if (!b || !b.closest('.h27')) return; const a = b.dataset.s27;
    if (a === 'watch') { e.preventDefault(); watch(); return; }
    if (a === 'story') { e.preventDefault(); V.storyOpen(b.dataset.key); return; }
    if (a === 'clip') { e.preventDefault(); watch(b.dataset.id, b.dataset.key); return; }
    if ((a === 'like' || a === 'save') && cur) { e.preventDefault(); const sub = cur.subs().find(x => x.key === b.dataset.key); const it = sub && sub.its.find(x => x.id === b.dataset.id); if (!it) return;
      const now = a === 'like' ? X.stLike(it) : X.stSave(it); b.classList.toggle('on', now); b.setAttribute('aria-pressed', String(now));
      if (a === 'save') V.toast(now ? 'Saved' : 'Removed from Saved'); }
  });

  /* the preview takes Home over only while it is switched on */
  const home0 = V.home; V.home = (...a) => on() ? home27() : home0(...a);
  paintBar();
})();
