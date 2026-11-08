// 외모군 (pending 50, 부록 C.43): 모든 선수에 붙는다. 기본 얼굴 이미지(public/faces/base)를 고르는 기준.
// 가상 선수는 국적별 분포(BALANCE.appearance)에서 선수 id 로 만든 별도 난수로 뽑아 기존 시드 흐름을 건드리지 않는다

import { REAL_APPEARANCE } from '../data/players/appearance';
import { BALANCE } from './config/balance';
import { createRng, hashSeed } from './rng';

export const APPEARANCES = ['eastAsian', 'white', 'irish', 'black', 'latinMideast'] as const;
export type Appearance = (typeof APPEARANCES)[number];

/** 국적 분포에서 뽑는다. key 가 같으면 늘 같은 결과 */
export function rollAppearance(key: string, nationality: string): Appearance {
  const A = BALANCE.appearance;
  const dist = A.byNationality[nationality] ?? A.fallback;
  const entries = APPEARANCES.map((a) => [a, dist[a] ?? 0] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((t, [, w]) => t + w, 0);
  let r = createRng(hashSeed(`appearance:${key}`))() * total;
  for (const [a, w] of entries) {
    if (r < w) return a;
    r -= w;
  }
  return entries[0]?.[0] ?? 'white';
}

/** 실제 선수: 데이터 표, 없으면 국적 분포 */
export function realAppearance(id: string, nationality: string): Appearance {
  return REAL_APPEARANCE[id] ?? rollAppearance(id, nationality);
}

/** 가상 유망주(내 선수)의 국적: 한글 이름 생성이라 한국 */
export const PROSPECT_NATIONALITY = 'Korea Republic';
