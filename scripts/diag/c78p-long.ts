// 진단 (C.78p 질문 3): 30 m+ 패스(롱) 비행의 계획 결과(받기·가로채기·루즈·공중 경합)와 3초 뒤 소유 팀을 센다 — 착지점 몫(onball.landShare·landKeep) 판단이 실행과 맞는지.
// 실행: npx vite-node scripts/diag/c78p-long.ts -- [경기수=20] [레이팅=76] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import type { Flight } from '../../src/engine/state';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';
const all = process.argv.slice(2).filter((a) => a !== '--');
for (const a of all.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = all.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 20);
const R = Number(args[1] ?? 76);
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: R }, `diagC-${side}-${R}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), R, `wC${i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const cnt: Record<string, { n: number; first: number; k3: number; k6: number }> = {};
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 7000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let cur: Flight | null = null;
  const watch: { o: string; team: number; t: number; first: number; k3: number }[] = [];
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (fl && fl !== cur && (fl.kind === 'pass' || fl.kind === 'long') && (fl.aimD ?? 0) >= 30) watch.push({ o: fl.outcome, team: s.agents[fl.passer]!.team, t: s.t, first: -1, k3: -1 });
    cur = fl;
    const ow = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team : -1;
    for (let j = watch.length - 1; j >= 0; j--) {
      const w = watch[j]!;
      if (w.first < 0 && ow >= 0 && s.t > w.t + 0.05) w.first = ow === w.team ? 1 : 0;
      if (w.k3 < 0 && s.t - w.t >= 3 + 1.5) w.k3 = s.possTeam === w.team && !s.restart ? 1 : 0;
      if (s.restart && w.first < 0) w.first = 0;
      if (s.t - w.t >= 7.5 || s.restart) {
        const c = (cnt[w.o] ??= { n: 0, first: 0, k3: 0, k6: 0 });
        c.n++; c.first += Math.max(0, w.first); c.k3 += Math.max(0, w.k3); c.k6 += s.possTeam === w.team && !s.restart ? 1 : 0;
        watch.splice(j, 1);
      }
    }
  }
}
const tot = Object.values(cnt).reduce((a, c) => a + c.n, 0);
console.log(`\n== 30 m+ 패스 ${N}경기 (${R}:${R}) — ${tot}개, 덮어쓰기 ${all.filter((x) => x.includes('=')).join(' ')} ==`);
for (const [k, c] of Object.entries(cnt)) console.log(`${k}: ${(100 * c.n / tot).toFixed(1)}% · 첫 소유 우리 ${(100 * c.first / c.n).toFixed(1)}% · 비행 뒤 ~3초 우리 ${(100 * c.k3 / c.n).toFixed(1)}% · 7.5초 우리 ${(100 * c.k6 / c.n).toFixed(1)}%`);
const s = (f: 'first' | 'k3' | 'k6') => (100 * Object.values(cnt).reduce((a, c) => a + c[f], 0) / tot).toFixed(1);
console.log(`전체: 첫 소유 우리 ${s('first')}% · ~3초 ${s('k3')}% · 7.5초 ${s('k6')}%`);
process.exit(0);
