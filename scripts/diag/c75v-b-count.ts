// C.75v B(확실한 선택지 다시 넣기) 발동 찾기: 포지션군 × 시드, 모든 순간 봇 경기에서 sureBack 정지 수와 첫 장면(시드·분)
import { newGame, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';
import { bestChoice, type MomentPolicy } from '../../src/engine/moments';
import { posGroup } from '../../src/roster';
const seeds = Number(process.argv.slice(2).filter((a) => a !== '--')[0] ?? 3);
let n = 0;
let tot = 0;
for (const grp of ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB']) {
  for (let k = 0; k < seeds; k++) {
    const p = selectableRealPlayers().find((x) => posGroup(x.position) === grp)!;
    const seed = `c75v-${k}-${p.id}`;
    const pol: MomentPolicy = (m) => {
      if (m.type === 'onball') tot++;
      if (m.sureBack) {
        n++;
        console.log(`${grp} ${seed} ${m.minute}' ${m.options.map((o) => `${o.label} ${Math.round((o.p ?? 0) * 100)}%`).join(' / ')}`);
      }
      return process.env.DELEGATE ? 'delegate' : bestChoice(m);
    };
    const g = newGame({ mode: 'real', playerId: p.id, seed, difficulty: 'normal' });
    playMyMatch({ ...roundMatch(g).input, control: { mode: 'direct', stop: 'all', policy: pol } });
  }
}
console.log(`sureBack ${n} / 소유 정지 ${tot}`);
