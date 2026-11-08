// 엔진관리자28: em26-box-rebound JSON 합쳐 쳐낸 공 고리 표. node scripts/diag/em28-rebound-report.cjs 이름=파일1,파일2 …
const fs = require('fs');
const add = (a, b) => { for (const k in b) { if (typeof b[k] === 'number') a[k] = (a[k] ?? 0) + b[k]; else if (Array.isArray(b[k])) { a[k] ??= b[k].map(() => 0); b[k].forEach((x, i) => { if (typeof x === 'number') a[k][i] += x; }); } else if (b[k] && typeof b[k] === 'object') add(a[k] ??= {}, b[k]); } return a; };
const p = (a, b) => (b ? (100 * a / b).toFixed(1) : '–');
console.log('| 묶음 | 경기 | 골/경기 | 리바운드 골 % (경로 5) | 리바운드 슛 전환 % | 선방 → 캐치/코너/루즈 % | 쳐낸 공 → 공격 첫 접촉 % · 수비 % · GK % | 첫 접촉 시각 s · 골 거리 m | 공격 첫 접촉 → 5 s 슛 % | 쳐낸 공 → 5 s 슛 % · xG/슛 · 골 | 쳐낸 순간 6 m 안 공격·수비 | 막힌 공 루즈 → 공격 첫 접촉 % · 슛 · 골 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const a of process.argv.slice(2)) {
  const [name, files] = a.split('=');
  const R = files.split(',').map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))).reduce((x, y) => add(x, y), {});
  const P = R.ep.parry, B = R.ep.block, m = R.matches;
  console.log(`| ${name} | ${m} | ${(R.goals / m).toFixed(2)} | ${p(R.goalPathsSum[5], R.goals)} (${R.goalPathsSum[5]}) | ${p(R.goalPathsSum[5], R.shotPathsSum[5])} | ${p(R.catch, R.saves)}/${p(R.saveCorner, R.saves)}/${p(R.parryLoose, R.saves)} | ${p(P.attFirst, P.n)} · ${p(P.defFirst, P.n)} · ${p(P.gkFirst, P.n)} | ${(P.tFirst / P.n).toFixed(2)} · ${(P.dFirstAtt / P.nAttFirst).toFixed(1)} | ${p(P.attShot5, P.attFirst)} | ${p(P.attShot5, P.n)} · ${(P.xg / P.attShot5).toFixed(3)} · ${P.attGoal5} | ${(P.attIn6 / P.n).toFixed(2)}·${(P.defIn6 / P.n).toFixed(2)} | ${p(B.attFirst, B.n)} · ${B.attShot5} · ${B.attGoal5} |`);
}
