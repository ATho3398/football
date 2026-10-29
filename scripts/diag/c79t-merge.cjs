// 진단 (C.79t): c78s-matrix out json 여러 장을 칸별로 합친다 (n·gf·ga 합) — 시드 묶음 평균(41000 + 51000 = 960) 판정용
// 실행: node scripts/diag/c79t-merge.cjs 출력.json 입력1.json 입력2.json ...
const fs = require('fs');
const [out, ...ins] = process.argv.slice(2);
const rows = new Map();
for (const f of ins) for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  const k = r.a + '/' + r.b; const o = rows.get(k) ?? { a: r.a, b: r.b, n: 0, gf: 0, ga: 0 };
  o.n += r.n; o.gf += r.gf; o.ga += r.ga; rows.set(k, o);
}
fs.writeFileSync(out, JSON.stringify([...rows.values()], null, 1));
