// C.80t: 기준 960 표(json)에서 일부 칸만 새 측정(json, 같은 방향 a/b)으로 바꿔 전체 표를 만든다 — 안 바뀐 칸은 결정성으로 기준과 같다.
// 실행: node scripts/diag/c80t-splice.cjs out.json 기준.json 새1.json [새2.json ...]
const fs = require('fs');
const [out, base, ...files] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(base, 'utf8'));
let n = 0;
for (const f of files) for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  const i = rows.findIndex((r) => r.a === x.a && r.b === x.b);
  if (i < 0) throw new Error(`기준에 없는 칸(방향 확인): ${x.a}/${x.b}`);
  rows[i] = x; n++;
}
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`${out}: ${n}칸 교체`);
