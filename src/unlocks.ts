// 단계적 공개와 첫 플레이 안내 (21.3·21.4 개정안, 부록 C.23). 기능은 진행 단위로 열린다.
// 아직 구현되지 않은 기능은 공개 조건만 등록하고(implemented: false) 화면에는 아예 숨긴다.
// 공개·안내 상태는 세이브(GameState.guide)에 담는다 (SAVE_FORMAT_VERSION 9)

import type { GameState } from './game';

export type FeatureId = 'growth' | 'tactics' | 'deck' | 'staff' | 'finance';

/** 첫 방문 말풍선이 있는 화면 */
export type TipId = 'home' | 'player' | 'world' | 'replay' | 'match' | 'allocate' | 'season' | 'tactics';

/** 첫 시즌 체크리스트 항목 (21.4, 공개 순서) */
export type ChecklistId = 'play' | 'allocate' | 'tactics' | 'deck' | 'inbox';

export interface GuideState {
  /** 열린 기능 (시작 기능은 항상 열려 있어 담지 않는다) */
  unlocked: FeatureId[];
  /** 공개 소개를 본 기능 */
  introsSeen: FeatureId[];
  /** 첫 방문 말풍선을 본 화면 */
  tipsSeen: TipId[];
  /** "안내 끄기" */
  tipsOff: boolean;
  /** 첫 경기 3줄 오버레이를 봤는지 */
  firstMatchSeen: boolean;
  /** 체크리스트에서 한 일 */
  done: ChecklistId[];
  /** 전술 화면 "자세히" 펼침 (21.3, 부록 C.32) */
  tacticsDetailOpen: boolean;
}

/** 공개 조건 입력: 커리어 전체에서 치른 리그 라운드 수, 끝난 시즌 수 */
export interface Progress {
  matches: number;
  seasons: number;
}

export interface FeatureDef {
  id: FeatureId;
  name: string;
  /** 열릴 때 한 번 보여 주는 소개 (한두 줄) */
  intro: string;
  implemented: boolean;
  when: string;
  open: (p: Progress) => boolean;
}

/** 진행 단위 공개표 (21.3 개정안) */
export const FEATURES: readonly FeatureDef[] = [
  {
    id: 'growth', name: '성장 (포인트 찍기)', implemented: true, when: '첫 경기 뒤',
    intro: '경기와 업적으로 XP를 모아 레벨이 오르면 능력치 포인트가 생겨요. 홈의 배너나 경기 결과에서 원하는 능력치에 찍어요.',
    open: (p) => p.matches >= 1,
  },
  {
    id: 'tactics', name: '전술', implemented: true, when: '3경기 뒤',
    intro: '이제 내가 팀 전술을 정해요. 홈의 다음 경기 카드에서 [전술]을 눌러 팀 성향을 고르고, 자세한 설정은 "자세히" 안에 있어요.', open: (p) => p.matches >= 3,
  },
  {
    id: 'deck', name: '역할과 덱', implemented: false, when: '10경기 뒤',
    intro: '내 역할을 고르고 경기에서 쓸 카드 덱을 짤 수 있어요.', open: (p) => p.matches >= 10,
  },
  { id: 'staff', name: '스태프', implemented: false, when: '첫 시즌이 끝난 뒤', intro: '코치와 스태프를 둘 수 있어요.', open: (p) => p.seasons >= 1 },
  { id: 'finance', name: '재정', implemented: false, when: '첫 시즌이 끝난 뒤', intro: '연봉과 수입을 관리할 수 있어요.', open: (p) => p.seasons >= 1 },
];

/** 화면 첫 방문 말풍선 (21.4 개정안, 한 줄) */
export const TIPS: Record<TipId, string> = {
  home: '여기서 다음 경기를 시작해요. 내 상태와 이번 시즌 기록도 한눈에 보여요.',
  player: '능력치, 위상, 포지션별 OVR과 숙련도를 볼 수 있어요.',
  world: '리그 순위표와 리그 스타 목록이에요.',
  replay: '오늘 경기의 하이라이트예요. [여기서부터 실시간]으로 끊김 없이 볼 수도 있어요.',
  match: '경기 결과와 전술 리포트예요. 무엇이 잘 됐고 안 됐는지 보여 줘요.',
  allocate: '포인트를 능력치에 찍어요. 값이 높을수록 1을 올리는 비용이 커져요.',
  season: '시즌 결과와 업적, 위상 변화, 자동 성장을 정리해요.',
  tactics: '팀 성향을 고르고 저장하면 다음 경기부터 그 전술로 뛰어요. 포메이션·내 위치·역할은 "자세히" 안에 있어요.',
};

/** 첫 경기 오버레이 3줄 (21.4 개정안) */
export const FIRST_MATCH_LINES: readonly string[] = [
  '라임색 마커가 우리 팀, 주황 테두리가 상대 팀이에요.',
  '하늘색 고리와 이름표가 붙은 마커가 내 선수예요.',
  '아래 이벤트 피드에 골·슈팅·카드 같은 일이 차례로 올라와요.',
];

/** 체크리스트 (21.4, 공개 순서). 아직 없는 기능 항목은 숨긴다 */
export const CHECKLIST: readonly { id: ChecklistId; label: string; feature?: FeatureId; implemented: boolean }[] = [
  { id: 'play', label: '경기 하기', implemented: true },
  { id: 'allocate', label: '포인트 찍기', feature: 'growth', implemented: true },
  { id: 'tactics', label: '전술 확인', feature: 'tactics', implemented: true },
  { id: 'deck', label: '역할 고르기 · 덱 확인', feature: 'deck', implemented: false },
  { id: 'inbox', label: '인박스 열기', implemented: false },
];

export function initialGuide(): GuideState {
  return { unlocked: [], introsSeen: [], tipsSeen: [], tipsOff: false, firstMatchSeen: false, done: [], tacticsDetailOpen: false };
}

export function progressOf(g: Pick<GameState, 'player' | 'league'>): Progress {
  const perSeason = g.league.schedule.length;
  return { matches: g.player.history.length * perSeason + g.league.round, seasons: g.player.history.length };
}

/** 조건을 넘긴 구현된 기능을 연다. 새로 열린 기능을 돌려준다 (이미 넘긴 세이브는 불러올 때 바로 열린다) */
export function refreshUnlocks(g: Pick<GameState, 'player' | 'league' | 'guide'>): FeatureId[] {
  const p = progressOf(g);
  const added: FeatureId[] = [];
  for (const f of FEATURES) {
    if (f.implemented && !g.guide.unlocked.includes(f.id) && f.open(p)) {
      g.guide.unlocked.push(f.id);
      added.push(f.id);
    }
  }
  if (p.matches >= 1) markDone(g.guide, 'play');
  return added;
}

export const isUnlocked = (guide: GuideState, id: FeatureId): boolean => guide.unlocked.includes(id);

/** 아직 소개를 안 본 열린 기능 (한 번에 하나) */
export function pendingIntro(guide: GuideState): FeatureDef | null {
  return FEATURES.find((f) => guide.unlocked.includes(f.id) && !guide.introsSeen.includes(f.id)) ?? null;
}

export function markDone(guide: GuideState, id: ChecklistId): void {
  if (!guide.done.includes(id)) guide.done.push(id);
}

/** 화면 첫 방문 말풍선: 끄지 않았고 처음이면 문구 */
export function tipFor(guide: GuideState, id: TipId): string | null {
  return guide.tipsOff || guide.tipsSeen.includes(id) ? null : TIPS[id];
}

/** 홈 체크리스트: 열린 기능 항목만. 모두 했으면 null */
export function checklistItems(guide: GuideState): { id: ChecklistId; label: string; done: boolean }[] | null {
  const items = CHECKLIST.filter((c) => c.implemented && (!c.feature || isUnlocked(guide, c.feature)))
    .map((c) => ({ id: c.id, label: c.label, done: guide.done.includes(c.id) }));
  return items.every((c) => c.done) && items.length >= CHECKLIST.filter((c) => c.implemented).length ? null : items;
}

/** "안내 다시 보기": 말풍선과 첫 경기 오버레이를 다시 */
export function resetTips(guide: GuideState): void {
  guide.tipsSeen = [];
  guide.tipsOff = false;
  guide.firstMatchSeen = false;
}
