// @ts-nocheck — 진단 (C.82c): engine.test 이동 거리 팀(76:74) 시드 11~70 경기별 최다 평균 · 한 선수 최다(포지션·역할). npx vite-node scripts/diag/c82c-dist.ts -- [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const a = process.argv.slice(2).filter((x) => x !== '--');
for (const kv of a) { const [k, v] = kv.split('='); const p = k.split('.'); let o: any = ENGINE; for (const q of p.slice(0, -1)) o = o[q]; o[p[p.length - 1]] = Number(v); }
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
let sum = 0; const over: string[] = []; let mx = 0;
for (let seed = 11; seed <= 70; seed++) {
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  let top = 0;
  for (const p of r.players) { if (p.minutes < 85 || p.position === 'GK') continue; top = Math.max(top, p.distance); mx = Math.max(mx, p.distance); if (p.distance >= 15000) over.push(`시드 ${seed} ${p.position} ${p.role ?? ''} ${(p.distance / 1000).toFixed(2)}`); }
  sum += top;
}
console.log(`60시드 경기별 최다 평균 ${(sum / 60 / 1000).toFixed(3)} km · 한 선수 최다 ${(mx / 1000).toFixed(2)} km`);
console.log(over.join('\n'));
