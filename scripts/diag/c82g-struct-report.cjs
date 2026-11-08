// C.82g 구조 진단 보고: node scripts/diag/c82g-struct-report.cjs 이름=a.json,b.json …
const fs = require('fs');
const f = (x, d = 2) => x.toFixed(d);
for (const arg of process.argv.slice(2)) {
  const [name, files] = arg.split('=');
  const Rs = files.split(',').map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  const M = Rs.reduce((a, r) => a + r.matches, 0);
  for (const sideKey of ['me', 'op']) {
    const S = {};
    for (const r of Rs) for (const [k, v] of Object.entries(r[sideKey])) S[k] = Array.isArray(v) ? v.map((x, i) => x + (S[k]?.[i] ?? 0)) : typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, Array.isArray(vv) ? vv.map((x, i) => x + (S[k]?.[kk]?.[i] ?? 0)) : vv + (S[k]?.[kk] ?? 0)])) : (S[k] ?? 0) + v;
    const lab = sideKey === 'me' ? Rs[0].tac : Rs[0].vs;
    console.log(`== ${name} ${sideKey}(${lab}) 경기 ${M}`);
    const sn = S.snapN || 1;
    console.log(`(A) 상대⅓ 소유 스냅 ${S.snapN} (경기당 ${f(S.snapN / M, 0)} s) · 공 x ${f(S.ballX / sn, 1)} m · 공 앞 인원 줄1 ${f(S.aheadL1 / sn)} 줄2 ${f(S.aheadL2 / sn)} 줄3 ${f(S.aheadL3 / sn)} 합 ${f((S.aheadL1 + S.aheadL2 + S.aheadL3) / sn)} · 공 ±3 m 공격수 ${f(S.level3 / sn)} · 상대 라인까지 ${f(S.space / sn, 1)} m · 라인 2 m 안 ${f(S.nearLine / sn)} · 침투 중 ${f(S.running / sn)} · 우리 라인 높이 ${f(S.defLine / sn, 1)} m`);
    console.log(`    공 위치 구간(70~79·79~87·87~96·96~105 m) 스냅 ${S.bandN.join('/')} · 공 앞 인원 ${S.bandN.map((n, i) => f(S.bandAhead[i] / (n || 1))).join('/')}`);
    const n = S.n || 1;
    const posLine = (P) => Object.entries(P || {}).sort((a, b) => b[1][2] / b[1][0] - a[1][2] / a[1][0]).map(([k, v]) => `${k} 앞 ${f(100 * (v[1]) / v[0], 0)}% ${f(v[2] / v[0], 1)}m${v[3] ? ' 런' + f(100 * v[3] / v[0], 0) + '%' : ''}`).join(' · ');
    console.log(`    [소유 스냅 70~87 m, 포지션별 공 앞 %·평균 x 차 m·침투 중 %] ${posLine(S.posSnap)}`);
    console.log(`    [상실 70~87 m(GK 제외), 포지션별 공 뒤 %·평균 x 차 m·침투 중 %] ${posLine(S.posLoss)}`);
    console.log(`(B) 상대⅓ 상실 ${S.n} (경기당 ${f(S.n / M, 1)}) · 공 x ${f(S.lossX / n, 1)} m · 공 뒤 ${f(S.behind / n)} (줄1 ${f(S.behindL1 / n)} 줄2 ${f(S.behindL2 / n)} 줄3 ${f(S.behindL3 / n)}) · 공 앞 ${f(S.ahead / n)} · 목표가 공 앞 ${f(S.tgtAhead / n)} · 탈취 팀 공 앞 ${f(S.oppAheadAtLoss / n)} · 잃은 팀 라인 ${f(S.lineAtLoss / n, 1)} m`);
    console.log(`    라인 하강 1·2·3 s ${f(S.lineD1 / (S.lineN3 || 1), 1)}·${f(S.lineD2 / (S.lineN3 || 1), 1)}·${f(S.lineD3 / (S.lineN3 || 1), 1)} m · 3 s 공 전진 ${f(S.ballGain3 / (S.lineN3 || 1), 1)} m · 3 s 수적 동등+ ${f(100 * S.numUp3 / n, 1)}%`);
    console.log(`    첫 패스(3 s 안) ${f(100 * S.fpN / n, 1)}% · 시각 ${f(S.fpT / (S.fpN || 1))} s · 전진 ${f(S.fpGain / (S.fpN || 1), 1)} m · 앞으로 ${f(100 * S.fpFwd / (S.fpN || 1), 1)}% · 침투 ${f(100 * S.fpThr / (S.fpN || 1), 1)}% · 롱 ${f(100 * S.fpLong / (S.fpN || 1), 1)}% · 성공 ${f(100 * S.fpOk / (S.fpN || 1), 1)}% · 잃은 팀 라인 뒤로 ${f(100 * S.fpBehindLine / (S.fpN || 1), 1)}%`);
    console.log(`    3 s 안 탈취 팀 침투 런 최대 ${f(S.runners3 / n)} 명 · 라인 뒤 선수 최대 ${f(S.beyond3 / n)} 명 (있음 ${f(100 * S.beyondMax / n, 1)}%) · 같은 소유 15 s 슛 ${f(100 * S.shot15 / n, 1)}% · xG/100 ${f(100 * S.xg15 / n, 2)}`);
    console.log(`    상실 구간(70~79·79~87·87~96·96~105 m) 수 ${S.lossBandN.join('/')} · 공 뒤 ${S.lossBandN.map((n, i) => f(S.lossBandBehind[i] / (n || 1))).join('/')} · 15 s 슛 % ${S.lossBandN.map((n, i) => f(100 * S.lossBandShot[i] / (n || 1), 1)).join('/')} · GK 잡음 ${f(100 * S.lossGk / n, 1)}% (공 뒤 ${f(S.lossGkBehind / (S.lossGk || 1))}) · 측면 ${f(100 * S.lossWide / n, 1)}% (공 뒤 ${f(S.lossWideBehind / (S.lossWide || 1))})`);
    const rb = S.rbN || 1;
    console.log(`    라인 뒤 수신(15 s 안, 골 쪽 잃은 팀 ≤1명) ${S.rbN} (상실당 ${f(100 * S.rbN / n, 1)}%) · 골까지 ${f(S.rbD / rb, 1)} m · 가장 가까운 수비 ${f(S.rbGap / rb, 1)} m · 골 쪽 수비 ${f(S.rbGoalSide / rb)} · 6 s 안 슛 ${f(100 * S.rbShot6 / rb, 1)}% (xG/슛 ${f(S.rbXg6 / (S.rbShot6 || 1), 3)}) · 뺏김 ${f(100 * S.rbLost6 / rb, 1)}% · 패스 ${f(100 * S.rbPass6 / rb, 1)}% · 최소 수비 거리 ${f(S.rbMinGap / rb, 1)} m · 몰기 ${f(S.rbDribble / rb, 1)} m`);
    const F = S.rbFirst || {};
    console.log(`      수신 시각 ${f(S.rbT / rb)} s · 공격수 ${f(100 * S.rbL3 / rb, 0)}% · 등지고 ${f(100 * S.rbBack / rb, 0)}% · 첫 행동 슛/패스/침투/몰기/뺏김/없음 % ${['shot', 'pass', 'through', 'carry', 'lost', 'none'].map((k) => f(100 * (F[k] || 0) / rb, 0)).join('/')} · 첫 행동 시각 ${f(S.rbFirstT / rb)} s · 패스 앞으로 ${f(100 * S.rbPassFwd / (S.rbPass6 || 1), 0)}% · 패스 뒤 3 s 동료 슛 ${f(100 * S.rbMateShot3 / (S.rbPass6 || 1), 0)}%`);
    console.log(`    맞은 슛/경기 ${f(S.shotsAgainst / M)} · xG ${f(S.xgAgainst / M, 3)} · 실점 ${f(S.goalsAgainst / M)}`);
  }
}
