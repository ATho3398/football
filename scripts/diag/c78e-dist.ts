// 진단 (C.78e): 엔진 테스트(seed 11, 76 대 74 생성 팀) 경기의 필드 선수 이동 거리 상위 — 측면 미드 전력 질주 확인. 경로=값 덮어쓰기
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
for (const a of process.argv.slice(2).filter((x) => x.includes('='))) { const [k, v] = a.split('='); const p = k!.split('.'); let o = ENGINE as unknown as Record<string, Record<string, unknown>>; for (const q of p.slice(0, -2)) o = o[q] as never; (o[p.at(-2)!] as Record<string, unknown>)[p.at(-1)!] = Number(v); }
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
for (const seed of [11, 12, 13]) {
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const top = r.players.filter((p) => p.position !== 'GK' && p.minutes >= 85).sort((a, b) => b.distance - a.distance).slice(0, 4);
  console.log(seed, home.formation, away.formation, top.map((p) => `${p.position} ${(p.distance / 1000).toFixed(2)}`).join(' · '));
}
process.exit(0);
