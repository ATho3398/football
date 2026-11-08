// 진단 (엔진 관리자 9대, pending 145 ②): 전술별 패스 방향 분포 — 뒤로 5 m+ · 압박 없음(2.5 m 안 상대 0) 비율과 그 순간 앞쪽 열린 동료 유무. 엔진 코드는 건드리지 않는다.
// npx vite-node scripts/diag/backpass.ts -- [경기수=30] <전술 ...>   (홈 = 전술, 원정 = 균형, 생성 75:75 4-4-2)
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency, TeamSetup } from '../../src/engine/types';
import { attackDir, dist, toNorm } from '../../src/engine/pitch';
import { FORMATION_SLOTS } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
// 경로=값 인자로 ENGINE 상수 덮어쓰기 (C.77y: 새 동작 상수가 꺼져 있어 켠 값으로 잰다)
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 30);
const TACS = (args.slice(1).length ? args.slice(1) : ['tikitaka', 'balanced', 'gegenpress', 'direct', 'counter', 'bus']) as Tendency[];
const mk = (side: string, i: number, tn: Tendency): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagR-${side}-${i}`, 2018, []);
  r.formation = '4-4-2';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wR${i}`);
  s.tactics = tacticsOf(tn);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};
for (const tn of TACS) {
  const S = { n: 0, fwd: 0, side: 0, back: 0, back5free: 0, back5freeOpen: 0, back5freeMid: 0, backAtt: 0, ownHalfBack: 0, seqMax: [] as number[] };
  for (let i = 0; i < N; i++) {
    const m = createMatch({ home: mk('H', i, tn), away: mk('A', i, 'balanced'), mode: 'auto', difficulty: 'normal', seed: 9100 + i, bigMatch: false, neutral: true });
    const s = m.state;
    let prevFlight: unknown = null;
    let seq = 0, poss = -1;
    while (!s.done) {
      m.step();
      const fl = s.ball.flight;
      if (s.possTeam !== poss) { if (poss === 0) S.seqMax.push(seq); seq = 0; poss = s.possTeam; }
      if (!fl || fl === prevFlight) { prevFlight = fl; continue; }
      prevFlight = fl;
      if (fl.kind !== 'pass' && fl.kind !== 'long') continue;
      const a = s.agents[fl.passer]; if (!a || a.team !== 0) continue;
      const dir = attackDir(0, s.half);
      const dx = (fl.toX - fl.fromX) * dir;
      S.n++;
      if (dx > 3) S.fwd++; else if (dx < -3) S.back++; else S.side++;
      if (dx <= -5) {
        let near = Infinity;
        for (const o of s.agents) if (o.onPitch && o.team === 1) near = Math.min(near, dist(o.x, o.y, fl.fromX, fl.fromY));
        const [nx] = toNorm(fl.fromX, fl.fromY, dir);
        if (nx > 2 / 3) S.backAtt++;
        if (nx >= 0.5 && toNorm(fl.toX, fl.toY, dir)[0] < 0.5) S.ownHalfBack++;
        if (near > 2.5) {
          S.back5free++; seq++;
          if (nx >= 1 / 3 && nx <= 2 / 3) S.back5freeMid++;
          // 앞쪽 열린 동료: 패서보다 8 m+ 앞, 3 m 안 상대 없음, 35 m 안
          const open = s.agents.some((o) => o.onPitch && o.team === 0 && o !== a && o.line > 0 && (o.x - fl.fromX) * dir > 8 && dist(o.x, o.y, fl.fromX, fl.fromY) < 35
            && !s.agents.some((d) => d.onPitch && d.team === 1 && dist(d.x, d.y, o.x, o.y) < 3));
          if (open) S.back5freeOpen++;
        }
      }
    }
  }
  const pc = (x: number) => `${((x / S.n) * 100).toFixed(1)}%`;
  const seq3 = S.seqMax.filter((x) => x >= 3).length;
  console.log(`${tn}: 패스 ${(S.n / N).toFixed(0)}/경기 · 전진 ${pc(S.fwd)} · 옆 ${pc(S.side)} · 뒤 ${pc(S.back)} | 뒤 5 m+ 압박 없음 ${pc(S.back5free)} (${(S.back5free / N).toFixed(1)}/경기, 중원 ${(S.back5freeMid / N).toFixed(1)}) · 그중 앞 열린 동료 있음 ${((S.back5freeOpen / Math.max(1, S.back5free)) * 100).toFixed(0)}% (${(S.back5freeOpen / N).toFixed(1)}/경기) · 공격 1/3 에서 뒤 ${(S.backAtt / N).toFixed(1)} · 하프라인 넘어 자기 진영으로 ${(S.ownHalfBack / N).toFixed(1)} · 한 소유 안 압박 없는 백패스 3회+ ${(seq3 / N).toFixed(1)}/경기`);
}
