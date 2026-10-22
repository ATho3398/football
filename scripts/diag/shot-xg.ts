// 진단 (엔진 관리자 9대, Z 16:10 "빅찬스가 왜 안 나오나"): 엔진 전체 슈팅을 찬 순간의 shotModel(판단용 xG)로 나눠 분포·실제 골률·항 분해(pOn·pBlock·pGoal)를 본다. 엔진 코드는 건드리지 않는다.
// npx vite-node scripts/diag/shot-xg.ts -- [경기수=40] [홈레이팅=75] [원정레이팅=75] [경로=값 ...]
//   상황: 1대1(콘 안 필드 수비 0·3 m 안 필드 수비 0·골 16.5 m 안) · 6야드(5.5 m 안) · 11 m 안 · 헤더 · 받고 바로(소유 0.6 s 안)
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { shotModel } from '../../src/engine/onball';
import { attackDir, dist, oppGoal } from '../../src/engine/pitch';
import { createTeamRoster, rosterRating } from '../../src/roster';
const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string]; const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>; for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>; o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 40), HR = Number(args[1] ?? 75), AR = Number(args[2] ?? 75);
interface Sh { xg: number; goal: boolean; d: number; pOn: number; pBlock: number; pGoal: number; near: number; blockers: number; header: boolean; quick: boolean; pressure: number; gkD: number; pen: boolean }
const shots: Sh[] = [];
for (let i = 0; i < N; i++) {
  const h = createTeamRoster({ id: `h${i}`, rating: HR }, `sx-h${i}`, 2018, []); const a = createTeamRoster({ id: `a${i}`, rating: AR }, `sx-a${i}`, 2018, []);
  const m = createMatch({ home: teamSetupFromRoster(h, rosterRating(h), HR, `sxh${i}`), away: teamSetupFromRoster(a, rosterRating(a), AR, `sxa${i}`), mode: 'auto', difficulty: 'normal', seed: 8800 + i, bigMatch: false, neutral: true });
  const s = m.state; let prev: unknown = null; const ownT = new Map<number, number>(); let prevOwner = -1;
  const pend: { sh: Sh; idx: number; g0: number; t: number }[] = [];
  while (!s.done) {
    m.step();
    if (s.ball.owner >= 0 && s.ball.owner !== prevOwner) ownT.set(s.ball.owner, s.t);
    prevOwner = s.ball.owner;
    for (let k = pend.length - 1; k >= 0; k--) { const q = pend[k]!; if (s.agents[q.idx]!.stats.goals > q.g0) { q.sh.goal = true; pend.splice(k, 1); } else if (s.t - q.t > 4) pend.splice(k, 1); }
    const fl = s.ball.flight;
    if (fl && fl !== prev && fl.kind === 'shot' && !(prev && (prev as { kind: string; passer: number }).kind === 'shot' && (prev as { passer: number }).passer === fl.passer && fl.outcome === 'goal')) {
      const sh = s.agents[fl.passer]!; const dir = attackDir(sh.team, s.half); const [gx, gy] = oppGoal(dir);
      const header = !!fl.shot?.header; const pen = !!fl.shot?.penalty;
      const mm = shotModel(s, sh, header, { x: fl.fromX, y: fl.fromY });
      let near = Infinity, gkD = Infinity;
      for (const o of s.agents) { if (!o.onPitch || o.team === sh.team) continue; const dd = dist(o.x, o.y, fl.fromX, fl.fromY); if (o.line === 0) gkD = dist(o.x, o.y, gx, gy); else near = Math.min(near, dd); }
      const rec: Sh = { xg: pen ? 0.76 : mm.xg, goal: false, d: mm.d, pOn: mm.pOn, pBlock: mm.pBlock, pGoal: mm.pGoal, near, blockers: mm.blockers, header, quick: s.t - (ownT.get(sh.idx) ?? -9) <= 0.6, pressure: mm.pressure, gkD, pen };
      shots.push(rec); pend.push({ sh: rec, idx: sh.idx, g0: sh.stats.goals, t: s.t });
    }
    prev = fl;
  }
}
// 골 판정 보정: 비행 결과가 shot(세이브 판정) 이면 결과는 나중에 — 슛 뒤 3초 안 그 팀 골로 다시 센다
const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
const f = (x: number, k = 3) => (Number.isFinite(x) ? x.toFixed(k) : '-');
const pc = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '-');
const S = shots.filter((x) => !x.pen);
console.log(`shot-xg · ${N}경기 ${HR}:${AR} · 슛 ${S.length} (경기당 ${(S.length / N).toFixed(1)}) · xG 평균 ${f(avg(S.map((x) => x.xg)))} · 합/경기 ${(S.map((x) => x.xg).reduce((a, b) => a + b, 0) / N).toFixed(2)} · PK ${shots.length - S.length}`);
const bands = [[0, 0.05], [0.05, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.4], [0.4, 0.5], [0.5, 1]];
console.log('xG 구간: ' + bands.map(([lo, hi]) => { const B = S.filter((x) => x.xg >= lo! && x.xg < hi!); return `${lo}~${hi} ${pc(B.length, S.length)}`; }).join(' · '));
console.log(`0.3+ ${pc(S.filter((x) => x.xg >= 0.3).length, S.length)} · 0.5+ ${pc(S.filter((x) => x.xg >= 0.5).length, S.length)} · 최대 ${f(Math.max(...S.map((x) => x.xg)))}`);
const cats: [string, (x: Sh) => boolean][] = [
  ['1대1(콘 0·3 m 안 0·16.5 m 안)', (x) => !x.header && x.blockers === 0 && x.near >= 3 && x.d <= 16.5],
  ['GK 만(콘 0·5 m 안 0·11 m 안)', (x) => !x.header && x.blockers === 0 && x.near >= 5 && x.d <= 11],
  ['6야드(5.5 m 안, 발)', (x) => !x.header && x.d <= 5.5],
  ['11 m 안(발)', (x) => !x.header && x.d <= 11],
  ['받고 바로(0.6 s, 11 m 안)', (x) => x.quick && !x.header && x.d <= 11],
  ['헤더', (x) => x.header],
  ['전체', () => true],
];
for (const [name, fn] of cats) {
  const B = S.filter(fn);
  console.log(`${name}: ${pc(B.length, S.length)} (경기당 ${(B.length / N).toFixed(2)}) · xG ${f(avg(B.map((x) => x.xg)))} · 실제 골률 ${pc(B.filter((x) => x.goal).length, B.length)} · pOn ${f(avg(B.map((x) => x.pOn)))} · pBlock ${f(avg(B.map((x) => x.pBlock)))} · pGoal(리그 GK 못 막음) ${f(avg(B.map((x) => x.pGoal)))} · 거리 ${f(avg(B.map((x) => x.d)), 1)} · 압박 ${f(avg(B.map((x) => x.pressure)), 2)} · 가장 가까운 필드 수비 ${f(avg(B.map((x) => Math.min(x.near, 30))), 1)} m · GK 골라인에서 ${f(avg(B.map((x) => x.gkD)), 1)} m`);
}
