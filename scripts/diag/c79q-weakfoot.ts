// 진단 (C.79q): 슛의 약발 몫을 역할 × 주발 × 측면으로. 4-3-3 대 4-3-3, 윙 두 자리(LW 8·RW 10)의 주발과 역할(정통 윙어·윙 포워드)을 경기마다 돌려 4칸을 고르게 채운다.
//   인버티드 = 주발이 반대쪽 측면(오른쪽 왼발잡이·왼쪽 오른발잡이). 약발 몫은 probe.weak(C.79q), 없으면(옛 엔진) 옛 규칙(공격 방향 가로 부호)으로 계산.
// 실행: N=400 START=0 npx vite-node scripts/diag/c79q-weakfoot.ts
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCE } from '../../src/config/balance';
import { BALANCED } from '../engine/job';
import { probe } from '../../src/engine/probe';
import { attackDir } from '../../src/engine/pitch';

const N = Number(process.env.N ?? 400);
const S0 = Number(process.env.START ?? 0);
const B = BALANCE.body;
if (process.env.CARRY) (B as { shotCarry: number }).shotCarry = Number(process.env.CARRY);
if (process.env.SHOTSET) (B as { shotSet: number }).shotSet = Number(process.env.SHOTSET);
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
  r.formation = '4-3-3';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  const role = (i >> 2) & 1 ? 'wingForward' : 'classicWinger';
  for (const p of s.lineup) {
    if (p.slot === 8 || p.slot === 10) {
      p.role = role;
      const bit = p.slot === 8 ? i & 1 : (i >> 1) & 1;
      if (p.body) p.body = { ...p.body, foot: bit ? 'left' : 'right' };
    }
  }
  return s;
};
interface Acc { n: number; weak: number; weakN: number; on: number; goals: number; xg: number }
const acc = new Map<string, Acc>();
const add = (k: string, w: number, on: boolean, goal: boolean, xg: number) => {
  const x = acc.get(k) ?? { n: 0, weak: 0, weakN: 0, on: 0, goals: 0, xg: 0 };
  x.n++; x.weak += w; if (w >= 0.5) x.weakN++; if (on) x.on++; if (goal) x.goals++; x.xg += xg;
  acc.set(k, x);
};
let goalsTot = 0;
const split = new Map<string, [number, number]>();
const t0 = Date.now();
for (let i = S0; i < S0 + N; i++) {
  const sim = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true });
  const shots: { key: string; w: number; p: { outcome: string; xg: number | null } }[] = [];
  probe.shot = (s, p) => {
    if (p.kind !== 'foot') return;
    const a = s.agents[p.shooter]!;
    const b = a.body;
    let w = p.weak;
    if (w === undefined) {
      // 옛 규칙: 공격 방향 기준 가로 부호, 급함 없음
      const dir = attackDir(a.team, s.half);
      const dx = p.aimX - a.x, dy = p.aimY - a.y, d = Math.hypot(dx, dy) || 1;
      const lat = (dy * dir) / d;
      const need = lat > 0 ? 'left' : 'right';
      w = !b || b.weakFoot >= 5 || need === b.foot ? 0 : Math.min(1, Math.max(0, (Math.abs(lat) - B.weakFrom) / (B.weakFull - B.weakFrom)));
    }
    const side = a.pos.startsWith('L') ? 'L' : a.pos.startsWith('R') ? 'R' : 'C';
    const foot = b?.foot ?? 'right';
    const inv = side === 'C' ? '' : (side === 'R') === (foot === 'left') ? '인버티드' : '정통';
    const grp = a.pos === 'ST' ? 'ST' : a.pos === 'LW' || a.pos === 'RW' ? a.role.id : 'other';
    shots.push({ key: `${grp}|${side}|${foot}|${inv}`, w, p });
    if (process.env.SPLIT && p.rush !== undefined && inv) {
      const dx = p.aimX - a.x, dy = p.aimY - a.y, d = Math.hypot(dx, dy) || 1;
      const cos = (a.hx * dx + a.hy * dy) / d;
      const rb = p.rush >= 1 ? '원터치' : p.rush > 0 ? '압박' : '여유';
      const hb = cos < 0 ? '등짐' : cos < 0.7 ? '옆' : '골쪽';
      const k = `${inv}|${rb}|${hb}`;
      const x = split.get(k) ?? [0, 0];
      x[0]++; x[1] += w; split.set(k, x);
    }
  };
  const r = sim.runToEnd();
  goalsTot += r.homeGoals + r.awayGoals;
  for (const x of shots) add(x.key, x.w, x.p.outcome === 'onTarget' || x.p.outcome === 'save' || x.p.outcome === 'goal', x.p.outcome === 'goal', x.p.xg ?? 0);
}
probe.shot = undefined;
console.log(`C.79q 약발 표: ${N}경기 (시드 ${1000 + S0}~), 경기당 골 ${(goalsTot / N / 2).toFixed(3)} (팀당), ${((Date.now() - t0) / 60000).toFixed(1)}분`);
console.log('| 역할 | 측면 | 주발 | 구분 | 발 슛 | 약발 몫 평균 | 약발 비율(몫≥0.5) | 유효율 | 골 | 골/슛 | xG/슛 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, x] of [...acc.entries()].sort()) {
  const [g, sd, f, inv] = k.split('|');
  if (g === 'other') continue;
  console.log(`| ${g} | ${sd} | ${f} | ${inv} | ${x.n} | ${(x.weak / x.n).toFixed(3)} | ${(100 * x.weakN / x.n).toFixed(1)}% | ${(100 * x.on / x.n).toFixed(1)}% | ${x.goals} | ${(x.goals / x.n).toFixed(3)} | ${(x.xg / x.n).toFixed(3)} |`);
}
// 묶음: 윙(역할 무관) 인버티드 대 정통, ST
const sum = (f: (k: string) => boolean) => { const t = { n: 0, weak: 0, weakN: 0, on: 0, goals: 0, xg: 0 }; for (const [k, x] of acc) if (f(k)) { t.n += x.n; t.weak += x.weak; t.weakN += x.weakN; t.on += x.on; t.goals += x.goals; t.xg += x.xg; } return t; };
for (const [lab, f] of [['윙 인버티드', (k: string) => k.endsWith('|인버티드')], ['윙 정통', (k: string) => k.endsWith('|정통')], ['ST', (k: string) => k.startsWith('ST|')], ['그 밖', (k: string) => k.startsWith('other|')]] as const) {
  const x = sum(f);
  console.log(`- ${lab}: 발 슛 ${x.n}, 약발 몫 ${(x.weak / x.n).toFixed(3)}, 약발 비율 ${(100 * x.weakN / x.n).toFixed(1)}%, 유효율 ${(100 * x.on / x.n).toFixed(1)}%, 골 ${x.goals} (${(x.goals / x.n).toFixed(3)}/슛)`);
}
if (process.env.SPLIT) {
  console.log('| 구분 | 급함 | 몸 방향(슛 쪽 cos) | 슛 | 약발 몫 |');
  for (const [k, [n, w]] of [...split.entries()].sort()) console.log(`| ${k.split('|').join(' | ')} | ${n} | ${(w / n).toFixed(3)} |`);
}
