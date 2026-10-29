// @ts-nocheck — 진단 스크립트 (C.79k): tests/c75v sureBack 장면이 있는 CDM 시드 찾기
import { playMyMatch } from '../../src/engine/adapter';
import { bestChoice } from '../../src/engine/moments';
import { newGame, roundMatch, selectableRealPlayers } from '../../src/game';
import { posGroup } from '../../src/roster';
const [prefix = 'c79k', n = '20'] = process.argv.slice(2).filter((a) => a !== '--');
const p = selectableRealPlayers().find((x) => posGroup(x.position) === 'CDM')!;
for (let k = 0; k < Number(n); k++) {
  let sb = 0;
  const g = newGame({ mode: 'real', playerId: p.id, seed: `${prefix}-${k}-${p.id}`, difficulty: 'normal' });
  const rm = roundMatch(g);
  playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'all', policy: (m) => { if (m.type === 'onball' && m.sureBack) sb++; return bestChoice(m); } } });
  console.log(k, sb);
}
process.exit(0);
