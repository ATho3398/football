// 인박스 (20.4, 부록 C.63): 정보형 메시지(읽음 표시)와 선택형 메시지(응답 필요, 기한이 지나면 기본 선택).
// 이벤트 엔진(events.ts)·감독·이적·태그·포변 조언 알림이 모두 여기로 모인다. 홈 상단 알림 아이콘 → 인박스 화면, 홈에는 안 읽은 것 최대 3개

import { BALANCE } from './config/balance';
import type { IsoDate } from './calendar';
import type { GameState } from './game';

export type InboxCat = 'event' | 'media' | 'club' | 'manager' | 'rival' | 'transfer' | 'contract' | 'tag' | 'advice' | 'life' | 'team' | 'goal';

export const INBOX_CAT_KO: Record<InboxCat, string> = {
  event: '소식', media: '언론', club: '구단', manager: '감독', rival: '라이벌', transfer: '이적', contract: '계약', tag: '태그', advice: '포변 조언', life: '생활', team: '동료', goal: '시즌 목표',
};

export interface InboxChoice { id: string; label: string; desc: string; disabled?: string }

export interface InboxItem {
  id: number;
  /** 같은 알림을 두 번 넣지 않는 열쇠 (이적 제안 창, 태그 시즌 등) */
  key?: string;
  date: IsoDate;
  season: number;
  cat: InboxCat;
  title: string;
  body: string;
  read: boolean;
  /** 이벤트에서 왔으면 이벤트 id */
  ev?: string;
  /** 선택형: 선택지, 기한(이 날이 끝날 때 기본 선택) */
  choices?: InboxChoice[];
  due?: IsoDate;
  /** 답 (auto = 기한이 지나 기본 선택) */
  answer?: { id: string; label: string; text: string; auto?: boolean };
  /** 이동 버튼 (화면 id 또는 동작) */
  link?: { to?: string; act?: string; v?: string; label: string };
}

export interface InboxState { items: InboxItem[]; seq: number }

export function ensureInbox(state: GameState): InboxState {
  return (state.inbox ??= { items: [], seq: 0 });
}

/** 넣기. key 가 이미 있으면 넣지 않고 그 알림을 돌려준다 */
export function pushInbox(state: GameState, item: Omit<InboxItem, 'id' | 'read' | 'date' | 'season'> & { date?: IsoDate; season?: number; read?: boolean }): InboxItem {
  const box = ensureInbox(state);
  if (item.key) {
    const had = box.items.find((x) => x.key === item.key);
    if (had) return had;
  }
  const it: InboxItem = { read: false, date: state.calendar.date, season: state.league.season, ...item, id: ++box.seq };
  box.items.push(it);
  trimInbox(box);
  return it;
}

/** 오래된 읽은 알림부터 지운다 (답할 것은 남긴다) */
function trimInbox(box: InboxState): void {
  const max = BALANCE.events.inboxMax;
  while (box.items.length > max) {
    const i = box.items.findIndex((x) => x.read && !isPending(x));
    if (i < 0) break;
    box.items.splice(i, 1);
  }
}

export const isPending = (x: InboxItem): boolean => !!x.choices && !x.answer;

export function unreadCount(state: GameState): number {
  return (state.inbox?.items ?? []).filter((x) => !x.read || isPending(x)).length;
}

export function pendingItems(state: GameState): InboxItem[] {
  return (state.inbox?.items ?? []).filter(isPending);
}

/** 새것부터 */
export function inboxList(state: GameState, filter: 'all' | 'todo' | 'info' = 'all'): InboxItem[] {
  const all = [...(state.inbox?.items ?? [])].reverse();
  if (filter === 'todo') return all.filter(isPending);
  if (filter === 'info') return all.filter((x) => !x.choices);
  return all;
}

export function inboxItem(state: GameState, id: number): InboxItem | undefined {
  return state.inbox?.items.find((x) => x.id === id);
}

export function markRead(state: GameState, id: number): void {
  const it = inboxItem(state, id);
  if (it) it.read = true;
}

/** 정보형만 모두 읽음 (답할 것은 그대로) */
export function markAllRead(state: GameState): void {
  for (const x of state.inbox?.items ?? []) if (!isPending(x)) x.read = true;
}
