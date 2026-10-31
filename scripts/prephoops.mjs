// Prep Hoops coverage for RIVL's top recruits (personal use, with Prep Hoops' permission).
// For each top recruit, finds Prep Hoops / Prep Girls Hoops articles that name them and keeps
// the title, date, link and the free opening text. Subscriber-only evaluations are left alone.
import { readFileSync, writeFileSync } from 'node:fs';
const UA = 'RIVL personal app (non-commercial, used with Prep Hoops permission)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&#8217;|&#039;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#8211;|&#8212;/g, '-').replace(/\s+/g, ' ').trim();
const R = JSON.parse(readFileSync('data/recruits.json', 'utf8'));
const SITE = { boys: 'https://prephoops.com', girls: 'https://prepgirlshoops.com' };
let n = 0;
for (const g of ['boys', 'girls']) for (const y of Object.keys(R[g] || {})) {
  for (const r of R[g][y].slice(0, 30)) {
    try {
      const url = SITE[g] + '/wp-json/wp/v2/posts?per_page=4&_fields=date,link,title,content&search=' + encodeURIComponent('"' + r.n + '"');
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) continue;
      const posts = await res.json();
      const last = r.n.split(' ').slice(-1)[0].replace(/\./g, '');
      r.ph = posts.filter(p => clean(p.content?.rendered).includes(r.n) || clean(p.title?.rendered).includes(last)).slice(0, 3).map(p => {
        const text = clean(p.content?.rendered);
        const at = Math.max(0, text.indexOf(r.n));
        let snip = text.slice(at, at + 420);
        snip = snip.split('This evaluation is available to subscribers')[0].trim();
        return { t: clean(p.title?.rendered), d: p.date, u: p.link, s: snip };
      });
      // club (grassroots) team, when an article's player block lists it
      for (const p of posts) { const m = clean(p.content?.rendered).match(new RegExp(r.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^]{0,220}?Club: ([^:]+?) (?:This|Instagram|Twitter|State:|$)')); if (m) { r.club = m[1].trim(); break; } }
      if (!r.ph.length) delete r.ph; else n++;
    } catch (e) {}
    await sleep(800);
  }
}
R.phUpdated = new Date().toISOString();
writeFileSync('data/recruits.json', JSON.stringify(R));
console.log('recruits with Prep Hoops coverage:', n);
