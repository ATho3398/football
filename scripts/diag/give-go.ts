// 진단 (엔진 관리자 9대, pending 145 ③): 패스 직후 패서가 앞으로 뛰는가 (2:1 / give-and-go). 엔진 코드는 건드리지 않는다.
// npx vite-node scripts/diag/give-go.ts -- [경기수=20] [전술=balanced]
//   성공한 오픈 플레이 패스(필드 선수, 상대 진영 절반 이상에서) 뒤 0~2초: 패서의 전진 이동(m)·runUntil 이 선 비율·최고 속도, 받은 선수가 2초 안에 패서에게 되돌려 준 비율(리턴 패스)
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency, TeamSetup } from '../../src/engine/types';
import { attackDir, toNorm } from '../../src/engine/pitch';
import { FORMATION_SLOTS } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';
const args = process.argv.slice(2).filter((a) => a !== '--');
const N = Number(args[0] ?? 20); const TN = (args[1] ?? 'balanced') as Tendency;
const mk = (side: string, i: number, tn: Tendency): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagR-${side}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wR${i}`); s.tactics = tacticsOf(tn);
  const slots = FORMATION_SLOTS[s.formation]; for (const p of s.lineup) delete p.role; fillRoles(s, (slot) => slots[slot]!.pos); return s;
};
const S = { n: 0, adv: [] as number[], run: 0, urgent: 0, vmax: [] as number[], ret: 0, adv5: 0 };
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('H', i, TN), away: mk('A', i, 'balanced'), mode: 'auto', difficulty: 'normal', seed: 9300 + i, bigMatch: false, neutral: true });
  const s = m.state; let prev: unknown = null;
  const watch: { a: number; r: number; x0: number; t0: number; vmax: number; run: boolean; urg: boolean; ret: boolean }[] = [];
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (fl && fl !== prev && fl.kind === 'pass' && fl.outcome === 'receive') {
      const a = s.agents[fl.passer]!;
      const dir = attackDir(a.team, s.half);
      if (a.line > 0 && toNorm(fl.fromX, fl.fromY, dir)[0] >= 0.5) watch.push({ a: a.idx, r: fl.receiver, x0: a.x, t0: s.t, vmax: 0, run: false, urg: false, ret: false });
    }
    prev = fl;
    for (let k = watch.length - 1; k >= 0; k--) {
      const w = watch[k]!; const a = s.agents[w.a]!;
      w.vmax = Math.max(w.vmax, Math.hypot(a.vx, a.vy));
      if (s.t < a.runUntil) w.run = true; if (a.urgent) w.urg = true;
      const f2 = s.ball.flight; if (f2 && f2.passer === w.r && f2.receiver === w.a) w.ret = true;
      if (s.t - w.t0 >= 2) {
        const dir = attackDir(a.team, s.half);
        const adv = (a.x - w.x0) * dir; S.n++; S.adv.push(adv); if (adv >= 5) S.adv5++; if (w.run) S.run++; if (w.urg) S.urgent++; S.vmax.push(w.vmax); if (w.ret) S.ret++;
        watch.splice(k, 1);
      }
    }
  }
}
const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
console.log(`give-go · ${N}경기 4-2-3-1 ${TN} · 상대 진영 성공 패스 ${S.n} (${(S.n / N / 2).toFixed(0)}/팀·경기): 2초 동안 패서 전진 ${avg(S.adv).toFixed(1)} m (5 m+ ${((S.adv5 / S.n) * 100).toFixed(0)}%) · runUntil 섬 ${((S.run / S.n) * 100).toFixed(1)}% · urgent ${((S.urgent / S.n) * 100).toFixed(0)}% · 최고 속도 ${avg(S.vmax).toFixed(1)} m/s · 리턴 패스(2초 안 받은 선수 → 패서) ${((S.ret / S.n) * 100).toFixed(1)}%`);
