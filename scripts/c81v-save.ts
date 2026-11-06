// C.81v 캡처용 세이브: 사용 npx vite-node scripts/c81v-save.ts -- <mode> <out.json>
//  group1 = 월드클래스 손흥민 2019 아시안컵 조별 1차전 아침 (대표팀 경기 준비 전술 칸)
//  out    = 같은 흐름에서 한국이 떨어진 다음 날 아침 (남은 경기 날짜대로 · 휴가 · 소식)
//  title  = 리그 우승이 확정된 팀(더브라위너, 맨시티)의 리그 최종 라운드 아침 (우승 축하 오버레이 배경)
import { writeFileSync } from 'node:fs';
import { BALANCE } from '../src/config/balance';
import { clubSeasonOver, endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { ensureNational, myNationOut, tournamentState } from '../src/national';
import { serialize } from '../src/save';
import { sortedTable } from '../src/league';

const args = process.argv.slice(2).filter((a) => a !== '--');
const [mode, out] = [args[0]!, args[1]!];
const son = (seed: string) => {
  const g = newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });
  g.player.reputation = BALANCE.reputation.tierCuts.worldClass + 1;
  g.options = { others: 'quick' };
  return g;
};
let g: GameState | null = null;
if (mode === 'group1') {
  g = son('c81l');
  while (g.phase === 'season' && !clubSeasonOver(g)) playRound(g, { engine: 'quick' });
  while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
} else if (mode === 'out') {
  for (let k = 0; k < 12 && !g; k++) {
    const t = son(`c81v-${k}`);
    while (t.phase === 'season' && !clubSeasonOver(t)) playRound(t, { engine: 'quick' });
    const live = ensureNational(t).live;
    if (!live) continue;
    while (t.phase === 'season' && !myNationOut(t, live)) playRound(t, { engine: 'quick' });
    if (t.phase === 'season' && !tournamentState(t, live).done) g = t;
  }
} else if (mode === 'title') {
  for (let k = 0; k < 20 && !g; k++) {
    const t = newGame({ mode: 'real', playerId: 'de-bruyne', seed: `c81v-t${k}`, difficulty: 'normal' });
    t.options = { others: 'quick' };
    const L = t.league;
    while (t.phase === 'season' && L.round < L.schedule.length - 1) playRound(t, { engine: 'quick' });
    const tab = sortedTable(L);
    if (tab[0]!.teamId === t.player.teamId && tab[0]!.points - tab[1]!.points > 3) {
      while (t.phase === 'season' && !isMatchDay(t)) { playOthers(t, 'quick'); endDay(t); }
      g = t;
    }
  }
}
if (!g) throw new Error(`세이브 못 만듦: ${mode}`);
writeFileSync(out, serialize(g));
console.log(`${out}: ${g.calendar.date} round ${g.league.round}/${g.league.schedule.length} phase ${g.phase}`);
