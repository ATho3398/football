// C.82h: 표준 대형 상호표 로그 요약 — 칸 |득실| 큰 순 · 대형별 행 평균(상대 7개, 부호 맞춤) · 최대
const fs = require('fs');
const rows = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter((l) => /^\| \d/.test(l)).map((l) => l.split('|').map((x) => x.trim()));
const cells = rows.map((r) => ({ a: r[1], b: r[2], gd: Number(r[3]), se: Number(r[4]), gf: r[5], ga: r[6] }));
const forms = [...new Set(cells.flatMap((c) => [c.a, c.b]))];
const row = {};
for (const f of forms) { const v = cells.filter((c) => c.a === f || c.b === f).map((c) => (c.a === f ? c.gd : -c.gd)); row[f] = v.reduce((a, b) => a + b, 0) / v.length; }
console.log('행 평균: ' + forms.map((f) => `${f} ${row[f] >= 0 ? '+' : ''}${row[f].toFixed(3)}`).join(' · '));
const sorted = [...cells].sort((x, y) => Math.abs(y.gd) - Math.abs(x.gd));
console.log('|득실| 큰 순: ' + sorted.slice(0, 8).map((c) => `${c.gd >= 0 ? c.a + '>' + c.b : c.b + '>' + c.a} ${Math.abs(c.gd).toFixed(3)} ± ${c.se.toFixed(3)}`).join(' · '));
console.log(`최대 |득실| ${Math.abs(sorted[0].gd).toFixed(3)} · ±0.35 넘는 칸 ${sorted.filter((c) => Math.abs(c.gd) > 0.35).length} · ±0.3 넘는 칸 ${sorted.filter((c) => Math.abs(c.gd) > 0.3).length}`);
