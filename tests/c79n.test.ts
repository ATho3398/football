// C.79n 화면 문구·주전 경쟁 피로 정리: 폼 = 엔진 성공 확률 효과, 주전 경쟁 피로 칸·선발 확률 % = 실제 선발 식과 같은 입력 (판정 불변)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { matchFatigue, myMatchPosition, myStartChance, myStartInputs, newGame } from '../src/game';
import { competition, selectionBonus, startChance, styleOvrBonus } from '../src/manager';
import { startProbability } from '../src/match';
import { teamById } from '../src/league';
import { proficientOvr } from '../src/proficiency';
import { competitionVM } from '../src/ui/managerVM';
import { formEffectLabel, formLine } from '../src/ui/viewModels';

describe('C.79n 폼 문구', () => {
  it('엔진 경기 = 성공 확률 %p, 빠른 경기 = 평점 보정', () => {
    expect(formEffectLabel(0.2)).toBe('성공 확률 +2%p');
    expect(formEffectLabel(-0.15)).toBe('성공 확률 −1.5%p');
    expect(formEffectLabel(0.2, false)).toBe('평점 보정 +0.20');
  });

  it('내 상태 폼 줄: 5경기 전은 n/5경기, 그 뒤 성공 확률 (최대 ±3%p)', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c79n-form', difficulty: 'normal' });
    g.player.recentRatings = [7, 7];
    expect(formLine(g.player)).toBe(`2/${BALANCE.form.games}경기`);
    g.player.recentRatings = [9, 9, 9, 9, 9];
    expect(formLine(g.player)).toMatch(/^성공 확률 \+3%p$/);
  });
});

describe('C.79n 주전 경쟁 피로·선발 확률', () => {
  const setup = () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c79n-comp', difficulty: 'normal' });
    g.phase = 'season';
    (g.coaches ??= {})[g.player.teamId] = { name: 'x', nameKo: 'x', style: 'neutral', since: g.league.season };
    return g;
  };

  it('피로 칸: 50 이하 0, 60·80 은 실제 선발 확률 곱을 OVR 로 환산한 값 (같은 확률이 나온다)', () => {
    const g = setup();
    const pos = myMatchPosition(g);
    const rating = teamById(g.league, g.player.teamId).rating;
    const base = proficientOvr(g.player, pos);
    const fat = (f: number) => competition(g, pos, 2, { fatigue: f }).find((r) => r.me)!.fatigue;
    expect(fat(30)).toBe(0);
    expect(fat(60)).toBeLessThan(0);
    expect(fat(80)).toBeLessThan(fat(60));
    for (const f of [60, 80]) {
      // 피로 없는 선발 점수 + 피로 칸 → 피로 0 곡선 = 실제 startChance(피로 f) (상·하한에 안 걸린 구간)
      const noFat = base + selectionBonus(g) + styleOvrBonus(g, base, rating, 0);
      const viaCard = startProbability(noFat + fat(f), rating, 0);
      expect(viaCard).toBeCloseTo(startChance(g, base, rating, f), 2);
    }
  });

  it('카드 머리 선발 확률 % = 경기 날 피로 + 시즌 누적 피로 · 상대 레이팅 (실제 판정 입력)', () => {
    const g = setup();
    g.player.fatigue = 60;
    g.player.seasonFatigue = 20;
    const inp = myStartInputs(g);
    expect(inp.fatigue).toBeGreaterThanOrEqual(matchFatigue(g, 0) - 0.001);
    const ovr = proficientOvr(g.player, myMatchPosition(g));
    const vm = competitionVM(g)!;
    expect(vm.chance).toBe(Math.round(myStartChance(g, ovr) * 100));
    expect(vm.chance).toBe(Math.round(startChance(g, ovr, teamById(g.league, g.player.teamId).rating, inp.fatigue, inp.oppRating) * 100));
  });
});
