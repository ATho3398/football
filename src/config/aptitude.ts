// 포지션 적성 데이터 (pending 31·36, 부록 C.37): 숨은 재능 타입, 코치 한 줄 평, 포변 조언 문구.
// 수치(배수 범위·확률·조언 조건)는 balance.ts 의 aptitude. 여기에는 데이터와 문구만 둔다

import type { FieldAttribute } from '../attributes';
import type { PlayablePosition } from '../positions';

/** 숙련도 적성을 따지는 포지션군 (GK 제외 7개, pending 36 ③) */
export const APT_GROUPS = ['ST', 'wing', 'CAM', 'CM', 'CDM', 'fullback', 'CB'] as const;
export type AptGroup = (typeof APT_GROUPS)[number];

export const APT_GROUP_POSITIONS: Record<AptGroup, readonly PlayablePosition[]> = {
  ST: ['ST', 'CF'],
  wing: ['LW', 'RW', 'LM', 'RM'],
  CAM: ['CAM'],
  CM: ['CM'],
  CDM: ['CDM'],
  fullback: ['LB', 'RB'],
  CB: ['CB'],
};

export const APT_GROUP_NAMES_KO: Record<AptGroup, string> = {
  ST: '최전방', wing: '측면', CAM: '공격형 미드', CM: '중앙 미드', CDM: '수비형 미드', fullback: '풀백', CB: '센터백',
};

export interface TalentType {
  id: string;
  name: string;
  /** 생성 때 높게 나오는 능력치 */
  attrs: readonly FieldAttribute[];
  /** 적성이 맞는 포지션군 */
  groups: readonly AptGroup[];
  /** 능력치 기준 자리 (생성 때 이 중 하나의 포지션 OVR 로 맞춘다) */
  anchors: readonly PlayablePosition[];
}

/** 숨은 재능 타입 (플레이어에게 이름은 보이지 않는다) */
export const TALENT_TYPES: readonly TalentType[] = [
  { id: 'speed', name: '빠름', attrs: ['pace', 'acceleration', 'agility', 'dribbling'], groups: ['wing', 'fullback', 'ST'], anchors: ['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'ST'] },
  { id: 'technique', name: '기술', attrs: ['dribbling', 'ballControl', 'shortPassing', 'agility', 'composure'], groups: ['CAM', 'wing', 'ST'], anchors: ['CAM', 'CF', 'LW', 'RW'] },
  { id: 'power', name: '힘', attrs: ['strength', 'jumping', 'heading', 'tackling', 'stamina'], groups: ['CB', 'CDM', 'ST'], anchors: ['CB', 'CDM', 'ST'] },
  { id: 'vision', name: '시야', attrs: ['vision', 'shortPassing', 'longPassing', 'composure'], groups: ['CM', 'CAM', 'CDM'], anchors: ['CM', 'CAM', 'CDM'] },
  { id: 'finisher', name: '골 감각', attrs: ['shooting', 'offTheBall', 'composure', 'longShots'], groups: ['ST', 'CAM', 'wing'], anchors: ['ST', 'CF'] },
  { id: 'engine', name: '활동량', attrs: ['stamina', 'workRate', 'interception', 'crossing'], groups: ['CM', 'CDM', 'fullback'], anchors: ['CM', 'CDM', 'LB', 'RB'] },
  { id: 'defender', name: '수비 감각', attrs: ['marking', 'defensivePositioning', 'interception', 'tackling'], groups: ['CB', 'fullback', 'CDM'], anchors: ['CB', 'LB', 'RB', 'CDM'] },
];

/**
 * 시작 후보 코치 한 줄 평 (pending 31 01:03): [적합도][적성 말투]. {pos} = 포지션 한글 이름.
 * 적성 수치는 보이지 않고 말투로만 은근히 드러난다. 따뜻한 말투(warm)는 적성이 높은 자리, 담담한 말투(plain)는 낮은 자리
 */
export const COACH_LINES: Record<'top' | 'good' | 'wild', Record<'warm' | 'mid' | 'plain', readonly string[]>> = {
  top: {
    warm: ['{pos} 자리가 제일 자연스러워. 뛰는 걸 보면 몸이 먼저 알아.', '{pos}에서는 가르칠 게 별로 없겠어. 금방 자리 잡을 거야.'],
    mid: ['지금 능력치로는 {pos} 자리가 제일 무난해.', '{pos} 자리라면 당장 경기에 나설 수 있겠어.'],
    plain: ['숫자로는 {pos} 자리가 제일 낫다. 일단 거기서 시작해 보자.', '{pos}, 무난하지. 나머지는 네가 만들어 가는 거야.'],
  },
  good: {
    warm: ['{pos}도 잘 어울려. 해 보면 생각보다 빨리 익을걸.', '{pos}에서 움직임이 좋더라. 눈여겨보고 있어.'],
    mid: ['{pos}도 충분히 해 볼 만해.', '{pos}, 나쁘지 않아. 선택은 너한테 달렸어.'],
    plain: ['{pos}도 할 수는 있어. 다만 익숙해지는 데 시간이 좀 걸릴 거야.', '{pos}? 능력치로는 가능해.'],
  },
  wild: {
    warm: ['아직 거칠지만 {pos}에서 뭔가 보인다.', '능력치만 보면 의외지만, {pos}에서 한 번 보고 싶어.'],
    mid: ['{pos} 자리는 모험이야. 그래도 해 볼 수는 있지.', '{pos}? 지금은 애매하지만 길이 없진 않아.'],
    plain: ['{pos} 자리는 솔직히 모험이야. 그래도 원한다면.', '{pos} 자리는 어려운 길이야. 각오는 해야 해.'],
  },
};

/** 포변 조언 문구 (pending 31 3번, 36 ⑥). 인박스(5-2) 전까지 홈 알림 카드. {name} 선수 이름, {pos} 포지션 코드, {posKo} 한글, {cur} 지금 포지션 */
export const ADVICE_TEXT = {
  coach: {
    eyebrow: '감독 한마디',
    title: '{pos}에서 한번 뛰어 볼래?',
    body: '요즘 {cur}에서 잘 안 풀리지? 훈련 때 보니 {posKo} 자리에서 움직임이 좋더라. 바꿀지는 네가 정해.',
  },
  news: {
    eyebrow: '현지 언론',
    title: '"{name}, {posKo} 자리가 더 어울린다"',
    body: '두 시즌째 {cur}에서 고전 중인 {name}. 현지 해설진은 "{pos} 자리로 옮기면 반등할 수 있다"고 입을 모았다.',
  },
  /** 남은 기간 표시 */
  window: '{n}일 안에 바꾸면 그 포지션 숙련도가 더 빨리 올라요.',
  taken: '조언대로 {pos} 자리로! 이 포지션으로 뛰는 {n}경기 동안 숙련도가 더 크게 올라요.',
} as const;
