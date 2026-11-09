// C.82l: cell-<태그>-960.json 요약 (cell.sh 의 인라인 출력이 여러 덮어쓰기 인자에서 깨져 따로). 사용: node cellsum.cjs 태그 ...
const fs = require('fs');
for (const tag of process.argv.slice(2)) {
  const f = `scripts/diag/c82l/cell-${tag}-960.json`;
  if (!fs.existsSync(f)) { console.log(tag, '(없음)'); continue; }
  for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const u = r.unit, mu = u.reduce((a, b) => a + b, 0) / u.length, se = Math.sqrt(u.reduce((a, b) => a + (b - mu) ** 2, 0) / u.length / u.length);
    console.log(tag, r.a, '>', r.b, ((r.gf - r.ga) / r.n).toFixed(3), '±', se.toFixed(3), 'n', r.n);
  }
}
