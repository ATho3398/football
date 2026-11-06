// @ts-nocheck — 진단 스크립트 (C.80l): 게겐(me=) 대 티키 76:74 시드 11~20 × 홈/원정, 선발 선수별 "스태미나 5 아래로 처음 떨어진 분 / 그 아래 머문 분 / 체력 능력치"
// 실행: npx vite-node scripts/diag/c80l-stam.ts -- [me=balanced] [tendency.gegenFatigue=0]
import { TENDENCY, tacticsOf } from '../../src/engine/tactics';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
for (const a of process.argv.slice(2)) if (a.startsWith('tendency.')) { const [k, v] = a.split('='); TENDENCY[k.slice(9)] = Number(v); }
const me = process.argv.slice(2).find((a) => a.startsWith('me='))?.slice(3) ?? 'gegenpress';
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
const byPos = {};
for (const gHome of [true, false]) for (let seed = 11; seed < 21; seed++) {
  const H = teamSetupFromRoster(home, 76, 74), A = teamSetupFromRoster(away, 74, 76);
  const g = gHome ? 0 : 1;
  (gHome ? H : A).tactics = tacticsOf(me); (gHome ? A : H).tactics = tacticsOf('tikitaka');
  const m = createMatch({ home: H, away: A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false }); const s = m.state;
  const first = new Map(); const low = new Map(); let n = 0;
  while (!s.done) { m.step(); n++; for (const a of s.agents) if (a.team === g && a.onPitch && a.line !== 0) { if (a.stamina < 5 && !first.has(a)) first.set(a, s.t / 60); if (a.stamina < 5) low.set(a, (low.get(a) ?? 0) + 0.1); } }
  for (const a of s.agents) if (a.team === g && a.line !== 0 && a.onPitch) { const k = `${gHome ? 'H' : 'A'}${a.pos}`; byPos[k] ??= []; byPos[k].push(`${first.has(a) ? first.get(a).toFixed(0) : '-'}/${((low.get(a) ?? 0) / 60).toFixed(0)}/${a.attrs.stamina.toFixed(0)}`); }
}
for (const [k, v] of Object.entries(byPos)) console.log(k, v.slice(0, 10).join(' '));
process.exit(0);
