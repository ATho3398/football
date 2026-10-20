// 팩 개봉 연출 (C.76o): DOM 없는 순수 규칙 — 최고 희귀도, 연출 설정, 희귀도별 세기, 교체 파일 이름

import type { AnimRarity } from './types';

export const RARITY_ORDER: readonly AnimRarity[] = ['common', 'rare', 'epic', 'legendary'];
export const RARITY_KO: Record<AnimRarity, string> = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' };

export function rarityRank(r: AnimRarity): number {
  return RARITY_ORDER.indexOf(r);
}

/** 팩에서 나온 최고 희귀도 (빈 팩이면 일반) */
export function bestRarity(rs: readonly AnimRarity[]): AnimRarity {
  return rs.reduce<AnimRarity>((b, r) => (rarityRank(r) > rarityRank(b) ? r : b), 'common');
}

// ── 설정: 팩 개봉 연출 전체/짧게/끔 (기기 설정, 세이브 밖 localStorage) ──

export type PackAnimPref = 'full' | 'short' | 'off';
export const PACK_ANIM_PREF_KO: Record<PackAnimPref, string> = { full: '전체', short: '짧게', off: '끔' };
const KEY = 'po-pack-anim';

export function loadPackAnimPref(store?: Pick<Storage, 'getItem'> | null): PackAnimPref {
  try {
    const v = (store === undefined ? globalThis.localStorage : store)?.getItem(KEY);
    return v === 'short' || v === 'off' ? v : 'full';
  } catch {
    return 'full';
  }
}

export function savePackAnimPref(p: PackAnimPref, store?: Pick<Storage, 'setItem'> | null): void {
  try {
    (store === undefined ? globalThis.localStorage : store)?.setItem(KEY, p);
  } catch {
    // 저장 못 해도 이번 실행 동안은 유지
  }
}

/** 실제 연출: prefers-reduced-motion 이면 '전체'도 짧게 */
export function resolveMode(pref: PackAnimPref, reducedMotion: boolean): PackAnimPref {
  return pref === 'full' && reducedMotion ? 'short' : pref;
}

// ── 희귀도별 연출 세기 ──

export interface RarityFx {
  /** 빛 기둥·테두리 색 */
  color: string;
  /** 입자 폭발 수 (상한은 particleCap) */
  burst: number;
  /** 화면 흔들림 (px, 0 = 없음) */
  shake: number;
  /** 개봉 전 떨림 시간 (ms) */
  tremble: number;
  /** 짧은 '워크아웃' 연출 (전설) */
  walkout: boolean;
  /** 뒤집기 전 떨림·빛 테두리, 앞면 홀로그램 (에픽 이상) */
  holo: boolean;
}

export const RARITY_FX: Record<AnimRarity, RarityFx> = {
  common: { color: '#f3f4f6', burst: 24, shake: 0, tremble: 420, walkout: false, holo: false },
  rare: { color: '#4aa8ff', burst: 48, shake: 0, tremble: 520, walkout: false, holo: false },
  epic: { color: '#b69cff', burst: 90, shake: 4, tremble: 700, walkout: false, holo: true },
  legendary: { color: '#ffd23f', burst: 140, shake: 9, tremble: 900, walkout: true, holo: true },
};

/** 입자 상한: 폰(좁은 화면)은 낮춘다 (60fps 목표) */
export function particleCap(width: number): number {
  return width < 600 ? 160 : 260;
}

/** 한 번 폭발에 쓸 입자 수 */
export function burstCount(r: AnimRarity, width: number, short: boolean): number {
  const n = RARITY_FX[r].burst;
  return Math.min(particleCap(width), short ? Math.round(n / 2) : n);
}

// ── 대체 연출 파일 이름 규칙 (docs/pack-animation.md) ──

export const PACK_ANIM_DIR = 'anim/pack/';

/** 영상: anim/pack/pack-legendary.webm (희귀도별 1개) */
export function videoFile(r: AnimRarity, ext: 'webm' | 'mp4' = 'webm', dir = PACK_ANIM_DIR): string {
  return `${dir}pack-${r}.${ext}`;
}

/** PNG 시퀀스: anim/pack/pack-legendary/0001.png … (1부터, 네 자리) */
export function sequenceFrame(r: AnimRarity, i: number, dir = PACK_ANIM_DIR): string {
  return `${dir}pack-${r}/${String(i + 1).padStart(4, '0')}.png`;
}

/** 표지 후보 (먼저 있는 것): 팩은 cover-<종류>.png → cover.png, 선택권은 cover-<종류>.png 만 (없으면 팩 없이 빛 구슬) */
export function coverFiles(kind: 'pack' | 'pick', cover: string | undefined, dir = PACK_ANIM_DIR): string[] {
  const own = cover ? [`${dir}cover-${cover}.png`] : [];
  return kind === 'pack' ? [...own, `${dir}cover.png`] : own;
}

/** 표지를 찢는 선(지그재그)으로 자른 clip-path: 'top' = 위 띠, 'body' = 몸통. tear = 위에서 비율 */
export function coverClip(part: 'top' | 'body', tear: number, teeth = 10): string {
  const t = Math.max(0.03, Math.min(0.5, tear)) * 100;
  const zig: string[] = [];
  for (let i = 0; i <= teeth * 2; i++) zig.push(`${((i / (teeth * 2)) * 100).toFixed(1)}% ${(t + (i % 2 ? 1.5 : -1.5)).toFixed(1)}%`);
  return part === 'top' ? `polygon(0% 0%, 100% 0%, ${[...zig].reverse().join(', ')})` : `polygon(${zig.join(', ')}, 100% 100%, 0% 100%)`;
}

// ── 선택권 공개를 한 번만 보여 주기 (같은 선택권을 다시 열면 바로 고르기 화면) ──

const SEEN_KEY = 'po-pick-seen';
const SEEN_MAX = 40;

export function pickKey(label: string, options: readonly string[]): string {
  return `${label}|${options.join(',')}`;
}

export function pickSeen(key: string, store?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const raw = (store === undefined ? globalThis.localStorage : store)?.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(key) : false;
  } catch {
    return false;
  }
}

export function markPickSeen(key: string, store?: Pick<Storage, 'getItem' | 'setItem'> | null): void {
  try {
    const s = store === undefined ? globalThis.localStorage : store;
    if (!s) return;
    const raw = s.getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as string[]).filter((k) => k !== key) : [];
    list.push(key);
    s.setItem(SEEN_KEY, JSON.stringify(list.slice(-SEEN_MAX)));
  } catch {
    // 못 쓰면 다음에 한 번 더 보일 뿐
  }
}
