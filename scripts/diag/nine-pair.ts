// 진단 (C.77d 가설 0): 생성 4-3-3 팀에 성향 추천 역할을 채웠을 때 펄스 나인 팀의 짝(윙 둘 다 run ≥ 0.7, 공격형 CM/CAM run ≥ 0.5) 비율. 엔진 무수정
// 실행: npx vite-node scripts/diag/nine-pair.ts -- [팀 수=300] [성향=tikitaka]
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { ROLES } from '../../src/engine/roles';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { FORMATION_SLOTS } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';

const args = process.argv.slice(2).filter((a) => a !== '--');
const N = Number(args[0] ?? 300);
const tendency = (args[1] ?? 'tikitaka') as Tendency;
let nine = 0, wings = 0, mate = 0, both = 0;
const combos = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const r = createTeamRoster({ id: `vP${i}`, rating: 75 }, `diagP-${i}`, 2018, []);
  r.formation = '4-3-3';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wP${i}`);
  s.tactics = tacticsOf(tendency);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  const role = (slot: number) => s.lineup.find((p) => p.slot === slot)?.role ?? '';
  if (!s.lineup.some((p) => p.role === 'falseNine')) continue;
  nine++;
  const w = [8, 10].every((sl) => (ROLES[role(sl)]?.run ?? 0) >= 0.7);
  const m = [6, 7].some((sl) => (ROLES[role(sl)]?.run ?? 0) >= 0.5);
  if (w) wings++;
  if (m) mate++;
  if (w && m) both++;
  const key = [5, 6, 7].map(role).join('+');
  combos.set(key, (combos.get(key) ?? 0) + 1);
}
const pct = (x: number) => `${((100 * x) / Math.max(1, nine)).toFixed(0)}%`;
console.log(`nine-pair · ${N}팀 4-3-3 ${tendency}: 펄스 나인 팀 ${nine} · 윙 둘 다 run ≥ 0.7 ${pct(wings)} · 공격형 CM ≥ 1 ${pct(mate)} · 짝 완성 ${pct(both)}`);
for (const [k, v] of [...combos].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`  ${k} ${pct(v)}`);
