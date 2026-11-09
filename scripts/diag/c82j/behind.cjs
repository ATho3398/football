// C.82j: 공 뒤 인원 새 정의 — 상대 ⅓ 상실 중 70~87 m 구간·GK 상실 제외, 포지션별 공 뒤 % 와 합(=인원). 사용: node behind.cjs 이름=a.json[,b.json] …
const fs = require('fs');
const f = (x, d = 2) => x.toFixed(d);
for (const arg of process.argv.slice(2)) {
  const [name, files] = arg.split('=');
  const Rs = files.split(',').map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  const M = Rs.reduce((a, r) => a + r.matches, 0);
  for (const sideKey of ['me', 'op']) {
    const P = {}; const PS = {};
    for (const r of Rs) {
      for (const [k, v] of Object.entries(r[sideKey].posLoss)) { const t = (P[k] ??= [0, 0, 0, 0]); v.forEach((x, i) => (t[i] += x)); }
      for (const [k, v] of Object.entries(r[sideKey].posSnap)) { const t = (PS[k] ??= [0, 0, 0, 0]); v.forEach((x, i) => (t[i] += x)); }
    }
    const lab = sideKey === 'me' ? Rs[0].tac : Rs[0].vs;
    const tot = Object.values(P).reduce((a, v) => a + v[0], 0) / 10; // 에피소드 수 (필드 10명)
    const behind = Object.values(P).reduce((a, v) => a + v[1], 0) / tot;
    const grp = (keys) => { let n = 0, b = 0; for (const k of keys) if (P[k]) { n += P[k][0]; b += P[k][1]; } return n ? f(100 * b / n, 0) : '-'; };
    console.log(`== ${name} ${sideKey}(${lab}) 경기 ${M} · 70~87 m GK 제외 상실 ${f(tot, 0)}(경기당 ${f(tot / M, 1)}) · 공 뒤 인원 ${f(behind)} · ST ${grp(['ST', 'CF'])}% · 측면(LM/RM/LW/RW) ${grp(['LM', 'RM', 'LW', 'RW'])}% · CM(CM/CAM/CDM) ${grp(['CM', 'CAM', 'CDM'])}% · FB ${grp(['LB', 'RB', 'LWB', 'RWB'])}% · CB ${grp(['CB'])}%`);
    console.log('   상실 포지션별 공 뒤 % · 평균 x 차 m: ' + Object.entries(P).sort((a, b) => b[1][2] / b[1][0] - a[1][2] / a[1][0]).map(([k, v]) => `${k} ${f(100 * v[1] / v[0], 0)}% ${f(v[2] / v[0], 1)}m`).join(' · '));
    const LN = Rs.reduce((a, r) => a + (r[sideKey].lossLineN || 0), 0); if (LN) { const LP = {}; for (const r of Rs) for (const [k, v] of Object.entries(r[sideKey].loserPos || {})) LP[k] = (LP[k] ?? 0) + v; console.log(`   상실 순간 공 → 상대 라인 거리 평균 ${f(Rs.reduce((a, r) => a + r[sideKey].lossLineD, 0) / LN, 1)} m · 라인 2 m 안 ${f(100 * Rs.reduce((a, r) => a + r[sideKey].lossAtLine, 0) / LN, 0)}% · 잃은 쪽: ` + Object.entries(LP).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k} ${f(100 * v / LN, 0)}%`).join(' · ')); }
    { const Q = {}; for (const r of Rs) for (const [k, v] of Object.entries(r[sideKey].posLossSust || {})) { const t = (Q[k] ??= [0, 0, 0, 0]); v.forEach((x, i) => (t[i] += x)); }
      const qt = Object.values(Q).reduce((a, v) => a + v[0], 0) / 10; if (qt) { const g = (keys) => { let n = 0, bb = 0; for (const k of keys) if (Q[k]) { n += Q[k][0]; bb += Q[k][1]; } return n ? f(100 * bb / n, 0) : '-'; };
      console.log(`   지속 공격(소유 6 s+) 상실 ${f(qt, 0)}(${f(100 * qt / tot, 0)}%) · 공 뒤 인원 ${f(Object.values(Q).reduce((a, v) => a + v[1], 0) / qt)} · ST ${g(['ST', 'CF'])}% · 측면 ${g(['LM', 'RM', 'LW', 'RW'])}% · CM ${g(['CM', 'CAM', 'CDM'])}% · FB ${g(['LB', 'RB', 'LWB', 'RWB'])}% · CB ${g(['CB'])}%`); } }
    { const Q = {}; for (const r of Rs) for (const [k, v] of Object.entries(r[sideKey].posLossLate || {})) { const t = (Q[k] ??= [0, 0, 0, 0]); v.forEach((x, i) => (t[i] += x)); }
      const qt = Object.values(Q).reduce((a, v) => a + v[0], 0) / 10; if (qt) { const g = (keys) => { let n = 0, bb = 0; for (const k of keys) if (Q[k]) { n += Q[k][0]; bb += Q[k][1]; } return n ? f(100 * bb / n, 0) : '-'; };
      console.log(`   상대 ⅓ 진입 3 s+ 뒤 상실 ${f(qt, 0)}(${f(100 * qt / tot, 0)}%, 진입 뒤 평균 ${f(Rs.reduce((a, r) => a + (r[sideKey].lossEnterDt || 0), 0) / tot, 1)} s) · 공 뒤 인원 ${f(Object.values(Q).reduce((a, v) => a + v[1], 0) / qt)} · ST ${g(['ST', 'CF'])}% · 측면 ${g(['LM', 'RM', 'LW', 'RW'])}% · CM ${g(['CM', 'CAM', 'CDM'])}% · FB ${g(['LB', 'RB', 'LWB', 'RWB'])}% · CB ${g(['CB'])}%`); } }
    const snapTot = Object.values(PS).reduce((a, v) => a + v[0], 0) / 10;
    console.log(`   소유 스냅(70~87 m) ${f(snapTot, 0)} 공 앞 인원 ${f(Object.values(PS).reduce((a, v) => a + v[1], 0) / snapTot)} · ` + Object.entries(PS).sort((a, b) => b[1][2] / b[1][0] - a[1][2] / a[1][0]).map(([k, v]) => `${k} 앞 ${f(100 * v[1] / v[0], 0)}% ${f(v[2] / v[0], 1)}m`).join(' · '));
  }
}
