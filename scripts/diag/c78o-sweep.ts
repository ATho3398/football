// C.78o: 자동 vs 직접(전부 맡기기) 넓은 비교 — 포지션군 × 선수 × 라운드, 화면 경로(정책 없음)·정책 경로 둘 다
// 실행: npx vite-node scripts/diag/c78o-sweep.ts -- [군 인덱스] [선수 수] [라운드]
import { MyMatchRun } from '../../src/engine/adapter';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { posGroup } from '../../src/roster';
const [gi, np, nr] = process.argv.filter((a) => /^\d+$/.test(a)).map(Number);
const g = ['ST', 'WING', 'CM', 'CB', 'FB', 'CAM', 'GK'][gi!]!;
let diff = 0, n = 0;
for (const p of selectableRealPlayers().filter((x) => posGroup(x.position) === g).slice(0, np)) {
  const gs = newGame({ mode: 'real', playerId: p.id, seed: `sw-${p.id}`, difficulty: 'normal' });
  for (let r = 0; r < nr!; r++) {
    const rm = roundMatch(gs);
    if (rm.plan.started) {
      const A = new MyMatchRun(rm.input); A.sim.runToEnd(); const ra = A.finish().engine;
      for (const stop of ['important', 'all'] as const) {
        const D = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop } });
        let k = 0;
        while (D.advance()) { k++; if (D.pending?.type === 'halftime') D.halftime(null); else D.resolve('delegate'); }
        const rd = D.finish().engine;
        const P = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop, policy: () => 'delegate' } }); P.sim.runToEnd(); const rp = P.finish().engine;
        n++;
        const ea = JSON.stringify([ra.events, ra.players]);
        const bad = [JSON.stringify([rd.events, rd.players]) !== ea ? '화면' : '', JSON.stringify([rp.events, rp.players]) !== ea ? '정책' : ''].filter(Boolean);
        if (bad.length) { diff++; console.log(`${g} ${p.id} r${r} ${stop} 정지 ${k}: 다름(${bad.join(',')}) 자동 ${ra.homeGoals}-${ra.awayGoals} 화면 ${rd.homeGoals}-${rd.awayGoals} 정책 ${rp.homeGoals}-${rp.awayGoals}`); }
      }
    }
    playRound(gs);
  }
}
console.log(`${g}: 다름 ${diff}/${n}`);
