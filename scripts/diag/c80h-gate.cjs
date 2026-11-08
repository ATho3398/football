// C.80h 관문 요약: 티키 행 960(새 값 칸 json 대 main C.80f 칸) · 게겐>티키 4묶음 짝 · 960 비교(c80d-matrix-cmp)
// 실행: node scripts/diag/c80h-gate.cjs 태그   (scripts/diag 안에서)
const fs = require('fs');
const T = process.argv[2];
const L = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const gd = (r) => (r.gf - r.ga) / r.n;
const tikiV = (r) => (r.a === 'tikitaka' ? gd(r) : -gd(r));
const opp = (r) => (r.a === 'tikitaka' ? r.b : r.a);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const se = (u) => { const m = mean(u); return Math.sqrt(mean(u.map((v) => (v - m) ** 2)) / u.length); };
let rowNew = 0, rowOld = 0;
for (const s of ['41', '51']) {
  const nw = L(`c80h-${T}-row-s${s}.json`), old = L(`c80f-trow-s${s}.json`).concat(L(`c80f-m-tg-s${s}.json`));
  const cells = nw.map((r) => { const o = old.find((x) => opp(x) === opp(r)); return `${opp(r)} ${tikiV(o).toFixed(2)}→${tikiV(r).toFixed(2)}`; });
  const a = mean(nw.map(tikiV)), b = mean(old.map(tikiV));
  rowNew += a / 2; rowOld += b / 2;
  console.log(`티키 행 ${s}000: ${b.toFixed(3)} → ${a.toFixed(3)} (Δ ${(a - b).toFixed(3)}) | ${cells.join(' · ')}`);
}
console.log(`티키 행 960: ${rowOld.toFixed(3)} → ${rowNew.toFixed(3)} (Δ ${(rowNew - rowOld).toFixed(3)})`);
const pairs = [['41', `c80f-m-tg-s41.json`, `c80h-${T}-row-s41.json`], ['51', `c80f-m-tg-s51.json`, `c80h-${T}-row-s51.json`], ['61', 'c80h-base-tg-s61.json', `c80h-${T}-tg-s61.json`], ['71', 'c80h-base-tg-s71.json', `c80h-${T}-tg-s71.json`]];
const dU = [], bU = [], nU = [];
for (const [s, bf, nf] of pairs) {
  const b = L(bf).find((r) => r.a === 'gegenpress'), n = L(nf).find((r) => r.a === 'gegenpress' && r.b === 'tikitaka');
  b.unit.forEach((v, i) => { dU.push(n.unit[i] - v); bU.push(v); nU.push(n.unit[i]); });
  console.log(`게겐>티키 ${s}000: ${gd(b).toFixed(2)} → ${gd(n).toFixed(2)}`);
}
console.log(`게겐>티키 4묶음: ${mean(bU).toFixed(3)} ± ${se(bU).toFixed(3)} → ${mean(nU).toFixed(3)} ± ${se(nU).toFixed(3)} · 짝 Δ ${mean(dU).toFixed(3)} ± ${se(dU).toFixed(3)}`);
