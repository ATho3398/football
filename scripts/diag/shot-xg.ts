// 슛 측정기 (C.77w 재작성, 공통 규칙 로드맵 1단계): shoot()·직접 프리킥·PK 판정 순간의 측정 훅(src/engine/probe.ts)으로 슛 1건씩 센다 — 막힌 슛 포함, 발/머리는 판정 인자 그대로.
// 옛 방식(공 비행 fl.kind === 'shot' 만 세고 헤더는 fl.shot?.header)과 같은 경기에서 나란히 세어 전후표를 낸다. 엔진 코드는 바꾸지 않는다 (훅은 난수·상태를 안 건드림).
// npx vite-node scripts/diag/shot-xg.ts -- [경기수=40] [홈레이팅=75] [원정레이팅=75] [경로=값 ...]
//   상황: 1대1(콘 안 필드 수비 0·3 m 안 필드 수비 0·골 16.5 m 안) · 6야드(5.5 m 안) · 11 m 안 · 헤더 · 받고 바로(소유 0.6 s 안)
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { shotModel } from '../../src/engine/onball';
import { probe, type ShotProbe } from '../../src/engine/probe';
import { createTeamRoster, rosterRating } from '../../src/roster';
const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string]; const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>; for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>; o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 40), HR = Number(args[1] ?? 75), AR = Number(args[2] ?? 75);

interface Rec extends ShotProbe { quick: boolean; blockers: number; near: number }
interface Old { xg: number; header: boolean; pen: boolean }
const shots: Rec[] = [];
const olds: Old[] = [];
let statShots = 0;
let curOwnT = new Map<number, number>();
probe.shot = (s, p) => {
  const a = s.agents[p.shooter]!;
  // 1대1·GK 만 분류용: 콘 안 수비 수(shotModel.blockers)와 가장 가까운 필드 수비 거리
  const mm = p.kind === 'foot' || p.kind === 'header' ? shotModel(s, a, p.kind === 'header') : null;
  let near = Infinity;
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) near = Math.min(near, Math.hypot(o.x - a.x, o.y - a.y));
  // probeShotEnd 가 나중에 원본 p 의 결과를 save·goal 로 고치므로 같은 객체에 덧붙여 모은다
  shots.push(Object.assign(p, { quick: s.t - (curOwnT.get(a.idx) ?? -9) <= 0.6, blockers: mm?.blockers ?? 0, near }));
};

for (let i = 0; i < N; i++) {
  const h = createTeamRoster({ id: `h${i}`, rating: HR }, `sx-h${i}`, 2018, []); const a = createTeamRoster({ id: `a${i}`, rating: AR }, `sx-a${i}`, 2018, []);
  const m = createMatch({ home: teamSetupFromRoster(h, rosterRating(h), HR, `sxh${i}`), away: teamSetupFromRoster(a, rosterRating(a), AR, `sxa${i}`), mode: 'auto', difficulty: 'normal', seed: 8800 + i, bigMatch: false, neutral: true });
  const s = m.state; let prev: unknown = null; let prevOwner = -1;
  curOwnT = new Map();
  while (!s.done) {
    m.step();
    if (s.ball.owner >= 0 && s.ball.owner !== prevOwner) curOwnT.set(s.ball.owner, s.t);
    prevOwner = s.ball.owner;
    // 옛 방식: 새 공 비행 중 kind === 'shot' (골 2단계 비행 제외)
    const fl = s.ball.flight;
    if (fl && fl !== prev && fl.kind === 'shot' && !(prev && (prev as { kind: string; passer: number }).kind === 'shot' && (prev as { passer: number }).passer === fl.passer && fl.outcome === 'goal')) {
      const sh = s.agents[fl.passer]!; const header = !!fl.shot?.header; const pen = !!fl.shot?.penalty;
      const mm = shotModel(s, sh, header, { x: fl.fromX, y: fl.fromY });
      olds.push({ xg: pen ? 0.76 : mm.xg, header, pen });
    }
    prev = fl;
  }
  statShots += s.teams[0].stats.shots + s.teams[1].stats.shots;
}

const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
const f = (x: number, k = 3) => (Number.isFinite(x) ? x.toFixed(k) : '-');
const pc = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '-');
const all = shots.length;
const S = shots.filter((x) => x.kind === 'foot' || x.kind === 'header');
const O = olds.filter((x) => !x.pen);
const cnt = (k: ShotProbe['outcome']) => shots.filter((x) => x.outcome === k).length;
console.log(`shot-xg (C.77w 측정 훅) · ${N}경기 ${HR}:${AR}`);
console.log(`슛 전체 ${all} = 경기 통계 슛 ${statShots} ${all === statShots ? '✓ 일치' : '✗ 불일치'} · 경기당 ${(all / N).toFixed(1)} · PK ${shots.filter((x) => x.kind === 'pk').length} · 직접 프리킥 ${shots.filter((x) => x.kind === 'fk').length}`);
console.log(`결과: 골 ${cnt('goal')} · 선방 ${cnt('save')} · 빗나감 ${cnt('miss')} · 블록 ${cnt('block')} · 골대 0(엔진에 없음) · 미결 ${cnt('onTarget')}`);

console.log('\n전후표 (같은 경기, 필드 플레이 슛 = PK·직접 프리킥 제외)');
console.log('| | 옛 측정(공 비행) | 새 측정(shoot 훅) |');
console.log('|---|---|---|');
console.log(`| 슛 수 | ${O.length} | ${S.length} |`);
console.log(`| 블록 수 | 0 (안 셈) | ${S.filter((x) => x.outcome === 'block').length} |`);
console.log(`| 헤더 수 | ${O.filter((x) => x.header).length} | ${S.filter((x) => x.kind === 'header').length} |`);
console.log(`| xG 평균 | ${f(avg(O.map((x) => x.xg)))} | ${f(avg(S.map((x) => x.xg!)))} |`);
console.log(`| xG 0.3+ | ${pc(O.filter((x) => x.xg >= 0.3).length, O.length)} | ${pc(S.filter((x) => x.xg! >= 0.3).length, S.length)} |`);
console.log(`| xG 0.5+ | ${pc(O.filter((x) => x.xg >= 0.5).length, O.length)} | ${pc(S.filter((x) => x.xg! >= 0.5).length, S.length)} |`);
console.log(`| xG 합/경기 | ${(O.reduce((t, x) => t + x.xg, 0) / N).toFixed(2)} | ${(S.reduce((t, x) => t + x.xg!, 0) / N).toFixed(2)} |`);

const bands = [[0, 0.05], [0.05, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.4], [0.4, 0.5], [0.5, 1]];
console.log('\nxG 구간(새): ' + bands.map(([lo, hi]) => { const B = S.filter((x) => x.xg! >= lo! && x.xg! < hi!); return `${lo}~${hi} ${pc(B.length, S.length)} (골 ${pc(B.filter((x) => x.outcome === 'goal').length, B.length)})`; }).join(' · '));
const cats: [string, (x: Rec) => boolean][] = [
  ['1대1(콘 0·3 m 안 0·16.5 m 안)', (x) => x.kind === 'foot' && x.blockers === 0 && x.near >= 3 && x.d <= 16.5],
  ['GK 만(콘 0·5 m 안 0·11 m 안)', (x) => x.kind === 'foot' && x.blockers === 0 && x.near >= 5 && x.d <= 11],
  ['6야드(5.5 m 안, 발)', (x) => x.kind === 'foot' && x.d <= 5.5],
  ['11 m 안(발)', (x) => x.kind === 'foot' && x.d <= 11],
  ['받고 바로(0.6 s, 11 m 안)', (x) => x.quick && x.kind === 'foot' && x.d <= 11],
  ['헤더', (x) => x.kind === 'header'],
  ['xG 0.3+', (x) => x.xg! >= 0.3],
  ['전체', () => true],
];
console.log('');
for (const [name, fn] of cats) {
  const B = S.filter(fn);
  const o = (k: ShotProbe['outcome']) => pc(B.filter((x) => x.outcome === k).length, B.length);
  console.log(`${name}: ${pc(B.length, S.length)} (경기당 ${(B.length / N).toFixed(2)}) · xG ${f(avg(B.map((x) => x.xg!)))} · 골 ${o('goal')} 선방 ${o('save')} 빗나감 ${o('miss')} 블록 ${o('block')} · 거리 ${f(avg(B.map((x) => x.d)), 1)} · 3 m 압박 ${f(avg(B.map((x) => x.press3)), 2)}명 · 슈터 속도 ${f(avg(B.map((x) => x.speed)), 1)} · 공 속도 ${f(avg(B.map((x) => x.ballSpeed)), 1)} · GK 속도 ${f(avg(B.map((x) => x.gkSpeed)), 1)}`);
}
