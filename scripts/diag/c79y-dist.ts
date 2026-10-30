// @ts-nocheck — 진단 스크립트 (엔진관리자23 c79y): engine.test 이동 거리 팀(76:74) 시드 11~30 최다 평균을 TENDENCY 스위치를 켠 채 잰다 (c79k-dist-seeds 와 같은 표본)
// 실행: npx vite-node scripts/diag/c79y-dist.ts -- [tendency.경로=값 …]
import { TENDENCY, tacticsOf } from '../../src/engine/tactics';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const overrides: Record<string, number> = {};
for (const a of process.argv.slice(2).filter((x) => x !== '--')) if (a.includes('=') && !a.startsWith('gegen=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
for (const [path, v] of Object.entries(overrides)) { if (!path.startsWith('tendency.')) throw new Error(path); (TENDENCY as Record<string, number>)[path.slice(9)] = v; }
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
const hs = teamSetupFromRoster(home, 76, 74), as = teamSetupFromRoster(away, 74, 76);
// gegen=1: 홈을 게겐, 원정을 티키로 (스위치가 걸리는 성향으로 같은 표본을 잰다)
if (process.argv.includes('gegen=1')) { hs.tactics = { ...hs.tactics, ...tacticsOf('gegenpress') }; as.tactics = { ...as.tactics, ...tacticsOf('tikitaka') }; }
console.log('성향', hs.tactics.tendency, as.tactics.tendency);
let sum = 0, n = 0, maxOne = 0, avgAll = 0, nAll = 0;
for (let seed = 11; seed <= 30; seed++) {
  const r = createMatch({ home: hs, away: as, mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const fs = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK');
  const top = Math.max(...fs.map((p) => p.distance));
  sum += top; n++; maxOne = Math.max(maxOne, top);
  for (const p of fs) { avgAll += p.distance; nAll++; }
}
console.log(`${JSON.stringify(overrides)}: 시드 11~30 최다 평균 ${(sum / n / 1000).toFixed(2)} km (기준 ≤ 14.1) · 한 선수 최다 ${(maxOne / 1000).toFixed(2)} (기준 < 15) · 필드 평균 ${(avgAll / nAll / 1000).toFixed(2)}`);
process.exit(0);
