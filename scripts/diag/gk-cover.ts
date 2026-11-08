// 진단 (C.77t): 유효 슈팅의 GK 도달 항 cover 분포 — 헤더/발 · 거리대 · GK 가 슛 선에서 떨어진 정도. 엔진 코드는 건드리지 않는다
// npx vite-node scripts/diag/gk-cover.ts -- [경기수=20] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string]; const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>; for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>; o[path[path.length - 1]!] = Number(v);
}
const N = Number(allArgs.filter((x) => !x.includes('='))[0] ?? 20);
const rows: { cover: number; header: boolean; d: number }[] = [];
let goals = 0;
let ex = 0;
for (let i = 0; i < N; i++) {
  const h = createTeamRoster({ id: `h${i}`, rating: 75 }, `sx-h${i}`, 2018, []); const a = createTeamRoster({ id: `a${i}`, rating: 75 }, `sx-a${i}`, 2018, []);
  const m = createMatch({ home: teamSetupFromRoster(h, rosterRating(h), 75, `sxh${i}`), away: teamSetupFromRoster(a, rosterRating(a), 75, `sxa${i}`), mode: 'auto', difficulty: 'normal', seed: 8800 + i, bigMatch: false, neutral: true });
  const s = m.state; let prev: unknown = null;
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (fl && fl !== prev && fl.kind === 'shot' && fl.shot && fl.outcome === 'shot' && !fl.shot.penalty) {
      rows.push({ cover: fl.shot.cover ?? 1, header: fl.shot.header, d: fl.shot.d });
      if ((fl.shot.cover ?? 1) < 0.25 && ex < 14) {
        ex++;
        const sh = s.agents[fl.passer]!; const gk = s.agents.find((o) => o.onPitch && o.team !== sh.team && o.line === 0)!;
        const gl = fl.shot.goalX ?? fl.toX; const gyy = fl.shot.goalY ?? fl.toY;
        console.log(`  ex ${fl.shot.header ? 'H' : 'F'} d ${fl.shot.d.toFixed(1)} ball (${(fl.fromX - gl).toFixed(1)}, ${(fl.fromY - 34).toFixed(1)}) → goalY ${(gyy - 34).toFixed(2)} · GK (${(gk.x - gl).toFixed(1)}, ${(gk.y - 34).toFixed(1)}) ${gk.gk?.type} tgt (${(gk.tx - gl).toFixed(1)}, ${(gk.ty - 34).toFixed(1)}) · cover ${(fl.shot.cover ?? 1).toFixed(2)} · prevOwnerT ${(s.t - s.possSince).toFixed(1)}`);
      }
    }
    prev = fl;
  }
  goals += s.teams[0].stats.goals + s.teams[1].stats.goals;
}
const avg = (x: number[]) => (x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN);
const show = (name: string, R: typeof rows) => {
  const b = [0, 0.25, 0.5, 0.75, 0.999, 1.01];
  console.log(`${name}: n ${R.length} · cover 평균 ${avg(R.map((r) => r.cover)).toFixed(3)} · ` + b.slice(0, -1).map((lo, k) => `${lo}~${b[k + 1]} ${((R.filter((r) => r.cover >= lo && r.cover < b[k + 1]!).length / Math.max(1, R.length)) * 100).toFixed(0)}%`).join(' · '));
};
console.log(`gk-cover · ${N}경기 · 골/경기 ${(goals / N).toFixed(2)}`);
show('전체', rows); show('헤더', rows.filter((r) => r.header)); show('발 <8m', rows.filter((r) => !r.header && r.d < 8)); show('발 8~16m', rows.filter((r) => !r.header && r.d >= 8 && r.d < 16)); show('발 16m+', rows.filter((r) => !r.header && r.d >= 16));
