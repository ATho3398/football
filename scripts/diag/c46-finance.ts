// C.46 구단 재정 측정: 시작 연봉 총액·상한 대비, 몸값 예시, 로스터 인원 (vite-node scripts/diag/c46-finance.ts [시드 수])
import { newGame } from '../../src/game';
import { financeTier, npcValue, valueLabel, wageBill, wageCap, remainingBudget } from '../../src/finance';
import { squadCount } from '../../src/squad';
import { naturalOvr } from '../../src/roster';

const seeds = Number(process.argv[2] ?? 3);
const bills: Record<string, number[]> = {};
for (let i = 0; i < seeds; i++) {
  const g = newGame({ mode: 'prospect', name: '테스트', position: 'ST', difficulty: 'normal', seed: `c46-${i}` } as any);
  for (const t of g.league.teams) {
    (bills[t.id] ??= []).push(wageBill(g.rosters, t.id, t.rating));
  }
  if (i === 0) {
    for (const t of g.league.teams) {
      const c = squadCount(g.rosters[t.id]!.players);
      console.log(t.id, financeTier(t.id), t.rating, `인원 ${c.total} (21세 초과 ${c.senior}, U21 ${c.u21}, 비자국 육성 ${c.nonHg})`, `예산 ${valueLabel(remainingBudget(g, t.id, 2018))}`);
    }
    const all = Object.values(g.rosters).flatMap((r) => r.players);
    for (const id of ['kane', 'salah', 'de-bruyne', 'alexander-arnold', 'foden', 'son', 'hazard', 'aguero']) {
      const p = all.find((x) => x.id === id);
      if (p) console.log('몸값', p.nameKo, naturalOvr(p), p.age, p.contractEnd, valueLabel(npcValue(p, 2019)));
    }
  }
}
for (const [id, b] of Object.entries(bills)) {
  const avg = b.reduce((a, x) => a + x, 0) / b.length;
  console.log(id, financeTier(id), `연봉 총액 평균 ${(avg / 10000).toFixed(0)}억 / 상한 ${(wageCap(id) / 10000).toFixed(0)}억 = ${(avg / wageCap(id) * 100).toFixed(0)}%`);
}
