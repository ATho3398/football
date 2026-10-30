// @ts-nocheck — 진단 스크립트 (C.80c): c79k-dist-seeds 와 같은 팀(76:74) 시드 11~30, 한쪽을 게겐으로 놓고 게겐 팀 최다 이동 거리
// 실행: npx vite-node scripts/diag/c80c-dist.ts -- [opp=tikitaka] [tendency.gegenMarkN=0 …]
import { TENDENCY, tacticsOf } from '../../src/engine/tactics';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
let opp = 'tikitaka';
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  if (a.startsWith('opp=')) opp = a.slice(4);
  else if (a.startsWith('tendency.')) { const [k, v] = a.split('='); TENDENCY[k.slice(9)] = Number(v); }
}
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
let sum = 0, n = 0, maxOne = 0, avg = 0, cnt = 0;
for (const gHome of [true, false]) for (let seed = 11; seed <= 30; seed++) {
  const H = teamSetupFromRoster(home, 76, 74), A = teamSetupFromRoster(away, 74, 76);
  (gHome ? H : A).tactics = tacticsOf('gegenpress');
  (gHome ? A : H).tactics = tacticsOf(opp);
  const r = createMatch({ home: H, away: A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const ps = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK' && p.team === (gHome ? 0 : 1));
  const top = Math.max(...ps.map((p) => p.distance));
  ps.forEach((p) => { avg += p.distance; cnt++; });
  sum += top; n++; maxOne = Math.max(maxOne, top);
}
console.log(`게겐 대 ${opp} 시드 11~30 ×홈/원정: 게겐 최다 평균 ${(sum / n / 1000).toFixed(2)} km (기준 < 14.1) · 한 선수 최다 ${(maxOne / 1000).toFixed(2)} (< 15) · 게겐 필드 평균 ${(avg / cnt / 1000).toFixed(2)}`);
process.exit(0);
