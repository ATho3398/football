// 진단 (엔진 관리자, pending 39 1번 "수비가 제멋대로"): 수비 오프볼 조직을 1초마다 센다. 엔진 코드는 건드리지 않는다.
// 실행: npx vite-node scripts/diag/defense-shape.ts -- [경기수=40] [포메이션=4-2-3-1] [홈전술=balanced] [원정전술=balanced] [경로=값 ...]
//   재는 것(수비 팀 = 공을 갖지 않은 팀, 오픈 플레이·소유 중·공이 땅에 있을 때, 양 팀 합산):
//   ① 공 가진 선수 3 m 안 수비 수 분포 (공 위치 구역별: 박스 안 / 골 25 m 안 / 25~40 m / 40 m 밖)
//   ② 수비 줄(line 1) 깊이 평균·표준편차(줄 흐트러짐), 이웃 간격 평균·최대, 줄에서 5 m 이상 벗어난 수비수 비율
//   ③ 상대 공격수(소유자 제외) 1명당 2.5 m 안 수비 수: 0 / 1 / 2명 이상 비율, 한 상대에 2명 이상 붙는 횟수, 최종 3분의 1에서 5 m 안에 아무도 없는 공격수 비율
//   ④ 가장 가까운 수비수가 바뀌는 빈도 (상대 1명당 분당 교체 수, 최종 3분의 1)
//   ⑤ 수비수의 목표 지점 분류: 공 쪽(공 3 m 안) / 사람 쪽(상대 2.5 m 안) / 자리(그 밖) — 엔진이 "무엇을 하려는지"
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { attackDir, dist, ownGoal, toNorm, L } from '../../src/engine/pitch';
import type { Agent } from '../../src/engine/state';
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
const FORMATION = (args[1] ?? '4-2-3-1') as Formation;
const tacOf = (spec: string) => { const [tn, lv] = spec.split('@') as [Tendency, string | undefined]; const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined; return tacticsOf(tn, levels); };
const HOME = args[2] ?? 'balanced';
const AWAY = args[3] ?? 'balanced';

const mk = (side: string, i: number, spec: string): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagD-${side}-${i}`, 2018, []);
  r.formation = FORMATION;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wD${i}`);
  s.tactics = tacOf(spec);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};

const ZONES = ['박스 안', '골 25 m 안', '25~40 m', '40 m 밖'] as const;
type Zone = (typeof ZONES)[number];
const zoneOf = (d: number, inBox: boolean): Zone => (inBox ? '박스 안' : d < 25 ? '골 25 m 안' : d < 40 ? '25~40 m' : '40 m 밖');

interface Acc {
  samples: number;
  near3: Record<Zone, number[]>; // 구역별 공 3 m 안 수비 수 히스토그램 (0..4+)
  near2: Record<Zone, number[]>;
  lineN: number; lineStd: number; lineGapAvg: number; lineGapMax: number; lineOff5: number; lineDepth: number; lineDepthByZone: Record<Zone, { n: number; sum: number }>;
  markHist: number[]; // 공격수 1명당 2.5 m 안 수비 수 0/1/2/3+
  markHistF3: number[];
  double: number; // 한 상대에 2명 이상 붙은 공격수 수 합
  f3Att: number; f3Unmarked5: number; f3Unmarked3: number;
  churnChanges: number; churnSamples: number;
  intent: Record<Zone, { ball: number; man: number; spot: number; n: number }>;
  intentLine: Record<string, { ball: number; man: number; spot: number; n: number }>;
  tackles: number; games: number; interceptions: number; dribblesFaced: number; dribbledPast: number;
}
const zrec = <T,>(f: () => T): Record<Zone, T> => ({ '박스 안': f(), '골 25 m 안': f(), '25~40 m': f(), '40 m 밖': f() });
const acc: Acc = {
  samples: 0, near3: zrec(() => [0, 0, 0, 0, 0]), near2: zrec(() => [0, 0, 0, 0, 0]),
  lineN: 0, lineStd: 0, lineGapAvg: 0, lineGapMax: 0, lineOff5: 0, lineDepth: 0, lineDepthByZone: zrec(() => ({ n: 0, sum: 0 })),
  markHist: [0, 0, 0, 0], markHistF3: [0, 0, 0, 0], double: 0, f3Att: 0, f3Unmarked5: 0, f3Unmarked3: 0, churnChanges: 0, churnSamples: 0,
  intent: zrec(() => ({ ball: 0, man: 0, spot: 0, n: 0 })), intentLine: {}, tackles: 0, games: 0, interceptions: 0, dribblesFaced: 0, dribbledPast: 0,
};

function analyze(home: TeamSetup, away: TeamSetup, seed: number): void {
  const m = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state;
  const nearest = new Map<Agent, number>(); // 공격수 → 가장 가까운 수비수 idx (교체 빈도)
  while (!s.done) {
    m.step();
    if (s.tick % 10 !== 0 || s.restart || s.ball.owner < 0 || s.ball.flight) continue;
    const owner = s.agents[s.ball.owner]!;
    if (owner.line === 0) continue;
    const att = owner.team;
    const def = (1 - att) as 0 | 1;
    const dDir = attackDir(def, s.half);
    const [gx, gy] = ownGoal(dDir);
    const b = s.ball;
    const bd = dist(b.x, b.y, gx, gy);
    const inBox = Math.abs(b.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(b.y - gy) <= ENGINE.pitch.boxWidth / 2;
    const z = zoneOf(bd, inBox);
    const D = s.agents.filter((o) => o.onPitch && o.team === def && o.line !== 0);
    const A = s.agents.filter((o) => o.onPitch && o.team === att && o.line !== 0 && o !== owner);
    acc.samples++;
    // ① 공 3 m / 2 m 안 수비 수
    let n3 = 0, n2 = 0;
    for (const d of D) { const dd = dist(d.x, d.y, owner.x, owner.y); if (dd <= 3) n3++; if (dd <= 2) n2++; }
    acc.near3[z][Math.min(4, n3)]!++;
    acc.near2[z][Math.min(4, n2)]!++;
    // ② 수비 줄
    const line1 = D.filter((o) => o.line === 1).map((o) => ({ x: toNorm(o.x, o.y, dDir)[0] * L, y: o.y }));
    if (line1.length >= 2) {
      const mean = line1.reduce((t, p) => t + p.x, 0) / line1.length;
      const sd = Math.sqrt(line1.reduce((t, p) => t + (p.x - mean) ** 2, 0) / line1.length);
      const ys = line1.map((p) => p.y).sort((a, c) => a - c);
      const gaps = ys.slice(1).map((y, i) => y - ys[i]!);
      acc.lineN++; acc.lineStd += sd; acc.lineDepth += mean;
      acc.lineDepthByZone[z].n++; acc.lineDepthByZone[z].sum += mean;
      acc.lineGapAvg += gaps.reduce((t, g) => t + g, 0) / gaps.length; acc.lineGapMax += Math.max(...gaps);
      acc.lineOff5 += line1.filter((p) => Math.abs(p.x - mean) > 5).length / line1.length;
    }
    // ③ 마크 인원
    for (const a of A) {
      let c = 0, c5 = 0, best = Infinity, bestIdx = -1;
      for (const d of D) { const dd = dist(d.x, d.y, a.x, a.y); if (dd <= 2.5) c++; if (dd <= 5) c5++; if (dd < best) { best = dd; bestIdx = d.idx; } }
      acc.markHist[Math.min(3, c)]!++;
      if (c >= 2) acc.double++;
      const ad = dist(a.x, a.y, gx, gy);
      if (ad < 35) {
        acc.markHistF3[Math.min(3, c)]!++;
        acc.f3Att++; if (c5 === 0) acc.f3Unmarked5++; if (best > 3) acc.f3Unmarked3++;
        // ④ 교체 빈도
        const prev = nearest.get(a);
        if (prev !== undefined) { acc.churnSamples++; if (prev !== bestIdx) acc.churnChanges++; }
        nearest.set(a, bestIdx);
      } else nearest.delete(a);
    }
    // ⑤ 수비수 목표 분류
    for (const d of D) {
      const tb = dist(d.tx, d.ty, b.x, b.y);
      let tm = Infinity;
      for (const a of A) tm = Math.min(tm, dist(d.tx, d.ty, a.x, a.y));
      const kind = tb <= 3 ? 'ball' : tm <= 2.5 ? 'man' : 'spot';
      const I = acc.intent[z]; I.n++; I[kind]++;
      const key = `줄${d.line}`;
      const IL = (acc.intentLine[key] ??= { ball: 0, man: 0, spot: 0, n: 0 }); IL.n++; IL[kind]++;
    }
  }
  acc.games++;
  for (const t of [0, 1] as const) { const st = s.teams[t].stats; acc.tackles += st.tackleAttempts; acc.interceptions += st.interceptions; }
  for (const a of s.agents) { acc.dribblesFaced += a.stats.dribblesFaced; acc.dribbledPast += a.stats.dribbledPast; }
}

const t0 = Date.now();
for (let i = 0; i < N; i++) analyze(mk('a', i, HOME), mk('b', i, AWAY), 83000 + i);
const pct = (v: number, n: number) => `${(100 * v / Math.max(1, n)).toFixed(0)}%`;
console.log(`\n### 수비 조직 (${FORMATION}, 홈 ${HOME} 대 원정 ${AWAY}, 생성 75 대 75, 중립 ${N}경기, 오픈 플레이 소유 중 1초 표본 ${acc.samples}개, ${((Date.now() - t0) / 60000).toFixed(1)}분)`);
console.log('\n① 공 가진 선수 3 m 안 수비 수 (구역별 표본 비율 0 / 1 / 2 / 3 / 4+명) · 2 m 안');
for (const z of ZONES) { const h = acc.near3[z]; const n = h.reduce((a, b) => a + b, 0); const h2 = acc.near2[z]; console.log(`  ${z.padEnd(8)} 표본 ${n}: ${h.map((v) => pct(v, n)).join(' / ')} · 2 m 안 ${h2.map((v) => pct(v, n)).join(' / ')} · 평균 ${(h.reduce((t, v, k) => t + v * k, 0) / Math.max(1, n)).toFixed(2)}명`); }
console.log(`\n② 수비 줄(line 1): 골에서 깊이 평균 ${(acc.lineDepth / acc.lineN).toFixed(1)} m (${ZONES.map((z) => `${z} ${(acc.lineDepthByZone[z].sum / Math.max(1, acc.lineDepthByZone[z].n)).toFixed(1)}`).join(' · ')}), 깊이 표준편차 평균 ${(acc.lineStd / acc.lineN).toFixed(2)} m, 이웃 간격 평균 ${(acc.lineGapAvg / acc.lineN).toFixed(1)} m · 최대 ${(acc.lineGapMax / acc.lineN).toFixed(1)} m, 줄에서 5 m 이상 벗어난 수비수 비율 ${pct(acc.lineOff5, acc.lineN)}`);
const mh = acc.markHist, mn = mh.reduce((a, b) => a + b, 0);
const mf = acc.markHistF3, mfn = mf.reduce((a, b) => a + b, 0);
console.log(`\n③ 상대 공격수 1명당 2.5 m 안 수비 수 (0 / 1 / 2 / 3+): 전체 ${mh.map((v) => pct(v, mn)).join(' / ')} · 골 35 m 안 ${mf.map((v) => pct(v, mfn)).join(' / ')}`);
console.log(`   한 상대에 2명 이상 붙음: 표본당 ${(acc.double / acc.samples).toFixed(2)}명 · 골 35 m 안 공격수 중 5 m 안에 수비가 없음 ${pct(acc.f3Unmarked5, acc.f3Att)}, 3 m 안에 없음 ${pct(acc.f3Unmarked3, acc.f3Att)}`);
console.log(`\n④ 골 35 m 안 공격수의 가장 가까운 수비수 교체: 초당 ${(acc.churnChanges / Math.max(1, acc.churnSamples)).toFixed(2)}회 (상대 1명당 분당 ${(60 * acc.churnChanges / Math.max(1, acc.churnSamples)).toFixed(1)}회)`);
console.log('\n⑤ 수비수 목표 지점: 공 쪽(공 3 m 안) / 사람 쪽(상대 2.5 m 안) / 자리');
for (const z of ZONES) { const I = acc.intent[z]; console.log(`  ${z.padEnd(8)} ${pct(I.ball, I.n)} / ${pct(I.man, I.n)} / ${pct(I.spot, I.n)} (수비수·표본 ${I.n})`); }
for (const [k, I] of Object.entries(acc.intentLine).sort()) console.log(`  ${k}: ${pct(I.ball, I.n)} / ${pct(I.man, I.n)} / ${pct(I.spot, I.n)}`);
console.log(`\n경기당 태클 시도 ${(acc.tackles / 2 / acc.games).toFixed(1)}, 인터셉트 ${(acc.interceptions / 2 / acc.games).toFixed(1)}, 돌파 시도 상대 ${(acc.dribblesFaced / 2 / acc.games).toFixed(1)} · 제쳐짐 ${(acc.dribbledPast / 2 / acc.games).toFixed(1)}`);
process.exit(0);
