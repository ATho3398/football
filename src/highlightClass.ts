// 하이라이트 분류 한 곳 (C.81o, 17차 검수 13번 · AD 규칙): 결과 화면 클립 · 재생 장면 칸 · 시즌 하이라이트가 같은 함수·같은 이름을 쓴다.
// 우리 골(내 골·내 도움 골 포함) = 골 · 상대 골 = 실점 · 골이 아닌 큰 기회 = 결정적 장면 · 골이 아닌 내 장면 = 내 최고 순간.
// 골과 내 장면이 겹치면 골이 우선이고, "내 골"·"내 도움"은 골 칸 안의 배지로 보인다. 색: 골 라임 · 실점 주황 · 기회 흰 · 내 최고 순간 시안

export type HighlightClass = 'goal' | 'concede' | 'chance' | 'best';

/** 긴 이름 (결과 화면 클립 줄) */
export const HL_CLASS_KO: Readonly<Record<HighlightClass, string>> = { goal: '골', concede: '실점', chance: '결정적 장면', best: '내 최고 순간' };
/** 짧은 이름 (재생 장면 칸) */
export const HL_CLASS_SHORT: Readonly<Record<HighlightClass, string>> = { goal: '골', concede: '실점', chance: '기회', best: '내 장면' };

export type MyGoalBadge = 'myGoal' | 'myAssist';
export const MY_GOAL_BADGE_KO: Readonly<Record<MyGoalBadge, string>> = { myGoal: '내 골', myAssist: '내 도움' };

/**
 * 한 장면 분류. goal = 골 장면인지, team = 그 장면 팀, side = 우리 팀, mine = 내 장면(골이 아닐 때만 의미)
 * 골이면 팀으로 골·실점 (내 장면이어도 골 우선), 아니면 내 장면 → 내 최고 순간, 그 밖 → 결정적 장면
 */
export function classifyHighlight(m: { goal: boolean; team: 0 | 1; mine?: boolean }, side: 0 | 1): HighlightClass {
  if (m.goal) return m.team === side ? 'goal' : 'concede';
  return m.mine ? 'best' : 'chance';
}

/** 골 이벤트 선수 [득점자, 도움] 에서 내 골·내 도움 배지 */
export function myGoalBadge(players: readonly string[], me: string | undefined): MyGoalBadge | null {
  if (!me) return null;
  return players[0] === me ? 'myGoal' : players[1] === me ? 'myAssist' : null;
}

/**
 * 하이라이트 클립 골 문구의 점수를 내 팀 먼저로 (C.81v2): 재생 데이터 골 문구는 "골! … — 홈 : 원정"(스코어보드 순서)이라
 * 결과 화면(머리 점수·득점 줄 = 내 팀 먼저)에서 원정 경기면 "— 0 : 2"처럼 뒤집혀 보였다. 내가 원정(side 1)이면 두 숫자를 바꾼다
 */
export function clipTextMyFirst(text: string, side: 0 | 1): string {
  if (side === 0) return text;
  // 점수는 scoreText(NBSP 둘레) 그대로의 간격을 지킨다
  return text.replace(/—(\s)(\d+)(\s*:\s*)(\d+)$/, (_, sp: string, h: string, mid: string, a: string) => `—${sp}${a}${mid}${h}`);
}
