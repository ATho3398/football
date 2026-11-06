// 진단 (C.77x): 사람을 따라가는 목표(tvIdx ≥ 0)를 쥔 틱에서 목표까지 거리를 상태별로 나눈다 — 몸 돌리는 중·urgent·속도·목표 속도. 엔진 코드는 건드리지 않는다.
// 실행: npx vite-node scripts/diag/c77x-follow.ts -- [경기수=4] [경로=값 ...]
import { ENGINE, ENGINE_VERSION } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const N = Number(allArgs.filter((x) => !x.includes('='))[0] ?? 4);
const P = ENGINE.physics;
type B = { n: number; d: number; sp: number; tv: number };
const z = (): B => ({ n: 0, d: 0, sp: 0, tv: 0 });
const K: Record<string, B> = { all: z(), track: z(), mark: z(), press: z(), pivot: z(), urgent: z(), calm: z(), slowTv: z(), fastTv: z(), trPivot: z(), trMove: z(), 'tr<1': z(), 'tr1-3': z(), 'tr3-6': z(), 'tr6+': z(), trAlong: z() };
for (let i = 0; i < N; i++) {
  const mk = (side: string) => { const r = createTeamRoster({ id: `x${side}${i}`, rating: 75 }, `c77x-${side}-${i}`, 2018, []); return teamSetupFromRoster(r, rosterRating(r), 75, `x${side}${i}`); };
  const m = createMatch({ home: mk('h'), away: mk('a'), mode: 'auto', difficulty: 'normal', seed: 9100 + i, bigMatch: false, neutral: true });
  const s = m.state;
  while (!s.done) {
    m.step();
    if (s.restart) continue;
    for (const a of s.agents) {
      if (!a.onPitch || a.tvIdx < 0 || a.idx === s.ball.owner) continue;
      const d = Math.hypot(a.tx - a.x, a.ty - a.y);
      const sp = Math.hypot(a.vx, a.vy);
      const tv = Math.hypot(a.tvx, a.tvy);
      const add = (k: string) => { const b = K[k]!; b.n++; b.d += d; b.sp += sp; b.tv += tv; };
      add('all');
      const kind = a.trackIdx >= 0 && a.trackIdx === a.tvIdx ? 'track' : s.agents[a.tvIdx]!.idx === s.ball.owner ? 'press' : 'mark';
      add(kind);
      const ux = a.tx - a.x, uy = a.ty - a.y;
      const piv = sp <= P.faceSpeed && a.hx * ux + a.hy * uy < 0 && d > 0.3;
      if (piv) add('pivot');
      if (kind === 'track') {
        add(piv ? 'trPivot' : 'trMove');
        add(d < 1 ? 'tr<1' : d < 3 ? 'tr1-3' : d < 6 ? 'tr3-6' : 'tr6+');
        // 목표 방향 성분 속도
        const vAlong = d > 0.01 ? (a.vx * ux + a.vy * uy) / d : 0;
        K.trAlong!.n++; K.trAlong!.d += vAlong;
      }
      add(a.urgent ? 'urgent' : 'calm');
      add(tv < 2 ? 'slowTv' : 'fastTv');
    }
  }
}
console.log(`c77x-follow · ${N}경기 (엔진 ${ENGINE_VERSION}) feed ${P.feed} turnModel ${P.turnModel} errHold ${ENGINE.offball.errHold}`);
for (const [k, b] of Object.entries(K)) console.log(`  ${k.padEnd(7)} 틱 ${String(b.n).padStart(7)} (${((100 * b.n) / K.all!.n).toFixed(0)}%) · 목표까지 ${(b.d / b.n).toFixed(2)} m · 속도 ${(b.sp / b.n).toFixed(2)} · 목표 속도 ${(b.tv / b.n).toFixed(2)}`);
