// C.62 신뢰도 분포 점검: 가상 유망주·실제 선수 몇 시즌 빠른 경기로 돌려 시즌 끝 신뢰도·선발 수·면담 열린 횟수
import { newGame, playRound, startNextSeason, autoMarket } from '../../src/game';
import { playOthers, endDay, isMatchDay } from '../../src/game';
import { ensureManager } from '../../src/manager';

for (const opt of [{ mode: 'prospect' as const, position: 'ST' }, { mode: 'real' as const, playerId: 'son' }, { mode: 'real' as const, playerId: 'kane' }]) {
  for (const seed of ['a', 'b', 'c']) {
    const g = newGame({ ...opt, seed: `c62-${seed}`, difficulty: 'normal' } as never);
    const line: string[] = [];
    for (let season = 0; season < 4; season++) {
      const meet: Record<string, number> = {};
      let lowDays = 0;
      while (g.phase === 'season') {
        if (isMatchDay(g)) playRound(g, { engine: 'quick' });
        else { playOthers(g, 'quick'); endDay(g); }
        const m = ensureManager(g);
        if (m.meeting) meet[m.meeting] = (meet[m.meeting] ?? 0) + 1;
        if (m.trust < 30) lowDays++;
      }
      const h = g.player.history.at(-1)!;
      line.push(`${h.age}세 OVR${Math.round(g.player.history.at(-1)!.ovr ?? 0)} 선발${h.starts} 신뢰${Math.round(ensureManager(g).trust)} 면담${JSON.stringify(meet)}`);
      autoMarket(g, 'stay');
      startNextSeason(g);
    }
    console.log(opt.mode, (opt as { playerId?: string }).playerId ?? '', seed, '\n  ' + line.join('\n  '));
  }
}
