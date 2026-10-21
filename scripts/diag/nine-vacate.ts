// 진단 (엔진 관리자 8대, 미해결 4 펄스 나인 재진단): 홈 4-3-3 슬롯 9(ST) 역할만 바꿔(기본 falseNine 대 poacher) 최종 3분의 1 공격 때
// "박스에 누가 있는가"(공격 인원·ST 깊이·2선 러너)와 "상대 CB 가 내려온 9번을 따라 나오는가"를 1초마다 세고, 홈 슛을 포지션군·거리로 나눈다. 엔진 무수정.
// 실행: npx vite-node scripts/diag/nine-vacate.ts -- [경기수=40] [역할1=falseNine] [역할2=poacher] [포메이션=4-3-3] [경로=값 ...]
import { ENGINE, ENGINE_VERSION } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { offsideLine } from '../../src/engine/offball';
import { tacticsOf } from '../../src/engine/tactics';
import { attackDir, dist, ownGoal, toNorm, L } from '../../src/engine/pitch';
import type { TeamSetup } from '../../src/engine/types';
import { FORMATION_SLOTS, type Formation } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 40);
const ROLES = [args[1] ?? 'falseNine', args[2] ?? 'poacher'];
const FORMATION = (args[3] ?? '4-3-3') as Formation;
const SLOT = 9;

const mk = (side: string, i: number, role: string | null): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagN-${side}-${i}`, 2018, []);
  r.formation = FORMATION;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wN${i}`);
  s.tactics = tacticsOf('balanced');
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  if (role) { const p = s.lineup.find((x) => x.slot === SLOT); if (p) p.role = role; }
  // PAIR=1: 짝 조건(사용자 13:18) — 윙 둘 다 윙 포워드(run 0.8) + CM 한 명 박스투박스(run 0.6). 4-3-3 슬롯 8·10 윙, 6 CM
  if (role && process.env.PAIR === '1') for (const [sl, rid] of [[8, 'wingForward'], [10, 'wingForward'], [6, 'boxToBox']] as const) { const p = s.lineup.find((x) => x.slot === sl); if (p) p.role = rid; }
  return s;
};

interface Acc {
  games: number; samples: number; boxN: number[]; near20: number; stGoal: number; stBehind: number; stInBox: number; stNear20: number;
  cbDist: number; cbWithin3: number; cbStepOut: number; cbStepOutN: number; l2In20: number; wingIn20: number;
  shots: number; goals: number; byGroup: Record<string, { shots: number; goals: number; inBox: number; dsum: number }>;
  oppShots: number; oppGoals: number; counterShots: number; f3Samples: number; possF3: number; stTouches: number; stDeepTouches: number;
}
const mkAcc = (): Acc => ({ games: 0, samples: 0, boxN: [0, 0, 0, 0], near20: 0, stGoal: 0, stBehind: 0, stInBox: 0, stNear20: 0, cbDist: 0, cbWithin3: 0, cbStepOut: 0, cbStepOutN: 0, l2In20: 0, wingIn20: 0, shots: 0, goals: 0, byGroup: {}, oppShots: 0, oppGoals: 0, counterShots: 0, f3Samples: 0, possF3: 0, stTouches: 0, stDeepTouches: 0 });
const grp = (pos: string) => (pos === 'ST' || pos === 'CF' ? 'ST' : pos === 'LW' || pos === 'RW' || pos === 'LM' || pos === 'RM' ? 'WING' : pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB' ? 'DEF' : 'MID');

function analyze(home: TeamSetup, away: TeamSetup, seed: number, acc: Acc): void {
  const m = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state;
  const shotsPrev = new Map(s.agents.map((a) => [a, a.stats.shots]));
  const goalsPrev = new Map(s.agents.map((a) => [a, a.stats.goals]));
  const lastShot = new Map<number, string>();
  let prevOwner = -1;
  while (!s.done) {
    m.step();
    const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
    const dirH = attackDir(0, s.half);
    const [gx, gy] = ownGoal((-dirH) as 1 | -1); // 상대 골
    for (const a of s.agents) {
      const sh = a.stats.shots, gl = a.stats.goals;
      if (sh > shotsPrev.get(a)!) {
        shotsPrev.set(a, sh);
        if (a.team === 0) {
          acc.shots++;
          const g = grp(a.pos);
          const v = (acc.byGroup[g] ??= { shots: 0, goals: 0, inBox: 0, dsum: 0 });
          const d = dist(a.x, a.y, gx, gy);
          v.shots++; v.dsum += d;
          if (Math.abs(a.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(a.y - gy) <= ENGINE.pitch.boxWidth / 2) v.inBox++;
          if (s.t - s.possSince < 8) acc.counterShots++;
          lastShot.set(a.idx, g);
        } else acc.oppShots++;
      }
      if (gl > goalsPrev.get(a)!) {
        goalsPrev.set(a, gl);
        if (a.team === 0) { acc.goals++; const g = lastShot.get(a.idx); if (g) acc.byGroup[g]!.goals++; } else acc.oppGoals++;
      }
    }
    if (owner && owner.idx !== prevOwner && owner.team === 0 && (owner.pos === 'ST' || owner.pos === 'CF')) {
      acc.stTouches++;
      if (dist(owner.x, owner.y, gx, gy) > 25) acc.stDeepTouches++;
    }
    prevOwner = owner ? owner.idx : -1;
    if (s.tick % 10 !== 0 || s.restart || !owner || owner.team !== 0 || owner.line === 0) continue;
    const [bnx] = toNorm(s.ball.x, s.ball.y, dirH);
    acc.samples++;
    if (bnx < ENGINE.offball.lateRunFromX) continue;
    acc.f3Samples++;
    const line = offsideLine(s, 0);
    let box = 0, near20 = 0, l2 = 0, wing = 0;
    for (const a of s.agents) {
      if (!a.onPitch || a.team !== 0 || a === owner || a.line < 2) continue;
      const d = dist(a.x, a.y, gx, gy);
      const inBox = Math.abs(a.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(a.y - gy) <= ENGINE.pitch.boxWidth / 2;
      if (inBox) box++;
      if (d <= 20) { near20++; if (a.line === 2) l2++; if (a.pos === 'LW' || a.pos === 'RW') wing++; }
      if (a.pos === 'ST' || a.pos === 'CF') {
        acc.stGoal += d;
        acc.stBehind += (line - toNorm(a.x, a.y, dirH)[0]) * L;
        if (inBox) acc.stInBox++;
        if (d <= 20) acc.stNear20++;
        // 상대 CB
        let cb: typeof a | null = null; let bd = Infinity;
        let lineSum = 0, lineN = 0;
        for (const o of s.agents) {
          if (!o.onPitch || o.team !== 1 || o.line !== 1) continue;
          lineSum += toNorm(o.x, o.y, dirH)[0]; lineN++;
          if (o.pos !== 'CB') continue;
          const dd = dist(o.x, o.y, a.x, a.y);
          if (dd < bd) { bd = dd; cb = o; }
        }
        if (cb) {
          acc.cbDist += bd;
          if (bd <= 3) acc.cbWithin3++;
          if (lineN) {
            // 홈 공격 방향 정규화에서 상대 수비 줄 평균 x 보다 CB 가 작으면(우리 쪽으로) 줄 앞으로 나온 것
            const lineX = lineSum / lineN;
            const out = (lineX - toNorm(cb.x, cb.y, dirH)[0]) * L;
            if (out > 2) { acc.cbStepOut += out; acc.cbStepOutN++; }
          }
        }
      }
    }
    acc.boxN[Math.min(3, box)]!++;
    acc.near20 += near20; acc.l2In20 += l2; acc.wingIn20 += wing;
  }
  acc.games++;
}

const accs = ROLES.map(() => mkAcc());
for (let i = 0; i < N; i++) {
  ROLES.forEach((role, k) => analyze(mk('H', i, role), mk('A', i, null), 91000 + i, accs[k]!));
}
const f = (x: number, k = 2) => (Number.isFinite(x) ? x.toFixed(k) : '-');
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}%` : '-');
console.log(`nine-vacate · ${N}경기 ${FORMATION} 홈 슬롯 ${SLOT} 역할 ${ROLES.join(' / ')} 대 원정 균형 (엔진 ${ENGINE_VERSION})${process.env.PAIR === '1' ? ' · 짝 조건(윙 포워드 ×2 + 박스투박스)' : ''}`);
ROLES.forEach((role, k) => {
  const a = accs[k]!;
  const F = a.f3Samples || 1;
  console.log(`\n[${role}] 홈 득점 ${f(a.goals / a.games)} · 실점 ${f(a.oppGoals / a.games)} · 홈 슛 ${f(a.shots / a.games, 1)}(역습 8초 안 ${f(a.counterShots / a.games, 2)}) · 상대 슛 ${f(a.oppShots / a.games, 1)} · 최종 3분의 1 소유 표본 ${pct(a.f3Samples, a.samples)}`);
  console.log(`  최종 3분의 1 공격 때(1초 표본 ${a.f3Samples}): 박스 안 공격 인원 0/1/2/3+ = ${a.boxN.map((v) => pct(v, F)).join(' / ')} · 골 20 m 안 인원 ${f(a.near20 / F)}(줄 2 ${f(a.l2In20 / F)} · 윙 ${f(a.wingIn20 / F)})`);
  console.log(`  ST: 골 거리 ${f(a.stGoal / F, 1)} m · 오프사이드 라인 뒤 ${f(a.stBehind / F, 1)} m · 박스 안 ${pct(a.stInBox, F)} · 20 m 안 ${pct(a.stNear20, F)} · ST 터치 ${f(a.stTouches / a.games, 1)}(골 25 m 밖 ${pct(a.stDeepTouches, a.stTouches)})`);
  console.log(`  상대 CB ↔ ST: 가장 가까운 CB ${f(a.cbDist / F, 1)} m · 3 m 안 ${pct(a.cbWithin3, F)} · CB 가 수비 줄보다 2 m+ 앞으로 나와 있음 ${pct(a.cbStepOutN, F)}(평균 ${f(a.cbStepOut / (a.cbStepOutN || 1), 1)} m)`);
  const g = a.byGroup;
  console.log(`  홈 슛 포지션군: ${['ST', 'WING', 'MID', 'DEF'].map((k2) => { const v = g[k2]; return v ? `${k2} ${f(v.shots / a.games)}/${f(v.goals / a.games)} (박스 안 ${pct(v.inBox, v.shots)}, ${f(v.dsum / v.shots, 1)} m)` : `${k2} 0`; }).join(' · ')}`);
});
