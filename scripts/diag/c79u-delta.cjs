// 진단 (엔진관리자20 c79u): c79u-probe 로그 둘(기준 → 변형)의 칸·팀별 지표 변화를 표로. 실행: node scripts/diag/c79u-delta.cjs 기준.log 변형.log
const fs = require('fs');
const parse = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| 칸')).map((l) => {
  const c = l.split('|').slice(1, -1).map((x) => x.trim());
  const num = (s) => s.split(/[\s/·()공중%]+/).filter((x) => x !== '' && !isNaN(Number(x))).map(Number);
  const [gf, ga] = num(c[2]); const [lz0, lz1, lz2] = num(c[8]); const tr = num(c[9]); const lg = num(c[10]); const ps = num(c[11]);
  return { cell: c[0], team: c[1], gf, ga, poss: +c[3], pa: +c[4], s10: +c[5], l30: +c[6], succ: +c[7], lzMid: lz1, lzOwn: lz0, trN: tr[0], trAir: tr[1], trOk: tr[2], lgOk: lg[0], lgN: lg[3], posLen: ps[0], cs: +c[12], ow: +c[13], sh: +c[14] };
});
const [A, B] = process.argv.slice(2).map(parse);
const f = (v, d = 2) => (v >= 0 ? '+' : '') + v.toFixed(d);
console.log('| 칸 | 팀 | 득 → | 실 → | 득실차 Δ | 점유 Δ | 패스 Δ | 0~10 Δ%p | 30 m+ Δ%p | 성공 Δ%p | 자기⅓ 상실 Δ | 중간⅓ 상실 Δ | 전환 6초 패스 Δ | 전환 공중 Δ%p | 전환 성공 Δ%p | 30 m+ 수 Δ | 상대진영탈취 Δ | 역습슛 Δ | 슈팅 Δ |');
A.forEach((a, i) => { const b = B[i];
  console.log(`| ${a.cell} | ${a.team} | ${a.gf.toFixed(2)} → ${b.gf.toFixed(2)} | ${a.ga.toFixed(2)} → ${b.ga.toFixed(2)} | ${f((b.gf - b.ga) - (a.gf - a.ga))} | ${f(b.poss - a.poss, 1)} | ${f(b.pa - a.pa, 0)} | ${f(b.s10 - a.s10, 1)} | ${f(b.l30 - a.l30, 1)} | ${f(b.succ - a.succ, 1)} | ${f(b.lzOwn - a.lzOwn, 1)} | ${f(b.lzMid - a.lzMid, 1)} | ${f(b.trN - a.trN, 1)} | ${f(b.trAir - a.trAir, 1)} | ${f(b.trOk - a.trOk, 1)} | ${f(b.lgN - a.lgN, 1)} | ${f(b.ow - a.ow, 1)} | ${f(b.cs - a.cs, 1)} | ${f(b.sh - a.sh, 1)} |`);
});
// 묶음 평균: 비점유(직선·블록) 쪽 득실차 Δ
const np = A.map((a, i) => ({ a, b: B[i] })).filter((x) => x.a.team === 'direct' || x.a.team === 'block' || x.a.team === 'block@0020');
const m = (g) => g.reduce((t, x) => t + ((x.b.gf - x.b.ga) - (x.a.gf - x.a.ga)), 0) / g.length;
console.log(`비점유 팀 득실차 Δ 평균 ${f(m(np))} (직선 ${f(m(np.filter((x) => x.a.team === 'direct')))} · 블록 ${f(m(np.filter((x) => x.a.team !== 'direct')))}) · 득점 Δ ${f(np.reduce((t, x) => t + x.b.gf - x.a.gf, 0) / np.length)} · 실점 Δ ${f(np.reduce((t, x) => t + x.b.ga - x.a.ga, 0) / np.length)}`);
