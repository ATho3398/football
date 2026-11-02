// @ts-nocheck — 진단 스크립트 (C.80l): c80c-dist 와 같은 표본(76:74 시드 11~30 × 게겐 홈/원정, 상대 opp) — 게겐 팀 최다·평균, 경기 최다 분포(>14.5 개수·상위 5)
// 실행: npx vite-node scripts/diag/c80l-gate.ts -- [opp=tikitaka] [me=gegenpress] [seeds=20] [seed0=11] [tendency.X=v] [경로.X=v]
import { TENDENCY, tacticsOf } from '../../src/engine/tactics';
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
let opp = 'tikitaka', me = 'gegenpress', nSeeds = 20, seed0 = 11; const ovs = [];
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  if (a.startsWith('opp=')) opp = a.slice(4);
  else if (a.startsWith('me=')) me = a.slice(3);
  else if (a.startsWith('seeds=')) nSeeds = Number(a.slice(6));
  else if (a.startsWith('seed0=')) seed0 = Number(a.slice(6));
  else if (a.startsWith('tendency.')) { const [k, v] = a.split('='); TENDENCY[k.slice(9)] = Number(v); ovs.push(a); }
  else if (a.includes('=')) { const [k, v] = a.split('='); const ks = k.split('.'); let o = ENGINE; for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = Number(v); ovs.push(a); }
}
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
const tops = []; let avg = 0, cnt = 0, gf = 0, ga = 0; const allP = [];
for (const gHome of [true, false]) for (let seed = seed0; seed < seed0 + nSeeds; seed++) {
  const H = teamSetupFromRoster(home, 76, 74), A = teamSetupFromRoster(away, 74, 76);
  (gHome ? H : A).tactics = tacticsOf(me);
  (gHome ? A : H).tactics = tacticsOf(opp);
  const r = createMatch({ home: H, away: A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const g = gHome ? 0 : 1;
  const ps = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK' && p.team === g);
  ps.forEach((p) => { avg += p.distance; cnt++; allP.push(p.distance); });
  tops.push(Math.max(...ps.map((p) => p.distance)) / 1000);
  gf += gHome ? r.homeGoals ?? r.score?.[0] ?? 0 : r.awayGoals ?? r.score?.[1] ?? 0;
}
const n = tops.length, mu = tops.reduce((a, b) => a + b, 0) / n;
const sd = Math.sqrt(tops.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
const srt = [...tops].sort((a, b) => b - a);
console.log(`[${ovs.join(' ') || '기본'}] ${me} 대 ${opp} 시드 ${seed0}~${seed0 + nSeeds - 1} ×홈/원정 ${n}경기: 최다 평균 ${mu.toFixed(2)} (sd ${sd.toFixed(2)}) · 한 선수 최다 ${srt[0].toFixed(2)} · >14.5 ${tops.filter((v) => v > 14.5).length}경기 · 상위5 ${srt.slice(0, 5).map((v) => v.toFixed(2)).join(' ')} · 필드 평균 ${(avg / cnt / 1000).toFixed(2)}`);
process.exit(0);
