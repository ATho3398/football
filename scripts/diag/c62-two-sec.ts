// C.62: cards.test "경기 계산 2초" 의 측정 구간(경기 2개)만 따로 잰다
import { starterDeck } from '../../src/config/cards';
import { playMyMatch } from '../../src/engine/adapter';
import { bestChoice } from '../../src/engine/moments';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { posGroup } from '../../src/roster';
const p = selectableRealPlayers().find((x) => posGroup(x.position) === 'CAM')!;
const g = newGame({ mode: 'real', playerId: p.id, seed: `cards-${p.id}`, difficulty: 'normal' });
let rm = roundMatch(g);
let r = 1;
for (let k = 0; k < 8 && !rm.plan.started; k++) { playRound(g); rm = roundMatch(g); r++; }
const deck = starterDeck('attack').map((c) => c.id);
for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  playMyMatch({ ...rm.input, cards: { deck } });
  const t1 = Date.now();
  playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'important', policy: (m) => bestChoice(m) } });
  console.log(`라운드 ${r} · 자동 ${t1 - t0}ms · 직접 ${Date.now() - t1}ms`);
}
