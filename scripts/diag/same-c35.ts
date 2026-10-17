// 회귀 확인 (C.36): 카드 없는 경기(자동·맡기기)의 결과 해시. main(C.35)과 이 브랜치에서 같은 값이어야 한다
// vite-node scripts/diag/same-c35.ts -- [선수 수=6] [라운드=4]
import { createHash } from 'node:crypto';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 6);
const rounds = Number(args[1] ?? 4);
const pool = selectableRealPlayers();
const picks = [0, 7, 15, 30, 45, 60, 75, 90, 105, 120].map((i) => pool[i % pool.length]!).slice(0, n);
const h = createHash('sha256');
const hd = createHash('sha256');
let games = 0;
for (const p of picks) {
  const g = newGame({ mode: 'real', playerId: p.id, seed: `same-${p.id}`, difficulty: 'normal' });
  if ('cards' in g) (g as { cards?: unknown }).cards = undefined;
  for (let k = 0; k < rounds && g.phase === 'season'; k++) {
    const rm = roundMatch(g);
    const { cards: _c, ...input } = rm.input as typeof rm.input & { cards?: unknown };
    const auto = playMyMatch(input);
    h.update(JSON.stringify([auto.engine.homeGoals, auto.engine.awayGoals, auto.engine.players.map((x) => [x.id, x.rating, Math.round(x.distance)]), auto.engine.events.length]));
    if (rm.plan.minutes) {
      const del = playMyMatch({ ...input, control: { mode: 'direct', stop: 'important', policy: () => 'delegate' } });
      hd.update(JSON.stringify([del.engine.homeGoals, del.engine.awayGoals, del.engine.players.map((x) => [x.id, x.rating, Math.round(x.distance)]), del.engine.decisions.length]));
    }
    games++;
    playRound(g, { engineOut: auto });
  }
}
console.log(`경기 ${games} 자동 ${h.digest('hex').slice(0, 16)} 맡기기 ${hd.digest('hex').slice(0, 16)}`);
process.exit(0);
