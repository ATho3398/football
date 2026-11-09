// C.82l: splice.cjs 와 같되 base 의 칸 방향이 반대(b/a)면 뒤집어 끼운다. 사용: node splice2.cjs out.json base.json cell1.json …
const fs = require('fs');
const [out, base, ...cells] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(base, 'utf8'));
for (const f of cells) for (const c of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  let i = rows.findIndex((r) => r.a === c.a && r.b === c.b);
  let cc = c;
  if (i < 0) {
    i = rows.findIndex((r) => r.a === c.b && r.b === c.a);
    if (i < 0) throw new Error(`칸 없음 ${c.a}/${c.b}`);
    cc = { ...c, a: c.b, b: c.a, gf: c.ga, ga: c.gf, unit: c.unit.map((u) => -u) };
    for (const k of Object.keys(c)) if (!(k in cc)) cc[k] = c[k];
  }
  rows[i] = cc; console.log(`끼움 ${c.a}>${c.b} ${((c.gf - c.ga) / c.n).toFixed(3)} (${f})${cc !== c ? ' 뒤집음' : ''}`);
}
fs.writeFileSync(out, JSON.stringify(rows));
