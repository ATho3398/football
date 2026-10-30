// C.80h: 상성 json(기준표)에 칸 json 들을 덮어쓴다 — 칸 방향(a/b)이 반대면 득실·승패를 뒤집어 넣는다(unit 은 부호 반전).
// 실행: node scripts/diag/c80h-overlay.cjs out.json 기준.json 칸1.json [칸2.json …]
const fs = require('fs');
const [out, base, ...files] = process.argv.slice(2);
const B = JSON.parse(fs.readFileSync(base, 'utf8'));
for (const f of files) for (const c of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  const i = B.findIndex((r) => (r.a === c.a && r.b === c.b) || (r.a === c.b && r.b === c.a));
  if (i < 0) throw new Error(`칸 없음: ${c.a}/${c.b}`);
  B[i] = B[i].a === c.a ? c : { ...c, a: c.b, b: c.a, gf: c.ga, ga: c.gf, win: c.loss, loss: c.win, unit: c.unit.map((v) => -v), poss: 100 * c.n - c.poss, ...Object.fromEntries(['sh', 'ow', 'lp', 'pa', 'pc', 'cs', 'thr'].map((k) => [k, [c[k][1], c[k][0]]])) };
}
fs.writeFileSync(out, JSON.stringify(B));
console.log(`${out}: ${B.length}칸, 덮어쓴 파일 ${files.length}개`);
