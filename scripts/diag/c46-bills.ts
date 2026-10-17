// 시작 연봉 총액 최대값 (등급별, 시드 n개)
import { newGame } from '../../src/game';
import { financeTier, wageBill } from '../../src/finance';
const n = Number(process.argv[2] ?? 20);
const max: Record<string, number> = {};
for (let i = 0; i < n; i++) {
  const g = i % 4 === 3 ? newGame({ mode: 'real', playerId: ['kane', 'salah', 'son', 'pogba'][i % 4 === 3 ? (i / 4) % 4 | 0 : 0]!, seed: `b${i}`, difficulty: 'normal' } as any)
    : newGame({ mode: 'prospect', position: 'ST', seed: `b${i}`, difficulty: 'normal' } as any);
  for (const t of g.league.teams) { const k = `${financeTier(t.id)}:${t.id}`; max[k] = Math.max(max[k] ?? 0, wageBill(g.rosters, t.id, t.rating)); }
}
for (const [k, v] of Object.entries(max).sort()) console.log(k, Math.round(v / 10000));
