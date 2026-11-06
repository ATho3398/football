// @ts-nocheck — 진단 (C.80n): engine.test 이동 거리 팀(76:74) 시드 11~30 경기별 최다. npx vite-node scripts/diag/c80n-dist.ts -- [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const a = process.argv.slice(2).filter((x) => x !== '--');
for (const kv of a) { const [k, v] = kv.split('='); const p = k.split('.'); let o: any = ENGINE; for (const q of p.slice(0, -1)) o = o[q]; o[p[p.length - 1]] = Number(v); }
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
let sum = 0;
for (let seed = 11; seed <= 30; seed++) {
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  let top = { d: 0, pos: '', t: 0 };
  for (const p of r.players) if (p.minutes >= 85 && p.position !== 'GK' && p.distance > top.d) top = { d: p.distance, pos: p.position, t: p.team };
  sum += top.d;
  console.log(seed, (top.d / 1000).toFixed(2), top.pos, top.t);
}
console.log('avg', (sum / 20 / 1000).toFixed(3));
