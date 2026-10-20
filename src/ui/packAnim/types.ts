// 팩 개봉 연출 (부록 C.76o) 공통 타입. 연출은 결과가 정해진 뒤 보여 주기만 한다 (확률·보상 로직과 무관)

export type AnimRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** 팩 정보: kind 'pack' = 카드팩(팩 그림 → 찢기 → 공개), 'pick' = 카드 선택권(3택 1, 팩 없이 빛 → 공개) */
export interface PackInfo {
  kind: 'pack' | 'pick';
  name: string;
  /** 업적·시즌 목표 선택권(에픽·전설) — 더 화려하게 */
  fancy?: boolean;
  /** 표지 종류 (public/anim/pack/cover-<cover>.png, 팩은 없으면 cover.png → 코드로 그린 기본 팩). 예 'normal' · 'achievement' · 'pick' */
  cover?: string;
}

/** 공개할 카드 한 장. html 은 앞면 마크업(GameCard full) */
export interface AnimCard {
  id: string;
  name: string;
  rarity: AnimRarity;
  html: string;
  /** 처음 얻은 카드 */
  isNew: boolean;
  /** 이미 가진 카드 (한 장 더) */
  dup: boolean;
  /** 결과 목록 한 줄 설명 (종류 등) */
  sub?: string;
}

export interface PackAnimOptions {
  pack: PackInfo;
  cards: AnimCard[];
  bestRarity: AnimRarity;
  /** 연출 세기: full = 전체, short = 짧게 (prefers-reduced-motion 포함) */
  mode?: 'full' | 'short';
  /** 연출을 그릴 무대 (없으면 구현이 정한다) */
  stage?: HTMLElement;
}

/** 교체 가능한 연출 인터페이스 (기본 = 코드 모션 그래픽, 대체 = 영상·PNG 시퀀스 어댑터) */
export interface PackAnimation {
  play(opts: PackAnimOptions): Promise<void>;
  /** 언제든 바로 끝낸다 (play 의 Promise 가 곧 풀린다) */
  skip(): void;
}

/** packAnim/config.ts 에서 고르는 구현 */
export type PackAnimConfig =
  | { kind: 'motion' }
  | { kind: 'video'; dir?: string; ext?: 'webm' | 'mp4'; sound?: boolean; reveal?: boolean }
  | { kind: 'sequence'; dir?: string; frames: number; fps?: number; reveal?: boolean };
