import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { ratingDelta, ratingFromParts, type RatingParts } from '../src/engine/rating';
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

  it('투톱(같은 군 둘 이상)이면 ST 역할 보정 `역할@2` 을 쓴다, 없으면 원톱 값', () => {
    const p = blank({ group: 'ST', passes: 30, forward: 8, goals: 0 });
    const lone = ratingFromParts({ ...p, role: 'falseNine' });
    const pair = ratingFromParts({ ...p, role: 'falseNine', mates: 2 });
    expect(R.roleCenter['falseNine@2']!).toBeLessThan(R.roleCenter.falseNine!);
    expect(pair).toBeGreaterThan(lone);
    // @2 값이 없는 역할은 원톱 값 그대로
    expect(ratingFromParts({ ...blank({ group: 'CB' }), role: 'libero', mates: 2 })).toBe(ratingFromParts({ ...blank({ group: 'CB' }), role: 'libero' }));
  });

  it('대형 문맥 (C.81u2): CAM 뒤 원톱 ST 는 `역할@cam`, 백3 앞 CDM 은 `역할@cb3`', () => {
    const st = blank({ group: 'ST', passes: 30, forward: 8 });
    expect(R.roleCenter['falseNine@cam']!).toBeGreaterThan(R.roleCenter.falseNine!);
    expect(ratingFromParts({ ...st, role: 'falseNine', ctx: 'cam' })).toBeLessThan(ratingFromParts({ ...st, role: 'falseNine' }));
    const cdm = blank({ group: 'CDM', passes: 40, forward: 10, tackles: 3 });
    expect(R.roleCenter['halfBack@cb3']!).toBeLessThan(R.roleCenter.halfBack!);
    expect(ratingFromParts({ ...cdm, role: 'halfBack', ctx: 'cb3' })).toBeGreaterThan(ratingFromParts({ ...cdm, role: 'halfBack' }));
    // 문맥 군 안 역할 평균은 0 근처
    for (const [k, roles] of [['cam', ['poacher', 'targetMan', 'falseNine', 'advancedForward']], ['cb3', ['anchor', 'ballWinner', 'regista', 'halfBack']]] as const) {
      expect(Math.abs(roles.reduce((a, r) => a + R.roleCenter[`${r}@${k}`]!, 0) / roles.length)).toBeLessThan(0.02);
    }
  });

  it('경기 문맥: 4-2-3-1 ST 는 cam, 3-5-2 CDM 은 cb3, 4-3-3 은 문맥 없음', () => {
    const run = (f: '4-2-3-1' | '3-5-2' | '4-3-3') => runMatchJob({ ...job, home: std('a', 81001, 75, f), away: std('b', 81001, 75, f) }).players.filter((p) => p.starter && p.team === 0);
    expect(run('4-2-3-1').find((p) => p.parts!.group === 'ST')!.parts!.ctx).toBe('cam');
    expect(run('3-5-2').find((p) => p.parts!.group === 'CDM')!.parts!.ctx).toBe('cb3');
    expect(run('4-3-3').every((p) => !p.parts!.ctx)).toBe(true);
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
