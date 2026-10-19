// 내 선수 인종·기본 사진·랜덤 국적/이름 (부록 C.73c). 겉모습만이라 경기 결과·로스터 시드에 영향이 없다.
// 인종 4개(중동·동양인·백인·흑인)는 외모군(Appearance) 중 4개에 대응하고, 기본 사진(public/faces/default)도 4장이다.
// 랜덤 생성은 `identity:<시드>` 별도 난수로 인종 → 그 인종 국적 → 그 국적 이름을 뽑는다

import { NAME_POOLS, PLAYER_EXTRA_POOLS, type PlayerNamePool } from '../data/names';
import type { Appearance } from './appearance';
import { BALANCE } from './config/balance';
import { randomName } from './prospect';
import { createRng, hashSeed, type Rng } from './rng';
import { nameFromPool } from './roster';

/** 생성 화면 순서 (사용자 지시): 중동 → 동양인 → 백인 → 흑인 */
export const RACES = ['latinMideast', 'eastAsian', 'white', 'black'] as const satisfies readonly Appearance[];
export type Race = (typeof RACES)[number];
export const RACE_KO: Readonly<Record<Race, string>> = { latinMideast: '중동', eastAsian: '동양인', white: '백인', black: '흑인' };

/** 기본 사진 4장 (public/faces/default/<id>.webp 전신 누끼, <id>-face.webp 얼굴 정사각) */
export const FACE_PHOTOS = ['mideast', 'asian', 'white', 'black'] as const;
export type FacePhoto = (typeof FACE_PHOTOS)[number];
export const PHOTO_OF: Readonly<Record<Appearance, FacePhoto>> = {
  latinMideast: 'mideast', eastAsian: 'asian', white: 'white', irish: 'white', black: 'black',
};
export const PHOTO_KO: Readonly<Record<FacePhoto, string>> = { mideast: '중동', asian: '동양인', white: '백인', black: '흑인' };
export const isFacePhoto = (v: unknown): v is FacePhoto => (FACE_PHOTOS as readonly unknown[]).includes(v);
export const isRace = (v: unknown): v is Race => (RACES as readonly unknown[]).includes(v);

/** 외모군 → 인종 (아일랜드계는 백인) */
export function raceOf(a: Appearance): Race {
  return a === 'irish' ? 'white' : a;
}

const KOREA = 'Korea Republic';
const POOLS: readonly PlayerNamePool[] = [...NAME_POOLS, ...PLAYER_EXTRA_POOLS];

function pickW<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((t, [, w]) => t + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    if (r < w) return v;
    r -= w;
  }
  return entries[entries.length - 1]![0];
}

/** 그 인종의 국적 가중치: 이름 풀 weight × 그 국적의 인종 분포(%) (중동은 중동 국적만) */
export function raceNationalities(race: Race): [string, number][] {
  const A = BALANCE.appearance;
  if (race === 'latinMideast') return A.random.mideastNationalities.map((n) => [n, POOLS.find((p) => p.nationality === n)?.weight ?? 1]);
  const out: [string, number][] = race === 'eastAsian' ? [[KOREA, A.random.koreaWeight]] : [];
  for (const p of POOLS) {
    const d = A.byNationality[p.nationality] ?? A.fallback;
    const w = race === 'white' ? (d.white ?? 0) + (d.irish ?? 0) : d[race] ?? 0;
    if (w > 0) out.push([p.nationality, (p.weight * w) / 100]);
  }
  return out;
}

/** 그 국적 이름 (한글 표기). 한국은 한글 이름, 풀이 없는 국적은 undefined */
function poolName(nationality: string, rng: Rng): string | undefined {
  if (nationality === KOREA) return randomName(rng);
  const pool = POOLS.find((p) => p.nationality === nationality);
  if (!pool) return undefined;
  const gi = Math.floor(rng() * pool.given.length);
  const fi = Math.floor(rng() * pool.family.length);
  const ko = nameFromPool(pool, gi, fi, 2).nameKo;
  if (!pool.familyFirst) return ko;
  const [g, ...f] = ko.split(' ');
  return `${f.join(' ')}${pool.joined ? '' : ' '}${g}`;
}

export interface Identity { race: Race; nationality: string; name: string; photo: FacePhoto }

/** 랜덤 인종·국적·이름·사진. race 를 주면 그 인종 안에서 국적·이름 (같은 key 면 늘 같은 결과) */
export function rollIdentity(key: string, race?: Race): Identity {
  const rng = createRng(hashSeed(`identity:${key}`));
  const rolled = pickW(rng, RACES.map((r) => [r, BALANCE.appearance.random.race[r]] as const));
  const r = race ?? rolled;
  const nationality = pickW(rng, raceNationalities(r));
  return { race: r, nationality, name: poolName(nationality, rng) ?? randomName(rng), photo: PHOTO_OF[r] };
}

/** 커스텀 생성 이름이 비었을 때: 고른 국적 이름 (풀이 없는 국적은 고른 외모의 랜덤 국적 이름) */
export function randomNameFor(key: string, nationality: string, appearance: Appearance): string {
  return poolName(nationality, createRng(hashSeed(`name:${key}`))) ?? rollIdentity(key, raceOf(appearance)).name;
}
