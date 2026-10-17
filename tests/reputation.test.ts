// 13단계 (부록 C.23): 위상 재설계, 세이브 변환 8 → 9, 단계적 공개, 숙련도 감소, 재개 대기 빨리 감기
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { emptySeasonStats, newGame, personalReputation, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { legendaryConditions, legendaryHonorsMet, nextReputationTier, reputationTier } from '../src/growth';
import { requestPositionChange } from '../src/proficiency';
import { settledFrames, type Replay, type ReplayFrame } from '../src/replay';
import { deserialize, serialize } from '../src/save';
import { checklistItems, FEATURES, isUnlocked, pendingIntro, refreshUnlocks, resetTips, tipFor } from '../src/unlocks';

const H = (ballonDor: number, trebles = 0, worldCups = 0) => ({ ballonDor, trebles, worldCups });

describe('위상 티어 (8.1 개정, 부록 C.23)', () => {
  it('새 컷: 스페셜 250 / 탑클래스 550 / 월드클래스 900', () => {
    expect(reputationTier(249)).toBe('normal');
    expect(reputationTier(250)).toBe('special');
    expect(reputationTier(550)).toBe('topClass');
    expect(reputationTier(899)).toBe('topClass');
    expect(reputationTier(900)).toBe('worldClass');
    expect(reputationTier(1000)).toBe('worldClass');
  });

  it('레전더리 조건: 발롱도르 1회 이상 그리고 (트레블 또는 월드컵 또는 발롱도르 3회 이상). 기록이 없으면 false', () => {
    expect(legendaryHonorsMet(undefined)).toBe(false);
    expect(legendaryHonorsMet(H(0))).toBe(false);
    expect(legendaryHonorsMet(H(1))).toBe(false);
    expect(legendaryHonorsMet(H(2))).toBe(false);
    expect(legendaryHonorsMet(H(3))).toBe(true);
    expect(legendaryHonorsMet(H(1, 1))).toBe(true);
    expect(legendaryHonorsMet(H(1, 0, 1))).toBe(true);
    expect(legendaryHonorsMet(H(0, 1, 1))).toBe(false);
  });

  it('레전더리 = 월드클래스 점수 + 업적 조건. 점수만으로는 오르지 않는다', () => {
    expect(reputationTier(1000, H(0))).toBe('worldClass');
    expect(reputationTier(1000, H(1, 1))).toBe('legendary');
    expect(reputationTier(899, H(5, 1, 1))).toBe('topClass');
    // 월드클래스에서 다음 티어는 점수로 보여 주지 않는다 (업적 조건)
    expect(nextReputationTier(950, H(0))).toBeNull();
    expect(nextReputationTier(600)).toEqual({ tier: 'worldClass', cut: 900 });
  });

  it('조건 목록: 위상 줄은 점수로, 대회 줄은 수상 기록으로', () => {
    const c = legendaryConditions(950, H(0));
    expect(c).toHaveLength(5);
    expect(c[0]!.met).toBe(true);
    expect(c.slice(1).every((x) => !x.met)).toBe(true);
    expect(legendaryConditions(100)[0]!.met).toBe(false);
  });

  it('개인 기록 가산은 시즌 최대 80', () => {
    expect(BALANCE.reputation.personal.max).toBe(80);
    expect(personalReputation({ ...emptySeasonStats(), moms: 30, goals: 60, assists: 40 })).toBe(80);
    expect(personalReputation({ ...emptySeasonStats(), moms: 3, goals: 15, assists: 5 })).toBe(3 * 5 + 2 * 10);
  });

  it('새 게임 선수는 수상 기록 0 → 아무도 레전더리가 아니다', () => {
    const s = newGame({ mode: 'real', playerId: 'kane', seed: 'leg', difficulty: 'normal' });
    expect(s.player.honors).toEqual(H(0));
    expect(reputationTier(s.player.reputation, s.player.honors)).not.toBe('legendary');
  });
});

describe('세이브 변환 8 → 9 (부록 C.23)', () => {
  function oldSave(rep: number, rounds = 0) {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'mig9', difficulty: 'normal' });
    for (let i = 0; i < rounds; i++) playRound(s, { engine: 'quick' });
    s.player.reputation = rep;
    const old = JSON.parse(serialize(s));
    old.saveFormat = 8;
    delete old.player.honors;
    delete old.player.formerPositions;
    delete old.guide;
    return old;
  }

  it('위상 점수는 그대로, 티어만 새 기준으로 (예전 레전더리 850+ → 월드클래스)', () => {
    const loaded = deserialize(JSON.stringify(oldSave(950)));
    expect(loaded.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(SAVE_FORMAT_VERSION).toBe(27);
    expect(loaded.player.reputation).toBe(950);
    expect(loaded.player.honors).toEqual(H(0));
    expect(reputationTier(loaded.player.reputation, loaded.player.honors)).toBe('worldClass');
    // 예전 기준 월드클래스(600)였던 점수 → 탑클래스, 예전 스페셜(150) → 일반
    expect(reputationTier(deserialize(JSON.stringify(oldSave(600))).player.reputation)).toBe('topClass');
    expect(reputationTier(deserialize(JSON.stringify(oldSave(150))).player.reputation)).toBe('normal');
  });

  it('이전 주 포지션 목록, 안내 상태 추가. 이미 경기를 치렀으면 성장이 바로 열리고 소개는 한 번', () => {
    const fresh = deserialize(JSON.stringify(oldSave(0)));
    expect(fresh.player.formerPositions).toEqual([]);
    expect(fresh.guide.unlocked).toEqual([]);
    expect(fresh.guide.firstMatchSeen).toBe(false);
    const played = deserialize(JSON.stringify(oldSave(0, 2)));
    expect(isUnlocked(played.guide, 'growth')).toBe(true);
    expect(pendingIntro(played.guide)?.id).toBe('growth');
    expect(played.guide.firstMatchSeen).toBe(true);
  });
});

describe('단계적 공개 (21.3 개정안)', () => {
  it('성장은 첫 경기 뒤, 전술은 3경기 뒤에 열린다. 아직 없는 기능은 조건만 있고 열리지 않는다', () => {
    const s = newGame({ mode: 'prospect', position: 'CM', seed: 'unlock', difficulty: 'normal' });
    expect(isUnlocked(s.guide, 'growth')).toBe(false);
    expect(checklistItems(s.guide)!.map((c) => c.id)).toEqual(['play']);
    for (let i = 0; i < 12; i++) playRound(s, { engine: 'quick' });
    expect(s.guide.unlocked).toEqual(['growth', 'tactics']);
    for (const f of FEATURES.filter((x) => !x.implemented)) expect(isUnlocked(s.guide, f.id)).toBe(false);
    expect(checklistItems(s.guide)!.map((c) => [c.id, c.done])).toEqual([['play', true], ['allocate', false], ['tactics', false]]);
    expect(refreshUnlocks(s)).toEqual([]);
  });

  it('말풍선: 한 번 보면 끝, 안내 끄기, 다시 보기', () => {
    const s = newGame({ mode: 'prospect', position: 'CM', seed: 'tip', difficulty: 'normal' });
    expect(tipFor(s.guide, 'home')).toBeTruthy();
    s.guide.tipsSeen.push('home');
    expect(tipFor(s.guide, 'home')).toBeNull();
    s.guide.tipsOff = true;
    expect(tipFor(s.guide, 'player')).toBeNull();
    s.guide.firstMatchSeen = true;
    resetTips(s.guide);
    expect(tipFor(s.guide, 'home')).toBeTruthy();
    expect(s.guide.firstMatchSeen).toBe(false);
  });
});

describe('이전 주 포지션 목록 (부록 C.23)', () => {
  it('여러 번 바꾸면 이전 주 포지션이 쌓이고, 돌아오면 목록에서 빠진다', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'prof', difficulty: 'normal' });
    const p = s.player;
    expect(requestPositionChange(p, 'CAM', true)).toBe(true);
    expect(requestPositionChange(p, 'CM', true)).toBe(true);
    expect(p.formerPositions).toEqual(['ST', 'CAM']);
    requestPositionChange(p, 'ST', true);
    expect(p.formerPositions).toEqual(['CAM', 'CM']);
  });
});

describe('재개 대기 빨리 감기 (디자인 18, 부록 C.23)', () => {
  const fr = (e: number, x: number, restart?: ReplayFrame['restart']): ReplayFrame => ({
    e, t: e, ball: { x: 50, y: 34, z: 0 }, carrier: null, players: [{ id: 'a', x, y: 10 }, { id: 'b', x: 20, y: 20 }], ...(restart ? { restart } : {}),
  });
  it('공이 죽어 있고 모두 재개 위치 1 m 안이면 true, 그 전과 공이 살아 있을 때는 false', () => {
    const frames = [fr(0, 0), fr(1, 10, 'throwIn'), fr(2, 13.5, 'throwIn'), fr(3, 14.6, 'throwIn'), fr(4, 15, 'throwIn'), fr(5, 15)];
    const r = { frames } as unknown as Replay;
    expect(settledFrames(r, 1)).toEqual([false, false, false, true, true, false]);
  });
});
