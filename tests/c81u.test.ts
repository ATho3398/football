import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { ratingDelta, type RatingParts } from '../src/engine/rating';
import { runMatchJob, type MatchJob } from '../scripts/engine/job';
import { std } from '../scripts/engine/suite';

// C.81u 수비 기록 칸: 압박 성공 · 오프사이드 유도 · 라인 유지 — 세기만 하고 경기 행동은 그대로, 평점에 소폭
const blank = (extra: Partial<RatingParts> = {}): RatingParts => ({
  group: 'CB', passes: 0, forward: 0, keyPasses: 0, onTarget: 0, goals: 0, assists: 0, dribbles: 0, tackles: 0,
  interceptions: 0, aerials: 0, lost: 0, dangerLost: 0, attackLost: 0, fouls: 0, offsides: 0, yellows: 0, red: 0,
  conceded: 0, saves: 0, cleanSheet: 0, result: 0, ...extra,
});
const R = ENGINE.rating;
const job: MatchJob = { kind: 'match', seed: 81001, neutral: true, parts: true, home: std('a', 81001), away: std('b', 81001) };

describe('C.81u 수비 기록 칸', () => {
  it('평점 가중: 압박 성공 · 오프사이드 유도 · 라인 유지 분이 소폭 더해진다', () => {
    const base = ratingDelta(blank());
    expect(ratingDelta(blank({ pressWon: 4 })) - base).toBeCloseTo(4 * R.pressWon);
    expect(ratingDelta(blank({ offsideWon: 2 })) - base).toBeCloseTo(2 * R.offsideWon);
    expect(ratingDelta(blank({ lineMin: 10 })) - base).toBeCloseTo(10 * R.lineMin);
    expect(R.pressWon).toBeGreaterThan(0);
    expect(R.pressWon).toBeLessThanOrEqual(0.03);
    expect(R.offsideWon).toBeLessThanOrEqual(0.03);
    expect(R.lineMin).toBeLessThanOrEqual(0.01);
  });

  it('경기에서 센다: 수비 줄은 라인 유지 시간·오프사이드 유도, 누군가는 압박 성공', () => {
    const m = runMatchJob(job);
    const st = m.players.filter((p) => p.starter);
    const back = st.filter((p) => p.parts!.group === 'CB' || p.parts!.group === 'FB');
    expect(back.every((p) => (p.parts!.lineMin ?? 0) > 0)).toBe(true);
    expect(st.some((p) => (p.parts!.pressWon ?? 0) > 0)).toBe(true);
    // 오프사이드 유도는 상대 오프사이드가 있을 때 수비 줄 선수마다 같은 수
    for (const team of [0, 1]) {
      const oppOff = m.players.filter((p) => p.team !== team).reduce((a, p) => a + p.offsides, 0);
      for (const p of back.filter((x) => x.team === team && x.minutes >= 90)) expect(p.parts!.offsideWon ?? 0).toBe(oppOff);
    }
    // 공격 줄에는 라인 유지·오프사이드 유도가 없다
    expect(st.filter((p) => p.parts!.group === 'ST').every((p) => !p.parts!.lineMin && !p.parts!.offsideWon)).toBe(true);
  });

  it('세기만 한다: 압박 반경·라인 폭을 바꿔도 경기 결과·골 시각이 같다', () => {
    const fp = () => { const m = runMatchJob(job); return `${m.homeGoals}-${m.awayGoals}@${m.goals.map((g) => g.t).join(',')}`; };
    const a = fp();
    const save = { pressRadius: R.pressRadius, pressWindow: R.pressWindow, lineTol: R.lineTol };
    const Rw = R as { pressRadius: number; pressWindow: number; lineTol: number };
    Object.assign(Rw, { pressRadius: 30, pressWindow: 20, lineTol: 0.5 });
    try { expect(fp()).toBe(a); } finally { Object.assign(Rw, save); }
  });
});
