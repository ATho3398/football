// C.81w: 시상 추정 출전 몫 = 엔진 실측 포지션군 × 선발·벤치·그 밖 분포 · 다른 리그 빠른 진행 상위 팀 독주 완화(diffScale) · 리그 × 포지션 득점자 배수
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { buildResumes } from '../src/awards';
import { finishOtherSeason } from '../src/otherLeagues';
import { sortedTable } from '../src/league';
import { BALANCE } from '../src/config/balance';

describe('시상 추정 출전 몫 분포 (C.81w)', () => {
  it('shareQ: 8개 포지션군 × 3구분 × 5분위, 0~1 사이 오름차순, 선발 중앙값 > 벤치 > 그 밖', () => {
    const Q = BALANCE.awards.estimate.shareQ;
    for (const g of ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST']) {
      const rows = Q[g]!;
      expect(rows).toHaveLength(3);
      for (const q of rows) {
        expect(q).toHaveLength(5);
        for (let i = 0; i < 5; i++) { expect(q[i]).toBeGreaterThanOrEqual(0); expect(q[i]).toBeLessThanOrEqual(1); if (i) expect(q[i]!).toBeGreaterThanOrEqual(q[i - 1]!); }
      }
      expect(rows[0]![2]!).toBeGreaterThan(rows[1]![2]!);
      expect(rows[1]![2]!).toBeGreaterThanOrEqual(rows[2]![2]!);
    }
  });

  it('추정 리그 이력서 풀: 팀당 ST 후보가 벤치 전원(옛 2.1명)이 아니라 엔진처럼 2명 아래, FB 는 3명 이상', () => {
    const g = newGame({ mode: 'prospect', position: 'GK', seed: 'c81w-u1', difficulty: 'normal', leagues: ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'] });
    for (const lg of g.otherLeagues ?? []) finishOtherSeason(g.worldSeed, lg, g.npcs);
    const rs = buildResumes(g).filter((r) => !r.me && r.lg !== g.league.id);
    const teams = (g.otherLeagues ?? []).reduce((t, lg) => t + lg.teams.length, 0);
    const per = (grp: string) => rs.filter((r) => r.group === grp).length / teams;
    expect(per('ST')).toBeLessThan(2);
    expect(per('FB')).toBeGreaterThan(3);
  });
});

describe('다른 리그 빠른 진행 점수 (C.81w)', () => {
  it('diffScale < 1: 빅5 1위 팀 경기당 득점이 엔진 범위(2.2~2.7)', () => {
    expect(BALANCE.otherScorers.diffScale).toBeLessThan(1);
    const g = newGame({ mode: 'prospect', position: 'GK', seed: 'c81w-u2', difficulty: 'normal', leagues: ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'] });
    const tops: number[] = [];
    for (const lg of g.otherLeagues ?? []) {
      finishOtherSeason(g.worldSeed, lg, g.npcs);
      tops.push(Math.max(...sortedTable(lg).map((r) => r.gf / r.played)));
    }
    const m = tops.reduce((t, x) => t + x, 0) / tops.length;
    expect(m).toBeGreaterThan(2);
    expect(m).toBeLessThan(2.8);
  });

  it('leagueMul: 빅5 + rest 칸 값은 0.3~3', () => {
    const LM = BALANCE.otherScorers.leagueMul;
    expect(Object.keys(LM).sort()).toEqual(['bundesliga', 'laliga', 'ligue1', 'pl', 'rest', 'seriea']);
    for (const row of Object.values(LM)) for (const v of Object.values(row).flat()) { expect(v).toBeGreaterThan(0.3); expect(v).toBeLessThan(3); }
  });
});
