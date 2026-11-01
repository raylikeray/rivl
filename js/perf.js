/* RIVL performance log. Everything stays on the phone (nothing is sent anywhere): every task that held the main thread
   for 50 ms or more, which job was running at the time, and every dropped frame while a finger is down or a slide is in
   flight. Opened by holding the title on the Settings screen; Copy puts the log on the clipboard. */
(() => {
  const HW = window.HW; if (!HW) return;
  const store = HW.store, KEY = 'v5:perf', CAP = 500;
  let log = store.get(KEY, null) || [];
  let saveT = 0; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => store.set(KEY, log), 800); };
  const push = e => { log.push(e); if (log.length > CAP) log.splice(0, log.length - CAP); save(); };
  /* jobs: named stretches of our own code, so a long task can say what it was */
  const recent = []; let depth = 0; const stack = [];
  const job = (name, fn) => {
    const t0 = performance.now(); stack.push(name); depth++;
    try { return fn(); }
    finally { depth--; stack.pop(); const t1 = performance.now(); recent.push([name, t0, t1]); if (recent.length > 80) recent.shift(); if (t1 - t0 >= 16 && !depth) push({ t: Math.round(t0), k: 'job', n: name, ms: Math.round(t1 - t0), g: gest || '', h: location.hash }); }
  };
  const span = name => { const t0 = performance.now(); return { end() { const t1 = performance.now(); recent.push([name, t0, t1]); if (recent.length > 80) recent.shift(); if (t1 - t0 >= 16) push({ t: Math.round(t0), k: 'job', n: name, ms: Math.round(t1 - t0), g: gest || '', h: location.hash }); } }; };
  const inside = (a, b) => [...new Set(recent.filter(r => r[1] < b && r[2] > a).map(r => r[0]))].join('+');
  /* long tasks, as the browser sees them */
  try { new PerformanceObserver(list => { for (const en of list.getEntries()) { const a = en.startTime, b = a + en.duration; push({ t: Math.round(a), k: 'long', ms: Math.round(en.duration), in: inside(a, b) || (stack[stack.length - 1] || '?'), g: gest || '', h: location.hash }); } }).observe({ type: 'longtask', buffered: true }); } catch { }
  /* frames, only while a gesture is on (a finger down, a slide settling, the page scrolling) */
  let gest = '', last = 0, raf = 0, quietT = 0;
  const tick = now => { if (last && now - last > 33) push({ t: Math.round(now), k: 'drop', ms: Math.round(now - last), g: gest, in: inside(last, now) || (stack[stack.length - 1] || ''), h: location.hash }); last = now; if (gest) raf = requestAnimationFrame(tick); else { raf = 0; last = 0; } };
  const on = g => { gest = g; clearTimeout(quietT); if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
  const off = ms => { clearTimeout(quietT); quietT = setTimeout(() => { gest = ''; }, ms); };
  document.addEventListener('touchstart', () => on('touch'), { passive: true, capture: true });
  document.addEventListener('touchend', () => off(700), { passive: true, capture: true });   // the settle after a release counts too
  document.addEventListener('touchcancel', () => off(700), { passive: true, capture: true });
  window.addEventListener('scroll', () => { if (!gest) on('scroll'); if (gest === 'scroll') off(250); }, { passive: true, capture: true });
  const busy = () => !!gest;
  /* the report */
  const text = () => {
    const by = (k, f) => { const m = {}; log.filter(e => e.k === k).forEach(e => { const key = f(e); m[key] = m[key] || { n: 0, ms: 0, max: 0 }; m[key].n++; m[key].ms += e.ms; m[key].max = Math.max(m[key].max, e.ms); }); return Object.entries(m).sort((a, b) => b[1].ms - a[1].ms); };
    const lines = [`RIVL perf · ${new Date().toLocaleString()} · ${log.length} entries · ${navigator.userAgent.slice(0, 80)}`, '', 'LONG TASKS (what was running)'];
    by('long', e => e.in || '?').forEach(([k, v]) => lines.push(`  ${String(v.n).padStart(3)}x  ${String(v.ms).padStart(5)}ms total  max ${v.max}ms  ${k}`));
    lines.push('', 'LONG TASKS during a gesture'); by('long', e => (e.g || 'idle') + ' · ' + (e.in || '?')).forEach(([k, v]) => lines.push(`  ${String(v.n).padStart(3)}x  ${String(v.ms).padStart(5)}ms  ${k}`));
    lines.push('', 'DROPPED FRAMES (gesture · what ran)'); by('drop', e => (e.g || '?') + ' · ' + (e.in || 'nothing of ours')).forEach(([k, v]) => lines.push(`  ${String(v.n).padStart(3)}x  worst ${v.max}ms  ${k}`));
    lines.push('', 'SLOW JOBS'); by('job', e => e.n).forEach(([k, v]) => lines.push(`  ${String(v.n).padStart(3)}x  ${String(v.ms).padStart(5)}ms total  max ${v.max}ms  ${k}`));
    lines.push('', 'LAST 60, in order'); log.slice(-60).forEach(e => lines.push(`  ${e.t}  ${e.k.padEnd(4)} ${String(e.ms).padStart(4)}ms  ${e.g || '-'}  ${e.n || e.in || ''}  ${e.h || ''}`));
    return lines.join('\n');
  };
  const reset = () => { log = []; store.set(KEY, log); };
  HW.perf = { job, span, busy, text, reset, get log() { return log; } };
})();
