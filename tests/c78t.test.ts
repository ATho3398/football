// C.78t 게겐프레싱 비용 (pending 146 ②): 시즌 누적 피로(내 선수) · 게겐 시즌 → 노쇠 1~2년 앞당김(내 선수·NPC)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { closeNpcLoadSeason, gegenShift, npcGegen, wearAging, type NpcLoadMap } from '../src/load';
import { npcAfterMatch, rosterTendency, type NpcFitMap } from '../src/npcFit';
import { createTeamRoster } from '../src/roster';
import { endDay, isMatchDay, matchFatigue, myClubGegen, newGame, playOthers, playRound } from '../src/game';
import { restore, serialize } from '../src/save';

describe('C.78t 선수 생명 (게겐 시즌 → 노쇠 앞당김)', () => {
  it('게겐 3시즌 −1년, 5시즌 −2년 (계단)', () => {
    expect([0, 2, 3, 4, 5, 9].map(gegenShift)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('게겐 시즌이 없으면 C.77n 마모 노쇠와 같다', () => {
    for (const [w, a] of [[0, 31], [20, 29], [20, 31], [80, 34]] as const) expect(wearAging(w, a, 0)).toEqual(wearAging(w, a));
  });

  it('게겐 이동은 wearAgeFrom 부터 이동 × careerWindow 시즌 동안 (5시즌 30~33세, 3시즌 30~31세), 마모 이동과 더해진다', () => {
    const from = BALANCE.load.wearAgeFrom;
    const w = BALANCE.gegenCost.careerWindow;
    expect(wearAging(0, from - 1, 5).shift).toBe(0);
    expect(wearAging(0, from, 5).shift).toBe(2);
    expect(wearAging(0, from + 2 * w - 1, 5).shift).toBe(2);
    expect(wearAging(0, from + 2 * w, 5).shift).toBe(0);
    expect(wearAging(0, from + w - 1, 3).shift).toBe(1);
    expect(wearAging(0, from + w, 3).shift).toBe(0);
    expect(wearAging(50, from, 5).shift).toBeCloseTo(Math.min(BALANCE.load.maxShift, 50 * BALANCE.load.agePerWear) + 2, 5);
  });

  it('NPC: 게겐 팀 출전 분이 쌓이고, 시즌 끝 seasonMinutes 이상이면 게겐 시즌 +1 (마모 0 이어도 기록 유지)', () => {
    const liv = createTeamRoster({ id: 'liv', rating: 85 }, 'c78t', 2025, []);
    const other = createTeamRoster({ id: 'bur', rating: 70 }, 'c78t', 2025, []);
    expect(rosterTendency(liv, 'c78t')).toBe('gegenpress');
    expect(rosterTendency(other, 'c78t')).not.toBe('gegenpress');
    const map: NpcFitMap = {};
    const load: NpcLoadMap = {};
    const a = liv.players[0]!.id;
    const b = other.players[0]!.id;
    for (let d = 0; d < 17; d++) {
      npcAfterMatch(map, [liv, other], [{ id: a, minutes: 90, distance: 10000 }, { id: b, minutes: 90, distance: 10000 }], d * 7, 'c78t', d);
      npcAfterMatch(map, [liv, other], [{ id: a, minutes: 90, distance: 10000 }, { id: b, minutes: 90, distance: 10000 }], d * 7 + 3, 'c78t', 100 + d, load);
    }
    expect(load[a]![2]).toBe(17 * 90);
    expect(load[b]![2]).toBeUndefined();
    load[a]![0] = 0; // 마모 0 이어도
    closeNpcLoadSeason(load);
    expect(npcGegen(load, a)).toBe(1);
    expect(load[a]).toEqual([0, 0, 0, 1]);
    expect(npcGegen(load, b)).toBe(0);
  });
});

describe('C.78t 시즌 누적 피로 (내 선수)', () => {
  it('게겐 팀(토트넘) 내 선수: 뛰면 쌓이고 경기 피로에 더해진다, 비게겐 전술이면 쌓이지 않는다', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c78t-sf', difficulty: 'normal' });
    expect(myClubGegen(g)).toBe(true);
    let played = 0;
    for (let k = 0; k < 6 && g.phase === 'season'; k++) {
      while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
      const apps = g.player.season.apps;
      playRound(g, { engine: 'quick' });
      if (g.player.season.apps > apps) played++;
    }
    expect(played).toBeGreaterThan(2);
    const sf = g.player.seasonFatigue ?? 0;
    expect(sf).toBeGreaterThan(0);
    expect(sf).toBeLessThanOrEqual(BALANCE.gegenCost.cap);
    expect(g.player.gegenMin).toBeGreaterThan(0);
    expect(matchFatigue(g, 10)).toBeCloseTo(Math.min(BALANCE.fatigue.max, 10 + sf), 5);
    // 세이브 왕복
    const back = restore(JSON.parse(serialize(g)));
    expect(back.player.seasonFatigue).toBe(sf);

    // 전술을 균형으로 바꾸면 클럽 경기마다 restRecovery 씩 빠진다
    g.tactics!.tendency = 'balanced';
    expect(myClubGegen(g)).toBe(false);
    const min0 = g.player.gegenMin;
    while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
    playRound(g, { engine: 'quick' });
    expect(g.player.seasonFatigue).toBeCloseTo(Math.max(0, sf - BALANCE.gegenCost.restRecovery), 5);
    expect(g.player.gegenMin).toBe(min0);
  });
});
