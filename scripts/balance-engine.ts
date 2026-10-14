// 경기 엔진 통계 점검 (부록 E.15). 실행: npm run balance:engine (목표 밖이면 ✗ 표시, --check 면 종료 코드 1)
// 동레이팅(중립) 경기와 레이팅 차 경기를 시드 고정으로 돌려 팀당 평균을 본다

import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { EngineResult, TeamStats } from '../src/engine/types';
import { createTeamRoster, rosterRating } from '../src/roster';

const env = (globalThis as { process?: { env: Record<string, string | undefined>; argv: string[] } }).process;
const N = Number(env?.env.MATCHES ?? 40);
const CHECK = env?.argv.includes('--check') ?? false;

function team(id: string, rating: number, seed: string) {
  const r = createTeamRoster({ id, rating }, seed, 2018, []);
  return { roster: r, rating: rosterRating(r) };
}

function play(ra: number, rb: number, i: number, neutral: boolean): EngineResult {
  const a = team(`a${i}`, ra, `eng-a-${ra}-${i}`);
  const b = team(`b${i}`, rb, `eng-b-${rb}-${i}`);
  const m = createMatch({
    home: teamSetupFromRoster(a.roster, a.rating, b.rating, `s${i}`),
    away: teamSetupFromRoster(b.roster, b.rating, a.rating, `s${i}`),
    mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral,
  });
  return m.runToEnd();
}

const checks: { name: string; v: number; lo: number; hi: number }[] = [];
function line(name: string, v: number, lo: number, hi: number, digits = 1): void {
  const ok = v >= lo && v <= hi;
  checks.push({ name, v, lo, hi });
  console.log(`  ${name.padEnd(22)} ${v.toFixed(digits).padStart(7)}   목표 ${lo}~${hi} ${ok ? '✓' : '✗'}`);
}

const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
const per = (rs: EngineResult[], f: (s: TeamStats) => number) => avg(rs.flatMap((r) => r.teamStats.map(f)));

const t0 = performance.now();
const eq = Array.from({ length: N }, (_, i) => play(75, 75, i, true));
const ms = (performance.now() - t0) / N;
console.log(`\n[동레이팅 75 vs 75, 중립, ${N}경기] 경기당 ${ms.toFixed(0)}ms`);
line('득점', per(eq, (s) => s.goals), 1.25, 1.45, 2);
const poss = (r: EngineResult) => (r.teamStats[0].possessionTicks / (r.teamStats[0].possessionTicks + r.teamStats[1].possessionTicks)) * 100;
line('점유율(홈쪽 %)', avg(eq.map(poss)), 47, 53);
line('패스 시도', per(eq, (s) => s.passes), 380, 460, 0);
line('패스 성공률 %', (per(eq, (s) => s.passesCompleted) / per(eq, (s) => s.passes)) * 100, 77, 83);
line('슈팅', per(eq, (s) => s.shots), 10.5, 13.5);
line('유효 슈팅', per(eq, (s) => s.shotsOnTarget), 3.6, 4.8);
line('코너', per(eq, (s) => s.corners), 4, 6);
line('파울', per(eq, (s) => s.fouls), 9.5, 12.5);
line('옐로', per(eq, (s) => s.yellows), 1.3, 1.9, 2);
line('레드', per(eq, (s) => s.reds), 0.02, 0.12, 3);
line('오프사이드', per(eq, (s) => s.offsides), 1.7, 2.7);
line('어드밴티지', per(eq, (s) => s.advantages), 1.5, 2.5);
line('태클', per(eq, (s) => s.tackles), 13.5, 18.5);
line('인터셉트', per(eq, (s) => s.interceptions), 10, 14);
line('드리블 시도', per(eq, (s) => s.dribbles), 11.5, 16.5);
line('드리블 성공률 %', (per(eq, (s) => s.dribblesWon) / Math.max(0.01, per(eq, (s) => s.dribbles))) * 100, 45, 55);
line('크로스 시도', per(eq, (s) => s.crosses), 13.5, 18.5);
line('크로스 성공률 %', (per(eq, (s) => s.crossesCompleted) / Math.max(0.01, per(eq, (s) => s.crosses))) * 100, 25, 30);
line('공중볼 경합', per(eq, (s) => s.aerials), 30, 40);
line('GK 선방률 %', (per(eq, (s) => s.saves) / Math.max(0.01, per(eq, (s) => s.shotsOnTarget))) * 100, 68, 72);
const dist = (pos: string[]) => avg(eq.flatMap((r) => r.players.filter((p) => pos.includes(p.position) && p.minutes >= 85).map((p) => p.distance / 1000)));
line('이동 거리 CM km', dist(['CM']), 10, 11, 2);
line('이동 거리 수비수 km', dist(['CB', 'LB', 'RB']), 9.5, 10.5, 2);
line('이동 거리 ST km', dist(['ST', 'CF']), 9, 10, 2);
line('경기 계산 ms', ms, 0, 2000, 0);

// 레이팅 차 (E.15: 1.35 × exp(0.05Δ), 점유율 Δ+10 약 56%)
const N2 = Math.max(4, Number(env?.env.DIFF_MATCHES ?? N));
const diff8 = Array.from({ length: N2 }, (_, i) => play(79, 71, 500 + i, true));
console.log(`\n[레이팅 차 Δ=+8 (79 vs 71), 중립, ${N2}경기]`);
line('강팀 득점 (Δ+8)', avg(diff8.map((r) => r.homeGoals)), 1.8, 2.2, 2);
line('약팀 득점 (Δ−8)', avg(diff8.map((r) => r.awayGoals)), 0.75, 1.05, 2);
const diff10 = Array.from({ length: N2 }, (_, i) => play(80, 70, 700 + i, true));
line('점유율 Δ+10 (%)', avg(diff10.map(poss)), 53, 59);

// 홈 어드밴티지 (동레이팅, 홈)
const home = Array.from({ length: N }, (_, i) => play(75, 75, 900 + i, false));
const w = home.filter((r) => r.homeGoals > r.awayGoals).length / home.length * 100;
const d = home.filter((r) => r.homeGoals === r.awayGoals).length / home.length * 100;
console.log(`\n[동레이팅, 홈 경기, ${N}경기] 승/무/패 ${w.toFixed(0)} / ${d.toFixed(0)} / ${(100 - w - d).toFixed(0)} (목표 약 45 / 27 / 28)`);
line('홈 승률 %', w, 38, 52, 0);
line('무승부 %', d, 20, 34, 0);

const failed = checks.filter((c) => c.v < c.lo || c.v > c.hi);
console.log(`\n[엔진 통계] ${checks.length - failed.length}/${checks.length} 목표 안`);
if (CHECK && failed.length) (env as unknown as { exit(c: number): never }).exit(1);
