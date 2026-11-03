// 진단 (C.80r, 사용자 11/04 "CAM 이나 WF 가 깊숙이 안 들어가는 거 아님?"): role-pair ST 와 같은 조건(4-3-3 슬롯 9 역할만 바꿈, 균형, 75 대 75)에서
// "9번이 내려온 순간"(우리 공·공이 상대 진영·ST 가 오프사이드 라인보다 roles.nineDeepGap m 이상 뒤로 새로 들어감) 뒤 5초 동안
// 2선(CM·CAM·윙)이 박스·박스 중앙(골 앞 ±10 m)에 들어가는 비율·첫 도착 시간·박스 안 수신·슛·골을 센다. 비교로 최종 ⅓ 1초 표본의 박스 인원도.
// 실행: npx vite-node scripts/diag/c80r-vacate.ts -- [경기수=200] [역할=falseNine] [경로=값 ...]   (SEED=47000)
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { offsideLine } from '../../src/engine/offball';
import { attackDir, toNorm, L, W } from '../../src/engine/pitch';
import { applyOverrides, buildTeam } from '../engine/job';
import { std } from '../engine/suite';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const pos: string[] = [];
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else pos.push(a);
}
applyOverrides(overrides);
const N = Number(pos[0] ?? 200);
const ROLE = pos[1] ?? 'falseNine';
const SEED = Number(process.env.SEED ?? 47000);
const WIN = 5;
const CENTER = 10;
const grp = (p: string) => (p === 'ST' || p === 'CF' ? 'ST' : p === 'LW' || p === 'RW' || p === 'LM' || p === 'RM' ? 'WING' : p === 'CM' || p === 'CAM' ? 'MID' : 'X');

const acc = {
  games: 0, gf: 0, ga: 0, events: 0, anyBox: 0, anyCenter: 0, firstCenterT: 0, firstCenterN: 0,
  enterBox: { WING: 0, MID: 0 } as Record<string, number>, enterCenter: { WING: 0, MID: 0 } as Record<string, number>,
  boxRecv: { ST: 0, WING: 0, MID: 0, X: 0 } as Record<string, number>, shots: { ST: 0, WING: 0, MID: 0, X: 0 } as Record<string, number>,
  goals: 0, stBack: 0, f3: 0, f3Box: 0, f3Center: 0, f3StBox: 0, f3L2Center: 0, depthSum: { WING: 0, MID: 0 } as Record<string, number>, depthN: { WING: 0, MID: 0 } as Record<string, number>,
  totShots: { ST: 0, WING: 0, MID: 0, X: 0 } as Record<string, number>,
};

for (let k = 0; k < N; k++) {
  const seed = SEED + k;
  const me = { ...std('a', seed, 75, '4-3-3', 'balanced'), roles: { 9: ROLE } };
  const op = std('b', seed, 75, '4-3-3', 'balanced');
  const homeMe = k % 2 === 0;
  const T = (homeMe ? 0 : 1) as 0 | 1;
  const ws = `w${seed}`;
  const home = buildTeam(homeMe ? me : op, 75, ws);
  const away = buildTeam(homeMe ? op : me, 75, ws);
  const sim = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const prevShots = new Map<number, number>();
  for (const a of s.agents) prevShots.set(a.idx, a.stats.shots);
  let deepWas = false;
  let winEnd = -1;
  let entered = new Set<number>();
  let enteredC = new Set<number>();
  let firstC = false;
  let t0 = 0;
  let prevOwner = -1;
  const goals0 = () => s.teams[T].stats.goals;
  let g0 = 0;
  while (!s.done) {
    if (s.moments.pending) sim.resolve('delegate');
    else sim.step();
    const dir = attackDir(T, s.half);
    const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
    const inWin = s.t < winEnd;
    const box = (x: number, y: number) => { const [nx, ny] = toNorm(x, y, dir); return (1 - nx) * L <= ENGINE.pitch.boxDepth && Math.abs(ny - 0.5) * W <= ENGINE.pitch.boxWidth / 2; };
    const center = (x: number, y: number) => { const [nx, ny] = toNorm(x, y, dir); return (1 - nx) * L <= ENGINE.pitch.boxDepth && Math.abs(ny - 0.5) * W <= CENTER; };
    // 슛
    for (const a of s.agents) {
      const sh = a.stats.shots;
      if (sh > prevShots.get(a.idx)!) {
        prevShots.set(a.idx, sh);
        if (a.team === T) { acc.totShots[grp(a.pos)]!++; if (inWin) acc.shots[grp(a.pos)]!++; }
      }
    }
    // 박스 안 수신
    if (owner && owner.idx !== prevOwner && owner.team === T && inWin && box(owner.x, owner.y)) acc.boxRecv[grp(owner.pos)]!++;
    prevOwner = owner ? owner.idx : -1;
    if (inWin) {
      for (const a of s.agents) {
        if (!a.onPitch || a.team !== T) continue;
        const g = grp(a.pos);
        if (g === 'ST') { if (box(a.x, a.y)) acc.stBack++; continue; }
        if (g === 'X') continue;
        if (!entered.has(a.idx) && box(a.x, a.y)) { entered.add(a.idx); acc.enterBox[g]!++; }
        if (!enteredC.has(a.idx) && center(a.x, a.y)) {
          enteredC.add(a.idx); acc.enterCenter[g]!++;
          if (!firstC) { firstC = true; acc.firstCenterT += s.t - t0; acc.firstCenterN++; }
        }
      }
      if (s.t + 0.05 >= winEnd) {
        if (entered.size) acc.anyBox++;
        if (enteredC.size) acc.anyCenter++;
        acc.goals += goals0() - g0;
      }
    }
    if (s.tick % 10 !== 0) continue;
    // 1초 표본: 9번 내려옴 여부, 최종 ⅓ 박스 인원
    const mine = owner && owner.team === T && !s.restart;
    let deep = false;
    if (mine) {
      const st = s.agents.find((a) => a.onPitch && a.team === T && (a.pos === 'ST' || a.pos === 'CF'));
      const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
      if (st && bnx >= 0.5) {
        const [sx] = toNorm(st.x, st.y, dir);
        deep = (offsideLine(s, T) - sx) * L >= ENGINE.roles.nineDeepGap;
      }
      if (bnx >= ENGINE.offball.lateRunFromX) {
        acc.f3++;
        let b = 0, c = 0;
        for (const a of s.agents) {
          if (!a.onPitch || a.team !== T || a === owner) continue;
          const g = grp(a.pos);
          if (g === 'X') continue;
          if (box(a.x, a.y)) { b++; if (g === 'ST') acc.f3StBox++; }
          if (center(a.x, a.y)) { c++; if (g !== 'ST') acc.f3L2Center++; }
          if (g !== 'ST') { const [nx] = toNorm(a.x, a.y, dir); acc.depthSum[g]! += (1 - nx) * L; acc.depthN[g]!++; }
        }
        acc.f3Box += b; acc.f3Center += c;
      }
    }
    if (deep && !deepWas && s.t >= winEnd) {
      acc.events++;
      winEnd = s.t + WIN;
      t0 = s.t;
      g0 = goals0();
      entered = new Set();
      enteredC = new Set();
      firstC = false;
      // 이미 박스에 있던 2선은 "도착"으로 세지 않는다
      for (const a of s.agents) if (a.onPitch && a.team === T && grp(a.pos) !== 'ST' && box(a.x, a.y)) { entered.add(a.idx); }
      for (const a of s.agents) if (a.onPitch && a.team === T && grp(a.pos) !== 'ST' && center(a.x, a.y)) enteredC.add(a.idx);
    }
    deepWas = deep;
  }
  acc.games++;
  acc.gf += s.teams[T].stats.goals;
  acc.ga += s.teams[1 - T as 0 | 1].stats.goals;
}

const n = acc.games, e = Math.max(1, acc.events);
const f = (x: number, d = 2) => x.toFixed(d);
console.log(`역할 ${ROLE} · ${n}경기 · SEED ${SEED} · 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log(`득 ${f(acc.gf / n)} 실 ${f(acc.ga / n)} 득실 ${f((acc.gf - acc.ga) / n)} · 슛/경기 ST ${f(acc.totShots.ST! / n)} 윙 ${f(acc.totShots.WING! / n)} 미드 ${f(acc.totShots.MID! / n)} 기타 ${f(acc.totShots.X! / n)}`);
console.log(`9번 내려옴 ${f(acc.events / n, 1)}회/경기 · 5초 안 2선 박스 도착 ${f((100 * acc.anyBox) / e, 1)}% · 박스 중앙(±${CENTER} m) 도착 ${f((100 * acc.anyCenter) / e, 1)}% · 첫 중앙 도착 ${f(acc.firstCenterT / Math.max(1, acc.firstCenterN), 2)}초`);
console.log(`  도착 인원/회: 박스 윙 ${f(acc.enterBox.WING! / e, 3)} 미드 ${f(acc.enterBox.MID! / e, 3)} · 중앙 윙 ${f(acc.enterCenter.WING! / e, 3)} 미드 ${f(acc.enterCenter.MID! / e, 3)} · ST 박스 복귀 표본비 ${f(acc.stBack / e / (WIN * 10), 3)}`);
console.log(`  5초 안 박스 수신/회: ST ${f(acc.boxRecv.ST! / e, 3)} 윙 ${f(acc.boxRecv.WING! / e, 3)} 미드 ${f(acc.boxRecv.MID! / e, 3)} · 슛/회: ST ${f(acc.shots.ST! / e, 3)} 윙 ${f(acc.shots.WING! / e, 3)} 미드 ${f(acc.shots.MID! / e, 3)} · 골/회 ${f(acc.goals / e, 3)}`);
const F = Math.max(1, acc.f3);
console.log(`최종 ⅓ 표본 ${f(acc.f3 / n, 0)}/경기 · 박스 인원 ${f(acc.f3Box / F)} · 중앙 인원 ${f(acc.f3Center / F)} (2선 ${f(acc.f3L2Center / F)}) · ST 박스 ${f((100 * acc.f3StBox) / F, 1)}% · 2선 골까지 깊이 윙 ${f(acc.depthSum.WING! / Math.max(1, acc.depthN.WING!), 1)} m 미드 ${f(acc.depthSum.MID! / Math.max(1, acc.depthN.MID!), 1)} m`);
process.exit(0);
