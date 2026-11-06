// C.76m 측정용 세이브: 바쁜 날(내 경기 없는 날 중 다른 경기가 가장 많은 날) 아침까지 빠른 진행. 14개 리그 / 기본 6개
import { writeFileSync, mkdirSync } from 'node:fs';
import { allLeagueData } from '../../data/leagues';
import { endDay, isMatchDay, newGame, playOthers, playRound, upcomingOthers, type GameState } from '../../src/game';
import { exportSave } from '../../src/save';
import { addDays } from '../../src/calendar';

const out = process.argv.slice(2).find((a) => a !== '--') ?? '.';
mkdirSync(out, { recursive: true });

async function make(name: string, leagues: string[]): Promise<void> {
  const g: GameState = newGame({ mode: 'prospect', position: 'ST', seed: 'c76m-br', difficulty: 'normal', leagues });
  // 처음 30일 중 바쁜 날 고르기 (같은 시드 복제로 미리 본다)
  const probe = JSON.parse(JSON.stringify(g)) as GameState;
  let best = { date: '', n: 0 };
  for (let k = 0; k < 30; k++) {
    const n = upcomingOthers(probe, 1, 0).length;
    if (!isMatchDay(probe) && n > best.n) best = { date: probe.calendar.date, n };
    if (isMatchDay(probe)) playRound(probe, { engine: 'quick', others: 'quick' });
    else { playOthers(probe, 'quick'); endDay(probe); }
  }
  while (g.calendar.date !== best.date) {
    if (isMatchDay(g)) playRound(g, { engine: 'quick', others: 'quick' });
    else { playOthers(g, 'quick'); endDay(g); }
  }
  writeFileSync(`${out}/c76m-${name}.fcsave.gz`, await exportSave(g));
  console.log(name, best, 'next day', upcomingOthers(g, 2).length - best.n, addDays(best.date, 1));
}
await make('14', allLeagueData().map((d) => d.id));
await make('6', ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'championship']);
