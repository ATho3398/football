// 45b(b) 다른 리그 풀 엔진 · 새 게임 리그 선택 → 팀 고르기
import { describe, expect, it } from 'vitest';
import { newGame, playOthers, endDay, isMatchDay } from '../src/game';
import { applyOtherLeagueJob, otherLeagueJobs, syncOtherLeagues } from '../src/otherLeagues';
import { playNpcMatch } from '../src/engine/npcMatch';
import { addDays } from '../src/calendar';
import { deserialize, serialize } from '../src/save';

/** 다른 리그 경기가 있는 첫날까지 */
function toFirstOtherDay(g: ReturnType<typeof newGame>): void {
  for (let k = 0; k < 40 && !otherLeagueJobs(g, g.calendar.date).length; k++) {
    if (isMatchDay(g)) return;
    playOthers(g, 'quick');
    endDay(g);
  }
}

describe('다른 리그 풀 엔진 (45b b)', () => {
  it('그날 다른 리그 경기를 엔진으로: 순위표 · 선수 기록(출전·골·도움·평점·분), 순서와 무관하게 같은 결과', () => {
    const a = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-a', difficulty: 'normal', leagues: ['pl', 'mls'] });
    const b = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-a', difficulty: 'normal', leagues: ['pl', 'mls'] });
    toFirstOtherDay(a);
    toFirstOtherDay(b);
    const ja = otherLeagueJobs(a, a.calendar.date);
    expect(ja.length).toBeGreaterThan(0);
    // MLS 는 2018 전반기를 새 게임 때 빠른 계산으로 채워 둔다 (득점·도움만)
    const played0 = a.otherLeagues![0]!.table.reduce((t, r) => t + r.played, 0) / 2;
    const goals0 = a.otherLeagues![0]!.table.reduce((t, r) => t + r.gf, 0);
    const before0 = new Set(Object.keys(a.otherLeagues![0]!.stats ?? {}));
    for (const j of ja) applyOtherLeagueJob(a, j, playNpcMatch(j.input));
    const jb = otherLeagueJobs(b, b.calendar.date).reverse();
    const outs = jb.map((j) => playNpcMatch(j.input));
    jb.forEach((j, k) => applyOtherLeagueJob(b, j, outs[k]!));
    const mls = a.otherLeagues![0]!;
    expect(mls.table).toEqual(b.otherLeagues![0]!.table);
    expect(mls.stats).toEqual(b.otherLeagues![0]!.stats);
    const played = mls.table.reduce((t, r) => t + r.played, 0) / 2;
    expect(played - played0).toBe(ja.length);
    const lines = Object.entries(mls.stats!).filter(([id]) => !before0.has(id)).map(([, s]) => s);
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.every((s) => s[2]! >= 1 && s[4]! > 0)).toBe(true);
    expect(Object.values(mls.stats!).reduce((t, s) => t + s[0], 0)).toBe(mls.table.reduce((t, r) => t + r.gf, 0));
    expect(goals0).toBeGreaterThan(0);
    // 하루 끝 빠른 계산은 이미 치른 경기를 건드리지 않는다
    const before = JSON.stringify(mls.table);
    syncOtherLeagues(a, a.calendar.date);
    expect(JSON.stringify(a.otherLeagues![0]!.table)).toBe(before);
    expect(deserialize(serialize(a)).otherLeagues![0]!.stats).toEqual(mls.stats);
  });

  it('playOthers(engine) 이 다른 리그 경기도 엔진으로, quick 은 하루 끝 빠른 계산 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-b', difficulty: 'normal', leagues: ['pl', 'kleague1'] });
    const d = g.calendar.date;
    expect(otherLeagueJobs(g, d).length + otherLeagueJobs(g, addDays(d, 1)).length).toBeGreaterThan(0);
    for (let k = 0; k < 3; k++) {
      if (isMatchDay(g)) break;
      playOthers(g, 'engine');
      endDay(g);
    }
    const k1 = g.otherLeagues![0]!;
    expect(Object.values(k1.stats ?? {}).some((s) => s[2] !== undefined)).toBe(true);
  });
});
