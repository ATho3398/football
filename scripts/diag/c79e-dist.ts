// @ts-nocheck — 진단 스크립트 (엔진관리자16, C.79e)
// engine.test 이동 거리 팀(76:74) 시드 11~30 경기별 최다 평균 (테스트 기준 < 14.1 km) 을 경로=값 덮어쓰기로 잰다.
// 실행: npx vite-node scripts/diag/c79e-dist.ts -- [경로=값 …]
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const overrides: Record<string, number> = {};
for (const a of process.argv.slice(2).filter((x) => x !== '--')) if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = v;
}
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
let sum = 0, n = 0, six = 0, maxOne = 0;
// 엔진관리자19: 포지션별 평균 · 최다 선수의 포지션 (어디서 늘어나는지)
const byPos: Record<string, number[]> = {};
let maxPos = '';
for (let seed = 11; seed <= 30; seed++) {
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const full = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK');
  const top = Math.max(...full.map((p) => p.distance));
  for (const p of full) { (byPos[p.position] ??= []).push(p.distance); if (p.distance === top && top > maxOne) maxPos = `${p.position} 시드 ${seed}`; }
  sum += top; n++; if (seed <= 16) six += top; maxOne = Math.max(maxOne, top);
}
console.log('포지션별 평균 km: ' + Object.entries(byPos).map(([k, v]) => `${k} ${(v.reduce((a, b) => a + b, 0) / v.length / 1000).toFixed(2)}`).join(' · ') + ` · 최다 선수 ${maxPos}`);
console.log(`${JSON.stringify(overrides)}: 시드 11~30 최다 평균 ${(sum / n / 1000).toFixed(2)} km (기준 < 14.1) · 11~16 평균 ${(six / 6 / 1000).toFixed(2)} · 한 선수 최다 ${(maxOne / 1000).toFixed(2)} (기준 < 15)`);
process.exit(0);
