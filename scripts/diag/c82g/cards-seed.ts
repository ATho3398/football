// @ts-nocheck C.82g: tests/cards.test.ts "최소 정지 보장 없음" 시드 재선택 — c82g-zero-0..12 의 CDM·FB 결정 수
import { playMyMatch } from '../../../src/engine/adapter';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../../src/game';
import { posGroup } from '../../../src/roster';
function game(group: string, seed: string) { const p = selectableRealPlayers().find((x) => posGroup(x.position) === group)!; return newGame({ mode: 'real', playerId: p.id, seed: `${seed}-${p.id}`, difficulty: 'normal' }); }
function startedRound(g) { for (let k = 0; k < 8; k++) { const rm = roundMatch(g); if (rm.plan.started) return rm; playRound(g); } throw new Error('선발 경기 없음'); }
for (let i = 0; i <= 12; i++) {
  const seed = `c82g-zero-${i}`; const counts = [];
  try { for (const grp of ['CDM', 'FB']) { const rm = startedRound(game(grp, seed)); counts.push(playMyMatch({ ...rm.input, cards: { deck: [] }, control: { mode: 'direct', stop: 'critical', policy: () => 'delegate' } }).engine.decisions.length); } } catch (e) { console.log(seed, '선발 아님'); continue; }
  console.log(seed, counts.join('·'), 'min', Math.min(...counts));
}
