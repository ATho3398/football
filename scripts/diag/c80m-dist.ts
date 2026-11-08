// @ts-nocheck — 진단 스크립트 (C.80g, C.80m: S0·S1 시드 범위): engine.test 이동 거리 팀(76:74) 시드 11~30 경기별 최다 · 평균. 경로=값 덮어쓰기
// npx vite-node scripts/diag/c80g-dist.ts -- [prob.contestOut=0 …]
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const ov = process.argv.slice(2).filter((x) => x.includes('='));
for (const a of ov) { const [k, v] = a.split('='); const ks = k!.split('.'); let o = ENGINE; for (const q of ks.slice(0, -1)) o = (o[q] ??= {}); o[ks.at(-1)!] = Number(v); }
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
let sum = 0, mx = 0; const tops = [];
const S0 = Number(process.env.S0 ?? 11), S1 = Number(process.env.S1 ?? 30);
for (let seed = S0; seed <= S1; seed++) {
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const top = Math.max(...r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK').map((p) => p.distance));
  sum += top; mx = Math.max(mx, top); tops.push((top / 1000).toFixed(2));
}
console.log(`${ov.join(' ') || '기본'}: 시드 ${S0}~${S1} 최다 평균 ${(sum / 1000 / (S1 - S0 + 1)).toFixed(2)} km · 최다 ${(mx / 1000).toFixed(2)} · ${tops.join(' ')}`);
process.exit(0);
