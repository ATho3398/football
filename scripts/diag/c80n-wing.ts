// 진단 (C.80n 윙어 득점 비중): 포지션군별 득점·슈팅·xG/슛·박스 안 터치(소유 시작), 윙어 슛 위치(반대발 여부 · 박스 넓은 쪽/중앙/박스 밖),
// 측면 크로스 순간·도착 순간 먼 쪽 윙어가 상대 박스 안에 있는 빈도를 센다. 엔진 상태는 읽기만 한다(probe.shot 훅, 지문 불변).
// 실행: npx vite-node scripts/diag/c80n-wing.ts -- [경기수=200] [시작=0] [표본=std|mix] [경로=값 ...]
//   std = 표준 표본(4-2-3-1 균형, quick 과 같은 시드 1000+i) · mix = 4-3-3 · 4-4-2 · 4-1-4-1 · 3-4-3 · 4-2-3-1 돌려 가며(시드 11000+i)
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { probe } from '../../src/engine/probe';
import { attackDir, inOppBox, L, W } from '../../src/engine/pitch';
import { posGroup } from '../../src/roster';
import type { Formation } from '../../src/formations';
import { buildTeam } from '../engine/job';
import { std } from '../engine/suite';
import type { Agent } from '../../src/engine/state';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string]; const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>; for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>; o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 200), S0 = Number(args[1] ?? 0), MODE = args[2] ?? 'std';
const MIX: Formation[] = ['4-3-3', '4-4-2', '4-1-4-1', '3-4-3', '4-2-3-1'];

const G = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'] as const;
type Grp = (typeof G)[number];
const z = () => Object.fromEntries(G.map((g) => [g, 0])) as Record<Grp, number>;
const goals = z(), shots = z(), xg = z(), boxTouch = z(), minutesN = z();
// 윙어 슛: [반대발(inverted) · 정발] × [박스 넓은 쪽(골대 폭 밖, 자기 측면) · 박스 중앙(골대 폭 ±7 m 안) · 박스 넓은 반대쪽 · 박스 밖]
const wShot = [[0, 0, 0, 0], [0, 0, 0, 0]], wGoal = [[0, 0, 0, 0], [0, 0, 0, 0]], wXg = [[0, 0, 0, 0], [0, 0, 0, 0]];
const wTouch = [0, 0];
let crosses = 0, farIn = 0, farInArr = 0, farExists = 0, crossToFar = 0, crossToFarGoal = 0;
let wingersInv = 0, wingersAll = 0;
let totalGoalsStat = 0;

const grpOf = (a: Agent): Grp => posGroup(a.pos) as Grp;
const isWing = (a: Agent) => grpOf(a) === 'WING';
const inverted = (a: Agent) => (a.sy < 0.5 ? a.body.foot === 'right' : a.body.foot === 'left');

let cur: { s: import('../../src/engine/state').SimState } | null = null;
probe.shot = (s, p) => {
  const a = s.agents[p.shooter]!;
  const g = grpOf(a);
  shots[g]++;
  if (p.xg !== null) xg[g] += p.xg;
  if (isWing(a)) {
    const dir = attackDir(a.team, s.half);
    const inBox = inOppBox(a.x, a.y, dir);
    const side = a.sy < 0.5 ? -1 : 1; // 정규화 sy: 공격 방향 기준 왼쪽 < 0.5 — y 는 실제 좌표라 방향에 따라 뒤집어 본다
    const ny = dir > 0 ? a.y / W : 1 - a.y / W;
    const off = (ny - 0.5) * W; // 공격 방향 기준 가로 (m, 왼쪽 −)
    const zone = !inBox ? 3 : Math.abs(off) <= 7 ? 1 : Math.sign(off) === side ? 0 : 2;
    const k = inverted(a) ? 0 : 1;
    wShot[k]![zone]!++;
    if (p.xg !== null) wXg[k]![zone]! += p.xg;
    (p as unknown as { _w: [number, number] })._w = [k, zone];
  }
};
const shotList: { p: import('../../src/engine/probe').ShotProbe; g: Grp }[] = [];
const prevShot = probe.shot;
probe.shot = (s, p) => { prevShot(s, p); shotList.push({ p, g: grpOf(s.agents[p.shooter]!) }); };

const t0 = Date.now();
for (let i = S0; i < S0 + N; i++) {
  const f: Formation = MODE === 'mix' ? MIX[i % MIX.length]! : '4-2-3-1';
  const seed = MODE === 'mix' ? 11000 + i : 1000 + i;
  const home = buildTeam(std('a', i, 75, f, 'balanced'), 75, `w${seed}`);
  const away = buildTeam(std('b', i, 75, f, 'balanced'), 75, `w${seed}`);
  const sim = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state; cur = { s };
  shotList.length = 0;
  let prevOwner = -1;
  let seenFl: unknown = null;
  let pendingCross: { fl: unknown; far: Agent | null } | null = null;
  for (const a of s.agents) if (isWing(a)) { wingersAll++; if (inverted(a)) wingersInv++; }
  while (!s.done) {
    if (s.moments.pending) sim.resolve('delegate'); else sim.step();
    const o = s.ball.owner;
    if (o >= 0 && o !== prevOwner) {
      const a = s.agents[o]!;
      if (a.line !== 0 && inOppBox(a.x, a.y, attackDir(a.team, s.half))) { boxTouch[grpOf(a)]++; if (isWing(a)) wTouch[inverted(a) ? 0 : 1]! += 1; }
    }
    prevOwner = o;
    const fl = s.ball.flight;
    if (fl && fl !== seenFl && fl.kind === 'cross' && fl.passer >= 0) {
      seenFl = fl;
      const c = s.agents[fl.passer]!;
      const dir = attackDir(c.team, s.half);
      const cny = dir > 0 ? fl.fromY / W : 1 - fl.fromY / W;
      crosses++;
      // 먼 쪽 윙어: 크로스 반대쪽 측면 슬롯의 같은 팀 윙어
      const far = s.agents.find((x) => x.onPitch && x.team === c.team && x !== c && isWing(x) && Math.sign(x.sy - 0.5) !== Math.sign(cny - 0.5)) ?? null;
      if (far) { farExists++; if (inOppBox(far.x, far.y, dir)) farIn++; }
      if (far && fl.receiver === far.idx) crossToFar++;
      pendingCross = { fl, far };
    }
    if (pendingCross && s.ball.flight !== pendingCross.fl) {
      const far = pendingCross.far;
      if (far && inOppBox(far.x, far.y, attackDir(far.team, s.half))) farInArr++;
      pendingCross = null;
    }
  }
  for (const x of shotList) if (x.p.outcome === 'goal') {
    goals[x.g]++;
    const w = (x.p as unknown as { _w?: [number, number] })._w;
    if (w) wGoal[w[0]]![w[1]]!++;
  }
  totalGoalsStat += s.teams[0].stats.goals + s.teams[1].stats.goals;
  for (const a of s.agents) minutesN[grpOf(a)] += 0;
  if ((i - S0 + 1) % 20 === 0) process.stderr.write(`  ${i - S0 + 1}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r`);
}
const tg = G.reduce((t, g) => t + goals[g], 0), ts = G.reduce((t, g) => t + shots[g], 0);
const out = { N, S0, MODE, goals, shots, xg, boxTouch, wShot, wGoal, wXg, wTouch, crosses, farExists, farIn, farInArr, crossToFar, wingersInv, wingersAll, totalGoalsStat };
console.log(JSON.stringify(out));
console.error(`\n### ${MODE} ${N}경기 · 골 ${totalGoalsStat}(슛 기록 골 ${tg}) · 경기당 팀 득점 ${(totalGoalsStat / N / 2).toFixed(2)}`);
console.error('군 | 골% | 슛% | xG/슛 | 골/슛 | 박스 터치/경기');
for (const g of G) console.error(`${g} | ${(goals[g] / tg * 100).toFixed(1)} | ${(shots[g] / ts * 100).toFixed(1)} | ${(xg[g] / Math.max(1, shots[g])).toFixed(3)} | ${(goals[g] / Math.max(1, shots[g])).toFixed(3)} | ${(boxTouch[g] / N).toFixed(2)}`);
