// C.81o 화면 간 데이터 일치 감사 (17차 검수 12~18번): 반올림 한 곳 · XP 기준 한 곳 · 능력치 1~20 척도 문구 · 득점 분 · 등번호 · 실시간 하이라이트
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avgRating, avgRatingText, ratingText, roundRating } from '../src/avgRating';
import { attrDisplay } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { matchMinute, minuteText } from '../src/engine/minute';
import { summarize } from '../src/engine/npcMatch';
import { newGame } from '../src/game';
import { xpToLevel } from '../src/growth';
import { coachBoost, coachLimitShown, staffEffect } from '../src/money';
import { replayPlayers } from '../src/replay';
import { rivalCardVM } from '../src/ui/inboxVM';
import { compRecordVM } from '../src/ui/seasonVM';
import { homeVM, playerVM } from '../src/ui/viewModels';
import { sceneTileClass } from '../src/ui/views/replay';
import { positionSheet } from '../src/ui/views/home';
import type { PlayerSpec, TeamSetup } from '../src/engine/types';

const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c81o', difficulty: 'normal' });

describe('평균 평점 반올림 한 곳', () => {
  it('6.775 는 어디서나 6.78 (toFixed 의 부동소수 내림이 없다)', () => {
    expect((6.765).toFixed(2)).toBe('6.76'); // 예전 방식의 문제 (부동소수 내림)
    expect(roundRating(6.765)).toBe(6.77);
    expect(roundRating(6.775)).toBe(6.78);
    expect(avgRating(27.1, 4)).toBe(6.78);
    expect(avgRatingText(27.1, 4)).toBe('6.78');
    expect(avgRatingText(0, 0)).toBe('-');
    expect(ratingText(null)).toBe('-');
  });
  it('홈 라이벌 표 · 선수 기록(대회별) · 홈 시즌 기록이 같은 평균을 보인다', () => {
    const g = son();
    g.player.season.apps = 4;
    g.player.season.ratingSum = 27.1; // 6.775
    const rival = rivalCardVM(g);
    const comp = compRecordVM(g);
    const home = homeVM(g);
    const league = comp.rows[0]!.avg;
    expect(league).toBe('6.78');
    if (rival) expect(rival.me.avg).toBe(league);
    expect(home.stats.avg).toBe(league);
  });
  it('화면 코드에 평점 toFixed(2) 직접 반올림이 없다 (avgRating.ts 만)', () => {
    const files = walk('src').filter((f) => f.endsWith('.ts') && !f.endsWith('avgRating.ts'));
    const bad = files.filter((f) => /(ratingSum|avg|rating)[^;\n]{0,40}\.toFixed\(2\)/i.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});

describe('다음 레벨 XP 기준 한 곳', () => {
  it('홈 카드 · 선수 화면이 같은 xpToLevel', () => {
    const g = son();
    g.player.xp = 37;
    const need = xpToLevel(g.player);
    expect(homeVM(g).card.xpMax).toBe(need);
    expect(playerVM(g).xpMax).toBe(need);
  });
});

describe('능력치 1~20 척도 문구', () => {
  it('코치 효과 = "능력치 15 이하만" (내부 75 아님), 판정도 화면 값', () => {
    for (const tier of ['normal', 'special', 'topClass', 'worldClass', 'legendary'] as const) {
      const shown = coachLimitShown(tier);
      expect(shown).toBe(attrDisplay(BALANCE.staff.coach.limit[tier]));
      expect(shown).toBeLessThanOrEqual(20);
      expect(staffEffect({ role: 'coach', tier, attrs: ['dribbling'] })).toContain(`능력치 ${shown} 이하만`);
    }
    expect(staffEffect({ role: 'coach', tier: 'normal', attrs: ['dribbling'] })).not.toMatch(/능력치 (2[1-9]|[3-9]\d) 이하/);
    // 화면 15(내부 77)는 "15 이하"이므로 코치 효과를 받는다, 화면 16(내부 78)은 못 받는다
    const g = son();
    g.money = { ...(g.money ?? {}), staff: [{ id: 'c', role: 'coach', tier: 'normal', name: '코치', attrs: ['dribbling'], salary: 1, years: 1 }] } as never;
    const p = { ...g.player, attributes: { ...g.player.attributes, dribbling: 77 } };
    expect(attrDisplay(77)).toBe(15);
    expect(coachBoost(g, p, 'ballHandling')?.target).toBe('dribbling');
    expect(coachBoost(g, { ...p, attributes: { ...p.attributes, dribbling: 78 } }, 'ballHandling')).toBeNull();
  });
  it('화면 문구에 능력치 내부 값(0~99)을 그대로 넣는 곳이 없다', () => {
    const files = walk('src').filter((f) => f.endsWith('.ts'));
    const bad = files.filter((f) => /능력치 \$\{[^}]*limit\[/.test(readFileSync(f, 'utf8')) || /(상한|한계) \$\{Math\.round\([^)]*\/ 5\)\}/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});

describe('득점 분 표기 한 곳', () => {
  it('전반·후반 추가시간', () => {
    expect(minuteText(...matchMinute(12 * 60 + 5, 1))).toBe('13');
    expect(minuteText(...matchMinute(2700 + 70, 1))).toBe('45+2');
    expect(minuteText(...matchMinute(2700 + 30, 2))).toBe('46');
    expect(minuteText(...matchMinute(5400 + 150, 2))).toBe('90+3');
  });
  it('골 기록: 전반 추가시간 골이 46\'·47\'로, 후반 추가시간 골이 90\'로 잘리지 않는다', () => {
    const ev = (t: number, type: string, team: 0 | 1 = 0) => ({ t, type, team, players: type === 'goal' ? ['a'] : [] });
    const s = summarize({ homeGoals: 2, awayGoals: 0, players: [], events: [ev(2700 + 70, 'goal'), ev(2760, 'halftime'), ev(5400 + 150, 'goal')] });
    expect(s.goals).toEqual([[45, 0, 'a', null, 2], [90, 0, 'a', null, 3]]);
  });
});

describe('평균 위치·재생 등번호', () => {
  it('실제 등번호와 슬롯 번호가 섞여도 같은 팀 번호가 겹치지 않는다', () => {
    const spec = (id: string, slot: number, shirt?: number): PlayerSpec => ({ id, slot, position: 'CM', ...(shirt !== undefined ? { shirt } : {}) }) as unknown as PlayerSpec;
    const team = (pre: string): TeamSetup => ({
      lineup: [spec(`${pre}1`, 0, 3), spec(`${pre}2`, 1), spec(`${pre}3`, 2), spec(`${pre}4`, 3, 2)],
      bench: [spec(`${pre}5`, 0, 3), spec(`${pre}6`, 0)],
    }) as unknown as TeamSetup;
    const ps = replayPlayers(team('h'), team('a'));
    for (const t of [0, 1]) {
      const nums = ps.filter((p) => p.team === t).map((p) => p.number);
      expect(new Set(nums).size).toBe(nums.length);
    }
    expect(ps.find((p) => p.id === 'h1')!.number).toBe(3); // 실제 등번호 유지
  });
});

describe('실시간 재생: 지나간 장면만', () => {
  it('실시간 2분에 45분 장면 칸은 닫혀 있다', () => {
    const vm = { mode: 'live' as const, scene: 1, at: 120 };
    expect(sceneTileClass(vm, 1, 100)).toBe('done');
    expect(sceneTileClass(vm, 2, 45 * 60)).toBe('');
    expect(sceneTileClass({ ...vm, mode: 'ended' }, 2, 45 * 60)).toBe('done');
  });
});

describe('포지션 변경 시트', () => {
  it('"항상 허용" 모순 문구 없음 · 지금과의 OVR 차이 = 화면 숫자 차이', () => {
    const html = positionSheet([
      { pos: 'RW', ko: '오른쪽 윙어', prof: 100, ovr: 88, penalty: 0, current: true },
      { pos: 'CF', ko: '센터 포워드', prof: 0, ovr: 80, penalty: 6, current: false },
    ], 'RW');
    expect(html).not.toContain('항상 허용');
    expect(html).toContain('지금보다 OVR −8 (숙련 감점 −6 포함)');
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('하이라이트 분류 한 곳 (13번)', async () => {
  const { classifyHighlight, HL_CLASS_KO, myGoalBadge } = await import('../src/highlightClass');
  const { clipClass } = await import('../src/highlightClips');
  const { sceneClass } = await import('../src/highlights');
  it('우리 골(내 골·도움 포함) = 골, 상대 골 = 실점, 기회 = 결정적 장면, 골 아닌 내 장면 = 내 최고 순간', () => {
    expect(classifyHighlight({ goal: true, team: 0, mine: true }, 0)).toBe('goal');
    expect(classifyHighlight({ goal: true, team: 1 }, 0)).toBe('concede');
    expect(classifyHighlight({ goal: false, team: 0 }, 0)).toBe('chance');
    expect(classifyHighlight({ goal: false, team: 0, mine: true }, 0)).toBe('best');
    expect(myGoalBadge(['me', 'x'], 'me')).toBe('myGoal');
    expect(myGoalBadge(['x', 'me'], 'me')).toBe('myAssist');
    expect(HL_CLASS_KO.chance).toBe('결정적 장면');
    expect(HL_CLASS_KO.best).toBe('내 최고 순간');
  });
  it('결과 클립 · 재생 장면이 같은 분류 (옛 세이브 실점 클립 kind goal 도 실점)', () => {
    expect(clipClass({ kind: 'goal', team: 1 }, 0)).toBe('concede');
    expect(clipClass({ kind: 'goal', team: 1 }, 1)).toBe('goal');
    expect(sceneClass({ kind: 'goal', team: 1 }, 0)).toBe('concede');
    expect(sceneClass({ kind: 'me', team: 0 }, 0)).toBe(clipClass({ kind: 'best', team: 0 }, 0));
    expect(sceneClass({ kind: 'chance', team: 1 }, 0)).toBe(clipClass({ kind: 'chance', team: 1 }, 0));
  });
});
