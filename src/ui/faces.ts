// 얼굴·엠블럼 (pending 49·50, 부록 C.43). 이미지 우선순위: 페이스온(사용자 업로드, IndexedDB) > 레포 사진(public/facepack, 위키백과 수집)
// > 기본 얼굴(public/faces/base, 외모군별) > 지금 아바타(가상 선수) / 자동 엠블럼(구단).
// 화면은 문자열로 그리므로 여기 상태는 동기 조회만 한다. 매니페스트·업로드 이미지는 시작할 때 읽고 다 읽으면 다시 그린다

import { ALL_REAL_PLAYERS } from '../../data/players';
import { OUTSIDE_CLUBS } from '../../data/outsideClubs';
import { aliasOf, OUTSIDE_TO_LEAGUE } from '../../data/clubAlias';
import { allLeagueData } from '../../data/leagues';
import { TEAM_COLORS } from '../../data/teamColors';
import type { Appearance } from '../appearance';
import type { FacePhoto } from '../identity';
import { initialTeams } from '../league';
import { hashSeed } from '../rng';
import type { PeopleTable, PixelPerson } from '../pixel';
import { storeBackend } from '../saveStore';

/** 화면이 얼굴을 찾을 때 넘기는 선수 정보. id = 로스터 선수 id (내 가상 유망주는 `me:<월드 시드>`) */
export interface FaceRef { id: string; age?: number; appearance?: Appearance;
  /** 내 가상 선수 기본 사진 (C.73c, public/faces/default): 페이스온·레포 사진이 없을 때 */
  photo?: FacePhoto }

export const AGE_SLOTS = ['young', 'prime', 'veteran'] as const;
export type AgeSlot = (typeof AGE_SLOTS)[number];
export const AGE_SLOT_KO: Readonly<Record<AgeSlot, string>> = { young: '~23세', prime: '24~29세', veteran: '30세~' };
/** 페이스온 칸: 선수는 나이대 3칸, 구단은 엠블럼 1칸 */
export type FaceSlot = AgeSlot | 'crest';

export function ageSlot(age: number): AgeSlot {
  return age <= 23 ? 'young' : age <= 29 ? 'prime' : 'veteran';
}

/** 그 나이 칸이 비었으면 가까운 칸 */
const NEAR_SLOTS: Readonly<Record<AgeSlot, readonly AgeSlot[]>> = {
  young: ['young', 'prime', 'veteran'], prime: ['prime', 'young', 'veteran'], veteran: ['veteran', 'prime', 'young'],
};

interface PhotoEntry { file: string; source?: string; page?: string; title?: string; /** 배경 없는 사진 (C.57) */ cutout?: boolean }
interface PhotoManifest { players?: Record<string, PhotoEntry>; clubs?: Record<string, PhotoEntry> }
interface BaseEntry { file: string; appearance: Appearance }

/** IndexedDB 에 담는 페이스온 한 건 (키 `face:<p:선수 id | t:팀 id>`) */
export interface FaceOnRecord { name: string; slots: Partial<Record<FaceSlot, Blob>>; updated: number;
  /** 배경 없는 사진(누끼, C.57): 미페 머리말에서 디자인 그대로(네모로 감싸지 않음). 업로드 때 켬/끔, 기본 끔 */
  cutout?: boolean }

const FACEPACK_DIR = 'facepack/';
const BASE_DIR = 'faces/base/';
const PIXEL_DIR = 'faces/pixel/';
const DEFAULT_DIR = 'faces/default/';

/** 기본 사진 주소 (C.73c): face = 얼굴 정사각(아바타), full = 전신 누끼(머리말) */
export function defaultPhotoSrc(photo: FacePhoto, kind: 'face' | 'full' = 'face'): string {
  return `${DEFAULT_DIR}${photo}${kind === 'face' ? '-face' : ''}.webp`;
}

const state = {
  photos: { players: {} as Record<string, string>, clubs: {} as Record<string, string>, cutout: new Set<string>() },
  base: [] as BaseEntry[],
  /** 도트 얼굴 (캐릭터 보기): 선수 id → 파일, 외모군 → 파일 목록 */
  pixel: { players: {} as Record<string, string>, appearance: {} as Partial<Record<Appearance, string[]>> },
  /** 도트 아이콘 레이어 (매니페스트 version 2, 부록 C.45): 유니폼 id → 파일, `피부_머리` → 파일, 피부 → 머리, 선수 id → 인물, 겹치는 순서 */
  layers: {
    kits: {} as Record<string, string>, persons: {} as Record<string, string>, people: null as PeopleTable | null,
    players: {} as Record<string, PixelPerson>, personTop: false,
  },
  /** 키 → 칸 → object URL */
  faceOn: new Map<string, { name: string; urls: Partial<Record<FaceSlot, string>>; cutout?: boolean }>(),
  ready: false,
};

// ── 이름 색인 (구단 이름 → id, 페이스팩 파일 이름 → 키) ──

interface ClubInfo { id: string; name: string; nameKo: string }
/** 구단 목록: 등록된 모든 리그 팀 (C.76c) + 리그 밖 클럽 중 리그 팀이 아닌 클럽 (같은 클럽 x: id 는 이름 색인에서 리그 팀으로) */
const CLUBS: ClubInfo[] = [
  ...allLeagueData().flatMap((d) => d.teams.map((t) => ({ id: t.id, name: t.name, nameKo: t.nameKo }))),
  ...OUTSIDE_CLUBS.filter((c) => !OUTSIDE_TO_LEAGUE[c.id]),
];
const norm = (s: string): string => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
const clubByName = new Map<string, ClubInfo>();
for (const c of CLUBS) for (const n of [c.id, c.name, c.nameKo]) if (norm(n)) clubByName.set(norm(n), c);

export function clubOf(nameOrId: string): ClubInfo | undefined {
  const k = norm(nameOrId);
  return k ? clubByName.get(k) : undefined;
}

export const ALL_CLUBS: readonly ClubInfo[] = CLUBS;

/** 선수 이름 색인: 실제 선수 + 지금 게임 로스터 (main 이 게임을 열 때 넣는다) */
const playerByName = new Map<string, string>();
function indexStatic(): void {
  for (const p of ALL_REAL_PLAYERS) for (const n of [p.id, p.name, p.nameKo]) if (norm(n)) playerByName.set(norm(n), p.id);
}
indexStatic();

export function setPlayerNames(entries: { id: string; name: string; nameKo?: string }[]): void {
  playerByName.clear();
  indexStatic();
  for (const e of entries) for (const n of [e.id, e.name, e.nameKo ?? '']) if (n && !playerByName.has(norm(n))) playerByName.set(norm(n), e.id);
}

export function playerIdOf(name: string): string | undefined {
  const k = norm(name);
  return k ? playerByName.get(k) : undefined;
}

// ── 조회 ──

export function faceSrc(ref: FaceRef): string | undefined {
  const on = state.faceOn.get(`p:${ref.id}`);
  if (on) {
    for (const s of NEAR_SLOTS[ageSlot(ref.age ?? 25)]) if (on.urls[s]) return on.urls[s];
  }
  const photo = state.photos.players[ref.id];
  if (photo) return photo;
  if (ref.photo) return defaultPhotoSrc(ref.photo);
  if (ref.appearance && state.base.length) {
    const list = state.base.filter((b) => b.appearance === ref.appearance);
    if (list.length) return BASE_DIR + list[hashSeed(`face:${ref.id}`) % list.length]!.file;
  }
  return undefined;
}

/**
 * 미페 머리말 사진 (C.57, B-apply 2절): 페이스온(사용자 업로드) > 레포 사진(facepack) > 내 가상 선수 기본 사진(C.73c) > 없음(외모군 기본 얼굴은 쓰지 않음 → 일반 B 머리말).
 * 투명 판정은 이미지 알파로 하지 않는다(facepack png도 RGBA) — 페이스온 "배경 없는 사진" 표시나 매니페스트 cutout: true 일 때만
 */
export function heroFaceOf(ref: FaceRef): { src: string; cutout: boolean } | null {
  const on = state.faceOn.get(`p:${ref.id}`);
  if (on) {
    for (const s of NEAR_SLOTS[ageSlot(ref.age ?? 25)]) if (on.urls[s]) return { src: on.urls[s]!, cutout: !!on.cutout };
  }
  const photo = state.photos.players[ref.id];
  if (photo) return { src: photo, cutout: state.photos.cutout.has(ref.id) };
  // 내 가상 선수 기본 사진 (C.73c): 배경 없는 전신 사진
  return ref.photo ? { src: defaultPhotoSrc(ref.photo, 'full'), cutout: true } : null;
}

/** 페이스온 "배경 없는 사진" 표시 (C.57) */
export function faceOnCutout(key: string): boolean {
  return !!state.faceOn.get(key)?.cutout;
}

export async function setFaceOnCutout(key: string, on: boolean): Promise<void> {
  const store = storeBackend();
  const rec = await store.get<FaceOnRecord>(`face:${key}`);
  if (!rec) return;
  if (on) rec.cutout = true;
  else delete rec.cutout;
  await store.put(`face:${key}`, rec);
  applyRecord(key, rec);
}

/** 도트 얼굴 (캐릭터 보기): 선수 지정 > 외모군 중 선수 id 시드로 1장. 없으면 undefined (등번호로 대체) */
export function pixelSrc(ref: FaceRef): string | undefined {
  const own = state.pixel.players[ref.id];
  if (own) return own;
  const list = ref.appearance ? state.pixel.appearance[ref.appearance] : undefined;
  return list?.length ? list[hashSeed(`pixel:${ref.id}`) % list.length] : undefined;
}

/** 도트 아이콘 version 1 직접 지정 파일 (선수 id → 파일). 있으면 레이어보다 먼저 (사용자 지정 인물은 그보다 먼저) */
export function pixelDirect(id: string): string | undefined {
  return state.pixel.players[id];
}

/** 매니페스트의 인물 표 (없으면 null → data/pixelPack.ts 표) */
export function pixelPeople(): PeopleTable | null {
  return state.layers.people;
}

/** 매니페스트 version 2 `players` 의 선수 인물 ({skin, hair}) */
export function pixelManifestLooks(): Readonly<Record<string, PixelPerson>> {
  return state.layers.players;
}

/** 인물 + 유니폼 → 겹쳐 그릴 이미지 주소 (아래 → 위). 레이어 이미지가 없으면 undefined (등번호로 대체) */
export function pixelLayerUrls(person: PixelPerson, kit: string): string[] | undefined {
  const p = state.layers.persons[`${person.skin}_${person.hair}`];
  const k = state.layers.kits[kit];
  if (!p || !k) return undefined;
  return state.layers.personTop ? [k, p] : [p, k];
}

/** 페이스온 > 레포 로고 */
export function crestSrc(teamId: string): string | undefined {
  // 같은 클럽 두 id (C.76c): 리그 팀 id ↔ 리그 밖 x: id 의 업로드·로고를 같이 쓴다
  const a = aliasOf(teamId);
  return state.faceOn.get(`t:${teamId}`)?.urls.crest ?? state.photos.clubs[teamId] ?? (a ? state.faceOn.get(`t:${a}`)?.urls.crest ?? state.photos.clubs[a] : undefined);
}

/** 페이스온 칸 상태 (설정 화면): 칸 → object URL */
export function faceOnUrls(key: string): Partial<Record<FaceSlot, string>> {
  return state.faceOn.get(key)?.urls ?? {};
}

/** 업로드가 없을 때 보이는 이미지 (설정 화면 "되돌리면 이렇게 보여요") */
export function defaultFaceSrc(ref: FaceRef): string | undefined {
  const keep = state.faceOn.get(`p:${ref.id}`);
  state.faceOn.delete(`p:${ref.id}`);
  const src = faceSrc(ref);
  if (keep) state.faceOn.set(`p:${ref.id}`, keep);
  return src;
}

export function repoCrest(teamId: string): string | undefined {
  const a = aliasOf(teamId);
  return state.photos.clubs[teamId] ?? (a ? state.photos.clubs[a] : undefined);
}

export function faceOnKeys(): { key: string; name: string; slots: FaceSlot[] }[] {
  return [...state.faceOn.entries()].map(([key, v]) => ({ key, name: v.name, slots: Object.keys(v.urls) as FaceSlot[] }));
}

export function faceStats(): { photos: number; clubs: number; base: number; pixel: number; faceOn: number } {
  const pixel = Object.keys(state.pixel.players).length + Object.values(state.pixel.appearance).reduce((t, l) => t + (l?.length ?? 0), 0)
    + Object.keys(state.layers.persons).length * Object.keys(state.layers.kits).length;
  return { photos: Object.keys(state.photos.players).length, clubs: Object.keys(state.photos.clubs).length, base: state.base.length, pixel, faceOn: state.faceOn.size };
}

// ── 자동 엠블럼 (구단 로고가 없을 때): 모양 + 팀 색 2개 + 이니셜, 이름 시드 고정 ──

const PALETTE = ['#c8102e', '#034694', '#fdb913', '#241f20', '#018749', '#6c1d45', '#0e63ad', '#ef7d00', '#7a263a', '#1d428a', '#e32221', '#5c2d91'];

export function clubColors(id: string): readonly [string, string] {
  const known = TEAM_COLORS[id];
  if (known) return known;
  const h = hashSeed(`colors:${id}`);
  const a = PALETTE[h % PALETTE.length]!;
  const b = h % 3 === 0 ? '#ffffff' : PALETTE[(h >>> 8) % PALETTE.length] === a ? '#ffffff' : PALETTE[(h >>> 8) % PALETTE.length]!;
  return [a, b];
}

const SKIP_WORDS = new Set(['fc', 'afc', 'cf', 'ac', 'as', 'sc', 'the', 'de', 'of', 'and', '&']);

export function clubInitials(name: string): string {
  const words = name.replace(/[.]/g, '').split(/[\s-]+/).filter((w) => w && !SKIP_WORDS.has(w.toLowerCase()));
  if (!words.length) return (name.trim()[0] ?? '?').toUpperCase();
  if (!/^[A-Za-z]/.test(words[0]!)) return words[0]!.slice(0, 1);
  return words.length === 1 ? words[0]!.slice(0, 3).toUpperCase() : words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join('');
}

const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

/** SVG 엠블럼 (viewBox 64×72). key = 팀 id 또는 이름 */
export function autoEmblem(key: string, name: string, size: number): string {
  const club = clubOf(key) ?? clubOf(name);
  const id = club?.id ?? key;
  const [c1, c2] = clubColors(id);
  const h = hashSeed(`emblem:${id}`);
  const shape = h % 4;
  const pattern = (h >>> 4) % 4;
  const initials = clubInitials(club?.name ?? name);
  const ink = lum(c1) > 0.6 ? '#1d1a19' : '#ffffff';
  const outlines = [
    'M32 3l27 8v23c0 18-12 30-27 35C17 64 5 52 5 34V11z', // 방패
    'M32 6a30 30 0 1 1 -0.01 0z', // 원
    'M32 3l29 33-29 33L3 36z', // 마름모
    'M10 6h44v32c0 14-10 24-22 30C20 62 10 52 10 38z', // 각진 방패
  ];
  const d = outlines[shape]!;
  const clip = `ce${h.toString(36)}`;
  const fills = [
    '', // 단색
    `<rect x="0" y="0" width="32" height="72" fill="${c2}"/>`, // 반반
    `<rect x="18" y="0" width="10" height="72" fill="${c2}"/><rect x="38" y="0" width="10" height="72" fill="${c2}"/>`, // 세로 줄
    `<rect x="0" y="28" width="64" height="16" fill="${c2}"/>`, // 가로 띠
  ];
  const fs = initials.length >= 3 ? 17 : initials.length === 2 ? 22 : 28;
  const textInk = pattern === 1 ? (lum(c1) > 0.6 ? '#1d1a19' : '#ffffff') : ink;
  return `<svg class="po-crest" viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" role="img" aria-label="${escAttr(name)}"><defs><clipPath id="${clip}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${clip})"><rect width="64" height="72" fill="${c1}"/>${fills[pattern]}</g><path d="${d}" fill="none" stroke="${c2 === '#ffffff' && lum(c1) > 0.8 ? '#1d1a19' : c2}" stroke-width="3"/><text x="32" y="${shape === 2 ? 43 : 44}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${textInk}" stroke="${textInk === '#ffffff' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)'}" stroke-width="0.6" paint-order="stroke" font-family="var(--font-sans)">${escAttr(initials)}</text></svg>`;
}

const escAttr = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ── 시작: 매니페스트와 페이스온 읽기 ──

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function initFaces(): Promise<void> {
  const [pm, bm, xm] = await Promise.all([
    fetchJson<PhotoManifest>(`${FACEPACK_DIR}manifest.json`),
    fetchJson<{ faces?: BaseEntry[] }>(`${BASE_DIR}manifest.json`),
    fetchJson<PixelManifest>(`${PIXEL_DIR}manifest.json`),
  ]);
  if (xm) applyPixelManifest(xm);
  for (const [id, e] of Object.entries(pm?.players ?? {})) {
    state.photos.players[id] = FACEPACK_DIR + e.file;
    if (e.cutout === true) state.photos.cutout.add(id);
  }
  for (const [id, e] of Object.entries(pm?.clubs ?? {})) state.photos.clubs[id] = FACEPACK_DIR + e.file;
  state.base = (bm?.faces ?? []).filter((f) => f && typeof f.file === 'string' && typeof f.appearance === 'string');
  try {
    const store = storeBackend();
    for (const k of await store.keys()) {
      if (!k.startsWith('face:')) continue;
      const rec = await store.get<FaceOnRecord>(k);
      if (rec) applyRecord(k.slice(5), rec);
    }
  } catch {
    // 저장소를 못 열면 페이스온 없이
  }
  state.ready = true;
}

/** 도트 매니페스트 (version 1: players 파일·appearance 목록, version 2: 레이어. docs/design/pixel-kits.md 2번) */
export interface PixelManifest {
  version?: number;
  players?: Record<string, string | { skin?: unknown; hair?: unknown }>;
  appearance?: Partial<Record<Appearance, string[]>>;
  order?: string;
  kits?: Record<string, { file?: unknown }>;
  personDir?: string;
  people?: Record<string, unknown>;
}

/** 도트 매니페스트 적용 (시작할 때, 테스트). version 1 `players` 파일 직접 지정·`appearance` 목록도 그대로 읽는다 */
export function applyPixelManifest(xm: PixelManifest): void {
  for (const [id, f] of Object.entries(xm.players ?? {})) {
    if (typeof f === 'string') state.pixel.players[id] = PIXEL_DIR + f;
    else if (f && typeof f.skin === 'string' && typeof f.hair === 'string') state.layers.players[id] = { skin: f.skin, hair: f.hair };
  }
  for (const [a, fs] of Object.entries(xm.appearance ?? {})) if (Array.isArray(fs)) state.pixel.appearance[a as Appearance] = fs.filter((f) => typeof f === 'string').map((f) => PIXEL_DIR + f);
  if (xm.version === 2) readPixelLayers(xm);
}

function readPixelLayers(xm: PixelManifest): void {
  const L = state.layers;
  for (const [id, k] of Object.entries(xm.kits ?? {})) if (k && typeof k.file === 'string') L.kits[id] = PIXEL_DIR + k.file;
  const dir = typeof xm.personDir === 'string' && xm.personDir ? `${xm.personDir.replace(/\/+$/, '')}/` : 'person/';
  const people: Record<string, string[]> = {};
  for (const [skin, hairs] of Object.entries(xm.people ?? {})) {
    if (!Array.isArray(hairs)) continue;
    people[skin] = hairs.filter((h): h is string => typeof h === 'string');
    for (const h of people[skin]) L.persons[`${skin}_${h}`] = `${PIXEL_DIR}${dir}${skin}_${h}.png`;
  }
  if (Object.keys(people).length) L.people = people;
  L.personTop = xm.order === 'person-over-kit';
}

function applyRecord(key: string, rec: FaceOnRecord): void {
  const old = state.faceOn.get(key);
  for (const u of Object.values(old?.urls ?? {})) if (u) URL.revokeObjectURL(u);
  const urls: Partial<Record<FaceSlot, string>> = {};
  for (const [s, b] of Object.entries(rec.slots)) if (b) urls[s as FaceSlot] = URL.createObjectURL(b);
  if (Object.keys(urls).length) state.faceOn.set(key, { name: rec.name, urls, ...(rec.cutout ? { cutout: true } : {}) });
  else state.faceOn.delete(key);
}

// ── 페이스온 쓰기 ──

export async function setFaceOn(key: string, name: string, slot: FaceSlot, blob: Blob): Promise<void> {
  const store = storeBackend();
  const rec = (await store.get<FaceOnRecord>(`face:${key}`)) ?? { name, slots: {}, updated: 0 };
  rec.name = name;
  rec.slots = { ...rec.slots, [slot]: blob };
  rec.updated = Date.now();
  await store.put(`face:${key}`, rec);
  applyRecord(key, rec);
}

/** slot 이 없으면 그 선수·구단 전부 되돌리기 */
export async function clearFaceOn(key: string, slot?: FaceSlot): Promise<void> {
  const store = storeBackend();
  const rec = await store.get<FaceOnRecord>(`face:${key}`);
  if (!rec) return;
  if (slot) {
    const { [slot]: _gone, ...rest } = rec.slots;
    rec.slots = rest;
  } else rec.slots = {};
  if (Object.keys(rec.slots).length) await store.put(`face:${key}`, rec);
  else await store.del(`face:${key}`);
  applyRecord(key, rec);
}

export async function allFaceOn(): Promise<[string, FaceOnRecord][]> {
  const store = storeBackend();
  const out: [string, FaceOnRecord][] = [];
  for (const k of await store.keys()) {
    if (!k.startsWith('face:')) continue;
    const rec = await store.get<FaceOnRecord>(k);
    if (rec) out.push([k.slice(5), rec]);
  }
  return out;
}

// ── 이미지 정사각형 정규화 (브라우저, C.43 개정): 자르지 않고 긴 쪽을 맞춘 뒤 짧은 쪽을 투명으로 채운 정사각형 PNG.
// 얼굴은 아래쪽 맞춤, 엠블럼은 가운데. 페이스온 편집에서 확대·이동(넘친 부분만 잘림)할 수 있다

/** zoom ≥ 1 (1 = 전체가 보이게), x·y = 출력 한 변 대비 이동(−1~1, 반 변 단위) */
export interface CropParams { zoom: number; x: number; y: number }
export type SquareAlign = 'bottom' | 'center';

/** 출력 정사각형(한 변 1) 안에 이미지를 놓는 자리 */
export function squareLayout(w: number, h: number, c: CropParams, align: SquareAlign): { x: number; y: number; w: number; h: number } {
  const k = c.zoom / Math.max(w, h);
  const dw = w * k;
  const dh = h * k;
  return { x: (1 - dw) / 2 + c.x * 0.5, y: (align === 'bottom' ? 1 - dh : (1 - dh) / 2) + c.y * 0.5, w: dw, h: dh };
}

export async function squareToBlob(img: HTMLImageElement, c: CropParams, out: number, align: SquareAlign): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const l = squareLayout(img.naturalWidth, img.naturalHeight, c, align);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, l.x * out, l.y * out, l.w * out, l.h * out);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), 'image/png'));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 읽지 못했어요'));
    img.src = src;
  });
}

// ── 페이스팩 zip (이름 → 이미지) ──

const SLOT_SET = new Set<string>([...AGE_SLOTS, 'crest']);
const extOf = (type: string): string => (type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : 'png');
const safeName = (s: string): string => s.replace(/[\\/:*?"<>|@]+/g, ' ').trim() || 'noname';

/** 내보내기: players/<이름>__<id>@<나이 칸>.webp, clubs/<이름>__<팀 id>.webp + facepack.json */
export async function exportFacepack(): Promise<Blob> {
  const { writeZip } = await import('./zip');
  const entries: { name: string; data: Uint8Array }[] = [];
  const index: { key: string; name: string; slot: FaceSlot; file: string; cutout?: boolean }[] = [];
  for (const [key, rec] of await allFaceOn()) {
    const club = key.startsWith('t:');
    for (const [slot, blob] of Object.entries(rec.slots)) {
      if (!blob) continue;
      const file = `${club ? 'clubs' : 'players'}/${safeName(rec.name)}__${key.slice(2)}${club ? '' : `@${slot}`}.${extOf(blob.type)}`;
      entries.push({ name: file, data: new Uint8Array(await blob.arrayBuffer()) });
      index.push({ key, name: rec.name, slot: slot as FaceSlot, file, ...(rec.cutout ? { cutout: true } : {}) });
    }
  }
  entries.push({ name: 'facepack.json', data: new TextEncoder().encode(JSON.stringify({ version: 1, entries: index }, null, 1)) });
  // 카드 이미지 (C.48): cards/<카드 id>.webp + cardart.json
  const { cardArtZipEntries } = await import('./cardArt');
  entries.push(...(await cardArtZipEntries()));
  return new Blob([writeZip(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

/**
 * 가져오기: facepack.json 이 있으면 그 키 그대로, 없으면 파일 이름으로 찾는다.
 * players/<선수 이름 또는 id>[@young|prime|veteran].png, clubs/<구단 이름 또는 id>.png (폴더가 없으면 선수 → 구단 순으로 찾는다)
 */
export async function importFacepack(file: Blob, nameOf: (key: string) => string | undefined, cardKnown: (id: string) => boolean = () => false): Promise<{ added: number; skipped: string[]; cards: number }> {
  const { readZip } = await import('./zip');
  const all = await readZip(new Uint8Array(await file.arrayBuffer()));
  // 카드 이미지 (C.48)는 따로 넣는다
  const { importCardArtEntries } = await import('./cardArt');
  const cardRes = await importCardArtEntries(all, cardKnown);
  const files = all.filter((f) => !f.name.startsWith('cards/') && f.name !== 'cardart.json');
  const byName = new Map(files.map((f) => [f.name, f]));
  const meta = byName.get('facepack.json');
  const jobs: { key: string; name: string; slot: FaceSlot; data: Uint8Array; file: string; cutout?: boolean }[] = [];
  const skipped: string[] = [];
  const known = new Set<string>();
  if (meta) {
    const idx = JSON.parse(new TextDecoder().decode(meta.data)) as { entries?: { key: string; name: string; slot: FaceSlot; file: string; cutout?: boolean }[] };
    for (const e of idx.entries ?? []) {
      const f = byName.get(e.file);
      if (f && SLOT_SET.has(e.slot) && /^[pt]:/.test(e.key)) {
        jobs.push({ key: e.key, name: e.name, slot: e.slot, data: f.data, file: e.file, ...(e.cutout ? { cutout: true } : {}) });
        known.add(e.file);
      }
    }
  }
  for (const f of files) {
    if (known.has(f.name) || f.name === 'facepack.json' || !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) continue;
    const parts = f.name.split('/');
    const folder = parts.length > 1 ? parts.at(-2)!.toLowerCase() : '';
    let base = parts.at(-1)!.replace(/\.[^.]+$/, '');
    let slot: FaceSlot | null = null;
    const at = base.lastIndexOf('@');
    if (at > 0 && SLOT_SET.has(base.slice(at + 1))) {
      slot = base.slice(at + 1) as FaceSlot;
      base = base.slice(0, at);
    }
    const idPart = base.includes('__') ? base.slice(base.lastIndexOf('__') + 2) : null;
    const label = base.includes('__') ? base.slice(0, base.lastIndexOf('__')) : base;
    const asPlayer = (): string | undefined => {
      const id = idPart && (playerIdOf(idPart) ?? (nameOf(`p:${idPart}`) ? idPart : undefined));
      return id ?? playerIdOf(label);
    };
    const asClub = (): string | undefined => (idPart ? clubOf(idPart)?.id : undefined) ?? clubOf(label)?.id;
    let key: string | undefined;
    if (folder.startsWith('club') || folder === 'crests' || folder === 'teams') key = asClub() && `t:${asClub()}`;
    else if (folder.startsWith('player') || folder === 'faces') key = asPlayer() && `p:${asPlayer()}`;
    else {
      const pid = asPlayer();
      const cid = asClub();
      key = pid ? `p:${pid}` : cid ? `t:${cid}` : undefined;
    }
    if (!key) {
      skipped.push(f.name);
      continue;
    }
    const club = key.startsWith('t:');
    jobs.push({ key, name: nameOf(key) ?? label, slot: club ? 'crest' : slot && slot !== 'crest' ? slot : 'prime', data: f.data, file: f.name });
  }
  let added = 0;
  for (const j of jobs) {
    const type = /\.webp$/i.test(j.file) ? 'image/webp' : /\.jpe?g$/i.test(j.file) ? 'image/jpeg' : /\.gif$/i.test(j.file) ? 'image/gif' : 'image/png';
    const url = URL.createObjectURL(new Blob([j.data as Uint8Array<ArrayBuffer>], { type }));
    try {
      const img = await loadImage(url);
      const club = j.key.startsWith('t:');
      const blob = await squareToBlob(img, { zoom: 1, x: 0, y: 0 }, club ? 160 : 256, club ? 'center' : 'bottom');
      await setFaceOn(j.key, j.name, j.slot, blob);
      if (j.cutout) await setFaceOnCutout(j.key, true);
      added++;
    } catch {
      skipped.push(j.file);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return { added, skipped: [...skipped, ...cardRes.skipped], cards: cardRes.added };
}
