// C.79i 감독 성향별 선수 기용 (pending 143): 선발 점수 성향 가중(NPC pickLineup penalty · 내 선발 확률), NPC 평점·연속 선발 기록, 감독 성향 데이터
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster, naturalOvr, pickLineup } from '../src/roster';
import { npcAfterMatch, npcConditions, npcInjuredOn, pruneNpcFit, type NpcFitMap } from '../src/npcFit';
import { npcSelectBonus, streakPart, styleWeights } from '../src/selection';
import { MANAGER_STYLE_HINT, MANAGER_STYLE_KO, MANAGERS, managerOf } from '../data/managers';
import { newGame } from '../src/game';
import { startChance } from '../src/manager';
import { teamById } from '../src/league';
import { playerOvr } from '../src/growth';
import { competitionVM } from '../src/ui/managerVM';

const roster = (id: string, seed: string) => createTeamRoster({ id, rating: 78 }, seed, 2018, []);

describe('C.79i 감독 성향 데이터', () => {
  it('성향 7종에 이름·한 줄이 있고, 실제 감독 성향이 들어간다 (포체티노 스타 · 과르디올라 로테이션 · 시메오네 엄격)', () => {
    for (const k of Object.keys(BALANCE.selection.styles)) {
      expect(MANAGER_STYLE_KO[k as keyof typeof MANAGER_STYLE_KO]).toBeTruthy();
      expect(MANAGER_STYLE_HINT[k as keyof typeof MANAGER_STYLE_HINT]).toBeTruthy();
    }
    expect(managerOf('tot')!.style).toBe('star');
    expect(managerOf('mci')!.style).toBe('rotation');
    const atm = Object.values(MANAGERS).find((m) => m.name === 'Diego Simeone');
    expect(atm?.style).toBe('strict');
    // 리그 데이터 팀 다수는 그대로 실용
    const styles = Object.values(MANAGERS).map((m) => m.style);
    expect(styles.filter((s) => s === 'neutral').length).toBeGreaterThan(styles.length / 2);
  });
});

describe('C.79i 선발 점수 (NPC)', () => {
  it('실용 + 기록 없음이면 예전 선발(피로 감점만)과 같다', () => {
    const r = roster('a', 'c79i-a');
    const st = pickLineup(r).slots.find((s) => s.pos === 'ST')!.playerId;
    const cond = { [st]: [80, 0] as [number, 0] };
    const old = teamSetupFromRoster(r, 78, 78, 'w', undefined, 75, true, cond);
    const neu = teamSetupFromRoster(r, 78, 78, 'w', undefined, 75, true, cond, 'neutral');
    expect(neu.lineup.map((p) => p.id)).toEqual(old.lineup.map((p) => p.id));
  });

  it('경쟁형은 최근·직전 평점을 실용보다 크게 보고, 스타 중용은 덜 본다', () => {
    const r = roster('b', 'c79i-b');
    const p = r.players.find((x) => !x.gk)!;
    const ctx = (style: 'neutral' | 'competitive' | 'star') => ({ style, rating: 78, oppRating: 78 });
    const bad: [number, 0, number, number, number] = [0, 0, 55, 58, 1];
    const v = (s: 'neutral' | 'competitive' | 'star') => npcSelectBonus(p, bad, ctx(s)) - npcSelectBonus(p, undefined, ctx(s));
    expect(v('competitive')).toBeLessThan(v('neutral'));
    expect(v('neutral')).toBeLessThan(v('star'));
    expect(v('star')).toBeLessThan(0);
  });

  it('로테이션은 연속 선발 streakFrom 경기째부터 감점, 피로를 실용의 2배로 본다', () => {
    const w = styleWeights('rotation');
    const from = BALANCE.selection.streakFrom;
    expect(streakPart(from - 2, w)).toBe(0);
    expect(streakPart(from - 1, w)).toBeLessThan(0);
    expect(streakPart(from, w)).toBeLessThan(streakPart(from - 1, w));
    const p = roster('c', 'c79i-c').players[0]!;
    const tired: [number, 0] = [70, 0];
    const pen = (s: 'rotation' | 'neutral') => npcSelectBonus(p, tired, { style: s, rating: 78, oppRating: 78 }) - npcSelectBonus(p, undefined, { style: s, rating: 78, oppRating: 78 });
    expect(pen('rotation')).toBeCloseTo(pen('neutral') * 2, 5);
  });

  it('유망주 기용은 23세 이하 가산, 약한 상대면 더', () => {
    const r = roster('d', 'c79i-d');
    const young = r.players.find((x) => x.age <= BALANCE.selection.youthAge)!;
    const old = r.players.find((x) => x.age > BALANCE.selection.youthAge)!;
    const b = (p: typeof young, opp: number) => npcSelectBonus(p, undefined, { style: 'youth', rating: 78, oppRating: opp });
    expect(b(young, 78)).toBeGreaterThan(0);
    expect(b(young, 70)).toBeGreaterThan(b(young, 78));
    expect(b(old, 70)).toBe(0);
  });

  it('스타 중용은 자연 OVR 이 팀 레이팅보다 높을수록 가산', () => {
    const r = roster('e', 'c79i-e');
    const [hi, lo] = [...r.players].sort((a, b) => naturalOvr(b) - naturalOvr(a));
    const b = (p: typeof hi) => npcSelectBonus(p!, undefined, { style: 'star', rating: 78, oppRating: 78 });
    expect(b(hi)).toBeGreaterThan(b(lo));
  });
});

describe('C.79i NPC 평점·연속 선발 기록', () => {
  it('경기 뒤 직전 평점·평균·경기 수·연속 선발을 담고, 안 뛴 선수는 연속 선발이 끊기고, 부상 칸은 비어 있다', () => {
    const r = roster('f', 'c79i-f');
    const [a, b] = r.players;
    const map: NpcFitMap = {};
    npcAfterMatch(map, [r], [{ id: a!.id, minutes: 90, distance: 10000, rating: 7.2 }, { id: b!.id, minutes: 90, distance: 10000, rating: 6.0 }], 100, 'w', 1);
    npcAfterMatch(map, [r], [{ id: a!.id, minutes: 90, distance: 10000, rating: 6.4 }], 104, 'w', 2);
    const fa = map[a!.id]!;
    expect(fa[3]).toBe(64);
    expect(fa[5]).toBe(2);
    expect(fa[6]).toBe(2);
    expect(fa[4]).toBeGreaterThan(64);
    expect(fa[4]).toBeLessThan(72);
    expect(map[b!.id]![6]).toBe(0);
    if (fa[2] === null) expect(npcInjuredOn(fa, 105)).toBe(false);
    // 세이브 왕복(JSON)에서도 부상 판정이 그대로
    const back = JSON.parse(JSON.stringify(map)) as NpcFitMap;
    expect(npcInjuredOn(back[a!.id], 105)).toBe(npcInjuredOn(fa, 105));
    const cond = npcConditions(map, [r], 110)!;
    expect(cond[a!.id]![2]).toBe(64);
    expect(cond[a!.id]![4]).toBe(2);
    // 피로가 다 풀려도 평점 기록은 formKeepDays 까지 남는다
    pruneNpcFit(map, 104 + 30);
    expect(map[a!.id]).toBeDefined();
    pruneNpcFit(map, 104 + BALANCE.selection.formKeepDays + 1);
    expect(map[a!.id]).toBeUndefined();
  });
});

describe('C.79i 내 선발 확률·홈 카드', () => {
  it('감독 성향이 내 선발 확률을 바꾸고(벤치 선수는 스타 중용에서 낮다), 홈 카드에 기용 성향 한 줄', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c79i', difficulty: 'normal' });
    g.phase = 'season';
    const tid = g.player.teamId;
    const rating = teamById(g.league, tid).rating;
    const at = (style: string, ovr: number) => {
      (g.coaches ??= {})[tid] = { name: 'x', nameKo: 'x', style: style as never, since: g.league.season };
      return startChance(g, ovr, rating, 0);
    };
    expect(at('star', rating - 6)).toBeLessThan(at('neutral', rating - 6));
    expect(at('competitive', rating - 6)).toBeGreaterThan(at('neutral', rating - 6));
    (g.coaches ??= {})[tid] = { name: 'x', nameKo: 'x', style: 'competitive', since: g.league.season };
    const vm = competitionVM(g);
    expect(vm?.styleLine).toContain('경쟁형');
    expect(playerOvr(g.player)).toBeGreaterThan(0);
  });
});
