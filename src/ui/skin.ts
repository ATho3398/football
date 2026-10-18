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

/** PC 2열 기준 폭 (C.61 U5-g, 디자인 120~123·151~153): 1024px 이상이면 2열 배치. 폰(390)은 이 값이 false 라 C.54~C.60 그대로 */
export const WIDE_QUERY = '(min-width: 1024px)';
let wideOverride: boolean | null = null;
export function isWide(): boolean {
  return wideOverride ?? !!globalThis.matchMedia?.(WIDE_QUERY).matches;
}
/** 테스트용: 폭 판정 고정 (null = 실제 화면) */
export function setWideForTest(v: boolean | null): void {
  wideOverride = v;
}
