// 엔진관리자25: 상성 960 전체 표 (칸 득실·SE·|칸|>0.3 표시·행 평균·기준 대비 Δ). 실행: node scripts/diag/em25-matrix.cjs 지금.json [기준.json]
const fs = require('fs');
const load = (f) => { const r = JSON.parse(fs.readFileSync(f, 'utf8')); const d = {}, se = {}, g = {};
  for (const x of r) { const v = (x.gf - x.ga) / x.n; const u = x.unit, mu = u.reduce((a, b) => a + b, 0) / u.length;
    const s = Math.sqrt(u.reduce((a, b) => a + (b - mu) ** 2, 0) / u.length / u.length);
    (d[x.a] ??= {})[x.b] = v; (d[x.b] ??= {})[x.a] = -v; (se[x.a] ??= {})[x.b] = s; (se[x.b] ??= {})[x.a] = s; (g[x.a] ??= {})[x.b] = (x.gf + x.ga) / x.n; (g[x.b] ??= {})[x.a] = (x.gf + x.ga) / x.n; }
  return { d, se, g, n: r[0].n, goals: r.reduce((a, x) => a + x.gf + x.ga, 0) / r.reduce((a, x) => a + x.n, 0) / 2 }; };
const [fa, fb] = process.argv.slice(2); const A = load(fa); const B = fb ? load(fb) : null;
const T = ['balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'block@0020'];
const nm = { balanced: '균형', tikitaka: '티키', gegenpress: '게겐', counter: '역습', direct: '직선', block: '블록', 'block@0020': '버스' };
const f = (v, k = 2) => (v >= 0 ? '+' : '') + v.toFixed(k);
const row = (M, t) => T.filter((o) => o !== t).reduce((a, o) => a + M.d[t][o], 0) / 6;
console.log(`칸당 ${A.n}경기 · 팀당 득점 ${A.goals.toFixed(3)}${B ? ` (기준 ${B.goals.toFixed(3)})` : ''}`);
console.log(`| 행 \\ 열 | ${T.map((t) => nm[t]).join(' | ')} | 행 평균${B ? ' (Δ)' : ''} |`); console.log(`|${'---|'.repeat(T.length + 2)}`);
for (const t of T) console.log(`| ${nm[t]} | ${T.map((o) => o === t ? '–' : `${Math.abs(A.d[t][o]) > 0.3 ? '**' : ''}${f(A.d[t][o])}${Math.abs(A.d[t][o]) > 0.3 ? '**' : ''}${B ? ` (${f(A.d[t][o] - B.d[t][o])})` : ''}`).join(' | ')} | ${f(row(A, t))}${B ? ` (${f(row(A, t) - row(B, t))})` : ''} |`);
console.log('\n칸 목록 (|득실| 큰 순, ±SE, 합계 골' + (B ? ', 기준 → 지금, Δ/SEΔ' : '') + ')');
const cells = []; T.forEach((a, i) => T.slice(i + 1).forEach((b) => cells.push([a, b])));
cells.sort((x, y) => Math.abs(A.d[y[0]][y[1]]) - Math.abs(A.d[x[0]][x[1]]));
for (const [a, b] of cells) { const v = A.d[a][b], s = A.se[a][b]; const [p, q, vv] = v >= 0 ? [a, b, v] : [b, a, -v];
  let extra = ''; if (B) { const bv = B.d[p][q], dse = Math.hypot(s, B.se[p][q]); extra = ` · 기준 ${f(bv)} → Δ ${f(vv - bv)} (${((vv - bv) / dse).toFixed(1)} SE)`; }
  console.log(`${nm[p]} > ${nm[q]} ${f(vv)} ± ${s.toFixed(3)} · 합계 골 ${A.g[a][b].toFixed(2)}${Math.abs(vv) > 0.3 ? ' ★0.3 초과' : ''}${extra}`); }
const cyc = (M, c) => c.reduce((a, t, i) => a + M.d[t][c[(i + 1) % c.length]], 0);
for (const c of [['gegenpress', 'tikitaka', 'direct', 'block'], ['tikitaka', 'direct', 'block'], ['gegenpress', 'tikitaka', 'counter']]) console.log(`순환 ${c.map((t) => nm[t]).join('>')}: ${f(cyc(A, c))}${B ? ` (기준 ${f(cyc(B, c))})` : ''} · 고리별 ${c.map((t, i) => f(A.d[t][c[(i + 1) % c.length]])).join(' / ')}`);
