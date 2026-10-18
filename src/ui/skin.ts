// 화면 스타일 (부록 C.55): A = 볼트(둥근 알약), B = 브로드캐스트(꺾인 사각형·이탤릭 숫자, 기본).
// 세이브가 아니라 이 기기 설정(localStorage). <html data-skin> 으로 skin-b.css 층을 켜고 끈다.

export type Skin = 'a' | 'b';
export const SKIN_KO: Readonly<Record<Skin, string>> = { a: 'A 볼트', b: 'B 브로드캐스트' };
const SKIN_KEY = 'po-skin';

let cur: Skin = (() => {
  try {
    return globalThis.localStorage?.getItem(SKIN_KEY) === 'a' ? 'a' : 'b';
  } catch {
    return 'b';
  }
})();

export function skin(): Skin {
  return cur;
}

/** 지금 값을 문서에 반영 (시작할 때 한 번, 바꿀 때마다) */
export function applySkin(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.skin = cur;
}

export function setSkin(v: Skin): void {
  cur = v;
  try {
    globalThis.localStorage?.setItem(SKIN_KEY, v);
  } catch {
    // 저장 못 해도 이번 실행에는 적용
  }
  applySkin();
}

/** 가로 폰 (C.66, 사용자 지시 "모바일은 가로 전용"): 낮은 가로 화면. PC 2열 배치를 쓰고 높이만 줄인다(왼쪽 세로 레일 독, 한 줄 머리말) */
export const LANDPHONE_QUERY = '(orientation: landscape) and (max-height: 520px)';
/** 세로 폰 (C.66): 게임 대신 "가로로 돌려 주세요" 안내만 */
export const PORTRAIT_PHONE_QUERY = '(orientation: portrait) and (max-width: 600px)';
/** PC 2열 기준 (C.61 U5-g, 디자인 120~123·151~153): 1024px 이상 또는 가로 폰(C.66)이면 2열 배치 */
export const WIDE_QUERY = `(min-width: 1024px), ${LANDPHONE_QUERY}`;
let wideOverride: boolean | null = null;
let landOverride: boolean | null = null;
export function isWide(): boolean {
  return wideOverride ?? !!globalThis.matchMedia?.(WIDE_QUERY).matches;
}
/** 가로 폰이면 true (더보기는 시트 대신 레일 옆 펼침 줄) */
export function isLandPhone(): boolean {
  return landOverride ?? !!globalThis.matchMedia?.(LANDPHONE_QUERY).matches;
}
/** 테스트용: 폭 판정 고정 (null = 실제 화면) */
export function setWideForTest(v: boolean | null, land: boolean | null = null): void {
  wideOverride = v;
  landOverride = land;
}
