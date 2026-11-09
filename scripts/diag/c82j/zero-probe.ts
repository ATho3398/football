// @ts-nocheck C.82j: tests/cards.test.ts "최소 정지 보장 없음" 시드 탐색 — c82j-zero-N 의 CDM·FB 결정 횟수(최소 < 4 필요)
import { playMyMatch } from '../../../src/engine/adapter';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../../src/game';
import { posGroup } from '../../../src/roster';
function game(group, seed) { const p = selectableRealPlayers().find((x) => posGroup(x.position) === group)!; return newGame({ mode: 'real', playerId: p.id, seed: `${seed}-${p.id}`, difficulty: 'normal' }); }
function startedRound(g) { for (let k = 0; k < 8; k++) { const rm = roundMatch(g); if (rm.plan.started) return rm; playRound(g); } return null; }
for (let i = 0; i < 10; i++) {
  const counts = [];
  for (const grp of ['CDM', 'FB']) { const g = game(grp, `c82j-zero-${i}`); const rm = startedRound(g); if (!rm) { counts.push(-1); continue; } counts.push(playMyMatch({ ...rm.input, cards: { deck: [] }, control: { mode: 'direct', stop: 'critical', policy: () => 'delegate' } }).engine.decisions.length); }
  console.log(`c82j-zero-${i}`, counts.join('/'), Math.min(...counts) < 4 && counts.every((c) => c >= 0) ? '✓' : '✗');
}
process.exit(0);
