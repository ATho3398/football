// @ts-nocheck — 진단 스크립트 (엔진관리자24 c80g): c80c-dist 와 같되 ENGINE 상수 덮어쓰기(prob.contestOut=1 …)도 받는다 — 양 팀 이동 거리 (게겐·상대)
// 실행: npx vite-node scripts/diag/c80g-dist.ts -- [opp=tikitaka] [tendency.x=…] [prob.contestOut=1 …]
import { TENDENCY, tacticsOf } from '../../src/engine/tactics';
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
let opp = 'tikitaka';
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  if (a.startsWith('opp=')) opp = a.slice(4);
  else if (a.startsWith('tendency.')) { const [k, v] = a.split('='); TENDENCY[k.slice(9)] = Number(v); }
  else if (a.includes('=')) { const [k, v] = a.split('='); const ks = k.split('.'); let o = ENGINE; for (const q of ks.slice(0, -1)) o = o[q]; o[ks[ks.length - 1]] = Number(v); }
}
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
let sum = 0, n = 0, maxOne = 0, avg = 0, cnt = 0, sumO = 0, maxO = 0, avgO = 0, cntO = 0;
for (const gHome of [true, false]) for (let seed = 11; seed <= 30; seed++) {
  const H = teamSetupFromRoster(home, 76, 74), A = teamSetupFromRoster(away, 74, 76);
  (gHome ? H : A).tactics = tacticsOf('gegenpress');
  (gHome ? A : H).tactics = tacticsOf(opp);
  const r = createMatch({ home: H, away: A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const ps = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK' && p.team === (gHome ? 0 : 1));
  const qs = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK' && p.team !== (gHome ? 0 : 1));
  const top = Math.max(...ps.map((p) => p.distance));
  const topO = Math.max(...qs.map((p) => p.distance));
  ps.forEach((p) => { avg += p.distance; cnt++; });
  qs.forEach((p) => { avgO += p.distance; cntO++; });
  sum += top; n++; maxOne = Math.max(maxOne, top); sumO += topO; maxO = Math.max(maxO, topO);
}
console.log(`게겐 대 ${opp} 시드 11~30 ×홈/원정: 게겐 최다 평균 ${(sum / n / 1000).toFixed(2)} km (기준 < 14.1) · 한 선수 최다 ${(maxOne / 1000).toFixed(2)} (< 15) · 게겐 필드 평균 ${(avg / cnt / 1000).toFixed(2)} | ${opp} 최다 평균 ${(sumO / n / 1000).toFixed(2)} · 한 선수 최다 ${(maxO / 1000).toFixed(2)} · 필드 평균 ${(avgO / cntO / 1000).toFixed(2)}`);
process.exit(0);
