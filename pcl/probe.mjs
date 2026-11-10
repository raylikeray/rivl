// Probe 9: the eight club logos, for mock-ups.
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('pcl/logos', { recursive: true });
for (const s of ['breeze', 'hive', 'laces', 'lunar-owls', 'mist', 'phantom', 'rose', 'vinyl']) {
  try { const r = await fetch(`https://pub-ad8cc693759b4b55a181a76af041efa0.r2.dev/teams/${s}/images/logo/primary.png?v=1`); const b = Buffer.from(await r.arrayBuffer()); if (r.ok) writeFileSync(`pcl/logos/${s}.png`, b); console.log(s, r.status, b.length); } catch (e) { console.log(s, String(e)); }
}
