// C.82c: 상성 표를 기준표(같은 시드 41000, 칸당 더 많은 경기)의 앞쪽 같은 시드 짝과 비교 — 행 평균 Δ 와 칸 Δ(짝 차 SE)
// 실행: node scripts/diag/c82c-mx-pair.cjs 지금.json 기준.json
const fs = require('fs');
const [fa, fb] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(fa, 'utf8')), B = JSON.parse(fs.readFileSync(fb, 'utf8'));
const T = ['balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'block@0020'];
const nm = { balanced: '균형', tikitaka: '티키', gegenpress: '게겐', counter: '역습', direct: '직선', block: '블록', 'block@0020': '버스' };
const d = {}, d0 = {};
for (const x of A) { const y = B.find((z) => z.a === x.a && z.b === x.b); const k = x.unit.length; const u0 = y.unit.slice(0, k);
  const m = (u) => u.reduce((s, v) => s + v, 0) / u.length; const diff = x.unit.map((v, i) => v - u0[i]); const md = m(diff);
  const se = Math.sqrt(diff.reduce((s, v) => s + (v - md) ** 2, 0) / (k - 1) / k);
  (d[x.a] ??= {})[x.b] = m(x.unit); (d[x.b] ??= {})[x.a] = -m(x.unit); (d0[x.a] ??= {})[x.b] = m(u0); (d0[x.b] ??= {})[x.a] = -m(u0);
  console.log(`${nm[x.a]}>${nm[x.b]}: 지금 ${m(x.unit).toFixed(3)} · 기준 같은 시드 ${m(u0).toFixed(3)} · Δ ${md >= 0 ? '+' : ''}${md.toFixed(3)} ± ${se.toFixed(3)}`); }
const row = (M, t) => T.filter((o) => o !== t).reduce((s, o) => s + M[t][o], 0) / 6;
console.log('\n| 행 | 지금 | 기준(같은 시드) | Δ |'); console.log('|---|---|---|---|');
for (const t of T) console.log(`| ${nm[t]} | ${row(d, t).toFixed(3)} | ${row(d0, t).toFixed(3)} | ${(row(d, t) - row(d0, t) >= 0 ? '+' : '') + (row(d, t) - row(d0, t)).toFixed(3)} |`);
