// C.77w 컵 득점자 전후 (진단): FA컵 32강 각 팀에서 옛 방식(OVR 상위 squadTop, 포지션군 가중) 득점 확률 중 그 경기 출전 명단 밖 몫, 새 방식(출전 명단 × 분/90)은 0
// npx vite-node scripts/diag/c77w-cup.ts
import { BALANCE } from '../../src/config/balance';
import { cupLines } from '../../src/cups';
import { newGame } from '../../src/game';
import { naturalOvr, posGroup } from '../../src/roster';
let outMass = 0, teams = 0, gkMin = 0, subMin = 0;
for (const seed of ['w1', 'w2', 'w3']) {
  const g = newGame({ mode: 'real', playerId: 'salah', seed: `c77w-${seed}`, difficulty: 'normal' });
  const fa = g.cups!.fa!;
  for (const t of fa.rounds[0]!) for (const id of [t.h, t.a]) {
    const r = g.rosters?.[id];
    if (!r) continue;
    const ls = cupLines(g, id, fa.dates[0]!);
    const on = new Set(ls.map((l) => l.id));
    const top = r.players.map((p) => ({ id: p.id, w: BALANCE.cups.scorerWeight[posGroup(p.position)], o: naturalOvr(p) })).sort((a, b) => b.o - a.o).slice(0, BALANCE.cups.squadTop);
    const tot = top.reduce((s, x) => s + x.w, 0);
    outMass += top.filter((x) => !on.has(x.id)).reduce((s, x) => s + x.w, 0) / tot;
    teams++;
    gkMin += ls.filter((l) => r.players.find((p) => p.id === l.id)!.position === 'GK').reduce((s, l) => s + l.minutes, 0);
    subMin += ls.filter((l) => l.sub).reduce((s, l) => s + l.minutes, 0);
  }
}
console.log(`내 리그 팀 ${teams}: 옛 방식 득점 확률 중 미출전 선수 몫 ${(outMass / teams * 100).toFixed(1)}% → 새 0% · 팀당 출전 분 770 → 990 (GK ${(gkMin / teams).toFixed(0)}분, 교체 ${(subMin / teams).toFixed(0)}분)`);
