// C.81q 비교: node scripts/diag/c81q-cmp.cjs <engine.json> <quick.json> [quick2.json]  → 리그 묶음 × 포지션군 골·도움 평균, 리그 득점·도움 상위 10 평균 (저장본당)
const fs = require('fs');
const [eF, ...qF] = process.argv.slice(2);
const MAJOR = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const cat = (lg) => (MAJOR.includes(lg) ? lg : 'rest');
const G = ['CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const mean = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : NaN);
function agg(file) {
  const runs = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cell = {}; const top = {};
  for (const r of runs) {
    const byLg = {};
    for (const x of r.rs) {
      const c = cat(x.lg);
      ((cell[`${c}:${x.group}`] ??= { g: [], a: [] }).g).push(x.goals);
      cell[`${c}:${x.group}`].a.push(x.assists);
      (byLg[x.lg] ??= []).push(x);
    }
    for (const [lg, xs] of Object.entries(byLg)) {
      const c = cat(lg);
      const T = (top[c] ??= { g: [], a: [], g1: [] });
      const gs = xs.map((x) => x.goals).sort((a, b) => b - a); const as = xs.map((x) => x.assists).sort((a, b) => b - a);
      T.g.push(mean(gs.slice(0, 10))); T.a.push(mean(as.slice(0, 10))); T.g1.push(gs[0]);
    }
  }
  return { cell, top };
}
const E = agg(eF); const Q = qF.map(agg);
const f = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pct = (q, e) => (Number.isFinite(q / e) && e > 0.3 ? `${((q / e - 1) * 100).toFixed(0)}%` : '');
let bad = 0; let tot = 0; let sq = 0;
const lines = ['| 리그 | 군 | 골 엔진 | ' + Q.map((_, i) => `골 빠른${i}`).join(' | ') + ' | 도움 엔진 | ' + Q.map((_, i) => `도움 빠른${i}`).join(' | ') + ' |'];
for (const c of [...MAJOR, 'rest']) for (const g of G) {
  const k = `${c}:${g}`; const e = E.cell[k]; if (!e) continue;
  const eg = mean(e.g); const ea = mean(e.a);
  const qs = Q.map((q) => [mean(q.cell[k]?.g ?? []), mean(q.cell[k]?.a ?? [])]);
  const last = qs.at(-1);
  for (const [qv, ev] of [[last[0], eg], [last[1], ea]]) if (ev > 0.5) { tot++; const d = qv / ev - 1; sq += d * d; if (Math.abs(d) > 0.1) bad++; }
  lines.push(`| ${c} | ${g} | ${f(eg)} | ${qs.map((q) => `${f(q[0])} ${pct(q[0], eg)}`).join(' | ')} | ${f(ea)} | ${qs.map((q) => `${f(q[1])} ${pct(q[1], ea)}`).join(' | ')} |`);
}
lines.push('', '| 리그 | 득점 상위10 엔진 | ' + Q.map((_, i) => `빠른${i}`).join(' | ') + ' | 득점왕 엔진 | ' + Q.map((_, i) => `빠른${i}`).join(' | ') + ' | 도움 상위10 엔진 | ' + Q.map((_, i) => `빠른${i}`).join(' | ') + ' |');
for (const c of [...MAJOR, 'rest']) {
  const e = E.top[c]; if (!e) continue;
  const qs = Q.map((q) => q.top[c] ?? { g: [], a: [], g1: [] });
  const last = qs.at(-1);
  for (const [qv, ev] of [[mean(last.g), mean(e.g)], [mean(last.a), mean(e.a)]]) { tot++; const d = qv / ev - 1; sq += d * d; if (Math.abs(d) > 0.1) bad++; }
  lines.push(`| ${c} | ${f(mean(e.g))} | ${qs.map((q) => `${f(mean(q.g))} ${pct(mean(q.g), mean(e.g))}`).join(' | ')} | ${f(mean(e.g1))} | ${qs.map((q) => f(mean(q.g1))).join(' | ')} | ${f(mean(e.a))} | ${qs.map((q) => `${f(mean(q.a))} ${pct(mean(q.a), mean(e.a))}`).join(' | ')} |`);
}
console.log(lines.join('\n'));
console.log(`\n±10% 밖 ${bad}/${tot}, 상대 오차 rms ${Math.sqrt(sq / tot).toFixed(3)}`);
