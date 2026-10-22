// C.77n 진단: balance.ts "실제 선수 정점 여지 적중" 가드에서 벗어난 실제 선수(25~27세 출발) 의 정점 여지 + 부상 풀타임 환산(30세 전후)을
// 누적 부하 켬/끔으로 빠르게 비교 (최적 배분 autoAllocate, 빠른 경기, 같은 시드 real-all-<id>-<i>)
// 실행: npx vite-node scripts/diag/c77n-peak.ts -- [시드 수=6]   환경 변수 LOAD_OFF=1 (부하 전부 끔) · AGE_OFF=1 (노쇠 가산만 끔) · INJ_OFF=1 (부상 가산만 끔)
import { newGame, playRound, startNextSeason } from '../../src/game';
import { autoAllocate, playerOvr } from '../../src/growth';
import { BALANCE } from '../../src/config/balance';
import { setEnvironmentFixed } from '../../src/weather';

setEnvironmentFixed(true);
const L = BALANCE.load as { on: boolean; maxShift: number; maxRate: number; injuryPerPoint: number };
if (process.env.LOAD_OFF === '1') L.on = false;
if (process.env.AGE_OFF === '1') { L.maxShift = 0; L.maxRate = 0; }
if (process.env.INJ_OFF === '1') L.injuryPerPoint = 0;
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 6);
const IDS = (process.env.IDS ?? 'salah,van-dijk,mane,son,pogba').split(',');
const inj = [0, 0];
const min = [0, 0];
const loads: number[] = [];
for (const id of IDS) {
  const deltas: number[] = [];
  let room = 0;
  for (let i = 0; i < N; i++) {
    const s = newGame({ mode: 'real', playerId: id, seed: `real-all-${id}-${i}`, difficulty: 'normal' });
    const start = playerOvr(s.player);
    room = s.player.peakTarget! - start;
    let peak = start;
    while (s.player.age < 34) {
      while (s.phase === 'season') {
        playRound(s, { engine: 'quick' });
        autoAllocate(s.player);
      }
      autoAllocate(s.player);
      loads.push(s.player.wear ?? 0);
      const h = s.player.history.at(-1)!;
      const k = h.age >= 30 ? 1 : 0;
      inj[k]! += h.injuries;
      min[k]! += h.minutes;
      peak = Math.max(peak, playerOvr(s.player));
      if (s.phase !== 'offseason') break;
      startNextSeason(s);
    }
    deltas.push(peak - start);
  }
  const d = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  console.log(`${id} 목표 +${room.toFixed(0)} 결과 +${d.toFixed(1)} ${Math.abs(d - room) <= 1.5 ? '✓' : '✗'}`);
}
const p38 = (k: number) => ((inj[k]! / Math.max(1, min[k]!)) * 90 * 38).toFixed(2);
console.log(`부상 풀타임 환산 29세 이하 ${p38(0)} · 30세 이상 ${p38(1)} · 마모 최대 ${Math.max(...loads).toFixed(0)} (${process.env.LOAD_OFF ? 'LOAD_OFF' : process.env.AGE_OFF ? 'AGE_OFF' : process.env.INJ_OFF ? 'INJ_OFF' : '켬'})`);
