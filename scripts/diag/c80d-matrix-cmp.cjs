// C.80d: 상성 960 비교 (기준 합본 → 변형 합본): 행 강도(상대 6개 득실차 평균) Δ · 비점유 3행 합 · 순환 합 · 게겐>티키 칸
// 실행: node scripts/diag/c80d-matrix-cmp.cjs 기준.json 변형.json
const fs = require('fs');
const load = (f) => {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  const d = {};
  for (const x of r) { const v = (x.gf - x.ga) / x.n; (d[x.a] ??= {})[x.b] = v; (d[x.b] ??= {})[x.a] = -v; }
  return d;
};
const [A, B] = process.argv.slice(2).map(load);
const T = Object.keys(A);
const s = (D, t) => T.filter((o) => o !== t).reduce((a, o) => a + D[t][o], 0) / (T.length - 1);
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const name = { balanced: '균형', tikitaka: '티키', gegenpress: '게겐', counter: '역습', direct: '직선', block: '블록', 'block@0020': '버스' };
console.log('행 강도 Δ:', T.map((t) => `${name[t] ?? t} ${f(s(B, t) - s(A, t))}`).join(' · '));
const nonPoss = ['direct', 'block', 'block@0020'];
console.log('비점유 3행 Δ 합:', f(nonPoss.reduce((a, t) => a + s(B, t) - s(A, t), 0)));
const cyc = (D, c) => c.reduce((a, t, i) => a + D[t][c[(i + 1) % c.length]], 0);
for (const c of [['gegenpress', 'tikitaka', 'direct', 'block'], ['tikitaka', 'direct', 'block'], ['gegenpress', 'tikitaka', 'counter']]) console.log(`순환 ${c.map((t) => name[t]).join('>')}: ${f(cyc(A, c))} → ${f(cyc(B, c))}`);
console.log(`게겐>티키 칸: ${f(A.gegenpress.tikitaka)} → ${f(B.gegenpress.tikitaka)}`);
