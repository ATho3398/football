// 팩 개봉 효과음 훅 (C.76o): 지금 게임에 효과음 체계가 없어 소리는 내지 않는다. 체계가 생기면 setPackSfx 로 연결한다

import type { AnimRarity } from './types';

export type PackSfx = 'appear' | 'tremble' | 'tear' | 'beam' | 'walkout' | 'deal' | 'flip' | 'flipRare';

let handler: ((name: PackSfx, rarity?: AnimRarity) => void) | null = null;

export function setPackSfx(h: typeof handler): void {
  handler = h;
}

export function sfx(name: PackSfx, rarity?: AnimRarity): void {
  try {
    handler?.(name, rarity);
  } catch {
    // 소리 실패는 연출을 막지 않는다
  }
}
