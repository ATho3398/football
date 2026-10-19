// 훈련 측정 (부록 C.41, 25.3): 기본 훈련 계획 커리어의 시즌 XP 구성(경기·훈련·업적), 훈련 XP 비율, 주간 피로 합계, 게이지 능력치 상승.
// C.41 이전 코드에서도 돌아가게 훈련 필드는 선택으로 읽는다 (비교용). 사용: npm run balance:training -- [커리어 수]
import { newGame, playRound, startNextSeason, type GameState } from '../src/game';
import { autoAllocate, playerOvr } from '../src/growth';
import { PLAYABLE_POSITIONS } from '../src/positions';
import type { Tier } from '../src/types';
import { BALANCE } from '../src/config/balance';
import { planFatigue, type DayPlan } from '../src/training';
import { setEnvironmentFixed } from '../src/weather';

// 측정은 맑음·보통 심판 고정 (부록 C.74a): 기존 기준 그대로 비교
setEnvironmentFixed(true);

// 조정 실험: MXS=경기 XP 배율, GFULL=게이지 칸 수 (설정 파일을 바꾸지 않고 잰다)
const B = BALANCE as unknown as { training?: { matchXpScale: number; gauge: { full: number } } };
if (process.env.MXS && B.training) B.training.matchXpScale = Number(process.env.MXS);
if (process.env.GFULL && B.training) B.training.gauge.full = Number(process.env.GFULL);

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 24);
const TIERS: Tier[] = ['normal', 'topClass', 'legendary'];
const rows: { age: number; match: number; train: number; ach: number; total: number; ups: number; fatigue: number; plan: number; days: number; apps: number }[] = [];
const ovr30: number[] = [];
for (let i = 0; i < N; i++) {
  const tier = TIERS[i % TIERS.length]!;
  const g: GameState = newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `train-${i}`, difficulty: 'normal' });
  g.player.potentialTier = tier;
  while (g.player.age < 31) {
    const xp0 = g.player.totalXp;
    while (g.phase === 'season') {
      playRound(g, { engine: 'quick' });
      autoAllocate(g.player);
    }
    autoAllocate(g.player);
    const h = g.player.history.at(-1)!;
    const t = (g as unknown as { training?: { season: { fatigue: number; ups: number; days: Record<string, number> } } }).training;
    const days = t ? Object.entries(t.season.days).filter(([k]) => k !== 'vacation').reduce((a, [, b]) => a + b, 0) : 0;
    const plan = t ? Object.entries(t.season.days).filter(([k]) => k !== 'vacation').reduce((a, [k, b]) => a + planFatigue(k as DayPlan) * b, 0) : 0;
    rows.push({
      age: h.age, match: h.matchXp, train: (h as { trainingXp?: number }).trainingXp ?? 0, ach: h.achievementXp, total: g.player.totalXp - xp0,
      ups: t?.season.ups ?? 0, fatigue: t?.season.fatigue ?? 0, plan, days, apps: h.apps,
    });
    if (g.player.age === 30) ovr30.push(playerOvr(g.player));
    if (g.phase !== 'offseason') break;
    startNextSeason(g);
  }
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(`[훈련 측정] 커리어 ${N}개 (일반/탑클래스/레전더리 순환, 최적 배분, 빠른 경기), 17~30세 시즌 ${rows.length}개`);
const band = (lo: number, hi: number) => rows.filter((r) => r.age >= lo && r.age <= hi);
for (const [lo, hi] of [[17, 20], [21, 25], [26, 29], [17, 29]] as const) {
  const r = band(lo, hi);
  const m = avg(r.map((x) => x.match));
  const t = avg(r.map((x) => x.train));
  console.log(`  ${lo}~${hi}세: 경기 XP ${m.toFixed(0)} · 훈련 XP ${t.toFixed(0)} (경기의 ${(t / Math.max(1, m) * 100).toFixed(0)}%) · 경기+훈련 ${(m + t).toFixed(0)} · 업적 ${avg(r.map((x) => x.ach)).toFixed(0)} · 시즌 총 XP ${avg(r.map((x) => x.total)).toFixed(0)} · 출전 ${avg(r.map((x) => x.apps)).toFixed(1)}`);
}
const all = band(17, 29);
const weekly = avg(all.map((x) => x.plan)) / Math.max(1, avg(all.map((x) => x.days + x.apps)) / 7);
console.log(`  게이지 능력치 상승 시즌 평균 ${avg(all.map((x) => x.ups)).toFixed(2)} · 계획 피로 회복 합계 시즌 ${avg(all.map((x) => x.plan)).toFixed(0)} (휴가 뺀 훈련·재활 ${avg(all.map((x) => x.days)).toFixed(0)}일 + 경기, 주 환산 ${weekly.toFixed(1)}/주, 실제 회복 ${avg(all.map((x) => x.fatigue)).toFixed(0)} — 피로 0 이하로는 안 내려감)`);
const tot = avg(all.map((x) => x.match + x.train));
console.log(`  훈련 XP 시즌 합계 ${avg(all.map((x) => x.train)).toFixed(0)} = 경기+훈련 XP 의 ${(avg(all.map((x) => x.train)) / tot * 100).toFixed(0)}%`);
console.log(`  30세 OVR 평균 ${avg(ovr30).toFixed(1)}`);
