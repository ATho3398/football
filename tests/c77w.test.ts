// C.77w (공통 규칙 로드맵 1단계): 측정 훅은 엔진 결과를 바꾸지 않는다 · 슛 훅 수 = 경기 통계 슛 · 컵 득점자는 출전 명단(교체 반영)에서
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { cupLines, cupScorers } from '../src/cups';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { probe, type ShotProbe } from '../src/engine/probe';
import { newGame } from '../src/game';
import { dayNum } from '../src/npcFit';
import { createRng } from '../src/rng';
import { createTeamRoster, rosterRating } from '../src/roster';

function match(seed: number) {
  const h = createTeamRoster({ id: 'wh', rating: 76 }, `c77w-h${seed}`, 2018, []);
  const a = createTeamRoster({ id: 'wa', rating: 74 }, `c77w-a${seed}`, 2018, []);
  return createMatch({ home: teamSetupFromRoster(h, rosterRating(h), 76, `wh${seed}`), away: teamSetupFromRoster(a, rosterRating(a), 74, `wa${seed}`), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: false });
}

describe('C.77w 측정 훅', () => {
  it('훅을 켜도 같은 시드 같은 결과 · 슛 기록 수 = 경기 통계 슛 수 · 유효 슈팅 결과가 모두 정해진다', () => {
    const off = match(4242).runToEnd();
    const shots: ShotProbe[] = [];
    let decisions = 0;
    probe.shot = (_s, p) => void shots.push(p);
    probe.decide = () => void decisions++;
    try {
      const on = match(4242).runToEnd();
      expect(JSON.stringify(on.teamStats)).toBe(JSON.stringify(off.teamStats));
      expect(on.events.length).toBe(off.events.length);
      expect(shots.length).toBe(on.teamStats[0].shots + on.teamStats[1].shots);
      expect(shots.filter((x) => x.outcome === 'goal').length).toBe(on.homeGoals + on.awayGoals);
      expect(shots.filter((x) => x.outcome === 'onTarget')).toHaveLength(0);
      expect(shots.some((x) => x.outcome === 'block')).toBe(true);
      expect(decisions).toBeGreaterThan(100);
    } finally {
      delete probe.shot;
      delete probe.decide;
    }
  });
});

describe('C.77w 컵 출전 명단·득점자', () => {
  const g = newGame({ mode: 'real', playerId: 'salah', seed: 'c77w-cup', difficulty: 'normal' });
  const fa = g.cups!.fa!;
  const date = fa.dates[0]!;

  it('출전 명단: 선발 11 + 교체, GK 90분, 출전 분 합 990, 교체 분 = 90 − 나간 분', () => {
    for (const t of fa.rounds[0]!) {
      for (const id of [t.h, t.a]) {
        const ls = cupLines(g, id, date);
        expect(ls.length).toBe(11 + BALANCE.fatigue.npc.cupSubs.length);
        expect(ls.reduce((s, l) => s + l.minutes, 0)).toBe(990);
        expect(ls.filter((l) => l.sub).map((l) => l.minutes).sort((a, b) => a - b)).toEqual(BALANCE.fatigue.npc.cupSubs.map((m) => 90 - m).sort((a, b) => a - b));
        expect(new Set(ls.map((l) => l.id)).size).toBe(ls.length);
      }
    }
  });

  it('득점자·도움은 모두 출전 명단 안 (미출전 0), 부상 선수는 명단·득점자에서 빠진다', () => {
    const tie = fa.rounds[0]!.find((t) => g.rosters?.[t.h] && t.h !== g.player.teamId)!;
    const r = g.rosters![tie.h]!;
    // 선발 1순위 ST 를 다치게 한다
    const st = cupLines(g, tie.h, date).find((l) => !l.sub && r.players.find((p) => p.id === l.id)!.position === 'ST')!.id;
    let bad = 0;
    let n = 0;
    for (let k = 0; k < 200; k++) {
      const lines = [cupLines(g, tie.h, date), cupLines(g, tie.a, date)];
      for (const [, side, sc, as] of cupScorers(g, createRng(k), tie, 3, 2, lines)) {
        n++;
        const ids = new Set(lines[side]!.filter((l) => l.minutes > 0).map((l) => l.id));
        if (!ids.has(sc) || (as && !ids.has(as))) bad++;
      }
    }
    expect(n).toBeGreaterThan(500);
    expect(bad).toBe(0);
    // 부상: 그날 결장인 선수는 명단에 없다
    g.npcFit = { ...(g.npcFit ?? {}), [st]: [0, dayNum(date), dayNum(date) + 30] };
    const after = cupLines(g, tie.h, date);
    expect(after.some((l) => l.id === st)).toBe(false);
    for (let k = 0; k < 50; k++) for (const [, side, sc] of cupScorers(g, createRng(k), tie, 3, 0, [after, cupLines(g, tie.a, date)])) if (side === 0) expect(sc).not.toBe(st);
  });
});
