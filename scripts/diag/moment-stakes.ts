// 진단 (C.34): 내 선수 결정 시점의 중요도 분포. 임계값 0·간격 0으로 모든 결정 시점을 기록하고, 간격 gap 을 둔 채
// 임계값마다 경기당 턴 수를 다시 센다 (포지션군별). vite-node scripts/diag/moment-stakes.ts -- [포지션군당 선수=3] [라운드=8]
import { autoAllocate } from '../../src/growth';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';
import { ENGINE } from '../../src/engine/config';
import { posGroup } from '../../src/roster';

const args = process.argv.slice(2).filter((a) => a !== '--');
const perGroup = Number(args[0] ?? 3);
const rounds = Number(args[1] ?? 8);
const M = ENGINE.moments;
const gap = M.gap;
const groups = ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB'];
const pool = selectableRealPlayers();
const picks = groups.flatMap((g) => pool.filter((p) => posGroup(p.position) === g).slice(0, perGroup));
const byGroup: Record<string, { t: number; stake: number }[][]> = {};
for (const p of picks) {
  const g = newGame({ mode: 'real', playerId: p.id, seed: `moments-${p.id}`, difficulty: 'normal' });
  for (let k = 0; k < rounds && g.phase === 'season'; k++) {
    const rm = roundMatch(g);
    const auto = playMyMatch(rm.input);
    if (rm.plan.started && auto.my) {
      const saved = { th: { ...M.threshold }, gap: M.gap, max: M.maxStops, min: M.minStops };
      for (const k2 of Object.keys(M.threshold)) M.threshold[k2] = 0;
      (M as { gap: number }).gap = 0;
      (M as { maxStops: number }).maxStops = 9999;
      (M as { minStops: number }).minStops = 0;
      const o = playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'important', policy: () => 'delegate' } });
      Object.assign(M.threshold, saved.th);
      (M as { gap: number }).gap = saved.gap;
      (M as { maxStops: number }).maxStops = saved.max;
      (M as { minStops: number }).minStops = saved.min;
      const grp = posGroup(auto.my.position);
      (byGroup[grp] ??= []).push(o.engine.decisions.map((d) => ({ t: d.e, stake: d.stake })));
    }
    playRound(g, { engineOut: auto });
    autoAllocate(g.player);
  }
}
const ths = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0, 1.2];
console.log(`gap ${gap}s. 포지션군 | 경기 | 결정 시점 | 임계값별 경기당 턴: ${ths.join(' ')}`);
for (const grp of groups) {
  const ms = byGroup[grp];
  if (!ms) continue;
  const counts = ths.map((th) => {
    let tot = 0;
    for (const list of ms) {
      let last = -100;
      for (const d of list) if (d.stake >= th && d.t - last >= gap) { tot++; last = d.t; }
    }
    return (tot / ms.length).toFixed(1);
  });
  console.log(`${grp} | ${ms.length} | ${(ms.reduce((t, l) => t + l.length, 0) / ms.length).toFixed(0)} | ${counts.join(' ')}`);
}
process.exit(0);
