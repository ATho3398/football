// @ts-nocheck — 진단 스크립트 (엔진관리자17, C.79f 미해결 3 블록 상호작용 탐침)
// A 대 B(동레이팅 75, 4-4-2, 홈/원정 번갈아)를 메인 스레드(상태 읽기만, 지문 불변)로 돌려 양 팀을 기록한다.
//  ⒜ 패스 비행(kind pass/long, 땅볼/공중)을 길이 구간(<12 · 12~22 · 22~35 · 35+ m)과 "상대 골 closeDownZone(25 m) 안 착지" 로 나눠 시도·성공률
//  ⒝ 깊은 블록 가로채기(deepCut): 비행마다 담당 배정됨 · 판정 발생 · 성공 수 (상대가 블록일 때 — 길이 구간별)
//  ⒞ 오픈 플레이 상실: 어디서(자기 ⅓ / 중원 / 상대 ⅓) · 어떻게(패스 실패 · 가로채기 · 몸싸움/드리블 · 기타)
//  ⒟ 슛 · 역습 슛(탈취 뒤 8초) · 점유 · 탈취 뒤 10초 안 슛 · 수비 때 하프라인 위 잔류 인원(틱 표본)
// 실행: npx vite-node scripts/diag/c79f-block.ts -- [경기수=40] A B [seed=81000] [경로=값 …]   (전술 표기 c78s-matrix 와 같다)
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import { attackDir, dist, toNorm, ownGoal } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { TeamSetup, Tendency } from '../../src/engine/types';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 40;
let seed0 = 81000;
const specs: string[] = [];
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else specs.push(a);
}
if (specs.length < 2) { console.log('A B 두 전술을 주세요'); process.exit(1); }
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = v;
}
const tac = (spec: string) => {
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
function build(side: string, seed: number, rating: number, spec: string): TeamSetup {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), rating, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tac(spec) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}

const BINS = ['<12', '12~22', '22~35', '35+'];
const bin = (d: number) => (d < 12 ? 0 : d < 22 ? 1 : d < 35 ? 2 : 3);
interface Side {
  // ⒜ [구간][deep 0/1] 시도·성공
  pa: number[][]; pc: number[][];
  // ⒝ 상대 블록 가로채기 — 내 패스가 당한 것: 배정·판정·성공 [구간]
  cutAssign: number[]; cutJudge: number[]; cutWin: number[];
  // ⒞ 상실 [구역 0 자기⅓ 1 중원 2 상대⅓][종류 0 패스실패 1 가로채기(비행) 2 deepCut 3 몸싸움/드리블 4 기타]
  lost: number[][];
  shots: number; counterShots: number; goals: number; possTicks: number;
  winShot10: number; wins: number;
  stayN: number; stayTicks: number;
  deepPoss: number; // 상대 골 25 m 안에서 소유한 틱
  xg: number; cXg: number; cN: number; cGoal: number; gsLe1: number;
  lineDef: number; lineAtt: number; lineN: number; lineAttHi: number; // 수비 때 내 수비 줄 평균 x(자기 골 기준 정규화) · 공격 때 내 수비 줄 평균 x · 공격 때 내 줄 ≥ 0.4 인 틱 // 슛 xG 합 · 역습 슛(탈취 8초 안) xG 합·수·골 · 골 쪽 수비 ≤ 1 슛 수
}
const mk = (): Side => ({ pa: [[0, 0], [0, 0], [0, 0], [0, 0]], pc: [[0, 0], [0, 0], [0, 0], [0, 0]], cutAssign: [0, 0, 0, 0], cutJudge: [0, 0, 0, 0], cutWin: [0, 0, 0, 0], lost: Array.from({ length: 3 }, () => [0, 0, 0, 0, 0]), shots: 0, counterShots: 0, goals: 0, possTicks: 0, winShot10: 0, wins: 0, stayN: 0, stayTicks: 0, deepPoss: 0, xg: 0, cXg: 0, cN: 0, cGoal: 0, gsLe1: 0, lineDef: 0, lineAtt: 0, lineN: 0, lineAttHi: 0 });
const S: Side[] = [mk(), mk()]; // 0 = A, 1 = B
const CDZ = ENGINE.offball.closeDownZone;

for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const A = build('a', seed, 75, specs[0]!);
  const B = build('b', seed, 75, specs[1]!);
  const aHome = k % 2 === 1;
  const sim = createMatch({ home: aHome ? A : B, away: aHome ? B : A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const aTeam: 0 | 1 = aHome ? 0 : 1;
  const who = (team: 0 | 1): 0 | 1 => (team === aTeam ? 0 : 1);
  probe.shot = (st, p) => {
    const a = st.agents[p.shooter]!;
    const defTeam = (1 - a.team) as 0 | 1;
    const [gx, gy] = ownGoal(attackDir(defTeam, st.half));
    const sd = dist(a.x, a.y, gx, gy);
    let gs = 0;
    for (const o of st.agents) if (o.onPitch && o.team === defTeam && o.line !== 0 && dist(o.x, o.y, gx, gy) < sd - 0.5) gs++;
    const side = S[who(a.team)]!;
    side.xg += p.xg ?? 0;
    if (gs <= 1) side.gsLe1++;
    if (st.possOrigin === 'open' && st.t - st.teams[a.team]!.wonAt <= 8) {
      side.cXg += p.xg ?? 0; side.cN++;
      const sh = { goal: false };
      Object.defineProperty(p, 'outcome', { get() { return sh.goal ? 'goal' : 'onTarget'; }, set(v) { if (v === 'goal') { sh.goal = true; side.cGoal++; } }, configurable: true });
    }
  };
  let lastFl: any = null;
  let cur: { fl: any; team: 0 | 1; b: number; deep: number; assigned: boolean; judged: boolean; cutter: number } | null = null;
  let lastOwner = -1, lastOwnerTeam: 0 | 1 | -1 = -1;
  let lastLossInfo: { type: number } | null = null; // 비행 결과로 잃었을 때 종류
  let pendingLoss: { team: 0 | 1; x: number; y: number; type: number } | null = null;
  const shotsBefore = [0, 0];
  let lastWonT = [-100, -100];
  let wonShotDone = [true, true];
  while (!s.done) {
    const prevOwner = s.ball.owner;
    const prevFl = s.ball.flight;
    const prevCut = s.teams.map((tm) => ({ fl: tm.cutFlight, idx: tm.cutIdx }));
    sim.step();
    const b = s.ball;
    if (s.restart) { lastFl = null; cur = null; lastOwner = -1; lastOwnerTeam = -1; pendingLoss = null; continue; }
    // 비행 시작
    if (b.flight && b.flight !== lastFl) {
      const fl = b.flight;
      if ((fl.kind === 'pass' || fl.kind === 'long') && fl.passer >= 0) {
        const p = s.agents[fl.passer]!;
        const dir = attackDir(p.team, s.half);
        const [gx, gy] = ownGoal(-dir as 1 | -1); // 상대 골
        const len = dist(fl.fromX, fl.fromY, fl.toX, fl.toY);
        const deep = dist(fl.toX, fl.toY, gx, gy) < CDZ ? 1 : 0;
        cur = { fl, team: p.team, b: bin(len), deep, assigned: false, judged: false, cutter: -1 };
        S[who(p.team)]!.pa[cur.b]![deep]!++;
      } else cur = null;
      lastFl = fl;
    }
    // deepCut 배정·판정 (상대 팀 상태)
    if (cur && cur.fl === lastFl) {
      const opp = s.teams[1 - cur.team]!;
      if (opp.cutFlight === cur.fl && opp.cutIdx >= 0 && !cur.assigned) { cur.assigned = true; cur.cutter = opp.cutIdx; S[who(cur.team)]!.cutAssign[cur.b]!++; }
      if (cur.assigned && !cur.judged && opp.cutFlight === cur.fl && opp.cutIdx < 0) {
        cur.judged = true; S[who(cur.team)]!.cutJudge[cur.b]!++;
        if (b.owner === cur.cutter && !b.flight) { S[who(cur.team)]!.cutWin[cur.b]!++; lastLossInfo = { type: 2 }; }
      }
    }
    // 비행 종료 → 결과
    if (cur && b.flight !== cur.fl) {
      const fl = cur.fl;
      if (b.owner >= 0 && s.agents[b.owner]!.team === cur.team) S[who(cur.team)]!.pc[cur.b]![cur.deep]!++;
      else if (!lastLossInfo) lastLossInfo = { type: fl.outcome === 'intercept' || (b.owner >= 0 && s.agents[b.owner]!.team !== cur.team) ? 1 : 0 };
      cur = null;
    }
    // 소유 전환 (⒞)
    if (b.owner >= 0) {
      const o = s.agents[b.owner]!;
      if (lastOwnerTeam >= 0 && o.team !== lastOwnerTeam) {
        const lt = lastOwnerTeam as 0 | 1;
        const lo = s.agents[lastOwner]!;
        const dirL = attackDir(lt, s.half);
        const nx = toNorm(lo.x, lo.y, dirL)[0];
        const zone = nx < 1 / 3 ? 0 : nx < 2 / 3 ? 1 : 2;
        let type = 4;
        if (lastLossInfo) type = lastLossInfo.type; else if (!prevFl && prevOwner === lastOwner) type = 3;
        S[who(lt)]!.lost[zone]![type]!++;
        S[who(o.team)]!.wins++;
        lastWonT[o.team] = s.t; wonShotDone[o.team] = false;
        lastLossInfo = null;
      } else if (o.team === lastOwnerTeam) lastLossInfo = null;
      lastOwner = b.owner; lastOwnerTeam = o.team;
      // 상대 골 25 m 안 소유
      const dirO = attackDir(o.team, s.half);
      const [gx, gy] = ownGoal(-dirO as 1 | -1);
      if (dist(b.x, b.y, gx, gy) < CDZ) S[who(o.team)]!.deepPoss++;
      // 수비 팀 잔류 인원 (틱 표본): 수비 팀 선수 중 자기 기준 x ≥ 0.5 (하프라인 위)
      const dt = (1 - o.team) as 0 | 1;
      const dirD = attackDir(dt, s.half);
      let stay = 0;
      for (const q of s.agents) if (q.onPitch && q.team === dt && q.line !== 0 && toNorm(q.x, q.y, dirD)[0] >= 0.5) stay++;
      S[who(dt)]!.stayN += stay; S[who(dt)]!.stayTicks++;
      // 수비 줄 높이 (틱 표본): 양 팀 줄 1 평균 x (자기 골 기준 정규화)
      for (const t of [0, 1] as const) {
        let sx = 0, cnt = 0;
        const dirT = attackDir(t, s.half);
        for (const q of s.agents) if (q.onPitch && q.team === t && q.line === 1) { sx += toNorm(q.x, q.y, dirT)[0]; cnt++; }
        if (!cnt) continue;
        const mx = sx / cnt;
        if (t === dt) { S[who(t)]!.lineDef += mx; }
        else { S[who(t)]!.lineAtt += mx; if (mx >= 0.4) S[who(t)]!.lineAttHi++; S[who(t)]!.lineN++; }
      }
    }
    // 슛 (팀 기록 차분)
    for (const t of [0, 1] as const) {
      const sh = s.teams[t]!.stats.shots;
      if (sh > shotsBefore[t]!) {
        shotsBefore[t] = sh;
        if (!wonShotDone[t] && s.t - lastWonT[t]! <= 10) { S[who(t)]!.winShot10++; wonShotDone[t] = true; }
      }
    }
  }
  for (const t of [0, 1] as const) {
    const st = s.teams[t]!.stats;
    const side = S[who(t)]!;
    side.shots += st.shots; side.counterShots += st.counterShots; side.goals += st.goals; side.possTicks += st.possessionTicks;
  }
}

const f1 = (v: number) => (v / n).toFixed(1);
const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(0) : '-');
console.log(`\n${specs[0]} 대 ${specs[1]} ${n}경기 (시드 ${seed0}~), 덮어쓰기 ${JSON.stringify(overrides)}`);
for (const i of [0, 1] as const) {
  const x = S[i]!;
  const tot = x.possTicks + S[1 - i]!.possTicks;
  console.log(`\n[${specs[i]}] 득점 ${f1(x.goals)} 슛 ${f1(x.shots)} 역습슛 ${f1(x.counterShots)} 탈취 ${f1(x.wins)} 탈취→10초 슛 ${f1(x.winShot10)}(${pct(x.winShot10, x.wins)}%) 점유 ${pct(x.possTicks, tot)}% 상대골25m안 소유 ${(x.deepPoss / 10 / n).toFixed(0)}초/경기 수비 때 하프라인 위 잔류 ${(x.stayN / Math.max(1, x.stayTicks)).toFixed(2)}명 | xG ${f1(x.xg)} 골쪽수비≤1 슛 ${f1(x.gsLe1)} 탈취8초 슛 ${f1(x.cN)} xG ${(x.cN ? x.cXg / x.cN : 0).toFixed(3)} 골 ${f1(x.cGoal)} | 수비 줄 x: 수비 때 ${(x.lineDef / Math.max(1, x.stayTicks)).toFixed(3)} 공격 때 ${(x.lineAtt / Math.max(1, x.lineN)).toFixed(3)} (≥0.4 ${pct(x.lineAttHi, x.lineN)}%)`);
  console.log(`  패스 구간 | 전체 시도·성공% | 상대 25 m 안 착지 시도·성공% | 블록 가로채기 배정/판정/성공`);
  for (let bi = 0; bi < 4; bi++) {
    console.log(`  ${BINS[bi]!.padEnd(6)} | ${f1(x.pa[bi]![0]! + x.pa[bi]![1]!).padStart(5)} ${pct(x.pc[bi]![0]! + x.pc[bi]![1]!, x.pa[bi]![0]! + x.pa[bi]![1]!).padStart(3)}% | ${f1(x.pa[bi]![1]!).padStart(5)} ${pct(x.pc[bi]![1]!, x.pa[bi]![1]!).padStart(3)}% | ${f1(x.cutAssign[bi]!)} / ${f1(x.cutJudge[bi]!)} / ${f1(x.cutWin[bi]!)}`);
  }
  const Z = ['자기⅓', '중원', '상대⅓'];
  const T = ['패스실패', '가로채기', 'deepCut', '몸싸움·드리블', '기타'];
  console.log(`  상실/경기: ${Z.map((z, zi) => `${z} ${f1(x.lost[zi]!.reduce((a, b) => a + b, 0))} (${T.map((t, ti) => `${t} ${f1(x.lost[zi]![ti]!)}`).join(' · ')})`).join(' | ')}`);
}
process.exit(0);
