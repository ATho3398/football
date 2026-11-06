// 45b(b) 브라우저 측정용 세이브: PL 유망주 + 14개 리그 전부 / 기본 6개 (새 게임 그대로)
import { writeFileSync, mkdirSync } from 'node:fs';
import { allLeagueData } from '../../data/leagues';
import { newGame } from '../../src/game';
import { exportSave } from '../../src/save';

const out = process.argv.slice(2).find((a) => a !== '--') ?? '.';
mkdirSync(out, { recursive: true });
const all = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-br', difficulty: 'normal', leagues: allLeagueData().map((d) => d.id) });
writeFileSync(`${out}/c76h-14.fcsave.gz`, await exportSave(all));
const six = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-br', difficulty: 'normal', leagues: ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'championship'] });
writeFileSync(`${out}/c76h-6.fcsave.gz`, await exportSave(six));
console.log('ok', all.calendar.date);
