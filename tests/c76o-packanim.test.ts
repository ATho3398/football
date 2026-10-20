// C.76o 팩 개봉 연출: 순수 규칙 (최고 희귀도 · 설정 · 움직임 줄이기 · 입자 상한 · 교체 파일 이름 · 선택권 한 번만)
import { describe, expect, it } from 'vitest';
import {
  RARITY_FX, bestRarity, burstCount, loadPackAnimPref, markPickSeen, particleCap, pickKey, coverClip, coverFiles, pickSeen, resolveMode, savePackAnimPref, sequenceFrame, videoFile,
} from '../src/ui/packAnim/model';
import { PACK_ANIM } from '../src/ui/packAnim/config';

function mem(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('C.76o 팩 개봉 연출 규칙', () => {
  it('최고 희귀도', () => {
    expect(bestRarity(['common', 'rare', 'common'])).toBe('rare');
    expect(bestRarity(['epic', 'legendary', 'rare'])).toBe('legendary');
    expect(bestRarity([])).toBe('common');
  });
  it('희귀도가 높을수록 연출이 세다 (빛 색: 흰·파랑·보라·금, 전설만 워크아웃)', () => {
    expect(RARITY_FX.common.burst).toBeLessThan(RARITY_FX.rare.burst);
    expect(RARITY_FX.rare.burst).toBeLessThan(RARITY_FX.epic.burst);
    expect(RARITY_FX.epic.burst).toBeLessThan(RARITY_FX.legendary.burst);
    expect(RARITY_FX.legendary.walkout && !RARITY_FX.epic.walkout).toBe(true);
    expect(RARITY_FX.epic.holo && !RARITY_FX.rare.holo).toBe(true);
    expect(RARITY_FX.legendary.color).toBe('#ffd23f');
  });
  it('설정 전체/짧게/끔 저장, 기본 전체, 움직임 줄이기면 짧게', () => {
    const s = mem();
    expect(loadPackAnimPref(s)).toBe('full');
    savePackAnimPref('off', s);
    expect(loadPackAnimPref(s)).toBe('off');
    expect(loadPackAnimPref(null)).toBe('full');
    expect(resolveMode('full', true)).toBe('short');
    expect(resolveMode('off', true)).toBe('off');
    expect(resolveMode('full', false)).toBe('full');
  });
  it('입자 상한: 폰은 낮게, 짧게면 절반', () => {
    expect(particleCap(390)).toBeLessThan(particleCap(1280));
    expect(burstCount('legendary', 390, false)).toBeLessThanOrEqual(particleCap(390));
    expect(burstCount('legendary', 390, true)).toBeLessThan(burstCount('legendary', 390, false));
  });
  it('대체 연출 파일 이름 규칙 (docs/pack-animation.md)', () => {
    expect(videoFile('legendary')).toBe('anim/pack/pack-legendary.webm');
    expect(videoFile('rare', 'mp4')).toBe('anim/pack/pack-rare.mp4');
    expect(sequenceFrame('epic', 0)).toBe('anim/pack/pack-epic/0001.png');
    expect(sequenceFrame('common', 59)).toBe('anim/pack/pack-common/0060.png');
    expect(PACK_ANIM.kind).toBe('motion');
  });
  it('표지 한 장: 종류별 → cover.png 순서, 선택권은 종류별만, 찢는 선으로 위·몸통 자르기', () => {
    expect(coverFiles('pack', 'normal')).toEqual(['anim/pack/cover-normal.png', 'anim/pack/cover.png']);
    expect(coverFiles('pick', 'achievement')).toEqual(['anim/pack/cover-achievement.png']);
    expect(coverFiles('pick', undefined)).toEqual([]);
    expect(coverClip('top', 0.12)).toMatch(/^polygon\(0% 0%, 100% 0%, 100\.0% 1[0-3]/);
    expect(coverClip('body', 0.12)).toMatch(/100% 100%, 0% 100%\)$/);
  });
  it('선택권 공개는 한 번만', () => {
    const s = mem();
    const k = pickKey('시즌 목표 · 에픽', ['a', 'b', 'c']);
    expect(pickSeen(k, s)).toBe(false);
    markPickSeen(k, s);
    expect(pickSeen(k, s)).toBe(true);
    expect(pickSeen(pickKey('시즌 목표 · 에픽', ['a', 'b', 'd']), s)).toBe(false);
  });
});
