// 진단 (C.78e): realism.test 와 같은 입력으로 시드별 버티기·컷백 수
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
for (const a of process.argv.slice(2).filter((x) => x.includes('='))) { const [k, v] = a.split('='); const p = k!.split('.'); let o = ENGINE as unknown as Record<string, unknown>; for (const q of p.slice(0, -1)) o = o[q] as Record<string, unknown>; o[p.at(-1)!] = Number(v); }
const out: string[] = [];
for (let seed = 31; seed <= 44; seed++) {
  const home = createTeamRoster({ id: 'h', rating: 75 }, 'real-h', 2018, []);
  const away = createTeamRoster({ id: 'a', rating: 75 }, 'real-a', 2018, []);
  const r = createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true }).runToEnd();
  out.push(`${seed}:${r.teamStats[0].holdups + r.teamStats[1].holdups}/${r.teamStats[0].cutbacks + r.teamStats[1].cutbacks}`);
}
console.log('시드:버티기/컷백', out.join(' '));
process.exit(0);
