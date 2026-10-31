// One-time look at what Prep Hoops publishes in a machine-readable form (personal use, with permission).
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
const UA = 'RIVL personal app (non-commercial, used with Prep Hoops permission)';
const out = {};
for (const [k, url] of Object.entries({
  wpSearch: 'https://prephoops.com/wp-json/wp/v2/posts?per_page=5&search=2027%20rankings&_fields=id,date,link,title,excerpt,content,categories,tags',
  wpCats: 'https://prephoops.com/wp-json/wp/v2/categories?per_page=50&_fields=id,name,slug,count',
  rankingsPage: 'https://prephoops.com/rankings/',
  girls: 'https://prepgirlshoops.com/wp-json/wp/v2/posts?per_page=3&search=2027%20rankings&_fields=id,date,link,title,content'
})) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    const t = await r.text();
    out[k] = { status: r.status, type: r.headers.get('content-type'), cors: r.headers.get('access-control-allow-origin'), len: t.length,
      sample: t.slice(0, 3000) };
    if (k === 'wpSearch' && t.startsWith('[')) { const j = JSON.parse(t); out[k].posts = j.map(p => ({ date: p.date, link: p.link, title: p.title?.rendered, contentLen: (p.content?.rendered || '').length, protected: p.content?.protected, contentText: (p.content?.rendered || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500) })); delete out[k].sample; }
  } catch (e) { out[k] = { error: String(e) }; }
}
writeFileSync('data/prephoops-probe.json', JSON.stringify(out, null, 1));
