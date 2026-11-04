// C.81c 내 경기 입력이 그날 다른 경기 결과와 무관한지: 경기 날 아침(다른 경기 전) 키 = 다른 경기 뒤 키 인가 (미리 계산 표가 맞는 비율)
import { endDay, isMatchDay, newGame, playOthers, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { specKey } from '../../src/ui/enginePool';
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 8);
let same = 0, total = 0;
for (const k of [0, 5]) {
  const real = selectableRealPlayers()[k]!;
  const g = newGame({ seed: `c81c-tk-${k}`, mode: 'real', playerId: real.id, difficulty: 'normal' });
  g.options = { quickOthers: true };
  let n = 0;
  while (n < N && g.phase === 'season') {
    if (!isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); continue; }
    const a = roundMatch(g);
    const ka = specKey({ kind: 'myr', input: a.input, teams: a.teams });
    playOthers(g, 'quick');
    const b = roundMatch(g);
    const kb = specKey({ kind: 'myr', input: b.input, teams: b.teams });
    total++; if (ka === kb) same++;
    else console.log('diff', g.calendar.date);
    playRound(g, {});
    n++;
  }
}
console.log(`same ${same}/${total}`);
