// 엔진관리자28: em28-trans.ts JSON 여러 개를 합쳐 표로. node scripts/diag/em28-report.cjs 이름=파일1,파일2 …
const fs = require('fs');
const add = (a, b) => { for (const k in b) { if (typeof b[k] === 'number') a[k] = (a[k] ?? 0) + b[k]; else if (Array.isArray(b[k])) { if (typeof b[k][0] === 'number') { a[k] ??= b[k].map(() => 0); b[k].forEach((x, i) => { a[k][i] += x; }); } else { a[k] ??= b[k].map(() => ({})); b[k].forEach((x, i) => add(a[k][i], x)); } } else if (b[k] && typeof b[k] === 'object') add(a[k] ??= {}, b[k]); } return a; };
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '–');
const f = (v, d = 1) => v.toFixed(d);
console.log('| 묶음 | 누가 잃음 | 구역 | 상실/경기 | 5 s 재탈취 % | 뚫림 % | 공 뒤 우리·상대 | 상대 수적 우위 % | 같은 소유 8 s 슛 % | 같은 소유 15 s 슛 % | xG/100 | 골/100 | 오프사이드 % | 옛 지표(8 s 아무 슛) % | 8 s·15 s 전진 m | 30 m 안 진입 % | 뚫림 → 슛 % | 수적 우위 → 슛 % | 라인 뒤 공간 m | 가담 0/1/2/3 % | 가담별 15 s 슛 % | 가담별 5 s 재탈취 % | 첫 패스 있음 % · 시각 s · 전진 m | 첫 패스 10 m+ 전진 % · 뒤로 % · 롱/걷어내기 % · 침투 % · 성공 % | 첫 패스 전 드리블 전진 m |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const sums = [];
for (const a of process.argv.slice(2)) {
  const [name, files] = a.split('=');
  const R = files.split(',').map((p) => JSON.parse(fs.readFileSync(p, 'utf8'))).reduce((x, y) => add(x, y), {});
  const m = R.matches;
  for (const who of ['me', 'op']) {
    const S = R[who];
    const all = S.z.reduce((x, y) => add(x, y), {});
    [...S.z.map((Z, i) => [['자기⅓', '가운데', '상대⅓'][i], Z]), ['전체', all]].forEach(([zn, Z]) => {
      console.log(`| ${name} | ${who === 'me' ? '대상' : '상대'} | ${zn} | ${f(Z.n / m)} | ${pct(Z.reWin5, Z.n)} | ${pct(Z.broke, Z.n)} | ${f(Z.behind / Z.n)}·${f(Z.oppAhead / Z.n)} | ${pct(Z.numUp, Z.n)} | ${pct(Z.seqShot8, Z.n)} | ${pct(Z.seqShot15, Z.n)} | ${f(100 * Z.seqXg15 / Z.n, 2)} | ${f(100 * Z.seqGoal15 / Z.n, 2)} | ${pct(Z.off15 ?? 0, Z.n)} | ${pct(Z.anyShot8, Z.n)} | ${f(Z.prog8 / Z.n)}·${f(Z.prog15 / Z.n)} | ${pct(Z.reach30, Z.n)} | ${pct(Z.brokeShot, Z.broke)} | ${pct(Z.numUpShot, Z.numUp)} | ${f(Z.space / Z.n)} | ${Z.pN.map((v) => pct(v, Z.n)).join('/')} | ${Z.pShot.map((v, i) => pct(v, Z.pN[i])).join('/')} | ${Z.pRe.map((v, i) => pct(v, Z.pN[i])).join('/')} | ${pct(Z.fpN, Z.n)} · ${f(Z.fpDt / Z.fpN, 2)} · ${f(Z.fpGain / Z.fpN)} | ${pct(Z.fpFwd10, Z.fpN)} · ${pct(Z.fpBack, Z.fpN)} · ${pct(Z.fpLong, Z.fpN)}/${pct(Z.fpClear, Z.fpN)} · ${pct(Z.fpThr, Z.fpN)} · ${pct(Z.fpOk, Z.fpN)} | ${f(Z.carry / Z.n)} |`);
    });
    sums.push(`${name} ${who === 'me' ? '대상' : '상대'}: ${m}경기 · 맞은 슛/경기 ${f(S.shotsAgainst / m, 2)} · 그중 전환(같은 소유 15 s) ${f(S.transShots / m, 2)} (${pct(S.transShots, S.shotsAgainst)}%) · 맞은 xG/경기 ${f(S.xgAgainst / m, 2)} · 전환 xG/경기 ${f(S.transXg / m, 3)} · 실점/경기 ${f(S.goalsAgainst / m, 2)}`);
  }
  sums.push(`${name} 득실/경기 ${f(R.gd / m, 3)}`);
}
console.log('\n' + sums.join('\n'));
