// 진단 (엔진관리자20 c79u): 상성 json 의 칸 SE(비짝·짝)와 행 강도 SE. 실행: node scripts/diag/c79u-se.cjs scripts/diag/c79k-main-matrix.json [...]
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(f));
  const ses = r.map((x) => { const d = (x.gf - x.ga) / x.n; return Math.sqrt((x.sq / x.n - d * d) / x.n); });
  const unit = r.map((x) => { const U = x.unit.length, um = x.unit.reduce((a, b) => a + b, 0) / U; return Math.sqrt(x.unit.reduce((a, b) => a + (b - um) ** 2, 0) / (U - 1) / U); });
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(f, 'n', r[0].n, '칸 SE 비짝', m(ses).toFixed(3), '짝', m(unit).toFixed(3), '→ 행 s SE ≈', (0.35 * m(unit)).toFixed(3), 'Δs(두 측정) SE ≈', (0.35 * m(unit) * Math.SQRT2).toFixed(3));
}
