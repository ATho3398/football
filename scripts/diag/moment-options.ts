// C.75v 결정 순간 선택지 보기: 선수 몇 명 × 라운드, 봇 정지마다 선택지(라벨·확률·기대 평점)를 찍는다 (extraEvGap·sureBackBelow 맞추기용)
// npx vite-node scripts/diag/moment-options.ts -- [포지션군당 선수 수=1] [라운드 수=1] [찍을 정지 수=40]
import { newGame, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';
import { bestChoice, optionValue, type MomentPolicy } from '../../src/engine/moments';
import { posGroup } from '../../src/roster';
import { setEnvironmentFixed } from '../../src/weather';

setEnvironmentFixed(true);
const args = process.argv.slice(2).filter((a) => a !== '--');
const perGroup = Number(args[0] ?? 1);
const rounds = Number(args[1] ?? 1);
let left = Number(args[2] ?? 40);
const KO = { safe: '안전', balanced: '균형', gamble: '도박', card: '카드' } as const;
const groups = ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB'];
const pool = selectableRealPlayers();
const picks = groups.flatMap((g) => pool.filter((p) => posGroup(p.position) === g).slice(0, perGroup));
const bot: MomentPolicy = (m) => {
  const c = bestChoice(m, Infinity);
  if (m.type === 'onball' && left-- > 0) {
    console.log(`${m.minute}' ${m.scene}${m.sureBack ? ' [확실한 선택지 다시 넣음]' : m.sure ? ` [확실한 것 뺌 · 맡기기 ${m.delegateEv?.toFixed(3)}]` : ''} → ${c === 'delegate' ? '맡기기' : typeof c === 'number' ? c : 'card'}`);
    m.options.forEach((o, i) => console.log(`   ${i} ${KO[o.kind]} ${o.label} ${o.p === null ? '-' : Math.round(o.p * 100) + '%'} ev ${optionValue(o).toFixed(3)}`));
  }
  return c;
};
for (const p of picks) {
  const g = newGame({ mode: 'real', playerId: p.id, seed: `moments-${p.id}`, difficulty: 'normal' });
  for (let k = 0; k < rounds && g.phase === 'season'; k++) {
    const rm = roundMatch(g);
    console.log(`== ${p.name} (${posGroup(p.position)}) R${k + 1}`);
    playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'important', policy: bot } });
  }
}
