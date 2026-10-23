// 진단 (C.78e): rules.test "엔진으로 여러 라운드" 와 같은 진행(케인, 시드 e3-run, 6라운드) 뒤 피로·경기당 이동 거리. 경로=값 덮어쓰기
import { ENGINE } from '../../src/engine/config';
import { newGame, playRound } from '../../src/game';
for (const a of process.argv.slice(2).filter((x) => x.includes('='))) { const [k, v] = a.split('='); const p = k!.split('.'); let o = ENGINE as unknown as Record<string, unknown>; for (const q of p.slice(0, -1)) o = o[q] as Record<string, unknown>; o[p.at(-1)!] = Number(v); }
const g = newGame({ mode: 'real', playerId: 'kane', seed: 'e3-run', difficulty: 'normal' });
const fat: number[] = [];
while (g.league.round < 6) { playRound(g); fat.push(Math.round(g.player.fatigue)); }
console.log('피로', fat.join(' → '), '출전', g.player.season.apps);
process.exit(0);
