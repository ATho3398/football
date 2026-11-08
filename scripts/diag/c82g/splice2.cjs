// C.82g: 칸 방향(a/b 또는 b/a)을 맞춰 끼워 넣는다. node splice2.cjs out.json base.json new.json
const fs = require('fs');
const [out, baseF, newF] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(baseF, 'utf8'));
const nw = JSON.parse(fs.readFileSync(newF, 'utf8'));
const flip = (r) => ({ ...r, a: r.b, b: r.a, gf: r.ga, ga: r.gf, win: r.loss, loss: r.win, unit: r.unit.map((u) => -u) });
let changed = 0;
const merged = base.map((r) => {
  const same = nw.find((x) => x.a === r.a && x.b === r.b);
  if (same) { changed++; return same; }
  const rev = nw.find((x) => x.a === r.b && x.b === r.a);
  if (rev) { changed++; return flip(rev); }
  return r;
});
fs.writeFileSync(out, JSON.stringify(merged));
console.log(`${out}: 바뀐 칸 ${changed}`);
