// @ts-nocheck — 진단 스크립트 (C.79t): tests/cards "0회 경기도 된다" 시드 찾기 (CDM·FB 결정적 순간만 정지 수, 최소 < 4)
import { playMyMatch } from '../../src/engine/adapter';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { posGroup } from '../../src/roster';
const [prefix = 'c79t-zero', n = '8'] = process.argv.slice(2).filter((a) => a !== '--');
for (let k = 0; k < Number(n); k++) {
  const out = [];
  for (const grp of ['CDM', 'FB']) {
    const p = selectableRealPlayers().find((x) => posGroup(x.position) === grp)!;
    const g = newGame({ mode: 'real', playerId: p.id, seed: `${prefix}-${k}-${p.id}`, difficulty: 'normal' });
    let rm; for (let i = 0; i < 8; i++) { rm = roundMatch(g); if (rm.plan.started) break; playRound(g); rm = null; }
    if (!rm) { out.push('선발없음'); continue; }
    out.push(playMyMatch({ ...rm.input, cards: { deck: [] }, control: { mode: 'direct', stop: 'critical', policy: () => 'delegate' } }).engine.decisions.length);
  }
  console.log(k, out.join(' '));
}
process.exit(0);
