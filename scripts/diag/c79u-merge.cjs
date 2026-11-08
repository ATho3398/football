// 진단 (엔진관리자20 c79u): 같은 칸 구성의 상성 json 여러 개(다른 시드 묶음)를 하나로 합친다(gf·ga·sq·n 합, unit 이어붙임) → 960 판정용.
// 실행: node scripts/diag/c79u-merge.cjs out.json a.json b.json [...]
const fs = require('fs');
const [out, ...files] = process.argv.slice(2);
const sets = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const merged = sets[0].map((r, i) => {
  const rows = sets.map((s) => s[i]);
  if (rows.some((x) => x.a !== r.a || x.b !== r.b)) throw new Error(`칸 순서가 다름: ${r.a}/${r.b}`);
  const sum = (k) => rows.reduce((t, x) => t + x[k], 0);
  const arr = (k) => rows.reduce((t, x) => t.map((v, j) => v + x[k][j]), rows[0][k].map(() => 0));
  return { ...r, n: sum('n'), gf: sum('gf'), ga: sum('ga'), draw: sum('draw'), win: sum('win'), loss: sum('loss'), sq: sum('sq'), poss: sum('poss'), unit: rows.flatMap((x) => x.unit), bk: arr('bk'), bkTot: arr('bkTot'), sh: arr('sh'), ow: arr('ow'), lp: arr('lp'), pa: arr('pa'), pc: arr('pc'), cs: arr('cs'), thr: arr('thr') };
});
fs.writeFileSync(out, JSON.stringify(merged));
console.log(`${out}: ${merged.length}칸 × ${merged[0].n}경기`);
