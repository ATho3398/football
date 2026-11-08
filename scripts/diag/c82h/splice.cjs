// C.82h: 전체 960 표(c82h-960.json)에 그 칸만 다시 잰 json 들의 칸을 끼워 넣는다 (뒤에 오는 파일이 앞을 덮음). node splice.cjs out.json base.json cellA.json [cellB.json ...]
const fs = require('fs');
const [out, base, ...cells] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(base, 'utf8'));
const used = [];
for (const f of cells) for (let c of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  let i = rows.findIndex((r) => r.a === c.a && r.b === c.b);
  if (i < 0) {
    // 거꾸로 잰 칸(B/A)은 A/B 로 뒤집어 끼운다 — 득실·승패·단위 부호·양쪽 배열을 바꾼다
    i = rows.findIndex((r) => r.a === c.b && r.b === c.a);
    if (i < 0) throw new Error(`칸 없음 ${c.a}/${c.b}`);
    const sw = (k) => (Array.isArray(c[k]) && c[k].length === 2 ? [c[k][1], c[k][0]] : c[k]);
    c = { ...c, a: c.b, b: c.a, gf: c.ga, ga: c.gf, win: c.loss, loss: c.win, unit: c.unit.map((u) => -u), sh: sw('sh'), ow: sw('ow'), lp: sw('lp'), pa: sw('pa'), pc: sw('pc'), cs: sw('cs'), thr: sw('thr'), poss: c.n - c.poss };
  }
  rows[i] = c; used.push(`${c.a}>${c.b}(${f.split('/').pop()})`);
}
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`${out}: 끼운 칸 ${used.length} — ${used.join(' · ')}`);
