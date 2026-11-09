// C.82k: 다시 잰 칸(cell-*-960.json)을 960 표(c82k-960.json)에 끼워 최종 표를 만든다. 사용: node splice.cjs out.json base.json cell1.json [cell2.json …]
const fs = require('fs');
const [out, base, ...cells] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(base, 'utf8'));
for (const f of cells) for (const c of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  const i = rows.findIndex((r) => r.a === c.a && r.b === c.b);
  if (i < 0) throw new Error(`칸 없음 ${c.a}/${c.b}`);
  rows[i] = c; console.log(`끼움 ${c.a}>${c.b} ${((c.gf - c.ga) / c.n).toFixed(3)} (${f})`);
}
fs.writeFileSync(out, JSON.stringify(rows));
