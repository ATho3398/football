// @ts-nocheck — 진단 스크립트 (C.82b): 코너 고리별 비율 — 킥(짧은/긴) → 낙하 지점 → GK 잡기/공중 경합/무경합 → 공격 첫 접촉 → 헤더 슛 → 유효 → 골,
// 그리고 코너 소유 15초 안 2차 슈팅·골(shotPath 2). 엔진 상태는 읽기만. 표준 경기(4-2-3-1 균형 75:75, 홈·원정 짝).
// 실행: npx vite-node scripts/diag/c82b-corner.ts -- [경기수=200] [seed=41000] [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { createMatch } from '../../src/engine/sim';
import { attackDir, toNorm, L, W, inOppBox } from '../../src/engine/pitch';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ov: Record<string, number> = {};
let n = 200, seed0 = 41000;
for (const a of args) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.includes('=')) { const [k, v] = a.split('='); ov[k] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
const restore = applyOverrides(ov);
const grpOf = (p: string) => (p === 'ST' || p === 'CF' ? 'ST' : ['LW', 'RW', 'LM', 'RM'].includes(p) ? 'W' : ['CM', 'CAM', 'CDM'].includes(p) ? 'MID' : p === 'CB' ? 'CB' : 'FB');
const R: any = {
  matches: 0, goals: 0, corners: 0, taken: 0, short: 0, long: 0,
  land: { box6: 0, pen: 0, edge: 0, out: 0 }, // 6 m 박스 / 6~11 m / 11~16.5 m (박스 안) / 박스 밖
  end: { claim: 0, contest: 0, attOnly: 0, defOnly: 0, nobody: 0, foul: 0, outPlay: 0, other: 0 },
  contestAttWin: 0, attFirst: 0, defFirst: 0,
  hdrShot: 0, hdrOn: 0, hdrGoal: 0, hdrBlock: 0, hdrSave: 0,
  attFirstNoShot: 0, // 공격이 이겼는데 헤더 아님(박스 밖/거리)
  hdrXg: 0,
  sp2Shots: 0, sp2Goals: 0, // shotPath 2 전체 (헤더 포함)
  cbInBox: 0, attInBox: 0, defInBox: 0, boxN: 0,
  winnerGrp: {}, scorerGrp: {}, shooterGrp: {},
  goalGrp: {}, goalsTot: 0, gPath: {}, gPos: {},
  hdrD: [0, 0, 0, 0], hdrDGoal: [0, 0, 0, 0], // 헤더 거리 <6, 6-9, 9-12, 12+
};
const inc = (o, k) => (o[k] = (o[k] ?? 0) + 1);
for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / 2); const flip = k % 2 === 1;
  const A = { id: `v${flip ? 'b' : 'a'}${seed}`, rating: 75, seed: `eng-${flip ? 'b' : 'a'}-75-${seed}`, formation: '4-2-3-1', tactics: 'balanced' };
  const B = { id: `v${flip ? 'a' : 'b'}${seed}`, rating: 75, seed: `eng-${flip ? 'a' : 'b'}-75-${seed}`, formation: '4-2-3-1', tactics: 'balanced' };
  const ws = `w${seed}`;
  const sim = createMatch({ home: buildTeam(A, 75, ws), away: buildTeam(B, 75, ws), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  let tr: any = null;
  while (!s.done) {
    const wasCorner = s.restart && s.restart.type === 'corner' ? s.restart : null;
    const evLen = s.events.length;
    const aer = s.teams[0].stats.aerials;
    const won = s.agents.map((a) => a.stats.aerialsWon);
    const sp2 = [s.teams[0].stats.shotPaths[2], s.teams[1].stats.shotPaths[2]];
    const gp2 = [s.teams[0].stats.goalPaths[2], s.teams[1].stats.goalPaths[2]];
    sim.step();
    for (const tm of [0, 1]) {
      R.sp2Shots += s.teams[tm].stats.shotPaths[2] - sp2[tm];
      R.sp2Goals += s.teams[tm].stats.goalPaths[2] - gp2[tm];
    }
    for (let i = evLen; i < s.events.length; i++) {
      const e = s.events[i];
      if (e.type === 'goal') {
        const sc = s.agents.find((a) => a.id === e.players[0]);
        R.goalsTot++; if (sc) { inc(R.goalGrp, grpOf(sc.pos)); inc(R.gPath, grpOf(sc.pos) + ':' + sc.shotPath); inc(R.gPos, sc.pos); }
        if (sc && sc.shotPath === 2) inc(R.scorerGrp, grpOf(sc.pos));
      }
    }
    if (wasCorner && !s.restart) {
      R.taken++;
      const att = wasCorner.team;
      const fl = s.ball.flight;
      if (fl && fl.kind === 'cross' && fl.fromCross) {
        R.long++;
        const dir = attackDir(att, s.half);
        const [nx, ny] = toNorm(fl.toX, fl.toY, dir);
        const gl = (1 - nx) * L; const off = Math.abs(ny - 0.5) * W;
        const z = !inOppBox(fl.toX, fl.toY, dir) ? 'out' : gl < 5.5 && off < 9.16 ? 'box6' : gl < 11 ? 'pen' : 'edge';
        R.land[z]++;
        let a = 0, d = 0, cb = 0;
        for (const p of s.agents) if (p.onPitch && p.line !== 0 && inOppBox(p.x, p.y, dir)) { if (p.team === att) { a++; if (p.pos === 'CB') cb++; } else d++; }
        R.attInBox += a; R.defInBox += d; R.cbInBox += cb; R.boxN++;
        tr = { fl, att, dir };
      } else R.short++;
    }
    if (tr && s.ball.flight !== tr.fl) {
      const att = tr.att;
      const evs = s.events.slice(evLen);
      const shot = evs.find((e) => e.type === 'shot' && e.team === att);
      const foul = evs.find((e) => e.type === 'foul');
      const contest = s.teams[0].stats.aerials > aer;
      let winner = null;
      for (const p of s.agents) if (p.stats.aerialsWon > won[p.idx]) winner = p;
      const gk = s.ball.owner >= 0 && s.agents[s.ball.owner].line === 0 && s.agents[s.ball.owner].team !== att;
      if (foul) R.end.foul++;
      else if (gk) R.end.claim++;
      else if (contest) { R.end.contest++; if (winner && winner.team === att) R.contestAttWin++; }
      else if (shot || (s.ball.owner >= 0 && s.agents[s.ball.owner].team === att)) R.end.attOnly++;
      else if (s.ball.owner >= 0 || (s.ball.flight && s.ball.flight.kind === 'clear')) R.end.defOnly++;
      else if (s.restart) R.end.outPlay++;
      else R.end.nobody++;
      const attWon = shot || (winner && winner.team === att) || (!contest && !gk && s.ball.owner >= 0 && s.agents[s.ball.owner].team === att);
      if (attWon) R.attFirst++; else if (!foul) R.defFirst++;
      if (winner) inc(R.winnerGrp, (winner.team === att ? 'A:' : 'D:') + grpOf(winner.pos));
      if (shot) {
        R.hdrShot++;
        const sh = s.agents.find((a) => a.id === shot.players[0]);
        if (sh) inc(R.shooterGrp, grpOf(sh.pos));
        const dd = shot.params?.d ?? 0; const bi = dd < 6 ? 0 : dd < 9 ? 1 : dd < 12 ? 2 : 3; R.hdrD[bi]++;
        R.hdrXg += shot.params?.xg ?? 0;
        if (shot.params?.onTarget) R.hdrOn++;
        if (evs.find((e) => e.type === 'block')) R.hdrBlock++;
        tr.shotBin = bi; tr.shotT = s.t; tr.watch = true;
      } else if (attWon) R.attFirstNoShot++;
      const keep = tr.watch ? tr : null; tr = null;
      if (keep) R._w = keep;
    }
    // 헤더 슛 → 골/선방 (슛 비행이 끝날 때까지 최대 3초)
    if (R._w) {
      const w = R._w;
      for (const e of s.events.slice(evLen)) {
        if (e.type === 'goal' && e.team === w.att) { R.hdrGoal++; R.hdrDGoal[w.shotBin]++; R._w = null; break; }
        if (e.type === 'save' && e.team !== w.att) { R.hdrSave++; R._w = null; break; }
      }
      if (R._w && s.t - w.shotT > 3) R._w = null;
    }
  }
  for (const tm of [0, 1]) R.corners += s.teams[tm].stats.corners;
  R.matches++;
}
restore();
const p = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '-');
const L2 = R.long;
console.log(`경기 ${R.matches} · 코너(통계) ${R.corners} (팀당 ${(R.corners / R.matches / 2).toFixed(2)}) · 실행 ${R.taken} · 짧은 ${p(R.short, R.taken)}% · 긴 ${L2}`);
console.log(`낙하 지점 % (6m박스 / 6~11m / 11~16.5m / 박스 밖): ${p(R.land.box6, L2)} / ${p(R.land.pen, L2)} / ${p(R.land.edge, L2)} / ${p(R.land.out, L2)}`);
console.log(`킥 순간 박스 안 공격 ${(R.attInBox / R.boxN).toFixed(2)} (CB ${(R.cbInBox / R.boxN).toFixed(2)}) · 수비 ${(R.defInBox / R.boxN).toFixed(2)}`);
console.log(`낙하 결과 % (GK 잡기 / 경합 / 공격만 / 수비만 / 아무도 / 파울 / 라인 밖): ${['claim', 'contest', 'attOnly', 'defOnly', 'nobody', 'foul', 'outPlay'].map((k) => p(R.end[k], L2)).join(' / ')}`);
console.log(`경합 공격 승 ${p(R.contestAttWin, R.end.contest)}% · 첫 접촉 공격 ${p(R.attFirst, L2)}% · 공격 이겼지만 헤더 아님 ${R.attFirstNoShot}`);
console.log(`헤더 슛 ${R.hdrShot} (긴 코너당 ${p(R.hdrShot, L2)}%) · 유효 ${p(R.hdrOn, R.hdrShot)}% · 블록 ${p(R.hdrBlock, R.hdrShot)}% · 골 ${R.hdrGoal} (슛당 ${p(R.hdrGoal, R.hdrShot)}% · 유효당 ${p(R.hdrGoal, R.hdrOn)}%) · 평균 xG ${(R.hdrXg / Math.max(1, R.hdrShot)).toFixed(3)}`);
console.log(`헤더 거리 (<6/6-9/9-12/12+): 슛 ${R.hdrD.join(' / ')} · 골 ${R.hdrDGoal.join(' / ')}`);
console.log(`코너 경로(15초) 슈팅 ${R.sp2Shots} · 골 ${R.sp2Goals} → 코너 ${(R.corners / Math.max(1, R.sp2Goals)).toFixed(1)}개당 1골 · 코너당 슈팅 ${(R.sp2Shots / R.corners).toFixed(2)}`);
console.log(`경합 승자: ${JSON.stringify(R.winnerGrp)}`);
console.log(`헤더 슈터: ${JSON.stringify(R.shooterGrp)} · 코너 골 득점자: ${JSON.stringify(R.scorerGrp)}`);
const gt = R.goalsTot; console.log(`전체 골 ${gt} (팀당 ${(gt / R.matches / 2).toFixed(2)}) 득점 비율 %: ${Object.entries(R.goalGrp).map(([k, v]) => `${k} ${p(v, gt)}`).join(' · ')}`);
console.log(`골 군:경로(0패스/1돌파/2코너/3프리킥/4PK/5리바/6그밖): ${Object.entries(R.gPath).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`골 포지션: ${JSON.stringify(R.gPos)}`);
process.exit(0);
