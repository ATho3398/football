// C.81b: 시드·반쪽별 상성 json(c78s-matrix out=) 을 칸별로 합쳐 960 표로. 실행: node scripts/diag/c81b-merge.cjs out.json in1.json in2.json …
// 같은 칸(a/b)이 여러 파일에 있으면 n·gf·ga·draw·win·loss·sq 를 더하고 unit 을 잇는다. 뒤 파일이 같은 시드 칸을 덮지는 않는다(덮기는 c81b-swap 로).
const fs = require('fs');
const [out, ...ins] = process.argv.slice(2);
const m = new Map();
for (const f of ins) for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  const k = r.a + '/' + r.b; const x = m.get(k);
  if (!x) { m.set(k, { ...r, unit: [...r.unit] }); continue; }
  for (const key of ['n', 'gf', 'ga', 'draw', 'win', 'loss', 'sq']) x[key] = (x[key] ?? 0) + (r[key] ?? 0);
  x.unit.push(...r.unit);
}
fs.writeFileSync(out, JSON.stringify([...m.values()]));
console.log(`${out}: ${m.size}칸, 칸당 ${[...new Set([...m.values()].map((x) => x.n))].join('/')}경기`);
