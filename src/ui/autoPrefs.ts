// 시즌 자동 진행 설정 (22.2, 부록 C.73b): 포인트 추천 배분 자동 적용 · 선택 이벤트에서 멈춤 · 부상에서 멈춤.
// 기기 설정이라 세이브 밖 localStorage 에 둔다 (못 읽으면 기본값)

export interface AutoPrefs {
  /** 레벨업으로 생긴 포인트를 추천 배분(autoAllocate)으로 바로 찍는다 */
  alloc: boolean;
  /** 답이 필요한 선택 이벤트(인박스)가 새로 오면 멈춘다 */
  event: boolean;
  /** 내 선수가 새로 다치면 멈춘다 */
  injury: boolean;
}

export const AUTO_PREFS_DEFAULT: AutoPrefs = { alloc: true, event: true, injury: true };
const KEY = 'po-auto-prefs';

export function loadAutoPrefs(store?: Pick<Storage, 'getItem'> | null): AutoPrefs {
  try {
    const raw = (store === undefined ? globalThis.localStorage : store)?.getItem(KEY);
    if (!raw) return { ...AUTO_PREFS_DEFAULT };
    const o = JSON.parse(raw) as Partial<AutoPrefs>;
    return {
      alloc: typeof o.alloc === 'boolean' ? o.alloc : AUTO_PREFS_DEFAULT.alloc,
      event: typeof o.event === 'boolean' ? o.event : AUTO_PREFS_DEFAULT.event,
      injury: typeof o.injury === 'boolean' ? o.injury : AUTO_PREFS_DEFAULT.injury,
    };
  } catch {
    return { ...AUTO_PREFS_DEFAULT };
  }
}

export function saveAutoPrefs(p: AutoPrefs, store?: Pick<Storage, 'setItem'> | null): void {
  try {
    (store === undefined ? globalThis.localStorage : store)?.setItem(KEY, JSON.stringify(p));
  } catch {
    // 저장 못 해도 이번 실행 동안은 화면 상태로 유지
  }
}
