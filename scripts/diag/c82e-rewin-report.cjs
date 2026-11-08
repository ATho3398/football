// C.82e: c82e-rewin.ts JSON 합쳐 표로. node scripts/diag/c82e-rewin-report.cjs 이름=a.json,b.json …
const fs = require('fs');
const add = (a, b) => { for (const k in b) { if (typeof b[k] === 'number') a[k] = (a[k] ?? 0) + b[k]; else if (Array.isArray(b[k])) { a[k] ??= b[k].map(() => 0); b[k].forEach((x, i) => { a[k][i] += x; }); } else if (b[k] && typeof b[k] === 'object') add(a[k] ??= {}, b[k]); } return a; };
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '–');
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
console.log('| 묶음 | 누가 잃음 | 상실/경기 | 5 s 재탈취 % | 재탈취 시각 s | 되찾은 방식 gain/intercept/win/claim/loose/기타 % | 가담자가 되찾음 % · 첫 가담자 % | 가담 0/1/2/3 % | 가담별 재탈취 % | 첫 가담자 거리 잃을 때·최소 m | 첫 가담자 2 m 도달 % · 시각 s | 첫 가담자 태클 시도/100 상실 · 성공률 % · 가로채기/100 | 다른 가담자 시도/100 · 성공률 · 가로채기/100 | 비가담 시도/100 · 성공률 · 가로채기/100 | 파울/100 | 상대 첫 행동 패스/몰기/없음 % · 시각 s · 첫 패스 실패 % | 구역 재탈취 % 자기/가운데/상대 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const a of process.argv.slice(2)) {
  const [name, files] = a.split('=');
  const R = files.split(',').map((p) => JSON.parse(fs.readFileSync(p, 'utf8'))).reduce((x, y) => add(x, y), {});
  const m = R.matches;
  for (const who of ['me', 'op']) {
    const S = R[who]; const K = S.reWinKind; const N = S.n;
    console.log(`| ${name} | ${who === 'me' ? '대상' : '상대'} | ${f(N / m, 1)} | ${pct(S.reWin, N)} | ${f(S.reWinT / S.reWin)} | ${['gain', 'intercept', 'win', 'claim', 'loose', 'other'].map((k) => pct(K[k], S.reWin)).join('/')} | ${pct(S.reWinByPresser, S.reWin)} · ${pct(S.reWinByP0, S.reWin)} | ${S.pN.map((v) => pct(v, N)).join('/')} | ${S.pRe.map((v, i) => pct(v, S.pN[i])).join('/')} | ${f(S.p0d0 / (N - S.pN[0]), 1)}·${f(S.p0dMin / (N - S.pN[0]), 1)} | ${pct(S.p0Reach, N - S.pN[0])} · ${f(S.p0ReachT / S.p0Reach)} | ${f(100 * S.p0Duel / N)} · ${pct(S.p0Won, S.p0Duel)} · ${f(100 * S.p0Int / N)} | ${f(100 * S.pkDuel / N)} · ${pct(S.pkWon, S.pkDuel)} · ${f(100 * S.pkInt / N)} | ${f(100 * S.othDuel / N)} · ${pct(S.othWon, S.othDuel)} · ${f(100 * S.othInt / N)} | ${f(100 * S.tackleFoul / N)} | ${pct(S.oppFirst.pass, N)}/${pct(S.oppFirst.carry, N)}/${pct(S.oppFirst.none, N)} · ${f(S.oppFirstT / (N - S.oppFirst.none))} · ${pct(S.oppPassFail, S.oppPassN)} | ${S.zoneRe.map((v, i) => pct(v, S.zone[i])).join('/')} |`);
  }
}
