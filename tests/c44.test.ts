// C.44 독·자동 진행·능력치 1~20·체력 표시·시즌 종료 화면·더비
import { describe, expect, it } from 'vitest';
import { attrDisplay, attrTextToDisplay, displayDelta, displayProgress, nextDisplayAt } from '../src/attributes';
import { derbyOf, rivalsOf } from '../src/derby';
import { newGame, playOthers, endDay, isMatchDay, playRound } from '../src/game';
import { FatigueGauge, staminaOf } from '../src/ui/components';
import { autoSheetVM, homeVM } from '../src/ui/viewModels';
import { dock } from '../src/ui/views/common';
import { autoSheet } from '../src/ui/views/progress';
import { CLUB_TO_TEAM } from '../src/league';

describe('능력치 1~20 표시 (C.44)', () => {
  it('내부 ÷ 5 반올림, 최소 1, 최대 20. 다음 칸 시작 값과 진행', () => {
    expect([0, 2, 3, 7, 8, 62, 63, 67, 68, 97, 98, 99].map(attrDisplay)).toEqual([1, 1, 1, 1, 2, 12, 13, 13, 14, 19, 20, 20]);
    expect(nextDisplayAt(63)).toBe(68);
    expect(nextDisplayAt(67)).toBe(68);
    expect(nextDisplayAt(98)).toBeNull();
    expect(displayProgress(63)).toBe(0);
    expect(displayProgress(65)).toBeCloseTo(0.4, 6);
    expect(displayDelta(2)).toBe('+0.4');
    expect(displayDelta(-5)).toBe('−1');
  });

  it('카드 조건 글의 능력치 숫자도 1~20 (거리·퍼센트 숫자는 그대로)', () => {
    expect(attrTextToDisplay('슛 장면, 골에서 16~25 m, 중거리 슛 65 (시작 덱 60)')).toBe('슛 장면, 골에서 16~25 m, 중거리 슛 13 (시작 덱 12)');
    expect(attrTextToDisplay('크로스 장면(약한 발 방향), 크로스 75 + 볼 컨트롤 70')).toBe('크로스 장면(약한 발 방향), 크로스 15 + 볼 컨트롤 14');
    expect(attrTextToDisplay('GK가 골라인에서 6 m 이상 전진')).toBe('GK가 골라인에서 6 m 이상 전진');
  });
  // [+] 한 칸 찍기는 C.49 에서 포인트 1개 = 화면 +1칸으로 바뀌었다 (tests/c49.test.ts)
});

describe('체력 표시 (C.44)', () => {
  it('체력 = 100 − 피로, 30 이하 빨강', () => {
    expect(staminaOf(0)).toBe(100);
    expect(staminaOf(72.4)).toBe(28);
    expect(FatigueGauge({ value: 72 })).toContain('po-fatigue--high');
    expect(FatigueGauge({ value: 10 })).toContain('po-fatigue--low');
    expect(FatigueGauge({ value: 10 })).toContain('체력');
    expect(FatigueGauge({ value: 10 })).toContain('>90<');
  });
});

describe('더비 (C.44)', () => {
  it('명시 표: 북런던·머지사이드·맨체스터·노스웨스트, 리그 팀끼리 표에 없으면 더비 아님', () => {
    expect(derbyOf('tot', 'ars')).toMatchObject({ name: '북런던 더비', big: true, auto: false });
    expect(derbyOf('eve', 'liv')?.name).toBe('머지사이드 더비');
    expect(derbyOf('mci', 'mun')?.name).toBe('맨체스터 더비');
    expect(derbyOf('mun', 'liv')?.name).toBe('노스웨스트 더비');
    expect(derbyOf('cry', 'bha')?.name).toBe('M23 더비');
    expect(derbyOf('cry', 'ful')).toBeNull();
    expect(derbyOf('tot', 'liv')).toBeNull();
  });
  it('리그 밖 구단은 같은 지역이면 자동 지역 더비', () => {
    expect(derbyOf('x:mil', 'x:int')?.auto).toBe(false);
    expect(derbyOf('x:not', 'x:der')?.name).toBe('이스트 미들랜즈 더비');
    expect(derbyOf('x:wig', 'bur')).toMatchObject({ auto: true, name: '랭커셔 더비' });
    expect(derbyOf('x:bar', 'x:mil')).toBeNull();
  });
  it('2018-19 PL 팀별 라이벌', () => {
    const pl = Object.values(CLUB_TO_TEAM);
    expect(rivalsOf('tot', pl).map((r) => r.id).sort()).toEqual(['ars', 'che', 'whu']);
    expect(rivalsOf('liv', pl).map((r) => r.id).sort()).toEqual(['eve', 'mun']);
  });
});

describe('자동 진행 시트·독·홈 더비 배지 (C.44)', () => {
  it('다음 더비: 날짜·그 전까지 경기 수·남은 더비, 없는 대회는 회색', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c44-auto', difficulty: 'normal' });
    const vm = autoSheetVM(g);
    // C.67: 리그 38 + 추첨된 FA컵 32강 1 + 챔스 조별 6 (토트넘)
    expect(vm.remaining).toBe(45);
    const d = vm.targets.find((t) => t.id === 'derby')!;
    expect(d.available).toBe(true);
    expect(d.next!.left).toBe(6);
    expect(vm.targets.filter((t) => !t.available).map((t) => t.id)).toEqual(['aMatch', 'nationsCup']);
    const html = autoSheet(vm, 5);
    expect(html).toContain('아직 없음');
    expect(html).toContain('5경기 자동 진행');
    // 더비 직전까지 진행하면 홈 다음 경기 카드에 배지
    while (g.calendar.date < d.next!.iso || !isMatchDay(g)) {
      playOthers(g, 'quick');
      if (isMatchDay(g)) playRound(g); else endDay(g);
    }
    expect(homeVM(g).next!.derby?.name).toBeTruthy();
  });
  it('독: 모바일 5칸 + PC 9칸, 진행 칸 동작 (C.50 홈 가운데, C.54 디자인 154 모양)', () => {
    const html = dock({ screen: 'home', prog: { label: '계속', icon: 'chevron-right', act: 'day-continue' }, tacticsOpen: false, points: 3, more: false });
    const bar = (cls: string) => html.split(cls)[1]!.split('</div>')[0]!;
    const labels = (h: string) => [...h.matchAll(/class="po-dock__(?:go)?label">([^<]+)</g)].map((m) => m[1]!);
    // C.66: 홈 = 맨 왼쪽 일반 칸, [다음](진행) 키가 PC 9칸·모바일 5칸 모두 가운데
    expect(labels(bar('dock-phone'))).toEqual(['홈', '선수', '계속', '훈련·일정', '더보기']);
    expect(labels(bar('dock-wide'))).toEqual(['홈', '덱', '전술', '선수', '계속', '훈련·일정', '월드', '설정', '저장']);
    expect(html).toContain('data-act="day-continue"');
    expect(html).toContain('is-locked');
  });
});
